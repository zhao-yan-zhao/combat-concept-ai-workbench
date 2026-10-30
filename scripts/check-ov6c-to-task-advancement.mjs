import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mainSource = readFileSync(join(root, "design-studio/src/main.js"), "utf8");

// Verify that advance-related-workflow respects stepIntent 'ai'
assert.ok(
  mainSource.includes('action === "advance-related-workflow"')
  && (mainSource.includes('void advanceRelatedWorkflow({ generate: intent === "ai" });')
      || mainSource.includes('void advanceRelatedWorkflow({ generate: intent === "ai" || isRegenerate, forceRegenerate: isRegenerate });')),
  "advance-related-workflow must forward stepIntent === 'ai' to generate flag"
);

// Verify that navigateToResearchView triggers generateOperationalTasks when entering operational-task
assert.ok(
  mainSource.includes('if (viewId === "operational-task" && (')
  && mainSource.includes("conceptPlanningController.generateOperationalTasks({ silent: false })"),
  "navigateToResearchView must call generateOperationalTasks on operational-task view entry when requested"
);

// Verify that stage 1 confirmation with generate flag also invokes generateOperationalTasks
assert.ok(
  (mainSource.includes('if (generate && stage === 1 && (nextMainView === "force-mission" || nextMainView === "operational-task")) {')
   || mainSource.includes('if (generate && stage === 1 && nextMainView === "operational-task") {'))
  && mainSource.includes("conceptPlanningController.generateOperationalTasks({ silent: false })"),
  "completeWorkflowStage must trigger generateOperationalTasks when stage 1 advances with generate = true"
);

console.log("ov6c-to-task-advancement check passed");
