import { renderDeploymentIntegration } from "./deploymentView.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { getScenarioFreshness } from "./scenarioStore.js";
import { renderSimulationAdapter } from "./simulationAdapterView.js";

export function renderScenario(state) {
  const scenario = state.scenario;
  const generating = Boolean(state.scenarioGenerating);

  if (generating) {
    return `
      <section class="surface surface-pad scenario-generating" aria-busy="true">
        <div class="section-heading">
          <div>
            <h2>自动想定 · AI 全要素编译中</h2>
            <p>正在汇流阶段时序、任务区域几何与作战兵力装备平台，生成红蓝对抗推演想定…</p>
          </div>
        </div>
        <div class="brief-generate-progress" role="status" aria-live="polite">
          <span class="brief-generate-progress-bar"></span>
          <span class="brief-generate-progress-label">正在编译推演实体、任务区域与阶段事件序列…</span>
        </div>
      </section>
    `;
  }

  if (!scenario) {
    return `
      <section class="surface surface-pad scenario-empty">
        <div class="section-heading">
          <div>
            <h2>自动想定</h2>
            <p>基于已确认的阶段行动、作战任务区域与作战兵力编成，全要素编译仿真推演想定。</p>
          </div>
          <button data-action="generate-scenario" class="primary-button">AI 编译生成想定</button>
        </div>
        ${renderProjectStorageState(state.scenarioStorage, { refreshAction: "refresh-project-scenario" })}
        <div class="idea-prompt">
          <p><strong>全要素想定说明：</strong>系统将自动综合前序成果，生成红蓝双方推演实体（含搭载平台装备属性）、任务几何区域（圆形/多边形/巡逻走廊）以及跨阶段的动态对抗事件序列，并可导出为 <code>deployment_data</code> 与 <code>GeoJSON</code>。</p>
        </div>
      </section>
    `;
  }

  const freshness = getScenarioFreshness(scenario, state);
  return `
    <section class="surface surface-pad">
      <div class="section-heading">
        <div>
          <h2>自动想定</h2>
          <p>生成于 ${new Date(scenario.generatedAt).toLocaleString("zh-CN", { hour12: false })}${freshness.stale ? " · 相对上游成果已变更" : ""}</p>
        </div>
        <div class="activity-toolbar">
          <span class="mini-tag ${freshness.stale ? "review" : ""}">${freshness.stale ? "上游成果已变更" : "与上游一致"}</span>
          <button class="quiet-button" data-action="recommend-deployment" ${freshness.stale ? "disabled" : ""}>优化部署</button>
          <button data-action="generate-scenario">${freshness.stale ? "重新编译想定" : "AI 重新生成"}</button>
        </div>
      </div>
      ${freshness.stale ? `<div class="scenario-stale-banner ooda-stale-banner" role="status"><div><strong>想定相对阶段行动 / 兵力任务已过期</strong><p>${escapeHtml(freshness.reason)} 可先审阅当前实体与时间线，确认后重新生成。</p></div><button type="button" data-action="generate-scenario">立即重新生成</button></div>` : ""}
      ${renderProjectStorageState(state.scenarioStorage, { refreshAction: "refresh-project-scenario" })}
      ${scenario.summary ? `<div class="scenario-summary-card"><p>${escapeHtml(scenario.summary)}</p></div>` : ""}
      <div class="scenario-grid ${freshness.stale ? "is-stale" : ""}">
        <div class="scenario-map">
          ${scenario.areas.map((area) => `<div class="scenario-area ${area.type}" title="${escapeHtml(area.label)} (${area.type})" style="left:calc(${area.position[0]}% - ${area.size / 2}px);top:calc(${area.position[1]}% - ${area.size / 2}px);width:${area.size}px;height:${area.size}px"><span class="area-label">${escapeHtml(area.label)}</span></div>`).join("")}
          ${scenario.entities.map((entity) => `<button class="map-unit ${entity.className}" data-unit="${entity.id}" title="${escapeHtml(entity.label)} · ${entity.platform || entity.role}" style="left:calc(${entity.position[0]}% - 19px);top:calc(${entity.position[1]}% - 19px)">${unitGlyph(entity.role, entity.side)}</button>`).join("")}
        </div>
        <div>
          <h3>推演事件序列 (${scenario.timeline?.length || 0})</h3>
          <div class="timeline">${scenario.timeline.map((item) => `
            <div class="timeline-item">
              <b>${escapeHtml(item.time)}</b>
              <span>
                <strong>${item.phase ? `[${escapeHtml(item.phase)}] ` : ""}${escapeHtml(item.title)}</strong>
                <small>${escapeHtml(item.description)}</small>
                ${item.impact ? `<em class="timeline-impact">影响：${escapeHtml(item.impact)}</em>` : ""}
              </span>
            </div>`).join("")}</div>
          <div class="inspector-section">
            <h3>部署数据</h3>
            <p>已生成 <code>deployment_data</code> 与抽象网格 <code>GeoJSON</code>，可推送至外部态势/推演工具。</p>
            <button class="quiet-button" data-action="export-scenario-geojson">导出 GeoJSON</button>
          </div>
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
  const facts = [
    ["阵营", entity.side === "hostile" ? "红方（对抗）" : "蓝方（研究主体）"],
    ["作战角色", roleLabel(entity.role)],
    ["搭载平台", entity.platform || "未明确"],
    ["抽象坐标", `${entity.position[0]}%, ${entity.position[1]}%`]
  ];
  if (entity.task) facts.push(["承接任务", entity.task]);

  return {
    id: entity.id,
    kind: "unit",
    title: entity.label,
    status: "想定推演实体",
    text: entity.task ? `该实体承接作战任务「${entity.task}」，在推演中担任${roleLabel(entity.role)}。` : "该实体由阶段行动与兵力编成全要素推导生成，可在部署图工具中调整。",
    facts,
    refs: entity.sourceKnowledgeRefs || []
  };
}

function roleLabel(role) {
  const map = { sensor: "态势感知", command: "指挥控制", action: "交战行动", support: "支援保障", opponent: "红方对抗" };
  return map[role] || "作战单元";
}

function unitGlyph(role, side) {
  if (side === "hostile" || role === "opponent") return "红";
  return { sensor: "感", command: "指", action: "行", support: "保" }[role] || "蓝";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[character]));
}
