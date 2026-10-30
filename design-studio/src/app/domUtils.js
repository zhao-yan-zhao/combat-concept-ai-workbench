/** Shared DOM helpers for the workbench shell. */

export const $ = (selector) => document.querySelector(selector);

// -------------------------------------------------------------
// 消息胶囊 (Notification Capsule) 与 Toast 增强管理
// -------------------------------------------------------------
const STORAGE_KEY = "combat-concept-notifications-history";
const MAX_HISTORY = 100;

let notificationHistory = [];
let unreadCount = 0;
let isDrawerOpen = false;
let toastHovered = false;

// 初始化从 sessionStorage 恢复历史
try {
  const cached = globalThis.sessionStorage?.getItem(STORAGE_KEY);
  if (cached) {
    const list = JSON.parse(cached);
    if (Array.isArray(list)) notificationHistory = list;
  }
} catch {
  // ignore
}

function persistNotifications() {
  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(notificationHistory.slice(0, MAX_HISTORY)));
  } catch {
    // ignore
  }
}

function formatNotificationTime(timestamp) {
  const date = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function getNotificationHistory() {
  return [...notificationHistory];
}

export function clearNotificationHistory() {
  notificationHistory = [];
  unreadCount = 0;
  persistNotifications();
  renderNotificationCapsuleUI();
}

let activeBackgroundTask = null;

export function setBackgroundTaskState(taskInfo) {
  activeBackgroundTask = taskInfo;
  renderNotificationCapsuleUI();
}

export function getBackgroundTaskState() {
  return activeBackgroundTask;
}

export function toggleNotificationDrawer(open) {
  isDrawerOpen = typeof open === "boolean" ? open : !isDrawerOpen;
  if (isDrawerOpen) {
    unreadCount = 0;
  }
  renderNotificationCapsuleUI();
}

function renderNotificationCapsuleUI() {
  if (typeof document === "undefined") return;
  const capsuleBtn = $("#notificationCapsuleBtn");
  const badge = $("#capsuleBadge");
  const drawer = $("#notificationDrawer");
  const drawerCount = $("#drawerMsgCount");
  const drawerBody = $("#notificationDrawerBody");

  if (capsuleBtn) {
    if (activeBackgroundTask) {
      capsuleBtn.classList.add("is-running");
      const pct = activeBackgroundTask.progressPercent != null ? `${activeBackgroundTask.progressPercent}%` : "";
      capsuleBtn.innerHTML = `
        <span class="capsule-spinner" aria-hidden="true"></span>
        <span class="capsule-task-text">${escapeHtml(activeBackgroundTask.title || "AI 生成中")}</span>
        ${pct ? `<span class="capsule-task-pct">${pct}</span>` : ""}
      `;
    } else {
      capsuleBtn.classList.remove("is-running");
      capsuleBtn.innerHTML = `
        <span class="capsule-bell">🔔</span>
        <span class="capsule-label">消息</span>
        <span class="capsule-badge" id="capsuleBadge" ${unreadCount > 0 ? "" : "hidden"}>${unreadCount > 99 ? "99+" : unreadCount}</span>
      `;
    }
    capsuleBtn.setAttribute("aria-expanded", String(isDrawerOpen));
    capsuleBtn.classList.toggle("is-active", isDrawerOpen);
  }

  if (drawer) {
    drawer.hidden = !isDrawerOpen;
    drawer.classList.toggle("is-open", isDrawerOpen);
  }

  if (drawerCount) {
    drawerCount.textContent = String(notificationHistory.length);
  }

  if (drawerBody && isDrawerOpen) {
    let taskCardHtml = "";
    if (activeBackgroundTask) {
      const pct = activeBackgroundTask.progressPercent != null ? activeBackgroundTask.progressPercent : 50;
      taskCardHtml = `
        <div class="drawer-task-card" id="drawerTaskCard">
          <div class="drawer-task-head">
            <strong>⚡ ${escapeHtml(activeBackgroundTask.title || "后台运行中")}</strong>
            <span class="capsule-task-pct">${activeBackgroundTask.progressPercent != null ? `${activeBackgroundTask.progressPercent}%` : "持续流式接收中"}</span>
          </div>
          <div class="drawer-task-detail">${escapeHtml(activeBackgroundTask.detail || "AI 正在后台分析与生成，请稍候…")}</div>
          <div class="drawer-task-progress">
            <div class="drawer-task-bar" style="width: ${pct}%"></div>
          </div>
          <div class="drawer-task-actions">
            <button class="quiet-button" id="resumeForegroundBtn" type="button" title="重新打开居中等待遮罩">恢复前台等待</button>
          </div>
        </div>
      `;
    }

    let historyHtml = "";
    if (!notificationHistory.length) {
      historyHtml = '<div class="notification-empty">暂无历史消息</div>';
    } else {
      historyHtml = notificationHistory.map((item, index) => `
        <div class="notification-item" data-index="${index}">
          <div class="notification-item-header">
            <span class="notification-time">${escapeHtml(item.timeStr || formatNotificationTime(item.timestamp))}</span>
            <button class="notification-copy-btn" type="button" data-copy="${escapeHtml(item.message)}" title="复制消息内容">复制</button>
          </div>
          <div class="notification-text">${escapeHtml(item.message)}</div>
        </div>
      `).join("");
    }

    drawerBody.innerHTML = taskCardHtml + historyHtml;

    // 绑定恢复前台按钮
    const resumeBtn = drawerBody.querySelector("#resumeForegroundBtn");
    if (resumeBtn) {
      resumeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleNotificationDrawer(false);
        globalThis.__resumeBusyOverlay?.();
      });
    }

    // 绑定复制
    drawerBody.querySelectorAll(".notification-copy-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const text = btn.dataset.copy || "";
        try {
          await navigator.clipboard.writeText(text);
          const orig = btn.textContent;
          btn.textContent = "已复制";
          btn.classList.add("is-copied");
          setTimeout(() => {
            btn.textContent = orig;
            btn.classList.remove("is-copied");
          }, 1500);
        } catch {
          // fallback
        }
      });
    });
  }
}

// 供页面就绪时初始化绑定胶囊交互
export function initNotificationCapsule() {
  if (typeof document === "undefined" || initNotificationCapsule.initialized) return;
  initNotificationCapsule.initialized = true;

  const toast = $("#toast");
  if (toast) {
    toast.addEventListener("mouseenter", () => {
      toastHovered = true;
      if (showToast.timer) window.clearTimeout(showToast.timer);
    });
    toast.addEventListener("mouseleave", () => {
      toastHovered = false;
      showToast.timer = window.setTimeout(() => {
        if (!toastHovered) toast.classList.remove("show");
      }, 1500);
    });
  }

  const capsuleBtn = $("#notificationCapsuleBtn");
  if (capsuleBtn) {
    capsuleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleNotificationDrawer();
    });
  }

  const closeBtn = $("#closeNotificationDrawerBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleNotificationDrawer(false);
    });
  }

  const clearBtn = $("#clearNotificationsBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      clearNotificationHistory();
    });
  }

  // 点击外部收起
  document.addEventListener("click", (e) => {
    if (!isDrawerOpen) return;
    const wrap = $("#notificationCapsuleWrap");
    if (wrap && !wrap.contains(e.target)) {
      toggleNotificationDrawer(false);
    }
  });

  renderNotificationCapsuleUI();
}

export function showToast(message) {
  const text = String(message || "").trim();
  if (!text) return;

  // 1. 存入通知历史队列（去重相邻相同消息或记录）
  const timestamp = Date.now();
  const timeStr = formatNotificationTime(timestamp);
  const entry = { id: `msg_${timestamp}_${Math.random().toString(36).slice(2, 7)}`, message: text, timestamp, timeStr };
  notificationHistory.unshift(entry);
  if (notificationHistory.length > MAX_HISTORY) notificationHistory.pop();
  if (!isDrawerOpen) {
    unreadCount += 1;
  }
  persistNotifications();
  renderNotificationCapsuleUI();

  // 2. 气泡展示（4秒自动淡出，支持悬停保活）
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    if (!toastHovered) toast.classList.remove("show");
  }, 4000);
}

export function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[character]));
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadArtifact(artifact, notify = showToast) {
  const blob = new Blob([artifact.content], { type: artifact.mime });
  downloadBlob(blob, artifact.filename);
  notify(`${artifact.label}已生成`);
}

export function writePrintableReport(target, payload, loading = false, buildMarkdown) {
  const markdown = buildMarkdown(payload);
  const title = `${payload.project.title} 成果报告`;
  const content = loading ? "<p class=\"status\">正在准备正式 PDF 报告...</p>" : renderPrintableMarkdown(markdown);
  target.document.open();
  target.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="${window.location.origin}/design-studio/styles.css?v=0.35"></head><body class="print-report"><div class="toolbar"><button type="button" onclick="window.print()">打印 / 保存为 PDF</button></div><main>${content}</main></body></html>`);
  target.document.close();
}

export function renderPrintableMarkdown(markdown) {
  return markdown.split(/\n{2,}/).map((block) => {
    if (block.startsWith("# ")) return `<h1>${escapeHtml(block.slice(2))}</h1>`;
    if (block.startsWith("## ")) return `<h2>${escapeHtml(block.slice(3))}</h2>`;
    if (block.startsWith("### ")) return `<h3>${escapeHtml(block.slice(4))}</h3>`;
    if (block.split("\n").every((line) => line.startsWith("- "))) {
      return `<ul>${block.split("\n").map((line) => `<li>${escapeHtml(line.slice(2))}</li>`).join("")}</ul>`;
    }
    return `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`;
  }).join("");
}
