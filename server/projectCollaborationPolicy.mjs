const ACTORS = [
  { id: "local-researcher", label: "本地研究员", roles: ["researcher", "reviewer"], capabilities: ["review.create"] },
  { id: "local-lead", label: "本地负责人", roles: ["researcher", "reviewer", "lead"], capabilities: ["review.create", "review.resolve"] }
];
const TRUSTED_ACTORS = new WeakMap();
let oidcRequired = false;
let identityPolicy = null;

export function setCollaborationOidcRequired(value) { oidcRequired = Boolean(value); }
export function setCollaborationIdentityPolicy(value) { identityPolicy = value?.enabled ? { mode: String(value.mode || "authenticated-policy"), authentication: String(value.authentication || "configured") } : null; oidcRequired = Boolean(value?.enabled); }
export function registerAuthenticatedCollaborationActor(input, actor) { if (input && actor) TRUSTED_ACTORS.set(input, actor); }

export function getCollaborationPolicy() {
  if (identityPolicy) return { mode: identityPolicy.mode, authentication: identityPolicy.authentication, authorization: "server-validated-roles", actors: [] };
  return {
    mode: "local-prototype-policy",
    authentication: "not-configured",
    authorization: "server-validated-static-roles",
    actors: ACTORS.map(({ id, label, roles }) => ({ id, label, roles }))
  };
}

export function requireCollaborationActor(input, capability) {
  const trusted = TRUSTED_ACTORS.get(input);
  if (trusted) {
    const roles = Array.isArray(trusted.roles) ? trusted.roles.map(String) : [];
    const capabilities = new Set([...(roles.some((role) => ["researcher", "reviewer", "lead"].includes(role)) ? ["review.create"] : []), ...(roles.includes("lead") ? ["review.resolve"] : [])]);
    if (!capabilities.has(capability)) { const error = new Error("Authenticated actor is not permitted for this collaboration action"); error.statusCode = 403; throw error; }
    return { id: String(trusted.id), label: String(trusted.label || trusted.id), roles };
  }
  if (oidcRequired) { const error = new Error("Authenticated collaboration identity is required"); error.statusCode = 403; throw error; }
  const actor = ACTORS.find((item) => item.id === String(input?.actorId || "").trim());
  if (!actor || !actor.capabilities.includes(capability)) {
    const error = new Error("Actor is not permitted for this collaboration action");
    error.statusCode = 403;
    throw error;
  }
  return { id: actor.id, label: actor.label, roles: [...actor.roles] };
}
