import { DODAF_XML_NS } from "./constants.js";
import { clean } from "./util.js";

export function architecturePackageToXml(packageModel) {
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<ArchitectureExchangePackage xmlns="${DODAF_XML_NS}">`,
    `  <meta>`,
    `    <standard>${escapeXml(packageModel.meta?.standard)}</standard>`,
    `    <profile>${escapeXml(packageModel.meta?.profile)}</profile>`,
    `    <schemaVersion>${escapeXml(packageModel.meta?.schemaVersion)}</schemaVersion>`,
    `    <exportedAt>${escapeXml(packageModel.meta?.exportedAt)}</exportedAt>`,
    `    <projectId>${escapeXml(packageModel.meta?.projectId)}</projectId>`,
    `    <title>${escapeXml(packageModel.meta?.title)}</title>`,
    `  </meta>`,
    `  <architecture>`,
    `    <id>${escapeXml(packageModel.architecture?.id)}</id>`,
    `    <name>${escapeXml(packageModel.architecture?.name)}</name>`,
    `    <description>${escapeXml(packageModel.architecture?.description)}</description>`,
    `  </architecture>`,
    `  <entities>`,
    ...(packageModel.entities || []).map((entity) => entityToXml(entity, 2)),
    `  </entities>`,
    `  <relations>`,
    ...(packageModel.relations || []).map((relation) => relationToXml(relation, 2)),
    `  </relations>`,
    `  <products>`
  ];
  for (const [product, model] of Object.entries(packageModel.products || {})) {
    lines.push(`    <product name="${escapeXml(product)}">`);
    lines.push(`      <json>${escapeXml(JSON.stringify(model))}</json>`);
    lines.push(`    </product>`);
  }
  lines.push(`  </products>`);
  if (packageModel.lineage) {
    lines.push(`  <lineage><json>${escapeXml(JSON.stringify(packageModel.lineage))}</json></lineage>`);
  }
  lines.push(`</ArchitectureExchangePackage>`);
  return `${lines.join("\n")}\n`;
}

export function parseArchitecturePackageXml(xml) {
  const text = String(xml || "");
  if (!text.includes("ArchitectureExchangePackage")) {
    throw new Error("XML is not a DoDAF architecture exchange package");
  }
  const meta = {
    standard: textBetween(text, "standard"),
    profile: textBetween(text, "profile"),
    schemaVersion: Number(textBetween(text, "schemaVersion") || 1),
    exportedAt: textBetween(text, "exportedAt"),
    projectId: textBetween(text, "projectId"),
    title: textBetween(text, "title")
  };
  const architecture = {
    id: textBetween(text, "id", textBetweenBlock(text, "architecture")),
    name: textBetween(text, "name", textBetweenBlock(text, "architecture")),
    description: textBetween(text, "description", textBetweenBlock(text, "architecture"))
  };
  const entities = [...text.matchAll(/<entity\b[^>]*>([\s\S]*?)<\/entity>/g)].map((match) => parseEntityXml(match[1]));
  const relations = [...text.matchAll(/<relation\b[^>]*>([\s\S]*?)<\/relation>/g)].map((match) => parseRelationXml(match[1]));
  const products = {};
  for (const match of text.matchAll(/<product\b[^>]*name="([^"]+)"[^>]*>\s*<json>([\s\S]*?)<\/json>\s*<\/product>/g)) {
    const name = decodeXml(match[1]);
    const json = decodeXml(match[2]);
    try {
      products[name] = JSON.parse(json);
    } catch {
      throw new Error(`Invalid product JSON for ${name}`);
    }
  }
  let lineage = null;
  const lineageJson = textBetween(text, "json", textBetweenBlock(text, "lineage"));
  if (lineageJson) {
    try { lineage = JSON.parse(lineageJson); } catch { lineage = null; }
  }
  return { meta, architecture, entities, relations, products, lineage };
}

function entityToXml(entity, indent = 0) {
  const pad = "  ".repeat(indent);
  return [
    `${pad}<entity>`,
    `${pad}  <id>${escapeXml(entity.id)}</id>`,
    `${pad}  <dm2Type>${escapeXml(entity.dm2Type)}</dm2Type>`,
    `${pad}  <name>${escapeXml(entity.name)}</name>`,
    `${pad}  <description>${escapeXml(entity.description)}</description>`,
    `${pad}  <properties><json>${escapeXml(JSON.stringify(entity.properties || {}))}</json></properties>`,
    `${pad}</entity>`
  ].join("\n");
}

function relationToXml(relation, indent = 0) {
  const pad = "  ".repeat(indent);
  return [
    `${pad}<relation>`,
    `${pad}  <id>${escapeXml(relation.id)}</id>`,
    `${pad}  <dm2Type>${escapeXml(relation.dm2Type)}</dm2Type>`,
    `${pad}  <sourceId>${escapeXml(relation.sourceId)}</sourceId>`,
    `${pad}  <targetId>${escapeXml(relation.targetId)}</targetId>`,
    `${pad}  <name>${escapeXml(relation.name)}</name>`,
    `${pad}</relation>`
  ].join("\n");
}

function parseEntityXml(block) {
  let properties = {};
  const propertiesJson = textBetween(block, "json", textBetweenBlock(block, "properties"));
  if (propertiesJson) {
    try { properties = JSON.parse(propertiesJson); } catch { properties = {}; }
  }
  return {
    id: textBetween(block, "id"),
    dm2Type: textBetween(block, "dm2Type") || "Performer",
    name: textBetween(block, "name"),
    description: textBetween(block, "description"),
    properties
  };
}

function parseRelationXml(block) {
  return {
    id: textBetween(block, "id"),
    dm2Type: textBetween(block, "dm2Type") || "relationship",
    sourceId: textBetween(block, "sourceId"),
    targetId: textBetween(block, "targetId"),
    name: textBetween(block, "name")
  };
}

function textBetween(source, tag, scope = source) {
  const match = String(scope || "").match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? decodeXml(match[1]) : "";
}

function textBetweenBlock(source, tag) {
  const match = String(source || "").match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? match[1] : "";
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXml(value) {
  return clean(String(value ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&"), 100000);
}
