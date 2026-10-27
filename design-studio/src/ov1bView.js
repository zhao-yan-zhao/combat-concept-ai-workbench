import { escapeHtml } from "./app/domUtils.js";
import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderProjectStorageActions } from "./projectStorageView.js";

const STATUS_LABELS = { pending_review: "待复核", confirmed: "已确认", stale: "已过期", conflict: "有冲突" };
const DIMENSION_LABELS = { phase: "作战阶段", side: "推演阵营", missionType: "任务类型", area: "作战区域", custom: "自定义", legacy: "兼容迁移" };

export function renderOv1b(state = {}) {
  const resolved = resolveDodafProduct(state, "ov1b");
  const model = resolved.model || { taskGroups: [] };
  const groups = Array.isArray(model.taskGroups) ? model.taskGroups : [];
  const tasks = Array.isArray(state.forceMission?.tasks) ? state.forceMission.tasks : [];
  const phases = Array.isArray(state.phaseAction?.phases)
    ? state.phaseAction.phases
    : (Array.isArray(state.phaseActionConcept?.phases) ? state.phaseActionConcept.phases : []);
  const taskById = new Map(tasks.map((task) => [String(task.id), task]));
  const selectedId = resolveSelectedGroupId(state, groups);
  const selected = groups.find((group) => group.id === selectedId) || null;
  const pendingCount = groups.filter((group) => group.status !== "confirmed").length;
  const referencedCount = new Set(groups.flatMap((group) => group.taskRefs || [])).size;

  return `<section class="sm-page ov1b-page" data-view-page="task-organization" data-dodaf-product="OV-1b">
    <header class="sm-top ov1b-top"><div class="sm-bar">
      <div class="sm-identity">
        <h2>任务整理</h2>
        <small class="sm-summary">${resolved.source === "persisted" ? "已持久化" : "本地/种子"} · ${groups.length} 个任务组 · ${referencedCount}/${tasks.length} 项现有任务${pendingCount ? ` · <span class="is-review">${pendingCount} 组待复核</span>` : ""}</small>
      </div>
      <div class="sm-toolbar">
        ${state.ov1bStorage ? renderProjectStorageActions(state.ov1bStorage, { refreshAction: "refresh-project-ov1b" }) : ""}
        <button type="button" class="quiet-button" data-action="ov1b-add-group" title="新增任务组">+ 新增任务组</button>
        <button type="button" class="primary-btn" data-action="save-dodaf-ov1b">保存</button>
      </div>
    </div></header>

    ${renderPhaseTimelineStrip(phases, selected, groups)}

    <div class="ov1b-layout">
      <aside class="ov1b-task-panel" aria-label="任务组列表" data-grouped-list-panel="ov1b" data-grouped-list-dimensions="整理维度:dimension|状态:status" data-grouped-list-default-group="dimension">
        <header class="sm-panel-head">
          <div>
            <strong>任务组</strong>
            <small>${groups.length} 组 · 顺序即建议执行顺序</small>
          </div>
          <button type="button" class="quiet-button compact" data-action="ov1b-add-group" title="新增任务组">+ 新增组</button>
        </header>
        <div class="ov1b-side-tasks" role="listbox" data-grouped-list-items>${groups.map((group, index) => renderGroupItem(group, index, selectedId, taskById)).join("") || `<div class="ov1b-side-empty"><p>暂无任务组，点击上方或下方新增。</p><button type="button" class="quiet-button compact" data-action="ov1b-add-group">+ 新增任务组</button></div>`}</div>
      </aside>
      <main class="ov1b-canvas-panel">${renderGroupBoard(selected, tasks, taskById, state.ov1bEditOpen === true, phases)}</main>
    </div>
  </section>`;
}

function renderPhaseTimelineStrip(phases = [], selectedGroup = null, groups = []) {
  if (!phases.length) return "";
  const currentPhaseId = selectedGroup?.phaseRef || "";
  return `<nav class="ov1b-phase-nav-strip" aria-label="作战阶段时序推进导轨">
    <div class="ov1b-phase-nav-label"><span>作战阶段推进</span><small>点击定位对应阶段</small></div>
    <div class="ov1b-phase-nav-scroll">
      ${phases.map((phase, idx) => {
        const isCurrent = currentPhaseId === phase.id || (!currentPhaseId && idx === 0);
        const matchingGroup = groups.find((g) => g.phaseRef === phase.id)
          || groups.find((g) => g.name?.includes(phase.name) || g.name?.includes(`阶段${idx + 1}`) || g.name?.includes(`Phase ${idx + 1}`))
          || groups[idx] || null;
        const targetGroupId = matchingGroup ? matchingGroup.id : "";
        return `<button type="button" class="ov1b-phase-chip ${isCurrent ? "is-active" : ""}" ${targetGroupId ? `data-action="ov1b-select-group" data-group-id="${escapeHtml(targetGroupId)}"` : ""} title="${escapeHtml(phase.objective || phase.name || "")}">
          <span class="ov1b-phase-chip-idx">Phase ${idx + 1}</span>
          <strong class="ov1b-phase-chip-name">${escapeHtml(phase.name || `阶段 ${idx + 1}`)}</strong>
          <small class="ov1b-phase-chip-time">${escapeHtml(phase.timeWindow || "时间待定")}</small>
        </button>`;
      }).join('<span class="ov1b-phase-nav-arrow" aria-hidden="true">→</span>')}
    </div>
  </nav>`;
}

function renderGroupItem(group, index, selectedId, taskById) {
  const dimension = DIMENSION_LABELS[group.dimension] || group.dimension || "自定义";
  const status = STATUS_LABELS[group.status] || group.status || "待复核";
  const refs = group.taskRefs || [];
  const hasRed = refs.some((r) => taskById.get(String(r))?.side === "hostile");
  const hasBlue = refs.some((r) => taskById.get(String(r))?.side !== "hostile");
  const partyBadge = hasRed && !hasBlue
    ? `<span class="party-badge is-red">红方对抗</span>`
    : !hasRed && hasBlue
      ? `<span class="party-badge is-blue">蓝方战法</span>`
      : `<span class="party-badge is-mixed">红蓝协同</span>`;

  return `<button type="button" class="ov1b-task-item ${group.id === selectedId ? "is-focused" : ""}" data-action="ov1b-select-group" data-group-id="${escapeHtml(group.id)}" data-grouped-list-item data-group-dimension="${escapeHtml(dimension)}" data-group-status="${escapeHtml(status)}" data-search="${escapeHtml([group.name, dimension, status, group.rationale].filter(Boolean).join(" "))}">
    <div class="ov1b-task-item-head">
      <b>${String(index + 1).padStart(2, "0")}</b>
      <span title="${escapeHtml(group.name || `任务组 ${index + 1}`)}">${escapeHtml(group.name || `任务组 ${index + 1}`)}</span>
    </div>
    <div class="ov1b-task-item-meta">
      ${partyBadge}
      <small title="${refs.length} 项任务 · ${escapeHtml(dimension)}">${refs.length} 项任务 · ${escapeHtml(dimension)}</small>
    </div>
  </button>`;
}

function renderGroupBoard(group, tasks, taskById, editOpen = false, phases = []) {
  if (!group) return `<div class="ov1b-board-empty">
    <strong>选择或新增一个任务组</strong>
    <span>这里只整理“作战任务”步骤中已有的任务，不新增或改写任务。</span>
    <div style="margin-top:12px;">
      <button type="button" class="primary-btn" data-action="ov1b-add-group">+ 新增任务组</button>
    </div>
  </div>`;
  const refs = Array.isArray(group.taskRefs) ? group.taskRefs : [];
  const selected = new Set(refs.map(String));
  const phaseObj = phases.find((p) => p.id === group.phaseRef) || null;

  return `<section class="ov1b-group-board">
    <header class="ov1b-board-head">
      <div>
        <strong>${escapeHtml(group.name || "未命名任务组")}</strong>
        <small>${refs.length} 项任务 · ${phaseObj ? `阶段时窗：${escapeHtml(phaseObj.timeWindow || "待定")}` : "可调整组内顺序与步骤模式"}</small>
      </div>
      <div class="ov1b-board-head-actions" style="display:flex; align-items:center; gap:8px;">
        <button type="button" class="quiet-button compact" data-action="toggle-ov1b-edit">${editOpen ? "收起编辑" : "编辑任务组"}</button>
        <button type="button" class="quiet-button compact danger" data-action="ov1b-remove-group" data-group-id="${escapeHtml(group.id)}" title="删除当前任务组">删除组</button>
        <span class="ov1b-status status-${escapeHtml(group.status || "pending_review")}">${escapeHtml(STATUS_LABELS[group.status] || group.status || "待复核")}</span>
      </div>
    </header>
    <div class="ov1b-board-content${editOpen ? " is-edit-open" : ""}">
      <section class="ov1b-organization-canvas">
        <header>
          <div>
            <strong>任务组织画布 · 红蓝对弈推演</strong>
            <small>同方步骤流顺序衔接 · 跨方因果对抗触发 · 点击模式按钮切换串/并行</small>
          </div>
          <div class="ov1b-canvas-zoom">
            <button type="button" data-ov1b-zoom="out" title="缩小" aria-label="缩小">−</button>
            <output data-ov1b-zoom-label>100%</output>
            <button type="button" data-ov1b-zoom="in" title="放大" aria-label="放大">＋</button>
            <button type="button" data-ov1b-zoom="fit" title="适配画布" aria-label="适配画布">⌖</button>
          </div>
        </header>
        ${renderOrganizationCanvas(group, refs, taskById, phaseObj)}
      </section>
      ${editOpen ? `<aside class="ov1b-edit-dock"><section class="ov1b-task-picker"><header><strong>现有任务</strong><small>${tasks.length} 项</small></header><div>${tasks.map((task) => `<label class="ov1b-task-option"><input type="checkbox" data-action="ov1b-toggle-task" data-group-id="${escapeHtml(group.id)}" value="${escapeHtml(task.id)}" ${selected.has(String(task.id)) ? "checked" : ""}><span><strong>${escapeHtml(task.name || task.id)}</strong><small>${escapeHtml(task.missionType || "未分类")} · ${task.side === "hostile" ? "红方" : "蓝方"}</small></span></label>`).join("") || `<p class="ov1b-side-empty">“作战任务”步骤暂无可整理任务。</p>`}</div></section>${stateCoordinationEditor(group)}</aside>` : ""}
    </div>
  </section>`;
}

function stateCoordinationEditor(group) {
  return `<div class="ov1b-properties-dock">
    <header style="display:flex; justify-content:space-between; align-items:center;">
      <strong>任务组属性</strong>
      <button type="button" class="quiet-button compact danger" data-action="ov1b-remove-group" data-group-id="${escapeHtml(group.id)}" title="删除此任务组">删除组</button>
    </header>
    <label><span>组名</span><input data-dodaf-field="ov1b.taskGroup.${escapeHtml(group.id)}.name" value="${escapeHtml(group.name || "")}"></label>
    <label><span>整理维度</span><select data-dodaf-field="ov1b.taskGroup.${escapeHtml(group.id)}.dimension">${Object.entries(DIMENSION_LABELS).map(([value, label]) => `<option value="${value}" ${group.dimension === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
    <label><span>阶段关联</span><input data-dodaf-field="ov1b.taskGroup.${escapeHtml(group.id)}.phaseRef" value="${escapeHtml(group.phaseRef || "")}" placeholder="可选：对齐阶段 ID，如 phase-1"></label>
    <label><span>整理依据</span><textarea data-dodaf-field="ov1b.taskGroup.${escapeHtml(group.id)}.rationale" placeholder="说明任务组的整理依据">${escapeHtml(group.rationale || "")}</textarea></label>
  </div>
  <div class="ov1b-coordination-dock" data-ov1b-coordination-editor>
    <header><strong>协同说明</strong><small>描述任务组内衔接与跨组协同关系</small></header>
    <textarea data-dodaf-field="ov1b.taskGroup.${escapeHtml(group.id)}.coordination" placeholder="说明组内衔接或跨组协同关系">${escapeHtml(group.coordination || "")}</textarea>
  </div>`;
}

function renderOrganizationCanvas(group, refs, taskById, phaseObj = null) {
  if (!refs.length) {
    return `<div class="ov1b-canvas-viewport is-empty" data-task-group-id="${escapeHtml(group.id)}">
      <div class="ov1b-canvas-stage"><p>从右侧勾选现有任务，任务节点将在看板中展开。</p></div>
    </div>`;
  }

  const steps = Array.isArray(group.steps) && group.steps.length
    ? group.steps
    : [{ stepIndex: 1, name: "默认步骤", mode: "sequential", taskRefs: refs, dependsOn: [] }];

  // 按推演方（阵营）区分任务
  const blueSteps = [];
  const redSteps = [];

  for (const step of steps) {
    const bRefs = (step.taskRefs || []).filter((r) => taskById.get(String(r))?.side !== "hostile");
    const rRefs = (step.taskRefs || []).filter((r) => taskById.get(String(r))?.side === "hostile");
    if (bRefs.length) {
      blueSteps.push({ ...step, taskRefs: bRefs });
    }
    if (rRefs.length) {
      redSteps.push({ ...step, taskRefs: rRefs });
    }
  }

  return `<div class="ov1b-canvas-viewport ov1b-wargame-viewport" data-task-group-id="${escapeHtml(group.id)}">
    <div class="ov1b-canvas-stage ov1b-wargame-stage" style="--task-count:${Math.max(1, refs.length)}">
      
      <!-- 任务组对弈主横幅（保留 ov1b-group-node 契约类名） -->
      <article class="ov1b-group-node ov1b-wargame-banner">
        <div class="ov1b-banner-badge">
          <span class="ov1b-banner-tag">${escapeHtml(DIMENSION_LABELS[group.dimension] || group.dimension || "任务编组")}</span>
          ${group.phaseRef ? `<span class="ov1b-banner-phase">关联阶段: ${escapeHtml(group.phaseRef)}</span>` : ""}
        </div>
        <strong class="ov1b-banner-title">${escapeHtml(group.name || "未命名任务组")}</strong>
        <p class="ov1b-banner-desc">${escapeHtml(group.rationale || (phaseObj ? `阶段目标：${phaseObj.objective || "无"}` : "多推演方协同编排"))}</p>
        <div class="ov1b-banner-meta">
          <span class="meta-pill blue-pill">蓝方任务: ${refs.filter((r) => taskById.get(String(r))?.side !== "hostile").length} 项</span>
          <span class="meta-pill red-pill">红方对抗: ${refs.filter((r) => taskById.get(String(r))?.side === "hostile").length} 项</span>
          <span class="meta-pill">${steps.length} 个执行步骤</span>
        </div>
      </article>

      <!-- 双轨推演对弈工作流 -->
      <div class="ov1b-dual-track-workspace ov1b-pipeline-flow">
        
        <!-- 蓝方推演流 -->
        <section class="ov1b-track-lane lane-blue">
          <header class="ov1b-lane-header">
            <div class="ov1b-lane-title">
              <span class="lane-icon">🔵</span>
              <strong>蓝方推演流 (Blue Force Mission Stream)</strong>
              <small>本方制空/反导/打击战法执行链条</small>
            </div>
            <span class="lane-count-tag">${refs.filter((r) => taskById.get(String(r))?.side !== "hostile").length} 项任务</span>
          </header>
          <div class="ov1b-lane-steps">
            ${blueSteps.length
              ? blueSteps.map((step, idx) => {
                const pod = renderStepCardStream(group.id, step, idx, blueSteps.length, taskById, "blue");
                const connector = idx < blueSteps.length - 1
                  ? `<div class="ov1b-step-flow-connector" aria-hidden="true"><span class="flow-connector-line"></span><span class="flow-connector-badge mode-${escapeHtml(step.mode || "sequential")}">${step.mode === "parallel" ? "⇶ 并行" : step.mode === "trigger" ? "⚡ 触发" : "➜ 串行"}</span><span class="flow-connector-line"></span></div>`
                  : "";
                return pod + connector;
              }).join("")
              : `<div class="ov1b-lane-empty">本组暂无蓝方任务，由红方单向施压或待分配</div>`}
          </div>
        </section>

        <!-- 红蓝对抗因果交互轴 -->
        <div class="ov1b-confrontation-divider" aria-hidden="true">
          <div class="confrontation-line"></div>
          <span class="confrontation-badge">⚡ 红蓝对弈博弈交互 · 因果触发响应</span>
          <div class="confrontation-line"></div>
        </div>

        <!-- 红方反制流 -->
        <section class="ov1b-track-lane lane-red">
          <header class="ov1b-lane-header">
            <div class="ov1b-lane-title">
              <span class="lane-icon">🔴</span>
              <strong>红方对抗流 (Red Force Counter-Stream)</strong>
              <small>对手突防/电磁干扰/多轴反制对抗链条</small>
            </div>
            <span class="lane-count-tag">${refs.filter((r) => taskById.get(String(r))?.side === "hostile").length} 项任务</span>
          </header>
          <div class="ov1b-lane-steps">
            ${redSteps.length
              ? redSteps.map((step, idx) => {
                const pod = renderStepCardStream(group.id, step, idx, redSteps.length, taskById, "red");
                const connector = idx < redSteps.length - 1
                  ? `<div class="ov1b-step-flow-connector" aria-hidden="true"><span class="flow-connector-line"></span><span class="flow-connector-badge mode-${escapeHtml(step.mode || "sequential")}">${step.mode === "parallel" ? "⇶ 并行" : step.mode === "trigger" ? "⚡ 触发" : "➜ 串行"}</span><span class="flow-connector-line"></span></div>`
                  : "";
                return pod + connector;
              }).join("")
              : `<div class="ov1b-lane-empty">本组暂无红方对抗任务（蓝方单边行动阶段）</div>`}
          </div>
        </section>

      </div>
    </div>
  </div>`;
}

function renderStepCardStream(groupId, step, stepIndex, totalSteps, taskById, side) {
  const stepTasks = Array.isArray(step.taskRefs) ? step.taskRefs : [];
  const depNames = (step.dependsOn || []).map((id) => taskById.get(String(id))?.name || id).filter(Boolean);

  return `<div class="ov1b-step-pod ov1b-pipeline-step step-side-${side} mode-${escapeHtml(step.mode || "sequential")}">
    <header class="ov1b-pod-header">
      <div class="ov1b-pod-title">
        <span class="pod-step-badge">Step ${step.stepIndex}</span>
        <strong>${escapeHtml(step.name || `步骤 ${step.stepIndex}`)}</strong>
      </div>
      <div class="ov1b-pod-mode-pills ov1b-step-mode-switch" role="radiogroup" aria-label="执行模式切换">
        <button type="button" class="mode-pill ${step.mode === "parallel" ? "is-active" : ""}" data-action="ov1b-set-step-mode" data-group-id="${escapeHtml(groupId)}" data-step-index="${step.stepIndex}" data-mode="parallel" title="步骤内并行执行">并</button>
        <button type="button" class="mode-pill ${step.mode === "sequential" || !step.mode ? "is-active" : ""}" data-action="ov1b-set-step-mode" data-group-id="${escapeHtml(groupId)}" data-step-index="${step.stepIndex}" data-mode="sequential" title="步骤内串行执行">串</button>
        <button type="button" class="mode-pill ${step.mode === "trigger" ? "is-active" : ""}" data-action="ov1b-set-step-mode" data-group-id="${escapeHtml(groupId)}" data-step-index="${step.stepIndex}" data-mode="trigger" title="触发依赖执行">触</button>
      </div>
    </header>

    ${depNames.length ? `<div class="ov1b-pod-dep-tag"><small>↳ 前置因果：${escapeHtml(depNames.join("、"))}</small></div>` : ""}

    <div class="ov1b-pod-task-cards">
      ${stepTasks.map((ref, idx) => renderModernTaskCard(groupId, ref, idx, stepTasks.length, taskById, step, totalSteps)).join("")}
    </div>
  </div>`;
}

function renderModernTaskCard(groupId, ref, index, totalInStep, taskById, step = {}, totalSteps = 1) {
  const task = taskById.get(String(ref));
  const hasMultipleSteps = Number(totalSteps) > 1;
  const currentStepIdx = Number(step.stepIndex || 1);
  const isRed = task?.side === "hostile";

  return `<article class="ov1b-canvas-task-node ov1b-modern-card ${isRed ? "card-red" : "card-blue"} ${task ? "" : "is-missing"}">
    <div class="ov1b-card-top">
      <span class="ov1b-card-num">${String(index + 1).padStart(2, "0")}</span>
      <span class="ov1b-card-type-tag">${escapeHtml(task?.missionType || "通用")}</span>
      <span class="ov1b-card-side-tag">${isRed ? "红方对抗" : "蓝方战法"}</span>
    </div>
    <strong class="ov1b-card-name" title="${escapeHtml(task?.name || ref)}">${escapeHtml(task?.name || ref)}</strong>
    <p class="ov1b-card-obj">${escapeHtml(task?.objective || task?.expectedEffect || "承接作战任务")}</p>
    <div class="ov1b-node-actions ov1b-card-actions">
      <button type="button" class="quiet-button compact ov1b-btn-reorder" data-action="ov1b-move-task" data-group-id="${escapeHtml(groupId)}" data-task-id="${escapeHtml(ref)}" data-delta="-1" ${index === 0 ? "disabled" : ""} title="在当前步骤内上移">↑</button>
      <button type="button" class="quiet-button compact ov1b-btn-reorder" data-action="ov1b-move-task" data-group-id="${escapeHtml(groupId)}" data-task-id="${escapeHtml(ref)}" data-delta="1" ${index === totalInStep - 1 ? "disabled" : ""} title="在当前步骤内下移">↓</button>
      ${hasMultipleSteps ? `<button type="button" class="quiet-button compact ov1b-btn-step" data-action="ov1b-step-task" data-group-id="${escapeHtml(groupId)}" data-task-id="${escapeHtml(ref)}" data-delta="-1" ${currentStepIdx <= 1 ? "disabled" : ""} title="移至上一步骤 (Step ${currentStepIdx - 1})"><span class="step-btn-arrow">◂</span><span class="step-btn-label">步</span></button><button type="button" class="quiet-button compact ov1b-btn-step" data-action="ov1b-step-task" data-group-id="${escapeHtml(groupId)}" data-task-id="${escapeHtml(ref)}" data-delta="1" ${currentStepIdx >= totalSteps ? "disabled" : ""} title="移至下一步骤 (Step ${currentStepIdx + 1})"><span class="step-btn-label">步</span><span class="step-btn-arrow">▸</span></button>` : ""}
    </div>
  </article>`;
}

function resolveSelectedGroupId(state, groups) {
  const current = String(state.ov1bSelectedGroupId || "");
  return groups.some((group) => group.id === current) ? current : groups[0]?.id || "";
}
