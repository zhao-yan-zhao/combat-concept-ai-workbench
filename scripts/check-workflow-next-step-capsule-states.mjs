import assert from "node:assert/strict";
import { renderWorkflowGate, resolveWorkflowGateContext, isStepGenerated, isStepStale, resolveCurrentStepQuickActions } from "../design-studio/src/app/workflowGate.js";

console.log("Testing Workflow Next Step Capsule States & Gate Hub...");

const completeBrief = {
  researchIntent: "意图",
  objective: "目标",
  approach: "路线",
  assumptions: "假设",
  expectedEffects: "效果",
  risk: "风险"
};

const confirmedPhase = {
  phaseAction: {
    status: "confirmed",
    phases: [
      { id: "p1", name: "阶段一", blueActions: [{ id: "a1", name: "行动1" }] },
      { id: "p2", name: "阶段二", blueActions: [{ id: "a2", name: "行动2" }] }
    ]
  }
};

// Case 1: Un-generated downstream
const stateNotGenerated = {
  activeProjectId: "test-proj",
  activeView: "phase-action",
  projectDirectory: { projects: [{ id: "test-proj", workflow: { version: 2, completedThrough: 1, mode: "gated" } }] },
  workflowCompleting: false,
  brief: completeBrief,
  ...confirmedPhase,
  forceMission: { tasks: [] }, // empty operational tasks
  ov6a: { rules: [] }
};

const ctx1 = resolveWorkflowGateContext(stateNotGenerated);
assert(ctx1.nextGenerated === false, "Downstream with empty rules/tasks should be marked as !nextGenerated");
const gateHtml1 = renderWorkflowGate(stateNotGenerated);
assert(gateHtml1.includes("AI生成并进入"), "Un-generated downstream should offer 'AI生成并进入' as primary");
assert(gateHtml1.includes("直接进入"), "Un-generated downstream should offer '直接进入' as secondary");
assert(!gateHtml1.includes("(已生成)"), "Capsule should not say '(已生成)' when downstream is not generated");

// Case 2: Generated & fresh downstream
const stateGeneratedFresh = {
  activeProjectId: "test-proj",
  activeView: "phase-action",
  projectDirectory: { projects: [{ id: "test-proj", workflow: { version: 2, completedThrough: 1, mode: "gated" } }] },
  workflowCompleting: false,
  brief: completeBrief,
  ...confirmedPhase,
  phaseActionStorage: { stale: false },
  ov6a: { rules: [{ id: "r1", name: "规则1" }] }
};

const ctx2 = resolveWorkflowGateContext(stateGeneratedFresh);
assert(ctx2.nextGenerated === true, "Downstream with rules should be marked as nextGenerated");
assert(ctx2.nextStale === false, "Fresh downstream should be marked as !nextStale");
const gateHtml2 = renderWorkflowGate(stateGeneratedFresh);
assert(gateHtml2.includes("跳过（查看已有成果）") || gateHtml2.includes("跳过"), "Generated fresh downstream should offer '跳过' as primary");
assert(gateHtml2.includes("重新生成"), "Generated fresh downstream should offer '重新生成' as secondary");
assert(gateHtml2.includes("(已生成)"), "Capsule should say '(已生成)' when downstream is generated");

// Case 3: Generated but stale downstream (upstream modified)
const stateGeneratedStale = {
  activeProjectId: "test-proj",
  activeView: "phase-action",
  projectDirectory: { projects: [{ id: "test-proj", workflow: { version: 2, completedThrough: 1, mode: "gated" } }] },
  workflowCompleting: false,
  brief: completeBrief,
  ...confirmedPhase,
  phaseActionStorage: { stale: false },
  ov6a: {
    rules: [{ id: "r1", name: "规则1" }],
    ruleChangeSet: {
      changes: [{ id: "c1", status: "pending", action: "add", rule: { name: "新规则" } }]
    }
  }
};

const ctx3 = resolveWorkflowGateContext(stateGeneratedStale);
assert(ctx3.nextGenerated === true, "Downstream with rules should be marked as nextGenerated");
assert(ctx3.nextStale === true, "Downstream with pending rule changes should be marked as nextStale");
assert(ctx3.isStale === true, "ctx.isStale should be true");
const gateHtml3 = renderWorkflowGate(stateGeneratedStale);
assert(gateHtml3.includes("is-stale"), "Shell should receive 'is-stale' class");
assert(gateHtml3.includes("上游有更新"), "Capsule should indicate '(上游有更新)'");
assert(gateHtml3.includes("上游步骤内容已调整，下游成果已过期"), "Panel should render stale warning badge");
assert(gateHtml3.includes("重新生成（覆盖更新）"), "Stale downstream should recommend '重新生成（覆盖更新）'");
assert(gateHtml3.includes("跳过（保留旧版）"), "Stale downstream should offer '跳过（保留旧版）'");

// Case 4: Quick gate actions
const stateWithUnconfirmedPhase = {
  activeProjectId: "test-proj",
  activeView: "phase-action",
  projectDirectory: { projects: [{ id: "test-proj", workflow: { version: 2, completedThrough: 0, mode: "gated" } }] },
  workflowCompleting: false,
  phaseAction: { status: "draft", phases: [{ id: "p1", name: "阶段1" }, { id: "p2", name: "阶段2" }] }
};
const quickActions1 = resolveCurrentStepQuickActions(stateWithUnconfirmedPhase);
assert(quickActions1.some((qa) => qa.action === "workflow-gate-quick-confirm-phase-action"), "Should offer quick confirm for phase-action");

const stateWithRuleChanges = {
  activeProjectId: "test-proj",
  activeView: "ov6a",
  ov6a: {
    rules: [{ id: "r1", name: "规则1" }],
    ruleChangeSet: {
      changes: [{ id: "c1", status: "pending" }]
    }
  }
};
const quickActions2 = resolveCurrentStepQuickActions(stateWithRuleChanges);
assert(quickActions2.some((qa) => qa.action === "workflow-gate-quick-apply-all-rules"), "Should offer quick apply for ov6a pending changes");

console.log("All next-step capsule state and gate hub tests passed successfully!");
