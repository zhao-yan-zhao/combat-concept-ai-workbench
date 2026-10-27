export function createCollaborationController({ projectId = "default", getState, render, notify, load, loadAudit, loadSession, loadAccounts, loadSecurityEvents, setup, login, register, logout, createAccount, updateAccount, createReview, resolveReview, onSessionChanged, onWorkflowChanged, exportAudit, exportSecurityEvents }) {
  let watchTimer = null;
  let lastNotifiedRevision = 0;
  const boundAuthElements = new WeakSet();
  const focusedAuthForms = new WeakSet();
  function bindAuthElement(element) {
    if (!element || boundAuthElements.has(element)) return null;
    boundAuthElements.add(element);
    return element;
  }
  return {
    async hydrate() {
      const state = getState();
      const previous = state.collaboration || {};
      state.collaboration = {
        ...previous,
        status: "loading",
        detail: "正在读取服务端协同审阅记录。"
      };
      try {
        // Identity is independent of project data and must settle before project hydration.
        const session = await loadSession();
        state.collaboration = { ...state.collaboration, session };
        render({ skipViewRoot: true });
        const [result, audit] = await Promise.all([load(projectId), loadAudit(projectId, 16).catch(() => ({ entries: [] }))]);
        const accounts = session?.actor?.roles?.includes("lead") ? (await loadAccounts()).accounts : [];
        const securityEvents = session?.actor?.roles?.includes("lead") ? (await loadSecurityEvents()).events : [];
        state.collaboration = {
          ...toState(result, session, accounts, securityEvents, audit.entries || []),
          authMode: previous.authMode === "register" ? "register" : "login",
          authBusy: false,
          authError: session?.authenticated ? "" : previous.authError || "",
          authNotice: session?.authenticated ? "" : previous.authNotice || "",
          authDraft: session?.authenticated ? { username: "", label: "" } : (previous.authDraft || { username: "", label: "" }),
          reviewDraft: previous.reviewDraft || null,
          reviewFilter: previous.reviewFilter || "open"
        };
        await onSessionChanged?.();
      } catch {
        state.collaboration = {
          ...state.collaboration,
          status: "unavailable",
          detail: "协同审阅服务暂不可用。",
          authBusy: false,
          authError: previous.authError || "协同服务暂不可用，请确认服务已启动后重试。"
        };
      }
      render();
    },

    startWatch({ intervalMs = 30000 } = {}) {
      if (watchTimer || !Number.isFinite(intervalMs) || intervalMs < 5000) return false;
      watchTimer = setInterval(() => { void this.checkForUpdates(); }, intervalMs);
      return true;
    },

    stopWatch() {
      if (!watchTimer) return false;
      clearInterval(watchTimer);
      watchTimer = null;
      return true;
    },

    async checkForUpdates() {
      const state = getState();
      const current = state.collaboration || {};
      if (current.status !== "ready") return false;
      try {
        const remote = await load(projectId);
        const remoteRevision = Number(remote?.revision || 0);
        const loadedRevision = Number(current.revision || 0);
        const observedRevision = Number(current.remoteRevision || 0);
        if (remoteRevision <= loadedRevision || remoteRevision <= observedRevision) return false;
        state.collaboration = {
          ...current,
          remoteChangeAvailable: true,
          remoteRevision,
          remoteUpdatedAt: String(remote?.updatedAt || "")
        };
        render();
        if (state.activeView === "collaboration" && remoteRevision > lastNotifiedRevision) {
          lastNotifiedRevision = remoteRevision;
          notify(`检测到项目 r${remoteRevision} 的新修订；请刷新协同审阅后再查看模型变更。`);
        }
        return true;
      } catch {
        return false;
      }
    },

    bind(root) {
      bindAuthElement(root.querySelector("#loginGate #collaborationSetupForm") || root.querySelector("#collaborationSetupForm"))?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (getState().collaboration?.authBusy) return;
        restorePasswordInputs(event.currentTarget);
        const values = new FormData(event.currentTarget);
        const username = String(values.get("username") || "").trim();
        const label = String(values.get("label") || "").trim();
        const password = String(values.get("password") || "");
        const confirmPassword = String(values.get("confirmPassword") || "");
        rememberAuthDraft({ username, label });
        if (!username || username.length < 3) return setAuthFeedback("用户名至少 3 位", "error");
        if (!label) return setAuthFeedback("请填写显示名称", "error");
        if (password.length < 12) return setAuthFeedback("密码至少 12 位", "error");
        if (password !== confirmPassword) return setAuthFeedback("两次输入的密码不一致", "error");
        await runAuth(async () => {
          await setup({ username, label, password });
          await offerSavePassword(username, password);
          setAuthFeedback("负责人账号已初始化", "notice");
          notify("负责人账号已初始化");
          await this.hydrate();
        }, "账号初始化失败，请检查用户名和密码长度");
      });

      bindAuthElement(root.querySelector("#loginGate #collaborationLoginForm") || root.querySelector("#collaborationLoginForm"))?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (getState().collaboration?.authBusy) return;
        restorePasswordInputs(event.currentTarget);
        const values = new FormData(event.currentTarget);
        const username = String(values.get("username") || "").trim();
        const password = String(values.get("password") || "");
        rememberAuthDraft({ username });
        if (!username) return setAuthFeedback("请输入用户名", "error");
        if (!password) return setAuthFeedback("请输入密码", "error");
        await runAuth(async () => {
          await login({ username, password });
          await offerSavePassword(username, password);
          setAuthFeedback("", "clear");
          notify("协同身份已登录");
          await this.hydrate();
        }, "用户名或密码无效");
      });

      bindAuthElement(root.querySelector("#loginGate #collaborationRegisterForm") || root.querySelector("#collaborationRegisterForm"))?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (getState().collaboration?.authBusy) return;
        restorePasswordInputs(event.currentTarget);
        const values = new FormData(event.currentTarget);
        const username = String(values.get("username") || "").trim();
        const label = String(values.get("label") || "").trim();
        const password = String(values.get("password") || "");
        const confirmPassword = String(values.get("confirmPassword") || "");
        rememberAuthDraft({ username, label });
        if (!username || username.length < 3) return setAuthFeedback("用户名至少 3 位", "error");
        if (!label) return setAuthFeedback("请填写显示名称", "error");
        if (password.length < 12) return setAuthFeedback("密码至少 12 位", "error");
        if (password !== confirmPassword) return setAuthFeedback("两次输入的密码不一致", "error");
        await runAuth(async () => {
          await register({ username, label, password });
          await offerSavePassword(username, password);
          setAuthFeedback("", "clear");
          notify("注册成功，已登录协同身份");
          await this.hydrate();
        }, "注册失败，请检查用户名、显示名称和密码长度");
      });

      root.querySelectorAll("[data-auth-mode]").forEach((button) => {
        if (!bindAuthElement(button)) return;
        button.addEventListener("click", () => {
          if (getState().collaboration?.authBusy) return;
          const mode = button.dataset.authMode === "register" ? "register" : "login";
          setAuthMode(mode);
        });
      });

      root.querySelectorAll("[data-action='toggle-password-visibility']").forEach((button) => {
        if (!bindAuthElement(button)) return;
        button.addEventListener("click", () => {
          const targetId = button.dataset.passwordTarget || "";
          const input = targetId ? root.querySelector(`#${CSS.escape(targetId)}`) : null;
          if (!input) return;
          const show = input.type === "password";
          input.type = show ? "text" : "password";
          button.setAttribute("aria-pressed", show ? "true" : "false");
          button.setAttribute("aria-label", show ? "隐藏密码" : "显示密码");
          button.title = show ? "隐藏密码" : "显示密码";
        });
      });

      root.querySelector("[data-action='collaboration-logout']")?.addEventListener("click", async () => {
        try {
          await logout();
          notify("已退出协同身份");
          await this.hydrate();
        } catch {
          notify("退出协同身份失败");
        }
      });

      root.querySelector("#collaborationAccountForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        if (values.get("password") !== values.get("confirmPassword")) return notify("两次输入的密码不一致");
        try {
          await createAccount({
            username: values.get("username"),
            label: values.get("label"),
            password: values.get("password"),
            roles: [values.get("role")]
          });
          notify("协同账号已创建");
          await this.hydrate();
        } catch {
          notify("账号创建失败，请检查权限、用户名和密码长度");
        }
      });

      root.querySelectorAll("[data-account-toggle]").forEach((button) => button.addEventListener("click", async () => {
        try {
          await updateAccount(button.dataset.accountToggle, {
            change: "enabled",
            enabled: button.dataset.accountEnabled === "true"
          });
          notify("账号状态已更新，旧会话已失效");
          await this.hydrate();
        } catch {
          notify("账号状态更新失败");
        }
      }));

      root.querySelectorAll("[data-account-password]").forEach((form) => form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        if (values.get("password") !== values.get("confirmPassword")) return notify("两次输入的密码不一致");
        try {
          await updateAccount(form.dataset.accountPassword, { change: "password", password: values.get("password") });
          notify("密码已重置，旧会话已失效");
          event.currentTarget.reset();
        } catch {
          notify("密码重置失败，请检查密码长度");
        }
      }));

      root.querySelector("#collaborationReviewForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const state = getState();
        const values = new FormData(event.currentTarget);
        try {
          const result = await createReview(projectId, {
            resource: values.get("resource"),
            resourceRevision: currentResourceRevision(state, values.get("resource")),
            disposition: values.get("disposition"),
            summary: values.get("summary"),
            evidenceRefs: values.getAll("evidenceRefs"),
            expectedRevision: state.collaboration.revision,
            clientId: state.collaboration?.reviewDraft?.clientId || undefined
          });
          state.collaboration = {
            ...toState(result, state.collaboration.session, state.collaboration.accounts, state.collaboration.securityEvents, state.collaboration.auditEntries),
            reviewDraft: null,
            authMode: state.collaboration.authMode,
            authBusy: false,
            authError: "",
            authNotice: "",
            reviewFilter: state.collaboration.reviewFilter || "open"
          };
          state.projectRevision = result.revision;
          await onWorkflowChanged?.({ resource: "collaboration", remote: result });
          notify("协同审阅已追加到项目事件链");
          render();
        } catch (error) {
          notify(error.status === 409 ? "项目已更新，请刷新协同审阅后再提交" : "协同审阅提交失败，请确认已登录");
        }
      });

      root.querySelectorAll("[data-collaboration-decision]").forEach((form) => form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const state = getState();
        const values = new FormData(event.currentTarget);
        try {
          const result = await resolveReview(projectId, form.dataset.collaborationDecision, {
            outcome: values.get("outcome"),
            summary: values.get("summary"),
            expectedRevision: state.collaboration.revision
          });
          state.collaboration = {
            ...toState(result, state.collaboration.session, state.collaboration.accounts, state.collaboration.securityEvents, state.collaboration.auditEntries),
            authMode: state.collaboration.authMode,
            authBusy: false,
            authError: "",
            authNotice: "",
            reviewFilter: state.collaboration.reviewFilter || "open",
            reviewDraft: state.collaboration.reviewDraft || null
          };
          state.projectRevision = result.revision;
          await onWorkflowChanged?.({ resource: "collaboration", remote: result });
          notify("负责人决议已追加到项目事件链");
          render();
        } catch (error) {
          notify(error.status === 409 ? "项目或审阅状态已更新，请刷新后再决议" : "协同决议登记失败，请确认负责人身份");
        }
      }));

      root.querySelectorAll("[data-collaboration-filter]").forEach((button) => button.addEventListener("click", () => {
        const state = getState();
        state.collaboration = { ...state.collaboration, reviewFilter: button.dataset.collaborationFilter || "open" };
        render();
      }));

      // Prefer focusing the first empty field; after failed login keep username and jump to password.
      const activeForm = root.querySelector("#loginGate form.login-auth-form:not([hidden]), form.login-auth-form:not([hidden])");
      if (activeForm && !focusedAuthForms.has(activeForm) && !getState().collaboration?.authBusy) {
        focusedAuthForms.add(activeForm);
        const hasError = Boolean(getState().collaboration?.authError);
        const passwordInput = activeForm.querySelector('input[name="password"]');
        const usernameInput = activeForm.querySelector('input[name="username"]');
        const firstEmpty = [...activeForm.querySelectorAll("input:not([disabled])")]
          .find((input) => !String(input.value || "").trim());
        requestAnimationFrame(() => {
          const focused = document.activeElement;
          if (focused && focused !== document.body && !activeForm.contains(focused)) return;
          if (hasError && passwordInput && String(usernameInput?.value || "").trim()) {
            passwordInput.focus();
            return;
          }
          (firstEmpty || usernameInput)?.focus?.();
        });
      }
    },

    handleAction(action) {
      if (action === "refresh-collaboration") {
        void this.hydrate();
        return true;
      }
      if (action === "export-project-audit") {
        exportAudit?.(getState().collaboration?.auditEntries || []);
        return true;
      }
      if (action === "export-collaboration-security-events") {
        exportSecurityEvents?.(getState().collaboration?.securityEvents || []);
        return true;
      }
      return false;
    }
  };

  async function runAuth(task, fallbackMessage) {
    const state = getState();
    state.collaboration = {
      ...state.collaboration,
      authBusy: true,
      authError: "",
      authNotice: ""
    };
    render();
    try {
      await task();
    } catch (error) {
      const message = mapAuthError(error, fallbackMessage);
      setAuthFeedback(message, "error");
      notify(message);
    } finally {
      const next = getState();
      if (next.collaboration) {
        next.collaboration = { ...next.collaboration, authBusy: false };
        render();
      }
    }
  }

  function setAuthMode(mode) {
    const state = getState();
    state.collaboration = {
      ...state.collaboration,
      authMode: mode === "register" ? "register" : "login",
      authError: "",
      authNotice: ""
    };
    render();
  }

  function rememberAuthDraft({ username = "", label = "" } = {}) {
    const state = getState();
    state.collaboration = {
      ...state.collaboration,
      authDraft: {
        username: String(username || "").trim().slice(0, 64),
        label: String(label || "").trim().slice(0, 80)
      }
    };
  }

  function setAuthFeedback(message, kind = "error") {
    const state = getState();
    if (kind === "clear") {
      state.collaboration = { ...state.collaboration, authError: "", authNotice: "" };
      return;
    }
    if (kind === "notice") {
      state.collaboration = { ...state.collaboration, authError: "", authNotice: message };
      render();
      return;
    }
    state.collaboration = { ...state.collaboration, authError: message, authNotice: "" };
    render();
  }
}

/** Password managers ignore type=text; restore before submit after "show password". */
function restorePasswordInputs(form) {
  form?.querySelectorAll?.('input[name="password"], input[name="confirmPassword"]').forEach((input) => {
    if (input.type !== "password") input.type = "password";
  });
}

/** Chromium can be asked explicitly; other browsers still rely on form heuristics. */
async function offerSavePassword(username, password) {
  try {
    if (!username || !password) return;
    if (typeof window === "undefined" || typeof window.PasswordCredential !== "function") return;
    if (!navigator.credentials?.store) return;
    await navigator.credentials.store(new window.PasswordCredential({
      id: username,
      name: username,
      password
    }));
  } catch {
    // User dismissed the prompt or the browser rejected storage.
  }
}

function mapAuthError(error, fallbackMessage) {
  if (error?.status === 429) return "登录尝试过于频繁，请稍后再试（约 10 分钟）";
  const raw = String(error?.message || "").trim();
  if (!raw) return fallbackMessage;
  const mapped = {
    "Invalid username or password": "用户名或密码无效",
    "Login is temporarily unavailable": "登录暂时锁定，请稍后再试",
    "Username is already in use": "用户名已存在",
    "Initialize a lead account before registering users": "请先初始化负责人账号后再注册",
    "Local collaboration accounts are already initialized": "负责人账号已初始化，请直接登录",
    "Password must contain 12 to 256 characters": "密码长度须为 12～256 位",
    "Collaboration login is required": "请先登录协同身份"
  };
  if (mapped[raw]) return mapped[raw];
  // Avoid dumping raw JSON blobs into the UI.
  if (raw.startsWith("{") || raw.startsWith("<")) return fallbackMessage;
  return raw.length > 160 ? fallbackMessage : raw;
}

function toState(result, session = null, accounts = [], securityEvents = [], auditEntries = []) {
  return {
    status: "ready",
    detail: "",
    storage: {
      status: "ready",
      mode: "server",
      label: "服务端协同审阅",
      revision: Number(result.revision || 0),
      resourceRevision: Number(result.resourceRevision || 0),
      auditCount: 0
    },
    revision: Number(result.revision || 0),
    resourceRevision: Number(result.resourceRevision || 0),
    policy: result.policy || null,
    reviews: result.reviews || [],
    openCount: Number(result.openCount || 0),
    session,
    accounts,
    securityEvents,
    auditEntries,
    remoteChangeAvailable: false,
    remoteRevision: 0,
    remoteUpdatedAt: ""
  };
}

function currentResourceRevision(state, resource) {
  const storageKey = {
    brief: "projectStorage",
    ov1: "ov1Storage",
    ov5: "ov5Storage",
    ooda: "oodaStorage",
    scenario: "scenarioStorage",
    validation: "validationStorage",
    knowledge: "knowledgeStorage",
    report: "reportStorage"
  }[resource];
  return Number(state[storageKey]?.resourceRevision || (resource === "brief" ? state.projectStorage?.revision : 0) || 0);
}
