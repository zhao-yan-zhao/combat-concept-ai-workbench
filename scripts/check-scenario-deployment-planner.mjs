import { applyScenarioDeploymentPlan, planScenarioDeployment } from "../design-studio/src/scenarioDeploymentPlanner.js";

const scenario = {
  entities: [
    { id: "sensor", role: "sensor", position: [0, 0] },
    { id: "command", role: "command", position: [0, 0] },
    { id: "action", role: "action", position: [0, 0] },
    { id: "support", role: "support", position: [0, 0] },
    { id: "opponent", role: "opponent", position: [0, 0] }
  ],
  areas: [
    { id: "coverage", position: [68, 26] },
    { id: "window", position: [27, 73] }
  ]
};

const plan = planScenarioDeployment(scenario);
const applied = applyScenarioDeploymentPlan(scenario, plan);
assert(plan.coordinateReference === "abstract-percent-grid" && plan.state === "suggested" && plan.placements.length === scenario.entities.length, "Deployment planner did not create a complete abstract-grid plan");
assert(applied.deploymentPlan === plan && applied.entities.every((entity) => entity.position.every((value) => value >= 0 && value <= 100)), "Deployment plan was not applied inside the abstract grid");
assert(plan.diagnostics.some((check) => check.id === "entity-separation") && plan.diagnostics.some((check) => check.id === "coverage-alignment"), "Deployment planner diagnostics are incomplete");

console.log(`Scenario deployment planner acceptance passed: ${plan.adjustedEntityIds.length} adjusted entities, ${plan.diagnostics.length} diagnostics.`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
