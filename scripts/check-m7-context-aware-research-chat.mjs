import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  extractActiveViewContext,
  renderContextAwareBadge,
  renderCandidateActionBox
} from "../design-studio/src/researchChat/contextAwareAssistant.js";
import { renderResearchChatPanel, renderResearchChatMessage } from "../design-studio/src/researchChat/researchChatView.js";

console.log("--- 运行 M7-T7.9 两条线共用：上下文感知 AI 研讨助手专项测试 ---");

// 模拟完整 workbench state
const mockState = {
  activeView: "ov5",
  project: { title: "多域协同饱和穿透作战概念" },
  brief: {
    objective: "达成对敌纵深防空核心节点的快速压制与走廊撕裂",
    approach: "以无人机前哨诱导雷达开机，配合多轴向防区外超低空突防",
    assumptions: "敌雷达具备先进跳频抗干扰能力\n中继通信链路维持毫秒级通联"
  },
  phaseAction: {
    phases: [
      { id: "p1", name: "远程隐蔽接敌" },
      { id: "p2", name: "多轴电磁佯动" },
      { id: "p3", name: "防区外饱和齐射" }
    ]
  },
  forceMission: {
    combatForces: [{ id: "f1", name: "前哨无人机大队" }, { id: "f2", name: "战术巡航突击编队" }],
    tasks: [{ id: "t1", name: "雷达诱导开机" }, { id: "t2", name: "硬反辐射打击" }]
  },
  ov5: {
    activities: [{ id: "act-1", title: "发射前哨诱饵" }, { id: "act-2", title: "反三角定位" }],
    argumentChain: {
      claim: "通过多域异构协同打破敌相控阵雷达跟踪通道容量上限",
      reasoning: "前哨诱饵逼迫雷达开机，主突波次在波束切换盲区实施交汇突击"
    }
  },
  scenario: {
    wargame: {
      turns: [
        {
          turnNumber: 1,
          phaseName: "远程隐蔽接敌",
          intents: { red: { text: "保持全无线电静默" }, blue: { text: "启动被动红外传感网" } },
          adjudication: { outcome: "双方维持战术隐蔽" }
        }
      ]
    }
  },
  knowledge: {
    results: [
      { id: "k1", title: "马岛海战低空突防战例" },
      { id: "k2", title: "现代防空相控阵通道饱和模型" }
    ]
  }
};

// 1. 上下文感知提取器契约断言
{
  // 步骤 04：OV-5 视图
  const ov5Context = extractActiveViewContext(mockState);
  assert.equal(ov5Context.viewId, "ov5");
  assert.equal(ov5Context.viewLabel, "04 制胜机理 (OV-5)");
  assert.ok(ov5Context.stepSummary.includes("打破敌相控阵雷达跟踪通道容量上限"));
  assert.ok(ov5Context.citationSnippet.includes("马岛海战低空突防战例"));
  assert.ok(ov5Context.promptContextBlock.includes("【当前研讨步骤上下文 (自动感知)】"));
  assert.ok(ov5Context.promptContextBlock.includes("绝对不可直接虚构已修改主模型"));

  // 切换到步骤 01：Brief 视图
  const briefContext = extractActiveViewContext({ ...mockState, activeView: "brief" });
  assert.equal(briefContext.viewId, "brief");
  assert.ok(briefContext.stepSummary.includes("达成对敌纵深防空核心节点的快速压制"));

  // 切换到步骤 02：Phase-Action 视图
  const phaseContext = extractActiveViewContext({ ...mockState, activeView: "phase-action" });
  assert.equal(phaseContext.viewId, "phase-action");
  assert.ok(phaseContext.stepSummary.includes("远程隐蔽接敌 ➔ 多轴电磁佯动 ➔ 防区外饱和齐射"));

  // 切换到步骤 03：Force-Mission 视图
  const forceContext = extractActiveViewContext({ ...mockState, activeView: "force-mission" });
  assert.equal(forceContext.viewId, "force-mission");
  assert.ok(forceContext.stepSummary.includes("编组参演力量 2 支"));

  // 切换到步骤 06：Scenario 视图
  const scenarioContext = extractActiveViewContext({ ...mockState, activeView: "scenario" });
  assert.equal(scenarioContext.viewId, "scenario");
  assert.ok(scenarioContext.stepSummary.includes("推演演进至第 1 回合"));
  console.log("✔ 检查项 1: 上下文感知提取器在各步骤视图下的模型要素与引用依据提取契约正确");
}

// 2. 视觉感知胶囊组件渲染契约
{
  const ov5Context = extractActiveViewContext(mockState);
  const badgeHtml = renderContextAwareBadge(ov5Context);
  assert.ok(badgeHtml.includes("🎯 正在研讨当前步骤:"));
  assert.ok(badgeHtml.includes("04 制胜机理 (OV-5)"));
  assert.ok(badgeHtml.includes("马岛海战低空突防战例"));
  console.log("✔ 检查项 2: 研讨面板上下文感知胶囊 HTML 渲染契约正确");
}

// 3. 事务安全建议候选框 (Candidate Action Box) 契约断言
{
  const mockCandidate = {
    id: "cand-001",
    title: "增设'诱骗性辐射源模拟'作战活动",
    summary: "建议在阶段二新增诱骗发射活动，以强化制胜机理中的雷达信噪比压制。",
    targetView: "04 制胜机理 (OV-5)",
    impactSummary: "将在 OV-5 活动模型新增 1 项活动要素并建立因果前置边",
    applied: false,
    dismissed: false
  };

  // 初始待审定态
  const candidateHtml = renderCandidateActionBox(mockCandidate, { scope: "ov5" });
  assert.ok(candidateHtml.includes("📋 研讨建议候选 (待人工审定)"));
  assert.ok(candidateHtml.includes("事务安全包装"));
  assert.ok(candidateHtml.includes("诱骗性辐射源模拟"));
  assert.ok(candidateHtml.includes('data-action="apply-research-candidate"'), "必须包含采纳并应用按钮");
  assert.ok(candidateHtml.includes('data-action="dismiss-research-candidate"'), "必须包含忽略按钮");

  // 已采纳态
  const appliedHtml = renderCandidateActionBox({ ...mockCandidate, applied: true });
  assert.ok(appliedHtml.includes("✓ 已采纳并事务应用"));
  assert.ok(appliedHtml.includes("已生效"));
  assert.equal(appliedHtml.includes('data-action="apply-research-candidate"'), false, "已采纳状态不应再提供应用按钮");

  // 已忽略态
  const dismissedHtml = renderCandidateActionBox({ ...mockCandidate, dismissed: true });
  assert.ok(dismissedHtml.includes("✕ 已忽略该建议提案"));
  console.log("✔ 检查项 3: 建议候选框待审定、已采纳与已忽略状态机渲染契约正确");
}

// 4. 研讨对话面板与消息流集成渲染
{
  const ov5Context = extractActiveViewContext(mockState);
  const mockSession = {
    messages: [
      {
        id: "msg-1",
        role: "user",
        text: "请评估当前制胜机理在敌相控阵雷达全开机情况下的因果链条是否稳固？",
        createdAt: new Date().toISOString()
      },
      {
        id: "msg-2",
        role: "assistant",
        text: "经分析当前活动拓扑，前哨诱饵与主突波次之间缺少专用抗反辐射中继接力。建议增设诱骗性辐射源模拟活动以提高通道饱和概率。",
        candidate: {
          id: "cand-002",
          title: "增设中继电磁压制活动",
          summary: "在 OV-5 中增加专用中继抗干扰活动",
          targetView: "ov5"
        },
        createdAt: new Date().toISOString()
      }
    ]
  };

  const panelHtml = renderResearchChatPanel({
    scope: "ov5",
    session: mockSession,
    context: ov5Context
  });

  assert.ok(panelHtml.includes("🎯 正在研讨当前步骤:"), "研讨面板必须渲染上下文感知胶囊");
  assert.ok(panelHtml.includes("增设中继电磁压制活动"), "助手消息下方必须渲染候选建议事务框");
  assert.ok(panelHtml.includes('data-action="apply-research-candidate"'));
  console.log("✔ 检查项 4: 研讨对话面板与消息流候选框挂载渲染集成完整");
}

// 5. 静态集成断言
{
  const mainSource = fs.readFileSync(path.join(process.cwd(), "design-studio/src/main.js"), "utf8");
  assert.ok(mainSource.includes('action === "apply-research-candidate"'), "main.js 必须处理 apply-research-candidate");
  assert.ok(mainSource.includes('action === "dismiss-research-candidate"'), "main.js 必须处理 dismiss-research-candidate");
  assert.ok(mainSource.includes("applyWithRecoveryPoint"), "采纳建议时必须走 applyWithRecoveryPoint 事务包装");

  const viewSource = fs.readFileSync(path.join(process.cwd(), "design-studio/src/researchChat/researchChatView.js"), "utf8");
  assert.ok(viewSource.includes("renderContextAwareBadge"), "researchChatView 必须接入 renderContextAwareBadge");
  assert.ok(viewSource.includes("renderCandidateActionBox"), "researchChatView 必须接入 renderCandidateActionBox");
  console.log("✔ 检查项 5: 前端调度、视图与 M1 事务包装器静态契约集成完整");
}

console.log("--- M7-T7.9 上下文感知 AI 研讨助手专项测试全部 PASS ---");
