import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderDerivedViewProvenance } from "./derivedViewProvenance.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { renderDodafLegend, renderEdgeBadge, renderEntityBadge } from "./dodafDraftingView.js";
import { renderRuleLibrary } from "./ruleLibraryView.js";
import { renderOv6bPage } from "./stateMachineView.js";

function escape(value) { return String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])); }
function diagnostics(items) { return `<div class="dodaf-checks">${(items || []).map((item) => `<div class="${item.state}"><b>${escape(item.statusLabel || item.state)}</b><span>${escape(item.label)}</span><small>${escape(item.detail)}</small></div>`).join("")}</div>`; }
function actions(resourceKey) {
  const extra = resourceKey === "ov5a"
    ? `<button type="button" class="ghost-btn" data-action="sync-ov5a-from-ov5b">从作战活动同步</button>
       <button type="button" class="ghost-btn" data-action="sync-ov5b-from-ov5a">应用父子关系</button>`
    : "";
  return `<div class="toolbar-row dodaf-product-actions">
    <button type="button" class="ghost-btn" data-action="seed-dodaf-${resourceKey}">从上游重新种子</button>
    <button type="button" class="primary-btn" data-action="save-dodaf-${resourceKey}">保存产品</button>
    ${extra}
  </div>`;
}

function renderOv5aDecompositionList(model, activities = [], editable = false) {
  const activityById = new Map((activities || []).map((activity) => [String(activity.id), activity]));
  const parentByChild = new Map((model.decompositions || []).map((item) => [item.childActivityRef, item.parentActivityRef]));
  const refs = new Set([...activityById.keys(), ...(model.decompositions || []).flatMap((item) => [item.parentActivityRef, item.childActivityRef])]);
  const rows = [...refs].map((id) => {
    const activity = activityById.get(id);
    const parentRef = parentByChild.get(id) || "";
    return { id, activity, parentRef, depth: decompositionDepth(id, parentByChild), broken: !activity || Boolean(parentRef && !activityById.has(parentRef)) };
  }).sort((left, right) => left.depth - right.depth || String(left.activity?.title || left.id).localeCompare(String(right.activity?.title || right.id), "zh-CN"));
  if (!rows.length) return `<p class="ov5a-empty">尚无可分解活动，请先在 OV5b 建立作战活动。</p>`;
  return `<div class="ov5a-decomposition-list">
    <div class="ov5a-decomposition-heading"><h3>活动分解清单</h3><span>${model.decompositions?.length || 0} 条父子关系</span></div>
    <div class="ov5a-decomposition-table-wrap"><table class="ov5a-decomposition-table">
      <thead><tr><th>活动</th><th>上级活动</th><th>层级</th><th>状态</th></tr></thead>
      <tbody>${rows.map((row) => {
        const activityLabel = row.activity?.title || row.id;
        const parentLabel = row.parentRef ? (activityById.get(row.parentRef)?.title || row.parentRef) : "（顶层活动）";
        const options = [`<option value="">（顶层活动）</option>`]
          .concat([...activityById.values()].filter((item) => String(item.id) !== row.id).map((item) => `<option value="${escape(item.id)}" ${String(item.id) === row.parentRef ? "selected" : ""}>${escape(item.title || item.id)}</option>`))
          .join("");
        return `<tr class="${row.broken ? "is-conflict" : ""}">
          <td style="--ov5a-depth:${Math.min(row.depth, 8)}"><span class="ov5a-level-mark" aria-hidden="true"></span><strong>${escape(activityLabel)}</strong><small>${escape(row.activity?.type || row.id)}</small></td>
          <td>${editable && row.activity ? `<select data-dodaf-field="ov5a.decomposition.${escape(row.id)}.parentActivityRef" aria-label="${escape(activityLabel)}的上级活动">${options}</select>` : `<span>${escape(parentLabel)}</span>`}</td>
          <td>${row.depth + 1}</td>
          <td><span class="status-tag ${row.broken ? "review" : ""}">${row.broken ? "引用失效" : row.parentRef ? "已分解" : "顶层"}</span></td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>
  </div>`;
}

function decompositionDepth(id, parentByChild) {
  const seen = new Set([id]);
  let current = parentByChild.get(id) || "";
  let depth = 0;
  while (current && !seen.has(current) && depth < 12) {
    seen.add(current);
    depth += 1;
    current = parentByChild.get(current) || "";
  }
  return depth;
}

export function renderOv5a(stateOrModel) {
  const isState = stateOrModel && (stateOrModel.ov5 || stateOrModel.activeView);
  const resolved = isState ? resolveDodafProduct(stateOrModel, "ov5a") : { model: stateOrModel, source: "legacy" };
  const model = resolved.model;
  const storage = isState ? (stateOrModel.ov5aStorage || {}) : null;
  const activities = isState ? (stateOrModel.ov5?.activities || []) : [];
  return `<section class="surface surface-pad dodaf-drafting-surface" data-dodaf-product="OV-5a"><div class="section-heading"><div><h2>作战活动分解</h2><p>DoDAF 2.02 / DM2 Activity 分解（wholePart）。本产品只保存父子活动引用，活动正文由 OV5b 维护。</p></div><span class="mini-tag">${resolved.source === "persisted" ? "已持久化" : "种子/草稿"} · 层级清单</span></div>${renderDerivedViewProvenance("ov5a")}${storage ? renderProjectStorageState(storage, { refreshAction: "refresh-project-ov5a" }) : ""}${isState ? actions("ov5a") : ""}${renderDodafLegend("OV-5a")}${renderOv5aDecompositionList(model, activities, isState)}${diagnostics(model.diagnostics)}</section>`;
}

/** 规则库研究台（左列表 + 右编辑；建库态 / 绑定校验态）。 */
export function renderOv6a(stateOrModel) {
  // Acceptance fixtures may pass a bare product model; wrap into page state.
  if (stateOrModel && !stateOrModel.activeView && (stateOrModel.rules || stateOrModel.product === "OV-6a")) {
    return renderRuleLibrary({
      activeView: "ov6a",
      ov6a: stateOrModel,
      ov6aStorage: {},
      phaseAction: stateOrModel.phaseAction,
      phaseActionStorage: stateOrModel.phaseActionStorage,
      ov5: stateOrModel.ov5
    });
  }
  return renderRuleLibrary(stateOrModel || {});
}

export function renderOv6b(stateOrModel) {
  return renderOv6bPage(stateOrModel);
}
