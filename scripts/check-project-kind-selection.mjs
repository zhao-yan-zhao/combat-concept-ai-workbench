// @ts-check
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createFileProjectRepository } from "../server/projectRepository.mjs";
import { renderProjectManager } from "../design-studio/src/projectManagerView.js";
import { project as defaultProject } from "../design-studio/src/data.js";

console.log("=== T3.1 项目类型二选一验证 (check-project-kind-selection) ===");

// 1. 测试 data.js 默认项目基线
assert.equal(defaultProject.kind, "tactic", "默认静态项目类型必须为 tactic");
console.log("✓ 1. data.js 默认项目基线通过");

// 2. 测试 ProjectRepository 内存与 SQLite 持久化
const tempDir = mkdtempSync(join(tmpdir(), "check-proj-kind-"));
const dbPath = join(tempDir, "projects.sqlite");
const jsonPath = join(tempDir, "projects.json");

try {
  const repo = createFileProjectRepository({ databasePath: dbPath, filePath: jsonPath });

  // 2.1 创建战法设计项目
  const p1 = await repo.createProject({
    id: "proj-tactic-01",
    kind: "tactic",
    title: "无人机群突防战法",
    description: "协同突防概念"
  });
  assert.equal(p1.project.kind, "tactic", "战法项目 kind 必须为 tactic");

  // 2.2 创建想定推演项目
  const p2 = await repo.createProject({
    id: "proj-scenario-02",
    kind: "scenario",
    title: "海峡封控想定演练",
    description: "对抗演练与规则推演"
  });
  assert.equal(p2.project.kind, "scenario", "想定项目 kind 必须为 scenario");

  // 2.3 缺省 kind 创建 -> 必须默认回退为 tactic
  const p3 = await repo.createProject({
    id: "proj-legacy-03",
    title: "未指定类型的传统项目",
    description: "历史旧项目兼容测试"
  });
  assert.equal(p3.project.kind, "tactic", "缺省 kind 必须自动默认赋为 tactic");

  // 2.4 非法 kind 传入 -> 必须安全回退为 tactic
  const p4 = await repo.createProject({
    id: "proj-fallback-04",
    kind: "invalid-arbitrary-kind",
    title: "异常类型项目",
    description: "容错测试"
  });
  assert.equal(p4.project.kind, "tactic", "异常 kind 必须安全归一化为 tactic");

  // 2.5 更新项目类型
  const updated = await repo.updateProject("proj-fallback-04", { kind: "scenario" });
  assert.equal(updated.project.kind, "scenario", "updateProject 必须支持更新类型");

  // 2.6 持久化重载验证：关闭后重新实例化，检查 SQLite 数据是否正确保留
  repo.close();

  const reloadedRepo = createFileProjectRepository({ databasePath: dbPath, filePath: jsonPath });
  const list = await reloadedRepo.listProjects();
  const map = new Map(list.projects.map((p) => [p.id, p]));

  assert.equal(map.get("proj-tactic-01")?.kind, "tactic", "重载后战法项目类型一致");
  assert.equal(map.get("proj-scenario-02")?.kind, "scenario", "重载后想定项目类型一致");
  assert.equal(map.get("proj-legacy-03")?.kind, "tactic", "重载后传统旧项目类型一致");
  assert.equal(map.get("proj-fallback-04")?.kind, "scenario", "重载后更新后的项目类型一致");
  reloadedRepo.close();
  console.log("✓ 2. 服务端与 SQLite 持久化 CRUD + 重载一致性通过");

  // 3. 测试前端 projectManagerView 渲染
  const mockDirectory = {
    projects: [
      { id: "proj-tactic-01", title: "无人机群突防战法", kind: "tactic" },
      { id: "proj-scenario-02", title: "海峡封控想定演练", kind: "scenario" }
    ]
  };

  const html = renderProjectManager({
    directory: mockDirectory,
    activeProjectId: "proj-tactic-01",
    open: true,
    createOpen: true
  });

  // 3.1 验证创建表单中提供二选一选项
  assert(html.includes('<select name="kind">'), "新建表单必须包含 kind 下拉选择器");
  assert(html.includes('value="tactic"'), "必须包含战法设计选项");
  assert(html.includes('value="scenario"'), "必须包含想定推演选项");

  // 3.2 验证项目列表显示类型徽标
  assert(html.includes('data-project-kind="tactic"'), "列表必须展示战法类型徽标");
  assert(html.includes('data-project-kind="scenario"'), "列表必须展示想定类型徽标");
  assert(html.includes("战法设计"), "列表必须呈现中文名称：战法设计");
  assert(html.includes("想定推演"), "列表必须呈现中文名称：想定推演");
  console.log("✓ 3. 前端 ProjectManager 界面选项与列表徽标呈现通过");

} finally {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // ignore temp dir cleanup
  }
}

console.log("\n=== T3.1 所有断言 100% 全部通过 ===");
