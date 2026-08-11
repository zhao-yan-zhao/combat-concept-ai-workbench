import { buildQuantitativeComparison } from "./schemeScoring.js";

export function compareModelSnapshots(baseline, candidate, settings = {}) {
  if (!baseline?.model || !candidate?.model) return null;
  const before = baseline.model;
  const after = candidate.model;
  const briefChanges = compareBrief(before.brief, after.brief);
  const metrics = [
    metric("灵感会话", inspirationMessageCount(before), inspirationMessageCount(after)),
    metric("人工部署回传", deploymentReturnCount(before), deploymentReturnCount(after)),
    metric("简报修订", 0, briefChanges.length),
    metric("高层概念图节点", before.ov1?.nodes.length || 0, after.ov1?.nodes.length || 0),
    metric("高层概念图关系", before.ov1?.edges.length || 0, after.ov1?.edges.length || 0),
    metric("作战活动", before.ov5?.activities.length || 0, after.ov5?.activities.length || 0),
    metric("活动关联", before.ov5?.edges.length || 0, after.ov5?.edges.length || 0),
    metric("OODA 节点", countOodaNodes(before), countOodaNodes(after)),
    metric("OODA 周期", Number(before.ooda?.durationMinutes || 0), Number(after.ooda?.durationMinutes || 0), "分钟"),
    metric("想定实体", before.scenario?.entities?.length || 0, after.scenario?.entities?.length || 0),
    metric("验证平均分", averageScore(before.validation), averageScore(after.validation), "分"),
    metric("验证问题", before.validation?.issues?.length || 0, after.validation?.issues?.length || 0)
  ];
  const changes = [
    contextChange("灵感孵化轨迹", inspirationFingerprint(before), inspirationFingerprint(after)),
    contextChange("人工部署回传", deploymentReturnFingerprint(before), deploymentReturnFingerprint(after)),
    { label: "概念简报", added: [], removed: [], changed: briefChanges, unchanged: 4 - briefChanges.length },
    collectionChange("高层概念图节点", before.ov1?.nodes || [], after.ov1?.nodes || [], (item) => item.id, (item) => item.label || item.id),
    collectionChange("作战活动", before.ov5?.activities || [], after.ov5?.activities || [], (item) => item.id, (item) => item.title || item.id),
    collectionChange("OODA 节点", oodaNodes(before), oodaNodes(after), (item) => item.id, (item) => item.title || item.id),
    collectionChange("想定实体", before.scenario?.entities || [], after.scenario?.entities || [], (item) => item.id, (item) => item.label || item.id),
    collectionChange("验证问题", before.validation?.issues || [], after.validation?.issues || [], (item) => item.id || item.title, (item) => item.title || item.id)
  ];
  return {
    baseline: snapshotSummary(baseline),
    candidate: snapshotSummary(candidate),
    metrics,
    changes,
    summary: buildSummary(metrics, changes),
    quantitative: buildQuantitativeComparison(baseline, candidate, settings)
  };
}

function compareBrief(before = {}, after = {}) {
  const fields = [
    ["作战目标", "objective"],
    ["核心思路", "approach"],
    ["关键假设", "assumptions"],
    ["主要风险", "risk"]
  ];
  return fields.filter(([, key]) => String(before?.[key] || "") !== String(after?.[key] || "")).map(([label]) => label);
}

function metric(label, before, after, unit = "") {
  const delta = after - before;
  return { label, before, after, delta, unit, deltaLabel: delta === 0 ? "无变化" : `${delta > 0 ? "+" : ""}${delta}${unit}` };
}

function collectionChange(label, before, after, keyOf, labelOf) {
  const beforeById = new Map(before.map((item) => [keyOf(item), item]));
  const afterById = new Map(after.map((item) => [keyOf(item), item]));
  const added = after.filter((item) => !beforeById.has(keyOf(item))).map(labelOf).slice(0, 3);
  const removed = before.filter((item) => !afterById.has(keyOf(item))).map(labelOf).slice(0, 3);
  const changed = after.filter((item) => {
    const prior = beforeById.get(keyOf(item));
    return prior && fingerprint(prior) !== fingerprint(item);
  }).map(labelOf).slice(0, 3);
  return { label, added, removed, changed, unchanged: before.length - removed.length - changed.length };
}

function contextChange(label, before, after) {
  if (before === after) return { label, added: [], removed: [], changed: [], unchanged: 1 };
  if (!before) return { label, added: ["已记录"], removed: [], changed: [], unchanged: 0 };
  if (!after) return { label, added: [], removed: ["已移除"], changed: [], unchanged: 0 };
  return { label, added: [], removed: [], changed: ["已更新"], unchanged: 0 };
}

function inspirationMessageCount(model) {
  return Array.isArray(model?.inspiration?.messages) ? model.inspiration.messages.length : 0;
}

function deploymentReturnCount(model) {
  return model?.scenario?.deploymentReview?.exchangeId && model?.scenario?.deploymentReview?.changeId ? 1 : 0;
}

function inspirationFingerprint(model) {
  const inspiration = model?.inspiration;
  return inspiration?.messages?.length ? JSON.stringify({ summary: inspiration.summary || "", messages: inspiration.messages }) : "";
}

function deploymentReturnFingerprint(model) {
  const review = model?.scenario?.deploymentReview;
  return review?.exchangeId && review?.changeId
    ? JSON.stringify({ bridgeOrigin: review.bridgeOrigin || "", exchangeId: review.exchangeId, changeId: review.changeId, receivedAt: review.receivedAt || "" })
    : "";
}

function snapshotSummary(snapshot) {
  return { id: snapshot.id, label: snapshot.label, savedAt: snapshot.savedAt, direction: snapshot.direction };
}

function countOodaNodes(model) {
  return oodaNodes(model).length;
}

function oodaNodes(model) {
  return (model.ooda?.lanes || []).flatMap((lane) => lane.nodes || []);
}

function averageScore(validation) {
  const scores = validation?.scores || [];
  if (!scores.length) return 0;
  return Math.round(scores.reduce((sum, item) => sum + Number(item.score || 0), 0) / scores.length);
}

function fingerprint(value) {
  return JSON.stringify(value);
}

function buildSummary(metrics, changes) {
  const changedMetricCount = metrics.filter((item) => item.delta !== 0).length;
  const structureChangeCount = changes.reduce((sum, item) => sum + item.added.length + item.removed.length + item.changed.length, 0);
  if (!changedMetricCount && !structureChangeCount) return "两份模型的关键规模与受控字段一致。";
  return `关键指标变化 ${changedMetricCount} 项，结构变更 ${structureChangeCount} 项；请结合活动说明、知识依据和验证问题复核差异。`;
}
