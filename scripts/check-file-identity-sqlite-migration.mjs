import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createLocalIdentityAdapter } from "../server/projectLocalIdentity.mjs";

const directory = await mkdtemp(join(tmpdir(), "combat-concept-identity-migration-"));
const source = join(directory, "identities.json");
const target = join(directory, "nested", "identities.sqlite");
try {
  const fileIdentity = createLocalIdentityAdapter({ filePath: source, sessionSecret: "identity-migration-test" });
  await fileIdentity.setup({ username: "migration-lead", label: "Migration lead", password: "identity-migration-password" });
  fileIdentity.close();
  await run(["--source", source, "--database", target]);
  const sqliteIdentity = createLocalIdentityAdapter({ filePath: join(directory, "unused.json"), databasePath: target, sessionSecret: "identity-migration-test" });
  const login = await sqliteIdentity.login({ username: "migration-lead", password: "identity-migration-password" });
  assert(login.actor.label === "Migration lead" && sqliteIdentity.getStatus().storage === "sqlite", "Migrated identity store could not authenticate the source account");
  sqliteIdentity.close();
  await assertRejects(["--source", source, "--database", target], "Migration overwrote an existing SQLite identity store");
  console.log("File-to-SQLite identity migration acceptance passed: verified import, login, and non-overwrite behavior.");
} finally {
  await rm(directory, { recursive: true, force: true });
}

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/migrate-file-identity-to-sqlite.mjs", ...args], { cwd: process.cwd(), windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr || `Migration exited ${code}`)));
  });
}
async function assertRejects(args, message) { try { await run(args); } catch { return; } throw new Error(message); }
function assert(condition, message) { if (!condition) throw new Error(message); }
