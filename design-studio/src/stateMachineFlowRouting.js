/**
 * Flowchart edge routing for state machines.
 * Node positions are centers (CSS left/top + translate(-50%,-50%)).
 * Anchors sit on the node border so arrows visually connect.
 */

const PORT_GAP = 0.35;
const LANE_PAD = 3.2;

export function routeSmFlowEdges(edges = [], boxById = new Map()) {
  const boxes = normalizeBoxMap(boxById);
  const obstacles = [...boxes.values()];
  return new Map(
    edges.map((edge) => [
      edge.id,
      routeSmFlowEdge(boxes.get(edge.sourceId), boxes.get(edge.targetId), edge, obstacles)
    ]).filter((entry) => entry[1])
  );
}

export function routeSmFlowEdge(source, target, edge = {}, obstacles = []) {
  const from = normalizeBox(source);
  const to = normalizeBox(target);
  if (!from || !to) return null;

  const blockers = (Array.isArray(obstacles) ? obstacles : [])
    .map(normalizeBox)
    .filter((box) => box && !sameBox(box, from) && !sameBox(box, to));
  const backward = from.center.x > to.center.x + 1.4;
  const sides = choosePorts(from, to, { backward, blockers });
  const start = portPoint(from, sides.from);
  const end = portPoint(to, sides.to);
  const points = routeOrthogonal(from, to, sides.from, sides.to, start, end, blockers, backward);
  const label = labelForPath(points, { backward, start, end });

  return {
    kind: backward ? "backward-orthogonal" : "orthogonal",
    path: pathFromPoints(points),
    label,
    backward,
    condition: edge.condition || edge.label || ""
  };
}

function choosePorts(from, to, { backward = false, blockers = [] } = {}) {
  if (backward) {
    return { from: from.center.y <= to.center.y ? "bottom" : "top", to: to.center.y <= from.center.y ? "bottom" : "top" };
  }
  const dx = to.center.x - from.center.x;
  const dy = to.center.y - from.center.y;
  const candidates = Math.abs(dx) >= Math.abs(dy)
    ? [
      { from: dx >= 0 ? "right" : "left", to: dx >= 0 ? "left" : "right" },
      { from: dy >= 0 ? "bottom" : "top", to: dy >= 0 ? "top" : "bottom" },
      { from: dx >= 0 ? "right" : "left", to: dy >= 0 ? "top" : "bottom" },
      { from: dy >= 0 ? "bottom" : "top", to: dx >= 0 ? "left" : "right" }
    ]
    : [
      { from: dy >= 0 ? "bottom" : "top", to: dy >= 0 ? "top" : "bottom" },
      { from: dx >= 0 ? "right" : "left", to: dx >= 0 ? "left" : "right" },
      { from: dy >= 0 ? "bottom" : "top", to: dx >= 0 ? "left" : "right" },
      { from: dx >= 0 ? "right" : "left", to: dy >= 0 ? "top" : "bottom" }
    ];
  let best = candidates[0];
  let bestScore = Infinity;
  candidates.forEach((pair) => {
    const start = portPoint(from, pair.from);
    const end = portPoint(to, pair.to);
    const points = routeOrthogonal(from, to, pair.from, pair.to, start, end, blockers, false);
    const hits = countHits(points, blockers);
    const length = pathLength(points);
    const score = hits * 1000 + length;
    if (score < bestScore) {
      best = pair;
      bestScore = score;
    }
  });
  return best;
}

function routeOrthogonal(from, to, fromSide, toSide, start, end, blockers = [], backward = false) {
  if (fromSide === oppositeSide(toSide) && alignedOnSide(fromSide, start, end)) {
    return [start, end];
  }

  const fromOut = offsetAlong(start, fromSide, exitGap(from));
  const toOut = offsetAlong(end, toSide, exitGap(to));

  if (backward) {
    const above = Math.min(outerLane(from, "top", blockers), outerLane(to, "top", blockers));
    const below = Math.max(outerLane(from, "bottom", blockers), outerLane(to, "bottom", blockers));
    const preferAbove = from.center.y <= 50 && to.center.y <= 58;
    const laneY = preferAbove ? above : below;
    return [start, fromOut, { x: fromOut.x, y: laneY }, { x: toOut.x, y: laneY }, toOut, end];
  }

  if (sameAxis(fromSide, toSide)) {
    const mid = sameAxis(fromSide, "left")
      ? { x: (fromOut.x + toOut.x) / 2, y: fromOut.y }
      : { x: fromOut.x, y: (fromOut.y + toOut.y) / 2 };
    const via = sameAxis(fromSide, "left")
      ? [start, fromOut, { x: mid.x, y: fromOut.y }, { x: mid.x, y: toOut.y }, toOut, end]
      : [start, fromOut, { x: fromOut.x, y: mid.y }, { x: toOut.x, y: mid.y }, toOut, end];
    if (!countHits(via, blockers)) return via;
  }

  const elbowA = [start, fromOut, { x: toOut.x, y: fromOut.y }, toOut, end];
  const elbowB = [start, fromOut, { x: fromOut.x, y: toOut.y }, toOut, end];
  const scored = [elbowA, elbowB]
    .map((points) => ({ points, hits: countHits(points, blockers), length: pathLength(points) }))
    .sort((a, b) => a.hits - b.hits || a.length - b.length);
  if (scored[0].hits === 0) return scored[0].points;

  const around = detourAround(from, to, fromSide, toSide, start, end, fromOut, toOut, blockers);
  return around || scored[0].points;
}

function detourAround(from, to, fromSide, toSide, start, end, fromOut, toOut, blockers) {
  const above = Math.min(outerLane(from, "top", blockers), outerLane(to, "top", blockers));
  const below = Math.max(outerLane(from, "bottom", blockers), outerLane(to, "bottom", blockers));
  const left = Math.min(outerLane(from, "left", blockers), outerLane(to, "left", blockers));
  const right = Math.max(outerLane(from, "right", blockers), outerLane(to, "right", blockers));
  const candidates = [
    [start, fromOut, { x: fromOut.x, y: above }, { x: toOut.x, y: above }, toOut, end],
    [start, fromOut, { x: fromOut.x, y: below }, { x: toOut.x, y: below }, toOut, end],
    [start, fromOut, { x: left, y: fromOut.y }, { x: left, y: toOut.y }, toOut, end],
    [start, fromOut, { x: right, y: fromOut.y }, { x: right, y: toOut.y }, toOut, end]
  ];
  const scored = candidates
    .map((points) => ({ points, hits: countHits(points, blockers), length: pathLength(points) }))
    .sort((a, b) => a.hits - b.hits || a.length - b.length);
  return scored[0]?.points || null;
}

function labelForPath(points, { backward, start, end }) {
  const label = polylineMidpoint(points);
  if (!backward) {
    return Math.abs(end.y - start.y) < 1.2
      ? { x: label.x, y: label.y - 5.2 }
      : { x: label.x, y: label.y - 3.4 };
  }
  return { x: label.x, y: label.y - 5.6 };
}

function portPoint(box, side) {
  const inset = PORT_GAP;
  if (side === "left") return { x: box.center.x - box.halfW + inset, y: box.center.y };
  if (side === "right") return { x: box.center.x + box.halfW - inset, y: box.center.y };
  if (side === "top") return { x: box.center.x, y: box.center.y - box.halfH + inset };
  return { x: box.center.x, y: box.center.y + box.halfH - inset };
}

function offsetAlong(point, side, distance) {
  if (side === "left") return { x: point.x - distance, y: point.y };
  if (side === "right") return { x: point.x + distance, y: point.y };
  if (side === "top") return { x: point.x, y: point.y - distance };
  return { x: point.x, y: point.y + distance };
}

function exitGap(box) {
  return Math.max(2.4, Math.min(box.halfW, box.halfH) * 0.45);
}

function outerLane(box, side, blockers) {
  const extras = blockers.map((item) => {
    if (side === "top") return item.center.y - item.halfH;
    if (side === "bottom") return item.center.y + item.halfH;
    if (side === "left") return item.center.x - item.halfW;
    return item.center.x + item.halfW;
  });
  if (side === "top") return Math.min(box.center.y - box.halfH, ...extras) - LANE_PAD;
  if (side === "bottom") return Math.max(box.center.y + box.halfH, ...extras) + LANE_PAD;
  if (side === "left") return Math.min(box.center.x - box.halfW, ...extras) - LANE_PAD;
  return Math.max(box.center.x + box.halfW, ...extras) + LANE_PAD;
}

function countHits(points, blockers) {
  if (!blockers.length) return 0;
  let hits = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    blockers.forEach((box) => {
      if (segmentHitsBox(a, b, box)) hits += 1;
    });
  }
  return hits;
}

function segmentHitsBox(a, b, box) {
  const pad = 0.7;
  const left = box.center.x - box.halfW - pad;
  const right = box.center.x + box.halfW + pad;
  const top = box.center.y - box.halfH - pad;
  const bottom = box.center.y + box.halfH + pad;
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  if (maxX < left || minX > right || maxY < top || minY > bottom) return false;
  const horizontal = Math.abs(a.y - b.y) < 0.2;
  const vertical = Math.abs(a.x - b.x) < 0.2;
  if (horizontal) return a.y > top && a.y < bottom && maxX > left && minX < right;
  if (vertical) return a.x > left && a.x < right && maxY > top && minY < bottom;
  return true;
}

function pathLength(points) {
  return points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
}

function alignedOnSide(side, start, end) {
  return sameAxis(side, "left") ? Math.abs(start.y - end.y) < 0.8 : Math.abs(start.x - end.x) < 0.8;
}

function sameAxis(side, sample) {
  return sample === "left" || sample === "right"
    ? side === "left" || side === "right"
    : side === "top" || side === "bottom";
}

function oppositeSide(side) {
  if (side === "left") return "right";
  if (side === "right") return "left";
  if (side === "top") return "bottom";
  return "top";
}

function sameBox(a, b) {
  return Math.abs(a.center.x - b.center.x) < 0.01 && Math.abs(a.center.y - b.center.y) < 0.01;
}

/** Border point of a centered box toward a target point. */
export function borderAnchor(box, toward) {
  const b = normalizeBox(box);
  if (!b) return { x: 50, y: 50 };
  const dx = (toward?.x ?? b.center.x) - b.center.x;
  const dy = (toward?.y ?? b.center.y) - b.center.y;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return { x: b.center.x + b.halfW, y: b.center.y };
  }
  const absDx = Math.abs(dx) || 0.001;
  const absDy = Math.abs(dy) || 0.001;
  // LogicFlow-style diamond nodes use a rhombus boundary, others a box boundary.
  const t = b.shape === "diamond"
    ? 1 / (absDx / b.halfW + absDy / b.halfH)
    : Math.min(b.halfW / absDx, b.halfH / absDy);
  return {
    x: b.center.x + dx * t,
    y: b.center.y + dy * t
  };
}

function normalizeBoxMap(boxById) {
  const map = new Map();
  if (boxById instanceof Map) {
    boxById.forEach((value, key) => {
      const box = normalizeBox(value);
      if (box) map.set(key, { ...box, id: key });
    });
    return map;
  }
  if (boxById && typeof boxById === "object") {
    Object.entries(boxById).forEach(([key, value]) => {
      const box = normalizeBox(value);
      if (box) map.set(key, { ...box, id: key });
    });
  }
  return map;
}

function normalizeBox(value) {
  if (!value || typeof value !== "object") return null;
  const center = value.center && typeof value.center === "object"
    ? value.center
    : { x: Number(value.x), y: Number(value.y) };
  const cx = Number(center.x);
  const cy = Number(center.y);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const halfW = Math.max(0.8, Number(value.halfW) || 4);
  const halfH = Math.max(0.8, Number(value.halfH) || 2);
  return { center: { x: cx, y: cy }, halfW, halfH, shape: value.shape === "diamond" ? "diamond" : "rect" };
}

function pathFromPoints(points = []) {
  if (!points.length) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${r(point.x)} ${r(point.y)}`)
    .join(" ");
}

function mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function polylineMidpoint(points = []) {
  const segments = points.slice(1).map((point, index) => {
    const start = points[index];
    return { start, end: point, length: Math.hypot(point.x - start.x, point.y - start.y) };
  }).filter((segment) => segment.length > 0.001);
  const half = segments.reduce((sum, segment) => sum + segment.length, 0) / 2;
  let walked = 0;
  for (const segment of segments) {
    if (walked + segment.length >= half) {
      const ratio = (half - walked) / segment.length;
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
        y: segment.start.y + (segment.end.y - segment.start.y) * ratio
      };
    }
    walked += segment.length;
  }
  return mid(points[0] || { x: 50, y: 50 }, points.at(-1) || { x: 50, y: 50 });
}

function r(value) {
  return Math.round(Number(value) * 100) / 100;
}
