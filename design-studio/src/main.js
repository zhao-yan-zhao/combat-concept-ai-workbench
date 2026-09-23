import { directions, project, views, workflowPhases } from "./data.js";
import { createInitialWorkbenchState } from "./app/createInitialState.js";
import { workflowPrimaryStepIds } from "./data.js";
import { $, downloadArtifact as downloadArtifactHelper, downloadBlob, escapeHtml, showToast, writePrintableReport as writePrintableReportHelper } from "./app/domUtils.js";
import { completedWorkflowStage, currentProjectTitle as currentProjectTitleFor, currentWorkflow as currentWorkflowFor, getWorkflowStageIncompleteReasons, nextWorkflowStage, renderWorkflowGate as renderWorkflowGateFor, resolveWorkflowGateContext } from "./app/workflowGate.js";
import { wireControllers } from "./app/wireControllers.js";
import { deriveOodaFromOv5, getOodaDuration, persistOodaModel } from "./oodaStore.js";
import { buildStructureReviewExport } from "./structureReviewExport.js";
import { addActivity, addEdge, deleteActivity, deleteEdge, persistOv5Model, updateActivity } from "./ov5Store.js";
import { countUnmappedOv5Activities, linkOv5ActivitiesToOv1, suggestOv1SourcesForActivity } from "./ov5Ov1Linker.js";
import { applyMappingQuality } from "./ov5MappingQuality.js";
import { markScenarioStale, persistScenario } from "./scenarioStore.js";
import { getViewMeta, renderBriefSidebar, renderInspector, renderTree, renderView, selectionFor } from "./ui.js";
import { clearValidation, markValidationStale, persistValidation } from "./validationStore.js";
import { clearRedTeamReview } from "./redTeamStore.js";
import { renderCollaborationLoginGate } from "./collaborationView.js";
import { buildExportArtifact, buildExportArtifactFromPayload, buildReportPayload } from "./reportBuilder.js";
import { deleteReportVersion, persistReportVersions, saveReportVersion, upsertReportVersion } from "./reportVersionStore.js";
import { saveReportTemplate } from "./reportTemplateStore.js";
import { requestReportDocx, requestReportPdf, requestReportPptx } from "./reportDocumentClient.js";
import { createReportIntegrity, verifyReportIntegrity } from "./reportIntegrity.js";
import { areConceptBriefsEqual, saveConceptBrief } from "./briefStore.js";
import { saveInspirationSession } from "./inspirationStore.js";
import { buildDirectionProposals, saveCustomDirections, saveSelectedDirection } from "./directionProposalStore.js";
import { deriveResearchChatBriefUpdate } from "./researchChatBriefUpdate.js";
import { saveOv1Model } from "./ov1Store.js";
import { renderOv1ToolboxFloatButton } from "./ov1View.js";
import { contextualFlowViewIds, mountRelatedModelReturn, relatedViewLabel, renderRelatedModelReturn, resolveModelFocus, resolveRelatedMainViewId } from "./contextualModelFlow.js";
import { renderSequenceToolboxFloatButton } from "./ov6cView.js";
import { renderStateMachineToolboxFloatButton } from "./stateMachineView.js";
import { renderOv4ToolboxFloatButton } from "./ov4View.js";
import { renderSubflowToolboxFloatButton } from "./subflowToolbox.js";
import { mountGroupedLists } from "./groupedListTemplate.js";

import { deleteModelSnapshot, persistModelSnapshots, saveModelSnapshot, snapshotContextFromState, upsertModelSnapshot } from "./modelSnapshotStore.js";
import { restoreModelSnapshot } from "./modelSnapshotRestore.js";
import { buildModelComparisonArtifact } from "./modelComparisonBuilder.js";
import { renderAiConfigPanel } from "./aiConfigView.js";
import { renderAiPromptPanel } from "./aiPromptView.js";
import { getCmoCatalogStatus } from "./cmoCatalogClient.js";
import { applyTheme, getThemeConfig } from "./themeConfigClient.js";
import { renderProjectStorageFooter } from "./projectStorageView.js";
import { createProject, deleteProject, loadProjects, updateProject } from "./projectBriefClient.js";
import { renderProjectManager, renderProjectEntry } from "./projectManagerView.js";
import { normalizeConceptMap, persistConceptMap } from "./conceptMapStore.js";
import { normalizeForceMissionPlan, persistForceMission } from "./forceMissionStore.js";
import { normalizePhaseActionConcept, persistPhaseAction } from "./phaseActionStore.js";
import { normalizeConceptGraphicPlan, persistConceptGraphic } from "./conceptGraphicStore.js";

const { state, projectBriefSeed, activeProjectId } = createInitialWorkbenchState();
let busyOverlayTimer = 0;
let busyOverlayKey = "";
let busyOverlayStartedAt = 0;

const {
  oodaController,
  ov1Controller,
  traceabilityController,
  ov1AiController,
  ov1CanvasController,
  ov5CanvasController,
  projectOv5SyncController,
  projectForceMissionSyncController,
  projectPhaseActionSyncController,
  projectConceptMapSyncController,
  projectConceptGraphicSyncController,
  projectOv1SyncController,
  projectOodaSyncController,
  projectScenarioSyncController,
  projectValidationSyncController,
  projectKnowledgeSyncController,
  projectReportArchiveSyncController,
  projectModelSnapshotSyncController,
  projectBriefSyncController,
  dodafProductController,
  ov5AiController,
  oodaAiController,
  modelSnapshotController,
  scenarioController,
  simulationAdapterController,
  validationController,
  knowledgeController,
  briefController,
  inspirationAdviceController,
  aiDirectionController,
  obsidianArchiveController,
  redTeamController,
  aiConfigController,
  aiPromptController,
  deploymentController,
  conceptMapController,
  conceptPlanningController,
  phaseActionChatController,
  forceMissionChatController,
  ruleLibraryChatController,
  sequenceChatController,
  sequenceCanvasController,
  ov1bCanvasController,
  stateMachineChatController,
  stateMachineCanvasController,
  ov4CanvasController,
  researchChatProjectSync,
  collaborationController
} = wireControllers({
  state,
  activeProjectId,
  projectBriefSeed,
  project,
  $,
  showToast,
  render,
  getModels,
  select,
  downloadArtifact,
  invalidateDerivedArtifacts,
  invalidateConceptMapDependents,
  invalidateValidation,
  invalidateRedTeam,
  applyRemoteBrief,
  applyRemoteForceMission,
  applyRemotePhaseAction,
  applyRemoteConceptMap,
  applyRemoteConceptGraphic,
  applyRemoteOv5,
  applyRemoteOv1,
  applyRemoteOoda,
  applyRemoteScenario,
  applyRemoteValidation,
  applyRemoteKnowledge,
  applyRemoteReportArchives,
  upsertRemoteReportArchive,
  removeRemoteReportArchive,
  applyRemoteModelSnapshots,
  upsertRemoteModelSnapshot,
  removeRemoteModelSnapshot,
  restoreLocalBriefConflictDraft,
  restoreLocalForceMissionConflictDraft,
  restoreLocalPhaseActionConflictDraft,
  restoreLocalConceptMapConflictDraft,
  restoreLocalConceptGraphicConflictDraft,
  restoreLocalOv5ConflictDraft,
  restoreLocalOv1ConflictDraft,
  restoreLocalOodaConflictDraft,
  restoreLocalScenarioConflictDraft,
  restoreLocalValidationConflictDraft,
  applyResearchChatBriefUpdate,
  restoreSnapshot,
  exportModelComparison,
  hydrateProjectDirectory,
  completeCurrentWorkflowStage: completeWorkflowStage
});

let textCompositionActive = false;
let deferredRenderOptions = null;

document.addEventListener("compositionstart", () => {
  textCompositionActive = true;
}, true);

document.addEventListener("compositionend", () => {
  textCompositionActive = false;
  if (!deferredRenderOptions) return;
  const options = deferredRenderOptions;
  deferredRenderOptions = null;
  requestAnimationFrame(() => render(options));
}, true);

function render(options = {}) {
  if (textCompositionActive) {
    deferredRenderOptions = deferredRenderOptions
      ? { ...deferredRenderOptions, ...options, skipViewRoot: Boolean(deferredRenderOptions.skipViewRoot && options.skipViewRoot) }
      : { ...options };
    return;
  }
  const appFocusSnapshot = captureViewFocus(document);
  const appScrollSnapshots = captureViewScroll(document);
  const meta = getViewMeta(state.activeView);
  const conceptTreeMarkup = renderTree(state.activeView, currentWorkflow(), state);
  const conceptTreeElem = $("#conceptTree");
  if (conceptTreeElem && conceptTreeElem.dataset.renderedMarkup !== conceptTreeMarkup) {
    conceptTreeElem.innerHTML = conceptTreeMarkup;
    conceptTreeElem.dataset.renderedMarkup = conceptTreeMarkup;
  }
  $("#viewEyebrow").textContent = meta.subtitle;
  $("#viewTitle").textContent = meta.label;
  $("#viewContext").title = `${currentProjectTitle()} / ${meta.label}`;
  $("#projectStorageState").innerHTML = renderProjectStorageFooter(state.projectStorage);
  $("#projectManagerRoot").innerHTML = renderProjectManager({ directory: state.projectDirectory, activeProjectId: state.activeProjectId, open: state.projectManagerOpen, createOpen: state.projectCreateOpen, isLead: state.collaboration?.session?.actor?.roles?.includes("lead") });
  const identityButton = $("#collaborationIdentityBtn");
  const actor = state.collaboration?.session?.actor;
  const workflowTestModeButton = $("#workflowTestModeBtn");
  const saveVersionButton = $("#saveVersionBtn");
  const testModeActive = currentWorkflow().mode === "free";
  const modeSwitching = Boolean(state.workflowModeSwitching);
  const reportArchiving = Boolean(state.reportArchiving);
  const busyOverlay = getBusyOverlayState();
  $("#adminEntry").hidden = !actor?.roles?.includes("lead");
  identityButton.textContent = actor ? `账号 · ${actor.label}` : "账号管理";
  identityButton.title = actor ? `账号管理 · ${actor.label}` : "打开协同账号管理";
  identityButton.classList.toggle("is-authenticated", Boolean(actor));
  workflowTestModeButton.classList.toggle("is-active", testModeActive);
  workflowTestModeButton.classList.toggle("is-busy", modeSwitching);
  workflowTestModeButton.setAttribute("aria-checked", String(testModeActive));
  workflowTestModeButton.disabled = modeSwitching || reportArchiving;
  workflowTestModeButton.title = modeSwitching
    ? "正在切换模式…"
    : (testModeActive ? "退出测试模式，恢复阶段门禁" : "启用测试模式，所有阶段可自由访问");
  if (saveVersionButton) {
    saveVersionButton.disabled = reportArchiving || modeSwitching;
    saveVersionButton.classList.toggle("is-busy", reportArchiving);
    saveVersionButton.textContent = reportArchiving ? "保存中…" : "保存版本";
    saveVersionButton.title = reportArchiving ? "正在保存报告版本…" : "保存当前研究成果为报告归档版本";
  }
  updateBusyOverlay(busyOverlay);
  const authenticated = Boolean(state.collaboration?.session?.authenticated);
  const projectEntry = authenticated && state.projectEntryRequired;
  $("#studioShell").classList.toggle("is-login-locked", !authenticated || projectEntry);
  if (projectEntry) $("#projectManagerRoot").innerHTML = "";
  $("#studioShell").classList.toggle("is-mode-switching", Boolean(busyOverlay));
  $("#studioShell").classList.toggle("brief-view", state.activeView === "brief");
  $("#studioShell").classList.toggle("ov1-view", state.activeView === "ov1");
  $("#studioShell").classList.toggle("concept-map-focus", state.activeView === "concept-map");
  // Legacy ov1-focus (inspector collapse) no longer used for OV-1 tools drawer.
  $("#studioShell").classList.remove("ov1-focus");
  const ov1Toggle = document.querySelector(".ov1-sidebar-toggle");
  if (ov1Toggle) ov1Toggle.hidden = true;
  const loginGate = $("#loginGate");
  loginGate.hidden = authenticated && !projectEntry;
  const loginMarkup = projectEntry ? renderProjectEntry({ directory: state.projectDirectory, createOpen: state.projectCreateOpen }) : authenticated ? "" : renderCollaborationLoginGate(state.collaboration);
  if (projectEntry || loginGate.dataset.renderedMarkup !== loginMarkup) {
    loginGate.innerHTML = loginMarkup;
    loginGate.dataset.renderedMarkup = loginMarkup;
  }
  $("#aiConfigRoot").innerHTML = renderAiConfigPanel({ open: state.aiConfigOpen, service: state.aiConfig, saving: state.aiConfigSaving });
  $("#aiPromptRoot").innerHTML = renderAiPromptPanel({ open: state.aiPromptOpen, catalog: state.aiPromptCatalog, selectedId: state.aiPromptSelectedId, saving: state.aiPromptSaving });
  $("#workflowGateRoot").innerHTML = renderWorkflowGate();
  renderOv1ToolboxFloatHost();
  // Project picker / menubar chrome toggles must not rebuild the concept-map iframe.
  if (!options.skipViewRoot) {
    if (!state.projectEntryRequired) {
      renderViewRoot(options);
      renderInspectorPanel();
    }
    resizeBriefTextareas();
    closeOv1ModalIfOpen();
    bindDynamicEvents();
  }
  restoreViewFocus(document, appFocusSnapshot);
  restoreViewScroll(document, appScrollSnapshots);
}

/**
 * Scroll containers that should not jump when the view re-renders
 * (phase switch, select force unit, chat open/close, etc.).
 */
const VIEW_SCROLL_PRESERVE_SELECTORS = [
  ".ai-prompt-list",
  ".grouped-list-items",
  ".ov1b-decomposition-scroll",
  ".force-mission-main-stage",
  ".force-mission-phase-list",
  ".force-roster-list",
  ".force-concept-detail-body",
  ".force-composition-table-wrap",
  ".phase-detail-body",
  ".phase-chain-list",
  ".phase-main-stage",
  ".phase-chat-dock .research-chat-body",
  ".phase-chat-dock .phase-review-chat-messages",
  // State machine workbench: keep list/editor position when switching machines
  ".sm-machine-list",
  ".sm-editor",
  ".sm-state-list",
  ".sm-transition-list",
  ".sm-editor-dock",
  ".sm-chat-dock .research-chat-body",
  ".sm-main-panel"
];

/** Inner content panes reset on phase change; outer reading position stays. */
const VIEW_SCROLL_PHASE_RESET_SELECTORS = [
  ".phase-detail-body",
  ".force-roster-list",
  ".force-composition-table-wrap"
];

function captureViewScroll(root) {
  if (!root) return [];
  const snapshots = [];
  for (const selector of VIEW_SCROLL_PRESERVE_SELECTORS) {
    root.querySelectorAll(selector).forEach((node, index) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.scrollTop || node.scrollLeft) {
        snapshots.push({
          selector,
          index,
          top: node.scrollTop,
          left: node.scrollLeft
        });
      }
    });
  }
  const workspace = document.querySelector(".studio-workspace");
  if (workspace instanceof HTMLElement && (workspace.scrollTop || workspace.scrollLeft)) {
    snapshots.push({
      selector: ".studio-workspace",
      index: 0,
      top: workspace.scrollTop,
      left: workspace.scrollLeft,
      global: true
    });
  }
  return snapshots;
}

function restoreViewScroll(root, snapshots = [], { resetInnerPhaseScroll = false } = {}) {
  const apply = () => {
    for (const item of snapshots) {
      if (resetInnerPhaseScroll && VIEW_SCROLL_PHASE_RESET_SELECTORS.includes(item.selector)) {
        continue;
      }
      const scope = item.global ? document : root;
      if (!scope) continue;
      const nodes = scope.querySelectorAll(item.selector);
      const node = nodes[item.index];
      if (!(node instanceof HTMLElement)) continue;
      node.scrollTop = item.top;
      node.scrollLeft = item.left;
    }
    if (resetInnerPhaseScroll && root) {
      for (const selector of VIEW_SCROLL_PHASE_RESET_SELECTORS) {
        root.querySelectorAll(selector).forEach((node) => {
          if (node instanceof HTMLElement) {
            node.scrollTop = 0;
            node.scrollLeft = 0;
          }
        });
      }
    }
  };
  apply();
  // Second pass after layout/paint (expanded detail, dual columns).
  requestAnimationFrame(apply);
}

/**
 * Re-render the active view. Concept-map iframe is NOT inside the HTML string —
 * it lives in a persistent host and is re-attached after each render so opening
 * the project picker / toasts never reloads combat-map-web.
 */
function renderViewRoot(options = {}) {
  const viewRoot = $("#viewRoot");
  if (!viewRoot) return;
  const scrollSnapshots = captureViewScroll(viewRoot);
  const focusSnapshot = captureViewFocus(viewRoot);
  // Park iframe before wiping viewRoot so the node is never destroyed with innerHTML.
  parkConceptMapFrame();
  viewRoot.innerHTML = renderView(state.activeView, { ...state, oodaDuration: getOodaDuration(state.ooda) });
  mountRelatedModelReturn(viewRoot, renderRelatedModelReturn(state));
  mountConceptMapFrame();
  mountGroupedLists(viewRoot);
  restoreViewFocus(viewRoot, focusSnapshot);
  restoreViewScroll(viewRoot, scrollSnapshots, {
    resetInnerPhaseScroll: Boolean(options.resetInnerPhaseScroll)
  });
}

function captureViewFocus(root) {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !root.contains(active)) return null;
  if (!active.matches("input, textarea, select")) return null;
  const scope = active.closest("form[id]") || root;
  const controls = [...scope.querySelectorAll("input, textarea, select")];
  const index = controls.indexOf(active);
  if (index < 0) return null;
  return {
    scopeId: scope instanceof HTMLElement ? scope.id : "",
    index,
    tagName: active.tagName,
    type: active.getAttribute("type") || "",
    id: active.id || "",
    name: active.getAttribute("name") || "",
    value: active.value,
    checked: "checked" in active ? active.checked : undefined,
    selectionStart: typeof active.selectionStart === "number" ? active.selectionStart : null,
    selectionEnd: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
    selectionDirection: active.selectionDirection || "none"
  };
}

function restoreViewFocus(root, snapshot) {
  if (!snapshot) return;
  const scope = snapshot.scopeId ? root.querySelector(`#${CSS.escape(snapshot.scopeId)}`) : root;
  if (!scope) return;
  const controls = [...scope.querySelectorAll("input, textarea, select")];
  let target = snapshot.id ? scope.querySelector(`#${CSS.escape(snapshot.id)}`) : null;
  if (!target && snapshot.name) {
    const candidates = [...scope.querySelectorAll(`[name="${CSS.escape(snapshot.name)}"]`)];
    target = candidates.find((item) => item.tagName === snapshot.tagName && (item.getAttribute("type") || "") === snapshot.type) || null;
  }
  if (!target) target = controls[snapshot.index] || null;
  if (!(target instanceof HTMLElement) || target.tagName !== snapshot.tagName) return;
  if ("value" in target) target.value = snapshot.value;
  if (snapshot.checked !== undefined && "checked" in target) target.checked = snapshot.checked;
  target.focus({ preventScroll: true });
  if (snapshot.selectionStart !== null && typeof target.setSelectionRange === "function") {
    const end = Math.min(snapshot.selectionEnd ?? snapshot.selectionStart, target.value.length);
    target.setSelectionRange(Math.min(snapshot.selectionStart, end), end, snapshot.selectionDirection);
  }
}

function getConceptMapFramePark() {
  return document.getElementById("conceptMapFramePark");
}

function parkConceptMapFrame() {
  const park = getConceptMapFramePark();
  const frame = document.getElementById("conceptMapFrame");
  if (!park || !frame) return;
  if (frame.parentElement !== park) park.appendChild(frame);
  park.hidden = true;
}

/**
 * Attach (or create) the persistent concept-map iframe into the current mount.
 * Only assigns src when the bound map project id changes — never on mere re-render.
 * Moving the iframe node in-DOM does not reload; only setting .src does.
 */
function mountConceptMapFrame() {
  const park = getConceptMapFramePark();
  const mount = document.getElementById("conceptMapFrameMount");
  if (!park) return;

  if (state.activeView !== "concept-map" || !mount) {
    parkConceptMapFrame();
    return;
  }

  const desiredSrc = mount.dataset.frameSrc || "";
  const desiredProject = mount.dataset.mapProjectId || "";
  let frame = document.getElementById("conceptMapFrame");
  if (!frame) {
    frame = document.createElement("iframe");
    frame.id = "conceptMapFrame";
    frame.className = "concept-map-frame";
    frame.title = "作战概念图绘制工具预览";
    frame.referrerPolicy = "strict-origin";
    frame.dataset.mapProjectId = "";
  }

  // Only change src when the bound research→map project changes.
  const boundId = frame.dataset.mapProjectId || "";
  const needsSrc = !frame.getAttribute("src") || boundId !== desiredProject;
  if (needsSrc && desiredSrc) {
    frame.dataset.mapProjectId = desiredProject;
    frame.src = desiredSrc;
  } else if (!boundId && desiredProject) {
    frame.dataset.mapProjectId = desiredProject;
  }

  if (frame.parentElement !== mount) mount.appendChild(frame);
  park.hidden = true;
}

function renderOv1ToolboxFloatHost() {
  const host = $("#ov1ToolboxFloatRoot");
  if (!host) return;
  let html = "";
  if (state.activeView === "ov1" && state.ov1ToolsOpen !== true) html = renderOv1ToolboxFloatButton();
  else if (state.activeView === "ov4" && state.ov4ToolsOpen !== true) html = renderOv4ToolboxFloatButton({ toolsOpen: false });
  else if (state.activeView === "ov6b" && state.ov6bToolsOpen !== true) html = renderStateMachineToolboxFloatButton({ toolsOpen: false });
  else if (state.activeView === "ov6c" && state.ov6cToolsOpen !== true) html = renderSequenceToolboxFloatButton({ toolsOpen: false });
  else html = renderSubflowToolboxFloatButton(state.activeView, state);
  host.hidden = !html;
  if (html) host.removeAttribute("hidden");
  host.innerHTML = html;
}

function resizeBriefTextareas() {
  document.querySelectorAll(".brief-sidebar-editor textarea").forEach(fitBriefTextarea);
}

function fitBriefTextarea(textarea) {
  const maxHeight = 172;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
}

function resetCustomDirectionDialog() {
  const form = document.querySelector("#customDirectionForm");
  if (!form) return;
  form.reset();
  delete form.dataset.editingDirection;
  const heading = form.querySelector("h2");
  if (heading) heading.textContent = "新增方向";
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.textContent = "保存方向";
}

/** OV-1 editors now use the right slide panel; keep the legacy modal closed. */
function closeOv1ModalIfOpen() {
  const dialog = $("#ov1Dialog");
  if (!dialog) return;
  if (dialog.open) dialog.close();
  if (dialog.innerHTML) dialog.innerHTML = "";
}

function ensureOv1ToolsDocked() {
  state.ov1ToolsOpen = true;
}

function openOv1SidePanel(mode, nodeId = null, edgeId = null) {
  ensureOv1ToolsDocked();
  state.ov1Dialog = null;
  state.ov1PanelOpen = true;
  state.ov1InspectorCollapsed = false;
  state.ov1PanelMode = mode;
  state.ov1PanelNodeId = mode === "node" ? nodeId : null;
  state.ov1PanelEdgeId = mode === "relations" ? edgeId : null;
}

function closeOv1SidePanel() {
  state.ov1Dialog = null;
  state.ov1PanelOpen = false;
  state.ov1InspectorCollapsed = true;
  state.ov1PanelMode = "context";
  state.ov1PanelNodeId = null;
  state.ov1PanelEdgeId = null;
}

function toggleOv1ToolsRail() {
  if (state.ov1ToolsOpen) {
    state.ov1ToolsOpen = false;
    // Floating FAB only — collapse expanded panel/tools together.
    closeOv1SidePanel();
    return;
  }
  ensureOv1ToolsDocked();
}

function toggleOv1SidePanelMode(mode) {
  ensureOv1ToolsDocked();
  const current = state.ov1PanelMode || "context";
  if (state.ov1PanelOpen && current === mode) {
    closeOv1SidePanel();
    return;
  }
  openOv1SidePanel(
    mode,
    mode === "node" ? state.ov1PanelNodeId || state.selection?.id : null,
    mode === "relations" ? state.ov1PanelEdgeId : null
  );
}

function renderInspectorPanel() {
  // Docked right rail: brief baseline editor; OV-1/concept-map hide the dock.
  if (state.activeView === "brief") {
    // Preserve direction-panel open state across full re-renders (e.g. selecting a direction).
    const previousDirectionPanel = document.querySelector(".direction-panel");
    if (previousDirectionPanel) state.directionPanelOpen = previousDirectionPanel.open;
    const eyebrow = document.querySelector(".inspector-header .eyebrow");
    if (eyebrow) eyebrow.textContent = "\u7814\u7a76\u57fa\u7ebf";
    $("#inspectorTitle").textContent = "\u7814\u7a76\u7b80\u62a5";
    $("#inspectorStatus").textContent = "\u53ef\u7f16\u8f91";
    $("#inspectorStatus").className = "status-tag";
    $("#inspectorRoot").innerHTML = renderBriefSidebar(state);
  } else if (state.activeView === "concept-map" || state.activeView === "ov1") {
    $("#inspectorRoot").innerHTML = "";
  } else {
    const inspectorSelection = state.selection;
    const title = inspectorSelection?.title || getViewMeta(state.activeView)?.label || "上下文";
    const eyebrow = document.querySelector(".inspector-header .eyebrow");
    if (eyebrow) eyebrow.textContent = "\u8be6\u7ec6\u4fe1\u606f";
    const status = inspectorSelection?.status || "建模中";
    $("#inspectorTitle").textContent = title;
    $("#inspectorStatus").textContent = status;
    $("#inspectorStatus").className = `status-tag ${status.includes("问题") ? "alert" : status.includes("建模") ? "review" : ""}`;
    $("#inspectorRoot").innerHTML = renderInspector(inspectorSelection, { ...getModels(), activeView: state.activeView });
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
    if (eyebrow) eyebrow.textContent = "\u77e5\u8bc6\u4e0e\u4e0a\u4e0b\u6587";
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

function bindDynamicEvents() {
  document.querySelectorAll(".brief-sidebar-editor textarea").forEach((textarea) => textarea.addEventListener("input", () => fitBriefTextarea(textarea)));
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const viewId = button.dataset.view;
      if (!viewId) return;
      const focusType = button.dataset.focusType || "";
      const focusId = button.dataset.focusId || "";
      if (focusType === "task" && focusId) state.operationalTaskSelectedId = focusId;
      if (focusType === "activity" && focusId) state.selection = selectionFor("activity", focusId, getModels());
      if (["state", "transition"].includes(focusType) && focusId) {
        const machine = (state.ov6b?.stateMachines || []).find((item) => (focusType === "state" ? item.states : item.transitions)?.some((entry) => entry.id === focusId));
        if (machine) {
          state.ov6bSelectedMachineId = machine.id;
          state.ov6bSelectedStateId = focusType === "state" ? focusId : "";
          state.ov6bSelectedTransitionId = focusType === "transition" ? focusId : "";
        }
      }
      if (button.dataset.relatedModel === "true") {
        const currentContext = state.relatedModelReturnContext;
        const mainViewId = resolveRelatedMainViewId(state.activeView, viewId, currentContext);
        const continuingFlow = Boolean(currentContext?.mainViewId && currentContext.mainViewId === mainViewId);
        const focus = resolveModelFocus(mainViewId, state);
        state.relatedModelReturnContext = {
          ...(continuingFlow ? currentContext : {}),
          mainViewId,
          mainLabel: currentContext?.mainLabel || getViewMeta(mainViewId)?.label || "主步骤",
          relatedViewId: viewId,
          focusType: focus.focusType || "",
          focusId: focus.focusId || "",
          focusLabel: focus.focusLabel || "",
          selection: continuingFlow ? currentContext.selection || null : state.selection ? { ...state.selection } : null,
          scrollSnapshots: continuingFlow ? currentContext.scrollSnapshots || [] : captureViewScroll($("#viewRoot"))
        };
      } else if (workflowPrimaryStepIds.includes(viewId)) {
        state.relatedModelReturnContext = null;
      }
      closeMenubarMenus();
      // Left floating step rail and menus: same entry path as workflow gate.
      void navigateToResearchView(viewId);
    });
  });

  document.querySelectorAll("[data-return-mainline]").forEach((button) => {
    button.addEventListener("click", () => {
      const context = state.relatedModelReturnContext;
      if (!context?.mainViewId) return;
      state.activeView = context.mainViewId;
      state.selection = context.selection || null;
      state.relatedModelReturnContext = null;
      render();
      requestAnimationFrame(() => restoreViewScroll($("#viewRoot"), context.scrollSnapshots || []));
    });
  });

  document.querySelectorAll("[data-direction]").forEach((button) => {
    button.addEventListener("click", () => {
      state.direction = saveSelectedDirection(button.dataset.direction);
      showToast(`已选择“${state.direction}”方向`);
      void projectBriefSyncController.sync(state.brief, { direction: state.direction, inspiration: state.inspiration, directions: state.customDirections, source: "direction-selection" });
      render();
    });
  });

  document.querySelectorAll("[data-edit-direction]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const item = state.customDirections.find((direction) => direction.title === button.dataset.editDirection);
      const form = document.querySelector("#customDirectionForm");
      const dialog = document.querySelector("#customDirectionDialog");
      if (!item || !form || !dialog) return;
      form.dataset.editingDirection = item.title;
      form.querySelector('[name="title"]').value = item.title;
      form.querySelector('[name="text"]').value = item.text;
      form.querySelector('[name="basis"]').value = item.basis;
      const heading = form.querySelector("h2");
      if (heading) heading.textContent = "编辑方向";
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.textContent = "保存修改";
      dialog.showModal();
    });
  });

  document.querySelectorAll("[data-delete-direction]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const title = button.dataset.deleteDirection;
      state.customDirections = saveCustomDirections(state.customDirections.filter((item) => item.title !== title), { projectId: activeProjectId, defaults: directions });
      if (state.direction === title) {
        const proposals = buildDirectionProposals({ session: state.inspiration, fallbackDirections: directions, aiDirections: state.aiDirections, customDirections: state.customDirections });
        state.direction = saveSelectedDirection(proposals[0]?.title || "");
      }
      void projectBriefSyncController.sync(state.brief, { direction: state.direction, inspiration: state.inspiration, directions: state.customDirections, source: "custom-direction" });
      showToast(`已删除“${title}”方向`);
      render();
    });
  });

  document.querySelector("#customDirectionForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const title = String(values.get("title") || "").trim();
    const text = String(values.get("text") || "").trim();
    const basis = String(values.get("basis") || "").trim();
    const editingTitle = form.dataset.editingDirection || "";
    const candidate = editingTitle
      ? state.customDirections.map((item) => (item.title === editingTitle ? { title, text, basis } : item))
      : [...state.customDirections, { title, text, basis }];
    const next = saveCustomDirections(candidate, { projectId: activeProjectId, defaults: directions });
    if (next.length !== candidate.length || (!editingTitle && next.length === state.customDirections.length)) {
      showToast("请填写名称、概述和研究依据；名称不能重复");
      return;
    }
    state.customDirections = next;
    const selected = editingTitle ? next.find((item) => item.title === title)?.title : next.at(-1)?.title;
    if (state.direction === editingTitle || !editingTitle) state.direction = saveSelectedDirection(selected || state.direction);
    resetCustomDirectionDialog();
    document.querySelector("#customDirectionDialog")?.close();
    void projectBriefSyncController.sync(state.brief, { direction: state.direction, inspiration: state.inspiration, directions: state.customDirections, source: "custom-direction" });
    showToast(editingTitle ? `已更新“${title}”方向` : `已新增并选择“${state.direction}”方向`);
    render();
  });

  document.querySelectorAll("[data-activity]").forEach((button) => {
    button.addEventListener("click", () => select("activity", button.dataset.activity));
  });
  document.querySelectorAll("[data-ov2-exchange]").forEach((button) => {
    button.addEventListener("click", () => select("ov2-exchange", button.dataset.ov2Exchange));
  });
  document.querySelectorAll("[data-ov3-exchange]").forEach((button) => {
    button.addEventListener("click", () => select("ov3-exchange", button.dataset.ov3Exchange));
  });
  document.querySelectorAll("[data-structure-jump]").forEach((button) => {
    button.addEventListener("click", () => jumpFromStructureReview(button.dataset.structureJump, button.dataset.targetKind, button.dataset.targetId));
  });
  document.querySelectorAll("[data-structure-filter-severity]").forEach((button) => {
    button.addEventListener("click", () => {
      state.structureReviewFilter = {
        ...(state.structureReviewFilter || { severity: "all", group: "all" }),
        severity: button.dataset.structureFilterSeverity || "all"
      };
      render();
    });
  });
  document.querySelectorAll("[data-structure-filter-group]").forEach((button) => {
    button.addEventListener("click", () => {
      state.structureReviewFilter = {
        ...(state.structureReviewFilter || { severity: "all", group: "all" }),
        group: button.dataset.structureFilterGroup || "all"
      };
      render();
    });
  });
  document.querySelectorAll("[data-ov4-role]").forEach((button) => button.addEventListener("click", () => select("ov4-role", button.dataset.ov4Role)));
  document.querySelectorAll("[data-ov4-relation]").forEach((button) => button.addEventListener("click", () => select("ov4-relation", button.dataset.ov4Relation)));
  document.querySelectorAll("[data-ov6c-event]").forEach((button) => {
    button.addEventListener("click", () => select("ov6c-event", button.dataset.ov6cEvent));
  });
  document.querySelectorAll("[data-ooda]").forEach((button) => {
    button.addEventListener("click", () => select("ooda", button.dataset.ooda));
  });
  document.querySelectorAll("[data-unit]").forEach((button) => {
    button.addEventListener("click", () => select("unit", button.dataset.unit));
  });
  document.querySelectorAll("[data-validation-issue]").forEach((button) => {
    button.addEventListener("click", () => select("issue", button.dataset.validationIssue));
  });
  document.querySelectorAll("[data-knowledge-result]").forEach((button) => {
    button.addEventListener("click", () => select("knowledge", button.dataset.knowledgeResult));
  });
  document.querySelectorAll("[data-project-switch]").forEach((button) => button.addEventListener("click", () => switchProject(button.dataset.projectSwitch)));
  document.querySelectorAll("[data-project-archive]").forEach((button) => button.addEventListener("click", async () => {
    try { await updateProject(button.dataset.projectArchive, { archived: button.dataset.projectArchived === "true" }); await hydrateProjectDirectory(); } catch { showToast("项目状态更新失败，请确认负责人身份"); }
  }));
  document.querySelectorAll("[data-project-delete]").forEach((button) => button.addEventListener("click", async () => {
    const title = button.dataset.projectTitle || button.dataset.projectDelete;
    if (!window.confirm(`将永久删除项目“${title}”及其所有数据，此操作无法恢复。确定继续吗？`)) return;
    try {
      await deleteProject(button.dataset.projectDelete);
      showToast("已删除项目");
      await hydrateProjectDirectory();
    } catch (error) {
      showToast(error?.status === 403 ? "只有负责人可删除项目" : "项目删除失败：请先归档并确认项目状态");
    }
  }));
  document.querySelector("#projectCreateForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try {
      const result = await createProject({
        id: values.get("id"),
        title: values.get("title"),
        description: values.get("description")
      });
      switchProject(result.project.id);
    } catch (error) {
      showToast(describeProjectCreateError(error));
    }
  });
  traceabilityController.bind(document);
  collaborationController.bind(document);
  simulationAdapterController.bind(document);
  document.querySelectorAll("[data-dodaf-field]").forEach((control) => {
    const commit = () => {
      if (dodafProductController.handleFieldChange(control.dataset.dodafField, control.value)) return;
    };
    control.addEventListener("change", commit);
    if (control.tagName === "TEXTAREA") control.addEventListener("blur", commit);
  });
  document.querySelectorAll("[data-action]").forEach((button) => {
    // Workflow gate uses root-level delegation (survives soft refresh / open toggle).
    if (button.closest("#workflowGateRoot")) return;
    const fire = () => handleAction(button.dataset.action, button);
    if (button.matches("input, select, textarea")) {
      button.addEventListener("change", fire);
      return;
    }
    button.addEventListener("click", fire);
  });
  document.querySelectorAll("[data-export]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.export === "docx") {
        exportWordReport();
        return;
      }
      if (button.dataset.export === "pdf") {
        exportPdfReport();
        return;
      }
      if (button.dataset.export === "pptx") {
        exportPptxReport();
        return;
      }
      exportArtifact(button.dataset.export);
    });
  });
  document.querySelectorAll("[data-report-template]").forEach((control) => {
    control.addEventListener("change", () => {
      state.reportTemplate = saveReportTemplate(control.value);
      render();
    });
  });
  document.querySelectorAll("[data-version-export]").forEach((button) => {
    button.addEventListener("click", () => exportReportVersion(button.dataset.versionExport, button.dataset.versionId));
  });
  document.querySelectorAll("[data-version-verify]").forEach((button) => {
    button.addEventListener("click", () => void verifyArchivedReportVersion(button.dataset.versionVerify));
  });
  document.querySelectorAll("[data-version-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteArchivedReportVersion(button.dataset.versionDelete));
  });
  bindInspectorEvents();
  aiConfigController.bind(document);
  aiPromptController.bind(document);
  inspirationAdviceController.bind(document);
  phaseActionChatController.bind(document);
  forceMissionChatController.bind(document);
  ruleLibraryChatController.bind(document);
  sequenceChatController.bind(document);
  stateMachineChatController.bind(document);
  aiDirectionController.bind(document);
  ov1Controller.bind(document);
  ov1CanvasController.bind(document);
  stateMachineCanvasController.bind(document);
  ov4CanvasController.bind(document);
  sequenceCanvasController.bind(document);
  ov1bCanvasController.bind(document);
  ov5CanvasController.bind(document);
  briefController.bind(document);
  oodaController.bind(document);
  knowledgeController.bind(document);
  deploymentController.bind(document);
  conceptMapController.bind(document);
  conceptPlanningController.bind(document);
  modelSnapshotController.bind(document);
}

function bindInspectorEvents() {
  document.querySelectorAll("[data-inspector-action=delete-activity]").forEach((button) => {
    button.addEventListener("click", () => {
      const deleted = deleteActivity(state.ov5, state.selection?.id);
      if (deleted) invalidateDerivedArtifacts();
      if (deleted) void projectOv5SyncController.sync(state.ov5, { source: "manual" });
      state.selection = null;
      showToast(deleted ? "活动及其关联已删除" : "至少保留一个活动节点");
      render();
    });
  });
  document.querySelectorAll("[data-inspector-action=edit]").forEach((button) => {
    button.addEventListener("click", () => showToast("已将当前节点标记为待修订"));
  });
  $("#ov5ActivityForm")?.addEventListener("submit", saveActivity);
  $("#ov5EdgeForm")?.addEventListener("submit", saveEdge);
  bindOv1SourcePicker($("#ov5ActivityForm"));
  document.querySelectorAll("[data-edge-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const exists = state.ov5.edges.some((edge) => edge.id === button.dataset.edgeRemove);
      deleteEdge(state.ov5, button.dataset.edgeRemove);
      invalidateDerivedArtifacts();
      if (exists) void projectOv5SyncController.sync(state.ov5, { source: "manual" });
      showToast("活动关联已移除");
      render();
    });
  });
}

function bindOv1SourcePicker(form) {
  if (!form) return;
  const refresh = () => refreshOv1SourcePicker(form);
  form.querySelectorAll('input[name="sourceOv1NodeIds"]').forEach((input) => {
    input.addEventListener("change", refresh);
  });
  form.querySelector("[data-ov1-source-clear]")?.addEventListener("click", () => {
    form.querySelectorAll('input[name="sourceOv1NodeIds"]').forEach((input) => {
      input.checked = false;
    });
    refresh();
    showToast("已清空来源选择，保存活动后生效");
  });
  form.querySelector("[data-ov1-source-suggest]")?.addEventListener("click", () => {
    const activityId = form.querySelector("[data-ov1-source-suggest]")?.dataset.ov1SourceSuggest || state.selection?.id;
    const activity = state.ov5.activities.find((item) => item.id === activityId);
    if (!activity) return;
    const suggested = new Set(suggestOv1SourcesForActivity(activity, state.ov1));
    if (!suggested.size) {
      showToast("未能根据活动类型给出总体图建议，请手工多选");
      return;
    }
    form.querySelectorAll('input[name="sourceOv1NodeIds"]').forEach((input) => {
      input.checked = suggested.has(input.value);
    });
    refresh();
    showToast(`已按类型勾选 ${suggested.size} 个建议来源，请确认后保存`);
  });
  refresh();
}

function refreshOv1SourcePicker(form) {
  if (!form) return;
  const boxes = [...form.querySelectorAll('input[name="sourceOv1NodeIds"]')];
  const selected = boxes.filter((input) => input.checked).length;
  const count = form.querySelector("[data-ov1-source-count]");
  if (count) count.textContent = `${selected}/${boxes.length} 已选`;
  boxes.forEach((input) => {
    input.closest(".ov1-source-option")?.classList.toggle("selected", input.checked);
  });
}

function select(type, id) {
  state.selection = selectionFor(type, id, getModels());
  renderInspectorPanel();
  bindInspectorEvents();
  traceabilityController.bind(document);
  oodaController.bind(document);
  ov1Controller.bind(document);
  knowledgeController.bind(document);
  deploymentController.bind(document);
  document.querySelectorAll(".selected").forEach((node) => node.classList.remove("selected"));
  const selector = type === "issue"
    ? `[data-validation-issue="${CSS.escape(id)}"]`
    : type === "knowledge"
      ? `[data-knowledge-result="${CSS.escape(id)}"]`
      : `[data-${type}="${CSS.escape(id)}"]`;
  const current = document.querySelector(selector);
  current?.classList.add("selected");
}

function handleAction(action, source = null) {
  if (action === "toggle-workflow-test-mode") {
    void setWorkflowMode(currentWorkflow().mode === "free" ? "gated" : "free");
    return;
  }
  if (action === "select-phase-action-focus") {
    const phaseId = source?.dataset?.phaseId || "";
    if (phaseId && phaseId !== state.phaseActionFocusId) {
      state.phaseActionFocusId = phaseId;
      // 内容就地切换：不 scrollIntoView、不拽外层视口。
      // 名单/阶段详情的「内部」滚到顶（新阶段从第一条读），外层阅读位置保持。
      render({ resetInnerPhaseScroll: true });
    }
    return;
  }
  if (action === "toggle-phase-action-chat") {
    if (!Array.isArray(state.phaseAction?.phases) || !state.phaseAction.phases.length) {
      showToast("请先生成阶段草案");
      return;
    }
    state.phaseActionChatOpen = !state.phaseActionChatOpen;
    render();
    return;
  }
  if (action === "close-phase-action-chat") {
    state.phaseActionChatOpen = false;
    render();
    return;
  }
  if (action === "open-phase-action-chat") {
    if (!Array.isArray(state.phaseAction?.phases) || !state.phaseAction.phases.length) {
      showToast("请先生成阶段草案");
      return;
    }
    state.phaseActionChatOpen = true;
    render();
    return;
  }
  if (action === "toggle-force-mission-chat") {
    const hasDraft = (Array.isArray(state.forceMission?.forces) && state.forceMission.forces.length > 0)
      || (Array.isArray(state.forceMission?.combatForces) && state.forceMission.combatForces.length > 0);
    if (!hasDraft) {
      showToast("请先生成兵力与任务草案");
      return;
    }
    state.forceMissionChatOpen = !state.forceMissionChatOpen;
    render();
    return;
  }
  if (action === "close-force-mission-chat") {
    state.forceMissionChatOpen = false;
    render();
    return;
  }
  if (action === "open-force-mission-chat") {
    const hasDraft = (Array.isArray(state.forceMission?.forces) && state.forceMission.forces.length > 0)
      || (Array.isArray(state.forceMission?.combatForces) && state.forceMission.combatForces.length > 0);
    if (!hasDraft) {
      showToast("请先生成兵力与任务草案");
      return;
    }
    state.forceMissionChatOpen = true;
    render();
    return;
  }
  if (action === "toggle-rule-library-chat") {
    state.ruleLibraryChatOpen = !state.ruleLibraryChatOpen;
    if (state.ruleLibraryChatOpen) {
      ruleLibraryChatController.ensureWelcome(state.ov6a || {});
    }
    render();
    return;
  }
  if (action === "close-rule-library-chat") {
    state.ruleLibraryChatOpen = false;
    render();
    return;
  }
  if (action === "open-rule-library-chat") {
    state.ruleLibraryChatOpen = true;
    ruleLibraryChatController.ensureWelcome(state.ov6a || {});
    render();
    return;
  }
  if (action === "toggle-sequence-chat") {
    state.ov6cToolsOpen = true;
    state.sequenceChatOpen = !state.sequenceChatOpen;
    if (state.sequenceChatOpen) {
      state.ov6cEditorOpen = false;
      sequenceChatController.ensureWelcome(state.ov6c || {});
    }
    render();
    return;
  }
  if (action === "close-sequence-chat") {
    state.sequenceChatOpen = false;
    render();
    return;
  }
  if (action === "open-sequence-chat") {
    state.ov6cToolsOpen = true;
    state.sequenceChatOpen = true;
    state.ov6cEditorOpen = false;
    sequenceChatController.ensureWelcome(state.ov6c || {});
    render();
    return;
  }
  if (action === "toggle-state-machine-chat") {
    state.ov6bToolsOpen = true;
    state.stateMachineChatOpen = !state.stateMachineChatOpen;
    if (state.stateMachineChatOpen) {
      state.ov6bEditorOpen = false;
      stateMachineChatController.ensureWelcome(state.ov6b || {});
    }
    render();
    return;
  }
  if (action === "close-state-machine-chat") {
    state.stateMachineChatOpen = false;
    render();
    return;
  }
  if (action === "open-state-machine-chat") {
    state.ov6bToolsOpen = true;
    state.stateMachineChatOpen = true;
    state.ov6bEditorOpen = false;
    stateMachineChatController.ensureWelcome(state.ov6b || {});
    render();
    return;
  }
  if (action === "open-custom-direction") {
    resetCustomDirectionDialog();
    document.querySelector("#customDirectionDialog")?.showModal();
    return;
  }
  if (action === "close-custom-direction") {
    resetCustomDirectionDialog();
    document.querySelector("#customDirectionDialog")?.close();
    return;
  }
  if (action === "open-context-panel") {
    state.contextPanelOpen = true;
    state.contextPanelFocus = source?.dataset?.contextFocus || "";
    closeMenubarMenus();
    render();
    return;
  }
  if (action === "close-context-panel") {
    state.contextPanelOpen = false;
    state.contextPanelFocus = "";
    const dialog = $("#contextPanelDialog");
    if (dialog?.open) dialog.close();
    return;
  }

  if (action === "open-ov1-concept") {
    toggleOv1SidePanelMode("concept");
    render();
    return;
  }
  if (action === "open-ov1-relations") {
    toggleOv1SidePanelMode("relations");
    render();
    return;
  }
  if (action === "toggle-ov1-tools") {
    toggleOv1ToolsRail();
    render();
    return;
  }
  if (action === "toggle-ov1-panel" || action === "toggle-ov1-sidebar") {
    toggleOv1SidePanelMode("context");
    render();
    return;
  }
  if (action === "close-ov1-panel" || action === "close-ov1-dialog") {
    closeOv1SidePanel();
    render();
    return;
  }
  if (action === "toggle-workflow-gate") {
    // Capsule only expands/collapses the panel; primary advance stays on the panel button.
    setWorkflowGateOpen(!state.workflowGateOpen);
    return;
  }
  if (action === "advance-workflow-step") {
    void advanceWorkflowStep();
    return;
  }
  if (action === "advance-workflow-step-ai") {
    void advanceWorkflowStep({ generate: true });
    return;
  }
  if (action === "advance-workflow-step-direct") {
    void advanceWorkflowStep({ generate: false });
    return;
  }
  if (action === "advance-workflow") {
    const context = resolveWorkflowGateContext(state);
    void (context.mode === "related-next-step" ? advanceRelatedWorkflow() : advanceWorkflowStep());
    return;
  }
  if (action === "toggle-subflow-toolbox") {
    state.subflowToolboxOpen = {
      ...(state.subflowToolboxOpen || {}),
      [state.activeView]: state.subflowToolboxOpen?.[state.activeView] !== true
    };
    render();
    return;
  }
  if (action === "toggle-ov1b-add") {
    state.ov1bAddOpen = state.ov1bAddOpen !== true;
    if (state.ov1bAddOpen) {
      state.subflowToolboxOpen = { ...(state.subflowToolboxOpen || {}), ov1b: true };
    }
    render();
    return;
  }
  if (action === "close-ov1b-dock") {
    state.ov1bAddOpen = false;
    render();
    return;
  }
  if (action === "open-subflow-ai") {
    if (state.activeView === "ov4") {
      const hasOrganization = Boolean((state.ov4?.relations || []).length);
      if (hasOrganization && !window.confirm("将用 AI 重新生成组织关系，覆盖当前内容。是否继续？")) return;
      void dodafProductController.pregenerateOv4FromForceMission({ silent: false, force: true });
      return;
    }
    showToast(`${getViewMeta(state.activeView)?.label || "当前子流程"}的 AI 工具已就绪；请先确认上游内容，再让 AI 生成或检查本页草案。`);
    return;
  }
  if (action === "toggle-ov1b-edit") {
    state.ov1bEditOpen = state.ov1bEditOpen !== true;
    render();
    return;
  }
  if (action === "generate-task-decomposition") {
    if (state.activeView !== "ov1b") return;
    void dodafProductController.pregenerateOv1bFromTasks({ silent: false, force: true });
    return;
  }
  if (action === "advance-related-workflow") {
    void advanceRelatedWorkflow();
    return;
  }
  if (action === "complete-workflow-stage") {
    void completeWorkflowStage();
    return;
  }
  if (action === "toggle-project-manager") {
    const nextOpen = !state.projectManagerOpen;
    if (nextOpen) closeMenubarMenus();
    state.projectManagerOpen = nextOpen;
    if (!state.projectManagerOpen) state.projectCreateOpen = false;
    // Hover or click: never rebuild concept-map viewRoot / iframe.
    refreshProjectManagerUi();
    if (nextOpen) queueMicrotask(() => focusOpenMenubarChrome());
    return;
  }
  if (action === "toggle-project-create") {
    state.projectManagerOpen = true;
    state.projectCreateOpen = !state.projectCreateOpen;
    if (state.projectEntryRequired) { render(); return; }
    refreshProjectManagerUi();
    queueMicrotask(() => focusOpenMenubarChrome());
    return;
  }
  if (action === "retry-project-entry") {
    state.projectDirectory = { status: "checking", projects: [] };
    render();
    void hydrateProjectDirectory();
    return;
  }
  if (action === "open-collaboration") {
    state.activeView = "collaboration";
    state.selection = null;
    closeMenubarMenus();
    render();
    return;
  }
  if (action === "open-account-management") {
    state.activeView = "account-management";
    state.selection = null;
    closeMenubarMenus();
    render();
    return;
  }
  if (knowledgeController.handleAction(action, $("#knowledgeVaultInput"))) return;
  if (aiConfigController.handleAction(action)) return;
  if (aiPromptController.handleAction(action, source)) return;
  if (projectBriefSyncController.handleAction(action)) return;
  if (dodafProductController.handleAction(action, source)) return;
  if (projectForceMissionSyncController.handleAction(action)) return;
  if (projectPhaseActionSyncController.handleAction(action)) return;
  if (projectConceptMapSyncController.handleAction(action)) return;
  if (projectConceptGraphicSyncController.handleAction(action)) return;
  if (projectOv1SyncController.handleAction(action)) return;
  if (projectOv5SyncController.handleAction(action)) return;
  if (projectOodaSyncController.handleAction(action)) return;
  if (projectScenarioSyncController.handleAction(action)) return;
  if (projectValidationSyncController.handleAction(action)) return;
  if (projectKnowledgeSyncController.handleAction(action)) return;
  if (projectReportArchiveSyncController.handleAction(action)) return;
  if (projectModelSnapshotSyncController.handleAction(action)) return;
  if (aiDirectionController.handleAction(action)) return;
  if (obsidianArchiveController.handleAction(action)) return;
  if (ov1Controller.handleAction(action)) return;
  if (action === "apply-ov1-candidate") {
    void applyOv1CandidateWithRecoveryPoint();
    return;
  }
  if (action === "discard-ov1-candidate") {
    state.ov1Candidate = null;
    showToast("已舍弃高层作战概念图候选，当前人工模型保持不变");
    render();
    return;
  }
  if (action === "continue-to-ov5") {
    state.activeView = "ov5";
    state.selection = null;
    showToast("已进入作战活动模型。可手工维护活动，或使用 AI 生成候选。");
    render();
    return;
  }
  if (action === "generate-ov5-from-ov1") {
    state.activeView = "ov5";
    state.selection = null;
    render();
    ov5AiController.handleAction("generate-ov5");
    return;
  }
  if (action === "open-structure-review") {
    state.activeView = "structure-review";
    state.selection = null;
    render();
    return;
  }
  if (action === "attach-ov1-sources") {
    attachOv1SourcesToOv5();
    return;
  }
  if (action === "apply-mapping-quality") {
    applyMappingQualityToOv5();
    return;
  }
  if (action === "export-structure-review-markdown") {
    exportStructureReviewChecklist("markdown");
    return;
  }
  if (action === "export-structure-review-json") {
    exportStructureReviewChecklist("json");
    return;
  }
  if (action === "attach-structure-review-collaboration") {
    void attachStructureReviewToCollaboration();
    return;
  }
  if (action === "clear-collaboration-review-draft") {
    if (state.collaboration) state.collaboration = { ...state.collaboration, reviewDraft: null };
    showToast("已丢弃结构审阅清单草稿");
    render();
    return;
  }
  if (ov1AiController.handleAction(action)) return;
  if (ov5AiController.handleAction(action)) return;
  if (oodaAiController.handleAction(action)) return;
  if (modelSnapshotController.handleAction(action)) return;
  if (briefController.handleAction(action)) return;
  if (redTeamController.handleAction(action)) return;
  if (deploymentController.handleAction(action)) return;
  if (conceptPlanningController.handleAction(action, source)) return;
  if (conceptMapController.handleAction(action)) return;
  if (collaborationController.handleAction(action)) return;
  if (oodaController.handleAction(action)) return;
  if (simulationAdapterController.handleAction(action)) return;
  if (scenarioController.handleAction(action)) return;
  if (validationController.handleAction(action)) return;
  if (action === "export-scenario-geojson") {
    exportArtifact("geojson");
    return;
  }
  if (action === "save-report-version") {
    saveCurrentReportVersion();
    return;
  }
  if (action === "add-activity") {
    const activity = addActivity(state.ov5);
    invalidateDerivedArtifacts();
    void projectOv5SyncController.sync(state.ov5, { source: "manual" });
    state.selection = selectionFor("activity", activity.id, getModels());
    showToast("已新增活动，请在右侧补充属性");
    render();
    return;
  }
  showToast("已创建概念注释");
}

function jumpFromStructureReview(viewId, targetKind, targetId) {
  const allowed = new Set(views.map((view) => view.id));
  if (!allowed.has(viewId)) return;
  state.activeView = viewId;
  state.selection = null;
  // Phase-chain reverse checks default to sequence filter when jumping from review.
  if (["ov6a", "ov6b", "ov6c", "phase-action"].includes(viewId)) {
    state.structureReviewFilter = {
      ...(state.structureReviewFilter || { severity: "all", group: "all" }),
      group: "sequence"
    };
  }
  if (targetKind && targetId) {
    try {
      // Validation issues live under design-validation selection type "issue".
      const kind = targetKind === "issue" ? "issue" : targetKind;
      state.selection = selectionFor(kind, targetId, getModels());
    } catch {
      state.selection = null;
    }
  }
  const meta = getViewMeta(viewId);
  const chainHint = {
    ov6a: "请绑定规则到受约束活动，或修订规则库",
    ov6b: "请补状态出口或按任务/对象分机",
    ov6c: "请为消息回链阶段活动",
    "phase-action": "请修订阶段、行动或进入退出条件"
  }[viewId];
  showToast(
    state.selection
      ? `已打开 ${meta?.label || viewId}，并定位到相关对象`
      : chainHint
        ? `已打开 ${meta?.label || viewId}：${chainHint}`
        : `已打开 ${meta?.label || viewId}`
  );
  render();
}

function attachOv1SourcesToOv5() {
  if (!state.ov1?.nodes?.length) {
    showToast("请先在高层作战概念图定义概念节点，再补挂活动来源");
    return;
  }
  if (!state.ov5?.activities?.length) {
    showToast("请先建立作战活动");
    return;
  }
  const before = countUnmappedOv5Activities(state.ov5, state.ov1);
  state.ov5 = linkOv5ActivitiesToOv1(state.ov5, state.ov1);
  persistOv5Model(state.ov5);
  const after = countUnmappedOv5Activities(state.ov5, state.ov1);
  invalidateDerivedArtifacts();
  void projectOv5SyncController.sync(state.ov5, { source: "ov1-source-link" });
  const linked = Math.max(0, before - after);
  showToast(linked || before === 0
    ? (before === 0 ? "全部活动已具备有效总体图来源" : `已为 ${linked} 个活动补挂总体图来源，请在结构核对台复核`)
    : "未能自动补挂更多来源，请手工为活动选择总体图节点");
  if (state.activeView !== "structure-review" && state.activeView !== "ov5") state.activeView = "structure-review";
  render();
}

/** Fill blank OV-5 I/O and shallow parent hierarchy; never overwrites authored text. */
function applyMappingQualityToOv5() {
  if (!state.ov5?.activities?.length) {
    showToast("请先建立作战活动");
    return;
  }
  // Sources improve I/O suggestions; keep existing valid links, only fill gaps.
  if (state.ov1?.nodes?.length) {
    state.ov5 = linkOv5ActivitiesToOv1(state.ov5, state.ov1);
  }
  const result = applyMappingQuality(state.ov5, state.ov1 || {});
  state.ov5 = result.model;
  persistOv5Model(state.ov5);
  invalidateDerivedArtifacts();
  void projectOv5SyncController.sync(state.ov5, { source: "mapping-quality" });
  const { ioFromOv1, ioFromEdges, parentsSet, changed } = result.summary;
  if (!changed) {
    showToast("没有可自动补全的空字段；已有正文不会被覆盖");
  } else {
    const parts = [];
    if (ioFromOv1) parts.push(`总体图回填 ${ioFromOv1} 处`);
    if (ioFromEdges) parts.push(`沿边对齐 ${ioFromEdges} 处`);
    if (parentsSet) parts.push(`父活动 ${parentsSet} 项`);
    showToast(`已补全映射质量：${parts.join(" · ")}。请在活动模型 / 结构核对台复核`);
  }
  if (state.selection?.kind === "activity") {
    state.selection = selectionFor("activity", state.selection.id, getModels());
  }
  if (state.activeView !== "structure-review" && state.activeView !== "ov5") state.activeView = "structure-review";
  render();
}

function exportStructureReviewChecklist(format = "markdown") {
  const exportBundle = buildStructureReviewExport({
    ...state,
    projectTitle: currentProjectTitle()
  });
  const artifact = format === "json" ? exportBundle.json : exportBundle.markdown;
  downloadArtifact(artifact);
}

/**
 * Attach filtered structure-review checklist to collaboration:
 * - always export full Markdown as the companion attachment
 * - if session is authenticated, submit a compact review summary immediately
 * - otherwise prefill the collaboration form draft for manual submit after login
 */
async function attachStructureReviewToCollaboration() {
  const exportBundle = buildStructureReviewExport({
    ...state,
    projectTitle: currentProjectTitle()
  });
  const draft = exportBundle.collaborationDraft;
  downloadArtifact(exportBundle.markdown);

  state.collaboration = {
    ...(state.collaboration || {}),
    reviewDraft: draft
  };

  const session = state.collaboration?.session;
  const canSubmit = state.collaboration?.status === "ready" && session?.authenticated;
  if (!canSubmit) {
    state.activeView = "collaboration";
    showToast("已导出完整清单，并写入协同审阅草稿；请登录后确认提交");
    render();
    return;
  }

  try {
    const resource = draft.resource || "ov5";
    const storageKey = {
      brief: "projectStorage",
      ov1: "ov1Storage",
      ov5: "ov5Storage",
      ooda: "oodaStorage",
      scenario: "scenarioStorage",
      validation: "validationStorage",
      knowledge: "knowledgeStorage",
      report: "reportStorage"
    }[resource];
    const resourceRevision = Number(
      state[storageKey]?.resourceRevision
      || (resource === "brief" ? state.projectStorage?.revision : 0)
      || 0
    );
    const { createProjectCollaborationReview } = await import("./projectBriefClient.js");
    const result = await createProjectCollaborationReview(state.activeProjectId || "default", {
      resource,
      resourceRevision,
      disposition: draft.disposition,
      summary: draft.summary,
      evidenceRefs: [],
      expectedRevision: state.collaboration.revision,
      clientId: draft.clientId
    });
    state.collaboration = {
      ...(state.collaboration || {}),
      status: "ready",
      detail: "",
      revision: Number(result.revision || 0),
      resourceRevision: Number(result.resourceRevision || 0),
      reviews: result.reviews || [],
      openCount: Number(result.openCount || 0),
      policy: result.policy || state.collaboration.policy,
      reviewDraft: null,
      session: state.collaboration.session,
      accounts: state.collaboration.accounts,
      securityEvents: state.collaboration.securityEvents,
      auditEntries: state.collaboration.auditEntries
    };
    state.projectRevision = result.revision;
    state.activeView = "collaboration";
    showToast(`已挂接协同审阅（${draft.issueCount} 项摘要），完整清单已下载`);
    void collaborationController.hydrate();
    render();
  } catch (error) {
    state.activeView = "collaboration";
    const conflict = error?.status === 409;
    showToast(conflict
      ? "项目已更新：完整清单已下载，请在协同页刷新后确认草稿再提交"
      : "自动提交失败：完整清单已下载，草稿已填入协同表单，请手工确认提交");
    render();
  }
}

async function applyOv1CandidateWithRecoveryPoint() {
  if (!state.ov1Candidate) return;
  if (!window.confirm("应用候选将替换当前高层作战概念图。系统会先保存一个可恢复的模型快照，是否继续？")) return;

  state.modelSnapshots = saveModelSnapshot(snapshotContextFromState(state, project), state.modelSnapshots);
  const recoveryPoint = state.modelSnapshots[0];
  render();
  const saved = await projectModelSnapshotSyncController.save(recoveryPoint, { source: "ov1-ai-candidate-preapply" });
  if (!saved) {
    showToast("恢复点未能同步到服务端，当前候选未应用。");
    return;
  }
  state.ov1 = saveOv1Model(state.ov1Candidate);
  state.ov1Candidate = null;
  try {
    const { resetOv1Camera } = await import("./ov1ConceptMapController.js");
    resetOv1Camera();
  } catch {
    /* camera reset is best-effort */
  }
  invalidateDerivedArtifacts();
  await projectOv1SyncController.sync(state.ov1, { source: "ai-candidate-approved" });
  showToast("已应用高层作战概念图候选；恢复点已保存。可用「基于当前概念生成活动模型候选」继续。");
  render();
}

function exportArtifact(type) {
  const artifact = buildExportArtifact(type, exportContext());
  downloadArtifact(artifact);
}

async function exportWordReport() {
  return exportWordReportPayload(buildReportPayload(exportContext()));
}

async function exportWordReportPayload(payload) {
  showToast("正在生成 Word 报告…");
  try {
    const document = await requestReportDocx(payload);
    downloadBlob(document.blob, document.filename);
    showToast("Word 报告已生成");
  } catch (error) {
    const artifact = buildExportArtifactFromPayload("rtf", payload);
    downloadArtifact(artifact);
    showToast("Word 服务不可用，已生成兼容 RTF 报告");
  }
}

async function exportPdfReport() {
  return exportPdfReportPayload(buildReportPayload(exportContext()));
}

async function exportPdfReportPayload(payload) {
  const printWindow = window.open("", "_blank");
  if (printWindow) writePrintableReport(printWindow, payload, true);
  showToast("正在生成 PDF 报告…");
  try {
    const document = await requestReportPdf(payload);
    printWindow?.close();
    downloadBlob(document.blob, document.filename);
    showToast("PDF 报告已生成");
  } catch (error) {
    if (!printWindow) {
      showToast("PDF 服务不可用，请允许弹窗后重试");
      return;
    }
    writePrintableReport(printWindow, payload);
    printWindow.focus();
    showToast("PDF 服务不可用，已打开可打印报告");
  }
}

async function exportPptxReport() {
  return exportPptxReportPayload(buildReportPayload(exportContext()));
}

async function exportPptxReportPayload(payload) {
  showToast("正在生成 PPTX 研究汇报…");
  try {
    const document = await requestReportPptx(payload);
    downloadBlob(document.blob, document.filename);
    showToast("PPTX 研究汇报已生成");
  } catch (error) {
    showToast("PPTX 服务不可用，请在活动桌面会话中启动 Workbench server 后重试");
  }
}

function exportReportVersion(type, versionId) {
  const version = state.reportVersions.find((item) => item.id === versionId);
  if (!version) {
    showToast("未找到该报告版本");
    return;
  }
  if (type === "docx") {
    exportWordReportPayload(version.payload);
    return;
  }
  if (type === "pdf") {
    exportPdfReportPayload(version.payload);
    return;
  }
  if (type === "pptx") {
    exportPptxReportPayload(version.payload);
    return;
  }
  downloadArtifact(buildExportArtifactFromPayload(type, version.payload));
}

async function verifyArchivedReportVersion(versionId) {
  const version = state.reportVersions.find((item) => item.id === versionId);
  if (!version) return showToast("未找到该报告版本");
  const result = await verifyReportIntegrity(version.payload);
  if (result.status === "verified") return showToast("报告归档 SHA-256 清单匹配");
  if (result.status === "mismatch") return showToast("报告归档内容与 SHA-256 清单不匹配");
  showToast("该报告归档未保存 SHA-256 清单");
}

async function saveCurrentReportVersion() {
  if (state.reportArchiving || state.workflowModeSwitching) return;
  state.reportArchiving = true;
  updateBusyOverlay(getBusyOverlayState());
  const saveVersionButton = $("#saveVersionBtn");
  if (saveVersionButton) {
    saveVersionButton.disabled = true;
    saveVersionButton.classList.add("is-busy");
    saveVersionButton.textContent = "保存中…";
  }
  $("#studioShell")?.classList.add("is-mode-switching");
  await waitForPaint();
  try {
    const payload = buildReportPayload(exportContext());
    payload.reportIntegrity = await createReportIntegrity(payload);
    state.reportVersions = saveReportVersion(payload, state.reportVersions);
    const newest = state.reportVersions[0];
    void projectReportArchiveSyncController.save(newest, { source: "report-archive" });
    await settleBusyTransition(260);
    showToast(`报告版本 ${newest.label} 已归档`);
  } catch (error) {
    showToast(error?.message || "报告归档校验失败");
  } finally {
    state.reportArchiving = false;
    if (saveVersionButton) {
      saveVersionButton.disabled = false;
      saveVersionButton.classList.remove("is-busy");
      saveVersionButton.textContent = "保存版本";
    }
    render();
  }
}

function deleteArchivedReportVersion(versionId) {
  const version = state.reportVersions.find((item) => item.id === versionId);
  if (!version) {
    showToast("未找到该报告版本");
    return;
  }
  if (!window.confirm(`确定删除报告版本 ${version.label}？此操作不可撤销。`)) return;
  state.reportVersions = deleteReportVersion(version.id, state.reportVersions);
  void projectReportArchiveSyncController.remove(version.id, { source: "manual" });
  showToast(`报告版本 ${version.label} 已删除`);
  render();
}

function exportContext() {
  return {
    project,
    brief: state.brief,
    inspiration: state.inspiration,
    direction: state.direction,
    forceMission: state.forceMission,
    ov1: state.ov1,
    ov1b: state.ov1b,
    ov1c: state.ov1c,
    ov2: state.ov2,
    ov3: state.ov3,
    ov4: state.ov4,
    ov5a: state.ov5a,
    ov5: state.ov5,
    ov6a: state.ov6a,
    ov6b: state.ov6b,
    ov6c: state.ov6c,
    ov7: state.ov7,
    ooda: state.ooda,
    scenario: state.scenario,
    validationResult: state.validationResult,
    knowledge: state.knowledge,
    knowledgeCitationApprovals: state.knowledgeCitationApprovals,
    deployment: state.deployment,
    modelSnapshots: state.modelSnapshots,
    modelComparison: state.modelComparison,
    reportTemplate: state.reportTemplate,
    collaboration: state.collaboration,
    projectRepository: {
      projectRevision: state.projectRevision,
      brief: state.projectStorage,
      ov1: state.ov1Storage,
      ov1b: state.ov1bStorage,
      ov1c: state.ov1cStorage,
      ov2: state.ov2Storage,
      ov3: state.ov3Storage,
      ov4: state.ov4Storage,
      ov5a: state.ov5aStorage,
      ov5: state.ov5Storage,
      ov6a: state.ov6aStorage,
      ov6b: state.ov6bStorage,
      ov6c: state.ov6cStorage,
      ov7: state.ov7Storage,
      architecture: state.architectureStorage,
      ooda: state.oodaStorage,
      scenario: state.scenarioStorage,
      validation: state.validationStorage,
      knowledge: state.knowledgeStorage,
      reportArchives: state.reportStorage,
      modelSnapshots: state.modelSnapshotStorage
    }
  };
}

function restoreSnapshot(snapshot) {
  const restored = restoreModelSnapshot(snapshot, { briefSeed: projectBriefSeed, projectId: activeProjectId });
  state.direction = restored.direction || state.direction;
  state.brief = restored.brief;
  if (restored.inspiration) state.inspiration = restored.inspiration;
  state.ov1 = saveOv1Model(restored.ov1);
  state.ov5 = restored.ov5;
  state.ooda = restored.ooda;
  state.scenario = restored.scenario;
  state.validationResult = restored.validationResult;
  for (const key of ["ov1b", "ov1c", "ov2", "ov3", "ov4", "ov5a", "ov6a", "ov6b", "ov6c", "ov7", "architecture"]) {
    state[key] = restored[key] ?? null;
  }
  state.lastDeploymentData = null;
  state.redTeamRunning = false;
  state.selection = null;
  state.deployment.open = false;
  state.deployment.exchange = null;
  state.deployment.acceptedChangeIds = [];
  state.deployment.lastAccepted = null;
  state.deployment.status = "快照已恢复，待推送";
  void syncRestoredModels();
}

async function syncRestoredModels() {
  await projectBriefSyncController.sync(state.brief, { direction: state.direction, inspiration: state.inspiration, directions: state.customDirections, source: "snapshot-restore" });
  await projectOv1SyncController.sync(state.ov1, { source: "snapshot-restore" });
  await projectOv5SyncController.sync(state.ov5, { source: "snapshot-restore" });
  await dodafProductController.syncAllFromState({ source: "snapshot-restore" });
  await projectOodaSyncController.sync(state.ooda, { source: "snapshot-restore" });
  if (state.scenario) await projectScenarioSyncController.sync(state.scenario, { source: "snapshot-restore" });
  if (state.validationResult) await projectValidationSyncController.sync(state.validationResult, { source: "snapshot-restore" });
}

function restoreLocalBriefConflictDraft(draft) {
  if (!draft?.brief) return;
  const nextBrief = saveConceptBrief(draft.brief, projectBriefSeed);
  const nextDirection = saveSelectedDirection(String(draft.direction || state.direction).trim() || state.direction);
  const changed = !areConceptBriefsEqual(state.brief, nextBrief) || state.direction !== nextDirection;
  state.brief = nextBrief;
  state.briefIntent = nextBrief.researchIntent;
  state.direction = nextDirection;
  if (Array.isArray(draft.directions)) state.customDirections = saveCustomDirections(draft.directions, { projectId: activeProjectId, defaults: directions });
  if (draft.inspiration?.messages?.length) state.inspiration = saveInspirationSession(draft.inspiration);
  if (changed) invalidateDerivedArtifacts();
}

function restoreLocalConceptMapConflictDraft(model) {
  if (!model?.document) return;
  state.conceptMap = persistConceptMap(normalizeConceptMap(model), activeProjectId);
  invalidateConceptMapDependents();
}

function applyResearchChatBriefUpdate(response, question) {
  const update = deriveResearchChatBriefUpdate({ brief: state.brief, question, result: response?.result });
  if (!update.fields.length) return [];
  const nextBrief = saveConceptBrief({ ...state.brief, ...update.patch }, projectBriefSeed);
  if (!areConceptBriefsEqual(state.brief, nextBrief)) {
    state.brief = nextBrief;
    state.briefIntent = nextBrief.researchIntent;
    invalidateDerivedArtifacts();
  }
  return update.fields;
}

function restoreLocalOv5ConflictDraft(model) {
  if (!model?.activities || !Array.isArray(model.activities)) return;
  state.ov5 = model;
  persistOv5Model(state.ov5);
  state.ooda = deriveOodaFromOv5(state.ov5);
  state.selection = null;
  invalidateDerivedArtifacts();
}

function restoreLocalOv1ConflictDraft(model) {
  if (!model?.nodes || !Array.isArray(model.nodes)) return;
  state.ov1 = saveOv1Model(model);
  state.selection = null;
  invalidateValidation();
}

function restoreLocalOodaConflictDraft(model) {
  if (!model?.lanes || !Array.isArray(model.lanes)) return;
  state.ooda = model;
  persistOodaModel(state.ooda);
  state.selection = null;
  invalidateDerivedArtifacts();
}

function restoreLocalScenarioConflictDraft(model) {
  if (!model?.entities || !Array.isArray(model.entities)) return;
  state.scenario = model;
  persistScenario(state.scenario);
  state.selection = null;
  invalidateValidation();
}

function restoreLocalValidationConflictDraft(model) {
  if (!model?.scores || !Array.isArray(model.scores)) return;
  state.validationResult = model;
  persistValidation(state.validationResult);
  state.redTeamRunning = false;
  state.selection = null;
}

function applyRemoteBrief(remote, { force = false } = {}) {
  if (!remote?.brief) return false;
  if (force && !window.confirm(`服务端修订 r${remote.revision} 将覆盖当前概念简报及其下游派生数据。是否继续？`)) return false;
  const localIsSeed = areConceptBriefsEqual(state.brief, projectBriefSeed);
  if (!force && !localIsSeed) return false;
  const nextDirection = String(remote.direction || state.direction).trim() || state.direction;
  const nextCustomDirections = Array.isArray(remote.directions) ? saveCustomDirections(remote.directions, { projectId: activeProjectId, defaults: directions }) : state.customDirections;
  const changed = !areConceptBriefsEqual(state.brief, remote.brief) || state.direction !== nextDirection || JSON.stringify(state.customDirections) !== JSON.stringify(nextCustomDirections);
  state.brief = saveConceptBrief(remote.brief, projectBriefSeed);
  state.briefIntent = state.brief.researchIntent;
  state.direction = saveSelectedDirection(nextDirection);
  state.customDirections = nextCustomDirections;
  if (remote.inspiration?.messages?.length) state.inspiration = saveInspirationSession(remote.inspiration);
  if (changed) invalidateDerivedArtifacts();
  return true;
}

function applyRemoteForceMission(remote, { force = false } = {}) {
  if (!remote?.model || remote.stale) return false;
  if (force && state.forceMission?.forces?.length && !window.confirm(`服务端兵力与任务修订 r${remote.revision} 将覆盖当前草案，是否继续？`)) return false;
  if (!force && state.forceMissionStorage.localSaved) return false;
  state.forceMission = persistForceMission(normalizeForceMissionPlan(remote.model), activeProjectId);
  return true;
}

function applyRemotePhaseAction(remote, { force = false } = {}) {
  if (!remote?.model || remote.stale) return false;
  if (force && state.phaseAction?.phases?.length && !window.confirm(`服务端阶段与行动修订 r${remote.revision} 将覆盖当前草案，是否继续？`)) return false;
  if (!force && state.phaseActionStorage.localSaved) return false;
  state.phaseAction = persistPhaseAction(normalizePhaseActionConcept(remote.model), activeProjectId);
  return true;
}

function applyRemoteConceptMap(remote, { force = false } = {}) {
  if (!remote?.model || remote.stale) return false;
  if (force && state.conceptMap?.document?.items?.length && !window.confirm(`服务端作战概念图修订 r${remote.revision} 将覆盖当前地图快照，是否继续？`)) return false;
  if (!force && state.conceptMapStorage.localSaved) return false;
  state.conceptMap = persistConceptMap(normalizeConceptMap(remote.model), activeProjectId);
  state.selection = null;
  invalidateConceptMapDependents();
  return true;
}

function applyRemoteConceptGraphic(remote, { force = false } = {}) {
  if (!remote?.model || remote.stale) return false;
  if (force && state.conceptGraphic?.nodes?.length && !window.confirm(`服务端总体作战概念图修订 r${remote.revision} 将覆盖当前草案，是否继续？`)) return false;
  if (!force && state.conceptGraphicStorage.localSaved) return false;
  state.conceptGraphic = persistConceptGraphic(normalizeConceptGraphicPlan(remote.model), activeProjectId);
  return true;
}

function restoreLocalForceMissionConflictDraft(model) {
  state.forceMission = persistForceMission(normalizeForceMissionPlan(model), activeProjectId);
}

function restoreLocalPhaseActionConflictDraft(model) {
  state.phaseAction = persistPhaseAction(normalizePhaseActionConcept(model), activeProjectId);
}

function restoreLocalConceptGraphicConflictDraft(model) {
  state.conceptGraphic = persistConceptGraphic(normalizeConceptGraphicPlan(model), activeProjectId);
}

function describeProjectCreateError(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || "").trim();
  if (status === 403 || /login is required|Collaboration login/i.test(message)) {
    return "创建项目前请先登录协同账号";
  }
  if (status === 409 || /already in use/i.test(message)) {
    return "项目标识已被占用：请直接打开已有项目，或换一个新标识";
  }
  if (/identifier is invalid/i.test(message)) {
    return "项目标识格式无效：使用 2–64 位小写字母、数字、下划线或连字符，且以字母/数字开头";
  }
  if (/title is required/i.test(message)) {
    return "请填写项目名称";
  }
  if (message) return `项目创建失败：${message}`;
  return "项目创建失败，请检查项目标识和名称";
}

function applyRemoteOv5(remote, { force = false } = {}) {
  if (!remote?.model) return false;
  if (force && !window.confirm(`服务端活动模型修订 r${remote.revision} 将覆盖当前活动模型并重新派生 OODA。是否继续？`)) return false;
  if (!force && state.ov5Storage.localSaved) return false;
  state.ov5 = remote.model;
  persistOv5Model(state.ov5);
  state.ooda = deriveOodaFromOv5(state.ov5);
  state.selection = null;
  invalidateDerivedArtifacts();
  return true;
}

function applyRemoteOv1(remote, { force = false } = {}) {
  if (!remote?.model || remote.stale) return false;
  if (force && !window.confirm(`服务端高层作战概念图修订 r${remote.revision} 将覆盖当前总体概念图，并使本地验证结果失效。是否继续？`)) return false;
  if (!force && state.ov1Storage.localSaved) return false;
  state.ov1 = saveOv1Model(remote.model);
  state.selection = null;
  invalidateValidation();
  return true;
}

function applyRemoteOoda(remote, { force = false } = {}) {
  if (!remote?.model || remote.stale) return false;
  if (force && !window.confirm(`服务端 OODA 修订 r${remote.revision} 将覆盖当前循环并清除下游想定和验证。是否继续？`)) return false;
  if (!force && state.oodaStorage.localSaved) return false;
  state.ooda = remote.model;
  persistOodaModel(state.ooda);
  state.selection = null;
  invalidateDerivedArtifacts();
  return true;
}

function applyRemoteScenario(remote, { force = false } = {}) {
  if (!remote?.model || remote.stale) return false;
  if (force && !window.confirm(`服务端想定修订 r${remote.revision} 将覆盖当前想定并清除本地验证。是否继续？`)) return false;
  if (!force && state.scenarioStorage.localSaved) return false;
  state.scenario = remote.model;
  persistScenario(state.scenario);
  state.selection = null;
  invalidateValidation();
  return true;
}

function applyRemoteValidation(remote, { force = false } = {}) {
  if (!remote?.model || remote.stale) return false;
  if (force && !window.confirm(`服务端验证修订 r${remote.revision} 将覆盖当前验证与红方审阅。是否继续？`)) return false;
  if (!force && state.validationStorage.localSaved) return false;
  state.validationResult = remote.model;
  persistValidation(state.validationResult);
  state.redTeamRunning = false;
  state.selection = null;
  return true;
}

function applyRemoteKnowledge(remote, { force = false } = {}) {
  if (!remote?.model?.docs?.length) return false;
  if (force && state.knowledge?.docs?.length && !window.confirm(`服务端知识库修订 r${remote.revision} 将覆盖当前本地 Vault 索引。是否继续？`)) return false;
  if (!force && state.knowledgeStorage.localSaved) return false;
  state.knowledge = remote.model;
  state.knowledgeQuery = "";
  state.knowledgeResults = null;
  state.knowledgeSearch = { mode: "server", retrievalMode: "hybrid", includeSensitive: false, detail: "已载入服务端项目知识库，默认排除敏感片段" };
  state.selection = null;
  return true;
}

function applyRemoteReportArchives(items, { force = false } = {}) {
  if (!Array.isArray(items) || !items.length) return false;
  if (state.reportVersions.length && !force) return false;
  if (force && state.reportVersions.length && !window.confirm(`服务端将替换当前 ${state.reportVersions.length} 份本地报告归档。是否继续？`)) return false;
  state.reportVersions = persistReportVersions(items);
  return true;
}

function upsertRemoteReportArchive(item) {
  state.reportVersions = upsertReportVersion(item, state.reportVersions);
}

function removeRemoteReportArchive(itemId) {
  state.reportVersions = deleteReportVersion(itemId, state.reportVersions);
}

function applyRemoteModelSnapshots(items, { force = false } = {}) {
  if (!Array.isArray(items) || !items.length) return false;
  if (state.modelSnapshots.length && !force) return false;
  if (force && state.modelSnapshots.length && !window.confirm(`服务端将替换当前 ${state.modelSnapshots.length} 份本地模型快照。是否继续？`)) return false;
  state.modelSnapshots = persistModelSnapshots(items);
  state.modelComparison = null;
  return true;
}

function upsertRemoteModelSnapshot(item) {
  state.modelSnapshots = upsertModelSnapshot(item, state.modelSnapshots);
}

function removeRemoteModelSnapshot(itemId) {
  state.modelSnapshots = deleteModelSnapshot(itemId, state.modelSnapshots);
  if (state.modelComparison?.baseline.id === itemId || state.modelComparison?.candidate.id === itemId) state.modelComparison = null;
}

function exportModelComparison(type, comparison) {
  downloadArtifact(buildModelComparisonArtifact(type, comparison));
}

function downloadArtifact(artifact) {
  downloadArtifactHelper(artifact, showToast);
}

function writePrintableReport(target, payload, loading = false) {
  writePrintableReportHelper(target, payload, loading, (reportPayload) => buildExportArtifactFromPayload("markdown", reportPayload).content);
}

$("#saveVersionBtn").addEventListener("click", saveCurrentReportVersion);
render();
redTeamController.refreshHealth();
aiConfigController.refresh();
void loadTheme();
void loadCmoCatalogStatus();
void hydrateProjectModels();

async function loadTheme() {
  try {
    applyTheme((await getThemeConfig()).theme);
  } catch {
    // The CSS default palette remains usable when the optional theme endpoint is unavailable.
  }
}

async function loadCmoCatalogStatus() {
  try {
    state.cmoCatalogStatus = await getCmoCatalogStatus();
    render();
  } catch {
    state.cmoCatalogStatus = { open: false, enabled: false };
  }
}

async function hydrateProjectModels() {
  await collaborationController.hydrate();
  if (state.projectEntryRequired) return;
  collaborationController.startWatch();
  await Promise.all([
    projectBriefSyncController.hydrate({ silent: true }),
    projectForceMissionSyncController.hydrate({ silent: true }),
    projectPhaseActionSyncController.hydrate({ silent: true }),
    researchChatProjectSync.hydrate({ silent: true }),
    projectConceptMapSyncController.hydrate({ silent: true }),
    projectConceptGraphicSyncController.hydrate({ silent: true }),
    projectOv1SyncController.hydrate({ silent: true }),
    projectOv5SyncController.hydrate({ silent: true }),
    dodafProductController.hydrateAll({ silent: true }),
    projectOodaSyncController.hydrate({ silent: true }),
    projectScenarioSyncController.hydrate({ silent: true }),
    projectValidationSyncController.hydrate({ silent: true }),
    projectKnowledgeSyncController.hydrate({ silent: true }),
    projectReportArchiveSyncController.hydrate({ silent: true }),
    projectModelSnapshotSyncController.hydrate({ silent: true })
  ]);
  render();
}

async function hydrateProjectDirectory({ skipRender = false } = {}) {
  try {
    const result = await loadProjects({ includeArchived: true });
    state.projectDirectory = { status: "ready", projects: result.projects || [] };
    project.title = currentProjectTitle();
  } catch {
    state.projectDirectory = { status: "unavailable", projects: [] };
  }
  if (!skipRender) render();
}

function currentProjectTitle() {
  return currentProjectTitleFor(state, project);
}

function currentWorkflow() {
  return currentWorkflowFor(state, project);
}

function renderWorkflowGate() {
  return renderWorkflowGateFor(state);
}

/** Ignore synthetic pointerleave caused by rebuilding the capsule DOM. */
let workflowGateLeaveSuppressedUntil = 0;

function suppressWorkflowGateLeave(ms = 400) {
  workflowGateLeaveSuppressedUntil = performance.now() + ms;
}

function refreshWorkflowGateUi() {
  const root = document.getElementById("workflowGateRoot");
  if (!root) {
    render();
    return;
  }
  // Replacing the open shell fires pointerout on the removed node; suppress auto-collapse.
  suppressWorkflowGateLeave();
  root.innerHTML = renderWorkflowGate();
}

/** Open/close without replacing DOM — keeps click handlers and avoids leave-collapse races. */
function setWorkflowGateOpen(open) {
  state.workflowGateOpen = Boolean(open);
  const shell = document.querySelector("#workflowGateRoot [data-workflow-gate-shell]");
  if (!shell || shell.classList.contains("is-complete")) {
    if (!shell) refreshWorkflowGateUi();
    return;
  }
  shell.classList.toggle("is-open", state.workflowGateOpen);
  const panel = shell.querySelector(".workflow-gate-panel");
  const capsule = shell.querySelector(".workflow-gate-capsule[data-action='toggle-workflow-gate']");
  if (panel) {
    if (state.workflowGateOpen) {
      panel.removeAttribute("inert");
      panel.removeAttribute("aria-hidden");
    } else {
      panel.setAttribute("inert", "");
      panel.setAttribute("aria-hidden", "true");
    }
  }
  if (capsule) capsule.setAttribute("aria-expanded", state.workflowGateOpen ? "true" : "false");
}

function goToWorkflowView(viewId) {
  if (!viewId) return;
  if (viewId !== "ov6a") state.ruleLibraryEntrySource = "default";
  state.activeView = viewId;
  state.selection = null;
  state.ov1Dialog = null;
  state.ov1PanelMode = "context";
  state.ov1PanelNodeId = null;
  state.ov1PanelEdgeId = null;
  state.workflowGateOpen = false;
}

/**
 * Single navigation entry for research views.
 * - 规则库: empty → AI pregenerate rules from brief
 * - 阶段与行动: no combat-focus options yet → AI generate 3 directions + transition overlay
 * - 状态机校验: empty → AI derives editable task machines from phase actions
 * - 时序校验: empty → AI generates separate side and per-phase timelines
 * - 组织关系: empty → AI generates command/support/information links among confirmed forces
 * - 作战兵力: empty → AI derives force-mission plan from tasks
 * - 总体图: empty → AI derives concept nodes and high-level interaction relations
 * - 仿真想定: empty → AI/full-element compiler generates scenario entities, areas, and phases
 * Used by: top gate capsule, gate panel buttons, left floating step rail, menus.
 */
async function navigateToResearchView(viewId, { toast = "", force = false, entrySource = "default", completeOperationalTasks = false } = {}) {
  if (!viewId) return;
  if (!force && state.activeView === viewId && viewId !== "ov6a" && viewId !== "phase-action") return;
  if (viewId === "ov6a") state.ruleLibraryEntrySource = entrySource;
  goToWorkflowView(viewId);
  render();
  if (toast) showToast(toast);
  if (viewId === "ov6a") {
    if (entrySource === "operational-task") {
      await ruleLibraryChatController.proposeChanges("operational-task", { silent: false });
    } else {
      await ruleLibraryChatController.pregenerateFromBrief({ silent: false });
    }
    // When arriving from the confirmed phase/action step, derive a reviewable
    // rule change set from that upstream model. Brief pre-generation above only
    // creates the initial library and intentionally skips non-empty libraries.
    if (entrySource === "phase-action" && state.phaseAction?.status === "confirmed") {
      await ruleLibraryChatController.proposeChanges("phase-action", { silent: false });
    }
  }
  // Task decomposition is generated from its toolbox action, after the canvas is visible.
  if (viewId === "phase-action") {
    await ensureCombatFocusOnEnterPhaseAction();
  }
  if (viewId === "ov6b") {
    await dodafProductController.pregenerateOv6bFromPhaseAction({ silent: false, contextType: entrySource === "operational-task" ? "task" : "phase" });
  }
  if (viewId === "ov6c") {
    await dodafProductController.pregenerateOv6cFromPhase({ silent: false, contextType: entrySource === "operational-task" ? "task" : "phase" });
  }
  if (viewId === "ov4") {
    await dodafProductController.pregenerateOv4FromForceMission({ silent: false });
  }
  if (viewId === "force-mission" && !(state.forceMission?.forces || []).length && (state.forceMission?.tasksConfirmedAt || (state.forceMission?.tasks || []).length)) {
    await conceptPlanningController.generateForceMission({ silent: false, layer: "concept" });
  }
  if (viewId === "ov1" && (!state.conceptGraphic?.nodes?.length && !state.ov1Candidate)) {
    await ov1AiController.generateOv1();
  }
  if (viewId === "scenario" && (!state.scenario || !state.scenario.entities?.length)) {
    await scenarioController.compileOrGenerateScenario({ silent: false, forceAi: true });
  }
  if (viewId === "operational-task" && (
    !(state.forceMission?.tasks || []).length
    || ((entrySource === "phase-action" || completeOperationalTasks) && operationalTasksNeedAiCompletion(state.forceMission?.tasks))
  )) {
    await conceptPlanningController.generateOperationalTasks({ silent: false });
  }
  // Entering OV-1b from the confirmed operational-task step must immediately
  // produce a reviewable task organization. The page remains visible while
  // generation runs so the user can see the busy state and resulting groups.
  if (viewId === "ov1b" && entrySource === "operational-task") {
    await dodafProductController.pregenerateOv1bFromTasks({ silent: false });
  }
}

function operationalTasksNeedAiCompletion(tasks = []) {
  if (!Array.isArray(tasks) || !tasks.length) return true;
  return tasks.some((task) => {
    const area = task?.area || {};
    const points = (area.points || []).filter((point) => Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude));
    const requiredPoints = area.geometryType === "point" || area.geometryType === "circle"
      ? 1
      : area.geometryType === "corridor" ? 2 : 3;
    return !String(task?.name || "").trim()
      || !String(task?.missionType || "").trim()
      || !String(task?.objective || "").trim()
      || !String(task?.expectedEffect || "").trim()
      || !String(area.name || "").trim()
      || area.name === "待人工明确"
      || !String(area.type || "").trim()
      || !String(area.geometryType || "").trim()
      || !String(area.basis || "").trim()
      || points.length < requiredPoints;
  });
}

/**
 * Rule library → 阶段行动: if no focus options yet, generate 3 combat-focus directions with overlay.
 * Existing options: enter directly (no regenerate).
 */
async function ensureCombatFocusOnEnterPhaseAction() {
  const options = Array.isArray(state.combatFocus?.options) ? state.combatFocus.options : [];
  if (options.length > 0) return null;
  if (state.combatFocusGenerating) return null;
  if (typeof conceptPlanningController?.generateCombatFocus !== "function") return null;
  return conceptPlanningController.generateCombatFocus({ silent: false });
}

/** Revisit an already-confirmed mainline product and continue to its successor. */
async function advanceWorkflowStep({ generate = true } = {}) {
  const ctx = resolveWorkflowGateContext(state);
  if (ctx.mode !== "next-step" || !ctx.nextStep?.id) {
    showToast("当前没有可进入的下一步");
    return;
  }
  if (ctx.nextStep.related) {
    state.relatedModelReturnContext = {
      mainViewId: ctx.nextStep.mainViewId,
      mainLabel: getViewMeta(ctx.nextStep.mainViewId)?.label || "主步骤",
      relatedViewId: ctx.nextStep.id,
      scrollSnapshots: captureViewScroll($("#viewRoot"))
    };
  }
  await navigateToResearchView(ctx.nextStep.id, {
    toast: `已进入${ctx.nextStep.label}`,
    force: true,
    entrySource: generate ? (ctx.nextStep.mainViewId || ctx.current?.id || "default") : "default"
  });
}

async function advanceRelatedWorkflow() {
  const ctx = resolveWorkflowGateContext(state);
  if (ctx.mode !== "related-next-step" || !ctx.nextStep?.id) {
    showToast("当前没有可进入的下一步");
    return;
  }
  if (state.activeView === "ov6a" && (state.ov6a?.ruleChangeSet?.changes || []).some((item) => item.status === "pending")) {
    showToast("请先在规则库接受或忽略全部待审核建议，再生成状态机");
    return;
  }
  if (ctx.nextStep.related) {
    const current = state.relatedModelReturnContext || {};
    state.relatedModelReturnContext = {
      ...current,
      mainViewId: ctx.mainViewId,
      mainLabel: current.mainLabel || getViewMeta(ctx.mainViewId)?.label || "主步骤",
      relatedViewId: ctx.nextStep.id
    };
  } else {
    state.relatedModelReturnContext = null;
  }
  const completesPhaseSubflow = ctx.mainViewId === "phase-action"
    && state.activeView === "ov6c"
    && ctx.nextStep.id === "operational-task";
  await navigateToResearchView(ctx.nextStep.id, {
    toast: `已进入${ctx.nextStep.label}`,
    force: true,
    entrySource: ctx.mainViewId,
    completeOperationalTasks: completesPhaseSubflow
  });
}

/** Last step of a phase: confirm and unlock the next phase. */
async function completeWorkflowStage() {
  if (state.workflowCompleting) return;
  const workflow = currentWorkflow();
  const ctx = resolveWorkflowGateContext(state);
  // Prefer the phase of the active last-step page; fall back to classic next-stage index.
  const stage = Number.isInteger(ctx.phaseIndex) && ctx.phaseIndex >= 0
    ? ctx.phaseIndex
    : nextWorkflowStage(workflow);
  const incompleteReasons = getWorkflowStageIncompleteReasons(state, stage);
  if (incompleteReasons.length) {
    setWorkflowGateOpen(true);
    showToast(`尚不能进入${workflowPhases[stage + 1] || "交付完成"}：请先完成${incompleteReasons.join("、")}`);
    return;
  }
  if (completedWorkflowStage(workflow) >= stage) {
    // Already confirmed — just walk forward if possible (same pregenerate path as “下一步”).
    if (ctx.nextStep?.id) {
      await advanceWorkflowStep();
      return;
    }
    showToast("本阶段已确认");
    return;
  }
  state.workflowCompleting = true;
  refreshWorkflowGateUi();
  try {
    await updateProject(state.activeProjectId, { workflow: { ...workflow, completedThrough: stage, updatedAt: new Date().toISOString() } });
    state.workflowGateOpen = false;
    const followingPhase = workflowPhases[stage + 1];
    const nextMainView = followingPhase ? views.find((view) => view.phase === followingPhase)?.id : "";
    const relatedViewId = contextualFlowViewIds(ctx.current?.id, state)[0] || "";
    const nextView = relatedViewId || nextMainView;
    if (relatedViewId) {
      state.relatedModelReturnContext = {
        mainViewId: ctx.current.id,
        mainLabel: ctx.current.label || "主步骤",
        relatedViewId,
        scrollSnapshots: captureViewScroll($("#viewRoot"))
      };
    }
    if (nextView) goToWorkflowView(nextView);
    await hydrateProjectDirectory({ skipRender: true });
    showToast(relatedViewId
      ? `当前阶段已确认，已进入关联流程${relatedViewLabel(relatedViewId)}`
      : nextView ? "当前阶段已确认，已进入下一阶段" : "工作流已确认完成");
    if (stage === 1 && nextMainView === "operational-task") {
      await conceptPlanningController.generateOperationalTasks({ silent: false });
    }
    if (stage === 2 && nextMainView === "force-mission") {
      await conceptPlanningController.generateForceMission({ silent: false, layer: "concept" });
    }
    if (stage === 3 && nextMainView === "ov1") {
      if (!state.conceptGraphic?.nodes?.length && !state.ov1Candidate) {
        await ov1AiController.generateOv1();
      }
    }
    if (stage === 4 && nextMainView === "concept-map" && typeof conceptMapController.seedFromPlanning === "function") {
      await conceptMapController.seedFromPlanning({ silent: false });
    }
    if (stage === 5 && nextMainView === "scenario") {
      if (!state.scenario || !state.scenario.entities?.length) {
        await scenarioController.compileOrGenerateScenario({ silent: false, forceAi: true });
      }
    }
    if (nextView === "ov4") {
      await dodafProductController.pregenerateOv4FromForceMission({ silent: false });
    }
  } catch {
    showToast("阶段状态保存失败，请重试");
  } finally {
    state.workflowCompleting = false;
    render();
  }
}

async function setWorkflowMode(mode) {
  const workflow = currentWorkflow();
  if (!["gated", "free"].includes(mode) || workflow.mode === mode || state.workflowModeSwitching || state.reportArchiving) return;
  const previousMode = workflow.mode || "gated";
  const projectEntry = state.projectDirectory?.projects?.find((item) => item.id === state.activeProjectId);
  const nextWorkflow = { ...workflow, mode, updatedAt: new Date().toISOString() };
  state.workflowModeSwitching = true;
  if (projectEntry) projectEntry.workflow = nextWorkflow;
  render();
  try {
    await updateProject(state.activeProjectId, { workflow: nextWorkflow });
    await hydrateProjectDirectory({ skipRender: true });
    await settleBusyTransition();
  } catch {
    if (projectEntry) projectEntry.workflow = { ...workflow, mode: previousMode };
    showToast("工作模式保存失败，请重试");
  } finally {
    state.workflowModeSwitching = false;
    render();
  }
}

function getBusyOverlayState() {
  if (state.taskDecompositionPregenerating) {
    return { key: "task-organization-pregenerate", title: "正在整理任务", detail: "AI 正在仅依据已确认任务进行分组、排序与协同梳理…", expectedMs: 90000, timeoutMs: 180000 };
  }
  if (state.operationalTaskGenerating) {
    const progress = state.operationalTaskGenerationProgress;
    const completed = Number(progress?.completed) || 0;
    const total = Number(progress?.total) || 0;
    return {
      key: "operational-task-generate",
      title: "正在进入作战任务",
      detail: total > 0
        ? `AI 正在生成并补全任务内容（${completed}/${total} 批）…`
        : "AI 正在依据阶段行动生成任务并补全任务区域…",
      expectedMs: 120000,
      timeoutMs: 240000,
      progressPercent: total > 0 ? Math.round((completed / total) * 100) : null
    };
  }
  if (state.ruleLibraryPregenerating) {
    return {
      key: "rule-library-pregenerate",
      title: "正在进入阶段行动",
      detail: "根据简报生成作战规则…",
      expectedMs: 90000,
      timeoutMs: 180000
    };
  }
  if (state.ruleLibraryChangeGenerating) {
    return {
      key: "rule-library-change",
      title: "正在分析阶段规则",
      detail: "根据阶段目标、行动、进入与退出条件生成待审核规则建议…",
      expectedMs: 90000,
      timeoutMs: 180000
    };
  }
  if (state.combatFocusGenerating) {
    return {
      key: "combat-focus",
      title: "正在进入阶段行动",
      detail: "根据简报生成 3 个作战聚焦方向…",
      expectedMs: 60000,
      timeoutMs: 180000
    };
  }
  if (state.stateMachinePregenerating) {
    return {
      key: "state-machine-pregenerate",
      title: "正在进入状态机校验",
      detail: state.ov6GenerationContext === "task" ? "根据任务规则生成逐任务状态机…" : "根据阶段与行动分析阶段状态和转换条件…",
      expectedMs: 90000,
      timeoutMs: 180000
    };
  }
  if (state.sequencePregenerating) {
    return {
      key: "sequence-pregenerate",
      title: "正在进入时序图",
      detail: state.ov6GenerationContext === "task" ? "AI 正在根据任务状态机生成逐任务时序图…" : "AI 正在生成各推演方及每个阶段的时序图…",
      expectedMs: 90000,
      timeoutMs: 180000
    };
  }
  if (state.ov4Pregenerating) {
    return {
      key: "ov4-pregenerate",
      title: "正在进入组织关系",
      detail: "AI 正在根据作战兵力生成指挥、保障与信息关系…",
      expectedMs: 90000,
      timeoutMs: 180000
    };
  }
  if (state.workflowModeSwitching) {
    const testModeActive = currentWorkflow().mode === "free";
    return {
      key: "workflow-mode",
      title: testModeActive ? "正在进入测试模式" : "正在恢复阶段门禁",
      detail: testModeActive ? "所有研究阶段将可自由访问" : "工作流将按阶段门禁恢复",
      expectedMs: 1500,
      timeoutMs: 10000
    };
  }
  if (state.reportArchiving) {
    return {
      key: "report-archive",
      title: "正在保存报告版本",
      detail: "打包研究成果、生成校验并写入归档…",
      expectedMs: 8000,
      timeoutMs: 30000
    };
  }
  return null;
}

function updateBusyOverlay(busy = getBusyOverlayState()) {
  const overlay = $("#workflowModeOverlay");
  if (!overlay) return;
  const title = $("#workflowModeOverlayTitle");
  const detail = $("#workflowModeOverlayDetail");
  if (busy) {
    const key = busy.key || busy.title;
    if (busyOverlayKey !== key) {
      busyOverlayKey = key;
      busyOverlayStartedAt = Date.now();
    }
    if (title) title.textContent = busy.title;
    if (detail) detail.textContent = busy.detail;
    updateBusyOverlayProgress(busy);
    if (!busyOverlayTimer) {
      busyOverlayTimer = window.setInterval(() => {
        const current = getBusyOverlayState();
        if (current) updateBusyOverlayProgress(current);
      }, 500);
    }
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
    return;
  }
  if (busyOverlayTimer) window.clearInterval(busyOverlayTimer);
  busyOverlayTimer = 0;
  busyOverlayKey = "";
  busyOverlayStartedAt = 0;
  overlay.classList.remove("is-visible");
  window.setTimeout(() => {
    if (!getBusyOverlayState()) overlay.hidden = true;
  }, 220);
}

function updateBusyOverlayProgress(busy) {
  const elapsedMs = Math.max(0, Date.now() - busyOverlayStartedAt);
  const expectedMs = Math.max(1000, Number(busy.expectedMs) || 30000);
  const timeoutMs = Math.max(expectedMs, Number(busy.timeoutMs) || expectedMs * 2);
  const estimatedPercent = elapsedMs <= expectedMs
    ? Math.min(90, Math.round(8 + (elapsedMs / expectedMs) * 82))
    : Math.min(97, Math.round(90 + ((elapsedMs - expectedMs) / Math.max(1, timeoutMs - expectedMs)) * 7));
  const reportedPercent = Number.isFinite(busy.progressPercent)
    ? Math.max(0, Math.min(100, busy.progressPercent))
    : null;
  const displayedPercent = reportedPercent === null
    ? estimatedPercent
    : Math.max(reportedPercent, Math.min(estimatedPercent, 95));
  const progress = $(".workflow-mode-progress");
  const bar = $("#workflowModeProgressBar");
  const elapsed = $("#workflowModeElapsed");
  const estimate = $("#workflowModeEstimate");
  const hint = $("#workflowModeProgressHint");
  if (progress) progress.setAttribute("aria-valuenow", String(displayedPercent));
  if (bar) bar.style.width = `${displayedPercent}%`;
  if (elapsed) elapsed.textContent = `已用时 ${formatBusyDuration(elapsedMs)}`;
  if (estimate) estimate.textContent = elapsedMs <= expectedMs
    ? `通常 ${formatBusyDuration(expectedMs / 2)}～${formatBusyDuration(expectedMs)}`
    : `服务超时上限 ${formatBusyDuration(timeoutMs)}`;
  if (hint) hint.textContent = reportedPercent !== null
    ? "进度按已完成生成批次与预计耗时综合显示"
    : elapsedMs <= expectedMs
    ? "进度按预计耗时估算，实际以 AI 返回为准"
    : (elapsedMs < timeoutMs
      ? "已超过常见耗时，服务仍在处理；到达上限后会自动结束并提示重试"
      : "已到达超时上限，正在等待请求结束");
}

function formatBusyDuration(ms) {
  const seconds = Math.max(0, Math.round(Number(ms) / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分钟`;
}

function settleBusyTransition(minMs = 280) {
  return new Promise((resolve) => window.setTimeout(resolve, minMs));
}

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function switchProject(projectId) {
  if (!projectId || (projectId === state.activeProjectId && !state.projectEntryRequired)) return;
  const url = new URL(window.location.href);
  url.searchParams.set("project", projectId);
  window.location.assign(url);
}

/** Update only the top project dropdown; leave concept-map iframe untouched. */
function renderProjectManagerChrome() {
  const root = $("#projectManagerRoot");
  if (!root) return;
  root.innerHTML = renderProjectManager({
    directory: state.projectDirectory,
    activeProjectId: state.activeProjectId,
    open: state.projectManagerOpen,
    createOpen: state.projectCreateOpen,
    isLead: state.collaboration?.session?.actor?.roles?.includes("lead")
  });
  root.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action, button));
  });
  root.querySelectorAll("[data-project-switch]").forEach((button) => {
    button.addEventListener("click", () => switchProject(button.dataset.projectSwitch));
  });
  root.querySelectorAll("[data-project-archive]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await updateProject(button.dataset.projectArchive, { archived: button.dataset.projectArchived === "true" });
        await hydrateProjectDirectory();
        renderProjectManagerChrome();
      } catch {
        showToast("项目状态更新失败，请确认负责人身份");
      }
    });
  });
  root.querySelectorAll("[data-project-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const title = button.dataset.projectTitle || button.dataset.projectDelete;
      if (!window.confirm(`将永久删除项目“${title}”及其所有数据，此操作无法恢复。确定继续吗？`)) return;
      try {
        await deleteProject(button.dataset.projectDelete);
        showToast("已删除项目");
        await hydrateProjectDirectory();
        renderProjectManagerChrome();
      } catch (error) {
        showToast(error?.status === 403 ? "只有负责人可删除项目" : "项目删除失败：请先归档并确认项目状态");
      }
    });
  });
  root.querySelector("#projectCreateForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try {
      const result = await createProject({
        id: values.get("id"),
        title: values.get("title"),
        description: values.get("description")
      });
      switchProject(result.project.id);
    } catch {
      showToast("项目创建失败，请检查项目标识和名称");
    }
  });
}

function saveActivity(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const activity = updateActivity(state.ov5, state.selection.id, {
    title: formData.get("title").trim() || "未命名活动",
    type: formData.get("type").trim() || "待分类",
    input: formData.get("input").trim() || "待定义",
    output: formData.get("output").trim() || "待定义",
    duration: formData.get("duration").trim() || "待估算",
    parentId: formData.get("parentId").trim(),
    resources: formData.get("resources").trim(),
    preconditions: formData.get("preconditions").trim(),
    constraints: formData.get("constraints").trim(),
    text: formData.get("text").trim() || "补充该活动的任务说明。",
    refs: formData.get("refs").split(/[、,，]/).map((item) => item.trim()).filter(Boolean),
    sourceOv1NodeIds: formData.getAll("sourceOv1NodeIds").map((item) => item.trim()).filter(Boolean)
  });
  invalidateDerivedArtifacts();
  void projectOv5SyncController.sync(state.ov5, { source: "manual" });
  void dodafProductController.syncFromOv5b({ source: "manual" });
  state.selection = selectionFor("activity", activity.id, getModels());
  const sourceCount = activity.sourceOv1NodeIds?.length || 0;
  showToast(sourceCount ? `活动已保存（${sourceCount} 个总体图来源），活动分解关系已同步` : "活动已保存；尚未挂接总体图来源；活动分解关系已同步");
  render();
}

function saveEdge(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const edge = addEdge(state.ov5, state.selection.id, formData.get("targetId"), formData.get("type"), {
    payload: formData.get("payload"),
    condition: formData.get("condition")
  });
  if (edge) invalidateDerivedArtifacts();
  if (edge) void projectOv5SyncController.sync(state.ov5, { source: "manual" });
  showToast(edge ? "活动关联已建立" : "该关联已存在或无效");
  render();
}

function getModels() {
  return { ov1: state.ov1, ov5: state.ov5, ooda: state.ooda, scenario: state.scenario, validationResult: state.validationResult, knowledge: state.knowledge, knowledgeQuery: state.knowledgeQuery, conceptMap: state.conceptMap };
}

function invalidateConceptMapDependents() {
  state.ov1Storage = markStorageStale(state.ov1Storage, "Concept map changed; review or regenerate concept graphic before relying on it.");
  state.ov5Storage = markStorageStale(state.ov5Storage, "Concept map changed; review or regenerate activity model before relying on it.");
  invalidateDerivedArtifacts();
}

function invalidateDerivedArtifacts() {
  // Keep scenario as a stale reference (same pattern as validation/OODA) so researchers can compare before regenerating.
  if (state.scenario) {
    state.scenario = markScenarioStale(state.scenario, "上游活动模型/研究循环已变更，上次想定仅供参考，请重新生成。");
  }
  state.lastDeploymentData = null;
  markCurrentValidationStale("上游模型已变更，上次设计验证仅供参考，请重新运行。");
  state.oodaStorage = markStorageStale(state.oodaStorage, "Upstream model changed; review or regenerate OODA before relying on it.");
  state.scenarioStorage = markStorageStale(state.scenarioStorage, "Upstream model changed; the previous scenario is no longer current.");
  state.validationStorage = markStorageStale(state.validationStorage, "Upstream model changed; the previous validation is no longer current.");
  state.redTeamRunning = false;
  state.deployment.open = false;
  state.deployment.status = "等待生成";
}

function invalidateValidation() {
  markCurrentValidationStale("想定或行为模型已变更，上次设计验证仅供参考，请重新运行。");
  state.validationStorage = markStorageStale(state.validationStorage, "Scenario or behavior model changed; run validation again.");
  state.redTeamRunning = false;
}

function markCurrentValidationStale(reason) {
  if (!state.validationResult) {
    clearValidation();
    return;
  }
  state.validationResult = markValidationStale(state.validationResult, reason);
  persistValidation(state.validationResult);
}

function invalidateRedTeam() {
  state.redTeamRunning = false;
  if (state.validationResult) clearRedTeamReview(state.validationResult);
}

function markStorageStale(storage, detail) {
  if (!storage || storage.status === "checking") return storage;
  return {
    ...storage,
    status: "stale",
    mode: "local",
    detail,
    stale: true
  };
}

// Hover-nav convention: short enough to feel responsive, long enough to cross trigger→panel.
const MENUBAR_IDLE_DISMISS_MS = 300;
let menubarIdleTimer = null;
let menubarPointerInside = false;

function closeMenubarMenus(except = null) {
  document.querySelectorAll(".menubar-menu[open]").forEach((menu) => {
    if (menu !== except) menu.open = false;
  });
}

function isMenubarChromeOpen() {
  return Boolean(document.querySelector(".menubar-menu[open]")) || Boolean(state.projectManagerOpen);
}

function isInsideMenubarChrome(node) {
  if (!(node instanceof Element)) return false;
  return Boolean(node.closest(".menubar-menu, .project-manager-root"));
}

function isInsideOpenMenubarChrome(node) {
  if (!(node instanceof Element)) return false;
  if (node.closest(".menubar-menu[open]")) return true;
  if (state.projectManagerOpen && node.closest(".project-manager-root")) return true;
  return false;
}

function clearMenubarIdleTimer() {
  if (!menubarIdleTimer) return;
  clearTimeout(menubarIdleTimer);
  menubarIdleTimer = null;
}

/**
 * Start 3s idle dismiss after pointer leaves the open surface.
 * Do not gate on document.activeElement: open menus keep focus on <summary>,
 * which would permanently block dismiss after hover-open.
 */
function scheduleMenubarIdleDismiss() {
  clearMenubarIdleTimer();
  if (!isMenubarChromeOpen()) return;
  menubarIdleTimer = window.setTimeout(() => {
    menubarIdleTimer = null;
    if (menubarPointerInside) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest("#projectCreateForm")) return;
    dismissMenubarChrome();
  }, MENUBAR_IDLE_DISMISS_MS);
}

/** Close research/tool/knowledge menus and the project switcher. */
function dismissMenubarChrome() {
  clearMenubarIdleTimer();
  menubarPointerInside = false;
  const active = document.activeElement;
  if (active instanceof HTMLElement && isInsideOpenMenubarChrome(active)) {
    active.blur();
  }
  const hadMenus = Boolean(document.querySelector(".menubar-menu[open]"));
  const hadProject = Boolean(state.projectManagerOpen);
  closeMenubarMenus();
  if (!hadProject) return hadMenus;
  state.projectManagerOpen = false;
  state.projectCreateOpen = false;
  // Never full-render on concept-map — that reloads the embedded map tool.
  refreshProjectManagerUi();
  return true;
}

function focusOpenMenubarChrome() {
  if (!state.projectManagerOpen) return;
  if (state.projectCreateOpen) {
    const titleInput = document.querySelector('#projectCreateForm input[name="title"]');
    if (titleInput instanceof HTMLElement) {
      titleInput.focus({ preventScroll: true });
      return;
    }
  }
  const panel = document.querySelector(".project-manager-panel");
  if (panel instanceof HTMLElement) panel.focus({ preventScroll: true });
}

function openMenubarMenu(menu) {
  if (!(menu instanceof HTMLDetailsElement)) return;
  if (menu.open) {
    clearMenubarIdleTimer();
    return;
  }
  menu.open = true;
}

/**
 * Open/close project switcher without rebuilding viewRoot.
 * Hover on the top project control must not reload the concept-map iframe.
 */
function refreshProjectManagerUi() {
  if (state.activeView === "concept-map") {
    renderProjectManagerChrome();
    return;
  }
  render();
}

function openProjectManagerFromHover() {
  if (state.projectManagerOpen) {
    clearMenubarIdleTimer();
    return;
  }
  closeMenubarMenus();
  state.projectManagerOpen = true;
  refreshProjectManagerUi();
  queueMicrotask(() => focusOpenMenubarChrome());
}

/**
 * Top menubar policy:
 * - hover button → open / keep open
 * - pointer stays in menu or panel → stay open
 * - leave the area → auto close after 3s
 * - re-enter within 3s → cancel close
 * - pointer outside click / Escape → close immediately
 * - only one chrome surface open at a time
 */
function bindMenubarChrome() {
  if (bindMenubarChrome.bound) return;
  bindMenubarChrome.bound = true;

  document.querySelectorAll(".menubar-menu").forEach((menu) => {
    menu.addEventListener("toggle", () => {
      if (!menu.open) {
        if (!isMenubarChromeOpen()) clearMenubarIdleTimer();
        return;
      }
      closeMenubarMenus(menu);
      clearMenubarIdleTimer();
      if (state.projectManagerOpen) {
        state.projectManagerOpen = false;
        state.projectCreateOpen = false;
        refreshProjectManagerUi();
      }
      // Do not force-focus summary on open: that kept activeElement inside the menu
      // and blocked idle dismiss after the pointer left.
    });
  });

  // Hover open + keep-alive while pointer is over any menubar surface.
  document.addEventListener("pointerover", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const menu = target.closest(".menubar-menu");
    const projectRoot = target.closest(".project-manager-root");
    if (!menu && !projectRoot) return;

    menubarPointerInside = true;
    clearMenubarIdleTimer();

    if (menu) {
      openMenubarMenu(menu);
      return;
    }

    // Project trigger / open panel: hover keeps or opens the switcher.
    if (projectRoot && (target.closest(".project-manager-trigger") || state.projectManagerOpen)) {
      if (target.closest(".project-manager-trigger") || projectRoot.classList.contains("is-open")) {
        openProjectManagerFromHover();
      }
    }
  });

  document.addEventListener("pointerout", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!isInsideMenubarChrome(target)) return;

    const related = event.relatedTarget;
    if (related instanceof Element && isInsideMenubarChrome(related)) {
      // Moving between summary ↔ panel, or menu ↔ project, still counts as inside chrome.
      menubarPointerInside = true;
      clearMenubarIdleTimer();
      return;
    }

    menubarPointerInside = false;
    if (isMenubarChromeOpen()) scheduleMenubarIdleDismiss();
  });

  // Hard dismiss on outside press (do not wait the idle timer).
  document.addEventListener("pointerdown", (event) => {
    if (!isMenubarChromeOpen()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (isInsideOpenMenubarChrome(target) || isInsideMenubarChrome(target)) {
      clearMenubarIdleTimer();
      return;
    }
    if (target.closest('[data-action="toggle-project-manager"]')) {
      closeMenubarMenus();
      clearMenubarIdleTimer();
      return;
    }
    dismissMenubarChrome();
  }, true);

  // Focus left open surface: same 3s grace unless pointer is still inside.
  document.addEventListener("focusout", (event) => {
    if (!isMenubarChromeOpen()) return;
    const from = event.target;
    if (!(from instanceof Element) || !isInsideOpenMenubarChrome(from)) return;
    const next = event.relatedTarget;
    if (next instanceof Element && isInsideOpenMenubarChrome(next)) return;
    requestAnimationFrame(() => {
      if (!isMenubarChromeOpen()) return;
      if (menubarPointerInside) {
        clearMenubarIdleTimer();
        return;
      }
      scheduleMenubarIdleDismiss();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !isMenubarChromeOpen()) return;
    event.preventDefault();
    dismissMenubarChrome();
  });
}

/** Capsule: click to expand; auto-collapse when pointer leaves the capsule region. */
function bindWorkflowGateChrome() {
  const root = document.getElementById("workflowGateRoot");
  // Delegate clicks on the permanent root so rebuilds keep working.
  if (root && root.dataset.actionsBound !== "true") {
    root.dataset.actionsBound = "true";
    root.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("[data-action]");
      if (!button || !root.contains(button)) return;
      handleAction(button.dataset.action, button);
    });
  }

  let leaveTimer = null;
  const clearLeaveTimer = () => {
    if (!leaveTimer) return;
    clearTimeout(leaveTimer);
    leaveTimer = null;
  };

  const collapseGate = () => {
    clearLeaveTimer();
    if (!state.workflowGateOpen) return;
    // Soft close — do not rebuild DOM (avoids click/leave races).
    setWorkflowGateOpen(false);
  };

  document.addEventListener("pointerover", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest("#workflowGateRoot [data-workflow-gate-shell]")) return;
    clearLeaveTimer();
  }, true);

  document.addEventListener("pointerout", (event) => {
    if (!state.workflowGateOpen) return;
    if (performance.now() < workflowGateLeaveSuppressedUntil) return;
    const from = event.target;
    if (!(from instanceof Element) || !from.closest("#workflowGateRoot [data-workflow-gate-shell]")) return;
    const to = event.relatedTarget;
    if (to instanceof Element && to.closest("#workflowGateRoot [data-workflow-gate-shell]")) return;
    // If the node was detached by a re-render, relatedTarget is often null — ignore those.
    if (!(to instanceof Element) && !document.contains(from)) return;
    clearLeaveTimer();
    leaveTimer = window.setTimeout(collapseGate, 160);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !state.workflowGateOpen) return;
    event.preventDefault();
    collapseGate();
  });
}

bindMenubarChrome();
bindWorkflowGateChrome();
