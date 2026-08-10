import { buildOv4Model } from "../design-studio/src/ov4Builder.js";
import { selectionForOv4Relation, selectionForOv4Role } from "../design-studio/src/ov4View.js";
import { buildMarkdownReport, buildReportPayload, buildXmlReport } from "../design-studio/src/reportBuilder.js";
import { generateValidation } from "../design-studio/src/validationStore.js";

globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

const ov1 = { nodes: [{ id: "sense", label: "Sense role", detail: "Abstract sensing" }, { id: "decide", label: "Decision role", detail: "Abstract decision" }], edges: [] };
const ov5 = { activities: [{ id: "a1", title: "Collect", sourceOv1NodeIds: ["sense"], input: "", output: "" }, { id: "a2", title: "Assess", sourceOv1NodeIds: ["decide"], input: "", output: "" }, { id: "orphan", title: "Unmapped", sourceOv1NodeIds: [], input: "", output: "" }], edges: [{ id: "e1", sourceId: "a1", targetId: "a2", type: "information" }] };
const ooda = { lanes: [{ id: "observe", title: "Observe", subtitle: "Observe", nodes: [{ id: "o1", sourceActivityId: "a1" }] }] };
const scenario = { entities: [{ id: "entity-1", sourceActivityId: "a1" }] };
const model = buildOv4Model({ ov1, ov5, ooda, scenario });
assert(model.kind === "derived-ov4-abstract-responsibility" && model.roles.length === 2 && model.relations.length === 1, "OV-4 did not derive roles and a cross-role relation");
assert(model.roles.find((role) => role.id === "sense")?.oodaCount === 1 && model.roles.find((role) => role.id === "sense")?.entityCount === 1 && model.unresolved.unmappedActivityIds.includes("orphan"), "OV-4 lost activity, OODA, scenario, or unresolved provenance");
assert(model.coverage.activity.percent === 67 && model.coverage.role.percent === 100, "OV-4 did not derive responsibility coverage percentages");
assert(generateValidation(ov5, ooda, scenario, ov1).issues.some((issue) => issue.title === "OV-4 活动责任待复核"), "OV-4 unresolved activity did not enter low-priority validation review");
assert(selectionForOv4Role("sense", { ov1, ov5, ooda, scenario })?.kind === "ov4-role" && selectionForOv4Relation(model.relations[0].id, { ov1, ov5, ooda, scenario })?.kind === "ov4-relation", "OV-4 inspector selections lost traceability");
const payload = buildReportPayload({ project: { title: "OV-4 acceptance", brief: { objective: "Review", approach: "Derived role", assumptions: "Abstract", risk: "Unmapped" }, citations: [] }, direction: "Review", ov1, ov5, ooda, scenario: null, validationResult: null, knowledge: null, deployment: { settings: {}, status: "not-configured" } });
assert(payload.ov4.roles.length === 2 && buildMarkdownReport(payload).includes("OV-4 抽象责任关系") && buildMarkdownReport(payload).includes("Sense role") && buildXmlReport(payload).includes('<ov4 kind="derived-ov4-abstract-responsibility"') && buildXmlReport(payload).includes('<relation id="ov4-'), "OV-4 report output is incomplete");
console.log(`OV-4 acceptance passed: ${model.roles.length} roles, ${model.relations.length} relation.`);
function assert(condition, message) { if (!condition) throw new Error(message); }
