import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildExportArtifactFromPayload, buildReportPayload } from "../design-studio/src/reportBuilder.js";
import { deriveOodaFromOv5, normalizeEquipmentRefs, updateOodaNode } from "../design-studio/src/oodaStore.js";
import { generateValidation } from "../design-studio/src/validationStore.js";
import { normalizeOoda } from "../server/projectModelNormalizers.mjs";
import { createFileProjectRepository } from "../server/projectRepository.mjs";

const local = new Map();
globalThis.localStorage = { getItem: (key) => local.get(key) || null, setItem: (key, value) => local.set(key, String(value)), removeItem: (key) => local.delete(key) };
const ov5 = {
  version: 1,
  activities: [
    { id: "observe-source", title: "Observe source", type: "感知", text: "Observe", duration: "5 分钟", input: "Signal", output: "Cue", resources: "Abstract sensor、Review console", preconditions: "", constraints: "", refs: [], sourceOv1NodeIds: [] },
    { id: "orient-source", title: "Orient source", type: "评估", text: "Orient", duration: "5 分钟", input: "Cue", output: "Assessment", resources: "", preconditions: "", constraints: "", refs: [], sourceOv1NodeIds: [] },
    { id: "decide-source", title: "Decide source", type: "决策", text: "Decide", duration: "5 分钟", input: "Assessment", output: "Direction", resources: "", preconditions: "", constraints: "", refs: [], sourceOv1NodeIds: [] },
    { id: "act-source", title: "Act source", type: "行动", text: "Act", duration: "5 分钟", input: "Direction", output: "Feedback", resources: "", preconditions: "", constraints: "", refs: [], sourceOv1NodeIds: [] }
  ],
  edges: []
};
const ooda = deriveOodaFromOv5(ov5);
const observeNode = ooda.lanes.find((lane) => lane.id === "observe").nodes[0];
assert(observeNode.equipmentRefs.join("|") === "Abstract sensor|Review console", "OV-5 resources were not derived as bounded OODA equipment references");
updateOodaNode(ooda, observeNode.id, { equipmentRefs: normalizeEquipmentRefs("  Abstract sensor, Abstract sensor；Review console  ") });
assert(observeNode.equipmentRefs.join("|") === "Abstract sensor|Review console", "OODA equipment-reference editing did not normalize duplicates");
const normalized = normalizeOoda(ooda);
assert(normalized.lanes[0].nodes[0].equipmentRefs.join("|") === "Abstract sensor|Review console", "Server normalization lost OODA equipment references");

const directory = await mkdtemp(join(tmpdir(), "combat-concept-ooda-equipment-"));
const repository = createFileProjectRepository({ filePath: join(directory, "projects.json") });
try {
  const brief = await repository.saveBrief("default", { direction: "Review", source: "manual", brief: { objective: "Equipment references", approach: "Review", assumptions: "Abstract", risk: "Bounded" } });
  const saved = await repository.saveOoda("default", { source: "manual", expectedRevision: brief.revision, model: ooda });
  const reopened = createFileProjectRepository({ filePath: join(directory, "projects.json") });
  const restored = await reopened.getOoda("default");
  assert(saved.model.lanes[0].nodes[0].equipmentRefs.length === 2 && restored.model.lanes[0].nodes[0].equipmentRefs[1] === "Review console", "Project repository did not persist OODA equipment references");
  reopened.close();
} finally {
  repository.close();
  await rm(directory, { recursive: true, force: true });
}

const ov1 = { version: 1, nodes: [{ id: "node-1", label: "Node", detail: "Abstract" }], edges: [] };
const validation = generateValidation(ov5, ooda, null, ov1);
assert(validation.oodaDiagnostics?.checks.some((check) => check.id === "equipment-binding" && check.state === "ready"), "Validation did not report complete OODA equipment bindings");
observeNode.equipmentRefs = [];
const missingBinding = generateValidation(ov5, ooda, null, ov1);
assert(missingBinding.issues.some((issue) => issue.title === "OODA 关联装备待复核"), "Validation did not raise a review issue for a missing OODA equipment binding");
observeNode.equipmentRefs = ["Abstract sensor", "Review console"];
const payload = buildReportPayload({ project: { title: "Equipment report", brief: {}, citations: [] }, direction: "Review", ov1, ov5, ooda, scenario: null, validationResult: validation, knowledge: null, deployment: {} });
const markdown = buildExportArtifactFromPayload("markdown", payload).content;
const xml = buildExportArtifactFromPayload("xml", payload).content;
assert(markdown.includes("关联装备 Abstract sensor、Review console"), "Markdown report lost OODA equipment references");
assert(xml.includes("<equipmentReferences>") && xml.includes("<reference>Abstract sensor</reference>"), "XML report lost OODA equipment references");
console.log("OODA equipment-reference acceptance passed: derivation, editing, persistence, validation, Markdown, and XML are connected.");

function assert(condition, message) { if (!condition) throw new Error(message); }
