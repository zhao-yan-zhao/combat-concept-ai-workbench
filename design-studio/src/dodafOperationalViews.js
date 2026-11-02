import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderDerivedViewProvenance } from "./derivedViewProvenance.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { renderDodafLegend, renderEdgeBadge, renderEntityBadge } from "./dodafDraftingView.js";
import { renderRuleLibrary } from "./ruleLibraryView.js";
import { renderOv6bPage } from "./stateMachineView.js";
import { getOv5aTemplates } from "./ov5aTemplates.js";

function escape(value) { return String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])); }
function diagnostics(items) { return `<div class="dodaf-checks">${(items || []).map((item) => `<div class="${item.state}"><b>${escape(item.statusLabel || item.state)}</b><span>${escape(item.label)}</span><small>${escape(item.detail)}</small></div>`).join("")}</div>`; }
function actions(resourceKey) {
  const extra = resourceKey === "ov5a"
    ? `<button type="button" class="ghost-btn" data-action="ov5a-open-add-activity" title="新增一个顶层根作战活动">➕ 新增顶层活动</button>
       <button type="button" class="ghost-btn" data-action="ov5a-ai-decompose-all" title="根据概念简报与任务目标，由 AI 体系化纵向分解作战活动">🤖 AI 体系化分解</button>
       <button type="button" class="ghost-btn" data-action="ov5a-open-template-picker" title="选择军事经典作战范式模板一键构建">⚡ 经典范式快速构建</button>
       <button type="button" class="ghost-btn" data-action="ov5a-auto-organize" title="修复断链引用，自动规整层级">🧹 自动规整层级</button>
       <button type="button" class="ghost-btn" data-action="sync-ov5a-from-ov5b">从作战活动同步</button>
       <button type="button" class="ghost-btn" data-action="sync-ov5b-from-ov5a">应用父子关系</button>`
    : "";
  return `<div class="toolbar-row dodaf-product-actions">
    <button type="button" class="ghost-btn" data-action="seed-dodaf-${resourceKey}">从上游重新种子</button>
    <button type="button" class="primary-btn" data-action="save-dodaf-${resourceKey}">保存产品</button>
    ${extra}
  </div>`;
}

function calculateOv5aMetrics(activities, decompositions, parentByChild, rows) {
  const totalCount = activities.length;
  const rootCount = rows.filter((r) => !r.parentRef || r.broken).length;
  const childrenSet = new Set(decompositions.map((d) => d.parentActivityRef));
  const leafCount = rows.filter((r) => !childrenSet.has(r.id)).length;
  const maxDepth = rows.length ? Math.max(...rows.map((r) => r.depth)) + 1 : 1;
  const brokenCount = rows.filter((r) => r.broken).length;

  const autonomyStats = { hitl: 0, hotl: 0, hootl: 0 };
  const domainStats = new Map();
  activities.forEach((act) => {
    const auto = String(act.autonomy || "HOTL").toLowerCase();
    if (auto === "hitl") autonomyStats.hitl += 1;
    else if (auto === "hootl") autonomyStats.hootl += 1;
    else autonomyStats.hotl += 1;

    const domain = act.domain || "综合";
    domainStats.set(domain, (domainStats.get(domain) || 0) + 1);
  });

  let healthScore = 100;
  if (brokenCount > 0) healthScore -= brokenCount * 15;
  if (maxDepth > 4) healthScore -= 10;
  if (rootCount > 4 && totalCount > 6) healthScore -= 10;
  healthScore = Math.max(30, Math.min(100, healthScore));

  return {
    totalCount,
    rootCount,
    leafCount,
    maxDepth,
    brokenCount,
    autonomyStats,
    domainCount: domainStats.size,
    healthScore
  };
}

function renderOv5aMetricsStrip(metrics) {
  const scoreClass = metrics.healthScore >= 80 ? "ready" : metrics.healthScore >= 60 ? "review" : "danger";
  return `
    <div class="ov5a-metrics-strip">
      <div class="metrics-chip score ${scoreClass}">
        <strong>${metrics.healthScore} 分</strong>
        <small>分解健康度</small>
      </div>
      <div class="metrics-chip">
        <strong>${metrics.totalCount} 项</strong>
        <small>作战活动总量</small>
      </div>
      <div class="metrics-chip">
        <strong>${metrics.rootCount} 顶层 / ${metrics.leafCount} 末端</strong>
        <small>树状纵深分布</small>
      </div>
      <div class="metrics-chip">
        <strong>${metrics.maxDepth} 级树深</strong>
        <small>${metrics.maxDepth <= 4 ? "深度适中 (推荐2-4层)" : "链路较深 (警惕指挥跨度)"}</small>
      </div>
      <div class="metrics-chip">
        <strong>H:${metrics.autonomyStats.hitl} / O:${metrics.autonomyStats.hotl} / X:${metrics.autonomyStats.hootl}</strong>
        <small>自主权阶梯分配</small>
      </div>
      ${metrics.brokenCount > 0 ? `
        <div class="metrics-chip danger">
          <strong>⚠️ ${metrics.brokenCount} 处失效</strong>
          <small>存在孤立断链引用</small>
        </div>
      ` : `
        <div class="metrics-chip clean">
          <strong>✓ 契约完整</strong>
          <small>无孤立或循环引用</small>
        </div>
      `}
    </div>
  `;
}

function matchesOv5aFilter(row, filter = {}) {
  if (!filter) return true;
  const { query, domain, autonomy, level } = filter;
  const act = row.activity || {};
  if (domain && (act.domain || "综合") !== domain) return false;
  if (autonomy && String(act.autonomy || "HOTL").toUpperCase() !== autonomy.toUpperCase()) return false;
  if (level === "root" && row.depth !== 0) return false;
  if (level === "mid" && (row.depth === 0 || row.isLeaf)) return false;
  if (level === "leaf" && !row.isLeaf) return false;
  if (query) {
    const q = query.toLowerCase();
    const match = [act.title, act.type, act.domain, act.performer, act.resources, act.timingWindow, act.input, act.output, act.text, row.id].filter(Boolean).some((val) => String(val).toLowerCase().includes(q));
    if (!match) return false;
  }
  return true;
}

function renderOv5aFilterBar(filter = {}, counts = { total: 0, matched: 0 }) {
  const domains = [
    { key: "", label: "全部域" },
    { key: "太空", label: "太空" },
    { key: "空中", label: "空中" },
    { key: "地面", label: "地面" },
    { key: "水面", label: "水面" },
    { key: "水下", label: "水下" },
    { key: "电磁", label: "电磁" },
    { key: "网络", label: "网络" },
    { key: "综合", label: "综合" }
  ];
  const autonomies = [
    { key: "", label: "全部自主度" },
    { key: "HITL", label: "HITL 协同" },
    { key: "HOTL", label: "HOTL 监督" },
    { key: "HOOTL", label: "HOOTL 自主" }
  ];

  const hasFilter = Boolean(filter.query || filter.domain || filter.autonomy || filter.level);

  return `
    <div class="ov5a-filter-bar">
      <div class="ov5a-search-box">
        <span class="search-icon">🔍</span>
        <input type="search" class="ov5a-search-input" placeholder="输入名称、执行主体、输入输出或关键字筛选..." value="${escape(filter.query || "")}" data-action="ov5a-filter-query" aria-label="搜索活动">
        ${filter.query ? `<button type="button" class="clear-search-btn" data-action="ov5a-filter-clear-query" title="清除关键字">✕</button>` : ""}
      </div>
      <div class="ov5a-filter-groups">
        <div class="ov5a-filter-group">
          <span class="filter-group-label">作战域:</span>
          ${domains.map((d) => `<button type="button" class="filter-pill ${filter.domain === d.key ? "active" : ""}" data-action="ov5a-filter-domain" data-domain="${d.key}">${d.label}</button>`).join("")}
        </div>
        <div class="ov5a-filter-group">
          <span class="filter-group-label">自主度:</span>
          ${autonomies.map((a) => `<button type="button" class="filter-pill ${filter.autonomy === a.key ? "active" : ""}" data-action="ov5a-filter-autonomy" data-autonomy="${a.key}">${a.label}</button>`).join("")}
        </div>
        <div class="ov5a-filter-group">
          <span class="filter-group-label">层级:</span>
          <button type="button" class="filter-pill ${!filter.level ? "active" : ""}" data-action="ov5a-filter-level" data-level="">全部</button>
          <button type="button" class="filter-pill ${filter.level === "root" ? "active" : ""}" data-action="ov5a-filter-level" data-level="root">顶层 (L1)</button>
          <button type="button" class="filter-pill ${filter.level === "mid" ? "active" : ""}" data-action="ov5a-filter-level" data-level="mid">进阶 (L2+)</button>
          <button type="button" class="filter-pill ${filter.level === "leaf" ? "active" : ""}" data-action="ov5a-filter-level" data-level="leaf">末端执行</button>
        </div>
        ${hasFilter ? `
          <div class="ov5a-filter-status">
            <span class="filter-count-badge">匹配 <strong>${counts.matched}</strong> / ${counts.total}</span>
            <button type="button" class="filter-reset-link" data-action="ov5a-filter-clear">重置条件</button>
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

function renderOv5aDecompositionList(model, activities = [], editable = false, viewMode = "diagram", options = {}) {
  const { filter = {}, selectedActivityId = null, pregenerating = false } = options;
  const activityById = new Map((activities || []).map((activity) => [String(activity.id), activity]));
  const parentByChild = new Map((model.decompositions || []).map((item) => [item.childActivityRef, item.parentActivityRef]));
  const refs = new Set([...activityById.keys(), ...(model.decompositions || []).flatMap((item) => [item.parentActivityRef, item.childActivityRef])]);
  const childrenSet = new Set((model.decompositions || []).map((item) => item.parentActivityRef));

  const allRows = [...refs].map((id) => {
    const activity = activityById.get(id);
    const parentRef = parentByChild.get(id) || "";
    return {
      id,
      activity,
      parentRef,
      isLeaf: !childrenSet.has(id),
      depth: decompositionDepth(id, parentByChild),
      broken: !activity || Boolean(parentRef && !activityById.has(parentRef))
    };
  }).sort((left, right) => left.depth - right.depth || String(left.activity?.title || left.id).localeCompare(String(right.activity?.title || right.id), "zh-CN"));

  if (!allRows.length) return `<p class="ov5a-empty">尚无可分解活动，请先在 OV5b 建立作战活动或使用上方「⚡ 经典范式快速构建」。</p>`;

  const metrics = calculateOv5aMetrics(activities, model.decompositions || [], parentByChild, allRows);
  const matchedRows = allRows.filter((row) => matchesOv5aFilter(row, filter));
  const matchedIds = new Set(matchedRows.map((r) => r.id));

  const diagramHtml = renderOv5aDiagramTree(allRows, activityById, parentByChild, model.decompositions || [], { matchedIds, selectedActivityId });
  const wbsHtml = renderOv5aWbsTree(allRows, activityById, parentByChild, { matchedIds, selectedActivityId });

  return `<div class="ov5a-decomposition-list">
    ${pregenerating ? `
      <div class="rule-form-empty is-pregenerating" role="status" aria-live="polite" style="margin-bottom: 14px;">
        <div class="rule-pregenerate-spinner" aria-hidden="true"></div>
        <h3>正在生成作战活动分解构型 (OV-5a)</h3>
        <p>系统正在解析作战活动网络，自动规整活动层级与 wholePart 组合构型…</p>
        <div class="brief-generate-progress">
          <span class="brief-generate-progress-bar"></span>
          <span class="brief-generate-progress-label">正在派生层级分解树与工序关联…</span>
        </div>
      </div>
    ` : ""}
    ${renderOv5aMetricsStrip(metrics)}
    ${renderOv5aFilterBar(filter, { total: allRows.length, matched: matchedRows.length })}

    <div class="ov5a-decomposition-heading">
      <div class="ov5a-heading-main">
        <h3>活动分解清单</h3>
        <span>${model.decompositions?.length || 0} 条父子层级关系 · ${metrics.maxDepth} 级树深 · 共 ${allRows.length} 项作战活动</span>
      </div>
      <div class="ov5a-view-switch toolbar-pills" role="tablist" aria-label="OV-5a 视图展示模式">
        <button type="button" class="view-pill ${viewMode === "diagram" ? "active" : ""}" data-action="toggle-ov5a-view-mode" data-mode="diagram" title="DoDAF 2.0 / SysML 递归组合构造型图">标准构造型图</button>
        <button type="button" class="view-pill ${viewMode === "wbs" ? "active" : ""}" data-action="toggle-ov5a-view-mode" data-mode="wbs" title="作战工序与 WBS 工作分解结构">WBS 工序树</button>
        <button type="button" class="view-pill ${viewMode === "table" ? "active" : ""}" data-action="toggle-ov5a-view-mode" data-mode="table" title="层级配置与编辑表格">关系配置表</button>
      </div>
    </div>

    ${viewMode === "diagram" ? diagramHtml : viewMode === "wbs" ? wbsHtml : ""}

    <div class="ov5a-decomposition-table-wrap" style="${viewMode === "table" ? "" : "display:none;"}">
      <table class="ov5a-decomposition-table">
        <thead>
          <tr>
            <th>活动实体</th>
            <th>作战域</th>
            <th>自主度</th>
            <th>执行主体</th>
            <th>上级活动 (wholePart)</th>
            <th>层级</th>
            <th>状态</th>
            <th>快速操作</th>
          </tr>
        </thead>
        <tbody>${matchedRows.map((row) => {
          const act = row.activity || {};
          const activityLabel = act.title || row.id;
          const parentLabel = row.parentRef ? (activityById.get(row.parentRef)?.title || row.parentRef) : "（顶层活动）";
          const domain = act.domain || "综合";
          const autonomy = String(act.autonomy || "HOTL").toUpperCase();
          const performer = act.performer || act.resources || "未指定";
          const optionsHtml = [`<option value="">（顶层活动）</option>`]
            .concat([...activityById.values()].filter((item) => String(item.id) !== row.id).map((item) => `<option value="${escape(item.id)}" ${String(item.id) === row.parentRef ? "selected" : ""}>${escape(item.title || item.id)}</option>`))
            .join("");
          const isSelected = row.id === selectedActivityId;
          return `<tr class="${row.broken ? "is-conflict" : ""} ${isSelected ? "is-selected-row" : ""}" data-activity="${escape(row.id)}">
            <td style="--ov5a-depth:${Math.min(row.depth, 8)}">
              <span class="ov5a-level-mark" aria-hidden="true"></span>
              <strong>${escape(activityLabel)}</strong>
              <small>${escape(act.type || row.id)}</small>
            </td>
            <td><span class="ov5a-domain-tag">${escape(domain)}</span></td>
            <td><span class="ov5a-autonomy-pill ${autonomy.toLowerCase()}">${autonomy}</span></td>
            <td><span class="ov5a-table-performer">${escape(performer)}</span></td>
            <td>${editable && row.activity ? `<select data-dodaf-field="ov5a.decomposition.${escape(row.id)}.parentActivityRef" aria-label="${escape(activityLabel)}的上级活动">${optionsHtml}</select>` : `<span>${escape(parentLabel)}</span>`}</td>
            <td><span class="ov5a-depth-badge">L${row.depth + 1}</span></td>
            <td><span class="status-tag ${row.broken ? "review" : ""}">${row.broken ? "引用失效" : row.parentRef ? "已分解" : "顶层"}</span></td>
            <td>
              <div class="ov5a-table-actions">
                <button type="button" class="mini-btn" data-action="select-ov5a-activity" data-activity-id="${escape(row.id)}" title="查看并编辑详情">✏️ 检视</button>
                <button type="button" class="mini-btn" data-action="ov5a-open-add-child" data-parent-id="${escape(row.id)}" title="添加子活动">➕ 增子</button>
                <button type="button" class="mini-btn" data-action="ov5a-ai-decompose-node" data-activity-id="${escape(row.id)}" title="AI 分解">🤖 AI</button>
                <button type="button" class="mini-btn danger" data-action="ov5a-delete-activity" data-activity-id="${escape(row.id)}" title="删除活动">🗑️</button>
              </div>
            </td>
          </tr>`;
        }).join("")}</tbody>
      </table>
    </div>
  </div>`;
}

function renderOv5aCardActionBar(row, act) {
  const isRoot = !row.parentRef;
  return `
    <div class="ov5a-card-action-bar" onclick="event.stopPropagation()">
      <button type="button" class="ov5a-card-btn" data-action="select-ov5a-activity" data-activity-id="${escape(row.id)}" title="检视与编辑属性">✏️ 检视</button>
      <button type="button" class="ov5a-card-btn" data-action="ov5a-open-add-child" data-parent-id="${escape(row.id)}" title="添加下级子活动">➕ 增子</button>
      <button type="button" class="ov5a-card-btn" data-action="ov5a-ai-decompose-node" data-activity-id="${escape(row.id)}" title="AI 认知智能分解">🤖 AI</button>
      <button type="button" class="ov5a-card-btn" data-action="ov5a-open-template-picker" data-target-id="${escape(row.id)}" title="应用经典范式模板">⚡ 模板</button>
      ${!isRoot ? `<button type="button" class="ov5a-card-btn" data-action="ov5a-promote-root" data-activity-id="${escape(row.id)}" title="提升为顶层活动">⬆️ 顶层</button>` : ""}
      <button type="button" class="ov5a-card-btn danger" data-action="ov5a-delete-activity" data-activity-id="${escape(row.id)}" title="删除此作战活动">🗑️</button>
    </div>
  `;
}

function renderOv5aDiagramTree(rows, activityById, parentByChild, decompositions, options = {}) {
  const { matchedIds = null, selectedActivityId = null } = options;
  const childrenByParent = new Map();
  rows.forEach((row) => {
    const p = row.parentRef || "__root__";
    if (!childrenByParent.has(p)) childrenByParent.set(p, []);
    childrenByParent.get(p).push(row);
  });

  const rootRows = childrenByParent.get("__root__") || [];

  return `
    <div class="ov5a-uml-diagram-canvas" aria-label="DoDAF 2.0 OV-5a 操作活动分解树">
      <div class="ov5a-uml-tree-container">
        ${rootRows.map((rootRow) => renderOv5aRecursiveBranch(rootRow, childrenByParent, activityById, 0, { matchedIds, selectedActivityId })).join("")}
      </div>
    </div>
  `;
}

function renderOv5aRecursiveBranch(row, childrenByParent, activityById, depth = 0, options = {}) {
  const { matchedIds = null, selectedActivityId = null } = options;
  const children = childrenByParent.get(row.id) || [];
  const act = row.activity || {};
  const label = act.title || row.id;
  const performer = act.performer || act.resources || act.role || act.node || "";
  const domain = act.domain || "综合";
  const autonomy = String(act.autonomy || "HOTL").toUpperCase();
  const timing = act.timingWindow || act.duration || "";
  const isRoot = depth === 0;
  const isLeaf = children.length === 0;
  const isStandard = String(act.type || "").includes("standard") || String(act.type || "").includes("标准");
  const stereotype = isStandard ? "«StandardOperationalActivity»" : "«OperationalActivity»";
  const isSelected = row.id === selectedActivityId;
  const isDimmed = matchedIds && !matchedIds.has(row.id);

  return `
    <div class="ov5a-uml-branch depth-${depth} ${isRoot ? "root-branch" : ""}">
      <div class="ov5a-uml-node-wrap ${isRoot ? "root-wrap" : ""}">
        <div class="ov5a-uml-card ${isRoot ? "root-card" : isLeaf ? "leaf-card" : "mid-card"} ${row.broken ? "broken" : ""} ${isSelected ? "is-selected" : ""} ${isDimmed ? "is-dimmed" : ""}" data-activity="${escape(row.id)}" data-action="select-ov5a-activity" data-activity-id="${escape(row.id)}" title="${escape(act.text || label)} (点击检视详情)">
          <div class="ov5a-card-topline">
            <span class="ov5a-domain-tag">${escape(domain)}</span>
            <span class="ov5a-autonomy-pill ${autonomy.toLowerCase()}">${autonomy}</span>
            ${timing ? `<span class="ov5a-timing-tag">${escape(timing)}</span>` : ""}
          </div>
          <div class="ov5a-uml-stereotype">${escape(stereotype)}</div>
          <div class="ov5a-uml-title">${escape(label)}</div>
          ${performer ? `
            <div class="ov5a-uml-performer-tag">
              <span class="performer-rel-label">Performs</span>
              <span class="performer-badge">«Node» ${escape(performer)}</span>
            </div>
          ` : ""}
          ${act.sourceTaskId ? `
            <div class="ov5a-task-trace">任务: ${escape(act.sourceTaskId)}</div>
          ` : ""}
          ${renderOv5aCardActionBar(row, act)}
        </div>
      </div>

      ${children.length > 0 ? `
        <div class="ov5a-uml-connector-tree">
          <div class="ov5a-uml-diamond" title="Composition (wholePart)"></div>
          <div class="ov5a-uml-stem"></div>
          <div class="ov5a-uml-bar" style="--branch-count:${children.length};"></div>
        </div>

        <div class="ov5a-uml-children-row">
          ${children.map((childRow) => `
            <div class="ov5a-uml-child-col">
              <div class="ov5a-uml-branch-line"></div>
              ${renderOv5aRecursiveBranch(childRow, childrenByParent, activityById, depth + 1, options)}
            </div>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function renderOv5aWbsTree(rows, activityById, parentByChild, options = {}) {
  const { matchedIds = null, selectedActivityId = null } = options;
  const childrenByParent = new Map();
  rows.forEach((row) => {
    const p = row.parentRef || "__root__";
    if (!childrenByParent.has(p)) childrenByParent.set(p, []);
    childrenByParent.get(p).push(row);
  });

  const rootRows = childrenByParent.get("__root__") || [];

  let counter = 1;
  function renderWbsNode(row, prefix = "", depth = 0) {
    const act = row.activity || {};
    const label = act.title || row.id;
    const children = childrenByParent.get(row.id) || [];
    const performer = act.performer || act.resources || "主体未指定";
    const domain = act.domain || "综合";
    const autonomy = String(act.autonomy || "HOTL").toUpperCase();
    const isLeaf = children.length === 0;
    const isSelected = row.id === selectedActivityId;
    const isDimmed = matchedIds && !matchedIds.has(row.id);

    return `
      <div class="ov5a-wbs-node depth-${depth}" style="--wbs-depth: ${depth};">
        <div class="wbs-node-card ${depth === 0 ? "is-root" : isLeaf ? "is-leaf" : ""} ${isSelected ? "is-selected" : ""} ${isDimmed ? "is-dimmed" : ""}" data-activity="${escape(row.id)}" data-action="select-ov5a-activity" data-activity-id="${escape(row.id)}">
          <div class="wbs-node-head">
            <span class="wbs-code">${prefix}</span>
            <strong class="wbs-title">${escape(label)}</strong>
            <span class="ov5a-domain-tag">${escape(domain)}</span>
            <span class="ov5a-autonomy-pill ${autonomy.toLowerCase()}">${autonomy}</span>
            <span class="wbs-leaf-tag">${isLeaf ? "🎯 末端执行动作" : `📂 包含 ${children.length} 项分解动作`}</span>
          </div>
          <div class="wbs-node-meta">
            <span>主体: ${escape(performer)}</span>
            ${act.timingWindow ? `<span>时限: ${escape(act.timingWindow)}</span>` : ""}
            ${act.input ? `<span title="输入: ${escape(act.input)}">入: ${escape(act.input)}</span>` : ""}
            ${act.output ? `<span title="输出: ${escape(act.output)}">出: ${escape(act.output)}</span>` : ""}
          </div>
          ${renderOv5aCardActionBar(row, act)}
        </div>
        ${children.length > 0 ? `
          <div class="wbs-children-wrap">
            ${children.map((c, i) => renderWbsNode(c, `${prefix}.${i + 1}`, depth + 1)).join("")}
          </div>
        ` : ""}
      </div>
    `;
  }

  return `
    <div class="ov5a-wbs-workspace" aria-label="WBS 作战工作分解结构">
      ${rootRows.map((root) => {
        const itemHtml = renderWbsNode(root, `${counter}.0`, 0);
        counter += 1;
        return itemHtml;
      }).join("")}
    </div>
  `;
}

function decompositionDepth(id, parentByChild) {
  const seen = new Set([id]);
  let current = parentByChild.get(id) || "";
  let depth = 0;
  while (current && !seen.has(current) && depth < 12) {
    seen.add(current);
    depth += 1;
    current = parentByChild.get(current) || "";
  }
  return depth;
}

function renderOv5aInspectorDrawer(selectedId, activities = [], decompositions = []) {
  if (!selectedId) return "";
  const act = activities.find((a) => String(a.id) === String(selectedId)) || { id: selectedId, title: selectedId };
  const decomp = decompositions.find((d) => String(d.childActivityRef) === String(selectedId));
  const currentParentRef = decomp?.parentActivityRef || act.parentId || "";
  const domain = act.domain || "综合";
  const autonomy = String(act.autonomy || "HOTL").toUpperCase();

  const domains = [
    { key: "太空", label: "太空" },
    { key: "空中", label: "空中" },
    { key: "地面", label: "地面" },
    { key: "水面", label: "水面" },
    { key: "水下", label: "水下" },
    { key: "电磁", label: "电磁" },
    { key: "网络", label: "网络" },
    { key: "综合", label: "综合" }
  ];

  return `
    <aside class="ov5a-inspector-drawer" aria-label="作战活动属性检视抽屉">
      <div class="ov5a-drawer-header">
        <div>
          <span class="ov5a-drawer-kicker">«OperationalActivity» 属性检视</span>
          <h3 class="ov5a-drawer-title">${escape(act.title || selectedId)}</h3>
        </div>
        <button type="button" class="drawer-close-btn" data-action="close-ov5a-inspector" title="关闭检视抽屉">✕</button>
      </div>

      <div class="ov5a-drawer-content">
        <input type="hidden" id="ov5a-inspect-id" value="${escape(selectedId)}">

        <div class="form-row">
          <label for="ov5a-inspect-title">活动规范名称 <span class="required">*</span></label>
          <input type="text" id="ov5a-inspect-title" value="${escape(act.title || "")}" class="text-input" placeholder="输入规范作战活动名称">
        </div>

        <div class="form-row-grid">
          <div class="form-row">
            <label for="ov5a-inspect-domain">作战域 (Domain)</label>
            <select id="ov5a-inspect-domain" class="select-input">
              ${domains.map((d) => `<option value="${d.key}" ${domain === d.key ? "selected" : ""}>${d.label}</option>`).join("")}
            </select>
          </div>
          <div class="form-row">
            <label for="ov5a-inspect-autonomy">自主度分级 (Autonomy)</label>
            <select id="ov5a-inspect-autonomy" class="select-input">
              <option value="HITL" ${autonomy === "HITL" ? "selected" : ""}>HITL (人机协同/人在回路)</option>
              <option value="HOTL" ${autonomy === "HOTL" ? "selected" : ""}>HOTL (人在环上/监督赋能)</option>
              <option value="HOOTL" ${autonomy === "HOOTL" ? "selected" : ""}>HOOTL (人在环外/全自主)</option>
            </select>
          </div>
        </div>

        <div class="form-row-grid">
          <div class="form-row">
            <label for="ov5a-inspect-performer">执行主体 / 装备 (Performer)</label>
            <input type="text" id="ov5a-inspect-performer" value="${escape(act.performer || act.resources || "")}" placeholder="如：联合战区指控中心、歼-20编组" class="text-input">
          </div>
          <div class="form-row">
            <label for="ov5a-inspect-timing">时效窗口 (Timing Window)</label>
            <input type="text" id="ov5a-inspect-timing" value="${escape(act.timingWindow || act.duration || "")}" placeholder="如：3m、持续、T+15m" class="text-input">
          </div>
        </div>

        <div class="form-row">
          <label for="ov5a-inspect-parent">上级活动 (wholePart 组合构造型)</label>
          <select id="ov5a-inspect-parent" class="select-input">
            <option value="">（作为顶层活动 Root）</option>
            ${activities.filter((a) => String(a.id) !== String(selectedId)).map((a) => `<option value="${escape(a.id)}" ${String(a.id) === currentParentRef ? "selected" : ""}>${escape(a.title || a.id)}</option>`).join("")}
          </select>
        </div>

        <div class="form-row">
          <label for="ov5a-inspect-input">输入数据契约 / 触发前置条件 (Input)</label>
          <textarea id="ov5a-inspect-input" rows="2" class="textarea-input" placeholder="输入数据、协同信号或触发事件">${escape(act.input || "")}</textarea>
        </div>

        <div class="form-row">
          <label for="ov5a-inspect-output">产出数据契约 / 后道交付物 (Output)</label>
          <textarea id="ov5a-inspect-output" rows="2" class="textarea-input" placeholder="交付物、控制指令或后道活动输入">${escape(act.output || "")}</textarea>
        </div>

        <div class="form-row">
          <label for="ov5a-inspect-text">活动机理与战术协同说明 (Rules & Description)</label>
          <textarea id="ov5a-inspect-text" rows="3" class="textarea-input" placeholder="详细说明战术动作机理、协同规则与约束">${escape(act.text || "")}</textarea>
        </div>
      </div>

      <div class="ov5a-drawer-footer">
        <button type="button" class="primary-btn" data-action="ov5a-save-activity-edit">💾 保存活动变更</button>
        <button type="button" class="ghost-btn" data-action="ov5a-ai-decompose-node" data-activity-id="${escape(selectedId)}" title="由 AI 纵向细化此活动">🤖 AI 细化分解</button>
        <button type="button" class="ghost-btn" data-action="ov5a-open-template-picker" data-target-id="${escape(selectedId)}" title="在此活动下注入范式模板">⚡ 范式分解</button>
        <button type="button" class="danger-btn" data-action="ov5a-delete-activity" data-activity-id="${escape(selectedId)}">🗑️ 删除活动</button>
      </div>
    </aside>
  `;
}

function renderOv5aModals(state = {}) {
  const modal = state.ov5aModal;
  const ctx = state.ov5aModalContext || {};
  if (!modal) return "";

  const activities = state.ov5?.activities || [];

  if (modal === "add-activity") {
    const parentId = ctx.parentId || "";
    const parentAct = activities.find((a) => String(a.id) === String(parentId));
    const titlePrompt = parentAct ? `在「${parentAct.title}」下添加子活动` : "新增顶层根作战活动";

    return `
      <div class="modal-backdrop ov5a-modal-backdrop" role="dialog" aria-modal="true" aria-label="${escape(titlePrompt)}">
        <div class="modal-card ov5a-modal-card">
          <div class="modal-header">
            <h3>➕ ${escape(titlePrompt)}</h3>
            <button type="button" class="close-btn" data-action="ov5a-close-modal">✕</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="ov5a-add-parent" value="${escape(parentId)}">
            <div class="form-row">
              <label for="ov5a-add-title">活动名称 <span class="required">*</span></label>
              <input type="text" id="ov5a-add-title" class="text-input" placeholder="例如：防区外高精度电磁协同压制" autofocus>
            </div>
            <div class="form-row-grid">
              <div class="form-row">
                <label for="ov5a-add-domain">作战域</label>
                <select id="ov5a-add-domain" class="select-input">
                  <option value="综合">综合</option>
                  <option value="太空">太空</option>
                  <option value="空中">空中</option>
                  <option value="地面">地面</option>
                  <option value="水面">水面</option>
                  <option value="水下">水下</option>
                  <option value="电磁">电磁</option>
                  <option value="网络">网络</option>
                </select>
              </div>
              <div class="form-row">
                <label for="ov5a-add-autonomy">自主度</label>
                <select id="ov5a-add-autonomy" class="select-input">
                  <option value="HITL">HITL (人机协同)</option>
                  <option value="HOTL" selected>HOTL (人在环上)</option>
                  <option value="HOOTL">HOOTL (人在环外/全自主)</option>
                </select>
              </div>
            </div>
            <div class="form-row-grid">
              <div class="form-row">
                <label for="ov5a-add-performer">执行主体 / 装备</label>
                <input type="text" id="ov5a-add-performer" class="text-input" placeholder="例如：电子战无人机集群">
              </div>
              <div class="form-row">
                <label for="ov5a-add-timing">时效窗口</label>
                <input type="text" id="ov5a-add-timing" class="text-input" placeholder="例如：5m、持续、实时">
              </div>
            </div>
            <div class="form-row">
              <label for="ov5a-add-input">输入前置条件</label>
              <input type="text" id="ov5a-add-input" class="text-input" placeholder="例如：雷达威胁编目与目标方位角">
            </div>
            <div class="form-row">
              <label for="ov5a-add-output">产出交付契约</label>
              <input type="text" id="ov5a-add-output" class="text-input" placeholder="例如：低可探测突防安全走廊与压制信号">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="ghost-btn" data-action="ov5a-close-modal">取消</button>
            <button type="button" class="primary-btn" data-action="ov5a-submit-add-activity">确定新增</button>
          </div>
        </div>
      </div>
    `;
  }

  if (modal === "template-picker") {
    const targetId = ctx.targetId || "";
    const targetAct = activities.find((a) => String(a.id) === String(targetId));
    const templates = getOv5aTemplates();

    return `
      <div class="modal-backdrop ov5a-modal-backdrop" role="dialog" aria-modal="true" aria-label="经典作战范式模板库">
        <div class="modal-card ov5a-template-modal">
          <div class="modal-header">
            <div>
              <h3>⚡ 经典作战范式模板库 (DoDAF OV-5a)</h3>
              <p class="modal-subtitle">
                ${targetAct ? `当前目标：为「<strong>${escape(targetAct.title)}</strong>」注入纵向子步骤分解` : "快速基于经典军事行动闭环范式构建活动体系"}
              </p>
            </div>
            <button type="button" class="close-btn" data-action="ov5a-close-modal">✕</button>
          </div>
          <div class="modal-body ov5a-template-grid">
            ${templates.map((tpl) => `
              <div class="ov5a-template-card">
                <div class="tpl-card-head">
                  <span class="tpl-badge">${escape(tpl.badge)}</span>
                  <span class="tpl-domain">${escape(tpl.domain)}</span>
                  <h4>${escape(tpl.name)}</h4>
                </div>
                <p class="tpl-desc">${escape(tpl.description)}</p>
                <div class="tpl-steps-preview">
                  <span class="steps-label">包含 ${tpl.steps.length} 个标准化动作:</span>
                  <ol class="tpl-steps-list">
                    ${tpl.steps.map((s) => `<li><strong>${escape(s.title)}</strong> <small>(${escape(s.autonomy)})</small></li>`).join("")}
                  </ol>
                </div>
                <div class="tpl-card-actions">
                  ${targetId ? `
                    <button type="button" class="primary-btn mini-btn" data-action="ov5a-apply-template" data-template-id="${escape(tpl.id)}" data-target-id="${escape(targetId)}">
                      ⚡ 注入为「${escape(targetAct?.title || "此活动")}」子分解
                    </button>
                  ` : `
                    <button type="button" class="primary-btn mini-btn" data-action="ov5a-apply-template" data-template-id="${escape(tpl.id)}">
                      🌐 替换/初始化全流程活动
                    </button>
                  `}
                </div>
              </div>
            `).join("")}
          </div>
          <div class="modal-footer">
            <button type="button" class="ghost-btn" data-action="ov5a-close-modal">关闭</button>
          </div>
        </div>
      </div>
    `;
  }

  return "";
}

export function renderOv5a(stateOrModel) {
  const isState = stateOrModel && (stateOrModel.ov5 || stateOrModel.activeView);
  const resolved = isState ? resolveDodafProduct(stateOrModel, "ov5a") : { model: stateOrModel, source: "legacy" };
  const model = resolved.model;
  const storage = isState ? (stateOrModel.ov5aStorage || {}) : null;
  const activities = isState ? (stateOrModel.ov5?.activities || []) : [];
  const viewMode = (isState && stateOrModel.ov5aViewMode) || "diagram";
  const filter = (isState && stateOrModel.ov5aFilter) || {};
  const selectedActivityId = (isState && stateOrModel.ov5aSelectedActivityId) || null;

  return `
    <section class="surface surface-pad dodaf-drafting-surface ov5a-workbench-surface" data-dodaf-product="OV-5a">
      <div class="section-heading">
        <div>
          <h2>作战活动分解</h2>
          <p>DoDAF 2.02 / DM2 Activity 分解（wholePart）。本产品只保存父子活动引用，活动正文由 OV5b 维护。</p>
        </div>
        <span class="mini-tag">${resolved.source === "persisted" ? "已持久化" : "种子/草稿"} · 层级清单</span>
      </div>
      ${renderDerivedViewProvenance("ov5a")}
      ${storage ? renderProjectStorageState(storage, { refreshAction: "refresh-project-ov5a" }) : ""}
      ${isState ? actions("ov5a") : ""}
      ${renderDodafLegend("OV-5a")}
      <div class="ov5a-workspace-layout ${selectedActivityId ? "has-inspector" : ""}">
        <div class="ov5a-main-canvas">
          ${renderOv5aDecompositionList(model, activities, isState, viewMode, { filter, selectedActivityId, pregenerating: Boolean(isState && stateOrModel.ov5aPregenerating) })}
        </div>
        ${selectedActivityId ? renderOv5aInspectorDrawer(selectedActivityId, activities, model.decompositions || []) : ""}
      </div>
      ${diagnostics(model.diagnostics)}
      ${isState ? renderOv5aModals(stateOrModel) : ""}
    </section>
  `;
}

/** 规则库研究台（左列表 + 右编辑；建库态 / 绑定校验态）。 */
export function renderOv6a(stateOrModel) {
  // Acceptance fixtures may pass a bare product model; wrap into page state.
  if (stateOrModel && !stateOrModel.activeView && (stateOrModel.rules || stateOrModel.product === "OV-6a")) {
    return renderRuleLibrary({
      activeView: "ov6a",
      ov6a: stateOrModel,
      ov6aStorage: {},
      phaseAction: stateOrModel.phaseAction,
      phaseActionStorage: stateOrModel.phaseActionStorage,
      ov5: stateOrModel.ov5
    });
  }
  return renderRuleLibrary(stateOrModel || {});
}

export function renderOv6b(stateOrModel) {
  return renderOv6bPage(stateOrModel);
}
