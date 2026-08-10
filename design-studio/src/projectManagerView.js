/** Top-menubar project switcher (dropdown panel under trigger). */
export function renderProjectManager({ directory = {}, activeProjectId = "default", open = false, createOpen = false, isLead = false } = {}) {
  const projects = directory.projects || [];
  const active = projects.find((item) => item.id === activeProjectId);
  const activeTitle = active?.title || activeProjectId || "研究项目";
  const count = projects.filter((item) => !item.archived).length;
  const trigger = `<button type="button" class="project-manager-trigger" data-action="toggle-project-manager" aria-expanded="${open ? "true" : "false"}"><span class="project-manager-trigger-label">项目</span><strong title="${escapeHtml(activeTitle)}">${escapeHtml(activeTitle)}</strong><b>${count}</b><i class="project-manager-caret" aria-hidden="true"></i></button>`;
  if (!open) return `<div class="project-manager-root is-top">${trigger}</div>`;
  const rows = projects.map((item) => {
    const isActive = item.id === activeProjectId;
    const status = item.archived ? "已归档" : isActive ? "当前项目" : "可进入";
    const deleteAction = isLead && item.archived && !isActive && item.id !== "default" ? `<button type="button" class="project-row-delete" data-project-delete="${escapeHtml(item.id)}" data-project-title="${escapeHtml(item.title)}">删除</button>` : "";
    return `<article class="project-manager-row ${isActive ? "is-active" : ""}"><div class="project-manager-row-main"><strong title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</strong><div class="project-manager-row-meta"><span title="${escapeHtml(item.id)}">${escapeHtml(item.id)}</span><small>${status}</small></div></div><div class="project-manager-row-actions">${!isActive ? `<button type="button" data-project-switch="${escapeHtml(item.id)}">进入</button>` : ""}${isLead ? `<button type="button" class="project-row-link" data-project-archive="${escapeHtml(item.id)}" data-project-archived="${item.archived ? "false" : "true"}">${item.archived ? "恢复" : "归档"}</button>` : ""}${deleteAction}</div></article>`;
  }).join("") || `<p class="project-manager-empty">暂无研究项目。</p>`;
  const form = createOpen ? `<form id="projectCreateForm" class="project-manager-form"><label>项目名称<input name="title" required maxlength="120" autofocus></label><label>项目标识<input name="id" required minlength="2" maxlength="64" pattern="[a-z0-9][a-z0-9_-]{1,63}" placeholder="research-202607"></label><label>研究说明<textarea name="description" maxlength="500" rows="2"></textarea></label><div><button type="submit">创建并进入</button><button type="button" class="project-row-link" data-action="toggle-project-create">取消</button></div></form>` : "";
  return `<div class="project-manager-root is-top is-open">${trigger}<section class="project-manager-panel" role="dialog" aria-label="研究项目管理" tabindex="-1"><div class="project-manager-heading"><span>研究项目</span><button type="button" class="project-row-link" data-action="toggle-project-create">${createOpen ? "收起" : "+ 新建"}</button></div><div class="project-manager-list">${rows}</div>${form}</section></div>`;
}

function escapeHtml(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
