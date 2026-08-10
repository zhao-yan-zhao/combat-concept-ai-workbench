import { renderKnowledgeEvidence } from "../design-studio/src/knowledgeView.js";

const vault = {
  docs: [{ id: "standard", title: "Standard", content: "Standard", summary: "Standard", tags: [], sensitivity: { marked: false } }, { id: "restricted", title: "Restricted", content: "Restricted", summary: "Restricted", tags: [], sensitivity: { marked: true } }],
  summary: { name: "Vault", fileCount: 2, chunkCount: 2, tableCount: 0, parameterRowCount: 0, sensitiveChunkCount: 1 }
};
const lead = renderKnowledgeEvidence(vault, null, "", [], { actor: { id: "lead", roles: ["lead"] }, citationApprovals: [{ id: "approval-1", documentId: "restricted" }] });
const researcher = renderKnowledgeEvidence(vault, null, "", [], { actor: { id: "researcher", roles: ["researcher"] }, citationApprovals: [{ id: "approval-1", documentId: "restricted" }] });
assert(lead.includes("敏感片段报告引用") && lead.includes("sensitiveCitationApprovalForm") && lead.includes("data-revoke-sensitive-citation"), "Lead citation policy controls were not rendered");
assert(!researcher.includes("敏感片段报告引用") && !researcher.includes("sensitiveCitationApprovalForm"), "Non-lead received sensitive citation controls");
console.log("Sensitive citation view acceptance passed: lead-only controls rendered.");

function assert(condition, message) { if (!condition) throw new Error(message); }
