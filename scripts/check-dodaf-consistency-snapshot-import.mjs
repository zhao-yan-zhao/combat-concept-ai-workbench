const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};

import { inspectArchitectureConsistency } from "../shared/dodaf/consistency.js";
import {
  normalizeArchitecture,
  normalizeModelSnapshotInput,
  normalizeOv1,
  normalizeOv2,
  normalizeOv5,
  normalizeOv6a
} from "../server/projectModelNormalizers.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const ov1 = normalizeOv1({
  nodes: [
    { id: "sense", label: "传感平台", kind: "equipment", detail: "监视" },
    { id: "decide", label: "联合指挥", kind: "command", detail: "决策" }
  ],
  edges: [{ id: "e1", sourceId: "sense", targetId: "decide", type: "信息流" }]
});
const ov5 = normalizeOv5({
  activities: [
    { id: "a1", title: "感知", type: "感知", text: "收集", sourceOv1NodeIds: ["sense"] },
    { id: "a2", title: "判断", type: "判断", text: "评估", sourceOv1NodeIds: ["decide"] }
  ],
  edges: [{ id: "edge-1", sourceId: "a1", targetId: "a2", type: "信息流" }]
});
const ov2 = normalizeOv2({
  nodes: [
    { id: "sense", label: "传感平台" },
    { id: "decide", label: "联合指挥" }
  ],
  exchanges: [{
    id: "x1",
    sourceNodeId: "sense",
    targetNodeId: "decide",
    label: "态势分发",
    flowType: "信息流",
    sourceActivityId: "a1",
    targetActivityId: "a2"
  }]
});
const ov6a = normalizeOv6a({
  rules: [{ id: "r1", subject: "感知", type: "约束", text: "公开证据" }]
});

const clean = inspectArchitectureConsistency({ ov1, ov5, ov2, ov6a });
assert(clean.summary.conflictCount === 0, "Consistent products should not report type conflicts");
assert(clean.summary.entityCount >= 2, "Consistency summary should count entities");
// Performer-family co-existence (System in OV-1, Performer in OV-2) is allowed
assert(!clean.issues.some((item) => item.code === "entity-type-conflict"), "Performer-family types should be compatible");

const forced = inspectArchitectureConsistency({
  ov1: {
    ...ov1,
    entities: [{ id: "shared", dm2Type: "System", name: "平台 A", description: "", aliases: [], properties: {}, evidenceRefs: [], source: { mode: "manual", at: "" } }]
  },
  ov5: {
    ...ov5,
    entities: [{ id: "shared", dm2Type: "Activity", name: "活动 A", description: "", aliases: [], properties: {}, evidenceRefs: [], source: { mode: "manual", at: "" } }]
  }
});
assert(forced.issues.some((item) => item.code === "entity-type-conflict"), "System vs Activity conflict across products should be detected");

const missingSource = inspectArchitectureConsistency({
  ov1,
  ov5: normalizeOv5({
    activities: [{ id: "a9", title: "孤立", type: "分析", text: "t", sourceOv1NodeIds: ["ghost-node"] }],
    edges: []
  })
});
assert(missingSource.issues.some((item) => item.code === "ov5-source-ov1-missing"), "Missing OV-1 source on OV-5 should be flagged");

const architecture = normalizeArchitecture({
  id: "arch",
  name: "Demo",
  entities: ov1.entities,
  relations: ov1.relations,
  products: { "OV-1": ov1, "OV-5b": ov5, "OV-2": ov2, "OV-6a": ov6a }
});

const snapshot = normalizeModelSnapshotInput({
  id: "model-snapshot-full-1",
  title: "Full DM2 snapshot",
  direction: "Review",
  model: {
    brief: { objective: "o", approach: "a", assumptions: "s", expectedEffects: "e", risk: "r" },
    ov1,
    ov2,
    ov3: null,
    ov4: null,
    ov5a: null,
    ov5,
    ov6a,
    ov6b: null,
    ov6c: null,
    architecture,
    ooda: { lanes: [{ id: "observe", title: "Observe", subtitle: "O", nodes: [{ id: "n1", title: "看", text: "t" }] }] },
    scenario: null,
    validation: null
  }
});
assert(snapshot.model.ov2?.product === "OV-2", "Snapshot must retain OV-2");
assert(snapshot.model.ov6a?.product === "OV-6a", "Snapshot must retain OV-6a");
assert(snapshot.model.architecture?.product === "ArchitectureDescription" || snapshot.model.architecture?.entities?.length >= 1, "Snapshot must retain architecture");
assert(snapshot.model.ov5.activities.length === 2, "Snapshot still requires OV-5 core");

// Client snapshot builder shape (dynamic import)
const { saveModelSnapshot, snapshotContextFromState } = await import("../design-studio/src/modelSnapshotStore.js");
const { restoreModelSnapshot } = await import("../design-studio/src/modelSnapshotRestore.js");

const fakeState = {
  direction: "Review",
  brief: { objective: "o", approach: "a", assumptions: "s", expectedEffects: "e", risk: "r" },
  inspiration: null,
  ov1,
  ov2,
  ov3: null,
  ov4: null,
  ov5a: null,
  ov5,
  ov6a,
  ov6b: null,
  ov6c: null,
  architecture,
  ooda: { lanes: [{ id: "observe", title: "Observe", subtitle: "O", nodes: [{ id: "n1", title: "看", text: "t" }] }] },
  scenario: null,
  validationResult: null
};
const snapshots = saveModelSnapshot(snapshotContextFromState(fakeState, { title: "Demo" }), []);
assert(snapshots[0].model.ov2?.exchanges?.length === 1, "Client snapshot must include OV-2 exchanges");
assert(snapshots[0].model.architecture?.entities?.length >= 1, "Client snapshot must include architecture");

const restored = restoreModelSnapshot(snapshots[0], { briefSeed: {}, projectId: "demo" });
assert(restored.ov2?.product === "OV-2" || restored.ov2?.exchanges?.length === 1, "Restore must return OV-2");
assert(restored.ov6a?.rules?.length === 1, "Restore must return OV-6a");
assert(restored.architecture?.entities?.length >= 1, "Restore must return architecture");

console.log("DoDAF consistency + full snapshot acceptance passed.");
