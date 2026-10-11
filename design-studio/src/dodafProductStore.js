import { buildOv2Model } from "./ov2Builder.js";
import { buildOv3Model } from "./ov3Builder.js";
import { buildOv4Model } from "./ov4Builder.js";
import { buildOv5aModel, buildOv6aModel, buildOv6bModel } from "./dodafOperationalBuilders.js";
import { buildOv6cModel } from "./ov6cBuilder.js";
import { buildOv1bModel } from "./ov1bStore.js";
import { buildOv1cModel, buildOv7Model } from "./mappingProductStore.js";
import {
  normalizeDodafOv2,
  normalizeDodafOv1b,
  normalizeDodafOv1c,
  normalizeDodafOv3,
  normalizeDodafOv4,
  normalizeDodafOv5a,
  normalizeDodafOv6a,
  normalizeDodafOv6b,
  normalizeDodafOv6c,
  normalizeDodafOv7
} from "../../shared/dodaf/products.js";

const STORAGE_PREFIX = "concept-studio-dodaf-product-v1";

export const DODAF_PRODUCT_KEYS = ["ov1b", "ov1c", "ov2", "ov3", "ov4", "ov5a", "ov6a", "ov6b", "ov6c", "ov7"];

const SEEDERS = {
  ov1b: (state) => buildOv1bModel(state),
  ov1c: (state) => buildOv1cModel(state),
  ov2: (state) => normalizeDodafOv2({
    ...buildOv2Model(state),
    derivedFrom: { mode: "seeded", sources: ["forceMissionPlan"], generatedAt: new Date().toISOString(), note: "seeded-from-builders" }
  }),
  ov3: (state) => normalizeDodafOv3({
    ...buildOv3Model({ ov2: state.ov2 || buildOv2Model(state), scenario: state.scenario }),
    derivedFrom: { mode: "projection", sources: ["ov2"], generatedAt: new Date().toISOString(), note: "controlled-ov2-projection" }
  }),
  ov4: (state) => normalizeDodafOv4({
    ...buildOv4Model(state),
    derivedFrom: { mode: "seeded", sources: ["forceMissionPlan"], generatedAt: new Date().toISOString(), note: "seeded-from-builders" }
  }),
  ov5a: (state) => normalizeDodafOv5a({
    ...buildOv5aModel({ ov5: state.ov5 }),
    derivedFrom: { mode: "seeded", sources: ["ov5"], generatedAt: new Date().toISOString(), note: "seeded-from-builders" }
  }),
  ov6a: (state) => normalizeDodafOv6a({
    ...buildOv6aModel({ ov5: state.ov5 }),
    derivedFrom: { mode: "seeded", sources: ["ov5"], generatedAt: new Date().toISOString(), note: "seeded-from-builders" }
  }),
  ov6b: (state) => normalizeDodafOv6b({
    ...buildOv6bModel({ ooda: state.ooda }),
    derivedFrom: { mode: "seeded", sources: ["ooda"], generatedAt: new Date().toISOString(), note: "seeded-from-builders" }
  }),
  ov6c: (state) => normalizeDodafOv6c({
    ...buildOv6cModel({ ooda: state.ooda, scenario: state.scenario }),
    derivedFrom: { mode: "seeded", sources: ["ooda", "scenario"], generatedAt: new Date().toISOString(), note: "seeded-from-builders" }
  }),
  ov7: (state) => buildOv7Model(state)
};

const NORMALIZERS = {
  ov1b: normalizeDodafOv1b,
  ov1c: normalizeDodafOv1c,
  ov2: normalizeDodafOv2,
  ov3: normalizeDodafOv3,
  ov4: normalizeDodafOv4,
  ov5a: normalizeDodafOv5a,
  ov6a: normalizeDodafOv6a,
  ov6b: normalizeDodafOv6b,
  ov6c: normalizeDodafOv6c,
  ov7: normalizeDodafOv7
};

export function seedDodafProduct(resourceKey, state) {
  const seeder = SEEDERS[resourceKey];
  if (!seeder) throw new Error(`Unknown DoDAF product: ${resourceKey}`);
  return seeder(state);
}

export function normalizeDodafProduct(resourceKey, value) {
  const normalize = NORMALIZERS[resourceKey];
  if (!normalize) throw new Error(`Unknown DoDAF product: ${resourceKey}`);
  return normalize(value);
}

/** Prefer persisted product; otherwise return a non-persisted seed for display. */
export function resolveDodafProduct(state, resourceKey) {
  const current = state?.[resourceKey];
  if (current && typeof current === "object" && (
    current.entities
    || current.nodes
    || current.activities
    || current.roles
    || current.rules
    || current.states
    || current.stateMachines
    || current.events
    || current.sequences
    || current.mappings
    || current.decompositions
    || current.taskGroups
    // Legacy OV-5a payloads are accepted here and migrated by normalizeDodafOv5a.
    || current.tree
    || current.exchanges
  )) {
    return { model: current, source: current.schema ? "persisted" : "legacy", seeded: Boolean(current.derivedFrom) };
  }
  return { model: seedDodafProduct(resourceKey, state), source: "seed", seeded: true };
}

export function localStorageKey(resourceKey, projectId = "default") {
  return `${STORAGE_PREFIX}:${projectId}:${resourceKey}`;
}

export function loadLocalDodafProduct(resourceKey, projectId = "default") {
  try {
    const raw = localStorage.getItem(localStorageKey(resourceKey, projectId));
    if (!raw) return null;
    return normalizeDodafProduct(resourceKey, JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLocalDodafProduct(resourceKey, model, projectId = "default") {
  const normalized = resourceKey === "architecture"
    ? model
    : normalizeDodafProduct(resourceKey, model);
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(localStorageKey(resourceKey, projectId), JSON.stringify(normalized));
    }
  } catch {
    // Node acceptance tests and private mode still receive the normalized model.
  }
  return normalized;
}

export function createEmptyDodafProductState(projectId = "default") {
  return Object.fromEntries(DODAF_PRODUCT_KEYS.map((key) => {
    const local = loadLocalDodafProduct(key, projectId);
    return [key, local];
  }));
}

export function createEmptyDodafStorageState() {
  return Object.fromEntries(DODAF_PRODUCT_KEYS.map((key) => [
    `${key}Storage`,
    { status: "checking", mode: "local", label: `正在检查 ${key.toUpperCase()}`, localSaved: false }
  ]));
}

export function updateProductField(model, resourceKey, path, value) {
  const clone = structuredClone(model);
  const segments = String(path || "").split(".");
  if (segments[0] === "taskGroup" && resourceKey === "ov1b") {
    const item = (clone.taskGroups || []).find((entry) => entry.id === segments[1]);
    if (item && ["name", "dimension", "rationale", "coordination"].includes(segments[2])) item[segments[2]] = value;
  } else if (segments[0] === "mapping" && ["ov1c", "ov7"].includes(resourceKey)) {
    const mapping = (clone.mappings || []).find((item) => item.id === segments[1]);
    if (mapping && segments[2] === "note") mapping.note = value;
  } else if (segments[0] === "exchange" && resourceKey === "ov2") {
    const exchange = (clone.exchanges || []).find((item) => item.id === segments[1]);
    if (exchange && segments[2]) exchange[segments[2]] = value;
  } else if (segments[0] === "role" && resourceKey === "ov4") {
    const role = (clone.roles || []).find((item) => item.id === segments[1]);
    if (role && segments[2]) role[segments[2]] = value;
  } else if (segments[0] === "rule" && resourceKey === "ov6a") {
    const rule = (clone.rules || []).find((item) => item.id === segments[1]);
    if (rule && segments[2]) {
      rule[segments[2]] = value;
      // Keep legacy aliases in sync until the next normalize pass.
      if (segments[2] === "name") rule.subject = value;
      if (segments[2] === "description") rule.text = value;
      if (segments[2] === "text") rule.description = value;
      if (segments[2] === "subject") rule.name = value;
    }
  } else if (segments[0] === "transition" && resourceKey === "ov6b") {
    const transition = (clone.transitions || []).find((item) => item.id === segments[1]);
    if (transition && segments[2]) {
      transition[segments[2]] = value;
      for (const machine of clone.stateMachines || []) {
        const machineTransition = (machine.transitions || []).find((item) => item.id === segments[1]);
        if (machineTransition) machineTransition[segments[2]] = value;
      }
    }
  } else if (segments[0] === "event" && resourceKey === "ov6c") {
    const event = (clone.events || []).find((item) => item.id === segments[1]);
    if (event && segments[2]) {
      event[segments[2]] = value;
      if (segments[2] === "title") event.name = value;
      if (segments[2] === "name") event.title = value;
      for (const sequence of clone.sequences || []) {
        const message = (sequence.messages || []).find((item) => item.id === segments[1]);
        if (!message) continue;
        message[segments[2]] = value;
        if (segments[2] === "title") message.name = value;
        if (segments[2] === "name") message.title = value;
      }
    }
  } else if (segments[0] === "sequence" && resourceKey === "ov6c") {
    const sequence = (clone.sequences || []).find((item) => item.id === segments[1]);
    if (sequence && segments[2] === "name") {
      sequence.name = value;
    }
  } else if (segments[0] === "view" && segments[1] === "notes") {
    clone.view = { ...(clone.view || {}), notes: value };
  }
  clone.derivedFrom = null;
  return normalizeDodafProduct(resourceKey, clone);
}
