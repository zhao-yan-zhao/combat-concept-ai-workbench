const VIEW_BY_KIND = {
  ov1: "ov1",
  activity: "ov5",
  ooda: "ooda",
  unit: "scenario"
};

export function buildTraceability({ ov1, ov5, ooda, scenario } = {}) {
  const ov1Nodes = Array.isArray(ov1?.nodes) ? ov1.nodes : [];
  const activities = Array.isArray(ov5?.activities) ? ov5.activities : [];
  const oodaNodes = flattenOoda(ooda);
  const entities = Array.isArray(scenario?.entities) ? scenario.entities : [];
  const timeline = Array.isArray(scenario?.timeline) ? scenario.timeline : [];
  const ov1ById = new Map(ov1Nodes.map((node) => [node.id, node]));
  const orphanedOv1SourceIds = new Set();

  const activityRows = activities.map((activity) => {
    const sourceOv1NodeIds = unique(activity.sourceOv1NodeIds);
    const sourceOv1Nodes = sourceOv1NodeIds.flatMap((id) => {
      const node = ov1ById.get(id);
      if (!node) {
        orphanedOv1SourceIds.add(id);
        return [];
      }
      return [{ id: node.id, label: node.label }];
    });
    const linkedOodaNodes = oodaNodes
      .filter((node) => node.sourceActivityId === activity.id)
      .map((node) => ({ id: node.id, label: node.title, lane: node.laneSubtitle }));
    const linkedEntities = entities
      .filter((entity) => entity.sourceActivityId === activity.id)
      .map((entity) => ({ id: entity.id, label: entity.label, role: entity.role }));
    const linkedTimeline = timeline
      .filter((event) => linkedOodaNodes.some((node) => node.id === event.sourceNodeId))
      .map((event) => ({ id: event.id, label: event.title, time: event.time }));
    return {
      id: activity.id,
      title: activity.title,
      sourceOv1Nodes,
      linkedOodaNodes,
      linkedEntities,
      linkedTimeline
    };
  });

  const mappedActivities = activityRows.filter((row) => row.sourceOv1Nodes.length).length;
  return {
    summary: {
      ov1NodeCount: ov1Nodes.length,
      activityCount: activities.length,
      mappedActivityCount: mappedActivities,
      oodaNodeCount: oodaNodes.length,
      entityCount: entities.length,
      timelineEventCount: timeline.length,
      orphanedOv1SourceIds: [...orphanedOv1SourceIds]
    },
    activities: activityRows
  };
}

export function getTraceTargets(selection, models = {}) {
  if (!selection?.kind) return [];
  const activities = Array.isArray(models.ov5?.activities) ? models.ov5.activities : [];
  const ov1Nodes = Array.isArray(models.ov1?.nodes) ? models.ov1.nodes : [];
  const oodaNodes = flattenOoda(models.ooda);
  const entities = Array.isArray(models.scenario?.entities) ? models.scenario.entities : [];
  const activityById = new Map(activities.map((item) => [item.id, item]));
  const ov1ById = new Map(ov1Nodes.map((item) => [item.id, item]));
  const oodaById = new Map(oodaNodes.map((item) => [item.id, item]));
  const entityById = new Map(entities.map((item) => [item.id, item]));

  const activityIds = resolveActivityIds(selection, activities, oodaById, entityById);
  const oodaIds = resolveOodaIds(selection, activityIds, oodaNodes, entityById);
  const unitIds = resolveUnitIds(selection, activityIds, oodaIds, entities);
  const ov1Ids = resolveOv1Ids(selection, activityIds, activityById);
  const targets = [];

  if (selection.kind !== "ov1") {
    ov1Ids.forEach((id) => addTarget(targets, "ov1", ov1ById.get(id), "来源总体概念"));
  }
  if (selection.kind !== "activity") {
    activityIds.forEach((id) => addTarget(targets, "activity", activityById.get(id), "关联作战活动"));
  }
  if (selection.kind !== "ooda") {
    oodaIds.forEach((id) => addTarget(targets, "ooda", oodaById.get(id), "关联 OODA 节点"));
  }
  if (selection.kind !== "unit") {
    unitIds.forEach((id) => addTarget(targets, "unit", entityById.get(id), "想定实体"));
  }
  return dedupeTargets(targets);
}

function resolveActivityIds(selection, activities, oodaById, entityById) {
  if (selection.kind === "activity") return [selection.id];
  if (selection.kind === "ov1") return activities.filter((item) => unique(item.sourceOv1NodeIds).includes(selection.id)).map((item) => item.id);
  if (selection.kind === "ooda") return [oodaById.get(selection.id)?.sourceActivityId].filter(Boolean);
  if (selection.kind === "unit") return [entityById.get(selection.id)?.sourceActivityId].filter(Boolean);
  return [];
}

function resolveOodaIds(selection, activityIds, oodaNodes, entityById) {
  if (selection.kind === "ooda") return [selection.id];
  if (selection.kind === "unit") return unique(entityById.get(selection.id)?.sourceOodaIds);
  return oodaNodes.filter((item) => activityIds.includes(item.sourceActivityId)).map((item) => item.id);
}

function resolveUnitIds(selection, activityIds, oodaIds, entities) {
  if (selection.kind === "unit") return [selection.id];
  return entities.filter((entity) => activityIds.includes(entity.sourceActivityId) || unique(entity.sourceOodaIds).some((id) => oodaIds.includes(id))).map((entity) => entity.id);
}

function resolveOv1Ids(selection, activityIds, activityById) {
  if (selection.kind === "ov1") return [selection.id];
  return unique(activityIds.flatMap((id) => activityById.get(id)?.sourceOv1NodeIds || []));
}

function flattenOoda(ooda) {
  return (Array.isArray(ooda?.lanes) ? ooda.lanes : []).flatMap((lane) => (lane.nodes || []).map((node) => ({ ...node, laneSubtitle: lane.subtitle || lane.title || "OODA" })));
}

function addTarget(targets, kind, item, relation) {
  if (!item?.id) return;
  targets.push({ id: item.id, kind, view: VIEW_BY_KIND[kind], label: item.label || item.title || item.id, relation });
}

function dedupeTargets(targets) {
  const seen = new Set();
  return targets.filter((target) => {
    const key = `${target.kind}:${target.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];
}
