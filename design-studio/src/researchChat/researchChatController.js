import {
  createGenericResearchFallback
} from "./researchChatStore.js";
import { patchResearchChatStream, scrollResearchChatToBottom } from "./researchChatView.js";

/**
 * Shared research-chat controller.
 * Each step supplies session accessors + runTurn adapter; bind/edit/retry/stop/scroll stay here.
 *
 * runTurn receives `{ question, replaceMessageId, state, onDelta, signal }`.
 * Prefer passing `signal` into generateWithAiStream so Stop aborts the network request.
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
  /**
   * @returns {boolean | { ok: boolean, reason?: string }}
   */
  canSend = () => true,
  /**
   * @param {{ question: string, replaceMessageId?: string, state: object, signal?: AbortSignal, onDelta?: (payload: { preview?: string, assembled?: string }) => void }} args
   * @returns {Promise<{ advice: string, source?: string, notifyMessage?: string }>}
   */
  runTurn,
  onAfterTurn = () => {}
}) {
  let abortController = null;
  /** Survives full re-renders so the composer does not lose in-progress text. */
  let draftText = "";
  let replaceMessageIdDraft = "";

  return {
    bind(root) {
      const form = root.querySelector(`[data-research-chat-form="${scope}"]`);
      const input = root.querySelector(`[data-research-chat-input="${scope}"]`);

      // Restore composer draft after render() replaces the DOM.
      if (input && draftText && !input.disabled) {
        input.value = draftText;
      }
      if (form && replaceMessageIdDraft) {
        form.dataset.replaceMessageId = replaceMessageIdDraft;
      }
      syncEditBanner(root, Boolean(replaceMessageIdDraft));

      form?.addEventListener("submit", (event) => {
        event.preventDefault();
        const question = String(new FormData(event.currentTarget).get("question") || "").trim();
        const gate = resolveCanSend(getState());
        if (question && !isGenerating(getState()) && gate.ok) {
          void ask(question, event.currentTarget, event.currentTarget.dataset.replaceMessageId || "");
        } else if (question && !gate.ok) {
          notify(gate.reason || "当前步骤暂不可对话修订");
        }
      });

      input?.addEventListener("input", () => {
        draftText = input.value;
      });

      // Enter sends; Shift+Enter inserts a newline. Skip during IME composition.
      input?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
        event.preventDefault();
        form?.requestSubmit();
      });

      const session = getSession(getState());
      const pendingIndex = (session?.messages || []).findIndex((message) => message?.pending && message?.jobId);
      if (pendingIndex > 0 && !isGenerating(getState())) {
        const pending = session.messages[pendingIndex];
        const userMessage = session.messages.slice(0, pendingIndex).reverse().find((message) => message.role === "user" && message.topic === topic);
        if (userMessage) queueMicrotask(() => void ask(userMessage.text, null, userMessage.id, { resumeJobId: pending.jobId }));
      }

      root.querySelectorAll(`[data-research-chat-edit][data-research-chat-scope="${scope}"]`).forEach((button) => {
        button.addEventListener("click", () => {
          if (isGenerating(getState())) return;
          const session = getSession(getState());
          const message = (session?.messages || []).find((item) => item.id === button.dataset.researchChatEdit);
          const hostInput = root.querySelector(`[data-research-chat-input="${scope}"]`);
          if (!message || !hostInput) return;
          hostInput.value = message.text;
          draftText = message.text;
          replaceMessageIdDraft = message.id;
          const hostForm = hostInput.closest("form");
          if (hostForm) hostForm.dataset.replaceMessageId = message.id;
          syncEditBanner(root, true);
          hostInput.focus();
        });
      });

      root.querySelector(`[data-research-chat-cancel-edit="${scope}"]`)?.addEventListener("click", () => {
        if (isGenerating(getState())) return;
        replaceMessageIdDraft = "";
        draftText = "";
        if (form) delete form.dataset.replaceMessageId;
        if (input) input.value = "";
        syncEditBanner(root, false);
        input?.focus();
      });

      root.querySelectorAll(`[data-research-chat-retry][data-research-chat-scope="${scope}"]`).forEach((button) => {
        button.addEventListener("click", () => {
          const session = getSession(getState());
          const messages = session?.messages || [];
          const index = messages.findIndex((item) => item.id === button.dataset.researchChatRetry);
          const userMessage = index > 0
            ? messages.slice(0, index).reverse().find((item) => item.role === "user" && item.topic === topic)
            : null;
          const gate = resolveCanSend(getState());
          if (userMessage && !isGenerating(getState()) && gate.ok) {
            void ask(userMessage.text, null, userMessage.id);
          } else if (userMessage && !gate.ok) {
            notify(gate.reason || "当前步骤暂不可对话修订");
          }
        });
      });

      root.querySelector(`[data-research-chat-stop="${scope}"]`)?.addEventListener("click", () => {
        stop();
      });

      scrollResearchChatToBottom(root, scope);
    },
    ask,
    stop,
    /** Exposed for tests / hosts that need to clear edit mode. */
    clearComposerDraft() {
      draftText = "";
      replaceMessageIdDraft = "";
    }
  };

  function stop() {
    if (!abortController) return;
    abortController.abort();
  }

  async function ask(question, form, replaceMessageId = "", { resumeJobId = "" } = {}) {
    const state = getState();
    if (isGenerating(state)) return;
    const gate = resolveCanSend(state);
    if (!gate.ok) {
      notify(gate.reason || "当前步骤暂不可对话修订");
      return;
    }

    // Optimistic UI: user bubble + typing indicator before network.
    if (!resumeJobId) setSession(state, { type: "begin", question, replaceMessageId });
    setGenerating(state, true);
    draftText = "";
    replaceMessageIdDraft = "";
    if (form) {
      form.reset();
      delete form.dataset.replaceMessageId;
    }

    abortController = new AbortController();
    const { signal } = abortController;
    render();

    try {
      const result = await runTurn({
        question,
        replaceMessageId,
        state: getState(),
        resumeJobId,
        signal,
        onJob: ({ jobId }) => setSession(getState(), { type: "job", jobId }),
        onDelta: (payload) => {
          if (signal.aborted) return;
          const preview = String(payload?.preview || payload?.assembled || "").trim();
          if (!preview) return;
          setSession(getState(), { type: "delta", text: preview });
          // Prefer in-place DOM patch to avoid full re-render flicker while streaming.
          patchResearchChatStream(scope, preview);
        }
      });

      if (signal.aborted) {
        finishCancelled();
        return;
      }

      const advice = String(result?.advice || "").trim();
      const source = normalizeResultSource(result?.source);
      if (!advice) throw new Error("empty research chat advice");
      setSession(getState(), { type: "complete", advice, source });
      onAfterTurn(getState(), result);
      if (result?.notifyMessage) notify(result.notifyMessage);
    } catch (error) {
      if (signal.aborted || isAbortError(error)) {
        finishCancelled();
        return;
      }
      const fallback = String(error?.fallbackAdvice || "").trim() || createGenericResearchFallback(question);
      // Always complete the pending bubble so the thread never sticks on "分析中".
      setSession(getState(), {
        type: "complete",
        advice: fallback,
        source: "error"
      });
      onAfterTurn(getState(), { source: "error", error });
      notify(error?.notifyMessage || "AI 服务暂不可用，已记录本地研究级建议");
    } finally {
      abortController = null;
      setGenerating(getState(), false);
      render();
    }
  }

  function finishCancelled() {
    setSession(getState(), {
      type: "cancel",
      reason: "已停止生成"
    });
    onAfterTurn(getState(), { source: "cancelled", cancelled: true });
    notify("已停止生成");
  }

  function resolveCanSend(state) {
    const result = canSend(state);
    if (result === true) return { ok: true, reason: "" };
    if (result === false) return { ok: false, reason: "当前步骤暂不可对话修订" };
    if (result && typeof result === "object") {
      return {
        ok: Boolean(result.ok),
        reason: String(result.reason || "当前步骤暂不可对话修订")
      };
    }
    return { ok: Boolean(result), reason: "当前步骤暂不可对话修订" };
  }

  function syncEditBanner(root, editing) {
    const banner = root.querySelector(`[data-research-chat-edit-banner="${scope}"]`);
    if (!banner) return;
    if (editing) banner.removeAttribute("hidden");
    else banner.setAttribute("hidden", "");
  }
}

function normalizeResultSource(source) {
  if (source === "local" || source === "error" || source === "cancelled") return source;
  return "ai";
}

function isAbortError(error) {
  return error?.name === "AbortError"
    || /aborted|AbortError/i.test(String(error?.message || error || ""));
}
