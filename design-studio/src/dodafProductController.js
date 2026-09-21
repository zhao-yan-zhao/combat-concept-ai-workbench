import {
  DODAF_PRODUCT_KEYS,
  resolveDodafProduct,
  saveLocalDodafProduct,
  seedDodafProduct,
  updateProductField
} from "./dodafProductStore.js";
import { createProjectModelSyncController } from "./projectModelSyncController.js";
import { mergeProductsIntoArchitecture } from "../../shared/dodaf/architectureWriteback.js";
import { applyOv5aToOv5b, applyOv5bToOv5a, setOv5aParent, syncOv5ActivityPair } from "../../shared/dodaf/ov5ActivitySync.js";
import { persistOv5Model } from "./ov5Store.js";
import { compactForceMissionForAnalysis } from "../../shared/conceptPlanning.js";
import { applyOrganizationRelationshipDraft, buildOv4ForceFingerprint } from "./ov4Builder.js";
import { OV4_ECHELON_CATEGORIES, OV4_ORGANIZATION_CATEGORIES, OV4_RELATION_CATEGORIES } from "../../shared/dodaf/ov4Taxonomy.js";
import {
  exportProjectArchitecture,
  importProjectArchitecture,
  loadProjectArchitecture,
  loadProjectOv1b,
  loadProjectOv1c,
  loadProjectOv2,
  loadProjectOv3,
  loadProjectOv4,
  loadProjectOv5a,
  loadProjectOv6a,
  loadProjectOv6b,
  loadProjectOv6c,
  loadProjectOv7,
  saveProjectArchitecture,
  saveProjectOv1b,
  saveProjectOv1c,
  saveProjectOv2,
  saveProjectOv3,
  saveProjectOv4,
  saveProjectOv5a,
  saveProjectOv6a,
  saveProjectOv6b,
  saveProjectOv6c,
  saveProjectOv7
} from "./projectBriefClient.js";
import {
  addOv6aRule,
  addOv6bState,
  addOv6bDecisionBranch,
  addOv6bStateMachine,
  addOv6bTransition,
  addOv6cMessage,
  addOv6cParticipant,
  addOv6cSequence,
  duplicateOv6cMessage,
  listForceAndPhaseSubjects,
  listStateMachineSubjects,
  clearOv6aRules,
  clearOv6bStateMachines,
  clearOv6cSequences,
  removeOv6aRule,
  removeOv6bState,
  removeOv6bStateMachine,
  removeOv6bTransition,
  moveOv6cMessage,
  removeOv6cMessage,
  removeOv6cParticipant,
  removeOv6cSequence,
  replaceOv6cSequenceContent,
  reverseOv6cMessage,
  seedOv6bFromSubjects,
  seedOv6cFromPhase,
  setOv6aBindingStatus,
  setOv6aObjectBindingStatus,
  toggleOv6aActivityBinding,
  toggleOv6aObjectBinding,
  updateOv6bState,
  updateOv6bStateMachine,
  updateOv6bTransition,
  updateOv6cMessage,
  updateOv6cParticipant,
  updateOv6cSequence
} from "./ov6Workbench.js";
import {
  mergeParsedSequence,
  parseSequenceDsl,
  resolveSequenceDiagramEngine
} from "./sequenceDiagramDsl.js";
import { applyRuleChangeSet, ignoreRuleChangeSet } from "./ruleLibraryChatController.js";
import {
  addOv4Diagram,
  removeOv4Diagram,
  toggleOv4DiagramRelation,
  toggleOv4DiagramRole,
  updateOv4Diagram,
  updateOv4RelationClassification,
  updateOv4RoleClassification
} from "./ov4DiagramStore.js";
import { generateWithAiStream, isAiOutput } from "../../shared/aiClient.js";
import { generateMockOutput } from "../../shared/generator.js";
import { normalizeDodafOv1b, normalizeDodafOv4, normalizeDodafOv6b, normalizeDodafOv6c } from "../../shared/dodaf/products.js";
import { applySequenceDraft } from "./sequenceChatController.js";
import { addOv1bTaskGroup, removeOv1bTaskGroup, updateOv1bTaskGroup } from "./ov1bStore.js";
import { buildOv1cModel, buildOv7Model, updateMappingProduct } from "./mappingProductStore.js";

const LOADERS = {
  ov1b: loadProjectOv1b,
  ov1c: loadProjectOv1c,
  ov2: loadProjectOv2, ov3: loadProjectOv3, ov4: loadProjectOv4, ov5a: loadProjectOv5a,
  ov6a: loadProjectOv6a, ov6b: loadProjectOv6b, ov6c: loadProjectOv6c, ov7: loadProjectOv7
};
const SAVERS = {
  ov1b: saveProjectOv1b,
  ov1c: saveProjectOv1c,
  ov2: saveProjectOv2, ov3: saveProjectOv3, ov4: saveProjectOv4, ov5a: saveProjectOv5a,
  ov6a: saveProjectOv6a, ov6b: saveProjectOv6b, ov6c: saveProjectOv6c, ov7: saveProjectOv7
};
const LABELS = {
  ov1b: "任务整理 OV1b",
  ov1c: "任务与作战活动映射 OV1c",
  ov2: "作战资源流描述", ov3: "作战资源流矩阵", ov4: "作战组织关系图", ov5a: "作战活动分解",
  ov6a: "规则库", ov6b: "状态机校验", ov6c: "时序校验", ov7: "状态与活动映射 OV7"
};

const TASK_DECOMPOSITION_FINGERPRINT_PREFIX = "task-input:";

export function buildTaskDecompositionFingerprint(tasks = []) {
  const input = (Array.isArray(tasks) ? tasks : [])
    .map((task) => ({
      id: String(task?.id || ""),
      name: String(task?.name || ""),
      side: String(task?.side || ""),
      missionType: String(task?.missionType || ""),
      objective: String(task?.objective || ""),
      expectedEffect: String(task?.expectedEffect || "")
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const text = JSON.stringify(input);
  let hashA = 2166136261;
  let hashB = 2246822507;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    hashA = Math.imul(hashA ^ code, 16777619);
    hashB = Math.imul(hashB ^ code, 3266489917);
  }
  return `${TASK_DECOMPOSITION_FINGERPRINT_PREFIX}${(hashA >>> 0).toString(16).padStart(8, "0")}${(hashB >>> 0).toString(16).padStart(8, "0")}`;
}

export function mergeTaskDecompositionDraft(currentItems = [], generatedItems = []) {
  const preserved = (Array.isArray(currentItems) ? currentItems : []).filter((item) => (
    item?.status !== "pending_review" || !String(item?.id || "").startsWith("task-organization-ai-")
  ));
  const signatures = new Set(preserved.map((item) => [...(item.taskRefs || [])].sort().join("|")));
  return [...preserved, ...(Array.isArray(generatedItems) ? generatedItems : []).filter((item) => {
    const signature = [...(item.taskRefs || [])].sort().join("|");
    if (!signature || signatures.has(signature)) return false;
    signatures.add(signature);
    return true;
  })];
}

export function buildOrganizationRelationshipAnalysis(state = {}) {
  const forceMission = compactForceMissionForAnalysis(state.forceMission);
  const brief = state.brief || {};
  return {
    brief: {
      研究意图: brief.researchIntent || "",
      任务目标: brief.objective || "",
      核心思路: brief.approach || "",
      预期效果: brief.expectedEffects || "",
      主要风险: brief.risk || ""
    },
    phaseAction: {
      status: state.phaseAction?.status || "empty",
      phases: (Array.isArray(state.phaseAction?.phases) ? state.phaseAction.phases : []).slice(0, 12).map((phase) => ({
        id: phase?.id || "",
        name: phase?.name || "",
        objective: phase?.objective || "",
        blueActions: (phase?.blueActions || phase?.primaryActions || []).slice(0, 6),
        redActions: (phase?.redActions || phase?.secondaryActions || []).slice(0, 6)
      }))
    },
    forces: forceMission.forces,
    combatForces: forceMission.combatForces,
    existingRelations: forceMission.relations,
    organizationCategories: OV4_ORGANIZATION_CATEGORIES,
    echelonCategories: OV4_ECHELON_CATEGORIES,
    relationCategories: OV4_RELATION_CATEGORIES,
    relationTypes: ["command", "support", "coordination", "information"]
  };
}

export function buildStateMachineGenerationAnalysis(state = {}) {
  const phases = Array.isArray(state.phaseAction?.phases) ? state.phaseAction.phases : [];
  const phaseNames = new Map(phases.map((phase, index) => [String(phase?.id || `phase-${index + 1}`), String(phase?.name || `阶段 ${index + 1}`)]));
  const compactActions = (value, fallback = []) => (Array.isArray(value) ? value : fallback).filter(Boolean).slice(0, 8);
  const stateMachineSubjects = listStateMachineSubjects(state).map((subject) => ({
    id: subject.id,
    name: subject.name,
    taskName: subject.taskName || "",
    subjectType: subject.subjectType,
    phaseId: subject.phaseId || "",
    phaseName: subject.phaseName || "",
    context: subject.context || "",
    role: subject.role || "",
    timeWindow: subject.timeWindow || "",
    blueActions: subject.blueActions || [],
    redActions: subject.redActions || [],
    entryConditions: subject.entryConditions || [],
    exitConditions: subject.exitConditions || [],
    expectedEffects: subject.expectedEffects || []
  }));
  return {
    stateMachineSubjects,
    phaseAction: {
      phases: phases.slice(0, 24).map((phase, index) => ({
        id: String(phase?.id || `phase-${index + 1}`),
        name: String(phase?.name || `阶段 ${index + 1}`),
        objective: String(phase?.objective || ""),
        timeWindow: String(phase?.timeWindow || phase?.timeRange || phase?.window || "").trim(),
        primaryActions: compactActions(phase?.primaryActions, phase?.blueActions),
        blueActions: compactActions(phase?.blueActions, phase?.primaryActions),
        redActions: compactActions(phase?.redActions, phase?.secondaryActions),
        entryConditions: (phase?.entryConditions || []).filter(Boolean).slice(0, 6),
        exitConditions: (phase?.exitConditions || []).filter(Boolean).slice(0, 6),
        expectedEffects: (phase?.expectedEffects || []).filter(Boolean).slice(0, 6)
      })),
      transitions: (Array.isArray(state.phaseAction?.transitions) ? state.phaseAction.transitions : []).slice(0, 32).map((item) => ({
        fromPhaseId: String(item?.fromPhaseId || ""),
        toPhaseId: String(item?.toPhaseId || ""),
        fromPhaseName: phaseNames.get(String(item?.fromPhaseId || "")) || "",
        toPhaseName: phaseNames.get(String(item?.toPhaseId || "")) || "",
        condition: String(item?.condition || ""),
        note: String(item?.note || "")
      }))
    },
    rules: (Array.isArray(state.ov6a?.rules) ? state.ov6a.rules : []).slice(0, 80).map((rule) => ({
      id: String(rule?.id || ""),
      name: String(rule?.name || ""),
      type: String(rule?.type || ""),
      description: String(rule?.description || "")
    })),
    generationRequest: "为阶段行动中的关键行动、独立任务和持续运行对象生成可编辑状态机草案；来自阶段行动的候选标为阶段机。阶段时窗与红方行动只作转换/异常上下文，不另建机。",
    modelingInstructions: "输出 StateMachineDraft JSON：stateMachines[] 每项对应一个 stateMachineSubjects[].id，subjectRef 和 subjectType 必须原样匹配候选。来自阶段行动的候选 subjectType=phase。不要再为阶段容器或红方行动额外建机。阶段 timeWindow、blueActions、redActions 用于进入/退出条件和对抗分支。每台生成 initial、至少两个有具体作战语义且互不重复的 normal/decision 中间状态、final，共 4 至 7 个节点；禁止仅用‘进行中/处理中/中间状态’占位。状态表示对象所处情形，condition 表示触发状态变化的可观察事件或门槛。主路径必须从 initial 连通至 final；确需分支时使用 decision，并给出 decisionExpression，判定出边给出不重复的 branchResult。ruleRefs 仅可引用 analysis.rules 中的 id。只给研究级、可复核内容。"
  };
}

export function buildSequenceGenerationAnalysis(state = {}) {
  const phases = Array.isArray(state.phaseAction?.phases) ? state.phaseAction.phases : [];
  const forces = [
    ...(Array.isArray(state.forceMission?.forces) ? state.forceMission.forces : []),
    ...(Array.isArray(state.forceMission?.combatForces) ? state.forceMission.combatForces : [])
  ];
  const sideRequirements = [
    { id: "friendly", label: "蓝方", actionKeys: ["blueActions", "primaryActions"] },
    { id: "hostile", label: "红方", actionKeys: ["redActions", "secondaryActions"] }
  ].filter((side) => forces.some((force) => force?.side === side.id)
    || phases.some((phase) => side.actionKeys.some((key) => (phase?.[key] || []).length)));
  return {
    briefObjective: String(state.brief?.objective || "").slice(0, 400),
    phases: phases.slice(0, 24).map((phase, index) => ({
      id: String(phase?.id || `phase-${index + 1}`),
      name: String(phase?.name || `阶段 ${index + 1}`),
      objective: String(phase?.objective || ""),
      timeWindow: String(phase?.timeWindow || phase?.timeRange || ""),
      blueActions: (phase?.blueActions || phase?.primaryActions || []).filter(Boolean).slice(0, 8),
      redActions: (phase?.redActions || phase?.secondaryActions || []).filter(Boolean).slice(0, 8),
      entryConditions: (phase?.entryConditions || []).filter(Boolean).slice(0, 6),
      exitConditions: (phase?.exitConditions || []).filter(Boolean).slice(0, 6)
    })),
    forces: forces.slice(0, 48).map((force, index) => ({
      id: String(force?.id || `force-${index + 1}`),
      name: String(force?.name || force?.title || `兵力 ${index + 1}`),
      side: force?.side === "hostile" ? "hostile" : force?.side === "neutral" ? "neutral" : "friendly",
      role: String(force?.role || ""),
      task: String(force?.task || ""),
      phaseIds: (force?.phaseIds || []).map(String).slice(0, 12)
    })),
    stateMachines: (state.ov6b?.stateMachines || []).slice(0, 48).map((machine) => ({
      id: machine.id,
      subjectRef: machine.subjectRef,
      subjectType: machine.subjectType,
      name: machine.name,
      states: (machine.states || []).slice(0, 12).map((item) => ({ id: item.id, name: item.name, kind: item.kind })),
      transitions: (machine.transitions || []).slice(0, 20).map((item) => ({
        id: item.id,
        fromStateRef: item.fromStateRef,
        toStateRef: item.toStateRef,
        condition: item.condition,
        branchResult: item.branchResult
      }))
    })),
    tasks: (state.forceMission?.tasks || []).slice(0, 80).map((task) => ({ id: String(task.id || ""), name: String(task.name || ""), side: task.side === "hostile" ? "hostile" : "friendly", objective: String(task.objective || ""), expectedEffect: String(task.expectedEffect || "") })),
    requiredSequenceCoverage: {
      sideSequences: sideRequirements.map(({ id, label }) => ({ side: id, label, diagramType: "force" })),
      phaseSequences: phases.slice(0, 24).map((phase, index) => ({
        phaseId: String(phase?.id || `phase-${index + 1}`),
        phaseName: String(phase?.name || `阶段 ${index + 1}`),
        diagramType: "phase"
      }))
    },
    mutationRequest: true,
    generationReason: "从状态机点击下一步，自动生成各推演方及逐阶段时序图"
  };
}

export function ensureRequiredSequenceCoverage(model = {}, state = {}, analysis = buildSequenceGenerationAnalysis(state)) {
  const next = normalizeDodafOv6c(model);
  const baseline = seedOv6cFromPhase({ sequences: [] }, state);
  const forceSideById = new Map((analysis.forces || []).map((force) => [String(force.id), force.side]));
  const hasPhaseSequence = (phaseId) => (next.sequences || []).some((sequence) => (
    sequence.diagramType === "phase"
    && ((sequence.participants || []).some((item) => item.refType === "phase" && item.ref === phaseId)
      || (sequence.messages || []).some((item) => (item.relatedActivityRefs || []).includes(phaseId)))
  ));
  const hasSideSequence = (side, label) => (next.sequences || []).some((sequence) => {
    if (sequence.diagramType !== "force") return false;
    const participantSides = (sequence.participants || [])
      .map((item) => item.refType === "force" ? forceSideById.get(String(item.ref || "")) : "")
      .filter(Boolean);
    return participantSides.includes(side) || String(sequence.name || "").includes(label);
  });
  const additions = [];
  (analysis.requiredSequenceCoverage?.sideSequences || []).forEach(({ side, label }) => {
    if (hasSideSequence(side, label)) return;
    const fallback = (baseline.sequences || []).find((sequence) => sequence.id === `sequence-side-${side}`);
    if (fallback) additions.push(fallback);
  });
  (analysis.requiredSequenceCoverage?.phaseSequences || []).forEach(({ phaseId }) => {
    if (hasPhaseSequence(phaseId)) return;
    const fallback = (baseline.sequences || []).find((sequence) => sequence.id === `sequence-phase-${phaseId}`);
    if (fallback) additions.push(fallback);
  });
  return normalizeDodafOv6c({ ...next, sequences: [...(next.sequences || []), ...additions] });
}

export function ensureTaskSequenceCoverage(model = {}, analysis = {}) {
  const next = normalizeDodafOv6c(model);
  const additions = [];
  for (const task of analysis.tasks || []) {
    const exists = (next.sequences || []).some((sequence) => sequence.diagramType === "task" && ((sequence.participants || []).some((item) => item.refType === "task" && item.ref === task.id) || (sequence.messages || []).some((item) => (item.relatedActivityRefs || []).includes(task.id))));
    if (exists) continue;
    const machine = (analysis.stateMachines || []).find((item) => item.subjectType === "task" && item.subjectRef === task.id);
    const participants = [{ id: `task-${task.id}`, name: task.name || task.id, ref: task.id, refType: "task" }, { id: `context-${task.id}`, name: "任务条件与效果", ref: "", refType: "" }];
    const steps = (machine?.transitions || []).slice(0, 12);
    additions.push({ id: `sequence-task-${task.id}`, name: `${task.name || task.id}时序`, diagramType: "task", participants, messages: (steps.length ? steps : [{ condition: task.objective || "任务启动" }, { condition: task.expectedEffect || "效果确认" }]).map((step, index) => ({ id: `task-message-${task.id}-${index + 1}`, sequence: index + 1, fromRef: index % 2 ? participants[1].id : participants[0].id, toRef: index % 2 ? participants[0].id : participants[1].id, name: step.condition || `任务事件 ${index + 1}`, type: index % 2 ? "status" : "message", condition: step.condition || "", relatedActivityRefs: [task.id] })), fragments: [] });
  }
  return normalizeDodafOv6c({ ...next, sequences: [...(next.sequences || []), ...additions] });
}
export function applyStateMachineDraft(draft = {}, analysis = {}) {
  const candidates = Array.isArray(analysis?.stateMachineSubjects) && analysis.stateMachineSubjects.length
    ? analysis.stateMachineSubjects
    : (Array.isArray(analysis?.phaseAction?.phases) ? analysis.phaseAction.phases.map((phase) => ({ ...phase, subjectType: "phase" })) : []);
  const rules = Array.isArray(analysis?.rules) ? analysis.rules : [];
  const validRuleIds = new Set(rules.map((rule) => rule.id).filter(Boolean));
  const rawMachines = Array.isArray(draft?.stateMachines) ? draft.stateMachines : [];
  const machines = candidates.map((candidate, index) => {
    const subjectRef = String(candidate?.id || `subject-${index + 1}`);
    const raw = rawMachines.find((item) => String(item?.subjectRef || "") === subjectRef) || rawMachines[index] || {};
    const machineId = `subject-${safeId(subjectRef)}-machine`;
    const rawStates = Array.isArray(raw?.states) ? raw.states.slice(0, 12) : [];
    const window = String(candidate?.timeWindow || "").trim();
    const redPressure = (Array.isArray(candidate?.redActions) ? candidate.redActions : []).filter(Boolean)[0] || "";
    const actionNames = [...new Set([
      candidate?.taskName,
      ...(Array.isArray(candidate?.blueActions) ? candidate.blueActions : []),
      candidate?.context
    ].map((item) => String(item || "").trim()).filter(Boolean))];
    const primaryAction = actionNames[0] || candidate?.name || "任务";
    const secondaryAction = actionNames.find((item) => item !== primaryAction) || "协同条件";
    const expectedEffect = String(candidate?.expectedEffects?.[0] || "预期效果").trim();
    const fallbackStates = [
      { name: "开始", kind: "initial" },
      { name: `${String(primaryAction).slice(0, 36)}准备就绪`, kind: "normal" },
      { name: `${String(secondaryAction).slice(0, 36)}执行中`, kind: "normal" },
      { name: `${expectedEffect.slice(0, 36)}待确认`, kind: "normal" },
      { name: "结束", kind: "final" }
    ];
    const meaningfulMiddle = rawStates.filter((item) => !["initial", "final"].includes(item?.kind))
      .filter((item) => !/^(进行中|执行中|处理中|中间状态|状态\s*\d*)$/i.test(String(item?.name || "").trim()));
    const useRawLifecycle = rawStates.length >= 4 && meaningfulMiddle.length >= 2;
    const sourceStates = useRawLifecycle ? rawStates : fallbackStates;
    const states = sourceStates.map((item, stateIndex) => ({
      id: `${machineId}-state-${stateIndex + 1}`,
      name: String(item?.name || fallbackStates[stateIndex]?.name || `状态 ${stateIndex + 1}`).slice(0, 120),
      kind: ["initial", "normal", "decision", "final"].includes(item?.kind) ? item.kind : "normal",
      decisionExpression: item?.kind === "decision" ? String(item?.decisionExpression || "").slice(0, 1000) : "",
      x: item?.x,
      y: item?.y
    }));
    if (!states.some((item) => item.kind === "initial")) states[0].kind = "initial";
    if (!states.some((item) => item.kind === "final")) states[states.length - 1].kind = "final";
    states.forEach((item, stateIndex) => {
      if (stateIndex > 0 && stateIndex < states.length - 1 && (item.kind === "initial" || item.kind === "final")) item.kind = "normal";
    });
    const rawTransitions = useRawLifecycle && Array.isArray(raw?.transitions) ? raw.transitions : [];
    const transitions = rawTransitions.length
      ? rawTransitions.map((item, transitionIndex) => ({
        id: `${machineId}-transition-${transitionIndex + 1}`,
        fromStateRef: states[Math.max(0, sourceStates.findIndex((state) => state?.id === item?.fromStateRef))]?.id || states[transitionIndex]?.id,
        toStateRef: states[Math.max(0, sourceStates.findIndex((state) => state?.id === item?.toStateRef))]?.id || states[transitionIndex + 1]?.id || states.at(-1)?.id,
        condition: String(item?.condition || "满足下一状态进入门槛").slice(0, 4000),
        branchResult: String(item?.branchResult || "").slice(0, 400),
        ruleRefs: (Array.isArray(item?.ruleRefs) ? item.ruleRefs : []).filter((id) => validRuleIds.has(id)).slice(0, 24),
        eventRefs: []
      })).filter((item) => item.fromStateRef && item.toStateRef && item.fromStateRef !== item.toStateRef)
      : states.slice(0, -1).map((item, stateIndex) => ({
        id: `${machineId}-transition-${stateIndex + 1}`,
        fromStateRef: item.id,
        toStateRef: states[stateIndex + 1].id,
        condition: String(
          stateIndex === 0
            ? (candidate?.entryConditions?.[0] || (window ? `进入时窗 ${window}` : `${primaryAction}启动条件满足`))
            : stateIndex === 1
              ? `${primaryAction}准备完成且执行条件具备`
              : stateIndex === 2
                ? (candidate?.expectedEffects?.[0] || (redPressure ? `在${redPressure}压力下完成行动` : `${secondaryAction}完成`))
                : (candidate?.exitConditions?.[0] || `${expectedEffect}经观察确认`)
        ).slice(0, 4000),
        branchResult: "",
        ruleRefs: rules.slice(0, 2).map((rule) => rule.id).filter(Boolean),
        eventRefs: []
      }));
    return {
      id: machineId,
      subjectRef,
      subjectType: candidate?.subjectType || "phase",
      name: String(raw?.name || `${candidate?.name || `建模对象 ${index + 1}`}状态机`).slice(0, 240),
      states,
      transitions
    };
  });
  return normalizeDodafOv6b({
    stateMachines: machines,
    derivedFrom: { mode: "ai", sources: ["phaseAction", "forceMission", "ov6a"], generatedAt: new Date().toISOString(), note: "关键任务与持续对象状态机分析" }
  });
}

function safeId(value) {
  return String(value || "state").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "state";
}

function openStateMachineEditor(state) {
  state.ov6bToolsOpen = true;
  state.ov6bEditorOpen = true;
  state.stateMachineChatOpen = false;
}

export function createDodafProductController({
  projectId,
  getState,
  render,
  notify,
  downloadArtifact,
  syncOv5 = null,
  projectTitle = () => "Operational Architecture",
  onSaved = null
}) {
  const syncControllers = Object.fromEntries(DODAF_PRODUCT_KEYS.map((resource) => {
    const applyRemote = (remote, { force = false } = {}) => {
      const state = getState();
      if (!remote?.model || remote.stale) return false;
      if (!force && state[`${resource}Storage`]?.localSaved && state[resource]) return false;
      if (force && state[resource] && !window.confirm(`服务端 ${LABELS[resource]} 修订 r${remote.revision} 将覆盖当前产品。是否继续？`)) return false;
      state[resource] = saveLocalDodafProduct(resource, remote.model, projectId);
      return true;
    };
    return [resource, createProjectModelSyncController({
      projectId,
      resource,
      storageKey: `${resource}Storage`,
      resourceLabel: LABELS[resource],
      load: LOADERS[resource],
      save: SAVERS[resource],
      getState,
      render,
      notify,
      applyRemote,
      onSaved,
      conflictRecovery: {
        capture: () => getState()[resource],
        restore: (model) => {
          getState()[resource] = saveLocalDodafProduct(resource, model, projectId);
        }
      }
    })];
  }));

  let fileInput = null;

  function persistOv6(resource, model, toast = "") {
    const state = getState();
    state[resource] = saveLocalDodafProduct(resource, model, projectId);
    void syncControllers[resource].sync(state[resource], { source: "manual-edit" }).then(() => writebackArchitecture("manual-edit"));
    if (toast) notify(toast);
    render();
  }

  function handleOv6WorkbenchAction(action, el) {
    const state = getState();
    const ds = el?.dataset || {};

    if (action === "ov1b-select-group") {
      const groupId = ds.groupId || "";
      if (state.ov1bSelectedGroupId === groupId) return true;
      state.ov1bSelectedGroupId = groupId;
      render();
      return true;
    }

    if (action === "ov1b-add-group") {
      const model = resolveDodafProduct(state, "ov1b").model;
      const next = addOv1bTaskGroup(model);
      state.ov1bSelectedGroupId = next.taskGroups.at(-1)?.id || "";
      persistOv6("ov1b", next, "已新增任务组");
      return true;
    }
    if (action === "ov1b-toggle-group-confirm") {
      const model = resolveDodafProduct(state, "ov1b").model;
      const item = (model.taskGroups || []).find((entry) => entry.id === ds.groupId);
      if (!item) return true;
      const status = item.status === "confirmed" ? "pending_review" : "confirmed";
      persistOv6("ov1b", updateOv1bTaskGroup(model, item.id, { status }), status === "confirmed" ? "已确认任务组" : "已撤回确认");
      return true;
    }
    if (action === "ov1b-review-current") {
      const model = resolveDodafProduct(state, "ov1b").model;
      const item = (model.taskGroups || []).find((entry) => entry.id === state.ov1bSelectedGroupId) || model.taskGroups?.[0];
      if (!item) { notify("请先选择任务组"); return true; }
      const status = item.status === "confirmed" ? "pending_review" : "confirmed";
      persistOv6("ov1b", updateOv1bTaskGroup(model, item.id, { status }), status === "confirmed" ? "已确认当前任务组" : "已撤回当前任务组确认");
      return true;
    }
    if (action === "ov1b-remove-group") {
      if (!ds.groupId || !window.confirm("删除该任务组？现有任务不会被删除。")) return true;
      const model = resolveDodafProduct(state, "ov1b").model;
      const next = removeOv1bTaskGroup(model, ds.groupId);
      state.ov1bSelectedGroupId = next.taskGroups[0]?.id || "";
      persistOv6("ov1b", next, "已删除任务组");
      return true;
    }
    if (action === "ov1b-toggle-task") {
      const model = resolveDodafProduct(state, "ov1b").model;
      const item = (model.taskGroups || []).find((entry) => entry.id === ds.groupId);
      if (!item) return true;
      const taskRefs = [...(item.taskRefs || [])];
      const index = taskRefs.indexOf(el.value);
      if (el.checked && index < 0) taskRefs.push(el.value);
      if (!el.checked && index >= 0) taskRefs.splice(index, 1);
      persistOv6("ov1b", updateOv1bTaskGroup(model, item.id, { taskRefs }));
      return true;
    }
    if (action === "ov1b-move-task") {
      const model = resolveDodafProduct(state, "ov1b").model;
      const item = (model.taskGroups || []).find((entry) => entry.id === ds.groupId);
      if (!item) return true;
      const taskRefs = [...(item.taskRefs || [])];
      const from = taskRefs.indexOf(ds.taskId);
      const to = Math.max(0, Math.min(taskRefs.length - 1, from + Number(ds.delta || 0)));
      if (from < 0 || from === to) return true;
      taskRefs.splice(to, 0, taskRefs.splice(from, 1)[0]);
      persistOv6("ov1b", updateOv1bTaskGroup(model, item.id, { taskRefs }));
      return true;
    }

    if (["mapping-toggle-activity", "mapping-set-semantic", "mapping-set-judgment"].includes(action)) {
      const resource = ds.resource;
      if (!["ov1c", "ov7"].includes(resource) || !ds.mappingId) return true;
      const current = resolveDodafProduct(state, resource).model;
      const mapping = (current.mappings || []).find((item) => item.id === ds.mappingId);
      if (!mapping) return true;
      let patch = {};
      if (action === "mapping-toggle-activity") {
        const refs = new Set(mapping.activityRefs || []);
        if (el.checked) refs.add(el.value); else refs.delete(el.value);
        patch = { activityRefs: [...refs] };
      } else if (action === "mapping-set-semantic") {
        patch = { semantic: el.value };
      } else {
        patch = { judgment: el.value };
      }
      const updated = updateMappingProduct(current, resource, mapping.id, patch);
      const refreshed = resource === "ov1c" ? buildOv1cModel({ ...state, ov1c: updated }) : buildOv7Model({ ...state, ov7: updated });
      persistOv6(resource, refreshed, action === "mapping-set-judgment" ? "已更新人工映射判定" : "已更新映射关系");
      return true;
    }

    if (action === "toggle-ov4-tools") {
      state.ov4ToolsOpen = !state.ov4ToolsOpen;
      if (!state.ov4ToolsOpen) state.ov4EditorOpen = false;
      render();
      return true;
    }
    if (action === "ov4-toggle-editor") {
      state.ov4EditorOpen = !state.ov4EditorOpen;
      render();
      return true;
    }
    if (action === "ov4-close-editor") {
      state.ov4EditorOpen = false;
      render();
      return true;
    }
    if (action === "ov4-select-diagram") {
      const diagramId = ds.diagramId || "";
      if (state.ov4SelectedDiagramId === diagramId) return true;
      state.ov4SelectedDiagramId = diagramId;
      render();
      return true;
    }
    if (action === "ov4-add-diagram") {
      const next = addOv4Diagram(resolveDodafProduct(state, "ov4").model);
      state.ov4SelectedDiagramId = next.diagrams?.at(-1)?.id || "";
      state.ov4ToolsOpen = true;
      state.ov4EditorOpen = true;
      persistOv6("ov4", next, "已新增组织关系图");
      return true;
    }
    if (action === "ov4-remove-diagram") {
      if (!ds.diagramId || !window.confirm("删除当前组织关系图？共享角色和关系不会被删除。")) return true;
      const next = removeOv4Diagram(resolveDodafProduct(state, "ov4").model, ds.diagramId);
      state.ov4SelectedDiagramId = next.diagrams?.[0]?.id || "";
      persistOv6("ov4", next, "已删除组织关系图");
      return true;
    }
    if (action === "ov4-diagram-field") {
      if (!ds.diagramId || !["name", "description"].includes(ds.field)) return true;
      persistOv6("ov4", updateOv4Diagram(resolveDodafProduct(state, "ov4").model, ds.diagramId, { [ds.field]: el?.value || "" }));
      return true;
    }
    if (action === "ov4-toggle-diagram-role") {
      persistOv6("ov4", toggleOv4DiagramRole(resolveDodafProduct(state, "ov4").model, ds.diagramId, ds.roleId, Boolean(el?.checked)));
      return true;
    }
    if (action === "ov4-toggle-diagram-relation") {
      persistOv6("ov4", toggleOv4DiagramRelation(resolveDodafProduct(state, "ov4").model, ds.diagramId, ds.relationId, Boolean(el?.checked)));
      return true;
    }
    if (action === "ov4-role-classification") {
      if (!ds.roleId || !["organizationCategory", "echelonCategory"].includes(ds.field)) return true;
      persistOv6("ov4", updateOv4RoleClassification(resolveDodafProduct(state, "ov4").model, ds.roleId, { [ds.field]: el?.value || "" }));
      return true;
    }
    if (action === "ov4-relation-classification") {
      if (!ds.relationId || ds.field !== "relationshipCategory") return true;
      persistOv6("ov4", updateOv4RelationClassification(resolveDodafProduct(state, "ov4").model, ds.relationId, { relationshipCategory: el?.value || "" }));
      return true;
    }

    if (action === "ov6a-add-rule") {
      const model = resolveDodafProduct(state, "ov6a").model;
      const next = addOv6aRule(model);
      if (next._createdRuleId) state.ov6aSelectedRuleId = next._createdRuleId;
      persistOv6("ov6a", next, "已新增规则（可先不绑活动）");
      return true;
    }
    if (action === "ov6a-select-rule") {
      if (!ds.ruleId) return true;
      state.ov6aSelectedRuleId = ds.ruleId;
      render();
      return true;
    }
    if (action === "ov6a-set-filter") {
      state.ov6aRuleFilter = ds.filter || "all";
      render();
      return true;
    }
    if (action === "ov6a-delete-rule") {
      if (!ds.ruleId || !window.confirm("删除该规则及其活动绑定？")) return true;
      const model = resolveDodafProduct(state, "ov6a").model;
      const next = removeOv6aRule(model, ds.ruleId);
      if (state.ov6aSelectedRuleId === ds.ruleId) state.ov6aSelectedRuleId = next.rules?.[0]?.id || "";
      persistOv6("ov6a", next, "已删除规则");
      return true;
    }
    if (action === "ov6a-clear-all") {
      const model = resolveDodafProduct(state, "ov6a").model;
      const count = model.rules?.length || 0;
      if (!count || !window.confirm(`清空全部 ${count} 条规则？此操作不可撤销。`)) return true;
      state.ov6aSelectedRuleId = "";
      persistOv6("ov6a", clearOv6aRules(model), "已清空规则库");
      return true;
    }
    if (action === "ov6a-apply-change" || action === "ov6a-apply-all-changes") {
      const model = resolveDodafProduct(state, "ov6a").model;
      const next = applyRuleChangeSet(model, model.ruleChangeSet, action === "ov6a-apply-change" ? ds.changeId : "");
      persistOv6("ov6a", next, action === "ov6a-apply-change" ? "已采纳规则变更" : "已采纳全部待审核规则变更");
      return true;
    }
    if (action === "ov6a-ignore-change") {
      const model = resolveDodafProduct(state, "ov6a").model;
      persistOv6("ov6a", ignoreRuleChangeSet(model, ds.changeId), "已忽略规则变更建议");
      return true;
    }
    if (action === "ov6a-toggle-binding") {
      const model = resolveDodafProduct(state, "ov6a").model;
      const checked = Boolean(el?.checked);
      if (ds.ruleId) state.ov6aSelectedRuleId = ds.ruleId;
      persistOv6("ov6a", toggleOv6aActivityBinding(model, ds.ruleId, ds.activityRef, {
        checked,
        status: "pending"
      }));
      return true;
    }
    if (action === "ov6a-set-binding-status") {
      const model = resolveDodafProduct(state, "ov6a").model;
      if (ds.ruleId) state.ov6aSelectedRuleId = ds.ruleId;
      persistOv6("ov6a", setOv6aBindingStatus(model, ds.ruleId, ds.activityRef, el?.value || "pending"));
      return true;
    }
    if (action === "ov6a-toggle-object-binding") {
      const model = resolveDodafProduct(state, "ov6a").model;
      if (ds.ruleId) state.ov6aSelectedRuleId = ds.ruleId;
      persistOv6("ov6a", toggleOv6aObjectBinding(model, ds.ruleId, ds.bindingType, ds.objectRef, {
        checked: Boolean(el?.checked),
        status: "pending"
      }));
      return true;
    }
    if (action === "ov6a-set-object-binding-status") {
      const model = resolveDodafProduct(state, "ov6a").model;
      if (ds.ruleId) state.ov6aSelectedRuleId = ds.ruleId;
      persistOv6("ov6a", setOv6aObjectBindingStatus(model, ds.ruleId, ds.bindingType, ds.objectRef, el?.value || "pending"));
      return true;
    }

    if (action === "toggle-ov6b-tools") {
      state.ov6bToolsOpen = !state.ov6bToolsOpen;
      if (!state.ov6bToolsOpen) {
        state.ov6bEditorOpen = false;
        state.stateMachineChatOpen = false;
      }
      render();
      return true;
    }
    if (action === "ov6b-toggle-editor") {
      state.ov6bToolsOpen = true;
      state.ov6bEditorOpen = !state.ov6bEditorOpen;
      if (state.ov6bEditorOpen) state.stateMachineChatOpen = false;
      render();
      return true;
    }
    if (action === "ov6b-close-editor") {
      state.ov6bEditorOpen = false;
      render();
      return true;
    }
    if (action === "ov6b-select-machine") {
      if (!ds.machineId) return true;
      // Avoid full re-render churn when re-clicking the already selected machine.
      if (state.ov6bSelectedMachineId === ds.machineId) return true;
      state.ov6bSelectedMachineId = ds.machineId;
      state.ov6bSelectedStateId = "";
      state.ov6bSelectedTransitionId = "";
      render();
      // Keep the clicked machine visible after list re-render (scroll preserve + nearest).
      requestAnimationFrame(() => {
        const selected = document.querySelector(`.sm-machine-item.is-selected[data-machine-id="${CSS.escape(ds.machineId)}"]`)
          || document.querySelector(`.sm-machine-item[data-machine-id="${CSS.escape(ds.machineId)}"]`);
        selected?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      });
      return true;
    }
    if (action === "ov6b-select-state") {
      if (ds.machineId) state.ov6bSelectedMachineId = ds.machineId;
      state.ov6bSelectedStateId = ds.stateId || "";
      openStateMachineEditor(state);
      render();
      return true;
    }
    if (action === "ov6b-focus-finding") {
      if (ds.machineId) state.ov6bSelectedMachineId = ds.machineId;
      state.ov6bSelectedStateId = ds.stateId || "";
      state.ov6bSelectedTransitionId = ds.transitionId || "";
      openStateMachineEditor(state);
      render();
      requestAnimationFrame(() => {
        const selector = ds.transitionId
          ? `.sm-transition-row[data-transition-id="${CSS.escape(ds.transitionId)}"]`
          : ds.stateId
            ? `.sm-state-row[data-state-id="${CSS.escape(ds.stateId)}"]`
            : ".sm-editor-actions";
        document.querySelector(selector)?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      });
      return true;
    }
    if (action === "ov6b-seed-subjects") {
      const model = resolveDodafProduct(state, "ov6b").model;
      const subjects = listStateMachineSubjects(state);
      const next = seedOv6bFromSubjects(model, subjects);
      const created = (next.stateMachines?.length || 0) - (model.stateMachines?.length || 0);
      if (created > 0) state.ov6bSelectedMachineId = next.stateMachines.at(-1)?.id || "";
      persistOv6("ov6b", next, created > 0 ? `已按主体新建 ${created} 台状态机` : "主体均已建机，未新增");
      return true;
    }
    if (action === "ov6b-add-machine") {
      const model = resolveDodafProduct(state, "ov6b").model;
      const picker = document.getElementById("ov6bSubjectPicker");
      const subjectRef = picker?.value || "";
      const subjectType = ds.subjectType || picker?.selectedOptions?.[0]?.dataset?.subjectType || "task";
      const name = picker?.selectedOptions?.[0]?.textContent?.split("（")[0]?.trim() || "";
      const next = addOv6bStateMachine(model, { subjectType, subjectRef, name });
      state.ov6bSelectedMachineId = next.stateMachines?.at(-1)?.id || "";
      state.ov6bSelectedStateId = "";
      persistOv6("ov6b", next, "已新建状态机");
      return true;
    }
    if (action === "ov6b-remove-machine") {
      const machineId = ds.machineId || state.ov6bSelectedMachineId;
      if (!machineId || !window.confirm("删除该状态机及其转换？")) return true;
      const model = resolveDodafProduct(state, "ov6b").model;
      const next = removeOv6bStateMachine(model, machineId);
      if (state.ov6bSelectedMachineId === machineId) {
        state.ov6bSelectedMachineId = next.stateMachines?.[0]?.id || "";
        state.ov6bSelectedStateId = "";
      }
      persistOv6("ov6b", next, "已删除状态机");
      return true;
    }
    if (action === "ov6b-clear-all") {
      const model = resolveDodafProduct(state, "ov6b").model;
      const count = model.stateMachines?.length || 0;
      if (!count || !window.confirm(`清空全部 ${count} 台状态机？此操作不可撤销。`)) return true;
      state.ov6bSelectedMachineId = "";
      state.ov6bSelectedStateId = "";
      state.ov6bSelectedTransitionId = "";
      state.ov6bEditorOpen = false;
      persistOv6("ov6b", clearOv6bStateMachines(model), "已清空状态机");
      return true;
    }
    if (action === "ov6b-add-transition") {
      const model = resolveDodafProduct(state, "ov6b").model;
      const machineId = ds.machineId || state.ov6bSelectedMachineId;
      const next = addOv6bTransition(model, machineId);
      state.ov6bSelectedTransitionId = next._createdTransitionId || "";
      state.ov6bSelectedStateId = "";
      openStateMachineEditor(state);
      persistOv6("ov6b", next, "已添加转换");
      return true;
    }
    if (action === "ov6b-add-decision-branch") {
      const row = el?.closest?.(".sm-decision-branch");
      const target = row?.querySelector?.('[data-branch-field="target"]')?.value || "";
      const result = row?.querySelector?.('[data-branch-field="result"]')?.value || "";
      const condition = row?.querySelector?.('[data-branch-field="condition"]')?.value || "";
      const model = resolveDodafProduct(state, "ov6b").model;
      const next = addOv6bDecisionBranch(model, ds.machineId, ds.stateId, {
        toStateRef: target,
        branchResult: result,
        condition
      });
      if (next._branchError) {
        notify(next._branchError);
        return true;
      }
      state.ov6bSelectedStateId = "";
      state.ov6bSelectedTransitionId = next._createdTransitionId || "";
      openStateMachineEditor(state);
      persistOv6("ov6b", next, `已添加“${result}”分支`);
      return true;
    }
    if (action === "ov6b-add-state") {
      const model = resolveDodafProduct(state, "ov6b").model;
      const machineId = ds.machineId || state.ov6bSelectedMachineId;
      const priorMachine = (model.stateMachines || []).find((item) => item.id === machineId);
      const priorIds = new Set((priorMachine?.states || []).map((item) => item.id));
      const next = addOv6bState(model, machineId, {
        kind: ds.kind || "normal",
        insertTransitionId: ds.kind === "decision" ? state.ov6bSelectedTransitionId : ""
      });
      const machine = (next.stateMachines || []).find((item) => item.id === machineId);
      const created = machine?.states?.find((item) => !priorIds.has(item.id));
      if (created) state.ov6bSelectedStateId = created.id;
      openStateMachineEditor(state);
      persistOv6("ov6b", next, "已添加状态");
      return true;
    }
    if (action === "ov6b-remove-state") {
      if (!ds.machineId || !ds.stateId || !window.confirm("删除该状态及其相关转换？")) return true;
      const model = resolveDodafProduct(state, "ov6b").model;
      if (state.ov6bSelectedStateId === ds.stateId) state.ov6bSelectedStateId = "";
      persistOv6("ov6b", removeOv6bState(model, ds.machineId, ds.stateId), "已删除状态");
      return true;
    }
    if (action === "ov6b-remove-transition") {
      if (!ds.machineId || !ds.transitionId) return true;
      const model = resolveDodafProduct(state, "ov6b").model;
      persistOv6("ov6b", removeOv6bTransition(model, ds.machineId, ds.transitionId), "已删除转换");
      return true;
    }
    if (action === "ov6b-machine-field") {
      const model = resolveDodafProduct(state, "ov6b").model;
      const field = ds.field;
      if (!field || !ds.machineId) return true;
      persistOv6("ov6b", updateOv6bStateMachine(model, ds.machineId, { [field]: el?.value || "" }));
      return true;
    }
    if (action === "ov6b-state-field") {
      const model = resolveDodafProduct(state, "ov6b").model;
      const field = ds.field;
      if (!field || !ds.machineId || !ds.stateId) return true;
      persistOv6("ov6b", updateOv6bState(model, ds.machineId, ds.stateId, { [field]: el?.value || "" }));
      return true;
    }
    if (action === "ov6b-transition-field") {
      const model = resolveDodafProduct(state, "ov6b").model;
      const field = ds.field;
      if (!field || !ds.machineId || !ds.transitionId) return true;
      const next = updateOv6bTransition(model, ds.machineId, ds.transitionId, { [field]: el?.value || "" });
      if (next._transitionError) {
        notify(next._transitionError);
        return true;
      }
      persistOv6("ov6b", next);
      return true;
    }

    if (action === "ov6c-select-sequence") {
      if (!ds.sequenceId) return true;
      if (state.ov6cSelectedSequenceId === ds.sequenceId) return true;
      state.ov6cSelectedSequenceId = ds.sequenceId;
      state.ov6cSelectedMessageId = "";
      state.ov6cConnectFromId = "";
      render();
      return true;
    }
    if (action === "ov6c-select-message") {
      if (ds.sequenceId) state.ov6cSelectedSequenceId = ds.sequenceId;
      state.ov6cSelectedMessageId = ds.messageId || "";
      state.ov6cConnectFromId = "";
      state.ov6cEditorOpen = true;
      state.ov6cToolsOpen = true;
      state.sequenceChatOpen = false;
      render();
      return true;
    }
    if (action === "ov6c-sequence-field") {
      if (!ds.sequenceId || !ds.field) return true;
      const model = resolveDodafProduct(state, "ov6c").model;
      persistOv6("ov6c", updateOv6cSequence(model, ds.sequenceId, { [ds.field]: el?.value || "" }));
      return true;
    }
    if (action === "toggle-ov6c-tools") {
      state.ov6cToolsOpen = !state.ov6cToolsOpen;
      if (!state.ov6cToolsOpen) {
        state.ov6cEditorOpen = false;
        state.sequenceChatOpen = false;
      }
      render();
      return true;
    }
    if (action === "ov6c-toggle-editor") {
      state.ov6cToolsOpen = true;
      state.ov6cEditorOpen = !state.ov6cEditorOpen;
      if (state.ov6cEditorOpen) state.sequenceChatOpen = false;
      render();
      return true;
    }
    if (action === "ov6c-open-editor") {
      state.ov6cToolsOpen = true;
      state.ov6cEditorOpen = true;
      state.sequenceChatOpen = false;
      render();
      return true;
    }
    if (action === "ov6c-close-editor") {
      state.ov6cEditorOpen = false;
      render();
      return true;
    }
    if (action === "ov6c-set-engine") {
      const engine = String(ds.engine || "workbench");
      state.ov6cDiagramEngine = ["mermaid", "js-sequence", "workbench"].includes(engine) ? engine : "workbench";
      render();
      return true;
    }
    if (action === "ov6c-cancel-connect") {
      state.ov6cConnectFromId = "";
      render();
      return true;
    }
    if (action === "ov6c-connect-pick") {
      const sequenceId = ds.sequenceId || state.ov6cSelectedSequenceId || "";
      const participantId = ds.participantId || "";
      if (!sequenceId || !participantId) return true;
      const fromId = String(state.ov6cConnectFromId || "");
      if (!fromId) {
        state.ov6cConnectFromId = participantId;
        state.ov6cSelectedSequenceId = sequenceId;
        render();
        return true;
      }
      if (fromId === participantId) {
        state.ov6cConnectFromId = "";
        render();
        return true;
      }
      const model = resolveDodafProduct(state, "ov6c").model;
      const next = addOv6cMessage(model, sequenceId, {
        fromRef: fromId,
        toRef: participantId,
        name: "新消息"
      });
      const sequence = (next.sequences || []).find((item) => item.id === sequenceId);
      state.ov6cConnectFromId = "";
      state.ov6cSelectedMessageId = sequence?.messages?.at(-1)?.id || "";
      state.ov6cEditorOpen = true;
      persistOv6("ov6c", next, "已在画布添加消息（可直接改名称）");
      return true;
    }
    if (action === "ov6c-participant-field") {
      const model = resolveDodafProduct(state, "ov6c").model;
      const field = ds.field;
      if (!field || !ds.sequenceId || !ds.participantId) return true;
      const patch = {};
      if (field === "name") patch.name = el?.value || "";
      else if (field === "ref") {
        patch.ref = el?.value || "";
        patch.refType = el?.selectedOptions?.[0]?.dataset?.refType || "";
      }
      else return true;
      persistOv6("ov6c", updateOv6cParticipant(model, ds.sequenceId, ds.participantId, patch));
      return true;
    }
    if (action === "ov6c-remove-participant") {
      if (!ds.sequenceId || !ds.participantId) return true;
      const model = resolveDodafProduct(state, "ov6c").model;
      const sequence = (model.sequences || []).find((item) => item.id === ds.sequenceId);
      if ((sequence?.participants || []).length <= 1) {
        notify("至少保留一个参与方");
        return true;
      }
      if (!window.confirm("删除该参与方？相关消息端点将改挂到其余参与方。")) return true;
      persistOv6("ov6c", removeOv6cParticipant(model, ds.sequenceId, ds.participantId), "已删除参与方");
      return true;
    }
    if (action === "ov6c-move-message") {
      if (!ds.sequenceId || !ds.messageId) return true;
      const delta = Number(ds.delta || 0);
      const model = resolveDodafProduct(state, "ov6c").model;
      persistOv6("ov6c", moveOv6cMessage(model, ds.sequenceId, ds.messageId, delta));
      return true;
    }
    if (action === "ov6c-reverse-message") {
      if (!ds.sequenceId || !ds.messageId) return true;
      const model = resolveDodafProduct(state, "ov6c").model;
      persistOv6("ov6c", reverseOv6cMessage(model, ds.sequenceId, ds.messageId), "已反转消息方向");
      return true;
    }
    if (action === "ov6c-adjust-message-time") {
      if (!ds.sequenceId || !ds.messageId) return true;
      const model = resolveDodafProduct(state, "ov6c").model;
      const sequence = (model.sequences || []).find((item) => item.id === ds.sequenceId);
      const message = (sequence?.messages || []).find((item) => item.id === ds.messageId);
      if (!message) return true;
      const field = ds.field === "durationMinutes" ? "durationMinutes" : "offsetMinutes";
      const fallback = field === "durationMinutes" ? 15 : 0;
      const current = Number.isFinite(Number(message[field])) ? Number(message[field]) : fallback;
      const value = Math.max(0, current + Number(ds.delta || 0));
      state.ov6cSelectedMessageId = ds.messageId;
      state.ov6cEditorOpen = true;
      persistOv6("ov6c", updateOv6cMessage(model, ds.sequenceId, ds.messageId, { [field]: value }));
      return true;
    }
    if (action === "ov6c-duplicate-message") {
      if (!ds.sequenceId || !ds.messageId) return true;
      const model = resolveDodafProduct(state, "ov6c").model;
      const next = duplicateOv6cMessage(model, ds.sequenceId, ds.messageId);
      const sequence = (next.sequences || []).find((item) => item.id === ds.sequenceId);
      const sourceIndex = (sequence?.messages || []).findIndex((item) => item.id === ds.messageId);
      state.ov6cSelectedMessageId = sequence?.messages?.[sourceIndex + 1]?.id || "";
      state.ov6cEditorOpen = true;
      persistOv6("ov6c", next, "已复制消息");
      return true;
    }
    if (action === "ov6c-apply-dsl") {
      const sequenceId = ds.sequenceId || state.ov6cSelectedSequenceId || "";
      const engine = resolveSequenceDiagramEngine(ds.engine || state.ov6cDiagramEngine || "js-sequence");
      if (!sequenceId) return true;
      if (engine === "workbench") {
        notify("画布编辑模式请直接在图上修改；可切换到 UML/Mermaid 使用文本");
        return true;
      }
      const editor = document.querySelector(`[data-seq-dsl-editor][data-sequence-id="${CSS.escape(sequenceId)}"]`)
        || document.querySelector("[data-seq-dsl-editor]");
      const text = editor?.value ?? "";
      if (!String(text).trim()) {
        notify("DSL 为空，未应用");
        return true;
      }
      try {
        const model = resolveDodafProduct(state, "ov6c").model;
        const current = (model.sequences || []).find((item) => item.id === sequenceId);
        if (!current) {
          notify("未找到当前时序图");
          return true;
        }
        const parsed = parseSequenceDsl(text, engine);
        if (!parsed.messages?.length && !parsed.participants?.length) {
          notify("未能从 DSL 解析出参与方或消息，请检查语法");
          return true;
        }
        const merged = mergeParsedSequence(current, parsed);
        const next = replaceOv6cSequenceContent(model, sequenceId, merged);
        state.ov6cSelectedSequenceId = sequenceId;
        if (state.ov6cSelectedMessageId && !(merged.messages || []).some((item) => item.id === state.ov6cSelectedMessageId)) {
          state.ov6cSelectedMessageId = merged.messages?.[0]?.id || "";
        }
        persistOv6(
          "ov6c",
          next,
          `已应用${engine === "js-sequence" ? "UML" : "Mermaid"}文本（${merged.participants.length} 生命线 · ${merged.messages.length} 消息）`
        );
      } catch (error) {
        notify(`DSL 解析失败：${error?.message || error}`);
      }
      return true;
    }
    if (action === "ov6c-preview-dsl") {
      // Live preview only — sequenceCanvasController listens for input events.
      return true;
    }
    if (action === "ov6c-seed-phase") {
      const model = resolveDodafProduct(state, "ov6c").model;
      if ((model.sequences || []).length) {
        notify("已有时序图，未覆盖。可对话修订或手动编辑。");
        return true;
      }
      const next = seedOv6cFromPhase(model, state);
      if (next.sequences?.[0]?.id) state.ov6cSelectedSequenceId = next.sequences[0].id;
      persistOv6("ov6c", next, next.sequences?.length ? "已按阶段/兵力生成时序草案" : "未能生成时序（缺少阶段/兵力）");
      return true;
    }
    if (action === "ov6c-add-sequence") {
      const model = resolveDodafProduct(state, "ov6c").model;
      const next = addOv6cSequence(model);
      state.ov6cSelectedSequenceId = next.sequences?.at(-1)?.id || "";
      state.ov6cSelectedMessageId = "";
      persistOv6("ov6c", next, "已新增时序图");
      return true;
    }
    if (action === "ov6c-remove-sequence") {
      if (!ds.sequenceId || !window.confirm("删除该时序图？")) return true;
      const model = resolveDodafProduct(state, "ov6c").model;
      const next = removeOv6cSequence(model, ds.sequenceId);
      if (state.ov6cSelectedSequenceId === ds.sequenceId) {
        state.ov6cSelectedSequenceId = next.sequences?.[0]?.id || "";
        state.ov6cSelectedMessageId = "";
      }
      persistOv6("ov6c", next, "已删除时序图");
      return true;
    }
    if (action === "ov6c-clear-all") {
      const model = resolveDodafProduct(state, "ov6c").model;
      const count = model.sequences?.length || 0;
      if (!count || !window.confirm(`清空全部 ${count} 幅时序图？此操作不可撤销。`)) return true;
      state.ov6cSelectedSequenceId = "";
      state.ov6cSelectedMessageId = "";
      state.ov6cEditorOpen = false;
      persistOv6("ov6c", clearOv6cSequences(model), "已清空时序图");
      return true;
    }
    if (action === "ov6c-add-participant") {
      const model = resolveDodafProduct(state, "ov6c").model;
      persistOv6("ov6c", addOv6cParticipant(model, ds.sequenceId), "已添加参与方");
      return true;
    }
    if (action === "ov6c-add-message") {
      const model = resolveDodafProduct(state, "ov6c").model;
      const next = addOv6cMessage(model, ds.sequenceId);
      const sequence = (next.sequences || []).find((item) => item.id === ds.sequenceId);
      state.ov6cSelectedMessageId = sequence?.messages?.at(-1)?.id || "";
      state.ov6cEditorOpen = true;
      persistOv6("ov6c", next, "已添加消息");
      return true;
    }
    if (action === "ov6c-remove-message") {
      if (!ds.sequenceId || !ds.messageId) return true;
      const model = resolveDodafProduct(state, "ov6c").model;
      const next = removeOv6cMessage(model, ds.sequenceId, ds.messageId);
      if (state.ov6cSelectedMessageId === ds.messageId) state.ov6cSelectedMessageId = "";
      persistOv6("ov6c", next, "已删除消息");
      return true;
    }
    if (action === "ov6c-message-field") {
      const model = resolveDodafProduct(state, "ov6c").model;
      const field = ds.field;
      if (!field || !ds.sequenceId || !ds.messageId) return true;
      const patch = {};
      if (field === "name" || field === "condition" || field === "type" || field === "fromRef" || field === "toRef") {
        patch[field] = el?.value || "";
      } else if (field === "offsetMinutes" || field === "durationMinutes") {
        patch[field] = el?.value === "" ? null : Number(el.value);
      } else if (field === "activity") {
        patch.relatedActivityRefs = el?.value ? [el.value] : [];
      } else {
        return true;
      }
      state.ov6cEditorOpen = true;
      // Keep selection so canvas inline editor stays open after edit.
      state.ov6cSelectedSequenceId = ds.sequenceId;
      state.ov6cSelectedMessageId = ds.messageId;
      persistOv6("ov6c", updateOv6cMessage(model, ds.sequenceId, ds.messageId, patch));
      return true;
    }

    return false;
  }

  const api = {
    /**
     * First entry from 作战兵力 → 组织关系: AI generates command/support/information links
     * among existing forces. Does not invent organizations or overwrite AI/human-owned models.
     */
    async pregenerateOv4FromForceMission({ silent = false, force = false } = {}) {
      const state = getState();
      if (state.ov4Pregenerating) return { skipped: true, reason: "busy" };
      const current = state.ov4 && typeof state.ov4 === "object"
        ? normalizeDodafOv4(state.ov4)
        : normalizeDodafOv4({ roles: [], relations: [], diagrams: [] });
      const fingerprint = buildOv4ForceFingerprint(state.forceMission);
      const visible = (current.diagrams || []).some((item) => (item.roleIds || []).length) && (current.roles || []).length;
      const sameSource = String(current.derivedFrom?.note || "") === fingerprint;
      const stale = Boolean(current.derivedFrom?.note) && String(current.derivedFrom.note).startsWith("ov4-force:") && !sameSource;
      if (!force && visible && sameSource) {
        return { skipped: true, reason: "has-organization", count: current.relations.length };
      }
      const analysis = buildOrganizationRelationshipAnalysis(state);
      if (!(analysis.forces.length || analysis.combatForces.length)) {
        if (!silent) notify("未能生成组织关系：请先确认作战兵力");
        return { skipped: true, reason: "no-source" };
      }

      state.ov4Pregenerating = true;
      render();
      await new Promise((resolve) => {
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        } else {
          setTimeout(resolve, 32);
        }
      });
      const startedAt = Date.now();
      try {
        let draft = null;
        let source = "ai";
        try {
          const response = await generateWithAiStream({
            workflowId: "ov4",
            workflow: { id: "ov4", title: "组织关系", outputSchema: "OrganizationRelationshipDraft" },
            analysis,
            evidence: []
          });
          if (!Array.isArray(response?.result?.relations) || !response.result.relations.length) {
            throw new Error("organization relationship draft empty");
          }
          draft = response.result;
        } catch {
          draft = generateMockOutput({
            workflow: { id: "ov4", title: "组织关系", outputSchema: "OrganizationRelationshipDraft" },
            analysis,
            evidence: []
          }).result;
          source = "local-fallback";
        }

        const next = normalizeDodafOv4(applyOrganizationRelationshipDraft(state, draft, { source, fingerprint }));
        if (!(next.roles || []).length) throw new Error("organization relationship draft produced no roles");
        state.ov4 = saveLocalDodafProduct("ov4", next, projectId);
        state.ov4SelectedDiagramId = next.diagrams?.[0]?.id || "";
        state.ov4EditorOpen = true;
        state.ov4ToolsOpen = true;
        await syncControllers.ov4.sync(state.ov4, { source: "ov4:pregenerate-ai" });
        await writebackArchitecture("ov4:pregenerate-ai");

        const elapsed = Date.now() - startedAt;
        if (elapsed < 600) await new Promise((resolve) => setTimeout(resolve, 600 - elapsed));
        if (!silent) {
          if (stale) notify(`兵力已变化，已按最新兵力重生成 ${next.roles.length} 个组织、${(next.relations || []).length} 条关系`);
          else if (source === "ai") notify(`AI 已根据作战兵力生成 ${next.roles.length} 个组织、${(next.relations || []).length} 条关系，请复核`);
          else notify(`AI 暂不可用，已生成 ${next.roles.length} 个组织、${(next.relations || []).length} 条本地关系草案，请复核`);
        }
        return { applied: (next.relations || []).length, source, skipped: false };
      } catch (error) {
        if (!silent) notify("组织关系自动生成失败，请在本页点击重新生成");
        return { skipped: true, reason: "error", error: error instanceof Error ? error.message : String(error || "") };
      } finally {
        state.ov4Pregenerating = false;
        render();
      }
    },

    async pregenerateOv1bFromTasks({ silent = false, force = false } = {}) {
      const state = getState();
      const tasks = (state.forceMission?.tasks || []).map((task) => ({ id: task.id, name: task.name, side: task.side, missionType: task.missionType, objective: task.objective, expectedEffect: task.expectedEffect }));
      const current = normalizeDodafOv1b(state.ov1b || { taskGroups: [] });
      const taskFingerprint = buildTaskDecompositionFingerprint(tasks);
      if (state.taskDecompositionPregenerating) return { skipped: true, reason: "busy" };
      if (!force && current.derivedFrom?.note === taskFingerprint) return { skipped: true, reason: "tasks-unchanged" };
      if (tasks.length < 2) return { skipped: true, reason: "insufficient-tasks" };
      state.taskDecompositionPregenerating = true; render();
      try {
        let draft; let source = "ai";
        try {
          const response = await generateWithAiStream({ workflowId: "task-organization", workflow: { id: "task-organization", title: "任务整理", outputSchema: "TaskOrganizationDraft" }, analysis: { tasks }, evidence: [] });
          if (!isAiOutput(response) || !Array.isArray(response.result?.taskGroups)) throw new Error("task organization empty");
          draft = response.result;
        } catch {
          const grouped = ["friendly", "hostile"].flatMap((side) => {
            const items = tasks.filter((task) => (task.side === "hostile" ? "hostile" : "friendly") === side);
            return items.length ? [{ name: side === "hostile" ? "红方任务" : "蓝方任务", dimension: "side", taskRefs: items.map((task) => task.id), rationale: "按阵营整理现有任务。", coordination: "组内顺序沿用任务清单。" }] : [];
          });
          draft = { taskGroups: grouped }; source = "local-fallback";
        }
        const ids = new Set(tasks.map((task) => task.id));
        const generated = (draft.taskGroups || []).map((item, index) => ({ id: `task-organization-ai-${taskFingerprint.slice(-8)}-${index + 1}`, name: String(item.name || `任务组 ${index + 1}`).slice(0, 240), dimension: String(item.dimension || "custom").slice(0, 80), taskRefs: [...new Set((item.taskRefs || []).filter((id) => ids.has(id)))], rationale: String(item.rationale || "").slice(0, 600), coordination: String(item.coordination || "").slice(0, 600), status: "pending_review" })).filter((item) => item.taskRefs.length);
        const taskGroups = mergeTaskDecompositionDraft(current.taskGroups, generated);
        const derivedFrom = { mode: source, sources: ["forceMissionPlan.tasks"], generatedAt: new Date().toISOString(), note: taskFingerprint };
        state.ov1b = saveLocalDodafProduct("ov1b", normalizeDodafOv1b({ ...current, taskGroups, derivedFrom, status: taskGroups.some((item) => item.status !== "confirmed") ? "pending_review" : taskGroups.length ? "confirmed" : "draft" }), projectId);
        await syncControllers.ov1b.sync(state.ov1b, { source: "task-organization:pregenerate-tasks" });
        await writebackArchitecture("task-organization:pregenerate-tasks");
        if (!silent) notify(source === "ai" ? `AI 已整理为 ${taskGroups.length} 个任务组，请复核` : `AI 暂不可用，已形成 ${taskGroups.length} 个本地任务整理组`);
        return { applied: taskGroups.length, source };
      } finally { state.taskDecompositionPregenerating = false; render(); }
    },

    /**
     * First entry from 阶段行动 → 状态机：derive editable task machines once.
     * Existing models are human-owned and must never be regenerated implicitly.
     */
    async pregenerateOv6bFromPhaseAction({ silent = false, contextType = "phase" } = {}) {
      const state = getState();
      if (state.stateMachinePregenerating) return { skipped: true, reason: "busy" };
      // Do not use the display resolver here: its OODA legacy seed is only a
      // compatibility preview and must not block first-time phase analysis.
      const current = state.ov6b && typeof state.ov6b === "object"
        ? normalizeDodafOv6b(state.ov6b)
        : normalizeDodafOv6b({ stateMachines: [] });
      const existingForContext = (current.stateMachines || []).filter((item) => item.subjectType === contextType);
      if (existingForContext.length) return { skipped: true, reason: "has-context-machines", count: existingForContext.length };
      const analysis = buildStateMachineGenerationAnalysis(state);
      analysis.stateMachineSubjects = analysis.stateMachineSubjects.filter((item) => item.subjectType === contextType);
      analysis.rules = analysis.rules.filter((rule) => contextType !== "task" || (state.ov6a?.rules || []).some((source) => source.id === rule.id && (source.taskBindings || []).length));
      if (!analysis.stateMachineSubjects.length) return { skipped: true, reason: "no-subjects" };

      state.stateMachinePregenerating = true;
      state.ov6GenerationContext = contextType;
      render();
      await new Promise((resolve) => {
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        } else {
          setTimeout(resolve, 32);
        }
      });
      const startedAt = Date.now();
      try {
        let draft = null;
        let source = "ai";
        try {
          const response = await generateWithAiStream({
            workflowId: "state-machine",
            workflow: { id: "state-machine", title: "阶段行动状态机分析", outputSchema: "StateMachineDraft" },
            analysis,
            evidence: []
          });
          if (!isAiOutput(response) || !Array.isArray(response.result?.stateMachines) || !response.result.stateMachines.length) {
            throw new Error("state machine draft empty");
          }
          draft = response.result;
        } catch {
          draft = generateMockOutput({
            workflow: { id: "state-machine", title: "阶段行动状态机分析", outputSchema: "StateMachineDraft" },
            analysis,
            evidence: []
          }).result;
          source = "local-fallback";
        }

        const generated = applyStateMachineDraft(draft, analysis);
        const next = normalizeDodafOv6b({ ...current, stateMachines: [...(current.stateMachines || []).filter((item) => item.subjectType !== contextType), ...(generated.stateMachines || [])] });
        if (!next.stateMachines.length) throw new Error("state machine draft produced no machines");
        state.ov6b = saveLocalDodafProduct("ov6b", next, projectId);
        state.ov6bSelectedMachineId = next.stateMachines[0]?.id || "";
        state.ov6bSelectedStateId = "";
        await syncControllers.ov6b.sync(state.ov6b, { source: "state-machine:pregenerate-phase-action" });
        await writebackArchitecture("state-machine:pregenerate-phase-action");

        const elapsed = Date.now() - startedAt;
        if (elapsed < 600) await new Promise((resolve) => setTimeout(resolve, 600 - elapsed));
        if (!silent) {
          notify(source === "ai"
            ? `已根据阶段与行动生成 ${next.stateMachines.length} 台状态机，请复核状态与转换条件`
            : `AI 暂不可用，已生成 ${next.stateMachines.length} 台本地状态机草案，请复核`);
        }
        return { applied: next.stateMachines.length, source, skipped: false };
      } catch (error) {
        if (!silent) notify("状态机预生成失败，请在状态机校验页手动新建");
        return { skipped: true, reason: "error", error: error instanceof Error ? error.message : String(error || "") };
      } finally {
        state.stateMachinePregenerating = false;
        render();
      }
    },

    /** First state-machine -> sequence transition generates side and per-phase timelines without overwriting human work. */
    async pregenerateOv6cFromPhase({ silent = false, contextType = "phase" } = {}) {
      const state = getState();
      if (state.sequencePregenerating) return { skipped: true, reason: "busy" };
      const current = state.ov6c && typeof state.ov6c === "object"
        ? normalizeDodafOv6c(state.ov6c)
        : normalizeDodafOv6c({ sequences: [] });
      const diagramType = contextType === "task" ? "task" : "phase";
      const existingForContext = (current.sequences || []).filter((item) => item.diagramType === diagramType);
      if (existingForContext.length) return { skipped: true, reason: "has-context-sequences", count: existingForContext.length };
      const analysis = buildSequenceGenerationAnalysis(state);
      if (contextType === "task") {
        analysis.stateMachines = analysis.stateMachines.filter((item) => item.subjectType === "task");
        analysis.requiredSequenceCoverage = { sideSequences: [], phaseSequences: [], taskSequences: analysis.tasks.map((task) => ({ taskId: task.id, taskName: task.name, diagramType: "task" })) };
        analysis.generationReason = "从任务状态机自动生成逐任务时序图";
      }
      if (contextType === "task" ? !analysis.tasks.length : (!analysis.requiredSequenceCoverage.phaseSequences.length && !analysis.requiredSequenceCoverage.sideSequences.length)) {
        if (!silent) notify("未能生成时序草案：请先补充阶段行动或推演方兵力");
        return { skipped: true, reason: "no-source" };
      }

      state.sequencePregenerating = true;
      state.ov6GenerationContext = contextType;
      render();
      const startedAt = Date.now();
      try {
        let draft = null;
        let source = "ai";
        try {
          const response = await generateWithAiStream({
            workflowId: "sequence-check",
            workflow: { id: "sequence-check", title: "状态机到多方分阶段时序生成", outputSchema: "SequenceDraft" },
            analysis,
            evidence: []
          });
          if (!isAiOutput(response) || !Array.isArray(response.result?.sequences) || !response.result.sequences.length) {
            throw new Error("sequence draft empty");
          }
          draft = response.result;
        } catch {
          draft = { summary: "已生成各推演方及逐阶段时序草案。", sequences: [] };
          source = "local-fallback";
        }

        const generated = applySequenceDraft({ sequences: [] }, draft, { mutation: true }).model || normalizeDodafOv6c({ sequences: [] });
        const covered = contextType === "task" ? ensureTaskSequenceCoverage(generated, analysis) : ensureRequiredSequenceCoverage(generated, state, analysis);
        const next = normalizeDodafOv6c({ ...current, sequences: [...(current.sequences || []).filter((item) => item.diagramType !== diagramType), ...(covered.sequences || [])] });
        if (!Array.isArray(next.sequences) || !next.sequences.length) throw new Error("sequence coverage empty");
        state.ov6c = saveLocalDodafProduct("ov6c", next, projectId);
        state.ov6cSelectedSequenceId = next.sequences[0]?.id || "";
        state.ov6cSelectedMessageId = "";
        await syncControllers.ov6c.sync(state.ov6c, { source: "sequence:pregenerate-state-machine-next" });
        await writebackArchitecture("sequence:pregenerate-state-machine-next");

        const elapsed = Date.now() - startedAt;
        if (elapsed < 600) await new Promise((resolve) => setTimeout(resolve, 600 - elapsed));
        if (!silent) notify(source === "ai"
          ? `AI 已自动生成 ${next.sequences.length} 幅推演方/阶段时序图，请复核参与方、消息与时间`
          : `AI 暂不可用，已生成 ${next.sequences.length} 幅本地推演方/阶段时序草案，请复核`);
        return { applied: next.sequences.length, source, skipped: false };
      } catch (error) {
        if (!silent) notify("时序图自动生成失败，请在时序图页重试");
        return { skipped: true, reason: "error", error: error instanceof Error ? error.message : String(error || "") };
      } finally {
        state.sequencePregenerating = false;
        render();
      }
    },

    async hydrateAll() {
      for (const resource of DODAF_PRODUCT_KEYS) {
        await syncControllers[resource].hydrate();
      }
      try {
        const remote = await loadProjectArchitecture(projectId);
        const state = getState();
        if (remote?.exists && remote.model) {
          state.architecture = remote.model;
          state.architectureStorage = {
            status: "ready",
            mode: "server",
            label: "Architecture 已同步",
            revision: remote.revision,
            resourceRevision: remote.resourceRevision,
            localSaved: false
          };
          state.projectRevision = Math.max(Number(state.projectRevision || 0), Number(remote.revision || 0));
        } else {
          state.architectureStorage = { status: "ready", mode: "server", label: "Architecture 尚未保存", localSaved: false };
        }
      } catch {
        getState().architectureStorage = { status: "offline", mode: "local", label: "Architecture 存储不可用" };
      }
    },

    async syncResource(resource, model, { source = "manual", writeArchitecture = true } = {}) {
      if (resource === "architecture") {
        await persistArchitecture(model, source);
        return;
      }
      if (!DODAF_PRODUCT_KEYS.includes(resource) || !model) return;
      const state = getState();
      state[resource] = saveLocalDodafProduct(resource, model, projectId);
      await syncControllers[resource].sync(state[resource], { source });
      if (writeArchitecture) await writebackArchitecture(source);
    },

    async syncAllFromState({ source = "manual" } = {}) {
      const state = getState();
      for (const resource of DODAF_PRODUCT_KEYS) {
        if (state[resource]) await api.syncResource(resource, state[resource], { source, writeArchitecture: false });
      }
      await writebackArchitecture(source);
    },

    /** Call after OV-5b activity edits so OV-5a hierarchy stays aligned. */
    async syncFromOv5b({ source = "manual" } = {}) {
      const state = getState();
      if (!state.ov5) return;
      const pair = syncOv5ActivityPair({ ov5: state.ov5, ov5a: state.ov5a, source: "ov5" });
      state.ov5 = persistOv5Model(pair.ov5);
      state.ov5a = saveLocalDodafProduct("ov5a", pair.ov5a, projectId);
      if (syncOv5) await syncOv5(state.ov5, { source });
      await syncControllers.ov5a.sync(state.ov5a, { source: `${source}-ov5b-sync` });
      await writebackArchitecture(source);
    },

    ensureFileInput() {
      if (fileInput) return fileInput;
      fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json,.xml,application/json,text/xml,application/xml";
      fileInput.hidden = true;
      fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        fileInput.value = "";
        if (file) void importArchitectureFile(file);
      });
      document.body.appendChild(fileInput);
      return fileInput;
    },

    handleAction(action, el = null) {
      for (const resource of DODAF_PRODUCT_KEYS) {
        if (syncControllers[resource].handleAction(action)) return true;
      }

      if (action?.startsWith("seed-dodaf-")) {
        const resource = action.replace("seed-dodaf-", "");
        if (!DODAF_PRODUCT_KEYS.includes(resource)) return false;
        void seedAndSave(resource);
        return true;
      }

      if (action?.startsWith("save-dodaf-")) {
        const resource = action.replace("save-dodaf-", "");
        if (!DODAF_PRODUCT_KEYS.includes(resource)) return false;
        void saveProduct(resource);
        return true;
      }

      if (handleOv6WorkbenchAction(action, el)) return true;

      if (action === "sync-ov5a-from-ov5b") {
        void api.syncFromOv5b({ source: "manual-sync" }).then(() => {
          notify("已将作战活动父子关系同步到 OV5a");
          render();
        });
        return true;
      }

      if (action === "sync-ov5b-from-ov5a") {
        void syncOv5aIntoOv5b("manual-sync").then(() => {
          notify("已将 OV5a 父子关系应用到作战活动");
          render();
        });
        return true;
      }

      if (action === "export-architecture-json" || action === "export-architecture-xml") {
        void exportArchitecture(action.endsWith("xml") ? "xml" : "json");
        return true;
      }

      if (action === "import-architecture-file") {
        api.ensureFileInput().click();
        return true;
      }

      if (action === "import-architecture-json") {
        void importArchitecturePrompt("json");
        return true;
      }

      return false;
    },

    handleFieldChange(fieldPath, value) {
      if (!fieldPath?.startsWith("ov")) return false;
      const [resource, ...rest] = fieldPath.split(".");
      if (!DODAF_PRODUCT_KEYS.includes(resource)) return false;
      const state = getState();
      const resolved = resolveDodafProduct(state, resource);
      const path = rest.join(".");
      // OV-5a owns only parent/child Activity references; OV-5b owns activity bodies.
      if (resource === "ov5a" && path.startsWith("decomposition.") && path.endsWith(".parentActivityRef")) {
        const activityId = path.split(".")[1];
        state.ov5a = saveLocalDodafProduct("ov5a", setOv5aParent(resolved.model, activityId, value), projectId);
        void syncOv5aIntoOv5b("manual-edit");
        render();
        return true;
      }
      const updated = updateProductField(resolved.model, resource, path, value);
      const refreshed = resource === "ov1c"
        ? buildOv1cModel({ ...state, ov1c: updated })
        : resource === "ov7"
          ? buildOv7Model({ ...state, ov7: updated })
          : updated;
      state[resource] = saveLocalDodafProduct(resource, refreshed, projectId);
      void syncControllers[resource].sync(state[resource], { source: "manual-edit" }).then(() => writebackArchitecture("manual-edit"));
      render();
      return true;
    }
  };

  return api;

  async function seedAndSave(resource) {
    const state = getState();
    if (state[resource] && !window.confirm(`重新种子将覆盖当前 ${LABELS[resource]} 手改内容。是否继续？`)) return;
    if (resource === "ov4") {
      await api.pregenerateOv4FromForceMission({ silent: false, force: true });
      return;
    }
    if (resource === "ov5a") {
      const pair = syncOv5ActivityPair({ ov5: state.ov5, ov5a: null, source: "ov5" });
      state.ov5a = saveLocalDodafProduct("ov5a", pair.ov5a, projectId);
    } else {
      state[resource] = saveLocalDodafProduct(resource, seedDodafProduct(resource, state), projectId);
    }
    await syncControllers[resource].sync(state[resource], { source: "seed" });
    await writebackArchitecture("seed");
    notify(`已从上游生成 ${LABELS[resource]} 种子并提交保存`);
    render();
  }

  async function saveProduct(resource) {
    const state = getState();
    if (resource === "ov5a") {
      await syncOv5aIntoOv5b("manual");
      notify("已保存活动分解关系，并同步更新作战活动父级");
      render();
      return;
    }
    const resolved = resolveDodafProduct(state, resource);
    state[resource] = saveLocalDodafProduct(resource, resolved.model, projectId);
    await syncControllers[resource].sync(state[resource], { source: "manual" });
    await writebackArchitecture("manual");
    notify(`正在保存 ${LABELS[resource]}…`);
    render();
  }

  async function syncOv5aIntoOv5b(source) {
    const state = getState();
    const resolved = resolveDodafProduct(state, "ov5a");
    const pair = syncOv5ActivityPair({ ov5: state.ov5, ov5a: resolved.model, source: "ov5a" });
    state.ov5 = persistOv5Model(pair.ov5);
    state.ov5a = saveLocalDodafProduct("ov5a", pair.ov5a, projectId);
    if (syncOv5) await syncOv5(state.ov5, { source: `${source}-ov5a-sync` });
    await syncControllers.ov5a.sync(state.ov5a, { source });
    await writebackArchitecture(source);
  }

  async function writebackArchitecture(source = "manual") {
    const state = getState();
    const products = {
      ov1: state.ov1,
      ov1b: state.ov1b,
      ov2: state.ov2,
      ov3: state.ov3,
      ov4: state.ov4,
      ov5a: state.ov5a,
      ov5: state.ov5,
      ov6a: state.ov6a,
      ov6b: state.ov6b,
      ov6c: state.ov6c
    };
    const next = mergeProductsIntoArchitecture(state.architecture, products, {
      projectId,
      title: typeof projectTitle === "function" ? projectTitle() : projectTitle
    });
    await persistArchitecture(next, `${source}-architecture-writeback`);
  }

  async function persistArchitecture(model, source) {
    const state = getState();
    state.architecture = model;
    try {
      const result = await saveProjectArchitecture(projectId, {
        model,
        source,
        expectedRevision: state.projectRevision
      });
      state.projectRevision = result.revision;
      try { await onSaved?.({ resource: "architecture", source, remote: result }); } catch {}
      state.architectureStorage = {
        status: "ready",
        mode: "server",
        label: `Architecture r${result.revision}`,
        revision: result.revision,
        resourceRevision: result.resourceRevision,
        localSaved: false
      };
    } catch (error) {
      notify(error.message || "Architecture 保存失败");
    }
  }

  async function exportArchitecture(format) {
    try {
      // Refresh architecture library before export so package includes latest product entities.
      await writebackArchitecture("export");
      const result = await exportProjectArchitecture(projectId, format);
      if (format === "xml") {
        const body = result.body || result;
        downloadArtifact({
          filename: `${projectId}-architecture-exchange.xml`,
          mimeType: "application/xml",
          content: typeof body === "string" ? body : String(body)
        });
      } else {
        downloadArtifact({
          filename: `${projectId}-architecture-exchange.json`,
          mimeType: "application/json",
          content: JSON.stringify(result.package || result, null, 2)
        });
      }
      notify(`已导出 DoDAF 架构包（${format.toUpperCase()}）`);
    } catch (error) {
      notify(error.message || "架构包导出失败");
    }
  }

  async function importArchitectureFile(file) {
    try {
      const text = await file.text();
      const name = String(file.name || "").toLowerCase();
      const format = name.endsWith(".xml") || text.trimStart().startsWith("<") ? "xml" : "json";
      let packageModel = null;
      let body = text;
      if (format === "json") {
        packageModel = JSON.parse(text);
        body = undefined;
      }
      await applyImport({ package: packageModel, body, format });
    } catch (error) {
      notify(error.message || "架构包文件导入失败");
    }
  }

  async function importArchitecturePrompt(format) {
    const raw = window.prompt("粘贴 DoDAF 架构交换包 JSON（也可使用「从文件导入」）：");
    if (!raw) return;
    try {
      const packageModel = JSON.parse(raw);
      await applyImport({ package: packageModel, format });
    } catch (error) {
      notify(error.message || "架构包导入失败");
    }
  }

  async function applyImport({ package: packageModel, body, format = "json" }) {
    const state = getState();
    if (!window.confirm("导入将按 replace-products 覆盖当前 OV 产品与 architecture。是否继续？")) return;
    const result = await importProjectArchitecture(projectId, {
      package: packageModel,
      body,
      format,
      mergeStrategy: "replace-products",
      source: "import-file",
      expectedRevision: state.projectRevision
    });
    state.projectRevision = result.revision;
    try { await onSaved?.({ resource: "architecture", source: "import-file", remote: result }); } catch {}
    for (const [resource, payload] of Object.entries(result.resources || {})) {
      if (!payload?.model) continue;
      if (resource === "architecture") {
        state.architecture = payload.model;
        state.architectureStorage = {
          status: "ready",
          mode: "server",
          label: `Architecture r${result.revision}`,
          revision: result.revision,
          resourceRevision: payload.resourceRevision,
          localSaved: false
        };
      } else if (DODAF_PRODUCT_KEYS.includes(resource)) {
        state[resource] = saveLocalDodafProduct(resource, payload.model, projectId);
      } else if (resource === "ov1" || resource === "ov5") {
        state[resource] = payload.model;
      }
    }
    if (result.resources?.ov1?.model) state.ov1 = result.resources.ov1.model;
    if (result.resources?.ov5?.model) {
      state.ov5 = persistOv5Model(result.resources.ov5.model);
      if (syncOv5) await syncOv5(state.ov5, { source: "import" });
    }
    notify(`已导入架构包：${(result.imported || []).join(", ")}`);
    render();
  }
}
