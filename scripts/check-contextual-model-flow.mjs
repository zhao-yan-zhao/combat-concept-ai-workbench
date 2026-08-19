import { readFile } from "node:fs/promises";
import { relatedFlowNumber, renderContextualModelFlow, renderRelatedModelReturn, resolveModelFocus, resolveRelatedMainViewId } from "../design-studio/src/contextualModelFlow.js";
import { renderTree } from "../design-studio/src/ui.js";

const state = {
  phaseActionFocusId: "phase-1",
  operationalTaskSelectedId: "task-1",
  phaseAction: {
    status: "confirmed",
    phases: [
      { id: "phase-1", name: "准备阶段", objective: "形成态势", primaryActions: ["汇聚态势"] },
      { id: "phase-2", name: "实施阶段", objective: "组织行动", primaryActions: ["实施行动"] }
    ],
    transitions: []
  },
  phaseActionStorage: {},
  forceMission: {
    status: "confirmed",
    tasksConfirmedAt: "2026-08-18T00:00:00.000Z",
    tasks: [{ id: "task-1", name: "态势保障任务", phaseId: "phase-1", side: "friendly", taskType: "support", objective: "形成态势" }],
    forces: [{ id: "force-1", name: "概念感知兵力", side: "friendly", role: "sense", task: "承接态势保障", phaseIds: ["phase-1"] }],
    combatForces: [{ id: "combat-1", name: "作战感知兵力", side: "friendly", role: "sense", task: "承接态势保障", missionType: "support", conceptForceId: "force-1" }],
    relations: []
  },
  forceMissionStorage: {},
  ov1: { nodes: [{ id: "sense", label: "感知", detail: "形成态势输入", x: "20%", y: "30%" }], edges: [] },
  conceptMap: { document: { items: [{ id: "map-1", label: "感知位置" }] }, reference: { status: "confirmed" } },
  scenario: { entities: [{ id: "unit-1" }], timeline: [{ id: "event-1" }] },
  ov6a: { rules: [] },
  ov6b: { stateMachines: [] },
  ov6c: { sequences: [] },
  ov4: { roles: [], relations: [] },
  ov2: { nodes: [], exchanges: [] },
  ov3: { exchanges: [] },
  ov5a: { decompositions: [] },
  ov5: { activities: [], edges: [] }
};

assert(renderContextualModelFlow("brief", state) === "", "Brief must not reserve an empty contextual-flow shell");

const phaseFlow = renderContextualModelFlow("phase-action", state);
assert(phaseFlow.includes("规则库 OV6a") && phaseFlow.includes("状态机 OV6b") && phaseFlow.includes("时序图"), "Phase flow must expose the three shared dynamic models");
assert(phaseFlow.includes("当前对象：准备阶段") && phaseFlow.includes('data-focus-type="phase"') && phaseFlow.includes('data-focus-id="phase-1"'), "Phase flow must carry object context");
assert(phaseFlow.includes('data-related-number="021"') && phaseFlow.includes('data-related-number="022"') && phaseFlow.includes('data-related-number="023"'), "Phase related nodes must use hierarchical 021-style numbering");
assert(phaseFlow.includes('aria-hidden="true">021</span>') && phaseFlow.includes('aria-label="021 · 阶段行动关联流程'), "Related numbers must remain visible while the accessible label carries the same number");
assert(relatedFlowNumber("operational-task", 0) === "031" && relatedFlowNumber("force-mission", 5) === "046", "Related numbering must combine the two-digit main step and one-based related index");
assert(resolveRelatedMainViewId("phase-action", "ov6a") === "phase-action", "Opening the first related node must retain its main step");
assert(resolveRelatedMainViewId("ov6a", "ov6b", { mainViewId: "phase-action", relatedViewId: "ov6a" }) === "phase-action", "Switching between related nodes must not promote the current child to a main step");
assert(resolveRelatedMainViewId("ov5a", "ov5", { mainViewId: "concept-map", relatedViewId: "ov5a" }) === "concept-map", "Shared related models must preserve the originating main step");

const taskFlow = renderContextualModelFlow("operational-task", state);
const taskWithoutRelatedContentFlow = renderContextualModelFlow("operational-task", {
  ...state,
  ov1b: { decompositions: [{ id: "decomposition-unrelated", label: "Unrelated decomposition" }] },
  ov6a: { rules: [{ id: "rule-unrelated", name: "Unrelated rule", phaseBindings: [{ phaseRef: "phase-2" }] }] },
  ov6b: {
    stateMachines: [{
      id: "machine-unrelated",
      subjectType: "phase",
      subjectRef: "phase-2",
      name: "Unrelated machine",
      states: [{ id: "unrelated-start", name: "Start" }, { id: "unrelated-end", name: "End" }],
      transitions: [{ id: "unrelated-transition", fromStateRef: "unrelated-start", toStateRef: "unrelated-end", condition: "Done" }]
    }]
  },
  ov6c: {
    sequences: [{
      id: "sequence-unrelated",
      name: "Unrelated sequence",
      participants: [{ id: "participant-unrelated", refType: "phase", ref: "phase-2" }],
      messages: [{ id: "message-unrelated", fromRef: "participant-unrelated", toRef: "participant-unrelated", name: "Proceed" }]
    }]
  }
});
assert((taskWithoutRelatedContentFlow.match(/step-related-node status-empty/g) || []).length === 4, "All task child flows must stay gray when only unrelated global model content exists");
assert(!taskWithoutRelatedContentFlow.includes("status-partial"), "Unrelated global content must not show task child flows as partially covered");
assert(!taskWithoutRelatedContentFlow.includes("0/1"), "An empty task child flow must not display global content as task coverage");
assert(taskFlow.includes("任务分解 OV1b") && taskFlow.includes('data-view="ov1b"') && !taskFlow.includes('data-view="ov1b" disabled') && taskFlow.includes("规则库 OV6a"), "Task flow must include the available decomposition entry and shared dynamic models");
assert(taskFlow.includes('data-focus-type="task"') && taskFlow.includes('data-focus-id="task-1"'), "Task flow must carry selected task context");

const forceFlow = renderContextualModelFlow("force-mission", { ...state, forcePlatformPicker: { forceId: "force-1" } });
for (const label of ["组织关系 OV4", "资源流 OV2", "资源流矩阵 OV3", "规则库 OV6a", "状态机 OV6b", "时序图"]) {
  assert(forceFlow.includes(label), `Force flow missing ${label}`);
}
assert(resolveModelFocus("force-mission", { ...state, forcePlatformPicker: { forceId: "force-1" } }).focusType === "force", "Force picker must narrow topology context");
const forceRail = renderTree("force-mission", { version: 2, completedThrough: 3, mode: "free" }, { ...state, forcePlatformPicker: { forceId: "force-1" } });
const forcePosition = forceRail.indexOf('data-view="force-mission"');
const firstRelatedPosition = forceRail.indexOf("step-related-node", forcePosition);
const ov1Position = forceRail.indexOf('data-view="ov1"', forcePosition);
assert(forcePosition >= 0 && firstRelatedPosition > forcePosition && ov1Position > firstRelatedPosition, "Related nodes must be inserted between the active main step and its next main step");

const overallFlow = renderContextualModelFlow("ov1", state);
const mapFlow = renderContextualModelFlow("concept-map", state);
assert(overallFlow.includes("作战活动分解 OV5a") && overallFlow.includes("作战活动 OV5b"), "Overall flow must expose activity decomposition and activity model");
assert(mapFlow.includes("作战活动分解 OV5a") && mapFlow.includes("作战活动 OV5b"), "Concept-map flow must reuse the activity models");

const simulationFlow = renderContextualModelFlow("scenario", state);
assert(simulationFlow.includes("任务与活动映射 OV1c") && simulationFlow.includes("状态与活动映射 OV7") && simulationFlow.includes("跨模型校核"), "Simulation flow must expose cross-model mappings and review");

const rail = renderTree("phase-action", { version: 2, completedThrough: 1, mode: "guided" }, state);
assert(rail.includes("is-current") && rail.includes("has-related") && rail.includes("step-related-node"), "The active main step must insert related-model nodes directly on the left rail");
const relatedRail = renderTree("ov6b", { version: 2, completedThrough: 1, mode: "guided" }, { ...state, relatedModelReturnContext: { mainViewId: "phase-action", relatedViewId: "ov6b" } });
assert(relatedRail.includes("is-related-source") && relatedRail.includes('data-related-number="021"') && relatedRail.includes('data-related-number="023"'), "A related-page render must keep the complete child flow under its original main step");
assert(relatedRail.includes('step-related-node status-empty is-current') && relatedRail.includes('data-view="ov6b"') && relatedRail.includes('aria-current="step"'), "The active related node must be marked as the current subflow step");
const briefRail = renderTree("brief", { version: 2, completedThrough: 0, mode: "guided" }, state);
assert(!briefRail.includes("step-related-node"), "A main step without related models must not reserve rail nodes");

const returnBar = renderRelatedModelReturn({
  activeView: "ov6a",
  relatedModelReturnContext: { mainViewId: "phase-action", mainLabel: "阶段与行动", relatedViewId: "ov6a", focusLabel: "准备阶段" }
});
assert(returnBar.includes("返回阶段与行动") && returnBar.includes("准备阶段") && returnBar.includes("data-return-mainline"), "Related-model page must restore its originating mainline context");
assert(returnBar.includes("quiet-button related-model-return-button"), "The return command must reuse the compact product-toolbar button treatment");

const mainSource = await readFile(new URL("../design-studio/src/main.js", import.meta.url), "utf8");
const contextualSource = await readFile(new URL("../design-studio/src/contextualModelFlow.js", import.meta.url), "utf8");
assert(mainSource.includes("renderTree(state.activeView, currentWorkflow(), state)") && !mainSource.includes("renderContextualModelFlow(state.activeView"), "Main shell must render contextual topology in the rail, not the page body");
assert(mainSource.includes("scrollSnapshots: captureViewScroll") && mainSource.includes("restoreViewScroll"), "Main shell must restore the originating main-step position");
assert(mainSource.includes('ctx.mainViewId === "phase-action"')
  && mainSource.includes('state.activeView === "ov6c"')
  && mainSource.includes('ctx.nextStep.id === "operational-task"')
  && mainSource.includes("completeOperationalTasks: completesPhaseSubflow"), "Leaving the phase sequence subflow must request automatic operational-task completion");
assert(mainSource.includes("operationalTasksNeedAiCompletion")
  && mainSource.includes("task?.expectedEffect")
  && mainSource.includes("points.length < requiredPoints"), "Automatic task completion must check task content and area geometry before preserving an existing draft");
assert(contextualSource.includes('".seq-toolbar"') && contextualSource.includes('".sm-toolbar"') && contextualSource.includes("toolbar.prepend(returnBar)"), "Related return must mount into the page refresh/save toolbar when one exists");
const styles = await readFile(new URL("../design-studio/styles.css", import.meta.url), "utf8");
assert(styles.includes("@keyframes step-related-line-in") && styles.includes("@keyframes step-related-sheen") && styles.includes("--related-stagger"), "Related labels must draw out from the spine with staggered main-step-style motion");
assert(styles.includes(".project-rail:hover .step-related-button::after") && styles.includes("opacity: 0;") && styles.includes("transform: scaleX(0);"), "Collapsed related nodes must hide their horizontal connector until the rail expands");
assert(styles.includes(".project-rail:hover .step-related-node.is-current .step-related-button::after") && !styles.includes("\n.step-related-node.is-current .step-related-button::after {") && !styles.includes(".step-related-node.is-current .step-related-copy {"), "The current related node must collapse its connector and label until the rail expands");
assert(styles.includes(".project-rail:hover .step-related-copy") && styles.includes("visibility: hidden") && styles.includes("translate3d(-.9rem, -50%, 0)"), "Related text must use the same hover-to-slide-out behavior as main-step text");
assert(styles.includes(".step-related-label") && styles.includes("border: 1px solid rgba(96, 165, 250, .28)") && styles.includes("linear-gradient(90deg, #0c172c"), "Related labels must use the same outlined title treatment as main steps");

console.log("Contextual model-flow acceptance passed: left-rail topology, conditional hiding, object filters, and return context.");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
