import { createAiOv1Draft, createLocalOv1Draft } from "../design-studio/src/ov1DraftStore.js";
import { applyAiOv5Draft, createLocalOv5Draft } from "../design-studio/src/ov5DraftStore.js";

const brief = { objective: "Review", approach: "Trace", assumptions: "Abstract", expectedEffects: "Create a reviewable feedback loop", evidenceRefs: ["sensitive-reference-id"], risk: "Uncertainty" };
const localOv1 = createLocalOv1Draft({ brief, direction: "Review" });
assert(localOv1.nodes.find((node) => node.id === "assess")?.detail.includes("Create a reviewable feedback loop"), "Local OV-1 assessment did not consume brief expected effects");
const aiOv1 = createAiOv1Draft({ brief, direction: "Review", draft: { expectedEffects: "Confirm bounded outcome", phases: [], risks: [] } });
assert(aiOv1.nodes.find((node) => node.id === "assess")?.detail.includes("Confirm bounded outcome"), "AI OV-1 assessment did not prefer draft expected effects");
const localOv5 = createLocalOv5Draft({ brief, direction: "Review", evidence: [] });
const localAssess = localOv5.activities.find((activity) => activity.id === "ov5-assess");
assert(localAssess?.text.includes("Create a reviewable feedback loop"), "Local OV-5 assessment did not consume brief expected effects");
assert(!localOv5.activities.some((activity) => activity.refs.includes("sensitive-reference-id")), "Brief evidence references were propagated into OV-5 activities without selected evidence");
const aiOv5 = applyAiOv5Draft({ brief, direction: "Review", draft: { expectedEffects: "Confirm bounded outcome", phases: [], risks: [] }, evidence: [{ title: "Standard evidence" }] });
assert(aiOv5.activities.find((activity) => activity.id === "ov5-assess")?.text.includes("Confirm bounded outcome"), "AI OV-5 assessment did not prefer draft expected effects");
assert(aiOv5.activities.every((activity) => activity.refs.join("|") === "Standard evidence"), "OV-5 references did not remain limited to selected evidence");
assert(localOv1.schema === "dodaf-2.02-dm2-ov" && localOv1.product === "OV-1", "Local OV-1 draft missing DM2 envelope");
assert(aiOv5.schema === "dodaf-2.02-dm2-ov" && aiOv5.product === "OV-5b" && aiOv5.entities?.every((entity) => entity.dm2Type === "Activity"), "AI OV-5 draft missing DM2 Activity entities");
console.log("Brief expected-effects downstream acceptance passed: OV-1 and OV-5 consume effects without expanding brief evidence references.");

function assert(condition, message) { if (!condition) throw new Error(message); }
