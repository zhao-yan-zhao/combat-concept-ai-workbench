/**
 * Bidirectional Activity sync between OV-5b (activities/parentId) and OV-5a (decomposition tree).
 */

import { normalizeDodafOv5, normalizeDodafOv5a } from "./products.js";
import { clean } from "./util.js";

/**
 * Rebuild OV-5a tree from OV-5b activities.parentId.
 */
export function applyOv5bToOv5a(ov5, ov5a = null) {
  const activities = Array.isArray(ov5?.activities) ? ov5.activities : [];
  const byParent = new Map(activities.map((activity) => [String(activity.id), []]));
  const roots = [];
  activities.forEach((activity) => {
    const parentId = clean(activity.parentId, 160);
    if (parentId && byParent.has(parentId) && parentId !== String(activity.id)) {
      byParent.get(parentId).push(activity);
    } else {
      roots.push(activity);
    }
  });
  const tree = roots.map((activity) => toTreeNode(activity, byParent, new Set()));
  return normalizeDodafOv5a({
    ...(ov5a || {}),
    tree,
    derivedFrom: {
      mode: "synced",
      sources: ["ov5"],
      generatedAt: new Date().toISOString(),
      note: "synced-from-ov5b"
    },
    diagnostics: Array.isArray(ov5a?.diagnostics) ? ov5a.diagnostics : []
  });
}

/**
 * Push OV-5a hierarchy/title/type back onto OV-5b activities (same Activity ids).
 * Does not delete OV-5b activities missing from the tree; only updates matches and can add missing parents.
 */
export function applyOv5aToOv5b(ov5a, ov5) {
  const flat = flattenTree(ov5a?.tree || []);
  const byId = new Map(flat.map((node) => [node.id, node]));
  const activities = Array.isArray(ov5?.activities) ? ov5.activities.map((activity) => ({ ...activity })) : [];
  const activityIds = new Set(activities.map((activity) => String(activity.id)));

  activities.forEach((activity) => {
    const node = byId.get(String(activity.id));
    if (!node) return;
    activity.title = clean(node.title, 4000) || activity.title;
    activity.type = clean(node.type, 4000) || activity.type;
    const parentId = clean(node.parentId, 160);
    if (!parentId || parentId === activity.id || !byId.has(parentId) && !activityIds.has(parentId)) {
      activity.parentId = parentId && activityIds.has(parentId) ? parentId : "";
    } else {
      activity.parentId = introducesCycle(activity.id, parentId, byId) ? "" : parentId;
    }
  });

  // Activities present only in the tree are appended as shallow Activity shells.
  flat.forEach((node) => {
    if (activityIds.has(node.id)) return;
    activities.push({
      id: node.id,
      type: clean(node.type, 4000) || "TBD",
      title: clean(node.title, 4000) || node.id,
      text: "TBD",
      input: "TBD",
      output: "TBD",
      duration: "TBD",
      parentId: clean(node.parentId, 160) && activityIds.has(node.parentId) ? node.parentId : "",
      refs: [],
      sourceOv1NodeIds: [],
      resources: "",
      preconditions: "",
      constraints: ""
    });
    activityIds.add(node.id);
  });

  // Second pass: assign parents for newly added nodes once all ids exist.
  activities.forEach((activity) => {
    const node = byId.get(String(activity.id));
    if (!node) return;
    const parentId = clean(node.parentId, 160);
    if (parentId && activityIds.has(parentId) && parentId !== activity.id && !introducesCycleFromActivities(activity.id, parentId, activities)) {
      activity.parentId = parentId;
    }
  });

  return normalizeDodafOv5({
    ...ov5,
    activities,
    edges: Array.isArray(ov5?.edges) ? ov5.edges : [],
    provenance: ov5?.provenance,
    derivedFrom: ov5?.derivedFrom || null
  });
}

/**
 * @param {{ ov5: object, ov5a: object|null, source: "ov5"|"ov5a" }} input
 */
export function syncOv5ActivityPair({ ov5, ov5a = null, source = "ov5" } = {}) {
  if (source === "ov5a") {
    const nextOv5 = applyOv5aToOv5b(ov5a, ov5 || { activities: [], edges: [] });
    const nextOv5a = applyOv5bToOv5a(nextOv5, ov5a);
    return { ov5: nextOv5, ov5a: nextOv5a, source: "ov5a" };
  }
  const nextOv5 = normalizeDodafOv5(ov5 || { activities: [{ id: "activity-1", title: "TBD", type: "TBD", text: "TBD", input: "TBD", output: "TBD", duration: "TBD" }], edges: [] });
  const nextOv5a = applyOv5bToOv5a(nextOv5, ov5a);
  return { ov5: nextOv5, ov5a: nextOv5a, source: "ov5" };
}

function toTreeNode(activity, byParent, visited) {
  const id = String(activity.id);
  if (visited.has(id)) return { id, title: label(activity), type: clean(activity.type, 120), children: [], cycle: true };
  const next = new Set(visited);
  next.add(id);
  return {
    id,
    title: label(activity),
    type: clean(activity.type, 120),
    children: (byParent.get(id) || []).map((child) => toTreeNode(child, byParent, next))
  };
}

function flattenTree(nodes, parentId = "", acc = []) {
  for (const node of nodes || []) {
    const id = clean(node?.id, 160);
    if (!id) continue;
    acc.push({
      id,
      title: clean(node?.title || node?.name || node?.label, 240) || id,
      type: clean(node?.type, 120),
      parentId
    });
    flattenTree(node?.children, id, acc);
  }
  return acc;
}

function introducesCycle(activityId, parentId, byId) {
  const seen = new Set([String(activityId)]);
  let currentId = parentId;
  while (currentId) {
    if (seen.has(currentId)) return true;
    seen.add(currentId);
    currentId = byId.get(currentId)?.parentId || "";
  }
  return false;
}

function introducesCycleFromActivities(activityId, parentId, activities) {
  const byId = new Map(activities.map((activity) => [String(activity.id), activity]));
  const seen = new Set([String(activityId)]);
  let currentId = parentId;
  while (currentId) {
    if (seen.has(currentId)) return true;
    seen.add(currentId);
    currentId = clean(byId.get(currentId)?.parentId, 160);
  }
  return false;
}

function label(activity) {
  return clean(activity?.title, 240) || String(activity?.id || "activity");
}
