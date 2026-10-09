import {
  deriveResearchChatBriefUpdate,
  detectResearchChatBriefField
} from "../design-studio/src/researchChatBriefUpdate.js";
import { readFileSync } from "node:fs";

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

assert(detectResearchChatBriefField("如何设置研究意图") === "researchIntent", "How-to intent question did not target researchIntent");
assert(detectResearchChatBriefField("研究意图是什么") === "researchIntent", "Status intent question did not target researchIntent");
assert(detectResearchChatBriefField("研究意图应该如何填写") === "researchIntent", "Fill-intent question did not target researchIntent");
assert(detectResearchChatBriefField("如何定义核心思路") === "approach", "How-to approach question did not prefer approach over bare 如何");

const projectTitle = "研究美军在吕宋岛的防空反导能力";
const filledBrief = { ...brief, researchIntent: "已有跨域拒止概念研究意图" };
const statusRead = deriveResearchChatBriefUpdate({
  brief: filledBrief,
  question: "研究意图是什么",
  result: { briefUpdate: { researchIntent: "不应覆盖已有意图" } }
});
assert(Object.keys(statusRead.patch).length === 0, "Status question overwrote an already filled researchIntent");

const howToAligned = deriveResearchChatBriefUpdate({
  brief: { ...brief, researchIntent: projectTitle },
  question: "如何设置研究意图",
  projectTitle,
  result: { briefUpdate: { researchIntent: "无关模板" } }
});
assert(Object.keys(howToAligned.patch).length === 0, "How-to question overwrote an already aligned researchIntent");

const staleToTitle = deriveResearchChatBriefUpdate({
  brief: filledBrief,
  question: "研究意图应该如何填写",
  projectTitle,
  result: { briefUpdate: { researchIntent: "跨域多模态协同与指挥控制韧性研究框架" } }
});
assert(staleToTitle.patch.researchIntent === projectTitle, "Stale intent was not corrected to the project title");

const emptyHowTo = deriveResearchChatBriefUpdate({
  brief: { ...brief, researchIntent: "" },
  question: "研究意图应该如何填写",
  projectTitle,
  result: { briefUpdate: { researchIntent: "" } }
});
assert(emptyHowTo.patch.researchIntent === projectTitle, "Empty-field how-to did not seed researchIntent from project title");

const topicStatement = deriveResearchChatBriefUpdate({
  brief: { ...brief, researchIntent: "" },
  question: "我想研究美军在吕宋岛的防空反导能力",
  projectTitle,
  result: { briefUpdate: { researchIntent: "围绕跨域杀伤网与边缘计算形成研究基线" } }
});
assert(topicStatement.patch.researchIntent === projectTitle, "Generic template intent was not replaced by the project title");

// Multi-field update: question asking for multiple fields updates both
const multiField = deriveResearchChatBriefUpdate({
  brief,
  question: "请帮我梳理一下研究目标和核心思路",
  result: { briefUpdate: { objective: "构建可复核的防空反导试验目标", approach: "通过多源信息融合实施分布式拦截" } }
});
assert(multiField.patch.objective && multiField.patch.approach, "Multi-field update did not populate both objective and approach");
assert(multiField.fields.includes("研究目标") && multiField.fields.includes("核心思路"), "Multi-field labels omitted one of the updated fields");

// Brief-wide update: question mentioning "完善简报" updates all fields
const briefWide = deriveResearchChatBriefUpdate({
  brief,
  question: "请完善简报",
  result: {
    briefUpdate: {
      researchIntent: "评估分布式防空效能",
      objective: "建立多域拦截指标",
      approach: "去中心化动态指挥",
      assumptions: "前沿传感器链路保持可用",
      expectedEffects: "提升饱和打击抵御概率",
      risk: "强电磁干扰导致通信中断"
    }
  }
});
assert(Object.keys(briefWide.patch).length === 6, "Brief-wide question did not update all 6 fields");
assert(briefWide.fields.length === 6, "Brief-wide question did not record all 6 labels");

// How-to coaching on an already-filled field should write back new substantive proposal
const howToFilled = deriveResearchChatBriefUpdate({
  brief: { ...brief, approach: "已有旧思路" },
  question: "核心思路应该如何填写？",
  result: { briefUpdate: { approach: "以分布式协同与多源融合为核心战法机理" } }
});
assert(howToFilled.patch.approach === "以分布式协同与多源融合为核心战法机理", "How-to question on approach failed to auto-fill substantive AI proposal");

// Operational topic discussion with AI-generated briefUpdate writes back
const operationalChat = deriveResearchChatBriefUpdate({
  brief,
  question: "美军在吕宋岛的防空反导阵地，我们该如何进行蜂群突防？",
  result: { briefUpdate: { approach: "采用诱骗压制与饱和突防协同战法" } }
});
assert(operationalChat.patch.approach === "采用诱骗压制与饱和突防协同战法", "Operational combat discussion failed to auto-fill AI proposal");

// Key alias and array handling
const aliasAndArray = deriveResearchChatBriefUpdate({
  brief,
  question: "请帮我拟制一份概念简报",
  result: { briefUpdate: { intent: "别名研究意图", risks: ["链路中断", "阵地被毁"] } }
});
assert(aliasAndArray.patch.researchIntent === "别名研究意图", "Field alias intent was not mapped to researchIntent");
assert(aliasAndArray.patch.risk.includes("链路中断") && aliasAndArray.patch.risk.includes("阵地被毁"), "Array risk values were not joined into risk field");


const adviceControllerSource = readFileSync(new URL("../design-studio/src/inspirationAdviceController.js", import.meta.url), "utf8");
assert(adviceControllerSource.includes("当前研究简报"), "Research chat no longer sends current brief context to the model");
assert(adviceControllerSource.includes("项目标题"), "Research chat no longer sends project title as research lead-in");
assert(adviceControllerSource.includes("researchIntent"), "Research chat brief context omitted researchIntent");
const openAiSource = readFileSync(new URL("../server/openaiClient.mjs", import.meta.url), "utf8");
assert(openAiSource.includes("以“项目标题”为默认研究引子"), "Research-chat server prompt lost project-title anchoring");
assert(openAiSource.includes("研究进程已就绪"), "Research-chat server prompt lost empty-template ban");
const wireSource = readFileSync(new URL("../design-studio/src/app/wireControllers.js", import.meta.url), "utf8");
assert(wireSource.includes("getProjectTitle"), "Inspiration advice controller is not wired with project title");

console.log("Research chat brief update acceptance passed.");
function assert(condition, message) { if (!condition) throw new Error(message); }
