/**
 * Shared research-chat shell.
 *
 * New planning steps should:
 * 1. Keep a step-scoped session store (or reuse load/persist helpers)
 * 2. Call renderResearchChatPanel / renderResearchChatFloatButton
 * 3. createResearchChatController({ scope, getSession, setSession, runTurn })
 *
 * Do not re-implement message bubbles, typing state, or composer UI.
 */
export {
  addResearchChatTurn,
  beginResearchChatTurn,
  completeResearchChatTurn,
  createMessage,
  createResearchChatSession,
  loadResearchChat,
  normalizeResearchChatSession,
  persistResearchChat,
  replaceResearchChatTurn,
  stripPendingResearchChatTurns,
  summarizeResearchChat
} from "./researchChatStore.js";

export {
  renderResearchChatFloatButton,
  renderResearchChatMessage,
  renderResearchChatPanel,
  scrollResearchChatToBottom
} from "./researchChatView.js";

export { createResearchChatController } from "./researchChatController.js";
