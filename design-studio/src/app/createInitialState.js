import { directions, project } from "../data.js";
import { loadConceptBrief, setConceptBriefProjectScope } from "../briefStore.js";
import { loadInspirationSession, setInspirationProjectScope } from "../inspirationStore.js";
import { buildDirectionProposals, loadAiDirections, loadCustomDirections, loadSelectedDirection } from "../directionProposalStore.js";
import { hasPersistedOv5Model, loadOv5Model } from "../ov5Store.js";
import { hasPersistedOv1Model, loadOv1Model, setOv1ProjectScope } from "../ov1Store.js";
import { hasPersistedOodaModel, loadOodaModel } from "../oodaStore.js";
import { hasPersistedScenario, loadScenario } from "../scenarioStore.js";
import { hasPersistedValidation, loadValidation } from "../validationStore.js";
import { loadReportVersions } from "../reportVersionStore.js";
import { loadReportTemplate } from "../reportTemplateStore.js";
import { loadModelSnapshots } from "../modelSnapshotStore.js";
import { loadKnowledgeVault } from "../knowledgeStore.js";
import { loadObsidianArchiveRecord } from "../obsidianArchiveStore.js";
import { loadSimulationAdapterSettings } from "../simulationAdapterSettingsStore.js";
import { loadQuantitativeComparisonSettings } from "../modelComparisonSettingsStore.js";
import { loadDeploymentBridge } from "../deploymentBridgeStore.js";
import { loadConceptMapBridge } from "../conceptMapBridgeStore.js";
import { loadConceptMap } from "../conceptMapStore.js";
import { loadCombatFocus } from "../combatFocusStore.js";
import { loadForceMission } from "../forceMissionStore.js";
import { loadPhaseAction } from "../phaseActionStore.js";
import { loadPhaseActionChat } from "../phaseActionChatStore.js";
import { loadForceMissionChat } from "../forceMissionChatStore.js";
import { loadRuleLibraryChat } from "../ruleLibraryChatStore.js";
import { loadSequenceChat } from "../sequenceChatStore.js";
import { loadStateMachineChat } from "../stateMachineChatStore.js";
import { loadConceptGraphic } from "../conceptGraphicStore.js";
import { createEmptyDodafProductState, DODAF_PRODUCT_KEYS } from "../dodafProductStore.js";
import { ensureClientStoragePurged } from "../clientStoragePurge.js";

export function resolveActiveProjectId() {
  return new URLSearchParams(window.location.search).get("project") || "default";
}

export function createProjectBriefSeed(activeProjectId) {
  return activeProjectId === "default"
    ? project.brief
    : { researchIntent: "", objective: "待补充", approach: "待补充", assumptions: "待补充", expectedEffects: "待补充", risk: "待补充", evidenceRefs: [] };
}

export function createInitialWorkbenchState(activeProjectId = resolveActiveProjectId()) {
  // Server wipe alone is not enough: workbench hydrates drafts from browser storage by project id.
  ensureClientStoragePurged();

  const projectBriefSeed = createProjectBriefSeed(activeProjectId);
  setConceptBriefProjectScope(activeProjectId);
  setInspirationProjectScope(activeProjectId);
  setOv1ProjectScope(activeProjectId);

  const hasLocalOv5Model = hasPersistedOv5Model();
  const ov5Model = loadOv5Model();
  const ov1Model = loadOv1Model();
  const hasLocalOv1Model = hasPersistedOv1Model();
  const hasLocalOodaModel = hasPersistedOodaModel();
  const oodaModel = loadOodaModel(ov5Model);
  const hasLocalScenario = hasPersistedScenario();
  const scenario = loadScenario();
  const hasLocalValidation = hasPersistedValidation(ov5Model, oodaModel, scenario, ov1Model);
  const inspiration = loadInspirationSession();
  const initialBrief = loadConceptBrief(projectBriefSeed);
  const reportVersions = loadReportVersions();
  const modelSnapshots = loadModelSnapshots();
  const knowledgeVault = loadKnowledgeVault();
  const conceptMap = loadConceptMap(activeProjectId);
  const combatFocus = loadCombatFocus(activeProjectId);
  const forceMission = loadForceMission(activeProjectId);
  const phaseAction = loadPhaseAction(activeProjectId);
  const phaseActionChat = loadPhaseActionChat(activeProjectId);
  const forceMissionChat = loadForceMissionChat(activeProjectId);
  const ruleLibraryChat = loadRuleLibraryChat(activeProjectId);
  const sequenceChat = loadSequenceChat(activeProjectId);
  const stateMachineChat = loadStateMachineChat(activeProjectId);
  const conceptGraphic = loadConceptGraphic(activeProjectId);
  const customDirections = loadCustomDirections(activeProjectId);
  const aiDirections = loadAiDirections(activeProjectId);
  const initialDirectionProposals = buildDirectionProposals({
    session: inspiration,
    fallbackDirections: directions,
    aiDirections,
    customDirections
  });

  const state = {
    activeView: "brief",
    activeProjectId,
    projectDirectory: { status: "checking", projects: [] },
    projectManagerOpen: false,
    projectEntryRequired: !new URLSearchParams(window.location.search).get("project"),
    projectCreateOpen: false,
    workflowCompleting: false,
    relatedModelReturnContext: null,
    direction: loadSelectedDirection(initialDirectionProposals),
    aiDirections,
    aiDirectionsGenerating: false,
    aiDirectionsAutoChecked: false,
    customDirections,
    projectRevision: 0,
    brief: initialBrief,
    projectStorage: { status: "checking", mode: "local", label: "正在检查" },
    inspiration,
    inspirationAdviceGenerating: false,
    obsidianArchive: loadObsidianArchiveRecord(),
    obsidianArchiveWriting: false,
    briefIntent: initialBrief.researchIntent,
    briefIncludeEvidence: false,
    briefGenerating: false,
    briefDraftReveal: false,
    directionPanelOpen: false,
    combatFocus,
    combatFocusGenerating: false,
    forceMission,
    forceMissionStorage: {
      status: "checking",
      mode: "local",
      label: "正在检查兵力与任务",
      localSaved: Boolean(forceMission.forces?.length || forceMission.combatForces?.length)
    },
    forceMissionGenerating: false,
    operationalTaskGenerating: false,
    operationalTaskGenerationProgress: null,
    operationalTaskSelectedId: forceMission.tasks?.[0]?.id || "",
    operationalTaskListScrollTop: 0,
    forceMissionGeneratingLayer: "",
    forceMissionChat,
    forceMissionChatGenerating: false,
    forceMissionChatOpen: false,
    forceMissionLayerTab: "concept",
    cmoCatalogStatus: null,
    forcePlatformPicker: {
      forceId: "",
      layer: "concept",
      query: "",
      domain: "",
      country: "",
      results: [],
      selectedIndexes: [],
      searching: false,
      error: ""
    },
    forceDetailDrawerEnter: false,
    forcePlatformRecommend: {
      status: "idle",
      running: false,
      skipFilled: true,
      country: "",
      report: [],
      assignments: [],
      seeds: [],
      error: "",
      source: ""
    },
    phaseAction,
    phaseActionStorage: { status: "checking", mode: "local", label: "正在检查阶段与行动", localSaved: Boolean(phaseAction.phases?.length) },
    phaseActionGenerating: false,
    phaseActionFocusId: "",
    phaseActionChat,
    phaseActionChatGenerating: false,
    phaseActionChatOpen: false,
    ruleLibraryChat,
    ruleLibraryChatGenerating: false,
    ruleLibraryChatOpen: false,
    ruleLibraryPregenerating: false,
    ruleLibraryChangeGenerating: false,
    ruleLibraryEntrySource: "default",
    sequenceChat,
    sequenceChatGenerating: false,
    sequencePregenerating: false,
    taskDecompositionPregenerating: false,
    ov1bSide: "friendly",
    ov1bSelectedGroupId: "",
    ov1bAddOpen: false,
    ov1bEditOpen: false,
    ov6GenerationContext: "phase",
    sequenceChatOpen: false,
    ov6cToolsOpen: false,
    stateMachineChat,
    stateMachineChatGenerating: false,
    stateMachineChatOpen: false,
    stateMachinePregenerating: false,
    ov6bSelectedMachineId: "",
    ov6bSelectedStateId: "",
    ov6bSelectedTransitionId: "",
    ov6bEditorOpen: false,
    ov6bToolsOpen: false,
    ov4SelectedDiagramId: "",
    ov4EditorOpen: false,
    ov4ToolsOpen: false,
    ov4Pregenerating: false,
    ov6cSelectedSequenceId: "",
    ov6cSelectedMessageId: "",
    ov6cDiagramEngine: "workbench",
    ov6cConnectFromId: "",
    ov6cEditorOpen: false,
    conceptGraphic,
    conceptGraphicStorage: { status: "checking", mode: "local", label: "正在检查总体作战概念图", localSaved: Boolean(conceptGraphic.nodes?.length) },
    conceptGraphicGenerating: false,
    conceptMap,
    conceptMapStorage: { status: "checking", mode: "local", label: "正在检查作战概念图", localSaved: Boolean(conceptMap.document?.items?.length) },
    conceptMapBridge: { settings: loadConceptMapBridge(), status: "使用独立地图工具" },
    conceptMapReferenceEditorOpen: false,
    conceptMapGenerating: false,
    conceptMapSeeding: false,
    conceptMapPulling: false,
    aiConfigOpen: false,
    aiConfig: { status: "idle", config: null },
    aiConfigSaving: false,
    aiPromptOpen: false,
    aiPromptCatalog: { items: [], configurationWrite: {} },
    aiPromptSelectedId: "",
    aiPromptSaving: false,
    selection: null,
    ov1: ov1Model,
    ov1Storage: { status: "checking", mode: "local", label: "正在检查高层作战概念图", localSaved: hasLocalOv1Model },
    ov1Generating: false,
    ov1Candidate: null,
    ov1Dialog: null,
    ov1PanelMode: "context",
    ov1PanelNodeId: null,
    ov1PanelEdgeId: null,
    ov1InspectorCollapsed: true,
    ov1PanelOpen: true,
    ov1ToolsOpen: false,
    contextPanelOpen: false,
    contextPanelFocus: "",
    briefPanelOpen: true,
    ...(() => {
      const products = createEmptyDodafProductState(activeProjectId);
      const storage = Object.fromEntries(DODAF_PRODUCT_KEYS.map((key) => [
        `${key}Storage`,
        { status: "checking", mode: "local", label: `正在检查 ${key.toUpperCase()}`, localSaved: Boolean(products[key]) }
      ]));
      return { ...products, ...storage };
    })(),
    architecture: null,
    architectureStorage: { status: "checking", mode: "local", label: "正在检查 Architecture", localSaved: false },
    ov5: ov5Model,
    ov5Storage: { status: "checking", mode: "local", label: "正在检查作战活动模型", localSaved: hasLocalOv5Model },
    ov5Generating: false,
    ooda: oodaModel,
    oodaStorage: { status: "checking", mode: "local", label: "正在检查 OODA", localSaved: hasLocalOodaModel },
    oodaGenerating: false,
    scenario,
    scenarioStorage: { status: "checking", mode: "local", label: "正在检查想定", localSaved: hasLocalScenario },
    simulationAdapterSettings: loadSimulationAdapterSettings(),
    lastDeploymentData: null,
    validationResult: loadValidation(ov5Model, oodaModel, scenario, ov1Model),
    validationStorage: { status: "checking", mode: "local", label: "正在检查验证", localSaved: hasLocalValidation },
    structureReviewFilter: { severity: "all", group: "all" },
    knowledge: knowledgeVault,
    knowledgeQuery: "",
    knowledgeResults: null,
    knowledgeSearch: { mode: "local", retrievalMode: "hybrid", includeSensitive: false, detail: "本地关键词检索，默认排除敏感片段" },
    knowledgeStorage: { status: "checking", mode: "local", label: "正在检查知识库", localSaved: knowledgeVault.docs.length > 0 },
    knowledgeCitationApprovals: [],
    redTeamRunning: false,
    redTeamHealth: { status: "unknown" },
    reportVersions,
    reportArchiving: false,
    reportTemplate: loadReportTemplate(),
    reportStorage: { status: "checking", mode: "local", label: "正在检查报告归档", localSaved: reportVersions.length > 0 },
    modelSnapshots,
    modelSnapshotStorage: { status: "checking", mode: "local", label: "正在检查模型快照", localSaved: modelSnapshots.length > 0 },
    modelComparison: null,
    modelComparisonSettings: loadQuantitativeComparisonSettings(),
    collaboration: {
      status: "checking",
      detail: "正在检查协同审阅服务。",
      storage: { status: "checking", mode: "local", label: "正在检查协同审阅" },
      reviews: [],
      openCount: 0,
      policy: null,
      revision: 0,
      resourceRevision: 0,
      authMode: "login",
      authBusy: false,
      authError: "",
      authNotice: "",
      authDraft: { username: "", label: "" }
    },
    deployment: {
      settings: loadDeploymentBridge(),
      open: false,
      status: "待推送",
      exchange: null,
      acceptedChangeIds: [],
      lastAccepted: null
    }
  };

  return { state, projectBriefSeed, activeProjectId };
}
