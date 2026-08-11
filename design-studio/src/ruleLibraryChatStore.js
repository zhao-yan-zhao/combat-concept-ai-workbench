import {
  beginResearchChatTurn,
  completeResearchChatTurn,
  createResearchChatSession,
  loadResearchChat,
  normalizeResearchChatSession,
  persistResearchChat,
  summarizeResearchChat,
  updatePendingResearchChatText
} from "./researchChat/researchChatStore.js";

const STORAGE_PREFIX = "combat-concept-project-rule-library-chat-v1";
const TOPIC = "revision";
const MAX_MESSAGES = 24;

export function loadRuleLibraryChat(projectId) {
  return loadResearchChat(storageKey(projectId), {
    fallbackWelcome: defaultWelcome()
  });
}

export function persistRuleLibraryChat(session, projectId) {
  return persistResearchChat(
    normalizeRuleLibraryChat(session),
    storageKey(projectId),
    { fallbackWelcome: defaultWelcome() }
  );
}

export function createRuleLibraryChat(seedText = "") {
  return createResearchChatSession({
    welcome: clean(seedText) || defaultWelcome(),
    topic: "welcome",
    source: "local"
  });
}

export function ensureRuleLibraryChatWelcome(session, model = {}) {
  const normalized = normalizeRuleLibraryChat(session);
  if (normalized.messages.length) return normalized;
  return createRuleLibraryChat(buildWelcomeFromModel(model));
}

export function seedRuleLibraryChatFromModel(model = {}) {
  return createRuleLibraryChat(buildWelcomeFromModel(model));
}

export function beginRuleLibraryChatTurn(session, question, replaceMessageId = "") {
  return beginResearchChatTurn(normalizeRuleLibraryChat(session), question, {
    replaceMessageId,
    topic: TOPIC
  });
}

export function updateRuleLibraryChatPendingText(session, text) {
  return updatePendingResearchChatText(normalizeRuleLibraryChat(session), text);
}

export function completeRuleLibraryChatTurn(session, advice, source = "ai") {
  return completeResearchChatTurn(normalizeRuleLibraryChat(session), advice, source, { topic: TOPIC });
}

export function summarizeRuleLibraryChat(session, limit = 6) {
  return summarizeResearchChat(session, { topics: [TOPIC], limit });
}

export function normalizeRuleLibraryChat(value) {
  return normalizeResearchChatSession(value, {
    maxMessages: MAX_MESSAGES,
    fallbackWelcome: defaultWelcome()
  });
}

function buildWelcomeFromModel(model = {}) {
  const rules = Array.isArray(model.rules) ? model.rules : [];
  if (!rules.length) {
    return "规则库为空。可说明要起草的约束类型（授权、时窗、链路、交战门槛等），或直接要求按简报起草一批规则。";
  }
  const preview = rules.slice(0, 4).map((rule, index) => `${index + 1}.${clean(rule.name || rule.subject, 16)}`).join("、");
  return `当前规则库 ${rules.length} 条：${preview}${rules.length > 4 ? "…" : ""}。可用自然语言增删改规则本体（名称/类型/范围/描述）；本步不绑定活动。`;
}

function defaultWelcome() {
  return "在此用自然语言起草或修订规则本体。例如：补充关键链路可用约束；把窗口规则拆成进入与退出两条；删除空泛套话规则。";
}

function clean(value, max = 800) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function storageKey(projectId) {
  return `${STORAGE_PREFIX}:${projectId || "default"}`;
}
