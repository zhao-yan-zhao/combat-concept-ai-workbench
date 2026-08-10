/**
 * HTML render helpers for the industrial DoDAF drafting component library.
 */
import {
  edgeCssClass,
  edgeInlineStyle,
  entityCssClass,
  entityInlineStyle,
  getProductLegendSpec,
  resolveEdgeStyle,
  resolveEntityStyle
} from "../../shared/dodaf/drafting.js";

export function renderDodafLegend(product, { compact = false } = {}) {
  const spec = getProductLegendSpec(product);
  if (!spec.entities.length && !spec.edges.length) return "";
  const entityItems = spec.entities.map((item) => `
    <span class="dodaf-legend-item" title="${escapeHtml(item.label)}">
      <i class="dodaf-legend-swatch ${entityCssClass(item)}" style="${entityInlineStyle(item)}" aria-hidden="true">${escapeHtml(item.icon || "■")}</i>
      <em>${escapeHtml(item.label)}</em>
    </span>`).join("");
  const edgeItems = spec.edges.map((item) => `
    <span class="dodaf-legend-item dodaf-legend-edge" title="${escapeHtml(item.label)}">
      <i class="dodaf-legend-line ${edgeCssClass(item)}" style="border-color:${escapeHtml(item.color)};${item.dash ? `border-style:dashed;` : ""}" aria-hidden="true"></i>
      <em>${escapeHtml(item.label)}</em>
    </span>`).join("");
  return `<aside class="dodaf-legend ${compact ? "is-compact" : "is-panel"}" data-dodaf-legend="${escapeHtml(product)}" aria-label="${escapeHtml(product)} 制图图例">
    <div class="dodaf-legend-head">
      <strong>图例</strong>
      <span title="DoDAF 2.02 / DM2">${escapeHtml(product)} · DM2</span>
    </div>
    <div class="dodaf-legend-body">
      ${entityItems ? `<div class="dodaf-legend-group"><b>节点</b><div class="dodaf-legend-row">${entityItems}</div></div>` : ""}
      ${edgeItems ? `<div class="dodaf-legend-group"><b>关系</b><div class="dodaf-legend-row">${edgeItems}</div></div>` : ""}
    </div>
  </aside>`;
}

export function renderEntityBadge({ dm2Type, kind, type, label } = {}) {
  const style = resolveEntityStyle({ dm2Type, kind, type });
  return `<span class="dodaf-entity-badge ${entityCssClass(style)}" style="${entityInlineStyle(style)}" title="${escapeHtml(style.label)}">
    <i aria-hidden="true">${escapeHtml(style.icon || "■")}</i>
    <em>${escapeHtml(label || style.label)}</em>
  </span>`;
}

export function renderEntityChip({ id, name, dm2Type, kind, type, detail } = {}) {
  const style = resolveEntityStyle({ dm2Type, kind, type });
  return `<article class="dodaf-entity-chip ${entityCssClass(style)}" style="${entityInlineStyle(style)}" data-dodaf-entity="${escapeHtml(id || "")}">
    <header><i aria-hidden="true">${escapeHtml(style.icon || "■")}</i><strong>${escapeHtml(name || id || "实体")}</strong><small>${escapeHtml(style.label)}</small></header>
    ${detail ? `<p>${escapeHtml(detail)}</p>` : ""}
  </article>`;
}

export function renderEdgeBadge(typeOrDm2, label) {
  const style = resolveEdgeStyle(typeOrDm2);
  return `<span class="dodaf-edge-badge ${edgeCssClass(style)}" style="--dodaf-edge-color:${escapeHtml(style.color)}" title="${escapeHtml(style.label)}">
    <i aria-hidden="true"></i><em>${escapeHtml(label || style.label)}</em>
  </span>`;
}

export function entityStyleAttrs({ dm2Type, kind, type } = {}) {
  const style = resolveEntityStyle({ dm2Type, kind, type });
  return {
    style,
    className: entityCssClass(style),
    inline: entityInlineStyle(style),
    icon: style.icon || "■",
    label: style.label
  };
}

export function edgeStyleAttrs(typeOrDm2) {
  const style = resolveEdgeStyle(typeOrDm2);
  return {
    style,
    className: edgeCssClass(style),
    inline: edgeInlineStyle(style),
    color: style.color,
    dash: style.dash || "",
    width: style.width || 1.8,
    label: style.label
  };
}

/** SVG marker defs for industrial edge arrows (one set per product canvas). */
export function renderEdgeMarkerDefs(prefix = "dodaf") {
  const markers = [
    ["info", "#187a57"],
    ["control", "#2d604a"],
    ["sit", "#2a72a8"],
    ["fb", "#ad7a19"],
    ["res", "#6b5b95"],
    ["need", "#5c4d8a"],
    ["rel", "#294f63"],
    ["resp", "#287a73"],
    ["part", "#2f6f9f"],
    ["trans", "#2a72a8"],
    ["coord", "#3c7ca9"]
  ];
  return markers.map(([id, color]) => `
    <marker id="${prefix}-arrow-${id}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/>
    </marker>`).join("");
}

export function edgeMarkerUrl(typeOrDm2, prefix = "dodaf") {
  const style = resolveEdgeStyle(typeOrDm2);
  return `url(#${prefix}-arrow-${style.marker || "rel"})`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
