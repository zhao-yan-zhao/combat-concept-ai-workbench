// @ts-check
import assert from "node:assert/strict";
import {
  calculateLatencyBudget,
  evaluateOodaLoopHealth,
  parseActivitySeconds,
  formatDurationSeconds,
  filterForwardDagEdges,
  solveDagPaths
} from "../design-studio/src/oodaStore.js";

console.log("[T8.1 Test] Starting Kill Web DAG Critical Path Method (CPM) Latency Budget verification ...");

// 1. 验证耗时解析与格式化辅助函数
assert.equal(parseActivitySeconds("120s"), 120, "Should parse 120s");
assert.equal(parseActivitySeconds("2m"), 120, "Should parse 2m to 120s");
assert.equal(parseActivitySeconds("5分钟"), 300, "Should parse 5分钟 to 300s");
assert.equal(parseActivitySeconds("1.5小时"), 5400, "Should parse 1.5小时 to 5400s");
assert.equal(parseActivitySeconds("待估算"), 60, "Default fallback should be 60s");
assert.equal(formatDurationSeconds(240), "4 分钟", "240s should format to 4 分钟");
assert.equal(formatDurationSeconds(45), "45 秒", "45s should format to 45 秒");

// 2. 构造测试模型：2条并行侦察支路(各120s) -> 决策(60s) -> 打击行动(60s) + 反馈(60s -> A1)
const testActivities = [
  { id: "act-sensor-1", type: "感知", title: "预警机长程雷达感知", duration: "120s" },
  { id: "act-sensor-2", type: "侦察", title: "无人机前沿光电侦察", duration: "2分钟" }, // 120s
  { id: "act-c2", type: "决策", title: "编队指挥指控决策", duration: "60s" },
  { id: "act-strike", type: "打击", title: "远程高超声速突击行动", duration: "60s" },
  { id: "act-feedback", type: "评估", title: "战场战果评估与更新", duration: "60s" }
];

const testEdges = [
  { id: "e-1", sourceId: "act-sensor-1", targetId: "act-c2", type: "信息流" },
  { id: "e-2", sourceId: "act-sensor-2", targetId: "act-c2", type: "信息流" },
  { id: "e-3", sourceId: "act-c2", targetId: "act-strike", type: "控制流" },
  { id: "e-4", sourceId: "act-strike", targetId: "act-feedback", type: "信息流" },
  { id: "e-5", sourceId: "act-feedback", targetId: "act-sensor-1", type: "反馈流" } // 反馈边
];

// 3. 破环校验：反馈边应被自动剔除，保留前向 DAG
const forwardEdges = filterForwardDagEdges(testActivities, testEdges);
assert.equal(forwardEdges.length, 4, "Feedback edge e-5 should be pruned to keep acyclic DAG");
assert(!forwardEdges.some((e) => e.id === "e-5"), "Forward edges must not contain loop edge e-5");

// 4. CPM 关键路径时延解算断言
const budget = calculateLatencyBudget(testActivities, testEdges, {
  targetWindowSeconds: 1800
});

console.log("[T8.1 Test] Budget output:", JSON.stringify(budget, null, 2));

// 关键路径耗时应为 120 + 60 + 60 = 240s，绝非全量算术累加的 420s
assert.equal(budget.criticalPathSeconds, 240, `Critical path seconds must be 240s, got ${budget.criticalPathSeconds}s`);
assert.equal(budget.totalSeconds, 240, "totalSeconds must backward-compatibly equal criticalPathSeconds");
assert.equal(budget.parallelSumSeconds, 420, `Parallel sum seconds should be 420s, got ${budget.parallelSumSeconds}s`);
assert.equal(budget.fastestKillChainSeconds, 240, "Fastest kill chain seconds should be 240s");

// 校验关键路径节点序列
assert.equal(budget.criticalPathIds.length, 3, "Critical path should contain exactly 3 nodes (Sensor -> C2 -> Strike)");
assert(["act-sensor-1", "act-sensor-2"].includes(budget.criticalPathIds[0]), "Critical path start must be a sensor");
assert.equal(budget.criticalPathIds[1], "act-c2", "Critical path middle must be act-c2");
assert.equal(budget.criticalPathIds[2], "act-strike", "Critical path end must be act-strike");

// 5. 校验目标暴露时间窗（Target Window）超限告警机制
// 场景 A: 高时敏目标 (TST)，窗口设为 180s (3分钟)，240s > 180s 触发超限告警
const tstHealth = evaluateOodaLoopHealth(
  { activities: testActivities, edges: testEdges },
  { targetWindowSeconds: 180 }
);
assert.equal(tstHealth.latencyBudget.exceedsBudget, true, "TST scenario (180s) should exceed budget for 240s critical path");
const tstDiag = tstHealth.diagnostics.find((d) => d.code === "KILL_CHAIN_LATENCY_EXCEEDED");
assert(Boolean(tstDiag), "Should raise KILL_CHAIN_LATENCY_EXCEEDED diagnostic when exceeding target window");
console.log("[T8.1 Test] Raised expected TST latency diagnostic:", tstDiag.label);

// 场景 B: 常规窗口，窗口设为 600s (10分钟)，240s <= 600s 正常合规
const normalHealth = evaluateOodaLoopHealth(
  { activities: testActivities, edges: testEdges },
  { targetWindowSeconds: 600 }
);
assert.equal(normalHealth.latencyBudget.exceedsBudget, false, "Normal scenario (600s) should not exceed budget for 240s critical path");
assert(!normalHealth.diagnostics.some((d) => d.code === "KILL_CHAIN_LATENCY_EXCEEDED"), "Should not raise latency warning in normal window");

console.log("[T8.1 Test] ✓ All T8.1 Kill Web DAG CPM Latency checks PASSED successfully!");
