import assert from "node:assert/strict";
import {
  confirmOperationalTasks,
  compactForceMissionForAnalysis,
  createEmptyForceMissionPlan,
  createOperationalTasksFromPhaseAction,
  normalizeForceMissionPlan,
  updateOperationalTask
} from "../shared/conceptPlanning.js";
import { workflowOrder, workflowPrimaryStepIds, productLabels } from "../design-studio/src/data.js";
import { renderOperationalTasks } from "../design-studio/src/operationalTaskView.js";

const phaseAction = {
  status: "confirmed",
  phases: [{ id: "p1", name: "侦察阶段", blueActions: ["建立态势"], redActions: ["实施干扰"], expectedEffects: ["形成识别结果"] }]
};
let plan = createOperationalTasksFromPhaseAction(createEmptyForceMissionPlan(), phaseAction);
assert.equal(plan.tasks.length, 2, "Task generation should preserve blue and red phase actions");
assert.equal(plan.tasksConfirmedAt, "", "Generated tasks must await human confirmation");
assert.equal(plan.tasks[0].missionType, "recon", "Task type should be inferred from the CMO-aligned taxonomy");
assert.equal(plan.tasks[0].area, "待人工明确", "Unknown task areas must remain explicit instead of inventing geography");
plan = updateOperationalTask(plan, plan.tasks[0].id, { missionType: "aew", area: "北部警戒区", objective: "修订后的任务目的" });
assert.equal(plan.tasks[0].objective, "修订后的任务目的");
assert.equal(plan.tasks[0].missionType, "aew");
assert.equal(plan.tasks[0].area, "北部警戒区");
assert.equal(compactForceMissionForAnalysis(plan).tasks[0].missionType, "aew");
assert.equal(compactForceMissionForAnalysis(plan).tasks[0].area, "北部警戒区");
plan = confirmOperationalTasks(plan);
assert.ok(plan.tasksConfirmedAt, "Task confirmation should be persisted");
assert.ok(workflowOrder.indexOf("operational-task") < workflowOrder.indexOf("force-mission"));
assert.ok(workflowPrimaryStepIds.indexOf("operational-task") < workflowPrimaryStepIds.indexOf("force-mission"));
assert.equal(productLabels["operational-task"], "作战任务");
assert.equal(productLabels["force-mission"], "作战兵力");
assert.ok(renderOperationalTasks({ forceMission: plan, phaseAction, phaseActionStorage: {} }).includes("作战任务已确认"));
assert.ok(renderOperationalTasks({ forceMission: plan, phaseAction, phaseActionStorage: {} }).includes("任务类型（参考 CMO）"));

const legacy = normalizeForceMissionPlan({
  status: "confirmed",
  confirmedAt: "2026-01-01T00:00:00.000Z",
  forces: [{ id: "f1", name: "单元", task: "旧任务" }]
});
assert.equal(legacy.tasks.length, 1, "Existing plans should migrate embedded force tasks");
assert.ok(legacy.tasksConfirmedAt, "Confirmed legacy plans should retain confirmed task semantics");
console.log("operational task step checks passed");
