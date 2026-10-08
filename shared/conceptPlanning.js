/** Shared force/mission and phase/action planning models (AI draft + human review). */

import {
  cmoMissionTypeLabel,
  isCmoPlatformDomain,
  listCmoMissionTypes,
  normalizeCmoMissionType
} from "./cmoMissionTypes.js";
import { viewportLayoutToWorldPercent } from "./ov1Canvas.js";
import { layoutOv1Nodes } from "./ov1Layout.js";

const FORCE_ROLES = new Set(["sense", "command", "maneuver", "air", "airDefense", "surface", "support", "external"]);
const FORCE_SIDES = new Set(["friendly", "hostile", "neutral", "unknown"]);
const RELATION_TYPES = new Set(["command", "support", "coordination", "information"]);
const PLAN_STATUSES = new Set(["empty", "draft", "confirmed"]);
const TASK_AREA_TYPES = new Set(["patrol", "prosecution", "support", "transit", "target", "exclusion", "other"]);
const TASK_AREA_GEOMETRIES = new Set(["point", "circle", "polygon", "corridor"]);
/** Abstract relative layout slots for concept-map compile (not real geo; hidden in force UI). */
const LAYOUT_SLOTS = new Set([
  "northwest", "north", "northeast", "west", "center", "east", "southwest", "south", "southeast"
]);
const ROLE_SLOT_FRIENDLY = Object.freeze({
  sense: "northwest",
  command: "west",
  airDefense: "center",
  air: "southwest",
  surface: "south",
  support: "southwest",
  maneuver: "south",
  external: "north"
});
const ROLE_SLOT_HOSTILE = Object.freeze({
  sense: "northeast",
  command: "east",
  airDefense: "east",
  air: "southeast",
  surface: "southeast",
  support: "southeast",
  maneuver: "northeast",
  external: "north"
});

export { listCmoMissionTypes, cmoMissionTypeLabel, normalizeCmoMissionType };

export function createEmptyForceMissionPlan() {
  return {
    version: 1,
    status: "empty",
    generation: emptyGeneration(),
    tasks: [],
    tasksConfirmedAt: "",
    forces: [],
    combatForces: [],
    relations: [],
    openQuestions: [],
    reviewChecklist: [],
    reviewNotes: ""
  };
}

export function createEmptyPhaseActionConcept() {
  return {
    version: 1,
    status: "empty",
    generation: emptyGeneration(),
    phases: [],
    transitions: [],
    openQuestions: [],
    reviewChecklist: [],
    reviewNotes: ""
  };
}

export function createEmptyConceptGraphicPlan() {
  return {
    version: 1,
    status: "empty",
    generation: emptyGeneration(),
    narrative: "",
    nodes: [],
    edges: [],
    effects: [],
    activityCandidates: [],
    oodaHints: [],
    openQuestions: [],
    reviewChecklist: [],
    consistencyReport: [],
    reviewNotes: ""
  };
}

const GRAPHIC_ROLES = new Set(["sense", "command", "action", "external", "effect", "equipment", "environment"]);
const GRAPHIC_EDGE_TYPES = new Set(["信息流", "控制流", "态势变化", "反馈", "协同", "保障"]);

export function normalizeForceMissionPlan(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const status = PLAN_STATUSES.has(clean(input.status, 24)) ? clean(input.status, 24) : "empty";
  const legacyTaskSources = !Array.isArray(input.tasks)
    ? [...(Array.isArray(input.forces) ? input.forces : []), ...(Array.isArray(input.combatForces) ? input.combatForces : [])]
      .filter((item) => clean(item?.task, 400))
      .map((item, index) => ({
        id: `legacy-task-${index + 1}`,
        name: clean(item.task, 120),
        side: item.side,
        phaseId: Array.isArray(item.phaseIds) ? item.phaseIds[0] : "",
        objective: item.task,
        expectedEffect: "",
        sourceAction: item.task
      }))
    : [];
  const taskIds = new Set();
  const tasks = (Array.isArray(input.tasks) ? input.tasks : legacyTaskSources).slice(0, 120).map((item, index) => {
    const id = slugId(item?.id, `task-${index + 1}`);
    if (!clean(item?.name, 120) || taskIds.has(id)) return null;
    taskIds.add(id);
    return {
      id,
      name: clean(item.name, 120),
      side: FORCE_SIDES.has(clean(item?.side, 20)) ? clean(item.side, 20) : "friendly",
      phaseId: clean(item?.phaseId, 60),
      missionType: normalizeCmoMissionType(item?.missionType, inferTaskMissionType(item?.name || item?.objective || item?.sourceAction)),
      area: normalizeOperationalTaskArea(item?.area || item?.missionArea || item?.taskArea),
      objective: clean(item?.objective, 500) || clean(item?.description, 500) || "完成阶段作战要求",
      expectedEffect: clean(item?.expectedEffect, 500),
      sourceAction: clean(item?.sourceAction, 400),
      notes: clean(item?.notes, 600)
    };
  }).filter(Boolean);
  const forceIds = new Set();
  // Concept forces: duty semantics by phase + exactly one equipment type ref (research-level).
  // slot = abstract relative layout for concept-map (stored, not shown on force roster UI).
  const forces = (Array.isArray(input.forces) ? input.forces : []).slice(0, 120).map((item, index) => {
    const id = slugId(item?.id, `force-${index + 1}`);
    if (!clean(item?.name, 120) || forceIds.has(id)) return null;
    forceIds.add(id);
    const side = FORCE_SIDES.has(clean(item?.side, 20)) ? clean(item.side, 20) : "friendly";
    const role = FORCE_ROLES.has(clean(item?.role, 30)) ? clean(item.role, 30) : "maneuver";
    const missionType = normalizeCmoMissionType(item?.missionType, inferMissionTypeFromRole(role));
    const force = {
      id,
      name: clean(item.name, 120),
      side,
      role,
      group: clean(item?.group, 120) || "概念编组",
      missionType,
      task: clean(item?.task, 400) || "研究级概念任务",
      taskRefs: normalizeStringList(item?.taskRefs || item?.taskIds, 24, 60),
      phaseIds: normalizeStringList(item?.phaseIds, 12, 60),
      // One real equipment type per concept unit; combat layer refines quantities/composition.
      platforms: normalizePlatformRefs(item?.platforms, 1),
      notes: clean(item?.notes, 600),
      slot: normalizeLayoutSlot(item?.slot)
    };
    force.slot = force.slot || inferLayoutSlot(force, index);
    return force;
  }).filter(Boolean);
  const conceptSlotById = new Map(forces.map((force) => [force.id, force.slot]));
  const conceptPhaseById = new Map(forces.map((force) => [force.id, force.phaseIds || []]));
  const combatForceIds = new Set();
  // Cap high enough for multi-phase CMO packages (all stages, not only first 3–4).
  const combatForces = (Array.isArray(input.combatForces) ? input.combatForces : []).slice(0, 400).map((item, index) => {
    const id = slugId(item?.id, `combat-${index + 1}`);
    if (!clean(item?.name, 120) || combatForceIds.has(id) || forceIds.has(id)) return null;
    combatForceIds.add(id);
    const side = FORCE_SIDES.has(clean(item?.side, 20)) ? clean(item.side, 20) : "friendly";
    const role = FORCE_ROLES.has(clean(item?.role, 30)) ? clean(item.role, 30) : "maneuver";
    const conceptForceId = clean(item?.conceptForceId, 60);
    const linkedConceptId = forceIds.has(conceptForceId) ? conceptForceId : "";
    const inheritedPhases = linkedConceptId ? (conceptPhaseById.get(linkedConceptId) || []) : [];
    const phaseIds = normalizeStringList(item?.phaseIds, 12, 60);
    const force = {
      id,
      name: clean(item.name, 120),
      side,
      role,
      conceptForceId: linkedConceptId,
      group: clean(item?.group, 120) || "作战编组",
      missionType: normalizeCmoMissionType(item?.missionType, inferMissionTypeFromRole(role)),
      task: clean(item?.task, 400) || "研究级作战任务",
      taskRefs: normalizeStringList(item?.taskRefs || item?.taskIds, 24, 60),
      // Phase coverage for stage switcher (inherit from concept when missing).
      phaseIds: phaseIds.length ? phaseIds : inheritedPhases,
      platforms: normalizePlatformRefs(item?.platforms),
      notes: clean(item?.notes, 600),
      slot: normalizeLayoutSlot(item?.slot)
    };
    // Combat inherits concept slot when linked; else same side/role abstract placement.
    force.slot = force.slot
      || (linkedConceptId && conceptSlotById.get(linkedConceptId))
      || inferLayoutSlot(force, index);
    return force;
  }).filter(Boolean);
  const relationIds = new Set([...forceIds, ...combatForceIds]);
  const relations = (Array.isArray(input.relations) ? input.relations : []).slice(0, 36).map((item, index) => {
    const fromForceId = clean(item?.fromForceId, 60);
    const toForceId = clean(item?.toForceId, 60);
    if (!relationIds.has(fromForceId) || !relationIds.has(toForceId) || fromForceId === toForceId) return null;
    const type = RELATION_TYPES.has(clean(item?.type, 30)) ? clean(item.type, 30) : "coordination";
    return {
      id: slugId(item?.id, `relation-${index + 1}`),
      fromForceId,
      toForceId,
      type,
      note: clean(item?.note, 400)
    };
  }).filter(Boolean);
  return {
    version: 1,
    status,
    generation: normalizeGeneration(input.generation),
    tasks,
    tasksConfirmedAt: tasks.length ? (clean(input.tasksConfirmedAt, 80) || (status === "confirmed" ? clean(input.confirmedAt, 80) : "")) : "",
    forces,
    combatForces,
    relations,
    openQuestions: normalizeStringList(input.openQuestions, 12, 400),
    reviewChecklist: normalizeStringList(input.reviewChecklist, 12, 400),
    reviewNotes: clean(input.reviewNotes, 2000),
    confirmedAt: status === "confirmed" ? clean(input.confirmedAt, 80) : ""
  };
}

export function normalizePhaseActionConcept(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const status = PLAN_STATUSES.has(clean(input.status, 24)) ? clean(input.status, 24) : "empty";
  const phaseIds = new Set();
  const phases = (Array.isArray(input.phases) ? input.phases : []).slice(0, 12).map((item, index) => {
    const id = slugId(item?.id, `phase-${index + 1}`);
    if (!clean(item?.name, 120) || phaseIds.has(id)) return null;
    phaseIds.add(id);
    // CONOPS fields: blue/red actions; keep primary/secondary as aliases for older readers.
    // Drop assistant meta / disclaimer pollution that occasionally leaks into model fields.
    const blueActions = normalizeActionList(item?.blueActions ?? item?.primaryActions, 8, 400);
    const redActions = normalizeActionList(item?.redActions ?? item?.secondaryActions, 8, 400);
    return {
      id,
      name: clean(item.name, 120),
      timeWindow: clean(item?.timeWindow || item?.timeRange || item?.window, 80),
      sequence: Number.isFinite(Number(item?.sequence)) ? Math.max(1, Math.min(12, Math.trunc(Number(item.sequence)))) : index + 1,
      objective: clean(item?.objective, 500) || "阶段作战目标",
      blueActions,
      redActions,
      primaryActions: blueActions,
      secondaryActions: redActions,
      entryConditions: normalizeStringList(item?.entryConditions, 8, 300),
      exitConditions: normalizeStringList(item?.exitConditions, 8, 300),
      expectedEffects: normalizeStringList(item?.expectedEffects, 8, 300),
      forceIds: normalizeStringList(item?.forceIds, 24, 60)
    };
  }).filter(Boolean);
  const transitions = (Array.isArray(input.transitions) ? input.transitions : []).slice(0, 24).map((item, index) => {
    const fromPhaseId = clean(item?.fromPhaseId, 60);
    const toPhaseId = clean(item?.toPhaseId, 60);
    if (!phaseIds.has(fromPhaseId) || !phaseIds.has(toPhaseId) || fromPhaseId === toPhaseId) return null;
    return {
      id: slugId(item?.id, `transition-${index + 1}`),
      fromPhaseId,
      toPhaseId,
      condition: clean(item?.condition, 400) || "满足阶段转换条件",
      note: clean(item?.note, 400)
    };
  }).filter(Boolean);
  return {
    version: 1,
    status,
    generation: normalizeGeneration(input.generation),
    phases,
    transitions,
    openQuestions: normalizeStringList(input.openQuestions, 12, 400),
    reviewChecklist: normalizeStringList(input.reviewChecklist, 12, 400),
    reviewNotes: clean(input.reviewNotes, 2000),
    confirmedAt: status === "confirmed" ? clean(input.confirmedAt, 80) : ""
  };
}

export function isForceMissionPlanConfirmed(plan, storage = {}) {
  const normalized = normalizeForceMissionPlan(plan);
  return normalized.status === "confirmed"
    && normalized.tasks.length > 0
    && Boolean(normalized.tasksConfirmedAt)
    && normalized.forces.length > 0
    && normalized.forces.every((force) => force.role && force.task)
    && normalized.combatForces.length > 0
    && normalized.combatForces.every((force) => force.role && force.task && force.missionType)
    && !storage?.stale;
}

export function isOperationalTaskPlanConfirmed(plan, storage = {}) {
  const normalized = normalizeForceMissionPlan(plan);
  return normalized.tasks.length > 0
    && Boolean(normalized.tasksConfirmedAt)
    && !storage?.stale;
}

export function operationalTaskPlanIncompleteReasons(plan, storage = {}) {
  const normalized = normalizeForceMissionPlan(plan);
  const reasons = [];
  if (storage?.stale) reasons.push("复核已过期的作战任务");
  if (!normalized.tasks.length) reasons.push("作战任务草案");
  else if (!normalized.tasksConfirmedAt) reasons.push("确认作战任务");
  return reasons;
}

export function combatForcePlanIncompleteReasons(plan, storage = {}) {
  const normalized = normalizeForceMissionPlan(plan);
  const reasons = [];
  if (storage?.stale) reasons.push("复核已过期的作战兵力");
  if (!normalized.forces.length) reasons.push("概念兵力草案");
  else if (normalized.forces.some((force) => !force.task)) reasons.push("补全概念兵力任务");
  if (!normalized.combatForces.length) reasons.push("作战兵力草案");
  else if (normalized.combatForces.some((force) => !force.task || !force.missionType)) reasons.push("补全作战兵力任务/类型");
  if (normalized.status !== "confirmed") reasons.push("确认作战兵力");
  return reasons;
}

export function isPhaseActionConceptConfirmed(plan, storage = {}) {
  const normalized = normalizePhaseActionConcept(plan);
  return normalized.status === "confirmed"
    && normalized.phases.length >= 2
    && normalized.phases.every((phase) => phase.objective && (phase.blueActions?.length || phase.primaryActions?.length))
    && !storage?.stale;
}

export function forceMissionPlanIncompleteReasons(plan, storage = {}) {
  return [
    ...operationalTaskPlanIncompleteReasons(plan, storage),
    ...combatForcePlanIncompleteReasons(plan, storage)
  ];
}

export function createOperationalTasksFromPhaseAction(plan = {}, phaseAction = {}, draft = null, { source = "local" } = {}) {
  const normalized = normalizeForceMissionPlan(plan);
  const phases = Array.isArray(phaseAction?.phases) ? phaseAction.phases : [];
  const fallbackTasks = [];
  for (const phase of phases) {
    const blue = Array.isArray(phase?.blueActions) ? phase.blueActions : (phase?.primaryActions || []);
    const red = Array.isArray(phase?.redActions) ? phase.redActions : (phase?.secondaryActions || []);
    for (const [side, actions] of [["friendly", blue], ["hostile", red]]) {
      actions.slice(0, 8).forEach((action, index) => {
        const text = clean(action, 400);
        if (!text) return;
        fallbackTasks.push({
          id: `${slugId(phase?.id, "phase")}-${side === "friendly" ? "blue" : "red"}-${index + 1}`,
          name: text.slice(0, 120),
          side,
          phaseId: clean(phase?.id, 60),
          missionType: inferTaskMissionType(text),
          area: normalizeOperationalTaskArea(phase?.area || phase?.missionArea || phase?.taskArea),
          objective: text,
          expectedEffect: (phase?.expectedEffects || [])[0] || "",
          sourceAction: text,
          notes: ""
        });
      });
    }
  }
  const generatedTasks = (Array.isArray(draft?.tasks) && draft.tasks.length ? draft.tasks : fallbackTasks).map((task) => ({
    ...task,
    name: normalizeGeneratedTaskName(task?.name, task?.missionType, task?.objective || task?.sourceAction)
  }));
  const tasks = uniquifyOperationalTaskNames(generatedTasks, phases);
  return normalizeForceMissionPlan({
    ...normalized,
    status: normalized.status === "empty" ? "draft" : normalized.status,
    generation: {
      source,
      generatedAt: new Date().toISOString(),
      promptSummary: source === "ai" ? "AI 根据简报与阶段行动生成作战任务及任务区域候选" : "根据阶段行动生成本地作战任务草案"
    },
    tasks,
    tasksConfirmedAt: ""
  });
}

export function buildOperationalTaskGenerationBatches(phaseAction = {}, maxTasks = 6) {
  const limit = Math.max(1, Math.min(12, Number(maxTasks) || 6));
  const entries = [];
  for (const phase of Array.isArray(phaseAction?.phases) ? phaseAction.phases : []) {
    const blueActions = Array.isArray(phase?.blueActions) ? phase.blueActions : (phase?.primaryActions || []);
    const redActions = Array.isArray(phase?.redActions) ? phase.redActions : (phase?.secondaryActions || []);
    blueActions.forEach((action) => entries.push({ phase, side: "friendly", action }));
    redActions.forEach((action) => entries.push({ phase, side: "hostile", action }));
  }
  const batches = [];
  for (let offset = 0; offset < entries.length; offset += limit) {
    const slice = entries.slice(offset, offset + limit);
    const phases = [];
    const byId = new Map();
    for (const entry of slice) {
      const phaseId = clean(entry.phase?.id, 60) || `phase-${phases.length + 1}`;
      let copy = byId.get(phaseId);
      if (!copy) {
        copy = { ...entry.phase, id: phaseId, blueActions: [], redActions: [], primaryActions: [], secondaryActions: [] };
        byId.set(phaseId, copy);
        phases.push(copy);
      }
      if (entry.side === "hostile") {
        copy.redActions.push(entry.action);
        copy.secondaryActions.push(entry.action);
      } else {
        copy.blueActions.push(entry.action);
        copy.primaryActions.push(entry.action);
      }
    }
    batches.push({
      status: phaseAction?.status || "confirmed",
      phases,
      transitions: [],
      expectedTaskCount: slice.length
    });
  }
  return batches;
}

export function confirmOperationalTasks(plan = {}) {
  const normalized = normalizeForceMissionPlan(plan);
  if (!normalized.tasks.length) throw new Error("Operational tasks require at least one task");
  if (normalized.tasks.some((task) => !task.area?.name || task.area.name === "待人工明确" || !(task.area.points || []).some((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)))) {
    throw new Error("Operational tasks require complete task areas and coordinates");
  }
  return normalizeForceMissionPlan({ ...normalized, tasksConfirmedAt: new Date().toISOString() });
}

export function updateOperationalTask(plan = {}, taskId = "", patch = {}) {
  const normalized = normalizeForceMissionPlan(plan);
  return normalizeForceMissionPlan({
    ...normalized,
    tasks: normalized.tasks.map((task) => task.id === taskId ? { ...task, ...patch } : task),
    tasksConfirmedAt: ""
  });
}

export function removeOperationalTask(plan = {}, taskId = "") {
  const normalized = normalizeForceMissionPlan(plan);
  const tasks = normalized.tasks.filter((task) => task.id !== taskId);
  return normalizeForceMissionPlan({ ...normalized, tasks, tasksConfirmedAt: "" });
}

export function updateOperationalTaskArea(plan = {}, taskId = "", patch = {}) {
  const normalized = normalizeForceMissionPlan(plan);
  const task = normalized.tasks.find((item) => item.id === taskId);
  if (!task) return normalized;
  return updateOperationalTask(normalized, taskId, {
    area: normalizeOperationalTaskArea({ ...task.area, ...patch })
  });
}

export function updateOperationalTaskAreaPoint(plan = {}, taskId = "", pointId = "", patch = {}) {
  const normalized = normalizeForceMissionPlan(plan);
  const task = normalized.tasks.find((item) => item.id === taskId);
  if (!task) return normalized;
  const points = task.area.points.map((point) => point.id === pointId ? { ...point, ...patch } : point);
  return updateOperationalTaskArea(normalized, taskId, { points });
}

export function addOperationalTaskAreaPoint(plan = {}, taskId = "") {
  const normalized = normalizeForceMissionPlan(plan);
  const task = normalized.tasks.find((item) => item.id === taskId);
  if (!task) return normalized;
  const index = task.area.points.length + 1;
  return updateOperationalTaskArea(normalized, taskId, {
    points: [...task.area.points, { id: `point-${index}`, label: `参考点 ${index}`, latitude: null, longitude: null }]
  });
}

export function removeOperationalTaskAreaPoint(plan = {}, taskId = "", pointId = "") {
  const normalized = normalizeForceMissionPlan(plan);
  const task = normalized.tasks.find((item) => item.id === taskId);
  if (!task) return normalized;
  return updateOperationalTaskArea(normalized, taskId, {
    points: task.area.points.filter((point) => point.id !== pointId)
  });
}

function normalizeOperationalTaskArea(value) {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : { name: clean(value, 160) };
  const type = TASK_AREA_TYPES.has(clean(input.type, 30)) ? clean(input.type, 30) : "other";
  const geometryType = TASK_AREA_GEOMETRIES.has(clean(input.geometryType, 30))
    ? clean(input.geometryType, 30)
    : "polygon";
  const pointIds = new Set();
  const points = (Array.isArray(input.points) ? input.points : Array.isArray(input.coordinates) ? input.coordinates : [])
    .slice(0, 24)
    .map((point, index) => {
      const latitude = finiteCoordinate(point?.latitude ?? point?.lat, -90, 90);
      const longitude = finiteCoordinate(point?.longitude ?? point?.lon ?? point?.lng, -180, 180);
      const id = slugId(point?.id, `point-${index + 1}`);
      if (pointIds.has(id)) return null;
      pointIds.add(id);
      return {
        id,
        label: clean(point?.label || point?.name, 80) || `参考点 ${index + 1}`,
        latitude,
        longitude
      };
    })
    .filter(Boolean);
  return {
    name: clean(input.name, 160) || "待人工明确",
    type,
    geometryType,
    coordinateSystem: "WGS84",
    points,
    radiusNm: geometryType === "circle" ? Math.max(0, Math.min(5000, Number(input.radiusNm) || 0)) : 0,
    description: clean(input.description || input.notes, 500),
    basis: clean(input.basis, 500),
    needsReview: input.needsReview !== false
  };
}

function finiteCoordinate(value, min, max) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? Number(number.toFixed(6)) : null;
}

function inferTaskMissionType(value = "") {
  const text = clean(value, 500).toLowerCase();
  const rules = [
    ["sead", /防空压制|sead/],
    ["dead", /防空摧毁|dead/],
    ["recon", /侦察|监视|监测|搜索|识别|态势/],
    ["intercept", /截击|拦截/],
    ["air_superiority", /制空|空中优势/],
    ["patrol_aaw", /防空巡逻|空中巡逻|cap/],
    ["patrol_asuw", /反舰巡逻|海上打击/],
    ["patrol_asw", /反潜巡逻/],
    ["asw_attack", /反潜攻击/],
    ["aew", /预警/],
    ["ecm", /电子对抗|电子干扰|压制干扰/],
    ["escort", /护航|伴随掩护/],
    ["tanker", /空中加油/],
    ["cargo", /运输|输送|投送/],
    ["landing", /登陆|两栖/],
    ["sar", /搜救|救援/],
    ["area_defense", /区域防御|要地防御|防卫/],
    ["command", /指挥|控制|协同决策/],
    ["support", /支援|保障|补给/],
    ["strike", /打击|突击|攻击|摧毁/]
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || "other";
}

function normalizeGeneratedTaskName(value = "", missionType = "other", context = "") {
  const raw = clean(value, 120)
    .replace(/^T\s*[+-]?\s*\d{1,3}(?::\d{1,2})?\s*(?:起|后|前)?[，,、:：\s]*/iu, "")
    .replace(/[，,；;。].*$/u, "")
    .trim();
  const fallbackByType = {
    strike: "对地打击任务", standoff_strike: "防区外打击任务", sead: "防空压制任务", dead: "防空摧毁任务",
    bai_cas: "战场遮断支援任务", intercept: "空中截击任务", air_superiority: "制空任务", patrol_aaw: "防空巡逻任务",
    patrol_asuw: "反舰巡逻任务", patrol_asw: "反潜巡逻任务", asw_attack: "反潜攻击任务", recon: "侦察监视任务",
    aew: "空中预警任务", ecm: "电子对抗任务", escort: "护航任务", support: "作战支援任务", command: "指挥控制任务",
    ferry: "兵力转场任务", cargo: "运输投送任务", tanker: "空中加油任务", sar: "战斗搜救任务", mining: "海上布雷任务",
    mcm: "反水雷任务", landing: "登陆投送任务", area_defense: "区域防御任务", other: "综合作战任务"
  };
  const inferredType = normalizeCmoMissionType(missionType, inferTaskMissionType(`${raw} ${context}`));
  const concise = raw.replace(/任务$/u, "");
  if (raw.endsWith("任务") && concise.length >= 2 && concise.length <= 12 && !/[+\d]/u.test(concise)) return raw;
  return fallbackByType[inferredType] || fallbackByType.other;
}

function uniquifyOperationalTaskNames(tasks = [], phases = []) {
  const phaseNames = new Map(phases.map((phase) => [clean(phase?.id, 60), clean(phase?.name, 40).replace(/阶段$/u, "")]));
  const totals = new Map();
  tasks.forEach((task) => totals.set(task.name, (totals.get(task.name) || 0) + 1));
  const used = new Set();
  return tasks.map((task, index) => {
    let name = task.name;
    if ((totals.get(name) || 0) > 1 || used.has(name)) {
      const phase = phaseNames.get(clean(task.phaseId, 60)) || "";
      const area = task.area?.name && task.area.name !== "待人工明确" ? clean(task.area.name, 20).replace(/[区域区]$/u, "") : "";
      const side = task.side === "hostile" ? "红方" : "蓝方";
      const base = name.replace(/任务$/u, "");
      const qualifier = `${side}${phase || area}`.slice(0, 10);
      name = `${qualifier}${base}任务`.slice(0, 30);
    }
    if (used.has(name)) name = `${name.replace(/任务$/u, "")}第${index + 1}任务`.slice(0, 30);
    used.add(name);
    return { ...task, name };
  });
}

export function phaseActionConceptIncompleteReasons(plan, storage = {}) {
  const normalized = normalizePhaseActionConcept(plan);
  const reasons = [];
  if (storage?.stale) reasons.push("复核已过期的阶段与行动");
  if (normalized.phases.length < 2) reasons.push("阶段划分草案（至少两阶段）");
  else if (normalized.phases.some((phase) => !(phase.blueActions?.length || phase.primaryActions?.length))) reasons.push("补全阶段蓝方行动");
  if (normalized.status !== "confirmed") reasons.push("确认阶段与行动");
  return reasons;
}

/**
 * Build force-mission draft from AI/local output.
 * @param {"both"|"concept"|"combat"} options.layer
 *   - both: full draft (default, backward compatible)
 *   - concept: only replace concept forces; keep previous combatForces (or empty)
 *   - combat: only replace combat forces; require previous/current concept forces
 * @param {object|null} options.previous existing plan to merge with for layer-scoped generate
 */
export function createForceMissionPlanFromBrief(brief = {}, plan = null, {
  source = "ai",
  phaseAction = null,
  layer = "both",
  previous = null
} = {}) {
  const generatedAt = new Date().toISOString();
  const objective = clean(brief.objective || brief.researchIntent, 120) || "作战概念研究";
  const draft = plan && typeof plan === "object" ? plan : {};
  const prev = previous && typeof previous === "object" ? previous : {};
  const scope = layer === "concept" || layer === "combat" ? layer : "both";
  const phases = Array.isArray(phaseAction?.phases)
    ? phaseAction.phases
    : (Array.isArray(draft.phaseAction?.phases) ? draft.phaseAction.phases : []);
  const fallbackForces = buildPhaseAwareConceptForces(objective, phases, brief);

  // Concept layer source of truth depends on generation scope.
  let forces;
  if (scope === "combat") {
    forces = Array.isArray(prev.forces) && prev.forces.length
      ? prev.forces
      : (Array.isArray(draft.forces) && draft.forces.length ? draft.forces : fallbackForces);
  } else if (Array.isArray(draft.forces) && draft.forces.length) {
    forces = draft.forces;
  } else {
    forces = fallbackForces;
  }
  // Concept equipment follows the research brief (not a fixed US-vs-China template).
  forces = ensureConceptEquipment(forces, {
    forceReseed: scope === "concept" || scope === "both",
    brief
  });

  const forceIds = new Set(forces.map((item, index) => slugId(item?.id, `force-${index + 1}`)));
  const fallbackCombatForces = buildCombatForcesFromConcept(forces, brief, phaseAction);

  let combatForces;
  if (scope === "concept") {
    // Concept-only generate: keep prior combat draft if still linked; otherwise empty until combat step.
    combatForces = Array.isArray(prev.combatForces) ? prev.combatForces : [];
  } else if (Array.isArray(draft.combatForces) && draft.combatForces.length) {
    // AI combat drafts may be thin; expand if too few relative to concept coverage.
    combatForces = expandThinCombatDraft(draft.combatForces, forces, brief, phaseAction);
  } else {
    combatForces = fallbackCombatForces;
  }

  const fallbackRelations = buildDefaultForceRelations(forces, combatForces);
  let relations;
  if (scope === "concept") {
    const draftRels = Array.isArray(draft.relations) ? draft.relations : [];
    const conceptIds = new Set(forces.map((item, index) => slugId(item?.id, `force-${index + 1}`)));
    const conceptRels = draftRels.filter((item) => conceptIds.has(clean(item?.fromForceId, 60)) && conceptIds.has(clean(item?.toForceId, 60)));
    const prevCombatRels = (Array.isArray(prev.relations) ? prev.relations : []).filter((item) => {
      const from = clean(item?.fromForceId, 60);
      const to = clean(item?.toForceId, 60);
      return !conceptIds.has(from) || !conceptIds.has(to);
    });
    relations = conceptRels.length || prevCombatRels.length
      ? [...conceptRels, ...prevCombatRels]
      : buildDefaultForceRelations(forces, combatForces);
  } else if (scope === "combat") {
    const draftRels = Array.isArray(draft.relations) ? draft.relations : [];
    const prevConceptRels = (Array.isArray(prev.relations) ? prev.relations : []).filter((item) => {
      const from = clean(item?.fromForceId, 60);
      const to = clean(item?.toForceId, 60);
      return forceIds.has(from) && forceIds.has(to);
    });
    relations = draftRels.length
      ? [...prevConceptRels, ...draftRels]
      : fallbackRelations;
  } else {
    relations = Array.isArray(draft.relations) && draft.relations.length ? draft.relations : fallbackRelations;
  }

  const summaryByLayer = {
    concept: phases.length
      ? "根据阶段与简报生成红蓝双方概念兵力"
      : "根据概念简报生成红蓝双方概念兵力",
    combat: "根据简报、阶段行动与概念兵力扩展生成 CMO 向作战编成",
    both: phases.length
      ? "根据阶段与简报生成红蓝双方概念/作战兵力草案"
      : "根据概念简报生成红蓝双方概念/作战兵力草案"
  };

  return normalizeForceMissionPlan({
    status: "draft",
    generation: {
      source,
      generatedAt,
      promptSummary: summaryByLayer[scope],
      reviewNotes: clean(draft.reviewNotes || prev.reviewNotes, 2000)
    },
    tasks: Array.isArray(prev.tasks) ? prev.tasks : [],
    tasksConfirmedAt: clean(prev.tasksConfirmedAt, 80),
    forces,
    combatForces,
    relations,
    openQuestions: Array.isArray(draft.openQuestions) && draft.openQuestions.length
      ? draft.openQuestions
      : (Array.isArray(prev.openQuestions) && prev.openQuestions.length
        ? prev.openQuestions
        : ["各阶段蓝方概念兵力是否覆盖 blueActions？", "各阶段红方概念兵力是否覆盖 redActions？", "作战兵力是否挂接到同侧概念单元？", clean(brief.risk, 200) || "主要风险是否映射到红蓝职责？"].filter(Boolean)),
    reviewChecklist: [
      "蓝方/红方概念兵力是否均按阶段覆盖关键行动",
      "每个概念兵力是否绑定 1 个真实装备类型",
      "作战兵力是否由概念细化并挂接同侧概念单元",
      "作战编成数量/平台是否合理（研究级）"
    ],
    reviewNotes: clean(draft.reviewNotes || prev.reviewNotes, 2000)
  });
}

/**
 * Derive combat forces from existing concept forces (for legacy drafts or one-click expansion).
 */
export function deriveCombatForcesFromConcept(plan = {}, brief = {}, phaseAction = null) {
  const normalized = normalizeForceMissionPlan(plan);
  if (!normalized.forces.length) {
    return normalized;
  }
  const derived = buildCombatForcesFromConcept(normalized.forces, brief, phaseAction);
  const relations = buildDefaultForceRelations(normalized.forces, derived);
  return normalizeForceMissionPlan({
    ...normalized,
    status: "draft",
    confirmedAt: "",
    combatForces: derived,
    relations: relations.length ? relations : normalized.relations
  });
}

/**
 * Add a manual combat force unit to a plan.
 */
export function addCombatForce(plan = {}, forceData = {}) {
  const normalized = normalizeForceMissionPlan(plan);
  const index = (normalized.combatForces || []).length + 1;
  const id = clean(forceData.id, 60) || `combat-custom-${Date.now()}-${index}`;
  const side = forceData.side === "hostile" ? "hostile" : "friendly";
  const name = clean(forceData.name, 120) || (side === "hostile" ? `红方·作战编组${index}` : `蓝方·作战编组${index}`);
  const conceptForceId = clean(forceData.conceptForceId, 60)
    || (normalized.forces.find((f) => f.side === side)?.id || "");
  const newForce = {
    id,
    name,
    side,
    role: FORCE_ROLES.has(forceData.role) ? forceData.role : "maneuver",
    conceptForceId,
    group: clean(forceData.group, 120) || (side === "hostile" ? "红方作战编组" : "蓝方作战编组"),
    missionType: normalizeCmoMissionType(forceData.missionType, "strike"),
    task: clean(forceData.task, 400) || "执行阶段作战任务与协同",
    taskRefs: normalizeStringList(forceData.taskRefs, 24, 60),
    phaseIds: normalizeStringList(forceData.phaseIds, 12, 60),
    platforms: normalizePlatformRefs(forceData.platforms, 8),
    notes: clean(forceData.notes, 600) || "手工添加作战单元"
  };
  return normalizeForceMissionPlan({
    ...normalized,
    status: "draft",
    confirmedAt: "",
    combatForces: [...normalized.combatForces, newForce]
  });
}

/**
 * Remove a manual/AI combat force unit from a plan.
 */
export function removeCombatForce(plan = {}, forceId = "") {
  const normalized = normalizeForceMissionPlan(plan);
  const id = String(forceId || "").trim();
  if (!id) return normalized;
  const combatForces = (normalized.combatForces || []).filter((item) => item.id !== id);
  const relations = (normalized.relations || []).filter((rel) => rel.fromForceId !== id && rel.toForceId !== id);
  return normalizeForceMissionPlan({
    ...normalized,
    status: "draft",
    confirmedAt: "",
    combatForces,
    relations
  });
}

/**
 * Update a combat force unit's properties.
 */
export function updateCombatForce(plan = {}, forceId = "", patch = {}) {
  const normalized = normalizeForceMissionPlan(plan);
  const id = String(forceId || "").trim();
  if (!id) return normalized;
  const combatForces = (normalized.combatForces || []).map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      ...patch,
      platforms: patch.platforms ? normalizePlatformRefs(patch.platforms, 8) : item.platforms
    };
  });
  return normalizeForceMissionPlan({
    ...normalized,
    status: "draft",
    confirmedAt: "",
    combatForces
  });
}

/**
 * Build phase-differentiated concept forces (blue + red).
 * Duties are selected from blueActions/redActions keywords — not a fixed 4+3 template every phase.
 */
function buildPhaseAwareConceptForces(objective, phases = [], brief = {}) {
  const list = Array.isArray(phases) ? phases.filter((item) => clean(item?.name, 120) || clean(item?.id, 60)) : [];
  if (list.length < 1) {
    return [
      { id: "sense-fusion", name: "蓝方·预警航迹融合", side: "friendly", role: "sense", group: "蓝方编组", missionType: "recon", task: `围绕“${objective}”汇聚多源探测，形成可交战的统一态势输入`, phaseIds: [], platforms: [], notes: "蓝方" },
      { id: "command-auth", name: "蓝方·交战授权控制", side: "friendly", role: "command", group: "蓝方编组", missionType: "command", task: "划定授权边界与交战排序规则，避免过早消耗内层能力", phaseIds: [], platforms: [], notes: "蓝方" },
      { id: "outer-engage", name: "蓝方·主行动接战", side: "friendly", role: "airDefense", group: "蓝方编组", missionType: "patrol_aaw", task: "在主要威胁轴上承担接战与消耗", phaseIds: [], platforms: [], notes: "蓝方" },
      { id: "support-magazine", name: "蓝方·持续保障管理", side: "friendly", role: "support", group: "蓝方编组", missionType: "support", task: "按阶段管理传感器开机与弹药消耗节奏", phaseIds: [], platforms: [], notes: "蓝方" },
      { id: "red-strike", name: "红方·主压力轴", side: "hostile", role: "maneuver", group: "红方编组", missionType: "strike", task: "组织主轴行动，对蓝方关键节点形成压力", phaseIds: [], platforms: [], notes: "红方" },
      { id: "red-command", name: "红方·行动协同", side: "hostile", role: "command", group: "红方编组", missionType: "command", task: "协调多轴进入时机与转换", phaseIds: [], platforms: [], notes: "红方" },
      { id: "red-ew", name: "红方·对抗施压", side: "hostile", role: "sense", group: "红方编组", missionType: "sead", task: clean(brief.risk, 200) || "实施诱偏、压制或扰乱", phaseIds: [], platforms: [], notes: "红方" }
    ];
  }

  const phaseMeta = list.map((phase, index) => {
    const sequence = Number.isFinite(Number(phase?.sequence)) ? Math.trunc(Number(phase.sequence)) : index + 1;
    const id = slugId(phase?.id, `phase-${sequence}`);
    const name = clean(phase?.name, 80) || `阶段${sequence}`;
    const objectiveText = clean(phase?.objective, 200) || objective;
    const blue = normalizeStringList(phase?.blueActions ?? phase?.primaryActions, 16, 280);
    const red = normalizeStringList(phase?.redActions ?? phase?.secondaryActions, 16, 280);
    const window = clean(phase?.timeWindow, 80);
    return { id, name, sequence, objectiveText, blue, red, window, index };
  });
  const allPhaseIds = phaseMeta.map((item) => item.id);
  const forces = [];
  const domainHint = inferConceptDomainHint(objective, brief, phaseMeta);
  const usedBlueNames = new Set();
  const usedRedNames = new Set();

  for (const phase of phaseMeta) {
    const units = buildConceptUnitsForPhase(phase, domainHint, { usedBlueNames, usedRedNames });
    for (const unit of units) {
      forces.push(unit);
      if (unit.side === "friendly") usedBlueNames.add(normalizeConceptNameKey(unit.name));
      if (unit.side === "hostile") usedRedNames.add(normalizeConceptNameKey(unit.name));
    }
  }

  // Cross-phase anchors (not a hard cap on per-phase units — those expand with actions).
  forces.push({
    id: "cross-blue-command",
    name: "蓝方·跨阶段指挥授权",
    side: "friendly",
    role: "command",
    group: "蓝方跨阶段",
    missionType: "command",
    task: `围绕“${objective}”保持交战图/授权连续，按阶段转换门槛调整优先级`,
    phaseIds: allPhaseIds,
    platforms: [],
    notes: "蓝方·跨阶段"
  });
  forces.push({
    id: "cross-blue-support",
    name: domainHint === "offense" ? "蓝方·跨阶段持续保障" : "蓝方·跨阶段弹药传感器管理",
    side: "friendly",
    role: "support",
    group: "蓝方跨阶段",
    missionType: "support",
    task: "按阶段节奏管理链路、补给或传感器/弹药，防止关键阶段过早耗尽",
    phaseIds: allPhaseIds,
    platforms: [],
    notes: "蓝方·跨阶段"
  });
  forces.push({
    id: "cross-blue-survive",
    name: "蓝方·跨阶段关键节点生存",
    side: "friendly",
    role: "support",
    group: "蓝方跨阶段",
    missionType: "support",
    task: "保障预警、火控与指挥关键节点在高压段的生存与功能连续",
    phaseIds: allPhaseIds,
    platforms: [],
    notes: "蓝方·跨阶段"
  });
  forces.push({
    id: "cross-red-command",
    name: "红方·跨阶段行动协同",
    side: "hostile",
    role: "command",
    group: "红方跨阶段",
    missionType: "command",
    task: "维持红方多阶段行动轴协同与转换节奏",
    phaseIds: allPhaseIds,
    platforms: [],
    notes: "红方·跨阶段"
  });
  forces.push({
    id: "cross-red-pressure",
    name: domainHint === "offense" ? "红方·跨阶段体系抗击" : "红方·跨阶段主压力轴",
    side: "hostile",
    role: "maneuver",
    group: "红方跨阶段",
    missionType: "strike",
    task: clean(brief.risk, 200)
      || (domainHint === "offense"
        ? "跨阶段组织抗击与规避，迟滞蓝方主行动轴"
        : "跨阶段保持对蓝方关键节点的可观察压力"),
    phaseIds: allPhaseIds,
    platforms: [],
    notes: "红方·跨阶段"
  });
  forces.push({
    id: "cross-red-ew",
    name: "红方·跨阶段对抗施压",
    side: "hostile",
    role: "sense",
    group: "红方跨阶段",
    missionType: "sead",
    task: "跨阶段组织诱偏、压制或欺骗，扰乱蓝方交战排序与传感器可信度",
    phaseIds: allPhaseIds,
    platforms: [],
    notes: "红方·跨阶段"
  });
  return forces;
}

function inferConceptDomainHint(objective = "", brief = {}, phases = []) {
  const text = [
    objective,
    brief.researchIntent,
    brief.approach,
    brief.expectedEffects,
    ...phases.flatMap((phase) => [phase.name, phase.objectiveText, ...(phase.blue || []), ...(phase.red || [])])
  ].join(" ");
  if (/进攻|突击|封控|破击|夺控|打击群/.test(text) && !/防空|反导|拦截|预警/.test(text)) return "offense";
  if (/防空|反导|拦截|预警|IAMD|航迹|交战/.test(text)) return "iamd";
  return "general";
}

function normalizeConceptNameKey(name = "") {
  return clean(name, 80)
    .replace(/^(蓝方|红方)[·•\s]*/u, "")
    .replace(/[·•\s]/gu, "")
    .toLowerCase();
}

/** Score duty themes from free text (phase actions / objective). */
function scoreDutyThemes(text = "", side = "blue") {
  const t = String(text || "");
  const scores = {};
  const bump = (key, n = 1) => { scores[key] = (scores[key] || 0) + n; };

  if (/探测|跟踪|航迹|融合|分批|预警|侦察|监视|识别|指示|开机|传感器|态势/.test(t)) bump("sense", 3);
  if (/授权|指挥|协同|排序|交战图|控制|决策|聚焦|确认|核验|边界|门槛/.test(t)) bump("command", 3);
  if (/外层|中层|远程|区域防空|远程拦截|消耗|接战|防空拦截/.test(t)) bump("outer", 3);
  if (/内层|末端|补射|漏防|点防|要地|近程/.test(t)) bump("inner", 3);
  if (/拦截|打击|突击|突防|封控|破击|火力|交战|释放|进攻|主战|主轴/.test(t)) bump("action", 2);
  if (/保障|弹药|补给|链路|重组|持续|库存|油料/.test(t)) bump("support", 3);
  if (/评估|战果|复核|反馈|效果/.test(t)) bump("assess", 2);
  if (/诱偏|压制|干扰|电子|欺骗|隐身|饱和|多轴|诱饵/.test(t)) bump("ew", 3);
  if (/生存|防护|疏散|抗毁|关键节点|指挥所/.test(t)) bump("survive", 2);
  if (/展开|预置|部署|进场|就位|校核/.test(t)) bump("deploy", 2);
  if (/撤离|退出|收拢|终止|结束/.test(t)) bump("recover", 2);

  if (side === "red") {
    if (/接近|进入|突防|饱和|多方向|多轴/.test(t)) bump("action", 2);
    if (/抗击|规避|机动|反击/.test(t)) bump("defend", 2);
  }
  return scores;
}

function pickTopThemes(scores = {}, { min = 0, max = Infinity, fallback = [] } = {}) {
  const ranked = Object.entries(scores)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k]) => k);
  const out = [];
  const limit = Number.isFinite(Number(max)) ? Number(max) : Number.POSITIVE_INFINITY;
  for (const key of ranked) {
    if (out.length >= limit) break;
    if (!out.includes(key)) out.push(key);
  }
  for (const key of fallback) {
    if (out.length >= min) break;
    if (!out.includes(key)) out.push(key);
  }
  return Number.isFinite(limit) ? out.slice(0, limit) : out;
}

function dutyCatalog(domainHint = "general") {
  const blue = {
    sense: { role: "sense", missionType: "recon", labels: ["航迹融合", "威胁分批", "预警监视", "目标指示", "传感器管控"] },
    command: { role: "command", missionType: "command", labels: ["交战授权", "交战排序", "协同控制", "阶段转换控制", "统一交战图维护"] },
    outer: { role: "airDefense", missionType: "patrol_aaw", labels: ["外层接战", "远程拦截", "区域防空", "外层消耗"] },
    inner: { role: "airDefense", missionType: "patrol_aaw", labels: ["内层补射", "末端防护", "要地点防", "漏防补救"] },
    action: {
      role: domainHint === "offense" ? "maneuver" : "airDefense",
      missionType: domainHint === "offense" ? "strike" : "patrol_aaw",
      labels: domainHint === "offense" ? ["主行动突击", "窗口突击", "封控塑势", "体系破击"] : ["主轴接战", "分层拦截", "火力释放", "交战实施"]
    },
    support: { role: "support", missionType: "support", labels: ["弹药管理", "传感器保障", "链路保障", "持续补给"] },
    assess: { role: "sense", missionType: "recon", labels: ["效果评估", "战果复核", "态势反馈"] },
    ew: { role: "sense", missionType: "sead", labels: ["电子防护", "抗干扰", "频谱管控"] },
    survive: { role: "support", missionType: "support", labels: ["节点生存", "关键防护", "抗毁重组"] },
    deploy: { role: "maneuver", missionType: "support", labels: ["力量展开", "预置就位", "部署校核"] },
    recover: { role: "support", missionType: "support", labels: ["撤离重组", "收拢复位", "终止管控"] }
  };
  const red = {
    sense: { role: "sense", missionType: "recon", labels: ["侦察指示", "目标监视", "威胁引导"] },
    command: { role: "command", missionType: "command", labels: ["行动协同", "多轴同步", "转换控制"] },
    action: { role: "maneuver", missionType: "strike", labels: ["突防主轴", "饱和进入", "主压力轴", "突击轴"] },
    ew: { role: "sense", missionType: "sead", labels: ["诱偏压制", "电子干扰", "传感器压制", "欺骗佯动"] },
    outer: { role: "airDefense", missionType: "patrol_aaw", labels: ["外围抗击", "远程拦截抗击"] },
    inner: { role: "airDefense", missionType: "patrol_aaw", labels: ["要点抗击", "末端反击"] },
    defend: { role: "airDefense", missionType: "patrol_aaw", labels: ["体系抗击", "机动规避", "防护反击"] },
    support: { role: "support", missionType: "support", labels: ["突防保障", "佯动支援"] },
    assess: { role: "sense", missionType: "recon", labels: ["效果侦察", "打击评估"] },
    deploy: { role: "maneuver", missionType: "strike", labels: ["预置接近", "多轴展开"] },
    recover: { role: "maneuver", missionType: "support", labels: ["撤离收拢", "压力维持"] },
    survive: { role: "support", missionType: "support", labels: ["节点防护", "抗毁机动"] }
  };
  return { blue, red };
}

function chooseDutyLabel(theme, catalogEntry, { usedNames, phaseIndex = 0, actionHint = "" } = {}) {
  const labels = catalogEntry?.labels || [theme];
  // Prefer a label not used yet; rotate by phase index.
  const ordered = [...labels.slice(phaseIndex % labels.length), ...labels];
  for (const label of ordered) {
    const key = normalizeConceptNameKey(label);
    if (!usedNames?.has(key)) return label;
  }
  // Derive short name from action text if all labels exhausted.
  const fromAction = extractDutyHintFromAction(actionHint);
  if (fromAction && !usedNames?.has(normalizeConceptNameKey(fromAction))) return fromAction;
  return `${labels[phaseIndex % labels.length]}${(phaseIndex % 3) + 1}`;
}

function extractDutyHintFromAction(action = "") {
  const text = clean(action, 80);
  if (!text) return "";
  // Pull a compact verb-object-ish chunk (first 8-12 chars of meaningful content).
  const stripped = text
    .replace(/^在?T\+[^，,]+[，,]?/u, "")
    .replace(/^(完成|组织|实施|开展|进行|遂行)/u, "")
    .trim();
  const chunk = stripped.slice(0, 12).replace(/[，,。；;].*$/u, "").trim();
  return chunk.length >= 4 ? chunk : "";
}

function buildConceptUnitsForPhase(phase, domainHint = "general", { usedBlueNames = new Set(), usedRedNames = new Set() } = {}) {
  const { id, name, objectiveText, blue, red, window, index = 0 } = phase;
  const when = window ? `${window}，` : `在「${name}」，`;
  const blueGroup = `蓝方·${name}`;
  const redGroup = `红方·${name}`;
  const catalog = dutyCatalog(domainHint);
  const blueActions = Array.isArray(blue) && blue.length ? blue : [objectiveText || "阶段蓝方行动"];
  const redActions = Array.isArray(red) && red.length ? red : ["红方同期施压"];

  const makeUnit = (side, theme, action, seq, usedNames) => {
    const sideKey = side === "friendly" ? "blue" : "red";
    const entry = catalog[sideKey][theme] || catalog[sideKey].action;
    const label = chooseDutyLabel(theme, entry, {
      usedNames,
      phaseIndex: index + seq,
      actionHint: action
    });
    usedNames.add(normalizeConceptNameKey(label));
    const prefix = side === "friendly" ? "蓝方" : "红方";
    return {
      id: `${id}-${sideKey}-${theme}-${seq}`,
      name: `${prefix}·${label}`,
      side,
      role: entry.role,
      group: side === "friendly" ? blueGroup : redGroup,
      missionType: entry.missionType,
      task: side === "friendly"
        ? `${when}承担「${label}」职责：${clipTask(action)}；服务阶段目标「${clipTask(objectiveText, 40)}」。`
        : `${when}承担「${label}」对手职责：${clipTask(action)}；形成对蓝方可观察压力。`,
      phaseIds: [id],
      platforms: [],
      notes: prefix
    };
  };

  const blueUnits = [];
  const redUnits = [];
  const coveredBlueThemes = new Set();
  const coveredRedThemes = new Set();

  // 1) One concept unit per action line (no artificial cap — follow phase action count).
  blueActions.forEach((action, i) => {
    const theme = pickTopThemes(scoreDutyThemes(action, "blue"), {
      min: 1,
      fallback: ["action"]
    })[0] || "action";
    coveredBlueThemes.add(theme);
    blueUnits.push(makeUnit("friendly", theme, action, i + 1, usedBlueNames));
  });
  redActions.forEach((action, i) => {
    const theme = pickTopThemes(scoreDutyThemes(action, "red"), {
      min: 1,
      fallback: ["action"]
    })[0] || "action";
    coveredRedThemes.add(theme);
    redUnits.push(makeUnit("hostile", theme, action, i + 1, usedRedNames));
  });

  // 2) Supplement any other strong themes from full phase text (still no hard max).
  const blueText = [objectiveText, ...blueActions].join("；");
  const redText = [...redActions, objectiveText].join("；");
  const blueThemes = pickTopThemes(scoreDutyThemes(blueText, "blue"), {
    min: 2,
    fallback: ["sense", "command", "action", "support"]
  });
  const redThemes = pickTopThemes(scoreDutyThemes(redText, "red"), {
    min: 2,
    fallback: domainHint === "offense"
      ? ["sense", "command", "defend"]
      : ["action", "command", "ew"]
  });
  let seq = blueActions.length;
  for (const theme of blueThemes) {
    if (coveredBlueThemes.has(theme)) continue;
    coveredBlueThemes.add(theme);
    seq += 1;
    blueUnits.push(makeUnit("friendly", theme, blueActions[0] || objectiveText, seq, usedBlueNames));
  }
  seq = redActions.length;
  for (const theme of redThemes) {
    if (coveredRedThemes.has(theme)) continue;
    coveredRedThemes.add(theme);
    seq += 1;
    redUnits.push(makeUnit("hostile", theme, redActions[0] || "红方同期施压", seq, usedRedNames));
  }

  return [...blueUnits, ...redUnits];
}

function clipName(value, max = 10) {
  const text = clean(value, 40);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function clipTask(value, max = 90) {
  const text = clean(value, 400);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function buildDefaultForceRelations(forces = [], combatForces = []) {
  const relations = [];
  const bySideRole = (list, side, roles) => list.find((item) => (
    item.side === side && roles.includes(item.role)
  ));
  const pushRel = (id, from, to, type, note) => {
    if (from && to && from.id !== to.id) {
      relations.push({ id, fromForceId: from.id, toForceId: to.id, type, note });
    }
  };

  const blueSense = bySideRole(forces, "friendly", ["sense"]);
  const blueCommand = bySideRole(forces, "friendly", ["command"]);
  const blueAction = bySideRole(forces, "friendly", ["maneuver", "air", "airDefense", "surface"]);
  const blueSupport = bySideRole(forces, "friendly", ["support"]);
  const redSense = bySideRole(forces, "hostile", ["sense"]);
  const redCommand = bySideRole(forces, "hostile", ["command"]);
  const redAction = bySideRole(forces, "hostile", ["maneuver", "air", "airDefense", "surface"]);

  pushRel("rel-blue-1", blueSense, blueCommand, "information", "蓝方态势上报");
  pushRel("rel-blue-2", blueCommand, blueAction, "command", "蓝方行动授权");
  pushRel("rel-blue-3", blueSupport, blueAction, "support", "蓝方持续保障");
  pushRel("rel-red-1", redSense, redCommand, "information", "红方态势/指示");
  pushRel("rel-red-2", redCommand, redAction, "command", "红方行动协同");
  pushRel("rel-vs-1", redAction, blueAction, "coordination", "红蓝对抗作用轴");
  pushRel("rel-vs-2", blueSense, redAction, "information", "蓝方对红方主轴感知");

  const blueCombatCmd = bySideRole(combatForces, "friendly", ["command"]);
  const blueCombatAct = bySideRole(combatForces, "friendly", ["maneuver", "air", "airDefense", "surface"]);
  const blueCombatSense = bySideRole(combatForces, "friendly", ["sense"]);
  const redCombatCmd = bySideRole(combatForces, "hostile", ["command"]);
  const redCombatAct = bySideRole(combatForces, "hostile", ["maneuver", "air", "airDefense", "surface"]);
  pushRel("rel-c-blue-1", blueCombatSense, blueCombatCmd, "information", "蓝方作战态势");
  pushRel("rel-c-blue-2", blueCombatCmd, blueCombatAct, "command", "蓝方作战指挥");
  pushRel("rel-c-red-1", redCombatCmd, redCombatAct, "command", "红方作战指挥");
  pushRel("rel-c-vs-1", redCombatAct, blueCombatAct, "coordination", "红蓝作战对抗");
  return relations;
}

/** Prefer brief-first drafting; optional forceMission only soft-attaches later. */
export function createPhaseActionConceptFromBrief(brief = {}, plan = null, options = {}) {
  return createPhaseActionConceptFromForceMission(options.forceMission || {}, brief, plan, options);
}

export function createPhaseActionConceptFromForceMission(forceMission = {}, brief = {}, plan = null, {
  source = "ai",
  combatFocus = null,
  previousPhaseNames = null,
  diversitySeed = "",
  ruleLibrary = null
} = {}) {
  const generatedAt = new Date().toISOString();
  const mission = normalizeForceMissionPlan(forceMission);
  const draft = plan && typeof plan === "object" ? plan : {};
  const forceIds = mission.forces.map((force) => force.id);
  const objective = researchSnippet(brief.objective || brief.researchIntent, 120) || "作战概念研究";
  const approach = researchSnippet(brief.approach, 80);
  const risk = researchSnippet(brief.risk, 80);
  const focusTitle = researchSnippet(combatFocus?.title, 40) || "所选作战聚焦";
  const effects = researchSnippet(brief.expectedEffects, 120) || "形成可复核的阶段作战效果";
  const intent = researchSnippet(brief.researchIntent, 120) || objective;
  const theme = detectPhaseTheme(`${intent} ${objective} ${focusTitle} ${approach}`);
  const previousNames = (Array.isArray(previousPhaseNames) ? previousPhaseNames : Array.isArray(draft.previousPhaseNames) ? draft.previousPhaseNames : [])
    .map((item) => clean(item, 40))
    .filter(Boolean);
  const seed = clean(diversitySeed || draft.diversitySeed, 40);
  const aiPhasesRaw = Array.isArray(draft.phases) ? draft.phases : [];
  const aiPhases = aiPhasesRaw.filter((phase) => !isPollutedPhase(phase));
  const aiUsable = aiPhases.length >= 2 && !shouldRejectAiPhases(aiPhases, theme);
  const fallbackPhases = buildTopicAwarePhaseFallback({
    objective,
    approach,
    risk,
    focusTitle,
    effects,
    intent,
    forceIds,
    previousNames,
    diversitySeed: seed
  });
  // Prefer AI only when content is clean AND topic-compatible; else topic-aware local fallback.
  const rawPhases = aiUsable ? aiPhases : fallbackPhases;
  const usedFallback = rawPhases === fallbackPhases;
  const horizon = inferResearchHorizon(brief, theme);
  // Ensure time windows are sequential and function-weighted (fix weak AI equal slices).
  const phases = applyJustifiedTimeWindows(rawPhases, horizon, theme, { force: usedFallback || windowsAreWeak(rawPhases) });
  const phaseIdList = phases.map((phase, index) => slugId(phase?.id, `phase-${index + 1}`));
  const sourceTransitions = !usedFallback && Array.isArray(draft.transitions) && draft.transitions.length
    ? draft.transitions
    : [];
  const transitions = buildJustifiedTransitions(phases, phaseIdList, sourceTransitions, horizon);
  const timeQuestion = `时窗总跨度：${horizon.label}；是否与任务窗口/聚焦匹配？`;
  const rulesCompact = compactRuleLibraryForAnalysis(ruleLibrary || draft.ruleLibrary || null);
  const ruleNote = rulesCompact.count
    ? `；已引用规则库 ${rulesCompact.count} 条（作战活动/门槛去重合并）`
    : "";
  const built = normalizePhaseActionConcept({
    status: "draft",
    generation: {
      source: usedFallback && source === "ai" ? "local-ai-fallback" : source,
      generatedAt,
      promptSummary: focusTitle && focusTitle !== "所选作战聚焦"
        ? `按作战聚焦「${focusTitle}」生成 CONOPS 式阶段与行动草案（时窗：${horizon.label}${ruleNote}）`
        : `根据概念简报生成 CONOPS 式阶段与行动草案（时窗：${horizon.label}${ruleNote}）`,
      reviewNotes: clean(draft.reviewNotes, 2000)
    },
    phases,
    transitions,
    openQuestions: Array.isArray(draft.openQuestions) && draft.openQuestions.length
      ? [...draft.openQuestions.filter((item) => !isAssistantMetaText(item)).slice(0, 7), timeQuestion]
      : ["阶段数量是否匹配任务复杂度？", timeQuestion, "蓝/红方行动是否对称可判？"],
    reviewChecklist: [
      "阶段数量是否按任务需要可变划分（非固定模板）",
      "阶段是否写成作战 CONOPS（时窗+蓝红行动+阶段目标）",
      "时窗是否有理有据（职能加权、相邻衔接、转换 note 含依据）",
      "阶段是否服从已选作战聚焦与研究课题",
      "是否避免写成研究流程步骤或助手元叙述",
      ...(rulesCompact.count ? ["蓝/红行动与进入退出是否落实规则库约束（已有类似表述不重复堆叠）"] : [])
    ]
  });
  return enrichPhaseActionWithRules(built, rulesCompact);
}

/** Compact ov6a rules for phase-action AI analysis (no activity bindings). */
export function compactRuleLibraryForAnalysis(ov6aOrCompact = null, limit = 40, options = {}) {
  if (!ov6aOrCompact || typeof ov6aOrCompact !== "object") {
    return { count: 0, rules: [] };
  }
  const raw = Array.isArray(ov6aOrCompact.rules) ? ov6aOrCompact.rules : [];
  let filtered = raw;
  if (options.excludeTasks || options.scopeFilter === "phase") {
    filtered = filtered.filter((rule) => {
      const scope = String(rule?.scope || "");
      const id = String(rule?.id || "");
      if (scope.startsWith("任务：") || id.startsWith("rule-task-")) return false;
      return true;
    });
  }
  const rules = filtered.slice(0, limit).map((rule, index) => ({
    id: clean(rule?.id, 80) || `rule-${index + 1}`,
    name: clean(rule?.name || rule?.subject, 80) || `规则 ${index + 1}`,
    type: clean(rule?.type, 40) || "约束",
    scope: clean(rule?.scope, 80) || "研究级",
    description: clean(rule?.description || rule?.text, 240) || ""
  })).filter((rule) => rule.name && rule.description);
  return { count: rules.length, rules };
}

/**
 * Fold rule-library constraints into phase entry/exit (or one blue action) when missing.
 * Skip if the phase corpus already expresses a similar constraint (name/keywords).
 */
export function enrichPhaseActionWithRules(plan = {}, ruleLibrary = null) {
  const rules = compactRuleLibraryForAnalysis(ruleLibrary).rules;
  if (!rules.length) return normalizePhaseActionConcept(plan);
  const normalized = normalizePhaseActionConcept(plan);
  const phases = (normalized.phases || []).map((phase) => ({
    ...phase,
    blueActions: [...(phase.blueActions || [])],
    redActions: [...(phase.redActions || [])],
    entryConditions: [...(phase.entryConditions || [])],
    exitConditions: [...(phase.exitConditions || [])],
    expectedEffects: [...(phase.expectedEffects || [])],
    primaryActions: [...(phase.primaryActions || phase.blueActions || [])],
    secondaryActions: [...(phase.secondaryActions || phase.redActions || [])]
  }));
  if (!phases.length) return normalized;

  let applied = 0;
  for (const rule of rules.slice(0, 16)) {
    const fullCorpus = phases.map((phase) => phaseActivityCorpus(phase)).join("\n");
    if (ruleAlreadyCovered(rule, fullCorpus)) continue;
    const target = pickPhaseForRule(phases, rule);
    if (!target) continue;
    const clause = ruleToPhaseClause(rule);
    if (!clause) continue;
    if (rule.type === "转换条件" || /退出|转换|时窗/.test(`${rule.name}${rule.description}`)) {
      if (!listHasSimilar(target.exitConditions, clause)) {
        target.exitConditions = [...target.exitConditions, clause].slice(0, 6);
        applied += 1;
      }
    } else if (rule.type === "前置条件" || /进入|授权|门槛/.test(`${rule.name}${rule.description}`)) {
      if (!listHasSimilar(target.entryConditions, clause)) {
        target.entryConditions = [...target.entryConditions, clause].slice(0, 6);
        applied += 1;
      }
    } else {
      // Constraint / business rule → prefer entry condition; fall back to one blue action.
      if (!listHasSimilar(target.entryConditions, clause) && target.entryConditions.length < 5) {
        target.entryConditions = [...target.entryConditions, clause].slice(0, 6);
        applied += 1;
      } else if (!listHasSimilar(target.blueActions, clause) && target.blueActions.length < 4) {
        const action = `按规则「${rule.name}」组织可观察作战活动：${clause}`;
        if (!listHasSimilar(target.blueActions, action)) {
          target.blueActions = [...target.blueActions, action].slice(0, 4);
          target.primaryActions = [...target.blueActions];
          applied += 1;
        }
      }
    }
  }

  const checklist = Array.isArray(normalized.reviewChecklist) ? [...normalized.reviewChecklist] : [];
  if (applied > 0 && !checklist.some((item) => String(item).includes("规则库"))) {
    checklist.push(`已从规则库补入 ${applied} 条作战门槛/活动约束（跳过已有类似表述）`);
  }
  const summary = clean(normalized.generation?.promptSummary, 400);
  return normalizePhaseActionConcept({
    ...normalized,
    phases,
    reviewChecklist: checklist.slice(0, 10),
    generation: {
      ...normalized.generation,
      promptSummary: applied > 0 && summary && !summary.includes("规则库")
        ? `${summary}；规则补入 ${applied} 条`
        : summary
    }
  });
}

function phaseActivityCorpus(phase = {}) {
  return [
    phase.name,
    phase.objective,
    ...(phase.blueActions || []),
    ...(phase.redActions || []),
    ...(phase.entryConditions || []),
    ...(phase.exitConditions || []),
    ...(phase.expectedEffects || []),
    ...(phase.primaryActions || []),
    ...(phase.secondaryActions || [])
  ].map((item) => String(item || "")).join(" ");
}

function ruleAlreadyCovered(rule = {}, corpus = "") {
  const text = String(corpus || "");
  if (!text) return false;
  const name = clean(rule.name, 40);
  if (name && text.includes(name)) return true;
  const keys = [
    name,
    ...String(name).match(/[\u4e00-\u9fff]{2,8}/g) || [],
    ...String(rule.description || "").match(/[\u4e00-\u9fff]{2,8}/g) || []
  ].filter((item) => item && item.length >= 2);
  const hits = new Set();
  for (const key of keys) {
    if (text.includes(key)) hits.add(key);
    if (hits.size >= 2) return true;
  }
  // Single strong keyword match on distinctive rule head
  const head = clean(rule.description, 10);
  return Boolean(head && head.length >= 4 && text.includes(head));
}

function pickPhaseForRule(phases = [], rule = {}) {
  if (!phases.length) return null;
  const scope = clean(rule.scope, 40);
  if (scope && scope !== "全局" && scope !== "研究级") {
    const byScope = phases.find((phase) => String(phase.name || "").includes(scope)
      || String(phase.objective || "").includes(scope));
    if (byScope) return byScope;
  }
  if (rule.type === "转换条件") return phases[Math.min(phases.length - 1, Math.floor(phases.length * 0.6))] || phases[0];
  if (rule.type === "前置条件") return phases[0];
  return phases[Math.floor((phases.length - 1) / 2)] || phases[0];
}

function ruleToPhaseClause(rule = {}) {
  const name = clean(rule.name, 24);
  const detail = clean(rule.description, 100);
  if (!name && !detail) return "";
  if (name && detail) return `【${name}】${detail}`;
  return name || detail;
}

function listHasSimilar(list = [], clause = "") {
  const target = clean(clause, 160);
  if (!target) return true;
  const keys = String(target).match(/[\u4e00-\u9fff]{2,8}/g) || [target.slice(0, 8)];
  return (Array.isArray(list) ? list : []).some((item) => {
    const text = String(item || "");
    if (!text) return false;
    if (text.includes(target.slice(0, 12))) return true;
    let hits = 0;
    for (const key of keys) {
      if (key.length >= 2 && text.includes(key)) hits += 1;
      if (hits >= 2) return true;
    }
    return false;
  });
}

export function confirmForceMissionPlan(plan, { reviewNotes = "" } = {}) {
  const normalized = normalizeForceMissionPlan(plan);
  if (!normalized.tasks.length || !normalized.tasksConfirmedAt) throw new Error("Operational tasks must be confirmed first");
  if (!normalized.forces.length) throw new Error("Force mission plan requires at least one concept force");
  if (!normalized.combatForces.length) throw new Error("Force mission plan requires at least one combat force");
  return normalizeForceMissionPlan({
    ...normalized,
    status: "confirmed",
    confirmedAt: new Date().toISOString(),
    reviewNotes: clean(reviewNotes, 2000) || normalized.reviewNotes
  });
}

export function confirmPhaseActionConcept(plan, { reviewNotes = "" } = {}) {
  const normalized = normalizePhaseActionConcept(plan);
  if (normalized.phases.length < 2) throw new Error("Phase action concept requires at least two phases");
  return normalizePhaseActionConcept({
    ...normalized,
    status: "confirmed",
    confirmedAt: new Date().toISOString(),
    reviewNotes: clean(reviewNotes, 2000) || normalized.reviewNotes
  });
}

export function normalizeConceptGraphicPlan(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const status = PLAN_STATUSES.has(clean(input.status, 24)) ? clean(input.status, 24) : "empty";
  const nodeIds = new Set();
  const nodes = (Array.isArray(input.nodes) ? input.nodes : []).slice(0, 18).map((item, index) => {
    const id = slugId(item?.id, `node-${index + 1}`);
    if (!clean(item?.label, 160) || nodeIds.has(id)) return null;
    nodeIds.add(id);
    const role = GRAPHIC_ROLES.has(clean(item?.role, 40)) ? clean(item.role, 40) : "action";
    return {
      id,
      label: clean(item.label, 160),
      role,
      fromForceIds: normalizeStringList(item?.fromForceIds, 12, 60),
      fromPhaseIds: normalizeStringList(item?.fromPhaseIds, 12, 60),
      note: clean(item?.note, 600)
    };
  }).filter(Boolean);
  const edges = (Array.isArray(input.edges) ? input.edges : []).slice(0, 36).map((item, index) => {
    const from = clean(item?.from || item?.sourceId, 60);
    const to = clean(item?.to || item?.targetId, 60);
    if (!nodeIds.has(from) || !nodeIds.has(to) || from === to) return null;
    const type = GRAPHIC_EDGE_TYPES.has(clean(item?.type, 40)) ? clean(item.type, 40) : "协同";
    return {
      id: slugId(item?.id, `edge-${index + 1}`),
      from,
      to,
      type,
      note: clean(item?.note, 400)
    };
  }).filter(Boolean);
  return {
    version: 1,
    status,
    generation: normalizeGeneration(input.generation),
    narrative: clean(input.narrative, 2000),
    nodes,
    edges,
    effects: normalizeStringList(input.effects, 12, 400),
    activityCandidates: normalizeStringList(input.activityCandidates, 16, 300),
    oodaHints: normalizeStringList(input.oodaHints, 12, 300),
    openQuestions: normalizeStringList(input.openQuestions, 12, 400),
    reviewChecklist: normalizeStringList(input.reviewChecklist, 12, 400),
    consistencyReport: normalizeStringList(input.consistencyReport, 16, 400),
    reviewNotes: clean(input.reviewNotes, 2000),
    confirmedAt: status === "confirmed" ? clean(input.confirmedAt, 80) : ""
  };
}

export function isConceptGraphicPlanConfirmed(plan, storage = {}) {
  const normalized = normalizeConceptGraphicPlan(plan);
  return normalized.status === "confirmed"
    && normalized.nodes.length >= 4
    && normalized.edges.length >= 2
    && !storage?.stale;
}

export function conceptGraphicPlanIncompleteReasons(plan, storage = {}) {
  const normalized = normalizeConceptGraphicPlan(plan);
  const reasons = [];
  if (storage?.stale) reasons.push("复核已过期的总体作战概念图");
  if (normalized.nodes.length < 4) reasons.push("总体概念图节点草案");
  else if (normalized.edges.length < 2) reasons.push("总体概念图关系草案");
  if (normalized.status !== "confirmed") reasons.push("确认总体作战概念图");
  return reasons;
}

export function createConceptGraphicPlanFromPlanning({
  brief = {},
  forceMission = {},
  phaseAction = {},
  conceptMap = {},
  plan = null,
  source = "ai"
} = {}) {
  const generatedAt = new Date().toISOString();
  const forces = normalizeForceMissionPlan(forceMission).forces;
  const phases = normalizePhaseActionConcept(phaseAction).phases;
  const mapRef = conceptMap?.reference && typeof conceptMap.reference === "object" ? conceptMap.reference : {};
  const draft = plan && typeof plan === "object" ? plan : {};
  const objective = clean(brief.objective || brief.researchIntent, 120) || "作战概念研究";
  const approach = clean(brief.approach, 300) || "研究级总体构想";
  const expectedEffects = clean(brief.expectedEffects, 300) || "形成可复核的总体效果";

  const pickForce = (...roles) => forces.find((force) => roles.includes(force.role));
  const sense = pickForce("sense") || forces[0];
  const command = pickForce("command") || forces[1] || sense;
  const action = pickForce("maneuver", "air", "surface", "airDefense") || forces[2] || command;
  const support = pickForce("support");
  const external = pickForce("external") || { id: "external", name: "外部态势对象", role: "external", task: clean(brief.risk, 200) || "外部约束" };

  const fallbackNodes = [
    {
      id: "sense",
      label: sense?.name || "概念感知单元",
      role: "sense",
      fromForceIds: sense ? [sense.id] : [],
      fromPhaseIds: phases[0] ? [phases[0].id] : [],
      note: sense?.task || "形成研究级态势输入"
    },
    {
      id: "decide",
      label: command?.name || "概念指挥协同单元",
      role: "command",
      fromForceIds: command ? [command.id] : [],
      fromPhaseIds: phases.slice(0, 2).map((phase) => phase.id),
      note: command?.task || "组织概念级协同与授权"
    },
    {
      id: "control",
      label: action?.name || "概念行动单元",
      role: "action",
      fromForceIds: [action?.id, support?.id].filter(Boolean),
      fromPhaseIds: phases.slice(1, 3).map((phase) => phase.id),
      note: action?.task || "支撑主方向概念行动"
    },
    {
      id: "opponent",
      label: external?.name || "外部态势对象",
      role: "external",
      fromForceIds: external?.id ? [external.id] : [],
      fromPhaseIds: phases[0] ? [phases[0].id] : [],
      note: external?.task || clean(brief.risk, 200) || "外部约束与不确定性"
    },
    {
      id: "assess",
      label: "任务效果与终态",
      role: "effect",
      fromForceIds: [],
      fromPhaseIds: phases.at(-1) ? [phases.at(-1).id] : [],
      note: expectedEffects
    }
  ];

  const nodes = Array.isArray(draft.nodes) && draft.nodes.length ? draft.nodes : fallbackNodes;
  const nodeIds = new Set(nodes.map((node, index) => slugId(node?.id, `node-${index + 1}`)));
  const fallbackEdges = [
    { id: "edge-sense-decide", from: "sense", to: "decide", type: "信息流", note: "态势上报" },
    { id: "edge-decide-control", from: "decide", to: "control", type: "控制流", note: "行动授权" },
    { id: "edge-opponent-decide", from: "opponent", to: "decide", type: "态势变化", note: "外部影响" },
    { id: "edge-control-assess", from: "control", to: "assess", type: "反馈", note: "效果回流" },
    { id: "edge-assess-sense", from: "assess", to: "sense", type: "反馈", note: "下一轮感知" }
  ].filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));

  const consistencyReport = [
    forces.length ? `兵力来源：已挂接 ${forces.length} 个概念单元` : "一致性：缺少已确认兵力",
    phases.length ? `阶段来源：已挂接 ${phases.length} 个阶段` : "一致性：缺少已确认阶段",
    mapRef.status === "confirmed" ? "模糊图 OV 参考：已确认" : "一致性：模糊图 OV 参考未确认",
    Array.isArray(mapRef.entities) && mapRef.entities.length ? `空间语义实体：${mapRef.entities.length} 项` : "一致性：模糊图未提供实体摘要"
  ];

  const activityCandidates = Array.isArray(draft.activityCandidates) && draft.activityCandidates.length
    ? draft.activityCandidates
    : [
      ...phases.flatMap((phase) => (phase.primaryActions || []).slice(0, 2).map((action) => `${phase.name}：${action}`)),
      ...(Array.isArray(mapRef.activities) ? mapRef.activities.map((item) => item.title || item).filter(Boolean) : [])
    ].slice(0, 12);

  return normalizeConceptGraphicPlan({
    status: "draft",
    generation: {
      source,
      generatedAt,
      promptSummary: "根据已确认规划汇总总体作战概念图",
      reviewNotes: clean(draft.reviewNotes, 2000)
    },
    narrative: clean(draft.narrative, 2000) || `围绕“${objective}”，以${approach}组织感知、指挥、关键行动与效果评估的总体作战构想。`,
    nodes,
    edges: Array.isArray(draft.edges) && draft.edges.length ? draft.edges : fallbackEdges,
    effects: Array.isArray(draft.effects) && draft.effects.length ? draft.effects : [expectedEffects, ...phases.flatMap((phase) => phase.expectedEffects || []).slice(0, 4)].filter(Boolean),
    activityCandidates,
    oodaHints: Array.isArray(draft.oodaHints) && draft.oodaHints.length
      ? draft.oodaHints
      : ["观察：多源态势汇聚", "判断：窗口与风险复核", "决策：协同授权", "行动：主方向实施与反馈"],
    openQuestions: Array.isArray(draft.openQuestions) && draft.openQuestions.length
      ? draft.openQuestions
      : ["总体节点是否完整覆盖兵力与阶段？", "关键关系是否与模糊图空间语义一致？", "是否足以进入正式 OV-1 建模？"],
    reviewChecklist: [
      "总体构想是否完整",
      "与兵力/阶段/模糊图是否一致",
      "是否可直接形成 OV-1"
    ],
    consistencyReport: Array.isArray(draft.consistencyReport) && draft.consistencyReport.length
      ? draft.consistencyReport
      : consistencyReport
  });
}

export function confirmConceptGraphicPlan(plan, { reviewNotes = "" } = {}) {
  const normalized = normalizeConceptGraphicPlan(plan);
  if (normalized.nodes.length < 4) throw new Error("Concept graphic plan requires at least four nodes");
  if (normalized.edges.length < 2) throw new Error("Concept graphic plan requires at least two edges");
  return normalizeConceptGraphicPlan({
    ...normalized,
    status: "confirmed",
    confirmedAt: new Date().toISOString(),
    reviewNotes: clean(reviewNotes, 2000) || normalized.reviewNotes
  });
}

/** Compile a confirmed concept graphic into an OperationalConceptGraphic-shaped draft for OV-1. */
export function conceptGraphicToOv1Draft(plan, brief = {}) {
  const normalized = normalizeConceptGraphicPlan(plan);
  const roleToOv1 = {
    sense: "sense",
    equipment: "sense",
    command: "decide",
    action: "control",
    external: "opponent",
    environment: "opponent",
    effect: "assess"
  };
  const nodesByRole = new Map();
  for (const node of normalized.nodes) {
    const ov1Id = roleToOv1[node.role] || (["sense", "decide", "control", "opponent", "assess"].includes(node.id) ? node.id : "");
    if (!ov1Id || nodesByRole.has(ov1Id)) continue;
    nodesByRole.set(ov1Id, node);
  }
  const labels = {
    sense: "预警与态势感知平台",
    decide: "联合指挥控制节点",
    control: "关键行动单元",
    opponent: "外部威胁与环境约束",
    assess: "任务效果与终态"
  };
  const kinds = {
    sense: "equipment",
    decide: "command",
    control: "action",
    opponent: "external",
    assess: "effect"
  };
  const categories = {
    sense: "装备/平台",
    decide: "指挥节点",
    control: "关键动作",
    opponent: "外部对象",
    assess: "预期效果"
  };
  const nodes = ["sense", "decide", "control", "opponent", "assess"].map((id) => {
    const source = nodesByRole.get(id);
    return {
      id,
      label: source?.label || labels[id],
      detail: source?.note || labels[id],
      category: categories[id],
      kind: kinds[id]
    };
  });
  const edgeTypeMap = {
    信息流: "信息流",
    控制流: "控制流",
    态势变化: "态势变化",
    反馈: "反馈",
    协同: "控制流",
    保障: "控制流"
  };
  const edges = normalized.edges.map((edge, index) => {
    const sourceId = roleToOv1[normalized.nodes.find((node) => node.id === edge.from)?.role]
      || (["sense", "decide", "control", "opponent", "assess"].includes(edge.from) ? edge.from : "");
    const targetId = roleToOv1[normalized.nodes.find((node) => node.id === edge.to)?.role]
      || (["sense", "decide", "control", "opponent", "assess"].includes(edge.to) ? edge.to : "");
    if (!sourceId || !targetId || sourceId === targetId) return null;
    return {
      id: edge.id || `ov1-edge-${index + 1}`,
      sourceId,
      targetId,
      type: edgeTypeMap[edge.type] || "信息流"
    };
  }).filter(Boolean);
  const defaultEdges = [
    { id: "ov1-edge-sense-decide", sourceId: "sense", targetId: "decide", type: "信息流" },
    { id: "ov1-edge-decide-control", sourceId: "decide", targetId: "control", type: "控制流" },
    { id: "ov1-edge-opponent-decide", sourceId: "opponent", targetId: "decide", type: "态势变化" },
    { id: "ov1-edge-control-assess", sourceId: "control", targetId: "assess", type: "反馈" },
    { id: "ov1-edge-assess-sense", sourceId: "assess", targetId: "sense", type: "反馈" }
  ];
  return {
    concept: {
      mission: clean(brief.objective || brief.researchIntent, 120) || "总体作战概念",
      objective: clean(brief.objective, 400) || normalized.narrative.slice(0, 200),
      scope: clean(brief.assumptions, 300),
      phase: "总体概念评估",
      expectedEffects: (normalized.effects[0] || clean(brief.expectedEffects, 300) || "形成可复核总体效果"),
      constraints: clean(brief.risk, 300)
    },
    nodes,
    edges: edges.length >= 2 ? edges : defaultEdges,
    summary: normalized.narrative,
    expectedEffects: normalized.effects[0] || clean(brief.expectedEffects, 300),
    activityCandidates: normalized.activityCandidates,
    oodaHints: normalized.oodaHints
  };
}

export function conceptGraphicContextForDownstream(plan, storage = {}) {
  if (!isConceptGraphicPlanConfirmed(plan, storage)) return "未确认总体作战概念图；不要假定 OV-1 节点或总体关系。";
  const normalized = normalizeConceptGraphicPlan(plan);
  return [
    `已确认总体作战概念图（${normalized.nodes.length} 节点 / ${normalized.edges.length} 关系）。`,
    normalized.narrative,
    `节点：${normalized.nodes.map((node) => `${node.label}[${node.role}]`).join("；")}`,
    normalized.effects.length ? `效果：${normalized.effects.join("；")}` : "",
    "仅作为研究级总体语义，不推断精确部署、性能或仿真动作。"
  ].filter(Boolean).join("\n");
}

export function forceMissionContextForDownstream(plan, storage = {}) {
  if (!isForceMissionPlanConfirmed(plan, storage)) return "未确认兵力与任务设计；不要假定编组、职责或指挥关系。";
  const normalized = normalizeForceMissionPlan(plan);
  const sideTag = (side) => (side === "hostile" ? "红" : side === "friendly" ? "蓝" : side || "—");
  const blueC = normalized.forces.filter((f) => f.side === "friendly").length;
  const redC = normalized.forces.filter((f) => f.side === "hostile").length;
  const blueT = normalized.combatForces.filter((f) => f.side === "friendly").length;
  const redT = normalized.combatForces.filter((f) => f.side === "hostile").length;
  return [
    `已确认兵力与任务（概念 ${normalized.forces.length}=蓝${blueC}/红${redC}；作战 ${normalized.combatForces.length}=蓝${blueT}/红${redT}）。`,
    `概念兵力：${normalized.forces.map((force) => {
      const phases = (force.phaseIds || []).length ? `@${force.phaseIds.join(",")}` : "";
      return `${sideTag(force.side)}·${force.name}${phases}[${force.role}]：${force.task}`;
    }).join("；")}`,
    `作战兵力：${normalized.combatForces.map((force) => {
      const mission = cmoMissionTypeLabel(force.missionType);
      const platforms = (force.platforms || []).map((item) => item.name).filter(Boolean).join("、");
      const parent = force.conceptForceId ? `←${force.conceptForceId}` : "";
      return `${sideTag(force.side)}·${force.name}${parent}[${force.role}/${mission}]：${force.task}${platforms ? `（平台：${platforms}）` : ""}`;
    }).join("；")}`,
    normalized.relations.length ? `关系：${normalized.relations.map((item) => `${item.fromForceId}-${item.type}->${item.toForceId}`).join("；")}` : "",
    "红蓝双方均需概念与作战编组；概念按阶段表职责（不挂装备），作战表平台类型参考；不推断真实编制、性能参数、武器用法或机构人事。"
  ].filter(Boolean).join("\n");
}

/** Research subject for OV-1 is always the friendly/blue concept-force side. */
export const OV1_RESEARCH_SUBJECT_SIDE = "friendly";

/** Concept-force-only context for OV-1: subject-side forces only; combat forces ignored. */
export function conceptForceContextForOv1(plan, storage = {}) {
  if (!isForceMissionPlanConfirmed(plan, storage)) return "未确认概念兵力；不要假定 OV-1 节点主体。";
  const { subjectSide, subjectForces, externalForces, subjectRelations } = partitionConceptForcesForOv1(plan);
  if (!subjectForces.length) return "研究主体（蓝方）概念兵力为空；不要假定 OV-1 节点主体。";
  const sideTag = (side) => (side === "hostile" ? "红" : side === "friendly" ? "蓝" : side || "—");
  const byOv1 = groupSubjectConceptForcesByOv1Role(subjectForces);
  return [
    `OV-1 按研究主体（side=${subjectSide}/蓝方）概念兵力装备聚合：源 ${subjectForces.length} 个概念单元；同装备合并，分列上限 sense≤5 / decide≤3 / control≤6 / external≤3；节点标签=装备名称。`,
    `研究主体概念兵力→装备：${subjectForces.slice(0, 24).map((force) => {
      const ov1 = subjectConceptForceRoleToOv1(force.role);
      const equip = conceptForceEquipmentLabel(force) || "（未挂装备）";
      return `${sideTag(force.side)}·${displayConceptForceName(force.name)}[→${ov1}] 装备=${equip}`;
    }).join("；")}${subjectForces.length > 24 ? "…" : ""}`,
    `研究主体角色装备池：${["sense", "decide", "control"].map((id) => {
      const items = byOv1.get(id) || [];
      const equips = uniqueStrings(items.map((f) => conceptForceEquipmentLabel(f) || displayConceptForceName(f.name)), 6);
      return items.length ? `${id}=${equips.join("、")}` : `${id}=待补`;
    }).join("；")}；assess=预期效果`,
    externalForces.length
      ? `外部压力装备池（按装备聚合，≤3 节点）：${uniqueStrings(externalForces.map((force) => conceptForceEquipmentLabel(force) || displayConceptForceName(force.name)), 8).join("、")}`
      : "外部压力：未给出红方概念兵力，可用简报风险作抽象外部对象节点",
    "连线：跨角色只连主节点（主感知→主指挥→主行动→效果→主感知，主外部→主指挥）；同列次要装备只挂到本列主节点，保证无孤立、无全连接扇出。"
  ].filter(Boolean).join("\n");
}

/**
 * Compile research-subject concept forces into a readable OV-1 draft.
 * Aggregate by equipment within role family (avoid P-8A × N duplicates),
 * cap per column, and use hub edges only (no fan-out spaghetti).
 */
export function conceptForcesToOv1Draft(plan, brief = {}) {
  const { subjectForces, externalForces } = partitionConceptForcesForOv1(plan);
  // Keep counts layout-friendly so columns do not stack cards on top of each other.
  const ROLE_CAPS = { sense: 4, decide: 3, control: 5, opponent: 3 };
  const usedLabels = new Set();
  const forceToNodeId = new Map();
  const nodes = [];

  const subjectByRole = { sense: [], decide: [], control: [] };
  for (const force of rankAllSubjectForcesForOv1(subjectForces)) {
    const roleKey = subjectConceptForceRoleToOv1(force.role);
    if (!subjectByRole[roleKey]) subjectByRole.control.push(force);
    else subjectByRole[roleKey].push(force);
  }

  let subjectNodeCount = 0;
  for (const roleKey of ["sense", "decide", "control"]) {
    const clusters = aggregateForcesByEquipment(subjectByRole[roleKey] || [], brief)
      .slice(0, ROLE_CAPS[roleKey]);
    for (const [index, cluster] of clusters.entries()) {
      const kind = roleKey === "sense" ? "equipment" : roleKey === "decide" ? "command" : "action";
      const category = roleKey === "sense" ? "装备/平台" : roleKey === "decide" ? "指挥节点" : "关键动作";
      const nodeId = slugId(`${roleKey}-${cluster.equipKey}`, `ov1-${roleKey}-${index + 1}`);
      const label = clean(cluster.equipLabel, 48) || `${roleKey}-${index + 1}`;
      usedLabels.add(label);
      for (const force of cluster.forces) forceToNodeId.set(force.id, nodeId);
      const duties = uniqueStrings(cluster.forces.map((force) => displayConceptForceName(force.name)).filter(Boolean), 6);
      const tasks = uniqueStrings(cluster.forces.map((force) => force.task).filter(Boolean), 4);
      nodes.push({
        id: nodeId,
        label,
        detail: clean([
          duties.length ? `职责：${duties.join("、")}` : "",
          tasks.length ? `任务：${tasks.join("；")}` : "",
          cluster.forces.length > 1 ? `聚合 ${cluster.forces.length} 个概念兵力` : ""
        ].filter(Boolean).join("。"), 800),
        category,
        kind,
        className: "",
        roleKey,
        sourceConceptForceIds: cluster.forces.map((force) => force.id)
      });
      subjectNodeCount += 1;
    }
  }

  const externalClusters = aggregateForcesByEquipment(rankAllSubjectForcesForOv1(externalForces), brief)
    .slice(0, ROLE_CAPS.opponent);
  for (const [index, cluster] of externalClusters.entries()) {
    const nodeId = slugId(`ext-${cluster.equipKey}`, `ov1-ext-${index + 1}`);
    const label = clean(cluster.equipLabel, 48) || `外部压力${index + 1}`;
    usedLabels.add(label);
    for (const force of cluster.forces) forceToNodeId.set(force.id, nodeId);
    const duties = uniqueStrings(cluster.forces.map((force) => displayConceptForceName(force.name)).filter(Boolean), 4);
    const tasks = uniqueStrings(cluster.forces.map((force) => force.task).filter(Boolean), 3);
    nodes.push({
      id: nodeId,
      label,
      detail: clean([
        "外部压力（非研究主体）",
        duties.length ? `职责：${duties.join("、")}` : "",
        tasks.length ? `任务：${tasks.join("；")}` : "",
        cluster.forces.length > 1 ? `聚合 ${cluster.forces.length} 个概念兵力` : ""
      ].filter(Boolean).join("。"), 800),
      category: "外部对象",
      kind: "external",
      className: "blue",
      roleKey: "opponent",
      sourceConceptForceIds: cluster.forces.map((force) => force.id)
    });
  }

  if (!nodes.some((node) => node.kind === "external")) {
    nodes.push({
      id: "opponent",
      label: "外部对象与态势影响",
      detail: clean(brief.risk, 220) || "代表可能影响任务达成的外部体系与态势变化。",
      category: "外部对象",
      kind: "external",
      className: "blue",
      roleKey: "opponent",
      sourceConceptForceIds: []
    });
  }

  nodes.push({
    id: "assess",
    label: "任务效果与终态",
    detail: clean(brief.expectedEffects, 220) || "汇总研究主体总体效果并反馈下一轮概念修订。",
    category: "预期效果",
    kind: "effect",
    className: "gold",
    roleKey: "effect",
    sourceConceptForceIds: []
  });

  if (!subjectNodeCount) {
    for (const [roleKey, meta] of Object.entries({
      sense: { kind: "equipment", category: "装备/平台", label: "态势感知装备" },
      decide: { kind: "command", category: "指挥节点", label: "指挥控制节点" },
      control: { kind: "action", category: "关键动作", label: "关键行动单元" }
    })) {
      nodes.unshift({
        id: roleKey,
        label: meta.label,
        detail: "待补充研究主体概念兵力装备。",
        category: meta.category,
        kind: meta.kind,
        className: "",
        roleKey,
        sourceConceptForceIds: []
      });
    }
  }

  const stagedNodes = layoutOv1ForceNodes(nodes);
  // Only key-hub edges. Skip bulk force relations — they reintroduce canvas spaghetti.
  const uniqueEdges = [];
  const edgeKeys = new Set();
  for (const edge of buildDefaultOv1ForceEdges(stagedNodes)) {
    const key = `${edge.sourceId}|${edge.targetId}|${edge.type}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    uniqueEdges.push(edge);
  }

  const laidOut = layoutOv1Nodes(stagedNodes, uniqueEdges);
  return {
    concept: {
      mission: shortOv1MissionTitle(brief),
      objective: clean(brief.objective, 400),
      scope: clean(brief.assumptions, 300),
      phase: "总体概念评估",
      expectedEffects: clean(brief.expectedEffects, 300) || "形成可复核总体效果",
      constraints: clean(brief.risk, 300)
    },
    nodes: laidOut.map(({ roleKey, ...node }) => node),
    edges: uniqueEdges,
    summary: `研究主体 OV-1：按装备聚合 ${subjectNodeCount} 个主体节点` +
      `${externalClusters.length ? ` + ${externalClusters.length} 个外部节点` : ""} + 效果节点` +
      `（源概念兵力 ${subjectForces.length}+${externalForces.length}）`,
    expectedEffects: clean(brief.expectedEffects, 300),
    coreIdea: clean(brief.approach, 260),
    researchSubjectSide: OV1_RESEARCH_SUBJECT_SIDE
  };
}

/** Merge concept forces that share the same equipment label within one role family. */
function aggregateForcesByEquipment(forces = [], brief = {}) {
  const groups = new Map();
  for (const force of forces) {
    const equipLabel = conceptForceEquipmentLabel(force, brief) || displayConceptForceName(force.name) || force.id;
    const equipKey = normalizeEquipmentKey(equipLabel);
    if (!groups.has(equipKey)) {
      groups.set(equipKey, {
        equipKey,
        equipLabel: clean(equipLabel, 48),
        forces: [],
        score: 0
      });
    }
    const group = groups.get(equipKey);
    group.forces.push(force);
    group.score += scoreForceForOv1(force);
    // Prefer a more specific/real equipment label when available.
    if (hasRealEquipmentPlatform(force) || !isEquipmentKeywordOnly({ name: equipLabel })) {
      group.equipLabel = clean(conceptForceEquipmentLabel(force, brief) || group.equipLabel, 48);
    }
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      forces: rankAllSubjectForcesForOv1(group.forces)
    }))
    .sort((left, right) => right.score - left.score || right.forces.length - left.forces.length);
}

function normalizeEquipmentKey(name = "") {
  return String(name || "")
    .toLowerCase()
    .replace(/（.*?）|\(.*?\)/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "")
    .slice(0, 48);
}

function scoreForceForOv1(force = {}) {
  let score = 0;
  const role = force.role || "";
  if (role === "sense" || role === "command") score += 8;
  if (["maneuver", "air", "airDefense", "surface", "action"].includes(role)) score += 6;
  if (role === "support") score += 2;
  if (hasRealEquipmentPlatform(force)) score += 10;
  else if ((force.platforms || []).some((item) => item?.name && !isEquipmentKeywordOnly(item))) score += 5;
  if ((force.phaseIds || []).length) score += 1;
  return score;
}

function uniqueStrings(values = [], maxItems = 8) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = clean(value, 120);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

/**
 * Spread nodes with a minimum vertical pitch so cards do not stack.
 * Left: sense (upper) + opponent (lower). Right: control (upper) + effect (lower). Center: decide.
 */
function layoutOv1ForceNodes(nodes = []) {
  const groups = {
    sense: [],
    decide: [],
    control: [],
    opponent: [],
    effect: []
  };
  for (const node of nodes) {
    const key = node.roleKey
      || (node.kind === "effect" ? "effect"
        : node.kind === "external" ? "opponent"
          : node.kind === "command" ? "decide"
            : node.kind === "action" ? "control"
              : "sense");
    (groups[key] || groups.sense).push(node);
  }

  // Logical % pitch ≈ card height + gap (cards are ~12–14% tall in home viewport).
  const PITCH = 15;
  const X = { sense: 9, decide: 40, control: 68, opponent: 9, effect: 68 };

  // Left column: sense on top band, opponent on bottom band (hard split so they never collide).
  placeColumnWithPitch(groups.sense, X.sense, 6, 58, PITCH);
  placeColumnWithPitch(groups.opponent, X.opponent, 66, 90, Math.min(PITCH, 12));

  // Center: command nodes
  placeColumnWithPitch(groups.decide, X.decide, 12, 56, PITCH);

  // Right column: actions upper, effect near bottom
  placeColumnWithPitch(groups.control, X.control, 6, 64, PITCH);
  placeColumnWithPitch(groups.effect, X.effect, 74, 88, 12);

  return nodes;
}

/** Place nodes top→bottom with at least `pitch` between tops; expand band if needed. */
function placeColumnWithPitch(list, x, y0, y1, pitch) {
  const count = list.length;
  if (!count) return;
  const safeX = Math.max(6, Math.min(78, x));
  if (count === 1) {
    const y = (y0 + y1) / 2;
    const pos = viewportLayoutToWorldPercent(safeX, y);
    list[0].x = pos.x;
    list[0].y = pos.y;
    return;
  }

  const need = (count - 1) * pitch;
  let start = y0;
  let end = y1;
  if (end - start < need) {
    // Prefer growing downward, then upward, stay on-screen.
    end = Math.min(92, start + need);
    start = Math.max(4, end - need);
    end = Math.min(92, start + need);
  }

  list.forEach((node, index) => {
    const t = index / (count - 1);
    const y = start + t * (end - start);
    // Mild horizontal alternate only when many items — keep offset small to avoid column collision.
    const xJitter = count > 4 ? ((index % 2) * 2 - 1) : 0;
    const pos = viewportLayoutToWorldPercent(
      Math.max(6, Math.min(78, safeX + xJitter)),
      Math.max(4, Math.min(90, y))
    );
    node.x = pos.x;
    node.y = pos.y;
  });
}

/**
 * Key cross-role spine + attach every secondary node to its column hub.
 * Result: no isolated nodes, no full mesh.
 *
 *   secondary sense  → primary sense
 *   primary sense    → primary decide
 *   secondary decide → primary decide
 *   primary decide   → primary control
 *   secondary control→ primary control
 *   secondary opp.   → primary opponent
 *   primary opponent → primary decide
 *   primary control  → assess → primary sense
 */
function buildDefaultOv1ForceEdges(nodes = []) {
  const sense = nodes.filter((node) => node.roleKey === "sense" || node.kind === "equipment");
  const decide = nodes.filter((node) => node.roleKey === "decide" || node.kind === "command");
  const control = nodes.filter((node) => node.roleKey === "control" || node.kind === "action");
  const opponent = nodes.filter((node) => node.roleKey === "opponent" || node.kind === "external");
  const assess = nodes.find((node) => node.id === "assess" || node.kind === "effect");

  const primarySense = sense[0];
  const primaryDecide = decide[0];
  const primaryControl = control[0];
  const primaryOpponent = opponent[0];

  const edges = [];
  let index = 0;
  const push = (sourceId, targetId, type) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    edges.push({ id: `ov1-edge-key-${++index}`, sourceId, targetId, type });
  };

  // Column aggregation: secondary equipment hangs off the role hub (1 edge each).
  for (let i = 1; i < sense.length; i += 1) push(sense[i].id, primarySense.id, "信息流");
  for (let i = 1; i < decide.length; i += 1) push(decide[i].id, primaryDecide.id, "信息流");
  for (let i = 1; i < control.length; i += 1) push(control[i].id, primaryControl.id, "控制流");
  for (let i = 1; i < opponent.length; i += 1) push(opponent[i].id, primaryOpponent.id, "态势变化");

  // Cross-role key spine only (not every secondary to every hub).
  if (primarySense && primaryDecide) push(primarySense.id, primaryDecide.id, "信息流");
  if (primaryDecide && primaryControl) push(primaryDecide.id, primaryControl.id, "控制流");
  else if (primarySense && primaryControl) push(primarySense.id, primaryControl.id, "信息流");

  if (primaryOpponent && (primaryDecide || primarySense)) {
    push(primaryOpponent.id, (primaryDecide || primarySense).id, "态势变化");
  }

  if (primaryControl && assess) push(primaryControl.id, assess.id, "反馈");
  else if (primaryDecide && assess) push(primaryDecide.id, assess.id, "反馈");
  if (assess && primarySense) push(assess.id, primarySense.id, "反馈");

  return edges;
}

function rankAllSubjectForcesForOv1(forces = []) {
  const priority = {
    sense: 0,
    command: 1,
    maneuver: 2,
    air: 2,
    airDefense: 2,
    surface: 2,
    action: 2,
    support: 5
  };
  return [...forces].sort((left, right) => {
    const leftRank = priority[left.role] ?? 4;
    const rightRank = priority[right.role] ?? 4;
    if (leftRank !== rightRank) return leftRank - rightRank;
    const scoreDiff = scoreForceForOv1(right) - scoreForceForOv1(left);
    if (scoreDiff) return scoreDiff;
    return String(left.name || "").localeCompare(String(right.name || ""), "zh");
  });
}

/** Short canvas title only — never dump full research objective into the figcaption. */
function shortOv1MissionTitle(brief = {}) {
  const candidates = [
    clean(brief.researchIntent, 40),
    clean(brief.objective, 80)
  ].filter(Boolean);
  for (const text of candidates) {
    const first = text.split(/[。！？；;\n]/)[0].trim();
    if (!first) continue;
    // Prefer a compact phrase; avoid multi-clause research paragraphs as the map title.
    if (first.length <= 18) return first;
    if (first.length <= 28 && !/[，,]/.test(first.slice(0, 18))) return first.slice(0, 18);
    return `${first.slice(0, 16)}…`;
  }
  return "研究主体作战概念图";
}

/** Prefer the concept force's attached equipment/platform name for OV-1 node labels. */
export function conceptForceEquipmentLabel(force = {}, brief = {}) {
  const platforms = Array.isArray(force?.platforms) ? force.platforms : [];
  const named = platforms
    .map((item) => ({
      name: clean(item?.name, 80),
      cmoId: Number(item?.cmoId) || 0,
      keywordOnly: isEquipmentKeywordOnly(item)
    }))
    .filter((item) => item.name);
  if (named.length) {
    const real = named.find((item) => item.cmoId > 0 && !item.keywordOnly);
    const solid = named.find((item) => !item.keywordOnly);
    return (real || solid || named[0]).name;
  }
  // Fallback: duty-derived research-level equipment type, still an equipment name not a duty title.
  const seeded = seedConceptEquipmentType(force, brief);
  return clean(seeded?.name, 80);
}

export function partitionConceptForcesForOv1(plan = {}) {
  const normalized = normalizeForceMissionPlan(plan);
  const subjectSide = OV1_RESEARCH_SUBJECT_SIDE;
  const subjectForces = normalized.forces.filter((force) => isResearchSubjectConceptForce(force, subjectSide));
  const externalForces = normalized.forces.filter((force) => isExternalPressureConceptForce(force, subjectSide));
  const subjectIds = new Set(subjectForces.map((force) => force.id));
  const subjectRelations = normalized.relations.filter((item) => subjectIds.has(item.fromForceId) && subjectIds.has(item.toForceId));
  return { subjectSide, subjectForces, externalForces, subjectRelations, subjectIds, normalized };
}

function isResearchSubjectConceptForce(force, subjectSide = OV1_RESEARCH_SUBJECT_SIDE) {
  if (!force) return false;
  if (force.side === "hostile" || force.role === "external") return false;
  // Research subject OV-1 only consumes friendly/blue concept forces.
  return force.side === subjectSide;
}

function isExternalPressureConceptForce(force) {
  if (!force) return false;
  return force.side === "hostile" || force.role === "external";
}

/** Map research-subject concept-force roles onto OV-1 node ids (never opponent). */
function subjectConceptForceRoleToOv1(role) {
  const key = clean(role, 40);
  if (key === "sense") return "sense";
  if (key === "command") return "decide";
  if (key === "effect" || key === "assess") return "control";
  if (["maneuver", "air", "airDefense", "surface", "support", "action"].includes(key)) return "control";
  return "control";
}

function groupSubjectConceptForcesByOv1Role(forces = []) {
  const map = new Map([["sense", []], ["decide", []], ["control", []]]);
  for (const force of forces) {
    if (!isResearchSubjectConceptForce(force)) continue;
    const ov1 = subjectConceptForceRoleToOv1(force.role);
    if (!map.has(ov1)) map.set(ov1, []);
    map.get(ov1).push(force);
  }
  return map;
}

/** Prefer primary action roles over support when collapsing many forces into one OV-1 node. */
function rankSubjectForcesForOv1Role(forces = [], ov1Role = "control") {
  const roleRank = {
    sense: { sense: 0, command: 3, airDefense: 2, air: 2, surface: 2, maneuver: 2, support: 4, action: 2 },
    decide: { command: 0, sense: 3, support: 2, airDefense: 4, air: 4, surface: 4, maneuver: 4, action: 3 },
    control: { airDefense: 0, air: 1, surface: 1, maneuver: 0, action: 0, support: 5, sense: 6, command: 6 }
  };
  const ranks = roleRank[ov1Role] || roleRank.control;
  return [...forces].sort((left, right) => {
    const leftRank = ranks[left.role] ?? 9;
    const rightRank = ranks[right.role] ?? 9;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return String(left.name || "").localeCompare(String(right.name || ""), "zh");
  });
}

function displayConceptForceName(name) {
  return clean(String(name || "").replace(/^(蓝方|红方)[·•\s]*/u, ""), 60);
}

/** Compact force/mission payload for AI / map compilers (includes combat layer). */
export function compactForceMissionForAnalysis(plan = {}) {
  const normalized = normalizeForceMissionPlan(plan);
  const compactPlatforms = (platforms = []) => (platforms || []).slice(0, 4).map((item) => ({
    domain: item.domain,
    cmoId: item.cmoId,
    name: item.name,
    country: item.country,
    category: item.category,
    quantity: item.quantity,
    basis: item.basis || ""
  }));
  return {
    tasks: normalized.tasks.map((task) => ({
      id: task.id,
      name: task.name,
      side: task.side,
      phaseId: task.phaseId,
      missionType: task.missionType,
      area: task.area,
      objective: task.objective,
      expectedEffect: task.expectedEffect
    })),
    forces: normalized.forces.map((force) => ({
      id: force.id,
      name: force.name,
      side: force.side,
      role: force.role,
      group: force.group,
      missionType: force.missionType,
      task: force.task,
      taskRefs: force.taskRefs || [],
      phaseIds: force.phaseIds || [],
      platforms: compactPlatforms((force.platforms || []).slice(0, 1)),
      slot: force.slot || ""
    })),
    combatForces: normalized.combatForces.map((force) => ({
      id: force.id,
      name: force.name,
      side: force.side,
      role: force.role,
      conceptForceId: force.conceptForceId,
      group: force.group,
      missionType: force.missionType,
      task: force.task,
      taskRefs: force.taskRefs || [],
      phaseIds: force.phaseIds || [],
      platforms: compactPlatforms(force.platforms),
      slot: force.slot || ""
    })),
    relations: normalized.relations.map((item) => ({
      fromForceId: item.fromForceId,
      toForceId: item.toForceId,
      type: item.type,
      note: item.note
    }))
  };
}

/**
 * Prefer combat forces for spatial / map-like drafts; fall back to concept forces.
 * Returns items tagged with layer for callers that care.
 */
export function mapForcesForLayout(plan = {}, { limit = 12 } = {}) {
  const normalized = normalizeForceMissionPlan(plan);
  const combat = normalized.combatForces.slice(0, limit).map((force) => ({
    ...force,
    layer: "combat"
  }));
  if (combat.length) return combat;
  return normalized.forces.slice(0, limit).map((force) => ({
    ...force,
    layer: "concept"
  }));
}

/** Soft review diagnostics (does not block confirm by itself). */
export function forceMissionDiagnostics(plan = {}) {
  const normalized = normalizeForceMissionPlan(plan);
  const conceptIds = new Set(normalized.forces.map((force) => force.id));
  const linkedConceptIds = new Set(
    normalized.combatForces.map((force) => force.conceptForceId).filter((id) => conceptIds.has(id))
  );
  const items = [];
  if (normalized.forces.length && !normalized.combatForces.length) {
    items.push({
      code: "missing-combat-forces",
      severity: "warn",
      text: "仅有概念兵力、缺少作战兵力。请重生成草案，或补作战编组后再确认。"
    });
  }
  const unlinked = normalized.combatForces.filter((force) => !force.conceptForceId || !conceptIds.has(force.conceptForceId));
  if (unlinked.length) {
    items.push({
      code: "unlinked-combat-forces",
      severity: "review",
      text: `${unlinked.length} 个作战兵力未挂接有效概念单元：${unlinked.map((force) => force.name).join("、")}`
    });
  }
  const orphanConcepts = normalized.forces.filter((force) => force.role !== "external" && !linkedConceptIds.has(force.id));
  if (normalized.combatForces.length && orphanConcepts.length) {
    items.push({
      code: "orphan-concept-forces",
      severity: "review",
      text: `${orphanConcepts.length} 个概念兵力暂无作战兵力挂接：${orphanConcepts.map((force) => force.name).join("、")}`
    });
  }
  const bareCombat = normalized.combatForces.filter((force) => !(force.platforms || []).length);
  if (bareCombat.length) {
    items.push({
      code: "combat-without-platforms",
      severity: "info",
      text: `${bareCombat.length} 个作战兵力尚未引用 CMO 平台（可用阶段推荐或手工检索补全）：${bareCombat.map((force) => force.name).slice(0, 6).join("、")}${bareCombat.length > 6 ? "…" : ""}`
    });
  }
  const unphased = normalized.forces.filter((force) => !(force.phaseIds || []).length && force.role !== "external");
  if (unphased.length) {
    items.push({
      code: "concept-without-phase",
      severity: "review",
      text: `${unphased.length} 个概念兵力未标注所属阶段：${unphased.map((force) => force.name).slice(0, 6).join("、")}${unphased.length > 6 ? "…" : ""}`
    });
  }
  const blueConcept = normalized.forces.filter((force) => force.side === "friendly").length;
  const redConcept = normalized.forces.filter((force) => force.side === "hostile").length;
  if (normalized.forces.length && (!blueConcept || !redConcept)) {
    items.push({
      code: "missing-side-concept-forces",
      severity: "warn",
      text: !blueConcept && !redConcept
        ? "概念兵力缺少红蓝双方标注。"
        : !blueConcept
          ? "概念兵力缺少蓝方（friendly）单元。"
          : "概念兵力缺少红方（hostile）单元。"
    });
  }
  const blueCombat = normalized.combatForces.filter((force) => force.side === "friendly").length;
  const redCombat = normalized.combatForces.filter((force) => force.side === "hostile").length;
  if (normalized.combatForces.length && (!blueCombat || !redCombat)) {
    items.push({
      code: "missing-side-combat-forces",
      severity: "warn",
      text: !blueCombat
        ? "作战兵力缺少蓝方编组。"
        : "作战兵力缺少红方编组。"
    });
  }
  return items;
}

function normalizePlatformRefs(value, maxItems = 8) {
  const limit = Math.max(0, Math.min(16, Number(maxItems) || 8));
  return (Array.isArray(value) ? value : []).slice(0, limit).map((item, index) => {
    const name = clean(item?.name, 160);
    if (!name) return null;
    const domain = isCmoPlatformDomain(item?.domain) ? clean(item.domain, 20) : "aircraft";
    const cmoId = Number.isFinite(Number(item?.cmoId)) ? Math.max(0, Math.trunc(Number(item.cmoId))) : 0;
    const quantity = Number.isFinite(Number(item?.quantity))
      ? Math.max(1, Math.min(99, Math.trunc(Number(item.quantity))))
      : 1;
    const country = clean(item?.country, 80);
    const category = clean(item?.category, 80);
    const explicitBasis = clean(item?.basis, 240);
    const basis = explicitBasis
      || (cmoId > 0
        ? ["CMO DB3K 目录", `域=${domain}`, `ID=${cmoId}`, country ? `国别=${country}` : "", category ? `类别=${category}` : ""]
          .filter(Boolean)
          .join(" · ")
        : "无 CMO 目录编号，仅作概念关键词，不得当作定型装备");
    return {
      id: slugId(item?.id, `platform-${index + 1}`),
      domain,
      cmoId,
      name,
      country,
      category,
      quantity,
      basis
    };
  }).filter(Boolean);
}

/**
 * Concept equipment: duty keyword seed + side country for CMO search.
 * Real model names must come from CMO attach (not stay as AEW/MPA keywords).
 * Red/blue use different countries so equipment ecosystems diverge.
 */

const EQUIPMENT_KEYWORD_ONLY = /^(AEW|MPA|Fighter|Strike|SAM|EW|Tanker|Transport|Logistics|Destroyer|Submarine)$/i;

function briefText(brief = {}) {
  return [brief.objective, brief.researchIntent, brief.approach, brief.assumptions, brief.expectedEffects, brief.risk]
    .filter(Boolean).join(" ");
}

function countriesMentionedInBrief(text = "") {
  const pairs = [
    [/中国|中方|解放军|China/i, "China"],
    [/美国|美军|United States|\bUS\b|U\.S\./i, "United States"],
    [/俄罗斯|俄军|Russia/i, "Russia"],
    [/日本|Japan|自卫队/i, "Japan"],
    [/菲律宾|吕宋|Philippine/i, "Philippines"]
  ];
  return pairs.filter(([re]) => re.test(text)).map(([, c]) => c);
}

/** Research-default opposing country for CMO side differentiation (not a force TOE). */
function defaultOpposingCountry(country = "", _text = "") {
  const c = String(country || "");
  // WestPac / alliance IAMD studies need a non-US adversary ecosystem in the library.
  if (/United States|Philippines|Japan|Australia|NATO|United Kingdom/i.test(c)) return "China";
  if (/China/i.test(c)) return "United States";
  if (/Russia/i.test(c)) return "United States";
  return "United States";
}

/**
 * Resolve distinct countries for blue/red from brief.
 * Ensures hostile ≠ friendly so CMO attach cannot collapse both sides to one ecosystem.
 */
export function resolveSideCountries(brief = {}) {
  const text = briefText(brief);
  let friendly = preferredCountryForForceSide("friendly", brief);
  let hostile = preferredCountryForForceSide("hostile", brief);
  const found = countriesMentionedInBrief(text);

  if (!friendly && found.includes("United States")) friendly = "United States";
  if (!friendly && found.includes("China") && !/反制|对抗中国|对华/i.test(text)) friendly = "China";
  if (!friendly && found[0]) friendly = found[0];

  if (!hostile) {
    // Explicit opponent phrasing already handled in preferredCountryForForceSide;
    // if still empty, use research-default opposite of friendly for CMO differentiation.
    if (friendly) hostile = defaultOpposingCountry(friendly, text);
    else if (found.includes("China") && friendly !== "China") hostile = "China";
    else if (found.includes("Russia")) hostile = "Russia";
  }

  if (friendly && hostile && friendly === hostile) {
    hostile = defaultOpposingCountry(friendly, text);
  }
  // Never leave both empty for IAMD-style briefs that name a research subject.
  if (!friendly && !hostile && /美军|美国|防空反导|吕宋/i.test(text)) {
    friendly = "United States";
    hostile = "China";
  }
  return { friendly: friendly || "", hostile: hostile || "" };
}

/** Country from brief text; side by 蓝/依托 vs 红/对手 cues. Prefer resolveSideCountries for attach. */
export function preferredCountryForForceSide(side = "friendly", brief = {}) {
  const text = briefText(brief);
  const found = countriesMentionedInBrief(text);
  if (side === "hostile") {
    if (/(?:对手|红方|对抗|威胁|压迫).{0,20}(中国|中方|解放军|China)/i.test(text)) return "China";
    if (/(?:对手|红方|对抗|威胁|压迫).{0,20}(美国|美军|United States)/i.test(text)) return "United States";
    if (/(?:对手|红方|对抗|威胁|压迫).{0,20}(俄罗斯|Russia)/i.test(text)) return "Russia";
    if (/(?:对手|红方|对抗|威胁|压迫).{0,20}(日本|Japan)/i.test(text)) return "Japan";
    // Named peer competitor as pressure source in air/missile threat studies of US/allied IAMD.
    if (/美军|美国|美菲|吕宋/i.test(text) && /防空|反导|预警|导弹威胁|空中威胁/i.test(text)
      && found.includes("China")) return "China";
    if (/美军|美国|美菲|吕宋/i.test(text) && /防空|反导|预警|导弹|空中/i.test(text)) {
      // Brief studies US IAMD but does not name opponent — still need a distinct red ecosystem.
      return "China";
    }
    return "";
  }
  if (/(?:依托|基于|我方|蓝方|联合).{0,16}(美国|美军|United States)/i.test(text)
    || /美军依托|美菲|驻菲|吕宋岛.*防空|美军.*防空反导/i.test(text)) return "United States";
  if (/(?:依托|基于|我方|蓝方).{0,16}(日本|Japan)/i.test(text)) return "Japan";
  if (/(?:依托|基于|我方|蓝方).{0,16}(菲律宾|吕宋|Philippine)/i.test(text)
    && !/美军|美国/i.test(text)) return "Philippines";
  if (/(?:依托|基于|我方|蓝方|解放军).{0,16}(中国|中方|China)/i.test(text)
    && !/对华|反制中国|对抗中国/i.test(text)) return "China";
  return found[0] || "";
}

/** True when platform name is only a duty keyword, not a real CMO model. */
export function isEquipmentKeywordOnly(platform = {}) {
  const name = String(platform?.name || "").trim();
  if (!name) return true;
  return EQUIPMENT_KEYWORD_ONLY.test(name);
}

export function hasRealEquipmentPlatform(force = {}) {
  return (Array.isArray(force?.platforms) ? force.platforms : []).some((item) => {
    const name = String(item?.name || "").trim();
    return Boolean(name) && !EQUIPMENT_KEYWORD_ONLY.test(name) && Number(item?.cmoId) > 0;
  });
}

/** Duty → CMO search domain + keyword (placeholder until CMO attach). Prefer role, then force name only. */
function dutySearchHint(force = {}) {
  const role = String(force.role || "");
  const name = String(force.name || "").replace(/^(蓝方|红方)[·•\s]*/u, "");
  // Prefer role + short name only (not full task/objective — avoids 授权 etc. hijacking every unit).
  if (role === "command") return { domain: "aircraft", name: "AEW", category: "C2" };
  if (role === "sense") {
    if (/电子|干扰|诱偏|EW/i.test(name)) return { domain: "aircraft", name: "EW", category: "EW" };
    return /预警|航迹|AEW|受控|融合|交战图/i.test(name)
      ? { domain: "aircraft", name: "AEW", category: "AEW" }
      : { domain: "aircraft", name: "MPA", category: "ISR" };
  }
  if (role === "airDefense") {
    return /末端|点防|内层|地空/i.test(name)
      ? { domain: "ground", name: "SAM", category: "SAM" }
      : { domain: "aircraft", name: "Fighter", category: "Fighter" };
  }
  if (role === "surface") return { domain: "ship", name: "Destroyer", category: "Surface" };
  if (role === "support") {
    if (/加油/i.test(name)) return { domain: "aircraft", name: "Tanker", category: "Tanker" };
    if (/展开|投送|运输|预置|就位/i.test(name)) return { domain: "aircraft", name: "Transport", category: "Transport" };
    return { domain: "ground", name: "Logistics", category: "Support" };
  }
  if (role === "air") return { domain: "aircraft", name: "Fighter", category: "Fighter" };
  if (role === "maneuver") {
    if (/展开|投送|运输|预置|就位/i.test(name)) return { domain: "aircraft", name: "Transport", category: "Transport" };
    if (/电子|干扰|诱偏/i.test(name)) return { domain: "aircraft", name: "EW", category: "EW" };
    return { domain: "aircraft", name: "Strike", category: "Strike" };
  }
  // name-only fallback when role missing/odd
  if (/指挥|授权|C2|控制/i.test(name)) return { domain: "aircraft", name: "AEW", category: "C2" };
  if (/预警|航迹|交战图/i.test(name)) return { domain: "aircraft", name: "AEW", category: "AEW" };
  if (/侦察|监视|态势|指示|传感/i.test(name)) return { domain: "aircraft", name: "MPA", category: "ISR" };
  if (/末端|点防|地空|SAM/i.test(name)) return { domain: "ground", name: "SAM", category: "SAM" };
  if (/防空|拦截|接战/i.test(name)) return { domain: "aircraft", name: "Fighter", category: "Fighter" };
  if (/电子|干扰|诱偏/i.test(name)) return { domain: "aircraft", name: "EW", category: "EW" };
  if (/加油/i.test(name)) return { domain: "aircraft", name: "Tanker", category: "Tanker" };
  if (/展开|投送|运输/i.test(name)) return { domain: "aircraft", name: "Transport", category: "Transport" };
  if (/保障|弹药|后勤|收拢|生存|节点/i.test(name)) return { domain: "ground", name: "Logistics", category: "Support" };
  if (/突防|突击|打击|主轴|压力/i.test(name)) return { domain: "aircraft", name: "Strike", category: "Strike" };
  return { domain: "aircraft", name: "Fighter", category: "Fighter" };
}

/**
 * CMO Name-field search aliases by duty + country.
 * These are query hints only (not assigned force catalogs): DB3 US AEW is "E-2D…", not "AEW".
 */
export function dutyCmoSearchTerms(force = {}, country = "") {
  const duty = dutyKeyForForce(force);
  const cn = /china/i.test(country);
  const ru = /russia/i.test(country);
  const us = /united states/i.test(country);
  const ph = /philipp/i.test(country);
  const jp = /japan/i.test(country);
  const west = us || ph || jp;

  if (duty === "aew") {
    if (cn) return ["KJ-500", "KJ-2000", "KJ-200", "Y-8W", "AEW"];
    if (ru) return ["A-50", "A-100", "AEW"];
    if (west) return ["E-2D", "E-2C", "E-3C", "Hawkeye", "Sentry", "AEW"];
    return ["E-2", "E-3", "KJ-500", "A-50", "AEW"];
  }
  if (duty === "recon") {
    if (cn) return ["Y-8Q", "Y-9", "KJ-200", "UAV", "WZ-"];
    if (ru) return ["Il-38", "Tu-142", "UAV"];
    if (west) return ["P-8", "P-3", "Poseidon", "MQ-9", "RQ-4"];
    return ["P-8", "P-3", "Y-8", "MPA", "Recon"];
  }
  if (duty === "fighter") {
    if (cn) return ["J-16", "J-11", "J-10", "J-20", "Su-30"];
    if (ru) return ["Su-35", "Su-30", "MiG-29", "Su-27"];
    if (west) return ["F-15", "F-16", "F-22", "F-35", "F/A-18"];
    return ["F-15", "F-16", "J-10", "Su-30", "Fighter"];
  }
  if (duty === "strike") {
    if (cn) return ["H-6", "J-16", "JH-7", "CJ-", "DF-"];
    if (ru) return ["Tu-22", "Su-34", "Su-24", "Kalibr"];
    if (west) return ["F-15E", "F/A-18", "B-1", "B-52", "Strike"];
    return ["Strike", "Bomber", "F/A-18", "H-6", "Su-24"];
  }
  if (duty === "samInner" || duty === "samArea") {
    if (cn) return ["HQ-9", "HQ-16", "HQ-22", "SAM"];
    if (ru) return ["S-400", "S-300", "Buk", "Tor"];
    if (west) return ["Patriot", "NASAMS", "THAAD", "Aegis", "SAM"];
    return ["Patriot", "HQ-9", "S-300", "SAM"];
  }
  if (duty === "ew") {
    if (cn) return ["J-16D", "Y-8G", "EW", "ECM"];
    if (ru) return ["Su-24MP", "Il-22", "EW"];
    if (west) return ["EA-18", "Growler", "EC-130", "EA-6"];
    return ["EA-18", "Growler", "EW", "ECM"];
  }
  if (duty === "tanker") {
    if (cn) return ["YY-20", "HU-6", "Il-78", "Tanker"];
    if (ru) return ["Il-78", "Tanker"];
    if (west) return ["KC-135", "KC-46", "KC-10", "Tanker"];
    return ["KC-135", "KC-46", "Il-78", "Tanker"];
  }
  if (duty === "transport") {
    if (cn) return ["Y-20", "Y-9", "Il-76", "Transport"];
    if (ru) return ["Il-76", "An-124", "Transport"];
    if (west) return ["C-17", "C-130", "C-5", "Transport"];
    return ["C-130", "Y-20", "Il-76", "Transport"];
  }
  if (duty === "ship") {
    if (cn) return ["Type 052", "Type 055", "Type 054", "Destroyer"];
    if (ru) return ["Udaloy", "Gorshkov", "Destroyer"];
    if (west) return ["Arleigh", "Burke", "Ticonderoga", "Destroyer"];
    return ["Destroyer", "Frigate", "DDG"];
  }
  if (duty === "groundSupport") {
    if (cn) return ["Truck", "Support", "Logistics", "HEMTT"];
    if (ru) return ["Ural", "Support", "Logistics"];
    if (west) return ["HEMTT", "FMTV", "Support", "Logistics"];
    return ["Support", "Logistics", "Truck"];
  }
  return [dutySearchHint(force).name, "Fighter"].filter(Boolean);
}

export function seedConceptEquipmentType(force = {}, brief = {}) {
  const hint = dutySearchHint(force);
  const sides = resolveSideCountries(brief);
  const country = force.side === "hostile" ? sides.hostile : sides.friendly;
  return {
    id: "platform-1",
    domain: hint.domain,
    cmoId: 0,
    name: hint.name,
    country: country || "",
    category: hint.category || "",
    quantity: 1
  };
}

/** Role/domain sanity only — no fixed nation model lists. */
export function platformFitsConceptForce(platform = {}, force = {}, _brief = {}) {
  const name = String(platform?.name || "");
  if (!name || /^Command Post$/i.test(name)) return false;
  if (EQUIPMENT_KEYWORD_ONLY.test(name) && !(Number(platform?.cmoId) > 0)) return false;
  const domain = String(platform?.domain || "");
  const role = String(force?.role || "");
  if (role === "surface" && domain && domain !== "ship" && domain !== "submarine") return false;
  if ((role === "air" || role === "airDefense") && domain === "submarine") return false;
  if ((role === "sense" || /预警|侦察|航迹|态势|传感/i.test(force?.name || ""))
    && /Logistics|Truck|HEMTT|Ural|FMTV/i.test(name) && !/AEW|E-2|E-3|KJ|P-8|P-3|Y-8|Y-9/i.test(name)) {
    return false;
  }
  return true;
}

export function ensureConceptEquipment(forces = [], { forceReseed = false, brief = {} } = {}) {
  return (Array.isArray(forces) ? forces : []).map((force) => {
    const platforms = normalizePlatformRefs(force?.platforms, 1);
    const cur = platforms[0];
    if (!forceReseed && cur && Number(cur.cmoId) > 0 && !EQUIPMENT_KEYWORD_ONLY.test(cur.name || "")
      && platformFitsConceptForce(cur, force, brief)) {
      return { ...force, platforms };
    }
    if (!forceReseed && cur && !isEquipmentKeywordOnly(cur) && platformFitsConceptForce(cur, force, brief)) {
      return { ...force, platforms };
    }
    return { ...force, platforms: [seedConceptEquipmentType(force, brief)] };
  });
}

/** Compatibility shim. */
export function inferResearchForceProfiles(brief = {}) {
  const sides = resolveSideCountries(brief);
  return {
    friendly: sides.friendly || "",
    hostile: sides.hostile || "",
    country: {
      friendly: sides.friendly || "",
      hostile: sides.hostile || ""
    }
  };
}

function dutyKeyForForce(force = {}) {
  const hint = dutySearchHint(force);
  if (hint.name === "AEW") return "aew";
  if (hint.name === "MPA") return "recon";
  if (hint.name === "SAM") return /末端|内层|点防/i.test(String(force.name || "") + " " + String(force.task || "")) ? "samInner" : "samArea";
  if (hint.name === "EW") return "ew";
  if (hint.name === "Tanker") return "tanker";
  if (hint.name === "Transport") return "transport";
  if (hint.name === "Logistics") return "groundSupport";
  if (hint.name === "Destroyer") return "ship";
  if (hint.name === "Strike") return "strike";
  return "fighter";
}

function supportSeed(force = {}, brief = {}, kind = "fighter") {
  const roleMap = {
    fighter: { role: "air", name: "护航", task: "截击护航", missionType: "air_superiority" },
    tanker: { role: "support", name: "加油", task: "空中加油", missionType: "tanker" },
    ew: { role: "sense", name: "电子战", task: "电子干扰压制", missionType: "sead" },
    sam: { role: "airDefense", name: "末端防空", task: "地空导弹点防", missionType: "patrol_aaw" },
    recon: { role: "sense", name: "侦察", task: "警戒侦察", missionType: "recon" },
    ship: { role: "surface", name: "水面屏护", task: "水面护卫", missionType: "patrol_aaw" },
    groundSupport: { role: "support", name: "后勤保障", task: "弹药后勤保障", missionType: "support" }
  };
  const m = roleMap[kind] || roleMap.fighter;
  return seedConceptEquipmentType({ ...force, ...m, side: force.side }, brief);
}

/**
 * Expand combat draft so EVERY concept force (all phases) has packages.
 * AI often only covers the first few phases; never early-return on global density alone.
 */
function expandThinCombatDraft(combatDraft = [], conceptForces = [], brief = {}, phaseAction = null) {
  const draft = Array.isArray(combatDraft) ? combatDraft : [];
  const concepts = ensureConceptEquipment(Array.isArray(conceptForces) ? conceptForces : [], { brief })
    .filter((force) => force.role !== "external");
  if (!concepts.length) return draft;

  const byConcept = new Map();
  for (const item of draft) {
    const cid = clean(item?.conceptForceId, 60);
    if (!cid) continue;
    if (!byConcept.has(cid)) byConcept.set(cid, []);
    byConcept.get(cid).push(item);
  }

  const uncovered = concepts.filter((force) => !(byConcept.get(force.id) || []).length);
  const thin = concepts.filter((force) => {
    const n = (byConcept.get(force.id) || []).length;
    return n > 0 && n < 2;
  });
  // Only skip when every concept has ≥2 packs (full multi-package coverage).
  if (!uncovered.length && !thin.length) return draft;

  // Expand from uncovered/thin concepts first; still allow full rebuild seeds for consistency.
  const needExpand = uncovered.length
    ? concepts.filter((force) => (byConcept.get(force.id) || []).length < 2)
    : thin;
  const expanded = buildCombatForcesFromConcept(
    needExpand.length ? needExpand : concepts,
    brief,
    phaseAction
  );

  const merged = [...draft];
  const seenIds = new Set(draft.map((item, index) => slugId(item?.id, `combat-ai-${index + 1}`)));
  for (const pack of expanded) {
    const cid = pack.conceptForceId;
    const existing = byConcept.get(cid) || [];
    // Uncovered: take all packages. Thin (1 pack): add support packages, skip duplicate main.
    if (existing.length >= 2) continue;
    if (existing.length === 1 && String(pack.id || "").endsWith("-main")) continue;
    if (seenIds.has(pack.id)) continue;
    seenIds.add(pack.id);
    merged.push(pack);
    if (!byConcept.has(cid)) byConcept.set(cid, []);
    byConcept.get(cid).push(pack);
  }
  return merged;
}

/**
 * Build rich combat forces for CMO-style composition from concept forces + prior planning steps.
 * One concept unit expands into a main package + supporting packages (escort/tanker/SAM/radar etc.).
 */
export function buildCombatForcesFromConcept(forces = [], brief = {}, phaseAction = null) {
  const list = ensureConceptEquipment(Array.isArray(forces) ? forces : [], { brief })
    .filter((force) => force.role !== "external");
  const phaseHint = summarizePhasesForCombat(phaseAction);
  const out = [];
  for (const force of list) {
    const packs = expandConceptToCombatPackages(force, brief, phaseHint);
    for (const pack of packs) out.push(pack);
  }
  // Side-level shared CMO enablers (tankers / ASW screen) once per side when air/surface density is high.
  out.push(...buildSideEnablerPackages(list, brief, phaseHint));
  return out;
}

function summarizePhasesForCombat(phaseAction = null) {
  const phases = Array.isArray(phaseAction?.phases) ? phaseAction.phases : [];
  return phases.slice(0, 12).map((phase, index) => ({
    id: slugId(phase?.id, `phase-${index + 1}`),
    name: clean(phase?.name, 80),
    objective: clean(phase?.objective, 200),
    blue: normalizeStringList(phase?.blueActions ?? phase?.primaryActions, 8, 200),
    red: normalizeStringList(phase?.redActions ?? phase?.secondaryActions, 8, 200)
  }));
}

function expandConceptToCombatPackages(force = {}, brief = {}, phaseHint = []) {
  const side = force.side === "hostile" ? "hostile" : "friendly";
  const sideZh = side === "hostile" ? "红方" : "蓝方";
  const shortName = clean(force.name, 80).replace(/^(蓝方|红方)[·•\s]*/u, "") || "作战单元";
  const base = (force.platforms || [])[0] || seedConceptEquipmentType(force, brief);
  const duty = dutyKeyForForce(force);
  const phaseNote = phaseNoteForConcept(force, phaseHint, side);
  const parentSlot = normalizeLayoutSlot(force.slot) || inferLayoutSlot(force, 0);
  const packs = [];

  const parentPhaseIds = Array.isArray(force.phaseIds) ? force.phaseIds.filter(Boolean) : [];
  const push = (suffix, name, role, missionType, platforms, task, notes = "") => {
    packs.push({
      id: `combat-${force.id || "x"}-${suffix}`,
      name: `${sideZh}·${name}`,
      side,
      role,
      conceptForceId: force.id,
      group: side === "hostile" ? "红方作战编组" : "蓝方作战编组",
      missionType: missionType || force.missionType || inferMissionTypeFromRole(role),
      task,
      phaseIds: parentPhaseIds,
      platforms: normalizePlatformRefs(platforms, 4),
      notes: notes || "CMO 向编成扩展",
      // Hidden abstract slot for concept-map; support packs sit near parent concept.
      slot: parentSlot || inferLayoutSlot({ side, role }, packs.length)
    });
  };

  // 1) Main executable package (always)
  push(
    "main",
    `${shortName}主队`,
    force.role || "maneuver",
    force.missionType || inferMissionTypeFromRole(force.role),
    [{ ...base, id: "platform-1", quantity: cmoMainQuantity(base.domain, duty, force.role) }],
    `对应概念「${shortName}」的主战编成：${clean(force.task, 160) || "遂行主任务"}${phaseNote}`
  );

  // 2) Role / duty based supporting packages (CMO-usable density)
  if (duty === "aew" || duty === "recon" || force.role === "sense") {
    push(
      "escort",
      `${shortName}护航截击分队`,
      "air",
      "air_superiority",
      [{ ...supportSeed(force, brief, "fighter"), quantity: cmoSupportQuantity("fighter") }],
      `为「${shortName}」提供护航与局部制空，保障预警/侦察节点生存${phaseNote}`
    );
    if (duty === "aew") {
      push(
        "tanker",
        `${shortName}空中加油分队`,
        "support",
        "tanker",
        [{ ...supportSeed(force, brief, "tanker"), quantity: cmoSupportQuantity("tanker") }],
        `延长「${shortName}」值班窗口，支撑多阶段连续预警${phaseNote}`
      );
    }
  } else if (duty === "samInner" || duty === "samArea") {
    push(
      "radar",
      `${shortName}制导/警戒雷达分队`,
      "sense",
      "recon",
      [{ ...supportSeed(force, brief, "recon"), quantity: 2 }],
      `为「${shortName}」提供制导照射/远程警戒，形成可仿真的地空导弹火力单元${phaseNote}`
    );
    push(
      "reload",
      `${shortName}再装填保障分队`,
      "support",
      "support",
      [{ ...supportSeed(force, brief, "groundSupport"), quantity: 4 }],
      `保障「${shortName}」弹药再装填与阵地转移，支撑持续防空${phaseNote}`
    );
  } else if (duty === "fighter" || force.role === "air" || force.role === "airDefense") {
    push(
      "flight-b",
      `${shortName}第二截击波次`,
      "air",
      force.missionType || "air_superiority",
      [{ ...base, id: "platform-1", quantity: Math.max(4, Math.round(cmoMainQuantity(base.domain, duty, force.role) * 0.75)) }],
      `轮换/增援「${shortName}」主队，形成双波次截击${phaseNote}`
    );
    push(
      "tanker",
      `${shortName}伴随加油分队`,
      "support",
      "tanker",
      [{ ...supportSeed(force, brief, "tanker"), quantity: cmoSupportQuantity("tanker") }],
      `支撑「${shortName}」 CAP/截击航时${phaseNote}`
    );
  } else if (duty === "strike" || duty === "ballistic" || force.role === "maneuver") {
    push(
      "escort",
      `${shortName}护航/清场分队`,
      "air",
      "sead",
      [{ ...supportSeed(force, brief, "ew"), quantity: cmoSupportQuantity("ew") }],
      `为「${shortName}」突防轴提供电子压制/护航${phaseNote}`
    );
    push(
      "tanker",
      `${shortName}航程保障分队`,
      "support",
      "tanker",
      [{ ...supportSeed(force, brief, "tanker"), quantity: cmoSupportQuantity("tanker") }],
      `保障「${shortName}」远距投放与返航${phaseNote}`
    );
    if (duty === "ballistic") {
      push(
        "tel",
        `${shortName}发射/转运分队`,
        "support",
        "support",
        [{ ...supportSeed(force, brief, "groundSupport"), quantity: 6 }],
        `导弹发射车/转运与阵地保障，便于 CMO 中作为地面单元部署${phaseNote}`
      );
    }
  } else if (duty === "ew" || force.missionType === "sead" || force.missionType === "ecm") {
    push(
      "escort",
      `${shortName}护航分队`,
      "air",
      "air_superiority",
      [{ ...supportSeed(force, brief, "fighter"), quantity: cmoSupportQuantity("fighter") }],
      `保护电战平台，维持对传感器/火控的压制窗口${phaseNote}`
    );
  } else if (duty === "command" || force.role === "command") {
    push(
      "guard",
      `${shortName}近防分队`,
      "airDefense",
      "patrol_aaw",
      [{ ...supportSeed(force, brief, "sam"), quantity: cmoSupportQuantity("sam") }],
      `保护指挥节点，形成可仿真的点防圈${phaseNote}`
    );
    push(
      "relay",
      `${shortName}通信中继分队`,
      "support",
      "support",
      [{ ...supportSeed(force, brief, "recon"), quantity: 2 }],
      `维持跨阶段指挥链路与态势分发${phaseNote}`
    );
  } else if (duty === "ship" || force.role === "surface") {
    push(
      "screen",
      `${shortName}护卫屏护分队`,
      "surface",
      "patrol_aaw",
      [{ ...supportSeed(force, brief, "ship"), quantity: Math.max(1, cmoSupportQuantity("ship") - 1) }],
      `为「${shortName}」提供防空/反潜屏护${phaseNote}`
    );
  } else if (duty === "support" || duty === "groundSupport" || force.role === "support") {
    push(
      "forward",
      `${shortName}前出保障点`,
      "support",
      "support",
      [{ ...supportSeed(force, brief, "groundSupport"), quantity: 4 }],
      `前出油弹/器材节点，支撑主战编成持续行动${phaseNote}`
    );
  }

  return packs;
}

function buildSideEnablerPackages(conceptForces = [], brief = {}, phaseHint = []) {
  const packs = [];
  for (const side of ["friendly", "hostile"]) {
    const sideForces = conceptForces.filter((force) => force.side === side);
    if (sideForces.length < 3) continue;
    const sideZh = side === "hostile" ? "红方" : "蓝方";
    const airHeavy = sideForces.filter((force) => {
      const d = (force.platforms || [])[0]?.domain || "";
      return d === "aircraft" || force.role === "air" || force.role === "airDefense" || force.role === "sense";
    }).length;
    const phaseNote = phaseHint.length
      ? `；覆盖阶段：${phaseHint.slice(0, 4).map((p) => p.name).filter(Boolean).join("、") || "多阶段"}`
      : "";
    if (airHeavy >= 2) {
      const anchor = sideForces.find((f) => f.role === "support") || sideForces[0];
      packs.push({
        id: `combat-side-${side}-tanker-pool`,
        name: `${sideZh}·空中加油总队`,
        side,
        role: "support",
        conceptForceId: anchor.id,
        group: side === "hostile" ? "红方作战编组" : "蓝方作战编组",
        missionType: "tanker",
        task: `跨概念共享的空中加油资源池，支撑多阶段 CAP/预警/突击航时${phaseNote}`,
        phaseIds: Array.isArray(anchor.phaseIds) ? anchor.phaseIds.filter(Boolean) : [],
        platforms: normalizePlatformRefs([{
          ...supportSeed(anchor, brief, "tanker"),
          quantity: Math.min(8, 2 + airHeavy)
        }], 4),
        notes: "侧级使能编成（CMO）",
        slot: normalizeLayoutSlot(anchor.slot) || inferLayoutSlot({ side, role: "support" }, 0)
      });
    }
  }
  return packs;
}

function phaseNoteForConcept(force = {}, phaseHint = [], side = "friendly") {
  const ids = new Set(force.phaseIds || []);
  const matched = phaseHint.filter((phase) => ids.has(phase.id));
  if (!matched.length) return "";
  const actions = matched.flatMap((phase) => (side === "hostile" ? phase.red : phase.blue)).filter(Boolean).slice(0, 2);
  const names = matched.map((phase) => phase.name).filter(Boolean).slice(0, 3).join("、");
  const actionBit = actions.length ? `；回扣行动：${actions.join(" / ")}` : "";
  return names ? `；关联阶段：${names}${actionBit}` : actionBit;
}

/** CMO-oriented main package size by domain/duty. */
function cmoMainQuantity(domain = "aircraft", duty = "", role = "") {
  if (domain === "ship" || domain === "submarine") return duty === "ship" ? 2 : 1;
  if (domain === "facility") return 1;
  if (domain === "ground") {
    if (duty === "samInner" || duty === "samArea") return 6;
    if (duty === "ballistic") return 8;
    return 4;
  }
  // aircraft
  if (duty === "aew" || duty === "recon") return 3;
  if (duty === "tanker" || duty === "transport") return 4;
  if (duty === "ew") return 4;
  if (duty === "fighter" || role === "air" || role === "airDefense") return 12;
  if (duty === "strike" || role === "maneuver") return 16;
  return 8;
}

function cmoSupportQuantity(kind = "fighter") {
  if (kind === "tanker") return 3;
  if (kind === "ew") return 4;
  if (kind === "sam") return 4;
  if (kind === "ship") return 2;
  if (kind === "fighter") return 8;
  return 4;
}

function inferMissionTypeFromRole(role) {
  if (role === "sense") return "recon";
  if (role === "command") return "command";
  if (role === "air") return "air_superiority";
  if (role === "airDefense") return "patrol_aaw";
  if (role === "surface") return "patrol_asuw";
  if (role === "support") return "support";
  if (role === "external") return "other";
  return "strike";
}

export function phaseActionContextForDownstream(plan, storage = {}) {
  if (!isPhaseActionConceptConfirmed(plan, storage)) return "未确认阶段与行动构想；不要假定阶段顺序或转换条件。";
  const normalized = normalizePhaseActionConcept(plan);
  return [
    `已确认阶段与行动（${normalized.phases.length} 个阶段，CONOPS 式）。`,
    normalized.phases.map((phase) => {
      const window = phase.timeWindow ? `（${phase.timeWindow}）` : "";
      const blue = (phase.blueActions || phase.primaryActions || []).join("；");
      const red = (phase.redActions || phase.secondaryActions || []).join("；");
      return `阶段${phase.sequence || ""} ${phase.name}${window}：目标 ${phase.objective}；蓝方 ${blue || "—"}；红方 ${red || "—"}`;
    }).join(" | "),
    normalized.transitions.length ? `转换：${normalized.transitions.map((item) => `${item.fromPhaseId}->${item.toPhaseId}（${item.condition}）`).join("；")}` : "",
    "时窗为相对研究时序（T+），不推断真实日历或精确仿真动作。"
  ].filter(Boolean).join("\n");
}

function emptyGeneration() {
  return { source: "", model: "", generatedAt: "", promptSummary: "", reviewNotes: "" };
}

function normalizeGeneration(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    source: clean(input.source, 40),
    model: clean(input.model, 80),
    generatedAt: clean(input.generatedAt, 80),
    promptSummary: clean(input.promptSummary, 400),
    reviewNotes: clean(input.reviewNotes, 2000)
  };
}

function normalizeStringList(value, maxItems, maxLength) {
  return (Array.isArray(value) ? value : typeof value === "string" ? value.split(/\n+|；|;/) : [])
    .map((item) => clean(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeActionList(value, maxItems, maxLength) {
  return normalizeStringList(value, maxItems, maxLength).filter((item) => !isAssistantMetaText(item));
}

/** True when text is model self-talk / API disclaimer, not research content. */
export function isAssistantMetaText(value) {
  const text = String(value || "");
  if (!text) return false;
  return /人工智能助手|通过\s*API\s*提供服务|底层模型|可核验的底层|model\s*字段|调用日志|平台配置记录|当前会话没有向我|我是一名通过|不能对体系性能|接口响应中的\s*model/i.test(text)
    || (text.length > 160 && /API|模型名称|部署标识|密钥|工具调用/.test(text) && /助手|会话|回答|复核/.test(text));
}

export function researchSnippet(value, maxLength = 80) {
  const text = clean(value, maxLength * 2);
  if (!text || isAssistantMetaText(text) || text === "待补充") return "";
  return text.slice(0, maxLength);
}

function isPollutedPhase(phase) {
  if (!phase || typeof phase !== "object") return true;
  const corpus = [
    phase.name,
    phase.objective,
    ...(Array.isArray(phase.blueActions) ? phase.blueActions : []),
    ...(Array.isArray(phase.redActions) ? phase.redActions : []),
    ...(Array.isArray(phase.primaryActions) ? phase.primaryActions : []),
    ...(Array.isArray(phase.secondaryActions) ? phase.secondaryActions : [])
  ].map((item) => String(item || "")).join(" ");
  return isAssistantMetaText(corpus);
}

function detectPhaseTheme(corpus) {
  const text = String(corpus || "");
  if (/防空|反导|拦截|预警|导弹防御|AMD|IAMD|吕宋|岛链|EABO|反介入|THAAD|萨德|爱国者|宙斯盾/i.test(text)) {
    return "air-missile-defense";
  }
  if (/封控|拒止|通道|封锁|联合封控/i.test(text)) return "sea-control";
  return "general";
}

/** Classic offline template the model often copies; wrong for AMD / sea-control topics. */
function isGenericAssaultPhaseSet(phases = []) {
  const names = phases.map((phase) => String(phase?.name || "")).join(" ");
  return /编队展开/.test(names)
    && (/电子诱发|目标暴露/.test(names) || /火力释放|突击组|突击编组/.test(names));
}

function phaseSetMentionsDefense(phases = []) {
  const corpus = phases.map((phase) => [
    phase?.name,
    phase?.objective,
    ...(Array.isArray(phase?.blueActions) ? phase.blueActions : []),
    ...(Array.isArray(phase?.redActions) ? phase.redActions : [])
  ].join(" ")).join(" ");
  return /防空|反导|拦截|预警|接战|突防|识别|导弹|雷达|火控|漏防/.test(corpus);
}

function shouldRejectAiPhases(phases, theme) {
  if (!Array.isArray(phases) || phases.length < 2) return true;
  if (phases.some((phase) => isPollutedPhase(phase))) return true;
  if (isGenericAssaultPhaseSet(phases) && theme !== "general") return true;
  if (theme === "air-missile-defense" && !phaseSetMentionsDefense(phases)) return true;
  return false;
}

function stableVariantIndex(seedText, modulo, avoidIndex = -1) {
  const text = String(seedText || "seed");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  let index = Math.abs(hash) % Math.max(1, modulo);
  if (avoidIndex >= 0 && modulo > 1 && index === avoidIndex) index = (index + 1) % modulo;
  return index;
}

/** Infer total research horizon from brief text + theme (relative CONOPS time, not calendar). */
function inferResearchHorizon(brief = {}, theme = "general") {
  const text = [
    brief.researchIntent,
    brief.objective,
    brief.approach,
    brief.assumptions,
    brief.expectedEffects,
    brief.risk
  ].map((item) => String(item || "")).join(" ");

  const hourMatch = text.match(/(\d{1,3})\s*小时/);
  if (hourMatch) {
    const hours = Math.max(1, Math.min(72, Number(hourMatch[1]) || 3));
    return {
      unit: "minute",
      totalMinutes: hours * 60,
      label: `简报明示约 ${hours} 小时研究窗口`
    };
  }

  const dayMatch = text.match(/(?:约|共|持续)?\s*(\d{1,2})\s*日|D\+(\d{1,2})/i);
  if (dayMatch || /D\+|战役日|日序|多日/.test(text)) {
    const days = Math.max(3, Math.min(30, Number(dayMatch?.[1] || dayMatch?.[2] || 12)));
    return {
      unit: "day",
      totalDays: days,
      label: `简报/课题对齐约 ${days} 日相对日序（T+D）`
    };
  }

  if (theme === "air-missile-defense") {
    return {
      unit: "minute",
      totalMinutes: 180,
      label: "防空反导接战闭环默认约 3 小时相对时序（探测—识别—交战—评估）"
    };
  }
  if (theme === "sea-control") {
    return {
      unit: "minute",
      totalMinutes: 240,
      label: "通道封控研究默认约 4 小时相对时序"
    };
  }
  return {
    unit: "minute",
    totalMinutes: 150,
    label: "概念研究默认约 2.5 小时相对时序"
  };
}

function phaseTimeWeight(name = "", index = 0, total = 1) {
  const n = String(name || "");
  if (/评估|恢复|闭环|修订|再部署|巩固与恢复|评估闭合/.test(n)) return 1.0;
  if (/准备|布势|开机|授权|展开|接战准备/.test(n)) return 1.15;
  if (/识别|分批|排序|交接|警戒|感知|通道警戒|责任区/.test(n)) return 1.45;
  if (/拦截|交战|突击|主行动|封控|压制|补射|火力重组|抗击/.test(n)) return 2.4;
  if (index === 0) return 1.15;
  if (index === total - 1) return 1.0;
  if (index === Math.floor(total / 2) || index === total - 2) return 2.0;
  return 1.5;
}

function justifyPhaseDuration(name = "", index = 0, total = 1, horizon = {}) {
  const n = String(name || "");
  if (/评估|恢复|闭环|修订|再部署/.test(n)) {
    return "评估/恢复段短于主行动，用于闭合效果与恢复戒备，不可省略";
  }
  if (/准备|布势|开机|授权|展开/.test(n)) {
    return "准备/授权段控制为较短窗口，完成链路与交战条件即可转入下一职能";
  }
  if (/识别|分批|排序|交接|警戒|感知/.test(n)) {
    return "识别/布势段取中等时长，保证分批与统一交战图可形成";
  }
  if (/拦截|交战|突击|主行动|封控|压制|补射|抗击/.test(n)) {
    return "主交战/主行动段占最大份额，覆盖主要对抗与可观察效果形成";
  }
  if (index === total - 1) return "末段用于评估闭合与持续控制，时长短于主行动";
  if (index === 0) return "首段完成展开/准备条件，时长适中偏短";
  return horizon.label ? `按总窗口「${horizon.label}」职能加权分配` : "按阶段职能加权分配";
}

function formatMinuteMark(totalMinutes) {
  const safe = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `T+${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function windowsAreWeak(phases = []) {
  if (!Array.isArray(phases) || phases.length < 2) return true;
  const windows = phases.map((phase) => clean(phase?.timeWindow, 80));
  if (windows.some((item) => !item)) return true;
  // Equal-looking slices e.g. every segment 40 minutes with same pattern.
  const spans = windows.map((window) => estimateWindowSpanMinutes(window)).filter((n) => n > 0);
  if (spans.length >= 2 && spans.every((n) => n === spans[0])) return true;
  return false;
}

function estimateWindowSpanMinutes(window = "") {
  const text = String(window || "");
  if (/至结束/.test(text)) return -1;
  const day = text.match(/T\+D(\d+)\s*至\s*T\+D(\d+)/i);
  if (day) return (Number(day[2]) - Number(day[1])) * 1440;
  const min = text.match(/T\+(\d{1,2}):(\d{2})\s*至\s*T\+(\d{1,2}):(\d{2})/);
  if (min) {
    const a = Number(min[1]) * 60 + Number(min[2]);
    const b = Number(min[3]) * 60 + Number(min[4]);
    return Math.max(0, b - a);
  }
  return 0;
}

/**
 * Re-slice phase time windows by function weights so durations are explainable.
 * @param {boolean} force recompute even if AI windows look OK
 */
function applyJustifiedTimeWindows(phases = [], horizon = {}, theme = "general", { force = false } = {}) {
  const list = Array.isArray(phases) ? phases.filter(Boolean) : [];
  if (list.length < 2) return list;
  if (!force && !windowsAreWeak(list)) {
    // Keep AI windows but ensure last segment ends cleanly if missing.
    return list.map((phase, index) => ({
      ...phase,
      timeWindow: clean(phase.timeWindow, 80) || (index === list.length - 1 ? "T+…至结束" : `T+段${index + 1}`)
    }));
  }

  const weights = list.map((phase, index) => phaseTimeWeight(phase.name, index, list.length));
  const weightSum = weights.reduce((sum, w) => sum + w, 0) || list.length;

  if (horizon.unit === "day") {
    const totalDays = Math.max(list.length, Number(horizon.totalDays) || 12);
    let cursor = 0;
    return list.map((phase, index) => {
      const share = weights[index] / weightSum;
      const span = index === list.length - 1
        ? Math.max(1, totalDays - cursor)
        : Math.max(1, Math.round(totalDays * share));
      const start = cursor;
      const end = Math.min(totalDays, cursor + span);
      cursor = end;
      const timeWindow = index === list.length - 1
        ? (start >= totalDays - 1 ? `T+D${start}至结束` : `T+D${start}至T+D${Math.max(start + 1, end)}`)
        : `T+D${start}至T+D${end}`;
      return { ...phase, timeWindow, _timeBasis: justifyPhaseDuration(phase.name, index, list.length, horizon) };
    });
  }

  const totalMinutes = Math.max(60, Number(horizon.totalMinutes) || 150);
  // Keep at least 10 minutes per phase when possible.
  const minSlice = Math.min(15, Math.floor(totalMinutes / (list.length * 2)) || 10);
  let cursor = 0;
  const rawSpans = weights.map((w) => Math.max(minSlice, Math.round(totalMinutes * (w / weightSum))));
  // Normalize to totalMinutes
  let allocated = rawSpans.reduce((sum, n) => sum + n, 0);
  if (allocated !== totalMinutes) {
    rawSpans[rawSpans.length - 1] = Math.max(minSlice, rawSpans[rawSpans.length - 1] + (totalMinutes - allocated));
  }
  return list.map((phase, index) => {
    const span = rawSpans[index];
    const start = cursor;
    const end = index === list.length - 1 ? totalMinutes : Math.min(totalMinutes, cursor + span);
    cursor = end;
    const timeWindow = index === list.length - 1
      ? `${formatMinuteMark(start)}至结束`
      : `${formatMinuteMark(start)}至${formatMinuteMark(end)}`;
    return {
      ...phase,
      timeWindow,
      _timeBasis: justifyPhaseDuration(phase.name, index, list.length, horizon)
    };
  });
}

function buildJustifiedTransitions(phases = [], phaseIdList = [], sourceTransitions = [], horizon = {}) {
  return phaseIdList.slice(0, -1).map((fromPhaseId, index) => {
    const phase = phases[index] || {};
    const existing = sourceTransitions.find((item) => clean(item?.fromPhaseId, 60) === fromPhaseId)
      || sourceTransitions[index]
      || {};
    const basis = phase._timeBasis || justifyPhaseDuration(phase.name, index, phases.length, horizon);
    const endMark = String(phase.timeWindow || "").split("至")[1] || phase.timeWindow || "阶段终点";
    const noteParts = [
      `时点 ${endMark}`,
      `依据：${basis}`,
      horizon.label ? `总窗口：${horizon.label}` : ""
    ].filter(Boolean);
    return {
      id: slugId(existing?.id, `transition-${index + 1}`),
      fromPhaseId,
      toPhaseId: phaseIdList[index + 1],
      condition: clean(existing?.condition, 400)
        || (Array.isArray(phase.exitConditions) && phase.exitConditions[0])
        || "达到阶段可观察门槛并可转入下一职能",
      note: clean(existing?.note, 400) && !/依据/.test(String(existing.note || ""))
        ? `${clean(existing.note, 200)}；${noteParts.join("；")}`
        : noteParts.join("；")
    };
  });
}

/**
 * Local fallback when AI is unavailable or returns polluted / off-topic content.
 * Must stay topic-aware, never paste raw brief.approach into actions, and vary by focus/seed.
 */
function buildTopicAwarePhaseFallback({
  objective,
  approach,
  risk,
  focusTitle,
  effects,
  intent,
  forceIds = [],
  previousNames = [],
  diversitySeed = ""
}) {
  const theme = detectPhaseTheme(`${intent} ${objective} ${focusTitle} ${approach}`);
  const subject = researchSnippet(objective, 36) || researchSnippet(intent, 36) || "当前研究课题";
  const focus = researchSnippet(focusTitle, 24) || "作战聚焦";
  const pickForces = (...roles) => forceIds.filter((id) => roles.some((role) => String(id).includes(role))).slice(0, 4);
  const prevKey = previousNames.join("|");

  if (theme === "air-missile-defense") {
    const variants = [
      {
        names: ["探测接战准备", "威胁分批与交战排序", "分层拦截与漏防处置", "效果评估与持续戒备"],
        windows: ["T+00:00至T+00:40", "T+00:40至T+01:40", "T+01:40至T+03:00", "T+03:00至结束"],
        objectives: [
          `围绕“${subject}”，完成综合防空反导探测链路校核与交战授权准备`,
          "形成可复核的威胁分批与拦截优先级，具备转入交战条件",
          `按“${focus}”组织远-中-近分层拦截，将漏防控制在可补射范围`,
          "闭合拦截效果评估，恢复持续戒备与弹药/传感器管理"
        ],
        blue: [
          [
            `T+00起，岛基/海基预警概念节点建立对空对导监视，完成航迹融合与交接检查，服务“${subject}”`,
            `指挥机构明确分层责任区、交战规则与授权边界，按聚焦“${focus}”完成接战准备清单`
          ],
          [
            "完成弹道/巡航/航空威胁分批与置信标注，生成可执行拦截优先级",
            "各层火力单元按授权进入待战，严格控制内层弹药预支，避免过早消耗"
          ],
          [
            "远程拦截单元对高优先级批次实施首轮交战；中近程单元按漏防航迹组织补射",
            "段内依据初步毁伤回传调整火力分配与传感器指向，优先保障关键节点生存"
          ],
          [
            "汇总拦截/漏防与节点状态，更新剩余威胁清单与再交战排序",
            "恢复持续戒备部署，记录未达门槛项作为概念修订输入"
          ]
        ],
        red: [
          [
            "外围侦察与试探性进入，诱使预警/火控节点过早开机暴露",
            "同步投放诱饵与电子干扰，降低首层探测与识别置信"
          ],
          [
            "多轴、多高度进入以分散拦截注意力，迫使蓝方过早暴露优先交战逻辑",
            "对融合链路与火控节点施压，扰乱威胁分批与排序稳定性"
          ],
          [
            "利用首轮交战窗口组织二次突防，企图消耗内层补射弹药",
            "规避已暴露拦截扇区，延长局部突防时间窗"
          ],
          [
            "残余力量转为低强度袭扰，观察蓝方恢复与再部署节奏",
            "保留对关键节点的再施压选项，拉长其高戒备消耗"
          ]
        ],
        entries: ["综合防空反导研究边界与作战聚焦已明确", "探测接战准备门槛达成", "交战排序可执行", "主拦截窗口关闭或阶段门槛达成"],
        exits: ["交战授权与链路可用", "威胁分批与优先级可复核", "关键批次拦截/漏防态势可观察", "评估闭合且持续戒备恢复"],
        effects: [
          "具备进入主动交战的探测与授权条件",
          "统一交战图与拦截优先级可讨论、可复核",
          effects || "突防成功率受控，关键节点生存风险可管理",
          "防空反导闭环可复核，支撑简报预期效果"
        ]
      },
      {
        names: ["传感器开机管理", "航迹融合与目标交接", "重点方向集中交战", "再部署与消耗审计"],
        windows: ["T+00:00至T+00:50", "T+00:50至T+01:50", "T+01:50至T+03:10", "T+03:10至结束"],
        objectives: [
          `完成“${subject}”相关传感器开机次序与数据链路可用性确认`,
          "形成跨域航迹融合与目标交接，维持统一交战图",
          `在“${focus}”主导方向实施集中交战，非重点方向保持最低有效警戒`,
          "完成消耗审计与再部署，恢复可持续接战能力"
        ],
        blue: [
          [
            `按聚焦“${focus}”执行传感器开机管理与链路自检，确认航迹源可用`,
            `明确交战规则与授权边界，服务“${subject}”`
          ],
          [
            "跨岛基/海基/空基概念传感器完成航迹融合与目标交接",
            "指挥所维持统一交战图，标注重点方向、预备队与弹药红线"
          ],
          [
            "对重点方向高优先级批次实施集中拦截，控制非重点方向交战强度",
            "动态调整传感器指向与火力单元，保障关键节点与指挥连续"
          ],
          [
            "审计弹药与传感器消耗，更新剩余威胁与再部署方案",
            "恢复全域最低有效戒备，固化未闭合风险供专家修订"
          ]
        ],
        red: [
          [
            "以低可观测/诱饵混合试探，测量蓝方开机与反应时延",
            "干扰融合链路，降低首批航迹置信"
          ],
          [
            "沿次要方向佯动，牵制警戒与交接资源",
            "对航迹共享与火控交接链路施压，制造交战图缝隙"
          ],
          [
            "集中冲击重点方向，寻求局部突防窗口",
            "压制已暴露的拦截与火控节点，扩大漏防概率"
          ],
          [
            "观察再部署节奏，选择高价值节点实施再袭扰",
            "维持牵制压力，迫使其持续高消耗运行"
          ]
        ],
        entries: ["聚焦与研究边界明确", "传感器与链路可用", "统一交战图形成", "集中交战窗口结束或门槛达成"],
        exits: ["开机管理与授权就绪", "目标交接稳定可维持", "重点方向交战效果可观察", "消耗审计完成且戒备可恢复"],
        effects: [
          "探测资源进入可控、可授权状态",
          "跨域目标交接关系可复核",
          effects || "重点方向突防压力得到阶段性抑制",
          "可持续接战能力与修订清单可交付"
        ]
      },
      {
        names: ["岛基预警布势", "通道警戒与责任区划分", "漏防补射与火力重组", "评估闭合与修订输入"],
        windows: ["T+00:00至T+00:45", "T+00:45至T+01:45", "T+01:45至T+03:00", "T+03:00至结束"],
        objectives: [
          `围绕“${subject}”完成岛基预警节点布势与覆盖确认`,
          "完成通道方向警戒与分层责任区划分",
          `按“${focus}”处置漏防并重组火力，控制内层消耗`,
          "闭合阶段评估，输出概念修订输入"
        ],
        blue: [
          [
            "前推/加固岛基预警概念节点，确认对空对导覆盖与交接关系",
            `建立与海基/空基传感器的协同监视接口，服务“${subject}”`
          ],
          [
            "按通道与威胁方向划分分层责任区，明确主责/支援关系",
            "指挥所发布统一交战图，标注弹药红线与关键节点防护等级"
          ],
          [
            "对漏防航迹组织中近程补射，远程单元准备再交战",
            "段内重组火力与传感器任务，优先保全关键节点与指挥链路"
          ],
          [
            "完成拦截效果、漏防与节点生存评估，形成可讨论结论",
            "将未达门槛与证据缺口写入修订项，恢复持续戒备"
          ]
        ],
        red: [
          [
            "定位岛基传感器，诱导过早开机与暴露",
            "电子佯动测试协同监视缝隙"
          ],
          [
            "多方向进入测试责任区边界与交接延迟",
            "压制关键雷达/指挥节点，削弱统一交战图完整性"
          ],
          [
            "利用补射窗口实施二次突防，消耗内层弹药",
            "规避重组后的拦截扇区，寻求残余突防通道"
          ],
          [
            "评估蓝方修订与恢复节奏，保留再施压选项",
            "转为低强度牵制，拉长其高戒备时间"
          ]
        ],
        entries: ["课题与防空反导聚焦明确", "预警布势完成", "责任区与交战图可用", "主交战/补射窗口结束"],
        exits: ["覆盖与交接关系可确认", "责任区划分可执行", "漏防处置态势可观察", "评估闭合且修订输入形成"],
        effects: [
          "岛基预警布势达到可接战起点",
          "通道警戒与责任关系清晰可复核",
          effects || "漏防风险可控，火力重组完成",
          "阶段结论与修订清单可支撑后续兵力/OV 设计"
        ]
      }
    ];
    const avoid = variants.findIndex((item) => item.names.join("|") === prevKey);
    const index = stableVariantIndex(`${focus}|${intent}|${diversitySeed}`, variants.length, avoid);
    const variant = variants[index];
    return variant.names.map((name, phaseIndex) => ({
      id: `phase-${phaseIndex + 1}`,
      name,
      sequence: phaseIndex + 1,
      timeWindow: variant.windows[phaseIndex],
      objective: variant.objectives[phaseIndex],
      blueActions: variant.blue[phaseIndex],
      redActions: variant.red[phaseIndex],
      entryConditions: [variant.entries[phaseIndex]],
      exitConditions: [variant.exits[phaseIndex]],
      expectedEffects: [variant.effects[phaseIndex]],
      forceIds: pickForces("sense", "command", "airDefense", "air", "support").slice(0, 4)
    }));
  }

  if (theme === "sea-control") {
    return [
      {
        id: "phase-1",
        name: "通道感知与布势",
        sequence: 1,
        timeWindow: "T+00:00至T+00:50",
        objective: `围绕“${subject}”建立通道态势与封控布势，明确交战边界`,
        blueActions: [
          `侦察/警戒概念编组进入预定观察区，建立通道态势，服务“${subject}”`,
          `指挥节点明确封控分区、交战规则与支援关系，按聚焦“${focus}”完成布势`
        ],
        redActions: [
          "外线机动与佯动编组进入外围，试探封控边界与感知覆盖",
          "电子干扰与假目标投放，降低通道目标识别置信"
        ],
        entryConditions: ["封控目标与作战聚焦已明确"],
        exitConditions: ["通道态势可维持且边界清晰"],
        expectedEffects: ["具备转入主动封控的可复核条件"],
        forceIds: pickForces("sense", "command", "surface", "maneuver")
      },
      {
        id: "phase-2",
        name: "分层封控与节点抑制",
        sequence: 2,
        timeWindow: "T+00:50至T+02:00",
        objective: "压缩对手进出通道自由，抑制关键支援/投送节点效能",
        blueActions: [
          "对关键通道实施分层警戒与拦截准备，限制对手快速通过",
          "对支援/补给类概念节点保持压制选项，降低其持续投送效率"
        ],
        redActions: [
          "组织护航突防或绕行，试图打开局部通道",
          "提升局部防空与电子防护，保全关键投送编组"
        ],
        entryConditions: ["布势完成且交战边界清晰"],
        exitConditions: ["通道压制效果可观察或窗口关闭"],
        expectedEffects: [effects || "通道行动自由受到可观察压缩"],
        forceIds: pickForces("command", "surface", "air", "support")
      },
      {
        id: "phase-3",
        name: "持续控制与评估闭合",
        sequence: 3,
        timeWindow: "T+02:00至结束",
        objective: "巩固封控效果，完成阶段评估并输出修订输入",
        blueActions: [
          "转入持续控制与再定位，保持通道监视不中断",
          "完成效果评估，将未达门槛与证据缺口记入修订"
        ],
        redActions: [
          "在剩余能力内组织局部反击或撤离，试图恢复进出自由",
          "保留再突入选项，迫使其维持高戒备消耗"
        ],
        entryConditions: ["主封控窗口达到阶段门槛"],
        exitConditions: ["评估完成且控制态势可维持"],
        expectedEffects: ["封控闭环可复核，支撑后续设计"],
        forceIds: pickForces("sense", "command", "support")
      }
    ];
  }

  // General CONOPS fallback — never embed raw approach/risk blobs into action sentences.
  const riskHint = risk ? `；同步管理“${risk.slice(0, 36)}”类风险` : "";
  return [
    {
      id: "phase-1",
      name: "展开布势与授权",
      sequence: 1,
      timeWindow: "T+00:00至T+00:40",
      objective: `完成按聚焦“${focus}”的展开布势与行动授权，服务“${subject}”`,
      blueActions: [
        `概念作战编组进入预定展开区，建立指挥态势与分组任务，服务“${subject}”`,
        "明确阶段进入门槛、主次方向与交战规则，避免过早暴露核心企图"
      ],
      redActions: [
        "组织分区侦察与试探，评估蓝方展开节奏与暴露点",
        "关键预警/拦截节点保持受控戒备，准备提升响应等级"
      ],
      entryConditions: ["任务目标与作战聚焦已明确"],
      exitConditions: ["展开完成且具备转入主行动条件"],
      expectedEffects: ["展开与授权关系可复核"],
      forceIds: pickForces("sense", "command", "maneuver")
    },
    {
      id: "phase-2",
      name: "主行动实施",
      sequence: 2,
      timeWindow: "T+00:40至T+02:00",
      objective: `推进“${focus}”主行动，形成可观察阶段效果`,
      blueActions: [
        `按作战聚焦“${focus}”组织主方向行动，作用于关键节点/区域并保留评估窗口`,
        "同步实施侦察/电磁配合，提高目标判读与效果确认能力"
      ],
      redActions: [
        `提升局部抗击与机动反制强度${riskHint}`,
        "优先保全指挥与远程作用链路，压缩蓝方二次作用窗口"
      ],
      entryConditions: ["展开与授权完成"],
      exitConditions: ["主行动效果可观察或窗口关闭"],
      expectedEffects: [effects || "主行动阶段效果可评估"],
      forceIds: pickForces("command", "maneuver", "air", "support")
    },
    {
      id: "phase-3",
      name: "评估巩固与闭环",
      sequence: 3,
      timeWindow: "T+02:00至结束",
      objective: "完成效果评估与态势巩固，形成可交付修订输入",
      blueActions: [
        "组织阶段效果评估，更新未达门槛项与证据缺口",
        "巩固已取得态势，组织必要重组与持续控制"
      ],
      redActions: [
        "在剩余能力内组织恢复、规避或局部反击",
        "保留再行动选项，迫使其维持戒备消耗"
      ],
      entryConditions: ["主行动窗口关闭或门槛达成"],
      exitConditions: ["评估完成且任务闭环可判断"],
      expectedEffects: ["任务闭环可复核，支撑简报与下游建模"],
      forceIds: pickForces("command", "support", "sense")
    }
  ];
}

/** Normalize abstract layout slot used by concept-map compile (not real geography). */
export function normalizeLayoutSlot(value = "") {
  const slot = clean(value, 20).toLowerCase();
  return LAYOUT_SLOTS.has(slot) ? slot : "";
}

/**
 * Infer abstract relative slot from side + role.
 * Blue clusters west/center; red clusters east — for readable concept maps only.
 */
export function inferLayoutSlot(force = {}, _index = 0) {
  const existing = normalizeLayoutSlot(force?.slot);
  if (existing) return existing;
  const side = force?.side === "hostile" ? "hostile" : force?.side === "neutral" ? "neutral" : "friendly";
  if (side === "hostile") return ROLE_SLOT_HOSTILE[force?.role] || "east";
  if (side === "neutral" || side === "unknown") return "north";
  return ROLE_SLOT_FRIENDLY[force?.role] || "west";
}

function slugId(value, fallback) {
  const id = clean(value, 60).replace(/[^a-zA-Z0-9_-]/g, "-");
  return id || fallback;
}

function clean(value, maxLength) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
