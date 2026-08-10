import {
  conceptGraphicContextForDownstream,
  conceptGraphicPlanIncompleteReasons,
  conceptGraphicToOv1Draft,
  confirmConceptGraphicPlan,
  createConceptGraphicPlanFromPlanning,
  createEmptyConceptGraphicPlan,
  isConceptGraphicPlanConfirmed,
  normalizeConceptGraphicPlan
} from "../../shared/conceptPlanning.js";

const STORAGE_PREFIX = "combat-concept-project-concept-graphic-v1";

export function createEmptyConceptGraphic() {
  return createEmptyConceptGraphicPlan();
}

export function loadConceptGraphic(projectId) {
  try {
    return normalizeConceptGraphicPlan(JSON.parse(localStorage.getItem(storageKey(projectId)) || "null"));
  } catch {
    return createEmptyConceptGraphicPlan();
  }
}

export function persistConceptGraphic(value, projectId) {
  const normalized = normalizeConceptGraphicPlan(value);
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(normalized));
  } catch {
    /* server resource remains durable */
  }
  return normalized;
}

export {
  normalizeConceptGraphicPlan,
  createConceptGraphicPlanFromPlanning,
  confirmConceptGraphicPlan,
  isConceptGraphicPlanConfirmed,
  conceptGraphicPlanIncompleteReasons,
  conceptGraphicContextForDownstream,
  conceptGraphicToOv1Draft
};

export function applyConceptGraphicReviewNotes(plan, reviewNotes) {
  return normalizeConceptGraphicPlan({ ...normalizeConceptGraphicPlan(plan), reviewNotes });
}

function storageKey(projectId) {
  return `${STORAGE_PREFIX}:${projectId || "default"}`;
}
