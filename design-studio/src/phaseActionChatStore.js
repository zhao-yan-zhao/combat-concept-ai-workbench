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

const STORAGE_PREFIX = "combat-concept-project-phase-action-chat-v1";
const TOPIC = "revision";
const MAX_MESSAGES = 24;

export function loadPhaseActionChat(projectId) {
  return loadResearchChat(storageKey(projectId), {
    fallbackWelcome: defaultWelcome()
  });
}

export function persistPhaseActionChat(session, projectId) {
  return persistResearchChat(
    normalizePhaseActionChat(session),
    storageKey(projectId),
    { fallbackWelcome: defaultWelcome() }
  );
}

export function createPhaseActionChat(seedText = "") {
  return createResearchChatSession({
    welcome: clean(seedText) || defaultWelcome(),
    topic: "welcome",
    source: "local"
  });
}

export function ensurePhaseActionChatWelcome(session, plan = {}) {
  const normalized = normalizePhaseActionChat(session);
  if (normalized.messages.length) return normalized;
  return createPhaseActionChat(buildWelcomeFromPlan(plan));
}

export function seedPhaseActionChatFromPlan(plan = {}) {
  return createPhaseActionChat(buildWelcomeFromPlan(plan));
}

export function beginPhaseActionChatTurn(session, question, replaceMessageId = "") {
  return beginResearchChatTurn(normalizePhaseActionChat(session), question, {
    replaceMessageId,
    topic: TOPIC
  });
}

export function updatePhaseActionChatPendingText(session, text) {
  return updatePendingResearchChatText(normalizePhaseActionChat(session), text);
}

export function completePhaseActionChatTurn(session, advice, source = "ai") {
  return completeResearchChatTurn(normalizePhaseActionChat(session), advice, source, { topic: TOPIC });
}

export function addPhaseActionChatTurn(session, question, advice, source = "ai") {
  return completePhaseActionChatTurn(beginPhaseActionChatTurn(session, question), advice, source);
}

export function replacePhaseActionChatTurn(session, userMessageId, question, advice, source = "ai") {
  return completePhaseActionChatTurn(
    beginPhaseActionChatTurn(session, question, userMessageId),
    advice,
    source
  );
}

export function summarizePhaseActionChat(session, limit = 6) {
  return summarizeResearchChat(session, { topics: [TOPIC], limit });
}

export function normalizePhaseActionChat(value) {
  return normalizeResearchChatSession(value, {
    maxMessages: MAX_MESSAGES,
    fallbackWelcome: defaultWelcome()
  });
}

function buildWelcomeFromPlan(plan = {}) {
  const phases = Array.isArray(plan.phases) ? plan.phases : [];
  const questions = Array.isArray(plan.openQuestions) ? plan.openQuestions.filter(Boolean).slice(0, 3) : [];
  const phaseSummary = phases.length
    ? `当前草案共 ${phases.length} 个阶段：${phases.map((phase, index) => `${index + 1}.${clean(phase.name, 20)}`).join(" → ")}。`
    : "当前尚无阶段草案。";
  const questionHint = questions.length
    ? `建议先关注：${questions.map((item) => clean(item, 48)).join("；")}。`
    : "可直接说明要改的阶段顺序、行动、时窗或转换条件。";
  return `${phaseSummary}${questionHint}修改后中间栏会同步更新，满意后再确认本步。`;
}

function defaultWelcome() {
  return "阶段草案生成后，可在此用自然语言提出修改要求。例如：合并第 2、3 阶段；补充电子压制进入条件；把撤离阶段时窗缩短。";
}

function clean(value, max = 800) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function storageKey(projectId) {
  return `${STORAGE_PREFIX}:${projectId || "default"}`;
}
