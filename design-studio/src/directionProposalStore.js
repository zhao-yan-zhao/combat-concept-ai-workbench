import { getInspirationAnswers, getInspirationProgress } from "./inspirationStore.js";

const STORAGE_KEY = "concept-studio-direction-v1";
const CUSTOM_STORAGE_KEY = "concept-studio-custom-directions-v1";
const AI_STORAGE_KEY = "concept-studio-ai-directions-v1";
const MAX_CUSTOM_DIRECTIONS = 8;

export function buildDirectionProposals({ session, fallbackDirections = [], aiDirections = [], customDirections = [] }) {
  const fallback = normalizeFallbackDirections(fallbackDirections);
  const ai = normalizeAiDirections(aiDirections, fallback);
  const custom = normalizeCustomDirections(customDirections, fallback);
  if (!getInspirationProgress(session).completed) return [...fallback, ...ai, ...custom];

  const answers = getInspirationAnswers(session);
  const environment = compact(answers.environment, "当前任务环境");
  const opponent = compact(answers.opponent, "对手预警与反制体系");
  const resources = compact(answers.resources, "现有可用资源");
  const constraints = compact(answers.constraints, "既定授权与风险边界");
  const success = compact(answers.success, "预期成功标准");

  return [
    {
      id: "control",
      title: "稳控塑势",
      text: `面向${environment}，优先依托${resources}建立稳定感知与行动边界，并在${constraints}下保持可控节奏。`,
      basis: `关注对手：${opponent}；成功判据：${success}`,
      sessionAware: true
    },
    {
      id: "disrupt",
      title: "体系压制",
      text: `针对${opponent}，以${resources}围绕关键节点组织协同压制，压缩对手闭环效率并保留调整余度。`,
      basis: `约束条件：${constraints}；成功判据：${success}`,
      sessionAware: true
    },
    {
      id: "deceive",
      title: "诱导牵制",
      text: `利用${environment}中的可用窗口，以${resources}分向布局并诱导${opponent}暴露重点，从而为主方向创造机会。`,
      basis: `实施边界：${constraints}；成功判据：${success}`,
      sessionAware: true
    },
    ...ai,
    ...custom
  ];
}

export function loadAiDirections(projectId = "default") {
  try { return normalizeAiDirections(JSON.parse(localStorage.getItem(aiStorageKey(projectId)) || "[]")); } catch { return []; }
}

export function saveAiDirections(value, { projectId = "default", defaults = [] } = {}) {
  const directions = normalizeAiDirections(value, defaults);
  try { localStorage.setItem(aiStorageKey(projectId), JSON.stringify(directions)); } catch { /* Keep the active session usable. */ }
  return directions;
}

export function normalizeAiDirections(value, defaults = []) {
  const reserved = new Set((Array.isArray(defaults) ? defaults : []).map((item) => clean(item?.title, 80)).filter(Boolean));
  return (Array.isArray(value) ? value : []).reduce((items, item) => {
    if (items.length >= 3) return items;
    const title = clean(item?.title, 80);
    const text = clean(item?.text, 500);
    const basis = clean(item?.basis, 500);
    if (!title || !text || !basis || reserved.has(title) || items.some((entry) => entry.title === title)) return items;
    items.push({ id: `ai-${items.length + 1}`, title, text, basis, ai: true, custom: false, sessionAware: true });
    return items;
  }, []);
}

export function loadCustomDirections(projectId = "default") {
  try {
    return normalizeCustomDirections(JSON.parse(localStorage.getItem(storageKey(projectId)) || "[]"));
  } catch {
    return [];
  }
}

export function saveCustomDirections(value, { projectId = "default", defaults = [] } = {}) {
  const directions = normalizeCustomDirections(value, defaults);
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(directions));
  } catch {
    // A blocked browser store should not prevent editing in the active session.
  }
  return directions;
}

export function normalizeCustomDirections(value, defaults = []) {
  const reservedTitles = new Set((Array.isArray(defaults) ? defaults : []).map((item) => clean(item?.title, 80)).filter(Boolean));
  const titles = new Set(reservedTitles);
  return (Array.isArray(value) ? value : []).reduce((items, item) => {
    if (items.length >= MAX_CUSTOM_DIRECTIONS) return items;
    const title = clean(item?.title, 80);
    const text = clean(item?.text, 500);
    const basis = clean(item?.basis, 500);
    if (!title || !text || !basis || titles.has(title)) return items;
    titles.add(title);
    items.push({ id: `custom-${items.length + 1}`, title, text, basis, custom: true, sessionAware: false });
    return items;
  }, []);
}

export function loadSelectedDirection(proposals) {
  const available = Array.isArray(proposals) ? proposals : [];
  const fallback = available[0]?.title || "";
  try {
    const saved = String(localStorage.getItem(STORAGE_KEY) || "").trim();
    return available.some((proposal) => proposal.title === saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

export function saveSelectedDirection(title) {
  const selected = String(title || "").trim();
  if (!selected) return "";
  try {
    localStorage.setItem(STORAGE_KEY, selected);
  } catch {
    // A blocked browser store should not prevent selection in the active session.
  }
  return selected;
}

function normalizeFallbackDirections(fallbackDirections) {
  return Array.isArray(fallbackDirections)
    ? fallbackDirections.map((item) => ({ ...item, basis: "完成灵感孵化后将依据会话内容细化。", sessionAware: false }))
    : [];
}

function compact(value, fallback) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 58 ? `${text.slice(0, 57)}...` : text;
}

function clean(value, limit) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function storageKey(projectId) {
  return `${CUSTOM_STORAGE_KEY}:${String(projectId || "default").trim() || "default"}`;
}
function aiStorageKey(projectId) { return `${AI_STORAGE_KEY}:${String(projectId || "default").trim() || "default"}`; }
