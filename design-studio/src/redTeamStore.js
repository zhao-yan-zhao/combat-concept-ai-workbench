import { persistValidation } from "./validationStore.js";

export function createLocalRedTeamReview(validationResult, evidence = []) {
  const findings = (validationResult.issues || []).slice(0, 3).map((issue, index) => ({
    id: `local-red-${index + 1}`,
    title: issue.title,
    severity: issue.level === "high" ? "high" : "medium",
    analysis: `对手可能利用“${issue.title}”对应的薄弱环节扩大信息不确定性或延长决策周期。`,
    recommendation: issue.text,
    evidenceRefs: evidence.slice(0, 2).map((item) => item.title)
  }));

  if (!findings.length) {
    findings.push({
      id: "local-red-1",
      title: "关键依赖需专家复核",
      severity: "medium",
      analysis: "当前规则检查未发现阻断项，但关键输入和决策节点仍需在对抗条件下复核。",
      recommendation: "补充替代信息来源和关键节点的人工审阅记录。",
      evidenceRefs: evidence.slice(0, 2).map((item) => item.title)
    });
  }

  return {
    mode: "fallback",
    provider: "local-rules",
    generatedAt: new Date().toISOString(),
    summary: "本地规则质询已基于当前验证问题生成，待模型服务可用后可重新生成 AI 评估。",
    findings
  };
}

export function applyRedTeamReview(validationResult, review) {
  validationResult.redTeamReview = normalizeReview(review);
  persistValidation(validationResult);
  return validationResult;
}

export function clearRedTeamReview(validationResult) {
  if (!validationResult?.redTeamReview) return validationResult;
  validationResult.redTeamReview = null;
  persistValidation(validationResult);
  return validationResult;
}

function normalizeReview(review) {
  return {
    mode: review.mode === "ai" ? "ai" : "fallback",
    provider: String(review.provider || "local-rules"),
    model: String(review.model || ""),
    generatedAt: review.generatedAt || new Date().toISOString(),
    evidenceSelection: normalizeEvidenceSelection(review.evidenceSelection),
    summary: String(review.summary || "未生成红方质询摘要。"),
    findings: Array.isArray(review.findings) ? review.findings.slice(0, 5).map((item, index) => ({
      id: String(item.id || `red-${index + 1}`),
      title: String(item.title || "待复核问题"),
      severity: ["high", "medium", "low"].includes(item.severity) ? item.severity : "medium",
      analysis: String(item.analysis || "未提供分析。"),
      recommendation: String(item.recommendation || "建议由专家复核。"),
      evidenceRefs: Array.isArray(item.evidenceRefs) ? item.evidenceRefs.map(String).slice(0, 4) : []
    })) : []
  };
}

function normalizeEvidenceSelection(value) {
  if (!value || typeof value !== "object") return null;
  return {
    source: value.source === "server" ? "server" : "local",
    indexMode: String(value.indexMode || "keyword").slice(0, 40),
    count: Math.max(0, Math.min(8, Number(value.count) || 0)),
    fallback: Boolean(value.fallback),
    sensitiveExcludedCount: Math.max(0, Number(value.sensitiveExcludedCount) || 0),
    projectRevision: Math.max(0, Number(value.projectRevision) || 0),
    resourceRevision: Math.max(0, Number(value.resourceRevision) || 0),
    selectedAt: String(value.selectedAt || "").slice(0, 80)
  };
}
