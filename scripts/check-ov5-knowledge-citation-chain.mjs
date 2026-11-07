import assert from "node:assert/strict";
import { normalizeCitation, normalizeCitations, normalizeDm2Entity } from "../shared/dodaf/entities.js";
import { normalizeDodafOv5 } from "../shared/dodaf/products.js";
import { createOpenAiClient } from "../server/openaiClient.mjs";
import { renderActivityCard } from "../design-studio/src/ov5MechanismView.js";
import { renderActivityInspector } from "../design-studio/src/ui.js";
import { buildMarkdownReport, buildReportPayload } from "../design-studio/src/reportBuilder.js";

console.log("=== 1. 测试基础引用实体规范化与双向兼容性 ===");
const rawCitation = {
  citationId: "cite-101",
  chunkId: "doc-tactics-chunk-1",
  vaultId: "doctrine-vault",
  filePath: "条令/多层反导协同规程.md",
  title: "拦截时窗与交战排序分配准则",
  snippet: "中远程防空单元应在T+02:00前完成火控交接并核验拦截通道，避免过早消耗内层弹药。",
  score: 92
};

const normCitation = normalizeCitation(rawCitation);
assert.equal(normCitation.chunkId, "doc-tactics-chunk-1");
assert.equal(normCitation.title, "拦截时窗与交战排序分配准则");
assert.equal(normCitation.score, 92);

const entity = normalizeDm2Entity({
  id: "act-air-intercept",
  title: "分层协同拦截作业",
  citations: [rawCitation]
});
assert.equal(entity.citations.length, 1);
assert.equal(entity.citations[0].chunkId, "doc-tactics-chunk-1");
assert.deepEqual(entity.evidenceRefs, ["doc-tactics-chunk-1"], "evidenceRefs 必须自动从 citations 派生以保障兼容");
console.log("✓ 实体层引用规范化通过");

console.log("=== 2. 测试服务端防幻觉防线：过滤虚假引用并补全合法引用 ===");
const openAiClient = createOpenAiClient({
  getAiServiceConfig: () => ({ model: "gpt-mock" }),
  getAiApiKey: () => "mock-key",
  getAiPromptOverrides: () => ({})
});

const candidateEvidence = [
  {
    id: "chunk-doctrine-001",
    title: "战术自组网快速入网条令",
    source: "条令/自组网协议.md",
    summary: "强电磁对抗环境下传感器节点应在3秒内完成跳频同步。"
  }
];

const mockBase = {
  outputSchema: "ActivityDecompositionDraft",
  workflowTitle: "活动分解",
  evidenceRefs: candidateEvidence,
  result: {}
};

const aiDraftWithHallucination = {
  summary: "活动分解测试草案",
  activities: [
    {
      id: "act-sub-1",
      title: "自适应跳频组网",
      type: "通信保障",
      domain: "电磁",
      citations: [
        { chunkId: "chunk-doctrine-001", snippet: "节点3秒内完成跳频同步" },
        { chunkId: "chunk-hallucinated-999", snippet: "编造的不存在条令" }
      ],
      evidenceRefs: ["chunk-doctrine-001", "chunk-hallucinated-999"]
    }
  ]
};

const merged = openAiClient.mergeAiDraft(mockBase, aiDraftWithHallucination);
const result = merged.result || merged;
const mergedAct = result.activities[0];
assert.equal(mergedAct.citations.length, 1, "幻觉/捏造的 chunkId 必须被服务端剔除丢弃");
assert.equal(mergedAct.citations[0].chunkId, "chunk-doctrine-001");
assert.equal(mergedAct.citations[0].title, "战术自组网快速入网条令", "合法引用的切片元数据应被自动补全");
assert.deepEqual(mergedAct.evidenceRefs, ["chunk-doctrine-001"], "evidenceRefs 中的虚假 ID 同样须被剔除");
console.log("✓ 服务端防幻觉过滤防线通过");

console.log("=== 3. 测试 OV-5 活动模型落库与结构保存 ===");
const ov5Model = normalizeDodafOv5({
  activities: [
    {
      id: "act-main-1",
      title: "多域预警与快速辨识",
      type: "态势感知",
      domain: "空中",
      timingWindow: "3m",
      citations: mergedAct.citations,
      refs: mergedAct.evidenceRefs
    }
  ],
  edges: []
});
assert.equal(ov5Model.activities[0].citations.length, 1);
assert.equal(ov5Model.activities[0].refs[0], "chunk-doctrine-001");
console.log("✓ OV-5 产品模型存储归一化通过");

console.log("=== 4. 测试前端视图渲染：引用 Badge 与侧边栏面板 ===");
const actCardHtml = renderActivityCard(ov5Model.activities[0], "", []);
assert(actCardHtml.includes("citation-badge"), "活动卡片右上角须渲染引用角标");
assert(actCardHtml.includes("📖 1"), "活动卡片角标须显示引用计数");
assert(actCardHtml.includes("战术自组网快速入网条令"), "活动卡片 title 须展示切片标题");

const inspectorHtml = renderActivityInspector(
  { id: "act-main-1", title: "多域预警与快速辨识", refs: ["chunk-doctrine-001"] },
  { ov5: ov5Model }
);
assert(inspectorHtml.includes("activity-citations-panel"), "Inspector 侧边栏必须展示知识溯源依据分区");
assert(inspectorHtml.includes("📖 战术自组网快速入网条令"), "Inspector 必须展示引用章节切片标题");
assert(inspectorHtml.includes("节点3秒内完成跳频同步"), "Inspector 必须呈现引用的原文摘录");
console.log("✓ 前端卡片 Badge 与侧边栏 Inspector 溯源渲染通过");

console.log("=== 5. 测试成果报告导出包含知识依据与溯源信息 ===");
const reportPayload = buildReportPayload({
  project: { title: "引用溯源测试项目", citations: [] },
  activeProjectId: "proj-citation-test",
  brief: { researchIntent: "验证引用打通", objective: "测试", approach: "测试", assumptions: "测试", expectedEffects: "测试", risk: "测试", evidenceRefs: [] },
  ov5: ov5Model,
  ov5a: {
    decompositions: [
      { parentActivityRef: "act-root", childActivityRef: "act-main-1", status: "confirmed" }
    ]
  },
  ov1: { nodes: [], edges: [] },
  ooda: { loops: [], lanes: [] },
  scenario: null,
  validationResult: null,
  collaboration: null
});
const reportMarkdown = buildMarkdownReport(reportPayload);

assert(reportMarkdown.includes("战术自组网快速入网条令"), "导出的 Markdown 报告活动表中必须包含引用切片名称");
console.log("✓ 成果报告导出溯源呈现通过");

console.log("\n=== OV-5a 作战活动知识引用溯源全链路测试 100% 通过 ===");
