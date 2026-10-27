/**
 * One-shot browser cache purge for workbench localStorage/sessionStorage.
 * Server SQLite can be empty while old project IDs still hydrate from the browser.
 */
const EPOCH_KEY = "combat-concept-client-storage-epoch";
/** Bump this when intentionally wiping all local workbench drafts. */
export const CLIENT_STORAGE_EPOCH = "wipe-2026-08-11-full-3";

const KEY_PREFIXES = [
  "concept-studio-",
  "combat-concept-",
  "combat-concept-project-"
];

function shouldPurgeKey(key) {
  if (!key || key === EPOCH_KEY) return false;
  return KEY_PREFIXES.some((prefix) => key === prefix || key.startsWith(prefix));
}

function clearMatchingKeys(storage) {
  if (!storage) return [];
  const removed = [];
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!shouldPurgeKey(key)) continue;
    storage.removeItem(key);
    removed.push(key);
  }
  return removed;
}

/**
 * Clears workbench local/session storage when the epoch is stale or force=true.
 * Returns whether a purge ran.
 */
export function ensureClientStoragePurged({ force = false } = {}) {
  try {
    if (typeof localStorage === "undefined") return { purged: false, removed: [] };
    const params = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
    const forceByQuery = params?.get("purgeLocal") === "1" || params?.get("purgeLocal") === "true";
    const current = localStorage.getItem(EPOCH_KEY);
    if (!force && !forceByQuery && current === CLIENT_STORAGE_EPOCH) {
      return { purged: false, removed: [] };
    }

    const removed = [
      ...clearMatchingKeys(localStorage),
      ...clearMatchingKeys(typeof sessionStorage !== "undefined" ? sessionStorage : null)
    ];
    localStorage.setItem(EPOCH_KEY, CLIENT_STORAGE_EPOCH);
    return { purged: true, removed };
  } catch {
    return { purged: false, removed: [] };
  }
}

/**
 * Clears cached drafts belonging to a specific project from browser storage.
 */
export function purgeProjectClientStorage(projectId) {
  try {
    if (typeof localStorage === "undefined") return [];
    try {
      localStorage.removeItem("combat-concept-project-conflict-drafts-v1");
    } catch {
      /* ignore */
    }
    const targetScope = String(projectId || "default");
    const storages = [localStorage, typeof sessionStorage !== "undefined" ? sessionStorage : null].filter(Boolean);
    const removed = [];
    for (const storage of storages) {
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (!key || key === EPOCH_KEY) continue;
        const isProjectScoped =
          key.endsWith(`:${targetScope}`) ||
          key.includes(`:${targetScope}:`) ||
          (targetScope === "default" && KEY_PREFIXES.some((prefix) => key.startsWith(prefix)) && !key.includes(":"));
        if (isProjectScoped) {
          storage.removeItem(key);
          removed.push(key);
        }
      }
    }
    return removed;
  } catch {
    return [];
  }
}
