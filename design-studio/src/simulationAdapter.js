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
    metrics: normalizeMetrics(value.metrics)
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
      summary: "本地确定性抽象评估已完成；仅检查网格部署、区域覆盖、时间线和部署诊断，结论需人工复核。",
      inputFingerprint: packagePayload.scenario.inputFingerprint,
      inputMatch: "matched",
      metrics: [
        metric("grid-bounds", "网格边界合规", percentage(entities.filter((item) => inBounds(item.position)).length, entities.length), "%"),
        metric("area-coverage", "区域覆盖一致性", coverageScore(entities, areas), "%"),
        metric("timeline-completeness", "时间线完整性", percentage(timeline.filter((item) => item.sourceNodeId).length, timeline.length), "%"),
        metric("deployment-diagnostics", "部署诊断就绪", percentage(diagnostics.filter((item) => item.state === "ready").length, diagnostics.length), "%")
      ]
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
  if (!entities.length || !areas.length) return 0;
  const covered = entities.filter((entity) => areas.some((area) => {
    const [x, y] = entity.position;
    const [areaX, areaY] = area.position;
    const radius = Math.max(1, Math.min(100, Number(area.size || 0) / 10));
    return Math.hypot(x - areaX, y - areaY) <= radius;
  })).length;
  return percentage(covered, entities.length);
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
