import { productShortLabel, views, workflowPhases, workflowPrimaryStepIds } from "../data.js";
import { combatForcePlanIncompleteReasons, operationalTaskPlanIncompleteReasons } from "../forceMissionStore.js";
import { phaseActionConceptIncompleteReasons } from "../phaseActionStore.js";
import { isValidationStale } from "../validationStore.js";
import { normalizeWorkflowProgress } from "../../../shared/workflowProgress.js";
import { escapeHtml } from "./domUtils.js";
import { contextualFlowViewIds, inferRelatedMainViewId, relatedViewLabel } from "../contextualModelFlow.js";

export function currentWorkflow(state, project) {
  const workflow = normalizeWorkflowProgress(
    state.projectDirectory.projects.find((item) => item.id === state.activeProjectId)?.workflow
      || { completedThrough: -1 }
  );
  let completed = completedWorkflowStage(workflow);
  for (let stage = 0; stage <= completed; stage += 1) {
    if (getWorkflowStageIncompleteReasons(state, stage).length > 0) {
      return { ...workflow, completedThrough: Math.max(-1, stage - 1) };
    }
  }
  return workflow;
}

export function currentProjectTitle(state, project) {
  return state.projectDirectory.projects.find((item) => item.id === state.activeProjectId)?.title
    || (state.activeProjectId === "default" ? project.title : state.activeProjectId);
}

export function completedWorkflowStage(workflow) {
  return normalizeWorkflowProgress(workflow).completedThrough;
}

export function nextWorkflowStage(workflow) {
  return Math.min(completedWorkflowStage(workflow) + 1, workflowPhases.length - 1);
}

/** Primary research steps that participate in phase gating / capsule advance. */
export function workflowSteps() {
  const byId = new Map(views.map((view) => [view.id, view]));
  return workflowPrimaryStepIds
    .map((id) => byId.get(id))
    .filter((view) => view && workflowPhases.includes(view.phase));
}

function isCompletedValue(value) {
  return Boolean(value && !String(value).includes("\u5f85\u8865\u5145"));
}

/**
 * Hard stage gates only check 主写 requirements (plans/RESEARCH_WORKFLOW_18.md).
 * Check pages (rules/state/events, OV-2/3/4, activity decomposition, structure review) do not block stage confirm.
 */
export function getWorkflowStageIncompleteReasons(state, stage) {
  if (stage === 0) {
    return [
      ["研究意图", state.brief?.researchIntent],
      ["研究目标", state.brief?.objective],
      ["研究路线", state.brief?.approach],
      ["关键假设", state.brief?.assumptions],
      ["预期效果", state.brief?.expectedEffects],
      ["主要风险", state.brief?.risk]
    ].filter(([, value]) => !isCompletedValue(value)).map(([label]) => label);
  }
  // 关联模型只提供提示与诊断，不参与七步主线强门禁。
  if (stage === 1) {
    return [
      ...phaseActionConceptIncompleteReasons(state.phaseAction, state.phaseActionStorage)
    ].filter(Boolean);
  }
  if (stage === 2) {
    return [
      ...operationalTaskPlanIncompleteReasons(state.forceMission, state.forceMissionStorage)
    ].filter(Boolean);
  }
  if (stage === 3) {
    return [
      ...combatForcePlanIncompleteReasons(state.forceMission, state.forceMissionStorage)
    ].filter(Boolean);
  }
  if (stage === 4) {
    return [
      state.ov1Storage?.stale && "复核已过期的总体图",
      !state.ov1?.nodes?.length && "总体图节点",
      !state.ov1?.edges?.length && "总体图关系"
    ].filter(Boolean);
  }
  if (stage === 5) {
    return [
      !state.conceptMap?.document?.items?.length && "概念图对象或标绘",
      state.conceptMap?.reference?.status !== "confirmed" && "确认概念图研究参考",
      state.conceptMapStorage?.stale && "复核已过期的概念图"
    ].filter(Boolean);
  }
  if (stage === 6) {
    const reasons = [];
    if (!state.scenario?.entities?.length) reasons.push("自动想定");
    if (!state.validationResult?.scores?.length) reasons.push("设计验证");
    else if (isValidationStale(state.validationResult, state.ov5, state.ooda, state.scenario, state.ov1)) {
      reasons.push("更新已过期的设计验证");
    }
    return reasons;
  }
  return [];
}

export function canCompleteWorkflowStage(state, stage) {
  return getWorkflowStageIncompleteReasons(state, stage).length === 0;
}

function stepShortLabel(view) {
  return productShortLabel(view?.id, String(view?.label || view?.id || "").slice(0, 8));
}

/**
 * Resolve capsule intent from the active research step:
 * - intermediate primary steps → advance to next primary step
 * - last primary step of a stage → complete stage / enter next stage
 */
export function resolveWorkflowGateContext(state) {
  const workflow = currentWorkflow(state);
  const freeMode = workflow.mode === "free";
  const steps = workflowSteps();
  const completedThrough = completedWorkflowStage(workflow);
  const index = steps.findIndex((step) => step.id === state.activeView);
  if (index < 0) {
    return resolveRelatedWorkflowGateContext(state, { freeMode, steps, completedThrough });
  }

  const current = steps[index];
  const nextStep = steps[index + 1] || null;
  const phaseIndex = index;
  const isLastInPhase = true;
  const phaseDone = phaseIndex >= 0 && phaseIndex <= completedThrough;
  const incompleteReasons = phaseIndex >= 0 ? getWorkflowStageIncompleteReasons(state, phaseIndex) : [];
  const ready = incompleteReasons.length === 0;
  const followingPhase = phaseIndex >= 0 && phaseIndex < workflowPhases.length - 1
    ? workflowPhases[phaseIndex + 1]
    : null;
  const completing = Boolean(state.workflowCompleting);
  const open = Boolean(state.workflowGateOpen);

  if (freeMode) {
    return {
      freeMode: true,
      mode: "hidden",
      current,
      nextStep,
      isLastInPhase,
      phaseIndex,
      completedThrough,
      incompleteReasons,
      ready,
      followingPhase,
      completing,
      open
    };
  }

  if (!nextStep && phaseDone) {
    return {
      freeMode: false,
      mode: "complete",
      current,
      nextStep: null,
      isLastInPhase: true,
      phaseIndex,
      completedThrough,
      incompleteReasons: [],
      ready: true,
      followingPhase: null,
      completing,
      open
    };
  }

  if (phaseDone && nextStep) {
    const relatedViewIds = contextualFlowViewIds(current.id, state);
    if (relatedViewIds.length) {
      const relatedNextStep = {
        id: relatedViewIds[0],
        label: relatedViewLabel(relatedViewIds[0]),
        related: true,
        mainViewId: current.id
      };
      return buildAdvanceContext({
        freeMode,
        current,
        nextStep: relatedNextStep,
        phaseIndex,
        completedThrough,
        followingPhase,
        completing,
        open,
        related: true
      });
    }
    return {
      freeMode: false,
      mode: "next-step",
      current,
      nextStep,
      isLastInPhase: true,
      phaseIndex,
      completedThrough,
      incompleteReasons: [],
      ready: true,
      followingPhase,
      completing,
      open,
      action: "advance-workflow-step",
      capsuleTitle: "下一步",
      capsuleAction: stepShortLabel(nextStep),
      actionLabel: `进入${nextStep.label}`,
      headLabel: "当前步骤",
      headTitle: current.label,
      hint: `本阶段已确认，可进入「${nextStep.label}」。`,
      detailHtml: `<p class="workflow-gate-detail-note">下一页：${escapeHtml(nextStep.label)}（${escapeHtml(nextStep.phase || "")}）。</p>`
    };
  }

  const confirmationRelatedId = contextualFlowViewIds(current.id, state)[0] || "";
  const confirmationNextLabel = confirmationRelatedId ? relatedViewLabel(confirmationRelatedId) : (followingPhase || "交付完成");
  return {
    freeMode: false,
    mode: "complete-phase",
    current,
    nextStep,
    isLastInPhase: true,
    phaseIndex,
    completedThrough,
    incompleteReasons,
    ready,
    followingPhase,
    completing,
    open,
    action: "complete-workflow-stage",
    capsuleTitle: current.phase || "当前步骤",
    capsuleAction: ready ? (confirmationRelatedId ? relatedViewLabel(confirmationRelatedId) : (followingPhase ? stepShortLabel(nextStep) : "确认完成")) : `待完成 ${incompleteReasons.length}`,
    actionLabel: confirmationRelatedId ? `确认并进入${relatedViewLabel(confirmationRelatedId)}` : (followingPhase ? `确认并进入${followingPhase}` : "确认并完成工作流"),
    headLabel: "当前步骤",
    headTitle: current.phase || "",
    hint: ready
      ? `当前成果已就绪，确认后进入${confirmationNextLabel}${confirmationRelatedId ? "（关联流程）" : ""}。`
      : `尚需完成：${incompleteReasons.join("、")}。点击确认可查看提示。`,
    detailHtml: incompleteReasons.length
      ? `<ul class="workflow-gate-detail">${incompleteReasons.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : `<p class="workflow-gate-detail-note">确认后将进入${escapeHtml(confirmationNextLabel)}${confirmationRelatedId ? "（关联流程）" : ""}。</p>`
  };
}

function buildAdvanceContext({ freeMode, current, nextStep, phaseIndex, completedThrough, followingPhase, completing, open, related = false }) {
  return {
    freeMode,
    mode: "next-step",
    current,
    nextStep,
    isLastInPhase: true,
    phaseIndex,
    completedThrough,
    incompleteReasons: [],
    ready: true,
    followingPhase,
    completing,
    open,
    action: "advance-workflow-step",
    capsuleTitle: "下一步",
    capsuleAction: related ? relatedViewLabel(nextStep.id) : stepShortLabel(nextStep),
    actionLabel: `进入${nextStep.label}`,
    headLabel: "当前步骤",
    headTitle: current.label,
    hint: related
      ? `本步骤已确认，先进入关联流程“${nextStep.label}”。`
      : `本阶段已确认，可进入“${nextStep.label}”。`,
    detailHtml: `<p class="workflow-gate-detail-note">下一项：${escapeHtml(nextStep.label)}${related ? "（关联流程）" : ""}。</p>`
  };
}

function resolveRelatedWorkflowGateContext(state, { freeMode, steps, completedThrough }) {
  const preferredMainViewId = state.relatedModelReturnContext?.mainViewId
    || workflowPrimaryStepIds[Math.max(0, Math.min(completedThrough, workflowPrimaryStepIds.length - 1))]
    || "";
  const mainViewId = inferRelatedMainViewId(state.activeView, preferredMainViewId);
  if (!mainViewId) return { freeMode, mode: "hidden", current: null, nextStep: null, completedThrough };
  const relatedViewIds = contextualFlowViewIds(mainViewId, state);
  const relatedIndex = relatedViewIds.indexOf(state.activeView);
  if (relatedIndex < 0) return { freeMode, mode: "hidden", current: null, nextStep: null, completedThrough };
  const mainIndex = steps.findIndex((step) => step.id === mainViewId);
  const nextRelatedId = relatedViewIds[relatedIndex + 1] || "";
  const nextMain = steps[mainIndex + 1] || null;
  const nextStep = nextRelatedId
    ? { id: nextRelatedId, label: relatedViewLabel(nextRelatedId), related: true, mainViewId }
    : nextMain;
  const currentLabel = relatedViewLabel(state.activeView);
  if (!nextStep) {
    return { freeMode, mode: "complete", current: { id: state.activeView, label: currentLabel }, nextStep: null, completedThrough };
  }
  return {
    freeMode,
    mode: "related-next-step",
    current: { id: state.activeView, label: currentLabel },
    nextStep,
    mainViewId,
    completedThrough,
    ready: true,
    completing: false,
    open: Boolean(state.workflowGateOpen),
    action: "advance-related-workflow",
    capsuleTitle: "下一步",
    capsuleAction: nextStep.related ? relatedViewLabel(nextStep.id) : stepShortLabel(nextStep),
    actionLabel: `进入${nextStep.label}`,
    headLabel: "当前关联步骤",
    headTitle: currentLabel,
    hint: nextStep.related
      ? `继续关联流程，进入“${nextStep.label}”。`
      : `当前关联流程已走完，进入主流程“${nextStep.label}”。`,
    detailHtml: `<p class="workflow-gate-detail-note">下一项：${escapeHtml(nextStep.label)}${nextStep.related ? "（关联流程）" : "（主流程）"}。</p>`
  };
}

/**
 * Top-right capsule.
 * - Intermediate primary steps: enter next step
 * - Last primary step of a stage: confirm and enter next stage
 */
export function renderWorkflowGate(state) {
  const ctx = resolveWorkflowGateContext(state);
  if (ctx.mode === "hidden") return "";

  if (ctx.mode === "complete") {
    return `<div class="workflow-gate-shell is-complete" data-workflow-gate-shell role="status">
      <div class="workflow-gate-capsule is-static" title="所有阶段已确认并可交付">
        <span class="workflow-gate-capsule-dot" aria-hidden="true"></span>
        <span class="workflow-gate-capsule-text"><b>工作流</b><em>已完成</em></span>
      </div>
    </div>`;
  }

  const ready = Boolean(ctx.ready);
  const open = Boolean(ctx.open);
  const completing = Boolean(ctx.completing);
  const shellState = ctx.mode === "complete-phase" && !ready ? "is-pending" : "is-ready";
  const title = `${ctx.capsuleTitle} · ${ctx.capsuleAction}（点击展开）`;

  return `<div class="workflow-gate-shell ${shellState}${open ? " is-open" : ""}" data-workflow-gate-shell data-gate-mode="${escapeHtml(ctx.mode)}">
    <div class="workflow-gate-panel" role="region" aria-label="工作流推进" id="workflowGatePanel"${open ? "" : " inert"}${open ? "" : ' aria-hidden="true"'}>
      <div class="workflow-gate-panel-head">
        <div class="workflow-gate-copy">
          <span class="workflow-gate-label">${escapeHtml(ctx.headLabel || "当前")}</span>
          <strong class="workflow-gate-phase">${escapeHtml(ctx.headTitle || "")}</strong>
          <small class="workflow-gate-hint">${escapeHtml(ctx.hint || "")}</small>
        </div>
      </div>
      ${ctx.detailHtml || ""}
      <div class="workflow-actions">
        <button type="button" data-action="${escapeHtml(ctx.action)}" ${completing ? "disabled" : ""}>${completing ? "正在确认…" : escapeHtml(ctx.actionLabel || "继续")}</button>
      </div>
    </div>
    <button type="button" class="workflow-gate-capsule" data-action="toggle-workflow-gate" aria-expanded="${open ? "true" : "false"}" aria-controls="workflowGatePanel" title="${escapeHtml(title)}">
      <span class="workflow-gate-capsule-dot" aria-hidden="true"></span>
      <span class="workflow-gate-capsule-text"><b>${escapeHtml(ctx.capsuleTitle)}</b><em>${escapeHtml(ctx.capsuleAction)}</em></span>
      <span class="workflow-gate-capsule-chevron" aria-hidden="true"></span>
    </button>
  </div>`;
}
