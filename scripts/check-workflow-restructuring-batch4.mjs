/**
 * Verification for Batch 4: Step 05 OV-1 & Concept Map Bottom-Up Synthesis from OV-5
 * Run: node scripts/check-workflow-restructuring-batch4.mjs
 */

import { extractOv1FromOv5 } from "../design-studio/src/ov1DraftStore.js";
import { createOv1AiController } from "../design-studio/src/ov1AiController.js";
import { renderOv1 } from "../design-studio/src/ov1View.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log("Starting Batch 4 Verification: Step 05 OV-1 Bottom-Up Synthesis...");

// 1. 测试 extractOv1FromOv5 算法逻辑
const sampleOv5 = {
  activities: [
    { id: "act-1", type: "感知", title: "分布式无人侦察监视", text: "多源探测", input: "传感器配置", output: "态势目标包" },
    { id: "act-2", type: "决策", title: "自主指控与协同分配", text: "智能规划", input: "态势目标包", output: "交战授权指令" },
    { id: "act-3", type: "控制", title: "多域饱和火力突击", text: "防区外发射", input: "交战授权指令", output: "打击成效" },
    { id: "act-4", type: "行动", title: "复杂电磁压制与干扰", text: "雷达干扰", input: "频段参数", output: "压制走廊" },
    { id: "act-5", type: "评估", title: "实时战损与毁伤评估", text: "效果评估", input: "打击成效", output: "评估闭环报告" }
  ],
  edges: [
    { id: "e-1-2", sourceId: "act-1", targetId: "act-2", type: "信息流" },
    { id: "e-2-3", sourceId: "act-2", targetId: "act-3", type: "控制流" },
    { id: "e-3-5", sourceId: "act-3", targetId: "act-5", type: "控制流" },
    { id: "e-5-1", sourceId: "act-5", targetId: "act-1", type: "信息流" }
  ]
};

const brief = {
  objective: "广域拒止与敏捷突击",
  approach: "以无人集群配合远程精确火力",
  expectedEffects: "夺取制信息权并瘫痪敌指挥中枢",
  risk: "强电磁对抗与通信断链"
};

const extractedOv1 = extractOv1FromOv5(sampleOv5, { brief });
assert(extractedOv1.version === 1, "Extracted OV-1 should have version 1");
assert(extractedOv1.nodes.length === 5, `Extracted OV-1 should have 5 core DoDAF nodes, got ${extractedOv1.nodes.length}`);

const nodeRoles = extractedOv1.nodes.map((n) => n.id);
assert(nodeRoles.includes("sense"), "Should have sense node");
assert(nodeRoles.includes("decide"), "Should have decide node");
assert(nodeRoles.includes("control"), "Should have control node");
assert(nodeRoles.includes("opponent"), "Should have opponent node");
assert(nodeRoles.includes("assess"), "Should have assess node");

// 检查源活动关联溯源
const senseNode = extractedOv1.nodes.find((n) => n.id === "sense");
assert(senseNode.sourceOv5ActivityIds.includes("act-1"), "Sense node should link to act-1");
assert(senseNode.detail.includes("分布式无人侦察监视"), "Sense node detail should summarize mapped activity");

const controlNode = extractedOv1.nodes.find((n) => n.id === "control");
assert(controlNode.sourceOv5ActivityIds.includes("act-3") || controlNode.sourceOv5ActivityIds.includes("act-4"), "Control node should link to strike/EW activities");

assert(extractedOv1.provenance.mode === "derived", "Provenance mode should be derived");
assert(extractedOv1.edges.length >= 4, "Should have core feedback and causal edges");

// 2. Controller 动作测试: extract-ov1-from-ov5
let notifyMsg = "";
let synced = false;
const state = {
  brief,
  direction: "无人协同",
  forceMission: { tasks: [], forces: [] },
  ov5: sampleOv5,
  ov1: { nodes: [], edges: [] }
};

const ov1Controller = createOv1AiController({
  getState: () => state,
  render: () => {},
  notify: (msg) => { notifyMsg = msg; },
  invalidateValidation: () => {},
  syncOv1: async () => { synced = true; }
});

// 2.1 空 OV-1 时一键提炼直接生效
const handledEmpty = ov1Controller.handleAction("extract-ov1-from-ov5");
assert(handledEmpty === true, "Should handle extract-ov1-from-ov5");
assert(state.ov1.nodes.length === 5, "Empty OV-1 should be directly populated with 5 nodes");
assert(notifyMsg.includes("自底向上生成总体概念图"), "Should notify successful direct generation");

// 2.2 已有 OV-1 时生成候选供审阅
const handledWithExisting = ov1Controller.handleAction("extract-ov1-from-ov5");
assert(handledWithExisting === true, "Should handle extract-ov1-from-ov5 with existing nodes");
assert(state.ov1Candidate !== null, "Should populate ov1Candidate for review when existing nodes present");
assert(notifyMsg.includes("提炼出总体概念图候选"), "Should notify candidate review");

// 3. UI 视图测试
const ov1Html = renderOv1(state);
assert(ov1Html.includes("从活动机理提炼"), "Toolbar should have '从活动机理提炼' button");
assert(ov1Html.includes("回看活动机理 (Step 04)"), "Next step section should guide user back to Step 04 if needed");
assert(ov1Html.includes("前往仿真推演 (Step 06)"), "Next step section should provide forward jump to Step 06");
assert(ov1Html.includes("进入概念图 →"), "Next step section should guide user to concept-map");

console.log("Batch 4 Verification: ALL CHECKS PASSED!");
