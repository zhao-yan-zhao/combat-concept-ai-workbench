import { buildOv3Model } from "../design-studio/src/ov3Builder.js";
import { renderOv3, selectionForOv3Exchange } from "../design-studio/src/ov3View.js";
import { buildMarkdownReport, buildReportPayload, buildXmlReport } from "../design-studio/src/reportBuilder.js";

const ov1 = { nodes: [{ id: "sense", label: "Sense" }, { id: "decide", label: "Decide" }], edges: [] };
const ov5 = {
  activities: [
    { id: "a1", title: "Collect", input: "Task", output: "Observation package", sourceOv1NodeIds: ["sense"], refs: [] },
    { id: "a2", title: "Assess", input: "Observation package", output: "Decision note", sourceOv1NodeIds: ["decide"], refs: [] },
    { id: "a3", title: "Coordinate", input: "Command instruction", output: "Review feedback", sourceOv1NodeIds: ["decide"], refs: [] },
    { id: "a4", title: "Support", input: "", output: "Support status", sourceOv1NodeIds: ["sense"], refs: [] }
  ],
  edges: [
    { id: "ready", sourceId: "a1", targetId: "a2", type: "information" },
    { id: "review", sourceId: "a2", targetId: "a3", type: "control" },
    { id: "pending", sourceId: "a3", targetId: "a4", type: "resource" },
    { id: "broken", sourceId: "missing", targetId: "a4", type: "information" }
  ]
};
const scenario = {
  id: "scenario-ov3",
  generatedAt: "2026-07-14T00:00:00.000Z",
  entities: [{ id: "entity-1", label: "Research entity", role: "support", position: [30, 40], sourceActivityId: "a1", sourceOodaIds: [] }],
  areas: [],
  timeline: [],
  deploymentPlan: null
};

const model = buildOv3Model({ ov5, scenario });
assert(model.kind === "derived-ov3-resource-exchange" && model.exchanges.length === 3, "OV-3 did not derive the expected activity exchanges");
assert(model.exchanges.find((item) => item.sourceActivityId === "a1")?.compatibility === "ready", "OV-3 did not identify a directly matching input/output contract");
assert(model.exchanges.find((item) => item.sourceActivityId === "a2")?.exchangeType === "control" && model.exchanges.find((item) => item.sourceActivityId === "a2")?.compatibility === "review", "OV-3 did not classify a reviewable control exchange");
// Soft token match: shared content words should count as ready without exact string equality.
const soft = buildOv3Model({
  ov5: {
    activities: [
      { id: "s1", title: "Send", input: "x", output: "目标数据包 摘要" },
      { id: "s2", title: "Recv", input: "目标数据包", output: "y" }
    ],
    edges: [{ id: "soft-edge", sourceId: "s1", targetId: "s2", type: "information" }]
  }
});
assert(soft.exchanges[0]?.compatibility === "ready", "OV-3 soft token overlap should mark shared resource terms ready");
assert(model.exchanges.find((item) => item.sourceActivityId === "a3")?.exchangeType === "resource" && model.exchanges.find((item) => item.sourceActivityId === "a3")?.compatibility === "pending", "OV-3 did not identify a missing resource contract definition");
assert(model.exchanges.find((item) => item.sourceActivityId === "a1")?.scenarioEntityCount === 1 && model.unresolved.unresolvedEdgeIds.includes("broken"), "OV-3 lost scenario coverage or unresolved-edge provenance");
assert(model.diagnostics.some((item) => item.id === "contract-definition" && item.state === "review"), "OV-3 diagnostics did not flag a missing contract definition");
assert(model.activities.length === 4 && model.activities[0].id === "a1", "OV-3 did not retain ordered matrix activities");
const matrixHtml = renderOv3({ ov5, scenario, ov5Storage: { status: "ready", mode: "project", label: "已同步" } });
assert(matrixHtml.includes("ov3-matrix") && matrixHtml.includes('data-ov3-exchange="ov3-'), "OV-3 did not render a selectable resource-flow matrix");
assert(matrixHtml.indexOf("ov3-matrix-section") < matrixHtml.indexOf("ov3-table-wrap") && matrixHtml.indexOf("ov3-table-wrap") < matrixHtml.indexOf("ov2-diagnostics"), "OV-3 did not prioritize matrix, then contract details, then diagnostics");

const selection = selectionForOv3Exchange(model.exchanges[0].id, { ov5, scenario });
assert(selection?.kind === "ov3-exchange" && selection.facts.some(([key]) => key === "源输出"), "OV-3 inspector selection lost exchange fields");

const payload = buildReportPayload({
  project: { title: "OV-3 acceptance", brief: { objective: "Review", approach: "Derived exchange", assumptions: "Source model", risk: "Contract mismatch" }, citations: [] },
  direction: "Review",
  ov1,
  ov5,
  ooda: { sourceActivityIds: [], lanes: [] },
  scenario,
  validationResult: null,
  knowledge: null,
  deployment: { settings: {}, status: "not-configured" }
});
const markdown = buildMarkdownReport(payload);
const xml = buildXmlReport(payload);
assert(payload.ov3.exchanges.length === 3 && markdown.includes("OV-3 资源交换") && markdown.includes("Collect -> Assess"), "OV-3 Markdown output is incomplete");
assert(xml.includes('<ov3 kind="derived-ov3-resource-exchange"') && xml.includes('compatibility="pending"'), "OV-3 XML output is incomplete");

console.log(`OV-3 acceptance passed: ${model.exchanges.length} exchanges, ${model.unresolved.missingContractCount} missing, ${model.unresolved.mismatchCount} review.`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
