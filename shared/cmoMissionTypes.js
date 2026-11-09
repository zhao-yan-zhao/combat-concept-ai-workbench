/**
 * CMO-aligned mission / task taxonomy for concept-level force design.
 * Derived from Command: Modern Operations mission classes and EnumLoadoutRole groups.
 * Research abstraction only — not a full mission-editor clone.
 */

export const CMO_MISSION_TYPES = Object.freeze([
  { id: "strike", label: "打击 (Strike)", domain: "multi", cmoHints: ["Strike, Land/Naval", "Strike, Land-only", "Strike, Naval"] },
  { id: "standoff_strike", label: "防区外打击 (Standoff Strike)", domain: "air", cmoHints: ["Standoff Strike"] },
  { id: "sead", label: "防空压制 SEAD", domain: "air", cmoHints: ["SEAD, ARM", "SEAD, TALD"] },
  { id: "dead", label: "防空摧毁 DEAD", domain: "air", cmoHints: ["DEAD"] },
  { id: "bai_cas", label: "战场遮断/近距支援 BAI/CAS", domain: "air", cmoHints: ["BAI/CAS"] },
  { id: "intercept", label: "截击 (Intercept)", domain: "air", cmoHints: ["Intercept"] },
  { id: "air_superiority", label: "制空 (Air Superiority)", domain: "air", cmoHints: ["Air Superiority"] },
  { id: "patrol_aaw", label: "防空巡逻 AAW Patrol", domain: "multi", cmoHints: ["Point-defence", "CAP"] },
  { id: "patrol_asuw", label: "反舰巡逻 ASuW Patrol", domain: "surface", cmoHints: ["Strike, Naval"] },
  { id: "patrol_asw", label: "反潜巡逻 ASW Patrol", domain: "multi", cmoHints: ["ASW Patrol"] },
  { id: "asw_attack", label: "反潜攻击 ASW Attack", domain: "multi", cmoHints: ["ASW Attack"] },
  { id: "recon", label: "侦察 Recon / Surveillance", domain: "multi", cmoHints: ["Armed Recon", "Unarmed Recon", "Area Surveillance", "Maritime Surveillance"] },
  { id: "aew", label: "空中预警 AEW", domain: "air", cmoHints: ["Airborne Early Warning"] },
  { id: "ecm", label: "电子对抗 ECM", domain: "air", cmoHints: ["Offensive ECM"] },
  { id: "escort", label: "护航 Escort", domain: "multi", cmoHints: ["Escort"] },
  { id: "support", label: "支援 Support", domain: "multi", cmoHints: ["Support"] },
  { id: "command", label: "指挥控制 C2 / ACP", domain: "multi", cmoHints: ["Airborne Command Post"] },
  { id: "ferry", label: "转场 Ferry", domain: "multi", cmoHints: ["Ferry", "Armed Ferry"] },
  { id: "cargo", label: "运输 Cargo / Troop Transport", domain: "multi", cmoHints: ["Cargo Transport", "Troop Transport", "Paratroops"] },
  { id: "tanker", label: "空中加油 Tanker", domain: "air", cmoHints: ["Air Refueling"] },
  { id: "sar", label: "搜救 SAR / CSAR", domain: "air", cmoHints: ["Search And Rescue", "Combat Search And Rescue"] },
  { id: "mining", label: "布雷 Mining", domain: "surface", cmoHints: ["Naval Mine Laying"] },
  { id: "mcm", label: "扫雷/猎雷 MCM", domain: "surface", cmoHints: ["Mine Sweep", "Mine Reconnaissance"] },
  { id: "landing", label: "登陆/投送 Landing", domain: "multi", cmoHints: ["Landing", "Troop Transport"] },
  { id: "area_defense", label: "区域/要地防御", domain: "ground", cmoHints: ["Point-defence"] },
  { id: "other", label: "其他/概念任务", domain: "multi", cmoHints: [] }
]);

export const CMO_MISSION_TYPE_IDS = new Set(CMO_MISSION_TYPES.map((item) => item.id));

export const CMO_PLATFORM_DOMAINS = Object.freeze([
  "aircraft",
  "ship",
  "submarine",
  "ground",
  "facility",
  "satellite"
]);

export function listCmoMissionTypes() {
  return CMO_MISSION_TYPES.map((item) => ({
    id: item.id,
    label: item.label,
    domain: item.domain
  }));
}

export function normalizeCmoMissionType(value, fallback = "other") {
  const id = String(value || "").trim();
  return CMO_MISSION_TYPE_IDS.has(id) ? id : fallback;
}

export function cmoMissionTypeLabel(value) {
  const id = normalizeCmoMissionType(value, "");
  return CMO_MISSION_TYPES.find((item) => item.id === id)?.label || "其他/概念任务";
}

export function isCmoPlatformDomain(value) {
  return CMO_PLATFORM_DOMAINS.includes(String(value || "").trim());
}

/**
 * CMO 装备定性能力族 (Capability Families) 定义
 * 仅用于定性任务能力匹配校核，严格禁止引入任何杀伤范围或真实作战性能参数。
 */
export const CMO_CAPABILITY_FAMILIES = Object.freeze({
  air_superiority: { id: "air_superiority", label: "制空截击", description: "夺取制空权、空中截击、护航巡逻与空空交战能力" },
  strike: { id: "strike", label: "对地对海突击", description: "防区内外对陆对海常规精确打击、火力遮断与近距空中支援能力" },
  sead: { id: "sead", label: "防空压制", description: "反辐射突击、防空系统压制与雷达硬摧毁能力" },
  aew: { id: "aew", label: "空中预警", description: "广域空空/空海雷达预警、态势融合与机载引导指挥能力" },
  ew: { id: "ew", label: "电子对抗", description: "全频谱电子侦察、防区外掩护干扰、自卫干扰与欺骗诱骗能力" },
  asw: { id: "asw", label: "反潜作战", description: "声学与非声探测、攻潜武器投送与水下立体封锁能力" },
  surface_combat: { id: "surface_combat", label: "水面作战", description: "水面主战、反舰打击、海区控制与编队护卫能力" },
  subsurface_combat: { id: "subsurface_combat", label: "水下作战", description: "潜艇隐蔽伏击、水下隐蔽打击与反潜巡航能力" },
  c2_relay: { id: "c2_relay", label: "指控通信中继", description: "机载/地面指挥所、战术数据链骨干路由与超视距通信中继能力" },
  isr: { id: "isr", label: "侦察监视情报", description: "长航时高空战术侦察、光电红外监视与海上广域监视能力" },
  logistics: { id: "logistics", label: "投送运输保障", description: "空海战略/战术运输、空中加油、人员投送与后勤补给能力" },
  air_defense: { id: "air_defense", label: "防空反导", description: "地空/舰空区域防空、点防空要地拦截与末端反导能力" },
  mine_warfare: { id: "mine_warfare", label: "水雷战", description: "攻势布雷、航道扫雷与水雷侦察探测能力" }
});

export const CMO_CAPABILITY_FAMILY_IDS = new Set(Object.keys(CMO_CAPABILITY_FAMILIES));

/**
 * 任务类型 -> 规范所需的能力族映射
 */
const MISSION_REQUIRED_CAPABILITIES = Object.freeze({
  strike: ["strike"],
  standoff_strike: ["strike"],
  sead: ["sead", "ew"],
  dead: ["sead", "strike"],
  bai_cas: ["strike"],
  intercept: ["air_superiority"],
  air_superiority: ["air_superiority"],
  patrol_aaw: ["air_defense", "air_superiority"],
  patrol_asuw: ["surface_combat", "strike"],
  patrol_asw: ["asw"],
  asw_attack: ["asw", "subsurface_combat"],
  recon: ["isr"],
  aew: ["aew"],
  ecm: ["ew"],
  escort: ["air_superiority", "surface_combat", "air_defense"],
  support: ["logistics", "c2_relay", "ew", "isr"],
  command: ["c2_relay"],
  ferry: ["logistics"],
  cargo: ["logistics"],
  tanker: ["logistics"],
  sar: ["logistics", "isr"],
  mining: ["mine_warfare"],
  mcm: ["mine_warfare"],
  landing: ["logistics", "surface_combat"],
  area_defense: ["air_defense"],
  other: []
});

/**
 * 获取任务类型所需的能力族集合
 * @param {string} missionType
 * @returns {string[]}
 */
export function getRequiredCapabilityFamiliesForMission(missionType) {
  const norm = normalizeCmoMissionType(missionType, "other");
  return MISSION_REQUIRED_CAPABILITIES[norm] || [];
}

/**
 * 获取能力族的中文可读标签
 * @param {string} familyId
 * @returns {string}
 */
export function getCapabilityFamilyLabel(familyId) {
  return CMO_CAPABILITY_FAMILIES[familyId]?.label || familyId;
}

/**
 * 从平台元数据中提取定性能力画像（纯定性标签集合）
 * @param {object} platform
 * @returns {string[]}
 */
export function extractPlatformCapabilityFamily(platform = {}) {
  const domain = String(platform.domain || "").toLowerCase().trim();
  const category = String(platform.category || "").toLowerCase().trim();
  const name = String(platform.name || "").toLowerCase().trim();
  const comments = String(platform.comments || "").toLowerCase().trim();
  const text = `${category} ${name} ${comments}`;

  const families = new Set();

  if (domain === "aircraft") {
    if (/fighter|interceptor|air superiority|f-15c|f-22|su-27|su-35|j-11|j-20|eurofighter|gripen/.test(text)) {
      families.add("air_superiority");
    }
    if (/attack|strike|bomber|f-15e|f\/a-18|su-34|su-25|a-10|jh-7|h-6|b-1|b-2|b-52/.test(text)) {
      families.add("strike");
    }
    if (/electronic warfare|wild weasel|ea-18|ea-6|j-16d|ecm|ew|jammer/.test(text)) {
      families.add("ew");
      families.add("sead");
    }
    if (/airborne early warning|aew|awacs|e-2|e-3|e-7|kj-200|kj-500|kj-2000/.test(text)) {
      families.add("aew");
      families.add("c2_relay");
      families.add("isr");
    }
    if (/asw|anti-submarine|patrol|maritime patrol|mpa|p-8|p-3|y-8q|tu-142/.test(text)) {
      families.add("asw");
      families.add("isr");
    }
    if (/tanker|cargo|transport|refueling|c-130|c-17|c-5|y-20|il-76|kc-135|kc-46/.test(text)) {
      families.add("logistics");
    }
    if (/recon|surveillance|uav|drone|rq-4|mq-9|wz-7|u-2/.test(text)) {
      families.add("isr");
    }
    if (/command post|acp|e-4|il-80/.test(text)) {
      families.add("c2_relay");
    }
    // 兜底：通用航空平台默认包含 strike 或 air_superiority
    if (families.size === 0) {
      if (/multi-role|multirole|fighter/.test(text)) {
        families.add("air_superiority");
        families.add("strike");
      } else {
        families.add("strike");
      }
    }
  } else if (domain === "ship") {
    if (/carrier|cvn|cv/.test(text)) {
      families.add("air_superiority");
      families.add("strike");
      families.add("c2_relay");
    }
    if (/destroyer|ddg|cruiser|cg/.test(text)) {
      families.add("surface_combat");
      families.add("air_defense");
      families.add("strike");
      families.add("asw");
    }
    if (/frigate|ffg|corvette|fs/.test(text)) {
      families.add("surface_combat");
      families.add("asw");
      families.add("air_defense");
    }
    if (/mine|mcm|mhc|minesweeper/.test(text)) {
      families.add("mine_warfare");
    }
    if (/amphibious|lhd|lpd|lst|landing|logistics|auxiliary|tanker|aoe|supply/.test(text)) {
      families.add("logistics");
    }
    if (families.size === 0) {
      families.add("surface_combat");
    }
  } else if (domain === "submarine") {
    families.add("subsurface_combat");
    families.add("asw");
    if (/guided missile|ssgn|ssbn|strike|cruise missile/.test(text)) {
      families.add("strike");
    }
  } else if (domain === "ground" || domain === "facility") {
    if (/sam|air defense|patriot|hq-9|s-300|s-400|nasams|point-defence/.test(text)) {
      families.add("air_defense");
    }
    if (/radar|sensor|early warning|surveillance/.test(text)) {
      families.add("isr");
    }
    if (/c2|command|hq|operations center/.test(text)) {
      families.add("c2_relay");
    }
    if (/artillery|rocket|ssm|missile launcher|howitzer/.test(text)) {
      families.add("strike");
    }
    if (/logistics|depot|supply|ammunition/.test(text)) {
      families.add("logistics");
    }
    if (families.size === 0) {
      families.add("air_defense");
    }
  } else if (domain === "satellite") {
    families.add("isr");
    if (/comm|relay/.test(text)) {
      families.add("c2_relay");
    }
  } else {
    // 未知域兜底
    families.add("strike");
  }

  return Array.from(families);
}

/**
 * 校核作战兵力任务类型与其实际挂载 CMO 平台的能力族匹配度
 * @param {object} force 作战兵力对象
 * @returns {{
 *   aligned: boolean,
 *   missionType: string,
 *   requiredFamilies: string[],
 *   actualFamilies: string[],
 *   matchedFamilies: string[],
 *   missingFamilies: string[]
 * }}
 */
export function checkForcePlatformAlignment(force = {}) {
  const missionType = normalizeCmoMissionType(force.missionType, "other");
  const requiredFamilies = getRequiredCapabilityFamiliesForMission(missionType);
  const platforms = Array.isArray(force.platforms) ? force.platforms : [];

  if (requiredFamilies.length === 0 || platforms.length === 0) {
    return {
      aligned: true,
      missionType,
      requiredFamilies,
      actualFamilies: [],
      matchedFamilies: [],
      missingFamilies: []
    };
  }

  const actualFamiliesSet = new Set();
  for (const platform of platforms) {
    const list = Array.isArray(platform.capabilities) && platform.capabilities.length > 0
      ? platform.capabilities
      : extractPlatformCapabilityFamily(platform);
    for (const fam of list) {
      actualFamiliesSet.add(fam);
    }
  }

  const actualFamilies = Array.from(actualFamiliesSet);
  const matchedFamilies = requiredFamilies.filter((item) => actualFamiliesSet.has(item));
  const missingFamilies = requiredFamilies.filter((item) => !actualFamiliesSet.has(item));
  const aligned = matchedFamilies.length > 0;

  return {
    aligned,
    missionType,
    requiredFamilies,
    actualFamilies,
    matchedFamilies,
    missingFamilies
  };
}
