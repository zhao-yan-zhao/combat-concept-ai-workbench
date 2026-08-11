const FEEDBACK_TYPE = "\u53cd\u9988";

/**
 * Route OV-1 edges in a 0..100 world. The caller supplies measured or
 * estimated node boxes so first paint and live drag use the same rules.
 */
export function routeOv1Edges(edges = [], boxById = new Map(), options = {}) {
  const boxes = asBoxMap(boxById);
  const obstacles = [...boxes.values()];
  return new Map(edges.map((edge) => [edge.id, routeOv1Edge({
    edge,
    source: boxes.get(edge.sourceId),
    target: boxes.get(edge.targetId),
    obstacles,
    ...options
  })]));
}

export function routeOv1Edge({ edge = {}, source, target, obstacles = [], alignmentTolerance } = {}) {
  const from = normalizeBox(source);
  const to = normalizeBox(target);
  if (!from || !to) return null;

  const dx = to.center.x - from.center.x;
  const dy = to.center.y - from.center.y;
  const distance = Math.hypot(dx, dy) || 1;
  const horizontalTolerance = Number.isFinite(alignmentTolerance)
    ? alignmentTolerance
    : Math.max(1, Math.min(from.halfH, to.halfH) * 0.45);
  const verticalTolerance = Number.isFinite(alignmentTolerance)
    ? alignmentTolerance
    : Math.max(1, Math.min(from.halfW, to.halfW) * 0.25);
  const horizontal = Math.abs(dy) <= horizontalTolerance;
  const vertical = Math.abs(dx) <= verticalTolerance;
  const start = boxAnchor(from, to.center);
  const end = boxAnchor(to, from.center);
  const context = { edge, from, to, obstacles, start, end, horizontal, vertical };

  if (horizontal && segmentIsClear(start, end, obstacles, edge)) return routeStraight(start, end, "horizontal");
  if (vertical && segmentIsClear(start, end, obstacles, edge)) return routeStraight(start, end, "vertical");
  if (edge.type === FEEDBACK_TYPE && distance >= 18) return routeFeedback(context);
  if (horizontal || vertical) return routeOrthogonal(context, horizontal ? "horizontal" : "vertical");
  return routeCurve(context);
}

function routeStraight(start, end, axis) {
  return {
    kind: `straight-${axis}`,
    path: `M${round(start.x)} ${round(start.y)} L${round(end.x)} ${round(end.y)}`,
    label: clampPoint(midpoint(start, end))
  };
}

function routeOrthogonal(context, axis) {
  const { edge, start, end, obstacles } = context;
  const gap = 2.6;
  const bounds = obstacleBounds(obstacles, edge);
  const candidates = axis === "horizontal"
    ? [bounds.top - gap, bounds.bottom + gap].map((value) => orthogonalHorizontal(start, end, value))
    : [bounds.left - gap, bounds.right + gap].map((value) => orthogonalVertical(start, end, value));
  const best = chooseCandidate(candidates, obstacles, edge);
  return {
    kind: `detour-${axis}`,
    path: pathFromPoints(best.points),
    label: clampPoint(best.label)
  };
}

function orthogonalHorizontal(start, end, y) {
  const viaY = clamp(y, 1.5, 98.5);
  const points = [start, { x: start.x, y: viaY }, { x: end.x, y: viaY }, end];
  return { points, label: { x: (start.x + end.x) / 2, y: viaY } };
}

function orthogonalVertical(start, end, x) {
  const viaX = clamp(x, 1.5, 98.5);
  const points = [start, { x: viaX, y: start.y }, { x: viaX, y: end.y }, end];
  return { points, label: { x: viaX, y: (start.y + end.y) / 2 } };
}

function routeFeedback(context) {
  const { edge, from, to, obstacles } = context;
  const bounds = obstacleBounds(obstacles, edge, true);
  const horizontal = Math.abs(to.center.x - from.center.x) >= Math.abs(to.center.y - from.center.y);
  const candidates = horizontal
    ? [bounds.top - 3.2, bounds.bottom + 3.2].map((value) => feedbackRailHorizontal(from, to, value))
    : [bounds.left - 3.2, bounds.right + 3.2].map((value) => feedbackRailVertical(from, to, value));
  const best = chooseCandidate(candidates, obstacles, edge, 0.8);
  return { kind: "feedback-rail", path: pathFromPoints(best.points), label: clampPoint(best.label) };
}

function feedbackRailHorizontal(from, to, y) {
  const railY = clamp(y, 1.5, 98.5);
  const source = { x: from.center.x, y: from.center.y + (railY >= from.center.y ? from.halfH : -from.halfH) };
  const target = { x: to.center.x, y: to.center.y + (railY >= to.center.y ? to.halfH : -to.halfH) };
  const points = [source, { x: source.x, y: railY }, { x: target.x, y: railY }, target];
  return { points, label: { x: (source.x + target.x) / 2, y: railY } };
}

function feedbackRailVertical(from, to, x) {
  const railX = clamp(x, 1.5, 98.5);
  const source = { x: from.center.x + (railX >= from.center.x ? from.halfW : -from.halfW), y: from.center.y };
  const target = { x: to.center.x + (railX >= to.center.x ? to.halfW : -to.halfW), y: to.center.y };
  const points = [source, { x: railX, y: source.y }, { x: railX, y: target.y }, target];
  return { points, label: { x: railX, y: (source.y + target.y) / 2 } };
}

function routeCurve(context) {
  const { edge, start, end, obstacles } = context;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / distance, y: dx / distance };
  const bend = clamp(distance * 0.12, 2.4, 6);
  const candidates = [-1, 1].map((sign) => {
    const control = {
      x: (start.x + end.x) / 2 + normal.x * bend * sign,
      y: (start.y + end.y) / 2 + normal.y * bend * sign
    };
    return {
      path: `M${round(start.x)} ${round(start.y)} Q${round(control.x)} ${round(control.y)} ${round(end.x)} ${round(end.y)}`,
      samples: quadraticSamples(start, control, end),
      label: quadraticPoint(start, control, end, 0.5)
    };
  });
  const best = chooseCandidate(candidates, obstacles, edge, 0.25);
  return { kind: "curve", path: best.path, label: clampPoint(best.label) };
}

function chooseCandidate(candidates, obstacles, edge, extraDistanceWeight = 0) {
  return candidates.map((candidate) => {
    const points = candidate.points || candidate.samples || [];
    const collisions = points.length ? pathCollisionCount(points, obstacles, edge) : 0;
    const distance = pathLength(points);
    return { ...candidate, score: collisions * 10000 + distance * extraDistanceWeight };
  }).sort((left, right) => left.score - right.score)[0];
}

function segmentIsClear(start, end, obstacles, edge) {
  return obstacles.every((box) => {
    if (!box || box.id === edge.sourceId || box.id === edge.targetId) return true;
    return !segmentIntersectsBox(start, end, box, 0.8);
  });
}

function pathCollisionCount(points, obstacles, edge) {
  let count = 0;
  for (const box of obstacles) {
    if (!box || box.id === edge.sourceId || box.id === edge.targetId) continue;
    for (let index = 1; index < points.length; index += 1) {
      if (segmentIntersectsBox(points[index - 1], points[index], box, 0.8)) {
        count += 1;
        break;
      }
    }
  }
  return count;
}

function segmentIntersectsBox(start, end, box, pad) {
  const rect = boxRect(box, pad);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let enter = 0;
  let exit = 1;
  for (const [origin, delta, min, max] of [[start.x, dx, rect.left, rect.right], [start.y, dy, rect.top, rect.bottom]]) {
    if (Math.abs(delta) < 0.0001) {
      if (origin < min || origin > max) return false;
      continue;
    }
    const a = (min - origin) / delta;
    const b = (max - origin) / delta;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
    if (enter > exit) return false;
  }
  return true;
}

function obstacleBounds(obstacles, edge, includeEndpoints = false) {
  const boxes = obstacles.filter((box) => box && (includeEndpoints || (box.id !== edge.sourceId && box.id !== edge.targetId)));
  if (!boxes.length) return { left: 2, right: 98, top: 2, bottom: 98 };
  return boxes.reduce((bounds, box) => {
    const rect = boxRect(box, 0);
    return {
      left: Math.min(bounds.left, rect.left),
      right: Math.max(bounds.right, rect.right),
      top: Math.min(bounds.top, rect.top),
      bottom: Math.max(bounds.bottom, rect.bottom)
    };
  }, { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
}

function boxAnchor(box, toward) {
  const dx = toward.x - box.center.x;
  const dy = toward.y - box.center.y;
  const scale = 1 / Math.max(Math.abs(dx) / Math.max(box.halfW, 0.5), Math.abs(dy) / Math.max(box.halfH, 0.5), 1);
  return { x: box.center.x + dx * scale, y: box.center.y + dy * scale };
}

function asBoxMap(value) {
  if (value instanceof Map) return new Map([...value.entries()].map(([id, box]) => [id, normalizeBox({ ...box, id: box?.id || id })]).filter(([, box]) => box));
  return new Map((Array.isArray(value) ? value : []).map((box) => [box?.id, normalizeBox(box)]).filter(([id, box]) => id && box));
}

function normalizeBox(value) {
  const x = Number(value?.center?.x);
  const y = Number(value?.center?.y);
  const halfW = Number(value?.halfW);
  const halfH = Number(value?.halfH);
  if (![x, y, halfW, halfH].every(Number.isFinite)) return null;
  return { id: String(value?.id || ""), center: { x, y }, halfW: Math.max(0.5, halfW), halfH: Math.max(0.5, halfH) };
}

function boxRect(box, pad = 0) {
  return { left: box.center.x - box.halfW - pad, right: box.center.x + box.halfW + pad, top: box.center.y - box.halfH - pad, bottom: box.center.y + box.halfH + pad };
}

function midpoint(start, end) {
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

function quadraticPoint(start, control, end, t) {
  const u = 1 - t;
  return { x: u * u * start.x + 2 * u * t * control.x + t * t * end.x, y: u * u * start.y + 2 * u * t * control.y + t * t * end.y };
}

function quadraticSamples(start, control, end) {
  return Array.from({ length: 17 }, (_, index) => quadraticPoint(start, control, end, index / 16));
}

function cubicPoint(start, first, second, end, t) {
  const u = 1 - t;
  return {
    x: u ** 3 * start.x + 3 * u ** 2 * t * first.x + 3 * u * t ** 2 * second.x + t ** 3 * end.x,
    y: u ** 3 * start.y + 3 * u ** 2 * t * first.y + 3 * u * t ** 2 * second.y + t ** 3 * end.y
  };
}

function cubicSamples(start, first, second, end) {
  return Array.from({ length: 25 }, (_, index) => cubicPoint(start, first, second, end, index / 24));
}

function pathFromPoints(points) {
  return points.map((point, index) => `${index ? "L" : "M"}${round(point.x)} ${round(point.y)}`).join(" ");
}

function pathLength(points = []) {
  return points.reduce((total, point, index) => index ? total + Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y) : total, 0);
}

function clampPoint(point) {
  return { x: clamp(point.x, 1, 99), y: clamp(point.y, 1, 99) };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function round(value) {
  return Math.round(Number(value) * 100) / 100;
}
