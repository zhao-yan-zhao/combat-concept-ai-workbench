import { generateWithAi, isAiOutput } from "../../shared/aiClient.js";
import { applyAiOodaDraft, createLocalOodaDraft } from "./oodaDraftStore.js";
import { selectEvidenceForAi } from "./evidenceSelectionStore.js";
import { persistOodaModel } from "./oodaStore.js";
import { planningAnalysisForDownstream } from "./planningContext.js";

export function createOodaAiController({ getState, render, notify, invalidateDerivedArtifacts, syncOoda }) {
  return {
    handleAction(action) {
      if (action !== "generate-ooda") return false;
      const state = getState();
      if (state.oodaGenerating) return true;
      if (state.ooda?.lanes?.some((lane) => lane.nodes.length) && !window.confirm("将根据当前活动模型与已确认规划重新生成研究循环 行为说明和规则。已有研究循环的人工编辑会被替换。是否继续？")) return true;
      void generateOoda(state);
      return true;
    }
  };

  async function generateOoda(state) {
    state.oodaGenerating = true;
    render();
    const evidenceSelection = await selectEvidenceForAi({
      query: `${state.brief?.objective || ""} ${state.brief?.risk || ""}`,
      knowledge: state.knowledge,
      knowledgeStorage: state.knowledgeStorage,
      limit: 3
    });
    const evidence = evidenceSelection.items;
    try {
      const planning = planningAnalysisForDownstream(state);
      const response = await generateWithAi({
        workflowId: "concept",
        workflow: { id: "concept", title: "研究辅助循环生成", outputSchema: "ConceptPlan" },
        analysis: {
          "任务目标": state.brief?.objective || "当前概念目标",
          "核心思路": state.brief?.approach || "当前概念思路",
          "主要矛盾": state.brief?.risk || "信息不确定性和资源连续性",
          ...planning,
          "作战活动": (state.ov5?.activities || []).map((item) => ({ 类型: item.type, 名称: item.title, 输入: item.input, 输出: item.output })),
          "建模要求": "以活动模型为主干，优先吸收阶段转换条件、概念图关系约束与规划 OODA 提示，生成可审阅的观察、判断、决策、行动与反馈规则。保持研究层抽象；不提供具体行动步骤、目标选择、武器用法或规避建议。"
        },
        evidence
      });
      if (!isAiOutput(response)) throw new Error("AI OODA 响应不完整");
      state.ooda = applyAiOodaDraft({ ov5: state.ov5, draft: response.result, evidenceSelection: evidenceSelection.provenance });
      notify("AI 已生成 OODA 行为说明与复核规则");
    } catch {
      state.ooda = createLocalOodaDraft({ ov5: state.ov5, evidenceSelection: evidenceSelection.provenance });
      notify("AI 服务暂不可用，已从当前活动模型派生本地研究循环");
    } finally {
      persistOodaModel(state.ooda);
      state.selection = null;
      invalidateDerivedArtifacts();
      void syncOoda?.(state.ooda, { source: state.ooda.provenance?.mode === "ai" ? "ai" : "local-ai-fallback" });
      state.oodaGenerating = false;
      render();
    }
  }
}
