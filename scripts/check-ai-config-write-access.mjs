import { createAiConfigWriteAuthorizer } from "../server/projectAiConfigWriteAccess.mjs";

const disabled = createAiConfigWriteAuthorizer();
assert(disabled.getStatus().enabled === false && disabled.getStatus().authentication === "disabled", "Default AI configuration write policy was not disabled");
await assertRejects(() => disabled.authorize({}), "Disabled AI configuration writes were accepted");

const lead = { id: "local-lead", label: "Research lead", roles: ["researcher", "reviewer", "lead"] };
const allowed = createAiConfigWriteAuthorizer({ enabled: true, authenticate: async () => lead });
assert((await allowed.authorize({})).id === lead.id && allowed.getStatus().enabled, "Authenticated lead could not change AI configuration");

const denied = createAiConfigWriteAuthorizer({ enabled: true, authenticate: async () => ({ id: "local-researcher", roles: ["researcher"] }) });
await assertRejects(() => denied.authorize({}), "Non-lead changed AI configuration");
console.log("AI configuration write-access acceptance passed: default deny and lead-only opt-in.");

async function assertRejects(run, message) { try { await run(); } catch (error) { if (error?.statusCode === 403) return; } throw new Error(message); }
function assert(condition, message) { if (!condition) throw new Error(message); }
