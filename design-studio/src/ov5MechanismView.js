import { getActivityHierarchy, getAssignableParentActivities } from "./ov5Store.js";
import { resolveAiActionLabel } from "./app/aiAvailability.js";
import { evaluateOodaLoopHealth } from "./oodaStore.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { renderOriginBadge, calculateEvidenceCoverage } from "./citationProvenanceView.js";
import { normalizeArgumentChain, getSortedAssumptions, evaluateAssumptionImpact } from "./argumentChainStore.js";
import { PRESET_TACTICAL_CASES, normalizeTacticalCase, searchTacticalCases } from "./tacticalCaseStore.js";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatEvidenceSelection(selection) {
  if (!selection) return "";
  const parts = [];
  if (selection.count) parts.push(`${selection.count} 条证据`);
  return parts.join(" · ");
}

const DOMAINS = ["太空", "空中", "水面", "水下", "陆基", "电磁", "网络", "综合"];

export function renderOv5Workbench(state, context = {}) {
  const model = state.ov5 || { activities: [], edges: [] };
  const activities = Array.isArray(model.activities) ? model.activities : [];
  const edges = Array.isArray(model.edges) ? model.edges : [];
  const activityById = new Map(activities.map((a) => [a.id, a]));

  const provenance = model.provenance?.mode === "ai"
    ? "AI 草案"
    : model.provenance?.mode === "local"
      ? "本地草案"
      : model.provenance?.mode === "derived"
        ? "任务派生"
        : "人工维护";
  const evidenceSelection = formatEvidenceSelection(model.provenance?.evidenceSelection);
  const oodaHealth = evaluateOodaLoopHealth(model);
  const latencyBudget = oodaHealth.latencyBudget || { totalSeconds: 0, formattedTotal: "待估算", exceedsBudget: false };
  const autonomyStats = oodaHealth.autonomyStats || { hitl: 0, hotl: 0, hootl: 0, total: 0 };
  const hierarchy = getActivityHierarchy(model);
  const hasMissingFeedback = oodaHealth.diagnostics.some((d) => d.code === "NO_FEEDBACK_LOOP");
  const scoreClass = oodaHealth.healthScore >= 80 ? "ready" : oodaHealth.healthScore >= 60 ? "review" : "danger";
  const viewMode = state.ov5ViewMode || "kill-web";
  const stressedNodeId = state.ov5StressedNodeId || null;
  const evidenceCoverage = calculateEvidenceCoverage(activities);

  return `
    <section class="surface surface-pad ov5-workbench-surface">
      <header class="ov5-compact-header">
        <div class="ov5-header-main-row">
          <div class="ov5-header-title-cluster">
            <h2>作战活动与机理 (OV-5b & 动力学闭环)</h2>
            <div class="ov5-header-pills">
              <span class="mini-tag ${state.ov5Generating ? "review" : ""}">${state.ov5Generating ? "生成中" : provenance}</span>
              ${evidenceSelection ? `<span class="mini-tag">${escapeHtml(evidenceSelection)}</span>` : ""}
              <span class="mini-tag count-pill">${activities.length} 项活动 · ${edges.length} 条关联</span>
              <span class="mini-tag coverage-pill" title="有知识依据的活动数量占比">${evidenceCoverage.label}</span>
              <span class="mini-tag ${scoreClass}">OODA ${oodaHealth.healthScore}分</span>
              <span class="mini-tag ${latencyBudget.exceedsBudget ? "review" : ""}" title="关键路径(CPM): ${latencyBudget.formattedTotal} · 最短杀伤链: ${latencyBudget.formattedFastest} · 资源并行总耗时: ${latencyBudget.formattedParallelSum} · 目标暴露窗口: ${latencyBudget.formattedBudget}">关键路径 ${latencyBudget.formattedTotal}${latencyBudget.exceedsBudget ? " (超限)" : ""}</span>
              <span class="mini-tag">自主 H:${autonomyStats.hitl}/O:${autonomyStats.hotl}/X:${autonomyStats.hootl}</span>
            </div>
          </div>
          <div class="ov5-header-primary-actions">
            <button type="button" class="ov5-btn-primary" data-action="generate-ov5" ${state.ov5Generating ? "disabled" : ""}>${resolveAiActionLabel(state, "AI 重建活动网", "正在生成", state.ov5Generating)}</button>
            ${activities.length > 0 ? `<button class="quiet-button ov5-btn-next" type="button" data-view="ov1" title="进入总体概念表达阶段">提炼总体图 →</button>` : ""}
          </div>
        </div>

        <div class="ov5-header-sub-row">
          <p class="ov5-header-subtitle">以作战活动网络为核心事实源，闭环分析杀伤链、跨域协同与抗毁机理。</p>
          <div class="ov5-header-tool-buttons">
            <button class="quiet-button compact-btn" data-action="derive-activities-from-tasks" ${state.ov5Generating ? "disabled" : ""} title="由上游已确认任务自动派生初始作战活动网">从任务派生</button>
            <button class="quiet-button compact-btn" data-action="apply-mapping-quality" ${state.ov5Generating ? "disabled" : ""} title="补全空 I/O 与浅层父活动">补全映射</button>
            <button class="quiet-button compact-btn" data-action="auto-fix-feedback-loop" ${state.ov5Generating || !hasMissingFeedback ? "disabled" : ""} title="在末端行动与感知/决策节点间自动建立反馈弧">一键修复闭环</button>
            <button class="quiet-button compact-btn" data-action="redteam-mechanism-challenge" ${state.ov5Generating ? "disabled" : ""} title="由红方注入电磁压制与战损扰动，质询机理鲁棒性">红方质询</button>
            <button class="quiet-button compact-btn" data-action="open-structure-review">结构核对</button>
            <button class="quiet-button compact-btn" data-action="add-activity" ${state.ov5Generating ? "disabled" : ""}>+ 新增活动</button>
          </div>
        </div>
      </header>
      <div class="ov5-storage-strip">
        ${renderProjectStorageState(state.ov5Storage, { refreshAction: "refresh-project-ov5" })}
      </div>

      <div class="ov5-workbench-layout">
        <!-- 左栏：结构树与任务映射 / 活动属性编辑与实体绑定 -->
        ${renderOv5LeftPanel({ state, model, activities, hierarchy, activityById })}

        <!-- 中栏：多视角动态工作台 -->
        <div class="ov5-center-panel">
          <!-- 视角导航选项卡 -->
          <nav class="ov5-view-nav" aria-label="活动机理分析视角">
            <button type="button" class="ov5-tab-btn ${viewMode === "kill-web" ? "active" : ""}" data-action="set-ov5-view" data-mode="kill-web" title="观察、判断、决策、行动、反哺因果闭环流">
              ⚡ 杀伤网与 OODA 因果流
            </button>
            <button type="button" class="ov5-tab-btn ${viewMode === "sync-matrix" ? "active" : ""}" data-action="set-ov5-view" data-mode="sync-matrix" title="各作战域/兵力与作战阶段的时间协同矩阵">
              🌐 跨域协同同步矩阵
            </button>
            <button type="button" class="ov5-tab-btn ${viewMode === "autonomy" ? "active" : ""}" data-action="set-ov5-view" data-mode="autonomy" title="人在回路(HITL)、人上回路(HOTL)、人在回路外(HOOTL)分配">
              🤖 人机决策与自主阶梯
            </button>
            <button type="button" class="ov5-tab-btn ${viewMode === "resilience" ? "active" : ""}" data-action="set-ov5-view" data-mode="resilience" title="模拟关键节点战损或强干扰，检验自愈降级链路">
              🛡️ 体系抗毁对抗推演
            </button>
            <button type="button" class="ov5-tab-btn ${viewMode === "argument-chain" ? "active" : ""}" data-action="set-ov5-view" data-mode="argument-chain" title="制胜机理论证链、关键假设清单与置信度排查">
              🎯 制胜论证链与假设
            </button>
          </nav>

          <!-- 视角具体内容 -->
          <div class="ov5-view-stage">
            ${renderActivePerspective({ viewMode, model, activities, edges, activityById, oodaHealth, state, stressedNodeId })}
          </div>

          <!-- 底部关系与连线维护（低视觉侵入折叠抽屉） -->
          <details class="ov5-relation-drawer" ${edges.length === 0 ? "open" : ""}>
            <summary class="ov5-relation-summary">
              <div class="summary-left">
                <span class="drawer-icon">🔗</span>
                <strong>活动因果流转与契约</strong>
                <span class="drawer-count">${edges.length} 条关联</span>
                <span class="drawer-hint">· 选定活动在右侧面板补充下游交互，展开查看契约明细与移除失效关联</span>
              </div>
              <div class="summary-right">
                <span class="drawer-toggle-cue">展开/折叠明细 ▾</span>
              </div>
            </summary>
            <div class="ov5-relation-box compact-drawer-content">
              <div class="relation-list compact-relation-list">
                ${edges.map((edge) => {
                  const src = activityById.get(edge.sourceId);
                  const tgt = activityById.get(edge.targetId);
                  const semantic = edge.flowSemantic || (edge.isFeedback ? "feedback" : "cue");
                  const semanticLabel = semantic === "feedback"
                    ? "↺ 闭环反哺"
                    : semantic === "authorization"
                      ? "⚖ 指控授权"
                      : semantic === "hand_off"
                        ? "🎯 火控交接"
                        : "📡 信息协同";
                  return `
                    <div class="relation-row ${edge.isFeedback ? "is-feedback-edge" : ""}">
                      <span class="rel-source">${escapeHtml(src?.title || "未知活动")}</span>
                      <b class="rel-badge ${semantic}">${semanticLabel}</b>
                      <span class="rel-target">${escapeHtml(tgt?.title || "未知活动")}</span>
                      ${edge.payload ? `<small class="rel-payload">载荷: ${escapeHtml(edge.payload)}</small>` : ""}
                      <button class="relation-remove" data-edge-remove="${escapeHtml(edge.id)}" title="移除关联" aria-label="移除关联">×</button>
                    </div>
                  `;
                }).join("") || `<p class="empty-relations">尚未建立活动关联。可选择活动建立输出到下游的因果弧。</p>`}
              </div>
            </div>
          </details>
        </div>

        <!-- 右栏：OODA 透镜、时延预算与脆弱性诊断 -->
        <aside class="ov5-ooda-panel" aria-label="OODA 闭环健康度与动力学透镜">
          <div class="panel-heading">
            <h3>机理动力学诊断</h3>
            <span class="ooda-score-tag ${scoreClass}">${oodaHealth.healthScore} 分</span>
          </div>
          <small class="ooda-lens-sub">杀伤网闭环率 · 时延预算 · 单点抗毁性</small>

          ${oodaHealth.diagnostics.length ? `
            <div class="ooda-diagnostics-list">
              ${oodaHealth.diagnostics.map((d) => `
                <div class="ooda-diag-alert ${d.level}">
                  <div class="diag-msg"><strong>${d.level === "critical_gap" ? "关键断环" : d.level === "error" ? "要素缺失" : "建议"}</strong>: ${escapeHtml(d.message)}</div>
                  ${d.code === "NO_FEEDBACK_LOOP" ? `<button type="button" class="quiet-button ooda-fix-btn" data-action="auto-fix-feedback-loop">一键补全闭环</button>` : ""}
                </div>
              `).join("")}
            </div>
          ` : `
            <div class="ooda-diag-clean">链路要素完整，因果闭环畅通</div>
          `}

          <!-- 时延预算剖面 -->
          <div class="mechanism-metric-block">
            <div class="metric-title">
              <strong>时效预算 (CPM 关键路径)</strong>
              <span>关键链 ${latencyBudget.formattedTotal}</span>
            </div>
            <div class="metric-meta-details" style="font-size:11px;color:#94a3b8;margin:4px 0 6px;display:flex;flex-wrap:wrap;gap:6px;">
              <span>最短链: <strong style="color:#7dd3fc">${latencyBudget.formattedFastest}</strong></span>
              <span>· 目标窗口: <strong style="color:${latencyBudget.exceedsBudget ? '#f87171' : '#34d399'}">${latencyBudget.formattedBudget}</strong></span>
              ${latencyBudget.exceedsBudget ? `<span style="color:#f87171;font-weight:700;">(超限)</span>` : ""}
            </div>
            ${latencyBudget.criticalPathLabels?.length ? `
              <div class="metric-cpm-chain" style="font-size:11px;color:#cbd5e1;background:rgba(2,6,23,0.4);padding:4px 8px;border-radius:4px;margin-bottom:6px;line-height:1.4;">
                <span style="color:#94a3b8;">关键路径瓶颈: </span>${escapeHtml(latencyBudget.criticalPathLabels.join(" ➔ "))}
              </div>
            ` : ""}
            <div class="metric-progress-track">
              <div class="progress-bar obs" style="width: 25%" title="观测截获"></div>
              <div class="progress-bar ori" style="width: 15%" title="判决融合"></div>
              <div class="progress-bar dec" style="width: 20%" title="指控决策"></div>
              <div class="progress-bar act" style="width: 30%" title="突击行动"></div>
              <div class="progress-bar fdb" style="width: 10%" title="反哺闭环"></div>
            </div>
            <div class="metric-legend">
              <span><i class="dot obs"></i> 察</span>
              <span><i class="dot ori"></i> 判</span>
              <span><i class="dot dec"></i> 决</span>
              <span><i class="dot act"></i> 击</span>
              <span><i class="dot fdb"></i> 评</span>
            </div>
          </div>

          <!-- 单点脆弱性 SPOF 诊断 -->
          ${oodaHealth.bottlenecks?.length ? `
            <div class="spof-alert-box">
              <div class="spof-head">⚠️ 检测到 ${oodaHealth.bottlenecks.length} 个单点断链风险 (SPOF)</div>
              <div class="spof-list">
                ${oodaHealth.bottlenecks.map((b) => `
                  <div class="spof-item" data-activity="${escapeHtml(b.id)}">
                    <strong>${escapeHtml(b.title)}</strong>
                    <small>缺少抗毁降级旁路，若遭干扰将阻断后续链路</small>
                  </div>
                `).join("")}
              </div>
              <button type="button" class="quiet-button" data-action="auto-fill-fallbacks">一键自动补全抗毁备用机制</button>
            </div>
          ` : `
            <div class="spof-clean-box">核心决策与控制节点均具备协同旁路支撑</div>
          `}

          <!-- 红方质询记录（若触发） -->
          ${state.ov5RedTeamChallenge ? `
            <div class="redteam-challenge-card">
              <div class="rt-head">🔴 红方机理抗毁质询</div>
              <p class="rt-body">${escapeHtml(state.ov5RedTeamChallenge)}</p>
            </div>
          ` : ""}

          <!-- OODA 五环活动清单 -->
          <div class="ooda-phase-cards">
            <div class="ooda-phase-card">
              <div class="ooda-phase-title"><strong>Observe 观测</strong><span>${oodaHealth.stats.observeCount} 项</span></div>
              <div class="ooda-phase-items">${formatPhaseActivities(oodaHealth.categorized.observe)}</div>
            </div>
            <div class="ooda-phase-card">
              <div class="ooda-phase-title"><strong>Orient 判决</strong><span>${oodaHealth.stats.orientCount} 项</span></div>
              <div class="ooda-phase-items">${formatPhaseActivities(oodaHealth.categorized.orient)}</div>
            </div>
            <div class="ooda-phase-card">
              <div class="ooda-phase-title"><strong>Decide 决策</strong><span>${oodaHealth.stats.decideCount} 项</span></div>
              <div class="ooda-phase-items">${formatPhaseActivities(oodaHealth.categorized.decide)}</div>
            </div>
            <div class="ooda-phase-card">
              <div class="ooda-phase-title"><strong>Act 行动</strong><span>${oodaHealth.stats.actCount} 项</span></div>
              <div class="ooda-phase-items">${formatPhaseActivities(oodaHealth.categorized.act)}</div>
            </div>
            <div class="ooda-phase-card">
              <div class="ooda-phase-title"><strong>Feedback 反哺</strong><span>${oodaHealth.stats.feedbackCount} 项</span></div>
              <div class="ooda-phase-items">${formatPhaseActivities(oodaHealth.categorized.feedback)}</div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  `;
}

function renderOv5LeftPanel({ state, model, activities, hierarchy, activityById }) {
  const selectedId = state.selection?.id;
  const selectedActivity = selectedId ? activityById.get(selectedId) : null;
  const isEditorMode = Boolean(selectedActivity) && state.ov5LeftMode !== "tree";

  if (isEditorMode && selectedActivity) {
    const parentOptions = getAssignableParentActivities(model, selectedActivity.id)
      .map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selectedActivity.parentId ? "selected" : ""}>${escapeHtml(item.title)}</option>`)
      .join("");
    const candidateTargets = activities.filter((a) => a.id !== selectedActivity.id);

    return `
      <aside class="ov5-tree-panel is-editor-panel" aria-label="活动属性与实体绑定">
        <div class="panel-heading">
          <div class="panel-heading-title-wrap">
            <span class="editor-kicker">✏️ 活动属性与实体绑定</span>
            <h3 class="editor-activity-title" title="${escapeHtml(selectedActivity.title)}">${escapeHtml(selectedActivity.title)}</h3>
          </div>
          <div class="panel-heading-actions">
            <button type="button" class="quiet-button compact-btn" data-action="toggle-ov5-left-mode" title="切换回架构树查看">🌲 架构树</button>
            <button type="button" class="quiet-button compact-btn icon-close" data-action="close-ov5-activity-editor" title="关闭编辑并取消选中">✕</button>
          </div>
        </div>

        <div class="ov5-editor-scroll-container">
          <form class="activity-editor ov5-inline-form" id="ov5ActivityForm">
            <div class="ov5-field-group">
              <label class="ov5-field">
                <span class="field-title">活动名称 <b class="req">*</b></span>
                <input name="title" class="ov5-input" value="${escapeHtml(selectedActivity.title)}" required placeholder="请输入作战活动名称">
              </label>
            </div>

            <div class="ov5-field-group highlight-field-group">
              <label class="ov5-field">
                <span class="field-title">🎯 执行主体 / 装备平台 <span class="highlight-tag">关键兵力绑定</span></span>
                <input name="performer" class="ov5-input performer-input" value="${escapeHtml(selectedActivity.performer || selectedActivity.resources || '')}" placeholder="例如：歼-20伴随无人侦察机、预警机、战区指控所">
                <span class="field-help">直接在此指定具体部队、战术平台或武器装备，即时绑定并显示在卡片上！</span>
              </label>
            </div>

            <div class="ov5-field-row">
              <label class="ov5-field">
                <span class="field-title">作战域</span>
                <select name="domain" class="ov5-select">
                  ${DOMAINS.map((d) => `<option value="${d}" ${(selectedActivity.domain || "综合") === d ? "selected" : ""}>${d}域</option>`).join("")}
                </select>
              </label>
              <label class="ov5-field">
                <span class="field-title">自主决策等级</span>
                <select name="autonomy" class="ov5-select">
                  <option value="HITL" ${selectedActivity.autonomy === "HITL" ? "selected" : ""}>人在回路 (HITL) - 指挥授权</option>
                  <option value="HOTL" ${selectedActivity.autonomy === "HOTL" || !selectedActivity.autonomy ? "selected" : ""}>人上回路 (HOTL) - 智能协同</option>
                  <option value="HOOTL" ${selectedActivity.autonomy === "HOOTL" ? "selected" : ""}>全自主 (HOOTL) - 边缘自适应</option>
                </select>
              </label>
            </div>

            <div class="ov5-field-row">
              <label class="ov5-field">
                <span class="field-title">时延预算 / 窗口</span>
                <input name="timingWindow" class="ov5-input" value="${escapeHtml(selectedActivity.timingWindow || selectedActivity.duration || '')}" placeholder="例如：15m / 5s">
              </label>
              <label class="ov5-field">
                <span class="field-title">活动类型</span>
                <input name="type" class="ov5-input" value="${escapeHtml(selectedActivity.type || '待分类')}" placeholder="感知 / 判决 / 决策 / 行动 / 评估">
              </label>
            </div>

            <div class="ov5-field-group">
              <label class="ov5-field">
                <span class="field-title">前置输入数据 / 状态条件 (入)</span>
                <textarea name="input" rows="2" class="ov5-textarea" placeholder="例如：任务区参数、雷达原始回波、上游指示">${escapeHtml(selectedActivity.input || '')}</textarea>
              </label>
            </div>

            <div class="ov5-field-group">
              <label class="ov5-field">
                <span class="field-title">后置输出成果 / 指令载荷 (出)</span>
                <textarea name="output" rows="2" class="ov5-textarea" placeholder="例如：交战授权诸元、火控指示包、毁伤评估结论">${escapeHtml(selectedActivity.output || '')}</textarea>
              </label>
            </div>

            <div class="ov5-field-group">
              <label class="ov5-field">
                <span class="field-title">体系抗毁降级备用机制 (自愈韧性)</span>
                <textarea name="resilienceFallback" rows="2" class="ov5-textarea" placeholder="例如：天基受扰时降级转高空无人机微波自组网接替">${escapeHtml(selectedActivity.resilienceFallback || '')}</textarea>
              </label>
            </div>

            <div class="ov5-field-group">
              <label class="ov5-field">
                <span class="field-title">上层父活动</span>
                <select name="parentId" class="ov5-select">
                  <option value="">无（顶层活动）</option>
                  ${parentOptions}
                </select>
              </label>
            </div>

            <div class="ov5-field-group">
              <label class="ov5-field">
                <span class="field-title">活动交战说明</span>
                <textarea name="text" rows="2" class="ov5-textarea">${escapeHtml(selectedActivity.text || '')}</textarea>
              </label>
            </div>

            <input type="hidden" name="duration" value="${escapeHtml(selectedActivity.duration || selectedActivity.timingWindow || '待估算')}">
            <input type="hidden" name="resources" value="${escapeHtml(selectedActivity.resources || '')}">
            <input type="hidden" name="preconditions" value="${escapeHtml(selectedActivity.preconditions || '')}">
            <input type="hidden" name="constraints" value="${escapeHtml(selectedActivity.constraints || '')}">
            <input type="hidden" name="refs" value="${escapeHtml((selectedActivity.refs || []).join('、'))}">

            <div class="ov5-editor-actions">
              <button type="submit" class="ov5-save-btn">💾 保存修改</button>
              <button type="button" class="quiet-button danger compact-btn" data-inspector-action="delete-activity" title="删除该活动">🗑️ 删除</button>
            </div>
          </form>

          <div class="ov5-edge-creation-card">
            <div class="edge-card-title">
              <span>🔗 建立输出到下游因果流</span>
            </div>
            <form class="edge-editor ov5-edge-form" id="ov5EdgeForm">
              <input type="hidden" name="sourceId" value="${escapeHtml(selectedActivity.id)}">
              <select name="targetId" class="ov5-select" ${candidateTargets.length ? "" : "disabled"}>
                <option value="">选择下游驱动的目标活动...</option>
                ${candidateTargets.map((c) => `<option value="${escapeHtml(c.id)}">→ ${escapeHtml(c.title)} (${escapeHtml(c.domain || '综合')})</option>`).join("")}
              </select>
              <select name="type" class="ov5-select">
                <option value="信息流">信息流 (态势/数据)</option>
                <option value="控制流">控制流 (指令/授权)</option>
                <option value="资源流">资源流 (兵力/载荷)</option>
              </select>
              <input name="payload" class="ov5-input" placeholder="交换载荷（例如：火控引导包）">
              <input name="condition" class="ov5-input" placeholder="触发条件（例如：捕获连续航迹后）">
              <button type="submit" class="ov5-btn-edge" ${candidateTargets.length ? "" : "disabled"}>+ 建立关联</button>
            </form>
          </div>
        </div>
      </aside>
    `;
  }

  // Tree Mode
  return `
    <aside class="ov5-tree-panel is-tree-panel" aria-label="活动结构分解">
      <div class="panel-heading">
        <div class="panel-heading-title-wrap">
          <h3>活动架构树 (OV-5a)</h3>
          <small>${hierarchy.totalCount} 项活动 · ${hierarchy.rootCount} 顶层</small>
        </div>
        ${selectedActivity ? `<button type="button" class="quiet-button compact-btn" data-action="toggle-ov5-left-mode" title="返回编辑选中的活动">✏️ 编辑选中</button>` : ""}
      </div>
      <div class="ov5-tree-tip-banner">
        <span>💡 选定任意活动卡片或点击 <b>[✏️ 编辑]</b>，即可在此面板中<strong>绑定装备主体、作战域与数据契约</strong>。</span>
      </div>
      <div class="ov5-tree-list">
        ${renderHierarchyTree(hierarchy.roots, selectedId)}
      </div>
      <button type="button" class="quiet-button" data-action="add-activity">+ 新增顶层活动</button>
    </aside>
  `;
}

function renderActivePerspective({ viewMode, model, activities, edges, activityById, oodaHealth, state, stressedNodeId }) {
  if (viewMode === "sync-matrix") {
    return renderSyncMatrixView({ activities, state, activityById, edges });
  }
  if (viewMode === "autonomy") {
    return renderAutonomyLadderView({ activities, state, activityById });
  }
  if (viewMode === "resilience") {
    return renderResilienceView({ activities, edges, state, stressedNodeId, activityById });
  }
  if (viewMode === "argument-chain") {
    return renderArgumentChainPerspective({ activities, state, model, activityById });
  }
  // Default: kill-web
  return renderKillWebView({ activities, edges, activityById, oodaHealth, state });
}

/**
 * 视角 1：杀伤网与 OODA 闭环因果流视（深度因果链路流转追踪）
 */
function renderKillWebView({ activities, edges, activityById, oodaHealth, state }) {
  const selectedId = state.selection?.id;

  // 上下游因果邻接追踪
  const upstreamMap = new Map();
  const downstreamMap = new Map();
  edges.forEach((edge) => {
    if (!upstreamMap.has(edge.targetId)) upstreamMap.set(edge.targetId, []);
    upstreamMap.get(edge.targetId).push(edge.sourceId);

    if (!downstreamMap.has(edge.sourceId)) downstreamMap.set(edge.sourceId, []);
    downstreamMap.get(edge.sourceId).push(edge.targetId);
  });

  const selectedUpstream = new Set(selectedId ? upstreamMap.get(selectedId) || [] : []);
  const selectedDownstream = new Set(selectedId ? downstreamMap.get(selectedId) || [] : []);

  const lanes = [
    { id: "observe", title: "Observe 观测感知", tone: "tone-blue", items: oodaHealth.categorized?.observe || [] },
    { id: "orient", title: "Orient 判决融合", tone: "tone-green", items: oodaHealth.categorized?.orient || [] },
    { id: "decide", title: "Decide 协同决策", tone: "tone-gold", items: oodaHealth.categorized?.decide || [] },
    { id: "act", title: "Act 突击控制", tone: "tone-red", items: oodaHealth.categorized?.act || [] },
    { id: "feedback", title: "Feedback 战果反哺", tone: "tone-purple", items: oodaHealth.categorized?.feedback || [] }
  ];

  return `
    <div class="kill-web-workspace">
      ${selectedId ? `
        <div class="kw-trace-banner">
          <div class="kw-trace-left">
            <span class="trace-icon">🎯</span>
            <span>聚焦链路追踪: <strong>${escapeHtml(activityById.get(selectedId)?.title || "选中活动")}</strong></span>
          </div>
          <div class="kw-trace-counts">
            <span class="trace-pill in">↑ 直接前驱: ${selectedUpstream.size} 项</span>
            <span class="trace-pill out">↓ 直接驱动: ${selectedDownstream.size} 项</span>
          </div>
        </div>
      ` : ""}
      <div class="kill-web-lanes">
        ${lanes.map((lane) => `
          <div class="kill-web-lane ${lane.tone}">
            <div class="lane-header">
              <strong>${lane.title}</strong>
              <small>${lane.items.length} 个节点</small>
            </div>
            <div class="lane-cards">
              ${lane.items.map((act) => renderActivityCard(act, selectedId, edges, selectedUpstream, selectedDownstream, upstreamMap, downstreamMap)).join("") || `<div class="lane-empty"><p>本域暂无活动节点</p><button type="button" class="quiet-button compact" data-action="add-activity" data-domain="${escapeHtml(lane.id || "")}">+ 新增活动</button></div>`}
            </div>
          </div>
        `).join("")}
      </div>

      <div class="kill-web-footer">
        <span class="kw-legend"><i class="badge-tag hitl">HITL</i> 人在回路决策</span>
        <span class="kw-legend"><i class="badge-tag hotl">HOTL</i> 智能编组自主</span>
        <span class="kw-legend"><i class="badge-tag hootl">HOOTL</i> 边缘全自主</span>
        <span class="kw-legend"><b style="color: #c084fc">↺</b> 反哺回传至源头感知</span>
        <span class="kw-legend"><span style="color:#38bdf8">↑ 来源</span> / <span style="color:#22c55e">↓ 驱动目标</span></span>
      </div>
    </div>
  `;
}

/**
 * 视角 2：跨域协同同步矩阵视 (Synchronization Matrix)
 * 深度联动 Step 2: Phase & Action 自定义阶段与跨域交接
 */
function renderSyncMatrixView({ activities, state }) {
  const domains = ["太空", "空中", "水面", "电磁", "综合"];

  // 深度读取 Step 2 自定义作战阶段
  const rawPhases = Array.isArray(state.phaseAction?.phases) ? state.phaseAction.phases : [];
  const isCustomLinked = rawPhases.length >= 2;
  const projectPhases = isCustomLinked
    ? rawPhases.map((p, idx) => ({
        id: p.id || `phase-${idx + 1}`,
        title: p.name || `阶段 ${idx + 1}`,
        timeWindow: p.timeWindow || ""
      }))
    : [
        { id: "p1", title: "阶段一: 预警截获", timeWindow: "T+00~T+15" },
        { id: "p2", title: "阶段二: 压制渗透", timeWindow: "T+15~T+30" },
        { id: "p3", title: "阶段三: 饱和突击", timeWindow: "T+30~T+45" },
        { id: "p4", title: "阶段四: 战果回收", timeWindow: "T+45~T+60" }
      ];

  const activitiesByDomain = new Map(domains.map((d) => [d, []]));
  activities.forEach((act) => {
    const domain = domains.includes(act.domain) ? act.domain : "综合";
    activitiesByDomain.get(domain)?.push(act);
  });

  const colTemplate = `120px repeat(${projectPhases.length}, minmax(140px, 1fr))`;

  return `
    <div class="sync-matrix-workspace">
      <div class="sync-matrix-top-bar">
        <span class="sync-matrix-badge ${isCustomLinked ? "linked" : ""}">
          ${isCustomLinked ? `🔗 已深度联动 Step 2 自定义作战阶段 (${projectPhases.length} 个阶段)` : "💡 正在使用通用阶段模版（确认 Step 2 阶段与行动后将自动同步）"}
        </span>
        <small class="sync-matrix-sub">识别各作战域、各参战力量在各阶段的时序交接与协同窗口</small>
      </div>

      <div class="sync-matrix-grid" style="grid-template-columns: ${colTemplate};">
        <div class="matrix-cell header-corner">作战域 / 阶段进程</div>
        ${projectPhases.map((p) => `
          <div class="matrix-cell phase-header">
            <strong>${escapeHtml(p.title)}</strong>
            ${p.timeWindow ? `<span class="phase-window-badge">${escapeHtml(p.timeWindow)}</span>` : ""}
          </div>
        `).join("")}

        ${domains.map((domain) => {
          const domainActs = activitiesByDomain.get(domain) || [];
          return `
            <div class="matrix-cell domain-label">
              <strong>${domain}域</strong>
              <small>${domainActs.length} 项动作</small>
            </div>
            ${projectPhases.map((phase, pIndex) => {
              // 优先匹配 phaseId，其次按活动类型分布
              const matchedActs = domainActs.filter((act, idx) => {
                if (act.phaseId) return act.phaseId === phase.id;
                const t = String(act.type || "");
                if (t.includes("感知") || t.includes("侦察")) return pIndex === 0;
                if (t.includes("决策") || t.includes("控制")) return pIndex === 1 || pIndex === Math.min(2, projectPhases.length - 1);
                if (t.includes("评估") || t.includes("反哺")) return pIndex === projectPhases.length - 1;
                return (idx % projectPhases.length) === pIndex;
              });
              return `
                <div class="matrix-cell matrix-dropzone">
                  ${matchedActs.map((act) => `
                    <div class="sync-card ${state.selection?.id === act.id ? "selected" : ""}" data-activity="${escapeHtml(act.id)}">
                      <div class="sync-card-top">
                        <div class="sync-card-title">${escapeHtml(act.title)}</div>
                        <button type="button" class="sync-inline-edit-btn" data-action="edit-activity" data-activity-id="${escapeHtml(act.id)}" data-activity="${escapeHtml(act.id)}" data-stop-click-propagation="true" title="编辑活动与主体绑定">✏️</button>
                      </div>
                      <div class="sync-card-meta">
                        <span class="${act.performer ? 'assigned' : 'unassigned'}" data-action="edit-activity" data-activity-id="${escapeHtml(act.id)}" data-activity="${escapeHtml(act.id)}" data-stop-click-propagation="true" title="点击绑定或修改执行主体">${escapeHtml(act.performer || act.resources || "+绑定主体")}</span>
                        <span class="pill-time">${escapeHtml(act.timingWindow || act.duration || "15m")}</span>
                      </div>
                    </div>
                  `).join("")}
                </div>
              `;
            }).join("")}
          `;
        }).join("")}
      </div>
      <div class="sync-matrix-tip">💡 同步矩阵直观展示不同军兵种平台在各作战阶段的交接点与协同窗口，识别跨域脱节风险。</div>
    </div>
  `;
}

/**
 * 视角 3：人机决策与自主阶梯视 (C2 & Autonomy Ladder)
 * 依据 DoD 3000.09 与交战规则 (ROE) 进行层级划分与军事伦理合规审查
 */
function renderAutonomyLadderView({ activities, state }) {
  const hitlActivities = activities.filter((a) => String(a.autonomy).toUpperCase() === "HITL");
  const hotlActivities = activities.filter((a) => !a.autonomy || String(a.autonomy).toUpperCase() === "HOTL");
  const hootlActivities = activities.filter((a) => String(a.autonomy).toUpperCase() === "HOOTL");

  // 伦理合规审查（Ethics Guard）：致命打击类活动若配置为 HOOTL，存在法律与指挥失控风险
  const lethalViolations = hootlActivities.filter((a) => {
    const t = String(a.type || "");
    const title = String(a.title || "");
    return t.includes("行动") || t.includes("控制") || title.includes("打击") || title.includes("突击") || title.includes("摧毁") || title.includes("压制") || title.includes("发射");
  });

  return `
    <div class="autonomy-ladder-workspace">
      ${lethalViolations.length ? `
        <div class="autonomy-ethics-alert">
          <div class="alert-icon">⚠️</div>
          <div class="alert-content">
            <strong>军事伦理与交战规则 (ROE) 审查预警</strong>
            <p>检测到 ${lethalViolations.length} 项致命打击或武器使用活动被配置为完全自主回路 (HOOTL)：「${lethalViolations.map((v) => v.title).join("、")}」。依据武器系统自主性指导原则，致命武力授权建议严格保留人类指挥官 (HITL) 决策门禁！</p>
          </div>
        </div>
      ` : `
        <div class="autonomy-ethics-clean">
          <span>🛡️ 军事伦理与交战授权核准：致命打击活动均已配置人类指挥授权门禁，合规状态良好。</span>
        </div>
      `}

      <div class="autonomy-level-block hitl-block">
        <div class="level-intro">
          <div class="level-badge hitl">人在回路 (HITL - Human-in-the-Loop) · ${hitlActivities.length} 项</div>
          <h4>指挥决策与高权责授权层</h4>
          <p>涉及交战规则核准、目标确认、致命武力授权及重大战术转向。必须保留人类指挥官直接决策门禁。</p>
        </div>
        <div class="level-cards">
          ${hitlActivities.map((act) => renderLadderCard(act, state.selection?.id, false)).join("") || `<p class="empty-tip">未配置人在回路活动</p>`}
        </div>
      </div>

      <div class="autonomy-level-block hotl-block">
        <div class="level-intro">
          <div class="level-badge hotl">人上回路 (HOTL - Human-on-the-Loop) · ${hotlActivities.length} 项</div>
          <h4>智能协同与动态编组监控层</h4>
          <p>算法与编组系统自主进行传感器扫描、航线自适应规划、数据分发与协同计算，人类指挥员保持情势感知并具备超驰否决权。</p>
        </div>
        <div class="level-cards">
          ${hotlActivities.map((act) => renderLadderCard(act, state.selection?.id, false)).join("") || `<p class="empty-tip">未配置人上回路活动</p>`}
        </div>
      </div>

      <div class="autonomy-level-block hootl-block">
        <div class="level-intro">
          <div class="level-badge hootl">全自主回路 (HOOTL - Human-out-of-the-Loop) · ${hootlActivities.length} 项</div>
          <h4>边缘自适应防御与微秒级响应层</h4>
          <p>适用于超视距电磁自适应对消、蜂群防撞避障、点防御硬杀伤等人类生理反应无法介入的高速闭环。</p>
        </div>
        <div class="level-cards">
          ${hootlActivities.map((act) => renderLadderCard(act, state.selection?.id, lethalViolations.some((v) => v.id === act.id))).join("") || `<p class="empty-tip">暂无微秒级全自主活动。可在活动检查器中将自主等级配置为 HOOTL。</p>`}
        </div>
      </div>
    </div>
  `;
}

/**
 * 视角 4：体系抗毁与降级推演视 (Resilience & Stress-Testing)
 * 预设战损场景注入与动态韧性指标评估
 */
function renderResilienceView({ activities, edges, state, stressedNodeId, activityById }) {
  const stressedNode = stressedNodeId ? activityById.get(stressedNodeId) : null;

  // 计算受影响的下游活动
  const impactedNodeIds = new Set();
  if (stressedNodeId) {
    const queue = [stressedNodeId];
    while (queue.length) {
      const curr = queue.shift();
      edges.filter((e) => e.sourceId === curr).forEach((e) => {
        if (!impactedNodeIds.has(e.targetId)) {
          impactedNodeIds.add(e.targetId);
          queue.push(e.targetId);
        }
      });
    }
  }

  // 计算体系抗毁指标 (Resilience Metrics)
  const totalActivities = activities.length || 1;
  const impactedCount = impactedNodeIds.size;
  const recoveredCount = activities.filter((a) => impactedNodeIds.has(a.id) && a.resilienceFallback).length;
  const brokenCount = impactedCount - recoveredCount;
  const resilienceScore = stressedNodeId
    ? Math.max(20, Math.round(100 - (brokenCount * 25) - (impactedCount * 6)))
    : 100;
  const resilienceGrade = resilienceScore >= 80 ? "良好 (Resilient)" : resilienceScore >= 50 ? "局部降级自愈中 (Degraded)" : "致命断链 (Fragile)";
  const gradeClass = resilienceScore >= 80 ? "good" : resilienceScore >= 50 ? "warn" : "danger";

  return `
    <div class="resilience-workspace">
      <div class="stress-banner">
        <div class="stress-banner-left">
          <strong>⚔️ 体系抗毁推演工作区（韧性自愈评估）</strong>
          <p>模拟强电磁压制或战损扰动，检验杀伤网自适应重组与降级旁路接替能力。</p>
        </div>
        <div class="stress-banner-actions">
          <span class="preset-label">预设战损场景:</span>
          <button type="button" class="quiet-button preset-btn" data-action="preset-stress-domain" data-domain="太空" title="模拟天基星座卫星遭反导摧毁或强干扰">天基全盲</button>
          <button type="button" class="quiet-button preset-btn" data-action="preset-stress-domain" data-domain="电磁" title="模拟全频段高功率电磁压制">电磁强压制</button>
          <button type="button" class="quiet-button preset-btn" data-action="preset-stress-type" data-type="决策" title="模拟战区指挥所战损">指挥所瘫痪</button>
          ${stressedNodeId ? `<button type="button" class="quiet-button stress-reset-btn" data-action="clear-ov5-stress">恢复常态推演</button>` : ""}
        </div>
      </div>

      <!-- 动态韧性指标仪 (Resilience Health Meter) -->
      <div class="resilience-meter-strip ${gradeClass}">
        <div class="meter-stat">
          <small>抗毁韧性评级</small>
          <strong>${resilienceGrade} (${resilienceScore}分)</strong>
        </div>
        <div class="meter-stat">
          <small>扰动战损源</small>
          <strong>${stressedNode ? escapeHtml(stressedNode.title) : "无（常态网络）"}</strong>
        </div>
        <div class="meter-stat">
          <small>级联波及活动</small>
          <strong>${impactedCount} 项</strong>
        </div>
        <div class="meter-stat">
          <small>旁路自愈接替</small>
          <strong style="color: #38bdf8">${recoveredCount} 项已接替</strong>
        </div>
        <div class="meter-stat">
          <small>致命断链风险</small>
          <strong style="color: ${brokenCount > 0 ? '#f43f5e' : '#10b981'}">${brokenCount} 项无备用</strong>
        </div>
      </div>

      ${stressedNode ? `
        <div class="stress-alert-active">
          <strong>💥 正在对「${escapeHtml(stressedNode.title)}」注入对抗扰动</strong>
          <span>导致下游 ${impactedNodeIds.size} 项作战活动面临断链风险</span>
        </div>
      ` : ""}

      <div class="resilience-node-grid">
        ${activities.map((act) => {
          const isStressed = act.id === stressedNodeId;
          const isImpacted = impactedNodeIds.has(act.id);
          const hasFallback = Boolean(act.resilienceFallback);

          return `
            <div class="resilience-card ${isStressed ? "is-stressed" : ""} ${isImpacted ? "is-impacted" : ""} ${state.selection?.id === act.id ? "selected" : ""}" data-activity="${escapeHtml(act.id)}">
              <div class="resilience-head">
                <span class="domain-tag">${escapeHtml(act.domain || "综合")}</span>
                <div class="resilience-head-actions">
                  <button type="button" class="card-inline-edit-btn" data-action="edit-activity" data-activity-id="${escapeHtml(act.id)}" data-activity="${escapeHtml(act.id)}" data-stop-click-propagation="true" title="编辑该活动的主体平台与契约">✏️ 编辑</button>
                  <button type="button" class="stress-toggle-btn ${isStressed ? "stressed" : ""}" data-action="toggle-ov5-stress" data-node="${escapeHtml(act.id)}" data-stop-click-propagation="true" title="注入战损模拟">
                    ${isStressed ? "💥 战损中" : "⚡ 注入扰动"}
                  </button>
                </div>
              </div>
              <strong class="resilience-title">${escapeHtml(act.title)}</strong>
              <div class="resilience-performer ${act.performer ? 'assigned' : 'unassigned'}" data-action="edit-activity" data-activity-id="${escapeHtml(act.id)}" data-activity="${escapeHtml(act.id)}" data-stop-click-propagation="true" title="点击绑定或修改执行主体">主体: <strong>${escapeHtml(act.performer || act.resources || "待分配 (+绑定)")}</strong></div>

              ${isImpacted ? `
                <div class="impact-status-bar ${hasFallback ? "recovered" : "broken"}">
                  ${hasFallback ? `🛡️ 降级旁路生效: ${escapeHtml(act.resilienceFallback)}` : "❌ 发生致命断链：无备用旁路！"}
                </div>
              ` : `
                <div class="fallback-preview">
                  ${hasFallback ? `备用机制: ${escapeHtml(act.resilienceFallback)}` : `<span class="no-fallback-warning">⚠️ 缺少抗毁备用机制</span>`}
                </div>
              `}
            </div>
          `;
        }).join("")}
      </div>

      <div class="resilience-footer">
        <button type="button" class="quiet-button" data-action="auto-fill-fallbacks">AI 一键补全所有活动抗毁备用机制</button>
      </div>
    </div>
  `;
}

export function renderActivityCard(act, selectedId, edges, selectedUpstream = new Set(), selectedDownstream = new Set(), upstreamMap = new Map(), downstreamMap = new Map()) {
  const isSelected = act.id === selectedId;
  const isUpstream = selectedUpstream.has(act.id);
  const isDownstream = selectedDownstream.has(act.id);
  const hasFeedbackOut = edges.some((e) => e.sourceId === act.id && e.isFeedback);
  const hasFeedbackIn = edges.some((e) => e.targetId === act.id && e.isFeedback);
  const autonomy = String(act.autonomy || "HOTL").toUpperCase();
  const inCount = (upstreamMap.get(act.id) || []).length;
  const outCount = (downstreamMap.get(act.id) || []).length;
  const effectiveOrigin = act.origin || ((act.citations?.length || act.evidenceRefs?.length) ? "cited" : "ai-inferred");
  const originBadge = renderOriginBadge(effectiveOrigin, act.citations);

  return `
    <div class="kw-activity-card ${isSelected ? "selected" : ""} ${isUpstream ? "is-upstream" : ""} ${isDownstream ? "is-downstream" : ""} ${hasFeedbackOut ? "has-feedback-out" : ""}" data-activity="${escapeHtml(act.id)}">
      <div class="card-topline">
        <span class="domain-badge">${escapeHtml(act.domain || "综合")}</span>
        ${originBadge}
        ${act.simulationOutcome?.hasDeviation ? `<span class="status-tag review" style="font-size:10px; padding:1px 4px;" title="检出推演执行偏差 ${act.simulationOutcome.deviationCount} 项">⚠️ 推演偏差</span>` : ""}
        <span class="autonomy-pill ${autonomy.toLowerCase()}">${autonomy}</span>
        <span class="io-flow-pill" title="上游来源 ${inCount} 项，下游驱动 ${outCount} 项">↑${inCount} ↓${outCount}</span>
        ${act.timingWindow ? `<span class="timing-badge">${escapeHtml(act.timingWindow)}</span>` : ""}
        ${(act.citations?.length || act.evidenceRefs?.length || act.refs?.length) ? `<span class="citation-badge" title="已关联知识依据：${escapeHtml((act.citations || []).map((c) => c.title || c.chunkId).filter(Boolean).join("、") || (act.refs || []).join("、"))}">📖 ${(act.citations?.length || act.evidenceRefs?.length || act.refs?.length)}</span>` : ""}
        <button type="button" class="card-inline-edit-btn" data-action="edit-activity" data-activity-id="${escapeHtml(act.id)}" data-activity="${escapeHtml(act.id)}" data-stop-click-propagation="true" title="编辑该活动的执行主体、作战域与契约">✏️ 编辑</button>
      </div>
      <strong class="card-title">${escapeHtml(act.title)}</strong>
      ${act.performer ? `
        <small class="card-performer assigned" data-action="edit-activity" data-activity-id="${escapeHtml(act.id)}" data-activity="${escapeHtml(act.id)}" data-stop-click-propagation="true" title="点击修改执行主体">主体: <strong>${escapeHtml(act.performer)}</strong></small>
      ` : `
        <small class="card-performer unassigned" data-action="edit-activity" data-activity-id="${escapeHtml(act.id)}" data-activity="${escapeHtml(act.id)}" data-stop-click-propagation="true" title="点击绑定执行兵力与装备平台">+ 绑定执行主体</small>
      `}
      <div class="card-io">
        <span title="输入: ${escapeHtml(act.input)}">入: ${escapeHtml(act.input || "无")}</span>
        <span title="输出: ${escapeHtml(act.output)}">出: ${escapeHtml(act.output || "无")}</span>
      </div>
      ${isUpstream ? `<div class="trace-badge upstream">↑ 聚焦活动之上游来源</div>` : ""}
      ${isDownstream ? `<div class="trace-badge downstream">↓ 聚焦活动之下游驱动</div>` : ""}
      ${hasFeedbackOut ? `<div class="feedback-badge out">↺ 闭环反哺输出</div>` : ""}
      ${hasFeedbackIn ? `<div class="feedback-badge in">↺ 接收态势更新</div>` : ""}
    </div>
  `;
}

function renderLadderCard(act, selectedId, isViolation = false) {
  const isSelected = act.id === selectedId;
  const currentLevel = String(act.autonomy || "HOTL").toUpperCase();
  return `
    <div class="ladder-card ${isSelected ? "selected" : ""} ${isViolation ? "is-violation" : ""}" data-activity="${escapeHtml(act.id)}">
      ${isViolation ? `<div class="violation-badge">⚠️ 伦理审查警示：建议提升为 HITL</div>` : ""}
      <div class="ladder-card-header">
        <span class="domain-badge">${escapeHtml(act.domain || "综合")}</span>
        <strong>${escapeHtml(act.title)}</strong>
        <button type="button" class="card-inline-edit-btn" data-action="edit-activity" data-activity-id="${escapeHtml(act.id)}" data-activity="${escapeHtml(act.id)}" data-stop-click-propagation="true" title="编辑活动属性与主体绑定">✏️ 编辑</button>
      </div>
      <p class="ladder-card-desc">${escapeHtml(act.text)}</p>
      <div class="ladder-card-footer">
        <span class="${act.performer ? 'assigned-performer' : 'unassigned-performer'}" data-action="edit-activity" data-activity-id="${escapeHtml(act.id)}" data-activity="${escapeHtml(act.id)}" data-stop-click-propagation="true" title="点击绑定或修改执行主体">主体: <strong>${escapeHtml(act.performer || act.resources || "待分配 (+绑定)")}</strong></span>
        <span class="time">${escapeHtml(act.timingWindow || act.duration || "15m")}</span>
      </div>
      <div class="ladder-card-actions">
        <span class="autonomy-switch-label">分配自主权:</span>
        <button type="button" class="autonomy-switch-btn ${currentLevel === "HITL" ? "active hitl" : ""}" data-action="change-activity-autonomy" data-activity="${escapeHtml(act.id)}" data-level="HITL" data-stop-click-propagation="true" title="设置为人在回路决策">HITL</button>
        <button type="button" class="autonomy-switch-btn ${currentLevel === "HOTL" ? "active hotl" : ""}" data-action="change-activity-autonomy" data-activity="${escapeHtml(act.id)}" data-level="HOTL" data-stop-click-propagation="true" title="设置为人上回路协同">HOTL</button>
        <button type="button" class="autonomy-switch-btn ${currentLevel === "HOOTL" ? "active hootl" : ""}" data-action="change-activity-autonomy" data-activity="${escapeHtml(act.id)}" data-level="HOOTL" data-stop-click-propagation="true" title="设置为边缘全自主">HOOTL</button>
      </div>
    </div>
  `;
}
function renderHierarchyTree(nodes, selectedId, isChild = false) {
  if (!Array.isArray(nodes) || !nodes.length) return "";
  return nodes.map((node) => {
    const isSelected = node.id === selectedId;
    return `
      <div class="ov5-tree-node-wrap">
        <button type="button" class="ov5-tree-item ${isSelected ? "selected" : ""} ${isChild ? "is-child" : ""}" data-activity="${escapeHtml(node.id)}" title="${escapeHtml(node.text || node.title)}">
          <div class="ov5-tree-header">
            <strong>${escapeHtml(node.title)}</strong>
            <span class="ov5-tree-badge">${escapeHtml(node.type || "活动")}</span>
          </div>
          <div class="ov5-tree-tags">
            <span class="tree-sub-tag">${escapeHtml(node.domain || "综合")}</span>
            <span class="tree-sub-tag">${escapeHtml(node.autonomy || "HOTL")}</span>
          </div>
          ${node.sourceTaskId ? `<span class="ov5-tree-meta">任务: ${escapeHtml(node.sourceTaskId)}</span>` : ""}
        </button>
        ${node.children?.length ? `
          <div class="ov5-tree-children">
            ${renderHierarchyTree(node.children, selectedId, true)}
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

function formatPhaseActivities(activities = []) {
  if (!activities.length) return `<span class="phase-empty">无直接对应活动</span>`;
  return activities.slice(0, 4).map((a) => `<span class="phase-chip" title="${escapeHtml(a.title)}">${escapeHtml(a.title)}</span>`).join("")
    + (activities.length > 4 ? `<span class="phase-chip more">+${activities.length - 4}</span>` : "");
}

/**
 * 视角 5：制胜论证链与关键假设排查 (M7-T7.1)
 */
function renderArgumentChainPerspective({ activities, state, model, activityById }) {
  const chain = normalizeArgumentChain(model?.argumentChain, state?.brief || {});
  const sortedAssumptions = getSortedAssumptions(chain);
  const impacts = evaluateAssumptionImpact(chain, model, state?.forceMission, state?.phaseAction);
  const caseQuery = state?.tacticalCaseSearchQuery || "";
  const displayedCases = searchTacticalCases(caseQuery, {
    customCases: state?.tacticalCases || [],
    knowledgeDocs: state?.knowledge || []
  });

  return `
    <div class="ov5-argument-chain-perspective" style="padding:16px; background:#fff; border-radius:8px; border:1px solid #e2e8f0;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; border-bottom:1px solid #f1f5f9; padding-bottom:12px;">
        <div>
          <h3 style="margin:0 0 4px 0; font-size:16px; color:#0f172a; display:flex; align-items:center; gap:8px;">
            <span>🎯 制胜机理论证链与关键假设清单</span>
            <span class="mini-tag" style="background:#e0f2fe; color:#0369a1; font-size:11px;">M7-T7.1 战法机理</span>
          </h3>
          <p style="margin:0; font-size:12px; color:#64748b;">
            明确战法“为什么能赢”的因果主张与推演逻辑；梳理核心假设并按置信度排序，闭环评估假设被推翻时的级联失效波及。
          </p>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" class="quiet-button compact-btn" data-action="save-to-tactics-library" title="将当前战法核心思想与论证链存入跨项目战法复用库">💾 存入战法库</button>
          <button type="button" class="quiet-button compact-btn" data-action="open-tactics-library" title="浏览跨项目战法库">📚 战法库</button>
          <button type="button" class="quiet-button compact-btn" data-action="add-chain-assumption">+ 新增关键假设</button>
        </div>
      </div>

      <!-- 核心主张与推演机理 -->
      <form class="argument-chain-form" id="argumentChainForm" style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:12px;">
          <label style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:6px;">
            🏆 核心主张 (Claim: 为什么能赢)
          </label>
          <textarea name="claim" rows="3" style="width:100%; box-sizing:border-box; font-size:12px; border:1px solid #cbd5e1; border-radius:4px; padding:6px 8px;" placeholder="阐明本战法达成制胜优势的核心逻辑主张...">${escapeHtml(chain.claim)}</textarea>
        </div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:12px;">
          <label style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:6px;">
            ⛓️ 机理推演 (Reasoning: 因果驱动机制)
          </label>
          <textarea name="reasoning" rows="3" style="width:100%; box-sizing:border-box; font-size:12px; border:1px solid #cbd5e1; border-radius:4px; padding:6px 8px;" placeholder="阐明从初始态势到制胜终态的因果链路...">${escapeHtml(chain.reasoning)}</textarea>
        </div>
        <div style="grid-column:1 / -1; display:flex; justify-content:flex-end;">
          <button type="button" class="quiet-button compact-btn" data-action="save-argument-chain">保存主张与推演</button>
        </div>
      </form>

      <!-- 支撑证据引用 -->
      ${chain.evidenceRefs?.length ? `
        <div style="margin-bottom:20px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:10px 12px;">
          <strong style="font-size:12px; color:#166534; display:block; margin-bottom:6px;">📖 支撑证据引用与规则依据 (${chain.evidenceRefs.length} 条)</strong>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${chain.evidenceRefs.map((ref) => `
              <span class="mini-tag" style="background:#dcfce7; color:#15803d; font-size:11px;" title="${escapeHtml(ref.snippet)}">
                📄 ${escapeHtml(ref.title || ref.filePath || ref.chunkId)}
              </span>
            `).join("")}
          </div>
        </div>
      ` : ""}

      <!-- 历史相似战例借鉴与比对 (T7.3) -->
      <section class="tactical-cases-panel" style="margin-bottom:20px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <div>
            <h4 style="margin:0 0 2px 0; font-size:14px; color:#1e293b; display:flex; align-items:center; gap:6px;">
              <span>📚 历史相似战例借鉴与比对 (可借鉴点 / 时代不适用局限)</span>
              <span class="mini-tag" style="background:#fef3c7; color:#92400e; font-size:11px;">M7-T7.3 战例借鉴</span>
            </h4>
            <small style="color:#64748b;">检索历史相似战例，提炼对抗机制可借鉴点与时代局限，一键引用至论证链支撑证据。</small>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <input type="search" id="tacticalCaseSearchInput" value="${escapeHtml(caseQuery)}" placeholder="输入作战问题检索战例（如：突防、电磁、防空）..." style="font-size:11.5px; padding:3px 8px; border:1px solid #cbd5e1; border-radius:4px; width:220px;" />
            <button type="button" class="quiet-button compact-btn" data-action="search-tactical-cases">🔍 匹配战例</button>
          </div>
        </div>

        <div class="tactical-cases-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          ${displayedCases.map((c) => {
            const isCited = (chain.evidenceRefs || []).some((r) => r.chunkId === `case-${c.id}` || r.title?.includes(c.caseName));
            return `
              <div class="tactical-case-card" style="border:1px solid ${isCited ? "#86efac" : "#cbd5e1"}; background:${isCited ? "#f0fdf4" : "#ffffff"}; border-radius:6px; padding:12px; display:flex; flex-direction:column; gap:8px;" data-case-id="${escapeHtml(c.id)}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    <strong style="font-size:13px; color:#0f172a;">${escapeHtml(c.caseName)}</strong>
                    <span class="mini-tag" style="background:#e0f2fe; color:#0369a1; font-size:10px;">${escapeHtml(c.category)}</span>
                    <span class="mini-tag" style="font-size:10px;">${escapeHtml(c.confidence)}置信度</span>
                  </div>
                  ${isCited ? `<span class="mini-tag" style="background:#bbf7d0; color:#15803d; font-size:10px;">✓ 已引用至论证链</span>` : ""}
                </div>

                <p style="margin:0; font-size:11.5px; color:#475569; line-height:1.4;">
                  <strong>相似特征：</strong>${escapeHtml(c.similarityPoint)}
                </p>

                <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:4px; padding:6px 8px;">
                  <strong style="font-size:11px; color:#166534; display:block; margin-bottom:2px;">💡 机制可借鉴点：</strong>
                  <ul style="margin:0; padding-left:14px; font-size:11px; color:#15803d; line-height:1.4;">
                    ${(c.applicableLessons || []).map((l) => `<li>${escapeHtml(l)}</li>`).join("")}
                  </ul>
                </div>

                <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:4px; padding:6px 8px;">
                  <strong style="font-size:11px; color:#9a3412; display:block; margin-bottom:2px;">⚠️ 时代局限与不适用点：</strong>
                  <ul style="margin:0; padding-left:14px; font-size:11px; color:#c2410c; line-height:1.4;">
                    ${(c.unapplicableLessons || []).map((l) => `<li>${escapeHtml(l)}</li>`).join("")}
                  </ul>
                </div>

                <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:auto; padding-top:4px;">
                  <button type="button" class="quiet-button compact-btn" data-action="apply-case-to-argument-chain" data-case-id="${escapeHtml(c.id)}" style="font-size:11px; ${isCited ? "color:#15803d; font-weight:700;" : "color:#0284c7;"}">
                    ${isCited ? "✓ 更新论证链引用" : "📌 引用至论证链支撑证据"}
                  </button>
                  ${c.id.startsWith("custom-case-") ? `
                    <button type="button" class="quiet-button compact-btn" data-action="delete-tactical-case" data-case-id="${escapeHtml(c.id)}" style="font-size:11px; color:#ef4444;">
                      删除
                    </button>
                  ` : ""}
                </div>
              </div>
            `;
          }).join("")}
        </div>

        <!-- 自定义战例录入折叠抽屉 -->
        <details class="custom-case-details" style="margin-top:12px; border-top:1px dashed #cbd5e1; padding-top:8px;">
          <summary class="quiet-button compact-btn" style="cursor:pointer; font-size:11.5px;">＋ 录入并分析自定义历史战例</summary>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px;">
            <input type="text" id="customCaseName" placeholder="战例名称（如：英德日德兰海战前哨战）" style="font-size:12px; padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px;" />
            <input type="text" id="customCaseSimilarity" placeholder="作战问题相似特征（如：主力接敌前的信息迷雾突破）" style="font-size:12px; padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px;" />
            <textarea id="customCaseApplicable" rows="2" placeholder="可借鉴点（每行一条或用分号隔开）" style="font-size:12px; padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px;"></textarea>
            <textarea id="customCaseUnapplicable" rows="2" placeholder="时代局限与不可盲目照搬点（每行一条或用分号隔开）" style="font-size:12px; padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px;"></textarea>
            <div style="grid-column:1 / -1; display:flex; justify-content:flex-end;">
              <button type="button" class="primary-btn compact-btn" data-action="add-custom-tactical-case" style="font-size:11.5px;">确认录入战例</button>
            </div>
          </div>
        </details>
      </section>
      <div style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h4 style="margin:0; font-size:14px; color:#1e293b; display:flex; align-items:center; gap:6px;">
            <span>📋 关键假设清单 (按风险置信度排序)</span>
            <span class="mini-tag" style="font-size:11px;">低置信度假设置顶警示</span>
          </h4>
        </div>

        <div class="chain-assumptions-list" style="display:flex; flex-direction:column; gap:10px;">
          ${sortedAssumptions.map((asm, index) => {
            const isLow = asm.confidence === "低";
            const isMed = asm.confidence === "中";
            const borderCol = isLow ? "#fca5a5" : isMed ? "#fde68a" : "#bbf7d0";
            const bgCol = isLow ? "#fef2f2" : isMed ? "#fffbeb" : "#f0fdf4";
            const badgeCol = isLow ? "#dc2626" : isMed ? "#d97706" : "#16a34a";

            return `
              <div class="assumption-row-card" style="border:1px solid ${borderCol}; background:${bgCol}; border-radius:6px; padding:12px;" data-assumption-id="${escapeHtml(asm.id)}">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-weight:700; font-size:12px; color:#1e293b;">${escapeHtml(asm.id)}</span>
                    <span style="font-size:11px; padding:2px 8px; border-radius:10px; background:#fff; border:1px solid ${borderCol}; color:${badgeCol}; font-weight:700;">
                      ${isLow ? "🔴" : isMed ? "🟡" : "🟢"} ${escapeHtml(asm.confidence)}置信度
                    </span>
                    ${isLow ? `<span style="font-size:11px; color:#dc2626; font-weight:600;">⚠️ 重点质询排查对象</span>` : ""}
                  </div>
                  <div style="display:flex; gap:6px; align-items:center;">
                    <button type="button" class="quiet-button compact-btn" data-action="toggle-assumption-confidence" data-assumption-id="${escapeHtml(asm.id)}" style="font-size:11px;">
                      切换置信度: ${asm.confidence} ⟳
                    </button>
                    <button type="button" class="quiet-button compact-btn" data-action="remove-chain-assumption" data-assumption-id="${escapeHtml(asm.id)}" style="color:#ef4444; font-size:11px;">
                      删除
                    </button>
                  </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:8px;">
                  <div>
                    <label style="font-size:11px; color:#475569; font-weight:600; display:block; margin-bottom:2px;">假设内容：</label>
                    <input type="text" class="assumption-input-text" data-assumption-id="${escapeHtml(asm.id)}" data-field="text" value="${escapeHtml(asm.text)}" style="width:100%; box-sizing:border-box; font-size:12px; padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px; background:#fff;" />
                  </div>
                  <div>
                    <label style="font-size:11px; color:#475569; font-weight:600; display:block; margin-bottom:2px;">若失效之后果推论 (ifFalse)：</label>
                    <input type="text" class="assumption-input-text" data-assumption-id="${escapeHtml(asm.id)}" data-field="ifFalse" value="${escapeHtml(asm.ifFalse)}" style="width:100%; box-sizing:border-box; font-size:12px; padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px; background:#fff;" />
                  </div>
                </div>

                <div style="font-size:11px; color:#475569;">
                  <div style="font-weight:600; margin-bottom:4px; display:flex; justify-content:space-between;">
                    <span>🔗 依赖此假设的 OV-5 活动 (${asm.activityRefs?.length || 0} 项)：</span>
                  </div>
                  <div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center;">
                    ${(asm.activityRefs || []).map((actId) => {
                      const act = activityById.get(actId);
                      return `
                        <span class="mini-tag" style="background:#e0f2fe; color:#0369a1; font-size:11px; cursor:pointer;" data-action="edit-activity" data-activity-id="${escapeHtml(actId)}" data-activity="${escapeHtml(actId)}" title="点击在左栏查看或编辑活动">
                          📌 ${escapeHtml(act?.title || act?.name || actId)}
                          <b data-action="unlink-assumption-activity" data-assumption-id="${escapeHtml(asm.id)}" data-activity-id="${escapeHtml(actId)}" style="margin-left:4px; color:#0284c7; cursor:pointer;">×</b>
                        </span>
                      `;
                    }).join("")}
                    ${activities.length > (asm.activityRefs?.length || 0) ? `
                      <select class="assumption-link-select" data-action="select-link-assumption-activity" data-assumption-id="${escapeHtml(asm.id)}" style="font-size:11px; padding:2px 6px; border:1px dashed #94a3b8; border-radius:4px; background:#fff;">
                        <option value="">+ 关联活动...</option>
                        ${activities
                          .filter((a) => !asm.activityRefs?.includes(a.id))
                          .map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.title || a.name || a.id)}</option>`)
                          .join("")}
                      </select>
                    ` : ""}
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>

      <!-- 失效连锁波及推演预览 -->
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:12px;">
        <h4 style="margin:0 0 8px 0; font-size:13px; color:#1e293b; display:flex; align-items:center; gap:6px;">
          <span>⚡ 假设失效连锁波及矩阵 (抗毁性推演预研)</span>
        </h4>
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${impacts.map((imp) => `
            <div style="font-size:12px; padding:6px 10px; background:#fff; border-radius:4px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:${imp.confidence === "低" ? "#dc2626" : imp.confidence === "中" ? "#d97706" : "#16a34a"};">${escapeHtml(imp.assumptionId)} [${escapeHtml(imp.confidence)}]</strong>:
                <span style="color:#334155; margin-left:4px;">${escapeHtml(imp.summary)}</span>
              </div>
              <span class="mini-tag" style="background:${imp.severity === "critical" ? "#fee2e2" : imp.severity === "high" ? "#ffedd5" : "#f1f5f9"}; color:${imp.severity === "critical" ? "#dc2626" : imp.severity === "high" ? "#c2410c" : "#475569"}; font-size:10px;">
                ${imp.severity === "critical" ? "极高波及" : imp.severity === "high" ? "高度波及" : "受控波及"}
              </span>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}
