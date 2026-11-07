// @ts-check
import assert from "node:assert/strict";
import { normalizeDm2Entity } from "../shared/dodaf/entities.js";
import { createOpenAiClient } from "../server/openaiClient.mjs";

console.log("=== T2.2 OV-5 活动分解试点测试 (check-citation-ov5-pilot) ===");

// 1. 测试合法引用保留与 origin: "cited"
const validEvidence = [
  { id: "chunk-rule-01", chunkId: "chunk-rule-01", title: "防空截击规范", source: "作战条令/防空.md", summary: "拦截火控分配原则" },
  { id: "chunk-recon-02", chunkId: "chunk-recon-02", title: "预警侦察规程", source: "作战条令/侦察.md", summary: "前出侦察与雷达接力" }
];

// 创建 mock openai client 实例测试服务端 sanitize 行为
const client = createOpenAiClient({
  getAiServiceConfig: () => ({ enabled: true, provider: "mock", model: "mock-model" }),
  getAiApiKey: () => "mock-key",
  getAiPromptOverrides: () => ({})
});
assert(typeof client.sanitizeActivityDecompositionCitations === "function", "必须提供 sanitizeActivityDecompositionCitations 接口");

// 模拟调用测试: 覆盖三种情况
// Case 1: 引用合法 -> 保留，打标 origin: "cited"
const mockAiDraftLegal = {
  activities: [
    {
      id: "act-1",
      title: "雷达前出预警",
      citations: [{ chunkId: "chunk-recon-02", snippet: "前出侦察接力" }]
    }
  ]
};

const sanitizedLegal = client.sanitizeActivityDecompositionCitations(mockAiDraftLegal, validEvidence);
assert.equal(sanitizedLegal.activities[0].citations.length, 1, "合法引用必须保留");
assert.equal(sanitizedLegal.activities[0].citations[0].chunkId, "chunk-recon-02");
assert.equal(sanitizedLegal.activities[0].origin, "cited", "有合法引用时 origin 必须为 cited");
console.log("✓ Case 1: 引用合法 -> 保留并标记 origin: 'cited' 验证通过");

// Case 2: 引用了编造的 chunkId -> 必须丢弃，打标 origin: "ai-inferred"
const mockAiDraftFake = {
  activities: [
    {
      id: "act-2",
      title: "虚构拦截策略",
      citations: [{ chunkId: "fake-hallucinated-chunk-999", snippet: "编造的不存在条令" }]
    }
  ]
};

const sanitizedFake = client.sanitizeActivityDecompositionCitations(mockAiDraftFake, validEvidence);
assert.equal(sanitizedFake.activities[0].citations.length, 0, "编造的 chunkId 必须被服务端安全过滤丢弃！");
assert.equal(sanitizedFake.activities[0].origin, "ai-inferred", "引用被丢弃后 origin 必须退化为 ai-inferred");
console.log("✓ Case 2: 编造引用 -> 安全丢弃并标记 origin: 'ai-inferred' 验证通过");

// Case 3: 完全没有引用 -> 标记 origin: "ai-inferred"
const mockAiDraftNone = {
  activities: [
    {
      id: "act-3",
      title: "常规机动集结",
      citations: []
    }
  ]
};

const sanitizedNone = client.sanitizeActivityDecompositionCitations(mockAiDraftNone, validEvidence);
assert.equal(sanitizedNone.activities[0].citations.length, 0);
assert.equal(sanitizedNone.activities[0].origin, "ai-inferred", "无引用活动标记为 ai-inferred");
console.log("✓ Case 3: 无引用 -> 标记 origin: 'ai-inferred' 验证通过");

// Case 4: 人工编辑过/新增的实体 -> 保持 origin: "human"
const entityHuman = normalizeDm2Entity({
  id: "act-4",
  name: "指挥官特设巡逻线",
  origin: "human",
  citations: []
});
assert.equal(entityHuman.origin, "human", "人工编辑的要素必须维持 origin: 'human'");
console.log("✓ Case 4: 人工修改 -> 标记 origin: 'human' 验证通过");

console.log("\n=== T2.2 OV-5 试点所有断言 100% 通过 ===");
