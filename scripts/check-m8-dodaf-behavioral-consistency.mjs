/**
 * 验收脚本：M8-T8.10 DoDAF 跨视图行为形式化校验（OV-6b 状态机死锁检测 + OV-6c/OV-5b 因果偏序校验）
 */
import assert from "node:assert/strict";
import {
  inspectOv6bStateMachine,
  inspectCausalEventOrdering,
  inspectArchitectureConsistency
} from "../shared/dodaf/consistency.js";
import { generateValidation } from "../design-studio/src/validationStore.js";

console.log("=== 1. 检验 OV-6b 状态机死锁与不可达检测纯函数 ===");
const normalStateMachine = {
  states: [
    { id: "s-init", label: "初始战术准备" },
    { id: "s-patrol", label: "前沿巡逻监视" },
    { id: "s-engage", label: "协同火力突击" },
    { id: "s-rtb", label: "编队归航待机" }
  ],
  transitions: [
    { id: "t-1", sourceId: "s-init", targetId: "s-patrol" },
    { id: "t-2", sourceId: "s-patrol", targetId: "s-engage" },
    { id: "t-3", sourceId: "s-engage", targetId: "s-rtb" }
  ]
};
const normalResult = inspectOv6bStateMachine(normalStateMachine);
assert.equal(normalResult.unreachableStates.length, 0, "正常状态机不应有不可达状态");
assert.equal(normalResult.deadlockStates.length, 0, "正常状态机不应有死锁状态");
assert.equal(normalResult.issues.length, 0, "正常状态机不应产生 issues");

// 注入死锁（突防态没有出边，且名称非终止态）与孤立态（应急态无入边）
const flawedStateMachine = {
  states: [
    { id: "s-init", label: "初始战术准备" },
    { id: "s-patrol", label: "前沿巡逻监视" },
    { id: "s-deadlock", label: "高威胁区域突防" }, // 非终止态，无出边 -> 死锁黑洞
    { id: "s-isolated", label: "备用应急机动" }   // 非初始态，无入边 -> 不可达
  ],
  transitions: [
    { id: "t-1", sourceId: "s-init", targetId: "s-patrol" },
    { id: "t-2", sourceId: "s-patrol", targetId: "s-deadlock" }
    // s-deadlock 无出边，s-isolated 无入边
  ]
};
const flawedResult = inspectOv6bStateMachine(flawedStateMachine);
assert.equal(flawedResult.deadlockStates.length, 1, "必须检出 1 个死锁状态");
assert.equal(flawedResult.deadlockStates[0].id, "s-deadlock", "死锁状态 ID 正确");
assert.equal(flawedResult.unreachableStates.length, 1, "必须检出 1 个不可达孤立状态");
assert.equal(flawedResult.unreachableStates[0].id, "s-isolated", "不可达状态 ID 正确");
assert.ok(flawedResult.issues.some((i) => i.title.includes("死锁")), "应产生死锁 issue");
assert.ok(flawedResult.issues.some((i) => i.title.includes("不可达")), "应产生不可达 issue");
console.log("✓ OV-6b 状态机死锁与不可达检测纯函数验证通过");

console.log("=== 2. 检验 OV-5b/OV-6c 因果偏序校验纯函数 (inspectCausalEventOrdering) ===");
const ov5Model = {
  activities: [
    { id: "act-recon", title: "前沿空情搜集" },
    { id: "act-strike", title: "突防火力打击" },
    { id: "act-assess", title: "毁伤评估" }
  ],
  edges: [
    { id: "e1", sourceId: "act-recon", targetId: "act-strike", type: "前向控制流" },
    { id: "e2", sourceId: "act-strike", targetId: "act-assess", type: "前向协同流" },
    { id: "e3", sourceId: "act-assess", targetId: "act-strike", type: "战术反馈闭环" } // 反馈边
  ]
};

// 正序事件时间线
const forwardEvents = {
  events: [
    { id: "ev-1", sequence: 1, offsetMinutes: 5, sourceActivityId: "act-recon", title: "搜集雷达信号" },
    { id: "ev-2", sequence: 2, offsetMinutes: 15, sourceActivityId: "act-strike", title: "发起协同突击" },
    { id: "ev-3", sequence: 3, offsetMinutes: 25, sourceActivityId: "act-assess", title: "执行毁伤确认" }
  ]
};
const fwdCheck = inspectCausalEventOrdering(ov5Model, forwardEvents);
assert.equal(fwdCheck.inversions.length, 0, "正序事件流不应存在逆序");

// 逆序事件时间线：打击居然在侦察之前发生！
const invertedEvents = {
  events: [
    { id: "ev-strike", sequence: 1, offsetMinutes: 5, sourceActivityId: "act-strike", title: "突击机群开火" },
    { id: "ev-recon", sequence: 2, offsetMinutes: 15, sourceActivityId: "act-recon", title: "开始侦察雷达" }
  ]
};
const invCheck = inspectCausalEventOrdering(ov5Model, invertedEvents);
assert.equal(invCheck.inversions.length, 1, "必须检出 1 项因果时序逆序");
assert.equal(invCheck.inversions[0].sourceActivityId, "act-recon");
assert.equal(invCheck.inversions[0].targetActivityId, "act-strike");
assert.ok(invCheck.issues[0].detail.includes("违背 OV-5b 因果偏序契约"));
console.log("✓ OV-5b/OV-6c 因果偏序校验纯函数验证通过");

console.log("=== 3. 检验跨产品一致性架构审查 (inspectArchitectureConsistency) 集成 ===");
const archResult = inspectArchitectureConsistency({
  ov5: ov5Model,
  ov6b: flawedStateMachine,
  ov6c: invertedEvents
});
assert.ok(archResult.issues.some((i) => i.code === "ov6b-deadlock-state"), "架构审查需包含 OV-6b 死锁检查");
assert.ok(archResult.issues.some((i) => i.code === "ov6b-unreachable-state"), "架构审查需包含 OV-6b 不可达检查");
assert.ok(archResult.issues.some((i) => i.code === "causal-inversion"), "架构审查需包含跨视图因果时序逆序检查");
console.log("✓ 跨产品一致性架构审查集成校验通过");

console.log("=== 4. 检验验证引擎 (generateValidation) 形式化诊断与视图定位 ===");
const baseOoda = {
  lanes: [
    { id: "l1", nodes: [{ id: "o1", title: "侦察", duration: "10m", input: "信号", output: "报文", sourceActivityId: "act-recon" }] },
    { id: "l2", nodes: [{ id: "o2", title: "打击", duration: "10m", input: "报文", output: "战果", sourceActivityId: "act-strike" }] }
  ]
};
const invertedScenario = {
  id: "sc-inverted",
  entities: [
    { id: "ent-1", label: "突击编队", role: "action", sourceActivityId: "act-strike" },
    { id: "ent-2", label: "侦察无人机", role: "sensor", sourceActivityId: "act-recon" }
  ],
  timeline: [
    { id: "t-1", time: "+00:05", title: "突击机群开火", sourceNodeId: "o2" },
    { id: "t-2", time: "+00:20", title: "雷达开机搜索", sourceNodeId: "o1" }
  ]
};

const validationResult = generateValidation(ov5Model, baseOoda, invertedScenario, null, {
  ov6b: flawedStateMachine
});

// 检查因果逆序 issue
const causalIssue = validationResult.issues.find((i) => i.title === "时序因果逆序");
assert.ok(causalIssue, "验证引擎必须报出时序因果逆序");
assert.equal(causalIssue.level, "high", "时序因果逆序应为 high 级问题");
assert.equal(causalIssue.targetView, "ov5", "因果逆序定位到 ov5 活动视图");

// 检查 OV-6b 死锁 issue
const deadlockIssue = validationResult.issues.find((i) => i.title.includes("OV-6b 存在状态死锁黑洞"));
assert.ok(deadlockIssue, "验证引擎必须报出状态死锁黑洞");
assert.equal(deadlockIssue.targetView, "ov6", "死锁问题定位目标视图必须为 ov6");
assert.equal(deadlockIssue.targetElementId, "s-deadlock", "死锁定位元素 ID 为 s-deadlock");

console.log("✓ 验证引擎自动诊断、评级与精准定位通过");
console.log("\n>>> M8-T8.10 DoDAF 跨视图行为形式化校验全量通过！ <<<");
