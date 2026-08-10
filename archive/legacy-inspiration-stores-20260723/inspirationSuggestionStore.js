const MAX_SEED_LENGTH = 220;

export function createAiInspirationSeeds(output) {
  const result = output?.result || {};
  const phases = unique(toTextList(result.phases));
  const bullets = unique(toTextList(result.bullets));
  const risks = toTextList(result.risks);
  const candidateTexts = unique([...phases, ...bullets, result.coreIdea, result.objective, ...risks]).slice(0, 3);
  const candidates = candidateTexts.map((text, index) => ({
    title: ["研究问题", "体系焦点", "验证视角"][index],
    text
  }));
  return normalizeSeeds(candidates, "ai");
}

export function createLocalInspirationSeeds() {
  return normalizeSeeds([
    { title: "任务窗口", text: "围绕一个有限行动窗口，研究如何在信息不完整和态势变化条件下形成可验证的协同决策问题。" },
    { title: "对手闭环", text: "从对手预警、判断与反制链路出发，明确哪些信息依赖和时间节点最值得优先研究。" },
    { title: "资源边界", text: "从现有平台、信息链路和授权边界出发，提出一个兼顾资源连续性、风险控制与效果评估的研究问题。" }
  ], "local");
}

export function findInspirationSeed(seeds, id) {
  return (Array.isArray(seeds) ? seeds : []).find((seed) => seed.id === id) || null;
}

function normalizeSeeds(candidates, mode) {
  const normalized = candidates
    .map((candidate, index) => ({
      id: `${mode}-seed-${index + 1}`,
      title: clean(candidate?.title) || `研究起点 ${index + 1}`,
      text: clean(candidate?.text),
      mode
    }))
    .filter((candidate) => candidate.text);
  if (normalized.length >= 3 || mode === "local") return normalized.slice(0, 3);

  const fallback = createLocalInspirationSeeds().map((seed) => ({ ...seed, id: `ai-fallback-${seed.id}`, mode }));
  return [...normalized, ...fallback].slice(0, 3);
}

function toTextList(value) {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, MAX_SEED_LENGTH);
}
