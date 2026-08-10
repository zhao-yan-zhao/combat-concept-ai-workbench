import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = "combat_collaboration_session";
const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
const MAX_SECURITY_EVENTS = 120;
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_MS = 10 * 60 * 1000;

export function createLocalIdentityAdapter({ filePath, databasePath = "", sessionSecret = "", secureCookies = false, now = () => Date.now(), random = randomBytes } = {}) {
  if (!filePath) throw new Error("Local identity file path is required");
  const secret = sessionSecret || random(32).toString("base64url");
  const persistence = createIdentityPersistence({ filePath, databasePath, random });
  let writeChain = Promise.resolve();
  const loginFailures = new Map();

  return {
    getStatus() { return { mode: "local-managed-accounts", enabled: true, authentication: "local-password-session", secureCookies: Boolean(secureCookies), storage: persistence.kind }; },
    async getSession(request) {
      const claims = await readSession(request);
      return { authenticated: Boolean(claims), actor: claims ? publicActor(claims) : null, setupRequired: (await readStore()).users.length === 0 };
    },
    async authenticate(request) {
      const claims = await readSession(request);
      if (!claims) throw forbidden("Collaboration login is required");
      return publicActor(claims);
    },
    async setup(input) {
      return enqueue(async () => {
        const store = await readStore();
        if (store.users.length) throw conflict("Local collaboration accounts are already initialized");
        const user = await createUser(input, ["researcher", "reviewer", "lead"], now);
        recordEvent(store, { action: "account.initialized", actor: user, subject: user });
        await writeStore({ ...store, users: [user] });
        return publicActor(user);
      });
    },
    async login(input) {
      return enqueue(async () => {
        const username = normalizeUsername(input?.username);
        const password = String(input?.password || "");
        assertLoginAllowed(username);
        const store = await readStore();
        const user = store.users.find((item) => item.username === username);
        if (!user || !user.enabled || !await passwordMatches(password, user)) {
          recordLoginFailure(username);
          throw forbidden("Invalid username or password");
        }
        loginFailures.delete(username);
        recordEvent(store, { action: "session.login", actor: user, subject: user });
        await writeStore(store);
        return { actor: publicActor(user), cookie: createCookie(signSession(user)) };
      });
    },
    async createAccount(request, input) {
      const requester = await this.authenticate(request);
      if (!requester.roles.includes("lead")) throw forbidden("Only a lead can create collaboration accounts");
      return enqueue(async () => {
        const store = await readStore();
        const username = normalizeUsername(input?.username);
        if (store.users.some((item) => item.username === username)) throw conflict("Username is already in use");
        const roles = normalizeRoles(input?.roles);
        const user = await createUser(input, roles, now);
        store.users.push(user);
        recordEvent(store, { action: "account.created", actor: requester, subject: user });
        await writeStore(store);
        return publicActor(user);
      });
    },
    async register(input) {
      return enqueue(async () => {
        const store = await readStore();
        if (!store.users.length) throw conflict("Initialize a lead account before registering users");
        const username = normalizeUsername(input?.username);
        if (store.users.some((item) => item.username === username)) throw conflict("Username is already in use");
        const user = await createUser({ ...input, username }, ["researcher"], now);
        store.users.push(user);
        recordEvent(store, { action: "account.registered", actor: user, subject: user });
        await writeStore(store);
        return publicActor(user);
      });
    },
    async listAccounts(request) {
      await getLead(request);
      return (await readStore()).users.map(publicAccount);
    },
    async listSecurityEvents(request, limit = 50) {
      await getLead(request);
      const maximum = Math.min(100, Math.max(1, Number(limit) || 50));
      return (await readStore()).events.slice(0, maximum);
    },
    async updateAccount(request, username, input) {
      const requester = await getLead(request);
      return enqueue(async () => {
        const store = await readStore();
        const targetUsername = normalizeUsername(username);
        const target = store.users.find((item) => item.username === targetUsername);
        if (!target) throw conflict("Collaboration account was not found");
        const change = String(input?.change || "");
        if (change === "enabled") {
          const enabled = Boolean(input?.enabled);
          if (!enabled && target.id === requester.id) throw conflict("A lead cannot disable the current account");
          if (!enabled && target.roles.includes("lead") && store.users.filter((item) => item.enabled && item.roles.includes("lead")).length <= 1) throw conflict("At least one enabled lead account is required");
          target.enabled = enabled;
          target.sessionVersion += 1;
          recordEvent(store, { action: enabled ? "account.enabled" : "account.disabled", actor: requester, subject: target });
        } else if (change === "password") {
          const password = String(input?.password || "");
          if (password.length < 12 || password.length > 256) throw new Error("Password must contain 12 to 256 characters");
          target.salt = randomBytes(16).toString("base64url");
          target.passwordHash = (await scrypt(password, target.salt, 64)).toString("base64url");
          target.sessionVersion += 1;
          recordEvent(store, { action: "account.password_reset", actor: requester, subject: target });
        } else {
          throw new Error("Unsupported collaboration account change");
        }
        await writeStore(store);
        return publicAccount(target);
      });
    },
    logoutCookie() { return `${COOKIE_NAME}=; Path=/api; HttpOnly; SameSite=Strict${secureCookies ? "; Secure" : ""}; Max-Age=0`; },
    close() { persistence.close?.(); }
  };

  async function getLead(request) {
    const user = await readSession(request);
    if (!user || !user.roles.includes("lead")) throw forbidden("Only a lead can manage collaboration accounts");
    return publicActor(user);
  }

  async function readSession(request) {
    const token = parseCookie(request?.headers?.cookie)[COOKIE_NAME];
    if (!token) return null;
    const [encoded, signature] = String(token).split(".");
    if (!encoded || !signature || !safeEqual(signature, sign(encoded))) return null;
    const claims = decode(encoded);
    if (!claims || Number(claims.exp || 0) <= now() || !claims.id) return null;
    const user = (await readStore()).users.find((item) => item.id === claims.id && item.enabled && item.sessionVersion === claims.version);
    return user || null;
  }

  function signSession(user) {
    const payload = Buffer.from(JSON.stringify({ id: user.id, version: user.sessionVersion, exp: now() + SESSION_LIFETIME_MS })).toString("base64url");
    return `${payload}.${sign(payload)}`;
  }
  function assertLoginAllowed(username) {
    const state = loginFailures.get(username);
    if (!state) return;
    const timestamp = now();
    if (state.lockedUntil > timestamp) throw throttled("Login is temporarily unavailable");
    if (timestamp - state.firstFailureAt > LOGIN_FAILURE_WINDOW_MS) loginFailures.delete(username);
  }
  function recordLoginFailure(username) {
    const timestamp = now();
    const current = loginFailures.get(username);
    const state = !current || timestamp - current.firstFailureAt > LOGIN_FAILURE_WINDOW_MS
      ? { firstFailureAt: timestamp, count: 1, lockedUntil: 0 }
      : { ...current, count: current.count + 1 };
    if (state.count >= LOGIN_FAILURE_LIMIT) state.lockedUntil = timestamp + LOGIN_LOCK_MS;
    loginFailures.set(username, state);
  }
  function sign(value) { return createHmac("sha256", secret).update(value).digest("base64url"); }
  function createCookie(token) { return `${COOKIE_NAME}=${token}; Path=/api; HttpOnly; SameSite=Strict${secureCookies ? "; Secure" : ""}; Max-Age=${Math.floor(SESSION_LIFETIME_MS / 1000)}`; }
  async function readStore() {
    try {
      return normalizeStore(await persistence.read());
    } catch (error) {
      if (error?.code === "ENOENT") return { schemaVersion: 1, users: [], events: [] };
      throw new Error("Local collaboration identity store cannot be read");
    }
  }
  async function writeStore(store) {
    await persistence.write(store);
  }
  function enqueue(task) { const next = writeChain.then(task, task); writeChain = next.catch(() => {}); return next; }

  function recordEvent(store, { action, actor, subject }) {
    const event = { id: `security-${random(8).toString("base64url")}`, action, occurredAt: new Date(now()).toISOString(), actor: publicActor(actor), subject: publicActor(subject) };
    store.events = [event, ...(store.events || [])].slice(0, MAX_SECURITY_EVENTS);
  }
}

function createIdentityPersistence({ filePath, databasePath, random }) {
  if (!databasePath) {
    return {
      kind: "file",
      async read() { return JSON.parse(await readFile(filePath, "utf8")); },
      async write(store) {
        await mkdir(dirname(filePath), { recursive: true });
        const temporary = `${filePath}.${process.pid}.${random(6).toString("hex")}.tmp`;
        await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
        await rename(temporary, filePath);
      }
    };
  }
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec("CREATE TABLE IF NOT EXISTS collaboration_identity_store (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL, updated_at TEXT NOT NULL)");
  const read = database.prepare("SELECT payload FROM collaboration_identity_store WHERE id = 1");
  const write = database.prepare("INSERT INTO collaboration_identity_store (id, payload, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at");
  // One-time bootstrap: empty identity DB inherits JSON file, then all identity data stays in SQLite.
  try {
    if (!read.get()?.payload && filePath && existsSync(filePath)) {
      const source = JSON.parse(readFileSync(filePath, "utf8"));
      if (source && typeof source === "object") write.run(JSON.stringify(source), new Date().toISOString());
    }
  } catch {
    // Leave empty; setup flow will create the first account in SQLite.
  }
  return {
    kind: "sqlite",
    async read() {
      const row = read.get();
      if (!row?.payload) { const error = new Error("Identity store is empty"); error.code = "ENOENT"; throw error; }
      return JSON.parse(row.payload);
    },
    async write(store) { write.run(JSON.stringify(store), new Date().toISOString()); },
    close() { database.close(); }
  };
}

function normalizeStore(parsed) {
  return { schemaVersion: 1, users: Array.isArray(parsed?.users) ? parsed.users.map(normalizeStoredUser).filter(Boolean) : [], events: Array.isArray(parsed?.events) ? parsed.events.map(normalizeSecurityEvent).filter(Boolean).slice(0, MAX_SECURITY_EVENTS) : [] };
}

async function createUser(input, defaultRoles, now) {
  const password = String(input?.password || "");
  if (password.length < 12 || password.length > 256) throw new Error("Password must contain 12 to 256 characters");
  const salt = randomBytes(16).toString("base64url");
  const passwordHash = (await scrypt(password, salt, 64)).toString("base64url");
  const username = normalizeUsername(input?.username);
  return { id: `local-${randomBytes(12).toString("base64url")}`, username, label: clean(input?.label || username, 80), roles: defaultRoles, enabled: true, salt, passwordHash, sessionVersion: 1, createdAt: new Date(now()).toISOString() };
}

function normalizeStoredUser(value) {
  const username = normalizeUsername(value?.username, true);
  const id = clean(value?.id, 160);
  const salt = clean(value?.salt, 160);
  const passwordHash = clean(value?.passwordHash, 160);
  if (!id || !username || !salt || !passwordHash) return null;
  return { id, username, label: clean(value?.label || username, 80), roles: normalizeRoles(value?.roles), enabled: value?.enabled !== false, salt, passwordHash, sessionVersion: Math.max(1, Number(value?.sessionVersion || 1)), createdAt: clean(value?.createdAt, 80) };
}
function normalizeUsername(value, allowEmpty = false) { const username = String(value || "").trim().toLowerCase(); if ((allowEmpty && !username) || /^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) return username; throw new Error("Username must be 3 to 64 lowercase letters, numbers, dot, dash, or underscore"); }
function normalizeRoles(value) { const roles = [...new Set((Array.isArray(value) ? value : [value]).map((item) => String(item).trim()).filter((item) => ["researcher", "reviewer", "lead"].includes(item)))]; return roles.includes("lead") ? ["researcher", "reviewer", "lead"] : roles.includes("reviewer") || roles.includes("researcher") ? ["researcher", "reviewer"] : ["researcher", "reviewer"]; }
function publicActor(user) { return { id: user.id, label: user.label, roles: [...user.roles] }; }
function publicAccount(user) { return { ...publicActor(user), username: user.username, enabled: user.enabled, createdAt: user.createdAt }; }
function normalizeSecurityEvent(value) {
  const action = clean(value?.action, 80);
  const actor = normalizeEventActor(value?.actor);
  const subject = normalizeEventActor(value?.subject);
  if (!action || !actor || !subject) return null;
  return { id: clean(value?.id, 120), action, occurredAt: clean(value?.occurredAt, 80), actor, subject };
}
function normalizeEventActor(value) { const id = clean(value?.id, 160); return id ? { id, label: clean(value?.label || id, 80), roles: normalizeRoles(value?.roles) } : null; }
async function passwordMatches(password, user) { const actual = Buffer.from(user.passwordHash, "base64url"); const expected = await scrypt(password, user.salt, actual.length); return actual.length === expected.length && timingSafeEqual(actual, expected); }
function parseCookie(header) { return Object.fromEntries(String(header || "").split(";").map((part) => part.trim().split(/=(.*)/s)).filter(([key, value]) => key && value)); }
function decode(value) { try { return JSON.parse(Buffer.from(value, "base64url").toString("utf8")); } catch { return null; } }
function safeEqual(left, right) { const a = Buffer.from(String(left)); const b = Buffer.from(String(right)); return a.length === b.length && timingSafeEqual(a, b); }
function clean(value, maximum) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum); }
function forbidden(message) { const error = new Error(message); error.statusCode = 403; return error; }
function conflict(message) { const error = new Error(message); error.statusCode = 409; return error; }
function throttled(message) { const error = new Error(message); error.statusCode = 429; return error; }
