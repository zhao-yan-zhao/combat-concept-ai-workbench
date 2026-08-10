import { searchEvidence } from "./knowledgeStore.js";
import { searchProjectKnowledge } from "./projectKnowledgeClient.js";
import { filterKnowledgeDocuments } from "../../server/projectKnowledgeSensitivity.mjs";

export async function selectEvidenceForAi({
  query,
  knowledge,
  knowledgeStorage,
  limit = 4,
  projectId = "default"
} = {}) {
  const normalizedQuery = clean(query, 1200);
  const localPolicy = filterKnowledgeDocuments(knowledge?.docs);
  const local = normalizeEvidence(searchEvidence(normalizedQuery, { ...knowledge, docs: localPolicy.docs }, limit));
  if (!normalizedQuery || knowledgeStorage?.mode !== "server") {
    return createSelection(local, normalizedQuery, "local", "browser-keyword", false, {}, localPolicy);
  }

  try {
    const remote = await searchProjectKnowledge(projectId, normalizedQuery, limit);
    const items = normalizeEvidence(remote.results);
    if (items.length || !local.length) {
      return createSelection(items, normalizedQuery, "server", remote.index?.mode || "keyword", false, remote, { excludedCount: remote.index?.sensitiveExcludedCount || 0 });
    }
  } catch {
    // Local Vault retrieval remains usable whenever the project service is unavailable.
  }
  return createSelection(local, normalizedQuery, "local", "browser-keyword", true, {}, localPolicy);
}

function createSelection(items, query, source, indexMode, fallback, remote = {}, policy = {}) {
  return {
    items,
    provenance: {
      source,
      indexMode,
      query,
      count: items.length,
      fallback,
      sensitiveExcludedCount: Math.max(0, Number(policy.excludedCount) || 0),
      projectRevision: Number(remote?.revision || 0),
      resourceRevision: Number(remote?.resourceRevision || 0),
      selectedAt: new Date().toISOString()
    }
  };
}

function normalizeEvidence(items) {
  return (Array.isArray(items) ? items : []).slice(0, 8).map((item) => ({
    id: clean(item?.id, 180),
    title: clean(item?.title, 240),
    filePath: clean(item?.filePath || item?.name, 600),
    summary: clean(item?.summary || item?.text || item?.excerpt, 800),
    matchReasons: Array.isArray(item?.matchReasons) ? item.matchReasons.map((reason) => clean(reason, 160)).filter(Boolean).slice(0, 8) : []
  })).filter((item) => item.title || item.summary);
}

function clean(value, maximum) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
}
