import {
  normalizeArchitecture as normalizeDodafArchitecture,
  normalizeDodafOv1,
  normalizeDodafOv2,
  normalizeDodafOv3,
  normalizeDodafOv4,
  normalizeDodafOv5,
  normalizeDodafOv5a,
  normalizeDodafOv6a,
  normalizeDodafOv6b,
  normalizeDodafOv6c
} from "../shared/dodaf/products.js";
import {
  buildArchitectureExchangePackage,
  decodeArchitecturePackage,
  encodeArchitecturePackage,
  productsFromExchangePackage
} from "../shared/dodaf/exchange.js";
import {
  normalizeConceptGraphicPlan as normalizeSharedConceptGraphicPlan,
  normalizeForceMissionPlan as normalizeSharedForceMissionPlan,
  normalizePhaseActionConcept as normalizeSharedPhaseActionConcept
} from "../shared/conceptPlanning.js";

const OODA_NODE_FIELDS = ["id", "sourceActivityId", "title", "text", "duration", "input", "output", "rule"];

export function normalizeForceMissionPlan(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Force mission plan is required");
  return normalizeSharedForceMissionPlan(value);
}

export function normalizePhaseActionConcept(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Phase action concept is required");
  return normalizeSharedPhaseActionConcept(value);
}

export function normalizeConceptGraphicPlan(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Concept graphic plan is required");
  return normalizeSharedConceptGraphicPlan(value);
}

/** OV-1 DoDAF 2.02/DM2 product (keeps nodes/edges for UI compatibility). */
export function normalizeOv1(value) {
  const model = normalizeDodafOv1(value);
  return withLegacyProvenance(model, value?.provenance);
}

/** OV-5b DoDAF 2.02/DM2 product (keeps activities/edges for UI compatibility). */
export function normalizeOv5(value) {
  const model = normalizeDodafOv5(value);
  return withLegacyProvenance(model, value?.provenance);
}

export function normalizeOv2(value) {
  return withLegacyProvenance(normalizeDodafOv2(value), value?.provenance);
}

export function normalizeOv3(value) {
  return withLegacyProvenance(normalizeDodafOv3(value), value?.provenance);
}

export function normalizeOv4(value) {
  return withLegacyProvenance(normalizeDodafOv4(value), value?.provenance);
}

export function normalizeOv5a(value) {
  return withLegacyProvenance(normalizeDodafOv5a(value), value?.provenance);
}

export function normalizeOv6a(value) {
  return withLegacyProvenance(normalizeDodafOv6a(value), value?.provenance);
}

export function normalizeOv6b(value) {
  return withLegacyProvenance(normalizeDodafOv6b(value), value?.provenance);
}

export function normalizeOv6c(value) {
  return withLegacyProvenance(normalizeDodafOv6c(value), value?.provenance);
}

export function normalizeArchitecture(value) {
  return normalizeDodafArchitecture(value);
}

/** Bounded, editor-compatible snapshot returned by the embedded map application. */
export function normalizeConceptMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Concept map is required");
  const document = sanitizeJson(value.document, { name: "Concept map document", maximumBytes: 768 * 1024 });
  const version = Number(document?.version || 0);
  const items = Array.isArray(document?.items) ? document.items : null;
  if (!Number.isInteger(version) || version < 2 || version > 4) throw new Error("Concept map document version is invalid");
  if (!items || items.length > 300) throw new Error("Concept map supports at most 300 items");
  if (items.some((item) => !item || typeof item !== "object" || !clean(item.id, 160) || !["symbol", "line", "area", "plot", "text"].includes(clean(item.type, 32)))) {
    throw new Error("Concept map contains an invalid item");
  }
  const layers = [...new Set(items.map((item) => clean(item.layer, 120)).filter(Boolean))].slice(0, 80);
  const typeCounts = items.reduce((result, item) => ({ ...result, [item.type]: Number(result[item.type] || 0) + 1 }), {});
  return {
    version: 2,
    title: clean(value.title, 180),
    context: clean(value.context, 6000),
    boundMapProjectId: clean(value.boundMapProjectId, 120),
    document,
    draft: normalizeConceptMapDraft(value.draft),
    reference: normalizeConceptMapReference(value.reference),
    summary: { itemCount: items.length, layers, typeCounts }
  };
}

function normalizeConceptMapDraft(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const status = ["empty", "generated", "imported"].includes(clean(input.status, 24)) ? clean(input.status, 24) : "empty";
  return {
    status,
    generatedAt: clean(input.generatedAt, 80),
    importedAt: clean(input.importedAt, 80),
    sourceBrief: {
      objective: clean(input?.sourceBrief?.objective, 240),
      approach: clean(input?.sourceBrief?.approach, 400),
      assumptions: clean(input?.sourceBrief?.assumptions, 400),
      expectedEffects: clean(input?.sourceBrief?.expectedEffects, 400),
      risk: clean(input?.sourceBrief?.risk, 400)
    },
    center: normalizeConceptMapCenter(input.center),
    coordinateReference: clean(input.coordinateReference, 80),
    // Durable force placements from drawing-tool edits (WGS84).
    placements: (Array.isArray(input.placements) ? input.placements : []).slice(0, 120).map((item) => ({
      itemId: clean(item?.itemId, 160),
      conceptForceId: clean(item?.conceptForceId, 80),
      name: clean(item?.name, 80),
      lon: Number.isFinite(Number(item?.lon)) ? Number(item.lon) : 0,
      lat: Number.isFinite(Number(item?.lat)) ? Number(item.lat) : 0,
      phaseId: clean(item?.phaseId, 48)
    })).filter((item) => item.itemId && Number.isFinite(item.lon) && Number.isFinite(item.lat))
  };
}

function normalizeConceptMapReference(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const status = ["empty", "draft", "confirmed"].includes(clean(input.status, 24)) ? clean(input.status, 24) : "empty";
  const entityIds = new Set();
  return {
    version: 1,
    status,
    source: clean(input.source, 80),
    generatedAt: clean(input.generatedAt, 80),
    confirmedAt: status === "confirmed" ? clean(input.confirmedAt, 80) : "",
    entities: (Array.isArray(input.entities) ? input.entities : []).slice(0, 18).map((item, index) => ({
      id: clean(item?.id, 80) || `entity-${index + 1}`,
      role: ["environment", "external", "equipment", "command", "action", "effect"].includes(clean(item?.role, 40)) ? clean(item.role, 40) : "external",
      label: clean(item?.label, 160),
      note: clean(item?.note, 900)
    })).filter((item) => item.label && !entityIds.has(item.id) && (entityIds.add(item.id), true)),
    relations: (Array.isArray(input.relations) ? input.relations : []).slice(0, 24).map((item, index) => ({
      id: clean(item?.id, 80) || `relation-${index + 1}`,
      from: clean(item?.from, 160),
      type: clean(item?.type, 120),
      to: clean(item?.to, 160),
      note: clean(item?.note, 900)
    })).filter((item) => item.from && item.type && item.to),
    activities: (Array.isArray(input.activities) ? input.activities : []).slice(0, 16).map((item, index) => ({
      id: clean(item?.id, 80) || `activity-${index + 1}`,
      title: clean(item?.title, 160),
      purpose: clean(item?.purpose, 900)
    })).filter((item) => item.title),
    constraints: normalizeStringList(input.constraints, 18, 900),
    questions: normalizeStringList(input.questions, 18, 900)
  };
}

function normalizeConceptMapCenter(value) {
  const lon = Number(value?.lon);
  const lat = Number(value?.lat);
  const height = Number(value?.height);
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -85 || lat > 85) return null;
  return {
    lon: Math.round(lon * 1000000) / 1000000,
    lat: Math.round(lat * 1000000) / 1000000,
    height: Number.isFinite(height) ? Math.max(200, Math.min(10000000, Math.round(height))) : 80000
  };
}

export {
  buildArchitectureExchangePackage,
  decodeArchitecturePackage,
  encodeArchitecturePackage,
  productsFromExchangePackage
};

function withLegacyProvenance(model, provenance) {
  const wrapped = normalizeProvenance(provenance || model.provenance);
  if (!wrapped.provenance) return model;
  return { ...model, ...wrapped };
}

function normalizeOv1Concept(value) {
  return {
    mission: clean(value?.mission, 240), objective: clean(value?.objective, 500), scope: clean(value?.scope, 300), phase: clean(value?.phase, 160), expectedEffects: clean(value?.expectedEffects, 500), constraints: clean(value?.constraints, 500)
  };
}

export function normalizeOoda(value) {
  const inputLanes = Array.isArray(value?.lanes) ? value.lanes.slice(0, 8) : [];
  if (!inputLanes.length) throw new Error("OODA requires at least one lane");
  const laneIds = new Set();
  const nodeIds = new Set();
  const lanes = inputLanes.map((lane, laneIndex) => {
    const id = clean(lane?.id, 80) || `lane-${laneIndex + 1}`;
    if (laneIds.has(id)) throw new Error("OODA lane identifiers must be unique");
    laneIds.add(id);
    const nodes = (Array.isArray(lane?.nodes) ? lane.nodes : []).slice(0, 60).map((node, nodeIndex) => {
      const nodeId = clean(node?.id, 160) || `ooda-${id}-${nodeIndex + 1}`;
      if (nodeIds.has(nodeId)) throw new Error("OODA node identifiers must be unique");
      nodeIds.add(nodeId);
      const normalized = OODA_NODE_FIELDS.reduce((result, field) => {
        result[field] = field === "id"
          ? nodeId
          : field === "sourceActivityId"
            ? clean(node?.[field], 160)
            : clean(node?.[field], 4000) || "TBD";
        return result;
      }, {});
      normalized.equipmentRefs = normalizeStringList(node?.equipmentRefs, 16, 160);
      normalized.knowledgeRefs = normalizeStringList(node?.knowledgeRefs, 16, 160);
      return normalized;
    });
    return {
      id,
      title: clean(lane?.title, 160) || id,
      subtitle: clean(lane?.subtitle, 160) || id,
      color: clean(lane?.color, 32) || "#4d697d",
      nodes
    };
  });
  return {
    version: 1,
    sourceActivityIds: normalizeStringList(value?.sourceActivityIds, 160, 160),
    lanes,
    ...normalizeProvenance(value?.provenance)
  };
}

export function normalizeScenario(value) {
  if (!value || typeof value !== "object") throw new Error("Scenario model is required");
  const entityIds = new Set();
  const entities = (Array.isArray(value.entities) ? value.entities : []).slice(0, 120).map((entity, index) => {
    const id = clean(entity?.id, 160) || `entity-${index + 1}`;
    if (entityIds.has(id)) throw new Error("Scenario entity identifiers must be unique");
    entityIds.add(id);
    return {
      id,
      label: clean(entity?.label, 4000) || "TBD",
      role: clean(entity?.role, 120) || "unknown",
      position: normalizePosition(entity?.position),
      className: clean(entity?.className, 120),
      sourceActivityId: clean(entity?.sourceActivityId, 160),
      sourceOodaIds: normalizeStringList(entity?.sourceOodaIds, 60, 160),
      sourceKnowledgeRefs: normalizeStringList(entity?.sourceKnowledgeRefs, 16, 160)
    };
  });
  const areaIds = new Set();
  const areas = (Array.isArray(value.areas) ? value.areas : []).slice(0, 60).map((area, index) => {
    const id = clean(area?.id, 160) || `area-${index + 1}`;
    if (areaIds.has(id)) throw new Error("Scenario area identifiers must be unique");
    areaIds.add(id);
    return {
      id,
      label: clean(area?.label, 4000) || "TBD",
      type: clean(area?.type, 120) || "coverage",
      position: normalizePosition(area?.position),
      size: clampNumber(area?.size, 0, 2000, 0)
    };
  });
  const eventIds = new Set();
  const timeline = (Array.isArray(value.timeline) ? value.timeline : []).slice(0, 500).map((event, index) => {
    const id = clean(event?.id, 180) || `event-${index + 1}`;
    if (eventIds.has(id)) throw new Error("Scenario event identifiers must be unique");
    eventIds.add(id);
    return {
      id,
      time: clean(event?.time, 120) || `T+${index}`,
      title: clean(event?.title, 4000) || "TBD",
      description: clean(event?.description, 8000) || "TBD",
      sourceNodeId: clean(event?.sourceNodeId, 160)
    };
  });
  if (!entities.length && !timeline.length) throw new Error("Scenario requires entities or timeline events");
  return {
    version: 1,
    id: clean(value.id, 160) || "scenario",
    generatedAt: clean(value.generatedAt, 80),
    updatedAt: clean(value.updatedAt, 80),
    derivedAt: clean(value.derivedAt, 80),
    sourceOv5Signature: clean(value.sourceOv5Signature, 20000),
    sourceOodaSignature: clean(value.sourceOodaSignature, 20000),
    stale: Boolean(value.stale),
    staleReason: clean(value.staleReason, 240),
    staleAt: clean(value.staleAt, 80),
    source: {
      activityIds: normalizeStringList(value?.source?.activityIds, 160, 160),
      oodaNodeIds: normalizeStringList(value?.source?.oodaNodeIds, 400, 160)
    },
    entities,
    areas,
    timeline,
    deploymentPlan: normalizeDeploymentPlan(value.deploymentPlan),
    deploymentReview: normalizeDeploymentReview(value.deploymentReview),
    simulation: normalizeSimulation(value.simulation)
  };
}

function normalizeDeploymentReview(value) {
  if (!value || typeof value !== "object") return null;
  const exchangeId = clean(value.exchangeId, 160);
  const changeId = clean(value.changeId, 160);
  if (!exchangeId || !changeId) return null;
  return {
    bridgeOrigin: clean(value.bridgeOrigin, 300),
    exchangeId,
    changeId,
    scenarioUpdatedAt: clean(value.scenarioUpdatedAt, 80),
    receivedAt: clean(value.receivedAt, 80)
  };
}

function normalizeSimulation(value) {
  if (!value || typeof value !== "object") return null;
  const runs = (Array.isArray(value.runs) ? value.runs : []).slice(0, 12).map((run, index) => ({
    id: clean(run?.id, 160) || `simulation-run-${index + 1}`,
    adapter: {
      id: clean(run?.adapter?.id, 80) || "manual-json-handoff",
      name: clean(run?.adapter?.name, 160) || "Manual JSON handoff",
      version: clean(run?.adapter?.version, 80),
      mode: clean(run?.adapter?.mode, 80) || "manual-export"
    },
    packageId: clean(run?.packageId, 200),
    schemaVersion: clampNumber(run?.schemaVersion, 1, 99, 1),
    submittedAt: clean(run?.submittedAt, 80),
    completedAt: clean(run?.completedAt, 80),
    status: ["exported", "result-recorded"].includes(clean(run?.status, 40)) ? clean(run.status, 40) : "exported",
    input: {
      scenarioId: clean(run?.input?.scenarioId, 160),
      scenarioUpdatedAt: clean(run?.input?.scenarioUpdatedAt, 80),
      inputFingerprint: clean(run?.input?.inputFingerprint, 160),
      entityCount: clampNumber(run?.input?.entityCount, 0, 120, 0),
      areaCount: clampNumber(run?.input?.areaCount, 0, 60, 0),
      timelineEventCount: clampNumber(run?.input?.timelineEventCount, 0, 500, 0),
      coordinateReference: clean(run?.input?.coordinateReference, 80)
    },
    result: normalizeSimulationResult(run?.result)
  }));
  return {
    version: 1,
    contract: clean(value.contract, 120) || "combat-concept.simulation-adapter",
    adapter: {
      id: clean(value?.adapter?.id, 80) || "manual-json-handoff",
      name: clean(value?.adapter?.name, 160) || "Manual JSON handoff",
      version: clean(value?.adapter?.version, 80),
      mode: clean(value?.adapter?.mode, 80) || "manual-export"
    },
    runs
  };
}

function normalizeSimulationResult(value) {
  if (!value || typeof value !== "object") return null;
  return {
    receivedAt: clean(value.receivedAt, 80),
    status: ["completed", "inconclusive", "failed"].includes(clean(value.status, 40)) ? clean(value.status, 40) : "inconclusive",
    summary: clean(value.summary, 1600),
    inputFingerprint: clean(value.inputFingerprint, 160),
    inputMatch: ["matched", "mismatch", "not-supplied"].includes(clean(value.inputMatch, 40)) ? clean(value.inputMatch, 40) : "not-supplied",
    metrics: (Array.isArray(value.metrics) ? value.metrics : []).slice(0, 6).map((metric, index) => ({
      id: clean(metric?.id, 80) || `metric-${index + 1}`,
      label: clean(metric?.label, 160) || `Metric ${index + 1}`,
      value: clampNumber(metric?.value, -1000000, 1000000, 0),
      unit: clean(metric?.unit, 40)
    }))
  };
}

function normalizeDeploymentPlan(value) {
  if (!value || typeof value !== "object") return null;
  return {
    version: 1,
    mode: clean(value.mode, 80) || "role-area-layout-v1",
    coordinateReference: clean(value.coordinateReference, 80) || "abstract-percent-grid",
    generatedAt: clean(value.generatedAt, 80),
    reviewedAt: clean(value.reviewedAt, 80),
    state: ["suggested", "review"].includes(clean(value.state, 40)) ? clean(value.state, 40) : "suggested",
    adjustedEntityIds: normalizeStringList(value.adjustedEntityIds, 120, 160),
    placements: (Array.isArray(value.placements) ? value.placements : []).slice(0, 120).map((placement) => ({
      id: clean(placement?.id, 160),
      role: clean(placement?.role, 120),
      position: normalizePosition(placement?.position),
      reason: clean(placement?.reason, 400)
    })).filter((placement) => placement.id),
    diagnostics: (Array.isArray(value.diagnostics) ? value.diagnostics : []).slice(0, 20).map((check, index) => ({
      id: clean(check?.id, 160) || `deployment-check-${index + 1}`,
      state: ["ready", "review", "attention"].includes(clean(check?.state, 40)) ? clean(check.state, 40) : "review",
      label: clean(check?.label, 400) || "Deployment check",
      detail: clean(check?.detail, 2400) || "TBD"
    }))
  };
}

export function normalizeValidation(value) {
  if (!value || typeof value !== "object") throw new Error("Validation result is required");
  const scores = (Array.isArray(value.scores) ? value.scores : []).slice(0, 20).map((score) => ({
    label: clean(score?.label, 240) || "Unnamed score",
    score: clampNumber(score?.score, 0, 100, 0)
  }));
  const issues = (Array.isArray(value.issues) ? value.issues : []).slice(0, 300).map((issue, index) => ({
    id: clean(issue?.id, 200) || `issue-${index + 1}`,
    level: ["high", "medium", "low"].includes(clean(issue?.level, 20)) ? clean(issue.level, 20) : "medium",
    title: clean(issue?.title, 1000) || "Unnamed issue",
    text: clean(issue?.text, 8000) || "TBD",
    sourceId: clean(issue?.sourceId, 200)
  }));
  const diagnostics = normalizeOodaDiagnostics(value.oodaDiagnostics);
  const traceabilityDiagnostics = normalizeTraceabilityDiagnostics(value.traceabilityDiagnostics);
  const flowDiagnostics = normalizeFlowDiagnostics(value.flowDiagnostics);
  const simulationDiagnostics = normalizeSimulationDiagnostics(value.simulationDiagnostics);
  const redTeamReview = normalizeRedTeamReview(value.redTeamReview);
  return {
    version: 1,
    id: clean(value.id, 160) || "validation",
    generatedAt: clean(value.generatedAt, 80),
    inputSignature: clean(value.inputSignature, 24000),
    oodaDuration: clampNumber(value.oodaDuration, 0, 100000, 0),
    scores,
    issues,
    oodaDiagnostics: diagnostics,
    traceabilityDiagnostics,
    flowDiagnostics,
    simulationDiagnostics,
    redTeam: clean(value.redTeam, 12000),
    redTeamReview
  };
}

function normalizeTraceabilityDiagnostics(value) {
  if (!value || typeof value !== "object") return null;
  return {
    mappedActivityCount: clampNumber(value.mappedActivityCount, 0, 10000, 0),
    activityCount: clampNumber(value.activityCount, 0, 10000, 0),
    orphanedReferenceCount: clampNumber(value.orphanedReferenceCount, 0, 10000, 0),
    score: clampNumber(value.score, 0, 100, 0),
    checks: normalizeDiagnosticChecks(value.checks, 8, "traceability-check")
  };
}

function normalizeFlowDiagnostics(value) {
  if (!value || typeof value !== "object") return null;
  return {
    exchangeCount: clampNumber(value.exchangeCount, 0, 10000, 0),
    unresolvedCount: clampNumber(value.unresolvedCount, 0, 10000, 0),
    missingContractCount: clampNumber(value.missingContractCount, 0, 10000, 0),
    mismatchCount: clampNumber(value.mismatchCount, 0, 10000, 0),
    resourceWithoutConstraintCount: clampNumber(value.resourceWithoutConstraintCount, 0, 10000, 0),
    constraintWithoutPreconditionCount: clampNumber(value.constraintWithoutPreconditionCount, 0, 10000, 0),
    score: clampNumber(value.score, 0, 100, 0),
    checks: normalizeDiagnosticChecks(value.checks, 8, "flow-check")
  };
}

function normalizeDiagnosticChecks(value, maximum, prefix) {
  return (Array.isArray(value) ? value : []).slice(0, maximum).map((check, index) => ({
    id: clean(check?.id, 120) || `${prefix}-${index + 1}`,
    label: clean(check?.label, 240) || "Diagnostic check",
    state: ["ready", "review", "attention", "pending"].includes(clean(check?.state, 40)) ? clean(check.state, 40) : "pending",
    statusLabel: clean(check?.statusLabel, 120),
    detail: clean(check?.detail, 1600)
  }));
}

function normalizeSimulationDiagnostics(value) {
  if (!value || typeof value !== "object") return null;
  return {
    state: ["not-submitted", "exported", "review", "completed", "stale"].includes(clean(value.state, 40)) ? clean(value.state, 40) : "not-submitted",
    runCount: clampNumber(value.runCount, 0, 12, 0),
    latestRun: value.latestRun && typeof value.latestRun === "object" ? {
      id: clean(value.latestRun.id, 160),
      adapterName: clean(value.latestRun.adapterName, 160),
      adapterVersion: clean(value.latestRun.adapterVersion, 80),
      packageId: clean(value.latestRun.packageId, 200),
      submittedAt: clean(value.latestRun.submittedAt, 80),
      completedAt: clean(value.latestRun.completedAt, 80),
      status: clean(value.latestRun.status, 40),
      freshness: ["current", "stale", "unverified"].includes(clean(value.latestRun.freshness, 40)) ? clean(value.latestRun.freshness, 40) : "",
      result: value.latestRun.result && typeof value.latestRun.result === "object" ? {
        status: clean(value.latestRun.result.status, 40),
        summary: clean(value.latestRun.result.summary, 1600),
        metricCount: clampNumber(value.latestRun.result.metricCount, 0, 6, 0)
      } : null
    } : null,
    checks: (Array.isArray(value.checks) ? value.checks : []).slice(0, 8).map((check, index) => ({
      id: clean(check?.id, 120) || `simulation-check-${index + 1}`,
      label: clean(check?.label, 240) || "Simulation check",
      state: ["ready", "review", "pending"].includes(clean(check?.state, 40)) ? clean(check.state, 40) : "pending",
      statusLabel: clean(check?.statusLabel, 120),
      detail: clean(check?.detail, 1600)
    }))
  };
}

export function normalizeReportArchiveInput(value) {
  const payload = sanitizeJson(value?.payload, { name: "Report payload", maximumBytes: 1800000 });
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Report payload is required");
  return {
    clientId: normalizeClientId(value?.id, "report-version"),
    title: clean(value?.title || payload?.project?.title, 400) || "Combat concept research",
    scenarioId: clean(value?.scenarioId || payload?.scenario?.id, 160),
    maturity: normalizeMaturity(value?.maturity || payload?.validationMaturity),
    payload
  };
}

export function normalizeModelSnapshotInput(value) {
  const model = value?.model;
  if (!model || typeof model !== "object" || Array.isArray(model)) throw new Error("Model snapshot requires a model");
  const ov5 = normalizeOv5(model.ov5);
  const ooda = normalizeOoda(model.ooda);
  return {
    clientId: normalizeClientId(value?.id, "model-snapshot"),
    title: clean(value?.title, 400) || "Combat concept research",
    direction: clean(value?.direction, 400) || "Unselected direction",
    model: {
      brief: normalizeBriefSnapshot(model.brief),
      inspiration: normalizeSnapshotInspiration(model.inspiration),
      ov1: normalizeOv1Snapshot(model.ov1),
      ov2: optionalDodafProduct(normalizeOv2, model.ov2),
      ov3: optionalDodafProduct(normalizeOv3, model.ov3),
      ov4: optionalDodafProduct(normalizeOv4, model.ov4),
      ov5a: optionalDodafProduct(normalizeOv5a, model.ov5a),
      ov5,
      ov6a: optionalDodafProduct(normalizeOv6a, model.ov6a),
      ov6b: optionalDodafProduct(normalizeOv6b, model.ov6b),
      ov6c: optionalDodafProduct(normalizeOv6c, model.ov6c),
      architecture: optionalDodafProduct(normalizeArchitecture, model.architecture),
      ooda: {
        ...ooda,
        durationMinutes: clampNumber(model.ooda?.durationMinutes, 0, 100000, 0)
      },
      scenario: model.scenario ? normalizeScenario(model.scenario) : null,
      validation: model.validation ? normalizeValidation(model.validation) : null
    }
  };
}

function optionalDodafProduct(normalize, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    return normalize(value);
  } catch {
    return null;
  }
}

function normalizeSnapshotInspiration(value) {
  if (!value || typeof value !== "object") return null;
  const messages = (Array.isArray(value.messages) ? value.messages : [])
    .map((message) => {
      const role = message?.role === "user" ? "user" : message?.role === "assistant" ? "assistant" : "";
      const text = clean(message?.text, 800);
      if (!role || !text) return null;
      return {
        role,
        topic: clean(message?.topic, 64),
        source: ["ai", "local"].includes(clean(message?.source, 16)) ? clean(message.source, 16) : "",
        text,
        createdAt: clean(message?.createdAt, 80)
      };
    })
    .filter(Boolean)
    .slice(-16);
  if (!messages.length) return null;
  return {
    stage: clampNumber(value.stage, 0, 6, 0),
    totalStages: clampNumber(value.totalStages, 1, 6, 6),
    completed: Boolean(value.completed),
    summary: clean(value.summary, 4000),
    messages
  };
}

function normalizeOodaDiagnostics(value) {
  if (!value || typeof value !== "object") return null;
  return {
    windowMinutes: clampNumber(value.windowMinutes, 0, 100000, 0),
    nodeCount: clampNumber(value.nodeCount, 0, 10000, 0),
    completenessScore: clampNumber(value.completenessScore, 0, 100, 0),
    resilienceScore: clampNumber(value.resilienceScore, 0, 100, 0),
    checks: (Array.isArray(value.checks) ? value.checks : []).slice(0, 40).map((check, index) => ({
      id: clean(check?.id, 160) || `check-${index + 1}`,
      label: clean(check?.label, 1000) || "Unnamed check",
      state: clean(check?.state, 40) || "pending",
      statusLabel: clean(check?.statusLabel, 240) || "Pending",
      detail: clean(check?.detail, 8000) || "TBD"
    }))
  };
}

function normalizeBriefSnapshot(value) {
  return {
    objective: clean(value?.objective, 4000) || "TBD",
    approach: clean(value?.approach, 4000) || "TBD",
    assumptions: clean(value?.assumptions, 4000) || "TBD",
    expectedEffects: clean(value?.expectedEffects, 4000) || "TBD",
    evidenceRefs: normalizeStringList(value?.evidenceRefs, 16, 240),
    risk: clean(value?.risk, 4000) || "TBD"
  };
}

function normalizeOv1Snapshot(value) {
  const nodes = (Array.isArray(value?.nodes) ? value.nodes : []).slice(0, 120).map((node, index) => ({
    id: clean(node?.id, 160) || `ov1-node-${index + 1}`,
    label: clean(node?.label, 1000) || "TBD",
    description: clean(node?.description || node?.detail, 8000) || "TBD",
    category: clean(node?.category, 240),
    responsibility: clean(node?.responsibility, 1200),
    input: clean(node?.input, 2000),
    output: clean(node?.output, 2000),
    constraints: clean(node?.constraints, 2000),
    expectedEffects: clean(node?.expectedEffects, 2000),
    kind: ["equipment", "command", "action", "external", "environment", "effect", "participant"].includes(clean(node?.kind, 40)) ? clean(node?.kind, 40) : "equipment",
    evidenceRefs: normalizeStringList(node?.evidenceRefs, 12, 240),
    x: clean(node?.x, 80),
    y: clean(node?.y, 80),
  }));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = (Array.isArray(value?.edges) ? value.edges : []).slice(0, 240).flatMap((edge, index) => {
    const sourceId = clean(edge?.sourceId, 160);
    const targetId = clean(edge?.targetId, 160);
    if (!nodeIds.has(sourceId) || !nodeIds.has(targetId) || sourceId === targetId) return [];
    return [{
      id: clean(edge?.id, 160) || `ov1-edge-${index + 1}`,
      sourceId,
      targetId,
      type: clean(edge?.type, 160) || "relationship"
    }];
  });
  return { nodes, edges, concept: normalizeOv1Concept(value?.concept) };
}

function normalizeMaturity(value) {
  return {
    label: clean(value?.label, 240) || "Pending",
    readyCount: clampNumber(value?.readyCount, 0, 100, 0),
    totalCount: clampNumber(value?.totalCount, 0, 100, 0)
  };
}

function normalizeClientId(value, prefix) {
  const id = clean(value, 180);
  if (!id) return "";
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,179}$/.test(id)) throw new Error(`${prefix} identifier is invalid`);
  return id;
}

function sanitizeJson(value, { name, maximumBytes }) {
  if (value === undefined || value === null) throw new Error(`${name} is required`);
  const normalized = sanitizeValue(value, 0);
  const bytes = Buffer.byteLength(JSON.stringify(normalized), "utf8");
  if (bytes > maximumBytes) throw new Error(`${name} exceeds ${maximumBytes} bytes`);
  return normalized;
}

function sanitizeValue(value, depth) {
  if (depth > 18) throw new Error("JSON payload nesting exceeds the limit");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") return value.slice(0, 30000);
  if (Array.isArray(value)) return value.slice(0, 1000).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value === "object") {
    return Object.entries(value).slice(0, 500).reduce((result, [key, item]) => {
      result[clean(key, 240) || "field"] = sanitizeValue(item, depth + 1);
      return result;
    }, {});
  }
  return String(value).slice(0, 30000);
}

function normalizeRedTeamReview(value) {
  if (!value || typeof value !== "object") return null;
  return {
    mode: clean(value.mode, 40) || "fallback",
    provider: clean(value.provider, 160),
    model: clean(value.model, 240),
    generatedAt: clean(value.generatedAt, 80),
    summary: clean(value.summary, 12000),
    evidenceSelection: normalizeEvidenceSelection(value.evidenceSelection),
    findings: (Array.isArray(value.findings) ? value.findings : []).slice(0, 80).map((finding, index) => ({
      id: clean(finding?.id, 160) || `finding-${index + 1}`,
      severity: ["high", "medium", "low"].includes(clean(finding?.severity, 20)) ? clean(finding.severity, 20) : "medium",
      title: clean(finding?.title, 1000) || "Unnamed finding",
      analysis: clean(finding?.analysis, 12000) || "TBD",
      recommendation: clean(finding?.recommendation, 12000) || "TBD",
      evidenceRefs: normalizeStringList(finding?.evidenceRefs, 30, 400)
    }))
  };
}

function normalizeProvenance(value) {
  if (!value || typeof value !== "object") return {};
  return {
    provenance: {
      mode: clean(value.mode, 40) || "manual",
      generatedAt: clean(value.generatedAt, 80),
      evidenceCount: clampNumber(value.evidenceCount, 0, 100000, 0),
      evidenceSelection: normalizeEvidenceSelection(value.evidenceSelection)
    }
  };
}

function normalizeEvidenceSelection(value) {
  if (!value || typeof value !== "object") return null;
  return {
    source: clean(value.source, 20) === "server" ? "server" : "local",
    indexMode: clean(value.indexMode, 40) || "keyword",
    query: clean(value.query, 480),
    count: clampNumber(value.count, 0, 8, 0),
    fallback: Boolean(value.fallback),
    sensitiveExcludedCount: clampNumber(value.sensitiveExcludedCount, 0, 100000, 0),
    projectRevision: clampNumber(value.projectRevision, 0, Number.MAX_SAFE_INTEGER, 0),
    resourceRevision: clampNumber(value.resourceRevision, 0, Number.MAX_SAFE_INTEGER, 0),
    selectedAt: clean(value.selectedAt, 80)
  };
}

function normalizePosition(value) {
  const values = Array.isArray(value) ? value : [];
  return [clampNumber(values[0], 0, 100, 50), clampNumber(values[1], 0, 100, 50)];
}

function normalizeStringList(value, maximumItems, maximumLength) {
  return (Array.isArray(value) ? value : [])
    .map((item) => clean(item, maximumLength))
    .filter(Boolean)
    .slice(0, maximumItems);
}

function clampNumber(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function clean(value, maximum) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
}
