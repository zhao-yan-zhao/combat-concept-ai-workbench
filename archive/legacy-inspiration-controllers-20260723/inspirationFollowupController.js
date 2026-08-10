import { generateWithAi, isAiOutput } from "../../shared/aiClient.js";
import { replacePendingInspirationPrompt, saveInspirationSession, summarizeInspirationSession } from "./inspirationStore.js";
import { canRefineInspirationFollowUp, createAiInspirationFollowUp, createLocalInspirationFollowUp } from "./inspirationFollowupStore.js";

export function createInspirationFollowupController({ getState, render, notify }) {
  return {
    handleAction(action) {
      if (action !== "generate-inspiration-followup") return false;
      const state = getState();
      if (state.inspirationFollowUpGenerating || !canRefineInspirationFollowUp(state.inspiration)) return true;
      void refineFollowUp();
      return true;
    }
  };

  async function refineFollowUp() {
    const state = getState();
    const stage = state.inspiration.stage;
    state.inspirationFollowUpGenerating = true;
    render();
    try {
      const response = await generateWithAi({
        workflowId: "concept",
        workflow: { id: "concept", title: "灵感孵化自适应追问", outputSchema: "ConceptPlan" },
        analysis: {
          "已记录信息": summarizeInspirationSession(state.inspiration) || "研究人员尚未形成完整设想。",
          "当前环节": `第 ${stage + 1} 轮：${stage === 0 ? "初始灵感" : state.inspiration.stage}`,
          "生成要求": "根据已记录信息，把当前待答问题细化为一个不超过 100 字的中文追问。bullets 的第一项必须是这一个问题。问题只用于概念研究边界、信息条件、资源约束、风险或成功标准澄清，不涉及具体行动步骤、目标选择、武器用法或规避建议。"
        },
        evidence: []
      });
      if (!isAiOutput(response)) throw new Error("AI 追问响应不完整");
      if (state.inspiration.stage !== stage) return;
      const prompt = createAiInspirationFollowUp(response, state.inspiration);
      state.inspiration = saveInspirationSession(replacePendingInspirationPrompt(state.inspiration, prompt, "ai"));
      notify("AI 已细化当前追问；可继续修改或直接回答");
    } catch {
      if (state.inspiration.stage !== stage) return;
      const prompt = createLocalInspirationFollowUp(state.inspiration);
      state.inspiration = saveInspirationSession(replacePendingInspirationPrompt(state.inspiration, prompt, "local"));
      notify("AI 服务暂不可用，已提供本地细化追问");
    } finally {
      state.inspirationFollowUpGenerating = false;
      render();
    }
  }
}
