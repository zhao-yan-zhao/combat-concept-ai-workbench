const SENSITIVE_MARKERS = new Set(["true", "yes", "high", "sensitive", "restricted", "confidential", "secret", "sensitive-content", "敏感", "受限", "机密"]);

export function describeKnowledgeSensitivity(value = {}) {
  const frontmatter = value?.frontmatter && typeof value.frontmatter === "object" ? value.frontmatter : {};
  const direct = value?.sensitivity ?? value?.sensitive;
  const frontmatterValue = frontmatter.sensitivity ?? frontmatter.sensitive ?? frontmatter.classification ?? frontmatter.classify;
  const tags = Array.isArray(value?.tags) ? value.tags : [];
  const marked = isSensitiveValue(direct) || isSensitiveValue(frontmatterValue) || tags.some(isSensitiveValue);
  return {
    marked,
    level: marked ? "sensitive" : "standard",
    source: marked ? sensitivitySource(direct, frontmatterValue, tags) : ""
  };
}

export function isSensitiveKnowledge(value) {
  return Boolean(value?.sensitivity?.marked) || describeKnowledgeSensitivity(value).marked;
}

export function filterKnowledgeDocuments(docs, { includeSensitive = false } = {}) {
  const all = Array.isArray(docs) ? docs : [];
  const excluded = includeSensitive ? [] : all.filter(isSensitiveKnowledge);
  return {
    docs: includeSensitive ? all : all.filter((item) => !isSensitiveKnowledge(item)),
    excludedCount: excluded.length,
    sensitiveCount: all.filter(isSensitiveKnowledge).length,
    includeSensitive: Boolean(includeSensitive)
  };
}

function isSensitiveValue(value) {
  if (value === true) return true;
  if (Array.isArray(value)) return value.some(isSensitiveValue);
  return SENSITIVE_MARKERS.has(String(value || "").trim().toLowerCase());
}

function sensitivitySource(direct, frontmatter, tags) {
  if (isSensitiveValue(direct)) return "document";
  if (isSensitiveValue(frontmatter)) return "frontmatter";
  if (tags.some(isSensitiveValue)) return "tag";
  return "";
}
