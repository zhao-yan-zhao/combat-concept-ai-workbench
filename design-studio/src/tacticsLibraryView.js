/**
 * tacticsLibraryView.js
 * M7-T7.4 战法库浏览、检索与复制创建弹窗组件
 */

export function renderTacticsLibraryModal({ tactics = [], open = false, searchQuery = "", activeCategory = "" } = {}) {
  if (!open) return "";

  const categories = ["全部", "反舰突防 / 电子欺骗", "防空压制 / 静默突防", "走廊破门 / 体系破击", "非对称打击 / 港口封锁", "战术战法"];
  const isAllActive = !activeCategory || activeCategory === "all" || activeCategory === "全部";

  return `
    <div class="tactics-library-overlay" style="position:fixed; inset:0; z-index:9999; background:rgba(2,6,23,0.75); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px;">
      <section class="surface tactics-library-dialog" role="dialog" aria-modal="true" aria-label="作战战法复用库" style="width:100%; max-width:960px; max-height:85vh; display:flex; flex-direction:column; background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; box-shadow:0 20px 40px rgba(0,0,0,0.3); overflow:hidden;">
        
        <!-- 对话框头部 -->
        <header class="tactics-lib-header" style="padding:14px 20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; background:#f8fafc;">
          <div>
            <h3 style="margin:0 0 4px 0; font-size:16px; color:#0f172a; display:flex; align-items:center; gap:8px;">
              <span>📚 跨项目战法复用库 (Tactics Library)</span>
              <span class="mini-tag" style="background:#e0f2fe; color:#0369a1; font-size:11px;">M7-T7.4</span>
              <span class="mini-tag" style="background:#f1f5f9; color:#475569; font-size:11px;">${tactics.length} 项战法已收录</span>
            </h3>
            <p style="margin:0; font-size:12px; color:#64748b;">
              汇聚经过仿真验证与论证闭环的作战战法；支持一键复制成熟战法作为新项目研究起点（纯解耦复制，无脆弱联动）。
            </p>
          </div>
          <button type="button" class="quiet-button" data-action="close-tactics-library" style="font-size:18px; color:#64748b; padding:2px 8px; cursor:pointer;" title="关闭 (Esc)">✕</button>
        </header>

        <!-- 搜索与筛选工具栏 -->
        <div class="tactics-lib-toolbar" style="padding:10px 20px; border-bottom:1px solid #f1f5f9; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; background:#fff;">
          <div style="display:flex; gap:8px; align-items:center; flex:1; min-width:280px;">
            <input type="search" id="tacticsLibSearchInput" class="tactics-search-input" value="${escapeHtml(searchQuery)}" placeholder="检索战法名称、核心机制、适用条件..." style="font-size:12px; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; flex:1; max-width:360px;" />
            <button type="button" class="quiet-button compact-btn" data-action="search-tactics-library" style="cursor:pointer;">🔍 检索</button>
          </div>
          <div class="tactics-lib-categories" style="display:flex; flex-wrap:wrap; gap:6px;">
            ${categories.map((cat) => {
              const active = (cat === "全部" && isAllActive) || (activeCategory === cat);
              return `
              <button type="button" class="quiet-button compact-btn ${active ? "active" : ""}" data-action="filter-tactics-category" data-category="${escapeHtml(cat === "全部" ? "" : cat)}" style="font-size:11.5px; cursor:pointer; ${active ? "background:#0284c7; color:#ffffff; font-weight:600; border-color:#0284c7;" : ""}">
                ${escapeHtml(cat)}
              </button>
            `;
            }).join("")}
          </div>
        </div>

        <!-- 战法卡片列表区 -->
        <div class="tactics-lib-list" style="padding:16px 20px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:14px; background:#f8fafc;">
          ${tactics.length === 0 ? `
            <div style="text-align:center; padding:40px 0; color:#94a3b8; font-size:13px;">
              <p style="margin:0 0 10px 0;">未找到匹配的战法条目。可尝试清空检索词或在已有项目中点击「存入战法库」。</p>
              <button type="button" class="quiet-button compact-btn" data-action="reset-tactics-filter" style="border:1px solid #cbd5e1; padding:4px 12px; border-radius:4px; font-size:12px; cursor:pointer; background:#fff;">🔄 重置筛选与检索</button>
            </div>
          ` : tactics.map((t) => `
            <article class="tactics-lib-card" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:14px 16px; display:flex; flex-direction:column; gap:8px; box-shadow:0 2px 6px rgba(0,0,0,0.03);" data-tactic-id="${escapeHtml(t.id)}">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                  <h4 style="margin:0 0 4px 0; font-size:14.5px; color:#0f172a; display:flex; align-items:center; gap:8px;">
                    <strong>${escapeHtml(t.name)}</strong>
                    <span class="mini-tag" style="background:#e0f2fe; color:#0369a1; font-size:11px;">${escapeHtml(t.category || "战术战法")}</span>
                    <small style="color:#94a3b8; font-size:11px;">提供者: ${escapeHtml(t.author || "作战概念专家")}</small>
                  </h4>
                  <p style="margin:0; font-size:12px; color:#475569; line-height:1.45;">
                    ${escapeHtml(t.summary)}
                  </p>
                </div>
                <div style="display:flex; gap:8px;">
                  <button type="button" class="primary-btn compact-btn" data-action="fork-tactic-as-project" data-tactic-id="${escapeHtml(t.id)}" style="font-size:11.5px; white-space:nowrap; cursor:pointer;">
                    🚀 复制为起点创建项目
                  </button>
                  ${t.id.startsWith("tactic-lib-") ? `
                    <button type="button" class="quiet-button compact-btn" data-action="delete-tactic-entry" data-tactic-id="${escapeHtml(t.id)}" style="color:#ef4444; font-size:11.5px; cursor:pointer;" title="从战法库移除">
                      删除
                    </button>
                  ` : ""}
                </div>
              </div>

              <!-- 适用条件与制胜机理概要 -->
              <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:10px; background:#f8fafc; border:1px solid #f1f5f9; border-radius:6px; padding:8px 10px; font-size:11.5px;">
                <div>
                  <span style="color:#64748b; font-weight:600;">🎯 适用条件：</span>
                  <span style="color:#334155;">${escapeHtml(t.applicableConditions || "通用协同攻防环境")}</span>
                </div>
                <div>
                  <span style="color:#64748b; font-weight:600;">⛓️ 制胜论证主张：</span>
                  <span style="color:#334155;">${escapeHtml(t.claim || t.coreApproach || "多域协同打破平衡")}</span>
                </div>
              </div>

              <!-- 战例借鉴与假设统计 -->
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#94a3b8; border-top:1px dashed #f1f5f9; padding-top:6px;">
                <div style="display:flex; gap:12px;">
                  ${t.tacticalCases?.length ? `<span>📚 借鉴经典战例: ${escapeHtml(t.tacticalCases.map((c) => c.caseName).join("、"))}</span>` : ""}
                  ${t.assumptions?.length ? `<span>📋 关联核心假设: ${t.assumptions.length} 项</span>` : ""}
                </div>
                <span title="${escapeHtml(t.savedAt)}">录入时间: ${escapeHtml((t.savedAt || "").slice(0, 10))}</span>
              </div>
            </article>
          `).join("")}
        </div>

        <!-- 对话框底部 -->
        <footer style="padding:10px 20px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; background:#fff;">
          <small style="color:#94a3b8; font-size:11px;">提示：点击弹窗外部空白处或按 Esc 键可快速关闭</small>
          <button type="button" class="quiet-button" data-action="close-tactics-library" style="font-size:12px; cursor:pointer;">关闭</button>
        </footer>
      </section>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
