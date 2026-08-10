const BANDS = {
  // Sensors and external actors share the left third of the graphic. They
  // must use one slot pool: separate bands can otherwise overlap when long
  // labels make the rendered cards taller than their logical coordinates.
  left: { xMin: 4, xMax: 28, yMin: 8, yMax: 78, anchorX: 28, anchorY: 43, maxRows: 3, maxColumns: 3 },
  command: { xMin: 38, xMax: 50, yMin: 12, yMax: 84, anchorX: 42, anchorY: 48, maxRows: 5, maxColumns: 2 },
  action: { xMin: 58, xMax: 76, yMin: 10, yMax: 88, anchorX: 58, anchorY: 48, maxRows: 5, maxColumns: 2 },
  effect: { xMin: 82, xMax: 88, yMin: 20, yMax: 80, anchorX: 82, anchorY: 48, maxRows: 5, maxColumns: 1 }
};

/**
 * Arrange an OV-1 in the home viewport. The most connected node in each
 * semantic band occupies its inner anchor, keeping cross-band links short.
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
    const band = BANDS[group] || BANDS.action;
    const slots = slotsForBand(band, entries.length);
    entries.sort((left, right) => (degree.get(right.node.id) || 0) - (degree.get(left.node.id) || 0) || left.index - right.index);
    entries.forEach(({ node }, index) => {
      const slot = slots[index] || slots[slots.length - 1];
      positions.set(node.id, { x: `${slot.x}%`, y: `${slot.y}%` });
    });
  });
  return nodes.map((node) => ({ ...node, ...(positions.get(node.id) || {}) }));
}

function layoutBandFor(node = {}) {
  if (node.kind === "effect") return "effect";
  if (node.kind === "external" || node.kind === "environment") return "left";
  if (node.kind === "command") return "command";
  if (node.kind === "equipment" || node.kind === "participant") return "left";
  return "action";
}

function slotsForBand(band, count) {
  const columns = Math.max(1, Math.min(band.maxColumns || count, Math.ceil(count / band.maxRows)));
  const rows = Math.max(1, Math.ceil(count / columns));
  const slots = [];
  for (let column = 0; column < columns; column += 1) {
    const x = columns === 1 ? band.anchorX : interpolate(band.xMin, band.xMax, column, columns);
    for (let row = 0; row < rows; row += 1) {
      const y = rows === 1 ? band.anchorY : interpolate(band.yMin, band.yMax, row, rows);
      slots.push({ x, y });
    }
  }
  return slots.sort((left, right) => distance(left, band) - distance(right, band) || left.x - right.x || left.y - right.y);
}

function interpolate(min, max, index, count) {
  return Math.round((min + ((max - min) * index) / Math.max(1, count - 1)) * 100) / 100;
}

function distance(slot, band) {
  return Math.abs(slot.x - band.anchorX) + Math.abs(slot.y - band.anchorY);
}
