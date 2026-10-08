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
  disabledReason = "",
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
  const reason = !busy && disabled && disabledReason
    ? `<p class="research-chat-disabled-reason" role="status">${escapeHtml(disabledReason)}</p>`
    : "";

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
        <div class="research-chat-edit-banner" data-research-chat-edit-banner="${escapeHtml(scope)}" hidden>
          <span>正在编辑一条消息</span>
          <button type="button" class="message-action" data-research-chat-cancel-edit="${escapeHtml(scope)}">取消编辑</button>
        </div>
        ${reason}
        <div class="research-chat-composer-row">
          <label class="research-chat-composer-field" for="${escapeHtml(resolvedInputId)}">
            <span class="visually-hidden">研究问题</span>
            <textarea id="${escapeHtml(resolvedInputId)}" name="question" rows="2" maxlength="800" placeholder="${escapeHtml(placeholder)}" data-research-chat-input="${escapeHtml(scope)}" ${inputDisabled ? "disabled" : ""}></textarea>
          </label>
          ${busy
            ? `<button class="research-chat-stop" type="button" data-research-chat-stop="${escapeHtml(scope)}" aria-label="停止生成" title="停止生成">
                <span aria-hidden="true">■</span>
              </button>`
            : `<button class="research-chat-send" type="submit" aria-label="发送" title="发送（Enter）" ${inputDisabled ? "disabled" : ""}>
                <span aria-hidden="true">↑</span>
              </button>`}
        </div>
        <p class="research-chat-composer-hint">Enter 发送 · Shift+Enter 换行</p>
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
  const sourceMeta = resolveSourceMeta(message.source);
  const truncated = Boolean(message.truncated);
  const action = isInteractive
    ? (isUser
      ? `<button type="button" class="message-action" data-research-chat-edit="${escapeHtml(message.id)}" data-research-chat-scope="${escapeHtml(scope)}">编辑</button>`
      : `<button type="button" class="message-action" data-research-chat-retry="${escapeHtml(message.id)}" data-research-chat-scope="${escapeHtml(scope)}">重新生成</button>`)
    : "";

  return `<article class="inspiration-message ${isUser ? "user" : "assistant"}${sourceMeta.articleClass}">
    <div class="inspiration-message-avatar" aria-hidden="true">${isUser ? "研" : "助"}</div>
    <div class="inspiration-message-body">
      <div class="inspiration-message-meta">
        <strong>${isUser ? "研究人员" : "研究助手"}</strong>
        <div class="inspiration-message-meta-tools">
          ${!isUser ? `<span class="inspiration-message-source ${sourceMeta.sourceClass}">${sourceMeta.label}</span>` : ""}
          ${truncated ? `<span class="research-chat-truncated" title="内容已按长度上限截断">已截断</span>` : ""}
          ${action}
        </div>
      </div>
      ${message.thinking ? `
        <details class="research-chat-thinking">
          <summary>🧠 推演过程</summary>
          <div class="research-chat-thinking-text">${escapeHtml(message.thinking)}</div>
        </details>
      ` : ""}
      <p>${escapeHtml(message.text)}</p>
    </div>
  </article>`;
}

export function scrollResearchChatToBottom(root, scope = "") {
  const host = root || document;
  const thread = scope
    ? host.querySelector(`[data-research-chat-thread="${scope}"]`)
    : host.querySelector("[data-research-chat-thread], .research-chat-thread");
  if (!thread) return;
  requestAnimationFrame(() => {
    thread.scrollTop = thread.scrollHeight;
  });
}

/** In-place stream update without full app re-render (avoids input/scroll flicker). */
export function patchResearchChatStream(scope, text, optionsOrRoot = document) {
  const root = (optionsOrRoot && optionsOrRoot.nodeType) ? optionsOrRoot : document;
  const options = (optionsOrRoot && !optionsOrRoot.nodeType && typeof optionsOrRoot === "object") ? optionsOrRoot : {};
  const thinking = String(options.thinking || "").trim();
  const host = (root && root.querySelector)
    ? (root.querySelector(`[data-research-chat-scope="${scope}"]`) || root)
    : document;
  const panel = host.matches?.(`[data-research-chat-scope="${scope}"]`)
    ? host
    : (host.querySelector?.(`[data-research-chat-scope="${scope}"]`) || document);
  const pending = panel.querySelector?.(`[data-research-chat-pending="true"] .inspiration-message-body`)
    || document.querySelector(`[data-research-chat-scope="${scope}"] [data-research-chat-pending="true"] .inspiration-message-body`);
  if (!pending) return;

  const typing = pending.querySelector(".research-chat-typing");
  if (thinking || text) {
    if (typing) typing.remove();
  }

  if (thinking) {
    let thinkEl = pending.querySelector("[data-research-chat-thinking]");
    if (!thinkEl) {
      thinkEl = document.createElement("details");
      thinkEl.className = "research-chat-thinking";
      thinkEl.setAttribute("data-research-chat-thinking", "");
      thinkEl.open = true;
      thinkEl.innerHTML = `<summary>🧠 思考推演中…</summary><div class="research-chat-thinking-text"></div>`;
      const meta = pending.querySelector(".inspiration-message-meta");
      if (meta && meta.nextSibling) {
        pending.insertBefore(thinkEl, meta.nextSibling);
      } else {
        pending.prepend(thinkEl);
      }
    }
    const thinkBody = thinkEl.querySelector(".research-chat-thinking-text");
    if (thinkBody) thinkBody.textContent = thinking;
  }

  const value = String(text || "").trim();
  if (value) {
    let stream = pending.querySelector("[data-research-chat-stream]");
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
  }
  const source = pending.querySelector(".inspiration-message-source");
  if (source) source.textContent = "生成中";
  scrollResearchChatToBottom(document, scope);
}

function resolveSourceMeta(source) {
  if (source === "ai") {
    return { label: "AI", sourceClass: "is-ai", articleClass: "" };
  }
  if (source === "error") {
    return { label: "生成失败", sourceClass: "is-error", articleClass: " is-error" };
  }
  if (source === "cancelled") {
    return { label: "已停止", sourceClass: "is-cancelled", articleClass: " is-cancelled" };
  }
  return { label: "本地建议", sourceClass: "is-local", articleClass: "" };
}

/**
 * Shared collapsible dock shell for research chat across workflow steps.
 */
export function renderResearchChatDock({
  scope = "phase-action",
  open = false,
  dockId = "",
  className = "",
  contentHtml = "",
  label = "研究对话侧栏"
} = {}) {
  const resolvedDockId = dockId || `${scope}ChatDock`;
  const classes = [
    "research-chat-dock",
    `${scope}-chat-dock`,
    open ? "is-open" : "is-collapsed",
    className
  ].filter(Boolean).join(" ");

  return `<aside class="${classes}" id="${escapeHtml(resolvedDockId)}" aria-hidden="${open ? "false" : "true"}" aria-label="${escapeHtml(label)}">
    ${open ? contentHtml : ""}
  </aside>`;
}
