const STORAGE_KEY = "concept-studio-simulation-adapter-v1";

export function loadSimulationAdapterSettings() {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {});
  } catch {
    return normalizeSettings({});
  }
}

export function saveSimulationAdapterSettings(value) {
  const settings = normalizeSettings(value);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  return settings;
}

function normalizeSettings(value) {
  return {
    id: clean(value?.id, 80),
    name: clean(value?.name, 160),
    version: clean(value?.version, 80),
    enabled: Boolean(value?.enabled)
  };
}

function clean(value, maximum) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
}
