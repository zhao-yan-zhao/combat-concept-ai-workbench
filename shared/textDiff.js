/**
 * shared/textDiff.js
 * 纯轻量零依赖的行级文本差异对比与格式化渲染工具
 */

/**
 * 计算两段文本之间的行级差异 (基于最长公共子序列 LCS 算法)
 * @param {string} oldText 原始/历史文本
 * @param {string} newText 当前/新文本
 * @param {object} [options]
 * @param {number} [options.maxLines=1200] 最大对比行数限制，防止超大文本阻塞
 * @returns {{ lines: Array<{ type: 'added'|'removed'|'unchanged', text: string, oldLine: number|null, newLine: number|null }>, stats: { added: number, removed: number, unchanged: number, isIdentical: boolean } }}
 */
export function computeLineDiff(oldText = "", newText = "", options = {}) {
  const maxLines = Number(options?.maxLines) || 1200;
  const linesOld = String(oldText ?? "").split("\n");
  const linesNew = String(newText ?? "").split("\n");

  if (linesOld.length > maxLines || linesNew.length > maxLines) {
    // 降级为快速全量增删标记
    return fallbackDiff(linesOld, linesNew);
  }

  const n = linesOld.length;
  const m = linesNew.length;

  // 构建 LCS 长度矩阵
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (linesOld[i] === linesNew[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // 回溯生成 diff 序列
  const diffLines = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesOld[i - 1] === linesNew[j - 1]) {
      diffLines.push({
        type: "unchanged",
        text: linesOld[i - 1],
        oldLine: i,
        newLine: j
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffLines.push({
        type: "added",
        text: linesNew[j - 1],
        oldLine: null,
        newLine: j
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diffLines.push({
        type: "removed",
        text: linesOld[i - 1],
        oldLine: i,
        newLine: null
      });
      i--;
    }
  }

  diffLines.reverse();

  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const item of diffLines) {
    if (item.type === "added") added++;
    else if (item.type === "removed") removed++;
    else unchanged++;
  }

  return {
    lines: diffLines,
    stats: {
      added,
      removed,
      unchanged,
      isIdentical: added === 0 && removed === 0
    }
  };
}

function fallbackDiff(linesOld, linesNew) {
  const diffLines = [];
  linesOld.forEach((text, idx) => diffLines.push({ type: "removed", text, oldLine: idx + 1, newLine: null }));
  linesNew.forEach((text, idx) => diffLines.push({ type: "added", text, oldLine: null, newLine: idx + 1 }));
  return {
    lines: diffLines,
    stats: {
      added: linesNew.length,
      removed: linesOld.length,
      unchanged: 0,
      isIdentical: false
    }
  };
}

/**
 * 将 diff 结果格式化渲染为安全 HTML
 * @param {object} diffResult computeLineDiff 的输出
 * @returns {string} HTML 字符串
 */
export function renderUnifiedDiffHtml(diffResult) {
  if (!diffResult || !Array.isArray(diffResult.lines)) {
    return `<div class="prompt-diff-empty">暂无差异数据</div>`;
  }
  const { lines, stats } = diffResult;
  if (stats.isIdentical) {
    return `<div class="prompt-diff-identical">两份提示词内容完全相同，无任何差异</div>`;
  }

  const rows = lines.map((item) => {
    const symbol = item.type === "added" ? "+" : item.type === "removed" ? "-" : " ";
    const oldNum = item.oldLine !== null ? item.oldLine : "";
    const newNum = item.newLine !== null ? item.newLine : "";
    return `<tr class="prompt-diff-line line-${item.type}"><td class="diff-num old-num">${oldNum}</td><td class="diff-num new-num">${newNum}</td><td class="diff-mark">${symbol}</td><td class="diff-text">${escapeHtml(item.text)}</td></tr>`;
  }).join("");

  return `
    <div class="prompt-diff-container">
      <div class="prompt-diff-header">
        <span class="diff-tag diff-added">+${stats.added} 行新增</span>
        <span class="diff-tag diff-removed">-${stats.removed} 行删除</span>
        <span class="diff-tag diff-unchanged">${stats.unchanged} 行未变更</span>
      </div>
      <div class="prompt-diff-table-wrap">
        <table class="prompt-diff-table">
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}
