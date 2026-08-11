import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderDerivedViewProvenance } from "./derivedViewProvenance.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { renderDodafLegend, renderEntityBadge } from "./dodafDraftingView.js";
import { listActivityCandidates } from "./ov6Workbench.js";
import { renderPhaseChainGuide } from "./phaseChainGuide.js";

export function renderOv6c(state) {
  const { model, source } = resolveDodafProduct(state, "ov6c");
  const storage = state.ov6cStorage || { status: "idle", mode: "local", label: "事件序列" };
  const unresolved = model.unresolved || { unscheduledNodeIds: [], orphanTimelineIds: [], outOfOrderIds: [] };
  const orderReviewCount = (unresolved.outOfOrderIds || []).length;
  const sequences = model.sequences || [];
  const events = model.events || [];
  const activities = listActivityCandidates(state);

  const sequencePanels = sequences.length
    ? sequences.map((sequence) => renderSequencePanel(sequence, activities)).join("")
    : `<p class="empty-inspector">尚无时序图。可新增序列，以参与方为生命线、消息按时间向下排列。</p>`;

  return `
    <section class="surface surface-pad dodaf-drafting-surface ov6-workbench" data-dodaf-product="OV-6c">
      ${renderPhaseChainGuide(state, "ov6c")}
      <div class="section-heading"><div><h2>时序校验</h2><p>阶段行动链：参与方=生命线，消息向下排列；应回链阶段活动，再进结构反查。</p></div><span class="mini-tag">${source === "persisted" ? "已持久化" : "种子/草稿"} · v${model.version || 2}</span></div>
      ${renderDerivedViewProvenance("ov6c")}
      ${renderProjectStorageState(storage, { refreshAction: "refresh-project-ov6c" })}
      ${renderDodafLegend("OV-6c")}
      <div class="toolbar-row dodaf-product-actions">
        <button type="button" class="ghost-btn" data-action="seed-dodaf-ov6c">从研究循环/想定种子</button>
        <button type="button" class="ghost-btn" data-action="ov6c-add-sequence">新增时序图</button>
        <button type="button" class="primary-btn" data-action="save-dodaf-ov6c">保存事件序列</button>
      </div>
      <div class="ov2-summary">
        <span>${sequences.length} 幅时序图</span>
        <span>${events.length} 条消息</span>
        <span>${(unresolved.unscheduledNodeIds || []).length} 个未排程</span>
        <span>${orderReviewCount} 个顺序待复核</span>
      </div>
      <div class="ov6c-sequence-list">${sequencePanels}</div>
      <div class="ov3-table-wrap">
        <table class="ov3-table">
          <thead><tr><th>序</th><th>时序图</th><th>消息</th><th>类型</th><th>来源活动</th><th>状态</th></tr></thead>
          <tbody>${events.map((event) => `<tr class="${event.outOfOrder ? "ov6c-order-review" : ""}">
            <td>${event.sequence}</td>
            <td>${escapeHtml(event.sequenceName || event.sequenceId || "")}</td>
            <td>${renderEntityBadge({ dm2Type: "Event", label: event.title || event.name })}
              <label><span>名称</span><input data-dodaf-field="ov6c.event.${escapeHtml(event.id)}.title" value="${escapeHtml(event.title || event.name || "")}" /></label>
              <label><span>条件</span><input data-dodaf-field="ov6c.event.${escapeHtml(event.id)}.condition" value="${escapeHtml(event.condition || "")}" /></label>
            </td>
            <td>${escapeHtml(event.type || "message")}</td>
            <td>${escapeHtml((event.relatedActivityRefs || [event.sourceActivityId]).filter(Boolean).join("、") || "无来源")}</td>
            <td><span class="status-tag ${event.state === "ready" && !event.outOfOrder ? "" : "review"}">${stateLabel(event.state, event.outOfOrder)}</span></td>
          </tr>`).join("") || `<tr><td colspan="6" class="ov3-empty">尚无消息</td></tr>`}</tbody>
        </table>
      </div>
      <section class="ooda-diagnostics ov2-diagnostics"><h3>产品诊断</h3><div class="ooda-diagnostic-list">${(model.diagnostics || []).map((item) => `<div class="ooda-diagnostic ${escapeHtml(item.state)}"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.statusLabel || item.state)}</span><p>${escapeHtml(item.detail)}</p></div>`).join("")}</div></section>
    </section>
  `;
}

function renderSequencePanel(sequence, activities) {
  const participants = sequence.participants || [];
  const messages = [...(sequence.messages || [])].sort((a, b) => a.sequence - b.sequence);
  const count = Math.max(participants.length, 1);
  const lifelineHeads = participants.map((participant) => `
    <div class="ov6c-lifeline-head" title="${escapeHtml(participant.ref || "")}">
      <strong>${escapeHtml(participant.name || participant.id)}</strong>
      <small>${escapeHtml(participant.ref || "无对象引用")}</small>
    </div>`).join("") || `<div class="ov6c-lifeline-head"><strong>参与方</strong></div>`;

  const lanes = participants.map(() => `<div class="ov6c-lifeline-lane"><i></i></div>`).join("")
    || `<div class="ov6c-lifeline-lane"><i></i></div>`;

  const messageRows = messages.map((message) => {
    const fromIndex = Math.max(0, participants.findIndex((item) => item.id === message.fromRef));
    const toIndex = Math.max(0, participants.findIndex((item) => item.id === message.toRef));
    const left = Math.min(fromIndex, toIndex);
    const right = Math.max(fromIndex, toIndex);
    const span = Math.max(right - left, 1);
    const direction = fromIndex <= toIndex ? "forward" : "backward";
    const activityLabel = (message.relatedActivityRefs || []).join("、") || "无活动回链";
    return `<div class="ov6c-message-row" style="--from:${fromIndex};--to:${toIndex};--left:${left};--span:${span};--cols:${count}">
      <div class="ov6c-message-slot" style="grid-column: ${left + 1} / span ${span + 1}">
        <div class="ov6c-message-arrow is-${direction}" title="${escapeHtml(message.condition || "")}">
          <span class="ov6c-message-seq">${message.sequence}</span>
          <strong>${escapeHtml(message.name || message.title || message.id)}</strong>
          <em>${escapeHtml(message.type || "message")}</em>
        </div>
        <small class="muted">${escapeHtml(activityLabel)}${message.condition ? ` · ${escapeHtml(message.condition)}` : ""}</small>
      </div>
    </div>`;
  }).join("") || `<div class="ov6c-message-empty muted">尚无消息，点击「加消息」</div>`;

  const activityOptions = activities.slice(0, 40).map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`).join("");

  return `<section class="ov6c-sequence-card" data-sequence-id="${escapeHtml(sequence.id)}">
    <header class="ov6c-sequence-head">
      <div>
        <strong>${escapeHtml(sequence.name || sequence.id)}</strong>
        <span class="muted">${participants.length} 生命线 · ${messages.length} 消息 · ${(sequence.fragments || []).length} 片段</span>
      </div>
      <div class="ov6-machine-actions">
        <button type="button" class="ghost-btn compact" data-action="ov6c-add-participant" data-sequence-id="${escapeHtml(sequence.id)}">加参与方</button>
        <button type="button" class="ghost-btn compact" data-action="ov6c-add-message" data-sequence-id="${escapeHtml(sequence.id)}">加消息</button>
        <button type="button" class="ghost-btn compact" data-action="ov6c-remove-sequence" data-sequence-id="${escapeHtml(sequence.id)}">删除序列</button>
      </div>
    </header>
    <div class="ov6c-canvas" style="--cols:${count}">
      <div class="ov6c-lifeline-heads" style="grid-template-columns: repeat(${count}, minmax(96px, 1fr))">${lifelineHeads}</div>
      <div class="ov6c-lifeline-body">
        <div class="ov6c-lifeline-lanes" style="grid-template-columns: repeat(${count}, minmax(96px, 1fr))">${lanes}</div>
        <div class="ov6c-message-layer">${messageRows}</div>
      </div>
    </div>
    ${activityOptions ? `<p class="muted ov6c-hint">消息可通过表格编辑名称/条件；回链活动在规范化时保留 relatedActivityRefs。可选活动：${activities.slice(0, 6).map((item) => escapeHtml(item.title)).join("、")}${activities.length > 6 ? "…" : ""}</p>` : ""}
  </section>`;
}

export function selectionForOv6cEvent(eventId, models) {
  const { model } = resolveDodafProduct(models, "ov6c");
  const event = (model.events || []).find((item) => item.id === eventId);
  if (!event) return null;
  return {
    id: event.id,
    kind: "ov6c-event",
    title: event.title || event.name,
    status: "事件消息",
    text: "研究级时序消息，可回链活动与规则。",
    facts: [
      ["序列", event.sequence],
      ["类型", event.type || "message"],
      ["OODA 节点", event.sourceNodeId || "未映射"],
      ["来源活动", (event.relatedActivityRefs || [event.sourceActivityId]).filter(Boolean).join("、") || "未映射"],
      ["状态", stateLabel(event.state, event.outOfOrder)]
    ],
    refs: [...(event.relatedActivityRefs || []), event.sourceActivityId, event.sourceNodeId].filter(Boolean)
  };
}

function stateLabel(value, outOfOrder) {
  if (outOfOrder) return "顺序待复核";
  return ({ ready: "已映射", review: "来源待复核", pending: "待排程" })[value] || "待复核";
}

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
