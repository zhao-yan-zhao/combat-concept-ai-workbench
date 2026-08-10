import { addInspirationReply, createInspirationSession, getInspirationAnswers, getInspirationTopics, updateInspirationAnswers } from "../design-studio/src/inspirationStore.js";
import { renderInspirationSession } from "../design-studio/src/inspirationView.js";

globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
let session = createInspirationSession();
session = addInspirationReply(session, "Initial abstract research idea.");
session = addInspirationReply(session, "Bounded research environment.");
const updated = updateInspirationAnswers(session, { idea: "Edited abstract research idea.", environment: "Edited bounded environment." });
const answers = getInspirationAnswers(updated);
assert(answers.idea === "Edited abstract research idea." && answers.environment === "Edited bounded environment." && updated.messages.length === session.messages.length, "Structured inspiration edit changed message bounds or did not replace answers");
assert(getInspirationTopics().length === 6, "Inspiration topic schema changed unexpectedly");
const html = renderInspirationSession({ session: updated });
assert(!html.includes("inspirationAnswersForm") && !html.includes("结构化研究收集"), "Removed structured inspiration controls were still rendered");
console.log("Inspiration history retention acceptance passed: legacy structured answers remain stored but are not rendered in research chat.");
function assert(condition, message) { if (!condition) throw new Error(message); }
