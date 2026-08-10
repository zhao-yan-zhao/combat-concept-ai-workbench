import { acceptDeploymentChange, createDeploymentExchange, createDeploymentMessage, deploymentMessageTypes, DEPLOYMENT_PROTOCOL_VERSION, isDeploymentMessage } from "../design-studio/src/deploymentProtocol.js";
import { applyDeploymentChanges, createDeploymentData } from "../design-studio/src/scenarioStore.js";
import { buildScenarioGeoJson } from "../design-studio/src/scenarioGeoJsonBuilder.js";
import { normalizeScenario } from "../server/projectModelNormalizers.mjs";
import { buildMarkdownReport, buildReportPayload, buildXmlReport } from "../design-studio/src/reportBuilder.js";
import { compareModelSnapshots } from "../design-studio/src/modelCompare.js";

globalThis.localStorage = { setItem() {}, getItem() { return null; }, removeItem() {} };

const scenario = {
  id: "scenario-bridge-test",
  generatedAt: "2026-07-15T00:00:00.000Z",
  entities: [{ id: "sensor-1", label: "Sensor", role: "sensor", position: [20, 30], sourceActivityId: "sense", sourceOodaIds: [] }],
  areas: [],
  timeline: []
};
const deploymentData = createDeploymentData(scenario);
const exchange = createDeploymentExchange(deploymentData, 7);
const load = createDeploymentMessage(deploymentMessageTypes.load, { deploymentData, exchange });
assert(DEPLOYMENT_PROTOCOL_VERSION === 2 && isDeploymentMessage(load, deploymentMessageTypes.load) && load.payload.exchange.scenarioId === scenario.id, "Versioned deployment load message omitted its exchange identity");

const accepted = acceptDeploymentChange({
  scenarioId: scenario.id,
  exchangeId: exchange.id,
  changeId: "change-001",
  changes: [{ entityId: "sensor-1", position: [130, -10] }]
}, exchange);
assert(accepted?.changeId === "change-001" && accepted.changes[0].position[0] === 100 && accepted.changes[0].position[1] === 0, "Current deployment exchange did not accept and bound a valid change");
assert(acceptDeploymentChange({ scenarioId: scenario.id, exchangeId: "expired", changeId: "change-002", changes: accepted.changes }, exchange) === null, "Expired deployment exchange was accepted");
assert(acceptDeploymentChange({ scenarioId: scenario.id, exchangeId: exchange.id, changes: accepted.changes }, exchange) === null, "Unidentified deployment change was accepted");

const review = { bridgeOrigin: "http://127.0.0.1:8765", exchangeId: exchange.id, changeId: accepted.changeId, scenarioUpdatedAt: exchange.scenarioUpdatedAt, receivedAt: "2026-07-15T00:01:00.000Z" };
const adjusted = applyDeploymentChanges(scenario, accepted.changes, review);
const normalized = normalizeScenario(adjusted);
const geojson = buildScenarioGeoJson(normalized);
assert(normalized.entities[0].position[0] === 100 && normalized.deploymentReview?.exchangeId === exchange.id && normalized.deploymentReview.changeId === accepted.changeId, "Scenario normalization lost accepted deployment review provenance");
assert(geojson.properties.deploymentReview?.changeId === accepted.changeId, "Deployment GeoJSON lost review provenance");
const report = buildReportPayload({
  project: { title: "Bridge protocol acceptance", brief: { objective: "Review", approach: "Abstract bridge", assumptions: "Manual return", risk: "Stale return" }, citations: [] },
  direction: "Review",
  ov1: { nodes: [], edges: [] },
  ov5: { activities: [], edges: [] },
  ooda: { sourceActivityIds: [], lanes: [] },
  scenario: normalized,
  validationResult: null,
  knowledge: null,
  deployment: { settings: { targetUrl: "http://127.0.0.1:8765/" }, status: "已回传调整" }
});
assert(buildMarkdownReport(report).includes(exchange.id) && buildXmlReport(report).includes(`exchangeId="${exchange.id}"`), "Deployment report output lost accepted return provenance");
const comparison = compareModelSnapshots(
  { id: "baseline", label: "M001", direction: "Review", model: { brief: {}, ov1: { nodes: [], edges: [] }, ov5: { activities: [], edges: [] }, ooda: { lanes: [], durationMinutes: 0 }, scenario: { ...normalized, deploymentReview: null }, inspiration: null, validation: { scores: [], issues: [] } } },
  { id: "candidate", label: "M002", direction: "Review", model: { brief: {}, ov1: { nodes: [], edges: [] }, ov5: { activities: [], edges: [] }, ooda: { lanes: [], durationMinutes: 0 }, scenario: normalized, inspiration: { summary: "Recorded", messages: [{ role: "user", text: "Review context" }] }, validation: { scores: [], issues: [] } } }
);
assert(comparison.metrics.find((item) => item.label === "人工部署回传")?.delta === 1 && comparison.changes.some((item) => item.label === "人工部署回传" && item.added.length === 1) && comparison.changes.some((item) => item.label === "灵感孵化轨迹" && item.added.length === 1), "Model comparison did not expose deployment return or inspiration context changes");
console.log("Deployment bridge protocol acceptance passed: versioned exchange, stale rejection, bounded change, and review provenance.");

function assert(condition, message) { if (!condition) throw new Error(message); }
