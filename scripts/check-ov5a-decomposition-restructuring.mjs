import { renderOv5a } from "../design-studio/src/dodafOperationalViews.js";
import { normalizeDodafOv5, normalizeDodafOv5a } from "../shared/dodaf/products.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    throw new Error(message);
  }
}

console.log("Starting verification for OV-5a Decomposition Restructuring...");

// 1. Prepare 3-tier hierarchical activity model
const ov5 = normalizeDodafOv5({
  activities: [
    { id: "act-root", title: "远程跨域联合遮断", type: "指挥协调", domain: "综合", autonomy: "HITL", performer: "联合战区指控中心", timingWindow: "15m", sourceTaskId: "task-01", parentId: "" },
    { id: "act-mid-1", title: "广域雷达与高空侦察汇聚", type: "态势感知", domain: "太空", autonomy: "HOTL", performer: "天基侦察星座", timingWindow: "5m", sourceTaskId: "task-01", parentId: "act-root" },
    { id: "act-mid-2", title: "电磁压制与走廊开辟", type: "电子对抗", domain: "电磁", autonomy: "HOTL", performer: "电子战无人机集群", timingWindow: "8m", sourceTaskId: "task-01", parentId: "act-root" },
    { id: "act-leaf-1", title: "高价值目标微秒级硬杀伤", type: "精确突击", domain: "空中", autonomy: "HOOTL", performer: "隐身突击机编组", timingWindow: "3m", sourceTaskId: "task-01", parentId: "act-mid-2" },
    { id: "act-leaf-2", title: "弹目交会毁伤实时裁决", type: "效果评估", domain: "综合", autonomy: "HITL", performer: "前沿火力引导组", timingWindow: "2m", sourceTaskId: "task-01", parentId: "act-mid-2" }
  ],
  edges: []
});

const ov5a = normalizeDodafOv5a({
  decompositions: [
    { parentActivityRef: "act-root", childActivityRef: "act-mid-1" },
    { parentActivityRef: "act-root", childActivityRef: "act-mid-2" },
    { parentActivityRef: "act-mid-2", childActivityRef: "act-leaf-1" },
    { parentActivityRef: "act-mid-2", childActivityRef: "act-leaf-2" }
  ]
});

// 2. Test Diagram (DoDAF / SysML recursive tree) mode
const diagramHtml = renderOv5a({
  activeView: "ov5a",
  ov5,
  ov5a,
  ov5aViewMode: "diagram",
  ov5aStorage: {}
});

assert(diagramHtml.includes("ov5a-metrics-strip"), "Metrics strip missing from OV-5a");
assert(diagramHtml.includes("分解健康度"), "Health score label missing");
assert(diagramHtml.includes("5 项") && diagramHtml.includes("作战活动总量"), "Activity total count metric missing");
assert(diagramHtml.includes("ov5a-uml-diagram-canvas"), "UML diagram canvas missing");
assert(diagramHtml.includes("ov5a-uml-diamond"), "Composition diamond missing");
assert(diagramHtml.includes("«OperationalActivity»"), "Stereotype missing");
assert(diagramHtml.includes("远程跨域联合遮断"), "Root activity missing");
assert(diagramHtml.includes("电磁压制与走廊开辟"), "Mid activity missing");
assert(diagramHtml.includes("高价值目标微秒级硬杀伤"), "Leaf activity missing");
assert(diagramHtml.includes("«Node» 联合战区指控中心"), "Root performer tag missing");
assert(diagramHtml.includes("«Node» 隐身突击机编组"), "Leaf performer tag missing");

// Check multi-tier recursive structure
assert(diagramHtml.includes("depth-0") && diagramHtml.includes("depth-1") && diagramHtml.includes("depth-2"), "Recursive depth levels (depth-0, 1, 2) missing from diagram");

// 3. Test WBS mode
const wbsHtml = renderOv5a({
  activeView: "ov5a",
  ov5,
  ov5a,
  ov5aViewMode: "wbs",
  ov5aStorage: {}
});

assert(wbsHtml.includes("ov5a-wbs-workspace"), "WBS workspace container missing");
assert(wbsHtml.includes("1.0") && wbsHtml.includes("1.0.1"), "WBS hierarchical prefix numbers missing");
assert(wbsHtml.includes("🎯 末端执行动作"), "Leaf action indicator missing in WBS");
assert(wbsHtml.includes("📂 包含"), "Branch grouping indicator missing in WBS");

// 4. Test Table mode
const tableHtml = renderOv5a({
  activeView: "ov5a",
  ov5,
  ov5a,
  ov5aViewMode: "table",
  ov5aStorage: {}
});

assert(tableHtml.includes("ov5a-decomposition-table"), "Decomposition table missing");
assert(tableHtml.includes("活动分解清单"), "Table heading missing");
assert(tableHtml.includes("data-dodaf-field=\"ov5a.decomposition.act-leaf-1.parentActivityRef\""), "Parent activity reference field missing for act-leaf-1");
assert(tableHtml.includes("L1") && tableHtml.includes("L2") && tableHtml.includes("L3"), "Depth level badges missing in table");
assert(tableHtml.includes("电磁") && tableHtml.includes("HOOTL"), "Domain and autonomy indicators missing in table");

// 5. Test Broken Reference Diagnostic & Resilience
const brokenOv5a = normalizeDodafOv5a({
  decompositions: [
    { parentActivityRef: "missing-parent-id", childActivityRef: "act-leaf-1" }
  ]
});

const brokenHtml = renderOv5a({
  activeView: "ov5a",
  ov5,
  ov5a: brokenOv5a,
  ov5aViewMode: "table",
  ov5aStorage: {}
});

assert(brokenHtml.includes("⚠️ 1 处失效") || brokenHtml.includes("引用失效"), "Broken reference alert did not trigger in metrics");
assert(brokenHtml.includes("is-conflict"), "Broken reference did not highlight conflict row");

console.log("All OV-5a Decomposition Restructuring checks passed successfully!");
