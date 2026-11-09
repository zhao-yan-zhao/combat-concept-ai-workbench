/**
 * wargameTimelineStore.js
 * M7-T7.7 想定推演线：推演日志流水线与 What-If 快照派生
 * 
 * 核心功能：
 * 1. 结构化抽取回合推演流水线记录（时序时间轴、各阶段攻防因果、注入事件受体、裁决机理）
 * 2. 结合情报迷雾视角过滤时序流水线
 * 3. 支持任选历史/当前回合节点一键派生 What-If 分支项目（纯深拷贝绝对解耦，无脆弱联动）
 */

import { filterTurnByPerspective } from "./wargamePerspectiveFilter.js";

/**
 * 提取推演时序流水线数据
 */
export function buildWargameTimeline(wargame = {}, { activePerspective = "director" } = {}) {
  const turns = Array.isArray(wargame?.turns) ? wargame.turns : [];

  return turns.map((rawTurn) => {
    // 依当前视角脱敏
    const t = filterTurnByPerspective(rawTurn, activePerspective) || rawTurn;

    const statusLabels = {
      "intents-planning": { text: "意图筹划", class: "review" },
      "event-injection": { text: "导调注入", class: "is-warn" },
      "adjudicating": { text: "裁决推导", class: "is-warn" },
      "completed": { text: "回合闭环", class: "is-ready" }
    };
    const statusMeta = statusLabels[t.status] || { text: t.status || "未知", class: "muted" };

    const redText = t.intents?.red?.text || "未录入红方意图";
    const blueText = t.intents?.blue?.text || "未录入蓝方意图";
    const events = Array.isArray(t.injectedEvents) ? t.injectedEvents : [];
    const outcome = t.adjudication?.outcome || (t.status === "completed" ? "已达成战术相持" : "等待导演部裁决");
    const rationale = t.adjudication?.rationale || "";
    const adjudicatedAt = t.adjudication?.adjudicatedAt ? new Date(t.adjudication.adjudicatedAt).toLocaleTimeString() : "";

    return {
      turnNumber: t.turnNumber,
      phaseId: t.phaseId,
      phaseName: t.phaseName,
      status: t.status,
      statusMeta,
      redIntentText: redText,
      redMasked: Boolean(t.intents?.red?.masked),
      blueIntentText: blueText,
      blueMasked: Boolean(t.intents?.blue?.masked),
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        targetSide: e.targetSide || "both",
        targetLabel: e.targetSide === "red" ? "影响红方" : e.targetSide === "blue" ? "影响蓝方" : "全局影响"
      })),
      outcome,
      rationale,
      adjudicatedAt,
      isCompleted: t.status === "completed"
    };
  });
}

/**
 * 构造 What-If 分支项目载荷（纯深拷贝解耦）
 */
export function buildWhatIfProjectPayload(state, turnNumber, options = {}) {
  const currentTitle = state.project?.title || state.brief?.objective || "作战概念战法";
  const num = Number(turnNumber) || 1;
  const branchTitle = String(options.branchTitle || `${currentTitle} - Turn ${num} What-If 分支`).trim();
  const assumption = String(options.assumption || `在第 ${num} 回合探索不同战场态势与战术决断`).trim();

  // 1. 深度拷贝全局模型资源
  const clonedBrief = JSON.parse(JSON.stringify(state.brief || {}));
  clonedBrief.assumptions = `${clonedBrief.assumptions || ""}\n【What-If 分支假设 (Turn ${num})】：${assumption}`.trim();

  const clonedOv5 = JSON.parse(JSON.stringify(state.ov5 || {}));
  const clonedPhaseAction = JSON.parse(JSON.stringify(state.phaseAction || {}));
  const clonedForceMission = JSON.parse(JSON.stringify(state.forceMission || {}));
  const clonedOoda = JSON.parse(JSON.stringify(state.ooda || {}));

  // 2. 截断推演回合至指定节点
  const originalWargame = state.scenario?.wargame || {};
  const clonedTurns = JSON.parse(JSON.stringify(originalWargame.turns || [])).slice(0, num);

  // 分支起点回合重置裁决状态，便于在分支项目中重新演练或注入不同事件
  if (clonedTurns.length > 0) {
    const branchTurn = clonedTurns[clonedTurns.length - 1];
    branchTurn.adjudication = null;
    branchTurn.status = branchTurn.injectedEvents?.length > 0 ? "adjudicating" : "event-injection";
  }

  const clonedScenario = JSON.parse(JSON.stringify(state.scenario || {}));
  clonedScenario.wargame = {
    ...originalWargame,
    turns: clonedTurns,
    currentTurnIndex: num,
    updatedAt: new Date().toISOString()
  };

  const newProjectId = `whatif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    id: newProjectId,
    kind: "tactic",
    title: branchTitle,
    description: `从原项目【${currentTitle}】第 ${num} 回合派生的 What-If 推演探索分支。分支假设：${assumption}`,
    record: {
      brief: clonedBrief,
      ov5: clonedOv5,
      phaseAction: clonedPhaseAction,
      forceMission: clonedForceMission,
      ooda: clonedOoda,
      scenario: clonedScenario
    },
    workflow: {
      version: 2,
      mode: "free",
      completedThrough: 5
    }
  };
}

/**
 * 渲染时序流水线与 What-If 派生看板
 */
export function renderWargameTimelineSection({
  timeline = [],
  currentTurnNumber = 1,
  whatIfSelectedTurn = null,
  activePerspective = "director"
} = {}) {
  return `
    <section class="surface wargame-timeline-section" style="margin-top:20px; padding:16px; border-radius:10px; background:rgba(15,23,42,0.85); border:1px solid rgba(148,163,184,0.2);">
      <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid rgba(148,163,184,0.15); padding-bottom:10px;">
        <div>
          <h3 style="margin:0 0 4px 0; font-size:15px; color:#f1f5f9; display:flex; align-items:center; gap:8px;">
            <span>📜 推演时序流水线 (Turn Timeline)</span>
            <span class="status-tag" style="font-size:10.5px; background:rgba(56,189,248,0.15); color:#38bdf8;">M7-T7.7</span>
          </h3>
          <p style="margin:0; font-size:11.5px; color:#94a3b8;">
            记录推演全流程时序因果链路；支持在任意回合节点派生 What-If 分支项目（纯解耦复制，验证不同战术假设）。
          </p>
        </div>
        <div style="font-size:11.5px; color:#cbd5e1; display:flex; align-items:center; gap:10px;">
          <span>共 <strong>${timeline.length}</strong> 个推演节点</span>
          <button type="button" class="quiet-button compact-btn" data-action="generate-wargame-review-report" style="font-size:11.5px; color:#38bdf8; border-color:rgba(56,189,248,0.3);">
            📑 导出复盘报告
          </button>
        </div>
      </header>

      <!-- 时间轴列表 -->
      <div class="wargame-timeline-flow" style="display:flex; flex-direction:column; gap:14px; position:relative;">
        ${timeline.map((item, idx) => {
          const isSelected = item.turnNumber === currentTurnNumber;
          const isWhatIfOpen = whatIfSelectedTurn === item.turnNumber;

          return `
            <article class="wargame-timeline-node ${isSelected ? "is-selected" : ""}" style="display:flex; gap:14px; align-items:flex-start; position:relative;">
              <!-- 节点标号轴点 -->
              <div style="flex:0 0 36px; display:flex; flex-direction:column; align-items:center;">
                <div style="width:32px; height:32px; border-radius:50%; background:${isSelected ? "#0284c7" : "#1e293b"}; color:${isSelected ? "#ffffff" : "#94a3b8"}; border:2px solid ${isSelected ? "#38bdf8" : "#475569"}; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; box-shadow:0 2px 8px rgba(0,0,0,0.3);">
                  T${item.turnNumber}
                </div>
                ${idx < timeline.length - 1 ? `<div style="width:2px; height:100%; min-height:40px; background:rgba(148,163,184,0.2); margin:4px 0;"></div>` : ""}
              </div>

              <!-- 节点卡片正文 -->
              <div class="surface" style="flex:1; padding:12px 16px; border-radius:8px; background:rgba(15,23,42,0.65); border:1px solid ${isSelected ? "rgba(56,189,248,0.4)" : "rgba(148,163,184,0.15)"};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                  <div>
                    <strong style="color:#e0f2fe; font-size:13.5px;">第 ${item.turnNumber} 回合 · ${escapeHtml(item.phaseName)}</strong>
                    ${item.adjudicatedAt ? `<small style="margin-left:8px; color:#64748b;">${escapeHtml(item.adjudicatedAt)}</small>` : ""}
                  </div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span class="status-tag ${item.statusMeta.class}">${item.statusMeta.text}</span>
                    <button type="button" class="quiet-button compact-btn" data-action="select-wargame-turn" data-turn-number="${item.turnNumber}" style="font-size:11px;">
                      👁️ 切换至该回合
                    </button>
                    <button type="button" class="quiet-button compact-btn" data-action="toggle-what-if-form" data-turn-number="${item.turnNumber}" style="font-size:11px; color:#38bdf8; border-color:rgba(56,189,248,0.3);">
                      🔀 派生 What-If 分支
                    </button>
                  </div>
                </div>

                <!-- 攻防要点摘要 -->
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:10px; margin-bottom:8px; font-size:12px;">
                  <div style="background:rgba(239,68,68,0.06); padding:8px 10px; border-radius:6px; border-left:3px solid #ef4444;">
                    <div style="color:#f87171; font-weight:700; margin-bottom:3px; display:flex; align-items:center; gap:4px;">
                      <span>🔴 红方意图:</span>
                      ${item.redMasked ? `<span style="font-size:10px; color:#fca5a5;">(情报迷雾)</span>` : ""}
                    </div>
                    <div style="color:#cbd5e1; line-height:1.4;">${escapeHtml(item.redIntentText)}</div>
                  </div>

                  <div style="background:rgba(56,189,248,0.06); padding:8px 10px; border-radius:6px; border-left:3px solid #38bdf8;">
                    <div style="color:#38bdf8; font-weight:700; margin-bottom:3px; display:flex; align-items:center; gap:4px;">
                      <span>🔵 蓝方意图:</span>
                      ${item.blueMasked ? `<span style="font-size:10px; color:#7dd3fc;">(情报迷雾)</span>` : ""}
                    </div>
                    <div style="color:#cbd5e1; line-height:1.4;">${escapeHtml(item.blueIntentText)}</div>
                  </div>
                </div>

                <!-- 注入扰动事件 -->
                ${item.events.length > 0 ? `
                  <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px; flex-wrap:wrap; font-size:11px;">
                    <span style="color:#94a3b8;">扰动事件:</span>
                    ${item.events.map((e) => `
                      <span class="badge" style="background:rgba(245,158,11,0.12); color:#fbbf24; border:1px solid rgba(245,158,11,0.25); padding:1px 6px; border-radius:4px;">
                        ⚡ ${escapeHtml(e.title)} (${escapeHtml(e.targetLabel)})
                      </span>
                    `).join("")}
                  </div>
                ` : ""}

                <!-- 裁决结论 -->
                <div style="background:rgba(2,6,23,0.45); padding:8px 10px; border-radius:6px; font-size:12px;">
                  <strong style="color:#34d399;">⚖️ 导调裁决结论:</strong>
                  <span style="color:#e2e8f0; margin-left:6px;">${escapeHtml(item.outcome)}</span>
                  ${item.rationale ? `<p style="margin:4px 0 0 0; color:#94a3b8; font-size:11px; line-height:1.4;">机理阐释: ${escapeHtml(item.rationale)}</p>` : ""}
                </div>

                <!-- 内联 What-If 派生面板 -->
                ${isWhatIfOpen ? `
                  <div class="what-if-inline-panel" style="margin-top:12px; padding:12px; border-radius:6px; background:#0f172a; border:1px solid #38bdf8; box-shadow:0 4px 14px rgba(0,0,0,0.4);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                      <strong style="color:#38bdf8; font-size:12.5px;">🔀 从第 ${item.turnNumber} 回合派生 What-If 分支项目</strong>
                      <button type="button" class="quiet-button compact-btn" data-action="close-what-if-form">✕ 取消</button>
                    </div>
                    <p style="margin:0 0 10px 0; font-size:11.5px; color:#94a3b8;">
                      系统将复制当前作战概念全要素，并截断推演回合至第 ${item.turnNumber} 回合，生成独立新项目（纯深拷贝，解耦演进）。
                    </p>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                      <label style="font-size:11.5px; color:#cbd5e1;">
                        <span>分支项目名称:</span>
                        <input type="text" id="whatIfBranchTitle" class="wargame-input" value="What-If 分支 (Turn ${item.turnNumber})" style="margin-top:3px; width:100%;" />
                      </label>
                      <label style="font-size:11.5px; color:#cbd5e1;">
                        <span>What-If 战术假设 (探索点):</span>
                        <textarea id="whatIfAssumption" class="wargame-textarea" rows="2" placeholder="例如：若红方在此阶段未遭遇突发通信中断，而是成功实施双轴雷达压制，态势演化将如何？" style="margin-top:3px;"></textarea>
                      </label>
                      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:6px;">
                        <button type="button" class="quiet-button" data-action="close-what-if-form">取消</button>
                        <button type="button" class="primary-btn" data-action="execute-what-if-fork" data-turn-number="${item.turnNumber}">
                          🚀 确认派生并切换至新项目
                        </button>
                      </div>
                    </div>
                  </div>
                ` : ""}
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
