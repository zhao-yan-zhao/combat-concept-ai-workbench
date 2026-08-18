import { escapeHtml } from "./app/domUtils.js";
import { listCmoMissionTypes } from "./forceMissionStore.js";

export function renderOperationalTasks(state = {}) {
  const tasks = Array.isArray(state.forceMission?.tasks) ? state.forceMission.tasks : [];
  const phases = Array.isArray(state.phaseAction?.phases) ? state.phaseAction.phases : [];
  const phaseNames = new Map(phases.map((phase) => [phase.id, phase.name]));
  const confirmed = Boolean(tasks.length && state.forceMission?.tasksConfirmedAt);
  const ready = state.phaseAction?.status === "confirmed" && !state.phaseActionStorage?.stale;
  const missionTypes = listCmoMissionTypes();
  const rows = tasks.map((task) => `<article class="planning-card operational-task-card">
    <div class="planning-card-head"><div>
      <span class="status-chip ${task.side === "hostile" ? "warn" : "ready"}">${task.side === "hostile" ? "红方" : "蓝方"}</span>
      <strong>${escapeHtml(phaseNames.get(task.phaseId) || "未挂接阶段")}</strong>
    </div></div>
    <label>任务名称<input data-operational-task-field="name" data-task-id="${escapeHtml(task.id)}" value="${escapeHtml(task.name)}"></label>
    <label>任务类型（参考 CMO）<select data-operational-task-field="missionType" data-task-id="${escapeHtml(task.id)}">
      ${missionTypes.map((type) => `<option value="${escapeHtml(type.id)}" ${type.id === task.missionType ? "selected" : ""}>${escapeHtml(type.label)}</option>`).join("")}
    </select></label>
    <label>任务区域<input data-operational-task-field="area" data-task-id="${escapeHtml(task.id)}" value="${escapeHtml(task.area || "")}" placeholder="例如：北部警戒区、任务区 A"></label>
    <label>任务目的<textarea data-operational-task-field="objective" data-task-id="${escapeHtml(task.id)}">${escapeHtml(task.objective)}</textarea></label>
    <label>预期效果<textarea data-operational-task-field="expectedEffect" data-task-id="${escapeHtml(task.id)}">${escapeHtml(task.expectedEffect || "")}</textarea></label>
  </article>`).join("");
  return `<section class="planning-page operational-task-page">
    <header class="planning-page-header">
      <div><p class="eyebrow">阶段行动的任务化表达</p><h2>作战任务</h2><p>先明确各阶段红蓝双方要完成什么，再据此编成作战兵力。</p></div>
      <div class="planning-actions">
        <button type="button" data-action="generate-operational-tasks" ${ready ? "" : "disabled"}>${tasks.length ? "重新生成任务" : "生成作战任务"}</button>
        <button type="button" data-action="confirm-operational-tasks" ${tasks.length && !confirmed ? "" : "disabled"}>${confirmed ? "任务已确认" : "确认作战任务"}</button>
      </div>
    </header>
    ${!ready ? `<p class="force-next-banner is-warn">请先确认“阶段与行动”，再生成作战任务。</p>` : ""}
    ${confirmed ? `<p class="force-next-banner is-ready">作战任务已确认，可进入“作战兵力”进行编成。</p>` : ""}
    <div class="operational-task-grid">${rows || `<p class="empty-inspector">尚未形成独立作战任务。任务将按阶段、阵营和行动逐项生成。</p>`}</div>
  </section>`;
}
