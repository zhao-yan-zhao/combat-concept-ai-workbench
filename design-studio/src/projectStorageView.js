export function renderProjectStorageState(storage = {}, { refreshAction = "refresh-project-brief" } = {}) {
  const ready = storage.status === "ready";
  const saving = storage.status === "saving" || storage.status === "checking";
  const stateClass = ready ? "ready" : saving ? "review" : "pending";
  const detail = storage.detail || "浏览器本地草稿可离线继续使用";
  const audit = storage.auditCount ? ` · ${storage.auditCount} 条审计` : "";
  const loadAction = refreshAction.replace(/^refresh-project-/, "load-project-");
  const restoreAction = refreshAction.replace(/^refresh-project-/, "restore-project-") + "-conflict-draft";
  const loadButton = !saving && (storage.remoteAvailable || storage.conflict)
    ? `<button type="button" class="quiet-button" data-action="${escapeHtml(loadAction)}">载入服务端</button>`
    : "";
  const restoreButton = !saving && storage.conflictDraftAvailable
    ? `<button type="button" class="quiet-button" data-action="${escapeHtml(restoreAction)}">恢复本地冲突草稿</button>`
    : "";
  return `<div class="project-storage-state"><div><span class="report-state ${stateClass}">${escapeHtml(storage.label || "本地草稿")}</span><small>${escapeHtml(detail)}${escapeHtml(audit)}</small></div><div class="project-storage-actions"><button type="button" class="quiet-button" data-action="${escapeHtml(refreshAction)}" ${saving ? "disabled" : ""}>刷新</button>${loadButton}${restoreButton}</div></div>`;
}

export function renderProjectStorageFooter(storage = {}) {
  const label = storage.mode === "server" ? storage.label || "服务端已同步" : storage.label || "本地草稿已保存";
  return `<span></span> ${escapeHtml(label)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
