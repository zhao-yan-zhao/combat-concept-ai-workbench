import { resolveDodafProduct, saveLocalDodafProduct } from "./dodafProductStore.js";
import { resolveOv4SelectedDiagramId, updateOv4DiagramPositions } from "./ov4DiagramStore.js";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const cameras = new Map();

export function createOv4CanvasController({ projectId, getState, render, syncOv4 = async () => {} }) {
  let observer = null;
  return {
    bind(root) {
      observer?.disconnect();
      const board = root.querySelector("[data-ov4-canvas]");
      const stage = board?.querySelector("[data-ov4-stage]");
      const world = board?.querySelector("[data-ov4-world]");
      if (!board || !stage || !world) return;
      const diagramId = board.dataset.diagramId || "";
      const camera = cameras.get(diagramId) || fitCamera(stage, world);
      cameras.set(diagramId, camera);
      applyCamera(world, camera);
      refreshEdges(world);
      root.querySelector("[data-ov4-canvas-fit]")?.addEventListener("click", () => {
        const next = fitCamera(stage, world);
        cameras.set(diagramId, next);
        applyCamera(world, next);
      });
      stage.addEventListener("pointerdown", (event) => pan(event, stage, world, diagramId));
      stage.addEventListener("wheel", (event) => zoom(event, stage, world, diagramId), { passive: false });
      world.querySelectorAll("[data-ov4-node]").forEach((node) => node.addEventListener("pointerdown", (event) => drag(event, node, stage, world, diagramId)));
      observer = new ResizeObserver(() => refreshEdges(world));
      observer.observe(stage);
    }
  };

  function pan(event, stage, world, diagramId) {
    if (event.button !== 0 || !event.isPrimary || event.target.closest("[data-ov4-node],button,input,textarea,label")) return;
    event.preventDefault();
    const camera = cameras.get(diagramId) || { x: 0, y: 0, zoom: 1 };
    const start = { clientX: event.clientX, clientY: event.clientY, x: camera.x, y: camera.y };
    stage.classList.add("is-panning");
    stage.setPointerCapture?.(event.pointerId);
    const move = (pointer) => { camera.x = start.x + pointer.clientX - start.clientX; camera.y = start.y + pointer.clientY - start.clientY; applyCamera(world, camera); };
    const done = () => { stage.classList.remove("is-panning"); stage.removeEventListener("pointermove", move); stage.removeEventListener("pointerup", done); stage.removeEventListener("pointercancel", done); };
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", done);
    stage.addEventListener("pointercancel", done);
  }

  function zoom(event, stage, world, diagramId) {
    event.preventDefault();
    const camera = cameras.get(diagramId) || { x: 0, y: 0, zoom: 1 };
    const rect = stage.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const next = clamp(camera.zoom * (event.deltaY > 0 ? .9 : 1.1), MIN_ZOOM, MAX_ZOOM);
    const wx = (px - camera.x) / camera.zoom;
    const wy = (py - camera.y) / camera.zoom;
    camera.x = px - wx * next;
    camera.y = py - wy * next;
    camera.zoom = next;
    applyCamera(world, camera);
  }

  function drag(event, node, stage, world, diagramId) {
    if (event.button !== 0 || !event.isPrimary) return;
    event.stopPropagation();
    const camera = cameras.get(diagramId) || { zoom: 1 };
    const start = { clientX: event.clientX, clientY: event.clientY, left: Number.parseFloat(node.style.left), top: Number.parseFloat(node.style.top) };
    let moved = false;
    node.setPointerCapture?.(event.pointerId);
    const move = (pointer) => {
      const dx = pointer.clientX - start.clientX;
      const dy = pointer.clientY - start.clientY;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      node.classList.add("is-dragging");
      const x = clamp((start.left / 100) * 1000 + (dx / (camera.zoom * Math.max(world.offsetWidth, 1))) * 1000, 20, 980);
      const y = clamp((start.top / 100) * 1000 + (dy / (camera.zoom * Math.max(world.offsetHeight, 1))) * 1000, 20, 980);
      node.style.left = `${x / 10}%`;
      node.style.top = `${y / 10}%`;
      node.dataset.logicalX = String(Math.round(x));
      node.dataset.logicalY = String(Math.round(y));
      refreshEdges(world);
    };
    const done = () => {
      node.classList.remove("is-dragging");
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", done);
      node.removeEventListener("pointercancel", done);
      if (!moved) return;
      const state = getState();
      const model = resolveDodafProduct(state, "ov4").model;
      const diagrams = model.diagrams || [];
      const selectedId = diagramId || resolveOv4SelectedDiagramId(state, diagrams);
      const positions = [...world.querySelectorAll("[data-ov4-node]")].map((item) => ({ roleId: item.dataset.ov4Node, x: Number(item.dataset.logicalX), y: Number(item.dataset.logicalY) }));
      const next = updateOv4DiagramPositions(model, selectedId, positions);
      state.ov4 = saveLocalDodafProduct("ov4", next, projectId);
      void syncOv4(state.ov4, { source: "ov4-canvas" });
      render();
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", done);
    node.addEventListener("pointercancel", done);
  }
}

function refreshEdges(world) {
  const positions = new Map([...world.querySelectorAll("[data-ov4-node]")].map((node) => [node.dataset.ov4Node, { x: Number(node.dataset.logicalX), y: Number(node.dataset.logicalY) }]));
  world.querySelectorAll("[data-ov4-edge]").forEach((edge) => { const source = positions.get(edge.dataset.sourceId); const target = positions.get(edge.dataset.targetId); if (source && target) edge.setAttribute("d", orthogonalPath(source, target)); });
}
function orthogonalPath(source, target) { if (Math.abs(target.y - source.y) < 100) { const direction = target.x >= source.x ? 1 : -1; return `M ${source.x + 92 * direction} ${source.y} L ${target.x - 92 * direction} ${target.y}`; } const direction = target.y >= source.y ? 1 : -1; const startY = source.y + 42 * direction; const endY = target.y - 42 * direction; const railY = (startY + endY) / 2; return `M ${source.x} ${startY} L ${source.x} ${railY} L ${target.x} ${railY} L ${target.x} ${endY}`; }
function fitCamera(stage, world) { const zoom = clamp(Math.min(stage.clientWidth / Math.max(world.offsetWidth, 1), stage.clientHeight / Math.max(world.offsetHeight, 1)) * .92, MIN_ZOOM, 1); return { zoom, x: (stage.clientWidth - world.offsetWidth * zoom) / 2, y: (stage.clientHeight - world.offsetHeight * zoom) / 2 }; }
function applyCamera(world, camera) { world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
