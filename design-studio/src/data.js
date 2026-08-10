export const views = [
  { id: "brief", number: "01", label: "概念简报", subtitle: "灵感孵化", status: "done" },
  { id: "ov1", number: "02", label: "OV-1 高层作战概念图", subtitle: "总体概念", status: "done" },
  { id: "ov2", number: "03", label: "OV-2 作战资源流描述", subtitle: "节点与交换", status: "ready" },
  { id: "ov3", number: "04", label: "OV-3 作战资源流矩阵", subtitle: "接口与约束", status: "ready" },
  { id: "ov5", number: "05", label: "OV-5b 作战活动模型", subtitle: "活动与关系", status: "ready" },
  { id: "ooda", number: "06", label: "研究辅助循环", subtitle: "OODA 行为综合", status: "ready" },
  { id: "scenario", number: "07", label: "自动想定", subtitle: "部署与时序", status: "ready" },
  { id: "validate", number: "08", label: "设计验证", subtitle: "规则与对抗", status: "ready" },
  { id: "collaboration", number: "09", label: "协同审阅", subtitle: "意见与决议", status: "ready" },
  { id: "report", number: "10", label: "成果报告", subtitle: "归档与导出", status: "" }
];

views.splice(6, 0, { id: "ov6c", number: "07", label: "OV-6c 事件序列", subtitle: "时序追溯", status: "ready" });
views.splice(4, 0, { id: "ov4", number: "05", label: "OV-4 责任关系", subtitle: "抽象职责", status: "ready" });
views.splice(4, 0, { id: "ov5a", number: "05", label: "OV-5a 作战活动分解树", subtitle: "活动层级", status: "ready" });
views.splice(7, 0, { id: "ov6a", number: "08", label: "OV-6a 作战规则模型", subtitle: "规则约束", status: "ready" });
views.splice(8, 0, { id: "ov6b", number: "09", label: "OV-6b 作战状态转换", subtitle: "状态逻辑", status: "ready" });
views.push({ id: "structure-review", number: "00", label: "结构核对台", subtitle: "问题聚合", status: "ready" });
views.splice(1, 0, { id: "concept-map", number: "04", label: "概念图", subtitle: "外部绘制工具", status: "ready" });
views.splice(1, 0, { id: "force-mission", number: "03", label: "兵力与任务", subtitle: "职责设计", status: "ready" });
views.splice(1, 0, { id: "phase-action", number: "02", label: "阶段与行动", subtitle: "时序构想", status: "ready" });
views.forEach((view, index) => { view.number = String(index + 1).padStart(2, "0"); });

const workflowPhaseById = {
  "phase-action": "作战概念规划",
  "force-mission": "作战概念规划",
  "concept-map": "作战概念规划",
  brief: "研究准备",
  ov1: "概念建模", ov5: "概念建模", ooda: "概念建模",
  "structure-review": "结构校核", ov5a: "结构校核", ov2: "结构校核", ov3: "结构校核", ov4: "结构校核", ov6a: "结构校核", ov6b: "结构校核", ov6c: "结构校核",
  scenario: "推演评估", validate: "推演评估",
  collaboration: "审阅交付", report: "审阅交付"
};
/** 主写路径在前；简报后先定阶段时序，再定兵力职责，概念图确认后直接进入 OV-1。 */
const workflowOrder = ["brief", "phase-action", "force-mission", "concept-map", "ov1", "ov5", "ooda", "structure-review", "ov5a", "ov2", "ov3", "ov4", "ov6a", "ov6b", "ov6c", "scenario", "validate", "collaboration", "report"];
export const workflowPhases = ["研究准备", "概念建模", "结构校核", "推演评估", "审阅交付"];

/** 导航三轨：写 / 看 / 用。阶段门禁仍按 workflowPhases，不按轨道。 */
workflowPhases.splice(1, 0, "作战概念规划");

export const workflowTracks = [
  { id: "model", label: "研究建模", summary: "写：简报 · 规划 · 活动 · 循环", viewIds: ["brief", "ov1", "ov5", "ooda"], defaultOpen: true },
  { id: "review", label: "结构核对", summary: "看：问题聚合与派生诊断", viewIds: ["structure-review", "ov5a", "ov2", "ov3", "ov4", "ov6a", "ov6b", "ov6c"] },
  { id: "deliver", label: "推演交付", summary: "用：想定 · 验证 · 审阅 · 报告", viewIds: ["scenario", "validate", "collaboration", "report"] }
];

workflowTracks[0].viewIds.splice(1, 0, "phase-action", "force-mission", "concept-map");
views.forEach((view) => { view.phase = workflowPhaseById[view.id] || "其他"; });
views.sort((left, right) => workflowOrder.indexOf(left.id) - workflowOrder.indexOf(right.id));
views.forEach((view, index) => { view.number = String(index + 1).padStart(2, "0"); });

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
