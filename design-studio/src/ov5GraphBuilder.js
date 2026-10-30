const MAX_VISIBLE_NODES = 24;
const MAX_VISIBLE_EDGES = 96;

export function buildOv5ActivityGraph(model = {}) {
  const activities = Array.isArray(model.activities) ? model.activities.slice(0, MAX_VISIBLE_NODES) : [];
  const nodeById = new Map(activities.map((activity) => [String(activity.id || ""), activity]));
  const edges = (Array.isArray(model.edges) ? model.edges : [])
    .filter((edge) => nodeById.has(String(edge?.sourceId || "")) && nodeById.has(String(edge?.targetId || "")))
    .slice(0, MAX_VISIBLE_EDGES)
    .map((edge) => ({ ...edge, sourceId: String(edge.sourceId), targetId: String(edge.targetId) }));
  const layout = calculateLayers(activities, edges);
  const layers = [...new Set(layout.values())].sort((left, right) => left - right);
  const rowsByLayer = new Map(layers.map((layer) => [layer, activities.filter((activity) => layout.get(String(activity.id)) === layer)]));
  return {
    nodes: activities.map((activity) => positionNode(activity, layout.get(String(activity.id)) || 0, layers, rowsByLayer)),
    edges,
    cycleNodeIds: layout.cycleNodeIds,
    hiddenNodeCount: Math.max(0, (model.activities?.length || 0) - activities.length),
    hiddenEdgeCount: Math.max(0, (model.edges?.length || 0) - edges.length)
  };
}

function calculateLayers(activities, edges) {
  const ids = activities.map((activity) => String(activity.id || ""));
  const indegree = new Map(ids.map((id) => [id, 0]));
  const outgoing = new Map(ids.map((id) => [id, []]));
  edges.forEach((edge) => {
    indegree.set(edge.targetId, (indegree.get(edge.targetId) || 0) + 1);
    outgoing.get(edge.sourceId)?.push(edge.targetId);
  });
  const layerById = new Map();
  const queue = ids.filter((id) => indegree.get(id) === 0);
  while (queue.length) {
    const id = queue.shift();
    const layer = layerById.get(id) || 0;
    outgoing.get(id)?.forEach((targetId) => {
      layerById.set(targetId, Math.max(layerById.get(targetId) || 0, layer + 1));
      indegree.set(targetId, (indegree.get(targetId) || 0) - 1);
      if (indegree.get(targetId) === 0) queue.push(targetId);
    });
  }
  const cycleNodeIds = ids.filter((id) => !layerById.has(id) && indegree.get(id) > 0);
  const fallbackLayer = Math.max(0, ...layerById.values()) + 1;
  cycleNodeIds.forEach((id, index) => layerById.set(id, fallbackLayer + index));
  ids.forEach((id) => { if (!layerById.has(id)) layerById.set(id, 0); });
  layerById.cycleNodeIds = cycleNodeIds;
  return layerById;
}

function positionNode(activity, layer, layers, rowsByLayer) {
  const row = rowsByLayer.get(layer) || [];
  const index = row.findIndex((item) => item.id === activity.id);
  const totalLayers = Math.max(1, layers.length);
  const totalRows = Math.max(1, row.length);

  return {
    ...activity,
    x: totalLayers <= 1 ? 50 : 10 + (80 * layers.indexOf(layer)) / (totalLayers - 1),
    y: totalRows <= 1 ? 50 : 15 + (70 * (index + 0.5)) / totalRows
  };
}
