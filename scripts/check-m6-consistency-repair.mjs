import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  enrichIssuesWithLocatorAndRepair,
  applyIssueRepair
} from "../design-studio/src/consistencyLocatorStore.js";
import {
  generateValidation
} from "../design-studio/src/validationStore.js";
import {
  createValidationController
} from "../design-studio/src/validationController.js";

console.log("--- 运行 M6-T6.4 一致性问题一键定位与自动修复专项测试 ---");

// Mock 数据准备：故意制造3类可自动修复的一致性问题
const mockOv5 = {
  activities: [
    { id: "act-1", title: "广域预警", input: "雷达回波", output: "态势信息", performer: "预警机" },
    { id: "act-2", title: "协同突防", input: "待定义", output: "待定义", performer: "无人机群" }, // 触发输入输出待定义
    { id: "act-3", title: "精确打击", input: "目标数据", output: "毁伤效果", performer: "巡航导弹" }  // 孤立无输入连接
  ],
  edges: [
    { id: "edge-1", sourceId: "act-1", targetId: "act-2", type: "信息流" }
  ]
};

const mockOoda = {
  durationMinutes: 0,
  lanes: [
    {
      id: "lane-observe",
      title: "感知",
      subtitle: "Observe",
      nodes: [
        { id: "node-obs-1", title: "雷达侦察", duration: "待估算", rule: "连续搜索" }
      ]
    }
  ],
  sourceActivityIds: ["act-1"]
};

const mockScenario = {
  id: "scenario-001",
  entities: [
    { id: "ent-1", label: "侦察无人机", role: "sensor", position: [10, 20], sourceActivityId: "act-1" },
    { id: "ent-2", label: "突击单元", role: "action", position: [30, 40], sourceActivityId: "" } // 触发实体来源未关联
  ],
  areas: [],
  timeline: []
};

const mockOv1 = {
  nodes: [
    { id: "ov1-node-1", label: "空海协同节点" }
  ],
  edges: []
};

// 1. 测试运行验证并丰富定位与修复元数据
console.log("1. 测试验证问题生成与定位元数据丰富...");
const valResult = generateValidation(mockOv5, mockOoda, mockScenario, mockOv1);
assert.ok(valResult.issues.length >= 3, "应生成至少 3 项一致性问题");

valResult.issues.forEach((issue) => {
  assert.ok(issue.targetView, "每个问题必须包含目标视图 targetView");
  assert.ok(["ov5", "ooda", "scenario", "ov1", "phase-action"].includes(issue.targetView), "targetView 必须为有效视图");
  assert.ok(issue.targetViewLabel, "必须包含友好的视图中文标签");
  assert.equal(typeof issue.repairable, "boolean", "必须显式声明 repairable 布尔值");
});
console.log("✓ 定位元数据丰富验证通过");

// 2. 测试可修复规则识别与修复方案
console.log("2. 测试可自动修复问题识别与修复方案...");
const ioIssue = valResult.issues.find((i) => i.title.includes("输入输出待定义"));
assert.ok(ioIssue, "必须检出输入输出待定义问题");
assert.equal(ioIssue.repairable, true, "输入输出问题应支持自动修复");
assert.equal(ioIssue.targetView, "ov5");
assert.equal(ioIssue.repairPlan?.type, "fill-activity-io");
assert.ok(ioIssue.repairPlan?.label.includes("输入输出"), "修复方案标签应清晰说明操作");

const linkIssue = valResult.issues.find((i) => i.title.includes("活动关联缺失"));
assert.ok(linkIssue, "必须检出活动关联缺失问题");
assert.equal(linkIssue.repairable, true, "孤立活动问题应支持自动修复");
assert.equal(linkIssue.repairPlan?.type, "link-activity-upstream");

const entityIssue = valResult.issues.find((i) => i.title.includes("实体来源不完整"));
assert.ok(entityIssue, "必须检出实体来源不完整问题");
assert.equal(entityIssue.repairable, true, "实体未关联活动应支持自动修复");
assert.equal(entityIssue.repairPlan?.type, "link-entity-activity");
console.log("✓ 自动修复方案识别验证通过");

// 3. 测试执行修复操作并核验模型变化
console.log("3. 测试执行自动修复与模型完整性...");
const mockState = {
  ov5: JSON.parse(JSON.stringify(mockOv5)),
  ooda: JSON.parse(JSON.stringify(mockOoda)),
  scenario: JSON.parse(JSON.stringify(mockScenario)),
  ov1: JSON.parse(JSON.stringify(mockOv1)),
  validationResult: valResult
};

// 执行修复 1：补齐输入输出
const res1 = applyIssueRepair(mockState, ioIssue);
assert.equal(res1.modifiedDomain, "ov5");
const repairedAct2 = mockState.ov5.activities.find((a) => a.id === "act-2");
assert.notEqual(repairedAct2.input, "待定义", "修复后输入不应为待定义");
assert.notEqual(repairedAct2.output, "待定义", "修复后输出不应为待定义");
assert.equal(repairedAct2.performer, "无人机群", "原活动属性应完好保留");

// 执行修复 2：连接孤立活动
const res2 = applyIssueRepair(mockState, linkIssue);
assert.equal(res2.modifiedDomain, "ov5");
const newEdge = mockState.ov5.edges.find((e) => e.targetId === linkIssue.sourceId);
assert.ok(newEdge, "修复后应新增连接至目标活动的关系边");

// 执行修复 3：关联实体来源
const res3 = applyIssueRepair(mockState, entityIssue);
assert.equal(res3.modifiedDomain, "scenario");
const repairedEnt2 = mockState.scenario.entities.find((e) => e.id === "ent-2");
assert.ok(repairedEnt2.sourceActivityId, "修复后实体应成功关联来源活动");
console.log("✓ 自动修复应用与模型完整性验证通过");

// 4. 测试修复后重新验证问题消除与质量提升
console.log("4. 测试修复后重新运行验证...");
const afterResult = generateValidation(mockState.ov5, mockState.ooda, mockState.scenario, mockState.ov1);
assert.ok(afterResult.issues.length < valResult.issues.length, "修复后问题总数应明显下降");
assert.ok(!afterResult.issues.some((i) => i.title === "活动输入输出待定义"), "活动输入输出待定义问题应彻底解决");
assert.ok(!afterResult.issues.some((i) => i.title.includes("活动关联缺失") && i.sourceId === "act-3"), "act-3 的关联缺失问题应已修复");
console.log("✓ 重新验证闭环与问题消除验证通过");

// 5. 测试控制器事务包装与操作响应
console.log("5. 测试控制器事务包装与一键定位/修复...");
let recoveryPointCaptured = null;
let transactionExecuted = false;
let notifiedMessage = "";

const controller = createValidationController({
  getState: () => mockState,
  render: () => {},
  notify: (msg) => { notifiedMessage = msg; },
  syncValidation: () => {},
  syncOv5: () => {},
  syncScenario: () => {},
  syncOoda: () => {},
  applyWithRecoveryPoint: async (meta, mutate) => {
    transactionExecuted = true;
    recoveryPointCaptured = meta;
    await mutate();
    return true;
  }
});

// 测试跳转定位 action
const locateHandled = await controller.handleAction("locate-validation-issue", {
  dataset: { issueId: linkIssue.id }
});
assert.equal(locateHandled, true, "应成功处理定位 action");
assert.equal(mockState.activeView, linkIssue.targetView, "activeView 应切换至目标视图");
assert.ok(notifiedMessage.includes("跳转至"), "应弹出跳转提示");

// 测试一键修复 action
const repairHandled = await controller.handleAction("repair-validation-issue", {
  dataset: { issueId: ioIssue.id }
});
assert.equal(repairHandled, true, "应成功处理修复 action");
assert.equal(transactionExecuted, true, "必须走 applyWithRecoveryPoint 事务包装");
assert.ok(recoveryPointCaptured.label.includes("自动修复"), "事务标签应清晰表达修复内容");
assert.equal(recoveryPointCaptured.source, "consistency-repair", "来源必须标记为 consistency-repair");
console.log("✓ 控制器事务包装与操作流转验证通过");

// 6. 前端视图与控制器静态契约断言
console.log("6. 测试前端视图与控制器静态契约...");
const viewSrc = fs.readFileSync(path.resolve("design-studio/src/validationView.js"), "utf8");
assert.ok(viewSrc.includes("locate-validation-issue"), "视图必须提供 locate-validation-issue 定位按钮");
assert.ok(viewSrc.includes("repair-validation-issue"), "视图必须提供 repair-validation-issue 修复按钮");
assert.ok(viewSrc.includes("renderIssueCard"), "视图必须使用专用组件渲染增强问题卡片");

const controllerSrc = fs.readFileSync(path.resolve("design-studio/src/validationController.js"), "utf8");
assert.ok(controllerSrc.includes("locate-validation-issue"), "控制器必须支持 locate-validation-issue");
assert.ok(controllerSrc.includes("repair-validation-issue"), "控制器必须支持 repair-validation-issue");
assert.ok(controllerSrc.includes("applyWithRecoveryPoint"), "控制器必须支持事务包装器注入");

console.log("✓ 前端视图与控制器静态契约验证通过");

console.log("--- M6-T6.4 全部测试断言 PASS (100% 成功) ---");
