const STORAGE_KEY = "concept-studio-ooda-model-v1";

const laneDefinitions = [
  { id: "observe", title: "Observe", subtitle: "观察", color: "#2a72a8" },
  { id: "orient", title: "Orient", subtitle: "判断", color: "#187a57" },
  { id: "decide", title: "Decide", subtitle: "决策", color: "#ad7a19" },
  { id: "act", title: "Act", subtitle: "行动", color: "#bd554d" }
];

export function hasPersistedOodaModel() {
  try {
    return isValidModel(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return false;
  }
}

/**
 * 动态 OODA 闭环健康度诊断引擎（只读透镜）
 * 根据 OV-5b 活动流拓扑与语义，实时评估杀伤网与决策闭环的完整度与因果闭合性。
 * @param {object} ov5Model OV-5 作战活动模型 (含 activities 和 edges)
 * @returns {{ categorized: object, diagnostics: Array<object>, healthScore: number, loopClosed: boolean, feedbackEdges: Array<object> }}
 */
export function evaluateOodaLoopHealth(ov5Model = {}, options = {}) {
  const activities = Array.isArray(ov5Model?.activities) ? ov5Model.activities : [];
  const edges = Array.isArray(ov5Model?.edges) ? ov5Model.edges : [];
  const activityMap = new Map(activities.map((a) => [a.id, a]));

  const matchKeywords = (activity, keywords) => {
    const text = [
      activity.type,
      activity.title,
      activity.text,
      activity.input,
      activity.output
    ].filter(Boolean).join(" ");
    return keywords.some((kw) => text.includes(kw));
  };

  const categorized = {
    observe: activities.filter((a) => matchKeywords(a, ["感知", "侦察", "监视", "探测", "预警", "巡逻", "搜潜", "雷达"])),
    orient: activities.filter((a) => matchKeywords(a, ["识别", "融合", "评估", "判断", "分析", "分批", "跟踪", "解算", "判决"])),
    decide: activities.filter((a) => matchKeywords(a, ["决策", "协同", "规划", "任务分配", "指挥", "授权", "下达", "指控"])),
    act: activities.filter((a) => matchKeywords(a, ["打击", "干扰", "机动", "发射", "防护", "拦截", "突击", "压制", "控制", "行动"])),
    feedback: activities.filter((a) => matchKeywords(a, ["战损评估", "战果确认", "态势更新", "回传", "毁伤", "效果评估", "反馈", "重组"]))
  };

  const diagnostics = [];

  // 1. 检查各环基础活动覆盖
  if (!categorized.observe.length) {
    diagnostics.push({
      level: "error",
      code: "NO_OBSERVE",
      label: "缺少感知活动 (Observe)",
      message: "活动网络中未检测到侦察预警或态势感知活动，决策链缺乏源头输入。"
    });
  }
  if (!categorized.decide.length) {
    diagnostics.push({
      level: "warn",
      code: "NO_DECIDE",
      label: "缺少决策节点 (Decide)",
      message: "活动网络中缺少明确的指挥协同或任务分配决策活动，易受单点断链影响。"
    });
  }
  if (!categorized.act.length) {
    diagnostics.push({
      level: "error",
      code: "NO_ACT",
      label: "缺少行动节点 (Act)",
      message: "活动网络中缺少实质作战行动（打击、干扰、防护等），作战能力无法闭合。"
    });
  }

  // 2. 检查反哺闭环 (Feedback Loop)
  const actAndFeedbackIds = new Set([
    ...categorized.act.map((a) => a.id),
    ...categorized.feedback.map((a) => a.id)
  ]);
  const observeAndDecideIds = new Set([
    ...categorized.observe.map((a) => a.id),
    ...categorized.orient.map((a) => a.id),
    ...categorized.decide.map((a) => a.id)
  ]);

  const feedbackEdges = edges.filter((edge) => {
    const srcId = edge.sourceId;
    const tgtId = edge.targetId;
    return actAndFeedbackIds.has(srcId) && observeAndDecideIds.has(tgtId);
  });

  const loopClosed = feedbackEdges.length > 0;
  if (!loopClosed && activities.length >= 3) {
    diagnostics.push({
      level: "critical_gap",
      code: "NO_FEEDBACK_LOOP",
      label: "未形成自适应闭环 (No Feedback)",
      message: "行动/打击后缺少向感知或决策层回传的反馈边，未形成闭合的 OODA 自适应作战循环。",
      quickFixAction: "recommend-feedback-activity"
    });
  }

  // 3. 检查孤立节点
  const connectedNodeIds = new Set(edges.flatMap((e) => [e.sourceId, e.targetId]));
  const orphanActivities = activities.filter((a) => !connectedNodeIds.has(a.id));
  if (orphanActivities.length > 0 && activities.length > 1) {
    diagnostics.push({
      level: "warn",
      code: "ORPHAN_ACTIVITIES",
      label: `存在 ${orphanActivities.length} 个未连接活动`,
      message: `活动 [${orphanActivities.slice(0, 3).map((a) => a.title).join(", ")}${orphanActivities.length > 3 ? "..." : ""}] 尚未配置前后置信息流或控制流。`
    });
  }

  // 4. 深度动力学测算：DAG 关键路径时延预算、单点脆弱性(SPOF)与自主等级评估
  const targetWindowSeconds = Number(options?.targetWindowSeconds || ov5Model?.targetWindowSeconds || 1800);
  const latencyBudget = calculateLatencyBudget(activities, edges, { targetWindowSeconds, categorized });

  if (latencyBudget.exceedsBudget) {
    diagnostics.push({
      level: "warn",
      code: "KILL_CHAIN_LATENCY_EXCEEDED",
      label: `杀伤网时延超出窗口 (${latencyBudget.formattedTotal} > ${latencyBudget.formattedBudget})`,
      message: `杀伤网关键路径耗时达 ${latencyBudget.formattedTotal}，超出设定的目标暴露时间窗（${latencyBudget.formattedBudget}）。关键耗时路径：${latencyBudget.criticalPathLabels?.join(" ➔ ") || "关键路径"}。`
    });
  }

  // 5. 计算综合健康度得分 (0 - 100)
  let score = 100;
  for (const d of diagnostics) {
    if (d.level === "critical_gap") score -= 30;
    else if (d.level === "error") score -= 20;
    else if (d.level === "warn") score -= 10;
  }
  if (!activities.length) score = 0;
  const healthScore = Math.max(0, Math.min(100, score));

  const bottlenecks = findSinglePointsOfFailure(activities, edges);
  const autonomyStats = calculateAutonomyStats(activities);
  const domainCoverage = [...new Set(activities.map((a) => a.domain || "综合").filter(Boolean))];

  return {
    categorized,
    diagnostics,
    healthScore,
    loopClosed,
    feedbackEdges,
    stats: {
      observeCount: categorized.observe.length,
      orientCount: categorized.orient.length,
      decideCount: categorized.decide.length,
      actCount: categorized.act.length,
      feedbackCount: categorized.feedback.length
    },
    latencyBudget,
    bottlenecks,
    autonomyStats,
    domainCoverage
  };
}

/**
 * 解析活动耗时（秒）
 * 匹配 "120s"、"5m"、"10分钟"、"1.5小时"、"5-10m" 等，未填写默认 60s
 */
export function parseActivitySeconds(durationStr) {
  const text = String(durationStr || "").trim().toLowerCase();
  if (!text || text === "待估算" || text === "持续") return 60;
  const minMatch = text.match(/(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?\s*(?:m|min|分钟)/i);
  if (minMatch) {
    const min = Number(minMatch[2] || minMatch[1]);
    return Math.round(min * 60);
  }
  const secMatch = text.match(/(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?\s*(?:s|sec|秒)/i);
  if (secMatch) {
    return Math.round(Number(secMatch[2] || secMatch[1]));
  }
  const hourMatch = text.match(/(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?\s*(?:h|hour|小时)/i);
  if (hourMatch) {
    return Math.round(Number(hourMatch[2] || hourMatch[1]) * 3600);
  }
  return 120;
}

/**
 * 格式化持续时长
 */
export function formatDurationSeconds(totalSeconds) {
  const sec = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (sec >= 3600) {
    return `${(sec / 3600).toFixed(1)} 小时`;
  }
  if (sec >= 60) {
    const mins = sec / 60;
    return mins % 1 === 0 ? `${mins} 分钟` : `${mins.toFixed(1)} 分钟`;
  }
  return `${sec} 秒`;
}

/**
 * 有向图自动破除反馈边（避免循环死锁）
 */
export function filterForwardDagEdges(activities = [], edges = [], categorized = null) {
  const nodeIds = new Set(activities.map((a) => a.id));
  const validEdges = edges.filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId) && e.sourceId !== e.targetId);

  const actAndFeedback = new Set([
    ...(categorized?.act || []).map((a) => a.id),
    ...(categorized?.feedback || []).map((a) => a.id)
  ]);
  const observeAndDecide = new Set([
    ...(categorized?.observe || []).map((a) => a.id),
    ...(categorized?.orient || []).map((a) => a.id),
    ...(categorized?.decide || []).map((a) => a.id)
  ]);

  const sortedCandidateEdges = [...validEdges].sort((a, b) => {
    const aIsFeedback = actAndFeedback.has(a.sourceId) && observeAndDecide.has(a.targetId);
    const bIsFeedback = actAndFeedback.has(b.sourceId) && observeAndDecide.has(b.targetId);
    if (aIsFeedback && !bIsFeedback) return 1;
    if (!aIsFeedback && bIsFeedback) return -1;
    return 0;
  });

  const adj = new Map();
  for (const id of nodeIds) adj.set(id, []);

  function hasCycle(src, tgt, currentAdj) {
    const visited = new Set();
    const queue = [tgt];
    while (queue.length > 0) {
      const curr = queue.shift();
      if (curr === src) return true;
      if (!visited.has(curr)) {
        visited.add(curr);
        const neighbors = currentAdj.get(curr) || [];
        for (const n of neighbors) {
          if (!visited.has(n)) queue.push(n);
        }
      }
    }
    return false;
  }

  const forwardEdges = [];
  for (const edge of sortedCandidateEdges) {
    if (hasCycle(edge.sourceId, edge.targetId, adj)) {
      continue;
    }
    adj.get(edge.sourceId).push(edge.targetId);
    forwardEdges.push(edge);
  }

  return forwardEdges;
}

/**
 * 求解前向 DAG 关键路径 (CPM) 与最短杀伤链
 */
export function solveDagPaths(activities = [], forwardEdges = [], durationMap = new Map(), categorized = null) {
  if (!activities.length) {
    return {
      criticalPathSeconds: 0,
      criticalPathIds: [],
      fastestKillChainSeconds: 0,
      fastestKillChainIds: []
    };
  }

  const actIds = new Set((categorized?.act || []).map((a) => a.id));
  const obsIds = new Set((categorized?.observe || []).map((a) => a.id));

  const adj = new Map();
  const inDeg = new Map();
  const outDeg = new Map();
  for (const a of activities) {
    adj.set(a.id, []);
    inDeg.set(a.id, 0);
    outDeg.set(a.id, 0);
  }
  for (const e of forwardEdges) {
    adj.get(e.sourceId)?.push(e.targetId);
    inDeg.set(e.targetId, (inDeg.get(e.targetId) || 0) + 1);
    outDeg.set(e.sourceId, (outDeg.get(e.sourceId) || 0) + 1);
  }

  // 源节点优先使用 Observe 节点或入度为 0 的节点
  let sources = activities.filter((a) => obsIds.has(a.id) || (inDeg.get(a.id) || 0) === 0);
  if (!sources.length) sources = activities.filter((a) => (inDeg.get(a.id) || 0) === 0);
  if (!sources.length) sources = activities;

  // 汇节点优先使用 Act 行动节点（杀伤链末端）；若无则使用出度为 0 的节点
  const preferActSinks = actIds.size > 0;
  const targetSinkIds = preferActSinks ? actIds : new Set(activities.filter((a) => (outDeg.get(a.id) || 0) === 0).map((a) => a.id));

  // 记忆化搜索：从节点 u 到目标汇节点的最长和最短路径
  const memoLongest = new Map();
  const memoShortest = new Map();

  function findLongest(uId) {
    if (memoLongest.has(uId)) return memoLongest.get(uId);

    // 如果当前节点就是目标行动汇点
    if (targetSinkIds.has(uId)) {
      const res = { dist: 0, path: [uId], reachable: true };
      memoLongest.set(uId, res);
      return res;
    }

    const neighbors = adj.get(uId) || [];
    if (neighbors.length === 0) {
      // 达到终点但若不是目标 Act 且有指定 Act，则标记不可达完整杀伤链
      const res = { dist: 0, path: [uId], reachable: !preferActSinks };
      memoLongest.set(uId, res);
      return res;
    }

    let maxDist = -1;
    let bestPath = [uId];
    let reachable = false;

    for (const v of neighbors) {
      const vWeight = durationMap.get(v) ?? 60;
      const sub = findLongest(v);
      if (sub.reachable) {
        reachable = true;
        const total = vWeight + sub.dist;
        if (total > maxDist) {
          maxDist = total;
          bestPath = [uId, ...sub.path];
        }
      }
    }

    // 若下游无法到达目标 Act，但在普通图情况下允许任意出度为0的节点
    if (!reachable && !preferActSinks) {
      reachable = true;
      maxDist = 0;
    }

    const res = { dist: Math.max(0, maxDist), path: bestPath, reachable };
    memoLongest.set(uId, res);
    return res;
  }

  function findShortest(uId) {
    if (memoShortest.has(uId)) return memoShortest.get(uId);

    if (targetSinkIds.has(uId)) {
      const res = { dist: 0, path: [uId], reachable: true };
      memoShortest.set(uId, res);
      return res;
    }

    const neighbors = adj.get(uId) || [];
    if (neighbors.length === 0) {
      const res = { dist: 0, path: [uId], reachable: !preferActSinks };
      memoShortest.set(uId, res);
      return res;
    }

    let minDist = Infinity;
    let bestPath = [uId];
    let reachable = false;

    for (const v of neighbors) {
      const vWeight = durationMap.get(v) ?? 60;
      const sub = findShortest(v);
      if (sub.reachable) {
        reachable = true;
        const total = vWeight + sub.dist;
        if (total < minDist) {
          minDist = total;
          bestPath = [uId, ...sub.path];
        }
      }
    }

    if (!reachable && !preferActSinks) {
      reachable = true;
      minDist = 0;
    }

    const res = { dist: minDist === Infinity ? 0 : minDist, path: bestPath, reachable };
    memoShortest.set(uId, res);
    return res;
  }

  let criticalPathSeconds = 0;
  let criticalPathIds = [];

  let fastestKillChainSeconds = Infinity;
  let fastestKillChainIds = [];

  for (const s of sources) {
    const sWeight = durationMap.get(s.id) ?? 60;
    const lRes = findLongest(s.id);
    if (lRes.reachable) {
      const lTotal = sWeight + lRes.dist;
      if (lTotal > criticalPathSeconds) {
        criticalPathSeconds = lTotal;
        criticalPathIds = lRes.path;
      }
    }

    const sRes = findShortest(s.id);
    if (sRes.reachable) {
      const sTotal = sWeight + sRes.dist;
      if (sTotal < fastestKillChainSeconds) {
        fastestKillChainSeconds = sTotal;
        fastestKillChainIds = sRes.path;
      }
    }
  }

  // 若未能找到连接到 Act 的完整链条，回退使用入度0到出度0的全局最长/最短路
  if (!criticalPathIds.length) {
    for (const s of sources) {
      const sWeight = durationMap.get(s.id) ?? 60;
      let curr = s.id;
      let visited = new Set([curr]);
      let path = [curr];
      let dist = sWeight;
      while (true) {
        const nexts = (adj.get(curr) || []).filter((n) => !visited.has(n));
        if (!nexts.length) break;
        // 贪心选择耗时最大的后继
        nexts.sort((a, b) => (durationMap.get(b) || 60) - (durationMap.get(a) || 60));
        const bestNext = nexts[0];
        visited.add(bestNext);
        path.push(bestNext);
        dist += durationMap.get(bestNext) || 60;
        curr = bestNext;
      }
      if (dist > criticalPathSeconds) {
        criticalPathSeconds = dist;
        criticalPathIds = path;
      }
    }
  }

  if (fastestKillChainSeconds === Infinity) {
    fastestKillChainSeconds = criticalPathSeconds;
    fastestKillChainIds = [...criticalPathIds];
  }

  return {
    criticalPathSeconds,
    criticalPathIds,
    fastestKillChainSeconds,
    fastestKillChainIds
  };
}

/**
 * 杀伤网时延预算测算（支持 DAG 关键路径 CPM 与并行支路分析）
 */
export function calculateLatencyBudget(activities = [], edges = [], options = {}) {
  const budgetSeconds = Number(options?.targetWindowSeconds) > 0 ? Number(options.targetWindowSeconds) : 1800;
  const durationMap = new Map(activities.map((a) => [a.id, parseActivitySeconds(a.duration || a.timingWindow)]));
  const totalSumSeconds = [...durationMap.values()].reduce((acc, v) => acc + v, 0);

  const categorized = options?.categorized || {
    observe: activities.filter((a) => {
      const text = `${a.type || ""} ${a.title || ""} ${a.text || ""}`;
      return ["感知", "侦察", "监视", "探测", "预警", "巡逻", "搜潜", "雷达"].some((kw) => text.includes(kw));
    }),
    act: activities.filter((a) => {
      const text = `${a.type || ""} ${a.title || ""} ${a.text || ""}`;
      return ["打击", "干扰", "机动", "发射", "防护", "拦截", "突击", "压制", "控制", "行动"].some((kw) => text.includes(kw));
    }),
    feedback: activities.filter((a) => {
      const text = `${a.type || ""} ${a.title || ""} ${a.text || ""}`;
      return ["战损评估", "战果确认", "态势更新", "回传", "毁伤", "效果评估", "反馈", "重组", "评估"].some((kw) => text.includes(kw));
    })
  };

  const forwardEdges = filterForwardDagEdges(activities, edges, categorized);
  const { criticalPathSeconds, criticalPathIds, fastestKillChainSeconds, fastestKillChainIds } = solveDagPaths(
    activities,
    forwardEdges,
    durationMap,
    categorized
  );

  const actMap = new Map(activities.map((a) => [a.id, a]));
  const criticalPathLabels = criticalPathIds.map((id) => actMap.get(id)?.title || id);
  const fastestKillChainLabels = fastestKillChainIds.map((id) => actMap.get(id)?.title || id);

  const formattedTotal = formatDurationSeconds(criticalPathSeconds);
  const formattedBudget = formatDurationSeconds(budgetSeconds);
  const formattedFastest = formatDurationSeconds(fastestKillChainSeconds);
  const formattedParallelSum = formatDurationSeconds(totalSumSeconds);

  return {
    totalSeconds: criticalPathSeconds,
    criticalPathSeconds,
    criticalPathIds,
    criticalPathLabels,
    fastestKillChainSeconds,
    fastestKillChainIds,
    fastestKillChainLabels,
    parallelSumSeconds: totalSumSeconds,
    budgetSeconds,
    formattedTotal,
    formattedBudget,
    formattedFastest,
    formattedParallelSum,
    exceedsBudget: criticalPathSeconds > budgetSeconds
  };
}

function findSinglePointsOfFailure(activities = [], edges = []) {
  if (activities.length < 3) return [];
  const inDegree = new Map(activities.map((a) => [a.id, 0]));
  const outDegree = new Map(activities.map((a) => [a.id, 0]));
  edges.forEach((e) => {
    inDegree.set(e.targetId, (inDegree.get(e.targetId) || 0) + 1);
    outDegree.set(e.sourceId, (outDegree.get(e.sourceId) || 0) + 1);
  });

  return activities.filter((a) => {
    const isMidpoint = (inDegree.get(a.id) || 0) >= 1 && (outDegree.get(a.id) || 0) >= 1;
    const isCrucial = String(a.type).includes("决策") || String(a.type).includes("控制") || String(a.title).includes("中继");
    const hasNoFallback = !a.resilienceFallback;
    return isMidpoint && isCrucial && hasNoFallback;
  });
}

function calculateAutonomyStats(activities = []) {
  let hitl = 0;
  let hotl = 0;
  let hootl = 0;
  activities.forEach((a) => {
    const auto = String(a.autonomy || "").toUpperCase();
    if (auto === "HITL" || auto.includes("人在回路")) hitl += 1;
    else if (auto === "HOOTL" || auto.includes("全自主") || auto.includes("人外")) hootl += 1;
    else hotl += 1;
  });
  return { hitl, hotl, hootl, total: activities.length };
}

export function loadOodaModel(ov5Model) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (isValidModel(saved)) return saved;
  } catch {
    // Invalid local state falls back to an OV-5-derived model.
  }
  return deriveOodaFromOv5(ov5Model);
}

export function deriveOodaFromOv5(ov5Model) {
  const activities = ov5Model.activities || [];
  const pick = (types, fallbackIndex) => activities.find((item) => types.includes(item.type)) || activities[fallbackIndex] || {};
  const observe = pick(["感知", "识别"], 0);
  const orient = pick(["识别", "评估"], 1);
  const decide = pick(["决策"], 2);
  const act = pick(["行动", "控制"], 3);
  const feedback = pick(["控制", "评估"], 4);

  const model = {
    version: 1,
    sourceActivityIds: [observe.id, orient.id, decide.id, act.id, feedback.id].filter(Boolean),
    sourceOv5Signature: createOv5SourceSignature(ov5Model),
    derivedAt: new Date().toISOString(),
    stale: false,
    staleReason: "",
    lanes: laneDefinitions.map((lane) => ({ ...lane, nodes: [] }))
  };

  model.lanes[0].nodes = [createNode("observe", observe, "获取态势线索", "态势线索", "多源感知结果", "确认观测来源与时效")];
  model.lanes[1].nodes = [createNode("orient", orient, "分析对象属性", "态势线索", "目标数据包", "完成交叉验证后进入决策")];
  model.lanes[2].nodes = [createNode("decide", decide, "形成协同行动决策", "目标数据包、资源状态", "协同行动指令", "满足行动窗口与资源约束")];
  model.lanes[3].nodes = [
    createNode("act", act, "组织协同行动", "协同行动指令", "行动反馈", "按授权规则执行"),
    createNode("act", feedback, "回收并评估反馈", "行动反馈", "下一轮态势更新", "反馈进入下一轮观察")
  ];

  persistOodaModel(model);
  return model;
}

/** Compact OV-5 fingerprint used to detect whether an OODA model still matches its source activities. */
export function createOv5SourceSignature(ov5Model = {}) {
  return JSON.stringify({
    activities: (Array.isArray(ov5Model.activities) ? ov5Model.activities : []).map((activity) => ({
      id: activity.id,
      title: activity.title,
      type: activity.type,
      input: activity.input,
      output: activity.output,
      duration: activity.duration,
      sourceOv1NodeIds: Array.isArray(activity.sourceOv1NodeIds) ? [...activity.sourceOv1NodeIds].map(String).sort() : []
    })),
    edges: (Array.isArray(ov5Model.edges) ? ov5Model.edges : []).map((edge) => ({
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      type: edge.type
    }))
  });
}

export function isOodaStale(oodaModel, ov5Model) {
  if (!oodaModel) return false;
  if (oodaModel.stale) return true;
  const signature = oodaModel.sourceOv5Signature;
  if (signature) return signature !== createOv5SourceSignature(ov5Model);
  // Legacy models without a signature: stale if referenced OV-5 activities disappeared.
  const activityIds = new Set((ov5Model?.activities || []).map((activity) => String(activity.id)));
  const sourceIds = [
    ...(Array.isArray(oodaModel.sourceActivityIds) ? oodaModel.sourceActivityIds : []),
    ...(Array.isArray(oodaModel.lanes) ? oodaModel.lanes : []).flatMap((lane) => (lane.nodes || []).map((node) => node.sourceActivityId))
  ].map(String).filter(Boolean);
  return sourceIds.some((id) => !activityIds.has(id));
}

export function getOodaFreshness(oodaModel, ov5Model) {
  const stale = isOodaStale(oodaModel, ov5Model);
  if (!oodaModel) {
    return { stale: false, ran: false, reason: "", derivedAt: "" };
  }
  if (!stale) {
    return {
      stale: false,
      ran: true,
      reason: "",
      derivedAt: oodaModel.derivedAt || oodaModel.provenance?.generatedAt || ""
    };
  }
  return {
    stale: true,
    ran: true,
    reason: oodaModel.staleReason || "OV-5 活动或关系已变更，当前 OODA 仅供参考，建议从活动模型重新派生。",
    derivedAt: oodaModel.derivedAt || oodaModel.provenance?.generatedAt || ""
  };
}

export function persistOodaModel(model) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  } catch {
    // Node environment fallback
  }
}

export function addOodaNode(model, laneId) {
  const lane = model.lanes.find((item) => item.id === laneId);
  if (!lane) return null;
  const node = {
    id: `ooda-${laneId}-${Date.now()}`,
    sourceActivityId: "",
    title: "新行为节点",
    text: "补充该节点的行为说明。",
    duration: "待估算",
    input: "待定义",
    output: "待定义",
    rule: "待定义",
    equipmentRefs: [],
    knowledgeRefs: []
  };
  lane.nodes.push(node);
  persistOodaModel(model);
  return node;
}

export function updateOodaNode(model, nodeId, patch) {
  const node = findNode(model, nodeId);
  if (!node) return null;
  Object.assign(node, patch);
  persistOodaModel(model);
  return node;
}

export function deleteOodaNode(model, nodeId) {
  for (const lane of model.lanes) {
    const index = lane.nodes.findIndex((node) => node.id === nodeId);
    if (index >= 0) {
      lane.nodes.splice(index, 1);
      persistOodaModel(model);
      return true;
    }
  }
  return false;
}

export function getOodaDuration(model) {
  return model.lanes.flatMap((lane) => lane.nodes)
    .reduce((sum, node) => sum + parseMinutes(node.duration), 0);
}

function createNode(laneId, activity, fallbackTitle, fallbackInput, fallbackOutput, rule) {
  return {
    id: `ooda-${laneId}-${activity.id || fallbackTitle}`,
    sourceActivityId: activity.id || "",
    title: activity.title || fallbackTitle,
    text: activity.text || fallbackTitle,
    duration: activity.duration || "待估算",
    input: activity.input || fallbackInput,
    output: activity.output || fallbackOutput,
    rule,
    equipmentRefs: normalizeEquipmentRefs(activity.resources),
    knowledgeRefs: normalizeKnowledgeRefs(activity.refs)
  };
}

export function normalizeEquipmentRefs(value) {
  return normalizeOodaRefs(value);
}

export function normalizeKnowledgeRefs(value) {
  return normalizeOodaRefs(value);
}

function normalizeOodaRefs(value) {
  const entries = Array.isArray(value) ? value : String(value || "").split(/[，,、;；\n]/);
  return [...new Set(entries.map((item) => String(item || "").replace(/\s+/g, " ").trim()).filter(Boolean))].slice(0, 16).map((item) => item.slice(0, 160));
}

function findNode(model, nodeId) {
  return model.lanes.flatMap((lane) => lane.nodes).find((node) => node.id === nodeId);
}

function parseMinutes(value) {
  const match = String(value || "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function isValidModel(model) {
  return Boolean(
    model
    && model.version === 1
    && Array.isArray(model.lanes)
    && model.lanes.every((lane) => Array.isArray(lane.nodes))
  );
}
