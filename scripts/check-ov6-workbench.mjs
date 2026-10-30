import { readFile } from "node:fs/promises";
import {
  addOv6aRule,
  addOv6bStateMachine,
  addOv6bState,
  addOv6bDecisionBranch,
  updateOv6bCanvasLayout,
  updateOv6bTransition,
  addOv6cMessage,
  duplicateOv6cMessage,
  addOv6cSequence,
  clearOv6aRules,
  clearOv6bStateMachines,
  clearOv6cSequences,
  removeOv6cSequence,
  inspectPhaseAgainstOv6,
  listActivityCandidates,
  listForceAndPhaseSubjects,
  listRuleBindingCandidates,
  listStableReferenceCandidates,
  listStateMachineSubjects,
  diagnoseOv6bMachineLocal,
  seedOv6cFromPhase,
  setOv6aBindingStatus,
  setOv6aObjectBindingStatus,
  toggleOv6aActivityBinding,
  toggleOv6aObjectBinding,
  layoutSequenceGantt,
  formatSequenceClock
} from "../design-studio/src/ov6Workbench.js";
import {
  applyStateMachineDraft,
  buildSequenceGenerationAnalysis,
  buildStateMachineGenerationAnalysis,
  ensureRequiredSequenceCoverage
} from "../design-studio/src/dodafProductController.js";
import { applySequenceDraft } from "../design-studio/src/sequenceChatController.js";
import { generateMockOutput } from "../shared/generator.js";
import { renderOv6a, renderOv6b } from "../design-studio/src/dodafOperationalViews.js";
import { renderOv6c, renderSequenceToolboxFloatButton } from "../design-studio/src/ov6cView.js";
import { renderStateMachineToolboxFloatButton } from "../design-studio/src/stateMachineView.js";
import { renderRuleLibraryChatFloatButton } from "../design-studio/src/ruleLibraryView.js";
import { buildStructureReview } from "../design-studio/src/structureReviewBuilder.js";
import { normalizeDodafOv6a, normalizeDodafOv6b } from "../shared/dodaf/products.js";
import {
  sequenceToMermaid,
  sequenceToJsSequence,
  sequenceToPlantUml,
  parseJsSequenceDsl,
  parseMermaidSequenceDsl,
  mergeParsedSequence
} from "../design-studio/src/sequenceDiagramDsl.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const state = {
  activeView: "ov6a",
  phaseAction: {
    phases: [
      {
        id: "p1",
        name: "感知",
        timeWindow: "T+00:00至T+00:40",
        blueActions: ["汇聚态势", "识别目标"],
        primaryActions: ["汇聚态势", "识别目标"],
        redActions: ["电子干扰", "佯动侦察"]
      },
      {
        id: "p2",
        name: "行动",
        timeWindow: "T+00:40至T+01:20",
        blueActions: ["主方向实施"],
        primaryActions: ["主方向实施"],
        redActions: ["机动防空"]
      }
    ]
  },
  ov5: {
    activities: [{ id: "a1", title: "协同决策", type: "决策" }],
    edges: []
  },
  forceMission: {
    tasks: [{ id: "task-sense", name: "态势保障任务", phaseId: "p1", objective: "形成持续态势" }],
    forces: [{ id: "force-sense", name: "感知单元", side: "friendly", role: "sense", task: "持续汇聚态势" }, { id: "force-red", name: "对抗单元", side: "hostile", role: "maneuver", task: "形成对抗压力" }, { id: "force-empty", name: "空对象" }],
    combatForces: [{ id: "combat-link", name: "链路保障组", side: "friendly", role: "support", task: "维持链路可用" }]
  },
  ov6a: normalizeDodafOv6a({
    rules: [{ id: "rule-1", name: "链路可用", description: "链路保持", scope: "全局" }]
  }),
  ov6b: { stateMachines: [] },
  ov6c: { sequences: [] }
};

const candidates = listActivityCandidates(state);
assert(candidates.some((item) => item.id === "p1::action-1"), "Phase actions should become bindable candidates");
assert(candidates.some((item) => item.id === "a1"), "OV-5 activities should be bindable");
const machineSubjects = listStateMachineSubjects(state);
assert(machineSubjects.some((item) => item.id === "p1::action-1"), "Key actions should become state-machine subjects");
assert(machineSubjects.some((item) => item.id === "force-sense"), "Lifecycle-bearing forces should become state-machine subjects");
assert(machineSubjects.some((item) => item.id === "combat-link"), "Mission-bearing combat forces should become state-machine subjects");
assert(!machineSubjects.some((item) => item.id === "force-empty"), "Forces without a lifecycle-bearing task or role should be excluded");
assert(!machineSubjects.some((item) => item.id === "p1" || item.id === "p2"), "Phase containers must not automatically become state-machine subjects");
assert(machineSubjects.find((item) => item.id === "p1::action-1")?.name.includes("感知 · 汇聚态势"), "Task candidates should retain visible phase context");
assert(machineSubjects.find((item) => item.id === "p1::action-1")?.subjectType === "phase", "Phase-action candidates must be classified as 阶段机");
assert(machineSubjects.find((item) => item.id === "task-sense")?.subjectType === "task", "Independent operational tasks must become task state-machine subjects");
const ruleCandidates = listRuleBindingCandidates(state);
assert(ruleCandidates.some((item) => item.type === "task" && item.ref === "task-sense"), "Rule binding candidates must include stable task refs");
assert(ruleCandidates.some((item) => item.type === "force" && item.ref === "combat-link"), "Rule binding candidates must include concept and combat force refs");
const stableRefs = listStableReferenceCandidates(state);
assert(stableRefs.some((item) => item.refType === "phase" && item.ref === "p1") && stableRefs.some((item) => item.refType === "task" && item.ref === "task-sense") && stableRefs.some((item) => item.refType === "force" && item.ref === "force-sense"), "Sequence reference candidates must preserve phase/task/force types");
const sequenceSubjects = listForceAndPhaseSubjects(state);
assert(sequenceSubjects.find((item) => item.id === "p1")?.subjectType === "phase" && sequenceSubjects.find((item) => item.id === "task-sense")?.subjectType === "task" && sequenceSubjects.find((item) => item.id === "combat-link")?.subjectType === "force", "Sequence generation subjects must preserve phase/task/force identity");

let ov6a = state.ov6a;
ov6a = toggleOv6aActivityBinding(ov6a, "rule-1", "p1::action-1", { checked: true, status: "pending" });
assert(ov6a.rules[0].activityBindings[0]?.activityRef === "p1::action-1", "Toggle binding should add activity");
ov6a = setOv6aBindingStatus(ov6a, "rule-1", "p1::action-1", "verified");
assert(ov6a.rules[0].reviewStatus === "verified", "Verified binding should update review status");
ov6a = toggleOv6aObjectBinding(ov6a, "rule-1", "task", "task-sense", { checked: true, status: "pending" });
ov6a = toggleOv6aObjectBinding(ov6a, "rule-1", "force", "force-sense", { checked: true, status: "verified" });
assert(ov6a.rules[0].taskBindings[0]?.taskRef === "task-sense" && ov6a.rules[0].forceBindings[0]?.forceRef === "force-sense", "Rule task/force bindings must persist stable refs");
ov6a = setOv6aObjectBindingStatus(ov6a, "rule-1", "task", "task-sense", "verified");
assert(ov6a.rules[0].taskBindings[0]?.bindingStatus === "verified" && ov6a.rules[0].reviewStatus === "verified", "Task binding review must update rule status");
ov6a = addOv6aRule(ov6a, { name: "窗口约束" });
assert(ov6a.rules.length === 2 && ov6a.rules[1].reviewLabel === "待校验", "New rule starts unbound/待校验");
const emptiedRules = clearOv6aRules({
  ...ov6a,
  ruleChangeSet: { source: "phase-action", changes: [{ action: "add", rule: { name: "建议规则" }, status: "pending" }] }
});
assert(emptiedRules.rules.length === 0 && !emptiedRules.ruleChangeSet, "clearOv6aRules must drop rules and pending change set");

const htmlA = renderOv6a({
  ...state,
  ov6a,
  activeView: "ov6a",
  ruleLibraryChat: { messages: [{ id: "m1", role: "assistant", text: "欢迎", topic: "welcome", source: "local" }] },
  ruleLibraryChatOpen: true,
  ruleLibraryChatGenerating: false
});
assert(htmlA.includes("rule-library-page") && htmlA.includes("rule-form-board"), "Rule library form board missing");
assert(htmlA.includes("rule-library-workbench") && htmlA.includes("rule-chat-dock"), "Rule library workbench/chat dock missing");
assert(htmlA.includes("rule-library-bar") && htmlA.includes("rule-library-identity"), "Compact rule library header missing");
assert(htmlA.includes("research-chat-panel") || htmlA.includes("rule-review-chat"), "Rule library must reuse researchChat panel");
assert(htmlA.includes("ov6a-add-rule") && htmlA.includes("ov6a-delete-rule") && htmlA.includes("data-dodaf-field"), "Rule form CRUD controls missing");
assert(htmlA.includes("ov6a-clear-all") && htmlA.includes("清空全部"), "Rule library must expose one-click clear-all");
assert(htmlA.includes("close-rule-library-chat"), "Rule library chat close missing when open");
assert(htmlA.includes("ov6a-toggle-object-binding") && htmlA.includes("ov6a-set-object-binding-status"), "Rule library must expose lightweight task/force binding review controls");
const htmlFocusedRule = renderOv6a({
  ...state,
  ov6a,
  activeView: "ov6a",
  relatedModelReturnContext: { mainViewId: "operational-task", relatedViewId: "ov6a", focusType: "task", focusId: "task-sense" }
});
assert(htmlFocusedRule.includes("当前对象") && htmlFocusedRule.includes("态势保障任务"), "Task entry context must open and focus the source task binding");
assert(!htmlFocusedRule.includes("链路保障组"), "Task entry context must not mix unrelated force candidates into the binding editor");
// With rules: one footer add; no duplicate empty-state add cluster
assert((htmlA.match(/data-action="ov6a-add-rule"/g) || []).length === 1, "With rules, only one add-rule control expected");

// Empty: primary add in empty board only (no footer strip)
const htmlEmpty = renderOv6a({
  ...state,
  ov6a: normalizeDodafOv6a({ rules: [] }),
  activeView: "ov6a",
  ruleLibraryChatOpen: false
});
assert(htmlEmpty.includes("rule-form-empty") && htmlEmpty.includes("ov6a-add-rule"), "Empty board add missing");
assert(!htmlEmpty.includes("rule-form-footer"), "Empty board should not also show footer add");
assert(!htmlEmpty.includes("ov6a-clear-all"), "Empty rule library should hide clear-all");
assert(htmlEmpty.includes("rule-library-workbench") && htmlEmpty.includes("is-chat-collapsed"), "Closed chat workbench state missing");

// FAB host markup (topbar float, same shell as phase-action)
const fab = renderRuleLibraryChatFloatButton({ chatOpen: false });
assert(fab.includes("toggle-rule-library-chat") && fab.includes("research-chat-float"), "Rule library chat FAB missing");

let ov6b = addOv6bStateMachine({ stateMachines: [] }, { subjectType: "task", subjectRef: "p1", name: "感知任务机" });
ov6b = addOv6bStateMachine(ov6b, { subjectType: "force", subjectRef: "force-sense", name: "感知兵力机" });
ov6b = addOv6bState(ov6b, ov6b.stateMachines[0].id, { kind: "decision", name: "条件判定", decisionExpression: "链路是否可用" });
assert(ov6b.stateMachines.length === 2, "Should support multiple state machines");
assert(ov6b.stateMachines[0].states.some((item) => item.kind === "initial"), "New machine has initial state");
assert(ov6b.stateMachines[0].states.some((item) => item.kind === "decision"), "Decision state should persist in a state machine");
const decisionState = ov6b.stateMachines[0].states.find((item) => item.kind === "decision");
assert(decisionState.decisionExpression === "链路是否可用", "Decision expression should persist");
assert(ov6b.stateMachines[0].transitions.some((item) => item.toStateRef === decisionState.id), "Decision insertion must connect its upstream state");
assert(ov6b.stateMachines[0].transitions.some((item) => item.fromStateRef === decisionState.id), "Decision insertion must connect its downstream state");
const alternateTarget = ov6b.stateMachines[0].states.find((item) => item.kind === "normal");
const branched = addOv6bDecisionBranch(ov6b, ov6b.stateMachines[0].id, decisionState.id, {
  toStateRef: alternateTarget.id,
  branchResult: "不满足",
  condition: "链路连续中断"
});
assert(!branched._branchError && branched.stateMachines[0].transitions.some((item) => item.branchResult === "不满足"), "Decision branch shortcut should add a validated alternate branch");
const duplicateBranch = addOv6bDecisionBranch(branched, branched.stateMachines[0].id, decisionState.id, {
  toStateRef: alternateTarget.id,
  branchResult: "不满足",
  condition: "重复条件"
});
assert(duplicateBranch._branchError, "Decision branch shortcut should reject duplicate targets/results");
const editedCondition = updateOv6bTransition(branched, branched.stateMachines[0].id, branched.stateMachines[0].transitions.at(-1).id, {
  condition: "链路中断且无法恢复"
});
assert(editedCondition.stateMachines[0].transitions.at(-1).condition === "链路中断且无法恢复", "Transition condition edit should persist in the machine model");
const invalidTransitionEdit = updateOv6bTransition(branched, branched.stateMachines[0].id, branched.stateMachines[0].transitions[0].id, {
  toStateRef: branched.stateMachines[0].transitions[0].fromStateRef
});
assert(invalidTransitionEdit._transitionError, "Transition editor should reject self-links");
const htmlB = renderOv6b({ ...state, ov6b, activeView: "ov6b", ov6bSelectedMachineId: ov6b.stateMachines[0].id });
assert(htmlB.includes("sm-page") && htmlB.includes("sm-canvas-panel") && htmlB.includes("sm-flow-canvas"), "State machine flowchart canvas missing");
assert(htmlB.includes("ov6b-clear-all") && htmlB.includes("清空全部"), "State-machine workbench must expose one-click clear-all");
assert(htmlB.includes("sm-canvas-head") && htmlB.includes("data-sm-canvas-fit") && !htmlB.includes("sm-flow-caption"), "Canvas chrome must sit outside the drawing surface");
assert(htmlB.includes("sm-editor-dock") && htmlB.includes("sm-chat-dock"), "State-machine workbench must host property and chat docks");
assert(!htmlB.includes("sm-editor-dock is-open") && !htmlB.includes("sm-edit-rail"), "Toolbox and property dock stay closed until opened from the top-right toolbox");
const fabSm = renderStateMachineToolboxFloatButton({ toolsOpen: false });
assert(fabSm.includes("toggle-ov6b-tools") && fabSm.includes("sm-toolbox-float"), "State-machine toolbox FAB missing");
const htmlTools = renderOv6b({ ...state, ov6b, activeView: "ov6b", ov6bSelectedMachineId: ov6b.stateMachines[0].id, ov6bToolsOpen: true });
assert(htmlTools.includes("sm-edit-rail") && htmlTools.includes("ov6b-toggle-editor") && htmlTools.includes("toggle-state-machine-chat"), "Docked toolbox must expose 状态/转换 and AI chat");
assert(htmlTools.includes('data-toolbox-scope="ov6b"'), "State-machine rail must use the shared toolbox shell");
assert(htmlTools.includes('data-sm-palette="state"') && htmlTools.includes('data-sm-palette="decision"') && htmlTools.includes('data-sm-palette="transition"') && htmlTools.includes('data-sm-palette="delete"'), "Toolbox rail must host add-state, decision, transition, and delete-machine tools");
assert(!htmlTools.includes("sm-editor-actions"), "Canvas header must not keep the old add/delete action buttons");
assert(!htmlTools.includes("ov6b-machine-field"), "Machine name/type/ref fields stay in the toolbox dock, not on the canvas");
const htmlOpen = renderOv6b({ ...state, ov6b, activeView: "ov6b", ov6bSelectedMachineId: ov6b.stateMachines[0].id, ov6bToolsOpen: true, ov6bEditorOpen: true });
assert(htmlOpen.includes("is-editor-open") && htmlOpen.includes("sm-editor-dock is-open") && htmlOpen.includes("ov6b-close-editor") && htmlOpen.includes('viewBox="0 0 16 16"'), "Opening 状态/转换 should slide the editors in from the right");
assert(htmlOpen.includes("ov6b-machine-field") && htmlOpen.includes("主体类型") && htmlOpen.includes("主体引用"), "Machine identity fields must live in the toolbox property dock");
assert(htmlOpen.includes("kind-decision") && htmlOpen.includes('data-sm-palette="decision"'), "Decision node visual and add control missing");
assert(htmlOpen.includes("ov6b-add-state") && htmlOpen.includes("ov6b-add-transition"), "State/transition edit actions missing");
assert(htmlOpen.includes("判定表达式"), "Decision expression editor missing");
assert(htmlOpen.includes("ov6b-add-decision-branch") && htmlOpen.includes("添加分支"), "Decision branch composer missing");
const htmlChat = renderOv6b({ ...state, ov6b, activeView: "ov6b", ov6bSelectedMachineId: ov6b.stateMachines[0].id, ov6bToolsOpen: true, stateMachineChatOpen: true, stateMachineChat: { messages: [{ id: "m1", role: "assistant", text: "欢迎", topic: "welcome", source: "local" }] } });
assert(htmlChat.includes("is-chat-open") && htmlChat.includes("research-chat-panel") && htmlChat.includes("close-state-machine-chat"), "Opening AI chat from the toolbox should slide the research chat in from the right");
assert(htmlB.includes("sm-flow-stage") && htmlB.includes("sm-flow-world") && htmlB.includes("data-ov1-port"), "Flow stage/world/ports missing");
assert(htmlB.includes("sm-flow-node") && !htmlB.includes("ov1-concept-entity"), "Must use flowchart nodes, not OV-1 text cards");
assert(htmlB.includes("感知任务机") && htmlB.includes("感知兵力机"), "Multi-machine list missing");
assert(htmlB.includes("kind-initial") && htmlB.includes("kind-final"), "State kind visuals missing");
assert(htmlB.includes("识别建模对象") || htmlB.includes("ov6b-seed-subjects"), "Modeling-subject discovery control missing");
assert(htmlB.includes("sm-diagnostic-strip") && htmlB.includes("ov6b-focus-finding"), "Actionable diagnostic strip missing");
assert((htmlB.match(/class="sm-flow-edge /g) || []).length >= 2, "State-machine transitions must render as visible canvas edges on first paint");
assert(!htmlB.includes('data-logical-x="12%"'), "First paint should use topology, not the stored seed coordinates");

const { routeSmFlowEdge } = await import("../design-studio/src/stateMachineFlowRouting.js");
const startBox = { center: { x: 18, y: 50 }, halfW: 3, halfH: 3 };
const midBox = { center: { x: 48, y: 50 }, halfW: 10, halfH: 5 };
const endBox = { center: { x: 80, y: 50 }, halfW: 3, halfH: 3 };
const routed = routeSmFlowEdge(startBox, endBox, { id: "skip-mid" }, [startBox, midBox, endBox]);
assert(routed?.path && !/L48 /.test(routed.path.replace(/L 48 /g, "L48 ")), "Forward edges must leave node ports instead of traveling through node centers");
assert(!segmentCrossesBox(routed.path, midBox), "Forward edges must detour around intervening nodes");
const back = routeSmFlowEdge(endBox, startBox, { id: "back" }, [startBox, midBox, endBox]);
assert(back?.backward && !segmentCrossesBox(back.path, midBox), "Return edges must use an outer lane and not cut through nodes");

function segmentCrossesBox(path, box) {
  const points = String(path || "").match(/-?\d+(?:\.\d+)?/g)?.reduce((list, value, index, all) => {
    if (index % 2 === 0) list.push({ x: Number(value), y: Number(all[index + 1]) });
    return list;
  }, []) || [];
  const left = box.center.x - box.halfW + 0.4;
  const right = box.center.x + box.halfW - 0.4;
  const top = box.center.y - box.halfH + 0.4;
  const bottom = box.center.y + box.halfH - 0.4;
  return points.slice(1).some((point, index) => {
    const prev = points[index];
    const minX = Math.min(prev.x, point.x);
    const maxX = Math.max(prev.x, point.x);
    const minY = Math.min(prev.y, point.y);
    const maxY = Math.max(prev.y, point.y);
    if (Math.abs(prev.y - point.y) < 0.2) return prev.y > top && prev.y < bottom && maxX > left && minX < right;
    if (Math.abs(prev.x - point.x) < 0.2) return prev.x > left && prev.x < right && maxY > top && minY < bottom;
    return false;
  });
}

const startState = ov6b.stateMachines[0].states.find((item) => item.kind === "initial");
const placed = updateOv6bCanvasLayout(ov6b, ov6b.stateMachines[0].id, {
  canvasLayout: "manual",
  positions: [{ id: startState.id, x: "28%", y: "66%" }]
});
assert(placed.stateMachines[0].canvasLayout === "manual", "Dragging a node must switch the machine to a persisted canvas layout");
assert(placed.stateMachines[0].states.find((item) => item.id === startState.id).x === "28%", "Dragged state x should persist");
assert(placed.stateMachines[0].states.find((item) => item.id === startState.id).y === "66%", "Dragged state y should persist");
const htmlPlaced = renderOv6b({ ...state, ov6b: placed, activeView: "ov6b", ov6bSelectedMachineId: placed.stateMachines[0].id });
assert(htmlPlaced.includes('data-logical-x="28%"') && htmlPlaced.includes('data-logical-y="66%"'), "Manual canvas positions must survive re-render instead of snapping back to topology");

const stateMachineAnalysis = buildStateMachineGenerationAnalysis(state);
assert(stateMachineAnalysis.phaseAction.phases[0].timeWindow === "T+00:00至T+00:40", "State-machine generation must carry phase time windows");
assert(stateMachineAnalysis.phaseAction.phases[0].redActions.includes("电子干扰"), "State-machine generation must carry red actions");
assert(stateMachineAnalysis.stateMachineSubjects.find((item) => item.id === "p1::action-1")?.timeWindow === "T+00:00至T+00:40", "Phase-machine candidates must inherit the phase time window");
assert(stateMachineAnalysis.stateMachineSubjects.find((item) => item.id === "p1::action-1")?.redActions.includes("电子干扰"), "Phase-machine candidates must inherit red actions as context");
const stateMachineFallback = generateMockOutput({
  workflow: { id: "state-machine", title: "阶段行动状态机分析", outputSchema: "StateMachineDraft" },
  analysis: stateMachineAnalysis,
  evidence: []
}).result;
const generatedMachines = applyStateMachineDraft(stateMachineFallback, stateMachineAnalysis);
assert(generatedMachines.stateMachines.length === machineSubjects.length, "First generation must create one machine per modeling candidate");
assert(generatedMachines.stateMachines.some((machine) => machine.subjectType === "force"), "Persistent object candidates must preserve their subject type");
assert(generatedMachines.stateMachines.some((machine) => machine.subjectType === "phase"), "Phase-action candidates must be classified as 阶段机");
assert(generatedMachines.stateMachines.filter((machine) => String(machine.subjectRef || "").includes("::action-")).every((machine) => machine.subjectType === "phase"), "Every phase-action generated machine must be a 阶段机");
assert(htmlB.includes("阶段机") && htmlB.includes('data-subject-type="phase"'), "Workbench must expose the 阶段机 category");
assert(normalizeDodafOv6b({
  stateMachines: [{ id: "legacy-phase", subjectRef: "p1::action-1", subjectType: "task", name: "汇聚态势状态机", states: [{ id: "a", name: "开始", kind: "initial" }, { id: "b", name: "执行", kind: "normal" }, { id: "c", name: "结束", kind: "final" }], transitions: [] }]
}).stateMachines[0].subjectType === "phase", "Persisted phase-action machines labeled as 任务机 must remap to 阶段机");
assert(generatedMachines.stateMachines.every((machine) => !state.phaseAction.phases.some((phase) => phase.id === machine.subjectRef)), "Generated machines must not bind directly to phase containers");
assert(generatedMachines.stateMachines.every((machine) => machine.states.some((item) => item.kind === "initial") && machine.states.some((item) => item.kind === "final")), "Generated machines need entry and exit states");
assert(generatedMachines.stateMachines.every((machine) => machine.transitions.length >= 2), "Generated machines need observable state transitions");
assert(generatedMachines.stateMachines.every((machine) => machine.states.length >= 5), "Generated machines need meaningful intermediate lifecycle states");
assert(generatedMachines.stateMachines.every((machine) => machine.states.filter((item) => item.kind === "normal").length >= 3), "Generated machines must not collapse to one generic in-progress state");

const sparseDraft = applyStateMachineDraft({
  stateMachines: stateMachineAnalysis.stateMachineSubjects.map((subject) => ({
    subjectRef: subject.id,
    subjectType: subject.subjectType,
    states: [
      { id: "start", name: "开始", kind: "initial" },
      { id: "working", name: "进行中", kind: "normal" },
      { id: "end", name: "结束", kind: "final" }
    ],
    transitions: [
      { id: "t1", fromStateRef: "start", toStateRef: "working", condition: "启动" },
      { id: "t2", fromStateRef: "working", toStateRef: "end", condition: "完成" }
    ]
  }))
}, stateMachineAnalysis);
assert(sparseDraft.stateMachines.every((machine) => machine.states.length === 5), "Sparse AI drafts should be expanded into a complete lifecycle");
assert(sparseDraft.stateMachines.every((machine) => !machine.states.some((item) => item.name === "进行中")), "Generic AI placeholders should not survive draft normalization");
assert(sparseDraft.stateMachines.every((machine) => machine.transitions.length === 4), "Expanded lifecycle should have a connected main path");

const invalidDecision = normalizeDodafOv6b({
  stateMachines: [{
    id: "decision-machine", subjectRef: "task-1", subjectType: "task", name: "判定诊断",
    states: [
      { id: "start", name: "开始", kind: "initial" },
      { id: "decision", name: "是否继续", kind: "decision", decisionExpression: "链路是否可用" },
      { id: "end", name: "结束", kind: "final" }
    ],
    transitions: [
      { id: "t1", fromStateRef: "start", toStateRef: "decision", condition: "进入判定" },
      { id: "t2", fromStateRef: "decision", toStateRef: "end", condition: "TBD", branchResult: "满足" }
    ]
  }]
});
assert(invalidDecision.stateMachines[0].transitions[1].branchResult === "满足", "Decision branch result should persist");
const decisionIssues = diagnoseOv6bMachineLocal(invalidDecision.stateMachines[0]).issues.join("；");
assert(decisionIssues.includes("至少需要两个分支") && decisionIssues.includes("缺少可观察条件"), "Decision and transition diagnostics should flag incomplete semantics");
assert(diagnoseOv6bMachineLocal(invalidDecision.stateMachines[0]).findings.some((item) => item.transitionId === "t2"), "Transition diagnostics should carry a focus target");

const clearedMachines = normalizeDodafOv6b({
  stateMachines: [],
  // Flat aliases can remain in a cloned prior model; they must not revive a deleted machine.
  states: [{ id: "old-start", name: "开始", kind: "initial" }],
  transitions: []
});
assert(clearedMachines.stateMachines.length === 0, "Explicitly cleared state machines must not revive as a legacy chain");
const emptiedMachines = clearOv6bStateMachines(invalidDecision);
assert(emptiedMachines.stateMachines.length === 0, "clearOv6bStateMachines must drop every machine");
const migratedLegacyMachine = normalizeDodafOv6b({
  states: [{ id: "legacy-start", name: "开始", kind: "initial" }, { id: "legacy-end", name: "结束", kind: "final" }],
  transitions: [{ id: "legacy-t", sourceId: "legacy-start", targetId: "legacy-end", condition: "完成" }]
});
assert(migratedLegacyMachine.stateMachines.length === 1, "Legacy flat models must remain readable");

let ov6c = addOv6cSequence({ sequences: [] }, { name: "协同序列", diagramType: "force" });
ov6c = addOv6cMessage(ov6c, ov6c.sequences[0].id, { name: "态势上报", relatedActivityRefs: [] });
assert(ov6c.sequences[0].messages.length === 1, "Sequence message add failed");
assert(ov6c.sequences[0].diagramType === "force", "Sequence diagram type should be retained");
const htmlC = renderOv6c({
  ...state,
  ov6c,
  activeView: "ov6c",
  ov6cStorage: {},
  ov6cDiagramEngine: "workbench",
  ov6cSelectedSequenceId: ov6c.sequences[0].id,
  ov6cSelectedMessageId: ov6c.sequences[0].messages[0].id,
  ov6cEditorOpen: true,
  ov6cToolsOpen: true,
  sequenceChatOpen: true,
  sequenceChat: { messages: [{ id: "m1", role: "assistant", text: "欢迎", topic: "welcome", source: "local" }] }
});
assert(htmlC.includes("seq-page") && htmlC.includes("seq-workbench"), "Sequence workbench shell missing");
assert(htmlC.includes("ov6c-canvas") && htmlC.includes("seq-gantt") && htmlC.includes("is-interactive") && htmlC.includes("态势上报"), "Interactive sequence canvas missing");
assert(htmlC.includes("seq-message-name-input") && htmlC.includes("ov6c-move-message"), "Message edit controls missing");
assert(htmlC.includes("seq-participant-panel") && htmlC.includes("ov6c-participant-field"), "Participant dock controls missing");
assert(htmlC.includes('data-ref-type="task"') && htmlC.includes('data-ref-type="force"') && !htmlC.includes('placeholder="对象引用"'), "Participant references must use typed source selectors instead of free text");
assert(htmlC.includes("ov6c-sequence-field") && htmlC.includes("兵力作战时序图"), "Sequence type selector missing");
assert(!htmlC.includes("seq-participant-strip") && !htmlC.includes("ov6c-connect-pick"), "Participant controls should not occupy the timeline canvas");
assert(htmlC.includes("seq-gantt-bar") && htmlC.includes("offsetMinutes") && htmlC.includes("甘特图"), "Gantt timeline chrome missing");
assert(htmlC.includes("ov6c-adjust-message-time") && htmlC.includes("ov6c-duplicate-message"), "Gantt quick edit controls missing");
assert(htmlC.includes("seq-engine-tab") && htmlC.includes("Mermaid") && htmlC.includes("UML 序列"), "Open-source engine tabs missing");
assert(htmlC.includes("sequenceDiagram") || htmlC.includes("data-engine=\"mermaid\""), "Mermaid DSL export missing");
assert(htmlC.includes("research-chat-panel") || htmlC.includes("seq-review-chat"), "Sequence chat panel missing when open");
assert(htmlC.includes("close-sequence-chat"), "Sequence chat close missing when open");
assert(htmlC.includes("时序工具箱") && htmlC.includes("ov6c-toggle-editor"), "Sequence toolbox rail missing");
assert(htmlC.includes("ov6c-clear-all") && htmlC.includes("清空全部"), "Sequence workbench must expose one-click clear-all");
assert(!htmlC.includes("<th>时序图</th>") && !htmlC.includes("产品诊断</h3>"), "Legacy full events table / heavy diagnostics block should be removed");
const fabSeq = renderSequenceToolboxFloatButton({ toolsOpen: false });
assert(fabSeq.includes("toggle-ov6c-tools") && fabSeq.includes("seq-toolbox-float"), "Sequence toolbox FAB missing");

const mermaid = sequenceToMermaid(ov6c.sequences[0]);
const jsSeq = sequenceToJsSequence(ov6c.sequences[0]);
const plant = sequenceToPlantUml(ov6c.sequences[0]);
assert(mermaid.includes("sequenceDiagram") && mermaid.includes("态势上报"), "Mermaid conversion failed");
assert(jsSeq.includes("->") && jsSeq.includes("态势上报"), "js-sequence conversion failed");
assert(plant.includes("@startuml") && plant.includes("态势上报"), "PlantUML conversion failed");

const htmlUml = renderOv6c({
  ...state,
  ov6c,
  activeView: "ov6c",
  ov6cStorage: {},
  ov6cDiagramEngine: "js-sequence",
  ov6cSelectedSequenceId: ov6c.sequences[0].id
});
assert(htmlUml.includes("is-interactive") && htmlUml.includes("seq-gantt") && htmlUml.includes("seq-gantt-bar"), "UML mode must keep interactive canvas");
assert(htmlUml.includes("data-seq-dsl-editor") && htmlUml.includes("ov6c-apply-dsl"), "UML DSL editor missing");
assert(htmlUml.includes("UML") || htmlUml.includes("js-sequence"), "UML engine tools missing");

const parsedUml = parseJsSequenceDsl(`title 协同
participant 指挥 as cmd
participant 行动 as force
cmd->force: 态势上报
cmd-->force: 确认`);
assert(parsedUml.participants.length === 2 && parsedUml.messages.length === 2, "UML DSL parse failed");
assert(parsedUml.messages[0].name === "态势上报" && parsedUml.messages[1].type === "response", "UML arrow types failed");
const merged = mergeParsedSequence(ov6c.sequences[0], parsedUml);
assert(merged.messages[0].name === "态势上报", "UML merge failed");
const parsedMmd = parseMermaidSequenceDsl(`sequenceDiagram
  participant cmd as 指挥
  participant force as 行动
  cmd->>force: 授权`);
assert(parsedMmd.messages[0].name === "授权", "Mermaid DSL parse failed");

const gantt = layoutSequenceGantt({
  messages: [
    { id: "g1", sequence: 1, name: "发射", type: "message", offsetMinutes: 0, durationMinutes: 15 },
    { id: "g2", sequence: 2, name: "过顶", type: "status", offsetMinutes: 14, durationMinutes: 0 },
    { id: "g3", sequence: 3, name: "压制", type: "exception", offsetMinutes: 22, durationMinutes: 40 }
  ]
});
assert(gantt.rows[0].start === 0 && gantt.rows[2].end === 62, "Gantt layout should place bars by offset/duration");
assert(gantt.totalMinutes >= 60 && formatSequenceClock(15) === "00:15", "Gantt window and clock format failed");
assert(new Set(gantt.rows.map((row) => row.color)).size === 1, "Gantt bars should use one neutral color instead of strict type colors");
assert(!htmlC.includes("seq-legend-item"), "Sequence canvas should not render a strict message-type color legend");
const copied = duplicateOv6cMessage(ov6c, ov6c.sequences[0].id, ov6c.sequences[0].messages[0].id);
assert(copied.sequences[0].messages.length === 2 && copied.sequences[0].messages[1].name.includes("副本"), "Sequence message duplicate failed");

const seeded = seedOv6cFromPhase({ sequences: [] }, state);
assert((seeded.sequences || []).length === state.phaseAction.phases.length, "Sequence seed must create one diagram per phase");
assert(seeded.sequences.filter((item) => item.diagramType === "force").length === 0, "Phase sequence seed must not contain force diagrams");
assert(seeded.sequences.filter((item) => item.diagramType === "phase").length === state.phaseAction.phases.length, "Every phase must receive its own sequence diagram");
assert(seeded.sequences.every((item) => (item.messages || []).length >= 1), "Every required sequence must contain messages");
const sequenceAnalysis = buildSequenceGenerationAnalysis(state);
assert(sequenceAnalysis.requiredSequenceCoverage.phaseSequences.length === 2, "AI sequence analysis must explicitly require phase coverage");
const completedCoverage = ensureRequiredSequenceCoverage({ sequences: [seeded.sequences[0]] }, state, sequenceAnalysis);
assert(completedCoverage.sequences.length === 2, "AI sequence output must be supplemented when required phase diagrams are missing");

const generatedSequence = generateMockOutput({
  workflow: { id: "sequence-check", title: "时序校验", outputSchema: "SequenceDraft" },
  analysis: { phases: state.phaseAction.phases, forces: state.forceMission.forces },
  evidence: []
});
assert(generatedSequence.result.sequences[0].participants.some((item) => item.refType === "force" && item.ref === "force-sense"), "Local SequenceDraft generation must emit typed force refs");
const generatedPhaseSequence = generateMockOutput({
  workflow: { id: "sequence-check", title: "时序校验", outputSchema: "SequenceDraft" },
  analysis: { phases: state.phaseAction.phases, forces: [] },
  evidence: []
});
assert(generatedPhaseSequence.result.sequences[0].participants.some((item) => item.refType === "phase" && item.ref === "p1"), "Local SequenceDraft generation must emit typed phase refs");

const appliedSequence = applySequenceDraft({ sequences: [] }, {
  sequences: [{
    id: "typed-sequence", name: "稳定引用时序", diagramType: "task",
    participants: [
      { id: "task-line", name: "态势保障任务", refType: "task", ref: "task-sense" },
      { id: "invalid-line", name: "未知对象", refType: "invented", ref: "unknown-ref" }
    ],
    messages: [{ id: "typed-message", fromRef: "task-line", toRef: "missing-line", name: "协同", type: "message", condition: "", relatedActivityRefs: [] }]
  }]
}, { mutation: true });
assert(appliedSequence.model.sequences[0].participants.find((item) => item.id === "task-line")?.refType === "task", "AI sequence application must preserve valid typed refs");
assert(appliedSequence.model.sequences[0].participants.find((item) => item.id === "invalid-line")?.refType === "", "AI sequence application must reject unknown ref types");
assert(appliedSequence.model.sequences[0].participants.find((item) => item.id === "missing-line")?.refType === "", "Synthetic participant rows must not invent source types");

let leftover = addOv6cSequence({ sequences: [] }, { name: "待删序列" });
leftover = addOv6cMessage(leftover, leftover.sequences[0].id, { name: "待删消息" });
const clearedLast = removeOv6cSequence(leftover, leftover.sequences[0].id);
assert(clearedLast.sequences.length === 0, "Deleting the last sequence must not leave a revived leftover");
assert(clearedLast.events.length === 0, "Deleting the last sequence must clear flattened events");
const emptiedSequences = clearOv6cSequences(leftover);
assert(emptiedSequences.sequences.length === 0 && emptiedSequences.events.length === 0, "clearOv6cSequences must drop every sequence and leftover event");

const findings = inspectPhaseAgainstOv6({
  ...state,
  ov6a: normalizeDodafOv6a({ rules: [{ id: "r1", name: "仅一条", description: "x" }] }),
  ov6b: addOv6bStateMachine({ stateMachines: [] }, {
    subjectType: "task",
    subjectRef: "other",
    name: "无出口机"
  }),
  ov6c
});
// Force no-exit: remove transitions to final by replacing with incomplete machine
const broken = {
  ...state,
  ov6a: normalizeDodafOv6a({ rules: [{ id: "r1", name: "仅一条", description: "x" }] }),
  ov6b: {
    stateMachines: [{
      id: "sm-broken",
      subjectRef: "p1",
      subjectType: "task",
      name: "无出口",
      states: [
        { id: "s1", name: "开始", kind: "initial" },
        { id: "s2", name: "中", kind: "normal" }
      ],
      transitions: [{ id: "t1", fromStateRef: "s1", toStateRef: "s2", condition: "go" }]
    }]
  },
  ov6c
};
const reverse = inspectPhaseAgainstOv6(broken);
assert(reverse.some((item) => item.code === "phase-activity-without-rule"), "Reverse check should flag unbound critical activities");
assert(reverse.some((item) => item.code === "state-machine-no-exit"), "Reverse check should flag machines without final exit");
assert(reverse.some((item) => item.code === "sequence-message-without-activity"), "Reverse check should flag messages without activity source");

const review = buildStructureReview(broken);
assert(review.issues.some((item) => item.code === "phase-activity-without-rule"), "Structure review should surface reverse-check issues");
assert(review.issues.some((item) => item.code === "sequence-message-without-activity"), "Structure review should surface message source issues");

const productControllerSource = await readFile(new URL("../design-studio/src/dodafProductController.js", import.meta.url), "utf8");
assert(productControllerSource.includes('action === "ov6a-toggle-object-binding"') && productControllerSource.includes("toggleOv6aObjectBinding"), "Controller must persist task/force binding toggles");
assert(productControllerSource.includes("selectedOptions?.[0]?.dataset?.refType") && productControllerSource.includes("patch.refType"), "Controller must persist typed sequence participant refs");
assert(productControllerSource.includes("requiredSequenceCoverage") && productControllerSource.includes("generateWithAiStream") && productControllerSource.includes("ensureRequiredSequenceCoverage"), "State-machine next must use AI and enforce side plus per-phase sequence coverage");
const sequenceChatSource = await readFile(new URL("../design-studio/src/sequenceChatController.js", import.meta.url), "utf8");
assert(sequenceChatSource.includes("refType: item.refType") && sequenceChatSource.includes("refType: subject.subjectType") && sequenceChatSource.includes("compactTasks(state.forceMission)"), "Sequence chat must carry typed refs through prompt compaction and local drafts");
const openAiClientSource = await readFile(new URL("../server/openaiClient.mjs", import.meta.url), "utf8");
assert(openAiClientSource.includes("? sequenceDraftSchema()") && openAiClientSource.includes('required: ["id", "name", "refType", "ref"]') && openAiClientSource.includes("不得根据名称猜测"), "Real AI SequenceDraft must enforce typed stable refs in schema and instructions");
assert(openAiClientSource.includes("每个推演方分别生成一幅") && openAiClientSource.includes("每个 phaseId 分别生成一幅"), "Real AI prompt must require separate side and per-phase sequence diagrams");

console.log("OV-6 workbench acceptance passed: binding editor, multi machines, sequence canvas, reverse checks.");
