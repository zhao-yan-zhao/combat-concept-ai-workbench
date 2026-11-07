// @ts-check

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 格式化要素来源文本
 * @param {string} [origin]
 * @param {any[]} [citations]
 * @returns {string}
 */
export function formatOriginLabel(origin, citations = []) {
  if (origin === "human") return "人工定义";
  if (origin === "cited" || (Array.isArray(citations) && citations.length > 0)) return "依据知识";
  return "推论生成";
}

/**
 * 渲染来源标签 [📖 依据] / [⚡ 推论] / [👤 人工]
 * @param {string} [origin]
 * @param {any[]} [citations]
 * @returns {string}
 */
export function renderOriginBadge(origin, citations = []) {
  let effectiveOrigin = origin;
  if (!effectiveOrigin) {
    effectiveOrigin = Array.isArray(citations) && citations.length > 0 ? "cited" : "ai-inferred";
  }
  if (effectiveOrigin === "cited") {
    return `<span class="origin-badge origin-cited" data-origin="cited" title="依据知识库核验条令生成">[📖 依据]</span>`;
  }
  if (effectiveOrigin === "human") {
    return `<span class="origin-badge origin-human" data-origin="human" title="研究人员人工建立或修订">[👤 人工]</span>`;
  }
  return `<span class="origin-badge origin-inferred" data-origin="ai-inferred" title="AI 模型推论生成，尚无直接知识条令依据">[⚡ 推论]</span>`;
}

/**
 * 计算证据覆盖率 = 有引用的要素数 / 要素总数
 * @param {any[]} [items]
 * @returns {{ total: number, cited: number, percent: number, label: string }}
 */
export function calculateEvidenceCoverage(items = []) {
  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  const cited = list.filter((item) => {
    if (!item) return false;
    if (item.origin === "cited") return true;
    if (Array.isArray(item.citations) && item.citations.length > 0) return true;
    if (Array.isArray(item.evidenceRefs) && item.evidenceRefs.length > 0) return true;
    if (Array.isArray(item.refs) && item.refs.length > 0 && String(item.refs[0] || "").trim()) return true;
    return false;
  }).length;
  const percent = total > 0 ? Math.round((cited / total) * 100) : 0;
  return {
    total,
    cited,
    percent,
    label: `证据覆盖率 ${percent}% (${cited}/${total})`
  };
}

/**
 * 渲染可展开的引用列表（文件路径、章节/标题、原文摘要）
 * @param {any[]} [citations]
 * @returns {string}
 */
export function renderCitationsAccordion(citations = []) {
  const list = Array.isArray(citations) ? citations.filter(Boolean) : [];
  if (list.length === 0) return "";
  return `
    <details class="citation-accordion" open>
      <summary class="citation-accordion-summary">
        <strong>📚 知识溯源依据 (${list.length} 条已核验切片)</strong>
      </summary>
      <div class="citation-items-list">
        ${list.map((c) => `
          <div class="citation-card" data-chunk-id="${escapeHtml(c.chunkId || '')}">
            <div class="citation-head">
              <strong class="citation-title">📖 ${escapeHtml(c.title || c.chunkTitle || c.chunkId || "未命名切片")}</strong>
              ${c.score ? `<span class="citation-score">${escapeHtml(c.score)}% 匹配</span>` : ""}
            </div>
            ${c.filePath ? `<small class="citation-source">文件路径：${escapeHtml(c.filePath)}</small>` : ""}
            ${c.snippet ? `<blockquote class="citation-snippet">“${escapeHtml(c.snippet)}”</blockquote>` : ""}
          </div>
        `).join("")}
      </div>
    </details>
  `;
}
