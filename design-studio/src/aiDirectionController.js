import { generateWithAi, getAiHealth, isAiOutput } from "../../shared/aiClient.js";
import { saveAiDirections } from "./directionProposalStore.js";

export function createAiDirectionController({ projectId, getState, render, notify }) {
  return {
    bind() {
      const state = getState();
      if (!state.aiDirections.length && !state.aiDirectionsGenerating && !state.aiDirectionsAutoChecked) void autoGenerate();
    },
    handleAction(action) {
      if (action !== "generate-ai-directions") return false;
      const state = getState();
      if (!state.aiDirectionsGenerating) void generate();
      return true;
    }
  };

  async function autoGenerate() {
    const state = getState();
    state.aiDirectionsAutoChecked = true;
    try {
      const health = await getAiHealth();
      if (health?.configured && health?.mode === "ai") await generate();
    } catch { /* AI directions remain optional when service health is unavailable. */ }
  }

  async function generate() {
    const state = getState();
    state.aiDirectionsGenerating = true;
    render();
    try {
      const response = await generateWithAi({
        workflowId: "concept",
        workflow: { id: "concept", title: "概念方向生成", outputSchema: "ConceptPlan" },
        analysis: {
          "研究意图": state.brief.researchIntent || "待补充",
          "研究目标": state.brief.objective,
          "核心思路": state.brief.approach,
          "关键假设": state.brief.assumptions,
          "生成要求": "生成三个彼此可区分的概念研究方向。bullets 必须恰好三条，每条格式为‘方向名称：不超过 90 字的研究级概述’，不得包含具体行动步骤、目标选择、路线、武器用法或规避建议。"
        },
        evidence: []
      });
      if (!isAiOutput(response)) throw new Error("AI direction response is incomplete");
      const generated = toDirections(response);
      state.aiDirections = saveAiDirections([...generated, ...createFallbackDirections(state)].slice(0, 3), { projectId, defaults: [] });
      notify("已生成 3 个 AI 概念方向");
    } catch {
      state.aiDirections = saveAiDirections(createFallbackDirections(state), { projectId, defaults: [] });
      notify("AI 服务暂不可用，已生成本地方向供参考");
    } finally {
      state.aiDirectionsGenerating = false;
      render();
    }
  }
}

function toDirections(response) {
  const basis = String(response.result?.coreIdea || "基于当前研究意图生成").trim();
  const bullets = Array.isArray(response.result?.phases) ? response.result.phases : [];
  return bullets.slice(0, 3).map((item, index) => {
    const [title, ...rest] = String(item).split(/[：:]/);
    return { title: clean(title) || `AI 方向 ${index + 1}`, text: clean(rest.join("：")) || clean(item), basis };
  });
}

function createFallbackDirections(state) {
  const focus = clean(state.brief.researchIntent || state.brief.objective || "当前研究意图");
  return ["信息韧性", "协同判定", "风险约束"].map((title, index) => ({ title, text: `围绕${focus}，从${title}视角形成可复核的概念研究边界与验证重点。`, basis: "本地回退建议，待 AI 或专家复核。", index }));
}

function clean(value) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, 500); }
