import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  compileWargameTurnsToSimulationResult,
  syncWargameToScenarioSimulation
} from "../design-studio/src/simulationRecycleStore.js";

console.log("[T8.5 Test] Starting Wargame-to-Simulation Recycle Bridge Verification ...");

// 1. 准备 Mock 阶段、活动与兵棋数据
const mockPhaseAction = {
  phases: [
    { id: "phase-1", name: "预警探测与电磁封控", timeWindow: "0-2h" },
    { id: "phase-2", name: "信标布设与饱和突防", timeWindow: "2-4h" }
  ]
};

const mockOv5 = {
  activities: [
    { id: "act-1", name: "广域雷达警戒感知", performer: "预警机" },
    { id: "act-2", name: "协同电磁压制", performer: "电子战无人机" },
    { id: "act-3", name: "高超声速饱和突击", performer: "突击群" }
  ]
};

const mockWargame = {
  turns: [
    {
      turnNumber: 1,
      phaseId: "phase-1",
      phaseName: "预警探测与电磁封控",
      intents: {
        blue: { text: "前推预警机建立雷达探测网", activityRefs: ["act-1"] },
        red: { text: "释放大功率宽带干扰", activityRefs: [] }
      },
      injectedEvents: [
        { id: "inj-1", title: "强电磁气象扰动", category: "环境扰动" }
      ],
      adjudication: {
        outcome: "蓝方保持局部态势感知优势，红方干扰未能阻断主通道",
        rationale: "跳频通信与抗干扰雷达算法发挥作用，探测网顺利建立。"
      },
      status: "completed"
    },
    {
      turnNumber: 2,
      phaseId: "phase-2",
      phaseName: "信标布设与饱和突防",
      intents: {
        blue: { text: "发起多向协同饱和突击", activityRefs: ["act-2", "act-3"] },
        red: { text: "机动防空单元实施近程拦阻射击", activityRefs: [] }
      },
      injectedEvents: [
        { id: "inj-2", title: "信标引导链路延迟", category: "网络扰动" }
      ],
      adjudication: {
        outcome: "红方拦截部分诱饵弹，蓝方突防通道存在局部胶着延滞",
        rationale: "信标链路抖动导致第二突击波次进入窗口推迟15分钟，互有消耗。"
      },
      status: "completed"
    }
  ]
};

// 2. 测试 compileWargameTurnsToSimulationResult 纯函数
console.log("[T8.5 Test] Testing compileWargameTurnsToSimulationResult ...");
const compiled = compileWargameTurnsToSimulationResult(mockWargame, mockPhaseAction, mockOv5);

assert.equal(compiled.status, "completed");
assert.equal(compiled.compiler, "wargame-turn-compiler");
assert.equal(compiled.sourceType, "[兵棋对抗裁决编译]");
assert.equal(compiled.phaseOutcomes.length, 2, "应对应 2 个阶段的推演成果");

// 阶段 1：顺利达成
const po1 = compiled.phaseOutcomes[0];
assert.equal(po1.phaseId, "phase-1");
assert.equal(po1.status, "achieved");
assert.equal(po1.sourceType, "[兵棋对抗裁决编译]");
assert.ok(po1.summary.includes("蓝方保持局部态势感知优势"), "应汇总回合 1 裁决表现");
assert.equal(po1.wargameTurnsCount, 1);

// 阶段 2：局部胶着延滞
const po2 = compiled.phaseOutcomes[1];
assert.equal(po2.phaseId, "phase-2");
assert.equal(po2.status, "partial");
assert.ok(po2.durationDelta.startsWith("+"), "延滞应有时差");
assert.ok(po2.lossRate.includes("兵棋对抗局部受损"), "战损应体现兵棋裁决机理");
assert.equal(po2.riskLevel, "medium");

// 活动偏差：回合 2 胶着应精准识别 act-2 与 act-3 偏差
assert.ok(compiled.activityDeviations.length >= 1, "胶着回合应提炼活动级执行偏差");
const actDev = compiled.activityDeviations.find((d) => d.activityId === "act-3");
assert.ok(actDev, "受波及的 act-3 必须被提取为偏差项");
assert.equal(actDev.sourceType, "[兵棋对抗裁决编译]");
assert.ok(actDev.actual.includes("局部胶着延滞"));
console.log("[T8.5 Test] ✓ compileWargameTurnsToSimulationResult verified cleanly.");

// 3. 测试 syncWargameToScenarioSimulation 一键同步与回填
console.log("[T8.5 Test] Testing syncWargameToScenarioSimulation ...");
const mockScenario = {
  id: "scen-bridge-1",
  simulation: {
    runs: []
  }
};

const synced = syncWargameToScenarioSimulation({
  wargame: mockWargame,
  scenario: mockScenario,
  phaseAction: mockPhaseAction,
  ov5: mockOv5
});

assert.ok(synced.scenario.simulation.runs.length >= 1, "想定中应记录兵棋编译运行");
assert.equal(synced.scenario.simulation.runs[0].adapter.id, "wargame-turn-compiler");
assert.equal(synced.stats.updatedPhasesCount, 2, "应回填 2 个阶段成果");
assert.ok(synced.phaseAction.phases[1].simulationOutcome, "阶段2应回填 outcome");
assert.equal(synced.phaseAction.phases[1].simulationOutcome.status, "partial");
assert.equal(synced.phaseAction.phases[1].simulationOutcome.sourceType, "[兵棋对抗裁决编译]");
console.log("[T8.5 Test] ✓ syncWargameToScenarioSimulation full recycle verified cleanly.");

// 4. 静态契约检查：视图与控制器
console.log("[T8.5 Test] Verifying static UI & controller contracts ...");
const viewSrc = fs.readFileSync(path.resolve("design-studio/src/scenarioView.js"), "utf8");
assert.ok(viewSrc.includes("data-action=\"sync-wargame-to-simulation\""), "视图必须提供同步按钮");

const ctrlSrc = fs.readFileSync(path.resolve("design-studio/src/scenarioController.js"), "utf8");
assert.ok(ctrlSrc.includes("sync-wargame-to-simulation"), "控制器必须处理同步 action");
assert.ok(ctrlSrc.includes("syncWargameToScenarioSimulation"), "控制器必须调用同步引擎");
assert.ok(ctrlSrc.includes("applyWithRecoveryPoint"), "同步操作必须经过撤销恢复包装");
console.log("[T8.5 Test] ✓ UI & controller integration verified cleanly.");

console.log("[T8.5 Test] ✓ All T8.5 Wargame-to-Simulation Recycle Bridge checks PASSED successfully!");
