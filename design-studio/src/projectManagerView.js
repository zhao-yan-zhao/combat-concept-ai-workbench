/**
 * projectManagerView.js
 * 项目管理器与全屏入场启动台（Launcher）视图组件
 */

/**
 * 全屏项目入场启动台（Project Entry Launcher）
 * 方案二：工业级软件双栏启动台
 * - 左栏：已有研究项目（Recent Projects，一键直达）
 * - 右栏：创建新项目与快速起点（Quick Starters + Blank Create Form）
 */
export function renderProjectEntry({ directory = {}, createOpen = false, isLead = false } = {}) {
  const ready = directory.status === "ready";
  const unavailable = directory.status === "unavailable";

  if (!ready) {
    return `
      <div class="project-entry">
        <header class="project-entry-header">
          <span class="launcher-brand-tag">Combat Concept Studio · M7</span>
          <h1>选择研究项目</h1>
          <p>面向复杂体系对抗的高效论证与推演平台。</p>
        </header>
        <div class="project-entry-status" style="text-align:center; padding:40px 20px; background:rgba(15,23,42,0.7); border:1px solid rgba(56,189,248,0.2); border-radius:10px;">
          <p role="status" style="color:#94a3b8; font-size:14px; margin-bottom:16px;">
            ${unavailable ? "项目列表暂时无法加载，请确认后端服务状态后重试。" : "正在读取项目列表…"}
          </p>
          ${unavailable ? '<button type="button" class="primary-btn compact-btn" data-action="retry-project-entry" style="padding:6px 16px; font-size:13px; cursor:pointer;">重新加载</button>' : ""}
        </div>
      </div>
    `;
  }

  const projects = (directory.projects || []).filter((item) => !item.archived);
  const defaultSuggestedId = `research-${Date.now().toString(36).slice(-6)}`;

  return `
    <div class="project-entry project-entry-launcher">
      <!-- 启动台大标题与品牌标 -->
      <header class="project-entry-header">
        <div class="launcher-brand-tag">Combat Concept Studio · M7</div>
        <h1>作战概念 AI 研究工作台</h1>
        <p>汇聚经过仿真验证与论证闭环的作战战法；选择已有项目继续推进，或按战法/想定起点创建新项目。</p>
      </header>

      <!-- 双栏启动台主体 -->
      <div class="launcher-grid">
        <!-- 左栏：已有研究项目列表 (Recent Projects) -->
        <section class="launcher-col launcher-recent-col" aria-label="已有研究项目">
          <div class="launcher-col-header">
            <div class="col-title">
              <span class="icon">📂</span>
              <strong>已有研究项目</strong>
              <span class="col-count-badge">${projects.length}</span>
            </div>
            <small class="col-sub">点击即可载入项目上下文</small>
          </div>

          <div class="launcher-recent-list">
            ${projects.length === 0 ? `
              <div class="launcher-empty-notice">
                <div class="empty-icon">📭</div>
                <strong>本地尚未创建研究项目</strong>
                <p>可在右侧填写表单创建空白项目，或选择成熟战法/案例作为研究起点。</p>
              </div>
            ` : projects.map((item) => {
              const kindLabel = item.kind === "scenario" ? "想定推演" : "战法设计";
              return `
                <article class="launcher-project-item">
                  <div class="launcher-item-main">
                    <strong class="launcher-item-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</strong>
                    <div class="launcher-item-meta">
                      <span class="launcher-item-id" title="${escapeHtml(item.id)}">${escapeHtml(item.id)}</span>
                      <span class="project-kind-pill" data-project-kind="${escapeHtml(item.kind || "tactic")}">${kindLabel}</span>
                    </div>
                  </div>
                  <div class="launcher-item-actions">
                    <button type="button" class="launcher-enter-btn" data-project-switch="${escapeHtml(item.id)}">进入 →</button>
                  </div>
                </article>
              `;
            }).join("")}
          </div>
        </section>

        <!-- 右栏：新建研究项目与推荐起点 (Create & Starters) -->
        <section class="launcher-col launcher-create-col" aria-label="新建研究项目与起点">
          <div class="launcher-col-header">
            <div class="col-title">
              <span class="icon">✨</span>
              <strong>创建新研究项目</strong>
            </div>
            <small class="col-sub">支持空白起草或基于成熟战法克隆</small>
          </div>

          <!-- 推荐起点快捷卡片 -->
          <div class="launcher-starters-block">
            <div class="starters-caption">⚡ 快速推荐起点：</div>
            <div class="starters-cards">
              <button type="button" class="starter-card starter-tactics" data-action="open-tactics-library" title="打开跨项目战法复用库">
                <span class="starter-card-icon">📚</span>
                <div class="starter-card-body">
                  <strong>战法复用库</strong>
                  <small>克隆成熟战法为起点</small>
                </div>
              </button>
              <button type="button" class="starter-card" data-action="load-example-project" data-example-kind="tactic" title="载入战法设计全流程示例">
                <span class="starter-card-icon">🎯</span>
                <div class="starter-card-body">
                  <strong>战法设计示例</strong>
                  <small>饱和突防全链示例</small>
                </div>
              </button>
              <button type="button" class="starter-card" data-action="load-example-project" data-example-kind="scenario" title="载入想定推演全流程示例">
                <span class="starter-card-icon">🗺️</span>
                <div class="starter-card-body">
                  <strong>想定推演示例</strong>
                  <small>海峡海空对抗案例</small>
                </div>
              </button>
            </div>
          </div>

          <!-- 新建空白项目表单 -->
          <div class="launcher-form-card">
            <div class="launcher-form-heading">
              <span>或从空白起点创建新项目：</span>
            </div>
            <form id="projectCreateForm" class="launcher-form">
              <div class="form-row">
                <label>
                  <span class="label-text">项目名称 <span class="required-star">*</span></span>
                  <input name="title" required maxlength="120" placeholder="例如：某海峡海空协同远程打击作战概念" autofocus />
                </label>
              </div>

              <div class="form-row form-grid-2">
                <label>
                  <span class="label-text">项目英文标识 <span class="required-star">*</span></span>
                  <input name="id" required minlength="2" maxlength="64" pattern="[a-z0-9][a-z0-9_-]{1,63}" value="${defaultSuggestedId}" placeholder="research-202607" />
                </label>
                <label>
                  <span class="label-text">研究类型</span>
                  <select name="kind">
                    <option value="tactic" selected>战法设计（意图、活动机理与协同抗毁）</option>
                    <option value="scenario">想定推演（态势、编组、回合推进与规则）</option>
                  </select>
                </label>
              </div>

              <div class="form-row">
                <label>
                  <span class="label-text">研究说明（可选）</span>
                  <textarea name="description" maxlength="500" rows="2" placeholder="简要说明本概念研究的作战使命、威胁环境或核心假定..."></textarea>
                </label>
              </div>

              <div class="form-actions-row">
                <button type="submit" class="launcher-create-submit">
                  <span>🚀 立即创建并进入研究工作台</span>
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  `;
}

/**
 * 顶部导航栏项目切换小菜单组件（Dropdown Panel under Menubar Trigger）
 */
export function renderProjectManager({ directory = {}, activeProjectId = "default", open = false, createOpen = false, isLead = false } = {}) {
  const projects = directory.projects || [];
  const active = projects.find((item) => item.id === activeProjectId);
  const activeTitle = active?.title || activeProjectId || "研究项目";
  const count = projects.filter((item) => !item.archived).length;
  const trigger = `<button type="button" class="project-manager-trigger" data-action="toggle-project-manager" aria-expanded="${open ? "true" : "false"}"><span class="project-manager-trigger-label">项目</span><strong title="${escapeHtml(activeTitle)}">${escapeHtml(activeTitle)}</strong><b>${count}</b><i class="project-manager-caret" aria-hidden="true"></i></button>`;
  if (!open) return `<div class="project-manager-root is-top">${trigger}</div>`;
  const rows = projects.map((item) => {
    const isActive = item.id === activeProjectId;
    const status = item.archived ? "已归档" : isActive ? "当前项目" : "可进入";
    const kindLabel = item.kind === "scenario" ? "想定推演" : "战法设计";
    const deleteAction = isLead && item.id !== "default" ? `<button type="button" class="project-row-delete" data-project-delete="${escapeHtml(item.id)}" data-project-title="${escapeHtml(item.title)}">删除</button>` : "";
    const archiveAction = isLead && (!isActive || item.archived) ? `<button type="button" class="project-row-link" data-project-archive="${escapeHtml(item.id)}" data-project-archived="${item.archived ? "false" : "true"}">${item.archived ? "恢复" : "归档"}</button>` : "";
    return `<article class="project-manager-row ${isActive ? "is-active" : ""}"><div class="project-manager-row-main"><strong title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</strong><div class="project-manager-row-meta"><span title="${escapeHtml(item.id)}">${escapeHtml(item.id)}</span><small class="project-kind-pill" data-project-kind="${escapeHtml(item.kind || "tactic")}">${kindLabel}</small><small>${status}</small></div></div><div class="project-manager-row-actions">${!isActive ? `<button type="button" data-project-switch="${escapeHtml(item.id)}">进入</button>` : ""}${archiveAction}${deleteAction}</div></article>`;
  }).join("") || (createOpen ? "" : `<div class="project-manager-empty-block"><p class="project-manager-empty">当前暂无研究项目。可点击右上角「+ 新建」起草新项目，或通过「战法示例 / 想定示例 / 战法库」快速体验。</p></div>`);
  const form = createOpen ? `<form id="projectCreateForm" class="project-manager-form"><label>项目名称<input name="title" required maxlength="120" autofocus></label><label>项目标识<input name="id" required minlength="2" maxlength="64" pattern="[a-z0-9][a-z0-9_-]{1,63}" placeholder="research-202607"></label><label>研究类型<select name="kind"><option value="tactic" selected>战法设计（侧重意图、活动机理与协同抗毁）</option><option value="scenario">想定推演（侧重态势、编组、回合推进与规则）</option></select></label><label>研究说明<textarea name="description" maxlength="500" rows="2"></textarea></label><div><button type="submit">创建并进入</button><button type="button" class="project-row-link" data-action="toggle-project-create">取消</button></div></form>` : "";
  const footer = `<div class="project-manager-footer"><span class="project-manager-footer-tip">当前项目</span><div class="project-manager-footer-actions"><button type="button" class="project-row-link project-footer-danger" data-action="reset-project-content" title="清空当前项目的全部设计内容并重置到阶段1">清空内容</button>${activeProjectId !== "default" && isLead ? `<button type="button" class="project-row-link project-footer-danger" data-action="delete-current-project" title="永久删除当前打开的研究项目及其全部数据">删除项目</button>` : ""}</div></div>`;
  return `<div class="project-manager-root is-top is-open">${trigger}<section class="project-manager-panel" role="dialog" aria-label="研究项目管理" tabindex="-1"><div class="project-manager-heading"><span>研究项目</span><div class="project-manager-heading-actions"><button type="button" class="project-row-link" data-action="open-tactics-library" title="打开跨项目战法复用库">战法库</button><button type="button" class="project-row-link" data-action="load-example-project" data-example-kind="tactic" title="载入战法设计全流程示例">战法示例</button><button type="button" class="project-row-link" data-action="load-example-project" data-example-kind="scenario" title="载入想定推演全流程示例">想定示例</button><button type="button" class="project-row-link" data-action="toggle-project-create">${createOpen ? "收起" : "+ 新建"}</button></div></div><div class="project-manager-list">${rows}</div>${form}${footer}</section></div>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
