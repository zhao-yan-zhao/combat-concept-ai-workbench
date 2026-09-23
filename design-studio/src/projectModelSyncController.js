import { getProjectRepositoryCapability } from "./projectBriefClient.js";
import { createProjectWriteFailureState } from "./projectWriteFailureState.js";
import { getProjectConflictDraftState, loadProjectConflictDraft, saveProjectConflictDraft } from "./projectConflictDraftStore.js";

export function createProjectModelSyncController({
  projectId,
  resource,
  storageKey,
  resourceLabel,
  load,
  save,
  getState,
  render,
  notify,
  applyRemote,
  conflictRecovery = null,
  onSaved = null
}) {
  let repositoryEnabled = null;
  let pending = null;
  let draining = null;
  const setStorage = (state, value) => {
    state[storageKey] = { ...value, ...getProjectConflictDraftState(resource) };
  };

  return {
    async hydrate({ interactive = false, forceRemote = false, silent = false } = {}) {
      const state = getState();
      if (!silent) {
        setStorage(state, { ...state[storageKey], status: "checking" });
        render();
      } else {
        setStorage(state, { ...state[storageKey], status: "checking" });
      }
      try {
        repositoryEnabled = await getProjectRepositoryCapability(resource);
        if (!repositoryEnabled) {
          setStorage(state, createDisabledState(resourceLabel));
          if (interactive) notify(`Current service does not provide ${resourceLabel} project storage.`);
          return;
        }
        const remote = await load(projectId);
        if (forceRemote && remote.exists) saveRecovery(state);
        const applied = remote.exists && !remote.stale ? applyRemote(remote, { force: forceRemote }) : false;
        setStorage(state, createReadyState(remote, resourceLabel, applied));
        state.projectRevision = Math.max(Number(state.projectRevision || 0), Number(remote.revision || 0));
        if (interactive && remote.exists) {
          if (remote.stale) notify(`The server ${resourceLabel} is based on an older upstream model and was not loaded.`);
          else notify(applied ? `已载入 ${resourceLabel} 服务端修订 r${remote.revision}` : `已保留本地 ${resourceLabel}；可显式载入服务端修订。`);
        }
      } catch {
        setStorage(state, createOfflineState(resourceLabel));
        if (interactive) notify(`${resourceLabel} project storage is unavailable; local work remains available.`);
      } finally {
        if (!silent) render();
      }
    },

    sync(model, { source = "manual", silent = false } = {}) {
      pending = { model: clone(model), source, silent: Boolean(silent) };
      if (!draining) draining = drain();
      return draining;
    },

    handleAction(action) {
      if (action === `refresh-project-${resource}`) {
        void this.hydrate({ interactive: true });
        return true;
      }
      if (action === `restore-project-${resource}-conflict-draft`) {
        const state = getState();
        const draft = loadProjectConflictDraft(resource);
        if (!draft || !conflictRecovery?.restore) return true;
        conflictRecovery.restore(draft.model);
        setStorage(state, {
          status: "recovery",
          mode: "local",
          label: `${resourceLabel} local conflict draft restored`,
          detail: `Restored browser-local draft saved at ${draft.savedAt}; it has not been submitted to the server.`,
          revision: Number(state.projectRevision || 0),
          resourceRevision: Number(state[storageKey]?.resourceRevision || 0),
          remoteAvailable: true
        });
        render();
        notify(`${resourceLabel} local conflict draft restored; review before submitting.`);
        return true;
      }
      if (action !== `load-project-${resource}`) return false;
      void this.hydrate({ interactive: true, forceRemote: true });
      return true;
    }
  };

  async function drain() {
    try {
      while (pending) {
        const next = pending;
        pending = null;
        let failed = false;
        const state = getState();
        if (repositoryEnabled === null) {
          try {
            repositoryEnabled = await getProjectRepositoryCapability(resource);
          } catch {
            repositoryEnabled = false;
          }
        }
        if (!repositoryEnabled) {
          setStorage(state, createDisabledState(resourceLabel));
          // Silent live-sync must not rebuild the whole studio shell.
          if (!next.silent) render();
          continue;
        }
        setStorage(state, { ...state[storageKey], status: "saving", mode: "server", label: `Syncing ${resourceLabel}` });
        if (!next.silent) render();
        try {
          const remote = await save(projectId, {
            model: next.model,
            source: next.source,
            expectedRevision: Math.max(Number(state.projectRevision || 0), Number(state[storageKey]?.revision || 0))
          });
          setStorage(state, createReadyState(remote, resourceLabel, true));
          state.projectRevision = Math.max(Number(state.projectRevision || 0), Number(remote.revision || 0));
          if (!next.silent) {
            try { await onSaved?.({ resource, source: next.source, remote }); } catch {}
          }
        } catch (error) {
          failed = true;
          if (error?.status === 409) {
            pending = null;
            saveRecovery(state, next.model);
            setStorage(state, {
              status: "conflict",
              mode: "local",
              label: `${resourceLabel} conflict`,
              detail: "The server has a newer project revision. Refresh before choosing whether to replace the local model.",
              conflict: true
            });
          } else {
            setStorage(state, createProjectWriteFailureState(error, resourceLabel, () => createOfflineState(resourceLabel)));
          }
        }
        // Always surface conflicts/errors; success can stay silent for live map edits.
        if (!next.silent || failed) render();
      }
    } finally {
      draining = null;
    }
  }

  function saveRecovery(state, model = undefined) {
    if (!conflictRecovery?.capture && model === undefined) return null;
    return saveProjectConflictDraft({
      resource,
      projectRevision: Number(state.projectRevision || state[storageKey]?.revision || 0),
      model: model === undefined ? conflictRecovery.capture() : model
    });
  }
}

function createReadyState(remote, resourceLabel, applied) {
  if (!remote.exists) {
    return {
      status: "ready",
      mode: "server",
      label: `${resourceLabel} storage ready`,
      detail: `No server ${resourceLabel} revision yet; project r${remote.revision || 0}.`,
      revision: remote.revision || 0,
      resourceRevision: 0,
      auditCount: remote.auditCount || 0
    };
  }
  if (remote.stale) {
    return {
      status: "stale",
      mode: "local",
      label: `${resourceLabel} source is stale`,
      detail: `Server revision r${remote.revision} remains preserved for audit but does not match its upstream model.`,
      revision: remote.revision,
      resourceRevision: remote.resourceRevision,
      auditCount: remote.auditCount || 0,
      updatedAt: remote.updatedAt,
      stale: true
    };
  }
  return {
    status: "ready",
    mode: "server",
    label: `${resourceLabel} r${remote.revision}`,
    detail: applied ? formatLineage(remote) : "A server revision is available; the local model remains preferred.",
    revision: remote.revision,
    resourceRevision: remote.resourceRevision,
    auditCount: remote.auditCount || 0,
    updatedAt: remote.updatedAt,
    remoteAvailable: !applied,
    ...pickLineage(remote)
  };
}

function createDisabledState(resourceLabel) {
  return { status: "local", mode: "local", label: `Local ${resourceLabel}`, detail: `Current service does not provide ${resourceLabel} project storage.` };
}

function createOfflineState(resourceLabel) {
  return { status: "offline", mode: "local", label: `Local ${resourceLabel}`, detail: "Server synchronization failed; the local model remains saved." };
}

function formatLineage(remote) {
  const values = [];
  if (remote.briefRevision !== undefined) values.push(`brief r${remote.briefRevision}`);
  if (remote.ov5Revision !== undefined) values.push(`OV-5 r${remote.ov5Revision}`);
  if (remote.oodaRevision !== undefined) values.push(`OODA r${remote.oodaRevision}`);
  if (remote.scenarioRevision !== undefined) values.push(`scenario r${remote.scenarioRevision}`);
  return values.length ? `Synchronized current model; ${values.join(" / ")}.` : "Synchronized current model.";
}

function pickLineage(remote) {
  return ["briefRevision", "ov5Revision", "oodaRevision", "scenarioRevision"].reduce((result, key) => {
    if (remote[key] !== undefined) result[key] = remote[key];
    return result;
  }, {});
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
