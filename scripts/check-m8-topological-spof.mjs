// @ts-check
import assert from "node:assert/strict";
import {
  analyzeNetworkResilience,
  findSinglePointsOfFailure,
  evaluateOodaLoopHealth
} from "../design-studio/src/oodaStore.js";

console.log("[T8.2 Test] Starting Topological SPOF & Kill Web Resilience Verification ...");

// 1. 构造测试网络：2个感知节点 -> 1个唯一桥接节点 (无“决策/控制/中继”字眼) -> 2个打击节点
// 故意命名为“战术综合态势分发总线”，类型为“协同交换”，测试旧字符串匹配的失效场景
const baseActivities = [
  { id: "s-1", type: "感知", title: "机载有源相控阵探测" },
  { id: "s-2", type: "侦察", title: "水下潜伏水听阵列" },
  { id: "m-bridge", type: "协同交换", title: "战术综合态势分发总线" }, // 唯一桥梁，无决策/控制/中继字眼
  { id: "a-1", type: "打击", title: "多目标饱和防区外突击" },
  { id: "a-2", type: "突击", title: "远程超音速反舰打击" }
];

const baseEdges = [
  { id: "e-1", sourceId: "s-1", targetId: "m-bridge", type: "信息流" },
  { id: "e-2", sourceId: "s-2", targetId: "m-bridge", type: "信息流" },
  { id: "e-3", sourceId: "m-bridge", targetId: "a-1", type: "控制流" },
  { id: "e-4", sourceId: "m-bridge", targetId: "a-2", type: "控制流" }
];

// 2. 验证基准杀伤链连通性与真拓扑 SPOF 发现能力
const analysis1 = analyzeNetworkResilience(baseActivities, baseEdges);
console.log("[T8.2 Test] Initial resilience analysis:", JSON.stringify({
  baseConnectivity: analysis1.baseConnectivity,
  criticalSpofs: analysis1.criticalSpofs.map((s) => ({ id: s.id, title: s.title, impactRate: s.impactRate })),
  mitigatedBottlenecks: analysis1.mitigatedBottlenecks.length,
  resilienceScore: analysis1.resilienceScore
}, null, 2));

// 基准连通链对数应为 2 (sources) * 2 (targets) = 4
assert.equal(analysis1.baseConnectivity, 4, "Base kill chain connectivity should be 4 pairs");

// 重点断言：节点 m-bridge 虽无决策/控制/中继字样，但必须被准确识别为 Critical SPOF
assert.equal(analysis1.criticalSpofs.length, 1, "m-bridge must be identified as Critical SPOF");
assert.equal(analysis1.criticalSpofs[0].id, "m-bridge", "SPOF id must be m-bridge");
assert.equal(analysis1.criticalSpofs[0].lostPairs, 4, "Removing m-bridge must destroy all 4 kill chains");
assert.equal(analysis1.criticalSpofs[0].remainingPairs, 0, "Remaining pairs after m-bridge failure should be 0");
assert.equal(analysis1.criticalSpofs[0].impactRate, 1.0, "m-bridge failure impact rate should be 100%");
assert.equal(analysis1.resilienceScore, 65, "Resilience score should be penalized to 65 due to fatal SPOF");

// 向后兼容接口断言
const compatSpofs = findSinglePointsOfFailure(baseActivities, baseEdges);
assert.equal(compatSpofs.length, 1, "findSinglePointsOfFailure should return m-bridge");
assert.equal(compatSpofs[0].id, "m-bridge");

// 3. 验证 evaluateOodaLoopHealth 诊断集成
const health1 = evaluateOodaLoopHealth({ activities: baseActivities, edges: baseEdges });
const spofDiag = health1.diagnostics.find((d) => d.code === "TOPOLOGICAL_SPOF_DETECTED");
assert(Boolean(spofDiag), "Should generate TOPOLOGICAL_SPOF_DETECTED diagnostic");
console.log("[T8.2 Test] Generated diagnostic:", spofDiag.label);

// 4. 验证配置抗毁备用机制 (resilienceFallback) 后的韧性提升与受控降级流转
const mitigatedActivities = baseActivities.map((act) => {
  if (act.id === "m-bridge") {
    return { ...act, resilienceFallback: "低轨卫星直连与无人机机载中继应急旁路" };
  }
  return act;
});

const analysis2 = analyzeNetworkResilience(mitigatedActivities, baseEdges);
console.log("[T8.2 Test] Mitigated resilience analysis:", JSON.stringify({
  criticalSpofs: analysis2.criticalSpofs.length,
  mitigatedBottlenecks: analysis2.mitigatedBottlenecks.map((m) => ({ id: m.id, title: m.title, fallback: m.resilienceFallback })),
  resilienceScore: analysis2.resilienceScore
}, null, 2));

// 断言：高危单点故障消除，转入受控降级列表
assert.equal(analysis2.criticalSpofs.length, 0, "Critical SPOFs must be 0 after fallback mitigation");
assert.equal(analysis2.mitigatedBottlenecks.length, 1, "m-bridge should become Mitigated Bottleneck");
assert.equal(analysis2.mitigatedBottlenecks[0].id, "m-bridge");
// 韧性评分自动大幅提升（从 65 分恢复到 95 分）
assert.equal(analysis2.resilienceScore, 95, "Resilience score should recover to 95");

const health2 = evaluateOodaLoopHealth({ activities: mitigatedActivities, edges: baseEdges });
assert.equal(health2.bottlenecks.length, 0, "Health bottlenecks should report 0 critical SPOFs");
assert(!health2.diagnostics.some((d) => d.code === "TOPOLOGICAL_SPOF_DETECTED"), "SPOF warning should be eliminated");

console.log("[T8.2 Test] ✓ All T8.2 Topological SPOF & Resilience tests PASSED successfully!");
