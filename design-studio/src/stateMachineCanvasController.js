/**
 * State-machine flowchart canvas interaction (pan/zoom/drag/link).
 * Scoped to `.sm-ov1-canvas` / `.sm-flow-canvas` so it never fights the real OV-1 controller.
 * Visuals are UML-style; data hooks still use data-ov1-* for shared geometry helpers.
 */
import {
  OV1_COORD_MAX,
  OV1_COORD_MIN
} from "./ov1Canvas.js";
import { resolveDodafProduct, saveLocalDodafProduct } from "./dodafProductStore.js";
import {
  addOv6bState,
  addOv6bTransition,
  resolveOv6bSelectedMachineId,
  updateOv6bCanvasLayout
} from "./ov6Workbench.js";
import { routeSmFlowEdges } from "./stateMachineFlowRouting.js";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

let canvasPan = { x: 0, y: 0 };
let canvasZoom = 1;
let shouldFitCamera = true;
let lastMachineId = "";

export function resetStateMachineCamera() {
  canvasPan = { x: 0, y: 0 };
  canvasZoom = 1;
  shouldFitCamera = true;
  lastMachineId = "";
}

export function createStateMachineCanvasController({
  projectId,
  getState,
  render,
  notify = () => {},
  syncOv6b = async () => {}
}) {
  let resizeObserver = null;

  return {
    bind(root) {
      resizeObserver?.disconnect();
      const board = root.querySelector(".sm-ov1-canvas");
      const stage = board?.querySelector("[data-ov1-stage]") || board;
      const world = board?.querySelector("[data-ov1-world]");
      const refreshEdges = () => {
        if (stage) refreshConceptEdges(stage);
      };
      if (board && stage) {
        const machineId = board.dataset.machineId || "";
        if (machineId && machineId !== lastMachineId) {
          lastMachineId = machineId;
          shouldFitCamera = true;
        }
        if (shouldFitCamera) fitCameraToWorld(stage, world);
        applyWorldTransform(world);
        refreshEdges();
        root.querySelector("[data-sm-canvas-fit]")?.addEventListener("click", () => {
          fitCameraToWorld(stage, world);
          applyWorldTransform(world);
          refreshEdges();
        });
        resizeObserver = new ResizeObserver(refreshEdges);
        resizeObserver.observe(stage);
        if (world) resizeObserver.observe(world);

        stage.querySelectorAll("[data-ov1-port]").forEach((port) => {
          port.addEventListener("pointerdown", (event) => startLink(event, board, stage, world, port, refreshEdges));
        });
        stage.querySelectorAll("[data-ov1-node]").forEach((element) => {
          element.addEventListener("pointerdown", (event) => dragNode(event, stage, element, refreshEdges));
        });
        stage.querySelectorAll("[data-ov1-edge], [data-ov1-edge-label]").forEach((element) => {
          element.addEventListener("pointerdown", (event) => selectTransition(event, element));
        });
        stage.addEventListener("pointerdown", (event) => panCanvas(event, board, stage, world, refreshEdges));
        stage.addEventListener("wheel", (event) => zoomCanvas(event, stage, world, refreshEdges), { passive: false });
      }
      root.querySelectorAll("[data-sm-palette]").forEach((element) => {
        element.addEventListener("pointerdown", (event) => startPaletteDrag(event, board, stage, world, element));
      });
    }
  };

  function currentMachine() {
    const state = getState();
    const model = resolveDodafProduct(state, "ov6b").model;
    const machines = model.stateMachines || [];
    const id = resolveOv6bSelectedMachineId(state, machines);
    return machines.find((item) => item.id === id) || null;
  }

  function persistModel(next, toast = "") {
    const state = getState();
    state.ov6b = saveLocalDodafProduct("ov6b", next, projectId);
    void syncOv6b(state.ov6b, { source: "state-machine-canvas" });
    if (toast) notify(toast);
    render();
  }

  function selectTransition(event, element) {
    if (event.button !== 0 || !event.isPrimary) return;
    const edgeId = element.dataset.ov1Edge || element.dataset.ov1EdgeLabel;
    if (!edgeId) return;
    event.preventDefault();
    event.stopPropagation();
    const state = getState();
    state.ov6bSelectedTransitionId = edgeId;
    state.ov6bSelectedStateId = "";
    state.ov6bToolsOpen = true;
    state.ov6bEditorOpen = true;
    state.stateMachineChatOpen = false;
    render();
  }

  function panCanvas(event, board, stage, world, refreshEdges) {
    if (event.button !== 0 || !event.isPrimary) return;
    if (event.target.closest("[data-ov1], [data-ov1-port], [data-ov1-node], [data-ov1-edge], [data-ov1-edge-label], .sm-flow-node, .sm-flow-port, .sm-flow-edge-label, .dodaf-legend, button, a, input, select, textarea, label")) return;
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
    if (!world) return;
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
    const sourceId = port.dataset.sourceId;
    const machine = currentMachine();
    if (!sourceId || !machine) return;
    event.preventDefault();
    event.stopPropagation();

    const sourceNode = resolveNodeElement(stage, sourceId);
    const svg = stage.querySelector(".ov1-concept-lines");
    if (!sourceNode || !svg) return;

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
        notify("在另一状态上松开以建立转换");
        return;
      }
      const state = getState();
      const model = resolveDodafProduct(state, "ov6b").model;
      const exists = (currentMachine()?.transitions || []).some(
        (item) => item.fromStateRef === sourceId && item.toStateRef === targetId
      );
      if (exists) {
        notify("该转换已存在");
        return;
      }
      const next = addOv6bTransition(model, machine.id, {
        fromStateRef: sourceId,
        toStateRef: targetId,
        condition: "新转换条件"
      });
      state.ov6bSelectedTransitionId = next._createdTransitionId || "";
      state.ov6bSelectedStateId = "";
      state.ov6bToolsOpen = true;
      state.ov6bEditorOpen = true;
      state.stateMachineChatOpen = false;
      persistModel(next, "已建立状态转换");
    };

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
      stage.removeEventListener("pointercancel", cleanup);
      stage.releasePointerCapture?.(event.pointerId);
      refreshEdges();
    };

    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", finish);
    stage.addEventListener("pointercancel", cleanup);
  }

  function dragNode(event, stage, element, refreshEdges) {
    if (event.button !== 0 || !event.isPrimary) return;
    if (event.target.closest("[data-ov1-port]")) return;
    const machine = currentMachine();
    const nodeId = element.dataset.ov1Node || element.dataset.ov1;
    if (!machine || !nodeId) return;
    event.preventDefault();
    event.stopPropagation();

    const world = stage.querySelector("[data-ov1-world]");
    const originLeft = Number.parseFloat(element.style.left);
    const originTop = Number.parseFloat(element.style.top);
    if (!world || !Number.isFinite(originLeft) || !Number.isFinite(originTop)) return;

    const start = { x: event.clientX, y: event.clientY };
    let moved = false;
    let settled = false;
    let lastPointer = event;
    let frame = 0;
    element.classList.add("is-dragging");
    element.querySelector(".sm-flow-node")?.classList.add("is-dragging");
    element.setPointerCapture?.(event.pointerId);

    const applyPointer = (pointer) => {
      if (!pointer || !Number.isFinite(pointer.clientX) || !Number.isFinite(pointer.clientY)) return;
      const ww = Math.max(world.offsetWidth, 1);
      const wh = Math.max(world.offsetHeight, 1);
      const nextLeft = originLeft + ((pointer.clientX - start.x) / (ww * canvasZoom)) * 100;
      const nextTop = originTop + ((pointer.clientY - start.y) / (wh * canvasZoom)) * 100;
      element.style.left = `${nextLeft}%`;
      element.style.top = `${nextTop}%`;
      const logical = worldCssToLogical(nextLeft, nextTop, world);
      element.dataset.logicalX = logical.x;
      element.dataset.logicalY = logical.y;
    };

    const move = (pointer) => {
      lastPointer = pointer;
      if (!moved && Math.hypot(pointer.clientX - start.x, pointer.clientY - start.y) < 3) return;
      moved = true;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        applyPointer(lastPointer);
        refreshEdges();
      });
    };

    const finish = (pointer) => {
      if (settled) return;
      settled = true;
      if (frame) cancelAnimationFrame(frame);
      cleanup();
      const state = getState();
      state.ov6bSelectedStateId = nodeId;
      state.ov6bSelectedTransitionId = "";
      state.ov6bToolsOpen = true;
      state.ov6bEditorOpen = true;
      state.stateMachineChatOpen = false;
      if (!moved) {
        render();
        return;
      }
      applyPointer((pointer?.type === "pointerup" ? pointer : lastPointer) || pointer);
      const model = resolveDodafProduct(state, "ov6b").model;
      const next = updateOv6bCanvasLayout(model, machine.id, {
        canvasLayout: "manual",
        positions: collectWorldNodePositions(stage)
      });
      persistModel(next, "状态位置已更新");
    };

    const cleanup = () => {
      element.classList.remove("is-dragging");
      element.querySelector(".sm-flow-node")?.classList.remove("is-dragging");
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", finish);
      element.removeEventListener("pointercancel", finish);
      element.removeEventListener("lostpointercapture", finish);
      element.releasePointerCapture?.(event.pointerId);
    };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", finish);
    element.addEventListener("pointercancel", finish);
    element.addEventListener("lostpointercapture", finish);
  }

  function startPaletteDrag(event, board, stage, world, element) {
    if (event.button !== 0 || !event.isPrimary) return;
    if (element.disabled) return;
    const tool = element.dataset.smPalette;
    if (tool === "delete") return;
    const machine = currentMachine();
    if (!machine) {
      notify("请先选择状态机");
      return;
    }

    const start = { x: event.clientX, y: event.clientY };
    let moved = false;
    let settled = false;
    let ghost = null;
    let lastPointer = event;
    let sourceId = "";
    element.setPointerCapture?.(event.pointerId);

    const updateHover = (pointer) => {
      lastPointer = pointer;
      const overCanvas = isPointerOverCanvas(pointer, stage);
      stage?.classList.toggle("is-palette-target", overCanvas);
      board?.classList.toggle("is-palette-target", overCanvas);
      if (tool === "transition") {
        const hoverId = nodeIdAtPoint(pointer);
        if (!sourceId && hoverId) sourceId = hoverId;
        stage?.querySelectorAll(".is-link-hover, .is-link-source").forEach((el) => {
          el.classList.remove("is-link-hover", "is-link-source");
        });
        if (sourceId) resolveNodeElement(stage, sourceId)?.classList.add("is-link-source");
        if (hoverId && hoverId !== sourceId) resolveNodeElement(stage, hoverId)?.classList.add("is-link-hover");
      }
      if (ghost) {
        ghost.style.left = `${pointer.clientX}px`;
        ghost.style.top = `${pointer.clientY}px`;
        ghost.classList.toggle("is-over-canvas", overCanvas);
      }
    };

    const move = (pointer) => {
      if (!moved && Math.hypot(pointer.clientX - start.x, pointer.clientY - start.y) < 5) return;
      if (!moved) {
        moved = true;
        event.preventDefault();
        element.classList.add("is-palette-dragging");
        ghost = createPaletteGhost(tool);
        document.body.appendChild(ghost);
      }
      updateHover(pointer);
    };

    const finish = (pointer) => {
      if (settled) return;
      settled = true;
      const finalPointer = pointer?.type === "pointerup" ? pointer : lastPointer;
      cleanup();
      if (!moved) return;
      suppressNextClick(element);
      if (tool === "transition") {
        const targetId = nodeIdAtPoint(finalPointer);
        if (!sourceId || !targetId || sourceId === targetId) {
          notify("请从起始状态拖到另一个状态");
          return;
        }
        dropPaletteTransition(machine, sourceId, targetId);
        return;
      }
      if (!isPointerOverCanvas(finalPointer, stage) || !world) return;
      dropPaletteState(tool, finalPointer, world, machine);
    };

    const cleanup = () => {
      element.classList.remove("is-palette-dragging");
      board?.classList.remove("is-palette-target");
      stage?.classList.remove("is-palette-target");
      stage?.querySelectorAll(".is-link-hover, .is-link-source").forEach((el) => {
        el.classList.remove("is-link-hover", "is-link-source");
      });
      ghost?.remove();
      ghost = null;
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", finish);
      element.removeEventListener("pointercancel", finish);
      element.releasePointerCapture?.(event.pointerId);
    };

    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", finish);
    element.addEventListener("pointercancel", finish);
  }

  function dropPaletteState(tool, pointer, world, machine) {
    const kind = tool === "decision" ? "decision" : "normal";
    const logical = pointerToLogical(pointer, world);
    const state = getState();
    const model = resolveDodafProduct(state, "ov6b").model;
    const priorIds = new Set((machine.states || []).map((item) => item.id));
    const next = addOv6bState(model, machine.id, {
      kind,
      x: logical.x,
      y: logical.y,
      insertTransitionId: kind === "decision" ? state.ov6bSelectedTransitionId : ""
    });
    const created = (next.stateMachines || []).find((item) => item.id === machine.id)
      ?.states?.find((item) => !priorIds.has(item.id));
    const placed = created
      ? updateOv6bCanvasLayout(next, machine.id, {
        canvasLayout: "manual",
        positions: [{ id: created.id, x: logical.x, y: logical.y }]
      })
      : next;
    if (created) state.ov6bSelectedStateId = created.id;
    state.ov6bSelectedTransitionId = "";
    state.ov6bToolsOpen = true;
    state.ov6bEditorOpen = true;
    state.stateMachineChatOpen = false;
    persistModel(placed, kind === "decision" ? "已放置判定框" : "已放置中间态");
  }

  function dropPaletteTransition(machine, sourceId, targetId) {
    const exists = (machine.transitions || []).some(
      (item) => item.fromStateRef === sourceId && item.toStateRef === targetId
    );
    if (exists) {
      notify("该转换已存在");
      return;
    }
    const state = getState();
    const model = resolveDodafProduct(state, "ov6b").model;
    const next = addOv6bTransition(model, machine.id, {
      fromStateRef: sourceId,
      toStateRef: targetId,
      condition: "新转换条件"
    });
    state.ov6bSelectedTransitionId = next._createdTransitionId || "";
    state.ov6bSelectedStateId = "";
    state.ov6bToolsOpen = true;
    state.ov6bEditorOpen = true;
    state.stateMachineChatOpen = false;
    persistModel(next, "已建立状态转换");
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
  const stageWidth = stage.clientWidth;
  const stageHeight = stage.clientHeight;
  const worldWidth = world.offsetWidth;
  const worldHeight = world.offsetHeight;
  const availableWidth = Math.max(1, stageWidth - 48);
  const availableHeight = Math.max(1, stageHeight - 48);
  const zoom = clampNumber(
    Math.min(1, availableWidth / Math.max(worldWidth, 1), availableHeight / Math.max(worldHeight, 1)),
    MIN_ZOOM,
    MAX_ZOOM
  );
  canvasZoom = zoom;
  canvasPan = {
    x: (stageWidth - worldWidth * zoom) / 2,
    y: (stageHeight - worldHeight * zoom) / 2
  };
  shouldFitCamera = false;
}

function collectWorldNodePositions(stage) {
  const world = stage.querySelector("[data-ov1-world]");
  return [...stage.querySelectorAll("[data-ov1-node]")].map((el) => {
    const left = Number.parseFloat(el.style.left);
    const top = Number.parseFloat(el.style.top);
    const logical = Number.isFinite(left) && Number.isFinite(top)
      ? worldCssToLogical(left, top, world)
      : { x: el.dataset.logicalX || "50%", y: el.dataset.logicalY || "50%" };
    return { id: el.dataset.ov1Node, x: logical.x, y: logical.y };
  }).filter((item) => item.id);
}

function worldCssToLogical(leftPct, topPct, world) {
  const minX = Number.parseFloat(world?.dataset.worldMinX);
  const minY = Number.parseFloat(world?.dataset.worldMinY);
  const width = Number.parseFloat(world?.dataset.worldWidth);
  const height = Number.parseFloat(world?.dataset.worldHeight);
  const x = (Number.isFinite(minX) ? minX : 0) + (leftPct / 100) * (Number.isFinite(width) && width > 0 ? width : 100);
  const y = (Number.isFinite(minY) ? minY : 0) + (topPct / 100) * (Number.isFinite(height) && height > 0 ? height : 100);
  return {
    x: `${clampNumber(x, OV1_COORD_MIN, OV1_COORD_MAX)}%`,
    y: `${clampNumber(y, OV1_COORD_MIN, OV1_COORD_MAX)}%`
  };
}

function refreshConceptEdges(stage) {
  const world = stage.querySelector("[data-ov1-world]");
  if (!world) return;
  const ww = Math.max(world.offsetWidth, 1);
  const wh = Math.max(world.offsetHeight, 1);
  const boxes = new Map();
  stage.querySelectorAll("[data-ov1-node]").forEach((element) => {
    const box = nodeCssBox(element, ww, wh);
    if (box) boxes.set(element.dataset.ov1Node, { ...box, id: element.dataset.ov1Node });
  });
  const edges = [...stage.querySelectorAll(".sm-flow-edge[data-ov1-edge], .ov1-concept-edge[data-ov1-edge]")].map((path) => {
    const sourceBox = boxes.get(path.dataset.sourceId);
    const isDecisionBranch = path.dataset.isDecisionBranch === "true" || sourceBox?.shape === "diamond";
    return {
      id: path.dataset.ov1Edge,
      sourceId: path.dataset.sourceId,
      targetId: path.dataset.targetId,
      type: path.dataset.edgeType,
      isDecisionBranch
    };
  });
  // Prefer flowchart router: nodes are center-anchored.
  const geometryById = routeSmFlowEdges(edges, boxes);
  const updatedLabels = new Set();
  stage.querySelectorAll("[data-ov1-edge]:not([data-ov1-link-draft])").forEach((path) => {
    const geometry = geometryById.get(path.dataset.ov1Edge);
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

function isPointerOverCanvas(pointer, stage) {
  if (!pointer || !stage) return false;
  const rect = stage.getBoundingClientRect();
  return pointer.clientX >= rect.left
    && pointer.clientX <= rect.right
    && pointer.clientY >= rect.top
    && pointer.clientY <= rect.bottom;
}

function nodeIdAtPoint(pointer) {
  const under = document.elementFromPoint(pointer.clientX, pointer.clientY);
  const node = under?.closest?.("[data-ov1-node], [data-ov1]");
  return node?.dataset?.ov1Node || node?.dataset?.ov1 || "";
}

function pointerToLogical(pointer, world) {
  if (!world) return { x: "50%", y: "50%" };
  const rect = world.getBoundingClientRect();
  const leftPct = ((pointer.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
  const topPct = ((pointer.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
  return worldCssToLogical(leftPct, topPct, world);
}

function createPaletteGhost(tool) {
  const ghost = document.createElement("div");
  ghost.className = `sm-palette-ghost kind-${tool === "decision" ? "decision" : tool === "transition" ? "transition" : "normal"}`;
  ghost.textContent = tool === "decision" ? "判定" : tool === "transition" ? "转换" : "状态";
  ghost.setAttribute("aria-hidden", "true");
  return ghost;
}

function suppressNextClick(element) {
  const block = (event) => {
    event.preventDefault();
    event.stopPropagation();
    element.removeEventListener("click", block, true);
  };
  element.addEventListener("click", block, true);
  window.setTimeout(() => element.removeEventListener("click", block, true), 400);
}

/**
 * Flowchart nodes use left/top as the visual center (translate -50%).
 * Measure the actual node button when present for accurate border anchors.
 */
function nodeCssBox(el, worldW, worldH) {
  if (!el) return null;
  const left = Number.parseFloat(el.style.left);
  const top = Number.parseFloat(el.style.top);
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
  const body = el.querySelector(".sm-flow-node") || el;
  const halfW = Math.max(1.1, ((body.offsetWidth || el.offsetWidth) / worldW) * 50);
  const halfH = Math.max(1, ((body.offsetHeight || el.offsetHeight) / worldH) * 50);
  return {
    halfW,
    halfH,
    shape: el.classList.contains("kind-decision") ? "diamond" : "rect",
    // Center-positioned nodes: style left/top already point at center.
    center: { x: left, y: top }
  };
}

function nodeCssCenter(el) {
  const left = Number.parseFloat(el.style.left);
  const top = Number.parseFloat(el.style.top);
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
  return { x: left, y: top };
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
