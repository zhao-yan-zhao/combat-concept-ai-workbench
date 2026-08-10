import { generateWithAi, isAiOutput } from "../../shared/aiClient.js";
import { selectEvidenceForAi } from "./evidenceSelectionStore.js";
import { createAiOv1Draft, createLocalOv1Draft } from "./ov1DraftStore.js";
import { normalizeOv1Model } from "./ov1Store.js";
import { planningAnalysisForDownstream } from "./planningContext.js";

export function createOv1AiController({ getState, render, notify, invalidateValidation, syncOv1 }) {
  return {
    handleAction(action) {
      if (action !== "generate-ov1") return false;
      const state = getState();
      if (state.ov1Generating) return true;
      void generateOv1(state);
      return true;
    }
  };

  async function generateOv1(state) {
    state.ov1Generating = true;
    render();
    const hasSubjectForces = Array.isArray(state.forceMission?.forces)
      && state.forceMission.forces.some((force) => force.side === "friendly");

    // Research-subject concept forces already define OV-1. Do not let free-form AI rename nodes.
    if (hasSubjectForces) {
      try {
        state.ov1Candidate = normalizeOv1Model(createLocalOv1Draft({
          brief: state.brief,
          direction: state.direction,
          forceMission: state.forceMission
        }));
        notify("已按研究主体概念兵力装备展开 OV-1 候选（一兵力一节点）");
      } catch {
        state.ov1Candidate = normalizeOv1Model(createLocalOv1Draft({
          brief: state.brief,
          direction: state.direction
        }));
        notify("概念兵力归纳失败，已回退简报草案");
      } finally {
        state.ov1Generating = false;
        render();
      }
      return;
    }

    const evidenceSelection = await selectEvidenceForAi({
      query: `${state.brief?.objective || ""} ${state.brief?.approach || ""} ${state.brief?.expectedEffects || ""}`,
      knowledge: state.knowledge,
      knowledgeStorage: state.knowledgeStorage,
      limit: 3
    });
    const evidence = evidenceSelection.items;
    try {
      const planning = planningAnalysisForDownstream(state);
      const response = await generateWithAi({
        workflowId: "concept",
        workflow: { id: "concept", title: "OV-1 高层作战概念图生成", outputSchema: "OperationalConceptGraphic" },
        analysis: {
          "任务目标": state.brief?.objective || "当前概念简报目标",
          "核心思路": state.brief?.approach || "当前概念简报思路",
          "预期效果": planning["规划预期效果"] || state.brief?.expectedEffects || "待明确的研究级效果",
          "主要风险": state.brief?.risk || "待识别风险",
          ...planning,
          "概念方向": state.direction,
          "生成要求": [
            "当前缺少已确认研究主体概念兵力，仅可按简报生成研究级 OV-1 草案。",
            "必须恰好给出 sense、decide、control、opponent、assess 五类节点及其高层关系。",
            "节点名只能是实体、能力或关键动作；不得把阶段名、研究步骤写成节点。",
            "内容保持研究级、可审阅；不提供具体行动步骤、目标选择、武器用法、坐标或性能参数。"
          ].join("")
        },
        evidence
      });
      if (!isAiOutput(response)) throw new Error("AI OV-1 响应不完整");
      state.ov1Candidate = normalizeOv1Model(createAiOv1Draft({
        brief: state.brief,
        direction: state.direction,
        draft: response.result,
        forceMission: state.forceMission
      }));
      notify("AI 候选已生成；请比较后决定是否应用");
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
