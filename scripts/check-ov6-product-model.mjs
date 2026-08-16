/**
 * OV-6a/b/c v2 product model: independent rules, multi state machines, sequence diagrams,
 * with legacy flat-shape compatibility.
 */
import {
  normalizeDodafOv6a,
  normalizeDodafOv6b,
  normalizeDodafOv6c,
  ov6aRuleReviewLabel,
  ov6aRuleReviewStatus
} from "../shared/dodaf/products.js";
import { normalizeOv6a, normalizeOv6b, normalizeOv6c } from "../server/projectModelNormalizers.mjs";
import { buildOv6aModel, buildOv6bModel } from "../design-studio/src/dodafOperationalBuilders.js";
import { renderOv6a, renderOv6b } from "../design-studio/src/dodafOperationalViews.js";
import { renderOv6c } from "../design-studio/src/ov6cView.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// --- OV-6a: independent rules; unbound = 待校验 ---
const unbound = normalizeDodafOv6a({
  rules: [
    { id: "rule-001", name: "链路可用", description: "关键通信链路可用", scope: "全局" }
  ]
});
assert(unbound.version === 2, "OV-6a should normalize to version 2");
assert(unbound.rules[0].name === "链路可用" && unbound.rules[0].description.includes("通信"), "OV-6a v2 rule fields missing");
assert(unbound.rules[0].activityBindings.length === 0, "Unbound rule must allow empty activityBindings");
assert(unbound.rules[0].phaseBindings.length === 0, "Global rule must allow empty phaseBindings");
assert(unbound.rules[0].reviewStatus === "pending-validation", "Unbound rule status must be pending-validation");
assert(unbound.rules[0].reviewLabel === "待校验", "Unbound rule label must be 待校验");
assert(ov6aRuleReviewStatus(unbound.rules[0]) === "pending-validation", "Helper status mismatch");
assert(ov6aRuleReviewLabel("pending-validation") === "待校验", "Helper label mismatch");
assert(unbound.rules[0].subject === "链路可用" && unbound.rules[0].text.includes("通信"), "Legacy aliases subject/text required for UI");
assert(unbound.diagnostics.some((item) => item.id === "bindings-pending"), "Unbound rules should surface 待校验 diagnostic");

const legacyRule = normalizeDodafOv6a({
  rules: [{ id: "r-legacy", subject: "感知", type: "前置条件", text: "公开证据已审查", activityId: "activity-007" }]
});
assert(legacyRule.rules[0].name === "感知", "Legacy subject maps to name");
assert(legacyRule.rules[0].activityBindings[0]?.activityRef === "activity-007", "Legacy activityId becomes binding");
assert(legacyRule.rules[0].activityBindings[0]?.bindingStatus === "pending", "Legacy binding starts pending");

const phaseBoundRule = normalizeDodafOv6a({ rules: [{
  id: "phase-rule", name: "阶段进入条件", description: "条件满足后进入", scope: "阶段：准备（phase-1）",
  phaseBindings: [{ phaseRef: "phase-1" }]
}] });
assert(phaseBoundRule.rules[0].phaseBindings[0]?.phaseRef === "phase-1", "Rule must preserve structured phase binding");
assert(phaseBoundRule.relations.some((relation) => relation.dm2Type === "appliesDuring" && relation.targetId === "phase-1"), "Phase binding must export as appliesDuring relation");

const verified = normalizeDodafOv6a({
  rules: [{
    id: "rule-002",
    name: "窗口约束",
    description: "仅在授权窗口行动",
    scope: "主方向",
    activityBindings: [{ activityRef: "activity-007", bindingStatus: "verified", constraintNote: "主行动受约束" }]
  }]
});
assert(verified.rules[0].reviewStatus === "verified" && verified.rules[0].reviewLabel === "已绑定", "Verified binding status");
assert(verified.relations.some((item) => item.targetId === "activity-007"), "Verified binding should emit relation");

// Seed builder still normalizes
const seededA = normalizeDodafOv6a(buildOv6aModel({
  ov5: {
    activities: [{ id: "a1", title: "侦察", preconditions: "链路可用", constraints: "时效 15 分钟" }],
    edges: [{ id: "e1", sourceId: "a1", targetId: "a1", condition: "完成" }]
  }
}));
assert(seededA.rules.length >= 2 && seededA.version === 2, "Builder seed must normalize to v2 rules");

const htmlA = renderOv6a(unbound);
assert(htmlA.includes("rule-library-page") && htmlA.includes("规则库") && htmlA.includes("rule-form-card"), "OV-6a UI must show form-based rule library");
assert(!htmlA.includes("ov6a-toggle-binding"), "Rule library form step must not expose binding controls");

// --- OV-6b: multiple state machines ---
const multi = normalizeDodafOv6b({
  stateMachines: [
    {
      id: "sm-task",
      subjectRef: "task-1",
      subjectType: "task",
      name: "封控任务状态",
      states: [
        { id: "start", name: "未启动", kind: "initial" },
        { id: "mid", name: "执行中", kind: "normal" },
        { id: "end", name: "完成", kind: "final" }
      ],
      transitions: [
        {
          id: "t1",
          fromStateRef: "start",
          toStateRef: "mid",
          condition: "授权下达",
          ruleRefs: ["rule-001"],
          eventRefs: ["event-001"]
        },
        { id: "t2", fromStateRef: "mid", toStateRef: "end", condition: "效果达成" }
      ]
    },
    {
      id: "sm-object",
      subjectRef: "obj-1",
      subjectType: "object",
      name: "通道对象状态",
      states: [
        { id: "o-start", name: "开放", kind: "initial" },
        { id: "o-mid", name: "受限", kind: "normal" },
        { id: "o-end", name: "关闭", kind: "final" }
      ],
      transitions: [
        { id: "ot1", fromStateRef: "o-start", toStateRef: "o-mid", condition: "进入封控" }
      ]
    }
  ]
});
assert(multi.version === 2 && multi.stateMachines.length === 2, "OV-6b must keep multiple state machines");
assert(multi.stateMachines[0].canvasLayout === "auto", "State machines default to automatic canvas layout");
const remappedPhase = normalizeDodafOv6b({
  stateMachines: [{
    id: "sm-phase",
    subjectRef: "p1::action-1",
    subjectType: "task",
    name: "汇聚态势状态机",
    states: [
      { id: "ps", name: "开始", kind: "initial" },
      { id: "pm", name: "执行", kind: "normal" },
      { id: "pe", name: "结束", kind: "final" }
    ],
    transitions: []
  }]
});
assert(remappedPhase.stateMachines[0].subjectType === "phase", "Phase-action subjectRef must normalize to 阶段机");
assert(multi.stateMachines[0].transitions[0].ruleRefs.includes("rule-001"), "Transitions keep ruleRefs");
assert(multi.states.length === 6 && multi.transitions.length >= 2, "Flat states/transitions retained for UI");
assert(multi.diagnostics.some((item) => item.id === "state-machines"), "Machine-level diagnostic present");

const legacyB = normalizeDodafOv6b({
  states: [
    { id: "s1", label: "A" },
    { id: "s2", label: "B" },
    { id: "s3", label: "C" }
  ],
  transitions: [
    { id: "tr1", sourceId: "s1", targetId: "s2", condition: "go" },
    { id: "tr2", sourceId: "s2", targetId: "s3", condition: "done" }
  ]
});
assert(legacyB.stateMachines.length === 1 && legacyB.stateMachines[0].id === "state-machine-legacy", "Flat legacy becomes one machine");
assert(legacyB.stateMachines[0].states[0].kind === "initial", "Legacy first state becomes initial");
assert(legacyB.stateMachines[0].states.at(-1).kind === "final", "Legacy last state becomes final");

const seededB = normalizeDodafOv6b(buildOv6bModel({
  ooda: {
    lanes: [
      { id: "observe", title: "Observe", subtitle: "观察", nodes: [{ id: "n1", title: "汇聚", rule: "多源" }, { id: "n2", title: "更新", rule: "刷新" }] },
      { id: "act", title: "Act", subtitle: "行动", nodes: [{ id: "n3", title: "实施", rule: "执行" }] }
    ]
  }
}));
assert(seededB.stateMachines.length === 1 && seededB.states.length >= 3, "OODA seed still normalizes");

const htmlB = renderOv6b({ ov6b: multi, activeView: "ov6b", ov6bSelectedMachineId: multi.stateMachines[0].id });
assert(
  (htmlB.includes("状态机") || htmlB.includes("sm-page"))
    && htmlB.includes("封控任务状态")
    && htmlB.includes("通道对象状态"),
  "OV-6b UI lists machines"
);

// --- OV-6c: sequence diagrams ---
const sequence = normalizeDodafOv6c({
  sequences: [{
    id: "sequence-001",
    name: "关键协同序列",
    participants: [
      { id: "p1", name: "感知单元", ref: "force-sense" },
      { id: "p2", name: "指挥节点", ref: "force-cmd" }
    ],
    messages: [
      {
        id: "event-001",
        sequence: 2,
        fromRef: "p1",
        toRef: "p2",
        name: "态势上报",
        type: "message",
        condition: "窗口打开",
        offsetMinutes: 12,
        durationMinutes: 18,
        relatedActivityRefs: ["activity-007"],
        ruleRefs: ["rule-001"],
        stateTransitionRefs: ["t1"]
      },
      {
        id: "event-002",
        sequence: 1,
        fromRef: "p2",
        toRef: "p1",
        name: "任务授权",
        type: "response"
      }
    ],
    fragments: [{ id: "frag-1", kind: "alt", label: "备选窗口", messageRefs: ["event-001"] }]
  }]
});
assert(sequence.version === 2 && sequence.sequences.length === 1, "OV-6c sequences present");
assert(sequence.sequences[0].messages[0].sequence === 1 && sequence.sequences[0].messages[0].name === "任务授权", "Messages re-sorted by sequence");
assert(sequence.sequences[0].messages[1].relatedActivityRefs.includes("activity-007"), "Message keeps activity links");
assert(sequence.sequences[0].messages[1].offsetMinutes === 12 && sequence.sequences[0].messages[1].durationMinutes === 18, "Message keeps gantt start/duration");
assert(sequence.events.length === 2 && sequence.events[0].title, "Flattened events for table UI");
assert(sequence.sequences[0].fragments[0].kind === "alt", "Fragments preserved");

const legacyC = normalizeDodafOv6c({
  events: [
    { id: "e1", sequence: 1, title: "旧事件", sourceNodeId: "node-a", sourceActivityId: "act-1", time: "T+0" }
  ]
});
assert(legacyC.sequences[0].id === "sequence-legacy", "Legacy events become one sequence");
assert(legacyC.events[0].title === "旧事件" && legacyC.sequences[0].participants.length >= 1, "Legacy participants inferred");

const clearedSequences = normalizeDodafOv6c({
  sequences: [],
  // Flat aliases can remain in a cloned prior model; they must not revive a deleted sequence.
  events: [{ id: "old-e1", sequence: 1, title: "旧事件", sourceNodeId: "node-a" }]
});
assert(clearedSequences.sequences.length === 0, "Explicitly cleared sequences must not revive as a legacy sequence");
assert(clearedSequences.events.length === 0, "Cleared sequences must not keep flattened leftover events");

const htmlC = renderOv6c({
  ov6c: sequence,
  ov6cStorage: { status: "ready", mode: "local", label: "事件序列" },
  activeView: "ov6c",
  ov6cSelectedSequenceId: "sequence-001",
  ov6cDiagramEngine: "workbench"
});
assert(
  (htmlC.includes("幅") || htmlC.includes("seq-page"))
    && htmlC.includes("关键协同序列")
    && htmlC.includes("生命线")
    && htmlC.includes("seq-gantt"),
  "OV-6c UI mentions sequence model"
);

// Server normalizers
const serverA = normalizeOv6a({ rules: [{ name: "独立规则", description: "无绑定" }] });
const serverB = normalizeOv6b({ stateMachines: multi.stateMachines });
const serverC = normalizeOv6c({ sequences: sequence.sequences });
assert(serverA.rules[0].reviewLabel === "待校验", "Server OV-6a path keeps 待校验");
assert(serverB.stateMachines.length === 2, "Server OV-6b path keeps multi machines");
assert(serverC.sequences[0].messages.length === 2, "Server OV-6c path keeps sequences");

// Round-trip
const roundA = normalizeDodafOv6a(JSON.parse(JSON.stringify(unbound)));
const roundB = normalizeDodafOv6b(JSON.parse(JSON.stringify(multi)));
const roundC = normalizeDodafOv6c(JSON.parse(JSON.stringify(sequence)));
assert(roundA.rules[0].id === "rule-001" && roundB.stateMachines[1].subjectType === "object" && roundC.sequences[0].fragments.length === 1, "JSON round-trip stable");

console.log("OV-6 product model acceptance passed: v2 rules/bindings, multi state machines, sequence diagrams, legacy compatibility.");
