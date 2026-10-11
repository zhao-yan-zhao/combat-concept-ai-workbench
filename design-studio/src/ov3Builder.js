const MAX_EXCHANGES = 180;

export function buildOv3Model({ ov2, ov5, scenario } = {}) {
  const sourceModel = resolveOv2ProjectionSource(ov2, ov5);
  const nodes = Array.isArray(sourceModel.nodes) ? sourceModel.nodes : [];
  const sourceExchanges = Array.isArray(sourceModel.exchanges) ? sourceModel.exchanges.slice(0, MAX_EXCHANGES) : [];
  const entities = Array.isArray(scenario?.entities) ? scenario.entities : [];
  const nodeById = new Map(nodes.map((node) => [String(node.id), node]));
  const unresolvedEdgeIds = [];
  const exchanges = sourceExchanges.flatMap((exchange, index) => {
    const source = nodeById.get(String(exchange.sourceNodeId));
    const target = nodeById.get(String(exchange.targetNodeId));
    if (!source || !target) {
      unresolvedEdgeIds.push(String(exchange.id || `ov2-exchange-${index + 1}`));
      return [];
    }
    const output = clean(exchange.output, 320);
    const input = clean(exchange.input, 320);
    return [{
      id: String(exchange.id || `ov2-exchange-${index + 1}`),
      sourceExchangeRef: String(exchange.id || `ov2-exchange-${index + 1}`),
      sourceNodeId: String(source.id),
      targetNodeId: String(target.id),
      sourceActivityId: String(source.id),
      sourceActivityTitle: clean(source.label || source.title, 240) || String(source.id),
      targetActivityId: String(target.id),
      targetActivityTitle: clean(target.label || target.title, 240) || String(target.id),
      exchangeType: classify(exchange.flowType),
      edgeType: clean(exchange.flowType, 120) || "信息流",
      output,
      input,
      compatibility: compatibility(output, input),
      scenarioEntityCount: entities.filter((entity) => [String(source.id), String(target.id)].includes(String(entity.sourceActivityId || entity.forceRef))).length
    }];
  });
  const missingContractCount = exchanges.filter((exchange) => exchange.compatibility === "pending").length;
  const mismatchCount = exchanges.filter((exchange) => exchange.compatibility === "review").length;
  const diagnostics = [
    check("exchange-source", "OV-2 投影来源", unresolvedEdgeIds.length ? "review" : exchanges.length ? "ready" : "pending", unresolvedEdgeIds.length ? `${unresolvedEdgeIds.length} 条 OV-2 交换无法解析源或目标节点` : exchanges.length ? `已投影 ${exchanges.length} 条 OV-2 资源交换` : "尚无可投影的 OV-2 交换"),
    check("contract-definition", "输入输出定义", missingContractCount ? "review" : exchanges.length ? "ready" : "pending", missingContractCount ? `${missingContractCount} 条交换缺少源输出或目标输入` : exchanges.length ? "全部交换均有源输出和目标输入" : "等待活动关系"),
    check("contract-compatibility", "字段匹配", mismatchCount ? "review" : exchanges.length ? "ready" : "pending", mismatchCount ? `${mismatchCount} 条交换的源输出与目标输入文本不同，需人工确认映射` : exchanges.length ? "源输出与目标输入已直接匹配" : "等待活动关系")
  ];
  return {
    version: 2,
    kind: "derived-ov3-ov2-projection",
    generatedAt: new Date().toISOString(),
    source: { ov2NodeCount: nodes.length, ov2ExchangeCount: sourceExchanges.length, scenarioEntityCount: entities.length, mode: sourceModel.mode },
    activities: nodes.map((node) => ({ id: String(node.id), title: clean(node.label || node.title, 240) || String(node.id) })),
    exchanges,
    diagnostics,
    unresolved: { unresolvedEdgeIds, missingContractCount, mismatchCount }
  };
}

function resolveOv2ProjectionSource(ov2, ov5) {
  if (ov2 && Array.isArray(ov2.nodes) && Array.isArray(ov2.exchanges)) {
    return { ...ov2, mode: "ov2" };
  }
  const activities = Array.isArray(ov5?.activities) ? ov5.activities : [];
  const edges = Array.isArray(ov5?.edges) ? ov5.edges : [];
  const activityById = new Map(activities.map((activity) => [String(activity.id), activity]));
  return {
    mode: "legacy-ov5-compatibility",
    nodes: activities.map((activity) => ({ id: String(activity.id), label: clean(activity.title, 240) || String(activity.id) })),
    exchanges: edges.map((edge, index) => {
      const source = activityById.get(String(edge.sourceId));
      const target = activityById.get(String(edge.targetId));
      return {
        id: `legacy-ov2-${stableId(`${edge.id || index}:${edge.sourceId}:${edge.targetId}`)}`,
        sourceNodeId: String(edge.sourceId || ""),
        targetNodeId: String(edge.targetId || ""),
        sourceNodeLabel: clean(source?.title, 240),
        targetNodeLabel: clean(target?.title, 240),
        flowType: edge.type || "information",
        label: clean(source?.output || edge.type, 320),
        output: clean(source?.output, 320),
        input: clean(target?.input, 320)
      };
    })
  };
}

function classify(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("resource") || normalized.includes("资源")) return "resource";
  if (normalized.includes("control") || normalized.includes("控制")) return "control";
  return "information";
}

function compatibility(output, input) {
  if (!output || !input) return "pending";
  const left = normalizeContract(output);
  const right = normalizeContract(input);
  if (!left || !right) return "pending";
  if (left === right || left.includes(right) || right.includes(left)) return "ready";
  const leftTokens = tokensOf(left);
  const rightTokens = tokensOf(right);
  if (!leftTokens.length || !rightTokens.length) return "review";
  const shared = leftTokens.filter((token) => rightTokens.includes(token));
  // Soft match: shared content tokens mean the edge is likely the same resource stream.
  if (shared.length >= 1 && (shared.length / Math.min(leftTokens.length, rightTokens.length)) >= 0.34) return "ready";
  return "review";
}

function normalizeContract(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[，,；;、/|：:（）()【】[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensOf(value) {
  const stop = new Set(["的", "与", "和", "及", "或", "等", "后", "前", "对", "在", "为", "输出", "接收", "输入", "and", "or", "the", "a", "an", "to", "of"]);
  return String(value || "")
    .split(/[\s,，、；;:/|：:（）()【】[\]]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !stop.has(token));
}

function check(id, label, state, detail) {
  return { id, label, state, statusLabel: ({ ready: "已满足", review: "需复核", pending: "未完成" })[state], detail };
}

function clean(value, limit) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function stableId(value) {
  let hash = 5381;
  for (const character of String(value)) hash = ((hash << 5) + hash) ^ character.charCodeAt(0);
  return (hash >>> 0).toString(36);
}
