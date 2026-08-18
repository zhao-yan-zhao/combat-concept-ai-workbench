import { normalizeForceMissionPlan, normalizePhaseActionConcept } from "./conceptPlanning.js";
import {
  normalizeDodafOv1,
  normalizeDodafOv1b,
  normalizeDodafOv1c,
  normalizeDodafOv2,
  normalizeDodafOv3,
  normalizeDodafOv4,
  normalizeDodafOv5,
  normalizeDodafOv5a,
  normalizeDodafOv6a,
  normalizeDodafOv6b,
  normalizeDodafOv6c,
  normalizeDodafOv7
} from "./dodaf/products.js";

export const MODEL_RELATION_TYPES = Object.freeze({
  DERIVED_FROM: "derived_from",
  BINDS_TO: "binds_to",
  FEEDBACK_TO: "feedback_to"
});

export const MODEL_CONTEXT_STATUSES = Object.freeze([
  "not_applicable",
  "empty",
  "partial",
  "pending_review",
  "confirmed",
  "stale",
  "conflict"
]);

const ROOT = "$root";
const TASKS_ROOT = "$tasks";

const PRODUCT_DEFINITIONS = Object.freeze([
  { key: "brief", resource: "brief", objectId: ROOT, viewId: "brief", label: "简报" },
  { key: "phase", resource: "phaseActionConcept", objectId: ROOT, viewId: "phase-action", label: "阶段行动" },
  { key: "task", resource: "forceMissionPlan", objectId: TASKS_ROOT, viewId: "operational-task", label: "作战任务" },
  { key: "force", resource: "forceMissionPlan", objectId: ROOT, viewId: "force-mission", label: "作战兵力" },
  { key: "ov1", resource: "ov1", objectId: ROOT, viewId: "ov1", label: "总体图 OV1a" },
  { key: "conceptMap", resource: "conceptMap", objectId: ROOT, viewId: "concept-map", label: "概念图" },
  { key: "simulation", resource: "scenario", objectId: ROOT, viewId: "scenario", label: "仿真演示" },
  { key: "ov6a", resource: "ov6a", objectId: ROOT, viewId: "ov6a", label: "规则库 OV6a" },
  { key: "ov6b", resource: "ov6b", objectId: ROOT, viewId: "ov6b", label: "状态机 OV6b" },
  { key: "ov6c", resource: "ov6c", objectId: ROOT, viewId: "ov6c", label: "时序图" },
  { key: "ov1b", resource: "ov1b", objectId: ROOT, viewId: "ov1b", label: "任务分解 OV1b" },
  { key: "ov4", resource: "ov4", objectId: ROOT, viewId: "ov4", label: "组织关系 OV4" },
  { key: "ov2", resource: "ov2", objectId: ROOT, viewId: "ov2", label: "资源流 OV2" },
  { key: "ov3", resource: "ov3", objectId: ROOT, viewId: "ov3", label: "资源流矩阵 OV3" },
  { key: "ov5a", resource: "ov5a", objectId: ROOT, viewId: "ov5a", label: "作战活动分解 OV5a" },
  { key: "ov5", resource: "ov5", objectId: ROOT, viewId: "ov5", label: "作战活动 OV5b" },
  { key: "ov1c", resource: "ov1c", objectId: ROOT, viewId: "ov1c", label: "任务与活动映射 OV1c" },
  { key: "ov7", resource: "ov7", objectId: ROOT, viewId: "ov7", label: "状态与活动映射 OV7" },
  { key: "review", resource: "modelTopology", objectId: ROOT, viewId: "structure-review", label: "跨模型一致性校核" }
]);

const VIEW_TO_PRODUCT_KEY = Object.freeze(Object.fromEntries(PRODUCT_DEFINITIONS.map((item) => [item.viewId, item.key])));

export function modelNodeId(resource, objectId = ROOT) {
  return `${clean(resource)}:${clean(objectId) || ROOT}`;
}

export function buildModelTopology(input = {}) {
  const state = input && typeof input === "object" ? input : {};
  const phaseAction = normalizePhaseActionConcept(state.phaseAction || state.phaseActionConcept);
  const forceMission = normalizeForceMissionPlan(state.forceMission || state.forceMissionPlan);
  const ov1 = safeNormalize(normalizeDodafOv1, state.ov1, { nodes: [], edges: [] });
  const ov1b = safeNormalize(normalizeDodafOv1b, state.ov1b, { decompositions: [] });
  const ov1c = safeNormalize(normalizeDodafOv1c, state.ov1c, { mappings: [] });
  const ov2 = safeNormalize(normalizeDodafOv2, state.ov2, { nodes: [], exchanges: [] });
  const ov3 = safeNormalize(normalizeDodafOv3, state.ov3, { exchanges: [] });
  const ov4 = safeNormalize(normalizeDodafOv4, state.ov4, { roles: [], relations: [] });
  const ov5 = safeNormalize(normalizeDodafOv5, state.ov5, { activities: [], edges: [] });
  const ov5a = safeNormalize(normalizeDodafOv5a, state.ov5a, { decompositions: [] });
  const ov6a = safeNormalize(normalizeDodafOv6a, state.ov6a, { rules: [] });
  const ov6b = safeNormalize(normalizeDodafOv6b, state.ov6b, { stateMachines: [], states: [], transitions: [] });
  const ov6c = safeNormalize(normalizeDodafOv6c, state.ov6c, { sequences: [], events: [] });
  const ov7 = safeNormalize(normalizeDodafOv7, state.ov7, { mappings: [] });
  const graph = createGraph();
  const rootIds = {};

  const counts = {
    brief: countBriefFields(state.brief),
    phase: phaseAction.phases.length,
    task: forceMission.tasks.length,
    force: forceMission.forces.length + forceMission.combatForces.length,
    ov1: ov1.nodes?.length || 0,
    conceptMap: state.conceptMap?.document?.items?.length || 0,
    simulation: (state.scenario?.entities?.length || 0) + (state.scenario?.timeline?.length || 0),
    ov6a: ov6a.rules?.length || 0,
    ov6b: ov6b.stateMachines?.length || 0,
    ov6c: ov6c.sequences?.length || 0,
    ov1b: ov1b.decompositions?.length || 0,
    ov4: (ov4.roles?.length || 0) + (ov4.relations?.length || 0),
    ov2: ov2.exchanges?.length || 0,
    ov3: ov3.exchanges?.length || 0,
    ov5a: ov5a.decompositions?.length || 0,
    ov5: ov5.activities?.length || 0,
    ov1c: ov1c.mappings?.length || 0,
    ov7: ov7.mappings?.length || 0,
    review: 0
  };

  PRODUCT_DEFINITIONS.forEach((definition) => {
    const id = graph.addNode({
      resource: definition.resource,
      objectId: definition.objectId,
      kind: "product",
      viewId: definition.viewId,
      label: definition.label,
      status: productStatus(definition.key, state, {
        count: counts[definition.key] || 0,
        phaseAction,
        forceMission
      }),
      count: counts[definition.key] || 0
    });
    rootIds[definition.key] = id;
  });

  addRootTopology(graph, rootIds);

  const indexes = createIndexes();
  addPhaseNodes(graph, indexes, phaseAction, rootIds);
  addTaskAndForceNodes(graph, indexes, forceMission, rootIds);
  addOv1Nodes(graph, indexes, ov1, rootIds);
  addConceptMapNodes(graph, indexes, state.conceptMap, rootIds);
  addActivityNodes(graph, indexes, ov5, rootIds);
  addActivityDecompositionNodes(graph, indexes, ov5a, rootIds);
  addRuleNodes(graph, indexes, ov6a, rootIds);
  addStateMachineNodes(graph, indexes, ov6b, rootIds);
  addSequenceNodes(graph, indexes, ov6c, rootIds);
  addOrganizationNodes(graph, indexes, ov4, rootIds);
  addResourceFlowNodes(graph, indexes, ov2, ov3, rootIds);
  addOptionalMappingNodes(graph, indexes, { ...state, ov1b, ov1c, ov7 }, rootIds);
  compileExplicitReferences(graph, indexes);

  return graph.finish(rootIds);
}

export function getModelContextStatus(topology, { focusType = "", focusId = "", targetViewId = "" } = {}) {
  const graph = topology && typeof topology === "object" ? topology : { nodes: [], links: [], diagnostics: [] };
  const targetKey = VIEW_TO_PRODUCT_KEY[targetViewId] || targetViewId;
  const targetDefinition = PRODUCT_DEFINITIONS.find((item) => item.key === targetKey || item.resource === targetKey);
  if (!targetDefinition) return contextResult("not_applicable", 0, 0, []);
  const targetRootId = modelNodeId(targetDefinition.resource, targetDefinition.objectId);
  const targetRoot = graph.nodes.find((node) => node.id === targetRootId);
  if (!targetRoot) return contextResult("not_applicable", 0, 0, []);
  if (!focusType || !focusId) return contextResult(targetRoot.status, targetRoot.count || 0, targetRoot.count || 0, []);

  const focusNodes = graph.nodes.filter((node) => node.kind === focusType && node.objectId === focusId);
  if (!focusNodes.length) return contextResult("not_applicable", 0, targetRoot.count || 0, []);
  const focusNodeIds = new Set(focusNodes.map((node) => node.id));
  const targetNodeIds = new Set(graph.nodes
    .filter((node) => node.resource === targetDefinition.resource && node.objectId !== targetDefinition.objectId)
    .map((node) => node.id));
  const relatedLinks = graph.links.filter((link) => (
    focusNodeIds.has(link.sourceNodeId) && targetNodeIds.has(link.targetNodeId)
  ) || (
    focusNodeIds.has(link.targetNodeId) && targetNodeIds.has(link.sourceNodeId)
  ));
  const relatedDiagnostics = graph.diagnostics.filter((item) => focusNodeIds.has(item.sourceNodeId) || focusNodeIds.has(item.targetNodeId));
  if (relatedDiagnostics.some((item) => item.severity === "error")) {
    return contextResult("conflict", relatedLinks.length, targetRoot.count || 0, relatedDiagnostics);
  }
  if (relatedDiagnostics.some((item) => item.code === "stale_reference")) {
    return contextResult("stale", relatedLinks.length, targetRoot.count || 0, relatedDiagnostics);
  }
  if (!targetRoot.count) return contextResult("empty", 0, 0, relatedDiagnostics);
  if (!relatedLinks.length) return contextResult("partial", 0, targetRoot.count || 0, relatedDiagnostics);
  const status = targetRoot.status === "confirmed" ? "confirmed" : "pending_review";
  return contextResult(status, relatedLinks.length, targetRoot.count || 0, relatedDiagnostics);
}

export function getRelatedModelStatuses(topology, context, targetViewIds = []) {
  return Object.fromEntries((Array.isArray(targetViewIds) ? targetViewIds : []).map((targetViewId) => [
    targetViewId,
    getModelContextStatus(topology, { ...context, targetViewId })
  ]));
}

function addRootTopology(graph, roots) {
  const derived = MODEL_RELATION_TYPES.DERIVED_FROM;
  const binds = MODEL_RELATION_TYPES.BINDS_TO;
  const feedback = MODEL_RELATION_TYPES.FEEDBACK_TO;
  [
    [roots.brief, roots.phase, derived, "形成阶段行动"],
    [roots.phase, roots.task, derived, "形成作战任务"],
    [roots.task, roots.force, derived, "编成作战兵力"],
    [roots.force, roots.ov1, derived, "形成总体构想"],
    [roots.ov1, roots.conceptMap, derived, "空间化表达"],
    [roots.conceptMap, roots.simulation, derived, "编译仿真输入"],
    [roots.phase, roots.ov6a, binds, "阶段规则绑定"],
    [roots.task, roots.ov6a, binds, "任务规则绑定"],
    [roots.force, roots.ov6a, binds, "兵力规则绑定"],
    [roots.ov6a, roots.ov6b, derived, "规则约束状态转换"],
    [roots.ov6b, roots.ov6c, derived, "状态转换形成时序"],
    [roots.task, roots.ov1b, derived, "任务分解"],
    [roots.task, roots.ov4, derived, "任务责任"],
    [roots.force, roots.ov4, derived, "组织编成"],
    [roots.ov4, roots.ov2, derived, "组织间资源交换"],
    [roots.ov2, roots.ov3, derived, "矩阵投影"],
    [roots.phase, roots.ov5a, derived, "阶段活动分解"],
    [roots.task, roots.ov5a, derived, "任务活动分解"],
    [roots.ov1, roots.ov5a, derived, "总体图活动来源"],
    [roots.conceptMap, roots.ov5a, binds, "空间与阶段引用"],
    [roots.ov5a, roots.ov5, derived, "形成作战活动"],
    [roots.ov1b, roots.ov1c, derived, "任务侧映射输入"],
    [roots.ov5, roots.ov1c, binds, "活动侧映射输入"],
    [roots.ov6b, roots.ov7, binds, "状态侧映射输入"],
    [roots.ov6c, roots.ov7, binds, "时序侧映射输入"],
    [roots.ov5, roots.ov7, binds, "活动侧映射输入"],
    [roots.ov1c, roots.review, derived, "任务活动覆盖校核"],
    [roots.ov7, roots.review, derived, "状态活动覆盖校核"],
    [roots.ov3, roots.review, derived, "资源交换一致性"],
    [roots.review, roots.simulation, derived, "校核仿真输入"],
    [roots.simulation, roots.brief, feedback, "结果回改研究假设"]
  ].forEach(([source, target, relationType, semantic]) => graph.addLink({ sourceNodeId: source, targetNodeId: target, relationType, semantic }));
}

function addPhaseNodes(graph, indexes, phaseAction, roots) {
  phaseAction.phases.forEach((phase) => {
    const nodeId = graph.addNode({ resource: "phaseActionConcept", objectId: phase.id, kind: "phase", viewId: "phase-action", label: phase.name, status: phaseAction.status === "confirmed" ? "confirmed" : "pending_review" });
    indexes.phase.set(phase.id, nodeId);
    graph.addLink({ sourceNodeId: roots.brief, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "简报形成阶段" });
  });
}

function addTaskAndForceNodes(graph, indexes, forceMission, roots) {
  forceMission.tasks.forEach((task) => {
    const nodeId = graph.addNode({ resource: "forceMissionPlan", objectId: task.id, kind: "task", viewId: "operational-task", label: task.name, status: forceMission.tasksConfirmedAt ? "confirmed" : "pending_review" });
    indexes.task.set(task.id, nodeId);
    graph.addLink({ sourceNodeId: roots.task, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "任务集合" });
    indexes.pendingRefs.push({ sourceNodeId: nodeId, targetKind: "phase", ref: task.phaseId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "任务所属阶段", required: true });
  });
  [...forceMission.forces.map((item) => ({ ...item, kind: "force" })), ...forceMission.combatForces.map((item) => ({ ...item, kind: "force" }))].forEach((force) => {
    const nodeId = graph.addNode({ resource: "forceMissionPlan", objectId: force.id, kind: "force", viewId: "force-mission", label: force.name, status: forceMission.status === "confirmed" ? "confirmed" : "pending_review" });
    indexes.force.set(force.id, nodeId);
    graph.addLink({ sourceNodeId: roots.force, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "兵力集合" });
    (force.phaseIds || []).forEach((phaseId) => indexes.pendingRefs.push({ sourceNodeId: nodeId, targetKind: "phase", ref: phaseId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "兵力覆盖阶段" }));
    if (force.conceptForceId) indexes.pendingRefs.push({ sourceNodeId: nodeId, targetKind: "force", ref: force.conceptForceId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "作战兵力细化概念兵力" });
  });
  (forceMission.relations || []).forEach((relation) => {
    indexes.pendingRefs.push({ sourceKind: "force", sourceRef: relation.fromForceId, targetKind: "force", ref: relation.toForceId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: relation.type || "兵力关系" });
  });
}

function addOv1Nodes(graph, indexes, ov1, roots) {
  (ov1.nodes || []).forEach((node) => {
    const nodeId = graph.addNode({ resource: "ov1", objectId: node.id, kind: "ov1-node", viewId: "ov1", label: node.label || node.id, status: "pending_review" });
    indexes.ov1.set(node.id, nodeId);
    graph.addLink({ sourceNodeId: roots.ov1, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "总体图节点" });
  });
}

function addConceptMapNodes(graph, indexes, conceptMap, roots) {
  const items = Array.isArray(conceptMap?.document?.items) ? conceptMap.document.items : [];
  items.forEach((item, index) => {
    const id = clean(item?.id) || `map-item-${index + 1}`;
    const nodeId = graph.addNode({ resource: "conceptMap", objectId: id, kind: "map-item", viewId: "concept-map", label: clean(item?.label || item?.name || item?.title) || id, status: conceptMap?.reference?.status === "confirmed" ? "confirmed" : "pending_review" });
    indexes.mapItem.set(id, nodeId);
    graph.addLink({ sourceNodeId: roots.conceptMap, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "概念图对象" });
  });
}

function addActivityNodes(graph, indexes, ov5, roots) {
  (ov5.activities || []).forEach((activity) => {
    const nodeId = graph.addNode({ resource: "ov5", objectId: activity.id, kind: "activity", viewId: "ov5", label: activity.title || activity.id, status: "pending_review" });
    indexes.activity.set(activity.id, nodeId);
    graph.addLink({ sourceNodeId: roots.ov5, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "作战活动" });
    (activity.sourceOv1NodeIds || []).forEach((ref) => indexes.pendingRefs.push({ sourceKind: "ov1", sourceRef: ref, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "总体图活动来源", required: true }));
    if (activity.parentId) indexes.pendingRefs.push({ sourceKind: "activity", sourceRef: activity.parentId, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "活动分解" });
    for (const sourceRef of normalizeSourceRefs(activity.sourceRefs)) indexes.pendingSourceRefs.push({ targetNodeId: nodeId, ...sourceRef });
  });
}

function addActivityDecompositionNodes(graph, indexes, ov5a, roots) {
  (ov5a.decompositions || []).forEach((item) => {
    const nodeId = graph.addNode({
      resource: "ov5a",
      objectId: item.id,
      kind: "activity-decomposition",
      viewId: "ov5a",
      label: `${item.parentActivityRef} → ${item.childActivityRef}`,
      status: item.status === "confirmed" ? "confirmed" : item.status === "conflict" ? "conflict" : "pending_review"
    });
    graph.addLink({ sourceNodeId: roots.ov5a, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "活动分解关系" });
    indexes.pendingRefs.push({ sourceKind: "activity", sourceRef: item.parentActivityRef, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "上级活动", required: true });
    indexes.pendingRefs.push({ sourceKind: "activity", sourceRef: item.childActivityRef, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "下级活动", required: true });
    for (const sourceRef of normalizeSourceRefs(item.sourceRefs)) indexes.pendingSourceRefs.push({ targetNodeId: nodeId, ...sourceRef });
  });
}

function addRuleNodes(graph, indexes, ov6a, roots) {
  (ov6a.rules || []).forEach((rule) => {
    const nodeId = graph.addNode({ resource: "ov6a", objectId: rule.id, kind: "rule", viewId: "ov6a", label: rule.name || rule.id, status: rule.reviewStatus === "verified" ? "confirmed" : rule.reviewStatus === "stale" ? "stale" : "pending_review" });
    indexes.rule.set(rule.id, nodeId);
    graph.addLink({ sourceNodeId: roots.ov6a, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "规则库条目" });
    (rule.phaseBindings || []).forEach((binding) => indexes.pendingRefs.push({ sourceKind: "phase", sourceRef: binding.phaseRef, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "规则作用阶段", required: true }));
    (rule.activityBindings || []).forEach((binding) => indexes.pendingRefs.push({ sourceKind: "activity", sourceRef: binding.activityRef, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "规则约束活动", status: binding.bindingStatus, required: true }));
    for (const binding of normalizeNamedBindings(rule.taskBindings, "task")) indexes.pendingRefs.push({ sourceKind: "task", sourceRef: binding.ref, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "规则约束任务", status: binding.status, required: true });
    for (const binding of normalizeNamedBindings(rule.forceBindings, "force")) indexes.pendingRefs.push({ sourceKind: "force", sourceRef: binding.ref, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "规则约束兵力", status: binding.status, required: true });
  });
}

function addStateMachineNodes(graph, indexes, ov6b, roots) {
  (ov6b.stateMachines || []).forEach((machine) => {
    const machineNodeId = graph.addNode({ resource: "ov6b", objectId: machine.id, kind: "state-machine", viewId: "ov6b", label: machine.name || machine.id, status: machine.states?.length && machine.transitions?.length ? "pending_review" : "partial" });
    indexes.machine.set(machine.id, machineNodeId);
    graph.addLink({ sourceNodeId: roots.ov6b, targetNodeId: machineNodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "状态机" });
    if (machine.subjectRef) indexes.pendingRefs.push({ sourceKind: subjectKind(machine.subjectType), sourceRef: machine.subjectRef, targetNodeId: machineNodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: `${machine.subjectType || "对象"}状态机`, required: true });
    else graph.addDiagnostic({ code: "missing_subject_ref", severity: "warning", message: `状态机「${machine.name || machine.id}」缺少建模对象引用`, targetNodeId: machineNodeId });
    (machine.states || []).forEach((state) => {
      const stateNodeId = graph.addNode({ resource: "ov6b", objectId: state.id, kind: "state", viewId: "ov6b", label: state.name || state.id, status: "pending_review" });
      indexes.state.set(state.id, stateNodeId);
      graph.addLink({ sourceNodeId: machineNodeId, targetNodeId: stateNodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "状态机状态" });
    });
    (machine.transitions || []).forEach((transition) => {
      const transitionObjectId = `${machine.id}::${transition.id}`;
      const transitionNodeId = graph.addNode({ resource: "ov6b", objectId: transitionObjectId, kind: "state-transition", viewId: "ov6b", label: transition.condition || transition.id, status: "pending_review" });
      indexes.transition.set(transition.id, transitionNodeId);
      graph.addLink({ sourceNodeId: machineNodeId, targetNodeId: transitionNodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "状态转换" });
      (transition.ruleRefs || []).forEach((ref) => indexes.pendingRefs.push({ sourceKind: "rule", sourceRef: ref, targetNodeId: transitionNodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "转换规则", required: true }));
    });
  });
}

function addSequenceNodes(graph, indexes, ov6c, roots) {
  (ov6c.sequences || []).forEach((sequence) => {
    const sequenceNodeId = graph.addNode({ resource: "ov6c", objectId: sequence.id, kind: "sequence", viewId: "ov6c", label: sequence.name || sequence.id, status: sequence.messages?.length ? "pending_review" : "partial" });
    indexes.sequence.set(sequence.id, sequenceNodeId);
    graph.addLink({ sourceNodeId: roots.ov6c, targetNodeId: sequenceNodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "时序图" });
    (sequence.participants || []).forEach((participant) => {
      if (!participant.ref) return;
      if (participant.refType) indexes.pendingRefs.push({ sourceKind: subjectKind(participant.refType), sourceRef: participant.ref, targetNodeId: sequenceNodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "时序参与方", required: true });
      else indexes.pendingGenericRefs.push({ ref: participant.ref, targetNodeId: sequenceNodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "时序参与方（遗留引用）", required: true });
    });
    (sequence.messages || []).forEach((message) => {
      const messageObjectId = `${sequence.id}::${message.id}`;
      const messageNodeId = graph.addNode({ resource: "ov6c", objectId: messageObjectId, kind: "sequence-message", viewId: "ov6c", label: message.name || message.id, status: message.state === "ready" ? "confirmed" : "pending_review" });
      indexes.message.set(message.id, messageNodeId);
      graph.addLink({ sourceNodeId: sequenceNodeId, targetNodeId: messageNodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "时序消息" });
      (message.relatedActivityRefs || []).forEach((ref) => indexes.pendingRefs.push({ sourceKind: "activity", sourceRef: ref, targetNodeId: messageNodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "消息关联活动", required: true }));
      (message.ruleRefs || []).forEach((ref) => indexes.pendingRefs.push({ sourceKind: "rule", sourceRef: ref, targetNodeId: messageNodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "消息受规则约束", required: true }));
      (message.stateTransitionRefs || []).forEach((ref) => indexes.pendingRefs.push({ sourceKind: "transition", sourceRef: ref, targetNodeId: messageNodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "消息关联状态转换", required: true }));
    });
  });
}

function addOrganizationNodes(graph, indexes, ov4, roots) {
  (ov4.roles || []).forEach((role) => {
    const nodeId = graph.addNode({ resource: "ov4", objectId: role.id, kind: "organization-role", viewId: "ov4", label: role.label || role.id, status: role.state === "ready" ? "confirmed" : "pending_review" });
    indexes.organization.set(role.id, nodeId);
    graph.addLink({ sourceNodeId: roots.ov4, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "组织角色" });
    (role.activityIds || []).forEach((ref) => indexes.pendingRefs.push({ sourceKind: "activity", sourceRef: ref, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "角色执行活动", required: true }));
    for (const ref of role.forceRefs || []) indexes.pendingRefs.push({ sourceKind: "force", sourceRef: ref, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "兵力组织角色", required: true });
    for (const ref of role.taskRefs || []) indexes.pendingRefs.push({ sourceKind: "task", sourceRef: ref, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "组织角色承接任务", required: true });
  });
  (ov4.relations || []).forEach((relation) => indexes.pendingRefs.push({ sourceKind: "organization", sourceRef: relation.sourceRoleId, targetKind: "organization", ref: relation.targetRoleId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: relation.relationshipType || "组织关系", required: true }));
}

function addResourceFlowNodes(graph, indexes, ov2, ov3, roots) {
  (ov2.nodes || []).forEach((node) => {
    const nodeId = graph.addNode({ resource: "ov2", objectId: node.id, kind: "resource-node", viewId: "ov2", label: node.label || node.id, status: "pending_review" });
    indexes.resourceNode.set(node.id, nodeId);
    graph.addLink({ sourceNodeId: roots.ov2, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "资源流节点" });
    if (node.sourceOv1NodeId) indexes.pendingRefs.push({ sourceKind: "ov1", sourceRef: node.sourceOv1NodeId, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "总体图资源节点", required: true });
    for (const ref of node.forceRefs || []) indexes.pendingRefs.push({ sourceKind: "force", sourceRef: ref, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "兵力资源节点", required: true });
    for (const ref of node.taskRefs || []) indexes.pendingRefs.push({ sourceKind: "task", sourceRef: ref, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "资源节点承接任务", required: true });
    (node.activityIds || []).forEach((ref) => indexes.pendingRefs.push({ sourceKind: "activity", sourceRef: ref, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "节点承接活动", required: true }));
  });
  (ov2.exchanges || []).forEach((exchange) => {
    const nodeId = graph.addNode({ resource: "ov2", objectId: exchange.id, kind: "resource-exchange", viewId: "ov2", label: exchange.label || exchange.id, status: "pending_review" });
    indexes.exchange.set(exchange.id, nodeId);
    graph.addLink({ sourceNodeId: roots.ov2, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "资源交换" });
    indexes.pendingRefs.push({ sourceKind: "resourceNode", sourceRef: exchange.sourceNodeId, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "交换发送方", required: true });
    indexes.pendingRefs.push({ sourceKind: "resourceNode", sourceRef: exchange.targetNodeId, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "交换接收方", required: true });
    if (exchange.sourceForceRef) indexes.pendingRefs.push({ sourceKind: "force", sourceRef: exchange.sourceForceRef, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "交换发送兵力", required: true });
    if (exchange.targetForceRef) indexes.pendingRefs.push({ sourceKind: "force", sourceRef: exchange.targetForceRef, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "交换接收兵力", required: true });
    for (const ref of exchange.taskRefs || []) indexes.pendingRefs.push({ sourceKind: "task", sourceRef: ref, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "交换关联任务", required: true });
    if (exchange.sourceActivityId) indexes.pendingRefs.push({ sourceKind: "activity", sourceRef: exchange.sourceActivityId, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "交换来源活动", required: true });
    if (exchange.targetActivityId) indexes.pendingRefs.push({ sourceKind: "activity", sourceRef: exchange.targetActivityId, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "交换目标活动", required: true });
  });
  (ov3.exchanges || []).forEach((exchange) => {
    const nodeId = graph.addNode({ resource: "ov3", objectId: exchange.id, kind: "resource-matrix-row", viewId: "ov3", label: `${exchange.sourceActivityTitle || exchange.sourceActivityId} → ${exchange.targetActivityTitle || exchange.targetActivityId}`, status: exchange.compatibility === "ready" ? "confirmed" : "pending_review" });
    indexes.matrixRow.set(exchange.id, nodeId);
    graph.addLink({ sourceNodeId: roots.ov3, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "资源流矩阵行" });
    const sourceExchange = indexes.exchange.get(exchange.sourceExchangeRef || exchange.id);
    if (sourceExchange) graph.addLink({ sourceNodeId: sourceExchange, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "OV2 矩阵投影" });
    else graph.addDiagnostic({ code: "projection_source_missing", severity: "warning", message: `OV3 行「${exchange.id}」没有同 id 的 OV2 交换来源`, targetNodeId: nodeId });
    const sourceFact = (ov2.exchanges || []).find((item) => item.id === (exchange.sourceExchangeRef || exchange.id));
    if (sourceFact && (
      clean(sourceFact.output) !== clean(exchange.output)
      || clean(sourceFact.input) !== clean(exchange.input)
      || clean(sourceFact.flowType) !== clean(exchange.edgeType)
    )) graph.addDiagnostic({ code: "projection_drift", severity: "warning", message: `OV3 行「${exchange.id}」与 OV2 源交换不一致，应重新投影`, targetNodeId: nodeId });
  });
}

function addOptionalMappingNodes(graph, indexes, state, roots) {
  for (const item of optionalItems(state.ov1b, ["nodes", "decompositions", "tasks"])) {
    const id = clean(item?.id) || `ov1b-${indexes.ov1b.size + 1}`;
    const nodeId = graph.addNode({ resource: "ov1b", objectId: id, kind: "task-decomposition", viewId: "ov1b", label: clean(item?.label || item?.title || item?.name) || id, status: statusFromItem(item) });
    indexes.ov1b.set(id, nodeId);
    graph.addLink({ sourceNodeId: roots.ov1b, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "任务分解项" });
    const parentTaskRef = clean(item?.parentTaskRef || item?.parentTaskId);
    const childTaskRef = clean(item?.childTaskRef || item?.childTaskId || item?.taskRef || item?.taskId);
    if (parentTaskRef) indexes.pendingRefs.push({ sourceKind: "task", sourceRef: parentTaskRef, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "父任务分解来源", required: true });
    if (childTaskRef) indexes.pendingRefs.push({ sourceKind: "task", sourceRef: childTaskRef, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "子任务分解引用", required: true });
  }
  for (const item of optionalItems(state.ov1c, ["mappings", "relations"])) {
    const id = clean(item?.id) || `ov1c-${indexes.ov1c.size + 1}`;
    const nodeId = graph.addNode({ resource: "ov1c", objectId: id, kind: "task-activity-mapping", viewId: "ov1c", label: clean(item?.label || item?.note) || id, status: statusFromItem(item) });
    indexes.ov1c.set(id, nodeId);
    graph.addLink({ sourceNodeId: roots.ov1c, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "任务活动映射" });
    const taskRef = clean(item?.taskRef || item?.taskId);
    if (taskRef) indexes.pendingRefs.push({ sourceKind: "task", sourceRef: taskRef, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "映射任务", required: true });
    for (const ref of uniqueStrings(item?.activityRefs || item?.activityIds)) indexes.pendingRefs.push({ sourceKind: "activity", sourceRef: ref, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "映射活动", required: true });
  }
  for (const item of optionalItems(state.ov7, ["mappings", "relations"])) {
    const id = clean(item?.id) || `ov7-${indexes.ov7.size + 1}`;
    const nodeId = graph.addNode({ resource: "ov7", objectId: id, kind: "state-activity-mapping", viewId: "ov7", label: clean(item?.label || item?.note) || id, status: statusFromItem(item) });
    indexes.ov7.set(id, nodeId);
    graph.addLink({ sourceNodeId: roots.ov7, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "状态活动映射" });
    const subjectType = clean(item?.subjectType || item?.sourceType);
    const sourceRef = clean(item?.sourceRef || item?.stateRef || item?.transitionRef || item?.stateTransitionRef);
    if (sourceRef) indexes.pendingRefs.push({ sourceKind: subjectType === "state" ? "state" : "transition", sourceRef, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: subjectType === "state" ? "映射状态" : "映射状态转换", required: true });
    for (const ref of uniqueStrings(item?.activityRefs || item?.activityIds)) indexes.pendingRefs.push({ sourceKind: "activity", sourceRef: ref, targetNodeId: nodeId, relationType: MODEL_RELATION_TYPES.BINDS_TO, semantic: "映射活动", required: true });
  }
}

function compileExplicitReferences(graph, indexes) {
  for (const item of indexes.pendingRefs) {
    const sourceNodeId = item.sourceNodeId || indexes[item.sourceKind]?.get(item.sourceRef);
    const targetNodeId = item.targetNodeId || indexes[item.targetKind]?.get(item.ref);
    if (!sourceNodeId || !targetNodeId) {
      if (item.required || item.sourceRef || item.ref) graph.addDiagnostic({
        code: "orphan_reference",
        severity: "error",
        message: `无法解析${item.semantic || "模型引用"}：${item.sourceRef || item.ref || "空引用"}`,
        sourceNodeId: sourceNodeId || item.sourceNodeId || "",
        targetNodeId: targetNodeId || item.targetNodeId || "",
        ref: item.sourceRef || item.ref || ""
      });
      continue;
    }
    graph.addLink({ sourceNodeId, targetNodeId, relationType: item.relationType, semantic: item.semantic, status: normalizeLinkStatus(item.status) });
  }
  for (const item of indexes.pendingGenericRefs) {
    const candidates = genericRefCandidates(indexes, item.ref);
    if (candidates.length === 1) {
      graph.addLink({ sourceNodeId: candidates[0], targetNodeId: item.targetNodeId, relationType: item.relationType, semantic: item.semantic });
    } else {
      graph.addDiagnostic({
        code: candidates.length ? "ambiguous_reference" : "orphan_reference",
        severity: "error",
        message: candidates.length ? `引用「${item.ref}」匹配多个模型对象` : `无法解析${item.semantic || "模型引用"}：${item.ref}`,
        targetNodeId: item.targetNodeId,
        ref: item.ref
      });
    }
  }
  for (const item of indexes.pendingSourceRefs) {
    const candidates = resourceRefCandidates(indexes, item.resource, item.objectId);
    if (candidates.length === 1) {
      graph.addLink({ sourceNodeId: candidates[0], targetNodeId: item.targetNodeId, relationType: MODEL_RELATION_TYPES.DERIVED_FROM, semantic: "显式来源引用" });
    } else {
      graph.addDiagnostic({ code: "orphan_reference", severity: "error", message: `无法解析来源 ${item.resource}:${item.objectId}`, targetNodeId: item.targetNodeId, ref: item.objectId });
    }
  }
}

function createGraph() {
  const nodes = [];
  const links = [];
  const diagnostics = [];
  const nodeById = new Map();
  const linkKeys = new Set();
  const diagnosticKeys = new Set();
  return {
    addNode(node) {
      const resource = clean(node.resource);
      const objectId = clean(node.objectId) || ROOT;
      const id = modelNodeId(resource, objectId);
      if (!nodeById.has(id)) {
        const normalized = { id, resource, objectId, kind: clean(node.kind) || "object", viewId: clean(node.viewId), label: clean(node.label) || objectId, status: normalizeContextStatus(node.status), count: Number(node.count) || 0 };
        nodeById.set(id, normalized);
        nodes.push(normalized);
      }
      return id;
    },
    addLink(link) {
      if (!nodeById.has(link.sourceNodeId) || !nodeById.has(link.targetNodeId) || link.sourceNodeId === link.targetNodeId) return "";
      const relationType = Object.values(MODEL_RELATION_TYPES).includes(link.relationType) ? link.relationType : MODEL_RELATION_TYPES.BINDS_TO;
      const semantic = clean(link.semantic) || relationType;
      const key = `${link.sourceNodeId}|${link.targetNodeId}|${relationType}|${semantic}`;
      if (linkKeys.has(key)) return key;
      linkKeys.add(key);
      links.push({ id: `link-${links.length + 1}`, sourceNodeId: link.sourceNodeId, targetNodeId: link.targetNodeId, source: endpoint(nodeById.get(link.sourceNodeId)), target: endpoint(nodeById.get(link.targetNodeId)), relationType, semantic, status: normalizeLinkStatus(link.status) });
      return key;
    },
    addDiagnostic(item) {
      const code = clean(item.code) || "topology_issue";
      const key = `${code}|${clean(item.sourceNodeId)}|${clean(item.targetNodeId)}|${clean(item.ref)}|${clean(item.message)}`;
      if (diagnosticKeys.has(key)) return;
      diagnosticKeys.add(key);
      diagnostics.push({ id: `topology-${diagnostics.length + 1}`, code, severity: ["info", "warning", "error"].includes(item.severity) ? item.severity : "warning", message: clean(item.message) || code, sourceNodeId: clean(item.sourceNodeId), targetNodeId: clean(item.targetNodeId), ref: clean(item.ref) });
    },
    finish(rootIds) {
      return {
        version: 1,
        generatedAt: new Date().toISOString(),
        nodes,
        links,
        diagnostics,
        rootIds: { ...rootIds },
        summary: {
          nodeCount: nodes.length,
          linkCount: links.length,
          derivedCount: links.filter((item) => item.relationType === MODEL_RELATION_TYPES.DERIVED_FROM).length,
          bindingCount: links.filter((item) => item.relationType === MODEL_RELATION_TYPES.BINDS_TO).length,
          feedbackCount: links.filter((item) => item.relationType === MODEL_RELATION_TYPES.FEEDBACK_TO).length,
          errorCount: diagnostics.filter((item) => item.severity === "error").length,
          warningCount: diagnostics.filter((item) => item.severity === "warning").length
        }
      };
    }
  };
}

function createIndexes() {
  return {
    phase: new Map(), task: new Map(), force: new Map(), ov1: new Map(), mapItem: new Map(), activity: new Map(), rule: new Map(), machine: new Map(), state: new Map(), transition: new Map(), sequence: new Map(), message: new Map(), organization: new Map(), resourceNode: new Map(), exchange: new Map(), matrixRow: new Map(), ov1b: new Map(), ov1c: new Map(), ov7: new Map(),
    pendingRefs: [], pendingGenericRefs: [], pendingSourceRefs: []
  };
}

function productStatus(key, state, { count, phaseAction, forceMission }) {
  const storageKey = ({ phase: "phaseActionStorage", task: "forceMissionStorage", force: "forceMissionStorage", conceptMap: "conceptMapStorage", simulation: "scenarioStorage" })[key] || `${key}Storage`;
  if (state[storageKey]?.stale) return "stale";
  if (!count) return "empty";
  if (key === "brief") return count >= 6 ? "confirmed" : "partial";
  if (key === "phase") return phaseAction.status === "confirmed" ? "confirmed" : "pending_review";
  if (key === "task") return forceMission.tasksConfirmedAt ? "confirmed" : "pending_review";
  if (key === "force") return forceMission.status === "confirmed" ? "confirmed" : "pending_review";
  if (key === "conceptMap") return state.conceptMap?.reference?.status === "confirmed" ? "confirmed" : "pending_review";
  if (state[key]?.status === "confirmed" || state[key]?.confirmedAt) return "confirmed";
  return "pending_review";
}

function subjectKind(value) {
  return ({ phase: "phase", task: "task", force: "force", object: "force" })[clean(value)] || clean(value) || "force";
}

function genericRefCandidates(indexes, ref) {
  return [...new Set(["phase", "task", "force", "ov1", "mapItem", "activity", "rule", "transition", "organization", "resourceNode"].map((kind) => indexes[kind].get(ref)).filter(Boolean))];
}

function resourceRefCandidates(indexes, resource, objectId) {
  const kindByResource = { phaseActionConcept: "phase", forceMissionPlan: "force", ov1: "ov1", conceptMap: "mapItem", ov5: "activity", ov6a: "rule", ov6b: "machine", ov6c: "sequence", ov4: "organization", ov2: "exchange", ov1b: "ov1b", ov1c: "ov1c", ov7: "ov7" };
  const kind = kindByResource[clean(resource)];
  if (!kind) return [];
  const direct = indexes[kind]?.get(clean(objectId));
  if (direct) return [direct];
  if (resource === "forceMissionPlan") return [indexes.task.get(objectId), indexes.force.get(objectId)].filter(Boolean);
  return [];
}

function normalizeNamedBindings(values, kind) {
  return (Array.isArray(values) ? values : []).map((item) => ({ ref: clean(typeof item === "string" ? item : item?.[`${kind}Ref`] || item?.[`${kind}Id`] || item?.ref), status: clean(item?.bindingStatus || item?.status) })).filter((item) => item.ref);
}

function normalizeSourceRefs(values) {
  return (Array.isArray(values) ? values : []).map((item) => ({ resource: clean(item?.resource), objectId: clean(item?.objectId || item?.id) })).filter((item) => item.resource && item.objectId);
}

function normalizeLinkStatus(value) {
  const status = clean(value);
  if (["stale", "conflict", "rejected"].includes(status)) return status === "rejected" ? "conflict" : status;
  if (["verified", "confirmed", "ready"].includes(status)) return "confirmed";
  return "pending_review";
}

function normalizeContextStatus(value) {
  const status = clean(value);
  return MODEL_CONTEXT_STATUSES.includes(status) ? status : "pending_review";
}

function contextResult(status, coverageCount, totalCount, diagnostics) {
  return { status: normalizeContextStatus(status), coverageCount: Number(coverageCount) || 0, totalCount: Number(totalCount) || 0, diagnostics: Array.isArray(diagnostics) ? diagnostics : [] };
}

function endpoint(node) {
  return { resource: node.resource, objectId: node.objectId };
}

function countBriefFields(brief) {
  return ["researchIntent", "objective", "approach", "assumptions", "expectedEffects", "risk"].filter((key) => clean(brief?.[key])).length;
}

function safeNormalize(normalizer, value, fallback) {
  try {
    return normalizer(value);
  } catch {
    return fallback;
  }
}

function collectionSize(value, keys) {
  return optionalItems(value, keys).length;
}

function optionalItems(value, keys) {
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key];
  return [];
}

function statusFromItem(item) {
  const status = clean(item?.status);
  if (MODEL_CONTEXT_STATUSES.includes(status)) return status;
  return item?.confirmedAt ? "confirmed" : "pending_review";
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))];
}

function clean(value) {
  return String(value ?? "").trim();
}
