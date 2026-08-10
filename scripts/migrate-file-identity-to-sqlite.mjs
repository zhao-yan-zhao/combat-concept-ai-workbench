import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const options = parseArguments(process.argv.slice(2));
if (!options.source || !options.database) {
  throw new Error("Usage: node scripts/migrate-file-identity-to-sqlite.mjs --source <identities.json> --database <identities.sqlite>");
}

const sourcePath = resolve(options.source);
const databasePath = resolve(options.database);
if (!existsSync(sourcePath)) throw new Error("Source identity file does not exist");
const source = JSON.parse(await readFile(sourcePath, "utf8"));
if (!source || typeof source !== "object" || !Array.isArray(source.users) || !Array.isArray(source.events)) {
  throw new Error("Source identity file has an invalid store shape");
}

await mkdir(dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);
try {
  database.exec("CREATE TABLE IF NOT EXISTS collaboration_identity_store (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL, updated_at TEXT NOT NULL)");
  const existing = database.prepare("SELECT id FROM collaboration_identity_store WHERE id = 1").get();
  if (existing) throw new Error("Target SQLite identity store already contains state; migration will not overwrite it");
  const payload = JSON.stringify(source);
  database.prepare("INSERT INTO collaboration_identity_store (id, payload, updated_at) VALUES (1, ?, ?)").run(payload, new Date().toISOString());
  const restored = JSON.parse(database.prepare("SELECT payload FROM collaboration_identity_store WHERE id = 1").get().payload);
  const sourceHash = checksum(source);
  if (checksum(restored) !== sourceHash) throw new Error("SQLite identity migration checksum verification failed");
  console.log(`Migrated ${source.users.length} identity account(s) to SQLite; canonical checksum ${sourceHash}.`);
} finally {
  database.close();
}

function parseArguments(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (key === "--source") result.source = value;
    if (key === "--database") result.database = value;
  }
  return result;
}

function checksum(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
