/**
 * Verification for Batch 1: OODA diagnostic lens and OV-5 store restructuring
 * Run: node scripts/check-ooda-ov5-restructuring.mjs
 */

import { evaluateOodaLoopHealth, deriveOodaFromOv5 } from "../design-studio/src/oodaStore.js";
import { deriveActivitiesFromTasks, getActivityHierarchy } from "../design-studio/src/ov5Store.js";
import { buildModelTopology } from "../shared/modelTopology.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log("Starting Batch 1 Verification: OODA & OV-5 Store Restructuring...");

// 1. 测试 evaluateOodaLoopHealth
// 1.1 空活动模型
const emptyHealth = evaluateOodaLoopHealth({ activities: [], edges: [] });
assert(emptyHealth.healthScore === 0, "Empty OV-5 should have 0 health score");
assert(emptyHealth.diagnostics.length >= 2, "Empty OV-5 should report missing observe and act");

// 1.2 具备感知、决策、打击但无反馈的断环模型
const openLoopModel = {
  activities: [
    { id: "act-1", type: "感知", title: "远海侦察预警", text: "雷达扫描", input: "传感器配置", output: "预警目标" },
    { id: "act-2", type: "决策", title: "协同打击规划", text: "任务分配", input: "预警目标", output: "交战指令" },
    { id: "act-3", type: "控制", title: "远程火力突击", text: "发射打击", input: "交战指令", output: "毁伤目标" }
  ],
  edges: [
    { id: "e-1-2", sourceId: "act-1", targetId: "act-2", type: "信息流" },
    { id: "e-2-3", sourceId: "act-2", targetId: "act-3", type: "控制流" }
  ]
};

const openLoopHealth = evaluateOodaLoopHealth(openLoopModel);
assert(!openLoopHealth.loopClosed, "Open loop model should be detected as not closed");
assert(openLoopHealth.diagnostics.some((d) => d.code === "NO_FEEDBACK_LOOP"), "Should identify NO_FEEDBACK_LOOP");
assert(openLoopHealth.healthScore < 100, "Open loop health score should be penalized");

// 1.3 闭环完整模型（添加反馈边）
const closedLoopModel = {
  activities: [
    ...openLoopModel.activities,
    { id: "act-4", type: "评估", title: "战果确认与毁伤评估", text: "战损评估", input: "毁伤目标", output: "态势更新包" }
  ],
  edges: [
    ...openLoopModel.edges,
    { id: "e-3-4", sourceId: "act-3", targetId: "act-4", type: "控制流" },
    { id: "e-4-1", sourceId: "act-4", targetId: "act-1", type: "信息流" } // 反馈到感知
  ]
};

const closedLoopHealth = evaluateOodaLoopHealth(closedLoopModel);
assert(closedLoopHealth.loopClosed, "Closed loop model should report loopClosed: true");
assert(!closedLoopHealth.diagnostics.some((d) => d.code === "NO_FEEDBACK_LOOP"), "Should have no NO_FEEDBACK_LOOP diagnostic");
assert(closedLoopHealth.healthScore >= 90, `Closed loop health score should be high, got ${closedLoopHealth.healthScore}`);

// 2. 测试 deriveActivitiesFromTasks (由任务派生活动网)
const sampleTasks = [
  { id: "t-1", name: "前沿穿透侦察任务", missionType: "recon", objective: "建立前沿预警感知", side: "friendly" },
  { id: "t-2", name: "分布式火力打击任务", missionType: "strike", objective: "实施防区外饱和突击", side: "friendly" },
  { id: "t-3", name: "战损评估与态势回传任务", missionType: "support", objective: "回收打击效果并更新态势", side: "friendly" }
];

const derivedOv5 = deriveActivitiesFromTasks(sampleTasks);
assert(derivedOv5.activities.length === 3, "Should derive 3 activities from 3 tasks");
assert(derivedOv5.edges.length >= 3, "Should create connecting edges and feedback loop");
const derivedHealth = evaluateOodaLoopHealth(derivedOv5);
assert(derivedHealth.loopClosed, "Derived activities should automatically form a closed feedback loop");

// 3. 测试 getActivityHierarchy
derivedOv5.activities[1].parentId = derivedOv5.activities[0].id;
const hierarchy = getActivityHierarchy(derivedOv5);
assert(hierarchy.length === 2, "Hierarchy roots should have 2 items when one is child");
assert(hierarchy[0].children.length === 1, "First root should have 1 child");

// 4. 测试向后兼容 deriveOodaFromOv5
const oodaModel = deriveOodaFromOv5(derivedOv5);
assert(oodaModel.lanes.length === 4, "OODA model should have 4 lanes");
assert(oodaModel.lanes[0].nodes.length >= 1, "Observe lane should have nodes");

// 5. 测试 buildModelTopology
const topology = buildModelTopology({
  brief: { objective: "测试目标", researchIntent: "验证批次一" },
  phaseAction: { status: "confirmed", phases: [{ id: "p1", name: "阶段1" }] },
  forceMission: { tasks: sampleTasks, forces: [], combatForces: [] },
  ov5: derivedOv5
});
assert(topology.nodes.length > 0, "Topology should produce nodes");
assert(topology.links.some((l) => l.semantic.includes("提炼总体图") || l.semantic.includes("作战活动")), "Topology should reflect new OV-5 links");

console.log("All Batch 1 checks passed successfully!");
