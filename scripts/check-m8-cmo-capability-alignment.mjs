/**
 * 验收脚本：M8-T8.9 CMO 装备库定性能力画像提取与“任务—平台能力”匹配度校核
 */
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CMO_CAPABILITY_FAMILIES,
  getRequiredCapabilityFamiliesForMission,
  getCapabilityFamilyLabel,
  extractPlatformCapabilityFamily,
  checkForcePlatformAlignment
} from "../shared/cmoMissionTypes.js";
import { createCmoDatabaseService } from "../server/cmoDatabase.mjs";
import { generateValidation } from "../design-studio/src/validationStore.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = join(root, "data", "cmo-database-config.json");

console.log("=== 1. 检验 CMO 定性能力族定义与映射契约 ===");
assert.ok(Object.keys(CMO_CAPABILITY_FAMILIES).length >= 10, "能力族常数需定义完整");
assert.equal(getCapabilityFamilyLabel("air_superiority"), "制空截击");
assert.equal(getCapabilityFamilyLabel("ew"), "电子对抗");

const seadReq = getRequiredCapabilityFamiliesForMission("sead");
assert.ok(seadReq.includes("sead") || seadReq.includes("ew"), "SEAD任务需依赖反辐射或电子对抗能力");
const aswReq = getRequiredCapabilityFamiliesForMission("patrol_asw");
assert.ok(aswReq.includes("asw"), "反潜任务需依赖反潜能力");
const aewReq = getRequiredCapabilityFamiliesForMission("aew");
assert.ok(aewReq.includes("aew"), "空中预警任务需依赖预警能力");
console.log("✓ 定性能力族与任务映射契约验证通过");

console.log("=== 2. 检验定性能力画像提取纯函数 (extractPlatformCapabilityFamily) ===");
const ea18 = extractPlatformCapabilityFamily({
  domain: "aircraft",
  category: "Electronic Warfare",
  name: "EA-18G Growler",
  comments: "Airborne electronic attack aircraft"
});
assert.ok(ea18.includes("ew"), "EA-18G 必须包含 ew 能力");
assert.ok(ea18.includes("sead"), "EA-18G 必须包含 sead 能力");

const e2d = extractPlatformCapabilityFamily({
  domain: "aircraft",
  category: "Airborne Early Warning",
  name: "E-2D Advanced Hawkeye",
  comments: "Carrier-capable tactical airborne early warning"
});
assert.ok(e2d.includes("aew"), "E-2D 必须包含 aew 能力");
assert.ok(e2d.includes("c2_relay"), "E-2D 必须包含 c2_relay 能力");

const p8 = extractPlatformCapabilityFamily({
  domain: "aircraft",
  category: "Maritime Patrol",
  name: "P-8A Poseidon",
  comments: "Anti-submarine and anti-surface warfare"
});
assert.ok(p8.includes("asw"), "P-8A 必须包含 asw 能力");

const c17 = extractPlatformCapabilityFamily({
  domain: "aircraft",
  category: "Transport",
  name: "C-17 Globemaster III",
  comments: "Strategic military transport"
});
assert.ok(c17.includes("logistics"), "C-17 必须包含 logistics 能力");
assert.ok(!c17.includes("asw"), "C-17 纯运输机不能包含 asw 能力");
assert.ok(!c17.includes("ew"), "C-17 纯运输机不能包含 ew 能力");

const ddg = extractPlatformCapabilityFamily({
  domain: "ship",
  category: "Guided Missile Destroyer",
  name: "DDG-51 Arleigh Burke Flight IIA",
  comments: "Aegis destroyer"
});
assert.ok(ddg.includes("surface_combat") && ddg.includes("air_defense") && ddg.includes("asw"), "驱逐舰具备多任务作战能力画像");
console.log("✓ 定性能力画像提取纯函数验证通过");

console.log("=== 3. 检验兵力与平台匹配度校核函数 (checkForcePlatformAlignment) ===");
const alignedForce = {
  id: "force-ew-01",
  name: "远距离掩护电子战机分队",
  missionType: "ecm",
  platforms: [
    { cmoId: 101, domain: "aircraft", name: "EA-18G", category: "Electronic Warfare" }
  ]
};
const alignResult1 = checkForcePlatformAlignment(alignedForce);
assert.equal(alignResult1.aligned, true, "电子战兵力挂载 EA-18G 应该匹配");

const misalignedForce = {
  id: "force-asw-01",
  name: "广域反潜巡逻编组",
  missionType: "patrol_asw",
  platforms: [
    { cmoId: 102, domain: "aircraft", name: "C-17 Globemaster", category: "Transport" }
  ]
};
const alignResult2 = checkForcePlatformAlignment(misalignedForce);
assert.equal(alignResult2.aligned, false, "反潜兵力挂载纯运输机应该失配");
assert.ok(alignResult2.missingFamilies.includes("asw"), "应提示缺失 asw 反潜能力族");
console.log("✓ 兵力任务与挂载平台能力校核函数验证通过");

console.log("=== 4. 检验 CMO 服务返回数据注入能力画像 ===");
const cmo = createCmoDatabaseService({ root, configPath });
await cmo.loadConfig();
const searchHits = cmo.searchPlatforms({ q: "Arleigh", domain: "ship", limit: 3 });
assert.ok(searchHits.length > 0, "应能搜索到驱逐舰数据");
assert.ok(Array.isArray(searchHits[0].capabilities) && searchHits[0].capabilities.length > 0, "检索出的平台必须包含 capabilities 数组");
assert.ok(searchHits[0].capabilities.includes("surface_combat"), "驱逐舰必须具有 surface_combat 能力");

const platform = cmo.getPlatform("ship", searchHits[0].cmoId);
assert.ok(platform, "应能根据ID查到平台");
assert.ok(Array.isArray(platform.capabilities) && platform.capabilities.length > 0, "单个平台详情必须包含 capabilities 数组");
console.log("✓ CMO 服务返回能力画像验证通过");

console.log("=== 5. 检验验证引擎 (generateValidation) 形式化诊断与视图定位 ===");
const ov5Model = {
  activities: [
    { id: "act-1", title: "前沿空情搜集", input: "雷达信号", output: "态势航迹" },
    { id: "act-2", title: "突防火力打击", input: "态势航迹", output: "毁伤战果" }
  ],
  edges: [
    { id: "e1", sourceId: "act-1", targetId: "act-2" }
  ]
};
const oodaModel = {
  lanes: [
    { id: "l1", nodes: [{ id: "o1", title: "态势侦巡", duration: "10m", input: "雷达", output: "报文" }] },
    { id: "l2", nodes: [{ id: "o2", title: "威胁评估", duration: "5m", input: "报文", output: "指令" }] },
    { id: "l3", nodes: [{ id: "o3", title: "任务分配", duration: "5m", input: "指令", output: "意图" }] },
    { id: "l4", nodes: [{ id: "o4", title: "协同突击", duration: "5m", input: "意图", output: "战果" }] }
  ]
};
const mockForceMission = {
  combatForces: [
    {
      id: "cf-misaligned",
      name: "反潜前出搜潜分队",
      missionType: "patrol_asw",
      platforms: [
        { cmoId: 999, domain: "aircraft", name: "C-17 运输机", category: "Transport" }
      ]
    },
    {
      id: "cf-aligned",
      name: "远距制空截击机队",
      missionType: "air_superiority",
      platforms: [
        { cmoId: 888, domain: "aircraft", name: "F-15C", category: "Fighter" }
      ]
    }
  ]
};

const validationResult = generateValidation(ov5Model, oodaModel, null, null, {
  forceMission: mockForceMission
});

const mismatchIssue = validationResult.issues.find((issue) => issue.title === "作战兵力任务与挂载平台能力族失配");
assert.ok(mismatchIssue, "必须检出兵力任务与平台能力族失配问题");
assert.equal(mismatchIssue.targetView, "force-mission", "失配问题定位目标视图必须为 force-mission");
assert.equal(mismatchIssue.targetElementId, "cf-misaligned", "定位要素 ID 必须是失配的兵力 ID");
assert.ok(mismatchIssue.text.includes("反潜作战"), "说明中应提及缺失的能力族说明");
console.log("✓ 验证引擎自动诊断与视图精准定位通过");

console.log("\n>>> M8-T8.9 CMO 装备库定性画像与任务匹配度校核全量通过！ <<<");
