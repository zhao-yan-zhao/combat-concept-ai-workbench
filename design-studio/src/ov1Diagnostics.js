export function inspectOv1Model(model) {
  const nodes = Array.isArray(model?.nodes) ? model.nodes : [];
  const edges = Array.isArray(model?.edges) ? model.edges : [];
  const connected = new Set(edges.flatMap((edge) => [edge.sourceId, edge.targetId]));
  const labels = new Map();
  nodes.forEach((node) => labels.set(normalize(node.label), [...(labels.get(normalize(node.label)) || []), node.id]));
  const duplicateLabels = [...labels.values()].filter((ids) => ids.length > 1).flat();
  const isolated = nodes.filter((node) => !connected.has(node.id)).map((node) => node.id);
  const feedback = edges.filter((edge) => edge.type === "反馈").length;
  const information = edges.filter((edge) => edge.type === "信息流").length;
  const components = countComponents(nodes, edges);
  const semanticFields = ["category", "responsibility", "input", "output", "constraints", "expectedEffects"];
  const incompleteSemantics = nodes.filter((node) => semanticFields.some((field) => !normalize(node[field]))).map((node) => node.id);
  const checks = [
    check("nodes", "节点完整性", nodes.length ? "ready" : "attention", nodes.length ? `已定义 ${nodes.length} 个总体概念节点` : "尚未定义总体概念节点"),
    check("isolated", "节点连通性", isolated.length ? "review" : "ready", isolated.length ? `${isolated.length} 个节点未参与任何关系` : "所有节点均已关联"),
    check("labels", "节点语义区分", duplicateLabels.length ? "review" : "ready", duplicateLabels.length ? `${duplicateLabels.length} 个节点名称重复` : "节点名称无重复"),
    check("information", "信息主线", information ? "ready" : "review", information ? `已定义 ${information} 条信息流` : "尚未定义信息流"),
    check("feedback", "反馈闭环", feedback ? "ready" : "review", feedback ? `已定义 ${feedback} 条反馈关系` : "尚未定义反馈关系"),
    check("semantics", "节点语义完备性", incompleteSemantics.length ? "review" : "ready", incompleteSemantics.length ? `${incompleteSemantics.length} 个节点尚缺类别、职责、输入、输出、约束或预期效果` : "全部节点均已填写审阅所需语义字段"),
    check("components", "整体可达性", components <= 1 ? "ready" : "review", components <= 1 ? "所有节点属于同一概念网络" : `当前存在 ${components} 个互不连通的概念子图`)
  ];
  return { checks, summary: { isolatedIds: isolated, duplicateLabelIds: duplicateLabels, incompleteSemanticIds: incompleteSemantics, componentCount: components } };
}

function check(id, label, state, detail) { return { id, label, state, statusLabel: state === "ready" ? "已满足" : "需复核", detail }; }
function normalize(value) { return String(value || "").replace(/\s+/g, " ").trim().toLowerCase(); }
function countComponents(nodes, edges) {
  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  edges.forEach((edge) => { adjacency.get(edge.sourceId)?.push(edge.targetId); adjacency.get(edge.targetId)?.push(edge.sourceId); });
  const visited = new Set(); let count = 0;
  nodes.forEach((node) => { if (visited.has(node.id)) return; count += 1; const pending = [node.id]; while (pending.length) { const id = pending.pop(); if (visited.has(id)) continue; visited.add(id); (adjacency.get(id) || []).forEach((next) => pending.push(next)); } });
  return count;
}
