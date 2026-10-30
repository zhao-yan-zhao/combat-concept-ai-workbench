import assert from "node:assert/strict";
import { isStepGenerated, isStepStale, resolveWorkflowGateContext } from "../design-studio/src/app/workflowGate.js";
import { resolveRelatedMainViewId, inferRelatedMainViewId } from "../design-studio/src/contextualModelFlow.js";

console.log("Testing Task Flow Rule Generation & Context Isolation...");

// 1. Verify parent mainViewId resolution from ov1b
const inferred = inferRelatedMainViewId("ov6a", "ov1b");
assert.ok(inferred === "force-mission" || inferred === "operational-task", "When preferredMainViewId is 'ov1b', it should resolve to 'force-mission' or legacy 'operational-task'");

const resolved = resolveRelatedMainViewId("ov1b", "ov6a");
assert.ok(resolved === "force-mission" || resolved === "operational-task", "resolveRelatedMainViewId('ov1b', 'ov6a') must resolve to 'force-mission' or legacy 'operational-task'");

// 2. State where global rules exist (from Brief), but task rules are NOT yet generated
const stateWithBriefRulesOnly = {
  activeProjectId: "test-proj",
  activeView: "ov1b",
  relatedModelReturnContext: { mainViewId: "operational-task", relatedViewId: "ov1b" },
  projectDirectory: { projects: [{ id: "test-proj", workflow: { version: 2, completedThrough: 2, mode: "gated" } }] },
  workflowCompleting: false,
  forceMission: {
    tasks: [{ id: "t1", name: "夺控节点" }],
    tasksConfirmedAt: "2026-10-27T10:00:00Z"
  },
  ov1b: {
    groups: [{ id: "g1", name: "先遣突击组", taskRefs: ["t1"] }]
  },
  ov6a: {
    rules: [
      { id: "r-global-1", name: "空域安全隔离规则", scope: "全局", description: "阶段/简报规则" }
    ],
    ruleChangeSet: null
  },
  ov6b: {
    stateMachines: [
      { id: "sm-phase-1", subjectType: "phase", name: "阶段状态机" }
    ]
  },
  ov6c: {
    sequences: [
      { id: "seq-phase-1", diagramType: "phase", name: "阶段时序" }
    ]
  }
};

// In operational-task context, ov6a should NOT be marked as generated because task rules are missing
const ov6aGeneratedForTask = isStepGenerated("ov6a", stateWithBriefRulesOnly, { mainViewId: "operational-task" });
assert.equal(ov6aGeneratedForTask, false, "ov6a should NOT be marked as generated for operational-task when only global brief rules exist");

// ov6b and ov6c should also NOT be marked as generated for operational-task when only phase items exist
const ov6bGeneratedForTask = isStepGenerated("ov6b", stateWithBriefRulesOnly, { mainViewId: "operational-task" });
assert.equal(ov6bGeneratedForTask, false, "ov6b should NOT be marked as generated for operational-task when no task machine exists");

const ov6cGeneratedForTask = isStepGenerated("ov6c", stateWithBriefRulesOnly, { mainViewId: "operational-task" });
assert.equal(ov6cGeneratedForTask, false, "ov6c should NOT be marked as generated for operational-task when no task sequence exists");

// In ov1b, the next related step is ov6a
const gateContext = resolveWorkflowGateContext(stateWithBriefRulesOnly);
assert.equal(gateContext.mode, "related-next-step");
assert.equal(gateContext.nextStep.id, "ov6a");
assert.ok(gateContext.nextStep.mainViewId === "force-mission" || gateContext.nextStep.mainViewId === "operational-task");
assert.equal(gateContext.nextGenerated, false, "Next step (ov6a) from ov1b should not be treated as already generated");
assert(!gateContext.capsuleAction.includes("(已生成)"), "Capsule label should not have '(已生成)' when task rules are not yet generated");
assert(gateContext.hint.includes("继续关联流程") || gateContext.hint.includes("规则库"), "Gate hint should guide user to generate rules for tasks");

// 3. State where task rules HAVE been generated (via taskBindings or ruleChangeSet)
const stateWithTaskRules = {
  ...stateWithBriefRulesOnly,
  ov6a: {
    rules: [
      { id: "r-global-1", name: "空域安全隔离规则", scope: "全局" },
      { id: "r-task-1", name: "夺控作业约束", scope: "任务", taskBindings: ["t1"] }
    ],
    ruleChangeSet: {
      source: "operational-task",
      changes: [{ id: "c1", status: "applied", rule: { name: "夺控作业约束" } }]
    }
  },
  ov6b: {
    stateMachines: [
      { id: "sm-phase-1", subjectType: "phase" },
      { id: "sm-task-1", subjectType: "task", name: "夺控任务状态机" }
    ]
  },
  ov6c: {
    sequences: [
      { id: "seq-phase-1", diagramType: "phase" },
      { id: "seq-task-1", diagramType: "task", name: "夺控任务时序图" }
    ]
  }
};

const ov6aGeneratedWithTask = isStepGenerated("ov6a", stateWithTaskRules, { mainViewId: "operational-task" });
assert.equal(ov6aGeneratedWithTask, true, "ov6a should be marked as generated for operational-task when taskBindings exist");

const ov6bGeneratedWithTask = isStepGenerated("ov6b", stateWithTaskRules, { mainViewId: "operational-task" });
assert.equal(ov6bGeneratedWithTask, true, "ov6b should be marked as generated for operational-task when task state machine exists");

const ov6cGeneratedWithTask = isStepGenerated("ov6c", stateWithTaskRules, { mainViewId: "operational-task" });
assert.equal(ov6cGeneratedWithTask, true, "ov6c should be marked as generated for operational-task when task sequence exists");

const gateContextWithTaskRules = resolveWorkflowGateContext(stateWithTaskRules);
assert.equal(gateContextWithTaskRules.nextGenerated, true, "Next step (ov6a) should be marked as generated when task rules exist");
assert(gateContextWithTaskRules.capsuleAction.includes("(已生成)"), "Capsule label should show '(已生成)' once task rules exist");

console.log("All task flow rule generation and context isolation checks passed successfully!");
