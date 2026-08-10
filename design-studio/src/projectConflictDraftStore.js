const STORAGE_KEY = "combat-concept-project-conflict-drafts-v1";
const MAX_DRAFT_BYTES = 768 * 1024;
const MAX_DRAFTS = 6;

export function saveProjectConflictDraft({ resource, model, projectRevision = 0 }) {
  const normalizedResource = cleanResource(resource);
  if (!normalizedResource || model == null) return null;
  const serialized = JSON.stringify(model);
  if (serialized.length > MAX_DRAFT_BYTES) return null;
  const drafts = readAll();
  const savedAt = new Date().toISOString();
  drafts[normalizedResource] = { resource: normalizedResource, projectRevision: Number(projectRevision || 0), savedAt, model: JSON.parse(serialized) };
  const bounded = Object.values(drafts)
    .sort((left, right) => String(right.savedAt).localeCompare(String(left.savedAt)))
    .slice(0, MAX_DRAFTS)
    .reduce((result, draft) => ({ ...result, [draft.resource]: draft }), {});
  writeAll(bounded);
  return bounded[normalizedResource] || null;
}

export function loadProjectConflictDraft(resource) {
  const draft = readAll()[cleanResource(resource)];
  return draft ? clone(draft) : null;
}

export function getProjectConflictDraftState(resource) {
  const draft = loadProjectConflictDraft(resource);
  return draft ? { conflictDraftAvailable: true, conflictDraftSavedAt: draft.savedAt } : {};
}

function readAll() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.values(parsed).reduce((result, draft) => {
      const resource = cleanResource(draft?.resource);
      if (!resource || !draft?.savedAt || draft?.model === undefined) return result;
      return { ...result, [resource]: { resource, projectRevision: Number(draft.projectRevision || 0), savedAt: String(draft.savedAt), model: draft.model } };
    }, {});
  } catch {
    return {};
  }
}

function writeAll(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Local recovery is best-effort; the normal model store remains authoritative.
  }
}

function cleanResource(value) {
  const resource = String(value || "").trim();
  return /^[a-z0-9-]{1,32}$/i.test(resource) ? resource : "";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
