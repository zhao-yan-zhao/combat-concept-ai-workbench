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

export function createLocalOv5Draft({ brief, direction, evidence = [], evidenceSelection = null, ov1 = null, tasks = [], forces = [] }) {
  return createOv5Draft({ brief, direction, evidence, evidenceSelection, mode: "local", ov1, tasks, forces });
}

export function applyAiOv5Draft({ brief, direction, draft, evidence = [], evidenceSelection = null, ov1 = null, tasks = [], forces = [] }) {
  return createOv5Draft({ brief, direction, draft, evidence, evidenceSelection, mode: "ai", ov1, tasks, forces });
}

function createOv5Draft({ brief, direction, draft, evidence, evidenceSelection, mode, ov1, tasks = [], forces = [] }) {
  const reconTask = tasks.find((t) => String(t.missionType || t.name).includes("recon") || String(t.missionType || t.name).includes("patrol") || String(t.name).includes("侦") || String(t.name).includes("巡")) || tasks[0];
  const strikeTask = tasks.find((t) => String(t.missionType || t.name).includes("strike") || String(t.missionType || t.name).includes("attack") || String(t.name).includes("打") || String(t.name).includes("突")) || tasks[1] || tasks[0];
  const c2Task = tasks.find((t) => String(t.missionType || t.name).includes("c2") || String(t.missionType || t.name).includes("command") || String(t.name).includes("指") || String(t.name).includes("控")) || tasks[2] || tasks[0];

  const c2Force = forces.find((f) => String(f.role || f.name).includes("指挥") || String(f.role || f.name).includes("控制") || String(f.role || f.name).includes("c2")) || forces[0];
  const reconForce = forces.find((f) => String(f.role || f.name).includes("侦察") || String(f.role || f.name).includes("预警") || String(f.role || f.name).includes("感知")) || forces[1] || forces[0];
  const strikeForce = forces.find((f) => String(f.role || f.name).includes("突击") || String(f.role || f.name).includes("打击") || String(f.role || f.name).includes("攻击")) || forces[2] || forces[0];
  const objective = textOf(draft?.objective || brief?.objective, 220) || "当前概念目标";
  const coreIdea = textOf(draft?.coreIdea || brief?.approach, 320) || "以可复核的信息闭环支撑概念研究。";
  const phases = listOf(draft?.phases);
  const risk = phraseOf(listOf(draft?.risks)[0] || brief?.risk, 220) || "信息不确定性和资源连续性";
  const expectedEffects = phraseOf(draft?.expectedEffects || brief?.expectedEffects, 220);
  const directionLabel = textOf(direction, 60) || "当前概念方向";
  const refs = evidence.map((item) => textOf(item?.title, 100)).filter(Boolean).slice(0, 3);
  const phase = (index, fallback) => phraseOf(phases[index] || fallback, 220);
  const detailById = {
    sense: reconTask ? `承接任务「${reconTask.name}」，围绕“${objective}”持续获取并确认多源态势线索，支撑${phase(0, directionLabel)}。` : `围绕“${objective}”持续获取并确认态势线索，优先支撑${phase(0, directionLabel)}。`,
    identify: `对态势线索进行跨域交叉判别和情报分发，形成火控级可复核的目标指示数据包。`,
    decide: c2Task ? `承接任务「${c2Task.name}」，依据${directionLabel}和资源时序约束，由${c2Force?.name || "指挥决策席位"}形成协同行动指令；核心依据：${coreIdea}` : `依据${directionLabel}和资源、时序约束，形成可审阅的协同方案判定；核心依据：${coreIdea}`,
    act: strikeTask ? `承接任务「${strikeTask.name}」，由${strikeForce?.name || "主战突击单元"}在已确认授权边界内组织协同交战突击，记录行动偏差。` : `在已确认授权边界内组织研究级协同行动，并记录结果、偏差和约束变化。`,
    control: `根据${phase(1, "当前行动重点")}维持任务交战边界与通道安全，动态处理突发战损与电磁异常。`,
    assess: `以任务达成、杀伤效果和抗毁连续性为维度回收结果；重点复核：${risk}，动态反哺态势感知。`
  };
  if (expectedEffects) detailById.assess = `${detailById.assess} 预期效果：${expectedEffects}。`;
  const activities = ACTIVITY_BLUEPRINTS.map((blueprint) => {
    let sourceTaskId = "";
    let performer = "作战席位";
    let domain = "空中";
    if (blueprint.id === "sense" && reconTask) {
      sourceTaskId = reconTask.id;
      performer = reconForce?.name || reconTask.assignedForceId || "侦察预警单元";
      domain = reconForce?.domain || "空中";
    } else if (blueprint.id === "decide" && c2Task) {
      sourceTaskId = c2Task.id;
      performer = c2Force?.name || c2Task.assignedForceId || "编队指控所";
      domain = c2Force?.domain || "综合";
    } else if (blueprint.id === "act" && strikeTask) {
      sourceTaskId = strikeTask.id;
      performer = strikeForce?.name || strikeTask.assignedForceId || "突击兵力单元";
      domain = strikeForce?.domain || "空中";
    }
    return {
      ...blueprint,
      id: `ov5-${blueprint.id}`,
      sourceTaskId,
      performer,
      domain,
      text: detailById[blueprint.id],
      refs: [...refs],
      sourceOv1NodeIds: []
    };
  });

  const model = {
    version: 1,
    activities,
    edges: [
      ...activities.slice(0, -1).map((activity, index) => ({
        id: `edge-${activity.id}-${activities[index + 1].id}`,
        sourceId: activity.id,
        targetId: activities[index + 1].id,
        type: index === 2 ? "控制流" : "信息流",
        flowSemantic: index === 2 ? "authorization" : index === 3 ? "hand_off" : "cue",
        isFeedback: false
      })),
      {
        id: `edge-feedback-${activities[activities.length - 1].id}-${activities[0].id}`,
        sourceId: activities[activities.length - 1].id,
        targetId: activities[0].id,
        type: "信息流",
        flowSemantic: "feedback",
        isFeedback: true,
        payload: "战果评估与态势动态反哺",
        condition: "评估完成后触发新一轮态势更新"
      }
    ],
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
