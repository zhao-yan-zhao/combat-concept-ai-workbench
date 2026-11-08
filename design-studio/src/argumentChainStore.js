/**
 * argumentChainStore.js
 * M7-T7.1 战法设计线：制胜机理“论证链”与关键假设清单
 * 结构：{ claim, reasoning, evidenceRefs, assumptions: [{ id, text, confidence: "高|中|低", ifFalse, activityRefs }] }
 */

export const CONFIDENCE_LEVELS = ["低", "中", "高"];

const CONFIDENCE_WEIGHT = {
  低: 1, // 风险最高，优先置顶排查
  中: 2,
  高: 3
};

/**
 * 规范化论证链对象
 * 保持与旧版 state.brief.assumptions 纯文本向后兼容并平滑迁移
 */
export function normalizeArgumentChain(raw = {}, briefFallback = {}) {
  const source = raw && typeof raw === "object" ? raw : {};

  // 如果没有主张或机理，尝试从 briefFallback 派生
  const claim = String(source.claim || briefFallback.approach || briefFallback.objective || "通过多域异构协同与快速闭环达成制胜优势").trim();
  const reasoning = String(source.reasoning || briefFallback.approach || "依托跨域协同链路与自主赋能，通过先发感知与错峰突击打破对抗平衡").trim();

  // 证据引用
  const evidenceRefs = Array.isArray(source.evidenceRefs)
    ? source.evidenceRefs.map((ref) => ({
        chunkId: String(ref.chunkId || ""),
        title: String(ref.title || "参考依据"),
        filePath: String(ref.filePath || ""),
        score: typeof ref.score === "number" ? ref.score : 0.85,
        snippet: String(ref.snippet || "")
      }))
    : [];

  // 假设清单
  let assumptions = [];
  if (Array.isArray(source.assumptions) && source.assumptions.length > 0) {
    assumptions = source.assumptions.map((a, idx) => normalizeAssumptionItem(a, idx + 1));
  } else if (briefFallback.assumptions && typeof briefFallback.assumptions === "string") {
    // 从纯文本解析行
    const lines = briefFallback.assumptions
      .split(/\r?\n|[；;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    assumptions = lines.map((line, idx) => ({
      id: `asm-${idx + 1}`,
      text: line.replace(/^[0-9一二三四五六七八九十]+[、.．\s]*/, ""),
      confidence: idx === 0 ? "低" : "中",
      ifFalse: "作战协同出现断点，行动进度受阻",
      activityRefs: []
    }));
  }

  if (assumptions.length === 0) {
    assumptions = [
      {
        id: "asm-1",
        text: "关键战术通信网络在强电磁干扰下仍保有基础报文通联能力",
        confidence: "低",
        ifFalse: "跨域协同指挥延误大幅攀升，无法形成多源数据融合",
        activityRefs: []
      },
      {
        id: "asm-2",
        text: "无人集群自主避障与局部重组时延满足快速突防窗口要求",
        confidence: "中",
        ifFalse: "突防突击队列失序，抗拦截损伤率上升",
        activityRefs: []
      }
    ];
  }

  return {
    claim,
    reasoning,
    evidenceRefs,
    assumptions,
    updatedAt: source.updatedAt || new Date().toISOString()
  };
}

export function normalizeAssumptionItem(item = {}, index = 1) {
  const conf = String(item.confidence || "中").trim();
  const validConfidence = CONFIDENCE_LEVELS.includes(conf) ? conf : "中";
  const rawId = String(item.id || "").trim();
  const id = rawId || `asm-${index}`;
  const text = String(item.text || item.title || `关键假设 ${index}`).trim();
  const ifFalse = item.ifFalse !== undefined
    ? String(item.ifFalse).trim()
    : (item.consequence !== undefined ? String(item.consequence).trim() : "假设若失效，对应协同链条将产生滞后甚至中断");
  const activityRefs = Array.isArray(item.activityRefs)
    ? item.activityRefs.map((id) => String(id).trim()).filter(Boolean)
    : [];

  return {
    id,
    text,
    confidence: validConfidence,
    ifFalse,
    activityRefs
  };
}

/**
 * 汇总关键假设清单并按置信度排序（低置信度排在最前面警示）
 */
export function getSortedAssumptions(argumentChain) {
  const chain = normalizeArgumentChain(argumentChain);
  return [...chain.assumptions].sort((a, b) => {
    const wa = CONFIDENCE_WEIGHT[a.confidence] || 2;
    const wb = CONFIDENCE_WEIGHT[b.confidence] || 2;
    if (wa !== wb) return wa - wb; // 1(低) < 2(中) < 3(高)
    return a.id.localeCompare(b.id);
  });
}

/**
 * 评估假设失效时的连锁波及影响
 * 分析如果某个低/中置信度假设被推翻，哪些 OV-5 活动、作战阶段与协同力量会受牵连失效
 */
export function evaluateAssumptionImpact(argumentChain, ov5Model = {}, forceMission = {}, phaseAction = {}) {
  const chain = normalizeArgumentChain(argumentChain);
  const activities = Array.isArray(ov5Model?.activities) ? ov5Model.activities : [];
  const activityMap = new Map(activities.map((act) => [act.id, act]));

  const phases = Array.isArray(phaseAction?.phases) ? phaseAction.phases : [];
  const phaseMap = new Map(phases.map((p) => [p.id, p]));

  const forces = Array.isArray(forceMission?.forces) ? forceMission.forces : [];
  const forceMap = new Map(forces.map((f) => [f.id, f]));

  const sorted = getSortedAssumptions(chain);

  return sorted.map((assumption) => {
    const impactedActivities = [];
    const phaseNamesSet = new Set();
    const performerNamesSet = new Set();

    (assumption.activityRefs || []).forEach((actId) => {
      const act = activityMap.get(actId);
      if (act) {
        const phaseName = act.phaseId && phaseMap.has(act.phaseId)
          ? phaseMap.get(act.phaseId).name
          : act.phase || "通用阶段";
        const performerName = act.performerId && forceMap.has(act.performerId)
          ? forceMap.get(act.performerId).name
          : act.performer || act.domain || "未定力量";

        impactedActivities.push({
          id: act.id,
          name: act.name,
          phaseName,
          performerName
        });
        phaseNamesSet.add(phaseName);
        performerNamesSet.add(performerName);
      } else {
        impactedActivities.push({
          id: actId,
          name: `活动(${actId})`,
          phaseName: "未知阶段",
          performerName: "未知实体"
        });
      }
    });

    // 计算失效影响严重度
    let severity = "low";
    if (assumption.confidence === "低") {
      severity = impactedActivities.length > 0 ? "critical" : "high";
    } else if (assumption.confidence === "中") {
      severity = impactedActivities.length > 0 ? "medium" : "low";
    }

    const activityNames = impactedActivities.map((a) => a.name).slice(0, 3).join("、");
    const phaseNames = Array.from(phaseNamesSet).join("、") || "全过程";
    const performerNames = Array.from(performerNamesSet).join("、") || "相关作战单元";

    let summary = "";
    if (impactedActivities.length > 0) {
      summary = `【${assumption.confidence}置信度】若假设失效，波及阶段[${phaseNames}]，将直接导致[${activityNames}${impactedActivities.length > 3 ? "等" : ""}]无法按既定构想执行，影响力量[${performerNames}]。后果：${assumption.ifFalse}`;
    } else {
      summary = `【${assumption.confidence}置信度】假设暂未关联具体活动，潜在影响：${assumption.ifFalse}`;
    }

    return {
      assumptionId: assumption.id,
      text: assumption.text,
      confidence: assumption.confidence,
      ifFalse: assumption.ifFalse,
      activityRefs: assumption.activityRefs,
      impactedActivities,
      impactedPhases: Array.from(phaseNamesSet),
      impactedPerformers: Array.from(performerNamesSet),
      severity,
      summary
    };
  });
}

/**
 * 保存论证链到全局 state，并向下同步更新 brief.assumptions 保证向后兼容
 */
export function saveArgumentChain(state, argumentChain) {
  if (!state) return;
  if (!state.ov5) state.ov5 = { activities: [], edges: [] };
  const normalized = normalizeArgumentChain(argumentChain, state.brief || {});
  state.ov5.argumentChain = normalized;

  // 保证向后兼容：同步简报文本摘要
  if (state.brief) {
    const lines = normalized.assumptions.map((a, i) => `${i + 1}. [${a.confidence}置信度] ${a.text} (失效后果: ${a.ifFalse})`);
    state.brief.assumptions = lines.join("\n");
  }

  return normalized;
}

/**
 * 增加一条假设
 */
export function addAssumptionToChain(argumentChain, partial = {}) {
  const chain = argumentChain && Array.isArray(argumentChain.assumptions) ? argumentChain : normalizeArgumentChain(argumentChain);
  const nextIdx = chain.assumptions.length + 1;
  const newAssumption = normalizeAssumptionItem({
    id: `asm-${Date.now().toString(36).slice(-4)}`,
    text: "新增作战前提假设",
    confidence: "中",
    ifFalse: "作战效能降级",
    activityRefs: [],
    ...partial
  }, nextIdx);

  chain.assumptions.push(newAssumption);
  chain.updatedAt = new Date().toISOString();
  return chain;
}

/**
 * 删除一条假设
 */
export function removeAssumptionFromChain(argumentChain, assumptionId) {
  const chain = argumentChain && Array.isArray(argumentChain.assumptions) ? argumentChain : normalizeArgumentChain(argumentChain);
  chain.assumptions = chain.assumptions.filter((a) => a.id !== assumptionId);
  chain.updatedAt = new Date().toISOString();
  return chain;
}

/**
 * 更新指定假设
 */
export function updateAssumptionInChain(argumentChain, assumptionId, updates = {}) {
  const chain = argumentChain && Array.isArray(argumentChain.assumptions) ? argumentChain : normalizeArgumentChain(argumentChain);
  const item = chain.assumptions.find((a) => a.id === assumptionId);
  if (item) {
    if (updates.text !== undefined) item.text = String(updates.text).trim();
    if (updates.confidence !== undefined && CONFIDENCE_LEVELS.includes(updates.confidence)) {
      item.confidence = updates.confidence;
    }
    if (updates.ifFalse !== undefined) item.ifFalse = String(updates.ifFalse).trim();
    if (Array.isArray(updates.activityRefs)) {
      item.activityRefs = updates.activityRefs.map((id) => String(id).trim()).filter(Boolean);
    }
    chain.updatedAt = new Date().toISOString();
  }
  return chain;
}
