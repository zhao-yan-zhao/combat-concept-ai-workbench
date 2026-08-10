import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderDerivedViewProvenance } from "./derivedViewProvenance.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { renderDodafLegend, renderEdgeBadge, renderEntityBadge } from "./dodafDraftingView.js";

export function renderOv3(state) {
  const { model, source } = resolveDodafProduct(state, "ov3");
  const storage = state.ov3Storage || { status: "idle", mode: "local", label: "OV-3" };
  const exchangesByPair = new Map((model.exchanges || []).map((exchange) => [`${exchange.sourceActivityId}:${exchange.targetActivityId}`, exchange]));
  const activities = model.activities || [];
  const unresolved = model.unresolved || { missingContractCount: 0, mismatchCount: 0 };
  return `
    <section class="surface surface-pad dodaf-drafting-surface" data-dodaf-product="OV-3">
      <div class="section-heading"><div><h2>OV-3 资源交换</h2><p>DoDAF 2.02 / DM2 可编辑资源流矩阵。可从 OV-5 种子生成并独立保存。</p></div><span class="mini-tag">${source === "persisted" ? "已持久化" : "种子/草稿"} · DM2 制图</span></div>
      ${renderDerivedViewProvenance("ov3")}
      ${renderProjectStorageState(storage, { refreshAction: "refresh-project-ov3" })}
      ${renderDodafLegend("OV-3")}
      <div class="toolbar-row dodaf-product-actions">
        <button type="button" class="ghost-btn" data-action="seed-dodaf-ov3">从上游重新种子</button>
        <button type="button" class="primary-btn" data-action="save-dodaf-ov3">保存 OV-3</button>
      </div>
      <div class="ov2-summary"><span>${(model.exchanges || []).length} 条交换</span><span>${unresolved.missingContractCount || 0} 条定义缺失</span><span>${unresolved.mismatchCount || 0} 条待映射</span><span>${(model.entities || []).length} 个 DM2 实体</span></div>
      <section class="ov3-matrix-section" aria-labelledby="ov3-matrix-heading">
        <div class="ov3-matrix-heading"><div><h3 id="ov3-matrix-heading">资源流矩阵</h3><p>行是来源活动，列是接收活动；可在下方表中编辑契约字段。</p></div><span>源 → 目标</span></div>
        <div class="ov3-matrix-wrap"><table class="ov3-matrix"><thead><tr><th scope="col">来源 \\ 接收</th>${activities.map((activity) => `<th scope="col" title="${escapeHtml(activity.title)}">${escapeHtml(activity.title)}</th>`).join("")}</tr></thead><tbody>${activities.map((sourceActivity) => `<tr><th scope="row" title="${escapeHtml(sourceActivity.title)}">${escapeHtml(sourceActivity.title)}</th>${activities.map((target) => renderMatrixCell(exchangesByPair.get(`${sourceActivity.id}:${target.id}`))).join("")}</tr>`).join("") || `<tr><td class="ov3-empty">尚无活动矩阵。</td></tr>`}</tbody></table></div>
      </section>
      <div class="ov3-table-wrap"><table class="ov3-table"><thead><tr><th>来源活动</th><th>交换类型</th><th>输出 / 目标输入</th><th>接收活动</th><th>状态</th></tr></thead><tbody>${(model.exchanges || []).map((exchange) => `<tr><td>${renderEntityBadge({ dm2Type: "Activity", label: exchange.sourceActivityTitle })}</td><td>${renderEdgeBadge(exchange.exchangeType || exchange.edgeType, typeLabel(exchange.exchangeType))}</td><td><div class="ov3-contract editable"><label><span>输出</span><input data-dodaf-field="ov3.exchange.${escapeHtml(exchange.id)}.output" value="${escapeHtml(exchange.output)}" /></label><label><span>输入</span><input data-dodaf-field="ov3.exchange.${escapeHtml(exchange.id)}.input" value="${escapeHtml(exchange.input)}" /></label></div></td><td>${renderEntityBadge({ dm2Type: "Activity", label: exchange.targetActivityTitle })}</td><td><span class="status-tag ${exchange.compatibility === "ready" ? "" : "review"}">${statusLabel(exchange.compatibility)}</span></td></tr>`).join("") || `<tr><td colspan="5" class="ov3-empty">尚未定义交换，可从 OV-5 种子生成。</td></tr>`}</tbody></table></div>
      <section class="ooda-diagnostics ov2-diagnostics"><h3>产品诊断</h3><div class="ooda-diagnostic-list">${(model.diagnostics || []).map((item) => `<div class="ooda-diagnostic ${escapeHtml(item.state)}"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.statusLabel || item.state)}</span><p>${escapeHtml(item.detail)}</p></div>`).join("")}</div></section>
    </section>
  `;
}

function renderMatrixCell(exchange) {
  if (!exchange) return `<td class="ov3-matrix-empty" aria-label="无直接交换">—</td>`;
  const title = `${exchange.sourceActivityTitle} → ${exchange.targetActivityTitle}：${typeLabel(exchange.exchangeType)}，${statusLabel(exchange.compatibility)}`;
  return `<td class="ov3-matrix-cell ${escapeHtml(exchange.compatibility)}"><button type="button" class="ov3-matrix-link" data-ov3-exchange="${escapeHtml(exchange.id)}" title="${escapeHtml(title)}">${renderEdgeBadge(exchange.exchangeType || exchange.edgeType, typeLabel(exchange.exchangeType))}<small>${statusLabel(exchange.compatibility)}</small></button></td>`;
}

export function selectionForOv3Exchange(exchangeId, models) {
  const { model } = resolveDodafProduct(models, "ov3");
  const exchange = (model.exchanges || []).find((item) => item.id === exchangeId);
  if (!exchange) return null;
  return { id: exchange.id, kind: "ov3-exchange", title: `${exchange.sourceActivityTitle} -> ${exchange.targetActivityTitle}`, status: "OV-3 ResourceFlow", text: "DoDAF 2.02 可编辑交换产品。", facts: [["交换类型", typeLabel(exchange.exchangeType)], ["源输出", exchange.output || "未定义"], ["目标输入", exchange.input || "未定义"], ["匹配状态", statusLabel(exchange.compatibility)]], refs: [exchange.sourceActivityId, exchange.targetActivityId] };
}

function typeLabel(value) { return ({ resource: "资源", control: "控制", information: "信息" })[value] || "信息"; }
function statusLabel(value) { return ({ ready: "直接匹配", review: "需映射", pending: "定义缺失" })[value] || "待复核"; }
function escapeHtml(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
