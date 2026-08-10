const STORAGE_KEY = "concept-studio-report-versions-v1";
const MAX_VERSIONS = 20;

export function loadReportVersions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved?.versions)) return saved.versions.filter(isVersion).slice(0, MAX_VERSIONS);
  } catch {
    // Invalid local history is treated as no archived report versions.
  }
  return [];
}

export function saveReportVersion(payload, versions = []) {
  const nextNumber = versions.reduce((highest, item) => Math.max(highest, Number(item.number) || 0), 0) + 1;
  const savedAt = new Date().toISOString();
  const version = {
    id: createVersionId(),
    number: nextNumber,
    label: `R${String(nextNumber).padStart(3, "0")}`,
    savedAt,
    title: String(payload?.project?.title || "作战概念研究"),
    scenarioId: String(payload?.scenario?.id || ""),
    reportTemplate: payload?.reportTemplate ? {
      id: String(payload.reportTemplate.id || ""),
      label: String(payload.reportTemplate.label || "")
    } : null,
    integrity: payload?.reportIntegrity ? {
      algorithm: String(payload.reportIntegrity.algorithm || ""),
      digest: String(payload.reportIntegrity.digest || ""),
      byteLength: Number(payload.reportIntegrity.byteLength || 0)
    } : null,
    maturity: {
      label: String(payload?.validationMaturity?.label || "待完善"),
      readyCount: Number(payload?.validationMaturity?.readyCount || 0),
      totalCount: Number(payload?.validationMaturity?.totalCount || 0)
    }
  };
  const snapshot = clone({
    ...payload,
    reportVersion: { id: version.id, label: version.label, savedAt: version.savedAt }
  });
  const next = [{ ...version, payload: snapshot }, ...versions.filter(isVersion)].slice(0, MAX_VERSIONS);
  persistReportVersions(next);
  return next;
}

export function deleteReportVersion(versionId, versions = []) {
  const current = versions.filter(isVersion).slice(0, MAX_VERSIONS);
  const next = current.filter((version) => version.id !== versionId);
  if (next.length === current.length) return current;
  persistReportVersions(next);
  return next;
}

export function persistReportVersions(versions = []) {
  const next = versions.filter(isVersion).slice(0, MAX_VERSIONS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ versions: next }));
  return next;
}

export function upsertReportVersion(version, versions = []) {
  if (!isVersion(version)) return persistReportVersions(versions);
  const next = [version, ...versions.filter((item) => item.id !== version.id)]
    .sort((left, right) => String(right.savedAt || "").localeCompare(String(left.savedAt || "")))
    .slice(0, MAX_VERSIONS);
  return persistReportVersions(next);
}

function isVersion(value) {
  return Boolean(value && typeof value.id === "string" && value.payload && typeof value.payload === "object");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createVersionId() {
  const randomId = globalThis.crypto?.randomUUID?.();
  return `report-version-${randomId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}
