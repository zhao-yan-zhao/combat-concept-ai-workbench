import { activities as seedActivities } from "./data.js";
import { normalizeDodafOv5 } from "../../shared/dodaf/products.js";

const STORAGE_KEY = "concept-studio-ov5-model-v1";

function createSeedModel() {
  const activities = seedActivities.map((activity) => ({ ...activity, refs: [...activity.refs], sourceOv1NodeIds: [...(activity.sourceOv1NodeIds || [])] }));
  const raw = {
    version: 1,
    activities,
    edges: activities.slice(0, -1).map((activity, index) => ({
      id: `edge-${activity.id}-${activities[index + 1].id}`,
      sourceId: activity.id,
      targetId: activities[index + 1].id,
      type: index === 2 ? "控制流" : "信息流"
    }))
  };
  try {
    return normalizeDodafOv5(raw);
  } catch {
    return raw;
  }
}

export function loadOv5Model() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (isValidModel(saved)) return normalizeOv5Model(saved);
  } catch {
    // Invalid browser storage falls back to the seed model.
  }
  return createSeedModel();
}

export function hasPersistedOv5Model() {
  try {
    return isValidModel(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return false;
  }
}

export function normalizeOv5Model(model) {
  if (!isValidModel(model)) return createSeedModel();
  try {
    return normalizeDodafOv5(model);
  } catch {
    return model;
  }
}

export function persistOv5Model(model) {
  const normalized = normalizeOv5Model(model);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Node acceptance tests still receive the normalized model.
  }
  return normalized;
}

export function addActivity(model) {
  const activity = {
    id: `activity-${Date.now()}`,
    type: "待分类",
    title: "新作战活动",
    text: "补充该活动的任务说明。",
    input: "待定义",
    output: "待定义",
    duration: "待估算",
    parentId: "",
    resources: "",
    preconditions: "",
    constraints: "",
    refs: [],
    sourceOv1NodeIds: []
  };
  model.activities.push(activity);
  persistOv5Model(model);
  return activity;
}

export function updateActivity(model, activityId, patch) {
  const activity = model.activities.find((item) => item.id === activityId);
  if (!activity) return null;
  const next = { ...patch };
  if (Object.hasOwn(next, "parentId") && !canAssignActivityParent(model, activityId, next.parentId)) next.parentId = "";
  Object.assign(activity, next);
  persistOv5Model(model);
  return activity;
}

export function getAssignableParentActivities(model, activityId) {
  return (model?.activities || []).filter((activity) => canAssignActivityParent(model, activityId, activity.id));
}

function canAssignActivityParent(model, activityId, candidateId) {
  const parentId = String(candidateId || "").trim();
  if (!parentId) return true;
  const byId = new Map((model?.activities || []).map((activity) => [activity.id, activity]));
  if (!byId.has(parentId) || parentId === activityId) return false;
  const seen = new Set([activityId]);
  let currentId = parentId;
  while (currentId) {
    if (seen.has(currentId)) return false;
    seen.add(currentId);
    currentId = byId.get(currentId)?.parentId || "";
  }
  return true;
}

export function deleteActivity(model, activityId) {
  if (model.activities.length <= 1) return false;
  model.activities = model.activities.filter((item) => item.id !== activityId);
  model.edges = model.edges.filter((edge) => edge.sourceId !== activityId && edge.targetId !== activityId);
  persistOv5Model(model);
  return true;
}

export function addEdge(model, sourceId, targetId, type = "信息流", { payload = "", condition = "" } = {}) {
  if (!sourceId || !targetId || sourceId === targetId) return null;
  const exists = model.edges.some((edge) => edge.sourceId === sourceId && edge.targetId === targetId);
  if (exists) return null;
  const edge = {
    id: `edge-${sourceId}-${targetId}-${Date.now()}`,
    sourceId,
    targetId,
    type,
    payload: String(payload || "").trim().slice(0, 4000),
    condition: String(condition || "").trim().slice(0, 4000)
  };
  model.edges.push(edge);
  persistOv5Model(model);
  return edge;
}

export function deleteEdge(model, edgeId) {
  model.edges = model.edges.filter((edge) => edge.id !== edgeId);
  persistOv5Model(model);
}

function isValidModel(model) {
  return Boolean(
    model
    && model.version === 1
    && Array.isArray(model.activities)
    && Array.isArray(model.edges)
  );
}
