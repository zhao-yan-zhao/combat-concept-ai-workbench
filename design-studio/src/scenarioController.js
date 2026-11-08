import { generateWithAi, isAiOutput } from "../../shared/aiClient.js";
import { generateScenario, recommendScenarioDeployment } from "./scenarioStore.js";
import {
  normalizeWargameState,
  submitTurnIntent,
  injectEventToTurn,
  removeEventFromTurn,
  saveTurnAdjudication,
  advanceToNextTurn,
  addCustomEventCard,
  generateLocalAdjudicationAdvice
} from "./wargameTurnStore.js";
import { requestWargameAdjudication } from "./wargameClient.js";

export function createScenarioController({ getState, render, notify, invalidateValidation, syncScenario }) {
  function ensureScenarioInitialized(state) {
    if (!state.scenario) {
      state.scenario = generateScenario(state);
    }
  }

  return {
    compileOrGenerateScenario,

    handleAction(action, source) {
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

      if (action === "select-wargame-turn") {
        const turnNum = Number(source?.dataset?.turnNumber) || 1;
        state.wargameCurrentTurnIndex = turnNum;
        render();
        return true;
      }

      if (action === "save-wargame-intent") {
        ensureScenarioInitialized(state);
        const turnNum = Number(source?.dataset?.turnNumber) || state.wargameCurrentTurnIndex || 1;
        const redText = document.getElementById("wargameRedIntent")?.value || "";
        const blueText = document.getElementById("wargameBlueIntent")?.value || "";
        const redRefs = Array.from(document.querySelectorAll("input[name='redActivityRefs']:checked")).map((el) => el.value);
        const blueRefs = Array.from(document.querySelectorAll("input[name='blueActivityRefs']:checked")).map((el) => el.value);

        let w = normalizeWargameState(state.scenario.wargame, { phases: state.phaseAction?.phases });
        w = submitTurnIntent(w, turnNum, "red", { text: redText, activityRefs: redRefs });
        w = submitTurnIntent(w, turnNum, "blue", { text: blueText, activityRefs: blueRefs });
        state.scenario.wargame = w;
        void syncScenario?.(state.scenario, { source: "wargame-intent" });
        notify(`第 ${turnNum} 回合红蓝作战概念意图已保存`);
        render();
        return true;
      }

      if (action === "inject-wargame-card") {
        ensureScenarioInitialized(state);
        const turnNum = Number(source?.dataset?.turnNumber) || state.wargameCurrentTurnIndex || 1;
        const cardId = source?.dataset?.cardId;
        let w = normalizeWargameState(state.scenario.wargame, { phases: state.phaseAction?.phases });
        const card = w.eventCardLibrary.find((c) => c.id === cardId);
        if (card) {
          w = injectEventToTurn(w, turnNum, card);
          state.scenario.wargame = w;
          void syncScenario?.(state.scenario, { source: "wargame-event" });
          notify(`已向第 ${turnNum} 回合注入事件：${card.title}`);
          render();
        }
        return true;
      }

      if (action === "remove-wargame-event") {
        ensureScenarioInitialized(state);
        const turnNum = Number(source?.dataset?.turnNumber) || state.wargameCurrentTurnIndex || 1;
        const injId = source?.dataset?.injectionId;
        let w = normalizeWargameState(state.scenario.wargame, { phases: state.phaseAction?.phases });
        w = removeEventFromTurn(w, turnNum, injId);
        state.scenario.wargame = w;
        void syncScenario?.(state.scenario, { source: "wargame-event" });
        notify(`已撤回第 ${turnNum} 回合的导调事件`);
        render();
        return true;
      }

      if (action === "add-custom-wargame-card") {
        ensureScenarioInitialized(state);
        const turnNum = Number(source?.dataset?.turnNumber) || state.wargameCurrentTurnIndex || 1;
        const title = document.getElementById("customCardTitle")?.value?.trim();
        const category = document.getElementById("customCardCategory")?.value?.trim() || "自定义战场扰动";
        const detail = document.getElementById("customCardDetail")?.value?.trim() || "";

        if (!title) {
          notify("请输入自定义事件标题");
          return true;
        }

        let w = normalizeWargameState(state.scenario.wargame, { phases: state.phaseAction?.phases });
        const customCard = { title, category, detail, suggestedImpact: detail.slice(0, 50) };
        w = addCustomEventCard(w, customCard);
        const added = w.eventCardLibrary[w.eventCardLibrary.length - 1];
        w = injectEventToTurn(w, turnNum, added);
        state.scenario.wargame = w;
        void syncScenario?.(state.scenario, { source: "wargame-event" });
        notify(`已添加并注入自定义事件：${title}`);
        render();
        return true;
      }

      if (action === "request-wargame-adjudication-advice") {
        ensureScenarioInitialized(state);
        const turnNum = Number(source?.dataset?.turnNumber) || state.wargameCurrentTurnIndex || 1;
        let w = normalizeWargameState(state.scenario.wargame, { phases: state.phaseAction?.phases });
        const targetTurn = w.turns.find((t) => t.turnNumber === turnNum);
        if (!targetTurn) return true;

        notify("正在推导演练导调裁决建议…");
        void (async () => {
          try {
            const adviceResult = await requestWargameAdjudication({
              turn: targetTurn,
              brief: state.brief
            });
            if (!targetTurn.adjudication) {
              targetTurn.adjudication = {};
            }
            targetTurn.adjudication.aiAdvice = adviceResult?.aiAdvice || adviceResult?.outcome || "建议保持态势均衡";
            if (!targetTurn.adjudication.outcome && adviceResult?.outcome) {
              targetTurn.adjudication.outcome = adviceResult.outcome;
            }
            if (!targetTurn.adjudication.rationale && adviceResult?.rationale) {
              targetTurn.adjudication.rationale = adviceResult.rationale;
            }
            state.scenario.wargame = w;
            void syncScenario?.(state.scenario, { source: "wargame-advice" });
            notify("已获取导调裁决建议！");
            render();
          } catch (err) {
            notify(`获取导调建议失败：${err.message}`);
          }
        })();
        return true;
      }

      if (action === "adopt-wargame-advice") {
        const turnNum = Number(source?.dataset?.turnNumber) || state.wargameCurrentTurnIndex || 1;
        let w = normalizeWargameState(state.scenario.wargame, { phases: state.phaseAction?.phases });
        const targetTurn = w.turns.find((t) => t.turnNumber === turnNum);
        if (targetTurn?.adjudication?.aiAdvice) {
          const outcomeEl = document.getElementById("wargameOutcome");
          const rationaleEl = document.getElementById("wargameRationale");
          if (outcomeEl && !outcomeEl.value) {
            outcomeEl.value = targetTurn.adjudication.outcome || targetTurn.adjudication.aiAdvice.slice(0, 40);
          }
          if (rationaleEl && !rationaleEl.value) {
            rationaleEl.value = targetTurn.adjudication.rationale || targetTurn.adjudication.aiAdvice;
          }
          notify("已采纳导调建议到裁决输入框");
        }
        return true;
      }

      if (action === "save-wargame-adjudication") {
        ensureScenarioInitialized(state);
        const turnNum = Number(source?.dataset?.turnNumber) || state.wargameCurrentTurnIndex || 1;
        const outcome = document.getElementById("wargameOutcome")?.value?.trim() || "";
        const rationale = document.getElementById("wargameRationale")?.value?.trim() || "";

        if (!outcome) {
          notify("裁决结论不得为空，请简要阐述本回合胜负态势");
          return true;
        }

        let w = normalizeWargameState(state.scenario.wargame, { phases: state.phaseAction?.phases });
        w = saveTurnAdjudication(w, turnNum, { outcome, rationale });
        state.scenario.wargame = w;
        void syncScenario?.(state.scenario, { source: "wargame-adjudication" });
        notify(`第 ${turnNum} 回合裁决已保存并闭环！`);
        render();
        return true;
      }

      if (action === "advance-wargame-turn") {
        ensureScenarioInitialized(state);
        try {
          let w = normalizeWargameState(state.scenario.wargame, { phases: state.phaseAction?.phases });
          w = advanceToNextTurn(w, { phases: state.phaseAction?.phases });
          state.scenario.wargame = w;
          state.wargameCurrentTurnIndex = w.turns.length;
          void syncScenario?.(state.scenario, { source: "wargame-advance" });
          notify(`已推进进入第 ${w.turns.length} 回合推演！`);
          render();
        } catch (err) {
          notify(`无法推进：${err.message}`);
        }
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
