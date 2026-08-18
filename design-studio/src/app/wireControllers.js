/**
 * Wire workbench controllers and project sync adapters.
 * Shell callbacks (render, invalidate*, remote apply/restore) stay in main.js.
 */
import { createOodaController } from "../oodaController.js";
import { createOv1Controller } from "../ov1Controller.js";
import { createTraceabilityController } from "../traceabilityController.js";
import { createOv1AiController } from "../ov1AiController.js";
import { createOv1ConceptMapController } from "../ov1ConceptMapController.js";
import { createOv5DrawflowController } from "../drawflowCanvasController.js";
import { createProjectOv5SyncController } from "../projectOv5SyncController.js";
import { createProjectModelSyncController } from "../projectModelSyncController.js";
import { createProjectHistorySyncController } from "../projectHistorySyncController.js";
import { createOv5AiController } from "../ov5AiController.js";
import { createOodaAiController } from "../oodaAiController.js";
import { createModelSnapshotController } from "../modelSnapshotController.js";
import { createScenarioController } from "../scenarioController.js";
import { createSimulationAdapterController } from "../simulationAdapterController.js";
import { createValidationController } from "../validationController.js";
import { createKnowledgeController } from "../knowledgeController.js";
import { createProjectBriefSyncController } from "../projectBriefSyncController.js";
import { createBriefController } from "../briefController.js";
import { createInspirationAdviceController } from "../inspirationAdviceController.js";
import { createAiDirectionController } from "../aiDirectionController.js";
import { createObsidianArchiveController } from "../obsidianArchiveController.js";
import { createRedTeamController } from "../redTeamController.js";
import { createAiConfigController } from "../aiConfigController.js";
import { createDeploymentController } from "../deploymentController.js";
import { createConceptMapController } from "../conceptMapController.js";
import { createConceptPlanningController } from "../conceptPlanningController.js";
import { createPhaseActionChatController } from "../phaseActionChatController.js";
import { createForceMissionChatController } from "../forceMissionChatController.js";
import { createRuleLibraryChatController } from "../ruleLibraryChatController.js";
import { createSequenceChatController } from "../sequenceChatController.js";
import { createStateMachineChatController } from "../stateMachineChatController.js";
import { createSequenceCanvasController } from "../sequenceCanvasController.js";
import { createResearchChatProjectSync } from "../researchChatProjectSync.js";
import { createCollaborationController } from "../collaborationController.js";
import { createDodafProductController } from "../dodafProductController.js";
import { createStateMachineCanvasController } from "../stateMachineCanvasController.js";
import { createOv4CanvasController } from "../ov4CanvasController.js";
import { createAiOv1Draft } from "../ov1DraftStore.js";
import { saveOv1Model } from "../ov1Store.js";
import { selectionFor } from "../ui.js";
import { buildProjectAuditArtifact } from "../projectAuditArtifact.js";
import { buildCollaborationSecurityArtifact } from "../collaborationSecurityArtifact.js";
import {
  createProjectModelSnapshot,
  createCollaborationAccount,
  createProjectCollaborationReview,
  createProjectReportArchive,
  deleteProjectModelSnapshot,
  deleteProjectReportArchive,
  loadProjectModelSnapshots,
  loadProjectAudit,
  loadCollaborationSession,
  loadCollaborationAccounts,
  loadCollaborationSecurityEvents,
  loadProjectCollaboration,
  loadProjectForceMissionPlan,
  loadProjectPhaseActionConcept,
  loadProjectConceptMap,
  loadProjectConceptGraphicPlan,
  loadProjectOv1,
  loadProjectOoda,
  loadProjectReportArchives,
  loadProjectScenario,
  loadProjectValidation,
  saveProjectOoda,
  saveProjectForceMissionPlan,
  saveProjectPhaseActionConcept,
  saveProjectConceptMap,
  saveProjectConceptGraphicPlan,
  saveProjectOv1,
  saveProjectScenario,
  saveProjectValidation,
  resolveProjectCollaborationReview,
  loginCollaboration,
  registerCollaboration,
  logoutCollaboration,
  setupCollaborationAccount,
  updateCollaborationAccount
} from "../projectBriefClient.js";
import {
  createKnowledgeCitationApproval,
  loadKnowledgeCitationApprovals,
  loadProjectKnowledge,
  revokeKnowledgeCitationApproval,
  saveProjectKnowledge,
  searchProjectKnowledge
} from "../projectKnowledgeClient.js";

export function wireControllers({
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
  hydrateProjectDirectory
}) {
  const refreshWorkflowConfirmation = () => hydrateProjectDirectory();

  const projectOv5SyncController = createProjectOv5SyncController({
    projectId: activeProjectId,
    getState: () => state,
    render,
    notify: showToast,
    onSaved: refreshWorkflowConfirmation,
    applyRemoteOv5,
    captureLocal: () => state.ov5,
    restoreLocal: restoreLocalOv5ConflictDraft
  });

  const projectOv1SyncController = createProjectModelSyncController({
    projectId: activeProjectId,
    resource: "ov1",
    storageKey: "ov1Storage",
    resourceLabel: "高层作战概念图",
    load: loadProjectOv1,
    save: saveProjectOv1,
    getState: () => state,
    render,
    notify: showToast,
    onSaved: refreshWorkflowConfirmation,
    applyRemote: applyRemoteOv1,
    conflictRecovery: { capture: () => state.ov1, restore: restoreLocalOv1ConflictDraft }
  });

  const projectForceMissionSyncController = createProjectModelSyncController({
    projectId: activeProjectId,
    resource: "forceMissionPlan",
    storageKey: "forceMissionStorage",
    resourceLabel: "force mission plan",
    load: loadProjectForceMissionPlan,
    save: saveProjectForceMissionPlan,
    getState: () => state,
    render,
    notify: showToast,
    onSaved: refreshWorkflowConfirmation,
    applyRemote: applyRemoteForceMission,
    conflictRecovery: { capture: () => state.forceMission, restore: restoreLocalForceMissionConflictDraft }
  });

  const projectPhaseActionSyncController = createProjectModelSyncController({
    projectId: activeProjectId,
    resource: "phaseActionConcept",
    storageKey: "phaseActionStorage",
    resourceLabel: "phase action concept",
    load: loadProjectPhaseActionConcept,
    save: saveProjectPhaseActionConcept,
    getState: () => state,
    render,
    notify: showToast,
    onSaved: refreshWorkflowConfirmation,
    applyRemote: applyRemotePhaseAction,
    conflictRecovery: { capture: () => state.phaseAction, restore: restoreLocalPhaseActionConflictDraft }
  });

  const projectConceptMapSyncController = createProjectModelSyncController({
    projectId: activeProjectId,
    resource: "conceptMap",
    storageKey: "conceptMapStorage",
    resourceLabel: "concept map",
    load: loadProjectConceptMap,
    save: saveProjectConceptMap,
    getState: () => state,
    render,
    notify: showToast,
    onSaved: refreshWorkflowConfirmation,
    applyRemote: applyRemoteConceptMap,
    conflictRecovery: { capture: () => state.conceptMap, restore: restoreLocalConceptMapConflictDraft }
  });

  const projectConceptGraphicSyncController = createProjectModelSyncController({
    projectId: activeProjectId,
    resource: "conceptGraphicPlan",
    storageKey: "conceptGraphicStorage",
    resourceLabel: "concept graphic plan",
    load: loadProjectConceptGraphicPlan,
    save: saveProjectConceptGraphicPlan,
    getState: () => state,
    render,
    notify: showToast,
    onSaved: refreshWorkflowConfirmation,
    applyRemote: applyRemoteConceptGraphic,
    conflictRecovery: { capture: () => state.conceptGraphic, restore: restoreLocalConceptGraphicConflictDraft }
  });

  const projectOodaSyncController = createProjectModelSyncController({
    projectId: activeProjectId,
    resource: "ooda",
    storageKey: "oodaStorage",
    resourceLabel: "OODA",
    load: loadProjectOoda,
    save: saveProjectOoda,
    getState: () => state,
    render,
    notify: showToast,
    onSaved: refreshWorkflowConfirmation,
    applyRemote: applyRemoteOoda,
    conflictRecovery: { capture: () => state.ooda, restore: restoreLocalOodaConflictDraft }
  });

  const projectScenarioSyncController = createProjectModelSyncController({
    projectId: activeProjectId,
    resource: "scenario",
    storageKey: "scenarioStorage",
    resourceLabel: "scenario",
    load: loadProjectScenario,
    save: saveProjectScenario,
    getState: () => state,
    render,
    notify: showToast,
    onSaved: refreshWorkflowConfirmation,
    applyRemote: applyRemoteScenario,
    conflictRecovery: { capture: () => state.scenario, restore: restoreLocalScenarioConflictDraft }
  });

  const projectValidationSyncController = createProjectModelSyncController({
    projectId: activeProjectId,
    resource: "validation",
    storageKey: "validationStorage",
    resourceLabel: "validation",
    load: loadProjectValidation,
    save: saveProjectValidation,
    getState: () => state,
    render,
    notify: showToast,
    onSaved: refreshWorkflowConfirmation,
    applyRemote: applyRemoteValidation,
    conflictRecovery: { capture: () => state.validationResult, restore: restoreLocalValidationConflictDraft }
  });

  const projectKnowledgeSyncController = createProjectModelSyncController({
    projectId: activeProjectId,
    resource: "knowledge",
    storageKey: "knowledgeStorage",
    resourceLabel: "knowledge index",
    load: loadProjectKnowledge,
    save: saveProjectKnowledge,
    getState: () => state,
    render,
    notify: showToast,
    onSaved: refreshWorkflowConfirmation,
    applyRemote: applyRemoteKnowledge
  });

  const projectReportArchiveSyncController = createProjectHistorySyncController({
    projectId: activeProjectId,
    resource: "reportArchives",
    storageKey: "reportStorage",
    listKey: "reportVersions",
    resourceLabel: "report archives",
    load: loadProjectReportArchives,
    create: createProjectReportArchive,
    remove: deleteProjectReportArchive,
    getState: () => state,
    render,
    notify: showToast,
    onSaved: refreshWorkflowConfirmation,
    applyRemote: applyRemoteReportArchives,
    upsertRemote: upsertRemoteReportArchive,
    removeRemote: removeRemoteReportArchive
  });

  const projectModelSnapshotSyncController = createProjectHistorySyncController({
    projectId: activeProjectId,
    resource: "modelSnapshots",
    storageKey: "modelSnapshotStorage",
    listKey: "modelSnapshots",
    resourceLabel: "model snapshots",
    load: loadProjectModelSnapshots,
    create: createProjectModelSnapshot,
    remove: deleteProjectModelSnapshot,
    getState: () => state,
    render,
    notify: showToast,
    applyRemote: applyRemoteModelSnapshots,
    upsertRemote: upsertRemoteModelSnapshot,
    removeRemote: removeRemoteModelSnapshot
  });

  const projectBriefSyncController = createProjectBriefSyncController({
    projectId: activeProjectId,
    getState: () => state,
    render,
    notify: showToast,
    onSaved: refreshWorkflowConfirmation,
    applyRemoteBrief,
    captureLocal: () => ({ brief: state.brief, direction: state.direction, inspiration: state.inspiration, directions: state.customDirections }),
    restoreLocal: restoreLocalBriefConflictDraft
  });

  const oodaController = createOodaController({
    getState: () => state,
    getModels,
    render,
    selectOoda: (id) => {
      state.selection = selectionFor("ooda", id, getModels());
    },
    notify: showToast,
    invalidateDerivedArtifacts,
    syncOoda: (...args) => projectOodaSyncController.sync(...args)
  });

  const ov1Controller = createOv1Controller({
    getState: () => state,
    render,
    notify: showToast,
    selectNode: (id, options = {}) => {
      state.selection = selectionFor("ov1", id, getModels());
      state.ov1Dialog = null;
      state.ov1PanelEdgeId = null;
      if (options.open) {
        state.ov1ToolsOpen = true;
        state.ov1PanelOpen = true;
        state.ov1InspectorCollapsed = false;
        state.ov1PanelMode = "node";
        state.ov1PanelNodeId = id;
      }
    },
    invalidateValidation,
    syncOv1: (...args) => projectOv1SyncController.sync(...args)
  });

  const traceabilityController = createTraceabilityController({
    getState: () => state,
    getModels,
    selectionFor,
    render,
    notify: showToast
  });

  const ov1AiController = createOv1AiController({
    getState: () => state,
    render,
    notify: showToast,
    invalidateValidation,
    syncOv1: (...args) => projectOv1SyncController.sync(...args)
  });

  const ov1CanvasController = createOv1ConceptMapController({
    getState: () => state,
    render,
    notify: showToast,
    selectNode: (id, options = {}) => {
      state.selection = selectionFor("ov1", id, getModels());
      state.ov1Dialog = null;
      state.ov1PanelEdgeId = null;
      if (options.open) {
        state.ov1ToolsOpen = true;
        state.ov1PanelOpen = true;
        state.ov1InspectorCollapsed = false;
        state.ov1PanelMode = "node";
        state.ov1PanelNodeId = id;
      }
    },
    selectEdge: (edgeId) => {
      state.ov1Dialog = null;
      state.ov1ToolsOpen = true;
      state.ov1PanelOpen = true;
      state.ov1InspectorCollapsed = false;
      state.ov1PanelMode = "relations";
      state.ov1PanelEdgeId = edgeId || null;
      state.ov1PanelNodeId = null;
    },
    invalidateValidation,
    syncOv1: (...args) => projectOv1SyncController.sync(...args)
  });

  const ov5CanvasController = createOv5DrawflowController({
    getState: () => state,
    selectActivity: (id) => select("activity", id)
  });

  const ov5AiController = createOv5AiController({
    getState: () => state,
    render,
    notify: showToast,
    invalidateDerivedArtifacts,
    syncOv5: projectOv5SyncController.sync,
    syncOoda: projectOodaSyncController.sync
  });

  const oodaAiController = createOodaAiController({
    getState: () => state,
    render,
    notify: showToast,
    invalidateDerivedArtifacts,
    syncOoda: projectOodaSyncController.sync
  });

  const modelSnapshotController = createModelSnapshotController({
    getState: () => state,
    render,
    notify: showToast,
    project,
    restoreSnapshot,
    exportComparison: exportModelComparison,
    syncSnapshot: projectModelSnapshotSyncController.save,
    removeSnapshot: projectModelSnapshotSyncController.remove
  });

  const scenarioController = createScenarioController({
    getState: () => state,
    render,
    notify: showToast,
    invalidateValidation,
    syncScenario: projectScenarioSyncController.sync
  });

  const simulationAdapterController = createSimulationAdapterController({
    getState: () => state,
    render,
    notify: showToast,
    downloadArtifact,
    invalidateValidation,
    syncScenario: projectScenarioSyncController.sync
  });

  const validationController = createValidationController({
    getState: () => state,
    render,
    notify: showToast,
    syncValidation: projectValidationSyncController.sync
  });

  const knowledgeController = createKnowledgeController({
    getState: () => state,
    render,
    notify: showToast,
    invalidateRedTeam,
    syncKnowledge: projectKnowledgeSyncController.sync,
    searchProjectKnowledge: (query, limit, mode, includeSensitive) => searchProjectKnowledge(activeProjectId, query, limit, mode, includeSensitive),
    loadCitationApprovals: () => loadKnowledgeCitationApprovals(activeProjectId),
    createCitationApproval: (value) => createKnowledgeCitationApproval(activeProjectId, value),
    revokeCitationApproval: (approvalId, value) => revokeKnowledgeCitationApproval(activeProjectId, approvalId, value)
  });

  const briefController = createBriefController({
    getState: () => state,
    render,
    notify: showToast,
    invalidateDerivedArtifacts,
    seedBrief: projectBriefSeed,
    syncBrief: (brief, options) => projectBriefSyncController.sync(brief, { ...options, directions: state.customDirections })
  });

  const inspirationAdviceController = createInspirationAdviceController({
    projectId: activeProjectId,
    getState: () => state,
    render,
    notify: showToast,
    syncConversation: () => {
      void projectBriefSyncController.sync(state.brief, {
        direction: state.direction,
        inspiration: state.inspiration,
        source: "research-chat"
      });
    },
    applyBriefUpdate: (response, question) => applyResearchChatBriefUpdate(response, question)
  });

  const aiDirectionController = createAiDirectionController({
    projectId: activeProjectId,
    getState: () => state,
    render,
    notify: showToast
  });

  const obsidianArchiveController = createObsidianArchiveController({
    getState: () => state,
    render,
    notify: showToast,
    project
  });

  const redTeamController = createRedTeamController({
    getState: () => state,
    render,
    notify: showToast,
    syncValidation: projectValidationSyncController.sync
  });

  const aiConfigController = createAiConfigController({
    getState: () => state,
    render,
    notify: showToast,
    onSaved: () => redTeamController.refreshHealth()
  });

  const deploymentController = createDeploymentController({
    getState: () => state,
    render,
    notify: showToast,
    invalidateValidation,
    syncScenario: projectScenarioSyncController.sync
  });

  const conceptMapController = createConceptMapController({
    projectId: activeProjectId,
    getState: () => state,
    render,
    notify: showToast,
    syncConceptMap: (...args) => projectConceptMapSyncController.sync(...args),
    invalidateDependents: invalidateConceptMapDependents,
    downloadArtifact,
    projectTitle: () => project.title || activeProjectId,
    onReferenceConfirmed: async () => {
      state.activeView = "ov1";
      state.selection = null;
      render();
      showToast("概念图已确认，请继续高层作战概念图");
    }
  });

  const researchChatProjectSync = createResearchChatProjectSync({
    projectId: activeProjectId,
    getState: () => state,
    render
  });
  const persistResearchChats = (source = "research-chat") => {
    void researchChatProjectSync.persistFromState(source);
  };

  const phaseActionChatController = createPhaseActionChatController({
    projectId: activeProjectId,
    getState: () => state,
    render,
    notify: showToast,
    syncPhaseAction: (...args) => projectPhaseActionSyncController.sync(...args),
    onChatPersisted: persistResearchChats
  });

  const forceMissionChatController = createForceMissionChatController({
    projectId: activeProjectId,
    getState: () => state,
    render,
    notify: showToast,
    syncForceMission: (...args) => projectForceMissionSyncController.sync(...args),
    onChatPersisted: persistResearchChats
  });

  const conceptPlanningController = createConceptPlanningController({
    projectId: activeProjectId,
    getState: () => state,
    render,
    notify: showToast,
    syncForceMission: (...args) => projectForceMissionSyncController.sync(...args),
    syncPhaseAction: (...args) => projectPhaseActionSyncController.sync(...args),
    syncConceptGraphic: (...args) => projectConceptGraphicSyncController.sync(...args),
    onPhaseActionGenerated: (plan) => {
      phaseActionChatController.seedFromPlan(plan);
      // First draft after generate: open chat once for discovery (same spirit as OV-1 tools).
      state.phaseActionChatOpen = true;
    },
    onForceMissionGenerated: (plan) => {
      forceMissionChatController.seedFromPlan(plan);
      state.forceMissionChatOpen = true;
    },
    onOperationalTasksConfirmed: async () => {
      state.activeView = "force-mission";
      render();
      await conceptPlanningController.generateForceMission({ silent: false, layer: "concept" });
    },
    onPhaseActionConfirmed: async () => {
      // Phase chain: after phase confirm → rule binding / state / sequence, not force yet.
      state.activeView = "ov6a";
      render();
      await ruleLibraryChatController.proposeChanges("phase-action", { silent: false });
      // Force generation deferred until the 阶段行动 stage is completed (gate), not here.
    },
    onForceMissionConfirmed: async () => {
      await ruleLibraryChatController.proposeChanges("force-mission", { silent: false });
      state.activeView = "concept-map";
      render();
      // Deterministic seed only (no AI on concept-map step).
      if (typeof conceptMapController.seedFromPlanning === "function") {
        await conceptMapController.seedFromPlanning({ silent: false });
      }
    },
    onConceptGraphicConfirmed: async (_graphic, ov1Draft) => {
      const seeded = saveOv1Model(createAiOv1Draft({
        brief: state.brief,
        direction: state.direction,
        draft: ov1Draft
      }));
      state.ov1 = seeded;
      state.ov1Candidate = null;
      state.activeView = "ov1";
      state.selection = null;
      invalidateValidation();
      try {
        await projectOv1SyncController.sync(state.ov1, { source: "concept-graphic:seed-ov1" });
      } catch {
        /* local seed remains available */
      }
      showToast("已根据总体作战概念图种子化高层作战概念图，请继续复核");
      render();
    }
  });

  const collaborationController = createCollaborationController({
    projectId: activeProjectId,
    getState: () => state,
    render,
    notify: showToast,
    load: loadProjectCollaboration,
    loadAudit: loadProjectAudit,
    loadSession: loadCollaborationSession,
    loadAccounts: loadCollaborationAccounts,
    loadSecurityEvents: loadCollaborationSecurityEvents,
    setup: setupCollaborationAccount,
    login: loginCollaboration,
    register: registerCollaboration,
    logout: logoutCollaboration,
    createAccount: createCollaborationAccount,
    updateAccount: updateCollaborationAccount,
    createReview: createProjectCollaborationReview,
    resolveReview: resolveProjectCollaborationReview,
    onWorkflowChanged: refreshWorkflowConfirmation,
    onSessionChanged: async () => {
      await knowledgeController.hydrateCitationApprovals();
      if (state.collaboration?.session?.authenticated) {
        await hydrateProjectDirectory();
      } else {
        state.projectDirectory = { status: "login-required", projects: [] };
      }
    },
    exportAudit: (entries) => downloadArtifact(buildProjectAuditArtifact({ projectId: activeProjectId, entries })),
    exportSecurityEvents: (events) => downloadArtifact(buildCollaborationSecurityArtifact({ events }))
  });

  knowledgeController.bindStatic($("#knowledgeVaultInput"));
  deploymentController.bindWindow();

  const dodafProductController = createDodafProductController({
    projectId: activeProjectId,
    getState: () => state,
    render,
    notify: showToast,
    downloadArtifact,
    syncOv5: (...args) => projectOv5SyncController.sync(...args),
    onSaved: refreshWorkflowConfirmation,
    projectTitle: () => project.title || activeProjectId
  });

  const stateMachineCanvasController = createStateMachineCanvasController({
    projectId: activeProjectId,
    getState: () => state,
    render,
    notify: showToast,
    syncOv6b: (model, options = {}) => dodafProductController.syncResource("ov6b", model, {
      source: options.source || "state-machine-canvas",
      writeArchitecture: true
    })
  });
  const ov4CanvasController = createOv4CanvasController({
    projectId: activeProjectId,
    getState: () => state,
    render,
    syncOv4: (model, options = {}) => dodafProductController.syncResource("ov4", model, {
      source: options.source || "ov4-canvas",
      writeArchitecture: true
    })
  });

  const ruleLibraryChatController = createRuleLibraryChatController({
    projectId: activeProjectId,
    getState: () => state,
    render,
    notify: showToast,
    syncOv6a: (model, options = {}) => dodafProductController.syncResource("ov6a", model, {
      source: options.source || "rule-library:chat",
      writeArchitecture: true
    }),
    onChatPersisted: persistResearchChats,
    onBusyChange: () => {
      // Keep stage-transition overlay in sync while pregenerate runs outside full render paths.
      if (typeof document !== "undefined") {
        const shell = document.querySelector("#studioShell");
        if (shell) shell.classList.toggle("is-mode-switching", Boolean(state.ruleLibraryPregenerating || state.ruleLibraryChangeGenerating));
      }
    }
  });

  const sequenceChatController = createSequenceChatController({
    projectId: activeProjectId,
    getState: () => state,
    render,
    notify: showToast,
    syncOv6c: (model, options = {}) => dodafProductController.syncResource("ov6c", model, {
      source: options.source || "sequence:chat",
      writeArchitecture: true
    }),
    onChatPersisted: persistResearchChats
  });

  const stateMachineChatController = createStateMachineChatController({
    projectId: activeProjectId,
    getState: () => state,
    render,
    notify: showToast,
    syncOv6b: (model, options = {}) => dodafProductController.syncResource("ov6b", model, {
      source: options.source || "state-machine:chat",
      writeArchitecture: true
    }),
    onChatPersisted: persistResearchChats
  });

  const sequenceCanvasController = createSequenceCanvasController();

  return {
    oodaController,
    ov1Controller,
    traceabilityController,
    ov1AiController,
    ov1CanvasController,
    ov5CanvasController,
    projectOv5SyncController,
    projectOv1SyncController,
    projectForceMissionSyncController,
    projectPhaseActionSyncController,
    projectConceptMapSyncController,
    projectConceptGraphicSyncController,
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
    deploymentController,
    conceptMapController,
    conceptPlanningController,
    phaseActionChatController,
    forceMissionChatController,
    ruleLibraryChatController,
    sequenceChatController,
    sequenceCanvasController,
    stateMachineChatController,
    stateMachineCanvasController,
    ov4CanvasController,
    researchChatProjectSync,
    collaborationController
  };
}
