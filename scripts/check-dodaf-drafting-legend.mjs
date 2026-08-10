import {
  EDGE_STYLES,
  PRODUCT_LEGEND,
  getProductLegendSpec,
  resolveEdgeStyle,
  resolveEntityStyle
} from "../shared/dodaf/drafting.js";
import {
  edgeMarkerUrl,
  renderDodafLegend,
  renderEdgeBadge,
  renderEntityBadge,
  renderEntityChip,
  renderEdgeMarkerDefs
} from "../design-studio/src/dodafDraftingView.js";
import { renderOv1 } from "../design-studio/src/ov1View.js";
import { renderOv2 } from "../design-studio/src/ov2View.js";
import { renderOv3 } from "../design-studio/src/ov3View.js";
import { renderOv4 } from "../design-studio/src/ov4View.js";
import { renderOv5a, renderOv6a, renderOv6b } from "../design-studio/src/dodafOperationalViews.js";
import { renderOv6c } from "../design-studio/src/ov6cView.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const products = ["OV-1", "OV-2", "OV-3", "OV-4", "OV-5a", "OV-5b", "OV-6a", "OV-6b", "OV-6c"];
for (const product of products) {
  assert(PRODUCT_LEGEND[product], `Missing product legend for ${product}`);
  const spec = getProductLegendSpec(product);
  assert(spec.entities.length > 0, `${product} legend has no entities`);
  const html = renderDodafLegend(product);
  assert(html.includes(`data-dodaf-legend="${product}"`) && html.includes("图例"), `${product} legend HTML incomplete`);
}

assert(resolveEntityStyle({ kind: "equipment" }).key === "system", "OV-1 equipment should map to system style");
assert(resolveEntityStyle({ dm2Type: "Rule" }).icon === "§", "Rule icon missing");
assert(resolveEdgeStyle("信息流").color === "#187a57", "Information flow color wrong");
assert(resolveEdgeStyle("needline").key === "needline", "Needline style missing");
assert(edgeMarkerUrl("控制流", "ov1").includes("ov1-arrow-control"), "Control marker id wrong");
assert(renderEdgeMarkerDefs("ov1").includes("ov1-arrow-info"), "Marker defs incomplete");
assert(renderEntityBadge({ kind: "command", label: "C2" }).includes("dodaf-entity-badge"), "Entity badge missing class");
assert(renderEdgeBadge("反馈").includes("dodaf-edge-badge"), "Edge badge missing class");
assert(renderEntityChip({ id: "n1", name: "Node", dm2Type: "Performer" }).includes("dodaf-entity-chip"), "Entity chip missing");

const ov1Html = renderOv1({
  ov1: {
    schema: "dodaf-2.02-dm2-ov",
    product: "OV-1",
    concept: { mission: "Test", phase: "概念" },
    nodes: [
      { id: "sense", label: "传感", kind: "equipment", detail: "d", x: "10%", y: "20%" },
      { id: "decide", label: "指挥", kind: "command", detail: "d", x: "40%", y: "20%" }
    ],
    edges: [{ id: "e1", sourceId: "sense", targetId: "decide", type: "信息流" }],
    provenance: { mode: "manual" }
  },
  ov1Generating: false,
  ov1Candidate: null,
  ov1Storage: {},
  selection: null,
  ov5: { activities: [] }
});
assert(ov1Html.includes('data-dodaf-legend="OV-1"') && ov1Html.includes("dodaf-entity--equipment"), "OV-1 canvas missing drafting legend/entity class");
assert(ov1Html.includes("dodaf-edge--information") || ov1Html.includes("marker-end=\"url(#ov1-arrow-info)\""), "OV-1 edge style not applied");
assert(ov1Html.includes('markerWidth="9"') && ov1Html.includes('refX="10"'), "OV-1 arrow marker geometry regression");

const baseState = {
  ov1: { nodes: [{ id: "sense", label: "传感", kind: "equipment" }], edges: [] },
  ov5: {
    activities: [
      { id: "a1", title: "感知", type: "感知", parentId: "" },
      { id: "a2", title: "判断", type: "判断", parentId: "a1" }
    ],
    edges: [{ id: "e1", sourceId: "a1", targetId: "a2", type: "信息流" }]
  },
  ooda: { lanes: [{ title: "Observe", subtitle: "Observe", nodes: [{ id: "o1", title: "Collect", rule: "r" }] }] },
  scenario: { entities: [], timeline: [] },
  ov2: null, ov3: null, ov4: null, ov5a: null, ov6a: null, ov6b: null, ov6c: null,
  ov2Storage: {}, ov3Storage: {}, ov4Storage: {}, ov5aStorage: {}, ov6aStorage: {}, ov6bStorage: {}, ov6cStorage: {}
};

assert(renderOv2(baseState).includes('data-dodaf-legend="OV-2"'), "OV-2 legend missing");
assert(renderOv3(baseState).includes('data-dodaf-legend="OV-3"'), "OV-3 legend missing");
assert(renderOv4(baseState).includes('data-dodaf-legend="OV-4"'), "OV-4 legend missing");
assert(renderOv5a(baseState).includes('data-dodaf-legend="OV-5a"') && renderOv5a(baseState).includes("dodaf-activity-tree"), "OV-5a drafting tree missing");
assert(renderOv6a(baseState).includes('data-dodaf-legend="OV-6a"'), "OV-6a legend missing");
assert(renderOv6b(baseState).includes('data-dodaf-legend="OV-6b"'), "OV-6b legend missing");
assert(renderOv6c(baseState).includes('data-dodaf-legend="OV-6c"'), "OV-6c legend missing");
assert(Object.keys(EDGE_STYLES).includes("needline"), "Edge style catalog incomplete");

console.log("DoDAF drafting legend acceptance passed: OV-1～OV-6c legends, entity/edge tokens, and view wiring.");
