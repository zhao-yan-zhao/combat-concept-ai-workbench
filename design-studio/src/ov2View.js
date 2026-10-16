import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderDerivedViewProvenance } from "./derivedViewProvenance.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { renderDodafLegend, renderEdgeBadge, renderEntityBadge } from "./dodafDraftingView.js";
import { renderForceResourceSubflowBar } from "./forceResourceSubflowNav.js";
import { renderOv2Canvas, resolveFlowKey } from "./ov2Canvas.js";
import { escapeHtml } from "./app/domUtils.js";

export function renderOv2(state) {
  const { model, source } = resolveDodafProduct(state, "ov2");
  const storage = state.ov2Storage || { status: "idle", mode: "local", label: "OV-2" };
  const notes = model.view?.notes || "";
  const selectedNodeId = state.ov2SelectedNodeId || "";
  const selectedExchangeId = state.ov2SelectedExchangeId || "";
  const viewMode = state.ov2ViewMode || "canvas"; // 'canvas' | 'table'
  const flowFilter = state.ov2FlowFilter || "all"; // 'all' | 'control' | 'information' | 'resource'
  const helpOpen = state.ov2HelpOpen === true;
  const editorOpen = state.ov2EditorOpen !== false && Boolean(selectedExchangeId || selectedNodeId);

  const nodes = model.nodes || [];
  const exchanges = model.exchanges || [];

  // Degree counts
  const inDegree = new Map();
  const outDegree = new Map();
  nodes.forEach((n) => { inDegree.set(n.id, 0); outDegree.set(n.id, 0); });
  exchanges.forEach((ex) => {
    outDegree.set(ex.sourceNodeId, (outDegree.get(ex.sourceNodeId) || 0) + 1);
    inDegree.set(ex.targetNodeId, (inDegree.get(ex.targetNodeId) || 0) + 1);
  });

  // Flow counts for filter pills
  let controlCount = 0;
  let infoCount = 0;
  let resourceCount = 0;
  exchanges.forEach((ex) => {
    const k = resolveFlowKey(ex.flowType);
    if (k === "control") controlCount++;
    else if (k === "resource") resourceCount++;
    else infoCount++;
  });

  // Filtered exchanges for table / display
  let filteredExchanges = exchanges;
  if (selectedNodeId) {
    filteredExchanges = filteredExchanges.filter(
      (ex) => ex.sourceNodeId === selectedNodeId || ex.targetNodeId === selectedNodeId
    );
  }
  if (flowFilter !== "all") {
    filteredExchanges = filteredExchanges.filter(
      (ex) => resolveFlowKey(ex.flowType) === flowFilter
    );
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;
  const selectedExchange = exchanges.find((ex) => ex.id === selectedExchangeId) || null;

  return `
    <section class="ov2-page dodaf-drafting-surface" data-dodaf-product="OV-2" data-view-page="operational-resource-flow">
      ${renderForceResourceSubflowBar(state, "ov2")}

      <!-- Top compact header -->
      <header class="ov2-header">
        <div class="ov2-header-identity">
          <div class="ov2-title-row">
            <h2>作战资源流描述</h2>
            <span class="mini-tag ${source === "persisted" ? "is-persisted" : "is-seed"}">${source === "persisted" ? "已持久化" : "草稿/种子"} · DM2</span>
            <span class="ov2-stats-pill">${nodes.length} 个节点 · ${exchanges.length} 条资源流</span>
            <button type="button" class="quiet-button ov2-help-pill-btn ${helpOpen ? "is-active" : ""}" data-action="ov2-toggle-help" title="点击展开/收起规范定位与背景种子说明">
              ℹ️ 规范与种子语义 ${helpOpen ? "▲" : "▼"}
            </button>
          </div>
          <p class="ov2-subtitle">DoDAF 2.02 / DM2 交换事实（Needline / ResourceFlow），刻画执行者间的控制、信息与物资流转契约。</p>
        </div>
        <div class="ov2-header-actions">
          ${renderProjectStorageState(storage, { refreshAction: "refresh-project-ov2" })}
          <button type="button" class="quiet-button" data-action="return-force-mission">← 返回兵力</button>
          <button type="button" class="ghost-btn" data-action="seed-dodaf-ov2" title="从上游兵力与活动重新推导生成">从上游重新生成</button>
          <button type="button" class="ghost-btn" data-action="save-dodaf-ov2">保存 OV-2</button>
          <button type="button" class="primary-btn" data-action="save-and-advance-ov2">进入资源流矩阵 (OV-3) →</button>
        </div>
      </header>

      <!-- Collapsible Provenance & Legend Drawer (Collapsible) -->
      <div class="ov2-help-drawer ${helpOpen ? "is-open" : ""}" aria-expanded="${helpOpen ? "true" : "false"}">
        <div class="ov2-help-drawer-inner">
          <div class="ov2-help-drawer-head">
            <strong>📋 DoDAF 2.02 / DM2 规范指引与溯源</strong>
            <button type="button" class="quiet-button" data-action="ov2-toggle-help">收起说明 ✕</button>
          </div>
          ${renderDerivedViewProvenance("ov2")}
          ${renderDodafLegend("OV-2")}
          <label class="field-block ov2-notes-block">
            <span>产品备注（写入项目仓储）</span>
            <textarea data-dodaf-field="ov2.view.notes" rows="2" placeholder="填写关于本阶段作战资源流的补充设计说明或评估注意事项…">${escapeHtml(notes)}</textarea>
          </label>
        </div>
      </div>

      <!-- Main 3-panel workbench -->
      <div class="ov2-workbench ${editorOpen ? "is-editor-open" : ""}">
        <!-- Left Panel: Nodes / Performers (grouped-list compliant) -->
        <aside class="ov2-node-panel" data-grouped-list-panel="ov2" data-grouped-list-dimensions="层级:level|类型:type|状态:status" data-grouped-list-default-group="level">
          <div class="ov2-panel-head">
            <div class="ov2-panel-title-wrap">
              <h3>作战执行者 (Performer)</h3>
              <span class="ov2-badge">${nodes.length}</span>
            </div>
            ${selectedNodeId ? `
              <button type="button" class="quiet-button ov2-clear-filter-btn" data-action="clear-ov2-node-filter" title="清除节点聚焦">
                清除聚焦 ✕
              </button>
            ` : ""}
          </div>
          <div class="ov2-node-list" data-grouped-list-items>
            ${nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const outC = outDegree.get(node.id) || 0;
              const inC = inDegree.get(node.id) || 0;
              const layerText = node.layer === "combat" ? "作战层" : "概念层";

              return `
                <div data-grouped-list-item class="ov2-node-item ${isSelected ? "is-selected is-inherited-focus" : ""}"
                  data-group-level="${layerText}" data-group-type="Performer"
                  data-group-status="${(node.taskRefs || []).length ? "已关联任务" : "基础单元"}"
                  data-search="${escapeHtml([node.id, node.label, node.detail, ...(node.taskRefs || [])].filter(Boolean).join(" "))}">
                  <button type="button" class="ov2-node-btn" data-action="ov2-select-node" data-node-id="${escapeHtml(node.id)}">
                    <div class="ov2-node-btn-head">
                      <strong class="ov2-node-title">${escapeHtml(node.label || node.id)}</strong>
                      <span class="ov2-pill-tag">${layerText}</span>
                    </div>
                    <div class="ov2-node-btn-meta">
                      <span class="ov2-flow-counter is-out">▲ ${outC} 出</span>
                      <span class="ov2-flow-counter is-in">▼ ${inC} 进</span>
                      <span class="ov2-task-count">${(node.taskRefs || []).length} 任务</span>
                    </div>
                  </button>
                </div>
              `;
            }).join("") || `<p class="report-empty">尚未推导演算节点。</p>`}
          </div>
        </aside>

        <!-- Center Main Panel: Dual-mode Topology Canvas / Structured Table -->
        <main class="ov2-main-panel">
          <header class="ov2-canvas-head">
            <!-- Flow type filters -->
            <div class="ov2-flow-filter-group" aria-label="资源流类型过滤">
              <span class="ov2-filter-label">流过滤:</span>
              <button type="button" class="ov2-filter-btn ${flowFilter === "all" ? "is-active" : ""}" data-action="ov2-filter-flow" data-flow="all">全部 (${exchanges.length})</button>
              <button type="button" class="ov2-filter-btn flow-control ${flowFilter === "control" ? "is-active" : ""}" data-action="ov2-filter-flow" data-flow="control"><i class="dot control"></i>控制流 (${controlCount})</button>
              <button type="button" class="ov2-filter-btn flow-information ${flowFilter === "information" ? "is-active" : ""}" data-action="ov2-filter-flow" data-flow="information"><i class="dot information"></i>信息流 (${infoCount})</button>
              <button type="button" class="ov2-filter-btn flow-resource ${flowFilter === "resource" ? "is-active" : ""}" data-action="ov2-filter-flow" data-flow="resource"><i class="dot resource"></i>物资流 (${resourceCount})</button>
            </div>

            <!-- View mode switch -->
            <div class="ov2-view-switcher" role="radiogroup" aria-label="视图呈现模式">
              <button type="button" class="ov2-switch-btn ${viewMode === "canvas" ? "is-active" : ""}" data-action="ov2-set-view-mode" data-mode="canvas" title="交互式流向拓扑网络图">
                🌐 拓扑网络
              </button>
              <button type="button" class="ov2-switch-btn ${viewMode === "table" ? "is-active" : ""}" data-action="ov2-set-view-mode" data-mode="table" title="结构化资源交换清单">
                📋 结构清单
              </button>
            </div>

            <!-- Canvas zoom & fit controls -->
            ${viewMode === "canvas" ? `
              <div class="ov2-canvas-zoom-controls">
                <button type="button" class="ov2-zoom-btn" data-ov2-zoom="out" title="缩小画布" aria-label="缩小">−</button>
                <output class="ov2-zoom-label" data-ov2-zoom-label>100%</output>
                <button type="button" class="ov2-zoom-btn" data-ov2-zoom="in" title="放大画布" aria-label="放大">＋</button>
                <button type="button" class="ov2-zoom-btn sm-canvas-fit" data-ov2-zoom="fit" title="全景适配画布" aria-label="适配画布">⌖</button>
                <button type="button" class="ov2-zoom-btn sm-canvas-layout" data-ov2-canvas-layout title="恢复默认自动排版" aria-label="自适应排版">
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <rect x="2" y="2" width="5" height="5" rx="1"></rect>
                    <rect x="9" y="2" width="5" height="5" rx="1"></rect>
                    <rect x="5.5" y="9" width="5" height="5" rx="1"></rect>
                  </svg>
                  <span>排版</span>
                </button>
              </div>
            ` : ""}

            <!-- Main actions -->
            <div class="ov2-main-actions">
              <button type="button" class="ghost-btn ov2-add-btn" data-action="ov2-add-exchange" title="在节点间新建一条作战资源流">+ 新建流</button>
            </div>
          </header>

          ${selectedNodeId ? `
            <div class="ov2-node-focus-bar ov2-filter-banner">
              <span>已从 OV-4 继承聚焦单元：<strong>${escapeHtml(selectedNode?.label || selectedNodeId)}</strong>（共 ${filteredExchanges.length} 条关联流向）</span>
              <button type="button" class="quiet-button" data-action="clear-ov2-node-filter">显示全部节点流</button>
            </div>
          ` : ""}

          <!-- Center Body -->
          <div class="ov2-view-body ${viewMode === "table" ? "is-table-view" : "is-canvas-view"}">
            ${viewMode === "canvas"
              ? renderOv2Canvas(model, { selectedNodeId, selectedExchangeId, flowFilter, savedPositions: state.ov2NodePositions || {} })
              : renderOv2Table(filteredExchanges, { selectedExchangeId, nodes })}
          </div>

          <!-- Bottom Mini Diagnostics Bar -->
          <footer class="ov2-diagnostics-bar">
            <span class="ov2-diag-title">DM2 完整性诊断:</span>
            <div class="ov2-diag-items">
              ${(model.diagnostics || []).map((item) => `
                <span class="ov2-diag-badge ${escapeHtml(item.state)}" title="${escapeHtml(item.detail)}">
                  <strong class="ov2-diag-dot"></strong>
                  <span>${escapeHtml(item.label)}: ${escapeHtml(item.statusLabel || item.state)}</span>
                </span>
              `).join("") || `<span class="ov2-diag-badge ready"><strong class="ov2-diag-dot"></strong><span>全部映射正常</span></span>`}
            </div>
          </footer>
        </main>

        <!-- Right Inspector / Property Dock -->
        <aside class="ov2-property-dock ${editorOpen ? "is-open" : ""}">
          ${renderOv2PropertyDock({ selectedExchange, selectedNode, nodes, exchanges })}
        </aside>
      </div>
    </section>
  `;
}

/**
 * Renders the structured data table view for OV-2 exchanges
 */
function renderOv2Table(exchanges = [], { selectedExchangeId = "", nodes = [] } = {}) {
  if (!exchanges.length) {
    return `
      <div class="ov2-table-empty">
        <p>暂无符合当前过滤条件的资源交换项。</p>
        <button type="button" class="primary-btn" data-action="ov2-add-exchange">+ 新建资源流</button>
      </div>
    `;
  }

  return `
    <div class="ov2-table-container">
      <table class="ov2-table">
        <thead>
          <tr>
            <th>发送节点</th>
            <th>流向与类型</th>
            <th>交换内容</th>
            <th>载荷契约 (输出 ➔ 输入)</th>
            <th>接收节点</th>
            <th>关联任务/活动</th>
            <th class="col-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          ${exchanges.map((ex) => {
            const isSelected = selectedExchangeId === ex.id;
            const flowKey = resolveFlowKey(ex.flowType);
            const typeLabel = flowKey === "control" ? "控制流" : flowKey === "resource" ? "物资流" : "信息流";

            return `
              <tr class="ov2-table-row ${isSelected ? "is-selected-row" : ""}" data-ov2-exchange="${escapeHtml(ex.id)}">
                <td>
                  <span class="ov2-entity-pill">${escapeHtml(ex.sourceNodeLabel || ex.sourceNodeId)}</span>
                </td>
                <td>
                  <span class="ov2-flow-type-badge ${flowKey}">
                    <i class="dot"></i> ${typeLabel}
                  </span>
                </td>
                <td>
                  <strong class="ov2-exchange-label">${escapeHtml(ex.label || "未命名交换")}</strong>
                </td>
                <td>
                  <div class="ov2-contract-box">
                    <span class="contract-out" title="${escapeHtml(ex.output || "")}">出: ${escapeHtml(ex.output || "未定义")}</span>
                    <span class="contract-in" title="${escapeHtml(ex.input || "")}">进: ${escapeHtml(ex.input || "未定义")}</span>
                  </div>
                </td>
                <td>
                  <span class="ov2-entity-pill">${escapeHtml(ex.targetNodeLabel || ex.targetNodeId)}</span>
                </td>
                <td>
                  <small class="ov2-meta-activities">${escapeHtml(ex.sourceActivityTitle || "无活动")} ➔ ${escapeHtml(ex.targetActivityTitle || "无活动")}</small>
                </td>
                <td class="col-actions">
                  <div class="ov2-row-actions">
                    <button type="button" class="quiet-button" data-ov2-exchange="${escapeHtml(ex.id)}" title="在右侧面板编辑此流">编辑</button>
                    <button type="button" class="quiet-button" data-action="ov2-reverse-exchange" data-exchange-id="${escapeHtml(ex.id)}" title="反转发送与接收节点">⇄</button>
                    <button type="button" class="quiet-button danger" data-action="ov2-delete-exchange" data-exchange-id="${escapeHtml(ex.id)}" title="删除此流">🗑️</button>
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Renders the Right Inspector Property Dock for the selected Exchange or Node
 */
function renderOv2PropertyDock({ selectedExchange, selectedNode, nodes = [], exchanges = [] } = {}) {
  // Scenario 1: An exchange is selected -> Full DM2 semantic editor
  if (selectedExchange) {
    const flowKey = resolveFlowKey(selectedExchange.flowType);
    return `
      <div class="ov2-dock-inner">
        <header class="ov2-dock-head">
          <div>
            <span class="ov2-dock-tag">Needline 资源交换</span>
            <h4>${escapeHtml(selectedExchange.label || "未命名流")}</h4>
          </div>
          <button type="button" class="quiet-button" data-action="ov2-close-editor" title="关闭属性面板">✕</button>
        </header>

        <div class="ov2-dock-body">
          <div class="ov2-flow-direction-bar">
            <span class="direction-node source">${escapeHtml(selectedExchange.sourceNodeLabel || selectedExchange.sourceNodeId)}</span>
            <span class="direction-arrow">➔</span>
            <span class="direction-node target">${escapeHtml(selectedExchange.targetNodeLabel || selectedExchange.targetNodeId)}</span>
            <button type="button" class="ghost-btn ov2-reverse-btn" data-action="ov2-reverse-exchange" data-exchange-id="${escapeHtml(selectedExchange.id)}" title="交换发送与接收方方向">
              ⇄ 反转方向
            </button>
          </div>

          <label class="field-block">
            <span>交换内容/名称</span>
            <input data-dodaf-field="ov2.exchange.${escapeHtml(selectedExchange.id)}.label" value="${escapeHtml(selectedExchange.label || "")}" placeholder="如：目标指示信息、超视距火控指令、油弹补给请求" />
          </label>

          <label class="field-block">
            <span>资源流类型 (DM2 FlowType)</span>
            <select data-dodaf-field="ov2.exchange.${escapeHtml(selectedExchange.id)}.flowType">
              <option value="控制流" ${flowKey === "control" ? "selected" : ""}>控制流 (Command / Control) - 指令、任务协同</option>
              <option value="信息流" ${flowKey === "information" ? "selected" : ""}>信息流 (Information / Intel) - 态势感知、目标诸元</option>
              <option value="资源流" ${flowKey === "resource" ? "selected" : ""}>物资/资源流 (Physical Resource) - 弹药、燃料、维修</option>
            </select>
          </label>

          <label class="field-block">
            <span>输出载荷契约 (发送方输出)</span>
            <textarea data-dodaf-field="ov2.exchange.${escapeHtml(selectedExchange.id)}.output" rows="2" placeholder="描述发送节点提供的载荷格式、协议或数据语义">${escapeHtml(selectedExchange.output || "")}</textarea>
          </label>

          <label class="field-block">
            <span>输入载荷契约 (接收方接收)</span>
            <textarea data-dodaf-field="ov2.exchange.${escapeHtml(selectedExchange.id)}.input" rows="2" placeholder="描述接收节点期望接收的输入参数或前置门槛">${escapeHtml(selectedExchange.input || "")}</textarea>
          </label>

          <div class="ov2-dock-section">
            <h5>溯源活动映射 (OV-5 / 任务)</h5>
            <label class="field-block">
              <span>来源活动 (发送方执行)</span>
              <input data-dodaf-field="ov2.exchange.${escapeHtml(selectedExchange.id)}.sourceActivityTitle" value="${escapeHtml(selectedExchange.sourceActivityTitle || "")}" placeholder="如：雷达扇面搜索与目标捕获" />
            </label>
            <label class="field-block">
              <span>目标活动 (接收方执行)</span>
              <input data-dodaf-field="ov2.exchange.${escapeHtml(selectedExchange.id)}.targetActivityTitle" value="${escapeHtml(selectedExchange.targetActivityTitle || "")}" placeholder="如：超视距导弹发射与制导" />
            </label>
          </div>

          <div class="ov2-dock-footer">
            <button type="button" class="quiet-button danger" data-action="ov2-delete-exchange" data-exchange-id="${escapeHtml(selectedExchange.id)}">
              🗑️ 删除此流
            </button>
            <button type="button" class="primary-btn" data-action="save-and-advance-ov2" title="保存并在 OV-3 矩阵中查看">
              在 OV-3 矩阵查看 →
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Scenario 2: A node is selected -> Node overview & related flows
  if (selectedNode) {
    const outFlows = exchanges.filter((ex) => ex.sourceNodeId === selectedNode.id);
    const inFlows = exchanges.filter((ex) => ex.targetNodeId === selectedNode.id);

    return `
      <div class="ov2-dock-inner">
        <header class="ov2-dock-head">
          <div>
            <span class="ov2-dock-tag">作战执行者 (Performer)</span>
            <h4>${escapeHtml(selectedNode.label || selectedNode.id)}</h4>
          </div>
          <button type="button" class="quiet-button" data-action="ov2-close-editor" title="关闭属性面板">✕</button>
        </header>

        <div class="ov2-dock-body">
          <div class="ov2-node-detail-card">
            <div class="detail-row">
              <span class="label">作战层级:</span>
              <strong>${selectedNode.layer === "combat" ? "作战执行层" : "概念设计层"}</strong>
            </div>
            <div class="detail-row">
              <span class="label">职责描述:</span>
              <p>${escapeHtml(selectedNode.detail || "未指定详细职责说明")}</p>
            </div>
            <div class="detail-row">
              <span class="label">任务引用:</span>
              <span>${(selectedNode.taskRefs || []).length ? (selectedNode.taskRefs || []).join("、") : "未关联任务"}</span>
            </div>
          </div>

          <div class="ov2-dock-section">
            <h5>流出资源流 (${outFlows.length})</h5>
            <div class="ov2-dock-flow-list">
              ${outFlows.map((ex) => `
                <button type="button" class="ov2-dock-flow-item" data-ov2-exchange="${escapeHtml(ex.id)}">
                  <span class="flow-target">➔ ${escapeHtml(ex.targetNodeLabel || ex.targetNodeId)}</span>
                  <span class="flow-name">${escapeHtml(ex.label || ex.flowType)}</span>
                </button>
              `).join("") || `<span class="empty-hint">暂无流出交换</span>`}
            </div>
          </div>

          <div class="ov2-dock-section">
            <h5>流入资源流 (${inFlows.length})</h5>
            <div class="ov2-dock-flow-list">
              ${inFlows.map((ex) => `
                <button type="button" class="ov2-dock-flow-item" data-ov2-exchange="${escapeHtml(ex.id)}">
                  <span class="flow-target">⬅ ${escapeHtml(ex.sourceNodeLabel || ex.sourceNodeId)}</span>
                  <span class="flow-name">${escapeHtml(ex.label || ex.flowType)}</span>
                </button>
              `).join("") || `<span class="empty-hint">暂无流入交换</span>`}
            </div>
          </div>

          <div class="ov2-dock-footer">
            <button type="button" class="ghost-btn" data-action="clear-ov2-node-filter">
              取消聚焦此节点
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Scenario 3: Nothing selected -> Friendly Guide & Overview
  return `
    <div class="ov2-dock-inner is-empty">
      <div class="ov2-dock-guide">
        <span class="guide-icon">🌐</span>
        <h4>作战资源流协同工作区</h4>
        <p>点击拓扑图上的<strong>节点</strong>可高亮其上下游关联链路；点击<strong>流向连线或标签</strong>可在本面板直接审查与编辑载荷契约。</p>
        <div class="ov2-dock-stats-box">
          <div class="stat-item">
            <span class="stat-num">${nodes.length}</span>
            <span class="stat-label">作战节点</span>
          </div>
          <div class="stat-item">
            <span class="stat-num">${exchanges.length}</span>
            <span class="stat-label">资源流向</span>
          </div>
        </div>
        <button type="button" class="primary-btn" data-action="ov2-add-exchange">
          + 新增作战资源流
        </button>
      </div>
    </div>
  `;
}

/**
 * Compatibility function for selection resolution (used by ui.js and tests)
 */
export function selectionForOv2Exchange(exchangeId, models) {
  const { model } = resolveDodafProduct(models, "ov2");
  const exchange = (model.exchanges || []).find((item) => item.id === exchangeId);
  if (!exchange) return null;
  return {
    id: exchange.id,
    kind: "ov2-exchange",
    title: `${exchange.sourceNodeLabel || exchange.sourceNodeId} -> ${exchange.targetNodeLabel || exchange.targetNodeId}`,
    status: "OV-2 Needline",
    text: "DoDAF 2.02 可编辑交换产品；保存后写入项目仓储。",
    facts: [
      ["交换内容", exchange.label],
      ["交换类型", exchange.flowType],
      ["发送兵力", exchange.sourceForceRef || exchange.sourceNodeLabel],
      ["接收兵力", exchange.targetForceRef || exchange.targetNodeLabel],
      ["关联任务", (exchange.taskRefs || []).join("、") || "未关联"],
      ["来源活动", exchange.sourceActivityTitle],
      ["接收活动", exchange.targetActivityTitle]
    ],
    refs: [
      exchange.sourceForceRef,
      exchange.targetForceRef,
      ...(exchange.taskRefs || []),
      exchange.sourceActivityId,
      exchange.targetActivityId
    ].filter(Boolean)
  };
}
