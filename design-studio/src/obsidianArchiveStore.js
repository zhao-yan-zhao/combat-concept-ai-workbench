const STORAGE_KEY = "concept-studio-obsidian-archive-v1";

export function loadObsidianArchiveRecord() {
  try {
    return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return null;
  }
}

export function saveObsidianArchiveRecord(record) {
  const normalized = normalize(record);
  if (!normalized) return null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Archive metadata is a convenience indicator and must not block a completed write.
  }
  return normalized;
}

function normalize(value) {
  const fileName = clean(value?.fileName);
  const directoryName = clean(value?.directoryName);
  const folderName = clean(value?.folderName);
  const fileCount = Number(value?.fileCount);
  const archivedAt = clean(value?.archivedAt);
  if (!fileName || !directoryName || !archivedAt) return null;
  return {
    fileName: fileName.slice(0, 160),
    directoryName: directoryName.slice(0, 120),
    folderName: folderName.slice(0, 120),
    fileCount: Number.isFinite(fileCount) ? Math.max(1, Math.min(200, Math.floor(fileCount))) : 1,
    archivedAt
  };
}

function clean(value) {
  return String(value || "").trim();
}
