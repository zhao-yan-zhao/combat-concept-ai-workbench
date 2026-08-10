import { buildSimulationDiagnostics } from "./simulationAdapter.js";

export function renderSimulationAdapter(state) {
  const scenario = state.scenario;
  const settings = state.simulationAdapterSettings || {};
  const diagnostics = buildSimulationDiagnostics(scenario);
  const latestRun = diagnostics.latestRun;
  return `
    <section class="inspector-section simulation-adapter">
      <div class="section-heading"><div><h3>仿真适配</h3><p>仅导出抽象百分比网格、角色、区域、时间线和部署诊断；不连接外部平台。</p></div><span class="status-tag ${settings.enabled ? "" : "review"}">${settings.enabled ? "已配置人工交接" : "未配置"}</span></div>
      <form id="simulationAdapterForm" class="simulation-adapter-form">
        <label>适配器标识<input name="id" maxlength="80" value="${escapeHtml(settings.id || "")}" placeholder="manual-json-handoff"></label>
        <label>显示名称<input name="name" maxlength="160" value="${escapeHtml(settings.name || "")}" placeholder="通用 JSON 人工交接"></label>
        <label>版本<input name="version" maxlength="80" value="${escapeHtml(settings.version || "")}" placeholder="v1"></label>
        <label class="simulation-adapter-toggle"><input name="enabled" type="checkbox" ${settings.enabled ? "checked" : ""}>已由研究人员配置人工交接</label>
        <button class="quiet-button" type="submit">保存适配器设置</button>
      </form>
      <div class="activity-toolbar simulation-adapter-actions"><button class="quiet-button" data-action="run-local-abstract-simulation">运行本地抽象评估</button><button class="quiet-button" data-action="export-simulation-package">导出抽象输入 JSON</button><button data-action="record-simulation-submission" ${settings.enabled ? "" : "disabled"}>登记人工提交</button></div>
      ${renderSimulationRuns(diagnostics)}
      ${latestRun ? renderSimulationResultForm(latestRun) : ""}
    </section>
  `;
}

function renderSimulationRuns(diagnostics) {
  const run = diagnostics.latestRun;
  if (!run) return `<p class="simulation-adapter-empty">尚未登记仿真提交。导出 JSON 不会发送任何外部请求。</p>`;
  const result = run.result;
  return `<div class="simulation-run-summary"><b>最近提交</b><span>${escapeHtml(run.adapterName)} ${escapeHtml(run.adapterVersion)} · ${escapeHtml(run.submittedAt)}</span><small>包：${escapeHtml(run.packageId)} · 状态：${escapeHtml(result?.status || run.status)} · 输入：${escapeHtml(freshnessLabel(run.freshness))}${result?.inputMatch ? ` · 回传指纹：${escapeHtml(inputMatchLabel(result.inputMatch))}` : ""}</small>${result ? `<p>${escapeHtml(result.summary)}</p>${renderMetrics(result.metrics)}` : ""}</div>`;
}

function renderMetrics(metrics) {
  const items = Array.isArray(metrics) ? metrics : [];
  if (!items.length) return "";
  return `<div class="simulation-run-metrics">${items.map((item) => `<span><b>${escapeHtml(item.label)}</b>${escapeHtml(item.value)} ${escapeHtml(item.unit)}</span>`).join("")}</div>`;
}

function renderSimulationResultForm(run) {
  if (run.result) return "";
  return `
    <form id="simulationResultForm" class="simulation-result-form">
      <input type="hidden" name="runId" value="${escapeHtml(run.id)}">
      <h4>人工回传研究结果</h4>
      <label>结果状态<select name="status"><option value="completed">已完成</option><option value="inconclusive">结论不充分</option><option value="failed">运行失败</option></select></label>
      <label>回传输入指纹<input name="inputFingerprint" maxlength="160" placeholder="从已导出的抽象输入 JSON 粘贴；留空将标为待复核"></label>
      <label>结果摘要<textarea name="summary" maxlength="1600" rows="3" placeholder="记录外部工具返回的研究级摘要，需人工复核。"></textarea></label>
      <div class="simulation-metrics">
        ${[1, 2, 3].map((index) => `<label>指标 ${index}<input name="metricLabel${index}" maxlength="160" placeholder="研究指标名称"><span><input name="metricValue${index}" type="number" step="any" placeholder="数值"><input name="metricUnit${index}" maxlength="40" placeholder="单位"></span></label>`).join("")}
      </div>
      <button class="quiet-button" type="submit">登记人工回传</button>
    </form>
  `;
}

function inputMatchLabel(value) { return ({ matched: "匹配", mismatch: "不匹配", "not-supplied": "未提供" })[value] || "未提供"; }

function freshnessLabel(value) { return ({ current: "当前", stale: "已失效", unverified: "待复核" })[value] || "待确认"; }

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
