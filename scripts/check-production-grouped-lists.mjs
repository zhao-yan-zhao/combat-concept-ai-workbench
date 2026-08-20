import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const moduleSource = await read("design-studio/src/groupedListTemplate.js");
const mainSource = await read("design-studio/src/main.js");
const css = await read("design-studio/styles.css");

assert.match(mainSource, /mountGroupedLists\(viewRoot\)/);
assert.match(moduleSource, /data-grouped-list-search/);
assert.match(moduleSource, /data-grouped-list-filter-field/);
assert.match(moduleSource, /filterMenu\.open = false/);
assert.match(moduleSource, /collapsedGroups/);
assert.match(moduleSource, /listPreferences/);
assert.match(css, /\.grouped-list-filter-popover\s*\{[^}]*position:\s*absolute/s);
assert.match(css, /\.grouped-list-filter-popover\s*\{[^}]*left:\s*10px;[^}]*right:\s*10px;[^}]*width:\s*auto/s);
assert.match(css, /\.grouped-list-tool-row\s*\{[^}]*minmax\(0, 1fr\) 78px/s);

const integrations = [
  ["design-studio/src/phaseActionView.js", "phase-action"],
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

const taskSource = await read("design-studio/src/operationalTaskView.js");
assert.ok(!taskSource.includes("operational-task-filters"), "The legacy fixed side filter must be removed from the task list");
const ov1bSource = await read("design-studio/src/ov1bView.js");
assert.ok(!ov1bSource.includes("ov1b-party-tabs"), "OV1b must expose all parent tasks to the shared list controls");
assert.ok(ov1bSource.includes("parents.map"), "OV1b must render the complete parent-task collection");
const forceSource = await read("design-studio/src/forceMissionView.js");
assert.ok(forceSource.includes("force-concept-columns is-grouped"), "Force lists must use one complete data column before grouping");

console.log("Production grouped-list checks passed for all workflow data lists");
