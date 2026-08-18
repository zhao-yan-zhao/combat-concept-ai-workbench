import { generateWithAi, isAiOutput } from "../../shared/aiClient.js";
import { listCmoMissionTypes } from "../../shared/cmoMissionTypes.js";
import {
  buildForceRecommendKeywords,
  preferredDomainsForForce,
  selectRecommendedPlatforms,
  summarizePhaseRecommendSeeds
} from "../../shared/forcePlatformRecommend.js";
import {
  addCustomCombatFocus,
  combatFocusesForAnalysis,
  compactCombatFocusForAnalysis,
  confirmCombatFocus,
  createCombatFocusFromAi,
  getSelectedCombatFocuses,
  isCombatFocusConfirmed,
  persistCombatFocus,
  toggleCombatFocus
} from "./combatFocusStore.js";
import { getCmoCatalogStatus, searchCmoPlatforms } from "./cmoCatalogClient.js";
import {
  applyConceptGraphicReviewNotes,
  conceptGraphicToOv1Draft,
  confirmConceptGraphicPlan,
  createConceptGraphicPlanFromPlanning,
  persistConceptGraphic
} from "./conceptGraphicStore.js";
import {
  applyForceMissionReviewNotes,
  applyPlatformRecommendations,
  attachForcePlatform,
  attachForcePlatforms,
  compactForceMissionForAnalysis,
  confirmForceMissionPlan,
  confirmOperationalTasks,
  buildOperationalTaskGenerationBatches,
  createOperationalTasksFromPhaseAction,
  createForceMissionPlanFromBrief,
  isForceMissionPlanConfirmed,
  persistForceMission,
  dutyCmoSearchTerms,
  hasRealEquipmentPlatform,
  isEquipmentKeywordOnly,
  platformFitsConceptForce,
  preferredCountryForForceSide,
  removeForcePlatform,
  resolveSideCountries,
  seedConceptEquipmentType,
  setForcePlatformQuantity,
  addOperationalTaskAreaPoint,
  removeOperationalTaskAreaPoint,
  updateCombatConceptLink,
  toggleForceTaskRef,
  updateForceMissionType,
  updateOperationalTask,
  updateOperationalTaskArea,
  updateOperationalTaskAreaPoint
} from "./forceMissionStore.js";
import {
  applyPhaseActionReviewNotes,
  confirmPhaseActionConcept,
  createPhaseActionConceptFromBrief,
  persistPhaseAction
} from "./phaseActionStore.js";
import { compactRuleLibraryForAnalysis } from "../../shared/conceptPlanning.js";
import { summarizePhaseActionChat } from "./phaseActionChatStore.js";

export function createConceptPlanningController({
  projectId,
  getState,
  render,
  notify,
  syncForceMission,
  syncPhaseAction,
  syncConceptGraphic,
  onForceMissionConfirmed,
  onForceMissionGenerated,
  onOperationalTasksConfirmed,
  onPhaseActionConfirmed,
  onPhaseActionGenerated,
  onConceptGraphicConfirmed
}) {
  return {
    handleAction(action, source = null) {
      if (action === "generate-combat-focus") {
        void generateCombatFocus({ silent: false });
        return true;
      }
      if (action === "select-combat-focus" || action === "toggle-combat-focus") {
        const focusId = source?.dataset?.focusId || "";
        if (!focusId) return true;
        const state = getState();
        const wasConfirmed = isCombatFocusConfirmed(state.combatFocus);
        state.combatFocus = persistCombatFocus(toggleCombatFocus(state.combatFocus, focusId), projectId);
        if (wasConfirmed) notify("作战聚焦已变更，请重新确认后再生成阶段");
        render();
        return true;
      }
      if (action === "add-custom-combat-focus") {
        addCustomFocusFromForm();
        return true;
      }
      if (action === "confirm-combat-focus") {
        void confirmCombatFocusAndGeneratePhases();
        return true;
      }
      if (action === "select-force-mission-layer") {
        const layer = source?.dataset?.layer === "combat" ? "combat" : "concept";
        const state = getState();
        if (state.forceMissionLayerTab !== layer) {
          state.forceMissionLayerTab = layer;
          render();
        }
        return true;
      }
      if (action === "generate-operational-tasks") {
        void generateOperationalTasks({ silent: false });
        return true;
      }
      if (action === "select-operational-task") {
        const state = getState();
        const list = source?.closest?.(".operational-task-list")?.querySelector?.(".operational-task-list-scroll");
        if (list) state.operationalTaskListScrollTop = list.scrollTop;
        state.operationalTaskSelectedId = source?.dataset?.taskId || "";
        render();
        return true;
      }
      if (action === "add-operational-task-area-point") {
        void changeOperationalTaskPlan(addOperationalTaskAreaPoint(getState().forceMission, source?.dataset?.taskId || ""), "operational-task:add-point");
        return true;
      }
      if (action === "remove-operational-task-area-point") {
        void changeOperationalTaskPlan(removeOperationalTaskAreaPoint(getState().forceMission, source?.dataset?.taskId || "", source?.dataset?.pointId || ""), "operational-task:remove-point");
        return true;
      }
      if (action === "confirm-operational-tasks") {
        void confirmTasks();
        return true;
      }
      if (action === "generate-force-mission" || action === "generate-concept-forces") {
        void generateForceMission({ withNotes: false, layer: "concept" });
        return true;
      }
      if (action === "generate-combat-forces") {
        void generateForceMission({ withNotes: false, layer: "combat" });
        return true;
      }
      if (action === "regenerate-force-mission-with-notes") {
        // Notes regenerate keeps both layers for full revision from review notes.
        void generateForceMission({ withNotes: true, layer: "both" });
        return true;
      }
      if (action === "confirm-force-mission") {
        void confirmForceMission();
        return true;
      }
      if (action === "open-force-platform-picker") {
        openForcePlatformPicker(source?.dataset?.forceId || "", source?.dataset?.forceLayer || "combat");
        return true;
      }
      if (action === "close-force-platform-picker") {
        closeForcePlatformPicker();
        return true;
      }
      if (action === "search-force-platforms") {
        void searchForcePlatforms(source?.dataset?.forceId || "", source?.dataset?.forceLayer || "concept");
        return true;
      }
      if (action === "attach-force-platform") {
        void attachPlatformFromResult(
          source?.dataset?.forceId || "",
          source?.dataset?.resultIndex,
          source?.dataset?.forceLayer || "concept"
        );
        return true;
      }
      if (action === "toggle-force-platform-select") {
        togglePlatformResultSelect(source?.dataset?.resultIndex, source?.checked);
        return true;
      }
      if (action === "select-all-force-platform-results") {
        selectAllPlatformResults(true);
        return true;
      }
      if (action === "clear-force-platform-selection") {
        selectAllPlatformResults(false);
        return true;
      }
      if (action === "batch-attach-force-platforms") {
        void batchAttachPlatformResults(
          source?.dataset?.forceId || "",
          source?.dataset?.forceLayer || "concept",
          false
        );
        return true;
      }
      if (action === "batch-attach-all-force-platforms") {
        void batchAttachPlatformResults(
          source?.dataset?.forceId || "",
          source?.dataset?.forceLayer || "concept",
          true
        );
        return true;
      }
      if (action === "recommend-platforms-from-phases") {
        // Direct-apply to combat forces; no preview panel.
        void recommendPlatformsFromPhases({ apply: true, silent: false });
        return true;
      }
      if (action === "apply-platform-recommendations") {
        // Legacy action: still direct-apply (no UI button).
        void recommendPlatformsFromPhases({ apply: true, silent: false });
        return true;
      }
      if (action === "apply-one-platform-recommendation") {
        void applyPendingPlatformRecommendations({
          onlySelected: false,
          forceId: source?.dataset?.forceId || ""
        });
        return true;
      }
      if (action === "dismiss-platform-recommendations") {
        dismissPlatformRecommendations();
        return true;
      }
      if (action === "toggle-recommend-skip-filled") {
        toggleRecommendSkipFilled(source?.checked !== false);
        return true;
      }
      if (action === "toggle-recommend-assignment") {
        toggleRecommendAssignment(source?.dataset?.forceId || "", source?.checked !== false);
        return true;
      }
      if (action === "select-all-recommend-assignments") {
        selectAllRecommendAssignments(true);
        return true;
      }
      if (action === "clear-recommend-assignments") {
        selectAllRecommendAssignments(false);
        return true;
      }
      if (action === "remove-recommend-platform") {
        removeRecommendPlatform(
          source?.dataset?.forceId || "",
          source?.dataset?.platformDomain || "",
          source?.dataset?.platformCmoId || ""
        );
        return true;
      }
      if (action === "remove-force-platform") {
        void removePlatform(
          source?.dataset?.forceId || "",
          source?.dataset?.platformId || "",
          source?.dataset?.forceLayer || "concept"
        );
        return true;
      }
      if (action === "generate-phase-action") {
        void generatePhaseAction({ withNotes: false });
        return true;
      }
      if (action === "regenerate-phase-action-with-notes") {
        void generatePhaseAction({ withNotes: true });
        return true;
      }
      if (action === "confirm-phase-action") {
        void confirmPhaseAction();
        return true;
      }
      if (action === "generate-concept-graphic") {
        void generateConceptGraphic({ withNotes: false });
        return true;
      }
      if (action === "regenerate-concept-graphic-with-notes") {
        void generateConceptGraphic({ withNotes: true });
        return true;
      }
      if (action === "confirm-concept-graphic") {
        void confirmConceptGraphic();
        return true;
      }
      return false;
    },
    bind(root = document) {
      const operationalTaskList = root.querySelector(".operational-task-list-scroll");
      if (operationalTaskList) {
        operationalTaskList.scrollTop = Number(getState().operationalTaskListScrollTop) || 0;
        operationalTaskList.addEventListener("scroll", () => {
          getState().operationalTaskListScrollTop = operationalTaskList.scrollTop;
        }, { passive: true });
      }
      root.querySelectorAll("[data-operational-task-field]").forEach((control) => {
        control.addEventListener("change", () => {
          void changeOperationalTask(control.dataset.taskId, control.dataset.operationalTaskField, control.value);
        });
      });
      root.querySelectorAll("[data-operational-task-area-field]").forEach((control) => {
        control.addEventListener("change", () => {
          void changeOperationalTaskArea(control.dataset.taskId, control.dataset.operationalTaskAreaField, control.type === "checkbox" ? control.checked : control.value);
        });
      });
      root.querySelectorAll("[data-task-area-point-field]").forEach((control) => {
        control.addEventListener("change", () => {
          void changeOperationalTaskPoint(control.dataset.taskId, control.dataset.pointId, control.dataset.taskAreaPointField, control.value);
        });
      });
      root.querySelectorAll("[data-force-mission-type]").forEach((control) => {
        control.addEventListener("change", () => {
          void changeForceMissionType(
            control.dataset.forceMissionType,
            control.value,
            control.dataset.forceLayer || "concept"
          );
        });
      });
      root.querySelectorAll("[data-combat-concept-link]").forEach((control) => {
        control.addEventListener("change", () => {
          void changeCombatConceptLink(control.dataset.combatConceptLink, control.value);
        });
      });
      root.querySelectorAll("[data-force-task-ref]").forEach((control) => {
        control.addEventListener("change", () => {
          void changeForceTaskRef(
            control.dataset.forceId,
            control.dataset.taskRef,
            control.checked,
            control.dataset.forceLayer || "concept"
          );
        });
      });
      root.querySelectorAll("[data-force-platform-qty]").forEach((control) => {
        control.addEventListener("change", () => {
          void changePlatformQuantity(
            control.dataset.forcePlatformQty,
            control.dataset.platformId,
            control.value,
            control.dataset.forceLayer || "concept"
          );
        });
      });
      root.querySelectorAll("[data-force-platform-query]").forEach((control) => {
        control.addEventListener("change", () => rememberPickerField(
          control.dataset.forcePlatformQuery,
          control.dataset.forceLayer || "concept",
          { query: control.value }
        ));
        control.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            const layer = control.dataset.forceLayer || "concept";
            rememberPickerField(control.dataset.forcePlatformQuery, layer, { query: control.value });
            void searchForcePlatforms(control.dataset.forcePlatformQuery, layer);
          }
        });
      });
      root.querySelectorAll("[data-force-platform-domain]").forEach((control) => {
        control.addEventListener("change", () => rememberPickerField(
          control.dataset.forcePlatformDomain,
          control.dataset.forceLayer || "concept",
          { domain: control.value }
        ));
      });
      root.querySelectorAll("[data-force-platform-country]").forEach((control) => {
        control.addEventListener("change", () => rememberPickerField(
          control.dataset.forcePlatformCountry,
          control.dataset.forceLayer || "concept",
          { country: control.value }
        ));
      });
      root.querySelector("#forceRecommendCountry")?.addEventListener("change", (event) => {
        const state = getState();
        state.forcePlatformRecommend = {
          ...recommendStateDefaults(state),
          ...state.forcePlatformRecommend,
          country: event.currentTarget.value || ""
        };
      });
    },
    generateCombatFocus,
    generateOperationalTasks,
    generateForceMission,
    generatePhaseAction,
    generateConceptGraphic
  };

  async function generateOperationalTasks({ silent = false } = {}) {
    const state = getState();
    if (state.phaseAction?.status !== "confirmed" || state.phaseActionStorage?.stale) {
      if (!silent) notify("请先确认阶段与行动");
      return null;
    }
    if (state.operationalTaskGenerating) return null;
    state.operationalTaskGenerating = true;
    state.operationalTaskGenerationProgress = null;
    render();
    try {
      const batches = buildOperationalTaskGenerationBatches(compactPhaseAction(state.phaseAction), 3);
      if (!batches.length) throw new Error("No operational task inputs");
      state.operationalTaskGenerationProgress = { completed: 0, total: batches.length };
      render();
      const results = [];
      const generateBatch = async (batch) => {
        let lastError = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const response = await generateWithAi({
              workflowId: "operational-task",
              workflow: { id: "operational-task", title: "作战任务与任务区域", outputSchema: "OperationalTaskDraft" },
              analysis: {
                ...briefAnalysis(state.brief),
                phaseAction: batch,
                cmoMissionTypes: listCmoMissionTypes(),
                taskAreaTypes: ["patrol", "prosecution", "support", "transit", "target", "exclusion", "other"],
                generationConstraint: "直接返回任务 JSON；禁止工具调用、web_search、搜索占位或过程说明。"
              },
              evidence: []
            });
            if (isAiOutput(response) && Array.isArray(response.result?.tasks) && response.result.tasks.length === batch.expectedTaskCount) return response;
            lastError = new Error("Incomplete operational task AI batch");
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError || new Error("Operational task AI batch failed");
      };
      for (let offset = 0; offset < batches.length; offset += 2) {
        const wave = batches.slice(offset, offset + 2);
        const responses = await Promise.all(wave.map(generateBatch));
        responses.forEach((response) => {
          results.push(response.result);
        });
        state.operationalTaskGenerationProgress = { completed: Math.min(offset + wave.length, batches.length), total: batches.length };
        render();
      }
      const draft = {
        tasks: results.flatMap((result, batchIndex) => result.tasks.map((task, taskIndex) => ({
          ...task,
          id: `ai-b${batchIndex + 1}-task-${taskIndex + 1}`
        }))),
        openQuestions: results.flatMap((result) => Array.isArray(result.openQuestions) ? result.openQuestions : [])
      };
      state.forceMission = persistForceMission(
        createOperationalTasksFromPhaseAction(state.forceMission, state.phaseAction, draft, { source: "ai" }),
        projectId
      );
      state.operationalTaskSelectedId = state.forceMission.tasks[0]?.id || "";
      await syncForceMission(state.forceMission, { source: "operational-task:generate" });
      if (!silent) notify(`AI 已形成 ${state.forceMission.tasks.length} 项任务及区域候选，请复核坐标依据`);
      return state.forceMission;
    } catch (error) {
      state.forceMission = persistForceMission(
        createOperationalTasksFromPhaseAction(state.forceMission, state.phaseAction, null, { source: "local" }),
        projectId
      );
      state.operationalTaskSelectedId = state.forceMission.tasks[0]?.id || "";
      await syncForceMission(state.forceMission, { source: "operational-task:generate-local" });
      if (!silent) notify(`AI 分批生成未完成，已保留本地任务草案；区域坐标尚未生成${error?.message ? `（${error.message}）` : ""}`);
      return state.forceMission;
    } finally {
      state.operationalTaskGenerating = false;
      state.operationalTaskGenerationProgress = null;
      render();
    }
  }

  async function changeOperationalTask(taskId, field, value) {
    if (!["name", "missionType", "objective", "expectedEffect"].includes(field)) return;
    const state = getState();
    await changeOperationalTaskPlan(updateOperationalTask(state.forceMission, taskId, { [field]: value }), "operational-task:edit");
  }

  async function changeOperationalTaskArea(taskId, field, value) {
    if (!["name", "type", "geometryType", "radiusNm", "description", "basis", "needsReview"].includes(field)) return;
    const state = getState();
    await changeOperationalTaskPlan(updateOperationalTaskArea(state.forceMission, taskId, { [field]: value }), "operational-task:edit-area");
  }

  async function changeOperationalTaskPoint(taskId, pointId, field, value) {
    if (!["label", "latitude", "longitude"].includes(field)) return;
    const state = getState();
    await changeOperationalTaskPlan(updateOperationalTaskAreaPoint(state.forceMission, taskId, pointId, { [field]: value }), "operational-task:edit-coordinate");
  }

  async function changeOperationalTaskPlan(next, source) {
    const state = getState();
    state.forceMission = persistForceMission(next, projectId);
    await syncForceMission(state.forceMission, { source });
    render();
  }

  async function confirmTasks() {
    const state = getState();
    try {
      state.forceMission = persistForceMission(confirmOperationalTasks(state.forceMission), projectId);
      await syncForceMission(state.forceMission, { source: "operational-task:confirm" });
      notify("作战任务已确认，进入作战兵力");
      await onOperationalTasksConfirmed?.(state.forceMission);
      render();
    } catch {
      notify("请先生成并复核作战任务");
    }
  }

  function normalizeLayer(layer) {
    return layer === "combat" ? "combat" : "concept";
  }

  function rememberPickerField(forceId, layer = "concept", patch = {}) {
    const state = getState();
    const id = String(forceId || "").trim();
    if (!id) return;
    const resolvedLayer = normalizeLayer(layer);
    const current = state.forcePlatformPicker || {};
    const same = current.forceId === id && normalizeLayer(current.layer) === resolvedLayer;
    state.forcePlatformPicker = {
      forceId: id,
      layer: resolvedLayer,
      query: same ? (current.query || "") : "",
      domain: same ? (current.domain || "") : "",
      country: same ? (current.country || "") : "",
      results: same ? (current.results || []) : [],
      selectedIndexes: same ? (Array.isArray(current.selectedIndexes) ? current.selectedIndexes : []) : [],
      searching: false,
      error: "",
      ...patch,
      forceId: id,
      layer: resolvedLayer
    };
  }

  function togglePlatformResultSelect(resultIndex, checked) {
    const state = getState();
    const picker = state.forcePlatformPicker || {};
    const index = Number(resultIndex);
    if (!Number.isInteger(index) || index < 0) return;
    const selected = new Set(Array.isArray(picker.selectedIndexes) ? picker.selectedIndexes : []);
    if (checked === false) selected.delete(index);
    else if (checked === true) selected.add(index);
    else if (selected.has(index)) selected.delete(index);
    else selected.add(index);
    state.forcePlatformPicker = {
      ...picker,
      selectedIndexes: [...selected].sort((a, b) => a - b)
    };
    render();
  }

  function selectAllPlatformResults(selectAll) {
    const state = getState();
    const picker = state.forcePlatformPicker || {};
    const results = Array.isArray(picker.results) ? picker.results : [];
    state.forcePlatformPicker = {
      ...picker,
      selectedIndexes: selectAll ? results.map((_, index) => index) : []
    };
    render();
  }

  async function batchAttachPlatformResults(forceId, layer = "combat", all = false) {
    const state = getState();
    const picker = state.forcePlatformPicker || {};
    const results = Array.isArray(picker.results) ? picker.results : [];
    if (!forceId || !results.length) {
      notify("没有可挂接的检索结果");
      return;
    }
    const resolvedLayer = normalizeLayer(layer);
    const indexes = all
      ? results.map((_, index) => index)
      : (Array.isArray(picker.selectedIndexes) ? picker.selectedIndexes : []);
    const platforms = indexes
      .map((index) => results[Number(index)])
      .filter(Boolean)
      .slice(0, resolvedLayer === "concept" ? 1 : 8);
    if (!platforms.length) {
      notify("请先勾选要挂接的平台");
      return;
    }
    const wasConfirmed = isForceMissionPlanConfirmed(state.forceMission, state.forceMissionStorage);
    let next;
    if (resolvedLayer === "concept") {
      next = applyPlatformRecommendations(state.forceMission, [{
        forceId,
        layer: "concept",
        platforms: platforms.slice(0, 1).map((item) => ({ ...item, quantity: 1 }))
      }]);
    } else {
      next = attachForcePlatforms(state.forceMission, forceId, platforms, "combat");
    }
    state.forceMission = persistForceMission(next, projectId);
    state.forcePlatformPicker = { ...picker, selectedIndexes: [] };
    try {
      await syncForceMission(state.forceMission, { source: "force-mission:batch-attach-platforms" });
    } catch {
      /* local draft remains */
    }
    notify(wasConfirmed
      ? `已批量挂接 ${platforms.length} 个平台，计划回到草案`
      : `已批量挂接 ${platforms.length} 个平台`);
    render();
  }

  function recommendStateDefaults(state = getState()) {
    const current = state.forcePlatformRecommend || {};
    return {
      status: "idle",
      running: false,
      skipFilled: current.skipFilled !== false,
      country: String(current.country || "").trim(),
      report: [],
      assignments: [],
      seeds: [],
      error: "",
      source: ""
    };
  }

  function toggleRecommendSkipFilled(checked) {
    const state = getState();
    state.forcePlatformRecommend = {
      ...recommendStateDefaults(state),
      ...state.forcePlatformRecommend,
      skipFilled: checked !== false
    };
    render();
  }

  function dismissPlatformRecommendations() {
    const state = getState();
    state.forcePlatformRecommend = {
      ...recommendStateDefaults(state),
      status: "idle",
      skipFilled: state.forcePlatformRecommend?.skipFilled !== false,
      country: state.forcePlatformRecommend?.country || ""
    };
    notify("已放弃推荐预览");
    render();
  }

  function toggleRecommendAssignment(forceId, checked) {
    const state = getState();
    const recommend = state.forcePlatformRecommend || {};
    const id = String(forceId || "").trim();
    if (!id || recommend.status !== "preview") return;
    const assignments = (Array.isArray(recommend.assignments) ? recommend.assignments : []).map((item) => (
      item.forceId === id ? { ...item, selected: checked !== false } : item
    ));
    const report = (Array.isArray(recommend.report) ? recommend.report : []).map((item) => (
      item.forceId === id && item.platforms?.length && !item.skipped
        ? { ...item, selected: checked !== false }
        : item
    ));
    state.forcePlatformRecommend = { ...recommend, assignments, report };
    render();
  }

  function selectAllRecommendAssignments(selectAll) {
    const state = getState();
    const recommend = state.forcePlatformRecommend || {};
    if (recommend.status !== "preview") return;
    const assignments = (Array.isArray(recommend.assignments) ? recommend.assignments : []).map((item) => ({
      ...item,
      selected: Boolean(selectAll)
    }));
    const selectedIds = new Set(assignments.filter((item) => item.selected !== false).map((item) => item.forceId));
    const report = (Array.isArray(recommend.report) ? recommend.report : []).map((item) => (
      item.platforms?.length && !item.skipped
        ? { ...item, selected: selectedIds.has(item.forceId) }
        : item
    ));
    state.forcePlatformRecommend = { ...recommend, assignments, report };
    render();
  }

  function removeRecommendPlatform(forceId, domain, cmoId) {
    const state = getState();
    const recommend = state.forcePlatformRecommend || {};
    const id = String(forceId || "").trim();
    if (!id || recommend.status !== "preview") return;
    const cmo = Number(cmoId) || 0;
    const domainKey = String(domain || "").trim();
    const assignments = [];
    for (const item of Array.isArray(recommend.assignments) ? recommend.assignments : []) {
      if (item.forceId !== id) {
        assignments.push(item);
        continue;
      }
      const platforms = (item.platforms || []).filter((platform) => !(
        platform.domain === domainKey && Number(platform.cmoId) === cmo
      ));
      if (platforms.length) {
        assignments.push({ ...item, platforms, selected: item.selected !== false });
      }
    }
    const report = (Array.isArray(recommend.report) ? recommend.report : []).map((item) => {
      if (item.forceId !== id || item.skipped) return item;
      const platforms = (item.platforms || []).filter((platform) => !(
        platform.domain === domainKey && Number(platform.cmoId) === cmo
      ));
      if (!platforms.length) {
        return {
          ...item,
          platforms: [],
          selected: false,
          status: "已从预览移除全部平台"
        };
      }
      return {
        ...item,
        platforms,
        status: `推荐 ${platforms.length} 个平台`
      };
    });
    state.forcePlatformRecommend = {
      ...recommend,
      assignments,
      report,
      status: assignments.length ? "preview" : "empty"
    };
    render();
  }

  function selectedRecommendAssignments(recommend = {}, { onlySelected = true, forceId = "" } = {}) {
    const id = String(forceId || "").trim();
    const list = Array.isArray(recommend.assignments) ? recommend.assignments : [];
    return list.filter((item) => {
      if (!item?.forceId || !Array.isArray(item.platforms) || !item.platforms.length) return false;
      if (id) return item.forceId === id;
      if (!onlySelected) return true;
      return item.selected !== false;
    });
  }

  async function applyPendingPlatformRecommendations({ onlySelected = true, forceId = "" } = {}) {
    const state = getState();
    const recommend = state.forcePlatformRecommend || {};
    const assignments = selectedRecommendAssignments(recommend, { onlySelected, forceId });
    if (!assignments.length) {
      notify(forceId ? "该作战兵力没有可应用的推荐" : "请先勾选要应用的推荐条目");
      return;
    }
    if (state.forceMissionGenerating || recommend.running) {
      notify("正在处理兵力相关操作，请稍候");
      return;
    }
    const wasConfirmed = isForceMissionPlanConfirmed(state.forceMission, state.forceMissionStorage);
    const next = applyPlatformRecommendations(state.forceMission, assignments);
    state.forceMission = persistForceMission(next, projectId);
    try {
      await syncForceMission(state.forceMission, { source: "force-mission:apply-platform-recommendations" });
    } catch {
      /* local draft remains */
    }

    // Keep remaining unapplied preview items when applying a subset.
    const appliedIds = new Set(assignments.map((item) => item.forceId));
    const remainingAssignments = (Array.isArray(recommend.assignments) ? recommend.assignments : [])
      .filter((item) => !appliedIds.has(item.forceId));
    const remainingReport = (Array.isArray(recommend.report) ? recommend.report : []).map((item) => {
      if (!appliedIds.has(item.forceId)) return item;
      return {
        ...item,
        status: `已应用 ${item.platforms?.length || 0} 个平台`,
        selected: false,
        applied: true
      };
    });

    state.forcePlatformRecommend = {
      ...recommendStateDefaults(state),
      status: remainingAssignments.length ? "preview" : "applied",
      skipFilled: recommend.skipFilled !== false,
      country: recommend.country || "",
      report: remainingReport,
      assignments: remainingAssignments,
      seeds: recommend.seeds || [],
      source: recommend.source || "manual"
    };
    notify(wasConfirmed
      ? `已应用 ${assignments.length} 条平台推荐，计划回到草案`
      : `已应用 ${assignments.length} 条平台推荐`);
    render();
  }

  /**
   * Attach real CMO platforms silently.
   * - target=concept: one equipment type per concept force
   * - target=combat: refine combat composition (up to 2 platforms)
   * @param {{ apply?: boolean, silent?: boolean, source?: string, target?: "concept"|"combat" }} options
   */
  async function recommendPlatformsFromPhases({
    apply = true,
    silent = false,
    source = "manual",
    target = "combat"
  } = {}) {
    const state = getState();
    if (state.forcePlatformRecommend?.running || state.forceMissionGenerating) {
      if (!silent) notify("正在处理兵力相关操作，请稍候");
      return null;
    }
    if (!state.cmoCatalogStatus?.open) {
      if (!silent) notify("CMO 装备目录未连接，请先在系统管理配置数据库");
      return null;
    }
    const isConcept = target === "concept";
    const forceList = isConcept
      ? (Array.isArray(state.forceMission?.forces) ? state.forceMission.forces : [])
      : (Array.isArray(state.forceMission?.combatForces) ? state.forceMission.combatForces : []);
    if (!forceList.length) {
      if (!silent) notify(isConcept ? "请先生成概念兵力" : "请先生成作战兵力");
      return null;
    }
    const phases = Array.isArray(state.phaseAction?.phases) ? state.phaseAction.phases : [];
    if (phases.length < 1) {
      if (!silent) notify("缺少阶段与行动输入，无法匹配装备");
      return null;
    }

    const countryInput = String(state.forcePlatformRecommend?.country || "").trim();
    // Combat: skip only when real CMO models already attached (keyword AEW/MPA counts as empty).
    const skipFilled = isConcept
      ? false
      : state.forcePlatformRecommend?.skipFilled !== false;
    const platformLimit = isConcept ? 1 : 2;
    const layer = isConcept ? "concept" : "combat";
    const seeds = summarizePhaseRecommendSeeds(state.phaseAction);
    state.forcePlatformRecommend = {
      ...recommendStateDefaults(state),
      status: "running",
      running: true,
      skipFilled,
      country: countryInput,
      seeds,
      source,
      report: [],
      assignments: []
    };
    render();

    const assignments = [];
    try {
      const brief = state.brief || {};
      const sideCountries = resolveSideCountries(brief);
      for (const force of forceList) {
        const already = Array.isArray(force.platforms) ? force.platforms : [];
        const seed = seedConceptEquipmentType(force, brief);
        // Never skip keyword-only placeholders — they must be upgraded to real CMO models.
        if (isConcept && hasRealEquipmentPlatform(force) && platformFitsConceptForce(already[0], force, brief)) {
          continue;
        }
        if (!isConcept && skipFilled && hasRealEquipmentPlatform(force)) continue;

        const sideKey = force.side === "hostile" ? "hostile" : "friendly";
        const otherKey = sideKey === "hostile" ? "friendly" : "hostile";
        const sideCountry = countryInput || sideCountries[sideKey] || seed.country
          || preferredCountryForForceSide(sideKey, brief) || "";
        const otherCountry = sideCountries[otherKey] || "";
        // Duty-first CMO Name aliases (E-2D / KJ-500…); generic AEW alone misses most US airframes.
        const dutyTerms = dutyCmoSearchTerms(force, sideCountry);
        const keywords = buildForceRecommendKeywords(force, state.phaseAction, { max: 5 });
        const searchKeys = uniqueSearchKeys([...dutyTerms, seed.name, seed.category, ...keywords]);
        const domains = [seed.domain, ...(preferredDomainsForForce(force) || [])].filter(Boolean);
        const hits = [];
        const seen = new Set();
        const collectHits = (found) => {
          for (const hit of found) {
            if (!hit?.name || !(Number(hit.cmoId) > 0)) continue;
            if (isEquipmentKeywordOnly(hit)) continue;
            if (!platformFitsConceptForce(hit, force, brief) && isConcept) continue;
            if (sideCountry && hit.country && !countryNamesOverlap(hit.country, sideCountry)) {
              // Drop other-side ecosystem even if CMO returns mixed rows.
              if (otherCountry && countryNamesOverlap(hit.country, otherCountry)) continue;
              if (!countryNamesOverlap(hit.country, sideCountry)) continue;
            }
            if (otherCountry && hit.country && countryNamesOverlap(hit.country, otherCountry)
              && sideCountry && !countryNamesOverlap(hit.country, sideCountry)) {
              continue;
            }
            const key = `${hit.domain}:${hit.cmoId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            hits.push(hit);
          }
        };
        for (const keyword of searchKeys.slice(0, 6)) {
          for (const domain of [...new Set([seed.domain || domains[0] || "", ""])]) {
            try {
              const found = await searchCmoPlatforms({
                q: keyword,
                domain: domain || "",
                country: sideCountry || undefined,
                limit: 8
              });
              collectHits(found);
            } catch {
              /* continue */
            }
          }
          if (hits.length >= 4) break;
        }
        // Retry without country filter, then keep only this side / exclude other side.
        if (!hits.length && sideCountry) {
          for (const keyword of searchKeys.slice(0, 4)) {
            try {
              const found = await searchCmoPlatforms({
                q: keyword,
                domain: seed.domain || "",
                limit: 10
              });
              collectHits(found.filter((hit) => {
                if (!hit.country) return true;
                if (countryNamesOverlap(hit.country, sideCountry)) return true;
                if (otherCountry && countryNamesOverlap(hit.country, otherCountry)) return false;
                return false;
              }));
            } catch {
              /* continue */
            }
            if (hits.length >= 3) break;
          }
        }
        let platforms;
        if (isConcept) {
          const good = hits.filter((item) => platformFitsConceptForce(item, force, brief));
          const pick = good[0] || hits[0];
          platforms = pick
            ? [{ ...pick, quantity: 1, country: pick.country || sideCountry }]
            : [{ ...seed, quantity: 1, country: sideCountry || seed.country || "" }];
        } else {
          platforms = selectRecommendedPlatforms(
            { ...force, platforms: already.filter((item) => !isEquipmentKeywordOnly(item)) },
            hits,
            { limit: platformLimit }
          );
          if (!platforms.length && hits[0]) {
            platforms = [{ ...hits[0], quantity: already[0]?.quantity || 1 }];
          }
          if (!platforms.length && already.length && hasRealEquipmentPlatform(force)) {
            platforms = already.slice(0, platformLimit);
          }
          if (!platforms.length) {
            platforms = [{ ...seed, quantity: already[0]?.quantity || 1, country: sideCountry || seed.country || "" }];
          }
        }
        if (platforms.length) {
          assignments.push({
            forceId: force.id,
            layer,
            platforms,
            selected: true
          });
        }
      }

      if (apply && assignments.length) {
        const wasConfirmed = isForceMissionPlanConfirmed(state.forceMission, state.forceMissionStorage);
        const next = applyPlatformRecommendations(state.forceMission, assignments);
        state.forceMission = persistForceMission(next, projectId);
        try {
          await syncForceMission(state.forceMission, {
            source: isConcept
              ? "force-mission:recommend-concept-equipment"
              : "force-mission:recommend-platforms"
          });
        } catch {
          /* local draft remains */
        }
        state.forcePlatformRecommend = {
          ...recommendStateDefaults(state),
          status: "idle",
          skipFilled,
          country: countryInput,
          report: [],
          assignments: [],
          seeds: [],
          source
        };
        if (!silent) {
          notify(wasConfirmed
            ? `已为${isConcept ? "概念" : "作战"}兵力挂接真实装备类型（${assignments.length} 条），计划回到草案`
            : `已为${isConcept ? "概念" : "作战"}兵力挂接真实装备类型（${assignments.length} 条）`);
        }
      } else {
        state.forcePlatformRecommend = {
          ...recommendStateDefaults(state),
          status: "idle",
          skipFilled,
          country: countryInput,
          report: [],
          assignments: [],
          seeds: [],
          source
        };
        if (!silent && !assignments.length) {
          notify(isConcept
            ? "未能从装备库匹配概念装备（已保留型号种子），可稍后重试连接 CMO"
            : "未能匹配到可挂接平台，请在作战编成表内编辑平台");
        }
      }
      return state.forcePlatformRecommend;
    } catch (error) {
      state.forcePlatformRecommend = {
        ...recommendStateDefaults(state),
        status: "idle",
        skipFilled,
        country: countryInput,
        report: [],
        seeds: [],
        source,
        error: error?.message || "装备匹配失败"
      };
      if (!silent) notify(error?.message || "装备匹配失败");
      return null;
    } finally {
      const current = getState().forcePlatformRecommend || {};
      if (current.running) {
        getState().forcePlatformRecommend = { ...current, running: false };
      }
      render();
    }
  }

  async function changeForceMissionType(forceId, missionType, layer = "concept") {
    const state = getState();
    if (!forceId || state.forceMissionGenerating) return;
    const wasConfirmed = isForceMissionPlanConfirmed(state.forceMission, state.forceMissionStorage);
    const next = updateForceMissionType(state.forceMission, forceId, missionType, normalizeLayer(layer));
    state.forceMission = persistForceMission(next, projectId);
    try {
      await syncForceMission(state.forceMission, { source: "force-mission:edit-mission-type" });
    } catch {
      /* local draft remains */
    }
    if (wasConfirmed) notify("任务类型已改，兵力与任务回到草案，请复核后重新确认");
    else notify("任务类型已更新");
    render();
  }

  async function changeCombatConceptLink(forceId, conceptForceId) {
    const state = getState();
    if (!forceId || state.forceMissionGenerating) return;
    const wasConfirmed = isForceMissionPlanConfirmed(state.forceMission, state.forceMissionStorage);
    const next = updateCombatConceptLink(state.forceMission, forceId, conceptForceId);
    state.forceMission = persistForceMission(next, projectId);
    try {
      await syncForceMission(state.forceMission, { source: "force-mission:edit-concept-link" });
    } catch {
      /* local draft remains */
    }
    if (wasConfirmed) notify("概念挂接已改，兵力与任务回到草案");
    else notify("已更新作战兵力的概念挂接");
    render();
  }

  async function changeForceTaskRef(forceId, taskRef, checked, layer = "concept") {
    const state = getState();
    if (!forceId || !taskRef || state.forceMissionGenerating) return;
    const wasConfirmed = isForceMissionPlanConfirmed(state.forceMission, state.forceMissionStorage);
    const next = toggleForceTaskRef(state.forceMission, forceId, taskRef, checked, normalizeLayer(layer));
    state.forceMission = persistForceMission(next, projectId);
    try {
      await syncForceMission(state.forceMission, { source: "force-mission:edit-task-ref" });
    } catch {
      /* local draft remains */
    }
    notify(wasConfirmed ? "任务承接已修改，兵力计划回到草案" : "任务承接关系已更新");
    render();
  }

  async function changePlatformQuantity(forceId, platformId, quantity, layer = "concept") {
    const state = getState();
    if (!forceId || !platformId || state.forceMissionGenerating) return;
    const wasConfirmed = isForceMissionPlanConfirmed(state.forceMission, state.forceMissionStorage);
    const next = setForcePlatformQuantity(state.forceMission, forceId, platformId, quantity, normalizeLayer(layer));
    state.forceMission = persistForceMission(next, projectId);
    try {
      await syncForceMission(state.forceMission, { source: "force-mission:edit-platform-qty" });
    } catch {
      /* local draft remains */
    }
    if (wasConfirmed) notify("平台数量已改，兵力与任务回到草案");
    render();
  }

  function openForcePlatformPicker(forceId, layer = "combat") {
    const state = getState();
    const id = String(forceId || "").trim();
    const resolvedLayer = normalizeLayer(layer);
    if (!id) return;
    const force = resolvedLayer === "combat"
      ? (state.forceMission?.combatForces || []).find((item) => item.id === id)
      : (state.forceMission?.forces || []).find((item) => item.id === id);
    if (!force) {
      notify("未找到对应兵力单元");
      return;
    }
    // 概念层：无目录时仍可展开任务详情；作战层无目录时仍可改数量/移除已有平台。
    const catalogOpen = Boolean(state.cmoCatalogStatus?.open);
    if (!catalogOpen && resolvedLayer === "combat") {
      // still open for quantity/remove; search disabled in view
    }
    const same = state.forcePlatformPicker?.forceId === id
      && normalizeLayer(state.forcePlatformPicker?.layer) === resolvedLayer;
    if (same) {
      // 再次点击同一单元 → 收起，形成开关闭环
      closeForcePlatformPicker();
      return;
    }
    const wasOpen = Boolean(state.forcePlatformPicker?.forceId);
    const seed = String(force?.name || "")
      .replace(/^(蓝方|红方)[·•\s]*/u, "")
      .split(/[·•\s]/u)
      .filter(Boolean)
      .slice(-2)
      .join(" ")
      .slice(0, 40);
    if (resolvedLayer === "concept") state.forceMissionLayerTab = "concept";
    if (resolvedLayer === "combat") state.forceMissionLayerTab = "combat";
    state.forcePlatformPicker = {
      forceId: id,
      layer: resolvedLayer,
      query: seed,
      domain: "",
      country: state.forcePlatformPicker?.country || "",
      results: [],
      selectedIndexes: [],
      searching: false,
      error: catalogOpen ? "" : "装备目录未连接，仅可查看/移除已有引用"
    };
    // 仅从关闭 → 打开时播滑入；切换单元不重播。
    state.forceDetailDrawerEnter = !wasOpen;
    render();
    if (state.forceDetailDrawerEnter) {
      requestAnimationFrame(() => {
        getState().forceDetailDrawerEnter = false;
      });
    }
  }

  function closeForcePlatformPicker() {
    const state = getState();
    state.forceDetailDrawerEnter = false;
    state.forcePlatformPicker = {
      forceId: "",
      layer: state.forcePlatformPicker?.layer || "combat",
      query: "",
      domain: "",
      country: state.forcePlatformPicker?.country || "",
      results: [],
      selectedIndexes: [],
      searching: false,
      error: ""
    };
    render();
  }

  async function searchForcePlatforms(forceId, layer = "concept") {
    const state = getState();
    const id = String(forceId || "").trim();
    const resolvedLayer = normalizeLayer(layer);
    if (!id) return;
    if (!state.cmoCatalogStatus?.open) {
      notify("CMO 装备目录未连接，请先在系统管理配置数据库");
      return;
    }
    const card = document.querySelector(`[data-force-card="${cssEscape(id)}"][data-force-layer="${cssEscape(resolvedLayer)}"]`);
    const force = resolvedLayer === "combat"
      ? (state.forceMission?.combatForces || []).find((item) => item.id === id)
      : (state.forceMission?.forces || []).find((item) => item.id === id);
    const seed = String(force?.name || "").replace(/^(蓝方|红方)[·•\s]*/u, "").slice(0, 40);
    const query = card?.querySelector(`[data-force-platform-query="${cssEscape(id)}"]`)?.value?.trim()
      || state.forcePlatformPicker?.query
      || seed
      || "";
    const domain = card?.querySelector(`[data-force-platform-domain="${cssEscape(id)}"]`)?.value
      || state.forcePlatformPicker?.domain
      || "";
    const country = card?.querySelector(`[data-force-platform-country="${cssEscape(id)}"]`)?.value?.trim()
      || state.forcePlatformPicker?.country
      || "";
    if (!query) {
      notify("请输入平台名称关键词");
      return;
    }
    state.forcePlatformPicker = {
      forceId: id,
      layer: resolvedLayer,
      query,
      domain,
      country,
      results: [],
      selectedIndexes: [],
      searching: true,
      error: ""
    };
    render();
    try {
      const results = await searchCmoPlatforms({ q: query, domain, country, limit: 12 });
      state.forcePlatformPicker = {
        forceId: id,
        layer: resolvedLayer,
        query,
        domain,
        country,
        results,
        selectedIndexes: [],
        searching: false,
        error: results.length ? "" : "无匹配结果"
      };
      if (!results.length) notify("未找到匹配平台");
    } catch (error) {
      state.forcePlatformPicker = {
        forceId: id,
        layer: resolvedLayer,
        query,
        domain,
        country,
        results: [],
        selectedIndexes: [],
        searching: false,
        error: error?.message || "检索失败"
      };
      notify(error?.message || "平台检索失败");
    }
    render();
  }

  async function attachPlatformFromResult(forceId, resultIndex, layer = "combat") {
    const state = getState();
    const index = Number(resultIndex);
    const hit = state.forcePlatformPicker?.results?.[index];
    if (!forceId || !hit) {
      notify("未找到要挂接的平台结果");
      return;
    }
    const resolvedLayer = normalizeLayer(layer);
    const wasConfirmed = isForceMissionPlanConfirmed(state.forceMission, state.forceMissionStorage);
    const next = resolvedLayer === "concept"
      ? applyPlatformRecommendations(state.forceMission, [{
        forceId,
        layer: "concept",
        platforms: [{ ...hit, quantity: 1 }]
      }])
      : attachForcePlatform(state.forceMission, forceId, hit, "combat");
    state.forceMission = persistForceMission(next, projectId);
    try {
      await syncForceMission(state.forceMission, { source: "force-mission:attach-platform" });
    } catch {
      /* local draft remains */
    }
    notify(wasConfirmed ? `已挂接 ${hit.name}，计划回到草案` : `已挂接 ${hit.name}`);
    render();
  }

  async function removePlatform(forceId, platformId, layer = "concept") {
    const state = getState();
    if (!forceId || !platformId) return;
    const wasConfirmed = isForceMissionPlanConfirmed(state.forceMission, state.forceMissionStorage);
    const next = removeForcePlatform(state.forceMission, forceId, platformId, normalizeLayer(layer));
    state.forceMission = persistForceMission(next, projectId);
    try {
      await syncForceMission(state.forceMission, { source: "force-mission:remove-platform" });
    } catch {
      /* local draft remains */
    }
    notify(wasConfirmed ? "已移除平台引用，计划回到草案" : "已移除平台引用");
    render();
  }

  function cssEscape(value) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
    return String(value || "").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  }

  async function generateCombatFocus({ silent = false } = {}) {
    const state = getState();
    if (state.combatFocusGenerating) {
      if (!silent) notify("作战聚焦正在生成");
      return null;
    }
    const previousSelected = getSelectedCombatFocuses(state.combatFocus);
    const customOptions = (state.combatFocus?.options || []).filter((item) => item.source === "custom");
    state.combatFocusGenerating = true;
    render();
    // Let transition overlay paint before the AI request (enter-from-规则库 path).
    if (typeof requestAnimationFrame === "function") {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    const startedAt = Date.now();
    try {
      const response = await generateWithAi({
        workflowId: "combat-focus",
        workflow: { id: "combat-focus", title: "作战聚焦候选", outputSchema: "CombatFocusOptions" },
        analysis: briefAnalysis(state.brief),
        evidence: []
      });
      const plan = isAiOutput(response) ? response.result : null;
      const next = createCombatFocusFromAi(plan, state.brief, { source: isAiOutput(response) ? "ai" : "local" });
      const merged = {
        ...next,
        options: [...next.options, ...customOptions].slice(0, 12),
        status: "draft",
        confirmedAt: ""
      };
      const restoredIds = [];
      for (const prev of previousSelected) {
        if (prev.source === "custom" && customOptions.some((item) => item.id === prev.id)) restoredIds.push(prev.id);
        else {
          const match = next.options.find((item) => item.title === prev.title);
          if (match) restoredIds.push(match.id);
        }
      }
      if (restoredIds.length) merged.selectedIds = restoredIds.slice(0, 3);
      state.combatFocus = persistCombatFocus(merged, projectId);
      if (!silent) notify(isAiOutput(response) ? "已生成 3 个作战聚焦候选，可多选后确认" : "已生成本地作战聚焦候选，可多选后确认");
      return state.combatFocus;
    } catch {
      const fallback = createCombatFocusFromAi(null, state.brief, { source: "local" });
      state.combatFocus = persistCombatFocus({
        ...fallback,
        options: [...fallback.options, ...customOptions].slice(0, 12),
        status: "draft",
        confirmedAt: ""
      }, projectId);
      if (!silent) notify("AI 暂不可用，已生成本地作战聚焦候选");
      return state.combatFocus;
    } finally {
      // Keep transition overlay readable when entering from 规则库 capsule.
      const elapsed = Date.now() - startedAt;
      if (elapsed < 560) {
        await new Promise((resolve) => {
          const delay = typeof globalThis.setTimeout === "function" ? globalThis.setTimeout.bind(globalThis) : setTimeout;
          delay(resolve, 560 - elapsed);
        });
      }
      state.combatFocusGenerating = false;
      render();
    }
  }

  function addCustomFocusFromForm() {
    const state = getState();
    const title = document.querySelector("#combatFocusCustomTitle")?.value || "";
    const text = document.querySelector("#combatFocusCustomText")?.value || "";
    try {
      state.combatFocus = persistCombatFocus(addCustomCombatFocus(state.combatFocus, { title, text }), projectId);
      const titleInput = document.querySelector("#combatFocusCustomTitle");
      const textInput = document.querySelector("#combatFocusCustomText");
      if (titleInput) titleInput.value = "";
      if (textInput) textInput.value = "";
      const selected = getSelectedCombatFocuses(state.combatFocus);
      notify(`已新增作战聚焦「${selected.at(-1)?.title || title}」，请确认聚焦后生成阶段`);
      render();
    } catch (error) {
      notify(error?.message || "新增作战聚焦失败");
    }
  }

  async function confirmCombatFocusAndGeneratePhases() {
    const state = getState();
    if (state.combatFocusGenerating || state.phaseActionGenerating) {
      notify("生成中，请稍后再确认");
      return;
    }
    try {
      state.combatFocus = persistCombatFocus(confirmCombatFocus(state.combatFocus), projectId);
      const labels = getSelectedCombatFocuses(state.combatFocus).map((item) => item.title).join("、");
      notify(`作战聚焦已确认（${labels}），正在自动生成阶段草案`);
      render();
      await generatePhaseAction({ withNotes: false, silent: false });
    } catch (error) {
      notify(error?.message || "确认作战聚焦失败");
    }
  }

  /**
   * Generate force-mission draft by layer.
   * @param {{ withNotes?: boolean, silent?: boolean, layer?: "both"|"concept"|"combat" }} options
   */
  async function generateForceMission({ withNotes = false, silent = false, layer = "both" } = {}) {
    const state = getState();
    if (state.forceMissionGenerating) {
      if (!silent) notify("兵力与任务正在生成");
      return null;
    }
    const scope = layer === "concept" || layer === "combat" ? layer : "both";
    const previous = state.forceMission || null;
    if (!(previous?.tasks || []).length || !previous?.tasksConfirmedAt) {
      if (!silent) notify("请先生成并确认作战任务");
      return null;
    }
    if (scope === "combat") {
      const conceptCount = Array.isArray(previous?.forces) ? previous.forces.length : 0;
      if (!conceptCount) {
        if (!silent) notify("请先生成概念兵力");
        return null;
      }
    }
    const upstream = inspectForceMissionUpstream(state);
    if (!upstream.ok) {
      if (!silent) notify(upstream.message);
      return null;
    }
    const reviewNotes = withNotes
      ? document.querySelector("#forceMissionReviewNotes")?.value || state.forceMission?.reviewNotes || ""
      : state.forceMission?.reviewNotes || "";
    state.forceMissionGenerating = true;
    state.forceMissionGeneratingLayer = scope;
    render();
    try {
      const cmoHint = await buildCmoHintForForceMission(state, upstream);
      state.cmoCatalogStatus = cmoHint.status || state.cmoCatalogStatus || null;
      const existingConcept = compactForceMissionForAnalysis(previous);
      const response = await generateWithAi({
        workflowId: "force-mission",
        workflow: {
          id: "force-mission",
          title: scope === "concept"
            ? "概念兵力生成"
            : scope === "combat"
              ? "作战兵力生成"
              : "兵力与任务设计",
          outputSchema: "ForceMissionPlan"
        },
        analysis: {
          ...briefAnalysis(state.brief),
          phaseAction: compactPhaseAction(state.phaseAction),
          phaseActionStatus: upstream.phaseStatus,
          phaseActionConfirmed: upstream.phaseConfirmed,
          cmoMissionTypes: listCmoMissionTypes(),
          cmoCatalog: cmoHint.catalog,
          reviewNotes: String(reviewNotes || "").trim(),
          forceLayer: scope,
          operationalTasks: existingConcept.tasks,
          existingForceMission: scope === "combat" ? existingConcept : null
        },
        evidence: []
      });
      const plan = isAiOutput(response) ? response.result : null;
      const next = createForceMissionPlanFromBrief(state.brief, plan, {
        source: isAiOutput(response) ? "ai" : "local",
        phaseAction: state.phaseAction,
        layer: scope,
        previous
      });
      if (reviewNotes) next.reviewNotes = String(reviewNotes).trim();
      state.forceMission = persistForceMission(next, projectId);
      await syncForceMission(state.forceMission, {
        source: scope === "concept"
          ? "force-mission:generate-concept"
          : scope === "combat"
            ? "force-mission:generate-combat"
            : "force-mission:generate"
      });
      onForceMissionGenerated?.(state.forceMission);
      if (!silent) {
        const phaseNote = upstream.phaseConfirmed ? "" : "（阶段未确认，按草案生成）";
        if (scope === "concept") {
          notify(isAiOutput(response)
            ? `概念兵力已生成${phaseNote}。下一步：生成作战编成`
            : `已生成本地概念兵力${phaseNote}。下一步：生成作战编成`);
        } else if (scope === "combat") {
          notify(isAiOutput(response)
            ? `作战兵力已生成${phaseNote}，请复核编成与平台后确认`
            : `已生成本地作战兵力${phaseNote}，请复核后确认`);
        } else {
          notify(isAiOutput(response)
            ? `兵力与任务草案已生成${phaseNote}，请复核`
            : `已生成本地兵力与任务草案${phaseNote}，请复核`);
        }
      }
      state.forceMissionGenerating = false;
      state.forceMissionGeneratingLayer = "";
      // Concept-only: concept tab; combat/both: jump to combat composition for review.
      if (scope === "concept") state.forceMissionLayerTab = "concept";
      if (scope === "combat" || scope === "both") state.forceMissionLayerTab = "combat";
      // 生成后收起平台编辑器，避免旧 forceId 残留
      state.forcePlatformPicker = {
        forceId: "",
        layer: state.forceMissionLayerTab || "concept",
        query: "",
        domain: "",
        country: state.forcePlatformPicker?.country || "",
        results: [],
        selectedIndexes: [],
        searching: false,
        error: ""
      };
      render();
      if (scope === "concept" || scope === "both") {
        await maybeAutoRecommendAfterGenerate({ silent: true, target: "concept" });
      }
      if (scope === "combat" || scope === "both") {
        await maybeAutoRecommendAfterGenerate({ silent: true, target: "combat" });
      }
      return state.forceMission;
    } catch {
      const fallback = createForceMissionPlanFromBrief(state.brief, null, {
        source: "local",
        phaseAction: state.phaseAction,
        layer: scope,
        previous
      });
      if (reviewNotes) fallback.reviewNotes = String(reviewNotes).trim();
      state.forceMission = persistForceMission(fallback, projectId);
      try {
        await syncForceMission(state.forceMission, {
          source: scope === "concept"
            ? "force-mission:generate-concept-fallback"
            : scope === "combat"
              ? "force-mission:generate-combat-fallback"
              : "force-mission:generate-fallback"
        });
      } catch { /* local ok */ }
      onForceMissionGenerated?.(state.forceMission);
      if (!silent) {
        const label = scope === "concept" ? "概念兵力" : scope === "combat" ? "作战兵力" : "兵力与任务草案";
        notify(`AI 暂不可用，已生成本地${label}`);
      }
      state.forceMissionGenerating = false;
      state.forceMissionGeneratingLayer = "";
      if (scope === "concept") state.forceMissionLayerTab = "concept";
      if (scope === "combat" || scope === "both") state.forceMissionLayerTab = "combat";
      state.forcePlatformPicker = {
        forceId: "",
        layer: state.forceMissionLayerTab || "concept",
        query: "",
        domain: "",
        country: state.forcePlatformPicker?.country || "",
        results: [],
        selectedIndexes: [],
        searching: false,
        error: ""
      };
      render();
      if (scope === "concept" || scope === "both") {
        await maybeAutoRecommendAfterGenerate({ silent: true, target: "concept" });
      }
      if (scope === "combat" || scope === "both") {
        await maybeAutoRecommendAfterGenerate({ silent: true, target: "combat" });
      }
      return state.forceMission
    } finally {
      if (getState().forceMissionGenerating) {
        getState().forceMissionGenerating = false;
        getState().forceMissionGeneratingLayer = "";
        render();
      }
    }
  }

  async function maybeAutoRecommendAfterGenerate({
    silent = false,
    target = "combat"
  } = {}) {
    const state = getState();
    if (!state.cmoCatalogStatus?.open) return;
    if (!Array.isArray(state.phaseAction?.phases) || state.phaseAction.phases.length < 1) return;
    if (target === "concept") {
      if (!Array.isArray(state.forceMission?.forces) || !state.forceMission.forces.length) return;
    } else if (!Array.isArray(state.forceMission?.combatForces) || !state.forceMission.combatForces.length) {
      return;
    }
    // Direct-apply real equipment; no recommend preview UI.
    await recommendPlatformsFromPhases({
      apply: true,
      silent,
      source: "auto-after-generate",
      target
    });
  }

  async function confirmForceMission() {
    const state = getState();
    if (state.forceMissionGenerating || state.forcePlatformRecommend?.running) {
      notify("生成或平台推荐进行中，请稍后再确认");
      return;
    }
    try {
      const reviewNotes = document.querySelector("#forceMissionReviewNotes")?.value || state.forceMission?.reviewNotes || "";
      const next = confirmForceMissionPlan(applyForceMissionReviewNotes(state.forceMission, reviewNotes), { reviewNotes });
      state.forceMission = persistForceMission(next, projectId);
      await syncForceMission(state.forceMission, { source: "force-mission:confirm" });
      notify("兵力与任务已确认，正在自动生成作战概念图草案");
      render();
      await onForceMissionConfirmed?.(state.forceMission);
    } catch (error) {
      notify(error?.message || "确认兵力与任务失败");
    }
  }

  async function generatePhaseAction({ withNotes = false, silent = false } = {}) {
    const state = getState();
    if (state.phaseActionGenerating || state.phaseActionChatGenerating) {
      if (!silent) notify("阶段与行动正在生成或修订");
      return null;
    }
    if (!isCombatFocusConfirmed(state.combatFocus)) {
      if (!silent) notify("请先多选作战聚焦并点击「确认作战聚焦」");
      return null;
    }
    const selectedFocuses = getSelectedCombatFocuses(state.combatFocus);
    const compactFocus = compactCombatFocusForAnalysis(state.combatFocus);
    const chatNotes = summarizePhaseActionChat(state.phaseActionChat);
    const reviewNotes = withNotes
      ? chatNotes || state.phaseAction?.reviewNotes || ""
      : state.phaseAction?.reviewNotes || "";
    const previousPhaseNames = (state.phaseAction?.phases || []).map((phase) => phase.name).filter(Boolean);
    const diversitySeed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const ruleLibrary = compactRuleLibraryForPhase(state);
    state.phaseActionGenerating = true;
    render();
    try {
      const response = await generateWithAi({
        workflowId: "phase-action",
        workflow: { id: "phase-action", title: "阶段与行动构想", outputSchema: "PhaseActionConcept" },
        analysis: {
          ...briefAnalysis(state.brief),
          combatFocus: compactFocus,
          combatFocuses: combatFocusesForAnalysis(state.combatFocus),
          ruleLibrary,
          reviewNotes: String(reviewNotes || "").trim(),
          previousPhaseNames,
          diversitySeed,
          "蓝红行动写作要求": "专业 CONOPS 语气。每条：相对时点+概念主体+方式+对象/责任区+可观察门槛。蓝方同阶段覆盖不同职能轴（探测跟踪/交战拦截/指挥授权/评估重组）；红方必须对蓝方行动作因果回应。优先术语：航迹融合、交战授权、分层拦截、漏防补射、开机管理、关键节点生存。",
          "专业性要求": "克制、准确、可复核；禁止口号化与小说化；阶段名可上作战概念图；转换条件可观察。",
          "时窗依据要求": "timeWindow 必须有理有据：先据简报总窗口（小时/日序）定总跨度；各段按时职能加权（准备短、识别中、主交战最长、评估短非零）；相邻衔接无空洞；禁止无依据等长切分；transitions.note 写清时点与划分依据；行动内时点不得越出本段时窗。",
          "规则库落实要求": ruleLibrary.count
            ? `analysis.ruleLibrary 共 ${ruleLibrary.count} 条规则。阶段蓝/红行动与进入/退出门槛须体现规则中的作战活动与约束；若某规则语义已在行动或门槛中出现，禁止同义重复堆叠。`
            : "当前无规则库条目；仍须写出可观察的作战活动（非研究流程）。",
          "重生成约束": previousPhaseNames.length
            ? `这是重生成。禁止复用与 previousPhaseNames 相同的阶段划分/命名（上次：${previousPhaseNames.join("、")}）。须按当前研究意图与作战聚焦重新划分 2～12 段，名称、时窗与行动内容都应可区分。禁止套用“编队展开→电子诱发→火力释放→撤离”固定模板，除非课题本身就是该进攻节奏。`
            : "首次生成：阶段划分与时窗必须回扣研究意图与作战聚焦，体现专业作战阶段逻辑，不得套用无关固定模板。"
        },
        evidence: []
      });
      const plan = isAiOutput(response) ? response.result : null;
      const next = createPhaseActionConceptFromBrief(state.brief, plan, {
        source: isAiOutput(response) ? "ai" : "local",
        combatFocus: compactFocus,
        previousPhaseNames,
        diversitySeed,
        ruleLibrary
      });
      if (reviewNotes) next.reviewNotes = String(reviewNotes).trim();
      state.phaseAction = persistPhaseAction(next, projectId);
      state.phaseActionFocusId = state.phaseAction.phases?.[0]?.id || "";
      await syncPhaseAction(state.phaseAction, { source: "phase-action:generate" });
      onPhaseActionGenerated?.(state.phaseAction);
      const labels = selectedFocuses.map((item) => item.title).join("、");
      const source = state.phaseAction.generation?.source || "";
      const ruleHint = ruleLibrary.count ? `，规则库 ${ruleLibrary.count} 条` : "";
      if (!silent) {
        if (source === "ai") notify(`已按聚焦「${labels}」生成阶段草案（AI${ruleHint}），请复核`);
        else if (source === "local-ai-fallback") notify(`AI 输出与课题不符或不可用，已按「${labels}」生成本地草案${ruleHint}，请复核`);
        else notify(`已生成本地阶段与行动草案（聚焦：${labels || "—"}${ruleHint}），请复核`);
      }
      return state.phaseAction;
    } catch {
      const fallback = createPhaseActionConceptFromBrief(state.brief, null, {
        source: "local",
        combatFocus: compactFocus,
        previousPhaseNames,
        diversitySeed,
        ruleLibrary
      });
      if (reviewNotes) fallback.reviewNotes = String(reviewNotes).trim();
      state.phaseAction = persistPhaseAction(fallback, projectId);
      state.phaseActionFocusId = state.phaseAction.phases?.[0]?.id || "";
      try { await syncPhaseAction(state.phaseAction, { source: "phase-action:generate-fallback" }); } catch { /* local ok */ }
      onPhaseActionGenerated?.(state.phaseAction);
      if (!silent) notify("AI 暂不可用，已生成本地课题向阶段草案");
      return state.phaseAction;
    } finally {
      state.phaseActionGenerating = false;
      render();
    }
  }

  async function confirmPhaseAction() {
    const state = getState();
    if (state.phaseActionGenerating || state.phaseActionChatGenerating) {
      notify("生成中，请稍后再确认");
      return;
    }
    try {
      const reviewNotes = summarizePhaseActionChat(state.phaseActionChat)
        || state.phaseAction?.reviewNotes
        || "";
      const next = confirmPhaseActionConcept(applyPhaseActionReviewNotes(state.phaseAction, reviewNotes), { reviewNotes });
      state.phaseAction = persistPhaseAction(next, projectId);
      await syncPhaseAction(state.phaseAction, { source: "phase-action:confirm" });
      notify("阶段与行动已确认。请绑定规则到活动，再补状态机与时序，最后到结构核对反查。");
      render();
      await onPhaseActionConfirmed?.(state.phaseAction);
    } catch (error) {
      notify(error?.message || "确认阶段与行动失败");
    }
  }

  async function generateConceptGraphic({ withNotes = false, silent = false } = {}) {
    const state = getState();
    if (state.conceptGraphicGenerating) {
      if (!silent) notify("总体作战概念图正在生成");
      return null;
    }
    if (!upstreamPlanningReady(state)) {
      if (!silent) notify("请先确认兵力、阶段与概念图研究参考");
      return null;
    }
    const reviewNotes = withNotes
      ? document.querySelector("#conceptGraphicReviewNotes")?.value || state.conceptGraphic?.reviewNotes || ""
      : state.conceptGraphic?.reviewNotes || "";
    state.conceptGraphicGenerating = true;
    render();
    try {
      const response = await generateWithAi({
        workflowId: "concept-graphic",
        workflow: { id: "concept-graphic", title: "总体作战概念图设计", outputSchema: "ConceptGraphicPlan" },
        analysis: {
          ...briefAnalysis(state.brief),
          forceMission: compactForceMission(state.forceMission),
          phaseAction: compactPhaseAction(state.phaseAction),
          conceptMapReference: compactMapReference(state.conceptMap),
          reviewNotes: String(reviewNotes || "").trim()
        },
        evidence: []
      });
      const plan = isAiOutput(response) ? response.result : null;
      const next = createConceptGraphicPlanFromPlanning({
        brief: state.brief,
        forceMission: state.forceMission,
        phaseAction: state.phaseAction,
        conceptMap: state.conceptMap,
        plan,
        source: isAiOutput(response) ? "ai" : "local"
      });
      if (reviewNotes) next.reviewNotes = String(reviewNotes).trim();
      state.conceptGraphic = persistConceptGraphic(next, projectId);
      await syncConceptGraphic(state.conceptGraphic, { source: "concept-graphic:generate" });
      if (!silent) notify(isAiOutput(response) ? "总体作战概念图草案已生成，请复核" : "已生成本地总体作战概念图草案，请复核");
      return state.conceptGraphic;
    } catch {
      const fallback = createConceptGraphicPlanFromPlanning({
        brief: state.brief,
        forceMission: state.forceMission,
        phaseAction: state.phaseAction,
        conceptMap: state.conceptMap,
        plan: null,
        source: "local"
      });
      if (reviewNotes) fallback.reviewNotes = String(reviewNotes).trim();
      state.conceptGraphic = persistConceptGraphic(fallback, projectId);
      try { await syncConceptGraphic(state.conceptGraphic, { source: "concept-graphic:generate-fallback" }); } catch { /* local ok */ }
      if (!silent) notify("AI 暂不可用，已生成本地总体作战概念图草案");
      return state.conceptGraphic;
    } finally {
      state.conceptGraphicGenerating = false;
      render();
    }
  }

  async function confirmConceptGraphic() {
    const state = getState();
    if (state.conceptGraphicGenerating) {
      notify("生成中，请稍后再确认");
      return;
    }
    try {
      const reviewNotes = document.querySelector("#conceptGraphicReviewNotes")?.value || state.conceptGraphic?.reviewNotes || "";
      const next = confirmConceptGraphicPlan(applyConceptGraphicReviewNotes(state.conceptGraphic, reviewNotes), { reviewNotes });
      state.conceptGraphic = persistConceptGraphic(next, projectId);
      await syncConceptGraphic(state.conceptGraphic, { source: "concept-graphic:confirm" });
      const ov1Draft = conceptGraphicToOv1Draft(state.conceptGraphic, state.brief);
      notify("总体作战概念图已确认，正在种子化高层作战概念图");
      render();
      await onConceptGraphicConfirmed?.(state.conceptGraphic, ov1Draft);
    } catch (error) {
      notify(error?.message || "确认总体作战概念图失败");
    }
  }
}

function upstreamPlanningReady(state = {}) {
  return state.forceMission?.status === "confirmed"
    && state.phaseAction?.status === "confirmed"
    && state.conceptMap?.reference?.status === "confirmed"
    && !state.forceMissionStorage?.stale
    && !state.phaseActionStorage?.stale
    && !state.conceptMapStorage?.stale;
}

function briefAnalysis(brief = {}) {
  return {
    研究意图: brief.researchIntent || "",
    任务目标: brief.objective || "",
    核心思路: brief.approach || "",
    关键假设: brief.assumptions || "",
    预期效果: brief.expectedEffects || "",
    主要风险: brief.risk || ""
  };
}

function uniqueSearchKeys(list = []) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = String(item || "").trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    out.push(key);
  }
  return out;
}

function countryNamesOverlap(a = "", b = "") {
  const left = String(a || "").toLowerCase().trim();
  const right = String(b || "").toLowerCase().trim();
  if (!left || !right) return false;
  if (left.includes(right) || right.includes(left)) return true;
  const leftToken = left.slice(0, 6);
  const rightToken = right.slice(0, 6);
  return Boolean(leftToken && rightToken && (left.includes(rightToken) || right.includes(leftToken)));
}

function inspectForceMissionUpstream(state = {}) {
  const brief = state.brief || {};
  const hasBrief = Boolean(
    brief.objective || brief.researchIntent || brief.approach || brief.expectedEffects || brief.risk
  );
  if (!hasBrief) {
    return { ok: false, message: "请先完成概念简报（第 1 步），再生成兵力与任务" };
  }
  const phases = Array.isArray(state.phaseAction?.phases) ? state.phaseAction.phases : [];
  if (phases.length < 2) {
    return { ok: false, message: "请先生成并保留至少两个阶段（第 2 步），再生成兵力与任务" };
  }
  const phaseConfirmed = state.phaseAction?.status === "confirmed" && !state.phaseActionStorage?.stale;
  return {
    ok: true,
    phaseConfirmed,
    phaseStatus: state.phaseActionStorage?.stale ? "stale" : (state.phaseAction?.status || "draft"),
    message: ""
  };
}

async function buildCmoHintForForceMission(state, upstream) {
  let status = null;
  try {
    status = await getCmoCatalogStatus();
  } catch {
    status = { open: false, enabled: false };
  }
  if (!status?.open) {
    return {
      status,
      catalog: {
        available: false,
        missionTypes: listCmoMissionTypes(),
        platforms: []
      }
    };
  }
  const keywords = collectForceMissionKeywords(state);
  const platforms = [];
  const seen = new Set();
  for (const term of keywords.slice(0, 5)) {
    try {
      const hits = await searchCmoPlatforms({ q: term, limit: 3 });
      for (const hit of hits) {
        const key = `${hit.domain}:${hit.cmoId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        platforms.push({
          domain: hit.domain,
          cmoId: hit.cmoId,
          name: hit.name,
          country: hit.country,
          category: hit.category
        });
        if (platforms.length >= 12) break;
      }
    } catch {
      /* ignore search failures; generation can proceed without platform samples */
    }
    if (platforms.length >= 12) break;
  }
  return {
    status,
    catalog: {
      available: true,
      databaseLabel: status.databaseLabel || "",
      missionTypes: listCmoMissionTypes(),
      platforms,
      note: upstream.phaseConfirmed
        ? "优先按已确认阶段行动匹配任务类型与平台参考"
        : "阶段未确认：平台与任务仅作草案参考"
    }
  };
}

function collectForceMissionKeywords(state = {}) {
  const brief = state.brief || {};
  const phases = Array.isArray(state.phaseAction?.phases) ? state.phaseAction.phases : [];
  const text = [
    brief.objective,
    brief.approach,
    brief.expectedEffects,
    ...phases.flatMap((phase) => [
      phase.name,
      phase.objective,
      ...(phase.blueActions || phase.primaryActions || []),
      ...(phase.redActions || phase.secondaryActions || [])
    ])
  ].join(" ");
  const tokens = text
    .split(/[\s,，、；;。./|（）()\[\]{}]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 24);
  // Prefer longer, more distinctive tokens.
  return [...new Set(tokens)].sort((a, b) => b.length - a.length).slice(0, 8);
}

function compactForceMission(plan = {}) {
  return compactForceMissionForAnalysis(plan);
}

function compactRuleLibraryForPhase(state = {}) {
  return compactRuleLibraryForAnalysis(state.ov6a || { rules: [] });
}

function compactPhaseAction(plan = {}) {
  return {
    status: plan.status || "empty",
    phases: (plan.phases || []).map((phase) => ({
      id: phase.id,
      name: phase.name,
      sequence: phase.sequence,
      timeWindow: phase.timeWindow,
      objective: phase.objective,
      blueActions: phase.blueActions || phase.primaryActions || [],
      redActions: phase.redActions || phase.secondaryActions || [],
      primaryActions: phase.primaryActions || phase.blueActions || [],
      secondaryActions: phase.secondaryActions || phase.redActions || [],
      expectedEffects: phase.expectedEffects,
      entryConditions: phase.entryConditions,
      exitConditions: phase.exitConditions,
      forceIds: phase.forceIds
    })),
    transitions: (plan.transitions || []).map((item) => ({
      fromPhaseId: item.fromPhaseId,
      toPhaseId: item.toPhaseId,
      condition: item.condition,
      note: item.note
    }))
  };
}

function compactMapReference(map = {}) {
  const reference = map.reference || {};
  return {
    status: reference.status || "empty",
    entities: reference.entities || [],
    relations: reference.relations || [],
    activities: reference.activities || [],
    constraints: reference.constraints || [],
    questions: reference.questions || []
  };
}
