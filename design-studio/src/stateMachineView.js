/**
 * 状态机校验（ov6b）：多机列表 + UML/流程图式状态画布 + 转换编辑。
 * 一任务/对象一机；界面不使用 OV-1 文本框样式，不强调 OV 品牌。
 */
import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { renderPhaseChainGuide } from "./phaseChainGuide.js";
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

const SUBJECT_LABELS = Object.freeze({
  task: "任务",
  object: "对象",
  force: "兵力",
  phase: "阶段",
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
  const totalStates = machines.reduce((sum, item) => sum + (item.states?.length || 0), 0);
  const totalTransitions = machines.reduce((sum, item) => sum + (item.transitions?.length || 0), 0);
  const reviewCount = machines.filter((item) => !diagnoseOv6bMachineLocal(item).ok).length;

  return `<section class="sm-page" data-view-page="state-machine" data-dodaf-product="OV-6b">
    ${renderPhaseChainGuide(state, "ov6b")}

    <header class="sm-top">
      <div class="sm-bar">
        <div class="sm-identity">
          <h2>状态机校验</h2>
          <span class="mini-tag">${resolved.source === "persisted" ? "已持久化" : "本地/种子"} · v${model.version || 2}</span>
          <span class="mini-tag">${machines.length} 台</span>
          <span class="mini-tag">${totalStates} 状态</span>
          <span class="mini-tag">${totalTransitions} 转换</span>
          ${reviewCount ? `<span class="mini-tag review">${reviewCount} 台待复核</span>` : ""}
          <small class="sm-hint">关键任务与持续对象 · 生命周期/触发/异常/终止校验</small>
        </div>
        <div class="sm-toolbar">
          <button type="button" class="quiet-button" data-action="ov6b-seed-subjects" title="为尚未建机的关键任务或持续对象建机">识别建模对象</button>
          <button type="button" class="quiet-button" data-action="ov6b-add-machine" data-subject-type="task">新建状态机</button>
          <button type="button" class="primary-btn" data-action="save-dodaf-ov6b">保存</button>
          ${storage ? `<span class="sm-save-actions">${renderProjectStorageState(storage, { refreshAction: "refresh-project-ov6b", showSummary: false })}</span>` : ""}
          <button type="button" class="quiet-button" data-view="ov6c">下一步</button>
        </div>
      </div>
    </header>

    ${machines.length
    ? `<div class="sm-workbench" aria-label="状态机研究台">
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
    ? subjects.map((item) => `<option value="${escapeHtml(item.id)}" data-subject-type="${escapeHtml(item.subjectType)}">${escapeHtml(item.name)}（${escapeHtml(SUBJECT_LABELS[item.subjectType] || item.subjectType)}）</option>`).join("")
    : `<option value="">自定义主体</option>`}
              </select>
            </label>
            <div class="sm-list-actions">
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
      </div>`
    : renderEmptyWorkbench(subjects)}
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
  const typeLabel = SUBJECT_LABELS[machine.subjectType] || machine.subjectType || "其他";
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
  const states = Array.isArray(machine.states) ? machine.states : [];
  const transitions = Array.isArray(machine.transitions) ? machine.transitions : [];
  const diag = diagnoseOv6bMachineLocal(machine);
  const focusState = states.find((item) => item.id === selectedStateId) || null;

  return `<article class="sm-editor" data-machine-id="${escapeHtml(machine.id)}" aria-label="状态机编辑">
    <header class="sm-editor-head">
      <div class="sm-editor-title">
        <strong>${escapeHtml(machine.name || "未命名状态机")}</strong>
        <span class="mini-tag ${diag.ok ? "ready" : "review"}">${escapeHtml(diag.statusLabel)}</span>
        <small>${escapeHtml(diag.detail)}</small>
      </div>
      <div class="sm-editor-actions">
        <button type="button" class="quiet-button" data-action="ov6b-add-state" data-machine-id="${escapeHtml(machine.id)}" data-kind="normal">加中间态</button>
        <button type="button" class="quiet-button" data-action="ov6b-add-state" data-machine-id="${escapeHtml(machine.id)}" data-kind="decision">加判定框</button>
        <button type="button" class="quiet-button" data-action="ov6b-add-transition" data-machine-id="${escapeHtml(machine.id)}">加转换</button>
        <button type="button" class="quiet-button danger-quiet" data-action="ov6b-remove-machine" data-machine-id="${escapeHtml(machine.id)}">删除机</button>
      </div>
    </header>

    <div class="sm-meta-grid">
      <label class="sm-field">
        <span>名称</span>
        <input data-action="ov6b-machine-field" data-machine-id="${escapeHtml(machine.id)}" data-field="name" value="${escapeHtml(machine.name || "")}" />
      </label>
      <label class="sm-field">
        <span>主体类型</span>
        <select data-action="ov6b-machine-field" data-machine-id="${escapeHtml(machine.id)}" data-field="subjectType">
          ${["task", "object", "force", "phase", "other"].map((type) => `<option value="${type}" ${machine.subjectType === type ? "selected" : ""}>${escapeHtml(SUBJECT_LABELS[type] || type)}</option>`).join("")}
        </select>
      </label>
      <label class="sm-field">
        <span>主体引用</span>
        <input list="ov6b-subject-refs" data-action="ov6b-machine-field" data-machine-id="${escapeHtml(machine.id)}" data-field="subjectRef" value="${escapeHtml(machine.subjectRef || "")}" placeholder="任务/兵力/对象 id" />
        <datalist id="ov6b-subject-refs">${subjects.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}</datalist>
      </label>
    </div>

    <section class="sm-canvas-panel" aria-label="状态绘画面板">
      <header class="sm-canvas-head">
        <div>
          <strong>状态流程图</strong>
          <small>拖节点 · 端口拉转换 · 空白平移 · 滚轮缩放 · 双击名称可在下方改</small>
        </div>
        <div class="sm-legend" aria-hidden="true">
          <span class="sm-legend-item kind-initial">开始</span>
          <span class="sm-legend-item kind-normal">状态</span>
          <span class="sm-legend-item kind-decision">判定</span>
          <span class="sm-legend-item kind-final">结束</span>
        </div>
      </header>
      <div class="sm-canvas-frame">
        ${renderStateMachineFlowCanvas(machine, { selectedStateId, selectedTransitionId })}
      </div>
    </section>

    <div class="sm-editor-lower">
      <section class="sm-state-props" aria-label="状态属性">
        <header class="sm-panel-head">
          <strong>状态</strong>
          <small>${focusState ? "已选节点" : "点图中节点，或直接改列表"}</small>
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
  </article>`;
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
    return `<div class="sm-canvas-empty">尚无状态节点。可「加中间态」或新建状态机自动生成开始/中间/结束。</div>`;
  }

  const edges = prepared.transitions.map((item) => ({
    id: item.id,
    sourceId: item.fromStateRef,
    targetId: item.toStateRef,
    type: "stateTransition",
    label: String(item.branchResult || item.condition || "").trim() || "转换",
    branchResult: String(item.branchResult || "").trim(),
    condition: String(item.condition || "").trim()
  }));

  const bounds = computeOv1WorldBounds(nodes);
  const { widthPct: baseWorldWidth, heightPct: worldHeight } = ov1WorldCssSize(nodes);
  const worldWidth = Math.max(baseWorldWidth, nodes.length * 18);
  // Flowchart nodes are center-positioned (left/top + translate -50%).
  const centers = new Map(nodes.map((node) => {
    const box = stateNodeCenterBox(node, bounds);
    return [node.id, { id: node.id, ...box }];
  }));
  const edgeGeometryById = routeSmFlowEdges(edges, centers);
  const title = clip(machine.name || "状态机", 28);

  return `<figure class="sm-flow-canvas sm-ov1-canvas" data-sm-canvas data-machine-id="${escapeHtml(machine.id)}" aria-label="状态机流程图">
    <figcaption class="sm-flow-caption">
      <strong title="${escapeHtml(machine.name || "")}">${escapeHtml(title)}</strong>
      <span class="mini-tag">${nodes.length} 状态 · ${edges.length} 转换</span>
      <span class="sm-flow-context">${escapeHtml(machine.subjectRef || "未绑定主体")}</span>
      <button type="button" class="sm-canvas-fit" data-sm-canvas-fit title="回到全局视图" aria-label="回到全局视图">⌖</button>
      <span class="sm-flow-hint">滚轮缩放 · 空白平移 · 端口连线</span>
    </figcaption>
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
    ? `<span class="sm-flow-glyph" aria-hidden="true"></span>${kind === "final" ? `<span class="sm-flow-glyph-ring" aria-hidden="true"></span>` : ""}
                <span class="sm-flow-node-caption">${escapeHtml(clip(node.label, 10))}</span>`
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
  const start = states.find((item) => item.kind === "initial") || states[0];
  const mainIds = [];
  const seen = new Set();
  let current = start;
  while (current && !seen.has(current.id)) {
    mainIds.push(current.id);
    seen.add(current.id);
    const candidates = visibleTransitions
      .filter((item) => item.fromStateRef === current.id)
      .map((item) => stateById.get(item.toStateRef))
      .filter(Boolean)
      .sort((a, b) => canvasKindWeight(a.kind) - canvasKindWeight(b.kind));
    current = candidates.find((item) => !seen.has(item.id)) || null;
  }
  states.filter((item) => !seen.has(item.id)).forEach((item) => mainIds.push(item.id));

  const count = Math.max(mainIds.length, 2);
  mainIds.forEach((id, index) => {
    const state = stateById.get(id);
    if (!state) return;
    state.x = `${10 + (index / (count - 1)) * 80}%`;
    state.y = "52%";
  });

  return { states, transitions: visibleTransitions };
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
  // Match CSS shapes closely so first-paint connections meet node borders.
  const halfW = kind === "normal" ? 7.2 : kind === "decision" ? 4.2 : 1.7;
  const halfH = kind === "normal" ? 4.4 : kind === "decision" ? 4.2 : 1.7;
  return {
    center: {
      x: Number.isFinite(cx) ? cx : 50,
      y: Number.isFinite(cy) ? cy : 50
    },
    halfW,
    halfH,
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
  const full = String(edge.branchResult || edge.condition || edge.label || "转换").trim() || "转换";
  const label = clip(full, 22);
  const empty = !String(edge.condition || "").trim();
  return `<button type="button" class="sm-flow-edge-label${selected}${empty ? " is-placeholder" : ""}" data-ov1-edge-label="${escapeHtml(edge.id)}" style="left:${geometry.label.x}%;top:${geometry.label.y}%" title="${escapeHtml(full)}">${escapeHtml(label)}</button>`;
}

function renderEmptyWorkbench(subjects = []) {
  const hint = subjects.length
    ? `已识别 ${subjects.length} 个关键任务/持续对象，可一键建机。`
    : "阶段只提供上下文；请先补充有明确进出条件的关键任务或持续运行对象。";
  return `<div class="sm-empty">
    <h3>尚无状态机</h3>
    <p>为关键任务或持续对象分别建立生命周期，不为每个阶段机械建机。${escapeHtml(hint)}</p>
    <div class="sm-empty-actions">
      <button type="button" class="primary-btn" data-action="ov6b-seed-subjects" ${subjects.length ? "" : "disabled"}>识别建模对象</button>
      <button type="button" class="quiet-button" data-action="ov6b-add-machine" data-subject-type="task">新建任务状态机</button>
    </div>
    ${subjects.length ? `<ul class="sm-subject-preview">${subjects.slice(0, 8).map((item) => `<li><b>${escapeHtml(item.name)}</b><small>${escapeHtml(SUBJECT_LABELS[item.subjectType] || item.subjectType)} · ${escapeHtml(item.id)}</small></li>`).join("")}</ul>` : ""}
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
