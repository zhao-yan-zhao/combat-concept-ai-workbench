import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  normalizeArgumentChain,
  normalizeAssumptionItem,
  getSortedAssumptions,
  evaluateAssumptionImpact,
  saveArgumentChain,
  addAssumptionToChain,
  removeAssumptionFromChain,
  updateAssumptionInChain
} from "../design-studio/src/argumentChainStore.js";
import { generateValidation } from "../design-studio/src/validationStore.js";
import { applyIssueRepair } from "../design-studio/src/consistencyLocatorStore.js";
import { buildReportPayload, buildMarkdownReport, buildXmlReport } from "../design-studio/src/reportBuilder.js";

console.log("--- 运行 M7-T7.1 论证链与关键假设清单专项测试 ---");

// 1. 规范化与旧项目纯文本平滑迁移
{
  const oldBrief = {
    approach: "以分布式协同打击打破传统体系平衡",
    assumptions: "1. 关键战术通信通联保底 80%\n2. 具备低空自主协同突防能力"
  };

  const chain = normalizeArgumentChain(null, oldBrief);
  assert.equal(chain.claim, "以分布式协同打击打破传统体系平衡");
  assert.equal(chain.assumptions.length, 2);
  assert.equal(chain.assumptions[0].confidence, "低");
  assert.equal(chain.assumptions[1].confidence, "中");
  console.log("✔ 检查项 1: 论证链平滑迁移旧版纯文本 assumptions 成功");
}

// 2. 置信度排序：低置信度（高风险）必须置顶
{
  const rawChain = {
    claim: "要域突破与反介入控制",
    reasoning: "先发侦察与密集火力交替掩护",
    assumptions: [
      { id: "asm-high", text: "常规卫星导航信号可用", confidence: "高", ifFalse: "转入惯导", activityRefs: ["act-1"] },
      { id: "asm-low", text: "首波次通信抗干扰保底 80%", confidence: "低", ifFalse: "指挥延误大幅攀升", activityRefs: ["act-2"] },
      { id: "asm-med", text: "无人机群避障时延 < 500ms", confidence: "中", ifFalse: "突击队形受损", activityRefs: ["act-3"] }
    ]
  };

  const sorted = getSortedAssumptions(rawChain);
  assert.equal(sorted[0].id, "asm-low", "低置信度必须排在第1位置顶警示");
  assert.equal(sorted[1].id, "asm-med", "中置信度排在第2位");
  assert.equal(sorted[2].id, "asm-high", "高置信度排在最后");
  console.log("✔ 检查项 2: 关键假设按置信度排序（低置信度优先置顶）成功");
}

// 3. 假设失效连锁波及矩阵推导
{
  const chain = {
    claim: "集群突防",
    reasoning: "分域佯动破击",
    assumptions: [
      {
        id: "asm-1",
        text: "通信链路抗电磁压制",
        confidence: "低",
        ifFalse: "协同网络瘫痪，无法下达射击指令",
        activityRefs: ["act-strike-1"]
      }
    ]
  };

  const mockOv5 = {
    activities: [
      { id: "act-strike-1", name: "联合精确火力突击", title: "联合精确火力突击", phaseId: "phase-2", performerId: "force-missile" }
    ],
    edges: []
  };

  const mockPhaseAction = {
    phases: [
      { id: "phase-1", name: "远程机动与展开" },
      { id: "phase-2", name: "多域要域破击" }
    ]
  };

  const mockForceMission = {
    forces: [
      { id: "force-missile", name: "岸导打击第一梯队" }
    ]
  };

  const impacts = evaluateAssumptionImpact(chain, mockOv5, mockForceMission, mockPhaseAction);
  assert.equal(impacts.length, 1);
  const imp = impacts[0];
  assert.equal(imp.assumptionId, "asm-1");
  assert.equal(imp.severity, "critical", "低置信度且有关联活动应标记为 critical");
  assert.ok(imp.impactedPhases.includes("多域要域破击"), "推导出波及阶段");
  assert.ok(imp.impactedPerformers.includes("岸导打击第一梯队"), "推导出波及作战力量");
  assert.ok(imp.summary.includes("无法按既定构想执行"), "生成完整波及影响推演摘要");
  console.log("✔ 检查项 3: 假设失效连锁波及影响推导成功");
}

// 4. 论证链动态增删改与向后兼容保存
{
  const mockState = {
    brief: { assumptions: "" },
    ov5: { activities: [], edges: [] }
  };

  let chain = normalizeArgumentChain(null, {});
  chain = addAssumptionToChain(chain, { text: "前沿无人艇抗涌浪能力达4级海况", confidence: "低", ifFalse: "航向失稳" });
  assert.equal(chain.assumptions.length, 3);

  updateAssumptionInChain(chain, chain.assumptions[2].id, { confidence: "高" });
  assert.equal(chain.assumptions[2].confidence, "高");

  const toRemoveId = chain.assumptions[0].id;
  chain = removeAssumptionFromChain(chain, toRemoveId);
  assert.ok(!chain.assumptions.some((a) => a.id === toRemoveId));

  saveArgumentChain(mockState, chain);
  assert.ok(mockState.ov5.argumentChain);
  assert.ok(mockState.brief.assumptions.includes("失效后果"), "向后兼容同步 brief.assumptions 纯文本成功");
  console.log("✔ 检查项 4: 论证链增删改操作与向后兼容保存成功");
}

// 5. 验证规则核查：低置信度假设未关联活动或缺少失效后果时产生 issue
{
  const ov5WithRiskyAssumption = {
    activities: [
      { id: "act-1", title: "初始侦察", input: "传感器", output: "数据流" }
    ],
    edges: [],
    argumentChain: {
      claim: "分布式杀伤",
      reasoning: "协同破网",
      assumptions: [
        {
          id: "asm-orphan",
          text: "敌方防空雷达关机率超过50%",
          confidence: "低",
          ifFalse: "", // 缺少失效推论
          activityRefs: [] // 未关联活动
        }
      ]
    }
  };

  const ooda = { lanes: [] };
  const scenario = { entities: [] };
  const ov1 = { nodes: [], edges: [] };

  const validation = generateValidation(ov5WithRiskyAssumption, ooda, scenario, ov1);
  const orphanIssue = validation.issues.find((i) => i.title.includes("低置信度假设未关联活动"));
  const consequenceIssue = validation.issues.find((i) => i.title.includes("低置信度假设缺少失效推论"));

  assert.ok(orphanIssue, "低置信度未关联活动应被检出");
  assert.ok(consequenceIssue, "低置信度缺少失效推论应被检出");
  assert.ok(Array.isArray(validation.assumptionImpacts), "验证结果应注入 assumptionImpacts");
  console.log("✔ 检查项 5: 验证规则对低置信度假设问题检出成功");

  // 6. 验证规则一键自动修复
  const mockStateForRepair = {
    ov5: ov5WithRiskyAssumption
  };

  const repairResult1 = applyIssueRepair(mockStateForRepair, orphanIssue);
  assert.equal(repairResult1.modifiedDomain, "ov5");
  assert.ok(mockStateForRepair.ov5.argumentChain.assumptions[0].activityRefs.includes("act-1"), "已自动关联至活动");

  const repairResult2 = applyIssueRepair(mockStateForRepair, consequenceIssue);
  assert.equal(repairResult2.modifiedDomain, "ov5");
  assert.ok(mockStateForRepair.ov5.argumentChain.assumptions[0].ifFalse.length > 5, "已自动补全失效后果推论");
  console.log("✔ 检查项 6: 自动修复闭环应用成功");
}

// 7. 报告输出验证 (Markdown & XML)
{
  const testPayload = buildReportPayload({
    project: { title: "多域反介入概念" },
    brief: { objective: "达成要域突破", approach: "跨域协同", assumptions: "基础假设" },
    ov1: { nodes: [], edges: [] },
    ov5: {
      activities: [{ id: "act-1", title: "突防突击", input: "指令", output: "战果" }],
      edges: [],
      argumentChain: {
        claim: "通过多域异构协同撕裂对手防线",
        reasoning: "无人先行诱敌、火力错峰饱和打击",
        assumptions: [
          { id: "asm-1", text: "战术网络抗干扰保底80%", confidence: "低", ifFalse: "指挥延误过大", activityRefs: ["act-1"] }
        ]
      }
    },
    ooda: { lanes: [] },
    scenario: { entities: [] },
    knowledge: { summary: { name: "知识库", fileCount: 1 } },
    reportTemplate: { id: "tactic-doc" }
  });

  assert.ok(testPayload.argumentChain, "payload 应打包 argumentChain");
  const md = buildMarkdownReport(testPayload);
  assert.ok(md.includes("## 制胜机理论证链与关键假设清单"), "Markdown 应包含论证链大章节");
  assert.ok(md.includes("通过多域异构协同撕裂对手防线"), "Markdown 应输出核心主张");
  assert.ok(md.includes("战术网络抗干扰保底80%"), "Markdown 表格应包含假设描述");

  const xml = buildXmlReport(testPayload);
  assert.ok(xml.includes("<argumentChain>"), "XML 应包含 <argumentChain> 标签");
  assert.ok(xml.includes("<claim>通过多域异构协同撕裂对手防线</claim>"), "XML 应包含 <claim>");
  assert.ok(xml.includes("<assumption id=\"asm-1\" confidence=\"低\">"), "XML 应包含结构化假设");
  console.log("✔ 检查项 7: Markdown 与 XML 报告结构化导出成功");
}

// 8. 前端视图与控制器静态契约测试
{
  const ov5ViewContent = fs.readFileSync(path.resolve("design-studio/src/ov5MechanismView.js"), "utf8");
  assert.ok(ov5ViewContent.includes("renderArgumentChainPerspective"), "ov5MechanismView 必须包含 renderArgumentChainPerspective");
  assert.ok(ov5ViewContent.includes('data-mode="argument-chain"'), "ov5MechanismView 必须提供 argument-chain 选项卡");

  const valViewContent = fs.readFileSync(path.resolve("design-studio/src/validationView.js"), "utf8");
  assert.ok(valViewContent.includes("renderAssumptionImpactSection"), "validationView 必须包含 renderAssumptionImpactSection");

  const ov5AiCtrlContent = fs.readFileSync(path.resolve("design-studio/src/ov5AiController.js"), "utf8");
  assert.ok(ov5AiCtrlContent.includes("add-chain-assumption"), "ov5AiController 必须处理 add-chain-assumption");
  assert.ok(ov5AiCtrlContent.includes("toggle-assumption-confidence"), "ov5AiController 必须处理 toggle-assumption-confidence");
  assert.ok(ov5AiCtrlContent.includes("save-argument-chain"), "ov5AiController 必须处理 save-argument-chain");

  console.log("✔ 检查项 8: 前端视图与控制器静态契约验证通过");
}

console.log("--- M7-T7.1 论证链与关键假设清单全部 8 项断言 100% 通过！ ---");
