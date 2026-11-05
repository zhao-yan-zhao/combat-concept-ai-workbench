import { areConceptBriefsEqual, saveConceptBrief } from "../briefStore.js";
import { saveInspirationSession } from "../inspirationStore.js";
import { saveCustomDirections, saveSelectedDirection } from "../directionProposalStore.js";
import { deriveResearchChatBriefUpdate } from "../researchChatBriefUpdate.js";
import { normalizeConceptMap, persistConceptMap } from "../conceptMapStore.js";
import { normalizeForceMissionPlan, persistForceMission } from "../forceMissionStore.js";
import { normalizePhaseActionConcept, persistPhaseAction } from "../phaseActionStore.js";
import { normalizeConceptGraphicPlan, persistConceptGraphic } from "../conceptGraphicStore.js";
import { persistOv5Model } from "../ov5Store.js";
import { deriveOodaFromOv5, persistOodaModel } from "../oodaStore.js";
import { saveOv1Model } from "../ov1Store.js";
import { persistScenario } from "../scenarioStore.js";
import { persistValidation } from "../validationStore.js";
import { deleteReportVersion, persistReportVersions, upsertReportVersion } from "../reportVersionStore.js";
import { deleteModelSnapshot, persistModelSnapshots, upsertModelSnapshot } from "../modelSnapshotStore.js";
import { directions } from "../data.js";

export function describeProjectCreateError(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || "").trim();
  if (status === 403 || /login is required|Collaboration login/i.test(message)) {
    return "创建项目前请先登录协同账号";
  }
  if (status === 409 || /already in use/i.test(message)) {
    return "项目标识已被占用：请直接打开已有项目，或换一个新标识";
  }
  if (/identifier is invalid/i.test(message)) {
    return "项目标识格式无效：使用 2–64 位小写字母、数字、下划线或连字符，且以字母/数字开头";
  }
  if (/title is required/i.test(message)) {
    return "请填写项目名称";
  }
  if (message) return `项目创建失败：${message}`;
  return "项目创建失败，请检查项目标识和名称";
}

export function createSyncHandlers(ctx) {
  const {
    state,
    projectBriefSeed,
    activeProjectId,
    currentProjectTitle,
    invalidateDerivedArtifacts,
    invalidateConceptMapDependents,
    invalidateValidation
  } = ctx;

  function restoreLocalBriefConflictDraft(draft) {
    if (!draft?.brief) return;
    const nextBrief = saveConceptBrief(draft.brief, projectBriefSeed);
    const nextDirection = saveSelectedDirection(String(draft.direction || state.direction).trim() || state.direction);
    const changed = !areConceptBriefsEqual(state.brief, nextBrief) || state.direction !== nextDirection;
    state.brief = nextBrief;
    state.briefIntent = nextBrief.researchIntent;
    state.direction = nextDirection;
    if (Array.isArray(draft.directions)) {
      state.customDirections = saveCustomDirections(draft.directions, { projectId: activeProjectId, defaults: directions });
    }
    if (draft.inspiration?.messages?.length) state.inspiration = saveInspirationSession(draft.inspiration);
    if (changed) invalidateDerivedArtifacts();
  }

  function restoreLocalConceptMapConflictDraft(model) {
    if (!model?.document) return;
    state.conceptMap = persistConceptMap(normalizeConceptMap(model), activeProjectId);
    invalidateConceptMapDependents();
  }

  function applyResearchChatBriefUpdate(response, question, options = {}) {
    const update = deriveResearchChatBriefUpdate({
      brief: state.brief,
      question,
      result: response?.result || response,
      projectTitle: options.projectTitle || (currentProjectTitle ? currentProjectTitle() : "")
    });
    if (!update.fields.length) return [];
    const nextBrief = saveConceptBrief({ ...state.brief, ...update.patch }, projectBriefSeed);
    if (!areConceptBriefsEqual(state.brief, nextBrief)) {
      state.brief = nextBrief;
      state.briefIntent = nextBrief.researchIntent;
      state.briefDraftReveal = true;
      invalidateDerivedArtifacts();
      window.setTimeout(() => {
        if (!state.briefDraftReveal) return;
        state.briefDraftReveal = false;
        const form = document.querySelector("#briefEditorForm");
        form?.classList.remove("is-draft-reveal");
      }, 1500);
    }
    return update.fields;
  }

  function restoreLocalOv5ConflictDraft(model) {
    if (!model?.activities || !Array.isArray(model.activities)) return;
    state.ov5 = model;
    persistOv5Model(state.ov5);
    state.ooda = deriveOodaFromOv5(state.ov5);
    state.selection = null;
    invalidateDerivedArtifacts();
  }

  function restoreLocalOv1ConflictDraft(model) {
    if (!model?.nodes || !Array.isArray(model.nodes)) return;
    state.ov1 = saveOv1Model(model);
    state.selection = null;
    invalidateValidation();
  }

  function restoreLocalOodaConflictDraft(model) {
    if (!model?.lanes || !Array.isArray(model.lanes)) return;
    state.ooda = model;
    persistOodaModel(state.ooda);
    state.selection = null;
    invalidateDerivedArtifacts();
  }

  function restoreLocalScenarioConflictDraft(model) {
    if (!model?.entities || !Array.isArray(model.entities)) return;
    state.scenario = model;
    persistScenario(state.scenario);
    state.selection = null;
    invalidateValidation();
  }

  function restoreLocalValidationConflictDraft(model) {
    if (!model?.scores || !Array.isArray(model.scores)) return;
    state.validationResult = model;
    persistValidation(state.validationResult);
    state.redTeamRunning = false;
    state.selection = null;
  }

  function applyRemoteBrief(remote, { force = false } = {}) {
    if (!remote?.brief) return false;
    if (force && !window.confirm(`服务端修订 r${remote.revision} 将覆盖当前概念简报及其下游派生数据。是否继续？`)) return false;
    const localIsSeed = areConceptBriefsEqual(state.brief, projectBriefSeed);
    if (!force && !localIsSeed) return false;
    const nextDirection = String(remote.direction || state.direction).trim() || state.direction;
    const nextCustomDirections = Array.isArray(remote.directions)
      ? saveCustomDirections(remote.directions, { projectId: activeProjectId, defaults: directions })
      : state.customDirections;
    const changed = !areConceptBriefsEqual(state.brief, remote.brief)
      || state.direction !== nextDirection
      || JSON.stringify(state.customDirections) !== JSON.stringify(nextCustomDirections);
    state.brief = saveConceptBrief(remote.brief, projectBriefSeed);
    state.briefIntent = state.brief.researchIntent;
    state.direction = saveSelectedDirection(nextDirection);
    state.customDirections = nextCustomDirections;
    if (remote.inspiration?.messages?.length) state.inspiration = saveInspirationSession(remote.inspiration);
    if (changed) invalidateDerivedArtifacts();
    return true;
  }

  function applyRemoteForceMission(remote, { force = false } = {}) {
    if (!remote?.model || remote.stale) return false;
    if (force && state.forceMission?.forces?.length && !window.confirm(`服务端兵力与任务修订 r${remote.revision} 将覆盖当前草案，是否继续？`)) return false;
    if (!force && state.forceMissionStorage.localSaved) return false;
    state.forceMission = persistForceMission(normalizeForceMissionPlan(remote.model), activeProjectId);
    return true;
  }

  function applyRemotePhaseAction(remote, { force = false } = {}) {
    if (!remote?.model || remote.stale) return false;
    if (force && state.phaseAction?.phases?.length && !window.confirm(`服务端阶段与行动修订 r${remote.revision} 将覆盖当前草案，是否继续？`)) return false;
    if (!force && state.phaseActionStorage.localSaved) return false;
    state.phaseAction = persistPhaseAction(normalizePhaseActionConcept(remote.model), activeProjectId);
    return true;
  }

  function applyRemoteConceptMap(remote, { force = false } = {}) {
    if (!remote?.model || remote.stale) return false;
    if (force && state.conceptMap?.document?.items?.length && !window.confirm(`服务端作战概念图修订 r${remote.revision} 将覆盖当前地图快照，是否继续？`)) return false;
    if (!force && state.conceptMapStorage.localSaved) return false;
    state.conceptMap = persistConceptMap(normalizeConceptMap(remote.model), activeProjectId);
    state.selection = null;
    invalidateConceptMapDependents();
    return true;
  }

  function applyRemoteConceptGraphic(remote, { force = false } = {}) {
    if (!remote?.model || remote.stale) return false;
    if (force && state.conceptGraphic?.nodes?.length && !window.confirm(`服务端总体作战概念图修订 r${remote.revision} 将覆盖当前草案，是否继续？`)) return false;
    if (!force && state.conceptGraphicStorage.localSaved) return false;
    state.conceptGraphic = persistConceptGraphic(normalizeConceptGraphicPlan(remote.model), activeProjectId);
    return true;
  }

  function restoreLocalForceMissionConflictDraft(model) {
    state.forceMission = persistForceMission(normalizeForceMissionPlan(model), activeProjectId);
  }

  function restoreLocalPhaseActionConflictDraft(model) {
    state.phaseAction = persistPhaseAction(normalizePhaseActionConcept(model), activeProjectId);
  }

  function restoreLocalConceptGraphicConflictDraft(model) {
    state.conceptGraphic = persistConceptGraphic(normalizeConceptGraphicPlan(model), activeProjectId);
  }

  function applyRemoteOv5(remote, { force = false } = {}) {
    if (!remote?.model) return false;
    if (force && !window.confirm(`服务端活动模型修订 r${remote.revision} 将覆盖当前活动模型并重新派生 OODA。是否继续？`)) return false;
    if (!force && state.ov5Storage.localSaved) return false;
    state.ov5 = remote.model;
    persistOv5Model(state.ov5);
    state.ooda = deriveOodaFromOv5(state.ov5);
    state.selection = null;
    invalidateDerivedArtifacts();
    return true;
  }

  function applyRemoteOv1(remote, { force = false } = {}) {
    if (!remote?.model || remote.stale) return false;
    if (force && !window.confirm(`服务端高层作战概念图修订 r${remote.revision} 将覆盖当前总体概念图，并使本地验证结果失效。是否继续？`)) return false;
    if (!force && state.ov1Storage.localSaved) return false;
    state.ov1 = saveOv1Model(remote.model);
    state.selection = null;
    invalidateValidation();
    return true;
  }

  function applyRemoteOoda(remote, { force = false } = {}) {
    if (!remote?.model || remote.stale) return false;
    if (force && !window.confirm(`服务端 OODA 修订 r${remote.revision} 将覆盖当前循环并清除下游想定和验证。是否继续？`)) return false;
    if (!force && state.oodaStorage.localSaved) return false;
    state.ooda = remote.model;
    persistOodaModel(state.ooda);
    state.selection = null;
    invalidateDerivedArtifacts();
    return true;
  }

  function applyRemoteScenario(remote, { force = false } = {}) {
    if (!remote?.model || remote.stale) return false;
    if (force && !window.confirm(`服务端想定修订 r${remote.revision} 将覆盖当前想定并清除本地验证。是否继续？`)) return false;
    if (!force && state.scenarioStorage.localSaved) return false;
    state.scenario = remote.model;
    persistScenario(state.scenario);
    state.selection = null;
    invalidateValidation();
    return true;
  }

  function applyRemoteValidation(remote, { force = false } = {}) {
    if (!remote?.model || remote.stale) return false;
    if (force && !window.confirm(`服务端验证修订 r${remote.revision} 将覆盖当前验证与红方审阅。是否继续？`)) return false;
    if (!force && state.validationStorage.localSaved) return false;
    state.validationResult = remote.model;
    persistValidation(state.validationResult);
    state.redTeamRunning = false;
    state.selection = null;
    return true;
  }

  function applyRemoteKnowledge(remote, { force = false } = {}) {
    if (!remote?.model?.docs?.length) return false;
    if (force && state.knowledge?.docs?.length && !window.confirm(`服务端知识库修订 r${remote.revision} 将覆盖当前本地 Vault 索引。是否继续？`)) return false;
    if (!force && state.knowledgeStorage.localSaved) return false;
    state.knowledge = remote.model;
    state.knowledgeQuery = "";
    state.knowledgeResults = null;
    state.knowledgeSearch = { mode: "server", retrievalMode: "hybrid", includeSensitive: false, detail: "已载入服务端项目知识库，默认排除敏感片段" };
    state.selection = null;
    return true;
  }

  function applyRemoteReportArchives(items, { force = false } = {}) {
    if (!Array.isArray(items) || !items.length) return false;
    if (state.reportVersions.length && !force) return false;
    if (force && state.reportVersions.length && !window.confirm(`服务端将替换当前 ${state.reportVersions.length} 份本地报告归档。是否继续？`)) return false;
    state.reportVersions = persistReportVersions(items);
    return true;
  }

  function upsertRemoteReportArchive(item) {
    state.reportVersions = upsertReportVersion(item, state.reportVersions);
  }

  function removeRemoteReportArchive(itemId) {
    state.reportVersions = deleteReportVersion(itemId, state.reportVersions);
  }

  function applyRemoteModelSnapshots(items, { force = false } = {}) {
    if (!Array.isArray(items) || !items.length) return false;
    if (state.modelSnapshots.length && !force) return false;
    if (force && state.modelSnapshots.length && !window.confirm(`服务端将替换当前 ${state.modelSnapshots.length} 份本地模型快照。是否继续？`)) return false;
    state.modelSnapshots = persistModelSnapshots(items);
    state.modelComparison = null;
    return true;
  }

  function upsertRemoteModelSnapshot(item) {
    state.modelSnapshots = upsertModelSnapshot(item, state.modelSnapshots);
  }

  function removeRemoteModelSnapshot(itemId) {
    state.modelSnapshots = deleteModelSnapshot(itemId, state.modelSnapshots);
    if (state.modelComparison?.baseline.id === itemId || state.modelComparison?.candidate.id === itemId) state.modelComparison = null;
  }

  return {
    restoreLocalBriefConflictDraft,
    restoreLocalConceptMapConflictDraft,
    applyResearchChatBriefUpdate,
    restoreLocalOv5ConflictDraft,
    restoreLocalOv1ConflictDraft,
    restoreLocalOodaConflictDraft,
    restoreLocalScenarioConflictDraft,
    restoreLocalValidationConflictDraft,
    applyRemoteBrief,
    applyRemoteForceMission,
    applyRemotePhaseAction,
    applyRemoteConceptMap,
    applyRemoteConceptGraphic,
    restoreLocalForceMissionConflictDraft,
    restoreLocalPhaseActionConflictDraft,
    restoreLocalConceptGraphicConflictDraft,
    applyRemoteOv5,
    applyRemoteOv1,
    applyRemoteOoda,
    applyRemoteScenario,
    applyRemoteValidation,
    applyRemoteKnowledge,
    applyRemoteReportArchives,
    upsertRemoteReportArchive,
    removeRemoteReportArchive,
    applyRemoteModelSnapshots,
    upsertRemoteModelSnapshot,
    removeRemoteModelSnapshot
  };
}
