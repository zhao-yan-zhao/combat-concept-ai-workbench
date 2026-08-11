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

  await repository.createProject({ id: "brief-ai", title: "Brief AI" });
  const initialBrief = await repository.saveBrief("brief-ai", { source: "manual", direction: "Research", brief: brief("Baseline objective") });
  await confirmThrough("brief-ai", 4);
  await repository.saveBrief("brief-ai", { source: "manual", direction: "Research", brief: initialBrief.brief });
  await assertCompletedThrough("brief-ai", 4, "An unchanged brief save must preserve confirmation");
  await repository.saveBrief("brief-ai", { source: "ai", direction: "Research", brief: brief("AI revised objective") });
  await assertCompletedThrough("brief-ai", -1, "An AI brief revision must revoke the current and later confirmations");

  await repository.createProject({ id: "concept-map-ai", title: "Concept map AI" });
  await confirmThrough("concept-map-ai", 4);
  await repository.saveConceptMap("concept-map-ai", { source: "concept-map:iframe-save", model: conceptMap });
  await assertCompletedThrough("concept-map-ai", 2, "A concept-map revision must require concept-stage reconfirmation");

  await repository.createProject({ id: "model-ai", title: "Model AI" });
  await confirmThrough("model-ai", 4);
  await repository.saveOv5("model-ai", { source: "ai", model: ov5 });
  await assertCompletedThrough("model-ai", 2, "An activity-model revision must require concept-stage reconfirmation");

  await repository.createProject({ id: "review-ov2", title: "Review OV-2" });
  await confirmThrough("review-ov2", 4);
  await repository.saveOv2("review-ov2", { source: "manual", model: ov2 });
  await assertCompletedThrough("review-ov2", 1, "A resource-flow revision must require force-stage reconfirmation");

  await repository.createProject({ id: "review-import", title: "Review import" });
  await confirmThrough("review-import", 4);
  await repository.importArchitecture("review-import", {
    source: "ai-import",
    package: buildArchitectureExchangePackage({ projectId: "review-import", title: "Review import", products: { ov2 } }),
    format: "json",
    mergeStrategy: "replace-products"
  });
  await assertCompletedThrough("review-import", 1, "An architecture import with force products must require force-stage reconfirmation");

  await repository.createProject({ id: "scenario-ai", title: "Scenario AI" });
  await confirmThrough("scenario-ai", 4);
  await repository.saveScenario("scenario-ai", { source: "generated", model: scenario });
  await assertCompletedThrough("scenario-ai", 3, "A generated scenario must require delivery-stage reconfirmation");

  await repository.createProject({ id: "validation-ai", title: "Validation AI" });
  await confirmThrough("validation-ai", 4);
  await repository.saveValidation("validation-ai", { source: "ai", model: validation });
  await assertCompletedThrough("validation-ai", 3, "An AI validation revision must require delivery-stage reconfirmation");

  await repository.createProject({ id: "report-change", title: "Report change" });
  await confirmThrough("report-change", 4);
  await repository.createReportArchive("report-change", { source: "generated", item: report("report-1") });
  await assertCompletedThrough("report-change", 3, "A generated report archive must require delivery-stage reconfirmation");

  await repository.createProject({ id: "collaboration-change", title: "Collaboration change" });
  const collaborationBrief = await repository.saveBrief("collaboration-change", { source: "manual", direction: "Review", brief: brief("Reviewable objective") });
  await confirmThrough("collaboration-change", 4);
  const review = await repository.createCollaborationReview("collaboration-change", {
    clientId: "review-workflow-confirmation",
    actorId: "local-researcher",
    resource: "brief",
    resourceRevision: collaborationBrief.resourceRevision,
    disposition: "comment",
    summary: "Record a review event.",
    expectedRevision: collaborationBrief.revision
  });
  await assertCompletedThrough("collaboration-change", 3, "A collaboration review must require delivery-stage reconfirmation");
  await confirmThrough("collaboration-change", 4);
  await repository.resolveCollaborationReview("collaboration-change", review.review.id, {
    actorId: "local-lead",
    outcome: "accepted",
    summary: "Review accepted.",
    expectedRevision: review.revision
  });
  await assertCompletedThrough("collaboration-change", 3, "A collaboration decision must require delivery-stage reconfirmation");

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
  await repository.updateProject(projectId, { workflow: { mode: "gated", completedThrough } });
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
    await sqliteRepository.updateProject("sqlite-ai", { workflow: { mode: "gated", completedThrough: 4 } });
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
    ov6a: 1,
    ov6b: 1,
    ov6c: 1,
    forceMissionPlan: 2,
    ov4: 2,
    ov2: 2,
    ov3: 2,
    conceptMap: 3,
    conceptGraphicPlan: 3,
    ov1: 3,
    ov5: 3,
    ov5a: 3,
    ooda: 3,
    architecture: 3,
    scenario: 4,
    validation: 4,
    collaboration: 4,
    reportArchives: 4
  };
  assert(JSON.stringify(workflowStageByResource) === JSON.stringify(expected), "Workflow resource-to-stage mapping is incomplete");
  for (const [resource, stage] of Object.entries(expected)) {
    assert(workflowStageForResource(resource) === stage, `Workflow stage lookup failed for ${resource}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
