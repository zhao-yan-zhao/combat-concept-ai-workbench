import { readJson, sendJson } from "../httpUtils.mjs";

export function createCollaborationAuthHandlers(runtime) {
  const { localIdentity } = runtime;

  async function handleCollaborationSession(request, response) {
    try {
      sendJson(response, 200, await localIdentity.getSession(request));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Collaboration session request is invalid" });
    }
  }

  async function handleCollaborationSetup(request, response) {
    try {
      const input = await readJson(request);
      const actor = await localIdentity.setup(input);
      const session = await localIdentity.login(input);
      sendJson(response, 201, { authenticated: true, actor, setupRequired: false }, { "Set-Cookie": session.cookie });
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Collaboration setup request is invalid" });
    }
  }

  async function handleCollaborationLogin(request, response) {
    try {
      const session = await localIdentity.login(await readJson(request));
      sendJson(response, 200, { authenticated: true, actor: session.actor, setupRequired: false }, { "Set-Cookie": session.cookie });
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Collaboration login request is invalid" });
    }
  }

  async function handleCollaborationRegister(request, response) {
    try {
      const input = await readJson(request);
      await localIdentity.register(input);
      const session = await localIdentity.login(input);
      sendJson(response, 201, { authenticated: true, actor: session.actor, setupRequired: false }, { "Set-Cookie": session.cookie });
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Collaboration registration is invalid" });
    }
  }

  async function handleCollaborationAccounts(request, response) {
    try {
      if (request.method === "GET") {
        sendJson(response, 200, { accounts: await localIdentity.listAccounts(request) });
        return;
      }
      const actor = await localIdentity.createAccount(request, await readJson(request));
      sendJson(response, 201, { actor });
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Collaboration account request is invalid" });
    }
  }

  async function handleCollaborationAccountUpdate(request, response, username) {
    try {
      sendJson(response, 200, { account: await localIdentity.updateAccount(request, username, await readJson(request)) });
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Collaboration account update request is invalid" });
    }
  }

  async function handleCollaborationSecurityEvents(request, response, limit) {
    try {
      sendJson(response, 200, { events: await localIdentity.listSecurityEvents(request, limit) });
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Collaboration security-event request is invalid" });
    }
  }

  return {
    handleCollaborationSession,
    handleCollaborationSetup,
    handleCollaborationLogin,
    handleCollaborationRegister,
    handleCollaborationAccounts,
    handleCollaborationAccountUpdate,
    handleCollaborationSecurityEvents
  };
}
