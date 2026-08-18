/**
 * Live walkthrough against the same durable store 8792 uses (data/projects.sqlite)
 * plus health probe on the running workbench.
 *
 * Flow: seed/save OV products → architecture → export → import → model snapshot restore.
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createFileProjectRepository } from "../server/projectRepository.mjs";
import {
  buildArchitectureExchangePackage,
  encodeArchitecturePackage,
  decodeArchitecturePackage
} from "../shared/dodaf/exchange.js";
import { mergeProductsIntoArchitecture } from "../shared/dodaf/architectureWriteback.js";
import { applyOv5bToOv5a } from "../shared/dodaf/ov5ActivitySync.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.WORKBENCH_BASE || "http://127.0.0.1:8792";
const PROJECT_ID = `live-dm2-${Date.now().toString(36)}`;
const databasePath = process.env.PROJECT_DB_PATH || join(root, "data", "projects.sqlite");
const filePath = process.env.PROJECT_DATA_PATH || join(root, "data", "projects.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// 1) Running 8792 must be healthy and sqlite-backed
const healthResponse = await fetch(`${BASE}/api/health`);
assert(healthResponse.ok, `8792 health failed: ${healthResponse.status}`);
const health = await healthResponse.json();
assert(health.ok && health.projectRepository?.mode === "sqlite", "8792 must report projectRepository.mode=sqlite");
assert(health.projectRepository?.durable === true, "8792 must report durable=true");
assert(health.projectRepository?.ov5a && health.projectRepository?.architecture, "8792 health missing ov5a/architecture");

// 2) Same SQLite path the runtime defaults to
const repository = createFileProjectRepository({
  filePath,
  databasePath,
  now: () => new Date().toISOString()
});
assert(repository.getStatus().storage === "sqlite", "Repository must open sqlite");

try {
  await repository.createProject({ id: PROJECT_ID, title: "Live DM2 Walkthrough", description: "seed-save-export-import-snapshot" });

  const ov1 = {
    nodes: [
      { id: "sense", label: "传感平台", kind: "equipment", detail: "监视" },
      { id: "decide", label: "指挥节点", kind: "command", detail: "决策" }
    ],
    edges: [{ id: "e1", sourceId: "sense", targetId: "decide", type: "信息流" }],
    concept: { mission: "live", objective: "walkthrough", scope: "test", phase: "概念", expectedEffects: "可恢复", constraints: "内网" }
  };
  const ov5 = {
    activities: [
      { id: "a1", title: "感知", type: "感知", text: "收集", input: "态势", output: "线索", duration: "持续", parentId: "", sourceOv1NodeIds: ["sense"] },
      { id: "a2", title: "判断", type: "判断", text: "评估", input: "线索", output: "结论", duration: "5", parentId: "a1", sourceOv1NodeIds: ["decide"] }
    ],
    edges: [{ id: "edge-1", sourceId: "a1", targetId: "a2", type: "信息流" }]
  };
  const ov5a = applyOv5bToOv5a(ov5, null);
  const ov2 = {
    nodes: [
      { id: "sense", label: "传感平台" },
      { id: "decide", label: "指挥节点" }
    ],
    exchanges: [{ id: "x1", sourceNodeId: "sense", targetNodeId: "decide", label: "态势分发", flowType: "信息流", sourceActivityId: "a1", targetActivityId: "a2" }]
  };

  let saved = await repository.saveOv1(PROJECT_ID, { model: ov1, source: "live", expectedRevision: 0 });
  assert(saved.model.schema === "dodaf-2.02-dm2-ov", "OV-1 DM2 schema missing after save");
  saved = await repository.saveOv5(PROJECT_ID, { model: ov5, source: "live", expectedRevision: saved.revision });
  assert(saved.model.product === "OV-5b", "OV-5b product missing");
  saved = await repository.saveOv5a(PROJECT_ID, { model: ov5a, source: "live", expectedRevision: saved.revision });
  assert(saved.model.decompositions?.some((item) => item.parentActivityRef === "a1" && item.childActivityRef === "a2"), "OV-5a decomposition references not saved");
  assert(!("tree" in saved.model), "OV-5a must not write the legacy activity tree");
  saved = await repository.saveOv2(PROJECT_ID, { model: ov2, source: "live", expectedRevision: saved.revision });

  // Architecture writeback from products
  const current = {
    ov1: (await repository.getOv1(PROJECT_ID)).model,
    ov5: (await repository.getOv5(PROJECT_ID)).model,
    ov5a: (await repository.getOv5a(PROJECT_ID)).model,
    ov2: (await repository.getOv2(PROJECT_ID)).model
  };
  const architecture = mergeProductsIntoArchitecture(null, current, { projectId: PROJECT_ID, title: "Live Architecture" });
  saved = await repository.saveArchitecture(PROJECT_ID, { model: architecture, source: "live", expectedRevision: saved.revision });
  assert(saved.model.entities.some((entity) => entity.id === "a1"), "Architecture writeback missing activity entity");
  assert(saved.model.products["OV-2"], "Architecture products map missing OV-2");

  // Export package
  const exported = await repository.exportArchitecture(PROJECT_ID, { format: "json" });
  assert(exported.package.products["OV-1"] && exported.package.products["OV-2"], "Export missing products");
  const xml = encodeArchitecturePackage(exported.package, "xml");
  const fromXml = decodeArchitecturePackage(xml, "xml");
  assert(fromXml.products["OV-5a"]?.decompositions?.some((item) => item.childActivityRef === "a2"), "XML round-trip lost OV-5a decomposition references");

  // Corrupt then import restore
  saved = await repository.saveOv2(PROJECT_ID, {
    model: { nodes: [{ id: "tmp", label: "被覆盖" }], exchanges: [] },
    source: "live",
    expectedRevision: saved.revision
  });
  const imported = await repository.importArchitecture(PROJECT_ID, {
    package: exported.package,
    format: "json",
    mergeStrategy: "replace-products",
    source: "live",
    expectedRevision: saved.revision
  });
  assert(imported.imported.includes("ov2"), "Import did not list ov2");
  const restoredOv2 = await repository.getOv2(PROJECT_ID);
  assert(restoredOv2.model.exchanges?.some((item) => item.label === "态势分发"), "Import did not restore exchange");

  // Snapshot full freeze + restore path
  const ooda = {
    lanes: [{
      id: "observe",
      title: "Observe",
      subtitle: "观察",
      color: "#4d697d",
      nodes: [{ id: "n1", sourceActivityId: "a1", title: "收集", text: "t", duration: "1", input: "i", output: "o", rule: "r" }]
    }],
    sourceActivityIds: ["a1"]
  };
  saved = await repository.saveOoda(PROJECT_ID, { model: ooda, source: "live", expectedRevision: imported.revision });
  const snapshot = await repository.createModelSnapshot(PROJECT_ID, {
    item: {
      id: `model-snapshot-live-${Date.now()}`,
      title: "Live snapshot",
      direction: "walkthrough",
      model: {
        brief: { objective: "o", approach: "a", assumptions: "s", expectedEffects: "e", risk: "r" },
        ov1: (await repository.getOv1(PROJECT_ID)).model,
        ov2: (await repository.getOv2(PROJECT_ID)).model,
        ov5: (await repository.getOv5(PROJECT_ID)).model,
        ov5a: (await repository.getOv5a(PROJECT_ID)).model,
        architecture: (await repository.getArchitecture(PROJECT_ID)).model,
        ooda,
        scenario: null,
        validation: null
      }
    },
    source: "live",
    expectedRevision: saved.revision
  });
  assert(snapshot.item.model.ov2.exchanges.length >= 1, "Snapshot lost OV-2");
  assert(snapshot.item.model.ov5a.decompositions.length >= 1, "Snapshot lost OV-5a decomposition references");
  assert(snapshot.item.model.architecture.entities.length >= 1, "Snapshot lost architecture");

  saved = await repository.saveOv2(PROJECT_ID, {
    model: { nodes: [{ id: "x", label: "tmp" }], exchanges: [] },
    source: "live",
    expectedRevision: snapshot.revision
  });
  saved = await repository.saveOv2(PROJECT_ID, {
    model: snapshot.item.model.ov2,
    source: "snapshot-restore",
    expectedRevision: saved.revision
  });
  const after = await repository.getOv2(PROJECT_ID);
  assert(after.model.exchanges.some((item) => item.label === "态势分发"), "Snapshot restore did not reapply OV-2");

  // package builder sanity
  const packageModel = buildArchitectureExchangePackage({
    projectId: PROJECT_ID,
    title: "Live",
    products: {
      ov1: snapshot.item.model.ov1,
      ov5: snapshot.item.model.ov5,
      ov2: snapshot.item.model.ov2,
      ov5a: snapshot.item.model.ov5a
    },
    architecture: snapshot.item.model.architecture
  });
  assert(packageModel.meta.standard === "DoDAF-2.02-DM2", "Package standard missing");

  console.log(`Live 8792 DoDAF flow passed (${PROJECT_ID}): health=sqlite; seed/save → architecture writeback → export/import → snapshot restore on ${databasePath}`);
} finally {
  repository.close?.();
}
