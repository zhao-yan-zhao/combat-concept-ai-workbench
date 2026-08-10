export function buildModelComparisonArtifact(type, comparison) {
  const safeComparison = comparison || emptyComparison();
  if (type === "json") {
    return {
      content: JSON.stringify({ version: 1, artifact: "model_comparison", comparison: safeComparison }, null, 2),
      filename: "combat-concept-model-comparison.json",
      mime: "application/json;charset=utf-8",
      label: "模型对比 JSON"
    };
  }
  return {
    content: buildModelComparisonMarkdown(safeComparison),
    filename: "combat-concept-model-comparison.md",
    mime: "text/markdown;charset=utf-8",
    label: "模型对比 Markdown"
  };
}

export function buildModelComparisonMarkdown(comparison) {
  const baseline = comparison?.baseline || {};
  const candidate = comparison?.candidate || {};
  const lines = [
    "# 作战概念模型对比",
    "",
    `- 基准方案：${inline(baseline.label)}（${inline(baseline.direction)}）`,
    `- 对比方案：${inline(candidate.label)}（${inline(candidate.direction)}）`,
    `- 对比结论：${inline(comparison?.summary)}`,
    "",
    "## 指标变化",
    "| 指标 | 基准 | 对比 | 变化 |",
    "| --- | ---: | ---: | --- |",
    ...(comparison?.metrics || []).map((metric) => `| ${cell(metric.label)} | ${metric.before}${cell(metric.unit)} | ${metric.after}${cell(metric.unit)} | ${cell(metric.deltaLabel)} |`),
    "",
    ...renderQuantitativeSection(comparison?.quantitative),
    "",
    "## 结构差异",
    ...(comparison?.changes || []).flatMap((change) => renderChange(change))
  ];
  return lines.join("\n");
}

function renderQuantitativeSection(quantitative) {
  if (!quantitative) return [];
  const baseline = quantitative.baseline || {};
  const candidate = quantitative.candidate || {};
  return [
    "## 量化比较",
    `- 方法：${inline(quantitative.method)}；量表：${inline(quantitative.scale)}`,
    `- 总分：${inline(baseline.label)} ${baseline.total ?? 0} -> ${inline(candidate.label)} ${candidate.total ?? 0}（差值 ${quantitative.delta ?? 0}）`,
    `- 审阅建议：${inline(quantitative.recommendation)}`,
    "| 指标 | 权重 | 基准分 | 对比分 | 自动初评依据 |",
    "| --- | ---: | ---: | ---: | --- |",
    ...(baseline.criteria || []).map((criterion) => {
      const compared = (candidate.criteria || []).find((item) => item.id === criterion.id) || {};
      const manual = criterion.manualScore !== null || compared.manualScore !== null ? "；含人工复核" : "";
      const rationales = [criterion.manualRationale && `基准复核理由：${criterion.manualRationale}`, compared.manualRationale && `对比复核理由：${compared.manualRationale}`].filter(Boolean).join("；");
      return `| ${cell(criterion.label)} | ${criterion.weight}% | ${criterion.score} | ${compared.score ?? 0} | ${cell(`${(criterion.evidence || []).join("；")}${manual}${rationales ? `；${rationales}` : ""}`)} |`;
    }),
    ...renderSensitivity(quantitative.sensitivity),
    ...(quantitative.assumptions || []).map((item) => `- 评分边界：${inline(item)}`)
  ];
}

function renderSensitivity(sensitivity) {
  if (!sensitivity) return [];
  return [
    "",
    `- 权重敏感性：${inline(sensitivity.note || "未分析")}`,
    ...(sensitivity.scenarios || []).map((scenario) => `  - 强调 ${inline(scenario.label)}：${scenario.baselineTotal} -> ${scenario.candidateTotal}（${scenario.winner}）`)
  ];
}

function renderChange(change) {
  const lines = [`### ${inline(change.label)}`];
  if (change.added?.length) lines.push(`- 新增：${change.added.map(inline).join("；")}`);
  if (change.removed?.length) lines.push(`- 移除：${change.removed.map(inline).join("；")}`);
  if (change.changed?.length) lines.push(`- 调整：${change.changed.map(inline).join("；")}`);
  if (lines.length === 1) lines.push("- 无结构差异");
  return lines;
}

function emptyComparison() {
  return { baseline: {}, candidate: {}, summary: "未生成模型对比", metrics: [], changes: [] };
}

function inline(value) {
  return String(value || "未提供").replace(/[|\r\n]/g, " ");
}

function cell(value) {
  return inline(value).replace(/\|/g, "\\|");
}
