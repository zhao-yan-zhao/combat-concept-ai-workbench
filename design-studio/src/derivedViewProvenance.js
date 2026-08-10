/**
 * Shared DoDAF / workbench provenance copy for OV products.
 * Products are DoDAF 2.02/DM2 editable persisted models; upstream views remain seed sources.
 */

const CATALOG = {
  "structure-review": {
    id: "structure-review",
    title: "结构核对台",
    dodaf: "DoDAF 2.02/DM2：聚合作战视图诊断与产品一致性检查，不单独建模。",
    workbench: "工作台：问题聚合台。读取可写源模型（OV-1/OV-5b/OODA/想定）与可编辑持久化 OV 产品诊断。",
    sources: [
      { view: "ov1", label: "OV-1", fields: "nodes/edges" },
      { view: "ov5", label: "OV-5b", fields: "activities/edges/sourceOv1NodeIds" },
      { view: "ov2", label: "OV-2～OV-6c", fields: "persisted DM2 products" }
    ],
    revise: "按问题跳回对应可写源模型或可编辑 OV 产品进行修订。",
    reviseActions: [
      { view: "ov1", label: "打开 OV-1" },
      { view: "ov5", label: "打开 OV-5b" },
      { view: "structure-review", label: "回到核对台" }
    ]
  },
  ov2: {
    id: "ov2",
    title: "OV-2 作战资源流描述",
    dodaf: "DoDAF 2.02/DM2：Performer 节点与 Needline/ResourceFlow 交换需求，不规定通信实现。",
    workbench: "工作台：可编辑持久化产品。可从 OV-1 节点 × OV-5b 活动边 × sourceOv1NodeIds 种子生成；保存后独立修订。",
    sources: [
      { view: "ov1", label: "OV-1", fields: "nodes（作战节点）" },
      { view: "ov5", label: "OV-5b", fields: "edges、activities.output/input、sourceOv1NodeIds" }
    ],
    revise: "可在本页直接编辑交换字段并保存；也可重新种子后覆盖。",
    reviseActions: [
      { view: "ov2", label: "编辑 OV-2" },
      { view: "ov1", label: "打开 OV-1" },
      { view: "ov5", label: "打开 OV-5b" }
    ]
  },
  ov3: {
    id: "ov3",
    title: "OV-3 作战资源流矩阵",
    dodaf: "DoDAF 2.02/DM2：资源流明细表/矩阵；跟踪逻辑交换属性。",
    workbench: "工作台：可编辑持久化产品。可从 OV-5b 有向边与 I/O 种子生成。",
    sources: [
      { view: "ov5", label: "OV-5b", fields: "edges、activities.input/output、edge.type" }
    ],
    revise: "可在本页编辑输入/输出契约并保存；或从 OV-5b 重新种子。",
    reviseActions: [
      { view: "ov3", label: "编辑 OV-3" },
      { view: "ov5", label: "打开 OV-5b" }
    ]
  },
  ov4: {
    id: "ov4",
    title: "OV-4 组织/责任关系",
    dodaf: "DoDAF 2.02/DM2：Organization / responsibleFor 抽象责任关系。",
    workbench: "工作台：可编辑持久化产品。可从 OV-1 节点与 OV-5b 归属关系种子生成。",
    sources: [
      { view: "ov1", label: "OV-1", fields: "nodes" },
      { view: "ov5", label: "OV-5b", fields: "sourceOv1NodeIds、edges" }
    ],
    revise: "可在本页编辑角色说明并保存；或从上游重新种子。",
    reviseActions: [
      { view: "ov4", label: "编辑 OV-4" },
      { view: "ov1", label: "打开 OV-1" },
      { view: "ov5", label: "打开 OV-5b" }
    ]
  },
  ov5a: {
    id: "ov5a",
    title: "OV-5a 作战活动分解树",
    dodaf: "DoDAF 2.02/DM2：Activity 层次分解（activityPartOfActivity / wholePart）。",
    workbench: "工作台：可编辑持久化产品。与 OV-5b Activity 双向同步（parentId / 标题 / 类型）。",
    sources: [
      { view: "ov5", label: "OV-5b", fields: "activities、parentId、title/type" }
    ],
    revise: "在本页改父级后保存会写回 OV-5b；在 OV-5b 改 parentId 后可「从 OV-5b 同步」。",
    reviseActions: [
      { view: "ov5a", label: "编辑 OV-5a" },
      { view: "ov5", label: "打开 OV-5b" }
    ]
  },
  ov6a: {
    id: "ov6a",
    title: "OV-6a 作战规则模型",
    dodaf: "DoDAF 2.02/DM2：Rule 实体约束作战/业务开展。",
    workbench: "工作台：可编辑持久化产品。可从活动 preconditions/constraints 与边 condition 种子生成。",
    sources: [
      { view: "ov5", label: "OV-5b", fields: "preconditions、constraints、edge.condition" }
    ],
    revise: "可在本页直接编辑规则文本并保存。",
    reviseActions: [
      { view: "ov6a", label: "编辑 OV-6a" },
      { view: "ov5", label: "打开 OV-5b" }
    ]
  },
  ov6b: {
    id: "ov6b",
    title: "OV-6b 作战状态转换",
    dodaf: "DoDAF 2.02/DM2：State 与 stateTransition。",
    workbench: "工作台：可编辑持久化产品。可从 OODA 研究循环种子生成；OODA 不再是唯一真源。",
    sources: [
      { view: "ooda", label: "OODA", fields: "lanes/nodes/rule" }
    ],
    revise: "可在本页编辑转换条件并保存；或从 OODA 重新种子。",
    reviseActions: [
      { view: "ov6b", label: "编辑 OV-6b" },
      { view: "ooda", label: "打开 OODA" }
    ]
  },
  ov6c: {
    id: "ov6c",
    title: "OV-6c 事件序列",
    dodaf: "DoDAF 2.02/DM2：Event 时序与追溯。",
    workbench: "工作台：可编辑持久化产品。可从 OODA 与想定时间线种子生成。",
    sources: [
      { view: "ooda", label: "OODA", fields: "nodes" },
      { view: "scenario", label: "想定", fields: "timeline" }
    ],
    revise: "可在本页编辑事件时间/标题并保存；或从上游重新种子。",
    reviseActions: [
      { view: "ov6c", label: "编辑 OV-6c" },
      { view: "ooda", label: "打开 OODA" },
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
