import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  REVIEW_STATUSES,
  REVIEW_STATUS_META,
  canPerformReviewTransition,
  isProjectFinalized,
  buildRevisedProjectPayload
} from "../design-studio/src/reviewWorkflowStore.js";
import {
  renderReviewWorkflowBar,
  renderFinalizedReadonlyDialog
} from "../design-studio/src/reviewWorkflowView.js";

console.log("--- 运行 M7-T7.10 评审与签批流程专项测试 ---");

// 1. 状态机流转与权限控制断言
{
  assert.equal(REVIEW_STATUSES.DRAFT, "draft");
  assert.equal(REVIEW_STATUSES.SUBMITTED, "submitted");
  assert.equal(REVIEW_STATUSES.REVISING, "revising");
  assert.equal(REVIEW_STATUSES.FINALIZED, "finalized");

  // 草稿态可送审，不可签批或退回修改
  assert.equal(canPerformReviewTransition("draft", "submit", ["researcher"]), true);
  assert.equal(canPerformReviewTransition("draft", "finalize", ["lead"]), false);
  assert.equal(canPerformReviewTransition("draft", "request_changes", ["reviewer"]), false);

  // 送审态可由审阅人退回修改或签批定稿，不可重复送审
  assert.equal(canPerformReviewTransition("submitted", "submit", ["researcher"]), false);
  assert.equal(canPerformReviewTransition("submitted", "request_changes", ["reviewer"]), true);
  assert.equal(canPerformReviewTransition("submitted", "finalize", ["reviewer"]), true);
  assert.equal(canPerformReviewTransition("submitted", "finalize", ["lead"]), true);

  // 需修改态可重新送审
  assert.equal(canPerformReviewTransition("revising", "submit", ["researcher"]), true);
  assert.equal(canPerformReviewTransition("revising", "finalize", ["reviewer"]), false);

  // 定稿态只读，不可再流转
  assert.equal(canPerformReviewTransition("finalized", "submit", ["lead"]), false);
  assert.equal(canPerformReviewTransition("finalized", "finalize", ["lead"]), false);

  assert.equal(isProjectFinalized({ reviewStatus: "finalized" }), true);
  assert.equal(isProjectFinalized({ reviewStatus: "draft" }), false);
  assert.equal(isProjectFinalized(null), false);
  console.log("✔ 检查项 1: 评审与签批状态机流转规则与角色权限矩阵断言正确");
}

// 2. 派生新修订分支契约断言 (纯深拷贝解耦与状态重置)
{
  const mockProject = {
    id: "saturation-strike-2026",
    title: "多域协同饱和穿透作战方案",
    kind: "tactic",
    classification: "内部",
    reviewStatus: "finalized",
    approval: { reviewer: "张参谋", decidedAt: "2026-11-09T08:00:00Z", note: "方案合格" }
  };

  const mockWorkbenchState = {
    brief: { objective: "压制敌防空核心阵地", approach: "低空超音速突防" },
    ov5: { activities: [{ id: "act-1", title: "前哨压制" }] },
    scenario: { turns: [1, 2] }
  };

  const revisedPayload = buildRevisedProjectPayload(mockProject, mockWorkbenchState);

  assert.ok(revisedPayload.id.startsWith("saturation-strike-2026-rev"));
  assert.ok(revisedPayload.title.includes("多域协同饱和穿透作战方案 (修订版"));
  assert.equal(revisedPayload.reviewStatus, "draft", "派生的修订分支必须重置为草稿状态");
  assert.equal(revisedPayload.approval, null, "修订分支必须清空签批信息");
  assert.deepEqual(revisedPayload.record.brief, mockWorkbenchState.brief);
  assert.deepEqual(revisedPayload.record.ov5, mockWorkbenchState.ov5);

  // 深度解耦验证
  revisedPayload.record.brief.objective = "篡改测试";
  assert.notEqual(mockWorkbenchState.brief.objective, "篡改测试", "派生分支对象修改不得污染源数据");

  console.log("✔ 检查项 2: 基于定稿方案派生新修订分支纯深拷贝与状态重置契约正确");
}

// 3. 前端工作流状态横幅与只读守卫弹窗渲染断言
{
  // 草稿态
  const draftHtml = renderReviewWorkflowBar({ id: "p1", reviewStatus: "draft" }, { session: { actor: { roles: ["researcher"] } } });
  assert.ok(draftHtml.includes("草稿"));
  assert.ok(draftHtml.includes('data-action="workflow-submit-review"'), "草稿态必须提供送审按钮");
  assert.equal(draftHtml.includes('data-action="workflow-finalize-approval"'), false);

  // 送审态
  const submittedHtml = renderReviewWorkflowBar({ id: "p1", reviewStatus: "submitted" }, { session: { actor: { roles: ["reviewer"] } } });
  assert.ok(submittedHtml.includes("送审中"));
  assert.ok(submittedHtml.includes("已提交送审并冻结当前模型基线快照"));
  assert.ok(submittedHtml.includes('data-action="workflow-request-changes"'), "送审态审阅人员必须可见退回修改按钮");
  assert.ok(submittedHtml.includes('data-action="workflow-finalize-approval"'), "送审态审阅人员必须可见签批定稿按钮");

  // 需修改态
  const revisingHtml = renderReviewWorkflowBar({
    id: "p1",
    reviewStatus: "revising",
    approval: { reviewer: "李主管", decidedAt: "2026-11-09T08:30:00Z", note: "请补充电磁诱骗链条" }
  }, { session: { actor: { roles: ["researcher"] } } });
  assert.ok(revisingHtml.includes("需修改"));
  assert.ok(revisingHtml.includes("李主管"));
  assert.ok(revisingHtml.includes("请补充电磁诱骗链条"));
  assert.ok(revisingHtml.includes('data-action="workflow-submit-review"'));

  // 定稿态
  const finalizedHtml = renderReviewWorkflowBar({
    id: "p1",
    reviewStatus: "finalized",
    approval: { reviewer: "王主任", decidedAt: "2026-11-09T09:00:00Z", note: "同意定稿" }
  }, { session: { actor: { roles: ["lead"] } } });
  assert.ok(finalizedHtml.includes("已定稿"));
  assert.ok(finalizedHtml.includes("已开启只读保护"));
  assert.ok(finalizedHtml.includes('data-action="workflow-fork-revision"'), "定稿态必须提供派生新修订分支按钮");

  // 只读模态框
  const dialogHtml = renderFinalizedReadonlyDialog({ title: "高超声速战法研究" });
  assert.ok(dialogHtml.includes("方案已签批定稿（只读保护）"));
  assert.ok(dialogHtml.includes("高超声速战法研究"));
  assert.ok(dialogHtml.includes('data-action="workflow-fork-revision"'));
  console.log("✔ 检查项 3: 前端评审签批状态横幅与只读守卫弹窗渲染契约正确");
}

// 4. 服务端元数据存取与数据库持久化兼容断言
{
  const repoSource = fs.readFileSync(path.join(process.cwd(), "server/projectRepository.mjs"), "utf8");
  assert.ok(repoSource.includes("review_status"), "projectRepository 必须包含 review_status 列");
  assert.ok(repoSource.includes("approval_json"), "projectRepository 必须包含 approval_json 列");
  assert.ok(repoSource.includes("VALID_REVIEW_STATUSES"), "projectRepository 必须声明合法评审状态白名单");

  const routeSource = fs.readFileSync(path.join(process.cwd(), "server/routes/projectResources.mjs"), "utf8");
  assert.ok(routeSource.includes("finalized"), "路由必须对 finalized 动作进行身份与角色门禁校验");
  console.log("✔ 检查项 4: 服务端 SQLite 仓储与路由元数据处理契约正确");
}

// 5. 前端主调度与送审自动冻结快照断言
{
  const mainSource = fs.readFileSync(path.join(process.cwd(), "design-studio/src/main.js"), "utf8");
  assert.ok(mainSource.includes('action === "workflow-submit-review"'), "main.js 必须监听 workflow-submit-review");
  assert.ok(mainSource.includes('action === "workflow-request-changes"'), "main.js 必须监听 workflow-request-changes");
  assert.ok(mainSource.includes('action === "workflow-finalize-approval"'), "main.js 必须监听 workflow-finalize-approval");
  assert.ok(mainSource.includes('action === "workflow-fork-revision"'), "main.js 必须监听 workflow-fork-revision");
  assert.ok(mainSource.includes("saveModelSnapshot"), "送审时必须调用 saveModelSnapshot 冻结基线快照");
  assert.ok(mainSource.includes("isProjectFinalized"), "主模型修改必须检查 isProjectFinalized 并进行只读保护");

  const shellSource = fs.readFileSync(path.join(process.cwd(), "design-studio/src/app/shellRenderer.js"), "utf8");
  assert.ok(shellSource.includes("renderReviewWorkflowBar"), "shellRenderer 必须挂载 renderReviewWorkflowBar");
  assert.ok(shellSource.includes("renderFinalizedReadonlyDialog"), "shellRenderer 必须挂载 renderFinalizedReadonlyDialog");
  console.log("✔ 检查项 5: 前端调度、视图渲染与送审自动冻结快照契约完整");
}

console.log("--- M7-T7.10 评审与签批流程专项测试全部 PASS ---");
