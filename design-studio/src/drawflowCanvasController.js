import { updateOv1Node } from "./ov1Store.js";
import { buildOv5ActivityGraph } from "./ov5GraphBuilder.js";

const MAX_POSITION = 76;
const OV1_NODE_SIZE = { width: 174, height: 94 };
const OV5_NODE_SIZE = { width: 190, height: 104 };

export function calculateOv1CanvasPosition({ node, startX, startY, clientX, clientY, boardRect }) {
  const width = Number(boardRect?.width || 0);
  const height = Number(boardRect?.height || 0);
  if (!width || !height) return { x: node.x, y: node.y };
  return {
    x: `${Math.min(MAX_POSITION, Math.max(0, Math.round((Number.parseFloat(node.x) || 0) + ((clientX - startX) / width) * 100)))}%`,
    y: `${Math.min(MAX_POSITION, Math.max(0, Math.round((Number.parseFloat(node.y) || 0) + ((clientY - startY) / height) * 100)))}%`
  };
}

export function createOv1DrawflowController({ getState, render, notify, selectNode, invalidateValidation, syncOv1 }) {
  let editor = null;
  return {
    bind(root) {
      const board = root.querySelector(".ov1-board");
      const container = board?.querySelector(".ov1-drawflow-canvas");
      if (!board || !container || !globalThis.Drawflow) return;
      editor = new globalThis.Drawflow(container);
      editor.curvature = 0.35;
      editor.start();
      const state = getState();
      const ids = addNodes(editor, state.ov1.nodes, board, OV1_NODE_SIZE, ov1NodeHtml);
      addEdges(editor, state.ov1.edges, ids);
      editor.on("nodeSelected", (id) => { const modelId = ids.reverse.get(String(id)); if (modelId) { selectNode(modelId, { open: true }); render(); } });
      editor.on("nodeMoved", (id) => {
        const modelId = ids.reverse.get(String(id));
        const modelNode = state.ov1.nodes.find((node) => node.id === modelId);
        const drawn = editor.getNodeFromId(id);
        if (!modelNode || !drawn) return;
        const next = updateOv1Node(state.ov1, modelId, { label: modelNode.label, detail: modelNode.detail, x: pixelsToPercent(drawn.pos_x, board.clientWidth, OV1_NODE_SIZE.width), y: pixelsToPercent(drawn.pos_y, board.clientHeight, OV1_NODE_SIZE.height) });
        if (!next) return;
        state.ov1 = next;
        invalidateValidation?.();
        void syncOv1?.(next, { source: "canvas-drag" });
        notify("概念图节点位置已更新");
      });
    }
  };
}

export function createOv5DrawflowController({ getState, selectActivity }) {
  let editor = null;
  return {
    bind(root) {
      const board = root.querySelector(".ov5-graph-board");
      const container = board?.querySelector(".ov5-drawflow-canvas");
      if (!board || !container || !globalThis.Drawflow) return;
      editor = new globalThis.Drawflow(container);
      editor.curvature = 0.28;
      editor.start();
      const graph = buildOv5ActivityGraph(getState().ov5);
      const ids = addNodes(editor, graph.nodes, board, OV5_NODE_SIZE, ov5NodeHtml);
      addEdges(editor, graph.edges, ids);
      editor.on("nodeSelected", (id) => { const modelId = ids.reverse.get(String(id)); if (modelId) selectActivity(modelId); });
    }
  };
}

function addNodes(editor, nodes, board, size, html) {
  const ids = new Map();
  const reverse = new Map();
  nodes.forEach((node) => {
    const id = editor.addNode(node.id, 1, 1, percentToPixels(node.x, board.clientWidth, size.width), percentToPixels(node.y, board.clientHeight, size.height), "research-node", { modelId: node.id }, html(node));
    ids.set(node.id, id);
    reverse.set(String(id), node.id);
  });
  ids.reverse = reverse;
  return ids;
}

function addEdges(editor, edges, ids) {
  edges.forEach((edge) => {
    const source = ids.get(edge.sourceId);
    const target = ids.get(edge.targetId);
    if (!source || !target) return;
    editor.addConnection(source, target, "output_1", "input_1");
    document.querySelectorAll(`.connection.node_out_node-${source}.node_in_node-${target}`).forEach((element) => element.classList.add(`drawflow-edge-${edgeTone(edge.type)}`));
  });
}

function ov1NodeHtml(node) {
  return `<div class="drawflow-card ${escapeHtml(node.className || "")}"><span>${escapeHtml(node.category || "未分类")}</span><strong>${escapeHtml(node.label)}</strong><small>${escapeHtml(node.responsibility || node.detail)}</small></div>`;
}

function ov5NodeHtml(node) {
  return `<div class="drawflow-card ov5"><span>${escapeHtml(node.type)}</span><strong>${escapeHtml(node.title)}</strong><small>${escapeHtml(node.duration || "待估算")}</small></div>`;
}

function edgeTone(type) {
  const value = String(type || "").toLowerCase();
  if (value.includes("resource") || value.includes("资源")) return "resource";
  if (value.includes("control") || value.includes("控制")) return "control";
  if (value.includes("state") || value.includes("态势")) return "state";
  if (value.includes("feedback") || value.includes("反馈")) return "feedback";
  return "information";
}

function percentToPixels(value, boardSize, nodeSize) {
  return Math.round((Math.min(MAX_POSITION, Math.max(0, Number.parseFloat(value) || 0)) / 100) * Math.max(0, boardSize - nodeSize));
}

function pixelsToPercent(value, boardSize, nodeSize) {
  return `${Math.min(MAX_POSITION, Math.max(0, Math.round((Number(value) / Math.max(1, boardSize - nodeSize)) * 100)))}%`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character]));
}
