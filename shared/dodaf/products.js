import {
  DM2_TO_OV1_KIND,
  OV1_KIND_TO_DM2,
  PRODUCT_BY_RESOURCE
} from "./constants.js";
import {
  createProductEnvelope,
  normalizeDerivedFrom,
  normalizeDm2Entity,
  normalizeEntityList,
  normalizeRelationList
} from "./entities.js";
import { clean, clampNumber, normalizeStringList, nowIso, stableId, uniqueIds } from "./util.js";

const OV1_KINDS = ["equipment", "command", "action", "external", "environment", "effect", "participant"];

export function normalizeDodafOv1(value) {
  const nodeIds = new Set();
  const nodes = (Array.isArray(value?.nodes) ? value.nodes : []).slice(0, 120).map((node, index) => {
    const id = clean(node?.id, 160) || `ov1-node-${index + 1}`;
    if (nodeIds.has(id)) return null;
    nodeIds.add(id);
    const className = clean(node?.className, 40);
    const kind = OV1_KINDS.includes(clean(node?.kind, 40)) ? clean(node.kind, 40) : "equipment";
    return {
      id,
      label: clean(node?.label || node?.name, 1000) || "TBD",
      detail: clean(node?.detail || node?.description, 8000) || "TBD",
      category: clean(node?.category, 240),
      responsibility: clean(node?.responsibility, 1200),
      input: clean(node?.input, 2000),
      output: clean(node?.output, 2000),
      constraints: clean(node?.constraints, 2000),
      expectedEffects: clean(node?.expectedEffects, 2000),
      kind,
      dm2Type: OV1_KIND_TO_DM2[kind] || "Performer",
      evidenceRefs: normalizeStringList(node?.evidenceRefs, 12, 240),
      className: ["", "blue", "gold"].includes(className) ? className : "",
      x: clean(node?.x, 80),
      y: clean(node?.y, 80)
    };
  }).filter(Boolean);

  // Prefer product nodes; fall back to DM2 entities for pure exchange packages.
  if (!nodes.length && Array.isArray(value?.entities) && value.entities.length) {
    value.entities.slice(0, 120).forEach((entity, index) => {
      const id = clean(entity?.id, 160) || `ov1-node-${index + 1}`;
      if (nodeIds.has(id)) return;
      nodeIds.add(id);
      const dm2Type = clean(entity?.dm2Type, 40) || "Performer";
      nodes.push({
        id,
        label: clean(entity?.name, 1000) || id,
        detail: clean(entity?.description, 8000) || "TBD",
        category: clean(entity?.properties?.category, 240),
        responsibility: clean(entity?.properties?.responsibility, 1200),
        input: clean(entity?.properties?.input, 2000),
        output: clean(entity?.properties?.output, 2000),
        constraints: clean(entity?.properties?.constraints, 2000),
        expectedEffects: clean(entity?.properties?.expectedEffects, 2000),
        kind: DM2_TO_OV1_KIND[dm2Type] || "equipment",
        dm2Type,
        evidenceRefs: normalizeStringList(entity?.evidenceRefs, 12, 240),
        className: "",
        x: clean(entity?.properties?.x, 80),
        y: clean(entity?.properties?.y, 80)
      });
    });
  }
  if (!nodes.length) throw new Error("OV-1 requires at least one node");

  const edgeIds = new Set();
  const signatures = new Set();
  let edges = (Array.isArray(value?.edges) ? value.edges : []).slice(0, 240).flatMap((edge, index) => {
    const sourceId = clean(edge?.sourceId, 160);
    const targetId = clean(edge?.targetId, 160);
    const type = clean(edge?.type || edge?.name, 160) || "relationship";
    const signature = `${sourceId}:${targetId}:${type}`;
    if (!nodeIds.has(sourceId) || !nodeIds.has(targetId) || sourceId === targetId || signatures.has(signature)) return [];
    signatures.add(signature);
    const id = clean(edge?.id, 160) || `ov1-edge-${index + 1}`;
    if (edgeIds.has(id)) return [];
    edgeIds.add(id);
    return [{ id, sourceId, targetId, type, dm2Type: "relationship" }];
  });
  if (!edges.length && Array.isArray(value?.relations)) {
    edges = normalizeRelationList(value.relations, nodeIds, { maximum: 240, fallbackType: "relationship" })
      .map((relation) => ({
        id: relation.id,
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        type: relation.name || relation.dm2Type,
        dm2Type: relation.dm2Type
      }));
  }

  const entities = nodes.map((node, index) => normalizeDm2Entity({
    id: node.id,
    dm2Type: node.dm2Type,
    name: node.label,
    description: node.detail,
    evidenceRefs: node.evidenceRefs,
    properties: {
      category: node.category,
      responsibility: node.responsibility,
      input: node.input,
      output: node.output,
      constraints: node.constraints,
      expectedEffects: node.expectedEffects,
      kind: node.kind,
      className: node.className,
      x: node.x,
      y: node.y
    }
  }, index, node.dm2Type));
  const relations = edges.map((edge, index) => ({
    id: edge.id,
    dm2Type: edge.dm2Type || "relationship",
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    name: edge.type,
    properties: {}
  }));

  const concept = normalizeOv1Concept(value?.concept);
  const envelope = createProductEnvelope({
    product: "OV-1",
    architectureId: value?.architectureId,
    entities,
    relations,
    view: value?.view,
    provenance: normalizeProvenanceObject(value?.provenance),
    derivedFrom: value?.derivedFrom,
    extra: {
      version: 1,
      nodes,
      edges: edges.map(({ id, sourceId, targetId, type }) => ({ id, sourceId, targetId, type })),
      concept
    }
  });
  return envelope;
}

export function normalizeDodafOv5(value) {
  const inputActivities = Array.isArray(value?.activities) ? value.activities.slice(0, 80) : [];
  let activities = inputActivities.map((activity, index) => normalizeActivity(activity, index));
  if (!activities.length && Array.isArray(value?.entities)) {
    activities = value.entities
      .filter((entity) => clean(entity?.dm2Type, 40) === "Activity" || !entity?.dm2Type)
      .slice(0, 80)
      .map((entity, index) => normalizeActivity({
        id: entity.id,
        title: entity.name,
        text: entity.description,
        type: entity.properties?.type,
        input: entity.properties?.input,
        output: entity.properties?.output,
        duration: entity.properties?.duration,
        parentId: entity.properties?.parentId,
        resources: entity.properties?.resources,
        preconditions: entity.properties?.preconditions,
        constraints: entity.properties?.constraints,
        refs: entity.evidenceRefs,
        sourceOv1NodeIds: entity.properties?.sourceOv1NodeIds
      }, index));
  }
  if (!activities.length) throw new Error("OV-5 requires at least one activity");

  const activityIds = new Set(activities.map((activity) => activity.id));
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  activities.forEach((activity) => {
    if (!activity.parentId || !activityIds.has(activity.parentId) || activity.parentId === activity.id || introducesParentCycle(activity.id, activity.parentId, activityById)) {
      activity.parentId = "";
    }
  });

  const edgeIds = new Set();
  const relationKeys = new Set();
  let edges = (Array.isArray(value?.edges) ? value.edges : []).slice(0, 240).flatMap((edge, index) => {
    const sourceId = clean(edge?.sourceId, 160);
    const targetId = clean(edge?.targetId, 160);
    if (!activityIds.has(sourceId) || !activityIds.has(targetId) || sourceId === targetId) return [];
    const key = `${sourceId}:${targetId}`;
    if (relationKeys.has(key)) return [];
    relationKeys.add(key);
    const id = clean(edge?.id, 180) || `edge-${index + 1}`;
    if (edgeIds.has(id)) return [];
    edgeIds.add(id);
    return [{
      id,
      sourceId,
      targetId,
      type: clean(edge?.type, 120) || "information",
      payload: clean(edge?.payload, 4000),
      condition: clean(edge?.condition, 4000)
    }];
  });
  if (!edges.length && Array.isArray(value?.relations)) {
    edges = normalizeRelationList(value.relations, activityIds, { maximum: 240, fallbackType: "resourceFlow" })
      .map((relation) => ({
        id: relation.id,
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        type: clean(relation.properties?.flowType || relation.name, 120) || "information",
        payload: clean(relation.properties?.payload, 4000),
        condition: clean(relation.properties?.condition, 4000)
      }));
  }

  const entities = activities.map((activity, index) => normalizeDm2Entity({
    id: activity.id,
    dm2Type: "Activity",
    name: activity.title,
    description: activity.text,
    evidenceRefs: activity.refs,
    properties: {
      type: activity.type,
      input: activity.input,
      output: activity.output,
      duration: activity.duration,
      parentId: activity.parentId,
      resources: activity.resources,
      preconditions: activity.preconditions,
      constraints: activity.constraints,
      sourceOv1NodeIds: activity.sourceOv1NodeIds
    }
  }, index, "Activity"));

  const relations = [
    ...activities.filter((activity) => activity.parentId).map((activity, index) => ({
      id: `part-${activity.id}`,
      dm2Type: "activityPartOfActivity",
      sourceId: activity.id,
      targetId: activity.parentId,
      name: "part-of",
      properties: {}
    })),
    ...edges.map((edge) => ({
      id: edge.id,
      dm2Type: "resourceFlow",
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      name: edge.type,
      properties: { payload: edge.payload, condition: edge.condition, flowType: edge.type }
    }))
  ];

  return createProductEnvelope({
    product: "OV-5b",
    architectureId: value?.architectureId,
    entities,
    relations,
    view: value?.view,
    provenance: normalizeProvenanceObject(value?.provenance),
    derivedFrom: value?.derivedFrom,
    extra: {
      version: 1,
      activities,
      edges
    }
  });
}

export function normalizeDodafOv2(value) {
  const nodes = (Array.isArray(value?.nodes) ? value.nodes : []).slice(0, 120).map((node, index) => {
    const id = clean(node?.id, 160) || `ov2-node-${index + 1}`;
    return {
      id,
      label: clean(node?.label || node?.name, 160) || id,
      detail: clean(node?.detail || node?.description, 800),
      sourceOv1NodeId: clean(node?.sourceOv1NodeId || id, 160),
      activityIds: uniqueIds(node?.activityIds, 60),
      activityCount: clampNumber(node?.activityCount, 0, 10000, uniqueIds(node?.activityIds, 60).length),
      oodaCount: clampNumber(node?.oodaCount, 0, 10000, 0),
      entityCount: clampNumber(node?.entityCount, 0, 10000, 0)
    };
  });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const exchanges = (Array.isArray(value?.exchanges) ? value.exchanges : []).slice(0, 240).map((exchange, index) => ({
    id: clean(exchange?.id, 180) || `ov2-exchange-${index + 1}`,
    sourceNodeId: clean(exchange?.sourceNodeId, 160),
    targetNodeId: clean(exchange?.targetNodeId, 160),
    sourceNodeLabel: clean(exchange?.sourceNodeLabel, 160),
    targetNodeLabel: clean(exchange?.targetNodeLabel, 160),
    label: clean(exchange?.label, 400) || "Needline",
    flowType: clean(exchange?.flowType, 120) || "信息流",
    sourceActivityId: clean(exchange?.sourceActivityId, 160),
    sourceActivityTitle: clean(exchange?.sourceActivityTitle, 240),
    targetActivityId: clean(exchange?.targetActivityId, 160),
    targetActivityTitle: clean(exchange?.targetActivityTitle, 240),
    input: clean(exchange?.input, 400),
    output: clean(exchange?.output, 400)
  })).filter((exchange) => exchange.sourceNodeId && exchange.targetNodeId && exchange.sourceNodeId !== exchange.targetNodeId);

  const entities = [
    ...nodes.map((node, index) => normalizeDm2Entity({
      id: node.id,
      dm2Type: "Performer",
      name: node.label,
      description: node.detail,
      properties: {
        sourceOv1NodeId: node.sourceOv1NodeId,
        activityIds: node.activityIds,
        activityCount: node.activityCount,
        oodaCount: node.oodaCount,
        entityCount: node.entityCount
      }
    }, index, "Performer")),
    ...exchanges.map((exchange, index) => normalizeDm2Entity({
      id: exchange.id,
      dm2Type: "ResourceFlow",
      name: exchange.label,
      description: `${exchange.sourceNodeLabel} -> ${exchange.targetNodeLabel}`,
      properties: {
        flowType: exchange.flowType,
        sourceNodeId: exchange.sourceNodeId,
        targetNodeId: exchange.targetNodeId,
        sourceActivityId: exchange.sourceActivityId,
        targetActivityId: exchange.targetActivityId,
        input: exchange.input,
        output: exchange.output
      }
    }, index, "ResourceFlow"))
  ];
  const entityIds = new Set(entities.map((entity) => entity.id));
  const relations = exchanges.flatMap((exchange, index) => {
    const needline = {
      id: `needline-${exchange.id}`,
      dm2Type: "needline",
      sourceId: exchange.sourceNodeId,
      targetId: exchange.targetNodeId,
      name: exchange.label,
      properties: { flowType: exchange.flowType, resourceFlowId: exchange.id }
    };
    return entityIds.has(needline.sourceId) && entityIds.has(needline.targetId) ? [needline] : [];
  });

  return createProductEnvelope({
    product: "OV-2",
    architectureId: value?.architectureId,
    entities,
    relations,
    view: value?.view,
    provenance: normalizeProvenanceObject(value?.provenance),
    derivedFrom: value?.derivedFrom || value?.kind ? { mode: "seeded", sources: ["ov1", "ov5"], generatedAt: value?.generatedAt, note: value?.kind || "" } : null,
    extra: {
      version: 1,
      kind: "persisted-ov2-operational-exchange",
      generatedAt: nowIso(value?.generatedAt),
      source: normalizeSourceSummary(value?.source),
      nodes,
      exchanges,
      diagnostics: normalizeDiagnostics(value?.diagnostics),
      unresolved: value?.unresolved && typeof value.unresolved === "object" ? value.unresolved : { unmappedActivityIds: [], brokenEdgeIds: [] }
    }
  });
}

export function normalizeDodafOv3(value) {
  const activities = (Array.isArray(value?.activities) ? value.activities : []).slice(0, 120).map((activity, index) => ({
    id: clean(activity?.id, 160) || `ov3-activity-${index + 1}`,
    title: clean(activity?.title || activity?.name, 240) || `Activity ${index + 1}`
  }));
  const exchanges = (Array.isArray(value?.exchanges) ? value.exchanges : []).slice(0, 240).map((exchange, index) => ({
    id: clean(exchange?.id, 180) || `ov3-exchange-${index + 1}`,
    sourceActivityId: clean(exchange?.sourceActivityId, 160),
    sourceActivityTitle: clean(exchange?.sourceActivityTitle, 240),
    targetActivityId: clean(exchange?.targetActivityId, 160),
    targetActivityTitle: clean(exchange?.targetActivityTitle, 240),
    exchangeType: clean(exchange?.exchangeType, 80) || "information",
    edgeType: clean(exchange?.edgeType, 120) || "信息流",
    output: clean(exchange?.output, 400),
    input: clean(exchange?.input, 400),
    compatibility: ["ready", "review", "pending"].includes(clean(exchange?.compatibility, 40)) ? clean(exchange.compatibility, 40) : "pending",
    scenarioEntityCount: clampNumber(exchange?.scenarioEntityCount, 0, 10000, 0)
  })).filter((exchange) => exchange.sourceActivityId && exchange.targetActivityId);

  const entities = [
    ...activities.map((activity, index) => normalizeDm2Entity({ id: activity.id, dm2Type: "Activity", name: activity.title }, index, "Activity")),
    ...exchanges.map((exchange, index) => normalizeDm2Entity({
      id: exchange.id,
      dm2Type: "ResourceFlow",
      name: `${exchange.sourceActivityTitle} -> ${exchange.targetActivityTitle}`,
      properties: exchange
    }, index, "ResourceFlow"))
  ];
  const activityIds = new Set(activities.map((activity) => activity.id));
  const relations = exchanges
    .filter((exchange) => activityIds.has(exchange.sourceActivityId) && activityIds.has(exchange.targetActivityId))
    .map((exchange) => ({
      id: `flow-${exchange.id}`,
      dm2Type: "resourceFlow",
      sourceId: exchange.sourceActivityId,
      targetId: exchange.targetActivityId,
      name: exchange.edgeType,
      properties: { exchangeId: exchange.id, exchangeType: exchange.exchangeType, compatibility: exchange.compatibility }
    }));

  return createProductEnvelope({
    product: "OV-3",
    architectureId: value?.architectureId,
    entities,
    relations,
    view: value?.view,
    provenance: normalizeProvenanceObject(value?.provenance),
    derivedFrom: value?.derivedFrom || value?.kind ? { mode: "seeded", sources: ["ov5"], generatedAt: value?.generatedAt, note: value?.kind || "" } : null,
    extra: {
      version: 1,
      kind: "persisted-ov3-resource-exchange",
      generatedAt: nowIso(value?.generatedAt),
      source: normalizeSourceSummary(value?.source),
      activities,
      exchanges,
      diagnostics: normalizeDiagnostics(value?.diagnostics),
      unresolved: value?.unresolved && typeof value.unresolved === "object" ? value.unresolved : { unresolvedEdgeIds: [], missingContractCount: 0, mismatchCount: 0 }
    }
  });
}

export function normalizeDodafOv4(value) {
  const roles = (Array.isArray(value?.roles) ? value.roles : []).slice(0, 120).map((role, index) => ({
    id: clean(role?.id, 160) || `ov4-role-${index + 1}`,
    label: clean(role?.label || role?.name, 160) || `Role ${index + 1}`,
    detail: clean(role?.detail || role?.description, 800),
    activityIds: uniqueIds(role?.activityIds, 60),
    activityCount: clampNumber(role?.activityCount, 0, 10000, uniqueIds(role?.activityIds, 60).length),
    oodaCount: clampNumber(role?.oodaCount, 0, 10000, 0),
    phases: normalizeStringList(role?.phases, 20, 160),
    entityCount: clampNumber(role?.entityCount, 0, 10000, 0),
    state: ["ready", "review", "pending"].includes(clean(role?.state, 40)) ? clean(role.state, 40) : "review"
  }));
  const roleIds = new Set(roles.map((role) => role.id));
  const relations = (Array.isArray(value?.relations) ? value.relations : []).slice(0, 240).map((relation, index) => ({
    id: clean(relation?.id, 180) || `ov4-relation-${index + 1}`,
    sourceRoleId: clean(relation?.sourceRoleId || relation?.sourceId, 160),
    sourceRoleLabel: clean(relation?.sourceRoleLabel, 160),
    targetRoleId: clean(relation?.targetRoleId || relation?.targetId, 160),
    targetRoleLabel: clean(relation?.targetRoleLabel, 160),
    relationshipType: clean(relation?.relationshipType || relation?.name || relation?.type, 120) || "coordination",
    sourceActivityId: clean(relation?.sourceActivityId, 160),
    sourceActivityTitle: clean(relation?.sourceActivityTitle, 240),
    targetActivityId: clean(relation?.targetActivityId, 160),
    targetActivityTitle: clean(relation?.targetActivityTitle, 240),
    state: ["ready", "review", "pending"].includes(clean(relation?.state, 40)) ? clean(relation.state, 40) : "ready"
  })).filter((relation) => relation.sourceRoleId && relation.targetRoleId && relation.sourceRoleId !== relation.targetRoleId);

  const entities = roles.map((role, index) => normalizeDm2Entity({
    id: role.id,
    dm2Type: "Organization",
    name: role.label,
    description: role.detail,
    properties: role
  }, index, "Organization"));
  const dm2Relations = relations
    .filter((relation) => roleIds.has(relation.sourceRoleId) && roleIds.has(relation.targetRoleId))
    .map((relation) => ({
      id: relation.id,
      dm2Type: "responsibleFor",
      sourceId: relation.sourceRoleId,
      targetId: relation.targetRoleId,
      name: relation.relationshipType,
      properties: relation
    }));

  return createProductEnvelope({
    product: "OV-4",
    architectureId: value?.architectureId,
    entities,
    relations: dm2Relations,
    view: value?.view,
    provenance: normalizeProvenanceObject(value?.provenance),
    derivedFrom: value?.derivedFrom || value?.kind ? { mode: "seeded", sources: ["ov1", "ov5"], generatedAt: value?.generatedAt, note: value?.kind || "" } : null,
    extra: {
      version: 1,
      kind: "persisted-ov4-abstract-responsibility",
      generatedAt: nowIso(value?.generatedAt),
      roles,
      relations,
      coverage: value?.coverage && typeof value.coverage === "object" ? value.coverage : { activity: null, role: null },
      diagnostics: normalizeDiagnostics(value?.diagnostics),
      unresolved: value?.unresolved && typeof value.unresolved === "object" ? value.unresolved : {}
    }
  });
}

export function normalizeDodafOv5a(value) {
  const tree = normalizeTree(value?.tree || value?.nodes, 0);
  const flat = flattenTree(tree);
  const entities = flat.map((node, index) => normalizeDm2Entity({
    id: node.id,
    dm2Type: "Activity",
    name: node.title,
    description: node.type,
    properties: { parentId: node.parentId || "", type: node.type }
  }, index, "Activity"));
  const relations = flat.filter((node) => node.parentId).map((node) => ({
    id: `part-${node.id}`,
    dm2Type: "activityPartOfActivity",
    sourceId: node.id,
    targetId: node.parentId,
    name: "part-of",
    properties: {}
  }));
  return createProductEnvelope({
    product: "OV-5a",
    architectureId: value?.architectureId,
    entities,
    relations,
    view: value?.view,
    provenance: normalizeProvenanceObject(value?.provenance),
    derivedFrom: value?.derivedFrom || value?.kind ? { mode: "seeded", sources: ["ov5"], generatedAt: value?.generatedAt, note: value?.kind || "" } : null,
    extra: {
      version: 1,
      kind: "persisted-ov5a-operational-activity-decomposition",
      generatedAt: nowIso(value?.generatedAt),
      tree,
      diagnostics: normalizeDiagnostics(value?.diagnostics)
    }
  });
}

export function normalizeDodafOv6a(value) {
  const rules = (Array.isArray(value?.rules) ? value.rules : []).slice(0, 240).map((rule, index) => ({
    id: clean(rule?.id, 180) || `ov6a-rule-${index + 1}`,
    subject: clean(rule?.subject, 240) || "Rule subject",
    type: clean(rule?.type, 120) || "约束",
    text: clean(rule?.text, 4000) || "TBD",
    activityId: clean(rule?.activityId, 160)
  }));
  const entities = rules.map((rule, index) => normalizeDm2Entity({
    id: rule.id,
    dm2Type: "Rule",
    name: rule.subject,
    description: rule.text,
    properties: { type: rule.type, activityId: rule.activityId }
  }, index, "Rule"));
  return createProductEnvelope({
    product: "OV-6a",
    architectureId: value?.architectureId,
    entities,
    relations: [],
    view: value?.view,
    provenance: normalizeProvenanceObject(value?.provenance),
    derivedFrom: value?.derivedFrom || value?.kind ? { mode: "seeded", sources: ["ov5"], generatedAt: value?.generatedAt, note: value?.kind || "" } : null,
    extra: {
      version: 1,
      kind: "persisted-ov6a-operational-rules",
      generatedAt: nowIso(value?.generatedAt),
      rules,
      diagnostics: normalizeDiagnostics(value?.diagnostics)
    }
  });
}

export function normalizeDodafOv6b(value) {
  const states = (Array.isArray(value?.states) ? value.states : []).slice(0, 240).map((state, index) => ({
    id: clean(state?.id, 160) || `ov6b-state-${index + 1}`,
    label: clean(state?.label || state?.name || state?.title, 240) || `State ${index + 1}`,
    phase: clean(state?.phase, 160),
    rule: clean(state?.rule, 4000)
  }));
  const stateIds = new Set(states.map((state) => state.id));
  const transitions = (Array.isArray(value?.transitions) ? value.transitions : []).slice(0, 480).map((item, index) => ({
    id: clean(item?.id, 180) || `ov6b-transition-${index + 1}`,
    sourceId: clean(item?.sourceId, 160),
    targetId: clean(item?.targetId, 160),
    sourceLabel: clean(item?.sourceLabel, 240),
    targetLabel: clean(item?.targetLabel, 240),
    condition: clean(item?.condition, 4000) || "TBD"
  })).filter((item) => item.sourceId && item.targetId && item.sourceId !== item.targetId);

  const entities = states.map((state, index) => normalizeDm2Entity({
    id: state.id,
    dm2Type: "State",
    name: state.label,
    description: state.rule,
    properties: { phase: state.phase, rule: state.rule }
  }, index, "State"));
  const relations = transitions
    .filter((item) => stateIds.has(item.sourceId) && stateIds.has(item.targetId))
    .map((item) => ({
      id: item.id,
      dm2Type: "stateTransition",
      sourceId: item.sourceId,
      targetId: item.targetId,
      name: item.condition,
      properties: { condition: item.condition }
    }));

  return createProductEnvelope({
    product: "OV-6b",
    architectureId: value?.architectureId,
    entities,
    relations,
    view: value?.view,
    provenance: normalizeProvenanceObject(value?.provenance),
    derivedFrom: value?.derivedFrom || value?.kind ? { mode: "seeded", sources: ["ooda"], generatedAt: value?.generatedAt, note: value?.kind || "" } : null,
    extra: {
      version: 1,
      kind: "persisted-ov6b-state-transition",
      generatedAt: nowIso(value?.generatedAt),
      states,
      transitions,
      diagnostics: normalizeDiagnostics(value?.diagnostics)
    }
  });
}

export function normalizeDodafOv6c(value) {
  const events = (Array.isArray(value?.events) ? value.events : []).slice(0, 500).map((event, index) => ({
    id: clean(event?.id, 180) || `ov6c-event-${index + 1}`,
    sequence: clampNumber(event?.sequence, 1, 10000, index + 1),
    time: clean(event?.time, 120) || "Unscheduled",
    offsetMinutes: event?.offsetMinutes === null || event?.offsetMinutes === undefined ? null : clampNumber(event.offsetMinutes, -100000, 100000, 0),
    title: clean(event?.title || event?.name, 240) || `Event ${index + 1}`,
    description: clean(event?.description, 800),
    sourceNodeId: clean(event?.sourceNodeId, 160),
    sourceActivityId: clean(event?.sourceActivityId, 160),
    phase: clean(event?.phase, 160),
    entityCount: clampNumber(event?.entityCount, 0, 10000, 0),
    state: ["ready", "review", "pending"].includes(clean(event?.state, 40)) ? clean(event.state, 40) : "pending",
    outOfOrder: Boolean(event?.outOfOrder),
    reviewReasons: normalizeStringList(event?.reviewReasons, 8, 240)
  }));
  const entities = events.map((event, index) => normalizeDm2Entity({
    id: event.id,
    dm2Type: "Event",
    name: event.title,
    description: event.description,
    properties: event
  }, index, "Event"));
  const relations = events
    .filter((event) => event.sourceActivityId)
    .map((event) => ({
      id: `event-activity-${event.id}`,
      dm2Type: "eventResultsIn",
      sourceId: event.id,
      targetId: event.sourceActivityId,
      name: "results-in",
      properties: { sourceNodeId: event.sourceNodeId }
    }));

  return createProductEnvelope({
    product: "OV-6c",
    architectureId: value?.architectureId,
    entities,
    relations,
    view: value?.view,
    provenance: normalizeProvenanceObject(value?.provenance),
    derivedFrom: value?.derivedFrom || value?.kind ? { mode: "seeded", sources: ["ooda", "scenario"], generatedAt: value?.generatedAt, note: value?.kind || "" } : null,
    extra: {
      version: 1,
      kind: "persisted-ov6c-event-trace",
      generatedAt: nowIso(value?.generatedAt),
      source: normalizeSourceSummary(value?.source),
      events,
      diagnostics: normalizeDiagnostics(value?.diagnostics),
      unresolved: value?.unresolved && typeof value.unresolved === "object" ? value.unresolved : { unscheduledNodeIds: [], orphanTimelineIds: [], outOfOrderIds: [] }
    }
  });
}

export function normalizeArchitecture(value) {
  const entities = normalizeEntityList(value?.entities, { maximum: 800 });
  const entityIds = new Set(entities.map((entity) => entity.id));
  const relations = normalizeRelationList(value?.relations, entityIds, { maximum: 1600 });
  const products = {};
  const inputProducts = value?.products && typeof value.products === "object" ? value.products : {};
  for (const [product, resourceKey] of Object.entries({
    "OV-1": "ov1",
    "OV-2": "ov2",
    "OV-3": "ov3",
    "OV-4": "ov4",
    "OV-5a": "ov5a",
    "OV-5b": "ov5",
    "OV-6a": "ov6a",
    "OV-6b": "ov6b",
    "OV-6c": "ov6c"
  })) {
    const payload = inputProducts[product] || inputProducts[resourceKey];
    if (!payload) continue;
    products[product] = normalizeProductByName(product, payload);
  }
  return {
    schema: "dodaf-2.02-dm2-ov",
    schemaVersion: 1,
    product: "ArchitectureDescription",
    version: 1,
    id: clean(value?.id, 160) || "architecture",
    name: clean(value?.name || value?.title, 240) || "Operational Architecture",
    description: clean(value?.description, 4000),
    entities,
    relations,
    products,
    view: value?.view && typeof value.view === "object" ? value.view : { layout: {}, matrix: {}, notes: "" },
    updatedAt: nowIso(value?.updatedAt)
  };
}

export function normalizeProductByName(product, value) {
  switch (product) {
    case "OV-1": return normalizeDodafOv1(value);
    case "OV-2": return normalizeDodafOv2(value);
    case "OV-3": return normalizeDodafOv3(value);
    case "OV-4": return normalizeDodafOv4(value);
    case "OV-5a": return normalizeDodafOv5a(value);
    case "OV-5b": return normalizeDodafOv5(value);
    case "OV-6a": return normalizeDodafOv6a(value);
    case "OV-6b": return normalizeDodafOv6b(value);
    case "OV-6c": return normalizeDodafOv6c(value);
    default: throw new Error(`Unsupported DoDAF product: ${product}`);
  }
}

export function normalizeProductByResource(resourceKey, value) {
  const product = PRODUCT_BY_RESOURCE[resourceKey];
  if (!product) throw new Error(`Unsupported OV resource: ${resourceKey}`);
  if (resourceKey === "architecture") return normalizeArchitecture(value);
  return normalizeProductByName(product, value);
}

function normalizeActivity(activity, index) {
  const id = clean(activity?.id, 160) || `activity-${index + 1}`;
  return {
    id,
    type: clean(activity?.type, 4000) || "TBD",
    title: clean(activity?.title || activity?.name, 4000) || "TBD",
    text: clean(activity?.text || activity?.description, 4000) || "TBD",
    input: clean(activity?.input, 4000) || "TBD",
    output: clean(activity?.output, 4000) || "TBD",
    duration: clean(activity?.duration, 4000) || "TBD",
    refs: normalizeStringList(activity?.refs, 30, 240),
    sourceOv1NodeIds: uniqueIds(activity?.sourceOv1NodeIds, 60),
    parentId: clean(activity?.parentId, 160),
    resources: clean(activity?.resources, 4000),
    preconditions: clean(activity?.preconditions, 4000),
    constraints: clean(activity?.constraints, 4000)
  };
}

function introducesParentCycle(activityId, parentId, activityById) {
  const seen = new Set([activityId]);
  let currentId = parentId;
  while (currentId) {
    if (seen.has(currentId)) return true;
    seen.add(currentId);
    currentId = activityById.get(currentId)?.parentId || "";
  }
  return false;
}

function normalizeOv1Concept(value) {
  return {
    mission: clean(value?.mission, 240),
    objective: clean(value?.objective, 500),
    scope: clean(value?.scope, 300),
    phase: clean(value?.phase, 160),
    expectedEffects: clean(value?.expectedEffects, 500),
    constraints: clean(value?.constraints, 500)
  };
}

function normalizeProvenanceObject(value) {
  if (!value || typeof value !== "object") return undefined;
  return {
    mode: clean(value.mode, 40) || "manual",
    generatedAt: clean(value.generatedAt, 80),
    evidenceCount: clampNumber(value.evidenceCount, 0, 100000, 0),
    evidenceSelection: value.evidenceSelection && typeof value.evidenceSelection === "object" ? value.evidenceSelection : null
  };
}

function normalizeSourceSummary(value) {
  if (!value || typeof value !== "object") return {};
  return Object.entries(value).slice(0, 20).reduce((result, [key, item]) => {
    const field = clean(key, 80);
    if (!field) return result;
    if (typeof item === "number" && Number.isFinite(item)) result[field] = clampNumber(item, 0, 100000, 0);
    else if (typeof item === "boolean") result[field] = item;
    else result[field] = clean(item, 400);
    return result;
  }, {});
}

function normalizeDiagnostics(value) {
  return (Array.isArray(value) ? value : []).slice(0, 40).map((item, index) => ({
    id: clean(item?.id, 160) || `diagnostic-${index + 1}`,
    label: clean(item?.label, 240) || "Check",
    state: ["ready", "review", "pending", "attention"].includes(clean(item?.state, 40)) ? clean(item.state, 40) : "pending",
    statusLabel: clean(item?.statusLabel, 120),
    detail: clean(item?.detail, 1600)
  }));
}

function normalizeTree(nodes, depth) {
  if (depth > 12) return [];
  return (Array.isArray(nodes) ? nodes : []).slice(0, 120).map((node, index) => ({
    id: clean(node?.id, 160) || `tree-${depth}-${index + 1}`,
    title: clean(node?.title || node?.name || node?.label, 240) || `Node ${index + 1}`,
    type: clean(node?.type, 120),
    children: normalizeTree(node?.children, depth + 1)
  }));
}

function flattenTree(nodes, parentId = "", acc = []) {
  for (const node of nodes || []) {
    acc.push({ id: node.id, title: node.title, type: node.type, parentId });
    flattenTree(node.children, node.id, acc);
  }
  return acc;
}

// silence unused import warning in some bundlers
void stableId;
void normalizeDerivedFrom;
