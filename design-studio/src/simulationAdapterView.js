import { buildSimulationDiagnostics } from "./simulationAdapter.js";
import {
  extractSimulationDeviations,
  extractSimulationPhaseOutcomes
} from "./simulationRecycleStore.js";

export function renderSimulationAdapter(state) {
  const scenario = state.scenario;
  const settings = state.simulationAdapterSettings || {};
  const diagnostics = buildSimulationDiagnostics(scenario);
  const latestRun = diagnostics.latestRun;
  return `
    <section class="inspector-section simulation-adapter">
      <div class="section-heading"><div><h3>仿真适配与推演结果回收</h3><p>仅导出抽象百分比网格、角色、区域、时间线和部署诊断；支持将推演成效与偏差回填至阶段和活动。</p></div><span class="status-tag ${settings.enabled ? "" : "review"}">${settings.enabled ? "已配置人工交接" : "未配置"}</span></div>
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
      ${latestRun?.result ? renderSimulationRecycleSection(state, diagnostics) : ""}
    </section>
  `;
}

function renderSimulationRuns(diagnostics) {
  const run = diagnostics.latestRun;
  if (!run) return `<div class="simulation-adapter-empty-block"><p class="simulation-adapter-empty">当前尚未登记仿真提交记录。可通过上方表单配置外部仿真适配，或导出推演数据 JSON。</p></div>`;
  const result = run.result;
  return `<div class="simulation-run-summary"><b>最近提交</b><span>${escapeHtml(run.adapterName)} ${escapeHtml(run.adapterVersion)} · ${escapeHtml(run.submittedAt)}</span><small>包：${escapeHtml(run.packageId)} · 状态：${escapeHtml(result?.status || run.status)} · 输入：${escapeHtml(freshnessLabel(run.freshness))}${result?.inputMatch ? ` · 回传指纹：${escapeHtml(inputMatchLabel(result.inputMatch))}` : ""}</small>${result ? `<p>${escapeHtml(result.summary)}</p>${renderMetrics(result.metrics)}` : ""}</div>`;
}

function renderMetrics(metrics) {
  const items = Array.isArray(metrics) ? metrics : [];
  if (!items.length) return "";
  return `<div class="simulation-run-metrics">${items.map((item) => `<span><b>${escapeHtml(item.label)}</b>${escapeHtml(item.value)} ${escapeHtml(item.unit)}</span>`).join("")}</div>`;
}

function renderSimulationRecycleSection(state, diagnostics) {
  const phaseAction = state.phaseAction;
  const ov5 = state.ov5;
  const scenario = state.scenario;
  const phaseOutcomes = extractSimulationPhaseOutcomes(scenario, phaseAction);
  const deviations = extractSimulationDeviations({ scenario, phaseAction, ov5 });
  const isRecycled = Boolean(scenario?.simulation?.lastRecycledAt || phaseAction?.simulationRecycleSummary);

  const highCount = deviations.filter((d) => d.severity === "high").length;
  const mediumCount = deviations.filter((d) => d.severity === "medium").length;
  const lowCount = deviations.filter((d) => d.severity === "low").length;

  return `
    <div class="simulation-recycle-section" style="margin-top: 16px; padding: 14px; border: 1px solid var(--border-color, #e0e0e0); border-radius: 6px; background: var(--bg-card, #fafafa);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <div>
          <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600;">推演结果回收与偏差提炼</h4>
          <span style="font-size: 12px; color: var(--text-muted, #666);">
            ${isRecycled ? `已回填至阶段与活动 (${escapeHtml(scenario?.simulation?.lastRecycledAt?.slice(0, 16) || "")})` : "最新仿真结果尚未回填至阶段与活动"}
          </span>
        </div>
        <button class="primary-button" data-action="recycle-simulation-to-phases-and-activities" style="font-size: 12px; padding: 4px 12px;">
          ${isRecycled ? "重新回填结果与偏差" : "一键回填到阶段与活动"}
        </button>
      </div>

      <div style="display: flex; gap: 8px; margin-bottom: 12px; font-size: 12px;">
        <span class="coverage-pill" style="padding: 2px 8px; border-radius: 12px; background: #eef2ff; color: #3730a3;">
          阶段推演达成：${phaseOutcomes.filter((p) => p.status === "achieved").length}/${phaseOutcomes.length}
        </span>
        <span class="coverage-pill" style="padding: 2px 8px; border-radius: 12px; background: #fef2f2; color: #991b1b;">
          高风险偏差：${highCount}
        </span>
        <span class="coverage-pill" style="padding: 2px 8px; border-radius: 12px; background: #fffbeb; color: #92400e;">
          中风险偏差：${mediumCount}
        </span>
        <span class="coverage-pill" style="padding: 2px 8px; border-radius: 12px; background: #f0fdf4; color: #166534;">
          低风险：${lowCount}
        </span>
      </div>

      <div style="margin-bottom: 12px;">
        <div style="font-size: 12px; font-weight: 600; margin-bottom: 6px;">各阶段推演成效与战损：</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; background: #fff;">
          <thead>
            <tr style="border-bottom: 1px solid #ddd; background: #f5f5f5; text-align: left;">
              <th style="padding: 6px 8px;">阶段</th>
              <th style="padding: 6px 8px;">时差</th>
              <th style="padding: 6px 8px;">战损</th>
              <th style="padding: 6px 8px;">状态</th>
              <th style="padding: 6px 8px;">研判结论</th>
            </tr>
          </thead>
          <tbody>
            ${phaseOutcomes.map((po) => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 6px 8px; font-weight: 500;">${escapeHtml(po.phaseName)}</td>
                <td style="padding: 6px 8px;">${escapeHtml(po.durationDelta)}</td>
                <td style="padding: 6px 8px;">${escapeHtml(po.lossRate)}</td>
                <td style="padding: 6px 8px;"><span class="status-tag ${po.status === "achieved" ? "ready" : "review"}">${escapeHtml(po.statusLabel)}</span></td>
                <td style="padding: 6px 8px; color: #555;">${escapeHtml(po.summary)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div>
        <div style="font-size: 12px; font-weight: 600; margin-bottom: 6px;">推演执行偏差清单 (${deviations.length} 项)：</div>
        ${deviations.length === 0 ? `<div style="font-size: 12px; color: #666; padding: 6px 0;">推演各阶段与活动紧密闭环，未检出显著执行偏差。</div>` : `
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; background: #fff;">
            <thead>
              <tr style="border-bottom: 1px solid #ddd; background: #f5f5f5; text-align: left;">
                <th style="padding: 6px 8px;">编号</th>
                <th style="padding: 6px 8px;">要素对象</th>
                <th style="padding: 6px 8px;">偏差类别</th>
                <th style="padding: 6px 8px;">严重度</th>
                <th style="padding: 6px 8px;">计划 vs 实际 (差距)</th>
                <th style="padding: 6px 8px;">成因与改进建议</th>
              </tr>
            </thead>
            <tbody>
              ${deviations.map((d, i) => `
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 6px 8px; font-weight: 600;">DEV-${String(i + 1).padStart(2, "0")}</td>
                  <td style="padding: 6px 8px;">[${escapeHtml(d.targetType === "phase" ? "阶段" : "活动")}] ${escapeHtml(d.targetName)}</td>
                  <td style="padding: 6px 8px;">${escapeHtml(d.categoryLabel)}</td>
                  <td style="padding: 6px 8px;"><span style="color: ${d.severity === "high" ? "#dc2626" : d.severity === "medium" ? "#d97706" : "#16a34a"}; font-weight: 600;">${escapeHtml(d.severityLabel)}</span></td>
                  <td style="padding: 6px 8px;"><b>基准:</b> ${escapeHtml(d.planned)}<br><b>实际:</b> ${escapeHtml(d.actual)}<br><span style="color: #666;">(差值: ${escapeHtml(d.gap)})</span></td>
                  <td style="padding: 6px 8px;"><b>成因:</b> ${escapeHtml(d.rootCause)}<br><b>建议:</b> ${escapeHtml(d.recommendation)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `}
      </div>
    </div>
  `;
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
