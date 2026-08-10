import { patchResearchChatStream, scrollResearchChatToBottom } from "./researchChatView.js";

/**
 * Shared research-chat controller.
 * Each step supplies session accessors + runTurn adapter; bind/edit/retry/scroll stay here.
 */
export function createResearchChatController({
  scope,
  getState,
  render,
  notify = () => {},
  topic = "consultation",
  getSession,
  setSession,
  isGenerating,
  setGenerating,
  canSend = () => true,
  /**
   * @param {{ question: string, replaceMessageId?: string, state: object, onDelta?: (payload: { preview?: string, assembled?: string }) => void }} args
   * @returns {Promise<{ advice: string, source?: string, notifyMessage?: string }>}
   */
  runTurn,
  onAfterTurn = () => {}
}) {
  return {
    bind(root) {
      const form = root.querySelector(`[data-research-chat-form="${scope}"]`);
      form?.addEventListener("submit", (event) => {
        event.preventDefault();
        const question = String(new FormData(event.currentTarget).get("question") || "").trim();
        if (question && !isGenerating(getState()) && canSend(getState())) {
          void ask(question, event.currentTarget, event.currentTarget.dataset.replaceMessageId || "");
        }
      });

      root.querySelectorAll(`[data-research-chat-edit][data-research-chat-scope="${scope}"]`).forEach((button) => {
        button.addEventListener("click", () => {
          if (isGenerating(getState())) return;
          const session = getSession(getState());
          const message = (session?.messages || []).find((item) => item.id === button.dataset.researchChatEdit);
          const input = root.querySelector(`[data-research-chat-input="${scope}"]`);
          if (!message || !input) return;
          input.value = message.text;
          const hostForm = input.closest("form");
          if (hostForm) hostForm.dataset.replaceMessageId = message.id;
          input.focus();
        });
      });

      root.querySelectorAll(`[data-research-chat-retry][data-research-chat-scope="${scope}"]`).forEach((button) => {
        button.addEventListener("click", () => {
          const session = getSession(getState());
          const messages = session?.messages || [];
          const index = messages.findIndex((item) => item.id === button.dataset.researchChatRetry);
          const userMessage = index > 0
            ? messages.slice(0, index).reverse().find((item) => item.role === "user" && item.topic === topic)
            : null;
          if (userMessage && !isGenerating(getState()) && canSend(getState())) {
            void ask(userMessage.text, null, userMessage.id);
          }
        });
      });

      scrollResearchChatToBottom(root, scope);
    },
    ask
  };

  async function ask(question, form, replaceMessageId = "") {
    const state = getState();
    if (isGenerating(state)) return;
    if (!canSend(state)) {
      notify("当前步骤暂不可对话修订");
      return;
    }

    // Optimistic UI: user bubble + typing indicator before network.
    setSession(state, { type: "begin", question, replaceMessageId });
    setGenerating(state, true);
    if (form) {
      form.reset();
      delete form.dataset.replaceMessageId;
    }
    render();

    try {
      const result = await runTurn({
        question,
        replaceMessageId,
        state: getState(),
        onDelta: (payload) => {
          const preview = String(payload?.preview || payload?.assembled || "").trim();
          if (!preview) return;
          setSession(getState(), { type: "delta", text: preview });
          // Prefer in-place DOM patch to avoid full re-render flicker while streaming.
          patchResearchChatStream(scope, preview);
        }
      });
      const advice = String(result?.advice || "").trim();
      const source = result?.source === "local" ? "local" : "ai";
      if (!advice) throw new Error("empty research chat advice");
      setSession(getState(), { type: "complete", advice, source });
      onAfterTurn(getState(), result);
      if (result?.notifyMessage) notify(result.notifyMessage);
    } catch (error) {
      const fallback = String(error?.fallbackAdvice || "").trim() || createGenericFallback(question);
      // Always complete the pending bubble so the thread never sticks on "分析中".
      setSession(getState(), {
        type: "complete",
        advice: fallback,
        source: "local"
      });
      onAfterTurn(getState(), { source: "local", error });
      notify(error?.notifyMessage || "AI 服务暂不可用，已记录本地研究级建议");
    } finally {
      setGenerating(getState(), false);
      render();
    }
  }
}

function createGenericFallback(question) {
  const subject = String(question || "").replace(/\s+/g, " ").trim().slice(0, 90) || "该研究问题";
  return `围绕“${subject}”，建议先明确研究对象和判断边界，并保留为待专家复核的研究判断。`;
}
