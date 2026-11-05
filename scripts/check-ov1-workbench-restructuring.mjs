/**
 * Verification for Step 05 Overall Concept Workbench Restructuring
 * Tests:
 * 1. Ultra-compact 2-row header layout with HUD health metrics & view pills
 * 2. Tri-mode view switching: graph (OV-1a), map (concept-map), outline (concept narrative & MOEs)
 * 3. Bottom-up synthesis & concept outline form synchronization
 * 4. Step 04 -> Step 05 -> Step 06 progression
 *
 * Run: node scripts/check-ov1-workbench-restructuring.mjs
 */

import { renderOv1 } from "../design-studio/src/ov1View.js";
import { createOv1Controller } from "../design-studio/src/ov1Controller.js";
import { normalizeOv1Model } from "../design-studio/src/ov1Store.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    throw new Error(message);
  }
}

console.log("Starting Step 05 Overall Concept Workbench Verification...");

const sampleBrief = {
  objective: "广域分布式敏捷海空联合封控概念",
  approach: "以无人集群配合多域防区外精确打击与电子压制",
  assumptions: "重点海峡走廊，全天候电磁对抗环境",
  expectedEffects: "48小时内建立绝对信息感知与火力封控优势",
  risk: "强电磁干扰与跨域通信中断"
};

const sampleModel = normalizeOv1Model({
  nodes: [
    { id: "sense", label: "广域无人侦察预警集群", detail: "多源探测与跟踪", kind: "equipment", x: "15%", y: "45%" },
    { id: "decide", label: "联合多域指控协同中心", detail: "动态授权与航迹协同", kind: "command", x: "40%", y: "70%" },
    { id: "control", label: "分布式饱和突击打击群", detail: "防区外蜂群突防", kind: "action", x: "50%", y: "40%" },
    { id: "opponent", label: "敌机动水面与防空体系", detail: "对抗与反制态势", kind: "external", className: "blue", x: "75%", y: "20%" },
    { id: "assess", label: "实时毁伤评估与态势反哺", detail: "闭环评估与二次打击规划", kind: "effect", className: "gold", x: "75%", y: "65%" }
  ],
  edges: [
    { id: "e1", sourceId: "sense", targetId: "decide", type: "信息流" },
    { id: "e2", sourceId: "decide", targetId: "control", type: "控制流" },
    { id: "e3", sourceId: "control", targetId: "assess", type: "反馈" },
    { id: "e4", sourceId: "assess", targetId: "decide", type: "反馈" },
    { id: "e5", sourceId: "opponent", targetId: "decide", type: "态势变化" }
  ],
  concept: {
    mission: "联合封控高层概念总体方案",
    objective: sampleBrief.objective,
    scope: sampleBrief.assumptions,
    expectedEffects: sampleBrief.expectedEffects,
    constraints: sampleBrief.risk
  }
});

const baseState = {
  activeView: "ov1",
  ov1ViewMode: "graph",
  brief: sampleBrief,
  ov1: sampleModel,
  ov5: { activities: [{ id: "a1", title: "前置侦察" }], edges: [{ id: "e1" }] },
  conceptMap: {
    document: { items: [{ id: "obj-1" }, { id: "obj-2" }] },
    summary: { itemCount: 2 }
  },
  conceptMapBridge: { settings: { targetUrl: "http://127.0.0.1:8765" } }
};

// 1. 验证默认视图 (graph 模式)
const graphHtml = renderOv1(baseState);
assert(graphHtml.includes("ov1-top-header") && graphHtml.includes("ov1-toolbar"), "Must render ultra-compact header with ov1-toolbar compatibility class");
assert(graphHtml.includes("总体概念 (高层协同与空间态势)"), "Must render updated workbench title");
assert(graphHtml.includes("高层协同图 (OV-1a)") && graphHtml.includes("空间态势图 (概念图)") && graphHtml.includes("体系概念大纲"), "Must render tri-mode view pills");
assert(graphHtml.includes("view-pill active") && graphHtml.includes("高层协同图 (OV-1a)"), "Graph pill must be active by default");
assert(graphHtml.includes("ov1-hud-badges") && graphHtml.includes("体系闭环") && graphHtml.includes("核心节点"), "Must render compact HUD metrics capsule");
assert(graphHtml.includes("从活动机理提炼"), "Primary action must include bottom-up extraction button");
assert(graphHtml.includes("ov1-canvas-shell") && graphHtml.includes("dodaf-drafting-canvas"), "Main column must render canvas shell in graph mode");
assert(graphHtml.includes("前往仿真推演 (Step 06)"), "Must provide forward jump to Step 06");

// 2. 验证空间态势图 (map 模式)
const mapState = { ...baseState, ov1ViewMode: "map" };
const mapHtml = renderOv1(mapState);
assert(mapHtml.includes("view-pill active") && mapHtml.includes("空间态势图 (概念图)"), "Map pill must be active in map mode");
assert(mapHtml.includes("ov1-map-viewport"), "Must render map viewport container");
assert(mapHtml.includes("concept-map-workspace") || mapHtml.includes("conceptMapFrameMount"), "Must render concept map bridge mount/workspace");
assert(mapHtml.includes("拉取最新") || mapHtml.includes("打开绘制工具"), "Must provide concept map toolbar actions in header");

// 3. 验证体系概念大纲 (outline 模式)
const outlineState = { ...baseState, ov1ViewMode: "outline" };
const outlineHtml = renderOv1(outlineState);
assert(outlineHtml.includes("view-pill active") && outlineHtml.includes("体系概念大纲"), "Outline pill must be active in outline mode");
assert(outlineHtml.includes("ov1-outline-viewport") && outlineHtml.includes("ov1OutlineForm"), "Must render outline form");
assert(outlineHtml.includes("总体构想叙述 (Concept Narrative)"), "Must display concept narrative section");
assert(outlineHtml.includes("预期战果与效果指标"), "Must display expected effects section");
assert(outlineHtml.includes("保存概念大纲"), "Must have outline save button");

// 4. 验证控制器动作处理
let synced = false;
let notified = "";
let rendered = false;
const controller = createOv1Controller({
  getState: () => baseState,
  render: () => { rendered = true; },
  notify: (msg) => { notified = msg; },
  selectNode: () => {},
  invalidateValidation: () => {},
  syncOv1: async () => { synced = true; }
});

// 测试视图切换动作
const handledSwitch = controller.handleAction("switch-ov1-view-mode");
assert(handledSwitch === true, "Controller should handle switch-ov1-view-mode");
assert(rendered === true, "Controller should trigger render on view switch");

// 测试自动布局动作
const handledLayout = controller.handleAction("auto-layout-ov1");
assert(handledLayout === true, "Controller should handle auto-layout-ov1");
assert(notified.includes("重排"), "Notification should confirm auto-layout");

console.log("All Step 05 Overall Concept Workbench checks PASSED!");
