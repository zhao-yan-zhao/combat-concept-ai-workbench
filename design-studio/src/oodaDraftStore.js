import { deriveOodaFromOv5 } from "./oodaStore.js";

export function createLocalOodaDraft({ ov5, evidenceSelection = null }) {
  const model = deriveOodaFromOv5(ov5);
  return withProvenance(model, "local", evidenceSelection);
}

export function applyAiOodaDraft({ ov5, draft, evidenceSelection = null }) {
  const model = deriveOodaFromOv5(ov5);
  const objective = textOf(draft?.objective, 220) || "当前概念目标";
  const coreIdea = textOf(draft?.coreIdea, 280) || "当前概念思路";
  const phases = listOf(draft?.phases);
  const risk = textOf(listOf(draft?.risks)[0], 220) || "信息不确定性和资源连续性";
  const nodes = model.lanes.flatMap((lane) => lane.nodes);
  const observe = nodes.find((node) => node.id.includes("observe"));
  const orient = nodes.find((node) => node.id.includes("orient"));
  const decide = nodes.find((node) => node.id.includes("decide"));
  const actions = nodes.filter((node) => node.id.includes("act"));

  if (observe) {
    observe.text = `获取支撑“${objective}”的可复核态势线索，重点关注${phraseOf(phases[0], 180) || "信息来源与时效"}。`;
    observe.rule = "确认来源、时效和置信边界后进入判断。";
  }
  if (orient) {
    orient.text = "对态势线索交叉判读，识别影响概念假设、资源和时序的变化。";
    orient.rule = "关键输入不完整时返回观察阶段补充确认。";
  }
  if (decide) {
    decide.text = `将“${coreIdea}”转化为具有授权、资源和时序约束的协同方案。`;
    decide.rule = `优先复核${risk}；不满足约束时形成修订建议而非直接进入行动。`;
  }
  if (actions[0]) {
    actions[0].text = "在已确认的研究边界内组织协同行动，并记录执行反馈和约束变化。";
    actions[0].rule = "仅在授权、资源与信息条件均满足时执行。";
  }
  if (actions[1]) {
    actions[1].text = "回收效果、异常和资源状态，形成下一轮态势更新与概念修订输入。";
    actions[1].rule = "反馈必须回流观察阶段，并保留可追溯来源。";
  }
  return withProvenance(model, "ai", evidenceSelection);
}

function withProvenance(model, mode, evidenceSelection) {
  return {
    ...model,
    provenance: {
      mode,
      generatedAt: new Date().toISOString(),
      evidenceSelection: normalizeEvidenceSelection(evidenceSelection)
    }
  };
}

function normalizeEvidenceSelection(value) {
  if (!value || typeof value !== "object") return null;
  return {
    source: value.source === "server" ? "server" : "local",
    indexMode: textOf(value.indexMode, 40) || "keyword",
    query: textOf(value.query, 480),
    count: Math.max(0, Math.min(8, Number(value.count) || 0)),
    fallback: Boolean(value.fallback),
    projectRevision: Math.max(0, Number(value.projectRevision) || 0),
    resourceRevision: Math.max(0, Number(value.resourceRevision) || 0),
    selectedAt: textOf(value.selectedAt, 80)
  };
}

function listOf(value) {
  return Array.isArray(value) ? value.map((item) => textOf(item, 220)).filter(Boolean) : [];
}

function textOf(value, limit) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function phraseOf(value, limit) {
  return textOf(value, limit).replace(/[。！？.!?]+$/, "");
}
