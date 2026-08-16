import { escapeHtml } from "../app/domUtils.js";

/**
 * Shared toolbox shell used by OV-1, state-machine, and future canvas steps.
 * Step pages only pass items + copy; they do not re-implement FAB / rail chrome.
 */

export const TOOLBOX_ICONS = Object.freeze({
  briefcase: `<path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/><path d="M4.5 9.5h15v9a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-9z"/><path d="M9.5 13h5"/>`,
  doc: `<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>`,
  refresh: `<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>`,
  download: `<path d="M12 3v11"/><path d="M8 10l4 4 4-4"/><path d="M5 19h14"/>`,
  restore: `<path d="M9 14l-4-4 4-4"/><path d="M5 10h8a6 6 0 1 1 0 12h-3"/>`,
  concept: `<path d="M4 5h16M4 12h10M4 19h14"/><path d="M16 10l3 3-3 3"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  sparkle: `<path d="M12 3l1.2 4.2L17.5 8.5l-4.3 1.3L12 14l-1.2-4.2L6.5 8.5l4.3-1.3L12 3z"/><path d="M18 14l.7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7L18 14z"/>`,
  check: `<path d="M5 12l5 5L20 7"/>`,
  close: `<path d="M6 6l12 12M18 6L6 18"/>`,
  relations: `<circle cx="6.5" cy="7" r="2.5"/><circle cx="17.5" cy="7" r="2.5"/><circle cx="12" cy="17" r="2.5"/><path d="M8.6 8.6l2.2 6M15.4 8.6l-2.2 6"/>`,
  layout: `<path d="M4 7h6V4H4v3zm10 0h6V4h-6v3zM4 20h6v-3H4v3zm10 0h6v-3h-6v3zM7 7v10M17 7v10"/>`,
  states: `<circle cx="6" cy="12" r="2.2"/><circle cx="18" cy="12" r="2.2"/><path d="M8.2 12h7.6"/>`,
  chat: `<path d="M5 7.5h14a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H10l-4 3v-3H5A1.5 1.5 0 0 1 3.5 16V9A1.5 1.5 0 0 1 5 7.5z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>`,
  state: `<rect x="5" y="7" width="14" height="10" rx="2"/><path d="M12 10v4M10 12h4"/>`,
  decision: `<path d="M12 4.5 19.5 12 12 19.5 4.5 12z"/>`,
  transition: `<path d="M5 12h12"/><path d="M13 7l5 5-5 5"/>`,
  trash: `<path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M8 7l.7 12h6.6L16 7"/>`
});

export function renderToolboxIcon(nameOrSvg, { size = 18 } = {}) {
  const raw = String(nameOrSvg || "").trim();
  if (!raw) return "";
  if (raw.includes("<")) return raw;
  const paths = TOOLBOX_ICONS[raw];
  if (!paths) return "";
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

/** Topbar floating FAB or docked brand toggle. Visual language is the OV-1 toolbox. */
export function renderToolboxFloatButton({
  scope = "ov1",
  open = false,
  action = "toggle-ov1-tools",
  className = "ov1-edit-rail-brand is-topbar-float",
  titleOpen = "收起工具箱",
  titleClosed = "展开工具箱",
  disabled = false,
  icon = "briefcase"
} = {}) {
  const title = open ? titleOpen : titleClosed;
  return `
    <button class="${joinClasses("ov1-edit-rail-brand", className)}" type="button" data-action="${escapeHtml(action)}" data-toolbox-scope="${escapeHtml(scope)}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" aria-expanded="${open ? "true" : "false"}"${disabled ? " disabled" : ""}>
      <span class="ov1-edit-rail-brand-ring" aria-hidden="true"></span>
      <span class="ov1-edit-rail-brand-glow" aria-hidden="true"></span>
      <span class="ov1-edit-ico" aria-hidden="true">
        ${renderToolboxIcon(icon)}
      </span>
    </button>
  `;
}

export function renderToolboxSep() {
  return `<span class="ov1-edit-rail-sep" aria-hidden="true"></span>`;
}

export function renderToolboxEntry({
  action = "",
  title = "",
  label = "",
  icon = "",
  active = false,
  attention = false,
  disabled = false,
  expanded,
  pressed,
  controls = "",
  className = "",
  attrs = {},
  tabindex
} = {}) {
  const ariaLabel = label || title;
  const extra = renderAttrs(attrs);
  const expandedAttr = typeof expanded === "boolean" ? ` aria-expanded="${expanded ? "true" : "false"}"` : "";
  const pressedAttr = typeof pressed === "boolean" ? ` aria-pressed="${pressed ? "true" : "false"}"` : "";
  const controlsAttr = controls ? ` aria-controls="${escapeHtml(controls)}"` : "";
  const tabindexAttr = tabindex === undefined ? "" : ` tabindex="${escapeHtml(String(tabindex))}"`;
  const actionAttr = action ? ` data-action="${escapeHtml(action)}"` : "";
  return `<button class="${joinClasses("ov1-edit-entry", active && "is-active", attention && "is-attention", className)}" type="button"${actionAttr} title="${escapeHtml(title)}" aria-label="${escapeHtml(ariaLabel)}"${expandedAttr}${pressedAttr}${controlsAttr}${tabindexAttr}${extra}${disabled ? " disabled" : ""}>
          <span class="ov1-edit-ico" aria-hidden="true">
            ${renderToolboxIcon(icon)}
          </span>
        </button>`;
}

/** Docked far-right icon rail. Closed state is the topbar FAB, not an empty rail. */
export function renderToolboxRail({
  scope = "ov1",
  open = true,
  label = "图面编辑栏",
  navLabel = "图面操作入口",
  className = "ov1-edit-rail",
  navClassName = "",
  toggleAction = "toggle-ov1-tools",
  toggleClassName = "ov1-edit-rail-brand",
  items = []
} = {}) {
  if (!open) return "";
  const body = items
    .filter((item) => item)
    .map((item) => {
      if (item === "sep" || item?.type === "sep") return renderToolboxSep();
      if (typeof item === "string") return item;
      return renderToolboxEntry(item);
    })
    .join("");
  return `
    <aside class="${joinClasses(className, "is-docked")}" data-toolbox-scope="${escapeHtml(scope)}" aria-label="${escapeHtml(label)}">
      ${renderToolboxFloatButton({
        scope,
        open: true,
        action: toggleAction,
        className: toggleClassName
      })}
      <nav class="${joinClasses("ov1-edit-rail-nav", navClassName)}" aria-label="${escapeHtml(navLabel)}" aria-hidden="false">
        ${body}
      </nav>
    </aside>
  `;
}

function renderAttrs(attrs = {}) {
  return Object.entries(attrs)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => {
      if (value === true) return ` ${escapeHtml(key)}`;
      return ` ${escapeHtml(key)}="${escapeHtml(String(value))}"`;
    })
    .join("");
}

function joinClasses(...parts) {
  return [...new Set(parts.flatMap((part) => String(part || "").split(/\s+/)).filter(Boolean))].join(" ");
}
