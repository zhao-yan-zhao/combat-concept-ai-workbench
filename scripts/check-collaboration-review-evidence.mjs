import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileProjectRepository } from "../server/projectRepository.mjs";
import { renderCollaboration, renderCollaborationLoginGate } from "../design-studio/src/collaborationView.js";
import { buildMarkdownReport, buildReportPayload, buildXmlReport } from "../design-studio/src/reportBuilder.js";

const directory = await mkdtemp(join(tmpdir(), "combat-concept-collaboration-evidence-"));
let tick = 0;
const repository = createFileProjectRepository({ filePath: join(directory, "projects.json"), now: () => `2026-07-15T00:00:${String(++tick).padStart(2, "0")}.000Z` });

try {
  const brief = await repository.saveBrief("default", {
    direction: "Review",
    source: "manual",
    brief: { objective: "Evidence review", approach: "Bounded references", assumptions: "Public evidence only", risk: "Sensitive evidence excluded" }
  });
  const knowledge = await repository.saveKnowledge("default", {
    expectedRevision: brief.revision,
    source: "obsidian-import",
    model: { docs: [
      { id: "public-evidence", vaultId: "vault", vaultName: "Review vault", filePath: "public.md", title: "Public evidence", tags: [], content: "Public review evidence." },
      { id: "sensitive-evidence", vaultId: "vault", vaultName: "Review vault", filePath: "sensitive.md", title: "Sensitive evidence", tags: [], content: "Sensitive review evidence.", frontmatter: { sensitive: true } }
    ] }
  });
  const created = await repository.createCollaborationReview("default", {
    actorId: "local-researcher",
    resource: "brief",
    resourceRevision: brief.resourceRevision,
    disposition: "comment",
    summary: "Link public review evidence.",
    evidenceRefs: ["public-evidence", "sensitive-evidence", "unknown-evidence", "public-evidence"],
    expectedRevision: knowledge.revision
  });
  assert(created.review?.evidenceRefs?.join(",") === "public-evidence", "Review evidence did not retain only the permitted public reference");

  const collaboration = { ...created, status: "ready", session: { authenticated: true, actor: { roles: ["researcher"] } } };
  const view = renderCollaboration({
    collaboration,
    projectRevision: created.revision,
    knowledge: knowledge.model,
    projectStorage: { revision: brief.revision }, ov1Storage: {}, ov5Storage: {}, oodaStorage: {}, scenarioStorage: {}, validationStorage: {}, knowledgeStorage: { resourceRevision: knowledge.resourceRevision }, reportStorage: {}
  });
  assert(view.includes('name="evidenceRefs"') && view.includes("public-evidence") && !view.includes('value="sensitive-evidence"'), "Collaboration review form exposed incorrect evidence options");
  assert(view.includes('data-collaboration-filter="open"') && view.includes('data-collaboration-filter="stale"') && view.includes("collaboration-identity-summary"), "Collaboration review queue did not render identity and filter controls");
  const loginGate = renderCollaborationLoginGate({ status: "ready", session: { authenticated: false, setupRequired: false } });
  assert(loginGate.includes('id="collaborationLoginForm"') && !loginGate.includes('id="collaborationSetupForm"'), "Unauthenticated users were not directed to the login gate");

  const payload = buildReportPayload({
    project: { title: "Collaboration evidence acceptance", brief: brief.brief, citations: [] },
    direction: "Review",
    ov1: { nodes: [], edges: [] }, ov5: { activities: [], edges: [] }, ooda: { sourceActivityIds: [], lanes: [] }, scenario: null, validationResult: null,
    knowledge: knowledge.model, deployment: { settings: {}, status: "not-configured" }, collaboration
  });
  const markdown = buildMarkdownReport(payload);
  const xml = buildXmlReport(payload);
  assert(payload.collaboration.reviews[0].evidenceRefs.join(",") === "public-evidence" && markdown.includes("public-evidence") && xml.includes('<ref id="public-evidence"/>') && !markdown.includes("sensitive-evidence") && !xml.includes("sensitive-evidence"), "Collaboration report evidence filtering failed");

  console.log(`Collaboration review evidence acceptance passed: ${created.review.evidenceRefs.length} public reference retained.`);
} finally {
  repository.close();
  await rm(directory, { recursive: true, force: true });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
