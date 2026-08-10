import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createLocalIdentityAdapter } from "../server/projectLocalIdentity.mjs";
import { createFileProjectRepository } from "../server/projectRepository.mjs";

const directory = await mkdtemp(join(tmpdir(), "combat-concept-sqlite-backup-"));
try {
  await verifyProjectRoundTrip();
  await verifyIdentityRoundTrip();
  console.log("SQLite backup/restore acceptance passed: project and identity state round trips are isolated and non-overwriting.");
} finally {
  await rm(directory, { recursive: true, force: true });
}

async function verifyProjectRoundTrip() {
  const database = join(directory, "project.sqlite");
  const backup = join(directory, "backups", "project.json");
  const restored = join(directory, "restore", "project.sqlite");
  const project = createFileProjectRepository({ filePath: join(directory, "unused-project.json"), databasePath: database });
  await project.saveBrief("default", { direction: "Backup review", source: "acceptance", brief: { objective: "Persist", approach: "Export", assumptions: "Isolated", risk: "Restore" } });
  project.close();
  await run("sqlite-state-backup.mjs", ["--kind", "project", "--database", database, "--output", backup]);
  await run("sqlite-state-restore.mjs", ["--kind", "project", "--source", backup, "--database", restored]);
  const reopened = createFileProjectRepository({ filePath: join(directory, "unused-restored.json"), databasePath: restored });
  assert((await reopened.getBrief("default")).brief.objective === "Persist", "Restored project repository lost its brief");
  reopened.close();
  await assertRejects("sqlite-state-backup.mjs", ["--kind", "project", "--database", database, "--output", backup], "Backup overwrote an existing package");
  await assertRejects("sqlite-state-restore.mjs", ["--kind", "project", "--source", backup, "--database", restored], "Restore overwrote an existing SQLite database");
}

async function verifyIdentityRoundTrip() {
  const database = join(directory, "identity.sqlite");
  const backup = join(directory, "backups", "identity.json");
  const restored = join(directory, "restore", "identity.sqlite");
  const identity = createLocalIdentityAdapter({ filePath: join(directory, "unused-identity.json"), databasePath: database, sessionSecret: "backup-restore-identity" });
  await identity.setup({ username: "backup-lead", label: "Backup lead", password: "backup-restore-password" });
  identity.close();
  await run("sqlite-state-backup.mjs", ["--kind", "identity", "--database", database, "--output", backup]);
  await run("sqlite-state-restore.mjs", ["--kind", "identity", "--source", backup, "--database", restored]);
  const reopened = createLocalIdentityAdapter({ filePath: join(directory, "unused-restored-identity.json"), databasePath: restored, sessionSecret: "backup-restore-identity" });
  assert((await reopened.login({ username: "backup-lead", password: "backup-restore-password" })).actor.label === "Backup lead", "Restored identity store could not authenticate its account");
  reopened.close();
}

function run(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [`scripts/${script}`, ...args], { cwd: process.cwd(), windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr || `${script} exited ${code}`)));
  });
}
async function assertRejects(script, args, message) { try { await run(script, args); } catch { return; } throw new Error(message); }
function assert(condition, message) { if (!condition) throw new Error(message); }
