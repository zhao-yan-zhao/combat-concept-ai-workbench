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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
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
