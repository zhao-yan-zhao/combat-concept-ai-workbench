import { normalizeDodafOv1b } from "../../shared/dodaf/products.js";

export function buildOv1bModel(state = {}) {
  const existing = state.ov1b && typeof state.ov1b === "object" ? state.ov1b : {};
  return normalizeDodafOv1b({ ...existing, derivedFrom: existing.derivedFrom || { mode: "seeded", sources: ["forceMissionPlan.tasks"], generatedAt: new Date().toISOString(), note: "task-organization-reference-only" } });
}

export function addOv1bTaskGroup(model, { name = "新任务组", dimension = "custom", taskRefs = [], rationale = "", coordination = "" } = {}) {
  const next = structuredClone(model || {}); next.taskGroups = Array.isArray(next.taskGroups) ? next.taskGroups : [];
  next.taskGroups.push({ id: `task-group-${Date.now().toString(36)}`, name, dimension, taskRefs, rationale, coordination, status: "pending_review" });
  next.status = "pending_review"; next.derivedFrom = null; return normalizeDodafOv1b(next);
}

export function updateOv1bTaskGroup(model, id, patch = {}) {
  const next = structuredClone(model || {}); const item = (next.taskGroups || []).find((entry) => entry.id === id);
  if (!item) return normalizeDodafOv1b(next);
  for (const key of ["name", "dimension", "rationale", "coordination", "phaseRef"]) if (patch[key] !== undefined) item[key] = String(patch[key] || "").trim();
  if (patch.steps !== undefined) item.steps = Array.isArray(patch.steps) ? patch.steps : [];
  if (patch.taskRefs !== undefined) item.taskRefs = [...new Set((patch.taskRefs || []).map(String).filter(Boolean))];
  if (patch.status !== undefined) item.status = ["pending_review", "confirmed", "stale", "conflict"].includes(patch.status) ? patch.status : "pending_review";
  item.confirmedAt = item.status === "confirmed" ? item.confirmedAt || new Date().toISOString() : "";
  next.status = next.taskGroups?.length && next.taskGroups.every((entry) => entry.status === "confirmed") ? "confirmed" : "pending_review"; next.derivedFrom = null; return normalizeDodafOv1b(next);
}

export function setOv1bStepMode(model, groupId, stepIndex, mode) {
  const next = structuredClone(model || {});
  const group = (next.taskGroups || []).find((entry) => entry.id === groupId);
  if (!group || !Array.isArray(group.steps)) return normalizeDodafOv1b(next);
  const step = group.steps.find((st) => Number(st.stepIndex) === Number(stepIndex));
  if (step) {
    step.mode = ["sequential", "parallel", "trigger"].includes(mode) ? mode : "sequential";
  }
  next.derivedFrom = null;
  return normalizeDodafOv1b(next);
}

export function moveOv1bTaskStep(model, groupId, taskId, delta) {
  const next = structuredClone(model || {});
  const group = (next.taskGroups || []).find((entry) => entry.id === groupId);
  if (!group || !Array.isArray(group.steps) || !group.steps.length) return normalizeDodafOv1b(next);
  const currentStepIdx = group.steps.findIndex((st) => (st.taskRefs || []).includes(taskId));
  if (currentStepIdx < 0) return normalizeDodafOv1b(next);
  const targetStepIdx = currentStepIdx + Number(delta);
  if (targetStepIdx < 0 || targetStepIdx >= group.steps.length) return normalizeDodafOv1b(next);

  // 从原步骤移除
  group.steps[currentStepIdx].taskRefs = group.steps[currentStepIdx].taskRefs.filter((r) => r !== taskId);
  // 加入目标步骤
  group.steps[targetStepIdx].taskRefs.push(taskId);

  // 清理空步骤并重排 stepIndex
  group.steps = group.steps.filter((st) => (st.taskRefs || []).length > 0).map((st, idx) => ({ ...st, stepIndex: idx + 1 }));
  delete group.taskRefs; // 由 normalize 根据 steps 自动重排
  next.derivedFrom = null;
  return normalizeDodafOv1b(next);
}

export function toggleOv1bTaskStepDependency(model, groupId, stepIndex, depTaskId) {
  const next = structuredClone(model || {});
  const group = (next.taskGroups || []).find((entry) => entry.id === groupId);
  if (!group || !Array.isArray(group.steps)) return normalizeDodafOv1b(next);
  const step = group.steps.find((st) => Number(st.stepIndex) === Number(stepIndex));
  if (!step) return normalizeDodafOv1b(next);
  const deps = new Set(step.dependsOn || []);
  if (deps.has(depTaskId)) {
    deps.delete(depTaskId);
  } else {
    deps.add(depTaskId);
  }
  step.dependsOn = [...deps];
  next.derivedFrom = null;
  return normalizeDodafOv1b(next);
}

export function removeOv1bTaskGroup(model, id) {
  const next = structuredClone(model || {}); next.taskGroups = (next.taskGroups || []).filter((item) => item.id !== id);
  next.status = next.taskGroups.length && next.taskGroups.every((item) => item.status === "confirmed") ? "confirmed" : "draft"; next.derivedFrom = null; return normalizeDodafOv1b(next);
}

// Transitional aliases while the controller migrates from pair actions to group actions.
export const addOv1bDecomposition = (model, input = {}) => addOv1bTaskGroup(model, { name: input.name || "兼容任务组", taskRefs: [input.parentTaskRef, input.childTaskRef].filter(Boolean), rationale: input.rationale });
export const updateOv1bDecomposition = updateOv1bTaskGroup;
export const removeOv1bDecomposition = removeOv1bTaskGroup;
