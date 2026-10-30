import { activities as seedActivities } from "./data.js";
import { normalizeDodafOv5 } from "../../shared/dodaf/products.js";

const STORAGE_KEY = "concept-studio-ov5-model-v1";

function createSeedModel() {
  const activities = seedActivities.map((activity) => ({ ...activity, refs: [...activity.refs], sourceOv1NodeIds: [...(activity.sourceOv1NodeIds || [])] }));
  const raw = {
    version: 1,
    activities,
    edges: activities.slice(0, -1).map((activity, index) => ({
      id: `edge-${activity.id}-${activities[index + 1].id}`,
      sourceId: activity.id,
      targetId: activities[index + 1].id,
      type: index === 2 ? "控制流" : "信息流"
    }))
  };
  try {
    return normalizeDodafOv5(raw);
  } catch {
    return raw;
  }
}

export function loadOv5Model() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (isValidModel(saved)) return normalizeOv5Model(saved);
  } catch {
    // Invalid browser storage falls back to the seed model.
  }
  return createSeedModel();
}

export function hasPersistedOv5Model() {
  try {
    return isValidModel(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return false;
  }
}

export function normalizeOv5Model(model) {
  if (!isValidModel(model)) return createSeedModel();
  try {
    return normalizeDodafOv5(model);
  } catch {
    return model;
  }
}

export function persistOv5Model(model) {
  const normalized = normalizeOv5Model(model);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Node acceptance tests still receive the normalized model.
  }
  return normalized;
}

export function addActivity(model) {
  const activity = {
    id: `activity-${Date.now()}`,
    type: "待分类",
    title: "新作战活动",
    text: "补充该活动的任务说明。",
    input: "待定义",
    output: "待定义",
    duration: "待估算",
    parentId: "",
    resources: "",
    preconditions: "",
    constraints: "",
    refs: [],
    sourceOv1NodeIds: []
  };
  model.activities.push(activity);
  persistOv5Model(model);
  return activity;
}

export function updateActivity(model, activityId, patch) {
  const activity = model.activities.find((item) => item.id === activityId);
  if (!activity) return null;
  const next = { ...patch };
  if (Object.hasOwn(next, "parentId") && !canAssignActivityParent(model, activityId, next.parentId)) next.parentId = "";
  Object.assign(activity, next);
  persistOv5Model(model);
  return activity;
}

export function getAssignableParentActivities(model, activityId) {
  return (model?.activities || []).filter((activity) => canAssignActivityParent(model, activityId, activity.id));
}

function canAssignActivityParent(model, activityId, candidateId) {
  const parentId = String(candidateId || "").trim();
  if (!parentId) return true;
  const byId = new Map((model?.activities || []).map((activity) => [activity.id, activity]));
  if (!byId.has(parentId) || parentId === activityId) return false;
  const seen = new Set([activityId]);
  let currentId = parentId;
  while (currentId) {
    if (seen.has(currentId)) return false;
    seen.add(currentId);
    currentId = byId.get(currentId)?.parentId || "";
  }
  return true;
}

export function deleteActivity(model, activityId) {
  if (model.activities.length <= 1) return false;
  model.activities = model.activities.filter((item) => item.id !== activityId);
  model.edges = model.edges.filter((edge) => edge.sourceId !== activityId && edge.targetId !== activityId);
  persistOv5Model(model);
  return true;
}

export function addEdge(model, sourceId, targetId, type = "信息流", { payload = "", condition = "" } = {}) {
  if (!sourceId || !targetId || sourceId === targetId) return null;
  const exists = model.edges.some((edge) => edge.sourceId === sourceId && edge.targetId === targetId);
  if (exists) return null;
  const edge = {
    id: `edge-${sourceId}-${targetId}-${Date.now()}`,
    sourceId,
    targetId,
    type,
    payload: String(payload || "").trim().slice(0, 4000),
    condition: String(condition || "").trim().slice(0, 4000)
  };
  model.edges.push(edge);
  persistOv5Model(model);
  return edge;
}

export function deleteEdge(model, edgeId) {
  model.edges = model.edges.filter((edge) => edge.id !== edgeId);
  persistOv5Model(model);
}

/**
 * 获取 OV-5a 活动层级树（按 parentId 组织树状层级）
 * @param {object} model OV-5 模型
 * @returns {Array<object>} 顶层活动树（每个节点带有 children 列表）
 */
export function getActivityHierarchy(model) {
  const activities = Array.isArray(model?.activities) ? model.activities : [];
  const nodeMap = new Map();
  activities.forEach((act) => {
    nodeMap.set(act.id, { ...act, children: [] });
  });

  const roots = [];
  activities.forEach((act) => {
    const wrapped = nodeMap.get(act.id);
    if (act.parentId && nodeMap.has(act.parentId)) {
      nodeMap.get(act.parentId).children.push(wrapped);
    } else {
      roots.push(wrapped);
    }
  });

  roots.roots = roots;
  roots.totalCount = activities.length;
  roots.rootCount = roots.length;

  return roots;
}

/**
 * 由作战任务（Task）智能派生初始作战活动网络
 * 按照 DoDAF 规范，由上游 Task 纵向细化为具备 I/O 与执行主体的 Activity
 * @param {Array<object>} tasks 上游确认的作战任务列表
 * @param {object} options 派生配置 (forceMission, overwrite)
 * @returns {object} 生成的标准化 OV-5 模型
 */
export function deriveActivitiesFromTasks(tasks = [], { forceMission = null, existingModel = null } = {}) {
  const taskList = Array.isArray(tasks) ? tasks : [];
  if (!taskList.length) return existingModel || createSeedModel();

  const generatedActivities = [];
  const generatedEdges = [];

  taskList.forEach((task, index) => {
    const missionType = String(task.missionType || "").toLowerCase();
    const taskName = task.name || `任务-${index + 1}`;
    const side = task.side === "hostile" ? "红方" : "蓝方";

    let actType = "行动";
    let defaultInput = "协同指令、态势数据";
    let defaultOutput = "行动成果、战况反馈";

    if (missionType.includes("recon") || missionType.includes("patrol") || missionType.includes("aaw")) {
      actType = "感知";
      defaultInput = "任务区规划、传感器参数";
      defaultOutput = "目标航迹数据包、辐射源特征";
    } else if (missionType.includes("strike") || missionType.includes("attack") || missionType.includes("cas")) {
      actType = "控制";
      defaultInput = "火控级目标包、发射授权";
      defaultOutput = "突击毁伤评估、拦截回传";
    } else if (missionType.includes("command") || missionType.includes("c2")) {
      actType = "决策";
      defaultInput = "融合态势图、交战规则";
      defaultOutput = "协同打击清单、交战指令";
    }

    const activityId = `act-${task.id || `t${index + 1}`}`;
    generatedActivities.push({
      id: activityId,
      sourceTaskId: task.id || "",
      type: actType,
      title: `${taskName}执行`,
      text: task.objective || `${side}围绕 ${taskName} 展开的具体作战活动。`,
      input: defaultInput,
      output: defaultOutput,
      duration: "30-60m",
      parentId: "",
      resources: String(task.assignedForceId || ""),
      preconditions: "前置阶段转换条件满足",
      constraints: "严格遵守交战授权规则",
      refs: [],
      sourceOv1NodeIds: []
    });
  });

  // 按类型顺序生成初始因果链路
  for (let i = 0; i < generatedActivities.length - 1; i += 1) {
    const curr = generatedActivities[i];
    const next = generatedActivities[i + 1];
    generatedEdges.push({
      id: `edge-${curr.id}-${next.id}`,
      sourceId: curr.id,
      targetId: next.id,
      type: curr.type === "决策" ? "控制流" : "信息流",
      payload: curr.output || "数据流",
      condition: "活动完成且判据满足"
    });
  }

  // 保证闭环反哺：末尾行动向首个感知/决策节点连接反馈边
  if (generatedActivities.length >= 3) {
    const lastAct = generatedActivities[generatedActivities.length - 1];
    const firstSense = generatedActivities.find((a) => a.type === "感知") || generatedActivities[0];
    if (lastAct.id !== firstSense.id) {
      generatedEdges.push({
        id: `edge-feedback-${lastAct.id}-${firstSense.id}`,
        sourceId: lastAct.id,
        targetId: firstSense.id,
        type: "信息流",
        payload: "战损评估与态势更新反馈",
        condition: "打击/行动后回传"
      });
    }
  }

  const model = {
    version: 1,
    activities: generatedActivities,
    edges: generatedEdges
  };

  return normalizeOv5Model(model);
}

function isValidModel(model) {
  return Boolean(
    model
    && model.version === 1
    && Array.isArray(model.activities)
    && Array.isArray(model.edges)
  );
}
