import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderDerivedViewProvenance } from "./derivedViewProvenance.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { entityStyleAttrs, renderDodafLegend, renderEdgeBadge, renderEntityBadge } from "./dodafDraftingView.js";
import { renderPhaseChainGuide } from "./phaseChainGuide.js";
import { renderRuleLibrary } from "./ruleLibraryView.js";
import { renderOv6bPage } from "./stateMachineView.js";

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
    ? `<button type="button" class="ghost-btn" data-action="sync-ov5a-from-ov5b">从活动模型同步</button>
       <button type="button" class="ghost-btn" data-action="sync-ov5b-from-ov5a">写回活动模型</button>`
    : "";
  return `<div class="toolbar-row dodaf-product-actions">
    <button type="button" class="ghost-btn" data-action="seed-dodaf-${resourceKey}">从上游重新种子</button>
    <button type="button" class="primary-btn" data-action="save-dodaf-${resourceKey}">保存产品</button>
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
  return `<div class="dodaf-table ov5a-parent-editor"><h3>活动父级（写回活动模型 parentId）</h3>${flat.map((node) => {
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
  return `<section class="surface surface-pad dodaf-drafting-surface" data-dodaf-product="OV-5a"><div class="section-heading"><div><h2>作战活动分解树</h2><p>DoDAF 2.02 / DM2 Activity 分解（wholePart）。与活动模型双向同步：改父级后保存会写回 parentId。</p></div><span class="mini-tag">${resolved.source === "persisted" ? "已持久化" : "种子/草稿"} · DM2 制图</span></div>${renderDerivedViewProvenance("ov5a")}${storage ? renderProjectStorageState(storage, { refreshAction: "refresh-project-ov5a" }) : ""}${isState ? actions("ov5a") : ""}${renderDodafLegend("OV-5a")}<div class="dodaf-tree">${model.tree?.length ? tree(model.tree) : "<p>尚无可分解活动。</p>"}</div>${isState ? renderOv5aParentEditor(model) : ""}${diagnostics(model.diagnostics)}</section>`;
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
