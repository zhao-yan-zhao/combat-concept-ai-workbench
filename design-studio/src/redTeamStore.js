import { persistValidation } from "./validationStore.js";

export function createLocalRedTeamReview(validationResult, evidence = []) {
  const findings = (validationResult.issues || []).slice(0, 3).map((issue, index) => ({
    id: `local-red-${index + 1}`,
    title: issue.title,
    severity: issue.level === "high" ? "high" : "medium",
    analysis: `对手可能利用“${issue.title}”对应的薄弱环节扩大信息不确定性或延长决策周期。`,
    recommendation: issue.text,
    evidenceRefs: evidence.slice(0, 2).map((item) => item.title),
    targetElement: {
      type: issue.sourceId ? "rule" : "activity",
      id: issue.sourceId || `act-inferred-${index + 1}`,
      name: issue.sourceId ? `规则检测: ${issue.title}` : `作战活动工序: ${issue.title}`
    },
    status: "pending",
    rejectionRationale: "",
    disposedAt: null
  }));

  if (!findings.length) {
    findings.push({
      id: "local-red-1",
      title: "关键依赖需专家复核",
      severity: "medium",
      analysis: "当前规则检查未发现阻断项，但关键输入和决策节点仍需在对抗条件下复核。",
      recommendation: "补充替代信息来源和关键节点的人工审阅记录。",
      evidenceRefs: evidence.slice(0, 2).map((item) => item.title),
      targetElement: {
        type: "general",
        id: "sys-core",
        name: "作战概念整体闭环网络"
      },
      status: "pending",
      rejectionRationale: "",
      disposedAt: null
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

export function updateFindingDisposition(validationResult, findingId, { status, rejectionRationale = "" } = {}) {
  if (!validationResult?.redTeamReview) {
    throw new Error("当前验证结果中不存在红方审阅报告");
  }
  const validStatuses = ["pending", "accepted", "rejected", "revised"];
  if (!validStatuses.includes(status)) {
    throw new Error(`无效的红方意见处置状态: ${status}，允许值 [${validStatuses.join(", ")}]`);
  }
  if (status === "rejected" && !String(rejectionRationale || "").trim()) {
    throw new Error("驳回红方意见时必须填写驳回理由");
  }

  const findings = validationResult.redTeamReview.findings || [];
  const target = findings.find((item) => item.id === findingId);
  if (!target) {
    throw new Error(`未找到 ID 为 [${findingId}] 的红方审阅意见`);
  }

  target.status = status;
  target.rejectionRationale = status === "rejected" ? String(rejectionRationale).trim().slice(0, 500) : "";
  target.disposedAt = status === "pending" ? null : new Date().toISOString();

  persistValidation(validationResult);
  return validationResult;
}

export function updateFindingTargetElement(validationResult, findingId, targetElement = {}) {
  if (!validationResult?.redTeamReview) {
    throw new Error("当前验证结果中不存在红方审阅报告");
  }
  const findings = validationResult.redTeamReview.findings || [];
  const target = findings.find((item) => item.id === findingId);
  if (!target) {
    throw new Error(`未找到 ID 为 [${findingId}] 的红方审阅意见`);
  }

  target.targetElement = normalizeTargetElement(targetElement, target.title, target.analysis);
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
    findings: Array.isArray(review.findings) ? review.findings.slice(0, 10).map((item, index) => ({
      id: String(item.id || `red-${index + 1}`),
      title: String(item.title || "待复核问题"),
      severity: ["high", "medium", "low"].includes(item.severity) ? item.severity : "medium",
      analysis: String(item.analysis || "未提供分析。"),
      recommendation: String(item.recommendation || "建议由专家复核。"),
      evidenceRefs: Array.isArray(item.evidenceRefs) ? item.evidenceRefs.map(String).slice(0, 4) : [],
      targetElement: normalizeTargetElement(item.targetElement, item.title, item.analysis),
      status: ["pending", "accepted", "rejected", "revised"].includes(item.status) ? item.status : "pending",
      rejectionRationale: String(item.rejectionRationale || "").slice(0, 500),
      disposedAt: item.disposedAt ? String(item.disposedAt) : null
    })) : []
  };
}

function normalizeTargetElement(raw, title = "", analysis = "") {
  if (raw && typeof raw === "object") {
    const type = ["activity", "phase", "force", "task", "node", "rule", "general"].includes(raw.type)
      ? raw.type
      : "activity";
    return {
      type,
      id: String(raw.id || "elem-target"),
      name: String(raw.name || raw.label || raw.title || "关键作战要素").slice(0, 100)
    };
  }
  // 启发式关联默认要素
  const combined = `${title} ${analysis}`;
  if (combined.includes("阶段") || combined.includes("时序")) {
    return { type: "phase", id: "phase-inferred", name: "作战实施阶段与时序" };
  }
  if (combined.includes("兵力") || combined.includes("编成") || combined.includes("装备")) {
    return { type: "force", id: "force-inferred", name: "任务编组与兵力分配" };
  }
  if (combined.includes("总体图") || combined.includes("协同") || combined.includes("节点")) {
    return { type: "node", id: "node-inferred", name: "OV-1 总体协同节点" };
  }
  return { type: "activity", id: "act-inferred", name: "制胜机理与关键作战活动" };
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
