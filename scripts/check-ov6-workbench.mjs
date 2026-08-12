import {
  addOv6aRule,
  addOv6bStateMachine,
  addOv6bState,
  addOv6cMessage,
  addOv6cSequence,
  inspectPhaseAgainstOv6,
  listActivityCandidates,
  listStateMachineSubjects,
  diagnoseOv6bMachineLocal,
  seedOv6cFromPhase,
  setOv6aBindingStatus,
  toggleOv6aActivityBinding
} from "../design-studio/src/ov6Workbench.js";
import { applyStateMachineDraft, buildStateMachineGenerationAnalysis } from "../design-studio/src/dodafProductController.js";
import { generateMockOutput } from "../shared/generator.js";
import { renderOv6a, renderOv6b } from "../design-studio/src/dodafOperationalViews.js";
import { renderOv6c, renderSequenceChatFloatButton } from "../design-studio/src/ov6cView.js";
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
        blueActions: ["汇聚态势", "识别目标"],
        primaryActions: ["汇聚态势", "识别目标"]
      },
      {
        id: "p2",
        name: "行动",
        blueActions: ["主方向实施"],
        primaryActions: ["主方向实施"]
      }
    ]
  },
  ov5: {
    activities: [{ id: "a1", title: "协同决策", type: "决策" }],
    edges: []
  },
  forceMission: {
    forces: [{ id: "force-sense", name: "感知单元", role: "sense", task: "持续汇聚态势" }]
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
assert(!machineSubjects.some((item) => item.id === "p1" || item.id === "p2"), "Phase containers must not automatically become state-machine subjects");

let ov6a = state.ov6a;
ov6a = toggleOv6aActivityBinding(ov6a, "rule-1", "p1::action-1", { checked: true, status: "pending" });
assert(ov6a.rules[0].activityBindings[0]?.activityRef === "p1::action-1", "Toggle binding should add activity");
ov6a = setOv6aBindingStatus(ov6a, "rule-1", "p1::action-1", "verified");
assert(ov6a.rules[0].reviewStatus === "verified", "Verified binding should update review status");
ov6a = addOv6aRule(ov6a, { name: "窗口约束" });
assert(ov6a.rules.length === 2 && ov6a.rules[1].reviewLabel === "待校验", "New rule starts unbound/待校验");

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
assert(htmlA.includes("close-rule-library-chat"), "Rule library chat close missing when open");
assert(!htmlA.includes("ov6a-toggle-binding") && !htmlA.includes("ov6a-set-binding-status"), "Rule library must not offer binding controls");
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
const htmlB = renderOv6b({ ...state, ov6b, activeView: "ov6b", ov6bSelectedMachineId: ov6b.stateMachines[0].id });
assert(htmlB.includes("sm-page") && htmlB.includes("sm-canvas-panel") && htmlB.includes("sm-flow-canvas"), "State machine flowchart canvas missing");
assert(htmlB.includes("sm-flow-stage") && htmlB.includes("sm-flow-world") && htmlB.includes("data-ov1-port"), "Flow stage/world/ports missing");
assert(htmlB.includes("sm-flow-node") && !htmlB.includes("ov1-concept-entity"), "Must use flowchart nodes, not OV-1 text cards");
assert(htmlB.includes("感知任务机") && htmlB.includes("感知兵力机"), "Multi-machine list missing");
assert(htmlB.includes("kind-initial") && htmlB.includes("kind-final"), "State kind visuals missing");
assert(htmlB.includes("kind-decision") && htmlB.includes("加判定框"), "Decision node visual and add control missing");
assert(htmlB.includes("ov6b-add-state") && htmlB.includes("ov6b-add-transition"), "State/transition edit actions missing");
assert(htmlB.includes("识别建模对象") || htmlB.includes("ov6b-seed-subjects"), "Modeling-subject discovery control missing");
assert(htmlB.includes("判定表达式"), "Decision expression editor missing");
assert((htmlB.match(/class="sm-flow-edge /g) || []).length >= 2, "State-machine transitions must render as visible canvas edges on first paint");

const stateMachineAnalysis = buildStateMachineGenerationAnalysis(state);
const stateMachineFallback = generateMockOutput({
  workflow: { id: "state-machine", title: "阶段行动状态机分析", outputSchema: "StateMachineDraft" },
  analysis: stateMachineAnalysis,
  evidence: []
}).result;
const generatedMachines = applyStateMachineDraft(stateMachineFallback, stateMachineAnalysis);
assert(generatedMachines.stateMachines.length === machineSubjects.length, "First generation must create one machine per modeling candidate");
assert(generatedMachines.stateMachines.some((machine) => machine.subjectType === "force"), "Persistent object candidates must preserve their subject type");
assert(generatedMachines.stateMachines.every((machine) => !state.phaseAction.phases.some((phase) => phase.id === machine.subjectRef)), "Generated machines must not bind directly to phase containers");
assert(generatedMachines.stateMachines.every((machine) => machine.states.some((item) => item.kind === "initial") && machine.states.some((item) => item.kind === "final")), "Generated machines need entry and exit states");
assert(generatedMachines.stateMachines.every((machine) => machine.transitions.length >= 2), "Generated machines need observable state transitions");

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

const clearedMachines = normalizeDodafOv6b({
  stateMachines: [],
  // Flat aliases can remain in a cloned prior model; they must not revive a deleted machine.
  states: [{ id: "old-start", name: "开始", kind: "initial" }],
  transitions: []
});
assert(clearedMachines.stateMachines.length === 0, "Explicitly cleared state machines must not revive as a legacy chain");
const migratedLegacyMachine = normalizeDodafOv6b({
  states: [{ id: "legacy-start", name: "开始", kind: "initial" }, { id: "legacy-end", name: "结束", kind: "final" }],
  transitions: [{ id: "legacy-t", sourceId: "legacy-start", targetId: "legacy-end", condition: "完成" }]
});
assert(migratedLegacyMachine.stateMachines.length === 1, "Legacy flat models must remain readable");

let ov6c = addOv6cSequence({ sequences: [] }, { name: "协同序列" });
ov6c = addOv6cMessage(ov6c, ov6c.sequences[0].id, { name: "态势上报", relatedActivityRefs: [] });
assert(ov6c.sequences[0].messages.length === 1, "Sequence message add failed");
const htmlC = renderOv6c({
  ...state,
  ov6c,
  activeView: "ov6c",
  ov6cStorage: {},
  ov6cDiagramEngine: "workbench",
  ov6cSelectedSequenceId: ov6c.sequences[0].id,
  ov6cSelectedMessageId: ov6c.sequences[0].messages[0].id,
  sequenceChatOpen: true,
  sequenceChat: { messages: [{ id: "m1", role: "assistant", text: "欢迎", topic: "welcome", source: "local" }] }
});
assert(htmlC.includes("seq-page") && htmlC.includes("seq-workbench"), "Sequence workbench shell missing");
assert(htmlC.includes("ov6c-canvas") && htmlC.includes("is-interactive") && htmlC.includes("态势上报"), "Interactive sequence canvas missing");
assert(htmlC.includes("seq-message-name-input") && htmlC.includes("ov6c-connect-pick"), "Canvas direct edit controls missing");
assert(htmlC.includes("ov6c-participant-field") && htmlC.includes("ov6c-move-message"), "Lifeline/message canvas mutators missing");
assert(htmlC.includes("seq-engine-tab") && htmlC.includes("Mermaid") && htmlC.includes("UML 序列"), "Open-source engine tabs missing");
assert(htmlC.includes("sequenceDiagram") || htmlC.includes("data-engine=\"mermaid\""), "Mermaid DSL export missing");
assert(htmlC.includes("research-chat-panel") || htmlC.includes("seq-review-chat"), "Sequence chat panel missing when open");
assert(htmlC.includes("close-sequence-chat"), "Sequence chat close missing when open");
assert(!htmlC.includes("<th>时序图</th>") && !htmlC.includes("产品诊断</h3>"), "Legacy full events table / heavy diagnostics block should be removed");
const fabSeq = renderSequenceChatFloatButton({ chatOpen: false });
assert(fabSeq.includes("toggle-sequence-chat") && fabSeq.includes("research-chat-float"), "Sequence chat FAB missing");

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
assert(htmlUml.includes("is-interactive") && htmlUml.includes("seq-message-name-input"), "UML mode must keep interactive canvas");
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

const seeded = seedOv6cFromPhase({ sequences: [] }, state);
assert((seeded.sequences || []).length >= 1, "Phase seed should create a sequence");
assert((seeded.sequences[0].messages || []).length >= 1, "Phase seed should create messages");

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

console.log("OV-6 workbench acceptance passed: binding editor, multi machines, sequence canvas, reverse checks.");
