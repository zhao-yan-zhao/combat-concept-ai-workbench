import assert from "node:assert/strict";
import { generateMockOutput } from "../shared/generator.js";
import { createOpenAiClient } from "../server/openaiClient.mjs";
import { ensureTaskRuleCoverage, ensureForceRuleCoverage, ensureTaskAndForceRuleCoverage, applyRuleChangeSet } from "../design-studio/src/ruleLibraryChatController.js";
import { ensureTaskSequenceCoverage, ensureForceSequenceCoverage, buildSequenceGenerationAnalysis, buildStateMachineGenerationAnalysis } from "../design-studio/src/dodafProductController.js";

console.log("Starting check-task-force-ov6-generation test suite...");

// 1. Verify prompt definitions in top menu catalog
const openaiClient = createOpenAiClient({
  getAiServiceConfig: () => ({ model: "mock", baseUrl: "http://localhost" }),
  getAiApiKey: () => "mock",
  getAiPromptOverrides: () => ({})
});
const prompts = openaiClient.listPromptDefinitions();
const requiredPromptIds = [
  "ai.generate.rule-change-set",
  "ai.generate.state-machine",
  "ai.generate.sequence",
  "ai.generate.rule-library"
];
for (const id of requiredPromptIds) {
  const p = prompts.find((item) => item.id === id);
  assert.ok(p, `Prompt definition ${id} must exist in listPromptDefinitions()`);
  assert.ok(p.title || p.name, `Prompt ${id} must have a title or name`);
  assert.ok(p.description, `Prompt ${id} must have a description`);
  assert.ok(Array.isArray(p.variables) && p.variables.length > 0, `Prompt ${id} must list dynamic variables`);
}
console.log("✓ All 4 required AI Prompt definitions verified in catalog");

// 2. Test Rule Library ChangeSet generation & coverage for Tasks
const taskAnalysis = {
  source: "operational-task",
  tasks: [
    { id: "task-strike-1", name: "防空压制打击任务", side: "friendly", objective: "摧毁雷达阵地", expectedEffect: "防空盲区建立" },
    { id: "task-cap-2", name: "战术巡逻掩护任务", side: "friendly", objective: "掩护打击机群", expectedEffect: "制空权夺取" }
  ]
};
const mockTaskRuleResult = generateMockOutput({
  workflow: { id: "rule-library-change-set", title: "规则库变更建议", outputSchema: "RuleLibraryChangeSet" },
  analysis: taskAnalysis,
  evidence: []
}).result;

assert.ok(mockTaskRuleResult?.changes?.length >= 2, "Mock output should generate changes for tasks");
assert.ok(mockTaskRuleResult.changes.some((c) => c.rule?.taskRefs?.includes("task-strike-1")), "Task rules must contain taskRefs");

const coveredTaskRules = ensureTaskRuleCoverage({ changes: [] }, taskAnalysis);
assert.equal(coveredTaskRules.changes.length, 2, "ensureTaskRuleCoverage must cover all tasks");
assert.ok(coveredTaskRules.changes.every((c) => (c.rule?.taskRefs || []).length > 0), "Every generated task rule must have taskRefs");
console.log("✓ Operational task rule generation and coverage verified");

// 3. Test Rule Library ChangeSet generation & coverage for Forces
const forceAnalysis = {
  source: "force-mission",
  combatForces: [
    { id: "combat-force-1", name: "隐身歼击机编队", side: "blue", role: "制空截击", task: "空中巡逻" },
    { id: "combat-force-2", name: "电子战机分队", side: "blue", role: "防空压制", task: "随伴干扰" }
  ],
  forces: []
};
const mockForceRuleResult = generateMockOutput({
  workflow: { id: "rule-library-change-set", title: "规则库变更建议", outputSchema: "RuleLibraryChangeSet" },
  analysis: forceAnalysis,
  evidence: []
}).result;

assert.ok(mockForceRuleResult?.changes?.length >= 2, "Mock output should generate changes for combat forces");
assert.ok(mockForceRuleResult.changes.some((c) => (c.rule?.forceRefs || []).length > 0), "Force rules must contain forceRefs");

const coveredForceRules = ensureForceRuleCoverage({ changes: [] }, forceAnalysis);
assert.equal(coveredForceRules.changes.length, 2, "ensureForceRuleCoverage must cover all combat forces");
assert.ok(coveredForceRules.changes.every((c) => (c.rule?.forceRefs || []).length > 0), "Every generated force rule must have forceRefs");

// 3.1 Test Joint (Task + Force) Rule Coverage
const combinedAnalysis = {
  source: "force-mission",
  tasks: taskAnalysis.tasks,
  combatForces: forceAnalysis.combatForces,
  forces: []
};
const coveredCombinedRules = ensureTaskAndForceRuleCoverage({ changes: [] }, combinedAnalysis);
assert.equal(coveredCombinedRules.changes.length, 4, "ensureTaskAndForceRuleCoverage must cover both 2 tasks and 2 combat forces");
assert.ok(coveredCombinedRules.changes.some((c) => (c.rule?.taskRefs || []).includes("task-strike-1")), "Combined rules must contain task rules");
assert.ok(coveredCombinedRules.changes.some((c) => (c.rule?.forceRefs || []).includes("combat-force-1")), "Combined rules must contain force rules");
const appliedCombinedModel = applyRuleChangeSet({ rules: [], ruleChangeSet: coveredCombinedRules }, coveredCombinedRules);
assert.equal(appliedCombinedModel.rules.length, 4, "Applying combined changeSet must insert 4 rules into model");
assert.ok(appliedCombinedModel.rules.some((r) => r.taskBindings?.length > 0), "Inserted rules must have taskBindings");
assert.ok(appliedCombinedModel.rules.some((r) => r.forceBindings?.length > 0), "Inserted rules must have forceBindings");
console.log("✓ Joint Task & Force rule generation, coverage, and binding application verified");

// Verify applying force rule creates forceBindings
const appliedModel = applyRuleChangeSet({ rules: [], ruleChangeSet: coveredForceRules }, coveredForceRules);
assert.equal(appliedModel.rules.length, 2, "Applying changeSet must insert rules into model");
assert.ok(appliedModel.rules[0].forceBindings?.length > 0, "Inserted rule must contain forceBindings");
console.log("✓ Combat force rule generation, coverage, and binding application verified");

// 4. Test State Machine generation for Task and Force subjects
const mockTaskSm = generateMockOutput({
  workflow: { id: "state-machine", title: "作战任务状态机分析", outputSchema: "StateMachineDraft" },
  analysis: {
    stateMachineSubjects: [
      { id: "task-strike-1", name: "防空压制打击任务", subjectType: "task", taskName: "防空压制打击" }
    ]
  },
  evidence: []
}).result;
assert.ok(mockTaskSm.stateMachines?.length === 1, "Mock should generate 1 state machine for task");
const taskSm = mockTaskSm.stateMachines[0];
assert.equal(taskSm.subjectType, "task");
assert.ok(taskSm.states.length >= 4, "Task state machine should have at least 4 states");
assert.ok(taskSm.states.some((s) => s.name.includes("进场") || s.name.includes("态势") || s.name.includes("接战")), "Task machine should reflect operational lifecycle");

const mockForceSm = generateMockOutput({
  workflow: { id: "state-machine", title: "作战兵力状态机分析", outputSchema: "StateMachineDraft" },
  analysis: {
    stateMachineSubjects: [
      { id: "combat-force-1", name: "隐身歼击机编队", subjectType: "force", role: "制空截击" }
    ]
  },
  evidence: []
}).result;
assert.ok(mockForceSm.stateMachines?.length === 1, "Mock should generate 1 state machine for force");
const forceSm = mockForceSm.stateMachines[0];
assert.equal(forceSm.subjectType, "force");
assert.ok(forceSm.states.length >= 4, "Force state machine should have at least 4 states");
assert.ok(forceSm.states.some((s) => s.name.includes("值班") || s.name.includes("巡逻") || s.name.includes("接战") || s.name.includes("重构")), "Force machine should reflect force lifecycle");
console.log("✓ State machine generation for tasks and forces verified");

// 5. Test Sequence Diagram generation and coverage for Task and Force
const taskSeqModel = ensureTaskSequenceCoverage({ sequences: [] }, {
  tasks: [{ id: "task-1", name: "对地突击" }],
  stateMachines: [taskSm]
});
assert.equal(taskSeqModel.sequences.length, 1, "ensureTaskSequenceCoverage should create sequence for task");
assert.equal(taskSeqModel.sequences[0].diagramType, "task");
assert.ok(taskSeqModel.sequences[0].participants.length >= 2, "Task sequence must have participants");
assert.ok(taskSeqModel.sequences[0].messages.length > 0, "Task sequence must have messages");

const forceSeqModel = ensureForceSequenceCoverage({ sequences: [] }, {
  forces: [{ id: "force-1", name: "无人僚机中队", side: "friendly", phaseIds: ["phase-1"] }],
  stateMachines: [forceSm]
});
assert.equal(forceSeqModel.sequences.length, 1, "ensureForceSequenceCoverage should create sequence for force");
assert.equal(forceSeqModel.sequences[0].diagramType, "force");
assert.ok(forceSeqModel.sequences[0].participants.length >= 2, "Force sequence must have participants");
assert.ok(forceSeqModel.sequences[0].messages.length > 0, "Force sequence must have messages");
console.log("✓ Sequence diagram generation and coverage for tasks and forces verified");

console.log("All check-task-force-ov6-generation tests passed successfully!");
