import { normalizeForceMissionPlan } from "../../shared/conceptPlanning.js";
import { inferOv4EchelonCategory, inferOv4OrganizationCategory, inferOv4RelationCategory, OV4_RELATION_CATEGORIES } from "../../shared/dodaf/ov4Taxonomy.js";

const MAX_ROLES = 128;
const MAX_RELATIONSHIPS = 320;
const RELATION_TYPES = new Set(["command", "support", "coordination", "information"]);

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

export function buildOv4ForceFingerprint(forceMission = {}) {
  const plan = normalizeForceMissionPlan(forceMission);
  const compactForce = (force) => ({
    id: force.id,
    name: force.name,
    side: force.side,
    role: force.role,
    taskRefs: [...(force.taskRefs || [])].sort()
  });
  const text = JSON.stringify({
    forces: plan.forces.map(compactForce),
    combatForces: plan.combatForces.map(compactForce),
    relations: plan.relations.map((item) => ({
      from: item.fromForceId,
      to: item.toForceId,
      type: item.type
    }))
  });
  let hashA = 2166136261;
  let hashB = 2246822507;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    hashA = Math.imul(hashA ^ code, 16777619);
    hashB = Math.imul(hashB ^ code, 3266489917);
  }
  return `ov4-force:${(hashA >>> 0).toString(16).padStart(8, "0")}${(hashB >>> 0).toString(16).padStart(8, "0")}`;
}

export function applyOrganizationRelationshipDraft(state = {}, draft = {}, { source = "ai", fingerprint = "" } = {}) {
  const seeded = buildOv4Model(state);
  const roleById = new Map((seeded.roles || []).map((role) => [role.id, role]));
  const seen = new Set();
  const relations = (Array.isArray(draft?.relations) ? draft.relations : []).flatMap((item, index) => {
    const sourceRoleId = String(item?.fromForceId || item?.sourceRoleId || "").trim();
    const targetRoleId = String(item?.toForceId || item?.targetRoleId || "").trim();
    if (!roleById.has(sourceRoleId) || !roleById.has(targetRoleId) || sourceRoleId === targetRoleId) return [];
    const type = RELATION_TYPES.has(String(item?.type || "").trim()) ? String(item.type).trim() : "coordination";
    const key = `${sourceRoleId}:${targetRoleId}:${type}`;
    if (seen.has(key) || seen.size >= MAX_RELATIONSHIPS) return [];
    seen.add(key);
    const category = OV4_RELATION_CATEGORIES.includes(String(item?.relationshipCategory || "").trim())
      ? String(item.relationshipCategory).trim()
      : inferOv4RelationCategory(type);
    const sourceRole = roleById.get(sourceRoleId);
    const targetRole = roleById.get(targetRoleId);
    return [{
      id: `ov4-${stableId(key) || index + 1}`,
      sourceRoleId,
      sourceRoleLabel: sourceRole.label,
      targetRoleId,
      targetRoleLabel: targetRole.label,
      relationshipType: type,
      relationshipCategory: category,
      sourceForceRef: sourceRoleId,
      targetForceRef: targetRoleId,
      sourceActivityId: "",
      sourceActivityTitle: "",
      targetActivityId: "",
      targetActivityTitle: "",
      state: "ready"
    }];
  });
  const appliedRelations = relations.length ? relations : seeded.relations || [];
  const diagrams = diagramsFromDraft(seeded.roles || [], appliedRelations, draft);
  const relationCount = appliedRelations.length;
  const diagnostics = (seeded.diagnostics || []).map((item) => (
    item.id === "force-relationships" || item.id === "role-relationships"
      ? check(item.id, item.label, relationCount ? "ready" : "pending", relationCount ? `已生成 ${relationCount} 条组织关系` : item.detail)
      : item
  ));
  return {
    ...seeded,
    relations: appliedRelations,
    diagrams,
    diagnostics,
    derivedFrom: {
      mode: source === "ai" ? "ai" : "local-fallback",
      sources: ["forceMissionPlan"],
      generatedAt: new Date().toISOString(),
      note: fingerprint || buildOv4ForceFingerprint(state.forceMission)
    }
  };
}

function layerDiagrams(roles, relations) {
  const scoped = (id, name, description, ids) => {
    if (!ids.length) return null;
    const included = new Set(ids);
    return {
      id,
      name,
      description,
      roleIds: ids,
      relationIds: relations.filter((relation) => included.has(relation.sourceRoleId) && included.has(relation.targetRoleId)).map((relation) => relation.id)
    };
  };
  const conceptIds = roles.filter((role) => role.layer === "concept").map((role) => role.id);
  const combatIds = roles.filter((role) => role.layer === "combat").map((role) => role.id);
  if (combatIds.length && conceptIds.length) {
    return [
      scoped("ov4-diagram-combat", "作战组织关系图", "按作战兵力展示指挥、保障与信息关系。", combatIds),
      scoped("ov4-diagram-concept", "概念组织关系图", "按概念兵力展示职责与协同关系。", conceptIds)
    ].filter(Boolean);
  }
  if (combatIds.length) {
    return [scoped("ov4-diagram-combat", "作战组织关系图", "按作战兵力展示指挥、保障与信息关系。", combatIds)];
  }
  if (conceptIds.length) {
    return [scoped("ov4-diagram-concept", "概念组织关系图", "按概念兵力展示职责与协同关系。", conceptIds)];
  }
  return [scoped("ov4-diagram-overall", "总体组织关系图", "覆盖当前组织角色与协同关系。", roles.map((role) => role.id))].filter(Boolean);
}

function diagramsFromDraft(roles, relations, draft) {
  const layers = layerDiagrams(roles, relations);
  const layerIdSets = layers.map((diagram) => [...diagram.roleIds].sort().join("|"));
  const knownIds = new Set(roles.map((role) => role.id));
  const slices = (Array.isArray(draft?.diagrams) ? draft.diagrams : []).slice(0, 8).map((diagram, index) => {
    const ids = unique(diagram?.roleIds).filter((id) => knownIds.has(id));
    if (!ids.length) return null;
    const signature = [...ids].sort().join("|");
    if (layerIdSets.includes(signature)) return null;
    const included = new Set(ids);
    return {
      id: `ov4-diagram-${index + 1}`,
      name: clean(diagram?.name, 160) || `组织关系图 ${index + 1}`,
      description: clean(diagram?.description, 800),
      roleIds: ids,
      relationIds: relations.filter((relation) => included.has(relation.sourceRoleId) && included.has(relation.targetRoleId)).map((relation) => relation.id)
    };
  }).filter(Boolean);
  return [...layers, ...slices];
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
  const diagrams = layerDiagrams(roles, relations);
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

/**
 * 将 OV-4 组织关系生成分析切分为小批次（宏观骨干网 + 各作战群战术协同网）
 * 防止一次性向大模型发送全部兵力导致长 token 生成超时（3分钟门禁）
 */
export function buildOrganizationRelationshipBatches(analysis = {}, maxForcesPerBatch = 8) {
  const forces = Array.isArray(analysis?.forces) ? analysis.forces : [];
  const combatForces = Array.isArray(analysis?.combatForces) ? analysis.combatForces : [];
  const totalCount = forces.length + combatForces.length;

  if (totalCount <= 10) {
    return [{
      id: "batch-all",
      title: "全部兵力组织关系",
      type: "all",
      analysis: { ...analysis },
      expectedRelationCount: Math.min(24, Math.max(4, totalCount * 2))
    }];
  }

  const batches = [];

  // 1. 宏观骨干批次（概念兵力 / 各作战群顶层指控机构）
  if (forces.length) {
    const forceIdSet = new Set(forces.map((f) => f.id));
    const backboneExisting = (analysis.existingRelations || []).filter(
      (rel) => forceIdSet.has(rel.fromForceId) && forceIdSet.has(rel.toForceId)
    );
    batches.push({
      id: "batch-backbone",
      title: "宏观指挥控制网络",
      type: "backbone",
      analysis: {
        ...analysis,
        forces,
        combatForces: [],
        existingRelations: backboneExisting,
        batchScope: "backbone",
        generationConstraint: "本批仅推导概念兵力/作战群顶层之间的宏观指挥(command)、支援(support)与协同(coordination)网络，直接返回 JSON。"
      },
      expectedRelationCount: Math.min(20, Math.max(4, forces.length * 2))
    });
  }

  // 2. 作战群内部协同批次（按所属概念兵力 conceptForceId 聚类）
  if (combatForces.length) {
    const clusterMap = new Map();
    combatForces.forEach((cf) => {
      const parentId = String(cf.conceptForceId || cf.side || "other").trim();
      if (!clusterMap.has(parentId)) clusterMap.set(parentId, []);
      clusterMap.get(parentId).push(cf);
    });

    // 将 cluster 聚合成合适大小的批次（4～8个实体）
    let currentBatchForces = [];
    let currentParentIds = new Set();
    let clusterIndex = 1;

    const flushClusterBatch = () => {
      if (!currentBatchForces.length) return;
      const relatedForces = forces.filter((f) => currentParentIds.has(f.id));
      const batchForceIdSet = new Set([...relatedForces.map((f) => f.id), ...currentBatchForces.map((f) => f.id)]);
      const clusterExisting = (analysis.existingRelations || []).filter(
        (rel) => batchForceIdSet.has(rel.fromForceId) && batchForceIdSet.has(rel.toForceId)
      );
      batches.push({
        id: `batch-cluster-${clusterIndex}`,
        title: `作战群协同网（第 ${clusterIndex} 组）`,
        type: "cluster",
        analysis: {
          ...analysis,
          forces: relatedForces,
          combatForces: currentBatchForces,
          existingRelations: clusterExisting,
          batchScope: "cluster",
          generationConstraint: "本批仅推导该作战群内各实体之间以及与所属群指控节点之间的战术协同(coordination)、火力支援(support)、信息分发(information)关系，直接返回 JSON。"
        },
        expectedRelationCount: Math.min(24, Math.max(4, currentBatchForces.length * 2))
      });
      clusterIndex += 1;
      currentBatchForces = [];
      currentParentIds = new Set();
    };

    clusterMap.forEach((members, parentId) => {
      if (currentBatchForces.length + members.length > maxForcesPerBatch && currentBatchForces.length > 0) {
        flushClusterBatch();
      }
      currentBatchForces.push(...members);
      if (parentId) currentParentIds.add(parentId);
      if (currentBatchForces.length >= maxForcesPerBatch) {
        flushClusterBatch();
      }
    });

    flushClusterBatch();
  }

  return batches.length ? batches : [{
    id: "batch-all",
    title: "全部兵力组织关系",
    type: "all",
    analysis: { ...analysis },
    expectedRelationCount: 16
  }];
}

/**
 * 合并多个批次生成的组织关系草案，进行去重和规整
 */
export function mergeOrganizationRelationshipDrafts(drafts = [], analysis = {}) {
  const validDrafts = (Array.isArray(drafts) ? drafts : []).filter(Boolean);
  if (!validDrafts.length) return { summary: "未生成有效组织关系草案。", relations: [], diagrams: [] };

  const seen = new Set();
  const mergedRelations = [];
  const mergedDiagrams = [];
  const summaryParts = [];

  validDrafts.forEach((draft) => {
    if (draft.summary && !summaryParts.includes(draft.summary)) {
      summaryParts.push(draft.summary);
    }
    (Array.isArray(draft.relations) ? draft.relations : []).forEach((rel) => {
      const from = String(rel.fromForceId || rel.sourceRoleId || "").trim();
      const to = String(rel.toForceId || rel.targetRoleId || "").trim();
      const type = String(rel.type || "coordination").trim();
      if (!from || !to || from === to) return;
      const key = `${from}:${to}:${type}`;
      if (seen.has(key)) return;
      seen.add(key);
      mergedRelations.push(rel);
    });
    (Array.isArray(draft.diagrams) ? draft.diagrams : []).forEach((diag) => {
      if (diag.name && !mergedDiagrams.some((d) => d.name === diag.name)) {
        mergedDiagrams.push(diag);
      }
    });
  });

  return {
    summary: summaryParts.join(" ") || "已分批完成组织关系与指挥协同链推导。",
    relations: mergedRelations,
    diagrams: mergedDiagrams
  };
}
