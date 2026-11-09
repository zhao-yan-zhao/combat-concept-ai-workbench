/**
 * Cross-product DM2 entity/relation consistency for the operational subset.
 * Pure function — safe for browser and server.
 */

import { PRODUCT_BY_RESOURCE, RESOURCE_BY_PRODUCT } from "./constants.js";
import { clean } from "./util.js";

const PRODUCT_KEYS = ["ov1", "ov2", "ov3", "ov4", "ov5a", "ov5", "ov6a", "ov6b", "ov6c"];

/**
 * @param {object} models - map of resourceKey -> product model (and optional architecture)
 * @returns {{ score: number, issueCount: number, issues: object[], summary: object }}
 */
export function inspectArchitectureConsistency(models = {}) {
  const products = {};
  for (const key of PRODUCT_KEYS) {
    const model = models[key];
    if (model && typeof model === "object") products[key] = model;
  }
  const architecture = models.architecture && typeof models.architecture === "object" ? models.architecture : null;
  const issues = [];

  const entityIndex = new Map(); // id -> [{ resource, entity }]
  const relationIssues = [];

  for (const [resource, model] of Object.entries(products)) {
    const entities = Array.isArray(model.entities) ? model.entities : [];
    const relations = Array.isArray(model.relations) ? model.relations : [];
    const entityIds = new Set(entities.map((entity) => String(entity.id)));

    entities.forEach((entity) => {
      const id = String(entity.id || "");
      if (!id) return;
      if (!entityIndex.has(id)) entityIndex.set(id, []);
      entityIndex.get(id).push({ resource, entity });
    });

    relations.forEach((relation) => {
      const sourceId = String(relation.sourceId || "");
      const targetId = String(relation.targetId || "");
      if (sourceId && !entityIds.has(sourceId) && !entityPresentElsewhere(sourceId, resource, products, architecture)) {
        relationIssues.push({
          resource,
          relationId: relation.id,
          endpoint: sourceId,
          side: "source",
          dm2Type: relation.dm2Type
        });
      }
      if (targetId && !entityIds.has(targetId) && !entityPresentElsewhere(targetId, resource, products, architecture)) {
        relationIssues.push({
          resource,
          relationId: relation.id,
          endpoint: targetId,
          side: "target",
          dm2Type: relation.dm2Type
        });
      }
    });
  }

  // Same id, conflicting dm2Type or divergent names across products
  for (const [id, occurrences] of entityIndex.entries()) {
    if (occurrences.length < 2) continue;
    const types = unique(occurrences.map((item) => clean(item.entity.dm2Type, 40)));
    const names = unique(occurrences.map((item) => clean(item.entity.name, 240).toLowerCase()));
    if (types.length > 1 && !typesAreCompatible(types)) {
      issues.push(makeIssue({
        id: `entity-type-conflict-${id}`,
        code: "entity-type-conflict",
        severity: "alert",
        group: "contract",
        title: `实体类型冲突：${id}`,
        detail: `同一实体 ID 在多个产品中的 dm2Type 不一致：${types.join(" / ")}（${occurrences.map((item) => productLabel(item.resource)).join("、")}）。`,
        entityId: id,
        resources: occurrences.map((item) => item.resource),
        targetView: occurrences[0].resource
      }));
    } else if (names.length > 1) {
      issues.push(makeIssue({
        id: `entity-name-divergence-${id}`,
        code: "entity-name-divergence",
        severity: "review",
        group: "contract",
        title: `实体名称分歧：${id}`,
        detail: `同一实体 ID 在多个产品中的名称不一致：${occurrences.map((item) => `${productLabel(item.resource)}「${item.entity.name}」`).join("；")}。`,
        entityId: id,
        resources: occurrences.map((item) => item.resource),
        targetView: occurrences[0].resource
      }));
    }
  }

  // 跨产品行为一致性形式化检验：OV-6b 状态机死锁与不可达检测
  if (products.ov6b) {
    const ov6bDiag = inspectOv6bStateMachine(products.ov6b);
    issues.push(...ov6bDiag.issues);
  }

  // 跨产品因果时序形式化检验：OV-5b 依赖与 OV-6c 事件顺序偏序校验
  if (products.ov5 && products.ov6c) {
    const causalDiag = inspectCausalEventOrdering(products.ov5, products.ov6c);
    issues.push(...causalDiag.issues);
  }

  relationIssues.slice(0, 40).forEach((item) => {
    issues.push(makeIssue({
      id: `relation-endpoint-missing-${item.resource}-${item.relationId}-${item.side}`,
      code: "relation-endpoint-missing",
      severity: "review",
      group: "contract",
      title: `${productLabel(item.resource)} 关系端点缺失`,
      detail: `关系 ${item.relationId || "?"} 的 ${item.side} 端点「${item.endpoint}」不在本产品实体中，也不在共享架构库或其他产品中。`,
      entityId: item.endpoint,
      resources: [item.resource],
      targetView: item.resource
    }));
  });

  // Cross references: OV-5 sourceOv1NodeIds → OV-1
  const ov1Ids = new Set((products.ov1?.nodes || products.ov1?.entities || []).map((item) => String(item.id)));
  if (products.ov5 && ov1Ids.size) {
    (products.ov5.activities || []).forEach((activity) => {
      const missing = (activity.sourceOv1NodeIds || []).map(String).filter((id) => id && !ov1Ids.has(id));
      if (!missing.length) return;
      issues.push(makeIssue({
        id: `ov5-source-ov1-missing-${activity.id}`,
        code: "ov5-source-ov1-missing",
        severity: "review",
        group: "mapping",
        title: `OV-5 活动引用了不存在的 OV-1 节点`,
        detail: `活动「${activity.title || activity.id}」的 sourceOv1NodeIds 含未知节点：${missing.join("、")}。`,
        entityId: activity.id,
        resources: ["ov5", "ov1"],
        targetView: "ov5"
      }));
    });
  }

  // OV-2 exchanges referencing OV-1 nodes
  if (products.ov2 && ov1Ids.size) {
    (products.ov2.exchanges || []).forEach((exchange) => {
      const missing = [exchange.sourceNodeId, exchange.targetNodeId].map(String).filter((id) => id && !ov1Ids.has(id));
      if (!missing.length) return;
      issues.push(makeIssue({
        id: `ov2-node-missing-${exchange.id}`,
        code: "ov2-node-missing",
        severity: "review",
        group: "mapping",
        title: `OV-2 交换引用了不存在的作战节点`,
        detail: `交换「${exchange.label || exchange.id}」引用节点：${missing.join("、")}，当前 OV-1 中不存在。`,
        entityId: exchange.id,
        resources: ["ov2", "ov1"],
        targetView: "ov2"
      }));
    });
  }

  // Architecture library coverage when architecture is present
  if (architecture) {
    const libraryIds = new Set((architecture.entities || []).map((entity) => String(entity.id)));
    const productEntityIds = [...entityIndex.keys()];
    const missingFromLibrary = productEntityIds.filter((id) => !libraryIds.has(id)).slice(0, 30);
    if (missingFromLibrary.length && libraryIds.size) {
      issues.push(makeIssue({
        id: "architecture-library-incomplete",
        code: "architecture-library-incomplete",
        severity: "review",
        group: "contract",
        title: "共享实体库未覆盖全部产品实体",
        detail: `${missingFromLibrary.length} 个产品实体未出现在 architecture 库中（示例：${missingFromLibrary.slice(0, 8).join("、")}）。建议导出/重建架构包以同步。`,
        entityId: missingFromLibrary[0],
        resources: ["architecture", ...PRODUCT_KEYS.filter((key) => products[key])],
        targetView: "structure-review"
      }));
    }
  }

  const severityWeight = { alert: 3, review: 2, pending: 1 };
  const score = Math.max(0, 100 - issues.reduce((sum, item) => sum + (severityWeight[item.severity] || 1) * 4, 0));
  return {
    score,
    issueCount: issues.length,
    issues: issues.slice(0, 80),
    summary: {
      productCount: Object.keys(products).length,
      entityCount: entityIndex.size,
      conflictCount: issues.filter((item) => item.code === "entity-type-conflict").length,
      missingEndpointCount: issues.filter((item) => item.code === "relation-endpoint-missing").length,
      mappingIssueCount: issues.filter((item) => item.group === "mapping").length,
      hasArchitecture: Boolean(architecture)
    }
  };
}

function entityPresentElsewhere(id, currentResource, products, architecture) {
  if ((architecture?.entities || []).some((entity) => String(entity.id) === id)) return true;
  for (const [resource, model] of Object.entries(products)) {
    if (resource === currentResource) continue;
    if ((model.entities || []).some((entity) => String(entity.id) === id)) return true;
    if (resource === "ov1" && (model.nodes || []).some((node) => String(node.id) === id)) return true;
    if (resource === "ov5" && (model.activities || []).some((activity) => String(activity.id) === id)) return true;
  }
  return false;
}

function makeIssue(value) {
  return {
    id: value.id,
    code: value.code,
    severity: value.severity || "review",
    group: value.group || "contract",
    title: value.title,
    detail: value.detail,
    entityId: value.entityId || "",
    resources: value.resources || [],
    sourceView: value.targetView || "structure-review",
    targetView: value.targetView || "structure-review",
    statusLabel: value.severity === "alert" ? "需处理" : "需复核"
  };
}

function productLabel(resource) {
  return PRODUCT_BY_RESOURCE[resource] || resource || "产品";
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

/** DM2 operational subset: Performer specializations may co-exist across products. */
const TYPE_FAMILIES = {
  Performer: "performer",
  System: "performer",
  Organization: "performer",
  PersonType: "performer",
  Activity: "activity",
  ResourceFlow: "resourceFlow",
  Information: "information",
  Materiel: "materiel",
  Rule: "rule",
  State: "state",
  Event: "event",
  Location: "location",
  Measure: "measure",
  Condition: "condition",
  Capability: "capability"
};

function typesAreCompatible(types) {
  const families = unique(types.map((type) => TYPE_FAMILIES[type] || type));
  return families.length <= 1;
}

/**
 * OV-6b 状态转换死锁与孤立状态形式化检测
 * @param {object} ov6bModel - { states: [...], transitions: [...] }
 * @returns {{ unreachableStates: object[], deadlockStates: object[], issues: object[] }}
 */
export function inspectOv6bStateMachine(ov6bModel = {}) {
  const states = Array.isArray(ov6bModel.states) ? ov6bModel.states : [];
  const transitions = Array.isArray(ov6bModel.transitions) ? ov6bModel.transitions : [];
  const unreachableStates = [];
  const deadlockStates = [];
  const issues = [];

  if (states.length <= 1) {
    return { unreachableStates, deadlockStates, issues };
  }

  const inDegree = new Map(states.map((s) => [String(s.id), 0]));
  const outDegree = new Map(states.map((s) => [String(s.id), 0]));

  transitions.forEach((t) => {
    const src = String(t.sourceId || "");
    const tgt = String(t.targetId || "");
    if (outDegree.has(src)) outDegree.set(src, outDegree.get(src) + 1);
    if (inDegree.has(tgt)) inDegree.set(tgt, inDegree.get(tgt) + 1);
  });

  // 终止态判定特征词正则
  const TERMINAL_STATE_REGEX = /结束|完成|归航|待机|终止|退出|审阅|确认|评估|destruct|end|finish|terminal|review/i;
  // 初始态：默认首个状态为初始态，或包含初始/开始/启动特征
  const INITIAL_STATE_REGEX = /初始|准备|待命|开始|启动|首要|observe|观察|initial|start/i;
  let initialIndex = states.findIndex((s) => INITIAL_STATE_REGEX.test(s.label || s.name || s.id));
  if (initialIndex < 0) initialIndex = 0;
  const initialId = String(states[initialIndex]?.id || "");

  states.forEach((s) => {
    const id = String(s.id);
    const label = s.label || s.name || id;

    // 1. 不可达孤立态：非初始状态且入度为0
    if (id !== initialId && inDegree.get(id) === 0) {
      unreachableStates.push(s);
      issues.push(makeIssue({
        id: `ov6b-unreachable-state-${id}`,
        code: "ov6b-unreachable-state",
        severity: "review",
        group: "behavior",
        title: "OV-6b 存在不可达孤立状态",
        detail: `状态“${label}”除初始状态外没有任何输入转换（入度为 0），属于不可达孤立状态。`,
        entityId: id,
        resources: ["ov6b"],
        targetView: "ov6"
      }));
    }

    // 2. 死锁黑洞态：非终止态、可进入（或为初始态）但没有任何离开的状态转换（出度为0）
    if (!TERMINAL_STATE_REGEX.test(label) && outDegree.get(id) === 0 && (inDegree.get(id) > 0 || id === initialId)) {
      deadlockStates.push(s);
      issues.push(makeIssue({
        id: `ov6b-deadlock-state-${id}`,
        code: "ov6b-deadlock-state",
        severity: "alert",
        group: "behavior",
        title: "OV-6b 存在状态死锁黑洞",
        detail: `状态“${label}”非战术终止态，但没有任何离开的状态转换（出度为 0），将导致状态机陷入死锁。`,
        entityId: id,
        resources: ["ov6b"],
        targetView: "ov6"
      }));
    }
  });

  return { unreachableStates, deadlockStates, issues };
}

/**
 * OV-6c 事件时序与 OV-5b 依赖边因果偏序校验（Causal Order Check）
 * @param {object} ov5Model - { activities: [...], edges: [...] }
 * @param {object} ov6cModel - { events: [...] }
 * @returns {{ inversions: object[], issues: object[] }}
 */
export function inspectCausalEventOrdering(ov5Model = {}, ov6cModel = {}) {
  const activities = Array.isArray(ov5Model.activities) ? ov5Model.activities : [];
  const edges = Array.isArray(ov5Model.edges) ? ov5Model.edges : [];
  const events = Array.isArray(ov6cModel.events) ? ov6cModel.events : [];
  const actMap = new Map(activities.map((a) => [String(a.id), a]));
  const inversions = [];
  const issues = [];

  if (!edges.length || !events.length) {
    return { inversions, issues };
  }

  // 记录每个 sourceActivityId 在时间线中最早出现的事件
  const earliestActivityEvent = new Map();
  events.forEach((ev, idx) => {
    const actId = String(ev.sourceActivityId || "");
    if (!actId) return;
    if (!earliestActivityEvent.has(actId)) {
      earliestActivityEvent.set(actId, {
        event: ev,
        index: idx,
        sequence: Number(ev.sequence) || (idx + 1),
        offsetMinutes: ev.offsetMinutes !== null && ev.offsetMinutes !== undefined ? Number(ev.offsetMinutes) : null
      });
    }
  });

  // 遍历前向依赖边
  edges.forEach((edge) => {
    // 排除反馈边
    const edgeType = String(edge.type || edge.label || "").toLowerCase();
    if (/反馈|回流|loop|feedback/.test(edgeType)) return;

    const srcId = String(edge.sourceId || "");
    const tgtId = String(edge.targetId || "");
    const srcOccur = earliestActivityEvent.get(srcId);
    const tgtOccur = earliestActivityEvent.get(tgtId);

    if (srcOccur && tgtOccur) {
      const srcAct = actMap.get(srcId);
      const tgtAct = actMap.get(tgtId);
      const sourceTitle = srcAct?.title || srcId;
      const targetTitle = tgtAct?.title || tgtId;

      let isInverted = false;
      let reason = "";

      // 如果两者均有 offsetMinutes 且不相等
      if (srcOccur.offsetMinutes !== null && tgtOccur.offsetMinutes !== null && srcOccur.offsetMinutes !== tgtOccur.offsetMinutes) {
        if (tgtOccur.offsetMinutes < srcOccur.offsetMinutes) {
          isInverted = true;
          reason = `下游活动时间偏移 (${tgtOccur.offsetMinutes}m) 早于上游前提活动 (${srcOccur.offsetMinutes}m)`;
        }
      } else if (tgtOccur.sequence < srcOccur.sequence) {
        isInverted = true;
        reason = `下游活动事件序号 (#${tgtOccur.sequence}) 早于上游前提活动事件 (#${srcOccur.sequence})`;
      }

      if (isInverted) {
        const item = {
          edgeId: edge.id,
          sourceActivityId: srcId,
          sourceTitle,
          sourceSequence: srcOccur.sequence,
          targetActivityId: tgtId,
          targetTitle,
          targetSequence: tgtOccur.sequence,
          reason
        };
        inversions.push(item);
        issues.push(makeIssue({
          id: `causal-inversion-${srcId}-${tgtId}`,
          code: "causal-inversion",
          severity: "alert",
          group: "behavior",
          title: "时序因果逆序",
          detail: `下游活动“${targetTitle}”（序号 #${tgtOccur.sequence}）早于上游前提活动“${sourceTitle}”（序号 #${srcOccur.sequence}）触发，违背 OV-5b 因果偏序契约。${reason}`,
          entityId: tgtId,
          resources: ["ov5", "ov6c"],
          targetView: "ov5"
        }));
      }
    }
  });

  return { inversions, issues };
}

void RESOURCE_BY_PRODUCT;
