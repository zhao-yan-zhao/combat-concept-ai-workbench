import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderDerivedViewProvenance } from "./derivedViewProvenance.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { entityStyleAttrs, renderDodafLegend, renderEdgeBadge, renderEntityBadge } from "./dodafDraftingView.js";
import { listForceAndPhaseSubjects } from "./ov6Workbench.js";
import { renderPhaseChainGuide } from "./phaseChainGuide.js";
import { renderRuleLibrary } from "./ruleLibraryView.js";

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
  const isState = stateOrModel && (stateOrModel.ooda || stateOrModel.activeView || stateOrModel.phaseAction || stateOrModel.forceMission);
  const resolved = isState ? resolveDodafProduct(stateOrModel, "ov6b") : { model: stateOrModel, source: "legacy" };
  const model = resolved.model;
  const storage = isState ? (stateOrModel.ov6bStorage || {}) : null;
  const machines = model.stateMachines || [];
  const subjects = isState ? listForceAndPhaseSubjects(stateOrModel) : [];
  const subjectOptions = subjects.map((item) => `<option value="${escape(item.id)}" data-subject-type="${escape(item.subjectType)}">${escape(item.name)}（${escape(item.subjectType)}）</option>`).join("");
  const toolbar = isState
    ? `<div class="toolbar-row dodaf-product-actions ov6b-toolbar">
        <button type="button" class="ghost-btn" data-action="seed-dodaf-ov6b">从研究循环种子</button>
        <label class="ov6-inline-field"><span>主体</span>
          <select id="ov6bSubjectPicker">${subjectOptions || '<option value="">自定义主体</option>'}</select>
        </label>
        <button type="button" class="ghost-btn" data-action="ov6b-add-machine" data-subject-type="task">新建任务状态机</button>
        <button type="button" class="ghost-btn" data-action="ov6b-add-machine" data-subject-type="object">新建对象状态机</button>
        <button type="button" class="ghost-btn" data-action="ov6b-add-machine" data-subject-type="force">新建兵力状态机</button>
        <button type="button" class="primary-btn" data-action="save-dodaf-ov6b">保存状态机</button>
      </div>`
    : "";

  const machineCards = machines.length ? machines.map((machine) => {
    const states = machine.states || [];
    const transitions = machine.transitions || [];
    const stateChips = states.map((state) => `<span class="ov6-state-chip kind-${escape(state.kind || "normal")}">${escape(state.name || state.label)}<small>${escape(state.kind || "")}</small></span>`).join("");
    const transitionRows = transitions.length
      ? transitions.map((item) => `<article class="dodaf-transition-card ov6-transition-row">
          <div class="dodaf-transition-ends">${renderEntityBadge({ dm2Type: "State", label: item.sourceLabel || item.fromStateRef })} ${renderEdgeBadge("stateTransition", "→")} ${renderEntityBadge({ dm2Type: "State", label: item.targetLabel || item.toStateRef })}</div>
          <label><span>转换条件</span><textarea data-dodaf-field="ov6b.transition.${escape(item.id)}.condition" rows="2">${escape(item.condition || "")}</textarea></label>
          <small class="muted">${(item.ruleRefs || []).length ? `规则 ${escape((item.ruleRefs || []).join("、"))}` : "未挂规则"} · ${(item.eventRefs || []).length ? `事件 ${escape((item.eventRefs || []).join("、"))}` : "未挂事件"}</small>
        </article>`).join("")
      : `<p class="muted">尚无转换</p>`;
    return `<section class="ov6-machine-card" data-machine-id="${escape(machine.id)}">
      <header class="ov6-machine-head">
        <div>
          <strong>${escape(machine.name || machine.id)}</strong>
          <span class="muted">${escape(machine.subjectType || "other")}${machine.subjectRef ? ` · ${escape(machine.subjectRef)}` : ""}</span>
        </div>
        <div class="ov6-machine-actions">
          <button type="button" class="ghost-btn compact" data-action="ov6b-add-transition" data-machine-id="${escape(machine.id)}">加转换</button>
          <button type="button" class="ghost-btn compact" data-action="ov6b-remove-machine" data-machine-id="${escape(machine.id)}">删除机</button>
        </div>
      </header>
      <div class="ov6-machine-fields">
        <label><span>名称</span><input data-action="ov6b-machine-field" data-machine-id="${escape(machine.id)}" data-field="name" value="${escape(machine.name || "")}" /></label>
        <label><span>主体引用</span><input data-action="ov6b-machine-field" data-machine-id="${escape(machine.id)}" data-field="subjectRef" value="${escape(machine.subjectRef || "")}" /></label>
        <label><span>主体类型</span>
          <select data-action="ov6b-machine-field" data-machine-id="${escape(machine.id)}" data-field="subjectType">
            ${["task", "object", "force", "phase", "other"].map((type) => `<option value="${type}" ${machine.subjectType === type ? "selected" : ""}>${type}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="ov6-state-row">${stateChips || "<span class='muted'>无状态</span>"}</div>
      <div class="dodaf-table">${transitionRows}</div>
    </section>`;
  }).join("") : `<p class="empty-inspector">尚无状态机。请按任务/对象/兵力分别新建，勿合并为全项目一条链。</p>`;

  const guideState = isState ? stateOrModel : {};
  return `<section class="surface surface-pad dodaf-drafting-surface ov6-workbench" data-dodaf-product="OV-6b">
    ${isState ? renderPhaseChainGuide(guideState, "ov6b") : ""}
    <div class="section-heading"><div><h2>状态机校验</h2><p>阶段行动链：为关键任务/对象分机建模；至少开始/中间/结束，问题回改阶段。</p></div><span class="mini-tag">${resolved.source === "persisted" ? "已持久化" : "种子/草稿"} · v${model.version || 2}</span></div>
    ${renderDerivedViewProvenance("ov6b")}
    ${storage ? renderProjectStorageState(storage, { refreshAction: "refresh-project-ov6b" }) : ""}
    ${toolbar}
    ${renderDodafLegend("OV-6b")}
    <div class="ov2-summary"><span>${machines.length} 台状态机</span><span>${(model.states || []).length} 个状态</span><span>${(model.transitions || []).length} 条转换</span></div>
    <div class="ov6-machine-grid">${machineCards}</div>
    ${diagnostics(model.diagnostics)}
  </section>`;
}
