import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderProjectStorageActions } from "./projectStorageView.js";
import { resolveOv4SelectedDiagramId } from "./ov4DiagramStore.js";
import { renderToolboxFloatButton, renderToolboxRail } from "./toolbox/index.js";
import { buildOv4ForceFingerprint } from "./ov4Builder.js";
import { OV4_ECHELON_CATEGORIES, OV4_ORGANIZATION_CATEGORIES, OV4_RELATION_CATEGORIES, ov4RelationShortLabel, ov4RelationStyleKey } from "../../shared/dodaf/ov4Taxonomy.js";
import { renderForceResourceSubflowBar } from "./forceResourceSubflowNav.js";

export function renderOv4(state) {
  const { model, source } = resolveDodafProduct(state, "ov4");
  const diagrams = diagramsForDisplay(model);
  const selectedId = resolveOv4SelectedDiagramId(state, diagrams);
  const diagram = diagrams.find((item) => item.id === selectedId) || null;
  const scoped = scopeModel(model, diagram);
  const toolsOpen = state.ov4ToolsOpen === true;
  const editorOpen = state.ov4EditorOpen === true;
  const fingerprint = buildOv4ForceFingerprint(state.forceMission);
  const stale = String(model.derivedFrom?.note || "").startsWith("ov4-force:") && model.derivedFrom.note !== fingerprint;
  const statusLabel = stale ? "兵力已更新，待重生成" : source === "persisted" ? "已持久化" : "本地/种子";
  return `<section class="ov4-page" data-view-page="organization-relationship" data-dodaf-product="OV-4">
    ${renderForceResourceSubflowBar(state, "ov4")}
    <header class="ov4-top"><div class="ov4-bar"><div class="ov4-identity"><h2>作战组织关系图</h2><small class="ov4-summary ${stale ? "is-review" : ""}">${statusLabel} · ${diagrams.length} 张关系图 · ${model.roles?.length || 0} 个共享角色 · ${model.relations?.length || 0} 条共享关系</small></div><div class="ov4-toolbar"><button type="button" class="quiet-button" data-action="return-force-mission">← 返回兵力</button>${state.ov4Storage ? renderProjectStorageActions(state.ov4Storage, { refreshAction: "refresh-project-ov4" }) : ""}<button type="button" class="quiet-button" data-action="seed-dodaf-ov4">重新生成</button><button type="button" class="ghost-btn" data-action="save-dodaf-ov4">保存</button><button type="button" class="primary-btn" data-action="save-and-advance-ov2">保存并进入资源流 (OV-2) →</button></div></div></header>
    <div class="ov4-workbench ${toolsOpen ? "is-tools-docked" : ""} ${editorOpen ? "is-editor-open" : ""}">
      ${renderDiagramPanel(diagrams, selectedId)}
      <main class="ov4-main-panel"><header class="ov4-canvas-head"><div><strong>${escapeHtml(diagram?.name || "组织关系图")}</strong><small>拖动组织框 · 空白平移 · 滚轮缩放</small></div><span class="ov4-relation-legend" aria-label="关系图例">指挥 · 保障 · 上报 · 协同</span><span>${scoped.roles.length} 角色 · ${scoped.relations.length} 关系</span><button type="button" class="sm-canvas-fit" data-ov4-canvas-fit title="适配全部组织" aria-label="适配全部组织">⌖</button></header>${renderOrganizationCanvas(scoped, diagram)}</main>
      ${renderPropertyDock(model, diagram, editorOpen)}
      ${toolsOpen ? renderOv4ToolboxRail(editorOpen) : ""}
    </div></section>`;
}

export function renderOv4ToolboxFloatButton({ toolsOpen = false } = {}) {
  return renderToolboxFloatButton({ scope: "ov4", open: toolsOpen, action: "toggle-ov4-tools", className: "ov1-edit-rail-brand is-topbar-float ov4-toolbox-float" });
}

function renderOv4ToolboxRail(editorOpen) {
  return renderToolboxRail({ scope: "ov4", open: true, label: "组织关系工具箱", navLabel: "组织关系工具", className: "sm-edit-rail ov4-edit-rail", navClassName: "ov4-edit-rail-nav", toggleAction: "toggle-ov4-tools", items: [{ action: "open-subflow-ai", title: "AI 生成组织关系", icon: "sparkle", attention: true }, "sep", { action: "ov4-toggle-editor", title: "组织关系信息", icon: "relations", active: editorOpen, pressed: editorOpen }] });
}

function renderDiagramPanel(diagrams, selectedId) {
  return `<aside class="ov4-diagram-panel" aria-label="组织关系图列表" data-grouped-list-panel="ov4" data-grouped-list-dimensions="完整性:status|关系规模:scale" data-grouped-list-default-group="status"><header class="ov4-panel-head"><strong>组织关系图</strong><button type="button" class="ov4-icon-button" data-action="ov4-add-diagram" title="新建组织关系图" aria-label="新建组织关系图">＋</button></header><div class="ov4-diagram-list" role="listbox" data-grouped-list-items>${diagrams.map((diagram) => { const relationCount = diagram.relationIds?.length || 0; const status = diagram.roleIds?.length && relationCount ? "已建立" : "待补充"; const scale = relationCount > 5 ? "6 条以上" : relationCount ? "1-5 条" : "暂无关系"; return `<button type="button" class="ov4-diagram-item ${diagram.id === selectedId ? "is-selected" : ""}" data-action="ov4-select-diagram" data-diagram-id="${escapeHtml(diagram.id)}" role="option" aria-selected="${diagram.id === selectedId}" data-grouped-list-item data-group-status="${status}" data-group-scale="${scale}" data-search="${escapeHtml([diagram.id, diagram.name, diagram.description].filter(Boolean).join(" "))}"><strong>${escapeHtml(diagram.name)}</strong><span>${diagram.roleIds?.length || 0} 个角色 · ${relationCount} 条关系</span></button>`; }).join("") || `<div class="ov4-panel-empty"><strong>尚无组织关系图</strong><span>点击上方加号新建。</span></div>`}</div>${selectedId ? `<footer class="ov4-diagram-footer"><button type="button" class="quiet-button danger" data-action="ov4-remove-diagram" data-diagram-id="${escapeHtml(selectedId)}">删除当前关系图</button></footer>` : ""}</aside>`;
}

function renderPropertyDock(model, diagram, open) {
  if (!open) return `<aside class="ov4-editor-dock is-collapsed" aria-hidden="true"></aside>`;
  if (!diagram) return `<aside class="ov4-editor-dock is-open"><header class="ov4-editor-dock-head"><strong>组织关系信息</strong><button data-action="ov4-close-editor" aria-label="收起">×</button></header><p class="ov4-panel-empty">请先新建组织关系图。</p></aside>`;
  const roleIds = new Set(diagram.roleIds || []);
  const relationIds = new Set(diagram.relationIds || []);
  return `<aside class="ov4-editor-dock is-open" aria-label="组织关系信息"><header class="ov4-editor-dock-head"><div><strong>组织关系信息</strong><small>当前关系图的名称与展示范围</small></div><button type="button" data-action="ov4-close-editor" title="收起" aria-label="收起">×</button></header><div class="ov4-editor-scroll">
    <section class="ov4-info-section"><label class="ov4-info-field"><span>名称</span><input data-action="ov4-diagram-field" data-diagram-id="${escapeHtml(diagram.id)}" data-field="name" value="${escapeHtml(diagram.name)}"></label><label class="ov4-info-field"><span>说明</span><textarea rows="3" data-action="ov4-diagram-field" data-diagram-id="${escapeHtml(diagram.id)}" data-field="description">${escapeHtml(diagram.description || "")}</textarea></label></section>
    <section class="ov4-info-section"><h3>组织分类</h3><div class="ov4-classification-list">${(model.roles || []).map((role) => `<article><label class="ov4-scope-check"><input type="checkbox" data-action="ov4-toggle-diagram-role" data-diagram-id="${escapeHtml(diagram.id)}" data-role-id="${escapeHtml(role.id)}" ${roleIds.has(role.id) ? "checked" : ""}><strong>${escapeHtml(role.label)}</strong></label><div><label><span>组织类别</span><select data-action="ov4-role-classification" data-role-id="${escapeHtml(role.id)}" data-field="organizationCategory">${renderOptions(OV4_ORGANIZATION_CATEGORIES, role.organizationCategory)}</select></label><label><span>层级</span><select data-action="ov4-role-classification" data-role-id="${escapeHtml(role.id)}" data-field="echelonCategory">${renderOptions(OV4_ECHELON_CATEGORIES, role.echelonCategory)}</select></label></div></article>`).join("") || `<p class="ov4-panel-empty">尚无共享组织。</p>`}</div></section>
    <section class="ov4-info-section"><h3>关系分类</h3><div class="ov4-classification-list">${(model.relations || []).map((relation) => `<article><label class="ov4-scope-check"><input type="checkbox" data-action="ov4-toggle-diagram-relation" data-diagram-id="${escapeHtml(diagram.id)}" data-relation-id="${escapeHtml(relation.id)}" ${relationIds.has(relation.id) ? "checked" : ""}><strong>${escapeHtml(relation.sourceRoleLabel)} → ${escapeHtml(relation.targetRoleLabel)}</strong></label><label><span>关系类别</span><select data-action="ov4-relation-classification" data-relation-id="${escapeHtml(relation.id)}" data-field="relationshipCategory">${renderOptions(OV4_RELATION_CATEGORIES, relation.relationshipCategory)}</select></label></article>`).join("") || `<p class="ov4-panel-empty">尚无共享关系。</p>`}</div></section>
    ${renderReviewInformation(model)}</div></aside>`;
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

function renderOrganizationCanvas(model, diagram) {
  const layout = createRoleLayout(model.roles, model.relations, diagram?.positions || []);
  const lines = model.relations.map((relation) => {
    const source = layout.positions.get(relation.sourceRoleId);
    const target = layout.positions.get(relation.targetRoleId);
    const style = ov4RelationStyleKey(relation.relationshipCategory);
    if (!source || !target) return "";
    const label = ov4RelationShortLabel(relation.relationshipCategory, relation.relationshipType);
    const point = relationLabelPoint(source, target);
    return `<path class="ov4-org-relation relation-${style}" data-ov4-edge data-source-id="${escapeHtml(relation.sourceRoleId)}" data-target-id="${escapeHtml(relation.targetRoleId)}" d="${relationPath(source, target)}" marker-end="url(#ov4-arrow-${style})"/><text class="ov4-org-relation-label relation-${style}" data-ov4-edge-label data-source-id="${escapeHtml(relation.sourceRoleId)}" data-target-id="${escapeHtml(relation.targetRoleId)}" x="${point.x}" y="${point.y}">${escapeHtml(label)}</text>`;
  }).join("");
  const nodes = model.roles.map((role) => { const position = layout.positions.get(role.id); return `<div class="ov4-org-node-wrap" data-ov4-node="${escapeHtml(role.id)}" data-logical-x="${position.x}" data-logical-y="${position.y}" style="left:${position.x / 10}%;top:${position.y / 10}%"><button type="button" class="ov4-org-role ${role.state === "ready" ? "is-ready" : "is-review"}" data-ov4-role="${escapeHtml(role.id)}"><small>${escapeHtml(role.echelonCategory || "未明确")}</small><strong>${escapeHtml(role.label)}</strong><span>${escapeHtml(role.organizationCategory || "其他")}</span></button></div>`; }).join("");
  const empty = !diagram ? `<div class="ov4-org-empty"><strong>尚无组织关系图</strong><span>从左侧新建一张关系图。</span></div>` : !model.roles.length ? `<div class="ov4-org-empty"><strong>当前关系图为空</strong><span>从右侧工具箱选择需要展示的角色和关系。</span></div>` : "";
  const markers = ["subordinate", "command", "control", "admin", "attached", "coordination", "support", "information", "other"].map((key) => `<marker id="ov4-arrow-${key}" class="relation-${key}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8z"/></marker>`).join("");
  return `<div class="ov4-canvas-frame ov4-camera-canvas" data-ov4-canvas data-diagram-id="${escapeHtml(diagram?.id || "")}"><div class="ov4-canvas-stage" data-ov4-stage><div class="ov4-org-canvas" data-ov4-world style="width:${layout.worldWidth}px;height:${layout.worldHeight}px"><svg class="ov4-org-links" viewBox="0 0 1000 1000" preserveAspectRatio="none"><defs>${markers}</defs>${lines}</svg>${nodes}${empty}</div></div></div>`;
}

function renderReviewInformation(model) { const diagnostics = model.diagnostics || []; return `<section class="ov4-info-section"><h3>模型诊断</h3><div class="ov4-diagnostic-list">${diagnostics.map((item) => `<article class="ov4-diagnostic ${escapeHtml(item.state)}"><div><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.statusLabel || item.state)}</span></div><p>${escapeHtml(item.detail)}</p></article>`).join("") || `<p class="ov4-panel-empty">暂无诊断。</p>`}</div></section>`; }
function createRoleLayout(roles, relations, savedPositions) {
  const saved = new Map(savedPositions.map((item) => [item.roleId, item]));
  const roleIds = new Set(roles.map((role) => role.id));
  const incoming = new Map(roles.map((role) => [role.id, 0]));
  const children = new Map(roles.map((role) => [role.id, []]));
  const hierarchyCategories = new Set(["上下级隶属", "作战指挥", "作战控制", "行政控制", "配属"]);
  relations.forEach((relation) => { if (hierarchyCategories.has(relation.relationshipCategory) && roleIds.has(relation.sourceRoleId) && roleIds.has(relation.targetRoleId)) { incoming.set(relation.targetRoleId, (incoming.get(relation.targetRoleId) || 0) + 1); children.get(relation.sourceRoleId)?.push(relation.targetRoleId); } });
  const roots = roles.filter((role) => !incoming.get(role.id)).map((role) => role.id);
  const levels = new Map();
  const queue = (roots.length ? roots : roles.slice(0, 1).map((role) => role.id)).map((id) => [id, 0]);
  while (queue.length) { const [id, level] = queue.shift(); if ((levels.get(id) ?? -1) >= level) continue; levels.set(id, level); (children.get(id) || []).forEach((child) => queue.push([child, level + 1])); }
  roles.forEach((role) => { if (!levels.has(role.id)) levels.set(role.id, Math.max(0, ...levels.values()) + 1); });
  const grouped = new Map();
  roles.forEach((role) => { const level = levels.get(role.id); if (!grouped.has(level)) grouped.set(level, []); grouped.get(level).push(role.id); });
  const automatic = new Map();
  [...grouped.entries()].sort((a, b) => a[0] - b[0]).forEach(([level, ids]) => ids.forEach((id, index) => automatic.set(id, { id, x: ((index + 1) * 1000) / (ids.length + 1), y: 120 + level * 230 })));
  const widestLevel = Math.max(1, ...[...grouped.values()].map((ids) => ids.length));
  const levelCount = Math.max(1, grouped.size);
  return { worldWidth: Math.max(1400, widestLevel * 200), worldHeight: Math.max(900, levelCount * 240 + 160), positions: new Map(roles.map((role) => [role.id, saved.has(role.id) ? { id: role.id, x: saved.get(role.id).x, y: saved.get(role.id).y } : automatic.get(role.id)])) };
}
function relationPath(source, target) { if (Math.abs(target.y - source.y) < 100) { const direction = target.x >= source.x ? 1 : -1; return `M ${source.x + 92 * direction} ${source.y} L ${target.x - 92 * direction} ${target.y}`; } const direction = target.y >= source.y ? 1 : -1; const startY = source.y + 38 * direction; const endY = target.y - 38 * direction; const railY = (startY + endY) / 2; return `M ${source.x} ${startY} L ${source.x} ${railY} L ${target.x} ${railY} L ${target.x} ${endY}`; }
function relationLabelPoint(source, target) { return { x: (source.x + target.x) / 2, y: Math.abs(target.y - source.y) < 100 ? source.y - 12 : (source.y + target.y) / 2 - 4 }; }
function renderOptions(options, selected) { return options.map((option) => `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`).join(""); }
export function selectionForOv4Role(roleId, models) { const { model } = resolveDodafProduct(models, "ov4"); const role = (model.roles || []).find((item) => item.id === roleId); return role ? { id: role.id, kind: "ov4-role", title: role.label, status: "OV-4 Organization", text: "DoDAF 2.02 组织角色。", facts: [["来源兵力", (role.forceRefs || []).join("、") || "未关联"], ["承接任务", (role.taskRefs || []).join("、") || "未关联"], ["关联活动", String(role.activityCount || 0)]], refs: [...(role.forceRefs || []), ...(role.taskRefs || []), ...(role.activityIds || [])] } : null; }
export function selectionForOv4Relation(relationId, models) { const { model } = resolveDodafProduct(models, "ov4"); const relation = (model.relations || []).find((item) => item.id === relationId); return relation ? { id: relation.id, kind: "ov4-relation", title: `${relation.sourceRoleLabel} -> ${relation.targetRoleLabel}`, status: "OV-4 relationship", text: "DoDAF 2.02 组织关系。", facts: [["关系类型", relation.relationshipType]], refs: [relation.sourceForceRef, relation.targetForceRef, relation.sourceActivityId, relation.targetActivityId].filter(Boolean) } : null; }
function escapeHtml(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
