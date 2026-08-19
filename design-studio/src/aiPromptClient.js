export async function getAiPrompts() {
  const response = await fetch("/api/ai-prompts", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function saveAiPrompts(overrides) {
  const response = await fetch("/api/ai-prompts", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ overrides })
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

async function readError(response) {
  return (await response.text()).trim() || `提示词服务返回 ${response.status}`;
}
