const MAX_EXCHANGES = 180;

export function buildOv3Model({ ov5, scenario } = {}) {
  const activities = Array.isArray(ov5?.activities) ? ov5.activities : [];
  const edges = Array.isArray(ov5?.edges) ? ov5.edges.slice(0, MAX_EXCHANGES) : [];
  const entities = Array.isArray(scenario?.entities) ? scenario.entities : [];
  const activityById = new Map(activities.map((activity) => [String(activity.id), activity]));
  const unresolvedEdgeIds = [];
  const exchanges = edges.flatMap((edge, index) => {
    const source = activityById.get(String(edge.sourceId));
    const target = activityById.get(String(edge.targetId));
    if (!source || !target) {
      unresolvedEdgeIds.push(String(edge.id || `edge-${index + 1}`));
      return [];
    }
    const output = clean(source.output, 320);
    const input = clean(target.input, 320);
    return [{
      id: `ov3-${stableId(`${source.id}:${target.id}:${edge.type || ""}`)}`,
      sourceActivityId: String(source.id),
      sourceActivityTitle: clean(source.title, 240) || String(source.id),
      targetActivityId: String(target.id),
      targetActivityTitle: clean(target.title, 240) || String(target.id),
      exchangeType: classify(edge.type),
      edgeType: clean(edge.type, 120) || "信息流",
      output,
      input,
      compatibility: compatibility(output, input),
      scenarioEntityCount: entities.filter((entity) => [String(source.id), String(target.id)].includes(String(entity.sourceActivityId))).length
    }];
  });
  const missingContractCount = exchanges.filter((exchange) => exchange.compatibility === "pending").length;
  const mismatchCount = exchanges.filter((exchange) => exchange.compatibility === "review").length;
  const diagnostics = [
    check("exchange-edges", "交换关系", unresolvedEdgeIds.length ? "review" : exchanges.length ? "ready" : "pending", unresolvedEdgeIds.length ? `${unresolvedEdgeIds.length} 条 OV-5 边无法解析源或目标活动` : exchanges.length ? `已从 OV-5 推导 ${exchanges.length} 条交换` : "尚未定义 OV-5 活动关系"),
    check("contract-definition", "输入输出定义", missingContractCount ? "review" : exchanges.length ? "ready" : "pending", missingContractCount ? `${missingContractCount} 条交换缺少源输出或目标输入` : exchanges.length ? "全部交换均有源输出和目标输入" : "等待活动关系"),
    check("contract-compatibility", "字段匹配", mismatchCount ? "review" : exchanges.length ? "ready" : "pending", mismatchCount ? `${mismatchCount} 条交换的源输出与目标输入文本不同，需人工确认映射` : exchanges.length ? "源输出与目标输入已直接匹配" : "等待活动关系")
  ];
  return {
    version: 1,
    kind: "derived-ov3-resource-exchange",
    generatedAt: new Date().toISOString(),
    source: { ov5ActivityCount: activities.length, ov5EdgeCount: edges.length, scenarioEntityCount: entities.length },
    activities: activities.map((activity) => ({ id: String(activity.id), title: clean(activity.title, 240) || String(activity.id) })),
    exchanges,
    diagnostics,
    unresolved: { unresolvedEdgeIds, missingContractCount, mismatchCount }
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
    .replace(/[，,；;、/|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensOf(value) {
  const stop = new Set(["的", "与", "和", "及", "或", "等", "后", "前", "对", "在", "为", "and", "or", "the", "a", "an", "to", "of"]);
  return String(value || "")
    .split(/[\s,，、；;:/|]+/)
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
