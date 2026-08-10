import { buildOv2Model } from "../design-studio/src/ov2Builder.js";
import { renderOv2, selectionForOv2Exchange } from "../design-studio/src/ov2View.js";
import { buildMarkdownReport, buildReportPayload, buildXmlReport } from "../design-studio/src/reportBuilder.js";

const ov1 = {
  nodes: [
    { id: "sense", label: "Sense node", detail: "Collects research observations" },
    { id: "decide", label: "Decision node", detail: "Assesses and decides" },
    { id: "act", label: "Action node", detail: "Coordinates research actions" }
  ],
  edges: []
};
const ov5 = {
  activities: [
    { id: "observe", title: "Observe", input: "Signals", output: "Observation package", sourceOv1NodeIds: ["sense"], refs: [] },
    { id: "decide", title: "Assess", input: "Observation package", output: "Research direction", sourceOv1NodeIds: ["decide"], refs: [] },
    { id: "act", title: "Coordinate", input: "Research direction", output: "Review feedback", sourceOv1NodeIds: ["act"], refs: [] },
    { id: "unmapped", title: "Unmapped activity", input: "", output: "", sourceOv1NodeIds: [], refs: [] }
  ],
  edges: [
    { id: "edge-1", sourceId: "observe", targetId: "decide", type: "information" },
    { id: "edge-2", sourceId: "decide", targetId: "act", type: "control" },
    { id: "edge-3", sourceId: "unmapped", targetId: "act", type: "information" }
  ]
};
const ooda = { sourceActivityIds: ["observe", "decide", "act"], lanes: [{ id: "observe", title: "Observe", subtitle: "Observe", nodes: [{ id: "ooda-1", sourceActivityId: "observe" }, { id: "ooda-2", sourceActivityId: "decide" }] }] };
const scenario = {
  id: "scenario-ov2",
  generatedAt: "2026-07-14T00:00:00.000Z",
  entities: [{ id: "entity-1", label: "Research unit", role: "sensor", position: [20, 30], sourceActivityId: "observe", sourceOodaIds: ["ooda-1"] }],
  areas: [],
  timeline: [],
  deploymentPlan: null
};

const model = buildOv2Model({ ov1, ov5, ooda, scenario });
assert(model.kind === "derived-ov2-operational-exchange" && model.nodes.length === 3, "OV-2 did not derive the expected operational nodes");
assert(model.exchanges.length === 2 && model.exchanges[0].sourceNodeId === "sense" && model.exchanges[0].targetNodeId === "decide", "OV-2 did not derive cross-node OV-5 exchanges");
assert(model.nodes.find((node) => node.id === "sense")?.oodaCount === 1 && model.nodes.find((node) => node.id === "sense")?.entityCount === 1, "OV-2 did not retain OODA or scenario coverage");
assert(model.unresolved.unmappedActivityIds.includes("unmapped") && model.unresolved.brokenEdgeIds.includes("edge-3"), "OV-2 did not expose unresolved source mapping");
assert(model.diagnostics.some((item) => item.id === "activity-ownership" && item.state === "review"), "OV-2 diagnostics did not mark unmapped activities for review");

const selection = selectionForOv2Exchange(model.exchanges[0].id, { ov1, ov5, ooda, scenario });
assert(selection?.kind === "ov2-exchange" && selection.facts.some(([key]) => key === "来源活动"), "OV-2 exchange selection lost source traceability");
const ov2Page = renderOv2({ ov1, ov5, ooda, scenario, ov5Storage: {} });
assert(ov2Page.includes('data-derived-provenance="ov2"') && ov2Page.includes("sourceOv1NodeIds") && ov2Page.includes('data-view="ov5"'), "OV-2 page should show provenance and jump to OV-5b");

const payload = buildReportPayload({
  project: { title: "OV-2 acceptance", brief: { objective: "Review", approach: "Derived exchange", assumptions: "Source model", risk: "Unmapped activity" }, citations: [] },
  direction: "Review",
  ov1,
  ov5,
  ooda,
  scenario,
  validationResult: null,
  knowledge: null,
  deployment: { settings: {}, status: "not-configured" }
});
const markdown = buildMarkdownReport(payload);
const xml = buildXmlReport(payload);
assert(payload.ov2.exchanges.length === 2 && markdown.includes("OV-2 作战节点交换") && markdown.includes("Sense node -> Decision node"), "OV-2 Markdown output is incomplete");
assert(xml.includes('<ov2 kind="derived-ov2-operational-exchange"') && xml.includes('<exchange id="ov2-'), "OV-2 XML output is incomplete");

console.log(`OV-2 acceptance passed: ${model.nodes.length} nodes, ${model.exchanges.length} exchanges, ${model.unresolved.unmappedActivityIds.length} unresolved activity.`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
