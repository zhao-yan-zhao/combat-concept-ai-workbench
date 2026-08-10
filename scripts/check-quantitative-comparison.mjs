import { compareModelSnapshots } from "../design-studio/src/modelCompare.js";
import { buildModelComparisonArtifact } from "../design-studio/src/modelComparisonBuilder.js";
import { buildExportArtifactFromPayload, buildReportPayload } from "../design-studio/src/reportBuilder.js";
import { createQuantitativeSettings } from "../design-studio/src/schemeScoring.js";

const baseline = snapshot("baseline", "M001", 68, 2, 1, false);
const candidate = snapshot("candidate", "M002", 88, 0, 0, true);
const comparison = compareModelSnapshots(baseline, candidate);

assert(comparison.quantitative?.method === "weighted-score-v1", "Quantitative comparison method was not attached");
assert(comparison.quantitative.weights.reduce((sum, item) => sum + item.weight, 0) === 100, "Default weights were not normalized to 100%");
assert(comparison.quantitative.winner === "candidate" && comparison.quantitative.candidate.total > comparison.quantitative.baseline.total, "Higher-scoring candidate was not ranked first");
assert(comparison.quantitative.baseline.criteria.length === 8 && comparison.quantitative.baseline.criteria.every((item) => item.evidence.length), "Criterion evidence was not retained");
assert(comparison.quantitative.sensitivity?.method === "one-at-a-time-weight-plus-15pp-v1" && comparison.quantitative.sensitivity.scenarios.length === 8 && comparison.quantitative.sensitivity.scenarios.every((item) => Number.isFinite(item.baselineTotal) && Number.isFinite(item.candidateTotal) && Number(Object.values(item.weights).reduce((sum, weight) => sum + weight, 0).toFixed(2)) === 100), "Weight sensitivity analysis was not attached to every normalized criterion scenario");

const manualSettings = createQuantitativeSettings({
  weights: { missionFit: 100, coordination: 0, feasibility: 0, riskControl: 0, resourceAffordability: 0, timeWindow: 0, resilience: 0, reportCompleteness: 0 },
  manualScores: { baseline: { missionFit: 100 }, candidate: { missionFit: 20 } },
  manualRationales: { baseline: { missionFit: "Independent review found stronger mission evidence." }, candidate: { missionFit: "Evidence remains incomplete; retain a conservative score." } }
});
const manuallyReviewed = compareModelSnapshots(baseline, candidate, manualSettings);
assert(manuallyReviewed.quantitative.winner === "baseline" && manuallyReviewed.quantitative.baseline.manualReviewCount === 1 && manuallyReviewed.quantitative.candidate.manualReviewCount === 1 && manuallyReviewed.quantitative.baseline.criteria[0].manualRationale.includes("Independent review"), "Manual review did not retain bounded score rationale");

const comparisonMarkdown = buildModelComparisonArtifact("markdown", manuallyReviewed).content;
const comparisonJson = buildModelComparisonArtifact("json", manuallyReviewed).content;
assert(comparisonMarkdown.includes("## 量化比较") && comparisonMarkdown.includes("含人工复核") && comparisonMarkdown.includes("Independent review") && comparisonMarkdown.includes("权重敏感性") && comparisonJson.includes("one-at-a-time-weight-plus-15pp-v1"), "Comparison export lost sensitivity, scoring, or manual-review provenance");

const payload = buildReportPayload({
  project: { title: "Quantitative acceptance", brief: { objective: "Review", approach: "Compare", assumptions: "Frozen models", risk: "Uncertainty" }, citations: [] },
  direction: "Comparison",
  ov1: { nodes: [], edges: [] },
  ov5: { activities: [], edges: [] },
  ooda: { sourceActivityIds: [], lanes: [] },
  scenario: null,
  validationResult: null,
  knowledge: null,
  deployment: { settings: {}, status: "not-configured" },
  modelSnapshots: [candidate, baseline],
  modelComparison: manuallyReviewed
});
const xml = buildExportArtifactFromPayload("xml", payload).content;
const reportMarkdown = buildExportArtifactFromPayload("markdown", payload).content;
assert(payload.modelGovernance.comparison?.quantitative?.winner === "baseline" && xml.includes("<quantitative method=\"weighted-score-v1\"") && xml.includes("<weightSensitivity method=\"one-at-a-time-weight-plus-15pp-v1\"") && xml.includes("<baselineManualRationale>Independent review") && reportMarkdown.includes("量化总分") && reportMarkdown.includes("Independent review"), "Main report did not retain quantitative sensitivity evidence");

console.log(`Quantitative comparison acceptance passed: automatic ${comparison.quantitative.baseline.total} -> ${comparison.quantitative.candidate.total}, manually reviewed winner ${manuallyReviewed.quantitative.winner}.`);

function snapshot(id, label, score, highIssues, mediumIssues, scenarioReady) {
  return {
    id,
    label,
    direction: label,
    savedAt: "2026-07-14T00:00:00.000Z",
    model: {
      brief: {},
      ov1: { nodes: [{ id: "sense", label: "Sense" }], edges: [] },
      ov5: { activities: [{ id: "activity-1", title: "Review", input: "Input", output: "Output" }, { id: "activity-2", title: "Assess", input: "Input", output: "Output" }], edges: [{ sourceId: "activity-1", targetId: "activity-2" }] },
      ooda: { durationMinutes: 20, lanes: [{ id: "observe", nodes: [{ id: "node-1", title: "Observe" }] }] },
      scenario: scenarioReady ? { entities: [{ id: "entity-1" }], deploymentPlan: { diagnostics: [] } } : null,
      validation: {
        scores: [
          { label: "活动连通性", score },
          { label: "信息闭环", score },
          { label: "跨视图追溯", score },
          { label: "OODA 时效", score },
          { label: "OODA 行为完整性", score },
          { label: "OODA 韧性", score }
        ],
        issues: [...Array(highIssues).fill({ level: "high" }), ...Array(mediumIssues).fill({ level: "medium" })],
        traceabilityDiagnostics: { score },
        oodaDiagnostics: { completenessScore: score, resilienceScore: score },
        redTeamReview: scenarioReady ? { findings: [] } : null
      }
    }
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
