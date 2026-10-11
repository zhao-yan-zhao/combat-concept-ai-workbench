import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderDerivedViewProvenance } from "./derivedViewProvenance.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { renderDodafLegend, renderEdgeBadge, renderEntityChip } from "./dodafDraftingView.js";
import { renderForceResourceSubflowBar } from "./forceResourceSubflowNav.js";

export function renderOv2(state) {
  const { model, source } = resolveDodafProduct(state, "ov2");
  const storage = state.ov2Storage || { status: "idle", mode: "local", label: "OV-2" };
  const notes = model.view?.notes || "";
  return `
    <section class="surface surface-pad dodaf-drafting-surface" data-dodaf-product="OV-2">
      ${renderForceResourceSubflowBar(state, "ov2")}
      <div class="section-heading">
        <div>
          <h2>作战资源流描述</h2>
          <p>DoDAF 2.02 / DM2 资源交换事实（Needline / ResourceFlow）。优先从正式任务、兵力及其关系生成并独立持久化。</p>
        </div>
        <span class="mini-tag">${source === "persisted" ? "已持久化" : "种子/草稿"} · DM2 制图</span>
      </div>
      ${renderDerivedViewProvenance("ov2")}
      ${renderProjectStorageState(storage, { refreshAction: "refresh-project-ov2" })}
      ${renderDodafLegend("OV-2")}
      <div class="toolbar-row dodaf-product-actions">
        <button type="button" class="quiet-button" data-action="return-force-mission">← 返回兵力</button>
        <button type="button" class="ghost-btn" data-action="seed-dodaf-ov2">从上游重新生成</button>
        <button type="button" class="ghost-btn" data-action="save-dodaf-ov2">保存 OV-2</button>
        <button type="button" class="primary-btn" data-action="save-and-advance-ov3">保存并进入资源流矩阵 (OV-3) →</button>
        <button type="button" class="ghost-btn" data-action="export-architecture-json">导出架构包 JSON</button>
        <button type="button" class="ghost-btn" data-action="export-architecture-xml">导出架构包 XML</button>
        <button type="button" class="ghost-btn" data-action="import-architecture-file">从文件导入架构包</button>
        <button type="button" class="ghost-btn" data-action="import-architecture-json">粘贴导入 JSON</button>
      </div>
      <div class="ov2-summary"><span>${(model.nodes || []).length} 个节点</span><span>${(model.exchanges || []).length} 条交换</span><span>${(model.entities || []).length} 个 DM2 实体</span><span>${(model.relations || []).length} 条 DM2 关系</span></div>
      <label class="field-block"><span>产品备注</span><textarea data-dodaf-field="ov2.view.notes" rows="2">${escapeHtml(notes)}</textarea></label>
      <div class="ov2-layout">
        <section class="ov2-node-panel" data-grouped-list-panel="ov2" data-grouped-list-dimensions="层级:level|节点类型:type|状态:status" data-grouped-list-default-group="level"><h3>作战节点 (Performer)</h3><div class="ov2-node-list dodaf-entity-grid" data-grouped-list-items>${(model.nodes || []).map((node) => `<div data-grouped-list-item data-group-level="${node.layer === "combat" ? "作战层" : node.layer === "concept" ? "概念层" : "未分层"}" data-group-type="Performer" data-group-status="${(node.taskRefs || []).length ? "已关联" : "待关联"}" data-search="${escapeHtml([node.id, node.label, node.detail, ...(node.taskRefs || [])].filter(Boolean).join(" "))}">${renderEntityChip({ id: node.id, name: node.label, dm2Type: "Performer", detail: `${node.detail || "未填写说明"} · 任务引用 ${(node.taskRefs || []).length}` })}</div>`).join("") || `<p class="report-empty">尚未定义作战节点。可从上游种子生成。</p>`}</div></section>
        <section><h3>节点间交换 (Needline)</h3><div class="ov2-exchange-list">${(model.exchanges || []).map((exchange) => `
          <article class="ov2-exchange editable dodaf-exchange-card" data-ov2-exchange="${escapeHtml(exchange.id)}">
            <span>${escapeHtml(exchange.sourceNodeLabel || exchange.sourceNodeId)} <b>-></b> ${escapeHtml(exchange.targetNodeLabel || exchange.targetNodeId)}</span>
            ${renderEdgeBadge(exchange.flowType || "needline", exchange.flowType || "Needline")}
            <label><span>交换内容</span><input data-dodaf-field="ov2.exchange.${escapeHtml(exchange.id)}.label" value="${escapeHtml(exchange.label)}" /></label>
            <label><span>流类型</span><input data-dodaf-field="ov2.exchange.${escapeHtml(exchange.id)}.flowType" value="${escapeHtml(exchange.flowType)}" /></label>
            <small>${escapeHtml(exchange.sourceActivityTitle || "")} -> ${escapeHtml(exchange.targetActivityTitle || "")}</small>
          </article>`).join("") || `<p class="report-empty">尚未定义跨节点交换。</p>`}</div></section>
      </div>
      <section class="ooda-diagnostics ov2-diagnostics"><h3>产品诊断</h3><div class="ooda-diagnostic-list">${(model.diagnostics || []).map((item) => `<div class="ooda-diagnostic ${escapeHtml(item.state)}"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.statusLabel || item.state)}</span><p>${escapeHtml(item.detail)}</p></div>`).join("") || `<p class="report-empty">无诊断项。</p>`}</div></section>
    </section>
  `;
}

export function selectionForOv2Exchange(exchangeId, models) {
  const { model } = resolveDodafProduct(models, "ov2");
  const exchange = (model.exchanges || []).find((item) => item.id === exchangeId);
  if (!exchange) return null;
  return {
    id: exchange.id,
    kind: "ov2-exchange",
    title: `${exchange.sourceNodeLabel || exchange.sourceNodeId} -> ${exchange.targetNodeLabel || exchange.targetNodeId}`,
    status: "OV-2 Needline",
    text: "DoDAF 2.02 可编辑交换产品；保存后写入项目仓储。",
    facts: [["交换内容", exchange.label], ["交换类型", exchange.flowType], ["发送兵力", exchange.sourceForceRef || exchange.sourceNodeLabel], ["接收兵力", exchange.targetForceRef || exchange.targetNodeLabel], ["关联任务", (exchange.taskRefs || []).join("、") || "未关联"], ["来源活动", exchange.sourceActivityTitle], ["接收活动", exchange.targetActivityTitle]],
    refs: [exchange.sourceForceRef, exchange.targetForceRef, ...(exchange.taskRefs || []), exchange.sourceActivityId, exchange.targetActivityId].filter(Boolean)
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
