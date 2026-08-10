import { buildKnowledgeGraph } from "../design-studio/src/knowledgeGraphBuilder.js";

const graph = buildKnowledgeGraph([
  { id: "fusion", title: "Sensor Fusion", filePath: "notes/fusion.md", tags: ["sensor"], links: ["[[C2 Planning]]"] },
  { id: "c2", title: "C2 Planning", filePath: "notes/c2.md", tags: ["sensor"], links: [] },
  { id: "logistics", title: "Logistics Continuity", filePath: "notes/logistics.md", tags: ["sustainment"], links: [] }
], { focusIds: ["c2"] });

assert(graph.summary.nodeCount === 3 && graph.summary.edgeCount === 1, "Knowledge graph did not build the expected bounded topology");
assert(graph.summary.linkEdgeCount === 1 && graph.summary.tagEdgeCount === 1 && graph.summary.isolatedCount === 1, "Knowledge graph lost explicit link or shared-tag provenance");
assert(graph.nodes.find((node) => node.id === "c2")?.focused && graph.edges[0].types.includes("link") && graph.edges[0].types.includes("tag"), "Knowledge graph did not preserve focus or merged edge types");
assert(graph.nodes.every((node) => node.x >= 0 && node.x <= 100 && node.y >= 0 && node.y <= 100), "Knowledge graph positions exceed the board");

console.log(`Knowledge graph acceptance passed: ${graph.summary.nodeCount} nodes, ${graph.summary.edgeCount} relationship.`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
