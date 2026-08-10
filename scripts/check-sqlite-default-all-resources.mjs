import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { createFileProjectRepository } from "../server/projectRepository.mjs";
import { normalizeOv1, normalizeOv2, normalizeOv5, normalizeOv6a } from "../server/projectModelNormalizers.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const dir = await mkdtemp(join(tmpdir(), "sqlite-default-"));
const filePath = join(dir, "projects.json");
const databasePath = join(dir, "projects.sqlite");

const seed = {
  version: 1,
  projectCatalog: {
    demo: { id: "demo", title: "Demo", description: "", archived: false, createdAt: "2026-07-24T00:00:00.000Z", updatedAt: "2026-07-24T00:00:00.000Z", workflow: {} }
  },
  projects: {
    demo: {
      revision: 1,
      briefRevision: 1,
      updatedAt: "2026-07-24T00:00:00.000Z",
      direction: "测试",
      brief: { researchIntent: "", objective: "目标", approach: "方法", assumptions: "假设", expectedEffects: "效果", risk: "风险", evidenceRefs: [] },
      audit: []
    }
  }
};
await writeFile(filePath, JSON.stringify(seed), "utf8");

// Empty SQLite + existing JSON => bootstrap into database
const repository = createFileProjectRepository({
  filePath,
  databasePath,
  now: () => "2026-07-24T01:00:00.000Z"
});

try {
  assert(repository.getStatus().storage === "sqlite", "Repository must use sqlite when databasePath is set");
  const listed = await repository.listProjects();
  assert(listed.projects.some((item) => item.id === "demo"), "Bootstrap from projects.json failed");

  const ov1 = normalizeOv1({ nodes: [{ id: "sense", label: "传感", kind: "equipment" }], edges: [] });
  const ov5 = normalizeOv5({ activities: [{ id: "a1", title: "感知", type: "感知", text: "t", sourceOv1NodeIds: ["sense"] }], edges: [] });
  const ov2 = normalizeOv2({ nodes: [{ id: "sense", label: "传感" }], exchanges: [] });
  const ov6a = normalizeOv6a({ rules: [{ id: "r1", subject: "感知", type: "约束", text: "公开证据" }] });

  let revision = 1;
  const save = async (fn, model) => {
    const result = await repository[fn]("demo", { model, source: "test", expectedRevision: revision });
    revision = result.revision;
    return result;
  };
  await save("saveOv1", ov1);
  await save("saveOv5", ov5);
  await save("saveOv2", ov2);
  await save("saveOv6a", ov6a);
  await save("saveArchitecture", {
    id: "architecture",
    name: "Demo Architecture",
    entities: ov1.entities,
    relations: ov1.relations,
    products: { "OV-1": ov1, "OV-5b": ov5, "OV-2": ov2, "OV-6a": ov6a }
  });

  repository.close?.();

  // Inspect raw SQLite tables — durable truth lives here
  const db = new DatabaseSync(databasePath);
  try {
    const resources = db.prepare("SELECT resource_key FROM project_resources WHERE project_id = ? ORDER BY resource_key").all("demo").map((row) => row.resource_key);
    for (const key of ["ov1", "ov2", "ov5", "ov6a", "architecture"]) {
      assert(resources.includes(key), `SQLite project_resources missing ${key}`);
    }
    const ov2Row = db.prepare("SELECT resource_json FROM project_resources WHERE project_id = ? AND resource_key = ?").get("demo", "ov2");
    const ov2Model = JSON.parse(ov2Row.resource_json).model;
    assert(ov2Model.schema === "dodaf-2.02-dm2-ov" && ov2Model.product === "OV-2", "OV-2 in SQLite is not DM2 product");
    const count = Number(db.prepare("SELECT COUNT(*) AS count FROM project_records").get().count || 0);
    assert(count >= 1, "project_records empty after writes");
  } finally {
    db.close();
  }

  // Re-open repository without relying on JSON mutation path
  const reopened = createFileProjectRepository({ filePath: join(dir, "missing.json"), databasePath });
  try {
    const remoteOv2 = await reopened.getOv2("demo");
    assert(remoteOv2.exists && remoteOv2.model.product === "OV-2", "OV-2 not reloaded from SQLite alone");
    const remoteArch = await reopened.getArchitecture("demo");
    assert(remoteArch.exists && remoteArch.model.entities.length >= 1, "Architecture not reloaded from SQLite alone");
  } finally {
    reopened.close?.();
  }

  // Source JSON may still exist but is not required after bootstrap
  const stillThere = await readFile(filePath, "utf8");
  assert(stillThere.includes("demo"), "Bootstrap source file should remain untouched as backup");
} finally {
  repository.close?.();
  await rm(dir, { recursive: true, force: true });
}

console.log("SQLite default all-resources acceptance passed: bootstrap, OV products, architecture all stored in database tables.");
