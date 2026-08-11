// Stored node positions are top-left coordinates in a 0..100 home viewport.
// Keep every default lane at least one card width apart. Dense graphs grow down
// into the free canvas instead of squeezing cards on top of one another.
const BANDS = {
  external: { x: 4 },
  equipment: { x: 22 },
  command: { x: 42 },
  action: { x: 60 },
  effect: { x: 84 }
};

// Keep the first support pair close to the main spine. Far-edge slots are
// reserved for the fourth and fifth item so ordinary 2-3 item bands read as
// compact support groups rather than sparse top-to-bottom ladders.
const HOME_ROWS = [48, 28, 68, 8, 88];
const OVERFLOW_PAGE_HEIGHT = 112;
const CARD_WIDTH = 14;
const CARD_HEIGHT = 12;
const CARD_GAP = 1.5;

/**
 * Arrange an OV-1 around a readable left-to-right operational backbone.
 * Each semantic type gets its own vertical lane. Five cards fit in the home
 * viewport per lane; additional cards continue below it in the free canvas.
 */
export function layoutOv1Nodes(nodes = [], edges = []) {
  const degree = new Map(nodes.map((node) => [node.id, 0]));
  edges.forEach((edge) => {
    degree.set(edge.sourceId, (degree.get(edge.sourceId) || 0) + 1);
    degree.set(edge.targetId, (degree.get(edge.targetId) || 0) + 1);
  });

  const groups = new Map();
  nodes.forEach((node, index) => {
    const group = layoutBandFor(node);
    const entries = groups.get(group) || [];
    entries.push({ node, index });
    groups.set(group, entries);
  });

  const positions = new Map();
  groups.forEach((entries, group) => {
    const ordered = orderEntries(entries, group, degree, edges);
    ordered.forEach(({ node }, index) => {
      const slot = laneSlot(BANDS[group] || BANDS.action, index);
      positions.set(node.id, { x: `${slot.x}%`, y: `${slot.y}%` });
    });
  });

  return nodes.map((node) => ({ ...node, ...(positions.get(node.id) || {}) }));
}

function layoutBandFor(node = {}) {
  if (node.kind === "effect") return "effect";
  if (node.kind === "external" || node.kind === "environment") return "external";
  if (node.kind === "command") return "command";
  if (node.kind === "equipment" || node.kind === "participant") return "equipment";
  return "action";
}

function orderEntries(entries, group, degree, edges) {
  const internalDegree = group === "action" ? degreesWithin(entries, edges) : null;
  return [...entries].sort((left, right) => {
    const internalDifference = internalDegree
      ? (internalDegree.get(right.node.id) || 0) - (internalDegree.get(left.node.id) || 0)
      : 0;
    if (internalDifference) return internalDifference;
    const totalDifference = (degree.get(right.node.id) || 0) - (degree.get(left.node.id) || 0);
    return totalDifference || left.index - right.index;
  });
}

function degreesWithin(entries, edges) {
  const ids = new Set(entries.map(({ node }) => node.id));
  const degree = new Map(entries.map(({ node }) => [node.id, 0]));
  edges.forEach((edge) => {
    if (!ids.has(edge.sourceId) || !ids.has(edge.targetId)) return;
    degree.set(edge.sourceId, (degree.get(edge.sourceId) || 0) + 1);
    degree.set(edge.targetId, (degree.get(edge.targetId) || 0) + 1);
  });
  return degree;
}

function laneSlot(band, index) {
  const page = Math.floor(index / HOME_ROWS.length);
  return {
    x: band.x,
    y: HOME_ROWS[index % HOME_ROWS.length] + page * OVERFLOW_PAGE_HEIGHT
  };
}

/** Keep manual placement usable without allowing cards to be dropped on top of one another. */
export function resolveOv1NodePosition(nodes = [], nodeId, position = {}, options = {}) {
  const width = Number(options.width) || CARD_WIDTH;
  const height = Number(options.height) || CARD_HEIGHT;
  const gap = Number(options.gap) || CARD_GAP;
  const origin = { x: Number.parseFloat(position.x), y: Number.parseFloat(position.y) };
  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return position;
  const occupied = nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => ({ x: Number.parseFloat(node.x), y: Number.parseFloat(node.y) }))
    .filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y));
  const candidates = [origin];
  const stepX = width + gap;
  const stepY = height + gap;
  for (let ring = 1; ring <= 6; ring += 1) {
    for (let y = -ring; y <= ring; y += 1) {
      for (let x = -ring; x <= ring; x += 1) {
        if (Math.max(Math.abs(x), Math.abs(y)) !== ring) continue;
        candidates.push({ x: origin.x + x * stepX, y: origin.y + y * stepY });
      }
    }
  }
  const free = candidates.find((candidate) => !occupied.some((node) => boxesOverlap(candidate, node, width, height, gap)));
  const resolved = free || origin;
  return { x: `${round(resolved.x)}%`, y: `${round(resolved.y)}%` };
}

function boxesOverlap(left, right, width, height, gap) {
  return left.x < right.x + width + gap
    && left.x + width + gap > right.x
    && left.y < right.y + height + gap
    && left.y + height + gap > right.y;
}

function round(value) {
   return Math.round(Number(value) * 100) / 100;
}
