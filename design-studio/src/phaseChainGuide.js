/**
 * Phase-action research chain as a low-profile floating ball.
 * Default collapsed; expand only when needed.
 * 规则库/词表 → 阶段与行动 → 绑定/状态机/时序 → 反查回改
 */
import { isPhaseActionConceptConfirmed } from "./phaseActionStore.js";

const CHAIN = [
  {
    id: "ov6a",
    label: "规则库",
    short: "1",
    hint: "先建规则本体与词表，可不绑活动"
  },
  {
    id: "phase-action",
    label: "阶段与行动",
    short: "2",
    hint: "在约束下生成阶段、行动、进入退出"
  },
  {
    id: "bind",
    label: "绑定校验",
    short: "3a",
    viewId: "ov6a",
    mode: "bind",
    hint: "阶段确认后：规则绑定受约束活动"
  },
  {
    id: "ov6b",
    label: "状态机",
    short: "3b",
    hint: "关键任务/对象分机，勿硬合并"
  },
  {
    id: "ov6c",
    label: "时序图",
    short: "3c",
    hint: "跨对象协同消息与回链"
  },
  {
    id: "structure-review",
    label: "反查回改",
    short: "4",
    hint: "无规则/无出口/无来源 → 回源头"
  }
];

export function getPhaseChainSteps() {
  return CHAIN.map((item) => ({ ...item }));
}

export function isPhaseChainView(viewId) {
  return ["ov6a", "phase-action", "ov6b", "ov6c", "structure-review"].includes(viewId);
}

function activeChainStepId(viewId, state = {}) {
  const phaseConfirmed = isPhaseActionConceptConfirmed(state.phaseAction, state.phaseActionStorage);
  if (viewId === "ov6a") return phaseConfirmed ? "bind" : "ov6a";
  if (viewId === "phase-action") return "phase-action";
  if (viewId === "ov6b") return "ov6b";
  if (viewId === "ov6c") return "ov6c";
  if (viewId === "structure-review") return "structure-review";
  return "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Floating ball + expandable panel for the phase research chain.
 */
export function renderPhaseChainGuide(state = {}, activeView = "") {
  if (!isPhaseChainView(activeView)) return "";
  const phaseConfirmed = isPhaseActionConceptConfirmed(state.phaseAction, state.phaseActionStorage);
  const activeId = activeChainStepId(activeView, state);
  const activeStep = CHAIN.find((item) => item.id === activeId) || CHAIN[0];
  const open = Boolean(state.phaseChainGuideOpen);
  const next = nextAction(activeView, phaseConfirmed, state);

  const stepsHtml = CHAIN.map((step) => {
    const isActive = step.id === activeId;
    const done = stepDone(step.id, phaseConfirmed, activeId);
    const target = step.viewId || step.id;
    return `<button type="button" class="phase-chain-fab-step ${isActive ? "is-active" : ""} ${done ? "is-done" : ""}" data-view="${escapeHtml(target)}" title="${escapeHtml(step.hint)}">
      <span class="phase-chain-fab-step-index" aria-hidden="true">${escapeHtml(step.short)}</span>
      <span class="phase-chain-fab-step-label">${escapeHtml(step.label)}</span>
    </button>`;
  }).join("");

  return `<div class="phase-chain-fab ${open ? "is-open" : ""}" data-phase-chain-fab>
    <button type="button"
      class="phase-chain-fab-ball"
      data-action="toggle-phase-chain-guide"
      title="阶段行动链 · ${escapeHtml(activeStep.label)}"
      aria-label="阶段行动链，当前：${escapeHtml(activeStep.label)}"
      aria-expanded="${open ? "true" : "false"}"
      aria-controls="phaseChainFabPanel">
      <span class="phase-chain-fab-ball-index" aria-hidden="true">${escapeHtml(activeStep.short)}</span>
      <span class="phase-chain-fab-ball-text">链</span>
    </button>
    <div class="phase-chain-fab-panel" id="phaseChainFabPanel" role="dialog" aria-label="阶段行动链" ${open ? "" : "hidden"}>
      <header class="phase-chain-fab-head">
        <div>
          <strong>阶段行动链</strong>
          <p>规则库 → 阶段 → 绑定/状态/时序 → 反查</p>
        </div>
        <button type="button" class="phase-chain-fab-close" data-action="toggle-phase-chain-guide" aria-label="收起">×</button>
      </header>
      <p class="phase-chain-fab-current">当前：<b>${escapeHtml(activeStep.label)}</b> · ${escapeHtml(activeStep.hint)}</p>
      <div class="phase-chain-fab-steps" role="navigation">${stepsHtml}</div>
      ${next
    ? `<div class="phase-chain-fab-next">
          <button type="button" class="phase-chain-fab-next-btn" data-view="${escapeHtml(next.view)}">${escapeHtml(next.label)}</button>
        </div>`
    : ""}
    </div>
  </div>`;
}

function stepDone(stepId, phaseConfirmed, activeId) {
  const order = CHAIN.map((item) => item.id);
  const activeIndex = order.indexOf(activeId);
  if (stepId === "ov6a") return phaseConfirmed || activeIndex > 0;
  if (stepId === "phase-action") return phaseConfirmed;
  if (stepId === "bind") return phaseConfirmed && activeIndex > order.indexOf("bind");
  if (stepId === "ov6b") return activeIndex > order.indexOf("ov6b");
  if (stepId === "ov6c") return activeIndex > order.indexOf("ov6c");
  return false;
}

function nextAction(activeView, phaseConfirmed, state) {
  if (activeView === "ov6a" && !phaseConfirmed) {
    return { view: "phase-action", label: "下一步：阶段与行动" };
  }
  if (activeView === "ov6a" && phaseConfirmed) {
    return { view: "ov6b", label: "下一步：状态机校验" };
  }
  if (activeView === "phase-action") {
    if (phaseConfirmed) return { view: "ov6a", label: "下一步：规则绑定" };
    const hasRules = Array.isArray(state.ov6a?.rules) && state.ov6a.rules.length > 0;
    return hasRules
      ? null
      : { view: "ov6a", label: "去规则库补规则" };
  }
  if (activeView === "ov6b") return { view: "ov6c", label: "下一步：时序校验" };
  if (activeView === "ov6c") return { view: "structure-review", label: "下一步：反查回改" };
  if (activeView === "structure-review") return { view: "phase-action", label: "回到阶段与行动" };
  return null;
}
