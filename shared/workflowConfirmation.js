/**
 * Resource → workflow stage index.
 * Stages match the five research steps (plans/RESEARCH_WORKFLOW_18.md):
 * 0 研究建模 · 1 阶段行动 · 2 兵力任务 · 3 概念图 · 4 推演演示
 * Resource keys keep standard ov* ids for data I/O.
 */
export const workflowStageByResource = Object.freeze({
  brief: 0,
  knowledge: 0,
  phaseActionConcept: 1,
  ov6a: 1,
  ov6b: 1,
  ov6c: 1,
  forceMissionPlan: 2,
  ov4: 2,
  ov2: 2,
  ov3: 2,
  conceptMap: 3,
  conceptGraphicPlan: 3,
  ov1: 3,
  ov5: 3,
  ov5a: 3,
  ooda: 3,
  architecture: 3,
  scenario: 4,
  validation: 4,
  collaboration: 4,
  reportArchives: 4
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
