export const PROVIDER_PRESETS = {
  gemini: {
    id: "gemini",
    label: "Google Gemini (本地网关 / Antigravity)",
    baseUrl: "http://127.0.0.1:8045/v1",
    model: "gemini-3.8-flash-high",
    protocol: "responses",
    hint: "Google Gemini：推荐 Responses API 协议，本地网关原生支持 Prompt Caching 上下文缓存，高吞吐低延迟。"
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek (深度求索官方)",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    protocol: "chat",
    hint: "DeepSeek：官方支持全自动前缀上下文缓存，兼容 deepseek-chat 与 deepseek-reasoner（思考链已适配）。"
  },
  qwen: {
    id: "qwen",
    label: "通义千问 (阿里云百炼 DashScope)",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    protocol: "chat",
    hint: "通义千问：阿里云百炼 OpenAI 兼容端点，支持 qwen-plus / qwen-max / qwen-turbo，具备上下文缓存加速能力。"
  },
  openai: {
    id: "openai",
    label: "OpenAI (官方服务)",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5.5",
    protocol: "chat",
    hint: "OpenAI：标准兼容端点与前缀提示词缓存。"
  },
  custom: {
    id: "custom",
    label: "自定义 / 其他兼容服务商",
    baseUrl: "",
    model: "",
    protocol: "auto",
    hint: "自定义端点：可自由配置 Base URL、模型名称与接口协议。"
  }
};

export function renderAiConfigPanel({
  open,
  service,
  saving,
  fetchingModels = false,
  fetchedModels = [],
  modelFetchHint = ""
} = {}) {
  if (!open) return "";
  const config = service?.config || {};
  const unavailable = service?.status === "unavailable";
  const loading = service?.status === "loading";
  const isFetchingModels = fetchingModels || Boolean(service?.fetchingModels);
  const modelsList = (fetchedModels && fetchedModels.length ? fetchedModels : service?.fetchedModels) || [];
  const fetchHint = modelFetchHint || service?.modelFetchHint || "";
  const configured = Boolean(config.configured);
  const writePolicy = config.configurationWrite || {};
  const writable = Boolean(writePolicy.enabled);
  const provider = config.provider || "custom";
  const protocol = config.protocol || "auto";
  const currentPreset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.custom;
  const keySourceLabel = !configured
    ? "未配置密钥（回退至 Mock 生成）"
    : config.apiKeySource === "windows-dpapi"
      ? "本机加密存储 (Windows DPAPI)"
      : config.apiKeySource === "server-environment"
        ? "服务端环境变量 (OPENAI_API_KEY)"
        : "密钥已就绪";

  const currentModel = String(config.model || "gpt-5.5").trim();
  const rawModelCandidates = modelsList.length > 0
    ? modelsList
    : [
        currentModel,
        currentPreset.model,
        "gemini-3.8-flash-high",
        "deepseek-chat",
        "deepseek-reasoner",
        "qwen-plus",
        "gpt-5.5"
      ].filter(Boolean);

  const modelCandidates = Array.from(new Set(rawModelCandidates));
  const isPresetModel = modelCandidates.includes(currentModel);

  return `
    <dialog class="ai-config-dialog" open aria-label="AI 服务配置">
      <div class="ai-config-shell">
        <header class="ai-config-header">
          <div>
            <p class="eyebrow">AI 资产</p>
            <h2>AI 服务配置</h2>
            <p>配置大模型服务商、接口协议、模型与 API Key。敏感凭据本机安全加密持久化。</p>
          </div>
          <div class="ai-config-header-actions">
            <span class="status-tag ${configured ? "" : "review"}">${loading ? "读取中" : configured ? "密钥已配置" : unavailable ? "服务不可用" : "待配置密钥"}</span>
            <button type="button" class="quiet-button" data-action="close-ai-config">关闭</button>
          </div>
        </header>
        <div class="ai-config-body">
          <form class="ai-config-form" id="aiConfigForm">
            <label class="ai-config-full-width">
              <span>服务商预设</span>
              <select name="provider" id="aiConfigProviderSelect">
                <option value="gemini" ${provider === "gemini" ? "selected" : ""}>Google Gemini (本地网关 / Antigravity - 支持 Responses 缓存)</option>
                <option value="deepseek" ${provider === "deepseek" ? "selected" : ""}>DeepSeek (深度求索官方 - 服务端前缀自动缓存)</option>
                <option value="qwen" ${provider === "qwen" ? "selected" : ""}>通义千问 (阿里云百炼 DashScope - 上下文缓存加速)</option>
                <option value="openai" ${provider === "openai" ? "selected" : ""}>OpenAI (官方标准服务)</option>
                <option value="custom" ${provider === "custom" ? "selected" : ""}>自定义兼容端点</option>
              </select>
            </label>
            <label class="ai-config-full-width"><span>服务地址</span><input name="baseUrl" type="url" value="${escapeAttribute(config.baseUrl || "https://api.openai.com/v1")}" required></label>
            <label class="ai-config-model-field ai-config-full-width">
              <span class="ai-config-model-label-row">
                <span>模型</span>
                <button class="quiet-button ai-config-fetch-models-btn" type="button" data-action="fetch-upstream-models" ${isFetchingModels || loading ? "disabled" : ""} title="从上游端点自动拉取可用模型列表">
                  ${isFetchingModels ? "正在获取..." : "获取可用模型"}
                </button>
              </span>
              <select id="aiConfigModelSelect" class="ai-config-model-select">
                ${modelCandidates.map((m) => `
                  <option value="${escapeAttribute(m)}" ${m === currentModel ? "selected" : ""}>${escapeHtml(m)}</option>
                `).join("")}
                <option value="__custom__" ${!isPresetModel ? "selected" : ""}>自定义模型名称...</option>
              </select>
              <input name="model" id="aiConfigModelInput" value="${escapeAttribute(currentModel)}" required maxlength="120" placeholder="请输入自定义模型名称" style="${isPresetModel ? "display:none;margin-top:6px;" : "margin-top:6px;"}">
              ${fetchHint ? `<span class="ai-config-model-fetch-hint">${escapeHtml(fetchHint)}</span>` : ""}
            </label>
            <label class="ai-config-full-width">
              <span>接口协议</span>
              <select name="protocol" id="aiConfigProtocolSelect">
                <option value="auto" ${protocol === "auto" ? "selected" : ""}>自动协商（优先尝试 Responses 协议上下文缓存）</option>
                <option value="responses" ${protocol === "responses" ? "selected" : ""}>Responses API（/responses，推荐，支持上下文缓存 Prompt Caching）</option>
                <option value="chat" ${protocol === "chat" ? "selected" : ""}>Chat Completions（/chat/completions，传统通用兼容）</option>
              </select>
            </label>
            <label class="ai-config-full-width">
              <span>API Key</span>
              <input name="apiKey" type="password" autocomplete="new-password" minlength="16" maxlength="2048" placeholder="${configured ? "已配置密钥（如需更新请输入新密钥，留空则保持现有密钥）" : "请输入 API Key（例如 sk-...）"}">
            </label>
            <div class="ai-config-status-grid ai-config-full-width">
              <div class="ai-config-key-state"><span>当前密钥状态</span><b>${keySourceLabel}</b></div>
              <div class="ai-config-key-state"><span>配置写入权限</span><b>${writable ? "仅负责人登录后可修改" : "已由部署策略禁用"}</b></div>
            </div>
            <p class="ai-config-hint ai-config-provider-hint ai-config-full-width">${escapeHtml(currentPreset.hint || "支持 Prompt Caching 上下文缓存加速；保存的 API Key 将在本机安全加密持久化。")}</p>
            <div class="ai-config-dialog-actions ai-config-full-width">
              <button class="quiet-button ai-config-refresh" type="button" data-action="refresh-ai-config" ${loading ? "disabled" : ""}>刷新状态</button>
              <div class="ai-config-submit-group">
                <button class="quiet-button" type="button" data-action="close-ai-config">关闭</button>
                <button type="submit" ${saving || loading || !writable ? "disabled" : ""}>${saving ? "正在保存" : "保存配置"}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[character]));
}

function escapeAttribute(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[character]));
}
