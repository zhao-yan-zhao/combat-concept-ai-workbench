import { buildKnowledgeGraph } from "./knowledgeGraphBuilder.js";
import { findKnowledgeNote, searchEvidence } from "./knowledgeStore.js";
import { filterKnowledgeDocuments } from "../../server/projectKnowledgeSensitivity.mjs";
import { canReviewSensitiveKnowledge } from "../../server/knowledgeSensitivityAccess.mjs";

export function renderKnowledgeEvidence(vault, selection, query = "", results = null, search = {}) {
  if (!vault?.docs?.length) {
    return `
      <section class="inspector-section knowledge-evidence">
        <h3>Obs 知识库</h3>
        <p>尚未连接本地知识库。</p>
        <button class="quiet-button" data-action="connect-knowledge">连接 Obs</button>
      </section>
    `;
  }

  const includeSensitive = Boolean(search.includeSensitive);
  const canReviewSensitive = canReviewSensitiveKnowledge(search.actor);
  const visibleVault = filterKnowledgeDocuments(vault.docs, { includeSensitive });
  const searchQuery = query.trim() || buildSelectionQuery(selection);
  const displayedResults = searchQuery ? (Array.isArray(results) ? results : searchEvidence(searchQuery, vault, 4, { includeSensitive })) : [];
  const summary = vault.summary;
  const retrievalMode = ["keyword", "vector", "hybrid"].includes(search.retrievalMode) ? search.retrievalMode : "hybrid";
  const graph = buildKnowledgeGraph(visibleVault.docs, { focusIds: displayedResults.map((item) => item.id) });
  return `
    <section class="inspector-section knowledge-evidence">
      <h3>Obs 知识证据</h3>
      <p class="knowledge-meta">${escapeHtml(summary.name)} · ${summary.fileCount} 篇笔记 · ${summary.chunkCount} 个片段 · ${summary.tableCount || 0} 张参数表 / ${summary.parameterRowCount || 0} 行参数</p>
      <form class="knowledge-search" id="knowledgeSearchForm">
        <input name="query" value="${escapeAttribute(query)}" placeholder="检索笔记、标签或双链">
        <select name="mode" aria-label="服务端检索模式">
          ${renderRetrievalOption("hybrid", "混合检索", retrievalMode)}
          ${renderRetrievalOption("keyword", "关键词", retrievalMode)}
          ${renderRetrievalOption("vector", "向量（默认本地）", retrievalMode)}
        </select>
        <label class="knowledge-sensitive-toggle"><input type="checkbox" name="includeSensitive" ${includeSensitive ? "checked" : ""} ${canReviewSensitive ? "" : "disabled"}> 本地查看敏感片段</label>
        <button type="submit">检索</button>
      </form>
      ${summary.sensitiveChunkCount ? `<p class="knowledge-sensitive-note">Vault 含 ${summary.sensitiveChunkCount} 个敏感片段；敏感复核仅限已登录负责人，AI 证据、红方提示词和报告引用始终默认排除。</p>` : ""}
      ${renderSensitiveCitationPolicy(vault.docs, search.citationApprovals, canReviewSensitive)}
      ${search.detail ? `<p class="knowledge-search-state ${escapeAttribute(search.mode || "local")}">${escapeHtml(search.detail)}</p>` : ""}
      <div class="knowledge-results">
        ${renderEvidenceResults(displayedResults, searchQuery)}
      </div>
      ${renderKnowledgeGraph(graph)}
    </section>
  `;
}

function renderSensitiveCitationPolicy(docs, approvals, canReviewSensitive) {
  if (!canReviewSensitive) return "";
  const sensitive = (docs || []).filter((item) => item.sensitivity?.marked);
  if (!sensitive.length) return "";
  const active = (approvals || []).filter((item) => !item.revokedAt);
  return `<section class="sensitive-citation-policy"><h4>敏感片段报告引用</h4><p>仅对单个片段生效；不影响 AI、红方或外部向量检索。</p><form id="sensitiveCitationApprovalForm"><select name="documentId">${sensitive.map((item) => `<option value="${escapeAttribute(item.id)}">${escapeHtml(item.title)}</option>`).join("")}</select><input name="reason" maxlength="600" required placeholder="授权理由"><button type="submit">授权引用</button></form>${active.length ? `<div>${active.map((item) => `<span>${escapeHtml(item.documentId)}<button type="button" data-revoke-sensitive-citation="${escapeAttribute(item.id)}" title="撤销报告引用授权">撤销</button></span>`).join("")}</div>` : ""}</section>`;
}

function renderRetrievalOption(value, label, selected) {
  return `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`;
}

function renderKnowledgeGraph(graph) {
  if (graph.nodes.length < 2) return "";
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  return `
    <section class="knowledge-graph" aria-label="知识关系图">
      <div class="knowledge-graph-heading"><h4>知识关系图</h4><span>${graph.summary.nodeCount} 节点 · ${graph.summary.edgeCount} 关系</span></div>
      <div class="knowledge-graph-board">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          ${graph.edges.map((edge) => renderKnowledgeGraphEdge(edge, byId)).join("")}
        </svg>
        ${graph.nodes.map((node) => `<button class="knowledge-graph-node ${node.focused ? "focused" : ""}" type="button" data-knowledge-result="${escapeAttribute(node.id)}" style="left:${node.x}%;top:${node.y}%" title="${escapeAttribute(node.filePath || node.title)}">${escapeHtml(node.label)}</button>`).join("")}
      </div>
      <p class="knowledge-graph-meta">双链 ${graph.summary.linkEdgeCount} · 共享标签 ${graph.summary.tagEdgeCount} · 孤立笔记 ${graph.summary.isolatedCount}</p>
    </section>
  `;
}

function renderKnowledgeGraphEdge(edge, byId) {
  const source = byId.get(edge.sourceId);
  const target = byId.get(edge.targetId);
  if (!source || !target) return "";
  const linked = edge.types.includes("link");
  return `<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" class="${linked ? "link" : "tag"}"><title>${escapeHtml(edge.labels.join("、"))}</title></line>`;
}

export function selectionForKnowledgeNote(noteId, vault) {
  const note = findKnowledgeNote(noteId, vault);
  if (!note) return null;
  return {
    id: note.id,
    kind: "knowledge",
    title: note.title,
    status: "Obs 证据",
    text: note.excerpt || note.summary || note.text,
    facts: [
      ["来源", note.filePath || note.name || "本地笔记"],
      ["标签", note.tags?.join("、") || "未标注"],
      ["参数表", formatParameterTableMeta(note)],
      ["敏感控制", note.sensitivity?.marked ? "敏感片段：仅本地显式查看" : "标准片段"],
      ["命中依据", note.matchReasons?.join("、") || "已关联"]
    ],
    refs: note.links || []
  };
}

function renderEvidenceResults(results, searchQuery) {
  if (!searchQuery) return `<p class="knowledge-empty">选择模型节点或输入关键词后显示相关证据。</p>`;
  if (!results.length) return `<p class="knowledge-empty">未找到与“${escapeHtml(searchQuery)}”相关的笔记片段。</p>`;
  return results.map((note) => `
    <button class="knowledge-result" type="button" data-knowledge-result="${escapeAttribute(note.id)}">
      <strong>${escapeHtml(note.title)}</strong>
      <span>${escapeHtml(note.excerpt || note.summary)}</span>
      ${note.parameterTables?.length ? `<small>${escapeHtml(formatParameterTableMeta(note))}</small>` : ""}
      <em>${escapeHtml(note.filePath || note.name || "本地笔记")}</em>
      ${note.sensitivity?.marked ? `<small class="knowledge-sensitive-badge">敏感</small>` : ""}
    </button>
  `).join("");
}

function formatParameterTableMeta(note) {
  const tables = Array.isArray(note?.parameterTables) ? note.parameterTables : [];
  const rows = tables.reduce((count, table) => count + (table.rows?.length || 0), 0);
  return tables.length ? `${tables.length} 张表 / ${rows} 行参数` : "未提取";
}

function buildSelectionQuery(selection) {
  if (!selection) return "";
  return [selection.title, selection.text, ...(selection.refs || [])].filter(Boolean).join(" ");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  }[character]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
