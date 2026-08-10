import { buildCollaborationSecurityArtifact } from "../design-studio/src/collaborationSecurityArtifact.js";

const artifact = buildCollaborationSecurityArtifact({ events: [{ id: "security-1", action: "account.created", occurredAt: "2026-07-14T00:00:00.000Z", actor: { id: "lead-1", label: "Lead", roles: ["lead", "unknown"] }, subject: { id: "researcher-1", label: "Researcher", roles: ["researcher"] }, password: "must-not-export", cookie: "must-not-export" }] });
const payload = JSON.parse(artifact.content);
assert(payload.schema === "combat-concept-collaboration-security-events-v1" && payload.events[0].actor.roles.join(",") === "lead", "Security event export did not retain bounded public fields");
assert(!artifact.content.includes("must-not-export") && artifact.filename.endsWith("security-events.json"), "Security event export exposed unsafe fields");
console.log("Collaboration security artifact acceptance passed: bounded public event export.");

function assert(condition, message) { if (!condition) throw new Error(message); }
