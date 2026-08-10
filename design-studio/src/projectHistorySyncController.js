import { getProjectRepositoryCapability } from "./projectBriefClient.js";
import { createProjectWriteFailureState } from "./projectWriteFailureState.js";

export function createProjectHistorySyncController({
  projectId,
  resource,
  storageKey,
  listKey,
  resourceLabel,
  load,
  create,
  remove,
  getState,
  render,
  notify,
  applyRemote,
  upsertRemote,
  removeRemote,
  onSaved = null
}) {
  let repositoryEnabled = null;
  let writeQueue = Promise.resolve();

  return {
    async hydrate({ interactive = false } = {}) {
      const state = getState();
      state[storageKey] = { ...state[storageKey], status: "checking" };
      render();
      try {
        repositoryEnabled = await getProjectRepositoryCapability(resource);
        if (!repositoryEnabled) {
          state[storageKey] = createDisabledState(resourceLabel);
          if (interactive) notify(`Current service does not provide ${resourceLabel} project storage.`);
          return;
        }
        const remote = await load(projectId);
        const applied = remote.items?.length ? applyRemote(remote.items, { force: interactive }) : false;
        state[storageKey] = createReadyState(remote, resourceLabel, applied);
        state.projectRevision = Math.max(Number(state.projectRevision || 0), Number(remote.revision || 0));
        if (interactive && remote.items?.length) {
          notify(applied ? `Loaded ${remote.items.length} ${resourceLabel} item(s) from the server.` : `Kept local ${resourceLabel}; server history was not applied.`);
        }
      } catch {
        state[storageKey] = createOfflineState(resourceLabel);
        if (interactive) notify(`${resourceLabel} project storage is unavailable; local history remains available.`);
      } finally {
        render();
      }
    },

    save(item, { source = "manual" } = {}) {
      return enqueue(async () => {
        const state = getState();
        if (!await ensureCapability()) {
          state[storageKey] = createDisabledState(resourceLabel);
          render();
          return null;
        }
        state[storageKey] = { ...state[storageKey], status: "saving", mode: "server", label: `Syncing ${resourceLabel}` };
        render();
        try {
          const remote = await create(projectId, {
            item,
            source,
            expectedRevision: currentExpectedRevision(state, storageKey)
          });
          if (remote.item) upsertRemote(remote.item);
          state[storageKey] = createReadyState(remote, resourceLabel, true);
          state.projectRevision = Math.max(Number(state.projectRevision || 0), Number(remote.revision || 0));
          try { await onSaved?.({ resource, source, remote }); } catch {}
          return remote.item || null;
        } catch (error) {
          state[storageKey] = createFailureState(error, resourceLabel);
          return null;
        } finally {
          render();
        }
      });
    },

    remove(itemId, { source = "manual" } = {}) {
      return enqueue(async () => {
        const state = getState();
        if (!await ensureCapability()) {
          state[storageKey] = createDisabledState(resourceLabel);
          render();
          return false;
        }
        state[storageKey] = { ...state[storageKey], status: "saving", mode: "server", label: `Syncing ${resourceLabel}` };
        render();
        try {
          const remote = await remove(projectId, itemId, {
            source,
            expectedRevision: currentExpectedRevision(state, storageKey)
          });
          if (remote.removed) removeRemote(itemId);
          state[storageKey] = createReadyState(remote, resourceLabel, true);
          state.projectRevision = Math.max(Number(state.projectRevision || 0), Number(remote.revision || 0));
          try { await onSaved?.({ resource, source, remote }); } catch {}
          return Boolean(remote.removed);
        } catch (error) {
          state[storageKey] = createFailureState(error, resourceLabel);
          return false;
        } finally {
          render();
        }
      });
    },

    handleAction(action) {
      if (action !== `refresh-project-${resource}`) return false;
      void this.hydrate({ interactive: true });
      return true;
    }
  };

  async function ensureCapability() {
    if (repositoryEnabled !== null) return repositoryEnabled;
    try {
      repositoryEnabled = await getProjectRepositoryCapability(resource);
    } catch {
      repositoryEnabled = false;
    }
    return repositoryEnabled;
  }

  function enqueue(operation) {
    const pending = writeQueue.then(operation, operation);
    writeQueue = pending.catch(() => undefined);
    return pending;
  }
}

function createReadyState(remote, resourceLabel, applied) {
  const itemCount = Array.isArray(remote?.items) ? remote.items.length : 0;
  return {
    status: "ready",
    mode: "server",
    label: `${resourceLabel} r${remote?.revision || 0}`,
    detail: applied
      ? `${itemCount} item(s) synchronized from the server.`
      : `${itemCount} server item(s) available; local history remains preferred.`,
    revision: Number(remote?.revision || 0),
    resourceRevision: Number(remote?.resourceRevision || 0),
    auditCount: Number(remote?.auditCount || 0),
    updatedAt: remote?.updatedAt,
    itemCount,
    historical: true,
    ...pickLineage(remote)
  };
}

function createDisabledState(resourceLabel) {
  return { status: "local", mode: "local", label: `Local ${resourceLabel}`, detail: `Current service does not provide ${resourceLabel} project storage.` };
}

function createOfflineState(resourceLabel) {
  return { status: "offline", mode: "local", label: `Local ${resourceLabel}`, detail: "Server synchronization failed; local history remains saved." };
}

function createFailureState(error, resourceLabel) {
  if (error?.status === 409) {
    return {
      status: "conflict",
      mode: "local",
      label: `${resourceLabel} conflict`,
      detail: "The server has a newer project revision. Refresh before deciding whether to replace local history.",
      conflict: true
    };
  }
  return createProjectWriteFailureState(error, resourceLabel, () => createOfflineState(resourceLabel));
}

function currentExpectedRevision(state, storageKey) {
  return Math.max(Number(state.projectRevision || 0), Number(state[storageKey]?.revision || 0));
}

function pickLineage(remote) {
  return ["briefRevision", "ov5Revision", "oodaRevision", "scenarioRevision", "validationRevision"].reduce((result, key) => {
    if (remote?.[key] !== undefined) result[key] = remote[key];
    return result;
  }, {});
}
