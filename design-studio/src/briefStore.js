const STORAGE_KEY = "concept-studio-brief-v1";
const TEXT_FIELD_NAMES = ["objective", "approach", "assumptions", "expectedEffects", "risk"];
let projectScope = "default";

export function loadConceptBrief(seed) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey()));
    if (saved?.brief) return normalizeConceptBrief(saved.brief, seed);
  } catch {
    // Invalid browser-local data falls back to the project seed.
  }
  return normalizeConceptBrief(seed, seed);
}

export function saveConceptBrief(brief, seed) {
  const normalized = normalizeConceptBrief(brief, seed);
  localStorage.setItem(storageKey(), JSON.stringify({ brief: normalized, updatedAt: new Date().toISOString() }));
  return normalized;
}

export function setConceptBriefProjectScope(projectId) {
  projectScope = normalizeProjectScope(projectId);
}

export function normalizeConceptBrief(value, fallback = {}) {
  const brief = TEXT_FIELD_NAMES.reduce((brief, field) => {
    brief[field] = cleanResearchField(value?.[field]) || cleanResearchField(fallback?.[field]) || "待补充";
    return brief;
  }, {});
  brief.researchIntent = cleanResearchField(value?.researchIntent) || cleanResearchField(fallback?.researchIntent);
  brief.evidenceRefs = normalizeEvidenceRefs(value?.evidenceRefs?.length ? value.evidenceRefs : fallback?.evidenceRefs);
  return brief;
}

export function createLocalBriefDraft({ brief, intent, direction, evidence = [] }) {
  const current = normalizeConceptBrief(brief, brief);
  const focus = clean(intent) || current.objective;
  const evidenceTitle = clean(evidence[0]?.title);
  return normalizeConceptBrief({
    researchIntent: clean(intent),
    objective: focus,
    approach: `${direction || "概念研究"}：围绕${focus}，先明确态势感知、协同决策、行动边界和反馈评估之间的依赖关系。`,
    assumptions: `${current.assumptions}；关键资源、信息链路和区域约束需在建模前复核。${evidenceTitle ? ` 参考依据：${evidenceTitle}。` : ""}`,
    expectedEffects: "形成可复核的态势认知、协同决策与行动反馈闭环，并将未满足条件保留为修订项。",
    evidenceRefs: collectEvidenceRefs(evidence, current.evidenceRefs),
    risk: `${current.risk}；需在设计验证中检查信息时效、资源连续性和对手适应性。`
  }, current);
}

export function applyAiBriefDraft({ brief, intent, direction, draft, evidence = [] }) {
  const current = normalizeConceptBrief(brief, brief);
  const structured = ["objective", "approach", "assumptions", "expectedEffects", "risk"]
    .some((field) => cleanResearchField(draft?.[field]));
  if (structured) {
    const approach = cleanResearchField(draft.approach) || current.approach;
    return normalizeConceptBrief({
      researchIntent: cleanResearchField(intent),
      objective: cleanResearchField(draft.objective) || current.objective,
      approach: approach.startsWith(`${direction || "概念研究"}：`)
        ? approach
        : `${direction || "概念研究"}：${approach}`,
      assumptions: cleanResearchField(draft.assumptions) || current.assumptions,
      expectedEffects: cleanResearchField(draft.expectedEffects) || current.expectedEffects,
      evidenceRefs: collectEvidenceRefs(evidence, current.evidenceRefs),
      risk: cleanResearchField(draft.risk) || current.risk
    }, current);
  }
  const sections = Array.isArray(draft?.sections) ? draft.sections : [];
  const objective = findSection(sections, ["目标", "任务", "目的"]);
  const assumptions = findSection(sections, ["假设", "约束", "前提"]);
  const approachRaw = cleanResearchField(draft?.summary) || cleanResearchField(draft?.coreIdea) || findSection(sections, ["思路", "路径", "方案"]) || current.approach;
  const risks = Array.isArray(draft?.risks) ? draft.risks.map(cleanResearchField).filter(Boolean) : [];
  const bullets = [
    ...(Array.isArray(draft?.bullets) ? draft.bullets : []),
    ...(Array.isArray(draft?.phases) ? draft.phases : []),
    ...(Array.isArray(draft?.assumptions) ? draft.assumptions : [])
  ].map(cleanResearchField).filter(Boolean);
  const evidenceTitle = clean(evidence[0]?.title);
  const approach = cleanResearchField(approachRaw) || current.approach;

  return normalizeConceptBrief({
    researchIntent: cleanResearchField(intent),
    objective: objective || cleanResearchField(draft?.objective) || cleanResearchField(intent) || current.objective,
    approach: approach.startsWith(`${direction || "概念研究"}：`)
      ? approach
      : `${direction || "概念研究"}：${approach}`,
    assumptions: assumptions || bullets.slice(0, 2).join("；") || current.assumptions,
    expectedEffects: cleanResearchField(draft?.expectedEffects) || cleanResearchField(draft?.effects) || bullets.slice(0, 2).join("；") || current.expectedEffects,
    evidenceRefs: collectEvidenceRefs(evidence, current.evidenceRefs),
    risk: risks.slice(0, 2).join("；") || current.risk
  }, current);
}

export function areConceptBriefsEqual(left, right) {
  return [...TEXT_FIELD_NAMES, "researchIntent"].every((field) => clean(left?.[field]) === clean(right?.[field]))
    && normalizeEvidenceRefs(left?.evidenceRefs).join("\u0000") === normalizeEvidenceRefs(right?.evidenceRefs).join("\u0000");
}

export function normalizeEvidenceRefs(value) {
  const items = Array.isArray(value) ? value : String(value || "").split(/[，,、;；\n]/);
  return [...new Set(items.map(clean).filter(Boolean))].slice(0, 16).map((item) => item.slice(0, 240));
}

function collectEvidenceRefs(evidence, existing) {
  return normalizeEvidenceRefs([...(existing || []), ...(evidence || []).map((item) => item?.id || item?.ref || item?.filePath || item?.title)]);
}

function findSection(sections, keywords) {
  const section = sections.find((item) => keywords.some((keyword) => String(item?.title || "").includes(keyword)));
  return cleanResearchField(section?.text);
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

/** Drop model self-talk / API disclaimers so they never enter brief fields. */
function cleanResearchField(value) {
  const text = clean(value);
  if (!text) return "";
  if (/人工智能助手|通过\s*API\s*提供服务|底层模型|可核验的底层|model\s*字段|调用日志|当前会话没有向我|我是一名通过/i.test(text)) {
    return "";
  }
  if (text.length > 160 && /API|模型名称|部署标识/.test(text) && /助手|会话|回答/.test(text)) {
    return "";
  }
  return text;
}

function storageKey() { return projectScope === "default" ? STORAGE_KEY : `${STORAGE_KEY}:${projectScope}`; }
function normalizeProjectScope(value) { return String(value || "default").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "default"; }
