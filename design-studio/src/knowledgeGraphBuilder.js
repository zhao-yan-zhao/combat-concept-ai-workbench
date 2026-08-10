const MAX_NODES = 12;
const MAX_EDGES = 24;

export function buildKnowledgeGraph(docs, { focusIds = [] } = {}) {
  const source = Array.isArray(docs) ? docs : [];
  const focus = new Set(focusIds.filter(Boolean));
  const nodes = source
    .map((doc) => normalizeNode(doc, focus.has(doc?.id)))
    .filter(Boolean)
    .sort((left, right) => Number(right.focused) - Number(left.focused) || left.title.localeCompare(right.title))
    .slice(0, MAX_NODES)
    .map((node, index, list) => ({ ...node, ...positionNode(index, list.length) }));
  const aliasToId = buildAliasIndex(nodes);
  const edges = mergeEdges([
    ...buildLinkEdges(nodes, aliasToId),
    ...buildSharedTagEdges(nodes)
  ]).slice(0, MAX_EDGES);
  const connected = new Set(edges.flatMap((edge) => [edge.sourceId, edge.targetId]));
  return {
    nodes,
    edges,
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      linkEdgeCount: edges.filter((edge) => edge.types.includes("link")).length,
      tagEdgeCount: edges.filter((edge) => edge.types.includes("tag")).length,
      isolatedCount: nodes.filter((node) => !connected.has(node.id)).length
    }
  };
}

function normalizeNode(doc, focused) {
  const id = clean(doc?.id, 180);
  const title = clean(doc?.title || doc?.fileTitle || doc?.name, 240);
  if (!id || !title) return null;
  return {
    id,
    title,
    label: title.length > 15 ? `${title.slice(0, 14)}…` : title,
    filePath: clean(doc?.filePath || doc?.name, 600),
    tags: unique((doc?.tags || []).map((tag) => clean(tag, 120)).filter(Boolean)),
    links: unique((doc?.links || []).map(normalizeAlias).filter(Boolean)),
    focused
  };
}

function buildAliasIndex(nodes) {
  return nodes.reduce((index, node) => {
    [node.id, node.title, node.filePath, stripExtension(node.filePath)].map(normalizeAlias).filter(Boolean).forEach((alias) => {
      if (!index.has(alias)) index.set(alias, node.id);
    });
    return index;
  }, new Map());
}

function buildLinkEdges(nodes, aliasToId) {
  return nodes.flatMap((node) => node.links.flatMap((link) => {
    const targetId = aliasToId.get(link);
    return targetId && targetId !== node.id ? [{ sourceId: node.id, targetId, type: "link", label: "双链" }] : [];
  }));
}

function buildSharedTagEdges(nodes) {
  const byTag = new Map();
  nodes.forEach((node) => node.tags.forEach((tag) => {
    const list = byTag.get(tag) || [];
    list.push(node.id);
    byTag.set(tag, list);
  }));
  return [...byTag.entries()].flatMap(([tag, ids]) => {
    if (ids.length < 2) return [];
    return ids.slice(1).map((targetId) => ({ sourceId: ids[0], targetId, type: "tag", label: `标签:${tag}` }));
  });
}

function mergeEdges(edges) {
  const merged = new Map();
  edges.forEach((edge) => {
    const [sourceId, targetId] = [edge.sourceId, edge.targetId].sort();
    const key = `${sourceId}:${targetId}`;
    const current = merged.get(key);
    if (current) {
      current.types.push(edge.type);
      current.labels.push(edge.label);
      return;
    }
    merged.set(key, { sourceId, targetId, types: [edge.type], labels: [edge.label] });
  });
  return [...merged.values()].map((edge) => ({ ...edge, types: unique(edge.types), labels: unique(edge.labels) }));
}

function positionNode(index, count) {
  if (count === 1) return { x: 50, y: 50 };
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
  return { x: Number((50 + Math.cos(angle) * 39).toFixed(2)), y: Number((50 + Math.sin(angle) * 36).toFixed(2)) };
}

function normalizeAlias(value) {
  return clean(String(value || "").replace(/^\[\[|\]\]$/g, "").replace(/#.*/, ""), 600).toLowerCase();
}

function stripExtension(value) {
  return String(value || "").replace(/\.[A-Za-z0-9_-]+$/, "");
}

function clean(value, maximum) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function unique(values) {
  return [...new Set(values)];
}
