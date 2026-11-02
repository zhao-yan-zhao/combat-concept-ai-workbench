import assert from "node:assert/strict";
import { normalizeDodafOv5 } from "../shared/dodaf/products.js";
import { evaluateOodaLoopHealth, deriveOodaFromOv5 } from "../design-studio/src/oodaStore.js";
import { deriveActivitiesFromTasks, getActivityHierarchy } from "../design-studio/src/ov5Store.js";
import { renderOv5Workbench } from "../design-studio/src/ov5MechanismView.js";

console.log("Starting verification for OV-5 Activity Mechanism Restructuring...");

// 1. 测试 DoDAF OV-5 数据模型归一化与机理扩展字段
const rawOv5 = {
  version: 1,
  activities: [
    {
      id: "act-recon",
      type: "感知",
      title: "天基侦察与预警",
      text: "广域轨道侦察与辐射源探测",
      input: "轨道参数",
      output: "目标航迹数据包",
      duration: "10-15m",
      resources: "天基预警星座",
      performer: "天基侦察卫星-01",
      domain: "太空",
      autonomy: "HOTL",
      timingWindow: "15m",
      resilienceFallback: "天基受扰时降级转高空无人侦察机直连"
    },
    {
      id: "act-strike",
      type: "控制",
      title: "防区外协同精确突击",
      text: "发射高超音速与隐身巡航导弹",
      input: "火控引导数据",
      output: "毁伤目标",
      duration: "20-30m",
      resources: "轰炸机编组",
      performer: "远轰编队-02",
      domain: "空中",
      autonomy: "HITL",
      timingWindow: "30m",
      resilienceFallback: "中继断开时转自适应末端雷达主动寻的"
    }
  ],
  edges: [
    {
      id: "edge-1",
      sourceId: "act-recon",
      targetId: "act-strike",
      type: "控制流",
      flowSemantic: "authorization",
      latencySec: 180,
      payload: "交战授权与火控引导包"
    },
    {
      id: "edge-feedback",
      sourceId: "act-strike",
      targetId: "act-recon",
      type: "信息流",
      flowSemantic: "feedback",
      isFeedback: true,
      payload: "毁伤评估与态势更新反哺"
    }
  ]
};

const normalized = normalizeDodafOv5(rawOv5);
assert.equal(normalized.activities.length, 2, "Normalized activities count match");
assert.equal(normalized.activities[0].domain, "太空", "Preserved domain property");
assert.equal(normalized.activities[0].autonomy, "HOTL", "Preserved autonomy level");
assert.equal(normalized.activities[1].autonomy, "HITL", "Preserved HITL autonomy level");
assert.equal(normalized.activities[1].performer, "远轰编队-02", "Preserved performer property");
assert.equal(normalized.edges.length, 2, "Normalized edges count match");
assert.equal(normalized.edges[0].flowSemantic, "authorization", "Preserved semantic edge flow");
assert.equal(normalized.edges[1].isFeedback, true, "Preserved feedback edge flag");

// 2. 测试动力学评估引擎：时延预算、SPOF脆弱性与自主统计
const health = evaluateOodaLoopHealth(normalized);
assert.equal(health.loopClosed, true, "Closed loop detection must be true with feedback edge");
assert.ok(health.latencyBudget, "Must produce latency budget");
assert.ok(health.latencyBudget.totalSeconds > 0, "Must calculate positive latency in seconds");
assert.ok(health.autonomyStats, "Must produce autonomy stats");
assert.equal(health.autonomyStats.hitl, 1, "Must correctly count HITL activities");
assert.equal(health.autonomyStats.hotl, 1, "Must correctly count HOTL activities");
assert.ok(health.domainCoverage.includes("太空") && health.domainCoverage.includes("空中"), "Must calculate cross-domain coverage");

// 3. 测试任务智能派生活动网
const tasks = [
  { id: "t-1", name: "穿透侦察任务", missionType: "recon", objective: "建立深远海预警", assignedForceId: "UAV-编组" },
  { id: "t-2", name: "协同决策指挥", missionType: "c2", objective: "下达交战授权", assignedForceId: "战区指控所" },
  { id: "t-3", name: "联合突击打击", missionType: "strike", objective: "实施防区外精确毁伤", assignedForceId: "海射巡航营" }
];
const derived = deriveActivitiesFromTasks(tasks);
assert.equal(derived.activities.length, 3, "Must derive 3 activities");
assert.equal(derived.activities[0].type, "感知");
assert.equal(derived.activities[1].type, "决策");
assert.equal(derived.activities[2].type, "控制");
assert.equal(derived.activities[1].autonomy, "HITL", "Command activity must default to HITL");
assert.ok(derived.edges.some((e) => e.isFeedback), "Derived model must automatically include feedback loop");
const derivedHealth = evaluateOodaLoopHealth(derived);
assert.equal(derivedHealth.loopClosed, true, "Derived activity net must form closed OODA loop");

// 4. 测试多视角工作台渲染
const state = {
  ov5: derived,
  ov5Storage: { status: "ready", mode: "local" },
  ov5Generating: false,
  ov5ViewMode: "kill-web",
  selection: { id: derived.activities[0].id }
};

// 4.1 杀伤网因果流视
const htmlKillWeb = renderOv5Workbench(state);
assert.ok(htmlKillWeb.includes("kill-web-workspace"), "HTML must contain kill-web workspace");
assert.ok(htmlKillWeb.includes("Observe 观测感知"), "HTML must contain Observe lane");
assert.ok(htmlKillWeb.includes("Feedback 战果反哺"), "HTML must contain Feedback lane");

// 4.2 跨域同步矩阵视
state.ov5ViewMode = "sync-matrix";
const htmlSync = renderOv5Workbench(state);
assert.ok(htmlSync.includes("sync-matrix-workspace"), "HTML must contain sync-matrix workspace");
assert.ok(htmlSync.includes("作战域 / 阶段进程"), "HTML must contain domain/phase matrix grid");

// 4.3 人机决策阶梯视
state.ov5ViewMode = "autonomy";
const htmlAutonomy = renderOv5Workbench(state);
assert.ok(htmlAutonomy.includes("autonomy-ladder-workspace"), "HTML must contain autonomy ladder");
assert.ok(htmlAutonomy.includes("人在回路 (HITL"), "HTML must explain HITL level");

// 4.4 抗毁降级推演视
state.ov5ViewMode = "resilience";
state.ov5StressedNodeId = derived.activities[0].id;
const htmlResilience = renderOv5Workbench(state);
assert.ok(htmlResilience.includes("resilience-workspace"), "HTML must contain resilience workspace");
assert.ok(htmlResilience.includes("体系抗毁推演工作区"), "HTML must contain stress test banner");
assert.ok(htmlResilience.includes("正在对「"), "HTML must show active stress perturbation on selected node");

// 5. 增强验证：四大视角深化功能与联动特性

// 5.1 视角 1 验证：聚焦活动因果追踪与上下游流向指示
state.ov5ViewMode = "kill-web";
state.selection = { id: derived.activities[1].id }; // 选中协同决策活动
const htmlKillWebFocused = renderOv5Workbench(state);
assert.ok(htmlKillWebFocused.includes("聚焦链路追踪"), "Must display focused causal trace banner");
assert.ok(htmlKillWebFocused.includes("直接前驱"), "Must report direct upstream count");
assert.ok(htmlKillWebFocused.includes("直接驱动"), "Must report direct downstream count");

// 5.2 视角 2 验证：深度联动 Step 2 自定义作战阶段
state.ov5ViewMode = "sync-matrix";
state.phaseAction = {
  phases: [
    { id: "custom-p1", name: "天基侦察与渗透预警阶段", timeWindow: "T+00~T+20" },
    { id: "custom-p2", name: "跨域协同精确打击阶段", timeWindow: "T+20~T+45" },
    { id: "custom-p3", name: "效果评估与自愈恢复阶段", timeWindow: "T+45~T+60" }
  ]
};
const htmlSyncLinked = renderOv5Workbench(state);
assert.ok(htmlSyncLinked.includes("已深度联动 Step 2 自定义作战阶段"), "Must display custom phase link badge");
assert.ok(htmlSyncLinked.includes("天基侦察与渗透预警阶段"), "Must render custom phase column title");
assert.ok(htmlSyncLinked.includes("T+20~T+45"), "Must render custom phase timing window badge");

// 5.3 视角 3 验证：自主权分配按钮与军事伦理合规审查
state.ov5ViewMode = "autonomy";
const htmlAutonomyActions = renderOv5Workbench(state);
assert.ok(htmlAutonomyActions.includes("change-activity-autonomy"), "Must include autonomy switch buttons");

// 构造致命打击配置为 HOOTL 的伦理违规样本
const ethicsViolationModel = {
  ...derived,
  activities: [
    ...derived.activities,
    { id: "act-lethal-hootl", type: "控制", title: "远程自主高超音速打击", autonomy: "HOOTL", domain: "空中" }
  ]
};
const stateViolation = { ...state, ov5: ethicsViolationModel };
const htmlEthicsAlert = renderOv5Workbench(stateViolation);
assert.ok(htmlEthicsAlert.includes("军事伦理与交战规则 (ROE) 审查预警"), "Must trigger ethics guard alert when lethal strike is HOOTL");
assert.ok(htmlEthicsAlert.includes("远程自主高超音速打击"), "Must list the violating lethal activity");

// 5.4 视角 4 验证：预设战损场景与动态抗毁韧性指标仪
state.ov5ViewMode = "resilience";
state.ov5StressedNodeId = derived.activities[0].id;
const htmlResilienceMetrics = renderOv5Workbench(state);
assert.ok(htmlResilienceMetrics.includes("resilience-meter-strip"), "Must render dynamic resilience meter strip");
assert.ok(htmlResilienceMetrics.includes("抗毁韧性评级"), "Must calculate resilience grade");
assert.ok(htmlResilienceMetrics.includes("天基全盲"), "Must provide space domain stress preset button");
assert.ok(htmlResilienceMetrics.includes("电磁强压制"), "Must provide electronic domain stress preset button");
assert.ok(htmlResilienceMetrics.includes("指挥所瘫痪"), "Must provide C2 failure stress preset button");

// 6. 验证活动属性编辑面板与卡片编辑入口
state.selection = { id: derived.activities[0].id };
const htmlEditorPanel = renderOv5Workbench(state);
assert.ok(htmlEditorPanel.includes("is-editor-panel"), "Must render activity editor panel when activity selected");
assert.ok(htmlEditorPanel.includes("ov5ActivityForm"), "Must include ov5ActivityForm for attribute editing");
assert.ok(htmlEditorPanel.includes("performer-input"), "Must provide performer input field for force/platform binding");
assert.ok(htmlEditorPanel.includes("card-inline-edit-btn"), "Must render inline edit button on activity cards");
assert.ok(htmlEditorPanel.includes("ov5EdgeForm"), "Must provide edge form to establish downstream causal relations");

// 验证取消选中时切换为架构树
state.selection = null;
const htmlTreePanel = renderOv5Workbench(state);
assert.ok(htmlTreePanel.includes("is-tree-panel"), "Must render tree panel when no activity selected");
assert.ok(htmlTreePanel.includes("ov5-tree-tip-banner"), "Must render helpful tip banner instructing to edit");

console.log("All OV-5 Activity Mechanism Restructuring checks passed successfully!");
