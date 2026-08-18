import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeDodafOv1b } from "../shared/dodaf/products.js";
import { buildModelTopology, MODEL_RELATION_TYPES } from "../shared/modelTopology.js";
import { createFileProjectRepository } from "../server/projectRepository.mjs";
import {
  addOv1bDecomposition,
  removeOv1bDecomposition,
  updateOv1bDecomposition
} from "../design-studio/src/ov1bStore.js";
import { renderOv1b } from "../design-studio/src/ov1bView.js";
import { renderContextualModelFlow } from "../design-studio/src/contextualModelFlow.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const normalized = normalizeDodafOv1b({
  decompositions: [
    { id: "decomp-1", parentTaskRef: "task-parent", childTaskRef: "task-child", rationale: "按能力分解", taskName: "不得复制的任务正文", status: "pending_review" },
    { id: "decomp-self", parentTaskRef: "task-self", childTaskRef: "task-self" },
    { id: "decomp-duplicate", parentTaskRef: "task-parent", childTaskRef: "task-child" }
  ]
});
assert(normalized.decompositions.length === 1, "OV1b must reject self and duplicate task pairs");
assert(normalized.decompositions[0].parentTaskRef === "task-parent" && normalized.decompositions[0].childTaskRef === "task-child", "OV1b must retain only stable parent/child task refs");
assert(!("taskName" in normalized.decompositions[0]), "OV1b must not duplicate authoritative task body fields");
assert(normalized.relations[0]?.dm2Type === "wholePart", "OV1b must expose the task decomposition relation");

let edited = addOv1bDecomposition({ decompositions: [] }, { parentTaskRef: "task-parent", childTaskRef: "task-child", rationale: "人工判定" });
assert(edited.decompositions.length === 1 && edited.decompositions[0].sourceRefs.length === 2, "OV1b store must add a source-linked decomposition");
const decompositionId = edited.decompositions[0].id;
edited = updateOv1bDecomposition(edited, decompositionId, { status: "confirmed", rationale: "已复核" });
assert(edited.decompositions[0].status === "confirmed" && edited.decompositions[0].confirmedAt, "OV1b store must persist human confirmation");
assert(removeOv1bDecomposition(edited, decompositionId).decompositions.length === 0, "OV1b store must remove a decomposition");

const forceMission = {
  status: "confirmed",
  tasksConfirmedAt: "2026-08-18T00:00:00.000Z",
  tasks: [
    { id: "task-parent", name: "上级任务", phaseId: "phase-1", objective: "形成总体效果" },
    { id: "task-child", name: "下级任务", phaseId: "phase-1", objective: "形成局部效果" }
  ],
  forces: [],
  combatForces: [],
  relations: []
};
const topology = buildModelTopology({ forceMission, ov1b: normalized });
const decompositionNode = topology.nodes.find((node) => node.resource === "ov1b" && node.objectId === "decomp-1");
assert(decompositionNode, "Topology must create an OV1b decomposition node");
assert(topology.links.some((link) => link.targetNodeId === decompositionNode.id && link.source.objectId === "task-parent" && link.relationType === MODEL_RELATION_TYPES.DERIVED_FROM), "Topology must link the parent task as decomposition source");
assert(topology.links.some((link) => link.targetNodeId === decompositionNode.id && link.source.objectId === "task-child" && link.relationType === MODEL_RELATION_TYPES.BINDS_TO), "Topology must link the child task as a stable binding");
const orphanTopology = buildModelTopology({ forceMission, ov1b: { decompositions: [{ id: "orphan", parentTaskRef: "task-parent", childTaskRef: "task-missing" }] } });
assert(orphanTopology.diagnostics.some((item) => item.code === "orphan_reference" && item.ref === "task-missing"), "Topology must diagnose missing OV1b task refs");

const validHtml = renderOv1b({ ov1b: normalized, forceMission, ov1bStorage: {} });
assert(validHtml.includes("上级任务") && validHtml.includes("下级任务") && !validHtml.includes("引用失效"), "OV1b editor must resolve valid task refs without copying task text");
const brokenHtml = renderOv1b({ ov1b: { decompositions: [{ id: "broken", parentTaskRef: "task-parent", childTaskRef: "task-missing" }] }, forceMission, ov1bStorage: {} });
assert(brokenHtml.includes("引用失效") && brokenHtml.includes("task-missing"), "OV1b editor must show broken references as conflicts");
const contextualHtml = renderContextualModelFlow("operational-task", { forceMission, operationalTaskSelectedId: "task-parent", ov1b: normalized, ov6a: { rules: [] }, ov6b: { stateMachines: [] }, ov6c: { sequences: [] } });
assert(contextualHtml.includes('data-view="ov1b"') && !contextualHtml.includes('data-view="ov1b" disabled'), "Operational-task contextual flow must expose an enabled OV1b entry");

const directory = await mkdtemp(join(tmpdir(), "combat-concept-ov1b-"));
try {
  const filePath = join(directory, "projects.json");
  let fileRepository = createFileProjectRepository({ filePath, now: () => "2026-08-18T01:00:00.000Z" });
  await fileRepository.createProject({ id: "ov1b-file", title: "OV1b File" });
  await fileRepository.saveOv1b("ov1b-file", { model: normalized, source: "test", expectedRevision: 0 });
  fileRepository.close?.();
  fileRepository = createFileProjectRepository({ filePath });
  const fileReloaded = await fileRepository.getOv1b("ov1b-file");
  assert(fileReloaded.model.decompositions[0].parentTaskRef === "task-parent", "File repository must reload OV1b task refs");
  fileRepository.close?.();

  const databasePath = join(directory, "projects.sqlite");
  let sqliteRepository = createFileProjectRepository({ filePath: join(directory, "sqlite-fallback.json"), databasePath });
  await sqliteRepository.createProject({ id: "ov1b-sqlite", title: "OV1b SQLite" });
  await sqliteRepository.saveOv1b("ov1b-sqlite", { model: normalized, source: "test", expectedRevision: 0 });
  sqliteRepository.close?.();
  sqliteRepository = createFileProjectRepository({ filePath: join(directory, "sqlite-reopen.json"), databasePath });
  const sqliteReloaded = await sqliteRepository.getOv1b("ov1b-sqlite");
  assert(sqliteRepository.getStatus().storage === "sqlite" && sqliteReloaded.model.decompositions[0].childTaskRef === "task-child", "SQLite repository must reload OV1b task refs after reopen");
  const exported = await sqliteRepository.exportArchitecture("ov1b-sqlite", { format: "json" });
  assert(exported.package.products["OV-1b"]?.decompositions?.length === 1, "Architecture export must include OV1b");
  sqliteRepository.close?.();
} finally {
  await rm(directory, { recursive: true, force: true });
}

const requestHandlerSource = await readFile(new URL("../server/createRequestHandler.mjs", import.meta.url), "utf8");
const resourceRouteSource = await readFile(new URL("../server/routes/projectResources.mjs", import.meta.url), "utf8");
assert(requestHandlerSource.includes("ov1b: projects.handleProjectOv1b") && requestHandlerSource.includes("ov1: true, ov1b: true"), "Server capabilities and routing must declare OV1b");
assert(resourceRouteSource.includes('createOvResourceHandler("ov1b", "OV-1b")') && resourceRouteSource.includes('ov1b: "saveOv1b"'), "Project resource route must persist OV1b");

console.log("OV1b dynamic-binding acceptance passed: references only, CRUD, topology diagnostics, file/SQLite reload, export, UI and route markers.");
