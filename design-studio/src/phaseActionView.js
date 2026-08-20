import { escapeHtml } from "./app/domUtils.js";
import {
  getSelectedCombatFocuses,
  hasSelectedCombatFocus,
  isCombatFocusConfirmed
} from "./combatFocusStore.js";
import { isPhaseActionConceptConfirmed } from "./phaseActionStore.js";
import { renderPlanningMigrationBanner } from "./planningContext.js";
import {
  renderResearchChatFloatButton,
  renderResearchChatPanel
} from "./researchChat/researchChatView.js";

/**
 * 阶段与行动：主研读台（左链 + 中 CONOPS）+ 右上悬浮核验对话（OV-1 同位置入口）。
 * 流程：作战聚焦 → 确认聚焦 → 生成阶段 → 对话修订 → 确认
 */
export function renderPhaseAction(state) {
  const plan = state.phaseAction || {};
  const generating = Boolean(state.phaseActionGenerating);
  const focusGenerating = Boolean(state.combatFocusGenerating);
  const confirmed = isPhaseActionConceptConfirmed(plan, state.phaseActionStorage);
  const status = state.phaseActionStorage?.stale
    ? "已过期"
    : confirmed
      ? "已确认"
      : plan.status === "draft"
        ? "草案待复核"
        : "待生成";
  const phases = Array.isArray(plan.phases) ? plan.phases : [];
  const transitions = Array.isArray(plan.transitions) ? plan.transitions : [];
  const combatFocus = state.combatFocus || {};
  const focusOptions = Array.isArray(combatFocus.options) ? combatFocus.options : [];
  const selectedFocuses = getSelectedCombatFocuses(combatFocus);
  const hasFocus = hasSelectedCombatFocus(combatFocus);
  const focusConfirmed = isCombatFocusConfirmed(combatFocus);
  const selectedIds = new Set(selectedFocuses.map((item) => item.id));
  const focusId = state.phaseActionFocusId && phases.some((p) => p.id === state.phaseActionFocusId)
    ? state.phaseActionFocusId
    : (phases[0]?.id || "");
  const focus = phases.find((p) => p.id === focusId) || null;
  const focusIndex = focus ? phases.findIndex((p) => p.id === focus.id) : -1;
  const relatedTransitions = transitions.filter((t) => t.fromPhaseId === focusId || t.toPhaseId === focusId);
  const inbound = transitions.filter((t) => t.toPhaseId === focusId);
  const outbound = transitions.filter((t) => t.fromPhaseId === focusId);
  const phaseName = (id) => phases.find((p) => p.id === id)?.name || id;
  const chatGenerating = Boolean(state.phaseActionChatGenerating);
  const chatOpen = Boolean(state.phaseActionChatOpen) && phases.length > 0;
  const busy = generating || focusGenerating || chatGenerating;
  const selectedLabels = selectedFocuses.map((item) => item.title).join("、");
  const showResearchBench = phases.length > 0;
  const statusLabel = `${status}${focusGenerating ? " · 聚焦生成中" : chatGenerating ? " · 对话修订中" : generating ? " · 阶段生成中" : ""}`;

  return `<section class="planning-page phase-action-page phase-action-page--bench ${chatOpen ? "is-chat-open" : "is-chat-collapsed"}">
    ${renderPlanningMigrationBanner(state)}

    ${renderCombatFocusBlock({
      focusConfirmed,
      hasFocus,
      busy,
      focusGenerating,
      focusOptions,
      selectedIds,
      selectedFocuses,
      selectedLabels,
      statusLabel,
      statusClass: confirmed ? "ready" : busy ? "review" : ""
    })}

    ${focusConfirmed ? "" : hasFocus
      ? `<p class="planning-banner">已选择聚焦，请点击「确认作战聚焦并生成阶段」；确认后会结合简报、聚焦与规则库起草作战阶段（含作战活动，已有类似表述不重复）。</p>`
      : `<p class="planning-banner">请先多选作战聚焦（或新增），再确认并生成阶段。生成时会引用上游规则库约束。</p>`}
    ${focusConfirmed && Array.isArray(state.ov6a?.rules) && state.ov6a.rules.length
      ? `<p class="planning-meta">上游规则库 ${state.ov6a.rules.length} 条已作为阶段生成输入；阶段蓝/红行动与进入退出体现作战活动，语义重复则跳过。</p>`
      : ""}

    ${showResearchBench ? `
    <div class="phase-workbench ${chatOpen ? "is-chat-open" : "is-chat-collapsed"}" aria-label="阶段与行动研究台">
      <div class="phase-main-stage">
        ${renderPhaseChain({ phases, transitions, focusId, busy, focusConfirmed, generating, generation: plan.generation || {} })}
        ${renderPhaseDetail({
          phases,
          focus,
          focusIndex,
          relatedTransitions,
          inbound,
          outbound,
          phaseName
        })}
      </div>
      <aside class="phase-chat-dock ${chatOpen ? "is-open" : "is-collapsed"}" id="phaseActionChatDock" aria-hidden="${chatOpen ? "false" : "true"}" aria-label="核验对话侧栏">
        ${chatOpen ? renderPhaseActionChatPanel({
          chat: state.phaseActionChat,
          chatGenerating,
          busy,
          confirmed,
          phases,
          plan,
          selectedLabels
        }) : ""}
      </aside>
    </div>
    ` : `
    <div class="phase-empty-state">
      <p class="empty-inspector">${focusConfirmed
        ? `聚焦已确认（${escapeHtml(selectedLabels)}）。${generating ? "正在生成作战阶段链…" : "可手动按聚焦生成阶段草案。"}`
        : hasFocus
          ? "已选择聚焦，请确认后自动生成阶段草案。"
          : "请先多选作战聚焦并确认，再生成阶段草案。"}</p>
      ${focusConfirmed ? `<div class="planning-actions phase-empty-actions">
        <button type="button" data-action="generate-phase-action" ${busy ? "disabled" : ""}>${generating ? "正在生成阶段…" : "根据已确认聚焦生成阶段草案"}</button>
      </div>` : ""}
    </div>
    `}
  </section>`;
}

/** Topbar floating FAB — same host/position as OV-1 toolbox float. */
export function renderPhaseActionChatFloatButton({ chatOpen = false, chatGenerating = false, disabled = false } = {}) {
  return renderResearchChatFloatButton({
    scope: "phase-action",
    open: chatOpen,
    generating: chatGenerating,
    disabled,
    titleOpen: "收起核验对话",
    titleClosed: "打开核验对话",
    action: "toggle-phase-action-chat"
  });
}

function renderCombatFocusBlock({
  focusConfirmed,
  hasFocus,
  busy,
  focusGenerating,
  focusOptions,
  selectedIds,
  selectedFocuses,
  selectedLabels,
  statusLabel = "",
  statusClass = ""
}) {
  const body = `
      ${focusOptions.length ? `<div class="combat-focus-grid" role="listbox" aria-multiselectable="true" aria-label="作战聚焦候选（可多选）">
        ${focusOptions.map((option) => {
          const selected = selectedIds.has(option.id);
          return `<button type="button" class="combat-focus-card ${selected ? "is-selected" : ""}" role="option" aria-selected="${selected ? "true" : "false"}" data-action="toggle-combat-focus" data-focus-id="${escapeHtml(option.id)}" ${busy ? "disabled" : ""}>
            <div class="combat-focus-card-top">
              <strong><span class="combat-focus-check" aria-hidden="true">${selected ? "✓" : ""}</span>${escapeHtml(option.title)}</strong>
              <span class="mini-tag ${option.source === "custom" ? "review" : selected ? "ready" : ""}">${option.source === "custom" ? "自建" : option.source === "local" ? "本地" : "AI"}${selected ? " · 已选" : ""}</span>
            </div>
            <p>${escapeHtml(option.text)}</p>
          </button>`;
        }).join("")}
      </div>` : focusGenerating
        ? `<p class="empty-inspector combat-focus-empty is-generating" role="status">正在根据简报生成 3 个作战聚焦方向…</p>`
        : `<p class="empty-inspector combat-focus-empty">尚未生成作战聚焦。进入本步时会自动起草 3 个候选，也可点击上方按钮手动生成。</p>`}

      ${selectedFocuses.length ? `<div class="combat-focus-selected">
        <p>已选 ${selectedFocuses.length} 项${focusConfirmed ? "（已确认）" : "（待确认）"}：</p>
        <ul>${selectedFocuses.map((item) => `<li><b>${escapeHtml(item.title)}</b> — ${escapeHtml(item.text)}</li>`).join("")}</ul>
      </div>` : ""}

      <details class="combat-focus-add" ${focusOptions.length ? "" : "open"}>
        <summary>新增自定义作战聚焦</summary>
        <div class="combat-focus-add-form">
          <label><span>名称</span><input id="combatFocusCustomTitle" type="text" maxlength="40" placeholder="例如：联合封控塑势" ${busy ? "disabled" : ""}></label>
          <label><span>说明</span><textarea id="combatFocusCustomText" rows="2" maxlength="280" placeholder="说明该聚焦如何服务任务目标（作战语义，非研究流程）" ${busy ? "disabled" : ""}></textarea></label>
          <button type="button" class="quiet-button" data-action="add-custom-combat-focus" ${busy ? "disabled" : ""}>新增并加入已选</button>
        </div>
      </details>`;

  const actions = `
        <div class="planning-actions">
          <button type="button" data-action="generate-combat-focus" ${busy ? "disabled" : ""}>${focusGenerating ? "正在生成聚焦…" : focusOptions.length ? "重生成 3 个聚焦" : "根据简报生成 3 个作战聚焦"}</button>
          <button type="button" data-action="confirm-combat-focus" ${busy || !hasFocus || focusConfirmed ? "disabled" : ""}>${focusConfirmed ? "聚焦已确认" : "确认作战聚焦并生成阶段"}</button>
        </div>`;

  if (focusConfirmed) {
    return `<details class="combat-focus-summary" aria-label="作战聚焦（已确认）">
      <summary class="combat-focus-summary-bar">
        <div class="combat-focus-summary-main">
          <span class="mini-tag ready">聚焦已确认</span>
          <strong>${escapeHtml(selectedLabels || "—")}</strong>
          ${statusLabel ? `<span class="mini-tag ${statusClass}">${escapeHtml(statusLabel)}</span>` : ""}
          <small>展开可改选或重生成</small>
        </div>
        <span class="combat-focus-summary-hint">展开编辑</span>
      </summary>
      <section class="combat-focus-panel combat-focus-panel--nested" aria-label="作战聚焦编辑">
        <header class="combat-focus-head">
          <div>
            <h3>作战聚焦</h3>
            <p>改选后需重新确认；确认将按新聚焦重生成阶段草案。</p>
          </div>
          ${actions}
        </header>
        ${body}
      </section>
    </details>`;
  }

  return `<section class="combat-focus-panel" aria-label="作战聚焦">
      <header class="combat-focus-head">
        <div>
          <h3>作战聚焦 <span class="mini-tag ${hasFocus ? "review" : ""}">${hasFocus ? "待确认" : "待选择"}</span>${statusLabel ? ` <span class="mini-tag ${statusClass}">${escapeHtml(statusLabel)}</span>` : ""}</h3>
          <p>根据简报生成 3 个可区分的作战设计优先轴（专业 CONOPS 取向）；<strong>可多选（最多 3 个）</strong>。确认后自动起草阶段。也可新增自定义。</p>
        </div>
        ${actions}
      </header>
      ${body}
    </section>`;
}

function renderPhaseChain({ phases, transitions, focusId, busy, focusConfirmed, generating, generation = {} }) {
  const source = String(generation.source || "").trim();
  const sourceLabel = source === "ai"
    ? "来源 AI"
    : source === "local-ai-fallback"
      ? "来源 本地回退"
      : source === "local"
        ? "来源 本地"
        : source
          ? `来源 ${source}`
          : "来源 —";
  return `<aside class="phase-chain-panel planning-card" aria-label="阶段链" data-grouped-list-panel="phase-action" data-grouped-list-dimensions="状态:status|时间窗口:window" data-grouped-list-default-group="status">
        <header>
          <h3>阶段链</h3>
          <small>${phases.length} 段 · ${transitions.length} 转换 · ${escapeHtml(sourceLabel)}</small>
        </header>
        <div class="phase-chain-list" role="listbox" aria-label="阶段序列" data-grouped-list-items>
          ${phases.map((phase, index) => {
            const selected = phase.id === focusId;
            const seq = phase.sequence || index + 1;
            const next = phases[index + 1];
            const edge = next
              ? transitions.find((t) => t.fromPhaseId === phase.id && t.toPhaseId === next.id)
              : null;
            return `<div class="phase-chain-item ${selected ? "is-selected" : ""}" data-grouped-list-item data-group-status="${focusConfirmed ? "已确认" : "待确认"}" data-group-window="${escapeHtml(phase.timeWindow || "未设置")}" data-search="${escapeHtml([phase.id, phase.name, phase.timeWindow, phase.objective].filter(Boolean).join(" "))}">
              <button type="button" class="phase-chain-step" role="option" aria-selected="${selected ? "true" : "false"}" data-action="select-phase-action-focus" data-phase-id="${escapeHtml(phase.id)}">
                <span class="phase-chain-index">${seq}</span>
                <span class="phase-chain-body">
                  <strong>${escapeHtml(phase.name)}</strong>
                  <small>${escapeHtml(phase.timeWindow || clip(phase.objective, 42))}</small>
                </span>
              </button>
              ${next ? `<div class="phase-chain-edge" title="${escapeHtml(edge?.condition || "相邻转换待补")}">
                <span class="phase-chain-edge-mark" aria-hidden="true">↓</span>
                <small>${escapeHtml(clip(edge?.condition || "转换条件待补", 48))}</small>
              </div>` : ""}
            </div>`;
          }).join("")}
        </div>
        <div class="planning-actions phase-chain-actions">
          <button type="button" data-action="generate-phase-action" ${busy || !focusConfirmed ? "disabled" : ""}>${generating ? "正在生成…" : "重生成阶段草案"}</button>
        </div>
      </aside>`;
}

function renderPhaseDetail({
  phases,
  focus,
  focusIndex,
  relatedTransitions,
  inbound,
  outbound,
  phaseName
}) {
  return `<article class="phase-detail-panel planning-card phase-focus-card" aria-label="当前阶段 CONOPS">
        <header>
          <h3>${focus ? `阶段${focus.sequence || focusIndex + 1}${focus.timeWindow ? `（${escapeHtml(focus.timeWindow)}）` : ""}：${escapeHtml(focus.name)}` : "阶段详情"}</h3>
          <small>专业 CONOPS · 时窗（有依据） · 蓝/红对抗 · 阶段门槛 · 转换条件</small>
        </header>
        <div class="phase-detail-body">
        ${focus ? `
          <div class="phase-adjacent-strip" aria-label="相邻转换">
            <div class="phase-adjacent-block">
              <span>进入自</span>
              ${inbound.length
                ? inbound.map((item) => `<b>${escapeHtml(phaseName(item.fromPhaseId))}</b><small>${escapeHtml(item.condition)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</small>`).join("")
                : `<b>—</b><small>${focusIndex <= 0 ? "首阶段 / 无上游转换" : "暂无进入转换"}</small>`}
            </div>
            <div class="phase-adjacent-block">
              <span>转出至</span>
              ${outbound.length
                ? outbound.map((item) => `<b>${escapeHtml(phaseName(item.toPhaseId))}</b><small>${escapeHtml(item.condition)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</small>`).join("")
                : `<b>—</b><small>${focusIndex === phases.length - 1 ? "末阶段 / 无下游转换" : "暂无转出转换"}</small>`}
            </div>
          </div>
          <div class="phase-conops">
            <div class="phase-conops-block goal">
              <strong>阶段目标</strong>
              <p class="phase-focus-objective">${escapeHtml(focus.objective)}</p>
            </div>
            ${focus.timeWindow ? `<div class="phase-conops-block time-window">
              <strong>阶段时窗</strong>
              <p>${escapeHtml(focus.timeWindow)}</p>
              <small>${escapeHtml(describeTimeWindowHint(focus, inbound, outbound))}</small>
            </div>` : ""}
            <div class="phase-conops-pair">
              <div class="phase-conops-block blue">
                <strong>蓝方行动</strong>
                <ul>${listItems(focus.blueActions?.length ? focus.blueActions : focus.primaryActions)}</ul>
              </div>
              <div class="phase-conops-block red">
                <strong>红方行动</strong>
                <ul>${listItems(focus.redActions?.length ? focus.redActions : focus.secondaryActions)}</ul>
              </div>
            </div>
          </div>
          <div class="planning-phase-grid phase-conops-extra">
            <div><strong>进入条件</strong><ul>${listItems(focus.entryConditions)}</ul></div>
            <div><strong>退出条件</strong><ul>${listItems(focus.exitConditions)}</ul></div>
            <div><strong>预期效果</strong><ul>${listItems(focus.expectedEffects)}</ul></div>
            <div><strong>兵力挂接</strong><ul><li>${escapeHtml((focus.forceIds || []).join("、") || "后续在「兵力与任务」中设计")}</li></ul></div>
          </div>
          ${relatedTransitions.length ? `<div class="phase-related-transitions">
            <strong>与本阶段相关的全部转换（${relatedTransitions.length}）</strong>
            <ul class="planning-relations">${relatedTransitions.map((item) => `
              <li><b>${escapeHtml(phaseName(item.fromPhaseId))}</b> → <b>${escapeHtml(phaseName(item.toPhaseId))}</b><small>${escapeHtml(item.condition)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</small></li>`).join("")}</ul>
          </div>` : ""}
        ` : `<p class="empty-inspector">尚未选择阶段。</p>`}
        </div>
      </article>`;
}

function renderPhaseActionChatPanel({ chat, chatGenerating, busy, confirmed, phases, plan, selectedLabels }) {
  const disabled = busy || confirmed || !phases.length;
  const disabledReason = confirmed
    ? "本步已确认，如需修改请先重新生成草案"
    : !phases.length
      ? "请先生成阶段草案，再通过对话修订"
      : busy && !chatGenerating
        ? "阶段或聚焦生成进行中，请稍候"
        : "";
  const footerHtml = `<div class="phase-review-chat-footer">
        <button type="button" data-action="confirm-phase-action" ${busy || chatGenerating || !phases.length || confirmed ? "disabled" : ""}>${confirmed ? "已确认 · 去规则绑定" : "确认阶段与行动"}</button>
        <p class="planning-meta">生成来源：${escapeHtml(plan.generation?.source || "—")} · ${escapeHtml(plan.generation?.generatedAt || "未生成")}${selectedLabels ? ` · 聚焦：${escapeHtml(selectedLabels)}` : ""}</p>
      </div>`;
  return renderResearchChatPanel({
    scope: "phase-action",
    session: chat,
    generating: chatGenerating,
    title: "核验对话",
    subtitle: "按上下文修订阶段草案，左侧 CONOPS 即时同步。",
    statusLabel: chatGenerating ? "正在修订" : confirmed ? "已确认" : "研究助手",
    placeholder: confirmed ? "本步已确认，如需修改请先重新生成草案" : "输入修订要求，例如：把突击阶段拆成进入与打击两段",
    emptyTitle: "开始核验修订",
    emptyText: "例如：合并第 2、3 阶段；补充进入条件；缩短撤离时窗。",
    disabled,
    disabledReason,
    className: "phase-review-chat",
    interactiveTopic: "revision",
    headerActionsHtml: `<button type="button" class="phase-chat-close" data-action="close-phase-action-chat" title="收起对话" aria-label="收起对话"><span aria-hidden="true">×</span></button>`,
    footerHtml
  });
}

function listItems(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return "<li>—</li>";
  return list.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function clip(text, max = 40) {
  const value = String(text || "").trim();
  if (value.length <= max) return value || "—";
  return `${value.slice(0, max - 1)}…`;
}

/** Prefer transition note that carries 时窗依据; fall back to generic relative-time hint. */
function describeTimeWindowHint(focus, inbound = [], outbound = []) {
  const notes = [...inbound, ...outbound].map((item) => String(item?.note || "")).filter(Boolean);
  const withBasis = notes.find((note) => /依据|总窗口|时点/.test(note));
  if (withBasis) return withBasis;
  if (focus?.timeWindow) return "相对研究时序（T+），按时职能加权；详见相邻转换说明。";
  return "时窗待补；重生成后将按简报总窗口与阶段职能分配。";
}
