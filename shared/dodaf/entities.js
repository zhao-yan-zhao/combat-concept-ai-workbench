import {
  DM2_ENTITY_TYPES,
  DM2_RELATION_TYPES,
  DODAF_SCHEMA,
  DODAF_SCHEMA_VERSION
} from "./constants.js";
import { clean, clampNumber, normalizeStringList, nowIso } from "./util.js";

export function normalizeDm2Entity(value, index = 0, fallbackType = "Performer") {
  const dm2Type = DM2_ENTITY_TYPES.includes(clean(value?.dm2Type, 40))
    ? clean(value.dm2Type, 40)
    : fallbackType;
  const id = clean(value?.id, 160) || `entity-${dm2Type.toLowerCase()}-${index + 1}`;
  return {
    id,
    dm2Type,
    name: clean(value?.name || value?.label || value?.title, 1000) || id,
    description: clean(value?.description || value?.detail || value?.text, 8000),
    aliases: normalizeStringList(value?.aliases, 12, 240),
    properties: normalizeProperties(value?.properties),
    evidenceRefs: normalizeStringList(value?.evidenceRefs || value?.refs, 16, 240),
    source: normalizeSource(value?.source)
  };
}

export function normalizeDm2Relation(value, index = 0, fallbackType = "relationship") {
  const dm2Type = DM2_RELATION_TYPES.includes(clean(value?.dm2Type || value?.type, 80))
    ? clean(value?.dm2Type || value?.type, 80)
    : fallbackType;
  const sourceId = clean(value?.sourceId, 160);
  const targetId = clean(value?.targetId, 160);
  if (!sourceId || !targetId || sourceId === targetId) return null;
  return {
    id: clean(value?.id, 180) || `relation-${index + 1}`,
    dm2Type,
    sourceId,
    targetId,
    name: clean(value?.name || value?.label || value?.type, 400),
    properties: normalizeProperties(value?.properties)
  };
}

export function normalizeEntityList(values, { maximum = 240, fallbackType = "Performer" } = {}) {
  const ids = new Set();
  const entities = [];
  (Array.isArray(values) ? values : []).slice(0, maximum).forEach((value, index) => {
    const entity = normalizeDm2Entity(value, index, fallbackType);
    if (ids.has(entity.id)) return;
    ids.add(entity.id);
    entities.push(entity);
  });
  return entities;
}

export function normalizeRelationList(values, entityIds, { maximum = 480, fallbackType = "relationship" } = {}) {
  const ids = new Set();
  const signatures = new Set();
  const relations = [];
  (Array.isArray(values) ? values : []).slice(0, maximum).forEach((value, index) => {
    const relation = normalizeDm2Relation(value, index, fallbackType);
    if (!relation) return;
    if (entityIds && (!entityIds.has(relation.sourceId) || !entityIds.has(relation.targetId))) return;
    const signature = `${relation.dm2Type}:${relation.sourceId}:${relation.targetId}:${relation.name}`;
    if (ids.has(relation.id) || signatures.has(signature)) return;
    ids.add(relation.id);
    signatures.add(signature);
    relations.push(relation);
  });
  return relations;
}

export function createProductEnvelope({
  product,
  architectureId = "",
  entities = [],
  relations = [],
  view = {},
  provenance = null,
  derivedFrom = null,
  extra = {}
} = {}) {
  const envelope = {
    schema: DODAF_SCHEMA,
    schemaVersion: DODAF_SCHEMA_VERSION,
    product,
    architectureId: clean(architectureId, 160),
    entities,
    relations,
    view: normalizeView(view),
    ...extra
  };
  if (provenance) envelope.provenance = provenance;
  const derived = normalizeDerivedFrom(derivedFrom);
  if (derived) envelope.derivedFrom = derived;
  return envelope;
}

export function normalizeView(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { layout: {}, matrix: {}, notes: "" };
  }
  return {
    layout: value.layout && typeof value.layout === "object" && !Array.isArray(value.layout) ? value.layout : {},
    matrix: value.matrix && typeof value.matrix === "object" && !Array.isArray(value.matrix) ? value.matrix : {},
    notes: clean(value.notes, 4000)
  };
}

export function normalizeDerivedFrom(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    mode: clean(value.mode, 40) || "seeded",
    sources: normalizeStringList(value.sources, 12, 80),
    generatedAt: nowIso(value.generatedAt),
    note: clean(value.note, 500)
  };
}

export function normalizeSource(value) {
  if (!value || typeof value !== "object") {
    return { mode: "manual", at: "" };
  }
  return {
    mode: clean(value.mode, 40) || "manual",
    at: clean(value.at || value.generatedAt, 80)
  };
}

function normalizeProperties(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value).slice(0, 40).reduce((result, [key, item]) => {
    const field = clean(key, 80);
    if (!field) return result;
    if (item === null || typeof item === "boolean") result[field] = item;
    else if (typeof item === "number" && Number.isFinite(item)) result[field] = clampNumber(item, -1e9, 1e9, 0);
    else if (Array.isArray(item)) result[field] = item.slice(0, 40).map((entry) => clean(entry, 400)).filter(Boolean);
    else result[field] = clean(item, 4000);
    return result;
  }, {});
}
