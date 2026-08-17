import { generateWithAiStream, isAiOutput } from "../../shared/aiClient.js";
import {
  combatFocusesForAnalysis,
  compactCombatFocusForAnalysis,
  isCombatFocusConfirmed
} from "./combatFocusStore.js";
import { compactRuleLibraryForAnalysis } from "../../shared/conceptPlanning.js";
import {
  createPhaseActionConceptFromBrief,
  isPhaseActionConceptConfirmed,
  persistPhaseAction
} from "./phaseActionStore.js";
import {
  ensurePhaseActionChatWelcome,
  persistPhaseActionChat,
  phaseActionChatStepStore,
  seedPhaseActionChatFromPlan,
  summarizePhaseActionChat
} from "./phaseActionChatStore.js";
import {
  createResearchChatController,
  createResearchChatSessionApplier
} from "./researchChat/index.js";

export function createPhaseActionChatController({
  projectId,
  getState,
  render,
  notify,
  syncPhaseAction,
  onChatPersisted = () => {}
}) {
  const applySession = createResearchChatSessionApplier({
    key: "phaseActionChat",
    projectId,
    store: phaseActionChatStepStore
  });

  const chat = createResearchChatController({
    scope: "phase-action",
    topic: "revision",
    getState,
    render,
    notify,
    getSession: (state) => state.phaseActionChat,
    setSession: applySession,
    onAfterTurn: () => {
      onChatPersisted("phase-action-chat");
    },
    isGenerating: (state) => Boolean(state.phaseActionChatGenerating),
    setGenerating: (state, value) => {
      state.phaseActionChatGenerating = Boolean(value);
    },
    canSend: (state) => {
      if (state.phaseActionGenerating) {
        return { ok: false, reason: "阶段生成进行中，请稍候" };
      }
      if (!isCombatFocusConfirmed(state.combatFocus)) {
        return { ok: false, reason: "请先确认作战聚焦并生成阶段草案" };
      }
      if (!state.phaseAction?.phases?.length) {
        return { ok: false, reason: "请先生成阶段草案，再通过对话修订" };
      }
      if (isPhaseActionConceptConfirmed(state.phaseAction, state.phaseActionStorage)) {
        return { ok: false, reason: "本步已确认，如需修改请先重新生成草案" };
      }
      return true;
    },
    async runTurn({ question, state, onDelta, onJob, resumeJobId, signal }) {
      if (state.phaseActionGenerating) {
        const error = new Error("busy");
        error.notifyMessage = "阶段修订进行中，请稍候";
        error.fallbackAdvice = "请稍候当前生成完成后再发送修订要求。";
        throw error;
      }
      if (!isCombatFocusConfirmed(state.combatFocus)) {
        const error = new Error("focus");
        error.notifyMessage = "请先确认作战聚焦并生成阶段草案";
        error.fallbackAdvice = "请先确认作战聚焦并生成阶段草案，再通过对话修订。";
        throw error;
      }
      if (!state.phaseAction?.phases?.length) {
        const error = new Error("empty");
        error.notifyMessage = "请先生成阶段草案，再通过对话修订";
        error.fallbackAdvice = "请先生成阶段草案，再通过对话修订。";
        throw error;
      }

      const previousFocusId = state.phaseActionFocusId || "";
      const previousFocusName = state.phaseAction.phases.find((phase) => phase.id === previousFocusId)?.name || "";
      const compactFocus = compactCombatFocusForAnalysis(state.combatFocus);
      const recentChat = summarizePhaseActionChat(state.phaseActionChat);
      const revisionNotes = [recentChat, `本轮修订要求：${question}`].filter(Boolean).join("\n");
      const previousPhaseNames = (state.phaseAction?.phases || []).map((phase) => phase.name).filter(Boolean);
      const diversitySeed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const ruleLibrary = compactRuleLibraryForAnalysis(state.ov6a || { rules: [] });

      try {
        const response = await generateWithAiStream({
          workflowId: "phase-action",
          workflow: { id: "phase-action", title: "阶段与行动对话修订", outputSchema: "PhaseActionConcept" },
          analysis: {
            ...briefAnalysis(state.brief),
            combatFocus: compactFocus,
            combatFocuses: combatFocusesForAnalysis(state.combatFocus),
            ruleLibrary,
            currentPhaseAction: compactPhaseActionForRevision(state.phaseAction),
            focusedPhaseId: previousFocusId,
            focusedPhaseName: previousFocusName,
            previousPhaseNames,
            diversitySeed,
            reviewNotes: revisionNotes,
            revisionRequest: question,
            "修订要求": "根据研究人员本轮修订要求，在保留合理部分的前提下更新阶段链。阶段数量仍可变（2～12）。优先落实本轮要求，不要无故整页重写无关阶段。输出须保持专业 CONOPS 语气（克制、可复核）：蓝/红行动写相对时点+主体+方式+对象/责任区+可观察门槛；红方须对蓝方行动作因果回应。时窗必须有理有据：相邻衔接、职能加权（主交战最长）、transitions.note 写时点与划分依据，禁止无依据等长切分。优先术语：航迹融合、交战授权、分层拦截、漏防补射、关键节点生存。若 analysis.ruleLibrary 非空，蓝/红行动与进入退出须落实规则中的作战活动与约束；已有类似表述则不重复堆叠。禁止空泛套话与“编队展开→电子诱发→火力释放→撤离”固定模板（除非修订明确要求）。回答结果必须是完整 PhaseActionConcept。"
          },
          evidence: []
        }, {
          durable: true,
          projectId,
          scope: "phase-action",
          resumeJobId,
          onJob,
          signal,
          onDelta: (payload) => {
            const preview = String(payload?.preview || "").trim()
              || (payload?.assembled ? `正在生成阶段草案… ${Math.min(100, Math.round(String(payload.assembled).length / 40))}%` : "");
            if (preview) onDelta?.({ preview, assembled: payload.assembled || "" });
          }
        });

        if (!isAiOutput(response)) throw new Error("phase action chat response incomplete");

        const next = createPhaseActionConceptFromBrief(state.brief, response.result, {
          source: "ai",
          combatFocus: compactFocus,
          previousPhaseNames,
          diversitySeed,
          ruleLibrary
        });
        next.reviewNotes = String(question || "").trim().slice(0, 2000);
        next.status = "draft";
        next.confirmedAt = "";
        state.phaseAction = persistPhaseAction(next, projectId);
        state.phaseActionFocusId = resolveFocusId(next.phases, previousFocusId, previousFocusName);
        await syncPhaseAction(state.phaseAction, { source: "phase-action:chat-revise" });

        return {
          advice: formatRevisionAdvice(question, state.phaseAction),
          source: "ai",
          notifyMessage: `已按对话修订阶段草案（${state.phaseAction.phases.length} 段），请在中间栏复核`
        };
      } catch (error) {
        if (error?.name === "AbortError" || signal?.aborted) throw error;
        const err = error instanceof Error ? error : new Error(String(error || "ai-unavailable"));
        err.fallbackAdvice = createFallbackAdvice(question);
        err.notifyMessage = "AI 暂不可用，已记录本地修订建议；阶段草案未改动";
        throw err;
      }
    }
  });

  return {
    bind: chat.bind,
    stop: chat.stop,
    seedFromPlan(plan) {
      const state = getState();
      state.phaseActionChat = persistPhaseActionChat(seedPhaseActionChatFromPlan(plan), projectId);
      onChatPersisted("phase-action-chat:seed");
    },
    ensureWelcome(plan) {
      const state = getState();
      state.phaseActionChat = persistPhaseActionChat(
        ensurePhaseActionChatWelcome(state.phaseActionChat, plan),
        projectId
      );
    }
  };
}

function formatRevisionAdvice(question, plan = {}) {
  const phases = Array.isArray(plan.phases) ? plan.phases : [];
  const chain = phases.map((phase, index) => `${index + 1}.${String(phase.name || "").trim() || "未命名"}`).join(" → ");
  const subject = String(question || "").replace(/\s+/g, " ").trim().slice(0, 60);
  return `已根据“${subject || "你的修订要求"}”更新阶段草案。当前阶段链：${chain || "—"}。请在中间栏核对蓝/红行动、时窗与转换条件；若还需调整可继续说明。`.slice(0, 360);
}

function createFallbackAdvice(question) {
  const subject = String(question || "").replace(/\s+/g, " ").trim().slice(0, 90) || "该修订要求";
  return `围绕“${subject}”，建议先明确：改哪个阶段、改顺序还是改行动/转换条件。AI 恢复后可再发送同一条要求直接改草案；当前阶段内容未改动。`;
}

function resolveFocusId(phases = [], previousId = "", previousName = "") {
  if (previousId && phases.some((phase) => phase.id === previousId)) return previousId;
  if (previousName) {
    const match = phases.find((phase) => phase.name === previousName);
    if (match) return match.id;
  }
  return phases[0]?.id || "";
}

function compactPhaseActionForRevision(plan = {}) {
  return {
    status: plan.status || "draft",
    phases: (plan.phases || []).map((phase) => ({
      id: phase.id,
      name: phase.name,
      sequence: phase.sequence,
      timeWindow: phase.timeWindow,
      objective: phase.objective,
      blueActions: phase.blueActions?.length ? phase.blueActions : phase.primaryActions,
      redActions: phase.redActions?.length ? phase.redActions : phase.secondaryActions,
      entryConditions: phase.entryConditions,
      exitConditions: phase.exitConditions,
      expectedEffects: phase.expectedEffects,
      forceIds: phase.forceIds
    })),
    transitions: (plan.transitions || []).map((item) => ({
      id: item.id,
      fromPhaseId: item.fromPhaseId,
      toPhaseId: item.toPhaseId,
      condition: item.condition,
      note: item.note
    })),
    openQuestions: plan.openQuestions || [],
    reviewChecklist: plan.reviewChecklist || []
  };
}

function briefAnalysis(brief = {}) {
  return {
    研究意图: brief.researchIntent || "",
    任务目标: brief.objective || "",
    核心思路: brief.approach || "",
    关键假设: brief.assumptions || "",
    预期效果: brief.expectedEffects || "",
    主要风险: brief.risk || ""
  };
}
