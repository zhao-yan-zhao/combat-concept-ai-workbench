import { isSensitiveKnowledge } from "./projectKnowledgeSensitivity.mjs";

const REPORT_CITATION_SCOPE = "report-citation";
const MAX_REASON_LENGTH = 600;

export function createSensitiveCitationApproval({ input = {}, docs = [], actor, now = () => new Date().toISOString(), revision = 0 } = {}) {
  const documentId = cleanId(input.documentId);
  const document = (Array.isArray(docs) ? docs : []).find((item) => item.id === documentId);
  if (!document || !isSensitiveKnowledge(document)) throw new Error("Sensitive citation approval requires an existing marked knowledge fragment");
  const reason = cleanText(input.reason, MAX_REASON_LENGTH);
  if (!reason) throw new Error("Sensitive citation approval reason is required");
  const approvedAt = now();
  const expiresAt = normalizeExpiry(input.expiresAt, approvedAt);
  return {
    id: `sensitive-citation-${revision}-${stableId(`${documentId}:${approvedAt}`)}`,
    documentId,
    scope: REPORT_CITATION_SCOPE,
    reason,
    approvedAt,
    expiresAt,
    approvedBy: publicActor(actor)
  };
}

export function revokeSensitiveCitationApproval(approval, { input = {}, actor, now = () => new Date().toISOString() } = {}) {
  if (!approval?.id) throw new Error("Sensitive citation approval was not found");
  const reason = cleanText(input.reason, MAX_REASON_LENGTH);
  if (!reason) throw new Error("Sensitive citation revocation reason is required");
  return { ...approval, revokedAt: now(), revokedBy: publicActor(actor), revocationReason: reason };
}

export function normalizeSensitiveCitationApprovals(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => ({
      id: cleanId(item?.id),
      documentId: cleanId(item?.documentId),
      scope: item?.scope === REPORT_CITATION_SCOPE ? REPORT_CITATION_SCOPE : "",
      reason: cleanText(item?.reason, MAX_REASON_LENGTH),
      approvedAt: cleanText(item?.approvedAt, 80),
      expiresAt: cleanText(item?.expiresAt, 80),
      approvedBy: publicActor(item?.approvedBy),
      revokedAt: cleanText(item?.revokedAt, 80),
      revokedBy: item?.revokedBy ? publicActor(item.revokedBy) : null,
      revocationReason: cleanText(item?.revocationReason, MAX_REASON_LENGTH)
    }))
    .filter((item) => item.id && item.documentId && item.scope && item.reason && item.approvedAt)
    .slice(0, 160);
}

export function isSensitiveCitationApproved(documentId, approvals, now = new Date().toISOString()) {
  const timestamp = Date.parse(now);
  return normalizeSensitiveCitationApprovals(approvals).some((item) => item.documentId === String(documentId || "")
    && item.scope === REPORT_CITATION_SCOPE
    && !item.revokedAt
    && (!item.expiresAt || Number.isNaN(timestamp) || Date.parse(item.expiresAt) >= timestamp));
}

export function filterKnowledgeForReportCitation(docs, approvals, now) {
  const all = Array.isArray(docs) ? docs : [];
  const timestamp = now || new Date().toISOString();
  const normalizedApprovals = normalizeSensitiveCitationApprovals(approvals);
  const includedSensitiveIds = new Set(all.filter((item) => isSensitiveKnowledge(item) && isSensitiveCitationApproved(item.id, normalizedApprovals, timestamp)).map((item) => item.id));
  const approvedCitations = normalizedApprovals
    .filter((item) => includedSensitiveIds.has(item.documentId) && isSensitiveCitationApproved(item.documentId, [item], timestamp))
    .map((item) => ({ id: item.id, documentId: item.documentId, approvedAt: item.approvedAt, expiresAt: item.expiresAt, approvedBy: { id: item.approvedBy?.id || "", label: item.approvedBy?.label || item.approvedBy?.id || "" } }));
  return {
    docs: all.filter((item) => !isSensitiveKnowledge(item) || includedSensitiveIds.has(item.id)),
    sensitiveExcludedCount: all.filter((item) => isSensitiveKnowledge(item) && !includedSensitiveIds.has(item.id)).length,
    sensitiveCitationApprovalCount: approvedCitations.length,
    approvedCitations,
    policy: "explicit-active-report-citation-v1"
  };
}

function publicActor(actor) {
  return {
    id: cleanText(actor?.id, 80),
    label: cleanText(actor?.label || actor?.id, 120),
    roles: [...new Set((Array.isArray(actor?.roles) ? actor.roles : []).map(String).filter((role) => ["researcher", "reviewer", "lead"].includes(role)))].slice(0, 3)
  };
}

function normalizeExpiry(value, approvedAt) {
  const text = cleanText(value, 80);
  if (!text) return "";
  const expiry = Date.parse(text);
  if (Number.isNaN(expiry) || expiry <= Date.parse(approvedAt)) throw new Error("Sensitive citation approval expiry must be after approval time");
  return new Date(expiry).toISOString();
}

function cleanId(value) { return String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 180); }
function cleanText(value, maximum) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum); }
function stableId(value) { let hash = 2166136261; for (const character of String(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); }
