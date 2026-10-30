import assert from "node:assert/strict";
import { renderOv6c } from "../design-studio/src/ov6cView.js";
import { buildSequenceGenerationAnalysis, ensureRequiredSequenceCoverage } from "../design-studio/src/dodafProductController.js";

console.log("Starting check-phase-sequence-generation test suite...");

// 1. 验证在 phase-action 主步骤下，ov6cView 正确感知并渲染阶段时序生成按钮
const mockStatePhase = {
  activeMainViewId: "phase-action",
  activeView: "ov6c",
  phaseAction: {
    phases: [
      { id: "p-1", name: "战略布势", blueActions: ["部署雷达"], redActions: ["电子侦察"] },
      { id: "p-2", name: "防空压制", blueActions: ["电磁压制"], redActions: ["雷达开机"] }
    ]
  }
};

const htmlPhase = renderOv6c(mockStatePhase);
assert.ok(htmlPhase.includes("AI 生成阶段时序"), "在阶段行动子流程下应展示'AI 生成阶段时序'主按钮");
assert.ok(htmlPhase.includes("data-action=\"ov6c-generate-phase-sequences\""), "应绑定 ov6c-generate-phase-sequences action");
console.log("✓ 阶段行动子流程视图按钮感知验证通过");

// 2. 验证在 force-mission 主步骤下，ov6cView 展示任务与兵力时序生成按钮
const mockStateForce = {
  activeMainViewId: "force-mission",
  activeView: "ov6c"
};
const htmlForce = renderOv6c(mockStateForce);
assert.ok(htmlForce.includes("AI 生成任务与兵力时序"), "在兵力与任务子流程下应展示'AI 生成任务与兵力时序'主按钮");
assert.ok(htmlForce.includes("data-action=\"ov6c-generate-task-force-sequences\""), "应绑定 ov6c-generate-task-force-sequences action");
console.log("✓ 兵力与任务子流程视图按钮感知验证通过");

// 3. 验证阶段分析对象生成与覆盖补齐
const fullState = {
  brief: { objective: "测试阶段时序生成" },
  phaseAction: {
    phases: [
      { id: "phase-1", name: "战略布势阶段", blueActions: ["部署预警雷达"], redActions: ["潜艇前出"] }
    ]
  },
  forceMission: {
    forces: [{ id: "force-1", name: "预警机", side: "friendly" }],
    tasks: [{ id: "task-1", name: "雷达警戒任务", side: "friendly" }]
  }
};

const analysis = buildSequenceGenerationAnalysis(fullState);
assert.equal(analysis.phases.length, 1);
assert.equal(analysis.requiredSequenceCoverage.phaseSequences.length, 1);

const covered = ensureRequiredSequenceCoverage({ sequences: [] }, fullState, analysis);
assert.equal(covered.sequences.length, 1, "应确保阶段时序覆盖");
assert.equal(covered.sequences[0].diagramType, "phase", "生成的时序图类型应为 phase");
console.log("✓ 阶段时序图覆盖补齐与属性验证通过");

console.log("All check-phase-sequence-generation tests passed successfully!");
