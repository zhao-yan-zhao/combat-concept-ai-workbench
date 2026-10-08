import http from "node:http";
import { createOpenAiClient } from "../server/openaiClient.mjs";
import { renderAiConfigPanel } from "../design-studio/src/aiConfigView.js";
import { fetchUpstreamModels as clientFetchUpstreamModels } from "../design-studio/src/aiConfigClient.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// 1. 验证 client 导出
assert(typeof clientFetchUpstreamModels === "function", "aiConfigClient 必须导出 fetchUpstreamModels 函数");

// 2. 验证前端面板渲染
const panelHtml = renderAiConfigPanel({
  open: true,
  service: {
    status: "ready",
    config: {
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-5.5",
      configured: true,
      configurationWrite: { enabled: true }
    }
  },
  fetchedModels: ["model-alpha", "model-beta"],
  modelFetchHint: "已获取 2 个可用模型"
});

assert(panelHtml.includes('data-action="fetch-upstream-models"'), "面板应包含获取上游模型按钮");
assert(panelHtml.includes('id="aiConfigModelSelect"'), "面板应渲染模型 select 标准下拉框");
assert(panelHtml.includes('name="model"'), "面板应包含保存模型字段的 input");
assert(panelHtml.includes('<option value="model-alpha"'), "下拉选项应包含 model-alpha");
assert(panelHtml.includes("自定义模型名称..."), "下拉选项应包含自定义模型名称选项");
assert(panelHtml.includes("已获取 2 个可用模型"), "面板应渲染提示文案");

// 3. 验证后端 fetchUpstreamModels 逻辑与 HTTP 服务交互
let authHeaderReceived = "";
const mockServer = http.createServer((req, res) => {
  if (req.url === "/v1/models" && req.method === "GET") {
    authHeaderReceived = req.headers.authorization || "";
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      object: "list",
      data: [
        { id: "text-embedding-3-small" },
        { id: "gpt-5.5" },
        { id: "gemini-3.8-flash-high" },
        { id: "deepseek-chat" }
      ]
    }));
    return;
  }
  res.writeHead(404);
  res.end("Not Found");
});

await new Promise((resolve) => mockServer.listen(0, "127.0.0.1", resolve));
const { port } = mockServer.address();
const mockBaseUrl = `http://127.0.0.1:${port}/v1`;

try {
  const client = createOpenAiClient({
    getAiServiceConfig: () => ({ baseUrl: mockBaseUrl, model: "gpt-5.5" }),
    getAiApiKey: () => "test-secret-key"
  });

  assert(typeof client.fetchUpstreamModels === "function", "createOpenAiClient 必须暴露 fetchUpstreamModels 方法");

  const result = await client.fetchUpstreamModels({
    baseUrl: mockBaseUrl
  });

  assert(authHeaderReceived === "Bearer test-secret-key", "必须携带 Authorization Bearer 头");
  assert(result.count === 4, `期望获取 4 个模型，实际获取 ${result.count}`);
  assert(Array.isArray(result.models), "返回 models 必须为数组");
  // 验证排序：chat 模型应该排在 text-embedding 之前
  const embeddingIndex = result.models.indexOf("text-embedding-3-small");
  const gptIndex = result.models.indexOf("gpt-5.5");
  assert(gptIndex < embeddingIndex, "对话模型必须排在嵌入模型之前");

  // 验证空 baseUrl 报错
  let emptyError = null;
  try {
    await client.fetchUpstreamModels({ baseUrl: "" });
  } catch (err) {
    emptyError = err;
  }
  assert(emptyError !== null, "空 Base URL 应该抛出异常");

  console.log("PASS check-ai-upstream-models: 所有断言通过！");
} finally {
  await new Promise((resolve) => mockServer.close(resolve));
}
