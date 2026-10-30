import { escapeHtml } from "./app/domUtils.js";
import { listCmoMissionTypes } from "./forceMissionStore.js";

const AREA_TYPES = [["patrol", "巡逻区"], ["prosecution", "交战/追击区"], ["support", "支援区"], ["transit", "航渡走廊"], ["target", "目标区"], ["exclusion", "禁入区"], ["other", "其他"]];
const GEOMETRY_TYPES = [["point", "点位"], ["circle", "圆形区"], ["polygon", "多边形区"], ["corridor", "走廊"]];

export function renderOperationalTasks(state = {}) {
  const tasks = Array.isArray(state.forceMission?.tasks) ? state.forceMission.tasks : [];
  const phases = Array.isArray(state.phaseAction?.phases) ? state.phaseAction.phases : [];
  const phaseNames = new Map(phases.map((phase) => [phase.id, phase.name]));
  const selected = tasks.find((task) => task.id === state.operationalTaskSelectedId) || tasks[0] || null;
  const confirmed = Boolean(tasks.length && state.forceMission?.tasksConfirmedAt);
  const ready = phases.length > 0;
  const generating = Boolean(state.operationalTaskGenerating);
  const progress = state.operationalTaskGenerationProgress;
  const generationLabel = progress?.total ? `AI 正在生成 ${progress.completed}/${progress.total}` : "AI 正在生成…";
  const source = state.forceMission?.generation?.source || "";
  const completeCount = tasks.filter((task) => task.area?.name && task.area.name !== "待人工明确" && (task.area.points || []).some((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))).length;
  const incompleteAreaCount = tasks.filter((task) => !task.area?.name || task.area.name === "待人工明确" || !(task.area.points || []).some((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))).length;
  return `<section class="operational-task-workbench">
    <header class="operational-task-header">
      <div><div class="operational-task-title-line"><h2>作战任务</h2>${renderStatus(confirmed, generating, source)}</div></div>
      <div class="operational-task-actions"><button type="button" class="${tasks.length ? "quiet-button" : "primary-btn"}" data-action="generate-operational-tasks" ${ready && !generating ? "" : "disabled"}>${generating ? generationLabel : tasks.length ? "AI 一键重新生成" : "AI 一键生成"}</button><button type="button" data-action="confirm-operational-tasks" ${tasks.length && !confirmed && !generating && !incompleteAreaCount ? "" : "disabled"}>${confirmed ? "任务已确认" : incompleteAreaCount ? `${incompleteAreaCount} 项区域待补齐` : "确认作战任务"}</button>${confirmed ? `<button type="button" class="primary-btn" data-action="select-force-mission-layer" data-layer="concept" data-view="force-mission" title="作战任务已就绪，进入概念兵力与编成设计">下一步：概念兵力设计 →</button>` : ""}</div>
    </header>
    ${!ready ? `<p class="force-next-banner is-warn">请先在“阶段行动”中生成阶段，再生成作战任务与区域候选。</p>` : ""}
    <div class="operational-task-layout ${selected ? "has-selection" : "is-empty"}">
      <aside class="operational-task-list" aria-label="作战任务列表" data-grouped-list-panel="operational-task" data-grouped-list-dimensions="阶段:phase|阵营:side|任务类型:type|状态:status" data-grouped-list-default-group="phase"><div class="operational-pane-head"><div><span>任务清单</span><strong>${tasks.length}</strong></div><div><small>按阶段与阵营</small><button type="button" class="quiet-button compact" data-action="add-operational-task" ${generating ? "disabled" : ""} title="新增作战任务">＋ 新增</button></div></div><div class="operational-task-list-scroll" data-grouped-list-items>${tasks.map((task, index) => renderTaskListItem(task, index, selected?.id, phaseNames, confirmed)).join("") || renderEmpty()}</div><div class="operational-task-completion"><span>区域补全</span><strong>${completeCount}/${tasks.length}</strong></div></aside>
      <main class="operational-task-editor">${selected ? renderTaskEditor(selected, phaseNames, listCmoMissionTypes(), phases) : renderWorkspaceEmpty(ready, generating)}</main>
      <aside class="operational-area-editor">${selected ? renderAreaEditor(selected) : `<div class="operational-empty-side"><span>区域</span><p>选择任务后编辑区域类型和坐标。</p></div>`}</aside>
    </div>
  </section>`;
}

function renderStatus(confirmed, generating, source) {
  if (generating) return `<span class="operational-status is-running">生成中</span>`;
  if (confirmed) return `<span class="operational-status is-confirmed">已就绪</span>`;
  if (source) return `<span class="operational-status is-confirmed">已就绪</span>`;
  return `<span class="operational-status">待生成</span>`;
}

function renderTaskListItem(task, index, selectedId, phaseNames, confirmed) {
  const coordinateCount = (task.area?.points || []).filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)).length;
  const phaseLabel = phaseNames.get(task.phaseId) || "未挂接阶段";
  const sideLabel = task.side === "hostile" ? "红方" : task.side === "friendly" ? "蓝方" : "其他";
  const statusLabel = confirmed ? "已就绪" : coordinateCount ? "已就绪" : "待补全";
  return `<div class="operational-task-list-item ${task.id === selectedId ? "is-active" : ""}" data-grouped-list-item data-group-phase="${escapeHtml(phaseLabel)}" data-group-side="${sideLabel}" data-group-type="${escapeHtml(task.missionType || "未分类")}" data-group-status="${statusLabel}" data-search="${escapeHtml([task.id, task.name, task.objective, task.expectedEffect, phaseLabel, sideLabel, task.missionType].filter(Boolean).join(" "))}"><button type="button" class="operational-task-select" data-action="select-operational-task" data-task-id="${escapeHtml(task.id)}"><span class="operational-task-index">${String(index + 1).padStart(2, "0")}</span><span class="operational-task-list-copy"><strong>${escapeHtml(task.name)}</strong><small>${escapeHtml(phaseLabel)} · ${sideLabel}</small></span></button><button type="button" class="operational-task-delete" data-action="remove-operational-task" data-task-id="${escapeHtml(task.id)}" title="删除任务" aria-label="删除任务">×</button></div>`;
}

function renderTaskEditor(task, phaseNames, missionTypes, phases = []) {
  const selectedPhase = phases.find((p) => p.id === task.phaseId);
  const phaseLabel = selectedPhase?.name || phaseNames.get(task.phaseId) || "未挂接阶段";
  return `<div class="operational-editor-scroll"><div class="operational-pane-head"><div><span>任务定义</span><strong>${task.side === "hostile" ? "红方" : "蓝方"}</strong></div><small>${escapeHtml(phaseLabel)}</small></div>
    <div class="operational-form-section"><label class="operational-field is-wide"><span>任务名称</span><input data-operational-task-field="name" data-task-id="${escapeHtml(task.id)}" value="${escapeHtml(task.name)}"></label><label class="operational-field is-wide"><span>任务类型 <em>CMO</em></span><select data-operational-task-field="missionType" data-task-id="${escapeHtml(task.id)}">${missionTypes.map((type) => `<option value="${escapeHtml(type.id)}" ${type.id === task.missionType ? "selected" : ""}>${escapeHtml(type.label)}</option>`).join("")}</select></label></div>
    <div class="operational-form-section"><label class="operational-field"><span>所属阶段</span><select data-operational-task-field="phaseId" data-task-id="${escapeHtml(task.id)}">${phases.length ? phases.map((phase) => `<option value="${escapeHtml(phase.id)}" ${phase.id === task.phaseId ? "selected" : ""}>${escapeHtml(phase.name)}</option>`).join("") : `<option value="">未挂接阶段</option>`}</select></label><label class="operational-field"><span>所属阵营</span><select data-operational-task-field="side" data-task-id="${escapeHtml(task.id)}"><option value="friendly" ${task.side === "friendly" ? "selected" : ""}>蓝方</option><option value="hostile" ${task.side === "hostile" ? "selected" : ""}>红方</option></select></label></div>
    <div class="operational-form-section is-prose"><label class="operational-field"><span>任务目的</span><textarea data-operational-task-field="objective" data-task-id="${escapeHtml(task.id)}">${escapeHtml(task.objective)}</textarea></label><label class="operational-field"><span>预期效果</span><textarea data-operational-task-field="expectedEffect" data-task-id="${escapeHtml(task.id)}">${escapeHtml(task.expectedEffect || "")}</textarea></label></div>
    <div class="operational-source-block"><span>阶段行动来源</span><p>${escapeHtml(task.sourceAction || "人工新增作战任务")}</p></div></div>`;
}

function renderAreaEditor(task) {
  const area = task.area || {};
  const points = Array.isArray(area.points) ? area.points : [];
  return `<div class="operational-area-scroll"><div class="operational-pane-head"><div><span>任务区域</span><strong>WGS84</strong></div><small>${area.needsReview ? "候选 · 待复核" : "已复核"}</small></div>${renderAreaPlot(area)}
    <div class="operational-area-fields"><label class="operational-field is-wide"><span>区域名称</span><input data-operational-task-area-field="name" data-task-id="${escapeHtml(task.id)}" value="${escapeHtml(area.name || "")}"></label><label class="operational-field"><span>区域用途</span><select data-operational-task-area-field="type" data-task-id="${escapeHtml(task.id)}">${optionList(AREA_TYPES, area.type)}</select></label><label class="operational-field"><span>几何类型</span><select data-operational-task-area-field="geometryType" data-task-id="${escapeHtml(task.id)}">${optionList(GEOMETRY_TYPES, area.geometryType)}</select></label>${area.geometryType === "circle" ? `<label class="operational-field"><span>半径（海里）</span><input type="number" min="0" max="5000" step="0.1" data-operational-task-area-field="radiusNm" data-task-id="${escapeHtml(task.id)}" value="${escapeHtml(area.radiusNm || 0)}"></label>` : ""}</div>
    <div class="operational-coordinate-head"><div><strong>参考点</strong><small>${points.length} 个</small></div><button type="button" class="quiet-button" data-action="add-operational-task-area-point" data-task-id="${escapeHtml(task.id)}">添加点</button></div>
    <div class="operational-coordinate-table">${points.map((point, index) => renderCoordinateRow(task.id, point, index)).join("") || `<p class="operational-coordinate-empty">AI 未发现可核验的地理依据。可手工添加 WGS84 坐标点。</p>`}</div>
    <label class="operational-field is-wide"><span>区域说明</span><textarea data-operational-task-area-field="description" data-task-id="${escapeHtml(task.id)}">${escapeHtml(area.description || "")}</textarea></label><label class="operational-field is-wide"><span>坐标依据</span><textarea data-operational-task-area-field="basis" data-task-id="${escapeHtml(task.id)}">${escapeHtml(area.basis || "")}</textarea></label><label class="operational-review-check"><input type="checkbox" data-operational-task-area-field="needsReview" data-task-id="${escapeHtml(task.id)}" ${area.needsReview ? "checked" : ""}><span>区域坐标仍需人工复核</span></label></div>`;
}

function renderCoordinateRow(taskId, point, index) {
  return `<div class="operational-coordinate-row"><span>${String(index + 1).padStart(2, "0")}</span><input aria-label="参考点名称" data-task-area-point-field="label" data-task-id="${escapeHtml(taskId)}" data-point-id="${escapeHtml(point.id)}" value="${escapeHtml(point.label)}"><input aria-label="纬度" type="number" min="-90" max="90" step="0.000001" placeholder="纬度" data-task-area-point-field="latitude" data-task-id="${escapeHtml(taskId)}" data-point-id="${escapeHtml(point.id)}" value="${point.latitude ?? ""}"><input aria-label="经度" type="number" min="-180" max="180" step="0.000001" placeholder="经度" data-task-area-point-field="longitude" data-task-id="${escapeHtml(taskId)}" data-point-id="${escapeHtml(point.id)}" value="${point.longitude ?? ""}"><button type="button" class="operational-remove-point" data-action="remove-operational-task-area-point" data-task-id="${escapeHtml(taskId)}" data-point-id="${escapeHtml(point.id)}" title="删除参考点" aria-label="删除参考点">×</button></div>`;
}

function renderAreaPlot(area) {
  const points = (area.points || []).filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  if (!points.length) return `<div class="operational-area-plot is-empty"><div><strong>暂无坐标</strong><span>等待 AI 依据或人工参考点</span></div></div>`;
  const lats = points.map((point) => point.latitude); const lons = points.map((point) => point.longitude);
  const minLat = Math.min(...lats); const maxLat = Math.max(...lats); const minLon = Math.min(...lons); const maxLon = Math.max(...lons);
  const projected = points.map((point) => ({ x: 10 + ((point.longitude - minLon) / (maxLon - minLon || 1)) * 80, y: 90 - ((point.latitude - minLat) / (maxLat - minLat || 1)) * 80 }));
  const path = projected.map((point) => `${point.x},${point.y}`).join(" ");
  const shape = area.geometryType === "polygon" && projected.length >= 3 ? `<polygon points="${path}" />` : `<polyline points="${path}" />`;
  return `<div class="operational-area-plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="任务区域坐标示意">${shape}${projected.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="2.4" />`).join("")}</svg><span>${escapeHtml(area.name || "任务区域")}</span></div>`;
}

function optionList(options, selected) { return options.map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join(""); }
function renderEmpty() { return `<div class="operational-list-empty"><span>00</span><p>尚无任务</p></div>`; }
function renderWorkspaceEmpty(ready, generating = false) {
  return `<div class="operational-workspace-empty">
    <strong>${ready ? "生成或新增作战任务" : "等待阶段确认"}</strong>
    <p>${ready ? "AI 将同时给出 CMO 任务类型、区域用途和有依据的坐标候选；也可手动新增任务进行自定义设计。" : "阶段行动确认后，本步骤才具备生成依据。"}</p>
    ${ready ? `<div class="operational-workspace-empty-actions" style="margin-top: 1rem; display: flex; gap: 8px; justify-content: center;"><button type="button" class="primary-btn" data-action="generate-operational-tasks" ${generating ? "disabled" : ""}>AI 一键生成作战任务</button><button type="button" class="quiet-button" data-action="add-operational-task" ${generating ? "disabled" : ""}>手动新增任务</button></div>` : ""}
  </div>`;
}
