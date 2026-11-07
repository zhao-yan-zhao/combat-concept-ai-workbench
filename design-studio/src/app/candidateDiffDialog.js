import { compareModelSnapshots } from "../modelCompare.js";
import { escapeHtml } from "./domUtils.js";

/**
 * 弹出 AI 候选与当前模型的差异预览对话框 (<dialog id="candidateDiffDialog">)
 *
 * @param {object} baselineSnapshot 当前模型的完整或局部快照结构 { model: { ov1, ov5, ... } }
 * @param {object} candidateSnapshot 候选模型的快照结构
 * @param {{ title?: string, note?: string }} [options] 对话框标题与说明
 * @returns {Promise<boolean>} 用户点击“确认应用并建立恢复点”返回 true，取消返回 false
 */
export async function showCandidateDiffDialog(baselineSnapshot, candidateSnapshot, {
  title = "AI 候选模型差异预览",
  note = "应用候选将替换当前模型。系统会在应用前自动保存一个可恢复的模型快照。"
} = {}) {
  if (typeof document === "undefined") return true;

  // 使用现成的 compareModelSnapshots 生成对比结构
  const comparison = compareModelSnapshots(baselineSnapshot, candidateSnapshot);

  return new Promise((resolve) => {
    let dialog = document.getElementById("candidateDiffDialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "candidateDiffDialog";
      dialog.className = "candidate-diff-dialog";
      document.body.appendChild(dialog);
    }

    // 汇总变更统计与前 10 条明细
    let changeItems = [];
    if (comparison?.changes) {
      for (const group of comparison.changes) {
        if (group.added?.length) {
          for (const item of group.added) {
            changeItems.push({ type: "add", label: `[新增] ${group.label}: ${item}` });
          }
        }
        if (group.changed?.length) {
          for (const item of group.changed) {
            changeItems.push({ type: "change", label: `[修改] ${group.label}: ${item}` });
          }
        }
        if (group.removed?.length) {
          for (const item of group.removed) {
            changeItems.push({ type: "remove", label: `[删除] ${group.label}: ${item}` });
          }
        }
      }
    }

    const totalAdded = changeItems.filter(i => i.type === "add").length;
    const totalChanged = changeItems.filter(i => i.type === "change").length;
    const totalRemoved = changeItems.filter(i => i.type === "remove").length;
    const previewList = changeItems.slice(0, 10);

    const summaryText = `新增 ${totalAdded} 项 · 修改 ${totalChanged} 项 · 删除 ${totalRemoved} 项`;

    dialog.innerHTML = `
      <div class="candidate-diff-card">
        <header class="candidate-diff-header">
          <h3>${escapeHtml(title)}</h3>
          <p class="candidate-diff-note">${escapeHtml(note)}</p>
        </header>

        <div class="candidate-diff-summary-bar">
          <span class="diff-badge diff-summary">${escapeHtml(summaryText)}</span>
        </div>

        <div class="candidate-diff-detail-list">
          ${previewList.length > 0 ? `
            <ul>
              ${previewList.map(item => `<li class="diff-item diff-${item.type}">${escapeHtml(item.label)}</li>`).join("")}
            </ul>
            ${changeItems.length > 10 ? `<p class="diff-more-hint">还有 ${changeItems.length - 10} 项变更未在缩略中列出…</p>` : ""}
          ` : `<p class="diff-empty-hint">模型结构与现有版本相近，主要为属性微调。</p>`}
        </div>

        <footer class="candidate-diff-actions">
          <button type="button" class="quiet-button" id="cancelCandidateDiffBtn">取消</button>
          <button type="button" class="primary-button" id="confirmCandidateDiffBtn">确认应用并建立恢复点</button>
        </footer>
      </div>
    `;

    const cleanup = () => {
      dialog.close();
    };

    dialog.querySelector("#cancelCandidateDiffBtn")?.addEventListener("click", () => {
      cleanup();
      resolve(false);
    }, { once: true });

    dialog.querySelector("#confirmCandidateDiffBtn")?.addEventListener("click", () => {
      cleanup();
      resolve(true);
    }, { once: true });

    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      cleanup();
      resolve(false);
    }, { once: true });

    try {
      dialog.showModal();
    } catch {
      // 容错环境降级
      resolve(true);
    }
  });
}
