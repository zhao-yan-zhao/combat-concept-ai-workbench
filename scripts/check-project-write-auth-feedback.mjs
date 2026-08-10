import { createProjectWriteFailureState } from "../design-studio/src/projectWriteFailureState.js";
import { createProjectBriefSyncController } from "../design-studio/src/projectBriefSyncController.js";

const denied = createProjectWriteFailureState({ status: 403 }, "OV-5", () => ({ status: "offline" }));
assert(denied.status === "auth-required" && denied.authenticationRequired && denied.label.includes("协同登录"), "Project write authorization was presented as an offline failure");

const originalFetch = globalThis.fetch;
const state = { projectRevision: 1, projectStorage: { revision: 1 } };
globalThis.fetch = async (url, options = {}) => {
  if (String(url) === "/api/health") return json({ projectRepository: { conceptBrief: true } });
  if (String(url).includes("/brief") && options.method === "PUT") return new Response(JSON.stringify({ error: "login required" }), { status: 403 });
  throw new Error(`Unexpected fetch: ${url}`);
};
try {
  const controller = createProjectBriefSyncController({ projectId: "default", getState: () => state, render: () => {}, notify: () => {}, applyRemoteBrief: () => false });
  await controller.sync({ objective: "Local", approach: "Local", assumptions: "Local", risk: "Local" }, { direction: "Local" });
  assert(state.projectStorage.status === "auth-required" && state.projectStorage.authenticationRequired, "Brief authorization denial was not retained as a login-required state");
  console.log("Project-write authentication feedback acceptance passed: 403 preserves local work and requests collaboration login.");
} finally { globalThis.fetch = originalFetch; }

function json(value) { return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } }); }
function assert(condition, message) { if (!condition) throw new Error(message); }
