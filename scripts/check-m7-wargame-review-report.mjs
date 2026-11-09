import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildReportPayload, buildMarkdownReport, buildXmlReport } from "../design-studio/src/reportBuilder.js";

console.log("--- 运行 M7-T7.8 想定推演线：复盘报告生成无缝接驳专项测试 ---");

// 模拟包含推演回合与导调裁决的 scenario 数据
const mockWargame = {
  turns: [
    {
      turnNumber: 1,
      phaseId: "phase-1",
      phaseName: "前沿侦察突破阶段",
      status: "completed",
      intents: {
        red: { text: "红方以低成本无人蜂群实施多轴向佯动，诱导蓝方相控阵雷达开机", activityRefs: [] },
        blue: { text: "蓝方保持雷达静默，启用被动红外传感网与低截获率数据链", activityRefs: [] }
      },
      injectedEvents: [
        { id: "e1", title: "前沿中继跳频阻塞", category: "网络电磁", targetSide: "red", detail: "红方局部指挥指令出现 120 秒延误" }
      ],
      adjudication: {
        outcome: "蓝方达成战术隐蔽，红方诱骗波次受阻",
        rationale: "被动红外接力切断了红方反辐射测向线索，体系韧性经受住初次冲击",
        adjudicatedAt: "2026-11-09T03:00:00.000Z"
      }
    },
    {
      turnNumber: 2,
      phaseId: "phase-2",
      phaseName: "火力突击与纵深破门阶段",
      status: "completed",
      intents: {
        red: { text: "红方第二波次有人机实施防区外精确反辐射齐射", activityRefs: [] },
        blue: { text: "蓝方组织多层防空拦截并紧急转入备用隐蔽阵地", activityRefs: [] }
      },
      injectedEvents: [
        { id: "e2", title: "突发低空气象扰动", category: "环境气象", targetSide: "both", detail: "雷暴导致导弹末端导引头视场受限" }
      ],
      adjudication: {
        outcome: "红方摧毁敌前沿两座雷达站，蓝方残余力量成功退守第二防御走廊",
        rationale: "齐射密度超过了拦截通道上限，但气象扰动使得二次毁伤评估存在模糊度",
        adjudicatedAt: "2026-11-09T04:00:00.000Z"
      }
    }
  ]
};

const mockBaseState = {
  project: { id: "proj-review-test", title: "海空一体饱和突防作战概念", kind: "tactic", classification: "内部" },
  brief: { objective: "突破敌严密设防的防空预警走廊", approach: "蜂群诱骗与防区外多轴打击", assumptions: "数据链具备基础抗毁性" },
  inspiration: {},
  direction: "防空压制",
  ov1: { nodes: [], edges: [] },
  ov5: { activities: [], edges: [] },
  ooda: { lanes: [] },
  scenario: {
    id: "scen-001",
    generatedAt: "2026-11-09T00:00:00.000Z",
    entities: [],
    wargame: mockWargame,
    simulation: { phaseOutcomes: [] }
  },
  validationResult: null,
  knowledge: { results: [] },
  deployment: null,
  reportTemplate: "wargame-review"
};

// 1. buildReportPayload 数据载荷挂载验证
{
  const payload = buildReportPayload(mockBaseState);
  assert.ok(payload.scenario, "payload 必须包含 scenario 结构");
  assert.ok(payload.scenario.wargame, "payload.scenario 必须挂载 wargame 推演回合数据");
  assert.equal(payload.scenario.wargame.turns.length, 2, "应包含 2 个推演回合记录");
  console.log("✔ 检查项 1: buildReportPayload 成功挂载 wargame 回合流水线数据");
}

// 2. buildWargameReviewMarkdown 复盘报告 Markdown 生成验证
{
  const payload = buildReportPayload(mockBaseState);
  const markdown = buildMarkdownReport(payload);

  assert.ok(markdown.includes("作战概念推演复盘与改进报告"), "Markdown 报告应包含推演复盘报告标题");
  assert.ok(markdown.includes("推演回合流水线与导调实录"), "报告中必须包含回合流水线章节");
  assert.ok(markdown.includes("| Turn 1 |"), "流水线表格必须包含 Turn 1 记录");
  assert.ok(markdown.includes("| Turn 2 |"), "流水线表格必须包含 Turn 2 记录");

  // 验证回合对抗要素与机理阐释
  assert.ok(markdown.includes("前沿中继跳频阻塞"), "报告中应记录注入的电磁扰动事件");
  assert.ok(markdown.includes("蓝方达成战术隐蔽，红方诱骗波次受阻"), "报告中应呈现导调裁决结论");
  assert.ok(markdown.includes("被动红外接力切断了红方反辐射测向线索"), "报告中应包含裁决因果机理阐释");
  assert.ok(markdown.includes("2026-11-09T03:00:00.000Z"), "应包含闭环时间戳回链");
  console.log("✔ 检查项 2: 复盘报告 Markdown 包含完整回合时序、攻防意图、事件与裁决因果机理");
}

// 3. 无推演回合时的优雅降级验证
{
  const emptyState = {
    ...mockBaseState,
    scenario: { id: "scen-empty", generatedAt: "2026-11-09T00:00:00.000Z", entities: [], wargame: null }
  };
  const emptyPayload = buildReportPayload(emptyState);
  const emptyMarkdown = buildMarkdownReport(emptyPayload);
  assert.ok(emptyMarkdown.includes("暂无多回合推演与导调记录"), "未开展多回合推演时应优雅降级提示");
  console.log("✔ 检查项 3: 未开展多回合推演时报告优雅降级提示正确");
}

// 4. buildXmlReport 结构化 XML 导出契约验证
{
  const payload = buildReportPayload(mockBaseState);
  const xmlOutput = buildXmlReport(payload);

  assert.ok(xmlOutput.includes('<wargameTimeline totalTurns="2">'), "XML 中必须包含 wargameTimeline 根节点");
  assert.ok(xmlOutput.includes('<turn number="1" phaseId="phase-1"'), "XML 中必须包含 Turn 1 节点");
  assert.ok(xmlOutput.includes("<red>红方以低成本无人蜂群实施多轴向佯动"), "XML 中应包含红方意图");
  assert.ok(xmlOutput.includes("<blue>蓝方保持雷达静默"), "XML 中应包含蓝方意图");
  assert.ok(xmlOutput.includes('title="前沿中继跳频阻塞"'), "XML 中应包含注入事件元数据");
  assert.ok(xmlOutput.includes('outcome="蓝方达成战术隐蔽，红方诱骗波次受阻"'), "XML 中应包含裁决结论属性");
  assert.ok(xmlOutput.includes("<rationale>被动红外接力切断了红方反辐射测向线索"), "XML 中应包含裁决机理阐释");
  console.log("✔ 检查项 4: XML 结构化报告成功导出 wargameTimeline 与全量回合裁决节点");
}

// 5. 静态集成验证
{
  const timelineStoreSource = fs.readFileSync(path.join(process.cwd(), "design-studio/src/wargameTimelineStore.js"), "utf8");
  assert.ok(timelineStoreSource.includes('data-action="generate-wargame-review-report"'), "流水线看板必须包含导出复盘报告快捷动作");

  const mainSource = fs.readFileSync(path.join(process.cwd(), "design-studio/src/main.js"), "utf8");
  assert.ok(mainSource.includes('action === "generate-wargame-review-report"'), "main.js 必须调度 generate-wargame-review-report");
  assert.ok(mainSource.includes('state.selectedReportTemplate = "wargame-review"'), "动作触发时必须选中 wargame-review 模板");
  console.log("✔ 检查项 5: 前端推演流水线与复盘报告导出动作无缝接驳集成完整");
}

console.log("--- M7-T7.8 复盘报告生成无缝接驳专项测试全部 PASS ---");
