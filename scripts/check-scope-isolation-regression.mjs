import assert from "node:assert/strict";
import { isStepStale } from "../design-studio/src/app/workflowGate.js";

console.log("Running scope isolation & stale propagation tests...");

// 1. 模拟状态：阶段行动（主步骤2）已确认，兵力（主步骤3）有变动
const statePhaseOnly = {
  workflowMainline: {
    steps: [
      { id: "02", name: "阶段行动" },
      { id: "03", name: "任务与兵力" }
    ]
  },
  phaseActionStorage: {
    stale: false,
    confirmedAt: "2026-10-29T10:00:00Z"
  },
  forceMissionStorage: {
    stale: true, // 兵力刚变动
    confirmedAt: null
  },
  ov6cStorage: {
    stale: false
  }
};

// 验证1：在阶段行动（02）子流程下，ov6c 不应受 forceMissionStorage.stale 影响！
const ov6cStaleInPhase = isStepStale("ov6c", statePhaseOnly, { activeMainViewId: "phase-action" });
assert.strictEqual(ov6cStaleInPhase, false, "阶段时序图不应受兵力状态过期污染");

// 验证2：在任务与兵力（03）子流程下，ov6c 应该感知兵力过期
const ov6cStaleInForce = isStepStale("ov6c", statePhaseOnly, { activeMainViewId: "force-mission" });
assert.strictEqual(ov6cStaleInForce, true, "任务与兵力时序图应感知兵力过期");

// 验证3：阶段行动本身（02）绝不能因为兵力更新而变黄
const phaseStepStale = isStepStale("02", statePhaseOnly);
assert.strictEqual(phaseStepStale, false, "主步骤02阶段行动绝不能反向被兵力标记为过期");

console.log("✓ 隔离与单向下行传导逻辑完全验证通过！");
