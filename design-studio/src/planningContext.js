/** Shared planning-stage context for downstream AI and diagnostics. */

import { conceptMapContextForDownstream, isCurrentConceptMap, normalizeConceptMapReference } from "./conceptMapStore.js";
import {
  conceptForceContextForOv1,
  forceMissionContextForDownstream,
  isForceMissionPlanConfirmed
} from "./forceMissionStore.js";
import { isPhaseActionConceptConfirmed, phaseActionContextForDownstream, normalizePhaseActionConcept } from "./phaseActionStore.js";
import { isConceptGraphicPlanConfirmed } from "./conceptGraphicStore.js";

/**
 * Compact planning package for OV-1 / OV-5 / OODA AI.
 * OV-1 primary skeleton = confirmed concept forces (not combat forces).
 * Supporting context: brief + phase-action + concept-map OV reference.
 */
export function planningAnalysisForDownstream(state = {}) {
  const mapRef = normalizeConceptMapReference(state.conceptMap?.reference);
  const forceReady = isForceMissionPlanConfirmed(state.forceMission, state.forceMissionStorage);
  const phaseReady = isPhaseActionConceptConfirmed(state.phaseAction, state.phaseActionStorage);
  const phase = phaseReady ? normalizePhaseActionConcept(state.phaseAction) : null;

  const activityCandidates = collectActivityCandidates(mapRef, phase);
  const oodaHints = collectOodaHints(phase, mapRef);
  const expectedEffects = collectExpectedEffects(state.brief, phase);

  return {
    "概念兵力骨架": conceptForceContextForOv1(state.forceMission, state.forceMissionStorage),
    "兵力与任务上下文": forceMissionContextForDownstream(state.forceMission, state.forceMissionStorage),
    "阶段与行动上下文": phaseActionContextForDownstream(state.phaseAction, state.phaseActionStorage),
    "概念图上下文": conceptMapContextForDownstream(state.conceptMap, state.conceptMapStorage),
    "规划活动候选": activityCandidates.length ? activityCandidates.join("；") : "未提供已确认活动候选",
    "规划OODA提示": oodaHints.length ? oodaHints.join("；") : "未提供已确认 OODA 提示",
    "规划预期效果": expectedEffects.length ? expectedEffects.join("；") : (state.brief?.expectedEffects || "待明确的研究级效果"),
    "上游骨架说明": forceReady
      ? "OV-1 按研究主体概念兵力装备聚合：同装备合并，分列有上限；节点标签=装备名称；只连关键主节点（主感知/主指挥/主行动/主外部/效果）。次要装备可展示但不强行连线。"
      : "规划未齐备：仅可使用简报与已确认片段；不得假定未确认的研究主体概念兵力装备。"
  };
}

function collectActivityCandidates(mapRef, phase) {
  const fromMap = (mapRef.activities || [])
    .map((item) => [item.title, item.purpose].filter(Boolean).join("："))
    .filter(Boolean);
  const fromPhase = phase
    ? phase.phases.flatMap((item) => {
      const blues = item.blueActions || item.primaryActions || [];
      return blues.slice(0, 3).map((action) => `${item.name}·${action}`);
    })
    : [];
  return uniqueStrings([...fromMap, ...fromPhase], 18);
}

function collectOodaHints(phase, mapRef) {
  const hints = [];
  if (phase?.transitions?.length) {
    hints.push(...phase.transitions.slice(0, 8).map((item) => {
      const cond = item.condition || "条件待定";
      return `转换 ${item.fromPhaseId}->${item.toPhaseId}：${cond}`;
    }));
  }
  if (mapRef.relations?.length) {
    hints.push(...mapRef.relations.slice(0, 6).map((item) => `${item.from} -${item.type}-> ${item.to}`));
  }
  if (mapRef.constraints?.length) {
    hints.push(...mapRef.constraints.slice(0, 4).map((item) => `约束：${item}`));
  }
  return uniqueStrings(hints, 16);
}

function collectExpectedEffects(brief, phase) {
  const fromBrief = String(brief?.expectedEffects || "").trim();
  const fromPhase = phase
    ? phase.phases.flatMap((item) => item.expectedEffects || []).filter(Boolean)
    : [];
  return uniqueStrings([fromBrief, ...fromPhase], 10);
}

function uniqueStrings(values, maxItems) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function planningCoverageStatus(state = {}) {
  const forceReady = isForceMissionPlanConfirmed(state.forceMission, state.forceMissionStorage);
  const phaseReady = isPhaseActionConceptConfirmed(state.phaseAction, state.phaseActionStorage);
  const mapReady = isCurrentConceptMap(state.conceptMap, state.conceptMapStorage);
  const graphicReady = isConceptGraphicPlanConfirmed(state.conceptGraphic, state.conceptGraphicStorage);
  return {
    forceReady,
    phaseReady,
    mapReady,
    graphicReady,
    // 概念图确认后直接进入 OV-1；总体作战概念图不再作为必经步骤。
    allReady: forceReady && phaseReady && mapReady,
    missing: [
      !forceReady && "兵力与任务",
      !phaseReady && "阶段与行动",
      !mapReady && "概念图 OV 参考"
    ].filter(Boolean)
  };
}

/**
 * Legacy projects may only have conceptMap content without the new planning resources.
 * Surface a reviewable migration hint without inventing confirmed planning data.
 */
export function detectLegacyConceptMapOnly(state = {}) {
  const hasMap = Boolean(state.conceptMap?.document?.items?.length || state.conceptMap?.reference?.entities?.length);
  const hasForce = Boolean(state.forceMission?.forces?.length || state.forceMission?.combatForces?.length);
  const hasPhase = Boolean(state.phaseAction?.phases?.length);
  const hasGraphic = Boolean(state.conceptGraphic?.nodes?.length);
  if (!hasMap || (hasForce && hasPhase)) return null;
  return {
    code: "legacy-concept-map-only",
    title: "检测到旧版概念图数据",
    detail: hasGraphic
      ? "项目保留了地图/总体概念内容，但阶段与行动或兵力与任务尚未按新规划链拆分确认。请从简报后先生成阶段与行动，再补兵力，再继续。"
      : "项目仅有旧版概念图快照，尚未建立阶段与行动、兵力与任务规划。请从「阶段与行动」开始 AI 生成并逐步确认，勿把旧图直接当作已完成规划。",
    missing: [
      !hasPhase && "阶段与行动",
      !hasForce && "兵力与任务"
    ].filter(Boolean)
  };
}

export function renderPlanningMigrationBanner(state = {}) {
  const legacy = detectLegacyConceptMapOnly(state);
  if (!legacy) return "";
  return `<p class="planning-banner planning-migration-banner" role="status"><b>${escapeText(legacy.title)}</b> ${escapeText(legacy.detail)}${legacy.missing.length ? ` 待补：${escapeText(legacy.missing.join("、"))}。` : ""}</p>`;
}

function escapeText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
