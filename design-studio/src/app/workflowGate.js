import { productShortLabel, views, workflowPhases, workflowPrimaryStepIds } from "../data.js";
import { forceMissionPlanIncompleteReasons } from "../forceMissionStore.js";
import { phaseActionConceptIncompleteReasons } from "../phaseActionStore.js";
import { isValidationStale } from "../validationStore.js";
import { escapeHtml } from "./domUtils.js";

export function currentWorkflow(state, project) {
  const workflow = state.projectDirectory.projects.find((item) => item.id === state.activeProjectId)?.workflow
    || { completedThrough: -1 };
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
  const value = Number(workflow?.completedThrough ?? -1);
  if (!Number.isFinite(value)) return -1;
  return Math.max(-1, Math.min(workflowPhases.length - 1, Math.trunc(value)));
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
 * Check pages (rules/state/events, OV-2/3/4, activity tree, structure review) do not block stage confirm.
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
  // 阶段行动：强门禁 = 阶段与行动；04 正式规则/状态/事件为弱校验
  if (stage === 1) {
    return [
      ...phaseActionConceptIncompleteReasons(state.phaseAction, state.phaseActionStorage)
    ].filter(Boolean);
  }
  // 兵力任务：强门禁 = 兵力与任务；责任/资源流为弱校验
  if (stage === 2) {
    return [
      ...forceMissionPlanIncompleteReasons(state.forceMission, state.forceMissionStorage)
    ].filter(Boolean);
  }
  // 概念图：强门禁 = 概念图 + 高层概念图 + 活动模型 + 研究循环
  if (stage === 3) {
    return [
      !state.conceptMap?.document?.items?.length && "概念图对象或标绘",
      state.conceptMap?.reference?.status !== "confirmed" && "确认概念图研究参考",
      state.conceptMapStorage?.stale && "复核已过期的概念图",
      !state.ov1?.nodes?.length && "高层作战概念图节点",
      !state.ov5?.activities?.length && "作战活动",
      !state.ov5?.edges?.length && "作战活动关系",
      !state.ooda?.lanes?.some((lane) => lane.nodes?.length) && "研究辅助循环"
    ].filter(Boolean);
  }
  // 推演演示：强门禁 = 想定 + 验证；协同/报告为弱交付
  if (stage === 4) {
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
  let index = steps.findIndex((step) => step.id === state.activeView);
  if (index < 0) {
    // Derived side product: treat as its stage's last primary step for gate intent.
    const active = views.find((view) => view.id === state.activeView);
    const phaseIndex = workflowPhases.indexOf(active?.phase);
    if (phaseIndex >= 0) {
      const stageSteps = steps
        .map((step, stepIndex) => ({ step, stepIndex }))
        .filter(({ step }) => workflowPhases.indexOf(step.phase) === phaseIndex);
      index = stageSteps.length ? stageSteps[stageSteps.length - 1].stepIndex : -1;
    }
  }
  if (index < 0) {
    index = Math.max(0, steps.findIndex((step) => {
      const phaseIndex = workflowPhases.indexOf(step.phase);
      return phaseIndex === nextWorkflowStage(workflow);
    }));
  }
  if (index < 0) index = 0;

  const current = steps[index] || steps[0];
  const nextStep = steps[index + 1] || null;
  const phaseIndex = workflowPhases.indexOf(current?.phase);
  const isLastInPhase = Boolean(current) && (!nextStep || nextStep.phase !== current.phase);
  const phaseDone = phaseIndex >= 0 && phaseIndex <= completedThrough;
  const incompleteReasons = phaseIndex >= 0 ? getWorkflowStageIncompleteReasons(state, phaseIndex) : [];
  const ready = incompleteReasons.length === 0;
  const followingPhase = phaseIndex >= 0 && phaseIndex < workflowPhases.length - 1
    ? workflowPhases[phaseIndex + 1]
    : null;
  const completing = Boolean(state.workflowCompleting);
  const open = Boolean(state.workflowGateOpen);

  // The phase loop revisits the rule library without duplicating it in the
  // canonical navigation order. Present the actual human-review route here.
  if (state.activeView === "phase-action" && Array.isArray(state.phaseAction?.phases) && state.phaseAction.phases.length > 0) {
    const reviewStep = { id: "ov6a", label: "规则库审核", phase: current?.phase || "" };
    return {
      freeMode: false,
      mode: "next-step",
      current,
      nextStep: reviewStep,
      isLastInPhase: false,
      phaseIndex,
      completedThrough,
      incompleteReasons: [],
      ready: true,
      followingPhase,
      completing,
      open,
      action: "advance-workflow-step",
      capsuleTitle: "下一步",
      capsuleAction: "规则库审核",
      actionLabel: "生成阶段规则并进入审核",
      headLabel: "当前步骤",
      headTitle: current.label,
      hint: "AI 将根据阶段与行动生成规则建议，随后由你逐项审核。",
      detailHtml: "<p class=\"workflow-gate-detail-note\">生成结果不会直接覆盖规则库；进入规则库后可逐项采纳或忽略。</p>"
    };
  }

  const phaseRuleChanges = state.ov6a?.ruleChangeSet;
  if (state.activeView === "ov6a" && state.ruleLibraryEntrySource === "phase-action") {
    const pendingCount = (phaseRuleChanges.changes || []).filter((change) => change.status === "pending").length;
    const stateMachineStep = { id: "ov6b", label: "状态机校验", phase: current?.phase || "" };
    return {
      freeMode: false,
      mode: "next-step",
      current,
      nextStep: stateMachineStep,
      isLastInPhase: false,
      phaseIndex,
      completedThrough,
      incompleteReasons: pendingCount ? [`${pendingCount} 项阶段规则建议待处理`] : [],
      ready: pendingCount === 0,
      followingPhase,
      completing,
      open,
      action: "advance-workflow-step",
      capsuleTitle: "下一步",
      capsuleAction: pendingCount ? `待审核 ${pendingCount}` : "状态机校验",
      actionLabel: pendingCount ? "处理待审核建议" : "生成并进入状态机",
      headLabel: "规则审核",
      headTitle: pendingCount ? "尚未完成" : "已完成",
      hint: pendingCount ? "请先采纳或忽略全部阶段规则建议。" : "AI 将根据阶段、行动与已审核规则生成状态机。",
      detailHtml: pendingCount
        ? `<p class="workflow-gate-detail-note">还有 ${pendingCount} 项建议未处理；规则版本明确后才能生成状态机。</p>`
        : "<p class=\"workflow-gate-detail-note\">点击后显示生成动画，并在完成后进入状态机校验。</p>"
    };
  }

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

  const allDone = completedThrough >= workflowPhases.length - 1 && isLastInPhase && !nextStep;
  if (allDone || (!nextStep && phaseDone)) {
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

  // Mid-stage: capsule advances one primary research step.
  if (!isLastInPhase && nextStep) {
    return {
      freeMode: false,
      mode: "next-step",
      current,
      nextStep,
      isLastInPhase: false,
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
      hint: `进入本阶段下一步：${nextStep.label}。`,
      detailHtml: `<p class="workflow-gate-detail-note">当前「${escapeHtml(current.label)}」。确认后进入「${escapeHtml(nextStep.label)}」，完成本阶段全部主步骤后再解锁下一阶段。</p>`
    };
  }

  // Last step of a stage that is already confirmed → walk into next stage's first step.
  if (phaseDone && nextStep) {
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

  // Last step of the active stage → confirm and unlock the next stage.
  const nextPhaseLabel = followingPhase || "交付完成";
  const sequenceToForce = state.activeView === "ov6c" && nextStep?.id === "operational-task";
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
    capsuleTitle: sequenceToForce ? "下一步" : (current.phase || "当前阶段"),
    capsuleAction: ready ? (sequenceToForce ? "作战任务" : "确认进入") : `待完成 ${incompleteReasons.length}`,
    actionLabel: sequenceToForce
      ? "确认阶段行动并进入作战任务"
      : (followingPhase ? `确认并进入${followingPhase}` : "确认并完成工作流"),
    headLabel: "当前阶段",
    headTitle: current.phase || "",
    hint: ready
      ? (sequenceToForce ? "时序校验完成后，确认阶段行动并进入作战任务。" : `本阶段最后一步已就绪，确认后进入${nextPhaseLabel}。`)
      : `尚需完成：${incompleteReasons.join("、")}。点击确认可查看提示。`,
    detailHtml: incompleteReasons.length
      ? `<ul class="workflow-gate-detail">${incompleteReasons.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : `<p class="workflow-gate-detail-note">确认后将解锁下一阶段研究路径。</p>`
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
