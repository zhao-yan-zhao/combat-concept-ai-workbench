/**
 * OV-5 mapping quality helpers: fill empty I/O and parent hierarchy without
 * overwriting researcher-authored values.
 */

const PLACEHOLDER_RE = /^(待定义|待填写|待补充|待估算|tbd|todo|n\/a|na|-|—|？|\?)$/i;

/** Preferred operational-activity type order for shallow hierarchy suggestion. */
const TYPE_RANK = [
  { keys: ["感知", "监视", "侦察", "observe", "sense"], rank: 10 },
  { keys: ["识别", "判别", "identify"], rank: 20 },
  { keys: ["决策", "判定", "decide"], rank: 30 },
  { keys: ["行动", "协同", "act"], rank: 40 },
  { keys: ["控制", "边界", "control"], rank: 50 },
  { keys: ["评估", "效果", "assess"], rank: 60 }
];

/**
 * Only fills blank/placeholder input, output, and parentId.
 * Optionally aligns edge-adjacent I/O after OV-1 suggestions.
 */
export function applyMappingQuality(model = {}, ov1 = {}, options = {}) {
  const fillIoFromOv1 = options.fillIoFromOv1 !== false;
  const fillIoFromEdges = options.fillIoFromEdges !== false;
  const fillParents = options.fillParents !== false;
  const activities = Array.isArray(model.activities) ? model.activities.map((activity) => ({ ...activity })) : [];
  const edges = Array.isArray(model.edges) ? model.edges.map((edge) => ({ ...edge })) : [];
  const nodeById = new Map((Array.isArray(ov1?.nodes) ? ov1.nodes : []).map((node) => [String(node.id), node]));

  let ioFromOv1 = 0;
  let ioFromEdges = 0;
  let parentsSet = 0;

  if (fillIoFromOv1) {
    activities.forEach((activity) => {
      const suggestion = suggestIoFromOv1(activity, nodeById);
      if (suggestion.input && isBlankField(activity.input)) {
        activity.input = suggestion.input;
        ioFromOv1 += 1;
      }
      if (suggestion.output && isBlankField(activity.output)) {
        activity.output = suggestion.output;
        ioFromOv1 += 1;
      }
    });
  }

  if (fillIoFromEdges) {
    const byId = new Map(activities.map((activity) => [String(activity.id), activity]));
    edges.forEach((edge) => {
      const source = byId.get(String(edge.sourceId));
      const target = byId.get(String(edge.targetId));
      if (!source || !target) return;
      const payload = clean(edge.payload, 320);
      if (isBlankField(source.output)) {
        const next = clean(target.input, 320) || payload;
        if (next && !isBlankField(next)) {
          source.output = next;
          ioFromEdges += 1;
        }
      }
      if (isBlankField(target.input)) {
        const next = clean(source.output, 320) || payload;
        if (next && !isBlankField(next)) {
          target.input = next;
          ioFromEdges += 1;
        }
      }
    });
  }

  if (fillParents) {
    const suggestions = suggestParentsByType(activities);
    suggestions.forEach(({ activityId, parentId }) => {
      const activity = activities.find((item) => String(item.id) === String(activityId));
      if (!activity || clean(activity.parentId) || !parentId) return;
      if (!canAssignParent(activities, activityId, parentId)) return;
      activity.parentId = parentId;
      parentsSet += 1;
    });
  }

  return {
    model: { ...model, activities, edges },
    summary: {
      ioFromOv1,
      ioFromEdges,
      parentsSet,
      changed: ioFromOv1 + ioFromEdges + parentsSet > 0
    }
  };
}

export function inspectMappingQuality(model = {}, ov1 = {}) {
  const activities = Array.isArray(model.activities) ? model.activities : [];
  const edges = Array.isArray(model.edges) ? model.edges : [];
  const nodeIds = new Set((Array.isArray(ov1?.nodes) ? ov1.nodes : []).map((node) => String(node.id)));
  const blankIoIds = [];
  const weakIoIds = [];
  const unmappedIds = [];
  activities.forEach((activity) => {
    const id = String(activity.id);
    const blankIn = isBlankField(activity.input);
    const blankOut = isBlankField(activity.output);
    if (blankIn || blankOut) blankIoIds.push(id);
    else if (isWeakField(activity.input) || isWeakField(activity.output)) weakIoIds.push(id);
    const sources = unique(activity.sourceOv1NodeIds).filter((sourceId) => nodeIds.has(sourceId));
    if (!sources.length) unmappedIds.push(id);
  });

  const withParent = activities.filter((activity) => clean(activity.parentId)).length;
  const flatHierarchy = activities.length >= 3 && withParent === 0;
  const parentSuggestions = suggestParentsByType(activities).length;
  const edgeContractGaps = edges.filter((edge) => {
    const source = activities.find((item) => String(item.id) === String(edge.sourceId));
    const target = activities.find((item) => String(item.id) === String(edge.targetId));
    if (!source || !target) return true;
    return isBlankField(source.output) || isBlankField(target.input);
  }).length;

  const canApply =
    blankIoIds.length > 0
    || (flatHierarchy && parentSuggestions > 0)
    || edgeContractGaps > 0;

  return {
    activityCount: activities.length,
    blankIoCount: blankIoIds.length,
    blankIoIds,
    weakIoCount: weakIoIds.length,
    weakIoIds,
    unmappedCount: unmappedIds.length,
    unmappedIds,
    flatHierarchy,
    parentSuggestionCount: parentSuggestions,
    edgeContractGaps,
    canApply
  };
}

export function suggestIoFromOv1(activity = {}, nodeByIdOrOv1 = {}) {
  const nodeById = nodeByIdOrOv1 instanceof Map
    ? nodeByIdOrOv1
    : new Map((Array.isArray(nodeByIdOrOv1?.nodes) ? nodeByIdOrOv1.nodes : []).map((node) => [String(node.id), node]));
  const nodes = unique(activity.sourceOv1NodeIds)
    .map((id) => nodeById.get(String(id)))
    .filter(Boolean);
  if (!nodes.length) return { input: "", output: "" };
  const inputs = nodes.map((node) => clean(node.input, 320)).filter((value) => value && !isBlankField(value));
  const outputs = nodes.map((node) => clean(node.output, 320)).filter((value) => value && !isBlankField(value));
  return {
    input: unique(inputs).slice(0, 3).join("；"),
    output: unique(outputs).slice(0, 3).join("；")
  };
}

/**
 * When all activities are top-level and there are 3+, suggest a shallow tree:
 * earliest operational type (or first activity) as root; others as its children.
 * Never overwrites existing parentId; never creates cycles.
 */
export function suggestParentsByType(activities = []) {
  const list = Array.isArray(activities) ? activities : [];
  if (list.length < 3) return [];
  const alreadyHierarchical = list.some((activity) => clean(activity.parentId));
  if (alreadyHierarchical) return [];

  const ranked = list
    .map((activity, index) => ({
      id: String(activity.id),
      rank: typeRank(activity),
      index
    }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index);

  const rootId = ranked[0]?.id;
  if (!rootId) return [];
  return ranked.slice(1).map((item) => ({ activityId: item.id, parentId: rootId }));
}

export function isBlankField(value) {
  const text = clean(value, 800);
  if (!text) return true;
  return PLACEHOLDER_RE.test(text);
}

function isWeakField(value) {
  const text = clean(value, 800);
  return text.length > 0 && text.length < 2;
}

function typeRank(activity) {
  const haystack = `${activity?.type || ""} ${activity?.title || ""} ${activity?.id || ""}`.toLowerCase();
  for (const entry of TYPE_RANK) {
    if (entry.keys.some((key) => haystack.includes(String(key).toLowerCase()))) return entry.rank;
  }
  const blueprint = String(activity?.id || "").replace(/^ov5-/, "").toLowerCase();
  const blueprintRank = {
    sense: 10, identify: 20, decide: 30, act: 40, control: 50, assess: 60
  }[blueprint];
  return blueprintRank || 100;
}

function canAssignParent(activities, activityId, candidateId) {
  const parentId = String(candidateId || "").trim();
  if (!parentId) return true;
  const byId = new Map(activities.map((activity) => [String(activity.id), activity]));
  if (!byId.has(parentId) || parentId === String(activityId)) return false;
  const seen = new Set([String(activityId)]);
  let currentId = parentId;
  while (currentId) {
    if (seen.has(currentId)) return false;
    seen.add(currentId);
    currentId = clean(byId.get(currentId)?.parentId);
  }
  return true;
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function clean(value, limit = 800) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}
