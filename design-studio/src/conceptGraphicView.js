import { escapeHtml } from "./app/domUtils.js";
import { isConceptGraphicPlanConfirmed } from "./conceptGraphicStore.js";
import { renderPlanningMigrationBanner } from "./planningContext.js";

export function renderConceptGraphic(state) {
  const plan = state.conceptGraphic || {};
  const generating = Boolean(state.conceptGraphicGenerating);
  const confirmed = isConceptGraphicPlanConfirmed(plan, state.conceptGraphicStorage);
  const status = state.conceptGraphicStorage?.stale
    ? "已过期"
    : confirmed
      ? "已确认"
      : plan.status === "draft"
        ? "草案待复核"
        : "待生成";
  const nodes = Array.isArray(plan.nodes) ? plan.nodes : [];
  const edges = Array.isArray(plan.edges) ? plan.edges : [];
  const effects = Array.isArray(plan.effects) ? plan.effects : [];
  const activities = Array.isArray(plan.activityCandidates) ? plan.activityCandidates : [];
  const oodaHints = Array.isArray(plan.oodaHints) ? plan.oodaHints : [];
  const questions = Array.isArray(plan.openQuestions) ? plan.openQuestions : [];
  const checklist = Array.isArray(plan.reviewChecklist) ? plan.reviewChecklist : [];
  const consistency = Array.isArray(plan.consistencyReport) ? plan.consistencyReport : [];
  const upstreamReady = state.forceMission?.status === "confirmed"
    && state.phaseAction?.status === "confirmed"
    && state.conceptMap?.reference?.status === "confirmed"
    && !state.forceMissionStorage?.stale
    && !state.phaseActionStorage?.stale
    && !state.conceptMapStorage?.stale;

  return `<section class="planning-page concept-graphic-page">
    <div class="section-heading">
      <div>
        <h2>作战概念图设计</h2>
        <p>AI 汇总兵力、阶段与模糊图，形成总体作战构想；人工复核确认后自动种子化 OV-1。</p>
      </div>
      <span class="mini-tag ${confirmed ? "ready" : generating ? "review" : ""}">${escapeHtml(status)}${generating ? " · 生成中" : ""}</span>
    </div>

    ${renderPlanningMigrationBanner(state)}
    ${upstreamReady ? "" : `<p class="planning-banner">请先确认兵力与任务、阶段与行动，并确认作战概念图 OV 参考。完成后将自动汇总本步草案。</p>`}

    <div class="planning-actions">
      <button type="button" data-action="generate-concept-graphic" ${generating || !upstreamReady ? "disabled" : ""}>${generating ? "正在汇总…" : nodes.length ? "按规划重生成总体概念图" : "汇总生成总体作战概念图"}</button>
      <button type="button" class="quiet-button" data-action="confirm-concept-graphic" ${generating || !nodes.length || confirmed ? "disabled" : ""}>确认总体概念图并进入 OV-1</button>
    </div>

    <div class="planning-grid">
      <article class="planning-card wide">
        <header><h3>总体构想叙述</h3></header>
        <p class="planning-narrative">${escapeHtml(plan.narrative || "尚未生成总体叙述。")}</p>
      </article>

      <article class="planning-card">
        <header><h3>总体节点（${nodes.length}）</h3><small>将映射到 OV-1</small></header>
        ${nodes.length ? `<div class="planning-list">${nodes.map((node) => `
          <article class="planning-item">
            <b>${escapeHtml(node.label)}</b>
            <span>${escapeHtml(node.role)}${node.fromForceIds?.length ? ` · 兵力 ${escapeHtml(node.fromForceIds.join("、"))}` : ""}${node.fromPhaseIds?.length ? ` · 阶段 ${escapeHtml(node.fromPhaseIds.join("、"))}` : ""}</span>
            <p>${escapeHtml(node.note || "—")}</p>
          </article>`).join("")}</div>` : `<p class="empty-inspector">尚未生成节点草案。</p>`}
      </article>

      <article class="planning-card">
        <header><h3>高层关系（${edges.length}）</h3></header>
        ${edges.length ? `<ul class="planning-relations">${edges.map((edge) => `
          <li><b>${escapeHtml(edge.from)}</b> —${escapeHtml(edge.type)}→ <b>${escapeHtml(edge.to)}</b>${edge.note ? `<small>${escapeHtml(edge.note)}</small>` : ""}</li>`).join("")}</ul>` : `<p class="empty-inspector">暂无关系草案。</p>`}
      </article>

      <article class="planning-card">
        <header><h3>效果 / 活动 / OODA 提示</h3></header>
        <div class="planning-phase-grid" style="grid-template-columns: repeat(3, minmax(0, 1fr));">
          <div><strong>预期效果</strong><ul>${effects.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>—</li>"}</ul></div>
          <div><strong>活动候选</strong><ul>${activities.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>—</li>"}</ul></div>
          <div><strong>OODA 提示</strong><ul>${oodaHints.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>—</li>"}</ul></div>
        </div>
      </article>

      <article class="planning-card">
        <header><h3>一致性与复核</h3></header>
        ${consistency.length ? `<ul class="planning-checklist">${consistency.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
        ${checklist.length ? `<ul class="planning-checklist">${checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p class="empty-inspector">生成后将列出复核清单。</p>`}
        ${questions.length ? `<div class="planning-questions"><h4>开放问题</h4><ul>${questions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
        <label class="planning-notes">
          <span>复核批注（可选）</span>
          <textarea id="conceptGraphicReviewNotes" rows="3" placeholder="例如：强化效果节点表述；指挥关系改为支援">${escapeHtml(plan.reviewNotes || "")}</textarea>
        </label>
        <div class="planning-actions secondary">
          <button type="button" class="quiet-button" data-action="regenerate-concept-graphic-with-notes" ${generating || !nodes.length || !upstreamReady ? "disabled" : ""}>按批注重生成</button>
        </div>
        <p class="planning-meta">生成来源：${escapeHtml(plan.generation?.source || "—")} · ${escapeHtml(plan.generation?.generatedAt || "未生成")}</p>
      </article>
    </div>
  </section>`;
}
