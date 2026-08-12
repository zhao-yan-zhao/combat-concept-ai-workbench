import { generateWithAiStream, isAiOutput } from "../../shared/aiClient.js";
import { normalizeDodafOv6c } from "../../shared/dodaf/products.js";
import { resolveDodafProduct, saveLocalDodafProduct } from "./dodafProductStore.js";
import {
  addOv6cMessage,
  addOv6cParticipant,
  addOv6cSequence,
  ensureOv6cModel,
  listActivityCandidates,
  listForceAndPhaseSubjects,
  seedOv6cFromPhase
} from "./ov6Workbench.js";
import {
  ensureSequenceChatWelcome,
  persistSequenceChat,
  seedSequenceChatFromModel,
  sequenceChatStepStore,
  summarizeSequenceChat
} from "./sequenceChatStore.js";
import {
  createResearchChatController,
  createResearchChatSessionApplier
} from "./researchChat/index.js";

/**
 * 时序校验对话：自然语言修订 sequences/participants/messages。
 * 有结构化草稿时写回 ov6c；仅咨询时只回写对话建议。
 */
export function createSequenceChatController({
  projectId,
  getState,
  render,
  notify,
  syncOv6c = async () => {},
  onChatPersisted = () => {}
}) {
  const applySession = createResearchChatSessionApplier({
    key: "sequenceChat",
    projectId,
    store: sequenceChatStepStore
  });

  const chat = createResearchChatController({
    scope: "sequence",
    topic: "revision",
    getState,
    render,
    notify,
    getSession: (state) => state.sequenceChat,
    setSession: applySession,
    onAfterTurn: () => {
      onChatPersisted("sequence-chat");
    },
    isGenerating: (state) => Boolean(state.sequenceChatGenerating),
    setGenerating: (state, value) => {
      state.sequenceChatGenerating = Boolean(value);
    },
    canSend: (state) => {
      if (state.sequenceChatGenerating) {
        return { ok: false, reason: "时序对话进行中，请稍候" };
      }
      return true;
    },
    async runTurn({ question, state, onDelta, signal }) {
      const current = ensureOv6cModel(resolveDodafProduct(state, "ov6c").model);
      const recentChat = summarizeSequenceChat(state.sequenceChat);
      const revisionNotes = [recentChat, `本轮要求：${question}`].filter(Boolean).join("\n");
      const mutation = isSequenceMutationRequest(question);

      try {
        let draft = null;
        let source = "ai";
        try {
          const response = await generateWithAiStream({
            workflowId: "sequence-check",
            workflow: {
              id: "sequence-check",
              title: "时序校验对话修订",
              outputSchema: "SequenceDraft"
            },
            analysis: {
              briefObjective: String(state.brief?.objective || "").slice(0, 400),
              phases: compactPhases(state.phaseAction),
              forces: compactForces(state.forceMission),
              currentSequences: compactSequences(current),
              activityCandidates: listActivityCandidates(state).slice(0, 24).map((item) => ({
                id: item.id,
                title: item.title
              })),
              reviewNotes: revisionNotes,
              revisionRequest: question,
              mutationRequest: mutation,
              "修订要求": mutation
                ? "本轮是改图请求。返回 sequences[]（participants + messages），落实增删改；消息须有 fromRef/toRef/name，尽量 relatedActivityRefs 回链阶段/活动。"
                : "根据研究人员本轮要求回答。若仅咨询，sequences 可为空并在 summary 直接回答；若涉及起草/修订时序，返回完整 sequences。"
            },
            evidence: []
          }, {
            signal,
            onDelta: (payload) => {
              const preview = String(payload?.preview || "").trim()
                || (payload?.assembled ? `正在生成时序建议… ${Math.min(100, Math.round(String(payload.assembled).length / 40))}%` : "");
              if (preview) onDelta?.({ preview, assembled: payload.assembled || "" });
            }
          });

          if (!isAiOutput(response)) throw new Error("sequence chat response incomplete");
          draft = response.result || {};
        } catch (aiError) {
          if (aiError?.name === "AbortError" || signal?.aborted) throw aiError;
          if (!mutation) throw aiError;
          draft = createLocalSequenceDraft(question, current, state);
          source = "local";
        }

        if (mutation && (!Array.isArray(draft.sequences) || !draft.sequences.length)) {
          draft = createLocalSequenceDraft(question, current, state);
          if (source === "ai") source = "local";
        }

        const outcome = applySequenceDraft(current, draft, { mutation });
        if (outcome.model) {
          state.ov6c = saveLocalDodafProduct("ov6c", outcome.model, projectId);
          try {
            await syncOv6c(state.ov6c, { source: "sequence:chat-revise" });
          } catch {
            /* local draft remains */
          }
        }

        const seqCount = outcome.model?.sequences?.length || (current.sequences || []).length;
        const msgCount = (outcome.model?.events || current.events || []).length;
        return {
          advice: formatSequenceAdvice(question, draft, {
            applied: outcome.changed,
            sequences: seqCount,
            messages: msgCount
          }),
          source,
          notifyMessage: outcome.changed
            ? `已按时序对话更新（${seqCount} 幅图 · ${msgCount} 条消息），请在画布复核`
            : "已给出时序研究建议（未改图）"
        };
      } catch (error) {
        if (error?.name === "AbortError" || signal?.aborted) throw error;
        if (mutation) {
          try {
            const localDraft = createLocalSequenceDraft(question, current, state);
            const outcome = applySequenceDraft(current, localDraft, { mutation: true });
            if (outcome.model && outcome.changed) {
              state.ov6c = saveLocalDodafProduct("ov6c", outcome.model, projectId);
              try {
                await syncOv6c(state.ov6c, { source: "sequence:chat-revise-local" });
              } catch {
                /* local */
              }
              return {
                advice: formatSequenceAdvice(question, localDraft, {
                  applied: true,
                  sequences: outcome.model.sequences.length,
                  messages: (outcome.model.events || []).length
                }),
                source: "local",
                notifyMessage: "AI 暂不可用，已写入本地时序草案，请复核"
              };
            }
          } catch {
            /* fall through */
          }
        }
        const err = error instanceof Error ? error : new Error(String(error || "ai-unavailable"));
        err.fallbackAdvice = "AI 暂不可用。可先用左侧「按阶段生成」或手动加参与方/消息，稍后再对话修订。";
        err.notifyMessage = "AI 暂不可用，时序图未改动";
        throw err;
      }
    }
  });

  return {
    bind: chat.bind,
    stop: chat.stop,
    seedFromModel(model) {
      const state = getState();
      state.sequenceChat = persistSequenceChat(seedSequenceChatFromModel(model), projectId);
      onChatPersisted("sequence-chat:seed");
    },
    ensureWelcome(model) {
      const state = getState();
      state.sequenceChat = persistSequenceChat(
        ensureSequenceChatWelcome(state.sequenceChat, model),
        projectId
      );
    }
  };
}

export function applySequenceDraft(current = {}, draft = {}, { mutation = false } = {}) {
  const base = ensureOv6cModel(current);
  const incoming = Array.isArray(draft.sequences) ? draft.sequences : [];
  if (!incoming.length) {
    return { model: null, changed: false };
  }
  if (!mutation && !incoming.some((seq) => (seq.messages || []).length || (seq.participants || []).length)) {
    return { model: null, changed: false };
  }
  const sequences = incoming.slice(0, 24).map((sequence, index) => {
    const participants = (Array.isArray(sequence.participants) ? sequence.participants : [])
      .slice(0, 40)
      .map((item, participantIndex) => ({
        id: String(item?.id || `participant-${index + 1}-${participantIndex + 1}`).slice(0, 160),
        name: String(item?.name || item?.id || `参与方 ${participantIndex + 1}`).slice(0, 240),
        ref: String(item?.ref || "").slice(0, 160)
      }));
    const participantIds = new Set(participants.map((item) => item.id));
    const messages = (Array.isArray(sequence.messages) ? sequence.messages : [])
      .slice(0, 200)
      .map((item, messageIndex) => {
        const fromRef = String(item?.fromRef || participants[0]?.id || "").slice(0, 160);
        const toRef = String(item?.toRef || participants[1]?.id || participants[0]?.id || "").slice(0, 160);
        if (fromRef) participantIds.add(fromRef);
        if (toRef) participantIds.add(toRef);
        const name = String(item?.name || item?.title || `消息 ${messageIndex + 1}`).slice(0, 240);
        const relatedActivityRefs = Array.isArray(item?.relatedActivityRefs)
          ? item.relatedActivityRefs.map((ref) => String(ref).slice(0, 160)).filter(Boolean).slice(0, 12)
          : [];
        return {
          id: String(item?.id || `event-${index + 1}-${messageIndex + 1}`).slice(0, 180),
          sequence: messageIndex + 1,
          fromRef,
          toRef,
          name,
          title: name,
          type: String(item?.type || "message").slice(0, 40),
          condition: String(item?.condition || "").slice(0, 800),
          relatedActivityRefs,
          ruleRefs: [],
          stateTransitionRefs: []
        };
      });
    // Ensure every from/to has a participant row
    const ensured = [...participants];
    for (const id of participantIds) {
      if (!ensured.some((item) => item.id === id)) {
        ensured.push({ id, name: id, ref: "" });
      }
    }
    return {
      id: String(sequence?.id || `sequence-${index + 1}`).slice(0, 180),
      name: String(sequence?.name || `事件序列 ${index + 1}`).slice(0, 240),
      participants: ensured,
      messages,
      fragments: []
    };
  });
  const model = normalizeDodafOv6c({ ...base, sequences });
  return { model, changed: true };
}

function createLocalSequenceDraft(question, current, state) {
  const seeded = seedOv6cFromPhase(current, state);
  if ((seeded.sequences || []).length && !(current.sequences || []).length) {
    return {
      summary: "已按阶段/兵力生成本地协同时序草案。",
      sequences: seeded.sequences
    };
  }
  let next = ensureOv6cModel(current);
  if (!(next.sequences || []).length) {
    next = addOv6cSequence(next, { name: "对话生成序列" });
  }
  const sequence = next.sequences[0];
  const subjects = listForceAndPhaseSubjects(state);
  if ((sequence.participants || []).length < 2 && subjects.length) {
    subjects.slice(0, 4).forEach((subject) => {
      next = addOv6cParticipant(next, sequence.id, {
        id: subject.id,
        name: subject.name,
        ref: subject.id
      });
    });
  }
  next = addOv6cMessage(next, sequence.id, {
    name: String(question || "新消息").replace(/^(请|帮我|补充|新增)/, "").trim().slice(0, 80) || "协同消息",
    relatedActivityRefs: listActivityCandidates(state).slice(0, 1).map((item) => item.id)
  });
  return {
    summary: "已本地追加一条消息草案。",
    sequences: next.sequences
  };
}

function isSequenceMutationRequest(question = "") {
  const text = String(question || "");
  return /生成|起草|新增|添加|补充|删除|修改|改成|修订|重写|清空|参与方|消息|时序|序列|生命线|回链/.test(text);
}

function formatSequenceAdvice(question, draft, { applied, sequences, messages }) {
  const summary = String(draft?.summary || "").trim();
  if (applied) {
    return [
      summary || "已根据对话更新时序图，请在左侧列表与画布复核。",
      `当前约 ${sequences} 幅图、${messages} 条消息。`,
      "无活动回链的关键消息可在右侧属性区补链，或回改阶段行动。"
    ].filter(Boolean).join("\n");
  }
  return summary || `关于「${String(question || "").slice(0, 40)}」：建议先明确参与方（兵力/阶段主体），再按时间写下关键消息并回链活动。`;
}

function compactSequences(model = {}) {
  return (model.sequences || []).slice(0, 8).map((sequence) => ({
    id: sequence.id,
    name: sequence.name,
    participants: (sequence.participants || []).slice(0, 12).map((item) => ({
      id: item.id,
      name: item.name,
      ref: item.ref
    })),
    messages: (sequence.messages || []).slice(0, 40).map((item) => ({
      id: item.id,
      sequence: item.sequence,
      fromRef: item.fromRef,
      toRef: item.toRef,
      name: item.name,
      type: item.type,
      condition: item.condition,
      relatedActivityRefs: item.relatedActivityRefs
    }))
  }));
}

function compactPhases(phaseAction = {}) {
  return (phaseAction.phases || []).slice(0, 12).map((phase) => ({
    id: phase.id,
    name: phase.name,
    objective: phase.objective,
    blueActions: (phase.blueActions || phase.primaryActions || []).slice(0, 4),
    entryConditions: (phase.entryConditions || []).slice(0, 2),
    exitConditions: (phase.exitConditions || []).slice(0, 2)
  }));
}

function compactForces(forceMission = {}) {
  return (forceMission.forces || forceMission.combatForces || []).slice(0, 12).map((force) => ({
    id: force.id,
    name: force.name || force.title
  }));
}
