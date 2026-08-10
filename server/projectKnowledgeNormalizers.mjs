import { buildVaultSummary, normalizeKnowledgeChunk } from "../shared/knowledge.js";
import { describeKnowledgeSensitivity } from "./projectKnowledgeSensitivity.mjs";

const MAX_DOCUMENTS = 480;
const MAX_CONTENT_LENGTH = 8000;
const MAX_TEXT_LENGTH = 800;
const MAX_SUMMARY_LENGTH = 480;
const MAX_TAGS = 16;
const MAX_LINKS = 16;
const MAX_FRONTMATTER_FIELDS = 24;
const MAX_TABLES = 4;
const MAX_TABLE_HEADERS = 12;
const MAX_TABLE_ROWS = 16;
const MAX_TABLE_CELL_LENGTH = 240;

// The prototype keeps searchable evidence bounded while preserving its source metadata.
export function normalizeKnowledgeVault(input) {
  const seen = new Set();
  const docs = (Array.isArray(input?.docs) ? input.docs : [])
    .slice(0, MAX_DOCUMENTS)
    .map((doc, index) => normalizeKnowledgeDocument(doc, index, seen))
    .filter(Boolean);

  return {
    docs,
    summary: docs.length ? buildVaultSummary(docs) : null,
    index: {
      mode: "keyword",
      documentCount: docs.length,
      indexedAt: cleanText(input?.indexedAt, 80) || new Date().toISOString()
    }
  };
}

function normalizeKnowledgeDocument(value, index, seen) {
  const base = normalizeKnowledgeChunk(value || {});
  const content = cleanText(base.content || base.text, MAX_CONTENT_LENGTH);
  if (!content) return null;

  let id = cleanIdentifier(base.id, 180) || `knowledge-${index + 1}`;
  while (seen.has(id)) id = `${id}-${index + 1}`.slice(0, 180);
  seen.add(id);

  const tags = cleanList(base.tags, MAX_TAGS, 120);
  const links = cleanList(base.links, MAX_LINKS, 180);
  const title = cleanText(base.title || base.name, 240) || "未命名知识片段";
  return {
    id,
    vaultId: cleanIdentifier(base.vaultId, 160) || "vault-default",
    vaultName: cleanText(base.vaultName, 240) || "本地 Obsidian 知识库",
    filePath: cleanText(base.filePath || base.name, 600),
    name: cleanText(base.name || base.filePath || title, 600),
    title,
    fileTitle: cleanText(base.fileTitle || title, 240),
    tags,
    links,
    content,
    text: cleanText(base.text || content, MAX_TEXT_LENGTH) || content.slice(0, MAX_TEXT_LENGTH),
    summary: cleanText(base.summary, MAX_SUMMARY_LENGTH) || content.slice(0, 180),
    parameterTables: normalizeParameterTables(base.parameterTables),
    frontmatter: normalizeFrontmatter(base.frontmatter),
    sensitivity: describeKnowledgeSensitivity(base),
    sourceType: cleanIdentifier(base.sourceType, 40) || "markdown",
    importedAt: cleanText(base.importedAt, 80),
    fileCount: clampInteger(base.fileCount, 1, MAX_DOCUMENTS),
    chunkIndex: clampInteger(base.chunkIndex, 0, MAX_DOCUMENTS),
    score: 0,
    matchReasons: []
  };
}

function normalizeFrontmatter(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value)
    .slice(0, MAX_FRONTMATTER_FIELDS)
    .reduce((result, [key, item]) => {
      const normalizedKey = cleanText(key, 80);
      const normalizedValue = Array.isArray(item)
        ? cleanList(item, 12, 160)
        : cleanText(item, 240);
      if (normalizedKey && (Array.isArray(normalizedValue) ? normalizedValue.length : normalizedValue)) result[normalizedKey] = normalizedValue;
      return result;
    }, {});
}

function normalizeParameterTables(value) {
  return (Array.isArray(value) ? value : [])
    .slice(0, MAX_TABLES)
    .map((table) => {
      const headers = cleanList(table?.headers, MAX_TABLE_HEADERS, 100);
      if (headers.length < 2) return null;
      const rows = (Array.isArray(table?.rows) ? table.rows : [])
        .slice(0, MAX_TABLE_ROWS)
        .map((row) => headers.reduce((result, header) => {
          const cell = cleanText(row?.[header], MAX_TABLE_CELL_LENGTH);
          if (cell) result[header] = cell;
          return result;
        }, {}))
        .filter((row) => Object.keys(row).length);
      if (!rows.length) return null;
      return { title: cleanText(table?.title, 180) || "参数表", headers, rows };
    })
    .filter(Boolean);
}

function cleanList(value, maximum, itemMaximum) {
  return [...new Set((Array.isArray(value) ? value : [value])
    .map((item) => cleanText(item, itemMaximum))
    .filter(Boolean))]
    .slice(0, maximum);
}

function cleanIdentifier(value, maximum) {
  return String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, maximum);
}

function cleanText(value, maximum) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function clampInteger(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(maximum, Math.floor(parsed)));
}
