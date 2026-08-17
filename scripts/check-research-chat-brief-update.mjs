import { deriveResearchChatBriefUpdate } from "../design-studio/src/researchChatBriefUpdate.js";

const brief = { objective: "待补充", approach: "待补充", assumptions: "待补充", expectedEffects: "待补充", risk: "待补充" };
const objective = deriveResearchChatBriefUpdate({ brief, question: "研究目标应该是什么？", result: { briefUpdate: { objective: "形成可复核的区域防护概念研究目标。" } } });
assert(objective.patch.objective.includes("区域防护") && objective.fields[0] === "研究目标", "Research goal answer did not update the objective field");
const intent = deriveResearchChatBriefUpdate({ brief, question: "我想研究抽象区域防护与信息韧性概念。", result: { briefUpdate: { researchIntent: "围绕区域防护与信息韧性形成可复核的概念研究基线。" } } });
assert(intent.patch.researchIntent.includes("区域防护") && intent.fields[0] === "研究意图", "Research intent answer did not update the research-intent field");
const assumptions = deriveResearchChatBriefUpdate({ brief, question: "需要明确哪些约束条件？", result: { briefUpdate: { assumptions: "限定抽象研究输入；记录信息时效条件" } } });
assert(assumptions.patch.assumptions.includes("信息时效") && assumptions.fields[0] === "关键假设", "Constraint answer did not update the assumptions field");
const risk = deriveResearchChatBriefUpdate({ brief, question: "目前主要风险有哪些？", result: { briefUpdate: { risk: "公开信息不足；资源连续性待验证" } } });
assert(risk.patch.risk.includes("资源连续性") && risk.fields[0] === "主要风险", "Risk answer did not update the risk field");
const consultation = deriveResearchChatBriefUpdate({ brief, question: "为什么需要先核对公开证据？", result: { briefUpdate: { approach: "不应写入" } } });
assert(Object.keys(consultation.patch).length === 0 && consultation.fields.length === 0, "General consultation incorrectly overwrote the core approach field");
const approach = deriveResearchChatBriefUpdate({ brief, question: "核心思路应该如何定义？", result: { briefUpdate: { approach: "以信息闭环和分层验证组织总体研究机制。", assumptions: "不应串入" }, phases: ["错误阶段"] } });
assert(approach.patch.approach.includes("信息闭环") && !approach.patch.approach.includes("错误阶段"), "Core approach did not use its dedicated AI field");
const effects = deriveResearchChatBriefUpdate({ brief, question: "预期效果是什么？", result: { briefUpdate: { expectedEffects: "形成可观察、可比较的体系韧性判断。", approach: "不应串入" }, phases: ["错误阶段"] } });
assert(effects.patch.expectedEffects.includes("可观察") && !effects.patch.expectedEffects.includes("错误阶段"), "Expected effects were polluted by phases or another brief field");
const legacyLeak = deriveResearchChatBriefUpdate({ brief, question: "关键假设有哪些？", result: { coreIdea: "错误摘要", phases: ["错误阶段"], risks: ["错误风险"] } });
assert(Object.keys(legacyLeak.patch).length === 0, "Legacy generic ConceptPlan fields still leaked into a brief field");
console.log("Research chat brief update acceptance passed.");
function assert(condition, message) { if (!condition) throw new Error(message); }
