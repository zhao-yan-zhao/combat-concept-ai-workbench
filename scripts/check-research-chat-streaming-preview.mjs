import assert from "node:assert/strict";
import { extractAdvicePreview, unescapeJsonString } from "../server/routes/aiRoutes.mjs";
import { createOpenAiClient } from "../server/openaiClient.mjs";
import { readFile } from "node:fs/promises";

// 1. Verify extractAdvicePreview behavior with complete, partial, and streaming chunks
{
  // Complete summary
  assert.equal(
    extractAdvicePreview('{"summary": "阶段链已调整为4个阶段，强化突防与干扰协同。"}'),
    "阶段链已调整为4个阶段，强化突防与干扰协同。"
  );

  // Complete answer / explanation
  assert.equal(
    extractAdvicePreview('{"explanation": "围绕预警机配属2架歼-16护航编组。"}'),
    "围绕预警机配属2架歼-16护航编组。"
  );

  // In-progress partial stream
  assert.equal(
    extractAdvicePreview('{"summary": "正在按要求调整阶段2'),
    "正在按要求调整阶段2"
  );

  // Partial stream with escaped characters
  assert.equal(
    extractAdvicePreview('{"summary": "第一阶段：展开\\n第二阶段：突防'),
    "第一阶段：展开\n第二阶段：突防"
  );

  // Partial stream with trailing single backslash (incomplete escape)
  assert.equal(
    extractAdvicePreview('{"summary": "阶段转换条件测试\\'),
    "阶段转换条件测试"
  );

  // Empty when no summary/answer
  assert.equal(extractAdvicePreview('{"phases": []}'), "");
}

// 2. Verify unescapeJsonString
{
  assert.equal(unescapeJsonString("abc\\ndef"), "abc\ndef");
  assert.equal(unescapeJsonString("quote \\\"test\\\""), 'quote "test"');
  assert.equal(unescapeJsonString("slash \\\\ test"), "slash \\ test");
  assert.equal(unescapeJsonString("trailing slash\\"), "trailing slash");
}

// 3. Verify server/openaiClient.mjs schema and prompts
{
  const client = createOpenAiClient({
    getAiServiceConfig: () => ({ baseUrl: "http://example.test/v1", model: "test" }),
    getAiApiKey: () => "mock-key",
    getAiPromptOverrides: () => ({})
  });

  const promptItems = client.listPromptDefinitions();
  const phaseActionPrompt = promptItems.find((p) => p.id === "ai.generate.phase-action");
  assert.ok(phaseActionPrompt, "ai.generate.phase-action prompt must exist");
  assert.match(phaseActionPrompt.defaultContent, /"summary":\s*"1-3 句中文说明/);

  const forceMissionPrompt = promptItems.find((p) => p.id === "ai.generate.force-mission");
  assert.ok(forceMissionPrompt, "ai.generate.force-mission prompt must exist");
  assert.match(forceMissionPrompt.defaultContent, /"summary":\s*"1-3 句中文说明/);

  // Inspect source of schemas to ensure summary is required
  const openaiClientSrc = await readFile(new URL("../server/openaiClient.mjs", import.meta.url), "utf8");
  assert.match(openaiClientSrc, /function phaseActionConceptSchema\(\)\s*\{[\s\S]*?required:\s*\["summary",\s*"phases"/);
  assert.match(openaiClientSrc, /function forceMissionPlanSchema\(\)\s*\{[\s\S]*?required:\s*\["summary",\s*"forces"/);
}

// 4. Verify phaseActionChatController and forceMissionChatController source implementations
{
  const phaseChatSrc = await readFile(new URL("../design-studio/src/phaseActionChatController.js", import.meta.url), "utf8");
  assert.match(phaseChatSrc, /response\.result\?\.summary/);
  assert.match(phaseChatSrc, /formatRevisionAdvice\(question,\s*state\.phaseAction\)/);

  const forceChatSrc = await readFile(new URL("../design-studio/src/forceMissionChatController.js", import.meta.url), "utf8");
  assert.match(forceChatSrc, /response\.result\?\.summary/);
  assert.match(forceChatSrc, /formatRevisionAdvice\(question,\s*state\.forceMission\)/);
}

console.log("Research chat streaming preview and AI summary checks passed successfully");
