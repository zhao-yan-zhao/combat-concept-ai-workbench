import { inspectOv1Model } from "./ov1Diagnostics.js";
import { buildOv2Model } from "./ov2Builder.js";
import { buildOv3Model } from "./ov3Builder.js";
import { buildOv4Model } from "./ov4Builder.js";
import { buildOv5aModel, buildOv6aModel, buildOv6bModel } from "./dodafOperationalBuilders.js";
import { buildOv6cModel } from "./ov6cBuilder.js";
import { countUnmappedOv5Activities } from "./ov5Ov1Linker.js";
import { inspectMappingQuality } from "./ov5MappingQuality.js";
import { getOodaFreshness } from "./oodaStore.js";
import { getScenarioFreshness } from "./scenarioStore.js";
import { isValidationStale } from "./validationStore.js";
import { resolveDodafProduct } from "./dodafProductStore.js";
import { inspectArchitectureConsistency } from "../../shared/dodaf/consistency.js";
import { detectLegacyConceptMapOnly, planningCoverageStatus } from "./planningContext.js";
import { inspectPhaseAgainstOv6 } from "./ov6Workbench.js";
import { buildOv1cModel, buildOv7Model } from "./mappingProductStore.js";

const MAX_ISSUES = 64;
const FILTER_GROUPS = ["mapping", "validation", "concept", "contract", "sequence"];

/**
 * Aggregate structure-review diagnostics into actionable, prioritised issues
 * that jump back to the editable source models.
 */
export function buildStructureReview(state = {}) {
  const ov1 = state.ov1 || {};
  const ov5 = state.ov5 || {};
  const ooda = state.ooda || {};
  const scenario = state.scenario || {};
  const validationResult = state.validationResult || null;
  const ov1Inspect = inspectOv1Model(ov1);
  const ov2 = resolveProductOrBuild(state, "ov2", () => buildOv2Model({ forceMission: state.forceMission, ov1, ov5, ooda, scenario }));
  const ov3 = resolveProductOrBuild(state, "ov3", () => buildOv3Model({ ov2, scenario }));
  const ov4 = resolveProductOrBuild(state, "ov4", () => buildOv4Model({ forceMission: state.forceMission, ov1, ov5, ooda, scenario }));
  const ov5a = resolveProductOrBuild(state, "ov5a", () => buildOv5aModel({ ov5 }));
  const ov6a = resolveProductOrBuild(state, "ov6a", () => buildOv6aModel({ ov5 }));
  const ov6b = resolveProductOrBuild(state, "ov6b", () => buildOv6bModel({ ooda }));
  const ov6c = resolveProductOrBuild(state, "ov6c", () => buildOv6cModel({ ooda, scenario }));
  const ov1c = buildOv1cModel({ ...state, ov1c: resolveProductOrBuild(state, "ov1c", () => ({ mappings: [] })) });
  const ov7 = buildOv7Model({ ...state, ov7: resolveProductOrBuild(state, "ov7", () => ({ mappings: [] })) });
  const consistency = inspectArchitectureConsistency({
    ov1,
    ov5,
    ov2: state.ov2 || ov2,
    ov3: state.ov3 || ov3,
    ov4: state.ov4 || ov4,
    ov5a: state.ov5a || ov5a,
    ov6a: state.ov6a || ov6a,
    ov6b: state.ov6b || ov6b,
    ov6c: state.ov6c || ov6c,
    architecture: state.architecture || null
  });

  const activityById = new Map((ov5.activities || []).map((activity) => [String(activity.id), activity]));
  const nodeById = new Map((ov1.nodes || []).map((node) => [String(node.id), node]));
  const issues = [];

  pushConsistencyIssues(issues, consistency);
  pushPlanningCoverageIssues(issues, state);
  pushOv1Issues(issues, ov1Inspect, nodeById);
  pushUnmappedActivities(issues, ov2.unresolved?.unmappedActivityIds || [], activityById, "ov2");
  pushUnmappedActivities(issues, ov4.unresolved?.unmappedActivityIds || [], activityById, "ov4");
  pushUnassignedRoles(issues, ov4.unresolved?.unassignedRoleIds || [], nodeById);
  pushBrokenEdges(issues, ov2.unresolved?.brokenEdgeIds || [], "ov2", "跨节点交换", "若干 OV-5 关系无法映射为 OV-1 节点间交换，通常因活动缺少来源节点。");
  pushBrokenEdges(issues, ov4.unresolved?.brokenEdgeIds || [], "ov4", "跨角色关系", "若干 OV-5 关系无法映射为抽象责任关系。");
  pushContractIssues(issues, ov3.exchanges || []);
  pushDiagnosticIssues(issues, ov5a.diagnostics, "ov5a", "ov5", "hierarchy");
  pushDiagnosticIssues(issues, ov6a.diagnostics, "ov6a", "ov5", "rules");
  pushDiagnosticIssues(issues, ov6b.diagnostics, "ov6b", "ooda", "states");
  pushOv6cIssues(issues, ov6c);
  pushDiagnosticIssues(issues, ov1c.diagnostics, "ov1c", "ov1c", "mapping");
  pushDiagnosticIssues(issues, ov7.diagnostics, "ov7", "ov7", "mapping");
  pushPhaseOv6ReverseIssues(issues, state);
  const validationStale = Boolean(validationResult && isValidationStale(validationResult, ov5, ooda, scenario, ov1));
  pushValidationIssues(issues, validationResult, ov5, ooda, scenario, validationStale);
  const oodaFreshness = getOodaFreshness(ooda, ov5);
  if (oodaFreshness.stale) {
    issues.unshift(issue({
      id: "ooda-stale-vs-ov5",
      code: "ooda-stale",
      group: "sequence",
      severity: "review",
      sourceView: "ooda",
      title: "研究循环相对活动模型已过期",
      detail: oodaFreshness.reason || "OV-5 活动或关系已变更，当前研究辅助循环可能不再匹配，建议从活动模型重新派生。",
      targetView: "ooda",
      action: "derive-ooda",
      stale: true
    }));
  }

  const scenarioFreshness = getScenarioFreshness(scenario, ov5, ooda);
  if (scenario && scenarioFreshness.stale) {
    issues.unshift(issue({
      id: "scenario-stale-vs-upstream",
      code: "scenario-stale",
      group: "sequence",
      severity: "review",
      sourceView: "scenario",
      title: "想定相对活动模型/研究循环已过期",
      detail: scenarioFreshness.reason || "上游活动或行为循环已变更，当前想定实体与时间线仅供参考，建议重新生成。",
      targetView: "scenario",
      action: "generate-scenario",
      stale: true
    }));
  }

  const unmappedCount = countUnmappedOv5Activities(ov5, ov1);
  if (unmappedCount) {
    issues.unshift(issue({
      id: "summary-unmapped-activities",
      code: "activity-unmapped-summary",
      group: "mapping",
      severity: "review",
      sourceView: "structure-review",
      title: "活动未挂接 OV-1",
      detail: `${unmappedCount} 个 OV-5 活动没有有效的 sourceOv1NodeIds。可一键按概念节点类型补挂，再人工复核。`,
      targetView: "ov5",
      action: "attach-ov1-sources"
    }));
  }

  const mappingQuality = inspectMappingQuality(ov5, ov1);
  pushMappingQualityIssues(issues, mappingQuality);

  const ranked = rankIssues(issues).slice(0, MAX_ISSUES);
  const validationCount = ranked.filter((item) => item.group === "validation").length;
  const summary = {
    total: ranked.length,
    alert: ranked.filter((item) => item.severity === "alert").length,
    review: ranked.filter((item) => item.severity === "review" || item.severity === "alert").length,
    pending: ranked.filter((item) => item.severity === "pending").length,
    mapping: ranked.filter((item) => item.group === "mapping").length,
    validation: validationCount,
    contract: ranked.filter((item) => item.group === "contract").length,
    concept: ranked.filter((item) => item.group === "concept").length,
    sequence: ranked.filter((item) => item.group === "sequence").length,
    unmappedActivityCount: unmappedCount,
    planningMissingCount: planningCoverageStatus(state).missing.length,
    planningLegacy: Boolean(detectLegacyConceptMapOnly(state)),
    mappingQualityCanApply: Boolean(mappingQuality.canApply),
    blankIoCount: mappingQuality.blankIoCount,
    flatHierarchy: Boolean(mappingQuality.flatHierarchy),
    edgeContractGaps: mappingQuality.edgeContractGaps,
    consistencyScore: consistency.score,
    consistencyIssueCount: consistency.issueCount,
    consistencyEntityCount: consistency.summary.entityCount,
    ov1NodeCount: ov1.nodes?.length || 0,
    ov5ActivityCount: ov5.activities?.length || 0,
    ov5EdgeCount: ov5.edges?.length || 0,
    validationRan: Boolean(validationResult?.issues),
    validationStale,
    validationIssueCount: Array.isArray(validationResult?.issues) ? validationResult.issues.length : 0,
    validationGeneratedAt: validationResult?.generatedAt || "",
    validationStaleReason: validationStale ? (validationResult?.staleReason || "上游模型已变更，验证结果仅供参考。") : "",
    oodaStale: Boolean(oodaFreshness.stale),
    oodaStaleReason: oodaFreshness.stale ? oodaFreshness.reason : "",
    scenarioStale: Boolean(scenario && scenarioFreshness.stale),
    scenarioStaleReason: scenario && scenarioFreshness.stale ? scenarioFreshness.reason : ""
  };

  return {
    kind: "structure-review-workbench",
    generatedAt: new Date().toISOString(),
    summary,
    issues: ranked,
    groups: groupIssues(ranked),
    derived: {
      ov2: summarizeDiagnostics(ov2.diagnostics),
      ov3: summarizeDiagnostics(ov3.diagnostics),
      ov4: summarizeDiagnostics(ov4.diagnostics),
      ov5a: summarizeDiagnostics(ov5a.diagnostics),
      ov6a: summarizeDiagnostics(ov6a.diagnostics),
      ov6b: summarizeDiagnostics(ov6b.diagnostics),
      ov6c: summarizeDiagnostics(ov6c.diagnostics),
      ov1c: summarizeDiagnostics(ov1c.diagnostics),
      ov7: summarizeDiagnostics(ov7.diagnostics)
    },
    consistency,
    validation: {
      ran: summary.validationRan,
      stale: validationStale,
      staleReason: summary.validationStaleReason,
      issueCount: summary.validationIssueCount,
      generatedAt: summary.validationGeneratedAt,
      scores: Array.isArray(validationResult?.scores) ? validationResult.scores.slice(0, 8) : []
    }
  };
}

/** Apply severity/group filters without mutating the full issue inventory. */
export function applyStructureReviewFilter(model, filter = {}) {
  const severity = normalizeSeverityFilter(filter.severity);
  const group = normalizeGroupFilter(filter.group);
  let issues = Array.isArray(model?.issues) ? model.issues : [];
  if (severity === "alert") issues = issues.filter((item) => item.severity === "alert");
  else if (severity === "review") issues = issues.filter((item) => item.severity === "review" || item.severity === "alert");
  else if (severity === "pending") issues = issues.filter((item) => item.severity === "pending");
  if (group !== "all") issues = issues.filter((item) => item.group === group);
  return {
    ...model,
    filter: { severity, group },
    filteredIssues: issues,
    filteredGroups: groupIssues(issues),
    filterEmpty: Boolean(model?.issues?.length) && !issues.length
  };
}

export function defaultStructureReviewFilter() {
  return { severity: "all", group: "all" };
}

function normalizeSeverityFilter(value) {
  return ["all", "alert", "review", "pending"].includes(value) ? value : "all";
}

function normalizeGroupFilter(value) {
  return value === "all" || FILTER_GROUPS.includes(value) ? value : "all";
}

function pushPlanningCoverageIssues(issues, state) {
  const coverage = planningCoverageStatus(state);
  const legacy = detectLegacyConceptMapOnly(state);
  const forcePlan = state.forceMission || {};
  const combatForces = Array.isArray(forcePlan.combatForces) ? forcePlan.combatForces : [];
  const conceptForces = Array.isArray(forcePlan.forces) ? forcePlan.forces : [];
  if (conceptForces.length && !combatForces.length) {
    issues.unshift(issue({
      id: "planning-missing-combat-forces",
      code: "planning-combat-forces",
      group: "sequence",
      severity: "review",
      sourceView: "force-mission",
      title: "缺少作战兵力层",
      detail: "已有概念兵力但尚无作战兵力。建议在「兵力与任务」点「生成作战兵力」后再进入概念图/OV。",
      targetView: "force-mission",
      action: "generate-combat-forces"
    }));
  } else if (combatForces.length) {
    const bare = combatForces.filter((force) => !(force.platforms || []).length).length;
    if (bare > 0) {
      issues.push(issue({
        id: "planning-combat-without-platforms",
        code: "planning-combat-platforms",
        group: "traceability",
        severity: "info",
        sourceView: "force-mission",
        title: "作战兵力缺少平台引用",
        detail: `${bare} 个作战兵力尚未挂接 CMO 平台类型参考。可点「应用」写入推荐平台，或在作战兵力卡片内手工检索（研究级引用，非真实编制）。`,
        targetView: "force-mission",
        action: "apply-platform-recommendations"
      }));
    }
  }
  if (legacy) {
    issues.unshift(issue({
      id: "planning-legacy-concept-map",
      code: "planning-legacy",
      group: "sequence",
      severity: "review",
      sourceView: "force-mission",
      title: legacy.title,
      detail: `${legacy.detail} 待补：${legacy.missing.join("、") || "规划步骤"}。`,
      targetView: "force-mission",
      action: "generate-concept-forces"
    }));
  }
  if (!coverage.allReady && !legacy) {
    issues.unshift(issue({
      id: "planning-coverage-incomplete",
      code: "planning-coverage",
      group: "sequence",
      severity: "review",
      sourceView: coverage.missing[0] === "概念图 OV 参考"
        ? "concept-map"
        : coverage.missing[0] === "阶段与行动"
          ? "phase-action"
          : "force-mission",
      title: "作战概念规划未完成",
      detail: `正式建模前建议完成规划确认：${coverage.missing.join("、")}。`,
      targetView: coverage.missing[0] === "概念图 OV 参考"
        ? "concept-map"
        : coverage.missing[0] === "阶段与行动"
          ? "phase-action"
          : "force-mission"
    }));
  }
}

function pushOv1Issues(issues, inspect, nodeById) {
  (inspect.summary?.isolatedIds || []).forEach((id) => {
    const node = nodeById.get(String(id));
    issues.push(issue({
      id: `ov1-isolated-${id}`,
      code: "ov1-isolated",
      group: "concept",
      severity: "review",
      sourceView: "ov1",
      title: "孤立概念节点",
      detail: `「${labelOf(node, id)}」未参与任何 OV-1 关系。`,
      targetView: "ov1",
      targetKind: "ov1",
      targetId: String(id)
    }));
  });
  (inspect.summary?.incompleteSemanticIds || []).slice(0, 12).forEach((id) => {
    const node = nodeById.get(String(id));
    issues.push(issue({
      id: `ov1-semantic-${id}`,
      code: "ov1-semantic",
      group: "concept",
      severity: "review",
      sourceView: "ov1",
      title: "节点语义不完整",
      detail: `「${labelOf(node, id)}」缺少类别、职责、输入、输出、约束或预期效果等审阅字段。`,
      targetView: "ov1",
      targetKind: "ov1",
      targetId: String(id)
    }));
  });
  (inspect.checks || []).forEach((check) => {
    if (check.state === "ready" || ["isolated", "semantics"].includes(check.id)) return;
    issues.push(issue({
      id: `ov1-check-${check.id}`,
      code: `ov1-${check.id}`,
      group: "concept",
      severity: check.state === "attention" ? "pending" : "review",
      sourceView: "ov1",
      title: check.label,
      detail: check.detail,
      targetView: "ov1"
    }));
  });
}

function pushUnmappedActivities(issues, ids, activityById, sourceView) {
  unique(ids).forEach((id) => {
    const activity = activityById.get(String(id));
    issues.push(issue({
      id: `${sourceView}-unmapped-${id}`,
      code: "activity-unmapped",
      group: "mapping",
      severity: "review",
      sourceView,
      title: "活动未映射 OV-1",
      detail: `活动「${labelOf(activity, id)}」缺少有效的来源概念节点，派生交换与责任覆盖会不完整。`,
      targetView: "ov5",
      targetKind: "activity",
      targetId: String(id)
    }));
  });
}

function pushUnassignedRoles(issues, ids, nodeById) {
  unique(ids).forEach((id) => {
    const node = nodeById.get(String(id));
    issues.push(issue({
      id: `ov4-role-${id}`,
      code: "role-unassigned",
      group: "mapping",
      severity: "review",
      sourceView: "ov4",
      title: "责任角色无活动",
      detail: `概念节点「${labelOf(node, id)}」尚未被任何 OV-5 活动引用。请在 OV-5 活动中补充来源节点，或回到 OV-1 确认该节点是否仍需要。`,
      targetView: "ov5",
      targetKind: "",
      targetId: ""
    }));
  });
}

function pushBrokenEdges(issues, ids, sourceView, title, detail) {
  if (!ids?.length) return;
  issues.push(issue({
    id: `${sourceView}-broken-edges`,
    code: "edge-unresolved",
    group: "mapping",
    severity: "review",
    sourceView,
    title,
    detail: `${ids.length} 条关系待处理。${detail}`,
    targetView: "ov5"
  }));
}

function pushContractIssues(issues, exchanges) {
  exchanges.filter((exchange) => exchange.compatibility !== "ready").slice(0, 20).forEach((exchange) => {
    issues.push(issue({
      id: `ov3-${exchange.id}`,
      code: "contract-mismatch",
      group: "contract",
      severity: exchange.compatibility === "pending" ? "pending" : "review",
      sourceView: "ov3",
      title: exchange.compatibility === "pending" ? "交换契约缺失" : "输入输出待映射",
      detail: `「${exchange.sourceActivityTitle}」→「${exchange.targetActivityTitle}」：输出「${exchange.output || "未定义"}」/ 输入「${exchange.input || "未定义"}」。可先「补全映射质量」对齐空字段，再人工润色语义。`,
      targetView: "ov5",
      targetKind: "activity",
      targetId: String(exchange.sourceActivityId),
      action: exchange.compatibility === "pending" ? "apply-mapping-quality" : ""
    }));
  });
}

function pushMappingQualityIssues(issues, quality = {}) {
  if (quality.blankIoCount) {
    issues.unshift(issue({
      id: "mapping-blank-io",
      code: "activity-blank-io",
      group: "contract",
      severity: "pending",
      sourceView: "ov5",
      title: "活动输入/输出未定义",
      detail: `${quality.blankIoCount} 个活动仍使用空值或「待定义」。可从已挂接的 OV-1 节点与相邻活动边补全空字段（不覆盖已有正文）。`,
      targetView: "ov5",
      action: "apply-mapping-quality"
    }));
  }
  if (quality.flatHierarchy && quality.parentSuggestionCount) {
    issues.unshift(issue({
      id: "mapping-flat-hierarchy",
      code: "activity-flat-hierarchy",
      group: "mapping",
      severity: "review",
      sourceView: "ov5a",
      title: "活动分解层级过平",
      detail: `共 ${quality.activityCount} 个活动均无父级，OV-5a 层级表只能并列显示。可按活动类型建议浅层分解（最早类型为根），保存后请人工复核。`,
      targetView: "ov5",
      action: "apply-mapping-quality"
    }));
  }
  if (quality.edgeContractGaps && !quality.blankIoCount) {
    issues.unshift(issue({
      id: "mapping-edge-contract-gaps",
      code: "edge-contract-gap",
      group: "contract",
      severity: "pending",
      sourceView: "ov3",
      title: "边契约可补全",
      detail: `${quality.edgeContractGaps} 条 OV-5 关系的源输出或目标输入仍空，可沿边对齐相邻活动字段。`,
      targetView: "ov5",
      action: "apply-mapping-quality"
    }));
  }
}

function pushDiagnosticIssues(issues, diagnostics, sourceView, targetView, group) {
  (diagnostics || []).forEach((item) => {
    if (item.state === "ready") return;
    issues.push(issue({
      id: `${sourceView}-${item.id}`,
      code: `${sourceView}-${item.id}`,
      group: group === "rules" ? "contract" : group === "states" ? "sequence" : "mapping",
      severity: item.state === "pending" ? "pending" : item.state === "conflict" ? "alert" : "review",
      sourceView,
      title: item.label,
      detail: item.detail,
      targetView
    }));
  });
}

function resolveProductOrBuild(state, resourceKey, build) {
  try {
    const resolved = resolveDodafProduct(state, resourceKey);
    if (resolved?.model && resolved.source === "persisted") return resolved.model;
  } catch {
    // fall through to builder
  }
  return build();
}

function pushConsistencyIssues(issues, consistency) {
  (consistency?.issues || []).slice(0, 24).forEach((item) => {
    issues.push(issue({
      id: item.id,
      code: item.code || "dm2-consistency",
      group: item.group || "contract",
      severity: item.severity || "review",
      sourceView: item.sourceView || "structure-review",
      title: item.title,
      detail: item.detail,
      targetView: item.targetView || "structure-review",
      targetKind: item.entityId ? "entity" : "",
      targetId: item.entityId || ""
    }));
  });
}

function pushPhaseOv6ReverseIssues(issues, state) {
  const findings = inspectPhaseAgainstOv6(state);
  findings.forEach((item) => {
    issues.push(issue({
      id: item.id,
      code: item.code,
      group: item.group || "sequence",
      severity: item.severity || "review",
      sourceView: item.sourceView || "phase-action",
      title: item.title,
      detail: item.detail,
      targetView: item.targetView || "phase-action",
      action: item.action || ""
    }));
  });
}

function pushOv6cIssues(issues, ov6c) {
  const unresolved = ov6c.unresolved || {};
  if (unresolved.unscheduledNodeIds?.length) {
    issues.push(issue({
      id: "ov6c-unscheduled",
      code: "sequence-unscheduled",
      group: "sequence",
      severity: "review",
      sourceView: "ov6c",
      title: "OODA 未入时间线",
      detail: `${unresolved.unscheduledNodeIds.length} 个 OODA 节点尚未映射到想定时间线。`,
      targetView: "scenario"
    }));
  }
  if (unresolved.orphanTimelineIds?.length) {
    issues.push(issue({
      id: "ov6c-orphan",
      code: "sequence-orphan",
      group: "sequence",
      severity: "review",
      sourceView: "ov6c",
      title: "时间线来源失效",
      detail: `${unresolved.orphanTimelineIds.length} 个时间线事件引用了不存在的 OODA 节点。`,
      targetView: "scenario"
    }));
  }
  if (unresolved.outOfOrderIds?.length) {
    issues.push(issue({
      id: "ov6c-order",
      code: "sequence-order",
      group: "sequence",
      severity: "review",
      sourceView: "ov6c",
      title: "抽象时序倒挂",
      detail: `${unresolved.outOfOrderIds.length} 个事件的时间偏移早于前一事件。`,
      targetView: "scenario"
    }));
  }
}

function pushValidationIssues(issues, validationResult, ov5, ooda, scenario, validationStale = false) {
  if (!validationResult || !Array.isArray(validationResult.issues)) {
    issues.push(issue({
      id: "validation-not-run",
      code: "validation-missing",
      group: "validation",
      severity: "pending",
      sourceView: "validate",
      title: "设计验证未运行",
      detail: "运行设计验证后，规则评分与问题会并入本核对台，便于与结构诊断一并处理。",
      targetView: "validate",
      action: "run-validation"
    }));
    return;
  }

  if (validationStale) {
    issues.unshift(issue({
      id: "validation-stale",
      code: "validation-stale",
      group: "validation",
      severity: "review",
      sourceView: "validate",
      title: "设计验证已过期",
      detail: validationResult.staleReason || "上游模型已变更，下列验证问题来自上次运行，仅供参考。请重新运行设计验证。",
      targetView: "validate",
      action: "run-validation",
      stale: true
    }));
  }

  const activityIds = new Set((ov5.activities || []).map((activity) => String(activity.id)));
  const oodaIds = new Set((Array.isArray(ooda?.lanes) ? ooda.lanes : []).flatMap((lane) => (lane.nodes || []).map((node) => String(node.id))));
  const entityIds = new Set((scenario?.entities || []).map((entity) => String(entity.id)));

  validationResult.issues.slice(0, 28).forEach((item, index) => {
    const sourceId = String(item.sourceId || "").trim();
    let targetView = "validate";
    let targetKind = "issue";
    let targetId = String(item.id || `validation-${index}`);
    if (sourceId && activityIds.has(sourceId)) {
      targetView = "ov5";
      targetKind = "activity";
      targetId = sourceId;
    } else if (sourceId && oodaIds.has(sourceId)) {
      targetView = "ooda";
      targetKind = "ooda";
      targetId = sourceId;
    } else if (sourceId && entityIds.has(sourceId)) {
      targetView = "scenario";
      targetKind = "unit";
      targetId = sourceId;
    }
    // Demote severity when the whole validation run is stale so fresh structure issues stay first.
    const baseSeverity = item.level === "high" ? "alert" : item.level === "low" ? "pending" : "review";
    const severity = validationStale && baseSeverity === "alert" ? "review" : baseSeverity;
    issues.push(issue({
      id: `validation-${item.id || index}`,
      code: `validation-${item.level || "medium"}`,
      group: "validation",
      severity,
      sourceView: "validate",
      title: `${validationStale ? "[过期] " : ""}${item.title || "设计验证问题"}`,
      detail: item.text || "请在设计验证页查看完整说明。",
      targetView,
      targetKind,
      targetId,
      stale: validationStale
    }));
  });
}

function issue(fields) {
  return {
    id: fields.id,
    code: fields.code || fields.id,
    group: fields.group || "mapping",
    severity: fields.severity || "review",
    sourceView: fields.sourceView || "",
    title: fields.title || "待复核项",
    detail: fields.detail || "",
    targetView: fields.targetView || "ov5",
    targetKind: fields.targetKind || "",
    targetId: fields.targetId || "",
    action: fields.action || "",
    stale: Boolean(fields.stale)
  };
}

function rankIssues(issues) {
  const severityRank = { alert: 0, review: 1, pending: 2 };
  const groupRank = { mapping: 0, validation: 1, concept: 2, contract: 3, sequence: 4 };
  const seen = new Set();
  return issues
    .filter((item) => {
      const key = `${item.code}:${item.targetId}:${item.title}:${item.detail}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      return (severityRank[left.severity] ?? 9) - (severityRank[right.severity] ?? 9)
        || (groupRank[left.group] ?? 9) - (groupRank[right.group] ?? 9)
        || left.title.localeCompare(right.title, "zh");
    });
}

function groupIssues(issues) {
  const order = ["mapping", "validation", "concept", "contract", "sequence"];
  const labels = {
    mapping: "来源映射",
    validation: "设计验证",
    concept: "概念结构",
    contract: "接口契约",
    sequence: "时序追溯"
  };
  return order.map((id) => ({
    id,
    label: labels[id],
    issues: issues.filter((item) => item.group === id)
  })).filter((group) => group.issues.length);
}

function summarizeDiagnostics(diagnostics = []) {
  return {
    ready: diagnostics.filter((item) => item.state === "ready").length,
    review: diagnostics.filter((item) => ["review", "attention", "conflict"].includes(item.state)).length,
    pending: diagnostics.filter((item) => item.state === "pending").length,
    total: diagnostics.length
  };
}

function labelOf(entity, fallback) {
  return String(entity?.title || entity?.label || fallback || "未命名").slice(0, 80);
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];
}
