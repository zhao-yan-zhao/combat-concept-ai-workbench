import { resolveDodafProduct, saveLocalDodafProduct } from "./dodafProductStore.js";
import { resolveOv4SelectedDiagramId, updateOv4DiagramPositions } from "./ov4DiagramStore.js";
import { routeSmFlowEdges } from "./stateMachineFlowRouting.js";
import { layoutOv4Topology } from "./ov4View.js";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3.5;
const DRAG_THRESHOLD = 5;

const cameras = new Map();

function safeSetPointerCapture(target, pointerId) {
  try {
    if (typeof pointerId === "number" && target?.setPointerCapture) {
      target.setPointerCapture(pointerId);
    }
  } catch {}
}

function safeReleasePointerCapture(target, pointerId) {
  try {
    if (typeof pointerId === "number" && target?.releasePointerCapture) {
      target.releasePointerCapture(pointerId);
    }
  } catch {}
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function createOv4CanvasController({
  projectId,
  getState,
  render,
  notify = () => {},
  syncOv4 = async () => {}
}) {
  let observer = null;

  return {
    bind(root) {
      observer?.disconnect();
      const board = root.querySelector("[data-ov4-canvas]");
      const stage = board?.querySelector("[data-ov4-stage]");
      const world = board?.querySelector("[data-ov4-world]");
      if (!board || !stage || !world) return;

      const diagramId = board.dataset.diagramId || "default";
      let camera = cameras.get(diagramId);
      if (!camera) {
        camera = fitCamera(stage, world);
        cameras.set(diagramId, camera);
      }

      applyCamera(world, camera);
      refreshEdges(stage);

      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => {
          if (!cameras.has(diagramId)) {
            const next = fitCamera(stage, world);
            cameras.set(diagramId, next);
            applyCamera(world, next);
          }
          refreshEdges(stage);
        });
      }

      // Fit camera
      root.querySelector("[data-ov4-canvas-fit]")?.addEventListener("click", () => {
        const next = fitCamera(stage, world);
        cameras.set(diagramId, next);
        applyCamera(world, next);
        refreshEdges(stage);
      });

      // Adaptive Auto Layout
      root.querySelector("[data-ov4-canvas-layout]")?.addEventListener("click", () => {
        const state = getState();
        const model = resolveDodafProduct(state, "ov4").model;
        const diagrams = model.diagrams || [];
        const currentDiagramId = diagramId || resolveOv4SelectedDiagramId(state, diagrams);
        const diagram = diagrams.find((d) => d.id === currentDiagramId);
        if (!diagram) return;

        const roleIds = new Set(diagram.roleIds || []);
        const roles = (model.roles || []).filter((r) => roleIds.has(r.id));
        const relations = (model.relations || []).filter(
          (rel) => roleIds.has(rel.sourceRoleId) && roleIds.has(rel.targetRoleId)
        );

        const newLayout = layoutOv4Topology(roles, relations);
        const newPositions = [...newLayout.positions.values()].map((p) => ({
          roleId: p.id,
          x: p.x,
          y: p.y
        }));

        const nextModel = updateOv4DiagramPositions(model, currentDiagramId, newPositions);
        state.ov4 = saveLocalDodafProduct("ov4", nextModel, projectId);
        void syncOv4(state.ov4, { source: "ov4-canvas-auto-layout" });

        // Update world dimensions dynamically before fitting camera
        world.style.width = `${newLayout.worldWidth}px`;
        world.style.height = `${newLayout.worldHeight}px`;

        const resetCam = fitCamera(stage, world);
        cameras.set(currentDiagramId, resetCam);
        if (typeof notify === "function") notify("已完成组织架构自适应排版");
        render();
      });

      // Legend relation filters
      root.querySelectorAll("[data-relation-filter]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          const filter = button.dataset.relationFilter || "all";
          const state = getState();
          state.ov4RelationFilter = filter;
          render();
        });
      });

      // Canvas pan & zoom
      stage.addEventListener("pointerdown", (event) => panCanvas(event, board, stage, world, diagramId));
      stage.addEventListener("wheel", (event) => zoomCanvas(event, stage, world, diagramId), { passive: false });

      // Node drag & click
      world.querySelectorAll("[data-ov4-node]").forEach((nodeEl) => {
        nodeEl.addEventListener("pointerdown", (event) => dragNode(event, nodeEl, stage, world, diagramId));
      });

      // Edge click & Label click
      stage.querySelectorAll("[data-ov4-edge], [data-ov4-edge-label]").forEach((element) => {
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          const state = getState();
          state.ov4ToolsOpen = true;
          state.ov4EditorOpen = true;
          render();
        });
      });

      observer = new ResizeObserver(() => refreshEdges(stage));
      observer.observe(stage);
      if (world) observer.observe(world);
    }
  };

  function panCanvas(event, board, stage, world, diagramId) {
    if (event.button !== 0 || !event.isPrimary) return;
    if (event.target.closest("[data-ov4-node], button, input, select, textarea, label")) return;

    event.preventDefault();
    const camera = cameras.get(diagramId) || { x: 0, y: 0, zoom: 1 };
    const start = { clientX: event.clientX, clientY: event.clientY, x: camera.x, y: camera.y };
    let moved = false;
    let settled = false;

    board?.classList.add("is-panning");
    stage.classList.add("is-panning");
    safeSetPointerCapture(stage, event.pointerId);

    const move = (pointer) => {
      const dx = pointer.clientX - start.clientX;
      const dy = pointer.clientY - start.clientY;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      camera.x = start.x + dx;
      camera.y = start.y + dy;
      applyCamera(world, camera);
    };

    const cleanup = () => {
      if (settled) return;
      settled = true;
      board?.classList.remove("is-panning");
      stage.classList.remove("is-panning");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      stage.removeEventListener("lostpointercapture", cleanup);
      safeReleasePointerCapture(stage, event.pointerId);

      if (!moved) {
        const state = getState();
        if (state.ov4SelectedRoleId) {
          state.ov4SelectedRoleId = "";
          render();
        }
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
    stage.addEventListener("lostpointercapture", cleanup);
  }

  function zoomCanvas(event, stage, world, diagramId) {
    event.preventDefault();
    const camera = cameras.get(diagramId) || { x: 0, y: 0, zoom: 1 };
    const rect = stage.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    const nextZoom = clamp(camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(nextZoom - camera.zoom) < 0.001) return;

    const wx = (px - camera.x) / camera.zoom;
    const wy = (py - camera.y) / camera.zoom;
    camera.x = px - wx * nextZoom;
    camera.y = py - wy * nextZoom;
    camera.zoom = nextZoom;
    applyCamera(world, camera);
  }

  function dragNode(event, nodeEl, stage, world, diagramId) {
    if (event.button !== 0 || !event.isPrimary) return;
    if (event.target.closest("select, input, textarea, a")) return;

    event.preventDefault();
    event.stopPropagation();

    const camera = cameras.get(diagramId) || { zoom: 1 };
    const startLeft = Number.parseFloat(nodeEl.style.left) || 100;
    const startTop = Number.parseFloat(nodeEl.style.top) || 100;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    let settled = false;

    safeSetPointerCapture(nodeEl, event.pointerId);

    const move = (pointer) => {
      const dx = pointer.clientX - startX;
      const dy = pointer.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!moved) {
        moved = true;
        nodeEl.classList.add("is-dragging");
        nodeEl.querySelector(".ov4-org-role")?.classList.add("is-dragging");
        stage.classList.add("is-node-dragging");
      }

      const worldW = Math.max(world.offsetWidth, 400);
      const worldH = Math.max(world.offsetHeight, 400);
      const dxWorld = dx / camera.zoom;
      const dyWorld = dy / camera.zoom;

      const nextLeft = clamp(startLeft + dxWorld, 30, worldW - 30);
      const nextTop = clamp(startTop + dyWorld, 30, worldH - 30);

      nodeEl.style.left = `${nextLeft}px`;
      nodeEl.style.top = `${nextTop}px`;
      nodeEl.dataset.logicalX = String(Math.round(nextLeft));
      nodeEl.dataset.logicalY = String(Math.round(nextTop));

      refreshEdges(stage);
    };

    const cleanup = () => {
      if (settled) return;
      settled = true;
      nodeEl.classList.remove("is-dragging");
      nodeEl.querySelector(".ov4-org-role")?.classList.remove("is-dragging");
      stage.classList.remove("is-node-dragging");

      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      nodeEl.removeEventListener("lostpointercapture", cleanup);
      safeReleasePointerCapture(nodeEl, event.pointerId);

      if (!moved) {
        // Just clicked: toggle selection and focus subgraph!
        const roleId = nodeEl.dataset.ov4Node;
        const state = getState();
        state.ov4SelectedRoleId = state.ov4SelectedRoleId === roleId ? "" : roleId;
        state.ov4ToolsOpen = true;
        state.ov4EditorOpen = true;
        render();
        return;
      }

      // Moved: save positions
      const state = getState();
      const model = resolveDodafProduct(state, "ov4").model;
      const diagrams = model.diagrams || [];
      const selectedId = diagramId || resolveOv4SelectedDiagramId(state, diagrams);
      const positions = [...world.querySelectorAll("[data-ov4-node]")].map((item) => ({
        roleId: item.dataset.ov4Node,
        x: Number.parseFloat(item.style.left) || Number(item.dataset.logicalX) || 100,
        y: Number.parseFloat(item.style.top) || Number(item.dataset.logicalY) || 100
      }));

      const next = updateOv4DiagramPositions(model, selectedId, positions);
      state.ov4 = saveLocalDodafProduct("ov4", next, projectId);
      void syncOv4(state.ov4, { source: "ov4-canvas" });
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
    nodeEl.addEventListener("lostpointercapture", cleanup);
  }

  function refreshEdges(stage) {
    const world = stage.querySelector("[data-ov4-world]");
    if (!world) return;

    const ww = Math.max(world.offsetWidth, 400);
    const wh = Math.max(world.offsetHeight, 400);
    const boxes = new Map();

    stage.querySelectorAll("[data-ov4-node]").forEach((element) => {
      const leftPx = Number.parseFloat(element.style.left);
      const topPx = Number.parseFloat(element.style.top);
      if (!Number.isFinite(leftPx) || !Number.isFinite(topPx)) return;

      const roleCard = element.querySelector(".ov4-org-role") || element;
      const elW = roleCard.offsetWidth || 220;
      const elH = roleCard.offsetHeight || 86;

      // Convert pixel center and half-extents to percentage (0-100) space for orthogonal routing
      const centerXPct = (leftPx / ww) * 100;
      const centerYPct = (topPx / wh) * 100;
      const halfWPct = (elW / 2 / ww) * 100;
      const halfHPct = (elH / 2 / wh) * 100;

      boxes.set(element.dataset.ov4Node, {
        id: element.dataset.ov4Node,
        center: { x: centerXPct, y: centerYPct },
        halfW: Math.max(1.2, halfWPct),
        halfH: Math.max(1.2, halfHPct),
        shape: "rect"
      });
    });

    const edges = [...stage.querySelectorAll("[data-ov4-edge]:not(.ov4-org-relation-hit)")].map((path) => ({
      id: path.dataset.ov4Edge,
      sourceId: path.dataset.sourceId,
      targetId: path.dataset.targetId
    }));

    const routes = routeSmFlowEdges(edges, boxes);
    const updatedLabels = new Set();

    stage.querySelectorAll("[data-ov4-edge]").forEach((path) => {
      const edgeId = path.dataset.ov4Edge;
      const route = routes.get(edgeId);
      if (!route) return;

      path.setAttribute("d", route.path);
      if (route.backward) {
        path.classList.add("is-backward");
      } else {
        path.classList.remove("is-backward");
      }

      if (!updatedLabels.has(edgeId)) {
        updatedLabels.add(edgeId);
        const label = stage.querySelector(`[data-ov4-edge-label="${CSS.escape(edgeId)}"]`);
        if (label) {
          label.style.left = `${route.label.x}%`;
          label.style.top = `${route.label.y}%`;
          if (route.backward) {
            label.classList.add("is-backward");
          } else {
            label.classList.remove("is-backward");
          }
        }
      }
    });
  }

  function fitCamera(stage, world) {
    if (!stage || !world) return { zoom: 1, x: 0, y: 0 };
    const stageWidth = Math.max(stage.clientWidth, 300);
    const stageHeight = Math.max(stage.clientHeight, 300);
    const worldWidth = Math.max(world.offsetWidth, 400);
    const worldHeight = Math.max(world.offsetHeight, 400);

    const zoom = clamp(
      Math.min((stageWidth - 48) / worldWidth, (stageHeight - 48) / worldHeight),
      MIN_ZOOM,
      1.0
    );

    return {
      zoom,
      x: (stageWidth - worldWidth * zoom) / 2,
      y: (stageHeight - worldHeight * zoom) / 2
    };
  }

  function applyCamera(world, camera) {
    if (!world || !camera) return;
    world.style.transformOrigin = "0 0";
    world.style.transform = `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`;
  }
}
