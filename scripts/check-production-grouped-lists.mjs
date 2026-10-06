import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const moduleSource = await read("design-studio/src/groupedListTemplate.js");
const mainSource = await read("design-studio/src/main.js");
const dodafControllerSource = await read("design-studio/src/dodafProductController.js");
const aiPromptControllerSource = await read("design-studio/src/aiPromptController.js");
const css = await read("design-studio/styles.css");

assert.match(mainSource, /mountGroupedLists\(viewRoot\)/);
for (const selector of [".ai-prompt-list", ".grouped-list-items"]) {
  assert.ok(mainSource.includes(`"${selector}"`), `${selector} must preserve scroll across selection renders`);
}
assert.match(mainSource, /const appScrollSnapshots = captureViewScroll\(document\)/);
assert.match(mainSource, /restoreViewScroll\(document, appScrollSnapshots\)/);
assert.match(dodafControllerSource, /state\.ov1bSelectedGroupId === groupId/);
assert.match(dodafControllerSource, /state\.ov4SelectedDiagramId === diagramId/);
assert.match(dodafControllerSource, /state\.ov6cSelectedSequenceId === ds\.sequenceId/);
assert.match(aiPromptControllerSource, /state\.aiPromptSelectedId === promptId/);
assert.ok(aiPromptControllerSource.includes("ai-prompt-item.is-active"), "AI prompt selection must keep the selected item visible");
assert.match(moduleSource, /data-grouped-list-search/);
assert.match(moduleSource, /panel\.classList\.add\("grouped-list-panel"\)/);
assert.match(moduleSource, /list\.classList\.add\("grouped-list-items"\)/);
assert.match(moduleSource, /\.is-selected, \.is-active, \.is-focused, \[aria-selected='true'\]/);
assert.match(moduleSource, /data-grouped-list-filter-field/);
assert.match(moduleSource, /filterMenu\.open = false/);
assert.match(moduleSource, /collapsedGroups/);
assert.match(moduleSource, /listPreferences/);
assert.match(css, /\.grouped-list-filter-popover\s*\{[^}]*position:\s*absolute/s);
assert.match(css, /\.grouped-list-filter-popover\s*\{[^}]*left:\s*10px;[^}]*right:\s*10px;[^}]*width:\s*auto/s);
assert.match(css, /\.grouped-list-tool-row\s*\{[^}]*minmax\(0, 1fr\) 78px/s);
assert.match(css, /\.grouped-list-panel\s*\{[^}]*display:\s*flex;[^}]*overflow:\s*hidden/);
assert.match(css, /\.grouped-list-panel > \.grouped-list-items\s*\{[^}]*flex:\s*1 1 auto;[^}]*overflow-y:\s*auto/);
assert.match(css, /\.grouped-list-panel > \.grouped-list-items\s*\{[^}]*padding-bottom:\s*10px;[^}]*scroll-padding-block:\s*8px/);
assert.match(css, /\.studio-workspace:has\(\.ov1b-workbench\)[^{]*\{[^}]*overflow:\s*hidden/);
assert.match(css, /\.ov1b-page\s*\{[^}]*min-height:\s*0;[^}]*height:\s*100%/s);
assert.match(css, /\.ov1b-layout\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0/);

const integrations = [
  ["design-studio/src/operationalTaskView.js", "operational-task"],
  ["design-studio/src/forceMissionView.js", "force-concept"],
  ["design-studio/src/forceMissionView.js", "force-combat"],
  ["design-studio/src/ov1bView.js", "ov1b"],
  ["design-studio/src/ov2View.js", "ov2"],
  ["design-studio/src/ov4View.js", "ov4"],
  ["design-studio/src/stateMachineView.js", "ov6b"],
  ["design-studio/src/ov6cView.js", "ov6c"]
];

for (const [path, scope] of integrations) {
  const source = await read(path);
  assert.ok(source.includes(`data-grouped-list-panel=\"${scope}\"`), `${scope} must declare a grouped-list panel`);
  assert.ok(source.includes("data-grouped-list-items"), `${scope} must declare a list container`);
  assert.ok(source.includes("data-grouped-list-item"), `${scope} must expose item metadata`);
}

const phaseSource = await read("design-studio/src/phaseActionView.js");
assert.ok(!phaseSource.includes("data-grouped-list-panel"), "Phase-action must not include grouped-list panel or search/group controls");

const taskSource = await read("design-studio/src/operationalTaskView.js");
assert.ok(!taskSource.includes("operational-task-filters"), "The legacy fixed side filter must be removed from the task list");
const ov1bSource = await read("design-studio/src/ov1bView.js");
assert.ok(!ov1bSource.includes("ov1b-party-tabs"), "OV1b must expose all task groups to the shared list controls");
assert.ok(ov1bSource.includes("groups.map"), "OV1b must render the complete task-group collection");
const forceSource = await read("design-studio/src/forceMissionView.js");
assert.ok(forceSource.includes("force-concept-columns is-grouped"), "Force lists must use one complete data column before grouping");
assert.ok(forceSource.includes("force-mission-workbench") && forceSource.includes("force-mission-left") && forceSource.includes("force-mission-rail"), "Force-mission must keep generate/confirm actions in a left column beside the list");
assert.match(css, /\.force-mission-left\s*\{[^}]*flex:\s*0 0 220px/s);
assert.match(css, /\.force-mission-rail-actions\s*\{[^}]*flex:\s*0 0 auto/s);
assert.match(css, /\.force-mission-workbench\s*\{[^}]*overflow:\s*hidden/s);
assert.match(css, /\.force-mission-main-stage\s*\{[^}]*overflow:\s*hidden/s);
assert.match(css, /\.force-roster-list\s*\{[^}]*max-height:\s*none/s);

console.log("Production grouped-list checks passed for all workflow data lists");
