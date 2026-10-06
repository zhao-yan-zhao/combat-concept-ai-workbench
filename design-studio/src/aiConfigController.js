import { getAiServiceConfig, saveAiServiceConfig } from "./aiConfigClient.js";

export function createAiConfigController({ getState, render, notify, onSaved }) {
  return {
    refresh() {
      const state = getState();
      void loadConfig(state, render, notify, false);
    },

    bind(root) {
      root.querySelector("#aiConfigForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const state = getState();
        void saveConfig(state, new FormData(event.currentTarget), render, notify, onSaved);
      });
    },

    handleAction(action) {
      const state = getState();
      if (action === "open-ai-config") {
        state.aiConfigOpen = true;
        render();
        void loadConfig(state, render, notify, false);
        return true;
      }
      if (action === "close-ai-config") {
        state.aiConfigOpen = false;
        render();
        return true;
      }
      if (action === "refresh-ai-config") {
        void loadConfig(state, render, notify, true);
        return true;
      }
      return false;
    }
  };
}

async function loadConfig(state, render, notify, announce) {
  if (state.aiConfig?.status === "loading") return;
  state.aiConfig = { ...state.aiConfig, status: "loading" };
  render();
  try {
    state.aiConfig = { status: "ready", config: await getAiServiceConfig() };
    if (announce) notify("AI 服务配置已刷新");
  } catch {
    state.aiConfig = { status: "unavailable", config: null };
    if (announce) notify("无法读取 AI 服务配置");
  } finally {
    render();
  }
}

async function saveConfig(state, formData, render, notify, onSaved) {
  if (state.aiConfigSaving) return;
  state.aiConfigSaving = true;
  render();
  try {
    const payload = {
      baseUrl: String(formData.get("baseUrl") || "").trim(),
      model: String(formData.get("model") || "").trim()
    };
    const apiKey = String(formData.get("apiKey") || "").trim();
    if (apiKey) {
      payload.apiKey = apiKey;
    }
    const config = await saveAiServiceConfig(payload);
    state.aiConfig = { status: "ready", config };
    notify(config.configured ? "AI 服务配置已保存" : "配置已保存，仍需设置 API Key");
    onSaved?.();
  } catch (error) {
    const message = error.message || "AI 服务配置保存失败";
    notify(/lead|login|403/i.test(message) ? "保存失败：需要负责人登录后方可修改 AI 服务配置" : message);
  } finally {
    state.aiConfigSaving = false;
    render();
  }
}
