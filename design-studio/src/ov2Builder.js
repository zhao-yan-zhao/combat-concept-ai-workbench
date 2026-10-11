import { normalizeForceMissionPlan } from "../../shared/conceptPlanning.js";

const MAX_NODES = 48;
const MAX_EXCHANGES = 160;

export function buildOv2Model({ forceMission, ov4, ov1, ov5, ooda, scenario } = {}) {
  const formalPlan = normalizeForceMissionPlan(forceMission);
  const normalizedOv4 = ov4 && typeof ov4 === "object" ? ov4 : null;
  if (formalPlan.forces.length || formalPlan.combatForces.length || (normalizedOv4?.roles || []).length) {
    return buildForceLinkedOv2(formalPlan, normalizedOv4);
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

export function buildOv2ForceFingerprint(forceMission = {}, ov4 = null) {
  const plan = normalizeForceMissionPlan(forceMission);
  const compactForce = (force) => ({
    id: force.id,
    name: force.name,
    side: force.side,
    role: force.role,
    taskRefs: [...(force.taskRefs || [])].sort()
  });
  const compactRelation = (item) => ({
    from: item.fromForceId || item.sourceRoleId,
    to: item.toForceId || item.targetRoleId,
    type: item.type || item.relationshipType || item.flowType
  });
  const ov4Relations = Array.isArray(ov4?.relations) ? ov4.relations.map(compactRelation) : [];
  const planRelations = Array.isArray(plan?.relations) ? plan.relations.map(compactRelation) : [];
  const text = JSON.stringify({
    forces: plan.forces.map(compactForce),
    combatForces: plan.combatForces.map(compactForce),
    planRelations,
    ov4Relations
  });
  let hashA = 2166136261;
  let hashB = 2246822507;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    hashA = Math.imul(hashA ^ code, 16777619);
    hashB = Math.imul(hashB ^ code, 3266489917);
  }
  return `ov2-force:${(hashA >>> 0).toString(16).padStart(8, "0")}${(hashB >>> 0).toString(16).padStart(8, "0")}`;
}

export function applyResourceFlowDraft(state = {}, draft = {}, { source = "ai", fingerprint = "" } = {}) {
  const seeded = buildOv2Model(state);
  const nodeById = new Map((seeded.nodes || []).map((node) => [node.id, node]));
  const seen = new Set();
  const exchanges = (Array.isArray(draft?.exchanges) ? draft.exchanges : []).flatMap((item, index) => {
    const sourceNodeId = String(item?.sourceNodeId || item?.fromForceId || "").trim();
    const targetNodeId = String(item?.targetNodeId || item?.toForceId || "").trim();
    if (!nodeById.has(sourceNodeId) || !nodeById.has(targetNodeId) || sourceNodeId === targetNodeId) return [];
    const flowType = ["控制流", "信息流", "资源流"].includes(item?.flowType)
      ? item.flowType
      : (item?.flowType === "command" ? "控制流" : item?.flowType === "support" ? "资源流" : "信息流");
    const key = `${sourceNodeId}:${targetNodeId}:${flowType}`;
    if (seen.has(key) || seen.size >= MAX_EXCHANGES) return [];
    seen.add(key);
    const sourceNode = nodeById.get(sourceNodeId);
    const targetNode = nodeById.get(targetNodeId);
    const label = clean(item.label || `${sourceNode.label} → ${targetNode.label} ${flowType}`, 240);
    const output = clean(item.output || `${sourceNode.label}输出：${flowType}（${label}）`, 320);
    const input = clean(item.input || `${targetNode.label}接收：${flowType}（${label}）`, 320);
    return [{
      id: `ov2-${stableId(key) || index + 1}`,
      sourceNodeId,
      targetNodeId,
      sourceNodeLabel: sourceNode.label,
      targetNodeLabel: targetNode.label,
      label,
      flowType,
      sourceForceRef: sourceNodeId,
      targetForceRef: targetNodeId,
      taskRefs: unique([...(sourceNode.taskRefs || []), ...(targetNode.taskRefs || [])]),
      sourceActivityId: "",
      sourceActivityTitle: "",
      targetActivityId: "",
      targetActivityTitle: "",
      output,
      input
    }];
  });

  const appliedExchanges = exchanges.length ? exchanges : seeded.exchanges || [];
  const exchangeCount = appliedExchanges.length;
  const diagnostics = (seeded.diagnostics || []).map((item) => (
    item.id === "node-exchanges"
      ? check(item.id, item.label, exchangeCount ? "ready" : "pending", exchangeCount ? `已建立 ${exchangeCount} 条资源交换 (Needlines)` : item.detail)
      : item
  ));

  return {
    ...seeded,
    exchanges: appliedExchanges,
    diagnostics,
    derivedFrom: {
      mode: source === "ai" ? "ai" : "local-fallback",
      sources: ["forceMissionPlan", "ov4"],
      generatedAt: new Date().toISOString(),
      note: fingerprint || buildOv2ForceFingerprint(state.forceMission, state.ov4)
    }
  };
}

function buildForceLinkedOv2(plan, ov4 = null) {
  const tasks = plan.tasks || [];
  const taskIds = new Set(tasks.map((task) => task.id));
  const forces = [
    ...(plan.forces || []).map((force) => ({ ...force, layer: "concept" })),
    ...(plan.combatForces || []).map((force) => ({ ...force, layer: "combat" }))
  ].slice(0, MAX_NODES);

  // If ov4 has roles not in forces, supplement them
  const forceIds = new Set(forces.map((force) => force.id));
  if (ov4 && Array.isArray(ov4.roles)) {
    ov4.roles.forEach((role) => {
      if (!forceIds.has(role.id) && forces.length < MAX_NODES) {
        forces.push({
          id: role.id,
          name: role.label || role.id,
          task: role.detail || "",
          taskRefs: role.taskRefs || [],
          platforms: [],
          layer: role.layer || "concept"
        });
        forceIds.add(role.id);
      }
    });
  }

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

  const exchanges = [];
  const seen = new Set();

  // 1. Map from ov4.relations (primary authority for organization relationships)
  if (ov4 && Array.isArray(ov4.relations)) {
    ov4.relations.slice(0, MAX_EXCHANGES).forEach((rel, index) => {
      const source = forceById.get(rel.sourceRoleId);
      const target = forceById.get(rel.targetRoleId);
      if (!source || !target || source.id === target.id) return;
      const cat = String(rel.relationshipCategory || "");
      const type = String(rel.relationshipType || "");
      let flowType = "信息流";
      if (cat.includes("指挥") || type === "command") flowType = "控制流";
      else if (cat.includes("保障") || type === "support") flowType = "资源流";
      else flowType = "信息流";

      const key = `${source.id}:${target.id}:${flowType}`;
      if (seen.has(key) || exchanges.length >= MAX_EXCHANGES) return;
      seen.add(key);

      const taskRefs = unique([...(source.taskRefs || []), ...(target.taskRefs || [])]);
      const label = clean(rel.note || (flowType === "控制流" ? `${source.name}指派指令` : flowType === "资源流" ? `${source.name}保障支援` : `${source.name}态势分发`), 240);
      const output = clean(rel.output || `${source.name}输出：${flowType}（${label}）`, 320);
      const input = clean(rel.input || `${target.name}接收：${flowType}（${label}）`, 320);

      exchanges.push({
        id: `ov2-${rel.id || stableId(key) || index + 1}`,
        sourceNodeId: source.id,
        targetNodeId: target.id,
        sourceNodeLabel: source.name,
        targetNodeLabel: target.name,
        label,
        flowType,
        sourceForceRef: source.id,
        targetForceRef: target.id,
        taskRefs,
        sourceActivityId: "",
        sourceActivityTitle: "",
        targetActivityId: "",
        targetActivityTitle: "",
        input,
        output
      });
    });
  }

  // 2. Map from plan.relations (if any not already mapped)
  (plan.relations || []).slice(0, MAX_EXCHANGES).forEach((relation, index) => {
    const source = forceById.get(relation.fromForceId);
    const target = forceById.get(relation.toForceId);
    if (!source || !target || source.id === target.id) return;
    const type = String(relation.type || "");
    const flowType = type === "command" ? "控制流" : type === "support" ? "资源流" : "信息流";
    const key = `${source.id}:${target.id}:${flowType}`;
    if (seen.has(key) || exchanges.length >= MAX_EXCHANGES) return;
    seen.add(key);

    const taskRefs = unique([...(source.taskRefs || []), ...(target.taskRefs || [])]);
    const label = clean(relation.note || relation.type || "资源交换", 240);
    const output = clean(relation.output || relation.note || `${source.name}输出：${label}`, 320);
    const input = clean(relation.input || relation.note || `${target.name}接收：${label}`, 320);

    exchanges.push({
      id: `ov2-${relation.id || stableId(key) || index + 1}`,
      sourceNodeId: source.id,
      targetNodeId: target.id,
      sourceNodeLabel: source.name,
      targetNodeLabel: target.name,
      label,
      flowType,
      sourceForceRef: source.id,
      targetForceRef: target.id,
      taskRefs,
      sourceActivityId: "",
      sourceActivityTitle: "",
      targetActivityId: "",
      targetActivityTitle: "",
      input,
      output
    });
  });

  // 3. Fallback baseline if no relations present yet: chain adjacent forces
  if (!exchanges.length && forces.length >= 2) {
    for (let i = 0; i < Math.min(forces.length - 1, 6); i++) {
      const source = forces[i];
      const target = forces[i + 1];
      const flowType = i === 0 ? "控制流" : "信息流";
      const key = `${source.id}:${target.id}:${flowType}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const label = flowType === "控制流" ? `${source.name}指挥协同指令` : `${source.name}战术态势数据`;
      exchanges.push({
        id: `ov2-baseline-${stableId(key)}`,
        sourceNodeId: source.id,
        targetNodeId: target.id,
        sourceNodeLabel: source.name,
        targetNodeLabel: target.name,
        label,
        flowType,
        sourceForceRef: source.id,
        targetForceRef: target.id,
        taskRefs: (source.taskRefs || []).filter((id) => taskIds.has(id)),
        sourceActivityId: "",
        sourceActivityTitle: "",
        targetActivityId: "",
        targetActivityTitle: "",
        output: `${source.name}输出：${label}`,
        input: `${target.name}接收：${label}`
      });
    }
  }

  const linkedTaskIds = new Set(nodes.flatMap((node) => node.taskRefs).filter((ref) => taskIds.has(ref)));
  const unassignedTaskIds = tasks.map((task) => task.id).filter((id) => !linkedTaskIds.has(id));
  const diagnostics = [
    check("operational-nodes", "兵力资源节点", nodes.length ? "ready" : "pending", nodes.length ? `已从作战兵力建立 ${nodes.length} 个资源节点` : "尚无可用作战兵力"),
    check("task-ownership", "任务来源引用", unassignedTaskIds.length || brokenTaskRefs.length ? "review" : tasks.length ? "ready" : "pending", brokenTaskRefs.length ? `${brokenTaskRefs.length} 个任务引用失效` : unassignedTaskIds.length ? `${unassignedTaskIds.length} 个任务尚未进入资源节点` : tasks.length ? "全部正式任务均进入资源节点" : "尚无正式任务"),
    check("node-exchanges", "兵力间资源交换", exchanges.length ? "ready" : "pending", exchanges.length ? `已从组织关系与兵力关系建立 ${exchanges.length} 条资源交换 (Needlines)` : "尚无可投影的兵力与组织关系")
  ];
  return {
    version: 2,
    kind: "derived-ov2-force-resource-flow",
    generatedAt: new Date().toISOString(),
    source: { taskCount: tasks.length, forceCount: forces.length, forceRelationCount: (plan.relations || []).length + (ov4?.relations || []).length },
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
