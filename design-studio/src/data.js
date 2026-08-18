/** Display names for research products. Resource keys stay ov1/ov5… for standard data I/O. */
/**
 * Display names for research products.
 * Resource keys stay ov1/ov5… for standard data I/O.
 * Step roles and gates: plans/RESEARCH_WORKFLOW_18.md
 */
export const productLabels = Object.freeze({
  brief: "概念简报",
  "phase-action": "阶段与行动",
  "operational-task": "作战任务",
  "force-mission": "作战兵力",
  "concept-map": "概念图",
  ov1: "高层作战概念图",
  ov2: "作战资源流描述",
  ov3: "作战资源流矩阵",
  ov4: "作战组织关系图",
  ov5: "作战活动模型",
  ov5a: "作战活动分解树",
  ov6a: "规则库",
  ov6b: "状态机校验",
  ov6c: "时序校验",
  ooda: "研究辅助循环",
  "structure-review": "结构核对台",
  scenario: "自动想定",
  validate: "设计验证",
  collaboration: "协同审阅",
  report: "成果报告"
});

export const productShortLabels = Object.freeze({
  brief: "简报",
  "operational-task": "作战任务",
  "force-mission": "作战兵力",
  "phase-action": "阶段行动",
  "concept-map": "概念图",
  ov1: "总体图",
  ov5: "活动",
  ooda: "循环",
  "structure-review": "核对台",
  ov5a: "活动树",
  ov2: "资源流",
  ov3: "交换矩阵",
  ov4: "组织关系",
  ov6a: "规则库",
  ov6b: "状态机",
  ov6c: "时序",
  scenario: "想定",
  validate: "验证",
  collaboration: "协同",
  report: "报告"
});

/** Step role: write = 主写, check = 校验, deliver = 交付. */
export const workflowStepRoles = Object.freeze({
  brief: "write",
  // Phase chain: rule library → phase → bind/state/sequence → reverse check
  ov6a: "write",
  "phase-action": "write",
  ov6b: "check",
  ov6c: "check",
  "operational-task": "write",
  "force-mission": "write",
  ov4: "check",
  ov2: "check",
  ov3: "check",
  "concept-map": "write",
  ov1: "write",
  ov5: "write",
  ov5a: "check",
  ooda: "write",
  "structure-review": "check",
  scenario: "write",
  validate: "write",
  collaboration: "deliver",
  report: "deliver"
});

/**
 * Canonical order. Phase chain is fixed:
 * 规则库 → 阶段与行动 → 状态机/时序校验 → … → 结构反查
 */
export const workflowOrder = [
  "brief",
  "ov6a", "phase-action", "ov6b", "ov6c",
  "operational-task", "force-mission", "ov4", "ov2", "ov3",
  "concept-map", "ov1", "ov5", "ov5a", "ooda",
  "structure-review", "scenario", "validate", "collaboration", "report"
];

export const views = workflowOrder.map((id) => {
  const meta = {
    brief: { subtitle: "目标 · 边界 · 假设 · 效果", status: "done" },
    ov6a: { subtitle: "规则本体 · 词表（可先不绑活动）", status: "ready" },
    "phase-action": { subtitle: "阶段 · 行动 · 进入退出", status: "ready" },
    ov6b: { subtitle: "分机状态 · 回改阶段", status: "ready" },
    ov6c: { subtitle: "跨对象时序 · 回改阶段", status: "ready" },
    "operational-task": { subtitle: "阶段 · 阵营 · 任务 · 效果", status: "ready" },
    "force-mission": { subtitle: "兵力编成 · 任务承接 · 平台", status: "ready" },
    ov4: { subtitle: "组织 · 责任 · 协同", status: "ready" },
    ov2: { subtitle: "节点与资源交换", status: "ready" },
    ov3: { subtitle: "接口 · 频率 · 完整性", status: "ready" },
    "concept-map": { subtitle: "阶段兵力空间表达", status: "ready" },
    ov1: { subtitle: "总体概念是否闭合", status: "done" },
    ov5: { subtitle: "横向活动关系", status: "ready" },
    ov5a: { subtitle: "活动层级与覆盖", status: "ready" },
    ooda: { subtitle: "行为综合视角", status: "ready" },
    "structure-review": { subtitle: "反查并定位回改", status: "ready" },
    scenario: { subtitle: "推演输入", status: "ready" },
    validate: { subtitle: "规划是否可成立", status: "ready" },
    collaboration: { subtitle: "意见 · 决策 · 版本", status: "ready" },
    report: { subtitle: "导出已确认版本", status: "" }
  }[id] || { subtitle: "", status: "ready" };
  return {
    id,
    number: "00",
    label: productLabels[id] || id,
    subtitle: meta.subtitle,
    status: meta.status,
    role: workflowStepRoles[id] || "check"
  };
});

/**
 * Five research stages — same as left-rail tracks.
 * Gate confirm unlocks the next stage; mid-stage “下一步” walks the primary path.
 */
export const workflowPhases = ["研究建模", "阶段行动", "兵力任务", "概念图", "推演演示"];

const workflowPhaseById = {
  brief: "研究建模",
  ov6a: "阶段行动",
  "phase-action": "阶段行动",
  ov6b: "阶段行动",
  ov6c: "阶段行动",
  "operational-task": "兵力任务",
  "force-mission": "兵力任务",
  ov4: "兵力任务",
  ov2: "兵力任务",
  ov3: "兵力任务",
  "concept-map": "概念图",
  ov1: "概念图",
  ov5: "概念图",
  ov5a: "概念图",
  ooda: "概念图",
  "structure-review": "推演演示",
  scenario: "推演演示",
  validate: "推演演示",
  collaboration: "推演演示",
  report: "推演演示"
};

/**
 * Linear research path for the top gate capsule.
 * Phase chain: 规则库 → 阶段 → 状态机 → 时序 → … → 结构反查
 */
export const workflowPrimaryStepIds = [
  "brief",
  "ov6a",
  "phase-action",
  "ov6b",
  "ov6c",
  "operational-task",
  "force-mission",
  "ov4",
  "ov2",
  "ov3",
  "concept-map",
  "ov1",
  "ov5",
  "ov5a",
  "ooda",
  "structure-review",
  "scenario",
  "validate",
  "collaboration",
  "report"
];

/** Navigation five tracks — phase track follows fixed chain order. */
export const workflowTracks = [
  { id: "model", label: "研究建模", summary: "简报：目标 · 边界 · 假设 · 效果", viewIds: ["brief"], defaultOpen: true },
  { id: "phase", label: "阶段行动", summary: "规则库 → 阶段 → 状态/时序 → 反查", viewIds: ["ov6a", "phase-action", "ov6b", "ov6c"], defaultOpen: false },
  { id: "force", label: "兵力任务", summary: "任务 · 兵力 · 责任 · 资源流", viewIds: ["operational-task", "force-mission", "ov4", "ov2", "ov3"], defaultOpen: false },
  { id: "concept", label: "概念图", summary: "概念图 · 总体 · 活动 · 循环", viewIds: ["concept-map", "ov1", "ov5", "ov5a", "ooda"], defaultOpen: false },
  { id: "deliver", label: "推演演示", summary: "反查 · 想定 · 验证 · 审阅 · 报告", viewIds: ["structure-review", "scenario", "validate", "collaboration", "report"], defaultOpen: false }
];

views.forEach((view) => { view.phase = workflowPhaseById[view.id] || "其他"; });
views.sort((left, right) => workflowOrder.indexOf(left.id) - workflowOrder.indexOf(right.id));
// Rail numbers follow visible navigation order continuously: 01, 02, 03…
views.forEach((view, index) => {
  view.number = String(index + 1).padStart(2, "0");
});

export function productLabel(id, fallback = "") {
  return productLabels[id] || fallback || String(id || "");
}

export function productShortLabel(id, fallback = "") {
  return productShortLabels[id] || fallback || productLabel(id, String(id || "")).slice(0, 8);
}

export const project = {
  title: "联合封控概念研究",
  brief: {
    objective: "在 48 小时行动窗口内建立持续态势优势，形成重点通道的联合封控能力。",
    approach: "以多源感知为先导，将目标识别、协同决策、电子压制与分阶段行动组织成可闭环的体系。",
    assumptions: "关键通信链路可用；区域基础地理数据完整；知识库中的装备参数经人工复核。",
    expectedEffects: "形成可复核的态势认知、协同决策与行动反馈闭环，并保留风险和约束的修订依据。",
    evidenceRefs: ["obs/案例/联合封控案例.md", "obs/方法/体系破击.md"],
    risk: "对手分布式机动与信息欺骗可能降低目标识别效率。"
  },
  citations: [
    { title: "联合封控案例", text: "持续行动依赖海空力量、信息支援与保障链的协同。", ref: "obs/案例/联合封控案例.md" },
    { title: "体系破击", text: "优先识别影响感知、指挥与行动闭环的关键节点。", ref: "obs/方法/体系破击.md" },
    { title: "多方案评估框架", text: "从任务达成、风险、资源、时序四类指标开展比较。", ref: "obs/方法/多方案评估框架.md" }
  ]
};

export const directions = [
  { id: "control", title: "稳控塑势", text: "优先建立可靠感知与行动边界，以持续控制降低不确定性。" },
  { id: "disrupt", title: "体系压制", text: "围绕关键节点组织多手段协同，压缩对手闭环效率。" },
  { id: "deceive", title: "诱导牵制", text: "通过多方向行动与信息诱导，为主方向创造窗口。" }
];

export const ov1Nodes = [
  { id: "sense", label: "监视侦察装备/平台", category: "装备平台", kind: "equipment", className: "", x: "10%", y: "46%", detail: "形成面向任务区域的高层态势信息。" },
  { id: "decide", label: "联合指挥控制中心", category: "指挥节点", kind: "command", className: "", x: "36%", y: "72%", detail: "在任务边界内组织高层协同与授权。" },
  { id: "control", label: "关键行动单元", category: "关键动作", kind: "action", className: "", x: "46%", y: "40%", detail: "在关键任务区域内实施总体行动概念。" },
  { id: "opponent", label: "外部对象与态势影响", category: "外部对象", kind: "external", className: "blue", x: "72%", y: "18%", detail: "代表可能影响任务达成的外部体系与态势变化。" },
  { id: "assess", label: "任务效果与终态", category: "预期效果", kind: "effect", className: "gold", x: "72%", y: "66%", detail: "汇总总体效果并反馈下一轮概念修订。" }
];

export const activities = [
  { id: "a1", type: "感知", title: "侦察与监视", text: "汇聚多源态势，识别重点区域变化。", input: "任务区、传感器状态", output: "态势线索", duration: "持续", refs: ["联合封控案例"], sourceOv1NodeIds: ["sense"] },
  { id: "a2", type: "识别", title: "目标识别与分发", text: "确认对象属性并向协同节点分发。", input: "态势线索", output: "目标数据包", duration: "8 分钟", refs: ["体系破击"], sourceOv1NodeIds: ["sense"] },
  { id: "a3", type: "决策", title: "协同决策", text: "依据规则、窗口和资源状态形成行动指令。", input: "目标数据包、资源状态", output: "协同行动指令", duration: "5 分钟", refs: ["多方案评估框架"], sourceOv1NodeIds: ["decide"] },
  { id: "a4", type: "行动", title: "体系压制", text: "按任务优先级组织干扰、机动和行动协同。", input: "协同行动指令", output: "行动反馈", duration: "12 分钟", refs: ["体系破击"], sourceOv1NodeIds: ["decide", "opponent"] },
  { id: "a5", type: "控制", title: "通道控制", text: "维持行动边界，处理对手机动和突发变化。", input: "行动反馈、区域态势", output: "控制状态", duration: "持续", refs: ["联合封控案例"], sourceOv1NodeIds: ["control", "opponent"] },
  { id: "a6", type: "评估", title: "效果评估", text: "评估结果并决定是否修正下一轮行动。", input: "控制状态", output: "评估结论", duration: "6 分钟", refs: ["多方案评估框架"], sourceOv1NodeIds: ["assess"] }
];

export const oodaLanes = [
  { id: "observe", title: "Observe", subtitle: "观察", color: "#2a72a8", cards: [{ id: "o1", title: "目标指示", text: "多源观测汇聚", duration: "3 分钟" }, { id: "o2", title: "态势更新", text: "刷新区域态势", duration: "2 分钟" }] },
  { id: "orient", title: "Orient", subtitle: "判断", color: "#187a57", cards: [{ id: "r1", title: "属性判别", text: "识别对象与意图", duration: "4 分钟" }, { id: "r2", title: "窗口评估", text: "核对资源与约束", duration: "2 分钟" }] },
  { id: "decide", title: "Decide", subtitle: "决策", color: "#ad7a19", cards: [{ id: "d1", title: "行动授权", text: "形成协同行动指令", duration: "3 分钟" }] },
  { id: "act", title: "Act", subtitle: "行动", color: "#bd554d", cards: [{ id: "a1", title: "协同实施", text: "组织各节点执行", duration: "12 分钟" }, { id: "a2", title: "回收反馈", text: "进入下一轮循环", duration: "4 分钟" }] }
];

export const timeline = [
  { time: "T+00", text: "启动重点区域侦察与监视" },
  { time: "T+08", text: "完成首批目标识别与数据分发" },
  { time: "T+13", text: "形成协同行动指令" },
  { time: "T+25", text: "执行体系压制与通道控制" },
  { time: "T+31", text: "完成初始效果评估，更新下一轮行动" }
];

export const validation = {
  scores: [
    { label: "活动连通性", score: 92 },
    { label: "信息闭环", score: 81 },
    { label: "资源约束", score: 74 },
    { label: "OODA 时效", score: 78 }
  ],
  issues: [
    { level: "alert", title: "目标数据格式需确认", text: "“目标识别与分发”输出字段尚未与“协同决策”输入 schema 固化。" },
    { level: "", title: "保障参数待补充", text: "持续行动阶段缺少保障消耗率的知识库引用。" },
    { level: "", title: "对手信息欺骗风险", text: "蓝方可能改变可观测特征，应在判断阶段补充交叉验证规则。" }
  ]
};
