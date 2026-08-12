import { createResearchChatStepStore } from "./researchChat/researchChatStore.js";

const store = createResearchChatStepStore({
  storagePrefix: "combat-concept-project-sequence-chat-v1",
  topic: "revision",
  maxMessages: 24,
  defaultWelcome: () => "在此用自然语言起草或修订时序图。例如：按阶段补一条指挥→行动单元的态势上报；把第 2 条消息改成响应；删除空泛消息。",
  buildWelcome: (model = {}) => {
    const sequences = Array.isArray(model.sequences) ? model.sequences : [];
    if (!sequences.length) {
      return "尚无时序图。可要求按阶段/兵力生成协同序列，或说明参与方与关键消息链。";
    }
    const first = sequences[0];
    const msgCount = (first.messages || []).length;
    return `当前 ${sequences.length} 幅时序图；活动图「${clean(first.name || first.id, 24)}」含 ${msgCount} 条消息。可用自然语言增删改参与方与消息，并回链阶段活动。`;
  }
});

export function loadSequenceChat(projectId) {
  return store.load(projectId);
}

export function persistSequenceChat(session, projectId) {
  return store.persist(session, projectId);
}

export function createSequenceChat(seedText = "") {
  return store.create(seedText);
}

export function ensureSequenceChatWelcome(session, model = {}) {
  return store.ensureWelcome(session, model);
}

export function seedSequenceChatFromModel(model = {}) {
  return store.seed(model);
}

export function beginSequenceChatTurn(session, question, replaceMessageId = "") {
  return store.begin(session, question, replaceMessageId);
}

export function updateSequenceChatPendingText(session, text) {
  return store.updatePending(session, text);
}

export function completeSequenceChatTurn(session, advice, source = "ai") {
  return store.complete(session, advice, source);
}

export function cancelSequenceChatTurn(session, reason = "") {
  return store.cancel(session, { reason });
}

export function summarizeSequenceChat(session, limit = 6) {
  return store.summarize(session, limit);
}

export function normalizeSequenceChat(value) {
  return store.normalize(value);
}

export const sequenceChatStepStore = store;

function clean(value, max = 800) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}
