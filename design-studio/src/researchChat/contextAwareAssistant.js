/**
 * contextAwareAssistant.js
 * M7-T7.9 上下文感知 AI 研讨助手
 * 
 * 核心机制：
 * 1. 自动感知当前步骤视图的模型摘要与引用依据，并注入对话上下文
 * 2. 研讨建议一律以"建议候选框 (Candidate Box)"形式呈现，杜绝直接静默修改模型
 * 3. 人工点击"采纳并应用"时强制走 M1 事务包装 (applyWithRecoveryPoint)，支持随时撤销 (Undo)
 */

import { escapeHtml } from "../app/domUtils.js";

/**
 * 提取当前活跃视图的模型要素与引用上下文
 */
export function extractActiveViewContext(state = {}) {
  const viewId = state.activeView || "brief";
  const brief = state.brief || {};
  const project = state.project || {};
  const knowledgeResults = Array.isArray(state.knowledge?.results) ? state.knowledge.results : [];

  const viewMetaMap = {
    brief: { label: "01 概念简报", domain: "作战问题界定与假设" },
    "phase-action": { label: "02 阶段与行动", domain: "时空展开与协同波次" },
    "force-mission": { label: "03 任务与兵力", domain: "作战任务与平台编组" },
    ov5: { label: "04 制胜机理 (OV-5)", domain: "因果论证链与活动拓扑" },
    ov1: { label: "05 高层概念图 (OV-1)", domain: "多域态势与节点交换" },
    scenario: { label: "06 想定推演与导调", domain: "对抗演练与因果裁决" },
    rules: { label: "07 规则库与时序", domain: "交战规则与状态迁移" },
    report: { label: "08 成果报告输出", domain: "报告生成与综合复盘" }
  };

  const meta = viewMetaMap[viewId] || { label: "作战概念研究", domain: "全局态势" };
  let stepSummary = "";
  let entityDetails = "";

  switch (viewId) {
    case "brief": {
      const obj = brief.objective ? `目标: ${brief.objective.slice(0, 30)}...` : "尚未明确作战目标";
      const asmCount = (brief.assumptions || "").split("\n").filter(Boolean).length;
      stepSummary = `${obj} · 关键假设约 ${asmCount} 项`;
      entityDetails = `作战目标: ${brief.objective || "无"}\n核心思路: ${brief.approach || "无"}\n关键假设: ${brief.assumptions || "无"}`;
      break;
    }
    case "phase-action": {
      const phases = state.phaseAction?.phases || [];
      const phaseNames = phases.map((p) => p.name).join(" ➔ ") || "尚未划分阶段";
      stepSummary = `共 ${phases.length} 个作战阶段 (${phaseNames})`;
      entityDetails = `作战阶段划分: ${phaseNames}`;
      break;
    }
    case "force-mission": {
      const forces = state.forceMission?.combatForces || state.forceMission?.forces || [];
      const tasks = state.forceMission?.tasks || [];
      stepSummary = `编组参演力量 ${forces.length} 支 · 规划作战任务 ${tasks.length} 项`;
      entityDetails = `参演力量: ${forces.map((f) => f.name).join("、") || "暂无"}\n关键任务: ${tasks.map((t) => t.name).join("、") || "暂无"}`;
      break;
    }
    case "ov5": {
      const activities = state.ov5?.activities || [];
      const chain = state.ov5?.argumentChain || {};
      const claim = chain.claim ? `论证主张: ${chain.claim.slice(0, 25)}...` : "未定义制胜论证主张";
      stepSummary = `活动要素 ${activities.length} 个 · ${claim}`;
      entityDetails = `制胜主张: ${chain.claim || "无"}\n因果推论: ${chain.reasoning || "无"}\n活动清单: ${activities.map((a) => a.title || a.name).join("、") || "暂无"}`;
      break;
    }
    case "scenario": {
      const wargame = state.scenario?.wargame || {};
      const turns = wargame.turns || [];
      const currentTurn = turns[turns.length - 1];
      const outcome = currentTurn?.adjudication?.outcome ? `最新裁决: ${currentTurn.adjudication.outcome.slice(0, 25)}...` : "尚未完成裁决";
      stepSummary = `推演演进至第 ${turns.length} 回合 · ${outcome}`;
      entityDetails = `当前推演回合: 第 ${turns.length} 回合 (${currentTurn?.phaseName || "初始"})\n红方意图: ${currentTurn?.intents?.red?.text || "未录入"}\n蓝方意图: ${currentTurn?.intents?.blue?.text || "未录入"}`;
      break;
    }
    default: {
      stepSummary = `正在聚焦 ${meta.label}`;
      entityDetails = `概念标题: ${project.title || "作战概念战法"}`;
    }
  }

  // 提取知识库前两项引用
  const topCitations = knowledgeResults.slice(0, 2).map((k) => k.title || k.name || k.chunkId).filter(Boolean);
  const citationSnippet = topCitations.length ? `知识依据: ${topCitations.join("、")}` : "知识库未指定强制引用";

  const promptContextBlock = `
【当前研讨步骤上下文 (自动感知)】
- 当前研究步骤: ${meta.label} (${meta.domain})
- 要素概况: ${stepSummary}
- 要素细节:
${entityDetails}
- 关联知识参考: ${citationSnippet}
【研讨交互原则】
如果提出对当前步骤模型的具体调整建议，必须在建议末尾输出结构化的建议候选结构，便于研究员审查并一键安全应用；绝对不可直接虚构已修改主模型。
`.trim();

  return {
    viewId,
    viewLabel: meta.label,
    domain: meta.domain,
    stepSummary,
    citationSnippet,
    promptContextBlock
  };
}

/**
 * 渲染研讨面板顶部的上下文感知胶囊
 */
export function renderContextAwareBadge(context = {}) {
  const { viewLabel = "当前步骤", stepSummary = "", citationSnippet = "" } = context;

  return `
    <div class="research-chat-context-badge" style="margin:4px 0 10px 0; padding:6px 10px; border-radius:6px; background:rgba(30,41,59,0.5); border:1px solid rgba(56,189,248,0.25); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px; font-size:11px;">
      <div style="display:flex; align-items:center; gap:6px; color:#cbd5e1;">
        <span style="color:#38bdf8; font-weight:700;">🎯 正在研讨当前步骤:</span>
        <strong style="color:#e0f2fe;">${escapeHtml(viewLabel)}</strong>
        <span style="color:#94a3b8;">(${escapeHtml(stepSummary)})</span>
      </div>
      ${citationSnippet ? `<span style="color:#64748b; font-size:10.5px;">${escapeHtml(citationSnippet)}</span>` : ""}
    </div>
  `;
}

/**
 * 渲染 AI 建议候选应用事务框 (Candidate Action Box)
 * 助手的建议只能以候选形式呈现，必须经人工点击确认，并通过 applyWithRecoveryPoint 安全采纳
 */
export function renderCandidateActionBox(candidate = {}, { scope = "" } = {}) {
  if (!candidate || !candidate.title) return "";

  const isApplied = Boolean(candidate.applied);
  const isDismissed = Boolean(candidate.dismissed);

  if (isDismissed) {
    return `
      <div class="research-candidate-box is-dismissed" style="margin-top:8px; padding:6px 10px; border-radius:6px; background:rgba(15,23,42,0.4); border:1px dashed #475569; font-size:11px; color:#64748b;">
        <span>✕ 已忽略该建议提案：「${escapeHtml(candidate.title)}」</span>
      </div>
    `;
  }

  if (isApplied) {
    return `
      <div class="research-candidate-box is-applied" style="margin-top:8px; padding:8px 12px; border-radius:6px; background:rgba(16,185,129,0.1); border:1px solid rgba(52,211,153,0.3); font-size:11.5px; color:#34d399; display:flex; align-items:center; justify-content:space-between;">
        <span>✓ 已采纳并事务应用：「${escapeHtml(candidate.title)}」 (已创建撤销恢复点)</span>
        <span class="status-tag is-ready" style="font-size:10px;">已生效</span>
      </div>
    `;
  }

  return `
    <div class="research-candidate-box" style="margin-top:10px; padding:10px 14px; border-radius:8px; background:#0f172a; border:1px solid #38bdf8; box-shadow:0 4px 12px rgba(0,0,0,0.35);">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
        <strong style="color:#38bdf8; font-size:12.5px; display:flex; align-items:center; gap:6px;">
          <span>📋 研讨建议候选 (待人工审定)</span>
          <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-size:10px;">事务安全包装</span>
        </strong>
        <span style="font-size:10.5px; color:#94a3b8;">目标步骤: ${escapeHtml(candidate.targetView || "当前模型")}</span>
      </div>

      <div style="font-size:12px; font-weight:600; color:#e0f2fe; margin-bottom:4px;">
        ${escapeHtml(candidate.title)}
      </div>

      <p style="margin:0 0 8px 0; font-size:11.5px; color:#cbd5e1; line-height:1.4;">
        ${escapeHtml(candidate.summary || candidate.explanation || "")}
      </p>

      ${candidate.impactSummary ? `
        <div style="font-size:11px; color:#f59e0b; margin-bottom:8px; background:rgba(245,158,11,0.08); padding:4px 8px; border-radius:4px;">
          ⚠️ 变更影响: ${escapeHtml(candidate.impactSummary)}
        </div>
      ` : ""}

      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button type="button" class="quiet-button compact-btn"
          data-action="dismiss-research-candidate"
          data-candidate-id="${escapeHtml(candidate.id || "")}"
          data-research-chat-scope="${escapeHtml(scope)}"
          style="font-size:11px; color:#94a3b8;">
          忽略建议
        </button>
        <button type="button" class="primary-btn compact-btn"
          data-action="apply-research-candidate"
          data-candidate-id="${escapeHtml(candidate.id || "")}"
          data-research-chat-scope="${escapeHtml(scope)}"
          style="font-size:11px;">
          ✓ 采纳并应用变更 (创建恢复点)
        </button>
      </div>
    </div>
  `;
}
