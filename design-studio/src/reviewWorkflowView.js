import {
  REVIEW_STATUSES,
  REVIEW_STATUS_META,
  canPerformReviewTransition,
  isProjectFinalized
} from "./reviewWorkflowStore.js";

/**
 * 渲染评审签批状态工作流横幅 (Review & Approval Workflow Bar)
 * @param {object} project 当前激活的项目对象
 * @param {object} options
 * @param {object} options.session 协同会话，包含用户身份角色
 */
export function renderReviewWorkflowBar(project, { session } = {}) {
  if (!project) return "";

  const status = (project.reviewStatus || "draft").toLowerCase();
  const meta = REVIEW_STATUS_META[status] || REVIEW_STATUS_META.draft;
  const roles = session?.actor?.roles || [];
  const isFinalized = isProjectFinalized(project);

  const canSubmit = canPerformReviewTransition(status, "submit", roles);
  const canRequestChanges = canPerformReviewTransition(status, "request_changes", roles);
  const canFinalize = canPerformReviewTransition(status, "finalize", roles);

  // 动作按钮
  const actions = [];
  if (canSubmit) {
    actions.push(
      `<button type="button" class="btn-primary" data-action="workflow-submit-review" title="提交送审并自动冻结当前模型基线快照">📤 提交送审</button>`
    );
  }
  if (canRequestChanges) {
    actions.push(
      `<button type="button" class="btn-secondary" data-action="workflow-request-changes" title="提出修改意见并退回修订状态">📝 退回修改</button>`
    );
  }
  if (canFinalize) {
    actions.push(
      `<button type="button" class="btn-primary" data-action="workflow-finalize-approval" title="正式签批定稿，开启全工作台只读保护">✅ 签批定稿</button>`
    );
  }
  if (isFinalized) {
    actions.push(
      `<button type="button" class="btn-primary" data-action="workflow-fork-revision" title="基于当前定稿方案派生新修订分支项目进行后续探索">🌿 派生新修订分支</button>`
    );
  }

  // 签批与决策信息条
  let approvalDetails = "";
  if (project.approval && typeof project.approval === "object") {
    const { reviewer, decidedAt, note } = project.approval;
    if (reviewer || note) {
      approvalDetails = `
        <div class="review-approval-info">
          <span>签批人: <strong>${escapeHtml(reviewer || "审阅员")}</strong></span>
          ${decidedAt ? `<span>时间: <time>${escapeHtml(decidedAt.slice(0, 16).replace("T", " "))}</time></span>` : ""}
          ${note ? `<span>附言: <em>${escapeHtml(note)}</em></span>` : ""}
        </div>
      `;
    }
  }

  // 只读警告横幅 (如果定稿)
  const readonlyNotice = isFinalized
    ? `<div class="review-readonly-badge" role="alert">🔒 本方案已正式签批定稿，已开启只读保护。如需修改，请点击右侧「派生新修订分支」。</div>`
    : "";

  return `
    <div class="modal-backdrop review-workflow-modal" data-action="close-review-workflow-dialog" role="dialog" aria-modal="true" aria-labelledby="review-dialog-title">
      <div class="modal-card surface review-workflow-dialog-card" onclick="event.stopPropagation()">
        <header class="modal-header">
          <div class="modal-title-wrap">
            <h3 id="review-dialog-title">成果评审与签批流转</h3>
            <span class="review-status-badge ${meta.badgeClass}">${meta.icon} ${meta.badgeLabel}</span>
          </div>
          <button type="button" class="modal-close" data-action="close-review-workflow-dialog" aria-label="关闭">×</button>
        </header>
        <div class="modal-body review-dialog-body">
          <div class="review-dialog-project-info">
            <span class="review-dialog-field-label">当前方案：</span>
            <strong>${escapeHtml(project.title || project.id || "未命名方案")}</strong>
          </div>
          <section class="review-workflow-bar ${meta.badgeClass}" data-review-status="${escapeHtml(status)}" aria-label="成果评审与签批流程">
            <div class="review-workflow-main">
              <div class="review-status-indicator">
                <span class="review-status-badge ${meta.badgeClass}">${meta.icon} ${meta.badgeLabel}</span>
                <span class="review-status-desc">${escapeHtml(meta.description)}</span>
              </div>
              ${approvalDetails}
              ${readonlyNotice}
            </div>
          </section>
        </div>
        <footer class="modal-footer review-dialog-footer">
          <button type="button" class="btn-secondary" data-action="close-review-workflow-dialog">关闭</button>
          <div class="review-workflow-actions">
            ${actions.join("")}
          </div>
        </footer>
      </div>
    </div>
  `;
}

/**
 * 渲染顶部导航栏微型评审状态胶囊 (Compact Menubar Review Status Badge)
 */
export function renderReviewWorkflowBadge(project) {
  if (!project) return "";
  const status = (project.reviewStatus || "draft").toLowerCase();
  const meta = REVIEW_STATUS_META[status] || REVIEW_STATUS_META.draft;
  return `
    <button type="button" class="menubar-review-badge ${meta.badgeClass}" data-action="toggle-review-workflow-dialog" title="方案评审状态：${meta.badgeLabel}（点击查看详情与送审）" aria-label="方案评审状态：${meta.badgeLabel}">
      <span class="menubar-review-badge-icon" aria-hidden="true">${meta.icon}</span>
      <span class="menubar-review-badge-text">${meta.badgeLabel}</span>
    </button>
  `;
}

/**
 * 构造右侧悬浮工具箱中的评审与送审入口配置
 */
export function getReviewToolboxRailItem(state = {}) {
  const activeProject = (state.projectDirectory?.projects || []).find((p) => p.id === state.activeProjectId) || state.project;
  const status = (activeProject?.reviewStatus || "draft").toLowerCase();
  const titles = {
    draft: "草稿 · 点击提交送审",
    submitted: "送审中 · 查看审核进度",
    revising: "需修改 · 重新送审",
    finalized: "已定稿 · 查看/派生新分支"
  };
  const icons = {
    draft: "send",
    submitted: "check",
    revising: "doc",
    finalized: "concept"
  };
  const title = titles[status] || "方案评审与签批流转";
  const icon = icons[status] || "send";

  return {
    action: "open-review-workflow-dialog",
    title,
    label: title,
    icon,
    attention: status === "draft" || status === "revising",
    className: "toolbox-review-entry"
  };
}

/**
 * 渲染只读拦截模态框 (当用户在定稿状态尝试写操作时)
 */
export function renderFinalizedReadonlyDialog(project) {
  const title = project?.title || "当前作战概念方案";
  return `
    <div class="modal-backdrop review-readonly-modal" role="dialog" aria-modal="true" aria-labelledby="readonly-dialog-title">
      <div class="modal-card surface">
        <header class="modal-header">
          <h3 id="readonly-dialog-title">🔒 方案已签批定稿（只读保护）</h3>
          <button type="button" class="modal-close" data-action="close-readonly-dialog" aria-label="关闭">×</button>
        </header>
        <div class="modal-body">
          <p>项目 <strong>「${escapeHtml(title)}」</strong> 已经过审阅签批定稿，受体系版本完整性保护，严禁原地直接覆写。</p>
          <p>若需要根据最新演训需求进行升级修改，请派生新修订分支项目。</p>
        </div>
        <footer class="modal-footer">
          <button type="button" class="btn-secondary" data-action="close-readonly-dialog">保持只读浏览</button>
          <button type="button" class="btn-primary" data-action="workflow-fork-revision">🌿 派生新修订分支</button>
        </footer>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
