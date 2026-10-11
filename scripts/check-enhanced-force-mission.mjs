import assert from "node:assert/strict";
import {
  createEmptyForceMissionPlan,
  normalizeForceMissionPlan,
  confirmConceptForcePlan,
  confirmCombatForcePlan,
  confirmForceMissionPlan,
  isConceptForcePlanConfirmed,
  isCombatForcePlanConfirmed,
  isForceMissionPlanConfirmed,
  conceptForcePlanIncompleteReasons,
  forceMissionPlanIncompleteReasons,
  updateCombatForcePackageType,
  updateCombatForceConceptLinks,
  inferCombatPackageType,
  conceptForceContextForOv1,
  conceptForceEquipmentLabel,
  partitionConceptForcesForOv1,
  COMBAT_PACKAGE_TYPES
} from "../shared/conceptPlanning.js";

console.log("Starting check-enhanced-force-mission...");

// 1. Verify COMBAT_PACKAGE_TYPES set
assert.ok(Array.isArray(COMBAT_PACKAGE_TYPES));
assert.ok(COMBAT_PACKAGE_TYPES.length >= 7);
assert.ok(COMBAT_PACKAGE_TYPES.some((p) => p.id === "main"));
assert.ok(COMBAT_PACKAGE_TYPES.some((p) => p.id === "sead"));
assert.ok(COMBAT_PACKAGE_TYPES.some((p) => p.id === "tanker"));

// 2. Verify inferCombatPackageType
assert.equal(inferCombatPackageType("air", "sead"), "sead");
assert.equal(inferCombatPackageType("support", "tanker"), "tanker");
assert.equal(inferCombatPackageType("sense", "recon"), "recon");
assert.equal(inferCombatPackageType("maneuver", "strike"), "main");

// 3. Verify normalization with enhanced fields (platformSpecs, conceptForceIds, packageType)
const rawPlan = {
  tasks: [
    { id: "task-1", name: "防空巡逻", side: "friendly", missionType: "patrol_aaw" }
  ],
  tasksConfirmedAt: "2026-10-11T00:00:00.000Z",
  forces: [
    {
      id: "cf-1",
      name: "空中制空与压制编组",
      side: "friendly",
      role: "air",
      task: "夺取制空权并压制敌防空",
      platformSpecs: [
        {
          name: "隐身制空作战平台",
          role: "air",
          domain: "aircraft",
          specs: { stealth: "VLO", speed: "Mach 2.0", combatRadiusNm: 600 }
        },
        {
          name: "防空压制无人僚机",
          role: "air",
          domain: "aircraft",
          specs: { autonomy: "High", payloadKg: 800 }
        }
      ],
      platforms: [
        { id: "p-1", name: "J-20A", domain: "aircraft", cmoId: 101, quantity: 1 },
        { id: "p-2", name: "J-16D", domain: "aircraft", cmoId: 102, quantity: 1 }
      ]
    },
    {
      id: "cf-2",
      name: "预警监视概念单元",
      side: "friendly",
      role: "sense",
      task: "区域预警与目标交接",
      platforms: [
        { id: "p-3", name: "KJ-500", domain: "aircraft", cmoId: 103, quantity: 1 }
      ]
    }
  ],
  combatForces: [
    {
      id: "cbt-1",
      name: "主战突击机群",
      side: "friendly",
      role: "air",
      missionType: "air_superiority",
      packageType: "main",
      conceptForceIds: ["cf-1"],
      platforms: [
        { id: "cp-1", name: "J-20A", domain: "aircraft", cmoId: 101, quantity: 8, loadoutRole: "strike" }
      ]
    },
    {
      id: "cbt-2",
      name: "伴随电抗护航分队",
      side: "friendly",
      role: "air",
      missionType: "sead",
      packageType: "sead",
      conceptForceIds: ["cf-1"],
      platforms: [
        { id: "cp-2", name: "J-16D", domain: "aircraft", cmoId: 102, quantity: 4, loadoutRole: "sead" }
      ]
    }
  ]
};

const normalized = normalizeForceMissionPlan(rawPlan);

// Check concept force platformSpecs & platforms
assert.equal(normalized.forces.length, 2);
assert.equal(normalized.forces[0].platformSpecs.length, 2);
assert.equal(normalized.forces[0].platformSpecs[0].specs.stealth, "VLO");
assert.equal(normalized.forces[0].platforms.length, 2); // Supports up to 3 platforms

// Check combat forces conceptForceIds & backward compatible conceptForceId
assert.equal(normalized.combatForces.length, 2);
assert.deepEqual(normalized.combatForces[0].conceptForceIds, ["cf-1"]);
assert.equal(normalized.combatForces[0].conceptForceId, "cf-1");
assert.equal(normalized.combatForces[0].packageType, "main");
assert.equal(normalized.combatForces[1].packageType, "sead");
assert.equal(normalized.combatForces[0].platforms[0].loadoutRole, "strike");

// Check conceptForceEquipmentLabel fallback and platform priority
const label = conceptForceEquipmentLabel(normalized.forces[0]);
assert.equal(label, "J-20A");

// Check fallback to platformSpecs when platforms are empty
const specOnlyForce = {
  id: "cf-spec",
  name: "先进概念感知单元",
  role: "sense",
  platforms: [],
  platformSpecs: [{ name: "高空长航时战略预警无人机", role: "sense" }]
};
const specLabel = conceptForceEquipmentLabel(specOnlyForce);
assert.equal(specLabel, "高空长航时战略预警无人机");

// 4. Verify Backward Compatibility Migration:
// Legacy plan has single conceptForceId and no packageType or platformSpecs
const legacyPlan = {
  tasks: [{ id: "t-1", name: "护航巡逻", side: "friendly" }],
  tasksConfirmedAt: "2026-10-10T00:00:00Z",
  forces: [
    {
      id: "cf-old",
      name: "老式概念编成",
      side: "friendly",
      role: "support",
      platforms: [{ id: "p-old", name: "KC-135", cmoId: 50 }]
    }
  ],
  combatForces: [
    {
      id: "cbt-old",
      name: "老式加油分队",
      side: "friendly",
      role: "support",
      missionType: "tanker",
      conceptForceId: "cf-old", // legacy scalar link
      platforms: [{ id: "p-cbt", name: "KC-135", quantity: 2 }]
    }
  ]
};

const migrated = normalizeForceMissionPlan(legacyPlan);
assert.deepEqual(migrated.combatForces[0].conceptForceIds, ["cf-old"]);
assert.equal(migrated.combatForces[0].conceptForceId, "cf-old");
assert.equal(migrated.combatForces[0].packageType, "tanker"); // inferred from missionType
assert.equal(migrated.forces[0].platformSpecs.length, 1); // auto-generated spec placeholder

// 5. Verify Two-Stage Independent Gating & Confirmation:
// Initially, plan is draft
assert.equal(isConceptForcePlanConfirmed(normalized), false);
assert.equal(isCombatForcePlanConfirmed(normalized), false);
assert.equal(isForceMissionPlanConfirmed(normalized), false);

// Stage 1: Confirm Concept Forces
const conceptConfirmed = confirmConceptForcePlan(normalized, { reviewNotes: "概念能力单元核验通过" });
assert.equal(conceptConfirmed.conceptStatus, "confirmed");
assert.ok(conceptConfirmed.conceptConfirmedAt);
assert.equal(isConceptForcePlanConfirmed(conceptConfirmed), true);
assert.equal(isCombatForcePlanConfirmed(conceptConfirmed), false); // Combat not yet confirmed
assert.equal(isForceMissionPlanConfirmed(conceptConfirmed), false); // Full plan not yet confirmed

// Verify that OV-1 context is available as soon as Concept Forces are confirmed!
const ov1Prompt = conceptForceContextForOv1(conceptConfirmed);
assert.ok(typeof ov1Prompt === "string");
assert.ok(ov1Prompt.includes("OV-1 按研究主体"));
const { subjectForces } = partitionConceptForcesForOv1(conceptConfirmed);
assert.ok(subjectForces.length > 0);

// Stage 2: Confirm Combat Forces (or Full Plan)
const fullConfirmed = confirmForceMissionPlan(conceptConfirmed, { reviewNotes: "全量编成核验通过" });
assert.equal(fullConfirmed.conceptStatus, "confirmed");
assert.equal(fullConfirmed.combatStatus, "confirmed");
assert.equal(fullConfirmed.status, "confirmed");
assert.equal(isConceptForcePlanConfirmed(fullConfirmed), true);
assert.equal(isCombatForcePlanConfirmed(fullConfirmed), true);
assert.equal(isForceMissionPlanConfirmed(fullConfirmed), true);

// Incomplete reasons check
assert.deepEqual(conceptForcePlanIncompleteReasons(conceptConfirmed), []);
assert.deepEqual(forceMissionPlanIncompleteReasons(fullConfirmed), []);

// 6. Verify Store Mutators:
// updateCombatForcePackageType
const pkgUpdated = updateCombatForcePackageType(normalized, "cbt-1", "escort");
assert.equal(pkgUpdated.combatForces.find((f) => f.id === "cbt-1").packageType, "escort");

// updateCombatForceConceptLinks (multi-link)
const multiLinked = updateCombatForceConceptLinks(normalized, "cbt-1", ["cf-1", "cf-2"]);
const cbt1 = multiLinked.combatForces.find((f) => f.id === "cbt-1");
assert.deepEqual(cbt1.conceptForceIds, ["cf-1", "cf-2"]);
assert.equal(cbt1.conceptForceId, "cf-1"); // mirrored to first element for backward compat

console.log("check-enhanced-force-mission: all assertions passed successfully!");
