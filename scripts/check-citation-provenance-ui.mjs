// @ts-check
import assert from "node:assert/strict";
import {
  formatOriginLabel,
  renderOriginBadge,
  calculateEvidenceCoverage,
  renderCitationsAccordion
} from "../design-studio/src/citationProvenanceView.js";
import { renderInspector, renderActivityInspector } from "../design-studio/src/ui.js";
import { renderOv1Inspector } from "../design-studio/src/ov1View.js";
import { renderOv5Workbench } from "../design-studio/src/ov5MechanismView.js";

console.log("=== T2.3 来源标记与证据覆盖率 UI 呈现测试 ===");

// 1. 测试 formatOriginLabel
assert.equal(formatOriginLabel("human"), "人工定义");
assert.equal(formatOriginLabel("cited"), "依据知识");
assert.equal(formatOriginLabel(undefined, [{ chunkId: "c1" }]), "依据知识");
assert.equal(formatOriginLabel("ai-inferred"), "推论生成");
assert.equal(formatOriginLabel(), "推论生成");
console.log("✓ 1. formatOriginLabel 判定通过");

// 2. 测试 renderOriginBadge
const badgeCited = renderOriginBadge("cited");
assert(badgeCited.includes("[📖 依据]"), "cited 必须渲染 [📖 依据]");
assert(badgeCited.includes('data-origin="cited"'));

const badgeInferred = renderOriginBadge("ai-inferred");
assert(badgeInferred.includes("[⚡ 推论]"), "ai-inferred 必须渲染 [⚡ 推论]");
assert(badgeInferred.includes('data-origin="ai-inferred"'));

const badgeHuman = renderOriginBadge("human");
assert(badgeHuman.includes("[👤 人工]"), "human 必须渲染 [👤 人工]");
assert(badgeHuman.includes('data-origin="human"'));

// 回退逻辑
assert(renderOriginBadge(undefined, [{ chunkId: "c-1" }]).includes("[📖 依据]"), "有 citations 时默认回退为依据");
assert(renderOriginBadge(undefined, []).includes("[⚡ 推论]"), "无 citations 时默认回退为推论");
console.log("✓ 2. renderOriginBadge 样式与来源标签通过");

// 3. 测试 calculateEvidenceCoverage
const emptyCoverage = calculateEvidenceCoverage([]);
assert.equal(emptyCoverage.percent, 0);
assert.equal(emptyCoverage.total, 0);
assert.equal(emptyCoverage.cited, 0);

const testItems = [
  { id: "1", citations: [{ chunkId: "c1" }] },
  { id: "2", origin: "cited" },
  { id: "3", evidenceRefs: ["ref-1"] },
  { id: "4", refs: ["条令A"] },
  { id: "5", origin: "ai-inferred", citations: [] }
];
const coverage = calculateEvidenceCoverage(testItems);
assert.equal(coverage.total, 5);
assert.equal(coverage.cited, 4);
assert.equal(coverage.percent, 80);
assert.equal(coverage.label, "证据覆盖率 80% (4/5)");
console.log("✓ 3. calculateEvidenceCoverage 覆盖率计算通过");

// 4. 测试 renderCitationsAccordion
const citationsMock = [
  {
    chunkId: "chk-01",
    title: "空军防空预警准则",
    filePath: "条令/预警.md",
    snippet: "分布式传感器前沿接力配置",
    score: 92
  }
];
const accordionHtml = renderCitationsAccordion(citationsMock);
assert(accordionHtml.includes("<details class=\"citation-accordion\""), "必须为 details 折叠项");
assert(accordionHtml.includes("空军防空预警准则"), "必须包含标题");
assert(accordionHtml.includes("条令/预警.md"), "必须包含文件路径");
assert(accordionHtml.includes("分布式传感器前沿接力配置"), "必须包含原文摘要");
assert(accordionHtml.includes("92% 匹配"), "必须包含匹配度");
console.log("✓ 4. renderCitationsAccordion 可展开引用卡片通过");

// 5. 测试 renderActivityInspector 中来源徽标与引用组件
const activityMock = {
  id: "act-101",
  title: "雷达前出接力预警",
  origin: "cited",
  citations: citationsMock
};
const activityInspectorHtml = renderActivityInspector(activityMock, { ov5: { activities: [activityMock] } });
assert(activityInspectorHtml.includes("[📖 依据]"), "Activity 检查器必须包含来源标签");
assert(activityInspectorHtml.includes("空军防空预警准则"), "Activity 检查器必须展示关联引用");

// 6. 测试通用 renderInspector 中来源徽标
const generalSelectionMock = {
  kind: "generic-node",
  text: "巡逻任务节点",
  origin: "human",
  citations: []
};
const generalInspectorHtml = renderInspector(generalSelectionMock, {});
assert(generalInspectorHtml.includes("[👤 人工]"), "通用检查器必须包含来源标签");

// 7. 测试 OV-5 视图头部证据覆盖率徽标
const ov5StateMock = {
  ov5: {
    activities: testItems,
    edges: []
  }
};
const ov5WorkbenchHtml = renderOv5Workbench(ov5StateMock);
assert(ov5WorkbenchHtml.includes("证据覆盖率 80% (4/5)"), "OV-5 头部必须展示证据覆盖率");
console.log("✓ 5/6/7. Inspector 与 OV-5 头部 UI 继承验证通过");

console.log("\n=== T2.3 来源标记与证据覆盖率测试 100% 全部通过 ===");
