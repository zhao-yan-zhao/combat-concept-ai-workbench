import { $ } from "./dom.js";
import { state } from "./state.js";

const NEEDS_INPUT = "需补充";

export function parseScenario() {
  const text = $("#scenarioText").value.trim();
  const scenario = buildScenario(text);

  state.scenario = scenario;
  state.analysis = toAnalysisSections(scenario);
  $("#inputScore").textContent = scoreScenario(scenario);
}

export function buildScenario(text) {
  const sentences = splitSentences(text);
  const mission = extractMission(sentences);
  const objective = extractObjective(sentences, mission);
  const redForces = extractForces(sentences, ["我方", "红方"]);
  const blueForces = extractForces(sentences, ["敌情", "敌方", "蓝方"]);
  const environment = extractEnvironment(sentences);
  const timeWindow = extractTimeWindow(sentences);
  const constraints = extractConstraints(sentences);
  const successCriteria = extractSuccessCriteria(sentences);
  const assumptions = extractAssumptions(sentences);
  const openQuestions = extractOpenQuestions(sentences);

  return {
    id: "scenario-current",
    rawText: text,
    mission,
    objective,
    redForces,
    blueForces,
    environment,
    timeWindow,
    constraints,
    successCriteria,
    assumptions,
    openQuestions,
    mainTension: inferMainTension(text, constraints, openQuestions),
    keywords: extractKeywords(text)
  };
}

function toAnalysisSections(scenario) {
  return {
    "任务目标": scenario.mission || NEEDS_INPUT,
    "作战目的": scenario.objective || NEEDS_INPUT,
    "敌方能力": formatList(scenario.blueForces),
    "我方力量": formatList(scenario.redForces),
    "战场环境": scenario.environment || NEEDS_INPUT,
    "行动窗口": scenario.timeWindow || NEEDS_INPUT,
    "关键约束": formatList(scenario.constraints),
    "成功判据": formatList(scenario.successCriteria),
    "假设条件": formatList(scenario.assumptions),
    "待确认问题": formatList(scenario.openQuestions),
    "研究问题": formatList(scenario.openQuestions),
    "主要矛盾": scenario.mainTension || NEEDS_INPUT
  };
}

function splitSentences(text) {
  return text
    .split(/[。！？!?；;\n]+/)
    .map((item) => item.replace(/^[\s\-*•、0-9.]+/, "").trim())
    .filter(Boolean);
}

function extractMission(sentences) {
  return findSentence(sentences, ["任务背景", "任务", "目标", "需要", "建立", "夺取", "控制权"]);
}

function extractObjective(sentences, mission) {
  const objective = findSentence(sentences, ["目的", "意图", "达成", "形成", "确保", "压制", "封控"]);
  return objective || mission;
}

function extractForces(sentences, sideKeywords) {
  const forceSentence = findSentence(sentences, sideKeywords);
  if (!forceSentence) {
    return [];
  }

  const normalized = forceSentence
    .replace(/^.*?[：:]/, "")
    .replace(/可能采用.*$/, "")
    .replace(/保持.*$/, "");

  const items = normalized
    .split(/[、，,和及与]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .map((item) => item.replace(/^(红方|我方|蓝方|敌方|敌情判断)/, "").trim())
    .filter(Boolean);

  return unique(items.length ? items : [forceSentence]).slice(0, 12);
}

function extractEnvironment(sentences) {
  return findSentence(sentences, ["海空", "岛", "通道", "区域", "方向", "水下", "电磁", "天气", "复杂环境"]);
}

function extractTimeWindow(sentences) {
  const timePattern = /(行动窗口|时间|时限|窗口)?\s*[0-9一二三四五六七八九十百]+(\s*)(小时|日|天|周|昼夜)/;
  const timeSentence = sentences.find((sentence) => timePattern.test(sentence));
  if (timeSentence) {
    const match = timeSentence.match(timePattern);
    return match ? match[0].trim() : timeSentence;
  }
  return findSentence(sentences, ["行动窗口", "时间", "时限", "窗口"]);
}

function extractConstraints(sentences) {
  const explicit = collectSentences(sentences, ["约束", "限制", "窗口", "风险", "避免", "不得", "必须", "强调"]);
  const parts = explicit.flatMap((sentence) => splitClause(sentence));
  return unique(parts).slice(0, 8);
}

function extractSuccessCriteria(sentences) {
  const criteria = collectSentences(sentences, ["夺取", "建立", "压制", "保持", "确保", "形成", "控制权", "可视化", "汇报材料"]);
  return unique(criteria.map((sentence) => cleanupSentence(sentence))).slice(0, 6);
}

function extractAssumptions(sentences) {
  const assumptions = collectSentences(sentences, ["假设", "预计", "判断", "可能", "依托", "可用", "可依托"]);
  return unique(assumptions.map((sentence) => cleanupSentence(sentence))).slice(0, 6);
}

function extractOpenQuestions(sentences) {
  const questions = collectSentences(sentences, ["研究问题", "如何", "是否", "哪些", "何时", "哪里", "需要明确", "需补充"]);
  const normalized = questions.map((sentence) => {
    const clean = cleanupSentence(sentence);
    return /[？?]$/.test(clean) ? clean : `${clean}？`;
  });
  if (normalized.length) {
    return unique(normalized).slice(0, 6);
  }
  return ["需要明确空间范围、关键节点、保障条件和效果判据。"];
}

function inferMainTension(text, constraints, openQuestions) {
  if (text.includes("封控") && text.includes("远程")) {
    return "在有限行动窗口内建立持续封控，同时削弱对手远程干预与体系反制能力。";
  }
  if (text.includes("无人") || text.includes("AI")) {
    return "在智能化支撑下提升发现、决策、协同和效果评估速度。";
  }
  if (constraints.length && openQuestions.length) {
    return "任务目标、约束条件和待确认问题之间需要建立可验证的行动闭环。";
  }
  return "任务目标、可用力量、对手反制和行动窗口之间存在耦合约束。";
}

function extractKeywords(text) {
  return unique((text.match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z0-9]+/g) || []).flatMap(expandToken))
    .filter((token) => token.length > 1)
    .slice(0, 20);
}

function findSentence(sentences, keywords) {
  return cleanupSentence(sentences.find((part) => keywords.some((keyword) => part.includes(keyword))) || "");
}

function collectSentences(sentences, keywords) {
  return sentences.filter((part) => keywords.some((keyword) => part.includes(keyword)));
}

function splitClause(sentence) {
  return sentence
    .replace(/^.*?[：:]/, "")
    .split(/[，,、]/)
    .map((item) => cleanupSentence(item))
    .filter((item) => item.length >= 2);
}

function cleanupSentence(sentence) {
  return sentence.replace(/^[\s：:]+|[\s。；;]+$/g, "").trim();
}

function formatList(items) {
  return items.length ? items.join("；") : NEEDS_INPUT;
}

function scoreScenario(scenario) {
  const fields = [
    scenario.mission,
    scenario.objective,
    scenario.redForces.length,
    scenario.blueForces.length,
    scenario.environment,
    scenario.timeWindow,
    scenario.constraints.length,
    scenario.successCriteria.length,
    scenario.assumptions.length,
    scenario.openQuestions.length
  ];
  const filled = fields.filter(Boolean).length;
  if (filled >= 8) {
    return "要素较完整";
  }
  if (filled >= 5) {
    return "可继续细化";
  }
  return "需补充材料";
}

function unique(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function expandToken(token) {
  if (!/^[\u4e00-\u9fa5]+$/.test(token) || token.length <= 4) {
    return [token];
  }

  const pieces = [token];
  for (const size of [4, 3, 2]) {
    for (let index = 0; index <= token.length - size; index += size === 2 ? 2 : 1) {
      pieces.push(token.slice(index, index + size));
    }
  }
  return pieces;
}
