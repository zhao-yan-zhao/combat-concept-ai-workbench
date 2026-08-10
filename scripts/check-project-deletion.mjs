import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileProjectRepository } from "../server/projectRepository.mjs";

const directory = await mkdtemp(join(tmpdir(), "combat-concept-project-delete-"));
const repository = createFileProjectRepository({ filePath: join(directory, "projects.json") });

try {
  await repository.createProject({ id: "removable", title: "Removable project" });
  await repository.saveBrief("removable", { brief: { objective: "Scoped data" } });
  await assertRejects(() => repository.deleteProject("removable"), "Unarchived project was deletable");
  await repository.updateProject("removable", { archived: true });
  const result = await repository.deleteProject("removable");
  assert(result.removed && result.projectId === "removable", "Archived project deletion did not report the removed project");
  assert(!(await repository.listProjects({ includeArchived: true })).projects.some((item) => item.id === "removable"), "Deleted project remained in the directory");
  assert(!(await repository.getBrief("removable")).exists, "Deleted project record was still available");
  await assertRejects(() => repository.deleteProject("default"), "Default project was deletable");
  console.log("Project deletion acceptance passed.");
} finally {
  await rm(directory, { recursive: true, force: true });
}

async function assertRejects(run, message) {
  try { await run(); } catch { return; }
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
