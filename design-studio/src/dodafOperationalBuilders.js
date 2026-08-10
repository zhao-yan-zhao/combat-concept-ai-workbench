export function buildOv5aModel({ ov5 } = {}) {
  const activities = Array.isArray(ov5?.activities) ? ov5.activities : [];
  const byParent = new Map(activities.map((activity) => [String(activity.id), []]));
  const roots = [];
  activities.forEach((activity) => {
    const parentId = String(activity.parentId || "");
    if (parentId && byParent.has(parentId) && parentId !== activity.id) byParent.get(parentId).push(activity);
    else roots.push(activity);
  });
  const tree = roots.map((activity) => toTree(activity, byParent, new Set()));
  const ungroupedCount = roots.length;
  return { kind: "derived-ov5a-operational-activity-decomposition", generatedAt: new Date().toISOString(), tree, diagnostics: [check("activities", "活动来源", activities.length ? "ready" : "pending", activities.length ? `已从 OV-5b 读取 ${activities.length} 项活动` : "尚未定义活动"), check("hierarchy", "活动分解", activities.length && ungroupedCount === activities.length ? "review" : activities.length ? "ready" : "pending", activities.length && ungroupedCount === activities.length ? "尚未设置父级活动；当前以并列活动显示" : activities.length ? "已识别活动分解关系" : "等待活动定义")] };
}

export function buildOv6aModel({ ov5 } = {}) {
  const activities = Array.isArray(ov5?.activities) ? ov5.activities : [];
  const edges = Array.isArray(ov5?.edges) ? ov5.edges : [];
  const byId = new Map(activities.map((activity) => [String(activity.id), activity]));
  const rules = activities.flatMap((activity) => {
    const result = [];
    if (clean(activity.preconditions)) result.push(rule(activity, "前置条件", activity.preconditions));
    if (clean(activity.constraints)) result.push(rule(activity, "约束", activity.constraints));
    return result;
  });
  edges.forEach((edge) => { if (clean(edge.condition)) rules.push({ id: `edge-${edge.id}`, subject: `${label(byId.get(String(edge.sourceId)))} -> ${label(byId.get(String(edge.targetId)))}`, type: "转换条件", text: clean(edge.condition) }); });
  return { kind: "derived-ov6a-operational-rules", generatedAt: new Date().toISOString(), rules, diagnostics: [check("rules", "规则来源", rules.length ? "ready" : "review", rules.length ? `已从活动约束和关系条件派生 ${rules.length} 条规则` : "尚未定义活动前提、约束或关系条件")] };
}

export function buildOv6bModel({ ooda } = {}) {
  const lanes = Array.isArray(ooda?.lanes) ? ooda.lanes : [];
  const states = lanes.flatMap((lane) => (lane.nodes || []).map((node) => ({ id: String(node.id), label: clean(node.title) || String(node.id), phase: clean(lane.subtitle || lane.title) || "研究循环", rule: clean(node.rule) })));
  const transitions = [];
  lanes.forEach((lane, laneIndex) => {
    const nodes = lane.nodes || [];
    nodes.slice(0, -1).forEach((node, index) => transitions.push(transition(node, nodes[index + 1], clean(nodes[index + 1]?.rule) || "完成当前研究节点")));
    const next = lanes[laneIndex + 1]?.nodes?.[0];
    if (nodes.at(-1) && next) transitions.push(transition(nodes.at(-1), next, clean(next.rule) || "进入下一研究阶段"));
  });
  return { kind: "derived-ov6b-state-transition", generatedAt: new Date().toISOString(), states, transitions, diagnostics: [check("states", "状态来源", states.length ? "ready" : "pending", states.length ? `已从 OODA 研究循环派生 ${states.length} 个状态` : "尚未定义 OODA 节点"), check("transitions", "状态转换", transitions.length ? "ready" : "review", transitions.length ? `已派生 ${transitions.length} 条状态转换` : "尚未形成可追溯转换")] };
}

function toTree(activity, byParent, visited) { const id = String(activity.id); if (visited.has(id)) return { id, title: label(activity), cycle: true, children: [] }; const next = new Set(visited); next.add(id); return { id, title: label(activity), type: clean(activity.type), children: (byParent.get(id) || []).map((child) => toTree(child, byParent, next)) }; }
function rule(activity, type, text) { return { id: `${activity.id}-${type}`, subject: label(activity), type, text: clean(text) }; }
function transition(source, target, condition) { return { id: `${source.id}-${target.id}`, sourceId: String(source.id), targetId: String(target.id), sourceLabel: clean(source.title) || String(source.id), targetLabel: clean(target.title) || String(target.id), condition }; }
function label(value) { return clean(value?.title) || String(value?.id || "待定义活动"); }
function check(id, label, state, detail) { return { id, label, state, statusLabel: ({ ready: "已满足", review: "需复核", pending: "未完成" })[state], detail }; }
function clean(value) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, 800); }
