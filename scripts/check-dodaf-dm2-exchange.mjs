import {
  buildArchitectureExchangePackage,
  decodeArchitecturePackage,
  encodeArchitecturePackage,
  productsFromExchangePackage
} from "../shared/dodaf/exchange.js";
import {
  normalizeDodafOv1,
  normalizeDodafOv2,
  normalizeDodafOv5,
  normalizeDodafOv5a,
  normalizeDodafOv6a
} from "../shared/dodaf/products.js";
import {
  normalizeArchitecture,
  normalizeOv1,
  normalizeOv2,
  normalizeOv5
} from "../server/projectModelNormalizers.mjs";
import { createFileProjectRepository } from "../server/projectRepository.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const ov1 = normalizeOv1({
  nodes: [
    { id: "sense", label: "传感平台", kind: "equipment", detail: "监视" },
    { id: "decide", label: "联合指挥", kind: "command", detail: "决策" }
  ],
  edges: [{ id: "e1", sourceId: "sense", targetId: "decide", type: "信息流" }],
  concept: { mission: "研究概念", objective: "形成可审查模型" }
});
assert(ov1.schema === "dodaf-2.02-dm2-ov" && ov1.product === "OV-1", "OV-1 missing DM2 envelope");
assert(ov1.entities.length === 2 && ov1.relations.length === 1, "OV-1 did not materialize DM2 entities/relations");
assert(ov1.entities[0].dm2Type === "System", "OV-1 equipment should map to System");

const ov5 = normalizeOv5({
  activities: [
    { id: "a1", title: "感知", type: "感知", text: "收集", parentId: "", sourceOv1NodeIds: ["sense"] },
    { id: "a2", title: "判断", type: "判断", text: "评估", parentId: "a1", sourceOv1NodeIds: ["decide"] }
  ],
  edges: [{ id: "edge-1", sourceId: "a1", targetId: "a2", type: "信息流", payload: "态势", condition: "完成感知" }]
});
assert(ov5.product === "OV-5b" && ov5.entities.every((entity) => entity.dm2Type === "Activity"), "OV-5b entities must be Activity");
assert(ov5.relations.some((relation) => relation.dm2Type === "activityPartOfActivity"), "OV-5b should emit activityPartOfActivity");

const ov2 = normalizeOv2({
  nodes: [{ id: "sense", label: "传感平台", sourceOv1NodeId: "sense", activityIds: ["a1"] }],
  exchanges: [{
    id: "x1",
    sourceNodeId: "sense",
    targetNodeId: "decide",
    sourceNodeLabel: "传感平台",
    targetNodeLabel: "联合指挥",
    label: "态势分发",
    flowType: "信息流",
    sourceActivityId: "a1",
    targetActivityId: "a2"
  }]
});
// target decide is not a node, needline may drop; force both nodes
const ov2Full = normalizeOv2({
  nodes: [
    { id: "sense", label: "传感平台" },
    { id: "decide", label: "联合指挥" }
  ],
  exchanges: [{
    id: "x1",
    sourceNodeId: "sense",
    targetNodeId: "decide",
    label: "态势分发",
    flowType: "信息流"
  }]
});
assert(ov2Full.product === "OV-2" && ov2Full.relations.some((relation) => relation.dm2Type === "needline"), "OV-2 should emit needline relations");

const ov5a = normalizeDodafOv5a({
  tree: [{ id: "a1", title: "感知", children: [{ id: "a2", title: "判断", children: [] }] }]
});
assert(ov5a.product === "OV-5a" && ov5a.relations[0]?.dm2Type === "activityPartOfActivity", "OV-5a hierarchy mapping failed");

const ov6a = normalizeDodafOv6a({
  rules: [{ id: "r1", subject: "感知", type: "前置条件", text: "公开证据已审查" }]
});
assert(ov6a.entities[0].dm2Type === "Rule", "OV-6a rules must be Rule entities");

const packageModel = buildArchitectureExchangePackage({
  projectId: "demo",
  title: "DM2 demo",
  products: { ov1, ov5, ov2: ov2Full, ov5a, ov6a }
});
assert(packageModel.meta.standard === "DoDAF-2.02-DM2", "Exchange package standard missing");
assert(Object.keys(packageModel.products).includes("OV-1") && Object.keys(packageModel.products).includes("OV-5b"), "Products not keyed by OV product name");

const json = encodeArchitecturePackage(packageModel, "json");
const fromJson = decodeArchitecturePackage(json, "json");
assert(fromJson.products["OV-1"].nodes[0].id === "sense", "JSON round-trip lost OV-1");

const xml = encodeArchitecturePackage(fromJson, "xml");
assert(xml.includes("ArchitectureExchangePackage") && xml.includes("urn:combat-concept:dodaf-2.02-dm2-ov:1"), "XML package missing namespace");
const fromXml = decodeArchitecturePackage(xml, "xml");
assert(fromXml.products["OV-2"].exchanges[0].label === "态势分发", "XML round-trip lost OV-2 exchange");

const imported = productsFromExchangePackage(fromXml);
assert(imported.resources.ov1 && imported.resources.ov5 && imported.resources.architecture, "Import resources incomplete");
assert(normalizeArchitecture(imported.resources.architecture).entities.length >= 2, "Architecture entity merge failed");

const dir = await mkdtemp(join(tmpdir(), "dodaf-dm2-"));
const filePath = join(dir, "projects.json");
const repository = createFileProjectRepository({ filePath, now: () => "2026-07-24T00:00:00.000Z" });
try {
  await repository.createProject({ id: "dm2-demo", title: "DM2 Demo" });
  const savedOv1 = await repository.saveOv1("dm2-demo", { model: ov1, source: "test", expectedRevision: 0 });
  assert(savedOv1.model.schema === "dodaf-2.02-dm2-ov", "Repository did not persist DM2 OV-1");
  const savedOv2 = await repository.saveOv2("dm2-demo", { model: ov2Full, source: "test", expectedRevision: savedOv1.revision });
  assert(savedOv2.exists && savedOv2.model.product === "OV-2", "Repository OV-2 save failed");
  const exported = await repository.exportArchitecture("dm2-demo", { format: "json" });
  assert(exported.package.products["OV-1"] && exported.package.products["OV-2"], "Export package missing products");
  const importedRepo = await repository.importArchitecture("dm2-demo", {
    package: exported.package,
    format: "json",
    mergeStrategy: "replace-products",
    source: "test",
    expectedRevision: exported.revision
  });
  assert(importedRepo.imported.includes("ov1") && importedRepo.imported.includes("ov2"), "Import did not write OV products");
  const reloaded = await repository.getOv2("dm2-demo");
  assert(reloaded.model.exchanges[0].label === "态势分发", "Imported OV-2 not reloaded");
} finally {
  repository.close?.();
  await rm(dir, { recursive: true, force: true });
}

// legacy ov1 without schema still accepted
const legacy = normalizeDodafOv1({ nodes: [{ id: "n1", label: "旧节点" }], edges: [] });
assert(legacy.schema === "dodaf-2.02-dm2-ov" && legacy.nodes[0].id === "n1", "Legacy OV-1 adapter failed");

console.log("DoDAF 2.02/DM2 exchange acceptance passed: product envelopes, JSON/XML round-trip, repository import/export.");
