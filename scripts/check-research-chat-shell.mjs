/**
 * Acceptance: researchChat shell state machine, step factory, view markers.
 * Run: node scripts/check-research-chat-shell.mjs
 */
import {
  addResearchChatTurn,
  beginResearchChatTurn,
  cancelResearchChatTurn,
  completeResearchChatTurn,
  createResearchChatSession,
  createResearchChatSessionApplier,
  createResearchChatStepStore,
  normalizeResearchChatSession,
  replaceResearchChatTurn,
  stripPendingResearchChatTurns,
  summarizeResearchChat,
  updatePendingResearchChatText,
  RESEARCH_CHAT_SESSION_VERSION
} from "../design-studio/src/researchChat/researchChatStore.js";
import {
  renderResearchChatMessage,
  renderResearchChatPanel
} from "../design-studio/src/researchChat/researchChatView.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// --- session normalize / version ---
const empty = createResearchChatSession({ welcome: "欢迎" });
assert(empty.version === RESEARCH_CHAT_SESSION_VERSION, "session missing version");
assert(empty.messages[0]?.text === "欢迎", "welcome not applied");

const legacy = normalizeResearchChatSession({
  messages: [{ id: "u1", role: "user", topic: "revision", text: "hello", pending: false }]
});
assert(legacy.version === RESEARCH_CHAT_SESSION_VERSION, "legacy normalize should stamp version");
assert(legacy.messages.length === 1, "legacy message lost");

// --- begin / delta / complete state machine ---
let session = createResearchChatSession({ welcome: "ready" });
session = beginResearchChatTurn(session, "第一问", { topic: "revision" });
assert(session.messages.at(-2)?.role === "user" && session.messages.at(-1)?.pending, "begin should append user + pending");
session = updatePendingResearchChatText(session, "部分流式\n第二行");
assert(session.messages.at(-1)?.pending && session.messages.at(-1)?.text.includes("第二行"), "delta should keep newlines and pending");
session = completeResearchChatTurn(session, "完整答复\n• 点一\n• 点二", "ai", { topic: "revision" });
assert(!session.messages.at(-1)?.pending, "complete should clear pending");
assert(session.messages.at(-1)?.source === "ai", "complete source ai");
assert(session.messages.at(-1)?.text.includes("\n"), "complete should preserve newlines");

// --- replace / strip pending ---
const withPending = beginResearchChatTurn(session, "将被替换", { topic: "revision" });
const stripped = stripPendingResearchChatTurns(withPending);
assert(!stripped.messages.some((m) => m.pending), "stripPending should drop pending bubbles");
const userId = session.messages.find((m) => m.role === "user")?.id;
const replaced = replaceResearchChatTurn(session, userId, "改写后的问题", "改写后的答复", "ai", { topic: "revision" });
assert(replaced.messages.some((m) => m.role === "user" && m.text === "改写后的问题"), "replace should update user text");

// --- cancel / error sources ---
let cancelling = beginResearchChatTurn(session, "中止测试", { topic: "revision" });
cancelling = updatePendingResearchChatText(cancelling, "已生成一半");
cancelling = cancelResearchChatTurn(cancelling, { topic: "revision", reason: "已停止生成" });
assert(cancelling.messages.at(-1)?.source === "cancelled", "cancel source");
assert(!cancelling.messages.at(-1)?.pending, "cancel must not leave pending");
assert(cancelling.messages.at(-1)?.text.includes("已停止"), "cancel reason text");

const errored = completeResearchChatTurn(
  beginResearchChatTurn(session, "失败测试", { topic: "revision" }),
  "本地失败建议",
  "error",
  { topic: "revision" }
);
assert(errored.messages.at(-1)?.source === "error", "error source");

// --- truncation flag ---
const long = "字".repeat(900);
const truncatedSession = addResearchChatTurn(
  createResearchChatSession({ welcome: "t" }),
  long,
  long,
  "ai",
  { topic: "revision", maxMessageChars: 800 }
);
assert(truncatedSession.messages.some((m) => m.truncated), "long messages should mark truncated");
assert(truncatedSession.messages.every((m) => m.text.length <= 800), "text must respect maxMessageChars");

// --- summarize collapses whitespace for prompts ---
const summary = summarizeResearchChat(session, { topics: ["revision"], limit: 4 });
assert(summary.includes("研究人员") && !summary.includes("\n\n\n"), "summarize should emit compact lines");

// --- step store factory + applier ---
const stepStore = createResearchChatStepStore({
  storagePrefix: "test-research-chat-shell",
  topic: "revision",
  maxMessages: 12,
  defaultWelcome: () => "工厂欢迎语",
  buildWelcome: (model) => `模型欢迎：${model?.name || "无"}`
});
const seeded = stepStore.seed({ name: "甲" });
assert(seeded.messages[0]?.text.includes("甲"), "buildWelcome not applied");
const begun = stepStore.begin(seeded, "问一句");
assert(begun.messages.at(-1)?.pending, "step begin pending");

const state = { demoChat: stepStore.create() };
const apply = createResearchChatSessionApplier({
  key: "demoChat",
  projectId: "test-project",
  store: {
    ...stepStore,
    // Avoid real localStorage dependency in CI if unavailable; wrap persist.
    persist(session) {
      return stepStore.normalize(session);
    }
  }
});
apply(state, { type: "begin", question: "工厂提问" });
assert(state.demoChat.messages.at(-1)?.pending, "applier begin");
apply(state, { type: "delta", text: "流" });
assert(state.demoChat.messages.at(-1)?.text === "流", "applier delta");
apply(state, { type: "complete", advice: "答", source: "ai" });
assert(state.demoChat.messages.at(-1)?.source === "ai" && !state.demoChat.messages.at(-1)?.pending, "applier complete");
apply(state, { type: "begin", question: "再问" });
apply(state, { type: "cancel", reason: "手动停止" });
assert(state.demoChat.messages.at(-1)?.source === "cancelled", "applier cancel");

// --- view markers ---
const panel = renderResearchChatPanel({
  scope: "shell-test",
  session: errored,
  generating: false,
  disabled: true,
  disabledReason: "本步已确认",
  interactiveTopic: "revision"
});
assert(panel.includes('data-research-chat-form="shell-test"'), "form scope marker");
assert(panel.includes("data-research-chat-edit-banner"), "edit banner slot");
assert(panel.includes("research-chat-disabled-reason") && panel.includes("本步已确认"), "disabled reason");
assert(panel.includes("Enter 发送"), "composer hint");
assert(panel.includes("生成失败"), "error source label in panel");

const generatingPanel = renderResearchChatPanel({
  scope: "shell-test",
  session: beginResearchChatTurn(session, "流式中", { topic: "revision" }),
  generating: true,
  interactiveTopic: "revision"
});
assert(generatingPanel.includes("data-research-chat-stop"), "stop button while generating");
assert(generatingPanel.includes("research-chat-typing") || generatingPanel.includes("research-chat-stream"), "pending UI");

const cancelledHtml = renderResearchChatMessage(cancelling.messages.at(-1), {
  scope: "shell-test",
  interactiveTopic: "revision"
});
assert(cancelledHtml.includes("已停止") && cancelledHtml.includes("is-cancelled"), "cancelled message chrome");

const truncatedAssistant = [...truncatedSession.messages]
  .reverse()
  .find((m) => m.role === "assistant" && m.truncated);
assert(truncatedAssistant, "expected a truncated assistant message");
const truncatedHtml = renderResearchChatMessage(truncatedAssistant, {
  scope: "shell-test",
  interactiveTopic: "revision"
});
assert(truncatedHtml.includes("已截断"), "truncated badge");

console.log("Research chat shell acceptance passed.");
