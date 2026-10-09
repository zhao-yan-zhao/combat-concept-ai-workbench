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
    render({ skipViewRoot: true });
  }

  async function persist(nextOverrides) {
    const state = getState();
    state.aiPromptSaving = true;
    render({ skipViewRoot: true });
    try {
      state.aiPromptCatalog = await saveAiPrompts(nextOverrides);
      notify("AI 提示词已保存，后续请求立即生效");
    } catch (error) {
      notify(error.message || "AI 提示词保存失败");
    } finally {
      state.aiPromptSaving = false;
      render({ skipViewRoot: true });
    }
  }

  return {
    bind(root) {
      const form = root.querySelector("#aiPromptForm");
      if (!form) return;
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const state = getState();
        const formData = new FormData(event.currentTarget);
        const id = String(formData.get("id") || "");
        const overrides = Object.fromEntries((state.aiPromptCatalog?.items || []).filter((item) => item.customized).map((item) => [item.id, item.content]));
        overrides[id] = String(formData.get("content") || "").trim();
        if (state.aiPromptDrafts) delete state.aiPromptDrafts[id];
        void persist(overrides);
      });
      const textarea = form.querySelector('textarea[name="content"]');
      const saveBtn = form.querySelector('.ai-prompt-save-btn');
      const resetBtn = form.querySelector('[data-action="reset-ai-prompt"]');
      const rightActions = form.querySelector('.ai-prompt-actions-right');

      function updateDraftUi(val) {
        const state = getState();
        const selected = (state.aiPromptCatalog?.items || []).find((item) => item.id === state.aiPromptSelectedId);
        const originalContent = selected?.content || "";
        const isDirty = val !== originalContent;
        const writable = Boolean(state.aiPromptCatalog?.configurationWrite?.enabled);
        if (isDirty) {
          state.aiPromptDrafts ||= {};
          state.aiPromptDrafts[state.aiPromptSelectedId] = val;
        } else if (state.aiPromptDrafts) {
          delete state.aiPromptDrafts[state.aiPromptSelectedId];
        }
        if (saveBtn) {
          saveBtn.disabled = !writable || !isDirty || Boolean(state.aiPromptSaving);
          saveBtn.title = isDirty ? "保存修改后的提示词" : "内容无修改";
        }
        if (resetBtn) {
          const canReset = writable && (Boolean(selected?.customized) || isDirty);
          resetBtn.disabled = !canReset;
        }
        let hint = form.querySelector(".ai-prompt-draft-hint");
        if (isDirty) {
          if (!hint && rightActions && saveBtn) {
            hint = document.createElement("span");
            hint.className = "ai-prompt-draft-hint";
            hint.textContent = "存在未保存草稿";
            rightActions.insertBefore(hint, saveBtn);
          }
        } else if (hint) {
          hint.remove();
        }
      }

      textarea?.addEventListener("input", (event) => {
        updateDraftUi(event.target.value);
      });
      textarea?.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
          event.preventDefault();
          if (saveBtn && !saveBtn.disabled) {
            form.requestSubmit();
          }
        }
      });
    },
    handleAction(action, element) {
      const state = getState();
      if (action === "open-ai-prompts") { state.aiPromptOpen = true; render({ skipViewRoot: true }); void load(); return true; }
      if (action === "close-ai-prompts") { state.aiPromptOpen = false; render({ skipViewRoot: true }); return true; }
      if (action === "select-ai-prompt") {
        const promptId = element?.dataset?.promptId || element?.closest?.("[data-prompt-id]")?.dataset?.promptId || "";
        if (!promptId || state.aiPromptSelectedId === promptId) return true;
        const promptList = document.querySelector(".ai-prompt-list");
        const listScrollTop = promptList ? promptList.scrollTop : 0;
        state.aiPromptSelectedId = promptId;
        render({ skipViewRoot: true });
        const nextPromptList = document.querySelector(".ai-prompt-list");
        if (nextPromptList) nextPromptList.scrollTop = listScrollTop;
        requestAnimationFrame(() => document.querySelector(`.ai-prompt-item.is-active[data-prompt-id="${CSS.escape(promptId)}"]`)?.scrollIntoView?.({ block: "nearest", inline: "nearest" }));
        return true;
      }
      if (action === "reset-ai-prompt") {
        const selected = (state.aiPromptCatalog?.items || []).find((item) => item.id === state.aiPromptSelectedId);
        const hasDraft = Boolean(state.aiPromptDrafts && state.aiPromptDrafts[state.aiPromptSelectedId] !== undefined && state.aiPromptDrafts[state.aiPromptSelectedId] !== selected?.content);
        const isCustomized = Boolean(selected?.customized) || hasDraft;
        if (isCustomized) {
          const confirmed = typeof window !== "undefined" && typeof window.confirm === "function"
            ? window.confirm("确定要恢复默认提示词吗？当前未保存草稿或自定义内容将被清除。")
            : true;
          if (!confirmed) return true;
        }
        const overrides = Object.fromEntries((state.aiPromptCatalog?.items || []).filter((item) => item.customized && item.id !== state.aiPromptSelectedId).map((item) => [item.id, item.content]));
        if (state.aiPromptDrafts) delete state.aiPromptDrafts[state.aiPromptSelectedId];
        void persist(overrides); return true;
      }
      return false;
    }
  };
}
