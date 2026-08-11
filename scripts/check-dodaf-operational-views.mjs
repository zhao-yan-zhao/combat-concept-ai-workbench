import { buildOv5aModel, buildOv6aModel, buildOv6bModel } from "../design-studio/src/dodafOperationalBuilders.js";
import { renderOv5a, renderOv6a, renderOv6b } from "../design-studio/src/dodafOperationalViews.js";
import { getDerivedViewProvenance, listDerivedViewProvenance, renderDerivedViewProvenance } from "../design-studio/src/derivedViewProvenance.js";
import { inspectDerivedOperationalViews } from "../design-studio/src/validationStore.js";

const ov5 = { activities: [
  { id: "parent", title: "Concept activity", type: "coordination", preconditions: "Public evidence is reviewed.", constraints: "Research boundary is retained." },
  { id: "child", title: "Supporting activity", parentId: "parent", type: "analysis", preconditions: "Input is available.", constraints: "No operational instructions." }
], edges: [{ id: "edge-1", sourceId: "parent", targetId: "child", condition: "Review is complete." }] };
const ooda = { lanes: [{ title: "Observe", subtitle: "Observe", nodes: [{ id: "o1", title: "Collect", rule: "Evidence is public." }, { id: "o2", title: "Check", rule: "Sources are traceable." }] }, { title: "Decide", subtitle: "Decide", nodes: [{ id: "d1", title: "Review", rule: "Human confirmation." }] }] };
const ov5a = buildOv5aModel({ ov5 });
const ov6a = buildOv6aModel({ ov5 });
const ov6b = buildOv6bModel({ ooda });
assert(ov5a.tree[0].children[0].id === "child", "OV-5a did not retain the activity hierarchy");
assert(ov6a.rules.length === 5, "OV-6a did not derive activity and edge rules");
assert(ov6b.states.length === 3 && ov6b.transitions.length === 2, "OV-6b did not derive OODA state transitions");
const ov5aHtml = renderOv5a(ov5a);
const ov6aHtml = renderOv6a(ov6a);
const ov6bHtml = renderOv6b(ov6b);
assert(ov5aHtml.includes("OV-5a") && ov6aHtml.includes('data-dodaf-product="OV-6a"') && ov6bHtml.includes("OV-6b"), "DoDAF operational views did not render");
assert(ov5aHtml.includes('data-derived-provenance="ov5a"') && ov5aHtml.includes("parentId"), "OV-5a provenance strip missing source fields");
assert(ov6aHtml.includes("rule-library-page") && ov6aHtml.includes("规则库") && ov6aHtml.includes("rule-form"), "OV-6a rule library form page missing");
assert(ov6bHtml.includes('data-derived-provenance="ov6b"') && ov6bHtml.includes('data-view="ooda"'), "OV-6b provenance strip missing OODA jump");
assert(getDerivedViewProvenance("ov2")?.sources?.length && listDerivedViewProvenance().length >= 8, "DoDAF product provenance catalog incomplete");
assert(renderDerivedViewProvenance("ov3").includes('data-view="ov5"') && renderDerivedViewProvenance("ov3").includes("Needline") === false, "OV-3 provenance should point back to OV-5b");
assert(renderDerivedViewProvenance("ov2").includes("Needline") && renderDerivedViewProvenance("ov2").includes("sourceOv1NodeIds"), "OV-2 provenance should explain Needline projection");
assert(renderDerivedViewProvenance("ov2").includes("可编辑") || getDerivedViewProvenance("ov2")?.workbench?.includes("可编辑"), "OV-2 provenance should describe editable persistence");
const derivedDiagnostics = inspectDerivedOperationalViews(ov5, ooda);
assert(derivedDiagnostics.issues.length === 0, "Complete operational views produced unnecessary diagnostics");
const emptyDerivedDiagnostics = inspectDerivedOperationalViews({ activities: [], edges: [] }, { lanes: [] });
assert(emptyDerivedDiagnostics.issues.some((issue) => issue.title.includes("OV-6a")) && emptyDerivedDiagnostics.issues.some((issue) => issue.title.includes("OV-6b")), "Missing product seed source data was not surfaced to validation");
console.log("DoDAF operational views acceptance passed: OV-5a hierarchy, OV-6a rules, OV-6b transitions, and editable product provenance strips.");
function assert(condition, message) { if (!condition) throw new Error(message); }
