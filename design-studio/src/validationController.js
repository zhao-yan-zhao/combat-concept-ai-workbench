import { generateValidation } from "./validationStore.js";

export function createValidationController({ getState, render, notify, syncValidation }) {
  return {
    handleAction(action) {
      if (action !== "run-validation") return false;
      const state = getState();
      state.validationResult = generateValidation(state.ov5, state.ooda, state.scenario, state.ov1);
      state.redTeamRunning = false;
      state.selection = null;
      void syncValidation?.(state.validationResult, { source: "rule-validation" });
      notify(`设计验证完成，发现 ${state.validationResult.issues.length} 项待处理问题`);
      render();
      return true;
    }
  };
}
