import { buildExportArtifactFromPayload, buildReportPayload } from "../design-studio/src/reportBuilder.js";
import { loadReportTemplate, saveReportTemplate, getReportTemplate } from "../design-studio/src/reportTemplateStore.js";
import { saveReportVersion } from "../design-studio/src/reportVersionStore.js";
import { renderView } from "../design-studio/src/ui.js";
import { createReportIntegrity, verifyReportIntegrity } from "../design-studio/src/reportIntegrity.js";

const storage = new Map();
globalThis.localStorage = {
  getItem(key) { return storage.get(key) || null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};

assert(getReportTemplate("untrusted-template").id === "research-standard", "Unknown report template was not rejected to the built-in default");
assert(saveReportTemplate("review-evidence").id === "review-evidence" && loadReportTemplate().id === "review-evidence", "Selected built-in report template did not persist locally");

const payload = buildReportPayload({
  project: { title: "Template acceptance", brief: { objective: "Review", approach: "Evidence", assumptions: "Local", risk: "Disclosure" }, citations: [] },
  direction: "Review",
  ov1: { nodes: [], edges: [] },
  ov5: { activities: [], edges: [] },
  ooda: { sourceActivityIds: [], lanes: [] },
  scenario: null,
  validationResult: null,
  knowledge: null,
  deployment: {},
  reportTemplate: "review-evidence"
});

const markdown = buildExportArtifactFromPayload("markdown", payload).content;
const xml = buildExportArtifactFromPayload("xml", payload).content;
const json = JSON.parse(buildExportArtifactFromPayload("json", payload).content);
assert(payload.reportTemplate.id === "review-evidence" && buildExportArtifactFromPayload("markdown", payload).filename.endsWith("-review-evidence.md") && markdown.includes("# Template acceptance 作战概念审阅报告") && markdown.includes("Report template: 审阅证据 (review-evidence)") && xml.includes('reportTemplateId="review-evidence"') && xml.includes('<reportTemplate id="review-evidence">') && json.reportTemplate?.id === "review-evidence", "Report template metadata, title, or filename did not reach structured exports");

payload.reportIntegrity = await createReportIntegrity(payload);
assert((await verifyReportIntegrity({ ...payload, reportVersion: { label: "R001" } })).status === "verified", "Report integrity did not ignore archive version metadata");
assert((await verifyReportIntegrity({ ...payload, project: { ...payload.project, title: "Changed" } })).status === "mismatch", "Report integrity did not detect a changed report payload");
saveReportTemplate("exchange-baseline");
const versions = saveReportVersion(payload);
assert(versions[0]?.reportTemplate?.id === "review-evidence" && versions[0]?.integrity?.digest === payload.reportIntegrity.digest && versions[0]?.payload?.reportTemplate?.id === "review-evidence", "Archived report did not freeze its selected template and integrity manifest");

const preview = renderView("report", {
  brief: payload.project.brief,
  inspiration: null,
  direction: payload.project.direction,
  ov1: { nodes: [], edges: [] },
  ov5: { activities: [{ id: "evidence-activity", title: "Evidence activity", type: "review", input: "", output: "", duration: "", text: "", refs: ["Sensitive source"] }], edges: [] },
  ooda: { lanes: [] },
  scenario: null,
  validationResult: null,
  knowledge: { docs: [{ id: "restricted", title: "Sensitive source", sensitivity: { marked: true } }], summary: { name: "Vault", fileCount: 1, chunkCount: 1 } },
  knowledgeCitationApprovals: [{ id: "approval-1", documentId: "restricted", scope: "report-citation", approvedAt: "2026-07-15T00:00:00.000Z", approvedBy: { id: "lead", label: "Lead", roles: ["lead"] } }],
  deployment: {},
  modelSnapshots: [],
  modelComparison: null,
  reportTemplate: "exchange-baseline",
  collaboration: { status: "ready", policy: {}, reviews: [], auditEntries: [] },
  projectRevision: 1,
  projectStorage: {}, ov1Storage: {}, ov5Storage: {}, oodaStorage: {}, scenarioStorage: {}, validationStorage: {}, knowledgeStorage: {}, reportStorage: {}, modelSnapshotStorage: {},
  reportVersions: versions,
  obsidianArchive: null,
  obsidianArchiveWriting: false
});
assert(preview.includes("Sensitive source") && preview.includes('data-report-template') && preview.includes("审阅证据") && preview.includes("交换基线") && preview.includes("SHA-256 清单") && preview.includes('data-version-verify'), "Report preview did not use approved citation context, frozen template labels, integrity metadata, and verification action");
const archivingPreview = renderView("report", { ...structuredClone({
  brief: payload.project.brief, inspiration: null, direction: payload.project.direction, ov1: { nodes: [], edges: [] }, ov5: { activities: [], edges: [] }, ooda: { lanes: [] }, scenario: null, validationResult: null, knowledge: null, knowledgeCitationApprovals: [], deployment: {}, modelSnapshots: [], modelComparison: null, reportTemplate: "research-standard", collaboration: { status: "ready", policy: {}, reviews: [], auditEntries: [] }, projectRevision: 1, projectStorage: {}, ov1Storage: {}, ov5Storage: {}, oodaStorage: {}, scenarioStorage: {}, validationStorage: {}, knowledgeStorage: {}, reportStorage: {}, modelSnapshotStorage: {}, reportVersions: [], obsidianArchive: null, obsidianArchiveWriting: false
}), reportArchiving: true });
assert(archivingPreview.includes("正在归档") && archivingPreview.includes('data-action="save-report-version" disabled'), "Report archive control did not render its busy state");

console.log("Report template acceptance passed: whitelist fallback, local selection, export metadata, and archive freezing.");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
