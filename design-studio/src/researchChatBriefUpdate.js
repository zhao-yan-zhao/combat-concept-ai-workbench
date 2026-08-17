const FIELD_LABELS = {
  researchIntent: "研究意图",
  objective: "研究目标",
  approach: "核心思路",
  assumptions: "关键假设",
  expectedEffects: "预期效果",
  risk: "主要风险"
};

export function deriveResearchChatBriefUpdate({ brief = {}, question = "", result = {} }) {
  const field = detectResearchChatBriefField(question);
  if (!field) return { patch: {}, fields: [] };
  const value = clean(result?.briefUpdate?.[field]);
  if (!value || value === clean(brief[field])) return { patch: {}, fields: [] };
  return { patch: { [field]: value }, fields: [FIELD_LABELS[field]] };
}

export function detectResearchChatBriefField(question) {
  const text = clean(question);
  if (/(研究意图|研究方向|我想研究|我要研究|关注什么)/.test(text)) return "researchIntent";
  if (/(风险|威胁|问题|薄弱|不足)/.test(text)) return "risk";
  if (/(效果|预期|结果|指标|评估)/.test(text)) return "expectedEffects";
  if (/(假设|约束|前提|条件|边界)/.test(text)) return "assumptions";
  if (/(目标|目的|任务|研究什么)/.test(text)) return "objective";
  if (/(思路|设计|方案|机制|路径|如何)/.test(text)) return "approach";
  // General consultation must not silently overwrite a brief field. The user can
  // still explicitly ask about the objective, approach, assumptions, effects, or risk.
  return "";
}

function clean(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim().slice(0, 800);
  // Never write model self-talk into research brief fields.
  if (/人工智能助手|通过\s*API\s*提供服务|底层模型|可核验的底层|model\s*字段|当前会话没有向我|我是一名通过/i.test(text)) {
    return "";
  }
  return text;
}
