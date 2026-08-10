const MAX_EXPORT_ENTRIES = 200;

export function buildProjectAuditArtifact({ projectId = "default", entries = [], exportedAt = new Date().toISOString() } = {}) {
  const items = (Array.isArray(entries) ? entries : []).slice(0, MAX_EXPORT_ENTRIES).map((entry) => ({
    id: text(entry.id, 180),
    revision: Math.max(0, Number(entry.revision) || 0),
    action: text(entry.action, 100),
    source: text(entry.source, 80),
    actor: entry.actor?.id ? {
      id: text(entry.actor.id, 80),
      label: text(entry.actor.label || entry.actor.id, 120),
      roles: [...new Set((Array.isArray(entry.actor.roles) ? entry.actor.roles : []).map(String).filter((role) => ["researcher", "reviewer", "lead"].includes(role)))].slice(0, 3)
    } : null,
    occurredAt: text(entry.occurredAt, 80),
    summary: text(entry.summary, 1200),
    lineage: Object.fromEntries(["briefRevision", "ov1Revision", "ov5Revision", "oodaRevision", "scenarioRevision", "validationRevision"].filter((key) => entry[key] !== undefined).map((key) => [key, Math.max(0, Number(entry[key]) || 0)]))
  }));
  return {
    content: JSON.stringify({ schema: "combat-concept-project-audit-v1", projectId: text(projectId, 80), exportedAt: text(exportedAt, 80), entryCount: items.length, entries: items }, null, 2),
    filename: `combat-concept-project-audit-${text(projectId, 80) || "default"}.json`,
    mime: "application/json;charset=utf-8",
    label: "项目审计 JSON"
  };
}

function text(value, maximum) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum); }
