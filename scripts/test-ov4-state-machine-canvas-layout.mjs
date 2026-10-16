import { layoutOv4Topology, createRoleLayout, renderOv4 } from "../design-studio/src/ov4View.js";
import { renderOv2 } from "../design-studio/src/ov2View.js";
import { routeSmFlowEdges } from "../design-studio/src/stateMachineFlowRouting.js";

// Mock 11 roles as seen in the user's screenshot
const testRoles = [
  { id: "radar-1", label: "海域远程预警雷达站所", organizationCategory: "信息支援力量", echelonCategory: "基础作战单元", taskRefs: ["t1"] },
  { id: "spec-1", label: "深海电子频谱侦查测站", organizationCategory: "信息支援力量", echelonCategory: "基础作战单元", taskRefs: ["t2"] },
  { id: "route-1", label: "多域射频频资路由单元", organizationCategory: "信息支援力量", echelonCategory: "基础作战单元", taskRefs: ["t3"] },
  { id: "locate-1", label: "雷达辐射源定位感知节点", organizationCategory: "信息支援力量", echelonCategory: "基础作战单元", taskRefs: ["t4"] },
  { id: "jam-1", label: "前保区域电磁干扰分队", organizationCategory: "专业作战力量", echelonCategory: "任务编组级", taskRefs: ["t5"] },
  { id: "jam-cluster", label: "电子蜂窝饱和压制集群", organizationCategory: "专业作战力量", echelonCategory: "任务编组级", taskRefs: ["t6"] },
  { id: "guide-1", label: "防空导引制导雷达节点", organizationCategory: "专业作战力量", echelonCategory: "基础作战单元", taskRefs: ["t7"] },
  { id: "escort-1", label: "阵区防空伴随护卫连队", organizationCategory: "战区作战部队", echelonCategory: "任务编组级", taskRefs: ["t8"] },
  { id: "defense-1", label: "要地机动防御拦截阵地", organizationCategory: "战区作战部队", echelonCategory: "基础作战单元", taskRefs: ["t9"] },
  { id: "missile-1", label: "远程制导飞控单元", organizationCategory: "战区作战部队", echelonCategory: "基础作战单元", taskRefs: ["t10"] },
  { id: "net-defense", label: "网络防御阻隔前置单元", organizationCategory: "专业作战力量", echelonCategory: "基础作战单元", taskRefs: ["t11"] },
  { id: "cmd-post", label: "联合前指作战指挥所", organizationCategory: "战区指挥机关", echelonCategory: "战区级", taskRefs: ["t0"] }
];

const testRelations = [
  { id: "rel-1", sourceRoleId: "cmd-post", targetRoleId: "jam-cluster", relationshipCategory: "作战指挥", relationshipType: "command" },
  { id: "rel-2", sourceRoleId: "cmd-post", targetRoleId: "escort-1", relationshipCategory: "作战指挥", relationshipType: "command" },
  { id: "rel-3", sourceRoleId: "radar-1", targetRoleId: "cmd-post", relationshipCategory: "信息报送", relationshipType: "information" },
  { id: "rel-4", sourceRoleId: "spec-1", targetRoleId: "cmd-post", relationshipCategory: "信息报送", relationshipType: "information" },
  { id: "rel-5", sourceRoleId: "jam-cluster", targetRoleId: "jam-1", relationshipCategory: "作战控制", relationshipType: "control" },
  { id: "rel-6", sourceRoleId: "escort-1", targetRoleId: "defense-1", relationshipCategory: "作战指挥", relationshipType: "command" },
  { id: "rel-7", sourceRoleId: "jam-cluster", targetRoleId: "escort-1", relationshipCategory: "协同", relationshipType: "coordination" },
  { id: "rel-8", sourceRoleId: "guide-1", targetRoleId: "missile-1", relationshipCategory: "支援保障", relationshipType: "support" },
  { id: "rel-9", sourceRoleId: "net-defense", targetRoleId: "cmd-post", relationshipCategory: "信息报送", relationshipType: "information" }
];

console.log("1. Testing layoutOv4Topology multi-row and hierarchical rank distribution...");
const layout = layoutOv4Topology(testRoles, testRelations);
const yValues = new Set([...layout.positions.values()].map((p) => p.y));

console.log(`Unique Y layers generated: ${yValues.size} (should be >= 3, NOT single row)`);
if (yValues.size < 3) {
  throw new Error(`Expected at least 3 distinct Y layers for 12 hierarchical nodes, got ${yValues.size}`);
}

const cmdPos = layout.positions.get("cmd-post");
const radarPos = layout.positions.get("radar-1");
console.log(`cmd-post Y: ${cmdPos.y}%, radar-1 Y: ${radarPos.y}%`);
if (cmdPos.y >= radarPos.y) {
  throw new Error("Command post should be positioned in an upper tier relative to sensor radar");
}

console.log("2. Testing state-machine orthogonal routing for OV-4...");
const boxes = new Map();
testRoles.forEach((role) => {
  const p = layout.positions.get(role.id);
  boxes.set(role.id, { id: role.id, center: { x: p.x, y: p.y }, halfW: 8.5, halfH: 4.8, shape: "rect" });
});

const edges = testRelations.map((rel) => ({
  id: rel.id,
  sourceId: rel.sourceRoleId,
  targetId: rel.targetRoleId,
  label: rel.relationshipCategory
}));

const routes = routeSmFlowEdges(edges, boxes);
if (routes.size !== testRelations.length) {
  throw new Error(`Expected ${testRelations.length} routed edges, got ${routes.size}`);
}

for (const [id, route] of routes) {
  if (!route.path || !route.path.startsWith("M")) {
    throw new Error(`Invalid path for edge ${id}: ${route.path}`);
  }
  if (!route.label || typeof route.label.x !== "number" || typeof route.label.y !== "number") {
    throw new Error(`Invalid label coordinates for edge ${id}`);
  }
}
console.log("Orthogonal routing successfully routed all edges without errors.");

console.log("3. Testing renderOv4 output structure...");
const html = renderOv4({
  ov4: {
    roles: testRoles,
    relations: testRelations,
    diagrams: [{ id: "d1", name: "作战组织关系图", roleIds: testRoles.map((r) => r.id), relationIds: testRelations.map((r) => r.id) }]
  },
  ov4ToolsOpen: true,
  ov4EditorOpen: false
});

if (!html.includes("data-ov4-canvas-layout")) {
  throw new Error("Rendered HTML must include auto-layout button [data-ov4-canvas-layout]");
}
if (!html.includes("ov4-flow-edge-label-layer")) {
  throw new Error("Rendered HTML must include HTML label layer .ov4-flow-edge-label-layer");
}
if (!html.includes("ov4-node-title")) {
  throw new Error("Rendered HTML must include structured node cards with .ov4-node-title");
}
if (html.includes("<text class=\"ov4-org-relation-label")) {
  throw new Error("Rendered HTML must NOT contain distorted SVG <text> labels");
}

console.log("4. Testing selection high-contrast and link focus dimming...");
const selectedHtml = renderOv4({
  ov4: {
    roles: testRoles,
    relations: testRelations,
    diagrams: [{ id: "d1", name: "作战组织关系图", roleIds: testRoles.map((r) => r.id), relationIds: testRelations.map((r) => r.id) }]
  },
  ov4SelectedRoleId: "cmd-post",
  ov4ToolsOpen: true,
  ov4EditorOpen: true
});

if (!selectedHtml.includes("ov4-selected-indicator")) {
  throw new Error("Selected node must render .ov4-selected-indicator");
}
if (!selectedHtml.includes("is-focused")) {
  throw new Error("Connected edges of selected node must have .is-focused class");
}
if (!selectedHtml.includes("is-dimmed")) {
  throw new Error("Unconnected nodes/edges must have .is-dimmed class");
}
if (!selectedHtml.includes("is-linked")) {
  throw new Error("Neighbor nodes of selected node must have .is-linked class");
}

console.log("5. Testing relation filter and sidebar collapse...");
const filterHtml = renderOv4({
  ov4: {
    roles: testRoles,
    relations: testRelations,
    diagrams: [{ id: "d1", name: "作战组织关系图", roleIds: testRoles.map((r) => r.id), relationIds: testRelations.map((r) => r.id) }]
  },
  ov4RelationFilter: "command",
  ov4SidebarCollapsed: true
});

if (!filterHtml.includes("filter-command is-active")) {
  throw new Error("Command filter button must have .is-active when ov4RelationFilter is command");
}
if (!filterHtml.includes("is-filtered-out")) {
  throw new Error("Non-command edges must have .is-filtered-out when filtered");
}
if (!filterHtml.includes("is-sidebar-collapsed")) {
  throw new Error(".ov4-workbench must have .is-sidebar-collapsed class");
}
if (!filterHtml.includes("ov4-expand-sidebar-btn")) {
  throw new Error("Header must show .ov4-expand-sidebar-btn when sidebar is collapsed");
}

console.log("6. Testing OV-2 state inheritance from OV-4...");
const ov2Html = renderOv2({
  ov4: {
    roles: testRoles,
    relations: testRelations
  },
  ov2: {
    nodes: [
      { id: "cmd-post", label: "联合前指作战指挥所" },
      { id: "radar-1", label: "海域远程预警雷达站所" }
    ],
    exchanges: [
      { id: "ex-1", sourceNodeId: "radar-1", targetNodeId: "cmd-post", label: "预警目标航迹批号", flowType: "情报上报" }
    ]
  },
  ov2SelectedNodeId: "cmd-post"
});

if (!ov2Html.includes("ov2-filter-banner")) {
  throw new Error("OV-2 must show .ov2-filter-banner when ov2SelectedNodeId is set");
}
if (!ov2Html.includes("已从 OV-4 继承聚焦单元")) {
  throw new Error("OV-2 filter banner must display inherited unit text");
}
if (!ov2Html.includes("联合前指作战指挥所")) {
  throw new Error("OV-2 filter banner must display role label");
}

console.log("All OV-4 and OV-2 state-machine canvas component regression checks passed!");
