import { renderResearchChatPanel } from "./researchChat/researchChatView.js";

/** Brief step: thin host over the shared research-chat shell. */
export function renderInspirationSession({ session, adviceGenerating = false }) {
  return renderResearchChatPanel({
    scope: "brief",
    session,
    generating: adviceGenerating,
    title: "研究对话",
    subtitle: "围绕概念、假设、约束和证据进行可复核的研究交流。",
    statusLabel: adviceGenerating ? "AI 正在分析" : "研究助手",
    placeholder: "输入研究问题、假设或需要澄清的约束",
    emptyTitle: "开始研究交流",
    emptyText: "记录任务设想、假设或约束，助手将给出可复核的概念级判断。",
    formId: "researchChatForm",
    inputId: "researchChatInput",
    threadId: "researchChatThread",
    interactiveTopic: "consultation",
    className: "inspiration-panel"
  });
}
