/**
 * Generic research-chat message session.
 * Step-specific stores wrap this with storage keys and welcome text
 * (prefer createResearchChatStepStore).
 */

export const RESEARCH_CHAT_SESSION_VERSION = 1;
export const MAX_MESSAGES_DEFAULT = 48;
export const MAX_MESSAGE_CHARS_DEFAULT = 800;

const SOURCE_VALUES = new Set(["ai", "local", "error", "cancelled"]);

export function createResearchChatSession({
  welcome = "",
  topic = "welcome",
  source = "local",
  maxMessageChars = MAX_MESSAGE_CHARS_DEFAULT
} = {}) {
  const text = clean(welcome) || "请输入研究问题或修订要求。";
  return normalizeResearchChatSession({
    version: RESEARCH_CHAT_SESSION_VERSION,
    messages: [createMessage("assistant", text, topic, source, { maxMessageChars })]
  }, { maxMessageChars });
}

export function normalizeResearchChatSession(value, {
  maxMessages = MAX_MESSAGES_DEFAULT,
  maxMessageChars = MAX_MESSAGE_CHARS_DEFAULT,
  fallbackWelcome = ""
} = {}) {
  const messages = Array.isArray(value?.messages)
    ? value.messages
      .map((item) => normalizeMessage(item, { maxMessageChars }))
      .filter(Boolean)
      .slice(-maxMessages)
    : [];
  if (messages.length) {
    return {
      version: RESEARCH_CHAT_SESSION_VERSION,
      messages
    };
  }
  return createResearchChatSession({ welcome: fallbackWelcome, maxMessageChars });
}

export function stripPendingResearchChatTurns(session, options = {}) {
  const messages = (session?.messages || []).filter((message) => !message?.pending);
  return normalizeResearchChatSession({ ...session, messages }, options);
}

/** Recover a browser-interrupted stream as a durable, retryable assistant turn. */
export function recoverInterruptedResearchChatTurn(session, {
  reason = "页面刷新导致生成中断，请重新生成",
  topic = "consultation",
  maxMessages = MAX_MESSAGES_DEFAULT,
  maxMessageChars = MAX_MESSAGE_CHARS_DEFAULT,
  fallbackWelcome = ""
} = {}) {
  const normalized = normalizeResearchChatSession(session, {
    maxMessages,
    maxMessageChars,
    fallbackWelcome
  });
  if (normalized.messages.some((message) => message?.pending && message?.jobId)) return normalized;
  if (!normalized.messages.some((message) => message?.pending)) return normalized;
  return cancelResearchChatTurn(normalized, { topic, reason, maxMessageChars });
}

export function attachResearchChatJob(session, jobId, options = {}) {
  const normalized = normalizeResearchChatSession(session, options);
  const pendingIndex = findLastIndex(normalized.messages, (message) => message.role === "assistant" && message.pending);
  const id = clean(jobId).replace(/[^a-f0-9-]/gi, "");
  if (pendingIndex < 0 || !id) return normalized;
  const messages = [...normalized.messages];
  messages[pendingIndex] = { ...messages[pendingIndex], jobId: id };
  return { ...normalized, messages };
}

/** Optimistically append (or re-edit) a user turn with a pending assistant bubble. */
export function beginResearchChatTurn(session, question, {
  replaceMessageId = "",
  topic = "consultation",
  maxMessageChars = MAX_MESSAGE_CHARS_DEFAULT
} = {}) {
  const normalized = stripPendingResearchChatTurns(
    normalizeResearchChatSession(session, { maxMessageChars }),
    { maxMessageChars }
  );
  const userText = clean(question);
  if (!userText) return normalized;

  let messages;
  if (replaceMessageId) {
    const targetIndex = normalized.messages.findIndex(
      (message) => message.id === replaceMessageId && message.role === "user" && message.topic === topic
    );
    if (targetIndex >= 0) {
      const target = normalized.messages[targetIndex];
      const nextUser = applyTextLimit(
        { ...target, text: userText, createdAt: new Date().toISOString() },
        maxMessageChars
      );
      messages = [
        ...normalized.messages.slice(0, targetIndex),
        nextUser,
        createPendingAssistant(topic)
      ];
    } else {
      messages = [
        ...normalized.messages,
        createMessage("user", userText, topic, "", { maxMessageChars }),
        createPendingAssistant(topic)
      ];
    }
  } else {
    messages = [
      ...normalized.messages,
      createMessage("user", userText, topic, "", { maxMessageChars }),
      createPendingAssistant(topic)
    ];
  }
  return normalizeResearchChatSession({ messages }, { maxMessageChars });
}

/** Progressive stream text into the pending assistant bubble (keeps pending=true). */
export function updatePendingResearchChatText(session, text, {
  maxMessageChars = MAX_MESSAGE_CHARS_DEFAULT
} = {}) {
  const normalized = normalizeResearchChatSession(session, { maxMessageChars });
  const pendingIndex = findLastIndex(
    normalized.messages,
    (message) => message.role === "assistant" && message.pending
  );
  if (pendingIndex < 0) return normalized;

  // Light path while streaming: avoid re-running full normalize on every delta.
  const nextText = clean(text).slice(0, maxMessageChars);
  const messages = [...normalized.messages];
  messages[pendingIndex] = {
    ...messages[pendingIndex],
    text: nextText,
    streaming: Boolean(nextText),
    truncated: clean(text).length > maxMessageChars
  };
  return {
    version: RESEARCH_CHAT_SESSION_VERSION,
    messages
  };
}

/** Fill the pending assistant bubble once the model returns (or local/error/cancel). */
export function completeResearchChatTurn(session, advice, source = "ai", {
  topic = "consultation",
  maxMessageChars = MAX_MESSAGE_CHARS_DEFAULT
} = {}) {
  const normalized = normalizeResearchChatSession(session, { maxMessageChars });
  const assistantText = clean(advice);
  if (!assistantText) return stripPendingResearchChatTurns(normalized, { maxMessageChars });

  const resolvedSource = normalizeSource(source);
  const pendingIndex = findLastIndex(
    normalized.messages,
    (message) => message.role === "assistant" && message.pending
  );
  if (pendingIndex >= 0) {
    const messages = [...normalized.messages];
    messages[pendingIndex] = applyTextLimit({
      ...messages[pendingIndex],
      text: assistantText,
      source: resolvedSource,
      pending: false,
      streaming: false,
      topic: messages[pendingIndex].topic || topic
    }, maxMessageChars);
    return normalizeResearchChatSession({ messages }, { maxMessageChars });
  }

  const last = normalized.messages.at(-1);
  if (last?.role === "user" && last.topic === topic) {
    return normalizeResearchChatSession({
      messages: [
        ...normalized.messages,
        createMessage("assistant", assistantText, topic, resolvedSource, { maxMessageChars })
      ]
    }, { maxMessageChars });
  }
  return normalized;
}

/** Mark the pending bubble as cancelled (stop generation). Keeps partial stream when present. */
export function cancelResearchChatTurn(session, {
  topic = "consultation",
  reason = "",
  maxMessageChars = MAX_MESSAGE_CHARS_DEFAULT
} = {}) {
  const normalized = normalizeResearchChatSession(session, { maxMessageChars });
  const pendingIndex = findLastIndex(
    normalized.messages,
    (message) => message.role === "assistant" && message.pending
  );
  if (pendingIndex < 0) {
    return stripPendingResearchChatTurns(normalized, { maxMessageChars });
  }

  const partial = clean(normalized.messages[pendingIndex].text);
  const note = clean(reason) || "已停止生成";
  const text = partial ? `${partial}\n\n（${note}）` : note;
  return completeResearchChatTurn(normalized, text, "cancelled", { topic, maxMessageChars });
}

export function addResearchChatTurn(session, question, advice, source = "ai", {
  topic = "consultation",
  maxMessageChars = MAX_MESSAGE_CHARS_DEFAULT
} = {}) {
  const withUser = beginResearchChatTurn(session, question, { topic, maxMessageChars });
  return completeResearchChatTurn(withUser, advice, source, { topic, maxMessageChars });
}

export function replaceResearchChatTurn(session, userMessageId, question, advice, source = "ai", {
  topic = "consultation",
  maxMessageChars = MAX_MESSAGE_CHARS_DEFAULT
} = {}) {
  return completeResearchChatTurn(
    beginResearchChatTurn(session, question, { replaceMessageId: userMessageId, topic, maxMessageChars }),
    advice,
    source,
    { topic, maxMessageChars }
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
      // Summary is single-line context for model prompts.
      const text = String(message.text || "").replace(/\s+/g, " ").trim();
      return label ? `${who}（${label}）：${text}` : `${who}：${text}`;
    })
    .join("\n");
}

export function loadResearchChat(storageKey, {
  fallbackWelcome = "",
  maxMessages = MAX_MESSAGES_DEFAULT,
  maxMessageChars = MAX_MESSAGE_CHARS_DEFAULT
} = {}) {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) || "null");
    return recoverInterruptedResearchChatTurn(
      normalizeResearchChatSession(raw, { maxMessages, maxMessageChars, fallbackWelcome }),
      { maxMessages, maxMessageChars, fallbackWelcome }
    );
  } catch {
    return createResearchChatSession({ welcome: fallbackWelcome, maxMessageChars });
  }
}

export function persistResearchChat(session, storageKey, {
  fallbackWelcome = "",
  maxMessages = MAX_MESSAGES_DEFAULT,
  maxMessageChars = MAX_MESSAGE_CHARS_DEFAULT
} = {}) {
  const normalized = normalizeResearchChatSession(session, {
    maxMessages,
    maxMessageChars,
    fallbackWelcome
  });
  try {
    localStorage.setItem(storageKey, JSON.stringify(normalized));
  } catch {
    /* best-effort */
  }
  return normalized;
}

export function createMessage(role, text, topic = "", source = "", {
  maxMessageChars = MAX_MESSAGE_CHARS_DEFAULT
} = {}) {
  return applyTextLimit({
    id: createId(),
    role,
    topic,
    source: normalizeSource(source) || "",
    text: clean(text),
    pending: false,
    streaming: false,
    truncated: false,
    createdAt: new Date().toISOString()
  }, maxMessageChars);
}

/**
 * Factory for step-scoped chat stores (load/persist/begin/complete/…).
 * Controllers should pair this with createResearchChatSessionApplier.
 */
export function createResearchChatStepStore({
  storagePrefix,
  topic = "revision",
  maxMessages = 24,
  maxMessageChars = MAX_MESSAGE_CHARS_DEFAULT,
  defaultWelcome = "请输入研究问题或修订要求。",
  buildWelcome = null
} = {}) {
  if (!storagePrefix) throw new Error("createResearchChatStepStore requires storagePrefix");

  const resolveWelcome = () => (
    typeof defaultWelcome === "function" ? String(defaultWelcome() || "") : String(defaultWelcome || "")
  );

  function storageKey(projectId) {
    return `${storagePrefix}:${projectId || "default"}`;
  }

  function normalize(value) {
    return normalizeResearchChatSession(value, {
      maxMessages,
      maxMessageChars,
      fallbackWelcome: resolveWelcome()
    });
  }

  function create(seedText = "") {
    const text = clean(seedText) || resolveWelcome();
    return createResearchChatSession({
      welcome: text,
      topic: "welcome",
      source: "local",
      maxMessageChars
    });
  }

  function seed(model) {
    const text = typeof buildWelcome === "function" ? clean(buildWelcome(model)) : "";
    return create(text || resolveWelcome());
  }

  return {
    topic,
    maxMessages,
    maxMessageChars,
    storageKey,
    resolveWelcome,
    normalize,
    load(projectId) {
      return loadResearchChat(storageKey(projectId), {
        fallbackWelcome: resolveWelcome(),
        maxMessages,
        maxMessageChars
      });
    },
    persist(session, projectId) {
      return persistResearchChat(normalize(session), storageKey(projectId), {
        fallbackWelcome: resolveWelcome(),
        maxMessages,
        maxMessageChars
      });
    },
    create,
    seed,
    ensureWelcome(session, model) {
      const normalized = normalize(session);
      if (normalized.messages.length) return normalized;
      return seed(model);
    },
    begin(session, question, replaceMessageId = "") {
      return beginResearchChatTurn(normalize(session), question, {
        replaceMessageId,
        topic,
        maxMessageChars
      });
    },
    updatePending(session, text) {
      return updatePendingResearchChatText(normalize(session), text, { maxMessageChars });
    },
    complete(session, advice, source = "ai") {
      return completeResearchChatTurn(normalize(session), advice, source, {
        topic,
        maxMessageChars
      });
    },
    cancel(session, { reason = "" } = {}) {
      return cancelResearchChatTurn(normalize(session), {
        topic,
        reason,
        maxMessageChars
      });
    },
    summarize(session, limit = 6) {
      return summarizeResearchChat(session, { topics: [topic], limit });
    }
  };
}

/**
 * Standard setSession reducer for createResearchChatController.
 * @param {{ key: string, projectId?: string|(() => string), store: ReturnType<typeof createResearchChatStepStore> }} args
 */
export function createResearchChatSessionApplier({ key, projectId = "default", store }) {
  if (!key || !store) throw new Error("createResearchChatSessionApplier requires key and store");

  const resolveProjectId = () => (
    typeof projectId === "function" ? projectId() : projectId
  );

  return function applySessionAction(state, action) {
    const session = state[key];
    const pid = resolveProjectId();
    if (action?.type === "begin") {
      state[key] = store.persist(
        store.begin(session, action.question, action.replaceMessageId || ""),
        pid
      );
      return;
    }
    if (action?.type === "delta") {
      state[key] = store.updatePending(session, action.text || "");
      return;
    }
    if (action?.type === "job") {
      state[key] = store.persist(attachResearchChatJob(session, action.jobId, {
        maxMessages: store.maxMessages,
        maxMessageChars: store.maxMessageChars
      }), pid);
      return;
    }
    if (action?.type === "complete") {
      state[key] = store.persist(
        store.complete(session, action.advice, action.source || "ai"),
        pid
      );
      return;
    }
    if (action?.type === "cancel") {
      state[key] = store.persist(
        store.cancel(session, { reason: action.reason || "" }),
        pid
      );
    }
  };
}

export function createGenericResearchFallback(question) {
  const subject = String(question || "").replace(/\s+/g, " ").trim().slice(0, 90) || "该研究问题";
  return `围绕“${subject}”，建议先明确研究对象和判断边界，并保留为待专家复核的研究判断。`;
}

function createPendingAssistant(topic = "consultation") {
  return {
    id: createId(),
    role: "assistant",
    topic,
    source: "",
    text: "",
    pending: true,
    streaming: false,
    truncated: false,
    createdAt: new Date().toISOString()
  };
}

function normalizeMessage(value, { maxMessageChars = MAX_MESSAGE_CHARS_DEFAULT } = {}) {
  const role = value?.role === "user" ? "user" : value?.role === "assistant" ? "assistant" : "";
  const pending = Boolean(value?.pending) && role === "assistant";
  const text = clean(value?.text);
  if (!role || (!text && !pending)) return null;
  const source = normalizeSource(value?.source);
  return applyTextLimit({
    id: clean(value.id).replace(/\s+/g, "") || createId(),
    role,
    topic: clean(value.topic).replace(/\n/g, " "),
    source: source || "",
    // Keep partial stream text on pending bubbles (do not wipe while streaming).
    text,
    pending,
    streaming: Boolean(pending && text && value?.streaming !== false),
    jobId: pending ? clean(value?.jobId).replace(/[^a-f0-9-]/gi, "") : "",
    truncated: Boolean(value?.truncated) || text.length > maxMessageChars,
    createdAt: clean(value.createdAt).replace(/\n/g, " ") || new Date().toISOString()
  }, maxMessageChars);
}

function applyTextLimit(message, maxMessageChars = MAX_MESSAGE_CHARS_DEFAULT) {
  const full = clean(message.text);
  const truncated = full.length > maxMessageChars || Boolean(message.truncated);
  return {
    ...message,
    text: full.slice(0, maxMessageChars),
    truncated,
    source: message.source ? normalizeSource(message.source) || message.source : message.source
  };
}

function normalizeSource(source) {
  const value = String(source || "").trim();
  if (!value) return "";
  return SOURCE_VALUES.has(value) ? value : "local";
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

/** Preserve paragraphs; collapse only horizontal runs and excessive blank lines. */
function clean(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
