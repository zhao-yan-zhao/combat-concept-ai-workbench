import { getAiPrompts, saveAiPrompts } from "./aiPromptClient.js";

export function createAiPromptController({ getState, render, notify }) {
  async function load(announce = false) {
    const state = getState();
    try {
      state.aiPromptCatalog = await getAiPrompts();
      state.aiPromptSelectedId ||= state.aiPromptCatalog.items?.[0]?.id || "";
      if (announce) notify("AI 提示词已刷新");
    } catch (error) {
      notify(error.message || "无法读取 AI 提示词");
    }
    render();
  }

  async function persist(nextOverrides) {
    const state = getState();
    state.aiPromptSaving = true;
    render();
    try {
      state.aiPromptCatalog = await saveAiPrompts(nextOverrides);
      notify("AI 提示词已保存，后续请求立即生效");
    } catch (error) {
      notify(error.message || "AI 提示词保存失败");
    } finally {
      state.aiPromptSaving = false;
      render();
    }
  }

  return {
    bind(root) {
      root.querySelector("#aiPromptForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const state = getState();
        const form = new FormData(event.currentTarget);
        const id = String(form.get("id") || "");
        const overrides = Object.fromEntries((state.aiPromptCatalog?.items || []).filter((item) => item.customized).map((item) => [item.id, item.content]));
        overrides[id] = String(form.get("content") || "").trim();
        void persist(overrides);
      });
    },
    handleAction(action, element) {
      const state = getState();
      if (action === "open-ai-prompts") { state.aiPromptOpen = true; render(); void load(); return true; }
      if (action === "close-ai-prompts") { state.aiPromptOpen = false; render(); return true; }
      if (action === "select-ai-prompt") { state.aiPromptSelectedId = element?.dataset.promptId || ""; render(); return true; }
      if (action === "reset-ai-prompt") {
        const overrides = Object.fromEntries((state.aiPromptCatalog?.items || []).filter((item) => item.customized && item.id !== state.aiPromptSelectedId).map((item) => [item.id, item.content]));
        void persist(overrides); return true;
      }
      return false;
    }
  };
}
