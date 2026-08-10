import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { resolveStore, validatePayload } from "./sqlite-state-transfer.mjs";

const options = parseArguments(process.argv.slice(2));
if (!options.kind || !options.source || !options.database) {
  throw new Error("Usage: node scripts/sqlite-state-restore.mjs --kind <project|identity> --source <backup.json> --database <new.sqlite>");
}

const store = resolveStore(options.kind);
const sourcePath = resolve(options.source);
const databasePath = resolve(options.database);
if (!existsSync(sourcePath)) throw new Error("Backup source does not exist");
if (existsSync(databasePath)) throw new Error("Target SQLite database already exists; restore requires a new isolated path");
const backup = JSON.parse(await readFile(sourcePath, "utf8"));
if (backup?.format !== "combat-concept-sqlite-state-backup-v1" || backup.kind !== store.kind || !validatePayload(backup.payload, store)) {
  throw new Error("Backup source has an invalid state shape");
}
if (checksumPayload(backup.payload) !== backup.checksum) throw new Error("Backup checksum verification failed");

await mkdir(dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);
try {
  database.exec(`CREATE TABLE ${store.table} (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL, updated_at TEXT NOT NULL)`);
  database.prepare(`INSERT INTO ${store.table} (id, payload, updated_at) VALUES (1, ?, ?)`)
    .run(JSON.stringify(backup.payload), new Date().toISOString());
  const restored = JSON.parse(database.prepare(`SELECT payload FROM ${store.table} WHERE id = 1`).get().payload);
  if (checksumPayload(restored) !== backup.checksum) throw new Error("SQLite restore checksum verification failed");
  console.log(`Restored ${store.label} SQLite state to a new isolated database; canonical checksum ${backup.checksum}.`);
} finally {
  database.close();
}

function parseArguments(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    if (args[index] === "--kind") result.kind = args[index + 1];
    if (args[index] === "--source") result.source = args[index + 1];
    if (args[index] === "--database") result.database = args[index + 1];
  }
  return result;
}

function checksumPayload(payload) { return createHash("sha256").update(JSON.stringify(payload)).digest("hex"); }
