import { escapeHtml } from "./app/domUtils.js";

const CARD_W = 200;
const CARD_H = 64;
const VERT_GAP = 24;
const COL_W = 290;
const START_X = 160;

/**
 * Classifies an operational node into one of four functional flow columns
 */
export function classifyNode(node) {
  const t = (node.label || node.id || "").toLowerCase();
  // Col 0: 态势感知与侦察
  if (/侦察|预警|雷达|频谱|监测|测向|辐射源|scout|sensor|recon|radar|elint|esm/.test(t)) return 0;
  // Col 1: 指控中枢与核心
  if (/指控|指挥|司令|中枢|协调|核心|c2|cmd|command/.test(t)) return 1;
  // Col 2: 突防突击与火力打击
  if (/突防|打击|突击|诱骗|诱饵|蜂群|突击队|反辐射|巡飞|微波|消耗|导弹|火力|攻击|火控|shooter|missile|fire|strike|penetration|arm|decoy|swarm/.test(t)) return 2;
  // Col 3: 防御拦截与保障
  if (/防空|拦截|截击|护航|清场|加油|保障|运输|重构|补漏|预备|车队|阵地|机队|sam|defense|tanker|escort|logistics/.test(t)) return 3;
  return 1;
}

/**
 * Clean multi-column layout for OV-2 operational nodes
 */
export function layoutOv2Topology(nodes = [], exchanges = [], savedPositions = {}) {
  if (!nodes || !nodes.length) {
    return { worldWidth: 1200, worldHeight: 650, positions: new Map(), columns: [[], [], [], []] };
  }

  const columns = [[], [], [], []];
  nodes.forEach((node) => {
    const colIdx = classifyNode(node);
    columns[colIdx].push(node);
  });

  const maxRows = Math.max(3, ...columns.map((c) => c.length));
  const worldWidth = START_X * 2 + 3 * COL_W;
  const worldHeight = Math.max(680, 80 + maxRows * (CARD_H + VERT_GAP));

  const positions = new Map();
  columns.forEach((colNodes, colIdx) => {
    const x = START_X + colIdx * COL_W;
    colNodes.forEach((node, rowIdx) => {
      const defaultY = 80 + rowIdx * (CARD_H + VERT_GAP) + CARD_H / 2;
      const custom = savedPositions?.[node.id];
      const posX = custom?.x !== undefined ? Number(custom.x) : x;
      const posY = custom?.y !== undefined ? Number(custom.y) : defaultY;
      positions.set(node.id, {
        id: node.id,
        x: posX,
        y: posY,
        col: colIdx,
        row: rowIdx
      });
    });
  });

  return { worldWidth, worldHeight, positions, columns };
}

/**
 * Computes smooth cubic bezier curve between two nodes with exact pixel midpoints
 */
export function computeExchangeCurve(sourcePos, targetPos, parallelIndex = 0) {
  const W = CARD_W / 2;
  const H = CARD_H / 2;

  let sx, sy, tx, ty, cx1, cy1, cx2, cy2;

  // Forward: Left to Right
  if (sourcePos.col < targetPos.col) {
    sx = sourcePos.x + W;
    sy = sourcePos.y;
    tx = targetPos.x - W;
    ty = targetPos.y;
    const dx = tx - sx;
    cx1 = sx + dx * 0.45;
    cy1 = sy;
    cx2 = tx - dx * 0.45;
    cy2 = ty;
  }
  // Feedback: Right to Left
  else if (sourcePos.col > targetPos.col) {
    sx = sourcePos.x - W;
    sy = sourcePos.y;
    tx = targetPos.x + W;
    ty = targetPos.y;
    const archY = Math.min(sy, ty) - 45 - Math.abs(sourcePos.x - targetPos.x) * 0.05;
    cx1 = sx - 40;
    cy1 = archY;
    cx2 = tx + 40;
    cy2 = archY;
  }
  // Same Column: Loop around the right side
  else {
    sx = sourcePos.x + W;
    sy = sourcePos.y;
    tx = targetPos.x + W;
    ty = targetPos.y;
    const loopOffset = 45 + Math.min(60, Math.abs(targetPos.y - sourcePos.y) * 0.1) + (parallelIndex % 3) * 16;
    const loopX = sx + loopOffset;
    cx1 = loopX;
    cy1 = sy;
    cx2 = loopX;
    cy2 = ty;
  }

  // Midpoint on cubic bezier curve at t = 0.5
  const mx = 0.125 * sx + 0.375 * cx1 + 0.375 * cx2 + 0.125 * tx;
  const my = 0.125 * sy + 0.375 * cy1 + 0.375 * cy2 + 0.125 * ty;

  const path = `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${tx.toFixed(1)} ${ty.toFixed(1)}`;

  return { path, mx, my };
}

/**
 * Renders the robust, pixel-perfect interactive OV-2 Canvas
 */
export function renderOv2Canvas(model, {
  selectedNodeId = "",
  selectedExchangeId = "",
  flowFilter = "all",
  savedPositions = {}
} = {}) {
  const nodes = model.nodes || [];
  const exchanges = model.exchanges || [];

  if (!nodes.length) {
    return `<div class="ov2-canvas-empty"><strong>尚未定义作战节点</strong><span>可从上游作战兵力或活动模型重新推导生成。</span></div>`;
  }

  const layout = layoutOv2Topology(nodes, exchanges, savedPositions);
  const worldW = layout.worldWidth;
  const worldH = layout.worldHeight;

  // Degree counts
  const inDegree = new Map();
  const outDegree = new Map();
  nodes.forEach((n) => { inDegree.set(n.id, 0); outDegree.set(n.id, 0); });
  exchanges.forEach((ex) => {
    outDegree.set(ex.sourceNodeId, (outDegree.get(ex.sourceNodeId) || 0) + 1);
    inDegree.set(ex.targetNodeId, (inDegree.get(ex.targetNodeId) || 0) + 1);
  });

  // Link Focus calculation
  const hasNodeFilter = Boolean(selectedNodeId);
  const focusedNeighborIds = new Set();
  const connectedEdgeIds = new Set();
  if (hasNodeFilter) {
    focusedNeighborIds.add(selectedNodeId);
    exchanges.forEach((ex) => {
      if (ex.sourceNodeId === selectedNodeId) {
        focusedNeighborIds.add(ex.targetNodeId);
        connectedEdgeIds.add(ex.id);
      } else if (ex.targetNodeId === selectedNodeId) {
        focusedNeighborIds.add(ex.sourceNodeId);
        connectedEdgeIds.add(ex.id);
      }
    });
  }

  // Markers with pixel units
  const markers = `
    <marker id="ov2-arrow-control" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f43f5e" />
    </marker>
    <marker id="ov2-arrow-information" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
    </marker>
    <marker id="ov2-arrow-resource" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284c7" />
    </marker>
    <marker id="ov2-arrow-default" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#06b6d4" />
    </marker>
  `;

  // Track parallel links
  const pairSeen = new Map();

  const linesHtml = [];
  const labelsHtml = [];

  exchanges.forEach((ex) => {
    const sourcePos = layout.positions.get(ex.sourceNodeId);
    const targetPos = layout.positions.get(ex.targetNodeId);
    if (!sourcePos || !targetPos) return;

    const pairKey = `${ex.sourceNodeId}->${ex.targetNodeId}`;
    const pIdx = pairSeen.get(pairKey) || 0;
    pairSeen.set(pairKey, pIdx + 1);

    const curve = computeExchangeCurve(sourcePos, targetPos, pIdx);
    const flowKey = resolveFlowKey(ex.flowType);
    const isMatchFilter = flowFilter === "all" || flowKey === flowFilter;
    const isSelected = selectedExchangeId === ex.id;
    const isConnected = hasNodeFilter && connectedEdgeIds.has(ex.id);
    const isDimmed = !isMatchFilter || (hasNodeFilter && !isConnected);

    const classNames = [
      "ov2-flow-line",
      `flow-${flowKey}`,
      isSelected ? "is-selected-flow" : "",
      isConnected ? "is-connected-flow" : "",
      isDimmed ? "is-dimmed" : ""
    ].filter(Boolean).join(" ");

    const markerId = flowKey === "control"
      ? "ov2-arrow-control"
      : flowKey === "resource"
        ? "ov2-arrow-resource"
        : "ov2-arrow-information";

    // SVG paths: invisible hit path + styled line
    linesHtml.push(`
      <g class="ov2-flow-edge-group" data-edge-id="${escapeHtml(ex.id)}" data-source-id="${escapeHtml(ex.sourceNodeId)}" data-target-id="${escapeHtml(ex.targetNodeId)}">
        <path d="${curve.path}" fill="none" stroke="transparent" stroke-width="14" style="cursor:pointer;pointer-events:stroke;" data-ov2-exchange="${escapeHtml(ex.id)}" />
        <path class="${classNames}" d="${curve.path}" fill="none" marker-end="url(#${markerId})" style="pointer-events:none;" />
      </g>
    `);

    // Edge Label Button at exact pixel midpoint
    const labelClasses = [
      "ov2-flow-label-btn",
      `flow-${flowKey}`,
      isSelected ? "is-selected" : "",
      isConnected ? "is-connected" : "",
      isDimmed ? "is-dimmed" : ""
    ].filter(Boolean).join(" ");

    const shortLabel = ex.label || ex.flowType || "流";

    labelsHtml.push(`
      <button type="button" class="${labelClasses}" data-ov2-exchange="${escapeHtml(ex.id)}"
        style="left:${curve.mx.toFixed(1)}px;top:${curve.my.toFixed(1)}px;"
        title="${escapeHtml(ex.sourceNodeLabel || ex.sourceNodeId)} ➔ ${escapeHtml(ex.targetNodeLabel || ex.targetNodeId)}：${escapeHtml(ex.label || ex.flowType)}">
        <span class="ov2-label-dot"></span>
        <span class="ov2-label-text">${escapeHtml(shortLabel)}</span>
      </button>
    `);
  });

  // Render HTML Node Cards
  const nodeCards = nodes.map((node) => {
    const pos = layout.positions.get(node.id) || { x: worldW / 2, y: worldH / 2 };
    const isSelected = selectedNodeId === node.id;
    const isLinked = hasNodeFilter && !isSelected && focusedNeighborIds.has(node.id);
    const isDimmed = hasNodeFilter && !focusedNeighborIds.has(node.id);
    const outC = outDegree.get(node.id) || 0;
    const inC = inDegree.get(node.id) || 0;
    const layerLabel = node.layer === "combat" ? "作战层" : "概念层";

    const classNames = [
      "ov2-node-card",
      isSelected ? "is-focused-node" : "",
      isLinked ? "is-linked-node" : "",
      isDimmed ? "is-dimmed-node" : ""
    ].filter(Boolean).join(" ");

    return `
      <div class="${classNames}" style="left:${pos.x}px;top:${pos.y}px;" data-ov2-node="${escapeHtml(node.id)}" data-action="ov2-select-node" data-node-id="${escapeHtml(node.id)}">
        <div class="ov2-node-card-head">
          <strong class="ov2-node-name" title="${escapeHtml(node.label || node.id)}">${escapeHtml(node.label || node.id)}</strong>
          <span class="ov2-node-layer-badge">${layerLabel}</span>
        </div>
        <div class="ov2-node-card-body">
          <span class="ov2-flow-counter is-out" title="流出资源交换数量">▲ ${outC} 出</span>
          <span class="ov2-flow-counter is-in" title="流入资源交换数量">▼ ${inC} 进</span>
        </div>
      </div>
    `;
  }).join("");

  const colTitles = ["态势感知与侦察", "指控中枢与核心", "突防突击与蜂群", "拦截防御与保障"];

  return `
    <div class="ov2-canvas-frame sm-flow-canvas">
      <div class="ov2-canvas-stage sm-flow-stage" title="点击卡片聚焦节点 · 点击连线或标签编辑流 · 滚轮缩放">
        <div class="ov2-canvas-world" style="width:${worldW}px;height:${worldH}px;">
          <!-- Column guide headers -->
          <div class="ov2-canvas-col-headers" style="position:absolute;top:18px;left:0;width:${worldW}px;pointer-events:none;z-index:2;">
            ${layout.columns.map((col, idx) => `
              <div style="position:absolute;left:${START_X + idx * COL_W}px;transform:translateX(-50%);width:${CARD_W}px;text-align:center;">
                <span class="ov2-col-header-pill">${colTitles[idx]} (${col.length})</span>
              </div>
            `).join("")}
          </div>

          <!-- SVG Lines with exact pixel coordinate system -->
          <svg class="ov2-canvas-svg" viewBox="0 0 ${worldW} ${worldH}" width="${worldW}" height="${worldH}" style="position:absolute;inset:0;width:${worldW}px;height:${worldH}px;overflow:visible;" aria-hidden="true">
            <defs>${markers}</defs>
            ${linesHtml.join("")}
          </svg>

          <!-- Edge Label Buttons Layer -->
          <div class="ov2-canvas-labels-layer" style="position:absolute;inset:0;pointer-events:none;z-index:4;">
            ${labelsHtml.join("")}
          </div>

          <!-- Node Cards Layer -->
          <div class="ov2-canvas-nodes-layer" style="position:absolute;inset:0;pointer-events:none;z-index:3;">
            ${nodeCards}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Normalizes flow types to standard filter keys
 */
export function resolveFlowKey(flowType = "") {
  const text = String(flowType || "").toLowerCase();
  if (/控制|command|control|指令/.test(text)) return "control";
  if (/物资|资源|保障|装备|弹药|油料|resource|support|material/.test(text)) return "resource";
  return "information";
}
