import { generateWithAiStream, isAiOutput } from "../../shared/aiClient.js";
import { generateMockOutput } from "../../shared/generator.js";
import { normalizeDodafOv6a } from "../../shared/dodaf/products.js";
import { resolveDodafProduct, saveLocalDodafProduct } from "./dodafProductStore.js";
import { ensureOv6aModel } from "./ov6Workbench.js";
import {
  ensureRuleLibraryChatWelcome,
  persistRuleLibraryChat,
  ruleLibraryChatStepStore,
  seedRuleLibraryChatFromModel,
  summarizeRuleLibraryChat
} from "./ruleLibraryChatStore.js";
import {
  createResearchChatController,
  createResearchChatSessionApplier
} from "./researchChat/index.js";

/** Safety cap aligned with normalizeDodafOv6a — not a product “must stop at N” limit. */
const RULE_LIBRARY_MAX_RULES = 240;

/**
 * Step 02 规则库：对话修订复用 researchChat 通用壳。
 * 有 rules[] 时写回表单；仅咨询时只回写对话建议。
 * 简报确认进入本步时：空库则 pregenerateFromBrief。
 */
export function createRuleLibraryChatController({
  projectId,
  getState,
  render,
  notify,
  syncOv6a = async () => {},
  onBusyChange = () => {},
  onChatPersisted = () => {}
}) {
  const applySession = createResearchChatSessionApplier({
    key: "ruleLibraryChat",
    projectId,
    store: ruleLibraryChatStepStore
  });

  const chat = createResearchChatController({
    scope: "rule-library",
    topic: "revision",
    getState,
    render,
    notify,
    getSession: (state) => state.ruleLibraryChat,
    setSession: applySession,
    onAfterTurn: () => {
      onChatPersisted("rule-library-chat");
    },
    isGenerating: (state) => Boolean(state.ruleLibraryChatGenerating || state.ruleLibraryPregenerating || state.ruleLibraryChangeGenerating),
    setGenerating: (state, value) => {
      state.ruleLibraryChatGenerating = Boolean(value);
    },
    canSend: (state) => {
      if (state.ruleLibraryChatGenerating || state.ruleLibraryPregenerating || state.ruleLibraryChangeGenerating) {
        return { ok: false, reason: "规则库对话或预生成进行中，请稍候" };
      }
      return true;
    },
    async runTurn({ question, state, onDelta, onJob, resumeJobId, signal }) {
      const current = ensureOv6aModel(resolveDodafProduct(state, "ov6a").model);
      const recentChat = summarizeRuleLibraryChat(state.ruleLibraryChat);
      const revisionNotes = [recentChat, `本轮要求：${question}`].filter(Boolean).join("\n");
      const mutation = isRuleMutationRequest(question);
      const addOnly = isRuleAddRequest(question);

      try {
        let draft = null;
        let source = "ai";
        try {
          const response = await generateWithAiStream({
            workflowId: "rule-library",
            workflow: { id: "rule-library", title: "规则库对话修订", outputSchema: "RuleLibraryDraft" },
            analysis: {
              ...briefAnalysis(state.brief),
              currentRules: compactRules(current),
              reviewNotes: revisionNotes,
              revisionRequest: question,
              mutationRequest: mutation,
              addOnlyRequest: addOnly,
              "修订要求": mutation
                ? [
                  "本轮是改库请求（新增/删除/修改/起草/补充）。必须写回 rules，禁止返回空数组。",
                  addOnly
                    ? "若是新增：可只返回本轮新增的规则条目（不必重复现有规则）；客户端会与现有库合并追加。若返回完整列表亦可（须保留仍有效的旧规则）。"
                    : "若是增删改：返回落实本轮改动后的完整 rules 列表（保留仍有效规则）。",
                  "只维护 name/type/scope/description，不要活动绑定。规则须可观察、可复核；type 用：约束/前置条件/转换条件/业务规则/其他。"
                ].join("")
                : "根据研究人员本轮要求回答。若仅咨询（不改库），rules 可为空数组并在 summary 直接回答；若涉及起草/增删改，返回完整或新增 rules。"
            },
            evidence: []
          }, {
            durable: true,
            projectId,
            scope: "rule-library",
            resumeJobId,
            onJob,
            signal,
            onDelta: (payload) => {
              const preview = String(payload?.preview || "").trim()
                || (payload?.assembled ? `正在生成规则建议… ${Math.min(100, Math.round(String(payload.assembled).length / 30))}%` : "");
              if (preview) onDelta?.({ preview, assembled: payload.assembled || "" });
            }
          });

          if (!isAiOutput(response)) throw new Error("rule library chat response incomplete");
          draft = response.result || {};
        } catch (aiError) {
          if (aiError?.name === "AbortError" || signal?.aborted) throw aiError;
          if (!mutation) throw aiError;
          draft = createLocalMutationDraft(question, current, state.brief);
          source = "local";
        }

        // Mutation with empty rules: synthesize local additions instead of advice-only.
        if (mutation && (!Array.isArray(draft.rules) || !draft.rules.length)) {
          draft = createLocalMutationDraft(question, current, state.brief);
          if (source === "ai") source = "local";
        }

        const outcome = applyChatDraftToLibrary(current, draft, { mutation, addOnly });
        if (outcome.model) {
          state.ov6a = saveLocalDodafProduct("ov6a", outcome.model, projectId);
          try {
            await syncOv6a(state.ov6a, { source: "rule-library:chat-revise" });
          } catch {
            /* local draft remains */
          }
        }

        const added = outcome.added || 0;
        const total = outcome.model?.rules?.length || (current.rules || []).length;
        return {
          advice: formatRevisionAdvice(question, draft, {
            applied: outcome.changed,
            added,
            total,
            mode: outcome.mode
          }),
          source,
          notifyMessage: outcome.changed
            ? (added > 0
              ? `已按对话新增 ${added} 条规则（库内共 ${total} 条），请在表单中复核`
              : `已按对话更新规则库（${total} 条），请在表单中复核`)
            : "已给出规则库研究建议（未改表单）"
        };
      } catch (error) {
        if (error?.name === "AbortError" || signal?.aborted) throw error;
        const err = error instanceof Error ? error : new Error(String(error || "ai-unavailable"));
        if (mutation) {
          try {
            const localDraft = createLocalMutationDraft(question, current, state.brief);
            const outcome = applyChatDraftToLibrary(current, localDraft, { mutation: true, addOnly: true });
            if (outcome.model && outcome.changed) {
              state.ov6a = saveLocalDodafProduct("ov6a", outcome.model, projectId);
              try {
                await syncOv6a(state.ov6a, { source: "rule-library:chat-revise-local" });
              } catch {
                /* local draft remains */
              }
              return {
                advice: formatRevisionAdvice(question, localDraft, {
                  applied: true,
                  added: outcome.added,
                  total: outcome.model.rules.length,
                  mode: "merge"
                }),
                source: "local",
                notifyMessage: `AI 暂不可用，已本地新增 ${outcome.added} 条规则草案，请复核`
              };
            }
          } catch {
            /* fall through */
          }
        }
        err.fallbackAdvice = createFallbackAdvice(question, current);
        err.notifyMessage = "AI 暂不可用，已记录本地修订建议；规则表单未改动";
        throw err;
      }
    }
  });

  /**
   * Entering 规则库 from brief gate / step rail:
   * - empty library → AI draft from brief (once)
   * - already has rules → enter directly, do not regenerate
   */
  async function pregenerateFromBrief({ silent = false } = {}) {
    const state = getState();
    if (state.ruleLibraryPregenerating) {
      return { skipped: true, reason: "busy" };
    }
    // Prefer the actual project model; avoid resolveDodafProduct seed-from-ov5 which can look “non-empty”.
    const current = ensureOv6aModel(state.ov6a && Array.isArray(state.ov6a.rules) ? state.ov6a : { rules: [] });
    const existingCount = Array.isArray(current.rules) ? current.rules.length : 0;
    // Direct re-entry to step 2: keep existing library, no AI.
    if (existingCount > 0) {
      return { skipped: true, reason: "has-rules", count: existingCount };
    }

    state.ruleLibraryPregenerating = true;
    onBusyChange();
    render();
    // Force overlay paint before the network call (render alone can miss a frame).
    if (typeof document !== "undefined") {
      const overlay = document.querySelector("#workflowModeOverlay");
      const title = document.querySelector("#workflowModeOverlayTitle");
      const detail = document.querySelector("#workflowModeOverlayDetail");
      if (overlay) {
        if (title) title.textContent = "正在进入阶段行动";
        if (detail) detail.textContent = "根据简报生成作战规则…";
        overlay.hidden = false;
        overlay.classList.add("is-visible");
      }
      document.querySelector("#studioShell")?.classList.add("is-mode-switching");
    }
    const startedAt = Date.now();
    await new Promise((resolve) => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      } else {
        setTimeout(resolve, 32);
      }
    });

    try {
      const analysis = {
        ...briefAnalysis(state.brief),
        currentRules: compactRules(current),
        pregenerateFromBrief: true,
        revisionRequest: "首次按简报起草完整规则库",
        "修订要求": "这是简报确认后进入规则库的首次预生成。根据简报六项起草全局基线规则本体（name/type/scope/description），不要输出活动绑定。所有 scope 必须为“全局”，不得引用尚未生成的阶段、行动、兵力或协同关系。按课题需要覆盖约束、前置条件、转换条件、业务规则等；条数不设固定上下限，禁止凑数重复与空泛套话；每条须可观察、可复核，并回扣任务目标、关键假设、预期效果与主要风险。"
      };

      let draft = null;
      let source = "ai";
      try {
        const response = await generateWithAiStream({
          workflowId: "rule-library",
          workflow: { id: "rule-library", title: "规则库简报预生成", outputSchema: "RuleLibraryDraft" },
          analysis,
          evidence: []
        });
        if (!isAiOutput(response) || !Array.isArray(response.result?.rules) || !response.result.rules.length) {
          throw new Error("rule library pregenerate empty");
        }
        draft = response.result;
      } catch {
        const local = generateMockOutput({
          workflow: { id: "rule-library", title: "规则库简报预生成", outputSchema: "RuleLibraryDraft" },
          analysis,
          evidence: []
        });
        draft = local?.result || { summary: "", rules: [] };
        source = "local-fallback";
      }

      const next = applyRuleLibraryDraft(current, draft);
      if (!next.rules?.length) {
        throw new Error("rule library pregenerate produced no rules");
      }
      state.ov6a = saveLocalDodafProduct("ov6a", next, projectId);
      state.ruleLibraryChat = persistRuleLibraryChat(seedRuleLibraryChatFromModel(next), projectId);
      onChatPersisted("rule-library-chat:pregenerate");
      try {
        await syncOv6a(state.ov6a, { source: "rule-library:pregenerate-brief" });
      } catch {
        /* local draft remains */
      }

      // Keep transition overlay visible long enough to read.
      const elapsed = Date.now() - startedAt;
      if (elapsed < 600) {
        const delay = typeof globalThis.setTimeout === "function" ? globalThis.setTimeout.bind(globalThis) : setTimeout;
        await new Promise((resolve) => delay(resolve, 600 - elapsed));
      }

      if (!silent) {
        notify(
          source === "ai"
            ? `已根据简报预生成作战规则（${next.rules.length} 条），请复核`
            : `AI 暂不可用，已写入本地规则草案（${next.rules.length} 条）`
        );
      }
      return { applied: next.rules.length, source, skipped: false };
    } catch (error) {
      if (!silent) {
        notify("规则预生成失败，可稍后在规则库中手动新增或对话起草");
      }
      return { skipped: true, reason: "error", error: error instanceof Error ? error.message : String(error || "") };
    } finally {
      state.ruleLibraryPregenerating = false;
      onBusyChange();
      render();
    }
  }

  async function proposeChanges(source, { silent = false, force = false } = {}) {
    const state = getState();
    if (state.ruleLibraryChangeGenerating) return { skipped: true, reason: "busy" };
    const current = ensureOv6aModel(state.ov6a && Array.isArray(state.ov6a.rules) ? state.ov6a : { rules: [] });
    const analysis = buildRuleChangeAnalysis(state, current, source);
    const existingProposal = current.ruleChangeSet;
    if (!force && existingProposal?.source === source
      && existingProposal?.upstreamFingerprint === analysis.upstreamFingerprint
      && Array.isArray(existingProposal.changes)
      && existingProposal.changes.length) {
      if (!silent) {
        const subject = source === "operational-task" ? "任务" : source === "phase-action" ? "阶段" : "任务与兵力";
        notify(`已存在 ${existingProposal.changes.length} 项${subject}规则待审核建议，可直接复核或重新生成覆盖`);
      }
      return { skipped: true, reason: "already-generated", proposed: existingProposal.changes.length };
    }
    state.ruleLibraryChangeGenerating = true;
    onBusyChange();
    render();
    if (typeof document !== "undefined") {
      const overlay = document.querySelector("#workflowModeOverlay");
      const title = document.querySelector("#workflowModeOverlayTitle");
      const detail = document.querySelector("#workflowModeOverlayDetail");
      if (overlay) {
        if (title) title.textContent = "正在分析规则变更";
        if (detail) detail.textContent = source === "phase-action" ? "根据阶段与行动生成待审核建议" : source === "operational-task" ? "根据作战任务生成逐任务待审核规则" : "根据兵力与任务生成待审核建议";
        overlay.hidden = false;
        overlay.classList.add("is-visible");
      }
      document.querySelector("#studioShell")?.classList.add("is-mode-switching");
    }
    await new Promise((resolve) => {
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => requestAnimationFrame(resolve));
      else setTimeout(resolve, 32);
    });
    try {
      let changeSet;
      let generatedBy = "ai";
      try {
        const response = await generateWithAiStream({
          workflowId: "rule-library-change-set",
          workflow: { id: "rule-library-change-set", title: "规则库变更建议", outputSchema: "RuleLibraryChangeSet" },
          analysis,
          evidence: []
        });
        if (!isAiOutput(response) || !Array.isArray(response.result?.changes)) throw new Error("rule change set empty");
        if (source === "phase-action") {
          changeSet = ensurePhaseRuleCoverage(response.result, analysis);
        } else if (source === "operational-task") {
          changeSet = ensureTaskRuleCoverage(response.result, analysis);
        } else if (source === "force-mission") {
          changeSet = ensureTaskAndForceRuleCoverage(response.result, analysis);
        } else {
          changeSet = response.result;
        }
      } catch {
        changeSet = generateMockOutput({
          workflow: { id: "rule-library-change-set", title: "规则库变更建议", outputSchema: "RuleLibraryChangeSet" },
          analysis,
          evidence: []
        }).result;
        if (source === "phase-action") changeSet = ensurePhaseRuleCoverage(changeSet, analysis);
        else if (source === "operational-task") changeSet = ensureTaskRuleCoverage(changeSet, analysis);
        else if (source === "force-mission") changeSet = ensureTaskAndForceRuleCoverage(changeSet, analysis);
        generatedBy = "local-fallback";
      }
      const next = ensureOv6aModel({
        ...current,
        ruleChangeSet: normalizeRuleChangeSet(changeSet, source, analysis.upstreamFingerprint)
      });
      state.ov6a = saveLocalDodafProduct("ov6a", next, projectId);
      await syncOv6a(state.ov6a, { source: `rule-library:proposal-${source}` });
      const proposed = next.ruleChangeSet?.changes?.length || 0;
      if (!silent) {
        const subject = source === "operational-task" ? "任务" : source === "phase-action" ? "阶段" : "任务与兵力";
        notify(proposed
          ? (generatedBy === "ai" ? `已生成 ${proposed} 项${subject}规则建议，请到规则库审核` : `AI 暂不可用，已生成 ${proposed} 项本地${subject}规则建议，请审核`)
          : `已完成${subject}规则分析，本轮无需补充规则`);
      }
      return { proposed, source: generatedBy };
    } catch (error) {
      if (!silent) notify("规则变更建议生成失败，可稍后重试");
      return { skipped: true, reason: "error", error: error instanceof Error ? error.message : String(error || "") };
    } finally {
      state.ruleLibraryChangeGenerating = false;
      onBusyChange();
      render();
    }
  }

  return {
    bind: chat.bind,
    stop: chat.stop,
    pregenerateFromBrief,
    proposeChanges,
    seedFromModel(model) {
      const state = getState();
      state.ruleLibraryChat = persistRuleLibraryChat(seedRuleLibraryChatFromModel(model), projectId);
      onChatPersisted("rule-library-chat:seed");
    },
    ensureWelcome(model) {
      const state = getState();
      state.ruleLibraryChat = persistRuleLibraryChat(
        ensureRuleLibraryChatWelcome(state.ruleLibraryChat, model),
        projectId
      );
    }
  };
}

export function applyRuleChangeSet(current = {}, changeSet = {}, changeId = "") {
  const base = ensureOv6aModel(current);
  const pending = base.ruleChangeSet?.changes || [];
  const selected = pending.filter((change) => change.status === "pending" && (!changeId || change.id === changeId));
  if (!selected.length) return base;
  let rules = [...(base.rules || [])];
  selected.forEach((change) => {
    const phaseBindings = (change.rule?.phaseRefs || []).map((phaseRef) => ({ phaseRef }));
    const taskBindings = (change.rule?.taskRefs || []).map((taskRef) => ({ taskRef, bindingStatus: "pending", constraintNote: "" }));
    const forceBindings = (change.rule?.forceRefs || []).map((forceRef) => ({ forceRef, bindingStatus: "pending", constraintNote: "" }));
    if (change.action === "add") {
      const id = uniqueRuleId(rules, change.rule.id);
      rules.push({ ...change.rule, id, phaseBindings, taskBindings, forceBindings, activityBindings: [] });
    } else if (change.action === "revise") {
      const index = rules.findIndex((rule) => rule.id === change.ruleId);
      if (index >= 0) rules[index] = { ...rules[index], ...change.rule, id: rules[index].id, phaseBindings, taskBindings, forceBindings, activityBindings: rules[index].activityBindings || [] };
    } else if (change.action === "retire") {
      rules = rules.filter((rule) => rule.id !== change.ruleId);
    }
  });
  const changes = pending.map((change) => selected.some((item) => item.id === change.id) ? { ...change, status: "applied" } : change);
  return ensureOv6aModel({ ...base, rules, ruleChangeSet: { ...base.ruleChangeSet, changes } });
}

export function ignoreRuleChangeSet(current = {}, changeId = "") {
  const base = ensureOv6aModel(current);
  const changes = (base.ruleChangeSet?.changes || []).map((change) => (
    change.status === "pending" && (!changeId || change.id === changeId) ? { ...change, status: "ignored" } : change
  ));
  return ensureOv6aModel({ ...base, ruleChangeSet: { ...base.ruleChangeSet, changes } });
}

function uniqueRuleId(rules, requested) {
  const base = String(requested || "rule-proposal").trim() || "rule-proposal";
  const ids = new Set(rules.map((rule) => rule.id));
  if (!ids.has(base)) return base;
  let index = 2;
  while (ids.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function normalizeRuleChangeSet(draft = {}, source, fingerprint) {
  return {
    source,
    generatedAt: new Date().toISOString(),
    upstreamFingerprint: fingerprint,
    summary: String(draft.summary || "待审核的规则变更建议").slice(0, 800),
    changes: (draft.changes || []).slice(0, 48).map((change, index) => ({
      id: String(change?.id || `rule-change-${Date.now().toString(36)}-${index + 1}`),
      action: ["add", "revise", "retire"].includes(change?.action) ? change.action : "add",
      ruleId: String(change?.ruleId || ""),
      rule: {
        ...(change?.rule || {}),
        phaseRefs: source === "phase-action" ? (change?.rule?.phaseRefs || []).map(String).filter(Boolean).slice(0, 24) : [],
        taskRefs: (source === "operational-task" || source === "force-mission") ? (change?.rule?.taskRefs || []).map(String).filter(Boolean).slice(0, 48) : [],
        forceRefs: source === "force-mission" ? (change?.rule?.forceRefs || []).map(String).filter(Boolean).slice(0, 48) : []
      },
      rationale: String(change?.rationale || "").slice(0, 800),
      status: "pending"
    }))
  };
}

function buildRuleChangeAnalysis(state, current, source) {
  const phaseAction = (state.phaseAction?.phases || []).slice(0, 24).map((phase, index) => ({
    id: String(phase?.id || `phase-${index + 1}`), name: String(phase?.name || ""), objective: String(phase?.objective || ""),
    primaryActions: (phase?.primaryActions || phase?.blueActions || []).filter(Boolean).slice(0, 8),
    entryConditions: (phase?.entryConditions || []).filter(Boolean).slice(0, 6), exitConditions: (phase?.exitConditions || []).filter(Boolean).slice(0, 6), expectedEffects: (phase?.expectedEffects || []).filter(Boolean).slice(0, 6)
  }));
  const forces = (state.forceMission?.forces || []).slice(0, 36).map((force, index) => ({
    id: String(force?.id || `force-${index + 1}`), name: String(force?.name || ""), role: String(force?.role || ""), task: String(force?.task || ""), phaseIds: (force?.phaseIds || []).slice(0, 12)
  }));
  const combatForces = (state.forceMission?.combatForces || []).slice(0, 36).map((force, index) => ({
    id: String(force?.id || `combat-force-${index + 1}`),
    name: String(force?.name || ""),
    side: String(force?.side || "blue"),
    role: String(force?.role || ""),
    task: String(force?.task || force?.mission || ""),
    phaseIds: (force?.phaseIds || []).slice(0, 12),
    platforms: (force?.platforms || []).slice(0, 8)
  }));
  const relations = (state.forceMission?.relations || []).slice(0, 48).map((item) => ({ fromForceId: String(item?.fromForceId || ""), toForceId: String(item?.toForceId || ""), type: String(item?.type || ""), note: String(item?.note || "") }));
  const tasks = (state.forceMission?.tasks || []).slice(0, 80).map((task) => ({ id: String(task?.id || ""), name: String(task?.name || ""), side: task?.side === "hostile" ? "hostile" : "friendly", missionType: String(task?.missionType || ""), objective: String(task?.objective || ""), expectedEffect: String(task?.expectedEffect || "") }));
  const phaseTransitions = (state.phaseAction?.transitions || []).slice(0, 32).map((item) => ({
    fromPhaseId: String(item?.fromPhaseId || ""),
    toPhaseId: String(item?.toPhaseId || ""),
    condition: String(item?.condition || ""),
    note: String(item?.note || "")
  }));
  const upstream = source === "phase-action"
    ? { phaseAction, phaseTransitions }
    : source === "operational-task"
      ? { tasks }
      : { phaseAction, phaseTransitions, tasks, forces, combatForces, relations };
  return {
    source,
    currentRules: compactRules(current),
    ...upstream,
    upstreamFingerprint: JSON.stringify(upstream).slice(0, 240),
    revisionRequest: source === "phase-action"
      ? "根据已确认阶段与行动提出规则变更建议"
      : source === "operational-task"
        ? "仅根据已确认作战任务提出逐任务规则建议，每条使用 taskRefs 绑定任务 ID"
        : "根据已确认作战任务、作战兵力与协同关系联合提出规则变更建议，任务相关规则使用 taskRefs 绑定任务 ID，兵力相关规则使用 forceRefs 绑定兵力 ID"
  };
}

export function ensurePhaseRuleCoverage(draft = {}, analysis = {}) {
  const phases = Array.isArray(analysis.phaseAction) ? analysis.phaseAction : [];
  const phaseIds = new Set(phases.map((phase) => String(phase?.id || "")).filter(Boolean));
  const incoming = (Array.isArray(draft.changes) ? draft.changes : []).map((change) => {
    const explicit = (change?.rule?.phaseRefs || []).map(String).filter((ref) => phaseIds.has(ref));
    const scope = String(change?.rule?.scope || "");
    const inferred = phases.map((phase) => String(phase?.id || "")).filter((phaseId) => phaseId && (scope.includes(`（${phaseId}）`) || scope.includes(`(${phaseId})`)));
    return { ...change, rule: { ...(change?.rule || {}), phaseRefs: [...new Set([...explicit, ...inferred])] } };
  });
  const covered = (phaseId, kind) => incoming.some((change) => {
    const scope = String(change?.rule?.scope || "");
    if (!scope.includes(`（${phaseId}）`) && !scope.includes(`(${phaseId})`)) return false;
    return kind === "entry"
      ? change?.rule?.type === "前置条件"
      : change?.rule?.type === "转换条件";
  });
  phases.forEach((phase, index) => {
    const phaseId = String(phase?.id || `phase-${index + 1}`);
    const phaseName = String(phase?.name || `阶段 ${index + 1}`);
    const scope = `阶段：${phaseName}（${phaseId}）`;
    const entry = (phase?.entryConditions || []).filter(Boolean).join("；");
    const actions = (phase?.primaryActions || []).filter(Boolean).join("；");
    const exit = (phase?.exitConditions || []).filter(Boolean).join("；");
    const effects = (phase?.expectedEffects || []).filter(Boolean).join("；");
    if (entry && !covered(phaseId, "entry")) {
      incoming.push({ id: `phase-entry-${phaseId}`, action: "add", ruleId: "", rule: {
        id: `rule-phase-entry-${phaseId}`, name: `${phaseName}进入条件`, type: "前置条件", scope,
        description: `仅当“${entry}”已被观察并确认时，方可进入${phaseName}；未满足时保持当前阶段并记录待决条件。`, phaseRefs: [phaseId]
      }, rationale: `依据阶段 ${phaseId} 的 entryConditions。` });
    }
    if ((exit || effects) && !covered(phaseId, "exit")) {
      incoming.push({ id: `phase-exit-${phaseId}`, action: "add", ruleId: "", rule: {
        id: `rule-phase-exit-${phaseId}`, name: `${phaseName}退出判据`, type: "转换条件", scope,
        description: `完成“${actions || phase?.objective || "本阶段主要行动"}”后，应确认“${exit || effects}”${exit && effects ? `并复核预期效果“${effects}”` : ""}，满足后方可退出或转入后续阶段。`, phaseRefs: [phaseId]
      }, rationale: `依据阶段 ${phaseId} 的 primaryActions、exitConditions 和 expectedEffects。` });
    }
  });
  return { ...draft, summary: String(draft.summary || "已按阶段分别形成进入与退出规则建议。"), changes: incoming.slice(0, 48) };
}

export function ensureTaskRuleCoverage(draft = {}, analysis = {}) {
  const tasks = Array.isArray(analysis.tasks) ? analysis.tasks : [];
  const taskIds = new Set(tasks.map((task) => String(task?.id || "")).filter(Boolean));
  const incoming = (Array.isArray(draft.changes) ? draft.changes : []).map((change) => {
    const explicit = (change?.rule?.taskRefs || []).map(String).filter((ref) => taskIds.has(ref));
    const scope = String(change?.rule?.scope || "");
    const inferred = tasks.map((t) => String(t?.id || "")).filter((id) => id && (scope.includes(`（${id}）`) || scope.includes(`(${id})`)));
    return { ...change, rule: { ...(change?.rule || {}), taskRefs: [...new Set([...explicit, ...inferred])] } };
  });

  const coveredTaskIds = new Set(incoming.flatMap((c) => c.rule?.taskRefs || []));
  tasks.forEach((task, index) => {
    const taskId = String(task?.id || `task-${index + 1}`);
    const taskName = String(task?.name || `作战任务 ${index + 1}`);
    if (!coveredTaskIds.has(taskId)) {
      incoming.push({
        id: `task-rule-${taskId}`,
        action: "add",
        ruleId: "",
        rule: {
          id: `rule-task-${taskId}`,
          name: `${taskName}执行与准入约束`,
          type: "前置条件",
          scope: `任务：${taskName}（${taskId}）`,
          description: `执行任务“${taskName}”时，须确认${task.objective ? `任务目标“${task.objective}”明确，` : ""}预置通信与数据链路由通畅，并满足准入准出与交战规则约束。`,
          taskRefs: [taskId]
        },
        rationale: `依据作战任务 ${taskId} 的目标与约束自动建立任务规则基线。`
      });
    }
  });
  return { ...draft, summary: String(draft.summary || "已按作战任务分别形成任务执行与约束规则建议。"), changes: incoming.slice(0, 48) };
}

export function ensureForceRuleCoverage(draft = {}, analysis = {}) {
  const forceList = [
    ...(Array.isArray(analysis.combatForces) ? analysis.combatForces : []),
    ...(Array.isArray(analysis.forces) ? analysis.forces : [])
  ];
  const forceMap = new Map();
  forceList.forEach((f, idx) => {
    const id = String(f?.id || `force-${idx + 1}`);
    if (!forceMap.has(id)) forceMap.set(id, f);
  });
  const forceIds = new Set(forceMap.keys());
  const incoming = (Array.isArray(draft.changes) ? draft.changes : []).map((change) => {
    const explicit = (change?.rule?.forceRefs || []).map(String).filter((ref) => forceIds.has(ref));
    const scope = String(change?.rule?.scope || "");
    const inferred = Array.from(forceIds).filter((id) => id && (scope.includes(`（${id}）`) || scope.includes(`(${id})`)));
    return { ...change, rule: { ...(change?.rule || {}), forceRefs: [...new Set([...explicit, ...inferred])] } };
  });

  const coveredForceIds = new Set(incoming.flatMap((c) => c.rule?.forceRefs || []));
  forceMap.forEach((force, forceId) => {
    const forceName = String(force?.name || `兵力 ${forceId}`);
    if (!coveredForceIds.has(forceId)) {
      incoming.push({
        id: `force-rule-${forceId}`,
        action: "add",
        ruleId: "",
        rule: {
          id: `rule-force-${forceId}`,
          name: `${forceName}协同行动与指控约束`,
          type: "业务规则",
          scope: `兵力：${forceName}（${forceId}）`,
          description: `${forceName}在执行${force.task ? `“${force.task}”` : "作战任务"}期间，须保持指定指控链条与EMCON辐射控制等级，并严格执行协同走廊与交接班准则。`,
          forceRefs: [forceId]
        },
        rationale: `依据作战兵力 ${forceId} 的指控与协同要求自动建立兵力规则基线。`
      });
    }
  });
  return { ...draft, summary: String(draft.summary || "已按作战兵力分别形成指控与协同规则建议。"), changes: incoming.slice(0, 48) };
}

export function ensureTaskAndForceRuleCoverage(draft = {}, analysis = {}) {
  const taskCovered = ensureTaskRuleCoverage(draft, analysis);
  const combinedCovered = ensureForceRuleCoverage(taskCovered, analysis);
  return {
    ...combinedCovered,
    summary: String(draft.summary || "已按作战任务与作战兵力联合形成规则建议。"),
    changes: combinedCovered.changes.slice(0, 64)
  };
}

export function applyRuleLibraryDraft(current = {}, draft = {}) {
  const base = ensureOv6aModel(current);
  const previousById = new Map((base.rules || []).map((rule) => [rule.id, rule]));
  const incoming = Array.isArray(draft.rules) ? draft.rules : [];
  const rules = incoming.slice(0, RULE_LIBRARY_MAX_RULES).map((rule, index) => {
    const id = String(rule?.id || "").trim() || `rule-ai-${index + 1}`;
    const prev = previousById.get(id);
    return {
      id,
      name: rule?.name || rule?.subject || `规则 ${index + 1}`,
      type: rule?.type || "约束",
      scope: rule?.scope || "研究级",
      description: rule?.description || rule?.text || "待补充",
      // 本步不维护绑定；若同 id 规则仍在，保留既有绑定以免误丢
      activityBindings: Array.isArray(prev?.activityBindings) ? prev.activityBindings : []
    };
  });
  return normalizeDodafOv6a({ ...base, rules });
}

/**
 * Keep every existing rule intact; append only draft rules that are not duplicates
 * (same id, same normalized name, or highly similar name+description fingerprint).
 */
export function mergeRuleLibraryDraft(current = {}, draft = {}) {
  const base = ensureOv6aModel(current);
  const existing = Array.isArray(base.rules) ? base.rules : [];
  const incoming = Array.isArray(draft.rules) ? draft.rules : [];
  const usedIds = new Set(existing.map((rule) => String(rule.id || "")));
  const nameKeys = new Set(existing.map((rule) => ruleNameKey(rule)));
  const fingerprints = new Set(existing.map((rule) => ruleFingerprint(rule)));

  const additions = [];
  let skipped = 0;
  incoming.forEach((rule, index) => {
    const name = String(rule?.name || rule?.subject || "").trim() || `规则 ${existing.length + additions.length + 1}`;
    const description = String(rule?.description || rule?.text || "").trim() || "待补充";
    const type = rule?.type || "约束";
    const scope = rule?.scope || "研究级";
    const candidate = { id: String(rule?.id || "").trim(), name, type, scope, description };
    const nameKey = ruleNameKey(candidate);
    const fingerprint = ruleFingerprint(candidate);
    if ((candidate.id && usedIds.has(candidate.id)) || nameKeys.has(nameKey) || fingerprints.has(fingerprint)) {
      skipped += 1;
      return;
    }
    let id = candidate.id || `rule-ai-merge-${Date.now().toString(36)}-${index + 1}`;
    if (usedIds.has(id)) id = `rule-ai-merge-${Date.now().toString(36)}-${index + 1}-${additions.length + 1}`;
    usedIds.add(id);
    nameKeys.add(nameKey);
    fingerprints.add(fingerprint);
    additions.push({
      id,
      name,
      type,
      scope,
      description,
      activityBindings: []
    });
  });

  const room = Math.max(0, RULE_LIBRARY_MAX_RULES - existing.length);
  const clipped = additions.slice(0, room);
  const model = normalizeDodafOv6a({ ...base, rules: [...existing, ...clipped] });
  return {
    model,
    added: clipped.length,
    kept: existing.length,
    skipped: skipped + Math.max(0, additions.length - clipped.length)
  };
}

function ruleNameKey(rule = {}) {
  return String(rule.name || rule.subject || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。；、,.!！?？:：\-—_]/g, "");
}

function ruleFingerprint(rule = {}) {
  const name = ruleNameKey(rule);
  const body = String(rule.description || rule.text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。；、,.!！?？:：\-—_]/g, "")
    .slice(0, 48);
  return `${name}|${body}`;
}

/**
 * Apply AI/local draft to the rule library.
 * - add-only / partial list → merge append (never wipe existing)
 * - full replace list → applyRuleLibraryDraft
 * - consult / empty → no form change
 */
export function applyChatDraftToLibrary(current = {}, draft = {}, { mutation = false, addOnly = false } = {}) {
  const base = ensureOv6aModel(current);
  const existing = Array.isArray(base.rules) ? base.rules : [];
  const incoming = Array.isArray(draft.rules) ? draft.rules : [];
  if (!incoming.length) {
    return { model: null, changed: false, added: 0, mode: "none" };
  }

  const existingIds = new Set(existing.map((rule) => String(rule.id || "")));
  const overlap = incoming.filter((rule) => existingIds.has(String(rule?.id || "").trim())).length;
  const looksPartial = existing.length > 0 && (
    addOnly
    || incoming.length < existing.length
    || (overlap === 0 && incoming.length <= Math.max(8, Math.ceil(existing.length / 2)))
  );

  if (looksPartial || (mutation && addOnly)) {
    const merged = mergeRuleLibraryDraft(base, draft);
    return {
      model: merged.model,
      changed: merged.added > 0,
      added: merged.added,
      mode: "merge"
    };
  }

  const next = applyRuleLibraryDraft(base, draft);
  const beforeIds = new Set(existing.map((rule) => rule.id));
  const added = (next.rules || []).filter((rule) => !beforeIds.has(rule.id)).length;
  const changed = JSON.stringify(compactRules(base)) !== JSON.stringify(compactRules(next));
  return {
    model: next,
    changed,
    added,
    mode: "replace"
  };
}

export function isRuleMutationRequest(question = "") {
  const text = String(question || "");
  return /增|加|起草|补充|添加|新建|写入|生成|删|改|拆|合并|更新|修订|替换|重写|完善/.test(text);
}

export function isRuleAddRequest(question = "") {
  const text = String(question || "");
  // Process/pregenerate phrases are not chat “add N rules”.
  if (/首次按简报|完整规则库|预生成|简报确认后进入规则库/.test(text)) return false;
  if (/删|替换|重写|清空/.test(text) && !/增|加|补充|添加|新建/.test(text)) return false;
  return /新增|添加|补充|新建|写入|条规则|生成\s*\d*\s*条/.test(text)
    || (/起草/.test(text) && /条|规则/.test(text) && /增|加|补充|添加/.test(text));
}

/** Parse “新增三条…” style requests into local draft rules (additions only). */
export function createLocalMutationDraft(question = "", current = {}, brief = {}) {
  const text = String(question || "").replace(/\s+/g, " ").trim();
  const count = parseRequestedRuleCount(text);
  const theme = extractRuleTheme(text) || "作战任务";
  const objective = String(brief.objective || brief.researchIntent || "作战概念研究")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  const risk = String(brief.risk || "对手反制").replace(/\s+/g, " ").trim().slice(0, 32);
  const effects = String(brief.expectedEffects || "形成有利态势").replace(/\s+/g, " ").trim().slice(0, 32);
  const types = ["约束", "前置条件", "转换条件", "业务规则", "其他"];
  const templates = [
    {
      name: `${theme}目标对齐`,
      type: "业务规则",
      scope: theme,
      description: `${theme}行动须回扣目标“${objective}”，并具备可观察完成判据，避免无目标堆叠行动。`
    },
    {
      name: `${theme}进入门槛`,
      type: "前置条件",
      scope: theme,
      description: `进入${theme}关键行动前，须具备授权、态势覆盖与资源就绪等门槛；未满足不得转入执行。`
    },
    {
      name: `${theme}时窗受控`,
      type: "转换条件",
      scope: theme,
      description: `${theme}阶段转换须依据可观察条件与时窗，禁止无依据等长切分或跳过复核。`
    },
    {
      name: `${theme}风险阈值`,
      type: "约束",
      scope: theme,
      description: `${theme}触及风险“${risk}”阈值时须降级、切换路径或请求授权，不得无记录硬推。`
    },
    {
      name: `${theme}效果复核`,
      type: "业务规则",
      scope: theme,
      description: `${theme}退出前复核是否朝向“${effects}”，并回写研究判断。`
    }
  ];

  const rules = [];
  for (let i = 0; i < count; i += 1) {
    const template = templates[i % templates.length];
    const suffix = i >= templates.length ? ` ${Math.floor(i / templates.length) + 1}` : "";
    rules.push({
      id: `rule-chat-${Date.now().toString(36)}-${i + 1}`,
      name: `${template.name}${suffix}`.slice(0, 24),
      type: types.includes(template.type) ? template.type : "约束",
      scope: String(template.scope || theme).slice(0, 24),
      description: template.description
    });
  }

  return {
    summary: `已按“${text.slice(0, 48) || theme}”新增 ${rules.length} 条规则草案，请在左侧表单复核名称与描述。`,
    rules
  };
}

function parseRequestedRuleCount(text = "") {
  const digit = String(text).match(/(\d+)\s*条/);
  if (digit) return Math.max(1, Math.min(24, Number(digit[1]) || 3));
  const cnMap = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const cn = String(text).match(/([一二两三四五六七八九十])\s*条/);
  if (cn && cnMap[cn[1]]) return cnMap[cn[1]];
  if (/若干|几条|一批/.test(text)) return 3;
  return 3;
}

function extractRuleTheme(text = "") {
  const cleaned = String(text)
    .replace(/首次|按简报|完整|规则库|预生成|本轮|要求|修订/g, " ")
    .replace(/新增|添加|补充|起草|生成|写入|规则|主要|针对|关于|条|候选|草案/g, " ")
    .replace(/\d+/g, " ")
    .replace(/[一二两三四五六七八九十]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length < 2 || /简报|完整|库规则|预生成/.test(cleaned)) return "";
  return cleaned.slice(0, 12);
}

function formatRevisionAdvice(question, draft = {}, meta = {}) {
  const applied = typeof meta === "number" ? meta > 0 : Boolean(meta?.applied);
  const added = Number(meta?.added || 0);
  const total = Number(meta?.total || 0);
  const summary = String(draft.summary || draft.coreIdea || "").trim();
  if (summary && (applied || added > 0)) return summary.slice(0, 360);
  const subject = String(question || "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (added > 0) {
    return `已根据“${subject || "你的要求"}”新增 ${added} 条规则（库内共 ${total || added} 条）。请在左侧表单核对名称、类型、范围与描述。`.slice(0, 360);
  }
  if (applied) {
    return `已根据“${subject || "你的要求"}”更新规则库（${total || "若干"} 条）。请在左侧表单核对名称、类型、范围与描述。`.slice(0, 360);
  }
  if (summary) return summary.slice(0, 360);
  return `已围绕“${subject || "你的问题"}”给出规则库研究建议。如需改表单，请明确：新增/删除哪条、改名称还是描述。`.slice(0, 360);
}

function createFallbackAdvice(question, model = {}) {
  const subject = String(question || "").replace(/\s+/g, " ").trim().slice(0, 90) || "该要求";
  const count = Array.isArray(model.rules) ? model.rules.length : 0;
  if (isRuleMutationRequest(subject)) {
    return `围绕“${subject}”，本应直接改规则库表单。当前库内 ${count} 条；请重试发送，或手动点「＋ 新增规则」。`;
  }
  return `围绕“${subject}”，建议先明确：改哪条规则、改类型/范围还是描述。当前库内 ${count} 条；AI 恢复后可再发送同一条要求直接改表单。`;
}

function compactRules(model = {}) {
  return {
    rules: (model.rules || []).map((rule) => ({
      id: rule.id,
      name: rule.name,
      type: rule.type,
      scope: rule.scope,
      description: rule.description
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
