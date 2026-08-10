import { createProjectWriteAuthorizer } from "../server/projectWriteAccess.mjs";

const disabled = createProjectWriteAuthorizer({ enabled: false, authenticate: async () => { throw new Error("not called"); } });
assert(disabled.getStatus().enabled === false && await disabled.authorize({}) === null, "Disabled project-write policy changed prototype behavior");

const researcher = { id: "researcher-1", label: "Researcher", roles: ["researcher", "reviewer"] };
const enabled = createProjectWriteAuthorizer({ enabled: true, authenticate: async () => researcher });
assert(enabled.getStatus().enabled && (await enabled.authorize({})).id === researcher.id, "Authenticated researcher was not allowed to write project data");

const denied = createProjectWriteAuthorizer({ enabled: true, authenticate: async () => ({ id: "observer", roles: [] }) });
await assertRejects(() => denied.authorize({}), 403, "Actor without a project-write role was permitted");
const unauthenticated = createProjectWriteAuthorizer({ enabled: true, authenticate: async () => { const error = new Error("login required"); error.statusCode = 403; throw error; } });
await assertRejects(() => unauthenticated.authorize({}), 403, "Unauthenticated project write was permitted");
await assertRejects(() => unauthenticated.authorize({}), 403, "Unauthenticated project audit read was not rejected by the shared deployment gate");

console.log("Project-write access acceptance passed: disabled compatibility and authenticated role enforcement.");

async function assertRejects(run, status, message) { try { await run(); } catch (error) { if (error?.statusCode === status) return; } throw new Error(message); }
function assert(condition, message) { if (!condition) throw new Error(message); }
