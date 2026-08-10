import { workflowPhases } from "../data.js";
import { forceMissionPlanIncompleteReasons } from "../forceMissionStore.js";
import { phaseActionConceptIncompleteReasons } from "../phaseActionStore.js";
import { isValidationStale } from "../validationStore.js";
import { escapeHtml } from "./domUtils.js";

export function currentWorkflow(state, project) {
  const workflow = state.projectDirectory.projects.find((item) => item.id === state.activeProjectId)?.workflow
    || { completedThrough: -1 };
  const planningIncomplete = getWorkflowStageIncompleteReasons(state, 1).length > 0;
  return planningIncomplete && Number(workflow.completedThrough ?? -1) >= 1
    ? { ...workflow, completedThrough: 0 }
    : workflow;
}

export function currentProjectTitle(state, project) {
  return state.projectDirectory.projects.find((item) => item.id === state.activeProjectId)?.title
    || (state.activeProjectId === "default" ? project.title : state.activeProjectId);
}

export function completedWorkflowStage(workflow) {
  const value = Number(workflow?.completedThrough ?? -1);
  if (!Number.isFinite(value)) return -1;
  return Math.max(-1, Math.min(workflowPhases.length - 1, Math.trunc(value)));
}

export function nextWorkflowStage(workflow) {
  return Math.min(completedWorkflowStage(workflow) + 1, workflowPhases.length - 1);
}

function isCompletedValue(value) {
  return Boolean(value && !String(value).includes("\u5f85\u8865\u5145"));
}

export function getWorkflowStageIncompleteReasons(state, stage) {
  if (stage === 0) {
    return [
      ["\u7814\u7a76\u610f\u56fe", state.brief?.researchIntent],
      ["\u7814\u7a76\u76ee\u6807", state.brief?.objective],
      ["\u7814\u7a76\u8def\u7ebf", state.brief?.approach],
      ["\u5173\u952e\u5047\u8bbe", state.brief?.assumptions],
      ["\u9884\u671f\u6548\u679c", state.brief?.expectedEffects],
      ["\u4e3b\u8981\u98ce\u9669", state.brief?.risk]
    ].filter(([, value]) => !isCompletedValue(value)).map(([label]) => label);
  }
  if (stage === 1) {
    return [
      ...forceMissionPlanIncompleteReasons(state.forceMission, state.forceMissionStorage),
      ...phaseActionConceptIncompleteReasons(state.phaseAction, state.phaseActionStorage),
      !state.conceptMap?.document?.items?.length && "概念图对象或标绘",
      state.conceptMap?.reference?.status !== "confirmed" && "确认供 OV 使用的概念图参考",
      state.conceptMapStorage?.stale && "复核已过期的概念图"
    ].filter(Boolean);
  }
  if (stage === 2) {
    return [
      !state.ov1?.nodes?.length && "OV-1 \u6982\u5ff5\u56fe\u8282\u70b9",
      !state.ov5?.activities?.length && "OV-5 \u6d3b\u52a8",
      !state.ov5?.edges?.length && "OV-5 \u6d3b\u52a8\u5173\u7cfb",
      !state.ooda?.lanes?.some((lane) => lane.nodes?.length) && "OODA \u884c\u4e3a\u5faa\u73af"
    ].filter(Boolean);
  }
  if (stage === 3) {
    return [
      !state.ov1?.nodes?.length && "OV-1 \u6982\u5ff5\u56fe\u8282\u70b9",
      !state.ov5?.activities?.length && "OV-5 \u6d3b\u52a8",
      !state.ov5?.edges?.length && "OV-5 \u6d3b\u52a8\u5173\u7cfb",
      !state.ooda?.lanes?.some((lane) => lane.nodes?.length) && "OODA \u884c\u4e3a\u5faa\u73af"
    ].filter(Boolean);
  }
  if (stage === 4) {
    const reasons = [];
    if (!state.scenario?.entities?.length) reasons.push("\u81ea\u52a8\u60f3\u5b9a");
    if (!state.validationResult?.scores?.length) reasons.push("\u8bbe\u8ba1\u9a8c\u8bc1");
    else if (isValidationStale(state.validationResult, state.ov5, state.ooda, state.scenario, state.ov1)) reasons.push("\u66f4\u65b0\u5df2\u8fc7\u671f\u7684\u8bbe\u8ba1\u9a8c\u8bc1");
    return reasons;
  }
  return [
    Number(state.collaboration?.openCount || 0) > 0 && "\u5f85\u5904\u7406\u7684\u534f\u540c\u5ba1\u9605",
    !state.reportVersions?.length && "\u6210\u679c\u62a5\u544a\u5f52\u6863"
  ].filter(Boolean);
}

export function canCompleteWorkflowStage(state, stage) {
  return getWorkflowStageIncompleteReasons(state, stage).length === 0;
}

/**
 * Scheme D: mini capsule at bottom-right of main column.
 * Hover / focus / click expands the full confirm panel above the capsule.
 */
export function renderWorkflowGate(state) {
  const workflow = currentWorkflow(state);
  const freeMode = workflow.mode === "free";
  const completedThrough = completedWorkflowStage(workflow);
  const next = nextWorkflowStage(workflow);
  const phase = workflowPhases[next];
  const followingPhase = workflowPhases[next + 1];
  const incompleteReasons = getWorkflowStageIncompleteReasons(state, next);
  const ready = incompleteReasons.length === 0;
  const completing = Boolean(state.workflowCompleting);
  const open = Boolean(state.workflowGateOpen);
  const actionLabel = followingPhase
    ? `\u786e\u8ba4\u5e76\u8fdb\u5165${escapeHtml(followingPhase)}`
    : "\u786e\u8ba4\u5e76\u5b8c\u6210\u5de5\u4f5c\u6d41";
  if (freeMode) return "";
  if (completedThrough >= workflowPhases.length - 1) {
    return `<div class="workflow-gate-shell is-complete" role="status">
      <div class="workflow-gate-capsule is-static" title="所有阶段已确认并可交付">
        <span class="workflow-gate-capsule-dot" aria-hidden="true"></span>
        <span class="workflow-gate-capsule-text"><b>工作流</b><em>已完成</em></span>
      </div>
    </div>`;
  }
  const nextLabel = followingPhase || "交付完成";
  const capsuleAction = ready ? "确认进入" : `待完成 ${incompleteReasons.length}`;
  const hint = ready
    ? `\u57fa\u7840\u6761\u4ef6\u5df2\u6ee1\u8db3\uff0c\u786e\u8ba4\u540e\u5c06\u8fdb\u5165${escapeHtml(nextLabel)}\u3002`
    : `\u5c1a\u9700\u5b8c\u6210\uff1a${escapeHtml(incompleteReasons.join("\u3001"))}\u3002\u70b9\u51fb\u786e\u8ba4\u67e5\u770b\u63d0\u793a\u3002`;
  const detail = incompleteReasons.length
    ? `<ul class="workflow-gate-detail">${incompleteReasons.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<p class="workflow-gate-detail-note">确认后将解锁下一阶段研究路径。</p>`;
  return `<div class="workflow-gate-shell ${ready ? "is-ready" : "is-pending"}${open ? " is-open" : ""}">
    <div class="workflow-gate-panel" role="region" aria-label="工作流阶段确认" id="workflowGatePanel">
      <div class="workflow-gate-panel-head">
        <div class="workflow-gate-copy">
          <span class="workflow-gate-label">当前阶段</span>
          <strong class="workflow-gate-phase">${escapeHtml(phase)}</strong>
          <small class="workflow-gate-hint">${hint}</small>
        </div>
        <button type="button" class="workflow-gate-close quiet-button" data-action="toggle-workflow-gate" title="收起" aria-label="收起阶段确认">收起</button>
      </div>
      ${detail}
      <div class="workflow-actions">
        <button type="button" data-action="complete-workflow-stage" ${completing ? "disabled" : ""}>${completing ? "\u6b63\u5728\u786e\u8ba4..." : actionLabel}</button>
      </div>
    </div>
    <button type="button" class="workflow-gate-capsule" data-action="toggle-workflow-gate" aria-expanded="${open ? "true" : "false"}" aria-controls="workflowGatePanel" title="${escapeHtml(phase)} · ${capsuleAction}">
      <span class="workflow-gate-capsule-dot" aria-hidden="true"></span>
      <span class="workflow-gate-capsule-text"><b>${escapeHtml(phase)}</b><em>${escapeHtml(capsuleAction)}</em></span>
      <span class="workflow-gate-capsule-chevron" aria-hidden="true"></span>
    </button>
  </div>`;
}
