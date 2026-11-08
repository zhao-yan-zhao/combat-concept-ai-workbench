/**
 * wargameTurnStore.js
 * M7-T7.6 想定推演线：推演回合与导调引擎
 * 
 * 核心流程：
 * 1. 各方提交行动意图（概念层面文字描述 + 关联阶段与活动）
 * 2. 导演部注入事件（从事件卡库选择或自定义）
 * 3. 导演部裁决结果（人工裁决 + AI/本地裁决建议与理由，绝无数值化杀伤计算）
 * 4. 进入下一回合
 */

export const PRESET_EVENT_CARDS = [
  {
    id: "card-comm-loss",
    title: "战术通信中断",
    category: "通信与网络",
    detail: "前沿中继链路受到强电磁噪声压制，指令通联时延大幅增加，协同报文发生丢失。",
    suggestedImpact: "跨域协同指挥延误增加，各单元转入预置自主规则。"
  },
  {
    id: "card-situ-bias",
    title: "态势认知误判",
    category: "态势感知",
    detail: "前推传感器截获多批假目标回波，指挥所对主突方向判断出现分歧。",
    suggestedImpact: "侦察探测资源向佯动方向倾斜，主力应对响应出现窗口滞后。"
  },
  {
    id: "card-ally-delay",
    title: "协同兵力延误",
    category: "机动与协同",
    detail: "侧翼支援编组在航渡机动中遭遇恶劣海况与阻击，未能按预定时间窗口就位。",
    suggestedImpact: "牵制波次与主攻波次脱节，无法达成首波次饱和打击。"
  },
  {
    id: "card-weather-bad",
    title: "极端气象扰动",
    category: "环境气象",
    detail: "战区上空突发强对流雷暴与剧烈风切变，低空低速无人集群飞行受限。",
    suggestedImpact: "光电红外载荷探测距离衰减 50%，航路被迫重构并提高巡航高度。"
  },
  {
    id: "card-cyber-attack",
    title: "指控网络降级",
    category: "网络电磁",
    detail: "战术协同总线遭遇网络注入攻击，多源航迹融合处理单元算力阻塞。",
    suggestedImpact: "态势刷新频率由秒级降至分钟级，防空反导授权响应变缓。"
  },
  {
    id: "card-radar-silent",
    title: "骨干雷达关机防反辐射",
    category: "雷达与电子对抗",
    detail: "侦测到对手反辐射游弋导弹逼近，主要预警雷达被迫采取规避性间歇关机。",
    suggestedImpact: "空域中高空盲区扩大，依赖被动红外与前哨节点接替引导。"
  }
];

/**
 * 规范化推演状态
 */
export function normalizeWargameState(raw = {}, context = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const phases = Array.isArray(context.phases) ? context.phases : [];

  const eventCardLibrary = Array.isArray(source.eventCardLibrary) && source.eventCardLibrary.length > 0
    ? source.eventCardLibrary.map(normalizeEventCard)
    : [...PRESET_EVENT_CARDS];

  let turns = [];
  if (Array.isArray(source.turns) && source.turns.length > 0) {
    turns = source.turns.map((t, idx) => normalizeTurn(t, idx + 1, phases));
  } else {
    // 默认创建初始第一回合
    const firstPhase = phases[0] || { id: "phase-1", name: "初始阶段" };
    turns = [
      normalizeTurn({
        turnNumber: 1,
        phaseId: firstPhase.id,
        phaseName: firstPhase.name,
        intents: {
          red: { text: "", activityRefs: [] },
          blue: { text: "", activityRefs: [] }
        },
        injectedEvents: [],
        adjudication: null,
        status: "intents-planning"
      }, 1, phases)
    ];
  }

  const currentTurnIndex = typeof source.currentTurnIndex === "number" && source.currentTurnIndex >= 1 && source.currentTurnIndex <= turns.length
    ? source.currentTurnIndex
    : turns.length;

  return {
    version: 1,
    currentTurnIndex,
    turns,
    eventCardLibrary,
    updatedAt: source.updatedAt || new Date().toISOString()
  };
}

function normalizeEventCard(card = {}, index = 1) {
  return {
    id: String(card.id || `card-${index}`),
    title: String(card.title || `导调事件 ${index}`).trim(),
    category: String(card.category || "战役扰动").trim(),
    detail: String(card.detail || "抽象战场环境扰动或装备状态变化").trim(),
    suggestedImpact: String(card.suggestedImpact || "影响战役协同推进节奏").trim()
  };
}

function normalizeTurn(turn = {}, turnNumber = 1, phases = []) {
  const num = Number(turn.turnNumber) || turnNumber;
  const phaseId = String(turn.phaseId || (phases[num - 1]?.id || `phase-${num}`));
  const matchingPhase = phases.find((p) => p.id === phaseId);
  const phaseName = String(turn.phaseName || matchingPhase?.name || `第 ${num} 阶段`);

  const rawIntents = turn.intents && typeof turn.intents === "object" ? turn.intents : {};
  const intents = {
    red: {
      text: String(rawIntents.red?.text || "").trim(),
      activityRefs: Array.isArray(rawIntents.red?.activityRefs) ? rawIntents.red.activityRefs.map(String) : []
    },
    blue: {
      text: String(rawIntents.blue?.text || "").trim(),
      activityRefs: Array.isArray(rawIntents.blue?.activityRefs) ? rawIntents.blue.activityRefs.map(String) : []
    }
  };

  const injectedEvents = Array.isArray(turn.injectedEvents)
    ? turn.injectedEvents.map((e, idx) => ({
        id: String(e.id || `inj-${idx + 1}`),
        cardId: String(e.cardId || ""),
        title: String(e.title || "导调注入事件"),
        category: String(e.category || "综合扰动"),
        detail: String(e.detail || ""),
        targetSide: ["red", "blue", "both"].includes(e.targetSide) ? e.targetSide : "both",
        injectedAt: e.injectedAt || new Date().toISOString()
      }))
    : [];

  let adjudication = null;
  if (turn.adjudication && typeof turn.adjudication === "object") {
    adjudication = {
      outcome: String(turn.adjudication.outcome || "").trim(),
      rationale: String(turn.adjudication.rationale || "").trim(),
      aiAdvice: String(turn.adjudication.aiAdvice || "").trim(),
      adjudicatedAt: turn.adjudication.adjudicatedAt || new Date().toISOString()
    };
  }

  // 状态自动判定
  let status = "intents-planning";
  if (adjudication?.outcome) {
    status = "completed";
  } else if (injectedEvents.length > 0) {
    status = "adjudicating";
  } else if (intents.red.text || intents.blue.text) {
    status = "event-injection";
  }

  return {
    turnNumber: num,
    phaseId,
    phaseName,
    intents,
    injectedEvents,
    adjudication,
    status
  };
}

/**
 * 提交某一方行动意图
 */
export function submitTurnIntent(wargame, turnNumber, side, { text, activityRefs = [] } = {}) {
  const state = normalizeWargameState(wargame);
  const targetTurn = state.turns.find((t) => t.turnNumber === turnNumber);
  if (!targetTurn) throw new Error(`未找到回合编号为 [${turnNumber}] 的推演记录`);
  if (!["red", "blue"].includes(side)) throw new Error(`无效的推演阵营: ${side}`);

  targetTurn.intents[side] = {
    text: String(text || "").trim(),
    activityRefs: Array.isArray(activityRefs) ? activityRefs.map(String) : []
  };

  if (targetTurn.status === "intents-planning") {
    targetTurn.status = "event-injection";
  }
  state.updatedAt = new Date().toISOString();
  return state;
}

let injectionCounter = 0;
let customCardCounter = 0;

/**
 * 向回合注入导调事件
 */
export function injectEventToTurn(wargame, turnNumber, eventCard, targetSide = "both") {
  const state = normalizeWargameState(wargame);
  const targetTurn = state.turns.find((t) => t.turnNumber === turnNumber);
  if (!targetTurn) throw new Error(`未找到回合编号为 [${turnNumber}] 的推演记录`);

  const newInjection = {
    id: `inj-${Date.now().toString(36)}-${(++injectionCounter).toString(36)}`,
    cardId: eventCard.id || "",
    title: eventCard.title || "突发战场态势扰动",
    category: eventCard.category || "战场环境",
    detail: eventCard.detail || "",
    targetSide: ["red", "blue", "both"].includes(targetSide) ? targetSide : "both",
    injectedAt: new Date().toISOString()
  };

  targetTurn.injectedEvents.push(newInjection);
  if (targetTurn.status !== "completed") {
    targetTurn.status = "adjudicating";
  }
  state.updatedAt = new Date().toISOString();
  return state;
}

/**
 * 从回合中移除注入事件
 */
export function removeEventFromTurn(wargame, turnNumber, injectionId) {
  const state = normalizeWargameState(wargame);
  const targetTurn = state.turns.find((t) => t.turnNumber === turnNumber);
  if (!targetTurn) return state;

  targetTurn.injectedEvents = targetTurn.injectedEvents.filter((e) => e.id !== injectionId);
  if (targetTurn.injectedEvents.length === 0 && targetTurn.status === "adjudicating") {
    targetTurn.status = "event-injection";
  }
  state.updatedAt = new Date().toISOString();
  return state;
}

/**
 * 导演部裁决
 */
export function saveTurnAdjudication(wargame, turnNumber, { outcome, rationale, aiAdvice = "" } = {}) {
  const state = normalizeWargameState(wargame);
  const targetTurn = state.turns.find((t) => t.turnNumber === turnNumber);
  if (!targetTurn) throw new Error(`未找到回合编号为 [${turnNumber}] 的推演记录`);

  if (!String(outcome || "").trim()) {
    throw new Error("裁决结论不得为空");
  }

  targetTurn.adjudication = {
    outcome: String(outcome).trim(),
    rationale: String(rationale || "").trim(),
    aiAdvice: String(aiAdvice || targetTurn.adjudication?.aiAdvice || "").trim(),
    adjudicatedAt: new Date().toISOString()
  };
  targetTurn.status = "completed";
  state.updatedAt = new Date().toISOString();
  return state;
}

/**
 * 推进进入下一回合
 */
export function advanceToNextTurn(wargame, context = {}) {
  const state = normalizeWargameState(wargame, context);
  const currentTurn = state.turns[state.turns.length - 1];

  if (currentTurn && currentTurn.status !== "completed") {
    throw new Error(`当前第 ${currentTurn.turnNumber} 回合尚未完成裁决，不得推进下一回合`);
  }

  const nextNumber = state.turns.length + 1;
  const phases = Array.isArray(context.phases) ? context.phases : [];
  const nextPhase = phases[nextNumber - 1] || phases[phases.length - 1] || { id: `phase-${nextNumber}`, name: `第 ${nextNumber} 阶段` };

  const newTurn = normalizeTurn({
    turnNumber: nextNumber,
    phaseId: nextPhase.id,
    phaseName: nextPhase.name,
    intents: {
      red: { text: "", activityRefs: [] },
      blue: { text: "", activityRefs: [] }
    },
    injectedEvents: [],
    adjudication: null,
    status: "intents-planning"
  }, nextNumber, phases);

  state.turns.push(newTurn);
  state.currentTurnIndex = nextNumber;
  state.updatedAt = new Date().toISOString();
  return state;
}

/**
 * 新增自定义事件卡
 */
export function addCustomEventCard(wargame, card = {}) {
  const state = normalizeWargameState(wargame);
  const newCard = normalizeEventCard({
    id: `custom-card-${Date.now().toString(36)}-${(++customCardCounter).toString(36)}`,
    ...card
  }, state.eventCardLibrary.length + 1);

  state.eventCardLibrary.push(newCard);
  state.updatedAt = new Date().toISOString();
  return state;
}

/**
 * 本地规则生成裁决建议（离线/降级模式）
 * 严格保持宏观因果逻辑分析，绝无数值化杀伤计算
 */
export function generateLocalAdjudicationAdvice(turn = {}) {
  const red = turn.intents?.red?.text || "红方按既定部署保持战术压制";
  const blue = turn.intents?.blue?.text || "蓝方组织多域协同分层抗击";
  const events = Array.isArray(turn.injectedEvents) ? turn.injectedEvents : [];

  let eventAnalysis = "本回合未发生突发战场扰动，对抗按预定行动链路演进。";
  if (events.length > 0) {
    const titles = events.map((e) => `【${e.title}】`).join("、");
    eventAnalysis = `导调注入 ${titles} 等突发扰动，对协同网络抗毁与时延产生直接施压。`;
  }

  const outcome = events.length > 0
    ? `由于突发态势扰动介入，双方行动节奏产生错峰，蓝方在局部抗压中达成战术稳固，红方进攻窗口延后约 15-20 分钟。`
    : `双方围绕核心交战空域展开攻防博弈，蓝方依靠预设协同网络占据先发感知，红方形成多轴牵制。`;

  const rationale = `从对抗因果机理审视：${red.slice(0, 80)} 与 ${blue.slice(0, 80)} 形成相互制约。${eventAnalysis} 体系韧性与降级自主机制成为本回合胜负关键。`;

  return {
    outcome,
    rationale,
    aiAdvice: `[本地导调建议] 建议导演部判定双方达成战术平衡，并要求下一回合重点演练应急重组与备用通信接引。`
  };
}
