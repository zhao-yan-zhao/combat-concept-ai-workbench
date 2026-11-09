/**
 * M7-T7.10 评审与签批流程仓储与状态机 (Review & Approval Workflow)
 *
 * 状态流转契约：
 *   草稿 (draft) ➔ 送审 (submitted) [自动冻结模型快照] ➔ 需修改 (revising) ➔ 重新送审 (submitted)
 *                                                      ➔ 签批定稿 (finalized) [开启只读守卫]
 * 定稿成果只读守卫：
 *   已定稿 (finalized) 的成果开启界面只读保护，修改必须另开分支/版本 (forkRevisedProject)。
 */

export const REVIEW_STATUSES = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  REVISING: "revising",
  FINALIZED: "finalized"
};

export const REVIEW_STATUS_META = {
  draft: {
    key: "draft",
    label: "草稿编制",
    badgeLabel: "草稿",
    icon: "✏️",
    badgeClass: "status-draft",
    description: "方案正在自主研究编制中，允许自由编辑模型要素与 AI 生成研讨。"
  },
  submitted: {
    key: "submitted",
    label: "送审评审中",
    badgeLabel: "送审中",
    icon: "⏳",
    badgeClass: "status-submitted",
    description: "已提交送审并冻结当前模型基线快照，评审人员对照评估并提出审阅意见。"
  },
  revising: {
    key: "revising",
    label: "需退回修改",
    badgeLabel: "需修改",
    icon: "⚠️",
    badgeClass: "status-revising",
    description: "审阅人员要求修改完善，研究员根据审阅清单修订后可再次重新送审。"
  },
  finalized: {
    key: "finalized",
    label: "已签批定稿",
    badgeLabel: "已定稿",
    icon: "🔒",
    badgeClass: "status-finalized",
    description: "方案已由审阅负责人正式签批定稿，已开启只读守卫保护。如需修改请派生新修订版本。"
  }
};

/**
 * 校验当前状态是否支持指定动作
 * @param {string} currentStatus
 * @param {"submit" | "request_changes" | "finalize"} action
 * @param {string[]} roles
 */
export function canPerformReviewTransition(currentStatus = "draft", action, roles = []) {
  const status = REVIEW_STATUSES[currentStatus.toUpperCase()] || currentStatus || REVIEW_STATUSES.DRAFT;
  const isLead = roles.includes("lead");
  const isReviewer = roles.includes("reviewer") || isLead;
  const isResearcher = roles.includes("researcher") || isLead || roles.length === 0;

  switch (action) {
    case "submit":
      // 从 draft 或 revising 送审，需要研究员或负责人权限
      return (status === REVIEW_STATUSES.DRAFT || status === REVIEW_STATUSES.REVISING) && (isResearcher || roles.length === 0);
    case "request_changes":
      // 从 submitted 状态要求修改，需要审阅员或负责人权限
      return status === REVIEW_STATUSES.SUBMITTED && (isReviewer || roles.length === 0);
    case "finalize":
      // 从 submitted 状态正式签批定稿，需要审阅员或负责人权限
      return status === REVIEW_STATUSES.SUBMITTED && (isReviewer || roles.length === 0);
    default:
      return false;
  }
}

/**
 * 判断项目是否处于只读定稿状态
 */
export function isProjectFinalized(project) {
  return (project?.reviewStatus || "").toLowerCase() === REVIEW_STATUSES.FINALIZED;
}

/**
 * 基于已定稿项目派生新修订分支项目 (纯深拷贝解耦)
 * @param {object} sourceProject
 * @param {object} workbenchState
 */
export function buildRevisedProjectPayload(sourceProject, workbenchState = {}) {
  if (!sourceProject || typeof sourceProject !== "object") {
    throw new Error("源项目对象无效，无法派生修订分支");
  }

  const baseId = String(sourceProject.id || "project").replace(/-rev\w+$/, "");
  const suffix = Date.now().toString(36).slice(-4);
  const nextId = `${baseId}-rev${suffix}`;
  const baseTitle = String(sourceProject.title || "作战概念研究").replace(/\s*\(修订版.*?\)$/, "");
  const nextTitle = `${baseTitle} (修订版 ${suffix})`;

  // 深拷贝当前模型全部资源
  const clone = (data) => (data ? JSON.parse(JSON.stringify(data)) : null);

  const payload = {
    id: nextId,
    title: nextTitle,
    kind: sourceProject.kind || "tactic",
    classification: sourceProject.classification || "内部",
    description: `基于定稿方案 [${sourceProject.title}] 派生的新修订分支。`,
    reviewStatus: REVIEW_STATUSES.DRAFT,
    approval: null,
    record: {
      brief: clone(workbenchState.brief || null),
      direction: clone(workbenchState.direction || null),
      directions: clone(workbenchState.directions || []),
      inspiration: clone(workbenchState.inspiration || null),
      ov1: clone(workbenchState.ov1 || null),
      ov1b: clone(workbenchState.ov1b || null),
      ov1c: clone(workbenchState.ov1c || null),
      ov2: clone(workbenchState.ov2 || null),
      ov3: clone(workbenchState.ov3 || null),
      ov4: clone(workbenchState.ov4 || null),
      ov5: clone(workbenchState.ov5 || null),
      ov5a: clone(workbenchState.ov5a || null),
      ov6a: clone(workbenchState.ov6a || null),
      ov6b: clone(workbenchState.ov6b || null),
      ov6c: clone(workbenchState.ov6c || null),
      ov7: clone(workbenchState.ov7 || null),
      forceMission: clone(workbenchState.forceMission || null),
      phaseAction: clone(workbenchState.phaseAction || null),
      scenario: clone(workbenchState.scenario || null),
      knowledge: clone(workbenchState.knowledge || null),
      ooda: clone(workbenchState.ooda || null)
    }
  };

  return payload;
}
