import { createSimulationArtifact, recordSimulationResult, recordSimulationSubmission, runLocalAbstractSimulation } from "./simulationAdapter.js";
import { saveSimulationAdapterSettings } from "./simulationAdapterSettingsStore.js";
import { persistScenario } from "./scenarioStore.js";
import { persistPhaseAction } from "./phaseActionStore.js";
import { persistOv5 } from "./ov5Store.js";
import { recycleSimulationToPhasesAndActivities } from "./simulationRecycleStore.js";

export function createSimulationAdapterController({
  getState,
  render,
  notify,
  downloadArtifact,
  invalidateValidation,
  syncScenario,
  syncPhaseAction,
  syncOv5
}) {
  return {
    bind(root) {
      root.querySelector("#simulationAdapterForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const state = getState();
        state.simulationAdapterSettings = saveSimulationAdapterSettings({
          id: values.get("id"),
          name: values.get("name"),
          version: values.get("version"),
          enabled: values.get("enabled") === "on"
        });
        notify(state.simulationAdapterSettings.enabled ? "已登记人工仿真交接配置" : "适配器保持未配置状态");
        render();
      });

      root.querySelector("#simulationResultForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const state = getState();
        const next = recordSimulationResult(state.scenario, values.get("runId"), {
          status: values.get("status"),
          summary: values.get("summary"),
          inputFingerprint: values.get("inputFingerprint"),
          metrics: collectMetrics(values)
        });
        if (next === state.scenario) return;
        updateScenario(next, "simulation-result");
        notify("已登记人工回传结果，请重新运行设计验证");
      });
    },

    handleAction(action) {
      const state = getState();
      if (action === "export-simulation-package") {
        const artifact = createSimulationArtifact(state.scenario, state.simulationAdapterSettings);
        if (!artifact) return false;
        downloadArtifact(artifact);
        notify("已导出抽象研究级仿真输入 JSON");
        return true;
      }
      if (action === "record-simulation-submission") {
        if (!state.scenario || !state.simulationAdapterSettings?.enabled) {
          notify("请先明确配置人工交接后再登记提交");
          return true;
        }
        const next = recordSimulationSubmission(state.scenario, state.simulationAdapterSettings);
        updateScenario(next, "simulation-submission");
        notify("已登记人工仿真提交，未发起外部网络请求");
        return true;
      }
      if (action === "run-local-abstract-simulation") {
        if (!state.scenario) return false;
        const next = runLocalAbstractSimulation(state.scenario);
        updateScenario(next, "local-abstract-simulation");
        notify("本地抽象网格评估已完成，请结合设计验证人工复核");
        return true;
      }
      if (action === "recycle-simulation-to-phases-and-activities") {
        if (!state.scenario?.simulation?.runs?.[0]?.result) {
          notify("当前没有可回填的仿真推演结果，请先运行本地评估或登记回传");
          return true;
        }
        const recycled = recycleSimulationToPhasesAndActivities({
          scenario: state.scenario,
          phaseAction: state.phaseAction,
          ov5: state.ov5
        });

        state.phaseAction = recycled.phaseAction;
        state.ov5 = recycled.ov5;
        state.scenario = recycled.scenario;

        const projectId = state.project?.id || "default";
        persistPhaseAction(recycled.phaseAction, projectId);
        persistOv5(recycled.ov5, projectId);
        persistScenario(recycled.scenario, projectId);

        void syncPhaseAction?.(recycled.phaseAction, { source: "simulation-recycle" });
        void syncOv5?.(recycled.ov5, { source: "simulation-recycle" });
        void syncScenario?.(recycled.scenario, { source: "simulation-recycle" });

        invalidateValidation();
        notify(`推演结果已回填：更新 ${recycled.stats.updatedPhasesCount} 个阶段，${recycled.stats.updatedActivitiesCount} 项活动，提炼 ${recycled.stats.deviationCount} 项偏差`);
        render();
        return true;
      }
      return false;
    }
  };

  function updateScenario(next, source) {
    const state = getState();
    state.scenario = next;
    persistScenario(next, state.project?.id || "default");
    invalidateValidation();
    void syncScenario?.(next, { source });
    render();
  }
}

function collectMetrics(values) {
  return [1, 2, 3].flatMap((index) => {
    const label = String(values.get(`metricLabel${index}`) || "").trim();
    const value = Number(values.get(`metricValue${index}`));
    if (!label || !Number.isFinite(value)) return [];
    return [{ id: `metric-${index}`, label, value, unit: values.get(`metricUnit${index}`) }];
  });
}
