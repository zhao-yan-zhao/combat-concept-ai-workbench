import assert from "node:assert/strict";
import {
  calculateSensorCoverage,
  calculateC2Connectivity,
  calculateCausalSmoothness,
  calculateForceDispersion,
  runLocalAbstractSimulation
} from "../design-studio/src/simulationAdapter.js";

console.log("[T8.6 Test] Starting Abstract Grid Discrete-Event Evaluator (DES) Verification ...");

// 1. 测试感知覆盖率 (Sensor Coverage)
console.log("[T8.6 Test] 1. Testing Sensor Coverage ...");
const wellCoveredEntities = [
  { id: "e-radar", role: "radar", position: [50, 50] }
];
const nearAreas = [
  { id: "area-center", position: [52, 52], size: 20 }
];
const farAreas = [
  { id: "area-remote", position: [95, 95], size: 20 }
];

const highCov = calculateSensorCoverage(wellCoveredEntities, nearAreas);
assert.ok(highCov.score >= 70, `良好覆盖得分应较高，实测: ${highCov.score}`);
assert.equal(highCov.uncoveredAreaCount, 0);

const lowCov = calculateSensorCoverage(wellCoveredEntities, farAreas);
assert.ok(lowCov.score < 30, `超远距离覆盖得分应极低，实测: ${lowCov.score}`);
assert.equal(lowCov.uncoveredAreaCount, 1);
console.log("[T8.6 Test] ✓ Sensor coverage decay and detection verified cleanly.");

// 2. 测试指控通信连通率 (C2 Connectivity)
console.log("[T8.6 Test] 2. Testing C2 Connectivity ...");
const connectedEntities = [
  { id: "ent-1", role: "command", position: [30, 30] },
  { id: "ent-2", role: "relay", position: [45, 40] },
  { id: "ent-3", role: "shooter", position: [60, 50] }
];
const connResult = calculateC2Connectivity(connectedEntities, 30);
assert.equal(connResult.score, 100, "完整接力链路连通率应为 100%");
assert.equal(connResult.isolatedIds.length, 0);

const isolatedEntities = [
  ...connectedEntities,
  { id: "ent-stranded", role: "sensor", position: [95, 95] } // 孤立远端
];
const isoResult = calculateC2Connectivity(isolatedEntities, 25);
assert.equal(isoResult.score, 75, "4个实体中1个孤立，连通率应为 75%");
assert.deepEqual(isoResult.isolatedIds, ["ent-stranded"]);
console.log("[T8.6 Test] ✓ C2 network component traversal and isolation detection verified.");

// 3. 测试时序因果顺畅度 (Causal Smoothness)
console.log("[T8.6 Test] 3. Testing Causal Smoothness ...");
const smoothTimeline = [
  { id: "evt-1", time: "H-24", sourceNodeId: "act-1" },
  { id: "evt-2", time: "H-12", sourceNodeId: "act-2" },
  { id: "evt-3", time: "H-0", sourceNodeId: "act-3" }
];
const ov5Dependencies = {
  edges: [
    { from: "act-1", to: "act-2" },
    { from: "act-2", to: "act-3" }
  ]
};
const smoothResult = calculateCausalSmoothness(smoothTimeline, ov5Dependencies);
assert.equal(smoothResult.score, 100, "严格单调递增且满足依赖时得分为 100%");
assert.equal(smoothResult.inversionCount, 0);

const invertedTimeline = [
  { id: "evt-1", time: "H-12", sourceNodeId: "act-2" },
  { id: "evt-2", time: "H-24", sourceNodeId: "act-1" } // 倒挂
];
const invertedResult = calculateCausalSmoothness(invertedTimeline, ov5Dependencies);
assert.ok(invertedResult.score < 100, "时序倒挂应受扣分");
assert.ok(invertedResult.inversionCount >= 1);
console.log("[T8.6 Test] ✓ Causal monotonicity and topological precedence checks verified.");

// 4. 测试防区分布式疏散健康度 (Force Dispersion)
console.log("[T8.6 Test] 4. Testing Force Dispersion ...");
const healthyDispersion = [
  { id: "e1", position: [20, 20] },
  { id: "e2", position: [38, 30] },
  { id: "e3", position: [55, 45] }
];
const healthyDisp = calculateForceDispersion(healthyDispersion);
assert.ok(healthyDisp.score >= 80, "合理间距疏散得分应较高");
assert.equal(healthyDisp.clusterRiskCount, 0);

const clusteredEntities = [
  { id: "e1", position: [40, 40] },
  { id: "e2", position: [42, 41] }, // 极其密集（距离约 2.2 < 8）
  { id: "e3", position: [41, 42] }
];
const clusterDisp = calculateForceDispersion(clusteredEntities);
assert.ok(clusterDisp.score < 80, "严重聚集扎堆应扣分");
assert.ok(clusterDisp.clusterRiskCount > 0, "应检测出聚集风险");
console.log("[T8.6 Test] ✓ Force dispersion and anti-clustering metric verified.");

// 5. 测试 runLocalAbstractSimulation 端到端全量集成
console.log("[T8.6 Test] 5. Testing runLocalAbstractSimulation integration ...");
const scenarioInput = {
  id: "scenario-test-des",
  entities: connectedEntities,
  areas: nearAreas,
  timeline: smoothTimeline,
  ov5: ov5Dependencies,
  simulation: { runs: [] }
};

const output = runLocalAbstractSimulation(scenarioInput);
const latestRun = output.simulation.runs[0];
assert.ok(latestRun, "应生成仿真运行记录");
assert.equal(latestRun.adapter.id, "local-abstract-grid");
assert.equal(latestRun.result.metrics.length, 6, "必须产出完整的 6 项战术机理指标");

const metricIds = latestRun.result.metrics.map(m => m.id);
assert.ok(metricIds.includes("grid-bounds"));
assert.ok(metricIds.includes("area-coverage"));
assert.ok(metricIds.includes("c2-connectivity"));
assert.ok(metricIds.includes("timeline-completeness"));
assert.ok(metricIds.includes("causal-smoothness"));
assert.ok(metricIds.includes("force-dispersion"));

assert.ok(latestRun.result.evaluatorDetails, "必须提供评估器机理明细");
assert.ok(latestRun.result.summary.includes("战术离散评估完成"));
console.log("[T8.6 Test] ✓ runLocalAbstractSimulation 6-metric output verified cleanly.");

console.log("[T8.6 Test] ✓ All T8.6 Abstract Grid DES checks PASSED successfully!");
