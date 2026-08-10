import { buildOv5ActivityGraph } from "../design-studio/src/ov5GraphBuilder.js";

const graph = buildOv5ActivityGraph({
  activities: [
    { id: "sense", title: "Sense" },
    { id: "decide", title: "Decide" },
    { id: "act", title: "Act" }
  ],
  edges: [
    { sourceId: "sense", targetId: "decide", type: "information" },
    { sourceId: "decide", targetId: "act", type: "control" }
  ]
});
assert(graph.nodes.length === 3 && graph.edges.length === 2, "OV-5 graph omitted source-model nodes or edges");
assert(graph.nodes.find((node) => node.id === "sense").x < graph.nodes.find((node) => node.id === "decide").x && graph.nodes.find((node) => node.id === "decide").x < graph.nodes.find((node) => node.id === "act").x, "OV-5 graph did not layer directed activities");

const cyclic = buildOv5ActivityGraph({
  activities: [{ id: "a" }, { id: "b" }],
  edges: [{ sourceId: "a", targetId: "b" }, { sourceId: "b", targetId: "a" }]
});
assert(cyclic.cycleNodeIds.join(",") === "a,b" && cyclic.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)), "OV-5 graph did not expose a relationship cycle safely");

console.log("OV-5 activity-graph acceptance passed: directed layers and relationship-cycle diagnostics are derived from the source model.");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
