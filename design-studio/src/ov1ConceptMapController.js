import { addOv1Edge, updateOv1Node } from "./ov1Store.js";
import {
  OV1_COORD_MAX,
  OV1_COORD_MIN,
  computeOv1WorldBounds,
  logicalToWorldCss
} from "./ov1Canvas.js";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const DEFAULT_LINK_TYPE = "信息流";

/** Session camera (not persisted). */
let canvasPan = { x: 0, y: 0 };
let canvasZoom = 1;
let shouldFitCamera = true;

/** Fit the current graph when it is next bound to the DOM. */
export function resetOv1Camera() {
  canvasPan = { x: 0, y: 0 };
  canvasZoom = 1;
  shouldFitCamera = true;
}

export function calculateOv1CameraFit({ stageWidth, stageHeight, worldWidth, worldHeight, padding = 24 } = {}) {
  const safeStageWidth = Math.max(Number(stageWidth) || 0, 1);
  const safeStageHeight = Math.max(Number(stageHeight) || 0, 1);
  const safeWorldWidth = Math.max(Number(worldWidth) || 0, 1);
  const safeWorldHeight = Math.max(Number(worldHeight) || 0, 1);
  const availableWidth = Math.max(1, safeStageWidth - padding * 2);
  const availableHeight = Math.max(1, safeStageHeight - padding * 2);
  const zoom = clampNumber(Math.min(1, availableWidth / safeWorldWidth, availableHeight / safeWorldHeight), MIN_ZOOM, MAX_ZOOM);
  return {
    zoom,
    pan: {
      x: (safeStageWidth - safeWorldWidth * zoom) / 2,
      y: (safeStageHeight - safeWorldHeight * zoom) / 2
    }
  };
}

export function createOv1ConceptMapController({ getState, render, notify, selectNode, selectEdge, invalidateValidation, syncOv1 }) {
  let resizeObserver = null;
  return {
    bind(root) {
      resizeObserver?.disconnect();
      const board = root.querySelector(".ov1-concept-map");
      if (!board) return;
      const stage = board.querySelector("[data-ov1-stage]") || board;
      const world = board.querySelector("[data-ov1-world]");
      if (shouldFitCamera) fitCameraToWorld(stage, world);
      applyWorldTransform(world);
      const refreshEdges = () => refreshConceptEdges(stage);
      refreshEdges();
      resizeObserver = new ResizeObserver(refreshEdges);
      resizeObserver.observe(stage);
      if (world) resizeObserver.observe(world);

      stage.querySelectorAll("[data-ov1-port]").forEach((port) => {
        port.addEventListener("pointerdown", (event) => startLink(event, board, stage, world, port, refreshEdges));
      });
      stage.querySelectorAll("[data-ov1]").forEach((element) => {
        element.addEventListener("pointerdown", (event) => dragNode(event, stage, element, refreshEdges));
      });
      stage.querySelectorAll("[data-ov1-edge], [data-ov1-edge-label]").forEach((element) => {
        element.addEventListener("pointerdown", (event) => openEdgeFromCanvas(event, element));
      });
      stage.addEventListener("pointerdown", (event) => panCanvas(event, board, stage, world, refreshEdges));
      stage.addEventListener("wheel", (event) => zoomCanvas(event, stage, world, refreshEdges), { passive: false });
    }
  };

  function openEdgeFromCanvas(event, element) {
    if (event.button !== 0 || !event.isPrimary) return;
    if (getState().ov1Generating) return;
    const edgeId = element.dataset.ov1Edge || element.dataset.ov1EdgeLabel;
    if (!edgeId) return;
    event.preventDefault();
    event.stopPropagation();
    selectEdge?.(edgeId);
    render();
  }

  function panCanvas(event, board, stage, world, refreshEdges) {
    if (event.button !== 0 || !event.isPrimary) return;
    if (event.target.closest("[data-ov1], [data-ov1-port], [data-ov1-node], [data-ov1-edge], [data-ov1-edge-label], .dodaf-legend, .ov1-concept-legend, button, a, input, select, textarea, summary, label")) return;
    if (getState().ov1Generating) return;
    event.preventDefault();
    const start = { x: event.clientX, y: event.clientY, panX: canvasPan.x, panY: canvasPan.y };
    let moved = false;
    board.classList.add("is-panning");
    stage.classList.add("is-panning");
    stage.setPointerCapture?.(event.pointerId);

    const move = (pointer) => {
      const dx = pointer.clientX - start.x;
      const dy = pointer.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      canvasPan = { x: start.panX + dx, y: start.panY + dy };
      applyWorldTransform(world);
      refreshEdges();
    };

    const finish = () => cleanup();
    const cleanup = () => {
      board.classList.remove("is-panning");
      stage.classList.remove("is-panning");
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", finish);
      stage.removeEventListener("pointercancel", finish);
      stage.releasePointerCapture?.(event.pointerId);
    };

    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", finish);
    stage.addEventListener("pointercancel", finish);
  }

  function zoomCanvas(event, stage, world, refreshEdges) {
    if (!world || getState().ov1Generating) return;
    event.preventDefault();
    event.stopPropagation();

    const rect = stage.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    const nextZoom = clampNumber(canvasZoom * factor, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(nextZoom - canvasZoom) < 0.001) return;

    const worldX = (mx - canvasPan.x) / canvasZoom;
    const worldY = (my - canvasPan.y) / canvasZoom;
    canvasZoom = nextZoom;
    canvasPan = {
      x: mx - worldX * canvasZoom,
      y: my - worldY * canvasZoom
    };
    applyWorldTransform(world);
    refreshEdges();
  }

  function startLink(event, board, stage, world, port, refreshEdges) {
    if (event.button !== 0 || !event.isPrimary) return;
    const state = getState();
    const sourceId = port.dataset.sourceId;
    if (!sourceId || state.ov1Generating) return;
    event.preventDefault();
    event.stopPropagation();

    const sourceNode = resolveNodeElement(stage, sourceId);
    if (!sourceNode) return;

    const svg = stage.querySelector(".ov1-concept-lines");
    if (!svg) return;
    let draft = svg.querySelector("[data-ov1-link-draft]");
    if (!draft) {
      draft = document.createElementNS("http://www.w3.org/2000/svg", "path");
      draft.setAttribute("data-ov1-link-draft", "");
      draft.setAttribute("class", "ov1-concept-edge ov1-link-draft");
      draft.setAttribute("fill", "none");
      svg.appendChild(draft);
    }

    board.classList.add("is-linking");
    stage.classList.add("is-linking");
    sourceNode.classList.add("is-link-source");
    stage.querySelectorAll("[data-ov1-node]").forEach((node) => {
      if (node.dataset.ov1Node !== sourceId) node.classList.add("is-link-target");
    });

    const updateDraft = (pointer) => {
      const start = nodeCssCenter(sourceNode);
      const end = clientToWorldCssPercent(pointer.clientX, pointer.clientY, stage, world);
      if (!start || !end) return;
      const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      draft.setAttribute("d", `M${start.x} ${start.y} Q${mid.x} ${mid.y} ${end.x} ${end.y}`);
      draft.style.display = "";

      const under = document.elementFromPoint(pointer.clientX, pointer.clientY);
      const hoverNode = under?.closest?.("[data-ov1-node], [data-ov1]");
      const hoverId = hoverNode?.dataset?.ov1Node || hoverNode?.dataset?.ov1 || "";
      stage.querySelectorAll(".is-link-hover").forEach((el) => el.classList.remove("is-link-hover"));
      if (hoverId && hoverId !== sourceId) {
        (resolveNodeElement(stage, hoverId) || hoverNode)?.classList.add("is-link-hover");
      }
    };

    updateDraft(event);
    stage.setPointerCapture?.(event.pointerId);

    const move = (pointer) => updateDraft(pointer);
    const finish = (pointer) => {
      cleanup();
      const under = document.elementFromPoint(pointer.clientX, pointer.clientY);
      const targetEl = under?.closest?.("[data-ov1-node], [data-ov1]");
      const targetId = targetEl?.dataset?.ov1Node || targetEl?.dataset?.ov1 || "";
      if (!targetId || targetId === sourceId) {
        notify("在另一节点上松开以建立关系");
        return;
      }
      const next = addOv1Edge(getState().ov1, {
        sourceId,
        targetId,
        type: DEFAULT_LINK_TYPE
      });
      if (!next) {
        notify("该关系无效或已存在");
        return;
      }
      state.ov1 = next;
      invalidateValidation?.();
      void syncOv1?.(next, { source: "canvas-link" });
      const created = next.edges.find((edge) => edge.sourceId === sourceId && edge.targetId === targetId && edge.type === DEFAULT_LINK_TYPE);
      selectEdge?.(created?.id);
      notify(`已建立${DEFAULT_LINK_TYPE}关系`);
      render();
    };

    const cancel = () => cleanup();
    const cleanup = () => {
      board.classList.remove("is-linking");
      stage.classList.remove("is-linking");
      stage.querySelectorAll(".is-link-source, .is-link-target, .is-link-hover").forEach((el) => {
        el.classList.remove("is-link-source", "is-link-target", "is-link-hover");
      });
      if (draft) {
        draft.style.display = "none";
        draft.removeAttribute("d");
      }
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", finish);
      stage.removeEventListener("pointercancel", cancel);
      stage.releasePointerCapture?.(event.pointerId);
      refreshEdges();
    };

    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", finish);
    stage.addEventListener("pointercancel", cancel);
  }

  function dragNode(event, stage, element, refreshEdges) {
    if (event.button !== 0 || !event.isPrimary) return;
    if (event.target.closest("[data-ov1-port]")) return;
    const state = getState();
    const node = state.ov1.nodes.find((item) => item.id === element.dataset.ov1);
    if (!node || state.ov1Generating) return;
    event.preventDefault();
    event.stopPropagation();

    const start = { x: event.clientX, y: event.clientY };
    // Logical coordinates (home viewport 0–100; may go outside when dragged free).
    const originX = Number.parseFloat(node.x) || 0;
    const originY = Number.parseFloat(node.y) || 0;
    let moved = false;
    let position = { x: node.x, y: node.y };
    const shell = element.closest("[data-ov1-node]") || element;
    element.setPointerCapture?.(event.pointerId);

    const move = (pointer) => {
      // 100 logical units = one stage viewport (independent of world expansion).
      const stageW = Math.max(stage.clientWidth, 1);
      const stageH = Math.max(stage.clientHeight, 1);
      const nextX = originX + ((pointer.clientX - start.x) / (stageW * canvasZoom)) * 100;
      const nextY = originY + ((pointer.clientY - start.y) / (stageH * canvasZoom)) * 100;
      position = {
        x: `${clampNumber(nextX, OV1_COORD_MIN, OV1_COORD_MAX)}%`,
        y: `${clampNumber(nextY, OV1_COORD_MIN, OV1_COORD_MAX)}%`
      };
      if (Math.abs(pointer.clientX - start.x) < 3 && Math.abs(pointer.clientY - start.y) < 3) return;
      moved = true;

      const draftNodes = (getState().ov1.nodes || []).map((item) => (
        item.id === node.id ? { ...item, x: position.x, y: position.y } : item
      ));
      applyLiveWorldLayout(stage, draftNodes);
      shell.dataset.logicalX = position.x;
      shell.dataset.logicalY = position.y;
      refreshEdges();
    };

    const finish = (pointer, cancelled = false) => {
      cleanup();
      if (cancelled || !moved) {
        selectNode(node.id, { open: true });
        render();
        return;
      }
      move(pointer);
      let next = updateOv1Node(getState().ov1, node.id, {
        label: node.label,
        detail: node.detail,
        x: position.x,
        y: position.y
      });
      if (!next) {
        next = updateOv1Node(getState().ov1, node.id, { x: position.x, y: position.y });
      }
      if (!next) {
        notify("节点位置未能保存");
        render();
        return;
      }
      state.ov1 = next;
      invalidateValidation?.();
      void syncOv1?.(state.ov1, { source: "concept-map-drag" });
      notify("OV-1 主体位置已更新");
      render();
    };

    const cancel = (pointer) => finish(pointer, true);
    const cleanup = () => {
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", finish);
      element.removeEventListener("pointercancel", cancel);
      element.releasePointerCapture?.(event.pointerId);
    };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", finish);
    element.addEventListener("pointercancel", cancel);
  }
}

function applyWorldTransform(world) {
  if (!world) return;
  world.style.transformOrigin = "0 0";
  world.style.transform = `translate3d(${canvasPan.x}px, ${canvasPan.y}px, 0) scale(${canvasZoom})`;
}

function fitCameraToWorld(stage, world) {
  if (!stage || !world) return;
  if (!stage.clientWidth || !stage.clientHeight || !world.offsetWidth || !world.offsetHeight) return;
  const fit = calculateOv1CameraFit({
    stageWidth: stage.clientWidth,
    stageHeight: stage.clientHeight,
    worldWidth: world.offsetWidth,
    worldHeight: world.offsetHeight
  });
  canvasZoom = fit.zoom;
  canvasPan = fit.pan;
  shouldFitCamera = false;
}

/** Resize world + reposition nodes from logical coords (live drag). */
function applyLiveWorldLayout(stage, nodes) {
  const world = stage.querySelector("[data-ov1-world]");
  if (!world) return;
  const bounds = computeOv1WorldBounds(nodes);
  world.style.width = `${bounds.widthPct}%`;
  world.style.height = `${bounds.heightPct}%`;
  world.dataset.worldMinX = String(bounds.minX);
  world.dataset.worldMinY = String(bounds.minY);
  world.dataset.worldWidth = String(bounds.width);
  world.dataset.worldHeight = String(bounds.height);

  const byId = new Map(nodes.map((node) => [node.id, node]));
  stage.querySelectorAll("[data-ov1-node]").forEach((el) => {
    const id = el.dataset.ov1Node;
    const node = byId.get(id);
    if (!node) return;
    const css = logicalToWorldCss(node.x, node.y, bounds);
    el.style.left = css.left;
    el.style.top = css.top;
    el.dataset.logicalX = String(node.x);
    el.dataset.logicalY = String(node.y);
  });
}

/**
 * Edge paths from measured node boxes in world CSS % (SVG 0–100).
 */
function refreshConceptEdges(stage) {
  const world = stage.querySelector("[data-ov1-world]");
  if (!world) return;
  const ww = Math.max(world.offsetWidth, 1);
  const wh = Math.max(world.offsetHeight, 1);
  const updatedLabels = new Set();

  stage.querySelectorAll("[data-ov1-edge]:not([data-ov1-link-draft])").forEach((path) => {
    const source = resolveNodeElement(stage, path.dataset.sourceId);
    const target = resolveNodeElement(stage, path.dataset.targetId);
    if (!source || !target) return;
    const geometry = edgeGeometryFromLayout(source, target, ww, wh, path.dataset.edgeType);
    if (!geometry) return;
    path.setAttribute("d", geometry.path);
    const edgeId = path.dataset.ov1Edge;
    if (!edgeId || updatedLabels.has(edgeId)) return;
    updatedLabels.add(edgeId);
    const label = stage.querySelector(`[data-ov1-edge-label="${CSS.escape(edgeId)}"]`);
    if (label) {
      label.style.left = `${geometry.label.x}%`;
      label.style.top = `${geometry.label.y}%`;
    }
  });
}

function resolveNodeElement(stage, id) {
  if (!id) return null;
  return stage.querySelector(`[data-ov1-node="${CSS.escape(id)}"]`)
    || stage.querySelector(`[data-ov1="${CSS.escape(id)}"]`);
}

function edgeGeometryFromLayout(sourceEl, targetEl, worldW, worldH, type) {
  const source = nodeCssBox(sourceEl, worldW, worldH);
  const target = nodeCssBox(targetEl, worldW, worldH);
  if (!source || !target) return null;
  const start = boxAnchor(source, target.center);
  const end = boxAnchor(target, source.center);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / distance, y: dx / distance };
  const bend = type === "反馈" ? 4 : 2;
  const control = {
    x: (start.x + end.x) / 2 + normal.x * bend,
    y: (start.y + end.y) / 2 + normal.y * bend
  };
  const label = {
    x: (start.x + 2 * control.x + end.x) / 4,
    y: (start.y + 2 * control.y + end.y) / 4
  };
  return {
    path: `M${start.x} ${start.y} Q${control.x} ${control.y} ${end.x} ${end.y}`,
    label
  };
}

function nodeCssBox(el, worldW, worldH) {
  if (!el) return null;
  const left = Number.parseFloat(el.style.left);
  const top = Number.parseFloat(el.style.top);
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
  const halfW = Math.max(1.2, (el.offsetWidth / worldW) * 50);
  const halfH = Math.max(1, (el.offsetHeight / worldH) * 50);
  return {
    halfW,
    halfH,
    center: { x: left + halfW, y: top + halfH }
  };
}

function nodeCssCenter(el) {
  const left = Number.parseFloat(el.style.left);
  const top = Number.parseFloat(el.style.top);
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
  const world = el.closest("[data-ov1-world]");
  const ww = Math.max(world?.offsetWidth || 1, 1);
  const wh = Math.max(world?.offsetHeight || 1, 1);
  return {
    x: left + (el.offsetWidth / ww) * 50,
    y: top + (el.offsetHeight / wh) * 50
  };
}

function boxAnchor(box, toward) {
  const dx = toward.x - box.center.x;
  const dy = toward.y - box.center.y;
  const scale = 1 / Math.max(
    Math.abs(dx) / Math.max(box.halfW, 0.5),
    Math.abs(dy) / Math.max(box.halfH, 0.5),
    1
  );
  return { x: box.center.x + dx * scale, y: box.center.y + dy * scale };
}

function clientToWorldCssPercent(clientX, clientY, stage, world) {
  if (!world) return null;
  const stageRect = stage.getBoundingClientRect();
  const mx = clientX - stageRect.left;
  const my = clientY - stageRect.top;
  const layoutX = (mx - canvasPan.x) / canvasZoom;
  const layoutY = (my - canvasPan.y) / canvasZoom;
  const ww = Math.max(world.offsetWidth, 1);
  const wh = Math.max(world.offsetHeight, 1);
  return {
    x: (layoutX / ww) * 100,
    y: (layoutY / wh) * 100
  };
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}
