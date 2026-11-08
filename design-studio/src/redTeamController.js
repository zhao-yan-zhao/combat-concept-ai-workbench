import { selectEvidenceForAi } from "./evidenceSelectionStore.js";
import { generateRedTeamReview, getRedTeamHealth } from "./redTeamClient.js";
import { applyRedTeamReview, createLocalRedTeamReview, updateFindingDisposition, updateFindingCountermeasure } from "./redTeamStore.js";

export function createRedTeamController({ getState, render, notify, syncValidation }) {
  return {
    refreshHealth() {
      const state = getState();
      void refreshHealth(state, render, notify, false);
    },

    handleAction(action, element) {
      const state = getState();
      if (action === "refresh-red-team-health") {
        void refreshHealth(state, render, notify, true);
        return true;
      }
      if (action === "accept-red-team-finding") {
        const findingId = element?.dataset?.findingId || element?.closest?.("[data-finding-id]")?.dataset?.findingId || "";
        if (!findingId || !state.validationResult) return true;
        updateFindingDisposition(state.validationResult, findingId, { status: "accepted" });
        void syncValidation?.(state.validationResult, { source: "disposition-accept" });
        notify("已将红方意见标记为 [已接受]");
        render();
        return true;
      }
      if (action === "revise-red-team-finding") {
        const findingId = element?.dataset?.findingId || element?.closest?.("[data-finding-id]")?.dataset?.findingId || "";
        if (!findingId || !state.validationResult) return true;
        updateFindingDisposition(state.validationResult, findingId, { status: "revised" });
        void syncValidation?.(state.validationResult, { source: "disposition-revise" });
        notify("已将红方意见标记为 [已修订闭环]");
        render();
        return true;
      }
      if (action === "reset-red-team-finding") {
        const findingId = element?.dataset?.findingId || element?.closest?.("[data-finding-id]")?.dataset?.findingId || "";
        if (!findingId || !state.validationResult) return true;
        updateFindingDisposition(state.validationResult, findingId, { status: "pending" });
        void syncValidation?.(state.validationResult, { source: "disposition-reset" });
        notify("已重置红方意见状态为 [待处置]");
        render();
        return true;
      }
      if (action === "reject-red-team-finding") {
        const findingId = element?.dataset?.findingId || element?.closest?.("[data-finding-id]")?.dataset?.findingId || "";
        if (!findingId || !state.validationResult) return true;
        const promptFn = typeof window !== "undefined" && typeof window.prompt === "function" ? window.prompt : null;
        const rationale = promptFn ? promptFn("请输入驳回该红方意见的理由（必填）：") : "经推演评估，已具备备用手段覆盖该风险。";
        if (!rationale || !String(rationale).trim()) {
          notify("驳回失败：必须填写驳回理由");
          return true;
        }
        updateFindingDisposition(state.validationResult, findingId, { status: "rejected", rejectionRationale: rationale });
        void syncValidation?.(state.validationResult, { source: "disposition-reject" });
        notify("已驳回该红方意见，驳回理由已留存");
        render();
        return true;
      }
      if (action === "set-countermeasure-mode") {
        const findingId = element?.dataset?.findingId || element?.closest?.("[data-finding-id]")?.dataset?.findingId || "";
        const mode = element?.dataset?.mode;
        if (!findingId || !state.validationResult) return true;
        updateFindingCountermeasure(state.validationResult, findingId, { responseMode: mode });
        void syncValidation?.(state.validationResult, { source: "countermeasure-mode" });
        render();
        return true;
      }
      if (action === "save-countermeasure-response") {
        const findingId = element?.dataset?.findingId || element?.closest?.("[data-finding-id]")?.dataset?.findingId || "";
        if (!findingId || !state.validationResult) return true;
        const textarea = typeof document !== "undefined" ? document.querySelector(`.countermeasure-response-input[data-finding-id="${findingId}"]`) : null;
        const respText = textarea ? textarea.value : "";
        if (!String(respText).trim()) {
          notify("请输入具体的我方应对举措以达成闭环");
          return true;
        }
        updateFindingCountermeasure(state.validationResult, findingId, {
          responseMode: "counteract",
          ourResponse: respText
        });
        void syncValidation?.(state.validationResult, { source: "countermeasure-save-resp" });
        notify("已成功记录我方应对战术举措");
        render();
        return true;
      }
      if (action === "save-countermeasure-risk") {
        const findingId = element?.dataset?.findingId || element?.closest?.("[data-finding-id]")?.dataset?.findingId || "";
        if (!findingId || !state.validationResult) return true;
        const textarea = typeof document !== "undefined" ? document.querySelector(`.countermeasure-risk-input[data-finding-id="${findingId}"]`) : null;
        const riskText = textarea ? textarea.value : "";
        if (!String(riskText).trim()) {
          notify("接受风险失败：必须填写接受风险的可控理由留存审计痕迹");
          return true;
        }
        updateFindingCountermeasure(state.validationResult, findingId, {
          responseMode: "accept-risk",
          acceptedRiskRationale: riskText
        });
        void syncValidation?.(state.validationResult, { source: "countermeasure-save-risk" });
        notify("已确认接受对抗风险，论证理由已留存");
        render();
        return true;
      }
      if (action !== "run-red-team") return false;
      if (!state.validationResult) {
        notify("请先运行设计验证，再生成红方质询");
        return true;
      }
      if (state.redTeamRunning) return true;
      void runReview(state, render, notify, syncValidation);
      return true;
    }
  };
}

async function refreshHealth(state, render, notify, announce) {
  if (state.redTeamHealth?.status === "loading") return;
  state.redTeamHealth = { status: "loading" };
  render();
  try {
    const health = await getRedTeamHealth();
    state.redTeamHealth = {
      status: "ready",
      configured: Boolean(health?.configured),
      provider: String(health?.provider || "AI 服务"),
      model: String(health?.model || ""),
      mode: String(health?.mode || "")
    };
    if (announce) notify(health?.configured ? "AI 红方服务已配置" : "AI 未配置，将使用本地规则降级");
  } catch {
    state.redTeamHealth = { status: "unavailable" };
    if (announce) notify("无法获取 AI 红方服务状态");
  } finally {
    render();
  }
}

async function runReview(state, render, notify, syncValidation) {
  const validationId = state.validationResult?.id;
  state.redTeamRunning = true;
  render();
  const evidenceSelection = await collectEvidence(state);
  const evidence = evidenceSelection.items;
  try {
    const response = await generateRedTeamReview({
      concept: {
        direction: state.direction,
        activities: state.ov5.activities,
        edges: state.ov5.edges,
        ooda: state.ooda,
        scenario: state.scenario
      },
      validation: state.validationResult,
      evidence
    });
    if (state.validationResult?.id !== validationId) return;
    applyRedTeamReview(state.validationResult, { ...response.review, mode: "ai", provider: response.provider, model: response.model, evidenceSelection: evidenceSelection.provenance });
    notify("AI 红方质询已生成，已关联检索证据");
  } catch {
    if (state.validationResult?.id !== validationId) return;
    applyRedTeamReview(state.validationResult, { ...createLocalRedTeamReview(state.validationResult, evidence), evidenceSelection: evidenceSelection.provenance });
    notify("AI 服务暂不可用，已生成本地规则质询");
  } finally {
    if (state.validationResult?.id === validationId) {
      state.redTeamRunning = false;
      void syncValidation?.(state.validationResult, { source: state.validationResult.redTeamReview?.mode === "ai" ? "ai-red-team" : "local-red-team" });
      render();
    }
  }
}

async function collectEvidence(state) {
  const query = [
    state.direction,
    ...state.ov5.activities.map((item) => `${item.title} ${(item.refs || []).join(" ")}`),
    ...(state.validationResult?.issues || []).map((item) => item.title)
  ].join(" ");
  return selectEvidenceForAi({ query, knowledge: state.knowledge, knowledgeStorage: state.knowledgeStorage, limit: 6 });
}
