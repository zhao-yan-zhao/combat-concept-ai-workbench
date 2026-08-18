import { normalizeForceMissionPlan } from "../../shared/conceptPlanning.js";

const MAX_NODES = 48;
const MAX_EXCHANGES = 160;

export function buildOv2Model({ forceMission, ov1, ov5, ooda, scenario } = {}) {
  const formalPlan = normalizeForceMissionPlan(forceMission);
  if (formalPlan.forces.length || formalPlan.combatForces.length) {
    return buildForceLinkedOv2(formalPlan);
  }
  const sourceNodes = Array.isArray(ov1?.nodes) ? ov1.nodes.slice(0, MAX_NODES) : [];
  const activities = Array.isArray(ov5?.activities) ? ov5.activities : [];
  const edges = Array.isArray(ov5?.edges) ? ov5.edges : [];
  const oodaNodes = flattenOoda(ooda);
  const entities = Array.isArray(scenario?.entities) ? scenario.entities : [];
  const nodeById = new Map(sourceNodes.map((node) => [String(node.id), node]));
  const activityById = new Map(activities.map((activity) => [String(activity.id), activity]));
  const assignments = new Map(sourceNodes.map((node) => [String(node.id), []]));
  const unmappedActivityIds = [];

  activities.forEach((activity) => {
    const sourceIds = unique(activity.sourceOv1NodeIds).filter((id) => nodeById.has(id));
    if (!sourceIds.length) {
      unmappedActivityIds.push(String(activity.id));
      return;
    }
    sourceIds.forEach((id) => assignments.get(id).push(activity));
  });

  const nodes = sourceNodes.map((node) => {
    const id = String(node.id);
    const assignedActivities = assignments.get(id) || [];
    const activityIds = assignedActivities.map((activity) => String(activity.id));
    return {
      id,
      label: clean(node.label, 160) || id,
      detail: clean(node.detail || node.description, 500),
      sourceOv1NodeId: id,
      activityIds,
      activityCount: activityIds.length,
      oodaCount: oodaNodes.filter((item) => activityIds.includes(item.sourceActivityId)).length,
      entityCount: entities.filter((item) => activityIds.includes(String(item.sourceActivityId))).length
    };
  });

  const exchanges = [];
  const seen = new Set();
  const brokenEdgeIds = [];
  edges.slice(0, MAX_EXCHANGES).forEach((edge, index) => {
    const sourceActivity = activityById.get(String(edge.sourceId));
    const targetActivity = activityById.get(String(edge.targetId));
    const sourceNodeIds = unique(sourceActivity?.sourceOv1NodeIds).filter((id) => nodeById.has(id));
    const targetNodeIds = unique(targetActivity?.sourceOv1NodeIds).filter((id) => nodeById.has(id));
    if (!sourceActivity || !targetActivity || !sourceNodeIds.length || !targetNodeIds.length) {
      brokenEdgeIds.push(String(edge.id || `edge-${index + 1}`));
      return;
    }
    sourceNodeIds.forEach((sourceNodeId) => targetNodeIds.forEach((targetNodeId) => {
      if (sourceNodeId === targetNodeId || exchanges.length >= MAX_EXCHANGES) return;
      const key = `${sourceNodeId}:${targetNodeId}:${sourceActivity.id}:${targetActivity.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      exchanges.push({
        id: `ov2-${stableId(key)}`,
        sourceNodeId,
        targetNodeId,
        sourceNodeLabel: clean(nodeById.get(sourceNodeId)?.label, 160) || sourceNodeId,
        targetNodeLabel: clean(nodeById.get(targetNodeId)?.label, 160) || targetNodeId,
        label: clean(sourceActivity.output, 240) || clean(edge.type, 120) || "信息交换",
        flowType: clean(edge.type, 120) || "信息流",
        sourceActivityId: String(sourceActivity.id),
        sourceActivityTitle: clean(sourceActivity.title, 240),
        targetActivityId: String(targetActivity.id),
        targetActivityTitle: clean(targetActivity.title, 240),
        input: clean(targetActivity.input, 320),
        output: clean(sourceActivity.output, 320)
      });
    }));
  });

  const diagnostics = [
    check("operational-nodes", "作战节点映射", nodes.length ? "ready" : "pending", nodes.length ? `已从 OV-1 推导 ${nodes.length} 个作战节点` : "尚未定义可用于 OV-2 的 OV-1 节点"),
    check("activity-ownership", "活动归属", unmappedActivityIds.length ? "review" : activities.length ? "ready" : "pending", unmappedActivityIds.length ? `${unmappedActivityIds.length} 个 OV-5 活动尚未关联 OV-1 节点` : activities.length ? "全部 OV-5 活动均有来源作战节点" : "尚未定义 OV-5 活动"),
    check("node-exchanges", "节点间交换", brokenEdgeIds.length ? "review" : exchanges.length ? "ready" : "pending", brokenEdgeIds.length ? `${brokenEdgeIds.length} 条 OV-5 边无法解析为跨节点交换` : exchanges.length ? `已从 OV-5 推导 ${exchanges.length} 条跨节点交换` : "尚未找到跨作战节点的 OV-5 关系")
  ];
  return {
    version: 1,
    kind: "derived-ov2-operational-exchange",
    generatedAt: new Date().toISOString(),
    source: {
      ov1NodeCount: sourceNodes.length,
      ov5ActivityCount: activities.length,
      ov5EdgeCount: edges.length,
      oodaNodeCount: oodaNodes.length,
      scenarioEntityCount: entities.length
    },
    nodes,
    exchanges,
    diagnostics,
    unresolved: { unmappedActivityIds, brokenEdgeIds }
  };
}

function buildForceLinkedOv2(plan) {
  const tasks = plan.tasks || [];
  const taskIds = new Set(tasks.map((task) => task.id));
  const forces = [
    ...(plan.forces || []).map((force) => ({ ...force, layer: "concept" })),
    ...(plan.combatForces || []).map((force) => ({ ...force, layer: "combat" }))
  ].slice(0, MAX_NODES);
  const forceById = new Map(forces.map((force) => [force.id, force]));
  const brokenTaskRefs = [];
  const nodes = forces.map((force) => {
    const taskRefs = unique(force.taskRefs);
    taskRefs.filter((ref) => !taskIds.has(ref)).forEach((ref) => brokenTaskRefs.push({ forceRef: force.id, taskRef: ref }));
    return {
      id: force.id,
      label: clean(force.name, 160) || force.id,
      detail: clean(force.task, 500),
      sourceOv1NodeId: "",
      forceRefs: [force.id],
      taskRefs,
      layer: force.layer,
      activityIds: [],
      activityCount: 0,
      oodaCount: 0,
      entityCount: (force.platforms || []).length
    };
  });
  const exchanges = (plan.relations || []).slice(0, MAX_EXCHANGES).flatMap((relation) => {
    const source = forceById.get(relation.fromForceId);
    const target = forceById.get(relation.toForceId);
    if (!source || !target || source.id === target.id) return [];
    const taskRefs = unique([...(source.taskRefs || []), ...(target.taskRefs || [])]);
    return [{
      id: `ov2-${relation.id || stableId(`${source.id}:${target.id}:${relation.type}`)}`,
      sourceNodeId: source.id,
      targetNodeId: target.id,
      sourceNodeLabel: source.name,
      targetNodeLabel: target.name,
      label: clean(relation.note, 240) || relation.type || "资源交换",
      flowType: relation.type || "information",
      sourceForceRef: source.id,
      targetForceRef: target.id,
      taskRefs,
      sourceActivityId: "",
      sourceActivityTitle: "",
      targetActivityId: "",
      targetActivityTitle: "",
      input: clean(relation.note, 320),
      output: clean(relation.note, 320)
    }];
  });
  const linkedTaskIds = new Set(nodes.flatMap((node) => node.taskRefs).filter((ref) => taskIds.has(ref)));
  const unassignedTaskIds = tasks.map((task) => task.id).filter((id) => !linkedTaskIds.has(id));
  const diagnostics = [
    check("operational-nodes", "兵力资源节点", nodes.length ? "ready" : "pending", nodes.length ? `已从作战兵力建立 ${nodes.length} 个资源节点` : "尚无可用作战兵力"),
    check("task-ownership", "任务来源引用", unassignedTaskIds.length || brokenTaskRefs.length ? "review" : tasks.length ? "ready" : "pending", brokenTaskRefs.length ? `${brokenTaskRefs.length} 个任务引用失效` : unassignedTaskIds.length ? `${unassignedTaskIds.length} 个任务尚未进入资源节点` : tasks.length ? "全部正式任务均进入资源节点" : "尚无正式任务"),
    check("node-exchanges", "兵力间资源交换", exchanges.length ? "ready" : "pending", exchanges.length ? `已从兵力关系建立 ${exchanges.length} 条资源交换` : "尚无可投影的兵力关系")
  ];
  return {
    version: 2,
    kind: "derived-ov2-force-resource-flow",
    generatedAt: new Date().toISOString(),
    source: { taskCount: tasks.length, forceCount: forces.length, forceRelationCount: (plan.relations || []).length },
    nodes,
    exchanges,
    diagnostics,
    unresolved: { unmappedActivityIds: [], brokenEdgeIds: [], unassignedTaskIds, brokenTaskRefs }
  };
}

function flattenOoda(ooda) {
  return (Array.isArray(ooda?.lanes) ? ooda.lanes : []).flatMap((lane) => lane.nodes || []);
}

function check(id, label, state, detail) {
  return { id, label, state, statusLabel: ({ ready: "已满足", review: "需复核", pending: "未完成" })[state], detail };
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function clean(value, limit) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function stableId(value) {
  let hash = 5381;
  for (const character of String(value)) hash = ((hash << 5) + hash) ^ character.charCodeAt(0);
  return (hash >>> 0).toString(36);
}
