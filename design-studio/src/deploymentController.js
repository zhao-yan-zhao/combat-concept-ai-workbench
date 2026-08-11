import { resolveTargetOrigin, saveDeploymentBridge } from "./deploymentBridgeStore.js";
import { acceptDeploymentChange, createDeploymentExchange, createDeploymentMessage, deploymentMessageTypes, isDeploymentMessage } from "./deploymentProtocol.js";
import { applyDeploymentChanges, createDeploymentData, isScenarioStale } from "./scenarioStore.js";

export function createDeploymentController({ getState, render, notify, invalidateValidation, syncScenario }) {
  return {
    bindWindow() {
      window.addEventListener("message", (event) => handleMessage(event));
    },

    bind(root) {
      root.querySelector("#deploymentBridgeForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const state = getState();
        state.deployment.settings = saveDeploymentBridge({ targetUrl: new FormData(event.currentTarget).get("targetUrl") });
        state.deployment.open = false;
        state.deployment.exchange = null;
        state.deployment.acceptedChangeIds = [];
        state.deployment.lastAccepted = null;
        state.deployment.status = "地址已保存";
        notify("部署图工具地址已保存");
        render();
      });

      root.querySelector("#deploymentFrame")?.addEventListener("load", (event) => {
        sendDeployment(event.currentTarget, false);
      });
    },

    handleAction(action) {
      const state = getState();
      if (action === "open-deployment") {
        if (!state.scenario || !resolveTargetOrigin(state.deployment.settings.targetUrl)) return false;
        if (isScenarioStale(state.scenario, state.ov5, state.ooda)) {
          notify("想定相对活动模型/研究循环 已过期，请先重新生成后再打开部署图");
          return true;
        }
        state.deployment.open = true;
        state.deployment.status = "已连接";
        render();
        return true;
      }
      if (action === "push-deployment") {
        if (isScenarioStale(state.scenario, state.ov5, state.ooda)) {
          notify("想定已过期，已阻止推送。请重新生成想定后再推送");
          state.deployment.status = "想定已过期，已禁用推送";
          render();
          return true;
        }
        const pushed = sendDeployment(document.querySelector("#deploymentFrame"), true);
        if (!pushed) return false;
        state.deployment.status = "已推送";
        render();
        return true;
      }
      return false;
    }
  };

  function sendDeployment(frame, announce) {
    const state = getState();
    const targetOrigin = resolveTargetOrigin(state.deployment.settings.targetUrl);
    if (isScenarioStale(state.scenario, state.ov5, state.ooda)) return false;
    const deploymentData = createDeploymentData(state.scenario);
    if (!frame?.contentWindow || !targetOrigin || !deploymentData) return false;
    const exchange = createDeploymentExchange(deploymentData, state.projectRevision);
    state.lastDeploymentData = deploymentData;
    state.deployment.exchange = exchange;
    state.deployment.acceptedChangeIds = [];
    frame.contentWindow.postMessage(createDeploymentMessage(deploymentMessageTypes.load, { deploymentData, exchange }), targetOrigin);
    if (announce) notify(`态势已推送：${deploymentData.entities.length} 个实体`);
    return true;
  }

  function handleMessage(event) {
    const state = getState();
    const targetOrigin = resolveTargetOrigin(state.deployment.settings.targetUrl);
    const frame = document.querySelector("#deploymentFrame");
    if (!targetOrigin || event.origin !== targetOrigin || event.source !== frame?.contentWindow || !isDeploymentMessage(event.data)) return;

    if (event.data.type === deploymentMessageTypes.ready) {
      sendDeployment(document.querySelector("#deploymentFrame"), false);
      return;
    }

    if (event.data.type !== deploymentMessageTypes.change) return;
    const accepted = acceptDeploymentChange(event.data.payload, state.deployment.exchange);
    if (!accepted || (state.deployment.acceptedChangeIds || []).includes(accepted.changeId)) return;
    const entityIds = new Set(state.scenario.entities.map((entity) => entity.id));
    const changes = accepted.changes.filter((change) => entityIds.has(change.entityId));
    if (!changes.length) return;
    const review = {
      bridgeOrigin: targetOrigin,
      exchangeId: state.deployment.exchange.id,
      changeId: accepted.changeId,
      scenarioUpdatedAt: state.deployment.exchange.scenarioUpdatedAt,
      receivedAt: new Date().toISOString()
    };
    state.scenario = applyDeploymentChanges(state.scenario, changes, review);
    state.lastDeploymentData = createDeploymentData(state.scenario);
    state.deployment.acceptedChangeIds = [...(state.deployment.acceptedChangeIds || []), accepted.changeId].slice(-40);
    state.deployment.lastAccepted = review;
    invalidateValidation();
    void syncScenario?.(state.scenario, { source: `deployment-bridge:${review.exchangeId}` });
    state.deployment.status = "已回传调整";
    notify(`已同步 ${changes.length} 个部署调整`);
    render();
  }
}
