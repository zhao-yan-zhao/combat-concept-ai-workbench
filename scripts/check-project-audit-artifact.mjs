import { buildProjectAuditArtifact } from "../design-studio/src/projectAuditArtifact.js";

const artifact = buildProjectAuditArtifact({
  projectId: "demo",
  exportedAt: "2026-07-14T00:00:00.000Z",
  entries: [{ id: "audit-1", revision: 3, action: "ov5.updated", source: "browser", actor: { id: "lead-1", label: "Lead", roles: ["lead", "unknown"] }, occurredAt: "2026-07-14T00:00:00.000Z", summary: "3 activities", ov5Revision: 2, password: "must-not-export", session: "must-not-export" }]
});
const payload = JSON.parse(artifact.content);
assert(payload.schema === "combat-concept-project-audit-v1" && payload.projectId === "demo" && payload.entries[0].actor.roles.join(",") === "lead", "Project audit export did not retain bounded public attribution");
assert(!artifact.content.includes("must-not-export") && artifact.filename === "combat-concept-project-audit-demo.json", "Project audit export leaked non-audit fields or named the artifact incorrectly");
console.log("Project audit artifact acceptance passed: bounded public audit export.");

function assert(condition, message) { if (!condition) throw new Error(message); }
