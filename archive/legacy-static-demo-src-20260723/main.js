import { $, downloadFile } from "./dom.js";
import { sampleScenario, workflows, defaultKnowledge } from "./data.js";
import {
  clearPersistedWorkbench,
  clearSnapshotUndo,
  compareWorkbenchSnapshot,
  exportWorkbenchSnapshot,
  importWorkbenchSnapshot,
  loadPersistedWorkbench,
  markWorkflowRunning,
  persistWorkbench,
  prepareSnapshotUndo,
  recordWorkflowRun,
  resetKnowledge,
  resetProject,
  restoreSnapshotUndo,
  setCurrentWorkflow,
  state,
  summarizeWorkbenchSnapshot,
  updateAiStatus,
  updateScenarioGuide,
  updateKnowledgeVaultCount,
  updateProjectFromInputs,
  updateScenarioText
} from "./state.js";
import { generateWithAi, getAiHealth, isAiOutput } from "./aiClient.js";
import { importVaultFiles, searchKnowledge } from "./knowledge.js";
import { parseScenario } from "./scenario.js";
import {
  buildGuidedScenarioText,
  clampStep,
  getScenarioGuideProgress,
  scenarioGuideSteps,
  seedScenarioGuideFromText
} from "./scenarioGuide.js";
import {
  renderAnalysis,
  renderEvidence,
  renderKnowledge,
  renderProjectOverview,
  renderGeneratedOutput,
  renderSelectedWorkflow,
  renderWorkflowRuns,
  renderWorkflowOutput,
  renderWorkflowTabs
} from "./render.js";

function init() {
  loadPersistedWorkbench();
  $("#scenarioText").value = state.scenarioText || sampleScenario;
  $("#projectName").value = state.project.name;
  $("#projectDirection").value = state.project.direction;
  renderWorkflowTabs(selectWorkflow);
  if (Object.keys(state.analysis).length) {
    $("#inputScore").textContent = state.scenario?.rawText?.length > 120 ? "要素较完整" : "已恢复";
  } else {
    parseScenario();
  }
  renderAnalysis();
  renderKnowledge();
  renderWorkflowRuns();
  selectWorkflow(state.workflowId);
  renderScenarioGuide();
  if (state.undoSnapshot) {
    showSnapshotUndo();
  }
  renderAiMode();
  checkAiHealth();
  renderPersistenceStatus();

  $("#guideToggleBtn").addEventListener("click", toggleScenarioGuide);
  $("#guideAnswer").addEventListener("input", updateCurrentGuideAnswer);
  $("#guidePrevBtn").addEventListener("click", () => moveGuideStep(-1));
  $("#guideNextBtn").addEventListener("click", () => moveGuideStep(1));
  $("#guideSeedBtn").addEventListener("click", seedGuideFromScenarioText);
  $("#guideApplyBtn").addEventListener("click", applyGuidedScenario);
  $("#extractBtn").addEventListener("click", refreshScenario);
  $("#resetBtn").addEventListener("click", resetDemo);
  $("#newProjectBtn").addEventListener("click", resetDemo);
  $("#projectName").addEventListener("input", syncProjectInputs);
  $("#projectDirection").addEventListener("input", syncProjectInputs);
  $("#scenarioText").addEventListener("input", syncScenarioDraft);
  $("#runWorkflowBtn").addEventListener("click", runWorkflow);
  $("#kbSearch").addEventListener("input", renderKnowledge);
  $("#vaultInput").addEventListener("change", importVault);
  $("#copyOutputBtn").addEventListener("click", copyOutput);
  $("#exportMarkdownBtn").addEventListener("click", exportMarkdown);
  $("#exportJsonBtn").addEventListener("click", exportJson);
  $("#exportSnapshotBtn").addEventListener("click", exportSnapshot);
  $("#snapshotInput").addEventListener("change", importSnapshot);
  $("#applySnapshotBtn").addEventListener("click", applyPendingSnapshot);
  $("#cancelSnapshotBtn").addEventListener("click", clearSnapshotPreview);
  $("#undoSnapshotBtn").addEventListener("click", undoSnapshotImport);
}

function selectWorkflow(id) {
  setCurrentWorkflow(id);
  renderSelectedWorkflow();
  renderWorkflowOutput();
  renderProjectOverview();
  saveWorkbench();
}

function refreshScenario() {
  updateScenarioText($("#scenarioText").value);
  parseScenario();
  renderAnalysis();
  renderEvidence();
  renderWorkflowOutput();
  renderProjectOverview();
  saveWorkbench();
}

async function importVault(event) {
  const imported = await importVaultFiles(event.target.files);
  state.knowledge = [...imported, ...defaultKnowledge];
  updateKnowledgeVaultCount(state.knowledge);
  renderKnowledge();
  renderEvidence();
  renderWorkflowOutput();
  renderProjectOverview();
  saveWorkbench();
}

function resetDemo() {
  clearPersistedWorkbench();
  resetProject();
  resetKnowledge();
  state.pendingSnapshot = null;
  clearSnapshotUndo();
  hideSnapshotUndo();
  $("#projectName").value = state.project.name;
  $("#projectDirection").value = state.project.direction;
  $("#scenarioText").value = state.scenarioText;
  $("#kbSearch").value = "";
  refreshScenario();
  renderKnowledge();
  renderWorkflowTabs(selectWorkflow);
  renderWorkflowRuns();
  selectWorkflow(state.workflowId);
  saveWorkbench();
}

function syncProjectInputs() {
  updateProjectFromInputs({
    name: $("#projectName").value,
    direction: $("#projectDirection").value
  });
  renderProjectOverview();
  saveWorkbench();
}

function syncScenarioDraft() {
  updateScenarioText($("#scenarioText").value);
  saveWorkbench();
}

function toggleScenarioGuide() {
  const active = $("#scenarioGuide").classList.contains("hidden");
  updateScenarioGuide({ active });
  renderScenarioGuide();
  saveWorkbench();
}

function renderScenarioGuide() {
  const guide = $("#scenarioGuide");
  if (!guide) {
    return;
  }

  guide.classList.toggle("hidden", !state.scenarioGuide.active);
  const currentIndex = clampStep(state.scenarioGuide.currentStep);
  const step = scenarioGuideSteps[currentIndex];
  const progress = getScenarioGuideProgress(state.scenarioGuide);

  $("#guideStepTitle").textContent = step.title;
  $("#guideStepPrompt").textContent = step.prompt;
  $("#guideProgress").textContent = `${progress.completed}/${progress.total}`;
  $("#guideAnswer").placeholder = step.placeholder;
  $("#guideAnswer").value = state.scenarioGuide.answers[step.id] || "";
  $("#guidePrevBtn").disabled = currentIndex === 0;
  $("#guideNextBtn").disabled = currentIndex === scenarioGuideSteps.length - 1;
  $("#guideSteps").innerHTML = scenarioGuideSteps.map((item, index) => {
    const done = state.scenarioGuide.answers[item.id]?.trim();
    return `
      <button class="guide-step ${index === currentIndex ? "active" : ""} ${done ? "done" : ""}" data-guide-step="${index}">
        ${index + 1}. ${escapeInline(item.title)}
      </button>
    `;
  }).join("");
  $("#guideSteps").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      saveCurrentGuideAnswer();
      updateScenarioGuide({ currentStep: Number(button.dataset.guideStep) });
      renderScenarioGuide();
      saveWorkbench();
    });
  });
}

function updateCurrentGuideAnswer() {
  saveCurrentGuideAnswer();
  renderScenarioGuide();
  saveWorkbench();
}

function saveCurrentGuideAnswer() {
  const currentIndex = clampStep(state.scenarioGuide.currentStep);
  const step = scenarioGuideSteps[currentIndex];
  updateScenarioGuide({
    answers: {
      ...state.scenarioGuide.answers,
      [step.id]: $("#guideAnswer").value
    }
  });
}

function moveGuideStep(delta) {
  saveCurrentGuideAnswer();
  updateScenarioGuide({ currentStep: clampStep(state.scenarioGuide.currentStep + delta) });
  renderScenarioGuide();
  saveWorkbench();
}

function seedGuideFromScenarioText() {
  const seeded = seedScenarioGuideFromText(state.scenarioGuide, $("#scenarioText").value);
  updateScenarioGuide(seeded);
  renderScenarioGuide();
  saveWorkbench();
}

function applyGuidedScenario() {
  saveCurrentGuideAnswer();
  $("#scenarioText").value = buildGuidedScenarioText(state.scenarioGuide);
  refreshScenario();
}

async function runWorkflow() {
  updateScenarioText($("#scenarioText").value);
  const workflowId = state.workflowId;
  const startedAt = markWorkflowRunning(workflowId);
  const runButton = $("#runWorkflowBtn");
  runButton.disabled = true;
  runButton.textContent = "运行中";
  renderWorkflowTabs(selectWorkflow, { disabled: true });
  renderSelectedWorkflow();
  renderProjectOverview();
  saveWorkbench();

  try {
    await renderWorkflowOutputWithAi(workflowId);
    const workflow = workflows.find((item) => item.id === workflowId);
    const analysisCount = Object.keys(state.analysis).length;
    const inputSummary = `${analysisCount} 个想定要素，${state.knowledge.length} 条知识库资料`;
    const outputSummary = `${workflow.tab}已生成阶段性输出，等待人工修订或流转。`;

    recordWorkflowRun(workflowId, { startedAt, inputSummary, outputSummary });
    renderWorkflowRuns();
  } finally {
    runButton.disabled = false;
    runButton.textContent = "运行工作流";
    renderWorkflowTabs(selectWorkflow);
    renderSelectedWorkflow();
    renderProjectOverview();
    saveWorkbench();
  }
}

async function renderWorkflowOutputWithAi(workflowId = state.workflowId) {
  const workflow = workflows.find((item) => item.id === workflowId);
  const evidence = searchKnowledge(Object.values(state.analysis).join(" "), state.knowledge, 3);

  try {
    setModelMode("AI 生成中");
    const output = await generateWithAi({
      workflow,
      workflowId: workflow.id,
      analysis: state.analysis,
      scenario: state.scenario,
      knowledge: state.knowledge.slice(0, 20),
      evidence
    });

    if (!isAiOutput(output)) {
      throw new Error("AI 返回结构不完整");
    }

    renderGeneratedOutput(output);
    renderEvidence();
    updateAiStatus({ mode: "ai", lastError: "" });
    setModelMode("真实 AI");
  } catch (error) {
    renderWorkflowOutput();
    updateAiStatus({ mode: "mock", lastError: error.message });
    setModelMode("Demo 兜底");
  }
}

function setModelMode(label) {
  const modelMode = $("#modelMode");
  if (modelMode) {
    modelMode.textContent = label;
  }
}

function renderAiMode() {
  if (state.ai.mode === "ai") {
    setModelMode("真实 AI");
    return;
  }
  if (state.ai.mode === "ai-ready") {
    setModelMode("真实 AI 就绪");
    return;
  }
  if (state.ai.lastError) {
    setModelMode("Demo 兜底");
    return;
  }
  setModelMode("Demo 模拟生成");
}

async function checkAiHealth() {
  try {
    const health = await getAiHealth();
    if (health.configured) {
      if (state.ai.mode !== "ai") {
        updateAiStatus({ mode: "ai-ready", lastError: "", lastRunAt: state.ai.lastRunAt || "" });
      }
      setModelMode(`真实 AI 就绪 · ${health.model}`);
      saveWorkbench();
      return;
    }
    updateAiStatus({ mode: "mock", lastError: "未配置 OPENAI_API_KEY", lastRunAt: state.ai.lastRunAt || "" });
    setModelMode("Demo 模拟生成");
    saveWorkbench();
  } catch {
    setModelMode(state.ai.lastError ? "Demo 兜底" : "Demo 模拟生成");
  }
}

async function copyOutput() {
  await navigator.clipboard.writeText(state.output);
  $("#copyOutputBtn").textContent = "已复制";
  setTimeout(() => {
    $("#copyOutputBtn").textContent = "复制";
  }, 1200);
}

function exportMarkdown() {
  downloadFile(`${$("#projectName").value || "作战概念研究"}.md`, state.output, "text/markdown;charset=utf-8");
}

function exportJson() {
  const generation = state.generation;
  const data = {
    project: state.project,
    scenario: state.scenario,
    conceptPlans: generation ? collectConceptPlans(generation) : [],
    evaluation: generation?.evaluation ?? null,
    knowledgeRefs: generation?.evidenceRefs ?? [],
    mapInput: generation?.mapInput ?? createEmptyMapInput(),
    workflow: workflows.find((item) => item.id === state.workflowId),
    workflowState: state.workflowStates[state.workflowId],
    workflowRuns: state.workflowRuns,
    analysis: state.analysis,
    outputMarkdown: state.output,
    generation,
    ai: state.ai,
    knowledgeVault: state.knowledgeVault,
    knowledgeCount: state.knowledge.length,
    exportedAt: new Date().toISOString()
  };
  downloadFile(`${$("#projectName").value || "作战概念研究"}.json`, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
}

function exportSnapshot() {
  updateScenarioText($("#scenarioText").value);
  saveWorkbench();
  const snapshot = exportWorkbenchSnapshot();
  const filename = `${state.project.name || "作战概念研究"}-项目快照.json`;
  downloadFile(filename, JSON.stringify(snapshot, null, 2), "application/json;charset=utf-8");
}

async function importSnapshot(event) {
  const [file] = Array.from(event.target.files || []);
  event.target.value = "";
  if (!file) {
    return;
  }

  try {
    const snapshot = JSON.parse(await file.text());
    const summary = summarizeWorkbenchSnapshot(snapshot);
    const diffs = compareWorkbenchSnapshot(snapshot);
    const hasChanges = diffs.some((item) => item.changed);
    state.pendingSnapshot = hasChanges ? snapshot : null;
    state.pendingSnapshotHasChanges = hasChanges;
    renderSnapshotPreview(summary, diffs, hasChanges);
  } catch (error) {
    state.persistence.error = "项目快照格式无效";
    state.pendingSnapshot = null;
    state.pendingSnapshotHasChanges = false;
    clearSnapshotPreview();
    renderPersistenceStatus();
  }
}

function applyPendingSnapshot() {
  if (!state.pendingSnapshot || !state.pendingSnapshotHasChanges) {
    return;
  }

  prepareSnapshotUndo();
  const result = importWorkbenchSnapshot(state.pendingSnapshot);
  if (!result.ok) {
    clearSnapshotUndo();
    state.persistence.error = "项目快照格式无效";
    renderPersistenceStatus();
    return;
  }

  state.pendingSnapshot = null;
  state.pendingSnapshotHasChanges = false;
  clearSnapshotPreview();
  applyStateToUi();
  showSnapshotUndo();
  saveWorkbench();
}

function undoSnapshotImport() {
  const result = restoreSnapshotUndo();
  if (!result.ok) {
    state.persistence.error = result.error;
    renderPersistenceStatus();
    return;
  }

  hideSnapshotUndo();
  clearSnapshotPreview();
  applyStateToUi();
  saveWorkbench();
}

function collectConceptPlans(generation) {
  if (generation.outputSchema === "ConceptPlan") {
    return [generation.result];
  }

  if (generation.outputSchema === "PlanVariant[]") {
    return generation.result;
  }

  return [
    {
      id: generation.evaluation?.conceptPlanId || "concept-001",
      name: "当前工作流关联方案占位",
      sourceWorkflowId: generation.workflowId,
      summary: "当前导出来自评估或成果工作流，方案正文可由概念生成或多方案工作流补充。",
      evidenceRefs: generation.evidenceRefs
    }
  ];
}

function createEmptyMapInput() {
  return {
    title: "",
    phases: [],
    forces: [],
    actions: [],
    areas: [],
    notes: []
  };
}

function applyStateToUi() {
  $("#projectName").value = state.project.name;
  $("#projectDirection").value = state.project.direction;
  $("#scenarioText").value = state.scenarioText || sampleScenario;
  $("#kbSearch").value = "";
  renderWorkflowTabs(selectWorkflow);
  if (!Object.keys(state.analysis).length) {
    parseScenario();
  }
  renderAnalysis();
  renderKnowledge();
  renderWorkflowRuns();
  renderSelectedWorkflow();
  renderWorkflowOutput();
  renderProjectOverview();
  renderScenarioGuide();
  renderAiMode();
}

function renderSnapshotPreview(summary, diffs, hasChanges) {
  const preview = $("#snapshotPreview");
  const body = $("#snapshotPreviewBody");
  if (!preview || !body) {
    return;
  }

  body.innerHTML = `
    <strong>待导入：${escapeInline(summary.projectName)}</strong>
    <p>${escapeInline(summary.direction)}</p>
    <dl>
      <dt>工作流</dt><dd>${escapeInline(summary.workflowTitle)} · ${summary.currentWorkflowRunCount} 次</dd>
      <dt>记录</dt><dd>${summary.runCount} 条运行记录</dd>
      <dt>资料</dt><dd>${summary.knowledgeCount} 个知识片段</dd>
      <dt>想定</dt><dd>${summary.scenarioLength} 字</dd>
      <dt>保存</dt><dd>${summary.savedAt ? formatShortTime(summary.savedAt) : "未知"}</dd>
    </dl>
    <div class="snapshot-diff">
      <strong>导入影响</strong>
      ${hasChanges ? "" : '<p class="snapshot-preview-note">快照与当前工作台一致，无需导入。</p>'}
      ${diffs.map(renderDiffItem).join("")}
    </div>
  `;
  const applyButton = $("#applySnapshotBtn");
  if (applyButton) {
    applyButton.disabled = !hasChanges;
  }
  preview.classList.remove("hidden");
  state.persistence.error = "";
  renderPersistenceStatus();
}

function renderDiffItem(item) {
  const className = item.changed ? "changed" : "same";
  const value = item.changed
    ? `${escapeInline(item.current)} -> ${escapeInline(item.incoming)}`
    : `${escapeInline(item.current)}（不变）`;
  return `
    <div class="snapshot-diff-item ${className}">
      <span>${escapeInline(item.label)}</span>
      <b>${value}</b>
    </div>
  `;
}

function clearSnapshotPreview() {
  state.pendingSnapshot = null;
  state.pendingSnapshotHasChanges = false;
  const applyButton = $("#applySnapshotBtn");
  if (applyButton) {
    applyButton.disabled = false;
  }
  const preview = $("#snapshotPreview");
  if (preview) {
    preview.classList.add("hidden");
  }
}

function showSnapshotUndo() {
  const undo = $("#snapshotUndo");
  if (undo) {
    undo.classList.remove("hidden");
  }
}

function hideSnapshotUndo() {
  const undo = $("#snapshotUndo");
  if (undo) {
    undo.classList.add("hidden");
  }
}

function saveWorkbench() {
  persistWorkbench();
  renderPersistenceStatus();
}

function renderPersistenceStatus() {
  const status = $("#persistenceStatus");
  if (!status) {
    return;
  }

  if (state.persistence.error) {
    status.textContent = state.persistence.error;
    status.classList.add("warning");
    return;
  }

  status.classList.remove("warning");
  if (state.persistence.loaded && state.persistence.savedAt) {
    status.textContent = `已从本地恢复 · ${formatShortTime(state.persistence.savedAt)}`;
    return;
  }

  if (state.persistence.savedAt) {
    status.textContent = `已自动保存 · ${formatShortTime(state.persistence.savedAt)}`;
    return;
  }

  status.textContent = "本地自动保存";
}

function formatShortTime(value) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeInline(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", init);
