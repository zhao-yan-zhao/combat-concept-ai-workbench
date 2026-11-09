import { getViewMeta, renderTree } from "../ui.js";
import { renderProjectStorageFooter } from "../projectStorageView.js";
import { renderProjectManager, renderProjectEntry } from "../projectManagerView.js";
import { renderCollaborationLoginGate } from "../collaborationView.js";
import { renderAiConfigPanel } from "../aiConfigView.js";
import { renderAiPromptPanel } from "../aiPromptView.js";
import { renderTacticsLibraryModal } from "../tacticsLibraryView.js";
import { renderReviewWorkflowBar, renderFinalizedReadonlyDialog } from "../reviewWorkflowView.js";
import { resolveStepTargetOutput } from "./workflowGate.js";

/**
 * Render Studio Shell chrome elements (trees, headers, footers, buttons, and system panels).
 */
export function renderStudioShell(ctx) {
  const {
    state,
    $,
    currentWorkflow,
    currentProjectTitle,
    getBusyOverlayState,
    updateBusyOverlay,
    renderWorkflowGate,
    renderOv1ToolboxFloatHost
  } = ctx;

  const meta = getViewMeta(state.activeView);
  const conceptTreeMarkup = renderTree(state.activeView, currentWorkflow(), state);
  const conceptTreeElem = $("#conceptTree");
  if (conceptTreeElem && conceptTreeElem.dataset.renderedMarkup !== conceptTreeMarkup) {
    conceptTreeElem.innerHTML = conceptTreeMarkup;
    conceptTreeElem.dataset.renderedMarkup = conceptTreeMarkup;
  }
  $("#viewEyebrow").textContent = meta.subtitle;
  $("#viewTitle").textContent = meta.label;
  const targetOutput = resolveStepTargetOutput(state.activeView, null, { mainViewId: state.relatedModelReturnContext?.mainViewId, state });
  const targetOutputTooltip = targetOutput ? `\n本步产出：${targetOutput}` : "";
  $("#viewContext").title = `${currentProjectTitle()} / ${meta.label}${targetOutputTooltip}`;

  const projectStorageMarkup = renderProjectStorageFooter(state.projectStorage);
  const projectStorageElem = $("#projectStorageState");
  if (projectStorageElem && projectStorageElem.dataset.renderedMarkup !== projectStorageMarkup) {
    projectStorageElem.innerHTML = projectStorageMarkup;
    projectStorageElem.dataset.renderedMarkup = projectStorageMarkup;
  }

  const projectManagerMarkup = renderProjectManager({
    directory: state.projectDirectory,
    activeProjectId: state.activeProjectId,
    open: state.projectManagerOpen,
    createOpen: state.projectCreateOpen,
    isLead: state.collaboration?.session?.actor?.roles?.includes("lead")
  });
  const projectManagerElem = $("#projectManagerRoot");
  if (projectManagerElem && projectManagerElem.dataset.renderedMarkup !== projectManagerMarkup) {
    projectManagerElem.innerHTML = projectManagerMarkup;
    projectManagerElem.dataset.renderedMarkup = projectManagerMarkup;
  }

  const identityButton = $("#collaborationIdentityBtn");
  const actor = state.collaboration?.session?.actor;
  const workflowTestModeButton = $("#workflowTestModeBtn");
  const saveVersionButton = $("#saveVersionBtn");
  const undoTransactionButton = $("#undoTransactionBtn");
  const testModeActive = currentWorkflow().mode === "free";
  const modeSwitching = Boolean(state.workflowModeSwitching);
  const reportArchiving = Boolean(state.reportArchiving);
  const busyOverlay = getBusyOverlayState();

  if (undoTransactionButton) {
    const hasUndo = Array.isArray(state.undoStack) && state.undoStack.length > 0;
    const latestUndo = hasUndo ? state.undoStack[0] : null;
    undoTransactionButton.disabled = !hasUndo || modeSwitching || reportArchiving || Boolean(busyOverlay);
    undoTransactionButton.textContent = latestUndo ? `撤销: ${latestUndo.label}` : "撤销";
    undoTransactionButton.title = latestUndo
      ? `撤销上一步操作「${latestUndo.label}」并恢复模型快照 (${new Date(latestUndo.at).toLocaleTimeString()})`
      : "暂无可撤销的操作";
  }

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
  $("#studioShell").classList.remove("ov1-focus");

  const ov1Toggle = document.querySelector(".ov1-sidebar-toggle");
  if (ov1Toggle) ov1Toggle.hidden = true;

  const loginGate = $("#loginGate");
  loginGate.hidden = authenticated && !projectEntry;
  const loginMarkup = projectEntry
    ? renderProjectEntry({ directory: state.projectDirectory, createOpen: state.projectCreateOpen })
    : authenticated ? "" : renderCollaborationLoginGate(state.collaboration);
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
    drafts: state.aiPromptDrafts || {},
    viewingDiffVersionId: state.aiPromptViewingDiffVersionId || null
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

  const tacticsLibraryMarkup = renderTacticsLibraryModal({
    open: Boolean(state.tacticsLibraryOpen),
    tactics: state.tacticsLibraryList || [],
    searchQuery: state.tacticsLibrarySearchQuery || "",
    activeCategory: state.tacticsLibraryActiveCategory || "all"
  });
  const tacticsLibraryElem = $("#tacticsLibraryRoot");
  if (tacticsLibraryElem && tacticsLibraryElem.dataset.renderedMarkup !== tacticsLibraryMarkup) {
    tacticsLibraryElem.innerHTML = tacticsLibraryMarkup;
    tacticsLibraryElem.dataset.renderedMarkup = tacticsLibraryMarkup;
  }

  // M7-T7.10 评审与签批流程状态栏与只读弹窗
  const activeProject = (state.projectDirectory?.projects || []).find((p) => p.id === state.activeProjectId) || state.project;
  const reviewWorkflowMarkup = renderReviewWorkflowBar(activeProject, { session: state.collaboration?.session });
  const reviewWorkflowElem = $("#reviewWorkflowRoot");
  if (reviewWorkflowElem && reviewWorkflowElem.dataset.renderedMarkup !== reviewWorkflowMarkup) {
    reviewWorkflowElem.innerHTML = reviewWorkflowMarkup;
    reviewWorkflowElem.dataset.renderedMarkup = reviewWorkflowMarkup;
  }

  const reviewReadonlyDialogMarkup = state.reviewReadonlyDialogOpen ? renderFinalizedReadonlyDialog(activeProject) : "";
  const reviewReadonlyDialogElem = $("#reviewReadonlyDialogRoot");
  if (reviewReadonlyDialogElem && reviewReadonlyDialogElem.dataset.renderedMarkup !== reviewReadonlyDialogMarkup) {
    reviewReadonlyDialogElem.innerHTML = reviewReadonlyDialogMarkup;
    reviewReadonlyDialogElem.dataset.renderedMarkup = reviewReadonlyDialogMarkup;
  }

  renderOv1ToolboxFloatHost();
}
