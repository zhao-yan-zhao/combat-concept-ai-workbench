/**
 * wargamePerspectiveFilter.js
 * M7-T7.5 想定推演线：红蓝分立与信息隔离（协同角色与视角映射）
 * 
 * 核心机制：
 * 1. 协同角色映射（lead -> director, researcher -> red, reviewer -> blue）
 * 2. 意图与情报迷雾隔离（红方视角隐蔽蓝方意图，蓝方视角隐蔽红方意图，导演部全知）
 * 3. 扰动事件定向受体过滤（targetSide: red | blue | both）
 */

export const WARGAME_PERSPECTIVES = [
  { id: "director", label: "导演部 (全知视角)", icon: "👑", desc: "掌握红蓝双方意图、全息态势与导调裁决权限" },
  { id: "red", label: "红方视角 (进攻概念)", icon: "🔴", desc: "聚焦红方战法达成，蓝方意图处于情报迷雾遮蔽状态" },
  { id: "blue", label: "蓝方视角 (对手反制)", icon: "🔵", desc: "聚焦对手反制推演，红方主攻意图处于情报迷雾遮蔽状态" }
];

/**
 * 解析用户协同身份对应的默认视角与视角切换权限
 */
export function resolveUserPerspective(session = {}) {
  const actor = session.actor || {};
  const roles = Array.isArray(actor.roles) ? actor.roles : [];

  if (roles.includes("lead")) {
    return {
      defaultPerspective: "director",
      canSwitch: true,
      roleName: "项目负责人 / 导调员",
      roleCode: "lead"
    };
  }
  if (roles.includes("reviewer")) {
    return {
      defaultPerspective: "blue",
      canSwitch: false,
      roleName: "外部专家 / 蓝方红队代表",
      roleCode: "reviewer"
    };
  }
  if (roles.includes("researcher")) {
    return {
      defaultPerspective: "red",
      canSwitch: false,
      roleName: "战法研究员 / 红方代表",
      roleCode: "researcher"
    };
  }

  // 离线单人研究默认全知，支持自由切换体验
  return {
    defaultPerspective: "director",
    canSwitch: true,
    roleName: "单机全知研究员",
    roleCode: "local-full"
  };
}

/**
 * 回合意图与事件的情报迷雾过滤
 */
export function filterTurnByPerspective(turn = {}, perspective = "director") {
  if (!turn || typeof turn !== "object") return null;

  // 导演部视角：全透视
  if (perspective === "director") {
    return {
      ...turn,
      activePerspective: "director",
      fogOfWar: false,
      redIntentsVisible: true,
      blueIntentsVisible: true,
      canEditRed: true,
      canEditBlue: true,
      canInjectEvents: true,
      canAdjudicate: true
    };
  }

  const rawIntents = turn.intents || {};
  const rawEvents = Array.isArray(turn.injectedEvents) ? turn.injectedEvents : [];

  if (perspective === "red") {
    const hasBlueIntent = Boolean(rawIntents.blue?.text && rawIntents.blue.text.trim());
    return {
      ...turn,
      activePerspective: "red",
      fogOfWar: true,
      redIntentsVisible: true,
      blueIntentsVisible: false,
      canEditRed: true,
      canEditBlue: false,
      canInjectEvents: false,
      canAdjudicate: false,
      intents: {
        red: {
          text: rawIntents.red?.text || "",
          activityRefs: rawIntents.red?.activityRefs || [],
          masked: false
        },
        blue: {
          text: hasBlueIntent
            ? "【蓝方情报迷雾】我方侦察仅捕获蓝方部分雷达辐射与防空阵位调整征候，对手具体战术意图与火力配置未查明。"
            : "",
          activityRefs: [],
          masked: hasBlueIntent
        }
      },
      // 红方仅能看见影响红方或全局公共的事件
      injectedEvents: rawEvents.filter((e) => e.targetSide === "red" || e.targetSide === "both")
    };
  }

  if (perspective === "blue") {
    const hasRedIntent = Boolean(rawIntents.red?.text && rawIntents.red.text.trim());
    return {
      ...turn,
      activePerspective: "blue",
      fogOfWar: true,
      redIntentsVisible: false,
      blueIntentsVisible: true,
      canEditRed: false,
      canEditBlue: true,
      canInjectEvents: false,
      canAdjudicate: false,
      intents: {
        red: {
          text: hasRedIntent
            ? "【红方情报迷雾】蓝方预警雷达仅探知红方远海多批不明雷达反射信号与无线电佯动，红方主攻方向与交汇弹道未查明。"
            : "",
          activityRefs: [],
          masked: hasRedIntent
        },
        blue: {
          text: rawIntents.blue?.text || "",
          activityRefs: rawIntents.blue?.activityRefs || [],
          masked: false
        }
      },
      // 蓝方仅能看见影响蓝方或全局公共的事件
      injectedEvents: rawEvents.filter((e) => e.targetSide === "blue" || e.targetSide === "both")
    };
  }

  return turn;
}

/**
 * 渲染视角切换栏组件
 */
export function renderPerspectiveSwitcher({ activePerspective = "director", session = {}, currentTurn = null }) {
  const perm = resolveUserPerspective(session);
  const active = activePerspective || perm.defaultPerspective;

  return `
    <section class="wargame-perspective-bar" style="margin-bottom:12px; padding:10px 14px; border-radius:8px; background:rgba(15,23,42,0.6); border:1px solid rgba(148,163,184,0.2); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:12px; font-weight:700; color:#cbd5e1; display:flex; align-items:center; gap:4px;">
          <span>👁️ 推演视角:</span>
        </span>
        <div class="segmented-control" role="radiogroup" aria-label="推演视角切换" style="display:inline-flex; border:1px solid #334155; border-radius:6px; overflow:hidden; background:#0f172a;">
          ${WARGAME_PERSPECTIVES.map((p) => {
            const isSelected = active === p.id;
            const disabled = !perm.canSwitch && active !== p.id;
            return `
              <button type="button"
                class="segmented-item ${isSelected ? "is-active" : ""}"
                data-action="switch-wargame-perspective"
                data-perspective="${p.id}"
                ${disabled ? "disabled" : ""}
                title="${escapeHtml(p.desc)}${disabled ? " (您当前身份无权切换视角)" : ""}"
                style="padding:4px 10px; font-size:11.5px; border:none; background:${isSelected ? "#1e293b" : "transparent"}; color:${isSelected ? (p.id === "red" ? "#f87171" : p.id === "blue" ? "#60a5fa" : "#38bdf8") : "#94a3b8"}; font-weight:${isSelected ? "700" : "500"}; cursor:${disabled ? "not-allowed" : "pointer"}; border-right:1px solid #334155;">
                <span>${p.icon}</span>
                <span>${p.label}</span>
              </button>
            `;
          }).join("")}
        </div>
      </div>

      <div style="font-size:11px; color:#94a3b8; display:flex; align-items:center; gap:10px;">
        <span>协同身份: <strong style="color:#e2e8f0;">${escapeHtml(perm.roleName)}</strong></span>
        ${active === "red" ? `<span class="badge" style="background:rgba(239,68,68,0.15); color:#f87171; border:1px solid rgba(239,68,68,0.3); padding:1px 6px; border-radius:4px;">蓝方意图已加情报迷雾</span>` : ""}
        ${active === "blue" ? `<span class="badge" style="background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); padding:1px 6px; border-radius:4px;">红方意图已加情报迷雾</span>` : ""}
        ${active === "director" ? `<span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); padding:1px 6px; border-radius:4px;">全局全息视野 · 具备导调裁决权</span>` : ""}
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
