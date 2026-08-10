export const workflowStageByResource = Object.freeze({
  brief: 0,
  knowledge: 0,
  forceMissionPlan: 1,
  phaseActionConcept: 1,
  conceptMap: 1,
  conceptGraphicPlan: 1,
  ov1: 2,
  ov5: 2,
  ooda: 2,
  ov2: 3,
  ov3: 3,
  ov4: 3,
  ov5a: 3,
  ov6a: 3,
  ov6b: 3,
  ov6c: 3,
  architecture: 3,
  scenario: 4,
  validation: 4,
  collaboration: 5,
  reportArchives: 5
});

export function workflowStageForResource(resource) {
  const stage = workflowStageByResource[String(resource || "")];
  return Number.isInteger(stage) ? stage : null;
}

export function earliestWorkflowStage(resources) {
  const stages = [...new Set(resources || [])]
    .map(workflowStageForResource)
    .filter((stage) => stage !== null);
  return stages.length ? Math.min(...stages) : null;
}
