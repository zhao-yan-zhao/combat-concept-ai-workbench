import { normalizeDodafOv4 } from "../../shared/dodaf/products.js";

export function resolveOv4SelectedDiagramId(state, diagrams = []) {
  const requested = String(state?.ov4SelectedDiagramId || "");
  return diagrams.some((diagram) => diagram.id === requested) ? requested : diagrams[0]?.id || "";
}

export function addOv4Diagram(model, partial = {}) {
  const normalized = normalizeDodafOv4(model);
  const id = uniqueId(normalized.diagrams || []);
  return normalizeDodafOv4({ ...normalized, diagrams: [...(normalized.diagrams || []), { id, name: partial.name || `组织关系图 ${(normalized.diagrams?.length || 0) + 1}`, description: partial.description || "", roleIds: partial.roleIds || [], relationIds: partial.relationIds || [] }] });
}

export function removeOv4Diagram(model, diagramId) {
  const normalized = normalizeDodafOv4(model);
  return normalizeDodafOv4({ ...normalized, diagrams: (normalized.diagrams || []).filter((diagram) => diagram.id !== diagramId) });
}

export function updateOv4Diagram(model, diagramId, patch = {}) {
  const normalized = normalizeDodafOv4(model);
  return normalizeDodafOv4({ ...normalized, diagrams: (normalized.diagrams || []).map((diagram) => diagram.id === diagramId ? { ...diagram, ...patch, id: diagram.id } : diagram) });
}

export function toggleOv4DiagramRole(model, diagramId, roleId, checked) {
  const normalized = normalizeDodafOv4(model);
  const diagram = (normalized.diagrams || []).find((item) => item.id === diagramId);
  if (!diagram) return normalized;
  const roleIds = new Set(diagram.roleIds || []);
  if (checked) roleIds.add(roleId);
  else roleIds.delete(roleId);
  const relationIds = (diagram.relationIds || []).filter((id) => {
    const relation = (normalized.relations || []).find((item) => item.id === id);
    return relation && roleIds.has(relation.sourceRoleId) && roleIds.has(relation.targetRoleId);
  });
  return updateOv4Diagram(normalized, diagramId, { roleIds: [...roleIds], relationIds });
}

export function toggleOv4DiagramRelation(model, diagramId, relationId, checked) {
  const normalized = normalizeDodafOv4(model);
  const diagram = (normalized.diagrams || []).find((item) => item.id === diagramId);
  const relation = (normalized.relations || []).find((item) => item.id === relationId);
  if (!diagram || !relation) return normalized;
  const relationIds = new Set(diagram.relationIds || []);
  const roleIds = new Set(diagram.roleIds || []);
  if (checked) {
    relationIds.add(relationId);
    roleIds.add(relation.sourceRoleId);
    roleIds.add(relation.targetRoleId);
  } else relationIds.delete(relationId);
  return updateOv4Diagram(normalized, diagramId, { roleIds: [...roleIds], relationIds: [...relationIds] });
}

export function updateOv4DiagramPositions(model, diagramId, positions = []) {
  return updateOv4Diagram(model, diagramId, { positions });
}

export function updateOv4RoleClassification(model, roleId, patch = {}) {
  const normalized = normalizeDodafOv4(model);
  return normalizeDodafOv4({ ...normalized, roles: (normalized.roles || []).map((role) => role.id === roleId ? { ...role, ...patch, id: role.id } : role) });
}

export function updateOv4RelationClassification(model, relationId, patch = {}) {
  const normalized = normalizeDodafOv4(model);
  return normalizeDodafOv4({ ...normalized, relations: (normalized.relations || []).map((relation) => relation.id === relationId ? { ...relation, ...patch, id: relation.id } : relation) });
}

function uniqueId(diagrams) {
  const used = new Set(diagrams.map((diagram) => diagram.id));
  const base = `ov4-diagram-${Date.now().toString(36)}`;
  let id = base;
  let index = 2;
  while (used.has(id)) id = `${base}-${index++}`;
  return id;
}
