import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileProjectRepository } from "../server/projectRepository.mjs";
import { renderProjectManager } from "../design-studio/src/projectManagerView.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const tacticRaw = await readFile(join(process.cwd(), "design-studio/examples/tactic-example.json"), "utf8");
const scenarioRaw = await readFile(join(process.cwd(), "design-studio/examples/scenario-example.json"), "utf8");

const tacticExample = JSON.parse(tacticRaw);
const scenarioExample = JSON.parse(scenarioRaw);

// 1. 验证战法示例数据完整性与安全边界
assert(tacticExample.kind === "tactic", "战法示例 kind 必须为 tactic");
assert(tacticExample.workflow?.completedThrough === 6, "战法示例必须走完全部 6 步主线流程");
assert(tacticExample.record?.brief?.objective, "战法示例必须包含简报目标");
assert(tacticExample.record?.phaseActionConcept?.model?.phases?.length >= 4, "战法示例必须包含至少 4 个阶段");
assert(tacticExample.record?.forceMissionPlan?.model?.tasks?.length >= 3, "战法示例必须包含作战任务");
assert(tacticExample.record?.forceMissionPlan?.model?.forces?.length >= 3, "战法示例必须包含兵力编组");
assert(tacticExample.record?.ov1?.model?.nodes?.length >= 5, "战法示例必须包含 OV-1 节点");
assert(tacticExample.record?.ov5?.model?.activities?.length >= 5, "战法示例必须包含 OV-5 活动");
assert(tacticExample.record?.scenario?.model?.entities?.length >= 4, "战法示例必须包含推演实体");
assert(!tacticRaw.includes("经度") && !tacticRaw.includes("纬度"), "示例中严禁包含真实地理坐标参数");

// 2. 验证想定示例数据完整性与安全边界
assert(scenarioExample.kind === "scenario", "想定示例 kind 必须为 scenario");
assert(scenarioExample.workflow?.completedThrough === 6, "想定示例必须走完全部 6 步主线流程");
assert(scenarioExample.record?.brief?.researchIntent, "想定示例必须包含研究意图");
assert(scenarioExample.record?.phaseActionConcept?.model?.phases?.length >= 4, "想定示例必须包含推演阶段");
assert(scenarioExample.record?.forceMissionPlan?.model?.forces?.length >= 4, "想定示例必须包含双阵营兵力编组");
assert(scenarioExample.record?.ov1?.model?.nodes?.length >= 5, "想定示例必须包含总体概念节点");
assert(scenarioExample.record?.ov5?.model?.activities?.length >= 4, "想定示例必须包含活动流");
assert(scenarioExample.record?.scenario?.model?.timeline?.length >= 4, "想定示例必须包含推演回合事件");
assert(!scenarioRaw.includes("经度") && !scenarioRaw.includes("纬度"), "示例中严禁包含真实地理坐标参数");

// 3. 验证 SQLite 持久化中无覆盖复制新建与全量模型存储
const tempDir = await mkdtemp(join(tmpdir(), "combat-concept-example-test-"));
const databasePath = join(tempDir, "projects.sqlite");
const repo = createFileProjectRepository({
  filePath: join(tempDir, "projects.json"),
  databasePath,
  now: () => "2026-11-08T00:00:00.000Z"
});

try {
  // 首次载入战法示例
  const firstTactic = await repo.createProject({
    id: tacticExample.id,
    kind: tacticExample.kind,
    title: tacticExample.title,
    description: tacticExample.description,
    workflow: tacticExample.workflow,
    record: tacticExample.record
  });
  assert(firstTactic.project.id === tacticExample.id, "首次载入未保留指定项目标识");
  assert(firstTactic.project.kind === "tactic", "战法示例项目类型未能持久化为 tactic");

  // 验证模型回读
  const briefRes = await repo.getBrief(tacticExample.id);
  assert(briefRes.exists && briefRes.brief.objective === tacticExample.record.brief.objective, "简报数据回读不一致");
  const ov5Res = await repo.getOv5(tacticExample.id);
  assert(ov5Res.exists && ov5Res.model.activities.length === 5, "OV-5 活动模型回读不一致");
  const phaseRes = await repo.getPhaseActionConcept(tacticExample.id);
  assert(phaseRes.exists && phaseRes.model.phases.length === 4, "阶段行动模型回读不一致");
  const forceRes = await repo.getForceMissionPlan(tacticExample.id);
  assert(forceRes.exists && forceRes.model.tasks.length === 3, "任务兵力模型回读不一致");
  const ov1Res = await repo.getOv1(tacticExample.id);
  assert(ov1Res.exists && ov1Res.model.nodes.length === 5, "OV-1 模型回读不一致");
  const scenarioRes = await repo.getScenario(tacticExample.id);
  assert(scenarioRes.exists && scenarioRes.model.entities.length === 4, "想定推演模型回读不一致");

  // 再次载入（复制为新项目，不覆盖原项目）
  const copyId = `${tacticExample.id}-copy`;
  const copyTitle = `${tacticExample.title}（副本）`;
  const secondTactic = await repo.createProject({
    id: copyId,
    kind: tacticExample.kind,
    title: copyTitle,
    description: tacticExample.description,
    workflow: tacticExample.workflow,
    record: tacticExample.record
  });
  assert(secondTactic.project.id === copyId, "副本项目未能使用独立标识创建");

  const list = await repo.listProjects();
  assert(list.projects.some((p) => p.id === tacticExample.id), "原示例项目被意外删除或覆盖");
  assert(list.projects.some((p) => p.id === copyId), "示例副本项目未成功保存入项目列表");

  // 载入想定示例
  const scenarioProject = await repo.createProject({
    id: scenarioExample.id,
    kind: scenarioExample.kind,
    title: scenarioExample.title,
    description: scenarioExample.description,
    workflow: scenarioExample.workflow,
    record: scenarioExample.record
  });
  assert(scenarioProject.project.kind === "scenario", "想定示例类型未能持久化为 scenario");
  const scenarioBrief = await repo.getBrief(scenarioExample.id);
  assert(scenarioBrief.exists && scenarioBrief.brief.researchIntent === scenarioExample.record.brief.researchIntent, "想定简报回读不一致");

  // 4. 验证 UI 渲染包含示例载入入口
  const uiHtml = renderProjectManager({
    directory: { status: "ready", projects: list.projects },
    activeProjectId: tacticExample.id,
    open: true
  });
  assert(uiHtml.includes('data-action="load-example-project"'), "项目管理视图未渲染 load-example-project 动作");
  assert(uiHtml.includes('data-example-kind="tactic"'), "项目管理视图未包含战法示例载入入口");
  assert(uiHtml.includes('data-example-kind="scenario"'), "项目管理视图未包含想定示例载入入口");
  assert(uiHtml.includes("战法示例") && uiHtml.includes("想定示例"), "项目管理视图未包含示例按钮文案");

  console.log("✓ check-example-projects: 示例项目完整性、无覆盖新建、数据模型持久化与 UI 载入入口验证通过！");
} finally {
  repo.close?.();
  await rm(tempDir, { recursive: true, force: true });
}
