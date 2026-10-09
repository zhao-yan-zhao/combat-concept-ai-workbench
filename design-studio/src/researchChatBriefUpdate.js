const FIELD_LABELS = {
  researchIntent: "研究意图",
  objective: "研究目标",
  approach: "核心思路",
  assumptions: "关键假设",
  expectedEffects: "预期效果",
  risk: "主要风险"
};

const ALL_BRIEF_FIELDS = ["researchIntent", "objective", "approach", "assumptions", "expectedEffects", "risk"];

export function deriveResearchChatBriefUpdate({ brief = {}, question = "", result = {}, projectTitle = "" } = {}) {
  const text = clean(question);
  if (isPureConsultation(text)) return { patch: {}, fields: [] };

  const briefUpdate = extractBriefUpdatePayload(result);
  const targetFields = resolveTargetFields(text, briefUpdate);
  if (!targetFields.length) return { patch: {}, fields: [] };

  const patch = {};
  const updatedFieldLabels = [];
  const title = meaningfulBriefValue(projectTitle);

  for (const field of targetFields) {
    if (shouldSkipFieldWrite(text, brief, field, projectTitle, briefUpdate)) {
      continue;
    }

    let value = extractBriefFieldValue(briefUpdate, field);
    const current = meaningfulBriefValue(brief[field]);

    // When research intent is empty / stale vs project title, seed from the project title
    // if the model omitted a usable briefUpdate value.
    if (field === "researchIntent" && title && shouldSeedIntentFromProjectTitle(text, current, title)) {
      if (!value || isGenericTemplateText(value) || !topicAligned(value, title)) {
        value = title;
      }
    }

    if (!value || value === current) continue;
    if (isGenericTemplateText(value) && isHowToQuestion(text)) continue;

    patch[field] = value;
    updatedFieldLabels.push(FIELD_LABELS[field]);
  }

  return { patch, fields: updatedFieldLabels };
}

export function detectResearchChatBriefField(question) {
  const text = clean(question);
  if (isPureConsultation(text)) return "";
  if (isBriefWideQuestion(text)) return "all";

  // Explicit field names / fill verbs have priority
  if (/(研究意图|研究方向|我想研究|我要研究|关注什么|课题是|研究的是|聚焦于|填写意图|设置意图|写入意图)/.test(text)) {
    return "researchIntent";
  }
  if (/(研究目标|作战目标|目标应该|目标是什么|目的是|研究什么)/.test(text)) return "objective";
  if (/(核心思路|总体思路|设计思路|方案思路|机制是|路径是)/.test(text)) return "approach";
  if (/(关键假设|约束条件|前提条件|边界条件|假设是|约束是)/.test(text)) return "assumptions";
  if (/(预期效果|期望效果|成功标准|评估指标|效果是|结果是)/.test(text)) return "expectedEffects";
  if (/(主要风险|风险是|威胁是|薄弱环节|不足在于)/.test(text)) return "risk";

  // Broader casual fallbacks
  if (/(风险|威胁|薄弱|不足)/.test(text)) return "risk";
  if (/(效果|预期|结果|指标|评估)/.test(text)) return "expectedEffects";
  if (/(假设|约束|前提|条件|边界)/.test(text)) return "assumptions";
  if (/(目标|目的|任务)/.test(text)) return "objective";
  if (/(思路|设计|方案|机制|路径)/.test(text)) return "approach";

  // Tactical / operational mechanisms
  if (/(打法|战法|突防|对抗|协同|蜂群|防空|反导)/.test(text)) return "approach";

  return "";
}

export function detectResearchChatBriefFields(question) {
  const text = clean(question);
  if (isPureConsultation(text)) return [];
  if (isBriefWideQuestion(text)) return [...ALL_BRIEF_FIELDS];

  const explicit = detectExplicitFields(text);
  if (explicit.length > 0) return explicit;

  const fallback = detectResearchChatBriefField(text);
  return fallback ? [fallback] : [];
}

function resolveTargetFields(text, briefUpdate) {
  if (isBriefWideQuestion(text)) {
    return ALL_BRIEF_FIELDS;
  }

  const explicit = detectExplicitFields(text);
  if (explicit.length > 0) {
    return explicit;
  }

  // Open discussion or action question without specific single field restriction:
  // allow any fields that were populated in briefUpdate
  if (isCombatOrActionQuestion(text) || Object.keys(briefUpdate).length > 0) {
    const populated = ALL_BRIEF_FIELDS.filter((f) => Boolean(extractBriefFieldValue(briefUpdate, f)));
    if (populated.length > 0) return populated;
    const fallback = detectResearchChatBriefField(text);
    return fallback && fallback !== "none" ? [fallback] : [];
  }

  return [];
}

function detectExplicitFields(text) {
  const fields = [];
  if (/(研究意图|研究方向|我想研究|我要研究|关注什么|课题是|研究的是|聚焦于|填写意图|设置意图|写入意图)/.test(text)) {
    fields.push("researchIntent");
  }
  if (/(研究目标|作战目标|目标应该|目标是什么|目的是|研究什么)/.test(text) || (fields.length === 0 && /(目标|目的|任务)/.test(text))) {
    if (!fields.includes("objective")) fields.push("objective");
  }
  if (/(核心思路|总体思路|设计思路|方案思路|机制是|路径是)/.test(text) || (fields.length === 0 && /(思路|方案|机制|路径)/.test(text))) {
    if (!fields.includes("approach")) fields.push("approach");
  }
  if (/(关键假设|约束条件|前提条件|边界条件|假设是|约束是)/.test(text) || (fields.length === 0 && /(假设|约束|前提|条件|边界)/.test(text))) {
    if (!fields.includes("assumptions")) fields.push("assumptions");
  }
  if (/(预期效果|期望效果|成功标准|评估指标|效果是|结果是)/.test(text) || (fields.length === 0 && /(效果|预期|指标)/.test(text))) {
    if (!fields.includes("expectedEffects")) fields.push("expectedEffects");
  }
  if (/(主要风险|风险是|威胁是|薄弱环节|不足在于)/.test(text) || (fields.length === 0 && /(风险|威胁|薄弱|不足)/.test(text))) {
    if (!fields.includes("risk")) fields.push("risk");
  }
  return fields;
}

function shouldSkipFieldWrite(questionText, brief, field, projectTitle, briefUpdate) {
  const existing = meaningfulBriefValue(brief?.[field]);
  if (!existing) return false;

  // Pure status questions are always read-only when the field already has content.
  if (/(是什么|当前内容|现在写了|写了什么|已有内容)/.test(questionText)
    && !/(应该|改为|改成|更新|写成|我想|我要|请写入|帮我写|帮我填|就按|建议|拟定)/.test(questionText)) {
    return true;
  }

  const title = meaningfulBriefValue(projectTitle);
  // Allow overwrite when the project title clearly shifts the research topic.
  if (field === "researchIntent" && title && !topicAligned(existing, title)) return false;

  // How-to coaching on an already aligned researchIntent should not clobber it with unaligned/template text.
  if (field === "researchIntent" && title && topicAligned(existing, title) && isHowToQuestion(questionText)) {
    const val = extractBriefFieldValue(briefUpdate, field);
    if (!val || isGenericTemplateText(val) || !topicAligned(val, title)) {
      return true;
    }
  }

  return false;
}

function extractBriefUpdatePayload(result) {
  if (!result || typeof result !== "object") return {};
  if (result.briefUpdate && typeof result.briefUpdate === "object") {
    return result.briefUpdate;
  }
  if (ALL_BRIEF_FIELDS.some((field) => field in result)) {
    return result;
  }
  return {};
}

function extractBriefFieldValue(source, field) {
  if (!source || typeof source !== "object") return "";
  let val = source[field];
  if (val === undefined || val === null || val === "") {
    if (field === "researchIntent") val = source.intent || source.research_intent;
    else if (field === "expectedEffects") val = source.effects || source.expected_effects || source.effect;
    else if (field === "risk") val = source.risks || source.primaryRisk;
    else if (field === "assumptions") val = source.assumption || source.keyAssumptions;
    else if (field === "objective") val = source.goal || source.goals || source.objectives;
    else if (field === "approach") val = source.coreIdea || source.method || source.strategy;
  }
  return cleanBriefValue(val);
}

function cleanBriefValue(value) {
  let text = clean(value);
  if (!text) return "";
  text = text.replace(/^(?:\*\*[^*]+\*\*[:：]?|【[^】]+】[:：]?|[-*•]\s*)/, "").trim();
  return text;
}

function shouldSeedIntentFromProjectTitle(question, currentIntent, projectTitle) {
  if (!projectTitle) return false;
  if (!currentIntent) return true;
  if (!topicAligned(currentIntent, projectTitle)) return true;
  const text = clean(question);
  return /(我想研究|我要研究|如何填写|应该如何|怎样填写|设置研究意图|填写研究意图)/.test(text);
}

function topicAligned(left, right) {
  const a = meaningfulBriefValue(left);
  const b = meaningfulBriefValue(right);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const tokens = b.split(/[\s，。；、,.；:：/\-—]+/).map((part) => part.trim()).filter((part) => part.length >= 2);
  if (!tokens.length) return false;
  const hit = tokens.filter((token) => a.includes(token)).length;
  return hit >= Math.min(2, tokens.length);
}

function isGenericTemplateText(value) {
  return /跨域.*杀伤|边缘计算|研究框架已就绪|研究进程已就绪|多模态协同|指挥控制韧性/i.test(clean(value));
}

function isPureConsultation(text) {
  return /(为什么需要先核对公开证据|为什么.*(核对|证据|依据)|(如何|怎么).*使用.*(系统|工作台)|什么是.*(原则|功能))/i.test(text);
}

function isBriefWideQuestion(text) {
  return /(简报|全套|完善简报|生成简报|更新简报|填写简报|写简报|梳理简报|起草简报|填入简报|写入简报|概念设计|方案设计|全字段)/i.test(text);
}

function isCombatOrActionQuestion(text) {
  return /(打法|战法|突防|对抗|协同|蜂群|打击|防空|反导|部署|阵地|战术|推演|博弈|机理|机制|如何打|怎么打|帮我写|帮我填|请生成|请完善|请梳理|请起草|请拟定)/i.test(text);
}

function isHowToQuestion(text) {
  return /^(如何|怎么|怎样).{0,16}(设置|填写|定义|完善)/.test(text)
    || /(应该如何填写|如何填写|怎样填写|怎么填写|如何设置|怎样设置|怎么设置)/.test(text);
}

function meaningfulBriefValue(value) {
  const text = clean(value);
  if (!text || /^(待补充|未填写|暂无|无|—|-)$/i.test(text)) return "";
  return text;
}

function clean(value) {
  if (Array.isArray(value)) {
    value = value.map((item) => String(item || "").trim()).filter(Boolean).join("；");
  }
  const text = String(value || "").replace(/\s+/g, " ").trim().slice(0, 800);
  // Never write model self-talk into research brief fields.
  if (/人工智能助手|通过\s*API\s*提供服务|底层模型|可核验的底层|model\s*字段|当前会话没有向我|我是一名通过/i.test(text)) {
    return "";
  }
  return text;
}
