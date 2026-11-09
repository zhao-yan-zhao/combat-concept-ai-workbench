// @ts-check
import assert from "node:assert/strict";
import {
  resolveStepTargetOutput,
  getStepIncompleteReasons,
  resolveWorkflowGateContext,
  renderStepNextBar,
  renderWorkflowGate
} from "../design-studio/src/app/workflowGate.js";
import { renderForceResourceSubflowBar } from "../design-studio/src/forceResourceSubflowNav.js";

console.log("=== 验证任务与兵力子步骤产出与完成条件动态门禁 (check-subflow-step-gate-conditions) ===");

// 1. 测试各子步骤目标产出文本映射
const subviewExpectations = [
  { view: "operational-task", expected: "作战任务分解清单与任务区域核定" },
  { view: "ov1b", expected: "作战任务层级归集与任务群编组 (OV-1b)" },
  { view: "ov6a", expected: "作战任务与兵力战法语义规则库 (OV-6a)" },
  { view: "ov6b", expected: "任务与平台装备状态转换自动机 (OV-6b)" },
  { view: "ov6c", expected: "作战任务协同与事件因果时序追踪图 (OV-6c)" },
  { view: "ov4", expected: "作战部队编制指挥与协同组织关系 (OV-4)" },
  { view: "ov2", expected: "作战节点间信息交互与作战资源流 (OV-2)" },
  { view: "ov3", expected: "作战资源交互矩阵与频次时序约束 (OV-3)" }
];

for (const item of subviewExpectations) {
  const output = resolveStepTargetOutput(item.view, null, { mainViewId: "force-mission" });
  assert.equal(output, item.expected, `视图 ${item.view} 的产出目标应为 ${item.expected}`);
}
console.log("✓ 1. 任务与兵力各子步骤产出目标规格准确无误");

// 2. 测试在无产出情况下，完成条件必须显示未就绪/还差项，严禁显示“已就绪 (0项待补充)”
const baseState = {
  activeProjectId: "test-proj",
  projectDirectory: {
    projects: [
      { id: "test-proj", workflow: { version: 2, completedThrough: 1, mode: "gated" } }
    ]
  },
  forceMission: {
    tasks: [],
    forces: [],
    combatForces: []
  },
  relatedModelReturnContext: { mainViewId: "force-mission" },
  ov6a: { rules: [] },
  ov6b: { stateMachines: [] },
  ov6c: { sequences: [] },
  ov4: { relations: [] },
  ov2: { exchanges: [] },
  ov3: { exchanges: [] },
  ov1b: { taskGroups: [] }
};

for (const item of subviewExpectations) {
  const state = { ...baseState, activeView: item.view };
  const ctx = resolveWorkflowGateContext(state);
  assert.equal(ctx.ready, false, `视图 ${item.view} 在无产出时 ready 必须为 false`);
  assert(ctx.incompleteReasons.length > 0, `视图 ${item.view} 必须列出待完成项`);

  const barHtml = renderStepNextBar(state);
  assert(!barHtml.includes("已就绪 (0项待补充)"), `视图 ${item.view} 无产出时严禁出现“已就绪 (0项待补充)”`);
  assert(barHtml.includes("is-pending"), `视图 ${item.view} 必须呈现 is-pending 状态`);
  assert(barHtml.includes("还差"), `视图 ${item.view} 必须提示“还差 X 项”`);
}
console.log("✓ 2. 无产出情况下完成条件严格阻断并提示待完成项（杜绝假就绪）");

// 3. 测试有产出情况下，完成条件正确显示“已就绪 (0项待补充)”
const populatedSubflowState = {
  ...baseState,
  forceMission: {
    tasks: [{ id: "task-1", name: "区域防空" }],
    tasksConfirmedAt: "2026-11-09T10:00:00Z",
    forces: [{ id: "force-1", name: "防空群", task: "task-1" }],
    combatForces: [{ id: "cf-1", name: "红旗9连", task: "task-1", missionType: "air_defense" }],
    status: "confirmed"
  },
  ov6a: {
    rules: [{ id: "rule-1", forceBindings: ["force-1"], taskBindings: ["task-1"] }]
  },
  ov6b: {
    stateMachines: [{ id: "sm-1", subjectType: "force", states: ["待命", "作战"] }]
  },
  ov6c: {
    sequences: [{ id: "seq-1", diagramType: "force", lifelines: [] }]
  },
  ov4: {
    relations: [{ from: "cf-1", to: "force-1", type: "command" }]
  },
  ov2: {
    exchanges: [{ id: "flow-1", source: "cf-1", target: "force-1" }]
  },
  ov3: {
    exchanges: [{ id: "matrix-1" }]
  },
  ov1b: {
    taskGroups: [{ id: "grp-1", name: "防空组" }]
  }
};

for (const item of subviewExpectations) {
  const state = { ...populatedSubflowState, activeView: item.view };
  const ctx = resolveWorkflowGateContext(state);
  assert.equal(ctx.ready, true, `视图 ${item.view} 在有产出时 ready 必须为 true`);
  assert.equal(ctx.incompleteReasons.length, 0, `视图 ${item.view} 在有产出时 incompleteReasons 必须为空`);

  const barHtml = renderStepNextBar(state);
  assert(barHtml.includes("已就绪 (0项待补充)"), `视图 ${item.view} 有产出时必须显示“已就绪 (0项待补充)”`);
  assert(barHtml.includes("is-ready"), `视图 ${item.view} 必须呈现 is-ready 状态`);
}
console.log("✓ 3. 产出完成后完成条件正确流转为已就绪");

// 4. 测试兵力主线顶栏子流程导航 (forceResourceSubflowNav) 对 ov6a/b/c 动态状态的评估
const emptyNavHtml = renderForceResourceSubflowBar(baseState, "force-mission");
assert(!emptyNavHtml.includes('class="subflow-pipeline-pill is-ready" data-related-model="true" data-view="ov6a"'), "ov6a 无产出时不得带有 is-ready");
assert(!emptyNavHtml.includes('class="subflow-pipeline-pill is-ready" data-related-model="true" data-view="ov6b"'), "ov6b 无产出时不得带有 is-ready");
assert(!emptyNavHtml.includes('class="subflow-pipeline-pill is-ready" data-related-model="true" data-view="ov6c"'), "ov6c 无产出时不得带有 is-ready");
assert(emptyNavHtml.includes("待生成"), "ov6a/b/c 无产出时必须标示“待生成”");

const populatedNavHtml = renderForceResourceSubflowBar(populatedSubflowState, "force-mission");
assert(populatedNavHtml.includes('class="subflow-pipeline-pill is-ready" data-related-model="true" data-view="ov6a"'), "ov6a 有产出时应带有 is-ready");
assert(populatedNavHtml.includes("1 规则"), "ov6a 有产出时呈现具体规则计数");
assert(populatedNavHtml.includes("1 状态机"), "ov6b 有产出时呈现具体状态机计数");
assert(populatedNavHtml.includes("1 时序"), "ov6c 有产出时呈现具体时序计数");
console.log("✓ 4. 兵力子流程导航条对 ov6a/b/c 状态与数量感知完全动态化");

console.log("\n=== 任务与兵力子步骤产出与完成条件门禁全部验证通过！ ===");
