import { createResearchChatStepStore } from "./researchChat/researchChatStore.js";

const store = createResearchChatStepStore({
  storagePrefix: "combat-concept-project-rule-library-chat-v1",
  topic: "revision",
  maxMessages: 24,
  defaultWelcome: () => "在此用自然语言起草或修订规则本体。例如：补充关键链路可用约束；把窗口规则拆成进入与退出两条；删除空泛套话规则。",
  buildWelcome: (model = {}) => {
    const rules = Array.isArray(model.rules) ? model.rules : [];
    if (!rules.length) {
      return "规则库为空。可说明要起草的约束类型（授权、时窗、链路、交战门槛等），或直接要求按简报起草一批规则。";
    }
    const preview = rules.slice(0, 4).map((rule, index) => `${index + 1}.${clean(rule.name || rule.subject, 16)}`).join("、");
    return `当前规则库 ${rules.length} 条：${preview}${rules.length > 4 ? "…" : ""}。可用自然语言增删改规则本体（名称/类型/范围/描述）；本步不绑定活动。`;
  }
});

export function loadRuleLibraryChat(projectId) {
  return store.load(projectId);
}

export function persistRuleLibraryChat(session, projectId) {
  return store.persist(session, projectId);
}

export function createRuleLibraryChat(seedText = "") {
  return store.create(seedText);
}

export function ensureRuleLibraryChatWelcome(session, model = {}) {
  return store.ensureWelcome(session, model);
}

export function seedRuleLibraryChatFromModel(model = {}) {
  return store.seed(model);
}

export function beginRuleLibraryChatTurn(session, question, replaceMessageId = "") {
  return store.begin(session, question, replaceMessageId);
}

export function updateRuleLibraryChatPendingText(session, text) {
  return store.updatePending(session, text);
}

export function completeRuleLibraryChatTurn(session, advice, source = "ai") {
  return store.complete(session, advice, source);
}

export function cancelRuleLibraryChatTurn(session, reason = "") {
  return store.cancel(session, { reason });
}

export function summarizeRuleLibraryChat(session, limit = 6) {
  return store.summarize(session, limit);
}

export function normalizeRuleLibraryChat(value) {
  return store.normalize(value);
}

export const ruleLibraryChatStepStore = store;

function clean(value, max = 800) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}
