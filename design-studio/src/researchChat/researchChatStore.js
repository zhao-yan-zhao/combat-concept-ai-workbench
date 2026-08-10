/**
 * Generic research-chat message session.
 * Step-specific stores wrap this with their own storage keys and welcome text.
 */

const MAX_MESSAGES_DEFAULT = 48;

export function createResearchChatSession({ welcome = "", topic = "welcome", source = "local" } = {}) {
  const text = clean(welcome) || "请输入研究问题或修订要求。";
  return normalizeResearchChatSession({
    messages: [createMessage("assistant", text, topic, source)]
  });
}

export function normalizeResearchChatSession(value, { maxMessages = MAX_MESSAGES_DEFAULT, fallbackWelcome = "" } = {}) {
  const messages = Array.isArray(value?.messages)
    ? value.messages.map(normalizeMessage).filter(Boolean).slice(-maxMessages)
    : [];
  if (messages.length) return { messages };
  return createResearchChatSession({ welcome: fallbackWelcome });
}

export function stripPendingResearchChatTurns(session) {
  const messages = (session?.messages || []).filter((message) => !message?.pending);
  return normalizeResearchChatSession({ ...session, messages });
}

/** Optimistically append (or re-edit) a user turn with a pending assistant bubble. */
export function beginResearchChatTurn(session, question, { replaceMessageId = "", topic = "consultation" } = {}) {
  const normalized = stripPendingResearchChatTurns(normalizeResearchChatSession(session));
  const userText = clean(question);
  if (!userText) return normalized;

  let messages;
  if (replaceMessageId) {
    const targetIndex = normalized.messages.findIndex(
      (message) => message.id === replaceMessageId && message.role === "user" && message.topic === topic
    );
    if (targetIndex >= 0) {
      const target = normalized.messages[targetIndex];
      messages = [
        ...normalized.messages.slice(0, targetIndex),
        { ...target, text: userText, createdAt: new Date().toISOString() },
        createPendingAssistant(topic)
      ];
    } else {
      messages = [...normalized.messages, createMessage("user", userText, topic), createPendingAssistant(topic)];
    }
  } else {
    messages = [...normalized.messages, createMessage("user", userText, topic), createPendingAssistant(topic)];
  }
  return normalizeResearchChatSession({ messages });
}

/** Progressive stream text into the pending assistant bubble (keeps pending=true). */
export function updatePendingResearchChatText(session, text) {
  const normalized = normalizeResearchChatSession(session);
  const pendingIndex = findLastIndex(normalized.messages, (message) => message.role === "assistant" && message.pending);
  if (pendingIndex < 0) return normalized;
  const nextText = String(text || "").replace(/\s+/g, " ").trim().slice(0, 800);
  const messages = [...normalized.messages];
  messages[pendingIndex] = {
    ...messages[pendingIndex],
    text: nextText,
    streaming: Boolean(nextText)
  };
  return normalizeResearchChatSession({ messages });
}

/** Fill the pending assistant bubble once the model returns (or local fallback). */
export function completeResearchChatTurn(session, advice, source = "ai", { topic = "consultation" } = {}) {
  const normalized = normalizeResearchChatSession(session);
  const assistantText = clean(advice);
  if (!assistantText) return stripPendingResearchChatTurns(normalized);

  const pendingIndex = findLastIndex(normalized.messages, (message) => message.role === "assistant" && message.pending);
  if (pendingIndex >= 0) {
    const messages = [...normalized.messages];
    messages[pendingIndex] = {
      ...messages[pendingIndex],
      text: assistantText.slice(0, 800),
      source: ["ai", "local"].includes(source) ? source : "local",
      pending: false,
      topic: messages[pendingIndex].topic || topic
    };
    return normalizeResearchChatSession({ messages });
  }

  const last = normalized.messages.at(-1);
  if (last?.role === "user" && last.topic === topic) {
    return normalizeResearchChatSession({
      messages: [...normalized.messages, createMessage("assistant", assistantText, topic, source)]
    });
  }
  return normalized;
}

export function addResearchChatTurn(session, question, advice, source = "ai", { topic = "consultation" } = {}) {
  const withUser = beginResearchChatTurn(session, question, { topic });
  return completeResearchChatTurn(withUser, advice, source, { topic });
}

export function replaceResearchChatTurn(session, userMessageId, question, advice, source = "ai", { topic = "consultation" } = {}) {
  return completeResearchChatTurn(
    beginResearchChatTurn(session, question, { replaceMessageId: userMessageId, topic }),
    advice,
    source,
    { topic }
  );
}

export function summarizeResearchChat(session, { topics = null, limit = 6, labels = null } = {}) {
  const allowed = topics ? new Set(topics) : null;
  const messages = normalizeResearchChatSession(session).messages
    .filter((message) => !message.pending)
    .filter((message) => !allowed || allowed.has(message.topic))
    .slice(-limit);
  if (!messages.length) return "";
  return messages
    .map((message) => {
      const who = message.role === "user" ? "研究人员" : "助手";
      const label = labels?.get?.(message.topic);
      return label ? `${who}（${label}）：${message.text}` : `${who}：${message.text}`;
    })
    .join("\n");
}

export function loadResearchChat(storageKey, { fallbackWelcome = "" } = {}) {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) || "null");
    return stripPendingResearchChatTurns(normalizeResearchChatSession(raw, { fallbackWelcome }));
  } catch {
    return createResearchChatSession({ welcome: fallbackWelcome });
  }
}

export function persistResearchChat(session, storageKey, { fallbackWelcome = "" } = {}) {
  const normalized = normalizeResearchChatSession(session, { fallbackWelcome });
  try {
    localStorage.setItem(storageKey, JSON.stringify(normalized));
  } catch {
    /* best-effort */
  }
  return normalized;
}

export function createMessage(role, text, topic = "", source = "") {
  return {
    id: createId(),
    role,
    topic,
    source,
    text: clean(text).slice(0, 800),
    pending: false,
    createdAt: new Date().toISOString()
  };
}

function createPendingAssistant(topic = "consultation") {
  return {
    id: createId(),
    role: "assistant",
    topic,
    source: "",
    text: "",
    pending: true,
    createdAt: new Date().toISOString()
  };
}

function normalizeMessage(value) {
  const role = value?.role === "user" ? "user" : value?.role === "assistant" ? "assistant" : "";
  const pending = Boolean(value?.pending) && role === "assistant";
  const text = clean(value?.text);
  if (!role || (!text && !pending)) return null;
  return {
    id: clean(value.id) || createId(),
    role,
    topic: clean(value.topic),
    source: ["ai", "local"].includes(clean(value.source)) ? clean(value.source) : "",
    // Keep partial stream text on pending bubbles (do not wipe while streaming).
    text: text.slice(0, 800),
    pending,
    streaming: Boolean(pending && text && value?.streaming !== false),
    createdAt: clean(value.createdAt) || new Date().toISOString()
  };
}

function findLastIndex(list, predicate) {
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (predicate(list[index], index)) return index;
  }
  return -1;
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `research-chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
