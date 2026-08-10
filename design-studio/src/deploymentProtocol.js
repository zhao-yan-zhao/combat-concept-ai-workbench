export const DEPLOYMENT_CHANNEL = "combat-concept.deployment";
export const DEPLOYMENT_PROTOCOL_VERSION = 2;

export const deploymentMessageTypes = Object.freeze({
  ready: "ready",
  load: "load",
  change: "change"
});

export function createDeploymentMessage(type, payload = {}) {
  return {
    channel: DEPLOYMENT_CHANNEL,
    version: DEPLOYMENT_PROTOCOL_VERSION,
    type,
    payload
  };
}

export function isDeploymentMessage(message, type) {
  return Boolean(
    message
    && message.channel === DEPLOYMENT_CHANNEL
    && message.version === DEPLOYMENT_PROTOCOL_VERSION
    && (!type || message.type === type)
  );
}

export function normalizeDeploymentChanges(changes) {
  if (!Array.isArray(changes)) return [];
  return changes
    .filter((change) => typeof change?.entityId === "string" && change.entityId.trim() && isPosition(change.position))
    .map((change) => ({ entityId: change.entityId.trim(), position: change.position.map((value) => clamp(value)) }));
}

export function createDeploymentExchange(deploymentData, projectRevision = 0) {
  return {
    id: createId("deployment-exchange"),
    scenarioId: clean(deploymentData?.scenarioId, 160),
    scenarioUpdatedAt: clean(deploymentData?.updatedAt, 80),
    projectRevision: Math.max(0, Number(projectRevision) || 0)
  };
}

export function acceptDeploymentChange(payload, exchange) {
  if (!exchange?.id || payload?.scenarioId !== exchange.scenarioId || payload?.exchangeId !== exchange.id) return null;
  const changeId = clean(payload?.changeId, 160);
  const changes = normalizeDeploymentChanges(payload?.changes);
  return changeId && changes.length ? { changeId, changes } : null;
}

function isPosition(position) {
  return Array.isArray(position)
    && position.length === 2
    && position.every((value) => Number.isFinite(value));
}

function clamp(value) {
  return Math.min(100, Math.max(0, Number(value)));
}

function createId(prefix) {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clean(value, maximum) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
}
