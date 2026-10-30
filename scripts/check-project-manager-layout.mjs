import { renderProjectManager } from "../design-studio/src/projectManagerView.js";

const html = renderProjectManager({
  activeProjectId: "current-research",
  isLead: true,
  open: true,
  directory: { projects: [
    { id: "current-research", title: "\u5f53\u524d\u8fd0\u7b79\u6982\u5ff5\u7814\u7a76", archived: false },
    { id: "archived-research", title: "<unsafe-project>", archived: true }
  ] }
});

assert(html.includes("project-manager-row-main"), "Project rows lack the dedicated title and metadata region");
assert(html.includes("project-manager-row-meta"), "Project rows lack the compact metadata region");
assert(html.includes("project-manager-row-actions"), "Project rows lack the separate action region");
assert(html.includes("\u5f53\u524d\u9879\u76ee"), "Active-project status is not rendered");
assert(html.includes("\u5df2\u5f52\u6863") && html.includes("\u6062\u590d"), "Archived-project state or restore action is missing");
assert(html.includes("data-project-switch=\"archived-research\""), "Non-active project switch action is missing");
assert(html.includes("data-project-delete=\"archived-research\""), "Archived non-active project lacks the delete action");
assert(!html.includes("data-project-delete=\"current-research\""), "Current project should not be deletable from the project panel");
assert(!html.includes("data-project-archive=\"current-research\""), "Current active project should not be archivable from the project panel");
assert(html.includes("data-project-archive=\"archived-research\""), "Non-active archived project should have restore action");
assert(!html.includes("<unsafe-project>"), "Project title was inserted without HTML escaping");
console.log("Project-manager layout acceptance passed.");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
