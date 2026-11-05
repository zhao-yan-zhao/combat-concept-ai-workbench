import { directions, project, views, workflowPhases } from "./data.js";
import { createInitialWorkbenchState } from "./app/createInitialState.js";
import { workflowPrimaryStepIds } from "./data.js";
import { $, downloadArtifact as downloadArtifactHelper, downloadBlob, escapeHtml, initNotificationCapsule, setBackgroundTaskState, showToast, writePrintableReport as writePrintableReportHelper } from "./app/domUtils.js";
import { completedWorkflowStage, currentProjectTitle as currentProjectTitleFor, currentWorkflow as currentWorkflowFor, getWorkflowStageIncompleteReasons, nextWorkflowStage, renderWorkflowGate as renderWorkflowGateFor, resolveWorkflowGateContext } from "./app/workflowGate.js";
import { wireControllers } from "./app/wireControllers.js";
import { deriveOodaFromOv5, getOodaDuration, persistOodaModel } from "./oodaStore.js";
import { addActivity, addEdge, deleteActivity, deleteEdge, persistOv5Model, updateActivity } from "./ov5Store.js";
import { countUnmappedOv5Activities, linkOv5ActivitiesToOv1, suggestOv1SourcesForActivity } from "./ov5Ov1Linker.js";
import { applyMappingQuality } from "./ov5MappingQuality.js";
import { markScenarioStale, persistScenario } from "./scenarioStore.js";
import { getViewMeta, renderBriefSidebar, renderInspector, renderTree, renderView, selectionFor } from "./ui.js";
import { clearValidation, markValidationStale, persistValidation } from "./validationStore.js";
import { clearRedTeamReview } from "./redTeamStore.js";
import { renderCollaborationLoginGate } from "./collaborationView.js";
import { buildExportArtifactFromPayload } from "./reportBuilder.js";
import { deleteReportVersion, persistReportVersions, upsertReportVersion } from "./reportVersionStore.js";
import { areConceptBriefsEqual, saveConceptBrief } from "./briefStore.js";
import { saveInspirationSession } from "./inspirationStore.js";
import { buildDirectionProposals, saveCustomDirections, saveSelectedDirection } from "./directionProposalStore.js";
import { deriveResearchChatBriefUpdate } from "./researchChatBriefUpdate.js";
import { saveOv1Model } from "./ov1Store.js";
import { createLocalOv1Draft } from "./ov1DraftStore.js";
import { renderOv1ToolboxFloatButton } from "./ov1View.js";
import { contextualFlowViewIds, mountRelatedModelReturn, relatedViewLabel, renderRelatedModelReturn, resolveModelFocus, resolveRelatedMainViewId } from "./contextualModelFlow.js";
import { renderSequenceToolboxFloatButton } from "./ov6cView.js";
import { renderStateMachineToolboxFloatButton } from "./stateMachineView.js";
import { renderOv4ToolboxFloatButton } from "./ov4View.js";
import { renderSubflowToolboxFloatButton } from "./subflowToolbox.js";
import { mountGroupedLists } from "./groupedListTemplate.js";

import { deleteModelSnapshot, persistModelSnapshots, upsertModelSnapshot } from "./modelSnapshotStore.js";
import { restoreModelSnapshot } from "./modelSnapshotRestore.js";
import { buildModelComparisonArtifact } from "./modelComparisonBuilder.js";
import { renderAiConfigPanel } from "./aiConfigView.js";
import { renderAiPromptPanel } from "./aiPromptView.js";
import { getCmoCatalogStatus } from "./cmoCatalogClient.js";
import { applyTheme, getThemeConfig } from "./themeConfigClient.js";
import { renderProjectStorageFooter } from "./projectStorageView.js";
import { createProject, deleteProject, loadProjects, resetProjectContent, updateProject } from "./projectBriefClient.js";
import { ensureClientStoragePurged, purgeProjectClientStorage } from "./clientStoragePurge.js";
import { renderProjectManager, renderProjectEntry } from "./projectManagerView.js";
import { normalizeConceptMap, persistConceptMap } from "./conceptMapStore.js";
import { normalizeForceMissionPlan, persistForceMission } from "./forceMissionStore.js";
import { normalizePhaseActionConcept, persistPhaseAction } from "./phaseActionStore.js";
import { normalizeConceptGraphicPlan, persistConceptGraphic } from "./conceptGraphicStore.js";

import { createStateActions } from "./app/stateActions.js";
import {
  bindOv5Events,
  handleOv5Action,
  bindOv5aDragAndDrop,
  saveActivity,
  saveEdge
} from "./app/bindings/ov5Bindings.js";
import { bindForceMissionEvents, handleForceMissionAction } from "./app/bindings/forceMissionBindings.js";
import { bindRulesEvents, handleRulesAction } from "./app/bindings/rulesBindings.js";
import {
  bindDodafEvents,
  handleDodafAction,
  jumpFromStructureReview,
  exportStructureReviewChecklist,
  attachStructureReviewToCollaboration,
  applyOv1CandidateWithRecoveryPoint,
  bindOv1SourcePicker,
  refreshOv1SourcePicker
} from "./app/bindings/dodafBindings.js";
import { bindReportEvents, handleReportAction } from "./app/bindings/reportBindings.js";

const { state, projectBriefSeed, activeProjectId } = createInitialWorkbenchState();
const stateActions = createStateActions({ state, getModels: () => getModels(), render: (opt) => render(opt), showToast });

function getOv5Ctx() {
  return {
    state,
    stateActions,
    render,
    showToast,
    addEventListenerOnce,
    $,
    getModels,
    select,
    navigateToResearchView,
    invalidateDerivedArtifacts,
    projectOv5SyncController,
    dodafProductController,
    ov5AiController,
    bindOv1SourcePicker,
    handleAction
  };
}

function getDodafCtx() {
  return {
    state,
    render,
    showToast,
    select,
    addEventListenerOnce,
    $,
    activeProjectId,
    getViewMeta,
    currentProjectTitle,
    downloadArtifact,
    navigateToResearchView,
    completeWorkflowStage,
    dodafProductController,
    projectOv1SyncController,
    invalidateDerivedArtifacts,
    jumpFromStructureReview: (v, tk, ti) => jumpFromStructureReview(v, tk, ti, getDodafCtx()),
    applyOv1CandidateWithRecoveryPoint,
    exportStructureReviewChecklist,
    attachStructureReviewToCollaboration
  };
}

function getReportCtx() {
  return {
    state,
    project,
    render,
    showToast,
    addEventListenerOnce,
    $,
    downloadArtifact,
    writePrintableReport,
    updateBusyOverlay,
    getBusyOverlayState,
    waitForPaint,
    settleBusyTransition,
    projectReportArchiveSyncController
  };
}
let busyOverlayTimer = 0;
let busyOverlayKey = "";
let busyOverlayStartedAt = 0;
let busyOverlayMinimized = false;

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
  ov2CanvasController,
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
  invalidatePhaseActionDependents,
  invalidateForceMissionDependents,
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
  const skipView = Boolean(options.skipViewRoot);
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
  const projectStorageMarkup = renderProjectStorageFooter(state.projectStorage);
  const projectStorageElem = $("#projectStorageState");
  if (projectStorageElem && projectStorageElem.dataset.renderedMarkup !== projectStorageMarkup) {
    projectStorageElem.innerHTML = projectStorageMarkup;
    projectStorageElem.dataset.renderedMarkup = projectStorageMarkup;
  }
  const projectManagerMarkup = renderProjectManager({ directory: state.projectDirectory, activeProjectId: state.activeProjectId, open: state.projectManagerOpen, createOpen: state.projectCreateOpen, isLead: state.collaboration?.session?.actor?.roles?.includes("lead") });
  const projectManagerElem = $("#projectManagerRoot");
  if (projectManagerElem && projectManagerElem.dataset.renderedMarkup !== projectManagerMarkup) {
    projectManagerElem.innerHTML = projectManagerMarkup;
    projectManagerElem.dataset.renderedMarkup = projectManagerMarkup;
  }
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
  const aiConfigMarkup = renderAiConfigPanel({
    open: state.aiConfigOpen,
    service: state.aiConfig,
    saving: state.aiConfigSaving,
    fetchingModels: state.aiConfigFetchingModels,
    fetchedModels: state.aiConfigFetchedModels,
    modelFetchHint: state.aiConfigModelFetchHint
  });
  const aiConfigElem = $("#aiConfigRoot");
  if (aiConfigElem && aiConfigElem.dataset.renderedMarkup !== aiConfigMarkup) {
    aiConfigElem.innerHTML = aiConfigMarkup;
    aiConfigElem.dataset.renderedMarkup = aiConfigMarkup;
  }

  const aiPromptMarkup = renderAiPromptPanel({
    open: state.aiPromptOpen,
    catalog: state.aiPromptCatalog,
    selectedId: state.aiPromptSelectedId,
    saving: state.aiPromptSaving,
    drafts: state.aiPromptDrafts || {}
  });
  const aiPromptElem = $("#aiPromptRoot");
  if (aiPromptElem && aiPromptElem.dataset.renderedMarkup !== aiPromptMarkup) {
    aiPromptElem.innerHTML = aiPromptMarkup;
    aiPromptElem.dataset.renderedMarkup = aiPromptMarkup;
  }

  const workflowGateMarkup = renderWorkflowGate();
  const workflowGateElem = $("#workflowGateRoot");
  if (workflowGateElem && workflowGateElem.dataset.renderedMarkup !== workflowGateMarkup) {
    workflowGateElem.innerHTML = workflowGateMarkup;
    workflowGateElem.dataset.renderedMarkup = workflowGateMarkup;
  }
  renderOv1ToolboxFloatHost();
  // Project picker / menubar chrome toggles must not rebuild the concept-map iframe.
  if (!skipView) {
    let renderResult = null;
    if (!state.projectEntryRequired) {
      renderResult = renderViewRoot(options);
    }
    if (!renderResult?.transitionPending && (!renderResult?.domUpdated || state.projectEntryRequired)) {
      renderInspectorPanel();
      resizeBriefTextareas();
      closeOv1ModalIfOpen();
      bindDynamicEvents();
      restoreViewFocus(document, appFocusSnapshot);
      restoreViewScroll(document, appScrollSnapshots);
    }
  } else {
    // Fast path: bind dialog and chrome handlers without tearing down and re-binding page views
    aiConfigController.bind(document);
    aiPromptController.bind(document);
  }
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

let lastRenderedView = "";
let viewSwitchTimer = 0;

/**
 * Re-render the active view. Concept-map iframe is NOT inside the HTML string —
 * it lives in a persistent host and is re-attached after each render so opening
 * the project picker / toasts never reloads combat-map-web.
 */
function renderViewRoot(options = {}) {
  const viewRoot = $("#viewRoot");
  if (!viewRoot) return { transitionPending: false };
  const currentView = state.activeView;
  const isViewSwitch = Boolean(lastRenderedView && lastRenderedView !== currentView);
  const newMarkup = renderView(currentView, { ...state, oodaDuration: getOodaDuration(state.ooda) });

  if (!options.force && !isViewSwitch && viewRoot.dataset.renderedMarkup === newMarkup && viewRoot.dataset.renderedView === currentView) {
    return { transitionPending: false, domUpdated: false };
  }

  const scrollSnapshots = captureViewScroll(viewRoot);
  const focusSnapshot = captureViewFocus(viewRoot);
  // Park iframe before wiping viewRoot so the node is never destroyed with innerHTML.
  parkConceptMapFrame();

  const applyDomUpdate = () => {
    try {
      viewRoot.dataset.renderedView = currentView;
      viewRoot.dataset.renderedMarkup = newMarkup;
      lastRenderedView = currentView;

      viewRoot.innerHTML = newMarkup;
      mountRelatedModelReturn(viewRoot, renderRelatedModelReturn(state));
      mountConceptMapFrame();
      mountGroupedLists(viewRoot);
      restoreViewFocus(viewRoot, focusSnapshot);
      restoreViewScroll(viewRoot, scrollSnapshots, {
        resetInnerPhaseScroll: Boolean(options.resetInnerPhaseScroll)
      });
      renderInspectorPanel();
      resizeBriefTextareas();
      closeOv1ModalIfOpen();
      bindDynamicEvents();
    } catch (err) {
      console.error("applyDomUpdate error:", err);
    }
  };

  // Modern Document View Transitions API for buttery smooth cross-fade page switches
  if (isViewSwitch && typeof document !== "undefined" && typeof document.startViewTransition === "function" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    viewRoot.classList.add("is-view-switching");
    try {
      const transition = document.startViewTransition(() => {
        applyDomUpdate();
      });
      if (transition && typeof transition.finished?.finally === "function") {
        transition.finished.finally(() => {
          viewRoot.classList.remove("is-view-switching");
        });
      } else {
        window.setTimeout(() => viewRoot.classList.remove("is-view-switching"), 300);
      }
      return { transitionPending: true, domUpdated: true };
    } catch {
      applyDomUpdate();
      window.setTimeout(() => viewRoot.classList.remove("is-view-switching"), 300);
      return { transitionPending: false, domUpdated: true };
    }
  } else {
    if (isViewSwitch) {
      viewRoot.classList.add("is-view-switching");
      window.clearTimeout(viewSwitchTimer);
      viewSwitchTimer = window.setTimeout(() => {
        viewRoot.classList.remove("is-view-switching");
      }, 300);
    } else {
      viewRoot.classList.remove("is-view-switching");
    }
    applyDomUpdate();
    return { transitionPending: false, domUpdated: true };
  }
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
  if ("value" in target && (!state.briefDraftReveal || snapshot.scopeId !== "briefEditorForm")) {
    target.value = snapshot.value;
  }
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

  const isMapActive = state.activeView === "concept-map" || (state.activeView === "ov1" && state.ov1ViewMode === "map");
  if (!isMapActive || !mount) {
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

const boundDynamicEventMap = new WeakMap();

function addEventListenerOnce(element, type, handler, key = type, options) {
  if (!element) return;
  let boundKeys = boundDynamicEventMap.get(element);
  if (!boundKeys) {
    boundKeys = new Set();
    boundDynamicEventMap.set(element, boundKeys);
  }
  if (boundKeys.has(key)) return;
  boundKeys.add(key);
  element.addEventListener(type, handler, options);
}

function bindDynamicEvents() {
  initNotificationCapsule();
  document.querySelectorAll(".brief-sidebar-editor textarea").forEach((textarea) => {
    addEventListenerOnce(textarea, "input", () => fitBriefTextarea(textarea), "brief-editor:input");
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    addEventListenerOnce(button, "click", () => {
      button.closest?.(".derived-provenance-dropdown")?.removeAttribute("open");
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
      if (state.activeView === "ov4" && viewId === "ov2" && state.ov4SelectedRoleId) {
        state.ov2SelectedNodeId = state.ov4SelectedRoleId;
      }
      closeMenubarMenus();
      // Left floating step rail and menus: same entry path as workflow gate.
      const activeMainViewId = state.relatedModelReturnContext?.mainViewId || "";
      const calculatedEntrySource = button.dataset.relatedModel === "true"
        ? (resolveRelatedMainViewId(state.activeView, viewId, state.relatedModelReturnContext) || activeMainViewId || state.activeView)
        : (activeMainViewId || (state.activeView === "phase-action" ? "phase-action" : state.activeView || "default"));
      void navigateToResearchView(viewId, { entrySource: calculatedEntrySource });
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

  bindOv5Events(getOv5Ctx());
  bindDodafEvents(getDodafCtx());
  bindRulesEvents({ select, addEventListenerOnce });
  bindForceMissionEvents({ select, addEventListenerOnce });
  document.querySelectorAll("[data-validation-issue]").forEach((button) => {
    addEventListenerOnce(button, "click", () => select("issue", button.dataset.validationIssue), "validation-issue:click");
  });
  document.querySelectorAll("[data-knowledge-result]").forEach((button) => {
    addEventListenerOnce(button, "click", () => select("knowledge", button.dataset.knowledgeResult), "knowledge-result:click");
  });
  document.querySelectorAll("[data-project-switch]").forEach((button) => addEventListenerOnce(button, "click", () => switchProject(button.dataset.projectSwitch), "project-switch:click"));
  document.querySelectorAll("[data-project-archive]").forEach((button) => addEventListenerOnce(button, "click", async () => {
    const targetProjectId = button.dataset.projectArchive;
    const shouldArchive = button.dataset.projectArchived === "true";
    if (shouldArchive && targetProjectId === state.activeProjectId) {
      showToast("当前正在使用的项目不可归档，请切换至其他项目后再试");
      return;
    }
    try {
      await updateProject(targetProjectId, { archived: shouldArchive });
      await hydrateProjectDirectory();
    } catch {
      showToast("项目状态更新失败，请确认负责人身份");
    }
  }, "project-archive:click"));
  document.querySelectorAll("[data-project-delete]").forEach((button) => addEventListenerOnce(button, "click", async () => {
    const title = button.dataset.projectTitle || button.dataset.projectDelete;
    await handleDeleteProject(button.dataset.projectDelete, title);
  }, "project-delete:click"));
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
    if (button.closest("#workflowGateRoot") || button.closest("#aiConfigRoot") || button.closest("#aiPromptRoot")) return;
    const fire = (event) => {
      if (button.dataset.stopClickPropagation === "true" || button.classList.contains("card-inline-edit-btn") || button.classList.contains("sync-inline-edit-btn")) {
        event?.stopPropagation?.();
      }
      handleAction(button.dataset.action, button, event);
    };
    if (button.matches("input, select, textarea")) {
      addEventListenerOnce(button, "change", fire, "action:change");
      return;
    }
    addEventListenerOnce(button, "click", fire, "action:click");
  });
  bindReportEvents(getReportCtx());
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
  ov2CanvasController.bind(document);
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
  bindOv5Events(getOv5Ctx());
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

async function handleAction(action, source = null) {
  if (source && source.closest && action !== "close-provenance-popover") {
    source.closest(".derived-provenance-dropdown")?.removeAttribute("open");
  }

  if (handleOv5Action(action, source, getOv5Ctx())) return;
  if (await handleForceMissionAction(action, source, {
    state,
    render,
    showToast,
    navigateToResearchView,
    conceptPlanningController,
    refreshWorkflowGateUi,
    dodafProductController
  })) return;
  if (await handleRulesAction(action, source, {
    state,
    render,
    showToast,
    $,
    getViewMeta,
    resolveRelatedMainViewId,
    resolveModelFocus,
    captureViewScroll,
    navigateToResearchView,
    ruleLibraryChatController,
    sequenceChatController,
    stateMachineChatController,
    dodafProductController
  })) return;
  if (await handleDodafAction(action, source, getDodafCtx())) return;

  if (action === "switch-scenario-view-mode") {
    const targetMode = source?.dataset?.viewMode || "workbench";
    state.scenarioViewMode = targetMode;
    render();
    return;
  }
  if (action === "confirm-scenario-validation") {
    if (!state.scenario) {
      showToast("尚未生成想定推演，请先执行 AI 编译生成");
      return;
    }
    state.scenario.confirmed = true;
    state.scenario.confirmedAt = new Date().toISOString();
    if (state.scenarioStorage) state.scenarioStorage.stale = false;
    if (state.validationResult) {
      state.validationResult.confirmed = true;
      state.validationResult.stale = false;
    }
    showToast("仿真推演与验证结论已人工确认，研究主线已全部闭合！");
    render();
    return;
  }
  if (action === "toggle-workflow-test-mode") {
    void setWorkflowMode(currentWorkflow().mode === "free" ? "gated" : "free");
    return;
  }
  if (action === "minimize-busy-overlay") {
    busyOverlayMinimized = true;
    updateBusyOverlay();
    showToast("AI 生成已转入后台运行，可在右下角消息胶囊实时查看进度");
    return;
  }
  if (action === "force-dismiss-busy-overlay") {
    forceDismissStuckOverlay(getBusyOverlayState());
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
  if (action === "go-to-related-model") {
    const targetView = source?.dataset?.targetView;
    if (targetView) {
      const mainViewId = state.activeView;
      const focus = resolveModelFocus(mainViewId, state);
      state.relatedModelReturnContext = {
        mainViewId,
        mainLabel: getViewMeta(mainViewId)?.label || "主步骤",
        relatedViewId: targetView,
        focusType: focus.focusType || "",
        focusId: focus.focusId || "",
        focusLabel: focus.focusLabel || "",
        selection: state.selection ? { ...state.selection } : null,
        scrollSnapshots: captureViewScroll($("#viewRoot"))
      };
      await navigateToResearchView(targetView, { entrySource: mainViewId });
    }
    return;
  }
  if (action === "close-provenance-popover") {
    source?.closest?.(".derived-provenance-dropdown")?.removeAttribute("open");
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
    render({ skipViewRoot: true });
    return;
  }
  if (action === "close-context-panel") {
    state.contextPanelOpen = false;
    state.contextPanelFocus = "";
    const dialog = $("#contextPanelDialog");
    if (dialog?.open) dialog.close();
    render({ skipViewRoot: true });
    return;
  }
  if (action === "toggle-workflow-gate") {
    // Capsule only expands/collapses the panel; primary advance stays on the panel button.
    setWorkflowGateOpen(!state.workflowGateOpen);
    return;
  }
function confirmRegenerateWorkflowStep(context) {
  if (typeof window === "undefined" || typeof window.confirm !== "function") return true;
  const nextStep = context?.nextStep;
  const nextLabel = nextStep?.label || "下一步";
  const mainViewId = nextStep?.mainViewId || context?.mainViewId || "";

  if (nextStep?.related || context?.mode === "related-next-step") {
    if (mainViewId === "operational-task") {
      if (nextStep?.id === "ov6c") {
        return window.confirm("重新生成将更新「逐任务时序图」（保留阶段时序与兵力协同时序，不影响其他流程成果），是否继续？");
      }
      if (nextStep?.id === "ov6b") {
        return window.confirm("重新生成将更新「逐任务状态机」（保留阶段状态机与兵力状态机，不影响其他流程成果），是否继续？");
      }
      if (nextStep?.id === "ov6a") {
        return window.confirm("重新生成将基于作战任务更新规则建议（保留全局阶段规则与兵力规则），是否继续？");
      }
      if (nextStep?.id === "ov1b") {
        return window.confirm("重新生成将基于最新任务重新编组（不影响其他模型成果），是否继续？");
      }
    } else if (mainViewId === "force-mission") {
      if (nextStep?.id === "ov4") {
        return window.confirm("重新生成将更新「组织关系图」（根据最新作战兵力重新推导指挥、保障与信息关系，不影响其他流程成果），是否继续？");
      }
      if (nextStep?.id === "ov2") {
        return window.confirm("重新生成将更新「作战资源流」（根据最新作战兵力与组织关系重新推导资源流，不影响其他流程成果），是否继续？");
      }
      if (nextStep?.id === "ov3") {
        return window.confirm("重新生成将更新「作战资源流矩阵」（根据最新作战资源流重新投影矩阵事实，不影响其他流程成果），是否继续？");
      }
      if (nextStep?.id === "ov6c") {
        return window.confirm("重新生成将更新「任务与兵力时序图」（保留阶段时序，不影响其他流程成果），是否继续？");
      }
      if (nextStep?.id === "ov6b") {
        return window.confirm("重新生成将更新「任务与兵力状态机」（保留阶段状态机，不影响其他流程成果），是否继续？");
      }
      if (nextStep?.id === "ov6a") {
        return window.confirm("重新生成将基于作战任务与作战兵力更新规则建议（保留全局阶段规则），是否继续？");
      }
    } else if (mainViewId === "phase-action") {
      if (nextStep?.id === "ov6c") {
        return window.confirm("重新生成将更新「阶段时序图」（保留任务与兵力时序，不影响其他流程成果），是否继续？");
      }
      if (nextStep?.id === "ov6b") {
        return window.confirm("重新生成将更新「阶段状态机」（保留任务与兵力状态机，不影响其他流程成果），是否继续？");
      }
    }
    return window.confirm(`重新生成将更新当前流程关联的「${nextLabel}」（保留其他流程模型），是否继续？`);
  }

  return window.confirm(`重新生成将基于最新上游上下文覆盖「${nextLabel}」当前已有成果，是否继续？`);
}

  if (action === "advance-workflow-step") {
    const intent = source?.dataset?.stepIntent;
    const isRegenerate = intent === "regenerate" || source?.dataset?.actionVariant === "regenerate";
    if (isRegenerate) {
      const context = resolveWorkflowGateContext(state);
      if (!confirmRegenerateWorkflowStep(context)) return;
    }
    void advanceWorkflowStep({ generate: intent === "ai" || isRegenerate, forceRegenerate: isRegenerate });
    return;
  }
  if (action === "advance-workflow-step-ai") {
    const context = resolveWorkflowGateContext(state);
    if (context.mode === "complete-phase") {
      void completeWorkflowStage({ generate: true });
    } else if (context.mode === "related-next-step") {
      void advanceRelatedWorkflow({ generate: true });
    } else {
      void advanceWorkflowStep({ generate: true });
    }
    return;
  }
  if (action === "advance-workflow-step-direct" || action === "advance-workflow-step-skip") {
    const context = resolveWorkflowGateContext(state);
    if (context.mode === "complete-phase") {
      void completeWorkflowStage({ generate: false });
    } else if (context.mode === "related-next-step") {
      void advanceRelatedWorkflow({ generate: false });
    } else {
      void advanceWorkflowStep({ generate: false });
    }
    return;
  }
  if (action === "advance-workflow-step-regenerate") {
    const context = resolveWorkflowGateContext(state);
    if (confirmRegenerateWorkflowStep(context)) {
      if (context.mode === "complete-phase") {
        void completeWorkflowStage({ generate: true, forceRegenerate: true });
      } else if (context.mode === "related-next-step") {
        void advanceRelatedWorkflow({ generate: true, forceRegenerate: true });
      } else {
        void advanceWorkflowStep({ generate: true, forceRegenerate: true });
      }
    }
    return;
  }
  if (action === "workflow-gate-quick-confirm-phase-action") {
    try {
      await conceptPlanningController.confirmPhaseAction();
      showToast("已确认阶段与行动");
    } catch (e) {
      showToast(e?.message || "确认阶段与行动失败");
    }
    refreshWorkflowGateUi();
    return;
  }
  if (action === "workflow-gate-quick-confirm-concept-map") {
    try {
      conceptMapController.handleAction("confirm-concept-map-step");
      showToast("已确认概念图参考");
    } catch (e) {
      showToast(e?.message || "确认概念图参考失败");
    }
    refreshWorkflowGateUi();
    return;
  }
  if (action === "advance-workflow") {
    const context = resolveWorkflowGateContext(state);
    void (context.mode === "related-next-step" ? advanceRelatedWorkflow({ generate: false }) : advanceWorkflowStep({ generate: false }));
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
    if (state.activeView === "ov2") {
      const hasExchanges = Boolean((state.ov2?.exchanges || []).length);
      if (hasExchanges && !window.confirm("将用 AI 重新生成作战资源流，覆盖当前内容。是否继续？")) return;
      void dodafProductController.pregenerateOv2FromForceAndOv4({ silent: false, force: true });
      return;
    }
    if (state.activeView === "ov3") {
      void dodafProductController.pregenerateOv3FromOv2({ silent: false, force: true });
      return;
    }
    if (state.activeView === "ov6c") {
      const isPhaseSubflow = state.activeMainViewId === "phase-action";
      const contextType = isPhaseSubflow ? "phase" : "force-mission";
      void dodafProductController.pregenerateOv6cFromPhase({ silent: false, contextType, force: true });
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
    const intent = source?.dataset?.stepIntent;
    const isRegenerate = intent === "regenerate" || source?.dataset?.actionVariant === "regenerate";
    if (isRegenerate) {
      const context = resolveWorkflowGateContext(state);
      if (!confirmRegenerateWorkflowStep(context)) return;
    }
    void advanceRelatedWorkflow({ generate: intent === "ai" || isRegenerate, forceRegenerate: isRegenerate });
    return;
  }
  if (action === "complete-workflow-stage") {
    const intent = source?.dataset?.stepIntent;
    const isRegenerate = intent === "regenerate" || source?.dataset?.actionVariant === "regenerate";
    if (isRegenerate) {
      const context = resolveWorkflowGateContext(state);
      if (!confirmRegenerateWorkflowStep(context)) return;
    }
    void completeWorkflowStage({ generate: intent === "ai" || isRegenerate, forceRegenerate: isRegenerate });
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
  if (action === "open-ai-config" || action === "open-ai-prompts") {
    closeMenubarMenus();
  }
  if (action === "reset-project-content") {
    if (state.resettingProject) return;
    closeMenubarMenus();
    const title = currentProjectTitle();
    const confirmed = window.confirm(
      `确定要清空当前项目“${title}”的全部研究内容吗？\n\n此操作将清空：\n• 概念简报、研讨记录与研究方向\n• 阶段与行动规划\n• 作战任务、任务区域与作战兵力编成\n• 概念图及所有 DoDAF 架构模型（OV-1 至 OV-7）\n• 想定、OODA 循环与验证结果\n\n清空后项目将重置回第 1 阶段「概念简报」。此操作无法撤销，确定继续吗？`
    );
    if (!confirmed) return;
    state.resettingProject = true;
    updateBusyOverlay(getBusyOverlayState());
    const safetyTimer = window.setTimeout(() => {
      if (state.resettingProject) {
        state.resettingProject = false;
        updateBusyOverlay();
        render();
        showToast("重置已在后台完成，已恢复工作台");
      }
    }, 10000);
    try {
      showToast("正在清空项目全部内容…");
      await resetProjectContent(state.activeProjectId);
      purgeProjectClientStorage(state.activeProjectId);
      ensureClientStoragePurged({ force: true });
      const fresh = createInitialWorkbenchState(state.activeProjectId).state;
      const preserved = {
        collaboration: state.collaboration,
        projectDirectory: state.projectDirectory,
        activeProjectId: state.activeProjectId,
        resettingProject: true
      };
      Object.assign(state, fresh, preserved);
      showToast("正在重置工作台并恢复初始状态…");
      await Promise.all([
        hydrateProjectDirectory({ skipRender: true }),
        hydrateProjectModels()
      ]);
      state.activeView = "brief";
      state.selection = null;
      if (window.location.hash !== "#brief") {
        window.location.hash = "brief";
      }
      window.clearTimeout(safetyTimer);
      state.resettingProject = false;
      updateBusyOverlay();
      render();
      showToast("项目已成功清空并重置为初始状态");
    } catch (error) {
      window.clearTimeout(safetyTimer);
      state.resettingProject = false;
      updateBusyOverlay();
      showToast(error?.status === 403 ? "只有具备权限的成员可清空项目" : `清空项目失败：${error?.message || "网络异常"}`);
    }
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
  if (ov1AiController.handleAction(action)) return;
  if (ov5AiController.handleAction(action, source)) return;
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
  if (handleReportAction(action, source, getReportCtx())) return;
  showToast("已创建概念注释");
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

function applyResearchChatBriefUpdate(response, question, options = {}) {
  const update = deriveResearchChatBriefUpdate({
    brief: state.brief,
    question,
    result: response?.result || response,
    projectTitle: options.projectTitle || currentProjectTitle()
  });
  if (!update.fields.length) return [];
  const nextBrief = saveConceptBrief({ ...state.brief, ...update.patch }, projectBriefSeed);
  if (!areConceptBriefsEqual(state.brief, nextBrief)) {
    state.brief = nextBrief;
    state.briefIntent = nextBrief.researchIntent;
    state.briefDraftReveal = true;
    invalidateDerivedArtifacts();
    window.setTimeout(() => {
      if (!state.briefDraftReveal) return;
      state.briefDraftReveal = false;
      const form = document.querySelector("#briefEditorForm");
      form?.classList.remove("is-draft-reveal");
    }, 1500);
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
void initAppDirectoryAndModels();

async function initAppDirectoryAndModels() {
  await hydrateProjectDirectory({ skipRender: true });
  await hydrateProjectModels();
}

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
    if (state.activeView === "force-mission") render();
    else render({ skipViewRoot: true });
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
  const targetViewId = viewId === "operational-task" ? "force-mission" : viewId;
  if (viewId === "operational-task") {
    state.forceMissionLayerTab = "task";
  }
  if (targetViewId !== "ov6a") state.ruleLibraryEntrySource = "default";
  state.activeView = targetViewId;
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
async function navigateToResearchView(viewId, { toast = "", force = false, entrySource = "default", completeOperationalTasks = false, generate = false, forceRegenerate = false } = {}) {
  if (!viewId) return;
  // contract note for tests: void navigateToResearchView(viewId)
  if (!force && state.activeView === viewId && viewId !== "ov6a" && viewId !== "phase-action") return;
  if (viewId === "ov6a") state.ruleLibraryEntrySource = entrySource;
  goToWorkflowView(viewId);
  render();
  if (toast) showToast(toast);

  // If generation is not requested, remain read-only / skip AI generation
  if (!generate && !forceRegenerate) {
    return;
  }
  if (viewId === "ov6a") {
    const source = (entrySource === "ov1b" || entrySource === "operational-task")
      ? "operational-task"
      : (entrySource === "force-mission" ? "force-mission" : entrySource);
    if (source === "operational-task") {
      await ruleLibraryChatController.proposeChanges("operational-task", { silent: false, force: forceRegenerate });
    } else if (source === "force-mission") {
      await ruleLibraryChatController.proposeChanges("force-mission", { silent: false, force: forceRegenerate });
    } else if (source === "phase-action") {
      if (state.phaseAction?.status === "confirmed") {
        await ruleLibraryChatController.proposeChanges("phase-action", { silent: false, force: forceRegenerate });
      } else {
        await ruleLibraryChatController.pregenerateFromBrief({ silent: false });
      }
    } else {
      await ruleLibraryChatController.pregenerateFromBrief({ silent: false });
    }
  }
  // Task decomposition is generated from its toolbox action, after the canvas is visible.
  if (viewId === "phase-action") {
    await ensureCombatFocusOnEnterPhaseAction();
  }
  if (viewId === "ov6b") {
    const contextType = (entrySource === "operational-task" || entrySource === "ov1b") ? "task" : entrySource === "force-mission" ? "force-mission" : "phase";
    await dodafProductController.pregenerateOv6bFromPhaseAction({ silent: false, contextType, force: forceRegenerate });
  }
  if (viewId === "ov6c") {
    const contextType = (entrySource === "operational-task" || entrySource === "ov1b") ? "task" : entrySource === "force-mission" ? "force-mission" : "phase";
    await dodafProductController.pregenerateOv6cFromPhase({ silent: false, contextType, force: forceRegenerate });
  }
  if (viewId === "ov4") {
    await dodafProductController.pregenerateOv4FromForceMission({ silent: false, force: forceRegenerate });
  }
  if (viewId === "ov2") {
    await dodafProductController.pregenerateOv2FromForceAndOv4({ silent: false, force: forceRegenerate });
  }
  if (viewId === "ov3") {
    await dodafProductController.pregenerateOv3FromOv2({ silent: false, force: forceRegenerate });
  }
  if (viewId === "ov5" && (generate || forceRegenerate)) {
    if (forceRegenerate || !(state.ov5?.activities || []).length) {
      await ov5AiController.generateOv5({ force: forceRegenerate, silent: false });
    }
  }
  if (viewId === "ov5a" && (generate || forceRegenerate)) {
    await dodafProductController.pregenerateOv5a({ silent: false, force: forceRegenerate, useAi: Boolean(generate || forceRegenerate) });
  }
  if (viewId === "ov1c" && (generate || forceRegenerate)) {
    await dodafProductController.pregenerateOv1c({ silent: false, force: forceRegenerate, useAi: Boolean(generate || forceRegenerate) });
  }
  if (viewId === "ov7" && (generate || forceRegenerate)) {
    await dodafProductController.pregenerateOv7({ silent: false, force: forceRegenerate, useAi: Boolean(generate || forceRegenerate) });
  }
  if (viewId === "force-mission" && (generate || forceRegenerate)) {
    // 门禁：必须先生成作战任务；若作战任务未生成或需补齐，优先生成作战任务，绝不越权生成兵力
    if (forceRegenerate || !(state.forceMission?.tasks || []).length || operationalTasksNeedAiCompletion(state.forceMission?.tasks)) {
      await conceptPlanningController.generateOperationalTasks({ silent: false });
    } else if (state.forceMission?.tasksConfirmedAt && (forceRegenerate || !(state.forceMission?.forces || []).length)) {
      // 只有在作战任务已确认的前提下，才允许生成概念兵力
      await conceptPlanningController.generateForceMission({ silent: false, layer: "concept" });
    }
  }
  if (viewId === "ov1" && (forceRegenerate || (!state.conceptGraphic?.nodes?.length && !state.ov1Candidate))) {
    await ov1AiController.generateOv1();
  }
  if (viewId === "concept-map" && (forceRegenerate || !state.conceptMap?.document?.items?.length)) {
    if (state.forceMission?.status === "confirmed" && state.phaseAction?.status === "confirmed") {
      conceptMapController.handleAction("seed-concept-map-from-planning");
    }
  }
  if (viewId === "scenario" && (!state.scenario || !state.scenario.entities?.length)) {
    await scenarioController.compileOrGenerateScenario({ silent: false, forceAi: true });
  }
  if (viewId === "operational-task" && (
    forceRegenerate
    || !(state.forceMission?.tasks || []).length
    || ((entrySource === "phase-action" || completeOperationalTasks) && operationalTasksNeedAiCompletion(state.forceMission?.tasks))
  )) {
    await conceptPlanningController.generateOperationalTasks({ silent: false });
  }
  // Entering OV-1b from the confirmed task step (force-mission or legacy operational-task)
  // must immediately produce a reviewable task organization. The page remains visible while
  // generation runs so the user can see the busy state and resulting groups.
  if (viewId === "ov1b" && (entrySource === "force-mission" || entrySource === "operational-task")) {
    await dodafProductController.pregenerateOv1bFromTasks({ silent: false, force: forceRegenerate });
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
async function advanceWorkflowStep({ generate = false, forceRegenerate = false } = {}) {
  setWorkflowGateOpen(false);
  state.workflowCompleting = true;
  renderWorkflowGate();
  try {
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
      entrySource: generate ? (ctx.nextStep.mainViewId || ctx.current?.id || "default") : "default",
      generate,
      forceRegenerate
    });
  } catch (err) {
    console.error("advanceWorkflowStep error:", err);
    showToast(`推进失败：${err?.message || "未知错误"}`);
  } finally {
    state.workflowCompleting = false;
    renderWorkflowGate();
  }
}

async function advanceRelatedWorkflow({ generate = false, forceRegenerate = false } = {}) {
  setWorkflowGateOpen(false);
  state.workflowCompleting = true;
  renderWorkflowGate();
  try {
    const ctx = resolveWorkflowGateContext(state);
    if (ctx.mode !== "related-next-step" || !ctx.nextStep?.id) {
      showToast("当前没有可进入的下一步");
      return;
    }
    if (state.activeView === "ov6a" && (state.ov6a?.ruleChangeSet?.changes || []).some((item) => item.status === "pending")) {
      showToast("请先在规则库接受或忽略全部待审核建议，再生成状态机");
      return;
    }
    const currentSubflowView = state.activeView;
    const SUBFLOW_VIEWS = ["ov6a", "ov6b", "ov6c", "ov1b", "ov1c", "ov2", "ov3", "ov4", "ov5a", "ov7", "ooda"];
    if (SUBFLOW_VIEWS.includes(currentSubflowView)) {
      const currentModel = state[currentSubflowView];
      if (currentModel && typeof currentModel === "object") {
        const hasPending = (currentModel.ruleChangeSet?.changes || []).some((item) => item.status === "pending");
        if (!hasPending && currentModel.status !== "confirmed") {
          currentModel.status = "confirmed";
          currentModel.confirmedAt = currentModel.confirmedAt || new Date().toISOString();
          try {
            if (["ov1b", "ov6a", "ov6b", "ov6c"].includes(currentSubflowView)) {
              dodafProductController.persistOv6(currentSubflowView, currentModel, "");
            } else if (dodafProductController.saveProduct) {
              void dodafProductController.saveProduct(currentSubflowView);
            }
          } catch {
            /* continue navigation */
          }
        }
      }
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
      && (ctx.nextStep.id === "force-mission" || ctx.nextStep.id === "operational-task");
    if (completesPhaseSubflow && state.phaseAction?.phases?.length >= 2 && state.phaseAction?.status !== "confirmed") {
      try {
        await conceptPlanningController.confirmPhaseAction();
      } catch {
        /* continue advancement */
      }
    }
    const completesTaskSubflow = (ctx.mainViewId === "operational-task" || ctx.mainViewId === "ov1b")
      && state.activeView === "ov6c"
      && ctx.nextStep.id === "force-mission";
    if (completesTaskSubflow && !state.forceMission?.tasksConfirmedAt && (state.forceMission?.tasks || []).length) {
      try {
        await conceptPlanningController.confirmOperationalTasks();
      } catch {
        /* continue advancement */
      }
    }
    await navigateToResearchView(ctx.nextStep.id, {
      toast: `已进入${ctx.nextStep.label}`,
      force: true,
      entrySource: ctx.mainViewId,
      completeOperationalTasks: completesPhaseSubflow,
      generate,
      forceRegenerate
    });
  } catch (err) {
    console.error("advanceRelatedWorkflow error:", err);
    showToast(`推进失败：${err?.message || "未知错误"}`);
  } finally {
    state.workflowCompleting = false;
    renderWorkflowGate();
  }
}

/** Last step of a phase: confirm and unlock the next phase. */
async function completeWorkflowStage({ generate = false, forceRegenerate = false } = {}) {
  if (state.workflowCompleting) return;
  setWorkflowGateOpen(false);
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
  // Auto-confirm stages in background so downstream dependencies are fully satisfied
  if (stage === 1 && state.phaseAction?.status !== "confirmed") {
    try { await conceptPlanningController.confirmPhaseAction(); } catch { /* ignore */ }
  }
  if (stage === 2 && !state.forceMission?.tasksConfirmedAt) {
    try { await conceptPlanningController.confirmOperationalTasks(); } catch { /* ignore */ }
  }
  if (stage === 3 && state.forceMission?.status !== "confirmed") {
    try { await conceptPlanningController.confirmForceMission(); } catch { /* ignore */ }
  }
  if (stage === 4 && !state.ov1?.confirmed) {
    state.ov1 = state.ov1 || {};
    state.ov1.confirmed = true;
    state.ov1.confirmedAt = new Date().toISOString();
    if (state.ov1Storage) state.ov1Storage.stale = false;
    try { await projectOv1SyncController.sync(state.ov1, { source: "ov1:confirm" }); } catch { /* ignore */ }
  }
  if (stage === 5 && state.conceptMap?.reference?.status !== "confirmed") {
    try { conceptMapController.handleAction("confirm-concept-map-step"); } catch { /* ignore */ }
  }
  if (completedWorkflowStage(workflow) >= stage) {
    // Already confirmed — just walk forward if possible (same pregenerate path as “下一步”).
    if (ctx.nextStep?.id) {
      await advanceWorkflowStep({ generate, forceRegenerate });
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
    if (generate && stage === 1 && (nextMainView === "force-mission" || nextMainView === "operational-task")) {
      if (forceRegenerate || !(state.forceMission?.tasks || []).length || operationalTasksNeedAiCompletion(state.forceMission?.tasks)) {
        await conceptPlanningController.generateOperationalTasks({ silent: false });
      }
    }
    if ((nextMainView === "phase-action" || nextView === "phase-action") && (stage === 0 || generate || forceRegenerate)) {
      await ensureCombatFocusOnEnterPhaseAction();
    }
    if (generate && stage === 2 && nextMainView === "force-mission") {
      // 门禁：兵力生成必须以作战任务确认为前提
      if (state.forceMission?.tasksConfirmedAt) {
        await conceptPlanningController.generateForceMission({ silent: false, layer: "concept" });
      }
    }
    if (generate && stage === 3 && nextMainView === "ov1") {
      if (!state.conceptGraphic?.nodes?.length && !state.ov1Candidate) {
        await ov1AiController.generateOv1();
      }
    }
    if (generate && stage === 4 && nextMainView === "concept-map" && typeof conceptMapController.seedFromPlanning === "function") {
      await conceptMapController.seedFromPlanning({ silent: false });
    }
    if (generate && stage === 5 && nextMainView === "scenario") {
      if (!state.scenario || !state.scenario.entities?.length) {
        await scenarioController.compileOrGenerateScenario({ silent: false, forceAi: true });
      }
    }
    if (nextView === "ov4") {
      await dodafProductController.pregenerateOv4FromForceMission({ silent: false, force: forceRegenerate });
    }
    if (nextView === "ov2") {
      await dodafProductController.pregenerateOv2FromForceAndOv4({ silent: false, force: forceRegenerate });
    }
    if (nextView === "ov3") {
      await dodafProductController.pregenerateOv3FromOv2({ silent: false, force: forceRegenerate });
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

  const safetyTimer = window.setTimeout(() => {
    if (state.workflowModeSwitching) {
      console.warn("setWorkflowMode safety timer triggered (10s)");
      state.workflowModeSwitching = false;
      updateBusyOverlay(null);
      render();
      showToast("模式切换请求处理超时，已自动恢复工作台");
    }
  }, 10000);

  try {
    await updateProject(state.activeProjectId, { workflow: nextWorkflow });
    await hydrateProjectDirectory({ skipRender: true });
    await settleBusyTransition();
    showToast(mode === "free" ? "已启用测试模式（所有阶段可自由访问）" : "已切换为阶段门禁模式");
  } catch (error) {
    if (projectEntry) projectEntry.workflow = { ...workflow, mode: previousMode };
    showToast(`工作模式保存失败：${error?.message || "网络或服务异常"}`);
  } finally {
    window.clearTimeout(safetyTimer);
    state.workflowModeSwitching = false;
    updateBusyOverlay(null);
    render();
  }
}

function forceDismissStuckOverlay(busy = null) {
  const title = busy?.title || "操作";
  state.workflowModeSwitching = false;
  state.resettingProject = false;
  state.reportArchiving = false;
  state.taskDecompositionPregenerating = false;
  state.operationalTaskGenerating = false;
  state.ruleLibraryPregenerating = false;
  state.ruleLibraryChangeGenerating = false;
  state.combatFocusGenerating = false;
  state.stateMachinePregenerating = false;
  state.sequencePregenerating = false;
  state.forceMissionGenerating = false;
  state.forceMissionGeneratingLayer = "";
  state.ov2Pregenerating = false;
  state.ov3Pregenerating = false;
  updateBusyOverlay(null);
  render();
  showToast(`${title}已解除等待，工作台已恢复可用`);
}

function getBusyOverlayState() {
  if (state.resettingProject) {
    return {
      key: "reset-project",
      title: "正在清空当前项目",
      detail: "正在清除全量架构模型、规划与验证数据，即将重载…",
      expectedMs: 2500,
      timeoutMs: 12000,
      isAiTask: false
    };
  }
  if (state.taskDecompositionPregenerating) {
    return {
      key: "task-organization-pregenerate",
      title: "正在整理任务",
      detail: "AI 正在仅依据已确认任务进行分组、排序与协同梳理…",
      expectedMs: 90000,
      timeoutMs: 600000,
      isAiTask: true
    };
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
      timeoutMs: 600000,
      isAiTask: true,
      progressPercent: total > 0 ? Math.round((completed / total) * 100) : null
    };
  }
  if (state.ruleLibraryPregenerating) {
    return {
      key: "rule-library-pregenerate",
      title: "正在进入阶段行动",
      detail: "根据简报生成作战规则…",
      expectedMs: 90000,
      timeoutMs: 600000,
      isAiTask: true
    };
  }
  if (state.ruleLibraryChangeGenerating) {
    return {
      key: "rule-library-change",
      title: "正在分析阶段规则",
      detail: "根据阶段目标、行动、进入与退出条件生成待审核规则建议…",
      expectedMs: 90000,
      timeoutMs: 600000,
      isAiTask: true
    };
  }
  if (state.combatFocusGenerating) {
    return {
      key: "combat-focus",
      title: "正在进入阶段行动",
      detail: "根据简报生成 3 个作战聚焦方向…",
      expectedMs: 60000,
      timeoutMs: 600000,
      isAiTask: true
    };
  }
  if (state.stateMachinePregenerating) {
    return {
      key: "state-machine-pregenerate",
      title: "正在进入状态机校验",
      detail: state.ov6GenerationContext === "task" ? "根据任务规则生成逐任务状态机…" : "根据阶段与行动分析阶段状态和转换条件…",
      expectedMs: 90000,
      timeoutMs: 600000,
      isAiTask: true
    };
  }
  if (state.sequencePregenerating) {
    const progress = state.sequenceGenerationProgress;
    const completed = Number(progress?.completed) || 0;
    const total = Number(progress?.total) || 0;
    return {
      key: "sequence-pregenerate",
      title: "正在进入时序图",
      detail: total > 0
        ? `AI 正在并发生成任务与兵力时序（${completed}/${total} 批）…`
        : (state.ov6GenerationContext === "force-mission" ? "AI 正在分析任务与兵力协同时序…" : state.ov6GenerationContext === "task" ? "AI 正在根据任务状态机生成逐任务时序图…" : "AI 正在生成各推演方及每个阶段的时序图…"),
      expectedMs: 120000,
      timeoutMs: 600000,
      isAiTask: true,
      progressPercent: total > 0 ? Math.round((completed / total) * 100) : null
    };
  }
  if (state.ov4Pregenerating) {
    const progress = state.ov4GenerationProgress;
    const completed = Number(progress?.completed) || 0;
    const total = Number(progress?.total) || 0;
    return {
      key: "ov4-pregenerate",
      title: "正在进入组织关系",
      detail: total > 0
        ? `AI 正在并发生成各作战群组织与协同关系（${completed}/${total} 批）…`
        : "AI 正在根据作战兵力生成指挥、保障与信息关系…",
      expectedMs: 120000,
      timeoutMs: 600000,
      isAiTask: true,
      progressPercent: total > 0 ? Math.round((completed / total) * 100) : null
    };
  }
  if (state.ov2Pregenerating) {
    return {
      key: "ov2-pregenerate",
      title: "正在进入作战资源流",
      detail: "AI 正在根据作战兵力与组织关系生成作战节点交换流 (Needlines) 与数据契约…",
      expectedMs: 120000,
      timeoutMs: 600000,
      isAiTask: true
    };
  }
  if (state.ov3Pregenerating) {
    return {
      key: "ov3-pregenerate",
      title: "正在投影作战资源流矩阵",
      detail: "正在将作战资源流交换事实受控投影至 OV-3 矩阵…",
      expectedMs: 30000,
      timeoutMs: 120000,
      isAiTask: false
    };
  }
  if (state.ov5Generating) {
    return {
      key: "ov5-generate",
      title: "正在构建作战活动与机理",
      detail: "AI 正在深度解析已确认作战任务、参战兵力与资源流契约，构建闭环作战活动与 OODA 动力学机制…",
      expectedMs: 90000,
      timeoutMs: 600000,
      isAiTask: true
    };
  }
  if (state.ov5aPregenerating) {
    return {
      key: "ov5a-pregenerate",
      title: "正在生成作战活动分解构型",
      detail: "AI 正在解析作战活动网络，自动规整活动层级与 wholePart 组合构型…",
      expectedMs: 60000,
      timeoutMs: 600000,
      isAiTask: true
    };
  }
  if (state.ov1cPregenerating) {
    return {
      key: "ov1c-pregenerate",
      title: "正在对齐任务活动映射",
      detail: "AI 正在智能对齐作战任务与承接活动，构建覆盖审计索引…",
      expectedMs: 60000,
      timeoutMs: 600000,
      isAiTask: true
    };
  }
  if (state.ov7Pregenerating) {
    return {
      key: "ov7-pregenerate",
      title: "正在对齐状态转换与因果活动",
      detail: "AI 正在对齐状态转换与因果活动，建立因果映射关系…",
      expectedMs: 60000,
      timeoutMs: 600000,
      isAiTask: true
    };
  }
  if (state.forceMissionGenerating) {
    const layer = state.forceMissionGeneratingLayer || "concept";
    if (layer === "combat") {
      return {
        key: "force-mission-combat",
        title: "正在生成作战编成",
        detail: "根据概念兵力与装备平台库，细化作战单元实体、平台挂接与编制结构…",
        expectedMs: 60000,
        timeoutMs: 600000,
        isAiTask: true
      };
    }
    if (layer === "both") {
      return {
        key: "force-mission-both",
        title: "正在生成作战兵力与编成",
        detail: "根据作战任务分解，完整生成概念兵力与作战单元编成…",
        expectedMs: 90000,
        timeoutMs: 600000,
        isAiTask: true
      };
    }
    return {
      key: "force-mission-concept",
      title: "正在生成概念兵力",
      detail: "根据作战任务分解与阶段行动，提炼红蓝双方核心职责与概念兵力…",
      expectedMs: 60000,
      timeoutMs: 600000,
      isAiTask: true
    };
  }
  if (state.workflowModeSwitching) {
    const testModeActive = currentWorkflow().mode === "free";
    return {
      key: "workflow-mode",
      title: testModeActive ? "正在进入测试模式" : "正在恢复阶段门禁",
      detail: testModeActive ? "所有研究阶段将可自由访问" : "工作流将按阶段门禁恢复",
      expectedMs: 1500,
      timeoutMs: 10000,
      isAiTask: false
    };
  }
  if (state.reportArchiving) {
    return {
      key: "report-archive",
      title: "正在保存报告版本",
      detail: "打包研究成果、生成校验并写入归档…",
      expectedMs: 8000,
      timeoutMs: 30000,
      isAiTask: false
    };
  }
  return null;
}

// 注册全局恢复前台遮罩回调，供消息胶囊点击「恢复前台」触发
if (typeof globalThis !== "undefined") {
  globalThis.__resumeBusyOverlay = () => {
    busyOverlayMinimized = false;
    updateBusyOverlay();
  };
}

function updateBusyOverlay(busy = getBusyOverlayState()) {
  const overlay = $("#workflowModeOverlay");
  const backgroundBtn = $("#workflowModeOverlayBackgroundBtn");
  const title = $("#workflowModeOverlayTitle");
  const detail = $("#workflowModeOverlayDetail");
  const dismissBtn = $("#workflowModeOverlayDismissBtn");

  if (!busy) {
    busyOverlayMinimized = false;
    setBackgroundTaskState(null);
    if (busyOverlayTimer) window.clearInterval(busyOverlayTimer);
    busyOverlayTimer = 0;
    busyOverlayKey = "";
    busyOverlayStartedAt = 0;
    if (dismissBtn) dismissBtn.hidden = true;
    if (backgroundBtn) backgroundBtn.hidden = true;
    if (overlay) {
      overlay.classList.remove("is-visible");
      window.setTimeout(() => {
        if (!getBusyOverlayState()) overlay.hidden = true;
      }, 220);
    }
    return;
  }

  // 有任务正在运行
  const key = busy.key || busy.title;
  if (busyOverlayKey !== key) {
    busyOverlayKey = key;
    busyOverlayStartedAt = Date.now();
    busyOverlayMinimized = false;
    if (dismissBtn) dismissBtn.hidden = true;
  }

  if (title) title.textContent = busy.title;
  if (detail) detail.textContent = busy.detail;
  updateBusyOverlayProgress(busy);

  // 控制转入后台按钮：仅对 AI 任务展示
  if (backgroundBtn) {
    backgroundBtn.hidden = busy.isAiTask === false;
  }

  if (!busyOverlayTimer) {
    busyOverlayTimer = window.setInterval(() => {
      const current = getBusyOverlayState();
      if (current) {
        updateBusyOverlayProgress(current);
      } else {
        updateBusyOverlay(null);
      }
    }, 500);
  }

  if (overlay) {
    if (busyOverlayMinimized) {
      overlay.classList.remove("is-visible");
      overlay.hidden = true;
    } else {
      overlay.hidden = false;
      requestAnimationFrame(() => overlay.classList.add("is-visible"));
    }
  }
}

function updateBusyOverlayProgress(busy) {
  const elapsedMs = Math.max(0, Date.now() - busyOverlayStartedAt);
  const expectedMs = Math.max(1000, Number(busy.expectedMs) || 30000);
  const timeoutMs = Math.max(expectedMs, Number(busy.timeoutMs) || expectedMs * 2);
  const isAi = busy.isAiTask !== false;

  // 平滑非线性进度推进：
  // 1. 在预期时间内，从 10% 平滑推进到 85%；
  // 2. 超出预期时间后，采用渐进缓动逼近 98%，避免卡死在单一数值；
  // 3. 只要模型生成未结束，进度条始终动态演进并配合流光脉冲。
  let estimatedPercent;
  if (elapsedMs <= expectedMs) {
    const ratio = elapsedMs / expectedMs;
    // 前半段略快、后半段减速的平滑曲线
    estimatedPercent = Math.min(85, Math.round(10 + Math.sin((ratio * Math.PI) / 2) * 75));
  } else {
    // 超过常见耗时后，微步对数逼近 98%
    const extraRatio = Math.min(3, (elapsedMs - expectedMs) / Math.max(10000, expectedMs));
    estimatedPercent = Math.min(98, Math.round(85 + (1 - Math.exp(-extraRatio * 1.2)) * 13));
  }

  const reportedPercent = Number.isFinite(busy.progressPercent)
    ? Math.max(0, Math.min(100, busy.progressPercent))
    : null;
  const displayedPercent = reportedPercent === null
    ? estimatedPercent
    : Math.max(reportedPercent, Math.min(estimatedPercent, 96));

  // 同步状态至消息胶囊（无论遮罩是否最小化均保持同步）
  if (isAi) {
    setBackgroundTaskState({
      title: busy.title,
      detail: busy.detail,
      progressPercent: displayedPercent,
      elapsedMs
    });
  } else {
    setBackgroundTaskState(null);
  }

  const progress = $(".workflow-mode-progress");
  const bar = $("#workflowModeProgressBar");
  const elapsed = $("#workflowModeElapsed");
  const estimate = $("#workflowModeEstimate");
  const hint = $("#workflowModeProgressHint");
  const dismissBtn = $("#workflowModeOverlayDismissBtn");

  if (progress) progress.setAttribute("aria-valuenow", String(displayedPercent));
  if (bar) bar.style.width = `${displayedPercent}%`;
  if (elapsed) elapsed.textContent = `已用时 ${formatBusyDuration(elapsedMs)}`;

  if (estimate) {
    if (isAi) {
      estimate.textContent = elapsedMs <= expectedMs
        ? `通常 ${formatBusyDuration(expectedMs / 2)}～${formatBusyDuration(expectedMs)}`
        : "深度思考生成中，持续接收流式数据…";
    } else {
      estimate.textContent = elapsedMs <= expectedMs
        ? `通常 ${formatBusyDuration(expectedMs / 2)}～${formatBusyDuration(expectedMs)}`
        : `服务超时上限 ${formatBusyDuration(timeoutMs)}`;
    }
  }

  if (hint) {
    if (reportedPercent !== null) {
      hint.textContent = "已按完成批次推进，AI 正在持续处理后续分批…";
    } else if (elapsedMs <= expectedMs) {
      hint.textContent = isAi
        ? "AI 正在结合上下文进行逻辑拓扑推理与推演验证…"
        : "正在处理，请稍候…";
    } else if (isAi) {
      hint.textContent = "当前推理与拓扑较为复杂，远端连接保持活跃，请耐心等待；亦可随时手动解除等待在后台进行。";
    } else if (elapsedMs < timeoutMs) {
      hint.textContent = "操作正在处理中，稍后即将完成…";
    } else {
      hint.textContent = "已到达超时上限，正在等待请求结束";
    }
  }

  // 手动解除等待按钮控制：
  if (dismissBtn) {
    const shouldShowDismiss = isAi
      ? elapsedMs >= Math.min(45000, expectedMs)
      : (elapsedMs >= timeoutMs || elapsedMs >= expectedMs * 1.5);
    dismissBtn.hidden = !shouldShowDismiss;
    if (isAi) {
      dismissBtn.textContent = "解除遮罩等待（后台继续接收）";
      dismissBtn.title = "解除前端等待遮罩，恢复工作台浏览；AI 仍将在后台继续接收与写入";
    } else {
      dismissBtn.textContent = "解除等待并恢复工作台";
      dismissBtn.title = "操作耗时较长时可点击退出等待";
    }
  }

  // 严格执行“只要远端没断，就绝不主动中断”铁律：
  if (!isAi && elapsedMs >= timeoutMs + 2000) {
    console.warn(`Busy overlay exceeded timeoutMs (${timeoutMs}ms) by 2s. Auto-dismissing non-AI task.`, busy);
    forceDismissStuckOverlay(busy);
  }
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

async function handleDeleteProject(projectId, title = projectId) {
  if (!window.confirm(`将永久删除项目“${title}”及其所有数据，此操作无法恢复。确定继续吗？`)) return;
  try {
    const isCurrentActive = projectId === state.activeProjectId;
    await deleteProject(projectId);
    purgeProjectClientStorage(projectId);
    showToast("已删除项目");
    await hydrateProjectDirectory();
    if (isCurrentActive) {
      const remaining = state.projectDirectory.projects || [];
      const nextProject = remaining.find((p) => p.id !== projectId && !p.archived)?.id
        || remaining.find((p) => p.id !== projectId)?.id
        || "default";
      switchProject(nextProject);
      return;
    }
    renderProjectManagerChrome();
  } catch (error) {
    showToast(error?.status === 403 ? "只有负责人可删除项目" : "项目删除失败：请先归档并确认项目状态");
  }
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
      const targetProjectId = button.dataset.projectArchive;
      const shouldArchive = button.dataset.projectArchived === "true";
      if (shouldArchive && targetProjectId === state.activeProjectId) {
        showToast("当前正在使用的项目不可归档，请切换至其他项目后再试");
        return;
      }
      try {
        await updateProject(targetProjectId, { archived: shouldArchive });
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
      await handleDeleteProject(button.dataset.projectDelete, title);
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

function getModels() {
  return { ov1: state.ov1, ov5: state.ov5, ooda: state.ooda, scenario: state.scenario, validationResult: state.validationResult, knowledge: state.knowledge, knowledgeQuery: state.knowledgeQuery, conceptMap: state.conceptMap };
}

function invalidatePhaseActionDependents() {
  state.forceMissionStorage = markStorageStale(state.forceMissionStorage, "阶段行动已更新，作战任务与兵力已过期");
  invalidateForceMissionDependents();
}

function invalidateForceMissionDependents() {
  state.ov1Storage = markStorageStale(state.ov1Storage, "任务或兵力已更新，总体概念图已过期");
  state.ov4Storage = markStorageStale(state.ov4Storage, "任务或兵力已更新，组织关系图已过期");
  state.ov2Storage = markStorageStale(state.ov2Storage, "任务或兵力已更新，作战资源流已过期");
  state.ov3Storage = markStorageStale(state.ov3Storage, "任务或兵力已更新，作战信息流已过期");
  invalidateDerivedArtifacts();
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

  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    document.querySelectorAll(".derived-provenance-dropdown[open]").forEach((details) => {
      if (!details.contains(target)) {
        details.removeAttribute("open");
      }
    });
  });

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

function bindAiModalsChrome() {
  const configRoot = document.getElementById("aiConfigRoot");
  if (configRoot && configRoot.dataset.actionsBound !== "true") {
    configRoot.dataset.actionsBound = "true";
    configRoot.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("[data-action]");
      if (!button || !configRoot.contains(button)) return;
      handleAction(button.dataset.action, button);
    });
  }

  const promptRoot = document.getElementById("aiPromptRoot");
  if (promptRoot && promptRoot.dataset.actionsBound !== "true") {
    promptRoot.dataset.actionsBound = "true";
    promptRoot.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("[data-action]");
      if (!button || !promptRoot.contains(button)) return;
      handleAction(button.dataset.action, button);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const overlay = $("#workflowModeOverlay");
    if (overlay && !overlay.hidden && overlay.classList.contains("is-visible")) {
      const busy = getBusyOverlayState();
      const elapsedMs = Math.max(0, Date.now() - busyOverlayStartedAt);
      if (elapsedMs > 2000 || (busy && elapsedMs >= (busy.expectedMs || 3000))) {
        event.preventDefault();
        forceDismissStuckOverlay(busy);
        return;
      }
    }
    if (state.aiPromptOpen) {
      event.preventDefault();
      handleAction("close-ai-prompts");
      return;
    }
    if (state.aiConfigOpen) {
      event.preventDefault();
      handleAction("close-ai-config");
      return;
    }
  });
}

bindAiModalsChrome();

bindOv5aDragAndDrop(getOv5Ctx());

if (typeof window !== "undefined") {
  window.__workbench = {
    getState: () => state,
    render,
    goToWorkflowView,
    navigateToResearchView
  };
}
