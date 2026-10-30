import assert from "node:assert/strict";
import {
  buildOrganizationRelationshipBatches,
  mergeOrganizationRelationshipDrafts
} from "../design-studio/src/ov4Builder.js";

console.log("Starting check-ov4-ov6c-batch-generation test suite...");

// 1. 验证单一小规模兵力不切批
const smallAnalysis = {
  forces: [{ id: "f-1", name: "指挥中心", side: "friendly" }],
  combatForces: [{ id: "cf-1", name: "无人机分队", conceptForceId: "f-1" }],
  existingRelations: []
};
const smallBatches = buildOrganizationRelationshipBatches(smallAnalysis, 8);
assert.equal(smallBatches.length, 1, "小规模兵力应保持单批次");
assert.equal(smallBatches[0].id, "batch-all");
console.log("✓ 小规模兵力单批次生成验证通过");

// 2. 验证多兵力（如当前项目的48个兵力）能够切分为骨干批次和多个作战群战术批次
const mockForces = [
  { id: "f-cmd", name: "联合指挥控制中心", side: "friendly" },
  { id: "f-recon", name: "综合预警探测群", side: "friendly" },
  { id: "f-strike", name: "无人蜂群突防打击群", side: "friendly" },
  { id: "f-shield", name: "伴随防空与电子对抗群", side: "friendly" }
];
const mockCombatForces = [];
// 每个作战群生成 6 个实体，总计 24 个实体
mockForces.forEach((f) => {
  for (let i = 1; i <= 6; i += 1) {
    mockCombatForces.push({
      id: `cf-${f.id}-${i}`,
      name: `${f.name}-单元${i}`,
      conceptForceId: f.id,
      side: f.side
    });
  }
});

const largeAnalysis = {
  forces: mockForces,
  combatForces: mockCombatForces,
  existingRelations: []
};

const largeBatches = buildOrganizationRelationshipBatches(largeAnalysis, 8);
assert.ok(largeBatches.length >= 3, `多兵力应切分为多个批次，实际生成 ${largeBatches.length} 批`);
assert.equal(largeBatches[0].type, "backbone", "第1批次应为宏观骨干网络");
assert.ok(largeBatches.slice(1).every((b) => b.type === "cluster"), "后续批次应为作战群协同网络");
console.log(`✓ 48兵力切批验证通过，共切分 ${largeBatches.length} 个批次（包含1个骨干批次 + ${largeBatches.length - 1} 个作战群批次）`);

// 3. 验证多批次结果合并与去重
const draftBatch1 = {
  summary: "骨干指挥网完成。",
  relations: [
    { fromForceId: "f-cmd", toForceId: "f-recon", type: "command", relationshipCategory: "作战指挥", note: "指挥" },
    { fromForceId: "f-cmd", toForceId: "f-strike", type: "command", relationshipCategory: "作战指挥", note: "指挥" }
  ],
  diagrams: [{ name: "指挥骨干图", description: "骨干", roleIds: ["f-cmd", "f-recon", "f-strike"] }]
};

const draftBatch2 = {
  summary: "侦察群内协同完成。",
  relations: [
    { fromForceId: "cf-f-recon-1", toForceId: "cf-f-recon-2", type: "coordination", relationshipCategory: "协同", note: "协同探测" },
    // 包含一条与第1批重复的边，测试去重
    { fromForceId: "f-cmd", toForceId: "f-recon", type: "command", relationshipCategory: "作战指挥", note: "重复指挥" }
  ],
  diagrams: [{ name: "侦察协同图", description: "群内", roleIds: ["cf-f-recon-1", "cf-f-recon-2"] }]
};

const merged = mergeOrganizationRelationshipDrafts([draftBatch1, draftBatch2], largeAnalysis);
assert.equal(merged.relations.length, 3, "应正确合并且剔除重复关系（2条骨干 + 1条群内，共3条）");
assert.equal(merged.diagrams.length, 2, "应正确保留两幅图");
assert.ok(merged.summary.includes("骨干指挥网完成"), "应包含汇总摘要");
console.log("✓ 多批次草案合并与去重验证通过");

console.log("All check-ov4-ov6c-batch-generation tests passed successfully!");
