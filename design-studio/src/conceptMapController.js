import { boundMapProjectIdFor, conceptMapEditorUrl } from "./conceptMapBridgeStore.js";
import {
  applyMapDocumentToConceptMap,
  buildConceptMapPlanFromPlanning,
  createInitialConceptMapDraft,
  ensureConceptMapBinding,
  extractForcePlacements,
  isCurrentConceptMap,
  normalizeConceptMap,
  persistConceptMap,
  updateConceptMapReference
} from "./conceptMapStore.js";

/**
 * Concept-map step controller: deterministic planning seed (no AI),
 * iframe preview of combat-map-web, 1:1 project bind, open standalone editor.
 * Standalone window edits auto-sync via map-document-changed postMessage.
 */
export function createConceptMapController({
  projectId,
  getState,
  render,
  notify,
  syncConceptMap,
  invalidateDependents,
  projectTitle,
  onReferenceConfirmed
}) {
  let messageListenerBound = false;
  /** @type {{ frame: HTMLIFrameElement, key: string } | null} */
  let pendingPush = null;
  const deliveredKeyByFrame = new WeakMap();
  /** @type {((payload: any) => void) | null} */
  let exportWaiter = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let changeSyncTimer = null;
  let lastAppliedChangeKey = "";
  let applyingToolDocument = false;
  /** @type {{ payload: any, options: any } | null} */
  let pendingLiveApply = null;

  return {
    bind() {
      if (!messageListenerBound) {
        window.addEventListener("message", handleEditorMessage);
        messageListenerBound = true;
      }
    },

    /** Deterministic seed from force/phase planning — no AI. */
    seedFromPlanning,

    handleAction(action) {
      if (action === "seed-concept-map-from-planning") {
        void seedFromPlanning({ confirmReplace: true });
        return true;
      }
      if (action === "pull-concept-map-from-tool") {
        void pullFromTool();
        return true;
      }
      if (action === "confirm-concept-map-step") {
        void confirmStep();
        return true;
      }
      if (action === "open-concept-map-external") {
        openExternalEditor();
        return true;
      }
      return false;
    }
  };

  function bindingMeta(state = getState()) {
    const workbenchProjectId = state.activeProjectId || projectId || "default";
    const map = ensureConceptMapBinding(state.conceptMap, workbenchProjectId, projectTitle?.() || "作战概念图");
    return {
      workbenchProjectId,
      mapProjectId: map.boundMapProjectId || boundMapProjectIdFor(workbenchProjectId),
      title: map.title || projectTitle?.() || "作战概念图",
      map
    };
  }

  function editorOrigin() {
    try {
      return new URL(conceptMapEditorUrl(getState().conceptMapBridge.settings.targetUrl)).origin;
    } catch {
      return window.location.origin;
    }
  }

  function workbenchOrigin() {
    try {
      return window.location.origin;
    } catch {
      return "";
    }
  }

  function openExternalEditor() {
    const state = getState();
    const { mapProjectId, title } = bindingMeta(state);
    // Full tool chrome for deep editing (not workbenchPreview).
    // Keep opener so the tool can postMessage map-document-changed back here.
    const url = conceptMapEditorUrl(state.conceptMapBridge.settings.targetUrl, {
      mapProjectId,
      title,
      includeTitle: true,
      workbenchPreview: false,
      parentOrigin: workbenchOrigin()
    });
    const editor = window.open(url, "concept-map-editor");
    if (!editor) {
      notify("浏览器拦截了弹窗，请允许本站弹窗后重试「打开绘制工具」");
      return;
    }
    try { editor.focus(); } catch { /* cross-window focus may be blocked */ }
    notify("已打开绘制工具；保存后会自动同步到预览（一般无需「拉取最新」）");
  }

  function handleEditorMessage(event) {
    if (event.origin !== editorOrigin()) return;
    const message = event.data;
    if (message?.channel !== "combat-concept.deployment" || message.version !== 1) return;

    const frame = document.querySelector("#conceptMapFrame");
    const fromIframe = Boolean(frame && event.source === frame.contentWindow);

    // Standalone / iframe autosave → workbench state only.
    // Preview map windows sync item-level patches via BroadcastChannel (no full reload).
    if (message.type === "map-document-changed") {
      queueToolDocumentChange(message.payload || {}, {
        refreshIframe: false,
        softUi: true,
        notifyUser: false
      });
      return;
    }

    // Remaining protocol is iframe-only.
    if (!fromIframe || !frame) return;

    if (message.type === "map-document-loaded" && pendingPush?.frame === frame) {
      deliveredKeyByFrame.set(frame, pendingPush.key);
      pendingPush = null;
      return;
    }
    if (message.type === "map-document-rejected" && pendingPush?.frame === frame) {
      pendingPush = null;
      return;
    }
    if (message.type === "map-document-export") {
      exportWaiter?.(message.payload || {});
      exportWaiter = null;
      return;
    }
    if (message.type === "ready") {
      const state = getState();
      const { mapProjectId, title, map } = bindingMeta(state);
      // Ensure tool opens the bound project even before a document push.
      frame.contentWindow.postMessage({
        channel: "combat-concept.deployment",
        version: 1,
        type: "bind-workbench-project",
        payload: { mapProjectId, title }
      }, editorOrigin());
      if (map.document?.items?.length) {
        sendDocumentToEditor(frame, map, { force: false });
      }
    }
  }

  function mapDocumentKey(document) {
    const items = Array.isArray(document?.items) ? document.items : [];
    return `${Number(document?.version) || 0}:${items.length}:${items.map((item) => String(item?.id || "")).join(",")}`;
  }

  function mapDocumentChangeKey(document) {
    const items = Array.isArray(document?.items) ? document.items : [];
    const phaseId = String(document?.operation?.activePhaseId || "");
    // Include rounded coordinates so force drags always produce a new storage key.
    const body = items.map((item) => [
      item?.id,
      item?.type,
      item?.name,
      item?.symbol,
      Number.isFinite(Number(item?.lon)) ? Number(item.lon).toFixed(6) : "",
      Number.isFinite(Number(item?.lat)) ? Number(item.lat).toFixed(6) : "",
      item?.rotation,
      item?.layer,
      Array.isArray(item?.points)
        ? item.points.map((point) => `${Number(point?.lon).toFixed(5)},${Number(point?.lat).toFixed(5)}`).join(";")
        : ""
    ].join("|")).join(";");
    return `${mapDocumentKey(document)}:${phaseId}:${body}`;
  }

  function sendDocumentToEditor(frame, map, { force = false } = {}) {
    if (!frame?.contentWindow || !map?.document?.items?.length) return;
    const key = mapDocumentKey(map.document);
    if (!force) {
      if (pendingPush?.frame === frame && pendingPush.key === key) return;
      if (deliveredKeyByFrame.get(frame) === key) return;
    }
    const { mapProjectId, title } = bindingMeta();
    pendingPush = { frame, key };
    frame.contentWindow.postMessage({
      channel: "combat-concept.deployment",
      version: 1,
      type: "load-map-document",
      payload: {
        title,
        document: map.document,
        mapProjectId,
        silent: true,
        force: Boolean(force)
      }
    }, editorOrigin());
  }

  function queueToolDocumentChange(payload, {
    refreshIframe = false,
    softUi = true,
    notifyUser = false
  } = {}) {
    if (!payload?.ok || !payload.document?.items?.length) return;
    const { mapProjectId } = bindingMeta();
    const incomingId = String(payload.mapProjectId || "").trim();
    if (incomingId && mapProjectId && incomingId !== mapProjectId) return;

    // Deep-clone so later tool mutations cannot mutate the queued snapshot.
    const snapshot = {
      ...payload,
      document: JSON.parse(JSON.stringify(payload.document))
    };
    const changeKey = mapDocumentChangeKey(snapshot.document);
    if (changeKey === lastAppliedChangeKey) return;

    const options = {
      refreshIframe,
      softUi,
      notifyUser,
      source: "concept-map:tool-live-sync",
      toastPrefix: "已自动同步绘制修改"
    };

    // If a save is in-flight, keep only the latest snapshot and flush after.
    if (applyingToolDocument) {
      pendingLiveApply = { payload: snapshot, options };
      return;
    }

    if (changeSyncTimer) clearTimeout(changeSyncTimer);
    changeSyncTimer = setTimeout(() => {
      changeSyncTimer = null;
      void applyToolDocument(snapshot, options);
    }, 220);
  }

  function softUpdateConceptMapChrome(map) {
    const root = document.querySelector(".concept-map-workspace");
    const itemCount = Array.isArray(map?.document?.items) ? map.document.items.length : 0;
    const phaseCount = Array.isArray(map?.document?.operation?.phases) ? map.document.operation.phases.length : 0;
    if (root) {
      const stats = root.querySelector('[data-concept-map-stat="objects"]');
      if (stats) stats.textContent = itemCount ? `${itemCount} 对象 · ${phaseCount} 阶段` : "尚未生成初图";

      const tag = root.querySelector("[data-concept-map-status]");
      if (tag) {
        tag.textContent = "待确认";
        tag.classList.add("review");
        tag.classList.remove("is-ready");
      }

      const seedLabel = root.querySelector("[data-concept-map-seed-label]");
      if (seedLabel) seedLabel.textContent = itemCount ? "按规划重建" : "从规划生成";

      const confirmBtn = root.querySelector('[data-action="confirm-concept-map-step"]');
      if (confirmBtn instanceof HTMLButtonElement) {
        const busy = Boolean(getState().conceptMapSeeding || getState().conceptMapPulling);
        confirmBtn.disabled = itemCount === 0 || busy;
        confirmBtn.dataset.conceptMapConfirmed = "false";
        confirmBtn.title = itemCount === 0
          ? "请先生成或同步地图内容后再确认"
          : "确认当前概念图作为 OV 参考，并进入 OV-1";
        const confirmLabel = confirmBtn.querySelector("[data-concept-map-confirm-label]");
        if (confirmLabel) confirmLabel.textContent = "确认并进入 OV-1";
      }

      const pullBtn = root.querySelector('[data-action="pull-concept-map-from-tool"]');
      if (pullBtn instanceof HTMLButtonElement) {
        pullBtn.title = itemCount
          ? "从预览/绘制工具主动拉取最新内容（自动同步失败时可手动恢复）。"
          : "尚无地图内容。请先从规划生成，或在绘制工具中编辑后再拉取。";
      }
    }

    // Soft-update menubar revision badge without rebuilding viewRoot / iframe.
    const state = getState();
    const revision = Number(state.projectRevision || state.conceptMapStorage?.revision || 0);
    const storageEl = document.getElementById("projectStorageState");
    if (storageEl && revision > 0) {
      storageEl.innerHTML = `<span></span> 服务端 r${revision}`;
    }

    // Soft-update left tree step status for concept-map if present.
    const treeItem = document.querySelector('#conceptTree [data-view="concept-map"], #conceptTree [data-nav="concept-map"]');
    if (treeItem) {
      treeItem.classList.remove("is-confirmed", "is-done");
      treeItem.classList.add("is-pending", "is-review");
    }
  }

  async function applyToolDocument(payload, {
    refreshIframe = false,
    softUi = false,
    notifyUser = false,
    source = "concept-map:tool-live-sync",
    toastPrefix = "已同步绘制工具内容"
  } = {}) {
    if (!payload?.ok || !payload.document?.items?.length) return null;
    if (applyingToolDocument) {
      pendingLiveApply = {
        payload: {
          ...payload,
          document: JSON.parse(JSON.stringify(payload.document))
        },
        options: { refreshIframe, softUi, notifyUser, source, toastPrefix }
      };
      return null;
    }
    const changeKey = mapDocumentChangeKey(payload.document);
    if (changeKey === lastAppliedChangeKey) return null;

    const state = getState();
    const { workbenchProjectId, mapProjectId } = bindingMeta(state);
    applyingToolDocument = true;
    try {
      // Write document lon/lat (+ draft.placements) into durable conceptMap storage.
      let next = applyMapDocumentToConceptMap(state.conceptMap, payload.document, {
        title: payload.title || state.conceptMap?.title,
        boundMapProjectId: payload.mapProjectId || mapProjectId,
        keepReference: false
      });
      next = ensureConceptMapBinding(next, workbenchProjectId, next.title);
      state.conceptMap = persistConceptMap(next, workbenchProjectId);
      lastAppliedChangeKey = mapDocumentChangeKey(state.conceptMap.document);
      const liveFrame = document.querySelector("#conceptMapFrame");
      if (liveFrame) deliveredKeyByFrame.set(liveFrame, mapDocumentKey(state.conceptMap.document));
      // Live soft-sync: mark dependents stale in state only — do not full-render.
      invalidateDependents();
      // silent:true skips projectModelSyncController render() / directory hydrate flash.
      // Positions are still saved to project repository (server) + localStorage.
      await syncConceptMap(state.conceptMap, { source, silent: softUi });
      const placementCount = extractForcePlacements(state.conceptMap.document).length;
      if (notifyUser) {
        notify(`${toastPrefix}（${payload.document.items.length} 对象 / ${placementCount} 兵力坐标已入库）`);
      }
      if (softUi) {
        softUpdateConceptMapChrome(state.conceptMap);
      } else {
        render();
      }
      // Full iframe reload is last-resort only (seed / manual recover). Live edits use peer patch.
      if (refreshIframe) {
        queueMicrotask(() => {
          const frame = document.querySelector("#conceptMapFrame");
          if (frame && getState().conceptMap?.document?.items?.length) {
            sendDocumentToEditor(frame, getState().conceptMap, { force: true });
          }
        });
      }
      return state.conceptMap;
    } catch (error) {
      if (notifyUser) notify(error?.message || "同步绘制工具内容失败");
      return null;
    } finally {
      applyingToolDocument = false;
      if (pendingLiveApply) {
        const queued = pendingLiveApply;
        pendingLiveApply = null;
        void applyToolDocument(queued.payload, queued.options);
      }
    }
  }

  async function seedFromPlanning({ silent = false, confirmReplace = false } = {}) {
    const state = getState();
    if (confirmReplace && state.conceptMap?.document?.items?.length
      && !window.confirm("按规划重建会覆盖当前绘制内容（阶段 + 概念兵力），已调整的坐标不会保留。是否继续？")) {
      return null;
    }
    if (state.conceptMapSeeding) {
      if (!silent) notify("概念图初图正在生成");
      return null;
    }
    if (state.forceMission?.status !== "confirmed" || state.phaseAction?.status !== "confirmed") {
      if (!silent) notify("请先确认阶段与行动、兵力与任务");
      return null;
    }

    state.conceptMapSeeding = true;
    render();
    try {
      const { workbenchProjectId } = bindingMeta(state);
      // No AI — compile stages + concept forces deterministically.
      const plan = buildConceptMapPlanFromPlanning(state, null);
      // Keep edited force lon/lat unless user explicitly chose rebuild-from-planning.
      const previousPlacements = confirmReplace
        ? []
        : extractForcePlacements(state.conceptMap?.document)
          .concat(Array.isArray(state.conceptMap?.draft?.placements) ? state.conceptMap.draft.placements : []);
      let next = createInitialConceptMapDraft({
        brief: state.brief,
        plan,
        previousPlacements
      });
      next = ensureConceptMapBinding(next, workbenchProjectId, projectTitle?.() || next.title);
      // Keep OV reference as draft for human confirm.
      if (next.reference) next.reference = { ...next.reference, status: "draft", confirmedAt: "" };
      state.conceptMap = persistConceptMap(next, workbenchProjectId);
      lastAppliedChangeKey = mapDocumentChangeKey(state.conceptMap.document);
      state.conceptMapReferenceEditorOpen = false;
      invalidateDependents();
      await syncConceptMap(state.conceptMap, { source: "concept-map:planning-seed" });
      if (!silent) {
        notify(confirmReplace && previousPlacements.length === 0
          ? `已按规划重建初图：${plan.phases?.length || 0} 个阶段、${plan.forces?.length || 0} 个概念兵力`
          : `已生成概念图初图：${plan.phases?.length || 0} 个阶段、${plan.forces?.length || 0} 个概念兵力`);
      }
      return state.conceptMap;
    } catch (error) {
      if (!silent) notify(error?.message || "生成概念图初图失败");
      return null;
    } finally {
      state.conceptMapSeeding = false;
      render();
      queueMicrotask(() => {
        const frame = document.querySelector("#conceptMapFrame");
        if (frame && getState().conceptMap?.document?.items?.length) {
          sendDocumentToEditor(frame, getState().conceptMap, { force: true });
        }
      });
    }
  }

  function requestExport(timeoutMs = 2500) {
    const frame = document.querySelector("#conceptMapFrame");
    if (!frame?.contentWindow) return Promise.resolve(null);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (exportWaiter) {
          exportWaiter = null;
          resolve(null);
        }
      }, timeoutMs);
      exportWaiter = (payload) => {
        clearTimeout(timer);
        resolve(payload);
      };
      frame.contentWindow.postMessage({
        channel: "combat-concept.deployment",
        version: 1,
        type: "export-map-document",
        payload: {}
      }, editorOrigin());
    });
  }

  async function pullFromTool() {
    const state = getState();
    if (state.conceptMapPulling || state.conceptMapSeeding) {
      notify("正在处理地图，请稍候");
      return null;
    }
    state.conceptMapPulling = true;
    render();
    try {
      const payload = await requestExport();
      if (!payload?.ok || !payload.document?.items?.length) {
        notify("未能读取绘制内容：请确认预览已加载，或先打开绘制工具并保存后再试");
        return null;
      }
      const changeKey = mapDocumentChangeKey(payload.document);
      if (changeKey === lastAppliedChangeKey) {
        notify("已是最新内容，无需再次拉取");
        return getState().conceptMap;
      }
      return await applyToolDocument(payload, {
        refreshIframe: false,
        softUi: true,
        notifyUser: true,
        source: "concept-map:tool-sync",
        toastPrefix: "已拉取绘制工具最新内容"
      });
    } finally {
      state.conceptMapPulling = false;
      // Persistent iframe mount survives re-render; restore toolbar enabled state.
      render();
    }
  }

  async function confirmStep() {
    const state = getState();
    // Prefer latest tool canvas if available.
    const exported = await requestExport();
    if (exported?.ok && exported.document?.items?.length) {
      await applyToolDocument(exported, { refreshIframe: false, softUi: true, notifyUser: false });
    }

    const map = getState().conceptMap;
    if (!map?.document?.items?.length) {
      notify("请先从规划生成初图，或在绘制工具中编辑后同步");
      return;
    }
    if (isCurrentConceptMap(map, getState().conceptMapStorage)) {
      notify("本步已确认，进入 OV-1");
      await onReferenceConfirmed?.(map);
      return;
    }

    // Auto-keep existing reference draft; only require non-empty entities/relations/activities.
    let reference = map.reference || {};
    if (!reference.entities?.length || !reference.relations?.length || !reference.activities?.length) {
      // Minimal confirmable reference from current draft plan / document summary.
      const plan = map.draft?.plan || {};
      const entities = (map.document.items || [])
        .filter((item) => item.type === "symbol")
        .slice(0, 18)
        .map((item, index) => ({
          id: item.assignment?.conceptForceId || item.id || `entity-${index + 1}`,
          role: "action",
          label: item.assignment?.conceptForceName || item.name || `实体${index + 1}`,
          note: item.assignment?.task || ""
        }));
      const activities = (map.document.operation?.phases || []).map((phase) => ({
        id: `activity-${phase.id}`,
        title: phase.name || phase.id,
        purpose: phase.timeLabel || ""
      }));
      const relations = entities.length > 1
        ? entities.slice(0, -1).map((entity, index) => ({
          id: `relation-${index + 1}`,
          from: entity.label,
          type: "协同",
          to: entities[index + 1].label,
          note: ""
        }))
        : [{ id: "relation-1", from: entities[0]?.label || "概念实体", type: "协同", to: entities[0]?.label || "概念实体", note: "待修订" }];
      reference = {
        ...reference,
        entities: entities.length ? entities : [{ id: "entity-1", role: "action", label: "概念实体", note: "" }],
        relations,
        activities: activities.length ? activities : [{ id: "activity-1", title: plan.phases?.[0]?.name || "阶段", purpose: "" }],
        constraints: reference.constraints || [],
        questions: reference.questions || []
      };
    }

    const next = updateConceptMapReference(
      { ...map, reference },
      {
        entities: (reference.entities || []).map((item) => [item.role, item.label, item.note].filter(Boolean).join(" | ")).join("\n"),
        relations: (reference.relations || []).map((item) => [item.from, item.type, item.to, item.note].filter(Boolean).join(" | ")).join("\n"),
        activities: (reference.activities || []).map((item) => [item.title, item.purpose].filter(Boolean).join(" | ")).join("\n"),
        constraints: (reference.constraints || []).join("\n"),
        questions: (reference.questions || []).join("\n")
      },
      { confirmed: true }
    );
    const { workbenchProjectId } = bindingMeta(getState());
    getState().conceptMap = persistConceptMap(normalizeConceptMap(next), workbenchProjectId);
    invalidateDependents();
    await syncConceptMap(getState().conceptMap, { source: "concept-map:step-confirmed" });
    notify("概念图已确认");
    render();
    await onReferenceConfirmed?.(getState().conceptMap);
  }
}
