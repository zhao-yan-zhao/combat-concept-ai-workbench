import { compareModelSnapshots } from "./modelCompare.js";
import { deleteModelSnapshot, saveModelSnapshot, snapshotContextFromState } from "./modelSnapshotStore.js";
import { updateComparisonWeights, updateManualReview } from "./modelComparisonSettingsStore.js";

export function createModelSnapshotController({ getState, render, notify, project, restoreSnapshot, exportComparison, syncSnapshot, removeSnapshot }) {
  return {
    bind(root) {
      root.querySelector("#modelSnapshotCompareForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const state = getState();
        const formData = new FormData(event.currentTarget);
        const baseline = state.modelSnapshots.find((item) => item.id === formData.get("baselineId"));
        const candidate = state.modelSnapshots.find((item) => item.id === formData.get("candidateId"));
        if (!baseline || !candidate || baseline.id === candidate.id) {
          notify("请选择两份不同的模型快照进行对比");
          return;
        }
        state.modelComparisonSettings = updateComparisonWeights(state.modelComparisonSettings, readWeights(formData));
        state.modelComparison = compareModelSnapshots(baseline, candidate, state.modelComparisonSettings);
        notify(`已对比 ${baseline.label} 与 ${candidate.label}`);
        render();
      });

      root.querySelector("#modelScoreReviewForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const state = getState();
        const comparison = state.modelComparison;
        if (!comparison) return;
        const formData = new FormData(event.currentTarget);
        state.modelComparisonSettings = updateManualReview(state.modelComparisonSettings, comparison.baseline.id, readManualScores(formData, "baseline"), readManualRationales(formData, "baseline"));
        state.modelComparisonSettings = updateManualReview(state.modelComparisonSettings, comparison.candidate.id, readManualScores(formData, "candidate"), readManualRationales(formData, "candidate"));
        const baseline = state.modelSnapshots.find((item) => item.id === comparison.baseline.id);
        const candidate = state.modelSnapshots.find((item) => item.id === comparison.candidate.id);
        if (!baseline || !candidate) return;
        state.modelComparison = compareModelSnapshots(baseline, candidate, state.modelComparisonSettings);
        notify("已保存人工评分复核并重新计算比较结果");
        render();
      });

      root.querySelectorAll("[data-model-snapshot-delete]").forEach((button) => {
        button.addEventListener("click", () => {
          const state = getState();
          const snapshot = state.modelSnapshots.find((item) => item.id === button.dataset.modelSnapshotDelete);
          if (!snapshot || !window.confirm(`确定删除模型快照 ${snapshot.label}？`)) return;
          state.modelSnapshots = deleteModelSnapshot(snapshot.id, state.modelSnapshots);
          if (state.modelComparison?.baseline.id === snapshot.id || state.modelComparison?.candidate.id === snapshot.id) state.modelComparison = null;
          void removeSnapshot?.(snapshot.id, { source: "manual" });
          notify(`模型快照 ${snapshot.label} 已删除`);
          render();
        });
      });

      root.querySelectorAll("[data-model-snapshot-restore]").forEach((button) => {
        button.addEventListener("click", () => {
          const state = getState();
          const snapshot = state.modelSnapshots.find((item) => item.id === button.dataset.modelSnapshotRestore);
          if (!snapshot) return;
          const confirmed = window.confirm(`恢复 ${snapshot.label} 将覆盖当前概念简报、OV-1～OV-6c、architecture、OODA、想定与验证结果。部署图桥接将关闭并需要重新推送。是否继续？`);
          if (!confirmed) return;
          try {
            restoreSnapshot(snapshot);
            state.modelComparison = null;
            notify(`已恢复 ${snapshot.label}；部署图桥接需要重新推送`);
            render();
          } catch (error) {
            notify("模型快照恢复失败，请保留当前状态后重试");
          }
        });
      });
    },

    handleAction(action) {
      if (action === "export-model-comparison-markdown" || action === "export-model-comparison-json") {
        const comparison = getState().modelComparison;
        if (!comparison) {
          notify("请先选择两份模型快照并执行对比");
          return true;
        }
        exportComparison(action.endsWith("json") ? "json" : "markdown", comparison);
        return true;
      }
      if (action !== "save-model-snapshot") return false;
      const state = getState();
      state.modelSnapshots = saveModelSnapshot(snapshotContextFromState(state, project), state.modelSnapshots);
      const newest = state.modelSnapshots[0];
      const prior = state.modelSnapshots[1];
      state.modelComparison = prior ? compareModelSnapshots(prior, newest, state.modelComparisonSettings) : null;
      void syncSnapshot?.(newest, { source: "manual" });
      notify(prior ? `已保存 ${newest.label}，并与 ${prior.label} 形成对比` : `已保存模型快照 ${newest.label}`);
      render();
      return true;
    }
  };
}

function readWeights(formData) {
  return Object.fromEntries([...formData.entries()]
    .filter(([key]) => key.startsWith("weight-"))
    .map(([key, value]) => [key.slice("weight-".length), value]));
}

function readManualScores(formData, side) {
  return Object.fromEntries([...formData.entries()]
    .filter(([key]) => key.startsWith(`${side}-score-`))
    .map(([key, value]) => [key.slice(`${side}-score-`.length), value]));
}

function readManualRationales(formData, side) {
  return Object.fromEntries([...formData.entries()]
    .filter(([key]) => key.startsWith(`${side}-rationale-`))
    .map(([key, value]) => [key.slice(`${side}-rationale-`.length), value]));
}
