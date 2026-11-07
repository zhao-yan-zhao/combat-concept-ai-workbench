export function renderProjectStorageState(storage = {}, { refreshAction = "refresh-project-brief", showSummary = true } = {}) {
  const ready = storage.status === "ready";
  const saving = storage.status === "saving" || storage.status === "checking";
  const stateClass = ready ? "ready" : saving ? "review" : "pending";
  const detail = storage.detail || "浏览器本地草稿可离线继续使用";
  const audit = storage.auditCount ? ` · ${storage.auditCount} 条审计` : "";
  const summary = showSummary
    ? `<div><span class="report-state ${stateClass}">${escapeHtml(storage.label || "本地草稿")}</span><small>${escapeHtml(detail)}${escapeHtml(audit)}</small></div>`
    : "";
  return `<div class="project-storage-state${showSummary ? "" : " is-actions-only"}">${summary}${renderProjectStorageActions(storage, { refreshAction })}</div>`;
}

export function renderProjectStorageActions(storage = {}, { refreshAction = "refresh-project-brief" } = {}) {
  const saving = storage.status === "saving" || storage.status === "checking";
  const loadAction = refreshAction.replace(/^refresh-project-/, "load-project-");
  const restoreAction = refreshAction.replace(/^refresh-project-/, "restore-project-") + "-conflict-draft";
  const loadButton = !saving && (storage.remoteAvailable || storage.conflict)
    ? `<button type="button" class="quiet-button" data-action="${escapeHtml(loadAction)}">载入服务端</button>`
    : "";
  const restoreButton = !saving && storage.conflictDraftAvailable
    ? `<button type="button" class="quiet-button" data-action="${escapeHtml(restoreAction)}">恢复本地冲突草稿</button>`
    : "";
  return `<div class="project-storage-actions"><button type="button" class="quiet-button" data-action="${escapeHtml(refreshAction)}" ${saving ? "disabled" : ""}>刷新</button>${loadButton}${restoreButton}</div>`;
}

export function renderProjectStorageFooter(storage = {}) {
  const isSaving = storage.status === "saving" || storage.status === "checking";
  const isSynced = !isSaving && storage.mode === "server" && (storage.status === "ready" || !storage.localSaved);
  
  let stateTag = "synced";
  let displayLabel = "已同步";
  let detailTip = "服务端已同步 (原生 SQLite 仓储)";

  if (isSaving) {
    stateTag = "saving";
    displayLabel = "保存中…";
    detailTip = "正在向服务端同步最新模型快照与修改…";
  } else if (!isSynced) {
    stateTag = "unsynced";
    displayLabel = "未同步 (本地暂存)";
    detailTip = storage.detail || "当前修改已暂存于浏览器本地草稿，尚未同步至服务端";
  }

  return `<span class="storage-dot storage-dot-${stateTag}" aria-hidden="true"></span> <span class="storage-status-text" title="${escapeHtml(detailTip)}">${escapeHtml(displayLabel)}</span>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
