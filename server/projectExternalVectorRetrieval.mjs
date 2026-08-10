import { normalizeKnowledgeChunk } from "../shared/knowledge.js";
import { filterKnowledgeDocuments } from "./projectKnowledgeSensitivity.mjs";

const MAX_RESULTS = 20;

export function createExternalVectorRetrievalAdapter({ endpoint = "", token = "", timeoutMs = 3000, fetchImpl = globalThis.fetch } = {}) {
  const configuredEndpoint = normalizeEndpoint(endpoint);
  const configuredToken = String(token || "").trim();
  const requestTimeout = clampTimeout(timeoutMs);
  const enabled = Boolean(configuredEndpoint && typeof fetchImpl === "function");

  return {
    getStatus() {
      return { adapter: "external-vector-id-only", enabled };
    },

    async search({ projectId, query, docs, limit = 5 } = {}) {
      const filtered = filterKnowledgeDocuments(docs, { includeSensitive: false });
      const allowedDocuments = filtered.docs;
      const allowedDocumentIds = allowedDocuments.map((doc) => String(doc?.id || "")).filter(Boolean);
      const provenance = {
        adapter: "external-vector-id-only",
        enabled,
        allowedDocumentCount: allowedDocumentIds.length,
        sensitiveExcludedCount: filtered.excludedCount
      };

      if (!enabled) return { results: [], provenance: { ...provenance, status: "disabled", reason: "not-configured" } };
      if (!String(query || "").trim() || !allowedDocumentIds.length) {
        return { results: [], provenance: { ...provenance, status: "skipped", reason: "no-query-or-allowed-documents" } };
      }

      try {
        const response = await fetchImpl(configuredEndpoint, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(configuredToken ? { Authorization: `Bearer ${configuredToken}` } : {})
          },
          body: JSON.stringify({
            projectId: String(projectId || "").slice(0, 160),
            query: String(query || "").trim().slice(0, 400),
            limit: clampLimit(limit),
            allowedDocumentIds
          }),
          signal: AbortSignal.timeout(requestTimeout)
        });
        if (!response?.ok) throw new Error("External vector retrieval rejected the request");
        const payload = await response.json();
        return {
          results: resolveResults(payload, allowedDocuments, clampLimit(limit)),
          provenance: { ...provenance, status: "used", backend: "external-vector" }
        };
      } catch {
        return { results: [], provenance: { ...provenance, status: "fallback", reason: "external-unavailable" } };
      }
    }
  };
}

function resolveResults(payload, docs, limit) {
  const allowed = new Map(docs.map((doc) => [String(doc?.id || ""), doc]));
  const candidates = Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : [];
  const seen = new Set();
  return candidates
    .map((candidate, index) => {
      const id = String(candidate?.id || "").trim();
      const source = allowed.get(id);
      if (!source || seen.has(id)) return null;
      seen.add(id);
      const doc = normalizeKnowledgeChunk(source);
      const score = Number(candidate?.score);
      const reason = cleanReason(candidate?.reason || candidate?.reasons?.[0]);
      return {
        ...doc,
        score: Number.isFinite(score) ? score : Number((1 / (index + 1)).toFixed(6)),
        matchReasons: ["external-vector rank", ...(reason ? [reason] : [])],
        excerpt: doc.summary || doc.text || doc.content.slice(0, 240)
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, limit);
}

function normalizeEndpoint(value) {
  const candidate = String(value || "").trim();
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function cleanReason(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function clampLimit(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(MAX_RESULTS, Math.floor(parsed))) : 5;
}

function clampTimeout(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(500, Math.min(10000, Math.floor(parsed))) : 3000;
}
