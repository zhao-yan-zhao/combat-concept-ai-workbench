import { createProjectBriefSyncController } from "../design-studio/src/projectBriefSyncController.js";
import { createProjectModelSyncController } from "../design-studio/src/projectModelSyncController.js";
import { createProjectOv5SyncController } from "../design-studio/src/projectOv5SyncController.js";
import { renderProjectStorageState } from "../design-studio/src/projectStorageView.js";

const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key)
};
globalThis.fetch = async (url) => {
  if (String(url) === "/api/health") return json({ projectRepository: { conceptBrief: true, ov1: true, ov5: true } });
  throw new Error(`Unexpected fetch: ${url}`);
};

try {
  await verifyGenericModelRecovery();
  await verifyBriefRecovery();
  await verifyOv5RefreshDoesNotForceOverwrite();
  console.log("Project conflict-draft recovery acceptance passed: local drafts survive conflict and explicit remote loads without server writes.");
} finally {
  globalThis.fetch = originalFetch;
  globalThis.localStorage = originalStorage;
}

async function verifyGenericModelRecovery() {
  const state = { projectRevision: 4, ov1Storage: { revision: 4, resourceRevision: 2 } };
  const restored = [];
  const controller = createProjectModelSyncController({
    projectId: "default", resource: "ov1", storageKey: "ov1Storage", resourceLabel: "OV-1",
    load: async () => ({ exists: true, stale: false, revision: 8, resourceRevision: 4, model: { id: "remote" } }),
    save: async () => { const error = new Error("conflict"); error.status = 409; throw error; },
    getState: () => state, render: () => {}, notify: () => {}, applyRemote: () => true,
    conflictRecovery: { capture: () => ({ id: "captured" }), restore: (model) => restored.push(model) }
  });
  await controller.sync({ id: "local" });
  assert(state.ov1Storage.conflict && state.ov1Storage.conflictDraftAvailable, "Generic 409 did not retain a local conflict draft");
  assert(renderProjectStorageState(state.ov1Storage, { refreshAction: "refresh-project-ov1" }).includes("restore-project-ov1-conflict-draft"), "Conflict draft did not expose an explicit restore action");
  assert(controller.handleAction("restore-project-ov1-conflict-draft"), "Generic conflict restore action was not handled");
  assert(restored[0]?.id === "local" && state.ov1Storage.status === "recovery", "Generic conflict draft was not restored locally");
  await controller.hydrate({ forceRemote: true });
  assert(state.ov1Storage.conflictDraftAvailable, "Explicit remote load did not preserve a recoverable local draft");
}

async function verifyBriefRecovery() {
  const state = { projectRevision: 3, projectStorage: { revision: 3 } };
  const restored = [];
  const controller = createProjectBriefSyncController({
    projectId: "default", getState: () => state, render: () => {}, notify: () => {}, applyRemoteBrief: () => true,
    captureLocal: () => ({ brief: { objective: "Captured" }, direction: "Captured" }),
    restoreLocal: (model) => restored.push(model)
  });
  globalThis.fetch = async (url, options = {}) => {
    if (String(url) === "/api/health") return json({ projectRepository: { conceptBrief: true } });
    if (String(url).includes("/brief") && options.method === "PUT") return new Response("conflict", { status: 409 });
    throw new Error(`Unexpected fetch: ${url}`);
  };
  await controller.sync({ objective: "Local" }, { direction: "Local" });
  assert(state.projectStorage.conflictDraftAvailable, "Brief 409 did not retain a local conflict draft");
  controller.handleAction("restore-project-brief-conflict-draft");
  assert(restored[0]?.brief?.objective === "Local" && state.projectStorage.status === "recovery", "Brief conflict draft was not restored locally");
}

async function verifyOv5RefreshDoesNotForceOverwrite() {
  globalThis.fetch = async (url) => {
    if (String(url) === "/api/health") return json({ projectRepository: { ov5: true } });
    if (String(url).includes("/ov5")) return json({ exists: true, revision: 7, resourceRevision: 4, briefRevision: 3, model: { activities: [{ id: "remote" }], edges: [] } });
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const state = { projectRevision: 2, ov5Storage: { revision: 2, localSaved: true } };
  const forces = [];
  const controller = createProjectOv5SyncController({
    projectId: "default", getState: () => state, render: () => {}, notify: () => {},
    applyRemoteOv5: (_remote, { force }) => { forces.push(force); return force; },
    captureLocal: () => ({ activities: [{ id: "local" }], edges: [] }), restoreLocal: () => {}
  });
  await controller.hydrate({ interactive: true });
  assert(forces.join(",") === "false" && state.ov5Storage.remoteAvailable, "OV-5 refresh overwrote local work instead of exposing explicit remote load");
  await controller.hydrate({ interactive: true, forceRemote: true });
  assert(forces.join(",") === "false,true" && state.ov5Storage.conflictDraftAvailable, "OV-5 explicit remote load did not preserve a local recovery draft");
}

function json(value) { return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } }); }
function assert(condition, message) { if (!condition) throw new Error(message); }
