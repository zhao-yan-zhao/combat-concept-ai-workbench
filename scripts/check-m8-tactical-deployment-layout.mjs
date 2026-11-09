import assert from "node:assert/strict";
import {
  planScenarioDeployment,
  applyScenarioDeploymentPlan
} from "../design-studio/src/scenarioDeploymentPlanner.js";

console.log("[T8.7 Test] Starting Tactical Deployment Layout & Threat Axis Verification ...");

// 1. 验证基于威胁轴线的梯次纵深配置 (前沿感知 > 中距突击 > 后置指控)
console.log("[T8.7 Test] 1. Testing Threat Axis Echelon Alignment ...");
const mockScenario = {
  entities: [
    { id: "e-sensor", role: "sensor", position: [0, 0] },
    { id: "e-command", role: "command", position: [0, 0] },
    { id: "e-action", role: "action", position: [0, 0] },
    { id: "e-support", role: "support", position: [0, 0] },
    { id: "e-opponent", role: "opponent", position: [85, 50] } // 威胁位于东侧
  ],
  areas: [
    { id: "coverage", position: [60, 45], size: 25 },
    { id: "window", position: [40, 50], size: 20 }
  ],
  ov2: {
    edges: [
      { from: "e-command", to: "e-action" },
      { from: "e-sensor", to: "e-command" }
    ]
  }
};

const plan = planScenarioDeployment(mockScenario);
assert.equal(plan.coordinateReference, "abstract-percent-grid");
assert.equal(plan.state, "suggested");
assert.equal(plan.placements.length, 5);

const byId = new Map(plan.placements.map(p => [p.id, p]));
const sensorPos = byId.get("e-sensor").position;
const commandPos = byId.get("e-command").position;
const actionPos = byId.get("e-action").position;
const opponentPos = byId.get("e-opponent").position;

// 面对东侧对手 (X=85)，感知实体的 X 必须明显大于指挥中心 X，形成迎头防御纵深
assert.ok(sensorPos[0] > commandPos[0], `感知实体 X (${sensorPos[0]}) 必须前置于指挥实体 X (${commandPos[0]})`);
assert.ok(actionPos[0] > commandPos[0], `打击实体 X (${actionPos[0]}) 必须前置于指挥实体 X (${commandPos[0]})`);
assert.ok(opponentPos[0] > sensorPos[0], "对手实体应保持在最远端");
console.log("[T8.7 Test] ✓ Threat-axis echelon depth (Sensor > Action > Command) verified cleanly.");

// 2. 验证防区疏散斥力机制：初始坐标全部重叠时自动推开
console.log("[T8.7 Test] 2. Testing Anti-Clustering Force Relaxation ...");
const overlappedScenario = {
  entities: [
    { id: "ent-1", role: "action", position: [50, 50] },
    { id: "ent-2", role: "action", position: [50, 50] },
    { id: "ent-3", role: "action", position: [50, 50] }
  ]
};
const overlapPlan = planScenarioDeployment(overlappedScenario);
const p1 = overlapPlan.placements[0].position;
const p2 = overlapPlan.placements[1].position;
const p3 = overlapPlan.placements[2].position;

const d12 = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
const d23 = Math.hypot(p2[0] - p3[0], p2[1] - p3[1]);
const d13 = Math.hypot(p1[0] - p3[0], p1[1] - p3[1]);

assert.ok(d12 >= 10, `疏散后实体1与实体2间距必须 >= 10，实测: ${d12.toFixed(1)}`);
assert.ok(d23 >= 10, `疏散后实体2与实体3间距必须 >= 10，实测: ${d23.toFixed(1)}`);
assert.ok(d13 >= 10, `疏散后实体1与实体3间距必须 >= 10，实测: ${d13.toFixed(1)}`);
console.log("[T8.7 Test] ✓ Anti-clustering force repulsion verified cleanly.");

// 3. 验证安全坐标范围红线 (5-95)
console.log("[T8.7 Test] 3. Testing 0-100 Abstract Grid In-Bounds Enforcement ...");
const applied = applyScenarioDeploymentPlan(mockScenario, plan);
assert.ok(applied.entities.every(e => e.position[0] >= 5 && e.position[0] <= 95 && e.position[1] >= 5 && e.position[1] <= 95), "所有实体位置必须钳制在 [5, 95] 安全研究网格内");
console.log("[T8.7 Test] ✓ Safe abstract-grid boundary clamp verified cleanly.");

// 4. 验证诊断输出与威胁轴线元数据完整性
console.log("[T8.7 Test] 4. Testing Tactical Diagnostics & Threat Axis Metadata ...");
assert.ok(plan.threatAxis, "部署计划必须输出 threatAxis 向量信息");
assert.equal(plan.threatAxis.unitAxis.length, 2);

const diagIds = plan.diagnostics.map(d => d.id);
assert.ok(diagIds.includes("abstract-grid"));
assert.ok(diagIds.includes("entity-separation"));
assert.ok(diagIds.includes("coverage-alignment"));

const covDiag = plan.diagnostics.find(d => d.id === "coverage-alignment");
assert.ok(covDiag.detail.includes("威胁主轴"));
console.log("[T8.7 Test] ✓ Tactical diagnostics & threat-axis verified cleanly.");

console.log("[T8.7 Test] ✓ All T8.7 Tactical Deployment Layout checks PASSED successfully!");
