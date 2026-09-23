import { generateWithAi, isAiOutput } from "../../shared/aiClient.js";
import { generateScenario, recommendScenarioDeployment } from "./scenarioStore.js";

export function createScenarioController({ getState, render, notify, invalidateValidation, syncScenario }) {
  return {
    compileOrGenerateScenario,

    handleAction(action) {
      const state = getState();
      if (action === "generate-scenario") {
        void compileOrGenerateScenario({ silent: false, forceAi: true });
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

  async function compileOrGenerateScenario({ silent = false, forceAi = true } = {}) {
    const state = getState();
    if (state.scenarioGenerating) return state.scenario;
    state.scenarioGenerating = true;
    render();

    const phases = state.phaseAction?.phases || [];
    const tasks = state.forceMission?.tasks || [];
    const combatForces = state.forceMission?.combatForces || [];
    const forces = state.forceMission?.forces || [];

    let aiDraft = null;
    if (forceAi) {
      try {
        const analysis = {
          "研究目标": state.brief?.objective || "作战概念研究目标",
          "核心思路": state.brief?.approach || "作战机制与思路",
          "阶段时序": phases.map((p) => ({ 阶段名: p.name, 时窗: p.timeWindow, 蓝方行动: p.blueActions || p.primaryActions, 红方行动: p.redActions || p.secondaryActions, 转换条件: p.exitConditions })),
          "任务与区域": tasks.map((t) => ({ 任务名: t.name, 阵营: t.side, 任务类型: t.missionType, 区域: t.area?.name, 区域类型: t.area?.type, 任务目标: t.objective })),
          "兵力与实装编成": (combatForces.length ? combatForces : forces).map((f) => ({ 编组名称: f.name, 阵营: f.side, 角色: f.role, 平台型号: f.platforms?.[0]?.name || "标准装备", 数量: f.platforms?.[0]?.quantity || 1, 任务: f.task }))
        };

        const response = await generateWithAi({
          workflowId: "scenario",
          workflow: { id: "scenario", title: "仿真推演想定生成", outputSchema: "ScenarioDraft" },
          analysis,
          evidence: []
        });

        if (isAiOutput(response) && response.result) {
          aiDraft = response.result;
        }
      } catch {
        /* fallback to deterministic compilation */
      }
    }

    try {
      state.scenario = generateScenario(state, null, { draft: aiDraft, mode: aiDraft ? "ai" : "compiled" });
      invalidateValidation();
      await syncScenario?.(state.scenario, { source: aiDraft ? "ai" : "compiled" });
      state.selection = null;
      if (!silent) {
        const count = state.scenario.entities?.length || 0;
        const eventCount = state.scenario.timeline?.length || 0;
        notify(aiDraft
          ? `AI 已编译全要素仿真想定（${count} 个红蓝推演实体、${eventCount} 个阶段事件序列），请复核`
          : `已全要素编译生成仿真想定（${count} 个推演实体、${eventCount} 个阶段事件序列），请复核`);
      }
      return state.scenario;
    } catch (error) {
      if (!silent) notify(`想定生成失败：${error.message || "未知错误"}`);
      return null;
    } finally {
      state.scenarioGenerating = false;
      render();
    }
  }
}
