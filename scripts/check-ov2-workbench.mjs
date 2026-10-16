import assert from "node:assert/strict";
import { renderOv2, selectionForOv2Exchange } from "../design-studio/src/ov2View.js";
import { layoutOv2Topology } from "../design-studio/src/ov2Canvas.js";

const mockState = {
  ov2: {
    nodes: [
      { id: "c2", label: "编队指挥所", layer: "combat", taskRefs: ["task-1"] },
      { id: "sensor", label: "远程预警雷达", layer: "concept", taskRefs: [] },
      { id: "shooter", label: "导弹驱逐舰", layer: "combat", taskRefs: ["task-2"] }
    ],
    exchanges: [
      {
        id: "ex-1",
        sourceNodeId: "sensor",
        targetNodeId: "c2",
        sourceNodeLabel: "远程预警雷达",
        targetNodeLabel: "编队指挥所",
        label: "空情早期预警批号",
        flowType: "信息流",
        output: "预警目标航迹点",
        input: "态势融合引擎"
      },
      {
        id: "ex-2",
        sourceNodeId: "c2",
        targetNodeId: "shooter",
        sourceNodeLabel: "编队指挥所",
        targetNodeLabel: "导弹驱逐舰",
        label: "防空火力分配指令",
        flowType: "控制流",
        output: "打击任务指派包",
        input: "舰载火控系统"
      }
    ],
    diagnostics: [
      { id: "flow-check", label: "流向完整性", state: "ready", statusLabel: "就绪", detail: "所有节点均具备进出链路" }
    ]
  }
};

// 1. Check layout algorithm
const layout = layoutOv2Topology(mockState.ov2.nodes, mockState.ov2.exchanges);
assert.ok(layout.positions.size === 3, "Layout should position all 3 nodes");
const sensorPos = layout.positions.get("sensor");
const c2Pos = layout.positions.get("c2");
const shooterPos = layout.positions.get("shooter");
assert.ok(sensorPos.col === 0, "Sensor node should be classified into Column 0 (Sensor)");
assert.ok(c2Pos.col === 1, "C2 node should be classified into Column 1 (Command)");
assert.ok(shooterPos.col === 2, "Shooter node should be classified into Column 2 (Strike)");

// 2. Check default canvas mode HTML
const canvasHtml = renderOv2(mockState);
assert.ok(canvasHtml.includes('data-dodaf-product="OV-2"'), "Must include DoDAF product tag");
assert.ok(canvasHtml.includes('data-derived-provenance="ov2"'), "Must include provenance for traceability");
assert.ok(canvasHtml.includes('data-grouped-list-panel="ov2"'), "Must include grouped-list panel for node list");
assert.ok(canvasHtml.includes("ov2-flow-line"), "Must include SVG flow lines");
assert.ok(canvasHtml.includes("空情早期预警批号"), "Must include exchange label");
assert.ok(canvasHtml.includes("防空火力分配指令"), "Must include second exchange label");

// 3. Check table mode HTML
const tableHtml = renderOv2({ ...mockState, ov2ViewMode: "table" });
assert.ok(tableHtml.includes("ov2-table"), "Must render structured table");
assert.ok(tableHtml.includes("出: 预警目标航迹点"), "Must render output contract in table");
assert.ok(tableHtml.includes("进: 舰载火控系统"), "Must render input contract in table");

// 4. Check exchange selection
const sel = selectionForOv2Exchange("ex-1", mockState);
assert.ok(sel && sel.title.includes("远程预警雷达 -> 编队指挥所"), "Selection title must match");
assert.ok(sel.facts.some(([k, v]) => k === "交换内容" && v === "空情早期预警批号"), "Facts must contain exchange label");

console.log("✓ All check-ov2-workbench assertions passed successfully!");
