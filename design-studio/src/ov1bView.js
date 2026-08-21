import { escapeHtml } from "./app/domUtils.js";
import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderProjectStorageActions } from "./projectStorageView.js";

const STATUS_LABELS = { pending_review: "待复核", confirmed: "已确认", stale: "已过期", conflict: "有冲突" };
const DIMENSION_LABELS = { phase: "阶段", side: "阵营", missionType: "任务类型", area: "区域", custom: "自定义", legacy: "兼容迁移" };

export function renderOv1b(state = {}) {
  const resolved = resolveDodafProduct(state, "ov1b");
  const model = resolved.model || { taskGroups: [] };
  const groups = Array.isArray(model.taskGroups) ? model.taskGroups : [];
  const tasks = Array.isArray(state.forceMission?.tasks) ? state.forceMission.tasks : [];
  const taskById = new Map(tasks.map((task) => [String(task.id), task]));
  const selectedId = resolveSelectedGroupId(state, groups);
  const selected = groups.find((group) => group.id === selectedId) || null;
  const pendingCount = groups.filter((group) => group.status !== "confirmed").length;
  const referencedCount = new Set(groups.flatMap((group) => group.taskRefs || [])).size;

  return `<section class="sm-page ov1b-page" data-view-page="task-organization" data-dodaf-product="OV-1b">
    <header class="sm-top ov1b-top"><div class="sm-bar">
      <div class="sm-identity"><h2>任务整理</h2><small class="sm-summary">${resolved.source === "persisted" ? "已持久化" : "本地/种子"} · ${groups.length} 个任务组 · ${referencedCount}/${tasks.length} 项现有任务${pendingCount ? ` · <span class="is-review">${pendingCount} 组待复核</span>` : ""}</small></div>
      <div class="sm-toolbar">${state.ov1bStorage ? renderProjectStorageActions(state.ov1bStorage, { refreshAction: "refresh-project-ov1b" }) : ""}<button type="button" class="primary-btn" data-action="save-dodaf-ov1b">保存</button></div>
    </div></header>
    <div class="ov1b-layout">
      <aside class="ov1b-task-panel" aria-label="任务组列表" data-grouped-list-panel="ov1b" data-grouped-list-dimensions="整理维度:dimension|状态:status" data-grouped-list-default-group="dimension">
        <header class="sm-panel-head"><strong>任务组</strong><small>${groups.length} 组 · 顺序即建议执行顺序</small></header>
        <div class="ov1b-side-tasks" role="listbox" data-grouped-list-items>${groups.map((group, index) => renderGroupItem(group, index, selectedId)).join("") || `<p class="ov1b-side-empty">暂无任务组，请使用工具箱新增或由 AI 整理。</p>`}</div>
      </aside>
      <main class="ov1b-canvas-panel">${renderGroupBoard(selected, tasks, taskById, state.ov1bEditOpen === true)}</main>
    </div>
  </section>`;
}

function renderGroupItem(group, index, selectedId) {
  const dimension = DIMENSION_LABELS[group.dimension] || group.dimension || "自定义";
  const status = STATUS_LABELS[group.status] || group.status || "待复核";
  return `<button type="button" class="ov1b-task-item ${group.id === selectedId ? "is-focused" : ""}" data-action="ov1b-select-group" data-group-id="${escapeHtml(group.id)}" data-grouped-list-item data-group-dimension="${escapeHtml(dimension)}" data-group-status="${escapeHtml(status)}" data-search="${escapeHtml([group.name, dimension, status, group.rationale].filter(Boolean).join(" "))}"><b>${String(index + 1).padStart(2, "0")}</b><span>${escapeHtml(group.name || `任务组 ${index + 1}`)}</span><small>${(group.taskRefs || []).length} 项任务 · ${escapeHtml(dimension)}</small></button>`;
}

function renderGroupBoard(group, tasks, taskById, editOpen = false) {
  if (!group) return `<div class="ov1b-board-empty"><strong>选择一个任务组</strong><span>这里只整理“作战任务”步骤中已有的任务，不新增或改写任务。</span></div>`;
  const refs = Array.isArray(group.taskRefs) ? group.taskRefs : [];
  const selected = new Set(refs.map(String));
  return `<section class="ov1b-group-board">
    <header class="ov1b-board-head"><div><strong>${escapeHtml(group.name || "未命名任务组")}</strong><small>${refs.length} 项任务 · 可调整组内顺序</small></div><span class="ov1b-status status-${escapeHtml(group.status || "pending_review")}">${escapeHtml(STATUS_LABELS[group.status] || group.status || "待复核")}</span></header>
    <div class="ov1b-board-content${editOpen ? " is-edit-open" : ""}"><section class="ov1b-organization-canvas"><header><div><strong>任务组织画布</strong><small>空白拖拽平移 · 滚轮缩放 · 节点序号表示组内顺序</small></div><div class="ov1b-canvas-zoom"><button type="button" data-ov1b-zoom="out" title="缩小" aria-label="缩小">−</button><output data-ov1b-zoom-label>100%</output><button type="button" data-ov1b-zoom="in" title="放大" aria-label="放大">＋</button><button type="button" data-ov1b-zoom="fit" title="适配画布" aria-label="适配画布">⌖</button></div></header>${renderOrganizationCanvas(group, refs, taskById)}</section>${editOpen ? `<aside class="ov1b-edit-dock"><section class="ov1b-task-picker"><header><strong>现有任务</strong><small>${tasks.length} 项</small></header><div>${tasks.map((task) => `<label class="ov1b-task-option"><input type="checkbox" data-action="ov1b-toggle-task" data-group-id="${escapeHtml(group.id)}" value="${escapeHtml(task.id)}" ${selected.has(String(task.id)) ? "checked" : ""}><span><strong>${escapeHtml(task.name || task.id)}</strong><small>${escapeHtml(task.missionType || "未分类")} · ${task.side === "hostile" ? "红方" : "蓝方"}</small></span></label>`).join("") || `<p class="ov1b-side-empty">“作战任务”步骤暂无可整理任务。</p>`}</div></section>${stateCoordinationEditor(group)}</aside>` : ""}</div>
  </section>`;
}

function stateCoordinationEditor(group) {
  return `<div class="ov1b-properties-dock"><header><strong>任务组属性</strong></header><label><span>组名</span><input data-dodaf-field="ov1b.taskGroup.${escapeHtml(group.id)}.name" value="${escapeHtml(group.name || "")}"></label><label><span>整理维度</span><select data-dodaf-field="ov1b.taskGroup.${escapeHtml(group.id)}.dimension">${Object.entries(DIMENSION_LABELS).map(([value, label]) => `<option value="${value}" ${group.dimension === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><label><span>整理依据</span><textarea data-dodaf-field="ov1b.taskGroup.${escapeHtml(group.id)}.rationale" placeholder="说明任务组的整理依据">${escapeHtml(group.rationale || "")}</textarea></label></div><div class="ov1b-coordination-dock" data-ov1b-coordination-editor><header><strong>协同说明</strong><small>描述任务组内衔接与跨组协同关系</small></header><textarea data-dodaf-field="ov1b.taskGroup.${escapeHtml(group.id)}.coordination" placeholder="说明组内衔接或跨组协同关系">${escapeHtml(group.coordination || "")}</textarea></div>`;
}

function renderOrganizationCanvas(group, refs, taskById) {
  if (!refs.length) return `<div class="ov1b-canvas-viewport is-empty" data-task-group-id="${escapeHtml(group.id)}"><div class="ov1b-canvas-stage"><p>从右侧勾选现有任务，任务节点将在画布中出现。</p></div></div>`;
  return `<div class="ov1b-canvas-viewport" data-task-group-id="${escapeHtml(group.id)}"><div class="ov1b-canvas-stage" style="--task-count:${Math.max(1, refs.length)}">
    <article class="ov1b-group-node"><span>任务组</span><strong>${escapeHtml(group.name || "未命名任务组")}</strong><small>${refs.length} 项现有任务 · ${escapeHtml(DIMENSION_LABELS[group.dimension] || group.dimension || "自定义")}</small></article>
    <div class="ov1b-group-trunk" aria-hidden="true"></div>
    <div class="ov1b-task-node-row">${refs.map((ref, index) => renderTaskNode(group.id, ref, index, refs.length, taskById)).join("")}</div>
  </div></div>`;
}

function renderTaskNode(groupId, ref, index, total, taskById) {
  const task = taskById.get(String(ref));
  return `<article class="ov1b-canvas-task-node ${task ? "" : "is-missing"}"><span class="ov1b-node-branch" aria-hidden="true"></span><b>${String(index + 1).padStart(2, "0")}</b><strong>${escapeHtml(task?.name || ref)}</strong><small>${task ? `${escapeHtml(task.missionType || "未分类")} · ${task.side === "hostile" ? "红方" : "蓝方"}` : "引用已失效"}</small><div><button type="button" class="quiet-button compact" data-action="ov1b-move-task" data-group-id="${escapeHtml(groupId)}" data-task-id="${escapeHtml(ref)}" data-delta="-1" ${index === 0 ? "disabled" : ""} title="上移">↑</button><button type="button" class="quiet-button compact" data-action="ov1b-move-task" data-group-id="${escapeHtml(groupId)}" data-task-id="${escapeHtml(ref)}" data-delta="1" ${index === total - 1 ? "disabled" : ""} title="下移">↓</button></div></article>`;
}

function resolveSelectedGroupId(state, groups) {
  const current = String(state.ov1bSelectedGroupId || "");
  return groups.some((group) => group.id === current) ? current : groups[0]?.id || "";
}
