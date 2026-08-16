import { generateWithAiStream, isAiOutput } from "../../shared/aiClient.js";
import { generateMockOutput } from "../../shared/generator.js";
import { resolveDodafProduct, saveLocalDodafProduct } from "./dodafProductStore.js";
import {
  applyStateMachineDraft,
  buildStateMachineGenerationAnalysis
} from "./dodafProductController.js";
import {
  ensureOv6bModel,
  seedOv6bFromSubjects
} from "./ov6Workbench.js";
import {
  ensureStateMachineChatWelcome,
  persistStateMachineChat,
  seedStateMachineChatFromModel,
  stateMachineChatStepStore,
  summarizeStateMachineChat
} from "./stateMachineChatStore.js";
import {
  createResearchChatController,
  createResearchChatSessionApplier
} from "./researchChat/index.js";

/**
 * 状态机校验对话：自然语言生成/修订 stateMachines。
 * 有结构化草稿时写回 ov6b；仅咨询时只回写对话建议。
 */
export function createStateMachineChatController({
  projectId,
  getState,
  render,
  notify,
  syncOv6b = async () => {},
  onChatPersisted = () => {}
}) {
  const applySession = createResearchChatSessionApplier({
    key: "stateMachineChat",
    projectId,
    store: stateMachineChatStepStore
  });

  const chat = createResearchChatController({
    scope: "state-machine",
    topic: "revision",
    getState,
    render,
    notify,
    getSession: (state) => state.stateMachineChat,
    setSession: applySession,
    onAfterTurn: () => {
      onChatPersisted("state-machine-chat");
    },
    isGenerating: (state) => Boolean(state.stateMachineChatGenerating || state.stateMachinePregenerating),
    setGenerating: (state, value) => {
      state.stateMachineChatGenerating = Boolean(value);
    },
    canSend: (state) => {
      if (state.stateMachineChatGenerating || state.stateMachinePregenerating) {
        return { ok: false, reason: "状态机对话或预生成进行中，请稍候" };
      }
      return true;
    },
    async runTurn({ question, state, onDelta, signal }) {
      const current = ensureOv6bModel(resolveDodafProduct(state, "ov6b").model);
      const analysis = buildStateMachineGenerationAnalysis(state);
      const recentChat = summarizeStateMachineChat(state.stateMachineChat);
      const mutation = isStateMachineMutationRequest(question);
      const revisionNotes = [recentChat, `本轮要求：${question}`].filter(Boolean).join("\n");

      try {
        let draft = null;
        let source = "ai";
        try {
          const response = await generateWithAiStream({
            workflowId: "state-machine",
            workflow: {
              id: "state-machine",
              title: "状态机对话修订",
              outputSchema: "StateMachineDraft"
            },
            analysis: {
              ...analysis,
              currentMachines: compactMachines(current),
              selectedMachineId: String(state.ov6bSelectedMachineId || ""),
              reviewNotes: revisionNotes,
              revisionRequest: question,
              mutationRequest: mutation,
              generationRequest: mutation
                ? "根据本轮要求生成或修订可编辑状态机；优先落实到 stateMachines[]。"
                : analysis.generationRequest,
              "修订要求": mutation
                ? "本轮是改机请求。必须返回非空 stateMachines[]。可只返回被改的那一台（用 subjectRef 或 id 对齐现有机），也可返回完整列表。不要为阶段容器机械建机。"
                : "根据研究人员本轮要求回答。若仅咨询，stateMachines 可为空并在 summary 直接回答；若涉及生成/修订，返回完整或增量 stateMachines。"
            },
            evidence: []
          }, {
            signal,
            onDelta: (payload) => {
              const preview = String(payload?.preview || "").trim()
                || (payload?.assembled ? `正在生成状态机建议… ${Math.min(100, Math.round(String(payload.assembled).length / 40))}%` : "");
              if (preview) onDelta?.({ preview, assembled: payload.assembled || "" });
            }
          });

          if (!isAiOutput(response)) throw new Error("state machine chat response incomplete");
          draft = response.result || {};
        } catch (aiError) {
          if (aiError?.name === "AbortError" || signal?.aborted) throw aiError;
          if (!mutation) throw aiError;
          draft = createLocalStateMachineDraft(question, current, analysis);
          source = "local";
        }

        if (mutation && (!Array.isArray(draft.stateMachines) || !draft.stateMachines.length)) {
          draft = createLocalStateMachineDraft(question, current, analysis);
          if (source === "ai") source = "local";
        }

        const outcome = applyStateMachineChatDraft(current, draft, analysis, { mutation });
        if (outcome.model) {
          state.ov6b = saveLocalDodafProduct("ov6b", outcome.model, projectId);
          if (!state.ov6bSelectedMachineId || !outcome.model.stateMachines.some((item) => item.id === state.ov6bSelectedMachineId)) {
            state.ov6bSelectedMachineId = outcome.model.stateMachines[0]?.id || "";
          }
          try {
            await syncOv6b(state.ov6b, { source: "state-machine:chat-revise" });
          } catch {
            /* local draft remains */
          }
        }

        const machineCount = outcome.model?.stateMachines?.length || (current.stateMachines || []).length;
        return {
          advice: formatStateMachineAdvice(question, draft, {
            applied: outcome.changed,
            machines: machineCount
          }),
          source,
          notifyMessage: outcome.changed
            ? `已按对话更新（${machineCount} 台状态机），请在画布复核`
            : "已给出状态机研究建议（未改图）"
        };
      } catch (error) {
        if (error?.name === "AbortError" || signal?.aborted) throw error;
        if (mutation) {
          try {
            const localDraft = createLocalStateMachineDraft(question, current, analysis);
            const outcome = applyStateMachineChatDraft(current, localDraft, analysis, { mutation: true });
            if (outcome.model && outcome.changed) {
              state.ov6b = saveLocalDodafProduct("ov6b", outcome.model, projectId);
              try {
                await syncOv6b(state.ov6b, { source: "state-machine:chat-revise-local" });
              } catch {
                /* local */
              }
              return {
                advice: formatStateMachineAdvice(question, localDraft, {
                  applied: true,
                  machines: outcome.model.stateMachines.length
                }),
                source: "local",
                notifyMessage: "AI 暂不可用，已写入本地状态机草案，请复核"
              };
            }
          } catch {
            /* fall through */
          }
        }
        const err = error instanceof Error ? error : new Error(String(error || "ai-unavailable"));
        err.fallbackAdvice = "AI 暂不可用。可先点「识别建模对象」或手动加机，稍后再对话生成。";
        err.notifyMessage = "AI 暂不可用，状态机未改动";
        throw err;
      }
    }
  });

  return {
    bind: chat.bind,
    stop: chat.stop,
    seedFromModel(model) {
      const state = getState();
      state.stateMachineChat = persistStateMachineChat(seedStateMachineChatFromModel(model), projectId);
      onChatPersisted("state-machine-chat:seed");
    },
    ensureWelcome(model) {
      const state = getState();
      state.stateMachineChat = persistStateMachineChat(
        ensureStateMachineChatWelcome(state.stateMachineChat, model),
        projectId
      );
    }
  };
}

export function applyStateMachineChatDraft(current = {}, draft = {}, analysis = {}, { mutation = false } = {}) {
  const incoming = Array.isArray(draft.stateMachines) ? draft.stateMachines : [];
  if (!incoming.length) return { model: null, changed: false };
  if (!mutation && !incoming.some((machine) => (machine.states || []).length)) {
    return { model: null, changed: false };
  }

  const base = ensureOv6bModel(current);
  const existing = Array.isArray(base.stateMachines) ? base.stateMachines : [];

  if (!existing.length && Array.isArray(analysis?.stateMachineSubjects) && analysis.stateMachineSubjects.length) {
    return { model: applyStateMachineDraft(draft, analysis), changed: true };
  }

  const nextMachines = existing.map((machine) => {
    const match = incoming.find((item) => matchesMachine(item, machine));
    return match ? mergeMachine(machine, match) : machine;
  });
  incoming.forEach((item, index) => {
    if (nextMachines.some((machine) => matchesMachine(item, machine))) return;
    nextMachines.push(normalizeIncomingMachine(item, nextMachines.length + index));
  });

  return {
    model: ensureOv6bModel({ ...base, stateMachines: nextMachines }),
    changed: true
  };
}

function matchesMachine(incoming, existing) {
  const incomingId = String(incoming?.id || "");
  const incomingRef = String(incoming?.subjectRef || "");
  return (incomingId && incomingId === existing.id)
    || (incomingRef && incomingRef === existing.subjectRef);
}

function mergeMachine(existing, incoming) {
  const states = Array.isArray(incoming.states) && incoming.states.length
    ? incoming.states.map((item, index) => ({
      id: String(item?.id || existing.states?.[index]?.id || `${existing.id}-state-${index + 1}`).slice(0, 180),
      name: String(item?.name || existing.states?.[index]?.name || `状态 ${index + 1}`).slice(0, 120),
      kind: ["initial", "normal", "decision", "final"].includes(item?.kind) ? item.kind : (existing.states?.[index]?.kind || "normal"),
      decisionExpression: item?.kind === "decision" ? String(item?.decisionExpression || "").slice(0, 1000) : "",
      x: item?.x || existing.states?.[index]?.x,
      y: item?.y || existing.states?.[index]?.y
    }))
    : existing.states;
  const stateIds = new Set(states.map((item) => item.id));
  const transitions = Array.isArray(incoming.transitions)
    ? incoming.transitions.map((item, index) => ({
      id: String(item?.id || existing.transitions?.[index]?.id || `${existing.id}-transition-${index + 1}`).slice(0, 180),
      fromStateRef: String(item?.fromStateRef || "").slice(0, 180),
      toStateRef: String(item?.toStateRef || "").slice(0, 180),
      condition: String(item?.condition || "").slice(0, 4000),
      branchResult: String(item?.branchResult || "").slice(0, 400),
      ruleRefs: Array.isArray(item?.ruleRefs) ? item.ruleRefs.slice(0, 24) : [],
      eventRefs: []
    })).filter((item) => stateIds.has(item.fromStateRef) && stateIds.has(item.toStateRef) && item.fromStateRef !== item.toStateRef)
    : existing.transitions;
  return {
    ...existing,
    name: String(incoming.name || existing.name || "").slice(0, 240),
    subjectType: incoming.subjectType || existing.subjectType,
    subjectRef: incoming.subjectRef || existing.subjectRef,
    states,
    transitions,
    canvasLayout: existing.canvasLayout
  };
}

function normalizeIncomingMachine(incoming, index) {
  const machineId = String(incoming?.id || `state-machine-chat-${index + 1}`).slice(0, 180);
  const states = (Array.isArray(incoming?.states) ? incoming.states : []).map((item, stateIndex) => ({
    id: String(item?.id || `${machineId}-state-${stateIndex + 1}`).slice(0, 180),
    name: String(item?.name || `状态 ${stateIndex + 1}`).slice(0, 120),
    kind: ["initial", "normal", "decision", "final"].includes(item?.kind) ? item.kind : "normal",
    decisionExpression: item?.kind === "decision" ? String(item?.decisionExpression || "").slice(0, 1000) : "",
    x: item?.x,
    y: item?.y
  }));
  return {
    id: machineId,
    subjectRef: String(incoming?.subjectRef || `subject-${index + 1}`).slice(0, 160),
    subjectType: ["task", "object", "force", "phase", "other"].includes(incoming?.subjectType)
      ? incoming.subjectType
      : (/::action-\d+$/.test(String(incoming?.subjectRef || "")) ? "phase" : "task"),
    name: String(incoming?.name || `状态机 ${index + 1}`).slice(0, 240),
    states,
    transitions: (Array.isArray(incoming?.transitions) ? incoming.transitions : []).map((item, transitionIndex) => ({
      id: String(item?.id || `${machineId}-transition-${transitionIndex + 1}`).slice(0, 180),
      fromStateRef: String(item?.fromStateRef || "").slice(0, 180),
      toStateRef: String(item?.toStateRef || "").slice(0, 180),
      condition: String(item?.condition || "").slice(0, 4000),
      branchResult: String(item?.branchResult || "").slice(0, 400),
      ruleRefs: Array.isArray(item?.ruleRefs) ? item.ruleRefs.slice(0, 24) : [],
      eventRefs: []
    }))
  };
}

function createLocalStateMachineDraft(question, current, analysis) {
  if (!(current.stateMachines || []).length && analysis.stateMachineSubjects?.length) {
    return generateMockOutput({
      workflow: { id: "state-machine", title: "状态机对话修订", outputSchema: "StateMachineDraft" },
      analysis,
      evidence: []
    }).result;
  }
  if (analysis.stateMachineSubjects?.length) {
    const seeded = seedOv6bFromSubjects(current, analysis.stateMachineSubjects);
    if ((seeded.stateMachines || []).length > (current.stateMachines || []).length) {
      return {
        summary: "已为尚未建机的关键任务/对象补建本地草案。",
        stateMachines: seeded.stateMachines
      };
    }
  }
  return {
    summary: String(question || "").trim()
      ? `已保留当前状态机。可继续说明要补的判定、转换条件或终止门槛。`
      : "已保留当前状态机。",
    stateMachines: current.stateMachines || []
  };
}

function isStateMachineMutationRequest(question = "") {
  return /生成|起草|新增|添加|补充|删除|修改|改成|修订|重写|清空|状态机|判定|转换|分支|终态|识别建模/.test(String(question || ""));
}

function formatStateMachineAdvice(question, draft, { applied, machines }) {
  const summary = String(draft?.summary || "").trim();
  if (applied) {
    return [
      summary || "已根据对话更新状态机，请在画布复核状态、判定和转换条件。",
      `当前约 ${machines} 台状态机。`,
      "点节点或连线可在右侧改属性；诊断条可定位不完整转换。"
    ].filter(Boolean).join("\n");
  }
  return summary || `关于「${String(question || "").slice(0, 40)}」：建议先明确建模对象（关键任务或持续对象），再写进入、执行、终止及可观察转换条件。`;
}

function compactMachines(model = {}) {
  return (model.stateMachines || []).slice(0, 12).map((machine) => ({
    id: machine.id,
    name: machine.name,
    subjectRef: machine.subjectRef,
    subjectType: machine.subjectType,
    states: (machine.states || []).slice(0, 16).map((item) => ({
      id: item.id,
      name: item.name,
      kind: item.kind,
      decisionExpression: item.decisionExpression || ""
    })),
    transitions: (machine.transitions || []).slice(0, 24).map((item) => ({
      id: item.id,
      fromStateRef: item.fromStateRef,
      toStateRef: item.toStateRef,
      condition: item.condition,
      branchResult: item.branchResult || ""
    }))
  }));
}
