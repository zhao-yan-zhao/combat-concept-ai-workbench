import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadThemeConfig, saveThemeConfig } from "../server/themeConfig.mjs";

const directory = await mkdtemp(join(tmpdir(), "concept-theme-config-"));
const configPath = join(directory, "theme.json");

try {
  const defaults = await loadThemeConfig({ configPath });
  assert.equal(defaults.primary, "#3b82f6");

  const saved = await saveThemeConfig({
    configPath,
    value: { background: "#101820", panel: "#14222b", text: "#edf7ff", muted: "#aab7c4", primary: "#2563eb", accent: "#06b6d4" }
  });
  assert.equal(saved.background, "#101820");
  assert.deepEqual(await loadThemeConfig({ configPath }), saved);
  await assert.rejects(() => saveThemeConfig({ configPath, value: { primary: "not-a-color" } }), /hexadecimal/i);
  console.log("Theme configuration acceptance passed: defaults, persisted palette, and color validation.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
