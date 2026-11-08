import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  extractCitations,
  extractAllowedEvidence,
  checkCitationValidity,
  checkFieldCompleteness,
  checkSemanticQuality,
  evaluateCase,
  aggregateResults,
  formatConsoleReport
} from "../eval/evaluator.mjs";
import { loadAllCases } from "../eval/caseLoader.mjs";
import { createOpenAiClient } from "../server/openaiClient.mjs";

console.log("=== 1. 证据引用提取与引用合法率校验 ===");
{
  const mockInput = {
    evidence: [
      { id: "ev-01", title: "多源协同探测机理.md" },
      { id: "ev-02", title: "超视距雷达跳频分析.md" }
    ]
  };

  const allowed = extractAllowedEvidence(mockInput);
  assert.equal(allowed.rawEvidence.length, 2);
  assert.ok(allowed.allowedIds.has("ev-01"));
  assert.ok(allowed.allowedIds.has("ev-02"));
  assert.ok(allowed.allowedTitles.has("多源协同探测机理.md"));

  // 场景 A: 合法引用（通过 ID 或标题）
  const validOutput = {
    summary: "依据 [ev-01] 的研究，多源协同能够有效提升抗干扰裕度。",
    citations: ["ev-01"],
    details: {
      evidenceRefs: ["多源协同探测机理.md"]
    }
  };
  const cited = extractCitations(validOutput);
  assert.ok(cited.includes("ev-01"));
  const validCheck = checkCitationValidity(validOutput, mockInput);
  assert.equal(validCheck.valid, true, "合法引用必须通过校验");
  assert.equal(validCheck.invalidCitations.length, 0);

  // 场景 B: 幻觉引用（捏造未在输入中声明的证据 ID）
  const invalidOutput = {
    summary: "依据 [ev-99] 捏造的资料分析...",
    citations: ["ev-99", "ev-01"]
  };
  const invalidCheck = checkCitationValidity(invalidOutput, mockInput);
  assert.equal(invalidCheck.valid, false, "包含虚构引用的输出必须判定不合法");
  assert.ok(invalidCheck.invalidCitations.includes("ev-99"));
  assert.ok(invalidCheck.errors[0].includes("幻觉引用"));

  console.log("✓ 引用提取与零幻觉溯源校验逻辑验证通过");
}

console.log("=== 2. 关键字段完整率校验 ===");
{
  const assertions = {
    requiredFields: ["title", "summary", "actions"],
    minCounts: { actions: 2 },
    minLengths: { summary: 10 }
  };

  // 场景 A: 完美满足
  const fullOutput = {
    title: "战术行动方案",
    summary: "这是一段超过十个字符的战术行动摘要内容描述",
    actions: ["行动1", "行动2"]
  };
  const resFull = checkFieldCompleteness(fullOutput, assertions);
  assert.equal(resFull.rate, 1.0);
  assert.equal(resFull.missingFields.length, 0);

  // 场景 B: 字段缺失与数量不足
  const partialOutput = {
    title: "战术行动方案",
    summary: "短摘要", // 长度不足 10
    actions: ["仅1项行动"] // 数量不足 2 (需2)
    // missing: actions is incomplete, required field 'other' not here
  };
  const resPartial = checkFieldCompleteness(partialOutput, assertions);
  assert.ok(resPartial.rate < 1.0, "存在缺陷时完整率应小于 1.0");
  assert.equal(resPartial.passedChecks, 3, "requiredFields 3 项通过，约束 2 项未达标");
  assert.equal(resPartial.totalChecks, 5);
  assert.equal(resPartial.rate, 0.6);
  assert.equal(resPartial.errors.length, 2);

  console.log("✓ 关键字段与集合最小约束完整率校验通过");
}

console.log("=== 3. 语义质量白名单与违禁词黑名单核查 ===");
{
  const assertions = {
    keywords: ["多域协同", "压制"],
    negativeKeywords: ["经纬度", "由于缺乏前置上下文"]
  };

  // 场景 A: 白名单全覆盖且无黑名单
  const goodText = { summary: "在多域协同作战中，实施强电磁压制并摧毁关键制导节点" };
  const goodCheck = checkSemanticQuality(goodText, assertions);
  assert.equal(goodCheck.valid, true);

  // 场景 B: 包含违禁词（经纬度敏感词）
  const badText = { summary: "在多域协同作战中，提供东经120度北纬25度的真实经纬度坐标" };
  const badCheck = checkSemanticQuality(badText, assertions);
  assert.equal(badCheck.valid, false);
  assert.ok(badCheck.violatingKeywords.includes("经纬度"));

  console.log("✓ 语义质量与概念工具安全边界检查通过");
}

console.log("=== 4. 黄金用例综合评测与指标聚合 ===");
{
  const client = createOpenAiClient({ getAiServiceConfig: () => ({}), getAiApiKey: () => "" });
  const cases = loadAllCases();
  assert.equal(cases.length, 30, "黄金用例库应包含 30 条基准用例");

  const results = cases.map((c) => evaluateCase(c, c.goldenReference, (s) => client.resolveDraftSchema(s)));
  assert.equal(results.length, 30);

  const agg = aggregateResults(results);
  assert.equal(agg.totalCases, 30);
  assert.equal(agg.passedCases, 30, "全量 30 条黄金基准用例应 100% 达成各项指标");
  assert.equal(agg.schemaValidityRate, 100);
  assert.equal(agg.citationValidityRate, 100);
  assert.equal(agg.fieldCompletenessRate, 100);
  assert.equal(agg.semanticValidityRate, 100);
  assert.equal(agg.overallPassRate, 100);
  assert.equal(agg.averageScore, 100);

  assert.ok(agg.byCategory.tactic);
  assert.ok(agg.byCategory.mechanism);
  assert.ok(agg.byCategory.scenario);

  const reportText = formatConsoleReport(agg, { mode: "单元自检" });
  assert.ok(reportText.includes("结构合法率"));
  assert.ok(reportText.includes("引用合法率"));
  assert.ok(reportText.includes("关键字段完整率"));

  console.log("✓ 30 条黄金用例库多维聚合评估全部达标 (100% PASS)");
}

console.log("=== 5. CLI 脚本入口冒烟检测 ===");
{
  const stdout = execFileSync(process.execPath, ["scripts/eval-prompts.mjs", "--category=tactic", "--case=tactic-brief-01"], {
    encoding: "utf8"
  });
  assert.ok(stdout.includes("tactic-brief-01"));
  assert.ok(stdout.includes("PASS"));
  assert.ok(stdout.includes("100%"));

  console.log("✓ scripts/eval-prompts.mjs CLI 冒烟测试正常");
}

console.log("\n=== T5.3 评测引擎与评测脚本全部通过 (100% PASS) ===");
