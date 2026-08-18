import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileProjectRepository } from "../server/projectRepository.mjs";
import { workflowStageByResource, workflowStageForResource } from "../shared/workflowConfirmation.js";
import { buildArchitectureExchangePackage } from "../shared/dodaf/exchange.js";
import { normalizeOv2, normalizeOv5 } from "../server/projectModelNormalizers.mjs";

const directory = await mkdtemp(join(tmpdir(), "combat-concept-workflow-confirmation-"));
const repository = createFileProjectRepository({
  filePath: join(directory, "projects.json"),
  now: () => "2026-07-24T00:00:00.000Z"
});

const ov5 = normalizeOv5({
  activities: [
    { id: "sense", title: "Sense", type: "sense", text: "Collect reviewable inputs." },
    { id: "decide", title: "Decide", type: "decide", text: "Select a response." }
  ],
  edges: [{ id: "sense-decide", sourceId: "sense", targetId: "decide", type: "information" }]
});
const ov2 = normalizeOv2({
  nodes: [{ id: "sense", label: "Sense" }, { id: "decide", label: "Decide" }],
  exchanges: [{ id: "sense-decide", sourceNodeId: "sense", targetNodeId: "decide", label: "Situation update", flowType: "information" }]
});
const scenario = {
  id: "workflow-scenario",
  entities: [{ id: "sensor", label: "Sensor", role: "observation", position: [20, 30] }],
  timeline: [{ id: "observe", time: "T+00", title: "Observe", description: "Collect the initial situation." }]
};
const validation = { id: "workflow-validation", scores: [{ label: "Completeness", score: 80 }], issues: [], redTeam: "Review the assumption." };
const conceptMap = {
  context: "Reviewed research-level relationship context.",
  document: { version: 3, items: [{ id: "map-symbol", type: "symbol", layer: "Observation", lon: 120, lat: 30 }] }
};

try {
  assertStageMap();

  await repository.createProject({ id: "legacy-progress", title: "Legacy progress" });
  await repository.updateProject("legacy-progress", { workflow: { mode: "gated", completedThrough: 2 } });
  const migratedProjects = await repository.listProjects({ includeArchived: true });
  const migratedWorkflow = migratedProjects.projects.find((project) => project.id === "legacy-progress")?.workflow;
  assert(migratedWorkflow?.version === 2 && migratedWorkflow.completedThrough === 3, "Legacy stage 2 must persist as version-2 combat-force completion");

  await repository.createProject({ id: "brief-ai", title: "Brief AI" });
  const initialBrief = await repository.saveBrief("brief-ai", { source: "manual", direction: "Research", brief: brief("Baseline objective") });
  await confirmThrough("brief-ai", 6);
  await repository.saveBrief("brief-ai", { source: "manual", direction: "Research", brief: initialBrief.brief });
  await assertCompletedThrough("brief-ai", 6, "An unchanged brief save must preserve confirmation");
  await repository.saveBrief("brief-ai", { source: "ai", direction: "Research", brief: brief("AI revised objective") });
  await assertCompletedThrough("brief-ai", -1, "An AI brief revision must revoke the current and later confirmations");

  await repository.createProject({ id: "concept-map-ai", title: "Concept map AI" });
  await confirmThrough("concept-map-ai", 6);
  await repository.saveConceptMap("concept-map-ai", { source: "concept-map:iframe-save", model: conceptMap });
  await assertCompletedThrough("concept-map-ai", 4, "A concept-map revision must require stage-5 reconfirmation");

  await repository.createProject({ id: "model-ai", title: "Model AI" });
  await confirmThrough("model-ai", 6);
  await repository.saveOv5("model-ai", { source: "ai", model: ov5 });
  await assertCompletedThrough("model-ai", 5, "An activity-model revision must require simulation reconfirmation");

  await repository.createProject({ id: "review-ov2", title: "Review OV-2" });
  await confirmThrough("review-ov2", 6);
  await repository.saveOv2("review-ov2", { source: "manual", model: ov2 });
  await assertCompletedThrough("review-ov2", 5, "A resource-flow revision must require simulation reconfirmation");

  await repository.createProject({ id: "review-import", title: "Review import" });
  await confirmThrough("review-import", 6);
  await repository.importArchitecture("review-import", {
    source: "ai-import",
    package: buildArchitectureExchangePackage({ projectId: "review-import", title: "Review import", products: { ov2 } }),
    format: "json",
    mergeStrategy: "replace-products"
  });
  await assertCompletedThrough("review-import", 5, "An architecture import with associated models must require simulation reconfirmation");

  await repository.createProject({ id: "scenario-ai", title: "Scenario AI" });
  await confirmThrough("scenario-ai", 6);
  await repository.saveScenario("scenario-ai", { source: "generated", model: scenario });
  await assertCompletedThrough("scenario-ai", 5, "A generated scenario must require simulation reconfirmation");

  await repository.createProject({ id: "validation-ai", title: "Validation AI" });
  await confirmThrough("validation-ai", 6);
  await repository.saveValidation("validation-ai", { source: "ai", model: validation });
  await assertCompletedThrough("validation-ai", 5, "An AI validation revision must require simulation reconfirmation");

  await repository.createProject({ id: "report-change", title: "Report change" });
  await confirmThrough("report-change", 6);
  await repository.createReportArchive("report-change", { source: "generated", item: report("report-1") });
  await assertCompletedThrough("report-change", 6, "A report archive must not revoke mainline confirmation");

  await repository.createProject({ id: "collaboration-change", title: "Collaboration change" });
  const collaborationBrief = await repository.saveBrief("collaboration-change", { source: "manual", direction: "Review", brief: brief("Reviewable objective") });
  await confirmThrough("collaboration-change", 6);
  const review = await repository.createCollaborationReview("collaboration-change", {
    clientId: "review-workflow-confirmation",
    actorId: "local-researcher",
    resource: "brief",
    resourceRevision: collaborationBrief.resourceRevision,
    disposition: "comment",
    summary: "Record a review event.",
    expectedRevision: collaborationBrief.revision
  });
  await assertCompletedThrough("collaboration-change", 6, "A collaboration review must not revoke mainline confirmation");
  await confirmThrough("collaboration-change", 6);
  await repository.resolveCollaborationReview("collaboration-change", review.review.id, {
    actorId: "local-lead",
    outcome: "accepted",
    summary: "Review accepted.",
    expectedRevision: review.revision
  });
  await assertCompletedThrough("collaboration-change", 6, "A collaboration decision must not revoke mainline confirmation");

  await assertSqlitePersistence();

  console.log("Workflow confirmation invalidation acceptance passed: changed manual and AI/generated resources revoke their stage and all later confirmations.");
} finally {
  repository.close?.();
  await rm(directory, { recursive: true, force: true });
}

function brief(objective) {
  return {
    researchIntent: "Verify the confirmation workflow.",
    objective,
    approach: "Persist a reviewable change.",
    assumptions: "The project has a confirmation record.",
    expectedEffects: "The next confirmation is required.",
    risk: "A stale confirmation could be reused."
  };
}

function report(id) {
  return {
    id,
    title: "Workflow confirmation report",
    scenarioId: "workflow-scenario",
    maturity: { label: "Reviewable", readyCount: 1, totalCount: 1 },
    payload: {
      generatedAt: "2026-07-24T00:00:00.000Z",
      project: { title: "Workflow confirmation report", direction: "Research", brief: brief("Report objective") },
      scenario: { id: "workflow-scenario" },
      validationMaturity: { label: "Reviewable", readyCount: 1, totalCount: 1 }
    }
  };
}

async function confirmThrough(projectId, completedThrough) {
  await repository.updateProject(projectId, { workflow: { version: 2, mode: "gated", completedThrough } });
}

async function assertCompletedThrough(projectId, expected, message) {
  const projects = await repository.listProjects({ includeArchived: true });
  const workflow = projects.projects.find((project) => project.id === projectId)?.workflow;
  assert(workflow?.mode === "gated" && workflow?.completedThrough === expected, message);
}

async function assertSqlitePersistence() {
  const databasePath = join(directory, "projects.sqlite");
  let sqliteRepository = createFileProjectRepository({ filePath: join(directory, "sqlite-fallback.json"), databasePath });
  try {
    await sqliteRepository.createProject({ id: "sqlite-ai", title: "SQLite AI" });
    const saved = await sqliteRepository.saveBrief("sqlite-ai", { source: "manual", direction: "Research", brief: brief("SQLite baseline") });
    await sqliteRepository.updateProject("sqlite-ai", { workflow: { version: 2, mode: "gated", completedThrough: 6 } });
    await sqliteRepository.saveBrief("sqlite-ai", { source: "ai", direction: "Research", brief: brief("SQLite AI revision") });
  } finally {
    sqliteRepository.close?.();
  }

  sqliteRepository = createFileProjectRepository({ filePath: join(directory, "sqlite-fallback.json"), databasePath });
  try {
    const projects = await sqliteRepository.listProjects({ includeArchived: true });
    const workflow = projects.projects.find((project) => project.id === "sqlite-ai")?.workflow;
    assert(workflow?.completedThrough === -1 && workflow.mode === "gated", "SQLite did not persist AI-triggered workflow reconfirmation");
  } finally {
    sqliteRepository.close?.();
  }
}

function assertStageMap() {
  const expected = {
    brief: 0,
    knowledge: 0,
    phaseActionConcept: 1,
    forceMissionPlan: 2,
    conceptGraphicPlan: 4,
    ov1: 4,
    conceptMap: 5,
    ov6a: 6,
    ov6b: 6,
    ov6c: 6,
    ov1c: 6,
    ov7: 6,
    ov4: 6,
    ov2: 6,
    ov3: 6,
    ov5: 6,
    ov5a: 6,
    ooda: 6,
    architecture: 6,
    scenario: 6,
    validation: 6
  };
  assert(JSON.stringify(workflowStageByResource) === JSON.stringify(expected), "Workflow resource-to-stage mapping is incomplete");
  for (const [resource, stage] of Object.entries(expected)) {
    assert(workflowStageForResource(resource) === stage, `Workflow stage lookup failed for ${resource}`);
  }
  assert(workflowStageForResource("forceMissionPlan", "operational-task:edit") === 2, "Task edits must invalidate task confirmation");
  assert(workflowStageForResource("forceMissionPlan", "force-mission:edit") === 3, "Force edits must preserve confirmed tasks and invalidate force confirmation");
  assert(workflowStageForResource("collaboration") === null && workflowStageForResource("reportArchives") === null, "Non-mainline delivery resources must not revoke mainline confirmation");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
