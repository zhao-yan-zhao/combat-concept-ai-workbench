import { createResearchChatStepStore } from "./researchChat/researchChatStore.js";

const store = createResearchChatStepStore({
  storagePrefix: "combat-concept-project-phase-action-chat-v1",
  topic: "revision",
  maxMessages: 24,
  defaultWelcome: () => "阶段草案生成后，可在此用自然语言提出修改要求。例如：合并第 2、3 阶段；补充电子压制进入条件；把撤离阶段时窗缩短。",
  buildWelcome: (plan = {}) => {
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
});

export function loadPhaseActionChat(projectId) {
  return store.load(projectId);
}

export function persistPhaseActionChat(session, projectId) {
  return store.persist(session, projectId);
}

export function createPhaseActionChat(seedText = "") {
  return store.create(seedText);
}

export function ensurePhaseActionChatWelcome(session, plan = {}) {
  return store.ensureWelcome(session, plan);
}

export function seedPhaseActionChatFromPlan(plan = {}) {
  return store.seed(plan);
}

export function beginPhaseActionChatTurn(session, question, replaceMessageId = "") {
  return store.begin(session, question, replaceMessageId);
}

export function updatePhaseActionChatPendingText(session, text) {
  return store.updatePending(session, text);
}

export function completePhaseActionChatTurn(session, advice, source = "ai") {
  return store.complete(session, advice, source);
}

export function cancelPhaseActionChatTurn(session, reason = "") {
  return store.cancel(session, { reason });
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
  return store.summarize(session, limit);
}

export function normalizePhaseActionChat(value) {
  return store.normalize(value);
}

/** Shared store instance for createResearchChatSessionApplier. */
export const phaseActionChatStepStore = store;

function clean(value, max = 800) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}
