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

/** State-machine subjects are lifecycle-bearing tasks/objects, not phase containers. */
export function listStateMachineSubjects(state = {}) {
  const subjects = [];
  const seen = new Set();
  const push = (subject) => {
    const id = String(subject?.id || "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    subjects.push({
      ...subject,
      id,
      name: String(subject?.name || id).trim() || id
    });
  };

  const phases = Array.isArray(state.phaseAction?.phases) ? state.phaseAction.phases : [];
  phases.forEach((phase, phaseIndex) => {
    const phaseId = String(phase?.id || `phase-${phaseIndex + 1}`);
    const phaseName = String(phase?.name || `阶段 ${phaseIndex + 1}`).trim();
    const primary = Array.isArray(phase?.primaryActions) ? phase.primaryActions.filter(Boolean) : [];
    const actions = primary.length ? primary : (Array.isArray(phase?.blueActions) ? phase.blueActions.filter(Boolean) : []);
    actions.forEach((action, actionIndex) => push({
      id: `${phaseId}::action-${actionIndex + 1}`,
      name: `${phaseName} · ${String(action)}`,
      taskName: String(action),
      subjectType: "phase",
      phaseId,
      phaseName,
      context: String(phase?.objective || ""),
      timeWindow: String(phase?.timeWindow || phase?.timeRange || phase?.window || "").trim(),
      blueActions: (Array.isArray(phase?.blueActions) ? phase.blueActions : phase?.primaryActions || []).filter(Boolean).slice(0, 8),
      redActions: (Array.isArray(phase?.redActions) ? phase.redActions : phase?.secondaryActions || []).filter(Boolean).slice(0, 8),
      entryConditions: (phase?.entryConditions || []).filter(Boolean).slice(0, 6),
      exitConditions: (phase?.exitConditions || []).filter(Boolean).slice(0, 6),
      expectedEffects: (phase?.expectedEffects || []).filter(Boolean).slice(0, 6)
    }));
  });

  const forces = [
    ...(Array.isArray(state.forceMission?.forces) ? state.forceMission.forces : []),
    ...(Array.isArray(state.forceMission?.combatForces) ? state.forceMission.combatForces : [])
  ];
  forces.forEach((force, index) => {
    const task = String(force?.task || "").trim();
    const role = String(force?.role || "").trim();
    if (!task && !role) return;
    push({
      id: String(force?.id || `force-${index + 1}`),
      name: String(force?.name || force?.id || `持续对象 ${index + 1}`),
      subjectType: "force",
      context: task,
      role
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
        { id: `${prefix}start`, name: "开始", kind: "initial", x: "12%", y: "42%" },
        { id: `${prefix}mid`, name: "进行中", kind: "normal", x: "42%", y: "42%" },
        { id: `${prefix}end`, name: "结束", kind: "final", x: "72%", y: "42%" }
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
  if (patch.canvasLayout === "auto" || patch.canvasLayout === "manual") {
    machine.canvasLayout = patch.canvasLayout;
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
  const transitionId = partial.id || `transition-${Date.now().toString(36)}`;
  machine.transitions = [
    ...(machine.transitions || []),
    {
      id: transitionId,
      fromStateRef: from,
      toStateRef: to,
      condition: partial.condition || "新转换条件",
      branchResult: partial.branchResult || "",
      ruleRefs: partial.ruleRefs || [],
      eventRefs: partial.eventRefs || []
    }
  ];
  const normalized = normalizeDodafOv6b(next);
  normalized._createdTransitionId = transitionId;
  return normalized;
}

export function addOv6bDecisionBranch(model, machineId, decisionId, partial = {}) {
  const next = cloneModel(ensureOv6bModel(model));
  const machine = (next.stateMachines || []).find((item) => item.id === machineId);
  const decision = (machine?.states || []).find((item) => item.id === decisionId && item.kind === "decision");
  const targetId = String(partial.toStateRef || "").trim();
  const result = String(partial.branchResult || "").trim();
  const condition = String(partial.condition || "").trim();
  const outgoing = (machine?.transitions || []).filter((item) => item.fromStateRef === decisionId);
  let error = "";
  if (!machine || !decision) error = "未找到判定节点";
  else if (!targetId || targetId === decisionId || !(machine.states || []).some((item) => item.id === targetId)) error = "请选择有效分支目标";
  else if (!result) error = "请填写分支结果";
  else if (!condition || /^(TBD|待补充|新转换条件)$/i.test(condition)) error = "请填写可观察的分支条件";
  else if (outgoing.some((item) => String(item.branchResult || "").trim().toLocaleLowerCase() === result.toLocaleLowerCase())) error = "分支结果不能重复";
  if (error) {
    const unchanged = normalizeDodafOv6b(next);
    unchanged._branchError = error;
    return unchanged;
  }
  const transitionId = partial.id || `transition-${Date.now().toString(36)}-branch-${outgoing.length + 1}`;
  machine.transitions = [
    ...(machine.transitions || []),
    {
      id: transitionId,
      fromStateRef: decisionId,
      toStateRef: targetId,
      condition: condition.slice(0, 4000),
      branchResult: result.slice(0, 400),
      ruleRefs: partial.ruleRefs || [],
      eventRefs: partial.eventRefs || []
    }
  ];
  const normalized = normalizeDodafOv6b(next);
  normalized._createdTransitionId = transitionId;
  return normalized;
}

export function resolveOv6bSelectedMachineId(state = {}, machines = []) {
  const list = Array.isArray(machines) ? machines : [];
  if (!list.length) return "";
  const preferred = String(state.ov6bSelectedMachineId || "");
  if (preferred && list.some((item) => item.id === preferred)) return preferred;
  return list[0].id;
}

export function addOv6bState(model, machineId, partial = {}) {
  const next = cloneModel(ensureOv6bModel(model));
  const machine = (next.stateMachines || []).find((item) => item.id === machineId);
  if (!machine) return normalizeDodafOv6b(next);
  const kind = ["initial", "normal", "decision", "final"].includes(partial.kind) ? partial.kind : "normal";
  const index = (machine.states || []).length + 1;
  const id = partial.id || `${machine.id}-state-${Date.now().toString(36)}-${index}`;
  const laidOut = layoutOv6bStatesForCanvas(machine.states || []);
  const finalState = laidOut.find((item) => item.kind === "final");
  const rightMostNonFinal = laidOut
    .filter((item) => item.kind !== "final")
    .sort((a, b) => Number.parseFloat(b.x) - Number.parseFloat(a.x))[0];
  const insertX = kind === "decision" && finalState
    ? (Number.parseFloat(finalState.x) + Number.parseFloat(rightMostNonFinal?.x || finalState.x)) / 2
    : null;
  if (insertX !== null && finalState && insertX > Number.parseFloat(finalState.x) - 9) {
    finalState.x = `${Math.min(88, Number.parseFloat(finalState.x) + 18)}%`;
    const storedFinal = (machine.states || []).find((item) => item.id === finalState.id);
    if (storedFinal) storedFinal.x = finalState.x;
  }
  const state = {
    id,
    name: partial.name || (kind === "initial" ? "开始" : kind === "final" ? "结束" : kind === "decision" ? "条件判定" : `状态 ${index}`),
    kind,
    decisionExpression: kind === "decision" ? (partial.decisionExpression || "条件是否满足") : "",
    x: partial.x || (insertX === null ? `${18 + ((index - 1) % 4) * 18}%` : `${Math.round(insertX * 100) / 100}%`),
    y: partial.y || (kind === "decision" && finalState ? finalState.y : `${28 + Math.floor((index - 1) / 4) * 18}%`)
  };
  const states = [...(machine.states || [])];
  if (kind === "initial") states.unshift(state);
  else if (kind === "final") states.push(state);
  else {
    const finalIndex = states.findIndex((item) => item.kind === "final");
    if (finalIndex >= 0) states.splice(finalIndex, 0, state);
    else states.push(state);
  }
  machine.states = states;
  if (kind === "decision") {
    const preferred = (machine.transitions || []).find((item) => item.id === partial.insertTransitionId)
      || (machine.transitions || []).find((item) => item.toStateRef === finalState?.id)
      || (machine.transitions || []).at(-1);
    if (preferred) {
      const originalTarget = preferred.toStateRef;
      preferred.toStateRef = id;
      machine.transitions = [
        ...(machine.transitions || []),
        {
          id: `transition-${Date.now().toString(36)}-decision`,
          fromStateRef: id,
          toStateRef: originalTarget,
          condition: "满足条件",
          branchResult: "满足",
          ruleRefs: [],
          eventRefs: []
        }
      ];
    }
  }
  return normalizeDodafOv6b(next);
}

export function updateOv6bState(model, machineId, stateId, patch = {}) {
  const next = cloneModel(ensureOv6bModel(model));
  const machine = (next.stateMachines || []).find((item) => item.id === machineId);
  if (!machine) return normalizeDodafOv6b(next);
  const state = (machine.states || []).find((item) => item.id === stateId);
  if (!state) return normalizeDodafOv6b(next);
  if (patch.name !== undefined) state.name = String(patch.name || "").slice(0, 120);
  if (patch.kind !== undefined && ["initial", "normal", "decision", "final"].includes(patch.kind)) state.kind = patch.kind;
  if (patch.decisionExpression !== undefined) state.decisionExpression = String(patch.decisionExpression || "").slice(0, 1000);
  if (patch.x !== undefined) state.x = patch.x;
  if (patch.y !== undefined) state.y = patch.y;
  if (patch.x !== undefined || patch.y !== undefined) machine.canvasLayout = "manual";
  return normalizeDodafOv6b(next);
}

/** Persist free-canvas positions and stop auto topology from overwriting them. */
export function updateOv6bCanvasLayout(model, machineId, { canvasLayout = "manual", positions = [] } = {}) {
  const next = cloneModel(ensureOv6bModel(model));
  const machine = (next.stateMachines || []).find((item) => item.id === machineId);
  if (!machine) return normalizeDodafOv6b(next);
  if (canvasLayout === "auto" || canvasLayout === "manual") machine.canvasLayout = canvasLayout;
  const byId = new Map((Array.isArray(positions) ? positions : []).map((item) => [item?.id, item]));
  (machine.states || []).forEach((state) => {
    const pos = byId.get(state.id);
    if (!pos) return;
    if (pos.x !== undefined) state.x = pos.x;
    if (pos.y !== undefined) state.y = pos.y;
  });
  return normalizeDodafOv6b(next);
}

/** Default OV-1-style logical layout when states lack canvas coords. */
export function layoutOv6bStatesForCanvas(states = []) {
  const list = Array.isArray(states) ? states : [];
  const weight = (kind) => (kind === "initial" ? 0 : kind === "final" ? 3 : kind === "decision" ? 2 : 1);
  const ordered = [...list].sort((a, b) => weight(a.kind) - weight(b.kind));
  const n = Math.max(ordered.length, 1);
  return ordered.map((state, index) => {
    const hasX = Number.isFinite(Number.parseFloat(state.x));
    const hasY = Number.isFinite(Number.parseFloat(state.y));
    if (hasX && hasY) {
      return {
        ...state,
        x: `${Number.parseFloat(state.x)}%`,
        y: `${Number.parseFloat(state.y)}%`
      };
    }
    const t = n === 1 ? 0.5 : index / (n - 1);
    const x = 12 + t * 60;
    const y = 36 + (index % 2) * 12;
    return {
      ...state,
      x: `${Math.round(x * 100) / 100}%`,
      y: `${Math.round(y * 100) / 100}%`
    };
  });
}

export function removeOv6bState(model, machineId, stateId) {
  const next = cloneModel(ensureOv6bModel(model));
  const machine = (next.stateMachines || []).find((item) => item.id === machineId);
  if (!machine || !stateId) return normalizeDodafOv6b(next);
  machine.states = (machine.states || []).filter((item) => item.id !== stateId);
  machine.transitions = (machine.transitions || []).filter(
    (item) => item.fromStateRef !== stateId && item.toStateRef !== stateId
  );
  return normalizeDodafOv6b(next);
}

export function removeOv6bTransition(model, machineId, transitionId) {
  const next = cloneModel(ensureOv6bModel(model));
  const machine = (next.stateMachines || []).find((item) => item.id === machineId);
  if (!machine || !transitionId) return normalizeDodafOv6b(next);
  machine.transitions = (machine.transitions || []).filter((item) => item.id !== transitionId);
  return normalizeDodafOv6b(next);
}

export function updateOv6bTransition(model, machineId, transitionId, patch = {}) {
  const next = cloneModel(ensureOv6bModel(model));
  const machine = (next.stateMachines || []).find((item) => item.id === machineId);
  if (!machine || !transitionId) return normalizeDodafOv6b(next);
  const transition = (machine.transitions || []).find((item) => item.id === transitionId);
  if (!transition) return normalizeDodafOv6b(next);
  if (patch.condition !== undefined) transition.condition = String(patch.condition || "").slice(0, 4000);
  if (patch.branchResult !== undefined) transition.branchResult = String(patch.branchResult || "").slice(0, 400);
  const nextFrom = patch.fromStateRef !== undefined ? String(patch.fromStateRef || "").slice(0, 180) : transition.fromStateRef;
  const nextTo = patch.toStateRef !== undefined ? String(patch.toStateRef || "").slice(0, 180) : transition.toStateRef;
  const invalidTarget = !nextFrom || !nextTo || nextFrom === nextTo
    || !(machine.states || []).some((item) => item.id === nextFrom)
    || !(machine.states || []).some((item) => item.id === nextTo);
  const duplicate = (machine.transitions || []).some((item) => item.id !== transitionId && item.fromStateRef === nextFrom && item.toStateRef === nextTo);
  if (invalidTarget || duplicate) {
    const unchanged = normalizeDodafOv6b(next);
    unchanged._transitionError = invalidTarget ? "转换端点无效或不能连接自身" : "该转换已存在";
    return unchanged;
  }
  transition.fromStateRef = nextFrom;
  transition.toStateRef = nextTo;
  return normalizeDodafOv6b(next);
}

/** Create one machine per uncovered lifecycle-bearing subject. */
export function seedOv6bFromSubjects(model, subjects = []) {
  let next = ensureOv6bModel(model);
  const covered = new Set((next.stateMachines || []).map((item) => item.subjectRef).filter(Boolean));
  const list = Array.isArray(subjects) ? subjects : [];
  list.forEach((subject) => {
    const ref = String(subject?.id || "").trim();
    if (!ref || covered.has(ref)) return;
    covered.add(ref);
    next = addOv6bStateMachine(next, {
      subjectType: subject.subjectType || (/::action-\d+$/.test(ref) ? "phase" : "task"),
      subjectRef: ref,
      name: subject.name ? `${subject.name}状态机` : ""
    });
  });
  return ensureOv6bModel(next);
}

export function diagnoseOv6bMachineLocal(machine = {}) {
  const states = Array.isArray(machine.states) ? machine.states : [];
  const transitions = Array.isArray(machine.transitions) ? machine.transitions : [];
  const findings = [];
  const addFinding = (message, target = {}) => findings.push({ message, ...target });
  if (!states.some((item) => item.kind === "initial")) addFinding("缺少开始状态");
  if (!states.some((item) => item.kind === "final")) addFinding("缺少结束状态");
  if (!states.some((item) => item.kind === "normal")) addFinding("缺少中间状态");
  if (!transitions.length) addFinding("尚无转换");
  const initials = new Set(states.filter((item) => item.kind === "initial").map((item) => item.id));
  const finals = new Set(states.filter((item) => item.kind === "final").map((item) => item.id));
  const outgoing = new Map(states.map((item) => [item.id, transitions.filter((edge) => edge.fromStateRef === item.id)]));
  const incoming = new Map(states.map((item) => [item.id, transitions.filter((edge) => edge.toStateRef === item.id)]));
  states.forEach((state) => {
    const out = outgoing.get(state.id) || [];
    const input = incoming.get(state.id) || [];
    if (!initials.has(state.id) && !input.length) addFinding(`「${state.name || state.id}」无入口`, { stateId: state.id });
    if (!finals.has(state.id) && !out.length) addFinding(`「${state.name || state.id}」无出口`, { stateId: state.id });
    if (finals.has(state.id) && out.length) addFinding(`「${state.name || state.id}」结束后仍有转换`, { stateId: state.id });
    if (state.kind === "decision") {
      if (!String(state.decisionExpression || "").trim()) addFinding(`「${state.name || state.id}」缺少判定表达式`, { stateId: state.id });
      if (out.length < 2) addFinding(`「${state.name || state.id}」至少需要两个分支`, { stateId: state.id });
      const results = out.map((edge) => String(edge.branchResult || "").trim());
      out.filter((edge) => !String(edge.branchResult || "").trim())
        .forEach((edge) => addFinding(`「${state.name || state.id}」存在未标注分支`, { transitionId: edge.id }));
      if (results.filter(Boolean).length !== new Set(results.filter(Boolean)).size) addFinding(`「${state.name || state.id}」存在重复分支结果`, { stateId: state.id });
    }
  });
  transitions.forEach((edge) => {
    const condition = String(edge.condition || "").trim();
    if (!condition || /^(TBD|待补充|新转换条件)$/i.test(condition)) addFinding(`转换「${edge.id}」缺少可观察条件`, { transitionId: edge.id });
  });
  const reachable = walkGraph([...initials], (id) => (outgoing.get(id) || []).map((edge) => edge.toStateRef));
  states.filter((item) => !reachable.has(item.id)).forEach((item) => addFinding(`「${item.name || item.id}」从开始不可达`, { stateId: item.id }));
  const canReachFinal = walkGraph([...finals], (id) => (incoming.get(id) || []).map((edge) => edge.fromStateRef));
  states.filter((item) => reachable.has(item.id) && !finals.has(item.id) && !canReachFinal.has(item.id))
    .forEach((item) => addFinding(`「${item.name || item.id}」无法到达结束`, { stateId: item.id }));
  const uniqueFindings = findings.filter((finding, index, list) => (
    list.findIndex((item) => item.message === finding.message && item.stateId === finding.stateId && item.transitionId === finding.transitionId) === index
  ));
  const uniqueIssues = [...new Set(uniqueFindings.map((item) => item.message))];
  return {
    ok: uniqueIssues.length === 0,
    issues: uniqueIssues,
    findings: uniqueFindings,
    statusLabel: uniqueIssues.length ? "需复核" : "结构完整",
    detail: uniqueIssues.length ? uniqueIssues.join("；") : `状态 ${states.length} · 转换 ${transitions.length}`
  };
}

function walkGraph(starts, neighbors) {
  const visited = new Set(starts.filter(Boolean));
  const queue = [...visited];
  while (queue.length) {
    const current = queue.shift();
    neighbors(current).forEach((next) => {
      if (!next || visited.has(next)) return;
      visited.add(next);
      queue.push(next);
    });
  }
  return visited;
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
      stateTransitionRefs: partial.stateTransitionRefs || [],
      offsetMinutes: partial.offsetMinutes ?? ((index - 1) * 15),
      durationMinutes: partial.durationMinutes ?? 15,
      time: partial.time || `T+${(index - 1) * 15}`
    }
  ];
  return normalizeDodafOv6c(next);
}

export function removeOv6cSequence(model, sequenceId) {
  const next = cloneModel(ensureOv6cModel(model));
  next.sequences = (next.sequences || []).filter((item) => item.id !== sequenceId);
  return normalizeDodafOv6c(next);
}

export function resolveOv6cSelectedSequenceId(state = {}, sequences = []) {
  const list = Array.isArray(sequences) ? sequences : [];
  if (!list.length) return "";
  const preferred = String(state.ov6cSelectedSequenceId || "");
  if (preferred && list.some((item) => item.id === preferred)) return preferred;
  return list[0].id;
}

export function updateOv6cSequence(model, sequenceId, patch = {}) {
  const next = cloneModel(ensureOv6cModel(model));
  const sequence = (next.sequences || []).find((item) => item.id === sequenceId);
  if (!sequence) return normalizeDodafOv6c(next);
  if (patch.name !== undefined) sequence.name = String(patch.name || "").slice(0, 240);
  return normalizeDodafOv6c(next);
}

export function updateOv6cParticipant(model, sequenceId, participantId, patch = {}) {
  const next = cloneModel(ensureOv6cModel(model));
  const sequence = (next.sequences || []).find((item) => item.id === sequenceId);
  if (!sequence) return normalizeDodafOv6c(next);
  const participant = (sequence.participants || []).find((item) => item.id === participantId);
  if (!participant) return normalizeDodafOv6c(next);
  if (patch.name !== undefined) participant.name = String(patch.name || "").slice(0, 240);
  if (patch.ref !== undefined) participant.ref = String(patch.ref || "").slice(0, 160);
  return normalizeDodafOv6c(next);
}

export function updateOv6cMessage(model, sequenceId, messageId, patch = {}) {
  const next = cloneModel(ensureOv6cModel(model));
  const sequence = (next.sequences || []).find((item) => item.id === sequenceId);
  if (!sequence) return normalizeDodafOv6c(next);
  const message = (sequence.messages || []).find((item) => item.id === messageId);
  if (!message) return normalizeDodafOv6c(next);
  if (patch.name !== undefined) {
    const name = String(patch.name || "").slice(0, 240);
    message.name = name;
    message.title = name;
  }
  if (patch.condition !== undefined) message.condition = String(patch.condition || "").slice(0, 800);
  if (patch.type !== undefined) message.type = String(patch.type || "message").slice(0, 40);
  if (patch.fromRef !== undefined) message.fromRef = String(patch.fromRef || "").slice(0, 160);
  if (patch.toRef !== undefined) message.toRef = String(patch.toRef || "").slice(0, 160);
  if (patch.relatedActivityRefs !== undefined) {
    const refs = Array.isArray(patch.relatedActivityRefs)
      ? patch.relatedActivityRefs
      : String(patch.relatedActivityRefs || "").split(/[,，]/).map((item) => item.trim()).filter(Boolean);
    message.relatedActivityRefs = refs.slice(0, 12).map((item) => String(item).slice(0, 160));
    message.sourceActivityId = message.relatedActivityRefs[0] || "";
  }
  if (patch.offsetMinutes !== undefined) {
    message.offsetMinutes = patch.offsetMinutes === null || patch.offsetMinutes === ""
      ? null
      : Number(patch.offsetMinutes);
    if (Number.isFinite(message.offsetMinutes)) message.time = `T+${Math.max(0, Math.round(message.offsetMinutes))}`;
  }
  if (patch.durationMinutes !== undefined) {
    message.durationMinutes = patch.durationMinutes === null || patch.durationMinutes === ""
      ? null
      : Number(patch.durationMinutes);
  }
  if (patch.time !== undefined) message.time = String(patch.time || "").slice(0, 120);
  return normalizeDodafOv6c(next);
}

const GANTT_SLOT_MINUTES = 15;
const GANTT_TYPE_COLORS = Object.freeze({
  message: { key: "message", label: "协同消息", color: "#ef4444" },
  response: { key: "response", label: "响应回执", color: "#8b5cf6" },
  status: { key: "status", label: "状态通报", color: "#0ea5e9" },
  exception: { key: "exception", label: "异常/对抗", color: "#f59e0b" },
  timeout: { key: "timeout", label: "超时窗口", color: "#22c55e" }
});

/** Layout one sequence as a Gantt timeline (row = message, x = abstract minutes). */
export function layoutSequenceGantt(sequence = {}, { slotMinutes = GANTT_SLOT_MINUTES } = {}) {
  const messages = [...(sequence.messages || [])].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  let cursor = 0;
  const rows = messages.map((message, index) => {
    const explicitStart = message.offsetMinutes;
    const start = explicitStart === null || explicitStart === undefined || !Number.isFinite(Number(explicitStart))
      ? cursor
      : Number(explicitStart);
    const explicitDuration = message.durationMinutes;
    const duration = explicitDuration === null || explicitDuration === undefined || !Number.isFinite(Number(explicitDuration))
      ? (message.type === "status" ? 0 : slotMinutes)
      : Math.max(0, Number(explicitDuration));
    const span = Math.max(duration, 0);
    const end = start + (span || 0);
    cursor = Math.max(cursor, start + Math.max(span, 1));
    return {
      id: message.id,
      message,
      index,
      start,
      duration: span,
      end,
      instant: span === 0,
      type: message.type || "message",
      color: (GANTT_TYPE_COLORS[message.type] || GANTT_TYPE_COLORS.message).color
    };
  });
  const starts = rows.map((row) => row.start);
  const ends = rows.map((row) => (row.instant ? row.start + 1 : row.end));
  const minStart = 0;
  const rawEnd = ends.length ? Math.max(...ends, ...starts) : slotMinutes * 4;
  const totalMinutes = Math.max(60, Math.ceil(Math.max(rawEnd, minStart + slotMinutes) / slotMinutes) * slotMinutes);
  const tickStep = totalMinutes <= 90 ? 10 : totalMinutes <= 180 ? 20 : 30;
  const ticks = [];
  for (let minute = minStart; minute <= totalMinutes; minute += tickStep) ticks.push(minute);
  if (ticks[ticks.length - 1] !== totalMinutes) ticks.push(totalMinutes);
  return {
    rows,
    minStart,
    totalMinutes,
    ticks,
    span: Math.max(totalMinutes - minStart, 1),
    types: GANTT_TYPE_COLORS
  };
}

export function formatSequenceClock(minutes) {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function removeOv6cMessage(model, sequenceId, messageId) {
  const next = cloneModel(ensureOv6cModel(model));
  const sequence = (next.sequences || []).find((item) => item.id === sequenceId);
  if (!sequence || !messageId) return normalizeDodafOv6c(next);
  sequence.messages = (sequence.messages || []).filter((item) => item.id !== messageId);
  return normalizeDodafOv6c(next);
}

export function removeOv6cParticipant(model, sequenceId, participantId) {
  const next = cloneModel(ensureOv6cModel(model));
  const sequence = (next.sequences || []).find((item) => item.id === sequenceId);
  if (!sequence || !participantId) return normalizeDodafOv6c(next);
  if ((sequence.participants || []).length <= 1) return normalizeDodafOv6c(next);
  sequence.participants = (sequence.participants || []).filter((item) => item.id !== participantId);
  const fallback = sequence.participants[0]?.id || "";
  sequence.messages = (sequence.messages || []).map((message) => ({
    ...message,
    fromRef: message.fromRef === participantId ? fallback : message.fromRef,
    toRef: message.toRef === participantId ? fallback : message.toRef
  }));
  return normalizeDodafOv6c(next);
}

/** Move a message by delta steps (-1 up / +1 down). */
export function moveOv6cMessage(model, sequenceId, messageId, delta = 0) {
  const next = cloneModel(ensureOv6cModel(model));
  const sequence = (next.sequences || []).find((item) => item.id === sequenceId);
  if (!sequence || !messageId || !delta) return normalizeDodafOv6c(next);
  const list = [...(sequence.messages || [])].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const index = list.findIndex((item) => item.id === messageId);
  if (index < 0) return normalizeDodafOv6c(next);
  const target = index + Number(delta);
  if (target < 0 || target >= list.length) return normalizeDodafOv6c(next);
  const [row] = list.splice(index, 1);
  list.splice(target, 0, row);
  sequence.messages = list.map((item, messageIndex) => ({ ...item, sequence: messageIndex + 1 }));
  return normalizeDodafOv6c(next);
}

export function reverseOv6cMessage(model, sequenceId, messageId) {
  const next = cloneModel(ensureOv6cModel(model));
  const sequence = (next.sequences || []).find((item) => item.id === sequenceId);
  if (!sequence || !messageId) return normalizeDodafOv6c(next);
  const message = (sequence.messages || []).find((item) => item.id === messageId);
  if (!message) return normalizeDodafOv6c(next);
  const from = message.fromRef;
  message.fromRef = message.toRef;
  message.toRef = from;
  return normalizeDodafOv6c(next);
}

/** Replace one sequence body from a parsed/merged DSL result. */
export function replaceOv6cSequenceContent(model, sequenceId, nextSequence = {}) {
  const next = cloneModel(ensureOv6cModel(model));
  const index = (next.sequences || []).findIndex((item) => item.id === sequenceId);
  if (index < 0) return normalizeDodafOv6c(next);
  const current = next.sequences[index];
  next.sequences[index] = {
    id: current.id,
    name: String(nextSequence.name || current.name || current.id).slice(0, 240),
    participants: Array.isArray(nextSequence.participants) ? nextSequence.participants : current.participants,
    messages: Array.isArray(nextSequence.messages) ? nextSequence.messages : current.messages,
    fragments: Array.isArray(nextSequence.fragments) ? nextSequence.fragments : (current.fragments || [])
  };
  return normalizeDodafOv6c(next);
}

/** Seed one collaborative sequence from phase/force subjects when empty. */
export function seedOv6cFromPhase(model, state = {}) {
  let next = ensureOv6cModel(model);
  if ((next.sequences || []).length) return next;
  const subjects = listForceAndPhaseSubjects(state);
  const phases = Array.isArray(state.phaseAction?.phases) ? state.phaseAction.phases : [];
  const participants = (subjects.length
    ? subjects.slice(0, 6).map((item, index) => ({
      id: item.id || `participant-${index + 1}`,
      name: item.name || item.id || `参与方 ${index + 1}`,
      ref: item.id || ""
    }))
    : [
      { id: "participant-blue", name: "蓝方指挥", ref: "" },
      { id: "participant-force", name: "行动单元", ref: "" }
    ]);
  const messages = [];
  phases.slice(0, 8).forEach((phase, index) => {
    const from = participants[index % participants.length];
    const to = participants[(index + 1) % participants.length];
    const action = (phase.blueActions || phase.primaryActions || [])[0] || phase.objective || phase.name || `阶段 ${index + 1}`;
    messages.push({
      id: `event-seed-${index + 1}`,
      sequence: index + 1,
      fromRef: from.id,
      toRef: to.id,
      name: String(action).slice(0, 120),
      type: "message",
      condition: String(phase.entryConditions?.[0] || phase.exitConditions?.[0] || "").slice(0, 200),
      relatedActivityRefs: phase.id ? [String(phase.id)] : [],
      offsetMinutes: index * 20,
      durationMinutes: 20,
      time: `T+${index * 20}`
    });
  });
  next = addOv6cSequence(next, {
    name: phases[0]?.name ? `${phases[0].name}协同时序` : "阶段协同时序",
    participants,
    messages
  });
  return ensureOv6cModel(next);
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
