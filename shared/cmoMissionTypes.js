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
