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
import { detectResearchChatBriefFields } from "./researchChatBriefUpdate.js";

export function createInspirationAdviceController({
  projectId,
  getState,
  getProjectTitle = () => "",
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
      const detectedBriefFields = detectResearchChatBriefFields(question);
      const briefField = detectedBriefFields.length ? (detectedBriefFields.length >= 6 ? "all" : detectedBriefFields.join(",")) : "none";
      const brief = state.brief || {};
      const projectTitle = String(getProjectTitle?.(state) || getProjectTitle?.() || "").trim();
      try {
        const response = await generateWithAiStream({
          workflowId: "concept",
          workflow: { id: "concept", title: "研究对话直接答复", outputSchema: "ConceptPlan" },
          analysis: {
            "项目标题": projectTitle || "未命名项目",
            "已记录灵感": summarizeInspirationSession(state.inspiration) || "尚未形成结构化灵感。",
            "当前研究简报": {
              researchIntent: brief.researchIntent || "",
              objective: brief.objective || "",
              approach: brief.approach || "",
              assumptions: brief.assumptions || "",
              expectedEffects: brief.expectedEffects || "",
              risk: brief.risk || ""
            },
            "近期对话上下文": conversationContext || "这是首轮研究咨询，暂无历史对话。",
            "研究人员问题": question,
            "本轮允许更新的简报字段": briefField || "none",
            "对话回答要求": [
              "你是作战概念研究工作台的【资深军事概念研讨参谋】：以“项目标题”与用户提出的实际课题为核心，展开有实质深度、平等互动的专业战法机制研讨，并顺带完善右侧研究简报。",
              "回答采用参谋式三段论：① 结合军事常识正面回应关键矛盾与攻防机理，研讨聚焦于作战概念层（兵力编成、时空窗口、时序与协同），避免过度陷入底层工程技术细节；② 提炼一句规范表述代拟写入右侧对应简报栏（并填入 briefUpdate 对应字段）且友好提示已代拟；③ 抛出 1 至 2 个聚焦于阶段划分、指挥协同或时序转换门槛的推演分支变量，引导概念向可模型化收敛。",
              "当用户表达研究主题或询问如何填写某字段时，在 briefUpdate 允许字段写入贴合本课题的研究表述；用户若提出新课题，优先以用户最新课题为准。",
              "多轮对话紧密承接：当用户承接询问（如“你知道我想研究什么吗”或表达犹豫）时，锁定当前核心课题，分析不同推演分支利弊，协助研究员推敲决策。",
              "用户询问某字段现状时直接复述已有内容，briefUpdate 置空。严禁输出机械套话（如“研究框架已就绪”、“请提供变量”等说辞）。"
            ].join("")
          },
          evidence: []
        }, {
          durable: true,
          projectId,
          scope: "brief",
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
        const updatedFields = applyBriefUpdate(response, question, { projectTitle });
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

function extractAdviceText(response) {
  const res = response?.result || {};
  return String(
    res.coreIdea ||
    res.summary ||
    res.answer ||
    res.explanation ||
    res.notice ||
    res.directive ||
    res.message ||
    ""
  ).trim();
}

function formatAdvice(response) {
  const text = extractAdviceText(response);
  return text || "请先明确研究对象、判断边界和可验证依据，再形成可复核的概念表述。";
}

function createFallbackAdvice(question, conversationContext = "") {
  const subject = String(question).replace(/\s+/g, " ").trim().slice(0, 90) || "该研究问题";
  const continuity = conversationContext ? "结合前述对话已形成的研究对象与判断边界，" : "";
  return `${continuity}围绕“${subject}”，建议继续核对可验证的关键假设、公开证据和约束条件，并将结论保留为待专家复核的研究判断。`;
}

function hasConversationalAdvice(response) {
  return Boolean(extractAdviceText(response));
}
