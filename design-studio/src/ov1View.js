import { ov1RelationTypes } from "./ov1Store.js";
import { inspectOv1Model } from "./ov1Diagnostics.js";
import { computeOv1WorldBounds, logicalToWorldCss, ov1WorldCssSize } from "./ov1Canvas.js";
import { routeOv1Edges } from "../../shared/ov1EdgeRouting.js";
import {
  edgeMarkerUrl,
  edgeStyleAttrs,
  entityStyleAttrs,
  renderDodafLegend,
  renderEdgeBadge,
  renderEdgeMarkerDefs
} from "./dodafDraftingView.js";
import { renderToolboxFloatButton, renderToolboxRail } from "./toolbox/index.js";

const PANEL_META = {
  context: { eyebrow: "OV-1", title: "任务摘要" },
  concept: { eyebrow: "任务摘要", title: "编辑场景与边界" },
  relations: { eyebrow: "OV-1 关系", title: "关系与结构检查" },
  node: { eyebrow: "OV-1 节点", title: "节点编辑" }
};

export function resolveOv1PanelMode(state) {
  const mode = String(state?.ov1PanelMode || "context");
  return ["context", "concept", "relations", "node"].includes(mode) ? mode : "context";
}

export function renderOv1(state) {
  const model = state.ov1 || { nodes: [], edges: [] };
  const diagnostics = inspectOv1Model(model);
  const nodeCount = model.nodes?.length || 0;
  const edgeCount = model.edges?.length || 0;
  const isolatedCount = diagnostics.summary.isolatedIds.length;
  const generating = Boolean(state.ov1Generating);
  const confirmed = Boolean(model.confirmed || state.ov1Storage?.confirmed);
  const canConfirm = nodeCount > 0 && edgeCount > 0 && !generating;
  const upstreamReady = Boolean(
    (state.forceMission?.status === "confirmed" || state.forceMission?.forces?.length)
    && (state.phaseAction?.status === "confirmed" || state.phaseAction?.phases?.length)
  );

  const provenance = model.provenance?.mode === "ai"
    ? "AI 草案"
    : model.provenance?.mode === "local"
      ? "本地草案"
      : "人工维护";
  const candidate = state.ov1Candidate;
  // Tools docked (right rail) vs floating toolbox FAB over the OV-1 canvas.
  const toolsOpen = state.ov1ToolsOpen === true;
  // Scheme A: fixed far-right icon rail; context panel slides from its left; main shifts left.
  // Floating toolbox never expands panel/tools — only the brand FAB is interactive.
  const panelOpen = toolsOpen && (
    typeof state.ov1PanelOpen === "boolean"
      ? state.ov1PanelOpen
      : state.ov1InspectorCollapsed === false
  );
  const panelMode = resolveOv1PanelMode(state);
  const panelMeta = panelMetaFor(state, panelMode);
  const toolsModeClass = toolsOpen ? "is-tools-docked" : "is-tools-floating";
  return `
    <section class="surface surface-pad ov1-surface">
      <header class="ov1-toolbar" aria-label="高层作战概念图">
        <div class="ov1-toolbar-meta">
          <div class="ov1-toolbar-title-line">
            <h2>总体图 (OV-1a 高层作战概念图)</h2>
            <span class="status-tag ${confirmed ? "is-ready" : generating ? "review" : nodeCount ? "" : "muted"}" data-ov1-status>
              ${confirmed ? "已确认" : generating ? "生成中" : nodeCount ? provenance : "待生成"}
            </span>
          </div>
          <p class="ov1-toolbar-subtitle muted">
            <span>${nodeCount} 节点 · ${edgeCount} 关系 · ${isolatedCount ? `${isolatedCount} 孤立` : "无孤立"}</span>
            <span class="ov1-toolbar-desc">综合兵力与任务骨架，推导高层交互闭环与关系网络</span>
          </p>
        </div>
        <div class="ov1-toolbar-actions">
          <button type="button" class="quiet-button" data-action="extract-ov1-from-ov5" ${generating || !state.ov5?.activities?.length ? "disabled" : ""} title="自底向上从 Step 04 作战活动网络提炼高层总体概念节点与协同闭环">
            从活动机理提炼
          </button>
          <button type="button" class="quiet-button" data-action="seed-ov1-from-planning" title="基于上游兵力与任务规划生成/重置总体图骨架" ${generating || !upstreamReady ? "disabled" : ""}>
            ${nodeCount ? "从兵力规划重建" : "从兵力规划生成"}
          </button>
          <button type="button" class="quiet-button" data-action="generate-ov1" ${generating ? "disabled" : ""} title="使用 AI 推导五类节点与高层交互回路">
            ${generating ? "AI 生成中…" : "AI 一键生成"}
          </button>
          <button type="button" class="quiet-button" data-action="auto-layout-ov1" title="重排布局">
            重排布局
          </button>
          <button type="button" class="${confirmed ? "quiet-button" : "primary-btn"}" data-action="confirm-ov1" ${!canConfirm ? "disabled" : ""}>
            ${confirmed ? "总体图已确认" : "确认总体图"}
          </button>
        </div>
      </header>
      <div class="ov1-workbench ${panelOpen ? "is-panel-open" : "is-panel-collapsed"} ${toolsModeClass}" data-ov1-panel-mode="${escapeHtml(panelMode)}">
        <div class="ov1-main-column">
          ${candidate ? renderCandidate(model, candidate) : ""}
          <div class="ov1-canvas-shell">
            ${renderConceptMap(model, state.selection?.id, {
              generating: state.ov1Generating,
              provenance,
              nodeCount: model.nodes.length,
              edgeCount: model.edges.length,
              isolatedCount: diagnostics.summary.isolatedIds.length,
              selectedEdgeId: state.ov1PanelEdgeId
            })}
          </div>
          ${renderNextStep(model, state)}
        </div>
        ${toolsOpen ? `
        <div class="ov1-side-cluster ${panelOpen ? "is-open" : "is-collapsed"} is-tools-docked">
          <div class="ov1-context-panel" id="ov1ContextPanel" aria-hidden="${panelOpen ? "false" : "true"}">
            <header class="ov1-context-panel-head">
              <div>
                <p class="eyebrow">${escapeHtml(panelMeta.eyebrow)}</p>
                <h2>${escapeHtml(panelMeta.title)}</h2>
              </div>
              <button class="ov1-panel-collapse" type="button" data-action="close-ov1-panel" title="收起侧栏" aria-label="收起侧栏">
                <span class="ov1-panel-collapse-ring" aria-hidden="true"></span>
                <span class="ov1-panel-collapse-glow" aria-hidden="true"></span>
                <span class="ov1-edit-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path class="ov1-panel-collapse-x a" d="M7 7l10 10"/>
                    <path class="ov1-panel-collapse-x b" d="M17 7L7 17"/>
                  </svg>
                </span>
              </button>
            </header>
            <div class="ov1-context-panel-body" data-ov1-panel-body="${escapeHtml(panelMode)}">
              ${renderOv1PanelBody(state, panelMode)}
            </div>
          </div>
          ${renderOv1EditRail(state, panelOpen, panelMode, toolsOpen)}
        </div>` : ""}
      </div>
    </section>
  `;
}

function panelMetaFor(state, mode) {
  if (mode === "node") {
    const nodeId = state.ov1PanelNodeId || state.selection?.id || state.ov1Dialog?.nodeId;
    const selection = selectionForOv1(nodeId, state.ov1);
    return {
      eyebrow: PANEL_META.node.eyebrow,
      title: selection?.title || PANEL_META.node.title
    };
  }
  return PANEL_META[mode] || PANEL_META.context;
}

function renderOv1PanelBody(state, mode) {
  if (mode === "concept") return renderConceptEditor(state.ov1, state.brief, { embedded: true });
  if (mode === "relations") {
    return renderRelationsEditor(state.ov1, {
      embedded: true,
      selectedEdgeId: state.ov1PanelEdgeId
    });
  }
  if (mode === "node") {
    const nodeId = state.ov1PanelNodeId || state.selection?.id || state.ov1Dialog?.nodeId;
    const selection = selectionForOv1(nodeId, state.ov1);
    if (!selection) {
      return `<p class="empty-relations">请先在图面选择一个节点。</p>`;
    }
    return renderOv1Inspector(selection);
  }
  return renderTaskSummaryPanel(state);
}

/** Default side panel body: 任务摘要 content only (actions live on the icon rail). */
function renderTaskSummaryPanel(state) {
  const storage = state.ov1Storage || {};
  const model = state.ov1 || {};
  const brief = state.brief || {};
  const concept = model.concept || {};
  const saving = storage.status === "saving" || storage.status === "checking";
  const ready = storage.status === "ready";
  const stateClass = ready
    ? "ready"
    : saving || storage.status === "review" || storage.status === "recovery"
      ? "review"
      : storage.conflict || storage.status === "conflict" || storage.status === "offline"
        ? "pending"
        : "pending";
  const label = localizeOv1StorageLabel(storage.label || (saving ? "正在检查 OV-1" : "本地草稿"));
  const detail = localizeOv1StorageDetail(storage.detail || "浏览器本地草稿可离线继续使用");
  const audit = storage.auditCount ? ` · ${storage.auditCount} 条审计` : "";
  const values = [
    ["任务目标", concept.objective || brief.objective || "待明确"],
    ["范围与环境", concept.scope || brief.assumptions || "待明确"],
    ["预期效果", concept.expectedEffects || brief.expectedEffects || "待明确"],
    ["关键约束", concept.constraints || brief.risk || "待明确"]
  ];
  const mission = concept.mission || "高层作战概念图";
  const candidate = state.ov1Candidate;
  return `
    <section class="ov1-task-panel" aria-label="任务摘要">
      <div class="ov1-task-panel-status">
        <span class="report-state ${stateClass}">${escapeHtml(label)}</span>
        <p class="ov1-task-panel-detail">${escapeHtml(detail)}${escapeHtml(audit)}</p>
      </div>
      ${candidate ? `
        <div class="ov1-task-panel-candidate" aria-label="待复核 AI 候选">
          <b>待复核 AI 候选</b>
          <p>候选 ${candidate.nodes?.length || 0} 节点 / ${candidate.edges?.length || 0} 关系。请用右侧图标栏应用或舍弃。</p>
        </div>
      ` : ""}
      <div class="ov1-task-panel-mission">
        <b>任务/场景</b>
        <span>${escapeHtml(mission)}</span>
      </div>
      <section class="ov1-scenario-summary ov1-task-panel-summary" aria-label="OV-1 场景摘要">
        ${values.map(([title, value]) => `<article><b>${escapeHtml(title)}</b><span>${escapeHtml(value)}</span></article>`).join("")}
      </section>
    </section>
  `;
}

function ov1StorageActionFlags(storage = {}) {
  const saving = storage.status === "saving" || storage.status === "checking";
  return {
    saving,
    showLoad: !saving && Boolean(storage.remoteAvailable || storage.conflict || storage.status === "conflict"),
    showRestore: !saving && Boolean(storage.conflictDraftAvailable)
  };
}

function localizeOv1StorageLabel(label) {
  const text = String(label || "");
  return text
    .replace(/^Local\s+/i, "本地 ")
    .replace(/\s+storage ready$/i, " 仓储就绪")
    .replace(/\s+source is stale$/i, " 源已过期")
    .replace(/local conflict draft restored/i, "本地冲突草稿已恢复");
}

function localizeOv1StorageDetail(detail) {
  const text = String(detail || "");
  const exact = {
    "A server revision is available; the local model remains preferred.": "服务端有可用修订；当前仍优先使用本地模型。",
    "Server synchronization failed; the local model remains saved.": "服务端同步失败；本地模型仍已保存。",
    "The server has a newer project revision. Refresh before choosing whether to replace the local model.": "服务端有较新修订。请刷新后决定是否用服务端版本替换本地模型。"
  };
  if (exact[text]) return exact[text];
  return text
    .replace(/^No server\s+(.+?)\s+revision yet; project r(\d+)\.$/i, "尚无服务端 $1 修订 · 项目 r$2")
    .replace(/^Current service does not provide\s+(.+?)\s+project storage\.$/i, "当前服务尚未启用 $1 项目仓储")
    .replace(/^Server revision r(\d+) remains preserved for audit but does not match its upstream model\.$/i, "服务端修订 r$1 已保留审计，但与上游模型不一致")
    .replace(/^Restored browser-local draft saved at\s+(.+?);\s*it has not been submitted to the server\.$/i, "已恢复浏览器本地 $1 保存的草稿；尚未提交服务端");
}

/** Topbar floating FAB (OV-1 tools collapsed). */
export function renderOv1ToolboxFloatButton() {
  return renderToolboxFloatButton({
    scope: "ov1",
    open: false,
    action: "toggle-ov1-tools",
    className: "ov1-edit-rail-brand is-topbar-float"
  });
}

/** Scheme A: far-right icon rail when docked; floating toolbox FAB when collapsed. */
function renderOv1EditRail(state, panelOpen = false, panelMode = "context", toolsOpen = false) {
  const busy = Boolean(state.ov1Generating);
  const active = (mode) => panelOpen && panelMode === mode;
  const storage = state.ov1Storage || {};
  const { saving, showLoad, showRestore } = ov1StorageActionFlags(storage);
  const candidate = state.ov1Candidate;
  return renderToolboxRail({
    scope: "ov1",
    open: toolsOpen,
    label: "OV-1 图面编辑栏",
    navLabel: "图面操作入口",
    className: "ov1-edit-rail",
    toggleAction: "toggle-ov1-tools",
    items: [
      {
        action: "toggle-ov1-panel",
        title: "任务摘要",
        icon: "doc",
        active: active("context"),
        expanded: active("context"),
        controls: "ov1ContextPanel"
      },
      {
        action: "refresh-project-ov1",
        title: saving ? "同步中" : "刷新",
        icon: "refresh",
        disabled: saving
      },
      showLoad && {
        action: "load-project-ov1",
        title: "载入服务端",
        icon: "download",
        attention: true
      },
      showRestore && {
        action: "restore-project-ov1-conflict-draft",
        title: "恢复本地冲突草稿",
        icon: "restore",
        attention: true
      },
      {
        action: "open-ov1-concept",
        title: "编辑摘要",
        icon: "concept",
        active: active("concept"),
        expanded: active("concept"),
        controls: "ov1ContextPanel"
      },
      "sep",
      {
        action: "add-ov1-node",
        title: "新增节点",
        icon: "plus",
        disabled: busy
      },
      {
        action: "generate-ov1",
        title: busy ? "正在生成" : "AI 生成候选",
        icon: "sparkle",
        disabled: busy
      },
      candidate && {
        action: "apply-ov1-candidate",
        title: "应用 AI 候选",
        icon: "check",
        attention: true
      },
      candidate && {
        action: "discard-ov1-candidate",
        title: "舍弃候选",
        icon: "close"
      },
      {
        action: "open-ov1-relations",
        title: "关系管理",
        icon: "relations",
        active: active("relations"),
        expanded: active("relations"),
        controls: "ov1ContextPanel"
      },
      {
        action: "auto-layout-ov1",
        title: "重排布局",
        icon: "layout"
      }
    ]
  });
}

function renderNextStep(model, state) {
  const nodeCount = model.nodes?.length || 0;
  const busy = Boolean(state.ov5Generating || state.ov1Generating);
  const confirmed = Boolean(model.confirmed || state.ov1Storage?.confirmed);
  const hasOv5Activities = Boolean(state.ov5?.activities?.length);

  if (!nodeCount) {
    const upstreamReady = Boolean(
      (state.forceMission?.status === "confirmed" || state.forceMission?.forces?.length)
      && (state.phaseAction?.status === "confirmed" || state.phaseAction?.phases?.length)
    );
    return `<aside class="ov1-next-step is-empty" aria-label="总体图待生成">
        <div class="ov1-next-step-copy">
          <strong>总体图待生成</strong>
          <p>${hasOv5Activities ? "Step 04 作战活动网络已就绪。点击下方「从活动机理提炼」快速自底向上抽取高层概念节点，或使用 AI 综合推导高层交互关系。" : upstreamReady ? "上游阶段行动与兵力规划已就绪。可点击下方「从活动机理提炼」或「从兵力规划生成」生成总体图。" : "请先在前面的「阶段行动」与「任务与兵力」中完成规划，或在「活动机理」中建立活动网络。"}</p>
        </div>
        <div class="ov1-next-step-actions">
          <button class="primary-btn" type="button" data-action="extract-ov1-from-ov5" ${busy || !hasOv5Activities ? "disabled" : ""}>从活动机理提炼</button>
          <button class="quiet-button" type="button" data-action="seed-ov1-from-planning" ${busy || !upstreamReady ? "disabled" : ""}>从兵力规划生成</button>
          <button class="quiet-button" type="button" data-action="generate-ov1" ${busy ? "disabled" : ""}>AI 一键生成</button>
        </div>
      </aside>`;
  }

  const ready = confirmed || Boolean(state.ov1?.nodes?.length || state.conceptGraphic?.nodes?.length);
  const hint = ready
    ? "总体图已就绪。可直接进入主线下一步「概念图」，在真实地理态势中展开兵力部署与任务空域；或继续进入「仿真推演」。"
    : "总体图尚未生成。请先生成节点与关系。";

  return `<aside class="ov1-next-step" aria-label="总体图下一步">
      <div class="ov1-next-step-copy">
        <strong>总体概念表达已就绪 · 下一步</strong>
        <p>${escapeHtml(hint)}</p>
      </div>
      <div class="ov1-next-step-actions">
        <button class="quiet-button" type="button" data-action="extract-ov1-from-ov5" ${busy || !hasOv5Activities ? "disabled" : ""} title="从活动模型重新自底向上抽取">
          从活动机理重抽
        </button>
        <button class="quiet-button" type="button" data-view="ov5" data-related-model="true" title="返回作战活动与机理">
          回看活动机理 (Step 04)
        </button>
        <button class="quiet-button" type="button" data-view="ov5a" data-related-model="true" title="展开作战活动分解树 (OV-5a)">
          活动分解 OV-5a
        </button>
        <button class="quiet-button" type="button" data-view="ooda" data-related-model="true" title="展开决策循环 (OODA)">
          决策循环 OODA
        </button>
        <button class="quiet-button" type="button" data-view="scenario" title="前往仿真推演">
          前往仿真推演 (Step 06)
        </button>
        <button class="primary-btn" type="button" data-action="advance-to-concept-map" ${busy ? "disabled" : ""}>
          进入概念图 →
        </button>
      </div>
    </aside>`;
}

function renderConceptMap(model, selectedId, status = {}) {
  const concept = model.concept || {};
  const mission = concept.mission || "高层作战概念图";
  const missionTitle = shortenOv1Caption(mission, 22);
  const isolated = Number(status.isolatedCount || 0);
  const selectedEdgeId = status.selectedEdgeId || "";
  // Logical 0–100 = home viewport (generated graphs fill this).
  // World expands past 100% when nodes are dragged outward — no fixed multi-screen compression.
  const bounds = computeOv1WorldBounds(model.nodes || []);
  const { widthPct: worldWidth, heightPct: worldHeight } = ov1WorldCssSize(model.nodes || []);
  const edgeGeometryById = routeOv1Edges(
    model.edges,
    new Map(model.nodes.map((node) => [node.id, { id: node.id, ...conceptNodeCenterInWorld(node, bounds) }]))
  );
  const statusLine = `<span class="ov1-status-line"><span class="mini-tag ${status.generating ? "review" : ""}">${status.generating ? "正在生成" : escapeHtml(status.provenance || "人工维护")}</span><span class="ov1-model-count">${Number(status.nodeCount || 0)} 节点 · ${Number(status.edgeCount || 0)} 关系 · ${isolated || "无"} 孤立</span><span class="ov1-canvas-hint" title="空白处拖动平移；滚轮缩放；画布随内容扩展">滚轮缩放 · 空白平移</span></span>`;
  return `<figure class="ov1-concept-map dodaf-drafting-canvas" aria-label="高层作战概念图" data-dodaf-product="OV-1">
    <figcaption><strong title="${escapeHtml(mission)}">${escapeHtml(missionTitle)}</strong>${statusLine}</figcaption>
    <div class="ov1-concept-stage" data-ov1-stage title="空白处拖动平移；滚轮缩放；画布随内容扩展">
      <div class="ov1-concept-world" data-ov1-world
        style="width:${worldWidth}%;height:${worldHeight}%;"
        data-world-min-x="${bounds.minX}" data-world-min-y="${bounds.minY}"
        data-world-width="${bounds.width}" data-world-height="${bounds.height}">
        <svg class="ov1-concept-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>${renderEdgeMarkerDefs("ov1")}</defs>
          ${model.edges.map((edge) => renderConceptEdge(edge, edgeGeometryById.get(edge.id), selectedEdgeId)).join("")}
        </svg>
        <div class="ov1-concept-edge-label-layer">${model.edges.map((edge) => renderConceptEdgeLabel(edge, edgeGeometryById.get(edge.id), selectedEdgeId)).join("")}</div>
        ${model.nodes.map((node) => {
          const entity = entityStyleAttrs({ kind: node.kind, dm2Type: node.dm2Type });
          const typeLabel = String(node.category || entity.label || "").trim();
          const typeChip = typeLabel && typeLabel !== String(node.label || "").trim()
            ? `<small>${escapeHtml(typeLabel)}</small>`
            : "";
          const id = escapeHtml(node.id);
          const cssPos = logicalToWorldCss(node.x, node.y, bounds);
          return `<div class="ov1-concept-node" data-ov1-node="${id}" data-logical-x="${escapeHtml(String(node.x))}" data-logical-y="${escapeHtml(String(node.y))}" style="left:${escapeHtml(cssPos.left)};top:${escapeHtml(cssPos.top)}">
            <button class="ov1-concept-entity ${escapeHtml(node.kind || "participant")} ${entity.className} ${selectedId === node.id ? "selected" : ""}" data-ov1="${id}" style="${entity.inline}" type="button">
              <span class="dodaf-entity-icon" aria-hidden="true">${escapeHtml(entity.icon)}</span>
              <strong>${escapeHtml(node.label)}</strong>${typeChip}
            </button>
            <button type="button" class="ov1-connect-port" data-ov1-port data-source-id="${id}" data-side="top" title="拖出连线" aria-label="从该节点顶部拖出连线"></button>
            <button type="button" class="ov1-connect-port" data-ov1-port data-source-id="${id}" data-side="right" title="拖出连线" aria-label="从该节点右侧拖出连线"></button>
            <button type="button" class="ov1-connect-port" data-ov1-port data-source-id="${id}" data-side="bottom" title="拖出连线" aria-label="从该节点底部拖出连线"></button>
            <button type="button" class="ov1-connect-port" data-ov1-port data-source-id="${id}" data-side="left" title="拖出连线" aria-label="从该节点左侧拖出连线"></button>
          </div>`;
        }).join("")}
      </div>
      ${renderDodafLegend("OV-1", { compact: true })}
    </div>
  </figure>`;
}

function renderConceptEdge(edge, geometry, selectedEdgeId = "") {
  if (!geometry) return "";
  const edgeStyle = edgeStyleAttrs(edge.type);
  const selected = selectedEdgeId && selectedEdgeId === edge.id ? " is-selected" : "";
  const shared = `data-ov1-edge="${escapeHtml(edge.id)}" data-source-id="${escapeHtml(edge.sourceId)}" data-target-id="${escapeHtml(edge.targetId)}" data-edge-type="${escapeHtml(edge.type)}"`;
  return `<path d="${geometry.path}" class="ov1-concept-edge-hit${selected}" ${shared} fill="none"/><path d="${geometry.path}" class="ov1-concept-edge ${edgeStyle.className}${selected}" ${shared} style="${edgeStyle.inline}" marker-end="${edgeMarkerUrl(edge.type, "ov1")}"/>`;
}

function renderConceptEdgeLabel(edge, geometry, selectedEdgeId = "") {
  if (!geometry) return "";
  const edgeStyle = edgeStyleAttrs(edge.type);
  const selected = selectedEdgeId && selectedEdgeId === edge.id ? " is-selected" : "";
  const label = String(edge.type || edgeStyle.label || "关系").trim();
  return `<button type="button" class="ov1-concept-edge-label dodaf-edge-label ${edgeStyle.className}${selected}" data-ov1-edge-label="${escapeHtml(edge.id)}" style="left:${geometry.label.x}%;top:${geometry.label.y}%;--dodaf-edge-color:${escapeHtml(edgeStyle.color)}" title="查看关系">${escapeHtml(label)}</button>`;
}

function renderConceptEditor(model, brief, options = {}) {
  const concept = model.concept || {};
  const form = `<form class="activity-editor ov1-panel-editor" id="ov1ConceptForm"><label>任务/场景名称<input name="mission" maxlength="240" value="${escapeHtml(concept.mission || "")}"></label><label>作战目标<textarea name="objective" rows="3" maxlength="500">${escapeHtml(concept.objective || brief?.objective || "")}</textarea></label><label>地域、环境与范围<textarea name="scope" rows="3" maxlength="300">${escapeHtml(concept.scope || brief?.assumptions || "")}</textarea></label><label>时间阶段<input name="phase" maxlength="160" value="${escapeHtml(concept.phase || "总体行动阶段")}"></label><label>预期效果<textarea name="expectedEffects" rows="3" maxlength="500">${escapeHtml(concept.expectedEffects || brief?.expectedEffects || "")}</textarea></label><label>关键约束<textarea name="constraints" rows="3" maxlength="500">${escapeHtml(concept.constraints || brief?.risk || "")}</textarea></label><div class="editor-actions"><button type="submit">保存任务摘要</button></div></form>`;
  if (options.embedded) return form;
  return `<div class="ov1-dialog-content"><header><div><p class="eyebrow">OV-1 任务摘要</p><h2>场景、目标与边界</h2></div><button class="quiet-button" type="button" data-action="close-ov1-dialog">关闭</button></header>${form}</div>`;
}

function renderRelationsEditor(model, options = {}) {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const diagnostics = inspectOv1Model(model);
  const selectedEdgeId = options.selectedEdgeId || "";
  const selectedEdge = model.edges.find((edge) => edge.id === selectedEdgeId) || null;
  const edgeCount = model.edges.length;
  const reviewChecks = diagnostics.checks.filter((item) => item.state !== "ready");
  const readyCount = diagnostics.checks.length - reviewChecks.length;
  // Review items first, then satisfied — keeps the panel scannable.
  const orderedChecks = [
    ...reviewChecks,
    ...diagnostics.checks.filter((item) => item.state === "ready")
  ];
  const summary = `<div class="ov1-relations-summary" role="status">
      <span class="ov1-relations-stat"><b>${edgeCount}</b> 条关系</span>
      <span class="ov1-relations-stat ${reviewChecks.length ? "is-review" : "is-ready"}"><b>${reviewChecks.length}</b> 项待复核</span>
      <span class="ov1-relations-stat is-ready"><b>${readyCount}</b> 项已满足</span>
    </div>`;
  const body = `<div class="ov1-panel-relations">
      ${summary}
      <section class="ov1-relation-editor">
        <header class="ov1-panel-section-head">
          <h3>新增关系</h3>
        </header>
        <form class="edge-editor ov1-edge-editor" id="ov1EdgeForm">
          <label class="ov1-edge-field"><span>起点</span><select name="sourceId" aria-label="关系起点"><option value="">选择起点</option>${nodeOptions(model.nodes, selectedEdge?.sourceId)}</select></label>
          <label class="ov1-edge-field"><span>类型</span><select name="type" aria-label="关系类型">${ov1RelationTypes.map((type) => `<option value="${escapeHtml(type)}" ${selectedEdge?.type === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></label>
          <label class="ov1-edge-field"><span>终点</span><select name="targetId" aria-label="关系终点"><option value="">选择终点</option>${nodeOptions(model.nodes, selectedEdge?.targetId)}</select></label>
          <button type="submit">建立关系</button>
        </form>
      </section>
      <section class="ov1-dialog-list ov1-relation-list-section">
        <header class="ov1-panel-section-head">
          <h3>已定义关系</h3>
          <em>${edgeCount}</em>
        </header>
        <div class="relation-list ov1-relation-list">${edgeCount
          ? model.edges.map((edge) => renderEdgeRow(edge, nodeById, selectedEdgeId)).join("")
          : `<p class="empty-relations">尚未建立关系。可在上方选择起点、类型与终点后建立。</p>`}</div>
      </section>
      <section class="ov1-diagnostics">
        <header class="ov1-panel-section-head">
          <h3>结构检查</h3>
          <em class="${reviewChecks.length ? "is-review" : "is-ready"}">${reviewChecks.length ? `${reviewChecks.length} 待复核` : "全部通过"}</em>
        </header>
        <div class="ov1-check-list">
          ${orderedChecks.map((item) => `
            <article class="ov1-check ${escapeHtml(item.state)}" data-check-id="${escapeHtml(item.id)}">
              <div class="ov1-check-head">
                <b>${escapeHtml(item.statusLabel)}</b>
                <span>${escapeHtml(item.label)}</span>
              </div>
              <small>${escapeHtml(item.detail)}</small>
            </article>`).join("")}
        </div>
      </section>
    </div>`;
  if (options.embedded) return body;
  return `<div class="ov1-dialog-content ov1-relations-dialog"><header><div><p class="eyebrow">OV-1 关系</p><h2>关系与结构检查</h2></div><button class="quiet-button" type="button" data-action="close-ov1-dialog">关闭</button></header>${body}</div>`;
}

/** Legacy helper kept for acceptance scripts; content now also lives in the side panel. */
export function renderOv1Dialog(state) {
  const model = state.ov1;
  const dialog = state.ov1Dialog;
  if (!dialog) return "";
  if (dialog.kind === "node") {
    const selection = selectionForOv1(dialog.nodeId, model);
    if (!selection) return "";
    return `<div class="ov1-dialog-content ov1-node-dialog"><header><div><p class="eyebrow">OV-1 节点</p><h2>${escapeHtml(selection.title)}</h2></div><button class="quiet-button" type="button" data-action="close-ov1-dialog">关闭</button></header>${renderOv1Inspector(selection)}</div>`;
  }
  if (dialog.kind === "concept") return renderConceptEditor(model, state.brief);
  return renderRelationsEditor(model);
}

export function selectionForOv1(id, model) {
  const node = model?.nodes?.find((item) => item.id === id);
  if (!node) return null;
  const byId = new Map(model.nodes.map((item) => [item.id, item]));
  const incoming = model.edges.filter((edge) => edge.targetId === id).map((edge) => `${byId.get(edge.sourceId)?.label || "未知节点"}（${edge.type}）`);
  const outgoing = model.edges.filter((edge) => edge.sourceId === id).map((edge) => `${byId.get(edge.targetId)?.label || "未知节点"}（${edge.type}）`);
  return {
    id: node.id,
    kind: "ov1",
    title: node.label,
    status: "OV-1 节点",
    text: node.detail,
    category: node.category,
    nodeKind: node.kind,
    responsibility: node.responsibility,
    input: node.input,
    output: node.output,
    constraints: node.constraints,
    expectedEffects: node.expectedEffects,
    evidenceRefs: node.evidenceRefs,
    facts: [["入关系", incoming.join("、") || "无"], ["出关系", outgoing.join("、") || "无"], ["总关联", String(incoming.length + outgoing.length)]],
    refs: node.evidenceRefs || [],
    x: node.x,
    y: node.y
  };
}

export function renderOv1Inspector(selection) {
  return `
    <form class="activity-editor ov1-node-editor ov1-panel-editor" id="ov1NodeForm">
      <input type="hidden" name="nodeId" value="${escapeHtml(selection.id)}">
      <label>节点名称<input name="label" maxlength="60" value="${escapeHtml(selection.title)}"></label>
      <label>节点说明<textarea name="detail" rows="4" maxlength="800">${escapeHtml(selection.text)}</textarea></label>
      <label>节点类别<input name="category" maxlength="80" value="${escapeHtml(selection.category || "")}"></label>
      <label>图面类型<select name="kind"><option value="equipment" ${(selection.nodeKind || selection.kind) === "equipment" ? "selected" : ""}>装备/平台</option><option value="command" ${(selection.nodeKind || selection.kind) === "command" ? "selected" : ""}>指挥节点</option><option value="action" ${(selection.nodeKind || selection.kind) === "action" ? "selected" : ""}>关键动作</option><option value="external" ${(selection.nodeKind || selection.kind) === "external" ? "selected" : ""}>外部对象</option><option value="environment" ${(selection.nodeKind || selection.kind) === "environment" ? "selected" : ""}>环境要素</option><option value="effect" ${(selection.nodeKind || selection.kind) === "effect" ? "selected" : ""}>预期效果</option></select></label>
      <label>研究职责<textarea name="responsibility" rows="2" maxlength="300">${escapeHtml(selection.responsibility || "")}</textarea></label>
      <label>抽象输入<textarea name="input" rows="2" maxlength="500">${escapeHtml(selection.input || "")}</textarea></label>
      <label>抽象输出<textarea name="output" rows="2" maxlength="500">${escapeHtml(selection.output || "")}</textarea></label>
      <label>约束条件<textarea name="constraints" rows="2" maxlength="500">${escapeHtml(selection.constraints || "")}</textarea></label>
      <label>预期效果<textarea name="expectedEffects" rows="2" maxlength="500">${escapeHtml(selection.expectedEffects || "")}</textarea></label>
      <label>知识依据<input name="evidenceRefs" maxlength="500" value="${escapeHtml((selection.evidenceRefs || []).join("，"))}"></label>
      <div class="ov1-position-fields"><label>横向位置<input name="x" type="number" min="0" max="76" step="1" value="${escapeHtml(selection.x)}"></label><label>纵向位置<input name="y" type="number" min="0" max="76" step="1" value="${escapeHtml(selection.y)}"></label></div>
      <div class="editor-actions"><button type="submit">保存节点</button><button type="button" class="quiet-button" data-inspector-action="delete-ov1">删除节点</button></div>
    </form>
  `;
}

function renderCandidate(model, candidate) {
  const currentLabels = new Set(model.nodes.map((node) => node.label));
  const candidateLabels = new Set(candidate.nodes.map((node) => node.label));
  const added = [...candidateLabels].filter((label) => !currentLabels.has(label)).length;
  const removed = [...currentLabels].filter((label) => !candidateLabels.has(label)).length;
  return `<section class="ov1-candidate"><div><strong>待复核 AI 候选</strong><p>候选节点 ${candidate.nodes.length} 个、关系 ${candidate.edges.length} 条；相对当前模型新增 ${added} 个节点名称、移除 ${removed} 个节点名称。应用前会自动保存可恢复的模型快照。</p></div><div><button type="button" data-action="apply-ov1-candidate">应用并保留恢复点</button><button class="quiet-button" type="button" data-action="discard-ov1-candidate">舍弃</button></div></section>`;
}

function renderEdgeRow(edge, nodeById, selectedEdgeId = "") {
  return renderRelationCard(edge, nodeById, {
    selected: Boolean(selectedEdgeId && selectedEdgeId === edge.id),
    id: `ov1-edge-row-${edge.id}`
  });
}

/** Narrow side-panel relation card: source → type → target, remove on the side. */
function renderRelationCard(edge, nodeById, options = {}) {
  const selected = options.selected ? " is-selected" : "";
  const focus = options.focus ? " is-focus" : "";
  const idAttr = options.id ? ` id="${escapeHtml(options.id)}"` : "";
  const focusAttr = options.focus ? ` data-ov1-edge-focus="${escapeHtml(edge.id)}"` : "";
  const removeLabel = options.removeLabel || "移除关联";
  const source = nodeById.get(edge.sourceId)?.label || "未知节点";
  const target = nodeById.get(edge.targetId)?.label || "未知节点";
  return `<div class="relation-row ov1-relation-card${selected}${focus}"${idAttr}${focusAttr} data-ov1-edge-row="${escapeHtml(edge.id)}">
    <div class="ov1-relation-card-body">
      <span class="ov1-relation-end ov1-relation-from" title="${escapeHtml(source)}">${escapeHtml(source)}</span>
      <span class="ov1-relation-type">
        <i class="ov1-relation-flow" aria-hidden="true"></i>
        ${renderEdgeBadge(edge.type)}
      </span>
      <span class="ov1-relation-end ov1-relation-to" title="${escapeHtml(target)}">${escapeHtml(target)}</span>
    </div>
    <button class="relation-remove" type="button" data-ov1-edge-remove="${escapeHtml(edge.id)}" title="${escapeHtml(removeLabel)}" aria-label="${escapeHtml(removeLabel)}">×</button>
  </div>`;
}

function nodeOptions(nodes, selectedId = "") {
  return nodes.map((node) => `<option value="${escapeHtml(node.id)}" ${selectedId === node.id ? "selected" : ""}>${escapeHtml(node.label)}</option>`).join("");
}

/** Logical node center mapped into CSS % of the content world (SVG 0–100). */
function conceptNodeCenterInWorld(node, bounds) {
  const css = logicalToWorldCss(node.x, node.y, bounds);
  const left = Number.parseFloat(css.left);
  const top = Number.parseFloat(css.top);
  // Match the layout engine's 14% by 12% safety footprint. The controller
  // replaces this with measured DOM boxes after first paint.
  const halfW = Math.max(2, (14 / Math.max(bounds.width, 1)) * 50);
  const halfH = Math.max(1.5, (12 / Math.max(bounds.height, 1)) * 50);
  return {
    center: {
      x: (Number.isFinite(left) ? left : 42) + halfW,
      y: (Number.isFinite(top) ? top : 42) + halfH
    },
    halfW,
    halfH
  };
}

/** Keep the canvas caption compact; full text stays on title hover. */
function shortenOv1Caption(value, max = 22) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "高层作战概念图";
  const first = text.split(/[。！？；;\n]/)[0].trim() || text;
  if (first.length <= max) return first;
  return `${first.slice(0, Math.max(8, max - 1))}…`;
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
