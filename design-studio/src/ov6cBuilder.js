const MAX_EVENTS = 240;

export function buildOv6cModel({ ooda, scenario } = {}) {
  const oodaNodes = flattenOoda(ooda);
  const oodaById = new Map(oodaNodes.map((node) => [node.id, node]));
  const entities = Array.isArray(scenario?.entities) ? scenario.entities : [];
  const timeline = Array.isArray(scenario?.timeline) ? scenario.timeline.slice(0, MAX_EVENTS) : [];
  const referencedNodeIds = new Set();
  const orphanTimelineIds = [];
  const events = timeline.map((entry, index) => {
    const sourceNodeId = clean(entry?.sourceNodeId, 160);
    const sourceNode = oodaById.get(sourceNodeId);
    if (sourceNodeId) referencedNodeIds.add(sourceNodeId);
    if (sourceNodeId && !sourceNode) orphanTimelineIds.push(clean(entry?.id, 180) || `timeline-${index + 1}`);
    return {
      id: `ov6c-${stableId(`${entry?.id || index}:${sourceNodeId}`)}`,
      sequence: index + 1,
      time: clean(entry?.time, 120) || "Unscheduled",
      offsetMinutes: parseOffset(entry?.time),
      title: clean(entry?.title, 240) || `Event ${index + 1}`,
      description: clean(entry?.description, 800),
      sourceNodeId,
      sourceActivityId: clean(sourceNode?.sourceActivityId, 160),
      phase: clean(sourceNode?.laneSubtitle || sourceNode?.laneTitle, 160),
      entityCount: entities.filter((entity) => String(entity?.sourceActivityId || "") === String(sourceNode?.sourceActivityId || "")).length,
      state: sourceNode ? "ready" : sourceNodeId ? "review" : "pending"
    };
  });

  const unscheduledNodeIds = oodaNodes.filter((node) => !referencedNodeIds.has(node.id)).map((node) => node.id);
  unscheduledNodeIds.forEach((nodeId, index) => {
    const node = oodaById.get(nodeId);
    events.push({
      id: `ov6c-unscheduled-${stableId(nodeId)}`,
      sequence: timeline.length + index + 1,
      time: "Unscheduled",
      offsetMinutes: null,
      title: clean(node?.title, 240) || nodeId,
      description: clean(node?.text || node?.description, 800),
      sourceNodeId: nodeId,
      sourceActivityId: clean(node?.sourceActivityId, 160),
      phase: clean(node?.laneSubtitle || node?.laneTitle, 160),
      entityCount: entities.filter((entity) => String(entity?.sourceActivityId || "") === String(node?.sourceActivityId || "")).length,
      state: "pending"
    });
  });

  const outOfOrderIds = events.slice(0, timeline.length).reduce((ids, event, index, list) => {
    if (index && event.offsetMinutes !== null && list[index - 1].offsetMinutes !== null && event.offsetMinutes < list[index - 1].offsetMinutes) ids.push(event.id);
    return ids;
  }, []);
  const outOfOrderSet = new Set(outOfOrderIds);
  events.forEach((event) => {
    event.outOfOrder = outOfOrderSet.has(event.id);
    event.reviewReasons = [
      event.state === "review" ? "来源 OODA 节点不存在" : "",
      event.state === "pending" ? "尚未映射至想定时间线" : "",
      event.outOfOrder ? "抽象时间早于前一事件" : ""
    ].filter(Boolean);
  });
  const diagnostics = [
    check("timeline-events", "事件序列", timeline.length ? "ready" : "pending", timeline.length ? `已从想定时间线推导 ${timeline.length} 个研究事件。` : oodaNodes.length ? "当前仅显示未排程的 OODA 节点，尚未生成想定时间线。" : "尚未生成想定时间线。"),
    check("ooda-schedule", "OODA 时序映射", unscheduledNodeIds.length ? "review" : oodaNodes.length ? "ready" : "pending", unscheduledNodeIds.length ? `${unscheduledNodeIds.length} 个 OODA 节点尚未映射至想定时间线。` : oodaNodes.length ? "全部 OODA 节点均有时间线映射。" : "尚未定义 OODA 节点。"),
    check("timeline-source", "时间线来源", orphanTimelineIds.length ? "review" : timeline.length ? "ready" : "pending", orphanTimelineIds.length ? `${orphanTimelineIds.length} 个时间线事件引用了不存在的 OODA 节点。` : timeline.length ? "全部时间线事件均可追溯至 OODA 节点或被明确标记为待映射。" : "尚未生成时间线。"),
    check("timeline-order", "时间顺序", outOfOrderIds.length ? "review" : timeline.length ? "ready" : "pending", outOfOrderIds.length ? `${outOfOrderIds.length} 个事件的抽象时间偏移早于前一事件。` : timeline.length ? "已检查可解析的抽象时间偏移顺序。" : "尚未生成时间线。")
  ];
  return {
    version: 1,
    kind: "derived-ov6c-event-trace",
    generatedAt: new Date().toISOString(),
    source: { oodaNodeCount: oodaNodes.length, timelineEventCount: timeline.length, scenarioEntityCount: entities.length, deploymentReturnAccepted: Boolean(scenario?.deploymentReview?.exchangeId && scenario?.deploymentReview?.changeId) },
    events,
    diagnostics,
    unresolved: { unscheduledNodeIds, orphanTimelineIds, outOfOrderIds }
  };
}

function flattenOoda(ooda) {
  return (Array.isArray(ooda?.lanes) ? ooda.lanes : []).flatMap((lane) => (lane.nodes || []).map((node) => ({ ...node, laneTitle: lane.title, laneSubtitle: lane.subtitle })));
}

function parseOffset(value) {
  const match = String(value || "").match(/^T\+(\d+)$/i);
  return match ? Number(match[1]) : null;
}

function check(id, label, state, detail) {
  return { id, label, state, statusLabel: ({ ready: "已满足", review: "需复核", pending: "未完成" })[state], detail };
}

function clean(value, limit) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit); }
function stableId(value) { let hash = 5381; for (const character of String(value)) hash = ((hash << 5) + hash) ^ character.charCodeAt(0); return (hash >>> 0).toString(36); }
