import { describeKnowledgeSensitivity } from "../server/projectKnowledgeSensitivity.mjs";

const MAX_FILES = 120;
const MAX_CHUNKS_PER_FILE = 4;
const MAX_PARAMETER_TABLES_PER_CHUNK = 4;
const MAX_PARAMETER_ROWS_PER_TABLE = 16;

export async function importVaultFiles(files) {
  const markdownFiles = Array.from(files || []).filter((file) => /\.(md|markdown|txt)$/i.test(file.name));
  const vaultId = `vault-${Date.now()}`;
  const vaultName = inferVaultName(markdownFiles);
  const importedAt = new Date().toISOString();
  const imported = [];

  for (const [fileIndex, file] of markdownFiles.slice(0, MAX_FILES).entries()) {
    const text = await file.text();
    const chunks = parseMarkdownFile(file, text, {
      vaultId,
      vaultName,
      fileIndex,
      fileCount: markdownFiles.length,
      importedAt
    });
    imported.push(...chunks);
  }

  return imported;
}

export function parseMarkdownFile(file, text, vault = {}) {
  const filePath = file.webkitRelativePath || file.name;
  const frontmatter = parseFrontmatter(text);
  const body = stripFrontmatter(text);
  const title = extractTitle(body, frontmatter.title || file.name.replace(/\.(md|markdown|txt)$/i, ""));
  const tags = unique([
    ...toArray(frontmatter.tags),
    ...toArray(frontmatter.tag),
    ...extractInlineTags(body)
  ]).slice(0, 12);
  const links = extractWikiLinks(body).slice(0, 12);
  const sections = chunkMarkdown(body);
  const chunks = sections.slice(0, MAX_CHUNKS_PER_FILE).map((section, index) => {
    const content = cleanMarkdown(section.content);
    const chunkTitle = section.heading && section.heading !== title ? `${title} / ${section.heading}` : title;
    return normalizeKnowledgeChunk({
      id: `${vault.vaultId || "vault-default"}-${vault.fileIndex || 0}-${index}`,
      vaultId: vault.vaultId || "vault-default",
      vaultName: vault.vaultName || "默认知识库",
      filePath,
      name: filePath,
      title: chunkTitle,
      fileTitle: title,
      tags,
      links,
      content,
      text: content.slice(0, 520),
      summary: summarize(content),
      parameterTables: extractParameterTables(section.content),
      frontmatter,
      sourceType: /\.(md|markdown)$/i.test(file.name) ? "markdown" : "text",
      importedAt: vault.importedAt || "",
      fileCount: vault.fileCount || 1,
      chunkIndex: index
    });
  });

  return chunks.length ? chunks : [
    normalizeKnowledgeChunk({
      id: `${vault.vaultId || "vault-default"}-${vault.fileIndex || 0}-0`,
      vaultId: vault.vaultId || "vault-default",
      vaultName: vault.vaultName || "默认知识库",
      filePath,
      name: filePath,
      title,
      fileTitle: title,
      tags,
      links,
      content: cleanMarkdown(body),
      parameterTables: extractParameterTables(body),
      sourceType: "markdown",
      frontmatter,
      importedAt: vault.importedAt || "",
      fileCount: vault.fileCount || 1,
      chunkIndex: 0
    })
  ];
}

export function normalizeKnowledgeChunk(doc) {
  const content = doc.content || doc.text || "";
  const title = doc.title || doc.name || "未命名知识";
  return {
    id: doc.id || `chunk-${hash(`${title}${content}`)}`,
    vaultId: doc.vaultId || "vault-default",
    vaultName: doc.vaultName || "默认知识库",
    filePath: doc.filePath || doc.name || "",
    name: doc.name || doc.filePath || title,
    title,
    fileTitle: doc.fileTitle || title,
    tags: unique(doc.tags || []),
    links: unique(doc.links || []),
    content,
    text: doc.text || content.slice(0, 520),
    summary: doc.summary || summarize(content),
    parameterTables: normalizeParameterTables(doc.parameterTables),
    sourceType: doc.sourceType || "markdown",
    frontmatter: doc.frontmatter || {},
    sensitivity: describeKnowledgeSensitivity(doc),
    importedAt: doc.importedAt || "",
    fileCount: doc.fileCount || 1,
    chunkIndex: doc.chunkIndex || 0,
    score: doc.score || 0,
    matchReasons: doc.matchReasons || []
  };
}

export function buildVaultSummary(docs) {
  const chunks = docs.map(normalizeKnowledgeChunk);
  const filePaths = unique(chunks.map((item) => item.filePath || item.name).filter(Boolean));
  const latestImport = chunks.find((item) => item.importedAt)?.importedAt || "";
  const vaultIds = unique(chunks.map((item) => item.vaultId));
  const vaultNames = unique(chunks.map((item) => item.vaultName));
  const tableCount = chunks.reduce((count, item) => count + item.parameterTables.length, 0);
  const parameterRowCount = chunks.reduce((count, item) => count + item.parameterTables.reduce((rows, table) => rows + table.rows.length, 0), 0);
  const sensitiveChunkCount = chunks.filter((item) => item.sensitivity?.marked).length;
  return {
    id: vaultIds.length === 1 ? vaultIds[0] : "vault-local",
    name: vaultNames.length === 1 ? vaultNames[0] : "本地 OBS/Obsidian 知识库",
    sourceType: "obsidian",
    fileCount: filePaths.length || chunks.length,
    chunkCount: chunks.length,
    tableCount,
    parameterRowCount,
    sensitiveChunkCount,
    importedAt: latestImport
  };
}

export function searchKnowledge(query, docs, limit = 5) {
  const tokens = tokenize(query);
  if (!tokens.length) {
    return [];
  }

  return docs
    .map((doc) => scoreKnowledgeChunk(normalizeKnowledgeChunk(doc), tokens))
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function scoreKnowledgeChunk(doc, tokens) {
  const title = `${doc.title} ${doc.fileTitle}`;
  const tags = doc.tags.join(" ");
  const links = doc.links.join(" ");
  const frontmatter = Object.values(doc.frontmatter || {}).join(" ");
  const parameters = doc.parameterTables.flatMap((table) => [table.title, ...table.headers, ...table.rows.flatMap((row) => Object.values(row))]).join(" ");
  const content = `${doc.content} ${doc.text} ${doc.summary}`;
  const weightedFields = [
    ["标题命中", title, 6],
    ["标签命中", tags, 5],
    ["双链命中", links, 4],
    ["Frontmatter 命中", frontmatter, 3],
    ["参数表命中", parameters, 3],
    ["正文命中", content, 1]
  ];
  const matched = [];
  let score = 0;

  for (const token of tokens) {
    for (const [reason, value, weight] of weightedFields) {
      if (value && value.includes(token)) {
        score += weight;
        matched.push(`${reason}:${token}`);
        break;
      }
    }
  }

  return {
    ...doc,
    score,
    matchReasons: unique(matched),
    excerpt: buildExcerpt(doc, tokens)
  };
}

function parseFrontmatter(text) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*/);
  if (!match) {
    return {};
  }

  return match[1].split(/\n+/).reduce((data, line) => {
    const pair = line.match(/^([^:#]+):\s*(.*)$/);
    if (!pair) {
      return data;
    }
    const key = pair[1].trim();
    const value = pair[2].trim();
    data[key] = parseFrontmatterValue(value);
    return data;
  }, {});
}

function parseFrontmatterValue(value) {
  if (/^\[.*\]$/.test(value)) {
    return value
      .replace(/^\[|\]$/g, "")
      .split(/[,，]/)
      .map((item) => item.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return value.replace(/^["']|["']$/g, "");
}

function stripFrontmatter(text) {
  return text.replace(/^---\s*\n[\s\S]*?\n---\s*/, "");
}

function extractTitle(body, fallback) {
  const heading = body.match(/^#\s+(.+)$/m);
  return (heading ? heading[1] : fallback).trim();
}

function extractInlineTags(text) {
  return Array.from(text.matchAll(/(^|\s)#([\u4e00-\u9fa5\w/-]+)/g)).map((match) => match[2]);
}

function extractWikiLinks(text) {
  return unique(Array.from(text.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)).map((match) => match[1].trim()));
}

function extractParameterTables(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const tables = [];
  let sectionTitle = "";

  for (let index = 0; index < lines.length - 1 && tables.length < MAX_PARAMETER_TABLES_PER_CHUNK; index += 1) {
    const heading = lines[index].match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      sectionTitle = heading[1].trim();
      continue;
    }
    if (!isTableRow(lines[index]) || !isTableDivider(lines[index + 1])) continue;

    const headers = normalizeTableHeaders(parseTableCells(lines[index]));
    if (headers.length < 2) continue;

    const rows = [];
    let rowIndex = index + 2;
    while (rowIndex < lines.length && isTableRow(lines[rowIndex])) {
      const values = parseTableCells(lines[rowIndex]);
      if (!isTableDivider(lines[rowIndex])) {
        const row = Object.fromEntries(headers.map((header, cellIndex) => [header, values[cellIndex] || ""]).filter(([, value]) => value));
        if (Object.keys(row).length) rows.push(row);
      }
      rowIndex += 1;
    }

    if (rows.length) {
      tables.push({ title: sectionTitle || "参数表", headers, rows: rows.slice(0, MAX_PARAMETER_ROWS_PER_TABLE) });
    }
    index = rowIndex - 1;
  }

  return tables;
}

function normalizeParameterTables(tables) {
  return (Array.isArray(tables) ? tables : [])
    .slice(0, MAX_PARAMETER_TABLES_PER_CHUNK)
    .map((table) => {
      const headers = normalizeTableHeaders(table?.headers || []);
      const rows = (Array.isArray(table?.rows) ? table.rows : [])
        .slice(0, MAX_PARAMETER_ROWS_PER_TABLE)
        .map((row) => Object.fromEntries(headers.map((header) => [header, cleanTableCell(row?.[header])]).filter(([, value]) => value)))
        .filter((row) => Object.keys(row).length);
      return { title: cleanTableCell(table?.title) || "参数表", headers, rows };
    })
    .filter((table) => table.headers.length > 1 && table.rows.length);
}

function isTableRow(line) {
  const trimmed = String(line || "").trim();
  return /^\|?.+\|.+\|?$/.test(trimmed);
}

function isTableDivider(line) {
  const cells = String(line || "")
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseTableCells(line) {
  return String(line || "")
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map(cleanTableCell);
}

function normalizeTableHeaders(headers) {
  const used = new Map();
  return headers.map((header, index) => {
    const base = cleanTableCell(header) || `列${index + 1}`;
    const count = (used.get(base) || 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base}${count}`;
  });
}

function cleanTableCell(value) {
  return cleanMarkdown(String(value || ""));
}

function chunkMarkdown(body) {
  const lines = body.split(/\r?\n/);
  const chunks = [];
  let current = { heading: "", content: [] };

  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading && current.content.join("\n").trim()) {
      chunks.push({ heading: current.heading, content: current.content.join("\n") });
      current = { heading: heading[1].trim(), content: [line] };
      continue;
    }
    if (heading && !current.heading) {
      current.heading = heading[1].trim();
    }
    current.content.push(line);
  }

  if (current.content.join("\n").trim()) {
    chunks.push({ heading: current.heading, content: current.content.join("\n") });
  }

  if (chunks.length <= MAX_CHUNKS_PER_FILE) {
    return chunks;
  }

  return chunks.slice(0, MAX_CHUNKS_PER_FILE - 1).concat({
    heading: "补充片段",
    content: chunks.slice(MAX_CHUNKS_PER_FILE - 1).map((chunk) => chunk.content).join("\n\n")
  });
}

function cleanMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_, link, alias) => alias || link)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[#>*_\-`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function summarize(text) {
  const clean = cleanMarkdown(text);
  return clean.length > 160 ? `${clean.slice(0, 160)}...` : clean;
}

function buildExcerpt(doc, tokens) {
  const source = doc.content || doc.text || "";
  const token = tokens.find((item) => source.includes(item));
  if (!token) {
    return doc.summary;
  }
  const index = source.indexOf(token);
  const start = Math.max(0, index - 48);
  const end = Math.min(source.length, index + 112);
  return `${start > 0 ? "..." : ""}${source.slice(start, end)}${end < source.length ? "..." : ""}`;
}

function tokenize(query) {
  const rawTokens = String(query || "").match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z0-9]+/g) || [];
  return unique(rawTokens.flatMap(expandToken))
    .filter((token) => token.length > 1)
    .slice(0, 80);
}

function expandToken(token) {
  if (!/^[\u4e00-\u9fa5]+$/.test(token) || token.length <= 4) {
    return [token];
  }

  const pieces = [token];
  for (const size of [4, 3, 2]) {
    for (let index = 0; index <= token.length - size; index += size === 2 ? 2 : 1) {
      pieces.push(token.slice(index, index + size));
    }
  }
  return pieces;
}

function inferVaultName(files) {
  const firstPath = files[0]?.webkitRelativePath;
  return firstPath?.includes("/") ? firstPath.split("/")[0] : "本地 Obsidian 知识库";
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value) {
    return [];
  }
  return String(value).split(/[,，\s]+/).filter(Boolean);
}

function unique(items) {
  return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
}

function hash(value) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = ((result << 5) - result + value.charCodeAt(index)) | 0;
  }
  return Math.abs(result).toString(36);
}
