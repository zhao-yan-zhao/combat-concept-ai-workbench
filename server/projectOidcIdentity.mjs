import { createPublicKey, verify } from "node:crypto";

export function createOidcIdentityAdapter({ issuer = "", audience = "", jwksUrl = "", roleClaim = "roles", fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const config = { issuer: String(issuer).trim(), audience: String(audience).trim(), jwksUrl: String(jwksUrl).trim(), roleClaim: String(roleClaim).trim() || "roles" };
  const enabled = Boolean(config.issuer && config.audience && config.jwksUrl && typeof fetchImpl === "function");
  let cachedKeys = null;
  return {
    getStatus() { return { mode: "oidc-jwks", enabled, authentication: enabled ? "oidc-jwks" : "not-configured" }; },
    async authenticate(request) {
      if (!enabled) return null;
      const token = String(request?.headers?.authorization || "").replace(/^Bearer\s+/i, "").trim();
      if (!token) throw forbidden("OIDC bearer token is required");
      const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
      const header = decodeJson(encodedHeader);
      const claims = decodeJson(encodedPayload);
      if (!header || !claims || header.alg !== "RS256" || !header.kid) throw forbidden("OIDC token format is unsupported");
      if (claims.iss !== config.issuer || !hasAudience(claims.aud, config.audience) || Number(claims.exp || 0) * 1000 <= now()) throw forbidden("OIDC token claims are invalid");
      let keys = cachedKeys || await loadKeys();
      let jwk = keys.find((item) => item.kid === header.kid && item.kty === "RSA");
      if (!jwk && cachedKeys) {
        keys = await loadKeys({ force: true });
        jwk = keys.find((item) => item.kid === header.kid && item.kty === "RSA");
      }
      if (!jwk || !verify("RSA-SHA256", Buffer.from(`${encodedHeader}.${encodedPayload}`), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(encodedSignature, "base64url"))) throw forbidden("OIDC token signature is invalid");
      const id = clean(claims.sub, 160);
      if (!id) throw forbidden("OIDC token subject is missing");
      return { id, label: clean(claims.name || claims.preferred_username || id, 240), roles: rolesFrom(claims, config.roleClaim) };
    }
  };

  async function loadKeys({ force = false } = {}) {
    try {
      if (cachedKeys && !force) return cachedKeys;
      const response = await fetchImpl(config.jwksUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4000) });
      if (!response?.ok) throw new Error();
      const body = await response.json();
      cachedKeys = Array.isArray(body?.keys) ? body.keys : [];
      return cachedKeys;
    } catch { throw forbidden("OIDC key set is unavailable"); }
  }
}

function decodeJson(value) { try { return JSON.parse(Buffer.from(String(value || ""), "base64url").toString("utf8")); } catch { return null; } }
function hasAudience(value, audience) { return (Array.isArray(value) ? value : [value]).map(String).includes(audience); }
function rolesFrom(claims, claim) { const direct = claim.split(".").reduce((value, key) => value?.[key], claims); return [...new Set((Array.isArray(direct) ? direct : [direct, ...(claims?.realm_access?.roles || [])]).map(String).filter(Boolean))].slice(0, 20); }
function clean(value, maximum) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum); }
function forbidden(message) { const error = new Error(message); error.statusCode = 403; return error; }
