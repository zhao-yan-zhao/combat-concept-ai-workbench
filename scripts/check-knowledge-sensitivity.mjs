import { normalizeKnowledgeVault } from "../server/projectKnowledgeNormalizers.mjs";
import { searchProjectKnowledge } from "../server/projectKnowledgeRetrieval.mjs";
import { selectEvidenceForAi } from "../design-studio/src/evidenceSelectionStore.js";
import { buildReportPayload } from "../design-studio/src/reportBuilder.js";
import { buildObsidianArchive } from "../design-studio/src/obsidianArchiveBuilder.js";
import { parseMarkdownFile } from "../shared/knowledge.js";
import { canReviewSensitiveKnowledge, requireSensitiveKnowledgeReview } from "../server/knowledgeSensitivityAccess.mjs";

assert(!canReviewSensitiveKnowledge(null) && !canReviewSensitiveKnowledge({ id: "researcher", roles: ["researcher", "reviewer"] }) && canReviewSensitiveKnowledge({ id: "lead", roles: ["lead"] }), "Sensitive-review role policy was not restricted to leads");
let sensitiveAccessDenied = null;
try { requireSensitiveKnowledgeReview({ id: "researcher", roles: ["researcher"] }); } catch (error) { sensitiveAccessDenied = error; }
assert(sensitiveAccessDenied?.statusCode === 403, "Non-lead was not denied sensitive knowledge review");
requireSensitiveKnowledgeReview({ id: "lead", roles: ["researcher", "lead"] });

const vault = normalizeKnowledgeVault({
  docs: [
    {
      id: "public-evidence",
      title: "Public evidence",
      filePath: "vault/public.md",
      content: "Public research evidence for review.",
      summary: "Public evidence summary.",
      tags: ["research"],
      frontmatter: {}
    },
    {
      id: "sensitive-evidence",
      title: "Sensitive evidence",
      filePath: "vault/sensitive.md",
      content: "Sensitive research evidence must remain local.",
      summary: "Sensitive evidence summary.",
      tags: ["restricted"],
      frontmatter: { sensitive: true }
    }
  ]
});

assert(vault.summary.sensitiveChunkCount === 1 && vault.docs[1].sensitivity?.marked, "Vault normalization did not preserve the sensitive marker");

const importedSensitive = parseMarkdownFile({ name: "sensitive.md" }, "---\nsensitive: true\n---\n# Sensitive note\nLocal evidence.");
assert(importedSensitive[0].sensitivity?.marked, "Markdown frontmatter sensitive: true was not detected");

const defaultSearch = searchProjectKnowledge({ query: "evidence", docs: vault.docs, mode: "hybrid" });
assert(defaultSearch.results.map((item) => item.id).join(",") === "public-evidence" && defaultSearch.index.sensitiveExcludedCount === 1, "Default retrieval exposed sensitive evidence");

const localSearch = searchProjectKnowledge({ query: "evidence", docs: vault.docs, mode: "keyword", includeSensitive: true });
assert(localSearch.results.length === 2 && localSearch.index.includeSensitive, "Explicit local review did not include sensitive evidence");

const selection = await selectEvidenceForAi({ query: "evidence", knowledge: vault, knowledgeStorage: { mode: "local" }, limit: 4 });
assert(selection.items.map((item) => item.id).join(",") === "public-evidence" && selection.provenance.sensitiveExcludedCount === 1, "AI evidence selection exposed sensitive evidence or lost its audit count");

const payload = buildReportPayload({
  project: { title: "Sensitivity acceptance", brief: { objective: "Review", approach: "Evidence control", assumptions: "Local access", risk: "Disclosure" }, citations: [] },
  direction: "Evidence control",
  ov1: { nodes: [], edges: [] },
  ov5: { activities: [{ id: "activity-1", title: "Review evidence", type: "research", input: "", output: "", duration: "", text: "", refs: ["research"] }], edges: [] },
  ooda: { sourceActivityIds: [], lanes: [] },
  scenario: null,
  validationResult: null,
  knowledge: vault,
  deployment: { settings: {}, status: "not-configured" }
});

const exportedKnowledge = JSON.stringify(payload.knowledge);
assert(payload.knowledge.sensitiveExcludedCount === 1 && exportedKnowledge.includes("Public evidence") && !exportedKnowledge.includes("Sensitive evidence"), "Report citations exposed sensitive evidence");
const archive = buildObsidianArchive(payload);
assert(!JSON.stringify(archive.files).includes("Sensitive evidence"), "Obsidian archive set exposed sensitive evidence");

console.log(`Knowledge sensitivity acceptance passed: ${defaultSearch.results.length} default result, ${localSearch.results.length} local-review results, ${payload.knowledge.sensitiveExcludedCount} excluded.`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
