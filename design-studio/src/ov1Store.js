import { ov1Nodes } from "./data.js";
import { normalizeDodafOv1 } from "../../shared/dodaf/products.js";
import { normalizeWorldPosition, repairLegacyCompressedOv1Nodes } from "./ov1Canvas.js";
import { layoutOv1Nodes } from "../../shared/ov1Layout.js";

const STORAGE_KEY = "concept-studio-ov1-v1";
const RELATION_TYPES = ["信息流", "控制流", "态势变化", "反馈"];

const DEFAULT_EDGES = [
  { id: "ov1-edge-sense-decide", sourceId: "sense", targetId: "decide", type: "信息流" },
  { id: "ov1-edge-decide-control", sourceId: "decide", targetId: "control", type: "控制流" },
  { id: "ov1-edge-opponent-decide", sourceId: "opponent", targetId: "decide", type: "态势变化" },
  { id: "ov1-edge-control-assess", sourceId: "control", targetId: "assess", type: "反馈" },
  { id: "ov1-edge-assess-sense", sourceId: "assess", targetId: "sense", type: "反馈" }
];

export { RELATION_TYPES as ov1RelationTypes };

export function createOv1Model() {
  return normalizeOv1Model({ edges: DEFAULT_EDGES });
}

export function loadOv1Model() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) return normalizeOv1Model(saved);
  } catch {
    // Invalid browser-local state falls back to the stable baseline.
  }
  return createOv1Model();
}

export function hasPersistedOv1Model() {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

export function saveOv1Model(model) {
  const normalized = normalizeOv1Model(model);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // A blocked local store should not stop the active editing session.
  }
  return normalized;
}

export function addOv1Edge(model, { sourceId, targetId, type }) {
  const current = normalizeOv1Model(model);
  const source = clean(sourceId);
  const target = clean(targetId);
  const relationType = normalizeRelationType(type);
  const nodeIds = new Set(current.nodes.map((node) => node.id));
  const duplicate = current.edges.some((edge) => edge.sourceId === source && edge.targetId === target && edge.type === relationType);
  if (!nodeIds.has(source) || !nodeIds.has(target) || source === target || duplicate) return null;
  return saveOv1Model({
    ...current,
    edges: [...current.edges, { id: createId(), sourceId: source, targetId: target, type: relationType }]
  });
}

export function addOv1Node(model, values = {}) {
  const current = normalizeOv1Model(model);
  const position = nextNodePosition(current.nodes);
  const node = normalizeNode({
    id: createId(),
    label: values.label || "新概念节点",
    detail: values.detail || "补充该总体概念节点的任务、约束或预期效果。",
    className: values.className || "",
    x: values.x ?? position.x,
    y: values.y ?? position.y
  });
  if (!node) return null;
  return saveOv1Model({ ...current, nodes: [...current.nodes, node] });
}

export function deleteOv1Node(model, id) {
  const current = normalizeOv1Model(model);
  const nodeId = clean(id);
  if (current.nodes.length <= 1 || !current.nodes.some((node) => node.id === nodeId)) return null;
  return saveOv1Model({
    ...current,
    nodes: current.nodes.filter((node) => node.id !== nodeId),
    edges: current.edges.filter((edge) => edge.sourceId !== nodeId && edge.targetId !== nodeId)
  });
}

export function deleteOv1Edge(model, id) {
  const current = normalizeOv1Model(model);
  const edgeId = clean(id);
  const edges = current.edges.filter((edge) => edge.id !== edgeId);
  if (edges.length === current.edges.length) return null;
  return saveOv1Model({ ...current, edges });
}

export function updateOv1Node(model, id, values) {
  const current = normalizeOv1Model(model);
  const nodeId = clean(id);
  const existing = current.nodes.find((node) => node.id === nodeId);
  if (!existing) return null;
  const positionOnly = values
    && (values.x !== undefined || values.y !== undefined)
    && values.label === undefined
    && values.detail === undefined;
  const label = clean(values?.label ?? existing.label).slice(0, 80);
  const detail = clean(values?.detail ?? existing.detail).slice(0, 800);
  // Canvas drag may send position-only updates; keep previous label/detail.
  if (!positionOnly && (!label || !detail)) return null;
  return saveOv1Model({
    ...current,
    nodes: current.nodes.map((node) => node.id === nodeId ? {
      ...node,
      label: label || node.label,
      detail: detail || node.detail || "待补充说明",
      category: clean(values?.category ?? node.category).slice(0, 80),
      responsibility: clean(values?.responsibility ?? node.responsibility).slice(0, 300),
      input: clean(values?.input ?? node.input).slice(0, 500),
      output: clean(values?.output ?? node.output).slice(0, 500),
      constraints: clean(values?.constraints ?? node.constraints).slice(0, 500),
      expectedEffects: clean(values?.expectedEffects ?? node.expectedEffects).slice(0, 500),
      kind: normalizeKind(values?.kind ?? node.kind, node.className),
      evidenceRefs: values?.evidenceRefs === undefined ? node.evidenceRefs : normalizeRefs(values?.evidenceRefs),
      x: normalizePosition(values?.x, node.x),
      y: normalizePosition(values?.y, node.y)
    } : node)
  });
}

export function updateOv1Concept(model, values = {}) {
  const current = normalizeOv1Model(model);
  return saveOv1Model({ ...current, concept: normalizeConcept(values, current.concept) });
}

export function normalizeOv1Model(value) {
  const sourceNodes = repairLegacyCompressedOv1Nodes(
    Array.isArray(value?.nodes) ? value.nodes : ov1Nodes
  );
  const defaultNodes = new Map(ov1Nodes.map((node) => [node.id, node]));
  const seenNodeIds = new Set();
  const nodes = sourceNodes.map((node) => normalizeNode(node, defaultNodes.get(clean(node?.id)))).filter((node) => {
    if (!node || seenNodeIds.has(node.id)) return false;
    seenNodeIds.add(node.id);
    return true;
  });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const sourceEdges = Array.isArray(value?.edges) ? value.edges : DEFAULT_EDGES;
  const seen = new Set();
  const edges = sourceEdges.map((edge, index) => {
    const sourceId = clean(edge?.sourceId);
    const targetId = clean(edge?.targetId);
    const type = normalizeRelationType(edge?.type);
    if (!nodeIds.has(sourceId) || !nodeIds.has(targetId) || sourceId === targetId) return null;
    const signature = `${sourceId}:${targetId}:${type}`;
    if (seen.has(signature)) return null;
    seen.add(signature);
    return { id: clean(edge?.id) || `ov1-edge-${index + 1}`, sourceId, targetId, type };
  }).filter(Boolean);
  const base = {
    version: 1,
    nodes,
    edges,
    concept: normalizeConcept(value?.concept),
    provenance: normalizeProvenance(value?.provenance),
    architectureId: value?.architectureId || "",
    view: value?.view,
    derivedFrom: value?.derivedFrom || null
  };
  try {
    return normalizeDodafOv1(base);
  } catch {
    return base;
  }
}

export function autoLayoutOv1(model) {
  const current = normalizeOv1Model(model);
  return saveOv1Model({
    ...current,
    nodes: layoutOv1Nodes(current.nodes, current.edges)
  });
}

function normalizeNode(value, fallback = {}) {
  const id = clean(value?.id || fallback?.id);
  const label = clean(value?.label || fallback?.label).slice(0, 60);
  const detail = clean(value?.detail || fallback?.detail).slice(0, 800);
  if (!id || !label || !detail) return null;
  return {
    id,
    label,
    detail,
    category: clean(value?.category || fallback?.category).slice(0, 80),
    responsibility: clean(value?.responsibility || fallback?.responsibility).slice(0, 300),
    input: clean(value?.input || fallback?.input).slice(0, 500),
    output: clean(value?.output || fallback?.output).slice(0, 500),
    constraints: clean(value?.constraints || fallback?.constraints).slice(0, 500),
    expectedEffects: clean(value?.expectedEffects || fallback?.expectedEffects).slice(0, 500),
    kind: normalizeKind(value?.kind || fallback?.kind, value?.className || fallback?.className),
    evidenceRefs: normalizeRefs(value?.evidenceRefs || fallback?.evidenceRefs),
    className: normalizeClassName(value?.className || fallback?.className),
    x: normalizePosition(value?.x, fallback?.x || "42%"),
    y: normalizePosition(value?.y, fallback?.y || "46%")
  };
}

function nextNodePosition(nodes) {
  const index = nodes.length;
  return {
    x: `${16 + (index * 17) % 62}%`,
    y: `${16 + (index * 19) % 64}%`
  };
}

function normalizeClassName(value) {
  return ["", "blue", "gold"].includes(clean(value)) ? clean(value) : "";
}

function normalizeKind(value, className = "") {
  const kind = clean(value);
  if (["equipment", "command", "action", "external", "environment", "effect", "participant"].includes(kind)) return kind;
  if (clean(className) === "blue") return "external";
  if (clean(className) === "gold") return "effect";
  return "equipment";
}

function normalizePosition(value, fallback) {
  return normalizeWorldPosition(value, fallback);
}

function normalizeRelationType(value) {
  const type = clean(value);
  return RELATION_TYPES.includes(type) ? type : RELATION_TYPES[0];
}

function normalizeProvenance(value) {
  const mode = clean(value?.mode);
  if (!['ai', 'local'].includes(mode)) return null;
  return {
    mode,
    generatedAt: clean(value?.generatedAt),
    note: clean(value?.note).slice(0, 180)
  };
}

function normalizeConcept(value, fallback = {}) {
  return {
    mission: clean(value?.mission ?? fallback?.mission).slice(0, 240),
    objective: clean(value?.objective ?? fallback?.objective).slice(0, 500),
    scope: clean(value?.scope ?? fallback?.scope).slice(0, 300),
    phase: clean(value?.phase ?? fallback?.phase).slice(0, 160),
    expectedEffects: clean(value?.expectedEffects ?? fallback?.expectedEffects).slice(0, 500),
    constraints: clean(value?.constraints ?? fallback?.constraints).slice(0, 500)
  };
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `ov1-edge-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clean(value) {
  return String(value || "").trim();
}

function normalizeRefs(value) { return [...new Set(String(value || "").split(/[，,]/).map(clean).filter(Boolean))].slice(0, 12); }
