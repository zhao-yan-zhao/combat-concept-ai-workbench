import {
  analyzeNetworkResilience,
  calculateLatencyBudget,
  classifyActivityToOodaLane
} from "./oodaStore.js";

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

export function rankMultiSchemeSnapshots(snapshots = [], settings = {}) {
  const normalizedSettings = createQuantitativeSettings(settings);
  const scoredList = snapshots
    .filter((s) => s && s.model)
    .map((snapshot) => scoreSchemeSnapshot(snapshot, normalizedSettings));

  scoredList.sort((a, b) => b.total - a.total);

  const leader = scoredList[0] || null;
  const rankings = scoredList.map((item, index) => ({
    ...item,
    rank: index + 1,
    isLeader: index === 0 && scoredList.length > 1,
    gapToLeader: leader ? Number((item.total - leader.total).toFixed(2)) : 0
  }));

  return {
    method: "multi-scheme-weighted-rank-v1",
    scale: "0-100",
    leader,
    rankings,
    weights: QUANTITATIVE_CRITERIA.map((criterion) => ({
      id: criterion.id,
      label: criterion.label,
      weight: normalizedSettings.weights[criterion.id]
    }))
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
      "自动初评融合拓扑动力学关键路径、网络抗毁韧性、假设脆弱性与推演实测指标。",
      "人工复核分覆盖自动初评，权重会归一化至 100%。",
      "该比较为多方案优选提供定量机理参考，支撑研究员决策。"
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

/**
 * 消除纯堆叠节点虚高评分，关注 OODA 全要素闭环、输入输出与兵力承接
 */
export function calculateReadinessScore(activities = [], scenario = null) {
  if (!activities.length) return 25;

  // 1. OODA 四阶段覆盖度 (0 - 45分)
  const observedLanes = new Set();
  activities.forEach((act) => {
    const lane = classifyActivityToOodaLane(act);
    if (lane && lane !== "feedback") observedLanes.add(lane);
  });
  const laneCoverageScore = Math.round((Math.min(4, observedLanes.size) / 4) * 45);

  // 2. 节点输入/输出要素完备性 (0 - 25分)
  const completeNodes = activities.filter((a) => {
    const hasIn = a.input && String(a.input).trim() !== "待定义" && !String(a.input).includes("占位");
    const hasOut = a.output && String(a.output).trim() !== "待定义" && !String(a.output).includes("占位");
    return hasIn && hasOut;
  }).length;
  const ioScore = Math.round((completeNodes / Math.max(1, activities.length)) * 25);

  // 3. 兵力承接与执行实体绑定 (0 - 20分)
  const assignedNodes = activities.filter((a) => (Array.isArray(a.assignedForces) && a.assignedForces.length > 0) || a.executor).length;
  const forceScore = Math.round((assignedNodes / Math.max(1, activities.length)) * 20);

  // 4. 想定就绪状态 (0 - 10分)
  const scenarioScore = scenario ? 10 : 0;

  return clamp(laneCoverageScore + ioScore + forceScore + scenarioScore);
}

/**
 * 评估假设前提脆弱性：检测未经证实、缺乏知识依据支撑或高风险低置信度的假设
 */
export function evaluateAssumptionFragility(model = {}) {
  let fragileCount = 0;
  let totalCount = 0;
  const reasons = [];

  // 1. 从 ov5.argumentChain.assumptions 提取
  const argAssumptions = Array.isArray(model.ov5?.argumentChain?.assumptions)
    ? model.ov5.argumentChain.assumptions
    : [];

  argAssumptions.forEach((item) => {
    totalCount++;
    const text = typeof item === "string" ? item : (item.text || item.statement || item.assumption || "");
    const lowConfidence = item.confidence === "low" || item.unverified === true;
    const noEvidence = !item.evidenceRefs || (Array.isArray(item.evidenceRefs) && !item.evidenceRefs.length);
    const textAlert = /未经证实|缺乏依据|强假设|高风险|无预案|低置信度|未复核|假设敌不/i.test(text);

    if (lowConfidence || (noEvidence && textAlert)) {
      fragileCount++;
      reasons.push(text.slice(0, 36));
    }
  });

  // 2. 从 brief.assumptions 提取
  const briefAssumptions = model.brief?.assumptions;
  if (typeof briefAssumptions === "string" && briefAssumptions.trim()) {
    const lines = briefAssumptions.split(/[；;\n]+/).map((s) => s.trim()).filter(Boolean);
    lines.forEach((line) => {
      totalCount++;
      if (/未经证实|缺乏依据|强假设|低置信度|未复核|高风险|假设敌不/i.test(line)) {
        fragileCount++;
        reasons.push(line.slice(0, 36));
      }
    });
  } else if (Array.isArray(briefAssumptions)) {
    briefAssumptions.forEach((item) => {
      totalCount++;
      const text = typeof item === "string" ? item : (item.text || item.label || "");
      if (item.unverified || item.confidence === "low" || /未经证实|缺乏依据|强假设|低置信度/i.test(text)) {
        fragileCount++;
        reasons.push(text.slice(0, 36));
      }
    });
  }

  return { totalCount, fragileCount, reasons };
}

/**
 * 提取推演/仿真运行的定量实测指标 (DES 6项指标与阶段达成率)
 */
export function evaluateSimulationPerformance(model = {}) {
  const scenario = model.scenario;
  if (!scenario) return null;

  // 1. 尝试从 simulation.runs 提取最新完成的运行
  const runs = Array.isArray(scenario.simulation?.runs) ? scenario.simulation.runs : [];
  const latestRun = runs.slice().reverse().find((r) => r.status === "completed" || r.status === "success") || runs[runs.length - 1];

  // 2. 尝试从 simulation.latestResult 或 simulationRecycle 提取
  const result = latestRun?.result || scenario.simulation?.latestResult || scenario.simulationRecycle?.latestResult;
  const metrics = latestRun?.metrics || scenario.simulation?.metrics || result?.metrics;

  if (!latestRun && !result && !metrics) return null;

  let scoreSum = 0;
  let metricCount = 0;

  if (Array.isArray(metrics) && metrics.length) {
    metrics.forEach((m) => {
      metricCount++;
      if (m.status === "compliant" || m.status === "achieved") {
        scoreSum += 100;
      } else if (m.status === "warning" || m.status === "partial") {
        scoreSum += 65;
      } else if (m.status === "violated" || m.status === "blocked") {
        scoreSum += 30;
      } else {
        scoreSum += 70;
      }
    });
  }

  // 阶段成效
  const phaseOutcomes = result?.phaseOutcomes || scenario.simulationRecycle?.phaseOutcomes || [];
  if (Array.isArray(phaseOutcomes) && phaseOutcomes.length) {
    phaseOutcomes.forEach((po) => {
      metricCount++;
      if (po.achievement === "achieved" || po.riskLevel === "low") {
        scoreSum += 100;
      } else if (po.achievement === "partial" || po.riskLevel === "medium") {
        scoreSum += 65;
      } else {
        scoreSum += 35;
      }
    });
  }

  const score = metricCount > 0 ? Math.round(scoreSum / metricCount) : 75;
  return {
    score: clamp(score),
    metricCount,
    hasRun: true
  };
}

/**
 * 计算时间窗口适配度（结合 T8.1 DAG CPM 关键路径时延解算与时敏窗口）
 */
export function evaluateTimeWindowScore(model = {}, fallbackScore = 50) {
  let latencyBudget = model.validation?.oodaDiagnostics?.latencyBudget ||
    model.ooda?.latencyBudget ||
    model.ov5?.latencyBudget;

  if (!latencyBudget && Array.isArray(model.ov5?.activities) && model.ov5.activities.length >= 2) {
    try {
      latencyBudget = calculateLatencyBudget(model.ov5.activities, model.ov5.edges || [], {
        targetWindowSeconds: model.ov5.targetWindowSeconds || 1800
      });
    } catch {}
  }

  if (!latencyBudget || !Number.isFinite(latencyBudget.criticalPathSeconds)) {
    return {
      score: clamp(fallbackScore),
      evidence: evidence("OODA 时效", fallbackScore, "评估依据", "基准结构估算")
    };
  }

  const critical = latencyBudget.criticalPathSeconds;
  const budget = latencyBudget.budgetSeconds || 1800;
  const ratio = Number(latencyBudget.criticalPathRatio) || (critical / Math.max(1, budget));

  let score = 50;
  let statusText = "紧平衡";

  if (ratio <= 0.6) {
    score = clamp(92 + (0.6 - ratio) * 15);
    statusText = "裕度充裕";
  } else if (ratio <= 1.0) {
    score = clamp(65 + (1.0 - ratio) * 65);
    statusText = "窗口内可闭环";
  } else if (ratio <= 1.5) {
    score = clamp(35 + (1.5 - ratio) * 58);
    statusText = "超时临界断链";
  } else {
    score = clamp(Math.max(10, 35 - (ratio - 1.5) * 20));
    statusText = "严重超时断链";
  }

  return {
    score,
    evidence: evidence("CPM关键路径", `${critical}s`, "窗口预算", `${budget}s`, "时延裕度", `${(ratio * 100).toFixed(1)}% (${statusText})`)
  };
}

/**
 * 计算网络抗毁韧性（结合 T8.2 SPOF 割点与网络韧性量化）
 */
export function evaluateResilienceScore(model = {}, fallbackScore = 50) {
  let resilienceAnalysis = model.validation?.oodaDiagnostics?.networkResilience ||
    model.ooda?.networkResilience;

  if (!resilienceAnalysis && Array.isArray(model.ov5?.activities) && model.ov5.activities.length >= 3) {
    try {
      resilienceAnalysis = analyzeNetworkResilience(model.ov5.activities, model.ov5.edges || []);
    } catch {}
  }

  let baseScore = fallbackScore;
  let spofCount = 0;

  if (resilienceAnalysis && Number.isFinite(resilienceAnalysis.resilienceScore)) {
    baseScore = resilienceAnalysis.resilienceScore;
    spofCount = Array.isArray(resilienceAnalysis.criticalSpofs) ? resilienceAnalysis.criticalSpofs.length : 0;
  } else if (Number.isFinite(model.validation?.oodaDiagnostics?.resilienceScore)) {
    baseScore = model.validation.oodaDiagnostics.resilienceScore;
  }

  // 拓扑单点割点（SPOF）惩罚，每个割点扣 4 分
  let finalScore = clamp(baseScore - spofCount * 4);

  // 红队审阅反制成果加减分
  const redTeam = model.validation?.redTeamReview;
  if (redTeam) {
    if (redTeam.status === "passed" || redTeam.passed) {
      finalScore = clamp(finalScore + 6);
    } else if (redTeam.highRiskCount > 0) {
      finalScore = clamp(finalScore - redTeam.highRiskCount * 5);
    }
  }

  return {
    score: finalScore,
    evidence: evidence("网络韧性基准", baseScore, "拓扑SPOF割点", `${spofCount}个`, "红方审阅", redTeam ? "已完成" : "待审阅")
  };
}

export function calculateAutomaticScores(model = {}) {
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

  // 1. 结构要素完备性（消除虚高数量分）
  const readiness = calculateReadinessScore(activities, scenario);

  // 2. 假设脆弱性评估
  const assumptionEvaluation = evaluateAssumptionFragility(model);
  const fragileCount = assumptionEvaluation.fragileCount;

  // 3. 仿真推演实测成效
  const simulationEval = evaluateSimulationPerformance(model);

  // 4. 时延预算与关键路径评分 (T8.1)
  const timeWindowEval = evaluateTimeWindowScore(model, scoreByLabel("OODA 时效", 50));

  // 5. 拓扑抗毁性与 SPOF 韧性评分 (T8.2)
  const resilienceEval = evaluateResilienceScore(model, scoreByLabel("OODA 韧性", oodaDiagnostics.resilienceScore || 50));

  // 6. 任务适配度 (missionFit): 结合结构平均分 + 仿真成效(40%权重)
  let missionFitScore = average || readiness;
  let missionFitEvidence = evidence("验证平均分", average || "待评估", "要素就绪度", readiness);
  if (simulationEval?.hasRun) {
    missionFitScore = clamp(Math.round(missionFitScore * 0.6 + simulationEval.score * 0.4));
    missionFitEvidence = evidence("结构契合分", average || readiness, "仿真实测成效", simulationEval.score);
  }

  // 7. 体系协同度 (coordination)
  const coordinationBase = averageOf([
    scoreByLabel("活动连通性", 55),
    scoreByLabel("信息闭环", 55),
    scoreByLabel("跨视图追溯", traceability.score || 55)
  ]);
  const coordination = simulationEval?.hasRun
    ? clamp(Math.round(coordinationBase * 0.7 + simulationEval.score * 0.3))
    : coordinationBase;

  // 8. 可实施性 (feasibility)
  const feasibilityBase = averageOf([
    readiness,
    scoreByLabel("OODA 行为完整性", oodaDiagnostics.completenessScore || 50),
    scenario ? 82 : 42
  ]);
  const feasibility = simulationEval?.hasRun
    ? clamp(Math.round(feasibilityBase * 0.6 + simulationEval.score * 0.4))
    : feasibilityBase;

  // 9. 风险可控性 (riskControl): 扣除验证高/中危缺陷 + 脆弱假设扣分 (每项12分)
  const riskControl = clamp(100 - highIssues * 18 - mediumIssues * 7 - fragileCount * 12);

  // 10. 资源可承受性 (resourceAffordability)
  const resourceAffordability = scoreScenarioAffordability(scenario, readiness);

  // 11. 成果表达完整度 (reportCompleteness)
  const reportCompleteness = averageOf([
    activities.length ? Math.min(100, 60 + activities.length * 5) : 35,
    edges.length ? Math.min(100, 50 + edges.length * 6) : 40,
    traceability.score || 50,
    validation.scores?.length ? 78 : 38
  ]);

  return {
    missionFit: { score: missionFitScore, evidence: missionFitEvidence },
    coordination: { score: coordination, evidence: evidence("活动连通性", scoreByLabel("活动连通性", 55), "跨视图追溯", scoreByLabel("跨视图追溯", traceability.score || 55)) },
    feasibility: { score: feasibility, evidence: evidence("要素就绪度", readiness, "OODA 完整性", scoreByLabel("OODA 行为完整性", oodaDiagnostics.completenessScore || 50), "推演实测", simulationEval?.hasRun ? `${simulationEval.score}分` : "待推演") },
    riskControl: { score: riskControl, evidence: evidence("高优先级问题", highIssues, "中优先级问题", mediumIssues, "高危脆弱假设", fragileCount) },
    resourceAffordability: { score: resourceAffordability, evidence: evidence("部署诊断", scenario?.deploymentPlan?.diagnostics?.length || 0, "想定", scenario ? "已生成" : "未生成") },
    timeWindow: { score: timeWindowEval.score, evidence: timeWindowEval.evidence },
    resilience: { score: resilienceEval.score, evidence: resilienceEval.evidence },
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
