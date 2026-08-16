/**
 * Acceptance: shared toolbox shell (OV-1 visual language).
 * Run: node scripts/check-toolbox-shell.mjs
 */
import {
  renderToolboxEntry,
  renderToolboxFloatButton,
  renderToolboxRail,
  renderToolboxSep
} from "../design-studio/src/toolbox/index.js";
import { renderOv1ToolboxFloatButton } from "../design-studio/src/ov1View.js";
import { renderStateMachineToolboxFloatButton } from "../design-studio/src/stateMachineView.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const fab = renderToolboxFloatButton({
  scope: "demo",
  open: false,
  action: "toggle-demo-tools"
});
assert(fab.includes("ov1-edit-rail-brand"), "FAB must reuse OV-1 brand chrome");
assert(fab.includes('data-toolbox-scope="demo"'), "FAB must stamp toolbox scope");
assert(fab.includes('data-action="toggle-demo-tools"'), "FAB action missing");
assert(fab.includes("展开工具箱") && fab.includes('aria-expanded="false"'), "Closed FAB title/expanded");

const openFab = renderToolboxFloatButton({
  scope: "demo",
  open: true,
  action: "toggle-demo-tools",
  className: "ov1-edit-rail-brand"
});
assert(openFab.includes("收起工具箱") && openFab.includes('aria-expanded="true"'), "Open FAB title/expanded");
assert(!openFab.includes("is-topbar-float"), "Docked brand should not keep the topbar float class by default");

const entry = renderToolboxEntry({
  action: "demo-add",
  title: "新增",
  icon: "plus",
  active: true,
  attrs: { "data-kind": "normal" }
});
assert(entry.includes("ov1-edit-entry is-active"), "Active entry class");
assert(entry.includes('data-action="demo-add"') && entry.includes('data-kind="normal"'), "Entry action/attrs");
assert(entry.includes("<svg"), "Named icon should render SVG");
assert(renderToolboxSep().includes("ov1-edit-rail-sep"), "Separator chrome");

const closed = renderToolboxRail({ open: false, items: [{ action: "x", title: "x", icon: "plus" }] });
assert(closed === "", "Closed rail must render nothing (topbar FAB owns the closed state)");

const rail = renderToolboxRail({
  scope: "demo",
  open: true,
  label: "演示工具箱",
  toggleAction: "toggle-demo-tools",
  className: "demo-edit-rail",
  items: [
    { action: "demo-panel", title: "面板", icon: "doc", active: true, expanded: true, controls: "demoPanel" },
    "sep",
    { action: "demo-add", title: "新增", icon: "plus", disabled: true }
  ]
});
assert(rail.includes("demo-edit-rail is-docked") && rail.includes("ov1-edit-rail-nav"), "Rail chrome");
assert(rail.includes('data-toolbox-scope="demo"'), "Rail scope");
assert(rail.includes("toggle-demo-tools") && rail.includes("demo-panel") && rail.includes("demo-add"), "Rail items");
assert(rail.includes("ov1-edit-rail-sep") && rail.includes("disabled"), "Rail sep / disabled item");
assert(rail.includes('aria-controls="demoPanel"') && rail.includes('aria-expanded="true"'), "Panel toggle attrs");

const ov1Fab = renderOv1ToolboxFloatButton();
assert(ov1Fab.includes("toggle-ov1-tools") && ov1Fab.includes('data-toolbox-scope="ov1"'), "OV-1 FAB must use shared toolbox");

const smFab = renderStateMachineToolboxFloatButton({ toolsOpen: false });
assert(smFab.includes("toggle-ov6b-tools") && smFab.includes("sm-toolbox-float") && smFab.includes('data-toolbox-scope="ov6b"'), "State-machine FAB must use shared toolbox");

console.log("Toolbox shell acceptance passed.");
