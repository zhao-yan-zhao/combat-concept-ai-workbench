import { createProject, deleteProject, updateProject } from "../../projectBriefClient.js";
import { purgeProjectClientStorage } from "../../clientStoragePurge.js";
import { renderProjectManager } from "../../projectManagerView.js";

/**
 * Switch active project via query parameter reload.
 */
export function switchProject(projectId, ctx) {
  const { state } = ctx;
  if (!projectId || (projectId === state.activeProjectId && !state.projectEntryRequired)) return;
  const url = new URL(window.location.href);
  url.searchParams.set("project", projectId);
  window.location.assign(url);
}

/**
 * Delete a project with confirmation and clean up client storage.
 */
export async function handleDeleteProject(projectId, title = projectId, ctx) {
  const { state, showToast, hydrateProjectDirectory, renderProjectManagerChrome } = ctx;
  if (!window.confirm(`将永久删除项目“${title}”及其所有数据，此操作无法恢复。确定继续吗？`)) return;
  try {
    const isCurrentActive = projectId === state.activeProjectId;
    await deleteProject(projectId);
    purgeProjectClientStorage(projectId);
    showToast("已删除项目");
    await hydrateProjectDirectory();
    if (isCurrentActive) {
      const remaining = state.projectDirectory.projects || [];
      const nextProject = remaining.find((p) => p.id !== projectId && !p.archived)?.id
        || remaining.find((p) => p.id !== projectId)?.id
        || "default";
      switchProject(nextProject, ctx);
      return;
    }
    renderProjectManagerChrome();
  } catch (error) {
    showToast(error?.status === 403 ? "只有负责人可删除项目" : "项目删除失败：请先归档并确认项目状态");
  }
}

/**
 * Update only the top project dropdown; leave concept-map iframe untouched.
 */
export function renderProjectManagerChrome(ctx) {
  const {
    state,
    $,
    showToast,
    handleAction,
    hydrateProjectDirectory
  } = ctx;
  const root = $("#projectManagerRoot");
  if (!root) return;
  root.innerHTML = renderProjectManager({
    directory: state.projectDirectory,
    activeProjectId: state.activeProjectId,
    open: state.projectManagerOpen,
    createOpen: state.projectCreateOpen,
    isLead: state.collaboration?.session?.actor?.roles?.includes("lead")
  });
  root.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action, button));
  });
  root.querySelectorAll("[data-project-switch]").forEach((button) => {
    button.addEventListener("click", () => switchProject(button.dataset.projectSwitch, ctx));
  });
  root.querySelectorAll("[data-project-archive]").forEach((button) => {
    button.addEventListener("click", async () => {
      const targetProjectId = button.dataset.projectArchive;
      const shouldArchive = button.dataset.projectArchived === "true";
      if (shouldArchive && targetProjectId === state.activeProjectId) {
        showToast("当前正在使用的项目不可归档，请切换至其他项目后再试");
        return;
      }
      try {
        await updateProject(targetProjectId, { archived: shouldArchive });
        await hydrateProjectDirectory();
        renderProjectManagerChrome(ctx);
      } catch {
        showToast("项目状态更新失败，请确认负责人身份");
      }
    });
  });
  root.querySelectorAll("[data-project-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const title = button.dataset.projectTitle || button.dataset.projectDelete;
      await handleDeleteProject(button.dataset.projectDelete, title, ctx);
    });
  });
  root.querySelector("#projectCreateForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try {
      const result = await createProject({
        id: values.get("id"),
        kind: values.get("kind") || "tactic",
        title: values.get("title"),
        description: values.get("description")
      });
      switchProject(result.project.id, ctx);
    } catch {
      showToast("项目创建失败，请检查项目标识和名称");
    }
  });
}

/**
 * Handle loading example projects without overwriting existing projects.
 */
export async function handleLoadExampleProject(kind = "tactic", ctx) {
  const { state, showToast, hydrateProjectDirectory } = ctx;
  try {
    const fileName = kind === "scenario" ? "scenario-example.json" : "tactic-example.json";
    const response = await fetch(`/design-studio/examples/${fileName}`);
    if (!response.ok) throw new Error("示例配置文件读取失败");
    const example = await response.json();

    const existingIds = new Set((state.projectDirectory?.projects || []).map((p) => p.id));
    const baseId = kind === "scenario" ? "example-scenario" : "example-tactic";
    let candidateId = baseId;
    let counter = 1;
    while (existingIds.has(candidateId)) {
      candidateId = `${baseId}-${counter++}`;
    }
    const candidateTitle = candidateId === baseId
      ? example.title
      : `${example.title}（副本${counter - 1}）`;

    const result = await createProject({
      id: candidateId,
      kind: example.kind || kind,
      title: candidateTitle,
      description: example.description,
      workflow: example.workflow,
      record: example.record
    });

    showToast(`已成功载入示例：${candidateTitle}`);
    if (hydrateProjectDirectory) await hydrateProjectDirectory({ skipRender: true });
    switchProject(result.project.id, ctx);
  } catch (error) {
    showToast(`载入示例失败：${error?.message || "网络错误"}`);
  }
}

/**
 * Handle project manager toggle and retry actions.
 */
export function handleProjectAction(action, source, ctx) {
  const {
    state,
    closeMenubarMenus,
    refreshProjectManagerUi,
    focusOpenMenubarChrome,
    render,
    hydrateProjectDirectory
  } = ctx;

  if (action === "load-example-project") {
    const kind = source?.dataset?.exampleKind || "tactic";
    void handleLoadExampleProject(kind, ctx);
    return true;
  }
  if (action === "toggle-project-manager") {
    const nextOpen = !state.projectManagerOpen;
    if (nextOpen) closeMenubarMenus();
    state.projectManagerOpen = nextOpen;
    if (!state.projectManagerOpen) state.projectCreateOpen = false;
    refreshProjectManagerUi();
    if (nextOpen) queueMicrotask(() => focusOpenMenubarChrome());
    return true;
  }
  if (action === "toggle-project-create") {
    state.projectManagerOpen = true;
    state.projectCreateOpen = !state.projectCreateOpen;
    if (state.projectEntryRequired) {
      render();
      return true;
    }
    refreshProjectManagerUi();
    queueMicrotask(() => focusOpenMenubarChrome());
    return true;
  }
  if (action === "retry-project-entry") {
    state.projectDirectory = { status: "checking", projects: [] };
    render();
    void hydrateProjectDirectory();
    return true;
  }
  return false;
}
