import { renderTree } from "../design-studio/src/ui.js";
import { views, workflowPhases, workflowPrimaryStepIds, workflowTracks } from "../design-studio/src/data.js";
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
assert(workflowPhases.join(",") === "研究建模,阶段行动,兵力任务,概念图,推演演示", "Workflow phases must match the five research steps");
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
  ov1: { nodes: [{}] },
  ov5: { activities: [{}], edges: [{}] },
  ooda: { lanes: [{ nodes: [{}] }] }
};

assert(getWorkflowStageIncompleteReasons({ ...emptyPhase }, 1).length >= 1, "Phase stage should require confirmed phase-action");
assert(getWorkflowStageIncompleteReasons({ ...confirmedPhase }, 1).length === 0, "Confirmed phase-action should satisfy stage 1");
assert(getWorkflowStageIncompleteReasons({ ...emptyForce }, 2).length >= 1, "Force stage should require confirmed force-mission");
assert(getWorkflowStageIncompleteReasons({ ...confirmedForce }, 2).length === 0, "Confirmed force-mission should satisfy stage 2");
assert(getWorkflowStageIncompleteReasons({
  conceptMap: { document: { items: [] }, reference: { status: "empty" } },
  conceptMapStorage: { stale: false },
  ov1: { nodes: [] },
  ov5: { activities: [], edges: [] },
  ooda: { lanes: [] }
}, 3).length >= 4, "Concept stage should require map, overall graphic, activities, and cycle");
assert(getWorkflowStageIncompleteReasons({ ...confirmedConcept }, 3).length === 0, "Confirmed concept products should satisfy stage 3");

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
  projectDirectory: { projects: [{ id: "demo", workflow: { completedThrough: 3, mode: "gated" } }] },
  brief: completeBrief,
  ...confirmedPhase,
  ...confirmedForce,
  ...confirmedConcept,
  conceptMapStorage: { stale: true }
}).completedThrough === 2, "A stale concept map should return the workflow to before the concept stage");

// Phase chain mid-path: rule library → phase-action.
const ruleGate = renderWorkflowGate({
  activeProjectId: "demo",
  activeView: "ov6a",
  projectDirectory: { projects: [{ id: "demo", workflow: { completedThrough: 0, mode: "gated" } }] },
  workflowCompleting: false,
  brief: completeBrief,
  ...confirmedPhase
});
assert(ruleGate.includes('data-action="advance-workflow-step"') && ruleGate.includes("下一步"), "Rule library should advance to phase-action");
assert(!ruleGate.includes('data-action="complete-workflow-stage"'), "Rule library is not the last primary step of 阶段行动");

// Phase-action mid-path → state machines.
const phaseGate = renderWorkflowGate({
  activeProjectId: "demo",
  activeView: "phase-action",
  projectDirectory: { projects: [{ id: "demo", workflow: { completedThrough: 0, mode: "gated" } }] },
  workflowCompleting: false,
  brief: completeBrief,
  ...confirmedPhase
});
assert(phaseGate.includes('data-action="advance-workflow-step"') && phaseGate.includes("下一步"), "Phase-action should advance into state/sequence validation pages");
assert(!phaseGate.includes('data-action="complete-workflow-stage"'), "Phase-action is not the last primary step of 阶段行动");

// Last primary step of 阶段行动 (sequence validation) → complete stage when phase confirmed.
const phaseLastGate = renderWorkflowGate({
  activeProjectId: "demo",
  activeView: "ov6c",
  projectDirectory: { projects: [{ id: "demo", workflow: { completedThrough: 0, mode: "gated" } }] },
  workflowCompleting: false,
  brief: completeBrief,
  ...confirmedPhase
});
assert(phaseLastGate.includes('data-action="complete-workflow-stage"') && phaseLastGate.includes("确认阶段行动并进入作战任务"), "Last phase-check page should complete 阶段行动 and enter operational-task");
assert(phaseLastGate.includes("作战任务"), "Completing 阶段行动 should unlock 作战任务");
assert(phaseLastGate.includes("下一步") && phaseLastGate.includes("确认阶段行动并进入作战任务"), "Sequence next-step gate must explicitly target operational-task");

// Mid 概念图 stage: concept-map → next primary step ov1.
const midConceptGate = renderWorkflowGate({
  activeProjectId: "demo",
  activeView: "concept-map",
  projectDirectory: { projects: [{ id: "demo", workflow: { completedThrough: 2, mode: "gated" } }] },
  workflowCompleting: false,
  brief: completeBrief,
  ...confirmedPhase,
  ...confirmedForce,
  ...confirmedConcept
});
assert(midConceptGate.includes('data-action="advance-workflow-step"') && midConceptGate.includes("下一步"), "Mid-concept capsule should advance to the next primary step");
assert(!midConceptGate.includes('data-action="complete-workflow-stage"'), "Mid-concept capsule must not complete the whole stage");
assert(midConceptGate.includes("高层作战概念图") || midConceptGate.includes("总体图"), "Next primary step after concept-map should be the overall concept graphic");

// Last primary step of 概念图 → complete stage.
const conceptLastGate = renderWorkflowGate({
  activeProjectId: "demo",
  activeView: "ooda",
  projectDirectory: { projects: [{ id: "demo", workflow: { completedThrough: 2, mode: "gated" } }] },
  workflowCompleting: false,
  brief: completeBrief,
  ...confirmedPhase,
  ...confirmedForce,
  ...confirmedConcept,
  scenario: null,
  validationResult: null
});
assert(conceptLastGate.includes('data-action="complete-workflow-stage"') && conceptLastGate.includes("确认并进入"), "Last primary concept step should offer stage confirmation");
assert(conceptLastGate.includes("推演演示"), "Completing concept stage should unlock 推演演示");

const incompleteGate = renderWorkflowGate({
  activeProjectId: "demo",
  activeView: "brief",
  projectDirectory: { projects: [{ id: "demo", workflow: { completedThrough: -1, mode: "gated" } }] },
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
assert(orderIds.indexOf("brief") < orderIds.indexOf("ov6a"), "Rule library should follow the brief");
assert(orderIds.indexOf("ov6a") < orderIds.indexOf("phase-action"), "Phase-action should follow rule library");
assert(orderIds.indexOf("phase-action") < orderIds.indexOf("ov6b") && orderIds.indexOf("ov6b") < orderIds.indexOf("ov6c"), "State then sequence validation follow phase-action");
assert(orderIds.indexOf("ov6c") < orderIds.indexOf("operational-task") && orderIds.indexOf("operational-task") < orderIds.indexOf("force-mission"), "Operational tasks should precede combat forces after phase checks");
assert(orderIds.indexOf("force-mission") < orderIds.indexOf("ov4"), "Responsibility check should follow force-mission");
assert(orderIds.indexOf("ov4") < orderIds.indexOf("ov2") && orderIds.indexOf("ov2") < orderIds.indexOf("ov3"), "Force track order is responsibility → resource flow → matrix");
assert(orderIds.indexOf("ov3") < orderIds.indexOf("concept-map"), "Concept-map should follow force-track checks");
assert(orderIds.indexOf("concept-map") < orderIds.indexOf("ov1"), "Overall concept graphic should follow concept-map");
assert(!orderIds.includes("concept-graphic"), "Concept-graphic step should be removed from navigation");
assert(orderIds.indexOf("ov5") < orderIds.indexOf("ov5a"), "Activity model should precede activity tree in full order");
assert(workflowPrimaryStepIds.join(",") === "brief,ov6a,phase-action,ov6b,ov6c,operational-task,force-mission,ov4,ov2,ov3,concept-map,ov1,ov5,ov5a,ooda,structure-review,scenario,validate,collaboration,report", "Primary step chain must match fixed phase research path");

assert(onOv5.includes('data-track="concept"') && onOv5.includes("has-active"), "Concept track should mark active path for activity model");
assert(onOv5.includes("step-circle") && onOv5.includes("step-ring") && onOv5.includes("step-core") && onOv5.includes("step-spine"), "Step path should render circles and spine");
assert(onOv5.includes("step-expand") && onOv5.includes("step-label-track") && onOv5.includes("step-label-short") && onOv5.includes("step-label-full") && onOv5.includes("step-label-blurb"), "Each step should carry full intro for all-step slide-out");
assert(onOv5.includes("作战活动模型") && onOv5.includes("结构核对台"), "Full step names must remain available in step expand HTML");
assert(onOv5.includes("横向活动关系") || onOv5.includes("问题聚合"), "Intro should include view subtitle as blurb");
assert(onOv5.includes("--step-count:"), "Step path should expose step count");
assert(workflowTracks.map((track) => track.id).join(",") === "model,phase,force,concept,deliver", "Navigation should use the five research tracks");
assert(workflowTracks.find((track) => track.id === "model")?.viewIds.join(",") === "brief", "Research-model track should only host the brief");
assert(workflowTracks.find((track) => track.id === "phase")?.viewIds.join(",") === "ov6a,phase-action,ov6b,ov6c", "Phase track must be 规则库 → 阶段 → 状态 → 时序");
assert(workflowTracks.find((track) => track.id === "force")?.viewIds.join(",") === "operational-task,force-mission,ov4,ov2,ov3", "Force track should host tasks, forces, then responsibility and resource-flow checks");
assert(workflowTracks.find((track) => track.id === "concept")?.viewIds.join(",") === "concept-map,ov1,ov5,ov5a,ooda", "Concept track should host map, overall graphic, activities, and cycle");
assert(workflowTracks.find((track) => track.id === "deliver")?.viewIds[0] === "structure-review", "Delivery track should lead with structure review");
assert(workflowTracks.find((track) => track.id === "deliver")?.label === "推演演示", "Delivery track should be labeled 推演演示");
assert(!workflowTracks.some((track) => track.viewIds.includes("concept-graphic")), "The concept-graphic stage should not remain in navigation tracks");
assert(!test.includes("OV-1") && !test.includes("OV-5") && !test.includes("OV-6"), "Navigation tree should not expose OV branding");
assert(test.includes("推演演示") && test.includes("阶段行动") && test.includes("兵力任务") && test.includes("概念图"), "Five-step track labels should appear in free-mode tree");
assert(test.includes("规则库") && test.includes("状态机校验") && test.includes("时序校验"), "Phase chain labels should appear in free-mode tree");
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

console.log("Workflow test-mode acceptance passed: track navigation and free access retained.");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
