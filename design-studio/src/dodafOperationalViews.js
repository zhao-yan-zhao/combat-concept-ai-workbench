import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderDerivedViewProvenance } from "./derivedViewProvenance.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { entityStyleAttrs, renderDodafLegend, renderEdgeBadge, renderEntityBadge } from "./dodafDraftingView.js";

function escape(value) { return String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])); }
function diagnostics(items) { return `<div class="dodaf-checks">${(items || []).map((item) => `<div class="${item.state}"><b>${escape(item.statusLabel || item.state)}</b><span>${escape(item.label)}</span><small>${escape(item.detail)}</small></div>`).join("")}</div>`; }
function tree(nodes) {
  return `<ul class="dodaf-activity-tree">${(nodes || []).map((node) => {
    const style = entityStyleAttrs({ dm2Type: "Activity", type: node.type });
    return `<li class="${style.className}" style="${style.inline}"><span class="dodaf-entity-icon" aria-hidden="true">${escape(style.icon)}</span><strong>${escape(node.title)}</strong>${node.type ? `<small>${escape(node.type)}</small>` : ""}${node.children?.length ? tree(node.children) : ""}</li>`;
  }).join("")}</ul>`;
}
function actions(resourceKey) {
  const extra = resourceKey === "ov5a"
    ? `<button type="button" class="ghost-btn" data-action="sync-ov5a-from-ov5b">从 OV-5b 同步</button>
       <button type="button" class="ghost-btn" data-action="sync-ov5b-from-ov5a">写回 OV-5b</button>`
    : "";
  return `<div class="toolbar-row dodaf-product-actions">
    <button type="button" class="ghost-btn" data-action="seed-dodaf-${resourceKey}">从上游重新种子</button>
    <button type="button" class="primary-btn" data-action="save-dodaf-${resourceKey}">保存 ${resourceKey.toUpperCase()}</button>
    ${extra}
  </div>`;
}

function flattenTree(nodes, parentId = "", acc = []) {
  for (const node of nodes || []) {
    acc.push({ id: node.id, title: node.title, type: node.type, parentId });
    flattenTree(node.children, node.id, acc);
  }
  return acc;
}

function renderOv5aParentEditor(model) {
  const flat = flattenTree(model.tree || []);
  if (!flat.length) return "";
  return `<div class="dodaf-table ov5a-parent-editor"><h3>活动父级（写回 OV-5b parentId）</h3>${flat.map((node) => {
    const options = [`<option value="">（无父级）</option>`]
      .concat(flat.filter((item) => item.id !== node.id).map((item) => `<option value="${escape(item.id)}" ${item.id === node.parentId ? "selected" : ""}>${escape(item.title || item.id)}</option>`))
      .join("");
    return `<article><b>${escape(node.title || node.id)}</b><span>${escape(node.type || "")}</span><label><span>父级活动</span><select data-dodaf-field="ov5a.tree.${escape(node.id)}.parentId">${options}</select></label></article>`;
  }).join("")}</div>`;
}

export function renderOv5a(stateOrModel) {
  const isState = stateOrModel && (stateOrModel.ov5 || stateOrModel.activeView);
  const resolved = isState ? resolveDodafProduct(stateOrModel, "ov5a") : { model: stateOrModel, source: "legacy" };
  const model = resolved.model;
  const storage = isState ? (stateOrModel.ov5aStorage || {}) : null;
  return `<section class="surface surface-pad dodaf-drafting-surface" data-dodaf-product="OV-5a"><div class="section-heading"><div><h2>OV-5a 作战活动分解树</h2><p>DoDAF 2.02 / DM2 Activity 分解（wholePart）。与 OV-5b 双向同步：改父级后保存会写回 parentId。</p></div><span class="mini-tag">${resolved.source === "persisted" ? "已持久化" : "种子/草稿"} · DM2 制图</span></div>${renderDerivedViewProvenance("ov5a")}${storage ? renderProjectStorageState(storage, { refreshAction: "refresh-project-ov5a" }) : ""}${isState ? actions("ov5a") : ""}${renderDodafLegend("OV-5a")}<div class="dodaf-tree">${model.tree?.length ? tree(model.tree) : "<p>尚无可分解活动。</p>"}</div>${isState ? renderOv5aParentEditor(model) : ""}${diagnostics(model.diagnostics)}</section>`;
}

export function renderOv6a(stateOrModel) {
  const isState = stateOrModel && (stateOrModel.ov5 || stateOrModel.activeView);
  const resolved = isState ? resolveDodafProduct(stateOrModel, "ov6a") : { model: stateOrModel, source: "legacy" };
  const model = resolved.model;
  const storage = isState ? (stateOrModel.ov6aStorage || {}) : null;
  return `<section class="surface surface-pad dodaf-drafting-surface" data-dodaf-product="OV-6a"><div class="section-heading"><div><h2>OV-6a 作战规则模型</h2><p>DoDAF 2.02 / DM2 Rule 产品。可编辑持久化。</p></div><span class="mini-tag">${resolved.source === "persisted" ? "已持久化" : "种子/草稿"} · DM2 制图</span></div>${renderDerivedViewProvenance("ov6a")}${storage ? renderProjectStorageState(storage, { refreshAction: "refresh-project-ov6a" }) : ""}${isState ? actions("ov6a") : ""}${renderDodafLegend("OV-6a")}<div class="dodaf-table">${(model.rules || []).length ? model.rules.map((rule) => `<article class="dodaf-rule-card">${renderEntityBadge({ dm2Type: "Rule", label: rule.subject })}<span>${escape(rule.type)}</span><label><span>规则文本</span><textarea data-dodaf-field="ov6a.rule.${escape(rule.id)}.text" rows="2">${escape(rule.text)}</textarea></label></article>`).join("") : "<p>尚无规则，可从 OV-5 种子生成。</p>"}</div>${diagnostics(model.diagnostics)}</section>`;
}

export function renderOv6b(stateOrModel) {
  const isState = stateOrModel && (stateOrModel.ooda || stateOrModel.activeView);
  const resolved = isState ? resolveDodafProduct(stateOrModel, "ov6b") : { model: stateOrModel, source: "legacy" };
  const model = resolved.model;
  const storage = isState ? (stateOrModel.ov6bStorage || {}) : null;
  return `<section class="surface surface-pad dodaf-drafting-surface" data-dodaf-product="OV-6b"><div class="section-heading"><div><h2>OV-6b 作战状态转换</h2><p>DoDAF 2.02 / DM2 State + stateTransition。可编辑持久化；OODA 仅作种子源。</p></div><span class="mini-tag">${resolved.source === "persisted" ? "已持久化" : "种子/草稿"} · DM2 制图</span></div>${renderDerivedViewProvenance("ov6b")}${storage ? renderProjectStorageState(storage, { refreshAction: "refresh-project-ov6b" }) : ""}${isState ? actions("ov6b") : ""}${renderDodafLegend("OV-6b")}<div class="dodaf-table">${(model.transitions || []).length ? model.transitions.map((item) => `<article class="dodaf-transition-card"><div class="dodaf-transition-ends">${renderEntityBadge({ dm2Type: "State", label: item.sourceLabel })} ${renderEdgeBadge("stateTransition", "→")} ${renderEntityBadge({ dm2Type: "State", label: item.targetLabel })}</div><span>转换条件</span><label><textarea data-dodaf-field="ov6b.transition.${escape(item.id)}.condition" rows="2">${escape(item.condition)}</textarea></label></article>`).join("") : "<p>尚无状态转换，可从 OODA 种子生成。</p>"}</div>${diagnostics(model.diagnostics)}</section>`;
}
