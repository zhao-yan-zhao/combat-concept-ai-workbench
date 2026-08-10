import { loadConceptBrief, saveConceptBrief, setConceptBriefProjectScope } from "../design-studio/src/briefStore.js";

const values = new Map();
globalThis.localStorage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
const defaultSeed = { objective: "Example objective", approach: "Example approach", assumptions: "Example assumptions", expectedEffects: "Example effects", risk: "Example risk", evidenceRefs: [] };
const emptySeed = { objective: "待补充", approach: "待补充", assumptions: "待补充", expectedEffects: "待补充", risk: "待补充", evidenceRefs: [] };
setConceptBriefProjectScope("default");
saveConceptBrief(defaultSeed, defaultSeed);
setConceptBriefProjectScope("new-research-project");
const newProjectBrief = loadConceptBrief(emptySeed);
assert(newProjectBrief.objective === "待补充" && newProjectBrief.approach === "待补充" && newProjectBrief.evidenceRefs.length === 0, "A new project inherited the default project brief");
console.log("Project brief isolation acceptance passed: a new project starts with an empty brief.");
function assert(condition, message) { if (!condition) throw new Error(message); }
