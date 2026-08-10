import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExternalVectorRetrievalAdapter } from "../server/projectExternalVectorRetrieval.mjs";
import { createFileProjectRepository } from "../server/projectRepository.mjs";

const docs = [
  { id: "public", title: "Public evidence", content: "Reviewable public evidence.", summary: "Public", tags: [], frontmatter: {} },
  { id: "sensitive", title: "Sensitive evidence", content: "Must not leave the vault.", summary: "Sensitive", tags: ["restricted"], frontmatter: { sensitive: true } }
];

let disabledCalls = 0;
const disabled = createExternalVectorRetrievalAdapter({ fetchImpl: async () => { disabledCalls += 1; throw new Error("must not run"); } });
const disabledResult = await disabled.search({ projectId: "p", query: "evidence", docs, limit: 4 });
assert(disabledCalls === 0 && disabledResult.provenance.status === "disabled", "Disabled adapter called fetch");

let requestPayload;
const adapter = createExternalVectorRetrievalAdapter({
  endpoint: "https://vector.example/search",
  token: "process-only-token",
  fetchImpl: async (_url, request) => {
    requestPayload = JSON.parse(request.body);
    return { ok: true, json: async () => ({ results: [
      { id: "sensitive", score: 0.99 },
      { id: "unknown", score: 0.95 },
      { id: "public", score: 0.8, reason: "semantic match" }
    ] }) };
  }
});
const externalResult = await adapter.search({ projectId: "project-a", query: "evidence", docs, limit: 4 });
assert(Object.keys(requestPayload).sort().join(",") === "allowedDocumentIds,limit,projectId,query" && requestPayload.allowedDocumentIds.join(",") === "public", "External request sent fields beyond permitted document IDs");
assert(externalResult.results.map((item) => item.id).join(",") === "public" && externalResult.provenance.sensitiveExcludedCount === 1, "External response admitted unknown or sensitive IDs");

const tempDirectory = await mkdtemp(join(tmpdir(), "external-vector-retrieval-"));
try {
  const failingAdapter = createExternalVectorRetrievalAdapter({ endpoint: "https://vector.example/search", fetchImpl: async () => { throw new Error("offline"); } });
  const repository = createFileProjectRepository({ filePath: join(tempDirectory, "projects.json"), externalVectorAdapter: failingAdapter });
  await repository.saveKnowledge("project-a", { model: { docs }, source: "acceptance" });
  const fallback = await repository.searchKnowledge("project-a", "evidence", 4, "vector");
  assert(fallback.index.externalVector.status === "fallback" && fallback.index.backend === "local-sparse-vector" && fallback.results.map((item) => item.id).join(",") === "public", "External failure did not use local sensitive-safe fallback");

  const hybridRepository = createFileProjectRepository({ filePath: join(tempDirectory, "hybrid-projects.json"), externalVectorAdapter: adapter });
  await hybridRepository.saveKnowledge("project-a", { model: { docs }, source: "acceptance" });
  const hybrid = await hybridRepository.searchKnowledge("project-a", "evidence", 4, "hybrid");
  assert(hybrid.index.backend === "hybrid-rrf-external-vector" && hybrid.index.externalVector.status === "used" && hybrid.results.map((item) => item.id).join(",") === "public", "Hybrid retrieval did not retain external-vector provenance");

  const localSensitiveReview = await hybridRepository.searchKnowledge("project-a", "evidence", 4, "vector", true);
  assert(localSensitiveReview.index.backend === "external-vector-local-sensitive-review" && localSensitiveReview.results.map((item) => item.id).includes("sensitive") && requestPayload.allowedDocumentIds.join(",") === "public", "Local sensitive review either omitted local evidence or sent it to the external adapter");
} finally {
  await rm(tempDirectory, { recursive: true, force: true });
}

console.log("External vector retrieval acceptance passed: disabled, ID-only request, response filtering, and local fallback.");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
