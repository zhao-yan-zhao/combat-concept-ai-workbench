import { boundMapProjectIdFor, conceptMapEditorUrl } from "./conceptMapBridgeStore.js";
import { escapeHtml } from "./app/domUtils.js";
import { renderPlanningMigrationBanner } from "./planningContext.js";
import { isCurrentConceptMap } from "./conceptMapStore.js";

/**
 * Concept-map step = live preview of combat-map-web (preview chrome) + open standalone editor.
 * No AI controls on this page.
 */
export function renderConceptMap(state) {
  const map = state.conceptMap || {};
  const workbenchProjectId = state.activeProjectId || "default";
  const mapProjectId = map.boundMapProjectId || boundMapProjectIdFor(workbenchProjectId);
  // Iframe preview: stable URL (mapProjectId + preview flag only) so workbench
  // re-renders (open project picker, toasts) do not reload the tool.
  const targetUrl = conceptMapEditorUrl(state.conceptMapBridge.settings.targetUrl, {
    mapProjectId,
    workbenchPreview: true,
    includeTitle: false
  });
  const confirmed = isCurrentConceptMap(map, state.conceptMapStorage);
  const hasDocument = Boolean(map.document?.items?.length);
  const phaseCount = Array.isArray(map.document?.operation?.phases) ? map.document.operation.phases.length : 0;
  const forceCount = Number(map.draft?.plan?.forceCount || map.summary?.itemCount || map.document?.items?.length || 0);
  const seeding = Boolean(state.conceptMapSeeding);
  const pulling = Boolean(state.conceptMapPulling);
  const busy = seeding || pulling;
  const upstreamReady = state.forceMission?.status === "confirmed"
    && state.phaseAction?.status === "confirmed"
    && !state.forceMissionStorage?.stale
    && !state.phaseActionStorage?.stale;

  const seedLabel = seeding
    ? "正在生成…"
    : hasDocument
      ? "按规划重建"
      : "从规划生成";
  const seedTitle = !upstreamReady
    ? "请先确认「阶段与行动」和「兵力与任务」"
    : hasDocument
      ? "按已确认规划重建初图（阶段 + 概念兵力）。会覆盖当前绘制内容，已调整的坐标不会保留。"
      : "根据已确认规划生成带阶段的概念图初图，并写入绑定的绘制项目。";

  const pullTitle = !hasDocument
    ? "尚无地图内容。请先从规划生成，或在绘制工具中编辑后再拉取。"
    : "从预览/绘制工具主动拉取最新内容（自动同步失败时可手动恢复）。";

  const editTitle = "在独立窗口打开完整绘制工具，调整装备位置与军标；保存后会自动同步回本预览。";

  const confirmDisabled = !hasDocument || seeding || pulling;
  const confirmLabel = confirmed ? "进入 OV-1" : "确认并进入 OV-1";
  const confirmTitle = !hasDocument
    ? "请先生成或同步地图内容后再确认"
    : confirmed
      ? "本步已确认，点击进入 OV-1 继续研究"
      : "确认当前概念图作为 OV 参考，并进入 OV-1";

  return `
    <section class="concept-map-workspace is-preview">
      <header class="concept-map-toolbar" aria-label="作战概念图预览">
        <div class="concept-map-toolbar-meta">
          <strong>作战概念图预览</strong>
          <span class="muted">绑定 <code>${escapeHtml(mapProjectId)}</code></span>
          <span class="muted" data-concept-map-stat="objects">${hasDocument ? `${forceCount} 对象 · ${phaseCount} 阶段` : "尚未生成初图"}</span>
          <span class="status-tag ${confirmed ? "is-ready" : "review"}" data-concept-map-status>${confirmed ? "已确认" : "待确认"}</span>
        </div>
        <div class="concept-map-toolbar-actions">
          <div class="concept-map-toolbar-group" role="group" aria-label="地图维护">
            <button
              type="button"
              class="concept-map-tool-btn"
              data-action="seed-concept-map-from-planning"
              title="${escapeHtml(seedTitle)}"
              ${seeding || !upstreamReady ? "disabled" : ""}
            >
              <span class="concept-map-tool-icon" aria-hidden="true">${hasDocument ? "↻" : "＋"}</span>
              <span data-concept-map-seed-label>${seedLabel}</span>
            </button>
            <button
              type="button"
              class="concept-map-tool-btn"
              data-action="pull-concept-map-from-tool"
              title="${escapeHtml(pullTitle)}"
              ${busy ? "disabled" : ""}
            >
              <span class="concept-map-tool-icon" aria-hidden="true">↓</span>
              <span data-concept-map-pull-label>${pulling ? "拉取中…" : "拉取最新"}</span>
            </button>
          </div>
          <div class="concept-map-toolbar-divider" aria-hidden="true"></div>
          <div class="concept-map-toolbar-group" role="group" aria-label="编辑与确认">
            <button
              type="button"
              class="concept-map-tool-btn is-emphasis"
              data-action="open-concept-map-external"
              title="${escapeHtml(editTitle)}"
              ${seeding ? "disabled" : ""}
            >
              <span class="concept-map-tool-icon" aria-hidden="true">↗</span>
              <span>打开绘制工具</span>
            </button>
            <button
              type="button"
              class="concept-map-tool-btn is-primary"
              data-action="confirm-concept-map-step"
              title="${escapeHtml(confirmTitle)}"
              data-concept-map-confirmed="${confirmed ? "true" : "false"}"
              ${confirmDisabled ? "disabled" : ""}
            >
              <span data-concept-map-confirm-label>${confirmLabel}</span>
            </button>
          </div>
        </div>
      </header>
      ${renderPlanningMigrationBanner(state)}
      ${upstreamReady ? "" : `<p class="planning-banner">请先确认「阶段与行动」和「兵力与任务」。确认后可从规划生成带阶段的概念图初图。</p>`}
      <p class="concept-map-preview-hint">
        预览只读（可拖地球查看）。编辑位置与军标请点<strong>打开绘制工具</strong>；独立窗口保存后会自动同步。
        ${hasDocument ? "自动同步异常时可用<strong>拉取最新</strong>。" : "尚无内容时先<strong>从规划生成</strong>。"}
      </p>
      <div
        class="concept-map-frame-shell"
        id="conceptMapFrameMount"
        data-frame-src="${escapeHtml(targetUrl)}"
        data-map-project-id="${escapeHtml(mapProjectId)}"
      ></div>
    </section>
  `;
}
