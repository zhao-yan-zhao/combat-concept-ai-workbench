const STORAGE_KEY = "concept-studio-report-template-v1";

export const DEFAULT_REPORT_TEMPLATE_ID = "research-standard";

export const TACTIC_SECTIONS = [
  { key: "background", title: "一、问题与背景", editable: true },
  { key: "adversary", title: "二、对手体系分析", editable: true },
  { key: "core-concept", title: "三、战法核心思想", editable: true },
  { key: "force-employment", title: "四、力量运用与编组", editable: true },
  { key: "execution-phases", title: "五、实施阶段与时序", editable: true },
  { key: "mechanism", title: "六、制胜机理与因果协同 (OV-5/OODA)", editable: true },
  { key: "risks", title: "七、风险评估与反制应对", editable: true },
  { key: "conclusion", title: "八、评估结论与效能指标", editable: true },
  { key: "citations", title: "九、溯源证据与引用附录", editable: true }
];

export const SCENARIO_SECTIONS = [
  { key: "background", title: "一、想定背景与初始态势", editable: true },
  { key: "situation", title: "二、作战环境与时空边界", editable: true },
  { key: "forces-intent", title: "三、双方企图与作战编成", editable: true },
  { key: "phases-arbitration", title: "四、阶段设定与裁决节点", editable: true },
  { key: "wargame-rules", title: "五、推演与交战规则 (ROE/OV-6a)", editable: true },
  { key: "annex", title: "六、附件与态势图件 (OV-1/OV-2)", editable: true }
];

export const WARGAME_REVIEW_SECTIONS = [
  { key: "overview", title: "一、推演概况与参演编组", editable: true },
  { key: "phase-results", title: "二、各阶段推进结果与战损", editable: true },
  { key: "decision-points", title: "三、关键决策点与对抗博弈", editable: true },
  { key: "deviations", title: "四、执行偏差与成因深度剖析", editable: true },
  { key: "recommendations", title: "五、体系机理与战法改进建议", editable: true },
  { key: "citations", title: "六、参考依据与数据来源", editable: true }
];

export const TEMPLATES = [
  {
    id: "tactic-doc",
    label: "战法说明",
    documentTitle: "作战战法设计与机理说明书",
    description: "以战法问题驱动，层层剖析体系对抗、制胜机理、因果链路与反制机制。",
    sections: TACTIC_SECTIONS
  },
  {
    id: "scenario-doc",
    label: "想定文书",
    documentTitle: "作战想定推演作业文书",
    description: "用于推演实验筹划，明确态势设定、双方法律规则、裁决节点与博弈条件。",
    sections: SCENARIO_SECTIONS
  },
  {
    id: "wargame-review",
    label: "推演复盘",
    documentTitle: "作战概念推演复盘与改进报告",
    description: "聚焦演练过程偏差分析、关键决策节点与机理闭环优化。",
    sections: WARGAME_REVIEW_SECTIONS
  },
  { id: "research-standard", label: "研究通用", documentTitle: "作战概念研究报告", description: "覆盖概念、模型、想定、验证、证据与版本治理。" },
  { id: "review-evidence", label: "审阅证据", documentTitle: "作战概念审阅报告", description: "用于审阅会，突出验证、红方、证据、协同意见与审计。" },
  { id: "exchange-baseline", label: "交换基线", documentTitle: "作战概念交换基线报告", description: "用于模型交换与归档，突出版本、OV-2、OV-3、OV-6c 与部署桥接。" }
];

export function resolveDefaultTemplateId(projectKind = "") {
  if (projectKind === "scenario") return "scenario-doc";
  if (projectKind === "tactic") return "tactic-doc";
  return DEFAULT_REPORT_TEMPLATE_ID;
}

export function listReportTemplates() {
  return TEMPLATES.map((template) => ({
    ...template,
    sections: template.sections ? template.sections.map((s) => ({ ...s })) : null
  }));
}

export function getReportTemplate(value) {
  const id = typeof value === "string" ? value : value?.id;
  const found = TEMPLATES.find((template) => template.id === id);
  const base = found || TEMPLATES.find((template) => template.id === DEFAULT_REPORT_TEMPLATE_ID) || TEMPLATES[0];
  return {
    ...base,
    sections: base.sections ? base.sections.map((s) => ({ ...s })) : null
  };
}

export function loadReportTemplate(projectKind = "") {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return getReportTemplate(saved);
  } catch {}
  return getReportTemplate(resolveDefaultTemplateId(projectKind));
}

export function saveReportTemplate(value) {
  const template = getReportTemplate(value);
  try {
    localStorage.setItem(STORAGE_KEY, template.id);
  } catch {}
  return template;
}
