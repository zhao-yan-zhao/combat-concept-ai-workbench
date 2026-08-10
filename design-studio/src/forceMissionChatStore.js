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

const STORAGE_PREFIX = "combat-concept-project-force-mission-chat-v1";
const TOPIC = "revision";
const MAX_MESSAGES = 24;

export function loadForceMissionChat(projectId) {
  return loadResearchChat(storageKey(projectId), {
    fallbackWelcome: defaultWelcome()
  });
}

export function persistForceMissionChat(session, projectId) {
  return persistResearchChat(
    normalizeForceMissionChat(session),
    storageKey(projectId),
    { fallbackWelcome: defaultWelcome() }
  );
}

export function createForceMissionChat(seedText = "") {
  return createResearchChatSession({
    welcome: clean(seedText) || defaultWelcome(),
    topic: "welcome",
    source: "local"
  });
}

export function ensureForceMissionChatWelcome(session, plan = {}) {
  const normalized = normalizeForceMissionChat(session);
  if (normalized.messages.length) return normalized;
  return createForceMissionChat(buildWelcomeFromPlan(plan));
}

export function seedForceMissionChatFromPlan(plan = {}) {
  return createForceMissionChat(buildWelcomeFromPlan(plan));
}

export function beginForceMissionChatTurn(session, question, replaceMessageId = "") {
  return beginResearchChatTurn(normalizeForceMissionChat(session), question, {
    replaceMessageId,
    topic: TOPIC
  });
}

export function updateForceMissionChatPendingText(session, text) {
  return updatePendingResearchChatText(normalizeForceMissionChat(session), text);
}

export function completeForceMissionChatTurn(session, advice, source = "ai") {
  return completeResearchChatTurn(normalizeForceMissionChat(session), advice, source, { topic: TOPIC });
}

export function summarizeForceMissionChat(session, limit = 6) {
  return summarizeResearchChat(session, { topics: [TOPIC], limit });
}

export function normalizeForceMissionChat(value) {
  return normalizeResearchChatSession(value, {
    maxMessages: MAX_MESSAGES,
    fallbackWelcome: defaultWelcome()
  });
}

function buildWelcomeFromPlan(plan = {}) {
  const concepts = Array.isArray(plan.forces) ? plan.forces : [];
  const combats = Array.isArray(plan.combatForces) ? plan.combatForces : [];
  const relations = Array.isArray(plan.relations) ? plan.relations : [];
  const summary = concepts.length || combats.length
    ? `当前草案：概念兵力 ${concepts.length}、作战兵力 ${combats.length}、关系 ${relations.length}。`
    : "当前尚无兵力与任务草案。";
  return `${summary}可在此用自然语言修订编组职责、阶段挂接、任务类型或关系；修改后中间栏同步更新，满意后再确认本步。`;
}

function defaultWelcome() {
  return "兵力草案生成后，可在此用自然语言提出修改要求。例如：补充护航分队；把主战任务改为 SEAD；为阶段 2 增加预警概念单元。";
}

function clean(value, max = 800) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function storageKey(projectId) {
  return `${STORAGE_PREFIX}:${projectId || "default"}`;
}
