import { renderCollaboration } from "../design-studio/src/collaborationView.js";
import { buildExportArtifactFromPayload, buildReportPayload } from "../design-studio/src/reportBuilder.js";

const html = renderCollaboration({
  projectRevision: 4,
  collaboration: {
    status: "ready",
    revision: 4,
    resourceRevision: 1,
    policy: { mode: "local-managed-accounts", authentication: "local-password-session", actors: [] },
    session: { authenticated: true, actor: { id: "lead-1", label: "Research lead", roles: ["lead"] } },
    storage: { status: "ready", mode: "server", label: "Collaboration" },
    reviews: [],
    auditEntries: [{ action: "ov5.updated", revision: 4, source: "spoofed", actor: { id: "lead-1", label: "Research lead" }, summary: "2 activities / 1 edges", occurredAt: "2026-07-14T00:00:00.000Z" }]
  }
});

assert(html.includes("项目变更审计") && (html.includes("更新作战活动模型") || html.includes("更新 OV-5")) && html.includes("Research lead") && !html.includes("spoofed") && html.includes('data-action="export-project-audit"') && html.includes("项目写入认证"), "Project audit view did not provide verified attribution, export, and deployment authentication guidance");
const payload = buildReportPayload({ project: { title: "Audit report", brief: { objective: "Review", approach: "Audit", assumptions: "Local", risk: "Disclosure" }, citations: [] }, direction: "Audit", ov1: { nodes: [], edges: [] }, ov5: { activities: [], edges: [] }, ooda: { lanes: [] }, scenario: null, validationResult: null, knowledge: null, deployment: {}, collaboration: { status: "ready", policy: {}, reviews: [], auditEntries: [{ id: "audit-1", revision: 4, action: "ov5.updated", actor: { id: "lead-1", label: "Research lead" }, occurredAt: "2026-07-14T00:00:00.000Z", summary: "Updated model" }] } });
const markdown = buildExportArtifactFromPayload("markdown", payload).content;
const xml = buildExportArtifactFromPayload("xml", payload).content;
assert(markdown.includes("项目审计摘要") && markdown.includes("Research lead") && xml.includes('<projectAudit count="1">') && !xml.includes("spoofed"), "Report export did not retain bounded public project audit summary");
console.log("Collaboration audit view acceptance passed: verified project actor rendered.");

function assert(condition, message) { if (!condition) throw new Error(message); }
