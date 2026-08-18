import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { views, workflowPrimaryStepIds, workflowTracks } from "../design-studio/src/data.js";
import { renderPhaseAction } from "../design-studio/src/phaseActionView.js";
import { renderOv6a } from "../design-studio/src/dodafOperationalViews.js";
import { normalizeDodafOv6a } from "../shared/dodaf/products.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const phaseTrack = workflowTracks.find((track) => track.id === "phase");
assert(phaseTrack?.viewIds.join(",") === "ov6a,phase-action,ov6b,ov6c", "Phase track order must be 规则库→阶段→状态→时序");
assert(workflowPrimaryStepIds.slice(1, 5).join(",") === "ov6a,phase-action,ov6b,ov6c", "Primary path must pin the phase chain");

const ids = views.map((view) => view.id);
assert(ids.indexOf("ov6a") === ids.indexOf("brief") + 1, "Rule library must immediately follow brief in navigation order");
assert(ids.indexOf("phase-action") === ids.indexOf("ov6a") + 1, "Phase-action must follow rule library");

const emptyPhase = {
  activeView: "ov6a",
  phaseAction: { status: "empty", phases: [] },
  phaseActionStorage: { stale: false },
  ov6a: normalizeDodafOv6a({ rules: [] })
};

const confirmedPhase = {
  activeView: "ov6a",
  phaseAction: {
    status: "confirmed",
    phases: [
      { id: "p1", name: "A", objective: "o", primaryActions: ["x"], blueActions: ["x"] },
      { id: "p2", name: "B", objective: "o", primaryActions: ["y"], blueActions: ["y"] }
    ],
    transitions: [],
    confirmedAt: "2026-08-11T00:00:00.000Z"
  },
  phaseActionStorage: { stale: false },
  ov6a: normalizeDodafOv6a({ rules: [{ id: "r1", name: "规则", description: "d" }] })
};

const phasePage = renderPhaseAction({
  ...confirmedPhase,
  combatFocus: { status: "confirmed", options: [], selectedIds: [] },
  phaseActionFocusId: "p1"
});
assert(!phasePage.includes("phase-chain-fab") && !phasePage.includes("阶段行动链"), "Phase page must not host the removed chain ball");
assert(phasePage.includes("phase-action-page"), "Phase page must still render");

const rulePage = renderOv6a({ ...confirmedPhase, activeView: "ov6a", ov6aStorage: {} });
assert(!rulePage.includes("phase-chain-fab") && !rulePage.includes("toggle-phase-chain-guide"), "Rule page must not host the removed chain ball");
assert(rulePage.includes("rule-form-board") && !rulePage.includes("ov6a-toggle-binding"), "Rule library stays form-only without binding options");

// Brief → rule library pregenerate path (static wiring).
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mainJs = readFileSync(join(root, "design-studio/src/main.js"), "utf8");
const indexHtml = readFileSync(join(root, "design-studio/index.html"), "utf8");
const ruleCtrl = readFileSync(join(root, "design-studio/src/ruleLibraryChatController.js"), "utf8");
const openaiClient = readFileSync(join(root, "server/openaiClient.mjs"), "utf8");
assert(mainJs.includes("pregenerateFromBrief") && mainJs.includes("stage === 0"), "Brief stage confirm must pregenerate rules");
assert(mainJs.includes("navigateToResearchView") && mainJs.includes("advanceWorkflowStep"), "Floating capsule 下一步 must also pregenerate rules");
assert(mainJs.includes('state.activeView === "phase-action"') && mainJs.includes('state.phaseAction?.phases?.length') && mainJs.includes('proposeChanges("phase-action"') && mainJs.includes('navigateToResearchView("ov6a"'), "Phase-action capsule must propose rules and return to rule review");
assert(mainJs.includes('entrySource: "phase-action"') && mainJs.includes('state.ruleLibraryEntrySource === "phase-action"') && mainJs.includes('change.status === "pending"') && mainJs.includes('navigateToResearchView("ov6b"'), "Only a rule-library visit entered from phase analysis may continue to the state machine");
const workflowGateJs = readFileSync(join(root, "design-studio/src/app/workflowGate.js"), "utf8");
assert(workflowGateJs.includes('state.activeView === "ov6c"') && workflowGateJs.includes('nextStep?.id === "operational-task"'), "Sequence completion must explicitly route to operational-task");
assert(workflowGateJs.includes('state.ruleLibraryEntrySource === "phase-action"') && workflowGateJs.includes('capsuleAction: "规则库审核"') && workflowGateJs.includes('capsuleAction: pendingCount ? `待审核 ${pendingCount}` : "状态机校验"'), "Capsule labels must follow the current rule-library entry source");
assert(mainJs.includes("void navigateToResearchView(viewId)"), "Left floating step rail data-view must pregenerate on 规则库");
assert(mainJs.includes('action === "toggle-workflow-gate"') && mainJs.includes("setWorkflowGateOpen(!state.workflowGateOpen)"), "Capsule click must expand/collapse panel");
assert(mainJs.includes("ruleLibraryPregenerating") && mainJs.includes("根据简报生成作战规则"), "Stage transition overlay must cover rule pregenerate");
assert(mainJs.includes("ruleLibraryChangeGenerating") && mainJs.includes("正在分析阶段规则"), "Capsule rule analysis must show a transition overlay");
assert(mainJs.includes("ensureCombatFocusOnEnterPhaseAction") && mainJs.includes('viewId === "phase-action"'), "Rule library → phase-action must auto-generate 3 combat focus directions");
assert(mainJs.includes("根据简报生成 3 个作战聚焦方向"), "Phase-action enter overlay must describe focus generation");
assert(mainJs.includes("combatFocusGenerating"), "Busy overlay must cover combat focus generation");
assert(mainJs.includes('viewId === "ov6c"') && mainJs.includes("pregenerateOv6cFromPhase"), "State-machine next step must auto-generate an empty sequence model before review");
assert(mainJs.includes("updateBusyOverlayProgress") && mainJs.includes("expectedMs") && mainJs.includes("timeoutMs"), "Busy overlay must expose elapsed and estimated progress timing");
assert(indexHtml.includes('role="progressbar"') && indexHtml.includes("workflowModeElapsed") && indexHtml.includes("workflowModeEstimate"), "Busy overlay must render progress, elapsed time, and estimate");
assert(ruleCtrl.includes("pregenerateFromBrief") && ruleCtrl.includes("RULE_LIBRARY_MAX_RULES = 240"), "Rule controller must pregenerate with high safety cap");
assert(ruleCtrl.includes('reason: "has-rules"') && ruleCtrl.includes("existingCount > 0"), "Re-entering step 2 with existing rules must skip regenerate");
assert(ruleCtrl.includes("state.ov6a && Array.isArray(state.ov6a.rules)"), "Pregenerate empty-check must use project ov6a, not OV-5 seed");
assert(ruleCtrl.includes("isRuleAddRequest") && ruleCtrl.includes("applyChatDraftToLibrary") && ruleCtrl.includes("createLocalMutationDraft"), "Chat add-rules must write form, not advice-only");
assert(openaiClient.includes("maxItems: 240") && !openaiClient.includes("4～12 条为宜"), "AI schema must not cap rules at 4–12");
assert(openaiClient.includes("addOnlyRequest") && openaiClient.includes("禁止只给文字建议"), "AI prompt must force non-empty rules on add requests");
assert(openaiClient.includes("若研究人员要求生成/增删改状态机") && openaiClient.includes("analysis.currentMachines"), "State-machine chat prompt must force draft machines on mutation requests");
assert(openaiClient.includes("subjectType 必须为 phase") || openaiClient.includes("subjectType=phase") || openaiClient.includes("phase|task|force|object"), "State-machine prompt must allow phase machines from phase-action generation");
assert(openaiClient.includes("timeWindow") && openaiClient.includes("redActions") && openaiClient.includes("不得为红方行动另建状态机"), "State-machine prompt must use phase time windows and red actions as generation context");

// Chat “新增三条…” must append without wiping existing library.
const {
  applyChatDraftToLibrary,
  createLocalMutationDraft,
  ensurePhaseRuleCoverage,
  isRuleAddRequest
} = await import("../design-studio/src/ruleLibraryChatController.js");
assert(isRuleAddRequest("新增三条规则主要针对作战任务"), "Add intent must detect 新增三条");
const existingLib = normalizeDodafOv6a({
  rules: [{ id: "r1", name: "关键链路可用", type: "约束", scope: "全局", description: "链路保持" }]
});
const localAdd = createLocalMutationDraft("新增三条规则主要针对作战任务", existingLib, { objective: "体系破击" });
assert(localAdd.rules.length === 3, "Local mutation draft should honor 三条");
const chatMerged = applyChatDraftToLibrary(existingLib, localAdd, { mutation: true, addOnly: true });
assert(chatMerged.changed && chatMerged.added === 3 && chatMerged.model.rules.length === 4, "Chat add must append three rules to existing library");
assert(chatMerged.model.rules[0].id === "r1", "Chat add must keep existing rule");

const coveredPhaseRules = ensurePhaseRuleCoverage({ summary: "AI only returned one merged rule", changes: [{
  id: "merged", action: "add", ruleId: "", rule: { id: "merged", name: "阶段门槛与衔接校验", type: "转换条件", scope: "phase-1、phase-2", description: "笼统描述" }, rationale: "阶段输入"
}] }, { phaseAction: [
  { id: "phase-1", name: "准备阶段", primaryActions: ["建立态势"], entryConditions: ["信息完整"], exitConditions: ["态势形成"], expectedEffects: ["形成共同态势"] },
  { id: "phase-2", name: "实施阶段", primaryActions: ["执行主要行动"], entryConditions: ["授权完成"], exitConditions: ["目标效果确认"], expectedEffects: ["形成预期效果"] }
] });
assert(coveredPhaseRules.changes.length >= 4, "Phase rule coverage must not collapse multiple phases into one rule");
assert(coveredPhaseRules.changes.some((item) => item.rule.scope.includes("准备阶段") && item.rule.type === "前置条件"), "Each phase needs an entry rule using its own content");
assert(coveredPhaseRules.changes.some((item) => item.rule.scope.includes("实施阶段") && item.rule.type === "转换条件"), "Each phase needs an exit/effect rule using its own content");
assert(coveredPhaseRules.changes.filter((item) => item.rule.scope.includes("准备阶段")).every((item) => item.rule.phaseRefs.includes("phase-1")), "Phase rules must carry structured phase refs");
const ruleViewJs = readFileSync(join(root, "design-studio/src/ruleLibraryView.js"), "utf8");
assert(ruleViewJs.includes("rule-phase-bindings") && ruleViewJs.includes('renderPhaseBindingTags(change.rule?.phaseRefs') && ruleViewJs.includes('renderPhaseBindingTags((rule.phaseBindings || [])'), "Rule review UI must expose proposed and accepted phase bindings");

// Local pregenerate must not turn process text into rule titles like “首次按简报完整库规则1”.
const { generateMockOutput } = await import("../shared/generator.js");
const preDraft = generateMockOutput({
  workflow: { id: "rule-library", title: "规则库简报预生成", outputSchema: "RuleLibraryDraft" },
  analysis: {
    任务目标: "评估美菲以吕宋岛为依托的防空反导体系",
    核心思路: "体系韧性",
    预期效果: "能力判断可比较",
    主要风险: "公开资料偏差",
    关键假设: "公开资料可用",
    pregenerateFromBrief: true,
    revisionRequest: "首次按简报起草完整规则库",
    "修订要求": "这是简报确认后进入规则库的首次预生成。"
  },
  evidence: []
});
assert(Array.isArray(preDraft.result?.rules) && preDraft.result.rules.length >= 4, "Pregenerate local draft should produce multiple operational rules");
assert(
  preDraft.result.rules.every((rule) => !/首次|按简报|完整\s*库|规则\d|rule-local-add/.test(`${rule.name}|${rule.id}|${rule.scope}`)),
  "Pregenerate local rules must use operational names, not process phrases"
);

const pregenPage = renderOv6a({
  ...emptyPhase,
  ruleLibraryPregenerating: true,
  ov6aStorage: {}
});
assert(pregenPage.includes("is-pregenerating") && pregenPage.includes("正在根据简报起草规则"), "Rule library empty state must show pregenerate animation");

console.log("Phase chain acceptance passed: order, no floating chain ball, brief→rules pregenerate.");
