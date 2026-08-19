import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../design-studio/grouped-list-test.html", import.meta.url), "utf8");
const css = await readFile(new URL("../design-studio/grouped-list-test.css", import.meta.url), "utf8");
const js = await readFile(new URL("../design-studio/grouped-list-test.js", import.meta.url), "utf8");

assert.match(html, /id="sampleSelect"/);
assert.match(html, /id="groupSelect"/);
assert.match(html, /id="filterFieldSelect"/);
assert.match(html, /id="filterValueSelect"/);
assert.match(html, /class="filter-menu"/);
assert.match(html, /class="master-tools"/);
assert.match(html, /id="activeFilterSummary"/);
assert.match(html, /id="groupedList"/);
assert.match(css, /grid-template-columns:\s*minmax\(260px, 310px\)\s+minmax\(0, 1fr\)/);
assert.match(css, /\.list-group\.is-collapsed \.group-items/);
assert.match(css, /\.filter-popover\s*\{[^}]*position:\s*absolute/s);
for (const id of ["phase-action", "operational-task", "force-mission", "ov1b", "ov2", "ov4", "ov6b", "ov6c"]) {
  assert(js.includes(`sample("${id}"`), `Missing grouped-list compatibility sample: ${id}`);
}
assert.match(js, /viewState\.filterField/);
assert.match(js, /viewState\.collapsedGroups/);

console.log("Grouped-list test page checks passed");
