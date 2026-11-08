import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadAiServiceConfig, saveAiServiceConfig } from "../server/aiServiceConfig.mjs";
import { isAiAvailable, resolveAiActionLabel } from "../design-studio/src/app/aiAvailability.js";
import {
  createLocalPhaseActionTemplate,
  createLocalForceMissionTemplate,
  createLocalConceptGraphicTemplate,
  createLocalScenarioTemplate
} from "../design-studio/src/app/localDraftTemplates.js";
import { createOpenAiClient, validateSchema } from "../server/openaiClient.mjs";

console.log("=== 1. 本地模型与自定义 BaseURL / 模型名配置核验 ===");
{
  const tempConfigPath = path.resolve(`data/temp-ai-config-${Date.now()}.json`);
  try {
    const localConfig = {
      provider: "custom",
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "qwen2.5-coder:14b-instruct-q8_0",
      protocol: "chat"
    };

    await saveAiServiceConfig({ configPath: tempConfigPath, value: localConfig });
    const loaded = await loadAiServiceConfig({ configPath: tempConfigPath, environment: {} });

    assert.equal(loaded.baseUrl, "http://127.0.0.1:11434/v1");
    assert.equal(loaded.model, "qwen2.5-coder:14b-instruct-q8_0");
    assert.equal(loaded.provider, "custom");
    assert.equal(loaded.protocol, "chat");

    console.log("✓ 本地模型与自定义离线端点保存与归一化正常");
  } finally {
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }
  }
}

console.log("=== 2. 全局零外部网络外链 (No Remote CDN/Scripts) 静态审计 ===");
{
  const htmlFiles = [
    "design-studio/index.html",
    "prototypes/ov-validation-demo/index.html"
  ];

  for (const relPath of htmlFiles) {
    const fullPath = path.resolve(relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, "utf8");

    // 检查是否存在加载外部资源（script/link/img/iframe）的 http(s)://
    const remoteTags = content.match(/<(script|link|img|iframe)[^>]+(src|href)=["']https?:\/\/[^"']+["'][^>]*>/gi) || [];
    assert.equal(
      remoteTags.length,
      0,
      `在 [${relPath}] 中发现外部网络资源标签: ${remoteTags.join(", ")}，工作台必须具备 100% 离线运行能力`
    );
  }

  // 检查 design-studio/vendor 下静态库本地化存在性
  assert.ok(fs.existsSync(path.resolve("design-studio/vendor/sequence/mermaid-10.9.1.min.js")));
  assert.ok(fs.existsSync(path.resolve("design-studio/vendor/sequence/underscore-1.13.6.min.js")));
  assert.ok(fs.existsSync(path.resolve("design-studio/vendor/sequence/js-sequence-diagrams-2.0.1.min.js")));

  console.log("✓ 全局前端资源 100% 本地化，零外链 CDN 强依赖");
}

console.log("=== 3. AI 可用性检测与按钮降级文案核验 ===");
{
  // 场景 A: AI 未就绪 (无 API Key 且非本地网关)
  const mockStateUnavailable = {
    aiConfig: {
      config: {
        configured: false,
        mode: "mock-fallback",
        baseUrl: "https://api.openai.com/v1"
      }
    }
  };
  assert.equal(isAiAvailable(mockStateUnavailable), false);
  assert.equal(resolveAiActionLabel(mockStateUnavailable, "AI 生成阶段"), "AI 不可用，可手工起草");
  assert.equal(resolveAiActionLabel(mockStateUnavailable, "AI 编译生成想定"), "AI 不可用，可手工起草");
  assert.equal(resolveAiActionLabel(mockStateUnavailable, "AI 编译生成想定", "正在编译…", true), "正在编译…");

  // 场景 B: AI 就绪可用
  const mockStateAvailable = {
    aiConfig: {
      config: {
        configured: true,
        mode: "ai",
        baseUrl: "http://127.0.0.1:8045/v1"
      }
    }
  };
  assert.equal(isAiAvailable(mockStateAvailable), true);
  assert.equal(resolveAiActionLabel(mockStateAvailable, "AI 生成阶段"), "AI 生成阶段");
  assert.equal(resolveAiActionLabel(mockStateAvailable, "AI 编译生成想定"), "AI 编译生成想定");

  console.log("✓ AI 可用性门禁与「AI 不可用，可手工起草」自动降级展现正常");
}

console.log("=== 4. 本地标准模板起草入口合法性与 Schema 校验 ===");
{
  const client = createOpenAiClient({ getAiServiceConfig: () => ({}), getAiApiKey: () => "" });

  // 4.1 阶段与行动本地模板
  const phaseTpl = createLocalPhaseActionTemplate({ objective: "测试课题意图" });
  const phaseSchema = client.resolveDraftSchema("PhaseActionConcept");
  const valPhase = validateSchema(phaseTpl, phaseSchema);
  assert.equal(valPhase.valid, true, `阶段模板未通过校验: ${valPhase.errors?.join("; ")}`);
  assert.equal(phaseTpl.phases.length, 3);
  assert.equal(phaseTpl.generation.source, "manual-template");

  // 4.2 兵力与编成本地模板
  const forceTpl = createLocalForceMissionTemplate({ objective: "测试兵力课题" });
  const forceSchema = client.resolveDraftSchema("ForceMissionPlan");
  const valForce = validateSchema(forceTpl, forceSchema);
  assert.equal(valForce.valid, true, `兵力模板未通过校验: ${valForce.errors?.join("; ")}`);
  assert.equal(forceTpl.forces.length, 4);
  assert.equal(forceTpl.combatForces.length, 4);
  assert.equal(forceTpl.generation.source, "manual-template");

  // 4.3 OV-1 概念图本地模板
  const ov1Tpl = createLocalConceptGraphicTemplate({ objective: "测试机理课题" });
  const ov1Schema = client.resolveDraftSchema("OperationalConceptGraphic");
  const valOv1 = validateSchema(ov1Tpl, ov1Schema);
  assert.equal(valOv1.valid, true, `概念图模板未通过校验: ${valOv1.errors?.join("; ")}`);
  assert.equal(ov1Tpl.nodes.length, 5);
  assert.equal(ov1Tpl.generation.source, "manual-template");

  // 4.4 想定推演本地模板
  const scenarioTpl = createLocalScenarioTemplate({ title: "测试推演想定" });
  const scenarioSchema = client.resolveDraftSchema("ScenarioDraft");
  const valScenario = validateSchema(scenarioTpl, scenarioSchema);
  assert.equal(valScenario.valid, true, `想定模板未通过校验: ${valScenario.errors?.join("; ")}`);
  assert.ok(scenarioTpl.entities.length >= 4);
  assert.ok(scenarioTpl.timeline.length >= 3);
  assert.equal(scenarioTpl.generation.source, "manual-template");

  console.log("✓ 本地阶段/兵力/概念图/想定标准模板起草入口 100% 结构合法且可直接使用");
}

console.log("\n=== T5.4 本地模型与离线运行支持全部通过 (100% PASS) ===");
