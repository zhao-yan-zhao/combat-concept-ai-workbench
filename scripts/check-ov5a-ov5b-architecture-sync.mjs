import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyOv5aToOv5b,
  applyOv5bToOv5a,
  setOv5aParent,
  syncOv5ActivityPair
} from "../shared/dodaf/ov5ActivitySync.js";
import { mergeProductsIntoArchitecture } from "../shared/dodaf/architectureWriteback.js";
import { decodeArchitecturePackage, encodeArchitecturePackage } from "../shared/dodaf/exchange.js";
import { normalizeDodafOv1, normalizeDodafOv5, normalizeDodafOv5a } from "../shared/dodaf/products.js";
import { buildModelTopology } from "../shared/modelTopology.js";
import { renderOv5a } from "../design-studio/src/dodafOperationalViews.js";
import { createFileProjectRepository } from "../server/projectRepository.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const ov5 = normalizeDodafOv5({
  activities: [
    { id: "a-root", title: "联合筹划", type: "协调", text: "根活动正文", input: "i", output: "o", duration: "1", parentId: "" },
    { id: "a-child", title: "态势确认", type: "感知", text: "子活动正文", input: "i", output: "o", duration: "1", parentId: "a-root" },
    { id: "a-leaf", title: "效果评估", type: "评估", text: "叶活动正文", input: "i", output: "o", duration: "1", parentId: "a-child" }
  ],
  edges: [{ id: "e1", sourceId: "a-root", targetId: "a-child", type: "信息流" }]
});

const ov5aFromB = applyOv5bToOv5a(ov5, null);
assert(ov5aFromB.product === "OV-5a", "OV-5a product missing");
assert(ov5aFromB.decompositions.length === 2, "OV-5b parentId hierarchy did not produce two OV-5a references");
assert(ov5aFromB.decompositions.some((item) => item.parentActivityRef === "a-root" && item.childActivityRef === "a-child"), "OV-5b -> OV-5a child reference missing");
assert(ov5aFromB.decompositions.some((item) => item.parentActivityRef === "a-child" && item.childActivityRef === "a-leaf"), "OV-5b -> OV-5a deep reference missing");
assert(!("tree" in ov5aFromB), "OV-5a must not persist an activity tree");
for (const item of ov5aFromB.decompositions) {
  assert(!("title" in item) && !("type" in item) && !("text" in item), "OV-5a copied OV-5b activity body fields");
}

// Reparenting in OV-5a may only change parentId on existing OV-5b activities.
const reparented = setOv5aParent(ov5aFromB, "a-leaf", "a-root");
const ov5FromA = applyOv5aToOv5b(reparented, ov5);
const leaf = ov5FromA.activities.find((item) => item.id === "a-leaf");
const root = ov5FromA.activities.find((item) => item.id === "a-root");
assert(leaf.parentId === "a-root", "OV-5a -> OV-5b parentId writeback failed");
assert(leaf.title === "效果评估" && leaf.type === "评估" && leaf.text === "叶活动正文", "OV-5a overwrote OV-5b-owned activity fields");
assert(root.title === "联合筹划" && ov5FromA.activities.length === ov5.activities.length, "OV-5a created or rewrote an OV-5b activity");

const pair = syncOv5ActivityPair({ ov5: ov5FromA, ov5a: reparented, source: "ov5a" });
assert(pair.ov5a.decompositions.some((item) => item.parentActivityRef === "a-root" && item.childActivityRef === "a-leaf"), "Round-trip pair lost reparented leaf reference");

// Imported broken references stay visible as conflicts; they never create activities.
const broken = applyOv5bToOv5a(ov5, {
  decompositions: [{ parentActivityRef: "missing-parent", childActivityRef: "missing-child", status: "confirmed" }]
});
assert(broken.decompositions.some((item) => item.parentActivityRef === "missing-parent" && item.status === "conflict"), "Broken imported OV-5a reference was discarded or not marked conflict");
assert(applyOv5aToOv5b(broken, ov5).activities.length === ov5.activities.length, "Broken OV-5a reference created an OV-5b activity");

// Cycles are rejected during writeback rather than persisted into OV-5b.
const cyclic = normalizeDodafOv5a({ decompositions: [
  { parentActivityRef: "a-child", childActivityRef: "a-root" },
  { parentActivityRef: "a-root", childActivityRef: "a-child" }
] });
const cycleResult = applyOv5aToOv5b(cyclic, ov5);
assert(cycleResult.activities.find((item) => item.id === "a-root").parentId === "" && cycleResult.activities.find((item) => item.id === "a-child").parentId === "", "Cyclic OV-5a references leaked into OV-5b parentId values");

// Legacy trees are read once and normalized to references, never written back.
const migrated = normalizeDodafOv5a({
  tree: [{ id: "legacy-root", title: "旧根", children: [{ id: "legacy-child", title: "旧子", children: [] }] }]
});
assert(migrated.decompositions.some((item) => item.parentActivityRef === "legacy-root" && item.childActivityRef === "legacy-child"), "Legacy OV-5a tree did not migrate to references");
assert(!("tree" in migrated) && migrated.entities.length === 0, "Legacy OV-5a migration retained duplicated tree or Activity entities");

const ov1 = normalizeDodafOv1({ nodes: [{ id: "sense", label: "传感", kind: "equipment", detail: "d" }], edges: [] });
const architecture = mergeProductsIntoArchitecture(null, { ov1, ov5: ov5FromA, ov5a: pair.ov5a }, { projectId: "demo", title: "Demo Arch" });
assert(architecture.entities.some((entity) => entity.id === "a-root"), "Architecture library missing OV-5b activity entity");
assert(architecture.products["OV-5b"] && architecture.products["OV-5a"] && architecture.products["OV-1"], "Architecture products map incomplete");

const xml = encodeArchitecturePackage({ meta: { projectId: "demo", title: "Demo Arch" }, architecture, products: { ov1, ov5: ov5FromA, ov5a: pair.ov5a } }, "xml");
const fromXml = decodeArchitecturePackage(xml, "xml");
assert(fromXml.products["OV-5a"].decompositions.some((item) => item.childActivityRef === "a-leaf"), "XML round-trip lost OV-5a references");
assert(!("tree" in fromXml.products["OV-5a"]), "XML round-trip restored the retired OV-5a tree");

const repositoryDir = await mkdtemp(join(tmpdir(), "ov5a-reference-check-"));
const databasePath = join(repositoryDir, "projects.sqlite");
const filePath = join(repositoryDir, "projects.json");
let repository = createFileProjectRepository({ databasePath, filePath, now: () => "2026-08-18T00:00:00.000Z" });
try {
  await repository.createProject({ id: "ov5a-reference-demo", title: "OV5a reference demo" });
  let saved = await repository.saveOv5("ov5a-reference-demo", { model: ov5FromA, source: "test", expectedRevision: 0 });
  saved = await repository.saveOv5a("ov5a-reference-demo", { model: pair.ov5a, source: "test", expectedRevision: saved.revision });
  assert(saved.model.decompositions.some((item) => item.childActivityRef === "a-leaf"), "SQLite save lost OV-5a references");
  repository.close();
  repository = createFileProjectRepository({ databasePath, filePath, now: () => "2026-08-18T00:00:00.000Z" });
  const reopened = await repository.getOv5a("ov5a-reference-demo");
  assert(reopened.model.decompositions.some((item) => item.parentActivityRef === "a-root" && item.childActivityRef === "a-leaf"), "SQLite reopen lost OV-5a references");
  assert(!("tree" in reopened.model), "SQLite reopen restored the retired OV-5a tree");
} finally {
  repository.close?.();
  await rm(repositoryDir, { recursive: true, force: true });
}

const topology = buildModelTopology({ ov5: ov5FromA, ov5a: broken });
assert(topology.nodes.some((node) => node.kind === "activity-decomposition"), "Topology omitted OV-5a decomposition nodes");
assert(topology.diagnostics.some((item) => item.code === "orphan_reference" && item.ref === "missing-parent"), "Topology omitted broken OV-5a reference diagnostics");

const html = renderOv5a({ ov5: ov5FromA, ov5a: pair.ov5a, ov5aStorage: {} });
assert(html.includes("ov5a-decomposition-table") && html.includes("活动分解清单"), "OV-5a decomposition table did not render");
assert(!html.includes("dodaf-activity-tree") && !html.includes("活动树"), "Retired activity-tree presentation remains in OV-5a");

const viewSource = await readFile(new URL("../design-studio/src/dodafOperationalViews.js", import.meta.url), "utf8");
assert(viewSource.includes("decomposition.${escape(row.id)}.parentActivityRef") && !viewSource.includes("dodaf-activity-tree"), "OV-5a editor is not bound to parent references only");

console.log("OV-5a/OV-5b acceptance passed: reference-only decomposition, safe migration, topology, exchange, and controlled parent writeback.");
