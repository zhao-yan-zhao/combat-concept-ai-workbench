import { createInspirationSession, loadInspirationSession, saveInspirationSession, setInspirationProjectScope } from "../design-studio/src/inspirationStore.js";
import { loadConceptBrief, saveConceptBrief, setConceptBriefProjectScope } from "../design-studio/src/briefStore.js";

const local = new Map();
globalThis.localStorage = { getItem: (key) => local.get(key) || null, setItem: (key, value) => local.set(key, String(value)), removeItem: (key) => local.delete(key) };
const seed = { objective: "Seed", approach: "Seed", assumptions: "Seed", expectedEffects: "Seed", risk: "Seed" };
setInspirationProjectScope("project-a");
setConceptBriefProjectScope("project-a");
saveInspirationSession({ ...createInspirationSession(), messages: [{ id: "a", role: "user", topic: "idea", source: "local", text: "Project A discussion", createdAt: "2026-07-16T00:00:00.000Z" }] });
saveConceptBrief({ ...seed, objective: "Project A brief" }, seed);
setInspirationProjectScope("project-b");
setConceptBriefProjectScope("project-b");
assert(!loadInspirationSession().messages.some((item) => item.text === "Project A discussion"), "New project inherited another project's inspiration history");
assert(loadConceptBrief(seed).objective === "Seed", "New project inherited another project's brief draft");
saveConceptBrief({ ...seed, objective: "Project B brief" }, seed);
setConceptBriefProjectScope("project-a");
assert(loadConceptBrief(seed).objective === "Project A brief", "Project-scoped brief draft did not restore on return");
console.log("Project local-draft isolation acceptance passed.");
function assert(condition, message) { if (!condition) throw new Error(message); }
