import { escapeHtml } from "./app/domUtils.js";
import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderProjectStorageState } from "./projectStorageView.js";

const STATUS_LABELS = {
  pending_review: "待确认",
  confirmed: "已确认",
  stale: "已过期",
  conflict: "有冲突"
};

export function renderOv1b(state = {}) {
  const model = resolveDodafProduct(state, "ov1b").model;
  const tasks = state.forceMission?.tasks || [];
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const rows = (model.decompositions || []).map((item) => renderRow(item, taskById)).join("");
  const options = tasks.map((task) => `<option value="${escapeHtml(task.id)}">${escapeHtml(task.name || task.id)}</option>`).join("");
  const context = state.relatedModelReturnContext;
  const focusedTask = context?.focusType === "task" ? taskById.get(context.focusId) : null;

  return `<section class="surface ov1b-workbench" data-dodaf-product="OV-1b">
    <header class="ov1b-header">
      <div>
        <span class="eyebrow">任务分解 · OV1b</span>
        <h2>父任务与子任务关系</h2>
        <p>只保存任务引用和分解判定；任务名称、区域与效果仍在“作战任务”步骤维护。</p>
      </div>
      <div class="ov1b-header-meta">
        <span class="mini-tag">${model.decompositions?.length || 0} 条关系</span>
        ${focusedTask ? `<span class="mini-tag review">当前任务 · ${escapeHtml(focusedTask.name || focusedTask.id)}</span>` : ""}
      </div>
    </header>
    ${renderProjectStorageState(state.ov1bStorage, { refreshAction: "refresh-project-ov1b" })}
    <div class="ov1b-create" data-action-form="ov1b-add-decomposition">
      <label><span>父任务</span><select name="parentTaskRef" required><option value="">选择父任务</option>${options}</select></label>
      <span class="ov1b-arrow" aria-hidden="true">→</span>
      <label><span>子任务</span><select name="childTaskRef" required><option value="">选择子任务</option>${options}</select></label>
      <label class="ov1b-rationale"><span>分解依据</span><input name="rationale" placeholder="说明为何属于该父任务" /></label>
      <button type="button" data-action="ov1b-add-decomposition" ${tasks.length < 2 ? "disabled" : ""}>新增关系</button>
    </div>
    <div class="ov1b-table" role="table" aria-label="任务分解关系">
      <div class="ov1b-table-head" role="row"><span>父任务</span><span>子任务</span><span>分解依据</span><span>状态</span><span>操作</span></div>
      ${rows || `<div class="ov1b-empty">尚未建立任务分解。请先在作战任务步骤形成至少两个可引用任务。</div>`}
    </div>
  </section>`;
}

function renderRow(item, taskById) {
  const parent = taskById.get(item.parentTaskRef);
  const child = taskById.get(item.childTaskRef);
  const missing = !parent || !child;
  const status = missing ? "conflict" : item.status || "pending_review";
  return `<div class="ov1b-row status-${escapeHtml(status)}" role="row" data-decomposition-id="${escapeHtml(item.id)}">
    <strong>${escapeHtml(parent?.name || item.parentTaskRef)}</strong>
    <strong>${escapeHtml(child?.name || item.childTaskRef)}</strong>
    <input aria-label="分解依据" data-dodaf-field="ov1b.decomposition.${escapeHtml(item.id)}.rationale" value="${escapeHtml(item.rationale || "")}" placeholder="待补充分解依据" />
    <span class="ov1b-status">${escapeHtml(missing ? "引用失效" : STATUS_LABELS[status] || status)}</span>
    <div class="ov1b-row-actions">
      <button type="button" class="quiet-button compact" data-action="ov1b-toggle-confirm" data-decomposition-id="${escapeHtml(item.id)}" ${missing ? "disabled" : ""}>${status === "confirmed" ? "撤回" : "确认"}</button>
      <button type="button" class="quiet-button compact danger-quiet" data-action="ov1b-remove-decomposition" data-decomposition-id="${escapeHtml(item.id)}">删除</button>
    </div>
  </div>`;
}
