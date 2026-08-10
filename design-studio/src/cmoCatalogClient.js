async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    },
    ...options
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `请求失败（${response.status}）`);
  }
  return response.json();
}

export async function getCmoDatabaseConfig() {
  return requestJson("/api/cmo-database-config");
}

export async function saveCmoDatabaseConfig(value) {
  return requestJson("/api/cmo-database-config", {
    method: "PUT",
    body: JSON.stringify(value)
  });
}

export async function probeCmoDatabase(databasePath) {
  return requestJson("/api/cmo-database-config/probe", {
    method: "POST",
    body: JSON.stringify({ databasePath })
  });
}

export async function getCmoCatalogStatus() {
  return requestJson("/api/cmo-catalog/status");
}

export async function listCmoMissionTypesRemote() {
  const data = await requestJson("/api/cmo-catalog/mission-types");
  return Array.isArray(data.items) ? data.items : [];
}

export async function searchCmoPlatforms({ q = "", domain = "", country = "", limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (domain) params.set("domain", domain);
  if (country) params.set("country", country);
  if (limit) params.set("limit", String(limit));
  const data = await requestJson(`/api/cmo-catalog/search?${params.toString()}`);
  return Array.isArray(data.items) ? data.items : [];
}
