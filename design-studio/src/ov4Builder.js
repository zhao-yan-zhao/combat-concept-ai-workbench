import { normalizeForceMissionPlan } from "../../shared/conceptPlanning.js";
import { inferOv4EchelonCategory, inferOv4OrganizationCategory, inferOv4RelationCategory } from "../../shared/dodaf/ov4Taxonomy.js";

const MAX_ROLES = 48;
const MAX_RELATIONSHIPS = 160;

export function buildOv4Model({ forceMission, ov1, ov5, ooda, scenario } = {}) {
  const formalPlan = normalizeForceMissionPlan(forceMission);
  if (formalPlan.forces.length || formalPlan.combatForces.length) {
    return buildForceLinkedOv4(formalPlan);
  }
  const sourceRoles = Array.isArray(ov1?.nodes) ? ov1.nodes.slice(0, MAX_ROLES) : [];
  const activities = Array.isArray(ov5?.activities) ? ov5.activities : [];
  const edges = Array.isArray(ov5?.edges) ? ov5.edges.slice(0, MAX_RELATIONSHIPS) : [];
  const oodaNodes = (Array.isArray(ooda?.lanes) ? ooda.lanes : []).flatMap((lane) => (lane.nodes || []).map((node) => ({ ...node, phase: clean(lane.subtitle || lane.title, 160) })));
  const entities = Array.isArray(scenario?.entities) ? scenario.entities : [];
  const roleIds = new Set(sourceRoles.map((node) => String(node.id)));
  const activityById = new Map(activities.map((activity) => [String(activity.id), activity]));
  const activityRoles = new Map();
  const unmappedActivityIds = [];

  activities.forEach((activity) => {
    const ids = unique(activity.sourceOv1NodeIds).filter((id) => roleIds.has(id));
    activityRoles.set(String(activity.id), ids);
    if (!ids.length) unmappedActivityIds.push(String(activity.id));
  });

  const roles = sourceRoles.map((node) => {
    const id = String(node.id);
    const assigned = activities.filter((activity) => activityRoles.get(String(activity.id))?.includes(id));
    const activityIds = assigned.map((activity) => String(activity.id));
    const phases = unique(oodaNodes.filter((node) => activityIds.includes(String(node.sourceActivityId))).map((node) => node.phase));
    return {
      id,
      label: clean(node.label, 160) || id,
      detail: clean(node.detail || node.description, 500),
      organizationCategory: inferOv4OrganizationCategory({ label: node.label, role: node.kind }),
      echelonCategory: inferOv4EchelonCategory({ label: node.label }),
      activityIds,
      activityCount: activityIds.length,
      oodaCount: oodaNodes.filter((node) => activityIds.includes(String(node.sourceActivityId))).length,
      phases,
      entityCount: entities.filter((entity) => activityIds.includes(String(entity.sourceActivityId))).length,
      state: activityIds.length ? "ready" : "review"
    };
  });

  const roleById = new Map(roles.map((role) => [role.id, role]));
  const relations = [];
  const seen = new Set();
  const brokenEdgeIds = [];
  edges.forEach((edge, index) => {
    const source = activityById.get(String(edge.sourceId));
    const target = activityById.get(String(edge.targetId));
    const sourceRoleIds = activityRoles.get(String(edge.sourceId)) || [];
    const targetRoleIds = activityRoles.get(String(edge.targetId)) || [];
    if (!source || !target || !sourceRoleIds.length || !targetRoleIds.length) {
      brokenEdgeIds.push(String(edge.id || `edge-${index + 1}`));
      return;
    }
    sourceRoleIds.forEach((sourceRoleId) => targetRoleIds.forEach((targetRoleId) => {
      if (sourceRoleId === targetRoleId || relations.length >= MAX_RELATIONSHIPS) return;
      const key = `${sourceRoleId}:${targetRoleId}:${source.id}:${target.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      relations.push({
        id: `ov4-${stableId(key)}`,
        sourceRoleId,
        sourceRoleLabel: roleById.get(sourceRoleId)?.label || sourceRoleId,
        targetRoleId,
        targetRoleLabel: roleById.get(targetRoleId)?.label || targetRoleId,
        relationshipType: clean(edge.type, 120) || "coordination",
        relationshipCategory: inferOv4RelationCategory(edge.type),
        sourceActivityId: String(source.id),
        sourceActivityTitle: clean(source.title, 240),
        targetActivityId: String(target.id),
        targetActivityTitle: clean(target.title, 240),
        state: "ready"
      });
    }));
  });

  const unassignedRoleIds = roles.filter((role) => !role.activityCount).map((role) => role.id);
  const coverage = {
    activity: coverageSummary(activities.length, unmappedActivityIds.length),
    role: coverageSummary(roles.length, unassignedRoleIds.length)
  };
  const diagnostics = [
    check("role-derivation", "责任角色推导", roles.length ? "ready" : "pending", roles.length ? `已从 OV-1 推导 ${roles.length} 个抽象责任角色` : "尚未定义可用于 OV-4 的 OV-1 节点"),
    check("activity-responsibility", "活动责任归属", unmappedActivityIds.length ? "review" : activities.length ? "ready" : "pending", unmappedActivityIds.length ? `${unmappedActivityIds.length} 个 OV-5 活动尚未关联责任角色` : activities.length ? "全部 OV-5 活动均有抽象责任角色" : "尚未定义 OV-5 活动"),
    check("role-relationships", "跨角色关系", brokenEdgeIds.length ? "review" : relations.length ? "ready" : "pending", brokenEdgeIds.length ? `${brokenEdgeIds.length} 条 OV-5 关系无法推导责任关系` : relations.length ? `已推导 ${relations.length} 条跨角色关系` : "尚未找到跨角色 OV-5 关系"),
    check("role-coverage", "责任覆盖", unassignedRoleIds.length ? "review" : roles.length ? "ready" : "pending", unassignedRoleIds.length ? `${unassignedRoleIds.length} 个抽象责任角色尚未覆盖 OV-5 活动` : roles.length ? "全部抽象责任角色均有关联活动" : "尚未定义抽象责任角色")
  ];
  const diagrams = [{ id: "ov4-diagram-overall", name: "总体组织关系图", description: "覆盖当前推导出的全部组织角色与协同关系。", roleIds: roles.map((role) => role.id), relationIds: relations.map((relation) => relation.id) }];
  return { version: 1, kind: "derived-ov4-abstract-responsibility", generatedAt: new Date().toISOString(), source: { ov1NodeCount: sourceRoles.length, ov5ActivityCount: activities.length, ov5EdgeCount: edges.length, oodaNodeCount: oodaNodes.length, scenarioEntityCount: entities.length }, roles, relations, diagrams, coverage, diagnostics, unresolved: { unmappedActivityIds, brokenEdgeIds, unassignedRoleIds } };
}

function buildForceLinkedOv4(plan) {
  const tasks = plan.tasks || [];
  const taskIds = new Set(tasks.map((task) => task.id));
  const forces = [
    ...(plan.forces || []).map((force) => ({ ...force, layer: "concept" })),
    ...(plan.combatForces || []).map((force) => ({ ...force, layer: "combat" }))
  ].slice(0, MAX_ROLES);
  const forceById = new Map(forces.map((force) => [force.id, force]));
  const brokenTaskRefs = [];
  const roles = forces.map((force) => {
    const taskRefs = unique(force.taskRefs);
    taskRefs.filter((ref) => !taskIds.has(ref)).forEach((ref) => brokenTaskRefs.push({ forceRef: force.id, taskRef: ref }));
    return {
      id: force.id,
      label: clean(force.name, 160) || force.id,
      detail: clean(force.task, 500),
      organizationCategory: inferOv4OrganizationCategory({ label: force.name, role: force.role, layer: force.layer }),
      echelonCategory: inferOv4EchelonCategory({ label: force.name, layer: force.layer }),
      forceRefs: [force.id],
      taskRefs,
      layer: force.layer,
      activityIds: [],
      activityCount: 0,
      oodaCount: 0,
      phases: unique(force.phaseIds),
      entityCount: (force.platforms || []).length,
      state: taskRefs.length && !taskRefs.some((ref) => !taskIds.has(ref)) ? "ready" : "review"
    };
  });
  const relations = (plan.relations || []).slice(0, MAX_RELATIONSHIPS).flatMap((relation, index) => {
    const source = forceById.get(relation.fromForceId);
    const target = forceById.get(relation.toForceId);
    if (!source || !target || source.id === target.id) return [];
    return [{
      id: `ov4-${relation.id || stableId(`${source.id}:${target.id}:${relation.type}`)}`,
      sourceRoleId: source.id,
      sourceRoleLabel: source.name,
      targetRoleId: target.id,
      targetRoleLabel: target.name,
      relationshipType: relation.type || "coordination",
      relationshipCategory: inferOv4RelationCategory(relation.type),
      sourceForceRef: source.id,
      targetForceRef: target.id,
      sourceActivityId: "",
      sourceActivityTitle: "",
      targetActivityId: "",
      targetActivityTitle: "",
      state: "ready"
    }];
  });
  const linkedTaskIds = new Set(roles.flatMap((role) => role.taskRefs).filter((ref) => taskIds.has(ref)));
  const unassignedTaskIds = tasks.map((task) => task.id).filter((id) => !linkedTaskIds.has(id));
  const unassignedRoleIds = roles.filter((role) => !role.taskRefs.length).map((role) => role.id);
  const coverage = {
    activity: coverageSummary(tasks.length, unassignedTaskIds.length),
    role: coverageSummary(roles.length, unassignedRoleIds.length)
  };
  const diagnostics = [
    check("force-role-source", "兵力组织来源", roles.length ? "ready" : "pending", roles.length ? `已从作战兵力建立 ${roles.length} 个组织角色` : "尚无可用作战兵力"),
    check("task-responsibility", "任务责任归属", unassignedTaskIds.length || brokenTaskRefs.length ? "review" : tasks.length ? "ready" : "pending", brokenTaskRefs.length ? `${brokenTaskRefs.length} 个任务引用失效` : unassignedTaskIds.length ? `${unassignedTaskIds.length} 个任务尚无兵力承接` : tasks.length ? "全部正式任务均有兵力承接" : "尚无正式任务"),
    check("force-relationships", "兵力组织关系", relations.length ? "ready" : "pending", relations.length ? `已从兵力关系建立 ${relations.length} 条组织关系` : "尚无兵力指挥、协同或保障关系")
  ];
  const diagrams = [{ id: "ov4-diagram-overall", name: "总体组织关系图", description: "按正式作战兵力及其关系生成。", roleIds: roles.map((role) => role.id), relationIds: relations.map((relation) => relation.id) }];
  return {
    version: 2,
    kind: "derived-ov4-force-responsibility",
    generatedAt: new Date().toISOString(),
    source: { taskCount: tasks.length, forceCount: forces.length, forceRelationCount: (plan.relations || []).length },
    roles,
    relations,
    diagrams,
    coverage,
    diagnostics,
    unresolved: { unmappedActivityIds: [], brokenEdgeIds: [], unassignedRoleIds, unassignedTaskIds, brokenTaskRefs }
  };
}

function check(id, label, state, detail) { return { id, label, state, statusLabel: ({ ready: "已满足", review: "需复核", pending: "未完成" })[state] || "需复核", detail }; }
function coverageSummary(total, unresolved) { const covered = Math.max(0, total - unresolved); return { total, covered, unresolved, percent: total ? Math.round((covered / total) * 100) : 0 }; }
function unique(values) { return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))]; }
function clean(value, limit) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit); }
function stableId(value) { let hash = 5381; for (const character of String(value)) hash = ((hash << 5) + hash) ^ character.charCodeAt(0); return (hash >>> 0).toString(36); }
