/**
 * OV-6 research workbench helpers: rule bindings, multi state machines, sequence diagrams.
 * Resource keys remain ov6a/ov6b/ov6c; UI copy avoids OV branding.
 */

import { normalizeDodafOv6a, normalizeDodafOv6b, normalizeDodafOv6c } from "../../shared/dodaf/products.js";

const BINDING_STATUSES = ["pending", "verified", "rejected", "stale"];

export function listActivityCandidates(state = {}) {
  const items = [];
  const seen = new Set();
  const push = (id, title, source, phaseId = "") => {
    const key = String(id || "").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    items.push({
      id: key,
      title: String(title || key).trim() || key,
      source,
      phaseId: String(phaseId || "")
    });
  };

  const phases = Array.isArray(state.phaseAction?.phases) ? state.phaseAction.phases : [];
  phases.forEach((phase, phaseIndex) => {
    const phaseId = String(phase?.id || `phase-${phaseIndex + 1}`);
    const phaseName = String(phase?.name || phaseId).trim() || phaseId;
    push(phaseId, `阶段：${phaseName}`, "phase", phaseId);
    const actions = [
      ...(Array.isArray(phase?.blueActions) ? phase.blueActions : []),
      ...(Array.isArray(phase?.primaryActions) ? phase.primaryActions : []),
      ...(Array.isArray(phase?.secondaryActions) ? phase.secondaryActions : [])
    ];
    actions.forEach((action, actionIndex) => {
      const text = String(action || "").trim();
      if (!text) return;
      const id = `${phaseId}::action-${actionIndex + 1}`;
      push(id, `${phaseName} · ${text}`, "phase-action", phaseId);
    });
  });

  const activities = Array.isArray(state.ov5?.activities) ? state.ov5.activities : [];
  activities.forEach((activity, index) => {
    push(activity?.id || `activity-${index + 1}`, activity?.title || activity?.id || `活动 ${index + 1}`, "ov5");
  });

  return items.slice(0, 120);
}

export function listCriticalActivityIds(state = {}) {
  const phases = Array.isArray(state.phaseAction?.phases) ? state.phaseAction.phases : [];
  const ids = [];
  phases.forEach((phase, phaseIndex) => {
    const phaseId = String(phase?.id || `phase-${phaseIndex + 1}`);
    const actions = [
      ...(Array.isArray(phase?.blueActions) ? phase.blueActions : []),
      ...(Array.isArray(phase?.primaryActions) ? phase.primaryActions : [])
    ].filter(Boolean);
    if (!actions.length) ids.push(phaseId);
    actions.forEach((action, actionIndex) => {
      ids.push(`${phaseId}::action-${actionIndex + 1}`);
    });
  });
  const activities = Array.isArray(state.ov5?.activities) ? state.ov5.activities : [];
  activities.slice(0, 24).forEach((activity) => {
    if (activity?.id) ids.push(String(activity.id));
  });
  return [...new Set(ids)];
}

export function listForceAndPhaseSubjects(state = {}) {
  const subjects = [];
  const forces = Array.isArray(state.forceMission?.forces) ? state.forceMission.forces : [];
  forces.forEach((force, index) => {
    subjects.push({
      id: String(force?.id || `force-${index + 1}`),
      name: String(force?.name || force?.id || `概念兵力 ${index + 1}`),
      subjectType: "force"
    });
  });
  const phases = Array.isArray(state.phaseAction?.phases) ? state.phaseAction.phases : [];
  phases.forEach((phase, index) => {
    subjects.push({
      id: String(phase?.id || `phase-${index + 1}`),
      name: String(phase?.name || phase?.id || `阶段 ${index + 1}`),
      subjectType: "task"
    });
  });
  return subjects.slice(0, 48);
}

function cloneModel(model) {
  return structuredClone(model && typeof model === "object" ? model : {});
}

export function ensureOv6aModel(model) {
  return normalizeDodafOv6a(model || { rules: [] });
}

export function ensureOv6bModel(model) {
  return normalizeDodafOv6b(model || { stateMachines: [] });
}

export function ensureOv6cModel(model) {
  return normalizeDodafOv6c(model || { sequences: [] });
}

export function addOv6aRule(model, partial = {}) {
  const next = cloneModel(ensureOv6aModel(model));
  const index = (next.rules || []).length + 1;
  const id = partial.id || `rule-${Date.now().toString(36)}-${index}`;
  next.rules = [
    ...(next.rules || []),
    {
      id,
      name: partial.name || `新规则 ${index}`,
      description: partial.description || "待补充规则描述",
      scope: partial.scope || "研究级",
      type: partial.type || "约束",
      activityBindings: []
    }
  ];
  const normalized = normalizeDodafOv6a(next);
  normalized._createdRuleId = id;
  return normalized;
}

export function removeOv6aRule(model, ruleId) {
  const next = cloneModel(ensureOv6aModel(model));
  next.rules = (next.rules || []).filter((item) => item.id !== ruleId);
  return normalizeDodafOv6a(next);
}

export function resolveOv6aSelectedRuleId(state = {}, rules = []) {
  const list = Array.isArray(rules) ? rules : [];
  if (!list.length) return "";
  const preferred = String(state.ov6aSelectedRuleId || "");
  if (preferred && list.some((item) => item.id === preferred)) return preferred;
  return list[0].id;
}

export function toggleOv6aActivityBinding(model, ruleId, activityRef, { checked = true, status = "pending" } = {}) {
  const next = cloneModel(ensureOv6aModel(model));
  const rule = (next.rules || []).find((item) => item.id === ruleId);
  if (!rule || !activityRef) return normalizeDodafOv6a(next);
  const bindings = Array.isArray(rule.activityBindings) ? [...rule.activityBindings] : [];
  const existingIndex = bindings.findIndex((item) => item.activityRef === activityRef);
  if (checked) {
    if (existingIndex >= 0) {
      bindings[existingIndex] = {
        ...bindings[existingIndex],
        bindingStatus: BINDING_STATUSES.includes(status) ? status : bindings[existingIndex].bindingStatus || "pending"
      };
    } else {
      bindings.push({
        activityRef,
        bindingStatus: BINDING_STATUSES.includes(status) ? status : "pending",
        constraintNote: ""
      });
    }
  } else if (existingIndex >= 0) {
    bindings.splice(existingIndex, 1);
  }
  rule.activityBindings = bindings;
  return normalizeDodafOv6a(next);
}

export function setOv6aBindingStatus(model, ruleId, activityRef, status) {
  const next = cloneModel(ensureOv6aModel(model));
  const rule = (next.rules || []).find((item) => item.id === ruleId);
  if (!rule || !activityRef) return normalizeDodafOv6a(next);
  const binding = (rule.activityBindings || []).find((item) => item.activityRef === activityRef);
  if (!binding) return normalizeDodafOv6a(next);
  binding.bindingStatus = BINDING_STATUSES.includes(status) ? status : "pending";
  return normalizeDodafOv6a(next);
}

export function setOv6aBindingNote(model, ruleId, activityRef, note) {
  const next = cloneModel(ensureOv6aModel(model));
  const rule = (next.rules || []).find((item) => item.id === ruleId);
  if (!rule || !activityRef) return normalizeDodafOv6a(next);
  const binding = (rule.activityBindings || []).find((item) => item.activityRef === activityRef);
  if (!binding) return normalizeDodafOv6a(next);
  binding.constraintNote = String(note || "").slice(0, 800);
  return normalizeDodafOv6a(next);
}

export function addOv6bStateMachine(model, { subjectType = "task", subjectRef = "", name = "" } = {}) {
  const next = cloneModel(ensureOv6bModel(model));
  const index = (next.stateMachines || []).length + 1;
  const machineId = `state-machine-${Date.now().toString(36)}-${index}`;
  const prefix = `${machineId}-`;
  next.stateMachines = [
    ...(next.stateMachines || []),
    {
      id: machineId,
      subjectRef: subjectRef || `subject-${index}`,
      subjectType: ["task", "object", "force", "phase", "other"].includes(subjectType) ? subjectType : "task",
      name: name || `状态机 ${index}`,
      states: [
        { id: `${prefix}start`, name: "开始", kind: "initial" },
        { id: `${prefix}mid`, name: "进行中", kind: "normal" },
        { id: `${prefix}end`, name: "结束", kind: "final" }
      ],
      transitions: [
        {
          id: `${prefix}t1`,
          fromStateRef: `${prefix}start`,
          toStateRef: `${prefix}mid`,
          condition: "进入执行",
          ruleRefs: [],
          eventRefs: []
        },
        {
          id: `${prefix}t2`,
          fromStateRef: `${prefix}mid`,
          toStateRef: `${prefix}end`,
          condition: "达成终态",
          ruleRefs: [],
          eventRefs: []
        }
      ]
    }
  ];
  return normalizeDodafOv6b(next);
}

export function removeOv6bStateMachine(model, machineId) {
  const next = cloneModel(ensureOv6bModel(model));
  next.stateMachines = (next.stateMachines || []).filter((item) => item.id !== machineId);
  return normalizeDodafOv6b(next);
}

export function updateOv6bStateMachine(model, machineId, patch = {}) {
  const next = cloneModel(ensureOv6bModel(model));
  const machine = (next.stateMachines || []).find((item) => item.id === machineId);
  if (!machine) return normalizeDodafOv6b(next);
  if (patch.name !== undefined) machine.name = String(patch.name || "").slice(0, 240);
  if (patch.subjectRef !== undefined) machine.subjectRef = String(patch.subjectRef || "").slice(0, 160);
  if (patch.subjectType !== undefined && ["task", "object", "force", "phase", "other"].includes(patch.subjectType)) {
    machine.subjectType = patch.subjectType;
  }
  return normalizeDodafOv6b(next);
}

export function addOv6bTransition(model, machineId, partial = {}) {
  const next = cloneModel(ensureOv6bModel(model));
  const machine = (next.stateMachines || []).find((item) => item.id === machineId);
  if (!machine) return normalizeDodafOv6b(next);
  const states = machine.states || [];
  const from = partial.fromStateRef || states.find((item) => item.kind === "initial")?.id || states[0]?.id;
  const to = partial.toStateRef || states.find((item) => item.kind === "final")?.id || states.at(-1)?.id;
  if (!from || !to || from === to) return normalizeDodafOv6b(next);
  machine.transitions = [
    ...(machine.transitions || []),
    {
      id: partial.id || `transition-${Date.now().toString(36)}`,
      fromStateRef: from,
      toStateRef: to,
      condition: partial.condition || "新转换条件",
      ruleRefs: partial.ruleRefs || [],
      eventRefs: partial.eventRefs || []
    }
  ];
  return normalizeDodafOv6b(next);
}

export function addOv6cSequence(model, partial = {}) {
  const next = cloneModel(ensureOv6cModel(model));
  const index = (next.sequences || []).length + 1;
  next.sequences = [
    ...(next.sequences || []),
    {
      id: partial.id || `sequence-${Date.now().toString(36)}-${index}`,
      name: partial.name || `事件序列 ${index}`,
      participants: partial.participants || [
        { id: `participant-${index}-a`, name: "参与方 A", ref: "" },
        { id: `participant-${index}-b`, name: "参与方 B", ref: "" }
      ],
      messages: partial.messages || [],
      fragments: partial.fragments || []
    }
  ];
  return normalizeDodafOv6c(next);
}

export function addOv6cParticipant(model, sequenceId, partial = {}) {
  const next = cloneModel(ensureOv6cModel(model));
  const sequence = (next.sequences || []).find((item) => item.id === sequenceId);
  if (!sequence) return normalizeDodafOv6c(next);
  const index = (sequence.participants || []).length + 1;
  sequence.participants = [
    ...(sequence.participants || []),
    {
      id: partial.id || `participant-${Date.now().toString(36)}-${index}`,
      name: partial.name || `参与方 ${index}`,
      ref: partial.ref || ""
    }
  ];
  return normalizeDodafOv6c(next);
}

export function addOv6cMessage(model, sequenceId, partial = {}) {
  const next = cloneModel(ensureOv6cModel(model));
  const sequence = (next.sequences || []).find((item) => item.id === sequenceId);
  if (!sequence) return normalizeDodafOv6c(next);
  const participants = sequence.participants || [];
  if (participants.length < 2) {
    sequence.participants = [
      { id: "participant-a", name: "参与方 A", ref: "" },
      { id: "participant-b", name: "参与方 B", ref: "" }
    ];
  }
  const list = sequence.participants;
  const index = (sequence.messages || []).length + 1;
  sequence.messages = [
    ...(sequence.messages || []),
    {
      id: partial.id || `event-${Date.now().toString(36)}-${index}`,
      sequence: index,
      fromRef: partial.fromRef || list[0].id,
      toRef: partial.toRef || list[1]?.id || list[0].id,
      name: partial.name || `消息 ${index}`,
      type: partial.type || "message",
      condition: partial.condition || "",
      relatedActivityRefs: partial.relatedActivityRefs || [],
      ruleRefs: partial.ruleRefs || [],
      stateTransitionRefs: partial.stateTransitionRefs || []
    }
  ];
  return normalizeDodafOv6c(next);
}

export function removeOv6cSequence(model, sequenceId) {
  const next = cloneModel(ensureOv6cModel(model));
  next.sequences = (next.sequences || []).filter((item) => item.id !== sequenceId);
  return normalizeDodafOv6c(next);
}

/**
 * Reverse-check phase planning against formal 6a/6b/6c products.
 * Returns structure-review issue drafts (caller wraps with issue()).
 */
export function inspectPhaseAgainstOv6(state = {}) {
  const findings = [];
  const phase = state.phaseAction || {};
  const ov6a = ensureOv6aModel(state.ov6a || { rules: [] });
  const ov6b = ensureOv6bModel(state.ov6b || { stateMachines: [] });
  const ov6c = ensureOv6cModel(state.ov6c || { sequences: [] });
  const candidates = listActivityCandidates(state);
  const titleById = new Map(candidates.map((item) => [item.id, item.title]));
  const criticalIds = listCriticalActivityIds(state);

  const boundActivityIds = new Set();
  (ov6a.rules || []).forEach((rule) => {
    (rule.activityBindings || []).forEach((binding) => {
      if (binding.activityRef && binding.bindingStatus !== "rejected") boundActivityIds.add(binding.activityRef);
    });
  });

  criticalIds.slice(0, 24).forEach((activityId) => {
    if (boundActivityIds.has(activityId)) return;
    findings.push({
      id: `phase-no-rule-${activityId}`,
      code: "phase-activity-without-rule",
      group: "sequence",
      severity: "review",
      sourceView: "phase-action",
      title: "关键活动无规则约束",
      detail: `「${titleById.get(activityId) || activityId}」尚无规则绑定。可在规则模型中绑定，或回改阶段行动。`,
      targetView: "ov6a"
    });
  });

  (ov6b.stateMachines || []).forEach((machine) => {
    const states = machine.states || [];
    const transitions = machine.transitions || [];
    const hasFinal = states.some((item) => item.kind === "final");
    const finalIds = new Set(states.filter((item) => item.kind === "final").map((item) => item.id));
    const reachesFinal = transitions.some((item) => finalIds.has(item.toStateRef || item.targetId));
    if (!hasFinal || !reachesFinal) {
      findings.push({
        id: `machine-no-exit-${machine.id}`,
        code: "state-machine-no-exit",
        group: "sequence",
        severity: "review",
        sourceView: "ov6b",
        title: "任务/对象无状态出口",
        detail: `状态机「${machine.name || machine.id}」缺少可达的结束状态，请补 final 状态或转换。`,
        targetView: "ov6b"
      });
    }
  });

  const phaseTaskIds = new Set(
    (Array.isArray(phase.phases) ? phase.phases : []).map((item, index) => String(item?.id || `phase-${index + 1}`))
  );
  phaseTaskIds.forEach((taskId) => {
    const covered = (ov6b.stateMachines || []).some((machine) => machine.subjectRef === taskId || machine.id.includes(taskId));
    if (!covered && (ov6b.stateMachines || []).length) {
      // only warn when some machines exist but this phase task is uncovered
      findings.push({
        id: `phase-no-machine-${taskId}`,
        code: "phase-task-without-state-machine",
        group: "sequence",
        severity: "pending",
        sourceView: "phase-action",
        title: "阶段任务未建状态机",
        detail: `阶段「${taskId}」尚无对应状态机；可按任务分机建立，勿硬合并全项目一条链。`,
        targetView: "ov6b"
      });
    }
  });

  (ov6c.sequences || []).forEach((sequence) => {
    (sequence.messages || []).forEach((message) => {
      const refs = message.relatedActivityRefs || [];
      if (!refs.length) {
        findings.push({
          id: `message-no-source-${message.id}`,
          code: "sequence-message-without-activity",
          group: "sequence",
          severity: "review",
          sourceView: "ov6c",
          title: "事件消息无来源活动",
          detail: `时序「${sequence.name || sequence.id}」中的「${message.name || message.title || message.id}」未回链阶段/活动。`,
          targetView: "ov6c"
        });
      }
    });
  });

  return findings.slice(0, 40);
}
