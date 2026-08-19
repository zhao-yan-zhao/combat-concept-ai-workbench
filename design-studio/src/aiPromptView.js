export function renderAiPromptPanel({ open, catalog, selectedId, saving }) {
  if (!open) return "";
  const items = catalog?.items || [];
  const selected = items.find((item) => item.id === selectedId) || items[0];
  const writable = Boolean(catalog?.configurationWrite?.enabled);
  return `<dialog class="ai-prompt-dialog" open aria-label="AI 提示词管理">
    <div class="ai-prompt-shell">
      <header class="ai-prompt-header"><div><p class="eyebrow">AI 资产</p><h2>提示词管理</h2><p>浏览并维护实际发送给 AI 的提示词。动态项目上下文由系统在请求时追加。</p></div><button type="button" class="quiet-button" data-action="close-ai-prompts">关闭</button></header>
      <div class="ai-prompt-layout">
        <nav class="ai-prompt-list" aria-label="提示词列表">${items.map((item) => `<button type="button" class="ai-prompt-item ${item.id === selected?.id ? "is-active" : ""}" data-action="select-ai-prompt" data-prompt-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.group)}${item.customized ? " · 已自定义" : ""}</span></button>`).join("") || `<p class="report-empty">正在读取提示词目录...</p>`}</nav>
        <main class="ai-prompt-editor">${selected ? `<form id="aiPromptForm">
          <input type="hidden" name="id" value="${escapeHtml(selected.id)}">
          <div class="ai-prompt-meta"><div><h3>${escapeHtml(selected.name)}</h3><code>${escapeHtml(selected.id)}</code></div><span class="status-tag ${selected.customized ? "review" : ""}">${selected.customized ? "已自定义" : "使用默认值"}</span></div>
          <p>${escapeHtml(selected.description)}</p>
          ${selected.variables?.length ? `<div class="ai-prompt-variables"><strong>系统追加上下文</strong><span>${selected.variables.map(escapeHtml).join(" · ")}</span></div>` : ""}
          <label><span>提示词正文</span><textarea name="content" rows="22" spellcheck="false" ${writable ? "" : "readonly"}>${escapeHtml(selected.content)}</textarea></label>
          <div class="editor-actions"><button type="button" class="quiet-button" data-action="reset-ai-prompt" ${!writable || !selected.customized ? "disabled" : ""}>恢复默认</button><button type="submit" ${!writable || saving ? "disabled" : ""}>${saving ? "正在保存" : "保存提示词"}</button></div>
        </form>` : `<p class="report-empty">暂无可用提示词。</p>`}</main>
      </div>
    </div>
  </dialog>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}
