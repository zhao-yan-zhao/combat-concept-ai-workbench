/**
 * Keyword extraction and domain hints for recommending CMO platforms
 * from phase actions / force tasks (research-level, not employment guidance).
 */

import { cmoMissionTypeLabel } from "./cmoMissionTypes.js";

/** Mission type / role → preferred CMO domains (ordered). */
const MISSION_DOMAINS = Object.freeze({
  strike: ["aircraft", "ship", "ground"],
  standoff_strike: ["aircraft", "ship"],
  sead: ["aircraft"],
  dead: ["aircraft"],
  bai_cas: ["aircraft", "ground"],
  intercept: ["aircraft"],
  air_superiority: ["aircraft"],
  patrol_aaw: ["ship", "aircraft", "ground"],
  patrol_asuw: ["ship", "aircraft"],
  patrol_asw: ["ship", "submarine", "aircraft"],
  asw_attack: ["ship", "submarine", "aircraft"],
  recon: ["aircraft", "satellite", "ship"],
  aew: ["aircraft"],
  ecm: ["aircraft"],
  escort: ["ship", "aircraft"],
  support: ["ship", "aircraft", "ground"],
  command: ["aircraft", "ship", "facility"],
  ferry: ["aircraft"],
  cargo: ["aircraft", "ship"],
  tanker: ["aircraft"],
  sar: ["aircraft"],
  mining: ["ship"],
  mcm: ["ship"],
  landing: ["ship", "ground"],
  area_defense: ["ground", "facility", "ship"],
  other: ["aircraft", "ship", "ground"]
});

const ROLE_DOMAINS = Object.freeze({
  sense: ["aircraft", "satellite", "ship"],
  command: ["aircraft", "ship", "facility"],
  maneuver: ["aircraft", "ship", "ground"],
  air: ["aircraft"],
  airDefense: ["ground", "ship", "aircraft"],
  surface: ["ship"],
  support: ["ship", "aircraft", "ground"],
  external: ["ship", "aircraft", "ground"]
});

/** Chinese / ops terms → English CMO search seeds (DB3 names are mostly English). */
const TERM_SEEDS = Object.freeze([
  [/预警机|空中预警|AEW|交战图|航迹融合/i, ["E-2D", "E-2C", "E-3", "Hawkeye", "KJ-500", "AEW"]],
  [/电子战|电子对抗|ECM|SEAD|防空压制|诱偏/i, ["EA-18", "Growler", "EA-6", "J-16D", "EW"]],
  [/战斗机|歼击|制空|截击|护航/i, ["F-15", "F-16", "F-35", "J-16", "J-10", "Su-30"]],
  [/轰炸机|对地打击|对海打击|突防|主压力|打击/i, ["F-15E", "F/A-18", "H-6", "Su-34", "Strike"]],
  [/加油机|空中加油/i, ["KC-135", "KC-46", "YY-20", "Il-78", "Tanker"]],
  [/运输机|空运|投送/i, ["C-130", "C-17", "Y-20", "Il-76", "Transport"]],
  [/无人机|察打一体/i, ["UAV", "MQ-9", "RQ-4", "WZ-"]],
  [/巡逻|反潜|MPA|海上巡逻|传感器管|目标监视/i, ["P-8", "P-3", "Poseidon", "Y-8Q", "MPA"]],
  [/驱逐舰|驱护|水面主战/i, ["Arleigh", "Burke", "Type 052", "Type 055", "Destroyer"]],
  [/护卫舰/i, ["Frigate", "FFG", "Type 054"]],
  [/航母|航空母舰/i, ["Carrier", "CVN", "CV"]],
  [/两栖|登陆舰|船坞/i, ["LHD", "LPD", "Amphibious"]],
  [/潜艇|反潜|水下/i, ["Submarine", "SSN", "SSK"]],
  [/扫雷|猎雷|布雷/i, ["Mine", "MCM", "MHC"]],
  [/防空|地空导弹|要地防御|末端|点防/i, ["Patriot", "HQ-9", "S-300", "NASAMS", "SAM"]],
  [/雷达|侦察|监视|传感/i, ["Radar", "Recon", "Surveillance", "P-8", "Y-8"]],
  [/指挥|C2|指挥所|授权|控制/i, ["E-2", "E-3", "KJ-500", "Command"]],
  [/补给|保障|油弹|后勤|生存/i, ["HEMTT", "Support", "Logistics", "Truck", "AOE"]]
]);

const STOP = new Set([
  "围绕", "形成", "支撑", "组织", "遂行", "进行", "实施", "完成", "阶段", "目标", "行动",
  "蓝方", "红方", "概念", "研究", "以及", "或者", "进行中", "主要", "关键", "持续",
  "the", "and", "for", "with", "from", "into", "that", "this"
]);

export function preferredDomainsForForce(force = {}) {
  const mission = String(force.missionType || "").trim();
  const role = String(force.role || "").trim();
  const fromMission = MISSION_DOMAINS[mission] || [];
  const fromRole = ROLE_DOMAINS[role] || [];
  return unique([...fromMission, ...fromRole, "aircraft", "ship"]).slice(0, 4);
}

/**
 * Build search keywords for one force from its fields + phase actions.
 */
export function buildForceRecommendKeywords(force = {}, phaseAction = {}, { max = 8 } = {}) {
  const phases = Array.isArray(phaseAction?.phases) ? phaseAction.phases : [];
  const phaseText = phases.flatMap((phase) => [
    phase.name,
    phase.objective,
    ...(phase.blueActions || phase.primaryActions || []),
    ...(phase.redActions || phase.secondaryActions || [])
  ]).join(" ");
  const raw = [
    force.name,
    force.task,
    force.group,
    cmoMissionTypeLabel(force.missionType),
    force.missionType,
    phaseText
  ].filter(Boolean).join(" ");

  const seeds = [];
  for (const [pattern, terms] of TERM_SEEDS) {
    if (pattern.test(raw)) seeds.push(...terms);
  }
  const tokens = tokenize(raw);
  const ranked = unique([...seeds, ...tokens])
    .filter((item) => item.length >= 2 && item.length <= 28 && !STOP.has(item.toLowerCase()))
    .sort((a, b) => scoreToken(b, force) - scoreToken(a, force) || b.length - a.length);
  return ranked.slice(0, max);
}

/**
 * Pick up to `limit` platforms for a force from multi-query search hits.
 * @param {object[]} hits flat list of CMO platform hits
 */
export function selectRecommendedPlatforms(force = {}, hits = [], { limit = 2 } = {}) {
  const domains = preferredDomainsForForce(force);
  const existing = new Set(
    (force.platforms || []).map((item) => `${item.domain}:${item.cmoId}`).filter((key) => !key.endsWith(":0"))
  );
  const scored = (Array.isArray(hits) ? hits : [])
    .filter((hit) => hit?.name && hit?.domain)
    .map((hit) => {
      const key = `${hit.domain}:${hit.cmoId || 0}`;
      const domainScore = domains.indexOf(hit.domain);
      return {
        hit,
        key,
        score:
          (domainScore >= 0 ? (domains.length - domainScore) * 10 : 0)
          + (Number(hit.cmoId) > 0 ? 2 : 0)
          + Math.min(String(hit.name).length, 40) / 40
      };
    })
    .filter((item) => !existing.has(item.key))
    .sort((a, b) => b.score - a.score);

  const picked = [];
  const seen = new Set(existing);
  for (const item of scored) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    const domain = item.hit.domain;
    const cmoId = Number(item.hit.cmoId) || 0;
    const country = item.hit.country || "";
    const category = item.hit.category || "";
    picked.push({
      domain,
      cmoId,
      name: item.hit.name,
      country,
      category,
      quantity: 1,
      basis: cmoId > 0
        ? ["CMO DB3K 目录", `域=${domain}`, `ID=${cmoId}`, country ? `国别=${country}` : "", category ? `类别=${category}` : ""]
          .filter(Boolean)
          .join(" · ")
        : "无 CMO 目录编号，仅作概念关键词，不得当作定型装备"
    });
    if (picked.length >= limit) break;
  }
  return picked;
}

/**
 * Collect phase-derived keywords for UI display.
 */
export function summarizePhaseRecommendSeeds(phaseAction = {}, { max = 12 } = {}) {
  const phases = Array.isArray(phaseAction?.phases) ? phaseAction.phases : [];
  const text = phases.flatMap((phase) => [
    phase.name,
    ...(phase.blueActions || phase.primaryActions || [])
  ]).join(" ");
  const seeds = [];
  for (const [pattern, terms] of TERM_SEEDS) {
    if (pattern.test(text)) seeds.push(...terms);
  }
  return unique([...seeds, ...tokenize(text)]).filter((item) => item.length >= 2).slice(0, max);
}

function tokenize(text) {
  return String(text || "")
    .split(/[\s,，、；;。./|（）()\[\]{}:：+\-—_]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function scoreToken(token, force) {
  let score = 0;
  const lower = token.toLowerCase();
  if (/[A-Za-z]/.test(token)) score += 3;
  if (/\d/.test(token)) score += 2;
  if (String(force.missionType || "").includes(lower)) score += 4;
  if (String(force.task || "").includes(token)) score += 2;
  if (String(force.name || "").includes(token)) score += 3;
  return score;
}

function unique(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = String(item || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}
