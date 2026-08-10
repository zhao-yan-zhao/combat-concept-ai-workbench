import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const directory = await mkdtemp(join(tmpdir(), "combat-concept-project-migration-"));
const source = join(directory, "projects.json");
const target = join(directory, "nested", "projects.sqlite");
try {
  await writeFile(source, JSON.stringify({ version: 1, projects: { default: { revision: 2, audit: [{ id: "audit-2", action: "ov5.updated" }] } } }), "utf8");
  await run(["--source", source, "--database", target]);
  const database = new DatabaseSync(target);
  const payload = JSON.parse(database.prepare("SELECT payload FROM project_repository_state WHERE id = 1").get().payload);
  database.close();
  assert(payload.projects.default.revision === 2, "Migration did not preserve project state");
  await assertRejects(["--source", source, "--database", target], "Migration overwrote an existing SQLite repository");
  console.log("File-to-SQLite migration acceptance passed: verified import and non-overwrite behavior.");
} finally {
  await rm(directory, { recursive: true, force: true });
}

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/migrate-file-project-to-sqlite.mjs", ...args], { cwd: process.cwd(), windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr || `Migration exited ${code}`)));
  });
}
async function assertRejects(args, message) { try { await run(args); } catch { return; } throw new Error(message); }
function assert(condition, message) { if (!condition) throw new Error(message); }
