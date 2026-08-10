import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderDerivedViewProvenance } from "./derivedViewProvenance.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { renderDodafLegend, renderEdgeBadge, renderEntityBadge } from "./dodafDraftingView.js";

export function renderOv4(state) {
  const { model, source } = resolveDodafProduct(state, "ov4");
  const storage = state.ov4Storage || { status: "idle", mode: "local", label: "OV-4" };
  const activityCoverage = model.coverage?.activity || { covered: 0, total: 0, percent: 0 };
  const roleCoverage = model.coverage?.role || { covered: 0, total: 0, percent: 0 };
  const unresolved = model.unresolved || { unmappedActivityIds: [], unassignedRoleIds: [] };
  return `
    <section class="surface surface-pad dodaf-drafting-surface" data-dodaf-product="OV-4">
      <div class="section-heading"><div><h2>OV-4 抽象责任关系</h2><p>DoDAF 2.02 / DM2 Organization / responsibleFor 可编辑产品。</p></div><span class="mini-tag">${source === "persisted" ? "已持久化" : "种子/草稿"} · DM2 制图</span></div>
      ${renderDerivedViewProvenance("ov4")}
      ${renderProjectStorageState(storage, { refreshAction: "refresh-project-ov4" })}
      ${renderDodafLegend("OV-4")}
      <div class="toolbar-row dodaf-product-actions">
        <button type="button" class="ghost-btn" data-action="seed-dodaf-ov4">从上游重新种子</button>
        <button type="button" class="primary-btn" data-action="save-dodaf-ov4">保存 OV-4</button>
      </div>
      <div class="ov2-summary"><span>${(model.roles || []).length} 个责任角色</span><span>${(model.relations || []).length} 条关系</span><span>${(unresolved.unmappedActivityIds || []).length} 个活动待归属</span><span>${(model.entities || []).length} 个 DM2 实体</span></div>
      <section class="ov4-coverage" aria-label="抽象责任覆盖情况">
        ${renderCoverage("活动责任归属", activityCoverage, "OV-5 活动已关联至抽象责任角色")}
        ${renderCoverage("责任角色覆盖", roleCoverage, "抽象责任角色已关联至少一项 OV-5 活动")}
      </section>
      <div class="ov3-table-wrap"><table class="ov3-table"><thead><tr><th>抽象责任角色</th><th>活动 / OODA</th><th>说明</th><th>状态</th></tr></thead><tbody>${(model.roles || []).map((role) => `<tr><td><button class="ov3-contract" data-ov4-role="${escapeHtml(role.id)}">${renderEntityBadge({ dm2Type: "Organization", label: role.label })}</button></td><td>${role.activityCount || 0} / ${role.oodaCount || 0}</td><td><input data-dodaf-field="ov4.role.${escapeHtml(role.id)}.detail" value="${escapeHtml(role.detail || "")}" /></td><td><span class="status-tag ${role.state === "ready" ? "" : "review"}">${role.state === "ready" ? "已覆盖" : "待复核"}</span></td></tr>`).join("") || `<tr><td colspan="4" class="ov3-empty">尚无责任角色，可从上游种子生成。</td></tr>`}</tbody></table></div>
      <section class="ov2-layout"><section><h3>跨角色关系</h3><div class="ov2-exchange-list">${(model.relations || []).map((relation) => `<button class="ov2-exchange" data-ov4-relation="${escapeHtml(relation.id)}"><span>${escapeHtml(relation.sourceRoleLabel)} <b>-></b> ${escapeHtml(relation.targetRoleLabel)}</span>${renderEdgeBadge(relation.relationshipType || "responsibleFor")}<small>${escapeHtml(relation.sourceActivityTitle)} -> ${escapeHtml(relation.targetActivityTitle)}</small></button>`).join("") || `<p class="report-empty">尚未定义跨角色关系。</p>`}</div></section><section class="ooda-diagnostics ov2-diagnostics"><h3>产品诊断</h3><div class="ooda-diagnostic-list">${(model.diagnostics || []).map((item) => `<div class="ooda-diagnostic ${escapeHtml(item.state)}"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.statusLabel || item.state)}</span><p>${escapeHtml(item.detail)}</p></div>`).join("")}</div></section></section>
    </section>
  `;
}

function renderCoverage(label, coverage, detail) {
  return `<article><div><b>${escapeHtml(label)}</b><small>${escapeHtml(detail)}</small></div><strong>${coverage.percent || 0}%</strong><div class="ov4-coverage-track" aria-label="${escapeHtml(label)} ${coverage.percent || 0}%"><i style="width:${Math.max(0, Math.min(100, coverage.percent || 0))}%"></i></div><span>${coverage.covered || 0}/${coverage.total || 0}</span></article>`;
}

export function selectionForOv4Role(roleId, models) {
  const { model } = resolveDodafProduct(models, "ov4");
  const role = (model.roles || []).find((item) => item.id === roleId);
  return role ? { id: role.id, kind: "ov4-role", title: role.label, status: "OV-4 Organization", text: "DoDAF 2.02 可编辑责任角色。", facts: [["关联活动", String(role.activityCount || 0)], ["OODA 节点", String(role.oodaCount || 0)], ["关联实体", String(role.entityCount || 0)]], refs: role.activityIds || [] } : null;
}

export function selectionForOv4Relation(relationId, models) {
  const { model } = resolveDodafProduct(models, "ov4");
  const relation = (model.relations || []).find((item) => item.id === relationId);
  return relation ? { id: relation.id, kind: "ov4-relation", title: `${relation.sourceRoleLabel} -> ${relation.targetRoleLabel}`, status: "OV-4 responsibleFor", text: "DoDAF 2.02 可编辑责任关系。", facts: [["关系类型", relation.relationshipType], ["来源活动", relation.sourceActivityTitle], ["目标活动", relation.targetActivityTitle]], refs: [relation.sourceActivityId, relation.targetActivityId].filter(Boolean) } : null;
}

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
