import { createLocalOv1Draft } from "../design-studio/src/ov1DraftStore.js";
import { renderOv1 } from "../design-studio/src/ov1View.js";
import {
  buildConceptMapPlanFromPlanning,
  createInitialConceptMapDraft,
  normalizeConceptMap
} from "../design-studio/src/conceptMapStore.js";
import {
  RELATED_VIEWS,
  renderContextualModelFlow
} from "../design-studio/src/contextualModelFlow.js";
import { buildModelTopology } from "../shared/modelTopology.js";
import {
  getWorkflowStageIncompleteReasons,
  resolveCurrentStepQuickActions,
  isStepGenerated
} from "../design-studio/src/app/workflowGate.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log("Checking OV-1 -> Concept Map End-to-End Flow...");

// 1. Upstream Planning Mockup
const brief = {
  researchIntent: "深化分布式海上封控概念验证",
  objective: "建立海空跨域协同封控体系",
  approach: "分布式感知、敏捷指挥、精确制导打击与效果评估闭环",
  assumptions: "假定在第一岛链关键咽喉水道，依托海空基地与无人蜂群协同",
  expectedEffects: "压制敌水面突防企图，形成跨域联合防御闭环",
  risk: "强电磁干扰环境下通信中断与去中心化决策降级"
};

const phaseAction = {
  status: "confirmed",
  phases: [
    { id: "phase-recon", name: "远程广域侦搜", objective: "建立全域态势底图", timeWindow: "T0-T12" },
    { id: "phase-strike", name: "分布式联合封控", objective: "实施精确拦截与海空阻击", timeWindow: "T12-T36" }
  ],
  transitions: [
    { fromPhaseId: "phase-recon", toPhaseId: "phase-strike", triggerCondition: "确认敌核心编队航向" }
  ]
};

const operationalTasks = [
  {
    id: "task-patrol-1",
    name: "外围广域巡逻",
    side: "friendly",
    phaseId: "phase-recon",
    missionType: "patrol",
    objective: "保持咽喉外围连续侦搜覆盖",
    expectedEffect: "发现突防目标并生成先验航迹",
    area: {
      name: "外围海空巡逻走廊",
      type: "patrol",
      geometryType: "circle",
      radiusNm: 80,
      points: [{ latitude: 22.5, longitude: 121.8 }]
    }
  },
  {
    id: "task-strike-1",
    name: "反突防阻击打击",
    side: "friendly",
    phaseId: "phase-strike",
    missionType: "strike",
    objective: "对突防编队实施精确打击",
    expectedEffect: "瘫痪敌先锋突防舰艇",
    area: {
      name: "主要交战打击区",
      type: "prosecution",
      geometryType: "polygon",
      radiusNm: 50,
      points: [
        { latitude: 23.0, longitude: 122.5 },
        { latitude: 23.5, longitude: 123.0 },
        { latitude: 22.8, longitude: 123.2 }
      ]
    }
  }
];

const forceMission = {
  status: "confirmed",
  tasksConfirmedAt: new Date().toISOString(),
  tasks: operationalTasks,
  forces: [
    {
      id: "force-uav-1",
      name: "高空长航时预警无人机编组",
      side: "friendly",
      role: "sense",
      group: "态势感知群",
      task: "外围广域侦搜与雷达态势汇聚",
      slot: "northwest",
      phaseIds: ["phase-recon", "phase-strike"],
      platforms: [{ name: "神雕高空预警无人机", role: "sense", domain: "air" }]
    },
    {
      id: "force-cmd-1",
      name: "海空联合作战指挥所",
      side: "friendly",
      role: "command",
      group: "联合指挥群",
      task: "跨域态势融合与协同打击指控",
      slot: "center",
      phaseIds: ["phase-recon", "phase-strike"],
      platforms: [{ name: "指挥自动化方舱系统", role: "command", domain: "surface" }]
    },
    {
      id: "force-missile-1",
      name: "隐身无人反舰巡航机队",
      side: "friendly",
      role: "action",
      group: "精确打击群",
      task: "精确制导超饱和突防打击",
      slot: "southwest",
      phaseIds: ["phase-strike"],
      platforms: [{ name: "隐身攻击无人机", role: "action", domain: "air" }]
    },
    {
      id: "force-red-1",
      name: "敌突防水面战斗群",
      side: "hostile",
      role: "action",
      group: "假想对手",
      task: "海峡快速突破与电磁突袭",
      slot: "northeast",
      phaseIds: ["phase-recon", "phase-strike"],
      platforms: [{ name: "驱逐舰战斗编队", role: "action", domain: "surface" }]
    }
  ],
  relations: [
    { fromForceId: "force-uav-1", toForceId: "force-cmd-1", type: "information" },
    { fromForceId: "force-cmd-1", toForceId: "force-missile-1", type: "coordination" }
  ]
};

// 2. Test createLocalOv1Draft from Planning
const ov1Draft = createLocalOv1Draft({ brief, direction: "跨域封控", forceMission });
assert(ov1Draft.nodes.length >= 4, "OV-1 seeded draft must contain nodes compiled from concept forces");
assert(ov1Draft.edges.length >= 2, "OV-1 seeded draft must contain valid edges");
assert(ov1Draft.provenance?.mode === "local", "Seeded OV-1 must indicate local provenance");

// 3. Test renderOv1 UI & Toolbar
const stateWithOv1 = {
  brief,
  phaseAction,
  forceMission,
  ov1: ov1Draft,
  ov1Generating: false,
  ov1Candidate: null,
  ov1Storage: { stale: false },
  selection: null,
  ov5: { activities: [{ id: "act-1", title: "广域预警侦搜活动" }] },
  ooda: {
    lanes: [
      { id: "observe", title: "O", subtitle: "态势感知", color: "#38bdf8", nodes: [{ id: "o-1", title: "雷达波束搜索", text: "侦测", duration: "2" }] },
      { id: "orient", title: "O", subtitle: "判断定向", color: "#a78bfa", nodes: [] },
      { id: "decide", title: "D", subtitle: "决策意图", color: "#facc15", nodes: [] },
      { id: "act", title: "A", subtitle: "行动打击", color: "#f87171", nodes: [] }
    ]
  },
  activeView: "ov1",
  ov1ToolsOpen: false
};

const ov1Html = renderOv1(stateWithOv1);
assert(ov1Html.includes("ov1-toolbar"), "OV-1 must render the top workbench toolbar");
assert(ov1Html.includes("总体图 (OV-1a 高层作战概念图)"), "Toolbar must display the formal step title");
assert(ov1Html.includes('data-action="seed-ov1-from-planning"'), "Toolbar must include seed from planning button");
assert(ov1Html.includes('data-action="generate-ov1"'), "Toolbar must include AI generate button");
assert(ov1Html.includes('data-action="confirm-ov1"'), "Toolbar must include confirm button");
assert(ov1Html.includes("ov1-next-step"), "OV-1 must render bottom next-step bar even when activities exist");
assert(ov1Html.includes('data-action="advance-to-concept-map"'), "Next-step bar must include advance to concept-map");
assert(ov1Html.includes('data-view="ov5a"'), "Next-step bar must provide access to OV-5a activity decomposition");
assert(ov1Html.includes('data-view="ooda"'), "Next-step bar must provide access to OODA decision loop");

// 4. Test Concept Map Plan Compilation from OV-1 + Tasks + Forces
const conceptMapPlan = buildConceptMapPlanFromPlanning(stateWithOv1, null);
assert(conceptMapPlan.phases.length === 2, "Concept map plan must inherit phase-action phases");
assert(conceptMapPlan.forces.length >= 4, "Concept map plan must include concept forces");
assert(conceptMapPlan.areas.length >= 2, "Concept map plan must ingest operational task areas");
const patrolArea = conceptMapPlan.areas.find((a) => a.id.includes("task-patrol-1"));
assert(patrolArea && patrolArea.lat === 22.5 && patrolArea.lon === 121.8, "Patrol area must inherit exact WGS84 coordinates from task.area");
assert(patrolArea.radiusNm === 80, "Patrol area must preserve radius in nautical miles");
assert(conceptMapPlan.summary.includes("总体图构想"), "Concept map summary must incorporate OV-1 concept narrative");
assert(conceptMapPlan.summary.includes("任务空域与区域"), "Concept map summary must highlight real operational areas");

// 5. Test createInitialConceptMapDraft with Real Areas
const mapDraft = createInitialConceptMapDraft({ brief, plan: conceptMapPlan });
assert(mapDraft.document.items.some((item) => item.type === "symbol"), "Concept map document must contain force symbols");
const mapArea = mapDraft.document.items.find((item) => item.type === "area" && item.id.includes("task-patrol-1"));
assert(mapArea, "Concept map document must render operational task areas as area items");
assert(mapArea.lat === 22.5 && mapArea.lon === 121.8, "Map area item must use exact geographic latitude and longitude");
assert(mapArea.radius === 80 * 1852, "Map area item radius must convert nautical miles to meters");

// 6. Test Subflow Topology & Related Views
assert(RELATED_VIEWS.ov1.includes("ov5a") && RELATED_VIEWS.ov1.includes("ov5") && RELATED_VIEWS.ov1.includes("ooda"), "OV-1 related views must include OV-5a, OV-5, and OODA");
assert(RELATED_VIEWS["concept-map"].includes("ooda"), "Concept map related views must include OODA");

const topology = buildModelTopology(stateWithOv1);
const oodaNode = topology.nodes.find((n) => n.resource === "ooda");
assert(oodaNode && oodaNode.label.includes("OODA"), "Model topology must register OODA decision cycle product");

const ov1RailFlow = renderContextualModelFlow("ov1", stateWithOv1);
assert(ov1RailFlow.includes("作战活动分解 OV5a") && ov1RailFlow.includes("作战活动 OV5b") && ov1RailFlow.includes("研究循环 OODA"), "OV-1 left rail must expose complete subflow nodes including OODA");

// 7. Test Workflow Gates
assert(isStepGenerated("ov1", stateWithOv1), "OV-1 step must be recognized as generated");
const quickActions = resolveCurrentStepQuickActions(stateWithOv1);
assert(quickActions.some((a) => a.id === "confirm-ov1"), "Workflow gate must expose quick confirm action when on OV-1");

const reasonsStage4 = getWorkflowStageIncompleteReasons(stateWithOv1, 4);
assert(reasonsStage4.length === 0, "Stage 4 (OV-1) must be complete when nodes and edges are present");

console.log("OV-1 -> Concept Map End-to-End Flow verification passed successfully!");
