const PROJECT_API_ROOT = "/api/projects";

export async function loadProjectKnowledge(projectId) {
  return request(`${PROJECT_API_ROOT}/${encodeURIComponent(projectId)}/knowledge`);
}

export async function saveProjectKnowledge(projectId, { model, source, expectedRevision }) {
  return request(`${PROJECT_API_ROOT}/${encodeURIComponent(projectId)}/knowledge`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, source, expectedRevision })
  });
}

export async function searchProjectKnowledge(projectId, query, limit = 4, mode = "", includeSensitive = false) {
  const params = new URLSearchParams({ q: String(query || ""), limit: String(limit) });
  if (mode) params.set("mode", String(mode));
  if (includeSensitive) params.set("includeSensitive", "true");
  return request(`${PROJECT_API_ROOT}/${encodeURIComponent(projectId)}/knowledge/search?${params}`);
}

export async function loadKnowledgeCitationApprovals(projectId) {
  return request(`${PROJECT_API_ROOT}/${encodeURIComponent(projectId)}/knowledge/sensitivity-approvals`);
}

export async function createKnowledgeCitationApproval(projectId, value) {
  return request(`${PROJECT_API_ROOT}/${encodeURIComponent(projectId)}/knowledge/sensitivity-approvals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
}

export async function revokeKnowledgeCitationApproval(projectId, approvalId, value) {
  return request(`${PROJECT_API_ROOT}/${encodeURIComponent(projectId)}/knowledge/sensitivity-approvals/${encodeURIComponent(approvalId)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
}

async function request(path, options = {}) {
  const response = await fetch(path, { headers: { Accept: "application/json", ...(options.headers || {}) }, ...options });
  if (!response.ok) {
    const error = new Error(await response.text() || `Knowledge repository request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}
