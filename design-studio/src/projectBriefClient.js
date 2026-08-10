const PROJECT_API_ROOT = "/api/projects";

export async function loadProjects({ includeArchived = false } = {}) { return request(`${PROJECT_API_ROOT}${includeArchived ? "?archived=true" : ""}`); }
export async function createProject(value) { return request(PROJECT_API_ROOT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) }); }
export async function updateProject(projectId, value) { return request(`${PROJECT_API_ROOT}/${encodeURIComponent(projectId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) }); }
export async function deleteProject(projectId) { return request(`${PROJECT_API_ROOT}/${encodeURIComponent(projectId)}`, { method: "DELETE" }); }

export async function loadProjectBrief(projectId) {
  return request(`/api/projects/${encodeURIComponent(projectId)}/brief`);
}

export async function getProjectRepositoryCapability(resource = "conceptBrief") {
  const health = await request("/api/health");
  return Boolean(health?.projectRepository?.[resource]);
}

export async function saveProjectBrief(projectId, { brief, direction, inspiration, directions, source, expectedRevision }) {
  return request(`/api/projects/${encodeURIComponent(projectId)}/brief`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brief, direction, inspiration, directions, source, expectedRevision })
  });
}

export async function loadProjectAudit(projectId, limit = 20) {
  return request(`${PROJECT_API_ROOT}/${encodeURIComponent(projectId)}/audit?limit=${encodeURIComponent(limit)}`);
}

export async function loadProjectCollaboration(projectId) {
  return request(`${PROJECT_API_ROOT}/${encodeURIComponent(projectId)}/collaboration`);
}

export async function loadCollaborationSession() { return request("/api/collaboration/auth/session"); }
export async function setupCollaborationAccount(value) { return request("/api/collaboration/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) }); }
export async function loginCollaboration(value) { return request("/api/collaboration/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) }); }
export async function registerCollaboration(value) { return request("/api/collaboration/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) }); }
export async function logoutCollaboration() { return request("/api/collaboration/auth/logout", { method: "POST" }); }
export async function createCollaborationAccount(value) { return request("/api/collaboration/auth/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) }); }
export async function loadCollaborationAccounts() { return request("/api/collaboration/auth/accounts"); }
export async function updateCollaborationAccount(username, value) { return request(`/api/collaboration/auth/accounts/${encodeURIComponent(username)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) }); }
export async function loadCollaborationSecurityEvents(limit = 30) { return request(`/api/collaboration/auth/security-events?limit=${encodeURIComponent(limit)}`); }

export async function createProjectCollaborationReview(projectId, value) {
  return request(`${PROJECT_API_ROOT}/${encodeURIComponent(projectId)}/collaboration/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value)
  });
}

export async function resolveProjectCollaborationReview(projectId, reviewId, value) {
  return request(`${PROJECT_API_ROOT}/${encodeURIComponent(projectId)}/collaboration/reviews/${encodeURIComponent(reviewId)}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value)
  });
}

export async function loadProjectOv5(projectId) {
  return request(`/api/projects/${encodeURIComponent(projectId)}/ov5`);
}

export async function loadProjectOv1(projectId) {
  return loadProjectModel(projectId, "ov1");
}

export async function loadProjectForceMissionPlan(projectId) {
  return loadProjectModel(projectId, "force-mission-plan");
}

export async function saveProjectForceMissionPlan(projectId, { model, source, expectedRevision }) {
  return saveProjectModel(projectId, "force-mission-plan", { model, source, expectedRevision });
}

export async function loadProjectPhaseActionConcept(projectId) {
  return loadProjectModel(projectId, "phase-action-concept");
}

export async function saveProjectPhaseActionConcept(projectId, { model, source, expectedRevision }) {
  return saveProjectModel(projectId, "phase-action-concept", { model, source, expectedRevision });
}

export async function loadProjectConceptMap(projectId) {
  return loadProjectModel(projectId, "concept-map");
}

export async function saveProjectConceptMap(projectId, { model, source, expectedRevision }) {
  return saveProjectModel(projectId, "concept-map", { model, source, expectedRevision });
}

export async function loadProjectConceptGraphicPlan(projectId) {
  return loadProjectModel(projectId, "concept-graphic-plan");
}

export async function saveProjectConceptGraphicPlan(projectId, { model, source, expectedRevision }) {
  return saveProjectModel(projectId, "concept-graphic-plan", { model, source, expectedRevision });
}

export async function saveProjectOv1(projectId, { model, source, expectedRevision }) {
  return saveProjectModel(projectId, "ov1", { model, source, expectedRevision });
}

export async function saveProjectOv5(projectId, { model, source, expectedRevision }) {
  return saveProjectModel(projectId, "ov5", { model, source, expectedRevision });
}

export async function loadProjectOv2(projectId) { return loadProjectModel(projectId, "ov2"); }
export async function saveProjectOv2(projectId, payload) { return saveProjectModel(projectId, "ov2", payload); }
export async function loadProjectOv3(projectId) { return loadProjectModel(projectId, "ov3"); }
export async function saveProjectOv3(projectId, payload) { return saveProjectModel(projectId, "ov3", payload); }
export async function loadProjectOv4(projectId) { return loadProjectModel(projectId, "ov4"); }
export async function saveProjectOv4(projectId, payload) { return saveProjectModel(projectId, "ov4", payload); }
export async function loadProjectOv5a(projectId) { return loadProjectModel(projectId, "ov5a"); }
export async function saveProjectOv5a(projectId, payload) { return saveProjectModel(projectId, "ov5a", payload); }
export async function loadProjectOv6a(projectId) { return loadProjectModel(projectId, "ov6a"); }
export async function saveProjectOv6a(projectId, payload) { return saveProjectModel(projectId, "ov6a", payload); }
export async function loadProjectOv6b(projectId) { return loadProjectModel(projectId, "ov6b"); }
export async function saveProjectOv6b(projectId, payload) { return saveProjectModel(projectId, "ov6b", payload); }
export async function loadProjectOv6c(projectId) { return loadProjectModel(projectId, "ov6c"); }
export async function saveProjectOv6c(projectId, payload) { return saveProjectModel(projectId, "ov6c", payload); }
export async function loadProjectArchitecture(projectId) { return loadProjectModel(projectId, "architecture"); }
export async function saveProjectArchitecture(projectId, payload) { return saveProjectModel(projectId, "architecture", payload); }

export async function exportProjectArchitecture(projectId, format = "json") {
  return request(`/api/projects/${encodeURIComponent(projectId)}/architecture/export?format=${encodeURIComponent(format)}`);
}

export async function importProjectArchitecture(projectId, { package: packageModel, body, format = "json", mergeStrategy = "replace-products", source, expectedRevision }) {
  return request(`/api/projects/${encodeURIComponent(projectId)}/architecture/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ package: packageModel, body, format, mergeStrategy, source, expectedRevision })
  });
}

export async function loadProjectOoda(projectId) {
  return loadProjectModel(projectId, "ooda");
}

export async function saveProjectOoda(projectId, { model, source, expectedRevision }) {
  return saveProjectModel(projectId, "ooda", { model, source, expectedRevision });
}

export async function loadProjectScenario(projectId) {
  return loadProjectModel(projectId, "scenario");
}

export async function saveProjectScenario(projectId, { model, source, expectedRevision }) {
  return saveProjectModel(projectId, "scenario", { model, source, expectedRevision });
}

export async function loadProjectValidation(projectId) {
  return loadProjectModel(projectId, "validation");
}

export async function saveProjectValidation(projectId, { model, source, expectedRevision }) {
  return saveProjectModel(projectId, "validation", { model, source, expectedRevision });
}

export async function loadProjectReportArchives(projectId) {
  return request(`/api/projects/${encodeURIComponent(projectId)}/reports`);
}

export async function createProjectReportArchive(projectId, { item, source, expectedRevision }) {
  return request(`/api/projects/${encodeURIComponent(projectId)}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item, source, expectedRevision })
  });
}

export async function deleteProjectReportArchive(projectId, reportId, { source, expectedRevision }) {
  return request(`/api/projects/${encodeURIComponent(projectId)}/reports/${encodeURIComponent(reportId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, expectedRevision })
  });
}

export async function loadProjectModelSnapshots(projectId) {
  return request(`/api/projects/${encodeURIComponent(projectId)}/model-snapshots`);
}

export async function createProjectModelSnapshot(projectId, { item, source, expectedRevision }) {
  return request(`/api/projects/${encodeURIComponent(projectId)}/model-snapshots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item, source, expectedRevision })
  });
}

export async function deleteProjectModelSnapshot(projectId, snapshotId, { source, expectedRevision }) {
  return request(`/api/projects/${encodeURIComponent(projectId)}/model-snapshots/${encodeURIComponent(snapshotId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, expectedRevision })
  });
}

async function loadProjectModel(projectId, resource) {
  return request(`/api/projects/${encodeURIComponent(projectId)}/${resource}`);
}

async function saveProjectModel(projectId, resource, { model, source, expectedRevision }) {
  return request(`/api/projects/${encodeURIComponent(projectId)}/${resource}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, source, expectedRevision })
  });
}

async function request(path, options = {}) {
  const response = await fetch(path, { headers: { Accept: "application/json", ...(options.headers || {}) }, ...options });
  if (!response.ok) {
    const raw = await response.text();
    let message = raw || `Project repository request failed (${response.status})`;
    let code = "";
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        if (parsed.error) message = String(parsed.error);
        if (parsed.code) code = String(parsed.code);
      }
    } catch {
      /* keep raw text */
    }
    const error = new Error(message);
    error.status = response.status;
    error.code = code;
    error.body = raw;
    throw error;
  }
  return response.json();
}
