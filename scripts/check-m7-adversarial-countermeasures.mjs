import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isCountermeasureClosed,
  calculateCountermeasureClosure,
  updateFindingCountermeasure,
  createLocalRedTeamReview,
  applyRedTeamReview
} from "../design-studio/src/redTeamStore.js";
import { generateValidation } from "../design-studio/src/validationStore.js";
import { applyIssueRepair } from "../design-studio/src/consistencyLocatorStore.js";
import { buildReportPayload, buildMarkdownReport, buildXmlReport } from "../design-studio/src/reportBuilder.js";

console.log("--- 运行 M7-T7.2 对抗循环（反制 → 应对）专项测试 ---");

// 1. 数据模型与闭环状态判定
{
  const openFinding = {
    id: "f-1",
    countermeasure: "对手利用大功率机载雷达压制我方前出无人机链路",
    responseMode: "none",
    ourResponse: "",
    acceptedRiskRationale: ""
  };
  assert.equal(isCountermeasureClosed(openFinding), false, "初始状态未闭合");

  // 选择实施应对但未填写内容
  openFinding.responseMode = "counteract";
  openFinding.ourResponse = "   ";
  assert.equal(isCountermeasureClosed(openFinding), false, "应对内容为空时未闭合");

  // 填写有效应对
  openFinding.ourResponse = "前出无人机启动捷变跳频，并经由低轨卫星通信链路引接回传";
  assert.equal(isCountermeasureClosed(openFinding), true, "填写应对举措后应判定为闭环");

  // 选择接受风险但未填写理由
  const riskFinding = {
    id: "f-2",
    countermeasure: "对手潜艇水下静默设伏",
    responseMode: "accept-risk",
    acceptedRiskRationale: ""
  };
  assert.equal(isCountermeasureClosed(riskFinding), false, "接受风险但无理由未闭合");

  riskFinding.acceptedRiskRationale = "本战法实施海域水深不足50米，不具备大型常规潜艇机动设伏水文条件，残余风险可控";
  assert.equal(isCountermeasureClosed(riskFinding), true, "填写接受风险理由后判定为闭环");

  console.log("✔ 检查项 1: 对抗循环闭环状态判定逻辑正确");
}

// 2. 闭环统计与未闭合数量计算
{
  const mockReview = {
    findings: [
      { id: "f-1", responseMode: "counteract", ourResponse: "应对举措A" },
      { id: "f-2", responseMode: "none", ourResponse: "" },
      { id: "f-3", responseMode: "accept-risk", acceptedRiskRationale: "风险可控理由B" }
    ]
  };

  const stats = calculateCountermeasureClosure(mockReview);
  assert.equal(stats.total, 3);
  assert.equal(stats.closed, 2);
  assert.equal(stats.unclosed, 1);
  assert.equal(stats.closureRate, 67);
  assert.equal(stats.unclosedFindings.length, 1);
  assert.equal(stats.unclosedFindings[0].id, "f-2");

  console.log("✔ 检查项 2: 对抗闭环指标与未闭合清单统计正确");
}

// 3. 对抗更新与持久化
{
  const mockValidation = {
    redTeamReview: {
      findings: [
        { id: "f-test", title: "通信易受干扰", countermeasure: "大功率压制", responseMode: "none", ourResponse: "" }
      ]
    }
  };

  updateFindingCountermeasure(mockValidation, "f-test", {
    responseMode: "counteract",
    ourResponse: "启用多信道空分复用"
  });

  const updated = mockValidation.redTeamReview.findings[0];
  assert.equal(updated.responseMode, "counteract");
  assert.equal(updated.ourResponse, "启用多信道空分复用");
  assert.equal(isCountermeasureClosed(updated), true);

  console.log("✔ 检查项 3: updateFindingCountermeasure 更新成功");
}

// 4. 验证规则自动检视未闭合反制并产生 Issue
{
  const mockReviewWithUnclosed = {
    findings: [
      { id: "f-danger", title: "中继节点遭受防空压制", severity: "high", countermeasure: "远程地空导弹拦截", responseMode: "none", ourResponse: "" }
    ]
  };

  const validation = generateValidation(
    { activities: [{ id: "act-1", title: "初始活动", input: "a", output: "b" }], edges: [] },
    { lanes: [] },
    { entities: [] },
    { nodes: [], edges: [] },
    { redTeamReview: mockReviewWithUnclosed }
  );

  const issue = validation.issues.find((i) => i.title.includes("对手反制未完成应对"));
  assert.ok(issue, "应检出未完成应对的 Issue");
  assert.equal(issue.level, "high", "高危反制应产生 high 级别 issue");
  assert.equal(validation.countermeasureClosure.unclosed, 1);
  console.log("✔ 检查项 4: 验证规则检视未闭合对抗反制成功");

  // 5. 自动修复闭环应用
  const mockState = {
    validationResult: {
      redTeamReview: mockReviewWithUnclosed
    }
  };

  const repairResult = applyIssueRepair(mockState, issue);
  assert.equal(repairResult.modifiedDomain, "validation");
  assert.ok(isCountermeasureClosed(mockState.validationResult.redTeamReview.findings[0]), "一键修复后反制应达到闭环状态");
  console.log("✔ 检查项 5: 一键自动修复对手反制成功");
}

// 6. 报告导出生成“风险与反制”章节 (Markdown & XML)
{
  const testPayload = buildReportPayload({
    project: { title: "远海防空压制概念" },
    brief: { objective: "突破要域", approach: "诱敌突击", assumptions: "基础假设" },
    ov1: { nodes: [], edges: [] },
    ov5: { activities: [{ id: "act-1", title: "突击", input: "a", output: "b" }], edges: [] },
    ooda: { lanes: [] },
    scenario: { entities: [] },
    knowledge: { summary: { name: "知识库", fileCount: 1 } },
    reportTemplate: { id: "tactic-doc" },
    validationResult: {
      scores: [{ label: "规则评分", score: 90 }],
      issues: [],
      redTeamReview: {
        mode: "ai",
        provider: "local-rules",
        generatedAt: new Date().toISOString(),
        summary: "红方质询已完成",
        findings: [
          {
            id: "red-01",
            title: "通信截断风险",
            severity: "high",
            analysis: "对手实施宽带电子压制",
            recommendation: "采用备用信道",
            evidenceRefs: ["规则A"],
            countermeasure: "对手伴随使用相控阵雷达协同压制",
            responseMode: "counteract",
            ourResponse: "我方采用跳频战术数据链并拉开空间基线",
            acceptedRiskRationale: ""
          }
        ]
      }
    }
  });

  const md = buildMarkdownReport(testPayload);
  assert.ok(md.includes("### 对抗循环：风险与反制对照总表"), "Markdown 应包含对抗循环对照总表");
  assert.ok(md.includes("对手伴随使用相控阵雷达协同压制"), "Markdown 表格应包含对手反制描述");
  assert.ok(md.includes("[应对] 我方采用跳频战术数据链并拉开空间基线"), "Markdown 表格应包含我方应对");
  assert.ok(md.includes("已闭环"), "Markdown 表格应标注闭环状态");

  const xml = buildXmlReport(testPayload);
  assert.ok(xml.includes("<countermeasure>对手伴随使用相控阵雷达协同压制</countermeasure>"), "XML 应包含 countermeasure 节点");
  assert.ok(xml.includes("<responseMode>counteract</responseMode>"), "XML 应包含 responseMode 节点");
  assert.ok(xml.includes("<ourResponse>我方采用跳频战术数据链并拉开空间基线</ourResponse>"), "XML 应包含 ourResponse 节点");

  console.log("✔ 检查项 6: Markdown 与 XML 报告对抗反制结构化导出成功");
}

// 7. 前端视图与控制器静态契约测试
{
  const valViewContent = fs.readFileSync(path.resolve("design-studio/src/validationView.js"), "utf8");
  assert.ok(valViewContent.includes("finding-countermeasure-box"), "validationView 必须包含 finding-countermeasure-box");
  assert.ok(valViewContent.includes("set-countermeasure-mode"), "validationView 必须提供 set-countermeasure-mode");
  assert.ok(valViewContent.includes("save-countermeasure-response"), "validationView 必须提供 save-countermeasure-response");
  assert.ok(valViewContent.includes("save-countermeasure-risk"), "validationView 必须提供 save-countermeasure-risk");

  const redTeamCtrlContent = fs.readFileSync(path.resolve("design-studio/src/redTeamController.js"), "utf8");
  assert.ok(redTeamCtrlContent.includes("set-countermeasure-mode"), "redTeamController 必须处理 set-countermeasure-mode");
  assert.ok(redTeamCtrlContent.includes("save-countermeasure-response"), "redTeamController 必须处理 save-countermeasure-response");
  assert.ok(redTeamCtrlContent.includes("save-countermeasure-risk"), "redTeamController 必须处理 save-countermeasure-risk");

  console.log("✔ 检查项 7: 前端视图与控制器静态契约验证通过");
}

console.log("--- M7-T7.2 对抗循环（反制 → 应对）全部 7 项测试 100% 通过！ ---");
