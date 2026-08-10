import { renderTree } from "../design-studio/src/ui.js";
import { views, workflowTracks } from "../design-studio/src/data.js";
import { currentWorkflow, getWorkflowStageIncompleteReasons, nextWorkflowStage, renderWorkflowGate } from "../design-studio/src/app/workflowGate.js";
import { readFile } from "node:fs/promises";

const indexHtml = await readFile(new URL("../design-studio/index.html", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../design-studio/src/main.js", import.meta.url), "utf8");
const controllerSource = await readFile(new URL("../design-studio/src/app/wireControllers.js", import.meta.url), "utf8");

const gated = renderTree("brief", { completedThrough: -1, mode: "gated" });
const test = renderTree("brief", { completedThrough: -1, mode: "free" });
const onOv5 = renderTree("ov5", { completedThrough: 4, mode: "free" });

assert(gated.includes("disabled") && gated.includes("locked"), "Gated workflow did not keep later stages locked");
assert(!test.includes("disabled") && !test.includes("locked"), "Test mode still locked one or more modules");
assert(nextWorkflowStage({ completedThrough: -1 }) === 0, "Initial workflow stage should begin at index 0");
assert(nextWorkflowStage({ completedThrough: 0 }) === 1, "A confirmed stage 0 must advance to stage 1");
assert(nextWorkflowStage({ completedThrough: 3 }) === 4, "Later confirmations should advance exactly one stage");
assert(getWorkflowStageIncompleteReasons({ brief: {} }, 0).length === 6, "Incomplete brief fields should be listed before stage confirmation");
const emptyPlanning = {
  forceMission: { status: "empty", forces: [], relations: [] },
  forceMissionStorage: { stale: false },
  phaseAction: { status: "empty", phases: [], transitions: [] },
  phaseActionStorage: { stale: false },
  conceptMap: { document: { items: [] }, reference: { status: "empty" } },
  conceptMapStorage: { stale: false }
};
const confirmedPlanning = {
  forceMission: {
    status: "confirmed",
    forces: [{ id: "sense", name: "感知", side: "friendly", role: "sense", group: "态势", task: "形成态势", notes: "" }],
    combatForces: [{ id: "combat-sense", name: "作战感知单元", side: "friendly", role: "sense", group: "态势", task: "形成态势", missionType: "support", conceptForceId: "sense", platforms: [], notes: "" }],
    relations: [], openQuestions: [], reviewChecklist: [], generation: {}, confirmedAt: "2026-07-25T00:00:00.000Z"
  },
  forceMissionStorage: { stale: false },
  phaseAction: { status: "confirmed", phases: [{ id: "p1", name: "态势", objective: "形成态势", primaryActions: ["汇聚"], secondaryActions: [], entryConditions: [], exitConditions: [], expectedEffects: [], forceIds: ["sense"] }, { id: "p2", name: "行动", objective: "组织行动", primaryActions: ["主行动"], secondaryActions: [], entryConditions: [], exitConditions: [], expectedEffects: [], forceIds: ["sense"] }], transitions: [], openQuestions: [], reviewChecklist: [], generation: {}, confirmedAt: "2026-07-25T00:00:00.000Z" },
  phaseActionStorage: { stale: false },
  conceptGraphic: {
    status: "confirmed",
    nodes: [
      { id: "sense", label: "感知", role: "sense", fromForceIds: ["sense"], fromPhaseIds: [], note: "态势" },
      { id: "decide", label: "指挥", role: "command", fromForceIds: [], fromPhaseIds: [], note: "协同" },
      { id: "control", label: "行动", role: "action", fromForceIds: [], fromPhaseIds: [], note: "主方向" },
      { id: "opponent", label: "外部", role: "external", fromForceIds: [], fromPhaseIds: [], note: "约束" },
      { id: "assess", label: "效果", role: "effect", fromForceIds: [], fromPhaseIds: [], note: "终态" }
    ],
    edges: [
      { id: "e1", from: "sense", to: "decide", type: "信息流", note: "" },
      { id: "e2", from: "decide", to: "control", type: "控制流", note: "" }
    ],
    effects: [], activityCandidates: [], oodaHints: [], openQuestions: [], reviewChecklist: [], consistencyReport: [], generation: {}, confirmedAt: "2026-07-25T00:00:00.000Z"
  },
  conceptGraphicStorage: { stale: false }
};
assert(getWorkflowStageIncompleteReasons({ ...emptyPlanning }, 1).length >= 5, "Planning stage should require force, phase, map, graphic, and OV reference");
assert(getWorkflowStageIncompleteReasons({ ...confirmedPlanning, conceptMap: { document: { items: [{ id: "map-1" }] }, reference: { status: "draft" } }, conceptMapStorage: { stale: false } }, 1).length === 1, "Unconfirmed map reference should keep the planning gate open");
assert(getWorkflowStageIncompleteReasons({ ...confirmedPlanning, conceptMap: { document: { items: [{ id: "map-1" }] }, reference: { status: "confirmed" } }, conceptMapStorage: { stale: false } }, 1).length === 0, "Confirmed planning products should satisfy stage 1");
assert(currentWorkflow({
  activeProjectId: "demo",
  projectDirectory: { projects: [{ id: "demo", workflow: { completedThrough: 2, mode: "gated" } }] },
  ...confirmedPlanning,
  conceptMap: { document: { items: [{ id: "map-1" }] }, reference: { status: "confirmed" }, context: "Reviewed research-level map context" },
  conceptMapStorage: { stale: true }
}).completedThrough === 0, "A stale concept map should return the workflow to its confirmation stage");

const stageOneGate = renderWorkflowGate({
  activeProjectId: "demo",
  projectDirectory: { projects: [{ id: "demo", workflow: { completedThrough: 0, mode: "gated" } }] },
  workflowCompleting: false,
  brief: {},
  ...confirmedPlanning,
  conceptMap: { document: { items: [{ id: "map-1" }] }, reference: { status: "confirmed" }, context: "Reviewed research-level map context" },
  conceptMapStorage: { stale: false },
  ov1: { nodes: [{}] },
  ov5: { activities: [{}], edges: [{}] },
  ooda: { lanes: [{ nodes: [{}] }] },
  scenario: null,
  validationResult: null,
  collaboration: { openCount: 0 },
  reportVersions: []
});
assert(stageOneGate.includes("workflow-gate-capsule") && stageOneGate.includes('data-action="complete-workflow-stage"') && stageOneGate.includes("确认并进入"), "Stage confirmation capsule should expand to advance action");
assert(stageOneGate.includes('data-action="toggle-workflow-gate"'), "Scheme D capsule should toggle expand/collapse");

const incompleteGate = renderWorkflowGate({
  activeProjectId: "demo",
  projectDirectory: { projects: [{ id: "demo", workflow: { completedThrough: -1, mode: "gated" } }] },
  workflowCompleting: false,
  brief: {}
});
assert(incompleteGate.includes('data-action="complete-workflow-stage"') && !incompleteGate.includes('data-action="complete-workflow-stage" disabled'), "Incomplete stage confirmation must remain clickable for feedback");
assert(incompleteGate.includes("点击确认查看提示") || incompleteGate.includes("待完成"), "Incomplete stage capsule should surface missing requirements");
assert(incompleteGate.includes("workflow-gate-shell") && incompleteGate.includes("workflow-gate-panel"), "Scheme D should render capsule shell and expand panel");

for (const track of workflowTracks) {
  assert(test.includes(`data-track="${track.id}"`), `Missing workflow track ${track.id}`);
  assert(test.includes(track.label), `Missing track label ${track.label}`);
}

const orderIds = views.map((view) => view.id);
assert(orderIds.indexOf("brief") + 1 === orderIds.indexOf("phase-action"), "Phase-action should directly follow the brief");
assert(orderIds.indexOf("phase-action") + 1 === orderIds.indexOf("force-mission"), "Force-mission should follow phase-action");
assert(orderIds.indexOf("force-mission") + 1 === orderIds.indexOf("concept-map"), "Concept-map should follow force-mission");
assert(orderIds.indexOf("concept-map") + 1 === orderIds.indexOf("ov1"), "OV-1 should directly follow concept-map");
assert(!orderIds.includes("concept-graphic"), "Concept-graphic step should be removed from navigation");
assert(orderIds.indexOf("ov5") < orderIds.indexOf("ov5a"), "OV-5b should precede derived OV-5a in workflow order");
assert(orderIds.indexOf("ooda") < orderIds.indexOf("ov2"), "Editable OODA should precede derived OV-2");
assert(test.indexOf("OV-5b") < test.indexOf("OV-5a"), "Navigation should list OV-5b before OV-5a");

assert(onOv5.includes('data-track="model"') && onOv5.includes("has-active"), "Model track should mark active path for OV-5");
assert(onOv5.includes("step-circle") && onOv5.includes("step-ring") && onOv5.includes("step-core") && onOv5.includes("step-spine"), "Step path should render circles and spine");
assert(onOv5.includes("step-expand") && onOv5.includes("step-label-track") && onOv5.includes("step-label-short") && onOv5.includes("step-label-full") && onOv5.includes("step-label-blurb"), "Each step should carry full intro for all-step slide-out");
assert(onOv5.includes("OV-5b 作战活动模型") && onOv5.includes("结构核对台"), "Full step names must remain available in step expand HTML");
assert(onOv5.includes("活动与关系") || onOv5.includes("问题聚合"), "Intro should include view subtitle as blurb");
assert(onOv5.includes("--step-count:"), "Step path should expose step count");
assert(workflowTracks.find((track) => track.id === "review").viewIds.includes("ov5a"), "OV-5a belongs in structure-review track");
assert(workflowTracks.find((track) => track.id === "review").viewIds[0] === "structure-review", "Structure review workbench should lead the review track");
assert(workflowTracks.find((track) => track.id === "model").viewIds.includes("ov5"), "OV-5b belongs in modeling track");
assert(workflowTracks.find((track) => track.id === "model").viewIds.includes("force-mission"), "Force-mission should be available in the modeling track");
assert(workflowTracks.find((track) => track.id === "model").viewIds.includes("phase-action"), "Phase-action should be available in the modeling track");
assert(workflowTracks.find((track) => track.id === "model").viewIds.includes("concept-map"), "The concept-map stage should be available in the modeling track");
assert(!workflowTracks.find((track) => track.id === "model").viewIds.includes("concept-graphic"), "The concept-graphic stage should not remain in the modeling track");
assert(test.includes("结构核对台") || test.includes("核对台"), "Structure review workbench label missing from free-mode tree");
assert(indexHtml.includes('id="workflowTestModeBtn"') && indexHtml.includes('role="switch"') && indexHtml.includes('data-action="toggle-workflow-test-mode"'), "Top menubar is missing the dedicated test-mode switch");
assert(!indexHtml.includes('data-action="set-workflow-mode"'), "Workflow mode controls should not remain inside the research menu");
assert(mainSource.includes('action === "toggle-workflow-test-mode"') && mainSource.includes('workflowTestModeButton.classList.toggle("is-active", testModeActive)') && mainSource.includes('workflowTestModeButton.setAttribute("aria-checked", String(testModeActive))'), "Top test-mode switch does not reflect or toggle workflow state");
assert(mainSource.includes("nextWorkflowStage(workflow)") && mainSource.includes("getWorkflowStageIncompleteReasons(state, next)") && mainSource.includes("workflowCompleting"), "Workflow confirmation should explain missing requirements and block duplicate submissions");
assert(controllerSource.includes("const refreshWorkflowConfirmation = () => hydrateProjectDirectory();") && controllerSource.includes("onSaved: refreshWorkflowConfirmation") && controllerSource.includes("onWorkflowChanged: refreshWorkflowConfirmation"), "Persisted model, archive, and collaboration changes must refresh the workflow confirmation state");

console.log("Workflow test-mode acceptance passed: track navigation and free access retained.");
function assert(condition, message) { if (!condition) throw new Error(message); }
