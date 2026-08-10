/**
 * Merge OV product entities/relations into the shared ArchitectureDescription library.
 */

import { normalizeArchitecture, normalizeProductByResource } from "./products.js";
import { PRODUCT_BY_RESOURCE } from "./constants.js";
import { clean, nowIso } from "./util.js";

const PRODUCT_RESOURCES = ["ov1", "ov2", "ov3", "ov4", "ov5a", "ov5", "ov6a", "ov6b", "ov6c"];

/**
 * @param {object|null} architecture existing architecture model
 * @param {Record<string, object|null|undefined>} products resourceKey -> model
 * @param {{ projectId?: string, title?: string }} meta
 */
export function mergeProductsIntoArchitecture(architecture = null, products = {}, meta = {}) {
  const entityMap = new Map();
  const relationMap = new Map();
  const productBag = {};

  // Prefer existing architecture library as base, then overlay product entities.
  (architecture?.entities || []).forEach((entity) => {
    if (entity?.id) entityMap.set(String(entity.id), entity);
  });
  (architecture?.relations || []).forEach((relation) => {
    if (relation?.id) relationMap.set(String(relation.id), relation);
  });

  for (const resource of PRODUCT_RESOURCES) {
    const raw = products[resource];
    if (!raw || typeof raw !== "object") continue;
    let model = raw;
    try {
      model = normalizeProductByResource(resource, raw);
    } catch {
      // keep raw projection if product incomplete
    }
    const productName = PRODUCT_BY_RESOURCE[resource] || resource;
    productBag[productName] = model;
    (model.entities || []).forEach((entity) => {
      if (!entity?.id) return;
      const id = String(entity.id);
      const previous = entityMap.get(id);
      entityMap.set(id, previous ? mergeEntity(previous, entity) : entity);
    });
    (model.relations || []).forEach((relation) => {
      if (!relation?.id) return;
      relationMap.set(String(relation.id), relation);
    });
  }

  // Keep architecture.products entries that were not in this write batch.
  const priorProducts = architecture?.products && typeof architecture.products === "object" ? architecture.products : {};
  for (const [name, model] of Object.entries(priorProducts)) {
    if (!productBag[name] && model) productBag[name] = model;
  }

  return normalizeArchitecture({
    id: clean(architecture?.id || meta.projectId, 160) || "architecture",
    name: clean(architecture?.name || meta.title, 240) || "Operational Architecture",
    description: clean(architecture?.description, 4000),
    entities: [...entityMap.values()],
    relations: [...relationMap.values()],
    products: productBag,
    view: architecture?.view,
    updatedAt: nowIso()
  });
}

function mergeEntity(previous, next) {
  return {
    ...previous,
    ...next,
    name: clean(next.name, 1000) || previous.name,
    description: clean(next.description, 8000) || previous.description,
    dm2Type: clean(next.dm2Type, 40) || previous.dm2Type,
    aliases: Array.isArray(next.aliases) && next.aliases.length ? next.aliases : previous.aliases || [],
    properties: { ...(previous.properties || {}), ...(next.properties || {}) },
    evidenceRefs: Array.isArray(next.evidenceRefs) && next.evidenceRefs.length ? next.evidenceRefs : previous.evidenceRefs || [],
    source: next.source || previous.source
  };
}
