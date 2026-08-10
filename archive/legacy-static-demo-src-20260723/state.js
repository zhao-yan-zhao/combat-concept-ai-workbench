import { defaultKnowledge, sampleScenario, workflows } from "./data.js";
import { createDefaultScenarioGuide, normalizeScenarioGuide } from "./scenarioGuide.js";

const STORAGE_KEY = "combat-concept-ai-workbench:v1";
const now = new Date().toISOString();

export const state = {
  project: createDefaultProject(now),
  workflowId: "concept",
  workflowStates: createDefaultWorkflowStates(now),
  workflowRuns: [],
  knowledge: [...defaultKnowledge],
  knowledgeVault: createKnowledgeVaultSummary([...defaultKnowledge], now),
  scenario: {},
  scenarioText: sampleScenario,
  scenarioGuide: createDefaultScenarioGuide(),
  analysis: {},
  output: "",
  generation: null,
  ai: {
    mode: "mock",
    lastError: "",
    lastRunAt: ""
  },
  pendingSnapshot: null,
  pendingSnapshotHasChanges: false,
  undoSnapshot: null,
  persistence: {
    loaded: false,
    savedAt: "",
    error: ""
  }
};

export function resetKnowledge() {
  state.knowledge = [...defaultKnowledge];
  state.knowledgeVault = createKnowledgeVaultSummary(state.knowledge);
  state.project.knowledgeVaultIds = defaultKnowledge.map((_, index) => `default-doc-${index + 1}`);
  touchProject();
}

export function resetProject() {
  const timestamp = new Date().toISOString();
  state.project = createDefaultProject(timestamp);
  state.workflowId = state.project.currentWorkflowId;
  state.workflowStates = createDefaultWorkflowStates(timestamp);
  state.workflowRuns = [];
  state.scenario = {};
  state.scenarioText = sampleScenario;
  state.scenarioGuide = createDefaultScenarioGuide();
  state.analysis = {};
  state.output = "";
  state.generation = null;
  state.ai = { mode: "mock", lastError: "", lastRunAt: "" };
  state.pendingSnapshot = null;
  state.pendingSnapshotHasChanges = false;
  state.undoSnapshot = null;
}

export function setCurrentWorkflow(workflowId) {
  state.workflowId = workflowId;
  state.project.currentWorkflowId = workflowId;
  touchProject();
}

export function getWorkflowState(workflowId) {
  return state.workflowStates[workflowId];
}

export function markWorkflowRunning(workflowId) {
  const workflowState = state.workflowStates[workflowId];
  if (!workflowState) {
    return new Date().toISOString();
  }
  const startedAt = new Date();

  workflowState.status = "running";
  workflowState.lastRunAt = startedAt.toISOString();
  workflowState.notes = "正在基于当前项目上下文生成结果。";
  workflowState.updatedAt = startedAt.toISOString();
  touchProject(startedAt.toISOString());
  return startedAt.toISOString();
}

export function recordWorkflowRun(workflowId, summary) {
  const parsedStartedAt = summary.startedAt ? new Date(summary.startedAt) : new Date();
  const startedAt = Number.isFinite(parsedStartedAt.getTime()) ? parsedStartedAt : new Date();
  const finishedAt = new Date();
  const workflowState = state.workflowStates[workflowId];
  const runNumber = workflowState.runCount + 1;
  const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());

  workflowState.status = "generated";
  workflowState.lastRunAt = finishedAt.toISOString();
  workflowState.runCount = runNumber;
  workflowState.outputRef = `${workflowId}-run-${runNumber}`;
  workflowState.notes = summary.outputSummary;
  workflowState.updatedAt = finishedAt.toISOString();

  const run = {
    id: `run-${finishedAt.getTime()}`,
    workflowId,
    projectId: state.project.id,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    inputSummary: summary.inputSummary,
    outputSummary: summary.outputSummary,
    status: "success"
  };

  state.workflowRuns.unshift(run);
  state.workflowRuns = state.workflowRuns.slice(0, 12);
  touchProject(finishedAt.toISOString());
  return run;
}

export function updateProjectFromInputs({ name, direction }) {
  state.project.name = name.trim() || "联合封控作战概念研究";
  state.project.direction = direction.trim() || "海空方向联合行动";
  touchProject();
}

export function updateScenarioText(text) {
  state.scenarioText = text;
  touchProject();
}

export function updateScenarioGuide(updates) {
  state.scenarioGuide = normalizeScenarioGuide({
    ...state.scenarioGuide,
    ...updates,
    updatedAt: new Date().toISOString()
  });
  touchProject();
}

export function updateAiStatus({ mode, lastError = "", lastRunAt = new Date().toISOString() }) {
  state.ai = { mode, lastError, lastRunAt };
  touchProject();
}

export function updateKnowledgeVaultCount(knowledgeItems) {
  const items = Array.isArray(knowledgeItems) ? knowledgeItems : state.knowledge;
  state.knowledgeVault = createKnowledgeVaultSummary(items);
  state.project.knowledgeVaultIds = Array.from(
    { length: state.knowledgeVault.fileCount },
    (_, index) => `vault-doc-${index + 1}`
  );
  touchProject();
}

export function loadPersistedWorkbench() {
  const storage = getStorage();
  if (!storage) {
    return false;
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return false;
    }
    hydrateWorkbench(JSON.parse(raw), { restoreUndo: true });
    state.persistence.loaded = true;
    state.persistence.error = "";
    return true;
  } catch (error) {
    state.persistence.loaded = false;
    state.persistence.error = error.message;
    return false;
  }
}

export function persistWorkbench() {
  const storage = getStorage();
  if (!storage) {
    return { ok: false, error: "当前环境不支持 localStorage" };
  }

  const savedAt = new Date().toISOString();
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(createPersistedSnapshot(savedAt, { includeUndo: true })));
    state.persistence.savedAt = savedAt;
    state.persistence.error = "";
    return { ok: true, savedAt };
  } catch (error) {
    state.persistence.error = error.message;
    return { ok: false, error: error.message };
  }
}

export function clearPersistedWorkbench() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(STORAGE_KEY);
  state.persistence.loaded = false;
  state.persistence.savedAt = "";
  state.persistence.error = "";
}

export function exportWorkbenchSnapshot() {
  return createPersistedSnapshot(new Date().toISOString(), { includeUndo: false });
}

export function importWorkbenchSnapshot(snapshot) {
  try {
    validateSnapshot(snapshot);
    const undoSnapshot = state.undoSnapshot;
    hydrateWorkbench(snapshot, { restoreUndo: false });
    state.undoSnapshot = undoSnapshot;
    state.persistence.loaded = true;
    state.persistence.error = "";
    return { ok: true };
  } catch (error) {
    state.persistence.error = error.message;
    return { ok: false, error: error.message };
  }
}

export function prepareSnapshotUndo() {
  state.undoSnapshot = createPersistedSnapshot(new Date().toISOString());
}

export function restoreSnapshotUndo() {
  if (!state.undoSnapshot) {
    return { ok: false, error: "没有可撤销的导入" };
  }

  const snapshot = state.undoSnapshot;
  state.undoSnapshot = null;
  return importWorkbenchSnapshot(snapshot);
}

export function clearSnapshotUndo() {
  state.undoSnapshot = null;
}

export function summarizeWorkbenchSnapshot(snapshot) {
  validateSnapshot(snapshot);
  const workflowId = normalizeWorkflowId(snapshot.workflowId || snapshot.project.currentWorkflowId);
  const knowledge = Array.isArray(snapshot.knowledge) ? snapshot.knowledge : [];
  const workflowRuns = Array.isArray(snapshot.workflowRuns) ? snapshot.workflowRuns : [];
  const workflowStates = snapshot.workflowStates && typeof snapshot.workflowStates === "object"
    ? snapshot.workflowStates
    : {};
  const currentWorkflowState = workflowStates[workflowId] || {};

  return {
    projectName: String(snapshot.project.name || "未命名项目"),
    direction: String(snapshot.project.direction || "未设置研究方向"),
    workflowId,
    workflowTitle: workflows.find((workflow) => workflow.id === workflowId)?.tab || workflowId,
    savedAt: snapshot.savedAt || "",
    updatedAt: snapshot.project.updatedAt || "",
    runCount: workflowRuns.length,
    currentWorkflowRunCount: Number.isFinite(currentWorkflowState.runCount) ? currentWorkflowState.runCount : 0,
    knowledgeCount: knowledge.length,
    scenarioLength: String(snapshot.scenarioText || "").length,
    outputLength: String(snapshot.output || "").length
  };
}

export function compareWorkbenchSnapshot(snapshot) {
  const incoming = summarizeWorkbenchSnapshot(snapshot);
  const current = summarizeCurrentWorkbench();

  return [
    createDiffItem("项目", current.projectName, incoming.projectName),
    createDiffItem("方向", current.direction, incoming.direction),
    createDiffItem("工作流", current.workflowTitle, incoming.workflowTitle),
    createDiffItem("当前运行", `${current.currentWorkflowRunCount} 次`, `${incoming.currentWorkflowRunCount} 次`),
    createDiffItem("运行记录", `${current.runCount} 条`, `${incoming.runCount} 条`),
    createDiffItem("知识片段", `${current.knowledgeCount} 个`, `${incoming.knowledgeCount} 个`),
    createDiffItem("想定长度", `${current.scenarioLength} 字`, `${incoming.scenarioLength} 字`),
    createDiffItem("输出长度", `${current.outputLength} 字`, `${incoming.outputLength} 字`)
  ];
}

function summarizeCurrentWorkbench() {
  const workflowId = normalizeWorkflowId(state.workflowId);
  const workflowState = state.workflowStates[workflowId] || {};

  return {
    projectName: state.project.name || "未命名项目",
    direction: state.project.direction || "未设置研究方向",
    workflowTitle: workflows.find((workflow) => workflow.id === workflowId)?.tab || workflowId,
    runCount: state.workflowRuns.length,
    currentWorkflowRunCount: Number.isFinite(workflowState.runCount) ? workflowState.runCount : 0,
    knowledgeCount: state.knowledge.length,
    scenarioLength: String(state.scenarioText || "").length,
    outputLength: String(state.output || "").length
  };
}

function createDiffItem(label, current, incoming) {
  return {
    label,
    current,
    incoming,
    changed: String(current) !== String(incoming)
  };
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("快照不是有效对象");
  }

  if (snapshot.version !== 1) {
    throw new Error("快照版本不受支持");
  }

  if (!snapshot.project || typeof snapshot.project !== "object") {
    throw new Error("快照缺少项目信息");
  }
}

function createDefaultProject(timestamp) {
  return {
    id: "project-001",
    name: "联合封控作战概念研究",
    direction: "海空方向联合行动",
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
    currentWorkflowId: "concept",
    scenarioId: "scenario-001",
    knowledgeVaultIds: defaultKnowledge.map((_, index) => `default-doc-${index + 1}`),
    conceptPlanIds: [],
    evaluationIds: []
  };
}

function createDefaultWorkflowStates(timestamp) {
  return Object.fromEntries(workflows.map((workflow) => [
    workflow.id,
    {
      workflowId: workflow.id,
      status: workflow.id === "concept" ? "needs-review" : "not-started",
      lastRunAt: "",
      runCount: 0,
      outputRef: "",
      notes: workflow.id === "concept"
        ? "Demo 初始概念可作为第一轮生成前的参考草稿。"
        : "等待当前项目材料进入该工作流。",
      updatedAt: timestamp
    }
  ]));
}

function hydrateWorkbench(data, options = {}) {
  const timestamp = new Date().toISOString();
  const project = data.project || {};
  const workflowId = normalizeWorkflowId(data.workflowId || project.currentWorkflowId);
  const knowledge = normalizePersistedKnowledge(data.knowledge);

  state.project = {
    ...createDefaultProject(timestamp),
    ...project,
    currentWorkflowId: workflowId,
    knowledgeVaultIds: Array.isArray(project.knowledgeVaultIds) ? project.knowledgeVaultIds : []
  };
  state.workflowId = workflowId;
  state.workflowStates = mergeWorkflowStates(data.workflowStates, timestamp);
  state.workflowRuns = normalizeWorkflowRuns(data.workflowRuns, state.project.id);
  state.knowledge = knowledge;
  state.knowledgeVault = data.knowledgeVault || createKnowledgeVaultSummary(knowledge);
  state.scenario = data.scenario || {};
  state.scenarioText = typeof data.scenarioText === "string" ? data.scenarioText : sampleScenario;
  state.scenarioGuide = normalizeScenarioGuide(data.scenarioGuide);
  state.analysis = data.analysis || {};
  state.output = typeof data.output === "string" ? data.output : "";
  state.generation = data.generation || null;
  state.ai = data.ai && typeof data.ai === "object"
    ? {
      mode: data.ai.mode || "mock",
      lastError: data.ai.lastError || "",
      lastRunAt: data.ai.lastRunAt || ""
    }
    : { mode: "mock", lastError: "", lastRunAt: "" };
  state.undoSnapshot = options.restoreUndo ? data.undoSnapshot || null : state.undoSnapshot;
  state.persistence.savedAt = data.savedAt || "";
}

function createPersistedSnapshot(savedAt, options = {}) {
  const snapshot = {
    version: 1,
    savedAt,
    project: cloneData(state.project),
    workflowId: state.workflowId,
    workflowStates: cloneData(state.workflowStates),
    workflowRuns: cloneData(state.workflowRuns),
    knowledge: state.knowledge.map(toPersistedKnowledgeItem).slice(0, 240),
    knowledgeVault: cloneData(state.knowledgeVault),
    scenario: cloneData(state.scenario),
    scenarioText: state.scenarioText,
    scenarioGuide: cloneData(state.scenarioGuide),
    analysis: cloneData(state.analysis),
    output: state.output,
    generation: cloneData(state.generation),
    ai: cloneData(state.ai)
  };

  if (options.includeUndo) {
    snapshot.undoSnapshot = cloneData(state.undoSnapshot);
  }

  return snapshot;
}

function mergeWorkflowStates(savedStates, timestamp) {
  const defaults = createDefaultWorkflowStates(timestamp);
  const source = savedStates && typeof savedStates === "object" ? savedStates : {};

  return Object.fromEntries(workflows.map((workflow) => {
    const saved = source[workflow.id] || {};
    const savedRunCount = Number.isFinite(saved.runCount) ? saved.runCount : defaults[workflow.id].runCount;
    return [
      workflow.id,
      {
        ...defaults[workflow.id],
        ...saved,
        workflowId: workflow.id,
        runCount: savedRunCount,
        status: normalizeWorkflowStatus(saved.status || defaults[workflow.id].status, savedRunCount)
      }
    ];
  }));
}

function normalizeWorkflowRuns(runs, projectId) {
  if (!Array.isArray(runs)) {
    return [];
  }

  return runs
    .filter((run) => run && normalizeWorkflowId(run.workflowId))
    .map((run) => ({
      id: String(run.id || `run-${Date.now()}`),
      workflowId: normalizeWorkflowId(run.workflowId),
      projectId: String(run.projectId || projectId),
      startedAt: String(run.startedAt || ""),
      finishedAt: String(run.finishedAt || ""),
      durationMs: Number.isFinite(run.durationMs) ? run.durationMs : calculateDuration(run.startedAt, run.finishedAt),
      inputSummary: String(run.inputSummary || ""),
      outputSummary: String(run.outputSummary || ""),
      status: ["success", "failed", "draft"].includes(run.status) ? run.status : "draft"
    }))
    .slice(0, 12);
}

function normalizePersistedKnowledge(items) {
  if (!Array.isArray(items) || !items.length) {
    return [...defaultKnowledge];
  }

  return items.map((item) => ({
    ...item,
    title: String(item.title || item.name || "未命名知识"),
    name: String(item.name || item.filePath || item.title || "未命名知识.md"),
    filePath: String(item.filePath || item.name || ""),
    tags: Array.isArray(item.tags) ? item.tags : [],
    links: Array.isArray(item.links) ? item.links : [],
    content: String(item.content || item.text || "").slice(0, 1200),
    text: String(item.text || item.content || "").slice(0, 520),
    summary: String(item.summary || item.text || item.content || "").slice(0, 180),
    matchReasons: []
  }));
}

function toPersistedKnowledgeItem(item) {
  const content = String(item.content || item.text || "");
  const text = String(item.text || content);
  return {
    id: item.id,
    vaultId: item.vaultId,
    vaultName: item.vaultName,
    filePath: item.filePath || item.name || "",
    name: item.name || item.filePath || item.title,
    title: item.title || item.name || "未命名知识",
    fileTitle: item.fileTitle || item.title || "",
    tags: Array.isArray(item.tags) ? item.tags.slice(0, 12) : [],
    links: Array.isArray(item.links) ? item.links.slice(0, 12) : [],
    content: content.slice(0, 1200),
    text: text.slice(0, 520),
    summary: String(item.summary || text).slice(0, 180),
    sourceType: item.sourceType || "markdown",
    importedAt: item.importedAt || "",
    fileCount: item.fileCount || 1,
    chunkIndex: item.chunkIndex || 0
  };
}

function normalizeWorkflowId(workflowId) {
  return workflows.some((workflow) => workflow.id === workflowId) ? workflowId : "concept";
}

function normalizeWorkflowStatus(status, runCount = 0) {
  if (status === "running") {
    return runCount > 0 ? "needs-review" : "not-started";
  }

  return ["not-started", "generated", "needs-review", "approved"].includes(status)
    ? status
    : "not-started";
}

function createKnowledgeVaultSummary(items, importedAt = new Date().toISOString()) {
  const files = unique(items.map((item) => item.filePath || item.name || item.title));
  return {
    id: "vault-local",
    name: "本地 OBS/Obsidian 知识库",
    sourceType: "obsidian",
    fileCount: files.length,
    chunkCount: items.length,
    importedAt
  };
}

function touchProject(timestamp = new Date().toISOString()) {
  state.project.updatedAt = timestamp;
}

function calculateDuration(startedAt, finishedAt) {
  const startTime = new Date(startedAt || "").getTime();
  const finishTime = new Date(finishedAt || "").getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(finishTime)) {
    return 0;
  }
  return Math.max(0, finishTime - startTime);
}

function getStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function cloneData(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function unique(items) {
  return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
}
