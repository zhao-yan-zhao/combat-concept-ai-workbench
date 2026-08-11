/**
 * Shared provenance copy for derived research products.
 * Resource keys remain ov* for standard data I/O; UI labels avoid OV branding.
 */

const CATALOG = {
  "structure-review": {
    id: "structure-review",
    title: "结构核对台",
    dodaf: "研究级一致性检查：聚合各产品诊断，不单独建模。",
    workbench: "工作台：问题聚合台。读取可写源模型（高层概念图/活动模型/研究循环/想定）与可编辑产品诊断。",
    sources: [
      { view: "ov1", label: "高层作战概念图", fields: "nodes/edges" },
      { view: "ov5", label: "作战活动模型", fields: "activities/edges/sourceOv1NodeIds" },
      { view: "ov2", label: "资源流/规则/状态/事件产品", fields: "persisted DM2 products" }
    ],
    revise: "按问题跳回对应可写源模型或可编辑产品进行修订。",
    reviseActions: [
      { view: "ov1", label: "打开高层作战概念图" },
      { view: "ov5", label: "打开作战活动模型" },
      { view: "structure-review", label: "回到核对台" }
    ]
  },
  ov2: {
    id: "ov2",
    title: "作战资源流描述",
    dodaf: "研究级产品：Performer 节点与 Needline/ResourceFlow 交换需求投影，不规定通信实现。",
    workbench: "工作台：可编辑持久化产品。可从高层概念图节点 × 活动边 × sourceOv1NodeIds 种子生成 Needline 投影；保存后独立修订。",
    sources: [
      { view: "ov1", label: "高层作战概念图", fields: "nodes（作战节点）" },
      { view: "ov5", label: "作战活动模型", fields: "edges、activities.output/input、sourceOv1NodeIds" }
    ],
    revise: "可在本页直接编辑交换字段并保存；也可重新种子后覆盖。",
    reviseActions: [
      { view: "ov2", label: "编辑资源流描述" },
      { view: "ov1", label: "打开高层作战概念图" },
      { view: "ov5", label: "打开作战活动模型" }
    ]
  },
  ov3: {
    id: "ov3",
    title: "作战资源流矩阵",
    dodaf: "研究级产品：资源流明细表/矩阵；跟踪逻辑交换属性。",
    workbench: "工作台：可编辑持久化产品。可从活动模型有向边与 I/O 种子生成。",
    sources: [
      { view: "ov5", label: "作战活动模型", fields: "edges、activities.input/output、edge.type" }
    ],
    revise: "可在本页编辑输入/输出契约并保存；或从活动模型重新种子。",
    reviseActions: [
      { view: "ov3", label: "编辑资源流矩阵" },
      { view: "ov5", label: "打开作战活动模型" }
    ]
  },
  ov4: {
    id: "ov4",
    title: "责任关系",
    dodaf: "研究级产品：抽象责任关系。",
    workbench: "工作台：可编辑持久化产品。可从高层概念图节点与活动归属关系种子生成。",
    sources: [
      { view: "ov1", label: "高层作战概念图", fields: "nodes" },
      { view: "ov5", label: "作战活动模型", fields: "sourceOv1NodeIds、edges" }
    ],
    revise: "可在本页编辑角色说明并保存；或从上游重新种子。",
    reviseActions: [
      { view: "ov4", label: "编辑责任关系" },
      { view: "ov1", label: "打开高层作战概念图" },
      { view: "ov5", label: "打开作战活动模型" }
    ]
  },
  ov5a: {
    id: "ov5a",
    title: "作战活动分解树",
    dodaf: "研究级产品：活动层次分解。",
    workbench: "工作台：可编辑持久化产品。与作战活动模型 Activity 双向同步（parentId / 标题 / 类型）。",
    sources: [
      { view: "ov5", label: "作战活动模型", fields: "activities、parentId、title/type" }
    ],
    revise: "在本页改父级后保存会写回活动模型；在活动模型改 parentId 后可「从活动模型同步」。",
    reviseActions: [
      { view: "ov5a", label: "编辑活动分解树" },
      { view: "ov5", label: "打开作战活动模型" }
    ]
  },
  ov6a: {
    id: "ov6a",
    title: "作战规则模型",
    dodaf: "研究级产品：规则约束。",
    workbench: "工作台：可编辑持久化产品。可从活动 preconditions/constraints 与边 condition 种子生成。",
    sources: [
      { view: "ov5", label: "作战活动模型", fields: "preconditions、constraints、edge.condition" }
    ],
    revise: "可在本页直接编辑规则文本并保存。",
    reviseActions: [
      { view: "ov6a", label: "编辑规则模型" },
      { view: "ov5", label: "打开作战活动模型" }
    ]
  },
  ov6b: {
    id: "ov6b",
    title: "作战状态转换",
    dodaf: "研究级产品：状态与转换。",
    workbench: "工作台：可编辑持久化产品。可从研究辅助循环种子生成。",
    sources: [
      { view: "ooda", label: "研究辅助循环", fields: "lanes/nodes/rule" }
    ],
    revise: "可在本页编辑转换条件并保存；或从研究循环重新种子。",
    reviseActions: [
      { view: "ov6b", label: "编辑状态转换" },
      { view: "ooda", label: "打开研究辅助循环" }
    ]
  },
  ov6c: {
    id: "ov6c",
    title: "事件序列",
    dodaf: "研究级产品：事件时序与追溯。",
    workbench: "工作台：可编辑持久化产品。可从研究循环与想定时间线种子生成。",
    sources: [
      { view: "ooda", label: "研究辅助循环", fields: "nodes" },
      { view: "scenario", label: "想定", fields: "timeline" }
    ],
    revise: "可在本页编辑事件时间/标题并保存；或从上游重新种子。",
    reviseActions: [
      { view: "ov6c", label: "编辑事件序列" },
      { view: "ooda", label: "打开研究辅助循环" },
      { view: "scenario", label: "打开想定" }
    ]
  }
};

export function getDerivedViewProvenance(id) {
  return CATALOG[id] || null;
}

export function listDerivedViewProvenance() {
  return Object.values(CATALOG);
}

export function renderDerivedViewProvenance(id) {
  const item = getDerivedViewProvenance(id);
  if (!item) return "";
  const sources = (item.sources || [])
    .map((source) => `<li><button type="button" class="text-link" data-view="${escapeAttr(source.view)}">${escapeHtml(source.label)}</button> · <code>${escapeHtml(source.fields)}</code></li>`)
    .join("");
  const actions = (item.reviseActions || [])
    .map((action) => `<button type="button" class="ghost-btn compact" data-view="${escapeAttr(action.view)}">${escapeHtml(action.label)}</button>`)
    .join("");
  return `<aside class="derived-provenance" data-derived-provenance="${escapeAttr(id)}">
    <div><strong>标准定位</strong><p>${escapeHtml(item.dodaf)}</p></div>
    <div><strong>工作台语义</strong><p>${escapeHtml(item.workbench)}</p></div>
    <div><strong>种子来源</strong><ul>${sources}</ul></div>
    <div><strong>如何修订</strong><p>${escapeHtml(item.revise)}</p><div class="derived-provenance-actions">${actions}</div></div>
  </aside>`;
}

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
