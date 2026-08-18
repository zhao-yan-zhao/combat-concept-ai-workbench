import { applyStructureReviewFilter, buildStructureReview, defaultStructureReviewFilter } from "./structureReviewBuilder.js";
import { renderDerivedViewProvenance } from "./derivedViewProvenance.js";
import { renderProjectStorageState } from "./projectStorageView.js";

const GROUP_HINT = {
  mapping: "优先补活动模型的总体图来源，再查交换与责任覆盖。",
  validation: "来自最近一次设计验证的规则问题；过期结果会标注并建议重跑。",
  concept: "回到高层概念图补节点关系或语义字段。",
  contract: "在活动模型对齐输入/输出与约束条件。",
  sequence: "阶段行动链反查：规则绑定、状态出口、时序来源；点问题跳回源头回改。"
};

const VIEW_LABEL = {
  ov1: "高层作战概念图",
  ov5: "作战活动模型",
  ooda: "研究辅助循环",
  scenario: "想定",
  validate: "设计验证",
  ov2: "作战资源流描述",
  ov3: "作战资源流矩阵",
  ov4: "作战组织关系图",
  ov5a: "作战活动分解树",
  ov6a: "规则库",
  ov6b: "状态机校验",
  ov6c: "时序校验",
  "phase-action": "阶段与行动",
  "force-mission": "兵力与任务",
  "structure-review": "核对台"
};

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

export function renderStructureReview(state) {
  const model = buildStructureReview(state);
  const filter = {
    ...defaultStructureReviewFilter(),
    ...(state.structureReviewFilter || {})
  };
  const filtered = applyStructureReviewFilter(model, filter);
  const summary = model.summary;
  const visibleGroups = filtered.filteredGroups;
  const empty = !summary.total;
  const validationNote = !summary.validationRan
    ? "设计验证未运行"
    : summary.validationStale
      ? `验证已过期 · ${summary.validationIssueCount} 项`
      : `验证 ${summary.validationIssueCount} 项 · ${formatTime(summary.validationGeneratedAt)}`;
  return `
    <section class="surface surface-pad structure-review">
      <div class="section-heading">
        <div>
          <h2>结构核对台</h2>
          <p>阶段行动链终点：汇聚规则/状态/时序反查与其他产品问题，点条目跳回源头回改。</p>
        </div>
        <div class="activity-toolbar">
          <span class="mini-tag ${summary.alert ? "alert" : summary.review ? "review" : ""}">${summary.alert || 0} 高优 · ${summary.review} 复核</span>
          <span class="mini-tag ${summary.validationStale ? "review" : ""}">${escapeHtml(validationNote)}</span>
          <button class="quiet-button" type="button" data-action="run-validation">${summary.validationStale ? "重新运行验证" : "运行设计验证"}</button>
          <button class="quiet-button" type="button" data-action="attach-ov1-sources" ${summary.unmappedActivityCount ? "" : "disabled"} title="为缺少来源的 OV-5 活动按 OV-1 类型补挂 sourceOv1NodeIds">补挂总体图来源${summary.unmappedActivityCount ? ` (${summary.unmappedActivityCount})` : ""}</button>
          <button class="quiet-button" type="button" data-action="apply-mapping-quality" ${summary.mappingQualityCanApply ? "" : "disabled"} title="补全空输入/输出、按类型建议浅层父活动；不覆盖已有正文">补全映射质量${summary.blankIoCount ? ` (${summary.blankIoCount} I/O)` : ""}</button>
          <button class="quiet-button" type="button" data-action="export-structure-review-markdown" title="按当前过滤导出 Markdown 审阅清单">导出清单</button>
          <button class="quiet-button" type="button" data-action="export-structure-review-json" title="按当前过滤导出 JSON">导出 JSON</button>
          <button class="quiet-button" type="button" data-action="attach-structure-review-collaboration" title="将当前过滤清单摘要挂到协同审阅，并导出完整 Markdown 附件">挂到协同审阅</button>
          <button class="quiet-button" type="button" data-action="import-architecture-file" title="选择 JSON/XML 架构交换包文件导入">导入架构包</button>
          <button class="quiet-button" type="button" data-action="export-architecture-json" title="导出 DoDAF JSON 架构包">导出架构包</button>
        </div>
      </div>
      ${renderDerivedViewProvenance("structure-review")}
      ${renderProjectStorageState(state.ov5Storage, { refreshAction: "refresh-project-ov5" })}
      <div class="structure-review-summary" aria-label="核对摘要">
        ${renderSummaryCard("all", summary.total, "待处理问题", filter.group === "all", false)}
        ${renderSummaryCard("mapping", summary.mapping, "来源映射", filter.group === "mapping", summary.mapping)}
        ${renderSummaryCard("validation", summary.validation, "设计验证", filter.group === "validation", summary.validation || summary.validationStale)}
        ${renderSummaryCard("concept", summary.concept, "概念结构", filter.group === "concept", summary.concept)}
        ${renderSummaryCard("contract", summary.contract, "接口契约", filter.group === "contract", summary.contract)}
        ${renderSummaryCard("sequence", summary.sequence, "时序追溯", filter.group === "sequence", summary.sequence)}
      </div>
      ${renderConsistencyStrip(model.consistency, summary)}
      ${renderValidationStrip(model.validation)}
      ${renderFilters(filter, summary, filtered.filteredIssues.length)}
      <div class="structure-review-derived">
        ${renderDerivedChip("OV-2", model.derived.ov2, "ov2")}
        ${renderDerivedChip("OV-3", model.derived.ov3, "ov3")}
        ${renderDerivedChip("OV-4", model.derived.ov4, "ov4")}
        ${renderDerivedChip("OV-5a", model.derived.ov5a, "ov5a")}
        ${renderDerivedChip("OV-6a", model.derived.ov6a, "ov6a")}
        ${renderDerivedChip("OV-6b", model.derived.ov6b, "ov6b")}
        ${renderDerivedChip("OV-6c", model.derived.ov6c, "ov6c")}
        <button class="structure-review-chip ${summary.validationStale ? "review" : summary.validationRan ? (summary.validation ? "review" : "ready") : "pending"}" type="button" data-structure-jump="validate" title="打开设计验证">
          <strong>设计验证</strong>
          <span>${summary.validationRan ? (summary.validationStale ? "已过期" : `${summary.validationIssueCount} 项问题`) : "尚未运行"}</span>
        </button>
      </div>
      ${empty ? renderEmpty(summary) : filtered.filterEmpty ? renderFilterEmpty(filter, summary.total) : visibleGroups.map((group) => renderGroup(group)).join("")}
    </section>
  `;
}

function renderSummaryCard(group, count, label, active, reviewTone) {
  return `<button type="button" class="structure-summary-card ${active ? "active" : ""} ${reviewTone ? "review" : ""}" data-structure-filter-group="${escapeHtml(group)}"><b>${count}</b><span>${escapeHtml(label)}</span></button>`;
}

function renderFilters(filter, summary, visibleCount) {
  const severityButtons = [
    ["all", "全部", summary.total],
    ["alert", "高优", summary.alert || 0],
    ["review", "需复核", summary.review],
    ["pending", "未完成", summary.pending]
  ].map(([id, label, count]) => `<button type="button" class="${filter.severity === id ? "active" : ""}" data-structure-filter-severity="${id}">${label} <em>${count}</em></button>`).join("");
  const groupButtons = [
    ["all", "全部分组"],
    ...Object.entries(GROUP_LABEL)
  ].map(([id, label]) => `<button type="button" class="${filter.group === id ? "active" : ""}" data-structure-filter-group="${id}">${escapeHtml(label)}</button>`).join("");
  return `<div class="structure-review-filters" aria-label="问题过滤">
    <div class="structure-filter-row"><span>优先级</span><div class="structure-filter-chips">${severityButtons}</div></div>
    <div class="structure-filter-row"><span>分组</span><div class="structure-filter-chips">${groupButtons}</div></div>
    <p class="structure-filter-meta">当前显示 ${visibleCount} / ${summary.total} 项${filter.severity !== "all" || filter.group !== "all" ? " · 已启用过滤" : ""}</p>
  </div>`;
}

function renderValidationStrip(validation = {}) {
  if (!validation.ran) {
    return `<div class="structure-review-validation pending"><div><strong>设计验证尚未运行</strong><p>结构诊断可独立查看；运行验证后规则问题会并入下方「设计验证」分组。</p></div><button type="button" data-action="run-validation">运行设计验证</button></div>`;
  }
  if (validation.stale) {
    return `<div class="structure-review-validation stale"><div><strong>设计验证已过期</strong><p>${escapeHtml(validation.staleReason || "上游模型已变更。")} 上次运行：${escapeHtml(formatTime(validation.generatedAt))} · ${Number(validation.issueCount) || 0} 项问题仍可参考。</p></div><button type="button" data-action="run-validation">重新运行验证</button></div>`;
  }
  const scores = (validation.scores || []).slice(0, 4).map((item) => `<span><b>${escapeHtml(item.label)}</b> ${Number(item.score) || 0}</span>`).join("");
  return `<div class="structure-review-validation ready"><div><strong>最近验证已并入</strong><p>${escapeHtml(formatTime(validation.generatedAt))} · ${Number(validation.issueCount) || 0} 项规则问题</p>${scores ? `<div class="structure-review-scores">${scores}</div>` : ""}</div><button class="quiet-button" type="button" data-structure-jump="validate">打开完整验证</button></div>`;
}

function renderConsistencyStrip(consistency, summary) {
  const score = Number(summary?.consistencyScore ?? consistency?.score ?? 100);
  const count = Number(summary?.consistencyIssueCount ?? consistency?.issueCount ?? 0);
  const entities = Number(summary?.consistencyEntityCount ?? consistency?.summary?.entityCount ?? 0);
  const tone = count ? (consistency?.summary?.conflictCount ? "stale" : "pending") : "ready";
  return `<div class="structure-review-validation ${tone}" data-consistency-strip="dm2">
    <div>
      <strong>DM2 跨产品实体一致性</strong>
      <p>共享实体 ${entities} 个 · 一致性分 ${score} · ${count ? `${count} 项需复核（类型冲突 / 端点缺失 / 映射断裂）` : "未发现跨产品冲突"}。问题已并入下方「接口契约 / 来源映射」分组。</p>
    </div>
    <button class="quiet-button" type="button" data-structure-filter-group="contract">查看契约问题</button>
  </div>`;
}

function renderEmpty(summary) {
  if (!summary.ov1NodeCount && !summary.ov5ActivityCount) {
    return `<p class="structure-review-empty">尚未建立高层概念图 / 活动模型。请先在「概念图」步骤完成作战概念图与活动骨架。</p>`;
  }
  return `<p class="structure-review-empty ready">当前未发现高优先级结构或验证问题。仍可打开 OV 产品页编辑，或重新运行设计验证。</p>`;
}

function renderFilterEmpty(filter, total) {
  const severity = filter.severity === "alert" ? "高优先级" : filter.severity === "review" ? "需复核" : filter.severity === "pending" ? "未完成" : "当前";
  const group = filter.group !== "all" ? GROUP_LABEL[filter.group] || filter.group : "";
  return `<p class="structure-review-empty">没有匹配${escapeHtml(severity)}${group ? ` / ${escapeHtml(group)}` : ""}的问题（共 ${total} 项）。可切换过滤条件。</p>`;
}

function renderGroup(group) {
  return `<section class="structure-review-group" aria-labelledby="structure-group-${group.id}">
    <div class="structure-review-group-heading">
      <div>
        <h3 id="structure-group-${group.id}">${escapeHtml(group.label)}</h3>
        <p>${escapeHtml(GROUP_HINT[group.id] || "")}</p>
      </div>
      <span class="mini-tag review">${group.issues.length}</span>
    </div>
    <div class="structure-review-list">
      ${group.issues.map((item) => renderIssue(item)).join("")}
    </div>
  </section>`;
}

function renderIssue(item) {
  const severity = item.severity === "alert" ? "alert" : item.severity === "pending" ? "pending" : "review";
  const source = VIEW_LABEL[item.sourceView] || item.sourceView;
  const target = VIEW_LABEL[item.targetView] || item.targetView;
  const jumpLabel = item.targetId && item.targetKind && item.targetKind !== "issue" ? `打开 ${target}` : `前往 ${target}`;
  return `<article class="structure-review-issue ${severity}${item.stale ? " stale" : ""}">
    <div class="structure-review-issue-main">
      <div class="structure-review-issue-meta">
        <span class="status-tag ${severity === "review" || severity === "alert" ? "review" : ""} ${severity === "alert" ? "alert" : ""}">${SEVERITY_LABEL[severity] || "需复核"}</span>
        ${item.stale ? `<span class="structure-stale-badge">过期</span>` : ""}
        <span>${escapeHtml(source)} → ${escapeHtml(target)}</span>
      </div>
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.detail)}</p>
    </div>
    <div class="structure-review-issue-actions">
      ${item.action === "attach-ov1-sources" ? `<button type="button" data-action="attach-ov1-sources">补挂来源</button>` : ""}
      ${item.action === "apply-mapping-quality" ? `<button type="button" data-action="apply-mapping-quality">补全映射质量</button>` : ""}
      ${item.action === "run-validation" ? `<button type="button" data-action="run-validation">运行验证</button>` : ""}
      ${item.action === "derive-ooda" ? `<button type="button" data-action="derive-ooda">重新派生 OODA</button>` : ""}
      ${item.action === "generate-scenario" ? `<button type="button" data-action="generate-scenario">重新生成想定</button>` : ""}
      <button class="quiet-button" type="button" data-structure-jump="${escapeHtml(item.targetView)}" data-target-kind="${escapeHtml(item.targetKind || "")}" data-target-id="${escapeHtml(item.targetId || "")}" data-source-view="${escapeHtml(item.sourceView || "")}">${escapeHtml(jumpLabel)}</button>
      ${item.sourceView && item.sourceView !== item.targetView && item.sourceView !== "structure-review" ? `<button class="quiet-button" type="button" data-structure-jump="${escapeHtml(item.sourceView)}">查看 ${escapeHtml(source)}</button>` : ""}
    </div>
  </article>`;
}

function renderDerivedChip(label, stats, viewId) {
  const tone = stats.review || stats.pending ? "review" : "ready";
  return `<button class="structure-review-chip ${tone}" type="button" data-structure-jump="${escapeHtml(viewId)}" title="打开 ${label}">
    <strong>${escapeHtml(label)}</strong>
    <span>${stats.review} 复核 · ${stats.pending} 未完</span>
  </button>`;
}

function formatTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return String(value).slice(0, 19);
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
