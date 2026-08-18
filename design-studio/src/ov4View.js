import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderProjectStorageActions } from "./projectStorageView.js";
import { renderEdgeBadge } from "./dodafDraftingView.js";
import { resolveOv4SelectedDiagramId } from "./ov4DiagramStore.js";
import { renderToolboxFloatButton, renderToolboxRail } from "./toolbox/index.js";

export function renderOv4(state) {
  const { model, source } = resolveDodafProduct(state, "ov4");
  const diagrams = model.diagrams || [];
  const selectedId = resolveOv4SelectedDiagramId(state, diagrams);
  const diagram = diagrams.find((item) => item.id === selectedId) || null;
  const scoped = scopeModel(model, diagram);
  const toolsOpen = state.ov4ToolsOpen === true;
  const editorOpen = state.ov4EditorOpen === true;
  return `<section class="ov4-page" data-view-page="organization-relationship" data-dodaf-product="OV-4">
    <header class="ov4-top"><div class="ov4-bar"><div class="ov4-identity"><h2>作战组织关系图</h2><small class="ov4-summary">${source === "persisted" ? "已持久化" : "本地/种子"} · ${diagrams.length} 张关系图 · ${model.roles?.length || 0} 个共享角色 · ${model.relations?.length || 0} 条共享关系</small></div><div class="ov4-toolbar">${state.ov4Storage ? renderProjectStorageActions(state.ov4Storage, { refreshAction: "refresh-project-ov4" }) : ""}<button type="button" class="quiet-button" data-action="seed-dodaf-ov4">重新生成</button><button type="button" class="primary-btn" data-action="save-dodaf-ov4">保存</button></div></div></header>
    <div class="ov4-workbench ${toolsOpen ? "is-tools-docked" : ""} ${editorOpen ? "is-editor-open" : ""}">
      ${renderDiagramPanel(diagrams, selectedId)}
      <main class="ov4-main-panel"><header class="ov4-canvas-head"><div><strong>${escapeHtml(diagram?.name || "组织关系图")}</strong><small>拖动组织框 · 空白平移 · 滚轮缩放</small></div><span>${scoped.roles.length} 角色 · ${scoped.relations.length} 关系</span><button type="button" class="sm-canvas-fit" data-ov4-canvas-fit title="适配全部组织" aria-label="适配全部组织">⌖</button></header>${renderOrganizationCanvas(scoped, diagram)}</main>
      ${renderPropertyDock(model, diagram, editorOpen)}
      ${toolsOpen ? renderOv4ToolboxRail(editorOpen) : ""}
    </div></section>`;
}

export function renderOv4ToolboxFloatButton({ toolsOpen = false } = {}) {
  return renderToolboxFloatButton({ scope: "ov4", open: toolsOpen, action: "toggle-ov4-tools", className: "ov1-edit-rail-brand is-topbar-float ov4-toolbox-float" });
}

function renderOv4ToolboxRail(editorOpen) {
  return renderToolboxRail({ scope: "ov4", open: true, label: "组织关系工具箱", navLabel: "组织关系工具", className: "sm-edit-rail ov4-edit-rail", navClassName: "ov4-edit-rail-nav", toggleAction: "toggle-ov4-tools", items: [{ action: "ov4-toggle-editor", title: "组织关系信息", icon: "relations", active: editorOpen, pressed: editorOpen }] });
}

function renderDiagramPanel(diagrams, selectedId) {
  return `<aside class="ov4-diagram-panel" aria-label="组织关系图列表"><header class="ov4-panel-head"><strong>组织关系图</strong><button type="button" class="ov4-icon-button" data-action="ov4-add-diagram" title="新建组织关系图" aria-label="新建组织关系图">＋</button></header><div class="ov4-diagram-list" role="listbox">${diagrams.map((diagram) => `<button type="button" class="ov4-diagram-item ${diagram.id === selectedId ? "is-selected" : ""}" data-action="ov4-select-diagram" data-diagram-id="${escapeHtml(diagram.id)}" role="option" aria-selected="${diagram.id === selectedId}"><strong>${escapeHtml(diagram.name)}</strong><span>${diagram.roleIds?.length || 0} 个角色 · ${diagram.relationIds?.length || 0} 条关系</span></button>`).join("") || `<div class="ov4-panel-empty"><strong>尚无组织关系图</strong><span>点击上方加号新建。</span></div>`}</div>${selectedId ? `<footer class="ov4-diagram-footer"><button type="button" class="quiet-button danger" data-action="ov4-remove-diagram" data-diagram-id="${escapeHtml(selectedId)}">删除当前关系图</button></footer>` : ""}</aside>`;
}

function renderPropertyDock(model, diagram, open) {
  if (!open) return `<aside class="ov4-editor-dock is-collapsed" aria-hidden="true"></aside>`;
  if (!diagram) return `<aside class="ov4-editor-dock is-open"><header class="ov4-editor-dock-head"><strong>组织关系信息</strong><button data-action="ov4-close-editor" aria-label="收起">×</button></header><p class="ov4-panel-empty">请先新建组织关系图。</p></aside>`;
  const roleIds = new Set(diagram.roleIds || []);
  const relationIds = new Set(diagram.relationIds || []);
  return `<aside class="ov4-editor-dock is-open" aria-label="组织关系信息"><header class="ov4-editor-dock-head"><div><strong>组织关系信息</strong><small>当前关系图的名称与展示范围</small></div><button type="button" data-action="ov4-close-editor" title="收起" aria-label="收起">×</button></header><div class="ov4-editor-scroll">
    <section class="ov4-info-section"><label class="ov4-info-field"><span>名称</span><input data-action="ov4-diagram-field" data-diagram-id="${escapeHtml(diagram.id)}" data-field="name" value="${escapeHtml(diagram.name)}"></label><label class="ov4-info-field"><span>说明</span><textarea rows="3" data-action="ov4-diagram-field" data-diagram-id="${escapeHtml(diagram.id)}" data-field="description">${escapeHtml(diagram.description || "")}</textarea></label></section>
    <section class="ov4-info-section"><h3>包含的组织角色</h3><div class="ov4-scope-list">${(model.roles || []).map((role) => `<label><input type="checkbox" data-action="ov4-toggle-diagram-role" data-diagram-id="${escapeHtml(diagram.id)}" data-role-id="${escapeHtml(role.id)}" ${roleIds.has(role.id) ? "checked" : ""}><span>${escapeHtml(role.label)}</span></label>`).join("") || `<p class="ov4-panel-empty">尚无共享角色。</p>`}</div></section>
    <section class="ov4-info-section"><h3>包含的组织关系</h3><div class="ov4-scope-list">${(model.relations || []).map((relation) => `<label><input type="checkbox" data-action="ov4-toggle-diagram-relation" data-diagram-id="${escapeHtml(diagram.id)}" data-relation-id="${escapeHtml(relation.id)}" ${relationIds.has(relation.id) ? "checked" : ""}><span>${escapeHtml(relation.sourceRoleLabel)} → ${escapeHtml(relation.targetRoleLabel)} ${renderEdgeBadge(relation.relationshipType)}</span></label>`).join("") || `<p class="ov4-panel-empty">尚无共享关系。</p>`}</div></section>
    ${renderReviewInformation(model)}</div></aside>`;
}

function scopeModel(model, diagram) {
  if (!diagram) return { roles: [], relations: [] };
  const roleIds = new Set(diagram.roleIds || []);
  const relationIds = new Set(diagram.relationIds || []);
  return { roles: (model.roles || []).filter((role) => roleIds.has(role.id)), relations: (model.relations || []).filter((relation) => relationIds.has(relation.id) && roleIds.has(relation.sourceRoleId) && roleIds.has(relation.targetRoleId)) };
}

function renderOrganizationCanvas(model, diagram) {
  const layout = createRoleLayout(model.roles, model.relations, diagram?.positions || []);
  const lines = model.relations.map((relation) => { const source = layout.positions.get(relation.sourceRoleId); const target = layout.positions.get(relation.targetRoleId); return source && target ? `<path class="ov4-org-relation" data-ov4-edge data-source-id="${escapeHtml(relation.sourceRoleId)}" data-target-id="${escapeHtml(relation.targetRoleId)}" d="${relationPath(source, target)}" marker-end="url(#ov4-arrow)"/>` : ""; }).join("");
  const nodes = model.roles.map((role) => { const position = layout.positions.get(role.id); return `<div class="ov4-org-node-wrap" data-ov4-node="${escapeHtml(role.id)}" data-logical-x="${position.x}" data-logical-y="${position.y}" style="left:${position.x / 10}%;top:${position.y / 10}%"><button type="button" class="ov4-org-role ${role.state === "ready" ? "is-ready" : "is-review"}" data-ov4-role="${escapeHtml(role.id)}"><strong>${escapeHtml(role.label)}</strong><span>${role.activityCount || 0} 项活动</span></button></div>`; }).join("");
  const empty = !diagram ? `<div class="ov4-org-empty"><strong>尚无组织关系图</strong><span>从左侧新建一张关系图。</span></div>` : !model.roles.length ? `<div class="ov4-org-empty"><strong>当前关系图为空</strong><span>从右侧工具箱选择需要展示的角色和关系。</span></div>` : "";
  return `<div class="ov4-canvas-frame ov4-camera-canvas" data-ov4-canvas data-diagram-id="${escapeHtml(diagram?.id || "")}"><div class="ov4-canvas-stage" data-ov4-stage><div class="ov4-org-canvas" data-ov4-world style="width:${layout.worldWidth}px;height:${layout.worldHeight}px"><svg class="ov4-org-links" viewBox="0 0 1000 1000" preserveAspectRatio="none"><defs><marker id="ov4-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8z"/></marker></defs>${lines}</svg>${nodes}${empty}</div></div></div>`;
}

function renderReviewInformation(model) { const diagnostics = model.diagnostics || []; return `<section class="ov4-info-section"><h3>模型诊断</h3><div class="ov4-diagnostic-list">${diagnostics.map((item) => `<article class="ov4-diagnostic ${escapeHtml(item.state)}"><div><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.statusLabel || item.state)}</span></div><p>${escapeHtml(item.detail)}</p></article>`).join("") || `<p class="ov4-panel-empty">暂无诊断。</p>`}</div></section>`; }
function createRoleLayout(roles, relations, savedPositions) {
  const saved = new Map(savedPositions.map((item) => [item.roleId, item]));
  const roleIds = new Set(roles.map((role) => role.id));
  const incoming = new Map(roles.map((role) => [role.id, 0]));
  const children = new Map(roles.map((role) => [role.id, []]));
  relations.forEach((relation) => { if (roleIds.has(relation.sourceRoleId) && roleIds.has(relation.targetRoleId)) { incoming.set(relation.targetRoleId, (incoming.get(relation.targetRoleId) || 0) + 1); children.get(relation.sourceRoleId)?.push(relation.targetRoleId); } });
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
function relationPath(source, target) { const startY = source.y + 38; const endY = target.y - 38; const railY = startY + Math.max(36, (endY - startY) * .45); return `M ${source.x} ${startY} L ${source.x} ${railY} L ${target.x} ${railY} L ${target.x} ${endY}`; }
export function selectionForOv4Role(roleId, models) { const { model } = resolveDodafProduct(models, "ov4"); const role = (model.roles || []).find((item) => item.id === roleId); return role ? { id: role.id, kind: "ov4-role", title: role.label, status: "OV-4 Organization", text: "DoDAF 2.02 组织角色。", facts: [["来源兵力", (role.forceRefs || []).join("、") || "未关联"], ["承接任务", (role.taskRefs || []).join("、") || "未关联"], ["关联活动", String(role.activityCount || 0)]], refs: [...(role.forceRefs || []), ...(role.taskRefs || []), ...(role.activityIds || [])] } : null; }
export function selectionForOv4Relation(relationId, models) { const { model } = resolveDodafProduct(models, "ov4"); const relation = (model.relations || []).find((item) => item.id === relationId); return relation ? { id: relation.id, kind: "ov4-relation", title: `${relation.sourceRoleLabel} -> ${relation.targetRoleLabel}`, status: "OV-4 relationship", text: "DoDAF 2.02 组织关系。", facts: [["关系类型", relation.relationshipType]], refs: [relation.sourceForceRef, relation.targetForceRef, relation.sourceActivityId, relation.targetActivityId].filter(Boolean) } : null; }
function escapeHtml(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
