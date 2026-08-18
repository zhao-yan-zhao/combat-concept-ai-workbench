import { normalizeDodafOv1c, normalizeDodafOv7 } from "../../shared/dodaf/products.js";

const REVIEW_STATUSES = new Set(["pending_review", "confirmed", "stale", "conflict"]);
const JUDGMENTS = new Set(["pending", "accepted", "rejected"]);
const SEMANTICS = new Set(["triggers", "executes", "ends"]);

export function buildOv1cModel(state = {}) {
  const existing = normalizeDodafOv1c(state.ov1c || { mappings: [] });
  const tasks = listTasks(state);
  const taskIds = new Set(tasks.map((item) => item.id));
  const activityIds = new Set(listActivities(state).map((item) => item.id));
  const existingByTask = new Map(existing.mappings.map((item) => [item.taskRef, item]));
  const mappings = tasks.map((task) => existingByTask.get(task.id) || {
    id: `task-activity-${safeId(task.id)}`,
    taskRef: task.id,
    activityRefs: [],
    coverageStatus: "unmapped",
    judgment: "pending",
    status: "pending_review",
    sourceRefs: [{ resource: "forceMissionPlan", objectId: task.id }]
  });
  existing.mappings.forEach((item) => { if (!taskIds.has(item.taskRef)) mappings.push({ ...item, status: "conflict", coverageStatus: "conflict" }); });
  const mappedActivities = new Set();
  const orphanTaskRefs = [];
  const orphanActivityRefs = [];
  mappings.forEach((item) => {
    if (!taskIds.has(item.taskRef)) orphanTaskRefs.push(item.taskRef);
    item.activityRefs.forEach((ref) => activityIds.has(ref) ? mappedActivities.add(ref) : orphanActivityRefs.push(ref));
  });
  const unmappedTaskRefs = tasks.filter((task) => !mappings.some((item) => item.taskRef === task.id && item.judgment !== "rejected" && item.activityRefs.some((ref) => activityIds.has(ref)))).map((item) => item.id);
  const uncoveredActivityRefs = [...activityIds].filter((ref) => !mappedActivities.has(ref));
  return normalizeDodafOv1c({
    ...existing,
    mappings: mappings.map((item) => ({
      ...item,
      status: hasBrokenOv1cReference(item, taskIds, activityIds) ? "conflict" : statusFromJudgment(item),
      coverageStatus: hasBrokenOv1cReference(item, taskIds, activityIds) ? "conflict" : item.activityRefs.some((ref) => activityIds.has(ref)) ? "covered" : "unmapped"
    })),
    coverage: { unmappedTaskRefs, uncoveredActivityRefs, orphanTaskRefs, orphanActivityRefs },
    diagnostics: buildOv1cDiagnostics({ tasks, activities: [...activityIds], unmappedTaskRefs, uncoveredActivityRefs, orphanTaskRefs, orphanActivityRefs })
  });
}

export function buildOv7Model(state = {}) {
  const existing = normalizeDodafOv7(state.ov7 || { mappings: [] });
  const sources = listStateSources(state);
  const sourceKeys = new Set(sources.map((item) => `${item.subjectType}:${item.sourceRef}`));
  const activityIds = new Set(listActivities(state).map((item) => item.id));
  const existingBySource = new Map(existing.mappings.map((item) => [`${item.subjectType}:${item.sourceRef}`, item]));
  const mappings = sources.map((source) => existingBySource.get(`${source.subjectType}:${source.sourceRef}`) || {
    id: `state-activity-${safeId(`${source.subjectType}-${source.sourceRef}`)}`,
    subjectType: source.subjectType,
    sourceRef: source.sourceRef,
    activityRefs: [],
    semantic: source.subjectType === "transition" ? "triggers" : source.kind === "final" ? "ends" : "executes",
    judgment: "pending",
    status: "pending_review",
    sourceRefs: [{ resource: "ov6b", objectId: source.sourceRef }]
  });
  existing.mappings.forEach((item) => { if (!sourceKeys.has(`${item.subjectType}:${item.sourceRef}`)) mappings.push({ ...item, status: "conflict" }); });
  const mappedActivities = new Set();
  const orphanSourceRefs = [];
  const orphanActivityRefs = [];
  mappings.forEach((item) => {
    if (!sourceKeys.has(`${item.subjectType}:${item.sourceRef}`)) orphanSourceRefs.push(item.sourceRef);
    item.activityRefs.forEach((ref) => activityIds.has(ref) ? mappedActivities.add(ref) : orphanActivityRefs.push(ref));
  });
  const unmappedSourceRefs = sources.filter((source) => !mappings.some((item) => item.subjectType === source.subjectType && item.sourceRef === source.sourceRef && item.judgment !== "rejected" && item.activityRefs.some((ref) => activityIds.has(ref)))).map((item) => item.sourceRef);
  const uncoveredActivityRefs = [...activityIds].filter((ref) => !mappedActivities.has(ref));
  return normalizeDodafOv7({
    ...existing,
    mappings: mappings.map((item) => ({
      ...item,
      status: hasBrokenOv7Reference(item, sourceKeys, activityIds) ? "conflict" : statusFromJudgment(item)
    })),
    coverage: { unmappedSourceRefs, uncoveredActivityRefs, orphanSourceRefs, orphanActivityRefs },
    diagnostics: buildOv7Diagnostics({ sources, activities: [...activityIds], unmappedSourceRefs, uncoveredActivityRefs, orphanSourceRefs, orphanActivityRefs })
  });
}

export function updateMappingProduct(model, resource, mappingId, patch = {}) {
  const normalize = resource === "ov7" ? normalizeDodafOv7 : normalizeDodafOv1c;
  const next = structuredClone(model || {});
  const item = (next.mappings || []).find((entry) => entry.id === mappingId);
  if (!item) return normalize(next);
  if (patch.activityRefs !== undefined) item.activityRefs = uniqueStrings(patch.activityRefs);
  if (patch.note !== undefined) item.note = String(patch.note || "").trim();
  if (patch.semantic !== undefined && SEMANTICS.has(patch.semantic)) item.semantic = patch.semantic;
  if (patch.judgment !== undefined && JUDGMENTS.has(patch.judgment)) {
    item.judgment = patch.judgment;
    item.status = patch.judgment === "accepted" && item.activityRefs.length ? "confirmed" : patch.judgment === "rejected" ? "confirmed" : "pending_review";
    item.confirmedAt = item.status === "confirmed" ? item.confirmedAt || new Date().toISOString() : "";
  }
  if (patch.status !== undefined && REVIEW_STATUSES.has(patch.status)) item.status = patch.status;
  next.derivedFrom = null;
  return normalize(next);
}

export function listStateSources(state = {}) {
  const machines = Array.isArray(state.ov6b?.stateMachines) ? state.ov6b.stateMachines : [];
  const result = [];
  machines.forEach((machine) => {
    (machine.states || []).forEach((item) => result.push({
      subjectType: "state",
      sourceRef: String(item.id || ""),
      label: item.name || item.label || item.id,
      kind: item.kind || "normal",
      machineRef: machine.id,
      machineLabel: machine.name || machine.id
    }));
    (machine.transitions || []).forEach((item) => result.push({
      subjectType: "transition",
      sourceRef: String(item.id || ""),
      label: item.condition || item.name || item.id,
      kind: "transition",
      machineRef: machine.id,
      machineLabel: machine.name || machine.id
    }));
  });
  return result.filter((item, index, items) => item.sourceRef && items.findIndex((candidate) => candidate.subjectType === item.subjectType && candidate.sourceRef === item.sourceRef) === index);
}

function buildOv1cDiagnostics(input) {
  return [
    diagnostic("task-coverage", "任务覆盖", input.unmappedTaskRefs.length ? "review" : input.tasks.length ? "ready" : "pending", input.tasks.length ? `${input.tasks.length - input.unmappedTaskRefs.length}/${input.tasks.length} 个任务已有活动承接` : "尚无可映射任务"),
    diagnostic("activity-coverage", "活动覆盖", input.uncoveredActivityRefs.length ? "review" : input.activities.length ? "ready" : "pending", input.activities.length ? `${input.activities.length - input.uncoveredActivityRefs.length}/${input.activities.length} 个活动已关联任务` : "尚无可映射活动"),
    diagnostic("broken-references", "引用完整性", input.orphanTaskRefs.length || input.orphanActivityRefs.length ? "conflict" : "ready", input.orphanTaskRefs.length || input.orphanActivityRefs.length ? `${input.orphanTaskRefs.length} 个任务引用、${input.orphanActivityRefs.length} 个活动引用失效` : "任务与活动引用均可解析")
  ];
}

function buildOv7Diagnostics(input) {
  return [
    diagnostic("state-coverage", "状态/转换覆盖", input.unmappedSourceRefs.length ? "review" : input.sources.length ? "ready" : "pending", input.sources.length ? `${input.sources.length - input.unmappedSourceRefs.length}/${input.sources.length} 个状态或转换已有活动承接` : "尚无可映射状态或转换"),
    diagnostic("activity-coverage", "活动状态来源", input.uncoveredActivityRefs.length ? "review" : input.activities.length ? "ready" : "pending", input.activities.length ? `${input.activities.length - input.uncoveredActivityRefs.length}/${input.activities.length} 个活动已有状态来源` : "尚无可映射活动"),
    diagnostic("broken-references", "引用完整性", input.orphanSourceRefs.length || input.orphanActivityRefs.length ? "conflict" : "ready", input.orphanSourceRefs.length || input.orphanActivityRefs.length ? `${input.orphanSourceRefs.length} 个状态/转换引用、${input.orphanActivityRefs.length} 个活动引用失效` : "状态、转换与活动引用均可解析")
  ];
}

function listTasks(state) {
  return (Array.isArray(state.forceMission?.tasks) ? state.forceMission.tasks : []).map((item) => ({ id: String(item.id || ""), label: item.name || item.id })).filter((item) => item.id);
}

function listActivities(state) {
  return (Array.isArray(state.ov5?.activities) ? state.ov5.activities : []).map((item) => ({ id: String(item.id || ""), label: item.title || item.id })).filter((item) => item.id);
}

function diagnostic(id, label, state, detail) {
  return { id, label, state, statusLabel: ({ ready: "已满足", review: "需复核", pending: "未完成", conflict: "有冲突" })[state] || state, detail };
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 120);
}

function safeId(value) {
  return String(value || "mapping").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "mapping";
}

function hasBrokenOv1cReference(item, taskIds, activityIds) {
  return !taskIds.has(item.taskRef) || item.activityRefs.some((ref) => !activityIds.has(ref));
}

function hasBrokenOv7Reference(item, sourceKeys, activityIds) {
  return !sourceKeys.has(`${item.subjectType}:${item.sourceRef}`) || item.activityRefs.some((ref) => !activityIds.has(ref));
}

function statusFromJudgment(item) {
  if (item.status === "stale") return "stale";
  if (item.judgment === "accepted" && item.activityRefs.length) return "confirmed";
  if (item.judgment === "rejected") return "confirmed";
  return "pending_review";
}
