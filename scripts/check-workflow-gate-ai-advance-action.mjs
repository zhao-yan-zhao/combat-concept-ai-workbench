import assert from "node:assert/strict";
import { renderWorkflowGate, resolveWorkflowGateContext } from "../design-studio/src/app/workflowGate.js";

console.log("Testing Workflow Gate AI Advance Action & Dispatch Contract...");

// Case 1: In operational-task contextual subflow at ov6b (state machine), next step is ov6c (sequence)
const stateOv6bTaskContext = {
  activeProjectId: "test-proj",
  activeView: "ov6b",
  workflowGateOpen: true,
  projectDirectory: { projects: [{ id: "test-proj", workflow: { version: 2, completedThrough: 2, mode: "gated" } }] },
  workflowCompleting: false,
  relatedModelReturnContext: { mainViewId: "operational-task", relatedViewId: "ov6b" },
  forceMission: {
    tasks: [{ id: "t1", name: "夺控节点" }],
    tasksConfirmedAt: "2026-10-27T10:00:00Z"
  },
  ov6a: {
    rules: [{ id: "r1", name: "任务协同规则", scope: "任务:t1", taskBindings: ["t1"] }]
  },
  ov6b: {
    stateMachines: [{ id: "sm-1", name: "夺控节点状态机", subjectType: "task" }]
  },
  ov6c: {
    sequences: [] // Not generated yet
  }
};

const ctx = resolveWorkflowGateContext(stateOv6bTaskContext);
assert.equal(ctx.mode, "related-next-step", "Gate mode must be related-next-step");
assert.equal(ctx.nextStep?.id, "ov6c", "Next step must be ov6c");
assert.equal(ctx.action, "advance-related-workflow", "Action must be advance-related-workflow");
assert.equal(ctx.nextGenerated, false, "ov6c should not be marked as generated yet");

const html = renderWorkflowGate(stateOv6bTaskContext);
assert(html.includes('data-action="advance-related-workflow"'), "Buttons must dispatch advance-related-workflow directly");
assert(html.includes('data-step-intent="ai"'), "AI generate button must carry data-step-intent='ai'");
assert(html.includes('data-step-intent="direct"'), "Direct enter button must carry data-step-intent='direct'");
assert(html.includes("AI生成并进入"), "Primary button must label 'AI生成并进入'");
assert(html.includes("直接进入"), "Secondary button must label '直接进入'");

// Case 2: Once generated, regenerate button should also carry correct action & intent
const stateOv6bGenerated = {
  ...stateOv6bTaskContext,
  ov6c: {
    sequences: [{ id: "seq-1", name: "夺控节点时序图", diagramType: "task" }]
  }
};

const ctxGenerated = resolveWorkflowGateContext(stateOv6bGenerated);
assert.equal(ctxGenerated.nextGenerated, true, "ov6c should be recognized as generated");
const htmlGenerated = renderWorkflowGate(stateOv6bGenerated);
assert(htmlGenerated.includes('data-step-intent="regenerate"'), "Regenerate button must carry data-step-intent='regenerate'");
assert(htmlGenerated.includes("重新生成"), "Must render regenerate option");
assert(htmlGenerated.includes("跳过"), "Must render skip/view option");

console.log("All workflow gate AI advance action contract checks passed successfully!");
