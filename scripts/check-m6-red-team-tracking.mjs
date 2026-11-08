import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  applyRedTeamReview,
  createLocalRedTeamReview,
  updateFindingDisposition,
  updateFindingTargetElement
} from "../design-studio/src/redTeamStore.js";
import { buildExportArtifactFromPayload, buildReportPayload } from "../design-studio/src/reportBuilder.js";

console.log("=== 1. redTeamStore 意见处置状态与要素关联测试 ===");
{
  const mockValidation = {
    id: "val-1",
    scores: [],
    issues: [
      { id: "iss-1", title: "突防链路缺少备用信道", level: "high", text: "建议补充卫星与微波备用链路", sourceId: "rule-comms-1" }
    ],
    redTeamReview: null
  };

  // 1.1 生成带要素关联的初始审阅
  createLocalRedTeamReview(mockValidation, [{ title: "多域协同通信规范" }]);
  applyRedTeamReview(mockValidation, createLocalRedTeamReview(mockValidation, [{ title: "多域协同通信规范" }]));

  const review = mockValidation.redTeamReview;
  assert.ok(review, "应成功生成红方审阅");
  assert.equal(review.findings.length, 1);
  const firstFinding = review.findings[0];
  assert.equal(firstFinding.status, "pending", "初始状态应为 pending");
  assert.ok(firstFinding.targetElement?.name, "应自动关联目标作战要素");
  assert.equal(firstFinding.targetElement.type, "rule");

  // 1.2 标记为已接受
  updateFindingDisposition(mockValidation, firstFinding.id, { status: "accepted" });
  assert.equal(firstFinding.status, "accepted");
  assert.ok(firstFinding.disposedAt);

  // 1.3 标记为已修订
  updateFindingDisposition(mockValidation, firstFinding.id, { status: "revised" });
  assert.equal(firstFinding.status, "revised");

  // 1.4 驳回必须填写理由防御
  assert.throws(
    () => updateFindingDisposition(mockValidation, firstFinding.id, { status: "rejected", rejectionRationale: "" }),
    /驳回红方意见时必须填写驳回理由/
  );

  // 1.5 驳回带理由
  updateFindingDisposition(mockValidation, firstFinding.id, {
    status: "rejected",
    rejectionRationale: "经推演验证，强电磁环境下跳频扩频抗干扰已足够，无需额外卫星信道。"
  });
  assert.equal(firstFinding.status, "rejected");
  assert.match(firstFinding.rejectionRationale, /经推演验证/);

  // 1.6 要素手动关联调整
  updateFindingTargetElement(mockValidation, firstFinding.id, {
    type: "activity",
    id: "act-anti-jam",
    name: "协同抗电磁干扰突防活动"
  });
  assert.equal(firstFinding.targetElement.id, "act-anti-jam");
  assert.equal(firstFinding.targetElement.name, "协同抗电磁干扰突防活动");

  console.log("✓ redTeamStore 状态流转、驳回理由防御与要素关联测试通过");
}

console.log("=== 2. reportBuilder 报告中红方意见追踪与闭环率导出测试 ===");
{
  const mockPayload = buildReportPayload({
    project: {
      title: "红方意见闭环测试",
      brief: { objective: "协同压制", approach: "机动突破", assumptions: "假设", risk: "风险" },
      citations: []
    },
    direction: "方向",
    ov1: { nodes: [], edges: [] },
    ov5: { activities: [], edges: [] },
    ooda: { sourceActivityIds: [], lanes: [] },
    scenario: null,
    validationResult: {
      scores: [],
      issues: [],
      redTeamReview: {
        mode: "ai",
        provider: "openai",
        model: "gpt-4o",
        generatedAt: "2026-11-08T12:00:00.000Z",
        summary: "红方质询已完成全面博弈审阅。",
        findings: [
          {
            id: "f-1",
            title: "预警盲区易遭突防",
            severity: "high",
            analysis: "预警雷达重叠区存在俯仰角死区。",
            recommendation: "增派机载预警补充补盲阵位。",
            evidenceRefs: ["雷达部署规范"],
            targetElement: { type: "activity", id: "act-radar", name: "雷达对空侦察活动" },
            status: "revised",
            rejectionRationale: ""
          },
          {
            id: "f-2",
            title: "杀伤链决策延时过长",
            severity: "medium",
            analysis: "多级指令审批链延长了打击窗口。",
            recommendation: "前推交火授权至协同终端。",
            evidenceRefs: [],
            targetElement: { type: "phase", id: "ph-strike", name: "联合火力打击阶段" },
            status: "rejected",
            rejectionRationale: "根据交战规则第二条，防空火力禁止前推未授权自主交火。"
          }
        ]
      }
    },
    knowledge: null,
    deployment: { settings: {}, status: "not-configured" }
  });

  const mdContent = buildExportArtifactFromPayload("markdown", mockPayload).content;
  assert.match(mdContent, /意见闭环率：100%/);
  assert.match(mdContent, /已修订 1、已接受 0、已驳回 1/);
  assert.match(mdContent, /【已修订】预警盲区易遭突防/);
  assert.match(mdContent, /关联要素：雷达对空侦察活动/);
  assert.match(mdContent, /【已驳回】杀伤链决策延时过长/);
  assert.match(mdContent, /驳回理由：根据交战规则第二条/);

  const xmlContent = buildExportArtifactFromPayload("xml", mockPayload).content;
  assert.match(xmlContent, /<finding severity="high" status="revised" targetType="activity" targetName="雷达对空侦察活动">/);
  assert.match(xmlContent, /<rejectionRationale>根据交战规则第二条/);

  console.log("✓ 成果报告 (Markdown/XML) 中红方处置追踪与闭环率导出测试通过");
}

console.log("=== 3. 前端视图与控制器交互静态契约核验 ===");
{
  const [validationViewJs, controllerJs, mainJs] = await Promise.all([
    readFile(new URL("../design-studio/src/validationView.js", import.meta.url), "utf8"),
    readFile(new URL("../design-studio/src/redTeamController.js", import.meta.url), "utf8"),
    readFile(new URL("../design-studio/src/main.js", import.meta.url), "utf8")
  ]);

  assert.match(validationViewJs, /red-team-tracking-summary/);
  assert.match(validationViewJs, /审阅处置闭环率/);
  assert.match(validationViewJs, /data-action="accept-red-team-finding"/);
  assert.match(validationViewJs, /data-action="revise-red-team-finding"/);
  assert.match(validationViewJs, /data-action="reject-red-team-finding"/);
  assert.match(validationViewJs, /data-action="reset-red-team-finding"/);
  assert.match(validationViewJs, /finding-rejection-box/);
  assert.match(validationViewJs, /🎯 关联要素/);

  assert.match(controllerJs, /action === "accept-red-team-finding"/);
  assert.match(controllerJs, /action === "revise-red-team-finding"/);
  assert.match(controllerJs, /action === "reject-red-team-finding"/);
  assert.match(controllerJs, /updateFindingDisposition/);

  assert.match(mainJs, /redTeamController\.handleAction\(action, source\)/);

  console.log("✓ 前端视图与控制器静态契约全部通过");
}

console.log("\n==============================================");
console.log("All M6-T6.2 Red Team Tracking Checks PASSED!");
console.log("==============================================");
