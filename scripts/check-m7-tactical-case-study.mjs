import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  PRESET_TACTICAL_CASES,
  normalizeTacticalCase,
  searchTacticalCases,
  formatCaseAsEvidence,
  applyCaseToArgumentChain,
  generateLocalCaseComparison
} from "../design-studio/src/tacticalCaseStore.js";
import { buildReportPayload, buildMarkdownReport, buildXmlReport } from "../design-studio/src/reportBuilder.js";
import { renderOv5Workbench } from "../design-studio/src/ov5MechanismView.js";
import { createOpenAiClient } from "../server/openaiClient.mjs";

console.log("--- 运行 M7-T7.3 战法设计线：战例借鉴专项测试 ---");

// 1. 经典战例库规范化与数据契约
{
  assert.equal(PRESET_TACTICAL_CASES.length >= 4, true, "预置战例库应至少包含4个经典战例");
  const falklands = PRESET_TACTICAL_CASES.find((c) => c.id === "case-falklands-exocet");
  assert.ok(falklands, "必须包含马岛海战经典战例");

  const normalized = normalizeTacticalCase(falklands);
  assert.equal(normalized.caseName, "马岛海战飞鱼导弹低空掠海突击");
  assert.equal(normalized.category, "反舰突防 / 低空突防");
  assert.ok(normalized.similarityPoint.includes("低空盲区"));
  assert.equal(normalized.applicableLessons.length >= 2, true);
  assert.equal(normalized.unapplicableLessons.length >= 2, true);
  assert.equal(normalized.confidence, "高");
  console.log("✔ 检查项 1: 经典战例库规范化与数据契约正确");
}

// 2. 战例检索与关键词打分
{
  const results = searchTacticalCases("防空 压制 诱饵");
  assert.ok(results.length > 0);
  assert.equal(results[0].id, "case-bekaa-valley-sead", "搜索防空压制首选应匹配贝卡谷地战例");

  const strikeResults = searchTacticalCases("突防");
  assert.ok(strikeResults.length >= 2, "应能命中马岛海战与海湾战争破门战例");

  const allCases = searchTacticalCases("");
  assert.equal(allCases.length, PRESET_TACTICAL_CASES.length, "空关键词应返回全量战例");
  console.log("✔ 检查项 2: 历史战例检索与关键词权重打分正确");
}

// 3. 战例格式化为论证链证据条目
{
  const sampleCase = PRESET_TACTICAL_CASES[0];
  const evidence = formatCaseAsEvidence(sampleCase);
  assert.equal(evidence.chunkId, `case-${sampleCase.id}`);
  assert.equal(evidence.title, `战例借鉴: ${sampleCase.caseName}`);
  assert.ok(evidence.snippet.includes("【借鉴点】"));
  assert.ok(evidence.snippet.includes("【不适用局限】"));
  console.log("✔ 检查项 3: 战例对照卡格式化为论证链支撑证据契约正确");
}

// 4. 战例一键引用至论证链支撑证据
{
  const state = {
    brief: { approach: "分布式多轴隐蔽突防" },
    ov5: {
      activities: [],
      edges: [],
      argumentChain: {
        claim: "以无人集群错峰协同打破对手防空雷达网",
        reasoning: "构建闭环杀伤网",
        evidenceRefs: [],
        assumptions: []
      }
    }
  };

  const sampleCase = PRESET_TACTICAL_CASES[1]; // 贝卡谷地
  const success = applyCaseToArgumentChain(state, sampleCase);
  assert.equal(success, true);
  assert.equal(state.ov5.argumentChain.evidenceRefs.length, 1);
  assert.equal(state.ov5.argumentChain.evidenceRefs[0].chunkId, "case-case-bekaa-valley-sead");
  assert.ok(state.ov5.argumentChain.evidenceRefs[0].title.includes("贝卡谷地"));

  // 重复引用幂等
  applyCaseToArgumentChain(state, sampleCase);
  assert.equal(state.ov5.argumentChain.evidenceRefs.length, 1, "重复引用应幂等更新");

  assert.equal(Array.isArray(state.tacticalCases), true);
  assert.equal(state.tacticalCases.length, 1);
  console.log("✔ 检查项 4: 战例一键引用至制胜论证链并同步项目战例库正确");
}

// 5. 本地规则生成战例比对分析
{
  const baseCase = PRESET_TACTICAL_CASES[2]; // 海湾战争破门
  const localComparison = generateLocalCaseComparison("超低空走廊破门战法", baseCase);
  assert.equal(localComparison.caseName, baseCase.caseName);
  assert.ok(localComparison.similarityPoint.includes("超低空走廊破门战法"));
  assert.ok(localComparison.applicableLessons.length >= 2);
  assert.ok(localComparison.unapplicableLessons.length >= 2);
  assert.equal(/\b\d+%\b|\b命中率\b|\b击沉\b/.test(localComparison.similarityPoint), false, "绝无数值杀伤");
  console.log("✔ 检查项 5: 本地规则战例比对生成正确（守牢安全防线）");
}

// 6. 统一提示词目录纳管与接口契约
{
  const client = createOpenAiClient({
    getAiServiceConfig: () => ({ baseUrl: "http://example.test/v1", model: "test" }),
    getAiApiKey: () => "test-key"
  });
  const defs = client.listPromptDefinitions();
  const prompt = defs.find((d) => d.id === "ai.tactical.case-comparison");
  assert.ok(prompt, "统一提示词目录必须纳管 ai.tactical.case-comparison");
  assert.equal(prompt.name, "战例借鉴与适用性比对分析");
  assert.ok(Array.isArray(prompt.variables));
  assert.equal(typeof client.callOpenAiCaseComparison, "function", "必须导出 callOpenAiCaseComparison");

  const serverCode = fs.readFileSync(path.resolve("server/createRequestHandler.mjs"), "utf-8");
  assert.ok(serverCode.includes("/api/tactical/case-comparison"), "服务端必须接入战例比对路由");
  console.log("✔ 检查项 6: 统一提示词目录纳管与服务端路由契约正确");
}

// 7. 战法说明书与 XML 报告导出
{
  const mockPayload = buildReportPayload({
    project: {
      title: "穿透性分布式反舰突击概念",
      direction: "分布式反舰",
      brief: { objective: "反舰突击", approach: "超低空突防", risk: "雷达发现" }
    },
    brief: { objective: "反舰突击", approach: "超低空突防", risk: "雷达发现" },
    inspiration: {},
    direction: {},
    ov1: { nodes: [], edges: [] },
    ov5: {
      activities: [],
      edges: [],
      argumentChain: {
        claim: "超低空佯动与饱和打击达成突防",
        reasoning: "压缩对手通道",
        evidenceRefs: [formatCaseAsEvidence(PRESET_TACTICAL_CASES[0])],
        assumptions: []
      }
    },
    ooda: { lanes: [] },
    scenario: null,
    validationResult: null,
    knowledge: [],
    deployment: null,
    reportTemplate: "tactic-doc",
    tacticalCases: [PRESET_TACTICAL_CASES[0]]
  });

  assert.ok(mockPayload.tacticalCases.length === 1);

  // Markdown 报告校验
  const md = buildMarkdownReport(mockPayload);
  assert.ok(md.includes("历史相似战例借鉴与适用性剖析"), "Markdown 报告应包含战例借鉴章节");
  assert.ok(md.includes("马岛海战飞鱼导弹低空掠海突击"), "Markdown 报告应包含战例名称");
  assert.ok(md.includes("可借鉴机制"), "Markdown 报告应包含可借鉴机制");
  assert.ok(md.includes("时代局限与不适用点"), "Markdown 报告应包含时代局限");

  // XML 报告校验
  const xml = buildXmlReport(mockPayload);
  assert.ok(xml.includes("<tacticalCases>"), "XML 报告应包含 <tacticalCases> 节点");
  assert.ok(xml.includes("<applicableLessons>"), "XML 报告应包含 <applicableLessons> 节点");
  assert.ok(xml.includes("<unapplicableLessons>"), "XML 报告应包含 <unapplicableLessons> 节点");
  console.log("✔ 检查项 7: 战法说明书 Markdown 与结构化 XML 报告导出正确");
}

// 8. 前端视图渲染与核心要素存在性
{
  const state = {
    activeView: "ov5",
    ov5ViewMode: "argument-chain",
    brief: { objective: "防空压制", approach: "无人协同" },
    ov5: {
      activities: [{ id: "act-1", title: "雷达诱导开机", type: "action" }],
      edges: [],
      argumentChain: {
        claim: "通过诱导开机破击防空体系",
        reasoning: "协同反辐射攻击",
        evidenceRefs: [],
        assumptions: []
      }
    },
    tacticalCases: [PRESET_TACTICAL_CASES[1]]
  };

  const html = renderOv5Workbench(state);
  assert.ok(html.includes("tactical-cases-panel"), "必须渲染战例借鉴主面板");
  assert.ok(html.includes("tactical-case-card"), "必须渲染战例卡片");
  assert.ok(html.includes("贝卡谷地防空压制作战"), "必须包含战例名称");
  assert.ok(html.includes("机制可借鉴点"), "必须包含可借鉴点标签");
  assert.ok(html.includes("时代局限与不适用点"), "必须包含时代局限标签");
  assert.ok(html.includes("apply-case-to-argument-chain"), "必须包含引用至论证链动作按键");

  console.log("✔ 检查项 8: 前端 OV-5 论证链视口战例借鉴面板渲染与交互组件验证通过");
}

console.log("🎉 M7-T7.3 战法设计线：战例借鉴所有测试 100% 通过！");
