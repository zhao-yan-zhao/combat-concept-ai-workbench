const STORAGE_KEY = "concept-studio-scenario-v1";
import { buildScenarioGeoJson } from "./scenarioGeoJsonBuilder.js";
import { applyScenarioDeploymentPlan, planScenarioDeployment } from "./scenarioDeploymentPlanner.js";
import { createOv5SourceSignature } from "./oodaStore.js";

const placementRules = [
  { types: ["感知", "识别"], label: "多源感知节点", role: "sensor", position: [20, 27], className: "" },
  { types: ["决策"], label: "协同控制节点", role: "command", position: [43, 49], className: "" },
  { types: ["行动"], label: "行动单元", role: "action", position: [65, 62], className: "red" },
  { types: ["控制", "评估"], label: "保障与评估节点", role: "support", position: [31, 73], className: "" }
];

export function hasPersistedScenario() {
  try {
    return isValidScenario(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return false;
  }
}

export function loadScenario() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (isValidScenario(saved)) return saved;
  } catch {
    // Invalid local state is treated as no generated scenario.
  }
  return null;
}

export function generateScenario(ov5Model, oodaModel) {
  const entities = placementRules.map((rule) => {
    const activity = ov5Model.activities.find((item) => rule.types.includes(item.type));
    return {
      id: `entity-${rule.role}`,
      label: activity?.title || rule.label,
      role: rule.role,
      position: rule.position,
      className: rule.className,
      sourceActivityId: activity?.id || "",
      sourceOodaIds: getOodaIdsForActivity(oodaModel, activity?.id),
      sourceKnowledgeRefs: getKnowledgeRefsForActivity(ov5Model, oodaModel, activity?.id)
    };
  });

  entities.push({
    id: "entity-opponent",
    label: "对手态势节点",
    role: "opponent",
    position: [74, 28],
    className: "blue",
    sourceActivityId: "",
    sourceOodaIds: [],
    sourceKnowledgeRefs: []
  });

  const timeline = buildTimeline(oodaModel);
  const draft = {
    version: 1,
    id: `scenario-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    derivedAt: new Date().toISOString(),
    sourceOv5Signature: createOv5SourceSignature(ov5Model),
    sourceOodaSignature: createOodaSourceSignature(oodaModel),
    stale: false,
    staleReason: "",
    source: {
      activityIds: ov5Model.activities.map((item) => item.id),
      oodaNodeIds: oodaModel.lanes.flatMap((lane) => lane.nodes.map((node) => node.id))
    },
    entities,
    areas: [
      { id: "coverage", label: "态势覆盖区", type: "coverage", position: [68, 26], size: 190 },
      { id: "window", label: "行动窗口", type: "window", position: [27, 73], size: 130 }
    ],
    timeline
  };
  const scenario = applyScenarioDeploymentPlan(draft, planScenarioDeployment(draft));
  persistScenario(scenario);
  return scenario;
}

/** Compact OODA fingerprint for scenario freshness (node set + titles + activity links). */
export function createOodaSourceSignature(oodaModel = {}) {
  return JSON.stringify({
    sourceActivityIds: Array.isArray(oodaModel?.sourceActivityIds)
      ? [...oodaModel.sourceActivityIds].map(String).sort()
      : [],
    nodes: (Array.isArray(oodaModel?.lanes) ? oodaModel.lanes : []).flatMap((lane) =>
      (lane.nodes || []).map((node) => ({
        id: String(node.id || ""),
        title: String(node.title || ""),
        sourceActivityId: String(node.sourceActivityId || ""),
        duration: String(node.duration || "")
      }))
    )
  });
}

export function isScenarioStale(scenario, ov5Model, oodaModel) {
  if (!scenario) return false;
  if (scenario.stale) return true;
  if (scenario.sourceOv5Signature || scenario.sourceOodaSignature) {
    if (scenario.sourceOv5Signature && scenario.sourceOv5Signature !== createOv5SourceSignature(ov5Model)) return true;
    if (scenario.sourceOodaSignature && scenario.sourceOodaSignature !== createOodaSourceSignature(oodaModel)) return true;
    return false;
  }
  // Legacy scenarios: compare stored source id sets when present.
  const activityIds = new Set((ov5Model?.activities || []).map((item) => String(item.id)));
  const oodaIds = new Set((oodaModel?.lanes || []).flatMap((lane) => (lane.nodes || []).map((node) => String(node.id))));
  const sourceActivities = Array.isArray(scenario.source?.activityIds) ? scenario.source.activityIds.map(String) : [];
  const sourceOoda = Array.isArray(scenario.source?.oodaNodeIds) ? scenario.source.oodaNodeIds.map(String) : [];
  if (sourceActivities.length && sourceActivities.some((id) => !activityIds.has(id))) return true;
  if (sourceOoda.length && sourceOoda.some((id) => !oodaIds.has(id))) return true;
  if (sourceActivities.length && sourceActivities.length !== activityIds.size) return true;
  if (sourceOoda.length && sourceOoda.length !== oodaIds.size) return true;
  return false;
}

export function getScenarioFreshness(scenario, ov5Model, oodaModel) {
  if (!scenario) {
    return { stale: false, ran: false, reason: "", derivedAt: "" };
  }
  const stale = isScenarioStale(scenario, ov5Model, oodaModel);
  if (!stale) {
    return {
      stale: false,
      ran: true,
      reason: "",
      derivedAt: scenario.derivedAt || scenario.generatedAt || ""
    };
  }
  return {
    stale: true,
    ran: true,
    reason: scenario.staleReason || "OV-5 或 OODA 已变更，当前想定仅供参考，建议重新生成。",
    derivedAt: scenario.derivedAt || scenario.generatedAt || ""
  };
}

export function markScenarioStale(scenario, reason = "") {
  if (!scenario) return null;
  const next = {
    ...scenario,
    stale: true,
    staleAt: new Date().toISOString(),
    staleReason: String(reason || "上游模型已变更，上次想定仅供参考，请重新生成。").slice(0, 240)
  };
  persistScenario(next);
  return next;
}

export function persistScenario(scenario) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenario));
}

export function clearScenario() {
  localStorage.removeItem(STORAGE_KEY);
}

export function createDeploymentData(scenario) {
  if (!scenario) return null;
  return {
    version: 1,
    scenarioId: scenario.id,
    entities: scenario.entities.map((entity) => ({
      id: entity.id,
      label: entity.label,
      role: entity.role,
      position: entity.position,
      sourceActivityId: entity.sourceActivityId,
      sourceOodaIds: entity.sourceOodaIds || [],
      sourceKnowledgeRefs: entity.sourceKnowledgeRefs || []
    })),
    areas: scenario.areas,
    timeline: scenario.timeline,
    deploymentPlan: scenario.deploymentPlan || null,
    geojson: buildScenarioGeoJson(scenario),
    generatedAt: scenario.generatedAt,
    updatedAt: scenario.updatedAt || scenario.generatedAt
  };
}

export function applyDeploymentChanges(scenario, changes, deploymentReview = null) {
  if (!scenario || !Array.isArray(changes)) return scenario;
  const positions = new Map(changes.map((change) => [change.entityId, change.position]));
  const next = {
    ...scenario,
    updatedAt: new Date().toISOString(),
    deploymentReview: deploymentReview ? { ...deploymentReview } : scenario.deploymentReview || null,
    deploymentPlan: scenario.deploymentPlan ? { ...scenario.deploymentPlan, state: "review", reviewedAt: new Date().toISOString() } : null,
    entities: scenario.entities.map((entity) => {
      const position = positions.get(entity.id);
      return position ? { ...entity, position: position.map(clampPosition) } : entity;
    })
  };
  persistScenario(next);
  return next;
}

export function recommendScenarioDeployment(scenario) {
  const next = applyScenarioDeploymentPlan(scenario, planScenarioDeployment(scenario));
  persistScenario(next);
  return next;
}

function buildTimeline(oodaModel) {
  let elapsed = 0;
  const timeline = [];
  for (const lane of oodaModel.lanes) {
    for (const node of lane.nodes) {
      timeline.push({
        id: `event-${node.id}`,
        time: `T+${String(elapsed).padStart(2, "0")}`,
        title: node.title,
        description: node.text,
        sourceNodeId: node.id
      });
      elapsed += parseMinutes(node.duration);
    }
  }
  return timeline;
}

function getOodaIdsForActivity(oodaModel, activityId) {
  if (!activityId) return [];
  return oodaModel.lanes.flatMap((lane) => lane.nodes)
    .filter((node) => node.sourceActivityId === activityId)
    .map((node) => node.id);
}

function getKnowledgeRefsForActivity(ov5Model, oodaModel, activityId) {
  if (!activityId) return [];
  const activity = (ov5Model?.activities || []).find((item) => item.id === activityId);
  const nodeRefs = (oodaModel?.lanes || []).flatMap((lane) => lane.nodes || [])
    .filter((node) => node.sourceActivityId === activityId)
    .flatMap((node) => node.knowledgeRefs || []);
  return [...new Set([...(activity?.refs || []), ...nodeRefs].map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 16);
}

function parseMinutes(value) {
  const match = String(value || "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function clampPosition(value) {
  return Math.min(100, Math.max(0, Number(value)));
}

function isValidScenario(value) {
  return Boolean(
    value
    && value.version === 1
    && Array.isArray(value.entities)
    && Array.isArray(value.timeline)
  );
}
