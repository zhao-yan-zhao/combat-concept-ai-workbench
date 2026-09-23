/**
 * 时序校验（ov6c）：序列列表 + 甘特时间线 + 属性侧栏 + AI 对话。
 * 研究数据仍以 sequences 为源；UML/Mermaid 作为可选文本视图。
 */
import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderProjectStorageActions } from "./projectStorageView.js";
import {
  formatSequenceClock,
  layoutSequenceGantt,
  listActivityCandidates,
  listStableReferenceCandidates,
  resolveOv6cSelectedSequenceId
} from "./ov6Workbench.js";
import {
  SEQUENCE_DIAGRAM_ENGINES,
  dslForEngine,
  resolveSequenceDiagramEngine,
  sequenceToMermaid,
  sequenceToJsSequence,
  sequenceToPlantUml
} from "./sequenceDiagramDsl.js";
import { renderResearchChatDock, renderResearchChatPanel } from "./researchChat/index.js";
import { renderToolboxFloatButton, renderToolboxRail } from "./toolbox/index.js";

const MESSAGE_TYPES = ["message", "response", "status", "exception", "timeout"];
const SEQUENCE_TYPES = [
  { id: "general", label: "通用时序图" },
  { id: "phase", label: "阶段时序图" },
  { id: "task", label: "任务时序图" },
  { id: "force", label: "兵力作战时序图" }
];

export function renderOv6c(state = {}) {
  const resolved = resolveDodafProduct(state, "ov6c");
  const model = resolved.model || { sequences: [], events: [], diagnostics: [] };
  const storage = state.ov6cStorage || null;
  const sequences = Array.isArray(model.sequences) ? model.sequences : [];
  const selectedId = resolveOv6cSelectedSequenceId(state, sequences);
  const selected = sequences.find((item) => item.id === selectedId) || null;
  const selectedMessageId = String(state.ov6cSelectedMessageId || "");
  const selectedMessage = selected
    ? (selected.messages || []).find((item) => item.id === selectedMessageId) || null
    : null;
  const engine = resolveSequenceDiagramEngine(state.ov6cDiagramEngine || "workbench");
  const activities = listActivityCandidates(state);
  const referenceCandidates = listStableReferenceCandidates(state);
  const chatOpen = Boolean(state.sequenceChatOpen);
  const chatGenerating = Boolean(state.sequenceChatGenerating);
  const editorOpen = Boolean(state.ov6cEditorOpen);
  const toolsOpen = state.ov6cToolsOpen === true;
  const eventCount = Array.isArray(model.events) ? model.events.length : sequences.reduce((sum, seq) => sum + (seq.messages?.length || 0), 0);
  const reviewCount = (model.diagnostics || []).filter((item) => item.state === "review").length;

  return `<section class="seq-page ${chatOpen ? "is-chat-open" : "is-chat-collapsed"}" data-view-page="sequence" data-dodaf-product="OV-6c">
    <header class="seq-top">
      <div class="seq-bar">
        <div class="seq-identity">
          <h2>时序校验</h2>
          <small class="seq-summary">${resolved.source === "persisted" ? "已持久化" : "本地/种子"} · v${model.version || 2} · ${sequences.length} 幅 · ${eventCount} 条${reviewCount ? ` · <span class="is-review">${reviewCount} 项待复核</span>` : ""}</small>
        </div>
        <div class="seq-toolbar">
          ${storage ? renderProjectStorageActions(storage, { refreshAction: "refresh-project-ov6c" }) : ""}
          <button type="button" class="quiet-button" data-action="ov6c-seed-phase" title="按阶段/兵力生成协同时序（仅空库时）">按阶段生成</button>
          ${sequences.length ? `<button type="button" class="quiet-button danger-quiet" data-action="ov6c-clear-all" title="清空全部时序图">清空全部</button>` : ""}
          <button type="button" class="primary-btn" data-action="save-dodaf-ov6c">保存</button>
          <button type="button" class="quiet-button" data-action="advance-workflow">下一步</button>
        </div>
      </div>
    </header>

    ${sequences.length
    ? `<div class="seq-workbench ${toolsOpen ? "is-tools-docked" : "is-tools-floating"} ${editorOpen ? "is-editor-open" : ""} ${chatOpen ? "is-chat-open" : "is-chat-collapsed"}" aria-label="时序研究台">
        <aside class="seq-list-panel" aria-label="时序图列表" data-grouped-list-panel="ov6c" data-grouped-list-dimensions="图类型:type|状态:status" data-grouped-list-default-group="type">
          <header class="seq-panel-head">
            <strong>时序图</strong>
            <small>${sequences.length} 幅 · 甘特时间线</small>
          </header>
          <div class="seq-sequence-list" role="listbox" aria-label="时序图" data-grouped-list-items>
            ${sequences.map((sequence) => renderSequenceListItem(sequence, selectedId)).join("")}
          </div>
          <div class="seq-list-footer">
            <button type="button" class="quiet-button" data-action="ov6c-add-sequence">＋ 新增</button>
            ${selected ? `<button type="button" class="quiet-button" data-action="ov6c-remove-sequence" data-sequence-id="${escapeHtml(selected.id)}">删除当前</button>` : ""}
          </div>
        </aside>

        <div class="seq-main-panel">
          ${selected
    ? renderSequenceEditor(selected, {
      engine,
      selectedMessageId
    })
    : `<div class="seq-empty-editor"><p>请选择左侧时序图</p></div>`}
        </div>

        ${renderSequencePropertyDock(selected, {
          selectedMessageId,
          selectedMessage,
          activities,
          referenceCandidates,
          editorOpen
        })}

        ${renderResearchChatDock({
          scope: "seq",
          open: chatOpen,
          dockId: "sequenceChatDock",
          label: "时序对话侧栏",
          contentHtml: renderSequenceChatPanel({
            chat: state.sequenceChat,
            chatGenerating,
            model
          })
        })}
        ${toolsOpen ? renderSequenceToolboxRail({ editorOpen, chatOpen, chatGenerating, sequenceId: selectedId }) : ""}
      </div>`
    : renderEmptyWorkbench({ toolsOpen, chatOpen, chatGenerating, chat: state.sequenceChat, model })}

    ${(model.diagnostics || []).length
    ? `<section class="seq-diagnostics" aria-label="时序诊断">
        <details>
          <summary>产品诊断 · ${(model.diagnostics || []).length} 项</summary>
          <div class="seq-diagnostic-list">${(model.diagnostics || []).map((item) => `
            <div class="seq-diagnostic ${escapeHtml(item.state || "")}">
              <strong>${escapeHtml(item.label || "")}</strong>
              <span>${escapeHtml(item.statusLabel || item.state || "")}</span>
              <p>${escapeHtml(item.detail || "")}</p>
            </div>`).join("")}
          </div>
        </details>
      </section>`
    : ""}
  </section>`;
}

/** Topbar floating FAB — same host as rule-library / phase-action. */
export function renderSequenceToolboxFloatButton({ toolsOpen = false } = {}) {
  return renderToolboxFloatButton({
    scope: "ov6c",
    open: toolsOpen,
    action: "toggle-ov6c-tools",
    className: "ov1-edit-rail-brand is-topbar-float seq-toolbox-float"
  });
}

export const renderSequenceChatFloatButton = renderSequenceToolboxFloatButton;

function renderSequenceToolboxRail({ editorOpen = false, chatOpen = false, chatGenerating = false, sequenceId = "" } = {}) {
  const sequenceAttrs = sequenceId ? { "data-sequence-id": sequenceId } : {};
  return renderToolboxRail({
    scope: "ov6c",
    open: true,
    label: "时序工具箱",
    navLabel: "时序工具",
    className: "sm-edit-rail seq-edit-rail",
    navClassName: "seq-edit-rail-nav",
    toggleAction: "toggle-ov6c-tools",
    items: [
      { action: "ov6c-toggle-editor", title: "消息 / 参与方属性", icon: "states", active: editorOpen, pressed: editorOpen },
      { action: "toggle-sequence-chat", title: chatOpen ? "收起 AI 对话" : "打开 AI 对话", icon: "chat", active: chatOpen, attention: chatGenerating, pressed: chatOpen },
      "sep",
      { action: "ov6c-add-participant", title: "添加参与方", icon: "plus", attrs: sequenceAttrs, disabled: !sequenceId },
      { action: "ov6c-add-message", title: "添加消息", icon: "transition", attrs: sequenceAttrs, disabled: !sequenceId },
      { action: "ov6c-remove-sequence", title: "删除当前时序图", icon: "trash", className: "is-danger", attrs: sequenceAttrs, disabled: !sequenceId }
    ]
  });
}

function renderEmptyWorkbench({ toolsOpen, chatOpen, chatGenerating, chat, model }) {
  return `<div class="seq-workbench is-empty ${toolsOpen ? "is-tools-docked" : "is-tools-floating"} ${chatOpen ? "is-chat-open" : "is-chat-collapsed"}">
    <div class="seq-empty-board">
      <strong>尚无时序图</strong>
      <p>以消息为时间条、按抽象作战时间展开。可按阶段生成，或对话起草。</p>
      <div class="seq-empty-actions">
        <button type="button" class="primary-btn" data-action="ov6c-seed-phase">按阶段生成</button>
        <button type="button" class="quiet-button" data-action="ov6c-add-sequence">空白时序图</button>
        <button type="button" class="quiet-button" data-action="open-sequence-chat">打开时序对话</button>
      </div>
    </div>
    ${renderResearchChatDock({
      scope: "seq",
      open: chatOpen,
      dockId: "sequenceChatDock",
      label: "时序对话侧栏",
      contentHtml: renderSequenceChatPanel({ chat, chatGenerating, model })
    })}
    ${toolsOpen ? renderSequenceToolboxRail({ chatOpen, chatGenerating }) : ""}
  </div>`;
}

function renderSequenceListItem(sequence, selectedId) {
  const selected = sequence.id === selectedId;
  const messages = sequence.messages || [];
  const participants = sequence.participants || [];
  const unlinked = messages.filter((item) => !(item.relatedActivityRefs || []).length).length;
  const typeLabel = sequenceTypeLabel(sequence.diagramType);
  const statusLabel = messages.length && !unlinked ? "已回链" : unlinked ? "待回链" : "待补充";
  return `<button type="button" class="seq-list-item ${selected ? "is-selected" : ""}" role="option" aria-selected="${selected ? "true" : "false"}" data-action="ov6c-select-sequence" data-sequence-id="${escapeHtml(sequence.id)}" data-grouped-list-item data-group-type="${escapeHtml(typeLabel)}" data-group-status="${statusLabel}" data-search="${escapeHtml([sequence.id, sequence.name, typeLabel, ...participants.map((item) => item.name || item.label || item.id)].filter(Boolean).join(" "))}">
    <strong>${escapeHtml(sequence.name || sequence.id)}</strong>
    <small>${typeLabel} · ${participants.length} 参与方 · ${messages.length} 消息${unlinked ? ` · ${unlinked} 未回链` : ""}</small>
  </button>`;
}

function renderSequenceEditor(sequence, { engine, selectedMessageId }) {
  const participants = sequence.participants || [];
  const messages = [...(sequence.messages || [])].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const mermaid = sequenceToMermaid(sequence);
  const jsSeq = sequenceToJsSequence(sequence);
  const plantuml = sequenceToPlantUml(sequence);
  const activeDsl = dslForEngine(sequence, engine);
  const showEngineTools = engine === "mermaid" || engine === "js-sequence";
  const layout = layoutSequenceGantt(sequence);

  return `<article class="seq-editor" data-sequence-id="${escapeHtml(sequence.id)}" aria-label="时序编辑">
    <header class="seq-editor-head">
      <div class="seq-editor-title">
        <label class="seq-name-field">
          <span class="visually-hidden">时序图名称</span>
          <input data-dodaf-field="ov6c.sequence.${escapeHtml(sequence.id)}.name" value="${escapeHtml(sequence.name || "")}" maxlength="120" />
        </label>
        <small class="muted">${participants.length} 生命线 · ${messages.length} 消息 · ${formatSequenceClock(layout.totalMinutes)} 窗口</small>
      </div>
      <label class="seq-type-field">
        <span class="visually-hidden">时序图类型</span>
        <select data-action="ov6c-sequence-field" data-field="diagramType" data-sequence-id="${escapeHtml(sequence.id)}" title="选择时序图语义类型">
          ${SEQUENCE_TYPES.map((type) => `<option value="${type.id}" ${type.id === (sequence.diagramType || "general") ? "selected" : ""}>${type.label}</option>`).join("")}
        </select>
      </label>
      <div class="seq-engine-tabs" role="tablist" aria-label="时序图视图">
        ${SEQUENCE_DIAGRAM_ENGINES.map((item) => `
          <button type="button" role="tab" class="seq-engine-tab ${engine === item.id ? "is-active" : ""}" aria-selected="${engine === item.id ? "true" : "false"}" data-action="ov6c-set-engine" data-engine="${escapeHtml(item.id)}" title="${escapeHtml(item.hint)}">${escapeHtml(item.label)}</button>
        `).join("")}
      </div>
    </header>

    <section class="seq-canvas-panel" aria-label="时序时间线">
      <header class="seq-canvas-head">
        <div>
          <strong>${escapeHtml(sequence.name || "作战时间线")} — 甘特图</strong>
          <small>点时间条选中 · 在条上改名称 · 右侧改起止、参与方与回链</small>
        </div>
      </header>
      <div class="seq-canvas-frame">
        ${renderGanttCanvas(sequence, { selectedMessageId, layout })}
      </div>
    </section>

    ${showEngineTools
    ? `<details class="seq-engine-tools is-compact">
        <summary>${engine === "js-sequence" ? "UML 预览与文本" : "Mermaid 预览与文本"} · 主编辑在时间线</summary>
        ${renderEditableEnginePane(sequence, engine, {
          mermaid,
          jsSeq,
          plantuml,
          activeDsl,
          compact: true
        })}
      </details>`
    : `<details class="seq-dsl-panel is-compact seq-export-only">
        <summary>导出 DSL（Mermaid / UML / PlantUML）</summary>
        <div class="seq-dsl-grid">
          <div><header>Mermaid</header><pre data-sequence-dsl="${escapeHtml(sequence.id)}" data-engine="mermaid">${escapeHtml(mermaid)}</pre></div>
          <div><header>UML</header><pre data-sequence-dsl="${escapeHtml(sequence.id)}" data-engine="js-sequence">${escapeHtml(jsSeq)}</pre></div>
          <div><header>PlantUML</header><pre data-sequence-dsl="${escapeHtml(sequence.id)}" data-engine="plantuml">${escapeHtml(plantuml)}</pre></div>
        </div>
      </details>`}
  </article>`;
}

function renderParticipantInspector(sequence, participants, referenceCandidates = []) {
  return `<section class="seq-participant-panel" aria-label="参与方信息">
    <header class="seq-panel-head">
      <strong>参与方</strong>
      <small>${participants.length} 个</small>
    </header>
    <div class="seq-participant-list">
      ${participants.map((participant) => `<div class="seq-participant-item" data-participant-id="${escapeHtml(participant.id)}">
      <label class="seq-field">
        <span>名称</span>
        <input
          data-action="ov6c-participant-field"
          data-field="name"
          data-sequence-id="${escapeHtml(sequence.id)}"
          data-participant-id="${escapeHtml(participant.id)}"
          value="${escapeHtml(participant.name || participant.id)}"
          maxlength="80"
          placeholder="参与方名称"
        />
      </label>
      <label class="seq-field">
        <span>对象引用</span>
        <select
          data-action="ov6c-participant-field"
          data-field="ref"
          data-sequence-id="${escapeHtml(sequence.id)}"
          data-participant-id="${escapeHtml(participant.id)}"
          title="选择阶段、任务或兵力的稳定引用"
        >${renderParticipantReferenceOptions(participant, referenceCandidates)}</select>
      </label>
      <button type="button" class="seq-participant-remove" data-action="ov6c-remove-participant" data-sequence-id="${escapeHtml(sequence.id)}" data-participant-id="${escapeHtml(participant.id)}" title="删除参与方" aria-label="删除参与方">×</button>
    </div>`).join("") || `<p class="seq-message-empty">尚无参与方</p>`}
    </div>
  </section>`;
}

function renderParticipantReferenceOptions(participant, candidates = []) {
  const groups = [["phase", "阶段"], ["task", "任务"], ["force", "兵力"]];
  const currentRef = String(participant.ref || "");
  const currentType = String(participant.refType || "");
  const hasCurrent = candidates.some((item) => item.ref === currentRef && item.refType === currentType);
  const options = [`<option value="" data-ref-type="" ${currentRef ? "" : "selected"}>不关联对象</option>`];
  if (currentRef && !hasCurrent) options.push(`<option value="${escapeHtml(currentRef)}" data-ref-type="${escapeHtml(currentType)}" selected>引用失效：${escapeHtml(currentRef)}</option>`);
  groups.forEach(([type, label]) => {
    const items = candidates.filter((item) => item.refType === type);
    if (!items.length) return;
    options.push(`<optgroup label="${label}">${items.map((item) => `<option value="${escapeHtml(item.ref)}" data-ref-type="${type}" ${item.ref === currentRef && type === currentType ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</optgroup>`);
  });
  return options.join("");
}

function sequenceTypeLabel(value) {
  return SEQUENCE_TYPES.find((type) => type.id === value)?.label || SEQUENCE_TYPES[0].label;
}

function renderGanttCanvas(sequence, { selectedMessageId, layout }) {
  const span = layout.span || 1;
  const percent = (minutes) => ((Number(minutes) - layout.minStart) / span) * 100;
  const gridLines = layout.ticks.map((tick) =>
    `<i class="seq-gantt-gridline" style="left:${percent(tick).toFixed(3)}%"></i>`).join("");
  const topMarks = layout.rows.slice(0, 8).map((row) => `
    <span class="seq-gantt-mark" style="left:${percent(row.start).toFixed(3)}%">
      <em>${formatSequenceClock(row.start)}</em>
      <small>${escapeHtml(row.message.name || row.message.title || "")}</small>
    </span>`).join("");

  const rows = layout.rows.map((row) => {
    const message = row.message;
    const selected = message.id === selectedMessageId;
    const left = Math.max(0, Math.min(100, percent(row.start)));
    const width = row.instant ? 0 : Math.max(1.4, percent(row.end) - percent(row.start));
    const clock = row.instant
      ? formatSequenceClock(row.start)
      : `${formatSequenceClock(row.start)}~${formatSequenceClock(row.end)}`;
    const overlaps = layout.rows.some((other) => other.id !== row.id && row.duration > 0 && other.duration > 0 && row.start < other.end && row.end > other.start);
    const unlinked = !(message.relatedActivityRefs || []).length;
    return `<div class="seq-gantt-row ${selected ? "is-selected" : ""} ${overlaps ? "has-conflict" : ""}" data-message-id="${escapeHtml(message.id)}">
      <button type="button" class="seq-gantt-label" data-action="ov6c-select-message" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" title="${escapeHtml(message.name || "")}">
        <span>${escapeHtml(message.name || message.title || `消息 ${row.index + 1}`)}</span>
        ${overlaps ? `<i class="seq-row-flag is-conflict" title="与其他消息时间重叠">冲突</i>` : ""}
        ${unlinked ? `<i class="seq-row-flag is-unlinked" title="尚未回链阶段或活动">未回链</i>` : ""}
      </button>
      <div class="seq-gantt-track">
        ${gridLines}
        <div class="seq-gantt-bar ${row.instant ? "is-instant" : ""} is-${escapeHtml(row.type)} ${selected ? "is-selected" : ""}"
          style="left:${left.toFixed(3)}%;width:${row.instant ? "0" : `${width.toFixed(3)}%`};--bar:${row.color}"
          data-action="ov6c-select-message"
          data-sequence-id="${escapeHtml(sequence.id)}"
          data-message-id="${escapeHtml(message.id)}"
          role="button"
          tabindex="0">
          <span class="seq-message-seq">${message.sequence || row.index + 1}</span>
          <input
            class="seq-message-name-input"
            data-action="ov6c-message-field"
            data-field="name"
            data-sequence-id="${escapeHtml(sequence.id)}"
            data-message-id="${escapeHtml(message.id)}"
            value="${escapeHtml(message.name || message.title || "")}"
            maxlength="120"
            title="直接修改消息名称"
            placeholder="消息名称"
          />
          <span class="seq-gantt-clock">${clock}</span>
          ${selected ? `<span class="seq-gantt-quick-tools" aria-label="时间条快捷操作">
            <button type="button" data-action="ov6c-adjust-message-time" data-field="offsetMinutes" data-delta="-5" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" title="前移 5 分钟">←</button>
            <button type="button" data-action="ov6c-adjust-message-time" data-field="offsetMinutes" data-delta="5" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" title="后移 5 分钟">→</button>
            <button type="button" data-action="ov6c-adjust-message-time" data-field="durationMinutes" data-delta="-5" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" title="缩短 5 分钟">−</button>
            <button type="button" data-action="ov6c-adjust-message-time" data-field="durationMinutes" data-delta="5" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" title="延长 5 分钟">＋</button>
          </span>` : ""}
        </div>
      </div>
    </div>`;
  }).join("");

  return `<div class="ov6c-canvas seq-workbench-canvas seq-gantt is-interactive" data-seq-canvas data-sequence-id="${escapeHtml(sequence.id)}">
    <div class="seq-gantt-ruler">
      <div class="seq-gantt-corner">任务 / 消息</div>
      <div class="seq-gantt-scale">
        ${gridLines}
        ${topMarks}
      </div>
    </div>
    <div class="seq-gantt-body">
      ${rows || `<div class="ov6c-message-empty muted">尚无消息。点「加消息」，再在右侧设置起点和终点。</div>`}
    </div>
    <div class="seq-gantt-axis">
      <div class="seq-gantt-corner">作战时间</div>
      <div class="seq-gantt-scale">
        ${layout.ticks.map((tick) => `<span class="seq-gantt-tick" style="left:${percent(tick).toFixed(3)}%">${formatSequenceClock(tick)}</span>`).join("")}
      </div>
    </div>
  </div>`;
}

function renderSequencePropertyDock(sequence, { selectedMessageId, selectedMessage, activities, referenceCandidates, editorOpen } = {}) {
  if (!sequence || !editorOpen) {
    return `<aside class="seq-editor-dock is-collapsed" id="sequenceEditorDock" aria-hidden="true" aria-label="消息属性"></aside>`;
  }
  const participants = sequence.participants || [];
  const messages = [...(sequence.messages || [])].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const message = selectedMessage || messages.find((item) => item.id === selectedMessageId) || null;
  const hint = message ? "已选消息" : "点时间条编辑";
  return `<aside class="seq-editor-dock is-open" id="sequenceEditorDock" aria-hidden="false" aria-label="消息属性">
    <header class="seq-editor-dock-head">
      <div>
        <strong>消息 / 参与方</strong>
        <small>${escapeHtml(hint)}</small>
      </div>
      <button type="button" class="seq-editor-dock-close" data-action="ov6c-close-editor" title="收起属性" aria-label="收起属性">×</button>
    </header>
    <div class="seq-editor-lower">
      ${renderParticipantInspector(sequence, participants, referenceCandidates)}
      ${message ? renderMessageInspector(sequence, message, participants, activities) : `<p class="seq-inspector-hint">点时间线上的一条消息，编辑起止、方向与回链。</p>`}
      <section class="seq-message-list-panel" aria-label="消息清单">
        <header class="seq-panel-head">
          <strong>消息</strong>
          <small>${messages.length} 条</small>
        </header>
        <div class="seq-message-strip">
          ${messages.map((item) => `<button type="button" class="seq-message-chip ${item.id === selectedMessageId ? "is-selected" : ""} ${!(item.relatedActivityRefs || []).length ? "is-unlinked" : ""}" data-action="ov6c-select-message" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(item.id)}">
            <strong><span class="seq-message-chip-seq">${item.sequence || ""}</span> ${escapeHtml(item.name || item.title || item.id)}</strong>
            <small>${escapeHtml(participantName(participants, item.fromRef))} → ${escapeHtml(participantName(participants, item.toRef))}</small>
          </button>`).join("") || `<p class="seq-message-empty">尚无消息</p>`}
        </div>
      </section>
    </div>
  </aside>`;
}

function renderMessageInspector(sequence, message, participants, activities) {
  const fromOptions = participants.map((item) =>
    `<option value="${escapeHtml(item.id)}" ${item.id === message.fromRef ? "selected" : ""}>${escapeHtml(item.name || item.id)}</option>`).join("");
  const toOptions = participants.map((item) =>
    `<option value="${escapeHtml(item.id)}" ${item.id === message.toRef ? "selected" : ""}>${escapeHtml(item.name || item.id)}</option>`).join("");
  const typeOptions = MESSAGE_TYPES.map((type) =>
    `<option value="${type}" ${message.type === type ? "selected" : ""}>${typeLabel(type)}</option>`).join("");
  const activityOptions = [
    `<option value="">无回链</option>`,
    ...activities.slice(0, 40).map((item) =>
      `<option value="${escapeHtml(item.id)}" ${(message.relatedActivityRefs || [])[0] === item.id ? "selected" : ""}>${escapeHtml(item.title)}</option>`)
  ].join("");
  const start = Number.isFinite(Number(message.offsetMinutes)) ? Number(message.offsetMinutes) : "";
  const duration = Number.isFinite(Number(message.durationMinutes)) ? Number(message.durationMinutes) : "";

  return `<section class="seq-message-form-panel" aria-label="选中消息">
    <label class="seq-field"><span>名称</span>
      <input class="seq-message-name-input" data-action="ov6c-message-field" data-field="name" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" value="${escapeHtml(message.name || message.title || "")}" maxlength="120" />
    </label>
    <div class="seq-field-row">
      <label class="seq-field"><span>类型</span>
        <select class="seq-message-type-select" data-action="ov6c-message-field" data-field="type" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}">${typeOptions}</select>
      </label>
      <label class="seq-field"><span>开始(分)</span>
        <input type="number" min="0" step="1" data-action="ov6c-message-field" data-field="offsetMinutes" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" value="${escapeHtml(start)}" />
      </label>
      <label class="seq-field"><span>持续(分)</span>
        <input type="number" min="0" step="1" data-action="ov6c-message-field" data-field="durationMinutes" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" value="${escapeHtml(duration)}" />
      </label>
    </div>
    <div class="seq-field-row">
      <label class="seq-field"><span>从</span>
        <select data-action="ov6c-message-field" data-field="fromRef" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}">${fromOptions}</select>
      </label>
      <label class="seq-field"><span>到</span>
        <select data-action="ov6c-message-field" data-field="toRef" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}">${toOptions}</select>
      </label>
    </div>
    <label class="seq-field"><span>条件</span>
      <input data-action="ov6c-message-field" data-field="condition" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" value="${escapeHtml(message.condition || "")}" maxlength="200" placeholder="触发条件" />
    </label>
    <label class="seq-field"><span>回链活动</span>
      <select data-action="ov6c-message-field" data-field="activity" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}">${activityOptions}</select>
    </label>
    <div class="seq-message-tools">
      <button type="button" class="seq-icon-btn" data-action="ov6c-move-message" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" data-delta="-1" title="上移">↑</button>
      <button type="button" class="seq-icon-btn" data-action="ov6c-move-message" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" data-delta="1" title="下移">↓</button>
      <button type="button" class="seq-icon-btn" data-action="ov6c-reverse-message" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" title="反转方向">⇄</button>
      <button type="button" class="seq-icon-btn" data-action="ov6c-duplicate-message" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" title="复制消息">⧉</button>
      <button type="button" class="seq-icon-btn is-danger" data-action="ov6c-remove-message" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" title="删除">×</button>
    </div>
  </section>`;
}

function renderEditableEnginePane(sequence, engine, { mermaid, jsSeq, plantuml, activeDsl, compact = false }) {
  const isUml = engine === "js-sequence";
  const editorLabel = isUml ? "UML 文本（可选）" : "Mermaid 文本（可选）";
  const editorValue = isUml ? jsSeq : mermaid;
  const syntaxHint = isUml
    ? "语法：participant 指挥 as cmd · cmd->force: 态势上报 · cmd-->force: 回执"
    : "语法：sequenceDiagram · participant cmd as 指挥 · cmd->>force: 态势上报";

  return `<div class="seq-engine-edit is-secondary" data-sequence-id="${escapeHtml(sequence.id)}" data-engine="${escapeHtml(engine)}">
      <div class="seq-dsl-editor-pane">
        <header class="seq-dsl-editor-head">
          <strong>${editorLabel}</strong>
          <div class="seq-dsl-editor-actions">
            <button type="button" class="primary-btn compact" data-action="ov6c-apply-dsl" data-sequence-id="${escapeHtml(sequence.id)}" data-engine="${escapeHtml(engine)}">应用到模型</button>
          </div>
        </header>
        <label class="visually-hidden" for="seq-dsl-editor-${escapeHtml(sequence.id)}">时序 DSL</label>
        <textarea
          id="seq-dsl-editor-${escapeHtml(sequence.id)}"
          class="seq-dsl-editor"
          data-seq-dsl-editor
          data-sequence-id="${escapeHtml(sequence.id)}"
          data-engine="${escapeHtml(engine)}"
          spellcheck="false"
          rows="${compact ? 8 : 12}">${escapeHtml(editorValue)}</textarea>
        <p class="muted seq-dsl-hint">${escapeHtml(syntaxHint)} · Ctrl+Enter 应用</p>
      </div>
      <div class="seq-diagram-host" data-sequence-diagram-host data-sequence-id="${escapeHtml(sequence.id)}" data-engine="${escapeHtml(engine)}" data-dsl-source="editor"></div>
      <script type="application/json" class="seq-dsl-payload" hidden data-sequence-dsl="${escapeHtml(sequence.id)}" data-engine="${escapeHtml(engine)}">${escapeHtml(activeDsl)}</script>
    </div>`;
}

function renderSequenceChatPanel({ chat, chatGenerating, model }) {
  const sequences = model?.sequences || [];
  const messages = model?.events || [];
  const footerHtml = `<div class="phase-review-chat-footer seq-review-chat-footer">
        <button type="button" data-action="save-dodaf-ov6c" ${chatGenerating ? "disabled" : ""}>保存时序</button>
        <p class="planning-meta">时序图 ${sequences.length} · 消息 ${messages.length}</p>
      </div>`;
  return renderResearchChatPanel({
    scope: "sequence",
    session: chat,
    generating: chatGenerating,
    title: "时序对话",
    subtitle: "自然语言起草/修订参与方与消息链，时间线同步更新。",
    statusLabel: chatGenerating ? "正在修订" : "研究助手",
    placeholder: "例如：按阶段生成协同时序；补充指挥→行动单元态势上报",
    emptyTitle: "开始时序对话",
    emptyText: "例如：按阶段生成；把第 2 条改成响应；给关键消息回链活动。",
    disabled: chatGenerating,
    className: "phase-review-chat seq-review-chat",
    interactiveTopic: "revision",
    headerActionsHtml: `<button type="button" class="phase-chat-close" data-action="close-sequence-chat" title="收起对话" aria-label="收起对话"><span aria-hidden="true">×</span></button>`,
    footerHtml
  });
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

function participantName(participants, id) {
  const hit = (participants || []).find((item) => item.id === id);
  return hit?.name || id || "?";
}

function typeLabel(type) {
  return ({
    message: "协同消息",
    response: "响应回执",
    status: "状态通报",
    exception: "异常/对抗",
    timeout: "超时窗口"
  })[type] || type;
}

function stateLabel(value, outOfOrder) {
  if (outOfOrder) return "顺序待复核";
  return ({ ready: "已映射", review: "来源待复核", pending: "待排程" })[value] || "待复核";
}

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
