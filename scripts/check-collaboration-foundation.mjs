import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileProjectRepository } from "../server/projectRepository.mjs";
import { buildMarkdownReport, buildReportPayload, buildXmlReport } from "../design-studio/src/reportBuilder.js";

const directory = await mkdtemp(join(tmpdir(), "combat-concept-collaboration-"));
let tick = 0;
const repository = createFileProjectRepository({ filePath: join(directory, "projects.json"), now: () => `2026-07-14T00:00:${String(++tick).padStart(2, "0")}.000Z` });

try {
  const brief = await repository.saveBrief("default", {
    direction: "Review",
    source: "manual",
    brief: { objective: "Collaboration", approach: "Review event", assumptions: "Local prototype policy", risk: "Identity not configured" }
  });
  const initial = await repository.getCollaboration("default");
  assert(initial.revision === brief.revision && initial.policy.mode === "local-prototype-policy" && initial.policy.authentication === "not-configured", "Collaboration policy was not exposed as a local prototype policy");

  const created = await repository.createCollaborationReview("default", {
    clientId: "review-local-001",
    actorId: "local-researcher",
    resource: "brief",
    resourceRevision: brief.resourceRevision,
    disposition: "request_changes",
    summary: "Clarify review assumptions before approval.",
    expectedRevision: initial.revision
  });
  assert(created.revision === 2 && created.openCount === 1 && created.review?.actor.id === "local-researcher" && created.review?.lineage.briefRevision === 1 && created.review?.reviewContext?.modelKind === "brief" && created.review.reviewContext.primaryCount >= 4 && created.review.reviewContext.secondaryCount === 0, "Collaboration review was not stored with actor, lineage, and server-derived bounded context");

  const duplicate = await repository.createCollaborationReview("default", {
    clientId: "review-local-001",
    actorId: "local-researcher",
    resource: "brief",
    resourceRevision: brief.resourceRevision,
    disposition: "request_changes",
    summary: "Clarify review assumptions before approval.",
    expectedRevision: created.revision
  });
  assert(duplicate.duplicate && duplicate.revision === created.revision, "Collaboration review idempotency failed");

  let denied = null;
  try {
    await repository.resolveCollaborationReview("default", "review-local-001", { actorId: "local-researcher", outcome: "accepted", summary: "Attempted decision", expectedRevision: created.revision });
  } catch (error) {
    denied = error;
  }
  assert(denied?.statusCode === 403, "Non-lead actor was allowed to resolve a review");

  let resourceConflict = null;
  try {
    await repository.createCollaborationReview("default", { actorId: "local-researcher", resource: "brief", resourceRevision: 0, disposition: "comment", summary: "Stale resource", expectedRevision: created.revision });
  } catch (error) {
    resourceConflict = error;
  }
  assert(resourceConflict?.statusCode === 409, "Stale resource revision was accepted for a collaboration review");

  const revisedBrief = await repository.saveBrief("default", {
    direction: brief.direction,
    source: "manual",
    brief: { ...brief.brief, assumptions: "Revised after the initial review." }
  });
  const staleReview = (await repository.getCollaboration("default")).reviews.find((item) => item.id === "review-local-001");
  assert(revisedBrief.revision === 3 && staleReview?.freshness === "stale" && staleReview.currentResourceRevision === 3, "Resource revision did not mark the open review stale");

  let staleAcceptance = null;
  try {
    await repository.resolveCollaborationReview("default", "review-local-001", { actorId: "local-lead", outcome: "accepted", summary: "Attempt stale acceptance", expectedRevision: revisedBrief.revision });
  } catch (error) {
    staleAcceptance = error;
  }
  assert(staleAcceptance?.statusCode === 409, "Lead was allowed to accept a stale resource review");

  const resolved = await repository.resolveCollaborationReview("default", "review-local-001", {
    actorId: "local-lead",
    outcome: "rejected",
    summary: "Reject this stale review and open a new review for the revised brief.",
    expectedRevision: revisedBrief.revision
  });
  const review = resolved.reviews.find((item) => item.id === "review-local-001");
  assert(resolved.revision === 4 && resolved.openCount === 0 && review?.state === "rejected" && review.freshness === "stale" && review.decision?.actor.id === "local-lead", "Lead decision was not appended with stale-review state");

  let staleProject = null;
  try {
    await repository.resolveCollaborationReview("default", "review-local-001", { actorId: "local-lead", outcome: "rejected", summary: "Stale decision", expectedRevision: 3 });
  } catch (error) {
    staleProject = error;
  }
  assert(staleProject?.statusCode === 409, "Stale project revision was accepted for a collaboration decision");

  const audit = await repository.listAudit("default", 10);
  assert(audit.entries[0]?.action === "collaboration.review.resolved" && audit.entries[1]?.action === "concept_brief.updated" && audit.entries[2]?.action === "collaboration.review.created", "Collaboration audit events were not appended in order");
  assert(audit.entries[0]?.actor?.id === "local-lead" && audit.entries[0]?.actor?.roles?.includes("lead") && audit.entries[2]?.actor?.id === "local-researcher", "Collaboration audit events omitted verified actor attribution");

  const payload = buildReportPayload({
    project: { title: "Collaboration acceptance", brief: brief.brief, citations: [] },
    direction: "Review",
    ov1: { nodes: [], edges: [] },
    ov5: { activities: [], edges: [] },
    ooda: { sourceActivityIds: [], lanes: [] },
    scenario: null,
    validationResult: null,
    knowledge: null,
    deployment: { settings: {}, status: "not-configured" },
    collaboration: resolved
  });
  const markdown = buildMarkdownReport(payload);
  const xml = buildXmlReport(payload);
  assert(payload.collaboration?.openCount === 0 && markdown.includes("协同审阅") && markdown.includes("local-prototype-policy") && markdown.includes("stale") && markdown.includes("context brief"), "Collaboration summary was not retained in Markdown output with review context");
  assert(xml.includes('<collaboration mode="local-prototype-policy"') && xml.includes('outcome="rejected"') && xml.includes('freshness="stale"') && xml.includes('<reviewContext modelKind="brief"'), "Collaboration summary was not retained in XML output with structured review context");

  console.log(`Collaboration foundation acceptance passed: review r${created.revision}, decision r${resolved.revision}, ${audit.entries.length} audit entries.`);
} finally {
  await rm(directory, { recursive: true, force: true });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
