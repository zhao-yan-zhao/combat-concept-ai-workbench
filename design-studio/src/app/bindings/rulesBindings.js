/**
 * Rules, Sequence, State Machine & OODA Event Bindings and Action Handlers.
 */
export function bindRulesEvents(ctx) {
  const { select, addEventListenerOnce } = ctx;

  document.querySelectorAll("[data-ooda]").forEach((button) => {
    addEventListenerOnce(button, "click", () => select("ooda", button.dataset.ooda), "ooda:click");
  });

  document.querySelectorAll("[data-ov6c-event]").forEach((button) => {
    addEventListenerOnce(button, "click", () => select("ov6c-event", button.dataset.ov6cEvent), "ov6c-event:click");
  });
}

export async function handleRulesAction(action, source, ctx) {
  const {
    state,
    render,
    showToast,
    $,
    getViewMeta,
    resolveRelatedMainViewId,
    resolveModelFocus,
    captureViewScroll,
    navigateToResearchView,
    ruleLibraryChatController,
    sequenceChatController,
    stateMachineChatController,
    dodafProductController
  } = ctx;

  if (action === "toggle-phase-action-chat") {
    if (!Array.isArray(state.phaseAction?.phases) || !state.phaseAction.phases.length) {
      showToast("请先生成阶段草案");
      return true;
    }
    state.phaseActionChatOpen = !state.phaseActionChatOpen;
    render();
    return true;
  }

  if (action === "close-phase-action-chat") {
    state.phaseActionChatOpen = false;
    render();
    return true;
  }

  if (action === "open-phase-action-chat") {
    if (!Array.isArray(state.phaseAction?.phases) || !state.phaseAction.phases.length) {
      showToast("请先生成阶段草案");
      return true;
    }
    state.phaseActionChatOpen = true;
    render();
    return true;
  }

  if (action === "ov6a-analyze-task-force-rules" || action === "ov6a-analyze-force-rules") {
    await ruleLibraryChatController.proposeChanges("force-mission", { silent: false });
    return true;
  }

  if (action === "ov6b-generate-task-force-machines" || action === "ov6b-generate-task-machines" || action === "ov6b-generate-force-machines") {
    await dodafProductController.pregenerateOv6bFromPhaseAction({ silent: false, contextType: "force-mission", force: true });
    return true;
  }

  if (action === "ov6c-generate-phase-sequences") {
    await dodafProductController.pregenerateOv6cFromPhase({ silent: false, contextType: "phase", force: true });
    return true;
  }

  if (action === "ov6c-generate-task-force-sequences" || action === "ov6c-generate-task-sequences" || action === "ov6c-generate-force-sequences") {
    await dodafProductController.pregenerateOv6cFromPhase({ silent: false, contextType: "force-mission", force: true });
    return true;
  }

  if (action === "toggle-rule-library-chat") {
    state.ruleLibraryChatOpen = !state.ruleLibraryChatOpen;
    if (state.ruleLibraryChatOpen) {
      ruleLibraryChatController.ensureWelcome(state.ov6a || {});
    }
    render();
    return true;
  }

  if (action === "close-rule-library-chat") {
    state.ruleLibraryChatOpen = false;
    render();
    return true;
  }

  if (action === "open-rule-library-chat") {
    state.ruleLibraryChatOpen = true;
    ruleLibraryChatController.ensureWelcome(state.ov6a || {});
    render();
    return true;
  }

  if (action === "toggle-sequence-chat") {
    state.ov6cToolsOpen = true;
    state.sequenceChatOpen = !state.sequenceChatOpen;
    if (state.sequenceChatOpen) {
      state.ov6cEditorOpen = false;
      sequenceChatController.ensureWelcome(state.ov6c || {});
    }
    render();
    return true;
  }

  if (action === "close-sequence-chat") {
    state.sequenceChatOpen = false;
    render();
    return true;
  }

  if (action === "open-sequence-chat") {
    state.ov6cToolsOpen = true;
    state.sequenceChatOpen = true;
    state.ov6cEditorOpen = false;
    sequenceChatController.ensureWelcome(state.ov6c || {});
    render();
    return true;
  }

  if (action === "toggle-state-machine-chat") {
    state.ov6bToolsOpen = true;
    state.stateMachineChatOpen = !state.stateMachineChatOpen;
    if (state.stateMachineChatOpen) {
      state.ov6bEditorOpen = false;
      stateMachineChatController.ensureWelcome(state.ov6b || {});
    }
    render();
    return true;
  }

  if (action === "close-state-machine-chat") {
    state.stateMachineChatOpen = false;
    render();
    return true;
  }

  if (action === "open-state-machine-chat") {
    state.ov6bToolsOpen = true;
    state.stateMachineChatOpen = true;
    state.ov6bEditorOpen = false;
    stateMachineChatController.ensureWelcome(state.ov6b || {});
    render();
    return true;
  }

  if (action === "workflow-gate-quick-apply-all-rules") {
    try {
      const resolved = dodafProductController.resolveDodafProduct(state, "ov6a");
      const model = resolved.model;
      const next = dodafProductController.applyRuleChangeSet(model, model.ruleChangeSet, "");
      const hasPending = (next.ruleChangeSet?.changes || []).some((item) => item.status === "pending");
      if (!hasPending && Array.isArray(next.rules) && next.rules.length > 0) {
        next.status = "confirmed";
        next.confirmedAt = next.confirmedAt || new Date().toISOString();
      }
      dodafProductController.persistOv6("ov6a", next, "已采纳全部待审核规则");
      showToast("已采纳全部规则变更并覆盖");
    } catch (e) {
      showToast(e?.message || "规则采纳失败");
    }
    render();
    return true;
  }

  if (action === "view-ov6a" || action === "view-ov6b" || action === "view-ov6c") {
    const targetView = action.replace("view-", "");
    const mainViewId = resolveRelatedMainViewId(state.activeView, targetView, state.relatedModelReturnContext) || state.activeView;
    const focus = resolveModelFocus(mainViewId, state);
    state.relatedModelReturnContext = {
      mainViewId,
      mainLabel: getViewMeta(mainViewId)?.label || "作战任务",
      relatedViewId: targetView,
      focusType: focus.focusType || "",
      focusId: focus.focusId || "",
      focusLabel: focus.focusLabel || "",
      selection: state.selection ? { ...state.selection } : null,
      scrollSnapshots: captureViewScroll ? captureViewScroll($("#viewRoot")) : []
    };
    void navigateToResearchView(targetView, { entrySource: mainViewId });
    return true;
  }

  return false;
}
