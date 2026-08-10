import { createProjectBriefSyncController } from "../design-studio/src/projectBriefSyncController.js";
import { renderProjectStorageState } from "../design-studio/src/projectStorageView.js";

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  if (String(url) === "/api/health") return json({ projectRepository: { conceptBrief: true } });
  if (String(url).includes("/brief")) return json(remote);
  throw new Error(`Unexpected fetch: ${url}`);
};

const state = { projectRevision: 2, projectStorage: { status: "ready", mode: "server", revision: 2, resourceRevision: 2 } };
const remote = { exists: true, revision: 5, resourceRevision: 5, briefRevision: 5, auditCount: 5, updatedAt: "2026-07-14T00:00:00.000Z", brief: { objective: "Remote", approach: "Remote", assumptions: "Remote", risk: "Remote" }, direction: "Remote" };
const applied = [];
let savedInput = null;
const controller = createProjectBriefSyncController({
  projectId: "default",
  getState: () => state,
  render: () => {},
  notify: () => {},
  applyRemoteBrief: (_remote, { force }) => { applied.push(force); return force; }
});

try {
  await controller.hydrate({ interactive: true });
  assert(applied.join(",") === "false" && state.projectStorage.remoteAvailable, "Brief refresh overwrote the local draft");
  assert(renderProjectStorageState(state.projectStorage).includes("load-project-brief"), "Brief refresh did not expose explicit server load");
  await controller.hydrate({ interactive: true, forceRemote: true });
  assert(applied.join(",") === "false,true" && !state.projectStorage.remoteAvailable, "Explicit brief server load did not apply remote revision");
  const conflictController = createProjectBriefSyncController({
    projectId: "default",
    getState: () => state,
    render: () => {},
    notify: () => {},
    applyRemoteBrief: () => false
  });
  globalThis.fetch = async (url, options = {}) => {
    if (String(url) === "/api/health") return json({ projectRepository: { conceptBrief: true } });
    if (String(url).includes("/brief") && options.method === "PUT") { savedInput = JSON.parse(options.body); return new Response(JSON.stringify({ error: "conflict" }), { status: 409 }); }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  await conflictController.sync({ objective: "Local", approach: "Local", assumptions: "Local", risk: "Local" }, { direction: "Local" });
  assert(savedInput.expectedRevision === 5 && state.projectStorage.conflict && renderProjectStorageState(state.projectStorage).includes("load-project-brief"), "Brief save did not send revision or retain conflict recovery action");
  console.log("Project brief conflict-resolution acceptance passed: refresh retains local, explicit load applies remote.");
} finally {
  globalThis.fetch = originalFetch;
}

function json(value) { return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } }); }
function assert(condition, message) { if (!condition) throw new Error(message); }
