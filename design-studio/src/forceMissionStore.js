import {
  confirmForceMissionPlan,
  createEmptyForceMissionPlan,
  createForceMissionPlanFromBrief,
  createOperationalTasksFromPhaseAction,
  buildOperationalTaskGenerationBatches,
  confirmOperationalTasks,
  updateOperationalTask,
  removeOperationalTask,
  updateOperationalTaskArea,
  updateOperationalTaskAreaPoint,
  addOperationalTaskAreaPoint,
  removeOperationalTaskAreaPoint,
  cmoMissionTypeLabel,
  compactForceMissionForAnalysis,
  conceptForceContextForOv1,
  conceptForcesToOv1Draft,
  forceMissionContextForDownstream,
  forceMissionDiagnostics,
  forceMissionPlanIncompleteReasons,
  operationalTaskPlanIncompleteReasons,
  combatForcePlanIncompleteReasons,
  isOperationalTaskPlanConfirmed,
  isForceMissionPlanConfirmed,
  listCmoMissionTypes,
  mapForcesForLayout,
  normalizeForceMissionPlan,
  dutyCmoSearchTerms,
  hasRealEquipmentPlatform,
  inferResearchForceProfiles,
  isEquipmentKeywordOnly,
  platformFitsConceptForce,
  preferredCountryForForceSide,
  resolveSideCountries,
  seedConceptEquipmentType,
  deriveCombatForcesFromConcept,
  addCombatForce,
  removeCombatForce,
  updateCombatForce
} from "../../shared/conceptPlanning.js";

const STORAGE_PREFIX = "combat-concept-project-force-mission-v1";

export function createEmptyForceMission() {
  return createEmptyForceMissionPlan();
}

export function loadForceMission(projectId) {
  try {
    return normalizeForceMissionPlan(JSON.parse(localStorage.getItem(storageKey(projectId)) || "null"));
  } catch {
    return createEmptyForceMissionPlan();
  }
}

export function persistForceMission(value, projectId) {
  const normalized = normalizeForceMissionPlan(value);
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(normalized));
  } catch {
    /* server resource remains durable */
  }
  return normalized;
}

export {
  normalizeForceMissionPlan,
  createForceMissionPlanFromBrief,
  createOperationalTasksFromPhaseAction,
  buildOperationalTaskGenerationBatches,
  confirmOperationalTasks,
  updateOperationalTask,
  removeOperationalTask,
  updateOperationalTaskArea,
  updateOperationalTaskAreaPoint,
  addOperationalTaskAreaPoint,
  removeOperationalTaskAreaPoint,
  confirmForceMissionPlan,
  isForceMissionPlanConfirmed,
  forceMissionPlanIncompleteReasons,
  operationalTaskPlanIncompleteReasons,
  combatForcePlanIncompleteReasons,
  isOperationalTaskPlanConfirmed,
  forceMissionContextForDownstream,
  conceptForceContextForOv1,
  conceptForcesToOv1Draft,
  forceMissionDiagnostics,
  compactForceMissionForAnalysis,
  mapForcesForLayout,
  listCmoMissionTypes,
  cmoMissionTypeLabel,
  dutyCmoSearchTerms,
  hasRealEquipmentPlatform,
  inferResearchForceProfiles,
  isEquipmentKeywordOnly,
  platformFitsConceptForce,
  preferredCountryForForceSide,
  resolveSideCountries,
  seedConceptEquipmentType,
  deriveCombatForcesFromConcept,
  addCombatForce,
  removeCombatForce,
  updateCombatForce
};

export function applyForceMissionReviewNotes(plan, reviewNotes) {
  return normalizeForceMissionPlan({ ...normalizeForceMissionPlan(plan), reviewNotes });
}

/** @param {"concept"|"combat"} layer */
export function updateForceMissionType(plan, forceId, missionType, layer = "concept") {
  return mapForce(plan, forceId, layer, (force) => ({
    ...force,
    missionType
  }));
}

/** @param {"concept"|"combat"} layer */
export function updateCombatConceptLink(plan, forceId, conceptForceId) {
  return mapForce(plan, forceId, "combat", (force) => ({
    ...force,
    conceptForceId: String(conceptForceId || "").trim()
  }));
}

/** @param {"concept"|"combat"} layer */
export function toggleForceTaskRef(plan, forceId, taskRef, checked, layer = "concept") {
  const ref = String(taskRef || "").trim();
  if (!ref) return normalizeForceMissionPlan(plan);
  return mapForce(plan, forceId, layer, (force) => {
    const refs = new Set(Array.isArray(force.taskRefs) ? force.taskRefs : []);
    if (checked) refs.add(ref);
    else refs.delete(ref);
    return { ...force, taskRefs: [...refs] };
  });
}

/** @param {"concept"|"combat"} layer */
export function attachForcePlatform(plan, forceId, platform, layer = "concept") {
  return mapForce(plan, forceId, layer, (force) => ({
    ...force,
    platforms: mergePlatforms(force.platforms, [platform], { incrementExisting: true })
  }));
}

/**
 * Attach multiple platforms to one force (batch).
 * @param {"concept"|"combat"} layer
 */
export function attachForcePlatforms(plan, forceId, platforms, layer = "concept") {
  const list = Array.isArray(platforms) ? platforms : [];
  if (!list.length) return normalizeForceMissionPlan(plan);
  return mapForce(plan, forceId, layer, (force) => ({
    ...force,
    platforms: mergePlatforms(force.platforms, list, { incrementExisting: false })
  }));
}

/**
 * Apply { forceId, layer, platforms[] } recommendations to a plan.
 */
export function applyPlatformRecommendations(plan, assignments = []) {
  let next = normalizeForceMissionPlan(plan);
  for (const item of Array.isArray(assignments) ? assignments : []) {
    const forceId = String(item?.forceId || "").trim();
    const layer = item?.layer === "concept" ? "concept" : "combat";
    const platforms = Array.isArray(item?.platforms) ? item.platforms : [];
    if (!forceId || !platforms.length) continue;
    // Concept: one equipment type; combat: refined composition (normalize caps concept to 1).
    const limited = layer === "concept" ? platforms.slice(0, 1) : platforms;
    if (layer === "concept") {
      next = mapForce(next, forceId, "concept", (force) => ({
        ...force,
        platforms: limited
      }));
    } else {
      next = attachForcePlatforms(next, forceId, limited, "combat");
    }
  }
  return next;
}

function mergePlatforms(existingList, incomingList, { incrementExisting = false } = {}) {
  const platforms = Array.isArray(existingList) ? [...existingList] : [];
  for (const platform of Array.isArray(incomingList) ? incomingList : []) {
    if (!platform?.name) continue;
    const cmoId = Number(platform?.cmoId) || 0;
    const domain = String(platform?.domain || "").trim() || "aircraft";
    const existing = platforms.findIndex((item) => item.domain === domain && Number(item.cmoId) === cmoId && cmoId > 0);
    if (existing >= 0) {
      if (incrementExisting) {
        platforms[existing] = {
          ...platforms[existing],
          quantity: Math.min(99, (Number(platforms[existing].quantity) || 1) + 1),
          name: platform.name || platforms[existing].name,
          country: platform.country || platforms[existing].country,
          category: platform.category || platforms[existing].category
        };
      }
      continue;
    }
    if (platforms.length >= 8) break;
    const country = platform.country || "";
    const category = platform.category || "";
    const basis = String(platform.basis || "").trim()
      || (cmoId > 0
        ? ["CMO DB3K 目录", `域=${domain}`, `ID=${cmoId}`, country ? `国别=${country}` : "", category ? `类别=${category}` : ""]
          .filter(Boolean)
          .join(" · ")
        : "无 CMO 目录编号，仅作概念关键词，不得当作定型装备");
    platforms.push({
      id: `platform-${platforms.length + 1}`,
      domain,
      cmoId,
      name: platform.name || "",
      country,
      category,
      quantity: Math.max(1, Math.min(99, Number(platform?.quantity) || 1)),
      basis
    });
  }
  return platforms;
}

/** @param {"concept"|"combat"} layer */
export function removeForcePlatform(plan, forceId, platformId, layer = "concept") {
  return mapForce(plan, forceId, layer, (force) => ({
    ...force,
    platforms: (force.platforms || []).filter((item) => item.id !== platformId)
  }));
}

/** @param {"concept"|"combat"} layer */
export function setForcePlatformQuantity(plan, forceId, platformId, quantity, layer = "concept") {
  return mapForce(plan, forceId, layer, (force) => ({
    ...force,
    platforms: (force.platforms || []).map((item) => (
      item.id === platformId
        ? { ...item, quantity: Math.max(1, Math.min(99, Math.trunc(Number(quantity) || 1))) }
        : item
    ))
  }));
}

function mapForce(plan, forceId, layer, mapper) {
  const normalized = normalizeForceMissionPlan(plan);
  const id = String(forceId || "").trim();
  if (!id) return normalized;
  const key = layer === "combat" ? "combatForces" : "forces";
  const list = (normalized[key] || []).map((force) => (force.id === id ? mapper(force) : force));
  const nextStatus = normalized.status === "confirmed" ? "draft" : (normalized.status === "empty" ? "draft" : normalized.status);
  return normalizeForceMissionPlan({
    ...normalized,
    status: (normalized.forces.length || normalized.combatForces.length || list.length) ? nextStatus : normalized.status,
    confirmedAt: nextStatus === "confirmed" ? normalized.confirmedAt : "",
    [key]: list
  });
}

function storageKey(projectId) {
  return `${STORAGE_PREFIX}:${projectId || "default"}`;
}
