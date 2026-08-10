import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileProjectRepository } from "../server/projectRepository.mjs";
import { registerProjectWriteActor } from "../server/projectWriteAuditActor.mjs";
import { filterKnowledgeForReportCitation } from "../server/projectKnowledgeCitationPolicy.mjs";
import { buildReportPayload, buildExportArtifactFromPayload } from "../design-studio/src/reportBuilder.js";

const directory = await mkdtemp(join(tmpdir(), "combat-concept-sensitive-citation-"));
const repository = createFileProjectRepository({ filePath: join(directory, "projects.json"), now: (() => { let tick = 0; return () => `2026-07-14T00:00:0${++tick}.000Z`; })() });
const docs = [
  { id: "public", title: "Public evidence", content: "Public research evidence.", summary: "Public summary", tags: [], frontmatter: {} },
  { id: "sensitive", title: "Sensitive evidence", content: "Sensitive research evidence.", summary: "Sensitive summary", tags: ["restricted"], frontmatter: { sensitive: true } }
];

try {
  await repository.saveKnowledge("default", { model: { docs }, source: "acceptance" });
  const deniedInput = { documentId: "sensitive", reason: "Need citation", expectedRevision: 1 };
  let denied = null;
  try { await repository.createKnowledgeCitationApproval("default", deniedInput); } catch (error) { denied = error; }
  assert(denied?.statusCode === 403, "Unverified actor created a sensitive citation approval");

  const approvalInput = { documentId: "sensitive", reason: "Lead-approved research report citation", expectedRevision: 1 };
  registerProjectWriteActor(approvalInput, { id: "lead-1", label: "Lead One", roles: ["lead", "researcher", "untrusted"] });
  const created = await repository.createKnowledgeCitationApproval("default", approvalInput);
  assert(created.revision === 2 && created.approval.approvedBy.id === "lead-1" && created.approval.approvedBy.roles.join(",") === "lead,researcher", "Lead approval was not bounded and persisted");
  const allowed = filterKnowledgeForReportCitation(docs, created.approvals, "2026-07-14T00:00:10.000Z");
  assert(allowed.docs.map((item) => item.id).join(",") === "public,sensitive" && allowed.sensitiveExcludedCount === 0 && allowed.sensitiveCitationApprovalCount === 1 && allowed.approvedCitations[0]?.approvedBy?.id === "lead-1", "Active approval did not permit only the approved sensitive fragment for reports");

  const payload = buildReportPayload({
    project: { title: "Citation policy", brief: { objective: "Review", approach: "Policy", assumptions: "Lead approval", risk: "Disclosure" }, citations: [] },
    direction: "Policy", ov1: { nodes: [], edges: [] }, ov5: { activities: [{ id: "a", title: "Evidence", type: "research", input: "", output: "", duration: "", text: "", refs: ["Sensitive"] }], edges: [] },
    ooda: { sourceActivityIds: [], lanes: [] }, scenario: null, validationResult: null, knowledge: { docs, summary: { name: "Vault", fileCount: 2, chunkCount: 2, importedAt: "2026-07-14" } }, deployment: { settings: {}, status: "not-configured" }, knowledgeCitationApprovals: created.approvals
  });
  const markdown = buildExportArtifactFromPayload("markdown", payload).content;
  const xml = buildExportArtifactFromPayload("xml", payload).content;
  assert(JSON.stringify(payload.knowledge).includes("Sensitive evidence") && markdown.includes("Sensitive evidence") && markdown.includes("Lead One") && xml.includes('sensitiveCitationApprovalCount="1"') && xml.includes("sensitiveCitationApprovals"), "Approved sensitive citation was not auditable in report output");

  const revokeInput = { reason: "Citation no longer approved", expectedRevision: 2 };
  registerProjectWriteActor(revokeInput, { id: "lead-1", label: "Lead One", roles: ["lead"] });
  const revoked = await repository.revokeKnowledgeCitationApproval("default", created.approval.id, revokeInput);
  const blocked = filterKnowledgeForReportCitation(docs, revoked.approvals, "2026-07-14T00:00:12.000Z");
  assert(blocked.docs.map((item) => item.id).join(",") === "public" && blocked.sensitiveExcludedCount === 1, "Revoked sensitive citation remained report-eligible");
  const audit = await repository.listAudit("default", 4);
  assert(audit.entries[0].action === "knowledge.sensitive_citation.revoked" && audit.entries[1].action === "knowledge.sensitive_citation.approved" && audit.entries[0].actor?.id === "lead-1", "Citation policy changes were not audit-attributed");
  console.log("Sensitive citation policy acceptance passed: lead approval permits one report citation and revocation restores exclusion.");
} finally {
  await rm(directory, { recursive: true, force: true });
}

function assert(condition, message) { if (!condition) throw new Error(message); }
