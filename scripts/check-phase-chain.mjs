import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { views, workflowPrimaryStepIds, workflowTracks } from "../design-studio/src/data.js";
import { renderPhaseChainGuide } from "../design-studio/src/phaseChainGuide.js";
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
const guideBefore = renderPhaseChainGuide(emptyPhase, "ov6a");
assert(guideBefore.includes("phase-chain-fab") && guideBefore.includes("toggle-phase-chain-guide") && guideBefore.includes("规则库"), "Phase chain should render as floating ball with rule-library step");

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
const guideBind = renderPhaseChainGuide({ ...confirmedPhase, phaseChainGuideOpen: true }, "ov6a");
assert(guideBind.includes("绑定校验") && guideBind.includes("is-open"), "Post-phase open panel should highlight binding step");

const phasePage = renderPhaseAction({
  ...confirmedPhase,
  combatFocus: { status: "confirmed", options: [], selectedIds: [] },
  phaseActionFocusId: "p1"
});
assert(phasePage.includes("phase-chain-fab") && phasePage.includes("阶段行动链"), "Phase page must host floating chain ball");

const rulePage = renderOv6a({ ...confirmedPhase, activeView: "ov6a", ov6aStorage: {} });
assert(rulePage.includes("phase-chain-fab") && rulePage.includes("规则库"), "Rule page must host floating chain ball");
assert(rulePage.includes("rule-form-board") && !rulePage.includes("ov6a-toggle-binding"), "Rule library stays form-only without binding options");

// Brief → rule library pregenerate path (static wiring).
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mainJs = readFileSync(join(root, "design-studio/src/main.js"), "utf8");
const ruleCtrl = readFileSync(join(root, "design-studio/src/ruleLibraryChatController.js"), "utf8");
const openaiClient = readFileSync(join(root, "server/openaiClient.mjs"), "utf8");
assert(mainJs.includes("pregenerateFromBrief") && mainJs.includes("stage === 0"), "Brief stage confirm must pregenerate rules");
assert(mainJs.includes("navigateToResearchView") && mainJs.includes("advanceWorkflowStep"), "Floating capsule 下一步 must also pregenerate rules");
assert(mainJs.includes("void navigateToResearchView(viewId)"), "Left floating step rail data-view must pregenerate on 规则库");
assert(mainJs.includes('action === "toggle-workflow-gate"') && mainJs.includes("setWorkflowGateOpen(!state.workflowGateOpen)"), "Capsule click must expand/collapse panel");
assert(mainJs.includes("ruleLibraryPregenerating") && mainJs.includes("根据简报生成作战规则"), "Stage transition overlay must cover rule pregenerate");
assert(ruleCtrl.includes("pregenerateFromBrief") && ruleCtrl.includes("RULE_LIBRARY_MAX_RULES = 240"), "Rule controller must pregenerate with high safety cap");
assert(ruleCtrl.includes('reason: "has-rules"') && ruleCtrl.includes("existingCount > 0"), "Re-entering step 2 with existing rules must skip regenerate");
assert(ruleCtrl.includes("state.ov6a && Array.isArray(state.ov6a.rules)"), "Pregenerate empty-check must use project ov6a, not OV-5 seed");
assert(openaiClient.includes("maxItems: 240") && !openaiClient.includes("4～12 条为宜"), "AI schema must not cap rules at 4–12");

const pregenPage = renderOv6a({
  ...emptyPhase,
  ruleLibraryPregenerating: true,
  ov6aStorage: {}
});
assert(pregenPage.includes("is-pregenerating") && pregenPage.includes("正在根据简报起草规则"), "Rule library empty state must show pregenerate animation");

console.log("Phase chain acceptance passed: order, guides, post-confirm binding path, brief→rules pregenerate.");
