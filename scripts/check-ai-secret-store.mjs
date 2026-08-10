import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAiSecretStore } from "../server/projectAiSecretStore.mjs";

const directory = await mkdtemp(join(tmpdir(), "combat-concept-ai-secret-"));
const secretPath = join(directory, "ai-secret.json");
const key = "sk-local-dpapi-acceptance-key-1234567890";
try {
  const store = createAiSecretStore({ filePath: secretPath });
  assert(await store.load() === "", "Missing secret store did not resolve to an empty key");
  await store.save(key);
  const serialized = await readFile(secretPath, "utf8");
  assert(!serialized.includes(key) && serialized.includes("protectedValue"), "AI key was not protected before local persistence");
  assert(await store.load() === key, "Windows DPAPI key could not be restored for the current user");
  console.log("AI secret-store acceptance passed: DPAPI-protected key restored without plaintext persistence.");
} finally {
  await rm(directory, { recursive: true, force: true });
}

function assert(condition, message) { if (!condition) throw new Error(message); }
