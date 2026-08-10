import { deriveResearchChatBriefUpdate } from "../design-studio/src/researchChatBriefUpdate.js";

const brief = { objective: "待补充", approach: "待补充", assumptions: "待补充", expectedEffects: "待补充", risk: "待补充" };
const objective = deriveResearchChatBriefUpdate({ brief, question: "研究目标应该是什么？", result: { coreIdea: "形成可复核的区域防护概念研究目标。", phases: [], risks: [] } });
assert(objective.patch.objective.includes("区域防护") && objective.fields[0] === "研究目标", "Research goal answer did not update the objective field");
const intent = deriveResearchChatBriefUpdate({ brief, question: "我想研究抽象区域防护与信息韧性概念。", result: { coreIdea: "围绕区域防护与信息韧性形成可复核的概念研究基线。", phases: [], risks: [] } });
assert(intent.patch.researchIntent.includes("区域防护") && intent.fields[0] === "研究意图", "Research intent answer did not update the research-intent field");
const assumptions = deriveResearchChatBriefUpdate({ brief, question: "需要明确哪些约束条件？", result: { coreIdea: "", phases: ["限定抽象研究输入", "记录信息时效条件"], risks: [] } });
assert(assumptions.patch.assumptions.includes("信息时效") && assumptions.fields[0] === "关键假设", "Constraint answer did not update the assumptions field");
const risk = deriveResearchChatBriefUpdate({ brief, question: "目前主要风险有哪些？", result: { coreIdea: "", phases: [], risks: ["公开信息不足", "资源连续性待验证"] } });
assert(risk.patch.risk.includes("资源连续性") && risk.fields[0] === "主要风险", "Risk answer did not update the risk field");
console.log("Research chat brief update acceptance passed.");
function assert(condition, message) { if (!condition) throw new Error(message); }
