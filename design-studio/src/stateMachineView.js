/**
 * 状态机校验（ov6b）：多机列表 + UML/流程图式状态画布 + 转换编辑。
 * 一任务/对象一机；界面不使用 OV-1 文本框样式，不强调 OV 品牌。
 */
import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderProjectStorageActions } from "./projectStorageView.js";
import {
  computeOv1WorldBounds,
  logicalToWorldCss,
  ov1WorldCssSize
} from "./ov1Canvas.js";
import {
  diagnoseOv6bMachineLocal,
  layoutOv6bStatesForCanvas,
  listStateMachineSubjects,
  resolveOv6bSelectedMachineId
} from "./ov6Workbench.js";
import { routeSmFlowEdges } from "./stateMachineFlowRouting.js";
import { renderResearchChatPanel } from "./researchChat/index.js";
import { renderToolboxFloatButton, renderToolboxRail } from "./toolbox/index.js";

const SUBJECT_LABELS = Object.freeze({
  task: "任务",
  object: "对象",
  force: "兵力",
  phase: "阶段",
  other: "其他"
});
const SUBJECT_MACHINE_LABELS = Object.freeze({
  task: "任务机",
  object: "对象机",
  force: "兵力机",
  phase: "阶段机",
  other: "其他"
});

const KIND_LABELS = Object.freeze({
  initial: "开始",
  normal: "中间",
  decision: "判定",
  final: "结束"
});

export function renderStateMachineWorkbench(state = {}) {
  const resolved = resolveDodafProduct(state, "ov6b");
  const model = resolved.model || { stateMachines: [] };
  const storage = state.ov6bStorage || null;
  const machines = Array.isArray(model.stateMachines) ? model.stateMachines : [];
  const subjects = listStateMachineSubjects(state);
  const selectedId = resolveOv6bSelectedMachineId(state, machines);
  const selected = machines.find((item) => item.id === selectedId) || null;
  const selectedStateId = String(state.ov6bSelectedStateId || "");
  const toolsOpen = state.ov6bToolsOpen === true;
  const editorOpen = Boolean(state.ov6bEditorOpen);
  const chatOpen = Boolean(state.stateMachineChatOpen);
  const chatGenerating = Boolean(state.stateMachineChatGenerating || state.stateMachinePregenerating);
  const totalStates = machines.reduce((sum, item) => sum + (item.states?.length || 0), 0);
  const totalTransitions = machines.reduce((sum, item) => sum + (item.transitions?.length || 0), 0);
  const reviewCount = machines.filter((item) => !diagnoseOv6bMachineLocal(item).ok).length;

  return `<section class="sm-page" data-view-page="state-machine" data-dodaf-product="OV-6b">
    <header class="sm-top">
      <div class="sm-bar">
        <div class="sm-identity">
          <h2>状态机校验</h2>
          <small class="sm-summary">${resolved.source === "persisted" ? "已持久化" : "本地/种子"} · v${model.version || 2} · ${machines.length} 台 · ${totalStates} 状态 · ${totalTransitions} 转换${reviewCount ? ` · <span class="is-review">${reviewCount} 台待复核</span>` : ""}</small>
        </div>
        <div class="sm-toolbar">
          ${storage ? renderProjectStorageActions(storage, { refreshAction: "refresh-project-ov6b" }) : ""}
          <button type="button" class="primary-btn" data-action="save-dodaf-ov6b">保存</button>
          <button type="button" class="quiet-button" data-view="ov6c">下一步</button>
        </div>
      </div>
    </header>

    ${machines.length
    ? `<div class="sm-workbench ${toolsOpen ? "is-tools-docked" : "is-tools-floating"} ${editorOpen ? "is-editor-open" : ""} ${chatOpen ? "is-chat-open" : ""}" aria-label="状态机研究台">
        <aside class="sm-list-panel" aria-label="状态机列表">
          <header class="sm-panel-head">
            <strong>状态机</strong>
            <small>${machines.length} 台 · 一任务/对象一机</small>
          </header>
          <div class="sm-machine-list" role="listbox" aria-label="状态机">
            ${machines.map((machine) => renderMachineListItem(machine, selectedId)).join("")}
          </div>
          <div class="sm-list-footer">
            <label class="sm-subject-picker">
              <span>建模对象</span>
              <select id="ov6bSubjectPicker">
                ${subjects.length
    ? subjects.map((item) => `<option value="${escapeHtml(item.id)}" data-subject-type="${escapeHtml(item.subjectType)}">${escapeHtml(item.name)}（${escapeHtml(SUBJECT_MACHINE_LABELS[item.subjectType] || SUBJECT_LABELS[item.subjectType] || item.subjectType)}）</option>`).join("")
    : `<option value="">自定义主体</option>`}
              </select>
            </label>
            <div class="sm-list-actions">
              <button type="button" class="quiet-button sm-seed-action" data-action="ov6b-seed-subjects" title="为尚未建机的阶段行动、关键任务或持续对象建机">识别建模对象</button>
              <button type="button" class="quiet-button" data-action="ov6b-add-machine" data-subject-type="phase">阶段机</button>
              <button type="button" class="quiet-button" data-action="ov6b-add-machine" data-subject-type="task">任务机</button>
              <button type="button" class="quiet-button" data-action="ov6b-add-machine" data-subject-type="force">兵力机</button>
              <button type="button" class="quiet-button" data-action="ov6b-add-machine" data-subject-type="object">对象机</button>
            </div>
          </div>
        </aside>

        <div class="sm-main-panel">
          ${selected
    ? renderMachineEditor(selected, {
      selectedStateId,
      selectedTransitionId: String(state.ov6bSelectedTransitionId || ""),
      subjects
    })
    : `<div class="sm-empty-editor"><p>请选择左侧状态机</p></div>`}
        </div>
        ${renderMachinePropertyDock(selected, {
          selectedStateId,
          selectedTransitionId: String(state.ov6bSelectedTransitionId || ""),
          editorOpen,
          subjects
        })}
        ${renderStateMachineChatDock(state, { chatOpen, chatGenerating, model })}
        ${toolsOpen ? renderStateMachineToolboxRail({ editorOpen, chatOpen, chatGenerating, machineId: selectedId }) : ""}
      </div>`
    : renderEmptyWorkbench(subjects, { toolsOpen, chatOpen, chatGenerating, chat: state.stateMachineChat, model })}
  </section>`;
}

/** Compatibility entry used by dodafOperationalViews / acceptance scripts. */
export function renderOv6bPage(stateOrModel) {
  if (stateOrModel && !stateOrModel.activeView && (stateOrModel.stateMachines || stateOrModel.product === "OV-6b" || stateOrModel.states)) {
    return renderStateMachineWorkbench({
      activeView: "ov6b",
      ov6b: stateOrModel,
      ov6bStorage: {},
      phaseAction: stateOrModel.phaseAction,
      forceMission: stateOrModel.forceMission
    });
  }
  return renderStateMachineWorkbench(stateOrModel || {});
}

function renderMachineListItem(machine, selectedId) {
  const selected = machine.id === selectedId;
  const diag = diagnoseOv6bMachineLocal(machine);
  const typeLabel = SUBJECT_MACHINE_LABELS[machine.subjectType] || SUBJECT_LABELS[machine.subjectType] || machine.subjectType || "其他";
  return `<button type="button" class="sm-machine-item ${selected ? "is-selected" : ""} ${diag.ok ? "is-ready" : "is-review"}" role="option" aria-selected="${selected ? "true" : "false"}" data-action="ov6b-select-machine" data-machine-id="${escapeHtml(machine.id)}">
    <span class="sm-machine-item-main">
      <strong>${escapeHtml(machine.name || machine.id)}</strong>
      <small>${escapeHtml(typeLabel)}${machine.subjectRef ? ` · ${escapeHtml(machine.subjectRef)}` : ""}</small>
    </span>
    <span class="sm-machine-item-meta">
      <span class="mini-tag ${diag.ok ? "ready" : "review"}">${escapeHtml(diag.statusLabel)}</span>
      <small>${(machine.states || []).length} 态 · ${(machine.transitions || []).length} 转</small>
    </span>
  </button>`;
}

function renderMachineEditor(machine, { selectedStateId = "", subjects = [], selectedTransitionId = "" } = {}) {
  const diag = diagnoseOv6bMachineLocal(machine);

  return `<article class="sm-editor" data-machine-id="${escapeHtml(machine.id)}" aria-label="状态机编辑">
    <header class="sm-editor-head">
      <div class="sm-editor-title">
        <strong>${escapeHtml(machine.name || "未命名状态机")}</strong>
        <span class="mini-tag ${diag.ok ? "ready" : "review"}">${escapeHtml(diag.statusLabel)}</span>
        <small>${diag.ok ? escapeHtml(diag.detail) : `${diag.findings.length} 项待处理`}</small>
      </div>
    </header>

    ${diag.findings.length ? `<nav class="sm-diagnostic-strip" aria-label="状态机诊断">
      ${diag.findings.slice(0, 8).map((finding) => `<button type="button" class="sm-diagnostic-item" data-action="ov6b-focus-finding" data-machine-id="${escapeHtml(machine.id)}" ${finding.stateId ? `data-state-id="${escapeHtml(finding.stateId)}"` : ""} ${finding.transitionId ? `data-transition-id="${escapeHtml(finding.transitionId)}"` : ""} title="定位并修改">${escapeHtml(finding.message)}</button>`).join("")}
      ${diag.findings.length > 8 ? `<span class="sm-diagnostic-more">另有 ${diag.findings.length - 8} 项</span>` : ""}
    </nav>` : ""}

    <section class="sm-canvas-panel" aria-label="状态绘画面板">
      <header class="sm-canvas-head">
        <div>
          <strong>状态流程图</strong>
          <small>从工具栏拖入节点 · 端口或转换工具拉线 · 空白平移 · 滚轮缩放</small>
        </div>
        <div class="sm-legend" aria-hidden="true">
          <span class="sm-legend-item kind-initial">开始</span>
          <span class="sm-legend-item kind-normal">状态</span>
          <span class="sm-legend-item kind-decision">判定</span>
          <span class="sm-legend-item kind-final">结束</span>
        </div>
        <button type="button" class="sm-canvas-fit" data-sm-canvas-fit title="回到全局视图" aria-label="回到全局视图">⌖</button>
      </header>
      <div class="sm-canvas-frame">
        ${renderStateMachineFlowCanvas(machine, { selectedStateId, selectedTransitionId })}
      </div>
    </section>
  </article>`;
}

function renderMachinePropertyDock(machine, { selectedStateId = "", selectedTransitionId = "", editorOpen = false, subjects = [] } = {}) {
  if (!machine || !editorOpen) {
    return `<aside class="sm-editor-dock is-collapsed" id="stateMachineEditorDock" aria-hidden="true" aria-label="状态与转换"></aside>`;
  }
  const states = Array.isArray(machine.states) ? machine.states : [];
  const transitions = Array.isArray(machine.transitions) ? machine.transitions : [];
  const focusState = states.find((item) => item.id === selectedStateId) || null;
  const focusTransition = transitions.find((item) => item.id === selectedTransitionId) || null;
  const hint = focusTransition ? "已选转换" : focusState ? "已选节点" : "点图中节点或连线";
  return `<aside class="sm-editor-dock is-open" id="stateMachineEditorDock" aria-hidden="false" aria-label="状态与转换">
    <header class="sm-editor-dock-head">
      <div>
        <strong>状态 / 转换</strong>
        <small>${escapeHtml(hint)}</small>
      </div>
      <button type="button" class="sm-editor-dock-close" data-action="ov6b-close-editor" title="收起属性" aria-label="收起属性">
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
          <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>
    </header>
    ${renderMachineMetaFields(machine, subjects)}
    <div class="sm-editor-lower">
      <section class="sm-state-props" aria-label="状态属性">
        <header class="sm-panel-head">
          <strong>状态</strong>
          <small>${states.length} 个</small>
        </header>
        <div class="sm-state-list">
          ${states.length
    ? states.map((state) => {
      const active = state.id === selectedStateId;
      return `<div class="sm-state-row ${active ? "is-selected" : ""} kind-${escapeHtml(state.kind || "normal")}" data-state-id="${escapeHtml(state.id)}">
              <button type="button" class="sm-state-pick" data-action="ov6b-select-state" data-machine-id="${escapeHtml(machine.id)}" data-state-id="${escapeHtml(state.id)}" title="在图中高亮">
                <span class="sm-state-kind">${escapeHtml(KIND_LABELS[state.kind] || state.kind || "中间")}</span>
              </button>
              <input class="sm-state-name" data-action="ov6b-state-field" data-machine-id="${escapeHtml(machine.id)}" data-state-id="${escapeHtml(state.id)}" data-field="name" value="${escapeHtml(state.name || "")}" />
              <select data-action="ov6b-state-field" data-machine-id="${escapeHtml(machine.id)}" data-state-id="${escapeHtml(state.id)}" data-field="kind">
                ${["initial", "normal", "decision", "final"].map((kind) => `<option value="${kind}" ${state.kind === kind ? "selected" : ""}>${escapeHtml(KIND_LABELS[kind])}</option>`).join("")}
              </select>
              ${state.kind === "decision" ? `<input class="sm-decision-expression" data-action="ov6b-state-field" data-machine-id="${escapeHtml(machine.id)}" data-state-id="${escapeHtml(state.id)}" data-field="decisionExpression" value="${escapeHtml(state.decisionExpression || "")}" placeholder="判定表达式" />` : ""}
              <button type="button" class="quiet-button danger-quiet compact" data-action="ov6b-remove-state" data-machine-id="${escapeHtml(machine.id)}" data-state-id="${escapeHtml(state.id)}" title="删除状态">删</button>
              ${state.kind === "decision" ? renderDecisionBranchComposer(machine, state) : ""}
            </div>`;
    }).join("")
    : `<p class="sm-muted">尚无状态</p>`}
        </div>
      </section>

      <section class="sm-transition-panel" aria-label="转换条件">
        <header class="sm-panel-head">
          <strong>转换</strong>
          <small>${transitions.length} 条</small>
        </header>
        <div class="sm-transition-list">
          ${transitions.length
    ? transitions.map((item) => {
      const sourceState = states.find((state) => state.id === item.fromStateRef);
      const fromOptions = states.map((state) => `<option value="${escapeHtml(state.id)}" ${state.id === item.fromStateRef ? "selected" : ""}>${escapeHtml(state.name || state.id)}</option>`).join("");
      const toOptions = states.map((state) => `<option value="${escapeHtml(state.id)}" ${state.id === item.toStateRef ? "selected" : ""}>${escapeHtml(state.name || state.id)}</option>`).join("");
      return `<article class="sm-transition-row ${item.id === selectedTransitionId ? "is-selected" : ""}" data-transition-id="${escapeHtml(item.id)}">
              <div class="sm-transition-ends">
                <label><span>从</span><select data-action="ov6b-transition-field" data-machine-id="${escapeHtml(machine.id)}" data-transition-id="${escapeHtml(item.id)}" data-field="fromStateRef">${fromOptions}</select></label>
                <span class="sm-transition-arrow" aria-hidden="true">→</span>
                <label><span>到</span><select data-action="ov6b-transition-field" data-machine-id="${escapeHtml(machine.id)}" data-transition-id="${escapeHtml(item.id)}" data-field="toStateRef">${toOptions}</select></label>
              </div>
              <label class="sm-field sm-transition-condition">
                <span>条件</span>
                <input data-dodaf-field="ov6b.transition.${escapeHtml(item.id)}.condition" value="${escapeHtml(item.condition || "")}" placeholder="可观察转换条件" />
              </label>
              ${sourceState?.kind === "decision" ? `<label class="sm-field sm-transition-result"><span>分支</span><input data-action="ov6b-transition-field" data-machine-id="${escapeHtml(machine.id)}" data-transition-id="${escapeHtml(item.id)}" data-field="branchResult" value="${escapeHtml(item.branchResult || "")}" placeholder="满足 / 不满足" /></label>` : ""}
              <button type="button" class="quiet-button danger-quiet compact" data-action="ov6b-remove-transition" data-machine-id="${escapeHtml(machine.id)}" data-transition-id="${escapeHtml(item.id)}">删</button>
            </article>`;
    }).join("")
    : `<p class="sm-muted">尚无转换。点「加转换」连接状态。</p>`}
        </div>
      </section>
    </div>
  </aside>`;
}

function renderMachineMetaFields(machine, subjects = []) {
  return `<div class="sm-meta-grid">
      <label class="sm-field">
        <span>名称</span>
        <input data-action="ov6b-machine-field" data-machine-id="${escapeHtml(machine.id)}" data-field="name" value="${escapeHtml(machine.name || "")}" />
      </label>
      <label class="sm-field">
        <span>主体类型</span>
        <select data-action="ov6b-machine-field" data-machine-id="${escapeHtml(machine.id)}" data-field="subjectType">
          ${["phase", "task", "object", "force", "other"].map((type) => `<option value="${type}" ${machine.subjectType === type ? "selected" : ""}>${escapeHtml(SUBJECT_MACHINE_LABELS[type] || SUBJECT_LABELS[type] || type)}</option>`).join("")}
        </select>
      </label>
      <label class="sm-field">
        <span>主体引用</span>
        <input list="ov6b-subject-refs" data-action="ov6b-machine-field" data-machine-id="${escapeHtml(machine.id)}" data-field="subjectRef" value="${escapeHtml(machine.subjectRef || "")}" placeholder="阶段行动/任务/兵力/对象 id" />
        <datalist id="ov6b-subject-refs">${subjects.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}</datalist>
      </label>
    </div>`;
}

function renderDecisionBranchComposer(machine, decision) {
  const states = Array.isArray(machine.states) ? machine.states : [];
  const outgoing = (machine.transitions || []).filter((item) => item.fromStateRef === decision.id);
  const targetOptions = states
    .filter((state) => state.id !== decision.id)
    .map((state) => `<option value="${escapeHtml(state.id)}">${escapeHtml(state.name || state.id)}</option>`)
    .join("");
  const suggestedResult = outgoing.some((item) => String(item.branchResult || "").trim() === "满足") ? "不满足" : "满足";
  return `<div class="sm-decision-branch" aria-label="添加判定分支">
    <select data-branch-field="target" aria-label="分支目标" ${targetOptions ? "" : "disabled"}>${targetOptions || `<option value="">没有可用目标</option>`}</select>
    <input data-branch-field="result" value="${escapeHtml(suggestedResult)}" placeholder="分支结果" aria-label="分支结果" />
    <input data-branch-field="condition" placeholder="可观察条件" aria-label="分支条件" />
    <button type="button" class="quiet-button compact" data-action="ov6b-add-decision-branch" data-machine-id="${escapeHtml(machine.id)}" data-state-id="${escapeHtml(decision.id)}" ${targetOptions ? "" : "disabled"}>添加分支</button>
  </div>`;
}

/**
 * UML / flowchart-style state board.
 * Keeps stage/world/port hooks so stateMachineCanvasController can pan/zoom/drag/link.
 */
function renderStateMachineFlowCanvas(machine, { selectedStateId = "", selectedTransitionId = "" } = {}) {
  const prepared = prepareStateMachineCanvas(machine);
  const nodes = prepared.states.map((state) => ({
    id: state.id,
    label: state.name || state.id,
    decisionExpression: state.decisionExpression || "",
    stateKind: state.kind || "normal",
    x: state.x,
    y: state.y
  }));
  if (!nodes.length) {
    return `<figure class="sm-flow-canvas sm-ov1-canvas is-empty" data-sm-canvas data-machine-id="${escapeHtml(machine.id)}" aria-label="${escapeHtml(machine.name || "状态机")} 空画布">
    <div class="sm-flow-stage" data-ov1-stage title="从右侧工具栏拖入节点">
      <div class="sm-flow-world" data-ov1-world style="width:100%;height:100%;" data-world-min-x="0" data-world-min-y="0" data-world-width="100" data-world-height="100">
        <p class="sm-canvas-empty">尚无状态节点。从右侧工具栏拖入中间态或判定框。</p>
      </div>
    </div>
  </figure>`;
  }

  const stateById = new Map(nodes.map((node) => [node.id, node]));
  const edges = prepared.transitions.map((item) => ({
    id: item.id,
    sourceId: item.fromStateRef,
    targetId: item.toStateRef,
    type: "stateTransition",
    label: String(item.branchResult || item.condition || "").trim() || "转换",
    branchResult: String(item.branchResult || "").trim(),
    condition: String(item.condition || "").trim(),
    isDecisionBranch: stateById.get(item.fromStateRef)?.stateKind === "decision"
  }));

  const bounds = computeOv1WorldBounds(nodes);
  const { widthPct: baseWorldWidth, heightPct: baseWorldHeight } = ov1WorldCssSize(nodes);
  const worldWidth = Math.max(baseWorldWidth, nodes.length * 20);
  const worldHeight = Math.max(baseWorldHeight, 112);
  // Flowchart nodes are center-positioned (left/top + translate -50%).
  const centers = new Map(nodes.map((node) => {
    const box = stateNodeCenterBox(node, bounds);
    return [node.id, { id: node.id, ...box }];
  }));
  const edgeGeometryById = routeSmFlowEdges(edges, centers);
  return `<figure class="sm-flow-canvas sm-ov1-canvas" data-sm-canvas data-machine-id="${escapeHtml(machine.id)}" aria-label="${escapeHtml(machine.name || "状态机")} ${nodes.length} 状态 · ${edges.length} 转换">
    <div class="sm-flow-stage" data-ov1-stage title="空白处拖动平移；滚轮缩放；从端口拖出转换">
      <div class="sm-flow-world" data-ov1-world
        style="width:${worldWidth}%;height:${worldHeight}%;"
        data-world-min-x="${bounds.minX}" data-world-min-y="${bounds.minY}"
        data-world-width="${bounds.width}" data-world-height="${bounds.height}">
        <svg class="sm-flow-lines ov1-concept-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <marker id="sm-flow-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#64748b"></path>
            </marker>
            <marker id="sm-flow-arrow-selected" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#1d4ed8"></path>
            </marker>
          </defs>
          ${edges.map((edge) => renderSmEdge(edge, edgeGeometryById.get(edge.id), selectedTransitionId)).join("")}
        </svg>
        <div class="sm-flow-edge-label-layer">${edges.map((edge) => renderSmEdgeLabel(edge, edgeGeometryById.get(edge.id), selectedTransitionId)).join("")}</div>
        ${nodes.map((node) => {
          const id = escapeHtml(node.id);
          const cssPos = logicalToWorldCss(node.x, node.y, bounds);
          const selected = selectedStateId === node.id ? " is-selected" : "";
          const kind = node.stateKind || "normal";
          return `<div class="sm-flow-node-wrap kind-${escapeHtml(kind)}${selected}" data-ov1-node="${id}" data-logical-x="${escapeHtml(String(node.x))}" data-logical-y="${escapeHtml(String(node.y))}" style="left:${escapeHtml(cssPos.left)};top:${escapeHtml(cssPos.top)}">
            <button type="button" class="sm-flow-node kind-${escapeHtml(kind)}${selected}" data-ov1="${id}" title="${escapeHtml(node.label)}（${escapeHtml(KIND_LABELS[kind] || kind)}）">
              ${kind === "initial" || kind === "final"
    ? `<span class="sm-flow-glyph" aria-hidden="true"></span>
                <span class="sm-flow-node-caption">${escapeHtml(clip(node.label, 18))}</span>`
    : kind === "decision"
      ? `<span class="sm-flow-node-label">${escapeHtml(clip(node.decisionExpression || (/^\d+$/.test(node.label.trim()) ? "条件判定" : node.label), 12))}</span>`
      : `<span class="sm-flow-node-label">${escapeHtml(node.label)}</span>`}
            </button>
            <button type="button" class="sm-flow-port" data-ov1-port data-source-id="${id}" data-side="top" title="拖出转换" aria-label="从顶部拖出转换"></button>
            <button type="button" class="sm-flow-port" data-ov1-port data-source-id="${id}" data-side="right" title="拖出转换" aria-label="从右侧拖出转换"></button>
            <button type="button" class="sm-flow-port" data-ov1-port data-source-id="${id}" data-side="bottom" title="拖出转换" aria-label="从底部拖出转换"></button>
            <button type="button" class="sm-flow-port" data-ov1-port data-source-id="${id}" data-side="left" title="拖出转换" aria-label="从左侧拖出转换"></button>
          </div>`;
        }).join("")}
      </div>
    </div>
  </figure>`;
}

function prepareStateMachineCanvas(machine = {}) {
  const states = layoutOv6bStatesForCanvas(machine.states || []).map((item) => ({ ...item }));
  const transitions = (machine.transitions || []).map((item) => ({ ...item }));
  const stateById = new Map(states.map((item) => [item.id, item]));
  const hiddenBypassIds = new Set();

  states.filter((item) => item.kind === "decision").forEach((decision) => {
    const incoming = transitions.filter((item) => item.toStateRef === decision.id);
    const outgoing = transitions.filter((item) => item.fromStateRef === decision.id);
    incoming.forEach((before) => outgoing.forEach((after) => {
      transitions.forEach((candidate) => {
        if (candidate.fromStateRef === before.fromStateRef && candidate.toStateRef === after.toStateRef) {
          hiddenBypassIds.add(candidate.id);
        }
      });
    }));
  });

  const visibleTransitions = transitions.filter((item) => !hiddenBypassIds.has(item.id));
  if (machine.canvasLayout !== "manual") {
    layoutStateMachineTopology(states, visibleTransitions, stateById);
  }

  return { states, transitions: visibleTransitions };
}

function layoutStateMachineTopology(states, transitions, stateById) {
  if (!states.length) return;
  const start = states.find((item) => item.kind === "initial") || states[0];
  const rankById = new Map([[start.id, 0]]);
  const queue = [start.id];
  while (queue.length) {
    const sourceId = queue.shift();
    const nextRank = (rankById.get(sourceId) || 0) + 1;
    transitions
      .filter((edge) => edge.fromStateRef === sourceId && edge.toStateRef !== start.id)
      .forEach((edge) => {
        if (rankById.has(edge.toStateRef)) return;
        rankById.set(edge.toStateRef, nextRank);
        queue.push(edge.toStateRef);
      });
  }
  let fallbackRank = Math.max(0, ...rankById.values()) + 1;
  states.forEach((state) => {
    if (!rankById.has(state.id)) rankById.set(state.id, fallbackRank++);
  });

  const groups = new Map();
  states.forEach((state) => {
    const rank = rankById.get(state.id) || 0;
    if (!groups.has(rank)) groups.set(rank, []);
    groups.get(rank).push(state);
  });
  groups.forEach((group) => group.sort((left, right) => canvasKindWeight(left.kind) - canvasKindWeight(right.kind)));
  const maxRank = Math.max(1, ...groups.keys());
  groups.forEach((group, rank) => {
    const spacing = group.length > 3 ? 18 : 24;
    group.forEach((state, index) => {
      state.x = `${14 + (rank / maxRank) * 72}%`;
      state.y = `${50 + (index - (group.length - 1) / 2) * spacing}%`;
    });
  });
}

function canvasKindWeight(kind) {
  if (kind === "decision") return 0;
  if (kind === "normal") return 1;
  if (kind === "final") return 3;
  return 2;
}

/**
 * First-paint box for center-positioned flowchart nodes.
 * left/top from layout are treated as the visual center.
 */
function stateNodeCenterBox(node, bounds) {
  const css = logicalToWorldCss(node.x, node.y, bounds);
  const cx = Number.parseFloat(css.left);
  const cy = Number.parseFloat(css.top);
  const kind = node.stateKind || "normal";
  const worldWidth = Math.max(Number(bounds?.width) || 100, 1);
  const worldHeight = Math.max(Number(bounds?.height) || 100, 1);
  // Approximate served CSS sizes so first-paint edges meet the visible border.
  const pixel = kind === "normal"
    ? { w: 168, h: 64 }
    : kind === "decision"
      ? { w: 94, h: 94 }
      : { w: 34, h: 34 };
  return {
    center: {
      x: Number.isFinite(cx) ? cx : 50,
      y: Number.isFinite(cy) ? cy : 50
    },
    halfW: Math.max(1.2, (pixel.w / 2 / worldWidth) * 100),
    halfH: Math.max(1, (pixel.h / 2 / worldHeight) * 100),
    shape: kind === "decision" ? "diamond" : "rect"
  };
}

function renderSmEdge(edge, geometry, selectedEdgeId = "") {
  if (!geometry) return "";
  const selected = selectedEdgeId && selectedEdgeId === edge.id ? " is-selected" : "";
  const marker = selected ? "url(#sm-flow-arrow-selected)" : "url(#sm-flow-arrow)";
  const shared = `data-ov1-edge="${escapeHtml(edge.id)}" data-source-id="${escapeHtml(edge.sourceId)}" data-target-id="${escapeHtml(edge.targetId)}" data-edge-type="stateTransition"`;
  return `<path d="${geometry.path}" class="sm-flow-edge-hit ov1-concept-edge-hit${selected}" ${shared} fill="none"/><path d="${geometry.path}" class="sm-flow-edge ov1-concept-edge${selected}" ${shared} marker-end="${marker}"/>`;
}

function renderSmEdgeLabel(edge, geometry, selectedEdgeId = "") {
  if (!geometry) return "";
  const selected = selectedEdgeId && selectedEdgeId === edge.id ? " is-selected" : "";
  const full = String(edge.isDecisionBranch ? edge.branchResult : edge.condition || edge.label || "转换").trim() || "转换";
  const label = clip(full, 34);
  const empty = !String(edge.isDecisionBranch ? edge.branchResult : edge.condition || "").trim();
  const backward = geometry.backward ? " is-backward" : "";
  const branch = edge.isDecisionBranch ? " is-branch" : "";
  return `<button type="button" class="sm-flow-edge-label${selected}${empty ? " is-placeholder" : ""}${backward}${branch}" data-ov1-edge-label="${escapeHtml(edge.id)}" style="left:${geometry.label.x}%;top:${geometry.label.y}%" title="${escapeHtml(full)}">${escapeHtml(label)}</button>`;
}

function renderStateMachineChatDock(state, { chatOpen = false, chatGenerating = false, model } = {}) {
  return `<aside class="sm-chat-dock ${chatOpen ? "is-open" : "is-collapsed"}" id="stateMachineChatDock" aria-hidden="${chatOpen ? "false" : "true"}" aria-label="状态机对话侧栏">
    ${chatOpen ? renderStateMachineChatPanel({
      chat: state.stateMachineChat,
      chatGenerating,
      model
    }) : ""}
  </aside>`;
}

function renderStateMachineChatPanel({ chat, chatGenerating, model }) {
  const machines = model?.stateMachines || [];
  const footerHtml = `<div class="phase-review-chat-footer sm-review-chat-footer">
        <button type="button" data-action="save-dodaf-ov6b" ${chatGenerating ? "disabled" : ""}>保存状态机</button>
        <p class="planning-meta">状态机 ${machines.length} 台</p>
      </div>`;
  return renderResearchChatPanel({
    scope: "state-machine",
    session: chat,
    generating: chatGenerating,
    title: "状态机对话",
    subtitle: "自然语言生成或修订状态、判定与转换条件，画布即时同步。",
    statusLabel: chatGenerating ? "正在修订" : "研究助手",
    placeholder: "例如：按关键任务生成状态机；给当前机补判定分支",
    emptyTitle: "开始状态机对话",
    emptyText: "例如：按任务生成分机；把转换条件改成可观察门槛；给判定补不满足分支。",
    disabled: chatGenerating,
    className: "phase-review-chat sm-review-chat",
    interactiveTopic: "revision",
    headerActionsHtml: `<button type="button" class="phase-chat-close" data-action="close-state-machine-chat" title="收起对话" aria-label="收起对话"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>`,
    footerHtml
  });
}

export function renderStateMachineToolboxFloatButton({ toolsOpen = false, className = "ov1-edit-rail-brand is-topbar-float sm-toolbox-float" } = {}) {
  return renderToolboxFloatButton({
    scope: "ov6b",
    open: toolsOpen,
    action: "toggle-ov6b-tools",
    className
  });
}

function renderStateMachineToolboxRail({ editorOpen = false, chatOpen = false, chatGenerating = false, machineId = "" } = {}) {
  const canEdit = Boolean(machineId);
  const machineAttrs = machineId ? { "data-machine-id": machineId } : {};
  return renderToolboxRail({
    scope: "ov6b",
    open: true,
    label: "状态机工具箱",
    navLabel: "状态机工具",
    className: "sm-edit-rail",
    navClassName: "sm-edit-rail-nav",
    toggleAction: "toggle-ov6b-tools",
    items: [
      {
        action: "ov6b-toggle-editor",
        title: "状态 / 转换",
        icon: "states",
        active: editorOpen,
        pressed: editorOpen
      },
      {
        action: "toggle-state-machine-chat",
        title: chatOpen ? "收起 AI 对话" : "打开 AI 对话",
        icon: "chat",
        active: chatOpen,
        attention: chatGenerating,
        pressed: chatOpen
      },
      "sep",
      {
        action: "ov6b-add-state",
        title: "加中间态，可拖到画布",
        label: "加中间态",
        icon: "state",
        className: "sm-palette-item",
        disabled: !canEdit,
        attrs: { "data-kind": "normal", "data-sm-palette": "state", ...machineAttrs }
      },
      {
        action: "ov6b-add-state",
        title: "加判定框，可拖到画布",
        label: "加判定框",
        icon: "decision",
        className: "sm-palette-item",
        disabled: !canEdit,
        attrs: { "data-kind": "decision", "data-sm-palette": "decision", ...machineAttrs }
      },
      {
        action: "ov6b-add-transition",
        title: "加转换，可拖到两个状态之间",
        label: "加转换",
        icon: "transition",
        className: "sm-palette-item",
        disabled: !canEdit,
        attrs: { "data-sm-palette": "transition", ...machineAttrs }
      },
      {
        action: "ov6b-remove-machine",
        title: "删除当前状态机",
        label: "删除机",
        icon: "trash",
        className: "sm-palette-item is-danger",
        disabled: !canEdit,
        attrs: { "data-sm-palette": "delete", ...machineAttrs }
      }
    ]
  });
}

function renderEmptyWorkbench(subjects = [], { toolsOpen = false, chatOpen = false, chatGenerating = false, chat, model } = {}) {
  const hint = subjects.length
    ? `已识别 ${subjects.length} 个建模对象，阶段行动将建成阶段机。`
    : "阶段行动建成阶段机；独立任务或持续对象再分别建机。";
  return `<div class="sm-workbench is-empty ${toolsOpen ? "is-tools-docked" : "is-tools-floating"} ${chatOpen ? "is-chat-open" : ""}">
    <div class="sm-empty">
      <h3>尚无状态机</h3>
      <p>来自阶段行动的候选定义为阶段机，不为阶段容器额外建机。${escapeHtml(hint)}</p>
      <div class="sm-empty-actions">
        <button type="button" class="primary-btn" data-action="ov6b-seed-subjects" ${subjects.length ? "" : "disabled"}>识别建模对象</button>
        <button type="button" class="quiet-button" data-action="ov6b-add-machine" data-subject-type="phase">新建阶段机</button>
        <button type="button" class="quiet-button" data-action="ov6b-add-machine" data-subject-type="task">新建任务机</button>
        <button type="button" class="quiet-button" data-action="open-state-machine-chat">打开状态机对话</button>
      </div>
      ${subjects.length ? `<ul class="sm-subject-preview">${subjects.slice(0, 8).map((item) => `<li><b>${escapeHtml(item.name)}</b><small>${escapeHtml(SUBJECT_MACHINE_LABELS[item.subjectType] || SUBJECT_LABELS[item.subjectType] || item.subjectType)} · ${escapeHtml(item.id)}</small></li>`).join("")}</ul>` : ""}
    </div>
    ${renderStateMachineChatDock({ stateMachineChat: chat }, { chatOpen, chatGenerating, model })}
    ${toolsOpen ? renderStateMachineToolboxRail({ editorOpen: false, chatOpen, chatGenerating }) : ""}
  </div>`;
}

function clip(text, max = 16) {
  const value = String(text || "").trim();
  if (value.length <= max) return value || "—";
  return `${value.slice(0, max - 1)}…`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
