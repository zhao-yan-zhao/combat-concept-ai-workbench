import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  loadAllCases,
  getCasesByCategory,
  getCasesByPromptId,
  getCaseById,
  validateGoldenCase
} from "../eval/caseLoader.mjs";

console.log("=== 1. 静态目录与文件覆盖核对 ===");

const casesRoot = path.resolve("eval/cases");
assert(fs.existsSync(casesRoot), "eval/cases 目录必须存在");

const promptDirs = fs.readdirSync(casesRoot).filter((d) => fs.statSync(path.join(casesRoot, d)).isDirectory());
console.log(`已发现提示词评测目录 (${promptDirs.length} 个):`, promptDirs);

const expectedPromptIds = [
  "ai.generate.concept-brief",
  "ai.generate.force-mission",
  "ai.generate.activity-decomposition",
  "ai.generate.ov1-graphic",
  "ai.generate.scenario",
  "ai.generate.phase-action"
];

for (const pid of expectedPromptIds) {
  assert(promptDirs.includes(pid), `必须覆盖核心提示词评测目录: ${pid}`);
}
console.log("✓ 核心提示词评测目录结构完整");

console.log("=== 2. 全量 30 条黄金评测用例与分类断言 ===");

const allCases = loadAllCases();
assert.equal(allCases.length, 30, `黄金用例库总条数必须恰好为 30 条，当前实际载入: ${allCases.length}`);

const tacticCases = getCasesByCategory("tactic");
const mechanismCases = getCasesByCategory("mechanism");
const scenarioCases = getCasesByCategory("scenario");

assert.equal(tacticCases.length, 10, `战法类 (tactic) 黄金用例必须恰好为 10 条，实际为: ${tacticCases.length}`);
assert.equal(mechanismCases.length, 10, `机理类 (mechanism) 黄金用例必须恰好为 10 条，实际为: ${mechanismCases.length}`);
assert.equal(scenarioCases.length, 10, `想定类 (scenario) 黄金用例必须恰好为 10 条，实际为: ${scenarioCases.length}`);

console.log(`✓ 用例分类数量严格达标: 战法 ${tacticCases.length} 条、机理 ${mechanismCases.length} 条、想定 ${scenarioCases.length} 条 (总计 30 条)`);

console.log("=== 3. 用例内部契约与黄金参考输出有效性核查 ===");

const seenIds = new Set();
for (const c of allCases) {
  assert(!seenIds.has(c.id), `用例 ID 重复: ${c.id}`);
  seenIds.add(c.id);

  // 严格校验单用例结构
  assert.doesNotThrow(() => validateGoldenCase(c), `用例 [${c.id}] 校验失败`);

  // 检验输入 payload 规范
  assert(c.input && c.input.workflow && c.input.analysis, `用例 [${c.id}] input 结构不合规`);
  assert(c.input.workflow.outputSchema, `用例 [${c.id}] 缺少 outputSchema`);

  // 检验预期断言字段
  assert(Array.isArray(c.expectedAssertions.requiredFields) && c.expectedAssertions.requiredFields.length > 0, `用例 [${c.id}] 缺少必填字段断言`);
  assert(Array.isArray(c.expectedAssertions.negativeKeywords), `用例 [${c.id}] 缺少黑名单词汇断言`);

  // 检验黄金参考输出
  assert(typeof c.goldenReference === "object" && c.goldenReference !== null, `用例 [${c.id}] 缺少黄金参考输出`);

  // 检验关键词断言是否与黄金参考一致（黄金数据本身应能通过白名单断言）
  const goldenStr = JSON.stringify(c.goldenReference);
  if (Array.isArray(c.expectedAssertions.keywords)) {
    for (const kw of c.expectedAssertions.keywords) {
      assert(goldenStr.includes(kw), `用例 [${c.id}] 的黄金参考输出未包含预期关键词: ${kw}`);
    }
  }

  // 检验黑名单断言（黄金数据绝不能包含黑名单词汇）
  for (const nkw of c.expectedAssertions.negativeKeywords) {
    assert(!goldenStr.includes(nkw), `用例 [${c.id}] 的黄金参考输出违规包含黑名单词汇: ${nkw}`);
  }
}
console.log("✓ 全部 30 条黄金用例契约合法、预期断言有效、黑白名单核验 100% 通过");

console.log("=== 4. 辅助检索与定位接口验证 ===");

const specificCase = getCaseById("tactic-brief-01");
assert(specificCase && specificCase.name === "多域协同防空压制概念简报", "getCaseById 检索失败");

const forceCases = getCasesByPromptId("ai.generate.force-mission");
assert(forceCases.length === 6, `ai.generate.force-mission 应有 6 条用例，实际: ${forceCases.length}`);

const ov1Cases = getCasesByPromptId("ai.generate.ov1-graphic");
assert(ov1Cases.length === 5, `ai.generate.ov1-graphic 应有 5 条用例，实际: ${ov1Cases.length}`);

console.log("✓ 用例检索与多维筛选接口全部通过");

console.log("\n=== T5.1 评测集扩充（30 条黄金用例）全部通过 (100% PASS) ===");
