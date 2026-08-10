import { applyStructureReviewFilter, buildStructureReview, defaultStructureReviewFilter } from "./structureReviewBuilder.js";

const SEVERITY_LABEL = {
  alert: "高优先级",
  review: "需复核",
  pending: "未完成"
};

const GROUP_LABEL = {
  mapping: "来源映射",
  validation: "设计验证",
  concept: "概念结构",
  contract: "接口契约",
  sequence: "时序追溯"
};

const VIEW_LABEL = {
  ov1: "OV-1",
  ov5: "OV-5b",
  ooda: "OODA",
  scenario: "想定",
  validate: "设计验证",
  ov2: "OV-2",
  ov3: "OV-3",
  ov4: "OV-4",
  ov5a: "OV-5a",
  ov6a: "OV-6a",
  ov6b: "OV-6b",
  ov6c: "OV-6c",
  "structure-review": "结构核对台"
};

/**
 * Build a review-checklist export from the current structure-review inventory,
 * respecting the active severity/group filters when provided.
 */
export function buildStructureReviewExport(state = {}, options = {}) {
  const model = buildStructureReview(state);
  const filter = {
    ...defaultStructureReviewFilter(),
    ...(state.structureReviewFilter || {}),
    ...(options.filter || {})
  };
  const filtered = applyStructureReviewFilter(model, filter);
  const issues = filtered.filteredIssues || [];
  const generatedAt = new Date().toISOString();
  const projectTitle = options.projectTitle || state.projectTitle || "研究项目";
  const payload = {
    kind: "structure-review-checklist",
    version: 1,
    generatedAt,
    projectTitle,
    filter,
    summary: {
      totalVisible: issues.length,
      totalAll: model.summary.total,
      alert: issues.filter((item) => item.severity === "alert").length,
      review: issues.filter((item) => item.severity === "review" || item.severity === "alert").length,
      pending: issues.filter((item) => item.severity === "pending").length,
      validationStale: Boolean(model.summary.validationStale),
      oodaStale: Boolean(model.summary.oodaStale),
      scenarioStale: Boolean(model.summary.scenarioStale),
      unmappedActivityCount: model.summary.unmappedActivityCount
    },
    groups: filtered.filteredGroups.map((group) => ({
      id: group.id,
      label: group.label,
      issues: group.issues.map(serializeIssue)
    })),
    issues: issues.map(serializeIssue)
  };

  const collaborationDraft = buildCollaborationReviewDraft(payload);

  return {
    payload,
    markdown: {
      label: "结构审阅清单",
      filename: `structure-review-checklist-${stamp(generatedAt)}.md`,
      mime: "text/markdown;charset=utf-8",
      content: toMarkdown(payload)
    },
    json: {
      label: "结构审阅清单 JSON",
      filename: `structure-review-checklist-${stamp(generatedAt)}.json`,
      mime: "application/json;charset=utf-8",
      content: `${JSON.stringify(payload, null, 2)}\n`
    },
    collaborationDraft
  };
}

/**
 * Compact collaboration review payload (summary ≤1200 to match server normalizer).
 * Full checklist remains in the companion Markdown/JSON export as the attachment artifact.
 */
export function buildCollaborationReviewDraft(payload = {}) {
  const issues = Array.isArray(payload.issues) ? payload.issues : [];
  const summary = payload.summary || {};
  const resource = pickCollaborationResource(issues);
  const disposition = summary.alert || summary.review ? "request_changes" : issues.length ? "comment" : "comment";
  const lines = [
    `【结构审阅清单】${payload.projectTitle || "研究项目"}`,
    `导出 ${formatTime(payload.generatedAt)} · 可见 ${Number(summary.totalVisible) || issues.length} 项（全库 ${Number(summary.totalAll) || issues.length}）`,
    `高优 ${Number(summary.alert) || 0} · 复核 ${Number(summary.review) || 0} · 未完成 ${Number(summary.pending) || 0}`,
    summary.validationStale ? "注意：设计验证结果已过期" : "",
    summary.scenarioStale || issues.some((item) => item.code === "scenario-stale") ? "注意：想定相对上游已过期" : "",
    summary.oodaStale || issues.some((item) => item.code === "ooda-stale") ? "注意：OODA 相对 OV-5 已过期" : "",
    `过滤：优先级=${filterLabel(payload.filter?.severity)}；分组=${groupFilterLabel(payload.filter?.group)}`,
    "",
    "主要问题："
  ].filter((line, index, list) => line !== "" || (index > 0 && list[index - 1] !== ""));

  const topIssues = issues.slice(0, 8);
  if (!topIssues.length) {
    lines.push("- 当前过滤下无待处理项；清单作为协同交接基线。");
  } else {
    topIssues.forEach((item, index) => {
      lines.push(`${index + 1}. [${item.severityLabel || item.severity}] ${item.title} → ${item.targetViewLabel || item.targetView || "源模型"}`);
    });
    if (issues.length > topIssues.length) {
      lines.push(`…另有 ${issues.length - topIssues.length} 项，详见附件清单。`);
    }
  }
  lines.push("", "附件：已同步导出 Markdown 结构审阅清单，请在协同记录中对照处理。", "本意见由结构核对台一键挂接，不构成最终结论。");

  let text = lines.join("\n").trim();
  if (text.length > 1200) text = `${text.slice(0, 1190).trim()}…`;

  return {
    kind: "structure-review-collaboration-draft",
    version: 1,
    resource,
    disposition,
    summary: text,
    issueCount: issues.length,
    attachment: {
      kind: "structure-review-checklist",
      format: "markdown",
      note: "Full checklist exported as companion download"
    },
    clientId: `review-structure-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  };
}

function pickCollaborationResource(issues = []) {
  const counts = { validation: 0, scenario: 0, ooda: 0, ov5: 0, ov1: 0, brief: 0 };
  issues.forEach((item) => {
    const target = item.targetView || item.sourceView || "";
    if (target === "validate" || item.group === "validation") counts.validation += 1;
    else if (target === "scenario") counts.scenario += 1;
    else if (target === "ooda") counts.ooda += 1;
    else if (target === "ov1") counts.ov1 += 1;
    else if (target === "brief") counts.brief += 1;
    else counts.ov5 += 1;
  });
  const ranked = Object.entries(counts).sort((left, right) => right[1] - left[1]);
  const top = ranked[0];
  if (!top || !top[1]) return "ov5";
  return top[0] === "validate" ? "validation" : top[0];
}

function serializeIssue(item) {
  return {
    id: item.id,
    code: item.code,
    group: item.group,
    groupLabel: GROUP_LABEL[item.group] || item.group,
    severity: item.severity,
    severityLabel: SEVERITY_LABEL[item.severity] || item.severity,
    title: item.title,
    detail: item.detail,
    sourceView: item.sourceView,
    sourceViewLabel: VIEW_LABEL[item.sourceView] || item.sourceView,
    targetView: item.targetView,
    targetViewLabel: VIEW_LABEL[item.targetView] || item.targetView,
    targetKind: item.targetKind || "",
    targetId: item.targetId || "",
    stale: Boolean(item.stale),
    action: item.action || ""
  };
}

function toMarkdown(payload) {
  const lines = [
    `# 结构审阅清单`,
    ``,
    `- 项目：${payload.projectTitle}`,
    `- 导出时间：${formatTime(payload.generatedAt)}`,
    `- 过滤：优先级=${filterLabel(payload.filter.severity)}；分组=${groupFilterLabel(payload.filter.group)}`,
    `- 可见问题：${payload.summary.totalVisible} / 全部 ${payload.summary.totalAll}`,
    `- 高优 ${payload.summary.alert} · 复核 ${payload.summary.review} · 未完成 ${payload.summary.pending}`,
    payload.summary.validationStale ? `- 注意：设计验证结果已过期` : null,
    payload.summary.unmappedActivityCount ? `- 未挂接 OV-1 的活动：${payload.summary.unmappedActivityCount}` : null,
    ``,
    `> 本清单用于人工审阅与协同交接，不构成最终结论。请回到工作台源模型处理问题后重新导出。`,
    ``
  ].filter((line) => line !== null);

  if (!payload.issues.length) {
    lines.push(`## 当前无匹配问题`, ``, `在当前过滤条件下没有待处理项。可放宽过滤或回到结构核对台重新检查。`, ``);
    return lines.join("\n");
  }

  payload.groups.forEach((group) => {
    lines.push(`## ${group.label}（${group.issues.length}）`, ``);
    group.issues.forEach((item, index) => {
      lines.push(`### ${index + 1}. [${item.severityLabel}] ${item.title}`);
      lines.push(``);
      lines.push(`- 分组：${item.groupLabel}`);
      lines.push(`- 来源视图：${item.sourceViewLabel || "—"}`);
      lines.push(`- 建议处理：${item.targetViewLabel || "—"}${item.targetId ? ` / ${item.targetId}` : ""}`);
      if (item.stale) lines.push(`- 状态：过期结果，仅供参考`);
      lines.push(`- 说明：${item.detail || "—"}`);
      lines.push(`- 审阅结论：□ 已修订  □ 保留并说明理由  □ 转协同审阅`);
      lines.push(`- 备注：`);
      lines.push(``);
    });
  });

  lines.push(`## 审阅签署`, ``, `- 审阅人：`, `- 日期：`, `- 总体意见：`, ``);
  return lines.join("\n");
}

function filterLabel(value) {
  return ({ all: "全部", alert: "高优", review: "需复核", pending: "未完成" })[value] || value || "全部";
}

function groupFilterLabel(value) {
  if (!value || value === "all") return "全部分组";
  return GROUP_LABEL[value] || value;
}

function formatTime(value) {
  try {
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return String(value || "");
  }
}

function stamp(value) {
  return String(value || new Date().toISOString()).replace(/[:.]/g, "-").slice(0, 19);
}
