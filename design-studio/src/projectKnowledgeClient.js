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

const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

async function request(path, options = {}) {
  const timeoutMs = Number(options.timeoutMs) || DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const callerSignal = options.signal;
  let timer = null;

  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      callerSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  if (timeoutMs > 0) {
    timer = setTimeout(() => {
      controller.abort(new Error(`请求超时`));
    }, timeoutMs);
  }

  try {
    const fetchOptions = {
      ...options,
      headers: { Accept: "application/json", ...(options.headers || {}) },
      signal: controller.signal
    };
    delete fetchOptions.timeoutMs;
    const response = await fetch(path, fetchOptions);
    if (!response.ok) {
      const error = new Error(await response.text() || `Knowledge repository request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`知识库请求超时（${Math.round(timeoutMs / 1000)}秒内未收到响应）`);
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
