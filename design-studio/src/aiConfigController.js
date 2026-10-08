import { fetchUpstreamModels, getAiServiceConfig, saveAiServiceConfig } from "./aiConfigClient.js";
import { PROVIDER_PRESETS } from "./aiConfigView.js";

export function createAiConfigController({ getState, render, notify, onSaved }) {
  return {
    refresh() {
      const state = getState();
      void loadConfig(state, render, notify, false);
    },

    bind(root) {
      const form = root.querySelector("#aiConfigForm");
      if (!form) return;

      const state = getState();
      setupModelSelectInteraction(form, state);

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const currentState = getState();
        void saveConfig(currentState, new FormData(event.currentTarget), render, notify, onSaved);
      });

      const providerSelect = form.querySelector("#aiConfigProviderSelect");
      providerSelect?.addEventListener("change", (event) => {
        const selected = String(event.target.value || "custom").trim();
        const preset = PROVIDER_PRESETS[selected];
        const currentState = getState();
        currentState.aiConfigFetchedModels = [];
        currentState.aiConfigModelFetchHint = "";

        const hintEl = form.querySelector(".ai-config-model-fetch-hint");
        if (hintEl) hintEl.textContent = "";

        if (preset && selected !== "custom") {
          const baseUrlInput = form.querySelector('input[name="baseUrl"]');
          const modelInput = form.querySelector('input[name="model"]');
          const modelSelect = form.querySelector("#aiConfigModelSelect");
          const protocolSelect = form.querySelector('select[name="protocol"]');
          const hintElement = form.querySelector(".ai-config-provider-hint");

          if (baseUrlInput) baseUrlInput.value = preset.baseUrl;
          if (protocolSelect) protocolSelect.value = preset.protocol;
          if (hintElement) hintElement.textContent = preset.hint;

          if (modelSelect && modelInput) {
            applyModelValue(modelSelect, modelInput, preset.model);
          }
        }
      });

      const fetchModelsBtn = form.querySelector('[data-action="fetch-upstream-models"]');
      fetchModelsBtn?.addEventListener("click", (event) => {
        event.preventDefault();
        const currentState = getState();
        void fetchModels(currentState, render, notify);
      });
    },

    handleAction(action) {
      const state = getState();
      if (action === "open-ai-config") {
        state.aiConfigOpen = true;
        if (state.aiConfig?.status !== "ready") {
          state.aiConfig = { ...state.aiConfig, status: "loading" };
        }
        render({ skipViewRoot: true });
        void loadConfig(state, render, notify, false);
        return true;
      }
      if (action === "close-ai-config") {
        state.aiConfigOpen = false;
        render({ skipViewRoot: true });
        return true;
      }
      if (action === "refresh-ai-config") {
        void loadConfig(state, render, notify, true);
        return true;
      }
      if (action === "fetch-upstream-models") {
        void fetchModels(state, render, notify);
        return true;
      }
      return false;
    }
  };
}

async function loadConfig(state, render, notify, announce) {
  if (state.aiConfig?.status === "loading" && state.aiConfigOpen) {
    // Already set to loading and rendered once upon opening, skip duplicate render
  } else {
    if (state.aiConfig?.status === "loading") return;
    state.aiConfig = { ...state.aiConfig, status: "loading" };
    render({ skipViewRoot: true });
  }
  try {
    state.aiConfig = { status: "ready", config: await getAiServiceConfig() };
    if (announce) notify("AI 服务配置已刷新");
  } catch {
    state.aiConfig = { status: "unavailable", config: null };
    if (announce) notify("无法读取 AI 服务配置");
  } finally {
    render({ skipViewRoot: true });
  }
}

async function saveConfig(state, formData, render, notify, onSaved) {
  if (state.aiConfigSaving) return;
  state.aiConfigSaving = true;
  render({ skipViewRoot: true });
  try {
    const payload = {
      provider: String(formData.get("provider") || "custom").trim(),
      baseUrl: String(formData.get("baseUrl") || "").trim(),
      model: String(formData.get("model") || "").trim(),
      protocol: String(formData.get("protocol") || "auto").trim()
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
    render({ skipViewRoot: true });
  }
}

async function fetchModels(state, render, notify) {
  if (state.aiConfigFetchingModels) return;

  const form = document.querySelector("#aiConfigForm");
  const baseUrlInput = form?.querySelector('input[name="baseUrl"]');
  const apiKeyInput = form?.querySelector('input[name="apiKey"]');
  const modelInput = form?.querySelector('input[name="model"]');
  const modelSelect = form?.querySelector("#aiConfigModelSelect");
  const fetchBtn = form?.querySelector('[data-action="fetch-upstream-models"]');
  let hintEl = form?.querySelector(".ai-config-model-fetch-hint");

  const baseUrl = String(baseUrlInput?.value || state.aiConfig?.config?.baseUrl || "").trim();
  const apiKey = String(apiKeyInput?.value || "").trim();

  if (!baseUrl) {
    notify("请先填写服务地址（Base URL）");
    return;
  }

  state.aiConfigFetchingModels = true;
  if (fetchBtn) {
    fetchBtn.disabled = true;
    fetchBtn.textContent = "正在获取...";
  }

  if (!hintEl && modelSelect?.parentElement) {
    hintEl = document.createElement("span");
    hintEl.className = "ai-config-model-fetch-hint";
    modelSelect.parentElement.appendChild(hintEl);
  }
  if (hintEl) {
    hintEl.textContent = "正在连接上游服务并获取可用模型...";
    hintEl.style.color = "var(--muted, #94a3b8)";
  }

  try {
    const payload = { baseUrl };
    if (apiKey) payload.apiKey = apiKey;
    const result = await fetchUpstreamModels(payload);
    const models = Array.isArray(result?.models) ? result.models : [];

    if (!models.length) {
      throw new Error("上游未返回任何模型名称");
    }

    state.aiConfigFetchedModels = models;
    state.aiConfigModelFetchHint = `成功获取 ${models.length} 个可用模型，请在下拉框中选择`;

    if (modelSelect) {
      const currentVal = modelInput?.value.trim() || "";
      modelSelect.innerHTML = `
        ${models.map((m) => `<option value="${escapeAttr(m)}">${escapeHtml(m)}</option>`).join("")}
        <option value="__custom__">自定义模型名称...</option>
      `;

      if (models.includes(currentVal)) {
        modelSelect.value = currentVal;
        if (modelInput) modelInput.style.display = "none";
      } else if (currentVal && currentVal !== "gpt-5.5") {
        const opt = document.createElement("option");
        opt.value = currentVal;
        opt.textContent = `${currentVal} (当前值)`;
        modelSelect.insertBefore(opt, modelSelect.lastElementChild);
        modelSelect.value = currentVal;
        if (modelInput) modelInput.style.display = "none";
      } else {
        modelSelect.value = models[0];
        if (modelInput) {
          modelInput.value = models[0];
          modelInput.style.display = "none";
        }
      }
    }

    if (hintEl) {
      hintEl.textContent = `已成功获取 ${models.length} 个上游模型，可在下拉框直接点选`;
      hintEl.style.color = "#38bdf8";
    }

    notify(`已成功从上游获取 ${models.length} 个模型`);
  } catch (error) {
    const message = error.message || "获取上游模型失败";
    state.aiConfigModelFetchHint = `获取失败: ${message}`;
    if (hintEl) {
      hintEl.textContent = `获取失败: ${message}`;
      hintEl.style.color = "#f87171";
    }
    notify(/lead|login|403/i.test(message) ? "获取失败：需要负责人登录后方可探测上游服务" : `获取上游模型失败: ${message}`);
  } finally {
    state.aiConfigFetchingModels = false;
    if (fetchBtn) {
      fetchBtn.disabled = false;
      fetchBtn.textContent = "获取可用模型";
    }
  }
}

function setupModelSelectInteraction(form, state) {
  const modelSelect = form.querySelector("#aiConfigModelSelect");
  const modelInput = form.querySelector("#aiConfigModelInput");

  if (!modelSelect || !modelInput) return;

  modelSelect.addEventListener("change", () => {
    const val = modelSelect.value;
    if (val === "__custom__") {
      modelInput.style.display = "block";
      modelInput.focus();
    } else {
      modelInput.value = val;
      modelInput.style.display = "none";
    }
  });

  modelInput.addEventListener("input", () => {
    if (modelSelect.value !== "__custom__") {
      modelSelect.value = "__custom__";
    }
  });
}

function applyModelValue(select, input, targetModel) {
  if (!select || !input) return;
  const target = String(targetModel || "").trim();
  let found = false;

  for (let i = 0; i < select.options.length; i += 1) {
    if (select.options[i].value === target) {
      select.selectedIndex = i;
      found = true;
      break;
    }
  }

  if (found) {
    input.value = target;
    input.style.display = "none";
  } else if (target) {
    const opt = document.createElement("option");
    opt.value = target;
    opt.textContent = target;
    select.insertBefore(opt, select.lastElementChild);
    select.value = target;
    input.value = target;
    input.style.display = "none";
  } else {
    select.value = "__custom__";
    input.value = "";
    input.style.display = "block";
  }
}

function escapeAttr(value) {
  return String(value || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[c]));
}

function escapeHtml(value) {
  return escapeAttr(value);
}
