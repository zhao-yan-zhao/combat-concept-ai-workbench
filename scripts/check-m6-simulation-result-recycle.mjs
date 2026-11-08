import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  extractSimulationPhaseOutcomes,
  extractSimulationActivityDeviations,
  extractSimulationDeviations,
  recycleSimulationToPhasesAndActivities,
  renderPhaseOutcomesTableMarkdown,
  renderDeviationsTableMarkdown
} from "../design-studio/src/simulationRecycleStore.js";
import {
  buildReportPayload,
  buildMarkdownReport,
  buildXmlReport
} from "../design-studio/src/reportBuilder.js";

console.log("--- 运行 M6-T6.3 推演结果回收与偏差提炼专项测试 ---");

// Mock 数据准备
const mockPhaseAction = {
  status: "confirmed",
  phases: [
    {
      id: "phase-1",
      name: "预警探测与电磁封控",
      sequence: 1,
      timeWindow: "H-24 至 H-12",
      objective: "建立空海立体感知网，压制对抗方电磁频谱",
      blueActions: ["启动相控阵远程警戒", "前推无人侦察机巡逻"],
      redActions: ["释放广域电磁干扰", "隐蔽部署机动防空单元"]
    },
    {
      id: "phase-2",
      name: "通道开辟与精确破击",
      sequence: 2,
      timeWindow: "H-12 至 H-0",
      objective: "破除关键节点防空反导屏障，撕开突破通道",
      blueActions: ["发射饱和诱饵弹组", "高超声速突防摧毁雷达站"],
      redActions: ["雷达关机机动转移", "近程拦阻射击"]
    }
  ],
  transitions: [
    { id: "trans-1", fromPhaseId: "phase-1", toPhaseId: "phase-2", condition: "探测覆盖率达成且干扰源定位" }
  ]
};

const mockOv5 = {
  provenance: "human",
  activities: [
    {
      id: "act-1",
      name: "广域雷达连续预警",
      performer: "海空联合预警中心",
      type: "reconnaissance",
      duration: "12h"
    },
    {
      id: "act-2",
      name: "无人协同电磁压制",
      performer: "", // 故意留空以触发协同偏差推导
      type: "electronic-warfare",
      duration: "8h"
    }
  ],
  edges: []
};

const mockScenario = {
  id: "scenario-rec-001",
  generatedAt: "2026-11-08T10:00:00.000Z",
  updatedAt: "2026-11-08T10:30:00.000Z",
  entities: [
    { id: "ent-1", role: "blue-radar", position: [20, 30] },
    { id: "ent-2", role: "blue-uav", position: [25, 35] }
  ],
  areas: [
    { id: "area-1", type: "patrol", position: [22, 32], size: 100 }
  ],
  timeline: [
    { id: "evt-1", time: "H-24", sourceNodeId: "act-1" },
    { id: "evt-2", time: "H-18", sourceNodeId: "" }
  ],
  simulation: {
    runs: [
      {
        id: "sim-run-001",
        adapter: { id: "local-abstract-grid", name: "本地抽象网格评估", version: "v1" },
        status: "result-recorded",
        result: {
          status: "completed",
          summary: "网格部署就绪，但区域覆盖率略低，时间线部分事件未绑定节点。",
          metrics: [
            { id: "grid-bounds", label: "网格边界合规", value: 100, unit: "%" },
            { id: "area-coverage", label: "区域覆盖一致性", value: 65, unit: "%" }, // 低于 75%，触发偏差
            { id: "timeline-completeness", label: "时间线完整性", value: 80, unit: "%" }
          ]
        }
      }
    ]
  }
};

// 1. 测试推导各阶段推进成效与战损
console.log("1. 测试阶段推演成果推导与解析...");
const phaseOutcomes = extractSimulationPhaseOutcomes(mockScenario, mockPhaseAction);
assert.equal(phaseOutcomes.length, 2, "应包含2个阶段的推演成果");
assert.equal(phaseOutcomes[0].phaseId, "phase-1");
assert.equal(phaseOutcomes[0].status, "achieved");
assert.ok(phaseOutcomes[0].lossRate.includes("%"), "战损应包含百分比");
assert.equal(phaseOutcomes[1].phaseId, "phase-2");
// 第2阶段作为后期阶段且覆盖率低，应为 partial
assert.equal(phaseOutcomes[1].status, "partial");
assert.ok(phaseOutcomes[1].durationDelta.startsWith("+"), "时差应包含正向延迟标记");
console.log("✓ 阶段推演成果推导验证通过");

// 2. 测试活动级偏差提炼
console.log("2. 测试活动级推演偏差提炼...");
const actDevs = extractSimulationActivityDeviations(mockScenario, mockOv5, mockPhaseAction);
assert.ok(actDevs.length >= 1, "应提炼出活动执行偏差");
const coordDev = actDevs.find((d) => d.category === "coordination");
assert.ok(coordDev, "act-2 无执行主体应提炼出协同偏差");
assert.equal(coordDev.activityId, "act-2");
console.log("✓ 活动级执行偏差提炼验证通过");

// 3. 测试全量偏差清单 (extractSimulationDeviations)
console.log("3. 测试综合推演执行偏差清单...");
const deviations = extractSimulationDeviations({
  scenario: mockScenario,
  phaseAction: mockPhaseAction,
  ov5: mockOv5
});
assert.ok(deviations.length >= 2, "应包含阶段偏差与活动偏差合计至少2项");
deviations.forEach((dev) => {
  assert.ok(dev.id, "偏差项应有 id");
  assert.ok(["phase", "activity"].includes(dev.targetType), "targetType 需为 phase 或 activity");
  assert.ok(dev.planned, "应有计划基准");
  assert.ok(dev.actual, "应有推演实际");
  assert.ok(dev.gap, "应有差值差距");
  assert.ok(dev.rootCause, "应有成因剖析");
  assert.ok(dev.recommendation, "应有改进处置建议");
});
console.log("✓ 综合推演执行偏差清单验证通过");

// 4. 测试回填逻辑 (recycleSimulationToPhasesAndActivities)
console.log("4. 测试推演成果向 phaseAction 与 ov5 回填...");
const recycled = recycleSimulationToPhasesAndActivities({
  scenario: mockScenario,
  phaseAction: mockPhaseAction,
  ov5: mockOv5
});
assert.equal(recycled.stats.updatedPhasesCount, 2, "应更新 2 个阶段");
assert.ok(recycled.stats.updatedActivitiesCount >= 1, "应更新至少 1 项活动");
assert.ok(recycled.phaseAction.phases[0].simulationOutcome, "阶段1应挂载 simulationOutcome");
assert.equal(recycled.phaseAction.phases[0].simulationOutcome.status, "achieved");
assert.ok(recycled.ov5.activities[1].simulationOutcome?.hasDeviation, "活动2应标记偏差");
assert.ok(recycled.scenario.simulation.deviations?.length > 0, "想定仿真结构应固化 deviations");
console.log("✓ 推演成果双向回填验证通过");

// 5. 测试 Markdown 表格生成
console.log("5. 测试推演成果与偏差 Markdown 表格渲染...");
const poLines = renderPhaseOutcomesTableMarkdown(phaseOutcomes);
assert.ok(poLines[0].includes("阶段名称"), "应包含阶段表头");
assert.ok(poLines.some((l) => l.includes("预警探测与电磁封控")), "应包含阶段名称行");

const devLines = renderDeviationsTableMarkdown(deviations);
assert.ok(devLines.some((l) => l.includes("推演偏差提炼看板")), "应包含看板概览统计");
assert.ok(devLines.some((l) => l.includes("DEV-01")), "应包含偏差编号");
console.log("✓ Markdown 表格渲染验证通过");

// 6. 测试报告集成 (wargame-review 模板与 XML)
console.log("6. 测试推演复盘报告集成 (wargame-review)...");
const payload = buildReportPayload({
  project: { id: "proj-1", title: "分布式穿透打击战法研究", kind: "scenario", classification: "内部" },
  brief: { objective: "撕裂防空网络" },
  direction: "穿透性打击",
  phaseAction: recycled.phaseAction,
  ov1: { nodes: [], edges: [] },
  ov5: recycled.ov5,
  ooda: { lanes: [], sourceActivityIds: [] },
  scenario: recycled.scenario,
  reportTemplate: "wargame-review"
});

const mdReport = buildMarkdownReport(payload);
assert.ok(mdReport.includes("## 二、各阶段推进结果与战损"), "应包含第二章");
assert.ok(mdReport.includes("### 推演阶段推进成效与战损评估"), "应注入阶段推进成效与战损评估");
assert.ok(mdReport.includes("预警探测与电磁封控"), "报告应包含具体推演阶段");
assert.ok(mdReport.includes("## 四、执行偏差与成因深度剖析"), "应包含第四章");
assert.ok(mdReport.includes("### 推演执行偏差清单 (Deviation List)"), "应注入执行偏差清单");
assert.ok(mdReport.includes("DEV-01"), "报告应包含具体偏差编号");

const xmlReport = buildXmlReport(payload);
assert.ok(xmlReport.includes("<phaseOutcomes>"), "XML 应包含 <phaseOutcomes>");
assert.ok(xmlReport.includes("<deviations>"), "XML 应包含 <deviations>");
assert.ok(xmlReport.includes("<deviation id="), "XML 应包含 <deviation> 节点");
console.log("✓ 推演复盘报告模板与 XML 规范导出验证通过");

// 7. 测试前端视图与控制器静态契约
console.log("7. 测试前端视图与控制器静态契约...");
const viewSrc = fs.readFileSync(path.resolve("design-studio/src/simulationAdapterView.js"), "utf8");
assert.ok(viewSrc.includes("recycle-simulation-to-phases-and-activities"), "视图必须提供回填按钮 action");
assert.ok(viewSrc.includes("推演结果回收与偏差提炼"), "视图必须包含回收看板标题");
assert.ok(viewSrc.includes("推演执行偏差清单"), "视图必须包含偏差清单");

const controllerSrc = fs.readFileSync(path.resolve("design-studio/src/simulationAdapterController.js"), "utf8");
assert.ok(controllerSrc.includes("recycle-simulation-to-phases-and-activities"), "控制器必须处理回填 action");
assert.ok(controllerSrc.includes("recycleSimulationToPhasesAndActivities"), "控制器必须调用回填核心引擎");
assert.ok(controllerSrc.includes("persistPhaseAction"), "控制器必须持久化回填后的 phaseAction");
assert.ok(controllerSrc.includes("persistOv5"), "控制器必须持久化回填后的 ov5");

const phaseViewSrc = fs.readFileSync(path.resolve("design-studio/src/phaseActionView.js"), "utf8");
assert.ok(phaseViewSrc.includes("phase-sim-badge"), "阶段视图应包含推演回填徽标");

const ov5ViewSrc = fs.readFileSync(path.resolve("design-studio/src/ov5MechanismView.js"), "utf8");
assert.ok(ov5ViewSrc.includes("推演偏差"), "活动视图应包含推演偏差指示");

console.log("✓ 前端视图与控制器静态契约验证通过");

console.log("--- M6-T6.3 全部测试断言 PASS (100% 成功) ---");
