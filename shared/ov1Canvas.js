/**
 * OV-1 free canvas.
 *
 * Logical coordinates: 0–100 is the home viewport (generated graphs live here).
 * Drag may go outside 0–100 freely; the world element expands to fit content.
 */

/** Soft absolute limits only to keep numbers finite (not a tight frame). */
export const OV1_COORD_MIN = -5000;
export const OV1_COORD_MAX = 5000;

export const OV1_HOME_MIN = 0;
export const OV1_HOME_MAX = 100;

/** Padding only when content has left the home viewport (free-drag expansion). */
export const OV1_CONTENT_PAD = 16;

/**
 * Compute the world box for rendering.
 * - Generated / home graphs (coords ~0–100): world === stage (1:1), no shift/crop.
 * - Free drag past edges: world expands to fit content with padding.
 */
export function computeOv1WorldBounds(nodes = []) {
  let contentMinX = Infinity;
  let contentMinY = Infinity;
  let contentMaxX = -Infinity;
  let contentMaxY = -Infinity;
  let hasNodes = false;

  for (const node of nodes) {
    const x = Number.parseFloat(node?.x);
    const y = Number.parseFloat(node?.y);
    // Node top-left is stored; reserve footprint so right/bottom cards stay on-screen.
    if (Number.isFinite(x)) {
      hasNodes = true;
      contentMinX = Math.min(contentMinX, x);
      contentMaxX = Math.max(contentMaxX, x + 14);
    }
    if (Number.isFinite(y)) {
      hasNodes = true;
      contentMinY = Math.min(contentMinY, y);
      contentMaxY = Math.max(contentMaxY, y + 12);
    }
  }

  if (!hasNodes) {
    return homeWorldBounds();
  }

  // Entire diagram still lives in the home viewport → lock 1:1 with the stage.
  const staysInHome = contentMinX >= -1
    && contentMinY >= -1
    && contentMaxX <= 101
    && contentMaxY <= 101;
  if (staysInHome) {
    return homeWorldBounds();
  }

  // Free canvas: expand around content, keep at least one home viewport of room.
  let minX = contentMinX - OV1_CONTENT_PAD;
  let minY = contentMinY - OV1_CONTENT_PAD;
  let maxX = contentMaxX + OV1_CONTENT_PAD;
  let maxY = contentMaxY + OV1_CONTENT_PAD;
  minX = Math.min(minX, OV1_HOME_MIN);
  minY = Math.min(minY, OV1_HOME_MIN);
  maxX = Math.max(maxX, OV1_HOME_MAX);
  maxY = Math.max(maxY, OV1_HOME_MAX);

  const width = Math.max(OV1_HOME_MAX - OV1_HOME_MIN, maxX - minX);
  const height = Math.max(OV1_HOME_MAX - OV1_HOME_MIN, maxY - minY);
  return {
    minX,
    minY,
    maxX: minX + width,
    maxY: minY + height,
    width,
    height,
    widthPct: width,
    heightPct: height
  };
}

function homeWorldBounds() {
  return {
    minX: OV1_HOME_MIN,
    minY: OV1_HOME_MIN,
    maxX: OV1_HOME_MAX,
    maxY: OV1_HOME_MAX,
    width: OV1_HOME_MAX - OV1_HOME_MIN,
    height: OV1_HOME_MAX - OV1_HOME_MIN,
    widthPct: 100,
    heightPct: 100
  };
}

/** Map logical node % → CSS % inside the content world box. */
export function logicalToWorldCss(logicalX, logicalY, bounds) {
  const x = Number.parseFloat(logicalX);
  const y = Number.parseFloat(logicalY);
  const lx = Number.isFinite(x) ? x : 42;
  const ly = Number.isFinite(y) ? y : 42;
  const left = ((lx - bounds.minX) / bounds.width) * 100;
  const top = ((ly - bounds.minY) / bounds.height) * 100;
  return {
    left: `${roundCoord(left)}%`,
    top: `${roundCoord(top)}%`
  };
}

/** Viewport/home layout is already logical 0–100 — keep as-is for generation. */
export function viewportLayoutToWorldPercent(x, y) {
  return {
    x: `${roundCoord(Number(x))}%`,
    y: `${roundCoord(Number(y))}%`
  };
}

export function viewportLayoutToWorld(x, y) {
  return { x: Number(x), y: Number(y) };
}

export function normalizeWorldPosition(value, fallback = 42) {
  const number = Number.parseFloat(value);
  const raw = Number.isFinite(number) ? number : Number.parseFloat(fallback);
  const n = Number.isFinite(raw) ? raw : 42;
  const clamped = Math.min(OV1_COORD_MAX, Math.max(OV1_COORD_MIN, n));
  return `${roundCoord(clamped)}%`;
}

/**
 * Repair graphs saved under the old multi-viewport world (coords crammed into ~0–5%).
 * Expand them back to home-viewport 0–100 so the diagram fills the stage again.
 */
export function repairLegacyCompressedOv1Nodes(nodes = []) {
  if (!Array.isArray(nodes) || nodes.length < 2) return nodes;
  const xs = nodes.map((node) => Number.parseFloat(node?.x)).filter(Number.isFinite);
  const ys = nodes.map((node) => Number.parseFloat(node?.y)).filter(Number.isFinite);
  if (xs.length < 2 || ys.length < 2) return nodes;

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  // All nodes stuck in a tiny corner of the old free world.
  const compressed = maxX <= 8 && maxY <= 8 && spanX <= 6 && spanY <= 6;
  if (!compressed) return nodes;

  // Reverse of the old "viewport / 30" mapping, then soft-fit into the home screen.
  const factor = 30;
  return nodes.map((node) => {
    const x = Number.parseFloat(node.x);
    const y = Number.parseFloat(node.y);
    const nextX = Number.isFinite(x) ? Math.min(94, Math.max(4, x * factor)) : 42;
    const nextY = Number.isFinite(y) ? Math.min(92, Math.max(6, y * factor)) : 42;
    return {
      ...node,
      x: `${roundCoord(nextX)}%`,
      y: `${roundCoord(nextY)}%`
    };
  });
}

/** @deprecated kept for imports that expected a fixed multi-viewport world */
export const OV1_WORLD_SCALE = 1;
export const OV1_VIEWPORT_PCT = 100;
export const OV1_WORLD_MIN = OV1_COORD_MIN;
export const OV1_WORLD_MAX = OV1_COORD_MAX;

export function ov1WorldCssSize(nodes = []) {
  const bounds = computeOv1WorldBounds(nodes);
  return {
    widthPct: bounds.widthPct,
    heightPct: bounds.heightPct,
    scale: 1,
    bounds
  };
}

function roundCoord(n) {
  return Math.round(Number(n) * 100) / 100;
}
