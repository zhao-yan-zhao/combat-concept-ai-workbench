import assert from "node:assert/strict";
import { renderOv6bPage } from "../design-studio/src/stateMachineView.js";

// Test scenario exactly matching user's diagram:
const machine = {
  id: "sm-swarm",
  name: "蜂群作战状态机",
  states: [
    { id: "s0", name: "开始", kind: "initial" },
    { id: "s1", name: "蜂群巡航前推中", kind: "normal" },
    { id: "s2", name: "阵位展开就绪", kind: "normal" },
    { id: "s3", name: "结束", kind: "final" }
  ],
  transitions: [
    { id: "t0", fromStateRef: "s0", toStateRef: "s1", condition: "蓝方异构蜂群完成发射并进入预定巡航高度" },
    { id: "t1", fromStateRef: "s1", toStateRef: "s2", condition: "按预定航线隐蔽前推至敌防空识别区边缘" },
    { id: "t2", fromStateRef: "s2", toStateRef: "s3", condition: "蜂群抵达多轴向诱骗起始阵位且组网链路稳定" }
  ]
};

const html = renderOv6bPage({ stateMachines: [machine] });
assert(html.includes("data-sm-canvas-layout"), "Must render auto-layout button");
assert(html.includes("data-sm-canvas-fit"), "Must render fit camera button");

// Extract world dimensions
const worldMatch = html.match(/class="sm-flow-world"[^>]*style="width:([0-9.]+)%;height:([0-9.]+)%;"/);
assert(worldMatch, "Must specify world dimensions style");
const worldW = Number(worldMatch[1]);
const worldH = Number(worldMatch[2]);
console.log(`World size: width=${worldW}%, height=${worldH}%`);
assert(worldW >= 100, "World width should be at least 100%");

// Extract node positions
const nodeMatches = [...html.matchAll(/data-ov1-node="([^"]+)"[^>]*data-logical-x="([^%"]+)%"[^>]*data-logical-y="([^%"]+)%"/g)];
assert.equal(nodeMatches.length, 4, "Should render 4 nodes");

const nodes = nodeMatches.map(m => ({
  id: m[1],
  x: Number(m[2]),
  y: Number(m[3])
}));
console.log("Nodes positions (% of world):", nodes);

// Calculate pixel coordinates assuming reference stage 1100px:
// world width in px: 1100 * (worldW / 100)
const totalPixelW = 1100 * (worldW / 100);
const pixelNodes = nodes.map(n => ({
  ...n,
  pxX: (n.x / 100) * totalPixelW
}));
console.log("Nodes pixel positions:", pixelNodes.map(n => ({ id: n.id, pxX: Math.round(n.pxX) })));

// Node dimensions:
// s0 (initial): 34px -> half 17px
// s1 (normal): 168px -> half 84px
// s2 (normal): 168px -> half 84px
// s3 (final): 34px -> half 17px
const dims = {
  s0: { halfW: 17 },
  s1: { halfW: 84 },
  s2: { halfW: 84 },
  s3: { halfW: 17 }
};

// Check gaps between borders:
const gap01 = (pixelNodes[1].pxX - dims.s1.halfW) - (pixelNodes[0].pxX + dims.s0.halfW);
const gap12 = (pixelNodes[2].pxX - dims.s2.halfW) - (pixelNodes[1].pxX + dims.s1.halfW);
const gap23 = (pixelNodes[3].pxX - dims.s3.halfW) - (pixelNodes[2].pxX + dims.s2.halfW);

console.log(`Gap s0->s1: ${Math.round(gap01)}px (Condition label: 19 chars ~180px)`);
console.log(`Gap s1->s2: ${Math.round(gap12)}px (Condition label: 17 chars ~170px)`);
console.log(`Gap s2->s3: ${Math.round(gap23)}px (Condition label: 21 chars ~190px)`);

// Test Scenario 2: Decision node with branches
const decisionMachine = {
  id: "sm-decision-test",
  name: "判定分支状态机",
  states: [
    { id: "d0", name: "开始", kind: "initial" },
    { id: "d1", name: "雷达态势评估", kind: "decision", decisionExpression: "信噪比 > 12dB" },
    { id: "d2", name: "精确制导锁定", kind: "normal" },
    { id: "d3", name: "广域机动搜索", kind: "normal" },
    { id: "d4", name: "任务终结", kind: "final" }
  ],
  transitions: [
    { id: "dt0", fromStateRef: "d0", toStateRef: "d1", condition: "进入扫描空域" },
    { id: "dt1", fromStateRef: "d1", toStateRef: "d2", branchResult: "满足" },
    { id: "dt2", fromStateRef: "d1", toStateRef: "d3", branchResult: "不满足" },
    { id: "dt3", fromStateRef: "d2", toStateRef: "d4", condition: "打击完成" },
    { id: "dt4", fromStateRef: "d3", toStateRef: "d4", condition: "航程耗尽返航" }
  ]
};

const htmlDecision = renderOv6bPage({ stateMachines: [decisionMachine] });
const decNodes = [...htmlDecision.matchAll(/data-ov1-node="([^"]+)"[^>]*data-logical-x="([^%"]+)%"[^>]*data-logical-y="([^%"]+)%"/g)].map(m => ({
  id: m[1],
  x: Number(m[2]),
  y: Number(m[3])
}));
console.log("Decision machine laid out nodes:", decNodes);

// d2 and d3 are both in rank 2 (branches) -> verify they are vertically separated!
const d2 = decNodes.find(n => n.id === "d2");
const d3 = decNodes.find(n => n.id === "d3");
assert(d2 && d3, "Branch targets d2 and d3 must exist");
console.log(`Branch d2 Y: ${d2.y}%, Branch d3 Y: ${d3.y}% (Diff: ${Math.abs(d2.y - d3.y).toFixed(2)}%)`);
assert(Math.abs(d2.y - d3.y) >= 12, "Branch nodes must have ample vertical clearance");

console.log("Decision branching test passed with zero overlap!");

// Test Scenario 3: Exactly matching user screenshot with loop-back
const radarMachine = {
  id: "sm-radar-user",
  name: "雷达侦察状态机",
  states: [
    { id: "r0", name: "开始", kind: "initial" },
    { id: "r1", name: "无源监听建立中", kind: "normal" },
    { id: "r2", name: "敌方态势判定", kind: "decision" },
    { id: "r3", name: "日常值班态势确认", kind: "normal" },
    { id: "r4", name: "结束", kind: "final" }
  ],
  transitions: [
    { id: "rt0", fromStateRef: "r0", toStateRef: "r1", condition: "电子侦察节点到达预定空域" },
    { id: "rt1", fromStateRef: "r1", toStateRef: "r2", condition: "建立对敌外层预警雷达的无源监听" },
    { id: "rt2", fromStateRef: "r2", toStateRef: "r3", branchResult: "满足" },
    { id: "rt3", fromStateRef: "r2", toStateRef: "r1", branchResult: "不满足" },
    { id: "rt4", fromStateRef: "r3", toStateRef: "r4", condition: "确认敌方日常值班态势且组网链路稳定" }
  ]
};

const htmlRadar = renderOv6bPage({ stateMachines: [radarMachine] });
const radarWorldMatch = htmlRadar.match(/class="sm-flow-world"[^>]*style="width:([0-9.]+)%;height:([0-9.]+)%;"/);
const rWorldW = Number(radarWorldMatch[1]);
console.log("Radar world width:", rWorldW);

const radarNodes = [...htmlRadar.matchAll(/data-ov1-node="([^"]+)"[^>]*data-logical-x="([^%"]+)%"[^>]*data-logical-y="([^%"]+)%"/g)].map(m => ({
  id: m[1],
  x: Number(m[2]),
  y: Number(m[3])
}));
console.log("Radar nodes positions:", radarNodes);

const rTotalPixelW = 1100 * (rWorldW / 100);
const rPixelNodes = radarNodes.map(n => ({
  ...n,
  pxX: (n.x / 100) * rTotalPixelW
}));
console.log("Radar pixel nodes:", rPixelNodes.map(n => ({ id: n.id, pxX: Math.round(n.pxX) })));

// Check distance between r1 (normal, halfW=84) and r2 (decision, halfW=42)
const r1 = rPixelNodes.find(n => n.id === "r1");
const r2 = rPixelNodes.find(n => n.id === "r2");
const gapR1R2 = (r2.pxX - 42) - (r1.pxX + 84);
console.log("Gap r1->r2:", Math.round(gapR1R2), "px");

// Check label position for rt1
const labelMatch = [...htmlRadar.matchAll(/data-ov1-edge-label="([^"]+)"[^>]*style="left:([0-9.]+)%;top:([0-9.]+)%"/g)];
console.log("Edge labels:", labelMatch.map(m => ({ id: m[1], left: m[2], top: m[3] })));
const pathMatches = [...htmlRadar.matchAll(/<path d="([^"]+)"[^>]*data-ov1-edge="([^"]+)"/g)];
const nodeWraps = [...htmlRadar.matchAll(/class="sm-flow-node-wrap[^"]*"[^>]*data-ov1-node="([^"]+)"[^>]*style="left:([^";]+);top:([^";]+);"/g)];
console.log("Radar Node wraps:", nodeWraps.map(m => ({ id: m[1], left: m[2], top: m[3] })));


