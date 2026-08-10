import { generateWithAi, isAiOutput } from "../../shared/aiClient.js";
import { selectEvidenceForAi } from "./evidenceSelectionStore.js";
import { applyAiBriefDraft, areConceptBriefsEqual, createLocalBriefDraft, normalizeConceptBrief, normalizeEvidenceRefs, saveConceptBrief } from "./briefStore.js";
import { summarizeInspirationSession } from "./inspirationStore.js";

export function createBriefController({ getState, render, notify, invalidateDerivedArtifacts, seedBrief, syncBrief }) {
  return {
    bind(root) {
      root.querySelector("#briefEditorForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const state = getState();
        const input = readBriefInput(event.currentTarget, state);
        const saved = saveBrief(state, input.brief, input, seedBrief, invalidateDerivedArtifacts);
        void syncBrief?.(saved.brief, { direction: state.direction, inspiration: state.inspiration, source: "manual" });
        notify("概念简报已保存；请复核下游模型");
        render();
      });
    },

    handleAction(action) {
      if (action !== "generate-brief") return false;
      const state = getState();
      if (state.briefGenerating) return true;
      const form = document.querySelector("#briefEditorForm");
      if (!form) return true;
      void generateBrief(state, readBriefInput(form, state), render, notify, invalidateDerivedArtifacts, seedBrief, syncBrief);
      return true;
    }
  };
}

async function generateBrief(state, input, render, notify, invalidateDerivedArtifacts, seedBrief, syncBrief) {
  state.briefGenerating = true;
  state.briefDraftReveal = false;
  state.briefIntent = input.intent;
  state.briefIncludeEvidence = input.includeEvidence;
  render();
  // Inspiration is context for generation, not part of the user-authored research intent.
  const researchIntent = String(input.intent || "").trim();
  const researchContext = composeResearchContext(researchIntent, state.inspiration);
  const evidenceSelection = input.includeEvidence ? await collectEvidence(input, state, researchContext) : { items: [], provenance: null };
  const evidence = evidenceSelection.items;
  try {
    const response = await generateWithAi({
      workflowId: "concept_brief",
      workflow: { title: "概念简报 AI 孵化", outputSchema: "ConceptBrief" },
      analysis: { researchIntent: researchContext, direction: state.direction, currentBrief: input.brief },
      evidence
    });
    if (!isAiOutput(response)) throw new Error("AI 简报响应不完整");
    const saved = saveBrief(state, applyAiBriefDraft({ ...input, intent: researchIntent, direction: state.direction, draft: response.result, evidence }), input, seedBrief, invalidateDerivedArtifacts);
    void syncBrief?.(saved.brief, { direction: state.direction, inspiration: state.inspiration, source: "ai" });
    notify("AI 概念简报已生成；请复核后继续建模");
  } catch {
    const saved = saveBrief(state, createLocalBriefDraft({ ...input, intent: researchIntent, direction: state.direction, evidence }), input, seedBrief, invalidateDerivedArtifacts);
    void syncBrief?.(saved.brief, { direction: state.direction, inspiration: state.inspiration, source: "local-ai-fallback" });
    notify("AI 服务暂不可用，已生成本地研究草案");
  } finally {
    state.briefGenerating = false;
    // Brief field flash after draft lands; cleared on next interaction/render cycle.
    state.briefDraftReveal = true;
    render();
    window.setTimeout(() => {
      if (!state.briefDraftReveal) return;
      state.briefDraftReveal = false;
      const form = document.querySelector("#briefEditorForm");
      form?.classList.remove("is-draft-reveal");
    }, 1200);
  }
}

function readBriefInput(form, state) {
  const data = new FormData(form);
  return {
    intent: String(data.get("intent") || "").trim(),
    includeEvidence: data.get("includeEvidence") === "on",
    brief: normalizeConceptBrief({
      researchIntent: data.get("intent"),
      objective: data.get("objective"),
      approach: data.get("approach"),
      assumptions: data.get("assumptions"),
      expectedEffects: data.get("expectedEffects"),
      evidenceRefs: normalizeEvidenceRefs(data.get("evidenceRefs")),
      risk: data.get("risk")
    }, state.brief)
  };
}

function saveBrief(state, nextBrief, input, seedBrief, invalidateDerivedArtifacts) {
  const changed = !areConceptBriefsEqual(state.brief, nextBrief);
  state.brief = saveConceptBrief(nextBrief, seedBrief);
  state.briefIntent = state.brief.researchIntent;
  state.briefIncludeEvidence = input.includeEvidence;
  if (changed) invalidateDerivedArtifacts();
  return { brief: state.brief, changed };
}

async function collectEvidence(input, state, researchIntent) {
  const query = [researchIntent, state.direction, input.brief.objective, input.brief.approach].filter(Boolean).join(" ");
  return selectEvidenceForAi({ query, knowledge: state.knowledge, knowledgeStorage: state.knowledgeStorage, limit: 4 });
}

function composeResearchContext(intent, inspiration) {
  const summary = summarizeInspirationSession(inspiration);
  return [String(intent || "").trim(), summary].filter(Boolean).join("\n\n");
}
