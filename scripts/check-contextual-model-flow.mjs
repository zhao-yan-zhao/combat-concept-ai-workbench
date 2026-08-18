import { readFile } from "node:fs/promises";
import { renderContextualModelFlow, renderRelatedModelReturn, resolveModelFocus } from "../design-studio/src/contextualModelFlow.js";
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

const taskFlow = renderContextualModelFlow("operational-task", state);
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
const briefRail = renderTree("brief", { version: 2, completedThrough: 0, mode: "guided" }, state);
assert(!briefRail.includes("step-related-node"), "A main step without related models must not reserve rail nodes");

const returnBar = renderRelatedModelReturn({
  activeView: "ov6a",
  relatedModelReturnContext: { mainViewId: "phase-action", mainLabel: "阶段与行动", relatedViewId: "ov6a", focusLabel: "准备阶段" }
});
assert(returnBar.includes("返回阶段与行动") && returnBar.includes("准备阶段") && returnBar.includes("data-return-mainline"), "Related-model page must restore its originating mainline context");

const mainSource = await readFile(new URL("../design-studio/src/main.js", import.meta.url), "utf8");
assert(mainSource.includes("renderTree(state.activeView, currentWorkflow(), state)") && !mainSource.includes("renderContextualModelFlow(state.activeView"), "Main shell must render contextual topology in the rail, not the page body");
assert(mainSource.includes("scrollSnapshots: captureViewScroll") && mainSource.includes("restoreViewScroll"), "Main shell must restore the originating main-step position");
const styles = await readFile(new URL("../design-studio/styles.css", import.meta.url), "utf8");
assert(styles.includes("@keyframes step-related-line-in") && styles.includes("@keyframes step-related-sheen") && styles.includes("--related-stagger"), "Related labels must draw out from the spine with staggered main-step-style motion");
assert(styles.includes(".project-rail:hover .step-related-copy") && styles.includes("visibility: hidden") && styles.includes("translate3d(-.9rem, -50%, 0)"), "Related text must use the same hover-to-slide-out behavior as main-step text");
assert(styles.includes(".step-related-label") && styles.includes("border: 1px solid rgba(96, 165, 250, .28)") && styles.includes("linear-gradient(90deg, #0c172c"), "Related labels must use the same outlined title treatment as main steps");

console.log("Contextual model-flow acceptance passed: left-rail topology, conditional hiding, object filters, and return context.");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
