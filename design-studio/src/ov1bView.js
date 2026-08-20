import { escapeHtml } from "./app/domUtils.js";
import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderProjectStorageState } from "./projectStorageView.js";

const STATUS_LABELS = { pending_review: "待确认", confirmed: "已确认", stale: "已过期", conflict: "有冲突" };

export function renderOv1b(state = {}) {
  const model = resolveDodafProduct(state, "ov1b").model;
  const tasks = state.forceMission?.tasks || [];
  const relations = model.decompositions || [];
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const phaseNames = new Map((state.phaseAction?.phases || []).map((phase) => [phase.id, phase.name]));
  const parentIds = [...new Set(relations.map((item) => item.parentTaskRef))];
  const parents = parentIds.map((id) => taskById.get(id)).filter(Boolean);
  const focusedId = state.relatedModelReturnContext?.focusType === "task" ? state.relatedModelReturnContext.focusId : "";
  const selectedParent = parents.find((task) => task.id === state.ov1bSelectedParentTaskId)
    || parents.find((task) => task.id === focusedId)
    || parents[0]
    || null;
  const activeSide = selectedParent ? taskSide(selectedParent) : state.ov1bSide === "hostile" ? "hostile" : "friendly";
  const selectedRelations = selectedParent ? relations.filter((item) => item.parentTaskRef === selectedParent.id) : [];
  const sideTasks = tasks.filter((task) => taskSide(task) === activeSide);
  const options = sideTasks.map((task) => `<option value="${escapeHtml(task.id)}">${escapeHtml(task.name || task.id)}</option>`).join("");

  return `<section class="surface ov1b-workbench" data-dodaf-product="OV-1b">
    <header class="ov1b-header"><div><span class="eyebrow">任务分解 · OV1b</span><h2>任务分解模型</h2><p>一次查看一项母任务及其直接子任务。任务正文仍在“作战任务”步骤维护。</p></div><div class="ov1b-header-meta"><span class="mini-tag">${parents.length} 项母任务</span><span class="mini-tag">${selectedRelations.length} 项子任务</span></div></header>
    ${renderProjectStorageState(state.ov1bStorage, { refreshAction: "refresh-project-ov1b" })}
    <div class="ov1b-layout">
      <aside class="ov1b-task-panel" aria-label="母任务列表" data-grouped-list-panel="ov1b" data-grouped-list-dimensions="阵营:side|阶段:phase|任务类型:type|状态:status" data-grouped-list-default-group="side">
        <div class="ov1b-pane-title"><div><span>任务分解</span><strong>母任务</strong></div><small>${parents.length} 项</small></div>
        <div class="ov1b-side-tasks" data-grouped-list-items>${parents.map((task, index) => renderParentItem(task, index, selectedParent?.id, relations, phaseNames)).join("") || `<p class="ov1b-side-empty">暂无母任务</p>`}</div>
      </aside>
      <main class="ov1b-canvas-panel">
        <div class="ov1b-canvas-toolbar" data-action-form="ov1b-add-decomposition"><label><span>母任务</span><select name="parentTaskRef" required><option value="">选择任务</option>${options}</select></label><span class="ov1b-arrow">→</span><label><span>子任务</span><select name="childTaskRef" required><option value="">选择任务</option>${options}</select></label><label class="ov1b-rationale"><span>分解依据</span><input name="rationale" placeholder="说明分解依据"></label><button type="button" data-action="ov1b-add-decomposition" ${sideTasks.length < 2 ? "disabled" : ""}>新增关系</button></div>
        ${renderDecompositionCanvas(selectedParent, selectedRelations, taskById, activeSide)}
        <div class="ov1b-relation-strip">${selectedRelations.map((item) => renderRelation(item, taskById)).join("") || `<p>${selectedParent ? "该母任务尚无有效子任务关系。" : "请选择或生成母任务分解关系。"}</p>`}</div>
      </main>
    </div>
  </section>`;
}

function renderParentItem(task, index, selectedId, relations, phaseNames) {
  const taskRelations = relations.filter((item) => item.parentTaskRef === task.id);
  const count = taskRelations.length;
  const status = taskRelations.some((item) => item.status === "conflict")
    ? "有冲突"
    : taskRelations.length && taskRelations.every((item) => item.status === "confirmed")
      ? "已确认"
      : "待确认";
  const side = sideLabel(taskSide(task));
  const phase = phaseNames.get(task.phaseId) || "未挂接阶段";
  const type = task.missionType || "未分类";
  return `<button type="button" class="ov1b-task-item ${task.id === selectedId ? "is-focused" : ""}" data-action="ov1b-select-parent" data-task-id="${escapeHtml(task.id)}" data-grouped-list-item data-group-side="${side}" data-group-phase="${escapeHtml(phase)}" data-group-type="${escapeHtml(type)}" data-group-status="${status}" data-search="${escapeHtml([task.id, task.name, side, phase, type].filter(Boolean).join(" "))}"><b>${String(index + 1).padStart(2, "0")}</b><span>${escapeHtml(task.name || task.id)}</span><small>${count} 项子任务 · ${escapeHtml(type)}</small></button>`;
}

function renderDecompositionCanvas(parent, relations, taskById, side) {
  if (!parent) return `<div class="ov1b-uml-canvas is-empty"><strong>暂无母任务</strong><span>AI 生成父子任务关系后，母任务将显示在左侧。</span></div>`;
  const children = relations.map((item) => ({ relation: item, task: taskById.get(item.childTaskRef) })).filter((item) => item.task);
  const tone = side === "hostile" ? "hostile" : "friendly";
  return `<figure class="ov1b-uml-canvas is-decomposition is-${tone}">
    <figcaption><div><strong>${sideLabel(side)}任务分解图</strong><span>母任务 → 直接子任务</span></div><span>${children.length} 项子任务</span></figcaption>
    <div class="ov1b-decomposition-scroll"><div class="ov1b-decomposition-stage" style="--child-count:${Math.max(1, children.length)}">
      <article class="ov1b-parent-node"><strong>${escapeHtml(parent.name || parent.id)}</strong><small>${escapeHtml(parent.missionType || "任务")} · ${children.length} 项子任务</small><code>${escapeHtml(parent.id)}</code></article>
      ${children.length ? `<div class="ov1b-trunk" aria-hidden="true"></div><div class="ov1b-child-bus" aria-hidden="true"></div><div class="ov1b-children">${children.map(({ task, relation }, index) => renderChildNode(task, relation, index)).join("")}</div>` : `<div class="ov1b-no-children">该母任务尚无可展示的直接子任务</div>`}
    </div></div>
  </figure>`;
}

function renderChildNode(task, relation, index) {
  return `<article class="ov1b-child-node status-${escapeHtml(relation.status || "pending_review")}"><span class="ov1b-child-drop" aria-hidden="true"></span><strong>${escapeHtml(task.name || task.id)}</strong><small>${escapeHtml(task.missionType || "任务")}</small><code>M${index + 2}</code></article>`;
}

function renderRelation(item, taskById) {
  const parent = taskById.get(item.parentTaskRef); const child = taskById.get(item.childTaskRef); const missing = !parent || !child; const status = missing ? "conflict" : item.status || "pending_review";
  return `<article class="ov1b-relation status-${escapeHtml(status)}" data-decomposition-id="${escapeHtml(item.id)}"><div><strong>${escapeHtml(parent?.name || item.parentTaskRef)} → ${escapeHtml(child?.name || item.childTaskRef)}</strong><input aria-label="分解依据" data-dodaf-field="ov1b.decomposition.${escapeHtml(item.id)}.rationale" value="${escapeHtml(item.rationale || "")}" placeholder="待补充分解依据"></div><span>${escapeHtml(missing ? "引用失效" : STATUS_LABELS[status] || status)}</span><button type="button" class="quiet-button compact" data-action="ov1b-toggle-confirm" data-decomposition-id="${escapeHtml(item.id)}" ${missing ? "disabled" : ""}>${status === "confirmed" ? "撤回" : "确认"}</button><button type="button" class="quiet-button compact danger-quiet" data-action="ov1b-remove-decomposition" data-decomposition-id="${escapeHtml(item.id)}">删除</button></article>`;
}

function taskSide(task) { return task?.side === "hostile" ? "hostile" : "friendly"; }
function sideLabel(side) { return side === "hostile" ? "红方" : "蓝方"; }
