import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Testing Force Mission Generation Overlay & Subflow Advancement Contract...");

const mainContent = fs.readFileSync("design-studio/src/main.js", "utf8");

// 1. Verify getBusyOverlayState handles forceMissionGenerating for both concept and combat layers
assert(mainContent.includes("state.forceMissionGenerating"), "main.js must check state.forceMissionGenerating");
assert(mainContent.includes("force-mission-combat"), "main.js must define combat layer overlay state");
assert(mainContent.includes("force-mission-concept"), "main.js must define concept layer overlay state");
assert(mainContent.includes("正在生成概念兵力"), "Overlay title must announce concept forces");
assert(mainContent.includes("正在生成作战编成"), "Overlay title must announce combat forces");

// 2. Verify advanceRelatedWorkflow from ov6c to force-mission auto-confirms operational tasks
assert(mainContent.includes("completesTaskSubflow"), "advanceRelatedWorkflow must recognize completesTaskSubflow");
assert(mainContent.includes("conceptPlanningController.confirmOperationalTasks()"), "completesTaskSubflow must auto-confirm operational tasks");

// 3. Verify navigateToResearchView enters force-mission with concept generation
assert(mainContent.includes('conceptPlanningController.generateForceMission({ silent: false, layer: "concept" })'), "Must generate concept force mission on entry");

console.log("All force mission generation overlay and subflow advancement checks passed successfully!");
