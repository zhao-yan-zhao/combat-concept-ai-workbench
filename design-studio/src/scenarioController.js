import { generateScenario, recommendScenarioDeployment } from "./scenarioStore.js";

export function createScenarioController({ getState, render, notify, invalidateValidation, syncScenario }) {
  return {
    handleAction(action) {
      const state = getState();
      if (action === "generate-scenario") {
        state.scenario = generateScenario(state.ov5, state.ooda);
        invalidateValidation();
        void syncScenario?.(state.scenario, { source: "generated" });
        state.selection = null;
        notify("已从当前 OV-5/OODA 生成初始想定");
        render();
        return true;
      }
      if (action === "recommend-deployment" && state.scenario) {
        state.scenario = recommendScenarioDeployment(state.scenario);
        invalidateValidation();
        void syncScenario?.(state.scenario, { source: "deployment-planner" });
        state.selection = null;
        notify("已生成抽象网格部署建议，请在推送部署图前复核约束诊断");
        render();
        return true;
      }
      return false;
    }
  };
}
