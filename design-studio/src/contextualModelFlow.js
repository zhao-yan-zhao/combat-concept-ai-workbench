import { buildModelTopology, getRelatedModelStatuses } from "../../shared/modelTopology.js";
import { escapeHtml } from "./app/domUtils.js";
import { workflowPrimaryStepIds } from "./data.js";

export const RELATED_VIEWS = Object.freeze({
  "phase-action": ["ov6a", "ov6b", "ov6c"],
  "operational-task": ["ov1b", "ov6a", "ov6b", "ov6c"],
  "force-mission": ["ov4", "ov2", "ov3", "ov6a", "ov6b", "ov6c"],
  ov1: ["ov5a", "ov5", "ooda"],
  "concept-map": ["ov5a", "ov5", "ooda"],
  scenario: ["ov1c", "ov7", "structure-review"]
});

const MAIN_LABELS = Object.freeze({
  "phase-action": "阶段行动",
  "operational-task": "作战任务",
  "force-mission": "作战兵力",
  ov1: "总体图（OV1a）",
  "concept-map": "概念图",
  scenario: "仿真演示"
});

const RELATED_LABELS = Object.freeze({
  ov6a: "规则库 OV6a",
  ov6b: "状态机 OV6b",
  ov6c: "时序图",
  ov1b: "任务整理 OV1b",
  ov4: "组织关系 OV4",
  ov2: "资源流 OV2",
  ov3: "资源流矩阵 OV3",
  ov5a: "作战活动分解 OV5a",
  ov5: "作战活动 OV5b",
  ooda: "研究循环 OODA",
  ov1c: "任务与活动映射 OV1c",
  ov7: "状态与活动映射 OV7",
  "structure-review": "跨模型校核"
});

export function relatedViewLabel(viewId) {
  return RELATED_LABELS[viewId] || viewId;
}

export function contextualFlowViewIds(mainViewId, state = {}) {
  const targetViewIds = RELATED_VIEWS[mainViewId] || [];
  if (!targetViewIds.length) return [];
  const context = resolveModelFocus(mainViewId, state);
  try {
    const statuses = getRelatedModelStatuses(buildModelTopology(state), context, targetViewIds);
    return targetViewIds.filter((viewId) => statuses[viewId]?.status !== "not_applicable" && AVAILABLE_VIEWS.has(viewId));
  } catch {
    return [];
  }
}

export function getParentMainViewId(viewId) {
  if (!viewId) return "";
  if (workflowPrimaryStepIds.includes(viewId)) return viewId;
  for (const [mainId, list] of Object.entries(RELATED_VIEWS)) {
    if (list.includes(viewId)) return mainId;
  }
  return "";
}

export function inferRelatedMainViewId(relatedViewId, preferredMainViewId = "") {
  const resolvedPreferred = getParentMainViewId(preferredMainViewId) || preferredMainViewId;
  if (resolvedPreferred && RELATED_VIEWS[resolvedPreferred]?.includes(relatedViewId)) return resolvedPreferred;
  return workflowPrimaryStepIds.find((mainViewId) => RELATED_VIEWS[mainViewId]?.includes(relatedViewId)) || "";
}

export function resolveRelatedMainViewId(activeViewId, relatedViewId, currentContext = null) {
  const preferredMainViewId = currentContext?.mainViewId || activeViewId;
  return inferRelatedMainViewId(relatedViewId, preferredMainViewId)
    || (workflowPrimaryStepIds.includes(activeViewId) ? activeViewId : "");
}

const AVAILABLE_VIEWS = new Set(["ov1b", "ov1c", "ov6a", "ov6b", "ov6c", "ov7", "ov4", "ov2", "ov3", "ov5a", "ov5", "ooda", "structure-review"]);

const STATUS_LABELS = Object.freeze({
  empty: "未生成",
  partial: "覆盖不足",
  pending_review: "待确认",
  confirmed: "已确认",
  stale: "已过期",
  conflict: "有冲突"
});

const RELATED_RETURN_TOOLBAR_SELECTORS = [
  ".seq-toolbar",
  ".sm-toolbar",
  ".rule-library-toolbar",
  ".ov4-toolbar",
  ".mapping-toolbar",
  ".dodaf-product-actions",
  ".project-storage-actions",
  ".activity-toolbar"
];

export function relatedFlowNumber(viewId, index = 0) {
  const mainlineIndex = workflowPrimaryStepIds.indexOf(viewId);
  if (mainlineIndex < 0) return "";
  return `${String(mainlineIndex + 1).padStart(2, "0")}${index + 1}`;
}

export function renderRailContextualModelFlow(viewId, state = {}) {
  const targetViewIds = RELATED_VIEWS[viewId] || [];
  if (!targetViewIds.length) return "";
  const context = resolveModelFocus(viewId, state);
  let statuses = [];
  try {
    statuses = Object.entries(getRelatedModelStatuses(buildModelTopology(state), context, targetViewIds))
      .map(([targetViewId, status]) => ({ targetViewId, ...status }))
      .filter((item) => item.status !== "not_applicable");
  } catch {
    return "";
  }
  if (!statuses.length) return "";

  const focusCopy = context.focusLabel ? `当前对象：${context.focusLabel}` : "当前步骤全部对象";
  return statuses.map((item, index) => renderRelatedNode(item, context, {
    mainViewId: viewId,
    sourceLabel: MAIN_LABELS[viewId] || viewId,
    focusCopy,
    index,
    activeViewId: state.activeView || state.relatedModelReturnContext?.relatedViewId || ""
  })).join("");
}

// Compatibility export for focused rendering/tests; the flow now belongs to the left rail.
export const renderContextualModelFlow = renderRailContextualModelFlow;

export function renderRelatedModelReturn(state = {}) {
  const context = state.relatedModelReturnContext;
  if (!context?.mainViewId || context.relatedViewId !== state.activeView) return "";
  const focusCopy = context.focusLabel ? ` · ${context.focusLabel}` : "";
  return `<div class="related-model-return" data-related-model-return>
    <button type="button" class="quiet-button related-model-return-button" data-return-mainline title="返回${escapeHtml(context.mainLabel || "主步骤")}">← 返回${escapeHtml(context.mainLabel || "主步骤")}</button>
    <span>当前按${escapeHtml(context.mainLabel || "主步骤")}${escapeHtml(focusCopy)}过滤</span>
  </div>`;
}

export function mountRelatedModelReturn(root, html) {
  if (!root || !html) return;
  const page = root.firstElementChild;
  if (!page) return;
  const fragment = document.createRange().createContextualFragment(html);
  const returnBar = fragment.querySelector("[data-related-model-return]");
  const toolbar = RELATED_RETURN_TOOLBAR_SELECTORS
    .map((selector) => page.querySelector(selector))
    .find(Boolean);
  if (returnBar && toolbar) {
    returnBar.classList.add("is-toolbar");
    toolbar.prepend(returnBar);
    return;
  }
  const header = page.querySelector(":scope > header");
  if (header) header.after(fragment);
  else page.prepend(fragment);
}

export function resolveModelFocus(viewId, state = {}) {
  if (viewId === "phase-action") {
    const focusId = String(state.phaseActionFocusId || "");
    const item = (state.phaseAction?.phases || []).find((phase) => phase.id === focusId);
    return item ? { focusType: "phase", focusId, focusLabel: item.name || focusId } : {};
  }
  if (viewId === "operational-task") {
    const focusId = String(state.operationalTaskSelectedId || "");
    const item = (state.forceMission?.tasks || []).find((task) => task.id === focusId);
    return item ? { focusType: "task", focusId, focusLabel: item.name || focusId } : {};
  }
  if (viewId === "force-mission") {
    const focusId = String(state.forcePlatformPicker?.forceId || "");
    const forces = [...(state.forceMission?.forces || []), ...(state.forceMission?.combatForces || [])];
    const item = forces.find((force) => force.id === focusId);
    return item ? { focusType: "force", focusId, focusLabel: item.name || focusId } : {};
  }
  return {};
}

function renderRelatedNode(item, context, { mainViewId = "", sourceLabel = "", focusCopy = "", index = 0, activeViewId = "" } = {}) {
  const available = AVAILABLE_VIEWS.has(item.targetViewId);
  const statusLabel = STATUS_LABELS[item.status] || item.status;
  const coverage = item.totalCount > 0 && item.coverageCount < item.totalCount
    ? `${item.coverageCount}/${item.totalCount}`
    : "";
  const diagnosticCount = item.diagnostics?.length || 0;
  const detail = [statusLabel, coverage && `覆盖 ${coverage}`, diagnosticCount && `${diagnosticCount} 项问题`, !available && "待建设"].filter(Boolean).join(" · ");
  const label = RELATED_LABELS[item.targetViewId] || item.targetViewId;
  const sequenceNumber = relatedFlowNumber(mainViewId, index);
  const current = item.targetViewId === activeViewId;
  const title = `${sequenceNumber ? `${sequenceNumber} · ` : ""}${sourceLabel}关联流程 · ${focusCopy} · ${label}：${detail}`;
  return `<li class="step-node step-related-node status-${escapeHtml(item.status)}${current ? " is-current" : ""}" data-contextual-model-flow data-related-number="${escapeHtml(sequenceNumber)}" style="--related-i:${index}">
    <button type="button" class="step-related-button" data-related-model="true" data-view="${escapeHtml(item.targetViewId)}" data-focus-type="${escapeHtml(context.focusType || "")}" data-focus-id="${escapeHtml(context.focusId || "")}" ${available ? "" : "disabled"} title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" aria-current="${current ? "step" : "false"}">
      <span class="step-related-dot contextual-model-status" aria-hidden="true">${escapeHtml(sequenceNumber)}</span>
      <span class="step-related-copy">
        <strong class="step-related-label">${escapeHtml(label)}</strong>
        <span class="step-related-separator" aria-hidden="true">·</span>
        <small class="step-related-detail">${escapeHtml(detail)}</small>
      </span>
    </button>
  </li>`;
}
