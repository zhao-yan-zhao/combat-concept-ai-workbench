import { buildExportArtifactFromPayload, buildReportPayload } from "../design-studio/src/reportBuilder.js";
import { deriveOodaFromOv5, normalizeKnowledgeRefs, updateOodaNode } from "../design-studio/src/oodaStore.js";
import { selectionForOoda } from "../design-studio/src/oodaView.js";
import { generateValidation } from "../design-studio/src/validationStore.js";
import { normalizeOoda } from "../server/projectModelNormalizers.mjs";

const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) };
const ov5 = {
  version: 1,
  activities: [
    { id: "observe-source", title: "Observe source", type: "感知", text: "Observe", duration: "5 分钟", input: "Signal", output: "Cue", resources: "", preconditions: "", constraints: "", refs: ["Evidence note", "Doctrine note"], sourceOv1NodeIds: [] },
    { id: "orient-source", title: "Orient source", type: "评估", text: "Orient", duration: "5 分钟", input: "Cue", output: "Assessment", resources: "", preconditions: "", constraints: "", refs: [], sourceOv1NodeIds: [] },
    { id: "decide-source", title: "Decide source", type: "决策", text: "Decide", duration: "5 分钟", input: "Assessment", output: "Direction", resources: "", preconditions: "", constraints: "", refs: [], sourceOv1NodeIds: [] },
    { id: "act-source", title: "Act source", type: "行动", text: "Act", duration: "5 分钟", input: "Direction", output: "Feedback", resources: "", preconditions: "", constraints: "", refs: [], sourceOv1NodeIds: [] }
  ],
  edges: []
};
const ooda = deriveOodaFromOv5(ov5);
const observeNode = ooda.lanes.find((lane) => lane.id === "observe").nodes[0];
assert(observeNode.knowledgeRefs.join("|") === "Evidence note|Doctrine note", "OV-5 knowledge references were not derived into OODA");
updateOodaNode(ooda, observeNode.id, { knowledgeRefs: normalizeKnowledgeRefs(" Doctrine note, Evidence note, Doctrine note ") });
assert(observeNode.knowledgeRefs.join("|") === "Doctrine note|Evidence note", "OODA knowledge-reference editing did not normalize duplicate references");
const selection = selectionForOoda(observeNode.id, { ooda, ov5 });
assert(selection.refs.join("|") === "Doctrine note|Evidence note", "OODA selection did not expose knowledge references to the existing default-sensitive-filtered evidence panel");
const normalized = normalizeOoda(ooda);
assert(normalized.lanes[0].nodes[0].knowledgeRefs.join("|") === "Doctrine note|Evidence note", "Server normalization lost OODA knowledge references");

const ov1 = { version: 1, nodes: [{ id: "node-1", label: "Node", detail: "Abstract" }], edges: [] };
const validation = generateValidation(ov5, ooda, null, ov1);
assert(validation.oodaDiagnostics?.checks.some((check) => check.id === "knowledge-binding" && check.state === "ready"), "Validation did not report complete OODA knowledge bindings");
observeNode.knowledgeRefs = [];
const missingBinding = generateValidation(ov5, ooda, null, ov1);
assert(missingBinding.issues.some((issue) => issue.title === "OODA 知识依据待复核"), "Validation did not create a review issue for a missing OODA knowledge reference");
observeNode.knowledgeRefs = ["Doctrine note", "Evidence note"];
const payload = buildReportPayload({ project: { title: "Knowledge-reference report", brief: {}, citations: [] }, direction: "Review", ov1, ov5, ooda, scenario: null, validationResult: validation, knowledge: null, deployment: {} });
const markdown = buildExportArtifactFromPayload("markdown", payload).content;
const xml = buildExportArtifactFromPayload("xml", payload).content;
assert(markdown.includes("知识依据 Doctrine note、Evidence note"), "Markdown report lost OODA knowledge references");
assert(xml.includes("<knowledgeReferences>") && xml.includes("<reference>Doctrine note</reference>"), "XML report lost OODA knowledge references");
console.log("OODA knowledge-reference acceptance passed: derivation, editing, selection evidence, normalization, validation, Markdown, and XML are connected.");

function assert(condition, message) { if (!condition) throw new Error(message); }
