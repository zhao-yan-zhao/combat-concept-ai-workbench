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

async function readError(response) {
  return (await response.text()).trim() || `AI 服务返回 ${response.status}`;
}
