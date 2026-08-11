import {
  addOv6aRule,
  addOv6bStateMachine,
  addOv6cMessage,
  addOv6cSequence,
  inspectPhaseAgainstOv6,
  listActivityCandidates,
  setOv6aBindingStatus,
  toggleOv6aActivityBinding
} from "../design-studio/src/ov6Workbench.js";
import { renderOv6a, renderOv6b } from "../design-studio/src/dodafOperationalViews.js";
import { renderOv6c } from "../design-studio/src/ov6cView.js";
import { renderRuleLibraryChatFloatButton } from "../design-studio/src/ruleLibraryView.js";
import { buildStructureReview } from "../design-studio/src/structureReviewBuilder.js";
import { normalizeDodafOv6a } from "../shared/dodaf/products.js";

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
    forces: [{ id: "force-sense", name: "感知单元" }]
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
assert(ov6b.stateMachines.length === 2, "Should support multiple state machines");
assert(ov6b.stateMachines[0].states.some((item) => item.kind === "initial"), "New machine has initial state");
const htmlB = renderOv6b({ ...state, ov6b, activeView: "ov6b" });
assert(htmlB.includes("新建任务状态机") && htmlB.includes("感知任务机") && htmlB.includes("感知兵力机"), "Multi-machine editor UI missing");

let ov6c = addOv6cSequence({ sequences: [] }, { name: "协同序列" });
ov6c = addOv6cMessage(ov6c, ov6c.sequences[0].id, { name: "态势上报", relatedActivityRefs: [] });
assert(ov6c.sequences[0].messages.length === 1, "Sequence message add failed");
const htmlC = renderOv6c({ ...state, ov6c, activeView: "ov6c", ov6cStorage: {} });
assert(htmlC.includes("ov6c-canvas") && htmlC.includes("ov6c-lifeline") && htmlC.includes("态势上报"), "Sequence canvas UI missing");

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
