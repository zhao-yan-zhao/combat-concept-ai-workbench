const MENUBAR_IDLE_DISMISS_MS = 300;
let menubarIdleTimer = null;
let menubarPointerInside = false;

export function closeMenubarMenus(except = null) {
  document.querySelectorAll(".menubar-menu[open]").forEach((menu) => {
    if (menu !== except) menu.open = false;
  });
}

export function isMenubarChromeOpen(state) {
  return Boolean(document.querySelector(".menubar-menu[open]")) || Boolean(state.projectManagerOpen);
}

export function isInsideMenubarChrome(node) {
  if (!(node instanceof Element)) return false;
  return Boolean(node.closest(".menubar-menu, .project-manager-root"));
}

export function isInsideOpenMenubarChrome(node, state) {
  if (!(node instanceof Element)) return false;
  if (node.closest(".menubar-menu[open]")) return true;
  if (state.projectManagerOpen && node.closest(".project-manager-root")) return true;
  return false;
}

export function clearMenubarIdleTimer() {
  if (!menubarIdleTimer) return;
  clearTimeout(menubarIdleTimer);
  menubarIdleTimer = null;
}

export function scheduleMenubarIdleDismiss(ctx) {
  const { state } = ctx;
  clearMenubarIdleTimer();
  if (!isMenubarChromeOpen(state)) return;
  menubarIdleTimer = window.setTimeout(() => {
    menubarIdleTimer = null;
    if (menubarPointerInside) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest("#projectCreateForm")) return;
    dismissMenubarChrome(ctx);
  }, MENUBAR_IDLE_DISMISS_MS);
}

export function dismissMenubarChrome(ctx) {
  const { state } = ctx;
  clearMenubarIdleTimer();
  menubarPointerInside = false;
  const active = document.activeElement;
  if (active instanceof HTMLElement && isInsideOpenMenubarChrome(active, state)) {
    active.blur();
  }
  const hadMenus = Boolean(document.querySelector(".menubar-menu[open]"));
  const hadProject = Boolean(state.projectManagerOpen);
  closeMenubarMenus();
  if (!hadProject) return hadMenus;
  state.projectManagerOpen = false;
  state.projectCreateOpen = false;
  refreshProjectManagerUi(ctx);
  return true;
}

export function focusOpenMenubarChrome(state) {
  if (!state.projectManagerOpen) return;
  if (state.projectCreateOpen) {
    const titleInput = document.querySelector('#projectCreateForm input[name="title"]');
    if (titleInput instanceof HTMLElement) {
      titleInput.focus({ preventScroll: true });
      return;
    }
  }
  const panel = document.querySelector(".project-manager-panel");
  if (panel instanceof HTMLElement) panel.focus({ preventScroll: true });
}

export function openMenubarMenu(menu) {
  if (!(menu instanceof HTMLDetailsElement)) return;
  if (menu.open) {
    clearMenubarIdleTimer();
    return;
  }
  menu.open = true;
}

export function refreshProjectManagerUi(ctx) {
  const { state, renderProjectManagerChrome, render } = ctx;
  if (state.activeView === "concept-map") {
    renderProjectManagerChrome();
    return;
  }
  render();
}

export function openProjectManagerFromHover(ctx) {
  const { state } = ctx;
  if (state.projectManagerOpen) {
    clearMenubarIdleTimer();
    return;
  }
  closeMenubarMenus();
  state.projectManagerOpen = true;
  refreshProjectManagerUi(ctx);
  queueMicrotask(() => focusOpenMenubarChrome(state));
}

export function bindMenubarChrome(ctx) {
  if (bindMenubarChrome.bound) return;
  bindMenubarChrome.bound = true;
  const { state } = ctx;

  document.querySelectorAll(".menubar-menu").forEach((menu) => {
    menu.addEventListener("toggle", () => {
      if (!menu.open) {
        if (!isMenubarChromeOpen(state)) clearMenubarIdleTimer();
        return;
      }
      closeMenubarMenus(menu);
      clearMenubarIdleTimer();
      if (state.projectManagerOpen) {
        state.projectManagerOpen = false;
        state.projectCreateOpen = false;
        refreshProjectManagerUi(ctx);
      }
    });
  });

  document.addEventListener("pointerover", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const menu = target.closest(".menubar-menu");
    const projectRoot = target.closest(".project-manager-root");
    if (!menu && !projectRoot) return;

    menubarPointerInside = true;
    clearMenubarIdleTimer();

    if (menu) {
      openMenubarMenu(menu);
      return;
    }

    if (projectRoot && (target.closest(".project-manager-trigger") || state.projectManagerOpen)) {
      if (target.closest(".project-manager-trigger") || projectRoot.classList.contains("is-open")) {
        openProjectManagerFromHover(ctx);
      }
    }
  });

  document.addEventListener("pointerout", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!isInsideMenubarChrome(target)) return;

    const related = event.relatedTarget;
    if (related instanceof Element && isInsideMenubarChrome(related)) {
      menubarPointerInside = true;
      clearMenubarIdleTimer();
      return;
    }

    menubarPointerInside = false;
    if (isMenubarChromeOpen(state)) scheduleMenubarIdleDismiss(ctx);
  });

  document.addEventListener("pointerdown", (event) => {
    if (!isMenubarChromeOpen(state)) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (isInsideOpenMenubarChrome(target, state) || isInsideMenubarChrome(target)) {
      clearMenubarIdleTimer();
      return;
    }
    if (target.closest('[data-action="toggle-project-manager"]')) {
      closeMenubarMenus();
      clearMenubarIdleTimer();
      return;
    }
    dismissMenubarChrome(ctx);
  }, true);

  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    document.querySelectorAll(".derived-provenance-dropdown[open]").forEach((details) => {
      if (!details.contains(target)) {
        details.removeAttribute("open");
      }
    });
  });

  document.addEventListener("focusout", (event) => {
    if (!isMenubarChromeOpen(state)) return;
    const from = event.target;
    if (!(from instanceof Element) || !isInsideOpenMenubarChrome(from, state)) return;
    const next = event.relatedTarget;
    if (next instanceof Element && isInsideOpenMenubarChrome(next, state)) return;
    requestAnimationFrame(() => {
      if (!isMenubarChromeOpen(state)) return;
      if (menubarPointerInside) {
        clearMenubarIdleTimer();
        return;
      }
      scheduleMenubarIdleDismiss(ctx);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !isMenubarChromeOpen(state)) return;
    event.preventDefault();
    dismissMenubarChrome(ctx);
  });
}

export function bindWorkflowGateChrome(ctx) {
  const { state, handleAction, setWorkflowGateOpen, getWorkflowGateLeaveSuppressedUntil } = ctx;
  const root = document.getElementById("workflowGateRoot");
  if (root && root.dataset.actionsBound !== "true") {
    root.dataset.actionsBound = "true";
    root.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("[data-action]");
      if (!button || !root.contains(button)) return;
      handleAction(button.dataset.action, button);
    });
  }

  let leaveTimer = null;
  const clearLeaveTimer = () => {
    if (!leaveTimer) return;
    clearTimeout(leaveTimer);
    leaveTimer = null;
  };

  const collapseGate = () => {
    clearLeaveTimer();
    if (!state.workflowGateOpen) return;
    setWorkflowGateOpen(false);
  };

  document.addEventListener("pointerover", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest("#workflowGateRoot [data-workflow-gate-shell]")) return;
    clearLeaveTimer();
  }, true);

  document.addEventListener("pointerout", (event) => {
    if (!state.workflowGateOpen) return;
    const leaveSuppressedUntil = getWorkflowGateLeaveSuppressedUntil ? getWorkflowGateLeaveSuppressedUntil() : 0;
    if (performance.now() < leaveSuppressedUntil) return;
    const from = event.target;
    if (!(from instanceof Element) || !from.closest("#workflowGateRoot [data-workflow-gate-shell]")) return;
    const to = event.relatedTarget;
    if (to instanceof Element && to.closest("#workflowGateRoot [data-workflow-gate-shell]")) return;
    if (!(to instanceof Element) && !document.contains(from)) return;
    clearLeaveTimer();
    leaveTimer = window.setTimeout(collapseGate, 160);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !state.workflowGateOpen) return;
    event.preventDefault();
    collapseGate();
  });
}

export function bindAiModalsChrome(ctx) {
  const {
    state,
    handleAction,
    $,
    getBusyOverlayState,
    getBusyOverlayStartedAt,
    forceDismissStuckOverlay
  } = ctx;

  const configRoot = document.getElementById("aiConfigRoot");
  if (configRoot && configRoot.dataset.actionsBound !== "true") {
    configRoot.dataset.actionsBound = "true";
    configRoot.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("[data-action]");
      if (!button || !configRoot.contains(button)) return;
      handleAction(button.dataset.action, button);
    });
  }

  const promptRoot = document.getElementById("aiPromptRoot");
  if (promptRoot && promptRoot.dataset.actionsBound !== "true") {
    promptRoot.dataset.actionsBound = "true";
    promptRoot.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("[data-action]");
      if (!button || !promptRoot.contains(button)) return;
      handleAction(button.dataset.action, button);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const overlay = $("#workflowModeOverlay");
    if (overlay && !overlay.hidden && overlay.classList.contains("is-visible")) {
      const busy = getBusyOverlayState();
      const startedAt = getBusyOverlayStartedAt ? getBusyOverlayStartedAt() : 0;
      const elapsedMs = Math.max(0, Date.now() - startedAt);
      if (elapsedMs > 2000 || (busy && elapsedMs >= (busy.expectedMs || 3000))) {
        event.preventDefault();
        forceDismissStuckOverlay(busy);
        return;
      }
    }
    if (state.aiPromptOpen) {
      event.preventDefault();
      handleAction("close-ai-prompts");
      return;
    }
    if (state.aiConfigOpen) {
      event.preventDefault();
      handleAction("close-ai-config");
      return;
    }
  });
}
