import { readFile, rename, writeFile } from "node:fs/promises";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-5.5";
const DEFAULT_PROTOCOL = "auto";
const DEFAULT_PROVIDER = "custom";

export const PROVIDER_PRESETS = {
  gemini: {
    id: "gemini",
    label: "Google Gemini (本地网关 / Antigravity)",
    baseUrl: "http://127.0.0.1:8045/v1",
    model: "gemini-3.8-flash-high",
    protocol: "responses",
    description: "原生 Responses API 协议，支持 Prompt Caching 提示词缓存"
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek (深度求索官方)",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    protocol: "chat",
    description: "服务端自动前缀缓存，极低推理开销，支持 deepseek-chat 与 deepseek-reasoner"
  },
  qwen: {
    id: "qwen",
    label: "通义千问 (阿里云百炼 DashScope)",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    protocol: "chat",
    description: "百炼 OpenAI 兼容端点，长文本与上下文缓存支持"
  },
  openai: {
    id: "openai",
    label: "OpenAI (官方服务)",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5.5",
    protocol: "chat",
    description: "标准 OpenAI 兼容服务与前缀提示词缓存"
  },
  custom: {
    id: "custom",
    label: "自定义 / 其他兼容服务商",
    baseUrl: "",
    model: "",
    protocol: "auto",
    description: "自定义兼容端点，自由指定地址、模型与协议"
  }
};

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
  const provider = config.provider || detectProvider(config.baseUrl, config.model);
  return {
    provider,
    baseUrl: config.baseUrl,
    model: config.model,
    protocol: config.protocol || DEFAULT_PROTOCOL,
    configured: Boolean(hasApiKey),
    mode: hasApiKey ? "ai" : "mock-fallback",
    customEndpoint: config.baseUrl !== DEFAULT_BASE_URL,
    apiKeySource,
    presets: PROVIDER_PRESETS
  };
}

function defaultsFromEnvironment(environment) {
  return normalizeAiServiceConfig({
    provider: environment.OPENAI_PROVIDER || DEFAULT_PROVIDER,
    baseUrl: environment.OPENAI_BASE_URL || DEFAULT_BASE_URL,
    model: environment.OPENAI_MODEL || DEFAULT_MODEL,
    protocol: environment.OPENAI_PROTOCOL || DEFAULT_PROTOCOL
  }, { provider: DEFAULT_PROVIDER, baseUrl: DEFAULT_BASE_URL, model: DEFAULT_MODEL, protocol: DEFAULT_PROTOCOL });
}

function normalizeAiServiceConfig(value, fallback) {
  const baseUrl = normalizeBaseUrl(value?.baseUrl || fallback.baseUrl);
  const model = normalizeModel(value?.model || fallback.model);
  const protocol = normalizeProtocol(value?.protocol || fallback.protocol);
  const detected = detectProvider(baseUrl, model);
  const provider = normalizeProvider(value?.provider, detected || fallback.provider);
  return {
    provider,
    baseUrl,
    model,
    protocol
  };
}

export function detectProvider(baseUrl = "", model = "") {
  const lowerUrl = String(baseUrl || "").toLowerCase();
  const lowerModel = String(model || "").toLowerCase();
  if (lowerUrl.includes("8045") || lowerModel.includes("gemini")) return "gemini";
  if (lowerUrl.includes("deepseek") || lowerModel.includes("deepseek")) return "deepseek";
  if (lowerUrl.includes("dashscope") || lowerUrl.includes("aliyun") || lowerModel.includes("qwen")) return "qwen";
  if (lowerUrl.includes("openai.com") || lowerModel.startsWith("gpt-")) return "openai";
  return "custom";
}

function normalizeProvider(value, fallback = DEFAULT_PROVIDER) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["gemini", "deepseek", "qwen", "openai", "custom"].includes(normalized)) {
    return normalized;
  }
  return fallback || DEFAULT_PROVIDER;
}

function normalizeProtocol(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["responses", "chat", "auto"].includes(normalized)) {
    return normalized;
  }
  return DEFAULT_PROTOCOL;
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
