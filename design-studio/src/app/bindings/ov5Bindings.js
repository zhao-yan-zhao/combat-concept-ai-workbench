/**
 * OV-5 / OV-5a Event Bindings and Action Handlers.
 */
import { addActivity, updateActivity, deleteActivity, addEdge, deleteEdge, persistOv5Model } from "../../ov5Store.js";
import { countUnmappedOv5Activities, linkOv5ActivitiesToOv1 } from "../../ov5Ov1Linker.js";
import { applyMappingQuality } from "../../ov5MappingQuality.js";
import { selectionFor } from "../../ui.js";

export function bindOv5Events(ctx) {
  const {
    state,
    stateActions,
    render,
    showToast,
    addEventListenerOnce,
    $,
    getModels,
    invalidateDerivedArtifacts,
    projectOv5SyncController,
    dodafProductController,
    bindOv1SourcePicker
  } = ctx;

  // 1. Activity node card selection
  document.querySelectorAll("[data-activity]").forEach((button) => {
    addEventListenerOnce(button, "click", (event) => {
      // 若点击的是卡片内部带 data-action 的独立操作按钮，不触发外层卡片的整体选择
      if (event.target.closest("[data-action]")) return;
      if (stateActions?.selectOv5Activity) {
        stateActions.selectOv5Activity(button.dataset.activity);
      } else {
        const models = getModels ? getModels() : { ov5: state.ov5 };
        state.selection = selectionFor("activity", button.dataset.activity, models);
        if (state.activeView === "ov5") {
          state.ov5LeftMode = "editor";
        }
      }
      render();
    }, "activity:click");
  });

  // 2. Activity Inspector events
  document.querySelectorAll("[data-inspector-action=delete-activity]").forEach((button) => {
    addEventListenerOnce(button, "click", () => {
      const deleted = deleteActivity(state.ov5, state.selection?.id);
      if (deleted) invalidateDerivedArtifacts();
      if (deleted) void projectOv5SyncController.sync(state.ov5, { source: "manual" });
      if (stateActions?.clearSelection) {
        stateActions.clearSelection();
      } else {
        state.selection = null;
      }
      showToast(deleted ? "活动及其关联已删除" : "至少保留一个活动节点");
      render();
    }, "inspector:delete-activity");
  });

  document.querySelectorAll("[data-inspector-action=edit]").forEach((button) => {
    addEventListenerOnce(button, "click", () => showToast("已将当前节点标记为待修订"), "inspector:edit");
  });

  const actForm = $("#ov5ActivityForm");
  if (actForm) {
    addEventListenerOnce(actForm, "submit", (event) => saveActivity(event, ctx), "ov5ActivityForm:submit");
    if (bindOv1SourcePicker) bindOv1SourcePicker(actForm);
  }

  const edgeForm = $("#ov5EdgeForm");
  if (edgeForm) {
    addEventListenerOnce(edgeForm, "submit", (event) => saveEdge(event, ctx), "ov5EdgeForm:submit");
  }

  document.querySelectorAll("[data-edge-remove]").forEach((button) => {
    addEventListenerOnce(button, "click", () => {
      const exists = state.ov5.edges.some((edge) => edge.id === button.dataset.edgeRemove);
      deleteEdge(state.ov5, button.dataset.edgeRemove);
      invalidateDerivedArtifacts();
      if (exists) void projectOv5SyncController.sync(state.ov5, { source: "manual" });
      showToast("活动关联已移除");
      render();
    }, "edge-remove:click");
  });
}

export function saveActivity(event, ctx) {
  event.preventDefault();
  const {
    state,
    stateActions,
    render,
    showToast,
    getModels,
    invalidateDerivedArtifacts,
    projectOv5SyncController,
    dodafProductController
  } = ctx;

  const formData = new FormData(event.currentTarget);
  const activity = updateActivity(state.ov5, state.selection.id, {
    title: (formData.get("title") || "").trim() || "未命名活动",
    type: (formData.get("type") || "").trim() || "待分类",
    input: (formData.get("input") || "").trim() || "待定义",
    output: (formData.get("output") || "").trim() || "待定义",
    duration: (formData.get("duration") || "").trim() || "待估算",
    parentId: (formData.get("parentId") || "").trim(),
    resources: (formData.get("resources") || "").trim(),
    performer: (formData.get("performer") || "").trim(),
    domain: (formData.get("domain") || "").trim(),
    autonomy: (formData.get("autonomy") || "").trim(),
    timingWindow: (formData.get("timingWindow") || "").trim(),
    resilienceFallback: (formData.get("resilienceFallback") || "").trim(),
    preconditions: (formData.get("preconditions") || "").trim(),
    constraints: (formData.get("constraints") || "").trim(),
    text: (formData.get("text") || "").trim() || "补充该活动的任务说明。",
    refs: (formData.get("refs") || "").split(/[、,，]/).map((item) => item.trim()).filter(Boolean),
    sourceOv1NodeIds: formData.getAll("sourceOv1NodeIds").map((item) => item.trim()).filter(Boolean)
  });
  invalidateDerivedArtifacts();
  void projectOv5SyncController.sync(state.ov5, { source: "manual" });
  void dodafProductController.syncFromOv5b({ source: "manual" });
  if (stateActions?.selectOv5Activity) {
    stateActions.selectOv5Activity(activity.id);
  } else {
    state.selection = selectionFor("activity", activity.id, getModels());
  }
  const sourceCount = activity.sourceOv1NodeIds?.length || 0;
  showToast(sourceCount ? `活动已保存（${sourceCount} 个总体图来源），活动分解关系已同步` : "活动已保存；尚未挂接总体图来源；活动分解关系已同步");
  render();
}

export function saveEdge(event, ctx) {
  event.preventDefault();
  const {
    state,
    render,
    showToast,
    invalidateDerivedArtifacts,
    projectOv5SyncController
  } = ctx;

  const formData = new FormData(event.currentTarget);
  const edge = addEdge(state.ov5, state.selection.id, formData.get("targetId"), formData.get("type"), {
    payload: formData.get("payload"),
    condition: formData.get("condition")
  });
  if (edge) invalidateDerivedArtifacts();
  if (edge) void projectOv5SyncController.sync(state.ov5, { source: "manual" });
  showToast(edge ? "活动关联已建立" : "该关联已存在或无效");
  render();
}

export function handleOv5Action(action, source, ctx) {
  const {
    state,
    stateActions,
    render,
    showToast,
    getModels,
    invalidateDerivedArtifacts,
    projectOv5SyncController,
    ov5AiController
  } = ctx;

  if (action === "continue-to-ov5") {
    state.activeView = "ov5";
    if (stateActions?.clearSelection) {
      stateActions.clearSelection();
    } else {
      state.selection = null;
    }
    showToast("已进入作战活动模型。可手工维护活动，或使用 AI 生成候选。");
    render();
    return true;
  }

  if (action === "generate-ov5-from-ov1") {
    state.activeView = "ov5";
    if (stateActions?.clearSelection) {
      stateActions.clearSelection();
    } else {
      state.selection = null;
    }
    render();
    ov5AiController.handleAction("generate-ov5");
    return true;
  }

  if (action === "attach-ov1-sources") {
    attachOv1SourcesToOv5(ctx);
    return true;
  }

  if (action === "apply-mapping-quality") {
    applyMappingQualityToOv5(ctx);
    return true;
  }

  if (action === "add-activity") {
    const activity = addActivity(state.ov5);
    invalidateDerivedArtifacts();
    void projectOv5SyncController.sync(state.ov5, { source: "manual" });
    if (stateActions?.selectOv5Activity) {
      stateActions.selectOv5Activity(activity.id);
    } else {
      state.selection = selectionFor("activity", activity.id, getModels());
    }
    showToast("已新增活动，请在右侧补充属性");
    render();
    return true;
  }

  return false;
}

export function attachOv1SourcesToOv5(ctx) {
  const { state, render, showToast, invalidateDerivedArtifacts, projectOv5SyncController } = ctx;
  if (!state.ov1?.nodes?.length) {
    showToast("请先在高层作战概念图定义概念节点，再补挂活动来源");
    return;
  }
  if (!state.ov5?.activities?.length) {
    showToast("请先建立作战活动");
    return;
  }
  const before = countUnmappedOv5Activities(state.ov5, state.ov1);
  state.ov5 = linkOv5ActivitiesToOv1(state.ov5, state.ov1);
  persistOv5Model(state.ov5);
  const after = countUnmappedOv5Activities(state.ov5, state.ov1);
  invalidateDerivedArtifacts();
  void projectOv5SyncController.sync(state.ov5, { source: "ov1-source-link" });
  const linked = Math.max(0, before - after);
  showToast(linked || before === 0
    ? (before === 0 ? "全部活动已具备有效总体图来源" : `已为 ${linked} 个活动补挂总体图来源，请在结构核对台复核`)
    : "未能自动补挂更多来源，请手工为活动选择总体图节点");
  if (state.activeView !== "structure-review" && state.activeView !== "ov5") state.activeView = "structure-review";
  render();
}

/** Fill blank OV-5 I/O and shallow parent hierarchy; never overwrites authored text. */
export function applyMappingQualityToOv5(ctx) {
  const { state, render, showToast, getModels, invalidateDerivedArtifacts, projectOv5SyncController } = ctx;
  if (!state.ov5?.activities?.length) {
    showToast("请先建立作战活动");
    return;
  }
  // Sources improve I/O suggestions; keep existing valid links, only fill gaps.
  if (state.ov1?.nodes?.length) {
    state.ov5 = linkOv5ActivitiesToOv1(state.ov5, state.ov1);
  }
  const result = applyMappingQuality(state.ov5, state.ov1 || {});
  state.ov5 = result.model;
  persistOv5Model(state.ov5);
  invalidateDerivedArtifacts();
  void projectOv5SyncController.sync(state.ov5, { source: "mapping-quality" });
  const { ioFromOv1, ioFromEdges, parentsSet, changed } = result.summary;
  if (!changed) {
    showToast("没有可自动补全的空字段；已有正文不会被覆盖");
  } else {
    const parts = [];
    if (ioFromOv1) parts.push(`总体图回填 ${ioFromOv1} 处`);
    if (ioFromEdges) parts.push(`沿边对齐 ${ioFromEdges} 处`);
    if (parentsSet) parts.push(`父活动 ${parentsSet} 项`);
    showToast(`已补全映射质量：${parts.join(" · ")}。请在活动模型 / 结构核对台复核`);
  }
  if (state.selection?.kind === "activity") {
    state.selection = selectionFor("activity", state.selection.id, getModels());
  }
  if (state.activeView !== "structure-review" && state.activeView !== "ov5") state.activeView = "structure-review";
  render();
}

export function bindOv5aDragAndDrop(ctx) {
  const { handleAction } = ctx;
  let draggedActivityId = null;

  document.addEventListener("dragstart", (event) => {
    const card = event.target?.closest?.('[data-drag-type="ov5a-activity"]');
    if (!card) return;
    draggedActivityId = card.dataset.activityId || card.dataset.activity || null;
    if (event.dataTransfer && draggedActivityId) {
      event.dataTransfer.setData("text/plain", draggedActivityId);
      event.dataTransfer.effectAllowed = "move";
    }
    card.classList.add("is-drag-source");
  });

  document.addEventListener("dragend", (event) => {
    const card = event.target?.closest?.('[data-drag-type="ov5a-activity"]');
    if (card) card.classList.remove("is-drag-source");
    document.querySelectorAll(".is-drag-over").forEach((el) => el.classList.remove("is-drag-over"));
    draggedActivityId = null;
  });

  document.addEventListener("dragover", (event) => {
    if (!draggedActivityId) return;
    const dropTarget = event.target?.closest?.('[data-drop-zone="activity"], [data-drop-zone="root"]');
    if (!dropTarget) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  });

  document.addEventListener("dragenter", (event) => {
    if (!draggedActivityId) return;
    const dropTarget = event.target?.closest?.('[data-drop-zone="activity"], [data-drop-zone="root"]');
    if (dropTarget) dropTarget.classList.add("is-drag-over");
  });

  document.addEventListener("dragleave", (event) => {
    const dropTarget = event.target?.closest?.('[data-drop-zone="activity"], [data-drop-zone="root"]');
    if (dropTarget && (!event.relatedTarget || !dropTarget.contains(event.relatedTarget))) {
      dropTarget.classList.remove("is-drag-over");
    }
  });

  document.addEventListener("drop", (event) => {
    if (!draggedActivityId) return;
    const dropTarget = event.target?.closest?.('[data-drop-zone="activity"], [data-drop-zone="root"]');
    if (!dropTarget) return;
    event.preventDefault();
    dropTarget.classList.remove("is-drag-over");

    const zoneType = dropTarget.dataset.dropZone;
    if (zoneType === "root") {
      handleAction("ov5a-drop-root", { dataset: { childId: draggedActivityId } });
    } else if (zoneType === "activity") {
      const parentId = dropTarget.dataset.activityId || dropTarget.dataset.activity;
      if (parentId && parentId !== draggedActivityId) {
        handleAction("ov5a-reparent", { dataset: { childId: draggedActivityId, parentId } });
      }
    }
    draggedActivityId = null;
  });
}
