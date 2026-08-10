import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileProjectRepository } from "../server/projectRepository.mjs";
import { renderValidation } from "../design-studio/src/validationView.js";
import { buildExportArtifactFromPayload, buildReportPayload } from "../design-studio/src/reportBuilder.js";

const directory = await mkdtemp(join(tmpdir(), "combat-concept-validation-diagnostics-"));
const filePath = join(directory, "projects.json");
const repository = createFileProjectRepository({ filePath });
try {
  const brief = await repository.saveBrief("default", { direction: "Review", source: "manual", brief: { objective: "Persist", approach: "Review", assumptions: "Abstract", risk: "Loss" } });
  const saved = await repository.saveValidation("default", {
    source: "rule-validation",
    expectedRevision: brief.revision,
    model: {
      id: "validation-diagnostics", scores: [], issues: [], redTeam: "",
      traceabilityDiagnostics: { mappedActivityCount: 3, activityCount: 4, orphanedReferenceCount: 1, score: 72, checks: [{ id: "trace-1", label: "Trace", state: "review", statusLabel: "Review", detail: "Map one activity." }] },
      flowDiagnostics: { exchangeCount: 2, unresolvedCount: 0, missingContractCount: 1, mismatchCount: 1, resourceWithoutConstraintCount: 1, constraintWithoutPreconditionCount: 0, score: 66, checks: [{ id: "flow-1", label: "Contract", state: "attention", statusLabel: "Attention", detail: "Define exchange." }] }
    }
  });
  assert(saved.model.traceabilityDiagnostics?.score === 72 && saved.model.flowDiagnostics?.missingContractCount === 1, "Server validation normalization lost diagnostic fields");
  const reopened = createFileProjectRepository({ filePath });
  const restored = await reopened.getValidation("default");
  assert(restored.model.traceabilityDiagnostics?.checks[0]?.id === "trace-1" && restored.model.flowDiagnostics?.checks[0]?.state === "attention", "Diagnostic fields did not survive repository reload");
  const view = renderValidation({ validationResult: restored.model, validationStorage: {}, redTeamHealth: null, redTeamRunning: false });
  assert(view.includes("追溯关系诊断") && view.includes("Map one activity."), "Validation view did not render persisted traceability diagnostics");
  const payload = buildReportPayload({
    project: { title: "Diagnostic report", brief: {}, citations: [] },
    direction: "Review", ov1: { nodes: [], edges: [] }, ov5: { activities: [], edges: [] }, ooda: { lanes: [] },
    scenario: null, validationResult: restored.model, knowledge: null, deployment: {}
  });
  assert(payload.validation?.traceabilityDiagnostics?.score === 72, "Report payload lost traceability diagnostics");
  const markdown = buildExportArtifactFromPayload("markdown", payload).content;
  const xml = buildExportArtifactFromPayload("xml", payload).content;
  assert(markdown.includes("### 追溯关系诊断") && markdown.includes("Map one activity."), "Markdown report did not render traceability diagnostics");
  assert(xml.includes('<traceabilityDiagnostics mappedActivityCount="3" activityCount="4" orphanedReferenceCount="1" score="72">') && xml.includes("Map one activity."), "XML report did not render traceability diagnostics");
  console.log("Validation diagnostic persistence acceptance passed: traceability and flow diagnostics survive normalization, reload, view, and reports.");
} finally {
  repository.close();
  await rm(directory, { recursive: true, force: true });
}

function assert(condition, message) { if (!condition) throw new Error(message); }
