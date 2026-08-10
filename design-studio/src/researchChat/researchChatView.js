import { escapeHtml } from "../app/domUtils.js";

/**
 * Shared research-chat shell used by brief, phase-action, and future steps.
 * Step pages only pass copy + session; they do not re-implement bubbles.
 */
export function renderResearchChatPanel({
  scope = "brief",
  session,
  generating = false,
  title = "研究对话",
  subtitle = "围绕概念、假设、约束和证据进行可复核的研究交流。",
  statusLabel = "",
  placeholder = "输入研究问题、假设或需要澄清的约束",
  emptyTitle = "开始研究交流",
  emptyText = "记录任务设想、假设或约束，助手将给出可复核的概念级判断。",
  disabled = false,
  className = "",
  headerActionsHtml = "",
  footerHtml = "",
  formId = "",
  inputId = "",
  threadId = "",
  interactiveTopic = "consultation"
} = {}) {
  const messages = session?.messages || [];
  const busy = Boolean(generating);
  const inputDisabled = busy || disabled;
  const resolvedFormId = formId || `${scope}-chat-form`;
  const resolvedInputId = inputId || `${scope}-chat-input`;
  const resolvedThreadId = threadId || `${scope}-chat-thread`;
  const status = statusLabel || (busy ? "AI 正在分析" : "研究助手");
  const classes = ["surface", "inspiration-panel", "research-chat-panel", busy ? "is-generating" : "", className]
    .filter(Boolean)
    .join(" ");

  return `
    <section class="${classes}" data-research-chat-scope="${escapeHtml(scope)}">
      <header class="research-chat-header${headerActionsHtml ? " has-header-action" : ""}">
        <div class="research-chat-title">
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(subtitle)}</p>
        </div>
        <div class="research-chat-status">
          <span class="mini-tag research-chat-status-tag ${busy ? "review" : ""}">${escapeHtml(status)}</span>
        </div>
        ${headerActionsHtml}
      </header>
      <div class="inspiration-thread research-chat-thread" id="${escapeHtml(resolvedThreadId)}" data-research-chat-thread="${escapeHtml(scope)}" aria-live="polite">
        ${messages.length
          ? messages.map((message) => renderResearchChatMessage(message, { scope, interactiveTopic })).join("")
          : `<div class="research-chat-empty">
              <strong>${escapeHtml(emptyTitle)}</strong>
              <p>${escapeHtml(emptyText)}</p>
            </div>`}
      </div>
      <form class="research-chat-composer" id="${escapeHtml(resolvedFormId)}" data-research-chat-form="${escapeHtml(scope)}">
        <label class="research-chat-composer-field" for="${escapeHtml(resolvedInputId)}">
          <span class="visually-hidden">研究问题</span>
          <textarea id="${escapeHtml(resolvedInputId)}" name="question" rows="2" maxlength="800" placeholder="${escapeHtml(placeholder)}" data-research-chat-input="${escapeHtml(scope)}" ${inputDisabled ? "disabled" : ""}></textarea>
        </label>
        <button class="research-chat-send" type="submit" aria-label="发送" title="发送" ${inputDisabled ? "disabled" : ""}>
          <span aria-hidden="true">${busy ? "…" : "↑"}</span>
        </button>
      </form>
      ${footerHtml}
    </section>
  `;
}

/** Topbar floating FAB — same visual language as OV-1 toolbox float. */
export function renderResearchChatFloatButton({
  scope = "phase-action",
  open = false,
  generating = false,
  disabled = false,
  titleOpen = "收起对话",
  titleClosed = "打开对话",
  action = "toggle-research-chat"
} = {}) {
  const title = open ? titleOpen : titleClosed;
  return `
    <button class="ov1-edit-rail-brand is-topbar-float research-chat-float ${generating ? "is-busy" : ""} ${open ? "is-open" : ""}" type="button" data-action="${escapeHtml(action)}" data-research-chat-scope="${escapeHtml(scope)}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" aria-expanded="${open ? "true" : "false"}" ${disabled ? "disabled" : ""}>
      <span class="ov1-edit-rail-brand-ring" aria-hidden="true"></span>
      <span class="ov1-edit-rail-brand-glow" aria-hidden="true"></span>
      <span class="ov1-edit-ico" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 7.5h14a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H10l-4 3v-3H5A1.5 1.5 0 0 1 3.5 16V9A1.5 1.5 0 0 1 5 7.5z"/>
          <path d="M8 12h.01M12 12h.01M16 12h.01"/>
        </svg>
      </span>
    </button>
  `;
}

export function renderResearchChatMessage(message, { scope = "brief", interactiveTopic = "consultation" } = {}) {
  if (message.pending) {
    const streamText = String(message.text || "").trim();
    const body = streamText
      ? `<p class="research-chat-stream" data-research-chat-stream>${escapeHtml(streamText)}<span class="research-chat-caret" aria-hidden="true"></span></p>`
      : `<p class="research-chat-typing" aria-label="正在分析"><span></span><span></span><span></span></p>`;
    return `<article class="inspiration-message assistant is-pending is-enter" data-research-chat-pending="true" aria-busy="true">
      <div class="inspiration-message-avatar" aria-hidden="true">助</div>
      <div class="inspiration-message-body">
        <div class="inspiration-message-meta">
          <strong>研究助手</strong>
          <div class="inspiration-message-meta-tools">
            <span class="inspiration-message-source is-pending">${streamText ? "生成中" : "分析中"}</span>
          </div>
        </div>
        ${body}
      </div>
    </article>`;
  }

  const isUser = message.role === "user";
  const isInteractive = message.topic === interactiveTopic;
  const isAi = message.source === "ai";
  const source = isAi ? "AI" : "本地建议";
  const sourceClass = isAi ? "is-ai" : "is-local";
  const action = isInteractive
    ? (isUser
      ? `<button type="button" class="message-action" data-research-chat-edit="${escapeHtml(message.id)}" data-research-chat-scope="${escapeHtml(scope)}">编辑</button>`
      : `<button type="button" class="message-action" data-research-chat-retry="${escapeHtml(message.id)}" data-research-chat-scope="${escapeHtml(scope)}">重新生成</button>`)
    : "";

  return `<article class="inspiration-message ${isUser ? "user" : "assistant"}">
    <div class="inspiration-message-avatar" aria-hidden="true">${isUser ? "研" : "助"}</div>
    <div class="inspiration-message-body">
      <div class="inspiration-message-meta">
        <strong>${isUser ? "研究人员" : "研究助手"}</strong>
        <div class="inspiration-message-meta-tools">
          ${!isUser ? `<span class="inspiration-message-source ${sourceClass}">${source}</span>` : ""}
          ${action}
        </div>
      </div>
      <p>${escapeHtml(message.text)}</p>
    </div>
  </article>`;
}

export function scrollResearchChatToBottom(root, scope = "") {
  const thread = scope
    ? root.querySelector(`[data-research-chat-thread="${scope}"]`)
    : root.querySelector("[data-research-chat-thread], .research-chat-thread");
  if (!thread) return;
  requestAnimationFrame(() => {
    thread.scrollTop = thread.scrollHeight;
  });
}

/** In-place stream update without full app re-render (avoids input/scroll flicker). */
export function patchResearchChatStream(scope, text) {
  const root = document.querySelector(`[data-research-chat-scope="${scope}"]`) || document;
  const pending = root.querySelector(`[data-research-chat-pending="true"] .inspiration-message-body`);
  if (!pending) return;
  const value = String(text || "").trim();
  let stream = pending.querySelector("[data-research-chat-stream]");
  const typing = pending.querySelector(".research-chat-typing");
  if (!value) return;
  if (typing) typing.remove();
  if (!stream) {
    stream = document.createElement("p");
    stream.className = "research-chat-stream";
    stream.setAttribute("data-research-chat-stream", "");
    stream.innerHTML = `<span class="research-chat-caret" aria-hidden="true"></span>`;
    pending.appendChild(stream);
  }
  const caret = stream.querySelector(".research-chat-caret");
  stream.textContent = value;
  if (caret) stream.appendChild(caret);
  else {
    const mark = document.createElement("span");
    mark.className = "research-chat-caret";
    mark.setAttribute("aria-hidden", "true");
    stream.appendChild(mark);
  }
  const source = pending.querySelector(".inspiration-message-source");
  if (source) source.textContent = "生成中";
  scrollResearchChatToBottom(document, scope);
}
