/**
 * DoDAF Products Event Bindings and Action Handlers (OV-1, OV-2, OV-3, OV-4, Structure Review).
 */
import { views, project } from "../../data.js";
import { buildStructureReviewExport } from "../../structureReviewExport.js";
import { saveOv1Model } from "../../ov1Store.js";
import { createLocalOv1Draft } from "../../ov1DraftStore.js";
import { saveModelSnapshot, snapshotContextFromState } from "../../modelSnapshotStore.js";
import { selectionFor } from "../../ui.js";

export function closeOv1ModalIfOpen($) {
  const dialog = $("#ov1Dialog");
  if (!dialog) return;
  if (dialog.open) dialog.close();
  if (dialog.innerHTML) dialog.innerHTML = "";
}

export function ensureOv1ToolsDocked(state) {
  state.ov1ToolsOpen = true;
}

export function openOv1SidePanel(state, mode, nodeId = null, edgeId = null) {
  ensureOv1ToolsDocked(state);
  state.ov1Dialog = null;
  state.ov1PanelOpen = true;
  state.ov1InspectorCollapsed = false;
  state.ov1PanelMode = mode;
  state.ov1PanelNodeId = mode === "node" ? nodeId : null;
  state.ov1PanelEdgeId = mode === "relations" ? edgeId : null;
}

export function closeOv1SidePanel(state) {
  state.ov1Dialog = null;
  state.ov1PanelOpen = false;
  state.ov1InspectorCollapsed = true;
  state.ov1PanelMode = "context";
  state.ov1PanelNodeId = null;
  state.ov1PanelEdgeId = null;
}

export function toggleOv1ToolsRail(state) {
  if (state.ov1ToolsOpen) {
    state.ov1ToolsOpen = false;
    closeOv1SidePanel(state);
    return;
  }
  ensureOv1ToolsDocked(state);
}

export function toggleOv1SidePanelMode(state, mode) {
  ensureOv1ToolsDocked(state);
  const current = state.ov1PanelMode || "context";
  if (state.ov1PanelOpen && current === mode) {
    closeOv1SidePanel(state);
    return;
  }
  openOv1SidePanel(
    state,
    mode,
    mode === "node" ? state.ov1PanelNodeId || state.selection?.id : null,
    mode === "relations" ? state.ov1PanelEdgeId : null
  );
}

export function bindDodafEvents(ctx) {
  const {
    state,
    render,
    select,
    addEventListenerOnce,
    $,
    jumpFromStructureReview
  } = ctx;

  document.querySelectorAll("[data-ov2-exchange]").forEach((button) => {
    addEventListenerOnce(button, "click", () => {
      const exchangeId = button.dataset.ov2Exchange;
      state.ov2SelectedExchangeId = exchangeId;
      state.ov2EditorOpen = true;
      select("ov2-exchange", exchangeId);
      render();
    }, "ov2-exchange:click");
  });

  document.querySelectorAll("[data-ov3-exchange]").forEach((button) => {
    addEventListenerOnce(button, "click", () => {
      const exchangeId = button.dataset.ov3Exchange;
      state.ov3SelectedExchangeId = exchangeId;
      select("ov3-exchange", exchangeId);
      render();
    }, "ov3-exchange:click");
  });

  document.querySelectorAll('input[data-action="ov3-search"]').forEach((input) => {
    addEventListenerOnce(input, "input", (e) => {
      state.ov3Search = e.target.value;
      render();
    }, "ov3-search:input");
  });

  const matrixWrap = document.querySelector(".ov3-matrix-wrap");
  if (matrixWrap && !matrixWrap.dataset.boundHover) {
    matrixWrap.dataset.boundHover = "true";
    matrixWrap.addEventListener("mouseover", (e) => {
      const td = e.target.closest("td.ov3-matrix-cell, td.ov3-matrix-empty");
      if (!td) return;
      const colIndex = td.cellIndex;
      const tr = td.parentElement;
      tr.classList.add("is-row-hovered");
      const rows = matrixWrap.querySelectorAll(".ov3-matrix tbody tr");
      rows.forEach((r) => {
        if (r.children[colIndex]) {
          r.children[colIndex].classList.add("is-col-hovered");
        }
      });
      const thCol = matrixWrap.querySelector(`.ov3-matrix thead th:nth-child(${colIndex + 1})`);
      if (thCol) thCol.classList.add("is-col-hovered");
    });
    matrixWrap.addEventListener("mouseout", (e) => {
      const td = e.target.closest("td.ov3-matrix-cell, td.ov3-matrix-empty");
      if (!td) return;
      matrixWrap.querySelectorAll(".is-row-hovered").forEach((el) => el.classList.remove("is-row-hovered"));
      matrixWrap.querySelectorAll(".is-col-hovered").forEach((el) => el.classList.remove("is-col-hovered"));
    });
  }

  if (matrixWrap && !matrixWrap.dataset.boundWheel) {
    matrixWrap.dataset.boundWheel = "true";
    matrixWrap.addEventListener("wheel", (e) => {
      if (e.deltaY && !e.deltaX && e.shiftKey) {
        matrixWrap.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });
  }

  document.querySelectorAll("[data-structure-jump]").forEach((button) => {
    addEventListenerOnce(button, "click", () => {
      jumpFromStructureReview(button.dataset.structureJump, button.dataset.targetKind, button.dataset.targetId);
    }, "structure-jump:click");
  });

  document.querySelectorAll("[data-structure-filter-severity]").forEach((button) => {
    addEventListenerOnce(button, "click", () => {
      state.structureReviewFilter = {
        ...(state.structureReviewFilter || { severity: "all", group: "all" }),
        severity: button.dataset.structureFilterSeverity || "all"
      };
      render();
    }, "structure-filter-severity:click");
  });

  document.querySelectorAll("[data-structure-filter-group]").forEach((button) => {
    addEventListenerOnce(button, "click", () => {
      state.structureReviewFilter = {
        ...(state.structureReviewFilter || { severity: "all", group: "all" }),
        group: button.dataset.structureFilterGroup || "all"
      };
      render();
    }, "structure-filter-group:click");
  });

  document.querySelectorAll("[data-ov4-role]").forEach((button) => {
    addEventListenerOnce(button, "click", () => select("ov4-role", button.dataset.ov4Role), "ov4-role:click");
  });

  document.querySelectorAll("[data-ov4-relation]").forEach((button) => {
    addEventListenerOnce(button, "click", () => select("ov4-relation", button.dataset.ov4Relation), "ov4-relation:click");
  });
}

import { suggestOv1SourcesForActivity } from "../../ov5Ov1Linker.js";

export function bindOv1SourcePicker(form, ctx = {}) {
  if (!form) return;
  const state = ctx.state || window.__workbench?.getState?.();
  const showToast = ctx.showToast || window.showToast || console.log;
  const addEventListenerOnce = ctx.addEventListenerOnce || ((el, evt, fn) => el.addEventListener(evt, fn));

  const refresh = () => refreshOv1SourcePicker(form);
  form.querySelectorAll('input[name="sourceOv1NodeIds"]').forEach((input) => {
    addEventListenerOnce(input, "change", refresh, "ov1-picker:change");
  });
  const clearBtn = form.querySelector("[data-ov1-source-clear]");
  if (clearBtn) {
    addEventListenerOnce(clearBtn, "click", () => {
      form.querySelectorAll('input[name="sourceOv1NodeIds"]').forEach((input) => {
        input.checked = false;
      });
      refresh();
      showToast("已清空来源选择，保存活动后生效");
    }, "ov1-picker:clear");
  }
  const suggestBtn = form.querySelector("[data-ov1-source-suggest]");
  if (suggestBtn) {
    addEventListenerOnce(suggestBtn, "click", () => {
      const activityId = suggestBtn.dataset.ov1SourceSuggest || state?.selection?.id;
      const activity = state?.ov5?.activities?.find((item) => item.id === activityId);
      if (!activity) return;
      const suggested = new Set(suggestOv1SourcesForActivity(activity, state?.ov1));
      if (!suggested.size) {
        showToast("未能根据活动类型给出总体图建议，请手工多选");
        return;
      }
      form.querySelectorAll('input[name="sourceOv1NodeIds"]').forEach((input) => {
        input.checked = suggested.has(input.value);
      });
      refresh();
      showToast(`已按类型勾选 ${suggested.size} 个建议来源，请确认后保存`);
    }, "ov1-picker:suggest");
  }
  refresh();
}

export function refreshOv1SourcePicker(form) {
  if (!form) return;
  const boxes = [...form.querySelectorAll('input[name="sourceOv1NodeIds"]')];
  const selected = boxes.filter((input) => input.checked).length;
  const count = form.querySelector("[data-ov1-source-count]");
  if (count) count.textContent = `${selected}/${boxes.length} 已选`;
  boxes.forEach((input) => {
    input.closest(".ov1-source-option")?.classList.toggle("selected", input.checked);
  });
}

export function jumpFromStructureReview(viewId, targetKind, targetId, ctx) {
  const { state, render, showToast, getViewMeta, getModels } = ctx;
  const allowed = new Set(views.map((view) => view.id));
  if (!allowed.has(viewId)) return;
  state.activeView = viewId;
  state.selection = null;
  // Phase-chain reverse checks default to sequence filter when jumping from review.
  if (["ov6a", "ov6b", "ov6c", "phase-action"].includes(viewId)) {
    state.structureReviewFilter = {
      ...(state.structureReviewFilter || { severity: "all", group: "all" }),
      group: "sequence"
    };
  }
  if (targetKind && targetId) {
    try {
      // Validation issues live under design-validation selection type "issue".
      const kind = targetKind === "issue" ? "issue" : targetKind;
      state.selection = selectionFor(kind, targetId, getModels());
    } catch {
      state.selection = null;
    }
  }
  const meta = getViewMeta(viewId);
  const chainHint = {
    ov6a: "请绑定规则到受约束活动，或修订规则库",
    ov6b: "请补状态出口或按任务/对象分机",
    ov6c: "请为消息回链阶段活动",
    "phase-action": "请修订阶段、行动或进入退出条件"
  }[viewId];
  showToast(
    state.selection
      ? `已打开 ${meta?.label || viewId}，并定位到相关对象`
      : chainHint
        ? `已打开 ${meta?.label || viewId}：${chainHint}`
        : `已打开 ${meta?.label || viewId}`
  );
  render();
}

export function exportStructureReviewChecklist(format = "markdown", ctx) {
  const { state, currentProjectTitle, downloadArtifact } = ctx;
  const exportBundle = buildStructureReviewExport({
    ...state,
    projectTitle: currentProjectTitle()
  });
  const artifact = format === "json" ? exportBundle.json : exportBundle.markdown;
  downloadArtifact(artifact);
}

export async function attachStructureReviewToCollaboration(ctx) {
  const { state, render, showToast, currentProjectTitle, downloadArtifact, collaborationController } = ctx;
  const exportBundle = buildStructureReviewExport({
    ...state,
    projectTitle: currentProjectTitle()
  });
  const draft = exportBundle.collaborationDraft;
  downloadArtifact(exportBundle.markdown);

  state.collaboration = {
    ...(state.collaboration || {}),
    reviewDraft: draft
  };

  const session = state.collaboration?.session;
  const canSubmit = state.collaboration?.status === "ready" && session?.authenticated;
  if (!canSubmit) {
    state.activeView = "collaboration";
    showToast("已导出完整清单，并写入协同审阅草稿；请登录后确认提交");
    render();
    return;
  }

  try {
    const resource = draft.resource || "ov5";
    const storageKey = {
      brief: "projectStorage",
      ov1: "ov1Storage",
      ov5: "ov5Storage",
      ooda: "oodaStorage",
      scenario: "scenarioStorage",
      validation: "validationStorage",
      knowledge: "knowledgeStorage",
      report: "reportStorage"
    }[resource];
    const resourceRevision = Number(
      state[storageKey]?.resourceRevision
      || (resource === "brief" ? state.projectStorage?.revision : 0)
      || 0
    );
    const { createProjectCollaborationReview } = await import("../../projectBriefClient.js");
    const result = await createProjectCollaborationReview(state.activeProjectId || "default", {
      resource,
      resourceRevision,
      disposition: draft.disposition,
      summary: draft.summary,
      evidenceRefs: [],
      expectedRevision: state.collaboration.revision,
      clientId: draft.clientId
    });
    state.collaboration = {
      ...(state.collaboration || {}),
      status: "ready",
      detail: "",
      revision: Number(result.revision || 0),
      resourceRevision: Number(result.resourceRevision || 0),
      reviews: result.reviews || [],
      openCount: Number(result.openCount || 0),
      policy: result.policy || state.collaboration.policy,
      reviewDraft: null,
      session: state.collaboration.session,
      accounts: state.collaboration.accounts,
      securityEvents: state.collaboration.securityEvents,
      auditEntries: state.collaboration.auditEntries
    };
    state.projectRevision = result.revision;
    state.activeView = "collaboration";
    showToast(`已挂接协同审阅（${draft.issueCount} 项摘要），完整清单已下载`);
    if (collaborationController) void collaborationController.hydrate();
    render();
  } catch (error) {
    state.activeView = "collaboration";
    const conflict = error?.status === 409;
    showToast(conflict
      ? "项目已更新：完整清单已下载，请在协同页刷新后确认草稿再提交"
      : "自动提交失败：完整清单已下载，草稿已填入协同表单，请手工确认提交");
    render();
  }
}

export async function applyOv1CandidateWithRecoveryPoint(ctx) {
  const {
    state,
    render,
    showToast,
    projectModelSnapshotSyncController,
    projectOv1SyncController,
    invalidateDerivedArtifacts
  } = ctx;
  if (!state.ov1Candidate) return;
  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    if (!window.confirm("应用候选将替换当前高层作战概念图。系统会先保存一个可恢复的模型快照，是否继续？")) return;
  }

  state.modelSnapshots = saveModelSnapshot(snapshotContextFromState(state, project), state.modelSnapshots);
  const recoveryPoint = state.modelSnapshots[0];
  render();
  const saved = await projectModelSnapshotSyncController.save(recoveryPoint, { source: "ov1-ai-candidate-preapply" });
  if (!saved) {
    showToast("恢复点未能同步到服务端，当前候选未应用。");
    return;
  }
  state.ov1 = saveOv1Model(state.ov1Candidate);
  state.ov1Candidate = null;
  try {
    const { resetOv1Camera } = await import("../../ov1ConceptMapController.js");
    resetOv1Camera();
  } catch {
    /* camera reset is best-effort */
  }
  invalidateDerivedArtifacts();
  await projectOv1SyncController.sync(state.ov1, { source: "ai-candidate-approved" });
  showToast("已应用高层作战概念图候选；恢复点已保存。可用「基于当前概念生成活动模型候选」继续。");
  render();
}

export async function handleDodafAction(action, source, ctx) {
  const {
    state,
    render,
    showToast,
    navigateToResearchView,
    completeWorkflowStage,
    dodafProductController,
    projectOv1SyncController,
    invalidateValidation,
    applyOv1CandidateWithRecoveryPoint: applyCandidate,
    exportStructureReviewChecklist: exportReview,
    attachStructureReviewToCollaboration: attachReview
  } = ctx;

  if (action === "switch-ov1-view-mode") {
    state.ov1ViewMode = source?.dataset?.viewMode || "graph";
    render();
    return true;
  }

  if (action === "open-ov1-concept") {
    toggleOv1SidePanelMode(state, "concept");
    render();
    return true;
  }
  if (action === "open-ov1-relations") {
    toggleOv1SidePanelMode(state, "relations");
    render();
    return true;
  }
  if (action === "toggle-ov1-tools") {
    toggleOv1ToolsRail(state);
    render();
    return true;
  }
  if (action === "toggle-ov1-panel" || action === "toggle-ov1-sidebar") {
    toggleOv1SidePanelMode(state, "context");
    render();
    return true;
  }
  if (action === "close-ov1-panel" || action === "close-ov1-dialog") {
    closeOv1SidePanel(state);
    render();
    return true;
  }

  if (action === "save-and-advance-ov4") {
    void (async () => {
      await dodafProductController.saveProduct("ov4");
      if (state.ov4SelectedRoleId) {
        state.ov2SelectedNodeId = state.ov4SelectedRoleId;
      }
      await navigateToResearchView("ov2", { toast: "已保存组织关系 (OV-4)，进入作战资源流 (OV-2)", entrySource: "ov4" });
    })();
    return true;
  }

  if (action === "save-and-advance-ov2") {
    void (async () => {
      await dodafProductController.saveProduct("ov2");
      await navigateToResearchView("ov3", { toast: "已保存作战资源流 (OV-2)，进入资源流矩阵 (OV-3)", entrySource: "ov2" });
    })();
    return true;
  }

  if (action === "ov2-toggle-help") {
    state.ov2HelpOpen = state.ov2HelpOpen !== true;
    render();
    return true;
  }
  if (action === "ov2-toggle-sidebar") {
    state.ov2SidebarCollapsed = !state.ov2SidebarCollapsed;
    render();
    return true;
  }
  if (action === "ov2-set-view-mode") {
    state.ov2ViewMode = source?.dataset?.mode || "canvas";
    render();
    return true;
  }
  if (action === "ov2-filter-flow") {
    state.ov2FlowFilter = source?.dataset?.flow || "all";
    render();
    return true;
  }
  if (action === "ov2-select-node") {
    const nodeId = source?.dataset?.nodeId || "";
    state.ov2SelectedNodeId = state.ov2SelectedNodeId === nodeId ? "" : nodeId;
    render();
    return true;
  }
  if (action === "clear-ov2-node-filter") {
    state.ov2SelectedNodeId = "";
    render();
    return true;
  }
  if (action === "ov2-close-editor") {
    state.ov2SelectedExchangeId = "";
    state.ov2EditorOpen = false;
    render();
    return true;
  }
  if (action === "ov2-reverse-exchange") {
    const exchangeId = source?.dataset?.exchangeId || state.ov2SelectedExchangeId;
    if (exchangeId && state.ov2?.exchanges) {
      const ex = state.ov2.exchanges.find((item) => item.id === exchangeId);
      if (ex) {
        const tempId = ex.sourceNodeId;
        const tempLabel = ex.sourceNodeLabel;
        const tempForce = ex.sourceForceRef;
        const tempActId = ex.sourceActivityId;
        const tempActTitle = ex.sourceActivityTitle;
        const tempOut = ex.output;

        ex.sourceNodeId = ex.targetNodeId;
        ex.sourceNodeLabel = ex.targetNodeLabel;
        ex.sourceForceRef = ex.targetForceRef;
        ex.sourceActivityId = ex.targetActivityId;
        ex.sourceActivityTitle = ex.targetActivityTitle;
        ex.output = ex.input;

        ex.targetNodeId = tempId;
        ex.targetNodeLabel = tempLabel;
        ex.targetForceRef = tempForce;
        ex.targetActivityId = tempActId;
        ex.targetActivityTitle = tempActTitle;
        ex.input = tempOut;

        void dodafProductController.saveProduct("ov2");
        showToast(`已反转流向：${ex.sourceNodeLabel} ➔ ${ex.targetNodeLabel}`);
        render();
      }
    }
    return true;
  }
  if (action === "ov2-delete-exchange") {
    const exchangeId = source?.dataset?.exchangeId || state.ov2SelectedExchangeId;
    if (exchangeId && state.ov2?.exchanges) {
      state.ov2.exchanges = state.ov2.exchanges.filter((item) => item.id !== exchangeId);
      if (state.ov2SelectedExchangeId === exchangeId) {
        state.ov2SelectedExchangeId = "";
        state.ov2EditorOpen = false;
      }
      void dodafProductController.saveProduct("ov2");
      showToast("已删除该条作战资源流");
      render();
    }
    return true;
  }
  if (action === "ov2-add-exchange") {
    const nodes = state.ov2?.nodes || [];
    const src = nodes[0] || { id: "node-1", label: "执行节点1" };
    const tgt = nodes[1] || nodes[0] || { id: "node-2", label: "执行节点2" };
    const newEx = {
      id: `ov2-${Date.now().toString(36)}`,
      sourceNodeId: src.id,
      targetNodeId: tgt.id,
      sourceNodeLabel: src.label || src.id,
      targetNodeLabel: tgt.label || tgt.id,
      label: "新资源交换",
      flowType: "信息流",
      output: `${src.label || src.id}输出数据`,
      input: `${tgt.label || tgt.id}接收数据`,
      sourceActivityTitle: "",
      targetActivityTitle: "",
      taskRefs: []
    };
    state.ov2 = {
      ...(state.ov2 || {}),
      exchanges: [newEx, ...(state.ov2?.exchanges || [])]
    };
    state.ov2SelectedExchangeId = newEx.id;
    state.ov2EditorOpen = true;
    void dodafProductController.saveProduct("ov2");
    showToast("已新建资源流，请在右侧完善载荷与契约");
    render();
    return true;
  }

  if (action === "ov3-close-drawer") {
    state.ov3SelectedExchangeId = "";
    if (state.selection?.kind === "ov3-exchange") {
      state.selection = null;
    }
    render();
    return true;
  }
  if (action === "ov3-toggle-help") {
    state.ov3HelpOpen = state.ov3HelpOpen !== true;
    render();
    return true;
  }
  if (action === "ov3-set-view-mode") {
    state.ov3ViewMode = source?.dataset?.mode || "matrix";
    render();
    return true;
  }
  if (action === "ov3-set-scope") {
    state.ov3NodeScope = source?.dataset?.scope || "active";
    render();
    return true;
  }
  if (action === "ov3-filter-group") {
    state.ov3GroupFilter = source?.dataset?.group || "all";
    render();
    return true;
  }
  if (action === "ov3-filter-flow") {
    state.ov3FlowFilter = source?.dataset?.flow || "all";
    render();
    return true;
  }
  if (action === "ov3-filter-compat") {
    state.ov3CompatFilter = source?.dataset?.compat || "all";
    render();
    return true;
  }
  if (action === "ov3-clear-filter") {
    state.ov3FlowFilter = "all";
    state.ov3CompatFilter = "all";
    state.ov3GroupFilter = "all";
    state.ov3Search = "";
    render();
    return true;
  }
  if (action === "ov3-scroll-matrix") {
    const wrap = document.querySelector(".ov3-matrix-wrap");
    if (!wrap) return true;
    const dir = source?.dataset?.dir;
    if (dir === "left") {
      wrap.scrollBy({ left: -360, behavior: "smooth" });
    } else if (dir === "right") {
      wrap.scrollBy({ left: 360, behavior: "smooth" });
    } else if (dir === "first-flow") {
      const targetCell = wrap.querySelector(".ov3-matrix-cell:not(.ov3-matrix-empty)");
      if (targetCell) {
        targetCell.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        targetCell.querySelector("button")?.focus();
      }
    }
    return true;
  }
  if (action === "ov3-jump-to-ov2") {
    const exchangeId = source?.dataset?.exchangeId || state.ov3SelectedExchangeId;
    state.ov2SelectedExchangeId = exchangeId;
    state.ov2EditorOpen = true;
    void navigateToResearchView("ov2", { toast: "已定位至 OV-2 对应资源流", entrySource: "ov3" });
    return true;
  }
  if (action === "go-ov2") {
    void navigateToResearchView("ov2", { toast: "前往作战资源流描述 (OV-2)", entrySource: "ov3" });
    return true;
  }
  if (action === "save-and-advance-ov3") {
    void (async () => {
      await dodafProductController.saveProduct("ov3");
      await navigateToResearchView("force-mission", { toast: "已保存资源流矩阵 (OV-3)，返回作战兵力", entrySource: "ov3" });
    })();
    return true;
  }

  if (action === "seed-ov1-from-planning") {
    const seeded = createLocalOv1Draft({
      brief: state.brief,
      direction: state.direction,
      forceMission: state.forceMission
    });
    state.ov1 = seeded;
    state.ov1Candidate = null;
    state.selection = null;
    invalidateValidation();
    try {
      await projectOv1SyncController.sync(state.ov1, { source: "ov1:seed-from-planning" });
    } catch {
      /* local */
    }
    showToast("已基于兵力规划生成总体图初图");
    render();
    return true;
  }
  if (action === "confirm-ov1" || action === "workflow-gate-quick-confirm-ov1") {
    if (!state.ov1?.nodes?.length) {
      showToast("总体图尚无节点，请先生成或编辑");
      return true;
    }
    state.ov1.confirmed = true;
    state.ov1.confirmedAt = new Date().toISOString();
    if (state.ov1Storage) {
      state.ov1Storage.stale = false;
    }
    try {
      await projectOv1SyncController.sync(state.ov1, { source: "ov1:confirm" });
    } catch {
      /* local */
    }
    await completeWorkflowStage();
    showToast("总体图已确认");
    render();
    return true;
  }
  if (action === "advance-to-concept-map") {
    state.activeView = "concept-map";
    state.selection = null;
    render();
    return true;
  }
  if (action === "confirm-and-advance-to-concept-map") {
    if (state.ov1?.nodes?.length && !state.ov1?.confirmed) {
      state.ov1.confirmed = true;
      state.ov1.confirmedAt = new Date().toISOString();
      if (state.ov1Storage) {
        state.ov1Storage.stale = false;
      }
      try {
        await projectOv1SyncController.sync(state.ov1, { source: "ov1:confirm" });
      } catch {
        /* local */
      }
      await completeWorkflowStage();
      showToast("总体图已确认，正在进入概念图");
    }
    state.activeView = "concept-map";
    state.selection = null;
    render();
    return true;
  }
  if (action === "apply-ov1-candidate") {
    void applyCandidate(ctx);
    return true;
  }
  if (action === "discard-ov1-candidate") {
    state.ov1Candidate = null;
    showToast("已舍弃高层作战概念图候选，当前人工模型保持不变");
    render();
    return true;
  }

  if (action === "open-structure-review") {
    state.activeView = "structure-review";
    state.selection = null;
    render();
    return true;
  }
  if (action === "export-structure-review-markdown") {
    exportReview("markdown", ctx);
    return true;
  }
  if (action === "export-structure-review-json") {
    exportReview("json", ctx);
    return true;
  }
  if (action === "attach-structure-review-collaboration") {
    void attachReview(ctx);
    return true;
  }
  if (action === "clear-collaboration-review-draft") {
    if (state.collaboration) state.collaboration = { ...state.collaboration, reviewDraft: null };
    showToast("已丢弃结构审阅清单草稿");
    render();
    return true;
  }

  return false;
}
