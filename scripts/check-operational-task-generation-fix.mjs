import assert from "node:assert/strict";
import { renderOperationalTasks } from "../design-studio/src/operationalTaskView.js";
import {
  buildOperationalTaskGenerationBatches,
  createEmptyForceMissionPlan
} from "../shared/conceptPlanning.js";

// Test 1: Button is enabled and clickable when phases exist, even if stale is true
const staleState = {
  forceMission: createEmptyForceMissionPlan(),
  phaseAction: {
    status: "confirmed",
    phases: [
      { id: "p1", name: "阶段一", blueActions: ["行动1"], redActions: ["对抗1"] },
      { id: "p2", name: "阶段二", blueActions: ["行动2"], redActions: ["对抗2"] }
    ]
  },
  phaseActionStorage: { stale: true }
};
const renderedStale = renderOperationalTasks(staleState);
assert.ok(renderedStale.includes('data-action="generate-operational-tasks"'), "Must include generate button");
assert.ok(!renderedStale.includes('data-action="generate-operational-tasks" disabled'), "Generate button must NOT be disabled when stale");
assert.ok(renderedStale.includes("AI 一键生成"), "Must display AI 一键生成 label when tasks empty");
assert.ok(!renderedStale.includes("请先确认“阶段行动”"), "Must NOT show blocking confirmation warning when phases exist");

// Test 2: Button is enabled when phases are draft
const draftState = {
  forceMission: createEmptyForceMissionPlan(),
  phaseAction: {
    status: "draft",
    phases: [
      { id: "p1", name: "草案一", blueActions: ["行动A"] },
      { id: "p2", name: "草案二", blueActions: ["行动B"] }
    ]
  },
  phaseActionStorage: { stale: false }
};
const renderedDraft = renderOperationalTasks(draftState);
assert.ok(!renderedDraft.includes('data-action="generate-operational-tasks" disabled'), "Generate button must NOT be disabled when phases exist in draft");

// Test 3: Button is disabled when no phases exist
const emptyState = {
  forceMission: createEmptyForceMissionPlan(),
  phaseAction: { status: "empty", phases: [] },
  phaseActionStorage: { stale: false }
};
const renderedEmpty = renderOperationalTasks(emptyState);
assert.ok(renderedEmpty.includes('data-action="generate-operational-tasks" disabled'), "Generate button must be disabled when no phases exist");
assert.ok(renderedEmpty.includes("请先在“阶段行动”中生成阶段"), "Must show informative banner when no phases exist");

// Test 4: Batch builder works with phases having no explicit blue/red action arrays
const objectiveOnlyPhases = {
  status: "draft",
  phases: [
    { id: "p1", name: "初始阶段", objective: "达成态势优势" },
    { id: "p2", name: "决胜阶段", objective: "达成瘫痪打击" }
  ]
};
const batches = buildOperationalTaskGenerationBatches(objectiveOnlyPhases, 3);
assert.ok(batches.length > 0, "Must generate batches even if blueActions/redActions omitted");
assert.equal(batches[0].expectedTaskCount, 2, "Must derive fallback tasks from objectives");

console.log("operational task generation fix checks passed!");
