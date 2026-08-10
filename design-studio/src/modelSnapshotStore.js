import { getOodaDuration } from "./oodaStore.js";

const STORAGE_KEY = "concept-studio-model-snapshots-v1";
const MAX_SNAPSHOTS = 12;

export function loadModelSnapshots() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved?.snapshots)) return saved.snapshots.filter(isSnapshot).slice(0, MAX_SNAPSHOTS);
  } catch {
    // Invalid browser storage is treated as an empty local history.
  }
  return [];
}

export function saveModelSnapshot(context, snapshots = []) {
  const current = snapshots.filter(isSnapshot).slice(0, MAX_SNAPSHOTS);
  const number = current.reduce((highest, item) => Math.max(highest, Number(item.number) || 0), 0) + 1;
  const savedAt = new Date().toISOString();
  const snapshot = {
    id: createId(),
    number,
    label: `M${String(number).padStart(3, "0")}`,
    savedAt,
    title: clean(context?.project?.title) || "作战概念研究",
    direction: clean(context?.direction) || "未选择方向",
    model: clone(buildModel(context))
  };
  const next = [snapshot, ...current].slice(0, MAX_SNAPSHOTS);
  persistModelSnapshots(next);
  return next;
}

/** Collect full workbench state for a DM2-complete snapshot. */
export function snapshotContextFromState(state, project) {
  return {
    project,
    direction: state.direction,
    brief: state.brief,
    inspiration: state.inspiration,
    ov1: state.ov1,
    ov2: state.ov2,
    ov3: state.ov3,
    ov4: state.ov4,
    ov5a: state.ov5a,
    ov5: state.ov5,
    ov6a: state.ov6a,
    ov6b: state.ov6b,
    ov6c: state.ov6c,
    architecture: state.architecture,
    ooda: state.ooda,
    scenario: state.scenario,
    validationResult: state.validationResult
  };
}

export function deleteModelSnapshot(snapshotId, snapshots = []) {
  const current = snapshots.filter(isSnapshot).slice(0, MAX_SNAPSHOTS);
  const next = current.filter((item) => item.id !== snapshotId);
  if (next.length === current.length) return current;
  persistModelSnapshots(next);
  return next;
}

export function persistModelSnapshots(snapshots = []) {
  const next = snapshots.filter(isSnapshot).slice(0, MAX_SNAPSHOTS);
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ snapshots: next }));
    }
  } catch {
    // Node acceptance tests still return the in-memory snapshot list.
  }
  return next;
}

export function upsertModelSnapshot(snapshot, snapshots = []) {
  if (!isSnapshot(snapshot)) return persistModelSnapshots(snapshots);
  const next = [snapshot, ...snapshots.filter((item) => item.id !== snapshot.id)]
    .sort((left, right) => String(right.savedAt || "").localeCompare(String(left.savedAt || "")))
    .slice(0, MAX_SNAPSHOTS);
  return persistModelSnapshots(next);
}

function buildModel(context) {
  const ov1 = context?.ov1 || {};
  const ov5 = context?.ov5 || {};
  const ooda = context?.ooda || { lanes: [] };
  return {
    brief: clone(context?.brief || {}),
    inspiration: clone(context?.inspiration || null),
    ov1: cloneProduct(ov1, { nodes: [], edges: [] }),
    ov2: cloneOptionalProduct(context?.ov2),
    ov3: cloneOptionalProduct(context?.ov3),
    ov4: cloneOptionalProduct(context?.ov4),
    ov5a: cloneOptionalProduct(context?.ov5a),
    ov5: cloneProduct(ov5, { activities: [], edges: [], provenance: null }),
    ov6a: cloneOptionalProduct(context?.ov6a),
    ov6b: cloneOptionalProduct(context?.ov6b),
    ov6c: cloneOptionalProduct(context?.ov6c),
    architecture: cloneOptionalProduct(context?.architecture),
    ooda: {
      sourceActivityIds: clone(ooda.sourceActivityIds || []),
      lanes: clone(ooda.lanes || []),
      durationMinutes: getOodaDuration(ooda),
      provenance: clone(ooda.provenance || null)
    },
    scenario: clone(context?.scenario || null),
    validation: clone(context?.validationResult || null)
  };
}

function cloneOptionalProduct(value) {
  if (!value || typeof value !== "object") return null;
  return clone(value);
}

function cloneProduct(value, fallback) {
  if (!value || typeof value !== "object") return clone(fallback);
  return clone(value);
}

function isSnapshot(value) {
  return Boolean(value && typeof value.id === "string" && value.model && typeof value.model === "object");
}

function createId() {
  const randomId = globalThis.crypto?.randomUUID?.();
  return `model-snapshot-${randomId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function clean(value) {
  return String(value || "").trim();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
