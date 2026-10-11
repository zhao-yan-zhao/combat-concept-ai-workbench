import assert from "node:assert/strict";
import { normalizeDodafOv1b } from "../shared/dodaf/products.js";
import { setOv1bStepMode, moveOv1bTaskStep, toggleOv1bTaskStepDependency } from "../design-studio/src/ov1bStore.js";
import { generateMockOutput } from "../shared/generator.js";
import { renderOv1b } from "../design-studio/src/ov1bView.js";
import { buildModelTopology } from "../shared/modelTopology.js";

console.log("Checking OV-1b steps pipeline implementation...");

// 1. Normalizer steps migration and dependencies
const legacyInput = {
  taskGroups: [
    {
      id: "grp-1",
      name: "阶段一任务组",
      dimension: "phase",
      taskRefs: ["t-recon-1", "t-strike-1"]
    }
  ]
};
const normalizedLegacy = normalizeDodafOv1b(legacyInput);
assert.equal(normalizedLegacy.taskGroups.length, 1);
assert.equal(normalizedLegacy.taskGroups[0].steps.length, 2, "Legacy taskRefs must convert to steps");
assert.equal(normalizedLegacy.taskGroups[0].steps[0].mode, "sequential");
assert.deepEqual(normalizedLegacy.taskGroups[0].taskRefs, ["t-recon-1", "t-strike-1"]);

// 2. Structured steps input with parallel and trigger modes
const structuredInput = {
  taskGroups: [
    {
      id: "grp-2",
      name: "远海联合行动组",
      dimension: "phase",
      phaseRef: "phase-1",
      steps: [
        {
          stepIndex: 1,
          name: "态势感知",
          mode: "parallel",
          taskRefs: ["t-1", "t-2"],
          dependsOn: []
        },
        {
          stepIndex: 2,
          name: "火力打击",
          mode: "sequential",
          taskRefs: ["t-3"],
          dependsOn: ["t-1", "t-2"]
        }
      ]
    }
  ]
};
const normalized = normalizeDodafOv1b(structuredInput);
const group2 = normalized.taskGroups[0];
assert.equal(group2.steps.length, 2);
assert.equal(group2.steps[0].mode, "parallel");
assert.deepEqual(group2.taskRefs, ["t-1", "t-2", "t-3"], "Derived taskRefs must contain all tasks in order");

// 验证 dependency relations 提取
const depRelations = normalized.relations.filter((r) => r.dm2Type === "dependency");
assert.equal(depRelations.length, 2, "Must derive 2 dependencies (t-1->t-3 and t-2->t-3)");
assert(depRelations.some((r) => r.sourceId === "t-1" && r.targetId === "t-3"));
assert(depRelations.some((r) => r.sourceId === "t-2" && r.targetId === "t-3"));

// 3. Store step mutators
let edited = setOv1bStepMode(normalized, "grp-2", 1, "trigger");
assert.equal(edited.taskGroups[0].steps[0].mode, "trigger", "Step mode must update to trigger");

edited = toggleOv1bTaskStepDependency(edited, "grp-2", 1, "t-extra");
assert(edited.taskGroups[0].steps[0].dependsOn.includes("t-extra"), "Must add dependency");
edited = toggleOv1bTaskStepDependency(edited, "grp-2", 1, "t-extra");
assert(!edited.taskGroups[0].steps[0].dependsOn.includes("t-extra"), "Must toggle off dependency");

edited = moveOv1bTaskStep(edited, "grp-2", "t-2", 1); // 将 t-2 移到步骤 2
assert.deepEqual(edited.taskGroups[0].steps[0].taskRefs, ["t-1"]);
assert(edited.taskGroups[0].steps[1].taskRefs.includes("t-2"));

// 4. Generator phase-driven pipeline
const mockOutput = generateMockOutput({
  workflow: { id: "task-organization", outputSchema: "TaskOrganizationDraft" },
  analysis: {
    phaseAction: {
      phases: [
        { id: "p-1", name: "初始展开", objective: "建立感知" },
        { id: "p-2", name: "主要交战", objective: "达成压制" }
      ]
    },
    tasks: [
      { id: "t-recon-a", name: "预警侦察", phaseId: "p-1", missionType: "侦察" },
      { id: "t-strike-b", name: "火力突击", phaseId: "p-2", missionType: "打击" }
    ]
  },
  evidence: []
}).result;

assert.equal(mockOutput.taskGroups.length, 2, "Must generate groups by phase");
assert.equal(mockOutput.taskGroups[0].dimension, "phase");
assert(mockOutput.taskGroups[0].steps.length >= 1);
assert.equal(mockOutput.taskGroups[0].steps[0].taskRefs[0], "t-recon-a");

// 5. View rendering
const html = renderOv1b({
  forceMission: {
    tasks: [
      { id: "t-1", name: "态势感知", side: "friendly", missionType: "侦察" },
      { id: "t-2", name: "电子压制", side: "friendly", missionType: "电子" },
      { id: "t-3", name: "火力打击", side: "friendly", missionType: "打击" }
    ]
  },
  ov1b: normalized,
  ov1bStorage: {}
});

assert(html.includes("ov1b-pipeline-flow"), "Must render pipeline flow container");
assert(html.includes("ov1b-pipeline-step"), "Must render step container");
assert(html.includes("ov1b-step-mode-switch"), "Must render mode switcher");
assert(html.includes("ov1b-canvas-task-node"), "Must render task nodes");
assert(html.includes("data-action=\"ov1b-move-task\""), "Must preserve move task action");
assert(html.includes("data-action=\"ov1b-step-task\""), "Must provide step shift action");

// 6. Model Topology integration
const forceMission = {
  tasks: [
    { id: "t-1", name: "态势感知", phaseId: "p-1" },
    { id: "t-2", name: "电子压制", phaseId: "p-1" },
    { id: "t-3", name: "火力打击", phaseId: "p-1" }
  ],
  forces: [],
  combatForces: [],
  relations: []
};
const topology = buildModelTopology({ forceMission, ov1b: normalized });
const depLinks = topology.links.filter((link) => link.semantic && link.semantic.includes("执行前置依赖"));
assert.equal(depLinks.length, 2, "Topology compiler must build 2 execution dependency links");

console.log("OV-1b steps pipeline acceptance passed: steps normalization, mode switching, phase-driven generation, UI pipeline flow, and topology dependency linkage.");
