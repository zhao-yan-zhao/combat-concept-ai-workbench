import { getViewMeta, renderBriefSidebar, renderInspector } from "../ui.js";

/** OV-1 editors now use the right slide panel; keep the legacy modal closed. */
export function closeOv1ModalIfOpen($) {
  const dialog = $("#ov1Dialog");
  if (!dialog) return;
  if (dialog.open) dialog.close();
  if (dialog.innerHTML) dialog.innerHTML = "";
}

export function ensureOv1ToolsDocked(state) {
  state.ov1ToolsOpen = true;
}

export function openOv1SidePanel(mode, nodeId = null, edgeId = null, state) {
  ensureOv1ToolsDocked(state);
  state.ov1Dialog = null;
  state.ov1PanelOpen = true;
  state.ov1InspectorCollapsed = false;
  state.ov1PanelMode = mode;
  state.ov1PanelNodeId = mode === "node" ? nodeId : null;
  state.ov1PanelEdgeId = mode === "relations" ? edgeId : null;
}

export function closeOv1SidePanel(state) {
  state.ov1Dialog = null;
  state.ov1PanelOpen = false;
  state.ov1InspectorCollapsed = true;
  state.ov1PanelMode = "context";
  state.ov1PanelNodeId = null;
  state.ov1PanelEdgeId = null;
}

export function toggleOv1ToolsRail(state) {
  if (state.ov1ToolsOpen) {
    state.ov1ToolsOpen = false;
    closeOv1SidePanel(state);
    return;
  }
  ensureOv1ToolsDocked(state);
}

export function toggleOv1SidePanelMode(mode, state) {
  ensureOv1ToolsDocked(state);
  const current = state.ov1PanelMode || "context";
  if (state.ov1PanelOpen && current === mode) {
    closeOv1SidePanel(state);
    return;
  }
  openOv1SidePanel(
    mode,
    mode === "node" ? state.ov1PanelNodeId || state.selection?.id : null,
    mode === "relations" ? state.ov1PanelEdgeId : null,
    state
  );
}

/**
 * Render the right inspector panel based on active view and current selection.
 */
export function renderInspectorPanel(ctx) {
  const { state, $, getModels } = ctx;

  if (state.activeView === "brief") {
    const previousDirectionPanel = document.querySelector(".direction-panel");
    if (previousDirectionPanel) state.directionPanelOpen = previousDirectionPanel.open;
    const eyebrow = document.querySelector(".inspector-header .eyebrow");
    if (eyebrow) eyebrow.textContent = "研究基线";
    $("#inspectorTitle").textContent = "研究简报";
    $("#inspectorStatus").textContent = "可编辑";
    $("#inspectorStatus").className = "status-tag";
    $("#inspectorRoot").innerHTML = renderBriefSidebar(state);
  } else if (state.activeView === "concept-map" || state.activeView === "ov1") {
    $("#inspectorRoot").innerHTML = "";
  } else {
    const inspectorSelection = state.selection;
    const title = inspectorSelection?.title || getViewMeta(state.activeView)?.label || "上下文";
    const eyebrow = document.querySelector(".inspector-header .eyebrow");
    if (eyebrow) eyebrow.textContent = "详细信息";
    const status = inspectorSelection?.status || "建模中";
    $("#inspectorTitle").textContent = title;
    $("#inspectorStatus").textContent = status;
    $("#inspectorStatus").className = `status-tag ${status.includes("问题") ? "alert" : status.includes("建模") ? "review" : ""}`;
    try {
      $("#inspectorRoot").innerHTML = renderInspector(inspectorSelection, { ...getModels(), activeView: state.activeView });
    } catch (err) {
      console.error("renderInspector error:", err);
      $("#inspectorRoot").innerHTML = `<div class="inspector-section"><p class="muted">无法渲染检查器：${err?.message || "未知错误"}</p></div>`;
    }
  }

  // Optional floating knowledge panel (menu). Keep separate from docked brief sidebar.
  const dialog = $("#contextPanelDialog");
  if (!dialog) return;
  if (!dialog.dataset.bound) {
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      state.contextPanelOpen = false;
      if (dialog.open) dialog.close();
    });
    dialog.dataset.bound = "true";
  }
  if (state.contextPanelOpen) {
    const body = $("#contextPanelBody");
    const title = $("#contextPanelTitle");
    const status = $("#contextPanelStatus");
    const eyebrow = $("#contextPanelEyebrow");
    if (eyebrow) eyebrow.textContent = "知识与上下文";
    if (title) title.textContent = getViewMeta(state.activeView)?.label || "上下文";
    if (status) {
      status.textContent = state.selection?.status || "查阅";
      status.className = "status-tag";
    }
    if (body) {
      body.innerHTML = renderInspector(state.activeView === "ov1" ? null : state.selection, {
        ...getModels(),
        activeView: state.activeView
      });
    }
    dialog.hidden = false;
    if (!dialog.open) dialog.showModal();
  } else if (dialog.open) {
    dialog.close();
    dialog.hidden = true;
  }
}
