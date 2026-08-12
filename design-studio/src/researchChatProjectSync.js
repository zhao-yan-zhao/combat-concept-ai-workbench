import {
  getProjectRepositoryCapability,
  loadProjectResearchChats,
  saveProjectResearchChats
} from "./projectBriefClient.js";
import {
  normalizePhaseActionChat,
  persistPhaseActionChat
} from "./phaseActionChatStore.js";
import {
  normalizeForceMissionChat,
  persistForceMissionChat
} from "./forceMissionChatStore.js";
import {
  normalizeRuleLibraryChat,
  persistRuleLibraryChat
} from "./ruleLibraryChatStore.js";
import {
  normalizeSequenceChat,
  persistSequenceChat
} from "./sequenceChatStore.js";
import { stripPendingResearchChatTurns } from "./researchChat/index.js";

/**
 * Project-repository sync for step research chats (phase / force / rule).
 * Brief inspiration continues to travel with the brief API.
 * localStorage remains a write-through offline cache.
 */
export function createResearchChatProjectSync({
  projectId,
  getState,
  render = () => {}
}) {
  let repositoryEnabled = null;
  let pending = null;
  let draining = null;

  return {
    async hydrate({ forceRemote = false } = {}) {
      try {
        repositoryEnabled = await getProjectRepositoryCapability("researchChats");
      } catch {
        repositoryEnabled = false;
      }
      if (!repositoryEnabled) return { applied: false, reason: "disabled" };

      let remote;
      try {
        remote = await loadProjectResearchChats(projectId);
      } catch {
        return { applied: false, reason: "offline" };
      }

      const state = getState();
      const localModel = captureResearchChatsModel(state);

      if (!remote?.exists || !remote.model) {
        if (hasMeaningfulResearchChats(localModel)) {
          await this.sync(localModel, { source: "local-migrate", silent: true });
          return { applied: false, migrated: true };
        }
        return { applied: false, reason: "empty" };
      }

      const applied = applyRemoteResearchChats(state, remote.model, {
        projectId,
        force: forceRemote
      });
      if (applied) render();

      // If local still has exclusive content (local-draft-first), push merge upward.
      const after = captureResearchChatsModel(getState());
      if (!forceRemote && hasMeaningfulResearchChats(after) && !sameResearchChats(after, remote.model)) {
        await this.sync(after, { source: "local-merge", silent: true });
      }
      return { applied, reason: applied ? "remote" : "local-kept" };
    },

    /**
     * Queue a silent write of the current (or provided) chat bundle.
     * @param {object|null} model
     * @param {{ source?: string, silent?: boolean }} [options]
     */
    sync(model = null, { source = "research-chat", silent = true } = {}) {
      pending = {
        model: model || captureResearchChatsModel(getState()),
        source,
        silent: silent !== false
      };
      if (!draining) draining = drain();
      return draining;
    },

    /** Call after a turn completes/cancels in any step chat controller. */
    persistFromState(source = "research-chat") {
      return this.sync(null, { source, silent: true });
    }
  };

  async function drain() {
    try {
      while (pending) {
        const next = pending;
        pending = null;
        if (repositoryEnabled === null) {
          try {
            repositoryEnabled = await getProjectRepositoryCapability("researchChats");
          } catch {
            repositoryEnabled = false;
          }
        }
        if (!repositoryEnabled) continue;
        try {
          await saveProjectResearchChats(projectId, {
            model: next.model,
            source: next.source
          });
        } catch {
          /* keep localStorage; retry on next turn */
        }
      }
    } finally {
      draining = null;
      if (pending) {
        draining = drain();
        await draining;
      }
    }
  }
}

export function captureResearchChatsModel(state = {}) {
  return {
    version: 1,
    phaseAction: toDurableSession(state.phaseActionChat),
    forceMission: toDurableSession(state.forceMissionChat),
    ruleLibrary: toDurableSession(state.ruleLibraryChat),
    sequence: toDurableSession(state.sequenceChat)
  };
}

export function applyRemoteResearchChats(state, model = {}, { projectId, force = false } = {}) {
  let applied = false;
  const remote = model && typeof model === "object" ? model : {};

  if (shouldApplySession(state.phaseActionChat, remote.phaseAction, force)) {
    state.phaseActionChat = persistPhaseActionChat(
      normalizePhaseActionChat(remote.phaseAction || { messages: [] }),
      projectId
    );
    applied = true;
  }
  if (shouldApplySession(state.forceMissionChat, remote.forceMission, force)) {
    state.forceMissionChat = persistForceMissionChat(
      normalizeForceMissionChat(remote.forceMission || { messages: [] }),
      projectId
    );
    applied = true;
  }
  if (shouldApplySession(state.ruleLibraryChat, remote.ruleLibrary, force)) {
    state.ruleLibraryChat = persistRuleLibraryChat(
      normalizeRuleLibraryChat(remote.ruleLibrary || { messages: [] }),
      projectId
    );
    applied = true;
  }
  if (shouldApplySession(state.sequenceChat, remote.sequence, force)) {
    state.sequenceChat = persistSequenceChat(
      normalizeSequenceChat(remote.sequence || { messages: [] }),
      projectId
    );
    applied = true;
  }
  return applied;
}

function shouldApplySession(localSession, remoteSession, force) {
  if (!remoteSession?.messages?.length) return false;
  if (force) return true;
  // Prefer remote when local is empty / welcome-only; keep richer local drafts otherwise.
  if (!hasUserTurns(localSession)) return true;
  return false;
}

function toDurableSession(session) {
  if (!session || typeof session !== "object") return null;
  const stripped = stripPendingResearchChatTurns(session);
  const messages = Array.isArray(stripped.messages) ? stripped.messages : [];
  if (!messages.length) return null;
  return {
    version: 1,
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      topic: message.topic,
      source: message.source,
      text: message.text,
      truncated: Boolean(message.truncated),
      createdAt: message.createdAt
    }))
  };
}

function hasMeaningfulResearchChats(model = {}) {
  return hasUserTurns(model.phaseAction)
    || hasUserTurns(model.forceMission)
    || hasUserTurns(model.ruleLibrary)
    || hasUserTurns(model.sequence);
}

function hasUserTurns(session) {
  return (session?.messages || []).some((message) => message?.role === "user" && String(message.text || "").trim());
}

function sameResearchChats(left, right) {
  try {
    return JSON.stringify(left || {}) === JSON.stringify(right || {});
  } catch {
    return false;
  }
}
