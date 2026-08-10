import { buildOv6cModel } from "../design-studio/src/ov6cBuilder.js";
import { selectionForOv6cEvent } from "../design-studio/src/ov6cView.js";
import { buildMarkdownReport, buildReportPayload, buildXmlReport } from "../design-studio/src/reportBuilder.js";
import { generateValidation } from "../design-studio/src/validationStore.js";

globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

const ov1 = { nodes: [{ id: "sense", label: "Sense", detail: "Observe" }], edges: [] };
const ov5 = { activities: [{ id: "observe", title: "Observe", input: "Signal", output: "Cue", sourceOv1NodeIds: ["sense"], refs: [] }, { id: "decide", title: "Decide", input: "Cue", output: "Direction", sourceOv1NodeIds: ["sense"], refs: [] }], edges: [{ id: "edge-1", sourceId: "observe", targetId: "decide", type: "information" }] };
const ooda = {
  lanes: [{ id: "observe", title: "Observe", subtitle: "Observe", nodes: [{ id: "node-observe", title: "Observe", text: "Collect cue", sourceActivityId: "observe" }, { id: "node-decide", title: "Decide", text: "Review cue", sourceActivityId: "decide" }, { id: "node-unscheduled", title: "Review", text: "Check outcome", sourceActivityId: "decide" }] }]
};
const scenario = {
  id: "scenario-ov6c", generatedAt: "2026-07-15T00:00:00.000Z", updatedAt: "2026-07-15T00:00:00.000Z",
  entities: [{ id: "entity-1", label: "Research sensor", role: "sensor", position: [20, 30], sourceActivityId: "observe", sourceOodaIds: ["node-observe"] }], areas: [],
  timeline: [{ id: "event-1", time: "T+12", title: "Decide", description: "Review cue", sourceNodeId: "node-decide" }, { id: "event-2", time: "T+05", title: "Observe", description: "Collect cue", sourceNodeId: "node-observe" }, { id: "event-3", time: "T+18", title: "Unknown", description: "Review source", sourceNodeId: "node-missing" }],
  deploymentPlan: null,
  deploymentReview: { bridgeOrigin: "http://127.0.0.1:8765", exchangeId: "exchange-1", changeId: "change-1", receivedAt: "2026-07-15T00:01:00.000Z" }
};

const model = buildOv6cModel({ ooda, scenario });
assert(model.kind === "derived-ov6c-event-trace" && model.events.length === 4, "OV-6c did not derive timeline and unscheduled events");
assert(model.unresolved.unscheduledNodeIds.includes("node-unscheduled") && model.unresolved.orphanTimelineIds.includes("event-3") && model.unresolved.outOfOrderIds.length === 1, "OV-6c did not expose mapping or ordering diagnostics");
assert(model.events.find((item) => item.sourceNodeId === "node-observe")?.outOfOrder && model.events.find((item) => item.sourceNodeId === "node-observe")?.reviewReasons.includes("抽象时间早于前一事件"), "OV-6c did not annotate the specific out-of-order event");
assert(model.source.deploymentReturnAccepted && model.events.find((item) => item.sourceNodeId === "node-observe")?.entityCount === 1, "OV-6c lost deployment-return or entity provenance");
const unscheduledOnly = buildOv6cModel({ ooda, scenario: { entities: [], timeline: [] } });
assert(unscheduledOnly.diagnostics.find((item) => item.id === "timeline-events")?.state === "pending", "OV-6c treated unscheduled OODA nodes as a completed scenario timeline");
const selection = selectionForOv6cEvent(model.events[0].id, { ooda, scenario });
assert(selection?.kind === "ov6c-event" && selection.facts.some(([key]) => key === "OODA 节点"), "OV-6c event selection lost source traceability");

const payload = buildReportPayload({ project: { title: "OV-6c acceptance", brief: { objective: "Review", approach: "Trace", assumptions: "Abstract", risk: "Ordering" }, citations: [] }, direction: "Review", ov1, ov5, ooda, scenario, validationResult: null, knowledge: null, deployment: { settings: { targetUrl: "http://127.0.0.1:8765/" }, status: "已回传调整" } });
const validation = generateValidation(ov5, ooda, scenario, ov1);
assert(validation.issues.some((item) => item.title === "OV-6c 节点待排程" && item.level === "low") && validation.issues.some((item) => item.title === "OV-6c 时间线来源待复核" && item.level === "low") && validation.issues.some((item) => item.title === "OV-6c 时间顺序待复核" && item.level === "low"), "OV-6c diagnostics were not represented as low-priority validation review issues");
const markdown = buildMarkdownReport(payload);
const xml = buildXmlReport(payload);
assert(payload.ov6c.events.length === 4 && markdown.includes("OV-6c") && markdown.includes("Observe") && xml.includes('<ov6c kind="derived-ov6c-event-trace"') && xml.includes('sourceNodeId="node-observe"') && xml.includes('deploymentReturnAccepted="true"'), "OV-6c report output is incomplete");
console.log(`OV-6c acceptance passed: ${model.events.length} events, ${model.unresolved.unscheduledNodeIds.length} unscheduled, ${model.unresolved.orphanTimelineIds.length} orphan.`);

function assert(condition, message) { if (!condition) throw new Error(message); }
