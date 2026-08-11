import { generateWithAi, isAiOutput } from "../../shared/aiClient.js";
import { selectEvidenceForAi } from "./evidenceSelectionStore.js";
import { applyAiOv5Draft, createLocalOv5Draft } from "./ov5DraftStore.js";
import { persistOv5Model } from "./ov5Store.js";
import { deriveOodaFromOv5 } from "./oodaStore.js";
import { countUnmappedOv5Activities } from "./ov5Ov1Linker.js";
import { planningAnalysisForDownstream } from "./planningContext.js";

export function createOv5AiController({ getState, render, notify, invalidateDerivedArtifacts, syncOv5, syncOoda }) {
  return {
    handleAction(action) {
      if (action !== "generate-ov5") return false;
      const state = getState();
      if (state.ov5Generating) return true;
      if (state.ov5?.activities?.length && !window.confirm("将根据当前概念简报与已确认规划重建 OV-5，并同步派生 OODA。已有 OV-5 与 OODA 的人工编辑会被替换。是否继续？")) return true;
      void generateOv5(state);
      return true;
    }
  };

  async function generateOv5(state) {
    state.ov5Generating = true;
    render();
    const evidenceSelection = await selectEvidenceForAi({
      query: `${state.brief?.objective || ""} ${state.brief?.approach || ""} ${state.brief?.expectedEffects || ""}`,
      knowledge: state.knowledge,
      knowledgeStorage: state.knowledgeStorage,
      limit: 3
    });
    const evidence = evidenceSelection.items;
    try {
      const ov1Context = summarizeOv1ForOv5(state.ov1);
      const planning = planningAnalysisForDownstream(state);
      const response = await generateWithAi({
        workflowId: "concept",
        workflow: { id: "concept", title: "作战活动模型生成", outputSchema: "ConceptPlan" },
        analysis: {
          "任务目标": state.brief?.objective || "当前概念目标",
          "核心思路": state.brief?.approach || "当前概念思路",
          "预期效果": planning["规划预期效果"] || state.brief?.expectedEffects || "待明确的研究级效果",
          "主要矛盾": state.brief?.risk || "信息不确定性和资源连续性",
          ...planning,
          "概念方向": state.direction,
          "OV-1概念节点": ov1Context.nodes,
          "OV-1高层关系": ov1Context.edges,
          "建模要求": "以当前 OV-1 为主骨架，优先吸收概念图活动候选、阶段主行动与兵力职责，生成感知、识别、决策、行动、控制和评估六类研究级活动及信息衔接。活动应能回指 OV-1 主体；保持抽象、可审阅和可追溯；不提供具体行动步骤、目标选择、武器用法或规避建议。"
        },
        evidence
      });
      if (!isAiOutput(response)) throw new Error("AI OV-5 响应不完整");
      state.ov5 = applyAiOv5Draft({ brief: state.brief, direction: state.direction, draft: response.result, evidence, evidenceSelection: evidenceSelection.provenance, ov1: state.ov1 });
      const unmapped = countUnmappedOv5Activities(state.ov5, state.ov1);
      notify(unmapped ? `AI 已重建 OV-5（${unmapped} 个活动仍待核对 OV-1 来源），并派生 OODA` : "AI 已重建 OV-5，活动已挂接 OV-1 来源，并派生待复核 OODA");
    } catch {
      state.ov5 = createLocalOv5Draft({ brief: state.brief, direction: state.direction, evidence, evidenceSelection: evidenceSelection.provenance, ov1: state.ov1 });
      notify("AI 服务暂不可用，已生成本地 OV-5（已尝试挂接 OV-1）并派生 OODA");
    } finally {
      persistOv5Model(state.ov5);
      state.ooda = deriveOodaFromOv5(state.ov5);
      state.selection = null;
      invalidateDerivedArtifacts();
      await syncOv5?.(state.ov5, { source: state.ov5.provenance?.mode === "ai" ? "ai" : "local-ai-fallback" });
      await syncOoda?.(state.ooda, { source: "derived" });
      state.ov5Generating = false;
      render();
    }
  }
}

function summarizeOv1ForOv5(ov1 = {}) {
  const nodes = Array.isArray(ov1.nodes) ? ov1.nodes : [];
  const edges = Array.isArray(ov1.edges) ? ov1.edges : [];
  const nodeLabel = new Map(nodes.map((node) => [String(node.id), String(node.label || node.id).slice(0, 80)]));
  return {
    nodes: nodes.slice(0, 12).map((node) => {
      const kind = node.kind || node.category || "主体";
      return `${String(node.label || node.id).slice(0, 80)}（${kind}）`;
    }).join("；") || "尚未定义 OV-1 节点",
    edges: edges.slice(0, 16).map((edge) => {
      const source = nodeLabel.get(String(edge.sourceId)) || edge.sourceId;
      const target = nodeLabel.get(String(edge.targetId)) || edge.targetId;
      return `${source} -[${edge.type || "关系"}]-> ${target}`;
    }).join("；") || "尚未定义 OV-1 关系"
  };
}
