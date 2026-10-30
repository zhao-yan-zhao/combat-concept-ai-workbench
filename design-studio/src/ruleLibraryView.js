/**
 * 规则库（导航 02）：紧凑表单 CRUD + researchChat 对话侧栏。
 * 本页不提供活动绑定（绑定在阶段确认后的校验步处理）。
 */
import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderProjectStorageActions } from "./projectStorageView.js";
import {
  renderResearchChatDock,
  renderResearchChatFloatButton,
  renderResearchChatPanel
} from "./researchChat/index.js";
import { listRuleBindingCandidates } from "./ov6Workbench.js";

const RULE_TYPES = ["约束", "前置条件", "转换条件", "业务规则", "其他"];

export function renderRuleLibrary(state = {}) {
  const resolved = resolveDodafProduct(state, "ov6a");
  const model = resolved.model || { rules: [] };
  const storage = state.ov6aStorage || null;
  const rules = Array.isArray(model.rules) ? model.rules : [];
  const chatGenerating = Boolean(state.ruleLibraryChatGenerating);
  const pregenerating = Boolean(state.ruleLibraryPregenerating);
  const changeGenerating = Boolean(state.ruleLibraryChangeGenerating);
  const changeSet = model.ruleChangeSet;
  const phaseNames = new Map((state.phaseAction?.phases || []).map((phase) => [String(phase.id || ""), String(phase.name || phase.id || "阶段")]));
  const bindingCandidates = listRuleBindingCandidates(state);
  const bindingFocus = state.relatedModelReturnContext?.relatedViewId === "ov6a"
    ? { type: state.relatedModelReturnContext.focusType || "", ref: state.relatedModelReturnContext.focusId || "" }
    : {};
  const chatOpen = Boolean(state.ruleLibraryChatOpen);
  const busy = chatGenerating || pregenerating || changeGenerating;
  const hasRules = rules.length > 0;

  return `<section class="rule-library-page is-form-mode ${chatOpen ? "is-chat-open" : "is-chat-collapsed"}${pregenerating ? " is-pregenerating" : ""}" data-view-page="rule-library" data-dodaf-product="OV-6a">
    <header class="rule-library-top">
      <div class="rule-library-bar">
        <div class="rule-library-identity">
          <h2>规则库</h2>
          <span class="mini-tag">${resolved.source === "persisted" ? "已持久化" : "本地/种子"} · v${model.version || 2}</span>
          <span class="mini-tag">${rules.length} 条</span>
          ${pregenerating ? `<span class="mini-tag review">预生成中</span>` : ""}
          ${chatGenerating ? `<span class="mini-tag review">对话中</span>` : ""}
          <small class="rule-library-hint">维护可观察、可复核的规则本体；每条规则可展开绑定任务与兵力，变更建议统一在此审核。</small>
        </div>
        <div class="rule-library-toolbar">
          ${storage ? renderProjectStorageActions(storage, { refreshAction: "refresh-project-ov6a" }) : ""}
          ${hasRules ? `<button type="button" class="quiet-button danger-quiet" data-action="ov6a-clear-all" ${busy ? "disabled" : ""} title="清空全部规则">清空全部</button>` : ""}
          <button type="button" class="primary-btn" data-action="save-dodaf-ov6a" ${busy ? "disabled" : ""}>保存</button>
          <button type="button" class="quiet-button" data-action="advance-workflow" ${busy ? "disabled" : ""}>下一步</button>
        </div>
      </div>
      ${renderRuleChangeSet(changeSet, { busy, phaseNames })}
    </header>

    <div class="rule-library-workbench ${chatOpen ? "is-chat-open" : "is-chat-collapsed"}" aria-label="规则库研究台">
      <div class="rule-form-board" aria-label="规则表单列表">
        ${hasRules
    ? `<div class="rule-form-list">${rules.map((rule, index) => renderRuleForm(rule, index + 1, { busy, phaseNames, bindingCandidates, bindingFocus })).join("")}</div>
        <div class="rule-form-footer">
          <button type="button" class="rule-library-add" data-action="ov6a-add-rule" ${busy ? "disabled" : ""}>＋ 新增规则</button>
        </div>`
    : renderEmptyBoard({ busy, pregenerating })}
      </div>
      ${renderResearchChatDock({
        scope: "rule",
        open: chatOpen,
        dockId: "ruleLibraryChatDock",
        label: "规则库对话侧栏",
        contentHtml: renderRuleLibraryChatPanel({
          chat: state.ruleLibraryChat,
          chatGenerating,
          rules,
          model
        })
      })}
    </div>
  </section>`;
}

function renderRuleChangeSet(changeSet, { busy = false, phaseNames = new Map() } = {}) {
  const changes = Array.isArray(changeSet?.changes) ? changeSet.changes : [];
  const pending = changes.filter((change) => change.status === "pending");
  if (!pending.length) return "";
  const sourceLabel = changeSet.source === "operational-task" ? "作战任务" : changeSet.source === "force-mission" ? "任务与兵力" : "阶段与行动";
  return `<section class="rule-change-set" aria-label="待审核规则变更">
    <header class="rule-change-set-head">
      <div><strong>待审核变更</strong><small>${escapeHtml(sourceLabel)}分析 · ${pending.length} 项</small></div>
      <button type="button" class="quiet-button" data-action="ov6a-apply-all-changes" ${busy ? "disabled" : ""}>全部采纳</button>
    </header>
    ${changeSet.summary ? `<p class="planning-meta">${escapeHtml(changeSet.summary)}</p>` : ""}
    <div class="rule-change-list">${pending.map((change) => `<article class="rule-change-row">
      <div><span class="mini-tag review">${escapeHtml(change.action === "add" ? "新增" : change.action === "revise" ? "修订" : "废止")}</span> <strong>${escapeHtml(change.rule?.name || change.ruleId || "规则")}</strong>
        ${renderPhaseBindingTags(change.rule?.phaseRefs, phaseNames, "拟绑定阶段")}
        ${(change.rule?.taskRefs || []).length ? `<span class="mini-tag">拟绑定任务: ${(change.rule.taskRefs).join(", ")}</span>` : ""}
        ${(change.rule?.forceRefs || []).length ? `<span class="mini-tag">拟绑定兵力: ${(change.rule.forceRefs).join(", ")}</span>` : ""}
        <p>${escapeHtml(change.rationale || change.rule?.description || "请复核此建议")}</p></div>
      <div class="rule-change-actions"><button type="button" class="quiet-button" data-action="ov6a-ignore-change" data-change-id="${escapeHtml(change.id)}" ${busy ? "disabled" : ""}>忽略</button><button type="button" class="primary-btn" data-action="ov6a-apply-change" data-change-id="${escapeHtml(change.id)}" ${busy ? "disabled" : ""}>采纳</button></div>
    </article>`).join("")}</div>
  </section>`;
}

/** Topbar floating FAB — same host/position as phase-action / force-mission. */
export function renderRuleLibraryChatFloatButton({ chatOpen = false, chatGenerating = false, disabled = false } = {}) {
  return renderResearchChatFloatButton({
    scope: "rule-library",
    open: chatOpen,
    generating: chatGenerating,
    disabled,
    titleOpen: "收起 AI 对话",
    titleClosed: "打开 AI 对话",
    action: "toggle-rule-library-chat"
  });
}

function renderRuleLibraryChatPanel({ chat, chatGenerating, rules, model }) {
  const footerHtml = `<div class="phase-review-chat-footer rule-review-chat-footer sm-review-chat-footer">
        <button type="button" data-action="save-dodaf-ov6a" ${chatGenerating ? "disabled" : ""}>保存规则库</button>
        <p class="planning-meta">规则 ${Array.isArray(rules) ? rules.length : 0} 条 · 阶段/任务/兵力绑定需人工复核</p>
      </div>`;
  return renderResearchChatPanel({
    scope: "rule-library",
    session: chat,
    generating: chatGenerating,
    title: "规则库对话",
    subtitle: "自然语言起草或修订规则本体、约束与前置条件，表单即时同步。",
    statusLabel: chatGenerating ? "正在修订" : "研究助手",
    placeholder: "例如：按作战任务生成约束规则；补充关键链路可用约束",
    emptyTitle: "开始规则库对话",
    emptyText: "例如：按任务起草规则；把第 2 条改成转换条件；删除空泛套话规则。",
    disabled: chatGenerating,
    className: "phase-review-chat rule-review-chat sm-review-chat",
    interactiveTopic: "revision",
    headerActionsHtml: `<button type="button" class="phase-chat-close" data-action="close-rule-library-chat" title="收起对话" aria-label="收起对话"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>`,
    footerHtml
  });
}

function renderRuleForm(rule, ordinal, { busy = false, phaseNames = new Map(), bindingCandidates = [], bindingFocus = {} } = {}) {
  const typeOptions = RULE_TYPES.map((type) => {
    const current = rule.type || "约束";
    const selected = current === type || (!RULE_TYPES.includes(current) && type === "其他");
    return `<option value="${escapeHtml(type)}" ${selected ? "selected" : ""}>${escapeHtml(type)}</option>`;
  }).join("");
  return `<article class="rule-form-card rule-form-row" data-rule-id="${escapeHtml(rule.id)}">
    <span class="rule-form-ordinal" aria-label="规则 ${ordinal}">${ordinal}</span>
    <label class="rule-form-field rule-form-name"><span class="sr-only">规则名称</span><input aria-label="规则名称" data-dodaf-field="ov6a.rule.${escapeHtml(rule.id)}.name" value="${escapeHtml(rule.name || rule.subject || "")}" placeholder="规则名称" ${busy ? "disabled" : ""} />${renderPhaseBindingTags((rule.phaseBindings || []).map((binding) => binding.phaseRef), phaseNames, "阶段")}</label>
    <label class="rule-form-field rule-form-type"><span class="sr-only">类型</span><select aria-label="规则类型" data-dodaf-field="ov6a.rule.${escapeHtml(rule.id)}.type" ${busy ? "disabled" : ""}>${typeOptions}</select></label>
    <label class="rule-form-field rule-form-scope"><span class="sr-only">作用范围</span><input aria-label="作用范围" data-dodaf-field="ov6a.rule.${escapeHtml(rule.id)}.scope" value="${escapeHtml(rule.scope || "")}" placeholder="作用范围" ${busy ? "disabled" : ""} /></label>
    <label class="rule-form-field rule-form-description"><span class="sr-only">规则描述</span><input aria-label="规则描述" data-dodaf-field="ov6a.rule.${escapeHtml(rule.id)}.description" value="${escapeHtml(rule.description || rule.text || "")}" placeholder="规则描述" ${busy ? "disabled" : ""} /></label>
    <button type="button" class="quiet-button danger-quiet" data-action="ov6a-delete-rule" data-rule-id="${escapeHtml(rule.id)}" ${busy ? "disabled" : ""} aria-label="删除规则 ${ordinal}" title="删除规则">删除</button>
    ${renderObjectBindingEditor(rule, { busy, candidates: bindingCandidates, focus: bindingFocus })}
  </article>`;
}

function renderObjectBindingEditor(rule, { busy = false, candidates = [], focus = {} } = {}) {
  const existing = [
    ...(rule.phaseBindings || []).map((item) => ({ type: "phase", ref: item.phaseRef })),
    ...(rule.taskBindings || []).map((item) => ({ type: "task", ref: item.taskRef })),
    ...(rule.forceBindings || []).map((item) => ({ type: "force", ref: item.forceRef }))
  ];
  const focused = ["phase", "task", "force"].includes(focus.type) && focus.ref
    ? candidates.filter((item) => item.type === focus.type && item.ref === focus.ref)
    : candidates;
  const rows = [...focused];
  existing.forEach((item) => {
    if (focus.ref && (item.type !== focus.type || item.ref !== focus.ref)) return;
    const known = candidates.some((candidate) => candidate.type === item.type && candidate.ref === item.ref);
    if (!rows.some((candidate) => candidate.type === item.type && candidate.ref === item.ref)) rows.push({ type: item.type, ref: item.ref, name: known ? item.ref : `${item.ref}（引用失效）`, missing: !known });
  });
  if (!rows.length) return "";
  const typeLabel = (t) => t === "phase" ? "阶段" : t === "task" ? "任务" : "兵力";
  return `<details class="rule-object-bindings" ${focus.ref ? "open" : ""}>
    <summary>阶段 / 任务 / 兵力绑定${existing.length ? ` · ${existing.length}` : ""}${focus.ref ? " · 当前对象" : ""}</summary>
    <div class="rule-object-binding-list">${rows.map((candidate) => {
      const binding = candidate.type === "phase"
        ? (rule.phaseBindings || []).find((item) => item.phaseRef === candidate.ref)
        : candidate.type === "task"
          ? (rule.taskBindings || []).find((item) => item.taskRef === candidate.ref)
          : (rule.forceBindings || []).find((item) => item.forceRef === candidate.ref);
      const checked = Boolean(binding);
      return `<div class="rule-object-binding-row ${candidate.missing ? "is-missing" : ""}">
        <label><input type="checkbox" data-action="ov6a-toggle-object-binding" data-rule-id="${escapeHtml(rule.id)}" data-binding-type="${escapeHtml(candidate.type)}" data-object-ref="${escapeHtml(candidate.ref)}" ${checked ? "checked" : ""} ${busy ? "disabled" : ""}><span>${escapeHtml(typeLabel(candidate.type))}：${escapeHtml(candidate.name)}</span></label>
        ${checked ? `<select aria-label="绑定状态" data-action="ov6a-set-object-binding-status" data-rule-id="${escapeHtml(rule.id)}" data-binding-type="${escapeHtml(candidate.type)}" data-object-ref="${escapeHtml(candidate.ref)}" ${busy ? "disabled" : ""}>${renderBindingStatusOptions(binding.bindingStatus)}</select>` : ""}
      </div>`;
    }).join("")}</div>
  </details>`;
}

function renderBindingStatusOptions(current = "pending") {
  return [["pending", "待复核"], ["verified", "已确认"], ["rejected", "已驳回"], ["stale", "已过期"]]
    .map(([value, label]) => `<option value="${value}" ${current === value ? "selected" : ""}>${label}</option>`)
    .join("");
}

function renderPhaseBindingTags(refs = [], phaseNames = new Map(), prefix = "阶段") {
  const unique = [...new Set((refs || []).map(String).filter(Boolean))];
  if (!unique.length) return "";
  return `<span class="rule-phase-bindings" aria-label="${escapeHtml(prefix)}阶段">${unique.map((ref) => `<span class="mini-tag">${escapeHtml(prefix)}：${escapeHtml(phaseNames.get(ref) || ref)}</span>`).join("")}</span>`;
}

function renderEmptyBoard({ busy = false, pregenerating = false } = {}) {
  if (pregenerating) {
    return `<div class="rule-form-empty is-pregenerating" role="status" aria-live="polite">
      <div class="rule-pregenerate-spinner" aria-hidden="true"></div>
      <h3>正在根据简报起草规则</h3>
      <p>请稍候，AI 将按已确认简报生成作战规则本体…</p>
    </div>`;
  }
  return `<div class="rule-form-empty">
    <h3>暂无规则</h3>
    <p>新增一条规则，或用右上角对话入口自然语言起草。</p>
    <div class="rule-form-empty-actions">
      <button type="button" class="primary-btn" data-action="ov6a-add-rule" ${busy ? "disabled" : ""}>新增规则</button>
    </div>
  </div>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
