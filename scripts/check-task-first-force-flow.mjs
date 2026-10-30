import assert from "node:assert/strict";
import { renderForceMission } from "../design-studio/src/forceMissionView.js";

console.log("Starting Task-First Workflow Verification...");

// 1. Initial State Check (Task First)
const state = {
  activeView: "force-mission",
  forceMissionLayerTab: "task",
  brief: { objective: "测试课题", researchIntent: "验证先任务后兵力动线" },
  phaseAction: {
    phases: [
      { id: "phase-1", name: "初始阶段", sequence: 1 },
      { id: "phase-2", name: "机动阶段", sequence: 2 }
    ]
  },
  forceMission: {
    tasks: [],
    forces: [],
    combatForces: []
  },
  forceMissionStorage: { stale: false },
  cmoCatalogStatus: { open: false }
};

// 2. Render Force Mission View Check
const html = renderForceMission(state);

// Tab 1 must be operational task
assert.match(html, /data-layer="task"/, "Must contain 'task' layer tab");
assert.match(html, /class="[^"]*force-layer-seg-btn[^"]*is-selected[^"]*"[^>]*data-layer="task"/, "Tab 1 'task' must be selected by default");

// Tabs 2 and 3 must follow
assert.match(html, /data-layer="concept"/, "Must contain 'concept' layer tab");
assert.match(html, /data-layer="combat"/, "Must contain 'combat' layer tab");

// Check Tab labels order
const taskIdx = html.indexOf('data-layer="task"');
const conceptIdx = html.indexOf('data-layer="concept"');
const combatIdx = html.indexOf('data-layer="combat"');
assert.ok(taskIdx < conceptIdx, "Task tab must precede concept force tab");
assert.ok(conceptIdx < combatIdx, "Concept force tab must precede combat package tab");

// Check that operational task workbench is rendered
assert.match(html, /operational-task-workbench/, "Operational task workbench must be rendered in task tab");
assert.match(html, /data-action="generate-operational-tasks"/, "Generate operational tasks action must be available");
assert.match(html, /data-action="confirm-operational-tasks"/, "Confirm operational tasks action must be available");

// 3. Check Left Rail has task count
assert.match(html, /任务 \d+ · 概念 \d+ · 编成 \d+/, "Phase rail must display task count along with concept and combat forces");

// 4. Test when tasks are confirmed, can switch to concept tab
const stateConcept = {
  ...state,
  forceMissionLayerTab: "concept",
  forceMission: {
    tasks: [{ id: "task-1", name: "穿透侦察", phaseId: "phase-1" }],
    tasksConfirmedAt: "2026-10-28T00:00:00Z",
    forces: [{ id: "force-1", name: "无人侦察机", role: "isr", phaseIds: ["phase-1"], taskRefs: ["task-1"] }],
    combatForces: []
  }
};
const htmlConcept = renderForceMission(stateConcept);
assert.match(htmlConcept, /class="[^"]*force-layer-seg-btn[^"]*is-selected[^"]*"[^>]*data-layer="concept"/, "Tab 2 'concept' must be selected when state is concept");
assert.match(htmlConcept, /承接: 穿透侦察/, "Concept force roster must show associated task name");

console.log("Task-First Workflow Verification: ALL CHECKS PASSED!");
