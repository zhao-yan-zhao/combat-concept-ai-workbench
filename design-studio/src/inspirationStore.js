import {
  beginResearchChatTurn,
  completeResearchChatTurn,
  createMessage,
  normalizeResearchChatSession,
  stripPendingResearchChatTurns,
  updatePendingResearchChatText
} from "./researchChat/researchChatStore.js";

const STORAGE_KEY = "concept-studio-inspiration-v1";
const MAX_MESSAGES = 48;
let projectScope = "default";

const FOLLOW_UPS = [
  { key: "environment", label: "作战环境", prompt: "请补充作战环境：任务区域、时间窗口、地形或电磁条件中哪些因素会影响设计？" },
  { key: "opponent", label: "对手能力", prompt: "请描述需要重点考虑的对手能力、预警方式或可能的反制手段。" },
  { key: "resources", label: "可用资源", prompt: "请列出己方可用的关键力量、平台、信息链路或保障资源。" },
  { key: "constraints", label: "约束条件", prompt: "请明确必须遵守的约束，例如授权边界、风险阈值、持续时间或资源上限。" },
  { key: "success", label: "成功标准", prompt: "最后，请说明什么结果可以判定这项概念研究取得成功，以及需要避免哪些后果。" }
];
const TOTAL_TURNS = FOLLOW_UPS.length + 1;
const ADVICE_TOPIC = "consultation";

export function loadInspirationSession() {
  try {
    // Drop in-flight typing placeholders after reload; keep the user turn.
    return stripPendingInspirationTurns(normalizeInspirationSession(JSON.parse(localStorage.getItem(storageKey()))));
  } catch {
    return createInspirationSession();
  }
}

export function saveInspirationSession(session) {
  const normalized = normalizeInspirationSession(session);
  localStorage.setItem(storageKey(), JSON.stringify(normalized));
  return normalized;
}

export function setInspirationProjectScope(projectId) {
  projectScope = normalizeProjectScope(projectId);
}

export function createInspirationSession() {
  return {
    stage: 0,
    messages: [createMessage(
      "assistant",
      "请先记录当前的研究灵感。可以是一句任务设想、一个担忧，或尚未成形的作战问题。",
      "idea",
      "local"
    )]
  };
}

export function addInspirationReply(session, text) {
  const normalized = normalizeInspirationSession(session);
  const reply = clean(text);
  if (!reply) return normalized;

  const stage = normalized.stage;
  const topic = stage === 0 ? "idea" : FOLLOW_UPS[stage - 1]?.key || "supplement";
  const messages = [...normalized.messages, createMessage("user", reply, topic)];
  const nextFollowUp = FOLLOW_UPS[stage];
  if (nextFollowUp) {
    messages.push(createMessage("assistant", nextFollowUp.prompt, nextFollowUp.key, "local"));
    return normalizeInspirationSession({ messages, stage: stage + 1 });
  }

  messages.push(createMessage("assistant", "关键信息已记录。请查看下方会话摘要，将其带入概念简报并继续建模。", "complete", "local"));
  return normalizeInspirationSession({ messages, stage: stage + 1 });
}

export function replacePendingInspirationPrompt(session, text, source = "ai") {
  const normalized = normalizeInspirationSession(session);
  const progress = getInspirationProgress(normalized);
  const prompt = clean(text);
  if (!prompt || progress.stage === 0 || progress.completed) return normalized;

  const messages = [...normalized.messages];
  let lastUserIndex = -1;
  let pendingIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      lastUserIndex = index;
      break;
    }
  }
  for (let index = messages.length - 1; index > lastUserIndex; index -= 1) {
    if (messages[index].role === "assistant") {
      pendingIndex = index;
      break;
    }
  }

  const topic = FOLLOW_UPS[progress.stage - 1]?.key || "supplement";
  const replacement = createMessage("assistant", prompt, topic, source);
  if (pendingIndex >= 0) {
    replacement.id = messages[pendingIndex].id;
    replacement.createdAt = messages[pendingIndex].createdAt;
    messages[pendingIndex] = replacement;
  } else {
    messages.push(replacement);
  }
  return normalizeInspirationSession({ messages, stage: progress.stage });
}

export function getInspirationProgress(session) {
  const normalized = normalizeInspirationSession(session);
  const completed = normalized.stage >= TOTAL_TURNS;
  return {
    stage: normalized.stage,
    total: TOTAL_TURNS,
    completed,
    label: completed ? "追问完成" : `追问 ${normalized.stage + 1}/${TOTAL_TURNS}`,
    nextLabel: completed ? "已完成" : normalized.stage === 0 ? "初始灵感" : FOLLOW_UPS[normalized.stage - 1].label
  };
}

export function summarizeInspirationSession(session) {
  const normalized = normalizeInspirationSession(session);
  const answers = normalized.messages.filter((message) => message.role === "user" && !message.pending);
  if (!answers.length) return "";
  const labels = new Map([["idea", "初始灵感"], ["supplement", "补充说明"], ...FOLLOW_UPS.map((item) => [item.key, item.label])]);
  return answers.map((answer, index) => `${labels.get(answer.topic) || (index ? "补充说明" : "初始灵感")}：${answer.text}`).join("；");
}

export function getInspirationAnswers(session) {
  const topics = ["idea", ...FOLLOW_UPS.map((item) => item.key)];
  const answers = Object.fromEntries(topics.map((topic) => [topic, ""]));
  normalizeInspirationSession(session).messages.forEach((message) => {
    if (message.role === "user" && Object.hasOwn(answers, message.topic)) answers[message.topic] = message.text;
  });
  return answers;
}

export function updateInspirationAnswers(session, values = {}) {
  const normalized = normalizeInspirationSession(session);
  const permitted = new Set(["idea", ...FOLLOW_UPS.map((item) => item.key)]);
  const messages = normalized.messages.map((message) => {
    if (message.role !== "user" || !permitted.has(message.topic) || !Object.hasOwn(values, message.topic)) return message;
    const text = clean(values[message.topic]);
    return text ? { ...message, text: text.slice(0, 800) } : message;
  });
  return normalizeInspirationSession({ ...normalized, messages });
}

export function addInspirationAdviceTurn(session, question, advice, source = "ai") {
  const started = beginInspirationAdviceTurn(session, question);
  return completeInspirationAdviceTurn(started, advice, source);
}

/** Optimistically append (or re-edit) a consultation turn with a pending assistant reply. */
export function beginInspirationAdviceTurn(session, question, replaceMessageId = "") {
  const normalized = normalizeInspirationSession(session);
  const next = beginResearchChatTurn(
    { messages: normalized.messages },
    question,
    { replaceMessageId, topic: ADVICE_TOPIC }
  );
  return normalizeInspirationSession({ ...normalized, messages: next.messages });
}

/** Progressive stream text into the pending assistant bubble. */
export function updateInspirationPendingText(session, text) {
  const normalized = normalizeInspirationSession(session);
  const next = updatePendingResearchChatText({ messages: normalized.messages }, text);
  return normalizeInspirationSession({ ...normalized, messages: next.messages });
}

/** Fill the pending assistant bubble once the model returns (or local fallback). */
export function completeInspirationAdviceTurn(session, advice, source = "ai") {
  const normalized = normalizeInspirationSession(session);
  const next = completeResearchChatTurn(
    { messages: normalized.messages },
    advice,
    source,
    { topic: ADVICE_TOPIC }
  );
  return normalizeInspirationSession({ ...normalized, messages: next.messages });
}

export function replaceInspirationAdviceTurn(session, userMessageId, question, advice, source = "ai") {
  return completeInspirationAdviceTurn(
    beginInspirationAdviceTurn(session, question, userMessageId),
    advice,
    source
  );
}

export function getInspirationTopics() {
  return [{ key: "idea", label: "初始灵感" }, ...FOLLOW_UPS.map(({ key, label }) => ({ key, label }))];
}

export function toInspirationReportSnapshot(session) {
  const normalized = normalizeInspirationSession(session);
  const progress = getInspirationProgress(normalized);
  return {
    stage: progress.stage,
    totalStages: progress.total,
    completed: progress.completed,
    summary: summarizeInspirationSession(normalized),
    messages: normalized.messages.map((message) => ({
      role: message.role,
      topic: message.topic,
      source: message.source,
      text: message.text,
      createdAt: message.createdAt
    }))
  };
}

export function normalizeInspirationSession(value) {
  if (!Array.isArray(value?.messages) || !value.messages.length) {
    const empty = createInspirationSession();
    const requestedStage = Math.max(0, Math.min(TOTAL_TURNS, Number(value?.stage) || 0));
    return { ...empty, stage: requestedStage };
  }
  const chat = normalizeResearchChatSession(
    { messages: value.messages },
    { maxMessages: MAX_MESSAGES }
  );
  const messages = chat.messages.map((message, index) => {
    if (index === 0 && message.role === "assistant" && (!message.topic || message.topic === "welcome")) {
      return { ...message, topic: "idea", source: message.source || "local" };
    }
    return message;
  });
  const requestedStage = Math.max(0, Math.min(TOTAL_TURNS, Number(value?.stage) || 0));
  const successRecorded = messages.some((message) => message.role === "user" && message.topic === "success");
  const stage = successRecorded ? TOTAL_TURNS : requestedStage;
  return {
    stage,
    messages: messages.length ? messages : createInspirationSession().messages
  };
}

function stripPendingInspirationTurns(session) {
  const stripped = stripPendingResearchChatTurns({ messages: session?.messages || [] });
  return { ...session, messages: stripped.messages };
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function storageKey() { return projectScope === "default" ? STORAGE_KEY : `${STORAGE_KEY}:${projectScope}`; }
function normalizeProjectScope(value) { return String(value || "default").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "default"; }
