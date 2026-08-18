import { renderTree } from "../design-studio/src/ui.js";
import { views, workflowPhases, workflowPrimaryStepIds, workflowTracks } from "../design-studio/src/data.js";
import { currentWorkflow, getWorkflowStageIncompleteReasons, nextWorkflowStage, renderWorkflowGate } from "../design-studio/src/app/workflowGate.js";
import { normalizeWorkflowProgress } from "../shared/workflowProgress.js";
import { readFile } from "node:fs/promises";

const indexHtml = await readFile(new URL("../design-studio/index.html", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../design-studio/src/main.js", import.meta.url), "utf8");
const controllerSource = await readFile(new URL("../design-studio/src/app/wireControllers.js", import.meta.url), "utf8");

const gated = renderTree("brief", { version: 2, completedThrough: -1, mode: "gated" });
const test = renderTree("brief", { version: 2, completedThrough: -1, mode: "free" });
const onOverall = renderTree("ov1", { version: 2, completedThrough: 4, mode: "free" });

assert(gated.includes("disabled") && gated.includes("locked"), "Gated workflow did not keep later stages locked");
assert(!test.includes("disabled") && !test.includes("locked"), "Test mode still locked one or more modules");
assert(nextWorkflowStage({ version: 2, completedThrough: -1 }) === 0, "Initial workflow stage should begin at index 0");
assert(nextWorkflowStage({ version: 2, completedThrough: 0 }) === 1, "A confirmed stage 0 must advance to stage 1");
assert(nextWorkflowStage({ version: 2, completedThrough: 3 }) === 4, "Later confirmations should advance exactly one stage");
assert(normalizeWorkflowProgress({ completedThrough: 2 }).completedThrough === 3, "Legacy force stage must migrate through the new force step");
assert(normalizeWorkflowProgress({ completedThrough: 4 }).completedThrough === 6, "Legacy completed workflows must migrate through simulation");
assert(workflowPhases.join(",") === "简报,阶段行动,作战任务,作战兵力,总体图,概念图,仿真演示", "Workflow phases must match the seven-step mainline");
assert(getWorkflowStageIncompleteReasons({ brief: {} }, 0).length === 6, "Incomplete brief fields should be listed before stage confirmation");

const emptyPhase = {
  phaseAction: { status: "empty", phases: [], transitions: [] },
  phaseActionStorage: { stale: false }
};
const confirmedPhase = {
  phaseAction: {
    status: "confirmed",
    phases: [
      { id: "p1", name: "态势", objective: "形成态势", primaryActions: ["汇聚"], secondaryActions: [], entryConditions: [], exitConditions: [], expectedEffects: [], forceIds: ["sense"] },
      { id: "p2", name: "行动", objective: "组织行动", primaryActions: ["主行动"], secondaryActions: [], entryConditions: [], exitConditions: [], expectedEffects: [], forceIds: ["sense"] }
    ],
    transitions: [],
    openQuestions: [],
    reviewChecklist: [],
    generation: {},
    confirmedAt: "2026-07-25T00:00:00.000Z"
  },
  phaseActionStorage: { stale: false }
};
const emptyForce = {
  forceMission: { status: "empty", forces: [], relations: [] },
  forceMissionStorage: { stale: false }
};
const confirmedForce = {
  forceMission: {
    status: "confirmed",
    tasks: [{ id: "task-1", name: "形成态势", side: "friendly", phaseId: "p1", taskType: "support", objective: "形成态势", expectedEffect: "可用态势", area: { type: "circle", points: [] } }],
    tasksConfirmedAt: "2026-07-25T00:00:00.000Z",
    forces: [{ id: "sense", name: "感知", side: "friendly", role: "sense", group: "态势", task: "形成态势", notes: "" }],
    combatForces: [{ id: "combat-sense", name: "作战感知单元", side: "friendly", role: "sense", group: "态势", task: "形成态势", missionType: "support", conceptForceId: "sense", platforms: [], notes: "" }],
    relations: [],
    openQuestions: [],
    reviewChecklist: [],
    generation: {},
    confirmedAt: "2026-07-25T00:00:00.000Z"
  },
  forceMissionStorage: { stale: false }
};
const confirmedConcept = {
  conceptMap: { document: { items: [{ id: "map-1" }] }, reference: { status: "confirmed" }, context: "Reviewed research-level map context" },
  conceptMapStorage: { stale: false },
  ov1: { nodes: [{ id: "n1" }, { id: "n2" }], edges: [{ id: "e1" }] },
  ov1Storage: { stale: false }
};

assert(getWorkflowStageIncompleteReasons({ ...emptyPhase }, 1).length >= 1, "Phase stage should require confirmed phase-action");
assert(getWorkflowStageIncompleteReasons({ ...confirmedPhase }, 1).length === 0, "Confirmed phase-action should satisfy stage 1");
assert(getWorkflowStageIncompleteReasons({ ...emptyForce }, 2).length >= 1, "Task stage should require confirmed operational tasks");
assert(getWorkflowStageIncompleteReasons({ ...confirmedForce }, 2).length === 0, "Confirmed operational tasks should satisfy stage 2");
assert(getWorkflowStageIncompleteReasons({ ...emptyForce }, 3).length >= 1, "Force stage should require confirmed combat forces");
assert(getWorkflowStageIncompleteReasons({ ...confirmedForce }, 3).length === 0, "Confirmed combat forces should satisfy stage 3");
assert(getWorkflowStageIncompleteReasons({
  ov1: { nodes: [], edges: [] },
  ov1Storage: { stale: false }
}, 4).length === 2, "Overall stage should require OV1a nodes and relations");
assert(getWorkflowStageIncompleteReasons({ ...confirmedConcept }, 4).length === 0, "Overall graph should satisfy stage 4");
assert(getWorkflowStageIncompleteReasons({ conceptMap: { document: { items: [] }, reference: { status: "empty" } }, conceptMapStorage: { stale: false } }, 5).length >= 2, "Concept-map stage should require map content and confirmation");
assert(getWorkflowStageIncompleteReasons({ ...confirmedConcept }, 5).length === 0, "Confirmed concept map should satisfy stage 5");

const completeBrief = {
  researchIntent: "意图",
  objective: "目标",
  approach: "路线",
  assumptions: "假设",
  expectedEffects: "效果",
  risk: "风险"
};

assert(currentWorkflow({
  activeProjectId: "demo",
  projectDirectory: { projects: [{ id: "demo", workflow: { version: 2, completedThrough: 5, mode: "gated" } }] },
  brief: completeBrief,
  ...confirmedPhase,
  ...confirmedForce,
  ...confirmedConcept,
  conceptMapStorage: { stale: true }
}).completedThrough === 4, "A stale concept map should return the workflow to before the concept-map stage");

// Associated models never expose a linear mainline gate.
const ruleGate = renderWorkflowGate({
  activeProjectId: "demo",
  activeView: "ov6a",
  projectDirectory: { projects: [{ id: "demo", workflow: { version: 2, completedThrough: 0, mode: "gated" } }] },
  workflowCompleting: false,
  brief: completeBrief,
  ...confirmedPhase
});
assert(ruleGate === "", "Associated rule library must not expose mainline progression");

// Each authoritative product owns one independent mainline gate.
const phaseGate = renderWorkflowGate({
  activeProjectId: "demo",
  activeView: "phase-action",
  projectDirectory: { projects: [{ id: "demo", workflow: { version: 2, completedThrough: 0, mode: "gated" } }] },
  workflowCompleting: false,
  brief: completeBrief,
  ...confirmedPhase
});
assert(phaseGate.includes('data-action="complete-workflow-stage"') && phaseGate.includes("作战任务"), "Confirmed phase action should complete stage 1 and enter tasks");

const overallGate = renderWorkflowGate({
  activeProjectId: "demo",
  activeView: "ov1",
  projectDirectory: { projects: [{ id: "demo", workflow: { version: 2, completedThrough: 3, mode: "gated" } }] },
  workflowCompleting: false,
  brief: completeBrief,
  ...confirmedPhase,
  ...confirmedForce,
  ...confirmedConcept
});
assert(overallGate.includes('data-action="complete-workflow-stage"') && overallGate.includes("概念图"), "Overall graph must precede and unlock concept map");

const incompleteGate = renderWorkflowGate({
  activeProjectId: "demo",
  activeView: "brief",
  projectDirectory: { projects: [{ id: "demo", workflow: { version: 2, completedThrough: -1, mode: "gated" } }] },
  workflowCompleting: false,
  brief: {}
});
assert(incompleteGate.includes('data-action="complete-workflow-stage"') && !incompleteGate.includes('data-action="complete-workflow-stage" disabled'), "Incomplete stage confirmation must remain clickable for feedback");
assert(incompleteGate.includes("点击确认") || incompleteGate.includes("待完成"), "Incomplete stage capsule should surface missing requirements");
assert(incompleteGate.includes("workflow-gate-shell") && incompleteGate.includes("workflow-gate-panel"), "Scheme D should render capsule shell and expand panel");

for (const track of workflowTracks) {
  assert(test.includes(`data-track="${track.id}"`), `Missing workflow track ${track.id}`);
  assert(test.includes(track.label), `Missing track label ${track.label}`);
}

const orderIds = views.map((view) => view.id);
assert(orderIds.indexOf("brief") < orderIds.indexOf("phase-action"), "Phase action should follow the brief");
assert(orderIds.indexOf("phase-action") < orderIds.indexOf("ov6a"), "Phase-associated models should follow their anchor in product order");
assert(orderIds.indexOf("phase-action") < orderIds.indexOf("ov6b") && orderIds.indexOf("ov6b") < orderIds.indexOf("ov6c"), "State then sequence validation follow phase-action");
assert(orderIds.indexOf("ov6c") < orderIds.indexOf("operational-task") && orderIds.indexOf("operational-task") < orderIds.indexOf("force-mission"), "Operational tasks should precede combat forces after phase checks");
assert(orderIds.indexOf("force-mission") < orderIds.indexOf("ov4"), "Responsibility check should follow force-mission");
assert(orderIds.indexOf("ov4") < orderIds.indexOf("ov2") && orderIds.indexOf("ov2") < orderIds.indexOf("ov3"), "Force track order is responsibility → resource flow → matrix");
assert(orderIds.indexOf("ov3") < orderIds.indexOf("ov1"), "Overall graph should follow force-associated products");
assert(orderIds.indexOf("ov1") < orderIds.indexOf("concept-map"), "Overall graph must precede concept map");
assert(!orderIds.includes("concept-graphic"), "Concept-graphic step should be removed from navigation");
assert(orderIds.indexOf("ov5a") < orderIds.indexOf("ov5"), "Activity decomposition should precede activity model in product order");
assert(workflowPrimaryStepIds.join(",") === "brief,phase-action,operational-task,force-mission,ov1,concept-map,scenario", "Primary step chain must contain exactly the seven mainline products");

assert(onOverall.includes('data-track="overall"') && onOverall.includes("has-active"), "Overall track should mark the active mainline product");
assert(onOverall.includes("step-circle") && onOverall.includes("step-ring") && onOverall.includes("step-core") && onOverall.includes("step-spine"), "Step path should render circles and spine");
assert(onOverall.includes("step-expand") && onOverall.includes("step-label-track") && onOverall.includes("step-label-short") && onOverall.includes("step-label-full") && onOverall.includes("step-label-blurb"), "Each mainline step should carry its full intro");
assert(onOverall.includes("总体图（OV1a）") && onOverall.includes("仿真演示"), "Seven-step names must remain available in step expand HTML");
assert(onOverall.includes("总体概念是否闭合"), "Intro should include the view subtitle as blurb");
assert(onOverall.includes("--step-count:7"), "Step path should expose the seven-step count");
assert(workflowTracks.map((track) => track.id).join(",") === "brief,phase,task,force,overall,map,simulation", "Navigation should use seven one-product tracks");
for (const track of workflowTracks) assert(track.viewIds.length === 1, `Track ${track.id} must contain exactly one mainline product`);
assert(!workflowTracks.some((track) => track.viewIds.includes("concept-graphic")), "The concept-graphic stage should not remain in navigation tracks");
assert(!test.includes("规则库") && !test.includes("状态机") && !test.includes("时序图") && !test.includes("组织关系"), "Associated models must not appear as numbered navigation steps");
assert(test.includes("仿真演示") && test.includes("阶段行动") && test.includes("作战任务") && test.includes("作战兵力") && test.includes("总体图") && test.includes("概念图"), "Seven-step labels should appear in free-mode tree");
assert(indexHtml.includes('id="workflowTestModeBtn"') && indexHtml.includes('role="switch"') && indexHtml.includes('data-action="toggle-workflow-test-mode"'), "Top menubar is missing the dedicated test-mode switch");
assert(!indexHtml.includes('data-action="set-workflow-mode"'), "Workflow mode controls should not remain inside the research menu");
assert(mainSource.includes('action === "toggle-workflow-test-mode"') && mainSource.includes('workflowTestModeButton.classList.toggle("is-active", testModeActive)') && mainSource.includes('workflowTestModeButton.setAttribute("aria-checked", String(testModeActive))'), "Top test-mode switch does not reflect or toggle workflow state");
assert(
  mainSource.includes("advanceWorkflowStep")
    && mainSource.includes("getWorkflowStageIncompleteReasons(state, stage)")
    && mainSource.includes("workflowCompleting")
    && mainSource.includes("resolveWorkflowGateContext"),
  "Main workflow gate wiring is incomplete"
);
assert(controllerSource.includes("forceMission") || controllerSource.includes("ForceMission"), "Force-mission controller wiring should remain available");

console.log("Workflow test-mode acceptance passed: seven-step mainline, migration, gates, and free access retained.");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
