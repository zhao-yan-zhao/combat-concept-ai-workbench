const STORAGE_KEY = "concept-studio-concept-map-bridge-v1";
const DEFAULT_SETTINGS = { targetUrl: "http://127.0.0.1:8765/" };

export function loadConceptMapBridge() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (typeof saved?.targetUrl === "string" && saved.targetUrl.trim()) return normalizeSettings(saved);
  } catch {
    // The fixed local editor remains available when browser settings are unavailable.
  }
  return { ...DEFAULT_SETTINGS };
}

/** Stable map-tool project id bound 1:1 to a research workbench project. */
export function boundMapProjectIdFor(workbenchProjectId) {
  const raw = String(workbenchProjectId || "default")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `workbench-${raw || "default"}`;
}

/**
 * Build combat-map-web URL for preview iframe or standalone editor.
 * mapProjectId binds one research project to one map project inside the tool.
 * workbenchPreview=1 hides symbol library / menus / object panel in the iframe only.
 *
 * Keep preview iframe URLs stable: do not put display title in the URL unless
 * includeTitle is true (standalone window). Title changes would otherwise force
 * a full tool reload whenever the workbench re-renders (e.g. open project picker).
 */
export function conceptMapEditorUrl(targetUrl, options = {}) {
  try {
    const url = new URL(targetUrl || DEFAULT_SETTINGS.targetUrl, globalThis.location?.href || "http://127.0.0.1/");
    // Strip legacy embed flags.
    url.searchParams.delete("embed");
    url.searchParams.delete("conceptMapMode");
    const mapProjectId = String(options.mapProjectId || "").trim();
    if (mapProjectId) url.searchParams.set("mapProjectId", mapProjectId);
    else url.searchParams.delete("mapProjectId");
    const title = String(options.title || "").trim().slice(0, 60);
    if (options.includeTitle && title) url.searchParams.set("title", title);
    else url.searchParams.delete("title");
    if (options.workbenchPreview) url.searchParams.set("workbenchPreview", "1");
    else url.searchParams.delete("workbenchPreview");
    // parentOrigin is for standalone editor → workbench postMessage only.
    // Do not put it on preview iframe URLs (keeps iframe src stable across re-renders).
    const parentOrigin = String(options.parentOrigin || "").trim();
    if (parentOrigin && !options.workbenchPreview) {
      try {
        url.searchParams.set("parentOrigin", new URL(parentOrigin).origin);
      } catch {
        url.searchParams.delete("parentOrigin");
      }
    } else {
      url.searchParams.delete("parentOrigin");
    }
    return url.toString();
  } catch {
    return DEFAULT_SETTINGS.targetUrl;
  }
}

/** Compare whether two editor URLs bind the same map project / preview mode. */
export function conceptMapEditorIdentity(src, baseUrl = globalThis.location?.href || "http://127.0.0.1/") {
  try {
    const url = new URL(src, baseUrl);
    return [
      url.origin,
      url.pathname,
      url.searchParams.get("mapProjectId") || "",
      url.searchParams.get("workbenchPreview") || ""
    ].join("|");
  } catch {
    return String(src || "");
  }
}

function normalizeSettings(value) {
  return { targetUrl: String(value?.targetUrl || DEFAULT_SETTINGS.targetUrl).trim() || DEFAULT_SETTINGS.targetUrl };
}
