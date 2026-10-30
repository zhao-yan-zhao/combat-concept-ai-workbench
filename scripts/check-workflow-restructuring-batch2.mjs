/**
 * Verification for Batch 2: Six-step Mainline Navigation & Gate Restructuring
 * Run: node scripts/check-workflow-restructuring-batch2.mjs
 */

import { workflowPhases, workflowPrimaryStepIds, workflowTracks, views } from "../design-studio/src/data.js";
import { getWorkflowStageIncompleteReasons, canCompleteWorkflowStage, isStepGenerated } from "../design-studio/src/app/workflowGate.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log("Starting Batch 2 Verification: Six-step Mainline Navigation & Gate Restructuring...");

// 1. 验证六大主线 ID
assert(workflowPrimaryStepIds.length === 6, `Mainline must have 6 primary steps, got ${workflowPrimaryStepIds.length}`);
assert(workflowPrimaryStepIds.join(",") === "brief,phase-action,force-mission,ov5,ov1,scenario", "Mainline primary step IDs mismatch");

// 2. 验证六大主线中文名称
assert(workflowPhases.length === 6, `Workflow phases must have 6 items, got ${workflowPhases.length}`);
assert(workflowPhases[0] === "简报" && workflowPhases[1] === "阶段行动" && workflowPhases[2] === "任务与兵力" && workflowPhases[3] === "活动机理" && workflowPhases[4] === "总体概念" && workflowPhases[5] === "仿真推演", "Workflow phases names mismatch");

// 3. 验证六大主线轨道
assert(workflowTracks.length === 6, `Workflow tracks must have 6 tracks, got ${workflowTracks.length}`);
assert(workflowTracks.map((t) => t.id).join(",") === "brief,phase,force,activity,overall,simulation", "Tracks IDs mismatch");

// 4. 验证 views 主线编号映射 (01-06)
const numberedViews = views.filter((v) => v.number);
assert(numberedViews.length === 6, `Exactly 6 views should receive mainline numbers, got ${numberedViews.length}`);
assert(numberedViews.map((v) => `${v.number}:${v.id}`).join(" ") === "01:brief 02:phase-action 03:force-mission 04:ov5 05:ov1 06:scenario", "View numbers must match the six steps in order");

// 5. 验证各 stage 门禁检查
const mockState = {
  brief: { researchIntent: "意图", objective: "目标", approach: "路线", assumptions: "假设", expectedEffects: "效果", risk: "风险" },
  phaseAction: { status: "confirmed", phases: [{ id: "p1", name: "阶段1", blueActions: ["行动1"] }, { id: "p2", name: "阶段2", blueActions: ["行动2"] }] },
  forceMission: {
    tasks: [{ id: "t1", name: "任务1" }],
    tasksConfirmedAt: "2026-08-01",
    forces: [{ id: "f1", name: "兵力1" }],
    combatForces: [{ id: "c1", name: "作战兵力1" }],
    status: "confirmed"
  },
  ov5: { activities: [], edges: [] },
  ov1: { nodes: [], edges: [] }
};

// Stage 0-2 应满足
assert(canCompleteWorkflowStage(mockState, 0), "Stage 0 (brief) should be complete");
assert(canCompleteWorkflowStage(mockState, 1), "Stage 1 (phase) should be complete");
assert(canCompleteWorkflowStage(mockState, 2), "Stage 2 (task-force) should be complete");

// Stage 3 (ov5 活动机理) 目前无节点，应不满足
assert(!canCompleteWorkflowStage(mockState, 3), "Stage 3 (ov5) should be incomplete when empty");
const stage3Reasons = getWorkflowStageIncompleteReasons(mockState, 3);
assert(stage3Reasons.includes("作战活动节点") && stage3Reasons.includes("作战活动因果关系"), "Stage 3 should report missing nodes and edges");

// 填充活动流后，Stage 3 应满足
mockState.ov5 = {
  activities: [{ id: "act-1", title: "活动1" }],
  edges: [{ id: "e-1", sourceId: "act-1", targetId: "act-1" }]
};
assert(canCompleteWorkflowStage(mockState, 3), "Stage 3 (ov5) should be complete with activities and edges");
assert(isStepGenerated("ov5", mockState), "ov5 should be marked generated");

console.log("All Batch 2 checks passed successfully!");
