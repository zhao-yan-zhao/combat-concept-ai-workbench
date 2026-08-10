import { addInspirationReply, createInspirationSession, saveInspirationSession, summarizeInspirationSession, updateInspirationAnswers } from "./inspirationStore.js";

export function createInspirationController({ getState, render, notify, clearSuggestions = () => {}, syncConversation = () => {} }) {
  return {
    bind(root) {
      root.querySelector("#inspirationForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const text = String(new FormData(form).get("reply") || "").trim();
        if (!text) return;
        const state = getState();
        state.inspiration = saveInspirationSession(addInspirationReply(state.inspiration, text));
        clearSuggestions();
        syncConversation();
        render();
      });
      root.querySelector("#inspirationAnswersForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const state = getState();
        const values = Object.fromEntries(new FormData(event.currentTarget).entries());
        state.inspiration = saveInspirationSession(updateInspirationAnswers(state.inspiration, values));
        syncConversation();
        notify("已更新结构化灵感提取；尚未自动写入概念简报");
        render();
      });
    },

    handleAction(action) {
      const state = getState();
      if (action === "reset-inspiration") {
        state.inspiration = saveInspirationSession(createInspirationSession());
        clearSuggestions();
        syncConversation();
        notify("灵感孵化会话已重置");
        render();
        return true;
      }
      if (action === "apply-inspiration-summary") {
        const summary = summarizeInspirationSession(state.inspiration);
        if (!summary) {
          notify("请先记录一条研究灵感");
          return true;
        }
        state.briefIntent = summary;
        notify("会话摘要已填入简报研究意图");
        render();
        return true;
      }
      return false;
    }
  };
}
