import { QUANTITATIVE_CRITERIA } from "./schemeScoring.js";

export function renderModelSnapshotPanel({ snapshots = [], comparison = null, settings = {} }) {
  const defaultBaseline = comparison?.baseline.id || snapshots[1]?.id || "";
  const defaultCandidate = comparison?.candidate.id || snapshots[0]?.id || "";
  return `
    <section class="report-detail-section model-snapshot-section">
      <div class="report-detail-heading"><h3>模型快照与方案对比</h3><span class="report-state ${snapshots.length ? "ready" : "pending"}">${snapshots.length ? `${snapshots.length} 份快照` : "未保存"}</span></div>
      <p class="model-snapshot-intro">保存概念简报、高层概念图、活动模型、研究循环、想定与验证的不可变本地快照；对比不会改写当前模型。</p>
      <div class="model-snapshot-actions"><button class="quiet-button" data-action="save-model-snapshot">保存当前模型</button></div>
      ${snapshots.length ? renderSnapshotList(snapshots) : `<p class="report-empty">尚未保存模型快照。报告归档与模型快照相互独立。</p>`}
      ${snapshots.length > 1 ? renderComparisonForm(snapshots, defaultBaseline, defaultCandidate, settings) : ""}
      ${comparison ? renderComparison(comparison) : ""}
    </section>
  `;
}

function renderSnapshotList(snapshots) {
  return `<div class="model-snapshot-list">${snapshots.map((snapshot) => `<article><div><b>${escapeHtml(snapshot.label)} · ${escapeHtml(snapshot.direction)}</b><small>${escapeHtml(formatTime(snapshot.savedAt))} · ${escapeHtml(snapshotSummary(snapshot))}</small></div><div class="model-snapshot-row-actions"><button class="quiet-button" data-model-snapshot-restore="${escapeHtml(snapshot.id)}">恢复</button><button class="quiet-button" data-model-snapshot-delete="${escapeHtml(snapshot.id)}">删除</button></div></article>`).join("")}</div>`;
}

function renderComparisonForm(snapshots, baselineId, candidateId, settings) {
  const options = snapshots.map((snapshot) => `<option value="${escapeHtml(snapshot.id)}">${escapeHtml(snapshot.label)} · ${escapeHtml(snapshot.direction)} · ${escapeHtml(formatTime(snapshot.savedAt))}</option>`).join("");
  return `
    <form class="model-compare-form" id="modelSnapshotCompareForm">
      <label><span>基准方案</span><select name="baselineId">${optionsWithSelection(options, baselineId)}</select></label>
      <label><span>对比方案</span><select name="candidateId">${optionsWithSelection(options, candidateId)}</select></label>
      <button type="submit">对比</button>
      <details class="model-score-settings"><summary>量化权重</summary><div>${QUANTITATIVE_CRITERIA.map((criterion) => `<label><span>${escapeHtml(criterion.label)}</span><input name="weight-${criterion.id}" type="number" min="0" max="100" step="1" value="${escapeHtml(settings?.weights?.[criterion.id] ?? criterion.weight)}"></label>`).join("")}</div><small>权重将自动归一化到 100%，并随导出记录。</small></details>
    </form>
  `;
}

function optionsWithSelection(options, selectedId) {
  if (!selectedId) return options;
  return options.replace(new RegExp(`value="${escapeRegExp(selectedId)}"`), `value="${selectedId}" selected`);
}

function renderComparison(comparison) {
  const quantitative = comparison.quantitative;
  return `
    <div class="model-comparison">
      <div class="model-comparison-heading"><b>${escapeHtml(comparison.baseline.label)} -> ${escapeHtml(comparison.candidate.label)}</b><small>${escapeHtml(comparison.summary)}</small></div>
      <div class="model-snapshot-actions"><button class="quiet-button" data-action="export-model-comparison-markdown">导出 Markdown</button><button class="quiet-button" data-action="export-model-comparison-json">导出 JSON</button></div>
      <div class="model-metric-grid">${comparison.metrics.map((item) => `<div><span>${escapeHtml(item.label)}</span><b>${item.before}${escapeHtml(item.unit)} -> ${item.after}${escapeHtml(item.unit)}</b><small class="${item.delta === 0 ? "stable" : item.delta > 0 ? "up" : "down"}">${escapeHtml(item.deltaLabel)}</small></div>`).join("")}</div>
      <div class="model-change-list">${comparison.changes.map((change) => `<div><b>${escapeHtml(change.label)}</b>${renderChange("新增", change.added, "add")}${renderChange("移除", change.removed, "remove")}${renderChange("调整", change.changed, "change")}</div>`).join("")}</div>
      ${quantitative ? renderQuantitativeComparison(quantitative) : ""}
    </div>
  `;
}

function renderQuantitativeComparison(quantitative) {
  const baseline = quantitative.baseline;
  const candidate = quantitative.candidate;
  return `
    <section class="quantitative-comparison">
      <div class="quantitative-heading"><div><b>多方案量化比较</b><small>${escapeHtml(quantitative.recommendation)}</small></div><strong>${escapeHtml(baseline.label)} ${baseline.total.toFixed(2)} -> ${escapeHtml(candidate.label)} ${candidate.total.toFixed(2)}</strong></div>
      <div class="quantitative-score-grid">${baseline.criteria.map((criterion) => {
        const compared = candidate.criteria.find((item) => item.id === criterion.id);
        return `<article><b>${escapeHtml(criterion.label)}</b><span>权重 ${criterion.weight}%</span><strong>${criterion.score} -> ${compared?.score ?? 0}</strong><small>${escapeHtml(criterion.evidence.join("；"))}</small></article>`;
      }).join("")}</div>
      ${renderWeightSensitivity(quantitative.sensitivity)}
      <form class="model-score-review-form" id="modelScoreReviewForm">
        <div><b>人工复核分</b><small>留空使用自动初评；范围 0-100。</small></div>
        <div class="model-score-review-grid">${baseline.criteria.map((criterion) => {
          const compared = candidate.criteria.find((item) => item.id === criterion.id);
          return `<label><span>${escapeHtml(criterion.label)}</span><input name="baseline-score-${criterion.id}" type="number" min="0" max="100" step="1" value="${criterion.manualScore ?? ""}" placeholder="${criterion.automaticScore}"><input name="candidate-score-${criterion.id}" type="number" min="0" max="100" step="1" value="${compared?.manualScore ?? ""}" placeholder="${compared?.automaticScore ?? 0}"><textarea name="baseline-rationale-${criterion.id}" maxlength="600" placeholder="基准复核理由（选填）">${escapeHtml(criterion.manualRationale || "")}</textarea><textarea name="candidate-rationale-${criterion.id}" maxlength="600" placeholder="对比复核理由（选填）">${escapeHtml(compared?.manualRationale || "")}</textarea></label>`;
        }).join("")}</div>
        <button type="submit">应用人工复核</button>
      </form>
    </section>
  `;
}

function renderWeightSensitivity(sensitivity) {
  if (!sensitivity) return "";
  return `<section class="quantitative-sensitivity"><div><b>权重敏感性</b><small>${escapeHtml(sensitivity.note || "未分析")}</small></div><div>${(sensitivity.scenarios || []).map((scenario) => `<span class="${scenario.winner === "tie" ? "review" : ""}">${escapeHtml(scenario.label)} ${scenario.baselineTotal} -> ${scenario.candidateTotal}</span>`).join("")}</div></section>`;
}

function renderChange(label, values, type) {
  return values.length ? `<p class="${type}">${label}：${values.map(escapeHtml).join("、")}</p>` : "";
}

function snapshotSummary(snapshot) {
  const model = snapshot.model || {};
  const oodaCount = (model.ooda?.lanes || []).flatMap((lane) => lane.nodes || []).length;
  return `总体图 ${model.ov1?.nodes?.length || 0} 节点 · 活动 ${model.ov5?.activities?.length || 0} 活动 · OODA ${oodaCount} 节点`;
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString("zh-CN", { hour12: false });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
