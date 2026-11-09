import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  extractSimulationPhaseOutcomes,
  recycleSimulationToPhasesAndActivities
} from "../design-studio/src/simulationRecycleStore.js";

console.log("[T8.4 Test] Starting Honest Recycle Derivation & Anti-Fabrication Verification ...");

// 1. 源码级静态检查：坚决消除伪造算式
const storeSrc = fs.readFileSync(path.resolve("design-studio/src/simulationRecycleStore.js"), "utf8");
assert.ok(!storeSrc.includes("1.5 + index"), "严禁出现 1.5 + index * 1.2 伪造线性战损算式");
assert.ok(!storeSrc.includes("4.0 + index"), "严禁出现 4.0 + index * 2.0 伪造线性战损算式");
console.log("[T8.4 Test] ✓ Source code integrity verified: 0 hardcoded loss formulas detected.");

// 2. 测试定量回传场景
const mockPhases = [
  { id: "p1", name: "远程预警与信标布设", timeWindow: "0-2h" },
  { id: "p2", name: "多向饱和突击破击", timeWindow: "2-4h" }
];

const quantitativeScenario = {
  simulation: {
    runs: [
      {
        result: {
          phaseOutcomes: [
            {
              phaseId: "p1",
              status: "achieved",
              lossRate: "1.8%",
              riskAssessment: "真实弹道轨迹仿真回传：雷达探测闭环，防区外安全"
            },
            {
              phaseId: "p2",
              status: "partial",
              lossRate: "6.2%",
              durationDelta: "+0.5h",
              riskAssessment: "真实拦截弹消耗回传：突防成功但诱饵消耗超标"
            }
          ]
        }
      }
    ]
  }
};

const quantOutcomes = extractSimulationPhaseOutcomes(quantitativeScenario, { phases: mockPhases });
assert.equal(quantOutcomes.length, 2);
assert.equal(quantOutcomes[0].sourceType, "[定量仿真回传]", "定量场景应明确标注定量回传");
assert.equal(quantOutcomes[0].isQuantitative, true, "定量场景 isQuantitative 应为 true");
assert.equal(quantOutcomes[0].lossRate, "1.8%", "定量回传战损值应忠实保留");
assert.equal(quantOutcomes[1].sourceType, "[定量仿真回传]");
assert.equal(quantOutcomes[1].lossRate, "6.2%");
console.log("[T8.4 Test] ✓ Quantitative simulation pass-through verified cleanly.");

// 3. 测试定性/机理推导场景（健康闭环 vs 协同延误 vs 严重受挫）
// 3.1 健康闭环（高指标）
const healthyScenario = {
  simulation: {
    runs: [
      {
        result: {
          metrics: [
            { id: "area-coverage", value: 92 },
            { id: "grid-bounds", value: 95 },
            { id: "timeline-completeness", value: 90 }
          ]
        }
      }
    ]
  }
};
const healthyOutcomes = extractSimulationPhaseOutcomes(healthyScenario, { phases: mockPhases });
assert.equal(healthyOutcomes[0].sourceType, "[定性推演/机理推导]");
assert.equal(healthyOutcomes[0].isQuantitative, false);
assert.equal(healthyOutcomes[0].status, "achieved");
assert.equal(healthyOutcomes[0].riskLevel, "low");
assert.ok(healthyOutcomes[0].lossRate.includes("%"), "战损仍需包含百分比以兼容既有渲染");
assert.ok(healthyOutcomes[0].lossRate.includes("预估"), "战损应带有定性预估语义");
console.log("[T8.4 Test] ✓ Healthy loop mechanism derivation verified:", healthyOutcomes[0].lossRate);

// 3.2 协同延迟受阻（中度指标偏低）
const degradedScenario = {
  simulation: {
    runs: [
      {
        result: {
          metrics: [
            { id: "area-coverage", value: 65 }, // <70
            { id: "grid-bounds", value: 85 },
            { id: "timeline-completeness", value: 68 } // <70
          ]
        }
      }
    ]
  }
};
const degradedOutcomes = extractSimulationPhaseOutcomes(degradedScenario, { phases: mockPhases });
assert.equal(degradedOutcomes[1].status, "partial");
assert.equal(degradedOutcomes[1].riskLevel, "medium");
assert.ok(degradedOutcomes[1].lossRate.includes("局部受阻预估"));
console.log("[T8.4 Test] ✓ Degraded coordination derivation verified:", degradedOutcomes[1].lossRate);

// 3.3 关键指标崩溃（断链，<50）
const failedScenario = {
  simulation: {
    runs: [
      {
        result: {
          metrics: [
            { id: "area-coverage", value: 35 }, // 严重未达标
            { id: "timeline-completeness", value: 40 }
          ]
        }
      }
    ]
  }
};
const failedOutcomes = extractSimulationPhaseOutcomes(failedScenario, { phases: mockPhases });
assert.equal(failedOutcomes[0].status, "failed");
assert.equal(failedOutcomes[0].riskLevel, "high");
assert.ok(failedOutcomes[0].lossRate.includes("严重受挫预估"));
console.log("[T8.4 Test] ✓ Severe disruption failure derivation verified:", failedOutcomes[0].lossRate);

// 4. 测试向 phaseAction 回填的一致性与溯源
const recycled = recycleSimulationToPhasesAndActivities({
  scenario: degradedScenario,
  phaseAction: { phases: mockPhases },
  ov5: { activities: [] }
});
assert.ok(recycled.phaseAction.phases[1].simulationOutcome, "回填应包含 simulationOutcome");
assert.equal(recycled.phaseAction.phases[1].simulationOutcome.sourceType, "[定性推演/机理推导]");
assert.equal(recycled.phaseAction.phases[1].simulationOutcome.riskLevel, "medium");

console.log("[T8.4 Test] ✓ All T8.4 Honest Recycle Derivation checks PASSED successfully!");
