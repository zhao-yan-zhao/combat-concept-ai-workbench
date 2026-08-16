import { generateWithAiStream } from "../../shared/aiClient.js";
import {
  buildInspirationConversationContext,
  attachInspirationAdviceJob,
  beginInspirationAdviceTurn,
  cancelInspirationAdviceTurn,
  completeInspirationAdviceTurn,
  saveInspirationSession,
  summarizeInspirationSession,
  updateInspirationPendingText
} from "./inspirationStore.js";
import { createResearchChatController } from "./researchChat/index.js";

export function createInspirationAdviceController({
  getState,
  render,
  notify,
  syncConversation = () => {},
  applyBriefUpdate = () => []
}) {
  return createResearchChatController({
    scope: "brief",
    topic: "consultation",
    getState,
    render,
    notify,
    getSession: (state) => state.inspiration,
    setSession: (state, action) => {
      if (action.type === "begin") {
        state.inspiration = saveInspirationSession(
          beginInspirationAdviceTurn(state.inspiration, action.question, action.replaceMessageId || "")
        );
        return;
      }
      if (action.type === "delta") {
        state.inspiration = updateInspirationPendingText(state.inspiration, action.text || "");
        return;
      }
      if (action.type === "job") {
        state.inspiration = saveInspirationSession(attachInspirationAdviceJob(state.inspiration, action.jobId));
        return;
      }
      if (action.type === "complete") {
        state.inspiration = saveInspirationSession(
          completeInspirationAdviceTurn(state.inspiration, action.advice, action.source || "ai")
        );
        return;
      }
      if (action.type === "cancel") {
        state.inspiration = saveInspirationSession(
          cancelInspirationAdviceTurn(state.inspiration, action.reason || "")
        );
      }
    },
    isGenerating: (state) => Boolean(state.inspirationAdviceGenerating),
    setGenerating: (state, value) => {
      state.inspirationAdviceGenerating = Boolean(value);
    },
    canSend: () => true,
    async runTurn({ question, state, onDelta, onJob, resumeJobId, signal }) {
      const conversationContext = buildInspirationConversationContext(state.inspiration, {
        currentQuestion: question
      });
      try {
        const response = await generateWithAiStream({
          workflowId: "concept",
          workflow: { id: "concept", title: "研究对话直接答复", outputSchema: "ConceptPlan" },
          analysis: {
            "已记录灵感": summarizeInspirationSession(state.inspiration) || "尚未形成结构化灵感。",
            "近期对话上下文": conversationContext || "这是首轮研究咨询，暂无历史对话。",
            "研究人员问题": question,
            "对话回答要求": "必须结合近期对话上下文理解当前问题；对“呢、这个、上述、继续、为什么”等承接或省略表达，沿用上一轮讨论对象和已形成判断，不得当作孤立新问题，也不得重复询问上下文中已有的信息。先直接回答研究人员当前问题，使用 1 至 3 句连贯中文，控制在 120 至 220 字。不得复述整个研究简报，不得罗列任务阶段、待核实、待交接、最小信息集等报告式标签；仅在确有必要时补充不超过两项需要进一步澄清的信息。回答仅限概念研究级判断、假设、约束和验证关注点；不得给出具体行动步骤、目标选择、路线、武器用法或规避建议。"
          },
          evidence: []
        }, {
          durable: true,
          resumeJobId,
          onJob,
          signal,
          onDelta: (payload) => {
            onDelta?.(payload);
          }
        });
        if (!hasConversationalAdvice(response)) {
          const error = new Error("AI advice response is incomplete");
          error.fallbackAdvice = createFallbackAdvice(question, conversationContext);
          error.notifyMessage = "AI 服务暂不可用，已记录本地研究级复核建议";
          throw error;
        }
        const advice = formatAdvice(response);
        const updatedFields = applyBriefUpdate(response, question);
        return {
          advice,
          source: "ai",
          notifyMessage: updatedFields.length
            ? `已更新研究简报：${updatedFields.join("、")}`
            : "已记录研究问答建议；请结合证据与人工判断复核",
          response,
          updatedFields
        };
      } catch (error) {
        if (error?.name === "AbortError" || signal?.aborted) throw error;
        throw error;
      }
    },
    onAfterTurn: () => {
      syncConversation();
    }
  });
}

function formatAdvice(response) {
  const coreIdea = String(response.result?.coreIdea || response.result?.summary || "").trim();
  return (coreIdea || "请先明确研究对象、判断边界和可验证依据，再形成可复核的概念表述。").slice(0, 360);
}

function createFallbackAdvice(question, conversationContext = "") {
  const subject = String(question).replace(/\s+/g, " ").trim().slice(0, 90) || "该研究问题";
  const continuity = conversationContext ? "结合前述对话已形成的研究对象与判断边界，" : "";
  return `${continuity}围绕“${subject}”，建议继续核对可验证的关键假设、公开证据和约束条件，并将结论保留为待专家复核的研究判断。`;
}

function hasConversationalAdvice(response) {
  return Boolean(String(response?.result?.coreIdea || response?.result?.summary || "").trim());
}
