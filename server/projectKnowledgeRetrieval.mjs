import { normalizeKnowledgeChunk, searchKnowledge as searchKeywordKnowledge } from "../shared/knowledge.js";
import { filterKnowledgeDocuments } from "./projectKnowledgeSensitivity.mjs";

const RETRIEVAL_MODES = ["keyword", "vector", "hybrid"];
const RRF_OFFSET = 48;

export function listKnowledgeRetrievalModes() {
  return [...RETRIEVAL_MODES];
}

export function resolveKnowledgeRetrievalMode(value, fallback = "hybrid") {
  const candidate = String(value || "").trim().toLowerCase();
  if (RETRIEVAL_MODES.includes(candidate)) return candidate;
  return RETRIEVAL_MODES.includes(fallback) ? fallback : "hybrid";
}

export function searchProjectKnowledge({ query, docs, limit = 5, mode, fallbackMode = "hybrid", includeSensitive = false } = {}) {
  const selectedMode = resolveKnowledgeRetrievalMode(mode, resolveKnowledgeRetrievalMode(fallbackMode));
  const maximum = clampLimit(limit);
  const filtered = filterKnowledgeDocuments(docs, { includeSensitive });
  const keyword = searchKeywordKnowledge(query, filtered.docs, maximum);
  const vector = searchSparseVectorKnowledge(query, filtered.docs, maximum);
  const results = selectedMode === "keyword"
    ? keyword
    : selectedMode === "vector"
      ? vector
      : combineKnowledgeRankings(keyword, vector, maximum);
  return {
    index: {
      mode: selectedMode,
      backend: selectedMode === "keyword" ? "deterministic-keyword" : selectedMode === "vector" ? "local-sparse-vector" : "hybrid-rrf",
      documentCount: filtered.docs.length,
      sensitiveExcludedCount: filtered.excludedCount,
      includeSensitive: filtered.includeSensitive
    },
    results
  };
}

function searchSparseVectorKnowledge(query, docs, limit) {
  const queryVector = toVector(extractTerms(query));
  const queryNorm = vectorNorm(queryVector);
  if (!queryNorm) return [];
  return docs
    .map((value) => scoreSparseVectorDocument(normalizeKnowledgeChunk(value), queryVector, queryNorm))
    .filter((doc) => doc.score > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, limit);
}

function scoreSparseVectorDocument(doc, queryVector, queryNorm) {
  const titleTerms = extractTerms(`${doc.title} ${doc.fileTitle} ${(doc.tags || []).join(" ")}`);
  const bodyTerms = extractTerms([
    doc.summary,
    doc.text,
    doc.content,
    (doc.links || []).join(" "),
    Object.values(doc.frontmatter || {}).flat().join(" "),
    (doc.parameterTables || []).flatMap((table) => [table.title, ...(table.headers || []), ...(table.rows || []).flatMap((row) => Object.values(row))]).join(" ")
  ].join(" "));
  const titleVector = toVector(titleTerms);
  const bodyVector = toVector(bodyTerms);
  const titleScore = cosineSimilarity(queryVector, queryNorm, titleVector);
  const bodyScore = cosineSimilarity(queryVector, queryNorm, bodyVector);
  const score = Number((titleScore * 0.58 + bodyScore * 0.42).toFixed(6));
  const overlap = [...queryVector.keys()].filter((term) => titleVector.has(term) || bodyVector.has(term));
  return {
    ...doc,
    score,
    matchReasons: score ? [`稀疏向量相似度:${Math.round(score * 100)}%`, ...overlap.slice(0, 4).map((term) => `向量特征:${term}`)] : [],
    excerpt: doc.summary || doc.text || doc.content.slice(0, 240)
  };
}

export function combineKnowledgeRankings(keyword, vector, limit = 5) {
  const combined = new Map();
  addRanking(combined, keyword, "关键词排序");
  addRanking(combined, vector, "向量排序");
  return [...combined.values()]
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, clampLimit(limit))
    .map((item) => ({ ...item, matchReasons: [...new Set(item.matchReasons)] }));
}

function addRanking(target, ranking, source) {
  ranking.forEach((item, index) => {
    const current = target.get(item.id);
    const score = 1 / (RRF_OFFSET + index + 1);
    if (current) {
      current.score += score;
      current.matchReasons.push(source, ...(item.matchReasons || []));
      return;
    }
    target.set(item.id, { ...item, score, matchReasons: [source, ...(item.matchReasons || [])] });
  });
}

function extractTerms(value) {
  const text = String(value || "").normalize("NFKC").toLowerCase();
  const terms = [];
  for (const token of text.match(/[\p{L}\p{N}]+/gu) || []) {
    if (containsHan(token)) {
      const characters = Array.from(token);
      if (characters.length === 1) terms.push(token);
      for (let index = 0; index < characters.length - 1; index += 1) terms.push(characters.slice(index, index + 2).join(""));
    } else if (token.length > 1) {
      terms.push(token);
    }
  }
  return terms;
}

function containsHan(value) {
  return /\p{Script=Han}/u.test(value);
}

function toVector(terms) {
  return terms.reduce((vector, term) => vector.set(term, (vector.get(term) || 0) + 1), new Map());
}

function vectorNorm(vector) {
  return Math.sqrt([...vector.values()].reduce((total, value) => total + value ** 2, 0));
}

function cosineSimilarity(queryVector, queryNorm, documentVector) {
  const documentNorm = vectorNorm(documentVector);
  if (!documentNorm) return 0;
  const dot = [...queryVector.entries()].reduce((total, [term, value]) => total + value * (documentVector.get(term) || 0), 0);
  return dot / (queryNorm * documentNorm);
}

function clampLimit(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(20, Math.floor(parsed))) : 5;
}
