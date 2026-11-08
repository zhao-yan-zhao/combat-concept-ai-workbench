import { generateValidation } from "./validationStore.js";
import { applyIssueRepair } from "./consistencyLocatorStore.js";
import { persistOv5 } from "./ov5Store.js";
import { persistScenario } from "./scenarioStore.js";
import { persistOodaModel } from "./oodaStore.js";
import { selectionFor } from "./ui.js";

export function createValidationController({
  getState,
  render,
  notify,
  syncValidation,
  syncOv5,
  syncOoda,
  syncScenario,
  applyWithRecoveryPoint
}) {
  return {
    async handleAction(action, source = null) {
      const state = getState();

      if (action === "run-validation") {
        state.validationResult = generateValidation(state.ov5, state.ooda, state.scenario, state.ov1, {
          forceMission: state.forceMission,
          ov2: state.ov2,
          ov3: state.ov3,
          ov4: state.ov4
        });
        state.redTeamRunning = false;
        state.selection = null;
        void syncValidation?.(state.validationResult, { source: "rule-validation" });
        notify(`设计验证完成，发现 ${state.validationResult.issues.length} 项待处理问题`);
        render();
        return true;
      }

      if (action === "locate-validation-issue") {
        const issueId = source?.dataset?.issueId || source?.closest?.("[data-issue-id]")?.dataset?.issueId;
        const issue = state.validationResult?.issues?.find((i) => i.id === issueId);
        if (!issue) {
          notify("未找到该一致性问题对应的要素信息");
          return true;
        }

        const targetView = issue.targetView || "ov5";
        state.activeView = targetView;

        // 设置选中要素
        if (targetView === "ov5" && issue.targetElementId) {
          state.selection = selectionFor("activity", issue.targetElementId, state);
        } else if (targetView === "ooda" && issue.targetElementId) {
          state.selection = selectionFor("ooda", issue.targetElementId, state);
        } else if (targetView === "scenario" && issue.targetElementId) {
          state.selection = selectionFor("unit", issue.targetElementId, state);
        } else if (targetView === "ov1" && issue.targetElementId) {
          state.selection = selectionFor("ov1", issue.targetElementId, state);
        }

        render();
        notify(`已跳转至 [${issue.targetViewLabel || targetView}]：${issue.targetElementName || issue.sourceId}`);
        return true;
      }

      if (action === "repair-validation-issue") {
        const issueId = source?.dataset?.issueId || source?.closest?.("[data-issue-id]")?.dataset?.issueId;
        const issue = state.validationResult?.issues?.find((i) => i.id === issueId);
        if (!issue || !issue.repairPlan) {
          notify("该一致性问题暂无自动修复建议，请在对应视图中人工核对处理");
          return true;
        }

        const performRepair = async () => {
          const repairResult = applyIssueRepair(state, issue);
          const projectId = state.project?.id || "default";

          if (repairResult.modifiedDomain === "ov5") {
            persistOv5(state.ov5, projectId);
            void syncOv5?.(state.ov5, { source: "consistency-repair" });
          } else if (repairResult.modifiedDomain === "ooda") {
            persistOodaModel(state.ooda);
            void syncOoda?.(state.ooda, { source: "consistency-repair" });
          } else if (repairResult.modifiedDomain === "scenario") {
            persistScenario(state.scenario, projectId);
            void syncScenario?.(state.scenario, { source: "consistency-repair" });
          }

          // 重新执行轻量验证以刷新结果
          state.validationResult = generateValidation(state.ov5, state.ooda, state.scenario, state.ov1, {
            forceMission: state.forceMission,
            ov2: state.ov2,
            ov3: state.ov3,
            ov4: state.ov4
          });
          void syncValidation?.(state.validationResult, { source: "consistency-repair" });
        };

        if (applyWithRecoveryPoint) {
          await applyWithRecoveryPoint(
            { label: `自动修复: ${issue.title}`, source: "consistency-repair" },
            performRepair
          );
        } else {
          await performRepair();
          render();
        }

        notify(`已成功修复：「${issue.repairPlan.label}」，支持随时通过顶栏撤销还原`);
        return true;
      }

      return false;
    }
  };
}
