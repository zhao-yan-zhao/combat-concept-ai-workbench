import { resolveWorkflowGateContext } from "../workflowGate.js";
import { getViewMeta } from "../../ui.js";

/**
 * Ask confirmation before regenerating steps that might overwrite downstream data.
 */
export function confirmRegenerateWorkflowStep(context) {
  if (typeof window === "undefined" || typeof window.confirm !== "function") return true;
  const nextStep = context?.nextStep;
  const nextLabel = nextStep?.label || "下一步";
  const mainViewId = nextStep?.mainViewId || context?.mainViewId || "";

  if (nextStep?.related || context?.mode === "related-next-step") {
    if (mainViewId === "operational-task") {
      if (nextStep?.id === "ov6c") {
        return window.confirm("重新生成将更新「逐任务时序图」（保留阶段时序与兵力协同时序，不影响其他流程成果），是否继续？");
      }
      if (nextStep?.id === "ov6b") {
        return window.confirm("重新生成将更新「逐任务状态机」（保留阶段状态机与兵力状态机，不影响其他流程成果），是否继续？");
      }
      if (nextStep?.id === "ov6a") {
        return window.confirm("重新生成将基于作战任务更新规则建议（保留全局阶段规则与兵力规则），是否继续？");
      }
      if (nextStep?.id === "ov1b") {
        return window.confirm("重新生成将基于最新任务重新编组（不影响其他模型成果），是否继续？");
      }
    } else if (mainViewId === "force-mission") {
      if (nextStep?.id === "ov4") {
        return window.confirm("重新生成将更新「组织关系图」（根据最新作战兵力重新推导指挥、保障与信息关系，不影响其他流程成果），是否继续？");
      }
      if (nextStep?.id === "ov2") {
        return window.confirm("重新生成将更新「作战资源流」（根据最新作战兵力与组织关系重新推导资源流，不影响其他流程成果），是否继续？");
      }
      if (nextStep?.id === "ov3") {
        return window.confirm("重新生成将更新「作战资源流矩阵」（根据最新作战资源流重新投影矩阵事实，不影响其他流程成果），是否继续？");
      }
      if (nextStep?.id === "ov6c") {
        return window.confirm("重新生成将更新「任务与兵力时序图」（保留阶段时序，不影响其他流程成果），是否继续？");
      }
      if (nextStep?.id === "ov6b") {
        return window.confirm("重新生成将更新「任务与兵力状态机」（保留阶段状态机，不影响其他流程成果），是否继续？");
      }
      if (nextStep?.id === "ov6a") {
        return window.confirm("重新生成将基于作战任务与作战兵力更新规则建议（保留全局阶段规则），是否继续？");
      }
    } else if (mainViewId === "phase-action") {
      if (nextStep?.id === "ov6c") {
        return window.confirm("重新生成将更新「阶段时序图」（保留任务与兵力时序，不影响其他流程成果），是否继续？");
      }
      if (nextStep?.id === "ov6b") {
        return window.confirm("重新生成将更新「阶段状态机」（保留任务与兵力状态机，不影响其他流程成果），是否继续？");
      }
    }
    return window.confirm(`重新生成将更新当前流程关联的「${nextLabel}」（保留其他流程模型），是否继续？`);
  }

  return window.confirm(`重新生成将基于最新上游上下文覆盖「${nextLabel}」当前已有成果，是否继续？`);
}

/**
 * Handle workflow progression, regeneration confirmation, and subflow toolboxes.
 */
export async function handleWorkflowAction(action, source, ctx) {
  const {
    state,
    render,
    showToast,
    advanceWorkflowStep,
    advanceRelatedWorkflow,
    completeWorkflowStage,
    conceptPlanningController,
    conceptMapController,
    dodafProductController,
    refreshWorkflowGateUi
  } = ctx;

  if (action === "advance-workflow-step") {
    const intent = source?.dataset?.stepIntent;
    const isRegenerate = intent === "regenerate" || source?.dataset?.actionVariant === "regenerate";
    if (isRegenerate) {
      const context = resolveWorkflowGateContext(state);
      if (!confirmRegenerateWorkflowStep(context)) return true;
    }
    void advanceWorkflowStep({ generate: intent === "ai" || isRegenerate, forceRegenerate: isRegenerate });
    return true;
  }
  if (action === "advance-workflow-step-ai") {
    const context = resolveWorkflowGateContext(state);
    if (context.mode === "complete-phase") {
      void completeWorkflowStage({ generate: true });
    } else if (context.mode === "related-next-step") {
      void advanceRelatedWorkflow({ generate: true });
    } else {
      void advanceWorkflowStep({ generate: true });
    }
    return true;
  }
  if (action === "advance-workflow-step-direct" || action === "advance-workflow-step-skip") {
    const context = resolveWorkflowGateContext(state);
    if (context.mode === "complete-phase") {
      void completeWorkflowStage({ generate: false });
    } else if (context.mode === "related-next-step") {
      void advanceRelatedWorkflow({ generate: false });
    } else {
      void advanceWorkflowStep({ generate: false });
    }
    return true;
  }
  if (action === "advance-workflow-step-regenerate") {
    const context = resolveWorkflowGateContext(state);
    if (confirmRegenerateWorkflowStep(context)) {
      if (context.mode === "complete-phase") {
        void completeWorkflowStage({ generate: true, forceRegenerate: true });
      } else if (context.mode === "related-next-step") {
        void advanceRelatedWorkflow({ generate: true, forceRegenerate: true });
      } else {
        void advanceWorkflowStep({ generate: true, forceRegenerate: true });
      }
    }
    return true;
  }
  if (action === "workflow-gate-quick-confirm-phase-action") {
    try {
      await conceptPlanningController.confirmPhaseAction();
      showToast("已确认阶段与行动");
    } catch (e) {
      showToast(e?.message || "确认阶段与行动失败");
    }
    refreshWorkflowGateUi();
    return true;
  }
  if (action === "workflow-gate-quick-confirm-concept-map") {
    try {
      conceptMapController.handleAction("confirm-concept-map-step");
      showToast("已确认概念图参考");
    } catch (e) {
      showToast(e?.message || "确认概念图参考失败");
    }
    refreshWorkflowGateUi();
    return true;
  }
  if (action === "advance-workflow") {
    const context = resolveWorkflowGateContext(state);
    void (context.mode === "related-next-step" ? advanceRelatedWorkflow({ generate: false }) : advanceWorkflowStep({ generate: false }));
    return true;
  }
  if (action === "toggle-subflow-toolbox") {
    state.subflowToolboxOpen = {
      ...(state.subflowToolboxOpen || {}),
      [state.activeView]: state.subflowToolboxOpen?.[state.activeView] !== true
    };
    render();
    return true;
  }
  if (action === "toggle-ov1b-add") {
    state.ov1bAddOpen = state.ov1bAddOpen !== true;
    if (state.ov1bAddOpen) {
      state.subflowToolboxOpen = { ...(state.subflowToolboxOpen || {}), ov1b: true };
    }
    render();
    return true;
  }
  if (action === "close-ov1b-dock") {
    state.ov1bAddOpen = false;
    render();
    return true;
  }
  if (action === "open-subflow-ai") {
    if (state.activeView === "ov4") {
      const hasOrganization = Boolean((state.ov4?.relations || []).length);
      if (hasOrganization && !window.confirm("将用 AI 重新生成组织关系，覆盖当前内容。是否继续？")) return true;
      void dodafProductController.pregenerateOv4FromForceMission({ silent: false, force: true });
      return true;
    }
    if (state.activeView === "ov2") {
      const hasExchanges = Boolean((state.ov2?.exchanges || []).length);
      if (hasExchanges && !window.confirm("将用 AI 重新生成作战资源流，覆盖当前内容。是否继续？")) return true;
      void dodafProductController.pregenerateOv2FromForceAndOv4({ silent: false, force: true });
      return true;
    }
    if (state.activeView === "ov3") {
      void dodafProductController.pregenerateOv3FromOv2({ silent: false, force: true });
      return true;
    }
    if (state.activeView === "ov6c") {
      const isPhaseSubflow = state.activeMainViewId === "phase-action";
      const contextType = isPhaseSubflow ? "phase" : "force-mission";
      void dodafProductController.pregenerateOv6cFromPhase({ silent: false, contextType, force: true });
      return true;
    }
    showToast(`${getViewMeta(state.activeView)?.label || "当前子流程"}的 AI 工具已就绪；请先确认上游内容，再让 AI 生成或检查本页草案。`);
    return true;
  }
  if (action === "toggle-ov1b-edit") {
    state.ov1bEditOpen = state.ov1bEditOpen !== true;
    render();
    return true;
  }
  if (action === "advance-related-workflow") {
    const intent = source?.dataset?.stepIntent;
    const isRegenerate = intent === "regenerate" || source?.dataset?.actionVariant === "regenerate";
    if (isRegenerate) {
      const context = resolveWorkflowGateContext(state);
      if (!confirmRegenerateWorkflowStep(context)) return true;
    }
    void advanceRelatedWorkflow({ generate: intent === "ai" || isRegenerate, forceRegenerate: isRegenerate });
    return true;
  }
  if (action === "complete-workflow-stage") {
    const intent = source?.dataset?.stepIntent;
    const isRegenerate = intent === "regenerate" || source?.dataset?.actionVariant === "regenerate";
    if (isRegenerate) {
      const context = resolveWorkflowGateContext(state);
      if (!confirmRegenerateWorkflowStep(context)) return true;
    }
    void completeWorkflowStage({ generate: intent === "ai" || isRegenerate, forceRegenerate: isRegenerate });
    return true;
  }
  return false;
}
