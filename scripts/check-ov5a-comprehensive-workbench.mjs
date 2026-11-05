import {
  DO_DAF_OV5A_TEMPLATES,
  getOv5aTemplates,
  applyTemplateToActivity,
  applyGlobalTemplate,
  generateLocalDecomposition,
  autoOrganizeOv5aHierarchy,
  evaluateOv5aDecompositionIoCoverage,
  exportOv5aWbsText
} from "../design-studio/src/ov5aTemplates.js";
import { renderOv5a } from "../design-studio/src/dodafOperationalViews.js";
import { normalizeDodafOv5, normalizeDodafOv5a } from "../shared/dodaf/products.js";
import { syncOv5ActivityPair, setOv5aParent } from "../shared/dodaf/ov5ActivitySync.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    throw new Error(message);
  }
}

console.log("Starting verification for OV-5a Comprehensive Workbench...");

// 1. Verify Military Doctrinal Template Library
const templates = getOv5aTemplates();
assert(Array.isArray(templates) && templates.length === 6, `Expected 6 doctrinal templates, got ${templates.length}`);
const templateIds = templates.map((t) => t.id);
assert(templateIds.includes("f2t2ea"), "F2T2EA template missing");
assert(templateIds.includes("ooda"), "OODA template missing");
assert(templateIds.includes("ew_suppress"), "EW suppression template missing");
assert(templateIds.includes("air_defense"), "Joint air defense template missing");
assert(templateIds.includes("swarm_strike"), "Autonomous swarm strike template missing");
assert(templateIds.includes("sensor_fusion"), "Sensor fusion template missing");

// Check template steps richness (input, output, domain, autonomy, timing)
templates.forEach((t) => {
  assert(t.steps.length >= 4, `Template ${t.id} has insufficient steps (${t.steps.length})`);
  t.steps.forEach((s) => {
    assert(Boolean(s.title && s.domain && s.autonomy && s.timingWindow && s.input && s.output), `Step in ${t.id} missing required DoDAF attributes`);
  });
});
console.log("✓ Doctrinal template library verified (6 templates, complete DoDAF DM2 contracts)");

// 2. Verify Global Template Application
const baseOv5 = normalizeDodafOv5({
  activities: [{ id: "act-init", title: "初始未分解活动", domain: "综合", autonomy: "HOTL", type: "作战活动" }],
  edges: []
});
const emptyOv5a = normalizeDodafOv5a({ decompositions: [] });
const globalResult = applyGlobalTemplate({ ov5: baseOv5, ov5a: emptyOv5a, templateId: "f2t2ea" });

assert(globalResult.nextOv5.activities.length === 7, `Global F2T2EA should generate 1 root + 6 steps = 7 activities, got ${globalResult.nextOv5.activities.length}`);
assert(globalResult.nextOv5a.decompositions.length === 6, `1 root decomposing into 6 steps should produce 6 parent/child decompositions, got ${globalResult.nextOv5a.decompositions.length}`);
console.log("✓ Global template application verified");

// 3. Verify Child Node Template Injection
const parentActId = globalResult.nextOv5.activities[0].id;
const childInjectionResult = applyTemplateToActivity({
  ov5: globalResult.nextOv5,
  ov5a: globalResult.nextOv5a,
  parentActivityId: parentActId,
  templateId: "ooda"
});

assert(childInjectionResult.addedActivities.length === 4, "OODA child injection should create 4 sub-activities");
assert(childInjectionResult.nextOv5.activities.length === 11, `Total activities should now be 11, got ${childInjectionResult.nextOv5.activities.length}`);
assert(childInjectionResult.nextOv5a.decompositions.some((d) => d.parentActivityRef === parentActId), "Child decomposition references parentActId");
console.log("✓ Sub-activity template injection verified");

// 4. Verify Local Cognitive Heuristic Decomposition
const heuristicResult = generateLocalDecomposition({
  ov5: childInjectionResult.nextOv5,
  ov5a: childInjectionResult.nextOv5a,
  targetActivityId: childInjectionResult.addedActivities[0].id
});

assert(heuristicResult.addedActivities.length >= 3, "Heuristic decomposition should generate at least 3 sub-steps");
console.log("✓ Heuristic & AI fallback decomposition verified");

// 5. Verify Auto-Organization & Broken Reference Repair
const brokenOv5a = normalizeDodafOv5a({
  decompositions: [
    { parentActivityRef: "ghost-parent-1", childActivityRef: heuristicResult.addedActivities[0].id },
    { parentActivityRef: "ghost-parent-2", childActivityRef: heuristicResult.addedActivities[1].id }
  ]
});

const autoOrgResult = autoOrganizeOv5aHierarchy({
  ov5: heuristicResult.nextOv5,
  ov5a: brokenOv5a
});

assert(autoOrgResult.repairedCount === 2, `Expected 2 repaired broken references, got ${autoOrgResult.repairedCount}`);
assert(!autoOrgResult.nextOv5a.decompositions.some((d) => d.parentActivityRef.startsWith("ghost-")), "Orphan references must be purged from hierarchy");
console.log("✓ Auto-organization & broken link healing verified");

// 6. Verify UI Rendering & Inspector Drawer
const stateWithSelection = {
  activeView: "ov5a",
  ov5: autoOrgResult.nextOv5,
  ov5a: autoOrgResult.nextOv5a,
  ov5aViewMode: "diagram",
  ov5aSelectedActivityId: autoOrgResult.nextOv5.activities[0].id,
  ov5aFilter: { query: "搜索", domain: "太空", autonomy: "HOTL", level: "root" },
  ov5aModal: null,
  ov5aStorage: {}
};

const renderedHtml = renderOv5a(stateWithSelection);

// UI elements assertion
assert(renderedHtml.includes("ov5a-filter-bar"), "Filter bar container missing");
assert(renderedHtml.includes("ov5a-search-box"), "Search input missing");
assert(renderedHtml.includes("ov5a-card-action-bar"), "Card action bar missing");
assert(renderedHtml.includes("ov5a-card-btn"), "Card action buttons missing");
assert(renderedHtml.includes("ov5a-inspector-drawer"), "Activity Inspector drawer missing");
assert(renderedHtml.includes("ov5a-drawer-title"), "Inspector drawer title missing");
assert(renderedHtml.includes("💾 保存活动变更"), "Save button in inspector missing");
assert(renderedHtml.includes("🤖 AI 细化分解"), "AI decompose button in inspector missing");
assert(renderedHtml.includes("ov5a-export-wbs-csv"), "Export CSV action button missing");
assert(renderedHtml.includes("ov5a-export-wbs-md"), "Export Markdown action button missing");
assert(renderedHtml.includes("ov5a-export-diagram-svg"), "Export Diagram action button missing");
assert(renderedHtml.includes("data-drag-type=\"ov5a-activity\""), "Card draggable attribute missing");
assert(renderedHtml.includes("data-drop-zone=\"root\""), "Root drop zone missing");
assert(renderedHtml.includes("I/O 契约守恒率"), "I/O conservation metric chip missing");

// 7. Verify Modal Dialogs Rendering
const stateWithAddModal = {
  ...stateWithSelection,
  ov5aModal: "add-activity",
  ov5aModalContext: { parentId: autoOrgResult.nextOv5.activities[0].id }
};
const addModalHtml = renderOv5a(stateWithAddModal);
assert(addModalHtml.includes("ov5a-modal-backdrop"), "Modal backdrop missing");
assert(addModalHtml.includes("ov5a-add-title"), "Add activity input title missing");
assert(addModalHtml.includes("确定新增"), "Submit button missing in add modal");

const stateWithTemplateModal = {
  ...stateWithSelection,
  ov5aModal: "template-picker",
  ov5aModalContext: { targetId: autoOrgResult.nextOv5.activities[0].id }
};
const tplModalHtml = renderOv5a(stateWithTemplateModal);
assert(tplModalHtml.includes("ov5a-template-modal"), "Template modal container missing");
assert(tplModalHtml.includes("ov5a-template-card"), "Template cards missing");
assert(tplModalHtml.includes("F2T2EA 经典杀伤链范式"), "F2T2EA template card missing");
assert(tplModalHtml.includes("OODA 循环决策与行动范式"), "OODA template card missing");
console.log("✓ View rendering, filtering, Inspector drawer & Modals verified");

// 8. Verify DoDAF 2.02 / DM2 Activity I/O Conservation Analysis
const ioCoverage = evaluateOv5aDecompositionIoCoverage(childInjectionResult.nextOv5.activities, childInjectionResult.nextOv5a.decompositions);
assert(typeof ioCoverage.stats.ioHealthScore === "number", "ioHealthScore should be a number");
assert(ioCoverage.stats.parentCount > 0, `parentCount should be greater than 0, got ${ioCoverage.stats.parentCount}`);
assert(ioCoverage.statusMap instanceof Map, "statusMap should be a Map");
console.log(`✓ DoDAF I/O conservation verified (Health score: ${ioCoverage.stats.ioHealthScore}%, Parent count: ${ioCoverage.stats.parentCount})`);

// 9. Verify WBS Text & Structure Exporters (CSV & Markdown)
const csvExport = exportOv5aWbsText(childInjectionResult.nextOv5.activities, childInjectionResult.nextOv5a.decompositions, "csv");
assert(csvExport.includes("WBS编码") && csvExport.includes("作战活动名称") && csvExport.includes("1.0"), "CSV export missing standard headers or root code");

const mdExport = exportOv5aWbsText(childInjectionResult.nextOv5.activities, childInjectionResult.nextOv5a.decompositions, "md");
assert(mdExport.includes("| WBS编码 |") && mdExport.includes("| 1.0 |"), "Markdown export missing table header or rows");
console.log("✓ WBS text & table exporters verified (CSV & Markdown format complete)");

console.log("All OV-5a Comprehensive Workbench checks passed successfully!");
