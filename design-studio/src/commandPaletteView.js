import { escapeHtml } from "./app/domUtils.js";

/**
 * 预设导航与功能视图清单
 */
export const VIEW_COMMANDS = [
  { id: "nav-brief", title: "步骤 1: 概念简报", subtitle: "研究意图、边界与初始假设", category: "步骤与视图", type: "nav", view: "brief", keywords: "brief 简报 意图 假设 step1" },
  { id: "nav-phase-action", title: "步骤 2: 阶段与行动", subtitle: "时序阶段、战术行动与聚焦方向", category: "步骤与视图", type: "nav", view: "phase-action", keywords: "phase action 阶段 行动 conops step2" },
  { id: "nav-force-mission", title: "步骤 3: 兵力与任务", subtitle: "概念兵力、作战编成与 CMO 平台挂接", category: "步骤与视图", type: "nav", view: "force-mission", keywords: "force mission 兵力 编组 编成 cmo step3" },
  { id: "nav-ov5", title: "步骤 4: 机制与协同 (OV-5 / OODA)", subtitle: "杀伤网链路、活动机理与 OODA 环分析", category: "步骤与视图", type: "nav", view: "ov5", keywords: "ov5 ooda 机制 协同 杀伤网 活动 step4" },
  { id: "nav-ov1", title: "步骤 5: 高层作战概念图 (OV-1)", subtitle: "综合态势图件、实体演变与图例", category: "步骤与视图", type: "nav", view: "ov1", keywords: "ov1 概念图 态势 图例 step5" },
  { id: "nav-scenario", title: "步骤 6: 想定与推演", subtitle: "回合规划、部署计划与推演规则", category: "步骤与视图", type: "nav", view: "scenario", keywords: "scenario 想定 推演 部署 回合 step6" },
  { id: "nav-task", title: "关联模型: 作战任务 (Operational Task)", subtitle: "任务清单、区域与地理参考点", category: "步骤与视图", type: "nav", view: "operational-task", keywords: "operational task 作战任务 任务 区域" },
  { id: "nav-ov1b", title: "关联模型: 任务编排流 (OV-1b)", subtitle: "红蓝对抗因果交互轴与任务组时序", category: "步骤与视图", type: "nav", view: "ov1b", keywords: "ov1b 任务组 红蓝对抗 业务流" },
  { id: "nav-ov2", title: "关联模型: 资源交换 (OV-2 / OV-3)", subtitle: "作战节点间通信与信息资源流", category: "步骤与视图", type: "nav", view: "ov2", keywords: "ov2 ov3 资源交换 信息流 节点" },
  { id: "nav-ov4", title: "关联模型: 组织与指挥关系 (OV-4)", subtitle: "指挥协同架构、角色职责与冲突诊断", category: "步骤与视图", type: "nav", view: "ov4", keywords: "ov4 组织 职责 指挥 协同" },
  { id: "nav-ov6b", title: "关联模型: 状态机迁移 (OV-6b)", subtitle: "离散事件状态流转与转换条件建模", category: "步骤与视图", type: "nav", view: "ov6b", keywords: "ov6b 状态机 状态 迁移 事件" },
  { id: "nav-rules", title: "关联模型: 规则库 (OV-6a)", subtitle: "交战规则 (ROE)、协同规则与抗毁约束", category: "步骤与视图", type: "nav", view: "rule-library", keywords: "ov6a 规则 规则库 roe 约束" },
  { id: "nav-validation", title: "成果评估: 设计验证", subtitle: "结构连通性、时效覆盖与红方质询", category: "常用操作", type: "action", action: "open-validation-view", keywords: "validation 验证 红方 质询 评估" },
  { id: "nav-structure-review", title: "成果评估: 结构核对台", subtitle: "全景要素一致性与问题诊断", category: "常用操作", type: "action", action: "open-structure-review", keywords: "structure review 结构 核对" }
];

/**
 * 预设常用动作清单
 */
export const ACTION_COMMANDS = [
  { id: "act-reduced-motion", title: "切换减少动效模式", subtitle: "全局开启或关闭装饰性动画与平滑过渡", category: "常用操作", type: "action", action: "toggle-reduced-motion", keywords: "reduced motion 动效 动画 无障碍" },
  { id: "act-ai-config", title: "AI 服务设置", subtitle: "配置大模型端点、API Key 与上下文缓存", category: "常用操作", type: "action", action: "open-ai-config", keywords: "ai config 服务 密钥 endpoint" },
  { id: "act-ai-prompts", title: "AI 提示词目录", subtitle: "查看、编辑与调试系统级提示词模板", category: "常用操作", type: "action", action: "open-ai-prompts", keywords: "ai prompt 提示词 模板" },
  { id: "act-account", title: "协同账号管理", subtitle: "切换身份、密码重置与安全事件审计", category: "常用操作", type: "action", action: "open-account-management", keywords: "account user 账号 协同 审阅" },
  { id: "act-save-version", title: "保存当前概念版本", subtitle: "为当前研究项目创建不可变快照版本", category: "常用操作", type: "action", action: "save-report-version", keywords: "save version 报告 版本 快照 归档" },
  { id: "act-example-tactic", title: "载入战法设计示例", subtitle: "导入完整的 6 步防空压制战法示例项目", category: "常用操作", type: "action", action: "load-example-project", exampleKind: "tactic", keywords: "example tactic 战法 示例 样本" },
  { id: "act-example-scenario", title: "载入想定推演示例", subtitle: "导入完整的 6 步多域封控想定推演示例项目", category: "常用操作", type: "action", action: "load-example-project", exampleKind: "scenario", keywords: "example scenario 想定 示例 样本" }
];

/**
 * 从当前 state 动态提取搜索要素
 */
export function extractProjectElements(state = {}) {
  const elements = [];

  // 1. 作战任务
  const tasks = Array.isArray(state.operationalTask?.tasks) ? state.operationalTask.tasks : [];
  for (const t of tasks) {
    if (!t?.id) continue;
    elements.push({
      id: `elem-task-${t.id}`,
      title: `任务: ${t.name || t.id}`,
      subtitle: `${t.side === "hostile" ? "红方" : "蓝方"} · ${t.missionType || "任务"}`,
      category: "项目要素",
      type: "element",
      view: "operational-task",
      elementId: t.id,
      keywords: `task 任务 ${t.name || ""} ${t.id} ${t.side || ""}`
    });
  }

  // 2. 阶段
  const phases = Array.isArray(state.phaseAction?.phases) ? state.phaseAction.phases : [];
  for (const p of phases) {
    if (!p?.id) continue;
    elements.push({
      id: `elem-phase-${p.id}`,
      title: `阶段: ${p.name || p.id}`,
      subtitle: p.timeWindow ? `时窗: ${p.timeWindow}` : (p.objective || "作战阶段"),
      category: "项目要素",
      type: "element",
      view: "phase-action",
      elementId: p.id,
      keywords: `phase 阶段 ${p.name || ""} ${p.id}`
    });
  }

  // 3. 兵力单元
  const conceptForces = Array.isArray(state.forceMission?.conceptForces) ? state.forceMission.conceptForces : [];
  for (const f of conceptForces) {
    if (!f?.id) continue;
    elements.push({
      id: `elem-force-${f.id}`,
      title: `兵力: ${f.name || f.id}`,
      subtitle: `${f.side === "hostile" ? "红方" : "蓝方"}概念能力单元`,
      category: "项目要素",
      type: "element",
      view: "force-mission",
      elementId: f.id,
      keywords: `force 兵力 ${f.name || ""} ${f.id} ${f.role || ""}`
    });
  }

  // 4. OV-5 活动节点
  const activities = Array.isArray(state.ov5?.activities)
    ? state.ov5.activities
    : (Array.isArray(state.architectureModel?.activities) ? state.architectureModel.activities : []);
  for (const a of activities) {
    if (!a?.id) continue;
    elements.push({
      id: `elem-act-${a.id}`,
      title: `活动: ${a.name || a.id}`,
      subtitle: `${a.domain || "通用"} · ${a.autonomyLevel || "HITL"}`,
      category: "项目要素",
      type: "element",
      view: "ov5",
      elementId: a.id,
      keywords: `activity 活动 ov5 ${a.name || ""} ${a.id} ${a.domain || ""}`
    });
  }

  // 5. 状态机
  const machines = Array.isArray(state.ov6b?.machines) ? state.ov6b.machines : [];
  for (const m of machines) {
    if (!m?.id) continue;
    elements.push({
      id: `elem-sm-${m.id}`,
      title: `状态机: ${m.name || m.id}`,
      subtitle: `${m.subjectType || "通用"}状态机`,
      category: "项目要素",
      type: "element",
      view: "ov6b",
      elementId: m.id,
      keywords: `machine 状态机 ${m.name || ""} ${m.id}`
    });
  }

  return elements;
}

/**
 * 过滤与排序候选命令
 */
export function filterCommands(query = "", state = {}) {
  const q = String(query || "").trim().toLowerCase();
  const allCommands = [
    ...VIEW_COMMANDS,
    ...ACTION_COMMANDS,
    ...extractProjectElements(state)
  ];

  if (!q) {
    // 默认展示导航与常用动作
    return allCommands.filter((c) => c.category !== "项目要素");
  }

  const terms = q.split(/\s+/).filter(Boolean);

  return allCommands.filter((cmd) => {
    const haystack = `${cmd.title} ${cmd.subtitle || ""} ${cmd.category} ${cmd.keywords || ""}`.toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}

/**
 * 渲染命令面板对话框内层 HTML
 */
export function renderCommandPaletteHtml({ query = "", selectedIndex = 0, state = {} } = {}) {
  const matches = filterCommands(query, state);
  const safeIndex = matches.length > 0 ? Math.max(0, Math.min(selectedIndex, matches.length - 1)) : -1;

  let groupedHtml = "";
  if (!matches.length) {
    groupedHtml = `
      <div class="command-palette-empty">
        <p>未找到匹配 “<b>${escapeHtml(query)}</b>” 的命令或要素。</p>
        <small>支持检索步骤、视图、任务、兵力、活动及系统操作</small>
      </div>
    `;
  } else {
    // 按 category 分组展示
    const groups = new Map();
    matches.forEach((item, index) => {
      if (!groups.has(item.category)) groups.set(item.category, []);
      groups.get(item.category).push({ item, globalIndex: index });
    });

    for (const [category, entries] of groups.entries()) {
      groupedHtml += `<div class="command-palette-group"><header class="command-palette-group-header">${escapeHtml(category)}</header><ul class="command-palette-list">`;
      for (const { item, globalIndex } of entries) {
        const isActive = globalIndex === safeIndex;
        let badge = "";
        if (item.type === "nav") badge = `<span class="command-badge nav">跳转</span>`;
        else if (item.type === "action") badge = `<span class="command-badge act">执行</span>`;
        else if (item.type === "element") badge = `<span class="command-badge elem">要素</span>`;

        groupedHtml += `
          <li class="command-palette-item ${isActive ? "is-active" : ""}"
              role="option"
              aria-selected="${isActive ? "true" : "false"}"
              data-command-index="${globalIndex}"
              data-command-id="${escapeHtml(item.id)}"
              data-command-type="${escapeHtml(item.type)}"
              ${item.view ? `data-command-view="${escapeHtml(item.view)}"` : ""}
              ${item.action ? `data-command-action="${escapeHtml(item.action)}"` : ""}
              ${item.exampleKind ? `data-example-kind="${escapeHtml(item.exampleKind)}"` : ""}
              ${item.elementId ? `data-element-id="${escapeHtml(item.elementId)}"` : ""}>
            <div class="command-palette-item-main">
              <strong class="command-palette-title">${escapeHtml(item.title)}</strong>
              ${item.subtitle ? `<span class="command-palette-subtitle">${escapeHtml(item.subtitle)}</span>` : ""}
            </div>
            ${badge}
          </li>
        `;
      }
      groupedHtml += `</ul></div>`;
    }
  }

  return `
    <div class="command-palette-shell">
      <header class="command-palette-header">
        <span class="command-palette-search-icon" aria-hidden="true">🔍</span>
        <input type="text"
               class="command-palette-input"
               id="commandPaletteInput"
               placeholder="输入命令、步骤或要素名称进行搜索… (↑↓ 移动, Enter 执行, Esc 关闭)"
               value="${escapeHtml(query)}"
               autocomplete="off"
               spellcheck="false"
               aria-label="命令面板搜索输入">
        <kbd class="command-palette-esc-hint" data-action="close-command-palette">Esc</kbd>
      </header>
      <div class="command-palette-results" id="commandPaletteResults" role="listbox" aria-label="搜索结果">
        ${groupedHtml}
      </div>
      <footer class="command-palette-footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> 切换选项</span>
        <span><kbd>↵</kbd> 执行 / 跳转</span>
        <span><kbd>Esc</kbd> 关闭</span>
      </footer>
    </div>
  `;
}
