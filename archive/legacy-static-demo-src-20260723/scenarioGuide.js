export const scenarioGuideSteps = [
  {
    id: "mission",
    title: "任务背景",
    prompt: "说明作战方向、任务类型、上级意图和本次研究希望解决的核心任务。",
    placeholder: "例：围绕某海空方向联合封控行动，红方需要在有限时间内建立态势感知并夺取关键通道控制权。"
  },
  {
    id: "enemy",
    title: "敌情判断",
    prompt: "补充蓝方/敌方编组、关键能力、可能行动和主要反制手段。",
    placeholder: "例：蓝方依托航母编队、远程预警、电子干扰和水下平台保持外线机动。"
  },
  {
    id: "ownForces",
    title: "我方力量",
    prompt: "列出红方可用侦察、火力、电子战、机动、防空、保障等力量。",
    placeholder: "例：侦察卫星、预警机、电子战飞机、无人侦察平台、远程火力单元。"
  },
  {
    id: "environment",
    title: "环境与窗口",
    prompt: "确认任务区域、地理/电磁/天气环境、行动窗口和时限。",
    placeholder: "例：海空方向关键通道，行动窗口 48 小时，电磁对抗强度高。"
  },
  {
    id: "constraints",
    title: "约束与假设",
    prompt: "说明必须满足的约束、风险边界、规则限制和当前只能暂定的假设。",
    placeholder: "例：强调体系协同、火力精确、风险可控；假设基础态势感知可连续保持。"
  },
  {
    id: "questions",
    title: "研究问题",
    prompt: "写出希望 AI 辅助回答的问题、成功判据和仍需专家确认的事项。",
    placeholder: "例：如何比较稳控塑势、快速破击、诱导牵制三类方案，并形成可导出的概念图输入？"
  }
];

export function createDefaultScenarioGuide() {
  return {
    active: false,
    currentStep: 0,
    answers: Object.fromEntries(scenarioGuideSteps.map((step) => [step.id, ""])),
    updatedAt: ""
  };
}

export function normalizeScenarioGuide(value) {
  const defaults = createDefaultScenarioGuide();
  const answers = value?.answers && typeof value.answers === "object" ? value.answers : {};
  return {
    ...defaults,
    ...value,
    currentStep: Number.isFinite(value?.currentStep)
      ? clampStep(value.currentStep)
      : defaults.currentStep,
    answers: Object.fromEntries(scenarioGuideSteps.map((step) => [
      step.id,
      String(answers[step.id] || "")
    ])),
    updatedAt: value?.updatedAt || ""
  };
}

export function clampStep(index) {
  return Math.max(0, Math.min(scenarioGuideSteps.length - 1, index));
}

export function getScenarioGuideProgress(guide) {
  const normalized = normalizeScenarioGuide(guide);
  const completed = scenarioGuideSteps.filter((step) => normalized.answers[step.id].trim()).length;
  return {
    completed,
    total: scenarioGuideSteps.length,
    percent: Math.round((completed / scenarioGuideSteps.length) * 100)
  };
}

export function buildGuidedScenarioText(guide) {
  const normalized = normalizeScenarioGuide(guide);
  const answer = (id) => normalized.answers[id].trim();
  const sections = [
    ["任务背景", answer("mission")],
    ["敌情判断", answer("enemy")],
    ["我方力量", answer("ownForces")],
    ["战场环境", answer("environment")],
    ["约束条件", answer("constraints")],
    ["研究问题", answer("questions")]
  ];

  return sections
    .map(([title, content]) => `${title}：${content || "需补充。"}`)
    .join("\n\n");
}

export function seedScenarioGuideFromText(guide, text) {
  const normalized = normalizeScenarioGuide(guide);
  if (Object.values(normalized.answers).some((value) => value.trim())) {
    return normalized;
  }

  const sectionMap = {
    mission: ["任务背景", "任务目标", "任务"],
    enemy: ["敌情判断", "敌方能力", "蓝方", "敌情"],
    ownForces: ["我方力量", "红方", "我情"],
    environment: ["战场环境", "环境", "行动窗口", "区域"],
    constraints: ["约束条件", "关键约束", "假设条件"],
    questions: ["研究问题", "待确认问题"]
  };
  const paragraphs = String(text || "").split(/\n+/).map((item) => item.trim()).filter(Boolean);
  const answers = { ...normalized.answers };

  for (const [id, labels] of Object.entries(sectionMap)) {
    const hit = paragraphs.find((paragraph) => labels.some((label) => paragraph.includes(label)));
    if (hit) {
      answers[id] = hit.replace(/^.*?[：:]/, "").trim();
    }
  }

  return {
    ...normalized,
    answers,
    updatedAt: new Date().toISOString()
  };
}
