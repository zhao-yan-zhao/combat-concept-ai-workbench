/**
 * Resource → earliest affected seven-step mainline stage index.
 * Associated models normally invalidate only the simulation result, while
 * authoritative sources roll back their own stage and every downstream stage.
 * Resource keys keep standard ov* ids for data I/O.
 */
export const workflowStageByResource = Object.freeze({
  brief: 0,
  knowledge: 0,
  phaseActionConcept: 1,
  forceMissionPlan: 2,
  conceptGraphicPlan: 4,
  ov1: 4,
  conceptMap: 5,
  ov6a: 6,
  ov6b: 6,
  ov6c: 6,
  ov1c: 6,
  ov7: 6,
  ov4: 6,
  ov2: 6,
  ov3: 6,
  ov5: 6,
  ov5a: 6,
  ooda: 6,
  architecture: 6,
  scenario: 6,
  validation: 6
});

export function workflowStageForResource(resource, source = "") {
  if (String(resource || "") === "forceMissionPlan" && String(source || "").startsWith("force-mission:")) return 3;
  const stage = workflowStageByResource[String(resource || "")];
  return Number.isInteger(stage) ? stage : null;
}

export function earliestWorkflowStage(resources) {
  const stages = [...new Set(resources || [])]
    .map(workflowStageForResource)
    .filter((stage) => stage !== null);
  return stages.length ? Math.min(...stages) : null;
}
