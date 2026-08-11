const storage = new Map();

globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  }
};

const { project } = await import("../design-studio/src/data.js");
const { addEdge, getAssignableParentActivities, loadOv5Model, updateActivity } = await import("../design-studio/src/ov5Store.js");
const { addOv1Edge, addOv1Node, createOv1Model, deleteOv1Node, hasPersistedOv1Model, loadOv1Model, saveOv1Model, setOv1ProjectScope, updateOv1Node } = await import("../design-studio/src/ov1Store.js");
const { calculateOv1CanvasPosition } = await import("../design-studio/src/drawflowCanvasController.js");
const { createAiOv1Draft, createLocalOv1Draft } = await import("../design-studio/src/ov1DraftStore.js");
const { deriveOodaFromOv5, getOodaDuration } = await import("../design-studio/src/oodaStore.js");
const { applyDeploymentChanges, createDeploymentData, generateScenario, recommendScenarioDeployment } = await import("../design-studio/src/scenarioStore.js");
const { generateValidation } = await import("../design-studio/src/validationStore.js");
const { applyRedTeamReview, createLocalRedTeamReview } = await import("../design-studio/src/redTeamStore.js");
const { buildExportArtifactFromPayload, buildReportPayload } = await import("../design-studio/src/reportBuilder.js");
const { loadReportVersions, saveReportVersion, upsertReportVersion } = await import("../design-studio/src/reportVersionStore.js");
const { compareModelSnapshots } = await import("../design-studio/src/modelCompare.js");
const { loadModelSnapshots, saveModelSnapshot, upsertModelSnapshot } = await import("../design-studio/src/modelSnapshotStore.js");
const { restoreModelSnapshot } = await import("../design-studio/src/modelSnapshotRestore.js");
const { buildModelComparisonArtifact } = await import("../design-studio/src/modelComparisonBuilder.js");
const { buildTraceability, getTraceTargets } = await import("../design-studio/src/traceabilityBuilder.js");
const { addInspirationReply, createInspirationSession } = await import("../design-studio/src/inspirationStore.js");
const { selectEvidenceForAi } = await import("../design-studio/src/evidenceSelectionStore.js");
const { buildObsidianArchive } = await import("../design-studio/src/obsidianArchiveBuilder.js");
const { loadObsidianArchiveRecord, saveObsidianArchiveRecord } = await import("../design-studio/src/obsidianArchiveStore.js");

// Research-chat path is the live inspiration surface (legacy follow-up/seed stores retired).
let inspiration = createInspirationSession();
inspiration = addInspirationReply(inspiration, "研究一个信息不完整条件下的协同决策问题。");
assert(
  inspiration.messages.some((message) => message.role === "user" && message.text.includes("信息不完整"))
    && inspiration.stage >= 1,
  "Research-chat inspiration reply was not retained"
);

let ov1 = createOv1Model();
ov1 = addOv1Node(ov1, { label: "备用协同节点", detail: "用于验证自定义节点与布局持久化。", x: 62, y: 58 });
const customNode = ov1.nodes.at(-1);
assert(customNode && (customNode.x !== "62%" || customNode.y !== "58%"), "OV-1 custom node overlap was not resolved");
const initialCustomPosition = `${customNode.x},${customNode.y}`;
ov1 = addOv1Edge(ov1, { sourceId: "sense", targetId: customNode.id, type: "信息流" });
ov1 = updateOv1Node(ov1, customNode.id, { label: "已修订协同节点", detail: "已更新节点说明。", x: 66, y: 60 });
const updatedCustomNode = ov1.nodes.find((node) => node.id === customNode.id);
assert(updatedCustomNode?.label === "已修订协同节点" && `${updatedCustomNode.x},${updatedCustomNode.y}` !== initialCustomPosition, "OV-1 node update was not persisted");
ov1 = deleteOv1Node(ov1, customNode.id);
assert(!ov1.nodes.some((node) => node.id === customNode.id) && !ov1.edges.some((edge) => edge.sourceId === customNode.id || edge.targetId === customNode.id), "OV-1 node deletion did not remove relations");
const aiOv1 = createAiOv1Draft({ brief: project.brief, direction: "体系压制", draft: {
  concept: { mission: "概念图", objective: "研究目标", scope: "研究范围", phase: "概念评估", expectedEffects: "研究效果", constraints: "研究约束" },
  nodes: [
    { id: "sense", label: "多域态势融合平台", detail: "态势输入", category: "装备/平台", kind: "equipment" },
    { id: "decide", label: "协同指挥节点", detail: "协同判断", category: "指挥节点", kind: "command" },
    { id: "control", label: "约束防护协同", detail: "高层动作", category: "关键动作", kind: "action" },
    { id: "opponent", label: "外部威胁环境", detail: "外部影响", category: "外部对象", kind: "external" },
    { id: "assess", label: "体系韧性效果", detail: "效果评估", category: "预期效果", kind: "effect" }
  ],
  edges: [{ id: "sense-decide", sourceId: "sense", targetId: "decide", type: "信息流" }]
} });
const aiOv1ById = new Map(aiOv1.nodes.map((node) => [node.id, node]));
assert(aiOv1.nodes.length === 5 && aiOv1.edges.length >= 1 && aiOv1.provenance?.mode === "ai" && aiOv1ById.get("opponent")?.x === "4%" && aiOv1ById.get("opponent")?.y === "48%" && aiOv1ById.get("sense")?.x === "22%" && aiOv1ById.get("sense")?.y === "48%" && aiOv1ById.get("decide")?.x === "42%" && aiOv1ById.get("decide")?.y === "48%" && aiOv1ById.get("control")?.x === "60%" && aiOv1ById.get("control")?.y === "48%" && aiOv1ById.get("assess")?.x === "84%" && aiOv1ById.get("assess")?.y === "48%" && aiOv1ById.get("sense")?.label === "多域态势融合平台", "AI OV-1 draft layout is incomplete");
const draggedOv1Position = calculateOv1CanvasPosition({ node: ov1.nodes[0], startX: 100, startY: 100, clientX: 900, clientY: -300, boardRect: { width: 400, height: 400 } });
assert(draggedOv1Position.x === "76%" && draggedOv1Position.y === "0%", "OV-1 canvas drag position was not bounded");
const localOv1 = createLocalOv1Draft({ brief: project.brief, direction: "诱导牵制" });
assert(localOv1.provenance?.mode === "local" && localOv1.nodes.find((node) => node.id === "assess")?.x === "84%" && localOv1.nodes.find((node) => node.id === "assess")?.y === "48%", "Local OV-1 draft layout is incomplete");
setOv1ProjectScope("project-a");
saveOv1Model({ ...createOv1Model(), concept: { mission: "A" } });
setOv1ProjectScope("project-b");
assert(!hasPersistedOv1Model() && loadOv1Model().concept.mission !== "A", "OV-1 browser-local state must not cross project boundaries");
saveOv1Model({ ...createOv1Model(), concept: { mission: "B" } });
setOv1ProjectScope("project-a");
assert(loadOv1Model().concept.mission === "A", "Project-scoped OV-1 browser-local state was not retained");
setOv1ProjectScope("default");

const ov5 = loadOv5Model();
assert(ov5.activities.length >= 4, "OV-5 seed model is incomplete");
const updated = updateActivity(ov5, ov5.activities[0].id, { input: "Validated multi-source input", resources: "Research capacity 3", preconditions: "Evidence reviewed", constraints: "Within study window", parentId: ov5.activities[1].id });
const detailedEdge = addEdge(ov5, ov5.activities[1].id, ov5.activities[3].id, "资源流", { payload: "Research package", condition: "Review completed" });
assert(updated?.input === "Validated multi-source input" && updated.resources === "Research capacity 3" && updated.preconditions === "Evidence reviewed" && updated.constraints === "Within study window" && updated.parentId === ov5.activities[1].id && detailedEdge?.payload === "Research package" && detailedEdge.condition === "Review completed", "OV-5 structured activity or edge fields were not persisted");
const hierarchyProbe = structuredClone(ov5);
updateActivity(hierarchyProbe, hierarchyProbe.activities[1].id, { parentId: hierarchyProbe.activities[0].id });
assert(hierarchyProbe.activities[1].parentId === "" && !getAssignableParentActivities(ov5, ov5.activities[1].id).some((activity) => activity.id === ov5.activities[0].id), "OV-5 activity hierarchy allowed a parent cycle");

const ooda = deriveOodaFromOv5(ov5);
assert(ooda.lanes.length === 4, "OODA lanes were not derived");
assert(getOodaDuration(ooda) > 0, "OODA duration is not computable");

let scenario = generateScenario(ov5, ooda);
assert(scenario.entities.length === 5 && scenario.timeline.length === 5 && scenario.deploymentPlan?.placements.length === scenario.entities.length && scenario.deploymentPlan.diagnostics.length === 3, "Scenario generation or abstract deployment planning is incomplete");
const traceability = buildTraceability({ ov1, ov5, ooda, scenario });
const ov1Targets = getTraceTargets({ kind: "ov1", id: "sense" }, { ov1, ov5, ooda, scenario });
assert(traceability.summary.mappedActivityCount >= 1 && traceability.activities.some((item) => item.sourceOv1Nodes.length && item.linkedOodaNodes.length) && ov1Targets.some((item) => item.kind === "activity"), "Cross-view traceability is incomplete");
scenario = applyDeploymentChanges(scenario, [{ entityId: "entity-sensor", position: [-10, 120] }]);
const adjustedSensor = scenario.entities.find((entity) => entity.id === "entity-sensor");
assert(adjustedSensor?.position.join(",") === "0,100" && scenario.deploymentPlan?.state === "review", "Deployment feedback was not clamped or did not mark the plan for review");
scenario = recommendScenarioDeployment(scenario);
assert(scenario.deploymentPlan?.state === "suggested" && scenario.deploymentPlan.adjustedEntityIds.length, "Deployment recommendation was not regenerated");

const validation = generateValidation(ov5, ooda, scenario, ov1);
assert(validation.scores.length === 8 && validation.oodaDiagnostics?.checks.length === 6 && validation.flowDiagnostics?.checks.length === 3 && validation.traceabilityDiagnostics?.mappedActivityCount >= 1 && validation.inputSignature, "Validation result is incomplete");
const evidenceTerms = unique(ov5.activities.flatMap((activity) => activity.refs || []));
const evidence = evidenceTerms.map((term, index) => ({
  id: `evidence-${index + 1}`,
  title: term,
  filePath: `vault/${index + 1}.md`,
  summary: `Evidence for ${term}`,
  matchReasons: [term]
}));
applyRedTeamReview(validation, {
  ...createLocalRedTeamReview(validation, evidence),
  evidenceSelection: { source: "server", indexMode: "keyword", count: evidence.length, projectRevision: 8, resourceRevision: 1, selectedAt: "2026-07-12T00:00:00.000Z" }
});
assert(validation.redTeamReview?.mode === "fallback" && validation.redTeamReview.findings.length && validation.redTeamReview.evidenceSelection?.source === "server", "Local red-team review or evidence provenance was not persisted");

const knowledge = {
  summary: { name: "Workflow acceptance vault", fileCount: evidence.length, chunkCount: evidence.length, importedAt: "2026-07-11T00:00:00.000Z" },
  docs: evidence.map((item) => ({ ...item, tags: [], links: [], text: item.summary }))
};
const localEvidenceSelection = await selectEvidenceForAi({ query: "Evidence", knowledge, knowledgeStorage: { mode: "local" }, limit: 3 });
assert(localEvidenceSelection.items.length && localEvidenceSelection.provenance.source === "local" && !localEvidenceSelection.provenance.fallback, "Local evidence selection fallback is incomplete");
const originalFetch = globalThis.fetch;
let remoteEvidenceSelection;
try {
  globalThis.fetch = async (url) => {
    assert(String(url).includes("/api/projects/default/knowledge/search"), "Evidence selection did not call the project knowledge endpoint");
    return new Response(JSON.stringify({
      revision: 8,
      resourceRevision: 2,
      index: { mode: "keyword" },
      results: [{ id: "remote-evidence", title: "Server evidence", filePath: "vault/server.md", summary: "Indexed server evidence", matchReasons: ["title:Evidence"] }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  remoteEvidenceSelection = await selectEvidenceForAi({ query: "Evidence", knowledge, knowledgeStorage: { mode: "server" }, limit: 3 });
} finally {
  globalThis.fetch = originalFetch;
}
assert(remoteEvidenceSelection.items[0]?.id === "remote-evidence" && remoteEvidenceSelection.provenance.source === "server" && remoteEvidenceSelection.provenance.resourceRevision === 2, "Server evidence selection contract is incomplete");
ov5.provenance = { mode: "ai", evidenceCount: evidence.length, evidenceSelection: { source: "server", indexMode: "keyword", query: "Evidence", count: evidence.length, projectRevision: 8, resourceRevision: 1, selectedAt: "2026-07-12T00:00:00.000Z" } };
ooda.provenance = { mode: "ai", evidenceSelection: { source: "server", indexMode: "keyword", query: "Evidence", count: evidence.length, projectRevision: 8, resourceRevision: 1, selectedAt: "2026-07-12T00:00:00.000Z" } };
const deployment = { settings: { targetUrl: "http://127.0.0.1:8765/" }, open: true, status: "已推送" };
const projectRepository = {
  projectRevision: 8,
  brief: { status: "ready", mode: "server", detail: "Synchronized brief.", revision: 4, resourceRevision: 1, auditCount: 8 },
  ov1: { status: "ready", mode: "server", detail: "Synchronized current model.", revision: 5, resourceRevision: 1, auditCount: 8, briefRevision: 4 },
  ov5: { status: "ready", mode: "server", detail: "Synchronized current model.", revision: 5, resourceRevision: 2, auditCount: 8, briefRevision: 4 },
  ooda: { status: "ready", mode: "server", detail: "Synchronized current model.", revision: 6, resourceRevision: 1, auditCount: 8, ov5Revision: 2 },
  scenario: { status: "ready", mode: "server", detail: "Synchronized current model.", revision: 7, resourceRevision: 1, auditCount: 8, oodaRevision: 1 },
  validation: { status: "stale", mode: "local", detail: "Upstream model changed.", revision: 8, resourceRevision: 1, auditCount: 8, ov1Revision: 1, scenarioRevision: 1, stale: true },
  knowledge: { status: "ready", mode: "server", detail: "Keyword index synchronized.", revision: 8, resourceRevision: 1, auditCount: 8 },
  reportArchives: { status: "ready", mode: "server", detail: "2 item(s) synchronized from the server.", revision: 8, resourceRevision: 2, auditCount: 8, validationRevision: 1 },
  modelSnapshots: { status: "ready", mode: "server", detail: "2 item(s) synchronized from the server.", revision: 8, resourceRevision: 2, auditCount: 8, validationRevision: 1 }
};
const payload = buildReportPayload({ project, direction: "Workflow acceptance", ov5, ooda, scenario, validationResult: validation, knowledge, deployment, projectRepository });
assert(payload.ov1.nodes.length && payload.knowledge.evidence.entries.length && payload.knowledge.graph?.nodeCount === evidence.length && payload.traceability.summary.mappedActivityCount >= 1 && payload.ov5.activities[0].resources === "Research capacity 3" && payload.ov5.edges.some((edge) => edge.payload === "Research package" && edge.condition === "Review completed"), "Report payload lost OV-1, knowledge evidence, traceability, or structured OV-5 fields");
const structuredOv5Xml = buildExportArtifactFromPayload("xml", payload).content;
assert(structuredOv5Xml.includes("<resources>Research capacity 3</resources>") && structuredOv5Xml.includes("<preconditions>Evidence reviewed</preconditions>") && structuredOv5Xml.includes("<constraints>Within study window</constraints>") && structuredOv5Xml.includes("<payload>Research package</payload>") && structuredOv5Xml.includes("<condition>Review completed</condition>"), "XML export lost structured OV-5 fields");
assert(payload.deploymentBridge.synchronized && payload.validation.redTeamReview, "Report payload lost bridge or red-team state");
const geojson = payload.scenario?.deploymentData?.geojson;
assert(geojson?.type === "FeatureCollection" && geojson.properties.coordinateReference === "abstract-percent-grid" && geojson.properties.deploymentPlan?.mode === "role-area-layout-v1" && geojson.features.filter((feature) => feature.geometry.type === "Point").length === scenario.entities.length && geojson.features.some((feature) => feature.geometry.type === "Polygon"), "Scenario GeoJSON or deployment-plan artifact is incomplete");
assert(payload.projectRepository.projectRevision === 8 && payload.projectRepository.staleCount === 1 && payload.projectRepository.resources.length === 9 && payload.projectRepository.resources.some((resource) => resource.id === "ov1" && resource.mode === "server") && payload.projectRepository.resources.some((resource) => resource.id === "validation" && resource.ov1Revision === 1), "Report payload lost OV-1 project-model lineage");
const obsidianArchive = buildObsidianArchive(payload);
const obsidianArchiveFiles = obsidianArchive.files.map((item) => item.fileName);
assert(obsidianArchive.filename.endsWith(".md") && obsidianArchive.content.includes("type: 作战概念研究归档") && obsidianArchive.content.includes("## OV-1 总体概念") && obsidianArchiveFiles.includes("ConceptBrief.md") && obsidianArchiveFiles.some((name) => name.startsWith("OV5-")) && obsidianArchiveFiles.some((name) => name.startsWith("OODA-")) && obsidianArchiveFiles.includes("知识来源反向链接.md"), `Obsidian archive set is incomplete: ${obsidianArchiveFiles.join(", ")}`);
const archiveRecord = saveObsidianArchiveRecord({ fileName: obsidianArchive.filename, directoryName: "Research Vault", archivedAt: "2026-07-11T00:00:00.000Z" });
assert(archiveRecord?.directoryName === "Research Vault" && loadObsidianArchiveRecord()?.fileName === obsidianArchive.filename, "Obsidian archive record was not persisted");

const versions = saveReportVersion(payload);
assert(loadReportVersions().length === 1 && versions[0].payload.reportVersion.label === "R001", "Report snapshot was not persisted");
const synchronizedVersions = upsertReportVersion({
  ...versions[0],
  label: "R042",
  payload: {
    ...versions[0].payload,
    reportVersion: { ...versions[0].payload.reportVersion, label: "R042", projectRevision: 8 }
  }
}, versions);
assert(synchronizedVersions.length === 1 && synchronizedVersions[0].label === "R042" && synchronizedVersions[0].payload.reportVersion.projectRevision === 8, "Server report archive did not replace the local immutable version");
for (const type of ["markdown", "json", "xml", "rtf", "map", "geojson"]) {
  const artifact = buildExportArtifactFromPayload(type, versions[0].payload);
  assert(artifact.content.length > 100 && artifact.filename.includes("r001") && (type !== "geojson" || artifact.filename.endsWith(".geojson")), `${type} report artifact is incomplete`);
}
const lineageMarkdown = buildExportArtifactFromPayload("markdown", payload).content;
const lineageXml = buildExportArtifactFromPayload("xml", payload).content;
assert(lineageMarkdown.includes("## 项目模型版本") && lineageMarkdown.includes("OV-1 总体概念") && lineageMarkdown.includes("## 跨视图追溯") && lineageMarkdown.includes("OV-5 交换与资源诊断") && lineageMarkdown.includes("知识关系图：") && lineageMarkdown.includes("证据选择：服务端项目知识库") && lineageMarkdown.includes("空间输出：GeoJSON") && lineageXml.includes("<projectRepository projectRevision=\"8\"") && lineageXml.includes("id=\"ov1\"") && lineageXml.includes("ov1Revision=\"1\"") && lineageXml.includes("<knowledgeGraph nodeCount=\"") && lineageXml.includes("evidenceSource=\"server\"") && lineageXml.includes("<spatialData format=\"geojson\"") && lineageXml.includes("<traceability ") && lineageXml.includes("<flowDiagnostics "), "Report exports lost OV-1 lineage, knowledge graph, traceability, evidence provenance, flow diagnostics, or GeoJSON summary");

const modelSnapshots = saveModelSnapshot({ project, direction: "Workflow acceptance", brief: project.brief, ov1: payload.ov1, ov5, ooda, scenario, validationResult: validation });
const changedOv5 = structuredClone(ov5);
changedOv5.activities[0].title = "Updated activity";
const revisedBrief = { ...project.brief, approach: "Revised comparison approach" };
const nextModelSnapshots = saveModelSnapshot({ project, direction: "Workflow acceptance", brief: revisedBrief, ov1: payload.ov1, ov5: changedOv5, ooda, scenario, validationResult: validation }, modelSnapshots);
const comparison = compareModelSnapshots(nextModelSnapshots[1], nextModelSnapshots[0]);
assert(loadModelSnapshots().length === 2 && comparison?.changes.some((item) => (item.label === "作战活动" || item.label === "OV-5 活动") && item.changed.length === 1) && comparison?.changes.some((item) => item.label === "概念简报" && item.changed.includes("核心思路")), "Model comparison was not persisted");
const synchronizedSnapshots = upsertModelSnapshot({ ...nextModelSnapshots[0], label: "M042", lineage: { validationRevision: 1 } }, nextModelSnapshots);
assert(synchronizedSnapshots[0].label === "M042" && synchronizedSnapshots[0].lineage.validationRevision === 1, "Server model snapshot did not replace the local snapshot");
const restored = restoreModelSnapshot(nextModelSnapshots[1], { briefSeed: project.brief });
assert(restored.ov5.activities[0].title === ov5.activities[0].title && restored.validationResult?.id === validation.id, "Model snapshot restore was incomplete");
const comparisonPayload = buildReportPayload({ project, direction: "Workflow acceptance", ov5, ooda, scenario, validationResult: validation, knowledge, deployment, modelSnapshots: nextModelSnapshots, modelComparison: comparison });
assert(comparisonPayload.modelGovernance.snapshotCount === 2 && comparisonPayload.modelGovernance.comparison?.summary === comparison.summary, "Report payload lost model governance");
const governanceMarkdown = buildExportArtifactFromPayload("markdown", comparisonPayload).content;
const governanceXml = buildExportArtifactFromPayload("xml", comparisonPayload).content;
assert(governanceMarkdown.includes("## 版本治理") && governanceXml.includes("<modelGovernance snapshotCount=\"2\">") && governanceXml.includes("<comparison baselineId="), "Report exports lost model governance");
for (const type of ["markdown", "json"]) {
  const artifact = buildModelComparisonArtifact(type, comparison);
  assert(artifact.content.length > 100 && artifact.filename.includes("model-comparison"), `${type} model comparison artifact is incomplete`);
}

console.log(`Workflow acceptance passed: ${ov5.activities.length} activities, ${ooda.lanes.flatMap((lane) => lane.nodes).length} OODA nodes, ${scenario.entities.length} scenario entities, ${validation.scores.length} validation scores, ${evidence.length} evidence entries.`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function unique(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}
