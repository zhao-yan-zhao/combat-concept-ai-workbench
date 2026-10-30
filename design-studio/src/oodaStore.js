const STORAGE_KEY = "concept-studio-ooda-model-v1";

const laneDefinitions = [
  { id: "observe", title: "Observe", subtitle: "观察", color: "#2a72a8" },
  { id: "orient", title: "Orient", subtitle: "判断", color: "#187a57" },
  { id: "decide", title: "Decide", subtitle: "决策", color: "#ad7a19" },
  { id: "act", title: "Act", subtitle: "行动", color: "#bd554d" }
];

export function hasPersistedOodaModel() {
  try {
    return isValidModel(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return false;
  }
}

/**
 * 动态 OODA 闭环健康度诊断引擎（只读透镜）
 * 根据 OV-5b 活动流拓扑与语义，实时评估杀伤网与决策闭环的完整度与因果闭合性。
 * @param {object} ov5Model OV-5 作战活动模型 (含 activities 和 edges)
 * @returns {{ categorized: object, diagnostics: Array<object>, healthScore: number, loopClosed: boolean, feedbackEdges: Array<object> }}
 */
export function evaluateOodaLoopHealth(ov5Model = {}) {
  const activities = Array.isArray(ov5Model?.activities) ? ov5Model.activities : [];
  const edges = Array.isArray(ov5Model?.edges) ? ov5Model.edges : [];
  const activityMap = new Map(activities.map((a) => [a.id, a]));

  const matchKeywords = (activity, keywords) => {
    const text = [
      activity.type,
      activity.title,
      activity.text,
      activity.input,
      activity.output
    ].filter(Boolean).join(" ");
    return keywords.some((kw) => text.includes(kw));
  };

  const categorized = {
    observe: activities.filter((a) => matchKeywords(a, ["感知", "侦察", "监视", "探测", "预警", "巡逻", "搜潜", "雷达"])),
    orient: activities.filter((a) => matchKeywords(a, ["识别", "融合", "评估", "判断", "分析", "分批", "跟踪", "解算", "判决"])),
    decide: activities.filter((a) => matchKeywords(a, ["决策", "协同", "规划", "任务分配", "指挥", "授权", "下达", "指控"])),
    act: activities.filter((a) => matchKeywords(a, ["打击", "干扰", "机动", "发射", "防护", "拦截", "突击", "压制", "控制", "行动"])),
    feedback: activities.filter((a) => matchKeywords(a, ["战损评估", "战果确认", "态势更新", "回传", "毁伤", "效果评估", "反馈", "重组"]))
  };

  const diagnostics = [];

  // 1. 检查各环基础活动覆盖
  if (!categorized.observe.length) {
    diagnostics.push({
      level: "error",
      code: "NO_OBSERVE",
      label: "缺少感知活动 (Observe)",
      message: "活动网络中未检测到侦察预警或态势感知活动，决策链缺乏源头输入。"
    });
  }
  if (!categorized.decide.length) {
    diagnostics.push({
      level: "warn",
      code: "NO_DECIDE",
      label: "缺少决策节点 (Decide)",
      message: "活动网络中缺少明确的指挥协同或任务分配决策活动，易受单点断链影响。"
    });
  }
  if (!categorized.act.length) {
    diagnostics.push({
      level: "error",
      code: "NO_ACT",
      label: "缺少行动节点 (Act)",
      message: "活动网络中缺少实质作战行动（打击、干扰、防护等），作战能力无法闭合。"
    });
  }

  // 2. 检查反哺闭环 (Feedback Loop)
  const actAndFeedbackIds = new Set([
    ...categorized.act.map((a) => a.id),
    ...categorized.feedback.map((a) => a.id)
  ]);
  const observeAndDecideIds = new Set([
    ...categorized.observe.map((a) => a.id),
    ...categorized.orient.map((a) => a.id),
    ...categorized.decide.map((a) => a.id)
  ]);

  const feedbackEdges = edges.filter((edge) => {
    const srcId = edge.sourceId;
    const tgtId = edge.targetId;
    return actAndFeedbackIds.has(srcId) && observeAndDecideIds.has(tgtId);
  });

  const loopClosed = feedbackEdges.length > 0;
  if (!loopClosed && activities.length >= 3) {
    diagnostics.push({
      level: "critical_gap",
      code: "NO_FEEDBACK_LOOP",
      label: "未形成自适应闭环 (No Feedback)",
      message: "行动/打击后缺少向感知或决策层回传的反馈边，未形成闭合的 OODA 自适应作战循环。",
      quickFixAction: "recommend-feedback-activity"
    });
  }

  // 3. 检查孤立节点
  const connectedNodeIds = new Set(edges.flatMap((e) => [e.sourceId, e.targetId]));
  const orphanActivities = activities.filter((a) => !connectedNodeIds.has(a.id));
  if (orphanActivities.length > 0 && activities.length > 1) {
    diagnostics.push({
      level: "warn",
      code: "ORPHAN_ACTIVITIES",
      label: `存在 ${orphanActivities.length} 个未连接活动`,
      message: `活动 [${orphanActivities.slice(0, 3).map((a) => a.title).join(", ")}${orphanActivities.length > 3 ? "..." : ""}] 尚未配置前后置信息流或控制流。`
    });
  }

  // 4. 计算综合健康度得分 (0 - 100)
  let score = 100;
  for (const d of diagnostics) {
    if (d.level === "critical_gap") score -= 30;
    else if (d.level === "error") score -= 20;
    else if (d.level === "warn") score -= 10;
  }
  if (!activities.length) score = 0;
  const healthScore = Math.max(0, Math.min(100, score));

  return {
    categorized,
    diagnostics,
    healthScore,
    loopClosed,
    feedbackEdges,
    stats: {
      observeCount: categorized.observe.length,
      orientCount: categorized.orient.length,
      decideCount: categorized.decide.length,
      actCount: categorized.act.length,
      feedbackCount: categorized.feedback.length
    }
  };
}

export function loadOodaModel(ov5Model) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (isValidModel(saved)) return saved;
  } catch {
    // Invalid local state falls back to an OV-5-derived model.
  }
  return deriveOodaFromOv5(ov5Model);
}

export function deriveOodaFromOv5(ov5Model) {
  const activities = ov5Model.activities || [];
  const pick = (types, fallbackIndex) => activities.find((item) => types.includes(item.type)) || activities[fallbackIndex] || {};
  const observe = pick(["感知", "识别"], 0);
  const orient = pick(["识别", "评估"], 1);
  const decide = pick(["决策"], 2);
  const act = pick(["行动", "控制"], 3);
  const feedback = pick(["控制", "评估"], 4);

  const model = {
    version: 1,
    sourceActivityIds: [observe.id, orient.id, decide.id, act.id, feedback.id].filter(Boolean),
    sourceOv5Signature: createOv5SourceSignature(ov5Model),
    derivedAt: new Date().toISOString(),
    stale: false,
    staleReason: "",
    lanes: laneDefinitions.map((lane) => ({ ...lane, nodes: [] }))
  };

  model.lanes[0].nodes = [createNode("observe", observe, "获取态势线索", "态势线索", "多源感知结果", "确认观测来源与时效")];
  model.lanes[1].nodes = [createNode("orient", orient, "分析对象属性", "态势线索", "目标数据包", "完成交叉验证后进入决策")];
  model.lanes[2].nodes = [createNode("decide", decide, "形成协同行动决策", "目标数据包、资源状态", "协同行动指令", "满足行动窗口与资源约束")];
  model.lanes[3].nodes = [
    createNode("act", act, "组织协同行动", "协同行动指令", "行动反馈", "按授权规则执行"),
    createNode("act", feedback, "回收并评估反馈", "行动反馈", "下一轮态势更新", "反馈进入下一轮观察")
  ];

  persistOodaModel(model);
  return model;
}

/** Compact OV-5 fingerprint used to detect whether an OODA model still matches its source activities. */
export function createOv5SourceSignature(ov5Model = {}) {
  return JSON.stringify({
    activities: (Array.isArray(ov5Model.activities) ? ov5Model.activities : []).map((activity) => ({
      id: activity.id,
      title: activity.title,
      type: activity.type,
      input: activity.input,
      output: activity.output,
      duration: activity.duration,
      sourceOv1NodeIds: Array.isArray(activity.sourceOv1NodeIds) ? [...activity.sourceOv1NodeIds].map(String).sort() : []
    })),
    edges: (Array.isArray(ov5Model.edges) ? ov5Model.edges : []).map((edge) => ({
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      type: edge.type
    }))
  });
}

export function isOodaStale(oodaModel, ov5Model) {
  if (!oodaModel) return false;
  if (oodaModel.stale) return true;
  const signature = oodaModel.sourceOv5Signature;
  if (signature) return signature !== createOv5SourceSignature(ov5Model);
  // Legacy models without a signature: stale if referenced OV-5 activities disappeared.
  const activityIds = new Set((ov5Model?.activities || []).map((activity) => String(activity.id)));
  const sourceIds = [
    ...(Array.isArray(oodaModel.sourceActivityIds) ? oodaModel.sourceActivityIds : []),
    ...(Array.isArray(oodaModel.lanes) ? oodaModel.lanes : []).flatMap((lane) => (lane.nodes || []).map((node) => node.sourceActivityId))
  ].map(String).filter(Boolean);
  return sourceIds.some((id) => !activityIds.has(id));
}

export function getOodaFreshness(oodaModel, ov5Model) {
  const stale = isOodaStale(oodaModel, ov5Model);
  if (!oodaModel) {
    return { stale: false, ran: false, reason: "", derivedAt: "" };
  }
  if (!stale) {
    return {
      stale: false,
      ran: true,
      reason: "",
      derivedAt: oodaModel.derivedAt || oodaModel.provenance?.generatedAt || ""
    };
  }
  return {
    stale: true,
    ran: true,
    reason: oodaModel.staleReason || "OV-5 活动或关系已变更，当前 OODA 仅供参考，建议从活动模型重新派生。",
    derivedAt: oodaModel.derivedAt || oodaModel.provenance?.generatedAt || ""
  };
}

export function persistOodaModel(model) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  } catch {
    // Node environment fallback
  }
}

export function addOodaNode(model, laneId) {
  const lane = model.lanes.find((item) => item.id === laneId);
  if (!lane) return null;
  const node = {
    id: `ooda-${laneId}-${Date.now()}`,
    sourceActivityId: "",
    title: "新行为节点",
    text: "补充该节点的行为说明。",
    duration: "待估算",
    input: "待定义",
    output: "待定义",
    rule: "待定义",
    equipmentRefs: [],
    knowledgeRefs: []
  };
  lane.nodes.push(node);
  persistOodaModel(model);
  return node;
}

export function updateOodaNode(model, nodeId, patch) {
  const node = findNode(model, nodeId);
  if (!node) return null;
  Object.assign(node, patch);
  persistOodaModel(model);
  return node;
}

export function deleteOodaNode(model, nodeId) {
  for (const lane of model.lanes) {
    const index = lane.nodes.findIndex((node) => node.id === nodeId);
    if (index >= 0) {
      lane.nodes.splice(index, 1);
      persistOodaModel(model);
      return true;
    }
  }
  return false;
}

export function getOodaDuration(model) {
  return model.lanes.flatMap((lane) => lane.nodes)
    .reduce((sum, node) => sum + parseMinutes(node.duration), 0);
}

function createNode(laneId, activity, fallbackTitle, fallbackInput, fallbackOutput, rule) {
  return {
    id: `ooda-${laneId}-${activity.id || fallbackTitle}`,
    sourceActivityId: activity.id || "",
    title: activity.title || fallbackTitle,
    text: activity.text || fallbackTitle,
    duration: activity.duration || "待估算",
    input: activity.input || fallbackInput,
    output: activity.output || fallbackOutput,
    rule,
    equipmentRefs: normalizeEquipmentRefs(activity.resources),
    knowledgeRefs: normalizeKnowledgeRefs(activity.refs)
  };
}

export function normalizeEquipmentRefs(value) {
  return normalizeOodaRefs(value);
}

export function normalizeKnowledgeRefs(value) {
  return normalizeOodaRefs(value);
}

function normalizeOodaRefs(value) {
  const entries = Array.isArray(value) ? value : String(value || "").split(/[，,、;；\n]/);
  return [...new Set(entries.map((item) => String(item || "").replace(/\s+/g, " ").trim()).filter(Boolean))].slice(0, 16).map((item) => item.slice(0, 160));
}

function findNode(model, nodeId) {
  return model.lanes.flatMap((lane) => lane.nodes).find((node) => node.id === nodeId);
}

function parseMinutes(value) {
  const match = String(value || "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function isValidModel(model) {
  return Boolean(
    model
    && model.version === 1
    && Array.isArray(model.lanes)
    && model.lanes.every((lane) => Array.isArray(lane.nodes))
  );
}
