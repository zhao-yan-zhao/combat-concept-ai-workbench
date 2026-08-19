import assert from "node:assert/strict";
import { hasSubflowToolbox, renderSubflowPage, renderSubflowToolboxFloatButton, subflowToolboxConfig, usesNativeToolbox } from "../design-studio/src/subflowToolbox.js";
import fs from "node:fs";

const expected = [
  "phase-action", "operational-task", "force-mission", "ov1", "concept-map",
  "ov1b", "ov1c", "ov4", "ov2", "ov3", "ov5a", "ov5", "ov6a", "ov6b", "ov6c", "ov7", "ooda", "scenario", "structure-review", "validate"
];
const signatures = new Set();
for (const viewId of expected) {
  assert.equal(hasSubflowToolbox(viewId), true, `${viewId} missing toolbox`);
  const config = subflowToolboxConfig(viewId);
  assert.ok(config?.ai?.[0], `${viewId} missing mandatory AI action`);
  if (!usesNativeToolbox(viewId)) {
    const closed = renderSubflowPage(viewId, "<section>page</section>", {});
    const openState = { subflowToolboxOpen: { [viewId]: true } };
    const open = renderSubflowPage(viewId, "<section>page</section>", openState);
    assert.match(renderSubflowToolboxFloatButton(viewId, {}), /is-topbar-float/);
    assert.doesNotMatch(closed, /subflow-edit-rail/);
    assert.match(open, /subflow-edit-rail/);
    assert.match(open, /is-attention/);
    assert.match(open, /toggle-subflow-toolbox/);
    assert.equal(renderSubflowToolboxFloatButton(viewId, openState), "", `${viewId} float must hide while rail is open`);
  }
  const signature = JSON.stringify(config.items);
  signatures.add(signature);
}
assert.equal(signatures.size, expected.length, "subflow tool sets must be content-specific");
assert.equal(hasSubflowToolbox("brief"), false, "brief is a mainline page, not an auxiliary subflow");
const mainSource = fs.readFileSync(new URL("../design-studio/src/main.js", import.meta.url), "utf8");
const floatHost = mainSource.slice(mainSource.indexOf("function renderOv1ToolboxFloatHost"), mainSource.indexOf("function resizeBriefTextareas"));
for (const nativeFloat of ["renderOv1ToolboxFloatButton", "renderOv4ToolboxFloatButton", "renderSequenceToolboxFloatButton", "renderStateMachineToolboxFloatButton"]) assert.match(floatHost, new RegExp(nativeFloat));
assert.match(floatHost, /renderSubflowToolboxFloatButton/);
for (const retiredAiFloat of ["renderPhaseActionChatFloatButton", "renderForceMissionChatFloatButton", "renderRuleLibraryChatFloatButton"]) assert.equal(floatHost.includes(retiredAiFloat), false, `${retiredAiFloat} must not duplicate the generic toolbox`);
const ov4Source = fs.readFileSync(new URL("../design-studio/src/ov4View.js", import.meta.url), "utf8");
assert.match(ov4Source, /open-subflow-ai[\s\S]*sparkle/, "native OV4 toolbox must include AI");
const styles = fs.readFileSync(new URL("../design-studio/styles.css", import.meta.url), "utf8");
assert.match(styles, /\.subflow-workbench-shell\.is-tools-open:has\(> \.subflow-edit-rail\)[^{]*\{[^}]*46px/s, "generic rail space must require a rendered rail and use a compact 46px track");
assert.match(styles, /\.ov4-workbench\.is-editor-open\s*\{[^}]*320px\) 0;/s, "OV4 editor without tools must release the rail column");
assert.match(styles, /\.sm-workbench\.is-tools-docked:has\(> \.sm-edit-rail\)/, "state-machine rail space must require a rendered rail");
assert.match(styles, /\.seq-workbench\.is-tools-docked:has\(> \.seq-edit-rail\)/, "sequence rail space must require a rendered rail");
console.log(`Subflow toolbox acceptance passed: ${expected.length} content-specific toolboxes, top-right floats, right-side rails, mandatory AI, and native toolbox reuse.`);
