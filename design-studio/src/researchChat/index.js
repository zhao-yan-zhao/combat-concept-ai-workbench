/**
 * Shared research-chat shell.
 *
 * New planning steps should:
 * 1. createResearchChatStepStore({ storagePrefix, topic, defaultWelcome, buildWelcome })
 * 2. createResearchChatSessionApplier({ key, projectId, store }) for setSession
 * 3. renderResearchChatPanel / renderResearchChatFloatButton
 * 4. createResearchChatController({ scope, getSession, setSession, runTurn })
 *    — pass signal into generateWithAiStream for Stop support
 *
 * Do not re-implement message bubbles, typing state, or composer UI.
 */
export {
  RESEARCH_CHAT_SESSION_VERSION,
  MAX_MESSAGES_DEFAULT,
  MAX_MESSAGE_CHARS_DEFAULT,
  addResearchChatTurn,
  beginResearchChatTurn,
  cancelResearchChatTurn,
  completeResearchChatTurn,
  createGenericResearchFallback,
  createMessage,
  createResearchChatSession,
  createResearchChatSessionApplier,
  createResearchChatStepStore,
  loadResearchChat,
  normalizeResearchChatSession,
  persistResearchChat,
  replaceResearchChatTurn,
  stripPendingResearchChatTurns,
  summarizeResearchChat,
  updatePendingResearchChatText
} from "./researchChatStore.js";

export {
  patchResearchChatStream,
  renderResearchChatFloatButton,
  renderResearchChatMessage,
  renderResearchChatPanel,
  scrollResearchChatToBottom
} from "./researchChatView.js";

export { createResearchChatController } from "./researchChatController.js";
