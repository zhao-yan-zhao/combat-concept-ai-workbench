const CONTRACT = "combat-concept.simulation-adapter";
const SCHEMA_VERSION = 1;
const MAX_RUNS = 12;

export function createSimulationPackage(scenario, settings = {}) {
  if (!scenario) return null;
  const adapter = publicAdapter(settings);
  const inputFingerprint = simulationInputFingerprint(scenario);
  const payload = {
    contract: CONTRACT,
    schemaVersion: SCHEMA_VERSION,
    kind: "abstract-research-simulation-input",
    generatedAt: new Date().toISOString(),
    adapter,
    safetyScope: "abstract-percent-grid; research review only; no geographic coordinates, target assignment, routing, or weapon parameters",
    scenario: {
      id: String(scenario.id || ""),
      generatedAt: String(scenario.generatedAt || ""),
      updatedAt: String(scenario.updatedAt || scenario.generatedAt || ""),
      inputFingerprint,
      coordinateReference: "abstract-percent-grid",
      entities: (scenario.entities || []).map((entity) => ({
        id: String(entity.id || ""),
        role: String(entity.role || ""),
        position: position(entity.position),
        sourceActivityId: String(entity.sourceActivityId || ""),
        sourceOodaIds: (entity.sourceOodaIds || []).map(String),
        sourceKnowledgeRefs: (entity.sourceKnowledgeRefs || []).map(String).slice(0, 16)
      })),
      areas: (scenario.areas || []).map((area) => ({
        id: String(area.id || ""),
        type: String(area.type || ""),
        position: position(area.position),
        size: bounded(area.size, 0, 2000)
      })),
      timeline: (scenario.timeline || []).map((event) => ({
        id: String(event.id || ""),
        time: String(event.time || ""),
        sourceNodeId: String(event.sourceNodeId || "")
      })),
      deployment: deploymentSummary(scenario.deploymentPlan)
    }
  };
  return { ...payload, packageId: `${String(scenario.id || "scenario")}-${stableHash(JSON.stringify(payload))}` };
}

export function createSimulationArtifact(scenario, settings) {
  const payload = createSimulationPackage(scenario, settings);
  if (!payload) return null;
  return {
    content: JSON.stringify(payload, null, 2),
    filename: `combat-concept-simulation-input-${payload.packageId}.json`,
    mime: "application/json;charset=utf-8",
    label: "仿真适配输入包"
  };
}

export function recordSimulationSubmission(scenario, settings) {
  const packagePayload = createSimulationPackage(scenario, settings);
  if (!packagePayload || !settings?.enabled) return scenario;
  const run = {
    id: `simulation-run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    adapter: packagePayload.adapter,
    packageId: packagePayload.packageId,
    schemaVersion: SCHEMA_VERSION,
    submittedAt: new Date().toISOString(),
    status: "exported",
    input: {
      scenarioId: packagePayload.scenario.id,
      scenarioUpdatedAt: packagePayload.scenario.updatedAt,
      inputFingerprint: packagePayload.scenario.inputFingerprint,
      entityCount: packagePayload.scenario.entities.length,
      areaCount: packagePayload.scenario.areas.length,
      timelineEventCount: packagePayload.scenario.timeline.length,
      coordinateReference: packagePayload.scenario.coordinateReference
    },
    result: null
  };
  return withSimulation(scenario, run, packagePayload.adapter);
}

export function recordSimulationResult(scenario, runId, value = {}) {
  if (!scenario?.simulation?.runs?.length) return scenario;
  const completedAt = new Date().toISOString();
  const sourceRun = scenario.simulation.runs.find((run) => run.id === runId);
  if (!sourceRun) return scenario;
  const receivedInputFingerprint = clean(value.inputFingerprint, 160);
  const expectedInputFingerprint = clean(sourceRun.input?.inputFingerprint, 160);
  const inputMatch = receivedInputFingerprint && expectedInputFingerprint ? receivedInputFingerprint === expectedInputFingerprint ? "matched" : "mismatch" : "not-supplied";
  const result = {
    receivedAt: completedAt,
    status: inputMatch === "mismatch" ? "inconclusive" : ["completed", "inconclusive", "failed"].includes(value.status) ? value.status : "inconclusive",
    summary: inputMatch === "mismatch" ? `输入指纹不匹配；${clean(value.summary, 1500) || "请复核结果来源。"}` : clean(value.summary, 1600) || "未提供仿真结果摘要。",
    inputFingerprint: receivedInputFingerprint,
    inputMatch,
    metrics: normalizeMetrics(value.metrics),
    phaseOutcomes: Array.isArray(value.phaseOutcomes) ? value.phaseOutcomes : undefined,
    activityDeviations: Array.isArray(value.activityDeviations) ? value.activityDeviations : undefined
  };
  const runs = scenario.simulation.runs.map((run) => run.id === runId
    ? { ...run, status: "result-recorded", completedAt, result }
    : run);
  return {
    ...scenario,
    updatedAt: completedAt,
    simulation: { ...scenario.simulation, runs }
  };
}

export function runLocalAbstractSimulation(scenario, now = () => new Date().toISOString()) {
  if (!scenario) return scenario;
  const packagePayload = createSimulationPackage(scenario, { id: "local-abstract-grid", name: "本地抽象网格评估", version: "v1" });
  if (!packagePayload) return scenario;
  const executedAt = now();
  const entities = packagePayload.scenario.entities;
  const areas = packagePayload.scenario.areas;
  const timeline = packagePayload.scenario.timeline;
  const diagnostics = packagePayload.scenario.deployment?.diagnosticStates || [];

  const sensorCoverage = calculateSensorCoverage(entities, areas);
  const c2Connectivity = calculateC2Connectivity(entities);
  const causalSmoothness = calculateCausalSmoothness(timeline, scenario.ov5 || {});
  const forceDispersion = calculateForceDispersion(entities);

  const run = {
    id: `simulation-run-local-${stableHash(`${packagePayload.packageId}:${executedAt}`)}`,
    adapter: { id: "local-abstract-grid", name: "本地抽象网格评估", version: "v1", mode: "local-deterministic" },
    packageId: packagePayload.packageId,
    schemaVersion: SCHEMA_VERSION,
    submittedAt: executedAt,
    completedAt: executedAt,
    status: "result-recorded",
    input: { scenarioId: packagePayload.scenario.id, scenarioUpdatedAt: packagePayload.scenario.updatedAt, inputFingerprint: packagePayload.scenario.inputFingerprint, entityCount: entities.length, areaCount: areas.length, timelineEventCount: timeline.length, coordinateReference: "abstract-percent-grid" },
    result: {
      receivedAt: executedAt,
      status: "completed",
      summary: `本地确定性战术离散评估完成：感知覆盖 ${sensorCoverage.score}%，指控连通 ${c2Connectivity.score}%，因果顺畅 ${causalSmoothness.score}%，防区疏散 ${forceDispersion.score}%。`,
      inputFingerprint: packagePayload.scenario.inputFingerprint,
      inputMatch: "matched",
      metrics: [
        metric("grid-bounds", "网格边界合规", percentage(entities.filter((item) => inBounds(item.position)).length, entities.length), "%"),
        metric("area-coverage", "区域感知覆盖率", sensorCoverage.score, "%"),
        metric("c2-connectivity", "指控通信连通率", c2Connectivity.score, "%"),
        metric("timeline-completeness", "时间线完整性", percentage(timeline.filter((item) => item.sourceNodeId).length, timeline.length), "%"),
        metric("causal-smoothness", "时序因果顺畅度", causalSmoothness.score, "%"),
        metric("force-dispersion", "防区分散健康度", forceDispersion.score, "%")
      ],
      evaluatorDetails: {
        sensorCoverage,
        c2Connectivity,
        causalSmoothness,
        forceDispersion
      }
    }
  };
  return withSimulation({ ...scenario, updatedAt: executedAt }, run, run.adapter);
}

export function buildSimulationDiagnostics(scenario) {
  const runs = Array.isArray(scenario?.simulation?.runs) ? scenario.simulation.runs : [];
  const latest = runs[0] || null;
  const result = latest?.result || null;
  const currentFingerprint = scenario ? simulationInputFingerprint(scenario) : "";
  const freshness = !latest ? "" : !latest.input?.inputFingerprint ? "unverified" : latest.input.inputFingerprint === currentFingerprint ? "current" : "stale";
  const returnVerified = result?.inputMatch === "matched";
  const state = !runs.length ? "not-submitted" : result?.status === "completed" && freshness === "current" && returnVerified ? "completed" : freshness === "stale" ? "stale" : result ? "review" : "exported";
  const inputCurrentCheck = diagnostic("input-current", "输入当前性", freshness === "current" ? "ready" : latest ? "review" : "pending", freshness === "current" ? "仿真输入与当前抽象想定一致。" : freshness === "stale" ? "想定已修改；需要重新运行或重新登记仿真结果。" : latest ? "历史运行缺少输入指纹；请重新运行或复核。" : "尚未生成仿真输入。");
  return {
    state,
    runCount: runs.length,
    latestRun: latest ? {
      id: latest.id,
      adapterName: latest.adapter?.name || latest.adapter?.id || "未命名适配器",
      adapterVersion: latest.adapter?.version || "",
      packageId: latest.packageId,
      inputFingerprint: latest.input?.inputFingerprint || "",
      submittedAt: latest.submittedAt,
      completedAt: latest.completedAt || "",
      status: latest.status,
      freshness,
      result: result ? {
        status: result.status,
        summary: result.summary,
        inputMatch: result.inputMatch || "not-supplied",
        metricCount: result.metrics?.length || 0,
        metrics: (result.metrics || []).slice(0, 6).map((metric) => ({ label: clean(metric.label, 160), value: bounded(metric.value, -1000000, 1000000), unit: clean(metric.unit, 40) }))
      } : null
    } : null,
    checks: [inputCurrentCheck,
      diagnostic("adapter-contract", "仿真适配契约", latest ? "ready" : "pending", latest ? `已生成 ${latest.adapter?.name || latest.adapter?.id || "适配器"} 输入包` : "尚未配置并登记外部仿真适配器"),
      diagnostic("abstract-scope", "输入范围", latest?.input?.coordinateReference === "abstract-percent-grid" ? "ready" : latest ? "review" : "pending", latest ? "输入包仅包含抽象百分比网格和研究级时序数据" : "生成输入包后可复核受限范围"),
      diagnostic("result-return", "结果回传", result?.status === "completed" && returnVerified ? "ready" : result ? "review" : "pending", result?.status === "completed" && returnVerified ? `${result.metrics?.length || 0} 项研究指标已回传，输入指纹匹配` : result?.inputMatch === "mismatch" ? "回传输入指纹不匹配；结果仅可作为不充分结论复核" : result ? "回传未提供可核对的输入指纹；结果需人工复核" : "尚未记录外部仿真结果")
    ]
  };
}

export function simulationInputFingerprint(scenario) {
  if (!scenario) return "";
  return `sim-input-${stableHash(JSON.stringify({
    id: String(scenario.id || ""),
    entities: (scenario.entities || []).map((entity) => ({ id: String(entity.id || ""), role: String(entity.role || ""), position: position(entity.position), sourceActivityId: String(entity.sourceActivityId || ""), sourceOodaIds: (entity.sourceOodaIds || []).map(String), sourceKnowledgeRefs: (entity.sourceKnowledgeRefs || []).map(String).slice(0, 16) })),
    areas: (scenario.areas || []).map((area) => ({ id: String(area.id || ""), type: String(area.type || ""), position: position(area.position), size: bounded(area.size, 0, 2000) })),
    timeline: (scenario.timeline || []).map((event) => ({ id: String(event.id || ""), time: String(event.time || ""), sourceNodeId: String(event.sourceNodeId || "") })),
    deployment: deploymentSummary(scenario.deploymentPlan),
    deploymentReview: scenario.deploymentReview ? { exchangeId: String(scenario.deploymentReview.exchangeId || ""), changeId: String(scenario.deploymentReview.changeId || "") } : null
  }))}`;
}

function withSimulation(scenario, run, adapter) {
  const runs = [run, ...(scenario.simulation?.runs || [])].slice(0, MAX_RUNS);
  return {
    ...scenario,
    updatedAt: run.submittedAt,
    simulation: { version: 1, contract: CONTRACT, adapter, runs }
  };
}

function publicAdapter(settings = {}) {
  return {
    id: clean(settings.id, 80) || "manual-json-handoff",
    name: clean(settings.name, 160) || "通用 JSON 人工交接",
    version: clean(settings.version, 80) || "v1",
    mode: "manual-export"
  };
}

function deploymentSummary(plan) {
  if (!plan) return null;
  return {
    mode: String(plan.mode || ""),
    state: String(plan.state || ""),
    adjustedEntityCount: Array.isArray(plan.adjustedEntityIds) ? plan.adjustedEntityIds.length : 0,
    diagnosticStates: (plan.diagnostics || []).map((item) => ({ id: String(item.id || ""), state: String(item.state || "") }))
  };
}

function normalizeMetrics(metrics) {
  return (Array.isArray(metrics) ? metrics : []).slice(0, 6).map((metric, index) => ({
    id: clean(metric?.id, 80) || `metric-${index + 1}`,
    label: clean(metric?.label, 160) || `指标 ${index + 1}`,
    value: bounded(metric?.value, -1000000, 1000000),
    unit: clean(metric?.unit, 40)
  })).filter((metric) => metric.label);
}

function metric(id, label, value, unit) { return { id, label, value, unit }; }
function percentage(numerator, denominator) { return denominator ? Number((Math.max(0, numerator) / denominator * 100).toFixed(2)) : 0; }
function inBounds(positionValue) { const [x, y] = position(positionValue); return x >= 0 && x <= 100 && y >= 0 && y <= 100; }
function coverageScore(entities, areas) {
  return calculateSensorCoverage(entities, areas).score;
}

/**
 * 战术机理计算 1：网格多域感知覆盖率 (Sensor Coverage Rate) (M8-T8.6)
 */
export function calculateSensorCoverage(entities = [], areas = []) {
  if (!entities.length || !areas.length) {
    return { score: entities.length ? 100 : 0, uncoveredAreaCount: 0, details: [] };
  }
  const sensorEntities = entities.filter((e) => {
    const role = String(e.role || e.type || e.id || "").toLowerCase();
    return /radar|uav|recon|sensor|aew|scout|warn|预警|侦察|探测/.test(role);
  });
  const defaultRadius = 15;
  const areaDetails = areas.map((area) => {
    const [ax, ay] = position(area.position);
    let maxCoverage = 0;
    const candidates = sensorEntities.length > 0 ? sensorEntities : entities;
    candidates.forEach((e) => {
      const [ex, ey] = position(e.position);
      const role = String(e.role || e.type || e.id || "").toLowerCase();
      const sensorRadius = /aew|warn|预警/.test(role) ? 45 : /radar|雷达/.test(role) ? 35 : /uav|无人机/.test(role) ? 25 : defaultRadius;
      const dist = Math.hypot(ex - ax, ey - ay);
      if (dist <= sensorRadius) {
        const localRatio = Math.max(0, 1 - (dist / sensorRadius) * 0.7);
        if (localRatio > maxCoverage) maxCoverage = localRatio;
      }
    });

    return {
      areaId: area.id || "unnamed-area",
      coverageRatio: Number((maxCoverage * 100).toFixed(1)),
      isCovered: maxCoverage >= 0.4
    };
  });

  const totalRatio = areaDetails.reduce((sum, d) => sum + d.coverageRatio, 0);
  const avgScore = Number((totalRatio / areaDetails.length).toFixed(1));
  const uncoveredCount = areaDetails.filter((d) => !d.isCovered).length;

  return {
    score: avgScore,
    uncoveredAreaCount: uncoveredCount,
    details: areaDetails
  };
}

/**
 * 战术机理计算 2：指控通信网络连通率 (C2 Connectivity Rate) (M8-T8.6)
 */
export function calculateC2Connectivity(entities = [], defaultRadius = 35) {
  if (!entities.length) return { score: 100, connectedCount: 0, totalCount: 0, isolatedIds: [] };
  if (entities.length === 1) return { score: 100, connectedCount: 1, totalCount: 1, isolatedIds: [] };

  const n = entities.length;
  const adj = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const [x1, y1] = position(entities[i].position);
    const role1 = String(entities[i].role || "").toLowerCase();
    const r1 = /relay|satellite|c2|指挥|中继|卫星/.test(role1) ? 55 : defaultRadius;
    for (let j = i + 1; j < n; j++) {
      const [x2, y2] = position(entities[j].position);
      const role2 = String(entities[j].role || "").toLowerCase();
      const r2 = /relay|satellite|c2|指挥|中继|卫星/.test(role2) ? 55 : defaultRadius;
      const effectiveRadius = Math.max(r1, r2);
      if (Math.hypot(x1 - x2, y1 - y2) <= effectiveRadius) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  const visited = new Array(n).fill(false);
  let maxComponentSize = 0;
  let maxComponentNodes = [];

  for (let i = 0; i < n; i++) {
    if (!visited[i]) {
      const component = [];
      const queue = [i];
      visited[i] = true;
      while (queue.length > 0) {
        const u = queue.shift();
        component.push(u);
        for (const v of adj[u]) {
          if (!visited[v]) {
            visited[v] = true;
            queue.push(v);
          }
        }
      }
      if (component.length > maxComponentSize) {
        maxComponentSize = component.length;
        maxComponentNodes = component;
      }
    }
  }

  const isolatedIndices = entities.map((_, i) => i).filter((i) => !maxComponentNodes.includes(i));
  const isolatedIds = isolatedIndices.map((i) => entities[i].id || `entity-${i + 1}`);
  const score = Number(((maxComponentSize / n) * 100).toFixed(1));

  return {
    score,
    connectedCount: maxComponentSize,
    totalCount: n,
    isolatedIds
  };
}

/**
 * 战术机理计算 3：时序因果顺畅度 (Causal Smoothness Rate) (M8-T8.6)
 */
export function calculateCausalSmoothness(timeline = [], ov5 = {}) {
  if (!Array.isArray(timeline) || timeline.length <= 1) {
    return { score: 100, inversionCount: 0, details: [] };
  }

  let inversions = 0;
  const issues = [];

  const parseEventTime = (t) => {
    if (typeof t === "number") return t;
    const str = String(t || "").trim();
    const matchH = str.match(/([+-]?\d+(?:\.\d+)?)/);
    return matchH ? parseFloat(matchH[1]) : 0;
  };

  for (let i = 0; i < timeline.length - 1; i++) {
    const t1 = parseEventTime(timeline[i].time);
    const t2 = parseEventTime(timeline[i + 1].time);
    if (t1 > t2) {
      inversions += 1;
      issues.push(`事件 [${timeline[i].id || i + 1}] 时间 (${timeline[i].time}) 晚于后续事件 (${timeline[i + 1].time})，存在时序倒挂`);
    }
  }

  const edges = Array.isArray(ov5?.edges) ? ov5.edges : [];
  if (edges.length > 0) {
    edges.forEach((edge) => {
      const fromIdx = timeline.findIndex((e) => e.sourceNodeId === edge.from || e.activityId === edge.from);
      const toIdx = timeline.findIndex((e) => e.sourceNodeId === edge.to || e.activityId === edge.to);
      if (fromIdx >= 0 && toIdx >= 0 && fromIdx > toIdx) {
        inversions += 1;
        issues.push(`前置依赖活动 [${edge.from}] 在时间线上出现于后置活动 [${edge.to}] 之后，违背因果逻辑`);
      }
    });
  }

  const penalty = Math.min(80, inversions * 20);
  const score = Math.max(0, 100 - penalty);

  return {
    score,
    inversionCount: inversions,
    details: issues
  };
}

/**
 * 战术机理计算 4：防区分布式疏散健康度 (Force Dispersion Index) (M8-T8.6)
 */
export function calculateForceDispersion(entities = [], minSafeDist = 8, maxCollabDist = 45) {
  if (!entities.length || entities.length === 1) {
    return { score: 100, clusterRiskCount: 0, isolatedRiskCount: 0, avgNeighborDist: 0 };
  }

  const n = entities.length;
  let clusterRisks = 0;
  let isolatedRisks = 0;
  let totalMinDist = 0;

  for (let i = 0; i < n; i++) {
    const [x1, y1] = position(entities[i].position);
    let nearestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const [x2, y2] = position(entities[j].position);
      const dist = Math.hypot(x1 - x2, y1 - y2);
      if (dist < nearestDist) nearestDist = dist;
    }
    totalMinDist += nearestDist;
    if (nearestDist < minSafeDist) clusterRisks += 1;
    if (nearestDist > maxCollabDist) isolatedRisks += 1;
  }

  const avgMinDist = Number((totalMinDist / n).toFixed(1));
  const penalty = Math.min(80, clusterRisks * 15 + isolatedRisks * 10);
  const score = Math.max(20, 100 - penalty);

  return {
    score,
    clusterRiskCount: clusterRisks,
    isolatedRiskCount: isolatedRisks,
    avgNeighborDist: avgMinDist
  };
}

function diagnostic(id, label, state, detail) {
  return { id, label, state, statusLabel: ({ ready: "已满足", review: "需复核", pending: "未完成" })[state] || "需复核", detail };
}

function position(value) {
  return [bounded(value?.[0], 0, 100), bounded(value?.[1], 0, 100)];
}

function bounded(value, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : 0;
}

function clean(value, maximum) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function stableHash(value) {
  let hash = 5381;
  for (const character of String(value)) hash = ((hash << 5) + hash) ^ character.charCodeAt(0);
  return (hash >>> 0).toString(36);
}
