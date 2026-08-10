import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileProjectRepository } from "../server/projectRepository.mjs";
import { registerProjectWriteActor } from "../server/projectWriteAuditActor.mjs";

const directory = await mkdtemp(join(tmpdir(), "combat-concept-project-audit-"));
const repository = createFileProjectRepository({ filePath: join(directory, "projects.json"), now: () => "2026-07-14T00:00:00.000Z" });

try {
  const authenticatedWrite = {
    source: "spoofed-browser-source",
    brief: { objective: "Audit attribution", approach: "test", assumptions: "test", risk: "test" },
    direction: "test"
  };
  registerProjectWriteActor(authenticatedWrite, { id: "account-1", label: "Researcher One", roles: ["researcher", "untrusted"] });
  await repository.saveBrief("default", authenticatedWrite);
  const authenticatedAudit = (await repository.listAudit("default")).entries[0];
  assert(authenticatedAudit.source === "account-1", "Authenticated write did not override request source");
  assert(authenticatedAudit.actor?.id === "account-1" && authenticatedAudit.actor.label === "Researcher One", "Authenticated write omitted actor attribution");
  assert(authenticatedAudit.actor.roles.join(",") === "researcher", "Actor roles were not bounded");

  await repository.saveBrief("local", { source: "manual", brief: authenticatedWrite.brief, direction: "local" });
  const localAudit = (await repository.listAudit("local")).entries[0];
  assert(localAudit.source === "manual" && !localAudit.actor, "Default local write behavior changed");
  console.log("Project-write audit attribution acceptance passed: server actor is recorded only for authenticated writes.");
} finally {
  await rm(directory, { recursive: true, force: true });
}

function assert(condition, message) { if (!condition) throw new Error(message); }
