import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { summarizeUpstreamContextForOv5, createOv5AiController } from "../design-studio/src/ov5AiController.js";
import { isStepGenerated, isStepStale } from "../design-studio/src/app/workflowGate.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("=== 1. 测试 summarizeUpstreamContextForOv5 上游上下文提取 ===");
const mockState = {
  brief: {
    objective: "验证联合封控与反介入作战能力",
    approach: "以无人蜂群协同与远程精确打击破击敌关键网络节点",
    expectedEffects: "夺取电磁与制空优势，压缩敌反应窗口",
    risk: "强电磁干扰导致信息链路断续"
  },
  direction: "稳控塑势",
  phaseAction: {
    phases: [
      { id: "p1", name: "远程侦巡与电磁压制", timing: "0-20m", coreAction: "无人侦察机前出建立态势" },
      { id: "p2", name: "协同突击与通道封控", timing: "20-50m", coreAction: "有人无人协同突击关键目标" },
      { id: "p3", name: "效果评估与反哺重组", timing: "50-70m", coreAction: "毁伤评估并滚动调整任务" }
    ]
  },
  forceMission: {
    tasks: [
      { id: "task-01", name: "战场高空侦巡", missionType: "recon", assignedForceId: "force-recon-1", area: { name: "外围空域A" }, objective: "连续获取目标航迹", expectedEffect: "提供火控级指示" },
      { id: "task-02", name: "纵深联合突击", missionType: "strike", assignedForceId: "force-strike-1", area: { name: "核心要地B" }, objective: "摧毁关键指挥通信枢纽", expectedEffect: "瘫痪体系控制能力" },
      { id: "task-03", name: "跨域协同指挥", missionType: "c2", assignedForceId: "force-c2-1", objective: "统一动态授权与任务分发" }
    ],
    forces: [
      { id: "force-recon-1", name: "高空长航时无人侦察机编队", domain: "空中", platformType: "无侦-8/10", role: "侦察预警", weapons: "光电/雷达载荷" },
      { id: "force-strike-1", name: "隐身歼击机突击分队", domain: "空中", platformType: "歼-20/歼-16", role: "远程突击", weapons: "空地隐身巡航导弹" },
      { id: "force-c2-1", name: "前指空中指挥所", domain: "空中", platformType: "空警-500", role: "指挥决策", weapons: "联合战术数据链" }
    ]
  },
  ov2: {
    nodes: [
      { id: "node-1", name: "空中侦巡预警节点" },
      { id: "node-2", name: "突击交战突防节点" },
      { id: "node-3", name: "战术协同指挥节点" }
    ],
    exchanges: [
      { source: "空中侦巡预警节点", target: "战术协同指挥节点", payload: "火控级目标航迹数据包", frequency: "实时(5s)" },
      { source: "战术协同指挥节点", target: "突击交战突防节点", payload: "动态打击授权与交战规划", frequency: "近实时(15s)" }
    ]
  },
  ov3: {
    exchanges: [
      { source: "空中侦巡预警节点", target: "战术协同指挥节点", payload: "火控级目标航迹数据包", frequency: "实时(5s)" },
      { source: "战术协同指挥节点", target: "突击交战突防节点", payload: "动态打击授权与交战规划", frequency: "近实时(15s)" }
    ]
  }
};

const upstreamContext = summarizeUpstreamContextForOv5(mockState);
assert.equal(upstreamContext.tasks.length, 3, "必须提取出3项作战任务");
assert.equal(upstreamContext.forces.length, 3, "必须提取出3个参战兵力");
assert.equal(upstreamContext.exchanges.length, 2, "必须提取出2项资源流交换契约");
assert.equal(upstreamContext.phases.length, 3, "必须提取出3个作战阶段");
assert(upstreamContext.tasksText.includes("战场高空侦巡"), "tasksText 必须包含战场高空侦巡任务");
assert(upstreamContext.forcesText.includes("高空长航时无人侦察机编队"), "forcesText 必须包含侦察机编队");
assert(upstreamContext.exchangesText.includes("火控级目标航迹数据包"), "exchangesText 必须包含交换载荷");
assert(upstreamContext.phasesText.includes("远程侦巡与电磁压制"), "phasesText 必须包含作战阶段");
console.log("✓ 上游上下文结构化提取验证通过");

console.log("=== 2. 测试 createOv5AiController.generateOv5 触发与数据关联 ===");
const testState = structuredClone(mockState);
testState.ov5 = { activities: [], edges: [] };
testState.knowledge = [];
testState.knowledgeStorage = {};

let rendered = false;
let notifiedMsg = "";
const ov5Controller = createOv5AiController({
  getState: () => testState,
  render: () => { rendered = true; },
  notify: (msg) => { notifiedMsg = msg; },
  invalidateDerivedArtifacts: () => {},
  syncOv5: async () => {},
  syncOoda: async () => {}
});

assert(typeof ov5Controller.generateOv5 === "function", "ov5AiController 必须对外暴露 generateOv5 方法");
assert(typeof ov5Controller.summarizeUpstreamContext === "function", "ov5AiController 必须对外暴露 summarizeUpstreamContext 方法");

// 执行生成
await ov5Controller.generateOv5({ force: true, silent: false });
assert(testState.ov5.activities.length >= 6, "OV-5 必须生成不少于6个作战活动");
assert(testState.ov5.edges.length >= 5, "OV-5 必须生成因果边");

// 验证反馈闭环
const feedbackEdge = testState.ov5.edges.find((e) => e.isFeedback || e.flowSemantic === "feedback");
assert(feedbackEdge, "生成的 OV-5 必须包含反馈闭环边");

// 验证上游任务与兵力已注入活动
const reconAct = testState.ov5.activities.find((a) => a.id === "ov5-sense");
assert(reconAct, "必须存在感知活动 ov5-sense");
assert.equal(reconAct.sourceTaskId, "task-01", "感知活动必须自动绑定上游任务 task-01");
assert(reconAct.performer.includes("无人侦察机"), "感知活动执行主体必须包含无人侦察机");

const strikeAct = testState.ov5.activities.find((a) => a.id === "ov5-act");
assert(strikeAct, "必须存在行动突击活动 ov5-act");
assert.equal(strikeAct.sourceTaskId, "task-02", "行动突击活动必须自动绑定上游任务 task-02");

console.log("✓ ov5AiController.generateOv5 闭环生成与上游数据绑定验证通过");

console.log("=== 3. 测试 workflowGate 胶囊识别 (isStepGenerated & isStepStale) ===");
testState.ov5a = { decomposition: [{ id: "act-1", title: "活动1" }] };
testState.ov1c = { mappings: [{ id: "map-1", taskRef: "task-01", activityRefs: ["ov5-sense"] }] };
testState.ov7 = { mappings: [{ id: "map-2", sourceRef: "state-1", activityRefs: ["ov5-act"] }] };

assert(isStepGenerated("ov5", testState), "ov5 必须被识别为已生成");
assert(isStepGenerated("ov5a", testState), "ov5a 必须被识别为已生成");
assert(isStepGenerated("ov1c", testState), "ov1c 必须被识别为已生成");
assert(isStepGenerated("ov7", testState), "ov7 必须被识别为已生成");

testState.ov5Storage = { stale: true };
assert(isStepStale("ov5", testState), "ov5 应根据 ov5Storage 标记 stale");
assert(isStepStale("ov5a", testState), "ov5a 应跟随 ov5Storage 标记 stale");
assert(isStepStale("ov1c", testState), "ov1c 应跟随 ov5Storage 标记 stale");
assert(isStepStale("ov7", testState), "ov7 应跟随 ov5Storage 标记 stale");
console.log("✓ workflowGate 步骤状态判定与流转门禁验证通过");

console.log("=== 4. 静态检查 main.js 与 dodafProductController.js 路由连通性 ===");
const mainContent = fs.readFileSync(path.join(projectRoot, "design-studio/src/main.js"), "utf8");
assert(mainContent.includes('if (viewId === "ov5" && (generate || forceRegenerate))'), "main.js 必须包含 ov5 生成分支");
assert(mainContent.includes('if (viewId === "ov5a" && (generate || forceRegenerate))'), "main.js 必须包含 ov5a 生成分支");
assert(mainContent.includes('if (viewId === "ov1c" && (generate || forceRegenerate))'), "main.js 必须包含 ov1c 生成分支");
assert(mainContent.includes('if (viewId === "ov7" && (generate || forceRegenerate))'), "main.js 必须包含 ov7 生成分支");

const dodafContent = fs.readFileSync(path.join(projectRoot, "design-studio/src/dodafProductController.js"), "utf8");
assert(dodafContent.includes("async pregenerateOv5a"), "dodafProductController 必须实现 pregenerateOv5a");
assert(dodafContent.includes("async pregenerateOv1c"), "dodafProductController 必须实现 pregenerateOv1c");
assert(dodafContent.includes("async pregenerateOv7"), "dodafProductController 必须实现 pregenerateOv7");

const openaiContent = fs.readFileSync(path.join(projectRoot, "server/openaiClient.mjs"), "utf8");
assert(openaiContent.includes('["ConceptPlan", "作战活动与机理"'), "openaiClient 必须包含 ConceptPlan 提示词定义");
assert(openaiContent.includes('ConceptPlan: "ov5-concept-plan"'), "openaiClient 必须为 ConceptPlan 分配稳定 ID ov5-concept-plan");
console.log("✓ 静态代码契约与统一提示词目录定义验证通过");

console.log("\n>>> 全部测试均通过！");
