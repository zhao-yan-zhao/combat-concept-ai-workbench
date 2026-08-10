import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileProjectRepository } from "../server/projectRepository.mjs";
import {
  boundMapProjectIdFor,
  conceptMapEditorUrl
} from "../design-studio/src/conceptMapBridgeStore.js";
import {
  applyMapDocumentToConceptMap,
  buildConceptMapPlanFromPlanning,
  createInitialConceptMapArtifact,
  createInitialConceptMapDraft,
  ensureConceptMapBinding,
  extractForcePlacements,
  normalizeConceptMap,
  prepareImportedConceptMap,
  updateConceptMapReference,
  conceptMapContextForDownstream
} from "../design-studio/src/conceptMapStore.js";
import { currentWorkflow, getWorkflowStageIncompleteReasons } from "../design-studio/src/app/workflowGate.js";
import { renderConceptMap } from "../design-studio/src/conceptMapView.js";

const directory = await mkdtemp(join(tmpdir(), "combat-concept-map-integration-"));
const filePath = join(directory, "projects.json");

try {
  const controllerSource = await readFile(new URL("../design-studio/src/conceptMapController.js", import.meta.url), "utf8");
  const viewSource = await readFile(new URL("../design-studio/src/conceptMapView.js", import.meta.url), "utf8");
  assert(!controllerSource.includes("generateWithAi") && !controllerSource.includes("ConceptMapInitialPlan"), "Concept-map step must not call AI");
  assert(controllerSource.includes("seedFromPlanning") && controllerSource.includes("buildConceptMapPlanFromPlanning"), "Concept-map step must seed deterministically from planning");
  assert(controllerSource.includes("open-concept-map-external") || controllerSource.includes("openExternalEditor"), "Concept-map step must open standalone editor");
  assert(controllerSource.includes("boundMapProjectId") || controllerSource.includes("mapProjectId"), "Concept-map step must bind map project id");
  assert(controllerSource.includes("map-document-changed"), "Concept-map step must accept live tool change events");
  assert(controllerSource.includes("softUi") || controllerSource.includes("softUpdateConceptMapChrome"), "Live sync must soft-update UI without full view rebuild");
  assert(controllerSource.includes("silent: softUi") || controllerSource.includes("silent: true"), "Live map sync must silent-save to avoid full page render");
  assert(controllerSource.includes("applyMapDocumentToConceptMap"), "Live map sync must persist document positions into conceptMap storage");
  assert(controllerSource.includes("parentOrigin"), "Standalone editor URL must pass parentOrigin for postMessage");
  assert(!controllerSource.includes("noopener"), "Standalone editor must keep window.opener for change notifications");
  assert(viewSource.includes("在独立窗口编辑") && (viewSource.includes("conceptMapFrame") || viewSource.includes("conceptMapFrameMount")), "Preview UI should embed tool and offer standalone edit");
  assert(!viewSource.includes("选择项目"), "Preview step is already 1:1 bound — no project picker on concept-map page");
  assert(viewSource.includes("从规划生成初图") || viewSource.includes("按规划刷新初图"), "Preview UI should offer planning seed without AI wording");

  const mapProjectId = boundMapProjectIdFor("proj-demo-1");
  assert(mapProjectId.startsWith("workbench-"), "Bound map project id must use workbench- prefix");
  const editorUrl = conceptMapEditorUrl("http://127.0.0.1:8765/", { mapProjectId, title: "示例", workbenchPreview: true });
  assert(editorUrl.includes("mapProjectId=workbench-"), "Editor URL must carry binding params");
  assert(editorUrl.includes("workbenchPreview=1"), "Preview iframe URL must request chrome-hidden preview mode");
  assert(!editorUrl.includes("title="), "Preview iframe URL must stay stable without title (avoids reload on workbench re-render)");
  assert(!editorUrl.includes("parentOrigin="), "Preview iframe URL must not include parentOrigin (keeps src stable)");
  assert(!editorUrl.includes("embed="), "Preview/editor URL must not force legacy embed mode");
  const standaloneUrl = conceptMapEditorUrl("http://127.0.0.1:8765/", {
    mapProjectId,
    title: "示例",
    workbenchPreview: false,
    includeTitle: true,
    parentOrigin: "http://127.0.0.1:8792"
  });
  assert(!standaloneUrl.includes("workbenchPreview="), "Standalone editor must keep full tool chrome");
  assert(standaloneUrl.includes("title="), "Standalone editor may include title");
  assert(standaloneUrl.includes("parentOrigin="), "Standalone editor must carry parentOrigin for live sync");

  const plan = buildConceptMapPlanFromPlanning({
    brief: completeBrief("Initial research objective"),
    forceMission: {
      forces: [
        { id: "blue-sense", name: "蓝方感知概念单元", side: "friendly", role: "sense", group: "态势", task: "形成态势", slot: "northwest", phaseIds: ["phase-1"] },
        { id: "blue-cmd", name: "蓝方指挥概念单元", side: "friendly", role: "command", group: "指挥", task: "组织协同", slot: "center", phaseIds: ["phase-2"] },
        { id: "red-act", name: "红方行动概念单元", side: "hostile", role: "maneuver", group: "对方行动", task: "形成压力", slot: "east", phaseIds: ["phase-2"] }
      ],
      combatForces: [],
      relations: [{ fromForceId: "blue-sense", toForceId: "blue-cmd", type: "information" }]
    },
    phaseAction: {
      phases: [
        { id: "phase-1", name: "态势", objective: "形成态势", timeWindow: "T0-T1" },
        { id: "phase-2", name: "行动", objective: "组织行动", timeWindow: "T1-T2" }
      ]
    }
  }, null);
  assert(plan.phases.map((phase) => phase.phaseId).join(",") === "phase-1,phase-2", "Phases must come from phase-action");
  let draft = createInitialConceptMapDraft({ brief: completeBrief("Initial research objective"), plan });
  draft = ensureConceptMapBinding(draft, "proj-demo-1", "示例研究");
  assert(draft.boundMapProjectId === mapProjectId, "Draft must bind 1:1 map project id");
  assert(draft.document.operation.phases.map((phase) => phase.id).join(",") === "phase-1,phase-2", "Map operation must include planning phases");
  assert(draft.document.items.some((item) => item.type === "symbol" && item.assignment?.phaseId === "phase-1"), "Phase-1 forces must be drawn");
  assert(draft.document.items.some((item) => item.type === "symbol" && item.assignment?.phaseId === "phase-2"), "Phase-2 forces must be drawn");

  // Independent-tool drag must persist lon/lat into conceptMap document + draft.placements.
  const movedDocument = JSON.parse(JSON.stringify(draft.document));
  const firstSymbol = movedDocument.items.find((item) => item.type === "symbol");
  assert(firstSymbol, "Seed draft must include a symbol force");
  firstSymbol.lon = 121.123456;
  firstSymbol.lat = 25.654321;
  const stored = applyMapDocumentToConceptMap(draft, movedDocument, {
    title: draft.title,
    boundMapProjectId: draft.boundMapProjectId
  });
  const storedSymbol = stored.document.items.find((item) => item.id === firstSymbol.id);
  assert(storedSymbol?.lon === 121.123456 && storedSymbol?.lat === 25.654321, "Stored document must keep moved force coordinates");
  assert(storedSymbol?.assignment?.lon === 121.123456 && storedSymbol?.assignment?.lat === 25.654321, "assignment meta must mirror moved coordinates");
  const placements = extractForcePlacements(stored.document);
  assert(placements.some((item) => item.itemId === firstSymbol.id && item.lon === 121.123456), "draft placements extract must include moved force");
  assert(stored.draft.placements.some((item) => item.itemId === firstSymbol.id && item.lat === 25.654321), "draft.placements must persist moved force coordinates");
  const reseed = createInitialConceptMapDraft({
    brief: completeBrief("Initial research objective"),
    plan,
    previousPlacements: stored.draft.placements
  });
  const reseeded = reseed.document.items.find((item) => item.assignment?.conceptForceId === firstSymbol.assignment?.conceptForceId
    || item.id === firstSymbol.id
    || item.id.startsWith(`initial-force-${firstSymbol.assignment?.conceptForceId || "x"}`));
  assert(reseeded && Math.abs(reseeded.lon - 121.123456) < 1e-6, "Reseed should reuse saved force lon when previousPlacements provided");

  const view = renderConceptMap({
    activeProjectId: "proj-demo-1",
    conceptMap: draft,
    conceptMapBridge: { settings: { targetUrl: "http://127.0.0.1:8765/" } },
    conceptMapStorage: { stale: false },
    forceMission: { status: "confirmed" },
    phaseAction: { status: "confirmed" },
    forceMissionStorage: { stale: false },
    phaseActionStorage: { stale: false }
  });
  assert(
    (view.includes('id="conceptMapFrame"') || view.includes('id="conceptMapFrameMount"'))
      && view.includes("在独立窗口编辑")
      && view.includes(mapProjectId),
    "Preview must show frame mount, bind id, and external edit"
  );
  assert(!view.includes("generateWithAi") && !view.includes("ConceptMapInitial") && !view.includes("根据规划生成模糊"), "Preview must not surface AI generation UI");

  const repository = createFileProjectRepository({ filePath });
  const initialBrief = await repository.saveBrief("concept-map-test", { direction: "test-direction", source: "manual", brief: completeBrief("Initial research objective") });
  const confirmedDraft = updateConceptMapReference(draft, referenceForm(), { confirmed: true });
  const saved = await repository.saveConceptMap("concept-map-test", {
    model: normalizeConceptMap(confirmedDraft),
    source: "concept-map:planning-seed",
    expectedRevision: initialBrief.revision
  });
  assert(saved.revision === 2 && !saved.stale, "Bound concept map should persist");
  repository.close();

  const reopened = createFileProjectRepository({ filePath });
  const persisted = await reopened.getConceptMap("concept-map-test");
  assert(persisted.model.boundMapProjectId === mapProjectId, "Persisted model keeps map project binding");
  const planningComplete = {
    forceMission: {
      status: "confirmed",
      forces: [{ id: "sense", name: "概念感知单元", side: "friendly", role: "sense", group: "态势", task: "形成态势", notes: "" }],
      combatForces: [{ id: "combat-sense", name: "作战感知单元", side: "friendly", role: "sense", group: "态势", task: "形成态势", missionType: "support", conceptForceId: "sense", platforms: [], notes: "" }],
      relations: [], openQuestions: [], reviewChecklist: [], generation: {}, confirmedAt: "2026-07-25T00:00:00.000Z"
    },
    forceMissionStorage: { stale: false },
    phaseAction: {
      status: "confirmed",
      phases: [
        { id: "p1", name: "态势", objective: "形成态势", primaryActions: ["汇聚态势"], secondaryActions: [], entryConditions: [], exitConditions: ["完成"], expectedEffects: [], forceIds: ["sense"] },
        { id: "p2", name: "行动", objective: "组织行动", primaryActions: ["主行动"], secondaryActions: [], entryConditions: ["完成态势"], exitConditions: [], expectedEffects: [], forceIds: ["sense"] }
      ],
      transitions: [{ id: "t1", fromPhaseId: "p1", toPhaseId: "p2", condition: "完成", note: "" }],
      openQuestions: [], reviewChecklist: [], generation: {}, confirmedAt: "2026-07-25T00:00:00.000Z"
    },
    phaseActionStorage: { stale: false },
    conceptGraphic: {
      status: "confirmed",
      nodes: [
        { id: "sense", label: "感知", role: "sense", fromForceIds: ["sense"], fromPhaseIds: [], note: "态势" },
        { id: "decide", label: "指挥", role: "command", fromForceIds: [], fromPhaseIds: [], note: "协同" },
        { id: "control", label: "行动", role: "action", fromForceIds: [], fromPhaseIds: [], note: "主方向" },
        { id: "opponent", label: "外部", role: "external", fromForceIds: [], fromPhaseIds: [], note: "约束" },
        { id: "assess", label: "效果", role: "effect", fromForceIds: [], fromPhaseIds: [], note: "终态" }
      ],
      edges: [
        { id: "e1", from: "sense", to: "decide", type: "信息流", note: "" },
        { id: "e2", from: "decide", to: "control", type: "控制流", note: "" }
      ],
      effects: [], activityCandidates: [], oodaHints: [], openQuestions: [], reviewChecklist: [], consistencyReport: [], generation: {}, confirmedAt: "2026-07-25T00:00:00.000Z"
    },
    conceptGraphicStorage: { stale: false }
  };
  const workflowState = {
    activeProjectId: "concept-map-test",
    projectDirectory: { projects: [{ id: "concept-map-test", workflow: { completedThrough: 1, mode: "gated" } }] },
    conceptMap: persisted.model,
    conceptMapStorage: { stale: false },
    ...planningComplete
  };
  assert(getWorkflowStageIncompleteReasons(workflowState, 1).length === 0 && currentWorkflow(workflowState).completedThrough === 1, "Confirmed concept map satisfies workflow gate");
  reopened.close();

  console.log("Concept-map integration acceptance passed: no-AI seed, project binding, phase deployment, preview UI, persistence.");
} finally {
  await rm(directory, { recursive: true, force: true });
}

function completeBrief(objective) {
  return {
    researchIntent: "Test the project-scoped research intent.",
    objective,
    approach: "Use reviewed research-level relationships.",
    assumptions: "Inputs are reviewed before use.",
    expectedEffects: "Produce a reviewable concept model.",
    risk: "Map context requires review after brief changes."
  };
}

function referenceForm() {
  return {
    entities: "equipment | 概念感知单元 | 形成研究级态势输入\ncommand | 概念指挥单元 | 组织概念协同\naction | 概念行动单元 | 比较概念行动",
    relations: "概念感知单元 | 信息 | 概念指挥单元\n概念指挥单元 | 协同 | 概念行动单元",
    activities: "态势 | 形成态势\n行动 | 组织行动",
    constraints: "人工复核",
    questions: "人工确认"
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
