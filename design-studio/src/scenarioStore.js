const STORAGE_KEY = "concept-studio-scenario-v1";
import { buildScenarioGeoJson } from "./scenarioGeoJsonBuilder.js";
import { applyScenarioDeploymentPlan, planScenarioDeployment } from "./scenarioDeploymentPlanner.js";
import { createOv5SourceSignature } from "./oodaStore.js";

export function hasPersistedScenario() {
  try {
    return isValidScenario(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return false;
  }
}

export function loadScenario() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (isValidScenario(saved)) return saved;
  } catch {
    // Invalid local state is treated as no generated scenario.
  }
  return null;
}

/**
 * Full-context scenario compiler: ingests phaseAction, forceMission (tasks + forces + combatForces),
 * conceptMap and OV-5/OODA to produce an operational simulation script and entity map.
 */
export function generateScenario(stateOrOv5, oodaModel = null, { draft = null, mode = "compiled" } = {}) {
  // Backwards compatibility for legacy signature: generateScenario(ov5Model, oodaModel)
  const isLegacy = !stateOrOv5?.forceMission && !stateOrOv5?.phaseAction && Array.isArray(stateOrOv5?.activities);
  const state = isLegacy ? { ov5: stateOrOv5, ooda: oodaModel } : (stateOrOv5 || {});

  const forceMission = state.forceMission || {};
  const phaseAction = state.phaseAction || {};
  const conceptMap = state.conceptMap || {};
  const brief = state.brief || {};
  const ov5Model = state.ov5 || { activities: [] };
  const ooda = state.ooda || oodaModel || { lanes: [] };

  const combatForces = Array.isArray(forceMission.combatForces) ? forceMission.combatForces : [];
  const conceptForces = Array.isArray(forceMission.forces) ? forceMission.forces : [];
  const tasks = Array.isArray(forceMission.tasks) ? forceMission.tasks : [];
  const phases = Array.isArray(phaseAction.phases) ? phaseAction.phases : [];

  // 1. Entities: derived from combatForces + conceptForces + AI draft suggestions
  const entities = [];
  const seenEntityIds = new Set();

  if (combatForces.length > 0 || conceptForces.length > 0) {
    // Compile combat forces first
    combatForces.forEach((cf, index) => {
      const id = `entity-${cf.id || `combat-${index + 1}`}`;
      if (seenEntityIds.has(id)) return;
      seenEntityIds.add(id);
      const isHostile = cf.side === "hostile" || cf.side === "enemy";
      const role = mapForceRole(cf.role, isHostile);
      const pos = computeInitialPosition(role, isHostile, index, combatForces.length + conceptForces.length);
      const draftEntity = (draft?.entities || []).find((e) => e.id === id || e.label === cf.name);
      const cmoPlat = cf.cmoPlatform || cf.platforms?.[0] || {};

      entities.push({
        id,
        name: cf.name || `作战单元 ${index + 1}`,
        label: cf.name || `作战单元 ${index + 1}`,
        role,
        side: isHostile ? "enemy" : (cf.side || "friendly"),
        position: draftEntity?.position || cf.position || pos,
        className: isHostile ? "red" : "blue",
        platform: cmoPlat.platformName || cmoPlat.name || cf.platform || (isHostile ? "红方主战平台" : "蓝方主战平台"),
        platformQuantity: cmoPlat.quantity || cf.platformQuantity || 1,
        sensors: cmoPlat.sensors || cf.sensors || [],
        weapons: cmoPlat.weapons || cf.weapons || [],
        sourceForceId: cf.id,
        sourceConceptForceId: cf.conceptForceId || "",
        sourceTaskRefs: cf.taskRefs || [],
        sourcePhaseIds: cf.phaseIds || [],
        task: cf.task || ""
      });
    });

    // Compile concept forces
    conceptForces.forEach((f, index) => {
      const id = `entity-${f.id || `force-${index + 1}`}`;
      if (seenEntityIds.has(id)) return;
      seenEntityIds.add(id);
      const isHostile = f.side === "hostile" || f.side === "enemy";
      const role = mapForceRole(f.role, isHostile);
      const pos = computeInitialPosition(role, isHostile, entities.length, combatForces.length + conceptForces.length);
      const draftEntity = (draft?.entities || []).find((e) => e.id === id || e.label === f.name);
      const plat = f.platforms?.[0] || {};

      entities.push({
        id,
        name: f.name || `概念节点 ${index + 1}`,
        label: f.name || `概念节点 ${index + 1}`,
        role,
        side: isHostile ? "enemy" : (f.side || "friendly"),
        position: draftEntity?.position || f.position || pos,
        className: isHostile ? "red" : "blue",
        platform: plat.name || f.platform || (isHostile ? "红方概念平台" : "蓝方概念装备"),
        platformQuantity: 1,
        sensors: f.sensors || plat.sensors || [],
        weapons: f.weapons || plat.weapons || [],
        sourceForceId: f.id,
        sourceConceptForceId: f.id,
        sourceTaskRefs: f.taskRefs || [],
        sourcePhaseIds: f.phaseIds || [],
        task: f.task || ""
      });
    });
  } else {
    // Fallback placement rules if forces are not yet populated
    const placementRules = [
      { types: ["感知", "识别"], label: "多源感知节点", role: "sensor", position: [22, 28], className: "" },
      { types: ["决策"], label: "协同控制节点", role: "command", position: [40, 48], className: "" },
      { types: ["行动"], label: "行动单元", role: "action", position: [60, 60], className: "red" },
      { types: ["控制", "评估"], label: "保障与评估节点", role: "support", position: [30, 72], className: "" }
    ];
    placementRules.forEach((rule) => {
      const activity = ov5Model.activities.find((item) => rule.types.includes(item.type));
      entities.push({
        id: `entity-${rule.role}`,
        name: activity?.title || rule.label,
        label: activity?.title || rule.label,
        role: rule.role,
        side: "friendly",
        position: rule.position,
        className: rule.className,
        sourceActivityId: activity?.id || "",
        sourceOodaIds: getOodaIdsForActivity(ooda, activity?.id),
        sourceKnowledgeRefs: getKnowledgeRefsForActivity(ov5Model, ooda, activity?.id)
      });
    });
    entities.push({
      id: "entity-opponent",
      name: "对手态势节点",
      label: "对手态势节点",
      role: "opponent",
      side: "enemy",
      position: [75, 30],
      className: "blue",
      sourceActivityId: "",
      sourceOodaIds: [],
      sourceKnowledgeRefs: []
    });
  }

  // 2. Areas: derived from operational tasks area definitions
  const areas = [];
  if (tasks.length > 0) {
    tasks.forEach((task, index) => {
      const areaDef = task.area || {};
      const areaId = `area-task-${task.id || index + 1}`;
      const type = normalizeAreaType(areaDef.type || task.missionType);
      const points = Array.isArray(areaDef.points) ? areaDef.points : [];
      const pos = computeAreaPosition(type, task.side === "hostile" || task.side === "enemy", index, tasks.length);

      areas.push({
        id: areaId,
        label: areaDef.name || task.name || `任务区 ${index + 1}`,
        type,
        geometryType: areaDef.geometryType || (points.length >= 3 ? "polygon" : "circle"),
        position: pos,
        size: Math.max(100, Math.min(260, (areaDef.radiusNm || 25) * 4)),
        radiusNm: areaDef.radiusNm || 25,
        points,
        description: areaDef.description || task.objective || "",
        sourceTaskId: task.id
      });
    });
  } else {
    areas.push(
      { id: "coverage", label: "态势覆盖区", type: "coverage", position: [68, 26], size: 190 },
      { id: "window", label: "行动窗口", type: "window", position: [27, 73], size: 130 }
    );
  }

  // 3. Phases & Timeline: compiled across phases and actions
  const compiledPhases = phases.map((phase, pIndex) => {
    const rawActions = Array.isArray(phase.actions) ? phase.actions : [];
    const blueActions = Array.isArray(phase.blueActions) ? phase.blueActions : (Array.isArray(phase.primaryActions) ? phase.primaryActions : []);
    const redActions = Array.isArray(phase.redActions) ? phase.redActions : (Array.isArray(phase.secondaryActions) ? phase.secondaryActions : []);

    const events = [];
    rawActions.forEach((act, aIndex) => {
      events.push({
        id: act.id || `act-${pIndex + 1}-${aIndex + 1}`,
        name: act.name || (typeof act === "string" ? act : `行动 ${aIndex + 1}`),
        action: act.name || (typeof act === "string" ? act : `行动 ${aIndex + 1}`),
        side: act.side || "friendly"
      });
    });

    blueActions.forEach((act, aIndex) => {
      events.push({
        id: `blue-act-${pIndex + 1}-${aIndex + 1}`,
        name: typeof act === "string" ? act : act?.name || `蓝方行动 ${aIndex + 1}`,
        action: typeof act === "string" ? act : act?.name || `蓝方行动 ${aIndex + 1}`,
        side: "friendly"
      });
    });

    redActions.forEach((act, aIndex) => {
      events.push({
        id: `red-act-${pIndex + 1}-${aIndex + 1}`,
        name: typeof act === "string" ? act : act?.name || `红方对抗 ${aIndex + 1}`,
        action: typeof act === "string" ? act : act?.name || `红方对抗 ${aIndex + 1}`,
        side: "enemy"
      });
    });

    return {
      id: phase.id || `phase-${pIndex + 1}`,
      name: phase.name || `第 ${pIndex + 1} 阶段`,
      timeframe: phase.timeframe || phase.timeWindow || `T+${String(pIndex * 30).padStart(2, "0")}:00`,
      objective: phase.objective || "",
      events
    };
  });

  const timeline = buildFullContextTimeline({ phases, tasks, ooda, draftTimeline: draft?.timeline });

  const signature = createScenarioSourceFingerprint(state);
  const draftModel = {
    version: 1,
    id: `scenario-${Date.now()}`,
    title: draft?.title || `${brief.objective || "作战概念"}仿真推演想定`,
    summary: draft?.summary || `基于已确认的 ${phases.length} 个作战阶段、${tasks.length} 项任务区域与 ${entities.length} 个推演实体编译生成。`,
    narrative: draft?.narrative || "",
    generatedAt: new Date().toISOString(),
    derivedAt: new Date().toISOString(),
    sourceFingerprint: signature,
    sourceOv5Signature: createOv5SourceSignature(ov5Model),
    sourceOodaSignature: createOodaSourceSignature(ooda),
    stale: false,
    staleReason: "",
    provenance: {
      mode: draft && mode === "ai" ? "ai" : "compiled",
      generatedAt: new Date().toISOString(),
      entitiesCount: entities.length,
      areasCount: areas.length,
      eventsCount: timeline.length
    },
    source: {
      activityIds: (ov5Model.activities || []).map((item) => item.id),
      oodaNodeIds: (ooda.lanes || []).flatMap((lane) => (lane.nodes || []).map((node) => node.id)),
      taskIds: tasks.map((t) => t.id),
      phaseIds: phases.map((p) => p.id),
      forceIds: entities.map((e) => e.sourceForceId).filter(Boolean)
    },
    entities,
    areas,
    phases: compiledPhases,
    timeline
  };

  const scenario = applyScenarioDeploymentPlan(draftModel, planScenarioDeployment(draftModel));
  persistScenario(scenario);
  return scenario;
}

function mapForceRole(role = "", isHostile = false) {
  if (isHostile) return "opponent";
  const r = String(role || "").toLowerCase();
  if (r.includes("sense") || r.includes("recon") || r.includes("sensor")) return "sensor";
  if (r.includes("command") || r.includes("decide") || r.includes("c2")) return "command";
  if (r.includes("support") || r.includes("assess") || r.includes("service")) return "support";
  return "action";
}

function computeInitialPosition(role, isHostile, index, total) {
  if (isHostile) {
    const yBase = 25 + (index * 15) % 55;
    const xBase = 72 + (index % 2) * 10;
    return [Math.min(92, xBase), Math.min(85, yBase)];
  }
  if (role === "sensor") return [18 + (index * 8) % 20, 22 + (index * 12) % 35];
  if (role === "command") return [32 + (index * 6) % 15, 45 + (index * 10) % 25];
  if (role === "support") return [25 + (index * 8) % 20, 70 + (index * 8) % 20];
  // action
  return [50 + (index * 8) % 25, 40 + (index * 12) % 40];
}

function normalizeAreaType(type = "") {
  const t = String(type || "").toLowerCase();
  if (t.includes("patrol") || t.includes("recon")) return "patrol";
  if (t.includes("target") || t.includes("strike") || t.includes("assault")) return "target";
  if (t.includes("exclusion") || t.includes("barrier") || t.includes("block")) return "exclusion";
  if (t.includes("support") || t.includes("staging")) return "support";
  return "window";
}

function computeAreaPosition(type, isHostile, index, total) {
  if (isHostile || type === "target") return [65 + (index * 6) % 25, 28 + (index * 14) % 50];
  if (type === "patrol") return [28 + (index * 10) % 30, 30 + (index * 12) % 40];
  if (type === "exclusion") return [52 + (index * 6) % 20, 48 + (index * 10) % 35];
  return [35 + (index * 12) % 30, 65 + (index * 10) % 25];
}

function buildFullContextTimeline({ phases = [], tasks = [], ooda = { lanes: [] }, draftTimeline = null }) {
  if (Array.isArray(draftTimeline) && draftTimeline.length > 0) {
    return draftTimeline.map((item, index) => ({
      id: item.id || `event-ai-${index + 1}`,
      time: item.time || `T+${String(index * 15).padStart(2, "0")}`,
      phase: item.phase || "作战推进",
      title: item.title || `推演事件 ${index + 1}`,
      description: item.description || "",
      impact: item.impact || ""
    }));
  }

  if (phases.length > 0) {
    let elapsedMinutes = 0;
    const timeline = [];
    phases.forEach((phase, pIndex) => {
      const pName = phase.name || `第 ${pIndex + 1} 阶段`;
      const timeWindow = phase.timeWindow || `T+${String(elapsedMinutes).padStart(2, "0")}:00`;

      // Blue action event
      const blueActions = phase.blueActions || phase.primaryActions || [];
      if (blueActions.length > 0) {
        timeline.push({
          id: `event-p${pIndex + 1}-blue`,
          time: `T+${String(elapsedMinutes).padStart(2, "0")}:00`,
          phase: pName,
          title: `【${pName}】${blueActions[0]}`,
          description: `蓝方展开：${blueActions.join("；")}`,
          impact: phase.expectedEffects?.[0] || "达成阶段预期构想"
        });
      }

      // Red action response event
      const redActions = phase.redActions || phase.secondaryActions || [];
      if (redActions.length > 0) {
        timeline.push({
          id: `event-p${pIndex + 1}-red`,
          time: `T+${String(elapsedMinutes + 15).padStart(2, "0")}:00`,
          phase: pName,
          title: `【${pName}·红方反应】${redActions[0]}`,
          description: `红方对抗动作：${redActions.join("；")}`,
          impact: "对抗态势加剧"
        });
      }

      // Phase transition condition event
      if (phase.exitConditions?.[0]) {
        timeline.push({
          id: `event-p${pIndex + 1}-transition`,
          time: `T+${String(elapsedMinutes + 30).padStart(2, "0")}:00`,
          phase: pName,
          title: `【${pName}·转换门槛】${phase.exitConditions[0]}`,
          description: `进入下一阶段条件：${phase.exitConditions.join("；")}`,
          impact: "阶段转换条件达成"
        });
      }

      elapsedMinutes += 40;
    });
    if (timeline.length > 0) return timeline;
  }

  // Fallback to OODA timeline if phases are empty
  return buildTimeline(ooda);
}

export function createScenarioSourceFingerprint(state = {}) {
  const forceMission = state.forceMission || {};
  const phaseAction = state.phaseAction || {};
  const ov5Model = state.ov5 || (Array.isArray(state.activities) ? state : null);
  const ooda = state.ooda;
  const phases = (phaseAction.phases || []).map((p) => `${p.id}:${p.name}:${p.timeWindow}`).join("|");
  const tasks = (forceMission.tasks || []).map((t) => `${t.id}:${t.name}:${t.missionType}`).join("|");
  const forces = (forceMission.combatForces || forceMission.forces || []).map((f) => `${f.id}:${f.name}:${f.side}`).join("|");
  const ov5Sig = ov5Model ? createOv5SourceSignature(ov5Model) : "";
  const oodaSig = ooda ? createOodaSourceSignature(ooda) : "";
  return JSON.stringify({ phases, tasks, forces, ov5Sig, oodaSig });
}

export function isScenarioStale(scenario, stateOrOv5 = {}, oodaModel = null) {
  if (!scenario) return false;
  if (scenario.stale) return true;

  const isLegacy = !stateOrOv5?.forceMission && !stateOrOv5?.phaseAction && Array.isArray(stateOrOv5?.activities);
  const state = isLegacy ? { ov5: stateOrOv5, ooda: oodaModel } : (stateOrOv5 || {});

  const ov5Model = state.ov5 || (Array.isArray(stateOrOv5?.activities) ? stateOrOv5 : null);
  const ooda = state.ooda || oodaModel;
  if (scenario.sourceOv5Signature && ov5Model && scenario.sourceOv5Signature !== createOv5SourceSignature(ov5Model)) {
    return true;
  }
  if (scenario.sourceOodaSignature && ooda && scenario.sourceOodaSignature !== createOodaSourceSignature(ooda)) {
    return true;
  }

  if (scenario.sourceFingerprint) {
    return scenario.sourceFingerprint !== createScenarioSourceFingerprint(state);
  }

  return false;
}

export function createOodaSourceSignature(oodaModel = {}) {
  const lanes = Array.isArray(oodaModel?.lanes) ? oodaModel.lanes : [];
  const signaturePayload = lanes.map((lane) => ({
    id: lane?.id || "",
    nodes: (lane?.nodes || []).map((node) => ({
      id: node?.id || "",
      title: node?.title || "",
      duration: node?.duration || ""
    }))
  }));
  return JSON.stringify(signaturePayload);
}

export function getScenarioFreshness(scenario, stateOrOv5 = {}, oodaModel = null) {
  if (!scenario) {
    return { stale: false, ran: false, reason: "", derivedAt: "" };
  }
  const stale = isScenarioStale(scenario, stateOrOv5, oodaModel);
  if (!stale) {
    return {
      stale: false,
      ran: true,
      reason: "",
      derivedAt: scenario.derivedAt || scenario.generatedAt || ""
    };
  }
  return {
    stale: true,
    ran: true,
    reason: scenario.staleReason || "上游阶段、任务或兵力已变更，当前想定仅供参考，建议重新编译生成。",
    derivedAt: scenario.derivedAt || scenario.generatedAt || ""
  };
}

export function markScenarioStale(scenario, reason = "") {
  if (!scenario) return null;
  const next = {
    ...scenario,
    stale: true,
    staleAt: new Date().toISOString(),
    staleReason: String(reason || "上游模型已变更，上次想定仅供参考，请重新生成。").slice(0, 240)
  };
  persistScenario(next);
  return next;
}

export function persistScenario(scenario) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenario));
  }
}

export function clearScenario() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function createDeploymentData(scenario) {
  if (!scenario) return null;
  return {
    version: 1,
    scenarioId: scenario.id,
    entities: scenario.entities.map((entity) => ({
      id: entity.id,
      label: entity.label,
      role: entity.role,
      side: entity.side || "friendly",
      position: entity.position,
      platform: entity.platform || "",
      sourceForceId: entity.sourceForceId,
      sourceActivityId: entity.sourceActivityId,
      sourceOodaIds: entity.sourceOodaIds || [],
      sourceKnowledgeRefs: entity.sourceKnowledgeRefs || []
    })),
    areas: scenario.areas,
    timeline: scenario.timeline,
    deploymentPlan: scenario.deploymentPlan || null,
    geojson: buildScenarioGeoJson(scenario),
    generatedAt: scenario.generatedAt,
    updatedAt: scenario.updatedAt || scenario.generatedAt
  };
}

export function applyDeploymentChanges(scenario, changes, deploymentReview = null) {
  if (!scenario || !Array.isArray(changes)) return scenario;
  const positions = new Map(changes.map((change) => [change.entityId, change.position]));
  const next = {
    ...scenario,
    updatedAt: new Date().toISOString(),
    deploymentReview: deploymentReview ? { ...deploymentReview } : scenario.deploymentReview || null,
    deploymentPlan: scenario.deploymentPlan ? { ...scenario.deploymentPlan, state: "review", reviewedAt: new Date().toISOString() } : null,
    entities: scenario.entities.map((entity) => {
      const position = positions.get(entity.id);
      return position ? { ...entity, position: position.map(clampPosition) } : entity;
    })
  };
  persistScenario(next);
  return next;
}

export function recommendScenarioDeployment(scenario) {
  const next = applyScenarioDeploymentPlan(scenario, planScenarioDeployment(scenario));
  persistScenario(next);
  return next;
}

function buildTimeline(oodaModel = { lanes: [] }) {
  let elapsed = 0;
  const timeline = [];
  for (const lane of (oodaModel?.lanes || [])) {
    for (const node of (lane?.nodes || [])) {
      timeline.push({
        id: `event-${node.id}`,
        time: `T+${String(elapsed).padStart(2, "0")}:00`,
        phase: "循环推进",
        title: node.title,
        description: node.text,
        sourceNodeId: node.id
      });
      elapsed += parseMinutes(node.duration) || 10;
    }
  }
  return timeline;
}

function getOodaIdsForActivity(oodaModel, activityId) {
  if (!activityId || !Array.isArray(oodaModel?.lanes)) return [];
  return oodaModel.lanes.flatMap((lane) => lane.nodes || [])
    .filter((node) => node.sourceActivityId === activityId)
    .map((node) => node.id);
}

function getKnowledgeRefsForActivity(ov5Model, oodaModel, activityId) {
  if (!activityId) return [];
  const activity = (ov5Model?.activities || []).find((item) => item.id === activityId);
  const nodeRefs = (oodaModel?.lanes || []).flatMap((lane) => lane.nodes || [])
    .filter((node) => node.sourceActivityId === activityId)
    .flatMap((node) => node.knowledgeRefs || []);
  return [...new Set([...(activity?.refs || []), ...nodeRefs].map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 16);
}

function parseMinutes(value) {
  const match = String(value || "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function clampPosition(value) {
  return Math.min(100, Math.max(0, Number(value)));
}

function isValidScenario(value) {
  return Boolean(
    value
    && value.version === 1
    && Array.isArray(value.entities)
    && Array.isArray(value.timeline)
  );
}
