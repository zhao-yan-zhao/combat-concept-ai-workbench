export function clean(value, maximum = 4000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

export function clampNumber(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export function normalizeStringList(value, maximumItems = 60, maximumLength = 240) {
  return (Array.isArray(value) ? value : [])
    .map((item) => clean(item, maximumLength))
    .filter(Boolean)
    .slice(0, maximumItems);
}

export function uniqueIds(values, maximum = 200) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const id = clean(value, 160);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= maximum) break;
  }
  return result;
}

export function stableId(value) {
  let hash = 5381;
  for (const character of String(value)) hash = ((hash << 5) + hash) ^ character.charCodeAt(0);
  return (hash >>> 0).toString(36);
}

export function nowIso(value) {
  const text = clean(value, 80);
  if (text) return text;
  return new Date().toISOString();
}
