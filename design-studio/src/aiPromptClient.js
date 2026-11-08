export async function getAiPrompts() {
  const response = await fetch("/api/ai-prompts", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function saveAiPrompts(overrides, note = "") {
  const response = await fetch("/api/ai-prompts", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ overrides, note })
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function rollbackAiPrompt(promptId, versionId) {
  const response = await fetch("/api/ai-prompts/rollback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ promptId, versionId })
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

async function readError(response) {
  return (await response.text()).trim() || `提示词服务返回 ${response.status}`;
}
