const TRUSTED_PROJECT_WRITE_ACTORS = new WeakMap();

export function registerProjectWriteActor(input, actor) {
  if (!input || !actor) return;
  TRUSTED_PROJECT_WRITE_ACTORS.set(input, normalizeActor(actor));
}

export function getProjectWriteActor(input) {
  return TRUSTED_PROJECT_WRITE_ACTORS.get(input) || null;
}

function normalizeActor(actor) {
  const permittedRoles = ["researcher", "reviewer", "lead"];
  return {
    id: String(actor.id || "").slice(0, 80),
    label: String(actor.label || actor.id || "").slice(0, 120),
    roles: Array.isArray(actor.roles)
      ? actor.roles.map(String).filter((role) => permittedRoles.includes(role)).slice(0, 3)
      : []
  };
}
