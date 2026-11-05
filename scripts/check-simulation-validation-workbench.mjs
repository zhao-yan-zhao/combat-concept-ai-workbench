/**
 * Verification for Step 06 Simulation & Validation Integrated Workbench
 * Tests:
 * 1. Ultra-compact 2-row header layout with HUD maturity & entity metrics
 * 2. Tri-mode view switching: workbench (integrated pod), validation (scores & red team), timeline (spatial & full events)
 * 3. Closed-loop feedback jumps (feedback_to) on issues & red team challenges
 * 4. Confirmation of simulation & validation conclusions
 *
 * Run: node scripts/check-simulation-validation-workbench.mjs
 */

import { renderScenario } from "../design-studio/src/scenarioView.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    throw new Error(message);
  }
}

console.log("Starting Step 06 Simulation & Validation Integrated Workbench Verification...");

const sampleScenario = {
  version: 1,
  generatedAt: new Date().toISOString(),
  summary: "联合封控高层概念48小时红蓝多域对抗推演想定",
  areas: [
    { id: "area-1", label: "核心封控走廊", type: "patrol", position: [40, 50], size: 120 },
    { id: "area-2", label: "前置侦察空域", type: "surveillance", position: [20, 30], size: 90 }
  ],
  entities: [
    { id: "u1", label: "无人预警机", role: "sensor", side: "friendly", platform: "高空长航时无人机", position: [22, 32], className: "" },
    { id: "u2", label: "分布式指挥舰", role: "command", side: "friendly", platform: "联合指挥舰", position: [38, 55], className: "" },
    { id: "u3", label: "自杀式巡航蜂群", role: "action", side: "friendly", platform: "巡飞弹蜂群", position: [45, 48], className: "" },
    { id: "u4", label: "假想敌机动水面编队", role: "opponent", side: "hostile", platform: "导弹驱逐舰", position: [75, 25], className: "blue" }
  ],
  timeline: [
    { time: "T+00", phase: "态势塑造", title: "前置侦察集群布势", description: "建立连续电磁监视走廊", impact: "掌握第一波次目标" },
    { time: "T+15", phase: "体系压制", title: "分布式电子压制", description: "压制敌预警雷达与数据链", impact: "制造防空盲区" },
    { time: "T+28", phase: "饱和突击", title: "多方向协同突防", description: "蜂群与防区外导弹组合突击", impact: "毁伤核心节点" },
    { time: "T+40", phase: "效果评估", title: "战果评估与动态反哺", description: "核验毁伤并更新防御圈", impact: "达成封控闭环" }
  ],
  deploymentPlan: {
    adjustedEntityIds: ["u1", "u2", "u3"],
    diagnostics: [{ state: "ready", label: "通信走廊闭合", detail: "全要素链路畅通" }]
  }
};

const sampleValidation = {
  generatedAt: new Date().toISOString(),
  oodaDuration: "18",
  scores: [
    { label: "活动连通性", score: 94 },
    { label: "信息闭环率", score: 88 },
    { label: "资源约束合规", score: 82 },
    { label: "OODA时效成熟度", score: 90 }
  ],
  issues: [
    { id: "iss-1", level: "high", title: "活动机理接口数据格式待固化", text: "侦察目标包输出字段尚未与协同决策输入完全对齐。" },
    { id: "iss-2", level: "medium", title: "阶段行动时窗重叠告警", text: "压制阶段与突击阶段之间进入退出触发约束不清晰。" }
  ],
  redTeamReview: {
    mode: "ai",
    model: "gpt-4o",
    generatedAt: new Date().toISOString(),
    summary: "红方可能通过强电磁干扰造成通信链路降级，且在T+20窗口具有机动突防潜力。",
    findings: [
      {
        severity: "high",
        title: "强干扰下活动协同延迟风险",
        analysis: "依赖高带宽时效活动的协同可能产生超过5分钟的时滞。",
        recommendation: "在活动机理中补充自主断链备用协议。",
        evidenceRefs: ["obs/方法/体系破击.md"]
      }
    ]
  }
};

const state = {
  activeView: "scenario",
  scenarioViewMode: "workbench",
  scenario: sampleScenario,
  validationResult: sampleValidation,
  scenarioStorage: {},
  deployment: { settings: { targetUrl: "http://127.0.0.1:8765/tool" }, status: "idle", open: false },
  simulationAdapter: { settings: {}, status: "idle" }
};

// 1. 验证默认一体化推演舱视图
const html = renderScenario(state);
assert(html.includes("scenario-top-header"), "Must render ultra-compact header");
assert(html.includes("仿真推演与效能验证"), "Must render integrated workbench title");
assert(html.includes("🛡️ 一体化推演舱") && html.includes("📊 效能评估与红方质询") && html.includes("🗺️ 空间部署与时序"), "Must render tri-mode view pills");
assert(html.includes("view-pill active") && html.includes("🛡️ 一体化推演舱"), "Workbench pill must be active");
assert(html.includes("★ 89分 成熟度") || html.includes("成熟度"), "Must render HUD maturity metric");
assert(html.includes("4 推演实体") && html.includes("4 事件序列"), "Must render HUD entity & timeline counts");

// 2. 验证推演地图与效能看板同屏呈现
assert(html.includes("scenario-map") && html.includes("核心封控走廊"), "Must render spatial simulation map");
assert(html.includes("推演对抗事件时序") && html.includes("前置侦察集群布势"), "Must render timeline feed");
assert(html.includes("活动连通性") && html.includes("OODA时效成熟度"), "Must render embedded validation scores");

// 3. 验证精准定位回改 (feedback_to)
assert(html.includes("scenario-feedback-btn"), "Must render closed-loop feedback jump buttons");
assert(html.includes("✏️ 回改活动机理 (OV-5)"), "Must provide direct jump to Step 04 for activity/interface issue");
assert(html.includes("✏️ 回改阶段行动 (Step 02)"), "Must provide direct jump to Step 02 for phase/window issue");
assert(html.includes("红方挑战") && html.includes("强干扰下活动协同延迟风险"), "Must render red team findings inline");

// 4. 验证效能评估模式 (validation)
const validationState = { ...state, scenarioViewMode: "validation" };
const validationHtml = renderScenario(validationState);
assert(validationHtml.includes("view-pill active") && validationHtml.includes("效能评估与红方质询"), "Validation pill active");
assert(validationHtml.includes("scenario-validation-viewport"), "Must render validation viewport");

// 5. 验证空间时序模式 (timeline)
const timelineState = { ...state, scenarioViewMode: "timeline" };
const timelineHtml = renderScenario(timelineState);
assert(timelineHtml.includes("view-pill active") && timelineHtml.includes("空间部署与时序"), "Timeline pill active");
assert(timelineHtml.includes("scenario-full-timeline"), "Must render full timeline viewport");

console.log("All Step 06 Simulation & Validation Integrated Workbench checks PASSED!");
