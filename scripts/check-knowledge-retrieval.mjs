import { listKnowledgeRetrievalModes, resolveKnowledgeRetrievalMode, searchProjectKnowledge } from "../server/projectKnowledgeRetrieval.mjs";

const docs = [
  {
    id: "sensor-fusion",
    title: "Sensor fusion posture",
    fileTitle: "sensor-fusion.md",
    tags: ["sensor", "fusion"],
    content: "Sensor fusion combines distributed observations into a reviewable research picture.",
    text: "Distributed sensor observations support fusion.",
    summary: "Sensor fusion evidence.",
    links: [],
    frontmatter: {},
    parameterTables: []
  },
  {
    id: "logistics",
    title: "Logistics continuity",
    fileTitle: "logistics.md",
    tags: ["sustainment"],
    content: "Continuity planning manages supply and maintenance constraints.",
    text: "Continuity planning evidence.",
    summary: "Logistics evidence.",
    links: [],
    frontmatter: {},
    parameterTables: []
  }
];

assert(listKnowledgeRetrievalModes().join(",") === "keyword,vector,hybrid", "Retrieval mode list is incomplete");
assert(resolveKnowledgeRetrievalMode("VECTOR") === "vector" && resolveKnowledgeRetrievalMode("unknown") === "hybrid", "Retrieval mode normalization is incomplete");

const keyword = searchProjectKnowledge({ query: "sensor fusion", docs, mode: "keyword", limit: 2 });
assert(keyword.index.mode === "keyword" && keyword.index.backend === "deterministic-keyword" && keyword.results[0]?.id === "sensor-fusion", "Keyword retrieval did not return the expected evidence");

const vector = searchProjectKnowledge({ query: "sensor fusion", docs, mode: "vector", limit: 2 });
assert(vector.index.mode === "vector" && vector.index.backend === "local-sparse-vector" && vector.results[0]?.id === "sensor-fusion" && vector.results[0].matchReasons.some((reason) => reason.startsWith("稀疏向量相似度:")), "Sparse-vector retrieval did not return provenance-aware evidence");

const hybrid = searchProjectKnowledge({ query: "sensor fusion", docs, mode: "hybrid", limit: 2 });
assert(hybrid.index.mode === "hybrid" && hybrid.index.backend === "hybrid-rrf" && hybrid.results[0]?.id === "sensor-fusion" && hybrid.results[0].matchReasons.includes("关键词排序") && hybrid.results[0].matchReasons.includes("向量排序"), "Hybrid retrieval did not combine both rankings");

const empty = searchProjectKnowledge({ query: "", docs: [], mode: "vector" });
assert(empty.index.mode === "vector" && empty.index.documentCount === 0 && empty.results.length === 0, "Empty retrieval response lost mode metadata");

console.log(`Knowledge retrieval acceptance passed: ${keyword.results.length} keyword, ${vector.results.length} vector, ${hybrid.results.length} hybrid result(s).`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
