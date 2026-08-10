import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderDerivedViewProvenance } from "./derivedViewProvenance.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { renderDodafLegend, renderEntityBadge } from "./dodafDraftingView.js";

export function renderOv6c(state) {
  const { model, source } = resolveDodafProduct(state, "ov6c");
  const storage = state.ov6cStorage || { status: "idle", mode: "local", label: "OV-6c" };
  const unresolved = model.unresolved || { unscheduledNodeIds: [], orphanTimelineIds: [], outOfOrderIds: [] };
  const orderReviewCount = (unresolved.outOfOrderIds || []).length;
  return `
    <section class="surface surface-pad dodaf-drafting-surface" data-dodaf-product="OV-6c">
      <div class="section-heading"><div><h2>OV-6c 事件序列</h2><p>DoDAF 2.02 / DM2 Event 产品。可编辑持久化；OODA/想定仅作种子源。</p></div><span class="mini-tag">${source === "persisted" ? "已持久化" : "种子/草稿"} · DM2 制图</span></div>
      ${renderDerivedViewProvenance("ov6c")}
      ${renderProjectStorageState(storage, { refreshAction: "refresh-project-ov6c" })}
      ${renderDodafLegend("OV-6c")}
      <div class="toolbar-row dodaf-product-actions">
        <button type="button" class="ghost-btn" data-action="seed-dodaf-ov6c">从上游重新种子</button>
        <button type="button" class="primary-btn" data-action="save-dodaf-ov6c">保存 OV-6c</button>
      </div>
      <div class="ov2-summary"><span>${(model.events || []).length} 个事件</span><span>${(unresolved.unscheduledNodeIds || []).length} 个未排程节点</span><span>${(unresolved.orphanTimelineIds || []).length} 个来源异常</span><span>${orderReviewCount} 个顺序待复核</span><span>${(model.entities || []).length} 个 DM2 实体</span></div>
      <div class="ov3-table-wrap"><table class="ov3-table"><thead><tr><th>序列</th><th>抽象时间</th><th>事件</th><th>来源</th><th>状态</th></tr></thead><tbody>${(model.events || []).map((event) => `<tr class="${event.outOfOrder ? "ov6c-order-review" : ""}"><td>${event.sequence}</td><td><input data-dodaf-field="ov6c.event.${escapeHtml(event.id)}.time" value="${escapeHtml(event.time)}" /></td><td>${renderEntityBadge({ dm2Type: "Event", label: event.title })}<label><span>标题</span><input data-dodaf-field="ov6c.event.${escapeHtml(event.id)}.title" value="${escapeHtml(event.title)}" /></label><label><span>说明</span><input data-dodaf-field="ov6c.event.${escapeHtml(event.id)}.description" value="${escapeHtml(event.description || "")}" /></label></td><td>${escapeHtml(event.phase || "未映射")}<small>${escapeHtml(event.sourceNodeId || "未映射")} · ${escapeHtml(event.sourceActivityId || "未映射")}</small></td><td><span class="status-tag ${event.state === "ready" && !event.outOfOrder ? "" : "review"}">${stateLabel(event.state, event.outOfOrder)}</span></td></tr>`).join("") || `<tr><td colspan="5" class="ov3-empty">尚无事件，可从 OODA/想定种子生成。</td></tr>`}</tbody></table></div>
      <section class="ooda-diagnostics ov2-diagnostics"><h3>产品诊断</h3><div class="ooda-diagnostic-list">${(model.diagnostics || []).map((item) => `<div class="ooda-diagnostic ${escapeHtml(item.state)}"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.statusLabel || item.state)}</span><p>${escapeHtml(item.detail)}</p></div>`).join("")}</div></section>
    </section>
  `;
}

export function selectionForOv6cEvent(eventId, models) {
  const { model } = resolveDodafProduct(models, "ov6c");
  const event = (model.events || []).find((item) => item.id === eventId);
  if (!event) return null;
  return { id: event.id, kind: "ov6c-event", title: event.title, status: "OV-6c Event", text: "DoDAF 2.02 可编辑事件产品。", facts: [["抽象时间", event.time], ["OODA 节点", event.sourceNodeId || "未映射"], ["来源活动", event.sourceActivityId || "未映射"], ["状态", stateLabel(event.state, event.outOfOrder)]], refs: [event.sourceActivityId, event.sourceNodeId].filter(Boolean) };
}

function stateLabel(value, outOfOrder) {
  if (outOfOrder) return "顺序待复核";
  return ({ ready: "已映射", review: "来源待复核", pending: "待排程" })[value] || "待复核";
}

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
