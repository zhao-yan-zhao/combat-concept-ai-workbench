import { readFile, rename, writeFile } from "node:fs/promises";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-5.5";

export async function loadAiServiceConfig({ configPath, environment = process.env }) {
  const defaults = defaultsFromEnvironment(environment);
  try {
    const saved = JSON.parse(await readFile(configPath, "utf8"));
    return normalizeAiServiceConfig(saved, defaults);
  } catch {
    return defaults;
  }
}

export async function saveAiServiceConfig({ configPath, value, environment = process.env }) {
  const config = normalizeAiServiceConfig(value, defaultsFromEnvironment(environment));
  const temporaryPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  await rename(temporaryPath, configPath);
  return config;
}

export function getPublicAiServiceConfig(config, hasApiKey, apiKeySource = "server-environment") {
  return {
    provider: "openai",
    baseUrl: config.baseUrl,
    model: config.model,
    configured: Boolean(hasApiKey),
    mode: hasApiKey ? "ai" : "mock-fallback",
    customEndpoint: config.baseUrl !== DEFAULT_BASE_URL,
    apiKeySource
  };
}

function defaultsFromEnvironment(environment) {
  return normalizeAiServiceConfig({
    baseUrl: environment.OPENAI_BASE_URL || DEFAULT_BASE_URL,
    model: environment.OPENAI_MODEL || DEFAULT_MODEL
  }, { baseUrl: DEFAULT_BASE_URL, model: DEFAULT_MODEL });
}

function normalizeAiServiceConfig(value, fallback) {
  return {
    baseUrl: normalizeBaseUrl(value?.baseUrl || fallback.baseUrl),
    model: normalizeModel(value?.model || fallback.model)
  };
}

function normalizeBaseUrl(value) {
  const parsed = new URL(String(value));
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("AI 服务地址必须是无凭据的 HTTP(S) 地址");
  }
  return parsed.toString().replace(/\/$/, "");
}

function normalizeModel(value) {
  const model = String(value || "").trim();
  if (!model || model.length > 120 || /[\r\n]/.test(model)) {
    throw new Error("AI 模型名称无效");
  }
  return model;
}
