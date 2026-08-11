import { resolveTargetOrigin } from "./deploymentBridgeStore.js";
import { getScenarioFreshness } from "./scenarioStore.js";

export function renderDeploymentIntegration(state) {
  const settings = state.deployment.settings;
  const targetOrigin = resolveTargetOrigin(settings.targetUrl);
  const freshness = getScenarioFreshness(state.scenario, state.ov5, state.ooda);
  const scenarioStale = Boolean(state.scenario && freshness.stale);
  const canOpen = Boolean(targetOrigin && state.scenario && !scenarioStale);
  const canPush = Boolean(state.deployment.open && targetOrigin && state.scenario && !scenarioStale);
  const status = scenarioStale
    ? "想定已过期，已禁用推送"
    : (state.deployment.status || (state.deployment.open ? "已连接" : "待推送"));
  const statusClass = status.startsWith("已") && !scenarioStale ? "" : "review";
  return `
    <section class="surface surface-pad deployment-integration ${scenarioStale ? "is-stale" : ""}">
      <div class="section-heading"><div><h2>部署图工具集成</h2><p>通过受控消息通道推送初始态势，并接收人工调整后的实体坐标。</p></div><span class="status-tag ${statusClass}">${escapeHtml(status)}</span></div>
      ${scenarioStale ? `<div class="deployment-stale-note" role="status"><strong>部署推送已暂停</strong><p>${escapeHtml(freshness.reason || "当前想定相对活动模型/研究循环 已过期。")} 请先重新生成想定，再打开或推送部署图，避免向工具发送过期态势。</p><button type="button" data-action="generate-scenario">重新生成想定</button></div>` : ""}
      <form class="deployment-bridge-form" id="deploymentBridgeForm">
        <label>工具地址<input name="targetUrl" value="${escapeAttribute(settings.targetUrl)}" placeholder="https://tool.example/deployment" ${scenarioStale ? "" : ""}></label>
        <div class="deployment-bridge-actions"><button type="submit" class="quiet-button">保存地址</button><button type="button" data-action="open-deployment" ${canOpen ? "" : "disabled"} title="${scenarioStale ? "想定过期，请先重新生成" : ""}">打开部署图</button><button type="button" class="quiet-button" data-action="push-deployment" ${canPush ? "" : "disabled"} title="${scenarioStale ? "想定过期，请先重新生成" : ""}">重新推送</button></div>
      </form>
      <p class="deployment-origin">目标来源：${escapeHtml(targetOrigin || "地址无效")}${scenarioStale ? " · 推送已锁定" : ""}</p>
      ${state.deployment.open && targetOrigin && !scenarioStale ? `<iframe id="deploymentFrame" class="deployment-frame" src="${escapeAttribute(settings.targetUrl)}" title="部署图工具"></iframe>` : ""}
    </section>
  `;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[character]));
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
