import { getProjectRepositoryCapability, loadProjectOv5, saveProjectOv5 } from "./projectBriefClient.js";
import { getProjectConflictDraftState, loadProjectConflictDraft, saveProjectConflictDraft } from "./projectConflictDraftStore.js";

export function createProjectOv5SyncController({ projectId, getState, render, notify, applyRemoteOv5, captureLocal = null, restoreLocal = null, onSaved = null }) {
  let synchronizing = false;
  let repositoryEnabled = null;

  return {
    async hydrate({ interactive = false, forceRemote = false } = {}) {
      const state = getState();
      state.ov5Storage = { ...state.ov5Storage, status: "checking" };
      render();
      try {
        repositoryEnabled = await getProjectRepositoryCapability("ov5");
        if (!repositoryEnabled) {
          state.ov5Storage = withRecovery(createDisabledState());
          if (interactive) notify("当前服务尚未启用 OV-5 项目仓储，继续使用本地模型");
          render();
          return;
        }
        const remote = await loadProjectOv5(projectId);
        if (forceRemote && remote.exists) saveRecovery(state);
        const applied = remote.exists ? applyRemoteOv5(remote, { force: forceRemote }) : false;
        state.ov5Storage = withRecovery(createReadyState(remote, applied));
        state.projectRevision = Math.max(Number(state.projectRevision || 0), Number(remote.revision || 0));
        if (interactive && remote.exists) notify(applied ? `已载入 OV-5 服务端修订 r${remote.revision}` : "保留当前本地 OV-5，未覆盖服务端修订");
      } catch {
        state.ov5Storage = withRecovery({ status: "offline", mode: "local", label: "本地 OV-5", detail: "服务端 OV-5 仓储不可用" });
        if (interactive) notify("服务端 OV-5 仓储不可用，当前继续使用本地模型");
      }
      render();
    },

    async sync(model, { source = "manual" } = {}) {
      if (synchronizing) return;
      if (repositoryEnabled === null) {
        try {
          repositoryEnabled = await getProjectRepositoryCapability("ov5");
        } catch {
          repositoryEnabled = false;
        }
      }
      if (repositoryEnabled === false) {
        const state = getState();
        state.ov5Storage = withRecovery(createDisabledState());
        render();
        return;
      }
      synchronizing = true;
      const state = getState();
      state.ov5Storage = withRecovery({ ...state.ov5Storage, status: "saving", mode: "server", label: "正在同步 OV-5" });
      render();
      try {
        const remote = await saveProjectOv5(projectId, { model, source, expectedRevision: Math.max(Number(state.projectRevision || 0), Number(state.ov5Storage?.revision || 0)) });
        state.ov5Storage = withRecovery(createReadyState(remote, true));
        state.projectRevision = Math.max(Number(state.projectRevision || 0), Number(remote.revision || 0));
        try { await onSaved?.({ resource: "ov5", source, remote }); } catch {}
      } catch (error) {
        if (error?.status === 409) {
          saveRecovery(state, model);
          state.ov5Storage = withRecovery({ status: "conflict", mode: "local", label: "OV-5 修订冲突", detail: "服务端已有较新修订；本地草稿已保留，可刷新后显式载入。", conflict: true });
        } else {
          state.ov5Storage = withRecovery({ status: "offline", mode: "local", label: "本地 OV-5", detail: "服务端同步失败；本地模型仍已保存" });
        }
      } finally {
        synchronizing = false;
        render();
      }
    },

    handleAction(action) {
      if (action === "refresh-project-ov5") {
        void this.hydrate({ interactive: true });
        return true;
      }
      if (action === "restore-project-ov5-conflict-draft") {
        const state = getState();
        const draft = loadProjectConflictDraft("ov5");
        if (!draft || !restoreLocal) return true;
        restoreLocal(draft.model);
        state.ov5Storage = withRecovery({ status: "recovery", mode: "local", label: "已恢复本地 OV-5 冲突草稿", detail: `已恢复浏览器本地 ${draft.savedAt} 保存的草稿；尚未提交服务端。`, revision: Number(state.projectRevision || 0), remoteAvailable: true });
        render();
        notify("已恢复本地 OV-5 冲突草稿；请复核后再提交。");
        return true;
      }
      if (action !== "load-project-ov5") return false;
      void this.hydrate({ interactive: true, forceRemote: true });
      return true;
    }
  };

  function saveRecovery(state, model = undefined) {
    const value = model === undefined ? captureLocal?.() : model;
    if (value === undefined) return null;
    return saveProjectConflictDraft({ resource: "ov5", model: value, projectRevision: Number(state.projectRevision || state.ov5Storage?.revision || 0) });
  }
}

function withRecovery(storage) {
  return { ...storage, ...getProjectConflictDraftState("ov5") };
}

function createReadyState(remote, applied) {
  if (!remote.exists) return { status: "ready", mode: "server", label: "OV-5 仓储就绪", detail: `尚无服务端 OV-5 · 项目 r${remote.revision || 0}`, revision: remote.revision || 0, auditCount: 0 };
  return {
    status: "ready",
    mode: "server",
    label: `OV-5 r${remote.revision}`,
    detail: applied ? `已同步当前模型 · 简报 r${remote.briefRevision || 0}` : "发现服务端修订；本地模型优先",
    revision: remote.revision,
    resourceRevision: remote.resourceRevision,
    auditCount: remote.auditCount || 0,
    updatedAt: remote.updatedAt,
    remoteAvailable: !applied
  };
}

function createDisabledState() {
  return { status: "local", mode: "local", label: "本地 OV-5", detail: "当前服务尚未启用 OV-5 项目仓储" };
}
