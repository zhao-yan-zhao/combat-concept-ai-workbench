/**
 * End-to-End Verification for Complete Mainline Synthesis (Step 01 through Step 06 & Deliver)
 * Verifies that the restructured Step 05 (Overall Concept) and Step 06 (Simulation & Validation)
 * seamlessly connect with upstream planning and downstream reporting.
 *
 * Run: node scripts/check-mainline-end-to-end-synthesis.mjs
 */

import { renderOv1 } from "../design-studio/src/ov1View.js";
import { renderScenario } from "../design-studio/src/scenarioView.js";
import { extractOv1FromOv5 } from "../design-studio/src/ov1DraftStore.js";
import { normalizeOv1Model } from "../design-studio/src/ov1Store.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    throw new Error(message);
  }
}

console.log("Starting Mainline End-to-End Synthesis Verification...");

// 1. 模拟上游 Step 01～04 数据
const brief = {
  researchIntent: "构建无人蜂群与有人战机协同反舰作战概念",
  objective: "建立海空跨域分布式敏捷破击与广域持续封控能力",
  approach: "多源侦察感知牵引，协同分布式杀伤网与电子压制",
  assumptions: "复杂电磁对抗环境，关键节点具备战术自组织能力",
  expectedEffects: "48小时内瘫痪敌关键作战节点并建立防空反舰优势",
  risk: "假想敌强电磁反制造成通信时延与目标识别歧义"
};

const phaseAction = {
  status: "confirmed",
  phases: [
    { id: "p1", name: "态势感知与布势", timeWindow: "T+00 ~ T+12" },
    { id: "p2", name: "体系压制与突击", timeWindow: "T+12 ~ T+36" },
    { id: "p3", name: "效果评估与稳控", timeWindow: "T+36 ~ T+48" }
  ]
};

const forceMission = {
  status: "confirmed",
  tasks: [
    { id: "t1", name: "广域水面侦察搜索", side: "friendly", missionType: "侦察监视" },
    { id: "t2", name: "防区外协同突击", side: "friendly", missionType: "火力突击" }
  ],
  forces: [
    { id: "f1", name: "无人侦察预警机", role: "sensor", side: "friendly" },
    { id: "f2", name: "联合指挥舰", role: "command", side: "friendly" },
    { id: "f3", name: "巡航蜂群突击群", role: "action", side: "friendly" },
    { id: "f4", name: "敌水面防空编队", role: "opponent", side: "hostile" }
  ]
};

const ov5 = {
  activities: [
    { id: "act-1", type: "感知", title: "分布式无人侦察探测", input: "任务区域", output: "态势目标包" },
    { id: "act-2", type: "决策", title: "协同任务动态授权", input: "态势目标包", output: "交战授权指令" },
    { id: "act-3", type: "控制", title: "多域饱和突防打击", input: "交战授权指令", output: "毁伤成效" },
    { id: "act-4", type: "评估", title: "实时战损效果评估", input: "毁伤成效", output: "闭环反馈报告" }
  ],
  edges: [
    { id: "e1", sourceId: "act-1", targetId: "act-2", type: "信息流" },
    { id: "e2", sourceId: "act-2", targetId: "act-3", type: "控制流" },
    { id: "e3", sourceId: "act-3", targetId: "act-4", type: "控制流" },
    { id: "e4", sourceId: "act-4", targetId: "act-2", type: "反馈" }
  ]
};

// 2. 自底向上由活动网提炼生成 Step 05 总体概念图 (OV-1a)
const extractedOv1 = extractOv1FromOv5(ov5, { brief, forceMission });
assert(extractedOv1.nodes.length >= 4, "Should extract core overall concept nodes from OV-5");
const ov1 = normalizeOv1Model(extractedOv1);

// 3. 渲染 Step 05 工作台并验证三视图
const ov1State = {
  activeView: "ov1",
  ov1ViewMode: "graph",
  brief,
  phaseAction,
  forceMission,
  ov5,
  ov1,
  conceptMap: { document: { items: [{ id: "item-1" }] }, draft: { plan: { forceCount: 4 } } }
};

const ov1Html = renderOv1(ov1State);
assert(ov1Html.includes("总体概念 (高层协同与空间态势)"), "Step 05 header must render unified title");
assert(ov1Html.includes("高层协同图 (OV-1a)") && ov1Html.includes("空间态势图 (概念图)") && ov1Html.includes("体系概念大纲"), "Step 05 must provide 3 view pills");
assert(ov1Html.includes("前往仿真推演 (Step 06)"), "Step 05 must provide direct jump to Step 06");

// 4. 模拟进入 Step 06 仿真推演与验证工作台
const scenario = {
  version: 1,
  generatedAt: new Date().toISOString(),
  summary: "联合封控推演想定",
  areas: [{ id: "a1", label: "突击走廊", type: "patrol", position: [50, 50], size: 100 }],
  entities: [
    { id: "u1", label: "无人预警机", role: "sensor", side: "friendly", position: [20, 20], className: "" },
    { id: "u2", label: "突击蜂群", role: "action", side: "friendly", position: [40, 40], className: "" }
  ],
  timeline: [
    { time: "T+00", phase: "态势感知与布势", title: "布势侦察", description: "建立感知走廊" },
    { time: "T+20", phase: "体系压制与突击", title: "蜂群突防", description: "对敌实施防区外打击" }
  ],
  deploymentPlan: null
};

const validationResult = {
  scores: [{ label: "活动连通性", score: 95 }, { label: "信息闭环率", score: 90 }],
  issues: [
    { id: "i1", level: "high", title: "活动机理协同接口数据包未定义", text: "侦察探测活动输出需格式化为通用战术报文。" }
  ],
  redTeamReview: {
    findings: [
      { severity: "high", title: "电磁压制阶段时窗不足", analysis: "阶段时序需要向后展宽10分钟以掩护突击。", recommendation: "回改阶段行动" }
    ]
  }
};

const scenarioState = {
  ...ov1State,
  activeView: "scenario",
  scenarioViewMode: "workbench",
  scenario,
  validationResult
};

const scenarioHtml = renderScenario(scenarioState);
assert(scenarioHtml.includes("仿真推演与效能验证"), "Step 06 header must render integrated title");
assert(scenarioHtml.includes("🛡️ 一体化推演舱") && scenarioHtml.includes("📊 效能评估与红方质询") && scenarioHtml.includes("🗺️ 空间部署与时序"), "Step 06 must provide tri-mode view pills");
assert(scenarioHtml.includes("✏️ 回改活动机理 (OV-5)"), "Must support closed-loop feedback jump to Step 04");
assert(scenarioHtml.includes("✏️ 回改阶段行动 (Step 02)"), "Must support closed-loop feedback jump to Step 02");
assert(scenarioHtml.includes("前往成果报告 (Deliver)"), "Step 06 must provide forward jump to Deliver stage");

console.log("Mainline End-to-End Synthesis Verification: ALL CHECKS PASSED!");
