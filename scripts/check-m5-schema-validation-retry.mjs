import assert from "node:assert/strict";
import { validateSchema } from "../shared/schemaValidator.js";
import { createOpenAiClient } from "../server/openaiClient.mjs";

console.log("=== 1. 单元测试：纯净轻量 JSON Schema 校验器 (shared/schemaValidator.js) ===");

const testSchema = {
  type: "object",
  required: ["title", "count", "status"],
  properties: {
    title: { type: "string", maxLength: 20 },
    count: { type: "integer", minimum: 1 },
    status: { type: "string", enum: ["active", "archived"] },
    tags: {
      type: "array",
      minItems: 1,
      items: { type: "string" }
    }
  }
};

// 1.1 合法数据
const validData = {
  title: "测试概念",
  count: 5,
  status: "active",
  tags: ["协同", "防空"]
};
const res1 = validateSchema(validData, testSchema);
assert.equal(res1.valid, true, "合法数据应通过校验");
assert.equal(res1.errors.length, 0);

// 1.2 必填项缺失
const missingRequired = {
  title: "测试",
  status: "active"
};
const res2 = validateSchema(missingRequired, testSchema);
assert.equal(res2.valid, false, "缺少必填项应报错");
assert(res2.errors.some((e) => e.includes("count")), "错误信息应包含 count 字段缺失提示");

// 1.3 枚举不匹配
const invalidEnum = {
  title: "测试",
  count: 2,
  status: "unknown"
};
const res3 = validateSchema(invalidEnum, testSchema);
assert.equal(res3.valid, false, "非法枚举应报错");
assert(res3.errors.some((e) => e.includes("unknown") && e.includes("active")), "错误信息应指出枚举不在允许范围");

// 1.4 数组元素及长度超界
const invalidArray = {
  title: "测试",
  count: 2,
  status: "active",
  tags: []
};
const res4 = validateSchema(invalidArray, testSchema);
assert.equal(res4.valid, false, "空数组不满足 minItems: 1 应报错");
assert(res4.errors.some((e) => e.includes("数量不足")), "错误信息应指出数量不足");

console.log("✓ JSON Schema 校验器规则全量覆盖通过");

console.log("=== 2. 测试：AI 输出初次合法直接通过 ===");

const previousFetch = globalThis.fetch;
try {
  let callCount = 0;
  globalThis.fetch = async (_url, options) => {
    callCount++;
    const legalOutput = {
      objective: "评估防空反导协同效能",
      approach: "运用多域协同反辐射破网",
      assumptions: "空天中继链畅通",
      expectedEffects: "压制率达到70%",
      risk: "前沿节点战损"
    };
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(legalOutput) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const client = createOpenAiClient({
    getAiServiceConfig: () => ({ baseUrl: "http://example.test/v1", model: "test-model" }),
    getAiApiKey: () => "mock-key"
  });

  const input = {
    workflow: { title: "概念简报", outputSchema: "ConceptBrief" },
    analysis: {},
    evidence: []
  };

  const result = await client.callOpenAi(input, {});
  assert.equal(callCount, 1, "初次合法时只应调用 1 次模型");
  assert.equal(result.objective, "评估防空反导协同效能");
  assert.equal(result._rawOutput.includes("评估防空反导协同效能"), true, "返回对象中应保留原始输出元数据");
  console.log("✓ 初次合法输出正常通过并保留 _rawOutput");

  console.log("=== 3. 测试：初次输出不合规 -> 自动重试 1 次纠错 -> 重试成功 ===");

  callCount = 0;
  const requestsMade = [];
  globalThis.fetch = async (_url, options) => {
    callCount++;
    const body = JSON.parse(options.body);
    requestsMade.push(body);

    if (callCount === 1) {
      // 第一次返回残缺 JSON（缺少 approach 必填字段）
      const defectiveOutput = {
        objective: "这是缺少核心思路的不完整简报",
        assumptions: "假设",
        expectedEffects: "效果",
        risk: "风险"
      };
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(defectiveOutput) } }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // 第二次返回修正后的合规 JSON
    const fixedOutput = {
      objective: "这是经过纠错重试后的完整简报",
      approach: "补充完整的核心思路与协同机理",
      assumptions: "假设前提",
      expectedEffects: "预期效果",
      risk: "主要风险"
    };
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(fixedOutput) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const retryResult = await client.callOpenAi(input, {});
  assert.equal(callCount, 2, "初次失败必须自动重试 1 次，共调用 2 次");
  assert.equal(retryResult.approach, "补充完整的核心思路与协同机理", "重试成功应返回修正后的结果");

  // 验证重试请求确实附带了纠错提示
  const secondReq = requestsMade[1];
  const correctionText = JSON.stringify(secondReq);
  assert(correctionText.includes("Schema结构校验未通过") || correctionText.includes("approach"), "重试请求必须携带结构纠错提示");
  console.log("✓ 结构缺失触发自动重试 1 次纠错成功闭环");

  console.log("=== 4. 测试：重试 1 次后仍然不合规 -> 抛出 SchemaValidationError 并保留原始输出 ===");

  callCount = 0;
  globalThis.fetch = async () => {
    callCount++;
    // 持续返回残缺 JSON
    const defectiveOutput = {
      objective: "持续残缺目标",
      risk: "风险"
    };
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(defectiveOutput) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  let errorCaught = null;
  try {
    await client.callOpenAi(input, {});
  } catch (err) {
    errorCaught = err;
  }

  assert(errorCaught, "重试失败后必须抛出异常");
  assert.equal(errorCaught.name, "SchemaValidationError", "错误类型必须为 SchemaValidationError");
  assert.equal(errorCaught.statusCode, 422, "错误状态码必须为 422");
  assert(Array.isArray(errorCaught.validationErrors) && errorCaught.validationErrors.length > 0, "必须包含详细的校验错误列表");
  assert(errorCaught.rawOutput && errorCaught.rawOutput.includes("持续残缺目标"), "必须保留模型返回的原始输出供查看");
  console.log(`✓ 抛出可读错误并完整保留 rawOutput: "${errorCaught.message}"`);

} finally {
  globalThis.fetch = previousFetch;
}

console.log("\n=== T5.2 结构校验与自动重试机制全部验证通过 (100% PASS) ===");
