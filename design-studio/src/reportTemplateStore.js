const STORAGE_KEY = "concept-studio-report-template-v1";

export const DEFAULT_REPORT_TEMPLATE_ID = "research-standard";

const TEMPLATES = [
  { id: "research-standard", label: "研究通用", documentTitle: "作战概念研究报告", description: "覆盖概念、模型、想定、验证、证据与版本治理。" },
  { id: "review-evidence", label: "审阅证据", documentTitle: "作战概念审阅报告", description: "用于审阅会，突出验证、红方、证据、协同意见与审计。" },
  { id: "exchange-baseline", label: "交换基线", documentTitle: "作战概念交换基线报告", description: "用于模型交换与归档，突出版本、OV-2、OV-3、OV-6c 与部署桥接。" }
];

export function listReportTemplates() {
  return TEMPLATES.map((template) => ({ ...template }));
}

export function getReportTemplate(value) {
  const id = typeof value === "string" ? value : value?.id;
  return { ...(TEMPLATES.find((template) => template.id === id) || TEMPLATES[0]) };
}

export function loadReportTemplate() {
  try {
    return getReportTemplate(localStorage.getItem(STORAGE_KEY));
  } catch {
    return getReportTemplate(DEFAULT_REPORT_TEMPLATE_ID);
  }
}

export function saveReportTemplate(value) {
  const template = getReportTemplate(value);
  try {
    localStorage.setItem(STORAGE_KEY, template.id);
  } catch {
    // The in-memory selection remains usable when local storage is unavailable.
  }
  return template;
}
