import { boundMapProjectIdFor, conceptMapEditorUrl } from "./conceptMapBridgeStore.js";
import { escapeHtml } from "./app/domUtils.js";
import { renderPlanningMigrationBanner } from "./planningContext.js";
import { isCurrentConceptMap } from "./conceptMapStore.js";

/**
 * Concept-map step = live preview of combat-map-web (full tool UI) + open standalone editor.
 * No AI controls on this page.
 */
export function renderConceptMap(state) {
  const map = state.conceptMap || {};
  const workbenchProjectId = state.activeProjectId || "default";
  const mapProjectId = map.boundMapProjectId || boundMapProjectIdFor(workbenchProjectId);
  const title = map.title || state.projectDirectory?.projects?.find((item) => item.id === workbenchProjectId)?.title || "作战概念图";
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
  const forceCount = Number(map.draft?.plan?.forceCount || map.summary?.itemCount || 0);
  const seeding = Boolean(state.conceptMapSeeding);
  const upstreamReady = state.forceMission?.status === "confirmed"
    && state.phaseAction?.status === "confirmed"
    && !state.forceMissionStorage?.stale
    && !state.phaseActionStorage?.stale;

  return `
    <section class="concept-map-workspace is-preview">
      <header class="concept-map-toolbar" aria-label="作战概念图预览">
        <div class="concept-map-toolbar-meta">
          <strong>作战概念图预览</strong>
          <span class="muted">绑定绘制项目 <code>${escapeHtml(mapProjectId)}</code></span>
          <span class="muted">${hasDocument ? `${forceCount || map.summary?.itemCount || 0} 对象 · ${phaseCount} 阶段` : "尚未从规划生成初图"}</span>
          <span class="status-tag ${confirmed ? "" : "review"}">${confirmed ? "OV 参考已确认" : "待确认"}</span>
        </div>
        <div class="concept-map-toolbar-actions">
          <button type="button" class="quiet-button" data-action="seed-concept-map-from-planning" ${seeding || !upstreamReady ? "disabled" : ""}>${seeding ? "正在生成初图…" : hasDocument ? "按规划刷新初图" : "从规划生成初图"}</button>
          <button type="button" class="quiet-button" data-action="pull-concept-map-from-tool" ${seeding ? "disabled" : ""}>同步工具内容</button>
          <button type="button" class="concept-map-editor-entry" data-action="open-concept-map-external">在独立窗口编辑</button>
          <button type="button" data-action="confirm-concept-map-step" ${!hasDocument || confirmed || seeding ? "disabled" : ""}>确认并进入 OV-1</button>
        </div>
      </header>
      ${renderPlanningMigrationBanner(state)}
      ${upstreamReady ? "" : `<p class="planning-banner">请先确认「阶段与行动」和「兵力与任务」。确认后可从规划生成带阶段的概念图初图。</p>`}
      <p class="concept-map-preview-hint">预览仅可拖动地球查看；装备位置请点「在独立窗口编辑」。当前研究项目已 1:1 绑定绘制项目，无需再选项目。</p>
      <div
        class="concept-map-frame-shell"
        id="conceptMapFrameMount"
        data-frame-src="${escapeHtml(targetUrl)}"
        data-map-project-id="${escapeHtml(mapProjectId)}"
      ></div>
    </section>
  `;
}
