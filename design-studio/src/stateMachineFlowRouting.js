/**
 * Flowchart edge routing for state machines.
 * Node positions are centers (CSS left/top + translate(-50%,-50%)).
 * Anchors sit on the node border so arrows visually connect.
 */

export function routeSmFlowEdges(edges = [], boxById = new Map()) {
  const boxes = normalizeBoxMap(boxById);
  return new Map(
    edges.map((edge) => [
      edge.id,
      routeSmFlowEdge(boxes.get(edge.sourceId), boxes.get(edge.targetId), edge)
    ]).filter((entry) => entry[1])
  );
}

export function routeSmFlowEdge(source, target, edge = {}) {
  const from = normalizeBox(source);
  const to = normalizeBox(target);
  if (!from || !to) return null;

  const start = borderAnchor(from, to.center);
  const end = borderAnchor(to, from.center);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const horizontal = Math.abs(dy) <= Math.max(1.2, Math.min(from.halfH, to.halfH) * 0.8);
  const vertical = Math.abs(dx) <= Math.max(1.2, Math.min(from.halfW, to.halfW) * 0.8);

  if (horizontal || vertical) {
    return {
      kind: horizontal ? "straight-horizontal" : "straight-vertical",
      path: `M${r(start.x)} ${r(start.y)} L${r(end.x)} ${r(end.y)}`,
      label: mid(start, end)
    };
  }

  // Orthogonal elbow: mid X then mid Y (readable for flowchart branches)
  const midX = (start.x + end.x) / 2;
  const points = [
    start,
    { x: midX, y: start.y },
    { x: midX, y: end.y },
    end
  ];
  return {
    kind: "orthogonal",
    path: pathFromPoints(points),
    label: polylineMidpoint(points),
    condition: edge.condition || edge.label || ""
  };
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
