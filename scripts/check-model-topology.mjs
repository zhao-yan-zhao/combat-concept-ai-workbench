import assert from "node:assert/strict";
import {
  buildModelTopology,
  getModelContextStatus,
  MODEL_RELATION_TYPES,
  modelNodeId
} from "../shared/modelTopology.js";

const fixture = {
  brief: {
    researchIntent: "研究意图",
    objective: "研究目标",
    approach: "研究路线",
    assumptions: "关键假设",
    expectedEffects: "预期效果",
    risk: "主要风险"
  },
  phaseAction: {
    status: "confirmed",
    confirmedAt: "2026-08-18T00:00:00.000Z",
    phases: [
      { id: "phase-1", name: "阶段一", objective: "建立条件", blueActions: ["行动一"] },
      { id: "phase-2", name: "阶段二", objective: "达成效果", blueActions: ["行动二"] }
    ]
  },
  forceMission: {
    status: "confirmed",
    confirmedAt: "2026-08-18T00:00:00.000Z",
    tasksConfirmedAt: "2026-08-18T00:00:00.000Z",
    tasks: [
      { id: "task-1", name: "任务一", side: "friendly", phaseId: "phase-1", objective: "完成任务", missionType: "Support Mission", area: "区域一" }
    ],
    forces: [
      { id: "force-1", name: "概念兵力一", side: "friendly", role: "command", task: "承接任务", phaseIds: ["phase-1"] }
    ],
    combatForces: [
      { id: "combat-1", name: "作战兵力一", side: "friendly", role: "command", task: "执行任务", phaseIds: ["phase-1"], conceptForceId: "force-1", missionType: "Support Mission" }
    ]
  },
  ov1: {
    nodes: [{ id: "ov1-1", label: "总体节点一", kind: "command" }],
    edges: []
  },
  conceptMap: {
    reference: { status: "confirmed" },
    document: { items: [{ id: "map-1", label: "地图对象一" }] }
  },
  ov5: {
    activities: [{ id: "activity-1", title: "活动一", sourceOv1NodeIds: ["ov1-1"] }],
    edges: []
  },
  ov6a: {
    rules: [{
      id: "rule-1",
      name: "规则一",
      description: "规则描述",
      phaseBindings: [{ phaseRef: "phase-1" }],
      taskBindings: [{ taskRef: "task-1", bindingStatus: "verified" }],
      forceBindings: [{ forceRef: "combat-1", bindingStatus: "verified" }],
      activityBindings: [{ activityRef: "activity-1", bindingStatus: "verified" }]
    }]
  },
  ov6b: {
    stateMachines: [{
      id: "machine-task-1",
      subjectType: "task",
      subjectRef: "task-1",
      name: "任务一状态机",
      states: [
        { id: "s1", name: "开始", kind: "initial" },
        { id: "s2", name: "执行", kind: "normal" },
        { id: "s3", name: "结束", kind: "final" }
      ],
      transitions: [
        { id: "transition-1", fromStateRef: "s1", toStateRef: "s2", condition: "条件一", ruleRefs: ["rule-1"] },
        { id: "transition-2", fromStateRef: "s2", toStateRef: "s3", condition: "条件二" }
      ]
    }]
  },
  ov6c: {
    sequences: [{
      id: "sequence-1",
      name: "任务协同时序",
      diagramType: "task",
      participants: [{ id: "participant-1", name: "任务一", ref: "task-1" }],
      messages: [{ id: "message-1", fromRef: "participant-1", toRef: "participant-1", name: "消息一", relatedActivityRefs: ["activity-1"], ruleRefs: ["rule-1"], stateTransitionRefs: ["transition-1"] }]
    }]
  },
  ov4: { roles: [], relations: [], diagrams: [] },
  ov2: { nodes: [], exchanges: [] },
  ov3: { activities: [], exchanges: [] },
  scenario: { entities: [{ id: "entity-1" }], timeline: [] }
};

const topology = buildModelTopology(fixture);

assert.equal(topology.version, 1);
assert(topology.nodes.some((node) => node.id === modelNodeId("brief")));
assert(topology.nodes.some((node) => node.id === modelNodeId("forceMissionPlan", "$tasks")));
assert(topology.links.some((link) => link.sourceNodeId === modelNodeId("ov1") && link.targetNodeId === modelNodeId("conceptMap") && link.relationType === MODEL_RELATION_TYPES.DERIVED_FROM));
assert(topology.links.some((link) => link.sourceNodeId === modelNodeId("forceMissionPlan", "task-1") && link.targetNodeId === modelNodeId("ov6a", "rule-1")));
assert(topology.links.some((link) => link.sourceNodeId === modelNodeId("forceMissionPlan", "task-1") && link.targetNodeId === modelNodeId("ov6b", "machine-task-1")));
assert(topology.links.some((link) => link.sourceNodeId === modelNodeId("forceMissionPlan", "task-1") && link.targetNodeId === modelNodeId("ov6c", "sequence-1")));
assert(topology.links.some((link) => link.sourceNodeId === modelNodeId("ov1", "ov1-1") && link.targetNodeId === modelNodeId("ov5", "activity-1")));
assert.equal(topology.summary.feedbackCount, 1);
assert.equal(topology.summary.errorCount, 0, topology.diagnostics.map((item) => item.message).join("\n"));

const ruleStatus = getModelContextStatus(topology, { focusType: "task", focusId: "task-1", targetViewId: "ov6a" });
assert.equal(ruleStatus.status, "pending_review");
assert.equal(ruleStatus.coverageCount, 1);

const stateStatus = getModelContextStatus(topology, { focusType: "task", focusId: "task-1", targetViewId: "ov6b" });
assert.equal(stateStatus.status, "pending_review");
assert.equal(stateStatus.coverageCount, 1);

const emptyResourceStatus = getModelContextStatus(topology, { focusType: "force", focusId: "combat-1", targetViewId: "ov2" });
assert.equal(emptyResourceStatus.status, "empty");

const orphanTopology = buildModelTopology({
  ...fixture,
  ov6b: {
    stateMachines: [{ id: "orphan-machine", subjectType: "task", subjectRef: "missing-task", name: "悬空状态机", states: [], transitions: [] }]
  }
});
assert(orphanTopology.diagnostics.some((item) => item.code === "orphan_reference" && item.ref === "missing-task"));
assert(orphanTopology.summary.errorCount > 0);

console.log("model-topology checks passed");
