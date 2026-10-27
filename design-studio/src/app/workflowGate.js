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
    if (getWorkflowStageIncompleteReasons(state, stage, { forAdvancement: true }).length > 0) {
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
export function getWorkflowStageIncompleteReasons(state, stage, { forAdvancement = false } = {}) {
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
    const reasons = [
      ...phaseActionConceptIncompleteReasons(state.phaseAction, state.phaseActionStorage)
    ].filter(Boolean);
    return forAdvancement ? reasons.filter((r) => r !== "确认阶段与行动") : reasons;
  }
  if (stage === 2) {
    const reasons = [
      ...operationalTaskPlanIncompleteReasons(state.forceMission, state.forceMissionStorage)
    ].filter(Boolean);
    return forAdvancement ? reasons.filter((r) => r !== "确认作战任务") : reasons;
  }
  if (stage === 3) {
    const reasons = [
      ...combatForcePlanIncompleteReasons(state.forceMission, state.forceMissionStorage)
    ].filter(Boolean);
    return forAdvancement ? reasons.filter((r) => r !== "确认作战兵力") : reasons;
  }
  if (stage === 4) {
    return [
      state.ov1Storage?.stale && "复核已过期的总体图",
      !state.ov1?.nodes?.length && "总体图节点",
      !state.ov1?.edges?.length && "总体图关系"
    ].filter(Boolean);
  }
  if (stage === 5) {
    const reasons = [
      (!state.conceptMap?.document?.items?.length && !state.conceptMap?.elements?.length) && "概念图对象或标绘",
      state.conceptMap?.reference?.status !== "confirmed" && "确认概念图研究参考",
      state.conceptMapStorage?.stale && "复核已过期的概念图"
    ].filter(Boolean);
    return forAdvancement ? reasons.filter((r) => r !== "确认概念图研究参考") : reasons;
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
  return getWorkflowStageIncompleteReasons(state, stage, { forAdvancement: true }).length === 0;
}

function stepShortLabel(view) {
  return productShortLabel(view?.id, String(view?.label || view?.id || "").slice(0, 8));
}

export function isStepGenerated(viewId, state = {}, context = {}) {
  if (!viewId) return false;
  const mainViewId = context?.mainViewId || state?.relatedModelReturnContext?.mainViewId || "";
  switch (viewId) {
    case "brief":
      return Boolean(state.brief?.researchIntent || state.brief?.objective);
    case "phase-action":
      return Boolean(state.phaseAction?.phases?.length);
    case "ov6a": {
      if (mainViewId === "operational-task") {
        const hasTaskBindings = (state.ov6a?.rules || []).some((r) => (r.taskBindings || []).length);
        const hasTaskProposal = state.ov6a?.ruleChangeSet?.source === "operational-task" && (state.ov6a?.ruleChangeSet?.changes || []).length > 0;
        return Boolean(hasTaskBindings || hasTaskProposal);
      }
      if (mainViewId === "force-mission") {
        const hasForceBindings = (state.ov6a?.rules || []).some((r) => (r.forceBindings || []).length || (r.rule?.forceRefs || []).length);
        const hasForceProposal = state.ov6a?.ruleChangeSet?.source === "force-mission" && (state.ov6a?.ruleChangeSet?.changes || []).length > 0;
        return Boolean(hasForceBindings || hasForceProposal);
      }
      return Boolean(state.ov6a?.rules?.length);
    }
    case "ov6b": {
      const machines = state.ov6b?.stateMachines || [];
      if (mainViewId === "operational-task") {
        return Boolean(machines.some((m) => m.subjectType === "task"));
      }
      if (mainViewId === "force-mission") {
        return Boolean(machines.some((m) => m.subjectType === "force"));
      }
      return Boolean(machines.some((m) => !m.subjectType || m.subjectType === "phase") || machines.length);
    }
    case "ov6c": {
      const seqs = state.ov6c?.sequences || state.ov6c?.sequenceDiagrams || [];
      if (mainViewId === "operational-task") {
        return Boolean(seqs.some((s) => s.diagramType === "task"));
      }
      if (mainViewId === "force-mission") {
        return Boolean(seqs.some((s) => s.diagramType === "force"));
      }
      return Boolean(seqs.some((s) => !s.diagramType || s.diagramType === "phase") || seqs.length);
    }
    case "operational-task":
      return Boolean(state.forceMission?.tasks?.length);
    case "ov1b":
      return Boolean(state.ov1b?.taskGroups?.length || state.ov1b?.groups?.length);
    case "force-mission":
      return Boolean(state.forceMission?.forces?.length);
    case "ov4":
      return Boolean(state.ov4?.commandNodes?.length || state.ov4?.relationships?.length || state.ov4?.diagrams?.length);
    case "ov2":
      return Boolean(state.ov2?.exchanges?.length || state.ov2?.nodes?.length);
    case "ov3":
      return Boolean(state.ov3?.messages?.length || state.ov3?.exchanges?.length);
    case "ov1":
      return Boolean(state.conceptGraphic?.nodes?.length || state.ov1?.nodes?.length || state.ov1Candidate);
    case "ov5a":
      return Boolean(state.ov5?.activities?.length);
    case "concept-map":
      return Boolean(state.conceptMap?.document?.items?.length || state.conceptMap?.elements?.length);
    case "scenario":
      return Boolean(state.scenario?.entities?.length);
    case "validate":
      return Boolean(state.validationResult?.scores?.length);
    default:
      return false;
  }
}

export function isStepStale(viewId, state = {}, context = {}) {
  if (!viewId) return false;
  const mainViewId = context?.mainViewId || state?.relatedModelReturnContext?.mainViewId || "";
  switch (viewId) {
    case "phase-action":
      return Boolean(state.phaseActionStorage?.stale);
    case "operational-task":
    case "force-mission":
      return Boolean(state.forceMissionStorage?.stale);
    case "ov1":
      return Boolean(state.ov1Storage?.stale || state.conceptGraphicStorage?.stale);
    case "concept-map":
      return Boolean(state.conceptMapStorage?.stale);
    case "scenario":
      return Boolean(state.scenarioStorage?.stale || state.scenario?.stale);
    case "validate":
      return Boolean(state.validationStorage?.stale || isValidationStale(state.validationResult, state.ov5, state.ooda, state.scenario, state.ov1));
    case "ov6a":
      if (mainViewId === "operational-task" || mainViewId === "force-mission") {
        return Boolean((state.ov6a?.ruleChangeSet?.changes || []).some((item) => item.status === "pending") || state.forceMissionStorage?.stale);
      }
      return Boolean((state.ov6a?.ruleChangeSet?.changes || []).some((item) => item.status === "pending") || state.phaseActionStorage?.stale);
    case "ov6b":
      return Boolean(mainViewId === "operational-task" || mainViewId === "force-mission" ? state.forceMissionStorage?.stale : state.phaseActionStorage?.stale);
    case "ov6c":
      return Boolean(state.phaseActionStorage?.stale || state.forceMissionStorage?.stale);
    case "ov4":
    case "ov2":
    case "ov3":
    case "ov1b":
      return Boolean(state.forceMissionStorage?.stale);
    default:
      return false;
  }
}

export function resolveCurrentStepQuickActions(state = {}) {
  const actions = [];
  const viewId = state.activeView;

  if (viewId === "phase-action") {
    const phases = state.phaseAction?.phases || [];
    if (phases.length >= 2 && state.phaseAction?.status !== "confirmed") {
      actions.push({
        id: "confirm-phase-action",
        label: "一键确认阶段与行动",
        action: "workflow-gate-quick-confirm-phase-action",
        hint: "当前阶段方案已具备，点击即可快速确认并解锁下游"
      });
    }
  } else if (viewId === "operational-task") {
    const tasks = state.forceMission?.tasks || [];
    if (tasks.length > 0 && !state.forceMission?.tasksConfirmedAt) {
      actions.push({
        id: "confirm-operational-tasks",
        label: "一键确认作战任务",
        action: "workflow-gate-quick-confirm-operational-tasks",
        hint: "作战任务列表已就绪，点击即可快速确认"
      });
    }
  } else if (viewId === "force-mission") {
    const forces = state.forceMission?.forces || [];
    if (forces.length > 0 && state.forceMission?.status !== "confirmed") {
      actions.push({
        id: "confirm-force-mission",
        label: "一键确认作战兵力",
        action: "workflow-gate-quick-confirm-force-mission",
        hint: "兵力编成与编组方案已就绪，点击即可快速确认"
      });
    }
  } else if (viewId === "ov6a") {
    const pendingChanges = (state.ov6a?.ruleChangeSet?.changes || []).filter((item) => item.status === "pending");
    if (pendingChanges.length > 0) {
      actions.push({
        id: "apply-all-rule-changes",
        label: `采纳全部建议并覆盖 (${pendingChanges.length}项)`,
        action: "workflow-gate-quick-apply-all-rules",
        hint: "检测到上游输入的待审核建议，点击全部采纳并更新规则库"
      });
    }
  } else if (viewId === "ov1") {
    if ((state.ov1?.nodes?.length || state.conceptGraphic?.nodes?.length) && !state.ov1?.confirmed) {
      actions.push({
        id: "confirm-ov1",
        label: "一键确认总体图",
        action: "workflow-gate-quick-confirm-ov1",
        hint: "总体图高层交互节点已就绪，点击快速确认并解锁概念图"
      });
    }
  } else if (viewId === "concept-map") {
    if (state.conceptMap?.reference?.status !== "confirmed" && (state.conceptMap?.document?.items?.length || state.conceptMap?.elements?.length)) {
      actions.push({
        id: "confirm-concept-map",
        label: "一键确认概念图参考",
        action: "workflow-gate-quick-confirm-concept-map",
        hint: "概念图研究参考已满足，点击即可快速确认"
      });
    }
  }

  return actions;
}

function formatCapsuleAction(baseLabel, nextGenerated, nextStale) {
  if (nextGenerated && nextStale) {
    return `${baseLabel} (上游有更新)`;
  }
  if (nextGenerated) {
    return `${baseLabel} (已生成)`;
  }
  return baseLabel;
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
  const incompleteReasons = phaseIndex >= 0 ? getWorkflowStageIncompleteReasons(state, phaseIndex, { forAdvancement: true }) : [];
  const ready = incompleteReasons.length === 0;
  const followingPhase = phaseIndex >= 0 && phaseIndex < workflowPhases.length - 1
    ? workflowPhases[phaseIndex + 1]
    : null;
  const completing = Boolean(state.workflowCompleting);
  const open = Boolean(state.workflowGateOpen);
  const quickActions = resolveCurrentStepQuickActions(state);

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
      open,
      quickActions
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
      open,
      quickActions
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
        related: true,
        state
      });
    }
    const nextGenerated = isStepGenerated(nextStep.id, state, { mainViewId: current?.id });
    const nextStale = isStepStale(nextStep.id, state, { mainViewId: current?.id });
    const baseLabel = stepShortLabel(nextStep);
    const capsuleAction = formatCapsuleAction(baseLabel, nextGenerated, nextStale);
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
      capsuleAction,
      nextGenerated,
      nextStale,
      isStale: nextGenerated && nextStale,
      quickActions,
      actionLabel: `进入${nextStep.label}`,
      headLabel: "当前步骤",
      headTitle: current.label,
      hint: nextGenerated && nextStale
        ? `上游步骤已更新，建议重新生成「${nextStep.label}」，或跳过保留旧版。`
        : nextGenerated
          ? `本阶段已就绪，「${nextStep.label}」已有成果，可直接跳过查看或重新生成。`
          : `本阶段已就绪，可直接进入「${nextStep.label}」。`,
      detailHtml: `<p class="workflow-gate-detail-note">下一页：${escapeHtml(nextStep.label)}（${escapeHtml(nextStep.phase || "")}）。</p>`
    };
  }

  const confirmationRelatedId = contextualFlowViewIds(current.id, state)[0] || "";
  const confirmationNextLabel = confirmationRelatedId ? relatedViewLabel(confirmationRelatedId) : (followingPhase || "交付完成");
  const targetStepId = confirmationRelatedId || nextStep?.id || "";
  const nextGenerated = targetStepId ? isStepGenerated(targetStepId, state, { mainViewId: current?.id }) : false;
  const nextStale = targetStepId ? isStepStale(targetStepId, state, { mainViewId: current?.id }) : false;
  let baseCapsuleAction = "确认完成";
  if (ready) {
    baseCapsuleAction = confirmationRelatedId ? relatedViewLabel(confirmationRelatedId) : (followingPhase ? stepShortLabel(nextStep) : "确认完成");
  } else {
    baseCapsuleAction = `待完成 ${incompleteReasons.length}`;
  }
  const capsuleAction = ready && targetStepId
    ? formatCapsuleAction(baseCapsuleAction, nextGenerated, nextStale)
    : baseCapsuleAction;

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
    capsuleAction,
    nextGenerated,
    nextStale,
    isStale: ready && nextGenerated && nextStale,
    quickActions,
    actionLabel: confirmationRelatedId ? `确认并进入${relatedViewLabel(confirmationRelatedId)}` : (followingPhase ? `确认并进入${followingPhase}` : "确认并完成工作流"),
    headLabel: "当前步骤",
    headTitle: current.phase || "",
    hint: ready
      ? (nextGenerated && nextStale
        ? `当前成果已就绪，但上游曾发生调整，建议重新生成下游成果；也可跳过直接查看。`
        : `当前成果已就绪，可直接进入${confirmationNextLabel}${confirmationRelatedId ? "（关联流程）" : ""}。`)
      : `尚需完成：${incompleteReasons.join("、")}。`,
    detailHtml: incompleteReasons.length
      ? `<ul class="workflow-gate-detail">${incompleteReasons.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : `<p class="workflow-gate-detail-note">可直接进入${escapeHtml(confirmationNextLabel)}${confirmationRelatedId ? "（关联流程）" : ""}。</p>`
  };
}

function buildAdvanceContext({ freeMode, current, nextStep, phaseIndex, completedThrough, followingPhase, completing, open, related = false, state = {} }) {
  const nextGenerated = isStepGenerated(nextStep.id, state, { mainViewId: nextStep.mainViewId || current?.id });
  const nextStale = isStepStale(nextStep.id, state, { mainViewId: nextStep.mainViewId || current?.id });
  const baseLabel = related ? relatedViewLabel(nextStep.id) : stepShortLabel(nextStep);
  const capsuleAction = formatCapsuleAction(baseLabel, nextGenerated, nextStale);
  const quickActions = resolveCurrentStepQuickActions(state);

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
    related: Boolean(related),
    action: "advance-workflow-step",
    capsuleTitle: "下一步",
    capsuleAction,
    nextGenerated,
    nextStale,
    isStale: nextGenerated && nextStale,
    quickActions,
    actionLabel: `进入${nextStep.label}`,
    headLabel: "当前步骤",
    headTitle: current.label,
    hint: nextGenerated && nextStale
      ? `上游步骤已更新，建议重新生成「${nextStep.label}」，或跳过保留旧版。`
      : nextGenerated
        ? `本阶段已确认，「${nextStep.label}」已有成果，可直接跳过查看或重新生成。`
        : related
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
  const nextGenerated = isStepGenerated(nextStep.id, state, { mainViewId: nextStep.mainViewId || current?.id });
  const nextStale = isStepStale(nextStep.id, state, { mainViewId: nextStep.mainViewId || current?.id });
  const baseLabel = nextStep.related ? relatedViewLabel(nextStep.id) : stepShortLabel(nextStep);
  const capsuleAction = formatCapsuleAction(baseLabel, nextGenerated, nextStale);
  const quickActions = resolveCurrentStepQuickActions(state);

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
    capsuleAction,
    nextGenerated,
    nextStale,
    isStale: nextGenerated && nextStale,
    quickActions,
    actionLabel: `进入${nextStep.label}`,
    headLabel: "当前关联步骤",
    headTitle: currentLabel,
    hint: nextGenerated && nextStale
      ? `上游内容有更新，建议重新生成“${nextStep.label}”，或直接跳过查看。`
      : nextGenerated
        ? `“${nextStep.label}”已就绪，可跳过直接查看成果，或重新生成。`
        : nextStep.related
          ? `继续关联流程，进入“${nextStep.label}”。`
          : `当前关联流程已走完，进入主流程“${nextStep.label}”。`,
    detailHtml: `<p class="workflow-gate-detail-note">下一项：${escapeHtml(nextStep.label)}${nextStep.related ? "（关联流程）" : "（主流程）"}。</p>`
  };
}

function renderWorkflowGateActions(ctx, completing) {
  if (ctx.mode === "complete-phase" && !ctx.ready) {
    return `<button type="button" data-action="${escapeHtml(ctx.action)}" ${completing ? "disabled" : ""}>${completing ? "正在确认…" : escapeHtml(ctx.actionLabel || "继续")}</button>`;
  }
  if (!ctx.nextStep && ctx.mode !== "complete-phase") {
    return `<button type="button" data-action="${escapeHtml(ctx.action)}" ${completing ? "disabled" : ""}>${completing ? "正在确认…" : escapeHtml(ctx.actionLabel || "继续")}</button>`;
  }

  const isCompletePhase = ctx.mode === "complete-phase";

  if (!ctx.nextGenerated) {
    return `<div class="workflow-gate-actions">
      <button type="button" data-action="advance-workflow-step-ai" ${completing ? "disabled" : ""}>${isCompletePhase ? "确认并AI生成进入" : "AI生成并进入"}</button>
      <button type="button" class="quiet-button" data-action="${escapeHtml(ctx.action)}" data-step-intent="direct" ${completing ? "disabled" : ""}>${isCompletePhase ? "确认并直接进入" : "直接进入"}</button>
    </div>`;
  }

  if (ctx.nextGenerated && !ctx.nextStale) {
    return `<div class="workflow-gate-actions">
      <button type="button" data-action="${escapeHtml(ctx.action)}" data-step-intent="skip" data-action-variant="skip" ${completing ? "disabled" : ""}>${isCompletePhase ? "确认并跳过（查看成果）" : "跳过（查看已有成果）"}</button>
      <button type="button" class="quiet-button" data-action="advance-workflow-step-regenerate" ${completing ? "disabled" : ""}>重新生成</button>
    </div>`;
  }

  return `<div class="workflow-gate-actions">
    <button type="button" data-action="advance-workflow-step-regenerate" ${completing ? "disabled" : ""}>重新生成（覆盖更新）</button>
    <button type="button" class="quiet-button" data-action="${escapeHtml(ctx.action)}" data-step-intent="skip" data-action-variant="skip" ${completing ? "disabled" : ""}>${isCompletePhase ? "确认并跳过（保留旧版）" : "跳过（保留旧版）"}</button>
  </div>`;
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
  const shellState = ctx.mode === "complete-phase" && !ready
    ? "is-pending"
    : (ctx.isStale ? "is-stale" : "is-ready");
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
      ${ctx.quickActions && ctx.quickActions.length ? `
        <div class="workflow-gate-quick-box" role="region" aria-label="快捷门禁">
          <div class="workflow-gate-quick-title">⚡ 快捷门禁放行</div>
          ${ctx.quickActions.map((qa) => `
            <div class="workflow-gate-quick-row">
              <button type="button" class="workflow-gate-quick-btn" data-action="${escapeHtml(qa.action)}">${escapeHtml(qa.label)}</button>
              <span class="workflow-gate-quick-hint">${escapeHtml(qa.hint)}</span>
            </div>
          `).join("")}
        </div>
      ` : ""}
      ${ctx.isStale ? `
        <div class="workflow-gate-stale-alert" role="status">
          <span class="workflow-gate-stale-icon">⚠️</span>
          <span>上游步骤内容已调整，下游成果已过期</span>
        </div>
      ` : ""}
      ${ctx.detailHtml || ""}
      <div class="workflow-actions">
        ${renderWorkflowGateActions(ctx, completing)}
      </div>
    </div>
    <button type="button" class="workflow-gate-capsule" data-action="toggle-workflow-gate" aria-expanded="${open ? "true" : "false"}" aria-controls="workflowGatePanel" title="${escapeHtml(title)}">
      <span class="workflow-gate-capsule-dot" aria-hidden="true"></span>
      <span class="workflow-gate-capsule-text"><b>${escapeHtml(ctx.capsuleTitle)}</b><em>${escapeHtml(ctx.capsuleAction)}</em></span>
      <span class="workflow-gate-capsule-chevron" aria-hidden="true"></span>
    </button>
  </div>`;
}
