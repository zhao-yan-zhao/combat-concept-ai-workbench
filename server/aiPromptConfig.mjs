import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function loadAiPromptOverrides({ configPath }) {
  try {
    return normalizeOverrides(JSON.parse(await readFile(configPath, "utf8"))?.overrides);
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw new Error(`AI prompt config could not be loaded: ${error.message}`);
  }
}

export async function saveAiPromptOverrides({ configPath, value }) {
  const overrides = normalizeOverrides(value?.overrides ?? value);
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify({ version: 1, overrides }, null, 2)}\n`, "utf8");
  return overrides;
}

export function normalizeOverrides(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result = {};
  for (const [id, content] of Object.entries(value)) {
    const key = String(id || "").trim().slice(0, 160);
    const text = String(content ?? "").trim();
    if (key && text) result[key] = text.slice(0, 100000);
  }
  return result;
}
