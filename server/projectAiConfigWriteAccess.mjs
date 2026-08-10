export function createAiConfigWriteAuthorizer({ enabled = false, authenticate } = {}) {
  const active = Boolean(enabled && typeof authenticate === "function");
  return {
    getStatus() {
      return {
        mode: "lead-controlled-ai-config",
        enabled: active,
        authentication: active ? "local-password-session" : "disabled"
      };
    },
    async authorize(request) {
      if (!active) throw forbidden("AI service configuration writes are disabled by deployment policy");
      const actor = await authenticate(request);
      if (Array.isArray(actor?.roles) && actor.roles.includes("lead")) return actor;
      throw forbidden("Only an authenticated lead can change AI service configuration");
    }
  };
}

function forbidden(message) {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
}
