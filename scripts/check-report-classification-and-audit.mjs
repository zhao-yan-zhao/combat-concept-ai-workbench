import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildReportPayload,
  buildMarkdownReport,
  buildRtfReport,
  buildXmlReport
} from "../design-studio/src/reportBuilder.js";
import { createFileProjectRepository } from "../server/projectRepository.mjs";

console.log("=== 1. 静态检查：密级标识与审计模块规范 ===");
const reportBuilderSource = readFileSync("./design-studio/src/reportBuilder.js", "utf8");
assert(reportBuilderSource.includes("密级标识"), "reportBuilder.js 缺少密级标识支持");
assert(reportBuilderSource.includes("\\header") && reportBuilderSource.includes("\\footer"), "reportBuilder.js RTF 缺少原生页眉页脚密级支持");
assert(reportBuilderSource.includes('classification="${xml(classification)}"'), "reportBuilder.js XML 缺少 classification 根属性");

const uiSource = readFileSync("./design-studio/src/ui.js", "utf8");
assert(uiSource.includes("data-report-classification-preset"), "ui.js 缺少密级预设选择器");
assert(uiSource.includes("data-report-classification"), "ui.js 缺少密级自定义输入框");

const reportBindingsSource = readFileSync("./design-studio/src/app/bindings/reportBindings.js", "utf8");
assert(reportBindingsSource.includes("recordExportAudit"), "reportBindings.js 缺少导出审计记录函数");
assert(reportBindingsSource.includes("updateProjectClassification"), "reportBindings.js 缺少密级更新处理函数");

const serverRepoSource = readFileSync("./server/projectRepository.mjs", "utf8");
assert(serverRepoSource.includes("recordAudit(projectId, input = {})"), "server/projectRepository.mjs 缺少 recordAudit 接口");
assert(serverRepoSource.includes("classification TEXT NOT NULL DEFAULT '内部'"), "server/projectRepository.mjs SQLite schema 缺少 classification 字段迁移");

const createRequestHandlerSource = readFileSync("./server/createRequestHandler.mjs", "utf8");
assert(createRequestHandlerSource.includes("handleRecordProjectAudit"), "server/createRequestHandler.mjs 缺少 POST /audit 路由调用");

console.log("✓ 静态代码契约检查全部通过");

console.log("=== 2. 单元测试：各格式报告密级标识渲染验证 ===");

function createMockPayload(classification = "内部", templateId = "tactic-doc") {
  const mockContext = {
    project: {
      id: "test-proj",
      title: "分布式协同打击作战概念",
      kind: "tactic",
      classification,
      citations: []
    },
    brief: {
      objective: "跨域协同快速杀伤",
      approach: "分布式编成与网络化指控",
      assumptions: "通信中继可用",
      expectedEffects: "打击时延降低 40%",
      risk: "强电磁干扰环境",
      evidenceRefs: []
    },
    inspiration: null,
    direction: "分布式海空协同",
    forceMission: null,
    ov1: { nodes: [], edges: [] },
    ov5: { activities: [], edges: [], provenance: null },
    ooda: { lanes: [{ id: "lane-1", title: "Observe", subtitle: "观察", nodes: [] }], provenance: null },
    scenario: { entities: [] },
    validationResult: { issues: [], redTeam: "红方反制推演充分", scores: [{ score: 85 }] },
    knowledge: null,
    deployment: null,
    reportTemplate: templateId
  };
  return buildReportPayload(mockContext);
}

// 2.1 默认内部密级测试
const defaultPayload = createMockPayload("内部", "tactic-doc");
assert.equal(defaultPayload.classification, "内部", "默认密级应为'内部'");
assert.equal(defaultPayload.project.classification, "内部", "project.classification 应为'内部'");

// 2.2 自定义机密密级测试
const secretPayload = createMockPayload("机密", "tactic-doc");
assert.equal(secretPayload.classification, "机密", "密级应为'机密'");

// 2.3 Markdown 报告密级验证（全部 4 套模板）
for (const tmpl of ["tactic-doc", "scenario-doc", "wargame-review", "general"]) {
  const p = createMockPayload("机密", tmpl);
  const md = buildMarkdownReport(p);
  assert(md.includes("> **密级标识**：机密"), `${tmpl} Markdown 头部缺少密级标注引用块`);
  assert(md.includes("*密级标识：机密"), `${tmpl} Markdown 尾部页脚缺少密级标注`);
}
console.log("✓ Markdown 全部 4 套模板页眉页脚密级标注验证通过");

// 2.4 RTF 报告密级验证
const rtfContent = buildRtfReport(secretPayload);
assert(rtfContent.includes("\\header"), "RTF 缺少 \\header 页眉");
assert(rtfContent.includes("\\footer"), "RTF 缺少 \\footer 页脚");
assert(rtfContent.includes("u26426?"), "RTF 中文转义应包含机密字符编码");
console.log("✓ RTF 原生页眉与页脚密级标注验证通过");

// 2.5 XML 报告密级验证
const xmlContent = buildXmlReport(secretPayload);
assert(xmlContent.includes('classification="机密"'), "XML 根节点缺少 classification 属性");
assert(xmlContent.includes("<classification>机密</classification>"), "XML 缺少 <classification> 元素");
console.log("✓ XML 密级属性与标签验证通过");

console.log("=== 3. 仓储层测试：File 与 SQLite 模式项目密级与审计事件持久化 ===");

// 3.1 File 模式
const tempDir = await mkdtemp(join(tmpdir(), "check-classification-audit-"));
try {
  const fileRepo = createFileProjectRepository({
    filePath: join(tempDir, "projects.json"),
    now: () => new Date().toISOString()
  });

  const p1 = await fileRepo.createProject({ id: "p1", title: "测试项目1" });
  assert.equal(p1.project.classification, "内部", "新创建项目默认密级应为内部");

  // 更新密级
  const updatedP1 = await fileRepo.updateProject("p1", { classification: "受限" });
  assert.equal(updatedP1.project.classification, "受限", "更新项目密级应为受限");

  // 记录导出审计
  const auditResult = await fileRepo.recordAudit("p1", {
    action: "report.exported",
    format: "docx",
    templateId: "tactic-doc",
    classification: "受限"
  });
  assert(auditResult.ok, "recordAudit 应返回 ok: true");
  assert.equal(auditResult.entry.action, "report.exported");
  assert.equal(auditResult.entry.classification, "受限");
  assert.equal(auditResult.entry.format, "docx");

  // 查询审计
  const auditList = await fileRepo.listAudit("p1", 10);
  assert(auditList.entries.length >= 1, "应查出至少 1 条审计日志");
  assert.equal(auditList.entries[0].action, "report.exported");
  assert.equal(auditList.entries[0].format, "docx");
  assert.equal(auditList.entries[0].classification, "受限");

  fileRepo.close?.();
  console.log("✓ File 模式项目密级配置与导出审计持久化验证通过");

  // 3.2 SQLite 模式
  const sqliteRepo = createFileProjectRepository({
    databasePath: join(tempDir, "projects.sqlite"),
    filePath: join(tempDir, "bootstrap.json"),
    now: () => new Date().toISOString()
  });

  const p2 = await sqliteRepo.createProject({ id: "p2", title: "测试项目2", classification: "机密" });
  assert.equal(p2.project.classification, "机密", "SQLite 创建项目指定密级应为机密");

  const auditResult2 = await sqliteRepo.recordAudit("p2", {
    action: "report.exported",
    format: "pdf",
    templateId: "scenario-doc",
    classification: "机密"
  });
  assert(auditResult2.ok, "SQLite recordAudit 应成功");

  const auditList2 = await sqliteRepo.listAudit("p2", 10);
  assert(auditList2.entries.length >= 1, "SQLite 应查出审计日志");
  assert.equal(auditList2.entries[0].action, "report.exported");
  assert.equal(auditList2.entries[0].format, "pdf");
  assert.equal(auditList2.entries[0].classification, "机密");

  sqliteRepo.close?.();
  console.log("✓ SQLite 模式项目密级配置与导出审计持久化验证通过");

} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("\n=== T4.2 密级与标识全部验证通过 (100% PASS) ===");
