import { generateWithAi, isAiOutput } from "../../shared/aiClient.js";
import { addInspirationReply, getInspirationProgress, saveInspirationSession } from "./inspirationStore.js";
import { createAiInspirationSeeds, createLocalInspirationSeeds, findInspirationSeed } from "./inspirationSuggestionStore.js";

export function createInspirationSuggestionController({ getState, render, notify }) {
  return {
    bind(root) {
      root.querySelectorAll("[data-inspiration-seed]").forEach((button) => {
        button.addEventListener("click", () => adoptSeed(button.dataset.inspirationSeed));
      });
    },

    handleAction(action) {
      if (action !== "generate-inspiration-seeds") return false;
      const state = getState();
      if (state.inspirationSuggestionGenerating || getInspirationProgress(state.inspiration).stage !== 0) return true;
      void generateSeeds();
      return true;
    }
  };

  function adoptSeed(id) {
    const state = getState();
    if (getInspirationProgress(state.inspiration).stage !== 0) return;
    const seed = findInspirationSeed(state.inspirationSuggestions, id);
    if (!seed) return;
    state.inspiration = saveInspirationSession(addInspirationReply(state.inspiration, seed.text));
    state.inspirationSuggestions = [];
    notify("已采用研究起点；请继续补充作战环境");
    render();
  }

  async function generateSeeds() {
    const state = getState();
    state.inspirationSuggestionGenerating = true;
    state.inspirationSuggestions = [];
    render();
    try {
      const response = await generateWithAi({
        workflowId: "concept",
        workflow: { id: "concept", title: "研究起点 AI 建议", outputSchema: "ConceptPlan" },
        analysis: {
          "任务目标": "为尚未形成明确设想的研究人员给出三个可选择、可继续追问的作战概念研究起点。",
          "主要矛盾": "不能预设具体任务、地点、对手或行动方案，需要先界定可研究的问题。",
          "关键约束": "只提出研究问题和验证焦点，不给出具体行动步骤、目标选择、武器用法或规避建议。",
          "建议要求": "summary 概括共同研究边界；bullets 必须给出三个互不重复、每条一句且可直接作为初始灵感的中文研究起点。"
        },
        evidence: []
      });
      if (!isAiOutput(response)) throw new Error("AI 起点响应不完整");
      state.inspirationSuggestions = createAiInspirationSeeds(response);
      notify("AI 已给出三个研究起点；选择一个后可继续编辑");
    } catch {
      state.inspirationSuggestions = createLocalInspirationSeeds();
      notify("AI 服务暂不可用，已提供本地研究起点");
    } finally {
      state.inspirationSuggestionGenerating = false;
      render();
    }
  }
}
