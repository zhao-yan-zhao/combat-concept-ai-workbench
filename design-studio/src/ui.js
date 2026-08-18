import { activities, directions, project, views, workflowPhases, workflowTracks } from "./data.js";
import { renderOoda, renderOodaInspector, selectionForOoda } from "./oodaView.js";
import { renderAccountManagement, renderCollaboration } from "./collaborationView.js";
import { renderOv2, selectionForOv2Exchange } from "./ov2View.js";
import { renderOv3, selectionForOv3Exchange } from "./ov3View.js";
import { renderOv4, selectionForOv4Relation, selectionForOv4Role } from "./ov4View.js";
import { renderOv6c, selectionForOv6cEvent } from "./ov6cView.js";
import { renderOv5a, renderOv6a, renderOv6b } from "./dodafOperationalViews.js";
import { renderScenario, selectionForScenarioUnit } from "./scenarioView.js";
import { renderValidation, selectionForValidationIssue } from "./validationView.js";
import { selectionForKnowledgeNote } from "./knowledgeView.js";
import { buildReportPayload } from "./reportBuilder.js";
import { listReportTemplates } from "./reportTemplateStore.js";
import { renderInspirationSession } from "./inspirationView.js";
import { buildDirectionProposals } from "./directionProposalStore.js";
import { renderOv1, renderOv1Inspector, selectionForOv1 } from "./ov1View.js";
import { renderModelSnapshotPanel } from "./modelSnapshotView.js";
import { renderProjectStorageState } from "./projectStorageView.js";
import { buildTraceability, getTraceTargets } from "./traceabilityBuilder.js";
import { getAssignableParentActivities } from "./ov5Store.js";
import { renderOv5ActivityGraph } from "./ov5GraphView.js";
import { renderStructureReview } from "./structureReviewView.js";
import { renderConceptMap } from "./conceptMapView.js";
import { renderForceMission } from "./forceMissionView.js";
import { renderPhaseAction } from "./phaseActionView.js";
import { renderOperationalTasks } from "./operationalTaskView.js";
import { renderOv1b } from "./ov1bView.js";
import { renderOv1c, renderOv7 } from "./mappingProductView.js";
import { normalizeWorkflowProgress } from "../../shared/workflowProgress.js";
import { renderRailContextualModelFlow } from "./contextualModelFlow.js";

/**
 * Floating research path: numbered circles.
 * Hover the rail → every step slides its intro out to the right (single-line, adaptive type).
 */
export function renderTree(activeView, workflow = {}, state = {}) {
  const progress = normalizeWorkflowProgress(workflow);
  const completedThrough = progress.completedThrough;
  const freeMode = progress.mode === "free";
  const viewById = new Map(views.map((view) => [view.id, view]));
  const steps = [];

  workflowTracks.forEach((track) => {
    track.viewIds.map((id) => viewById.get(id)).filter(Boolean).forEach((view) => {
      const phaseIndex = workflowPhases.indexOf(view.phase);
      const locked = !freeMode && phaseIndex > completedThrough + 1;
      const done = phaseIndex <= completedThrough;
      const active = view.id === activeView;
      const nodeState = locked ? "pending" : done ? "done" : active ? "active" : "ready";
      steps.push({ view, locked, done, active, nodeState, trackId: track.id, trackLabel: track.label });
    });
  });

  const relatedMainViewId = state.relatedModelReturnContext?.mainViewId || "";
  const activeTrack = steps.find((item) => item.active || item.view.id === relatedMainViewId)?.trackId || "";
  const items = steps.map((item, index) => {
    const short = stepShortLabel(item.view);
    const blurb = stepIntroBlurb(item.view, item.trackLabel);
    const title = `${item.trackLabel} · ${short} · ${item.view.label}${blurb ? ` · ${blurb}` : ""}`;
    const core = item.done && !item.active ? "✓" : escapeHtml(item.view.number || short);
    const relatedFlow = (item.active || item.view.id === relatedMainViewId)
      ? renderRailContextualModelFlow(item.view.id, state)
      : "";
    return `<li class="step-node ${item.nodeState}${item.active ? " is-current" : ""}${item.view.id === relatedMainViewId ? " is-related-source" : ""}${item.locked ? " locked" : ""}${relatedFlow ? " has-related" : ""}" data-track="${escapeHtml(item.trackId)}" style="--step-i:${index}">
      <button type="button" class="step-button" data-view="${escapeHtml(item.view.id)}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" ${item.locked ? "disabled" : ""} aria-current="${item.active ? "step" : "false"}">
        <span class="step-circle" aria-hidden="true">
          <span class="step-ring"></span>
          <span class="step-core">${core}</span>
        </span>
        <span class="step-expand" aria-hidden="true">
          <em class="step-label-track">${escapeHtml(item.trackLabel)}</em>
          <span class="step-label-sep" aria-hidden="true">·</span>
          <strong class="step-label-short">${escapeHtml(short)}</strong>
          <span class="step-label-sep" aria-hidden="true">·</span>
          <span class="step-label-full">${escapeHtml(item.view.label)}</span>
          <span class="step-label-sep step-label-sep-blurb" aria-hidden="true">·</span>
          <span class="step-label-blurb">${escapeHtml(blurb)}</span>
        </span>
      </button>
    </li>${relatedFlow}`;
  }).join("");

  const trackMeta = workflowTracks.map((track) => {
    const hasActive = track.id === activeTrack;
    return `<span class="step-track-meta${hasActive ? " has-active" : ""}" data-track="${escapeHtml(track.id)}" hidden>${escapeHtml(track.label)}</span>`;
  }).join("");

  return `<div class="step-spine${activeTrack ? " has-active" : ""}${items.includes("step-related-node") ? " has-related" : ""}" style="--step-count:${Math.max(steps.length, 1)}">
    ${trackMeta}
    <i class="step-spine-line" aria-hidden="true"></i>
    <ol class="step-path" aria-label="研究路径">${items}</ol>
  </div>`;
}

/** Compact intro tail: prefer subtitle, else phase. */
function stepIntroBlurb(view, trackLabel) {
  const subtitle = String(view.subtitle || "").trim();
  if (subtitle) return subtitle;
  const phase = String(view.phase || "").trim();
  if (phase) return phase;
  return trackLabel;
}

function stepShortLabel(view) {
  const map = {
    brief: "简报",
    "operational-task": "作战任务",
    "force-mission": "作战兵力",
    "phase-action": "阶段行动",
    "concept-map": "概念图",
    ov1: "总体图",
    ov1b: "任务分解",
    ov1c: "任务活动映射",
    ov5: "活动",
    ooda: "循环",
    "structure-review": "核对台",
    ov5a: "活动分解",
    ov2: "资源流",
    ov3: "交换矩阵",
    ov4: "组织关系",
    ov6a: "规则库",
    ov6b: "状态机",
    ov6c: "时序",
    ov7: "状态活动映射",
    scenario: "想定",
    validate: "验证",
    collaboration: "协同",
    report: "报告"
  };
  return map[view.id] || String(view.label || view.id).replace(/^OV-\S+\s*/, "").slice(0, 8);
}

export function renderView(viewId, state) {
  if (viewId === "brief") return renderBrief(state);
  if (viewId === "operational-task") return renderOperationalTasks(state);
  if (viewId === "ov1b") return renderOv1b(state);
  if (viewId === "ov1c") return renderOv1c(state);
  if (viewId === "ov7") return renderOv7(state);
  if (viewId === "force-mission") return renderForceMission(state);
  if (viewId === "phase-action") return renderPhaseAction(state);
  if (viewId === "concept-map") return renderConceptMap(state);
  if (viewId === "ov1") return renderOv1(state);
  if (viewId === "structure-review") return renderStructureReview(state);
  if (viewId === "ov2") return renderOv2(state);
  if (viewId === "ov3") return renderOv3(state);
  if (viewId === "ov4") return renderOv4(state);
  if (viewId === "ov5a") return renderOv5a(state);
  if (viewId === "ov6a") return renderOv6a(state);
  if (viewId === "ov6b") return renderOv6b(state);
  if (viewId === "ov6c") return renderOv6c(state);
  if (viewId === "ov5") return renderOv5(state);
  if (viewId === "ooda") return renderOoda(state);
  if (viewId === "scenario") return renderScenario(state);
  if (viewId === "validate") return renderValidation(state);
  if (viewId === "collaboration") return renderCollaboration(state);
  if (viewId === "account-management") return renderAccountManagement(state);
  return renderReport(state);
}

export function renderInspector(selection, context = {}) {
  if (!selection && context.activeView === "brief") return `<p class="empty-inspector">\u5b8c\u6210\u7814\u7a76\u7b80\u62a5\u540e\uff0c\u53ef\u4ee5\u5728\u540e\u7eed\u5efa\u6a21\u4e0e\u9a8c\u8bc1\u9636\u6bb5\u9009\u62e9\u5bf9\u8c61\u67e5\u770b\u4e0a\u4e0b\u6587\u3002</p>`;
  if (!selection && context.activeView === "concept-map") return renderConceptMapInspector(context);
  if (!selection) {
    return `<p class="empty-inspector">选择概念树、模型节点或验证问题后，这里会显示对应的输入、输出与修订建议。</p>`;
  }

  if (selection.kind === "activity") return `${renderActivityInspector(selection, context)}${renderTraceabilitySection(selection, context)}`;
  if (selection.kind === "ov1") return `${renderOv1Inspector(selection)}${renderTraceabilitySection(selection, context)}`;
  if (selection.kind === "ooda") return `${renderOodaInspector(selection)}${renderTraceabilitySection(selection, context)}`;

  const isExternalKnowledge = selection.kind === "knowledge";
  const value = (item) => isExternalKnowledge ? escapeHtml(item) : item;
  const facts = (selection.facts || []).map(([key, fact]) => `<div><span>${value(key)}</span><b>${value(fact)}</b></div>`).join("");
  const chips = (selection.refs || []).map((item) => `<span class="chip">${value(item)}</span>`).join("");
  return `
    <section class="inspector-section"><h3>说明</h3><p>${value(selection.text)}</p></section>
    ${facts ? `<section class="inspector-section"><h3>属性</h3><div class="detail-list">${facts}</div></section>` : ""}
    ${chips ? `<section class="inspector-section"><h3>引用</h3><div class="chip-row">${chips}</div></section>` : ""}
    ${renderTraceabilitySection(selection, context)}
    <section class="inspector-section"><h3>操作</h3><button class="quiet-button" data-inspector-action="edit">标记待修订</button></section>
  `;
}

function renderConceptMapInspector(context) {
  const map = context.conceptMap || {};
  const stale = Boolean(context.conceptMapStorage?.stale);
  const itemCount = Number(map.summary?.itemCount || map.document?.items?.length || 0);
  const layers = Array.isArray(map.summary?.layers) ? map.summary.layers.filter(Boolean) : [];
  const status = stale ? "\u5f85\u590d\u6838" : itemCount && String(map.context || "").trim() ? "\u5df2\u786e\u8ba4" : "\u5f85\u5b8c\u5584";
  return `<section class="inspector-section concept-map-inspector-summary"><h3>\u5730\u56fe\u72b6\u6001</h3><div class="detail-list"><div><span>\u72b6\u6001</span><b>${status}</b></div><div><span>\u5730\u56fe\u5bf9\u8c61</span><b>${itemCount}</b></div>${layers.length ? `<div><span>\u56fe\u5c42</span><b>${layers.map(escapeHtml).join("\u3001")}</b></div>` : ""}</div><p>\u5728\u5d4c\u5165\u5730\u56fe\u7f16\u8f91\u5668\u4e2d\u7ef4\u62a4\u5bf9\u8c61\u4e0e\u6807\u7ed8\uff0c\u5e76\u5728\u4e3b\u9875\u9762\u4fdd\u5b58\u5ba1\u6838\u8bf4\u660e\u3002</p></section>`;
}

export function getViewMeta(viewId) {
  if (viewId === "account-management") {
    return { id: "account-management", number: "—", label: "账号管理", subtitle: "协同身份", status: "ready" };
  }
  return views.find((view) => view.id === viewId);
}

function renderBrief(state) {
  return renderFocusedBrief(state);
  const brief = state.brief || project.brief;
  const directionProposals = buildDirectionProposals({ session: state.inspiration, fallbackDirections: directions, aiDirections: state.aiDirections, customDirections: state.customDirections });
  const proposalDescription = directionProposals.some((item) => item.sessionAware)
    ? "已按完成的灵感会话生成可选策略。"
    : "完成灵感孵化后将生成基于会话内容的策略。";
  return `
    <section class="surface surface-pad">
      <div class="section-heading"><div><h2>概念简报</h2><p>由灵感孵化与知识库引用共同形成。</p></div><span class="mini-tag">已确认方向：${state.direction}</span></div>
      ${renderProjectStorageState(state.projectStorage)}
      <div class="brief-grid">
        <div>
          <div class="idea-prompt"><p>${escapeHtml(brief.approach)}</p></div>
          <div class="brief-fields">
            <div class="brief-field"><b>作战目标</b><span>${escapeHtml(brief.objective)}</span></div>
            <div class="brief-field"><b>关键假设</b><span>${escapeHtml(brief.assumptions)}</span></div>
            <div class="brief-field"><b>预期效果</b><span>${escapeHtml(brief.expectedEffects)}</span></div>
            <div class="brief-field"><b>主要风险</b><span>${escapeHtml(brief.risk)}</span></div>
            <div class="brief-field"><b>知识依据</b><span>${escapeHtml((brief.evidenceRefs || []).join("、") || "未关联")}</span></div>
          </div>
        </div>
        <div class="citation-list">${project.citations.map((item) => `<article class="citation"><strong>${item.title}</strong><small>${item.text}</small><em>${item.ref}</em></article>`).join("")}</div>
      </div>
    </section>
    ${renderInspirationSession({
      session: state.inspiration,
      adviceGenerating: state.inspirationAdviceGenerating
    })}
    <section class="surface surface-pad">
      <div class="section-heading"><div><h2>简报孵化</h2><p>输入研究意图后生成草案，人工确认后进入下游建模。</p></div><span class="mini-tag ${state.briefGenerating ? "review" : ""}">${state.briefGenerating ? "生成中" : "可编辑"}</span></div>
      <form class="brief-editor" id="briefEditorForm">
        <label><span>研究意图</span><textarea name="intent" rows="2" placeholder="说明需要研究的任务目标、约束或关注问题">${escapeHtml(state.briefIntent || "")}</textarea></label>
        <label><span>作战目标</span><textarea name="objective" rows="2">${escapeHtml(brief.objective)}</textarea></label>
        <label><span>核心思路</span><textarea name="approach" rows="3">${escapeHtml(brief.approach)}</textarea></label>
        <label><span>关键假设</span><textarea name="assumptions" rows="2">${escapeHtml(brief.assumptions)}</textarea></label>
        <label><span>预期效果</span><textarea name="expectedEffects" rows="2">${escapeHtml(brief.expectedEffects)}</textarea></label>
        <label><span>知识依据（由已选择的 Vault 证据生成）</span><input name="evidenceRefs" value="${escapeHtml((brief.evidenceRefs || []).join("、"))}" maxlength="4000" readonly></label>
        <label><span>主要风险</span><textarea name="risk" rows="2">${escapeHtml(brief.risk)}</textarea></label>
        <label class="brief-evidence-toggle"><input type="checkbox" name="includeEvidence" ${state.briefIncludeEvidence ? "checked" : ""}> <span>引用当前 Vault 证据</span></label>
        <div class="editor-actions"><button class="quiet-button" type="submit" ${state.briefGenerating ? "disabled" : ""}>保存简报</button><button type="button" class="brief-generate-btn${state.briefGenerating ? " is-busy" : ""}" data-action="generate-brief" ${state.briefGenerating ? "disabled" : ""}>${state.briefGenerating ? "生成中…" : "AI 生成草案"}</button></div>
      </form>
    </section>
    <section class="surface surface-pad">
      <div class="section-heading"><div><h2>概念方向</h2><p>${proposalDescription}</p></div></div>
      <div class="direction-cards">${directionProposals.map((item) => `<button class="direction-card ${state.direction === item.title ? "selected" : ""}" data-direction="${item.title}"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p><small>${escapeHtml(item.basis || "")}</small></button>`).join("")}</div>
    </section>
  `;
}

function renderFocusedBrief(state) {
  // Conversation-first main column; research baseline stays in the docked right inspector.
  return renderConversationBrief(state);
}

function renderConversationBrief(state) {
  return `<section class="brief-conversation">${renderInspirationSession({ session: state.inspiration, adviceGenerating: state.inspirationAdviceGenerating })}</section>`;
}

export function renderBriefSidebar(state) {
  const brief = state.brief || project.brief;
  const generating = Boolean(state.briefGenerating);
  const reveal = Boolean(state.briefDraftReveal);
  const formClass = ["brief-editor", "brief-sidebar-editor", generating ? "is-generating" : "", reveal ? "is-draft-reveal" : ""].filter(Boolean).join(" ");
  return `<form class="${formClass}" id="briefEditorForm" aria-busy="${generating ? "true" : "false"}">${generating ? `<div class="brief-generate-progress" role="status" aria-live="polite"><span class="brief-generate-progress-bar"></span><span class="brief-generate-progress-label">\u6b63\u5728\u751f\u6210 AI \u8349\u6848\u2026</span></div>` : ""}${reveal ? `<div class="brief-draft-reveal-note" role="status">\u8349\u6848\u5df2\u5199\u5165\uff0c\u8bf7\u590d\u6838\u5404\u5b57\u6bb5</div>` : ""}<label><span>\u7814\u7a76\u610f\u56fe</span><textarea name="intent" rows="2" ${generating ? "readonly" : ""}>${escapeHtml(state.briefIntent || "")}</textarea></label><label><span>\u7814\u7a76\u76ee\u6807</span><textarea name="objective" rows="2" ${generating ? "readonly" : ""}>${escapeHtml(brief.objective)}</textarea></label><label><span>\u6838\u5fc3\u601d\u8def</span><textarea name="approach" rows="3" ${generating ? "readonly" : ""}>${escapeHtml(brief.approach)}</textarea></label><label><span>\u5173\u952e\u5047\u8bbe</span><textarea name="assumptions" rows="2" ${generating ? "readonly" : ""}>${escapeHtml(brief.assumptions)}</textarea></label><label><span>\u9884\u671f\u6548\u679c</span><textarea name="expectedEffects" rows="2" ${generating ? "readonly" : ""}>${escapeHtml(brief.expectedEffects)}</textarea></label><label><span>\u4e3b\u8981\u98ce\u9669</span><textarea name="risk" rows="2" ${generating ? "readonly" : ""}>${escapeHtml(brief.risk)}</textarea></label><label class="brief-evidence-toggle"><input type="checkbox" name="includeEvidence" ${state.briefIncludeEvidence ? "checked" : ""} ${generating ? "disabled" : ""}> <span>\u5f15\u7528 Vault \u8bc1\u636e</span></label><div class="editor-actions"><button class="quiet-button" type="submit" ${generating ? "disabled" : ""}>\u4fdd\u5b58</button><button type="button" class="brief-generate-btn${generating ? " is-busy" : ""}" data-action="generate-brief" ${generating ? "disabled" : ""}>${generating ? "\u751f\u6210\u4e2d\u2026" : "AI \u8349\u6848"}</button></div>${renderBriefDirectionPanel(state)}</form>`;
}

/** Compact concept-direction picker for the research-baseline sidebar. */
function renderBriefDirectionPanel(state) {
  const proposals = buildDirectionProposals({
    session: state.inspiration,
    fallbackDirections: directions,
    aiDirections: state.aiDirections,
    customDirections: state.customDirections
  });
  const selected = String(state.direction || "").trim();
  const selectedLabel = displayDirectionTitle(selected) || "未选择";
  const baseline = proposals.filter((item) => !item.ai && !item.custom);
  const aiItems = proposals.filter((item) => item.ai);
  const customItems = proposals.filter((item) => item.custom);
  const aiBusy = Boolean(state.aiDirectionsGenerating);
  const formBusy = Boolean(state.briefGenerating);
  const aiActionLabel = aiBusy ? "生成中" : aiItems.length ? "重生成" : "生成";

  const panelOpen = state.directionPanelOpen === true;
  return `<details class="brief-sidebar-support direction-panel"${panelOpen ? " open" : ""}>
    <summary>
      <span class="direction-panel-summary-label">概念方向</span>
      <span class="direction-panel-summary-current" title="${escapeHtml(selectedLabel)}">${escapeHtml(selectedLabel)}</span>
    </summary>
    <div class="direction-groups">
      ${renderDirectionGroup("基线", baseline, selected)}
      <section class="direction-group">
        <header class="direction-group-head">
          <span>AI</span>
          <button class="direction-group-action" type="button" data-action="generate-ai-directions" ${aiBusy || formBusy ? "disabled" : ""}>${aiActionLabel}</button>
        </header>
        ${aiBusy && !aiItems.length
          ? `<p class="direction-group-empty">正在生成建议…</p>`
          : aiItems.length
            ? `<div class="direction-list">${aiItems.map((item) => renderDirectionItem(item, selected)).join("")}</div>`
            : `<p class="direction-group-empty">尚未生成 AI 方向</p>`}
      </section>
      <section class="direction-group">
        <header class="direction-group-head">
          <span>自定义</span>
          <button class="direction-group-action" type="button" data-action="open-custom-direction" ${formBusy ? "disabled" : ""}>+ 新增</button>
        </header>
        ${customItems.length
          ? `<div class="direction-list">${customItems.map((item) => renderDirectionItem(item, selected)).join("")}</div>`
          : `<p class="direction-group-empty">无自定义方向</p>`}
      </section>
    </div>
  </details>`;
}

function renderDirectionGroup(label, items, selected) {
  if (!items.length) return "";
  return `<section class="direction-group">
    <header class="direction-group-head"><span>${escapeHtml(label)}</span></header>
    <div class="direction-list">${items.map((item) => renderDirectionItem(item, selected)).join("")}</div>
  </section>`;
}

function renderDirectionItem(item, selectedTitle) {
  const selected = item.title === selectedTitle;
  const badge = item.ai
    ? `<em class="direction-badge">AI</em>`
    : item.custom
      ? `<em class="direction-badge is-custom">自定</em>`
      : "";
  const actions = item.custom
    ? `<div class="direction-item-actions">
        <button type="button" data-edit-direction="${escapeHtml(item.title)}">编辑</button>
        <button type="button" data-delete-direction="${escapeHtml(item.title)}" title="删除" aria-label="删除自定义方向">×</button>
      </div>`
    : "";
  return `<article class="direction-item ${selected ? "selected" : ""}">
    <button type="button" data-direction="${escapeHtml(item.title)}">
      <span class="direction-item-title"><strong>${escapeHtml(displayDirectionTitle(item.title))}</strong>${badge}${selected ? `<em class="direction-badge is-selected">选用</em>` : ""}</span>
      <span class="direction-item-text">${escapeHtml(item.text)}</span>
    </button>
    ${actions}
  </article>`;
}

function displayDirectionTitle(title) {
  return String(title || "")
    .trim()
    .replace(/^[“"「『]+/, "")
    .replace(/[”"」』]+$/, "")
    .trim();
}

function renderOv5(state) {
  const model = state.ov5;
  const activityById = new Map(model.activities.map((item) => [item.id, item]));
  const provenance = model.provenance?.mode === "ai" ? "AI 草案" : model.provenance?.mode === "local" ? "本地草案" : "人工维护";
  const evidenceSelection = formatEvidenceSelection(model.provenance?.evidenceSelection);
  return `
    <section class="surface surface-pad">
      <div class="section-heading"><div><h2>作战活动模型</h2><p>活动、信息、资源与触发关系构成概念设计骨架。</p></div><div class="activity-toolbar"><span class="mini-tag ${state.ov5Generating ? "review" : ""}">${state.ov5Generating ? "生成中" : provenance}</span>${evidenceSelection ? `<span class="mini-tag">${escapeHtml(evidenceSelection)}</span>` : ""}<span class="mini-tag">${model.activities.length} 个活动 · ${model.edges.length} 条关联</span><button class="quiet-button" data-action="attach-ov1-sources" ${state.ov5Generating ? "disabled" : ""}>补挂总体图来源</button><button class="quiet-button" data-action="apply-mapping-quality" ${state.ov5Generating ? "disabled" : ""} title="补全空 I/O 与浅层父活动，不覆盖已有正文">补全映射质量</button><button class="quiet-button" data-action="open-structure-review">结构核对</button><button class="quiet-button" data-action="add-activity" ${state.ov5Generating ? "disabled" : ""}>新增活动</button><button type="button" data-action="generate-ov5" ${state.ov5Generating ? "disabled" : ""}>${state.ov5Generating ? "正在生成" : "AI 重建 OV-5"}</button></div></div>
      ${renderProjectStorageState(state.ov5Storage, { refreshAction: "refresh-project-ov5" })}
      ${renderOv5ActivityGraph(model, state.selection?.id)}
    </section>
    <section class="surface surface-pad">
      <div class="section-heading"><div><h2>活动关联</h2><p>关系可在选中活动后的右侧面板维护。</p></div></div>
      <div class="relation-list">${model.edges.map((edge) => `<div class="relation-row"><span>${activityById.get(edge.sourceId)?.title || "未知活动"}</span><b>${edge.type}</b><span>${activityById.get(edge.targetId)?.title || "未知活动"}</span><button class="relation-remove" data-edge-remove="${edge.id}" title="移除关联" aria-label="移除关联">×</button></div>`).join("") || `<p class="empty-relations">尚未建立活动关联。</p>`}</div>
    </section>
  `;
}

function renderReport(state) {
  const report = buildReportPayload({
    project,
    brief: state.brief,
    inspiration: state.inspiration,
    direction: state.direction,
    forceMission: state.forceMission,
    ov1: state.ov1,
    ov1c: state.ov1c,
    ov2: state.ov2,
    ov3: state.ov3,
    ov4: state.ov4,
    ov5a: state.ov5a,
    ov5: state.ov5,
    ov6a: state.ov6a,
    ov6b: state.ov6b,
    ov6c: state.ov6c,
    ov7: state.ov7,
    ooda: state.ooda,
    scenario: state.scenario,
    validationResult: state.validationResult,
    knowledge: state.knowledge,
    knowledgeCitationApprovals: state.knowledgeCitationApprovals,
    deployment: state.deployment,
    modelSnapshots: state.modelSnapshots,
    modelComparison: state.modelComparison,
    reportTemplate: state.reportTemplate,
    collaboration: state.collaboration,
    projectRepository: {
      projectRevision: state.projectRevision,
      brief: state.projectStorage,
      ov1: state.ov1Storage,
      ov1c: state.ov1cStorage,
      ov2: state.ov2Storage,
      ov3: state.ov3Storage,
      ov4: state.ov4Storage,
      ov5a: state.ov5aStorage,
      ov5: state.ov5Storage,
      ov6a: state.ov6aStorage,
      ov6b: state.ov6bStorage,
      ov6c: state.ov6cStorage,
      ov7: state.ov7Storage,
      architecture: state.architectureStorage,
      ooda: state.oodaStorage,
      scenario: state.scenarioStorage,
      validation: state.validationStorage,
      knowledge: state.knowledgeStorage,
      reportArchives: state.reportStorage,
      modelSnapshots: state.modelSnapshotStorage
    }
  });
  const evidenceCount = report.knowledge?.evidence.entries.length || 0;
  const bridge = report.deploymentBridge;
  const maturity = report.validationMaturity;
  const traceability = report.traceability;
  const repository = report.projectRepository;
  const versions = state.reportVersions || [];
  const modelSnapshots = state.modelSnapshots || [];
  const inspiration = report.inspiration;
  const obsidianArchive = state.obsidianArchive;
  const templates = listReportTemplates();
  const selectedTemplate = report.reportTemplate;
  return `
    <section class="surface surface-pad">
      <div class="section-heading"><div><h2>成果报告</h2><p>将概念、活动、OODA、想定和验证结论汇总为可归档成果。</p></div><span class="mini-tag">${state.ov5.activities.length} 项活动 · ${evidenceCount} 条证据</span></div>
      <div class="report-summary"><span>OV-1：${report.ov1?.nodes.length || 0} 个节点 · ${report.ov1?.edges.length || 0} 条关系</span><span>OV-1 追溯：${traceability?.summary.mappedActivityCount || 0}/${traceability?.summary.activityCount || 0} 活动</span><span>OODA：${state.ooda.lanes.flatMap((lane) => lane.nodes).length} 个节点</span><span>想定：${state.scenario?.entities.length || 0} 个实体</span><span>验证问题：${state.validationResult?.issues.length || 0}</span><span>成熟度：${maturity.readyCount}/${maturity.totalCount} ${maturity.label}</span><span>项目修订：r${repository?.projectRevision || 0}</span><span>归档版本：${versions.length}</span><span>模型快照：${modelSnapshots.length}</span></div>
      <div class="report-layout">
        <div class="export-list">
          <article class="export-item report-template-selector"><div><strong>导出模板</strong><span>${escapeHtml(selectedTemplate.description)}；归档后固定到该报告版本。</span></div><label><span class="sr-only">导出模板</span><select data-report-template>${templates.map((template) => `<option value="${escapeHtml(template.id)}" ${template.id === selectedTemplate.id ? "selected" : ""}>${escapeHtml(template.label)}</option>`).join("")}</select></label></article>
          <article class="export-item"><div><strong>研究报告</strong><span>概念简报、模型、部署桥接、红方审阅、成熟度与证据</span></div><button class="quiet-button" data-export="markdown">Markdown</button></article>
          <article class="export-item"><div><strong>想定数据包</strong><span>活动、时序、部署状态、证据摘要与成熟度</span></div><button class="quiet-button" data-export="json">JSON</button></article>
          <article class="export-item"><div><strong>结构化报告</strong><span>面向系统交换的概念、模型、想定与验证 XML</span></div><button class="quiet-button" data-export="xml">XML</button></article>
          <article class="export-item"><div><strong>正式研究报告</strong><span>概念、模型、想定与验证结论的可编辑 Word 文档</span></div><button class="quiet-button" data-export="docx">Word</button></article>
          <article class="export-item"><div><strong>正式研究报告</strong><span>概念、模型、想定与验证结论的 PDF 定稿；服务不可用时打开可打印报告</span></div><button class="quiet-button" data-export="pdf">PDF</button></article>
          <article class="export-item"><div><strong>研究汇报</strong><span>面向审阅的概念、模型、想定、验证与证据 PPTX 汇报</span></div><button class="quiet-button" data-export="pptx">PPTX</button></article>
          <article class="export-item"><div><strong>部署图输入</strong><span>初始态势和实体关系</span></div><button class="quiet-button" data-export="map">mapInput</button></article>
          <article class="export-item"><div><strong>想定空间数据</strong><span>标注抽象百分比坐标参考的 GeoJSON FeatureCollection</span></div><button class="quiet-button" data-export="geojson">GeoJSON</button></article>
          <article class="export-item"><div><strong>Obsidian 归档</strong><span>选择本地 Vault 后写入带 YAML 元数据和双链的结构化成果笔记集</span></div><button class="quiet-button" data-action="archive-obsidian" ${state.obsidianArchiveWriting ? "disabled" : ""}>${state.obsidianArchiveWriting ? "正在写入" : "写入 Vault"}</button></article>
          <article class="export-item"><div><strong>归档当前报告</strong><span>保存不可变快照，供后续审阅和独立导出</span></div><button class="quiet-button" data-action="save-report-version" ${state.reportArchiving ? "disabled" : ""}>${state.reportArchiving ? "正在归档" : "归档"}</button></article>
        </div>
        <div class="report-detail-stack">
          <section class="report-detail-section">
            <div class="report-detail-heading"><h3>灵感孵化轨迹</h3><span class="report-state ${inspiration?.completed ? "ready" : "review"}">${inspiration?.completed ? "已完成" : "进行中"}</span></div>
            ${renderReportInspiration(inspiration)}
          </section>
          <section class="report-detail-section">
            <div class="report-detail-heading"><h3>部署图桥接</h3><span class="report-state ${reportStateClass(bridge.status)}">${escapeHtml(bridge.status)}</span></div>
            <div class="report-facts"><span>目标地址<b>${escapeHtml(bridge.targetUrl || "未配置")}</b></span><span>目标源<b>${escapeHtml(bridge.targetOrigin || "无法解析")}</b></span><span>同步想定<b>${escapeHtml(bridge.scenarioId || "尚未生成")}</b></span><span>嵌入状态<b>${bridge.embedded ? "已打开" : "未打开"}</b></span></div>
          </section>
          <section class="report-detail-section">
            <div class="report-detail-heading"><h3>项目模型版本</h3><span class="report-state ${repository?.staleCount ? "review" : "ready"}">r${repository?.projectRevision || 0}</span></div>
            ${renderReportProjectRepository(repository)}
          </section>
          <section class="report-detail-section">
            <div class="report-detail-heading"><h3>知识证据摘要</h3><span class="report-state ${report.knowledge ? "ready" : "pending"}">${report.knowledge ? `${evidenceCount} 条匹配` : "未连接"}</span></div>
            ${renderReportEvidence(report.knowledge)}
          </section>
          <section class="report-detail-section">
            <div class="report-detail-heading"><h3>OV-1 总体概念</h3><span class="report-state ${report.ov1?.nodes.length ? "ready" : "pending"}">${report.ov1?.nodes.length || 0} 个节点</span></div>
            ${renderReportOv1(report.ov1)}
          </section>
          <section class="report-detail-section">
            <div class="report-detail-heading"><h3>DoDAF 作战视图摘要</h3><span class="report-state ${report.ov6a?.rules?.length && report.ov6b?.transitions?.length ? "ready" : "review"}">${report.standard === "DoDAF-2.02-DM2" || report.ov2?.schema ? "DM2 可编辑持久化" : "可编辑/种子"}</span></div>
            ${renderReportDerivedOperationalViews(report)}
          </section>
          <section class="report-detail-section">
            <div class="report-detail-heading"><h3>跨视图追溯</h3><span class="report-state ${traceability?.summary.mappedActivityCount === traceability?.summary.activityCount ? "ready" : "review"}">${traceability?.summary.mappedActivityCount || 0}/${traceability?.summary.activityCount || 0} 活动已标注</span></div>
            ${renderReportTraceability(traceability)}
          </section>
          <section class="report-detail-section">
            <div class="report-detail-heading"><h3>验证成熟度</h3><span class="report-state ${maturity.readyCount === maturity.totalCount ? "ready" : "review"}">${maturity.label}</span></div>
            <div class="report-check-list">${maturity.checks.map((check) => `<div class="report-check ${check.state}"><span>${escapeHtml(check.statusLabel)}</span><div><b>${escapeHtml(check.label)}</b><small>${escapeHtml(check.detail)}</small></div></div>`).join("")}</div>
          </section>
          <section class="report-detail-section">
            <div class="report-detail-heading"><h3>红方审阅</h3><span class="report-state ${report.validation?.redTeamReview?.mode === "ai" ? "ready" : "review"}">${redTeamReportLabel(report.validation?.redTeamReview)}</span></div>
            ${renderReportRedTeamReview(report.validation)}
          </section>
          <section class="report-detail-section">
            <div class="report-detail-heading"><h3>Obsidian 反向归档</h3><span class="report-state ${obsidianArchive ? "ready" : "pending"}">${obsidianArchive ? "已写入" : "未写入"}</span></div>
            ${renderObsidianArchive(obsidianArchive)}
          </section>
          <section class="report-detail-section">
            <div class="report-detail-heading"><h3>报告版本</h3><span class="report-state ${versions.length ? "ready" : "pending"}">${versions.length ? `${versions.length} 个归档` : "未归档"}</span></div>
            ${renderProjectStorageState(state.reportStorage, { refreshAction: "refresh-project-reportArchives" })}
            ${renderReportVersions(versions)}
          </section>
          <section class="report-detail-section">
            <div class="report-detail-heading"><h3>版本治理</h3><span class="report-state ${report.modelGovernance?.snapshotCount ? "ready" : "pending"}">${report.modelGovernance?.snapshotCount || 0} 份快照</span></div>
            ${renderProjectStorageState(state.modelSnapshotStorage, { refreshAction: "refresh-project-modelSnapshots" })}
            ${renderReportModelGovernance(report.modelGovernance)}
          </section>
          ${renderModelSnapshotPanel({ snapshots: modelSnapshots, comparison: state.modelComparison, settings: state.modelComparisonSettings })}
        </div>
      </div>
    </section>
  `;
}

function renderObsidianArchive(archive) {
  if (!archive) return `<p class="report-empty">写入时由用户选择本地 Obsidian Vault；系统仅记录最近一次写入的文件名和文件夹名称，不保留目录权限。</p>`;
  return `<div class="report-facts"><span>Vault<b>${escapeHtml(archive.directoryName)}</b></span><span>归档目录<b>${escapeHtml(archive.folderName || archive.fileName)}</b></span><span>笔记<b>${archive.fileCount || 1} 篇</b></span><span>写入时间<b>${escapeHtml(formatReportVersionTime(archive.archivedAt))}</b></span><span>内容<b>ConceptBrief、OV-5、OODA 与反向链接</b></span></div>`;
}

function renderReportModelGovernance(governance) {
  if (!governance?.snapshotCount) return `<p class="report-empty">尚未保存模型快照；归档报告时将保留当前工作状态，但不形成可恢复模型版本。</p>`;
  const latest = governance.latestSnapshot || {};
  const comparison = governance.comparison;
  const comparisonHtml = comparison
    ? `<article><b>${escapeHtml(comparison.baseline?.label)} -> ${escapeHtml(comparison.candidate?.label)}</b><small>${escapeHtml(comparison.summary)}${comparison.quantitative ? ` · 量化总分 ${comparison.quantitative.baseline?.total ?? 0} -> ${comparison.quantitative.candidate?.total ?? 0}` : ""}</small></article>`
    : `<article><b>尚未对比</b><small>选择两份模型快照后可查看并导出结构与指标差异。</small></article>`;
  return `<div class="report-evidence-list"><article><b>${escapeHtml(latest.label)}</b><small>最近快照 · ${escapeHtml(latest.direction)} · ${escapeHtml(formatReportVersionTime(latest.savedAt))}</small></article>${comparisonHtml}</div>`;
}

function renderReportEvidence(knowledge) {
  if (!knowledge) return `<p class="report-empty">连接本地 Vault 后将汇总与活动引用匹配的证据片段。</p>`;
  if (!knowledge.evidence.entries.length) {
    const unresolved = knowledge.evidence.unresolvedTerms.length ? `待匹配：${knowledge.evidence.unresolvedTerms.map(escapeHtml).join("、")}` : "当前活动尚未标注知识引用。";
    return `<p class="report-empty">${unresolved}</p>`;
  }
  const unresolved = knowledge.evidence.unresolvedTerms.length
    ? `<p class="report-unresolved">待补充：${knowledge.evidence.unresolvedTerms.map(escapeHtml).join("、")}</p>`
    : "";
  return `<div class="report-evidence-list">${knowledge.evidence.entries.map((item) => `<article><b>${escapeHtml(item.title)}</b><span>匹配：${item.matchedTerms.map(escapeHtml).join("、")}</span><small>${escapeHtml(item.summary)}</small></article>`).join("")}</div>${unresolved}`;
}

function renderReportProjectRepository(repository) {
  if (!repository?.resources?.length) return `<p class="report-empty">当前成果由浏览器本地草稿组成，尚未获得项目仓储版本信息。</p>`;
  return `<div class="report-evidence-list">${repository.resources.map((resource) => {
    const lineage = [
      resource.briefRevision !== undefined && `简报 r${resource.briefRevision}`,
      resource.ov1Revision !== undefined && `OV-1 r${resource.ov1Revision}`,
      resource.ov5Revision !== undefined && `OV-5 r${resource.ov5Revision}`,
      resource.oodaRevision !== undefined && `OODA r${resource.oodaRevision}`,
      resource.scenarioRevision !== undefined && `想定 r${resource.scenarioRevision}`,
      resource.validationRevision !== undefined && `验证 r${resource.validationRevision}`
    ].filter(Boolean).join(" / ");
    const revision = resource.id === "brief"
      ? `项目 r${resource.revision} · 简报 r${resource.resourceRevision}`
      : `项目 r${resource.revision} · 资源 r${resource.resourceRevision}`;
    return `<article><b>${escapeHtml(resource.label)} · ${escapeHtml(resource.mode)}</b><span>${revision}${lineage ? ` · ${escapeHtml(lineage)}` : ""}</span><small>${escapeHtml(resource.detail)}</small></article>`;
  }).join("")}</div>`;
}

function renderReportInspiration(inspiration) {
  if (!inspiration?.summary) return `<p class="report-empty">尚未记录灵感孵化会话。</p>`;
  const messages = inspiration.messages || [];
  return `<div class="report-evidence-list"><article><b>会话摘要</b><small>${escapeHtml(inspiration.summary)}</small></article>${messages.map((message) => `<article><b>${message.role === "user" ? "研究人员" : "孵化助手"}</b><small>${escapeHtml(message.text)}</small></article>`).join("")}</div>`;
}

function renderReportOv1(ov1) {
  const nodes = ov1?.nodes || [];
  if (!nodes.length) return `<p class="report-empty">当前报告未保存 OV-1 总体概念节点。</p>`;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const relationships = (ov1?.edges || []).map((edge) => `${nodeById.get(edge.sourceId)?.label || edge.sourceId} -> ${nodeById.get(edge.targetId)?.label || edge.targetId}（${edge.type}）`);
  return `<div class="report-evidence-list">${nodes.map((node) => `<article><b>${escapeHtml(node.label)}</b><small>${escapeHtml(node.description)}</small></article>`).join("")}${relationships.length ? `<article><b>概念关系</b><small>${relationships.map(escapeHtml).join("；")}</small></article>` : ""}</div>`;
}

function renderReportDerivedOperationalViews(report) {
  const ov5a = report.ov5a || {};
  const ov6a = report.ov6a || {};
  const ov6b = report.ov6b || {};
  const ov6c = report.ov6c || {};
  const diagnostics = report.validation?.derivedOperationalDiagnostics;
  const hierarchyCount = ov5a.decompositions?.length || 0;
  const notes = diagnostics?.issues?.length
    ? `<p class="report-unresolved">${diagnostics.issues.map((issue) => escapeHtml(issue.title)).join("、")}</p>`
    : "";
  return `<div class="report-facts"><span>OV-5a<b>${hierarchyCount} 条分解关系</b></span><span>OV-6a<b>${ov6a.rules?.length || 0} 条规则</b></span><span>OV-6b<b>${ov6b.transitions?.length || 0} 条转换</b></span><span>OV-6c<b>${ov6c.events?.length || 0} 个事件</b></span></div>${notes}<p class="report-empty">OV-5a 只维护活动父子引用；活动正文由 OV-5b 维护。OV-6a 与 OV-6b 继续从权威来源派生。</p>`;
}

function reportStateClass(status) {
  if (["已推送", "已回传调整"].includes(status)) return "ready";
  if (status === "未配置") return "pending";
  return "review";
}

function redTeamReportLabel(review) {
  if (!review) return "未生成";
  return review.mode === "ai" ? "AI 审阅" : "本地规则";
}

function renderReportRedTeamReview(validation) {
  const review = validation?.redTeamReview;
  if (!review) return `<p class="report-empty">${escapeHtml(validation?.redTeam || "尚未生成红方质询。")} </p>`;
  return `
    <p class="report-red-team-summary">${escapeHtml(review.summary)}</p>
    ${review.evidenceSelection ? `<p class="report-evidence-selection">${escapeHtml(formatEvidenceSelection(review.evidenceSelection))}</p>` : ""}
    <div class="report-red-team-list">${review.findings.length ? review.findings.map((finding) => `<article class="${finding.severity}"><div><b>${escapeHtml(finding.title)}</b><span>${finding.severity === "high" ? "高优先级" : finding.severity === "low" ? "低优先级" : "待复核"}</span></div><p>${escapeHtml(finding.analysis)}</p><small>建议：${escapeHtml(finding.recommendation)}</small>${finding.evidenceRefs.length ? `<em>证据：${finding.evidenceRefs.map(escapeHtml).join("、")}</em>` : ""}</article>`).join("") : `<p class="report-empty">未返回具体质询项。</p>`}</div>
  `;
}

function formatEvidenceSelection(selection) {
  if (!selection || typeof selection !== "object") return "";
  const source = selection.source === "server" ? "服务端项目证据" : "本地 Vault 证据";
  const revision = selection.source === "server" ? ` · 项目 r${Number(selection.projectRevision || 0)} / 索引 r${Number(selection.resourceRevision || 0)}` : "";
  return `${source} · ${Number(selection.count || 0)} 条${revision}${selection.fallback ? " · 已回退" : ""}`;
}

function renderReportVersions(versions) {
  if (!versions.length) return `<p class="report-empty">当前导出为未归档草稿。归档后会固定模型、验证、证据和部署桥接快照。</p>`;
  return `<div class="report-version-list">${versions.map((version) => `<article><div><b>${escapeHtml(version.label)}</b><small>${escapeHtml(formatReportVersionTime(version.savedAt))} · ${escapeHtml(version.reportTemplate?.label || "研究通用")} · ${version.integrity?.digest ? "SHA-256 清单" : "未校验"} · ${escapeHtml(version.maturity?.label || "待完善")}（${Number(version.maturity?.readyCount || 0)}/${Number(version.maturity?.totalCount || 0)}）</small></div><div class="report-version-actions"><button class="quiet-button" data-version-export="markdown" data-version-id="${escapeHtml(version.id)}">Markdown</button><button class="quiet-button" data-version-export="json" data-version-id="${escapeHtml(version.id)}">JSON</button><button class="quiet-button" data-version-export="xml" data-version-id="${escapeHtml(version.id)}">XML</button><button class="quiet-button" data-version-export="docx" data-version-id="${escapeHtml(version.id)}">Word</button><button class="quiet-button" data-version-export="pdf" data-version-id="${escapeHtml(version.id)}">PDF</button><button class="quiet-button" data-version-export="pptx" data-version-id="${escapeHtml(version.id)}">PPTX</button>${version.integrity?.digest ? `<button class="quiet-button" data-version-verify="${escapeHtml(version.id)}">校验</button>` : ""}<button class="quiet-button" data-version-delete="${escapeHtml(version.id)}">删除</button></div></article>`).join("")}</div>`;
}

function formatReportVersionTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString("zh-CN", { hour12: false });
}

export function selectionFor(type, id, models = {}) {
  if (type === "activity") {
    const item = (models.ov5?.activities || activities).find((entry) => entry.id === id);
    if (!item) return null;
    const nodeById = new Map((models.ov1?.nodes || []).map((node) => [String(node.id), node]));
    const sources = (item.sourceOv1NodeIds || []).map((sourceId) => nodeById.get(String(sourceId))?.label || sourceId).filter(Boolean).join("、") || "未挂接";
    return { id: item.id, kind: "activity", title: item.title, status: "活动节点", text: item.text, facts: [["活动类型", item.type], ["输入", item.input], ["输出", item.output], ["预计耗时", item.duration], ["OV-1 来源", sources]], refs: item.refs };
  }
  if (type === "ov1") {
    return selectionForOv1(id, models.ov1);
  }
  if (type === "ov2-exchange") {
    return selectionForOv2Exchange(id, models);
  }
  if (type === "ov3-exchange") {
    return selectionForOv3Exchange(id, models);
  }
  if (type === "ov4-role") return selectionForOv4Role(id, models);
  if (type === "ov4-relation") return selectionForOv4Relation(id, models);
  if (type === "ov6c-event") {
    return selectionForOv6cEvent(id, models);
  }
  if (type === "ooda") {
    return selectionForOoda(id, models);
  }
  if (type === "unit") {
    return selectionForScenarioUnit(id, models.scenario);
  }
  if (type === "issue") {
    return selectionForValidationIssue(id, models.validationResult);
  }
  if (type === "knowledge") {
    return selectionForKnowledgeNote(id, models.knowledge);
  }
  return null;
}

function renderActivityInspector(selection, context) {
  const model = context.ov5;
  const activity = (model?.activities || []).find((item) => item.id === selection.id) || {};
  const options = (model?.activities || []).filter((item) => item.id !== selection.id)
    .map((item) => `<option value="${item.id}">${item.title}</option>`).join("");
  const parentOptions = getAssignableParentActivities(model, selection.id)
    .map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === activity.parentId ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("");
  const refs = (selection.refs || []).join("、");
  const sourceIds = new Set((activity.sourceOv1NodeIds || []).map((id) => String(id)));
  const ov1Nodes = Array.isArray(context.ov1?.nodes) ? context.ov1.nodes : [];
  const selectedCount = ov1Nodes.filter((node) => sourceIds.has(String(node.id))).length;
  const sourceOptions = ov1Nodes.map((node) => {
    const id = String(node.id);
    const checked = sourceIds.has(id);
    const kind = kindLabel(node.kind || node.category);
    return `<label class="ov1-source-option ${checked ? "selected" : ""}">
      <input type="checkbox" name="sourceOv1NodeIds" value="${escapeHtml(id)}" ${checked ? "checked" : ""}>
      <span class="ov1-source-option-body">
        <strong>${escapeHtml(node.label || id)}</strong>
        <small>${escapeHtml(kind)}${node.category && node.category !== kind ? ` · ${escapeHtml(node.category)}` : ""}</small>
      </span>
    </label>`;
  }).join("");
  return `
    <form class="activity-editor" id="ov5ActivityForm">
      <label>活动名称<input name="title" value="${escapeHtml(selection.title)}"></label>
      <label>活动类型<input name="type" value="${escapeHtml(selection.facts[0][1])}"></label>
      <label>输入信息<textarea name="input" rows="2">${escapeHtml(selection.facts[1][1])}</textarea></label>
      <label>输出信息<textarea name="output" rows="2">${escapeHtml(selection.facts[2][1])}</textarea></label>
      <label>预计耗时<input name="duration" value="${escapeHtml(selection.facts[3][1])}"></label>
      <label>父活动<select name="parentId"><option value="">无（顶层活动）</option>${parentOptions}</select></label>
      <label>资源消耗 / 需求<textarea name="resources" rows="2">${escapeHtml(activity.resources || "")}</textarea></label>
      <label>前置条件<textarea name="preconditions" rows="2">${escapeHtml(activity.preconditions || "")}</textarea></label>
      <label>时间与规则约束<textarea name="constraints" rows="2">${escapeHtml(activity.constraints || "")}</textarea></label>
      <label>活动说明<textarea name="text" rows="3">${escapeHtml(selection.text)}</textarea></label>
      <label>知识依据<input name="refs" value="${escapeHtml(refs)}"></label>
      <fieldset class="trace-source-field ov1-source-picker">
        <legend>来源 OV-1 节点 <span class="ov1-source-count" data-ov1-source-count>${selectedCount}/${ov1Nodes.length || 0} 已选</span></legend>
        <p class="ov1-source-hint">可多选。来源决定 OV-2/OV-4 映射与跨视图追溯；保存后生效。空的输入/输出可在工具栏「补全映射质量」中从已选 OV-1 节点与相邻边回填。</p>
        <div class="ov1-source-list" data-ov1-source-list>${sourceOptions || `<small>尚无可关联的 OV-1 节点。请先在 OV-1 建立概念主体。</small>`}</div>
        <div class="ov1-source-actions">
          <button type="button" class="quiet-button" data-ov1-source-suggest="${escapeHtml(selection.id)}" ${ov1Nodes.length ? "" : "disabled"}>按类型建议</button>
          <button type="button" class="quiet-button" data-ov1-source-clear ${ov1Nodes.length ? "" : "disabled"}>清空选择</button>
          <button type="button" class="quiet-button" data-action="apply-mapping-quality" title="仅补全空字段">补全空 I/O</button>
        </div>
      </fieldset>
      <div class="editor-actions"><button type="submit">保存活动</button><button type="button" class="quiet-button" data-inspector-action="delete-activity">删除</button></div>
    </form>
    <section class="inspector-section">
      <h3>新增关联</h3>
      <form class="edge-editor" id="ov5EdgeForm">
        <select name="targetId" ${options ? "" : "disabled"}><option value="">选择下游活动</option>${options}</select>
        <select name="type"><option>信息流</option><option>控制流</option><option>资源流</option></select>
        <label>交换载荷<textarea name="payload" rows="2" placeholder="数据、资源或指令内容"></textarea></label>
        <label>触发 / 顺序条件<textarea name="condition" rows="2" placeholder="满足条件后执行"></textarea></label>
        <button type="submit" ${options ? "" : "disabled"}>建立关联</button>
      </form>
    </section>
  `;
}

function kindLabel(kind) {
  return ({
    equipment: "装备平台",
    command: "指挥节点",
    action: "关键动作",
    participant: "作战主体",
    external: "外部对象",
    environment: "环境要素",
    effect: "预期效果",
    sense: "感知",
    decide: "决策",
    control: "控制",
    opponent: "外部",
    assess: "评估"
  })[kind] || kind || "概念节点";
}

function renderTraceabilitySection(selection, context) {
  if (!selection || !["ov1", "activity", "ooda", "unit"].includes(selection.kind)) return "";
  const targets = getTraceTargets(selection, context);
  const traceability = buildTraceability(context);
  const mapped = traceability.summary.mappedActivityCount;
  const total = traceability.summary.activityCount;
  if (!targets.length) {
    return `<section class="inspector-section traceability-section"><h3>跨视图追溯</h3><p>尚未找到可跳转的上下游对象。可在 OV-5 活动中补充来源 OV-1 节点，或重新派生下游模型。</p><small>${mapped}/${total} 项活动已关联 OV-1。</small></section>`;
  }
  return `<section class="inspector-section traceability-section"><h3>跨视图追溯</h3><p>${mapped}/${total} 项 OV-5 活动已关联总体概念节点。</p><div class="trace-link-list">${targets.map((target) => `<button class="quiet-button" type="button" data-trace-jump-kind="${escapeHtml(target.kind)}" data-trace-jump-id="${escapeHtml(target.id)}" data-trace-jump-view="${escapeHtml(target.view)}"><small>${escapeHtml(target.relation)}</small><span>${escapeHtml(target.label)}</span></button>`).join("")}</div></section>`;
}

function renderReportTraceability(traceability) {
  if (!traceability?.activities?.length) return `<p class="report-empty">尚无可追溯的 OV-5 活动。</p>`;
  const orphaned = traceability.summary.orphanedOv1SourceIds.length
    ? `<p class="report-unresolved">无效 OV-1 引用：${traceability.summary.orphanedOv1SourceIds.map(escapeHtml).join("、")}</p>`
    : "";
  return `<div class="report-evidence-list">${traceability.activities.map((row) => {
    const source = row.sourceOv1Nodes.length ? row.sourceOv1Nodes.map((node) => node.label).join("、") : "待标注";
    const downstream = [`OODA ${row.linkedOodaNodes.length} 项`, `想定实体 ${row.linkedEntities.length} 个`, `事件 ${row.linkedTimeline.length} 条`].join(" · ");
    return `<article><b>${escapeHtml(row.title)}</b><span>OV-1：${escapeHtml(source)}</span><small>${escapeHtml(downstream)}</small></article>`;
  }).join("")}</div>${orphaned}`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[character]));
}
