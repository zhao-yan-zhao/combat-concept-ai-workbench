import { renderProjectStorageState } from "./projectStorageView.js";

export function renderValidation(state) {
  const result = state.validationResult;
  if (!result) {
    return `
      <section class="surface surface-pad scenario-empty">
        <div class="section-heading"><div><h2>设计验证</h2><p>检查 活动连通性、信息定义、OODA 时效和想定来源覆盖。</p></div><div class="activity-toolbar"><button class="quiet-button" type="button" data-action="open-structure-review">结构核对台</button><button data-action="run-validation">运行设计验证</button></div></div>
        ${renderProjectStorageState(state.validationStorage, { refreshAction: "refresh-project-validation" })}
        <div class="idea-prompt"><p>验证会消费当前活动模型、研究循环 和自动想定数据，先执行确定性规则，再形成红方质询草案。规则问题会同步出现在结构核对台，便于与派生诊断一并处理。模型变更后结果会标为过期，需重新运行。</p></div>
        ${renderRedTeamService(state.redTeamHealth)}
      </section>
    `;
  }

  const stale = Boolean(result.stale);
  return `
    <section class="surface surface-pad">
      <div class="section-heading"><div><h2>设计验证</h2><p>运行时间：${new Date(result.generatedAt).toLocaleString("zh-CN", { hour12: false })} · OODA 周期：${result.oodaDuration || "待估算"} 分钟${stale ? " · 已过期" : ""}</p></div><div class="activity-toolbar"><button class="quiet-button" type="button" data-action="open-structure-review">结构核对台</button><button data-action="run-validation">${stale ? "重新运行验证" : "重新运行验证"}</button></div></div>
      ${renderProjectStorageState(state.validationStorage, { refreshAction: "refresh-project-validation" })}
      ${stale ? `<div class="validation-stale-banner" role="status"><strong>验证结果已过期</strong><p>${escapeHtml(result.staleReason || "上游模型已变更，下列评分与问题仅供参考。请重新运行设计验证。")}</p><button type="button" data-action="run-validation">立即重跑</button></div>` : ""}
      <div class="validation-grid ${stale ? "is-stale" : ""}">
        <div><h3>规则评分${stale ? "（参考）" : ""}</h3><div class="score-list">${result.scores.map((item) => `<div class="score-line"><span>${item.label}</span><div class="score-bar" style="--score:${item.score}%"><span></span></div><b>${item.score}</b></div>`).join("")}</div>${renderTraceabilityDiagnostics(result.traceabilityDiagnostics)}${renderOodaDiagnostics(result.oodaDiagnostics)}${renderFlowDiagnostics(result.flowDiagnostics)}${renderSimulationDiagnostics(result.simulationDiagnostics)}</div>
        <div><h3>${result.issues.length ? (stale ? "过期问题与修正建议" : "验证问题与修正建议") : "规则检查通过"}</h3><div class="issue-list">${result.issues.length ? result.issues.map((item) => renderIssueCard(item, stale)).join("") : `<div class="idea-prompt"><p>当前模型未发现阻断性规则问题，可进入红方质询或导出成果。</p></div>`}</div></div>
      </div>
    </section>
    ${renderAssumptionImpactSection(result.assumptionImpacts || [])}
    ${renderRedTeamReview(result, state.redTeamRunning, state.redTeamHealth)}
  `;
}

function renderTraceabilityDiagnostics(diagnostics) {
  if (!diagnostics?.checks?.length) return "";
  return `<section class="ooda-diagnostics"><h3>追溯关系诊断</h3><div class="ooda-diagnostic-list">${diagnostics.checks.map((check) => `<div class="ooda-diagnostic ${escapeHtml(check.state)}"><strong>${escapeHtml(check.label)}</strong><span>${escapeHtml(check.statusLabel)}</span><p>${escapeHtml(check.detail)}</p></div>`).join("")}</div></section>`;
}

function renderOodaDiagnostics(diagnostics) {
  if (!diagnostics?.checks?.length) return "";
  return `<section class="ooda-diagnostics"><h3>OODA 静态诊断</h3><div class="ooda-diagnostic-list">${diagnostics.checks.map((check) => `<div class="ooda-diagnostic ${escapeHtml(check.state)}"><strong>${escapeHtml(check.label)}</strong><span>${escapeHtml(check.statusLabel)}</span><p>${escapeHtml(check.detail)}</p></div>`).join("")}</div></section>`;
}

function renderFlowDiagnostics(diagnostics) {
  if (!diagnostics?.checks?.length) return "";
  return `<section class="ooda-diagnostics"><h3>OV-5 交换与资源诊断</h3><div class="ooda-diagnostic-list">${diagnostics.checks.map((check) => `<div class="ooda-diagnostic ${escapeHtml(check.state)}"><strong>${escapeHtml(check.label)}</strong><span>${escapeHtml(check.statusLabel)}</span><p>${escapeHtml(check.detail)}</p></div>`).join("")}</div></section>`;
}

function renderSimulationDiagnostics(diagnostics) {
  if (!diagnostics?.checks?.length) return "";
  return `<section class="ooda-diagnostics simulation-diagnostics"><h3>仿真适配状态</h3><div class="ooda-diagnostic-list">${diagnostics.checks.map((check) => `<div class="ooda-diagnostic ${escapeHtml(check.state)}"><strong>${escapeHtml(check.label)}</strong><span>${escapeHtml(check.statusLabel)}</span><p>${escapeHtml(check.detail)}</p></div>`).join("")}</div></section>`;
}

function renderRedTeamReview(result, running, health) {
  const review = result.redTeamReview;
  if (!review) {
    return `<section class="surface surface-pad"><div class="section-heading"><div><h2>红方质询</h2><p>基于当前模型、规则问题和 Obsidian 检索证据生成研究级对抗审阅。</p></div><button data-action="run-red-team" ${running ? "disabled" : ""}>${running ? "正在生成" : "生成红方质询"}</button></div><div class="idea-prompt"><p>${result.redTeam}</p></div>${renderRedTeamService(health)}</section>`;
  }
  const modeLabel = review.mode === "ai" ? `AI 生成${review.model ? ` · ${review.model}` : ""}` : "本地规则草案";
  const findings = review.findings || [];
  const acceptedCount = findings.filter((f) => f.status === "accepted").length;
  const revisedCount = findings.filter((f) => f.status === "revised").length;
  const rejectedCount = findings.filter((f) => f.status === "rejected").length;
  const pendingCount = findings.filter((f) => !f.status || f.status === "pending").length;
  const closedCount = acceptedCount + revisedCount + rejectedCount;
  const rate = findings.length ? Math.round((closedCount / findings.length) * 100) : 100;

  return `
    <section class="surface surface-pad">
      <div class="section-heading">
        <div>
          <h2>红方质询与意见处置追踪</h2>
          <p>生成时间：${new Date(review.generatedAt).toLocaleString("zh-CN", { hour12: false })}</p>
        </div>
        <div class="activity-toolbar">
          <span class="status-tag ${review.mode === "ai" ? "" : "review"}">${modeLabel}</span>
          <button data-action="run-red-team" ${running ? "disabled" : ""}>${running ? "正在生成" : "重新生成"}</button>
        </div>
      </div>
      <div class="idea-prompt"><p>${escapeHtml(review.summary)}</p></div>
      ${review.evidenceSelection ? `<p class="evidence-selection">${escapeHtml(formatEvidenceSelection(review.evidenceSelection))}</p>` : ""}

      <div class="red-team-tracking-summary">
        <div class="tracking-summary-label">
          <strong>审阅处置闭环率：${rate}%</strong>
          <span>共 ${findings.length} 条质询 · 已闭环 ${closedCount} 条</span>
        </div>
        <div class="tracking-summary-pills">
          <span class="tracking-pill revised">已修订 ${revisedCount}</span>
          <span class="tracking-pill accepted">已接受 ${acceptedCount}</span>
          <span class="tracking-pill rejected">已驳回 ${rejectedCount}</span>
          <span class="tracking-pill pending">待处置 ${pendingCount}</span>
        </div>
      </div>

      <div class="red-team-list">
        ${findings.map((item) => {
          const status = item.status || "pending";
          const statusMap = {
            revised: { label: "已修订", cls: "status-revised" },
            accepted: { label: "已接受", cls: "status-accepted" },
            rejected: { label: "已驳回", cls: "status-rejected" },
            pending: { label: "待处置", cls: "status-pending" }
          };
          const curStatus = statusMap[status] || statusMap.pending;
          const target = item.targetElement || { name: "关键作战机理要素", type: "activity" };
          return `
            <article class="red-team-finding ${item.severity} is-${status}">
              <div class="finding-header">
                <div class="finding-title-group">
                  <strong>${escapeHtml(item.title)}</strong>
                  <span class="severity-tag ${item.severity}">${item.severity === "high" ? "高优先级" : item.severity === "low" ? "低优先级" : "待复核"}</span>
                  <span class="finding-status-tag ${curStatus.cls}">${curStatus.label}</span>
                </div>
                <div class="finding-target-badge" title="关联要素 ID: ${escapeHtml(target.id || "")}">
                  <span>🎯 关联要素：${escapeHtml(target.name)}</span>
                </div>
              </div>
              <p class="finding-analysis">${escapeHtml(item.analysis)}</p>
              <p class="finding-recommendation"><b>改进建议：</b>${escapeHtml(item.recommendation)}</p>
              ${item.evidenceRefs?.length ? `<small class="finding-evidence">证据引用：${item.evidenceRefs.map(escapeHtml).join("、")}</small>` : ""}
              ${status === "rejected" && item.rejectionRationale ? `
                <div class="finding-rejection-box">
                  <strong>驳回理由：</strong>${escapeHtml(item.rejectionRationale)}
                </div>
              ` : ""}
              <div class="finding-actions">
                <button type="button" class="quiet-button compact-btn action-accept" data-action="accept-red-team-finding" data-finding-id="${escapeHtml(item.id)}" title="接受此意见，后续安排修订">接受</button>
                <button type="button" class="quiet-button compact-btn action-revise" data-action="revise-red-team-finding" data-finding-id="${escapeHtml(item.id)}" title="标记此意见已在当前模型中完成修订">已修订</button>
                <button type="button" class="quiet-button compact-btn action-reject" data-action="reject-red-team-finding" data-finding-id="${escapeHtml(item.id)}" title="驳回此意见（需输入驳回理由留存审计痕迹）">驳回</button>
                ${status !== "pending" ? `<button type="button" class="quiet-button compact-btn action-reset" data-action="reset-red-team-finding" data-finding-id="${escapeHtml(item.id)}" title="重置状态为待处置">重置</button>` : ""}
              </div>
            </article>
          `;
        }).join("")}
      </div>
      ${renderRedTeamService(health)}
    </section>
  `;
}

function formatEvidenceSelection(selection) {
  const source = selection.source === "server" ? "服务端项目证据" : "本地 Vault 证据";
  const revision = selection.source === "server" ? ` · 项目 r${Number(selection.projectRevision || 0)} / 索引 r${Number(selection.resourceRevision || 0)}` : "";
  return `${source} · ${Number(selection.count || 0)} 条${revision}${selection.fallback ? " · 已回退" : ""}`;
}

function renderRedTeamService(health) {
  const state = health || { status: "loading" };
  const isConfigured = state.status === "ready" && state.configured;
  const checking = state.status === "loading" || state.status === "unknown";
  const label = checking
    ? "正在检查服务"
    : state.status === "unavailable"
      ? "服务不可用"
      : isConfigured
        ? "AI 红方已配置"
        : "本地规则降级";
  const detail = checking
    ? "正在读取当前 AI 提供方状态。"
    : state.status === "unavailable"
      ? "当前无法读取服务状态，运行时仍会保留本地规则降级。"
      : isConfigured
        ? `${state.provider}${state.model ? ` · ${state.model}` : ""}`
        : "未配置 OPENAI_API_KEY，本次质询将使用本地规则。";
  const statusClass = isConfigured ? "" : "review";
  return `<div class="red-team-service"><div><span class="status-tag ${statusClass}">${escapeHtml(label)}</span><small>${escapeHtml(detail)}</small></div><button class="quiet-button" data-action="refresh-red-team-health" ${checking ? "disabled" : ""}>刷新状态</button></div>`;
}

function renderIssueCard(item, stale) {
  const targetLabel = item.targetViewLabel || item.targetView || "模型";
  const elementLabel = item.targetElementName ? `“${escapeHtml(item.targetElementName)}”` : "";
  const locatorBadge = `<span class="coverage-pill" style="font-size:10px; padding:1px 6px; background:#e0f2fe; color:#0369a1; border-radius:10px; margin-right:4px;">🎯 ${escapeHtml(targetLabel)}${elementLabel ? `: ${elementLabel}` : ""}</span>`;

  const repairBadge = item.repairable && item.repairPlan
    ? `<div style="margin-top:6px; padding:4px 8px; border-radius:4px; background:#f0fdf4; border:1px solid #bbf7d0; font-size:11px; color:#166534; display:flex; justify-content:space-between; align-items:center;">
        <span>💡 建议: ${escapeHtml(item.repairPlan.label)}</span>
        <button type="button" class="primary-button" data-action="repair-validation-issue" data-issue-id="${escapeHtml(item.id)}" style="font-size:11px; padding:2px 8px; margin-left:6px; cursor:pointer;">一键修复</button>
      </div>`
    : "";

  return `
    <div class="issue-card-wrapper" style="margin-bottom:8px; border:1px solid var(--border-color, #e5e7eb); border-radius:6px; padding:8px; background:var(--bg-card, #fff);">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
        <button class="issue ${item.level === "high" ? "alert" : ""} ${stale ? "stale" : ""}" data-validation-issue="${escapeHtml(item.id)}" style="flex:1; border:none; background:transparent; padding:0; text-align:left; cursor:pointer;">
          <strong>${escapeHtml(item.title)}</strong>
        </button>
        <button type="button" class="quiet-button" data-action="locate-validation-issue" data-issue-id="${escapeHtml(item.id)}" title="跳转定位到此要素" style="font-size:11px; padding:1px 6px; cursor:pointer;">🎯 定位</button>
      </div>
      <p style="margin:4px 0; font-size:12px; color:var(--text-muted, #4b5563);">${escapeHtml(item.text)}</p>
      <div style="margin-top:4px;">${locatorBadge}</div>
      ${repairBadge}
    </div>
  `;
}

export function selectionForValidationIssue(issueId, result) {
  const issue = result?.issues.find((item) => item.id === issueId);
  if (!issue) return null;
  const targetLabel = issue.targetViewLabel || issue.targetView || "模型";
  return {
    id: issue.id,
    kind: "issue",
    title: issue.title,
    status: issue.level === "high" ? "高优先级问题" : "待修订问题",
    text: issue.text,
    facts: [
      ["检查类型", "静态一致性规则"],
      ["定位视图", targetLabel],
      ["目标要素", issue.targetElementName || issue.sourceId || "模型级"],
      ["修复方案", issue.repairPlan ? issue.repairPlan.label : "需人工核对修订"]
    ],
    refs: ["多方案评估框架"],
    issueData: issue
  };
}

export function renderAssumptionImpactSection(impacts = []) {
  if (!Array.isArray(impacts) || impacts.length === 0) {
    return `
      <section class="surface surface-pad assumption-impact-section" style="margin-top:16px;">
        <div class="section-heading">
          <div>
            <h3>🎯 关键假设与连锁失效波及评估 (T7.1)</h3>
            <p>汇总战法论证链的关键假设，按置信度排序推演失效连锁影响。</p>
          </div>
        </div>
        <div class="idea-prompt" style="padding:12px; font-size:13px; color:#64748b;">
          当前尚未配置结构化论证链假设。可在 <strong>[OV-5 作战活动与机理]</strong> 切换至“制胜论证链与假设”视角进行配置与评估。
        </div>
      </section>
    `;
  }

  return `
    <section class="surface surface-pad assumption-impact-section" style="margin-top:16px;">
      <div class="section-heading">
        <div>
          <h3>🎯 关键假设与连锁失效波及评估 (T7.1)</h3>
          <p>战法核心假设置信度排查：低置信度假设若被推翻，对应活动与阶段将发生级联失效。</p>
        </div>
        <div class="activity-toolbar">
          <span class="mini-tag" style="background:#f1f5f9; color:#475569;">共 ${impacts.length} 项关键假设</span>
        </div>
      </div>
      <div class="assumption-impact-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(360px, 1fr)); gap:12px; margin-top:12px;">
        ${impacts.map((item) => {
          const isCritical = item.severity === "critical";
          const isHigh = item.severity === "high";
          const badgeBg = item.confidence === "低" ? "#fef2f2" : item.confidence === "中" ? "#fffbeb" : "#f0fdf4";
          const badgeColor = item.confidence === "低" ? "#b91c1c" : item.confidence === "中" ? "#b45309" : "#15803d";
          const borderStyle = isCritical ? "2px solid #ef4444" : isHigh ? "1px solid #f87171" : "1px solid #e2e8f0";

          return `
            <div class="assumption-impact-card" style="background:#fff; border:${borderStyle}; border-radius:8px; padding:12px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-weight:700; font-size:13px; color:#1e293b;">${escapeHtml(item.assumptionId)}</span>
                <div>
                  <span style="font-size:11px; padding:2px 8px; border-radius:12px; background:${badgeBg}; color:${badgeColor}; font-weight:600;">
                    ${item.confidence === "低" ? "🔴" : item.confidence === "中" ? "🟡" : "🟢"} ${escapeHtml(item.confidence)}置信度
                  </span>
                  ${isCritical ? `<span style="font-size:11px; padding:2px 6px; border-radius:12px; background:#ef4444; color:#fff; font-weight:600; margin-left:4px;">高危连锁</span>` : ""}
                </div>
              </div>
              <p style="font-size:13px; font-weight:600; color:#0f172a; margin:0 0 6px 0;">${escapeHtml(item.text)}</p>
              
              <div style="font-size:12px; background:#f8fafc; border-left:3px solid ${badgeColor}; padding:6px 8px; border-radius:4px; margin-bottom:8px;">
                <div style="color:#64748b; font-size:11px; font-weight:600; margin-bottom:2px;">若假设失效之推论后果：</div>
                <div style="color:#334155;">${escapeHtml(item.ifFalse)}</div>
              </div>

              <div style="font-size:12px; color:#475569;">
                <div style="font-size:11px; color:#64748b; font-weight:600; margin-bottom:4px;">依赖本假设的 OV-5 活动与阶段：</div>
                ${item.impactedActivities.length > 0 ? `
                  <div style="display:flex; flex-wrap:wrap; gap:4px;">
                    ${item.impactedActivities.map((act) => `
                      <span style="font-size:11px; padding:2px 6px; background:#e0f2fe; color:#0369a1; border-radius:4px;" title="阶段: ${escapeHtml(act.phaseName)} · 力量: ${escapeHtml(act.performerName)}">
                        📌 ${escapeHtml(act.name)} (${escapeHtml(act.phaseName)})
                      </span>
                    `).join("")}
                  </div>
                ` : `<span style="font-size:11px; color:#94a3b8; font-style:italic;">暂未关联活动（孤立假设）</span>`}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
