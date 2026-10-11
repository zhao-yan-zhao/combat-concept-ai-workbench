import assert from "node:assert/strict";
import { renderOv6bPage } from "../design-studio/src/stateMachineView.js";
import { updateOv6bCanvasLayout } from "../design-studio/src/ov6Workbench.js";
import { normalizeDodafOv6b } from "../shared/dodaf/products.js";

console.log("Starting node click stability & layout resistance regression tests...");

// 1. Build a representative state machine (radar passive surveillance machine)
const rawMachine = {
  id: "machine-radar",
  name: "雷达预警状态机",
  canvasLayout: "auto",
  states: [
    { id: "r0", name: "开始", kind: "initial" },
    { id: "r1", name: "建立对敌外层预警雷达的无源监听", kind: "normal" },
    { id: "r2", name: "信号识别判定", kind: "decision", decisionExpression: "是否捕获敌制导雷达连续波照射？" },
    { id: "r3", name: "启动被动测向定位与全向干扰压制", kind: "normal" },
    { id: "r4", name: "结束", kind: "final" }
  ],
  transitions: [
    { id: "rt0", fromStateRef: "r0", toStateRef: "r1", condition: "进入任务时窗" },
    { id: "rt1", fromStateRef: "r1", toStateRef: "r2", condition: "捕获辐射源信号" },
    { id: "rt2", fromStateRef: "r2", toStateRef: "r3", condition: "参数匹配威胁库", branchResult: "满足" },
    { id: "rt3", fromStateRef: "r2", toStateRef: "r1", condition: "杂波或非威胁信号", branchResult: "不满足" },
    { id: "rt4", fromStateRef: "r3", toStateRef: "r4", condition: "完成压制与态势回传" }
  ]
};

const ov6bModel = normalizeDodafOv6b({ stateMachines: [rawMachine] });
const state = {
  activeView: "ov6b",
  ov6b: ov6bModel,
  ov6bSelectedMachineId: "machine-radar"
};

// Initial render under automatic topology
const htmlInitial = renderOv6bPage(state);
assert(htmlInitial.includes('data-machine-id="machine-radar"'), "Machine rendered");

// Extract node positions from initial auto layout
function extractNodePositions(html) {
  const positions = {};
  const regex = /data-ov1-node="([^"]+)"[^>]*style="left:([^;"]+);top:([^;"]+)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    positions[match[1]] = { left: match[2], top: match[3] };
  }
  return positions;
}

function extractWorldSize(html) {
  const match = /data-ov1-world[^>]*style="width:([^;%]+)%/i.exec(html);
  return match ? Number.parseFloat(match[1]) : 100;
}

const initialPositions = extractNodePositions(htmlInitial);
const initialWorldWidth = extractWorldSize(htmlInitial);

console.log("Initial Auto World Width:", initialWorldWidth);
console.log("Initial Auto Positions:", initialPositions);

assert(initialWorldWidth > 130, "Topology should compute wide world (>=130%) to prevent node & label overlap");
assert.equal(Object.keys(initialPositions).length, 5, "All 5 nodes rendered with positions");

// Test 1: Simulating Clicking a Node (with micro-jitter < 8px)
// As designed, a click selects the state without mutating canvasLayout to 'manual' or wiping worldWidth
const stateAfterClick = {
  ...state,
  ov6bSelectedStateId: "r1",
  ov6bEditorOpen: true
};
const htmlAfterClick = renderOv6bPage(stateAfterClick);
const positionsAfterClick = extractNodePositions(htmlAfterClick);
const worldWidthAfterClick = extractWorldSize(htmlAfterClick);

assert.equal(worldWidthAfterClick, initialWorldWidth, "Clicking node must preserve world width");
for (const [nodeId, pos] of Object.entries(initialPositions)) {
  assert.equal(positionsAfterClick[nodeId]?.left, pos.left, `Node ${nodeId} left position must not jump upon click`);
  assert.equal(positionsAfterClick[nodeId]?.top, pos.top, `Node ${nodeId} top position must not jump upon click`);
}
console.log("Test 1 Passed: Node click does not disrupt canvas layout or world size!");

// Test 2: Simulating Actual Drag (>= 8px displacement)
// When user intentionally moves node r1 to new logical coord
const currentWorldWidth = initialWorldWidth;
const nextModel = updateOv6bCanvasLayout(ov6bModel, "machine-radar", {
  canvasLayout: "manual",
  positions: [{ id: "r1", x: "32%", y: "48%" }],
  worldWidth: currentWorldWidth
});

assert.equal(nextModel.stateMachines[0].canvasLayout, "manual", "Intentional drag updates canvasLayout to manual");
assert.equal(nextModel.stateMachines[0].worldWidth, Math.round(currentWorldWidth), "Intentional drag preserves worldWidth");

const stateAfterDrag = {
  ...state,
  ov6b: nextModel,
  ov6bSelectedStateId: "r1",
  ov6bEditorOpen: true
};
const htmlAfterDrag = renderOv6bPage(stateAfterDrag);
const positionsAfterDrag = extractNodePositions(htmlAfterDrag);
const worldWidthAfterDrag = extractWorldSize(htmlAfterDrag);

assert.equal(worldWidthAfterDrag, Math.round(currentWorldWidth), "Manual mode must retain the wide world canvas width");
console.log("World width in manual mode preserved at:", worldWidthAfterDrag);

// Test 3: Returning to Auto Layout via "Adaptive Layout" button
const restoredModel = updateOv6bCanvasLayout(nextModel, "machine-radar", {
  canvasLayout: "auto"
});
assert.equal(restoredModel.stateMachines[0].canvasLayout, "auto", "Canvas layout toggles back to auto");
const stateRestored = {
  ...state,
  ov6b: restoredModel
};
const htmlRestored = renderOv6bPage(stateRestored);
const restoredPositions = extractNodePositions(htmlRestored);
for (const [nodeId, pos] of Object.entries(initialPositions)) {
  assert.equal(restoredPositions[nodeId]?.left, pos.left, `Node ${nodeId} must return to optimal topology pos`);
  assert.equal(restoredPositions[nodeId]?.top, pos.top, `Node ${nodeId} must return to optimal topology pos`);
}
console.log("Test 3 Passed: Resetting to auto layout flawlessly restores topology positions!");

console.log("All node click stability & layout resistance tests passed successfully!");
