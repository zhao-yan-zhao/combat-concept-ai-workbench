export function renderAiConfigPanel({ open, service, saving }) {
  if (!open) return "";
  const config = service?.config || {};
  const unavailable = service?.status === "unavailable";
  const loading = service?.status === "loading";
  const configured = Boolean(config.configured);
  const writePolicy = config.configurationWrite || {};
  const writable = Boolean(writePolicy.enabled);
  const keySourceLabel = !configured
    ? "未配置密钥（回退至 Mock 生成）"
    : config.apiKeySource === "windows-dpapi"
      ? "本机加密存储 (Windows DPAPI)"
      : config.apiKeySource === "server-environment"
        ? "服务端环境变量 (OPENAI_API_KEY)"
        : "密钥已就绪";

  return `
    <section class="surface surface-pad ai-config-panel" aria-label="AI 服务配置">
      <div class="section-heading"><div><h2>AI 服务配置</h2><p>配置 OpenAI 兼容端点、模型与 API Key。</p></div><span class="status-tag ${configured ? "" : "review"}">${loading ? "读取中" : configured ? "密钥已配置" : unavailable ? "服务不可用" : "待配置密钥"}</span></div>
      <form class="ai-config-form" id="aiConfigForm">
        <label><span>服务地址</span><input name="baseUrl" type="url" value="${escapeAttribute(config.baseUrl || "https://api.openai.com/v1")}" required></label>
        <label><span>模型</span><input name="model" value="${escapeAttribute(config.model || "gpt-5.5")}" required maxlength="120"></label>
        <label class="ai-config-full-width">
          <span>API Key</span>
          <input name="apiKey" type="password" autocomplete="new-password" minlength="16" maxlength="2048" placeholder="${configured ? "已配置密钥（如需更新请输入新密钥，留空则保持现有密钥）" : "请输入 API Key（例如 sk-...）"}">
        </label>
        <div class="ai-config-key-state"><span>当前密钥状态</span><b>${keySourceLabel}</b></div>
        <div class="ai-config-key-state"><span>配置写入权限</span><b>${writable ? "仅负责人登录后可修改" : "已由部署策略禁用"}</b></div>
        <p class="ai-config-hint ai-config-full-width">保存的 API Key 将使用 Windows DPAPI 在本机安全加密持久化，不在前端回显；若无需修改密钥请留空。</p>
        <div class="editor-actions ai-config-full-width"><button class="quiet-button" type="button" data-action="close-ai-config">关闭</button><button type="submit" ${saving || loading || !writable ? "disabled" : ""}>${saving ? "正在保存" : "保存配置"}</button></div>
      </form>
      <button class="quiet-button ai-config-refresh" type="button" data-action="refresh-ai-config" ${loading ? "disabled" : ""}>刷新状态</button>
    </section>
  `;
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
