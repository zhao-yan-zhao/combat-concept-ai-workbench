/**
 * Force & Mission Event Bindings and Action Handlers.
 */
export function bindForceMissionEvents(ctx) {
  const { select, addEventListenerOnce } = ctx;

  document.querySelectorAll("[data-unit]").forEach((button) => {
    addEventListenerOnce(button, "click", () => select("unit", button.dataset.unit), "unit:click");
  });
}

export async function handleForceMissionAction(action, source, ctx) {
  const {
    state,
    render,
    showToast,
    navigateToResearchView,
    conceptPlanningController,
    refreshWorkflowGateUi,
    dodafProductController
  } = ctx;

  if (action === "toggle-force-mission-chat") {
    const hasDraft = (Array.isArray(state.forceMission?.forces) && state.forceMission.forces.length > 0)
      || (Array.isArray(state.forceMission?.combatForces) && state.forceMission.combatForces.length > 0);
    if (!hasDraft) {
      showToast("请先生成兵力与任务草案");
      return true;
    }
    state.forceMissionChatOpen = !state.forceMissionChatOpen;
    render();
    return true;
  }

  if (action === "close-force-mission-chat") {
    state.forceMissionChatOpen = false;
    render();
    return true;
  }

  if (action === "open-force-mission-chat") {
    const hasDraft = (Array.isArray(state.forceMission?.forces) && state.forceMission.forces.length > 0)
      || (Array.isArray(state.forceMission?.combatForces) && state.forceMission.combatForces.length > 0);
    if (!hasDraft) {
      showToast("请先生成兵力与任务草案");
      return true;
    }
    state.forceMissionChatOpen = true;
    render();
    return true;
  }

  if (action === "return-force-mission") {
    void navigateToResearchView("force-mission", { toast: "返回作战兵力" });
    return true;
  }

  if (action === "workflow-gate-quick-confirm-operational-tasks") {
    try {
      await conceptPlanningController.confirmOperationalTasks();
      showToast("已确认作战任务");
    } catch (e) {
      showToast(e?.message || "确认作战任务失败");
    }
    refreshWorkflowGateUi();
    return true;
  }

  if (action === "workflow-gate-quick-confirm-force-mission") {
    try {
      await conceptPlanningController.confirmForceMission();
      showToast("已确认作战兵力");
    } catch (e) {
      showToast(e?.message || "确认作战兵力失败");
    }
    refreshWorkflowGateUi();
    return true;
  }

  return false;
}
