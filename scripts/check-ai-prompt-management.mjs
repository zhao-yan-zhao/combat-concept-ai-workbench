import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createOpenAiClient } from "../server/openaiClient.mjs";
import { loadAiPromptOverrides, saveAiPromptOverrides } from "../server/aiPromptConfig.mjs";

const root = await mkdtemp(join(tmpdir(), "workbench-prompts-"));
const configPath = join(root, "ai-prompts.json");
try {
  const overrides = await saveAiPromptOverrides({ configPath, value: { overrides: { "ai.generate.generic": "自定义通用提示词" } } });
  assert.deepEqual(await loadAiPromptOverrides({ configPath }), overrides);

  let requestBody;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ output_text: JSON.stringify({ summary: "ok", sections: [], bullets: [], risks: [] }) }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const client = createOpenAiClient({
      getAiServiceConfig: () => ({ baseUrl: "http://example.test/v1", model: "test" }),
      getAiApiKey: () => "not-a-real-key",
      getAiPromptOverrides: () => overrides
    });
    const items = client.listPromptDefinitions();
    assert.equal(items.length, 18);
    assert.equal(items.find((item) => item.id === "ai.generate.generic")?.customized, true);
    assert.equal(items.find((item) => item.id === "ai.generate.phase-action")?.variables.includes("analysis"), true);
    assert.equal(items.find((item) => item.id === "ai.generate.task-organization")?.variables.includes("analysis"), true);
    await client.callOpenAi({ workflow: { title: "测试", outputSchema: "UnknownDraft" }, analysis: {}, evidence: [] }, { workflowTitle: "测试", outputSchema: "UnknownDraft" });
    assert.match(requestBody.input, /^自定义通用提示词\n当前工作流：/);
  } finally {
    globalThis.fetch = previousFetch;
  }

  const [html, agents, handler] = await Promise.all([
    readFile(new URL("../design-studio/index.html", import.meta.url), "utf8"),
    readFile(new URL("../AGENTS.md", import.meta.url), "utf8"),
    readFile(new URL("../server/createRequestHandler.mjs", import.meta.url), "utf8")
  ]);
  assert.match(html, /data-action="open-ai-prompts"/);
  assert.match(handler, /\/api\/ai-prompts/);
  assert.match(agents, /不得新增无法在该目录浏览和编辑的隐藏提示词/);
  console.log("AI prompt management checks passed");
} finally {
  await rm(root, { recursive: true, force: true });
}
