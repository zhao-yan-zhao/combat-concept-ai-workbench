import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createFileProjectRepository } from "../server/projectRepository.mjs";

const directory = await mkdtemp(join(tmpdir(), "combat-concept-sqlite-project-"));
const databasePath = join(directory, "projects.sqlite");
const options = { filePath: join(directory, "unused-projects.json"), databasePath, now: () => "2026-07-14T00:00:00.000Z" };
let first;
let reopened;
try {
  first = createFileProjectRepository(options);
  assert(first.getStatus().storage === "sqlite", "SQLite project repository did not expose its storage mode");
  const createdProject = await first.createProject({ id: "study-alpha", title: "SQLite study alpha", description: "Project catalog acceptance" });
  assert(createdProject.project.id === "study-alpha" && createdProject.project.revision === 0, "SQLite project catalog did not create a project metadata record");
  const visibleProjects = await first.listProjects();
  assert(visibleProjects.projects.some((item) => item.id === "study-alpha" && item.title === "SQLite study alpha"), "SQLite project catalog did not list the created project");
  const archivedProject = await first.updateProject("study-alpha", { archived: true });
  assert(archivedProject.project.archived, "SQLite project catalog did not archive the project");
  assert(!(await first.listProjects()).projects.some((item) => item.id === "study-alpha") && (await first.listProjects({ includeArchived: true })).projects.some((item) => item.id === "study-alpha"), "Archived project visibility was not bounded by the list option");
  const saved = await first.saveBrief("default", { direction: "SQLite", source: "acceptance", brief: { objective: "Durable project", approach: "SQLite", assumptions: "Local", risk: "Review" }, inspiration: { stage: 1, messages: [{ role: "assistant", topic: "idea", source: "local", text: "Record the research idea.", createdAt: "2026-07-14T00:00:00.000Z" }, { role: "user", topic: "idea", text: "Durable SQLite research.", createdAt: "2026-07-14T00:00:01.000Z" }] } });
  assert(saved.revision === 1, "SQLite project repository did not persist initial brief");
  first.close();
  reopened = createFileProjectRepository(options);
  const loaded = await reopened.getBrief("default");
  assert(loaded.exists && loaded.revision === 1 && loaded.brief.objective === "Durable project", "SQLite project repository did not survive reopening");
  const archivedAfterReopen = await reopened.listProjects({ includeArchived: true });
  assert(archivedAfterReopen.projects.some((item) => item.id === "study-alpha" && item.archived), "SQLite project metadata did not survive reopening");
  reopened.close();
  reopened = null;
  const database = new DatabaseSync(databasePath);
  const count = (table) => Number(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
  assert(count("project_catalog") === 1 && count("project_records") === 2 && count("project_briefs") === 1 && count("project_conversation_messages") === 2, "SQLite project data was not split into catalog, record, brief, and message tables");
  assert(count("project_repository_state") === 1, "SQLite compatibility snapshot was not retained for backup tooling");
  database.close();
  console.log("SQLite project repository acceptance passed: normalized catalog, brief, message, and record tables reopened.");
} finally {
  first?.close();
  reopened?.close();
  await rm(directory, { recursive: true, force: true });
}

function assert(condition, message) { if (!condition) throw new Error(message); }
