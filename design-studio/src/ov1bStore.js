import { normalizeDodafOv1b } from "../../shared/dodaf/products.js";

export function buildOv1bModel(state = {}) {
  const existing = state.ov1b && typeof state.ov1b === "object" ? state.ov1b : {};
  return normalizeDodafOv1b({
    ...existing,
    derivedFrom: existing.derivedFrom || {
      mode: "seeded",
      sources: ["forceMissionPlan"],
      generatedAt: new Date().toISOString(),
      note: "task-reference-only"
    },
    decompositions: existing.decompositions || []
  });
}

export function addOv1bDecomposition(model, { parentTaskRef, childTaskRef, rationale = "" } = {}) {
  const next = structuredClone(model || {});
  next.decompositions = Array.isArray(next.decompositions) ? next.decompositions : [];
  const parent = String(parentTaskRef || "").trim();
  const child = String(childTaskRef || "").trim();
  if (!parent || !child || parent === child) return normalizeDodafOv1b(next);
  if (next.decompositions.some((item) => item.parentTaskRef === parent && item.childTaskRef === child)) return normalizeDodafOv1b(next);
  next.decompositions.push({
    id: `task-decomposition-${Date.now().toString(36)}`,
    parentTaskRef: parent,
    childTaskRef: child,
    rationale: String(rationale || "").trim(),
    status: "pending_review",
    sourceRefs: [
      { resource: "forceMissionPlan", objectId: parent },
      { resource: "forceMissionPlan", objectId: child }
    ]
  });
  next.status = "pending_review";
  next.derivedFrom = null;
  return normalizeDodafOv1b(next);
}

export function updateOv1bDecomposition(model, id, patch = {}) {
  const next = structuredClone(model || {});
  const item = (next.decompositions || []).find((entry) => entry.id === id);
  if (!item) return normalizeDodafOv1b(next);
  if (patch.rationale !== undefined) item.rationale = String(patch.rationale || "").trim();
  if (patch.status !== undefined) item.status = ["pending_review", "confirmed", "stale", "conflict"].includes(patch.status) ? patch.status : "pending_review";
  item.confirmedAt = item.status === "confirmed" ? item.confirmedAt || new Date().toISOString() : "";
  next.status = (next.decompositions || []).length && (next.decompositions || []).every((entry) => entry.status === "confirmed") ? "confirmed" : "pending_review";
  next.derivedFrom = null;
  return normalizeDodafOv1b(next);
}

export function removeOv1bDecomposition(model, id) {
  const next = structuredClone(model || {});
  next.decompositions = (next.decompositions || []).filter((item) => item.id !== id);
  next.status = next.decompositions.length && next.decompositions.every((item) => item.status === "confirmed") ? "confirmed" : "draft";
  next.derivedFrom = null;
  return normalizeDodafOv1b(next);
}
