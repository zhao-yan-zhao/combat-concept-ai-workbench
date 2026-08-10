/** Combat focus options: AI drafts three; multi-select + confirm; user can add custom. */

const STORAGE_PREFIX = "combat-concept-project-combat-focus-v1";
const MAX_OPTIONS = 12;
const MAX_CUSTOM = 8;
const MAX_SELECTED = 3;

export function createEmptyCombatFocus() {
  return {
    version: 2,
    options: [],
    selectedIds: [],
    status: "empty",
    confirmedAt: "",
    generation: { source: "", generatedAt: "" }
  };
}

export function loadCombatFocus(projectId) {
  try {
    return normalizeCombatFocus(JSON.parse(localStorage.getItem(storageKey(projectId)) || "null"));
  } catch {
    return createEmptyCombatFocus();
  }
}

export function persistCombatFocus(value, projectId) {
  const normalized = normalizeCombatFocus(value);
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(normalized));
  } catch {
    /* session remains usable */
  }
  return normalized;
}

export function normalizeCombatFocus(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const options = [];
  const seen = new Set();
  for (const item of Array.isArray(input.options) ? input.options : []) {
    if (options.length >= MAX_OPTIONS) break;
    const option = normalizeOption(item, options.length);
    if (!option || seen.has(option.id) || seen.has(option.title)) continue;
    seen.add(option.id);
    seen.add(option.title);
    options.push(option);
  }
  const optionIds = new Set(options.map((item) => item.id));
  // Migrate legacy single selectedId → selectedIds
  const legacyId = clean(input.selectedId, 60);
  const rawSelected = Array.isArray(input.selectedIds)
    ? input.selectedIds
    : (legacyId ? [legacyId] : []);
  const selectedIds = [];
  for (const id of rawSelected) {
    const cleaned = clean(id, 60);
    if (!cleaned || !optionIds.has(cleaned) || selectedIds.includes(cleaned)) continue;
    selectedIds.push(cleaned);
    if (selectedIds.length >= MAX_SELECTED) break;
  }
  // Default draft selection: first option when options exist but nothing selected yet
  if (!selectedIds.length && options.length) selectedIds.push(options[0].id);

  const statusRaw = clean(input.status, 24);
  let status = ["empty", "draft", "confirmed"].includes(statusRaw) ? statusRaw : "empty";
  if (!options.length) status = "empty";
  else if (status === "confirmed" && !selectedIds.length) status = "draft";
  else if (status === "empty" && options.length) status = "draft";

  return {
    version: 2,
    options,
    selectedIds,
    /** @deprecated kept for older readers */
    selectedId: selectedIds[0] || "",
    status,
    confirmedAt: status === "confirmed" ? clean(input.confirmedAt, 80) : "",
    generation: {
      source: clean(input.generation?.source, 40),
      generatedAt: clean(input.generation?.generatedAt, 80)
    }
  };
}

export function createCombatFocusFromAi(plan = null, brief = {}, { source = "ai" } = {}) {
  const draft = plan && typeof plan === "object" ? plan : {};
  const objective = cleanResearch(brief.objective || brief.researchIntent, 80) || "当前作战目标";
  const approach = cleanResearch(brief.approach, 80) || "体系协同";
  const effects = cleanResearch(brief.expectedEffects, 80) || "形成有利态势";
  const risk = cleanResearch(brief.risk, 80) || "对手反制";
  const intent = cleanResearch(brief.researchIntent, 80) || objective;
  const themeCorpus = `${intent} ${objective} ${approach}`;
  const isAmd = /防空|反导|拦截|预警|导弹防御|AMD|吕宋|岛链|EABO|THAAD|萨德|爱国者|宙斯盾/i.test(themeCorpus);
  const fallback = isAmd
    ? [
      {
        id: "focus-multilayer",
        title: "分层拦截闭环",
        text: `围绕“${objective}”，以远-中-近分层拦截与漏防补射为主轴，压低突防成功率；成功判据：关键批次拦截效果可评估、内层弹药消耗可控。`,
        source: "local"
      },
      {
        id: "focus-early-warn",
        title: "预警接战优先",
        text: `围绕“${objective}”，优先稳住探测—航迹融合—交战授权链路，尽早形成统一交战图；成功判据：可交战目标排序完成、接战准备可执行。`,
        source: "local"
      },
      {
        id: "focus-node-hold",
        title: "节点生存管理",
        text: `围绕“${objective}”，以预警/火控/指挥等关键节点生存与快速恢复为主，严格管理传感器开机与弹药消耗；关注风险：${risk}。`,
        source: "local"
      }
    ]
    : [
      {
        id: "focus-control",
        title: "通道控制塑势",
        text: `围绕“${objective}”，优先建立持续态势优势与通道控制边界，以${approach}压缩对手行动自由；成功判据：通道态势可维持、边界可复核。`,
        source: "local"
      },
      {
        id: "focus-disrupt",
        title: "关键链路压制",
        text: `围绕“${objective}”，优先作用于对手感知/指挥关键链路，创造转入主行动的窗口；关注风险：${risk}；成功判据：关键节点失能或降效可观察。`,
        source: "local"
      },
      {
        id: "focus-seize",
        title: "窗口集中突击",
        text: `围绕“${objective}”，在有利窗口集中力量实施主方向突击并尽快巩固；预期导向：${effects}；成功判据：阶段效果达标或窗口关闭时完成评估。`,
        source: "local"
      }
    ];
  const aiOptions = Array.isArray(draft.options)
    ? draft.options
      .slice(0, 3)
      .map((item, index) => normalizeOption({ ...item, source: source === "ai" ? "ai" : item?.source }, index))
      .filter((item) => item && !isAssistantMetaText(item.text) && !isAssistantMetaText(item.title))
    : [];
  // Reject off-topic AI focus sets for AMD research (e.g. pure assault templates).
  const aiUsable = aiOptions.length >= 3
    && !(isAmd && aiOptions.every((item) => /封控|突击|破击/.test(item.title) && !/防空|反导|拦截|预警|节点|接战/.test(`${item.title}${item.text}`)));
  const options = aiUsable ? aiOptions : fallback;
  const cleaned = options.filter(Boolean);
  while (cleaned.length < 3) cleaned.push(fallback[cleaned.length]);
  return normalizeCombatFocus({
    options: cleaned.slice(0, 3).map((item, index) => ({
      ...item,
      id: item.id || `focus-${index + 1}`,
      source: aiUsable ? (item.source || source) : "local"
    })),
    selectedIds: [cleaned[0]?.id || fallback[0].id],
    status: "draft",
    generation: {
      source: aiUsable ? source : "local",
      generatedAt: new Date().toISOString()
    }
  });
}

/** Toggle multi-select; clears confirmation when selection changes. */
export function toggleCombatFocus(focus, optionId) {
  const normalized = normalizeCombatFocus(focus);
  if (!normalized.options.some((item) => item.id === optionId)) return normalized;
  const exists = normalized.selectedIds.includes(optionId);
  let selectedIds;
  if (exists) {
    selectedIds = normalized.selectedIds.filter((id) => id !== optionId);
    if (!selectedIds.length) selectedIds = [optionId]; // keep at least one when options exist
  } else {
    selectedIds = [...normalized.selectedIds, optionId].slice(0, MAX_SELECTED);
  }
  return normalizeCombatFocus({
    ...normalized,
    selectedIds,
    status: "draft",
    confirmedAt: ""
  });
}

/** @deprecated single-select alias — toggles to only this id */
export function selectCombatFocus(focus, optionId) {
  const normalized = normalizeCombatFocus(focus);
  if (!normalized.options.some((item) => item.id === optionId)) return normalized;
  return normalizeCombatFocus({
    ...normalized,
    selectedIds: [optionId],
    status: "draft",
    confirmedAt: ""
  });
}

export function addCustomCombatFocus(focus, { title, text } = {}) {
  const normalized = normalizeCombatFocus(focus);
  const customCount = normalized.options.filter((item) => item.source === "custom").length;
  if (customCount >= MAX_CUSTOM) throw new Error(`最多新增 ${MAX_CUSTOM} 个自定义作战聚焦`);
  const option = normalizeOption({
    id: `custom-${Date.now().toString(36)}`,
    title,
    text,
    source: "custom"
  }, normalized.options.length);
  if (!option) throw new Error("请填写作战聚焦名称与说明");
  if (normalized.options.some((item) => item.title === option.title)) throw new Error("已存在同名作战聚焦");
  const selectedIds = [...normalized.selectedIds];
  if (!selectedIds.includes(option.id) && selectedIds.length < MAX_SELECTED) selectedIds.push(option.id);
  else if (!selectedIds.includes(option.id)) {
    selectedIds.pop();
    selectedIds.push(option.id);
  }
  return normalizeCombatFocus({
    ...normalized,
    options: [...normalized.options, option],
    selectedIds,
    status: "draft",
    confirmedAt: ""
  });
}

export function confirmCombatFocus(focus) {
  const normalized = normalizeCombatFocus(focus);
  const selected = getSelectedCombatFocuses(normalized);
  if (!selected.length) throw new Error("请至少选择一个作战聚焦");
  return normalizeCombatFocus({
    ...normalized,
    status: "confirmed",
    confirmedAt: new Date().toISOString()
  });
}

export function getSelectedCombatFocuses(focus) {
  const normalized = normalizeCombatFocus(focus);
  return normalized.selectedIds
    .map((id) => normalized.options.find((item) => item.id === id))
    .filter(Boolean);
}

/** Primary focus (first selected) for compact display / legacy single field. */
export function getSelectedCombatFocus(focus) {
  return getSelectedCombatFocuses(focus)[0] || null;
}

export function hasSelectedCombatFocus(focus) {
  return getSelectedCombatFocuses(focus).length > 0;
}

export function isCombatFocusConfirmed(focus) {
  const normalized = normalizeCombatFocus(focus);
  return normalized.status === "confirmed" && getSelectedCombatFocuses(normalized).length > 0;
}

export function combatFocusesForAnalysis(focus) {
  return getSelectedCombatFocuses(focus).map((item) => ({
    id: item.id,
    title: item.title,
    text: item.text
  }));
}

export function compactCombatFocusForAnalysis(focus) {
  const selected = getSelectedCombatFocuses(focus);
  if (!selected.length) return null;
  if (selected.length === 1) {
    return { id: selected[0].id, title: selected[0].title, text: selected[0].text };
  }
  return {
    id: selected.map((item) => item.id).join("+"),
    title: selected.map((item) => item.title).join(" + "),
    text: selected.map((item) => `${item.title}：${item.text}`).join("；")
  };
}

function normalizeOption(item, index = 0) {
  const title = clean(item?.title || item?.name, 40);
  const text = clean(item?.text || item?.summary || item?.description, 280);
  if (!title || !text) return null;
  const source = ["ai", "custom", "local"].includes(clean(item?.source, 20)) ? clean(item.source, 20) : "ai";
  return {
    id: slugId(item?.id, `focus-${index + 1}`),
    title,
    text,
    source
  };
}

function slugId(value, fallback) {
  const raw = clean(value, 60).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff-]+/g, "-").replace(/^-+|-+$/g, "");
  return raw || fallback;
}

function clean(value, max = 200) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function isAssistantMetaText(value) {
  const text = String(value || "");
  return /人工智能助手|通过\s*API\s*提供服务|底层模型|可核验的底层|model\s*字段|当前会话没有向我|我是一名通过/i.test(text);
}

function cleanResearch(value, max = 200) {
  const text = clean(value, max);
  if (!text || isAssistantMetaText(text) || text === "待补充") return "";
  return text;
}

function storageKey(projectId) {
  return `${STORAGE_PREFIX}:${projectId || "default"}`;
}
