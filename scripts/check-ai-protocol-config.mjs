import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadAiServiceConfig,
  saveAiServiceConfig,
  getPublicAiServiceConfig,
  PROVIDER_PRESETS,
  detectProvider
} from "../server/aiServiceConfig.mjs";
import { createOpenAiClient } from "../server/openaiClient.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const directory = await mkdtemp(join(tmpdir(), "combat-concept-ai-protocol-"));
const configPath = join(directory, "ai-service-config.json");

try {
  // 1. Check Presets
  assert(PROVIDER_PRESETS.gemini, "Missing gemini preset");
  assert(PROVIDER_PRESETS.deepseek, "Missing deepseek preset");
  assert(PROVIDER_PRESETS.qwen, "Missing qwen preset");
  assert(PROVIDER_PRESETS.openai, "Missing openai preset");

  // 2. Defaults
  const initial = await loadAiServiceConfig({ configPath });
  assert(initial.protocol === "auto", `Expected default protocol 'auto', got '${initial.protocol}'`);
  
  const publicConfig = getPublicAiServiceConfig(initial, false);
  assert(publicConfig.protocol === "auto", `Expected public protocol 'auto', got '${publicConfig.protocol}'`);
  assert(publicConfig.presets?.gemini && publicConfig.presets?.deepseek && publicConfig.presets?.qwen, "Public config missing presets");

  // 3. Provider: Gemini
  await saveAiServiceConfig({
    configPath,
    value: {
      provider: "gemini",
      baseUrl: PROVIDER_PRESETS.gemini.baseUrl,
      model: PROVIDER_PRESETS.gemini.model,
      protocol: PROVIDER_PRESETS.gemini.protocol
    }
  });
  const savedGemini = await loadAiServiceConfig({ configPath });
  assert(savedGemini.provider === "gemini", `Expected provider 'gemini', got '${savedGemini.provider}'`);
  assert(savedGemini.protocol === "responses", `Expected protocol 'responses', got '${savedGemini.protocol}'`);

  // 4. Provider: DeepSeek
  await saveAiServiceConfig({
    configPath,
    value: {
      provider: "deepseek",
      baseUrl: PROVIDER_PRESETS.deepseek.baseUrl,
      model: PROVIDER_PRESETS.deepseek.model,
      protocol: PROVIDER_PRESETS.deepseek.protocol
    }
  });
  const savedDeepSeek = await loadAiServiceConfig({ configPath });
  assert(savedDeepSeek.provider === "deepseek", `Expected provider 'deepseek', got '${savedDeepSeek.provider}'`);
  assert(savedDeepSeek.model === "deepseek-chat", `Expected model 'deepseek-chat', got '${savedDeepSeek.model}'`);
  assert(savedDeepSeek.protocol === "chat", `Expected protocol 'chat', got '${savedDeepSeek.protocol}'`);

  // 5. Provider: Qwen (通义千问)
  await saveAiServiceConfig({
    configPath,
    value: {
      provider: "qwen",
      baseUrl: PROVIDER_PRESETS.qwen.baseUrl,
      model: PROVIDER_PRESETS.qwen.model,
      protocol: PROVIDER_PRESETS.qwen.protocol
    }
  });
  const savedQwen = await loadAiServiceConfig({ configPath });
  assert(savedQwen.provider === "qwen", `Expected provider 'qwen', got '${savedQwen.provider}'`);
  assert(savedQwen.model === "qwen-plus", `Expected model 'qwen-plus', got '${savedQwen.model}'`);

  // 6. Provider Auto-detection from URL/model
  assert(detectProvider("https://api.deepseek.com/v1", "deepseek-chat") === "deepseek", "Failed to detect deepseek");
  assert(detectProvider("https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-plus") === "qwen", "Failed to detect qwen");
  assert(detectProvider("http://127.0.0.1:8045/v1", "gemini-3.8-flash-high") === "gemini", "Failed to detect gemini");
  assert(detectProvider("https://api.openai.com/v1", "gpt-5.5") === "openai", "Failed to detect openai");

  // 7. Invalid protocol and provider fallback
  await saveAiServiceConfig({
    configPath,
    value: { baseUrl: "http://127.0.0.1:8045/v1", model: "test-model", protocol: "invalid-proto", provider: "invalid-provider" }
  });
  const savedFallback = await loadAiServiceConfig({ configPath });
  assert(savedFallback.protocol === "auto", `Expected fallback 'auto', got '${savedFallback.protocol}'`);
  assert(savedFallback.provider === "gemini", `Expected detected fallback 'gemini' for 8045 port, got '${savedFallback.provider}'`);

  // 8. Client instantiation and protocol compatibility
  const client = createOpenAiClient({
    getAiServiceConfig: () => savedDeepSeek,
    getAiApiKey: () => "test-deepseek-key"
  });
  assert(typeof client.callOpenAi === "function", "Client missing callOpenAi");
  assert(typeof client.streamOpenAi === "function", "Client missing streamOpenAi");

  console.log("Multi-provider AI protocol configuration checks passed successfully.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
