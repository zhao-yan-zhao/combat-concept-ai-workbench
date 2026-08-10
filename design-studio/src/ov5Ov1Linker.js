/**
 * Map OV-5 activities to OV-1 concept nodes via kind/type heuristics.
 * Existing valid sourceOv1NodeIds are preserved; empty or stale IDs are refilled.
 */

const TYPE_KIND_PREFERENCE = {
  "感知": ["equipment", "environment", "participant", "sense"],
  "识别": ["equipment", "command", "participant", "sense"],
  "决策": ["command", "decide", "participant"],
  "行动": ["action", "control", "external", "opponent", "participant"],
  "控制": ["command", "action", "control", "external", "participant"],
  "评估": ["effect", "assess", "command", "participant"]
};

const BLUEPRINT_KIND_PREFERENCE = {
  sense: ["equipment", "environment", "participant", "sense"],
  identify: ["equipment", "command", "participant", "sense"],
  decide: ["command", "decide", "participant"],
  act: ["action", "control", "external", "opponent", "participant"],
  control: ["command", "action", "control", "external", "participant"],
  assess: ["effect", "assess", "command", "participant"]
};

export function linkOv5ActivitiesToOv1(model = {}, ov1 = {}) {
  const nodes = Array.isArray(ov1?.nodes) ? ov1.nodes : [];
  const nodeIds = new Set(nodes.map((node) => String(node.id)));
  const activities = Array.isArray(model.activities) ? model.activities.map((activity) => linkActivity(activity, nodes, nodeIds)) : [];
  return { ...model, activities };
}

export function countUnmappedOv5Activities(model = {}, ov1 = {}) {
  const nodeIds = new Set((Array.isArray(ov1?.nodes) ? ov1.nodes : []).map((node) => String(node.id)));
  return (Array.isArray(model.activities) ? model.activities : []).filter((activity) => {
    const ids = unique(activity?.sourceOv1NodeIds).filter((id) => nodeIds.has(id));
    return !ids.length;
  }).length;
}

/** Suggest OV-1 sources for one activity without mutating retained manual choices elsewhere. */
export function suggestOv1SourcesForActivity(activity = {}, ov1 = {}) {
  const linked = linkOv5ActivitiesToOv1({
    activities: [{ ...activity, sourceOv1NodeIds: [] }],
    edges: []
  }, ov1);
  return unique(linked.activities[0]?.sourceOv1NodeIds);
}

function linkActivity(activity, nodes, nodeIds) {
  const retained = unique(activity?.sourceOv1NodeIds).filter((id) => nodeIds.has(id));
  if (retained.length || !nodes.length) {
    return { ...activity, sourceOv1NodeIds: retained };
  }
  const preferred = preferredKinds(activity);
  const ranked = nodes
    .map((node) => ({ id: String(node.id), score: scoreNode(node, activity, preferred) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  const sourceOv1NodeIds = ranked.slice(0, 3).map((item) => item.id);
  if (!sourceOv1NodeIds.length && preferred.includes("effect")) {
    const effect = nodes.find((node) => normalize(node.kind) === "effect" || /效果|终态|assess/i.test(String(node.label || "")));
    if (effect) sourceOv1NodeIds.push(String(effect.id));
  }
  if (!sourceOv1NodeIds.length) {
    // Fallback: keep at least one conceptual anchor so derived views can form exchanges.
    sourceOv1NodeIds.push(String(nodes[0].id));
  }
  return { ...activity, sourceOv1NodeIds: unique(sourceOv1NodeIds) };
}

function preferredKinds(activity) {
  const type = normalize(activity?.type);
  if (TYPE_KIND_PREFERENCE[activity?.type]) return TYPE_KIND_PREFERENCE[activity.type];
  for (const [key, kinds] of Object.entries(TYPE_KIND_PREFERENCE)) {
    if (type.includes(normalize(key))) return kinds;
  }
  const blueprint = String(activity?.id || "").replace(/^ov5-/, "");
  if (BLUEPRINT_KIND_PREFERENCE[blueprint]) return BLUEPRINT_KIND_PREFERENCE[blueprint];
  return ["participant", "command", "action", "equipment"];
}

function scoreNode(node, activity, preferredKindsList) {
  const kind = normalize(node.kind || node.category);
  const label = normalize(node.label);
  const title = normalize(activity?.title);
  const text = normalize(activity?.text);
  let score = 0;
  preferredKindsList.forEach((preferred, index) => {
    const token = normalize(preferred);
    if (!token) return;
    if (kind === token || kind.includes(token) || token.includes(kind)) score += 12 - index;
    if (label.includes(token)) score += 4;
  });
  if (title && label && (title.includes(label) || label.includes(title))) score += 8;
  if (text && label && text.includes(label)) score += 3;
  // Prefer effect nodes for assess-type activities even when kind text is freeform Chinese.
  if (preferredKindsList.includes("effect") && /效果|终态|评估/.test(String(node.label || "") + String(node.category || ""))) score += 6;
  if (preferredKindsList.includes("command") && /指挥|控制|决策|c2/i.test(String(node.label || "") + String(node.category || ""))) score += 5;
  if (preferredKindsList.includes("equipment") && /感知|侦察|监视|传感|装备|平台/.test(String(node.label || "") + String(node.category || ""))) score += 5;
  return score;
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}
