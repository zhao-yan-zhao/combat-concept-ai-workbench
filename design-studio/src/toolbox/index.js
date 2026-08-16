/**
 * Shared toolbox shell (OV-1 visual language).
 *
 * New canvas steps should:
 * 1. renderToolboxFloatButton for the topbar FAB
 * 2. renderToolboxRail({ items }) for the docked icon rail
 * 3. pass named TOOLBOX_ICONS keys, not inline SVG
 *
 * Do not re-implement the brand FAB, rail chrome, or icon-button markup.
 */
export {
  TOOLBOX_ICONS,
  renderToolboxEntry,
  renderToolboxFloatButton,
  renderToolboxIcon,
  renderToolboxRail,
  renderToolboxSep
} from "./toolboxView.js";
