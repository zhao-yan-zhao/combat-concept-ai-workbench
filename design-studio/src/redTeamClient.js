export async function generateRedTeamReview(input) {
  const response = await fetch("/api/red-team", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `红方服务返回 ${response.status}`);
  }
  return response.json();
}

export async function getRedTeamHealth() {
  const response = await fetch("/api/health", {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`红方服务健康检查返回 ${response.status}`);
  }
  return response.json();
}
