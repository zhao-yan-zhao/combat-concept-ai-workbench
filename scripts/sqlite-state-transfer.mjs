const stores = {
  project: { kind: "project", label: "project repository", table: "project_repository_state", isValid: (value) => Boolean(value && typeof value === "object" && value.projects && typeof value.projects === "object") },
  identity: { kind: "identity", label: "collaboration identity", table: "collaboration_identity_store", isValid: (value) => Boolean(value && typeof value === "object" && Array.isArray(value.users) && Array.isArray(value.events)) }
};

export function resolveStore(kind) {
  const store = stores[String(kind || "").trim()];
  if (!store) throw new Error("SQLite state kind must be project or identity");
  return store;
}

export function readSqliteState(database, store) {
  const row = database.prepare(`SELECT payload FROM ${store.table} WHERE id = 1`).get();
  if (!row?.payload) throw new Error(`Source ${store.label} SQLite state is empty`);
  const payload = JSON.parse(row.payload);
  if (!validatePayload(payload, store)) throw new Error(`Source ${store.label} SQLite state has an invalid shape`);
  return payload;
}

export function validatePayload(payload, store) { return Boolean(store?.isValid(payload)); }
