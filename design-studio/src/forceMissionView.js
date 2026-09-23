import { escapeHtml } from "./app/domUtils.js";
import {
  forceMissionPlanIncompleteReasons,
  isForceMissionPlanConfirmed,
  listCmoMissionTypes
} from "./forceMissionStore.js";
import { renderPlanningMigrationBanner } from "./planningContext.js";
import {
  renderResearchChatDock,
  renderResearchChatFloatButton,
  renderResearchChatPanel
} from "./researchChat/researchChatView.js";

const PLATFORM_DOMAINS = [
  { id: "", label: "全部域" },
  { id: "aircraft", label: "飞机" },
  { id: "ship", label: "舰船" },
  { id: "submarine", label: "潜艇" },
  { id: "ground", label: "地面" },
  { id: "facility", label: "设施" },
  { id: "satellite", label: "卫星" }
];

/**
 * 作战兵力研究台。
 * 闭环：上游就绪 → 概念兵力 → 作战编成 → 点改/对话 → 确认 → 下游作战概念图。
 */
export function renderForceMission(state) {
  const plan = state.forceMission || {};
  const drawerEnter = Boolean(state.forceDetailDrawerEnter);
  const generating = Boolean(state.forceMissionGenerating);
  const chatGenerating = Boolean(state.forceMissionChatGenerating);
  const hasDraft = (Array.isArray(plan.forces) && plan.forces.length > 0)
    || (Array.isArray(plan.combatForces) && plan.combatForces.length > 0);
  const confirmed = isForceMissionPlanConfirmed(plan, state.forceMissionStorage);
  const chatOpen = Boolean(state.forceMissionChatOpen) && hasDraft;
  const status = state.forceMissionStorage?.stale
    ? "已过期"
    : confirmed
      ? "已确认"
      : plan.status === "draft"
        ? "草案待复核"
        : "待生成";
  const forces = Array.isArray(plan.forces) ? plan.forces : [];
  const combatForces = Array.isArray(plan.combatForces) ? plan.combatForces : [];
  const upstream = describeUpstream(state);
  const cmo = state.cmoCatalogStatus || {};
  const missionTypes = listCmoMissionTypes();
  const picker = state.forcePlatformPicker || {};
  const recommend = state.forcePlatformRecommend || {};
  const catalogOpen = Boolean(cmo.open);
  const generatingLayer = state.forceMissionGeneratingLayer || "";
  const busy = generating || chatGenerating || Boolean(recommend.running);
  // 已确认后仍可点改；改动会把计划降回草案，形成「改 → 再确认」闭环。
  const editable = hasDraft && !generating && !recommend.running && !chatGenerating;
  const tasksReady = Boolean(plan.tasks?.length && plan.tasksConfirmedAt);
  const canConfirm = tasksReady && forces.length > 0 && combatForces.length > 0 && !confirmed && !busy;
  const canGenerateConcept = tasksReady && !busy && upstream.canGenerate;
  const canGenerateCombat = tasksReady && !busy && upstream.canGenerate && forces.length > 0;
  const phases = [...(Array.isArray(state.phaseAction?.phases) ? state.phaseAction.phases : [])]
    .filter((phase) => phase?.id)
    .sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0));
  const focusId = resolveForceMissionFocusId(state, phases);
  const focusPhase = phases.find((phase) => phase.id === focusId) || null;
  const phaseConceptForces = filterConceptForcesForPhase(forces, focusId, phases.length > 0);
  const phaseCombatForces = filterCombatForcesForPhase(combatForces, forces, focusId, phases.length > 0);
  const phaseLabel = focusPhase
    ? `阶段${focusPhase.sequence || ""} ${focusPhase.name || focusPhase.id}`
    : (phases.length ? "未选阶段" : "全部");
  const layerTab = state.forceMissionLayerTab === "combat" ? "combat" : "concept";
  const conceptCountLabel = formatPhaseSideCounts(phaseConceptForces);
  const combatCountLabel = formatPhaseSideCounts(phaseCombatForces);
  const conceptMissingEquip = forces.filter((force) => !formatConceptEquipment(force)).length;
  const combatMissingPlatform = combatForces.filter((force) => !(force.platforms || []).length).length;
  const combatUnlinked = combatForces.filter((force) => !force.conceptForceId).length;
  const incomplete = confirmed
    ? []
    : forceMissionPlanIncompleteReasons(plan, state.forceMissionStorage)
      .filter((reason) => reason !== "确认兵力与任务");
  const workflow = resolveWorkflowProgress({
    upstream,
    forces,
    combatForces,
    confirmed,
    stale: Boolean(state.forceMissionStorage?.stale),
    busy,
    generatingLayer,
    recommendRunning: Boolean(recommend.running)
  });

  const conceptBody = phaseConceptForces.length
    ? renderConceptForceRoster(phaseConceptForces, {
      tasks: plan.tasks || [],
      picker,
      catalogOpen,
      editable,
      confirmed,
      drawerEnter
    })
    : renderLayerEmpty({
      kind: "concept",
      hasGlobal: forces.length > 0,
      canGenerate: canGenerateConcept,
      generating: generating && (generatingLayer === "concept" || generatingLayer === "both"),
      phaseLabel
    });

  const combatBody = phaseCombatForces.length
    ? renderCombatCompositionTables(phaseCombatForces, {
      tasks: plan.tasks || [],
      missionTypes,
      conceptForces: forces,
      picker,
      catalogOpen,
      editable,
      confirmed,
      drawerEnter
    })
    : renderLayerEmpty({
      kind: "combat",
      hasGlobal: combatForces.length > 0,
      hasConcept: forces.length > 0,
      canGenerate: canGenerateCombat,
      generating: generating && (generatingLayer === "combat" || generatingLayer === "both"),
      phaseLabel
    });

  const conceptBtnLabel = generating && (generatingLayer === "concept" || generatingLayer === "both")
    ? "正在生成概念兵力…"
    : forces.length ? "重新生成概念兵力" : "生成概念兵力";
  const combatBtnLabel = generating && (generatingLayer === "combat" || generatingLayer === "both")
    ? "正在生成作战兵力…"
    : combatForces.length ? "重新生成作战兵力" : "生成作战兵力";
  const confirmBtnLabel = confirmed ? "已确认" : "确认并进入作战概念图";
  const canRecommendCombat = !busy && catalogOpen && combatForces.length > 0;

  const mainBody = `
    ${renderForceMissionChrome({
      workflow,
      canConfirm,
      incomplete,
      conceptMissingEquip,
      combatMissingPlatform,
      combatUnlinked,
      catalogOpen,
      confirmed,
      generating,
      generatingLayer,
      recommendRunning: recommend.running
    })}
    <div class="force-mission-workbench">
      <div class="force-mission-left">
        ${renderForceMissionRail({
          phases,
          focusId,
          conceptForces: forces,
          combatForces
        })}
        ${renderForceMissionRailActions({
          workflow,
          canGenerateConcept,
          canGenerateCombat,
          canConfirm,
          canRecommendCombat,
          conceptBtnLabel,
          combatBtnLabel,
          confirmBtnLabel,
          recommendRunning: recommend.running
        })}
      </div>
      <div class="force-mission-body" data-force-phase-panel="${escapeAttribute(focusId || "all")}">
        <article class="planning-card force-layer-pager" aria-label="兵力名单">
          <div class="force-layer-toolbar">
            <div class="force-layer-seg" role="tablist" aria-label="概念与作战">
              <button type="button"
                class="force-layer-seg-btn ${layerTab === "concept" ? "is-selected" : ""} ${workflow.step === "concept" && !confirmed ? "is-current-step" : ""}"
                role="tab"
                aria-selected="${layerTab === "concept" ? "true" : "false"}"
                data-action="select-force-mission-layer"
                data-layer="concept">
                <span class="force-layer-seg-index">1</span>
                <span class="force-layer-seg-copy">
                  <strong>概念兵力</strong>
                  <small title="当前阶段">${escapeHtml(conceptCountLabel)}</small>
                </span>
                ${conceptMissingEquip ? `<span class="force-layer-seg-badge is-warn">${conceptMissingEquip}</span>` : forces.length ? `<span class="force-layer-seg-badge is-ok">✓</span>` : ""}
              </button>
              <button type="button"
                class="force-layer-seg-btn ${layerTab === "combat" ? "is-selected" : ""} ${workflow.step === "combat" && !confirmed ? "is-current-step" : ""}"
                role="tab"
                aria-selected="${layerTab === "combat" ? "true" : "false"}"
                data-action="select-force-mission-layer"
                data-layer="combat"
                ${forces.length ? "" : "disabled"}>
                <span class="force-layer-seg-index">2</span>
                <span class="force-layer-seg-copy">
                  <strong>作战编成</strong>
                  <small title="当前阶段">${escapeHtml(combatCountLabel)}</small>
                </span>
                ${!forces.length
                  ? ""
                  : combatMissingPlatform
                    ? `<span class="force-layer-seg-badge is-warn">${combatMissingPlatform}</span>`
                    : combatForces.length
                      ? `<span class="force-layer-seg-badge is-ok">✓</span>`
                      : ""}
              </button>
            </div>
            <div class="force-layer-toolbar-meta">
              <span class="force-layer-phase-label">${escapeHtml(phaseLabel)}</span>
              ${layerTab === "combat" && combatUnlinked > 0
                ? `<span class="mini-tag review">${combatUnlinked} 未挂概念</span>`
                : layerTab === "concept" && conceptMissingEquip > 0
                  ? `<span class="mini-tag review">${conceptMissingEquip} 待挂装备</span>`
                  : confirmed
                    ? ""
                    : `<span class="mini-tag">${escapeHtml(status)}</span>`}
            </div>
          </div>
          <div class="force-layer-panel" role="tabpanel">
            ${!catalogOpen && hasDraft
              ? `<p class="planning-meta force-catalog-hint">CMO 装备目录未连接：可继续审阅职责与任务；挂接真实平台请到系统管理配置 DB3。</p>`
              : ""}
            ${layerTab === "combat" ? combatBody : conceptBody}
          </div>
        </article>
      </div>
    </div>`;

  return `<section class="planning-page force-mission-page force-mission-page--bench ${chatOpen ? "is-chat-open" : "is-chat-collapsed"}">
    ${renderPlanningMigrationBanner(state)}
    ${renderUpstreamBanners(upstream)}
    <div class="phase-workbench ${chatOpen ? "is-chat-open" : "is-chat-collapsed"}" aria-label="作战兵力研究台">
      <div class="force-mission-main-stage">
        ${mainBody}
      </div>
      ${renderResearchChatDock({
        scope: "phase",
        open: chatOpen,
        dockId: "forceMissionChatDock",
        label: "兵力修订对话侧栏",
        contentHtml: renderForceMissionChatPanel({
          chat: state.forceMissionChat,
          chatGenerating,
          busy,
          confirmed,
          hasDraft,
          plan
        })
      })}
    </div>
  </section>`;
}

/** Topbar floating FAB — same host/position as phase-action / OV-1. */
export function renderForceMissionChatFloatButton({ chatOpen = false, chatGenerating = false, disabled = false } = {}) {
  return renderResearchChatFloatButton({
    scope: "force-mission",
    open: chatOpen,
    generating: chatGenerating,
    disabled,
    titleOpen: "收起修订对话",
    titleClosed: "打开修订对话",
    action: "toggle-force-mission-chat"
  });
}

function renderForceMissionChatPanel({ chat, chatGenerating, busy, confirmed, hasDraft, plan }) {
  const disabled = busy || confirmed || !hasDraft;
  const disabledReason = confirmed
    ? "本步已确认，如需修改请先重新生成草案"
    : !hasDraft
      ? "请先生成兵力与任务草案，再通过对话修订"
      : busy && !chatGenerating
        ? "兵力生成进行中，请稍候"
        : "";
  const footerHtml = `<div class="phase-review-chat-footer">
        <button type="button" data-action="confirm-force-mission" ${busy || chatGenerating || !hasDraft || confirmed ? "disabled" : ""}>${confirmed ? "已确认" : "确认并进入作战概念图"}</button>
        <p class="planning-meta">生成来源：${escapeHtml(plan.generation?.source || "—")} · 概念 ${Array.isArray(plan.forces) ? plan.forces.length : 0} · 作战 ${Array.isArray(plan.combatForces) ? plan.combatForces.length : 0}</p>
      </div>`;
  return renderResearchChatPanel({
    scope: "force-mission",
    session: chat,
    generating: chatGenerating,
    title: "核验对话",
    subtitle: "用自然语言修订概念/作战兵力与关系，中间栏即时同步。",
    statusLabel: chatGenerating ? "正在修订" : confirmed ? "已确认" : "研究助手",
    placeholder: confirmed ? "本步已确认，如需修改请先重新生成草案" : "输入修订要求，例如：补充护航分队；主战任务改为 SEAD",
    emptyTitle: "开始核验修订",
    emptyText: "例如：为阶段 2 增加预警概念单元；作战兵力挂接主攻概念编组。",
    disabled,
    disabledReason,
    className: "phase-review-chat",
    interactiveTopic: "revision",
    headerActionsHtml: `<button type="button" class="phase-chat-close" data-action="close-force-mission-chat" title="收起对话" aria-label="收起对话"><span aria-hidden="true">×</span></button>`,
    footerHtml
  });
}

function resolveWorkflowProgress({
  upstream,
  forces = [],
  combatForces = [],
  confirmed = false,
  stale = false,
  busy = false,
  generatingLayer = "",
  recommendRunning = false
}) {
  const hasConcept = forces.length > 0;
  const hasCombat = combatForces.length > 0;
  let step = "upstream";
  let primaryAction = "";
  if (!upstream.canGenerate) {
    step = "upstream";
    primaryAction = "";
  } else if (!hasConcept) {
    step = "concept";
    primaryAction = "concept";
  } else if (!hasCombat) {
    step = "combat";
    primaryAction = "combat";
  } else if (!confirmed || stale) {
    step = "confirm";
    primaryAction = confirmed && stale ? "concept" : "confirm";
  } else {
    step = "done";
    primaryAction = "";
  }
  if (busy) {
    if (generatingLayer === "combat") primaryAction = "combat";
    else if (generatingLayer === "concept" || generatingLayer === "both") primaryAction = "concept";
    else if (recommendRunning) primaryAction = "";
  }
  return {
    step,
    primaryAction,
    hasConcept,
    hasCombat,
    confirmed: confirmed && !stale,
    stale,
    busy
  };
}

function renderForceMissionChrome({
  workflow = {},
  canConfirm,
  incomplete = [],
  conceptMissingEquip = 0,
  combatMissingPlatform = 0,
  combatUnlinked = 0,
  catalogOpen = false,
  confirmed = false,
  generating = false,
  generatingLayer = "",
  recommendRunning = false
}) {
  const steps = [
    {
      id: "concept",
      index: "1",
      title: "概念兵力",
      done: workflow.hasConcept,
      active: workflow.step === "concept"
    },
    {
      id: "combat",
      index: "2",
      title: "作战编成",
      done: workflow.hasCombat,
      active: workflow.step === "combat",
      locked: !workflow.hasConcept
    },
    {
      id: "confirm",
      index: "3",
      title: "确认放行",
      done: workflow.confirmed,
      active: workflow.step === "confirm" || workflow.step === "done",
      locked: !workflow.hasConcept || !workflow.hasCombat
    }
  ];
  let tone = "";
  let message = "";
  const actions = [];
  if (!workflow || workflow.step === "upstream") {
    tone = "is-warn";
    message = "请先完成简报与阶段，再生成概念兵力。";
  } else if (generating) {
    message = generatingLayer === "combat"
      ? "正在生成作战兵力…"
      : (generatingLayer === "concept" || generatingLayer === "both")
        ? "正在生成概念兵力…"
        : "正在生成…";
  } else if (recommendRunning) {
    message = "正在挂接平台…";
  } else if (confirmed && !workflow.stale) {
    tone = "is-ready";
    message = "兵力与任务已确认。若再改动将回到草案。";
  } else if (workflow.stale) {
    tone = "is-warn";
    message = "上游变更导致本步已过期。请重新生成概念/作战兵力并确认。";
  } else if (workflow.step === "concept") {
    message = "下一步：生成概念兵力（红蓝职责名单，按阶段归属）。";
  } else if (workflow.step === "combat") {
    message = `概念兵力已就绪。下一步生成作战编成。${conceptMissingEquip ? ` ${conceptMissingEquip} 个概念单元尚未挂装备。` : ""}`;
    actions.push(`<button type="button" class="quiet-button" data-action="select-force-mission-layer" data-layer="concept">回看概念兵力</button>`);
  } else if (workflow.step === "confirm") {
    const hints = [];
    if (incomplete.length) hints.push(...incomplete);
    if (combatUnlinked > 0) hints.push(`${combatUnlinked} 行作战编成未挂概念`);
    if (combatMissingPlatform > 0) hints.push(`${combatMissingPlatform} 行尚无平台`);
    if (!catalogOpen && combatMissingPlatform > 0) hints.push("装备目录未连接，平台可稍后补");
    if (canConfirm) {
      tone = "is-ready";
      message = "两层草案已齐。复核后确认，将自动进入作战概念图。";
    } else {
      tone = "is-warn";
      message = `两层草案已齐。尚不能确认：${hints.join("；") || "请检查草案完整性"}`;
    }
    actions.push(`<button type="button" class="quiet-button" data-action="select-force-mission-layer" data-layer="combat">检查作战编成</button>`);
  }
  return `<header class="force-mission-chrome ${tone}" aria-label="兵力步骤与状态">
    <ol class="force-mission-steps">
      ${steps.map((step) => `
        <li class="force-mission-step ${step.done ? "is-done" : ""} ${step.active ? "is-active" : ""} ${step.locked ? "is-locked" : ""}">
          <span class="force-mission-step-index">${step.done ? "✓" : step.index}</span>
          <span class="force-mission-step-title">${escapeHtml(step.title)}</span>
        </li>`).join("")}
    </ol>
    <p class="force-mission-chrome-msg">${escapeHtml(message)}</p>
    ${actions.length ? `<div class="force-mission-chrome-actions">${actions.join("")}</div>` : ""}
  </header>`;
}

function renderForceMissionRail({
  phases = [],
  focusId = "",
  conceptForces = [],
  combatForces = []
}) {
  const phaseItems = phases.length
    ? phases.map((phase, index) => {
      const selected = phase.id === focusId;
      const seq = phase.sequence || index + 1;
      const conceptCount = filterConceptForcesForPhase(conceptForces, phase.id, true).length;
      const combatCount = filterCombatForcesForPhase(combatForces, conceptForces, phase.id, true).length;
      return `<button type="button"
        class="force-mission-phase ${selected ? "is-selected" : ""}"
        role="option"
        aria-selected="${selected ? "true" : "false"}"
        data-action="select-phase-action-focus"
        data-phase-id="${escapeAttribute(phase.id)}">
        <span class="force-mission-phase-index">${seq}</span>
        <span class="force-mission-phase-copy">
          <strong>${escapeHtml(phase.name || phase.id)}</strong>
          <small>概念 ${conceptCount} · 作战 ${combatCount}</small>
        </span>
      </button>`;
    }).join("")
    : `<p class="empty-inspector force-mission-phase-empty">暂无阶段。请先生成并确认「阶段与行动」。</p>`;
  return `<aside class="force-mission-rail planning-card" aria-label="阶段">
    <header class="force-mission-rail-head" title="跨阶段单元会在其所属阶段重复出现。">
      <h2>阶段</h2>
      <small>${phases.length ? `${phases.length} 段` : "未就绪"}</small>
    </header>
    <div class="force-mission-phase-list" role="listbox" aria-label="作战阶段">
      ${phaseItems}
    </div>
  </aside>`;
}

function renderForceMissionRailActions({
  workflow = {},
  canGenerateConcept = false,
  canGenerateCombat = false,
  canConfirm = false,
  canRecommendCombat = false,
  conceptBtnLabel = "生成概念兵力",
  combatBtnLabel = "生成作战兵力",
  confirmBtnLabel = "确认并进入作战概念图",
  recommendRunning = false
}) {
  const generateButtons = `<button type="button"
      class="${workflow.primaryAction === "concept" ? "" : "quiet-button"}"
      data-action="generate-concept-forces"
      ${canGenerateConcept ? "" : "disabled"}>${escapeHtml(conceptBtnLabel)}</button>
    <button type="button"
      class="${workflow.primaryAction === "combat" ? "" : "quiet-button"}"
      data-action="generate-combat-forces"
      ${canGenerateCombat ? "" : "disabled"}>${escapeHtml(combatBtnLabel)}</button>
    <button type="button" class="quiet-button" data-action="derive-combat-forces" title="直接从概念兵力快速派生作战编成草案"
      ${canGenerateCombat ? "" : "disabled"}>从概念派生作战</button>
    ${canRecommendCombat ? `<button type="button" class="quiet-button" data-action="recommend-platforms-from-phases"
      ${recommendRunning ? "disabled" : ""}>${recommendRunning ? "正在挂接平台…" : "为作战兵力补挂平台"}</button>` : ""}`;
  const confirmedIdle = Boolean(workflow.confirmed) && !workflow.busy;
  if (confirmedIdle) {
    return `<div class="force-mission-rail-actions planning-actions is-collapsed" aria-label="兵力动作">
      <details class="force-mission-rail-regen">
        <summary>重新生成</summary>
        ${generateButtons}
      </details>
    </div>`;
  }
  return `<div class="force-mission-rail-actions planning-actions" aria-label="兵力动作">
    ${generateButtons}
    <button type="button"
      class="${workflow.primaryAction === "confirm" ? "" : "quiet-button"}"
      data-action="confirm-force-mission"
      ${canConfirm ? "" : "disabled"}>${escapeHtml(confirmBtnLabel)}</button>
  </div>`;
}

function renderLayerEmpty({
  kind = "concept",
  hasGlobal = false,
  hasConcept = false,
  canGenerate = false,
  generating = false,
  phaseLabel = ""
}) {
  if (kind === "concept") {
    if (hasGlobal) {
      return `<div class="force-layer-empty">
        <p class="empty-inspector">「${escapeHtml(phaseLabel)}」暂无概念兵力。可切换其他阶段，或重新生成概念兵力。</p>
      </div>`;
    }
    return `<div class="force-layer-empty">
      <p class="empty-inspector">尚未生成概念兵力。请先生成红蓝职责名单（按阶段归属）。</p>
      <div class="planning-actions">
        <button type="button" data-action="generate-concept-forces" ${canGenerate && !generating ? "" : "disabled"}>
          ${generating ? "正在生成概念兵力…" : "生成概念兵力"}
        </button>
      </div>
    </div>`;
  }
  if (hasGlobal) {
    return `<div class="force-layer-empty">
      <p class="empty-inspector">「${escapeHtml(phaseLabel)}」暂无关联作战兵力（按概念挂接 / 阶段过滤）。可切换阶段，或检查作战行的概念挂接。</p>
      <div class="planning-actions secondary">
        <button type="button" class="quiet-button" data-action="select-force-mission-layer" data-layer="concept">查看概念兵力</button>
        <button type="button" data-action="add-combat-force" data-side="friendly">+ 添加作战单元</button>
      </div>
    </div>`;
  }
  if (!hasConcept) {
    return `<div class="force-layer-empty">
      <p class="empty-inspector">请先生成概念兵力，再生成作战编成。</p>
      <button type="button" class="quiet-button" data-action="select-force-mission-layer" data-layer="concept">前往概念兵力</button>
    </div>`;
  }
  return `<div class="force-layer-empty">
    <p class="empty-inspector">概念兵力已就绪，尚未生成作战编成。将按概念扩展主队与保障等编组。</p>
    <div class="planning-actions">
      <button type="button" data-action="generate-combat-forces" ${canGenerate && !generating ? "" : "disabled"}>
        ${generating ? "正在生成作战兵力…" : "AI 生成作战兵力"}
      </button>
      <button type="button" class="quiet-button" data-action="derive-combat-forces" ${canGenerate && !generating ? "" : "disabled"}>
        从概念兵力派生
      </button>
      <button type="button" class="quiet-button" data-action="add-combat-force" data-side="friendly">
        + 手工添加
      </button>
    </div>
  </div>`;
}

function resolveForceMissionFocusId(state = {}, phases = []) {
  if (!phases.length) return "";
  if (state.phaseActionFocusId && phases.some((phase) => phase.id === state.phaseActionFocusId)) {
    return state.phaseActionFocusId;
  }
  return phases[0].id;
}

function filterConceptForcesForPhase(forces = [], phaseId = "", hasPhases = false) {
  if (!hasPhases || !phaseId) return forces;
  return forces.filter((force) => (force.phaseIds || []).includes(phaseId));
}

function filterCombatForcesForPhase(combatForces = [], conceptForces = [], phaseId = "", hasPhases = false) {
  if (!hasPhases || !phaseId) return combatForces;
  const conceptIds = new Set(
    filterConceptForcesForPhase(conceptForces, phaseId, true).map((force) => force.id)
  );
  return combatForces.filter((force) => {
    const ownPhases = Array.isArray(force.phaseIds) ? force.phaseIds : [];
    if (ownPhases.length) return ownPhases.includes(phaseId);
    if (!force.conceptForceId) return true;
    return conceptIds.has(force.conceptForceId);
  });
}

/**
 * 概念兵力：左名单 + 右详情边栏（点选不顶开列表）。
 */
function renderConceptForceRoster(forces = [], options = {}) {
  const { tasks = [], picker = {}, catalogOpen = false, editable = false, confirmed = false, drawerEnter = false } = options;
  const activeId = picker.layer === "concept" ? picker.forceId : "";
  const activeForce = forces.find((force) => force.id === activeId) || null;

  return `<div class="force-concept-board ${activeForce ? "is-detail-open" : "is-detail-idle"}">
    <div class="force-concept-main">
      <div class="force-concept-columns is-grouped">
        ${renderConceptSideColumn({
          title: "概念兵力",
          className: "is-grouped",
          items: forces,
          emptyText: "本阶段暂无概念兵力。",
          activeId,
          confirmed
        })}
      </div>
    </div>
    <button type="button" class="force-concept-drawer-scrim" data-action="close-force-platform-picker" tabindex="-1" aria-label="关闭详情" ${activeForce ? "" : "hidden"}></button>
    <aside class="force-concept-sidebar ${activeForce ? "is-open" : ""} ${activeForce && drawerEnter ? "is-entering" : ""}" aria-label="概念兵力详情" aria-hidden="${activeForce ? "false" : "true"}">
      ${activeForce ? renderConceptForceDetail(activeForce, { tasks, picker, catalogOpen, editable }) : ""}
    </aside>
  </div>`;
}

function renderConceptSideColumn({ title, className, items = [], emptyText = "", activeId = "", confirmed = false }) {
  return `<section class="force-roster-col ${className}" aria-label="${escapeAttribute(title)}" data-grouped-list-panel="force-concept" data-grouped-list-dimensions="阵营:side|职责:role|状态:status" data-grouped-list-default-group="side">
    ${items.length
      ? `<ul class="force-roster-list" data-grouped-list-items>${items.map((force, index) => {
          const equip = formatConceptEquipment(force);
          const active = force.id === activeId;
          const name = displayConceptName(force);
          return renderForceRosterItem({
            index: index + 1,
            forceId: force.id,
            layer: "concept",
            active,
            warn: !equip,
            name,
            role: roleLabel(force.role),
            line2: equip ? `装备  ${equip}` : "装备  待挂",
            line2Missing: !equip,
            title: [force.task, equip].filter(Boolean).join(" | ") || name,
            groups: {
              side: sideLabel(force.side),
              role: roleLabel(force.role),
              status: confirmed ? "已确认" : equip ? "待确认" : "待补全"
            },
            search: [force.id, name, force.task, equip, sideLabel(force.side), roleLabel(force.role)].filter(Boolean).join(" ")
          });
        }).join("")}</ul>`
      : `<p class="empty-inspector force-concept-empty">${escapeHtml(emptyText)}</p>`}
  </section>`;
}

/** 名单行：div 而非 button，避免全局 button 样式把文字压扁/叠字。 */
function renderForceRosterItem({
  index,
  forceId,
  layer,
  active = false,
  warn = false,
  name = "",
  role = "",
  badge = "",
  line2 = "",
  line2Missing = false,
  title = "",
  groups = {},
  search = ""
}) {
  return `<li class="force-roster-item ${active ? "is-active" : ""} ${warn ? "is-warn" : ""}" data-grouped-list-item data-group-side="${escapeAttribute(groups.side || "未分类")}" data-group-role="${escapeAttribute(groups.role || "未分类")}" data-group-type="${escapeAttribute(groups.type || "未分类")}" data-group-status="${escapeAttribute(groups.status || "待确认")}" data-search="${escapeAttribute(search || name)}">
    <div class="force-roster-hit"
      role="button"
      tabindex="0"
      data-action="open-force-platform-picker"
      data-force-id="${escapeAttribute(forceId)}"
      data-force-layer="${escapeAttribute(layer)}"
      title="${escapeAttribute(title || name)}">
      <span class="force-roster-idx">${Number(index) || 1}</span>
      <span class="force-roster-copy">
        <span class="force-roster-name-row">
          <span class="force-roster-name">${escapeHtml(name || "未命名")}</span>
          ${role ? `<span class="force-roster-tag">${escapeHtml(role)}</span>` : ""}
          ${badge ? `<span class="force-roster-tag is-warn">${escapeHtml(badge)}</span>` : ""}
        </span>
        ${line2 ? `<span class="force-roster-line force-roster-line2 ${line2Missing ? "is-missing" : ""}">${escapeHtml(line2)}</span>` : ""}
      </span>
    </div>
  </li>`;
}

function renderConceptForceDetail(force, { tasks = [], picker = {}, catalogOpen = false, editable = false } = {}) {
  const equip = formatConceptEquipment(force);
  const platforms = Array.isArray(force.platforms) ? force.platforms : [];
  return `<article class="force-concept-detail is-open" data-force-card="${escapeAttribute(force.id)}" data-force-layer="concept">
    <header class="force-concept-detail-head">
      <div class="force-concept-detail-title">
        <span class="force-role-tag">${escapeHtml(roleLabel(force.role))}</span>
        <b>${escapeHtml(displayConceptName(force))}</b>
        <span class="force-concept-detail-sub">${escapeHtml(sideLabel(force.side))}${force.group ? ` · ${escapeHtml(force.group)}` : ""}</span>
      </div>
      <button type="button" class="quiet-button force-concept-close" data-action="close-force-platform-picker" title="关闭详情" aria-label="关闭详情">×</button>
    </header>
    <div class="force-concept-detail-body">
      <section class="force-concept-detail-block">
        <strong>任务</strong>
        <p>${escapeHtml(force.task || "（未写任务）")}</p>
        ${force.notes ? `<small>${escapeHtml(force.notes)}</small>` : ""}
      </section>
      ${renderForceTaskRefs(force, tasks, { editable, layer: "concept" })}
      <section class="force-concept-detail-block">
        <strong>装备类型 <em>仅 1 个</em></strong>
        <div class="force-concept-equip-row">
          <span class="${equip ? "" : "is-missing"}">${equip ? escapeHtml(equip) : "尚未挂接"}</span>
          ${platforms[0] && editable ? `<button type="button" class="quiet-button" data-action="remove-force-platform"
            data-force-id="${escapeAttribute(force.id)}" data-force-layer="concept" data-platform-id="${escapeAttribute(platforms[0].id)}">移除</button>` : ""}
        </div>
        ${editable && catalogOpen
          ? renderInlinePlatformPicker(force, picker, catalogOpen, editable, "concept")
          : editable && !catalogOpen
            ? `<p class="planning-meta">装备目录未连接，无法检索。可在系统管理配置 DB3。</p>`
            : ""}
      </section>
    </div>
  </article>`;
}

/**
 * 作战编成：与概念兵力同一套「左名单 + 右详情边栏」。
 */
function renderCombatCompositionTables(forces = [], options = {}) {
  const {
    tasks = [],
    missionTypes = [],
    conceptForces = [],
    picker = {},
    catalogOpen = false,
    editable = false,
    confirmed = false,
    drawerEnter = false
  } = options;
  const activeId = picker.layer === "combat" || !picker.layer ? picker.forceId : "";
  const activeForce = forces.find((force) => force.id === activeId) || null;

  return `<div class="force-concept-board force-combat-board ${activeForce ? "is-detail-open" : "is-detail-idle"}">
    <div class="force-concept-main">
      <div class="force-concept-columns is-grouped">
        ${renderCombatSideColumn({
          title: "作战编成",
          className: "is-grouped",
          items: forces,
          emptyText: "本阶段暂无作战编成。",
          activeId,
          missionTypes,
          confirmed
        })}
      </div>
    </div>
    <button type="button" class="force-concept-drawer-scrim" data-action="close-force-platform-picker" tabindex="-1" aria-label="关闭详情" ${activeForce ? "" : "hidden"}></button>
    <aside class="force-concept-sidebar force-combat-sidebar ${activeForce ? "is-open" : ""} ${activeForce && drawerEnter ? "is-entering" : ""}" aria-label="作战编成详情" aria-hidden="${activeForce ? "false" : "true"}">
      ${activeForce
        ? renderCombatForceDetail(activeForce, {
          missionTypes,
          conceptForces,
          tasks,
          picker,
          catalogOpen,
          editable
        })
        : ""}
    </aside>
  </div>`;
}

function renderCombatSideColumn({
  title,
  className,
  items = [],
  emptyText = "",
  activeId = "",
  missionTypes = [],
  confirmed = false
}) {
  return `<section class="force-roster-col force-combat-column ${className}" aria-label="${escapeAttribute(title)}" data-grouped-list-panel="force-combat" data-grouped-list-dimensions="阵营:side|职责:role|任务类型:type|状态:status" data-grouped-list-default-group="side">
    <div class="force-roster-col-toolbar">
      <button type="button" class="quiet-button" data-action="add-combat-force" data-side="friendly" title="添加蓝方作战编组">+ 蓝方编组</button>
      <button type="button" class="quiet-button" data-action="add-combat-force" data-side="hostile" title="添加红方作战编组">+ 红方编组</button>
    </div>
    ${items.length
      ? `<ul class="force-roster-list" data-grouped-list-items>${items.map((force, index) => {
          const platforms = Array.isArray(force.platforms) ? force.platforms : [];
          const missingPlatform = !platforms.length;
          const active = force.id === activeId;
          const platformSummary = missingPlatform
            ? "待挂"
            : platforms.slice(0, 2).map((item) => {
              const qty = Number(item.quantity) || 1;
              const label = String(item.name || "平台").trim();
              return qty > 1 ? `${label} x${qty}` : label;
            }).join(" / ") + (platforms.length > 2 ? ` 等${platforms.length}` : "");
          const missionType = formatCombatMissionType(force, missionTypes);
          const unitType = formatCombatUnitType(force);
          const name = displayCombatName(force);
          return renderForceRosterItem({
            index: index + 1,
            forceId: force.id,
            layer: "combat",
            active,
            warn: missingPlatform || !force.conceptForceId,
            name,
            role: roleLabel(force.role),
            badge: force.conceptForceId ? "" : "未挂概念",
            line2: missingPlatform ? "平台  待挂" : `平台  ${platformSummary}`,
            line2Missing: missingPlatform,
            title: [force.task, platformSummary].filter(Boolean).join(" | ") || name,
            groups: {
              side: sideLabel(force.side),
              role: roleLabel(force.role),
              type: missionType || "未分类",
              status: confirmed ? "已确认" : missingPlatform || !force.conceptForceId ? "待补全" : "待确认"
            },
            search: [force.id, name, force.task, missionType, unitType, platformSummary, sideLabel(force.side), roleLabel(force.role)].filter(Boolean).join(" ")
          });
        }).join("")}</ul>`
      : `<p class="empty-inspector force-concept-empty">${escapeHtml(emptyText)}</p>`}
  </section>`;
}

function renderCombatForceDetail(force, {
  tasks = [],
  missionTypes = [],
  conceptForces = [],
  picker = {},
  catalogOpen = false,
  editable = false
} = {}) {
  const unitType = formatCombatUnitType(force);
  const composition = formatCombatComposition(force);
  const linkedName = conceptName(conceptForces, force.conceptForceId);
  const sideConceptOptions = (conceptForces || []).filter((item) => (
    !force.side || item.side === force.side || item.side === "unknown"
  ));
  return `<article class="force-concept-detail is-open" data-force-card="${escapeAttribute(force.id)}" data-force-layer="combat">
    <header class="force-concept-detail-head">
      <div class="force-concept-detail-title">
        <span class="force-role-tag">${escapeHtml(roleLabel(force.role))}</span>
        ${editable
          ? `<input type="text" class="force-sidebar-control" data-combat-force-name="${escapeAttribute(force.id)}" value="${escapeAttribute(force.name || "")}" placeholder="作战编组名称" style="font-weight:bold;max-width:200px;">`
          : `<b>${escapeHtml(displayCombatName(force))}</b>`}
        <span class="force-concept-detail-sub">${escapeHtml(sideLabel(force.side))}${force.group ? ` · ${escapeHtml(force.group)}` : ""} · ${escapeHtml(unitType)}</span>
      </div>
      <button type="button" class="quiet-button force-concept-close" data-action="close-force-platform-picker" title="关闭详情" aria-label="关闭详情">×</button>
    </header>
    <div class="force-concept-detail-body">
      <section class="force-concept-detail-block">
        <strong>主要任务</strong>
        ${editable
          ? `<textarea class="force-sidebar-control" rows="3" data-combat-force-task="${escapeAttribute(force.id)}" placeholder="填写该编组承担的具体作战任务与可观察要求">${escapeHtml(force.task || "")}</textarea>`
          : `<p>${escapeHtml(force.task || "（未写任务）")}</p>`}
        ${force.notes ? `<small>${escapeHtml(force.notes)}</small>` : ""}
      </section>
      ${renderForceTaskRefs(force, tasks, { editable, layer: "combat" })}
      <section class="force-concept-detail-block">
        <strong>作战角色</strong>
        ${editable
          ? `<select class="force-sidebar-control" data-combat-force-role="${escapeAttribute(force.id)}">
              <option value="maneuver" ${force.role === "maneuver" ? "selected" : ""}>行动 (maneuver)</option>
              <option value="sense" ${force.role === "sense" ? "selected" : ""}>感知 (sense)</option>
              <option value="command" ${force.role === "command" ? "selected" : ""}>指挥 (command)</option>
              <option value="air" ${force.role === "air" ? "selected" : ""}>空中 (air)</option>
              <option value="airDefense" ${force.role === "airDefense" ? "selected" : ""}>防空 (airDefense)</option>
              <option value="surface" ${force.role === "surface" ? "selected" : ""}>水面 (surface)</option>
              <option value="support" ${force.role === "support" ? "selected" : ""}>保障 (support)</option>
              <option value="external" ${force.role === "external" ? "selected" : ""}>外部 (external)</option>
            </select>`
          : `<span>${escapeHtml(roleLabel(force.role))}</span>`}
      </section>
      <section class="force-concept-detail-block">
        <strong>编成摘要</strong>
        <p class="force-combat-composition-text">${escapeHtml(composition)}</p>
      </section>
      <section class="force-concept-detail-block">
        <strong>CMO 任务类型</strong>
        ${editable
          ? `<select class="force-mission-inline force-sidebar-control" data-force-mission-type="${escapeAttribute(force.id)}" data-force-layer="combat">
              ${missionTypes.map((item) => `<option value="${escapeAttribute(item.id)}" ${item.id === force.missionType ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
            </select>`
          : `<span>${escapeHtml(cmoMissionTypeLabelFromList(force.missionType, missionTypes) || force.missionType || "—")}</span>`}
      </section>
      <section class="force-concept-detail-block">
        <strong>挂接概念兵力</strong>
        ${editable
          ? `<select class="force-sidebar-control" data-combat-concept-link="${escapeAttribute(force.id)}">
              <option value="">（未挂接）</option>
              ${sideConceptOptions.map((item) =>
                `<option value="${escapeAttribute(item.id)}" ${item.id === force.conceptForceId ? "selected" : ""}>${escapeHtml(displayConceptName(item))}</option>`
              ).join("")}
            </select>`
          : `<span>${escapeHtml(linkedName)}</span>`}
        ${!force.conceptForceId ? `<small class="is-warn-text">未挂概念时，阶段过滤可能显示不稳定。</small>` : ""}
      </section>
      <section class="force-concept-detail-block">
        <strong>CMO 平台 <em>可多型号</em></strong>
        ${editable || catalogOpen
          ? renderInlinePlatformPicker(force, picker, catalogOpen, editable, "combat")
          : `<p class="planning-meta">${(force.platforms || []).length ? escapeHtml(composition) : "尚未挂接平台。"}</p>`}
      </section>
      ${editable
        ? `<section class="force-concept-detail-block force-danger-block" style="border-top:1px dashed var(--color-border-subtle);padding-top:12px;margin-top:16px;">
            <button type="button" class="quiet-button is-danger" data-action="remove-combat-force" data-force-id="${escapeAttribute(force.id)}" style="color:var(--color-danger, #d9534f);">删除此作战单元</button>
          </section>`
        : ""}
    </div>
  </article>`;
}

function renderForceTaskRefs(force, tasks = [], { editable = false, layer = "concept" } = {}) {
  const selected = new Set(Array.isArray(force.taskRefs) ? force.taskRefs : []);
  const candidates = (tasks || []).filter((task) => !force.side || !task.side || task.side === force.side);
  const missing = [...selected].filter((ref) => !(tasks || []).some((task) => task.id === ref));
  return `<section class="force-concept-detail-block force-task-ref-block">
    <strong>承接作战任务 <em>${selected.size}</em></strong>
    <div class="force-task-ref-list">
      ${candidates.map((task) => `<label><input type="checkbox" data-force-task-ref data-force-id="${escapeAttribute(force.id)}" data-force-layer="${escapeAttribute(layer)}" data-task-ref="${escapeAttribute(task.id)}" ${selected.has(task.id) ? "checked" : ""} ${editable ? "" : "disabled"}><span>${escapeHtml(task.name || task.id)}</span></label>`).join("") || `<small>当前阵营暂无正式任务。</small>`}
      ${missing.map((ref) => `<span class="is-warn-text">失效引用：${escapeHtml(ref)}</span>`).join("")}
    </div>
  </section>`;
}

function displayCombatName(force = {}) {
  const raw = String(force.name || "").trim();
  if (!raw) return "未命名编成";
  return displayConceptName(force);
}

function cmoMissionTypeLabelFromList(id = "", missionTypes = []) {
  const hit = (missionTypes || []).find((item) => item.id === id);
  return hit?.label || "";
}

function displayConceptName(force = {}) {
  const raw = String(force.name || "").trim();
  if (!raw) return "未命名";
  const sideMark = raw.match(/(?:蓝方|红方)[·•\s]+(.+)$/u);
  if (sideMark?.[1]) return sideMark[1].trim();
  const parts = raw.split(/[·•]/u).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1];
  return raw;
}

function formatConceptEquipment(force = {}) {
  const platforms = Array.isArray(force.platforms) ? force.platforms : [];
  const item = platforms[0];
  if (!item?.name) return "";
  return item.name;
}

function formatCombatComposition(force = {}) {
  const platforms = Array.isArray(force.platforms) ? force.platforms : [];
  if (platforms.length) {
    return platforms
      .map((item) => {
        const name = item.name || "平台";
        const qty = Number(item.quantity) || 1;
        return `${name}×${qty}`;
      })
      .join("；");
  }
  return force.name || "—";
}

function formatCombatUnitType(force = {}) {
  const platforms = Array.isArray(force.platforms) ? force.platforms : [];
  const category = platforms.map((item) => item.category).find(Boolean);
  if (category) return category;
  const domain = platforms.map((item) => item.domain).find(Boolean);
  if (domain) return domainLabel(domain);
  return roleLabel(force.role);
}

function formatCombatMissionType(force = {}, missionTypes = []) {
  const hit = (missionTypes || []).find((item) => item.id === force.missionType);
  return hit?.label || cmoMissionTypeFallback(force.missionType) || "";
}

function formatPhaseSideCounts(forces = []) {
  const blue = forces.filter((force) => force.side === "friendly").length;
  const red = forces.filter((force) => force.side === "hostile").length;
  return `蓝 ${blue} · 红 ${red}`;
}

function cmoMissionTypeFallback(id = "") {
  return String(id || "").trim() || "";
}

function renderInlinePlatformPicker(force, picker, catalogOpen, editable, layer = "combat") {
  const platforms = Array.isArray(force.platforms) ? force.platforms : [];
  const isConcept = layer === "concept";
  const active = picker.forceId === force.id && (picker.layer || "combat") === layer;
  const query = active ? (picker.query || "") : "";
  const domain = active ? (picker.domain || "") : "";
  const country = active ? (picker.country || "") : "";
  const results = active && Array.isArray(picker.results) ? picker.results : [];
  const searching = active && picker.searching;
  const error = active ? (picker.error || "") : "";

  return `<div class="force-inline-picker ${isConcept ? "is-concept-sidebar" : "is-combat-sidebar"}">
    <div class="force-inline-picker-head">
      <strong>${isConcept ? "检索更换" : "已挂平台"}</strong>
    </div>
    ${!isConcept
      ? (platforms.length ? `<ul class="force-platform-list force-platform-list-compact">${platforms.map((item) => `
          <li>
            <div class="force-platform-meta">
              <span>${escapeHtml(item.name || "")}${item.quantity ? ` ×${item.quantity}` : ""}${Number(item.cmoId) > 0 ? "" : " · 无目录编号"}</span>
              <small>${escapeHtml(item.basis || (Number(item.cmoId) > 0
                ? `CMO · ${item.domain || "—"}#${item.cmoId}${item.country ? ` · ${item.country}` : ""}`
                : "无 CMO 目录依据，不得当作定型装备"))}</small>
            </div>
            <div class="force-platform-actions">
              ${editable ? `<label class="force-qty-label">数量
                <input type="number" min="1" max="99" value="${escapeAttribute(String(item.quantity || 1))}"
                  data-force-platform-qty="${escapeAttribute(force.id)}"
                  data-force-layer="${escapeAttribute(layer)}"
                  data-platform-id="${escapeAttribute(item.id)}">
              </label>` : ""}
              <button type="button" class="quiet-button" data-action="remove-force-platform"
                data-force-id="${escapeAttribute(force.id)}" data-force-layer="${escapeAttribute(layer)}" data-platform-id="${escapeAttribute(item.id)}"
                ${editable ? "" : "disabled"}>移除</button>
            </div>
          </li>`).join("")}</ul>` : `<p class="empty-inspector force-platform-empty">尚未挂接平台（须从 CMO 目录选择并保留依据）。</p>`)
      : ""}
    ${catalogOpen ? `
    <div class="force-platform-search-row">
      <input type="search" placeholder="${isConcept ? "装备关键词" : "平台关键词"}"
        data-force-platform-query="${escapeAttribute(force.id)}"
        data-force-layer="${escapeAttribute(layer)}"
        value="${escapeAttribute(query)}"
        ${editable ? "" : "disabled"}>
      <select data-force-platform-domain="${escapeAttribute(force.id)}" data-force-layer="${escapeAttribute(layer)}" ${editable ? "" : "disabled"}>
        ${PLATFORM_DOMAINS.map((item) => `<option value="${escapeAttribute(item.id)}" ${domain === item.id ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
      </select>
      ${!isConcept ? `<input type="text" placeholder="国家" maxlength="80"
        data-force-platform-country="${escapeAttribute(force.id)}"
        data-force-layer="${escapeAttribute(layer)}"
        value="${escapeAttribute(country)}"
        ${editable ? "" : "disabled"}>` : ""}
      <button type="button" class="quiet-button" data-action="search-force-platforms"
        data-force-id="${escapeAttribute(force.id)}" data-force-layer="${escapeAttribute(layer)}"
        ${!editable || searching ? "disabled" : ""}>
        ${searching ? "检索中…" : "检索"}
      </button>
    </div>
    ${error ? `<p class="planning-meta">${escapeHtml(error)}</p>` : ""}
    ${results.length
      ? `${!isConcept ? renderBatchAttachBar(force.id, layer, picker, editable) : ""}
        <ul class="force-platform-results force-platform-results-compact">${results.slice(0, isConcept ? 8 : 12).map((item, index) => {
          const selected = Array.isArray(picker.selectedIndexes) && picker.selectedIndexes.includes(index);
          return `<li class="${selected ? "is-selected" : ""}">
            ${!isConcept ? `<label class="force-platform-select">
              <input type="checkbox" data-action="toggle-force-platform-select" data-result-index="${index}"
                ${selected ? "checked" : ""} ${editable ? "" : "disabled"}>
              <span>${escapeHtml(item.name || "")}${item.country ? ` · ${escapeHtml(item.country)}` : ""}</span>
            </label>` : `<span>${escapeHtml(item.name || "")}${item.country ? ` · ${escapeHtml(item.country)}` : ""}</span>`}
            <button type="button" data-action="attach-force-platform"
              data-force-id="${escapeAttribute(force.id)}" data-force-layer="${escapeAttribute(layer)}" data-result-index="${index}"
              ${editable ? "" : "disabled"}>${isConcept ? "选用" : "挂接"}</button>
          </li>`;
        }).join("")}</ul>`
      : (active && query && !searching && !error
        ? `<p class="empty-inspector">无匹配结果，请换关键词或域。</p>`
        : "")}
    ` : `<p class="planning-meta">装备目录未连接，无法检索。请到系统管理配置 DB3。</p>`}
  </div>`;
}

function renderBatchAttachBar(forceId, layer, picker, editable) {
  const selectedCount = Array.isArray(picker.selectedIndexes) ? picker.selectedIndexes.length : 0;
  const total = Array.isArray(picker.results) ? picker.results.length : 0;
  return `<div class="force-platform-batch-bar">
    <span>已选 ${selectedCount} / ${total}</span>
    <div class="planning-actions secondary">
      <button type="button" class="quiet-button" data-action="select-all-force-platform-results" ${editable && total ? "" : "disabled"}>全选</button>
      <button type="button" class="quiet-button" data-action="clear-force-platform-selection" ${editable && selectedCount ? "" : "disabled"}>清空</button>
      <button type="button" data-action="batch-attach-force-platforms"
        data-force-id="${escapeAttribute(forceId)}" data-force-layer="${escapeAttribute(layer)}"
        ${editable && selectedCount ? "" : "disabled"}>挂接所选</button>
      <button type="button" class="quiet-button" data-action="batch-attach-all-force-platforms"
        data-force-id="${escapeAttribute(forceId)}" data-force-layer="${escapeAttribute(layer)}"
        ${editable && total ? "" : "disabled"}>挂接全部</button>
    </div>
  </div>`;
}

function conceptName(conceptForces = [], id = "") {
  const hit = conceptForces.find((item) => item.id === id);
  return hit ? displayConceptName(hit) : (id || "—");
}

function describeUpstream(state = {}) {
  const brief = state.brief || {};
  const phase = state.phaseAction || {};
  const phaseStorage = state.phaseActionStorage || {};
  const hasBrief = Boolean(
    brief.objective || brief.researchIntent || brief.approach || brief.expectedEffects || brief.risk
  );
  const phases = Array.isArray(phase.phases) ? phase.phases : [];
  const phaseConfirmed = phase.status === "confirmed" && !phaseStorage.stale;
  const phaseDraft = phases.length > 0 && !phaseConfirmed;
  const phaseReady = phaseConfirmed || phaseDraft;
  return {
    hasBrief,
    phaseReady,
    phaseDraft,
    canGenerate: hasBrief && (phaseConfirmed || phases.length >= 2)
  };
}

/** 仅在缺少上游输入时提示。 */
function renderUpstreamBanners(upstream) {
  if (!upstream.hasBrief) {
    return `<p class="planning-banner">缺少概念简报输入。请先完成第 1 步简报。</p>`;
  }
  if (!upstream.phaseReady) {
    return `<p class="planning-banner">缺少阶段与行动输入。请先完成第 2 步并至少生成阶段草案。</p>`;
  }
  if (upstream.phaseDraft) {
    return `<p class="planning-banner">阶段尚未确认：可先按草案生成兵力，正式路径建议先确认「阶段与行动」。</p>`;
  }
  return "";
}

function sideLabel(side) {
  return ({ friendly: "蓝方", hostile: "红方", neutral: "中立", unknown: "未知" })[side] || side || "—";
}

function roleLabel(role) {
  return ({
    sense: "感知",
    command: "指挥",
    maneuver: "行动",
    air: "空中",
    airDefense: "防空",
    surface: "水面",
    support: "保障",
    external: "外部"
  })[role] || role || "—";
}

function domainLabel(domain) {
  return ({
    aircraft: "飞机",
    ship: "舰船",
    submarine: "潜艇",
    ground: "地面",
    facility: "设施",
    satellite: "卫星"
  })[domain] || domain || "—";
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
