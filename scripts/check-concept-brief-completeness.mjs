import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyAiBriefDraft, createLocalBriefDraft, normalizeConceptBrief } from "../design-studio/src/briefStore.js";
import { buildObsidianArchive } from "../design-studio/src/obsidianArchiveBuilder.js";
import { buildExportArtifactFromPayload, buildReportPayload } from "../design-studio/src/reportBuilder.js";
import { normalizeModelSnapshotInput } from "../server/projectModelNormalizers.mjs";
import { createFileProjectRepository } from "../server/projectRepository.mjs";

const local = new Map();
globalThis.localStorage = { getItem: (key) => local.get(key) || null, setItem: (key, value) => local.set(key, String(value)), removeItem: (key) => local.delete(key) };
const seed = { objective: "Review", approach: "Trace", assumptions: "Abstract", expectedEffects: "Verify provenance", evidenceRefs: ["seed-note"], risk: "Loss" };
const normalized = normalizeConceptBrief({ ...seed, evidenceRefs: "seed-note、evidence-one、seed-note" }, seed);
assert(normalized.expectedEffects === "Verify provenance" && normalized.evidenceRefs.join("|") === "seed-note|evidence-one", "Brief normalization lost expected effects or bounded evidence references");
const localDraft = createLocalBriefDraft({ brief: seed, intent: "Local review", direction: "Review", evidence: [{ id: "local-evidence", title: "Local evidence" }] });
assert(localDraft.expectedEffects && localDraft.evidenceRefs.includes("local-evidence"), "Local brief draft did not retain expected effects and evidence references");
const aiDraft = applyAiBriefDraft({ brief: seed, intent: "AI review", direction: "Review", evidence: [{ id: "ai-evidence" }], draft: { expectedEffects: "Confirm bounded evidence", risks: ["Disclosure"] } });
assert(aiDraft.expectedEffects === "Confirm bounded evidence" && aiDraft.evidenceRefs.includes("ai-evidence"), "AI brief draft did not retain expected effects and evidence references");
const userResearchIntent = "Confirm the research boundary";
const aiDraftWithContext = applyAiBriefDraft({ brief: seed, intent: userResearchIntent, direction: "Review", draft: { summary: "AI analysis may use derived inspiration context." } });
assert(aiDraftWithContext.researchIntent === userResearchIntent, "AI brief drafting expanded the persisted research intent with generation context");

const directory = await mkdtemp(join(tmpdir(), "combat-concept-brief-completeness-"));
const repository = createFileProjectRepository({ filePath: join(directory, "projects.json") });
try {
  const first = await repository.saveBrief("default", { direction: "Review", source: "manual", brief: aiDraft });
  const repeat = await repository.saveBrief("default", { direction: "Review", source: "manual", brief: aiDraft, expectedRevision: first.revision });
  assert(repeat.revision === first.revision, "Unchanged expected effects/evidence references created an unnecessary brief revision");
  const changed = await repository.saveBrief("default", { direction: "Review", source: "manual", expectedRevision: repeat.revision, brief: { ...aiDraft, expectedEffects: "Revised effect", evidenceRefs: ["ai-evidence", "review-note"] } });
  assert(changed.revision === first.revision + 1, "Brief expected-effects/evidence change did not create a revision");
  const reopened = createFileProjectRepository({ filePath: join(directory, "projects.json") });
  const restored = await reopened.getBrief("default");
  assert(restored.brief.expectedEffects === "Revised effect" && restored.brief.evidenceRefs.join("|") === "ai-evidence|review-note", "Repository reopen lost brief completeness fields");
  reopened.close();
} finally {
  repository.close();
  await rm(directory, { recursive: true, force: true });
}

const snapshot = normalizeModelSnapshotInput({ id: "brief-completeness", direction: "Review", model: { brief: aiDraft, ov1: {}, ov5: { activities: [{ id: "activity-1" }], edges: [] }, ooda: { lanes: [{ id: "observe", nodes: [] }] }, scenario: null, validation: null } });
assert(snapshot.model.brief.expectedEffects === "Confirm bounded evidence" && snapshot.model.brief.evidenceRefs.includes("ai-evidence"), "Snapshot normalization lost complete brief fields");
const project = { title: "Brief completeness", brief: aiDraft, citations: [] };
const knowledge = { summary: { name: "Brief vault", fileCount: 3, chunkCount: 3 }, docs: [{ id: "seed-note", title: "Seed note", sensitivity: { marked: false } }, { id: "ai-evidence", title: "AI evidence", sensitivity: { marked: false } }, { id: "sensitive-note", title: "Sensitive note", sensitivity: { marked: true } }] };
const payload = buildReportPayload({ project, direction: "Review", ov1: { nodes: [], edges: [] }, ov5: { activities: [], edges: [] }, ooda: { lanes: [] }, scenario: null, validationResult: null, knowledge, deployment: {} });
const markdown = buildExportArtifactFromPayload("markdown", payload).content;
const xml = buildExportArtifactFromPayload("xml", payload).content;
assert(markdown.includes("预期效果：Confirm bounded evidence") && markdown.includes("知识依据：seed-note、ai-evidence"), "Markdown report lost complete brief fields");
assert(xml.includes("<expectedEffects>Confirm bounded evidence</expectedEffects>") && xml.includes("<briefEvidenceRefs><reference>seed-note</reference><reference>ai-evidence</reference></briefEvidenceRefs>"), "XML report lost complete brief fields");
const archive = buildObsidianArchive(payload);
const briefNote = archive.files.find((file) => file.fileName === "ConceptBrief.md");
assert(briefNote?.content.includes("## 预期效果") && briefNote.content.includes("## 知识依据") && briefNote.content.includes("ai-evidence"), "Obsidian archive lost complete brief fields");
const sensitivePayload = buildReportPayload({ project: { ...project, brief: { ...aiDraft, evidenceRefs: ["seed-note", "sensitive-note", "unmatched-free-text"] } }, direction: "Review", ov1: { nodes: [], edges: [] }, ov5: { activities: [], edges: [] }, ooda: { lanes: [] }, scenario: null, validationResult: null, knowledge, deployment: {}, knowledgeCitationApprovals: [] });
assert(sensitivePayload.project.brief.evidenceRefs.join("|") === "seed-note", "Unmatched or unapproved sensitive brief references entered a report payload");
const approvedPayload = buildReportPayload({ project: { ...project, brief: { ...aiDraft, evidenceRefs: ["sensitive-note"] } }, direction: "Review", ov1: { nodes: [], edges: [] }, ov5: { activities: [], edges: [] }, ooda: { lanes: [] }, scenario: null, validationResult: null, knowledge, deployment: {}, knowledgeCitationApprovals: [{ id: "approval-1", documentId: "sensitive-note", scope: "report-citation", reason: "Review", approvedAt: "2026-07-15T00:00:00.000Z", approvedBy: { id: "lead", label: "Lead", roles: ["lead"] } }] });
assert(approvedPayload.project.brief.evidenceRefs.join("|") === "sensitive-note", "An approved sensitive brief reference was not preserved for the report payload");
console.log("Concept-brief completeness acceptance passed: drafts, revisions, persistence, snapshot, report, and archive preserve expected effects and evidence references.");

function assert(condition, message) { if (!condition) throw new Error(message); }
