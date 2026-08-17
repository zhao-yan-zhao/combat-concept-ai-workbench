import { generateWithAiStream, isAiOutput } from "../../shared/aiClient.js";
import { listCmoMissionTypes } from "../../shared/cmoMissionTypes.js";
import {
  compactForceMissionForAnalysis,
  createForceMissionPlanFromBrief,
  isForceMissionPlanConfirmed,
  persistForceMission
} from "./forceMissionStore.js";
import {
  ensureForceMissionChatWelcome,
  forceMissionChatStepStore,
  persistForceMissionChat,
  seedForceMissionChatFromPlan,
  summarizeForceMissionChat
} from "./forceMissionChatStore.js";
import {
  createResearchChatController,
  createResearchChatSessionApplier
} from "./researchChat/index.js";

export function createForceMissionChatController({
  projectId,
  getState,
  render,
  notify,
  syncForceMission,
  onChatPersisted = () => {}
}) {
  const applySession = createResearchChatSessionApplier({
    key: "forceMissionChat",
    projectId,
    store: forceMissionChatStepStore
  });

  const chat = createResearchChatController({
    scope: "force-mission",
    topic: "revision",
    getState,
    render,
    notify,
    getSession: (state) => state.forceMissionChat,
    setSession: applySession,
    onAfterTurn: () => {
      onChatPersisted("force-mission-chat");
    },
    isGenerating: (state) => Boolean(state.forceMissionChatGenerating),
    setGenerating: (state, value) => {
      state.forceMissionChatGenerating = Boolean(value);
    },
    canSend: (state) => {
      if (state.forceMissionGenerating) {
        return { ok: false, reason: "兵力生成进行中，请稍候" };
      }
      if (!state.forceMission?.forces?.length && !state.forceMission?.combatForces?.length) {
        return { ok: false, reason: "请先生成兵力与任务草案，再通过对话修订" };
      }
      if (isForceMissionPlanConfirmed(state.forceMission, state.forceMissionStorage)) {
        return { ok: false, reason: "本步已确认，如需修改请先重新生成草案" };
      }
      return true;
    },
    async runTurn({ question, state, onDelta, onJob, resumeJobId, signal }) {
      if (state.forceMissionGenerating) {
        const error = new Error("busy");
        error.notifyMessage = "兵力生成进行中，请稍候";
        error.fallbackAdvice = "请稍候当前生成完成后再发送修订要求。";
        throw error;
      }
      if (!state.forceMission?.forces?.length && !state.forceMission?.combatForces?.length) {
        const error = new Error("empty");
        error.notifyMessage = "请先生成兵力与任务草案，再通过对话修订";
        error.fallbackAdvice = "请先生成兵力与任务草案，再通过对话修订。";
        throw error;
      }

      const recentChat = summarizeForceMissionChat(state.forceMissionChat);
      const revisionNotes = [recentChat, `本轮修订要求：${question}`].filter(Boolean).join("\n");
      const phaseAction = state.phaseAction || {};
      const phaseConfirmed = phaseAction.status === "confirmed";

      try {
        const response = await generateWithAiStream({
          workflowId: "force-mission",
          workflow: { id: "force-mission", title: "兵力与任务对话修订", outputSchema: "ForceMissionPlan" },
          analysis: {
            ...briefAnalysis(state.brief),
            phaseAction: compactPhaseAction(phaseAction),
            phaseActionStatus: phaseAction.status || "draft",
            phaseActionConfirmed: phaseConfirmed,
            currentForceMission: compactForceMissionForAnalysis(state.forceMission),
            cmoMissionTypes: listCmoMissionTypes(),
            reviewNotes: revisionNotes,
            revisionRequest: question,
            "修订要求": "根据研究人员本轮修订要求，在保留合理部分的前提下更新兵力与任务草案。必须同时输出概念兵力 forces 与作战兵力 combatForces。优先落实本轮要求，不要无故整页重写无关编组。概念兵力按阶段职责语义；作战兵力可挂接概念单元与任务类型。回答结果必须是完整 ForceMissionPlan。"
          },
          evidence: []
        }, {
          durable: true,
          projectId,
          scope: "force-mission",
          resumeJobId,
          onJob,
          signal,
          onDelta: (payload) => {
            const preview = String(payload?.preview || "").trim()
              || (payload?.assembled
                ? `正在修订兵力草案… ${Math.min(100, Math.round(String(payload.assembled).length / 50))}%`
                : "");
            if (preview) onDelta?.({ preview, assembled: payload.assembled || "" });
          }
        });

        if (!isAiOutput(response)) throw new Error("force mission chat response incomplete");

        const next = createForceMissionPlanFromBrief(state.brief, response.result, {
          source: "ai",
          phaseAction: state.phaseAction
        });
        next.reviewNotes = String(question || "").trim().slice(0, 2000);
        next.status = "draft";
        next.confirmedAt = "";
        state.forceMission = persistForceMission(next, projectId);
        await syncForceMission(state.forceMission, { source: "force-mission:chat-revise" });

        return {
          advice: formatRevisionAdvice(question, state.forceMission),
          source: "ai",
          notifyMessage: `已按对话修订兵力草案（概念 ${state.forceMission.forces?.length || 0} / 作战 ${state.forceMission.combatForces?.length || 0}），请复核`
        };
      } catch (error) {
        if (error?.name === "AbortError" || signal?.aborted) throw error;
        const err = error instanceof Error ? error : new Error(String(error || "ai-unavailable"));
        err.fallbackAdvice = createFallbackAdvice(question);
        err.notifyMessage = "AI 暂不可用，已记录本地修订建议；兵力草案未改动";
        throw err;
      }
    }
  });

  return {
    bind: (root) => chat.bind(root),
    ask: (...args) => chat.ask(...args),
    stop: chat.stop,
    seedFromPlan(plan) {
      const state = getState();
      state.forceMissionChat = persistForceMissionChat(seedForceMissionChatFromPlan(plan), projectId);
      onChatPersisted("force-mission-chat:seed");
    },
    ensureWelcome(plan) {
      const state = getState();
      state.forceMissionChat = persistForceMissionChat(
        ensureForceMissionChatWelcome(state.forceMissionChat, plan),
        projectId
      );
    }
  };
}

function formatRevisionAdvice(question, plan = {}) {
  const concepts = Array.isArray(plan.forces) ? plan.forces.length : 0;
  const combats = Array.isArray(plan.combatForces) ? plan.combatForces.length : 0;
  const relations = Array.isArray(plan.relations) ? plan.relations.length : 0;
  const subject = String(question || "").replace(/\s+/g, " ").trim().slice(0, 60);
  return `已根据“${subject || "你的修订要求"}”更新兵力与任务草案。当前：概念兵力 ${concepts}、作战兵力 ${combats}、关系 ${relations}。请在中间栏核对职责、阶段挂接与任务类型；若还需调整可继续说明。`.slice(0, 360);
}

function createFallbackAdvice(question) {
  const subject = String(question || "").replace(/\s+/g, " ").trim().slice(0, 90) || "该修订要求";
  return `围绕“${subject}”，建议先明确：改概念层还是作战层、改哪个阶段挂接、改职责还是任务类型/关系。AI 恢复后可再发送同一条要求直接改草案；当前兵力内容未改动。`;
}

function compactPhaseAction(plan = {}) {
  return {
    status: plan.status || "draft",
    phases: (plan.phases || []).map((phase) => ({
      id: phase.id,
      name: phase.name,
      sequence: phase.sequence,
      objective: phase.objective,
      blueActions: phase.blueActions || phase.primaryActions || [],
      redActions: phase.redActions || phase.secondaryActions || []
    }))
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
