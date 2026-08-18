export const CURRENT_WORKFLOW_VERSION = 2;
export const WORKFLOW_STAGE_COUNT = 7;

const LEGACY_STAGE_TO_MAINLINE_STAGE = Object.freeze({
  "-1": -1,
  0: 0,
  1: 1,
  2: 3,
  3: 5,
  4: 6
});

export function migrateWorkflowCompletedThrough(workflow = {}) {
  const value = Number(workflow?.completedThrough ?? -1);
  const completedThrough = Number.isFinite(value) ? Math.trunc(value) : -1;
  if (Number(workflow?.version) >= CURRENT_WORKFLOW_VERSION) {
    return clamp(completedThrough, -1, WORKFLOW_STAGE_COUNT - 1);
  }
  return LEGACY_STAGE_TO_MAINLINE_STAGE[completedThrough] ?? clamp(completedThrough, -1, WORKFLOW_STAGE_COUNT - 1);
}

export function normalizeWorkflowProgress(workflow = {}) {
  return {
    ...workflow,
    version: CURRENT_WORKFLOW_VERSION,
    mode: workflow?.mode === "free" ? "free" : "gated",
    completedThrough: migrateWorkflowCompletedThrough(workflow)
  };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
