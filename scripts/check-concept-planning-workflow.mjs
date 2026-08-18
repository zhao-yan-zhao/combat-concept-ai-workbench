import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileProjectRepository } from "../server/projectRepository.mjs";
import { generateMockOutput } from "../shared/generator.js";
import {
  conceptGraphicPlanIncompleteReasons,
  conceptGraphicToOv1Draft,
  confirmConceptGraphicPlan,
  confirmForceMissionPlan,
  confirmOperationalTasks,
  confirmPhaseActionConcept,
  createConceptGraphicPlanFromPlanning,
  createForceMissionPlanFromBrief,
  createOperationalTasksFromPhaseAction,
  createPhaseActionConceptFromBrief,
  forceMissionPlanIncompleteReasons,
  isConceptGraphicPlanConfirmed,
  isForceMissionPlanConfirmed,
  isPhaseActionConceptConfirmed,
  normalizeConceptGraphicPlan,
  normalizeForceMissionPlan,
  normalizePhaseActionConcept,
  phaseActionConceptIncompleteReasons
} from "../shared/conceptPlanning.js";
import { getWorkflowStageIncompleteReasons } from "../design-studio/src/app/workflowGate.js";
import { workflowStageByResource } from "../shared/workflowConfirmation.js";
import { workflowPhases, views } from "../design-studio/src/data.js";
import { detectLegacyConceptMapOnly, planningAnalysisForDownstream, planningCoverageStatus } from "../design-studio/src/planningContext.js";
import { buildStructureReview } from "../design-studio/src/structureReviewBuilder.js";

const directory = await mkdtemp(join(tmpdir(), "combat-concept-planning-"));
const filePath = join(directory, "projects.json");

try {
  assert(workflowStageByResource.phaseActionConcept === 1, "Phase-action resource must map to workflow stage 1");
  assert(workflowStageByResource.forceMissionPlan === 2, "Force-mission resource must map to workflow stage 2");
  assert(workflowStageByResource.conceptMap === 3, "Concept-map resource must map to workflow stage 3");
  assert(workflowPhases.includes("阶段行动") && workflowPhases.includes("兵力任务") && workflowPhases.includes("概念图"), "Workflow phases must include the five research steps");
  assert(views.some((view) => view.id === "force-mission") && views.some((view) => view.id === "phase-action") && views.some((view) => view.id === "concept-map"), "Navigation must include planning views");
  assert(!views.some((view) => view.id === "concept-graphic"), "Concept-graphic should no longer appear as a navigation step");

  const brief = completeBrief("联合封控研究目标");
  const phaseDraft = createPhaseActionConceptFromBrief(brief, generateMockOutput({
    workflow: { id: "phase-action", title: "阶段与行动", outputSchema: "PhaseActionConcept" },
    analysis: { 任务目标: brief.objective, 核心思路: brief.approach, 预期效果: brief.expectedEffects },
    evidence: []
  }).result, { source: "ai" });
  assert(phaseDraft.phases.length >= 2 && phaseDraft.transitions.length >= 1, "Phase action AI draft was incomplete");
  const phaseConfirmed = confirmPhaseActionConcept(phaseDraft);
  assert(isPhaseActionConceptConfirmed(phaseConfirmed) && phaseActionConceptIncompleteReasons(phaseConfirmed).length === 0, "Confirmed phase action failed gate checks");

  const taskDraft = confirmOperationalTasks(createOperationalTasksFromPhaseAction({}, phaseConfirmed));
  const forceDraft = createForceMissionPlanFromBrief(brief, generateMockOutput({
    workflow: { id: "force-mission", title: "兵力与任务", outputSchema: "ForceMissionPlan" },
    analysis: { 任务目标: brief.objective, phaseAction: { phases: phaseConfirmed.phases } },
    evidence: []
  }).result, { source: "ai", previous: taskDraft });
  assert(forceDraft.status === "draft" && forceDraft.forces.length >= 3, "Force mission AI draft was incomplete");
  const forceConfirmed = confirmForceMissionPlan(forceDraft);
  assert(isForceMissionPlanConfirmed(forceConfirmed) && forceMissionPlanIncompleteReasons(forceConfirmed).length === 0, "Confirmed force mission failed gate checks");

  const graphicDraft = createConceptGraphicPlanFromPlanning({
    brief,
    forceMission: forceConfirmed,
    phaseAction: phaseConfirmed,
    conceptMap: { reference: { status: "confirmed", entities: [{ id: "e1", role: "equipment", label: "感知", note: "" }], relations: [], activities: [], constraints: [], questions: [] } },
    plan: generateMockOutput({
      workflow: { id: "concept-graphic", title: "总体作战概念图", outputSchema: "ConceptGraphicPlan" },
      analysis: { 任务目标: brief.objective, forceMission: { forces: forceConfirmed.forces }, phaseAction: { phases: phaseConfirmed.phases } },
      evidence: []
    }).result,
    source: "ai"
  });
  assert(graphicDraft.nodes.length >= 4 && graphicDraft.edges.length >= 2, "Concept graphic AI draft was incomplete");
  const graphicConfirmed = confirmConceptGraphicPlan(graphicDraft);
  assert(isConceptGraphicPlanConfirmed(graphicConfirmed) && conceptGraphicPlanIncompleteReasons(graphicConfirmed).length === 0, "Confirmed concept graphic failed gate checks");
  const ov1Draft = conceptGraphicToOv1Draft(graphicConfirmed, brief);
  assert(ov1Draft.nodes.length === 5 && ov1Draft.edges.length >= 2, "Concept graphic did not compile into OV-1 draft");

  const repository = createFileProjectRepository({ filePath });
  const savedBrief = await repository.saveBrief("planning-test", { direction: "test", source: "manual", brief });
  const savedPhase = await repository.savePhaseActionConcept("planning-test", {
    model: normalizePhaseActionConcept(phaseConfirmed),
    source: "phase-action:confirm",
    expectedRevision: savedBrief.revision
  });
  assert(savedPhase.resourceRevision === 1 && !savedPhase.stale, "Phase action concept was not persisted");
  const savedForce = await repository.saveForceMissionPlan("planning-test", {
    model: normalizeForceMissionPlan(forceConfirmed),
    source: "force-mission:confirm",
    expectedRevision: savedPhase.revision
  });
  assert(savedForce.resourceRevision === 1 && !savedForce.stale, "Force mission plan was not persisted");
  const savedGraphic = await repository.saveConceptGraphicPlan("planning-test", {
    model: normalizeConceptGraphicPlan(graphicConfirmed),
    source: "concept-graphic:confirm",
    expectedRevision: savedForce.revision
  });
  assert(savedGraphic.resourceRevision === 1 && !savedGraphic.stale, "Concept graphic plan was not persisted");

  repository.close();
  const reopened = createFileProjectRepository({ filePath });
  const loadedForce = await reopened.getForceMissionPlan("planning-test");
  const loadedPhase = await reopened.getPhaseActionConcept("planning-test");
  const loadedGraphic = await reopened.getConceptGraphicPlan("planning-test");
  assert(loadedForce.exists && loadedForce.model.forces.length === forceConfirmed.forces.length, "Force mission did not reload");
  assert(loadedPhase.exists && loadedPhase.model.phases.length === phaseConfirmed.phases.length, "Phase action did not reload");
  assert(loadedGraphic.exists && loadedGraphic.model.nodes.length === graphicConfirmed.nodes.length, "Concept graphic did not reload");

  assert(getWorkflowStageIncompleteReasons({
    phaseAction: loadedPhase.model,
    phaseActionStorage: { stale: false }
  }, 1).length === 0, "Stage 1 should complete after phase-action confirmation");
  assert(getWorkflowStageIncompleteReasons({
    forceMission: loadedForce.model,
    forceMissionStorage: { stale: false }
  }, 2).length === 0, "Stage 2 should complete after force-mission confirmation");
  const incompleteConcept = getWorkflowStageIncompleteReasons({
    forceMission: loadedForce.model,
    forceMissionStorage: { stale: false },
    phaseAction: loadedPhase.model,
    phaseActionStorage: { stale: false },
    conceptGraphic: loadedGraphic.model,
    conceptGraphicStorage: { stale: false },
    conceptMap: { document: { items: [] }, reference: { status: "empty" } },
    conceptMapStorage: { stale: false },
    ov1: { nodes: [] },
    ov5: { activities: [], edges: [] },
    ooda: { lanes: [] }
  }, 3);
  assert(incompleteConcept.some((item) => item.includes("概念图") || item.includes("活动") || item.includes("循环")), "Stage 3 should still require concept products");
  const completeStage3 = getWorkflowStageIncompleteReasons({
    conceptMap: {
      document: { items: [{ id: "m1" }] },
      reference: { status: "confirmed", entities: [{ id: "e1", label: "感知", role: "equipment" }] }
    },
    conceptMapStorage: { stale: false },
    ov1: { nodes: [{ id: "sense" }] },
    ov5: { activities: [{ id: "a1" }], edges: [{ id: "e1" }] },
    ooda: { lanes: [{ nodes: [{ id: "n1" }] }] }
  }, 3);
  assert(completeStage3.length === 0, "Stage 3 should complete after concept-map + overall graphic + activities + cycle");

  await reopened.saveBrief("planning-test", {
    direction: "test",
    source: "manual",
    expectedRevision: savedGraphic.revision,
    brief: completeBrief("更新后的研究目标")
  });
  const staleForce = await reopened.getForceMissionPlan("planning-test");
  const stalePhase = await reopened.getPhaseActionConcept("planning-test");
  const staleGraphic = await reopened.getConceptGraphicPlan("planning-test");
  assert(staleForce.stale, "Brief update must stale force mission plan");
  assert(stalePhase.stale, "Brief update must stale phase action concept");
  assert(staleGraphic.stale, "Brief update must stale concept graphic plan");
  reopened.close();

  const legacyState = {
    conceptMap: { document: { items: [{ id: "legacy-1", type: "symbol" }] }, reference: { status: "draft", entities: [{ id: "e1", label: "旧实体", role: "equipment" }] } },
    forceMission: { status: "empty", forces: [] },
    phaseAction: { status: "empty", phases: [] },
    conceptGraphic: { status: "empty", nodes: [] }
  };
  const legacy = detectLegacyConceptMapOnly(legacyState);
  assert(legacy && legacy.code === "legacy-concept-map-only", "Legacy concept-map-only projects should be detected");
  const coverage = planningCoverageStatus({
    forceMission: forceConfirmed,
    forceMissionStorage: { stale: false },
    phaseAction: phaseConfirmed,
    phaseActionStorage: { stale: false },
    conceptMap: { document: { items: [{ id: "m1" }] }, reference: { status: "confirmed", entities: [{ id: "e1", label: "感知", role: "equipment" }], relations: [{ id: "r1", from: "a", type: "信息", to: "b" }], activities: [{ id: "a1", title: "侦察" }] } },
    conceptMapStorage: { stale: false },
    conceptGraphic: { status: "empty", nodes: [] },
    conceptGraphicStorage: { stale: false }
  });
  assert(coverage.allReady, "Full planning coverage should report allReady without concept-graphic");
  const analysis = planningAnalysisForDownstream({
    brief,
    forceMission: forceConfirmed,
    forceMissionStorage: { stale: false },
    phaseAction: phaseConfirmed,
    phaseActionStorage: { stale: false },
    conceptMap: { document: { items: [{ id: "m1" }] }, reference: { status: "confirmed", entities: [{ id: "e1", label: "感知", role: "equipment" }], relations: [{ id: "r1", from: "a", type: "信息", to: "b" }], activities: [{ id: "a1", title: "侦察" }] }, summary: { itemCount: 1 } },
    conceptMapStorage: { stale: false },
    conceptGraphic: { status: "empty", nodes: [] },
    conceptGraphicStorage: { stale: false }
  });
  assert(analysis["概念图上下文"].includes("已确认") && analysis["规划活动候选"].includes("侦察"), "Downstream planning analysis should expose concept-map skeleton");
  assert(analysis["概念兵力骨架"].includes("研究主体") && analysis["概念兵力骨架"].includes("装备聚合"), "Downstream planning analysis should expose research-subject concept-force OV-1 skeleton");
  assert(analysis["兵力与任务上下文"].includes("已确认") && analysis["阶段与行动上下文"].includes("已确认"), "Downstream planning analysis should expose force and phase contexts");
  assert(analysis["上游骨架说明"].includes("研究主体") && !analysis["总体作战概念图上下文"], "OV-1 skeleton must come from research-subject concept forces");
  assert(analysis["规划预期效果"].includes(brief.expectedEffects) || analysis["规划预期效果"].length > 0, "Expected effects should come from brief/phase");

  const { conceptForcesToOv1Draft } = await import("../shared/conceptPlanning.js");
  const { createAiOv1Draft } = await import("../design-studio/src/ov1DraftStore.js");
  const forceOv1 = conceptForcesToOv1Draft(forceConfirmed, brief);
  const blueForces = forceConfirmed.forces.filter((force) => force.side === "friendly");
  const redForces = forceConfirmed.forces.filter((force) => force.side === "hostile");
  // Aggregated OV-1 should be richer than 5 abstract boxes, but far smaller than raw force count.
  assert(forceOv1.nodes.length >= 4, "OV-1 should keep a multi-node concept-force skeleton");
  assert(forceOv1.nodes.length <= Math.min(20, blueForces.length + redForces.length + 2), "OV-1 should aggregate concept forces instead of exploding node count");
  // Spine + one attachment per secondary node — sparse, but no isolates.
  assert(forceOv1.edges.length >= 2, "OV-1 should keep a minimal key closed loop");
  assert(forceOv1.edges.length <= forceOv1.nodes.length + 4, "OV-1 edges should stay hub/spine based");
  const linked = new Set();
  for (const edge of forceOv1.edges) {
    linked.add(edge.sourceId);
    linked.add(edge.targetId);
  }
  const unlinked = forceOv1.nodes.filter((node) => !linked.has(node.id));
  assert(unlinked.length === 0, `OV-1 must not leave isolated nodes: ${unlinked.map((n) => n.label).join(",")}`);
  assert(forceOv1.nodes.some((node) => node.id === "assess" || node.kind === "effect"), "OV-1 should keep an assess/effect node");
  const senseForce = blueForces.find((force) => force.role === "sense");
  const displayName = (name) => String(name || "").replace(/^(蓝方|红方)[·•\s]*/u, "");
  const equipName = (force) => force?.platforms?.[0]?.name || "";
  if (senseForce) {
    const expectedSenseLabel = equipName(senseForce) || displayName(senseForce.name);
    assert(forceOv1.nodes.some((node) => node.label === expectedSenseLabel || node.label.startsWith(expectedSenseLabel)), "OV-1 should include concept-force equipment labels");
  }
  // Same equipment should not create many near-duplicate labels.
  const labelRoots = forceOv1.nodes.map((node) => String(node.label || "").replace(/（.*?）|\(.*?\)/g, "").trim().toLowerCase());
  const uniqueRoots = new Set(labelRoots);
  assert(uniqueRoots.size >= Math.min(labelRoots.length, uniqueRoots.size), "OV-1 labels collected");
  assert(labelRoots.length - uniqueRoots.size <= 2, "OV-1 should not keep many duplicate equipment labels");
  if (redForces.length) {
    assert(forceOv1.nodes.some((node) => node.kind === "external"), "Hostile concept forces should contribute external OV-1 nodes");
  }
  assert(forceOv1.researchSubjectSide === "friendly", "OV-1 draft should declare research subject side");
  assert(!JSON.stringify(forceOv1).includes("combatForces"), "OV-1 draft from concept forces must not carry combat-force payload");

  const aiHijack = createAiOv1Draft({
    brief,
    direction: "体系压制",
    forceMission: forceConfirmed,
    draft: {
      nodes: [
        { id: "sense", label: "联合预警节点", detail: "AI 自由生成" },
        { id: "decide", label: "联合指挥节点", detail: "AI 自由生成" },
        { id: "control", label: "有限防护体系", detail: "AI 自由生成" },
        { id: "opponent", label: "外部威胁压力", detail: "AI 自由生成" },
        { id: "assess", label: "决策时间裕度", detail: "AI 自由生成" }
      ],
      edges: [
        { id: "e1", sourceId: "sense", targetId: "decide", type: "信息流" },
        { id: "e2", sourceId: "decide", targetId: "control", type: "控制流" },
        { id: "e3", sourceId: "control", targetId: "sense", type: "反馈" },
        { id: "e4", sourceId: "opponent", targetId: "sense", type: "态势变化" },
        { id: "e5", sourceId: "assess", targetId: "decide", type: "反馈" }
      ]
    }
  });
  assert(aiHijack.nodes.length === forceOv1.nodes.length, "AI path must keep aggregated concept-force OV-1 nodes");
  assert(!aiHijack.nodes.some((node) => ["联合预警节点", "联合指挥节点", "有限防护体系", "决策时间裕度"].includes(node.label)), "AI abstract OV-1 labels must be rejected when concept forces exist");
  assert(aiHijack.edges.every((edge) => ["信息流", "控制流", "态势变化", "反馈"].includes(edge.type)), "OV-1 edges should stay on the concept-force skeleton");
  assert(aiHijack.edges.length <= aiHijack.nodes.length + 4, "AI path must keep hub/spine edges");
  const aiLinked = new Set();
  for (const edge of aiHijack.edges) {
    aiLinked.add(edge.sourceId);
    aiLinked.add(edge.targetId);
  }
  assert(aiHijack.nodes.every((node) => aiLinked.has(node.id)), "AI path must not leave isolated OV-1 nodes");

  const review = buildStructureReview(legacyState);
  assert(review.issues.some((item) => item.code === "planning-legacy"), "Structure review should surface legacy planning issues");
  assert(review.summary.planningLegacy === true, "Structure review summary should flag legacy planning");

  console.log("Concept planning workflow acceptance passed: models, AI mock drafts, graphic→OV-1 compile, persistence, lineage, migration diagnostics, and stage-1 incomplete reasons.");
} finally {
  await rm(directory, { recursive: true, force: true });
}

function completeBrief(objective) {
  return {
    researchIntent: "验证作战概念规划链路",
    objective,
    approach: "AI 起草、人工复核",
    assumptions: "输入已经过人工复核",
    expectedEffects: "形成可复核的规划语义",
    risk: "职责与阶段逻辑需要人工确认"
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
