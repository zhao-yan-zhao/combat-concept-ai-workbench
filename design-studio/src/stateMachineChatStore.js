import { createResearchChatStepStore } from "./researchChat/researchChatStore.js";

const store = createResearchChatStepStore({
  storagePrefix: "combat-concept-project-state-machine-chat-v1",
  topic: "revision",
  maxMessages: 24,
  defaultWelcome: () => "在此用自然语言生成或修订状态机。例如：按关键任务生成状态机；给当前机补判定分支；把转换条件改成可观察门槛。",
  buildWelcome: (model = {}) => {
    const machines = Array.isArray(model.stateMachines) ? model.stateMachines : [];
    if (!machines.length) {
      return "尚无状态机。可要求按关键任务或持续对象生成分机，或说明进入、执行、终止条件后起草。";
    }
    const first = machines[0];
    return `当前 ${machines.length} 台状态机；「${clean(first.name || first.id, 24)}」含 ${(first.states || []).length} 个状态、${(first.transitions || []).length} 条转换。可用自然语言增删改状态、判定和转换条件。`;
  }
});

export function loadStateMachineChat(projectId) {
  return store.load(projectId);
}

export function persistStateMachineChat(session, projectId) {
  return store.persist(session, projectId);
}

export function createStateMachineChat(seedText = "") {
  return store.create(seedText);
}

export function ensureStateMachineChatWelcome(session, model = {}) {
  return store.ensureWelcome(session, model);
}

export function seedStateMachineChatFromModel(model = {}) {
  return store.seed(model);
}

export function summarizeStateMachineChat(session, limit = 6) {
  return store.summarize(session, limit);
}

export function normalizeStateMachineChat(value) {
  return store.normalize(value);
}

export const stateMachineChatStepStore = store;

function clean(value, max = 800) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}
