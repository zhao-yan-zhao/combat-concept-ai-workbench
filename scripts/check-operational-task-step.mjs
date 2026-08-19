import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  confirmOperationalTasks,
  compactForceMissionForAnalysis,
  createEmptyForceMissionPlan,
  createOperationalTasksFromPhaseAction,
  buildOperationalTaskGenerationBatches,
  addOperationalTaskAreaPoint,
  updateOperationalTaskArea,
  updateOperationalTaskAreaPoint,
  normalizeForceMissionPlan,
  updateOperationalTask
} from "../shared/conceptPlanning.js";
import { generateMockOutput } from "../shared/generator.js";
import { workflowOrder, workflowPrimaryStepIds, productLabels } from "../design-studio/src/data.js";
import { renderOperationalTasks } from "../design-studio/src/operationalTaskView.js";

const phaseAction = {
  status: "confirmed",
  phases: [{ id: "p1", name: "侦察阶段", blueActions: ["建立态势"], redActions: ["实施干扰"], expectedEffects: ["形成识别结果"] }]
};
let plan = createOperationalTasksFromPhaseAction(createEmptyForceMissionPlan(), phaseAction);
const generationBatches = buildOperationalTaskGenerationBatches({
  status: "confirmed",
  phases: [{ id: "large-phase", blueActions: Array.from({ length: 8 }, (_, index) => `blue-${index}`), redActions: Array.from({ length: 5 }, (_, index) => `red-${index}`) }]
}, 6);
assert.deepEqual(generationBatches.map((batch) => batch.expectedTaskCount), [6, 6, 1]);
assert.equal(generationBatches.flatMap((batch) => batch.phases.flatMap((phase) => [...phase.blueActions, ...phase.redActions])).length, 13);
assert.equal(plan.tasks.length, 2, "Task generation should preserve blue and red phase actions");
assert.equal(plan.tasksConfirmedAt, "", "Generated tasks must await human confirmation");
assert.equal(plan.tasks[0].missionType, "recon", "Task type should be inferred from the CMO-aligned taxonomy");
assert.equal(plan.tasks[0].name, "侦察监视任务", "Generated names should use a concise professional task-name pattern");
assert.equal(plan.tasks[0].area.name, "待人工明确", "Unknown task areas must remain explicit instead of inventing geography");
assert.equal(plan.tasks[0].area.coordinateSystem, "WGS84");
assert.equal(new Set(plan.tasks.map((task) => task.name)).size, plan.tasks.length, "Generated task names should be unique");
assert.ok(plan.tasks.every((task) => task.name.endsWith("任务")), "Generated task names should use the standard suffix");
assert.ok(plan.tasks.every((task) => !/[TＴ]\s*[+-]|[，,；;。]/u.test(task.name)), "Task names should not contain timestamps or full action sentences");
for (const task of plan.tasks) {
  const friendly = task.side !== "hostile";
  plan = updateOperationalTaskArea(plan, task.id, {
    name: friendly ? "北部警戒区" : "东部警戒区",
    type: "patrol",
    geometryType: "polygon"
  });
  plan = addOperationalTaskAreaPoint(plan, task.id);
  plan = updateOperationalTaskAreaPoint(plan, task.id, "point-1", {
    label: "RP-1",
    latitude: friendly ? 21.1234567 : 22.1234567,
    longitude: friendly ? 121.7654321 : 122.7654321
  });
}
plan = updateOperationalTask(plan, plan.tasks[0].id, { missionType: "aew", objective: "修订后的任务目的" });
assert.equal(plan.tasks[0].objective, "修订后的任务目的");
assert.equal(plan.tasks[0].missionType, "aew");
assert.equal(plan.tasks[0].area.name, "北部警戒区");
assert.equal(plan.tasks[0].area.type, "patrol");
assert.equal(plan.tasks[0].area.points[0].latitude, 21.123457);
assert.equal(compactForceMissionForAnalysis(plan).tasks[0].missionType, "aew");
assert.equal(compactForceMissionForAnalysis(plan).tasks[0].area.name, "北部警戒区");
plan = confirmOperationalTasks(plan);
assert.ok(plan.tasksConfirmedAt, "Task confirmation should be persisted");
assert.ok(workflowOrder.indexOf("operational-task") < workflowOrder.indexOf("force-mission"));
assert.ok(workflowPrimaryStepIds.indexOf("operational-task") < workflowPrimaryStepIds.indexOf("force-mission"));
assert.equal(productLabels["operational-task"], "作战任务");
assert.equal(productLabels["force-mission"], "作战兵力");
assert.ok(renderOperationalTasks({ forceMission: plan, phaseAction, phaseActionStorage: {} }).includes("任务已确认"));
const rendered = renderOperationalTasks({ forceMission: plan, phaseAction, phaseActionStorage: {}, operationalTaskSelectedId: plan.tasks[0].id });
assert.ok(rendered.includes("任务类型") && rendered.includes("区域用途") && rendered.includes("WGS84"));
assert.ok(rendered.includes("21.123457") && rendered.includes("121.765432"));
assert.ok(rendered.includes("AI 一键重新生成") && !rendered.includes("generate-operational-task-area"));
assert.ok(rendered.includes("filter-operational-tasks") && rendered.includes("蓝方") && rendered.includes("红方"));
assert.ok(rendered.includes("区域补全") && rendered.includes("operational-task-delete"));
assert.ok(renderOperationalTasks({ forceMission: plan, phaseAction, phaseActionStorage: {}, operationalTaskGenerating: true, operationalTaskGenerationProgress: { completed: 1, total: 3 } }).includes("AI 正在生成 1/3"));
const operationalTaskControllerSource = readFileSync(new URL("../design-studio/src/conceptPlanningController.js", import.meta.url), "utf8");
assert.ok(operationalTaskControllerSource.includes("operationalTaskListScrollTop") && operationalTaskControllerSource.includes("operationalTaskList.scrollTop ="), "Task selection should preserve list scroll position across renders");
const mainSource = readFileSync(new URL("../design-studio/src/main.js", import.meta.url), "utf8");
assert.ok(mainSource.includes("state.operationalTaskGenerating") && mainSource.includes('key: "operational-task-generate"'), "Task generation must use the shared AI transition overlay");
assert.ok(mainSource.includes("AI 正在生成并补全任务内容") && mainSource.includes("operationalTaskGenerationProgress"), "Task transition overlay must expose batch completion status");

const localAiDraft = generateMockOutput({
  workflow: { id: "operational-task", title: "作战任务与任务区域", outputSchema: "OperationalTaskDraft" },
  analysis: { phaseAction }, evidence: []
});
assert.equal(localAiDraft.outputSchema, "OperationalTaskDraft");
assert.equal(localAiDraft.result.tasks.length, 2);
assert.deepEqual(localAiDraft.result.tasks[0].area.points, [], "Local fallback must not invent coordinates");

const legacy = normalizeForceMissionPlan({
  status: "confirmed",
  confirmedAt: "2026-01-01T00:00:00.000Z",
  forces: [{ id: "f1", name: "单元", task: "旧任务" }]
});
assert.equal(legacy.tasks.length, 1, "Existing plans should migrate embedded force tasks");
assert.ok(legacy.tasksConfirmedAt, "Confirmed legacy plans should retain confirmed task semantics");
console.log("operational task step checks passed");
