const STORAGE_KEY = "concept-studio-validation-v1";
const OODA_WINDOW_MINUTES = 30;
import { buildSimulationDiagnostics } from "./simulationAdapter.js";
import { buildOv2Model } from "./ov2Builder.js";
import { buildOv3Model } from "./ov3Builder.js";
import { buildOv6cModel } from "./ov6cBuilder.js";
import { buildOv4Model } from "./ov4Builder.js";
import { buildOv5aModel, buildOv6aModel, buildOv6bModel } from "./dodafOperationalBuilders.js";

export function hasPersistedValidation(ov5Model, oodaModel, scenario, ov1Model) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Boolean(
      saved?.version === 1
      && Array.isArray(saved.issues)
      && Array.isArray(saved.scores)
      && !saved.stale
      && saved.inputSignature === createInputSignature(ov5Model, oodaModel, scenario, ov1Model)
    );
  } catch {
    return false;
  }
}

export function loadValidation(ov5Model, oodaModel, scenario, ov1Model) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!(saved?.version === 1 && Array.isArray(saved.issues) && Array.isArray(saved.scores))) return null;
    if (!ov5Model) return normalizeValidationResult(saved, false);
    const current = createInputSignature(ov5Model, oodaModel, scenario, ov1Model);
    if (saved.inputSignature === current && !saved.stale) return normalizeValidationResult(saved, false);
    // Keep the last run as a stale reference after model edits so researchers can compare before re-running.
    return normalizeValidationResult({
      ...saved,
      stale: true,
      staleReason: saved.staleReason || "上游模型已变更，验证结果仅供参考，请重新运行。"
    }, true);
  } catch {
    // Invalid local state is treated as no validation run.
  }
  return null;
}

export function isValidationStale(result, ov5Model, oodaModel, scenario, ov1Model) {
  if (!result) return false;
  if (result.stale) return true;
  if (!ov5Model) return false;
  return result.inputSignature !== createInputSignature(ov5Model, oodaModel, scenario, ov1Model);
}

export function markValidationStale(result, reason = "上游模型已变更，验证结果仅供参考，请重新运行。") {
  if (!result) return null;
  return normalizeValidationResult({
    ...result,
    stale: true,
    staleAt: new Date().toISOString(),
    staleReason: String(reason || "").slice(0, 240)
  }, true);
}

function normalizeValidationResult(result, stale) {
  return {
    ...result,
    stale: Boolean(stale || result?.stale),
    staleAt: result?.staleAt || (stale ? new Date().toISOString() : ""),
    staleReason: stale || result?.stale ? (result?.staleReason || "上游模型已变更，验证结果仅供参考，请重新运行。") : ""
  };
}

export function generateValidation(ov5Model, oodaModel, scenario, ov1Model, context = {}) {
  const issues = [];
  const forceMission = context?.forceMission || null;
  const ov4Model = context?.ov4 || buildOv4Model({ forceMission, ov1: ov1Model, ov5: ov5Model, ooda: oodaModel, scenario });
  const ov2Model = context?.ov2 || buildOv2Model({ forceMission, ov4: ov4Model, ov1: ov1Model, ov5: ov5Model, ooda: oodaModel, scenario });
  const ov3Model = context?.ov3 || buildOv3Model({ ov2: ov2Model, scenario });
  const incoming = new Map(ov5Model.activities.map((activity) => [activity.id, 0]));
  ov5Model.edges.forEach((edge) => incoming.set(edge.targetId, (incoming.get(edge.targetId) || 0) + 1));

  ov5Model.activities.slice(1).forEach((activity) => {
    if (!incoming.get(activity.id)) {
      issues.push(createIssue("medium", "活动关联缺失", `“${activity.title}”缺少上游输入关联，应补充信息流、资源流或控制流。`, activity.id));
    }
  });

  ov5Model.activities.forEach((activity) => {
    if (isPlaceholder(activity.input) || isPlaceholder(activity.output)) {
      issues.push(createIssue("high", "活动输入输出待定义", `“${activity.title}”的输入或输出仍为待定义，无法进行完整信息闭环检查。`, activity.id));
    }
  });

  const oodaDuration = getOodaDuration(oodaModel);
  if (!oodaDuration) {
    issues.push(createIssue("medium", "OODA 时序待补充", "当前 OODA 节点没有可计算的耗时，无法评估循环时效。", ""));
  } else if (oodaDuration > OODA_WINDOW_MINUTES) {
    issues.push(createIssue("high", "OODA 周期超出窗口", `当前周期 ${oodaDuration} 分钟，超过 ${OODA_WINDOW_MINUTES} 分钟目标窗口。`, ""));
  }

  const oodaDiagnostics = inspectOodaModel(oodaModel, ov5Model);
  issues.push(...oodaDiagnostics.issues);

  const traceabilityDiagnostics = inspectTraceability(ov5Model, ov1Model);
  issues.push(...traceabilityDiagnostics.issues);
  const flowDiagnostics = inspectActivityFlow(ov5Model, scenario, ov3Model);
  issues.push(...flowDiagnostics.issues);
  issues.push(...inspectEventTrace(buildOv6cModel({ ooda: oodaModel, scenario })));
  issues.push(...inspectOv4Responsibilities(ov4Model));
  const derivedOperationalDiagnostics = inspectDerivedOperationalViews(ov5Model, oodaModel);
  issues.push(...derivedOperationalDiagnostics.issues);
  const simulationDiagnostics = buildSimulationDiagnostics(scenario);
  issues.push(...inspectLocalAbstractSimulation(simulationDiagnostics, scenario));

  if (!scenario) {
    issues.push(createIssue("medium", "想定尚未生成", "需要先生成初始实体和事件序列，才能检查部署数据来源覆盖。", ""));
  } else {
    const unmappedEntities = scenario.entities.filter((entity) => entity.role !== "opponent" && !entity.sourceActivityId);
    if (unmappedEntities.length) {
      issues.push(createIssue("medium", "想定实体来源不完整", `${unmappedEntities.length} 个实体未关联 OV-5 活动。`, ""));
    }
    const activityById = new Map((ov5Model?.activities || []).map((activity) => [activity.id, activity]));
    const missingKnowledgeProvenance = scenario.entities.filter((entity) => (activityById.get(entity.sourceActivityId)?.refs || []).length && !(entity.sourceKnowledgeRefs || []).length);
    missingKnowledgeProvenance.forEach((entity) => {
      issues.push(createIssue("low", "想定实体知识依据待复核", `“${entity.label || "未命名实体"}”的来源活动已关联知识依据，但实体未保留抽象引用。`, entity.id));
    });
  }

  const result = {
    version: 1,
    id: `validation-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    inputSignature: createInputSignature(ov5Model, oodaModel, scenario, ov1Model),
    oodaDuration,
    scores: [
      { label: "活动连通性", score: Math.max(0, 100 - countIssues(issues, "活动关联") * 22) },
      { label: "信息闭环", score: Math.max(0, 100 - countIssues(issues, "输入输出") * 26) },
      { label: "想定来源覆盖", score: scenario ? Math.max(0, 95 - countIssues(issues, "实体来源") * 24) : 52 },
      { label: "OODA 时效", score: scoreDuration(oodaDuration) },
      { label: "OODA 行为完整性", score: oodaDiagnostics.completenessScore },
      { label: "OODA 韧性", score: oodaDiagnostics.resilienceScore },
      { label: "跨视图追溯", score: traceabilityDiagnostics.score },
      { label: "活动交换契约", score: flowDiagnostics.score }
    ],
    issues,
    oodaDiagnostics,
    traceabilityDiagnostics,
    flowDiagnostics,
    derivedOperationalDiagnostics,
    simulationDiagnostics,
    redTeam: buildRedTeamSummary(issues, oodaDuration),
    redTeamReview: null,
    stale: false,
    staleAt: "",
    staleReason: ""
  };
  persistValidation(result);
  return result;
}

// Seed-quality checks for OV-5a/6a/6b when products are empty or not yet saved.
// Researchers may edit those products directly after seeding; OV-5b/OODA remain primary seed sources.
export function inspectDerivedOperationalViews(ov5Model, oodaModel) {
  const ov5a = buildOv5aModel({ ov5: ov5Model });
  const ov6a = buildOv6aModel({ ov5: ov5Model });
  const ov6b = buildOv6bModel({ ooda: oodaModel });
  const issues = [];
  const activities = Array.isArray(ov5Model?.activities) ? ov5Model.activities : [];
  const hierarchyConfigured = (ov5a.decompositions || []).length > 0;
  if (activities.length && !hierarchyConfigured) {
    issues.push(createIssue("low", "OV-5a 活动分解待补充", "当前 OV-5b 活动均为并列项；可在 OV-5b 设置 parentId 后重新同步 OV-5a，或在 OV-5a 层级表中调整父级引用。", ""));
  }
  if (!ov6a.rules.length) {
    issues.push(createIssue("low", "OV-6a 规则来源待补充", "尚未从 OV-5b 种子出前提、约束或关系条件；请在 OV-5b 补充字段后种子，或直接编辑 OV-6a 规则。", ""));
  }
  if (!ov6b.transitions.length) {
    issues.push(createIssue("low", "OV-6b 状态转换待补充", "尚未从 OODA 种子出状态转换；请补充 OODA 后种子，或直接编辑 OV-6b。", ""));
  }
  return {
    ov5a: { activityCount: activities.length, hierarchyConfigured },
    ov6a: { ruleCount: ov6a.rules.length },
    ov6b: { stateCount: ov6b.states.length, transitionCount: ov6b.transitions.length },
    issues
  };
}

export function persistValidation(result) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
}

export function clearValidation() {
  localStorage.removeItem(STORAGE_KEY);
}

function createIssue(level, title, text, sourceId) {
  return { id: `issue-${title}-${sourceId || Date.now()}-${Math.random().toString(16).slice(2)}`, level, title, text, sourceId };
}

function countIssues(issues, keyword) {
  return issues.filter((issue) => issue.title.includes(keyword)).length;
}

function scoreDuration(duration) {
  if (!duration) return 55;
  if (duration <= OODA_WINDOW_MINUTES) return Math.max(72, 100 - Math.round(duration / 3));
  return Math.max(35, 100 - (duration - OODA_WINDOW_MINUTES) * 5);
}

function inspectEventTrace(trace) {
  const unresolved = trace?.unresolved || {};
  const issues = [];
  if (unresolved.unscheduledNodeIds?.length) issues.push(createIssue("low", "OV-6c 节点待排程", `${unresolved.unscheduledNodeIds.length} 个 OODA 节点尚未映射至抽象想定时间线；请复核时序来源。`, unresolved.unscheduledNodeIds[0]));
  if (unresolved.orphanTimelineIds?.length) issues.push(createIssue("low", "OV-6c 时间线来源待复核", `${unresolved.orphanTimelineIds.length} 个时间线事件引用了不存在的 OODA 节点；请复核来源映射。`, unresolved.orphanTimelineIds[0]));
  if (unresolved.outOfOrderIds?.length) issues.push(createIssue("low", "OV-6c 时间顺序待复核", `${unresolved.outOfOrderIds.length} 个抽象时间偏移早于前一事件；请复核事件顺序。`, unresolved.outOfOrderIds[0]));
  return issues;
}

function inspectOv4Responsibilities(model) {
  const unresolved = model?.unresolved || {};
  const issues = [];
  if (unresolved.unmappedActivityIds?.length) issues.push(createIssue("low", "OV-4 活动责任待复核", `${unresolved.unmappedActivityIds.length} 个活动尚未关联抽象责任角色；请复核 OV-1 来源节点。`, unresolved.unmappedActivityIds[0]));
  if (unresolved.unassignedRoleIds?.length) issues.push(createIssue("low", "OV-4 责任覆盖待复核", `${unresolved.unassignedRoleIds.length} 个抽象责任角色尚未覆盖 OV-5 活动；请复核概念节点与活动归属。`, unresolved.unassignedRoleIds[0]));
  if (unresolved.brokenEdgeIds?.length) issues.push(createIssue("low", "OV-4 责任关系待复核", `${unresolved.brokenEdgeIds.length} 条活动关系无法推导跨角色关系；请复核关联来源。`, unresolved.brokenEdgeIds[0]));
  return issues;
}

function inspectLocalAbstractSimulation(diagnostics, scenario) {
  const run = scenario?.simulation?.runs?.[0];
  if (run?.adapter?.mode !== "local-deterministic" || run?.result?.status !== "completed") return [];
  if (diagnostics?.latestRun?.freshness !== "current") {
    const label = diagnostics?.latestRun?.freshness === "stale" ? "本地抽象仿真结果已失效" : "本地抽象仿真结果待复核";
    return [createIssue("medium", label, "当前想定与该本地抽象运行的输入不一致或缺少输入指纹；请重新运行后再将指标用于设计复核。", "")];
  }
  const metrics = new Map((run.result.metrics || []).map((item) => [String(item.id || ""), Number(item.value)]));
  const issues = [];
  const bounds = metrics.get("grid-bounds");
  const coverage = metrics.get("area-coverage");
  const timeline = metrics.get("timeline-completeness");
  const deployment = metrics.get("deployment-diagnostics");
  if (Number.isFinite(bounds) && bounds < 100) issues.push(createIssue("high", "本地网格边界需复核", `本地抽象评估的边界合规为 ${bounds}%；请检查实体抽象位置。`, ""));
  if (Number.isFinite(coverage) && coverage < 60) issues.push(createIssue("medium", "本地区域覆盖需复核", `本地抽象评估的区域覆盖一致性为 ${coverage}%；请人工检查区域与实体关系。`, ""));
  if (Number.isFinite(timeline) && timeline < 100) issues.push(createIssue("medium", "本地时间线需复核", `本地抽象评估的时间线完整性为 ${timeline}%；请补充来源节点。`, ""));
  if (Number.isFinite(deployment) && deployment < 100) issues.push(createIssue("medium", "本地部署诊断需复核", `本地抽象评估的部署诊断就绪为 ${deployment}%；该结果不替代人工部署复核。`, ""));
  return issues;
}

function inspectOodaModel(model, ov5Model) {
  const lanes = Array.isArray(model?.lanes) ? model.lanes : [];
  const nodes = lanes.flatMap((lane) => lane.nodes || []);
  const issues = [];
  const requiredLanes = ["observe", "orient", "decide", "act"];
  const missingLanes = requiredLanes.filter((laneId) => !lanes.find((lane) => lane.id === laneId)?.nodes?.length);
  if (missingLanes.length) {
    issues.push(createIssue("high", "OODA 阶段缺失", `缺少 ${missingLanes.join("、")} 阶段的行为节点，观察、判断、决策和行动无法构成完整闭环。`, ""));
  }

  const incompleteNodes = nodes.filter((node) => isPlaceholder(node.input) || isPlaceholder(node.output));
  incompleteNodes.forEach((node) => {
    issues.push(createIssue("medium", "OODA 输入输出待定义", `“${node.title || "未命名节点"}”缺少可复核的输入或输出，无法确认信息转换是否完整。`, node.id));
  });

  const actionNodes = lanes.find((lane) => lane.id === "act")?.nodes || [];
  const hasFeedback = actionNodes.some((node) => [node.title, node.text, node.output, node.rule].join(" ").match(/反馈|回收|下一轮|更新/));
  if (!hasFeedback) {
    issues.push(createIssue("medium", "OODA 反馈出口缺失", "行动阶段未定义可回流至观察阶段的反馈输出，应补充效果、异常或资源状态更新。", ""));
  }

  const sourceCounts = new Map();
  nodes.filter((node) => node.sourceActivityId).forEach((node) => {
    sourceCounts.set(node.sourceActivityId, (sourceCounts.get(node.sourceActivityId) || 0) + 1);
  });
  const sharedSources = [...sourceCounts.entries()].filter(([, count]) => count > 1);
  const activityTitles = new Map((ov5Model?.activities || []).map((activity) => [activity.id, activity.title]));
  const activitiesById = new Map((ov5Model?.activities || []).map((activity) => [activity.id, activity]));
  const missingEquipmentBindings = nodes.filter((node) => hasValue(activitiesById.get(node.sourceActivityId)?.resources) && !(node.equipmentRefs || []).length);
  const missingKnowledgeBindings = nodes.filter((node) => (activitiesById.get(node.sourceActivityId)?.refs || []).length && !(node.knowledgeRefs || []).length);
  sharedSources.forEach(([sourceId, count]) => {
    issues.push(createIssue("medium", "OODA 单点依赖", `${count} 个 OODA 节点共同依赖活动“${activityTitles.get(sourceId) || sourceId}”，应复核替代信息来源或降级规则。`, sourceId));
  });
  missingEquipmentBindings.forEach((node) => {
    issues.push(createIssue("low", "OODA 关联装备待复核", `“${node.title || "未命名节点"}”的来源活动已记录资源描述，但尚未关联抽象装备引用。`, node.id));
  });
  missingKnowledgeBindings.forEach((node) => {
    issues.push(createIssue("low", "OODA 知识依据待复核", `“${node.title || "未命名节点"}”的来源活动已关联知识依据，但该 OODA 节点尚未建立引用。`, node.id));
  });

  const completenessScore = Math.max(0, 100 - missingLanes.length * 40 - incompleteNodes.length * 12);
  const resilienceScore = Math.max(0, 100 - (hasFeedback ? 0 : 35) - sharedSources.length * 18 - (nodes.length ? 0 : 30));
  const checks = [
    createDiagnostic("lane-coverage", "四阶段覆盖", missingLanes.length ? "attention" : "ready", missingLanes.length ? `待补充：${missingLanes.join("、")}` : "观察、判断、决策和行动均有节点"),
    createDiagnostic("information-handoff", "输入输出转换", incompleteNodes.length ? "review" : "ready", incompleteNodes.length ? `${incompleteNodes.length} 个节点待定义输入或输出` : "所有 OODA 节点均定义输入与输出"),
    createDiagnostic("feedback-exit", "反馈出口", hasFeedback ? "ready" : "review", hasFeedback ? "行动阶段已包含反馈或下一轮更新" : "需补充反馈回流至观察阶段"),
    createDiagnostic("dependency-resilience", "依赖韧性", sharedSources.length ? "review" : "ready", sharedSources.length ? `${sharedSources.length} 个共享上游依赖需复核` : "未发现跨节点共享的单点上游依赖"),
    createDiagnostic("equipment-binding", "关联装备引用", missingEquipmentBindings.length ? "review" : "ready", missingEquipmentBindings.length ? `${missingEquipmentBindings.length} 个节点待关联来源活动的抽象装备引用` : "已关联所有具资源描述来源活动的抽象装备引用"),
    createDiagnostic("knowledge-binding", "知识依据引用", missingKnowledgeBindings.length ? "review" : "ready", missingKnowledgeBindings.length ? `${missingKnowledgeBindings.length} 个节点待关联来源活动的知识依据` : "已关联所有具知识依据来源活动的 OODA 节点")
  ];
  return { windowMinutes: OODA_WINDOW_MINUTES, nodeCount: nodes.length, completenessScore, resilienceScore, checks, issues };
}

function inspectTraceability(ov5Model, ov1Model) {
  const activities = Array.isArray(ov5Model?.activities) ? ov5Model.activities : [];
  const ov1Ids = new Set((Array.isArray(ov1Model?.nodes) ? ov1Model.nodes : []).map((node) => node.id));
  const missingSource = activities.filter((activity) => !Array.isArray(activity.sourceOv1NodeIds) || !activity.sourceOv1NodeIds.length);
  const orphanedReferences = activities.flatMap((activity) => (activity.sourceOv1NodeIds || [])
    .filter((id) => ov1Ids.size && !ov1Ids.has(id))
    .map((id) => ({ activity, id })));
  const issues = [];
  if (missingSource.length) {
    issues.push(createIssue("medium", "OV-1 来源关联缺失", `${missingSource.length} 项 OV-5 活动尚未标注来源 OV-1 节点：${missingSource.map((item) => `“${item.title}”`).join("、")}。`, ""));
  }
  if (orphanedReferences.length) {
    issues.push(createIssue("medium", "OV-1 来源引用无效", `${orphanedReferences.map((item) => `“${item.activity.title}” -> ${item.id}`).join("、")} 已不在当前 OV-1 中，应重新关联。`, ""));
  }
  const score = Math.max(0, 100 - missingSource.length * 18 - orphanedReferences.length * 24);
  return {
    mappedActivityCount: activities.length - missingSource.length,
    activityCount: activities.length,
    orphanedReferenceCount: orphanedReferences.length,
    score,
    checks: [
      createDiagnostic("ov1-source-coverage", "OV-1 来源覆盖", missingSource.length ? "review" : "ready", missingSource.length ? `${missingSource.length} 项活动待关联 OV-1 节点` : "所有 OV-5 活动均已关联 OV-1 节点"),
      createDiagnostic("ov1-source-validity", "OV-1 引用有效性", orphanedReferences.length ? "attention" : "ready", orphanedReferences.length ? `${orphanedReferences.length} 条来源引用已失效` : "所有来源引用均可在当前 OV-1 中定位")
    ],
    issues
  };
}

function inspectActivityFlow(ov5Model, scenario, exchangeModel = buildOv3Model({ ov5: ov5Model, scenario })) {
  const unresolvedCount = exchangeModel.unresolved.unresolvedEdgeIds.length;
  const missingContractCount = exchangeModel.unresolved.missingContractCount;
  const mismatchCount = exchangeModel.unresolved.mismatchCount;
  const activities = Array.isArray(ov5Model?.activities) ? ov5Model.activities : [];
  const resourceWithoutConstraint = activities.filter((activity) => hasValue(activity.resources) && !hasValue(activity.constraints));
  const constraintWithoutPrecondition = activities.filter((activity) => hasValue(activity.constraints) && !hasValue(activity.preconditions));
  const issues = [];
  if (unresolvedCount) issues.push(createIssue("high", "活动关系端点无效", `${unresolvedCount} 条活动关系无法定位源或目标活动，应在 OV-5 中修正关系端点。`, ""));
  if (missingContractCount) issues.push(createIssue("medium", "活动交换契约待定义", `${missingContractCount} 条活动交换缺少源输出或目标输入，无法检查交接完整性。`, ""));
  if (mismatchCount) issues.push(createIssue("medium", "活动输入输出映射待复核", `${mismatchCount} 条活动交换的源输出与目标输入未直接匹配，应明确字段映射或转换规则。`, ""));
  if (resourceWithoutConstraint.length) issues.push(createIssue("low", "资源需求缺少约束", `${resourceWithoutConstraint.length} 项活动已记录资源需求但未记录容量、时限或保障约束，应补充人工可复核条件。`, ""));
  if (constraintWithoutPrecondition.length) issues.push(createIssue("low", "活动约束缺少前置条件", `${constraintWithoutPrecondition.length} 项活动存在约束但未定义前置条件，应补充启动判据。`, ""));
  const score = Math.max(0, 100 - unresolvedCount * 32 - missingContractCount * 20 - mismatchCount * 12 - resourceWithoutConstraint.length * 6 - constraintWithoutPrecondition.length * 6);
  const checks = [
    createDiagnostic("exchange-endpoints", "活动关系端点", unresolvedCount ? "attention" : "ready", unresolvedCount ? `${unresolvedCount} 条关系端点待修正` : "所有活动关系均可定位源和目标"),
    createDiagnostic("exchange-contracts", "输入输出契约", missingContractCount || mismatchCount ? "review" : "ready", missingContractCount ? `${missingContractCount} 条交换待补充定义` : mismatchCount ? `${mismatchCount} 条交换待确认映射` : "活动交换的输入输出契约可直接匹配"),
    createDiagnostic("resource-constraints", "资源与约束", resourceWithoutConstraint.length || constraintWithoutPrecondition.length ? "review" : "ready", resourceWithoutConstraint.length || constraintWithoutPrecondition.length ? `${resourceWithoutConstraint.length} 项资源需求、${constraintWithoutPrecondition.length} 项约束待补充配套条件` : "资源需求与约束条件已成对记录")
  ];
  return { exchangeCount: exchangeModel.exchanges.length, unresolvedCount, missingContractCount, mismatchCount, resourceWithoutConstraintCount: resourceWithoutConstraint.length, constraintWithoutPreconditionCount: constraintWithoutPrecondition.length, score, checks, issues };
}

function createDiagnostic(id, label, state, detail) {
  const statusLabels = { ready: "已满足", review: "需复核", attention: "待修订" };
  return { id, label, state, statusLabel: statusLabels[state], detail };
}

function getOodaDuration(model) {
  return model.lanes.flatMap((lane) => lane.nodes)
    .reduce((sum, node) => sum + parseMinutes(node.duration), 0);
}

function parseMinutes(value) {
  const match = String(value || "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function isPlaceholder(value) {
  return !value || ["待定义", "待估算", "未知"].includes(String(value).trim());
}

function hasValue(value) { return !isPlaceholder(value); }

function buildRedTeamSummary(issues, duration) {
  const focus = issues[0]?.title || "当前活动链的关键依赖";
  const timing = duration ? `当前 OODA 周期为 ${duration} 分钟` : "当前 OODA 周期尚未完成估算";
  return `红方质询草案：对手可能通过信息欺骗和分布式机动放大“${focus}”的影响。${timing}，建议在判断阶段增加交叉验证规则，并为关键输入设置替代来源。`;
}

function createInputSignature(ov5Model, oodaModel, scenario, ov1Model) {
  return JSON.stringify({
    ov1: (ov1Model?.nodes || []).map((node) => ({ id: node.id, label: node.label })),
    activities: ov5Model?.activities || [],
    edges: ov5Model?.edges || [],
    lanes: oodaModel?.lanes || [],
    scenario: scenario ? {
      id: scenario.id,
      entities: scenario.entities,
      timeline: scenario.timeline
    } : null
  });
}
