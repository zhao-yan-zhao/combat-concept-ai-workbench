import { renderDeploymentIntegration } from "./deploymentView.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { getScenarioFreshness } from "./scenarioStore.js";
import { renderSimulationAdapter } from "./simulationAdapterView.js";
import { renderValidation } from "./validationView.js";

export function renderScenario(state) {
  const scenario = state.scenario;
  const generating = Boolean(state.scenarioGenerating);
  const validation = state.validationResult;
  const freshness = scenario ? getScenarioFreshness(scenario, state) : { stale: false };
  const viewMode = state.scenarioViewMode || (state.activeView === "validate" ? "validation" : "workbench");

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

  const entities = scenario?.entities || [];
  const timeline = scenario?.timeline || [];
  const areas = scenario?.areas || [];
  const issues = validation?.issues || [];
  const scores = validation?.scores || [];
  const redTeamReview = validation?.redTeamReview;
  const maturityScore = scores.length
    ? Math.round(scores.reduce((sum, s) => sum + Number(s.score || 0), 0) / scores.length)
    : 85;

  const redTeamLabel = redTeamReview?.findings?.length
    ? `${redTeamReview.findings.length} 条质询已分析`
    : "红方质询待运行";

  return `
    <section class="surface surface-pad scenario-workbench-surface">
      <header class="scenario-top-header" aria-label="仿真推演与验证">
        <div class="scenario-header-row">
          <div class="scenario-header-title">
            <button class="quiet-button scenario-btn-back" type="button" data-view="ov1" title="返回总体概念 (Step 05)">← 返回 (OV-1)</button>
            <h2>仿真推演与效能验证</h2>
            <span class="sr-only">自动想定</span>
            <span class="status-tag ${freshness.stale ? "review" : scenario ? "is-ready" : "muted"}">
              ${freshness.stale ? "上游已变更" : scenario ? "推演就绪" : "待编译"}
            </span>
            <div class="scenario-view-switch" role="tablist" aria-label="推演工作台视图模式">
              <button type="button" class="view-pill ${viewMode === "workbench" ? "active" : ""}" data-action="switch-scenario-view-mode" data-view-mode="workbench">
                🛡️ 一体化推演舱
              </button>
              <button type="button" class="view-pill ${viewMode === "validation" ? "active" : ""}" data-action="switch-scenario-view-mode" data-view-mode="validation">
                📊 效能评估与红方质询
              </button>
              <button type="button" class="view-pill ${viewMode === "timeline" ? "active" : ""}" data-action="switch-scenario-view-mode" data-view-mode="timeline">
                🗺️ 空间部署与时序
              </button>
            </div>
          </div>
          <div class="scenario-actions-bar">
            <button type="button" class="primary-btn scenario-action-primary" data-action="generate-scenario">
              ${freshness.stale ? "重新编译想定" : scenario ? "AI 重新编译" : "AI 编译生成想定"}
            </button>
            <button type="button" class="quiet-button" data-action="run-validation" title="执行确定性规则与红方对抗质询">
              运行效能验证
            </button>
            <button type="button" class="quiet-button" data-action="confirm-scenario-validation">
              ✓ 确认推演与验证结论
            </button>
            <details class="scenario-more-menu">
              <summary class="quiet-button">更多工具 ▾</summary>
              <div class="scenario-more-dropdown">
                <button type="button" data-action="recommend-deployment" ${freshness.stale || !scenario ? "disabled" : ""}>
                  优化空间部署
                </button>
                <button type="button" data-action="export-scenario-geojson" ${!scenario ? "disabled" : ""}>
                  导出 GeoJSON 数据
                </button>
                <button type="button" data-action="run-red-team">
                  重跑红方对抗质询
                </button>
                <button type="button" data-action="open-structure-review">
                  打开结构核对台
                </button>
              </div>
            </details>
          </div>
        </div>
        <div class="scenario-filter-top-row">
          <div class="scenario-filter-left">
            <input type="search" class="scenario-search-input" placeholder="搜索推演实体、事件或验证问题..." data-scenario-filter-search />
            <div class="scenario-hud-badges">
              <span class="scenario-hud-badge is-highlight">★ ${maturityScore}分 成熟度</span>
              <span class="scenario-hud-badge">${entities.length} 推演实体</span>
              <span class="scenario-hud-badge">${timeline.length} 事件序列</span>
              <span class="scenario-hud-badge ${issues.length ? "is-warn" : "is-ready"}">${issues.length} 待复核项</span>
              <span class="scenario-hud-badge">${redTeamLabel}</span>
            </div>
          </div>
          <div class="scenario-filter-right">
            <button type="button" class="quiet-button scenario-quick-jump-report" data-view="report">
              前往成果报告 (Deliver) →
            </button>
          </div>
        </div>
      </header>

      ${freshness.stale ? `
        <div class="scenario-stale-banner ooda-stale-banner" role="status">
          <div>
            <strong>想定相对阶段行动 / 兵力任务已过期</strong>
            <p>${escapeHtml(freshness.reason || "上游模型已变更，建议重新编译以刷新实体态势与事件序列。")} 可先审阅当前实体与时间线，确认后重新生成。</p>
          </div>
          <button type="button" data-action="generate-scenario">立即重新生成</button>
        </div>
      ` : ""}

      ${renderProjectStorageState(state.scenarioStorage, { refreshAction: "refresh-project-scenario" })}

      ${viewMode === "validation" ? `
        <div class="scenario-validation-viewport">
          ${renderValidation(state)}
        </div>
      ` : viewMode === "timeline" ? `
        <div class="scenario-timeline-viewport">
          ${renderFullTimelineView(scenario, state)}
        </div>
      ` : `
        <div class="scenario-workbench-body">
          ${!scenario ? `
            <div class="scenario-empty-hint idea-prompt">
              <p><strong>全要素想定说明：</strong>系统将自动综合前序成果，生成红蓝双方推演实体（含搭载平台装备属性）、任务几何区域（圆形/多边形/巡逻走廊）以及跨阶段的动态对抗事件序列，并可导出为 <code>deployment_data</code> 与 <code>GeoJSON</code>。</p>
              <button data-action="generate-scenario" class="primary-button" style="margin-top:10px;">AI 编译生成想定</button>
            </div>
          ` : `
            ${scenario.summary ? `<div class="scenario-summary-card"><p>${escapeHtml(scenario.summary)}</p></div>` : ""}
            <div class="scenario-grid ${freshness.stale ? "is-stale" : ""}">
              <div class="scenario-left-pane">
                <div class="scenario-map">
                  ${areas.map((area) => `<div class="scenario-area ${area.type}" title="${escapeHtml(area.label)} (${area.type})" style="left:calc(${area.position[0]}% - ${area.size / 2}px);top:calc(${area.position[1]}% - ${area.size / 2}px);width:${area.size}px;height:${area.size}px"><span class="area-label">${escapeHtml(area.label)}</span></div>`).join("")}
                  ${entities.map((entity) => `<button class="map-unit ${entity.className}" data-unit="${entity.id}" title="${escapeHtml(entity.label)} · ${entity.platform || entity.role}" style="left:calc(${entity.position[0]}% - 19px);top:calc(${entity.position[1]}% - 19px)">${unitGlyph(entity.role, entity.side)}</button>`).join("")}
                </div>
                <div class="scenario-entities-strip">
                  <header><strong>推演实体编组 (${entities.length})</strong></header>
                  <div class="scenario-entities-tags">
                    ${entities.map((e) => `<span class="scenario-entity-tag ${e.side === "hostile" ? "hostile" : "friendly"}">${escapeHtml(e.label)} <small>(${roleLabel(e.role)})</small></span>`).join("")}
                  </div>
                </div>
                ${renderDeploymentPlan(scenario.deploymentPlan)}
                ${renderSimulationAdapter(state)}
              </div>
              <div class="scenario-right-pane">
                <section class="scenario-feed-card">
                  <header class="scenario-card-head">
                    <h3>推演对抗事件时序 (${timeline.length})</h3>
                    <small>按作战阶段串接红蓝对抗</small>
                  </header>
                  <div class="timeline">${timeline.slice(0, 8).map((item) => `
                    <div class="timeline-item">
                      <b>${escapeHtml(item.time)}</b>
                      <span>
                        <strong>${item.phase ? `[${escapeHtml(item.phase)}] ` : ""}${escapeHtml(item.title)}</strong>
                        <small>${escapeHtml(item.description)}</small>
                        ${item.impact ? `<em class="timeline-impact">影响：${escapeHtml(item.impact)}</em>` : ""}
                      </span>
                    </div>`).join("")}
                    ${timeline.length > 8 ? `<div class="timeline-more-hint">还有 ${timeline.length - 8} 项事件，切换至「空间部署与时序」可查看完整序列</div>` : ""}
                  </div>
                </section>

                <section class="scenario-feed-card scenario-validation-card">
                  <header class="scenario-card-head">
                    <h3>效能指标与闭环回改建议</h3>
                    <small>量化规则评分与红方对抗质询发现</small>
                  </header>
                  ${scores.length ? `
                    <div class="score-list">
                      ${scores.map((item) => `
                        <div class="score-line">
                          <span>${escapeHtml(item.label)}</span>
                          <div class="score-bar" style="--score:${item.score}%"><span></span></div>
                          <b>${item.score}</b>
                        </div>
                      `).join("")}
                    </div>
                  ` : `<p class="muted">尚未执行验证评分，可点击上方「运行效能验证」。</p>`}

                  <div class="scenario-issues-container">
                    ${issues.length ? `
                      <div class="scenario-issues-title"><strong>待处理规则问题 (${issues.length}) · 可直接回改上游：</strong></div>
                      ${issues.slice(0, 4).map((issue) => `
                        <article class="scenario-issue-item ${issue.level === "high" ? "is-high" : ""}">
                          <div class="issue-main">
                            <strong>${escapeHtml(issue.title)}</strong>
                            <p>${escapeHtml(issue.text)}</p>
                          </div>
                          ${renderFeedbackJumps(issue)}
                        </article>
                      `).join("")}
                    ` : `
                      <div class="scenario-issues-pass">
                        ✓ 规则检查完全通过，未发现断链或孤立冲突。
                      </div>
                    `}

                    ${redTeamReview?.findings?.length ? `
                      <div class="scenario-issues-title" style="margin-top:10px;"><strong>红方博弈挑战 (${redTeamReview.findings.length})：</strong></div>
                      ${redTeamReview.findings.slice(0, 2).map((finding) => `
                        <article class="scenario-issue-item is-red-team">
                          <div class="issue-main">
                            <span class="red-team-badge">红方挑战</span>
                            <strong>${escapeHtml(finding.title)}</strong>
                            <p>${escapeHtml(finding.analysis)}</p>
                            <small>建议：${escapeHtml(finding.recommendation)}</small>
                          </div>
                          ${renderFeedbackJumps(finding)}
                        </article>
                      `).join("")}
                    ` : ""}
                  </div>
                </section>
              </div>
            </div>
          `}
        </div>
      `}
    </section>
    ${renderDeploymentIntegration(state)}
  `;
}

function renderFeedbackJumps(item) {
  const text = `${item.title || ""} ${item.text || item.analysis || item.recommendation || ""}`;
  const buttons = [];
  if (/活动|I\/O|接口|因果|输入|输出|闭环|依赖/.test(text)) {
    buttons.push(`<button type="button" class="quiet-button scenario-feedback-btn" data-view="ov5" title="回到 Step 04 作战活动与机理调整活动定义与 I/O 链路">✏️ 回改活动机理 (OV-5)</button>`);
  }
  if (/阶段|时序|窗口|进入|退出|触发/.test(text)) {
    buttons.push(`<button type="button" class="quiet-button scenario-feedback-btn" data-view="phase-action" title="回到 Step 02 阶段行动调整时窗与行动">✏️ 回改阶段行动 (Step 02)</button>`);
  }
  if (/兵力|装备|平台|编成|角色|协同/.test(text)) {
    buttons.push(`<button type="button" class="quiet-button scenario-feedback-btn" data-view="force-mission" title="回到 Step 03 任务与兵力调整编成与平台分配">✏️ 回改作战兵力 (Step 03)</button>`);
  }
  if (/总体|高层|宏观|概念/.test(text)) {
    buttons.push(`<button type="button" class="quiet-button scenario-feedback-btn" data-view="ov1" title="回到 Step 05 总体概念调整高层协同回路">✏️ 回改总体概念 (Step 05)</button>`);
  }
  if (!buttons.length) {
    buttons.push(`<button type="button" class="quiet-button scenario-feedback-btn" data-view="ov5" title="回到活动网络进行修订">✏️ 回改上游模型</button>`);
  }
  return `<div class="scenario-feedback-actions">${buttons.join("")}</div>`;
}

function renderFullTimelineView(scenario, state) {
  if (!scenario?.timeline?.length) {
    return `<div class="idea-prompt"><p>尚未生成推演事件序列，请先编译想定。</p></div>`;
  }
  return `
    <div class="scenario-full-timeline">
      <header class="scenario-timeline-head">
        <h3>全周期推演对抗事件序列 (${scenario.timeline.length})</h3>
        <button class="quiet-button" data-action="export-scenario-geojson">导出 GeoJSON 数据</button>
      </header>
      <div class="timeline is-expanded">${scenario.timeline.map((item) => `
        <div class="timeline-item">
          <b>${escapeHtml(item.time)}</b>
          <span>
            <strong>${item.phase ? `[${escapeHtml(item.phase)}] ` : ""}${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.description)}</small>
            ${item.impact ? `<em class="timeline-impact">影响：${escapeHtml(item.impact)}</em>` : ""}
          </span>
        </div>`).join("")}
      </div>
    </div>
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
