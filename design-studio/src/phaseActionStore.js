import {
  confirmPhaseActionConcept,
  createEmptyPhaseActionConcept,
  createPhaseActionConceptFromBrief,
  createPhaseActionConceptFromForceMission,
  isPhaseActionConceptConfirmed,
  normalizePhaseActionConcept,
  phaseActionConceptIncompleteReasons,
  phaseActionContextForDownstream
} from "../../shared/conceptPlanning.js";

const STORAGE_PREFIX = "combat-concept-project-phase-action-v1";

export function createEmptyPhaseAction() {
  return createEmptyPhaseActionConcept();
}

export function loadPhaseAction(projectId) {
  try {
    return normalizePhaseActionConcept(JSON.parse(localStorage.getItem(storageKey(projectId)) || "null"));
  } catch {
    return createEmptyPhaseActionConcept();
  }
}

export function persistPhaseAction(value, projectId) {
  const normalized = normalizePhaseActionConcept(value);
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(normalized));
  } catch {
    /* server resource remains durable */
  }
  return normalized;
}

export {
  normalizePhaseActionConcept,
  createPhaseActionConceptFromBrief,
  createPhaseActionConceptFromForceMission,
  confirmPhaseActionConcept,
  isPhaseActionConceptConfirmed,
  phaseActionConceptIncompleteReasons,
  phaseActionContextForDownstream
};

export function applyPhaseActionReviewNotes(plan, reviewNotes) {
  return normalizePhaseActionConcept({ ...normalizePhaseActionConcept(plan), reviewNotes });
}

function storageKey(projectId) {
  return `${STORAGE_PREFIX}:${projectId || "default"}`;
}
