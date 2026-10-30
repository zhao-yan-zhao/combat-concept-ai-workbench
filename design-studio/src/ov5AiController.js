import { generateWithAi, isAiOutput } from "../../shared/aiClient.js";
import { selectEvidenceForAi } from "./evidenceSelectionStore.js";
import { applyAiOv5Draft, createLocalOv5Draft } from "./ov5DraftStore.js";
import { addEdge, deriveActivitiesFromTasks, persistOv5Model } from "./ov5Store.js";
import { deriveOodaFromOv5, evaluateOodaLoopHealth } from "./oodaStore.js";
import { countUnmappedOv5Activities } from "./ov5Ov1Linker.js";
import { planningAnalysisForDownstream } from "./planningContext.js";

export function createOv5AiController({ getState, render, notify, invalidateDerivedArtifacts, syncOv5, syncOoda }) {
  return {
    handleAction(action) {
      if (action === "generate-ov5") {
        const state = getState();
        if (state.ov5Generating) return true;
        if (state.ov5?.activities?.length && typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm("将根据当前概念简报与已确认规划重建 OV-5，并同步派生 OODA。已有 OV-5 与 OODA 的人工编辑会被替换。是否继续？")) return true;
        void generateOv5(state);
        return true;
      }
      if (action === "derive-activities-from-tasks") {
        void deriveFromTasks(getState());
        return true;
      }
      if (action === "auto-fix-feedback-loop") {
        void autoFixFeedbackLoop(getState());
        return true;
      }
      return false;
    }
  };

  async function deriveFromTasks(state) {
    const tasks = state.forceMission?.tasks || state.forceMissionPlan?.tasks || [];
    if (!tasks.length) {
      notify("上游尚未确认作战任务，请先在「任务与兵力」阶段添加并确认任务");
      return;
    }
    const derived = deriveActivitiesFromTasks(tasks, { forceMission: state.forceMission, existingModel: state.ov5 });
    state.ov5 = derived;
    persistOv5Model(state.ov5);
    state.ooda = deriveOodaFromOv5(state.ov5);
    state.selection = null;
    invalidateDerivedArtifacts();
    await syncOv5?.(state.ov5, { source: "derived" });
    await syncOoda?.(state.ooda, { source: "derived" });
    notify(`已从上游 ${tasks.length} 项任务派生 ${derived.activities.length} 个作战活动与初始因果链路`);
    render();
  }

  async function autoFixFeedbackLoop(state) {
    const model = state.ov5;
    const activities = Array.isArray(model?.activities) ? model.activities : [];
    if (activities.length < 2) {
      notify("活动数量不足，无法构建反馈闭环");
      return;
    }

    const health = evaluateOodaLoopHealth(model);
    const hasFeedbackGap = health.diagnostics.some((d) => d.code === "NO_FEEDBACK_LOOP");
    if (!hasFeedbackGap) {
      notify("当前作战活动网络已具备有效的反馈闭环，无需修补");
      return;
    }

    const lastAct = [...activities].reverse().find((a) => {
      const t = String(a.type || "");
      const title = String(a.title || "");
      return t.includes("行动") || t.includes("控制") || t.includes("评估") || title.includes("打击") || title.includes("突击");
    }) || activities[activities.length - 1];

    const firstTarget = activities.find((a) => {
      const t = String(a.type || "");
      const title = String(a.title || "");
      return (t.includes("感知") || t.includes("识别") || t.includes("决策") || title.includes("侦察") || title.includes("探测")) && a.id !== lastAct.id;
    }) || activities.find((a) => a.id !== lastAct.id);

    if (!firstTarget) {
      notify("未找到合适的反馈目标活动");
      return;
    }

    addEdge(state.ov5, lastAct.id, firstTarget.id, "信息流", {
      payload: "战损评估与态势更新反馈",
      condition: "打击/行动后回传"
    });
    persistOv5Model(state.ov5);
    state.ooda = deriveOodaFromOv5(state.ov5);
    invalidateDerivedArtifacts();
    await syncOv5?.(state.ov5, { source: "manual" });
    await syncOoda?.(state.ooda, { source: "derived" });
    notify(`已自动建立从「${lastAct.title}」到「${firstTarget.title}」的闭环反馈连线`);
    render();
  }

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
      const tasksHint = Array.isArray(state.forceMission?.tasks) && state.forceMission.tasks.length
        ? `上游已确认任务（${state.forceMission.tasks.map((t) => `${t.name || t.id}(${t.missionType || "通用"})`).join("；")}）。请严格以此为来源纵向细化为具备因果闭环的作战活动网络。`
        : "请围绕概念简报生成覆盖感知、决策、行动、控制与评估的闭环作战活动网络。";

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
          "任务约束": tasksHint,
          "OV-1概念节点": ov1Context.nodes,
          "OV-1高层关系": ov1Context.edges,
          "建模要求": "以任务与兵力规划为基础，生成感知、识别、决策、行动、控制和评估六类研究级活动及信息、控制、反馈因果衔接。确保活动形成杀伤网闭环（打击后有反馈回路连接至感知/决策）；保持抽象、可审阅和可追溯；不提供具体行动步骤、目标选择、武器用法或规避建议。"
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
