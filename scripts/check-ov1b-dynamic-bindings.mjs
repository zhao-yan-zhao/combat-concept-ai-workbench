import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeDodafOv1b } from "../shared/dodaf/products.js";
import { buildModelTopology, MODEL_RELATION_TYPES } from "../shared/modelTopology.js";
import { createFileProjectRepository } from "../server/projectRepository.mjs";
import { addOv1bTaskGroup, removeOv1bTaskGroup, updateOv1bTaskGroup } from "../design-studio/src/ov1bStore.js";
import { renderOv1b } from "../design-studio/src/ov1bView.js";

function assert(condition, message) { if (!condition) throw new Error(message); }

const legacy = normalizeDodafOv1b({ decompositions: [
  { id: "old-1", parentTaskRef: "task-1", childTaskRef: "task-2", rationale: "旧父子数据" },
  { id: "old-2", parentTaskRef: "task-1", childTaskRef: "task-3" }
] });
assert(legacy.taskGroups.length === 1 && legacy.taskGroups[0].dimension === "legacy", "Legacy pairs must migrate into one compatibility group");
assert(legacy.taskGroups[0].taskRefs.join(",") === "task-1,task-2,task-3", "Legacy migration must retain unique task references");
assert(!("decompositions" in legacy), "New normalized OV1b must not write legacy decompositions");

let edited = addOv1bTaskGroup({ taskGroups: [] }, { name: "侦察任务组", dimension: "missionType", taskRefs: ["task-1", "task-2"] });
const groupId = edited.taskGroups[0].id;
edited = updateOv1bTaskGroup(edited, groupId, { taskRefs: ["task-2", "task-1"], status: "confirmed", coordination: "依次衔接" });
assert(edited.taskGroups[0].taskRefs.join(",") === "task-2,task-1", "Task order must persist");
assert(edited.taskGroups[0].status === "confirmed" && edited.taskGroups[0].confirmedAt, "Human confirmation must persist");
assert(removeOv1bTaskGroup(edited, groupId).taskGroups.length === 0, "Task group removal must not retain the group");

const forceMission = { tasks: [
  { id: "task-1", name: "态势获取", side: "friendly", missionType: "侦察" },
  { id: "task-2", name: "目标识别", side: "friendly", missionType: "侦察" },
  { id: "task-3", name: "火力压制", side: "friendly", missionType: "打击" }
], forces: [], combatForces: [], relations: [] };
const topology = buildModelTopology({ forceMission, ov1b: legacy });
const groupNode = topology.nodes.find((node) => node.resource === "ov1b" && node.kind === "task-organization-group");
assert(groupNode, "Topology must create a task organization group node");
assert(topology.links.filter((link) => link.targetNodeId === groupNode.id && link.relationType === MODEL_RELATION_TYPES.BINDS_TO).length === 3, "Every grouped task must bind to its task group");
const orphanTopology = buildModelTopology({ forceMission, ov1b: { taskGroups: [{ id: "broken", name: "失效组", taskRefs: ["task-missing"] }] } });
assert(orphanTopology.diagnostics.some((item) => item.code === "orphan_reference" && item.ref === "task-missing"), "Missing task refs must remain diagnosable");

const html = renderOv1b({ ov1b: legacy, forceMission, ov1bStorage: {} });
assert(html.includes("任务组 1") && !html.includes("兼容整理组") && html.includes("态势获取") && html.includes("火力压制"));
assert(!html.includes("任务组审阅") && !html.includes("父任务"));

const directory = await mkdtemp(join(tmpdir(), "combat-concept-ov1b-"));
try {
  const filePath = join(directory, "projects.json");
  let repository = createFileProjectRepository({ filePath });
  await repository.createProject({ id: "ov1b-file", title: "OV1b File" });
  await repository.saveOv1b("ov1b-file", { model: legacy, source: "test", expectedRevision: 0 });
  repository.close?.();
  repository = createFileProjectRepository({ filePath });
  const reloaded = await repository.getOv1b("ov1b-file");
  assert(reloaded.model.taskGroups[0].taskRefs.length === 3, "File reload must retain task groups");
  repository.close?.();

  const databasePath = join(directory, "projects.sqlite");
  let sqlite = createFileProjectRepository({ filePath: join(directory, "fallback.json"), databasePath });
  await sqlite.createProject({ id: "ov1b-sqlite", title: "OV1b SQLite" });
  await sqlite.saveOv1b("ov1b-sqlite", { model: legacy, source: "test", expectedRevision: 0 });
  sqlite.close?.();
  sqlite = createFileProjectRepository({ filePath: join(directory, "fallback-2.json"), databasePath });
  const reopened = await sqlite.getOv1b("ov1b-sqlite");
  assert(reopened.model.taskGroups[0].taskRefs[2] === "task-3", "SQLite reopen must retain ordered task refs");
  const exported = await sqlite.exportArchitecture("ov1b-sqlite", { format: "json" });
  assert(exported.package.products["OV-1b"]?.taskGroups?.length === 1, "Architecture export must use taskGroups");
  sqlite.close?.();
} finally { await rm(directory, { recursive: true, force: true }); }

console.log("OV1b dynamic-binding acceptance passed: migration, reference-only groups, ordering, topology, persistence, export, and UI.");
