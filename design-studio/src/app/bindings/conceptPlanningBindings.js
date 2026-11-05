import { directions } from "../../data.js";
import { buildDirectionProposals, saveCustomDirections, saveSelectedDirection } from "../../directionProposalStore.js";

/**
 * Bind direction selection, edit, delete and form submit events.
 */
export function bindDirectionEvents(ctx) {
  const { state, showToast, projectBriefSyncController, render, activeProjectId } = ctx;

  document.querySelectorAll("[data-direction]").forEach((button) => {
    button.addEventListener("click", () => {
      state.direction = saveSelectedDirection(button.dataset.direction);
      showToast(`已选择“${state.direction}”方向`);
      void projectBriefSyncController.sync(state.brief, {
        direction: state.direction,
        inspiration: state.inspiration,
        directions: state.customDirections,
        source: "direction-selection"
      });
      render();
    });
  });

  document.querySelectorAll("[data-edit-direction]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const item = state.customDirections.find((direction) => direction.title === button.dataset.editDirection);
      const form = document.querySelector("#customDirectionForm");
      const dialog = document.querySelector("#customDirectionDialog");
      if (!item || !form || !dialog) return;
      form.dataset.editingDirection = item.title;
      form.querySelector('[name="title"]').value = item.title;
      form.querySelector('[name="text"]').value = item.text;
      form.querySelector('[name="basis"]').value = item.basis;
      const heading = form.querySelector("h2");
      if (heading) heading.textContent = "编辑方向";
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.textContent = "保存修改";
      dialog.showModal();
    });
  });

  document.querySelectorAll("[data-delete-direction]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const title = button.dataset.deleteDirection;
      state.customDirections = saveCustomDirections(
        state.customDirections.filter((item) => item.title !== title),
        { projectId: activeProjectId, defaults: directions }
      );
      if (state.direction === title) {
        const proposals = buildDirectionProposals({
          session: state.inspiration,
          fallbackDirections: directions,
          aiDirections: state.aiDirections,
          customDirections: state.customDirections
        });
        state.direction = saveSelectedDirection(proposals[0]?.title || "");
      }
      void projectBriefSyncController.sync(state.brief, {
        direction: state.direction,
        inspiration: state.inspiration,
        directions: state.customDirections,
        source: "custom-direction"
      });
      showToast(`已删除“${title}”方向`);
      render();
    });
  });

  document.querySelector("#customDirectionForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const title = String(values.get("title") || "").trim();
    const text = String(values.get("text") || "").trim();
    const basis = String(values.get("basis") || "").trim();
    const editingTitle = form.dataset.editingDirection || "";
    const candidate = editingTitle
      ? state.customDirections.map((item) => (item.title === editingTitle ? { title, text, basis } : item))
      : [...state.customDirections, { title, text, basis }];
    const next = saveCustomDirections(candidate, { projectId: activeProjectId, defaults: directions });
    if (next.length !== candidate.length || (!editingTitle && next.length === state.customDirections.length)) {
      showToast("请填写名称、概述和研究依据；名称不能重复");
      return;
    }
    state.customDirections = next;
    const selected = editingTitle ? next.find((item) => item.title === title)?.title : next.at(-1)?.title;
    if (state.direction === editingTitle || !editingTitle) state.direction = saveSelectedDirection(selected || state.direction);
    resetCustomDirectionDialog();
    document.querySelector("#customDirectionDialog")?.close();
    void projectBriefSyncController.sync(state.brief, {
      direction: state.direction,
      inspiration: state.inspiration,
      directions: state.customDirections,
      source: "custom-direction"
    });
    showToast(editingTitle ? `已更新“${title}”方向` : `已新增并选择“${state.direction}”方向`);
    render();
  });
}

export function resetCustomDirectionDialog() {
  const form = document.querySelector("#customDirectionForm");
  if (!form) return;
  form.reset();
  delete form.dataset.editingDirection;
  const heading = form.querySelector("h2");
  if (heading) heading.textContent = "新增方向";
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.textContent = "保存方向";
}

export function openCustomDirectionDialog() {
  resetCustomDirectionDialog();
  const dialog = document.querySelector("#customDirectionDialog");
  if (dialog && !dialog.open) dialog.showModal();
}

export function closeCustomDirectionDialog() {
  resetCustomDirectionDialog();
  const dialog = document.querySelector("#customDirectionDialog");
  if (dialog?.open) dialog.close();
}

export function handleConceptPlanningAction(action, source, ctx) {
  if (action === "open-custom-direction") {
    openCustomDirectionDialog();
    return true;
  }
  if (action === "close-custom-direction") {
    closeCustomDirectionDialog();
    return true;
  }
  return false;
}

/**
 * Concept map persistent iframe helpers.
 */
export function getConceptMapFramePark() {
  let park = document.getElementById("conceptMapFramePark");
  if (!park) {
    park = document.createElement("div");
    park.id = "conceptMapFramePark";
    park.hidden = true;
    park.style.display = "none";
    document.body.appendChild(park);
  }
  return park;
}

export function parkConceptMapFrame() {
  const park = getConceptMapFramePark();
  const frame = document.getElementById("conceptMapFrame");
  if (!frame || !park) return;
  if (frame.parentElement !== park) park.appendChild(frame);
  park.hidden = true;
}

export function mountConceptMapFrame(state) {
  const park = getConceptMapFramePark();
  const mount = document.getElementById("conceptMapFrameMount");
  if (!park) return;

  const isMapActive = state.activeView === "concept-map" || (state.activeView === "ov1" && state.ov1ViewMode === "map");
  if (!isMapActive || !mount) {
    parkConceptMapFrame();
    return;
  }

  const desiredSrc = mount.dataset.frameSrc || "";
  const desiredProject = mount.dataset.mapProjectId || "";
  let frame = document.getElementById("conceptMapFrame");
  if (!frame) {
    frame = document.createElement("iframe");
    frame.id = "conceptMapFrame";
    frame.className = "concept-map-frame";
    frame.title = "作战概念图绘制工具预览";
    frame.referrerPolicy = "strict-origin";
    frame.dataset.mapProjectId = "";
  }

  // Only change src when the bound research→map project changes.
  const boundId = frame.dataset.mapProjectId || "";
  const needsSrc = !frame.getAttribute("src") || boundId !== desiredProject;
  if (needsSrc && desiredSrc) {
    frame.dataset.mapProjectId = desiredProject;
    frame.src = desiredSrc;
  } else if (!boundId && desiredProject) {
    frame.dataset.mapProjectId = desiredProject;
  }

  if (frame.parentElement !== mount) mount.appendChild(frame);
  park.hidden = true;
}
