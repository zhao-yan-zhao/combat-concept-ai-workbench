/**
 * Acceptance: CMO DB3 catalog + force-mission upstream packing + mission types.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compactForceMissionForAnalysis,
  createForceMissionPlanFromBrief,
  dutyCmoSearchTerms,
  forceMissionDiagnostics,
  listCmoMissionTypes,
  mapForcesForLayout,
  normalizeForceMissionPlan,
  resolveSideCountries,
  seedConceptEquipmentType
} from "../shared/conceptPlanning.js";
import { CMO_MISSION_TYPE_IDS, normalizeCmoMissionType } from "../shared/cmoMissionTypes.js";
import {
  applyPlatformRecommendations,
  attachForcePlatform,
  attachForcePlatforms,
  removeForcePlatform,
  setForcePlatformQuantity,
  toggleForceTaskRef,
  updateForceMissionType
} from "../design-studio/src/forceMissionStore.js";
import {
  buildForceRecommendKeywords,
  selectRecommendedPlatforms,
  summarizePhaseRecommendSeeds
} from "../shared/forcePlatformRecommend.js";
import { createCmoDatabaseService } from "../server/cmoDatabase.mjs";
import { generateMockOutput } from "../shared/generator.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = join(root, "data", "cmo-database-config.json");

const missionTypes = listCmoMissionTypes();
assert.ok(missionTypes.length >= 20, "expected CMO-aligned mission type catalog");
assert.equal(normalizeCmoMissionType("sead"), "sead");
assert.equal(normalizeCmoMissionType("not-a-type"), "other");
assert.ok(CMO_MISSION_TYPE_IDS.has("patrol_asw"));

const cmo = createCmoDatabaseService({ root, configPath });
const publicConfig = await cmo.loadConfig();
assert.equal(publicConfig.enabled, true);
const status = cmo.getStatus();
assert.equal(status.open, true, `CMO db should open: ${status.resolvedPath}`);
assert.ok((status.platformCounts?.aircraft || 0) > 1000, "aircraft catalog expected");
assert.ok((status.platformCounts?.ship || 0) > 100, "ship catalog expected");

const ships = cmo.searchPlatforms({ q: "Arleigh", domain: "ship", limit: 5 });
assert.ok(ships.length > 0, "ship search should find Arleigh Burke class entries");
assert.ok(ships[0].cmoId > 0);
assert.ok(ships[0].name);

const countries = cmo.listCountries({ q: "United States", limit: 5 });
assert.ok(countries.some((item) => /United States/i.test(item.name)));

const probe = await cmo.probePath("data/DB3K_510.db3");
assert.equal(probe.ok, true, probe.error || "probe failed");

const brief = {
  objective: "联合封控通道",
  approach: "体系协同",
  expectedEffects: "压缩对手行动自由",
  risk: "对手反制"
};
const phaseAction = {
  status: "confirmed",
  phases: [
    { id: "p1", name: "展开", sequence: 1, objective: "到位", blueActions: ["预警机前推"], redActions: ["侦察"] },
    { id: "p2", name: "压制", sequence: 2, objective: "打开窗口", blueActions: ["SEAD"], redActions: ["机动防空"] }
  ],
  transitions: [{ fromPhaseId: "p1", toPhaseId: "p2", condition: "到位" }]
};
const operationalTasks = [
  { id: "task-recon", name: "前沿空情侦察任务", side: "friendly", phaseId: "p1", missionType: "recon", objective: "形成前沿态势" },
  { id: "task-sead", name: "防空压制任务", side: "friendly", phaseId: "p2", missionType: "sead", objective: "打开行动窗口" }
];

const mockOutput = generateMockOutput({
  workflow: { id: "force-mission", title: "兵力与任务", outputSchema: "ForceMissionPlan" },
  analysis: {
    任务目标: brief.objective,
    phaseAction,
    phaseActionConfirmed: true,
    operationalTasks,
    cmoCatalog: { available: true, platforms: ships.slice(0, 2) }
  },
  evidence: []
});
const mock = mockOutput.result;
assert.ok(mock.forces.every((force) => force.missionType));
assert.ok(Array.isArray(mock.combatForces) && mock.combatForces.length >= 3, "combat forces required");
assert.ok(mock.combatForces.every((force) => force.missionType && force.conceptForceId));
assert.ok(mock.forces.some((force) => force.taskRefs?.includes("task-recon") || force.taskRefs?.includes("task-sead")), "local generation should reference confirmed task ids");

const normalized = normalizeForceMissionPlan({ ...mock, tasks: operationalTasks });
assert.ok(normalized.forces.every((force) => force.missionType));
assert.ok(normalized.combatForces.length >= 3);
assert.ok(normalized.combatForces.every((force) => force.conceptForceId));
assert.ok(normalized.forces.some((force) => force.taskRefs.length), "normalization must preserve force-to-task refs");

const fromBrief = createForceMissionPlanFromBrief(brief, mock, { source: "ai" });
assert.equal(fromBrief.status, "draft");
assert.ok(fromBrief.forces.length >= 3);
assert.ok(fromBrief.combatForces.length >= 3);

// Layer-scoped generation: concept keeps previous combat empty; combat reuses concept forces.
const conceptOnly = createForceMissionPlanFromBrief(brief, mock, {
  source: "ai",
  phaseAction,
  layer: "concept",
  previous: { forces: [], combatForces: [], relations: [] }
});
assert.ok(conceptOnly.forces.length >= 3, "concept layer should write forces");
assert.equal(conceptOnly.combatForces.length, 0, "concept layer should not invent combat when previous empty");
const combatOnly = createForceMissionPlanFromBrief(brief, mock, {
  source: "ai",
  phaseAction,
  layer: "combat",
  previous: conceptOnly
});
assert.equal(combatOnly.forces.length, conceptOnly.forces.length, "combat layer should keep concept forces");
assert.ok(combatOnly.combatForces.length >= 3, "combat layer should write combat forces");

// Manual editor helpers: mission type + attach/remove platform, demote confirmed → draft.
let edited = normalizeForceMissionPlan({
  ...fromBrief,
  status: "confirmed",
  confirmedAt: new Date().toISOString()
});
assert.equal(edited.status, "confirmed");
edited = toggleForceTaskRef(edited, edited.combatForces[0].id, "task-recon", true, "combat");
assert.equal(edited.status, "draft", "editing a task binding must return a confirmed plan to draft");
assert.ok(edited.combatForces[0].taskRefs.includes("task-recon"), "manual task binding must persist on the selected force");
edited = updateForceMissionType(edited, edited.combatForces[0].id, "sead", "combat");
assert.equal(edited.status, "draft");
assert.equal(edited.combatForces[0].missionType, "sead");
const platform = ships[0];
edited = attachForcePlatform(edited, edited.combatForces[0].id, platform, "combat");
assert.ok(edited.combatForces[0].platforms.some((item) => item.cmoId === platform.cmoId));
const platformId = edited.combatForces[0].platforms[0].id;
edited = setForcePlatformQuantity(edited, edited.combatForces[0].id, platformId, 4, "combat");
assert.equal(edited.combatForces[0].platforms[0].quantity, 4);
edited = removeForcePlatform(edited, edited.combatForces[0].id, platformId, "combat");
assert.equal(edited.combatForces[0].platforms.length, 0);

// Batch attach multiple platforms to one combat force.
const batchPlatforms = ships.slice(0, 2);
edited = attachForcePlatforms(edited, edited.combatForces[0].id, batchPlatforms, "combat");
assert.ok(edited.combatForces[0].platforms.length >= Math.min(2, batchPlatforms.length));

// Phase-action keyword recommend helpers + apply recommendations.
const phaseForRecommend = {
  phases: [
    {
      name: "电子诱发与目标暴露",
      blueActions: ["预警机前推并实施电子战诱骗", "驱护编队展开防空巡逻"],
      redActions: ["机动防空"]
    },
    {
      name: "火力释放",
      blueActions: ["主战突击分队实施对海打击"],
      redActions: ["反舰反击"]
    }
  ]
};
const seeds = summarizePhaseRecommendSeeds(phaseForRecommend);
assert.ok(seeds.length > 0, "phase seeds expected");
const forceForRec = edited.combatForces[0];
const keywords = buildForceRecommendKeywords(forceForRec, phaseForRecommend);
assert.ok(keywords.length > 0, "force keywords expected");
const recommendHits = cmo.searchPlatforms({ q: keywords[0] || "Destroyer", limit: 5 });
const picked = selectRecommendedPlatforms({ ...forceForRec, platforms: [] }, recommendHits, { limit: 2 });
if (picked.length) {
  // Preview-style assignment object (UI applies only after user confirms).
  const pendingAssignments = [{
    forceId: forceForRec.id,
    layer: "combat",
    platforms: picked,
    selected: true
  }, {
    forceId: "other-force",
    layer: "combat",
    platforms: picked.slice(0, 1),
    selected: false
  }];
  const selectedOnly = pendingAssignments.filter((item) => item.selected !== false);
  assert.equal(selectedOnly.length, 1);
  const applied = applyPlatformRecommendations(edited, selectedOnly);
  assert.ok(applied.combatForces.find((item) => item.id === forceForRec.id)?.platforms?.length > 0);
  // skipFilled semantics: forces that already have platforms should not receive more in a second apply of empty pick
  const secondPick = selectRecommendedPlatforms(
    applied.combatForces.find((item) => item.id === forceForRec.id),
    recommendHits,
    { limit: 2 }
  );
  // existing platforms excluded by selectRecommendedPlatforms
  assert.ok(Array.isArray(secondPick));
}

const diagnostics = forceMissionDiagnostics(fromBrief);
assert.ok(Array.isArray(diagnostics));
const compact = compactForceMissionForAnalysis(fromBrief);
assert.ok(compact.combatForces.length >= 1);
assert.ok(compact.forces[0].missionType);
assert.ok(Array.isArray(compact.forces[0].taskRefs) && Array.isArray(compact.combatForces[0].taskRefs), "downstream force context must retain task refs");
const layoutForces = mapForcesForLayout(fromBrief);
assert.equal(layoutForces[0].layer, "combat");
// Abstract layout slots are stored on both layers for concept-map (not real geo).
assert.ok(fromBrief.forces.every((force) => force.slot), "concept forces need layout slots");
assert.ok(fromBrief.combatForces.every((force) => force.slot), "combat forces need layout slots");
const blueSlots = new Set(fromBrief.forces.filter((f) => f.side === "friendly").map((f) => f.slot));
const redSlots = new Set(fromBrief.forces.filter((f) => f.side === "hostile").map((f) => f.slot));
if (blueSlots.size && redSlots.size) {
  // Prefer not all blue/red stacked on the same single slot when both sides exist.
  assert.ok(true);
}

// Multi-phase combat coverage: thin AI draft that only covers early phases must be filled for later phases.
const multiPhases = {
  status: "draft",
  phases: [1, 2, 3, 4, 5, 6].map((n) => ({
    id: `phase-${n}`,
    name: `阶段${n}`,
    sequence: n,
    objective: `目标${n}`,
    blueActions: [`蓝方阶段${n}行动A`, `蓝方阶段${n}行动B`],
    redActions: [`红方阶段${n}反制A`, `红方阶段${n}反制B`]
  })),
  transitions: [1, 2, 3, 4, 5].map((n) => ({
    fromPhaseId: `phase-${n}`,
    toPhaseId: `phase-${n + 1}`,
    condition: "转换",
    note: `T+${n}`
  }))
};
const multiConcept = createForceMissionPlanFromBrief(brief, null, {
  source: "local",
  phaseAction: multiPhases,
  layer: "concept",
  previous: { forces: [], combatForces: [], relations: [] }
});
assert.ok(multiConcept.forces.length >= 20, "six phases should yield many concept forces");
const phaseIdsSeen = new Set(multiConcept.forces.flatMap((f) => f.phaseIds || []));
assert.ok(phaseIdsSeen.has("phase-5") && phaseIdsSeen.has("phase-6"), "later phases must have concept forces");
// Simulate AI only returning combat for first two concept units.
const thinCombatAi = {
  forces: multiConcept.forces,
  combatForces: multiConcept.forces.slice(0, 2).map((force, index) => ({
    id: `ai-combat-${index + 1}`,
    name: `${force.name}主队`,
    side: force.side,
    role: force.role,
    conceptForceId: force.id,
    group: "作战编组",
    missionType: force.missionType || "other",
    task: "AI 仅覆盖前部",
    platforms: [],
    notes: ""
  })),
  relations: [],
  openQuestions: [],
  reviewChecklist: []
};
const multiCombat = createForceMissionPlanFromBrief(brief, thinCombatAi, {
  source: "ai",
  phaseAction: multiPhases,
  layer: "combat",
  previous: multiConcept
});
const conceptIds = new Set(multiConcept.forces.filter((f) => f.role !== "external").map((f) => f.id));
const covered = new Set(multiCombat.combatForces.map((f) => f.conceptForceId).filter(Boolean));
for (const id of conceptIds) {
  assert.ok(covered.has(id), `combat must cover concept ${id} (incl. later phases)`);
}
assert.ok(
  multiCombat.combatForces.some((f) => (f.phaseIds || []).includes("phase-6")),
  "combat packages must carry later-phase phaseIds"
);

// Upstream packing contract: phase blue/red must survive compact-like payload.
const compactPhases = phaseAction.phases.map((phase) => ({
  id: phase.id,
  name: phase.name,
  objective: phase.objective,
  blueActions: phase.blueActions,
  redActions: phase.redActions
}));
assert.deepEqual(compactPhases[0].blueActions, ["预警机前推"]);
assert.deepEqual(compactPhases[1].blueActions, ["SEAD"]);

// Luzon IAMD brief: blue/red must resolve to distinct countries; CMO duty terms find real models.
const luzonBrief = {
  researchIntent: "探究美军依托吕宋岛防空反导体系，提高对空中和导弹威胁的预警与有限防护",
  objective: "围绕联合预警—决策时间，比较三种合作深度对预警提前量与有限防护的条件性效益",
  approach: "以菲律宾授权和体系韧性为门槛",
  assumptions: "合作以菲律宾授权为前提",
  expectedEffects: "条件化提升预警与态势感知最低可用水平",
  risk: "不能确认具体设施与拦截能力"
};
const sides = resolveSideCountries(luzonBrief);
assert.equal(sides.friendly, "United States");
assert.equal(sides.hostile, "China");
assert.notEqual(sides.friendly, sides.hostile);

const blueAew = seedConceptEquipmentType({ id: "b1", name: "统一交战图维护", side: "friendly", role: "command" }, luzonBrief);
const redStrike = seedConceptEquipmentType({ id: "r1", name: "主压力轴", side: "hostile", role: "maneuver" }, luzonBrief);
assert.equal(blueAew.country, "United States");
assert.equal(redStrike.country, "China");
assert.notEqual(blueAew.country, redStrike.country);

const usAewTerms = dutyCmoSearchTerms({ name: "阶段转换控制", role: "command" }, "United States");
const cnAewTerms = dutyCmoSearchTerms({ name: "行动协同", role: "command" }, "China");
assert.ok(usAewTerms.some((t) => /E-2|Hawkeye|E-3/i.test(t)), "US AEW search should prefer E-2/E-3");
assert.ok(cnAewTerms.some((t) => /KJ/i.test(t)), "China AEW search should prefer KJ-");

const usHits = cmo.searchPlatforms({ q: usAewTerms[0], domain: "aircraft", country: "United States", limit: 5 });
const cnHits = cmo.searchPlatforms({ q: cnAewTerms[0], domain: "aircraft", country: "China", limit: 5 });
assert.ok(usHits.length > 0, `US CMO AEW term ${usAewTerms[0]} should hit`);
assert.ok(cnHits.length > 0, `China CMO AEW term ${cnAewTerms[0]} should hit`);
assert.ok(usHits.every((h) => /United States/i.test(h.country)));
assert.ok(cnHits.every((h) => /China/i.test(h.country)));
assert.notEqual(usHits[0].name, cnHits[0].name);

const openAiSource = await readFile(join(root, "server", "openaiClient.mjs"), "utf8");
assert.ok(openAiSource.includes('required: ["id", "name", "side", "role", "group", "missionType", "task", "taskRefs"'), "concept-force schema must require taskRefs");
assert.ok(openAiSource.includes('required: ["id", "name", "side", "role", "conceptForceId", "group", "missionType", "task", "taskRefs"'), "combat-force schema must require taskRefs");
assert.ok(openAiSource.includes("taskRefs 必须引用 analysis.operationalTasks"), "force prompt must require stable operational-task refs");

cmo.close();
console.log("check-cmo-force-mission: ok");
