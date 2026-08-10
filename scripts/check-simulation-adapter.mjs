import { normalizeScenario } from "../server/projectModelNormalizers.mjs";
import { buildReportPayload, buildXmlReport, buildMarkdownReport } from "../design-studio/src/reportBuilder.js";
import { buildSimulationDiagnostics, createSimulationPackage, recordSimulationResult, recordSimulationSubmission, runLocalAbstractSimulation } from "../design-studio/src/simulationAdapter.js";
import { generateValidation } from "../design-studio/src/validationStore.js";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};

const scenario = {
  version: 1,
  id: "scenario-simulation-check",
  generatedAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z",
  source: { activityIds: ["activity-1"], oodaNodeIds: ["node-1"] },
  entities: [{ id: "entity-1", label: "Research sensor", role: "sensor", position: [20, 30], sourceActivityId: "activity-1", sourceOodaIds: ["node-1"] }],
  areas: [{ id: "area-1", label: "Research area", type: "coverage", position: [70, 30], size: 100 }],
  timeline: [{ id: "event-1", time: "T+00", title: "Observe", description: "Research event", sourceNodeId: "node-1" }],
  deploymentPlan: { mode: "role-area-layout-v1", state: "suggested", diagnostics: [] }
};

const disabled = { id: "external-sim", name: "External simulator", version: "2026.1", enabled: false };
const packagePayload = createSimulationPackage(scenario, disabled);
assert(packagePayload.contract === "combat-concept.simulation-adapter" && packagePayload.scenario.coordinateReference === "abstract-percent-grid", "Simulation package did not preserve the abstract-grid contract");
assert(!hasForbiddenField(packagePayload), "Simulation package exposed a prohibited live or tactical field");
assert(recordSimulationSubmission(scenario, disabled) === scenario, "Disabled adapter accepted a submission record");

const enabled = { ...disabled, enabled: true };
const submitted = recordSimulationSubmission(scenario, enabled);
assert(submitted.simulation?.runs?.length === 1 && submitted.simulation.runs[0].adapter.id === "external-sim", "Enabled adapter did not retain submission provenance");
const completed = recordSimulationResult(submitted, submitted.simulation.runs[0].id, {
  status: "completed",
  summary: "Abstract research review returned.",
  inputFingerprint: submitted.simulation.runs[0].input.inputFingerprint,
  metrics: [{ label: "Coverage consistency", value: 88, unit: "%" }]
});
assert(completed.simulation.runs[0].result?.status === "completed" && completed.simulation.runs[0].result.inputMatch === "matched" && completed.simulation.runs[0].result.metrics.length === 1, "Manual simulation result was not recorded with matching input provenance");
const mismatch = recordSimulationResult(submitted, submitted.simulation.runs[0].id, { status: "completed", summary: "Wrong package.", inputFingerprint: "sim-input-wrong" });
assert(mismatch.simulation.runs[0].result?.status === "inconclusive" && mismatch.simulation.runs[0].result.inputMatch === "mismatch", "Mismatched simulation input fingerprint was accepted as completed");
const unverified = recordSimulationResult(submitted, submitted.simulation.runs[0].id, { status: "completed", summary: "Legacy result." });
assert(unverified.simulation.runs[0].result?.inputMatch === "not-supplied" && buildSimulationDiagnostics(unverified).state === "review", "Unfingerprinted manual return was treated as a verified current result");
const local = runLocalAbstractSimulation(scenario, () => "2026-07-14T00:01:00.000Z");
assert(local.simulation?.runs?.[0]?.adapter?.mode === "local-deterministic" && local.simulation.runs[0].result?.metrics?.length === 4 && !hasForbiddenField(local.simulation.runs[0]), "Local abstract simulation did not retain a bounded non-tactical result");
assert(buildSimulationDiagnostics(local).latestRun?.freshness === "current" && local.simulation.runs[0].result?.inputMatch === "matched" && buildSimulationDiagnostics(local).state === "completed", "A local result was not retained as a matched current abstract evaluation");

const normalized = normalizeScenario(completed);
assert(normalized.simulation?.runs?.[0]?.result?.metrics?.[0]?.label === "Coverage consistency" && normalized.simulation.runs[0].result.inputMatch === "matched", "Scenario normalizer lost simulation result provenance");

const ov5 = { activities: [{ id: "activity-1", title: "Observe", input: "Signal", output: "Assessment" }], edges: [] };
const ooda = { lanes: [{ id: "observe", nodes: [{ id: "node-1", title: "Observe", duration: "10 minutes", sourceActivityId: "activity-1" }] }] };
const validation = generateValidation(ov5, ooda, completed, { nodes: [], edges: [] });
assert(validation.simulationDiagnostics?.state === "completed" && validation.simulationDiagnostics.latestRun?.result?.metricCount === 1, "Validation did not include simulation diagnostics");
const localValidation = generateValidation(ov5, ooda, local, { nodes: [], edges: [] });
assert(localValidation.issues.some((item) => item.title === "本地区域覆盖需复核") && localValidation.issues.some((item) => item.title === "本地部署诊断需复核"), "Local abstract simulation metrics did not produce transparent review issues");

const payload = buildReportPayload({
  project: { title: "Simulation contract acceptance", brief: { objective: "Review", approach: "Abstract only", assumptions: "Manual handoff", risk: "External result requires review" }, citations: [] },
  direction: "Review",
  ov1: { nodes: [], edges: [] },
  ov5: { activities: [], edges: [] },
  ooda: { sourceActivityIds: [], lanes: [] },
  scenario: completed,
  validationResult: validation,
  knowledge: null,
  deployment: { settings: {}, status: "not-configured" }
});
const markdown = buildMarkdownReport(payload);
const xml = buildXmlReport(payload);
assert(markdown.includes("仿真适配") && markdown.includes("Coverage consistency") && markdown.includes("回传输入指纹：matched"), "Markdown report lost simulation input-match provenance");
assert(xml.includes('<simulation status="completed"') && xml.includes('scope="abstract-research-only"') && xml.includes('<result status="completed" inputMatch="matched">'), "XML report lost abstract simulation input-match provenance");

const modifiedAfterRun = { ...local, entities: local.entities.map((entity) => entity.id === "entity-1" ? { ...entity, position: [95, 95] } : entity) };
const staleDiagnostics = buildSimulationDiagnostics(modifiedAfterRun);
const staleValidation = generateValidation(ov5, ooda, modifiedAfterRun, { nodes: [], edges: [] });
assert(staleDiagnostics.state === "stale" && staleDiagnostics.latestRun?.freshness === "stale", "Changed abstract scenario did not invalidate the prior simulation input");
assert(staleValidation.issues.some((item) => item.title === "本地抽象仿真结果已失效"), "Stale simulation result did not create an explicit validation issue");
console.log(`Simulation adapter acceptance passed: ${normalized.simulation.runs.length} run, ${validation.simulationDiagnostics.state} result.`);

function hasForbiddenField(value) {
  const forbidden = new Set(["latitude", "longitude", "target", "targetassignment", "route", "routing", "weapon", "weaponparameters"]);
  if (Array.isArray(value)) return value.some(hasForbiddenField);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, item]) => forbidden.has(key.toLowerCase()) || hasForbiddenField(item));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
