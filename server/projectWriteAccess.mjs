export function createProjectWriteAuthorizer({ enabled = false, authenticate } = {}) {
  const active = Boolean(enabled && typeof authenticate === "function");
  return {
    getStatus() { return { mode: "authenticated-project-writes", enabled: active, authentication: active ? "local-password-session" : "not-required" }; },
    async authorize(request) {
      if (!active) return null;
      const actor = await authenticate(request);
      if (Array.isArray(actor?.roles) && actor.roles.some((role) => ["researcher", "reviewer", "lead"].includes(role))) return actor;
      const error = new Error("Authenticated actor is not permitted to modify project data");
      error.statusCode = 403;
      throw error;
    }
  };
}
