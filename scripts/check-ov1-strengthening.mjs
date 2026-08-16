import { addOv1Edge, autoLayoutOv1, createOv1Model, normalizeOv1Model, updateOv1Node } from "../design-studio/src/ov1Store.js";
import { createAiOv1Draft } from "../design-studio/src/ov1DraftStore.js";
import { inspectOv1Model } from "../design-studio/src/ov1Diagnostics.js";
import { renderOv1, renderOv1Dialog } from "../design-studio/src/ov1View.js";
import { normalizeOv1 } from "../server/projectModelNormalizers.mjs";
import { computeOv1WorldBounds, repairLegacyCompressedOv1Nodes } from "../shared/ov1Canvas.js";
import { calculateOv1CameraFit } from "../design-studio/src/ov1ConceptMapController.js";
import { routeOv1Edge } from "../shared/ov1EdgeRouting.js";
import { resolveOv1NodePosition } from "../shared/ov1Layout.js";

let model = createOv1Model();
model = updateOv1Node(model, "sense", { label: "多源感知", detail: "研究级态势输入。", category: "感知", responsibility: "汇聚抽象信息", input: "公开态势", output: "态势摘要", constraints: "证据边界", expectedEffects: "提高可见性", evidenceRefs: "ref-1，ref-2" });
assert(model.nodes[0].category === "感知" && model.nodes[0].evidenceRefs.length === 2, "OV-1 node metadata was not retained");
model = autoLayoutOv1(model);
assert(model.nodes.every((node) => node.x.endsWith("%") && node.y.endsWith("%")), "Automatic layout did not produce bounded positions");
const byId = new Map(model.nodes.map((node) => [node.id, node]));
// Home viewport layout: generated/auto-layout graphs fill the visible stage (0–100).
assert(byId.get("sense").x === "22%" && byId.get("sense").y === "48%" && byId.get("opponent").x === "4%" && byId.get("opponent").y === "48%" && byId.get("decide").x === "42%" && byId.get("decide").y === "48%" && byId.get("control").x === "60%" && byId.get("control").y === "48%" && byId.get("assess").x === "84%" && byId.get("assess").y === "48%", "Automatic layout did not preserve the readable home-viewport OV-1 arrangement");
const variedNodeModel = autoLayoutOv1({
  nodes: Array.from({ length: 16 }, (_, index) => ({
    id: `node-${index + 1}`,
    label: `节点 ${index + 1}`,
    detail: "布局验收节点",
    kind: ["equipment", "command", "action", "external", "effect"][index % 5]
  })),
  edges: Array.from({ length: 15 }, (_, index) => ({ id: `edge-${index + 1}`, sourceId: `node-${index + 1}`, targetId: `node-${index + 2}`, type: "信息流" }))
});
const variedBounds = computeOv1WorldBounds(variedNodeModel.nodes);
assert(variedBounds.widthPct === 100 && variedBounds.heightPct === 100, "Automatic layout should keep varied node counts in the home viewport");
assertNoCardOverlaps(variedNodeModel.nodes, "Mixed-type OV-1 nodes should never overlap");
const denseLeftModel = autoLayoutOv1({
  nodes: Array.from({ length: 18 }, (_, index) => ({ id: `left-${index + 1}`, label: `Left ${index + 1}`, detail: "layout", kind: index % 2 ? "external" : "equipment" })),
  edges: []
});
const denseLeftXs = [...new Set(denseLeftModel.nodes.map((node) => node.x))].map(Number.parseFloat).sort((a, b) => a - b);
assert(denseLeftXs.length === 2 && denseLeftXs[1] - denseLeftXs[0] >= 14, "External actors and equipment should keep separate safe lanes");
assert(computeOv1WorldBounds(denseLeftModel.nodes).heightPct > 100, "Dense node groups should extend the free canvas instead of compressing cards");
assertNoCardOverlaps(denseLeftModel.nodes, "Dense OV-1 nodes should never overlap");
const actionFan = autoLayoutOv1({
  nodes: ["hub", "north", "south", "east", "west"].map((id) => ({ id, label: id, detail: "layout", kind: "action" })),
  edges: ["north", "south", "east", "west"].map((sourceId) => ({ id: `${sourceId}-hub`, sourceId, targetId: "hub", type: "information" }))
});
const actionById = new Map(actionFan.nodes.map((node) => [node.id, node]));
assert(actionById.get("hub").x === "60%" && actionById.get("hub").y === "48%" && ["north", "south", "east", "west"].every((id) => actionById.get(id).x === "60%") && new Set(["hub", "north", "south", "east", "west"].map((id) => actionById.get(id).y)).size === 5 && ["28%", "68%"].every((y) => [...actionById.values()].some((node) => node.y === y)), "Action hubs should keep their first support pair close to the main backbone");
assertNoCardOverlaps(actionFan.nodes, "Action lanes should keep leaves separate from their hub");
const routeBoxes = [
  { id: "left", center: { x: 20, y: 50 }, halfW: 4, halfH: 3 },
  { id: "right", center: { x: 70, y: 50 }, halfW: 4, halfH: 3 },
  { id: "top", center: { x: 45, y: 20 }, halfW: 4, halfH: 3 },
  { id: "bottom", center: { x: 45, y: 70 }, halfW: 4, halfH: 3 },
  { id: "blocker", center: { x: 45, y: 50 }, halfW: 5, halfH: 5 }
];
const horizontalRoute = routeOv1Edge({ edge: { id: "horizontal", sourceId: "left", targetId: "right", type: "information" }, source: routeBoxes[0], target: routeBoxes[1], obstacles: [routeBoxes[0], routeBoxes[1]] });
const verticalRoute = routeOv1Edge({ edge: { id: "vertical", sourceId: "top", targetId: "bottom", type: "information" }, source: routeBoxes[2], target: routeBoxes[3], obstacles: [routeBoxes[2], routeBoxes[3]] });
const blockedRoute = routeOv1Edge({ edge: { id: "blocked", sourceId: "left", targetId: "right", type: "information" }, source: routeBoxes[0], target: routeBoxes[1], obstacles: [routeBoxes[0], routeBoxes[1], routeBoxes[4]] });
const feedbackRoute = routeOv1Edge({ edge: { id: "feedback", sourceId: "left", targetId: "right", type: "\u53cd\u9988" }, source: routeBoxes[0], target: routeBoxes[1], obstacles: routeBoxes });
assert(horizontalRoute.kind === "straight-horizontal" && horizontalRoute.path.includes(" L") && !horizontalRoute.path.includes(" Q") && !horizontalRoute.path.includes(" C"), "Aligned unobstructed nodes should use a horizontal straight route");
assert(verticalRoute.kind === "straight-vertical" && verticalRoute.path.includes(" L") && !verticalRoute.path.includes(" Q") && !verticalRoute.path.includes(" C"), "Aligned unobstructed nodes should use a vertical straight route");
assert(horizontalRoute.label.x === 45 && horizontalRoute.label.y === 50 && verticalRoute.label.x === 45 && verticalRoute.label.y === 45, "Straight relation labels should stay on the middle of their line");
assert(blockedRoute.kind === "detour-horizontal" && blockedRoute.path.split(" L").length >= 4, "Aligned routes with an intervening node should detour around it");
assert(feedbackRoute.kind === "feedback-rail" && feedbackRoute.path.split(" L").length === 4, "Long feedback relations should use a compact return rail instead of framing the canvas");
const overlapResolved = resolveOv1NodePosition([{ id: "anchor", x: "24%", y: "48%" }], "candidate", { x: "24%", y: "48%" });
assert(overlapResolved.x !== "24%" || overlapResolved.y !== "48%", "Manual node placement should move away from an occupied card");
const repaired = repairLegacyCompressedOv1Nodes([
  { id: "a", x: "0.33%", y: "0.57%" },
  { id: "b", x: "1.2%", y: "1.4%" },
  { id: "c", x: "2.4%", y: "2.2%" }
]);
assert(Number.parseFloat(repaired[0].x) > 5 && Number.parseFloat(repaired[2].x) > 50, "Legacy compressed OV-1 coords should expand to home viewport");
const cameraFit = calculateOv1CameraFit({ stageWidth: 1200, stageHeight: 700, worldWidth: 1200, worldHeight: 1500 });
assert(cameraFit.zoom < 0.5 && cameraFit.pan.y > 0, "Out-of-home OV-1 worlds should fit the initial camera instead of being clipped");
const pageHome = renderOv1({
  ov1: normalizeOv1Model({
    nodes: [
      { id: "sense", label: "感知", detail: "说明", x: "12%", y: "20%" },
      { id: "decide", label: "指挥", detail: "说明", x: "42%", y: "30%" },
      { id: "control", label: "行动", detail: "说明", x: "68%", y: "40%" }
    ],
    edges: []
  }),
  ov1Generating: false,
  ov1Candidate: null,
  ov1Storage: {},
  selection: null,
  ov5: { activities: [] },
  ov1InspectorCollapsed: false,
  ov1PanelOpen: true,
  ov1PanelMode: "context",
  ov1ToolsOpen: true
});
assert(pageHome.includes('data-world-width="100"') && pageHome.includes('data-world-min-x="0"'), "Home viewport world must be 1:1 with the stage (no pad shift)");
const diagnostic = inspectOv1Model({ nodes: [{ id: "a", label: "A" }, { id: "b", label: "A" }], edges: [] });
assert(diagnostic.summary.isolatedIds.length === 2 && diagnostic.summary.duplicateLabelIds.length === 2, "OV-1 structural diagnostics missed isolated or duplicate nodes");
assert(diagnostic.summary.incompleteSemanticIds.length === 2, "OV-1 semantic diagnostics missed incomplete node fields");
const normalized = normalizeOv1(model);
assert(normalized.nodes[0].evidenceRefs.includes("ref-1") && normalized.nodes[0].expectedEffects === "提高可见性", "Server OV-1 normalization lost semantic fields");
const aiGraphic = createAiOv1Draft({
  brief: { objective: "研究级目标", assumptions: "抽象范围", expectedEffects: "可审阅效果", risk: "待验证约束" },
  direction: "稳控塑势",
  draft: {
    concept: { mission: "研究概念", objective: "研究级目标", scope: "抽象范围", phase: "概念评估", expectedEffects: "可审阅效果", constraints: "待验证约束" },
    nodes: [
      { id: "sense", label: "预警传感器平台", detail: "研究级态势输入", category: "装备/平台", kind: "equipment" },
      { id: "decide", label: "联合指挥控制节点", detail: "协同判断", category: "指挥节点", kind: "command" },
      { id: "control", label: "分层防护协同", detail: "高层关键动作", category: "关键动作", kind: "action" },
      { id: "opponent", label: "外部威胁环境", detail: "外部影响", category: "外部对象", kind: "external" },
      { id: "assess", label: "防护韧性效果", detail: "效果评估", category: "预期效果", kind: "effect" }
    ],
    edges: [{ id: "sense-decide", sourceId: "sense", targetId: "decide", type: "信息流" }]
  }
});
assert(aiGraphic.nodes.map((node) => node.label).join("|") === "预警传感器平台|联合指挥控制节点|分层防护协同|外部威胁环境|防护韧性效果", "AI OV-1 graphic did not preserve typed entity labels");
assert(aiGraphic.edges[0].sourceId === "sense" && aiGraphic.concept.phase === "概念评估", "AI OV-1 graphic lost its concept or relationship fields");
assert(aiGraphic.schema === "dodaf-2.02-dm2-ov" && aiGraphic.product === "OV-1" && aiGraphic.entities?.length === 5, "AI OV-1 draft missing DM2 envelope");
assert(normalized.schema === "dodaf-2.02-dm2-ov" && normalized.entities?.length >= 1, "Server OV-1 normalization missing DM2 envelope");
assert(addOv1Edge(model, { sourceId: "sense", targetId: "decide", type: "信息流" }) === null, "Duplicate OV-1 edge was accepted");
const pageState = { ov1: model, ov1Generating: false, ov1Candidate: null, ov1Storage: {}, selection: null, ov5: { activities: [] }, ov1InspectorCollapsed: false, ov1PanelOpen: true, ov1PanelMode: "context", ov1ToolsOpen: true };
const page = renderOv1(pageState);
assert(page.includes("ov1-edit-rail") && page.includes("ov1-edit-entry") && page.includes("ov1-side-cluster") && page.includes("ov1-context-panel"), "OV-1 scheme A side rail/panel missing");
assert(page.includes('data-toolbox-scope="ov1"'), "OV-1 rail must use the shared toolbox shell");
assert(page.includes('data-action="open-ov1-relations"') && page.includes('data-action="generate-ov1"') && page.includes('data-action="add-ov1-node"') && page.includes('data-action="auto-layout-ov1"'), "OV-1 tools incomplete");
assert(page.includes("refresh-project-ov1") && page.includes("ov1-task-panel") && page.includes("ov1-context-panel-body") && page.includes("任务摘要"), "OV-1 task summary side panel missing");
assert(page.includes('data-action="open-ov1-concept"') && page.includes('title="编辑摘要"'), "OV-1 edit-summary action should live on the icon rail");
assert(page.includes('data-action="refresh-project-ov1"') && page.includes("ov1-edit-rail"), "OV-1 refresh should live on the icon rail");
const withRemote = renderOv1({ ...pageState, ov1Storage: { status: "ready", label: "OV-1 r12", detail: "A server revision is available; the local model remains preferred.", remoteAvailable: true, auditCount: 3 } });
assert(withRemote.includes('data-action="load-project-ov1"') && withRemote.includes('title="载入服务端"') && withRemote.includes("服务端有可用修订"), "OV-1 load-server rail action should appear when remote is available");
const withConflictDraft = renderOv1({ ...pageState, ov1Storage: { status: "ready", label: "OV-1", conflictDraftAvailable: true } });
assert(withConflictDraft.includes('data-action="restore-project-ov1-conflict-draft"') && withConflictDraft.includes('title="恢复本地冲突草稿"'), "OV-1 restore-draft rail action should appear when conflict draft exists");
const withoutRemote = renderOv1({ ...pageState, ov1Storage: { status: "ready", label: "OV-1 r12", detail: "已同步" } });
assert(!withoutRemote.includes('data-action="load-project-ov1"') && !withoutRemote.includes('data-action="restore-project-ov1-conflict-draft"'), "OV-1 conditional storage actions should hide when not needed");
assert(!page.includes("ov1-tools-drawer") && !page.includes("ov1-side-panel"), "OV-1 should not keep scheme D drawer or old side panel");
assert(page.includes('data-action="generate-ov5-from-ov1"') && page.includes('data-action="continue-to-ov5"'), "OV-1 next-step CTA for OV-5 is missing");
assert(page.includes("ov1-concept-edge-label-layer") && page.includes("ov1-concept-edge-label"), "OV-1 relation labels are missing their DOM text layer");
assert(page.includes(">信息流</button>") && page.includes(">控制流</button>") && !page.includes("is-muted"), "OV-1 relation labels should visibly show their relationship type");
assert(page.includes("ov1-concept-node") && page.includes("data-ov1-port") && page.includes("ov1-connect-port"), "OV-1 canvas node connection ports missing");
assert(page.includes('markerWidth="9"') && page.includes('refX="10"'), "OV-1 relation arrows are missing their visible arrowhead marker");
assert(page.includes("marker-end=") && (page.includes("ov1-arrow-") || page.includes("ov1-concept-arrow")), "OV-1 relation arrows are missing from the rendered concept map");
assert(page.includes('data-dodaf-legend="OV-1"') && page.includes("dodaf-entity--"), "OV-1 industrial drafting legend/entity tokens missing");
const conceptPanel = renderOv1({ ...pageState, ov1PanelMode: "concept" });
assert(conceptPanel.includes('id="ov1ConceptForm"') && conceptPanel.includes('data-ov1-panel-mode="concept"'), "OV-1 concept editor should open in the side panel");
const relationsPanel = renderOv1({ ...pageState, ov1PanelMode: "relations" });
assert(relationsPanel.includes('id="ov1EdgeForm"') && relationsPanel.includes('data-ov1-panel-mode="relations"'), "OV-1 relation management should open in the side panel");
const nodePanel = renderOv1({ ...pageState, ov1PanelMode: "node", ov1PanelNodeId: "sense" });
assert(nodePanel.includes('id="ov1NodeForm"') && nodePanel.includes('data-ov1-panel-mode="node"'), "OV-1 node editor should open in the side panel");
assert(renderOv1Dialog({ ov1: model, ov1Dialog: { kind: "relations" } }).includes('id="ov1EdgeForm"'), "OV-1 relation management dialog helper is incomplete");
assert(renderOv1Dialog({ ov1: model, ov1Dialog: { kind: "node", nodeId: "sense" } }).includes('id="ov1NodeForm"'), "OV-1 node dialog helper is incomplete");
console.log("OV-1 strengthening acceptance passed: metadata, layout, diagnostics, side panel editors, and server normalization.");
function assert(condition, message) { if (!condition) throw new Error(message); }

function assertNoCardOverlaps(nodes, message) {
  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    const left = nodes[leftIndex];
    const leftX = Number.parseFloat(left.x);
    const leftY = Number.parseFloat(left.y);
    for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
      const right = nodes[rightIndex];
      const rightX = Number.parseFloat(right.x);
      const rightY = Number.parseFloat(right.y);
      const overlap = leftX < rightX + 14 && leftX + 14 > rightX
        && leftY < rightY + 12 && leftY + 12 > rightY;
      assert(!overlap, `${message}: ${left.id} overlaps ${right.id}`);
    }
  }
}
