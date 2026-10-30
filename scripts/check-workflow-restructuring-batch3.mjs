/**
 * Verification for Batch 3: Step 04 "Three-in-One" OV-5 & OODA Workbench Integration
 * Run: node scripts/check-workflow-restructuring-batch3.mjs
 */

import { createOv5AiController } from "../design-studio/src/ov5AiController.js";
import { renderOv5 } from "../design-studio/src/ui.js";
import { evaluateOodaLoopHealth } from "../design-studio/src/oodaStore.js";
import { deriveActivitiesFromTasks } from "../design-studio/src/ov5Store.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log("Starting Batch 3 Verification: OV-5 & OODA Workbench Integration...");

// 1. Controller Action: derive-activities-from-tasks
let rendered = false;
let toastMessage = "";
const mockState = {
  brief: { objective: "海上区域拒止与多域封控" },
  direction: "分布式协同打击",
  forceMission: {
    tasks: [
      { id: "task-1", name: "预警监视与目标探测", missionType: "recon", objective: "实现连续侦察", side: "friendly" },
      { id: "task-2", name: "协同任务分配与决策", missionType: "command", objective: "自主协同规划", side: "friendly" },
      { id: "task-3", name: "远程火力联合突击", missionType: "strike", objective: "实施防区外突击", side: "friendly" }
    ],
    forces: []
  },
  ov5: { activities: [], edges: [] },
  ooda: { lanes: [] }
};

const ov5Controller = createOv5AiController({
  getState: () => mockState,
  render: () => { rendered = true; },
  notify: (msg) => { toastMessage = msg; },
  invalidateDerivedArtifacts: () => {},
  syncOv5: async () => {},
  syncOoda: async () => {}
});

const handledDerive = ov5Controller.handleAction("derive-activities-from-tasks");
assert(handledDerive === true, "derive-activities-from-tasks action should be handled");
await new Promise((resolve) => setTimeout(resolve, 10));
assert(mockState.ov5.activities.length === 3, `Should derive 3 activities from tasks, got ${mockState.ov5.activities.length}`);
assert(mockState.ov5.edges.length >= 2, "Should derive causal edges");
assert(toastMessage.includes("派生 3 个作战活动"), `Should display informative toast, got: "${toastMessage}"`);

// 2. Controller Action: auto-fix-feedback-loop
// Let's create an open loop model lacking feedback
mockState.ov5 = {
  activities: [
    { id: "act-1", type: "感知", title: "广域雷达扫描", text: "雷达探测", input: "传感器配置", output: "预警目标" },
    { id: "act-2", type: "决策", title: "协同任务分配", text: "任务决策", input: "预警目标", output: "交战指令" },
    { id: "act-3", type: "控制", title: "远程火力打击", text: "精确突击", input: "交战指令", output: "目标毁伤" }
  ],
  edges: [
    { id: "e-1-2", sourceId: "act-1", targetId: "act-2", type: "信息流" },
    { id: "e-2-3", sourceId: "act-2", targetId: "act-3", type: "控制流" }
  ]
};

const preHealth = evaluateOodaLoopHealth(mockState.ov5);
assert(preHealth.diagnostics.some((d) => d.code === "NO_FEEDBACK_LOOP"), "Initial state must have NO_FEEDBACK_LOOP");

const handledFix = ov5Controller.handleAction("auto-fix-feedback-loop");
assert(handledFix === true, "auto-fix-feedback-loop action should be handled");
await new Promise((resolve) => setTimeout(resolve, 10));

const postHealth = evaluateOodaLoopHealth(mockState.ov5);
assert(!postHealth.diagnostics.some((d) => d.code === "NO_FEEDBACK_LOOP"), "Post fix must NOT have NO_FEEDBACK_LOOP");
assert(postHealth.loopClosed === true, "Loop must be closed after auto-fix");
assert(mockState.ov5.edges.some((e) => e.sourceId === "act-3" && (e.targetId === "act-1" || e.targetId === "act-2")), "Feedback edge must connect strike to sense/decide");

// 3. UI Layout Rendering Verification
const renderedHtml = renderOv5(mockState);
assert(renderedHtml.includes("ov5-workbench-layout"), "HTML should contain 3-column .ov5-workbench-layout");
assert(renderedHtml.includes("活动结构 (OV-5a)"), "HTML should render left OV-5a tree panel");
assert(renderedHtml.includes("OODA 闭环诊断"), "HTML should render right OODA diagnostic panel");
assert(renderedHtml.includes("从任务派生活动网"), "Toolbar should have derive-activities-from-tasks button");
assert(renderedHtml.includes("一键修复闭环"), "Toolbar should have auto-fix-feedback-loop button");
assert(renderedHtml.includes("Observe 观测"), "OODA panel should display Observe stage card");
assert(renderedHtml.includes("Decide 决策"), "OODA panel should display Decide stage card");
assert(renderedHtml.includes("Act 行动"), "OODA panel should display Act stage card");
assert(renderedHtml.includes("Feedback 反馈"), "OODA panel should display Feedback stage card");

console.log("Batch 3 Verification: ALL CHECKS PASSED!");
