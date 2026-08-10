/** Shared DOM helpers for the workbench shell. */

export const $ = (selector) => document.querySelector(selector);

export function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

export function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[character]));
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadArtifact(artifact, notify = showToast) {
  const blob = new Blob([artifact.content], { type: artifact.mime });
  downloadBlob(blob, artifact.filename);
  notify(`${artifact.label}已生成`);
}

export function writePrintableReport(target, payload, loading = false, buildMarkdown) {
  const markdown = buildMarkdown(payload);
  const title = `${payload.project.title} 成果报告`;
  const content = loading ? "<p class=\"status\">正在准备正式 PDF 报告...</p>" : renderPrintableMarkdown(markdown);
  target.document.open();
  target.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="${window.location.origin}/design-studio/styles.css?v=0.35"></head><body class="print-report"><div class="toolbar"><button type="button" onclick="window.print()">打印 / 保存为 PDF</button></div><main>${content}</main></body></html>`);
  target.document.close();
}

export function renderPrintableMarkdown(markdown) {
  return markdown.split(/\n{2,}/).map((block) => {
    if (block.startsWith("# ")) return `<h1>${escapeHtml(block.slice(2))}</h1>`;
    if (block.startsWith("## ")) return `<h2>${escapeHtml(block.slice(3))}</h2>`;
    if (block.startsWith("### ")) return `<h3>${escapeHtml(block.slice(4))}</h3>`;
    if (block.split("\n").every((line) => line.startsWith("- "))) {
      return `<ul>${block.split("\n").map((line) => `<li>${escapeHtml(line.slice(2))}</li>`).join("")}</ul>`;
    }
    return `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`;
  }).join("");
}
