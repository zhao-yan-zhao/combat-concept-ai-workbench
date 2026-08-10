import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readSqliteState, resolveStore } from "./sqlite-state-transfer.mjs";

const options = parseArguments(process.argv.slice(2));
if (!options.kind || !options.database || !options.output) {
  throw new Error("Usage: node scripts/sqlite-state-backup.mjs --kind <project|identity> --database <source.sqlite> --output <backup.json>");
}

const store = resolveStore(options.kind);
const databasePath = resolve(options.database);
const outputPath = resolve(options.output);
if (!existsSync(databasePath)) throw new Error("Source SQLite database does not exist");
if (existsSync(outputPath)) throw new Error("Backup output already exists; backup will not overwrite it");

const database = new DatabaseSync(databasePath, { readOnly: true });
try {
  const payload = readSqliteState(database, store);
  const checksum = checksumPayload(payload);
  const backup = { format: "combat-concept-sqlite-state-backup-v1", kind: store.kind, checksum, payload };
  await mkdir(dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(backup, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await rename(temporary, outputPath);
  console.log(`Exported ${store.label} SQLite state; canonical checksum ${checksum}.`);
} finally {
  database.close();
}

function parseArguments(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    if (args[index] === "--kind") result.kind = args[index + 1];
    if (args[index] === "--database") result.database = args[index + 1];
    if (args[index] === "--output") result.output = args[index + 1];
  }
  return result;
}

function checksumPayload(payload) { return createHash("sha256").update(JSON.stringify(payload)).digest("hex"); }
