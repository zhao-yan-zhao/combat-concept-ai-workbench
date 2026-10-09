export function renderAiPromptPanel({ open, catalog, selectedId, saving, drafts = {} }) {
  if (!open) return "";
  const items = catalog?.items || [];
  const selected = items.find((item) => item.id === selectedId) || items[0];
  const writable = Boolean(catalog?.configurationWrite?.enabled);
  const currentContent = (selected && drafts && drafts[selected.id] !== undefined)
    ? drafts[selected.id]
    : (selected?.content || "");
  const hasDraft = Boolean(selected && drafts && drafts[selected.id] !== undefined && drafts[selected.id] !== selected.content);
  const isCustomized = Boolean(selected?.customized) || hasDraft;
  return `
    <div class="ai-modal-backdrop" data-action="close-ai-prompts"></div>
    <dialog class="ai-prompt-dialog" open aria-label="AI 提示词管理">
    <div class="ai-prompt-shell">
      <header class="ai-prompt-header"><div><p class="eyebrow">AI 资产</p><h2>提示词管理</h2><p>浏览并维护实际发送给 AI 的提示词。动态项目上下文由系统在请求时追加。</p></div><button type="button" class="quiet-button" data-action="close-ai-prompts">关闭</button></header>
      <div class="ai-prompt-layout">
        <nav class="ai-prompt-list" aria-label="提示词列表">${items.map((item) => {
          const itemHasDraft = Boolean(drafts && drafts[item.id] !== undefined && drafts[item.id] !== item.content);
          return `<button type="button" class="ai-prompt-item ${item.id === selected?.id ? "is-active" : ""}" data-action="select-ai-prompt" data-prompt-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.group)}${item.customized ? " · 已自定义" : itemHasDraft ? " · 未保存草稿" : ""}</span></button>`;
        }).join("") || `<p class="report-empty">正在读取提示词目录...</p>`}</nav>
        <main class="ai-prompt-editor">${selected ? `<form id="aiPromptForm" class="ai-prompt-form">
          <input type="hidden" name="id" value="${escapeHtml(selected.id)}">
          <div class="ai-prompt-scrollable">
            <div class="ai-prompt-meta"><div><h3>${escapeHtml(selected.name)}</h3><code>${escapeHtml(selected.id)}</code></div><span class="status-tag ${isCustomized ? "review" : ""}">${isCustomized ? (hasDraft ? "已编辑草稿" : "已自定义") : "使用默认值"}</span></div>
            <p>${escapeHtml(selected.description)}</p>
            ${selected.variables?.length ? `<div class="ai-prompt-variables"><strong>系统追加上下文</strong><span>${selected.variables.map(escapeHtml).join(" · ")}</span></div>` : ""}
            <label class="ai-prompt-content-label"><span>提示词正文</span><textarea name="content" rows="20" spellcheck="false" ${writable ? "" : "readonly"}>${escapeHtml(currentContent)}</textarea></label>
          </div>
          <footer class="editor-actions ai-prompt-actions">
            <button type="button" class="quiet-button" data-action="reset-ai-prompt" ${!writable || (!selected.customized && !hasDraft) ? "disabled" : ""} title="恢复为系统默认提示词">恢复默认</button>
            <div class="ai-prompt-actions-right">
              ${hasDraft ? `<span class="ai-prompt-draft-hint">存在未保存草稿</span>` : ""}
              <button type="submit" class="primary-btn ai-prompt-save-btn" ${!writable || saving || !hasDraft ? "disabled" : ""} title="${!hasDraft ? "内容无修改" : "保存修改后的提示词"}">${saving ? "正在保存…" : "保存提示词"}</button>
            </div>
          </footer>
        </form>` : `<p class="report-empty">暂无可用提示词。</p>`}</main>
      </div>
    </div>
  </dialog>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}
