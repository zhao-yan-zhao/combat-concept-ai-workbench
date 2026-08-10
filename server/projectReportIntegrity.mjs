const ALGORITHM = "SHA-256";

export async function createReportIntegrity(payload) {
  const source = stableStringify(stripIntegrityMetadata(payload));
  const digest = await digestText(source);
  return { algorithm: ALGORITHM, digest, byteLength: new TextEncoder().encode(source).byteLength };
}

export async function verifyReportIntegrity(payload) {
  const integrity = payload?.reportIntegrity;
  if (!integrity?.digest || integrity.algorithm !== ALGORITHM) return { status: "unverified" };
  const expected = await createReportIntegrity(payload);
  return { status: expected.digest === integrity.digest ? "verified" : "mismatch", expectedDigest: expected.digest };
}

export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function stripIntegrityMetadata(payload) {
  const copy = structuredClone(payload || {});
  delete copy.reportIntegrity;
  delete copy.reportVersion;
  return copy;
}

async function digestText(value) {
  if (!globalThis.crypto?.subtle) throw new Error("SHA-256 is unavailable");
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest(ALGORITHM, bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
