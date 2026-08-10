const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) };

const { saveModelSnapshot } = await import("../design-studio/src/modelSnapshotStore.js");
const { restoreModelSnapshot } = await import("../design-studio/src/modelSnapshotRestore.js");
const { normalizeModelSnapshotInput } = await import("../server/projectModelNormalizers.mjs");

const inspiration = {
  stage: 2,
  totalStages: 6,
  completed: false,
  summary: "Research boundary recorded.",
  messages: [
    { id: "assistant-1", role: "assistant", topic: "idea", source: "local", text: "Describe the study.", createdAt: "2026-07-15T00:00:00.000Z" },
    { id: "user-1", role: "user", topic: "idea", text: "Review a resilient decision loop.", createdAt: "2026-07-15T00:00:01.000Z" }
  ]
};
const snapshots = saveModelSnapshot({ project: { title: "Snapshot acceptance" }, direction: "Review", brief: { objective: "Review", approach: "Trace", assumptions: "Abstract", risk: "Context loss" }, inspiration, ov1: {}, ov5: {}, ooda: { lanes: [] }, scenario: null, validationResult: null });
const restored = restoreModelSnapshot(snapshots[0], { briefSeed: {} });
assert(snapshots[0].model.inspiration.messages.length === 2 && restored.inspiration?.messages[1]?.text.includes("resilient"), "Snapshot restore lost inspiration context");

const normalized = normalizeModelSnapshotInput({
  id: "model-snapshot-inspiration",
  title: "Snapshot acceptance",
  direction: "Review",
  model: {
    brief: {}, ov1: {}, ov5: { activities: [{ id: "activity-1", title: "Review", input: "Input", output: "Output" }], edges: [] }, ooda: { lanes: [{ id: "observe", nodes: [] }] }, scenario: null, validation: null,
    inspiration: { stage: 9, totalStages: 9, completed: true, summary: "Bounded", messages: Array.from({ length: 18 }, (_, index) => ({ role: index % 2 ? "user" : "assistant", source: index ? "local" : "unsupported", text: `Message ${index + 1}`, topic: "supplement", extra: "discard" })) }
  }
});
assert(normalized.model.inspiration.messages.length === 16 && normalized.model.inspiration.stage === 6 && normalized.model.inspiration.totalStages === 6 && normalized.model.inspiration.messages[0].text === "Message 3" && !Object.hasOwn(normalized.model.inspiration.messages[0], "extra"), "Server snapshot normalizer did not bound inspiration context");
console.log("Model snapshot inspiration acceptance passed: save, restore, and server-side bounds.");

function assert(condition, message) { if (!condition) throw new Error(message); }
