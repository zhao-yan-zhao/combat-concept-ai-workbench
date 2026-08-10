import { renderProjectStorageState } from "./projectStorageView.js";

const RESOURCE_LABELS = {
  brief: "概念简报",
  ov1: "OV-1",
  ov5: "OV-5",
  ooda: "OODA",
  scenario: "自动想定",
  validation: "设计验证",
  knowledge: "知识库",
  report: "成果报告"
};

export function renderCollaboration(state) {
  const collaboration = state.collaboration || {};
  const policy = collaboration.policy || { mode: "loading", authentication: "not-configured", actors: [] };
  const allReviews = collaboration.reviews || [];
  const reviews = filterReviews(allReviews, collaboration.reviewFilter || "open");
  const ready = collaboration.status === "ready";
  return `
    <section class="surface surface-pad">
      <div class="section-heading"><div><h2>协同审阅</h2><p>审阅与决议由项目仓库追加保存，并以项目修订号实施乐观并发控制。</p></div><button class="quiet-button" data-action="refresh-collaboration" ${collaboration.status === "loading" ? "disabled" : ""}>刷新</button></div>
      ${renderPolicy(policy, ready, collaboration.session)}
      ${renderRemoteUpdateNotice(collaboration)}
      ${renderProjectStorageState(collaboration.storage, { refreshAction: "refresh-collaboration" })}
      ${ready ? renderIdentityAndReview(state) : `<p class="report-empty">${escapeHtml(collaboration.detail || "正在读取协同审阅状态。")}</p>`}
    </section>
    ${renderReviewFilters(allReviews, collaboration.reviewFilter || "open")}
    <section class="surface surface-pad">
      <div class="section-heading"><div><h2>审阅事件</h2><p>${reviews.length} 条记录，${Number(collaboration.openCount || 0)} 条待决议。</p></div><span class="mini-tag">项目 r${Number(collaboration.revision || state.projectRevision || 0)}</span></div>
      <div class="collaboration-review-list">${reviews.map((review) => renderReview(review, collaboration.session, collaboration.revision)).join("") || `<p class="report-empty">尚未提交协同审阅。</p>`}</div>
    </section>
    <section class="surface surface-pad">
      <div class="section-heading"><div><h2>项目变更审计</h2><p>记录已保存项目资源的修订来源；启用项目写入认证后显示服务端验证的操作者。</p></div><div class="project-audit-actions"><span class="mini-tag">${(collaboration.auditEntries || []).length} 条</span><button type="button" class="quiet-button" data-action="export-project-audit">导出 JSON</button></div></div>
      <div class="collaboration-audit-list">${renderProjectAudit(collaboration.auditEntries || [])}</div>
    </section>
  `;
}

export function renderAccountManagement(state) {
  const collaboration = state.collaboration || {};
  const session = collaboration.session || {};
  const ready = collaboration.status === "ready";
  const policy = collaboration.policy || { mode: "loading", authentication: "not-configured" };
  return `
    <section class="surface surface-pad account-management-panel">
      <div class="section-heading">
        <div>
          <h2>账号管理</h2>
          <p>管理协同登录身份、负责人账号与安全事件；审阅与决议请使用「协同审阅」。</p>
        </div>
        <div class="account-session-actions">
          <button class="quiet-button" type="button" data-action="open-collaboration">打开协同审阅</button>
          <button class="quiet-button" type="button" data-action="refresh-collaboration" ${collaboration.status === "loading" ? "disabled" : ""}>刷新</button>
        </div>
      </div>
      ${renderPolicy(policy, ready, session)}
      ${ready ? renderAccountManagementBody(state) : `<p class="report-empty">${escapeHtml(collaboration.detail || "正在读取账号状态。")}</p>`}
    </section>
  `;
}

export function renderCollaborationLoginGate(collaboration = {}) {
  const session = collaboration.session || {};
  if (session.authenticated) return "";
  const busy = Boolean(collaboration.authBusy);
  const error = String(collaboration.authError || "").trim();
  const notice = String(collaboration.authNotice || "").trim();
  const checking = collaboration.status === "checking" || collaboration.status === "loading";
  const draft = collaboration.authDraft || {};
  const form = session.setupRequired
    ? renderSetupForm({ busy, error, notice, draft })
    : renderLoginForm({
      mode: collaboration.authMode === "register" ? "register" : "login",
      busy,
      error,
      notice,
      checking,
      draft
    });
  const status = checking
    ? "正在确认账号状态…"
    : session.setupRequired
      ? "首次使用请初始化负责人账号，完成后即可进入工作台。"
      : "使用协同账号验证身份后进入工作台。";
  return `<div class="login-gate-panel" data-auth-busy="${busy ? "true" : "false"}">
    <div class="login-gate-brand">
      <span>Combat Concept Design</span>
      <h1>作战概念设计工具</h1>
      <p>${escapeHtml(status)}</p>
    </div>
    ${form}
  </div>`;
}

function renderRemoteUpdateNotice(collaboration) {
  if (!collaboration.remoteChangeAvailable) return "";
  const revision = Number(collaboration.remoteRevision || 0);
  const updatedAt = collaboration.remoteUpdatedAt ? ` · ${escapeHtml(collaboration.remoteUpdatedAt)}` : "";
  return `<div class="idea-prompt collaboration-remote-update"><p>检测到服务端项目 r${revision} 已更新${updatedAt}。本地模型尚未自动变更；请刷新协同审阅，并按各模型的显式载入与冲突恢复流程复核。</p></div>`;
}

function renderPolicy(policy, ready, session) {
  const mode = policy.mode === "local-managed-accounts" ? "内网自管协同账号" : policy.mode === "local-prototype-policy" ? "本地受控原型策略" : "协同策略未就绪";
  const auth = policy.authentication === "local-password-session" ? "本地密码与服务端会话" : policy.authentication === "not-configured" ? "未配置生产认证" : policy.authentication || "未知";
  const actor = session?.actor;
  return `<div class="collaboration-policy ${ready ? "" : "pending"}"><span class="status-tag review">${escapeHtml(mode)}</span><p>${escapeHtml(auth)}。${actor ? `当前登录：${escapeHtml(actor.label)}（${escapeHtml(actor.roles.join(" / "))}）。` : "尚未登录协同身份。"}</p><small>默认本地试用仅将账号用于协同审阅与负责人决议；部署启用项目写入认证后，模型、归档和快照同步也需要已登录研究员、审阅员或负责人。</small></div>`;
}

function renderSetupForm({ busy = false, error = "", notice = "", draft = {} } = {}) {
  return `<div class="login-auth-card">
    <form id="collaborationSetupForm" class="collaboration-auth-form login-auth-form" method="post" action="/api/collaboration/auth/setup" autocomplete="on" novalidate>
      <div class="login-auth-heading">
        <h3>初始化负责人</h3>
        <p>创建首个本地协同账号（研究员 / 审阅员 / 负责人）</p>
      </div>
      ${renderAuthAlert(error, notice)}
      <label class="login-field"><span>用户名</span><input name="username" autocomplete="username" minlength="3" maxlength="64" required placeholder="例如 research-lead" value="${escapeHtml(draft.username || "")}" ${busy ? "disabled" : ""}></label>
      <label class="login-field"><span>显示名称</span><input name="label" autocomplete="name" maxlength="80" required placeholder="例如 概念研究负责人" value="${escapeHtml(draft.label || "")}" ${busy ? "disabled" : ""}></label>
      ${renderPasswordField({ name: "password", label: "密码", autocomplete: "new-password", placeholder: "至少 12 位", minlength: 12, busy, id: "setup-password" })}
      ${renderPasswordField({ name: "confirmPassword", label: "确认密码", autocomplete: "new-password", placeholder: "再次输入密码", minlength: 12, busy, id: "setup-password-confirm" })}
      <p class="login-auth-hint">密码长度 12～256 位。初始化后可用该账号登录并管理其他账号。</p>
      <button type="submit" class="login-submit" ${busy ? "disabled" : ""}>${busy ? "正在创建…" : "创建负责人并登录"}</button>
    </form>
  </div>`;
}

function renderLoginForm({ mode = "login", busy = false, error = "", notice = "", checking = false, draft = {} } = {}) {
  const showRegister = mode === "register";
  // Only mount the active form so password managers see a single username/password pair
  // (coexisting hidden register fields often block "save password" prompts).
  const form = showRegister
    ? `<form id="collaborationRegisterForm" class="collaboration-auth-form login-auth-form" method="post" action="/api/collaboration/auth/register" autocomplete="on" novalidate>
      <div class="login-auth-heading">
        <h3>注册研究员账号</h3>
        <p>创建本地研究员身份（需已有负责人账号）</p>
      </div>
      ${renderAuthAlert(error, notice)}
      <label class="login-field"><span>用户名</span><input name="username" autocomplete="username" minlength="3" maxlength="64" required placeholder="至少 3 位" value="${escapeHtml(draft.username || "")}" ${busy ? "disabled" : ""}></label>
      <label class="login-field"><span>显示名称</span><input name="label" autocomplete="name" maxlength="80" required placeholder="界面显示的名称" value="${escapeHtml(draft.label || "")}" ${busy ? "disabled" : ""}></label>
      ${renderPasswordField({ name: "password", label: "密码", autocomplete: "new-password", placeholder: "至少 12 位", minlength: 12, busy, id: "register-password" })}
      ${renderPasswordField({ name: "confirmPassword", label: "确认密码", autocomplete: "new-password", placeholder: "再次输入密码", minlength: 12, busy, id: "register-password-confirm" })}
      <p class="login-auth-hint">密码长度 12～256 位。注册成功后将自动登录。</p>
      <button type="submit" class="login-submit" ${busy ? "disabled" : ""}>${busy ? "正在注册…" : "立即注册"}</button>
    </form>`
    : `<form id="collaborationLoginForm" class="collaboration-auth-form login-auth-form" method="post" action="/api/collaboration/auth/login" autocomplete="on" novalidate>
      <div class="login-auth-heading">
        <h3>登录工作台</h3>
        <p>使用已有协同账号进入研究流程</p>
      </div>
      ${renderAuthAlert(error, notice)}
      <label class="login-field"><span>用户名</span><input name="username" autocomplete="username" maxlength="64" required placeholder="输入用户名" value="${escapeHtml(draft.username || "")}" ${busy ? "disabled" : ""}></label>
      ${renderPasswordField({ name: "password", label: "密码", autocomplete: "current-password", placeholder: "输入密码", busy, id: "login-password" })}
      <button type="submit" class="login-submit" ${busy ? "disabled" : ""}>${busy ? "正在登录…" : "立即登录"}</button>
    </form>`;
  return `<div class="login-auth-card">
    <div class="login-auth-tabs" role="tablist" aria-label="登录或注册">
      <button type="button" role="tab" class="login-auth-tab ${showRegister ? "" : "is-active"}" data-auth-mode="login" aria-selected="${showRegister ? "false" : "true"}" ${busy ? "disabled" : ""}>登录</button>
      <button type="button" role="tab" class="login-auth-tab ${showRegister ? "is-active" : ""}" data-auth-mode="register" aria-selected="${showRegister ? "true" : "false"}" ${busy || checking ? "disabled" : ""}>注册</button>
    </div>
    ${form}
  </div>`;
}

function renderPasswordField({
  name,
  label,
  autocomplete,
  placeholder,
  minlength = 0,
  busy = false,
  id
}) {
  const minAttr = minlength ? ` minlength="${minlength}"` : "";
  return `<label class="login-field login-field-password">
    <span>${escapeHtml(label)}</span>
    <div class="login-password-row">
      <input id="${escapeHtml(id)}" name="${escapeHtml(name)}" type="password" autocomplete="${escapeHtml(autocomplete)}"${minAttr} maxlength="256" required placeholder="${escapeHtml(placeholder)}" ${busy ? "disabled" : ""}>
      <button type="button" class="login-password-toggle" data-action="toggle-password-visibility" data-password-target="${escapeHtml(id)}" title="显示密码" aria-label="显示密码" aria-pressed="false" ${busy ? "disabled" : ""}>
        <svg class="login-password-icon login-password-icon-show" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
          <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/>
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/>
        </svg>
        <svg class="login-password-icon login-password-icon-hide" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
          <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-4.8M6.7 6.8C4.3 8.2 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.7 0 3.2-.4 4.5-1M14.1 6.3C13.4 6.1 12.7 6 12 6 6 6 2.5 12 2.5 12"/>
          <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M17.3 9.4C19.3 10.7 21.5 12 21.5 12s-1.4 2.6-3.7 4.2"/>
        </svg>
      </button>
    </div>
  </label>`;
}

function renderAuthAlert(error = "", notice = "") {
  if (error) {
    return `<div class="login-auth-alert is-error" role="alert">${escapeHtml(error)}</div>`;
  }
  if (notice) {
    return `<div class="login-auth-alert is-notice" role="status">${escapeHtml(notice)}</div>`;
  }
  return "";
}
function renderAccountForm() { return `<form id="collaborationAccountForm" class="collaboration-auth-form collaboration-account-form"><h3>创建协同账号</h3><label>用户名<input name="username" autocomplete="off" minlength="3" maxlength="64" required></label><label>显示名称<input name="label" autocomplete="name" maxlength="80" required></label><label>角色<select name="role"><option value="researcher">研究员</option><option value="reviewer">审阅员</option><option value="lead">负责人</option></select></label><label>初始密码<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="256" required></label><label>确认密码<input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="256" required></label><button type="submit" class="quiet-button">创建账号</button></form>`; }
function renderIdentityAndReview(state) {
  const session = state.collaboration.session || {};
  const collab = state.collaboration || {};
  if (session.setupRequired) {
    return `${renderPendingReviewDraft(state)}${renderSetupForm({
      busy: collab.authBusy,
      error: collab.authError,
      notice: collab.authNotice,
      draft: collab.authDraft
    })}`;
  }
  if (!session.authenticated) {
    return `${renderPendingReviewDraft(state)}${renderLoginForm({
      mode: collab.authMode === "register" ? "register" : "login",
      busy: collab.authBusy,
      error: collab.authError,
      notice: collab.authNotice,
      draft: collab.authDraft
    })}`;
  }
  return `<div class="collaboration-identity-summary"><strong>${escapeHtml(session.actor?.label || "")}</strong><span>${escapeHtml(roleLabel(session.actor?.roles || []))}</span><div class="collaboration-identity-actions"><button type="button" class="quiet-button" data-action="open-account-management">账号管理</button><button type="button" class="quiet-button" data-action="collaboration-logout">\u9000\u51fa\u767b\u5f55</button></div></div><div class="collaboration-create-review"><h3>\u63d0\u4ea4\u5ba1\u9605</h3>${renderReviewForm(state)}</div>`;
}

function renderAccountManagementBody(state) {
  const session = state.collaboration.session || {};
  const collab = state.collaboration || {};
  if (session.setupRequired) {
    return renderSetupForm({
      busy: collab.authBusy,
      error: collab.authError,
      notice: collab.authNotice,
      draft: collab.authDraft
    });
  }
  if (!session.authenticated) {
    return renderLoginForm({
      mode: collab.authMode === "register" ? "register" : "login",
      busy: collab.authBusy,
      error: collab.authError,
      notice: collab.authNotice,
      draft: collab.authDraft
    });
  }
  const actor = session.actor || {};
  const isLead = Array.isArray(actor.roles) && actor.roles.includes("lead");
  const leadPanel = isLead
    ? `<div class="account-management-lead">${renderAccountForm()}${renderAccountList(state.collaboration.accounts || [])}${renderSecurityEvents(state.collaboration.securityEvents || [])}</div>`
    : `<p class="report-empty">当前角色可提交协同审阅；账号创建与安全事件由负责人在此管理。</p>`;
  return `
    <div class="account-session-card">
      <div>
        <strong>${escapeHtml(actor.label || "")}</strong>
        <span>${escapeHtml(roleLabel(actor.roles || []))}</span>
        <small>${escapeHtml(actor.username || "")}</small>
      </div>
      <div class="account-session-actions">
        <button type="button" class="quiet-button" data-action="open-collaboration">前往协同审阅</button>
        <button type="button" class="quiet-button" data-action="collaboration-logout">退出登录</button>
      </div>
    </div>
    ${leadPanel}
  `;
}

/** Visible when a structure-review checklist draft is waiting (before or after login). */
function renderPendingReviewDraft(state) {
  const draft = state.collaboration?.reviewDraft;
  if (!draft) return "";
  const resource = RESOURCE_LABELS[draft.resource] || draft.resource || "OV-5";
  return `<aside class="collaboration-draft-banner" data-collaboration-draft="pending" role="status">
    <div>
      <strong>待提交：结构审阅清单草稿</strong>
      <p>共 ${Number(draft.issueCount) || 0} 项 · 对象 ${escapeHtml(resource)} · ${escapeHtml(dispositionShort(draft.disposition))}。完整 Markdown 已下载；登录后将自动填入下方表单，确认即可写入协同事件链。</p>
    </div>
    <div class="collaboration-draft-banner-actions">
      <button type="button" class="quiet-button" data-action="clear-collaboration-review-draft">丢弃草稿</button>
    </div>
  </aside>`;
}

function dispositionShort(value) {
  return ({ comment: "记录意见", request_changes: "请求修订", approve: "建议通过" })[value] || "记录意见";
}

function renderAccountFormV2() {
  return `<form id="collaborationAccountForm" class="collaboration-auth-form collaboration-account-form"><h3>\u521b\u5efa\u534f\u540c\u8d26\u53f7</h3><label>\u7528\u6237\u540d<input name="username" autocomplete="off" minlength="3" maxlength="64" required></label><label>\u663e\u793a\u540d\u79f0<input name="label" maxlength="80" required></label><label>\u8d26\u53f7\u89d2\u8272<select name="role"><option value="reviewer">\u5ba1\u9605\u5458</option><option value="lead">\u8d1f\u8d23\u4eba</option></select></label><label>\u521d\u59cb\u5bc6\u7801<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="256" required></label><label>\u786e\u8ba4\u5bc6\u7801<input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="256" required></label><button type="submit" class="quiet-button">\u521b\u5efa\u8d26\u53f7</button></form>`;
}

function renderAccountList(accounts) {
  return `<div class="collaboration-account-list"><h3>协同账号</h3>${accounts.map((account) => `<article class="collaboration-account"><div><strong>${escapeHtml(account.label)}</strong><small>${escapeHtml(account.username)} · ${escapeHtml(account.roles.join(" / "))} · ${account.enabled ? "已启用" : "已停用"}</small></div><button type="button" class="quiet-button" data-account-toggle="${escapeHtml(account.username)}" data-account-enabled="${account.enabled ? "false" : "true"}">${account.enabled ? "停用" : "启用"}</button><form data-account-password="${escapeHtml(account.username)}"><label>重置密码<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="256" required></label><label>确认<input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="256" required></label><button type="submit" class="quiet-button">重置</button></form></article>`).join("") || `<p class="report-empty">尚无账号。</p>`}</div>`;
}
function renderSecurityEvents(events) {
  return `<div class="collaboration-security-events"><div class="security-events-heading"><h3>账号安全事件</h3><button type="button" class="quiet-button" data-action="export-collaboration-security-events">导出 JSON</button></div><div>${events.map((event) => `<article><strong>${escapeHtml(securityActionLabel(event.action))}</strong><span>${escapeHtml(event.actor?.label || event.actor?.id)} -> ${escapeHtml(event.subject?.label || event.subject?.id)}</span><small>${escapeHtml(event.occurredAt)}</small></article>`).join("") || `<p class="report-empty">尚无账号安全事件。</p>`}</div></div>`;
}
function securityActionLabel(action) { return ({ "account.initialized": "初始化负责人", "session.login": "账号登录", "account.created": "创建账号", "account.enabled": "启用账号", "account.disabled": "停用账号", "account.password_reset": "重置密码" })[action] || "账号操作"; }
function renderProjectAudit(entries) {
  if (!entries.length) return `<p class="report-empty">尚无项目变更审计记录。</p>`;
  return entries.map((entry) => `<article><div><strong>${escapeHtml(projectAuditLabel(entry.action))}</strong><span>项目 r${Number(entry.revision || 0)} · ${escapeHtml(entry.actor?.label || entry.actor?.id || entry.source || "本地来源")}</span></div><p>${escapeHtml(entry.summary)}</p><small>${escapeHtml(entry.occurredAt)}</small></article>`).join("");
}
function projectAuditLabel(action) { return ({ "concept_brief.updated": "更新概念简报", "ov1.updated": "更新 OV-1", "ov5.updated": "更新 OV-5", "ooda.updated": "更新 OODA", "scenario.updated": "更新自动想定", "validation.updated": "更新设计验证", "knowledge.updated": "更新知识库", "report.archive.created": "归档成果报告", "report.archive.deleted": "删除成果归档", "model.snapshot.created": "创建模型快照", "model.snapshot.deleted": "删除模型快照", "collaboration.review.created": "提交协同审阅", "collaboration.review.resolved": "登记审阅决议" })[action] || action || "项目变更"; }

function renderLegacyReviewForm(state) {
  const options = Object.entries(RESOURCE_LABELS).map(([resource, label]) => `<option value="${resource}" data-resource-revision="${resourceRevision(state, resource)}">${label} · r${resourceRevision(state, resource)}</option>`).join("");
  return `
    <form id="collaborationReviewForm" class="collaboration-review-form">
      <label>审阅对象<select name="resource">${options}</select></label>
      <label>意见类型<select name="disposition"><option value="comment">记录意见</option><option value="request_changes">请求修订</option><option value="approve">建议通过</option></select></label>
      <label class="collaboration-summary">审阅摘要<textarea name="summary" maxlength="1200" rows="3" placeholder="记录可审查的研究意见、依据或待修订项。" required></textarea></label>
      <button type="submit">提交审阅</button>
    </form>
  `;
}

function renderReviewForm(state) {
  const draft = state.collaboration?.reviewDraft || null;
  const selectedResource = draft?.resource && RESOURCE_LABELS[draft.resource] ? draft.resource : "ov5";
  const selectedDisposition = ["comment", "request_changes", "approve"].includes(draft?.disposition) ? draft.disposition : "comment";
  const options = Object.entries(RESOURCE_LABELS).map(([resource, label]) => `<option value="${escapeHtml(resource)}" ${resource === selectedResource ? "selected" : ""}>${escapeHtml(label)} / r${resourceRevision(state, resource)}</option>`).join("");
  const evidenceOptions = (state.knowledge?.docs || []).filter((note) => note?.id && !note.sensitivity?.marked).slice(0, 12);
  const draftNote = draft
    ? `<div class="collaboration-draft-note" data-collaboration-draft="form">
        <div>
          <strong>已载入结构核对台清单草稿</strong>
          <p>${Number(draft.issueCount) || 0} 项问题摘要已填入下方。完整 Markdown 附件已导出；可先微调再提交，或丢弃草稿。</p>
        </div>
        <button type="button" class="quiet-button" data-action="clear-collaboration-review-draft">丢弃草稿</button>
      </div>`
    : "";
  return `
    <form id="collaborationReviewForm" class="collaboration-review-form ${draft ? "has-draft" : ""}">
      ${draftNote}
      <label>审阅对象<select name="resource">${options}</select></label>
      <label>意见类型<select name="disposition">
        <option value="comment" ${selectedDisposition === "comment" ? "selected" : ""}>记录意见</option>
        <option value="request_changes" ${selectedDisposition === "request_changes" ? "selected" : ""}>请求修订</option>
        <option value="approve" ${selectedDisposition === "approve" ? "selected" : ""}>建议通过</option>
      </select></label>
      <label class="collaboration-summary">审阅摘要<textarea name="summary" maxlength="1200" rows="${draft ? 8 : 3}" placeholder="记录可审查的研究意见、依据或待修订项。" required>${escapeHtml(draft?.summary || "")}</textarea></label>
      ${draft ? `<p class="collaboration-draft-meta">字数 ${String(draft.summary || "").length}/1200 · 附件类型：结构审阅清单 Markdown</p>` : ""}
      ${evidenceOptions.length ? `<fieldset class="collaboration-evidence-refs"><legend>公开知识依据（选填）</legend>${evidenceOptions.map((note) => `<label><input type="checkbox" name="evidenceRefs" value="${escapeHtml(note.id)}">${escapeHtml(note.title || note.id)}</label>`).join("")}</fieldset>` : ""}
      <button type="submit">${draft ? "确认提交清单审阅" : "提交审阅"}</button>
    </form>
  `;
}

function renderReview(review, session, revision) {
  const decision = review.decision;
  const state = review.state === "open" ? "待决议" : review.state === "accepted" ? "已采纳" : "已驳回";
  const stateClass = review.state === "accepted" && review.freshness === "current" ? "" : "review";
  return `
    <article class="collaboration-review ${escapeHtml(review.state)}">
      <div><span class="status-tag ${stateClass}">${state}</span><strong>${escapeHtml(RESOURCE_LABELS[review.resource] || review.resource)} r${Number(review.resourceRevision || 0)}</strong><small>${escapeHtml(review.actor?.label || review.actor?.id)} · ${escapeHtml(review.createdAt)}</small></div>
      <p>${escapeHtml(review.summary)}</p>${renderReviewEvidenceRefs(review.evidenceRefs)}${renderReviewContext(review.reviewContext)}
      <small>${dispositionLabel(review.disposition)} · 项目 r${Number(review.revision || 0)} · ${review.freshness === "stale" ? `目标已更新为 r${Number(review.currentResourceRevision || 0)}` : "目标版本当前有效"}</small>
      ${decision ? `<div class="collaboration-decision"><b>${decision.outcome === "accepted" ? "负责人采纳" : "负责人驳回"}</b><span>${escapeHtml(decision.summary)}</span><small>${escapeHtml(decision.actor?.label || decision.actor?.id)} · ${escapeHtml(decision.decidedAt)}</small></div>` : renderDecisionForm(review, session, revision)}
    </article>
  `;
}

function renderReviewFilters(reviews, active) {
  const counts = {
    open: reviews.filter((review) => review.state === "open").length,
    current: reviews.filter((review) => review.freshness === "current").length,
    stale: reviews.filter((review) => review.freshness === "stale").length,
    closed: reviews.filter((review) => review.state !== "open").length
  };
  const labels = { open: "\u5f85\u51b3", current: "\u5f53\u524d\u7248", stale: "\u5df2\u8fc7\u671f", closed: "\u5df2\u7ed3\u9879" };
  return `<div class="collaboration-review-filters">${Object.keys(labels).map((key) => `<button type="button" class="quiet-button ${active === key ? "is-active" : ""}" data-collaboration-filter="${key}">${labels[key]} <span>${counts[key]}</span></button>`).join("")}</div>`;
}

function filterReviews(reviews, filter) {
  if (filter === "current") return reviews.filter((review) => review.freshness === "current");
  if (filter === "stale") return reviews.filter((review) => review.freshness === "stale");
  if (filter === "closed") return reviews.filter((review) => review.state !== "open");
  return reviews.filter((review) => review.state === "open");
}

function roleLabel(roles) {
  if (roles.includes("lead")) return "\u8d1f\u8d23\u4eba";
  if (roles.includes("reviewer")) return "\u5ba1\u9605\u5458";
  return "\u7814\u7a76\u5458";
}

function renderReviewEvidenceRefs(refs) {
  const items = Array.isArray(refs) ? refs.slice(0, 12) : [];
  return items.length ? `<small class="collaboration-review-evidence">Evidence: ${items.map(escapeHtml).join(" / ")}</small>` : "";
}

function renderReviewContext(context) {
  if (!context) return "";
  const lineage = Object.entries(context.lineage || {}).filter(([, value]) => Number(value) > 0).map(([key, value]) => `${key} r${Number(value)}`).join(" / ");
  return `<small class="collaboration-review-context">审阅上下文：${escapeHtml(context.modelKind)} · ${Number(context.primaryCount || 0)} / ${Number(context.secondaryCount || 0)}${lineage ? ` · ${escapeHtml(lineage)}` : ""}</small>`;
}

function renderDecisionForm(review, session, revision) {
  if (!session?.actor?.roles?.includes("lead")) return "";
  const outcomes = review.freshness === "stale" ? `<option value="rejected">驳回旧版本审阅</option>` : `<option value="accepted">采纳</option><option value="rejected">驳回</option>`;
  return `<form class="collaboration-decision-form" data-collaboration-decision="${escapeHtml(review.id)}"><label>处理结果<select name="outcome">${outcomes}</select></label><label>决议摘要<input name="summary" maxlength="1200" required placeholder="说明决议与后续动作"></label><input type="hidden" name="expectedRevision" value="${Number(revision || 0)}"><button class="quiet-button" type="submit">登记决议</button></form>`;
}

function resourceRevision(state, resource) {
  const storageKey = { brief: "projectStorage", ov1: "ov1Storage", ov5: "ov5Storage", ooda: "oodaStorage", scenario: "scenarioStorage", validation: "validationStorage", knowledge: "knowledgeStorage", report: "reportStorage" }[resource];
  return Number(state[storageKey]?.resourceRevision || (resource === "brief" ? state.projectStorage?.revision : 0) || 0);
}

function dispositionLabel(value) {
  return ({ comment: "记录意见", request_changes: "请求修订", approve: "建议通过" })[value] || "记录意见";
}

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
