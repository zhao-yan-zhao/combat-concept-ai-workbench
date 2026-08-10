export const QUANTITATIVE_CRITERIA = [
  { id: "missionFit", label: "任务适配度", weight: 16 },
  { id: "coordination", label: "体系协同度", weight: 14 },
  { id: "feasibility", label: "可实施性", weight: 12 },
  { id: "riskControl", label: "风险可控性", weight: 14 },
  { id: "resourceAffordability", label: "资源可承受性", weight: 10 },
  { id: "timeWindow", label: "时间窗口适配度", weight: 12 },
  { id: "resilience", label: "对手反制韧性", weight: 12 },
  { id: "reportCompleteness", label: "成果表达完整度", weight: 10 }
];

export function createQuantitativeSettings(value = {}) {
  const sourceWeights = value.weights || {};
  const rawWeights = QUANTITATIVE_CRITERIA.map((criterion) => ({
    ...criterion,
    weight: boundedNumber(sourceWeights[criterion.id], criterion.weight)
  }));
  const totalWeight = rawWeights.reduce((total, item) => total + item.weight, 0);
  const weights = rawWeights.map((item) => ({
    ...item,
    weight: totalWeight ? Number((item.weight / totalWeight * 100).toFixed(2)) : Number((100 / rawWeights.length).toFixed(2))
  }));
  return {
    method: "weighted-score-v1",
    weights: Object.fromEntries(weights.map((item) => [item.id, item.weight])),
    manualScores: normalizeManualScores(value.manualScores),
    manualRationales: normalizeManualRationales(value.manualRationales)
  };
}

export function scoreSchemeSnapshot(snapshot, settings = {}) {
  const normalizedSettings = createQuantitativeSettings(settings);
  const model = snapshot?.model || {};
  const automatic = calculateAutomaticScores(model);
  const manual = normalizedSettings.manualScores[snapshot?.id] || {};
  const rationales = normalizedSettings.manualRationales[snapshot?.id] || {};
  const criteria = QUANTITATIVE_CRITERIA.map((definition) => {
    const automaticScore = automatic[definition.id] || { score: 0, evidence: ["缺少可复核模型数据"] };
    const manualScore = manual[definition.id];
    const score = Number.isFinite(manualScore) ? manualScore : automaticScore.score;
    const weight = normalizedSettings.weights[definition.id];
    return {
      id: definition.id,
      label: definition.label,
      weight,
      automaticScore: automaticScore.score,
      manualScore: Number.isFinite(manualScore) ? manualScore : null,
      manualRationale: Number.isFinite(manualScore) ? rationales[definition.id] || "" : "",
      score,
      weightedScore: Number((score * weight / 100).toFixed(2)),
      evidence: automaticScore.evidence
    };
  });
  const total = Number(criteria.reduce((sum, item) => sum + item.weightedScore, 0).toFixed(2));
  return {
    id: snapshot?.id || "",
    label: snapshot?.label || "未命名方案",
    direction: snapshot?.direction || "",
    total,
    criteria,
    manualReviewCount: criteria.filter((item) => item.manualScore !== null).length
  };
}

export function buildQuantitativeComparison(baseline, candidate, settings = {}) {
  const normalizedSettings = createQuantitativeSettings(settings);
  const baselineScore = scoreSchemeSnapshot(baseline, normalizedSettings);
  const candidateScore = scoreSchemeSnapshot(candidate, normalizedSettings);
  const delta = Number((candidateScore.total - baselineScore.total).toFixed(2));
  const winner = delta > 0.01 ? "candidate" : delta < -0.01 ? "baseline" : "tie";
  return {
    method: normalizedSettings.method,
    scale: "0-100",
    weights: QUANTITATIVE_CRITERIA.map((criterion) => ({ id: criterion.id, label: criterion.label, weight: normalizedSettings.weights[criterion.id] })),
    baseline: baselineScore,
    candidate: candidateScore,
    delta,
    winner,
    sensitivity: buildWeightSensitivity(baselineScore, candidateScore, winner),
    recommendation: buildRecommendation(baselineScore, candidateScore, winner, delta),
    assumptions: [
      "自动初评仅复用冻结快照中的验证、结构与追溯信息。",
      "人工复核分覆盖自动初评，权重会归一化至 100%。",
      "该比较不替代专家判断、推演或现实世界仿真。"
    ]
  };
}

function buildWeightSensitivity(baseline, candidate, referenceWinner) {
  const scenarios = baseline.criteria.map((criterion) => {
    const weights = emphasizeWeight(baseline.criteria, criterion.id, 15);
    const baselineTotal = weightedTotal(baseline.criteria, weights);
    const candidateTotal = weightedTotal(candidate.criteria, weights);
    const delta = Number((candidateTotal - baselineTotal).toFixed(2));
    const winner = delta > 0.01 ? "candidate" : delta < -0.01 ? "baseline" : "tie";
    return { criterionId: criterion.id, label: criterion.label, weights, baselineTotal, candidateTotal, delta, winner };
  });
  const flips = scenarios.filter((scenario) => scenario.winner !== referenceWinner);
  return {
    method: "one-at-a-time-weight-plus-15pp-v1",
    emphasisPoints: 15,
    stable: flips.length === 0,
    flipCount: flips.length,
    scenarios,
    note: flips.length ? `强调 ${flips.length} 个指标时排名会变化；应复核这些指标的权重与人工评分。` : "逐项强调任一指标 15 个百分点后，当前排名保持不变。"
  };
}

function emphasizeWeight(criteria, focusedId, emphasisPoints) {
  const current = Object.fromEntries(criteria.map((criterion) => [criterion.id, Number(criterion.weight) || 0]));
  const focused = Math.min(100, current[focusedId] + emphasisPoints);
  const remaining = Math.max(0, 100 - focused);
  const otherIds = criteria.map((criterion) => criterion.id).filter((id) => id !== focusedId);
  const otherTotal = otherIds.reduce((sum, id) => sum + current[id], 0);
  const weights = { [focusedId]: focused };
  let allocated = 0;
  otherIds.forEach((id, index) => {
    const isLast = index === otherIds.length - 1;
    const weight = isLast
      ? Number((remaining - allocated).toFixed(2))
      : Number(((otherTotal ? current[id] / otherTotal * remaining : remaining / Math.max(1, otherIds.length))).toFixed(2));
    weights[id] = weight;
    allocated += weight;
  });
  return weights;
}

function weightedTotal(criteria, weights) {
  return Number(criteria.reduce((total, criterion) => total + criterion.score * (weights[criterion.id] || 0) / 100, 0).toFixed(2));
}

function calculateAutomaticScores(model) {
  const validation = model.validation || {};
  const scores = new Map((validation.scores || []).map((item) => [item.label, boundedNumber(item.score, 0)]));
  const issues = Array.isArray(validation.issues) ? validation.issues : [];
  const highIssues = issues.filter((item) => item.level === "high").length;
  const mediumIssues = issues.filter((item) => item.level === "medium").length;
  const activities = model.ov5?.activities || [];
  const edges = model.ov5?.edges || [];
  const scenario = model.scenario;
  const traceability = validation.traceabilityDiagnostics || {};
  const oodaDiagnostics = validation.oodaDiagnostics || {};
  const average = validationAverage(validation.scores);
  const scoreByLabel = (label, fallback) => scores.has(label) ? scores.get(label) : fallback;
  const readiness = activities.length ? Math.min(100, 55 + activities.length * 7 + (scenario ? 8 : 0)) : 25;
  const coordination = averageOf([scoreByLabel("活动连通性", 55), scoreByLabel("信息闭环", 55), scoreByLabel("跨视图追溯", traceability.score || 55)]);
  const feasibility = averageOf([readiness, scoreByLabel("OODA 行为完整性", oodaDiagnostics.completenessScore || 50), scenario ? 82 : 42]);
  const riskControl = clamp(100 - highIssues * 18 - mediumIssues * 7);
  const resourceAffordability = scoreScenarioAffordability(scenario, readiness);
  const timeWindow = scoreByLabel("OODA 时效", 50);
  const resilience = scoreByLabel("OODA 韧性", oodaDiagnostics.resilienceScore || 50);
  const reportCompleteness = averageOf([
    activities.length ? 80 : 35,
    edges.length ? 75 : 40,
    traceability.score || 50,
    validation.scores?.length ? 78 : 38
  ]);
  return {
    missionFit: { score: average || readiness, evidence: evidence("验证平均分", average, "活动数", activities.length) },
    coordination: { score: coordination, evidence: evidence("活动连通性", scoreByLabel("活动连通性", 55), "跨视图追溯", scoreByLabel("跨视图追溯", traceability.score || 55)) },
    feasibility: { score: feasibility, evidence: evidence("OODA 完整性", scoreByLabel("OODA 行为完整性", oodaDiagnostics.completenessScore || 50), "想定", scenario ? "已生成" : "未生成") },
    riskControl: { score: riskControl, evidence: evidence("高优先级问题", highIssues, "中优先级问题", mediumIssues) },
    resourceAffordability: { score: resourceAffordability, evidence: evidence("部署诊断", scenario?.deploymentPlan?.diagnostics?.length || 0, "想定", scenario ? "已生成" : "未生成") },
    timeWindow: { score: timeWindow, evidence: evidence("OODA 时效", timeWindow, "周期", model.ooda?.durationMinutes || 0) },
    resilience: { score: resilience, evidence: evidence("OODA 韧性", resilience, "红方审阅", validation.redTeamReview ? "已生成" : "待生成") },
    reportCompleteness: { score: reportCompleteness, evidence: evidence("追溯分", traceability.score || 0, "验证指标", validation.scores?.length || 0) }
  };
}

function scoreScenarioAffordability(scenario, readiness) {
  if (!scenario) return Math.min(55, readiness);
  const diagnostics = scenario.deploymentPlan?.diagnostics || [];
  const warningCount = diagnostics.filter((item) => item.status && item.status !== "ready").length;
  return clamp(88 - warningCount * 12);
}

function normalizeManualScores(value) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).map(([snapshotId, scores]) => [
    String(snapshotId),
    Object.fromEntries(QUANTITATIVE_CRITERIA.map((criterion) => [criterion.id, boundedOptional(scores?.[criterion.id])]).filter(([, score]) => score !== null))
  ]));
}

function normalizeManualRationales(value) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).slice(0, 24).map(([snapshotId, rationales]) => [
    String(snapshotId).slice(0, 120),
    Object.fromEntries(QUANTITATIVE_CRITERIA.map((criterion) => [criterion.id, cleanRationale(rationales?.[criterion.id])]).filter(([, rationale]) => rationale))
  ]));
}

function cleanRationale(value) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 600);
}

function buildRecommendation(baseline, candidate, winner, delta) {
  if (winner === "tie") return "两份方案的加权总分接近；应优先复核人工评分与差异指标，而非自动推荐。";
  const preferred = winner === "candidate" ? candidate : baseline;
  const compared = winner === "candidate" ? baseline : candidate;
  const strongest = preferred.criteria.slice().sort((left, right) => right.score - left.score)[0];
  const weakest = preferred.criteria.slice().sort((left, right) => left.score - right.score)[0];
  return `${preferred.label} 当前高出 ${Math.abs(delta).toFixed(2)} 分；优势指标为“${strongest.label}”，仍需优先复核“${weakest.label}”及其评分依据。相对方案：${compared.label}。`;
}

function evidence(...pairs) {
  const values = [];
  for (let index = 0; index < pairs.length; index += 2) values.push(`${pairs[index]}：${pairs[index + 1]}`);
  return values;
}

function validationAverage(scores) {
  const values = (scores || []).map((item) => Number(item.score)).filter(Number.isFinite);
  return values.length ? Math.round(values.reduce((sum, score) => sum + score, 0) / values.length) : 0;
}

function averageOf(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? Math.round(finite.reduce((sum, score) => sum + score, 0) / finite.length) : 0;
}

function boundedNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number) : fallback;
}

function boundedOptional(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number) : null;
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}
