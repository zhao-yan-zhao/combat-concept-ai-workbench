import { createResearchChatStepStore } from "./researchChat/researchChatStore.js";

const store = createResearchChatStepStore({
  storagePrefix: "combat-concept-project-force-mission-chat-v1",
  topic: "revision",
  maxMessages: 24,
  defaultWelcome: () => "兵力草案生成后，可在此用自然语言提出修改要求。例如：补充护航分队；把主战任务改为 SEAD；为阶段 2 增加预警概念单元。",
  buildWelcome: (plan = {}) => {
    const concepts = Array.isArray(plan.forces) ? plan.forces : [];
    const combats = Array.isArray(plan.combatForces) ? plan.combatForces : [];
    const relations = Array.isArray(plan.relations) ? plan.relations : [];
    const summary = concepts.length || combats.length
      ? `当前草案：概念兵力 ${concepts.length}、作战兵力 ${combats.length}、关系 ${relations.length}。`
      : "当前尚无兵力与任务草案。";
    return `${summary}可在此用自然语言修订编组职责、阶段挂接、任务类型或关系；修改后中间栏同步更新，满意后再确认本步。`;
  }
});

export function loadForceMissionChat(projectId) {
  return store.load(projectId);
}

export function persistForceMissionChat(session, projectId) {
  return store.persist(session, projectId);
}

export function createForceMissionChat(seedText = "") {
  return store.create(seedText);
}

export function ensureForceMissionChatWelcome(session, plan = {}) {
  return store.ensureWelcome(session, plan);
}

export function seedForceMissionChatFromPlan(plan = {}) {
  return store.seed(plan);
}

export function beginForceMissionChatTurn(session, question, replaceMessageId = "") {
  return store.begin(session, question, replaceMessageId);
}

export function updateForceMissionChatPendingText(session, text) {
  return store.updatePending(session, text);
}

export function completeForceMissionChatTurn(session, advice, source = "ai") {
  return store.complete(session, advice, source);
}

export function cancelForceMissionChatTurn(session, reason = "") {
  return store.cancel(session, { reason });
}

export function summarizeForceMissionChat(session, limit = 6) {
  return store.summarize(session, limit);
}

export function normalizeForceMissionChat(value) {
  return store.normalize(value);
}

export const forceMissionChatStepStore = store;
