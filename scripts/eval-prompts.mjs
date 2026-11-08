#!/usr/bin/env node
/**
 * scripts/eval-prompts.mjs
 * 
 * 核心提示词质量评测运行脚本 (T5.3)
 * 支持：
 * 1. 结构合法率（Schema 校验通过率）
 * 2. 引用合法率（无捏造/幻觉证据，溯源闭环率）
 * 3. 关键字段完整率（必填字段与集合元素达标率）
 * 4. 语义质量达标率（关键词白名单包含、负面词黑名单清零）
 * 
 * 运行方式：
 *   node scripts/eval-prompts.mjs                 # 默认离线评测 30 条黄金用例基准
 *   node scripts/eval-prompts.mjs --live          # 真实大模型在线评测（读取 AI 配置与 API Key）
 *   node scripts/eval-prompts.mjs --category=tactic  # 仅评测战法类用例
 *   node scripts/eval-prompts.mjs --prompt=ai.generate.concept-brief  # 仅评测指定提示词
 *   node scripts/eval-prompts.mjs --case=tactic-brief-01             # 仅评测单条用例
 *   node scripts/eval-prompts.mjs --save          # 保存评测结果 JSON 至 eval/results/
 */

import fs from "node:fs";
import path from "node:path";
import { loadAllCases } from "../eval/caseLoader.mjs";
import { evaluateCase, aggregateResults, formatConsoleReport } from "../eval/evaluator.mjs";
import { createOpenAiClient } from "../server/openaiClient.mjs";
import { loadAiServiceConfig } from "../server/aiServiceConfig.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    mode: "golden", // 'golden' | 'live' | 'mock'
    promptId: null,
    category: null,
    caseId: null,
    save: false,
    format: "text" // 'text' | 'json'
  };

  for (const arg of args) {
    if (arg === "--live" || arg === "--online") {
      options.mode = "live";
    } else if (arg === "--mock") {
      options.mode = "mock";
    } else if (arg === "--golden" || arg === "--offline") {
      options.mode = "golden";
    } else if (arg.startsWith("--prompt=")) {
      options.promptId = arg.slice(9).trim();
    } else if (arg.startsWith("--category=")) {
      options.category = arg.slice(11).trim();
    } else if (arg.startsWith("--case=")) {
      options.caseId = arg.slice(7).trim();
    } else if (arg === "--save") {
      options.save = true;
    } else if (arg === "--json" || arg === "--format=json") {
      options.format = "json";
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  // 1. 加载并筛选用例
  let cases = loadAllCases();
  if (options.caseId) {
    cases = cases.filter((c) => c.id === options.caseId);
  }
  if (options.category) {
    cases = cases.filter((c) => c.category === options.category);
  }
  if (options.promptId) {
    cases = cases.filter((c) => c.promptId === options.promptId);
  }

  if (cases.length === 0) {
    console.error("未找到符合筛选条件的评测用例！");
    process.exit(1);
  }

  // 2. 初始化 AI 客户端（用于 Schema 解析和可能的在线请求）
  const configPath = path.resolve("data/ai-service-config.json");
  const aiConfig = await loadAiServiceConfig({ configPath, environment: process.env });
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";

  const openAiClient = createOpenAiClient({
    getAiServiceConfig: () => aiConfig,
    getAiApiKey: () => apiKey,
    getAiPromptOverrides: () => ({})
  });

  const schemaResolver = (schemaName) => openAiClient.resolveDraftSchema(schemaName);

  // 3. 执行评测
  const evalResults = [];
  const startTime = Date.now();

  if (options.mode === "live") {
    if (!apiKey) {
      console.warn("⚠️  警告: 未检测到 OPENAI_API_KEY 或 AI_API_KEY 环境变量！");
      console.warn("   在线评测需要配置大模型服务密钥。若仅验证本地黄金基准，请使用默认模式（无需参数）。\n");
    }

    console.log(`🚀 开始大模型在线生成与评测 (端点: ${aiConfig.baseUrl}, 模型: ${aiConfig.model}, 共 ${cases.length} 条用例)...`);
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      const caseStart = Date.now();
      process.stdout.write(`  [${i + 1}/${cases.length}] 请求 AI 生成: ${c.id} (${c.name})... `);
      let output;
      let latencyMs = 0;
      let error = null;

      try {
        output = await openAiClient.callOpenAi(c.input, {});
        latencyMs = Date.now() - caseStart;
        process.stdout.write(`✓ 耗时 ${latencyMs}ms\n`);
      } catch (err) {
        latencyMs = Date.now() - caseStart;
        error = err;
        process.stdout.write(`✗ 失败: ${err.message}\n`);
      }

      if (output) {
        const evalItem = evaluateCase(c, output, schemaResolver);
        evalItem.latencyMs = latencyMs;
        evalResults.push(evalItem);
      } else {
        evalResults.push({
          caseId: c.id,
          promptId: c.promptId,
          category: c.category,
          schema: c.schema,
          name: c.name,
          passed: false,
          score: 0,
          latencyMs,
          metrics: {
            schemaValid: false,
            schemaErrors: [error?.message || "AI 生成失败"],
            citationValid: false,
            citationErrors: [],
            citedReferences: [],
            fieldCompleteness: 0,
            fieldErrors: ["AI 未能成功生成输出"],
            semanticValid: false,
            semanticErrors: []
          },
          errors: [`[生成失败] ${error?.message || "未知异常"}`]
        });
      }
    }
  } else {
    // 默认或基准离线评测模式：直接评测 30 条黄金参考数据与预期指标
    for (const c of cases) {
      const evalItem = evaluateCase(c, c.goldenReference, schemaResolver);
      evalResults.push(evalItem);
    }
  }

  const durationMs = Date.now() - startTime;
  const aggregated = aggregateResults(evalResults);
  aggregated.durationMs = durationMs;
  aggregated.mode = options.mode;

  // 4. 输出报告
  if (options.format === "json") {
    console.log(JSON.stringify(aggregated, null, 2));
  } else {
    const reportText = formatConsoleReport(aggregated, {
      mode: options.mode === "live" ? `在线大模型 (${aiConfig.model})` : "基准离线评测 (黄金用例库)"
    });
    console.log(reportText);
  }

  // 5. 保存报告文件（若传入 --save）
  if (options.save) {
    const resultsDir = path.resolve("eval/results");
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `eval-report-${options.mode}-${timestamp}.json`;
    const fullPath = path.join(resultsDir, filename);
    fs.writeFileSync(fullPath, JSON.stringify(aggregated, null, 2), "utf8");
    console.log(`\n💾 详细评测报告已持久化保存至: ${fullPath}`);
  }

  // 如果综合通过率低于 60%，返回非零退出码（仅供自动化脚本检测）
  if (aggregated.overallPassRate < 60) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("评测脚本运行异常:", err);
  process.exit(1);
});
