import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalIdentityAdapter } from "../server/projectLocalIdentity.mjs";
import { createFileProjectRepository } from "../server/projectRepository.mjs";
import { registerAuthenticatedCollaborationActor, setCollaborationIdentityPolicy } from "../server/projectCollaborationPolicy.mjs";
import { renderCollaborationLoginGate } from "../design-studio/src/collaborationView.js";

const directory = await mkdtemp(join(tmpdir(), "combat-concept-local-identity-"));
let time = Date.parse("2026-07-14T00:00:00.000Z");
const identity = createLocalIdentityAdapter({ filePath: join(directory, "identities.json"), sessionSecret: "acceptance-session-secret", now: () => time });
const repository = createFileProjectRepository({ filePath: join(directory, "projects.json"), now: () => new Date(time += 1000).toISOString() });
setCollaborationIdentityPolicy(identity.getStatus());

try {
  const loginGate = renderCollaborationLoginGate({ status: "ready", session: { authenticated: false, setupRequired: false } });
  assert(loginGate.includes('id="collaborationLoginForm"') && !loginGate.includes('id="collaborationRegisterForm"'), "Login gate should mount only the login form by default");
  assert(loginGate.includes('method="post" action="/api/collaboration/auth/login"') && loginGate.includes('name="username" autocomplete="username"') && loginGate.includes('name="password" type="password" autocomplete="current-password"'), "Login fields are missing browser password-manager semantics");
  const registerGate = renderCollaborationLoginGate({ status: "ready", session: { authenticated: false, setupRequired: false }, authMode: "register" });
  assert(registerGate.includes('id="collaborationRegisterForm"') && !registerGate.includes('id="collaborationLoginForm"'), "Register mode should mount only the registration form");
  assert(registerGate.includes('method="post" action="/api/collaboration/auth/register"') && registerGate.includes('name="label" autocomplete="name"') && registerGate.includes('autocomplete="new-password"'), "Registration fields are missing browser autofill semantics");
  const firstSession = await identity.getSession({ headers: {} });
  assert(firstSession.setupRequired && !firstSession.authenticated, "First-run identity state was not disclosed");
  const lead = await identity.setup({ username: "research-lead", label: "Research lead", password: "correct-horse-local" });
  assert(lead.roles.includes("lead"), "First local account was not assigned lead role");
  const serialized = await readFile(join(directory, "identities.json"), "utf8");
  assert(!serialized.includes("correct-horse-local") && serialized.includes("passwordHash"), "Password was not stored as a salted hash");
  const leadLogin = await identity.login({ username: "research-lead", password: "correct-horse-local" });
  const leadRequest = { headers: { cookie: cookiePair(leadLogin.cookie) } };
  assert((await identity.authenticate(leadRequest)).id === lead.id, "Signed local session was not accepted");
  const secureIdentity = createLocalIdentityAdapter({ filePath: join(directory, "secure-identities.json"), sessionSecret: "secure-cookie-test", secureCookies: true, now: () => time });
  await secureIdentity.setup({ username: "secure-lead", label: "Secure lead", password: "secure-cookie-password" });
  const secureLogin = await secureIdentity.login({ username: "secure-lead", password: "secure-cookie-password" });
  assert(secureIdentity.getStatus().secureCookies && secureLogin.cookie.includes("; Secure;") && secureIdentity.logoutCookie().includes("; Secure;"), "Deployment secure-cookie option was not applied");
  const sqlitePath = join(directory, "identities.sqlite");
  const sqliteIdentity = createLocalIdentityAdapter({ filePath: join(directory, "unused-identities.json"), databasePath: sqlitePath, sessionSecret: "sqlite-identity-test", now: () => time });
  await sqliteIdentity.setup({ username: "sqlite-lead", label: "SQLite lead", password: "sqlite-identity-password" });
  const sqliteReopened = createLocalIdentityAdapter({ filePath: join(directory, "unused-reopened.json"), databasePath: sqlitePath, sessionSecret: "sqlite-identity-test", now: () => time });
  assert(sqliteReopened.getStatus().storage === "sqlite" && (await sqliteReopened.login({ username: "sqlite-lead", password: "sqlite-identity-password" })).actor.label === "SQLite lead", "SQLite identity persistence did not survive adapter recreation");
  sqliteIdentity.close();
  sqliteReopened.close();
  const researcher = await identity.createAccount(leadRequest, { username: "reviewer-01", label: "Reviewer", password: "reviewer-password", roles: ["researcher"] });
  const researcherLogin = await identity.login({ username: "reviewer-01", password: "reviewer-password" });
  const researcherRequest = { headers: { cookie: cookiePair(researcherLogin.cookie) } };
  const accounts = await identity.listAccounts(leadRequest);
  assert(accounts.length === 2 && accounts.every((item) => item.enabled) && !JSON.stringify(accounts).includes("passwordHash"), "Lead account list exposed unsafe fields or omitted active accounts");
  const initialEvents = await identity.listSecurityEvents(leadRequest);
  assert(initialEvents.some((item) => item.action === "account.initialized") && initialEvents.some((item) => item.action === "account.created") && !JSON.stringify(initialEvents).includes("correct-horse-local") && !JSON.stringify(initialEvents).includes("passwordHash"), "Identity security events were incomplete or exposed credentials");
  const registered = await identity.register({ username: "researcher-02", label: "Registered researcher", password: "registered-password" });
  assert(!registered.roles.includes("lead") && (await identity.login({ username: "researcher-02", password: "registered-password" })).actor.id === registered.id, "Public registration did not create a non-lead account with a valid login");
  assert((await identity.listSecurityEvents(leadRequest)).some((item) => item.action === "account.registered"), "Public registration was not recorded as a security event");
  await assertRejects(() => identity.listSecurityEvents(researcherRequest), 403, "Non-lead could read identity security events");
  const brief = await repository.saveBrief("default", { direction: "Review", source: "manual", brief: { objective: "Identity", approach: "Review", assumptions: "Local", risk: "Session" } });
  const current = await repository.getCollaboration("default");
  const reviewInput = { actorId: "local-lead", clientId: "review-local-auth", resource: "brief", resourceRevision: brief.resourceRevision, disposition: "comment", summary: "Authenticated reviewer note", expectedRevision: current.revision };
  registerAuthenticatedCollaborationActor(reviewInput, await identity.authenticate(researcherRequest));
  const reviewed = await repository.createCollaborationReview("default", reviewInput);
  assert(reviewed.review.actor.id === researcher.id, "Request body actorId overrode the authenticated identity");
  const deniedInput = { actorId: lead.id, outcome: "accepted", summary: "Spoofed lead decision", expectedRevision: reviewed.revision };
  registerAuthenticatedCollaborationActor(deniedInput, await identity.authenticate(researcherRequest));
  await assertRejects(() => repository.resolveCollaborationReview("default", reviewed.review.id, deniedInput), 403, "Researcher was allowed to resolve a review");
  const decisionInput = { actorId: researcher.id, outcome: "accepted", summary: "Lead decision", expectedRevision: reviewed.revision };
  registerAuthenticatedCollaborationActor(decisionInput, await identity.authenticate(leadRequest));
  const resolved = await repository.resolveCollaborationReview("default", reviewed.review.id, decisionInput);
  assert(resolved.decision.actor.id === lead.id && resolved.decision.outcome === "accepted", "Lead session could not resolve the review");
  await assertRejects(() => identity.updateAccount(leadRequest, "research-lead", { change: "enabled", enabled: false }), 409, "The last active lead account could be disabled");
  await identity.updateAccount(leadRequest, "reviewer-01", { change: "enabled", enabled: false });
  await assertRejects(() => identity.authenticate(researcherRequest), 403, "Disabled account retained its session");
  await assertRejects(() => identity.login({ username: "reviewer-01", password: "reviewer-password" }), 403, "Disabled account could log in");
  await identity.updateAccount(leadRequest, "reviewer-01", { change: "enabled", enabled: true });
  const renewedLogin = await identity.login({ username: "reviewer-01", password: "reviewer-password" });
  const renewedRequest = { headers: { cookie: cookiePair(renewedLogin.cookie) } };
  await identity.updateAccount(leadRequest, "reviewer-01", { change: "password", password: "renewed-reviewer-password" });
  await assertRejects(() => identity.authenticate(renewedRequest), 403, "Password reset retained its prior session");
  await assertRejects(() => identity.login({ username: "reviewer-01", password: "reviewer-password" }), 403, "Prior password remained valid after reset");
  assert((await identity.login({ username: "reviewer-01", password: "renewed-reviewer-password" })).actor.id === researcher.id, "New password was not accepted");
  const finalEvents = await identity.listSecurityEvents(leadRequest);
  assert(finalEvents.some((item) => item.action === "account.disabled") && finalEvents.some((item) => item.action === "account.enabled") && finalEvents.some((item) => item.action === "account.password_reset") && finalEvents.length <= 120, "Identity lifecycle changes were not auditable");
  await assertRejects(() => identity.login({ username: "research-lead", password: "wrong-password" }), 403, "Invalid password was accepted");
  for (let attempt = 0; attempt < 4; attempt += 1) await assertRejects(() => identity.login({ username: "research-lead", password: "wrong-password" }), 403, "Failed login was not rejected");
  await assertRejects(() => identity.login({ username: "research-lead", password: "wrong-password" }), 429, "Repeated failed logins were not throttled");
  const afterThrottle = await readFile(join(directory, "identities.json"), "utf8");
  assert(!afterThrottle.includes("wrong-password") && !afterThrottle.includes("login.failed"), "Failed login details were persisted or audited");
  time += 10 * 60 * 1000 + 1;
  assert((await identity.login({ username: "research-lead", password: "correct-horse-local" })).actor.id === lead.id, "Login remained throttled after the bounded lock interval");
  console.log(`Local collaboration identity acceptance passed: ${researcher.label} review, ${lead.label} decision.`);
} finally {
  await rm(directory, { recursive: true, force: true });
}

function cookiePair(cookie) { return String(cookie).split(";")[0]; }
async function assertRejects(run, status, message) { try { await run(); } catch (error) { if (error?.statusCode === status) return; } throw new Error(message); }
function assert(condition, message) { if (!condition) throw new Error(message); }
