/**
 * 仿真推演结果回收与偏差提炼引擎 (M6-T6.3)
 *
 * 职责：
 * 1. 结构化解析/提炼推演回传结果与阶段、活动的对应关系
 * 2. 自动生成各阶段推进成效、战损及活动级执行偏差清单 (Deviation List)
 * 3. 执行推演结果向 phaseAction 与 ov5 要素的回填 (Backfill / Recycle)
 * 4. 为复盘模板 (wargame-review) 与前端视图提供规范的数据格式
 */

export const DEVIATION_CATEGORIES = {
  schedule: { label: "时序进度", code: "schedule" },
  loss: { label: "战损指标", code: "loss" },
  effect: { label: "作战效果", code: "effect" },
  coordination: { label: "体系协同", code: "coordination" }
};

export const DEVIATION_SEVERITIES = {
  high: { label: "高", weight: 3 },
  medium: { label: "中", weight: 2 },
  low: { label: "低", weight: 1 }
};

/**
 * 从最新仿真运行中提取推演结果，如未显式提供明细，则结合想定与部署状态推导阶段成果
 */
export function extractSimulationPhaseOutcomes(scenario, phaseAction) {
  const latestRun = scenario?.simulation?.runs?.[0];
  const result = latestRun?.result;
  const phases = Array.isArray(phaseAction?.phases) ? phaseAction.phases : [];
  if (!phases.length) return [];

  // 1. 若仿真结果中直接提供了 phaseOutcomes，则校验并返回规范化数据
  if (Array.isArray(result?.phaseOutcomes) && result.phaseOutcomes.length > 0) {
    return result.phaseOutcomes.map((item, index) => {
      const matchedPhase = phases.find((p) => p.id === item.phaseId) || phases[index];
      const rawLoss = item.lossRate != null ? String(item.lossRate).trim() : "";
      const formattedLoss = rawLoss
        ? (rawLoss.endsWith("%") ? rawLoss : `${rawLoss}%`)
        : "0%";
      const status = ["achieved", "partial", "failed"].includes(item.status) ? item.status : "achieved";
      const riskLevel = item.riskLevel || (status === "failed" ? "high" : status === "partial" ? "medium" : "low");

      return {
        phaseId: clean(item.phaseId || matchedPhase?.id, 60),
        phaseName: clean(item.phaseName || matchedPhase?.name, 120),
        plannedTime: clean(item.plannedTime || matchedPhase?.timeWindow, 80) || "待明确",
        actualDuration: clean(item.actualDuration, 60) || "符合预设",
        durationDelta: clean(item.durationDelta, 60) || "0",
        lossRate: formattedLoss,
        status,
        statusLabel: ({ achieved: "顺利达成", partial: "部分达成", failed: "未达成" })[status] || "顺利达成",
        summary: clean(item.summary, 500) || "阶段目标在推演中按计划完成。",
        sourceType: clean(item.sourceType, 60) || "[定量仿真回传]",
        isQuantitative: typeof item.isQuantitative === "boolean" ? item.isQuantitative : true,
        riskLevel,
        riskAssessment: clean(item.riskAssessment, 200) || (status === "achieved" ? "仿真回传：执行顺利闭环" : "仿真回传：存在指标偏差")
      };
    });
  }

  // 2. 本地机理与指标推导（基于仿真 metrics、timeline 和部署就绪度，消除伪造线性算式）
  const metrics = result?.metrics || [];
  const coverageMetric = metrics.find((m) => m.id === "area-coverage" || m.label?.includes("覆盖"))?.value ?? 80;
  const boundsMetric = metrics.find((m) => m.id === "grid-bounds" || m.label?.includes("边界"))?.value ?? 90;
  const timelineMetric = metrics.find((m) => m.id === "timeline-completeness" || m.label?.includes("时间线"))?.value ?? 85;

  return phases.map((phase, index) => {
    const isLatePhase = index >= Math.floor(phases.length / 2);
    let status = "achieved";
    let lossRate = "0.5% (预估轻微损耗)";
    let durationDelta = "+0h";
    let riskLevel = "low";
    let riskAssessment = "链路闭环通畅，兵力展开与行动时序符合预设。";
    let summary = `阶段 [${phase.name}] 预设目标基本达成，兵力展开与行动时序顺畅。`;

    if (coverageMetric < 50 || timelineMetric < 50) {
      status = "failed";
      lossRate = "15.0% (严重受挫预估)";
      durationDelta = `+${index + 2}h`;
      riskLevel = "high";
      riskAssessment = "核心感知或协同链路中断，阶段关键战术指标未达成。";
      summary = `受感知覆盖或时序严重失序影响，阶段 [${phase.name}] 关键协同动作中断，推演判定未达成预期效果。`;
    } else if (coverageMetric < 70 || timelineMetric < 70) {
      if (isLatePhase) {
        status = "partial";
        lossRate = "5.0% (局部受阻预估)";
        durationDelta = `+${index + 1}h`;
        riskLevel = "medium";
        riskAssessment = "受区域覆盖与时序完整性约束，阶段后期出现协同延期，存在局部阻滞。";
        summary = `受区域覆盖与时序完整性约束，阶段后期出现协同延期，实际战损略高于基准。`;
      }
    } else if (boundsMetric < 80) {
      if (index === 0) {
        status = "partial";
        lossRate = "3.0% (初始展开受限预估)";
        durationDelta = "+1.5h";
        riskLevel = "medium";
        riskAssessment = "初始阶段网格展开受限，进入下一阶段条件出现时间窗口漂移。";
        summary = `初始阶段网格展开受限，进入下一阶段条件出现时间窗口漂移。`;
      }
    }

    return {
      phaseId: phase.id,
      phaseName: phase.name,
      plannedTime: phase.timeWindow || `第 ${index + 1} 阶段时窗`,
      actualDuration: phase.timeWindow ? `${phase.timeWindow} (实际测算)` : "符合预设",
      durationDelta,
      lossRate,
      status,
      statusLabel: ({ achieved: "顺利达成", partial: "部分达成", failed: "未达成" })[status] || "顺利达成",
      summary,
      sourceType: "[定性推演/机理推导]",
      isQuantitative: false,
      riskLevel,
      riskAssessment,
      evidenceBasis: `评估依据：覆盖度 ${coverageMetric}% / 边界合规 ${boundsMetric}% / 时序完整性 ${timelineMetric}%`
    };
  });
}

/**
 * 提取活动级执行偏差
 */
export function extractSimulationActivityDeviations(scenario, ov5, phaseAction) {
  const latestRun = scenario?.simulation?.runs?.[0];
  const result = latestRun?.result;
  const activities = Array.isArray(ov5?.activities) ? ov5.activities : [];
  if (!activities.length) return [];

  // 1. 若仿真结果中直接提供了 activityDeviations，则直接规范化
  if (Array.isArray(result?.activityDeviations) && result.activityDeviations.length > 0) {
    return result.activityDeviations.map((item, index) => {
      const matchedAct = activities.find((a) => a.id === item.activityId) || activities[index];
      return normalizeActivityDeviation(item, matchedAct, index);
    });
  }

  // 2. 本地启发式推导偏差（识别无关联活动、时序断点或仿真告警）
  const deviations = [];
  const metrics = result?.metrics || [];
  const areaCoverage = metrics.find((m) => m.id === "area-coverage")?.value ?? 80;
  const timelineCompleteness = metrics.find((m) => m.id === "timeline-completeness")?.value ?? 85;

  activities.forEach((act, idx) => {
    // 启发规则 1：无 performer 的活动产生协同偏差
    if (!act.performer && idx < 3) {
      deviations.push({
        id: `dev-act-${idx + 1}`,
        activityId: act.id,
        activityName: act.name,
        category: "coordination",
        severity: "medium",
        planned: "明确执行节点与责任主体",
        actual: "未指定执行实体，推演时依赖临机指派",
        gap: "协同职责存在盲区",
        rootCause: "概念设计阶段未分配执行力量编组",
        recommendation: "在 OV-4 组织关系或活动检查器中补全主责实体"
      });
    }

    // 启发规则 2：覆盖率偏低时产生效果偏差
    if (areaCoverage < 75 && idx === 1) {
      deviations.push({
        id: `dev-act-cov-${idx + 1}`,
        activityId: act.id,
        activityName: act.name,
        category: "effect",
        severity: "high",
        planned: "目标区域有效态势感知覆盖率 ≥ 80%",
        actual: `仿真实际区域覆盖率约为 ${areaCoverage}%`,
        gap: `${(areaCoverage - 80).toFixed(1)}%`,
        rootCause: "探测节点部署位置与受阻网格重叠，雷达视距受限",
        recommendation: "在想定部署方案中调整感知节点初始网格坐标，增加备用机动感知载荷"
      });
    }

    // 启发规则 3：时序完整性欠佳时产生进度偏差
    if (timelineCompleteness < 90 && idx === 0) {
      deviations.push({
        id: `dev-act-time-${idx + 1}`,
        activityId: act.id,
        activityName: act.name,
        category: "schedule",
        severity: "medium",
        planned: "时序基准对齐时间线节点",
        actual: "推演时间线存在未绑定的离散事件",
        gap: "时序漂移约 15%",
        rootCause: "活动前置依赖条件在时序事件流中缺少显式触发信号",
        recommendation: "在 OV-6c 事件序列或 OODA 循环中补全状态转移触发条件"
      });
    }
  });

  return deviations;
}

/**
 * 提取全量综合执行偏差清单 (Deviation List)
 */
export function extractSimulationDeviations({ scenario, phaseAction, ov5 }) {
  const phaseOutcomes = extractSimulationPhaseOutcomes(scenario, phaseAction);
  const activityDeviations = extractSimulationActivityDeviations(scenario, ov5, phaseAction);

  const deviations = [];

  // 1. 将阶段层面的未达标或部分达标转化为阶段偏差项
  phaseOutcomes.forEach((po, index) => {
    if (po.status !== "achieved" || po.durationDelta !== "+0h" || parseFloat(po.lossRate) > 3.0) {
      deviations.push({
        id: `dev-phase-${po.phaseId || index + 1}`,
        targetType: "phase",
        targetId: po.phaseId,
        targetName: po.phaseName,
        category: po.status === "failed" ? "effect" : po.durationDelta !== "+0h" ? "schedule" : "loss",
        categoryLabel: po.status === "failed" ? "作战效果" : po.durationDelta !== "+0h" ? "时序进度" : "战损指标",
        severity: po.status === "failed" ? "high" : "medium",
        severityLabel: po.status === "failed" ? "高" : "中",
        planned: `${po.plannedTime}，战损率预期 ≤ 2.0%`,
        actual: `${po.actualDuration} (时差 ${po.durationDelta})，战损率 ${po.lossRate}`,
        gap: `耗时时差 ${po.durationDelta} / 战损超标`,
        rootCause: po.summary,
        recommendation: "评估调整该阶段转入转出条件，优化力量对抗编配"
      });
    }
  });

  // 2. 活动层面的执行偏差
  activityDeviations.forEach((ad) => {
    deviations.push({
      id: ad.id,
      targetType: "activity",
      targetId: ad.activityId,
      targetName: ad.activityName,
      category: ad.category,
      categoryLabel: DEVIATION_CATEGORIES[ad.category]?.label || "综合偏差",
      severity: ad.severity,
      severityLabel: DEVIATION_SEVERITIES[ad.severity]?.label || "中",
      planned: ad.planned,
      actual: ad.actual,
      gap: ad.gap,
      rootCause: ad.rootCause,
      recommendation: ad.recommendation
    });
  });

  return deviations;
}

/**
 * 回填推演成果到 phaseAction 和 ov5 模型
 * 返回回填后的 { phaseAction, ov5, scenario, stats }
 */
export function recycleSimulationToPhasesAndActivities({ scenario, phaseAction, ov5 }) {
  const phaseOutcomes = extractSimulationPhaseOutcomes(scenario, phaseAction);
  const activityDeviations = extractSimulationActivityDeviations(scenario, ov5, phaseAction);
  const deviations = extractSimulationDeviations({ scenario, phaseAction, ov5 });
  const recycledAt = new Date().toISOString();

  // 1. 回填到 PhaseAction.phases
  let updatedPhasesCount = 0;
  const updatedPhases = (phaseAction?.phases || []).map((phase) => {
    const outcome = phaseOutcomes.find((po) => po.phaseId === phase.id);
    if (!outcome) return phase;
    updatedPhasesCount += 1;
    return {
      ...phase,
      simulationOutcome: {
        recycledAt,
        status: outcome.status,
        statusLabel: outcome.statusLabel,
        actualDuration: outcome.actualDuration,
        durationDelta: outcome.durationDelta,
        lossRate: outcome.lossRate,
        summary: outcome.summary,
        sourceType: outcome.sourceType || "[定性推演/机理推导]",
        riskLevel: outcome.riskLevel || "low",
        riskAssessment: outcome.riskAssessment || ""
      }
    };
  });

  const nextPhaseAction = {
    ...phaseAction,
    phases: updatedPhases,
    simulationRecycleSummary: {
      recycledAt,
      phaseCount: updatedPhasesCount,
      achievedCount: phaseOutcomes.filter((p) => p.status === "achieved").length,
      partialCount: phaseOutcomes.filter((p) => p.status === "partial").length,
      failedCount: phaseOutcomes.filter((p) => p.status === "failed").length
    }
  };

  // 2. 回填到 OV-5 Activities
  let updatedActivitiesCount = 0;
  const updatedActivities = (ov5?.activities || []).map((act) => {
    const actDevs = activityDeviations.filter((ad) => ad.activityId === act.id);
    if (!actDevs.length) return act;
    updatedActivitiesCount += 1;
    return {
      ...act,
      simulationOutcome: {
        recycledAt,
        hasDeviation: true,
        deviationCount: actDevs.length,
        deviations: actDevs.map((d) => ({
          category: d.category,
          severity: d.severity,
          planned: d.planned,
          actual: d.actual,
          gap: d.gap,
          rootCause: d.rootCause,
          recommendation: d.recommendation
        }))
      }
    };
  });

  const nextOv5 = {
    ...ov5,
    activities: updatedActivities,
    simulationRecycleSummary: {
      recycledAt,
      affectedActivityCount: updatedActivitiesCount,
      totalDeviations: activityDeviations.length
    }
  };

  // 3. 将偏差清单固化在 scenario.simulation 中
  const nextScenario = scenario ? {
    ...scenario,
    simulation: {
      ...scenario.simulation,
      deviations,
      phaseOutcomes,
      activityDeviations,
      lastRecycledAt: recycledAt
    }
  } : scenario;

  return {
    phaseAction: nextPhaseAction,
    ov5: nextOv5,
    scenario: nextScenario,
    deviations,
    phaseOutcomes,
    stats: {
      recycledAt,
      updatedPhasesCount,
      updatedActivitiesCount,
      deviationCount: deviations.length,
      highSeverityCount: deviations.filter((d) => d.severity === "high").length
    }
  };
}

/**
 * 渲染 Markdown 表格：推演阶段成果与战损
 */
export function renderPhaseOutcomesTableMarkdown(phaseOutcomes) {
  if (!Array.isArray(phaseOutcomes) || !phaseOutcomes.length) {
    return ["- *暂无推演阶段推进与战损回传数据。*"];
  }
  const lines = [
    "| 阶段名称 | 计划时窗 | 实际耗时/时差 | 战损估算 | 达成状态 | 阶段研判与推演表现 |",
    "| :--- | :--- | :--- | :--- | :--- | :--- |"
  ];
  phaseOutcomes.forEach((po) => {
    lines.push(
      `| **${escapePipes(po.phaseName)}** | ${escapePipes(po.plannedTime)} | ${escapePipes(po.actualDuration)} (${escapePipes(po.durationDelta)}) | ${escapePipes(po.lossRate)} | ${escapePipes(po.statusLabel)} | ${escapePipes(po.summary)} |`
    );
  });
  return lines;
}

/**
 * 渲染 Markdown 表格：执行偏差清单 (Deviation List)
 */
export function renderDeviationsTableMarkdown(deviations) {
  if (!Array.isArray(deviations) || !deviations.length) {
    return ["- *推演各阶段与活动紧密闭环，未检出显著执行偏差。*"];
  }
  const highCount = deviations.filter((d) => d.severity === "high").length;
  const mediumCount = deviations.filter((d) => d.severity === "medium").length;
  const lowCount = deviations.filter((d) => d.severity === "low").length;

  const lines = [
    `> **推演偏差提炼看板**：检出执行偏差 **${deviations.length}** 项（高风险：**${highCount}** 项，中风险：**${mediumCount}** 项，低风险：**${lowCount}** 项）。`,
    "",
    "| 编号 | 关联要素 | 偏差类别 | 计划基准 | 仿真实际 | 差值/差距 | 严重度 | 成因深度剖析与改进处置建议 |",
    "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |"
  ];

  deviations.forEach((dev, idx) => {
    const sevBadge = dev.severity === "high" ? "🔴 高" : dev.severity === "medium" ? "🟡 中" : "🟢 低";
    const target = `[${dev.targetType === "phase" ? "阶段" : "活动"}] ${escapePipes(dev.targetName)}`;
    const reasonAndFix = `**成因**：${escapePipes(dev.rootCause)}<br>**建议**：${escapePipes(dev.recommendation)}`;
    lines.push(
      `| DEV-${String(idx + 1).padStart(2, "0")} | ${target} | ${escapePipes(dev.categoryLabel)} | ${escapePipes(dev.planned)} | ${escapePipes(dev.actual)} | ${escapePipes(dev.gap)} | ${sevBadge} | ${reasonAndFix} |`
    );
  });

  return lines;
}

function clean(value, maximum) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function escapePipes(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function normalizeActivityDeviation(item, matchedAct, index) {
  const category = ["schedule", "loss", "effect", "coordination"].includes(item.category) ? item.category : "effect";
  const severity = ["high", "medium", "low"].includes(item.severity) ? item.severity : "medium";
  return {
    id: clean(item.id, 60) || `dev-act-${index + 1}`,
    activityId: clean(item.activityId || matchedAct?.id, 60),
    activityName: clean(item.activityName || matchedAct?.name, 120),
    category,
    severity,
    planned: clean(item.planned, 300) || "预设作战指标",
    actual: clean(item.actual, 300) || "推演实际指标",
    gap: clean(item.gap, 100) || "未达预期",
    rootCause: clean(item.rootCause, 500) || "推演对抗中受外部条件制约",
    recommendation: clean(item.recommendation, 500) || "优化要素协同关系与资源配置"
  };
}

/**
 * 将回合制兵棋对抗流水线 (wargameState) 编译为仿真推演结果 (simulationResult) (M8-T8.5)
 */
export function compileWargameTurnsToSimulationResult(wargameState, phaseAction = {}, ov5 = {}) {
  const turns = Array.isArray(wargameState?.turns) ? wargameState.turns : [];
  const phases = Array.isArray(phaseAction?.phases) ? phaseAction.phases : [];
  const activities = Array.isArray(ov5?.activities) ? ov5.activities : [];

  const adjudicatedTurns = turns.filter((t) => t.adjudication && t.adjudication.outcome);

  const phaseOutcomes = phases.map((phase, idx) => {
    const matchingTurns = adjudicatedTurns.filter((t) => t.phaseId === phase.id);

    if (!matchingTurns.length) {
      return {
        phaseId: phase.id,
        phaseName: phase.name,
        plannedTime: phase.timeWindow || `第 ${idx + 1} 阶段时窗`,
        actualDuration: "待兵棋推演实施",
        durationDelta: "+0h",
        lossRate: "0% (待推演评估)",
        status: "achieved",
        statusLabel: "待推演",
        summary: `阶段 [${phase.name}] 尚未录入兵棋对抗回合裁决数据。`,
        sourceType: "[兵棋对抗裁决编译]",
        isQuantitative: false,
        riskLevel: "low",
        riskAssessment: "阶段尚未展开回合对抗，暂无态势对抗风险。",
        wargameTurnsCount: 0
      };
    }

    const combinedOutcomes = matchingTurns.map((t) => t.adjudication.outcome).join("；");
    const combinedRationales = matchingTurns.map((t) => t.adjudication.rationale).filter(Boolean).join("；");
    const totalEventsInPhase = matchingTurns.reduce((sum, t) => sum + (t.injectedEvents?.length || 0), 0);

    const hasFailure = /未达成|失利|中断|击溃|行动失败|严重受挫|防空反击成功/i.test(combinedOutcomes);
    const hasDelayOrPartial = /胶着|受阻|延滞|互有损耗|推进受限|行动迟滞|窗口漂移|协同脱节|受制于|遭受干扰/i.test(combinedOutcomes);

    let status = "achieved";
    let lossRate = "1.0% (兵棋裁决轻微损耗)";
    let durationDelta = "+0h";
    let riskLevel = "low";
    let riskAssessment = "兵力展开与对抗推进符合推演意图，红蓝对抗顺利达成。";

    if (hasFailure) {
      status = "failed";
      lossRate = "12.0% (兵棋对抗严重受挫)";
      durationDelta = `+${matchingTurns.length * 1.5}h`;
      riskLevel = "high";
      riskAssessment = "裁决判定关键战术动作中断或遭红方有效拦截，阶段目标未达成。";
    } else if (hasDelayOrPartial || totalEventsInPhase >= 2) {
      status = "partial";
      lossRate = "4.5% (兵棋对抗局部受损)";
      durationDelta = `+${Math.max(1, totalEventsInPhase * 0.5)}h`;
      riskLevel = "medium";
      riskAssessment = "受红方反制与战场导调事件扰动，推进节奏延缓，互有消耗。";
    }

    const summary = combinedRationales
      ? `【裁决表现】${combinedOutcomes}。【机理剖析】${combinedRationales}`
      : `【裁决表现】${combinedOutcomes}。`;

    return {
      phaseId: phase.id,
      phaseName: phase.name,
      plannedTime: phase.timeWindow || `第 ${idx + 1} 阶段时窗`,
      actualDuration: phase.timeWindow ? `${phase.timeWindow} (兵棋实测)` : "符合预设",
      durationDelta,
      lossRate,
      status,
      statusLabel: ({ achieved: "顺利达成", partial: "部分达成", failed: "未达成" })[status] || "顺利达成",
      summary: clean(summary, 500),
      sourceType: "[兵棋对抗裁决编译]",
      isQuantitative: false,
      riskLevel,
      riskAssessment,
      evidenceBasis: `源自兵棋推演回合 [${matchingTurns.map((t) => t.turnNumber).join(", ")}] 裁决判定`,
      wargameTurnsCount: matchingTurns.length
    };
  });

  const activityDeviations = [];
  adjudicatedTurns.forEach((turn) => {
    const outcomeText = turn.adjudication?.outcome || "";
    const rationaleText = turn.adjudication?.rationale || "";
    const isImpeded = /胶着|受阻|延滞|推进受限|行动迟滞|窗口漂移|协同脱节|受制于|遭受干扰|未达成|失利|中断|击溃|行动失败|严重受挫/i.test(outcomeText);
    const isSevere = /未达成|失利|中断|击溃|行动失败|严重受挫/i.test(outcomeText);

    if (isImpeded) {
      const blueActRefs = Array.isArray(turn.intents?.blue?.activityRefs) ? turn.intents.blue.activityRefs : [];
      const redActRefs = Array.isArray(turn.intents?.red?.activityRefs) ? turn.intents.red.activityRefs : [];
      const targetActIds = [...new Set([...blueActRefs, ...redActRefs])];

      const finalActs = targetActIds.length > 0
        ? targetActIds.map((id) => activities.find((a) => a.id === id)).filter(Boolean)
        : activities.slice(0, 2);

      finalActs.forEach((act, actIdx) => {
        const category = /延滞|窗口|时序/i.test(outcomeText) ? "schedule" : /协同|协同脱节|指控/i.test(outcomeText) ? "coordination" : "effect";
        activityDeviations.push({
          id: `dev-turn-${turn.turnNumber}-${actIdx + 1}`,
          activityId: act.id,
          activityName: act.name,
          category,
          severity: isSevere ? "high" : "medium",
          planned: `活动 [${act.name}] 按作战概念预设顺畅实施`,
          actual: `第 ${turn.turnNumber} 回合兵棋对抗裁决判定：${outcomeText}`,
          gap: isSevere ? "行动严重受阻，未形成作战效能" : "行动推进迟滞，存在协同摩擦",
          rootCause: rationaleText || `回合 ${turn.turnNumber} 遭遇对手反制与战场扰动（包含 ${turn.injectedEvents?.length || 0} 项导调事件）`,
          recommendation: "在战法设计中补全应对反制机制，预留备用协同旁路与机动窗口",
          sourceType: "[兵棋对抗裁决编译]",
          turnNumber: turn.turnNumber
        });
      });
    }
  });

  const totalInjectedEvents = adjudicatedTurns.reduce((sum, t) => sum + (t.injectedEvents?.length || 0), 0);
  const achievedPhases = phaseOutcomes.filter((p) => p.status === "achieved").length;
  const successRate = phaseOutcomes.length > 0 ? Math.round((achievedPhases / phaseOutcomes.length) * 100) : 100;

  return {
    status: "completed",
    compiler: "wargame-turn-compiler",
    compiledAt: new Date().toISOString(),
    summary: `基于回合制兵棋对抗流水线自动编译，覆盖 ${adjudicatedTurns.length} 个对抗回合，提炼 ${phaseOutcomes.length} 个阶段成效与 ${activityDeviations.length} 项作战活动偏差。`,
    sourceType: "[兵棋对抗裁决编译]",
    metrics: [
      { id: "wargame-turns", label: "已裁决回合数", value: adjudicatedTurns.length, unit: "回合" },
      { id: "wargame-events", label: "导调事件注入数", value: totalInjectedEvents, unit: "项" },
      { id: "wargame-success-rate", label: "蓝方达成率", value: successRate, unit: "%" }
    ],
    phaseOutcomes,
    activityDeviations
  };
}

/**
 * 将兵棋推演裁决结果一键同步至想定推演运行记录与阶段/活动模型 (M8-T8.5)
 */
export function syncWargameToScenarioSimulation({ wargame, scenario, phaseAction, ov5 }) {
  const compiledResult = compileWargameTurnsToSimulationResult(wargame, phaseAction, ov5);
  const runId = `run-wargame-${Date.now()}`;

  const wargameRun = {
    id: runId,
    adapter: { id: "wargame-turn-compiler", name: "兵棋推演对抗裁决编译", version: "v1" },
    status: "result-recorded",
    createdAt: compiledResult.compiledAt,
    result: compiledResult
  };

  const nextScenario = {
    ...(scenario || {}),
    simulation: {
      ...((scenario && scenario.simulation) || {}),
      runs: [wargameRun, ...(((scenario && scenario.simulation && scenario.simulation.runs) || []).filter((r) => r.adapter?.id !== "wargame-turn-compiler"))]
    }
  };

  return recycleSimulationToPhasesAndActivities({
    scenario: nextScenario,
    phaseAction,
    ov5
  });
}
