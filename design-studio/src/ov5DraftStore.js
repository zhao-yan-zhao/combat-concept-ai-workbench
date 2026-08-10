import { linkOv5ActivitiesToOv1 } from "./ov5Ov1Linker.js";
import { normalizeDodafOv5 } from "../../shared/dodaf/products.js";

const ACTIVITY_BLUEPRINTS = [
  { id: "sense", type: "感知", title: "态势获取与确认", input: "任务区、传感器状态", output: "态势线索", duration: "持续" },
  { id: "identify", type: "识别", title: "对象判别与分发", input: "态势线索", output: "目标数据包", duration: "8 分钟" },
  { id: "decide", type: "决策", title: "协同方案判定", input: "目标数据包、资源状态", output: "协同行动指令", duration: "5 分钟" },
  { id: "act", type: "行动", title: "受约束的协同行动", input: "协同行动指令", output: "行动反馈", duration: "12 分钟" },
  { id: "control", type: "控制", title: "任务边界控制", input: "行动反馈、区域态势", output: "控制状态", duration: "持续" },
  { id: "assess", type: "评估", title: "效果回收与修订", input: "控制状态", output: "评估结论", duration: "6 分钟" }
];

export function createLocalOv5Draft({ brief, direction, evidence = [], evidenceSelection = null, ov1 = null }) {
  return createOv5Draft({ brief, direction, evidence, evidenceSelection, mode: "local", ov1 });
}

export function applyAiOv5Draft({ brief, direction, draft, evidence = [], evidenceSelection = null, ov1 = null }) {
  return createOv5Draft({ brief, direction, draft, evidence, evidenceSelection, mode: "ai", ov1 });
}

function createOv5Draft({ brief, direction, draft, evidence, evidenceSelection, mode, ov1 }) {
  const objective = textOf(draft?.objective || brief?.objective, 220) || "当前概念目标";
  const coreIdea = textOf(draft?.coreIdea || brief?.approach, 320) || "以可复核的信息闭环支撑概念研究。";
  const phases = listOf(draft?.phases);
  const risk = phraseOf(listOf(draft?.risks)[0] || brief?.risk, 220) || "信息不确定性和资源连续性";
  const expectedEffects = phraseOf(draft?.expectedEffects || brief?.expectedEffects, 220);
  const directionLabel = textOf(direction, 60) || "当前概念方向";
  const refs = evidence.map((item) => textOf(item?.title, 100)).filter(Boolean).slice(0, 3);
  const phase = (index, fallback) => phraseOf(phases[index] || fallback, 220);
  const detailById = {
    sense: `围绕“${objective}”持续获取并确认态势线索，优先支撑${phase(0, directionLabel)}。`,
    identify: `对态势线索进行交叉判别和规范化分发，形成可供后续复核的目标数据包。`,
    decide: `依据${directionLabel}和资源、时序约束，形成可审阅的协同方案判定；核心依据：${coreIdea}`, 
    act: `在已确认授权边界内组织研究级协同行动，并记录结果、偏差和约束变化。`,
    control: `根据${phase(1, "当前行动重点")}维持任务边界与资源连续性，及时处理影响闭环的异常。`,
    assess: `以任务达成、信息闭环和风险可控为维度回收结果；重点复核：${risk}。`
  };
  if (expectedEffects) detailById.assess = `${detailById.assess} 预期效果：${expectedEffects}。`;
  const activities = ACTIVITY_BLUEPRINTS.map((blueprint) => ({
    ...blueprint,
    id: `ov5-${blueprint.id}`,
    text: detailById[blueprint.id],
    refs: [...refs],
    sourceOv1NodeIds: []
  }));

  const model = {
    version: 1,
    activities,
    edges: activities.slice(0, -1).map((activity, index) => ({
      id: `edge-${activity.id}-${activities[index + 1].id}`,
      sourceId: activity.id,
      targetId: activities[index + 1].id,
      type: index === 2 ? "控制流" : "信息流"
    })),
    provenance: {
      mode,
      generatedAt: new Date().toISOString(),
      evidenceCount: refs.length,
      evidenceSelection: normalizeEvidenceSelection(evidenceSelection)
    }
  };
  const linked = linkOv5ActivitiesToOv1(model, ov1);
  try {
    return normalizeDodafOv5(linked);
  } catch {
    return linked;
  }
}

function normalizeEvidenceSelection(value) {
  if (!value || typeof value !== "object") return null;
  return {
    source: value.source === "server" ? "server" : "local",
    indexMode: textOf(value.indexMode, 40) || "keyword",
    query: textOf(value.query, 480),
    count: Math.max(0, Math.min(8, Number(value.count) || 0)),
    fallback: Boolean(value.fallback),
    projectRevision: Math.max(0, Number(value.projectRevision) || 0),
    resourceRevision: Math.max(0, Number(value.resourceRevision) || 0),
    selectedAt: textOf(value.selectedAt, 80)
  };
}

function listOf(value) {
  return Array.isArray(value) ? value.map((item) => textOf(item, 220)).filter(Boolean) : [];
}

function textOf(value, limit) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function phraseOf(value, limit) {
  return textOf(value, limit).replace(/[。！？.!?]+$/, "");
}
