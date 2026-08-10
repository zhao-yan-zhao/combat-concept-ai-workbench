import { renderProjectStorageState } from "./projectStorageView.js";

export function renderValidation(state) {
  const result = state.validationResult;
  if (!result) {
    return `
      <section class="surface surface-pad scenario-empty">
        <div class="section-heading"><div><h2>设计验证</h2><p>检查 OV-5 连通性、信息定义、OODA 时效和想定来源覆盖。</p></div><div class="activity-toolbar"><button class="quiet-button" type="button" data-action="open-structure-review">结构核对台</button><button data-action="run-validation">运行设计验证</button></div></div>
        ${renderProjectStorageState(state.validationStorage, { refreshAction: "refresh-project-validation" })}
        <div class="idea-prompt"><p>验证会消费当前 OV-5、OODA 和自动想定数据，先执行确定性规则，再形成红方质询草案。规则问题会同步出现在结构核对台，便于与派生诊断一并处理。模型变更后结果会标为过期，需重新运行。</p></div>
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
        <div><h3>${result.issues.length ? (stale ? "过期问题与修正建议" : "验证问题与修正建议") : "规则检查通过"}</h3><div class="issue-list">${result.issues.length ? result.issues.map((item) => `<button class="issue ${item.level === "high" ? "alert" : ""} ${stale ? "stale" : ""}" data-validation-issue="${item.id}"><i></i><div><strong>${item.title}</strong><p>${item.text}</p></div></button>`).join("") : `<div class="idea-prompt"><p>当前模型未发现阻断性规则问题，可进入红方质询或导出成果。</p></div>`}</div></div>
      </div>
    </section>
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
  return `
    <section class="surface surface-pad">
      <div class="section-heading"><div><h2>红方质询</h2><p>生成时间：${new Date(review.generatedAt).toLocaleString("zh-CN", { hour12: false })}</p></div><div class="activity-toolbar"><span class="status-tag ${review.mode === "ai" ? "" : "review"}">${modeLabel}</span><button data-action="run-red-team" ${running ? "disabled" : ""}>${running ? "正在生成" : "重新生成"}</button></div></div>
      <div class="idea-prompt"><p>${escapeHtml(review.summary)}</p></div>
      ${review.evidenceSelection ? `<p class="evidence-selection">${escapeHtml(formatEvidenceSelection(review.evidenceSelection))}</p>` : ""}
      <div class="red-team-list">${review.findings.map((item) => `<article class="red-team-finding ${item.severity}"><div><strong>${escapeHtml(item.title)}</strong><span>${item.severity === "high" ? "高优先级" : item.severity === "low" ? "低优先级" : "待复核"}</span></div><p>${escapeHtml(item.analysis)}</p><p><b>建议：</b>${escapeHtml(item.recommendation)}</p>${item.evidenceRefs.length ? `<small>证据：${item.evidenceRefs.map(escapeHtml).join("、")}</small>` : ""}</article>`).join("")}</div>
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

export function selectionForValidationIssue(issueId, result) {
  const issue = result?.issues.find((item) => item.id === issueId);
  if (!issue) return null;
  return {
    id: issue.id,
    title: issue.title,
    status: issue.level === "high" ? "高优先级问题" : "待修订问题",
    text: issue.text,
    facts: [["检查类型", "静态规则"], ["关联节点", issue.sourceId || "模型级"], ["建议", "修订后重新运行验证"]],
    refs: ["多方案评估框架"]
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
