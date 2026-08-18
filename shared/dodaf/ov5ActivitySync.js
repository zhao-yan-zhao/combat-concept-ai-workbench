/**
 * Synchronize OV-5b Activity ownership with OV-5a decomposition references.
 * OV-5b owns activity bodies; OV-5a owns only parent/child relationships.
 */

import { normalizeDodafOv5, normalizeDodafOv5a } from "./products.js";
import { clean } from "./util.js";

export function applyOv5bToOv5a(ov5, ov5a = null) {
  const activityModel = normalizeDodafOv5(ov5 || { activities: [], edges: [] });
  const existing = normalizeDodafOv5a(ov5a || { decompositions: [] });
  const activityIds = new Set(activityModel.activities.map((activity) => String(activity.id)));
  const existingByPair = new Map((existing.decompositions || []).map((item) => [pairKey(item.parentActivityRef, item.childActivityRef), item]));
  const decompositions = activityModel.activities.flatMap((activity) => {
    const childActivityRef = String(activity.id);
    const parentActivityRef = clean(activity.parentId, 160);
    if (!parentActivityRef || parentActivityRef === childActivityRef || !activityIds.has(parentActivityRef)) return [];
    const previous = existingByPair.get(pairKey(parentActivityRef, childActivityRef));
    return [{
      ...(previous || {}),
      parentActivityRef,
      childActivityRef,
      status: previous?.status || "pending_review"
    }];
  });

  // Keep broken imported references visible until a researcher resolves them.
  (existing.decompositions || []).forEach((item) => {
    if (activityIds.has(item.parentActivityRef) && activityIds.has(item.childActivityRef)) return;
    decompositions.push({ ...item, status: "conflict" });
  });

  return normalizeDodafOv5a({
    ...existing,
    decompositions,
    derivedFrom: {
      mode: "synced",
      sources: ["ov5"],
      generatedAt: new Date().toISOString(),
      note: "synced-from-ov5b"
    }
  });
}

export function applyOv5aToOv5b(ov5a, ov5) {
  const decompositionModel = normalizeDodafOv5a(ov5a || { decompositions: [] });
  const activityModel = normalizeDodafOv5(ov5 || { activities: [], edges: [] });
  const activityIds = new Set(activityModel.activities.map((activity) => String(activity.id)));
  const parentByChild = new Map();

  (decompositionModel.decompositions || []).forEach((item) => {
    if (!activityIds.has(item.childActivityRef) || !activityIds.has(item.parentActivityRef)) return;
    if (item.childActivityRef === item.parentActivityRef) return;
    parentByChild.set(item.childActivityRef, item.parentActivityRef);
  });

  const activities = activityModel.activities.map((activity) => {
    const id = String(activity.id);
    const parentId = parentByChild.get(id) || "";
    return {
      ...activity,
      parentId: parentId && !introducesCycle(id, parentId, parentByChild) ? parentId : ""
    };
  });

  return normalizeDodafOv5({
    ...activityModel,
    activities,
    edges: activityModel.edges,
    provenance: activityModel.provenance,
    derivedFrom: activityModel.derivedFrom || null
  });
}

export function setOv5aParent(ov5a, childActivityRef, parentActivityRef) {
  const model = normalizeDodafOv5a(ov5a || { decompositions: [] });
  const childRef = clean(childActivityRef, 160);
  const parentRef = clean(parentActivityRef, 160);
  if (!childRef || childRef === parentRef) return model;
  const decompositions = (model.decompositions || []).filter((item) => item.childActivityRef !== childRef);
  if (parentRef) decompositions.push({ parentActivityRef: parentRef, childActivityRef: childRef, status: "pending_review" });
  return normalizeDodafOv5a({ ...model, decompositions });
}

/** @param {{ ov5: object, ov5a: object|null, source: "ov5"|"ov5a" }} input */
export function syncOv5ActivityPair({ ov5, ov5a = null, source = "ov5" } = {}) {
  if (source === "ov5a") {
    const nextOv5 = applyOv5aToOv5b(ov5a, ov5 || { activities: [], edges: [] });
    const nextOv5a = applyOv5bToOv5a(nextOv5, ov5a);
    return { ov5: nextOv5, ov5a: nextOv5a, source: "ov5a" };
  }
  const nextOv5 = normalizeDodafOv5(ov5 || { activities: [], edges: [] });
  const nextOv5a = applyOv5bToOv5a(nextOv5, ov5a);
  return { ov5: nextOv5, ov5a: nextOv5a, source: "ov5" };
}

function introducesCycle(activityId, parentId, parentByChild) {
  const seen = new Set([activityId]);
  let currentId = parentId;
  while (currentId) {
    if (seen.has(currentId)) return true;
    seen.add(currentId);
    currentId = parentByChild.get(currentId) || "";
  }
  return false;
}

function pairKey(parentRef, childRef) {
  return `${String(parentRef || "")}:${String(childRef || "")}`;
}
