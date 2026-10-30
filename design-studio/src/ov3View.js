import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderDerivedViewProvenance } from "./derivedViewProvenance.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { renderDodafLegend, renderEdgeBadge, renderEntityBadge } from "./dodafDraftingView.js";
import { renderForceResourceSubflowBar } from "./forceResourceSubflowNav.js";

export function renderOv3(state = {}) {
  const { model, source } = resolveDodafProduct(state, "ov3");
  const storage = state.ov3Storage || { status: "idle", mode: "local", label: "OV-3" };
  const activities = model.activities || [];
  const exchanges = model.exchanges || [];
  const unresolved = model.unresolved || { missingContractCount: 0, mismatchCount: 0 };
  const diagnostics = model.diagnostics || [];

  const helpOpen = Boolean(state.ov3HelpOpen);
  const flowFilter = state.ov3FlowFilter || "all";
  const compatFilter = state.ov3CompatFilter || "all";
  const viewMode = state.ov3ViewMode || "matrix";
  const searchQuery = (state.ov3Search || "").trim().toLowerCase();
  const selectedExchangeId = state.ov3SelectedExchangeId || (state.selection?.kind === "ov3-exchange" ? state.selection.id : "");

  // Calculate degree maps and active communicating nodes
  const inDegreeMap = new Map();
  const outDegreeMap = new Map();
  const activeNodeIds = new Set();
  const exchangesByPair = new Map();

  for (const exchange of exchanges) {
    const sId = String(exchange.sourceActivityId || "");
    const tId = String(exchange.targetActivityId || "");
    if (sId) {
      activeNodeIds.add(sId);
      outDegreeMap.set(sId, (outDegreeMap.get(sId) || 0) + 1);
    }
    if (tId) {
      activeNodeIds.add(tId);
      inDegreeMap.set(tId, (inDegreeMap.get(tId) || 0) + 1);
    }
    if (sId && tId) {
      exchangesByPair.set(`${sId}:${tId}`, exchange);
    }
  }

  const activeActivities = activities.filter((act) => activeNodeIds.has(String(act.id)));
  const nodeScope = state.ov3NodeScope || (activeActivities.length ? "active" : "all");
  const groupFilter = state.ov3GroupFilter || "all";
  const conceptCount = activities.filter((act) => nodeGroupOf(act) === "concept").length;
  const blueCount = activities.filter((act) => nodeGroupOf(act) === "blue").length;
  const redCount = activities.filter((act) => nodeGroupOf(act) === "red").length;

  const scopedActivities = (nodeScope === "active" && activeActivities.length > 0) ? activeActivities : activities;
  const displayActivities = (groupFilter === "all")
    ? scopedActivities
    : scopedActivities.filter((act) => nodeGroupOf(act) === groupFilter);

  // Counts for KPIs
  const totalExchanges = exchanges.length;
  const readyCount = exchanges.filter((e) => e.compatibility === "ready").length;
  const reviewCount = unresolved.mismatchCount || exchanges.filter((e) => e.compatibility === "review").length;
  const pendingCount = unresolved.missingContractCount || exchanges.filter((e) => e.compatibility === "pending").length;
  const controlCount = exchanges.filter((e) => e.exchangeType === "control").length;
  const infoCount = exchanges.filter((e) => e.exchangeType === "information").length;
  const resourceCount = exchanges.filter((e) => e.exchangeType === "resource").length;

  // Filter exchanges for structured table
  const filteredExchanges = exchanges.filter((ex) => {
    if (flowFilter !== "all" && ex.exchangeType !== flowFilter) return false;
    if (compatFilter !== "all" && ex.compatibility !== compatFilter) return false;
    if (searchQuery) {
      const matchText = [
        ex.sourceActivityTitle,
        ex.targetActivityTitle,
        ex.output,
        ex.input,
        ex.edgeType,
        ex.exchangeType,
        statusLabel(ex.compatibility)
      ].join(" ").toLowerCase();
      if (!matchText.includes(searchQuery)) return false;
    }
    return true;
  });

  const selectedExchange = exchanges.find((ex) => ex.id === selectedExchangeId) || null;

  return `
    <section class="surface surface-pad dodaf-drafting-surface ov3-page" data-dodaf-product="OV-3">
      ${renderForceResourceSubflowBar(state, "ov3")}

      <!-- Header -->
      <div class="ov3-header">
        <div class="ov3-header-main">
          <div class="ov3-title-row">
            <h2>作战资源流矩阵</h2>
            <span class="mini-tag ${source === "persisted" ? "is-persisted" : "is-seed"}">${source === "persisted" ? "已持久化" : "种子/草稿"} · OV-2 投影</span>
            <span class="ov3-badge-controlled">受控投影</span>
            <button type="button" class="quiet-button ov3-help-pill-btn ${helpOpen ? "is-active" : ""}" data-action="ov3-toggle-help" title="展开/收起规范定位与背景种子说明">
              ℹ️ 规范与投影语义 ${helpOpen ? "▲" : "▼"}
            </button>
          </div>
          <p class="ov3-subtitle">DoDAF 2.02 / DM2 资源流矩阵。交换事实由 OV-2 拥有，本页只保存投影视图与复核状态。</p>
        </div>
        <div class="ov3-header-actions">
          ${renderProjectStorageState(storage, { refreshAction: "refresh-project-ov3" })}
          <button type="button" class="quiet-button" data-action="return-force-mission">← 返回兵力</button>
          <button type="button" class="quiet-button" data-action="go-ov2" title="前往 OV-2 作战资源流描述编辑流向">🌐 前往 OV-2</button>
          <button type="button" class="ghost-btn" data-action="seed-dodaf-ov3">从 OV-2 重新投影</button>
          <button type="button" class="ghost-btn" data-action="save-dodaf-ov3">保存 OV-3</button>
          <button type="button" class="primary-btn" data-action="save-and-advance-ov3">保存并完成兵力与资源流 →</button>
        </div>
      </div>

      <!-- Collapsible Provenance & Legend Drawer -->
      <div class="ov3-help-drawer ${helpOpen ? "is-open" : ""}" aria-expanded="${helpOpen ? "true" : "false"}">
        <div class="ov3-help-drawer-inner">
          <div class="ov3-help-drawer-head">
            <strong>📋 DoDAF 2.02 / DM2 OV-3 规范指引与溯源</strong>
            <button type="button" class="quiet-button" data-action="ov3-toggle-help">收起说明 ✕</button>
          </div>
          ${renderDerivedViewProvenance("ov3")}
          ${renderDodafLegend("OV-3")}
        </div>
      </div>

      <!-- Combined Control Bar: Compact KPI Badges & Multi-Dimensional Filters -->
      <div class="ov3-control-bar">
        <!-- Compact KPI Badges -->
        <div class="ov3-kpi-bar">
          <div class="ov3-kpi-item" title="总资源交换数">
            <span class="ov3-kpi-val">${totalExchanges}</span>
            <span class="ov3-kpi-lbl">交换</span>
          </div>
          <div class="ov3-kpi-item is-ready" title="输入输出定义吻合">
            <span class="ov3-kpi-val">${readyCount}</span>
            <span class="ov3-kpi-lbl">匹配</span>
          </div>
          <div class="ov3-kpi-item is-review" title="输入输出存在差异需人工确认">
            <span class="ov3-kpi-val">${reviewCount}</span>
            <span class="ov3-kpi-lbl">待映</span>
          </div>
          <div class="ov3-kpi-item is-pending" title="缺少输入或输出定义">
            <span class="ov3-kpi-val">${pendingCount}</span>
            <span class="ov3-kpi-lbl">缺失</span>
          </div>
          <div class="ov3-kpi-item" title="存在交互关系的执行节点 / 总节点数">
            <span class="ov3-kpi-val">${activeActivities.length}/${activities.length}</span>
            <span class="ov3-kpi-lbl">活跃节点</span>
          </div>
        </div>

        <!-- Interactive Filters & Scope -->
        <div class="ov3-toolbar">
          <div class="ov3-toolbar-left">
            <!-- Node Scope Switcher -->
            <div class="ov3-filter-group" aria-label="节点范围">
              <span class="ov3-filter-label">范围:</span>
              <button type="button" class="ov3-pill-btn ${nodeScope === "active" ? "is-active" : ""}" data-action="ov3-set-scope" data-scope="active" title="仅显示有交互关系的执行者节点（消除稀疏空白）">
                ⚡ 活跃 (${activeActivities.length})
              </button>
              <button type="button" class="ov3-pill-btn ${nodeScope === "all" ? "is-active" : ""}" data-action="ov3-set-scope" data-scope="all" title="显示全部 ${activities.length} 个作战执行者">
                🌐 全量 (${activities.length})
              </button>
            </div>

            <!-- Group / Camp Filter -->
            ${(blueCount || redCount) ? `
              <div class="ov3-filter-group" aria-label="阵营分组">
                <span class="ov3-filter-label">阵营:</span>
                <button type="button" class="ov3-pill-btn ${groupFilter === "all" ? "is-active" : ""}" data-action="ov3-filter-group" data-group="all">全部</button>
                ${conceptCount ? `<button type="button" class="ov3-pill-btn ${groupFilter === "concept" ? "is-active" : ""}" data-action="ov3-filter-group" data-group="concept">协同 (${conceptCount})</button>` : ""}
                ${blueCount ? `<button type="button" class="ov3-pill-btn ${groupFilter === "blue" ? "is-active" : ""}" data-action="ov3-filter-group" data-group="blue">蓝方 (${blueCount})</button>` : ""}
                ${redCount ? `<button type="button" class="ov3-pill-btn ${groupFilter === "red" ? "is-active" : ""}" data-action="ov3-filter-group" data-group="red">红方 (${redCount})</button>` : ""}
              </div>
            ` : ""}

            <!-- Flow Type Filter -->
            <div class="ov3-filter-group" aria-label="流类型">
              <span class="ov3-filter-label">类型:</span>
              <button type="button" class="ov3-pill-btn ${flowFilter === "all" ? "is-active" : ""}" data-action="ov3-filter-flow" data-flow="all">全部</button>
              <button type="button" class="ov3-pill-btn flow-control ${flowFilter === "control" ? "is-active" : ""}" data-action="ov3-filter-flow" data-flow="control"><i class="dot control"></i>控制 (${controlCount})</button>
              <button type="button" class="ov3-pill-btn flow-information ${flowFilter === "information" ? "is-active" : ""}" data-action="ov3-filter-flow" data-flow="information"><i class="dot information"></i>信息 (${infoCount})</button>
              <button type="button" class="ov3-pill-btn flow-resource ${flowFilter === "resource" ? "is-active" : ""}" data-action="ov3-filter-flow" data-flow="resource"><i class="dot resource"></i>物资 (${resourceCount})</button>
            </div>

            <!-- Compatibility Filter -->
            <div class="ov3-filter-group" aria-label="契约匹配度">
              <span class="ov3-filter-label">状态:</span>
              <button type="button" class="ov3-pill-btn ${compatFilter === "all" ? "is-active" : ""}" data-action="ov3-filter-compat" data-compat="all">全部</button>
              <button type="button" class="ov3-pill-btn compat-ready ${compatFilter === "ready" ? "is-active" : ""}" data-action="ov3-filter-compat" data-compat="ready"><i class="dot ready"></i>匹配 (${readyCount})</button>
              <button type="button" class="ov3-pill-btn compat-review ${compatFilter === "review" ? "is-active" : ""}" data-action="ov3-filter-compat" data-compat="review"><i class="dot review"></i>待映 (${reviewCount})</button>
              <button type="button" class="ov3-pill-btn compat-pending ${compatFilter === "pending" ? "is-active" : ""}" data-action="ov3-filter-compat" data-compat="pending"><i class="dot pending"></i>缺失 (${pendingCount})</button>
            </div>
          </div>

          <div class="ov3-toolbar-right">
            <!-- View Switcher -->
            <div class="ov3-view-switcher" role="radiogroup" aria-label="展现模式">
              <button type="button" class="ov3-switch-btn ${viewMode === "matrix" ? "is-active" : ""}" data-action="ov3-set-view-mode" data-mode="matrix" title="矩阵热力网格">⊞ 矩阵</button>
              <button type="button" class="ov3-switch-btn ${viewMode === "table" ? "is-active" : ""}" data-action="ov3-set-view-mode" data-mode="table" title="结构化契约清单">☰ 清单</button>
              <button type="button" class="ov3-switch-btn ${viewMode === "split" ? "is-active" : ""}" data-action="ov3-set-view-mode" data-mode="split" title="上下对照分栏">◫ 对照</button>
            </div>

            <!-- Search Input -->
            <div class="ov3-search-box">
              <input type="search" class="ov3-search-input" placeholder="搜索节点/载荷/状态..." value="${escapeHtml(state.ov3Search || "")}" data-action="ov3-search">
              ${state.ov3Search ? `<button type="button" class="ov3-search-clear" data-action="ov3-clear-filter" title="清空搜索">✕</button>` : ""}
            </div>
          </div>
        </div>
      </div>

      <!-- Main Layout: Matrix/List Workspace + Right-Side Detail Drawer -->
      <div class="ov3-workspace-layout ${selectedExchange ? "has-drawer" : ""}">
        <div class="ov3-primary-panel">
          <!-- Matrix Section (Strict DOM Order requirement: matrix-section < table-wrap < diagnostics) -->
          <section class="ov3-matrix-section ${viewMode === "table" ? "is-minimized" : ""}" aria-labelledby="ov3-matrix-heading">
            <div class="ov3-matrix-heading">
              <div>
                <h3 id="ov3-matrix-heading">资源流矩阵</h3>
                <p>行是来源节点，列是接收节点；交换内容随 OV-2 源事实更新。</p>
              </div>
              <div class="ov3-matrix-meta">
                <div class="ov3-matrix-scroll-ctrls">
                  <button type="button" class="quiet-button ov3-scroll-btn" data-action="ov3-scroll-matrix" data-dir="left" title="向左平移浏览列">◀ 向左</button>
                  <button type="button" class="quiet-button ov3-scroll-btn" data-action="ov3-scroll-matrix" data-dir="right" title="向右平移浏览列">向右 ▶</button>
                  <button type="button" class="quiet-button ov3-scroll-btn" data-action="ov3-scroll-matrix" data-dir="first-flow" title="横向滚动定位至第一个有交互流的单元格">🎯 定位交互单元</button>
                </div>
                <span>当前网格: ${displayActivities.length} × ${displayActivities.length} (${nodeScope === "active" ? "活跃节点聚焦" : "全量节点"}) · 源 → 目标</span>
              </div>
            </div>
            <div class="ov3-matrix-wrap">
              <table class="ov3-matrix">
                <thead>
                  <tr>
                    <th scope="col" class="matrix-corner-th" title="矩阵表头：行表示来源节点，列表示接收节点">
                      <div class="corner-txt">
                        <span class="corner-col-lbl">接收方 (In) ➔</span>
                        <span class="corner-row-lbl">来源方 (Out) ↓</span>
                      </div>
                    </th>
                    ${displayActivities.map((activity) => `
                      <th scope="col" class="matrix-head-th" title="${escapeHtml(activity.title)} (${inDegreeMap.get(String(activity.id)) || 0} 接收)">
                        <div class="th-cell-wrap">
                          <span class="th-title-text">${escapeHtml(activity.title)}</span>
                          <small class="th-badge-deg">${inDegreeMap.get(String(activity.id)) || 0}入</small>
                        </div>
                      </th>
                    `).join("")}
                  </tr>
                </thead>
                <tbody>
                  ${displayActivities.map((sourceActivity) => `
                    <tr>
                      <th scope="row" class="matrix-row-th" title="${escapeHtml(sourceActivity.title)} (${outDegreeMap.get(String(sourceActivity.id)) || 0} 输出)">
                        <div class="th-row-wrap">
                          <span class="th-title-text">${escapeHtml(sourceActivity.title)}</span>
                          <small class="th-badge-deg">${outDegreeMap.get(String(sourceActivity.id)) || 0}出</small>
                        </div>
                      </th>
                      ${displayActivities.map((target) => renderMatrixCell(exchangesByPair.get(`${sourceActivity.id}:${target.id}`), { selectedExchangeId, flowFilter, compatFilter })).join("")}
                    </tr>
                  `).join("") || `<tr><td class="ov3-empty" colspan="${displayActivities.length + 1}">尚无活动矩阵。</td></tr>`}
                </tbody>
              </table>
            </div>
          </section>

          <!-- Structured Table Section -->
          <div class="ov3-table-wrap ${viewMode === "matrix" ? "is-secondary" : ""}">
            <div class="ov3-table-bar">
              <div class="ov3-table-bar-title">
                <h4>接口契约清单 (${filteredExchanges.length} / ${totalExchanges} 条)</h4>
                <span class="ov3-table-hint">展示 OV-2 输出载荷与目标输入契约对照；点击任意行聚焦并可通过 OV-2 编辑</span>
              </div>
            </div>
            <table class="ov3-table">
              <thead>
                <tr>
                  <th scope="col" style="width: 20%;">来源节点</th>
                  <th scope="col" style="width: 12%;">交换类型</th>
                  <th scope="col" style="width: 38%;">OV-2 输出 / 目标输入</th>
                  <th scope="col" style="width: 20%;">接收节点</th>
                  <th scope="col" style="width: 10%;">状态</th>
                </tr>
              </thead>
              <tbody>
                ${filteredExchanges.map((exchange) => `
                  <tr class="ov3-table-row ${selectedExchangeId === exchange.id ? "is-selected" : ""} ${exchange.compatibility}" data-ov3-exchange="${escapeHtml(exchange.id)}">
                    <td>${renderEntityBadge({ dm2Type: "Performer", label: exchange.sourceActivityTitle })}</td>
                    <td>${renderEdgeBadge(exchange.exchangeType || exchange.edgeType, typeLabel(exchange.exchangeType))}</td>
                    <td>
                      <div class="ov3-contract">
                        <span class="contract-out">${escapeHtml(exchange.output || "未定义")}</span>
                        <small class="contract-in">→ ${escapeHtml(exchange.input || "未定义")}</small>
                      </div>
                    </td>
                    <td>${renderEntityBadge({ dm2Type: "Performer", label: exchange.targetActivityTitle })}</td>
                    <td>
                      <div class="ov3-table-status-wrap">
                        <span class="status-tag ${exchange.compatibility === "ready" ? "" : "review"}">${statusLabel(exchange.compatibility)}</span>
                        <button type="button" class="quiet-button ov3-inline-jump-btn" data-action="ov3-jump-to-ov2" data-exchange-id="${escapeHtml(exchange.id)}" title="在 OV-2 中编辑此交换">OV-2 ↗</button>
                      </div>
                    </td>
                  </tr>
                `).join("") || `<tr><td colspan="5" class="ov3-empty">尚无可投影的 OV-2 交换。</td></tr>`}
              </tbody>
            </table>
          </div>

          <!-- Diagnostics Section -->
          <section class="ooda-diagnostics ov2-diagnostics ov3-diagnostics-section">
            <details class="ov3-diagnostics-details">
              <summary class="ov3-diagnostics-summary">
                <div class="ov3-diagnostics-head">
                  <h3>产品诊断</h3>
                  <span class="diagnostics-sub">OV-2 投影与接口契约质量检测 (${diagnostics.length} 项)</span>
                </div>
              </summary>
              <div class="ooda-diagnostic-list">
                ${diagnostics.map((item) => `
                  <div class="ooda-diagnostic ${escapeHtml(item.state)}">
                    <strong>${escapeHtml(item.label)}</strong>
                    <span>${escapeHtml(item.statusLabel || item.state)}</span>
                    <p>${escapeHtml(item.detail)}</p>
                  </div>
                `).join("")}
              </div>
            </details>
          </section>
        </div>

        <!-- Selected Exchange Inspector Drawer (Right Side) -->
        <aside class="ov3-side-drawer ${selectedExchange ? "is-open" : ""}" aria-label="交互契约详情">
          ${renderSelectedExchangeDock(selectedExchange)}
        </aside>
      </div>
    </section>
  `;
}

function renderSelectedExchangeDock(exchange) {
  if (!exchange) {
    return `
      <div class="ov3-inspector-dock is-idle">
        <div class="dock-idle-head">
          <span class="dock-idle-icon">💡</span>
          <strong>资源流契约检查</strong>
        </div>
        <p class="dock-idle-desc">点击矩阵单元格或契约列表行，查看执行者间的输出输入映射与兼容性依据；交换事实由 OV-2 拥有。</p>
      </div>
    `;
  }

  const rationale = exchange.compatibility === "ready"
    ? "输出与输入字段直接一致或存在语义重合（Ready）"
    : exchange.compatibility === "review"
      ? "输出与输入文本不完全一致，需人工核对或建立映射（Review）"
      : "缺少输出载荷或目标输入定义，需完善契约（Pending）";

  return `
    <div class="ov3-inspector-dock is-active" data-dock-exchange="${escapeHtml(exchange.id)}">
      <div class="ov3-drawer-head">
        <div class="ov3-drawer-title-row">
          <span class="ov3-dock-tag">焦点流契约</span>
          <button type="button" class="quiet-button ov3-drawer-close-btn" data-action="ov3-close-drawer" title="关闭详情抽屉">✕</button>
        </div>
        <strong class="ov3-dock-flow-title">${escapeHtml(exchange.sourceActivityTitle)} ➔ ${escapeHtml(exchange.targetActivityTitle)}</strong>
        <div class="ov3-drawer-meta-badges">
          ${renderEdgeBadge(exchange.exchangeType || exchange.edgeType, typeLabel(exchange.exchangeType))}
          <span class="status-tag ${exchange.compatibility === "ready" ? "is-ready" : "review"}">${statusLabel(exchange.compatibility)}</span>
        </div>
      </div>
      <div class="ov3-dock-main">
        <div class="ov3-dock-payload-grid">
          <div class="ov3-dock-payload-col">
            <span class="payload-badge out">源输出 (OV-2)</span>
            <div class="payload-box" title="${escapeHtml(exchange.output || "未定义输出")}">${escapeHtml(exchange.output || "未定义输出")}</div>
          </div>
          <div class="ov3-dock-arrow-col">
            <span class="arrow-sym">↓</span>
            <small class="rationale-text">${escapeHtml(rationale)}</small>
          </div>
          <div class="ov3-dock-payload-col">
            <span class="payload-badge in">目标输入 (OV-2)</span>
            <div class="payload-box" title="${escapeHtml(exchange.input || "未定义输入")}">${escapeHtml(exchange.input || "未定义输入")}</div>
          </div>
        </div>
      </div>
      <div class="ov3-dock-action-col">
        <button type="button" class="primary-btn ov3-dock-jump-btn" data-action="ov3-jump-to-ov2" data-exchange-id="${escapeHtml(exchange.id)}" title="跳转到 OV-2 并定位此流向">
          在 OV-2 编辑此交换 ↗
        </button>
      </div>
    </div>
  `;
}

function renderMatrixCell(exchange, { selectedExchangeId, flowFilter = "all", compatFilter = "all" } = {}) {
  if (!exchange) return `<td class="ov3-matrix-empty" aria-label="无直接交换">—</td>`;
  const isSelected = exchange.id === selectedExchangeId;
  const isMatchFlow = flowFilter === "all" || exchange.exchangeType === flowFilter;
  const isMatchCompat = compatFilter === "all" || exchange.compatibility === compatFilter;
  const isDimmed = !isMatchFlow || !isMatchCompat;
  const title = `${exchange.sourceActivityTitle} → ${exchange.targetActivityTitle}：${typeLabel(exchange.exchangeType)}，${statusLabel(exchange.compatibility)}`;

  return `<td class="ov3-matrix-cell ${escapeHtml(exchange.compatibility)} ${isSelected ? "is-selected" : ""} ${isDimmed ? "is-dimmed" : ""}"><button type="button" class="ov3-matrix-link ${isSelected ? "is-selected" : ""}" data-ov3-exchange="${escapeHtml(exchange.id)}" title="${escapeHtml(title)}">${renderEdgeBadge(exchange.exchangeType || exchange.edgeType, typeLabel(exchange.exchangeType))}<small>${statusLabel(exchange.compatibility)}</small></button></td>`;
}

export function selectionForOv3Exchange(exchangeId, models) {
  const { model } = resolveDodafProduct(models, "ov3");
  const exchange = (model.exchanges || []).find((item) => item.id === exchangeId);
  if (!exchange) return null;
  return {
    id: exchange.id,
    kind: "ov3-exchange",
    title: `${exchange.sourceActivityTitle} -> ${exchange.targetActivityTitle}`,
    status: "OV-3 ResourceFlow",
    text: "DoDAF 2.02 OV-2 资源交换的受控投影。",
    facts: [
      ["OV-2 交换", exchange.sourceExchangeRef || exchange.id],
      ["交换类型", typeLabel(exchange.exchangeType)],
      ["源输出", exchange.output || "未定义"],
      ["目标输入", exchange.input || "未定义"],
      ["匹配状态", statusLabel(exchange.compatibility)]
    ],
    refs: [exchange.sourceExchangeRef, exchange.sourceActivityId, exchange.targetActivityId].filter(Boolean)
  };
}

function nodeGroupOf(activity) {
  const title = String(activity?.title || "");
  if (title.startsWith("蓝方·") || title.startsWith("蓝方")) return "blue";
  if (title.startsWith("红方·") || title.startsWith("红方")) return "red";
  return "concept";
}

function typeLabel(value) { return ({ resource: "资源", control: "控制", information: "信息" })[value] || "信息"; }
function statusLabel(value) { return ({ ready: "直接匹配", review: "需映射", pending: "定义缺失" })[value] || "待复核"; }
function escapeHtml(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
