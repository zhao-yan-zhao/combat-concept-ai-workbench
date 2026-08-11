/**
 * 规则库（导航 02）：紧凑表单 CRUD + researchChat 对话侧栏。
 * 本页不提供活动绑定（绑定在阶段确认后的校验步处理）。
 */
import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { renderPhaseChainGuide } from "./phaseChainGuide.js";
import {
  renderResearchChatFloatButton,
  renderResearchChatPanel
} from "./researchChat/index.js";

const RULE_TYPES = ["约束", "前置条件", "转换条件", "业务规则", "其他"];

export function renderRuleLibrary(state = {}) {
  const resolved = resolveDodafProduct(state, "ov6a");
  const model = resolved.model || { rules: [] };
  const storage = state.ov6aStorage || null;
  const rules = Array.isArray(model.rules) ? model.rules : [];
  const chatGenerating = Boolean(state.ruleLibraryChatGenerating);
  const pregenerating = Boolean(state.ruleLibraryPregenerating);
  const chatOpen = Boolean(state.ruleLibraryChatOpen);
  const busy = chatGenerating || pregenerating;
  const hasRules = rules.length > 0;

  return `<section class="rule-library-page is-form-mode ${chatOpen ? "is-chat-open" : "is-chat-collapsed"}${pregenerating ? " is-pregenerating" : ""}" data-view-page="rule-library" data-dodaf-product="OV-6a">
    ${renderPhaseChainGuide(state, "ov6a")}

    <header class="rule-library-top">
      <div class="rule-library-bar">
        <div class="rule-library-identity">
          <h2>规则库</h2>
          <span class="mini-tag">${resolved.source === "persisted" ? "已持久化" : "本地/种子"} · v${model.version || 2}</span>
          <span class="mini-tag">${rules.length} 条</span>
          ${pregenerating ? `<span class="mini-tag review">预生成中</span>` : ""}
          ${chatGenerating ? `<span class="mini-tag review">对话中</span>` : ""}
          <small class="rule-library-hint">表单维护规则本体 · 不绑定活动 · 对话从右上角入口打开</small>
        </div>
        <div class="rule-library-toolbar">
          <button type="button" class="primary-btn" data-action="save-dodaf-ov6a" ${busy ? "disabled" : ""}>保存</button>
          <button type="button" class="quiet-button" data-view="phase-action" ${busy ? "disabled" : ""}>下一步</button>
        </div>
      </div>
      ${storage ? `<div class="rule-library-storage">${renderProjectStorageState(storage, { refreshAction: "refresh-project-ov6a" })}</div>` : ""}
    </header>

    <div class="rule-library-workbench ${chatOpen ? "is-chat-open" : "is-chat-collapsed"}" aria-label="规则库研究台">
      <div class="rule-form-board" aria-label="规则表单列表">
        ${hasRules
    ? `<div class="rule-form-list">${rules.map((rule, index) => renderRuleForm(rule, index + 1, { busy })).join("")}</div>
        <div class="rule-form-footer">
          <button type="button" class="rule-library-add" data-action="ov6a-add-rule" ${busy ? "disabled" : ""}>＋ 新增规则</button>
        </div>`
    : renderEmptyBoard({ busy, pregenerating })}
      </div>
      <aside class="rule-chat-dock ${chatOpen ? "is-open" : "is-collapsed"}" id="ruleLibraryChatDock" aria-hidden="${chatOpen ? "false" : "true"}" aria-label="规则库对话侧栏">
        ${chatOpen ? renderRuleLibraryChatPanel({
          chat: state.ruleLibraryChat,
          chatGenerating,
          rules,
          model
        }) : ""}
      </aside>
    </div>
  </section>`;
}

/** Topbar floating FAB — same host/position as phase-action / force-mission. */
export function renderRuleLibraryChatFloatButton({ chatOpen = false, chatGenerating = false, disabled = false } = {}) {
  return renderResearchChatFloatButton({
    scope: "rule-library",
    open: chatOpen,
    generating: chatGenerating,
    disabled,
    titleOpen: "收起规则对话",
    titleClosed: "打开规则对话",
    action: "toggle-rule-library-chat"
  });
}

function renderRuleLibraryChatPanel({ chat, chatGenerating, rules, model }) {
  const footerHtml = `<div class="phase-review-chat-footer rule-review-chat-footer">
        <button type="button" data-action="save-dodaf-ov6a" ${chatGenerating ? "disabled" : ""}>保存规则库</button>
        <p class="planning-meta">规则 ${Array.isArray(rules) ? rules.length : 0} 条 · 本步不绑定活动</p>
      </div>`;
  return renderResearchChatPanel({
    scope: "rule-library",
    session: chat,
    generating: chatGenerating,
    title: "规则对话",
    subtitle: "自然语言起草/修订规则本体，左侧表单即时同步。",
    statusLabel: chatGenerating ? "正在修订" : "研究助手",
    placeholder: "例如：补充关键链路可用约束；删除空泛规则",
    emptyTitle: "开始规则对话",
    emptyText: "例如：按简报补充约束；把第 2 条改成转换条件；删除空泛规则。",
    disabled: chatGenerating,
    className: "phase-review-chat rule-review-chat",
    interactiveTopic: "revision",
    headerActionsHtml: `<button type="button" class="phase-chat-close" data-action="close-rule-library-chat" title="收起对话" aria-label="收起对话"><span aria-hidden="true">×</span></button>`,
    footerHtml
  });
}

function renderRuleForm(rule, ordinal, { busy = false } = {}) {
  const typeOptions = RULE_TYPES.map((type) => {
    const current = rule.type || "约束";
    const selected = current === type || (!RULE_TYPES.includes(current) && type === "其他");
    return `<option value="${escapeHtml(type)}" ${selected ? "selected" : ""}>${escapeHtml(type)}</option>`;
  }).join("");
  const title = String(rule.name || rule.subject || "").trim() || `规则 ${ordinal}`;
  const typeLabel = String(rule.type || "约束").trim() || "约束";

  return `<article class="rule-form-card" data-rule-id="${escapeHtml(rule.id)}">
    <header class="rule-form-card-head">
      <div class="rule-form-card-title">
        <span class="rule-form-ordinal" aria-hidden="true">${ordinal}</span>
        <div>
          <strong>${escapeHtml(title)}</strong>
          <small class="muted"><span class="mini-tag">${escapeHtml(typeLabel)}</span> ${escapeHtml(rule.id)}</small>
        </div>
      </div>
      <button type="button" class="quiet-button danger-quiet" data-action="ov6a-delete-rule" data-rule-id="${escapeHtml(rule.id)}" ${busy ? "disabled" : ""}>删除</button>
    </header>
    <div class="rule-form-grid">
      <label class="rule-form-field">
        <span>规则名称</span>
        <input data-dodaf-field="ov6a.rule.${escapeHtml(rule.id)}.name" value="${escapeHtml(rule.name || rule.subject || "")}" placeholder="例如：关键链路可用" ${busy ? "disabled" : ""} />
      </label>
      <label class="rule-form-field">
        <span>类型</span>
        <select data-dodaf-field="ov6a.rule.${escapeHtml(rule.id)}.type" ${busy ? "disabled" : ""}>${typeOptions}</select>
      </label>
      <label class="rule-form-field">
        <span>作用范围</span>
        <input data-dodaf-field="ov6a.rule.${escapeHtml(rule.id)}.scope" value="${escapeHtml(rule.scope || "")}" placeholder="全局 / 某阶段 / 某域" ${busy ? "disabled" : ""} />
      </label>
      <label class="rule-form-field rule-form-field-full">
        <span>规则描述</span>
        <textarea data-dodaf-field="ov6a.rule.${escapeHtml(rule.id)}.description" rows="2" placeholder="写明约束含义、适用条件与例外" ${busy ? "disabled" : ""}>${escapeHtml(rule.description || rule.text || "")}</textarea>
      </label>
    </div>
  </article>`;
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
