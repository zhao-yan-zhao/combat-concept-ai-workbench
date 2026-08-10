import { generateKeyPairSync, sign } from "node:crypto";
import { createOidcIdentityAdapter } from "../server/projectOidcIdentity.mjs";

const issuer = "https://issuer.example.test";
const audience = "combat-workbench";
const first = createKey("first");
const second = createKey("second");
let fetchCount = 0;
const adapter = createOidcIdentityAdapter({
  issuer,
  audience,
  jwksUrl: "https://issuer.example.test/jwks",
  now: () => 1_800_000_000_000,
  fetchImpl: async () => ({ ok: true, async json() { fetchCount += 1; return { keys: fetchCount === 1 ? [first.jwk] : [second.jwk] }; } })
});

const claims = { iss: issuer, aud: audience, sub: "researcher-1", name: "Researcher", exp: 1_900_000_000, roles: ["researcher"] };
const firstActor = await adapter.authenticate({ headers: { authorization: `Bearer ${token(first, claims)}` } });
assert(firstActor.id === "researcher-1" && fetchCount === 1, "OIDC adapter did not validate cached JWKS token");
const secondActor = await adapter.authenticate({ headers: { authorization: `Bearer ${token(second, claims)}` } });
assert(secondActor.roles.includes("researcher") && fetchCount === 2, "OIDC adapter did not refresh JWKS for an unknown key ID");
let rejected = null;
try { await adapter.authenticate({ headers: { authorization: `Bearer ${token(second, { ...claims, exp: 1 })}` } }); } catch (error) { rejected = error; }
assert(rejected?.statusCode === 403, "OIDC adapter accepted an expired token");
console.log("OIDC identity acceptance passed: RS256 validation, role extraction, key rotation refresh, and expiry rejection.");

function createKey(kid) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = publicKey.export({ format: "jwk" });
  return { privateKey, jwk: { ...jwk, kid, kty: "RSA", alg: "RS256", use: "sig" } };
}

function token(key, claims) {
  const header = encode({ alg: "RS256", kid: key.jwk.kid, typ: "JWT" });
  const payload = encode(claims);
  return `${header}.${payload}.${sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), key.privateKey).toString("base64url")}`;
}

function encode(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
function assert(condition, message) { if (!condition) throw new Error(message); }
