import {
  addInspirationAdviceTurn,
  addInspirationReply,
  beginInspirationAdviceTurn,
  completeInspirationAdviceTurn,
  createInspirationSession,
  getInspirationProgress,
  replaceInspirationAdviceTurn
} from "../design-studio/src/inspirationStore.js";
import { renderInspirationSession } from "../design-studio/src/inspirationView.js";

let session = createInspirationSession();
session = addInspirationReply(session, "Initial bounded concept.");
const stage = getInspirationProgress(session).stage;
const advised = addInspirationAdviceTurn(session, "What evidence should be clarified?", "Clarify assumptions, constraints, and public evidence before comparison.", "ai");
assert(getInspirationProgress(advised).stage === stage, "Advice turn incorrectly advanced guided inspiration stage");
assert(advised.messages.at(-2)?.topic === "consultation" && advised.messages.at(-1)?.source === "ai", "Advice turn did not retain bounded question and AI provenance");
const retried = replaceInspirationAdviceTurn(advised, advised.messages.at(-2).id, "Which public evidence matters most?", "Prioritize declared assumptions and attributable public evidence.", "ai");
assert(retried.messages.at(-2)?.text === "Which public evidence matters most?" && retried.messages.at(-1)?.text.startsWith("Prioritize"), "Advice retry did not replace the selected consultation turn");
assert(getInspirationProgress(retried).stage === stage, "Advice retry incorrectly advanced guided inspiration stage");

const pending = beginInspirationAdviceTurn(session, "What constraints matter first?");
assert(pending.messages.at(-2)?.role === "user" && pending.messages.at(-1)?.pending, "Optimistic consultation turn did not append user + pending assistant");
const pendingHtml = renderInspirationSession({ session: pending, adviceGenerating: true });
assert(pendingHtml.includes("research-chat-typing") && pendingHtml.includes("AI 正在分析") && pendingHtml.includes("researchChatThread"), "Pending research chat state was not rendered");
const completed = completeInspirationAdviceTurn(pending, "Focus on authorization boundaries and evidence gaps.", "ai");
assert(!completed.messages.at(-1)?.pending && completed.messages.at(-1)?.source === "ai", "Pending assistant was not completed with AI provenance");
assert(getInspirationProgress(completed).stage === stage, "Optimistic advice flow incorrectly advanced guided inspiration stage");

const html = renderInspirationSession({ session: advised });
assert(html.includes("researchChatForm") && html.includes("研究对话") && html.includes("data-research-chat-retry"), "Research chat controls were not rendered in inspiration session");
console.log("Research chat advice acceptance passed.");
function assert(condition, message) { if (!condition) throw new Error(message); }
