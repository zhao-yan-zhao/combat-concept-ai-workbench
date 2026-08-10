const STORAGE_KEY = "concept-studio-deployment-bridge-v1";
const DEFAULT_SETTINGS = { targetUrl: "http://127.0.0.1:8765/" };

export function loadDeploymentBridge() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (typeof saved?.targetUrl === "string" && saved.targetUrl.trim()) return normalizeSettings(saved);
  } catch {
    // Invalid local bridge settings use the bundled deployment tool demo.
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveDeploymentBridge(settings) {
  const next = normalizeSettings(settings);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function resolveTargetOrigin(targetUrl, baseUrl = globalThis.location?.href || "http://127.0.0.1/") {
  try {
    const origin = new URL(targetUrl, baseUrl).origin;
    return origin === "null" ? "" : origin;
  } catch {
    return "";
  }
}

function normalizeSettings(settings) {
  return { targetUrl: String(settings?.targetUrl || DEFAULT_SETTINGS.targetUrl).trim() || DEFAULT_SETTINGS.targetUrl };
}
