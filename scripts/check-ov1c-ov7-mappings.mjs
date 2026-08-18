import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeDodafOv1b, normalizeDodafOv1c, normalizeDodafOv5, normalizeDodafOv6b, normalizeDodafOv6c, normalizeDodafOv7 } from "../shared/dodaf/products.js";
import { decodeArchitecturePackage, encodeArchitecturePackage } from "../shared/dodaf/exchange.js";
import { buildModelTopology, MODEL_RELATION_TYPES } from "../shared/modelTopology.js";
import { workflowStageForResource } from "../shared/workflowConfirmation.js";
import { buildOv1cModel, buildOv7Model, updateMappingProduct } from "../design-studio/src/mappingProductStore.js";
import { renderOv1c, renderOv7 } from "../design-studio/src/mappingProductView.js";
import { buildStructureReview } from "../design-studio/src/structureReviewBuilder.js";
import { buildMarkdownReport, buildReportPayload, buildXmlReport } from "../design-studio/src/reportBuilder.js";
import { saveModelSnapshot, snapshotContextFromState } from "../design-studio/src/modelSnapshotStore.js";
import { restoreModelSnapshot } from "../design-studio/src/modelSnapshotRestore.js";
import { createFileProjectRepository } from "../server/projectRepository.mjs";

const localStorageState = new Map();
globalThis.localStorage = {
  getItem: (key) => localStorageState.get(key) || null,
  setItem: (key, value) => localStorageState.set(key, String(value)),
  removeItem: (key) => localStorageState.delete(key)
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const forceMission = {
  status: "confirmed",
  tasksConfirmedAt: "2026-08-18T00:00:00.000Z",
  tasks: [
    { id: "task-1", name: "夺取制信息权任务", phaseId: "phase-1", objective: "压制对方感知" },
    { id: "task-2", name: "持续保障任务", phaseId: "phase-1", objective: "维持行动" }
  ],
  forces: [], combatForces: [], relations: []
};
const ov5 = normalizeDodafOv5({
  activities: [
    { id: "activity-1", title: "实施电磁压制", type: "影响", text: "执行", input: "目标", output: "效果" },
    { id: "activity-2", title: "评估压制效果", type: "评估", text: "评估", input: "态势", output: "结论" }
  ],
  edges: []
});
const ov6b = normalizeDodafOv6b({
  stateMachines: [{
    id: "machine-1", name: "任务状态机", subjectType: "task", subjectRef: "task-1",
    states: [{ id: "state-ready", name: "待命", kind: "initial" }, { id: "state-done", name: "完成", kind: "final" }],
    transitions: [{ id: "transition-start", sourceId: "state-ready", targetId: "state-done", condition: "接令后执行" }]
  }]
});
const ov6c = normalizeDodafOv6c({ sequences: [] });

const normalizedOv1c = normalizeDodafOv1c({ mappings: [
  { id: "map-task-1", taskRef: "task-1", activityRefs: ["activity-1"], judgment: "accepted", status: "confirmed", taskName: "不得复制" },
  { id: "duplicate-task-1", taskRef: "task-1", activityRefs: ["activity-2"] }
] });
assert(normalizedOv1c.mappings.length === 1, "OV1c duplicate task mappings must collapse to one stable source row");
assert(normalizedOv1c.mappings[0].activityRefs.includes("activity-1") && normalizedOv1c.mappings[0].activityRefs.includes("activity-2"), "OV1c duplicate source rows must merge activity refs without data loss");
assert(!("taskName" in normalizedOv1c.mappings[0]), "OV1c must not duplicate authoritative task text");
assert(normalizedOv1c.relations[0]?.sourceId === "task-1" && normalizedOv1c.relations[0]?.targetId === "activity-1", "OV1c must emit task-to-activity DM2 relations");

const ov1c = buildOv1cModel({ forceMission, ov5, ov1c: normalizeDodafOv1c({ mappings: [{ id: "map-task-1", taskRef: "task-1", activityRefs: ["activity-1"], judgment: "accepted", status: "confirmed" }] }) });
assert(ov1c.coverage.unmappedTaskRefs.includes("task-2"), "OV1c must diagnose unmapped tasks");
assert(ov1c.coverage.uncoveredActivityRefs.includes("activity-2"), "OV1c must diagnose uncovered activities");
let reviewedOv1c = updateMappingProduct(ov1c, "ov1c", "task-activity-task-2", { activityRefs: ["activity-2"], judgment: "accepted", note: "人工确认承接" });
reviewedOv1c = buildOv1cModel({ forceMission, ov5, ov1c: reviewedOv1c });
assert(reviewedOv1c.mappings.find((item) => item.taskRef === "task-2")?.status === "confirmed", "OV1c human acceptance must persist as confirmed");
assert(reviewedOv1c.mappings.find((item) => item.taskRef === "task-2")?.note === "人工确认承接", "OV1c human rationale must persist");

const brokenOv1c = buildOv1cModel({ forceMission, ov5, ov1c: { mappings: [
  { id: "broken-task", taskRef: "task-missing", activityRefs: ["activity-1"], judgment: "accepted", status: "confirmed" },
  { id: "broken-activity", taskRef: "task-1", activityRefs: ["activity-missing"], judgment: "accepted", status: "confirmed" }
] } });
assert(brokenOv1c.status === "conflict" && brokenOv1c.mappings.find((item) => item.id === "broken-task")?.status === "conflict" && brokenOv1c.mappings.find((item) => item.id === "broken-activity")?.status === "conflict", "Broken OV1c source or activity refs must force conflict status");
assert(brokenOv1c.coverage.orphanTaskRefs.includes("task-missing") && brokenOv1c.coverage.orphanActivityRefs.includes("activity-missing"), "OV1c orphan refs must remain visible");

const constrainedOv7 = normalizeDodafOv7({ mappings: [{ id: "semantic-check", subjectType: "state", sourceRef: "state-ready", activityRefs: ["activity-1"], semantic: "invented" }] });
assert(constrainedOv7.mappings[0].semantic === "executes", "OV7 semantic must be constrained to triggers/executes/ends");
let ov7 = buildOv7Model({ ov5, ov6b, ov7: { mappings: [{ id: "state-map", subjectType: "state", sourceRef: "state-ready", activityRefs: ["activity-1"], semantic: "executes", judgment: "accepted" }] } });
assert(ov7.coverage.unmappedSourceRefs.includes("state-done") && ov7.coverage.unmappedSourceRefs.includes("transition-start"), "OV7 must diagnose unmapped states and transitions");
const transitionMapping = ov7.mappings.find((item) => item.sourceRef === "transition-start");
ov7 = updateMappingProduct(ov7, "ov7", transitionMapping.id, { activityRefs: ["activity-2"], semantic: "triggers", judgment: "accepted" });
ov7 = buildOv7Model({ ov5, ov6b, ov7 });
assert(ov7.mappings.find((item) => item.sourceRef === "transition-start")?.semantic === "triggers", "OV7 transition semantic must persist");
const brokenOv7 = buildOv7Model({ ov5, ov6b, ov7: { mappings: [{ id: "broken-state", subjectType: "state", sourceRef: "state-missing", activityRefs: ["activity-missing"], judgment: "accepted", status: "confirmed" }] } });
assert(brokenOv7.status === "conflict" && brokenOv7.mappings.find((item) => item.id === "broken-state")?.status === "conflict", "Broken OV7 refs must force conflict status");
assert(brokenOv7.coverage.orphanSourceRefs.includes("state-missing") && brokenOv7.coverage.orphanActivityRefs.includes("activity-missing"), "OV7 orphan refs must remain visible");

const topology = buildModelTopology({ forceMission, ov5, ov6b, ov1c: reviewedOv1c, ov7 });
const ov1cNode = topology.nodes.find((item) => item.resource === "ov1c" && item.objectId === "map-task-1");
const ov7Node = topology.nodes.find((item) => item.resource === "ov7" && item.objectId === "state-map");
assert(ov1cNode && topology.links.some((link) => link.targetNodeId === ov1cNode.id && link.source.objectId === "task-1" && link.relationType === MODEL_RELATION_TYPES.BINDS_TO), "Topology must link OV1c to its task source");
assert(ov7Node && topology.links.some((link) => link.targetNodeId === ov7Node.id && link.source.objectId === "state-ready"), "Topology must link OV7 to the exact state source");
const orphanTopology = buildModelTopology({ forceMission, ov5, ov6b, ov1c: brokenOv1c, ov7: brokenOv7 });
assert(orphanTopology.diagnostics.some((item) => item.code === "orphan_reference" && item.ref === "task-missing"), "Topology must diagnose orphan OV1c task refs");
assert(orphanTopology.diagnostics.some((item) => item.code === "orphan_reference" && item.ref === "state-missing"), "Topology must diagnose orphan OV7 state refs");

const ov1cHtml = renderOv1c({ forceMission, ov5, ov1c: brokenOv1c, ov1cStorage: {} });
const ov7Html = renderOv7({ ov5, ov6b, ov7: brokenOv7, ov7Storage: {} });
assert(ov1cHtml.includes('data-focus-type="task"') && ov1cHtml.includes('data-view="operational-task"') && ov1cHtml.includes("来源引用失效"), "OV1c view must retain source navigation and broken-reference markers");
assert(ov7Html.includes('data-focus-type="state"') && ov7Html.includes('data-view="ov6b"') && ov7Html.includes("来源引用失效"), "OV7 view must retain state-source navigation and broken-reference markers");

const exchangeInput = { meta: { projectId: "mapping-demo", title: "Mapping Demo" }, products: { ov1c: reviewedOv1c, ov5, ov6b, ov7 } };
const jsonRoundTrip = decodeArchitecturePackage(encodeArchitecturePackage(exchangeInput, "json"), "json");
const xmlRoundTrip = decodeArchitecturePackage(encodeArchitecturePackage(exchangeInput, "xml"), "xml");
assert(jsonRoundTrip.products["OV-1c"].mappings.some((item) => item.taskRef === "task-2"), "JSON exchange must retain OV1c refs");
assert(xmlRoundTrip.products["OV-7"].mappings.some((item) => item.sourceRef === "transition-start" && item.semantic === "triggers"), "XML exchange must retain OV7 refs and semantic");

const snapshotState = { direction: "测试", brief: {}, inspiration: null, forceMission, ov1: { nodes: [], edges: [] }, ov1c: reviewedOv1c, ov5, ov6b, ov6c, ov7, ooda: { lanes: [] }, scenario: null, validationResult: null };
const snapshots = saveModelSnapshot(snapshotContextFromState(snapshotState, { title: "Mapping snapshot" }), []);
const restored = restoreModelSnapshot(snapshots[0], { briefSeed: {}, projectId: "mapping-demo" });
assert(restored.ov1c?.mappings.some((item) => item.taskRef === "task-2"), "Snapshot restore must retain OV1c mappings");
assert(restored.ov7?.mappings.some((item) => item.sourceRef === "transition-start"), "Snapshot restore must retain OV7 mappings");

const reportPayload = buildReportPayload({
  project: { title: "映射验收", brief: {}, citations: [] }, brief: {}, direction: "测试", forceMission,
  ov1: { nodes: [], edges: [] }, ov1c: reviewedOv1c, ov5, ov6b, ov6c, ov7,
  ooda: { lanes: [] }, scenario: null, validationResult: null, knowledge: null, deployment: {}
});
assert(buildMarkdownReport(reportPayload).includes("OV-1c 任务与作战活动映射") && buildMarkdownReport(reportPayload).includes("OV-7 状态与活动映射"), "Markdown report must include both mapping products");
assert(buildXmlReport(reportPayload).includes("<ov1c") && buildXmlReport(reportPayload).includes("<ov7"), "XML report must include both mapping products");
const review = buildStructureReview({ forceMission, ov1: { nodes: [], edges: [] }, ov5, ov6b, ov6c, ov1c: brokenOv1c, ov7: brokenOv7, ooda: { lanes: [] }, scenario: null });
assert(review.derived.ov1c.review > 0 && review.derived.ov7.review > 0, "Structure review must summarize OV1c/OV7 conflicts");
assert(review.issues.some((item) => item.sourceView === "ov1c") && review.issues.some((item) => item.sourceView === "ov7"), "Structure review must route mapping diagnostics back to both products");
assert(workflowStageForResource("ov1c") === 6 && workflowStageForResource("ov7") === 6, "Mapping products must invalidate simulation without changing earlier mainline stages");

const directory = await mkdtemp(join(tmpdir(), "combat-concept-mappings-"));
const databasePath = join(directory, "projects.sqlite");
const filePath = join(directory, "projects.json");
let repository = createFileProjectRepository({ databasePath, filePath, now: () => "2026-08-18T02:00:00.000Z" });
try {
  await repository.createProject({ id: "mapping-sqlite", title: "Mapping SQLite" });
  let revision = 0;
  const save = async (method, model) => {
    const result = await repository[method]("mapping-sqlite", { model, source: "test", expectedRevision: revision });
    revision = result.revision;
    return result;
  };
  await save("saveForceMissionPlan", forceMission);
  await save("saveOv1b", normalizeDodafOv1b({ decompositions: [{ parentTaskRef: "task-1", childTaskRef: "task-2" }] }));
  await save("saveOv5", ov5);
  await save("saveOv6b", ov6b);
  await save("saveOv6c", ov6c);
  await save("saveOv1c", reviewedOv1c);
  await save("saveOv7", ov7);
  repository.close();
  repository = createFileProjectRepository({ databasePath, filePath: join(directory, "reopen.json") });
  const reopenedOv1c = await repository.getOv1c("mapping-sqlite");
  const reopenedOv7 = await repository.getOv7("mapping-sqlite");
  assert(repository.getStatus().storage === "sqlite" && reopenedOv1c.model.mappings.some((item) => item.taskRef === "task-2"), "SQLite reopen must retain OV1c mappings");
  assert(reopenedOv7.model.mappings.some((item) => item.sourceRef === "transition-start"), "SQLite reopen must retain OV7 mappings");
  const exported = await repository.exportArchitecture("mapping-sqlite", { format: "xml" });
  assert(exported.body.includes('name="OV-1c"') && exported.body.includes('name="OV-7"'), "Repository XML export must include both mapping products");
  revision = exported.revision;
  const changedOv5 = normalizeDodafOv5({ ...ov5, activities: [...ov5.activities, { id: "activity-3", title: "新增活动", type: "协调", text: "新增" }] });
  await repository.saveOv5("mapping-sqlite", { model: changedOv5, source: "test-change", expectedRevision: revision });
  assert((await repository.getOv1c("mapping-sqlite")).stale, "OV5 changes must mark OV1c stale");
  assert((await repository.getOv7("mapping-sqlite")).stale, "OV5 changes must mark OV7 stale");
} finally {
  repository.close?.();
  await rm(directory, { recursive: true, force: true });
}

const mainSource = await readFile(new URL("../design-studio/src/main.js", import.meta.url), "utf8");
const flowSource = await readFile(new URL("../design-studio/src/contextualModelFlow.js", import.meta.url), "utf8");
assert(mainSource.includes('focusType === "state"') && mainSource.includes('focusType === "transition"'), "Main navigation must focus OV7 state/transition sources");
assert(flowSource.includes('scenario: ["ov1c", "ov7", "structure-review"]') && flowSource.includes('"ov1c", "ov6a"'), "Simulation contextual flow must expose enabled OV1c/OV7 entries");

console.log("OV1c/OV7 mapping acceptance passed: authority, conflicts, coverage, topology, exchange, snapshot, report, SQLite stale propagation, UI and navigation.");
