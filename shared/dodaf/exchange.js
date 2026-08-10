import {
  DODAF_PROFILE,
  DODAF_SCHEMA_VERSION,
  DODAF_STANDARD,
  RESOURCE_BY_PRODUCT
} from "./constants.js";
import { normalizeArchitecture, normalizeProductByName } from "./products.js";
import { clean, nowIso } from "./util.js";
import { architecturePackageToXml, parseArchitecturePackageXml } from "./xml.js";

export function buildArchitectureExchangePackage({
  projectId = "",
  title = "",
  architecture = null,
  products = {},
  lineage = null,
  exportedAt = ""
} = {}) {
  const normalizedProducts = {};
  for (const [key, value] of Object.entries(products || {})) {
    if (!value) continue;
    const productName = RESOURCE_BY_PRODUCT[key] ? key.startsWith("OV-") ? key : undefined : undefined;
    const product = productName
      || (key.startsWith("OV-") ? key : null)
      || ({
        ov1: "OV-1", ov2: "OV-2", ov3: "OV-3", ov4: "OV-4", ov5a: "OV-5a", ov5: "OV-5b",
        ov6a: "OV-6a", ov6b: "OV-6b", ov6c: "OV-6c"
      })[key];
    if (!product) continue;
    try {
      normalizedProducts[product] = normalizeProductByName(product, value);
    } catch {
      // skip invalid product payloads during export assembly
    }
  }

  const entityMap = new Map();
  const relationMap = new Map();
  Object.values(normalizedProducts).forEach((product) => {
    (product.entities || []).forEach((entity) => entityMap.set(entity.id, entity));
    (product.relations || []).forEach((relation) => relationMap.set(relation.id, relation));
  });
  if (architecture?.entities) {
    architecture.entities.forEach((entity) => entityMap.set(entity.id, entity));
  }
  if (architecture?.relations) {
    architecture.relations.forEach((relation) => relationMap.set(relation.id, relation));
  }

  const arch = normalizeArchitecture({
    ...(architecture || {}),
    id: architecture?.id || clean(projectId, 160) || "architecture",
    name: architecture?.name || title || "Operational Architecture",
    entities: [...entityMap.values()],
    relations: [...relationMap.values()],
    products: normalizedProducts
  });

  return {
    meta: {
      standard: DODAF_STANDARD,
      profile: DODAF_PROFILE,
      schemaVersion: DODAF_SCHEMA_VERSION,
      exportedAt: nowIso(exportedAt),
      projectId: clean(projectId, 160),
      title: clean(title || arch.name, 240)
    },
    architecture: {
      id: arch.id,
      name: arch.name,
      description: arch.description
    },
    entities: arch.entities,
    relations: arch.relations,
    products: normalizedProducts,
    lineage: lineage && typeof lineage === "object" ? lineage : null
  };
}

export function normalizeArchitectureExchangePackage(value) {
  if (!value || typeof value !== "object") throw new Error("Architecture exchange package is required");
  const products = {};
  const inputProducts = value.products && typeof value.products === "object" ? value.products : {};
  for (const [key, payload] of Object.entries(inputProducts)) {
    const product = key.startsWith("OV-")
      ? key
      : ({
        ov1: "OV-1", ov2: "OV-2", ov3: "OV-3", ov4: "OV-4", ov5a: "OV-5a", ov5: "OV-5b",
        ov6a: "OV-6a", ov6b: "OV-6b", ov6c: "OV-6c"
      })[key];
    if (!product || !payload) continue;
    products[product] = normalizeProductByName(product, payload);
  }
  const packageModel = buildArchitectureExchangePackage({
    projectId: value?.meta?.projectId || value?.projectId,
    title: value?.meta?.title || value?.architecture?.name,
    architecture: {
      id: value?.architecture?.id,
      name: value?.architecture?.name,
      description: value?.architecture?.description,
      entities: value?.entities,
      relations: value?.relations
    },
    products,
    lineage: value?.lineage,
    exportedAt: value?.meta?.exportedAt
  });
  if (!Object.keys(packageModel.products).length && !packageModel.entities.length) {
    throw new Error("Architecture exchange package requires entities or products");
  }
  return packageModel;
}

export function encodeArchitecturePackage(value, format = "json") {
  const packageModel = normalizeArchitectureExchangePackage(value);
  if (format === "xml") return architecturePackageToXml(packageModel);
  return `${JSON.stringify(packageModel, null, 2)}\n`;
}

export function decodeArchitecturePackage(raw, format = "json") {
  if (format === "xml" || (typeof raw === "string" && raw.trimStart().startsWith("<"))) {
    return normalizeArchitectureExchangePackage(parseArchitecturePackageXml(String(raw)));
  }
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return normalizeArchitectureExchangePackage(parsed);
}

export function productsFromExchangePackage(packageModel, { mergeStrategy = "replace-products" } = {}) {
  const normalized = normalizeArchitectureExchangePackage(packageModel);
  const resources = {};
  for (const [product, model] of Object.entries(normalized.products)) {
    const resourceKey = RESOURCE_BY_PRODUCT[product];
    if (resourceKey) resources[resourceKey] = model;
  }
  resources.architecture = normalizeArchitecture({
    id: normalized.architecture.id,
    name: normalized.architecture.name,
    description: normalized.architecture.description,
    entities: normalized.entities,
    relations: normalized.relations,
    products: normalized.products
  });
  return { mergeStrategy, resources, package: normalized };
}
