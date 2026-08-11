import { renderDeploymentIntegration } from "./deploymentView.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { getScenarioFreshness } from "./scenarioStore.js";
import { renderSimulationAdapter } from "./simulationAdapterView.js";

export function renderScenario(state) {
  const scenario = state.scenario;
  if (!scenario) {
    return `
      <section class="surface surface-pad scenario-empty">
        <div class="section-heading"><div><h2>自动想定</h2><p>由当前 OV-5 活动和 OODA 节点推导初始实体与事件序列。</p></div><button data-action="generate-scenario">生成想定</button></div>
        ${renderProjectStorageState(state.scenarioStorage, { refreshAction: "refresh-project-scenario" })}
        <div class="idea-prompt"><p>本阶段生成可解释的 MVP 想定：实体采用抽象坐标，时间线来自 OODA 节点耗时。生成后可导出为 <code>deployment_data</code>，并为部署图工具推送预留接口。</p></div>
      </section>
    `;
  }

  const freshness = getScenarioFreshness(scenario, state.ov5, state.ooda);
  return `
    <section class="surface surface-pad">
      <div class="section-heading"><div><h2>自动想定</h2><p>生成于 ${new Date(scenario.generatedAt).toLocaleString("zh-CN", { hour12: false })}${freshness.stale ? " · 相对 OV-5/OODA 已过期" : ""}</p></div><div class="activity-toolbar"><span class="mini-tag ${freshness.stale ? "review" : ""}">${freshness.stale ? "相对上游过期" : "与上游一致"}</span><button class="quiet-button" data-action="recommend-deployment" ${freshness.stale ? "disabled" : ""}>优化部署</button><button data-action="generate-scenario">${freshness.stale ? "重新生成想定" : "重新生成想定"}</button></div></div>
      ${freshness.stale ? `<div class="scenario-stale-banner ooda-stale-banner" role="status"><div><strong>想定相对活动模型 / 研究循环已过期</strong><p>${escapeHtml(freshness.reason)} 可先审阅当前实体与时间线，确认后重新生成。</p></div><button type="button" data-action="generate-scenario">立即重新生成</button></div>` : ""}
      ${renderProjectStorageState(state.scenarioStorage, { refreshAction: "refresh-project-scenario" })}
      <div class="scenario-grid ${freshness.stale ? "is-stale" : ""}">
        <div class="scenario-map">
          ${scenario.areas.map((area) => `<div class="scenario-area ${area.type}" style="left:calc(${area.position[0]}% - ${area.size / 2}px);top:calc(${area.position[1]}% - ${area.size / 2}px);width:${area.size}px;height:${area.size}px"></div>`).join("")}
          ${scenario.entities.map((entity) => `<button class="map-unit ${entity.className}" data-unit="${entity.id}" style="left:calc(${entity.position[0]}% - 19px);top:calc(${entity.position[1]}% - 19px)">${unitGlyph(entity.role)}</button>`).join("")}
        </div>
        <div>
          <h3>初始事件序列</h3>
          <div class="timeline">${scenario.timeline.map((item) => `<div class="timeline-item"><b>${item.time}</b><span>${item.title}<small>${item.description}</small></span></div>`).join("")}</div>
          <div class="inspector-section"><h3>部署数据</h3><p>已生成 <code>deployment_data</code> 与抽象网格 <code>GeoJSON</code>，可推送至手动部署图工具。</p><button class="quiet-button" data-action="export-scenario-geojson">GeoJSON</button></div>
          ${renderDeploymentPlan(scenario.deploymentPlan)}
          ${renderSimulationAdapter(state)}
        </div>
      </div>
    </section>
    ${renderDeploymentIntegration(state)}
  `;
}

function renderDeploymentPlan(plan) {
  if (!plan) return `<section class="inspector-section"><h3>空间部署建议</h3><p>尚未生成部署建议。</p></section>`;
  return `<section class="inspector-section deployment-plan"><h3>空间部署建议</h3><p>${plan.adjustedEntityIds?.length || 0} 个实体已按角色和区域锚点调整。坐标仅用于抽象研究网格。</p><div class="deployment-plan-checks">${(plan.diagnostics || []).map((check) => `<div class="${check.state}"><b>${escapeHtml(check.label)}</b><small>${escapeHtml(check.detail)}</small></div>`).join("")}</div></section>`;
}

export function selectionForScenarioUnit(entityId, scenario) {
  const entity = scenario?.entities.find((item) => item.id === entityId);
  if (!entity) return null;
  return {
    id: entity.id,
    kind: "unit",
    title: entity.label,
    status: "想定实体",
    text: "该实体由当前 OV-5 活动和 OODA 行为逻辑推导生成，可在部署图工具中继续人工调整。",
    facts: [["角色", entity.role], ["抽象坐标", `${entity.position[0]}%, ${entity.position[1]}%`], ["来源活动", entity.sourceActivityId || "模型默认"], ["知识依据", entity.sourceKnowledgeRefs?.join("、") || "未关联"]],
    refs: entity.sourceKnowledgeRefs || []
  };
}

function unitGlyph(role) {
  return { sensor: "感", command: "指", action: "行", support: "保", opponent: "蓝" }[role] || "单";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[character]));
}
