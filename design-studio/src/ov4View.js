import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderProjectStorageActions } from "./projectStorageView.js";
import { resolveOv4SelectedDiagramId } from "./ov4DiagramStore.js";
import { renderToolboxFloatButton, renderToolboxRail } from "./toolbox/index.js";
import { buildOv4ForceFingerprint } from "./ov4Builder.js";
import {
  OV4_ECHELON_CATEGORIES,
  OV4_ORGANIZATION_CATEGORIES,
  OV4_RELATION_CATEGORIES,
  ov4RelationShortLabel,
  ov4RelationStyleKey
} from "../../shared/dodaf/ov4Taxonomy.js";
import { renderForceResourceSubflowBar } from "./forceResourceSubflowNav.js";
import { routeSmFlowEdges } from "./stateMachineFlowRouting.js";

const CARD_WIDTH = 220;
const CARD_HEIGHT = 86;
const HORIZONTAL_GAP = 48;
const VERTICAL_GAP = 92;

export function renderOv4(state) {
  const { model, source } = resolveDodafProduct(state, "ov4");
  const diagrams = diagramsForDisplay(model);
  const selectedId = resolveOv4SelectedDiagramId(state, diagrams);
  const diagram = diagrams.find((item) => item.id === selectedId) || null;
  const scoped = scopeModel(model, diagram);
  const toolsOpen = state.ov4ToolsOpen === true;
  const editorOpen = state.ov4EditorOpen === true;
  const sidebarCollapsed = state.ov4SidebarCollapsed === true;
  const relationFilter = state.ov4RelationFilter || "all";
  const selectedRoleId = state.ov4SelectedRoleId || "";
  const fingerprint = buildOv4ForceFingerprint(state.forceMission);
  const stale = String(model.derivedFrom?.note || "").startsWith("ov4-force:") && model.derivedFrom.note !== fingerprint;
  const statusLabel = stale ? "兵力已更新，待重生成" : source === "persisted" ? "已持久化" : "本地/种子";

  // Check for isolated unconnected roles
  const linkedRoleIds = new Set(scoped.relations.flatMap((r) => [r.sourceRoleId, r.targetRoleId]));
  const unconnectedCount = scoped.roles.filter((r) => !linkedRoleIds.has(r.id)).length;

  return `<section class="ov4-page" data-view-page="organization-relationship" data-dodaf-product="OV-4">
    ${renderForceResourceSubflowBar(state, "ov4")}
    <header class="ov4-top">
      <div class="ov4-bar">
        <div class="ov4-identity">
          <h2>作战组织关系图</h2>
          <small class="ov4-summary ${stale ? "is-review" : ""}">${statusLabel} · ${diagrams.length} 张关系图 · ${model.roles?.length || 0} 个共享角色 · ${model.relations?.length || 0} 条共享关系</small>
        </div>
        <div class="ov4-toolbar">
          ${state.ov4Storage ? renderProjectStorageActions(state.ov4Storage, { refreshAction: "refresh-project-ov4" }) : ""}
          <button type="button" class="quiet-button" data-action="seed-dodaf-ov4" title="重新推导组织角色与协同关系">重新识别</button>
          <button type="button" class="primary-btn" data-action="save-dodaf-ov4">保存关系图</button>
        </div>
      </div>
    </header>
    <div class="ov4-workbench ${sidebarCollapsed ? "is-sidebar-collapsed" : ""} ${toolsOpen ? "is-tools-docked" : ""} ${editorOpen ? "is-editor-open" : ""}">
      ${renderDiagramPanel(diagrams, selectedId, sidebarCollapsed)}
      <main class="ov4-main-panel">
        <header class="ov4-canvas-head">
          <div class="ov4-head-meta">
            ${sidebarCollapsed ? `<button type="button" class="ov4-expand-sidebar-btn" data-action="ov4-toggle-sidebar" title="展开左侧组织关系图列表" aria-label="展开左侧组织关系图列表"><svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h10M3 8h10M3 12h6"></path><path d="M11 10l2 2-2 2"></path></svg>展开列表</button>` : ""}
            <strong>${escapeHtml(diagram?.name || "组织关系图")}</strong>
            <small>点击节点高亮关联链路 · 滚轮缩放 · 空白平移 · 拖动节点微调</small>
          </div>
          <div class="ov4-canvas-legend-wrap">
            <div class="ov4-relation-legend" aria-label="关系图例">
              <span class="ov4-legend-title">图例过滤:</span>
              <button type="button" class="ov4-legend-filter ${relationFilter === "all" ? "is-active" : ""}" data-relation-filter="all" title="查看全部关系">全部</button>
              <button type="button" class="ov4-legend-filter filter-command ${relationFilter === "command" ? "is-active" : ""}" data-relation-filter="command" title="仅查看作战指挥关系"><i class="legend-swatch command"></i>指挥</button>
              <button type="button" class="ov4-legend-filter filter-support ${relationFilter === "support" ? "is-active" : ""}" data-relation-filter="support" title="仅查看支援保障关系"><i class="legend-swatch support"></i>保障</button>
              <button type="button" class="ov4-legend-filter filter-information ${relationFilter === "information" ? "is-active" : ""}" data-relation-filter="information" title="仅查看信息报送关系"><i class="legend-swatch information"></i>上报</button>
              <button type="button" class="ov4-legend-filter filter-coordination ${relationFilter === "coordination" ? "is-active" : ""}" data-relation-filter="coordination" title="仅查看跨域协同关系"><i class="legend-swatch coordination"></i>协同</button>
            </div>
            <span class="ov4-stats-pill">${scoped.roles.length} 角色 · ${scoped.relations.length} 关系</span>
            ${unconnectedCount ? `<span class="ov4-warning-pill" title="检测到 ${unconnectedCount} 个作战单元暂未建立上下级指挥或协同链路">⚠️ ${unconnectedCount} 个单元待联通</span>` : ""}
          </div>
          <div class="ov4-canvas-actions">
            <button type="button" class="sm-canvas-btn sm-canvas-layout" data-ov4-canvas-layout title="自适应排版：按指挥梯队与红蓝对抗阵营智能分层展开" aria-label="自适应排版">
              <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
                <rect x="2" y="2" width="5" height="5" rx="1"></rect>
                <rect x="9" y="2" width="5" height="5" rx="1"></rect>
                <rect x="5.5" y="9" width="5" height="5" rx="1"></rect>
                <path d="M4.5 7v1a1 1 0 0 0 1 1h2m3-2v1a1 1 0 0 1-1 1"></path>
              </svg>
              <span>自适应排版</span>
            </button>
            <button type="button" class="sm-canvas-fit" data-ov4-canvas-fit title="适配全部组织" aria-label="适配全部组织">⌖</button>
          </div>
        </header>
        ${renderOrganizationCanvas(scoped, diagram, { selectedRoleId, relationFilter })}
      </main>
      ${renderPropertyDock(model, diagram, editorOpen, selectedRoleId)}
      ${toolsOpen ? renderOv4ToolboxRail(editorOpen) : ""}
    </div>
  </section>`;
}

export function renderOv4ToolboxFloatButton({ toolsOpen = false } = {}) {
  return renderToolboxFloatButton({
    scope: "ov4",
    open: toolsOpen,
    action: "toggle-ov4-tools",
    className: "ov1-edit-rail-brand is-topbar-float ov4-toolbox-float"
  });
}

function renderOv4ToolboxRail(editorOpen) {
  return renderToolboxRail({
    scope: "ov4",
    open: true,
    label: "组织关系工具箱",
    navLabel: "组织关系工具",
    className: "sm-edit-rail ov4-edit-rail",
    navClassName: "ov4-edit-rail-nav",
    toggleAction: "toggle-ov4-tools",
    items: [
      { action: "open-subflow-ai", title: "AI 生成组织关系", icon: "sparkle", attention: true },
      "sep",
      { action: "ov4-toggle-editor", title: "组织关系信息", icon: "relations", active: editorOpen, pressed: editorOpen }
    ]
  });
}

function renderDiagramPanel(diagrams, selectedId, sidebarCollapsed = false) {
  return `<aside class="ov4-diagram-panel ${sidebarCollapsed ? "is-collapsed" : ""}" aria-label="组织关系图列表" data-grouped-list-panel="ov4" data-grouped-list-dimensions="完整性:status|关系规模:scale" data-grouped-list-default-group="status">
    <header class="ov4-panel-head">
      <strong>组织关系图</strong>
      <div class="ov4-panel-head-actions">
        <button type="button" class="ov4-panel-btn" data-action="ov4-add-diagram" title="新建组织关系图" aria-label="新建组织关系图">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <path d="M8 2.5v11M2.5 8h11"></path>
          </svg>
        </button>
        <button type="button" class="ov4-panel-btn" data-action="ov4-toggle-sidebar" title="收起左侧列表，最大化画布空间" aria-label="收起左侧列表">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 3.5L5.5 8l4.5 4.5"></path>
          </svg>
        </button>
      </div>
    </header>
    <div class="ov4-diagram-list" role="listbox" data-grouped-list-items>
      ${diagrams.map((diagram) => {
        const relationCount = diagram.relationIds?.length || 0;
        const status = diagram.roleIds?.length && relationCount ? "已建立" : "待补充";
        const scale = relationCount > 5 ? "6 条以上" : relationCount ? "1-5 条" : "暂无关系";
        return `<button type="button" class="ov4-diagram-item ${diagram.id === selectedId ? "is-selected" : ""}" data-action="ov4-select-diagram" data-diagram-id="${escapeHtml(diagram.id)}" role="option" aria-selected="${diagram.id === selectedId}" data-grouped-list-item data-group-status="${status}" data-group-scale="${scale}" data-search="${escapeHtml([diagram.id, diagram.name, diagram.description].filter(Boolean).join(" "))}">
          <strong>${escapeHtml(diagram.name)}</strong>
          <span>${diagram.roleIds?.length || 0} 个角色 · ${relationCount} 条关系</span>
        </button>`;
      }).join("") || `<div class="ov4-panel-empty"><strong>尚无组织关系图</strong><span>点击上方加号新建。</span></div>`}
    </div>
    ${selectedId ? `<footer class="ov4-diagram-footer"><button type="button" class="quiet-button danger" data-action="ov4-remove-diagram" data-diagram-id="${escapeHtml(selectedId)}">删除当前关系图</button></footer>` : ""}
  </aside>`;
}

function renderPropertyDock(model, diagram, open, selectedRoleId = "") {
  if (!open) return `<aside class="ov4-editor-dock is-collapsed" aria-hidden="true"></aside>`;
  if (!diagram) {
    return `<aside class="ov4-editor-dock is-open">
      <header class="ov4-editor-dock-head">
        <strong>组织关系信息</strong>
        <button data-action="ov4-close-editor" aria-label="收起">×</button>
      </header>
      <p class="ov4-panel-empty">请先新建组织关系图。</p>
    </aside>`;
  }
  const roleIds = new Set(diagram.roleIds || []);
  const relationIds = new Set(diagram.relationIds || []);
  const selectedRole = (model.roles || []).find((r) => r.id === selectedRoleId);

  return `<aside class="ov4-editor-dock is-open" aria-label="组织关系信息">
    <header class="ov4-editor-dock-head">
      <div>
        <strong>组织关系信息</strong>
        <small>${selectedRole ? `已选中: ${escapeHtml(selectedRole.label)}` : "当前关系图的配置与组织分类"}</small>
      </div>
      <button type="button" data-action="ov4-close-editor" title="收起" aria-label="收起">×</button>
    </header>
    <div class="ov4-editor-scroll">
      ${selectedRole ? `<section class="ov4-info-section is-focused-role">
        <h3>当前选中单元</h3>
        <div class="ov4-focused-card">
          <strong>${escapeHtml(selectedRole.label)}</strong>
          <p>${escapeHtml(selectedRole.detail || "DoDAF 作战责任单元。")}</p>
          <div class="ov4-focused-meta">
            <span>层级: ${escapeHtml(selectedRole.echelonCategory || "未明确")}</span>
            <span>类别: ${escapeHtml(selectedRole.organizationCategory || "其他")}</span>
          </div>
        </div>
      </section>` : ""}
      <section class="ov4-info-section">
        <label class="ov4-info-field">
          <span>名称</span>
          <input data-action="ov4-diagram-field" data-diagram-id="${escapeHtml(diagram.id)}" data-field="name" value="${escapeHtml(diagram.name)}">
        </label>
        <label class="ov4-info-field">
          <span>说明</span>
          <textarea rows="3" data-action="ov4-diagram-field" data-diagram-id="${escapeHtml(diagram.id)}" data-field="description">${escapeHtml(diagram.description || "")}</textarea>
        </label>
      </section>
      <section class="ov4-info-section">
        <h3>组织分类与层级</h3>
        <div class="ov4-batch-bar">
          <small>批量应用属性（选定或全图）：</small>
          <div class="ov4-batch-controls">
            <select data-action="ov4-batch-echelon" title="为选定角色或全图角色批量应用层级">
              <option value="">批量应用层级...</option>
              ${renderOptions(OV4_ECHELON_CATEGORIES, "")}
            </select>
            <select data-action="ov4-batch-org" title="为选定角色或全图角色批量应用组织类别">
              <option value="">批量应用类别...</option>
              ${renderOptions(OV4_ORGANIZATION_CATEGORIES, "")}
            </select>
          </div>
        </div>
        <div class="ov4-classification-list">
          ${(model.roles || []).map((role) => `<article class="${role.id === selectedRoleId ? "is-selected-row" : ""}">
            <label class="ov4-scope-check">
              <input type="checkbox" data-action="ov4-toggle-diagram-role" data-diagram-id="${escapeHtml(diagram.id)}" data-role-id="${escapeHtml(role.id)}" ${roleIds.has(role.id) ? "checked" : ""}>
              <strong data-action="ov4-select-role" data-role-id="${escapeHtml(role.id)}" title="点击在画布中高亮定位该角色" style="cursor:pointer;">${escapeHtml(role.label)}</strong>
            </label>
            <div>
              <label>
                <span>组织类别</span>
                <select data-action="ov4-role-classification" data-role-id="${escapeHtml(role.id)}" data-field="organizationCategory">
                  ${renderOptions(OV4_ORGANIZATION_CATEGORIES, role.organizationCategory)}
                </select>
              </label>
              <label>
                <span>层级</span>
                <select data-action="ov4-role-classification" data-role-id="${escapeHtml(role.id)}" data-field="echelonCategory">
                  ${renderOptions(OV4_ECHELON_CATEGORIES, role.echelonCategory)}
                </select>
              </label>
            </div>
          </article>`).join("") || `<p class="ov4-panel-empty">尚无共享组织。</p>`}
        </div>
      </section>
      <section class="ov4-info-section">
        <h3>关系分类</h3>
        <div class="ov4-classification-list">
          ${(model.relations || []).map((relation) => `<article>
            <label class="ov4-scope-check">
              <input type="checkbox" data-action="ov4-toggle-diagram-relation" data-diagram-id="${escapeHtml(diagram.id)}" data-relation-id="${escapeHtml(relation.id)}" ${relationIds.has(relation.id) ? "checked" : ""}>
              <strong>${escapeHtml(relation.sourceRoleLabel)} → ${escapeHtml(relation.targetRoleLabel)}</strong>
            </label>
            <label>
              <span>关系类别</span>
              <select data-action="ov4-relation-classification" data-relation-id="${escapeHtml(relation.id)}" data-field="relationshipCategory">
                ${renderOptions(OV4_RELATION_CATEGORIES, relation.relationshipCategory)}
              </select>
            </label>
          </article>`).join("") || `<p class="ov4-panel-empty">尚无共享关系。</p>`}
        </div>
      </section>
      ${renderReviewInformation(model)}
    </div>
  </aside>`;
}

function diagramsForDisplay(model) {
  const diagrams = Array.isArray(model.diagrams) ? model.diagrams : [];
  if (diagrams.some((item) => (item.roleIds || []).length)) return diagrams;
  const roles = model.roles || [];
  if (!roles.length) return diagrams;
  const fallback = diagrams[0] || {};
  return [{
    id: fallback.id || "ov4-diagram-overall",
    name: fallback.name || "总体组织关系图",
    description: fallback.description || "",
    roleIds: roles.map((role) => role.id),
    relationIds: (model.relations || []).map((relation) => relation.id),
    positions: fallback.positions || []
  }];
}

function scopeModel(model, diagram) {
  if (!diagram) return { roles: model.roles || [], relations: model.relations || [] };
  const roleIds = new Set(diagram.roleIds || []);
  const relationIds = new Set(diagram.relationIds || []);
  const roles = (model.roles || []).filter((role) => roleIds.has(role.id));
  const relations = (model.relations || []).filter((relation) => relationIds.has(relation.id) && roleIds.has(relation.sourceRoleId) && roleIds.has(relation.targetRoleId));
  if (roles.length) return { roles, relations };
  return { roles: model.roles || [], relations: model.relations || [] };
}

function renderOrganizationCanvas(model, diagram, { selectedRoleId = "", relationFilter = "all" } = {}) {
  const layout = createRoleLayout(model.roles, model.relations, diagram?.positions || []);
  const worldW = layout.worldWidth;
  const worldH = layout.worldHeight;

  // Build node bounding boxes in percentage coordinates (0-100) for orthogonal router
  const boxes = new Map();
  model.roles.forEach((role) => {
    const pos = layout.positions.get(role.id) || { x: worldW / 2, y: worldH / 2 };
    const centerXPct = (pos.x / worldW) * 100;
    const centerYPct = (pos.y / worldH) * 100;
    const halfWPct = (CARD_WIDTH / 2 / worldW) * 100;
    const halfHPct = (CARD_HEIGHT / 2 / worldH) * 100;

    boxes.set(role.id, {
      id: role.id,
      center: { x: centerXPct, y: centerYPct },
      halfW: Math.max(1.5, halfWPct),
      halfH: Math.max(1.5, halfHPct),
      shape: "rect"
    });
  });

  const edges = model.relations.map((relation) => {
    const category = relation.relationshipCategory || relation.relationshipType;
    const shortLabel = ov4RelationShortLabel(category, relation.relationshipType);
    return {
      id: relation.id,
      sourceId: relation.sourceRoleId,
      targetId: relation.targetRoleId,
      label: shortLabel,
      relationshipCategory: category,
      relationshipType: relation.relationshipType
    };
  });

  const routes = routeSmFlowEdges(edges, boxes);

  // Link Focus calculation
  const hasSelection = Boolean(selectedRoleId);
  const focusedNeighborIds = new Set();
  const focusedEdgeIds = new Set();
  if (hasSelection) {
    focusedNeighborIds.add(selectedRoleId);
    model.relations.forEach((rel) => {
      if (rel.sourceRoleId === selectedRoleId) {
        focusedNeighborIds.add(rel.targetRoleId);
        focusedEdgeIds.add(rel.id);
      } else if (rel.targetRoleId === selectedRoleId) {
        focusedNeighborIds.add(rel.sourceRoleId);
        focusedEdgeIds.add(rel.id);
      }
    });
  }

  const markers = ["subordinate", "command", "control", "admin", "attached", "coordination", "support", "information", "other"].map((key) => {
    return `<marker id="ov4-arrow-${key}" class="relation-${key}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 1 L 9 5 L 0 9 z"/></marker>`;
  }).join("");

  const lines = model.relations.map((relation) => {
    const route = routes.get(relation.id);
    const style = ov4RelationStyleKey(relation.relationshipCategory);
    if (!route) return "";

    const isMatchFilter = relationFilter === "all" || style === relationFilter;
    const isFocused = hasSelection && focusedEdgeIds.has(relation.id);
    const isDimmed = (hasSelection && !isFocused) || !isMatchFilter;

    const classNames = [
      "ov4-org-relation",
      "ov1-concept-edge",
      `relation-${style}`,
      route.backward ? "is-backward" : "",
      isFocused ? "is-focused" : "",
      isDimmed ? "is-dimmed" : "",
      !isMatchFilter ? "is-filtered-out" : ""
    ].filter(Boolean).join(" ");

    return `<path class="ov4-org-relation-hit ov1-concept-edge-hit" data-ov4-edge="${escapeHtml(relation.id)}" data-source-id="${escapeHtml(relation.sourceRoleId)}" data-target-id="${escapeHtml(relation.targetRoleId)}" d="${route.path}" fill="none"/>` +
      `<path class="${classNames}" data-ov4-edge="${escapeHtml(relation.id)}" data-source-id="${escapeHtml(relation.sourceRoleId)}" data-target-id="${escapeHtml(relation.targetRoleId)}" d="${route.path}" marker-end="url(#ov4-arrow-${style})"/>`;
  }).join("");

  const labels = model.relations.map((relation) => {
    const route = routes.get(relation.id);
    const style = ov4RelationStyleKey(relation.relationshipCategory);
    if (!route) return "";
    const shortLabel = ov4RelationShortLabel(relation.relationshipCategory, relation.relationshipType);
    const full = `${relation.sourceRoleLabel} → ${relation.targetRoleLabel}（${relation.relationshipCategory || relation.relationshipType}）`;

    const isMatchFilter = relationFilter === "all" || style === relationFilter;
    const isFocused = hasSelection && focusedEdgeIds.has(relation.id);
    const isDimmed = (hasSelection && !isFocused) || !isMatchFilter;

    const classNames = [
      "ov4-org-relation-label",
      "sm-flow-edge-label",
      `relation-${style}`,
      route.backward ? "is-backward" : "",
      isFocused ? "is-focused" : "",
      isDimmed ? "is-dimmed" : "",
      !isMatchFilter ? "is-filtered-out" : ""
    ].filter(Boolean).join(" ");

    return `<button type="button" class="${classNames}" data-ov4-edge-label="${escapeHtml(relation.id)}" data-source-id="${escapeHtml(relation.sourceRoleId)}" data-target-id="${escapeHtml(relation.targetRoleId)}" style="left:${route.label.x}%;top:${route.label.y}%" title="${escapeHtml(full)}">${escapeHtml(shortLabel)}</button>`;
  }).join("");

  const nodes = model.roles.map((role) => {
    const pos = layout.positions.get(role.id) || { x: worldW / 2, y: worldH / 2 };
    const isSelected = selectedRoleId === role.id;
    const isLinked = hasSelection && !isSelected && focusedNeighborIds.has(role.id);
    const isDimmed = hasSelection && !focusedNeighborIds.has(role.id);

    return renderRoleNodeCard(role, pos, { isSelected, isLinked, isDimmed });
  }).join("");

  const empty = !diagram
    ? `<div class="ov4-org-empty"><strong>尚无组织关系图</strong><span>从左侧新建一张关系图。</span></div>`
    : !model.roles.length
      ? `<div class="ov4-org-empty"><strong>当前关系图为空</strong><span>从右侧工具箱选择需要展示的角色和关系。</span></div>`
      : "";

  return `<div class="ov4-canvas-frame sm-flow-canvas sm-ov1-canvas ov4-camera-canvas ${hasSelection ? "has-selection" : ""}" data-ov4-canvas data-diagram-id="${escapeHtml(diagram?.id || "")}">
    <div class="ov4-canvas-stage sm-flow-stage" data-ov4-stage title="点击卡片高亮关联网络 · 空白平移 · 滚轮缩放">
      <div class="ov4-org-canvas sm-flow-world" data-ov4-world style="width:${worldW}px;height:${worldH}px;" data-world-width="${worldW}" data-world-height="${worldH}">
        <svg class="ov4-org-links sm-flow-lines ov1-concept-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>${markers}</defs>
          ${lines}
        </svg>
        <div class="ov4-flow-edge-label-layer sm-flow-edge-label-layer">${labels}</div>
        ${nodes}
        ${empty}
      </div>
    </div>
  </div>`;
}

function resolveSide(role = {}) {
  const text = `${role.label || ""} ${role.side || ""} ${role.organizationCategory || ""}`.toLowerCase();
  if (/红方|敌方|对手|hostile|opposing/.test(text)) return "red";
  if (/蓝方|我方|友军|friendly/.test(text)) return "blue";
  return "neutral";
}

function cleanRoleLabel(rawLabel = "") {
  // Strips leading "蓝方·" or "红方·" if already displayed in side-badge to keep title clean
  return String(rawLabel).replace(/^(蓝方|红方|友方|敌方)[·\s]/, "").trim() || rawLabel;
}

function renderRoleNodeCard(role, pos, { isSelected = false, isLinked = false, isDimmed = false } = {}) {
  const echelon = escapeHtml(role.echelonCategory || "基础作战单元");
  const category = escapeHtml(role.organizationCategory || "作战力量");
  const rawLabel = role.label || "";
  const displayTitle = escapeHtml(cleanRoleLabel(rawLabel));
  const detail = escapeHtml(role.detail || role.label);
  const isReady = role.state === "ready";
  const taskCount = Array.isArray(role.taskRefs) ? role.taskRefs.length : 0;
  const activityCount = role.activityCount || (Array.isArray(role.activityIds) ? role.activityIds.length : 0);
  const taskSummary = taskCount > 0 ? `${taskCount} 项任务` : activityCount > 0 ? `${activityCount} 项活动` : "作战编成";
  const side = resolveSide(role);
  const sideLabel = side === "red" ? "红方" : side === "blue" ? "蓝方" : "编制";

  const wrapClasses = [
    "ov4-org-node-wrap",
    "sm-flow-node-wrap",
    `side-${side}`,
    isSelected ? "is-selected" : "",
    isLinked ? "is-linked" : "",
    isDimmed ? "is-dimmed" : ""
  ].filter(Boolean).join(" ");

  const cardClasses = [
    "ov4-org-role",
    "sm-flow-node",
    "kind-normal",
    `side-${side}`,
    isReady ? "is-ready" : "is-review",
    isSelected ? "is-selected" : "",
    isLinked ? "is-linked" : ""
  ].filter(Boolean).join(" ");

  return `<div class="${wrapClasses}" data-ov4-node="${escapeHtml(role.id)}" data-logical-x="${pos.x}" data-logical-y="${pos.y}" style="left:${pos.x}px;top:${pos.y}px;">
    <button type="button" class="${cardClasses}" data-ov4-role="${escapeHtml(role.id)}" title="${detail}">
      <div class="ov4-node-header">
        <div class="ov4-node-tags">
          <span class="ov4-side-badge side-${side}">${sideLabel}</span>
          <span class="ov4-echelon-badge">${echelon}</span>
        </div>
        <span class="ov4-category-tag side-${side}">${category}</span>
      </div>
      <strong class="ov4-node-title sm-flow-node-label" title="${escapeHtml(rawLabel)}">${displayTitle}</strong>
      <div class="ov4-node-footer">
        <span class="ov4-meta-tasks">${taskSummary}</span>
        <span class="ov4-state-indicator ${isReady ? "ready" : "review"}">${isReady ? "已就绪" : "待复核"}</span>
      </div>
      ${isSelected ? `<span class="ov4-selected-indicator" aria-hidden="true"></span>` : ""}
    </button>
  </div>`;
}

function renderReviewInformation(model) {
  const diagnostics = model.diagnostics || [];
  return `<section class="ov4-info-section">
    <h3>模型诊断</h3>
    <div class="ov4-diagnostic-list">
      ${diagnostics.map((item) => `<article class="ov4-diagnostic ${escapeHtml(item.state)}">
        <div><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.statusLabel || item.state)}</span></div>
        <p>${escapeHtml(item.detail)}</p>
      </article>`).join("") || `<p class="ov4-panel-empty">暂无诊断。</p>`}
    </div>
  </section>`;
}

export function createRoleLayout(roles, relations, savedPositions = []) {
  if (!roles || !roles.length) {
    return { worldWidth: 1200, worldHeight: 800, positions: new Map() };
  }
  const saved = new Map((savedPositions || []).map((item) => [item.roleId || item.id, item]));

  const hasAll = roles.every((role) => {
    const p = saved.get(role.id);
    return p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y));
  });

  if (hasAll) {
    const positions = new Map();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    roles.forEach((role) => {
      const p = saved.get(role.id);
      let x = Number(p.x);
      let y = Number(p.y);
      if (x <= 100 && y <= 100) {
        x = (x / 100) * 1400;
        y = (y / 100) * 900;
      }
      positions.set(role.id, { id: role.id, x, y });
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    const coords = [...positions.values()];
    let overlapFound = false;
    for (let i = 0; i < coords.length; i++) {
      for (let j = i + 1; j < coords.length; j++) {
        if (Math.abs(coords[i].x - coords[j].x) < CARD_WIDTH * 0.65 && Math.abs(coords[i].y - coords[j].y) < CARD_HEIGHT * 0.7) {
          overlapFound = true;
          break;
        }
      }
      if (overlapFound) break;
    }

    if (!overlapFound && coords.length > 0) {
      const worldWidth = Math.max(1200, maxX + CARD_WIDTH + 80);
      const worldHeight = Math.max(800, maxY + CARD_HEIGHT + 80);
      return { worldWidth, worldHeight, positions };
    }
  }

  return layoutOv4Topology(roles, relations);
}

export function layoutOv4Topology(roles = [], relations = []) {
  if (!roles.length) return { worldWidth: 1200, worldHeight: 800, positions: new Map() };
  if (roles.length === 1) {
    return {
      worldWidth: 1200,
      worldHeight: 800,
      positions: new Map([[roles[0].id, { id: roles[0].id, x: 600, y: 400 }]])
    };
  }

  const blueRoles = [];
  const redRoles = [];
  const otherRoles = [];

  roles.forEach((role) => {
    const side = resolveSide(role);
    if (side === "blue") blueRoles.push(role);
    else if (side === "red") redRoles.push(role);
    else otherRoles.push(role);
  });

  const isBilateral = blueRoles.length > 0 && redRoles.length > 0;

  if (isBilateral) {
    return layoutBilateralTopology(blueRoles, redRoles, otherRoles, relations);
  }

  return layoutUnilateralTopology(roles, relations);
}

function layoutUnilateralTopology(roles, relations) {
  const roleIds = new Set(roles.map((r) => r.id));
  const superiorOf = new Map(roles.map((r) => [r.id, []]));
  const inDegree = new Map(roles.map((r) => [r.id, 0]));

  relations.forEach((rel) => {
    const sId = rel.sourceRoleId;
    const tId = rel.targetRoleId;
    if (!roleIds.has(sId) || !roleIds.has(tId) || sId === tId) return;

    const cat = rel.relationshipCategory || rel.relationshipType;
    if (/指挥|隶属|控制|保障|command|support/.test(cat)) {
      superiorOf.get(sId)?.push(tId);
      inDegree.set(tId, (inDegree.get(tId) || 0) + 1);
    } else if (/上报|信息|information/.test(cat)) {
      superiorOf.get(tId)?.push(sId);
      inDegree.set(sId, (inDegree.get(sId) || 0) + 1);
    }
  });

  const rankById = new Map();
  const roots = roles.filter((r) => (inDegree.get(r.id) || 0) === 0);
  const queue = (roots.length ? roots : roles.slice(0, 1)).map((r) => [r.id, roleEchelonTier(r)]);

  while (queue.length) {
    const [id, rank] = queue.shift();
    const curr = rankById.get(id);
    if (curr !== undefined && curr >= rank) continue;
    rankById.set(id, rank);
    (superiorOf.get(id) || []).forEach((subId) => queue.push([subId, rank + 1]));
  }

  roles.forEach((r) => {
    if (!rankById.has(r.id)) rankById.set(r.id, roleEchelonTier(r));
  });

  const rawRanks = new Map();
  roles.forEach((r) => {
    const rank = rankById.get(r.id) ?? 2;
    if (!rawRanks.has(rank)) rawRanks.set(rank, []);
    rawRanks.get(rank).push(r);
  });

  const sortedRanks = [...rawRanks.keys()].sort((a, b) => a - b);
  const visualRows = [];
  const MAX_PER_ROW = 4;

  sortedRanks.forEach((rKey) => {
    const list = rawRanks.get(rKey) || [];
    for (let i = 0; i < list.length; i += MAX_PER_ROW) {
      visualRows.push(list.slice(i, i + MAX_PER_ROW));
    }
  });

  let maxRowWidth = 0;
  visualRows.forEach((row) => {
    const w = row.length * CARD_WIDTH + (row.length - 1) * HORIZONTAL_GAP;
    if (w > maxRowWidth) maxRowWidth = w;
  });

  const worldWidth = Math.max(1300, maxRowWidth + 160);
  const worldHeight = Math.max(820, visualRows.length * (CARD_HEIGHT + VERTICAL_GAP) + 140);

  const positions = new Map();
  let currentY = 80 + CARD_HEIGHT / 2;

  visualRows.forEach((row) => {
    const rowWidth = row.length * CARD_WIDTH + (row.length - 1) * HORIZONTAL_GAP;
    const startX = (worldWidth - rowWidth) / 2 + CARD_WIDTH / 2;

    row.forEach((role, idx) => {
      const px = Math.round(startX + idx * (CARD_WIDTH + HORIZONTAL_GAP));
      const py = Math.round(currentY);
      positions.set(role.id, { id: role.id, x: px, y: py });
    });

    currentY += CARD_HEIGHT + VERTICAL_GAP;
  });

  return { worldWidth, worldHeight, positions };
}

function layoutBilateralTopology(blueRoles, redRoles, otherRoles, relations) {
  const sortCamp = (list) => [...list].sort((a, b) => roleEchelonTier(a) - roleEchelonTier(b));
  const sortedBlue = sortCamp(blueRoles);
  const sortedRed = sortCamp([...redRoles, ...otherRoles]);

  const MAX_CAMP_COL = 3;
  const chunkRows = (list) => {
    const rows = [];
    const tierMap = new Map();
    list.forEach((r) => {
      const t = roleEchelonTier(r);
      if (!tierMap.has(t)) tierMap.set(t, []);
      tierMap.get(t).push(r);
    });
    [...tierMap.keys()].sort((a, b) => a - b).forEach((tier) => {
      const items = tierMap.get(tier);
      for (let i = 0; i < items.length; i += MAX_CAMP_COL) {
        rows.push(items.slice(i, i + MAX_CAMP_COL));
      }
    });
    return rows;
  };

  const blueRows = chunkRows(sortedBlue);
  const redRows = chunkRows(sortedRed);
  const maxRows = Math.max(blueRows.length, redRows.length, 1);

  const campWidth = MAX_CAMP_COL * CARD_WIDTH + (MAX_CAMP_COL - 1) * HORIZONTAL_GAP;
  const campGap = 160;
  const worldWidth = Math.max(1600, campWidth * 2 + campGap + 160);
  const worldHeight = Math.max(860, maxRows * (CARD_HEIGHT + VERTICAL_GAP) + 140);

  const blueStartX = (worldWidth / 2) - (campGap / 2) - campWidth;
  const redStartX = (worldWidth / 2) + (campGap / 2);

  const positions = new Map();

  let blueY = 80 + CARD_HEIGHT / 2;
  blueRows.forEach((row) => {
    const rowW = row.length * CARD_WIDTH + (row.length - 1) * HORIZONTAL_GAP;
    const startX = blueStartX + (campWidth - rowW) / 2 + CARD_WIDTH / 2;
    row.forEach((role, idx) => {
      positions.set(role.id, {
        id: role.id,
        x: Math.round(startX + idx * (CARD_WIDTH + HORIZONTAL_GAP)),
        y: Math.round(blueY)
      });
    });
    blueY += CARD_HEIGHT + VERTICAL_GAP;
  });

  let redY = 80 + CARD_HEIGHT / 2;
  redRows.forEach((row) => {
    const rowW = row.length * CARD_WIDTH + (row.length - 1) * HORIZONTAL_GAP;
    const startX = redStartX + (campWidth - rowW) / 2 + CARD_WIDTH / 2;
    row.forEach((role, idx) => {
      positions.set(role.id, {
        id: role.id,
        x: Math.round(startX + idx * (CARD_WIDTH + HORIZONTAL_GAP)),
        y: Math.round(redY)
      });
    });
    redY += CARD_HEIGHT + VERTICAL_GAP;
  });

  return { worldWidth, worldHeight, positions };
}

function roleEchelonTier(role) {
  const text = `${role.label || ""} ${role.echelonCategory || ""} ${role.organizationCategory || ""}`.toLowerCase();
  if (/战区级|战区指挥|联合.*指挥|指控中心|指挥所|command/.test(text)) return 0;
  if (/战役方向级|集团军|军种|支队/.test(text)) return 1;
  if (/任务编组级|集群|群|分队|护卫|干扰/.test(text)) return 2;
  if (/基础作战单元|站所|节点|阵地|连队|主队|单元/.test(text)) return 3;
  return 2;
}

function renderOptions(options, selected) {
  return options.map((option) => `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`).join("");
}

export function selectionForOv4Role(roleId, models) {
  const { model } = resolveDodafProduct(models, "ov4");
  const role = (model.roles || []).find((item) => item.id === roleId);
  return role ? {
    id: role.id,
    kind: "ov4-role",
    title: role.label,
    status: "OV-4 Organization",
    text: "DoDAF 2.02 组织角色。",
    facts: [
      ["组织类别", role.organizationCategory || "未明确"],
      ["组织层级", role.echelonCategory || "未明确"],
      ["来源兵力", (role.forceRefs || []).join("、") || "未关联"],
      ["承接任务", (role.taskRefs || []).join("、") || "未关联"],
      ["关联活动", String(role.activityCount || (role.activityIds || []).length || 0)]
    ],
    refs: [...(role.forceRefs || []), ...(role.taskRefs || []), ...(role.activityIds || [])]
  } : null;
}

export function selectionForOv4Relation(relationId, models) {
  const { model } = resolveDodafProduct(models, "ov4");
  const relation = (model.relations || []).find((item) => item.id === relationId);
  return relation ? {
    id: relation.id,
    kind: "ov4-relation",
    title: `${relation.sourceRoleLabel} -> ${relation.targetRoleLabel}`,
    status: "OV-4 relationship",
    text: "DoDAF 2.02 组织关系。",
    facts: [
      ["关系分类", relation.relationshipCategory || "未明确"],
      ["关系类型", relation.relationshipType || "coordination"]
    ],
    refs: [relation.sourceForceRef, relation.targetForceRef, relation.sourceActivityId, relation.targetActivityId].filter(Boolean)
  } : null;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
