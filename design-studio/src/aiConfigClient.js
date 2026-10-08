export async function getAiServiceConfig() {
  const response = await fetch("/api/ai-config", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function saveAiServiceConfig(config) {
  const response = await fetch("/api/ai-config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config)
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function fetchUpstreamModels(options = {}) {
  let response = await fetch("/api/ai-config/models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options)
  });

  // 如果遇到 405 (如反向代理或历史进程差异)，降级尝试 GET
  if (response.status === 405) {
    const params = new URLSearchParams();
    if (options.baseUrl) params.set("baseUrl", options.baseUrl);
    if (options.apiKey) params.set("apiKey", options.apiKey);
    const queryString = params.toString();
    response = await fetch(`/api/ai-config/models${queryString ? `?${queryString}` : ""}`, {
      method: "GET",
      headers: { Accept: "application/json" }
    });
  }

  if (!response.ok) {
    if (response.status === 405 || response.status === 404) {
      throw new Error("服务端尚未加载最新接口（HTTP 405/404）。请在控制台终端按 Ctrl+C 停止当前服务，然后重新运行 node server.mjs 即可生效。");
    }
    throw new Error(await readError(response));
  }
  return response.json();
}

async function readError(response) {
  return (await response.text()).trim() || `AI 服务返回 ${response.status}`;
}
