import { markScenarioStale } from "../scenarioStore.js";
import { clearValidation, markValidationStale, persistValidation } from "../validationStore.js";
import { clearRedTeamReview } from "../redTeamStore.js";

export function markStorageStale(storage, detail) {
  if (!storage || storage.status === "checking") return storage;
  return {
    ...storage,
    status: "stale",
    mode: "local",
    detail,
    stale: true
  };
}

export function createModelInvalidators(state) {
  function invalidatePhaseActionDependents() {
    state.forceMissionStorage = markStorageStale(state.forceMissionStorage, "阶段行动已更新，作战任务与兵力已过期");
    invalidateForceMissionDependents();
  }

  function invalidateForceMissionDependents() {
    state.ov1Storage = markStorageStale(state.ov1Storage, "任务或兵力已更新，总体概念图已过期");
    state.ov4Storage = markStorageStale(state.ov4Storage, "任务或兵力已更新，组织关系图已过期");
    state.ov2Storage = markStorageStale(state.ov2Storage, "任务或兵力已更新，作战资源流已过期");
    state.ov3Storage = markStorageStale(state.ov3Storage, "任务或兵力已更新，作战信息流已过期");
    invalidateDerivedArtifacts();
  }

  function invalidateConceptMapDependents() {
    state.ov1Storage = markStorageStale(state.ov1Storage, "Concept map changed; review or regenerate concept graphic before relying on it.");
    state.ov5Storage = markStorageStale(state.ov5Storage, "Concept map changed; review or regenerate activity model before relying on it.");
    invalidateDerivedArtifacts();
  }

  function invalidateDerivedArtifacts() {
    if (state.scenario) {
      state.scenario = markScenarioStale(state.scenario, "上游活动模型/研究循环已变更，上次想定仅供参考，请重新生成。");
    }
    state.lastDeploymentData = null;
    markCurrentValidationStale("上游模型已变更，上次设计验证仅供参考，请重新运行。");
    state.oodaStorage = markStorageStale(state.oodaStorage, "Upstream model changed; review or regenerate OODA before relying on it.");
    state.scenarioStorage = markStorageStale(state.scenarioStorage, "Upstream model changed; the previous scenario is no longer current.");
    state.validationStorage = markStorageStale(state.validationStorage, "Upstream model changed; the previous validation is no longer current.");
    state.redTeamRunning = false;
    state.deployment.open = false;
    state.deployment.status = "等待生成";
  }

  function invalidateValidation() {
    markCurrentValidationStale("想定或行为模型已变更，上次设计验证仅供参考，请重新运行。");
    state.validationStorage = markStorageStale(state.validationStorage, "Scenario or behavior model changed; run validation again.");
    state.redTeamRunning = false;
  }

  function markCurrentValidationStale(reason) {
    if (!state.validationResult) {
      clearValidation();
      return;
    }
    state.validationResult = markValidationStale(state.validationResult, reason);
    persistValidation(state.validationResult);
  }

  function invalidateRedTeam() {
    state.redTeamRunning = false;
    if (state.validationResult) clearRedTeamReview(state.validationResult);
  }

  return {
    invalidatePhaseActionDependents,
    invalidateForceMissionDependents,
    invalidateConceptMapDependents,
    invalidateDerivedArtifacts,
    invalidateValidation,
    markCurrentValidationStale,
    invalidateRedTeam,
    markStorageStale
  };
}
