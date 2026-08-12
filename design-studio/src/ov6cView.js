/**
 * 时序校验（ov6c）：序列列表 + 开源时序图引擎 + 消息属性 + AI 对话悬浮球。
 * 去掉与画布重复的全表事件清单；研究数据仍以 sequences 为源。
 */
import { resolveDodafProduct } from "./dodafProductStore.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { renderPhaseChainGuide } from "./phaseChainGuide.js";
import {
  listActivityCandidates,
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
import {
  renderResearchChatFloatButton,
  renderResearchChatPanel
} from "./researchChat/index.js";

const MESSAGE_TYPES = ["message", "response", "status", "exception", "timeout"];

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
  const chatOpen = Boolean(state.sequenceChatOpen);
  const chatGenerating = Boolean(state.sequenceChatGenerating);
  const connectFromId = String(state.ov6cConnectFromId || "");
  const eventCount = Array.isArray(model.events) ? model.events.length : sequences.reduce((sum, seq) => sum + (seq.messages?.length || 0), 0);
  const reviewCount = (model.diagnostics || []).filter((item) => item.state === "review").length;

  return `<section class="seq-page ${chatOpen ? "is-chat-open" : "is-chat-collapsed"}" data-view-page="sequence" data-dodaf-product="OV-6c">
    ${renderPhaseChainGuide(state, "ov6c")}

    <header class="seq-top">
      <div class="seq-bar">
        <div class="seq-identity">
          <h2>时序校验</h2>
          <span class="mini-tag">${resolved.source === "persisted" ? "已持久化" : "本地/种子"} · v${model.version || 2}</span>
          <span class="mini-tag">${sequences.length} 幅</span>
          <span class="mini-tag">${eventCount} 消息</span>
          ${reviewCount ? `<span class="mini-tag review">${reviewCount} 项待复核</span>` : ""}
          <small class="seq-hint">画布直接编辑 · 回链阶段活动 · 对话从右上角入口</small>
        </div>
        <div class="seq-toolbar">
          <button type="button" class="quiet-button" data-action="ov6c-seed-phase" title="按阶段/兵力生成协同时序（仅空库时）">按阶段生成</button>
          <button type="button" class="quiet-button" data-action="ov6c-add-sequence">新增时序图</button>
          <button type="button" class="primary-btn" data-action="save-dodaf-ov6c">保存</button>
          <button type="button" class="quiet-button" data-view="structure-review">下一步</button>
        </div>
      </div>
      ${storage ? `<div class="seq-storage">${renderProjectStorageState(storage, { refreshAction: "refresh-project-ov6c" })}</div>` : ""}
    </header>

    ${sequences.length
    ? `<div class="seq-workbench ${chatOpen ? "is-chat-open" : "is-chat-collapsed"}" aria-label="时序研究台">
        <aside class="seq-list-panel" aria-label="时序图列表">
          <header class="seq-panel-head">
            <strong>时序图</strong>
            <small>${sequences.length} 幅 · 生命线+消息</small>
          </header>
          <div class="seq-sequence-list" role="listbox" aria-label="时序图">
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
      selectedMessageId,
      selectedMessage,
      activities,
      connectFromId
    })
    : `<div class="seq-empty-editor"><p>请选择左侧时序图</p></div>`}
        </div>

        <aside class="seq-chat-dock ${chatOpen ? "is-open" : "is-collapsed"}" id="sequenceChatDock" aria-hidden="${chatOpen ? "false" : "true"}" aria-label="时序对话侧栏">
          ${chatOpen ? renderSequenceChatPanel({
            chat: state.sequenceChat,
            chatGenerating,
            model
          }) : ""}
        </aside>
      </div>`
    : renderEmptyWorkbench({ chatOpen, chatGenerating, chat: state.sequenceChat, model })}

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
export function renderSequenceChatFloatButton({ chatOpen = false, chatGenerating = false, disabled = false } = {}) {
  return renderResearchChatFloatButton({
    scope: "sequence",
    open: chatOpen,
    generating: chatGenerating,
    disabled,
    titleOpen: "收起时序对话",
    titleClosed: "打开时序对话",
    action: "toggle-sequence-chat"
  });
}

function renderEmptyWorkbench({ chatOpen, chatGenerating, chat, model }) {
  return `<div class="seq-workbench is-empty ${chatOpen ? "is-chat-open" : "is-chat-collapsed"}">
    <div class="seq-empty-board">
      <strong>尚无时序图</strong>
      <p>以参与方为生命线、消息按时间向下排列；应回链阶段活动。可按阶段生成，或对话起草。</p>
      <div class="seq-empty-actions">
        <button type="button" class="primary-btn" data-action="ov6c-seed-phase">按阶段生成</button>
        <button type="button" class="quiet-button" data-action="ov6c-add-sequence">空白时序图</button>
        <button type="button" class="quiet-button" data-action="open-sequence-chat">打开时序对话</button>
      </div>
    </div>
    <aside class="seq-chat-dock ${chatOpen ? "is-open" : "is-collapsed"}" id="sequenceChatDock" aria-hidden="${chatOpen ? "false" : "true"}">
      ${chatOpen ? renderSequenceChatPanel({ chat, chatGenerating, model }) : ""}
    </aside>
  </div>`;
}

function renderSequenceListItem(sequence, selectedId) {
  const selected = sequence.id === selectedId;
  const messages = sequence.messages || [];
  const participants = sequence.participants || [];
  const unlinked = messages.filter((item) => !(item.relatedActivityRefs || []).length).length;
  return `<button type="button" class="seq-list-item ${selected ? "is-selected" : ""}" role="option" aria-selected="${selected ? "true" : "false"}" data-action="ov6c-select-sequence" data-sequence-id="${escapeHtml(sequence.id)}">
    <strong>${escapeHtml(sequence.name || sequence.id)}</strong>
    <small>${participants.length} 生命线 · ${messages.length} 消息${unlinked ? ` · ${unlinked} 未回链` : ""}</small>
  </button>`;
}

function renderSequenceEditor(sequence, { engine, selectedMessageId, selectedMessage, activities, connectFromId = "" }) {
  const participants = sequence.participants || [];
  const messages = [...(sequence.messages || [])].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const mermaid = sequenceToMermaid(sequence);
  const jsSeq = sequenceToJsSequence(sequence);
  const plantuml = sequenceToPlantUml(sequence);
  const activeDsl = dslForEngine(sequence, engine);
  const showEngineTools = engine === "mermaid" || engine === "js-sequence";

  return `<div class="seq-editor" data-sequence-id="${escapeHtml(sequence.id)}">
    <header class="seq-editor-head">
      <div class="seq-editor-title">
        <label class="seq-name-field">
          <span class="visually-hidden">时序图名称</span>
          <input data-dodaf-field="ov6c.sequence.${escapeHtml(sequence.id)}.name" value="${escapeHtml(sequence.name || "")}" maxlength="120" />
        </label>
        <small class="muted">${participants.length} 生命线 · ${messages.length} 消息 · 画布直接编辑</small>
      </div>
      <div class="seq-engine-tabs" role="tablist" aria-label="时序图视图">
        ${SEQUENCE_DIAGRAM_ENGINES.map((item) => `
          <button type="button" role="tab" class="seq-engine-tab ${engine === item.id ? "is-active" : ""}" aria-selected="${engine === item.id ? "true" : "false"}" data-action="ov6c-set-engine" data-engine="${escapeHtml(item.id)}" title="${escapeHtml(item.hint)}">${escapeHtml(item.label)}</button>
        `).join("")}
      </div>
      <div class="seq-editor-actions">
        <button type="button" class="quiet-button compact" data-action="ov6c-add-participant" data-sequence-id="${escapeHtml(sequence.id)}">加参与方</button>
        <button type="button" class="quiet-button compact" data-action="ov6c-add-message" data-sequence-id="${escapeHtml(sequence.id)}">加消息</button>
        ${connectFromId
    ? `<button type="button" class="quiet-button compact is-active" data-action="ov6c-cancel-connect" title="取消连线">取消连线</button>`
    : ""}
      </div>
    </header>

    <div class="seq-diagram-shell is-canvas-edit" data-engine="${escapeHtml(engine)}">
      ${renderInteractiveCanvas(sequence, messages, participants, {
    selectedMessageId,
    selectedMessage,
    activities,
    connectFromId
  })}
      ${showEngineTools
    ? renderEditableEnginePane(sequence, engine, {
      mermaid,
      jsSeq,
      plantuml,
      activeDsl,
      compact: true
    })
    : `<details class="seq-dsl-panel is-compact seq-export-only">
          <summary>导出 DSL（Mermaid / UML / PlantUML）</summary>
          <div class="seq-dsl-grid">
            <div><header>Mermaid</header><pre data-sequence-dsl="${escapeHtml(sequence.id)}" data-engine="mermaid">${escapeHtml(mermaid)}</pre></div>
            <div><header>UML</header><pre data-sequence-dsl="${escapeHtml(sequence.id)}" data-engine="js-sequence">${escapeHtml(jsSeq)}</pre></div>
            <div><header>PlantUML</header><pre data-sequence-dsl="${escapeHtml(sequence.id)}" data-engine="plantuml">${escapeHtml(plantuml)}</pre></div>
          </div>
        </details>`}
    </div>
  </div>`;
}

function renderEditableEnginePane(sequence, engine, { mermaid, jsSeq, plantuml, activeDsl, compact = false }) {
  const isUml = engine === "js-sequence";
  const editorLabel = isUml ? "UML 文本（可选）" : "Mermaid 文本（可选）";
  const editorValue = isUml ? jsSeq : mermaid;
  const syntaxHint = isUml
    ? "语法：participant 指挥 as cmd · cmd->force: 态势上报 · cmd-->force: 回执"
    : "语法：sequenceDiagram · participant cmd as 指挥 · cmd->>force: 态势上报";

  return `<details class="seq-engine-tools ${compact ? "is-compact" : ""}" ${compact ? "" : "open"}>
    <summary>${isUml ? "UML 预览与文本" : "Mermaid 预览与文本"} · 主编辑仍在上方画布</summary>
    <div class="seq-engine-edit is-secondary" data-sequence-id="${escapeHtml(sequence.id)}" data-engine="${escapeHtml(engine)}">
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
    </div>
  </details>`;
}

/**
 * Primary interactive sequence canvas: rename lifelines, connect for messages,
 * edit message name/type/endpoints/activity on the row itself.
 */
function renderInteractiveCanvas(sequence, messages, participants, {
  selectedMessageId,
  selectedMessage,
  activities,
  connectFromId = ""
}) {
  const count = Math.max(participants.length, 1);
  const connecting = Boolean(connectFromId);
  const lifelineHeads = participants.map((participant) => {
    const isFrom = connectFromId === participant.id;
    return `<div class="seq-lifeline-head ${isFrom ? "is-connect-from" : ""} ${connecting ? "is-connect-target" : ""}" data-participant-id="${escapeHtml(participant.id)}">
      <button type="button" class="seq-lifeline-pick" data-action="ov6c-connect-pick" data-sequence-id="${escapeHtml(sequence.id)}" data-participant-id="${escapeHtml(participant.id)}" title="${connecting ? (isFrom ? "取消起点" : "设为消息终点") : "点击设为连线起点"}">
        <span class="seq-lifeline-dot" aria-hidden="true"></span>
      </button>
      <label class="seq-lifeline-name">
        <span class="visually-hidden">参与方名称</span>
        <input
          data-action="ov6c-participant-field"
          data-field="name"
          data-sequence-id="${escapeHtml(sequence.id)}"
          data-participant-id="${escapeHtml(participant.id)}"
          value="${escapeHtml(participant.name || participant.id)}"
          maxlength="80"
          title="直接修改生命线名称"
        />
      </label>
      <label class="seq-lifeline-ref">
        <span class="visually-hidden">对象引用</span>
        <input
          data-action="ov6c-participant-field"
          data-field="ref"
          data-sequence-id="${escapeHtml(sequence.id)}"
          data-participant-id="${escapeHtml(participant.id)}"
          value="${escapeHtml(participant.ref || "")}"
          maxlength="80"
          placeholder="对象引用"
          title="兵力/阶段等引用"
        />
      </label>
      <button type="button" class="seq-lifeline-remove" data-action="ov6c-remove-participant" data-sequence-id="${escapeHtml(sequence.id)}" data-participant-id="${escapeHtml(participant.id)}" title="删除参与方" aria-label="删除参与方">×</button>
    </div>`;
  }).join("") || `<div class="seq-lifeline-head"><strong>参与方</strong></div>`;

  const lanes = participants.map((participant) => `
    <button type="button" class="seq-lifeline-lane ${connectFromId === participant.id ? "is-connect-from" : ""} ${connecting ? "is-connect-target" : ""}" data-action="ov6c-connect-pick" data-sequence-id="${escapeHtml(sequence.id)}" data-participant-id="${escapeHtml(participant.id)}" title="${connecting ? "点击完成连线" : "点击开始连线"}">
      <i></i>
    </button>`).join("") || `<div class="seq-lifeline-lane"><i></i></div>`;

  const messageRows = messages.map((message, index) => {
    const fromIndex = Math.max(0, participants.findIndex((item) => item.id === message.fromRef));
    const toIndex = Math.max(0, participants.findIndex((item) => item.id === message.toRef));
    const left = Math.min(fromIndex, toIndex);
    const right = Math.max(fromIndex, toIndex);
    const span = Math.max(right - left, 1);
    const direction = fromIndex <= toIndex ? "forward" : "backward";
    const selected = message.id === selectedMessageId;
    const fromOptions = participants.map((item) =>
      `<option value="${escapeHtml(item.id)}" ${item.id === message.fromRef ? "selected" : ""}>${escapeHtml(item.name || item.id)}</option>`).join("");
    const toOptions = participants.map((item) =>
      `<option value="${escapeHtml(item.id)}" ${item.id === message.toRef ? "selected" : ""}>${escapeHtml(item.name || item.id)}</option>`).join("");
    const typeOptions = MESSAGE_TYPES.map((type) =>
      `<option value="${type}" ${message.type === type ? "selected" : ""}>${type}</option>`).join("");
    const activityOptions = [
      `<option value="">无回链</option>`,
      ...activities.slice(0, 40).map((item) =>
        `<option value="${escapeHtml(item.id)}" ${(message.relatedActivityRefs || [])[0] === item.id ? "selected" : ""}>${escapeHtml(item.title)}</option>`)
    ].join("");

    return `<div class="seq-message-row ${selected ? "is-selected" : ""}" style="--from:${fromIndex};--to:${toIndex};--left:${left};--span:${span};--cols:${count}" data-message-id="${escapeHtml(message.id)}">
      <div class="seq-message-slot" style="grid-column: ${left + 1} / span ${span + 1}">
        <div class="seq-message-arrow is-${direction} ${selected ? "is-selected" : ""}" data-action="ov6c-select-message" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" role="button" tabindex="0">
          <span class="seq-message-seq">${message.sequence || index + 1}</span>
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
          <select class="seq-message-type-select" data-action="ov6c-message-field" data-field="type" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" title="消息类型" onclick="event.stopPropagation()">
            ${typeOptions}
          </select>
          <div class="seq-message-tools" onclick="event.stopPropagation()">
            <button type="button" class="seq-icon-btn" data-action="ov6c-move-message" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" data-delta="-1" title="上移">↑</button>
            <button type="button" class="seq-icon-btn" data-action="ov6c-move-message" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" data-delta="1" title="下移">↓</button>
            <button type="button" class="seq-icon-btn" data-action="ov6c-reverse-message" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" title="反转方向">⇄</button>
            <button type="button" class="seq-icon-btn is-danger" data-action="ov6c-remove-message" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" title="删除">×</button>
          </div>
        </div>
        ${selected
    ? `<div class="seq-message-inline-form" onclick="event.stopPropagation()">
            <label><span>从</span><select data-action="ov6c-message-field" data-field="fromRef" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}">${fromOptions}</select></label>
            <label><span>到</span><select data-action="ov6c-message-field" data-field="toRef" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}">${toOptions}</select></label>
            <label><span>条件</span><input data-action="ov6c-message-field" data-field="condition" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}" value="${escapeHtml(message.condition || "")}" maxlength="200" placeholder="触发条件" /></label>
            <label><span>回链</span><select data-action="ov6c-message-field" data-field="activity" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}">${activityOptions}</select></label>
          </div>`
    : `<button type="button" class="seq-message-meta muted" data-action="ov6c-select-message" data-sequence-id="${escapeHtml(sequence.id)}" data-message-id="${escapeHtml(message.id)}">${escapeHtml(participantName(participants, message.fromRef))} → ${escapeHtml(participantName(participants, message.toRef))}${(message.relatedActivityRefs || []).length ? "" : " · 未回链"}</button>`}
      </div>
    </div>`;
  }).join("") || `<div class="ov6c-message-empty muted">尚无消息。点击两个生命线完成连线，或点「加消息」。</div>`;

  return `<div class="ov6c-canvas seq-workbench-canvas is-interactive ${connecting ? "is-connecting" : ""}" data-seq-canvas data-sequence-id="${escapeHtml(sequence.id)}" style="--cols:${count}">
    <div class="seq-canvas-hint">
      ${connecting
    ? `<span class="is-live">连线中：已选「${escapeHtml(participantName(participants, connectFromId))}」，再点目标生命线</span>`
    : `<span>点生命线连消息 · 在箭头上直接改名称/类型 · 点消息展开从/到/条件/回链</span>`}
    </div>
    <div class="ov6c-lifeline-heads" style="grid-template-columns: repeat(${count}, minmax(110px, 1fr))">${lifelineHeads}</div>
    <div class="ov6c-lifeline-body">
      <div class="ov6c-lifeline-lanes" style="grid-template-columns: repeat(${count}, minmax(110px, 1fr))">${lanes}</div>
      <div class="ov6c-message-layer">${messageRows}</div>
    </div>
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
    subtitle: "自然语言起草/修订参与方与消息链，画布与开源引擎同步。",
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

function stateLabel(value, outOfOrder) {
  if (outOfOrder) return "顺序待复核";
  return ({ ready: "已映射", review: "来源待复核", pending: "待排程" })[value] || "待复核";
}

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
