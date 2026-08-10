import { getInspirationProgress } from "./inspirationStore.js";

const MAX_QUESTION_LENGTH = 260;

export function createAiInspirationFollowUp(output, session) {
  const result = output?.result || {};
  const candidate = firstText(result.phases) || clean(result.coreIdea) || clean(result.objective);
  return normalizeQuestion(candidate, session) || createLocalInspirationFollowUp(session);
}

export function createLocalInspirationFollowUp(session) {
  const progress = getInspirationProgress(session);
  const topic = progress.nextLabel || "当前研究重点";
  return `为澄清${topic}，请补充一个可观察的条件、限制或判断依据，并说明它会怎样影响概念设计？`;
}

export function canRefineInspirationFollowUp(session) {
  const progress = getInspirationProgress(session);
  return progress.stage > 0 && !progress.completed;
}

function normalizeQuestion(value, session) {
  const text = clean(value);
  if (!text) return "";
  const question = /[？?]$/.test(text) ? text : `请进一步说明：${text}？`;
  return question.slice(0, MAX_QUESTION_LENGTH);
}

function firstText(value) {
  return Array.isArray(value) ? value.map(clean).find(Boolean) || "" : "";
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
