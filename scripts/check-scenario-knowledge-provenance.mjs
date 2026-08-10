import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildExportArtifactFromPayload, buildReportPayload } from "../design-studio/src/reportBuilder.js";
import { deriveOodaFromOv5 } from "../design-studio/src/oodaStore.js";
import { buildScenarioGeoJson } from "../design-studio/src/scenarioGeoJsonBuilder.js";
import { createDeploymentData, generateScenario, isScenarioStale, createOodaSourceSignature } from "../design-studio/src/scenarioStore.js";
import { createOv5SourceSignature } from "../design-studio/src/oodaStore.js";
import { selectionForScenarioUnit } from "../design-studio/src/scenarioView.js";
import { createSimulationPackage, simulationInputFingerprint } from "../design-studio/src/simulationAdapter.js";
import { generateValidation } from "../design-studio/src/validationStore.js";
import { normalizeScenario } from "../server/projectModelNormalizers.mjs";
import { createFileProjectRepository } from "../server/projectRepository.mjs";

const local = new Map();
globalThis.localStorage = { getItem: (key) => local.get(key) || null, setItem: (key, value) => local.set(key, String(value)), removeItem: (key) => local.delete(key) };
const ov5 = {
  version: 1,
  activities: [
    { id: "sense", title: "Sense", type: "感知", text: "Abstract sensing", duration: "5 分钟", input: "Cue", output: "Signal", resources: "Abstract sensor", preconditions: "", constraints: "", refs: ["Sensor doctrine", "Study note"], sourceOv1NodeIds: [] },
    { id: "orient", title: "Orient", type: "评估", text: "Abstract review", duration: "5 分钟", input: "Signal", output: "Assessment", resources: "", preconditions: "", constraints: "", refs: [], sourceOv1NodeIds: [] },
    { id: "decide", title: "Decide", type: "决策", text: "Abstract decision", duration: "5 分钟", input: "Assessment", output: "Direction", resources: "", preconditions: "", constraints: "", refs: [], sourceOv1NodeIds: [] },
    { id: "act", title: "Act", type: "行动", text: "Abstract action", duration: "5 分钟", input: "Direction", output: "Feedback", resources: "", preconditions: "", constraints: "", refs: [], sourceOv1NodeIds: [] }
  ],
  edges: []
};
const ooda = deriveOodaFromOv5(ov5);
const scenario = generateScenario(ov5, ooda);
assert(scenario.sourceOv5Signature === createOv5SourceSignature(ov5) && scenario.sourceOodaSignature === createOodaSourceSignature(ooda), "Scenario did not stamp upstream signatures");
assert(!isScenarioStale(scenario, ov5, ooda), "Fresh scenario unexpectedly stale");
const changedOv5 = { ...ov5, activities: ov5.activities.map((item, index) => index === 0 ? { ...item, title: `${item.title}-changed` } : item) };
assert(isScenarioStale(scenario, changedOv5, ooda), "Scenario should become stale after OV-5 change");
const sensor = scenario.entities.find((entity) => entity.role === "sensor");
assert(sensor.sourceKnowledgeRefs.join("|") === "Sensor doctrine|Study note", "Scenario entity did not inherit bounded OV-5/OODA knowledge references");
const selection = selectionForScenarioUnit(sensor.id, scenario);
assert(selection.refs.join("|") === "Sensor doctrine|Study note", "Scenario selection did not expose source knowledge references to the default-sensitive-filtered evidence panel");
const deployment = createDeploymentData(scenario);
assert(deployment.entities.find((entity) => entity.id === sensor.id).sourceKnowledgeRefs.length === 2, "Deployment handoff lost source knowledge references");
const geojson = buildScenarioGeoJson(scenario);
assert(geojson.features.find((feature) => feature.id === sensor.id).properties.sourceKnowledgeRefs.join("|") === "Sensor doctrine|Study note", "GeoJSON lost source knowledge references");
const simulation = createSimulationPackage(scenario);
assert(simulation.scenario.entities.find((entity) => entity.id === sensor.id).sourceKnowledgeRefs.join("|") === "Sensor doctrine|Study note", "Simulation input lost source knowledge references");
const initialFingerprint = simulationInputFingerprint(scenario);
const revisedScenario = structuredClone(scenario);
revisedScenario.entities.find((entity) => entity.id === sensor.id).sourceKnowledgeRefs = ["Revised study note"];
assert(simulationInputFingerprint(revisedScenario) !== initialFingerprint, "Simulation input fingerprint did not detect source knowledge-reference change");
const normalized = normalizeScenario(scenario);
assert(normalized.entities.find((entity) => entity.id === sensor.id).sourceKnowledgeRefs.join("|") === "Sensor doctrine|Study note", "Server scenario normalization lost source knowledge references");

const ov1 = { version: 1, nodes: [{ id: "node-1", label: "Node", detail: "Abstract" }], edges: [] };
const validation = generateValidation(ov5, ooda, scenario, ov1);
assert(!validation.issues.some((issue) => issue.title === "想定实体知识依据待复核"), "Derived scenario unexpectedly lost knowledge provenance");
const missing = structuredClone(scenario);
missing.entities.find((entity) => entity.id === sensor.id).sourceKnowledgeRefs = [];
assert(generateValidation(ov5, ooda, missing, ov1).issues.some((issue) => issue.title === "想定实体知识依据待复核"), "Validation did not flag a missing scenario knowledge reference");
const payload = buildReportPayload({ project: { title: "Scenario provenance report", brief: {}, citations: [] }, direction: "Review", ov1, ov5, ooda, scenario, validationResult: validation, knowledge: null, deployment: {} });
assert(buildExportArtifactFromPayload("markdown", payload).content.includes("知识依据：Sensor doctrine、Study note"), "Markdown report lost scenario source knowledge references");

const directory = await mkdtemp(join(tmpdir(), "combat-concept-scenario-knowledge-"));
const repository = createFileProjectRepository({ filePath: join(directory, "projects.json") });
try {
  const brief = await repository.saveBrief("default", { direction: "Review", source: "manual", brief: { objective: "Knowledge provenance", approach: "Review", assumptions: "Abstract", risk: "Bounded" } });
  const savedOv5 = await repository.saveOv5("default", { source: "manual", expectedRevision: brief.revision, model: ov5 });
  const savedOoda = await repository.saveOoda("default", { source: "manual", expectedRevision: savedOv5.revision, model: ooda });
  await repository.saveScenario("default", { source: "manual", expectedRevision: savedOoda.revision, model: scenario });
  const reopened = createFileProjectRepository({ filePath: join(directory, "projects.json") });
  const restored = await reopened.getScenario("default");
  assert(restored.model.entities.find((entity) => entity.id === sensor.id).sourceKnowledgeRefs.join("|") === "Sensor doctrine|Study note", "Project repository reopen lost scenario source knowledge references");
  reopened.close();
} finally {
  repository.close();
  await rm(directory, { recursive: true, force: true });
}
console.log("Scenario knowledge-provenance acceptance passed: generation, selection evidence, handoff, GeoJSON, simulation freshness, persistence, validation, and report are connected.");

function assert(condition, message) { if (!condition) throw new Error(message); }
