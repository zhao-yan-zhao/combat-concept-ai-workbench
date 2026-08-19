import { escapeHtml } from "./app/domUtils.js";
import { renderToolboxFloatButton, renderToolboxRail } from "./toolbox/index.js";

/**
 * Shared toolbox contract for every auxiliary workflow page.
 * The AI entry is intentionally first and cannot be omitted from a subflow.
 */
const SUBFLOW_TOOLS = Object.freeze({
  "operational-task": { label: "作战任务工具箱", ai: ["generate-operational-tasks", "AI 生成任务"], items: [["confirm-operational-tasks", "确认任务", "check"], ["open-context-panel", "查看上游依据", "doc"]] },
  "phase-action": { label: "阶段行动工具箱", ai: ["generate-phase-action", "AI 生成阶段"], items: [["open-phase-action-chat", "AI 对话复核", "chat"], ["toggle-phase-action-chat", "阶段行动对话", "chat"], ["confirm-phase-action", "确认阶段行动", "check"]] },
  ov1b: { label: "任务分解工具箱", ai: ["open-subflow-ai", "AI 分析分解"], items: [["ov1b-add-decomposition", "新增分解关系", "plus"], ["seed-dodaf-ov1b", "刷新来源", "refresh"]] },
  ov1c: { label: "任务活动映射工具箱", ai: ["open-subflow-ai", "AI 检查映射"], items: [["seed-dodaf-ov1c", "刷新来源", "refresh"], ["save-dodaf-ov1c", "保存映射", "check"]] },
  "force-mission": { label: "作战兵力工具箱", ai: ["generate-force-mission", "AI 生成兵力"], items: [["open-force-mission-chat", "AI 对话复核", "chat"], ["recommend-platforms-from-phases", "推荐平台", "concept"]] },
  ov1: { label: "总体图工具箱", ai: ["generate-ov1", "AI 生成总体图"], items: [["toggle-ov1-tools", "图面编辑工具", "layout"], ["generate-ov5-from-ov1", "生成活动模型", "relations"]] },
  "concept-map": { label: "概念图工具箱", ai: ["generate-concept-graphic", "AI 汇总概念"], items: [["seed-concept-map-from-planning", "从规划刷新", "refresh"], ["open-concept-map-external", "打开绘图工具", "layout"]] },
  ov4: { label: "组织关系工具箱", ai: ["open-subflow-ai", "AI 检查组织"], items: [["toggle-ov4-tools", "编辑组织关系", "relations"], ["seed-dodaf-ov4", "刷新来源", "refresh"]] },
  ov2: { label: "资源流工具箱", ai: ["open-subflow-ai", "AI 检查资源流"], items: [["seed-dodaf-ov2", "刷新来源", "refresh"], ["save-dodaf-ov2", "保存资源流", "check"]] },
  ov3: { label: "资源流矩阵工具箱", ai: ["open-subflow-ai", "AI 检查矩阵"], items: [["seed-dodaf-ov3", "刷新来源", "refresh"], ["save-dodaf-ov3", "保存矩阵", "check"]] },
  ov5a: { label: "活动分解工具箱", ai: ["open-subflow-ai", "AI 检查分解"], items: [["sync-ov5a-from-ov5b", "从活动同步", "refresh"], ["sync-ov5b-from-ov5a", "应用父子关系", "relations"]] },
  ov5: { label: "作战活动工具箱", ai: ["generate-ov5", "AI 生成活动"], items: [["add-activity", "新增活动", "plus"], ["open-structure-review", "结构核对", "check"]] },
  ov6a: { label: "规则库工具箱", ai: ["open-rule-library-chat", "AI 复核规则"], items: [["seed-dodaf-ov6a", "刷新规则来源", "refresh"], ["save-dodaf-ov6a", "保存规则库", "check"]] },
  ov6b: { label: "状态机工具箱", ai: ["open-state-machine-chat", "AI 分析状态机"], items: [["toggle-ov6b-tools", "状态机编辑", "state"], ["seed-dodaf-ov6b", "刷新状态来源", "refresh"]] },
  ov6c: { label: "时序图工具箱", ai: ["open-sequence-chat", "AI 生成时序"], items: [["toggle-ov6c-tools", "时序编辑", "transition"], ["seed-dodaf-ov6c", "刷新时序来源", "refresh"]] },
  ov7: { label: "状态活动映射工具箱", ai: ["open-subflow-ai", "AI 检查映射"], items: [["seed-dodaf-ov7", "刷新来源", "refresh"], ["save-dodaf-ov7", "保存映射", "check"]] },
  ooda: { label: "研究循环工具箱", ai: ["generate-ooda", "AI 完善循环"], items: [["derive-ooda", "从活动重派生", "refresh"], ["recalculate", "重新估算", "layout"]] },
  scenario: { label: "仿真演示工具箱", ai: ["generate-scenario", "AI 生成想定"], items: [["recommend-deployment", "优化部署", "concept"], ["open-deployment", "打开部署图", "layout"]] },
  "structure-review": { label: "结构核对工具箱", ai: ["run-validation", "AI 运行校核"], items: [["run-validation", "运行设计验证", "check"], ["open-context-panel", "查看上下文", "doc"]] },
  validate: { label: "设计验证工具箱", ai: ["run-validation", "AI 运行验证"], items: [["run-red-team", "生成红方质询", "relations"], ["open-structure-review", "结构核对", "check"]] }
});

const NATIVE_TOOLBOX_VIEWS = new Set(["ov1", "ov4", "ov6b", "ov6c"]);

export function hasSubflowToolbox(viewId) {
  return Boolean(SUBFLOW_TOOLS[viewId]);
}

export function usesNativeToolbox(viewId) {
  return NATIVE_TOOLBOX_VIEWS.has(viewId);
}

export function isSubflowToolboxOpen(viewId, state = {}) {
  if (viewId === "ov1") return state.ov1ToolsOpen === true;
  if (viewId === "ov4") return state.ov4ToolsOpen === true;
  if (viewId === "ov6b") return state.ov6bToolsOpen === true;
  if (viewId === "ov6c") return state.ov6cToolsOpen === true;
  return state.subflowToolboxOpen?.[viewId] === true;
}

export function renderSubflowToolboxFloatButton(viewId, state = {}) {
  const config = SUBFLOW_TOOLS[viewId];
  if (!config || usesNativeToolbox(viewId) || isSubflowToolboxOpen(viewId, state)) return "";
  return renderToolboxFloatButton({
    scope: `subflow-${viewId}`,
    open: false,
    action: "toggle-subflow-toolbox",
    className: "ov1-edit-rail-brand is-topbar-float subflow-toolbox-float",
    titleClosed: config.label
  });
}

export function renderSubflowToolboxRail(viewId, state = {}) {
  const config = SUBFLOW_TOOLS[viewId];
  if (!config || usesNativeToolbox(viewId) || !isSubflowToolboxOpen(viewId, state)) return "";
  const busy = isBusy(viewId, state);
  const [aiAction, aiLabel] = config.ai;
  const items = [
    { action: aiAction, title: aiLabel, label: aiLabel, icon: "sparkle", attention: true, disabled: busy },
    { type: "sep" },
    ...config.items.map(([action, label, icon]) => ({ action, title: label, label, icon, disabled: busy && action !== "open-context-panel" }))
  ];
  return renderToolboxRail({
    scope: `subflow-${viewId}`,
    label: config.label,
    navLabel: config.label,
    className: "sm-edit-rail subflow-edit-rail",
    navClassName: "subflow-edit-rail-nav",
    toggleAction: "toggle-subflow-toolbox",
    items
  });
}

export function renderSubflowPage(viewId, pageHtml, state = {}) {
  if (!SUBFLOW_TOOLS[viewId] || usesNativeToolbox(viewId)) return pageHtml;
  const open = isSubflowToolboxOpen(viewId, state);
  return `<div class="subflow-workbench-shell ${open ? "is-tools-open" : "is-tools-closed"}" data-subflow-page="${escapeHtml(viewId)}">
    <div class="subflow-page-stage">${pageHtml}</div>
    ${renderSubflowToolboxRail(viewId, state)}
  </div>`;
}

export function subflowToolboxConfig(viewId) {
  return SUBFLOW_TOOLS[viewId] || null;
}

function isBusy(viewId, state) {
  const flags = {
    "operational-task": state.operationalTaskGenerating,
    "force-mission": state.forceMissionGenerating || state.forceMissionChatGenerating,
    "phase-action": state.phaseActionGenerating || state.phaseActionChatGenerating,
    ov1: state.ov1Generating,
    ov5: state.ov5Generating,
    ov6a: state.ruleLibraryChatGenerating || state.ruleLibraryPregenerating,
    ov6b: state.ov6bGenerating || state.stateMachineChatGenerating,
    ov6c: state.ov6cGenerating || state.sequenceChatGenerating,
    ooda: state.oodaGenerating,
    scenario: state.scenarioGenerating,
    validate: state.validationRunning
  };
  return Boolean(flags[viewId]);
}
