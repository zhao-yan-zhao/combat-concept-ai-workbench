import { getProjectRepositoryCapability, loadProjectBrief, saveProjectBrief } from "./projectBriefClient.js";
import { createProjectWriteFailureState } from "./projectWriteFailureState.js";
import { getProjectConflictDraftState, loadProjectConflictDraft, saveProjectConflictDraft } from "./projectConflictDraftStore.js";

export function createProjectBriefSyncController({ projectId, getState, render, notify, applyRemoteBrief, captureLocal = null, restoreLocal = null, onSaved = null }) {
  let synchronizing = false;
  let repositoryEnabled = null;

  return {
    async hydrate({ interactive = false, forceRemote = false } = {}) {
      const state = getState();
      state.projectStorage = { ...state.projectStorage, status: "checking" };
      render();
      try {
        repositoryEnabled = await getProjectRepositoryCapability();
        if (!repositoryEnabled) {
          state.projectStorage = createDisabledState();
          if (interactive) notify("当前服务尚未启用项目仓储，继续使用本地草稿");
          render();
          return;
        }
        const remote = await loadProjectBrief(projectId);
        if (forceRemote && remote.exists) saveRecovery(state);
        const applied = remote.exists ? applyRemoteBrief(remote, { force: forceRemote }) : false;
        state.projectStorage = withRecovery(createReadyState(remote, applied));
        state.projectRevision = Math.max(Number(state.projectRevision || 0), Number(remote.revision || 0));
        if (interactive && remote.exists) notify(applied ? `已载入服务端修订 r${remote.revision}` : "已保留本地草稿；可显式载入服务端修订");
      } catch {
        state.projectStorage = { status: "offline", mode: "local", label: "本地回退", detail: "服务端项目仓储不可用" };
        if (interactive) notify("服务端项目仓储不可用，当前继续使用本地草稿");
      }
      render();
    },

    async sync(brief, { direction, inspiration = null, directions = [], source = "manual" } = {}) {
      if (synchronizing) return;
      if (repositoryEnabled === null) {
        try {
          repositoryEnabled = await getProjectRepositoryCapability();
        } catch {
          repositoryEnabled = false;
        }
      }
      if (repositoryEnabled === false) {
        const state = getState();
        state.projectStorage = withRecovery(createDisabledState());
        render();
        return;
      }
      synchronizing = true;
      const state = getState();
        state.projectStorage = withRecovery({ ...state.projectStorage, status: "saving", mode: "server", label: "正在同步" });
      render();
      try {
        const remote = await saveProjectBrief(projectId, { brief, direction, inspiration, directions, source, expectedRevision: Number(state.projectRevision || state.projectStorage?.revision || 0) });
        state.projectStorage = withRecovery(createReadyState(remote, true));
        state.projectRevision = Math.max(Number(state.projectRevision || 0), Number(remote.revision || 0));
        try { await onSaved?.({ resource: "brief", source, remote }); } catch {}
      } catch (error) {
        if (error?.status === 409) saveRecovery(state, { brief, direction, inspiration, directions });
        state.projectStorage = withRecovery(error?.status === 409
          ? { status: "conflict", mode: "local", label: "简报修订冲突", detail: "服务端已有较新修订；本地草稿已保留，可刷新后显式载入。", conflict: true }
          : createProjectWriteFailureState(error, "概念简报", () => ({ status: "offline", mode: "local", label: "本地回退", detail: "服务端同步失败；本地草稿仍已保存" })));
      } finally {
        synchronizing = false;
        render();
      }
    },

    handleAction(action) {
      if (action === "refresh-project-brief") {
        void this.hydrate({ interactive: true });
        return true;
      }
      if (action === "restore-project-brief-conflict-draft") {
        const state = getState();
        const draft = loadProjectConflictDraft("brief");
        if (!draft || !restoreLocal) return true;
        restoreLocal(draft.model);
        state.projectStorage = withRecovery({ status: "recovery", mode: "local", label: "已恢复本地简报冲突草稿", detail: `已恢复浏览器本地 ${draft.savedAt} 保存的草稿；尚未提交服务端。`, revision: Number(state.projectRevision || 0), remoteAvailable: true });
        render();
        notify("已恢复本地简报冲突草稿；请复核后再提交。");
        return true;
      }
      if (action !== "load-project-brief") return false;
      void this.hydrate({ interactive: true, forceRemote: true });
      return true;
    }
  };

  function saveRecovery(state, model = undefined) {
    const value = model === undefined ? captureLocal?.() : model;
    if (value === undefined) return null;
    return saveProjectConflictDraft({ resource: "brief", model: value, projectRevision: Number(state.projectRevision || state.projectStorage?.revision || 0) });
  }
}

function withRecovery(storage) {
  return { ...storage, ...getProjectConflictDraftState("brief") };
}

function createReadyState(remote, applied) {
  if (!remote.exists) return { status: "ready", mode: "server", label: "服务端就绪", detail: "尚无服务端简报", revision: 0, auditCount: 0 };
  return {
    status: "ready",
    mode: "server",
    label: `服务端 r${remote.revision}`,
    detail: applied ? "已同步当前简报" : "发现服务端修订；本地草稿优先",
    revision: remote.revision,
    resourceRevision: remote.resourceRevision || remote.briefRevision || 0,
    briefRevision: remote.briefRevision || remote.resourceRevision || 0,
    auditCount: remote.auditCount || 0,
    updatedAt: remote.updatedAt,
    remoteAvailable: !applied
  };
}

function createDisabledState() {
  return { status: "local", mode: "local", label: "本地草稿", detail: "当前服务尚未启用项目仓储" };
}
