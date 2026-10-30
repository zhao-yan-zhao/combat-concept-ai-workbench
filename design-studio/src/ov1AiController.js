import { generateWithAi, isAiOutput } from "../../shared/aiClient.js";
import { selectEvidenceForAi } from "./evidenceSelectionStore.js";
import { createAiOv1Draft, createLocalOv1Draft, extractOv1FromOv5 } from "./ov1DraftStore.js";
import { normalizeOv1Model } from "./ov1Store.js";
import { planningAnalysisForDownstream } from "./planningContext.js";

export function createOv1AiController({ getState, render, notify, invalidateValidation, syncOv1 }) {
  return {
    handleAction(action) {
      if (action === "generate-ov1") {
        const state = getState();
        if (state.ov1Generating) return true;
        void generateOv1(state);
        return true;
      }
      if (action === "extract-ov1-from-ov5") {
        const state = getState();
        extractFromOv5(state);
        return true;
      }
      return false;
    },
    generateOv1() {
      const state = getState();
      if (state.ov1Generating) return;
      return generateOv1(state);
    }
  };

  function extractFromOv5(state) {
    const activities = state.ov5?.activities || [];
    if (!activities.length) {
      notify("Step 04 尚未构建作战活动网络，请先在「作战活动与机理」阶段生成活动");
      return;
    }
    const extracted = extractOv1FromOv5(state.ov5, {
      brief: state.brief,
      direction: state.direction,
      forceMission: state.forceMission
    });
    if (!state.ov1?.nodes?.length) {
      state.ov1 = normalizeOv1Model(extracted);
      state.ov1Candidate = null;
      invalidateValidation?.();
      void syncOv1?.(state.ov1, { source: "ov1:extract-from-ov5" });
      notify(`已从 Step 04 的 ${activities.length} 项作战活动自底向上生成总体概念图`);
    } else {
      state.ov1Candidate = normalizeOv1Model(extracted);
      notify(`已从 Step 04 的 ${activities.length} 项作战活动自底向上提炼出总体概念图候选，请审阅后应用`);
    }
    render();
  }

  async function generateOv1(state) {
    state.ov1Generating = true;
    render();

    const evidenceSelection = await selectEvidenceForAi({
      query: `${state.brief?.objective || ""} ${state.brief?.approach || ""} ${state.brief?.expectedEffects || ""}`,
      knowledge: state.knowledge,
      knowledgeStorage: state.knowledgeStorage,
      limit: 3
    });
    const evidence = evidenceSelection.items;
    try {
      const planning = planningAnalysisForDownstream(state);
      const subjectForces = Array.isArray(state.forceMission?.forces)
        ? state.forceMission.forces.filter((force) => force.side === "friendly")
        : [];
      const forcesHint = subjectForces.length
        ? `已确认研究主体概念兵力（${subjectForces.map((f) => `${f.name}(角色:${f.role},任务:${f.task || "通用"})`).join("；")}）。请严格以此为主体骨架推导各节点高层交互关系、控制流、态势变化与反馈回路。`
        : "当前缺少已确认研究主体概念兵力，请按简报生成研究级五节点高层概念图草案。";

      const ov5Activities = Array.isArray(state.ov5?.activities) ? state.ov5.activities : [];
      const ov5Summary = ov5Activities.length
        ? `Step 04 已闭合活动网（含 ${ov5Activities.slice(0, 8).map((a) => `${a.title}(${a.type})`).join("、")} 等 ${ov5Activities.length} 项活动）。请重点以此为底层事实源自底向上提炼高层概念节点。`
        : "";

      const response = await generateWithAi({
        workflowId: "concept",
        workflow: { id: "concept", title: "高层作战概念图生成", outputSchema: "OperationalConceptGraphic" },
        analysis: {
          "任务目标": state.brief?.objective || "当前概念简报目标",
          "核心思路": state.brief?.approach || "当前概念简报思路",
          "预期效果": planning["规划预期效果"] || state.brief?.expectedEffects || "待明确的研究级效果",
          "主要风险": state.brief?.risk || "待识别风险",
          ...planning,
          "概念方向": state.direction,
          "概念兵力骨架": forcesHint,
          "底层活动机理": ov5Summary || "待生成作战活动",
          "生成要求": [
            forcesHint,
            ov5Summary,
            "必须恰好给出 sense、decide、control、opponent、assess 五类节点及其高层关系。",
            "重点生成节点间的高层交互关系（信息流、控制流、态势变化、反馈），以及 concept 总体作战概念闭环叙述。",
            "内容保持研究级、可审阅；不提供微观战术细节、具体武器用法或伪精确坐标。"
          ].filter(Boolean).join(" ")
        },
        evidence
      });
      if (!isAiOutput(response)) throw new Error("AI 高层概念图响应不完整");
      state.ov1Candidate = normalizeOv1Model(createAiOv1Draft({
        brief: state.brief,
        direction: state.direction,
        draft: response.result,
        forceMission: state.forceMission
      }));
      notify(subjectForces.length
        ? "AI 已根据概念兵力与简报生成高层概念图交互关系与闭环候选；请比较后决定是否应用"
        : "AI 候选已生成；请比较后决定是否应用");
    } catch {
      state.ov1Candidate = normalizeOv1Model(createLocalOv1Draft({
        brief: state.brief,
        direction: state.direction,
        forceMission: state.forceMission
      }));
      notify("AI 服务暂不可用，已生成本地候选；请比较后决定是否应用");
    } finally {
      state.ov1Generating = false;
      render();
    }
  }
}
