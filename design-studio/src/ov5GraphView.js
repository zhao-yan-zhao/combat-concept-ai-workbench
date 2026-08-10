import { buildOv5ActivityGraph } from "./ov5GraphBuilder.js";

export function renderOv5ActivityGraph(model) {
  const graph = buildOv5ActivityGraph(model);
  return `
    <section class="ov5-graph" aria-label="OV-5 活动关系图">
      <div class="ov5-graph-heading"><span>活动关系图</span><small>选择活动查看详情；关系仍在活动关联区维护</small></div>
      <div class="ov5-graph-board"><div class="ov5-drawflow-canvas" aria-label="OV-5 活动关系画布"></div></div>
      <div class="ov5-graph-meta"><span>虚线：信息流</span><span>蓝线：控制流</span><span>金线：资源流</span>${graph.cycleNodeIds.length ? `<span class="review">检测到 ${graph.cycleNodeIds.length} 个关系闭环</span>` : ""}${graph.hiddenNodeCount || graph.hiddenEdgeCount ? `<span>已收起 ${graph.hiddenNodeCount} 个活动 / ${graph.hiddenEdgeCount} 条关系</span>` : ""}</div>
    </section>
  `;
}
