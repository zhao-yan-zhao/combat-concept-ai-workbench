import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildOv2Model } from "../design-studio/src/ov2Builder.js";
import { buildOv3Model } from "../design-studio/src/ov3Builder.js";
import { buildOv4Model } from "../design-studio/src/ov4Builder.js";
import { updateProductField } from "../design-studio/src/dodafProductStore.js";
import { toggleForceTaskRef } from "../design-studio/src/forceMissionStore.js";
import { renderForceMission } from "../design-studio/src/forceMissionView.js";
import { normalizeForceMissionPlan } from "../shared/conceptPlanning.js";
import { buildArchitectureExchangePackage, decodeArchitecturePackage, encodeArchitecturePackage } from "../shared/dodaf/exchange.js";
import { normalizeDodafOv2, normalizeDodafOv3, normalizeDodafOv4 } from "../shared/dodaf/products.js";
import { generateMockOutput } from "../shared/generator.js";
import { buildModelTopology, modelNodeId } from "../shared/modelTopology.js";
import { createFileProjectRepository } from "../server/projectRepository.mjs";

globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

const forceMission = normalizeForceMissionPlan({
  status: "confirmed",
  tasksConfirmedAt: "2026-08-18T00:00:00.000Z",
  tasks: [
    { id: "task-sense", name: "态势保障任务", side: "friendly", phaseId: "phase-1", missionType: "recon", objective: "形成态势" },
    { id: "task-command", name: "指挥控制任务", side: "friendly", phaseId: "phase-1", missionType: "command", objective: "形成决策" }
  ],
  forces: [
    { id: "force-sense", name: "感知单元", side: "friendly", role: "sense", missionType: "recon", task: "承担态势保障", taskRefs: ["task-sense"], phaseIds: ["phase-1"] },
    { id: "force-command", name: "指挥单元", side: "friendly", role: "command", missionType: "command", task: "承担指挥控制", taskRefs: ["task-command", "task-missing"], phaseIds: ["phase-1"] }
  ],
  combatForces: [],
  relations: [{ id: "rel-report", fromForceId: "force-sense", toForceId: "force-command", type: "information", note: "态势上报" }]
});

assert.deepEqual(forceMission.forces[0].taskRefs, ["task-sense"], "Force normalization must preserve stable task refs");
assert(forceMission.forces[1].taskRefs.includes("task-missing"), "Broken task refs must remain available for diagnostics");
const reboundPlan = toggleForceTaskRef(forceMission, "force-command", "task-sense", true, "concept");
assert(reboundPlan.forces.find((force) => force.id === "force-command")?.taskRefs.includes("task-sense"), "Human review must be able to add a force-to-task binding");

const ov4 = normalizeDodafOv4(buildOv4Model({ forceMission }));
assert.equal(ov4.kind, "persisted-ov4-abstract-responsibility");
assert(ov4.roles.find((role) => role.id === "force-sense")?.forceRefs.includes("force-sense"), "OV-4 roles must retain force sources");
assert(ov4.roles.find((role) => role.id === "force-command")?.taskRefs.includes("task-command"), "OV-4 roles must retain task responsibility refs");
assert(ov4.relations[0]?.sourceForceRef === "force-sense" && ov4.relations[0]?.targetForceRef === "force-command", "OV-4 relations must retain force endpoints");
assert(ov4.unresolved.brokenTaskRefs.some((item) => item.taskRef === "task-missing"), "OV-4 must diagnose broken task responsibility refs");

const ov2 = normalizeDodafOv2(buildOv2Model({ forceMission }));
assert(ov2.nodes.find((node) => node.id === "force-sense")?.taskRefs.includes("task-sense"), "OV-2 nodes must retain task sources");
assert(ov2.exchanges[0]?.sourceForceRef === "force-sense" && ov2.exchanges[0]?.targetForceRef === "force-command", "OV-2 exchanges must retain force endpoints");
assert(ov2.exchanges[0]?.taskRefs.includes("task-command"), "OV-2 exchanges must retain related tasks");

const ov3 = normalizeDodafOv3(buildOv3Model({ ov2 }));
assert.equal(ov3.exchanges.length, ov2.exchanges.length, "OV-3 must project every valid OV-2 exchange exactly once");
assert.equal(ov3.exchanges[0].sourceExchangeRef, ov2.exchanges[0].id, "OV-3 row must point to its OV-2 source exchange");
assert.equal(ov3.exchanges[0].id, ov2.exchanges[0].id, "OV-3 projection must keep the OV-2 exchange id");
const unchangedProjection = updateProductField(ov3, "ov3", `exchange.${ov3.exchanges[0].id}.output`, "independent duplicate");
assert.equal(unchangedProjection.exchanges[0].output, ov3.exchanges[0].output, "OV-3 must reject duplicate edits to OV-2 exchange facts");

const topology = buildModelTopology({ forceMission, ov2, ov3, ov4 });
assert(topology.links.some((link) => link.sourceNodeId === modelNodeId("forceMissionPlan", "task-sense") && link.targetNodeId === modelNodeId("ov4", "force-sense")), "Topology must connect tasks to OV-4 roles");
assert(topology.links.some((link) => link.sourceNodeId === modelNodeId("forceMissionPlan", "force-sense") && link.targetNodeId === modelNodeId("ov2", "force-sense")), "Topology must connect forces to OV-2 nodes");
assert(topology.links.some((link) => link.sourceNodeId === modelNodeId("ov2", ov2.exchanges[0].id) && link.targetNodeId === modelNodeId("ov3", ov3.exchanges[0].id)), "Topology must connect each OV-3 row to its OV-2 source exchange");
assert(topology.diagnostics.some((item) => item.ref === "task-missing"), "Topology must expose broken force-to-task refs");

const drifted = structuredClone(ov3);
drifted.exchanges[0].output = "drifted duplicate";
const driftTopology = buildModelTopology({ forceMission, ov2, ov3: drifted, ov4 });
assert(driftTopology.diagnostics.some((item) => item.code === "projection_drift"), "Topology must diagnose OV-3 projection drift");

const generated = generateMockOutput({
  workflow: { id: "force-mission", title: "兵力与任务", outputSchema: "ForceMissionPlan" },
  analysis: { operationalTasks: forceMission.tasks, phaseAction: { phases: [{ id: "phase-1", name: "阶段一" }] } },
  evidence: []
});
assert(generated.result.forces.some((force) => force.taskRefs?.includes("task-sense")), "Local force generation must emit stable task refs");

const openAiSource = await readFile(new URL("../server/openaiClient.mjs", import.meta.url), "utf8");
assert(openAiSource.includes('"taskRefs": ["task-1"]') && openAiSource.includes("taskRefs 必须引用 analysis.operationalTasks"), "Real AI force contract must require stable task refs");
const ov3ViewSource = await readFile(new URL("../design-studio/src/ov3View.js", import.meta.url), "utf8");
assert(ov3ViewSource.includes("交换事实由 OV-2 拥有") && !ov3ViewSource.includes('data-dodaf-field="ov3.exchange.'), "OV-3 view must remain a controlled OV-2 projection");
const forceHtml = renderForceMission({
  forceMission,
  forceMissionStorage: { mode: "project", status: "ready" },
  forceMissionLayerTab: "concept",
  forcePlatformPicker: { layer: "concept", forceId: "force-command" },
  phaseAction: { status: "confirmed", confirmedAt: "2026-08-18T00:00:00.000Z", phases: [{ id: "phase-1", name: "阶段一", sequence: 1 }] },
  cmoCatalogStatus: { open: false }
});
assert(forceHtml.includes("承接作战任务") && forceHtml.includes('data-task-ref="task-command"') && forceHtml.includes("失效引用：task-missing"), "Force detail must expose compact human task-binding review");
const planningControllerSource = await readFile(new URL("../design-studio/src/conceptPlanningController.js", import.meta.url), "utf8");
assert(planningControllerSource.includes('querySelectorAll("[data-force-task-ref]")') && planningControllerSource.includes("changeForceTaskRef("), "Force task checkboxes must be wired to the planning controller");
assert(planningControllerSource.includes('source: "force-mission:edit-task-ref"') && planningControllerSource.includes("任务承接已修改，兵力计划回到草案"), "Task-binding edits must sync and expose confirmation invalidation");
const validationControllerSource = await readFile(new URL("../design-studio/src/validationController.js", import.meta.url), "utf8");
assert(validationControllerSource.includes("forceMission: state.forceMission") && validationControllerSource.includes("ov2: state.ov2") && validationControllerSource.includes("ov3: state.ov3") && validationControllerSource.includes("ov4: state.ov4"), "Cross-model validation must consume the current organization/resource products");

const exchangePackage = buildArchitectureExchangePackage({
  projectId: "organization-resource",
  title: "Organization Resource",
  products: { ov2, ov3, ov4 }
});
const jsonRoundTrip = decodeArchitecturePackage(encodeArchitecturePackage(exchangePackage, "json"), "json");
const xmlRoundTrip = decodeArchitecturePackage(encodeArchitecturePackage(exchangePackage, "xml"), "xml");
for (const roundTrip of [jsonRoundTrip, xmlRoundTrip]) {
  assert.equal(roundTrip.products["OV-3"].exchanges[0].sourceExchangeRef, ov2.exchanges[0].id, "Architecture exchange must preserve the OV-3 projection source");
  assert(roundTrip.products["OV-2"].exchanges[0].taskRefs.includes("task-command"), "Architecture exchange must preserve OV-2 task refs");
  assert.equal(roundTrip.products["OV-4"].relations[0].sourceForceRef, "force-sense", "Architecture exchange must preserve OV-4 force refs");
}

await verifyRepositoryLineageAndReload();

console.log("Organization/resource topology acceptance passed: task-force sources, OV4/OV2 derivation, controlled OV3 projection.");

async function verifyRepositoryLineageAndReload() {
  const directory = await mkdtemp(join(tmpdir(), "combat-concept-organization-resource-"));
  const databasePath = join(directory, "projects.sqlite");
  const filePath = join(directory, "projects.json");
  let repository = createFileProjectRepository({ filePath, databasePath });
  try {
    await repository.createProject({ id: "lineage", title: "Lineage" });
    await repository.saveForceMissionPlan("lineage", { source: "test", model: forceMission });
    await repository.saveOv2("lineage", { source: "test", model: ov2 });
    await repository.saveOv4("lineage", { source: "test", model: ov4 });
    await repository.saveOv3("lineage", { source: "test", model: ov3 });
    assert.equal((await repository.getOv2("lineage")).stale, false, "Fresh OV-2 must match the force-plan lineage");
    assert.equal((await repository.getOv3("lineage")).stale, false, "Fresh OV-3 must match the OV-2 lineage");
    assert.equal((await repository.getOv4("lineage")).stale, false, "Fresh OV-4 must match the force-plan lineage");

    const changedForceMission = toggleForceTaskRef(forceMission, "force-sense", "task-command", true, "concept");
    await repository.saveForceMissionPlan("lineage", { source: "test", model: changedForceMission });
    assert.equal((await repository.getOv2("lineage")).stale, true, "A task/force revision must make OV-2 stale");
    assert.equal((await repository.getOv4("lineage")).stale, true, "A task/force revision must make OV-4 stale");
    assert.equal((await repository.getOv3("lineage")).stale, true, "OV-3 must inherit stale state from its OV-2 source");

    const refreshedOv2 = normalizeDodafOv2(buildOv2Model({ forceMission: changedForceMission }));
    const refreshedOv4 = normalizeDodafOv4(buildOv4Model({ forceMission: changedForceMission }));
    await repository.saveOv2("lineage", { source: "test", model: refreshedOv2 });
    await repository.saveOv4("lineage", { source: "test", model: refreshedOv4 });
    assert.equal((await repository.getOv2("lineage")).stale, false, "Rebuilt OV-2 must become current");
    assert.equal((await repository.getOv4("lineage")).stale, false, "Rebuilt OV-4 must become current");
    assert.equal((await repository.getOv3("lineage")).stale, true, "Updating OV-2 must keep the old OV-3 projection stale");
    await repository.saveOv3("lineage", { source: "test", model: normalizeDodafOv3(buildOv3Model({ ov2: refreshedOv2 })) });
    assert.equal((await repository.getOv3("lineage")).stale, false, "Reprojected OV-3 must become current");
  } finally {
    repository.close?.();
  }

  repository = createFileProjectRepository({ filePath, databasePath });
  try {
    assert.equal(repository.getStatus().storage, "sqlite", "Persistence check must use SQLite");
    const [storedOv2, storedOv3, storedOv4] = await Promise.all([
      repository.getOv2("lineage"),
      repository.getOv3("lineage"),
      repository.getOv4("lineage")
    ]);
    assert(storedOv2.model.exchanges[0].taskRefs.includes("task-command"), "SQLite reopen must retain OV-2 task refs");
    assert.equal(storedOv3.model.exchanges[0].sourceExchangeRef, storedOv2.model.exchanges[0].id, "SQLite reopen must retain OV-3 projection refs");
    assert.equal(storedOv4.model.relations[0].sourceForceRef, "force-sense", "SQLite reopen must retain OV-4 force refs");
    assert.equal(storedOv2.stale || storedOv3.stale || storedOv4.stale, false, "Reopened derived products must remain current");
  } finally {
    repository.close?.();
    await rm(directory, { recursive: true, force: true });
  }
}
