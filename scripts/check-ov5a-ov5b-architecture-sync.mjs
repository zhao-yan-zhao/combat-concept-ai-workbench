import { applyOv5aToOv5b, applyOv5bToOv5a, syncOv5ActivityPair } from "../shared/dodaf/ov5ActivitySync.js";
import { mergeProductsIntoArchitecture } from "../shared/dodaf/architectureWriteback.js";
import { normalizeDodafOv1, normalizeDodafOv5 } from "../shared/dodaf/products.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const ov5 = normalizeDodafOv5({
  activities: [
    { id: "a-root", title: "联合筹划", type: "协调", text: "t", input: "i", output: "o", duration: "1", parentId: "" },
    { id: "a-child", title: "态势确认", type: "感知", text: "t", input: "i", output: "o", duration: "1", parentId: "a-root" },
    { id: "a-leaf", title: "效果评估", type: "评估", text: "t", input: "i", output: "o", duration: "1", parentId: "a-child" }
  ],
  edges: [{ id: "e1", sourceId: "a-root", targetId: "a-child", type: "信息流" }]
});

const ov5aFromB = applyOv5bToOv5a(ov5, null);
assert(ov5aFromB.product === "OV-5a", "OV-5a product missing");
assert(ov5aFromB.tree[0].id === "a-root" && ov5aFromB.tree[0].children[0].id === "a-child", "OV-5b→OV-5a hierarchy lost");
assert(ov5aFromB.tree[0].children[0].children[0].id === "a-leaf", "Deep child missing in OV-5a");

// Move leaf under root in OV-5a, write back to OV-5b
const reparented = {
  ...ov5aFromB,
  tree: [{
    id: "a-root",
    title: "联合筹划（修订）",
    type: "协调",
    children: [
      { id: "a-child", title: "态势确认", type: "感知", children: [] },
      { id: "a-leaf", title: "效果评估", type: "评估", children: [] }
    ]
  }]
};
const ov5FromA = applyOv5aToOv5b(reparented, ov5);
const leaf = ov5FromA.activities.find((item) => item.id === "a-leaf");
const root = ov5FromA.activities.find((item) => item.id === "a-root");
assert(leaf.parentId === "a-root", "OV-5a→OV-5b parentId writeback failed");
assert(root.title.includes("修订"), "OV-5a title did not write back to OV-5b");

const pair = syncOv5ActivityPair({ ov5: ov5FromA, ov5a: reparented, source: "ov5a" });
assert(pair.ov5a.tree[0].children.some((node) => node.id === "a-leaf"), "Round-trip pair lost reparented leaf");

const ov1 = normalizeDodafOv1({
  nodes: [{ id: "sense", label: "传感", kind: "equipment", detail: "d" }],
  edges: []
});
const architecture = mergeProductsIntoArchitecture(null, { ov1, ov5: ov5FromA, ov5a: pair.ov5a }, { projectId: "demo", title: "Demo Arch" });
assert(architecture.product === "ArchitectureDescription", "Architecture product missing");
assert(architecture.entities.some((entity) => entity.id === "a-root"), "Architecture library missing OV-5 activity entity");
assert(architecture.entities.some((entity) => entity.id === "sense"), "Architecture library missing OV-1 entity");
assert(architecture.products["OV-5b"] && architecture.products["OV-5a"] && architecture.products["OV-1"], "Architecture products map incomplete");

const again = mergeProductsIntoArchitecture(architecture, { ov5: ov5FromA }, { projectId: "demo" });
assert(again.entities.some((entity) => entity.id === "sense"), "Writeback must retain prior library entities");

console.log("OV-5a/OV-5b bidirectional sync and architecture writeback acceptance passed.");
