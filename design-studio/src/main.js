import { directions, project, views, workflowPhases } from "./data.js";
import { createInitialWorkbenchState } from "./app/createInitialState.js";
import { createCommandPaletteController } from "./commandPaletteController.js";
import { workflowPrimaryStepIds } from "./data.js";
import { $, downloadArtifact as downloadArtifactHelper, downloadBlob, escapeHtml, initNotificationCapsule, setBackgroundTaskState, showToast, writePrintableReport as writePrintableReportHelper } from "./app/domUtils.js";
import { completedWorkflowStage, currentProjectTitle as currentProjectTitleFor, currentWorkflow as currentWorkflowFor, getWorkflowStageIncompleteReasons, nextWorkflowStage, renderWorkflowGate as renderWorkflowGateFor, resolveWorkflowGateContext } from "./app/workflowGate.js";
import { wireControllers } from "./app/wireControllers.js";
import { deriveOodaFromOv5, getOodaDuration, persistOodaModel } from "./oodaStore.js";
import { addActivity, addEdge, deleteActivity, deleteEdge, persistOv5Model, updateActivity } from "./ov5Store.js";
import { countUnmappedOv5Activities, linkOv5ActivitiesToOv1, suggestOv1SourcesForActivity } from "./ov5Ov1Linker.js";
import { applyMappingQuality } from "./ov5MappingQuality.js";
import { getViewMeta, renderTree, renderView, selectionFor } from "./ui.js";
import { buildExportArtifactFromPayload } from "./reportBuilder.js";
import { areConceptBriefsEqual, saveConceptBrief } from "./briefStore.js";
import { saveCustomDirections, saveSelectedDirection } from "./directionProposalStore.js";
import { saveOv1Model } from "./ov1Store.js";
import { createLocalOv1Draft } from "./ov1DraftStore.js";
import { renderOv1ToolboxFloatButton } from "./ov1View.js";
import { contextualFlowViewIds, mountRelatedModelReturn, relatedViewLabel, renderRelatedModelReturn, resolveModelFocus, resolveRelatedMainViewId } from "./contextualModelFlow.js";
import { renderSequenceToolboxFloatButton } from "./ov6cView.js";
import { renderStateMachineToolboxFloatButton } from "./stateMachineView.js";
import { renderOv4ToolboxFloatButton } from "./ov4View.js";
import { renderSubflowToolboxFloatButton } from "./subflowToolbox.js";
import { mountGroupedLists } from "./groupedListTemplate.js";

import { restoreModelSnapshot } from "./modelSnapshotRestore.js";
import { buildModelComparisonArtifact } from "./modelComparisonBuilder.js";
import { getCmoCatalogStatus } from "./cmoCatalogClient.js";
import { applyTheme, getThemeConfig } from "./themeConfigClient.js";
import { createProject, deleteProject, loadProjects, resetProjectContent, updateProject } from "./projectBriefClient.js";
import {
  REVIEW_STATUSES,
  isProjectFinalized,
  buildRevisedProjectPayload
} from "./reviewWorkflowStore.js";
import { saveModelSnapshot, snapshotContextFromState } from "./modelSnapshotStore.js";
import {
  fetchTacticsLibrary,
  saveCurrentProjectToLibrary,
  deleteTacticFromLibrary,
  buildForkedProjectData
} from "./tacticsLibraryClient.js";
import { buildWhatIfProjectPayload } from "./wargameTimelineStore.js";
import { ensureClientStoragePurged, purgeProjectClientStorage } from "./clientStoragePurge.js";
import { applyWithRecoveryPoint } from "./app/recoveryTransaction.js";

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
import {
  bindDirectionEvents,
  resetCustomDirectionDialog,
  openCustomDirectionDialog,
  closeCustomDirectionDialog,
  handleConceptPlanningAction,
  getConceptMapFramePark,
  parkConceptMapFrame,
  mountConceptMapFrame
} from "./app/bindings/conceptPlanningBindings.js";
import {
  switchProject,
  handleDeleteProject,
  renderProjectManagerChrome,
  handleProjectAction
} from "./app/bindings/projectBindings.js";
import {
  closeMenubarMenus,
  isMenubarChromeOpen,
  isInsideMenubarChrome,
  isInsideOpenMenubarChrome,
  clearMenubarIdleTimer,
  scheduleMenubarIdleDismiss,
  dismissMenubarChrome,
  focusOpenMenubarChrome,
  openMenubarMenu,
  refreshProjectManagerUi,
  openProjectManagerFromHover,
  bindMenubarChrome,
  bindWorkflowGateChrome,
  bindAiModalsChrome
} from "./app/bindings/chromeBindings.js";
import { createSyncHandlers, describeProjectCreateError } from "./app/syncHandlers.js";
import { handleWorkflowAction, confirmRegenerateWorkflowStep } from "./app/bindings/workflowActionBindings.js";
import { renderStudioShell } from "./app/shellRenderer.js";
import {
  closeOv1ModalIfOpen as closeOv1ModalIfOpenImpl,
  openOv1SidePanel as openOv1SidePanelImpl,
  closeOv1SidePanel as closeOv1SidePanelImpl,
  ensureOv1ToolsDocked as ensureOv1ToolsDockedImpl,
  toggleOv1ToolsRail as toggleOv1ToolsRailImpl,
  toggleOv1SidePanelMode as toggleOv1SidePanelModeImpl,
  renderInspectorPanel as renderInspectorPanelImpl
} from "./app/inspectorBindings.js";
import { createModelInvalidators } from "./app/modelInvalidation.js";
import {
  VIEW_SCROLL_PRESERVE_SELECTORS,
  VIEW_SCROLL_PHASE_RESET_SELECTORS,
  captureViewScroll,
  restoreViewScroll,
  captureViewFocus,
  restoreViewFocus
} from "./app/viewScrollFocus.js";

const { state, projectBriefSeed, activeProjectId } = createInitialWorkbenchState();
const {
  invalidatePhaseActionDependents,
  invalidateForceMissionDependents,
  invalidateConceptMapDependents,
  invalidateDerivedArtifacts,
  invalidateValidation,
  markCurrentValidationStale,
  invalidateRedTeam,
  markStorageStale
} = createModelInvalidators(state);
const stateActions = createStateActions({ state, getModels: () => getModels(), render: (opt) => render(opt), showToast });

function getWorkflowActionCtx() {
  return {
    state,
    render,
    showToast,
    advanceWorkflowStep,
    advanceRelatedWorkflow,
    completeWorkflowStage,
    conceptPlanningController,
    conceptMapController,
    dodafProductController,
    refreshWorkflowGateUi
  };
}

function getConceptPlanningCtx() {
  return {
    state,
    showToast,
    projectBriefSyncController,
    render,
    activeProjectId
  };
}

function getProjectCtx() {
  return {
    state,
    $,
    showToast,
    handleAction,
    hydrateProjectDirectory,
    renderProjectManagerChrome: () => renderProjectManagerChrome(getProjectCtx()),
    closeMenubarMenus,
    refreshProjectManagerUi: () => refreshProjectManagerUi(getChromeCtx()),
    focusOpenMenubarChrome: () => focusOpenMenubarChrome(state),
    render
  };
}

function getChromeCtx() {
  return {
    state,
    $,
    renderProjectManagerChrome: () => renderProjectManagerChrome(getProjectCtx()),
    render,
    handleAction,
    setWorkflowGateOpen,
    getWorkflowGateLeaveSuppressedUntil: () => workflowGateLeaveSuppressedUntil,
    getBusyOverlayState,
    getBusyOverlayStartedAt: () => busyOverlayStartedAt,
    forceDismissStuckOverlay
  };
}

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
    getModels,
    currentProjectTitle,
    downloadArtifact,
    navigateToResearchView,
    completeWorkflowStage,
    dodafProductController,
    projectOv1SyncController,
    projectModelSnapshotSyncController,
    collaborationController,
    invalidateValidation,
    invalidateDerivedArtifacts,
    jumpFromStructureReview: (v, tk, ti) => jumpFromStructureReview(v, tk, ti, getDodafCtx()),
    applyOv1CandidateWithRecoveryPoint: () => applyOv1CandidateWithRecoveryPoint(getDodafCtx()),
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
  ...createSyncHandlers({
    state,
    projectBriefSeed,
    activeProjectId,
    currentProjectTitle,
    invalidateDerivedArtifacts,
    invalidateConceptMapDependents,
    invalidateValidation
  }),
  restoreSnapshot,
  exportModelComparison,
  hydrateProjectDirectory,
  completeCurrentWorkflowStage: completeWorkflowStage
});

const commandPaletteController = createCommandPaletteController({
  state,
  $,
  showToast,
  navigateToResearchView: (view) => navigateToResearchView(view),
  handleAction: (action, source) => handleAction(action, source)
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
  renderStudioShell({
    state,
    $,
    currentWorkflow,
    currentProjectTitle,
    getBusyOverlayState,
    updateBusyOverlay,
    renderWorkflowGate,
    renderOv1ToolboxFloatHost
  });
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
      mountConceptMapFrame(state);
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
      if (transition) {
        if (transition.ready && typeof transition.ready.catch === "function") {
          transition.ready.catch(() => {});
        }
        if (transition.updateCallbackDone && typeof transition.updateCallbackDone.catch === "function") {
          transition.updateCallbackDone.catch(() => {});
        }
        if (transition.finished && typeof transition.finished.catch === "function") {
          transition.finished.catch(() => {}).finally(() => {
            viewRoot.classList.remove("is-view-switching");
          });
        } else {
          window.setTimeout(() => viewRoot.classList.remove("is-view-switching"), 300);
        }
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

const closeOv1ModalIfOpen = () => closeOv1ModalIfOpenImpl($);
const ensureOv1ToolsDocked = () => ensureOv1ToolsDockedImpl(state);
const openOv1SidePanel = (mode, nodeId, edgeId) => openOv1SidePanelImpl(mode, nodeId, edgeId, state);
const closeOv1SidePanel = () => closeOv1SidePanelImpl(state);
const toggleOv1ToolsRail = () => toggleOv1ToolsRailImpl(state);
const toggleOv1SidePanelMode = (mode) => toggleOv1SidePanelModeImpl(mode, state);

function renderInspectorPanel() {
  renderInspectorPanelImpl({ state, $, getModels });
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

  bindDirectionEvents(getConceptPlanningCtx());
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
  document.querySelectorAll("[data-project-switch]").forEach((button) => addEventListenerOnce(button, "click", () => switchProject(button.dataset.projectSwitch, getProjectCtx()), "project-switch:click"));
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
      renderProjectManagerChrome(getProjectCtx());
    } catch {
      showToast("项目状态更新失败，请确认负责人身份");
    }
  }, "project-archive:click"));
  document.querySelectorAll("[data-project-delete]").forEach((button) => addEventListenerOnce(button, "click", async () => {
    const title = button.dataset.projectTitle || button.dataset.projectDelete;
    await handleDeleteProject(button.dataset.projectDelete, title, getProjectCtx());
  }, "project-delete:click"));
  document.querySelector("#projectCreateForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try {
      const result = await createProject({
        id: values.get("id"),
        kind: values.get("kind") || "tactic",
        title: values.get("title"),
        description: values.get("description")
      });
      switchProject(result.project.id, getProjectCtx());
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
    if (button.closest("#workflowGateRoot") || button.closest("#aiConfigRoot") || button.closest("#aiPromptRoot") || button.closest("#tacticsLibraryRoot")) return;
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
  if (commandPaletteController.handleAction(action)) return;
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
  if (action === "toggle-reduced-motion") {
    const isReduced = document.documentElement.getAttribute("data-reduced-motion") === "true";
    const next = !isReduced;
    document.documentElement.setAttribute("data-reduced-motion", next ? "true" : "false");
    document.body?.classList?.toggle("reduced-motion", next);
    try { localStorage.setItem("workbench_reduced_motion", next ? "true" : "false"); } catch {}
    const btn = document.getElementById("reducedMotionBtn");
    if (btn) {
      btn.setAttribute("aria-checked", next ? "true" : "false");
      btn.classList.toggle("is-active", next);
    }
    showToast(next ? "已开启减少动效模式" : "已恢复标准动效");
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
  if (action === "open-tactics-library") {
    state.tacticsLibraryOpen = true;
    closeMenubarMenus();
    try {
      const activeCat = (state.tacticsLibraryActiveCategory === "all" || state.tacticsLibraryActiveCategory === "全部") ? "" : (state.tacticsLibraryActiveCategory || "");
      const data = await fetchTacticsLibrary({
        category: activeCat,
        search: state.tacticsLibrarySearchQuery || ""
      });
      state.tacticsLibraryList = data.tactics || data.items || [];
    } catch (err) {
      showToast("战法库加载失败: " + err.message);
    }
    render({ skipViewRoot: true });
    return;
  }
  if (action === "close-tactics-library") {
    state.tacticsLibraryOpen = false;
    render({ skipViewRoot: true });
    return;
  }
  if (action === "filter-tactics-category") {
    const rawCategory = source?.dataset?.category ?? "";
    const category = (rawCategory === "all" || rawCategory === "全部") ? "" : rawCategory;
    state.tacticsLibraryActiveCategory = category;
    try {
      const data = await fetchTacticsLibrary({
        category,
        search: state.tacticsLibrarySearchQuery || ""
      });
      state.tacticsLibraryList = data.tactics || data.items || [];
    } catch (err) {
      showToast("战法库筛选失败: " + err.message);
    }
    render({ skipViewRoot: true });
    return;
  }
  if (action === "search-tactics-library") {
    const inputEl = document.getElementById("tacticsLibSearchInput") || document.querySelector(".tactics-search-input");
    const query = inputEl ? inputEl.value.trim() : (source?.value !== undefined ? String(source.value).trim() : "");
    state.tacticsLibrarySearchQuery = query;
    try {
      const activeCat = (state.tacticsLibraryActiveCategory === "all" || state.tacticsLibraryActiveCategory === "全部") ? "" : (state.tacticsLibraryActiveCategory || "");
      const data = await fetchTacticsLibrary({
        category: activeCat,
        search: query
      });
      state.tacticsLibraryList = data.tactics || data.items || [];
    } catch (err) {
      showToast("战法库搜索失败: " + err.message);
    }
    render({ skipViewRoot: true });
    return;
  }
  if (action === "reset-tactics-filter") {
    state.tacticsLibraryActiveCategory = "";
    state.tacticsLibrarySearchQuery = "";
    const inputEl = document.getElementById("tacticsLibSearchInput") || document.querySelector(".tactics-search-input");
    if (inputEl) inputEl.value = "";
    try {
      const data = await fetchTacticsLibrary({ category: "", search: "" });
      state.tacticsLibraryList = data.tactics || data.items || [];
    } catch (err) {
      showToast("战法库重置失败: " + err.message);
    }
    render({ skipViewRoot: true });
    return;
  }
  if (action === "save-to-tactics-library") {
    try {
      const result = await saveCurrentProjectToLibrary(state);
      const savedName = result.tactic?.name || result.item?.name || "作战概念战法";
      showToast(`已成功将当前战法【${savedName}】存入战法库！`);
      if (state.tacticsLibraryOpen) {
        const activeCat = (state.tacticsLibraryActiveCategory === "all" || state.tacticsLibraryActiveCategory === "全部") ? "" : (state.tacticsLibraryActiveCategory || "");
        const data = await fetchTacticsLibrary({
          category: activeCat,
          search: state.tacticsLibrarySearchQuery || ""
        });
        state.tacticsLibraryList = data.tactics || data.items || [];
        render({ skipViewRoot: true });
      }
    } catch (err) {
      showToast("存入战法库失败: " + err.message);
    }
    return;
  }
  if (action === "fork-tactic-as-project") {
    const tacticId = source?.dataset?.tacticId;
    if (!tacticId) return;
    const list = state.tacticsLibraryList || [];
    const tactic = list.find((t) => t.id === tacticId);
    if (!tactic) {
      showToast("未找到指定战法模板");
      return;
    }
    const newId = `tactic-fork-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newTitle = `${tactic.name} (复用副本)`;
    const newProjectPayload = buildForkedProjectData(tactic, newId, newTitle);

    try {
      const result = await createProject(newProjectPayload);
      state.tacticsLibraryOpen = false;
      showToast(`已基于战法【${tactic.name}】创建独立解耦新项目！`);
      switchProject(result.project.id, getProjectCtx());
    } catch (err) {
      showToast("以战法创建项目失败: " + err.message);
    }
    return;
  }
  if (action === "delete-tactic-entry" || action === "delete-tactic-from-library") {
    const tacticId = source?.dataset?.tacticId;
    if (!tacticId) return;
    if (!window.confirm("确定要从战法库中移除该战法吗？（已复用创建的项目不受影响）")) return;
    try {
      await deleteTacticFromLibrary(tacticId);
      showToast("战法已从战法库移除");
      const activeCat = (state.tacticsLibraryActiveCategory === "all" || state.tacticsLibraryActiveCategory === "全部") ? "" : (state.tacticsLibraryActiveCategory || "");
      const data = await fetchTacticsLibrary({
        category: activeCat,
        search: state.tacticsLibrarySearchQuery || ""
      });
      state.tacticsLibraryList = data.tactics || data.items || [];
      render({ skipViewRoot: true });
    } catch (err) {
      showToast("删除战法失败: " + err.message);
    }
    return;
  }
  if (action === "toggle-what-if-form") {
    const turnNum = Number(source?.dataset?.turnNumber) || 1;
    state.wargameWhatIfSelectedTurn = state.wargameWhatIfSelectedTurn === turnNum ? null : turnNum;
    render({ skipViewRoot: false });
    return;
  }
  if (action === "close-what-if-form") {
    state.wargameWhatIfSelectedTurn = null;
    render({ skipViewRoot: false });
    return;
  }
  if (action === "execute-what-if-fork") {
    const turnNum = Number(source?.dataset?.turnNumber) || 1;
    const branchTitle = document.getElementById("whatIfBranchTitle")?.value || "";
    const assumption = document.getElementById("whatIfAssumption")?.value || "";
    const payload = buildWhatIfProjectPayload(state, turnNum, { branchTitle, assumption });

    try {
      const result = await createProject(payload);
      state.wargameWhatIfSelectedTurn = null;
      showToast(`已从第 ${turnNum} 回合派生 What-If 探索分支项目！`);
      switchProject(result.project.id, getProjectCtx());
    } catch (err) {
      showToast("派生 What-If 分支失败: " + err.message);
    }
    return;
  }
  if (action === "generate-wargame-review-report") {
    state.selectedReportTemplate = "wargame-review";
    await navigateToResearchView("report");
    showToast("已基于推演流水线切换至【推演复盘报告 (wargame-review)】");
    return;
  }
  if (action === "workflow-submit-review") {
    const activeProject = (state.projectDirectory?.projects || []).find((p) => p.id === state.activeProjectId) || state.project;
    try {
      // 1. 自动冻结当前模型快照
      const snapshotCtx = snapshotContextFromState(state, activeProject);
      state.modelSnapshots = saveModelSnapshot({
        ...snapshotCtx,
        label: `送审基线快照 (${new Date().toLocaleTimeString()})`
      }, state.modelSnapshots || []);

      // 2. 更新项目评审状态
      await updateProject(state.activeProjectId, { reviewStatus: REVIEW_STATUSES.SUBMITTED });
      if (activeProject) activeProject.reviewStatus = REVIEW_STATUSES.SUBMITTED;
      if (state.project) state.project.reviewStatus = REVIEW_STATUSES.SUBMITTED;

      showToast("方案已成功提交送审，并自动冻结当前模型基线快照！");
      render({ skipViewRoot: true });
    } catch (err) {
      showToast("提交送审失败: " + err.message);
    }
    return;
  }
  if (action === "workflow-request-changes") {
    const activeProject = (state.projectDirectory?.projects || []).find((p) => p.id === state.activeProjectId) || state.project;
    const note = window.prompt("请输入需修改的审阅意见：", "请强化制胜机理中反辐射中继活动的因果链条");
    if (note === null) return;
    try {
      const actorLabel = state.collaboration?.session?.actor?.label || "审阅人员";
      const approval = {
        reviewer: actorLabel,
        decidedAt: new Date().toISOString(),
        note: note.trim() || "需退回修改完善"
      };
      await updateProject(state.activeProjectId, { reviewStatus: REVIEW_STATUSES.REVISING, approval });
      if (activeProject) {
        activeProject.reviewStatus = REVIEW_STATUSES.REVISING;
        activeProject.approval = approval;
      }
      if (state.project) {
        state.project.reviewStatus = REVIEW_STATUSES.REVISING;
        state.project.approval = approval;
      }
      showToast("方案已退回修改，进入需修改状态。");
      render({ skipViewRoot: true });
    } catch (err) {
      showToast("退回修改操作失败: " + err.message);
    }
    return;
  }
  if (action === "workflow-finalize-approval") {
    const activeProject = (state.projectDirectory?.projects || []).find((p) => p.id === state.activeProjectId) || state.project;
    if (!window.confirm("确定签批定稿吗？定稿后全工作台将开启只读保护，后续修改需派生新修订分支。")) return;
    try {
      const actorLabel = state.collaboration?.session?.actor?.label || "审阅负责人";
      const approval = {
        reviewer: actorLabel,
        decidedAt: new Date().toISOString(),
        note: "审阅合格，予以签批定稿"
      };
      await updateProject(state.activeProjectId, { reviewStatus: REVIEW_STATUSES.FINALIZED, approval });
      if (activeProject) {
        activeProject.reviewStatus = REVIEW_STATUSES.FINALIZED;
        activeProject.approval = approval;
      }
      if (state.project) {
        state.project.reviewStatus = REVIEW_STATUSES.FINALIZED;
        state.project.approval = approval;
      }
      showToast("方案已正式签批定稿，已开启只读保护！");
      render({ skipViewRoot: true });
    } catch (err) {
      showToast("签批定稿失败: " + err.message);
    }
    return;
  }
  if (action === "workflow-fork-revision") {
    const activeProject = (state.projectDirectory?.projects || []).find((p) => p.id === state.activeProjectId) || state.project;
    try {
      const payload = buildRevisedProjectPayload(activeProject, state);
      const result = await createProject(payload);
      state.reviewReadonlyDialogOpen = false;
      showToast(`已成功基于定稿方案派生新修订分支【${result.project.title}】！`);
      switchProject(result.project.id, getProjectCtx());
    } catch (err) {
      showToast("派生新修订分支失败: " + err.message);
    }
    return;
  }
  if (action === "close-readonly-dialog") {
    state.reviewReadonlyDialogOpen = false;
    render({ skipViewRoot: true });
    return;
  }
  if (action === "apply-research-candidate") {
    const activeProject = (state.projectDirectory?.projects || []).find((p) => p.id === state.activeProjectId) || state.project;
    if (isProjectFinalized(activeProject)) {
      state.reviewReadonlyDialogOpen = true;
      render({ skipViewRoot: true });
      showToast("当前方案已签批定稿（只读保护），如需修改请派生新修订分支！");
      return;
    }
    const candidateId = source?.dataset?.candidateId;
    const sessions = [
      state.inspirationChatSession,
      state.phaseActionChatSession,
      state.forceMissionChatSession,
      state.ruleLibraryChatSession,
      state.sequenceChatSession,
      state.stateMachineChatSession
    ].filter(Boolean);

    let targetCandidate = null;
    for (const sess of sessions) {
      for (const msg of sess.messages || []) {
        if (msg.candidate?.id === candidateId) {
          targetCandidate = msg.candidate;
          break;
        }
      }
      if (targetCandidate) break;
    }

    if (!targetCandidate) {
      showToast("未找到待应用的建议候选");
      return;
    }

    const applied = await applyWithRecoveryPoint(
      getDodafCtx(),
      { label: targetCandidate.title || "应用 AI 研讨建议", source: "ai-research-assistant" },
      async () => {
        const patch = targetCandidate.patch || {};
        if (patch.brief && state.brief) {
          Object.assign(state.brief, patch.brief);
        }
        if (Array.isArray(patch.activities) && state.ov5?.activities) {
          state.ov5.activities.push(...patch.activities);
        }
        if (patch.argumentChain && state.ov5?.argumentChain) {
          Object.assign(state.ov5.argumentChain, patch.argumentChain);
        }
        targetCandidate.applied = true;
        targetCandidate.appliedAt = new Date().toISOString();
        return true;
      }
    );

    if (applied) {
      showToast(`已安全应用建议「${targetCandidate.title}」（已创建撤销恢复点）`);
      render();
    }
    return;
  }
  if (action === "dismiss-research-candidate") {
    const candidateId = source?.dataset?.candidateId;
    const sessions = [
      state.inspirationChatSession,
      state.phaseActionChatSession,
      state.forceMissionChatSession,
      state.ruleLibraryChatSession,
      state.sequenceChatSession,
      state.stateMachineChatSession
    ].filter(Boolean);

    for (const sess of sessions) {
      for (const msg of sess.messages || []) {
        if (msg.candidate?.id === candidateId) {
          msg.candidate.dismissed = true;
          break;
        }
      }
    }
    render();
    return;
  }
  if (handleConceptPlanningAction(action, source, getConceptPlanningCtx())) return;
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
  if (action === "generate-task-decomposition") {
    if (state.activeView !== "ov1b") return;
    void dodafProductController.pregenerateOv1bFromTasks({ silent: false, force: true });
    return;
  }
  if (await handleWorkflowAction(action, source, getWorkflowActionCtx())) return;
  if (handleProjectAction(action, source, getProjectCtx())) return;
  if (action === "open-collaboration") {
    state.activeView = "collaboration";
    state.selection = null;
    closeMenubarMenus();
    render();
    return;
  }
  if (action === "undo-last-transaction") {
    if (!Array.isArray(state.undoStack) || state.undoStack.length === 0) {
      showToast("当前暂无可撤销的操作");
      return;
    }
    const itemToUndo = state.undoStack[0];
    const targetSnapshot = state.modelSnapshots?.find((s) => s.id === itemToUndo.snapshotId);
    if (!targetSnapshot) {
      state.undoStack.shift();
      showToast(`未能找到恢复快照（${itemToUndo.snapshotId}），该撤销项已移除`);
      render();
      return;
    }
    const confirmed = window.confirm(`确定要撤销操作「${itemToUndo.label}」吗？\n\n系统将恢复至操作前的模型快照。`);
    if (!confirmed) return;
    try {
      const restored = restoreModelSnapshot(targetSnapshot, { briefSeed: projectBriefSeed, projectId: activeProjectId });
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
      state.undoStack.shift();
      void syncRestoredModels();
      showToast(`已成功撤销操作「${itemToUndo.label}」`);
      render();
    } catch (err) {
      console.error("撤销恢复失败:", err);
      showToast(`撤销失败：${err.message || "未知异常"}`);
    }
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
  if (action === "delete-current-project") {
    closeMenubarMenus();
    const activeProject = (state.projectDirectory?.projects || []).find((p) => p.id === state.activeProjectId);
    const title = activeProject?.title || currentProjectTitle();
    if (state.activeProjectId === "default" && !activeProject) {
      showToast("当前无自定义项目可删除");
      return;
    }
    void handleDeleteProject(state.activeProjectId, title, getProjectCtx());
    return;
  }
  if (action === "reset-project-content") {
    if (state.resettingProject) return;
    closeMenubarMenus();
    const title = currentProjectTitle();
    const confirmed = window.confirm(
      `确定要清空当前项目“${title}”的全部研究内容吗？\n\n此操作将清空：\n• 概念简报、研讨记录与研究方向\n• 阶段与行动规划\n• 作战任务、任务区域与作战兵力编成\n• 概念图及所有 DoDAF 架构模型（OV-1 至 OV-7）\n• 想定、OODA 循环与验证结果\n\n系统会在清空前自动创建可撤销恢复点。确定继续吗？`
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

    const resetCtx = {
      state,
      render,
      showToast,
      projectModelSnapshotSyncController
    };

    await applyWithRecoveryPoint(resetCtx, {
      label: `清空项目「${title}」全部内容`,
      source: "project-reset"
    }, async () => {
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
    }).catch((err) => {
      console.error("清空事务执行异常:", err);
    }).finally(() => {
      window.clearTimeout(safetyTimer);
      state.resettingProject = false;
      updateBusyOverlay();
      render();
    });
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
  if (redTeamController.handleAction(action, source)) return;
  if (deploymentController.handleAction(action)) return;
  if (conceptPlanningController.handleAction(action, source)) return;
  if (conceptMapController.handleAction(action)) return;
  if (collaborationController.handleAction(action)) return;
  if (oodaController.handleAction(action)) return;
  if (simulationAdapterController.handleAction(action)) return;
  if (scenarioController.handleAction(action, source)) return;
  if (await validationController.handleAction(action, source)) return;
  if (handleReportAction(action, source, getReportCtx())) return;
  showToast("已创建概念注释");
}

async function restoreSnapshot(snapshot) {
  const restoreCtx = {
    state,
    render,
    showToast,
    projectModelSnapshotSyncController
  };

  return applyWithRecoveryPoint(restoreCtx, {
    label: `恢复快照 ${snapshot?.label || ""}`,
    source: "snapshot-restore-preapply"
  }, async () => {
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
    await syncRestoredModels();
  });
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

function exportModelComparison(type, comparison) {
  downloadArtifact(buildModelComparisonArtifact(type, comparison));
}

function downloadArtifact(artifact) {
  downloadArtifactHelper(artifact, showToast);
}

function writePrintableReport(target, payload, loading = false) {
  writePrintableReportHelper(target, payload, loading, (reportPayload) => buildExportArtifactFromPayload("markdown", reportPayload).content);
}

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

function getModels() {
  return { ov1: state.ov1, ov5: state.ov5, ooda: state.ooda, scenario: state.scenario, validationResult: state.validationResult, knowledge: state.knowledge, knowledgeQuery: state.knowledgeQuery, conceptMap: state.conceptMap };
}

bindMenubarChrome(getChromeCtx());
bindWorkflowGateChrome(getChromeCtx());
bindAiModalsChrome(getChromeCtx());

bindOv5aDragAndDrop(getOv5Ctx());

if (typeof window !== "undefined") {
  try {
    const isReduced = localStorage.getItem("workbench_reduced_motion") === "true";
    if (isReduced) {
      document.documentElement.setAttribute("data-reduced-motion", "true");
      document.body?.classList?.add("reduced-motion");
      const btn = document.getElementById("reducedMotionBtn");
      if (btn) {
        btn.setAttribute("aria-checked", "true");
        btn.classList.add("is-active");
      }
    }
  } catch {}

  commandPaletteController.bindEvents();

  window.__workbench = {
    getState: () => state,
    render,
    goToWorkflowView,
    navigateToResearchView,
    handleAction: (action, source) => handleAction(action, source),
    applyWithRecoveryPoint: (meta, mutate) => applyWithRecoveryPoint({
      state,
      render,
      showToast,
      projectModelSnapshotSyncController
    }, meta, mutate)
  };
}
