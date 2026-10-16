import { computeExchangeCurve } from "./ov2Canvas.js";

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.2;
const ZOOM_STEP = 0.12;
const DRAG_THRESHOLD = 4;

export function createOv2CanvasController({ getState, render } = {}) {
  const camera = { x: 0, y: 0, zoom: 1 };
  let hasFitted = false;

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function applyCamera(world, zoomLabel = null) {
    if (!world) return;
    world.style.transformOrigin = "0 0";
    world.style.transform = `translate3d(${camera.x.toFixed(1)}px, ${camera.y.toFixed(1)}px, 0) scale(${camera.zoom.toFixed(2)})`;
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round(camera.zoom * 100)}%`;
    }
  }

  function fitCanvas(stage, world, zoomLabel = null) {
    if (!stage || !world) return;
    const stageWidth = stage.clientWidth || 900;
    const stageHeight = stage.clientHeight || 600;
    const worldWidth = Number.parseFloat(world.style.width) || world.offsetWidth || 1200;
    const worldHeight = Number.parseFloat(world.style.height) || world.offsetHeight || 800;

    const pad = 36;
    const zoomX = (stageWidth - pad * 2) / worldWidth;
    const zoomY = (stageHeight - pad * 2) / worldHeight;
    const zoom = clamp(Math.min(zoomX, zoomY), MIN_ZOOM, 1.15);

    camera.zoom = Math.round(zoom * 100) / 100;
    camera.x = Math.round((stageWidth - worldWidth * camera.zoom) / 2);
    camera.y = Math.round(Math.max(16, (stageHeight - worldHeight * camera.zoom) / 2));
    applyCamera(world, zoomLabel);
  }

  function updateConnectedCurves(nodeId, newX, newY, world) {
    const nodeEl = world.querySelector(`[data-ov2-node="${nodeId}"]`);
    if (!nodeEl) return;

    // Find all edges where sourceId === nodeId or targetId === nodeId
    world.querySelectorAll(`.ov2-flow-edge-group`).forEach((group) => {
      const edgeId = group.dataset.edgeId;
      const hitPath = group.querySelector("path[data-ov2-exchange]");
      const styledPath = group.querySelector(".ov2-flow-line");
      const labelBtn = world.querySelector(`[data-ov2-exchange="${edgeId}"]:not(path)`);
      if (!hitPath || !styledPath) return;

      const sourceId = group.dataset.sourceId;
      const targetId = group.dataset.targetId;

      if (sourceId !== nodeId && targetId !== nodeId) return;

      const srcEl = world.querySelector(`[data-ov2-node="${sourceId}"]`);
      const tgtEl = world.querySelector(`[data-ov2-node="${targetId}"]`);
      if (!srcEl || !tgtEl) return;

      const sx = Number.parseFloat(srcEl.style.left) || 0;
      const sy = Number.parseFloat(srcEl.style.top) || 0;
      const tx = Number.parseFloat(tgtEl.style.left) || 0;
      const ty = Number.parseFloat(tgtEl.style.top) || 0;

      const sourcePos = { x: sx, y: sy, col: Math.round(sx / 290) };
      const targetPos = { x: tx, y: ty, col: Math.round(tx / 290) };

      const curve = computeExchangeCurve(sourcePos, targetPos);
      hitPath.setAttribute("d", curve.path);
      styledPath.setAttribute("d", curve.path);

      if (labelBtn) {
        labelBtn.style.left = `${curve.mx.toFixed(1)}px`;
        labelBtn.style.top = `${curve.my.toFixed(1)}px`;
      }
    });
  }

  return {
    bind(root = document) {
      const frame = root.querySelector(".ov2-canvas-frame");
      if (!frame) return;

      const stage = frame.querySelector(".ov2-canvas-stage");
      const world = frame.querySelector(".ov2-canvas-world");
      if (!stage || !world) return;

      const zoomLabel = root.querySelector("[data-ov2-zoom-label]");

      // Initial auto-fit if not fitted yet
      if (!hasFitted) {
        hasFitted = true;
        requestAnimationFrame(() => fitCanvas(stage, world, zoomLabel));
      } else {
        applyCamera(world, zoomLabel);
      }

      // 1. Pan on empty stage space
      stage.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        if (event.target.closest("[data-ov2-node], button, input, select, textarea, label")) return;

        event.preventDefault();
        const startX = event.clientX;
        const startY = event.clientY;
        const initCamX = camera.x;
        const initCamY = camera.y;
        let moved = false;

        stage.classList.add("is-panning");
        frame.classList.add("is-panning");

        const move = (e) => {
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
          moved = true;
          camera.x = initCamX + dx;
          camera.y = initCamY + dy;
          applyCamera(world, zoomLabel);
        };

        const stop = () => {
          stage.classList.remove("is-panning");
          frame.classList.remove("is-panning");
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", stop);
          window.removeEventListener("pointercancel", stop);
        };

        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", stop);
        window.addEventListener("pointercancel", stop);
      });

      // 2. Zoom on mouse wheel
      stage.addEventListener("wheel", (event) => {
        event.preventDefault();
        const rect = stage.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        const factor = event.deltaY < 0 ? (1 + ZOOM_STEP) : (1 - ZOOM_STEP);
        const nextZoom = clamp(camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);

        if (Math.abs(nextZoom - camera.zoom) < 0.001) return;

        // Zoom relative to cursor point
        const wx = (px - camera.x) / camera.zoom;
        const wy = (py - camera.y) / camera.zoom;
        camera.x = px - wx * nextZoom;
        camera.y = py - wy * nextZoom;
        camera.zoom = Math.round(nextZoom * 100) / 100;

        applyCamera(world, zoomLabel);
      }, { passive: false });

      // 3. Zoom / Fit button actions
      root.querySelectorAll("[data-ov2-zoom]").forEach((btn) => {
        if (btn.dataset.zoomBound === "1") return;
        btn.dataset.zoomBound = "1";
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const action = btn.dataset.ov2Zoom;
          if (action === "fit") {
            fitCanvas(stage, world, zoomLabel);
          } else if (action === "in") {
            camera.zoom = clamp(camera.zoom + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
            applyCamera(world, zoomLabel);
          } else if (action === "out") {
            camera.zoom = clamp(camera.zoom - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
            applyCamera(world, zoomLabel);
          }
        });
      });

      // 4. Reset layout button action
      const layoutBtn = root.querySelector("[data-ov2-canvas-layout]");
      if (layoutBtn && layoutBtn.dataset.layoutBound !== "1") {
        layoutBtn.dataset.layoutBound = "1";
        layoutBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const state = getState();
          delete state.ov2NodePositions;
          render();
          requestAnimationFrame(() => fitCanvas(stage, world, zoomLabel));
        });
      }

      // 5. Drag nodes
      world.querySelectorAll("[data-ov2-node]").forEach((nodeEl) => {
        const nodeId = nodeEl.dataset.ov2Node;
        if (!nodeId) return;

        nodeEl.addEventListener("pointerdown", (event) => {
          if (event.button !== 0 || !event.isPrimary) return;
          if (event.target.closest("button, input, select, textarea, a")) return;

          event.preventDefault();
          event.stopPropagation();

          const startLeft = Number.parseFloat(nodeEl.style.left) || 100;
          const startTop = Number.parseFloat(nodeEl.style.top) || 100;
          const startX = event.clientX;
          const startY = event.clientY;
          let moved = false;

          nodeEl.classList.add("is-dragging");

          const move = (e) => {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
            moved = true;

            const nextX = Math.round(startLeft + dx / camera.zoom);
            const nextY = Math.round(startTop + dy / camera.zoom);

            nodeEl.style.left = `${nextX}px`;
            nodeEl.style.top = `${nextY}px`;

            updateConnectedCurves(nodeId, nextX, nextY, world);
          };

          const stop = () => {
            nodeEl.classList.remove("is-dragging");
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", stop);
            window.removeEventListener("pointercancel", stop);

            if (moved) {
              const state = getState();
              if (!state.ov2NodePositions) state.ov2NodePositions = {};
              state.ov2NodePositions[nodeId] = {
                x: Number.parseFloat(nodeEl.style.left) || startLeft,
                y: Number.parseFloat(nodeEl.style.top) || startTop
              };
            } else {
              // Clicked without dragging -> select node
              const state = getState();
              state.ov2SelectedNodeId = state.ov2SelectedNodeId === nodeId ? "" : nodeId;
              render();
            }
          };

          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", stop);
          window.addEventListener("pointercancel", stop);
        });
      });
    }
  };
}
