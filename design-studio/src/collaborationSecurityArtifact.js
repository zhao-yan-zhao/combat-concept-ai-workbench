const MAX_EVENTS = 120;

export function buildCollaborationSecurityArtifact({ events = [], exportedAt = new Date().toISOString() } = {}) {
  const items = (Array.isArray(events) ? events : []).slice(0, MAX_EVENTS).map((event) => ({
    id: clean(event?.id, 120),
    action: clean(event?.action, 80),
    occurredAt: clean(event?.occurredAt, 80),
    actor: publicActor(event?.actor),
    subject: publicActor(event?.subject)
  })).filter((event) => event.id && event.action && event.actor && event.subject);
  return {
    content: JSON.stringify({ schema: "combat-concept-collaboration-security-events-v1", exportedAt: clean(exportedAt, 80), eventCount: items.length, events: items }, null, 2),
    filename: "combat-concept-collaboration-security-events.json",
    mime: "application/json;charset=utf-8",
    label: "协同安全事件 JSON"
  };
}

function publicActor(value) {
  const id = clean(value?.id, 160);
  if (!id) return null;
  return { id, label: clean(value?.label || id, 80), roles: [...new Set((Array.isArray(value?.roles) ? value.roles : []).map(String).filter((role) => ["researcher", "reviewer", "lead"].includes(role)))].slice(0, 3) };
}
function clean(value, maximum) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum); }
