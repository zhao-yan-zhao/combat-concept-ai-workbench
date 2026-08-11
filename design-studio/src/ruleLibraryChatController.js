import { generateWithAiStream, isAiOutput } from "../../shared/aiClient.js";
import { generateMockOutput } from "../../shared/generator.js";
import { normalizeDodafOv6a } from "../../shared/dodaf/products.js";
import { resolveDodafProduct, saveLocalDodafProduct } from "./dodafProductStore.js";
import { ensureOv6aModel } from "./ov6Workbench.js";
import {
  beginRuleLibraryChatTurn,
  completeRuleLibraryChatTurn,
  ensureRuleLibraryChatWelcome,
  persistRuleLibraryChat,
  seedRuleLibraryChatFromModel,
  summarizeRuleLibraryChat,
  updateRuleLibraryChatPendingText
} from "./ruleLibraryChatStore.js";
import { createResearchChatController } from "./researchChat/index.js";

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
  onBusyChange = () => {}
}) {
  const chat = createResearchChatController({
    scope: "rule-library",
    topic: "revision",
    getState,
    render,
    notify,
    getSession: (state) => state.ruleLibraryChat,
    setSession: (state, action) => {
      if (action.type === "begin") {
        state.ruleLibraryChat = persistRuleLibraryChat(
          beginRuleLibraryChatTurn(state.ruleLibraryChat, action.question, action.replaceMessageId || ""),
          projectId
        );
        return;
      }
      if (action.type === "delta") {
        state.ruleLibraryChat = updateRuleLibraryChatPendingText(state.ruleLibraryChat, action.text || "");
        return;
      }
      if (action.type === "complete") {
        state.ruleLibraryChat = persistRuleLibraryChat(
          completeRuleLibraryChatTurn(state.ruleLibraryChat, action.advice, action.source || "ai"),
          projectId
        );
      }
    },
    isGenerating: (state) => Boolean(state.ruleLibraryChatGenerating || state.ruleLibraryPregenerating),
    setGenerating: (state, value) => {
      state.ruleLibraryChatGenerating = Boolean(value);
    },
    canSend: (state) => !state.ruleLibraryChatGenerating && !state.ruleLibraryPregenerating,
    async runTurn({ question, state, onDelta }) {
      const current = ensureOv6aModel(resolveDodafProduct(state, "ov6a").model);
      const recentChat = summarizeRuleLibraryChat(state.ruleLibraryChat);
      const revisionNotes = [recentChat, `本轮要求：${question}`].filter(Boolean).join("\n");

      try {
        const response = await generateWithAiStream({
          workflowId: "rule-library",
          workflow: { id: "rule-library", title: "规则库对话修订", outputSchema: "RuleLibraryDraft" },
          analysis: {
            ...briefAnalysis(state.brief),
            currentRules: compactRules(current),
            reviewNotes: revisionNotes,
            revisionRequest: question,
            "修订要求": "根据研究人员本轮要求起草或修订规则本体。本步只维护规则库（name/type/scope/description），不要输出活动绑定。规则须可复核、克制、作战语义明确；禁止空泛套话。若本轮是咨询（不改库），rules 可为空数组并在 summary 直接回答；若起草/增删改，返回完整 rules 列表（保留仍有效的规则，落实本轮改动）。条数按需要，不设固定上下限。type 优先：约束/前置条件/转换条件/业务规则/其他。"
          },
          evidence: []
        }, {
          onDelta: (payload) => {
            const preview = String(payload?.preview || "").trim()
              || (payload?.assembled ? `正在生成规则建议… ${Math.min(100, Math.round(String(payload.assembled).length / 30))}%` : "");
            if (preview) onDelta?.({ preview, assembled: payload.assembled || "" });
          }
        });

        if (!isAiOutput(response)) throw new Error("rule library chat response incomplete");

        const draft = response.result || {};
        const nextRules = Array.isArray(draft.rules) ? draft.rules : [];
        let applied = 0;
        if (nextRules.length) {
          const next = applyRuleLibraryDraft(current, draft);
          state.ov6a = saveLocalDodafProduct("ov6a", next, projectId);
          applied = next.rules.length;
          try {
            await syncOv6a(state.ov6a, { source: "rule-library:chat-revise" });
          } catch {
            /* local draft remains */
          }
        }

        return {
          advice: formatRevisionAdvice(question, draft, applied),
          source: "ai",
          notifyMessage: applied
            ? `已按对话更新规则库（${applied} 条），请在表单中复核`
            : "已给出规则库研究建议（未改表单）"
        };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error || "ai-unavailable"));
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
        "修订要求": "这是简报确认后进入规则库的首次预生成。根据简报六项起草完整作战规则本体（name/type/scope/description），不要输出活动绑定。按课题需要覆盖约束、前置条件、转换条件、业务规则等；条数不设固定上下限，禁止凑数重复与空泛套话；每条须可观察、可复核，并回扣任务目标、关键假设、预期效果与主要风险。"
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

  return {
    bind: chat.bind,
    pregenerateFromBrief,
    seedFromModel(model) {
      const state = getState();
      state.ruleLibraryChat = persistRuleLibraryChat(seedRuleLibraryChatFromModel(model), projectId);
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

function formatRevisionAdvice(question, draft = {}, applied = 0) {
  const summary = String(draft.summary || draft.coreIdea || "").trim();
  if (summary) return summary.slice(0, 360);
  const subject = String(question || "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (applied > 0) {
    return `已根据“${subject || "你的要求"}”更新规则库（${applied} 条）。请在左侧表单核对名称、类型、范围与描述；满意后可保存并进入阶段与行动。`.slice(0, 360);
  }
  return `已围绕“${subject || "你的问题"}”给出规则库研究建议。如需改表单，请明确：新增/删除哪条、改名称还是描述。`.slice(0, 360);
}

function createFallbackAdvice(question, model = {}) {
  const subject = String(question || "").replace(/\s+/g, " ").trim().slice(0, 90) || "该要求";
  const count = Array.isArray(model.rules) ? model.rules.length : 0;
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
