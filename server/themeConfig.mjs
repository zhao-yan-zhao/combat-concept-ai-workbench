import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const DEFAULT_THEME = Object.freeze({
  background: "#020617",
  panel: "#0e1a17",
  text: "#e6fff5",
  muted: "#a8bdb4",
  primary: "#3b82f6",
  accent: "#22d3ee"
});

const KEYS = Object.keys(DEFAULT_THEME);

export async function loadThemeConfig({ configPath }) {
  try {
    return normalizeThemeConfig(JSON.parse(await readFile(configPath, "utf8")));
  } catch {
    return { ...DEFAULT_THEME };
  }
}

export async function saveThemeConfig({ configPath, value }) {
  const config = normalizeThemeConfig(value);
  await mkdir(dirname(configPath), { recursive: true });
  const temporaryPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  await rename(temporaryPath, configPath);
  return config;
}

export function normalizeThemeConfig(value) {
  return Object.fromEntries(KEYS.map((key) => [key, normalizeColor(value?.[key], DEFAULT_THEME[key])]));
}

function normalizeColor(value, fallback) {
  const color = String(value || fallback).trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("Theme colors must use six-digit hexadecimal notation");
  return color.toLowerCase();
}
