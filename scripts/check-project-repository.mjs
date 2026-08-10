import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileProjectRepository } from "../server/projectRepository.mjs";

const directory = await mkdtemp(join(tmpdir(), "combat-concept-project-repository-"));
const filePath = join(directory, "projects.json");
let tick = 0;
const repository = createFileProjectRepository({
  filePath,
  now: () => `2026-07-11T00:00:0${++tick}.000Z`
});

try {
  const initial = await repository.getBrief("default");
  assert(!initial.exists && initial.revision === 0, "Empty repository did not return an uninitialized project");

  const first = await repository.saveBrief("default", {
    direction: "稳控塑势",
    source: "manual",
    brief: {
      objective: "建立持续态势优势",
      approach: "先感知，再协同决策",
      assumptions: "链路稳定",
      risk: "对手信息欺骗"
    }
  });
  assert(first.revision === 1 && first.auditCount === 1 && first.brief.objective === "建立持续态势优势", "First brief revision was not persisted");

  const unchanged = await repository.saveBrief("default", { direction: first.direction, source: "manual", brief: first.brief });
  assert(unchanged.revision === 1 && unchanged.auditCount === 1, "Unchanged brief should not create an audit revision");

  const second = await repository.saveBrief("default", {
    direction: "体系压制",
    source: "ai",
    brief: { ...first.brief, risk: "对手信息欺骗与资源连续性" }
  });
  assert(second.revision === 2 && second.auditCount === 2 && second.direction === "体系压制", "Changed brief revision was not persisted");
  let briefConflict = null;
  try {
    await repository.saveBrief("default", { direction: "稳控塑势", source: "manual", brief: first.brief, expectedRevision: 1 });
  } catch (error) {
    briefConflict = error;
  }
  assert(briefConflict?.statusCode === 409, "Stale concept brief write should report a revision conflict");

  const ov5 = {
    version: 1,
    activities: [
      { id: "sense", type: "感知", title: "态势确认", text: "确认态势输入", input: "任务区", output: "态势线索", duration: "持续", refs: ["案例 A"] },
      { id: "decide", type: "决策", title: "协同判定", text: "形成研究级判定", input: "态势线索", output: "协同行动指令", duration: "5 分钟", refs: [] }
    ],
    edges: [{ id: "edge-sense-decide", sourceId: "sense", targetId: "decide", type: "信息流" }],
    provenance: {
      mode: "ai",
      generatedAt: "2026-07-11T00:00:00.000Z",
      evidenceCount: 1,
      evidenceSelection: { source: "server", indexMode: "keyword", query: "sensor", count: 1, projectRevision: 2, resourceRevision: 1, selectedAt: "2026-07-12T00:00:00.000Z" }
    }
  };
  ov5.activities[0].resources = "sensor capacity";
  ov5.activities[0].preconditions = "evidence ready";
  ov5.activities[0].constraints = "study window";
  ov5.activities[0].parentId = "decide";
  ov5.activities[1].parentId = "sense";
  ov5.edges[0].payload = "situation cue";
  ov5.edges[0].condition = "evidence checked";
  const savedOv5 = await repository.saveOv5("default", { model: ov5, source: "ai" });
  assert(savedOv5.revision === 3 && savedOv5.resourceRevision === 1 && savedOv5.briefRevision === 2 && savedOv5.model.activities.length === 2 && savedOv5.model.provenance.evidenceSelection?.source === "server", "OV-5 revision or evidence provenance was not persisted");
  assert(savedOv5.model.activities[0].resources === "sensor capacity" && savedOv5.model.activities[0].preconditions === "evidence ready" && savedOv5.model.activities[0].constraints === "study window" && savedOv5.model.activities[0].parentId === "" && savedOv5.model.activities[1].parentId === "sense" && savedOv5.model.edges[0].payload === "situation cue" && savedOv5.model.edges[0].condition === "evidence checked", "OV-5 structured fields or parent-cycle normalization were not persisted");
  const unchangedOv5 = await repository.saveOv5("default", { model: ov5, source: "manual" });
  assert(unchangedOv5.revision === 3 && unchangedOv5.resourceRevision === 1, "Unchanged OV-5 should not create a revision");
  const ooda = {
    version: 1,
    sourceActivityIds: ["sense", "decide"],
    lanes: [
      { id: "observe", title: "Observe", subtitle: "Observe", color: "#2277aa", nodes: [{ id: "ooda-observe", sourceActivityId: "sense", title: "Observe", text: "Collect cues", duration: "2 minutes", input: "Area", output: "Cue", rule: "Confirm source" }] },
      { id: "decide", title: "Decide", subtitle: "Decide", color: "#aa7722", nodes: [{ id: "ooda-decide", sourceActivityId: "decide", title: "Decide", text: "Select option", duration: "3 minutes", input: "Cue", output: "Decision", rule: "Review constraint" }] }
    ],
    provenance: { mode: "derived", generatedAt: "2026-07-11T00:00:00.000Z", evidenceCount: 0 }
  };
  const savedOoda = await repository.saveOoda("default", { model: ooda, source: "derived", expectedRevision: 3 });
  assert(savedOoda.revision === 4 && savedOoda.resourceRevision === 1 && savedOoda.ov5Revision === 1 && !savedOoda.stale, "OODA revision or OV-5 lineage was not persisted");

  const scenario = {
    version: 1,
    id: "scenario-test",
    generatedAt: "2026-07-11T00:00:00.000Z",
    source: { activityIds: ["sense", "decide"], oodaNodeIds: ["ooda-observe", "ooda-decide"] },
    entities: [{ id: "sensor", label: "Sensor", role: "sensor", position: [20, 30], sourceActivityId: "sense", sourceOodaIds: ["ooda-observe"] }],
    areas: [{ id: "coverage", label: "Coverage", type: "coverage", position: [40, 50], size: 100 }],
    timeline: [{ id: "event-observe", time: "T+00", title: "Observe", description: "Collect cues", sourceNodeId: "ooda-observe" }],
    deploymentPlan: { mode: "role-area-layout-v1", coordinateReference: "abstract-percent-grid", state: "suggested", adjustedEntityIds: ["sensor"], placements: [{ id: "sensor", role: "sensor", position: [20, 30], reason: "Coverage alignment" }], diagnostics: [{ id: "bounds", state: "ready", label: "Bounds", detail: "Inside abstract grid" }] }
  };
  const savedScenario = await repository.saveScenario("default", { model: scenario, source: "generated", expectedRevision: 4 });
  assert(savedScenario.revision === 5 && savedScenario.resourceRevision === 1 && savedScenario.oodaRevision === 1 && savedScenario.model.deploymentPlan?.mode === "role-area-layout-v1" && !savedScenario.stale, "Scenario deployment plan, revision, or OODA lineage was not persisted");

  const validation = {
    version: 1,
    id: "validation-test",
    generatedAt: "2026-07-11T00:00:00.000Z",
    inputSignature: "test-signature",
    oodaDuration: 5,
    scores: [{ label: "Coverage", score: 86 }],
    issues: [{ id: "issue-1", level: "medium", title: "Review source", text: "Confirm the source chain.", sourceId: "sense" }],
    oodaDiagnostics: { windowMinutes: 30, nodeCount: 2, completenessScore: 90, resilienceScore: 75, checks: [{ id: "feedback", label: "Feedback", state: "review", statusLabel: "Review", detail: "Add alternate source." }] },
    redTeam: "Challenge the single source.",
    redTeamReview: { mode: "fallback", summary: "Review source resilience.", evidenceSelection: { source: "server", indexMode: "keyword", query: "source", count: 1, projectRevision: 5, resourceRevision: 1, selectedAt: "2026-07-12T00:00:00.000Z" }, findings: [{ id: "finding-1", severity: "medium", title: "Single source", analysis: "One source may fail.", recommendation: "Add alternate source.", evidenceRefs: ["case-a"] }] }
  };
  const savedValidation = await repository.saveValidation("default", { model: validation, source: "rule-validation", expectedRevision: 5 });
  assert(savedValidation.revision === 6 && savedValidation.resourceRevision === 1 && savedValidation.scenarioRevision === 1 && savedValidation.model.redTeamReview?.evidenceSelection?.source === "server" && !savedValidation.stale, "Validation revision, evidence provenance, or scenario lineage was not persisted");

  const revisedOv5 = await repository.saveOv5("default", {
    model: { ...ov5, activities: [{ ...ov5.activities[0], title: "Updated situation confirmation" }, ov5.activities[1]] },
    source: "manual",
    expectedRevision: 6
  });
  assert(revisedOv5.revision === 7 && revisedOv5.resourceRevision === 2, "Updated OV-5 did not create a new resource revision");
  const staleOoda = await repository.getOoda("default");
  const staleScenario = await repository.getScenario("default");
  const staleValidation = await repository.getValidation("default");
  assert(staleOoda.stale && staleScenario.stale && staleValidation.stale, "Upstream OV-5 change did not mark derived resources stale");
  let conflict = null;
  try {
    await repository.saveScenario("default", {
      model: scenario,
      source: "manual",
      expectedRevision: 6
    });
  } catch (error) {
    conflict = error;
  }
  assert(conflict?.statusCode === 409, "Stale model write should report a revision conflict");

  const audit = await repository.listAudit("default", 10);
  assert(audit.entries.length === 7 && audit.entries[0].action === "ov5.updated" && audit.entries[0].source === "manual" && audit.entries[1].action === "validation.updated" && audit.entries[1].scenarioRevision === 1, "Audit record is incomplete");

  const reportOne = {
    id: "report-version-local-1",
    title: "Repository acceptance report",
    scenarioId: scenario.id,
    maturity: { label: "Reviewable", readyCount: 4, totalCount: 6 },
    payload: {
      generatedAt: "2026-07-11T00:00:00.000Z",
      project: { title: "Repository acceptance report", direction: second.direction, brief: second.brief },
      scenario: { id: scenario.id },
      validationMaturity: { label: "Reviewable", readyCount: 4, totalCount: 6 }
    }
  };
  const savedReportOne = await repository.createReportArchive("default", { item: reportOne, source: "report-archive", expectedRevision: 7 });
  assert(savedReportOne.revision === 8 && savedReportOne.resourceRevision === 1 && savedReportOne.item.label === "R001" && savedReportOne.item.payload.reportVersion.projectRevision === 8 && savedReportOne.item.lineage.validationRevision === 1, "Immutable report archive was not persisted");
  const duplicateReport = await repository.createReportArchive("default", { item: reportOne, source: "report-archive", expectedRevision: 8 });
  assert(duplicateReport.duplicate && duplicateReport.revision === 8 && duplicateReport.items.length === 1, "Report archive idempotency failed");

  const snapshot = {
    id: "model-snapshot-local-1",
    title: "Repository acceptance snapshot",
    direction: second.direction,
    model: {
      brief: second.brief,
      ov1: { nodes: [{ id: "ov1-sense", label: "Sense", description: "Situation sensing", x: "10%", y: "20%" }], edges: [] },
      ov5,
      ooda: { ...ooda, durationMinutes: 5 },
      scenario,
      validation
    }
  };
  const savedSnapshot = await repository.createModelSnapshot("default", { item: snapshot, source: "manual", expectedRevision: 8 });
  assert(savedSnapshot.revision === 9 && savedSnapshot.resourceRevision === 1 && savedSnapshot.item.label === "M001" && savedSnapshot.item.model.ooda.durationMinutes === 5 && savedSnapshot.item.lineage.ov5Revision === 2, "Model snapshot was not persisted with lineage");

  const reportTwo = { ...reportOne, id: "report-version-local-2", payload: { ...reportOne.payload, generatedAt: "2026-07-11T00:01:00.000Z" } };
  const savedReportTwo = await repository.createReportArchive("default", { item: reportTwo, source: "report-archive", expectedRevision: 9 });
  assert(savedReportTwo.revision === 10 && savedReportTwo.items.length === 2 && savedReportTwo.item.label === "R002", "Second report archive was not persisted");
  const deletedReport = await repository.deleteReportArchive("default", reportOne.id, { source: "manual", expectedRevision: 10 });
  assert(deletedReport.revision === 11 && deletedReport.removed && deletedReport.items.length === 1 && deletedReport.items[0].id === reportTwo.id, "Report archive deletion did not preserve the remaining immutable version");

  const reloaded = createFileProjectRepository({ filePath });
  const persisted = await reloaded.getBrief("default");
  const persistedOv5 = await reloaded.getOv5("default");
  const persistedOoda = await reloaded.getOoda("default");
  const persistedScenario = await reloaded.getScenario("default");
  const persistedValidation = await reloaded.getValidation("default");
  const persistedReports = await reloaded.getReportArchives("default");
  const persistedSnapshots = await reloaded.getModelSnapshots("default");
  assert(persisted.revision === 11 && persisted.brief.risk.includes("资源连续性") && persistedOv5.resourceRevision === 2 && persistedOoda.stale && persistedScenario.stale && persistedValidation.stale && persistedReports.items.length === 1 && persistedReports.items[0].label === "R002" && persistedSnapshots.items.length === 1 && persistedSnapshots.items[0].label === "M001", "Repository reload lost persisted project data");
  const raw = JSON.parse(await readFile(filePath, "utf8"));
  assert(raw.version === 1 && raw.projects.default.audit.length === 11 && raw.projects.default.ooda.model.lanes.length === 2 && raw.projects.default.scenario.model.entities.length === 1 && raw.projects.default.validation.model.scores.length === 1 && raw.projects.default.reportArchives.items.length === 1 && raw.projects.default.modelSnapshots.items.length === 1, "Repository file schema is incomplete");
  const savedKnowledge = await reloaded.saveKnowledge("default", {
    model: {
      docs: [{
        id: "vault-sensor-1",
        vaultId: "vault-test",
        vaultName: "Repository test vault",
        filePath: "notes/sensor.md",
        title: "Resilient sensor fusion",
        tags: ["sensor", "fusion"],
        content: "Sensor fusion requires provenance checks and fallback observations.",
        frontmatter: { classification: "internal" }
      }]
    },
    source: "obsidian-import",
    expectedRevision: 11
  });
  assert(savedKnowledge.revision === 12 && savedKnowledge.resourceRevision === 1 && savedKnowledge.model.summary.chunkCount === 1 && savedKnowledge.model.index.mode === "keyword", "Knowledge resource was not persisted");
  const knowledgeSearch = await reloaded.searchKnowledge("default", "sensor", 4);
  const vectorKnowledgeSearch = await reloaded.searchKnowledge("default", "sensor", 4, "vector");
  assert(knowledgeSearch.results.length === 1 && knowledgeSearch.results[0].id === "vault-sensor-1" && knowledgeSearch.index.mode === "hybrid" && vectorKnowledgeSearch.index.mode === "vector" && vectorKnowledgeSearch.index.backend === "local-sparse-vector", "Knowledge retrieval modes did not return ranked project evidence");
  let knowledgeConflict = null;
  try {
    await reloaded.saveKnowledge("default", { model: { docs: [] }, expectedRevision: 11 });
  } catch (error) {
    knowledgeConflict = error;
  }
  assert(knowledgeConflict?.statusCode === 409, "Knowledge resource did not enforce project revision conflicts");
  const persistedKnowledge = await reloaded.getKnowledge("default");
  assert(persistedKnowledge.revision === 12 && persistedKnowledge.model.docs[0].filePath === "notes/sensor.md", "Knowledge resource did not survive reload");
  const ov1ProjectId = "ov1-lineage";
  const ov1Brief = await reloaded.saveBrief(ov1ProjectId, {
    direction: "test",
    source: "manual",
    brief: { objective: "test", approach: "test", assumptions: "test", risk: "test" }
  });
  const initialOv1 = {
    nodes: [{ id: "sense", label: "Sense", detail: "Observe the situation.", x: "10%", y: "20%" }],
    edges: []
  };
  const savedOv1 = await reloaded.saveOv1(ov1ProjectId, { model: initialOv1, source: "manual", expectedRevision: ov1Brief.revision });
  assert(savedOv1.revision === 2 && savedOv1.resourceRevision === 1 && savedOv1.briefRevision === 1 && !savedOv1.stale, "OV-1 resource was not saved with brief lineage");
  const ov1Validation = await reloaded.saveValidation(ov1ProjectId, {
    model: { id: "ov1-validation", scores: [], issues: [], redTeam: "" },
    source: "rule-validation",
    expectedRevision: savedOv1.revision
  });
  assert(ov1Validation.revision === 3 && ov1Validation.ov1Revision === 1 && !ov1Validation.stale, "Validation did not record OV-1 lineage");
  const revisedOv1 = await reloaded.saveOv1(ov1ProjectId, {
    model: { ...initialOv1, nodes: [{ ...initialOv1.nodes[0], detail: "Updated situation observation." }] },
    source: "manual",
    expectedRevision: ov1Validation.revision
  });
  const staleOv1Validation = await reloaded.getValidation(ov1ProjectId);
  assert(revisedOv1.revision === 4 && revisedOv1.resourceRevision === 2 && staleOv1Validation.stale, "OV-1 revision did not mark validation stale");
  console.log(`Project repository acceptance passed: project revision ${persisted.revision}, OV-5 r${persistedOv5.resourceRevision}, OODA r${persistedOoda.resourceRevision}, scenario r${persistedScenario.resourceRevision}, validation r${persistedValidation.resourceRevision}, report archives ${persistedReports.items.length}, model snapshots ${persistedSnapshots.items.length}.`);
} finally {
  await rm(directory, { recursive: true, force: true });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
