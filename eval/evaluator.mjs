/**
 * 作战概念 AI 提示词质量与输出评测核心引擎
 * 提供：
 * 1. 结构合法率（Schema 校验）
 * 2. 引用合法率（无捏造/幻觉证据，溯源闭环）
 * 3. 关键字段完整率（必填字段、集合长度、文本长度）
 * 4. 语义质量与黑白名单核验
 * 5. 综合评测与分类/提示词多维聚合
 */

import { validateSchema } from "../shared/schemaValidator.js";

/**
 * 递归深度提取输出中的全部证据引用标识符与标题
 */
export function extractCitations(output) {
  const cited = new Set();
  if (!output || typeof output !== "object") return [];

  function walk(val) {
    if (!val) return;
    if (typeof val === "string") {
      // 提取形如 [ev-01]、[ref-xxx]、ev-01 的证据标识
      const idMatches = val.matchAll(/\[?(ev-\d+|ref-[a-zA-Z0-9_-]+)\]?/gi);
      for (const m of idMatches) {
        if (m[1]) cited.add(m[1].toLowerCase());
      }
      return;
    }
    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === "string") {
          // 检查是否本身就是引用 ID 或包含 ID
          const trimmed = item.trim();
          if (/^ev-\d+$/i.test(trimmed) || /^ref-[a-zA-Z0-9_-]+$/i.test(trimmed)) {
            cited.add(trimmed.toLowerCase());
          } else {
            walk(item);
          }
        } else {
          walk(item);
        }
      }
      return;
    }
    if (typeof val === "object") {
      // 常见引用字段：citations, evidenceRefs
      if (Array.isArray(val.citations)) {
        for (const c of val.citations) {
          if (typeof c === "string") cited.add(c.trim().toLowerCase());
          else if (c && typeof c === "object") {
            const cid = c.id || c.citationId || c.sourceId || c.title;
            if (cid) cited.add(String(cid).trim().toLowerCase());
          }
        }
      }
      if (Array.isArray(val.evidenceRefs)) {
        for (const ref of val.evidenceRefs) {
          if (typeof ref === "string") cited.add(ref.trim().toLowerCase());
        }
      }
      for (const key of Object.keys(val)) {
        if (key !== "citations" && key !== "evidenceRefs") {
          walk(val[key]);
        }
      }
    }
  }

  walk(output);
  return Array.from(cited);
}

/**
 * 从输入中提取允许引用的合法证据白名单集合
 */
export function extractAllowedEvidence(input) {
  const allowedIds = new Set();
  const allowedTitles = new Set();
  const rawEvidence = [];

  if (!input || typeof input !== "object") {
    return { allowedIds, allowedTitles, rawEvidence };
  }

  const pools = [
    input.evidence,
    input.knowledgeReferences,
    input.analysis?.evidence,
    input.analysis?.knowledgeReferences
  ];

  for (const pool of pools) {
    if (Array.isArray(pool)) {
      for (const item of pool) {
        if (!item) continue;
        rawEvidence.push(item);
        if (typeof item === "string") {
          allowedIds.add(item.trim().toLowerCase());
          allowedTitles.add(item.trim().toLowerCase());
        } else if (typeof item === "object") {
          if (item.id) allowedIds.add(String(item.id).trim().toLowerCase());
          if (item.sourceId) allowedIds.add(String(item.sourceId).trim().toLowerCase());
          if (item.title) allowedTitles.add(String(item.title).trim().toLowerCase());
          if (item.name) allowedTitles.add(String(item.name).trim().toLowerCase());
        }
      }
    }
  }

  return { allowedIds, allowedTitles, rawEvidence };
}

/**
 * 校验引用合法率：绝不允许捏造或引用输入范围之外的虚构证据
 */
export function checkCitationValidity(output, input, expectedAssertions = {}) {
  const { allowedIds, allowedTitles, rawEvidence } = extractAllowedEvidence(input);
  const citedReferences = extractCitations(output);
  const invalidCitations = [];

  for (const ref of citedReferences) {
    const isIdMatch = allowedIds.has(ref);
    const isTitleMatch = allowedTitles.has(ref);
    if (!isIdMatch && !isTitleMatch) {
      invalidCitations.push(ref);
    }
  }

  // 若用例明确声明需要证据引用但输出未给出任何引用且输入池非空
  let missedRequiredCitations = false;
  if (expectedAssertions.requireCitations && rawEvidence.length > 0 && citedReferences.length === 0) {
    missedRequiredCitations = true;
  }

  const valid = invalidCitations.length === 0 && !missedRequiredCitations;
  const errors = [];
  if (invalidCitations.length > 0) {
    errors.push(`发现 ${invalidCitations.length} 个未声明或虚构的证据引用（幻觉引用）: ${invalidCitations.join(", ")}`);
  }
  if (missedRequiredCitations) {
    errors.push("用例要求提供证据溯源引用，但输出未包含任何合法证据引用");
  }

  return {
    valid,
    citedReferences,
    invalidCitations,
    allowedCount: rawEvidence.length,
    errors
  };
}

/**
 * 校验关键字段完整率：
 * 包含必填字段完整性、集合元素最小数量、文本最小长度
 */
export function checkFieldCompleteness(output, expectedAssertions = {}) {
  const requiredFields = Array.isArray(expectedAssertions.requiredFields) ? expectedAssertions.requiredFields : [];
  const minCounts = expectedAssertions.minCounts && typeof expectedAssertions.minCounts === "object" ? expectedAssertions.minCounts : {};
  const minLengths = expectedAssertions.minLengths && typeof expectedAssertions.minLengths === "object" ? expectedAssertions.minLengths : {};

  let totalChecks = 0;
  let passedChecks = 0;
  const missingFields = [];
  const errors = [];

  // 1. 必填字段存在且非空
  for (const field of requiredFields) {
    totalChecks++;
    const val = output ? output[field] : undefined;
    if (val === undefined || val === null || val === "") {
      missingFields.push(field);
      errors.push(`关键必填字段缺失: [${field}]`);
    } else if (Array.isArray(val) && val.length === 0) {
      missingFields.push(field);
      errors.push(`关键必填集合为空数组: [${field}]`);
    } else if (typeof val === "object" && !Array.isArray(val) && Object.keys(val).length === 0) {
      missingFields.push(field);
      errors.push(`关键必填对象为空: [${field}]`);
    } else {
      passedChecks++;
    }
  }

  // 2. 集合元素最小数量核查
  for (const [key, minCount] of Object.entries(minCounts)) {
    totalChecks++;
    const arr = output ? output[key] : undefined;
    if (Array.isArray(arr) && arr.length >= minCount) {
      passedChecks++;
    } else {
      const actual = Array.isArray(arr) ? arr.length : 0;
      errors.push(`集合 [${key}] 数量不足: 期望至少 ${minCount} 项，实际为 ${actual} 项`);
    }
  }

  // 3. 文本最小长度核查
  for (const [key, minLen] of Object.entries(minLengths)) {
    totalChecks++;
    const str = output ? output[key] : undefined;
    if (typeof str === "string" && str.trim().length >= minLen) {
      passedChecks++;
    } else {
      const actual = typeof str === "string" ? str.trim().length : 0;
      errors.push(`文本字段 [${key}] 长度不足: 期望至少 ${minLen} 字符，实际为 ${actual} 字符`);
    }
  }

  const rate = totalChecks > 0 ? passedChecks / totalChecks : 1.0;
  return {
    rate: Number(rate.toFixed(4)),
    passedChecks,
    totalChecks,
    missingFields,
    errors
  };
}

/**
 * 校验语义质量：必须包含的关键词白名单与严禁包含的违禁词黑名单
 */
export function checkSemanticQuality(output, expectedAssertions = {}) {
  const keywords = Array.isArray(expectedAssertions.keywords) ? expectedAssertions.keywords : [];
  const negativeKeywords = Array.isArray(expectedAssertions.negativeKeywords) ? expectedAssertions.negativeKeywords : [];

  const text = JSON.stringify(output || {});
  const missingKeywords = [];
  const violatingKeywords = [];

  for (const kw of keywords) {
    if (!text.includes(kw)) {
      missingKeywords.push(kw);
    }
  }

  for (const nkw of negativeKeywords) {
    if (text.includes(nkw)) {
      violatingKeywords.push(nkw);
    }
  }

  const valid = missingKeywords.length === 0 && violatingKeywords.length === 0;
  const errors = [];
  if (missingKeywords.length > 0) {
    errors.push(`缺失期望的核心语义关键词: ${missingKeywords.join(", ")}`);
  }
  if (violatingKeywords.length > 0) {
    errors.push(`命中违规或未就绪词条（黑名单）: ${violatingKeywords.join(", ")}`);
  }

  return {
    valid,
    missingKeywords,
    violatingKeywords,
    errors
  };
}

/**
 * 评测单条用例与输出
 */
export function evaluateCase(caseItem, output, schemaResolver) {
  if (!caseItem || !caseItem.id) {
    throw new Error("评测用例必须包含有效的 id");
  }

  // 1. 结构合法性校验 (Schema Validity)
  const targetSchemaName = caseItem.schema || caseItem.input?.workflow?.outputSchema || "";
  const targetSchema = typeof schemaResolver === "function" ? schemaResolver(targetSchemaName) : undefined;
  const schemaResult = targetSchema ? validateSchema(output, targetSchema) : { valid: true, errors: [] };

  // 2. 引用合法性校验 (Citation Validity)
  const citationResult = checkCitationValidity(output, caseItem.input, caseItem.expectedAssertions);

  // 3. 关键字段完整率 (Field Completeness)
  const completenessResult = checkFieldCompleteness(output, caseItem.expectedAssertions);

  // 4. 语义质量校验 (Semantic Quality)
  const semanticResult = checkSemanticQuality(output, caseItem.expectedAssertions);

  // 5. 综合判定与打分 (权重：结构 30%，引用 20%，完整率 30%，语义 20%)
  const schemaScore = schemaResult.valid ? 30 : 0;
  const citationScore = citationResult.valid ? 20 : 0;
  const completenessScore = Math.round(completenessResult.rate * 30);
  const semanticScore = semanticResult.valid ? 20 : 0;
  const totalScore = schemaScore + citationScore + completenessScore + semanticScore;

  const passed = schemaResult.valid && citationResult.valid && completenessResult.rate === 1.0 && semanticResult.valid;
  const allErrors = [
    ...schemaResult.errors.map((e) => `[结构错误] ${e}`),
    ...citationResult.errors.map((e) => `[引用错误] ${e}`),
    ...completenessResult.errors.map((e) => `[完整性错误] ${e}`),
    ...semanticResult.errors.map((e) => `[语义错误] ${e}`)
  ];

  return {
    caseId: caseItem.id,
    promptId: caseItem.promptId,
    category: caseItem.category,
    schema: targetSchemaName,
    name: caseItem.name,
    passed,
    score: totalScore,
    metrics: {
      schemaValid: schemaResult.valid,
      schemaErrors: schemaResult.errors,
      citationValid: citationResult.valid,
      citationErrors: citationResult.errors,
      citedReferences: citationResult.citedReferences,
      fieldCompleteness: completenessResult.rate,
      fieldErrors: completenessResult.errors,
      semanticValid: semanticResult.valid,
      semanticErrors: semanticResult.errors
    },
    errors: allErrors
  };
}

/**
 * 聚合多条用例的评测结果，产出多维度统计指标
 */
export function aggregateResults(evalResults = []) {
  const totalCases = evalResults.length;
  if (totalCases === 0) {
    return {
      totalCases: 0,
      passedCases: 0,
      overallPassRate: 0,
      schemaValidityRate: 0,
      citationValidityRate: 0,
      fieldCompletenessRate: 0,
      semanticValidityRate: 0,
      averageScore: 0,
      byCategory: {},
      byPrompt: {},
      results: []
    };
  }

  let passedCases = 0;
  let schemaValidCount = 0;
  let citationValidCount = 0;
  let semanticValidCount = 0;
  let completenessSum = 0;
  let totalScoreSum = 0;

  const byCategory = {};
  const byPrompt = {};

  for (const res of evalResults) {
    if (res.passed) passedCases++;
    if (res.metrics.schemaValid) schemaValidCount++;
    if (res.metrics.citationValid) citationValidCount++;
    if (res.metrics.semanticValid) semanticValidCount++;
    completenessSum += res.metrics.fieldCompleteness;
    totalScoreSum += res.score;

    // 分类统计
    const cat = res.category || "unknown";
    if (!byCategory[cat]) {
      byCategory[cat] = { total: 0, passed: 0, schemaValid: 0, citationValid: 0, completenessSum: 0, scoreSum: 0 };
    }
    byCategory[cat].total++;
    if (res.passed) byCategory[cat].passed++;
    if (res.metrics.schemaValid) byCategory[cat].schemaValid++;
    if (res.metrics.citationValid) byCategory[cat].citationValid++;
    byCategory[cat].completenessSum += res.metrics.fieldCompleteness;
    byCategory[cat].scoreSum += res.score;

    // 提示词统计
    const pId = res.promptId || "unknown";
    if (!byPrompt[pId]) {
      byPrompt[pId] = { total: 0, passed: 0, schemaValid: 0, citationValid: 0, completenessSum: 0, scoreSum: 0 };
    }
    byPrompt[pId].total++;
    if (res.passed) byPrompt[pId].passed++;
    if (res.metrics.schemaValid) byPrompt[pId].schemaValid++;
    if (res.metrics.citationValid) byPrompt[pId].citationValid++;
    byPrompt[pId].completenessSum += res.metrics.fieldCompleteness;
    byPrompt[pId].scoreSum += res.score;
  }

  // 格式化分类统计
  const formattedCategory = {};
  for (const [cat, data] of Object.entries(byCategory)) {
    formattedCategory[cat] = {
      total: data.total,
      passed: data.passed,
      passRate: Number(((data.passed / data.total) * 100).toFixed(1)),
      schemaValidityRate: Number(((data.schemaValid / data.total) * 100).toFixed(1)),
      citationValidityRate: Number(((data.citationValid / data.total) * 100).toFixed(1)),
      fieldCompletenessRate: Number(((data.completenessSum / data.total) * 100).toFixed(1)),
      averageScore: Number((data.scoreSum / data.total).toFixed(1))
    };
  }

  // 格式化提示词统计
  const formattedPrompt = {};
  for (const [pId, data] of Object.entries(byPrompt)) {
    formattedPrompt[pId] = {
      total: data.total,
      passed: data.passed,
      passRate: Number(((data.passed / data.total) * 100).toFixed(1)),
      schemaValidityRate: Number(((data.schemaValid / data.total) * 100).toFixed(1)),
      citationValidityRate: Number(((data.citationValid / data.total) * 100).toFixed(1)),
      fieldCompletenessRate: Number(((data.completenessSum / data.total) * 100).toFixed(1)),
      averageScore: Number((data.scoreSum / data.total).toFixed(1))
    };
  }

  return {
    totalCases,
    passedCases,
    overallPassRate: Number(((passedCases / totalCases) * 100).toFixed(1)),
    schemaValidityRate: Number(((schemaValidCount / totalCases) * 100).toFixed(1)),
    citationValidityRate: Number(((citationValidCount / totalCases) * 100).toFixed(1)),
    fieldCompletenessRate: Number(((completenessSum / totalCases) * 100).toFixed(1)),
    semanticValidityRate: Number(((semanticValidCount / totalCases) * 100).toFixed(1)),
    averageScore: Number((totalScoreSum / totalCases).toFixed(1)),
    byCategory: formattedCategory,
    byPrompt: formattedPrompt,
    results: evalResults
  };
}

/**
 * 格式化控制台输出报告
 */
export function formatConsoleReport(aggregated, options = {}) {
  const lines = [];
  const divider = "═".repeat(78);
  const thinDivider = "─".repeat(78);

  lines.push(divider);
  lines.push("           ⚔️  作战概念 AI 提示词质量与输出评测报告 (T5.3) ⚔️");
  lines.push(divider);
  lines.push(`评测模式: ${options.mode || "基准离线评测"}  |  用例总数: ${aggregated.totalCases}  |  时间: ${new Date().toISOString()}`);
  lines.push(thinDivider);

  // 表格明细
  lines.push(
    "用例 ID".padEnd(20) +
    "类别".padEnd(10) +
    "结构合法".padEnd(10) +
    "引用合法".padEnd(10) +
    "字段完整".padEnd(10) +
    "得分".padEnd(8) +
    "判定"
  );
  lines.push(thinDivider);

  for (const r of aggregated.results) {
    const status = r.passed ? "✓ PASS" : "✗ FAIL";
    const schemaMark = r.metrics.schemaValid ? "✓ 100%" : "✗ 0%";
    const citMark = r.metrics.citationValid ? "✓ 100%" : "✗ 0%";
    const compMark = `${(r.metrics.fieldCompleteness * 100).toFixed(0)}%`;
    lines.push(
      r.caseId.padEnd(20) +
      r.category.padEnd(10) +
      schemaMark.padEnd(10) +
      citMark.padEnd(10) +
      compMark.padEnd(10) +
      String(r.score).padEnd(8) +
      status
    );
  }

  lines.push(thinDivider);
  lines.push("【按研究分类统计】");
  for (const [cat, data] of Object.entries(aggregated.byCategory)) {
    lines.push(
      `  • [${cat.padEnd(10)}] 用例: ${data.total} | 通过: ${data.passed} (${data.passRate}%) | 结构: ${data.schemaValidityRate}% | 引用: ${data.citationValidityRate}% | 完整率: ${data.fieldCompletenessRate}% | 均分: ${data.averageScore}`
    );
  }

  lines.push(thinDivider);
  lines.push("【核心指标汇总 (KPI Summary)】");
  lines.push(`  ★ 结构合法率 (Schema Validity Rate):    ${aggregated.schemaValidityRate}%  (${aggregated.schemaValidityRate === 100 ? "达标" : "需整改"})`);
  lines.push(`  ★ 引用合法率 (Citation Validity Rate):  ${aggregated.citationValidityRate}%  (零虚构/零幻觉)`);
  lines.push(`  ★ 关键字段完整率 (Field Completeness):  ${aggregated.fieldCompletenessRate}%`);
  lines.push(`  ★ 语义质量达标率 (Semantic Validity):   ${aggregated.semanticValidityRate}%`);
  lines.push(`  ★ 综合总通过率 (Overall Pass Rate):     ${aggregated.overallPassRate}%  (${aggregated.passedCases}/${aggregated.totalCases})`);
  lines.push(`  ★ 全局平均评分 (Average Score):         ${aggregated.averageScore} / 100 分`);
  lines.push(divider);

  return lines.join("\n");
}
