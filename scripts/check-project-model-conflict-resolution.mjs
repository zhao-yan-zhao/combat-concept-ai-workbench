import { createProjectModelSyncController } from "../design-studio/src/projectModelSyncController.js";
import { renderProjectStorageState } from "../design-studio/src/projectStorageView.js";

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  if (String(url) === "/api/health") return json({ projectRepository: { ov5: true } });
  throw new Error(`Unexpected fetch: ${url}`);
};

const state = { projectRevision: 2, ov5Storage: { status: "ready", mode: "server", revision: 2, resourceRevision: 1 } };
const remote = { exists: true, stale: false, revision: 5, resourceRevision: 3, auditCount: 4, updatedAt: "2026-07-14T00:00:00.000Z", model: { activities: [{ id: "remote" }], edges: [] } };
const applied = [];
const controller = createProjectModelSyncController({
  projectId: "default",
  resource: "ov5",
  storageKey: "ov5Storage",
  resourceLabel: "OV-5",
  load: async () => remote,
  save: async () => { const error = new Error("conflict"); error.status = 409; throw error; },
  getState: () => state,
  render: () => {},
  notify: () => {},
  applyRemote: (_value, { force }) => { applied.push(force); return force; }
});

try {
  await controller.hydrate({ interactive: true });
  assert(applied.join(",") === "false" && state.ov5Storage.remoteAvailable, "Refresh overwrote the local model instead of retaining it for review");
  const reviewHtml = renderProjectStorageState(state.ov5Storage, { refreshAction: "refresh-project-ov5" });
  assert(reviewHtml.includes("load-project-ov5") && reviewHtml.includes("载入服务端"), "Remote revision did not expose an explicit load action");
  await controller.hydrate({ interactive: true, forceRemote: true });
  assert(applied.join(",") === "false,true" && !state.ov5Storage.remoteAvailable, "Explicit load did not apply the server model");
  await controller.sync({ activities: [{ id: "local" }], edges: [] });
  assert(state.ov5Storage.conflict && renderProjectStorageState(state.ov5Storage, { refreshAction: "refresh-project-ov5" }).includes("load-project-ov5"), "409 conflict did not preserve a local-resolution action");
  console.log("Project model conflict-resolution acceptance passed: refresh retains local, explicit load applies remote.");
} finally {
  globalThis.fetch = originalFetch;
}

function json(value) { return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } }); }
function assert(condition, message) { if (!condition) throw new Error(message); }
