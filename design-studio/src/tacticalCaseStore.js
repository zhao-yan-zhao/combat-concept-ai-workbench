/**
 * tacticalCaseStore.js
 * M7-T7.3 战法设计线：战例借鉴（历史相似战例检索、可借鉴点/不适用点对照卡与论证链引用）
 */

export const PRESET_TACTICAL_CASES = [
  {
    id: "case-falklands-exocet",
    caseName: "马岛海战飞鱼导弹低空掠海突击",
    category: "反舰突防 / 低空突防",
    similarityPoint: "在强防空雷达网威胁下，利用地球曲率与低空盲区发起首波次打击",
    historicalContext: "1982年马岛战争中，阿根廷海军航空兵以超军旗战机超低空掠海飞行，利用雷达间歇开机发射飞鱼反舰导弹击沉谢菲尔德号驱逐舰。",
    applicableLessons: [
      "超低空掠海突防配合雷达间歇开机，大幅压缩对手电子侦察与抗击告警时间窗口",
      "使用多轴佯动与诱饵战术，能够有效分散对手主战舰艇的通道资源与注意力"
    ],
    unapplicableLessons: [
      "现代分布式相控阵雷达与协同交战网（CEC）已大幅消除单向低空盲区，单机无中继突防生存率极低",
      "现代突防必须引入无人集群前出电子掩护与有人/无人跨域协同，不可照搬传统单平台孤胆突击"
    ],
    confidence: "高",
    knowledgeRef: "经典海空战例汇编/马岛海战.md#L32"
  },
  {
    id: "case-bekaa-valley-sead",
    caseName: "贝卡谷地防空压制作战 (SEAD)",
    category: "防空压制 / 电子欺骗",
    similarityPoint: "面对对手严密的一体化防空导弹阵地，以无人机诱骗诱导开机，实施体系致盲与饱和打击",
    historicalContext: "1982年第五次中东战争中，以军利用无人侦察/诱饵机诱骗叙利亚萨姆导弹阵地雷达开机，结合全频段电子压制与反辐射导弹在数小时内摧毁19个阵地。",
    applicableLessons: [
      "以低成本无人机前突逼迫对手关键雷达开机辐射，获取精准射频源参数与地理坐标",
      "电子侦察干扰、火力打击与毁伤评估形成紧密分钟级 OODA 杀伤闭环"
    ],
    unapplicableLessons: [
      "现代防空体系普遍引入光电雷达复合制导、光纤通信网与无源雷达，单一反辐射攻击难以完全致盲",
      "必须采用多域分布式无源定位与网络电磁多维协同打击，不可盲目假定对手雷达持续辐射"
    ],
    confidence: "高",
    knowledgeRef: "防空与反导战役案例/贝卡谷地.md#L15"
  },
  {
    id: "case-desert-storm-apache",
    caseName: "海湾战争特遣队超低空雷达破门",
    category: "走廊破门 / 节点破击",
    similarityPoint: "在主力波次发起前，以精干力量突击防空预警关键骨干雷达，开辟安全突防走廊",
    historicalContext: "1991年海湾战争首夜，美军诺曼底特遣队由铺路鹰直升机引导阿帕奇编队超低空突防，定点摧毁伊拉克南部边境两座关键早期预警雷达站，开辟了隐身轰炸机突入通道。",
    applicableLessons: [
      "精确切除对手防空体系关键骨干节点，可诱发防空预警网大范围局部失效",
      "强电子压制与隐蔽物理突击相结合，能以极小兵力代价换取战略突破口"
    ],
    unapplicableLessons: [
      "现代分布式低轨预警卫星星座与前哨浮标/巡逻走廊具有高冗余性，局部雷达受损后网络数秒内重构",
      "破门行动应转为防区外远程高超多弹协同或网络切断，不宜依赖高风险近距穿透式突击"
    ],
    confidence: "中",
    knowledgeRef: "现代空战战术演变/海湾战争空袭走廊.md#L64"
  },
  {
    id: "case-taranto-port-strike",
    caseName: "塔兰托战役夜暗非对称突袭",
    category: "非对称打击 / 港口封锁",
    similarityPoint: "在极端兵力不对称与坚固设防条件下，寻找对手防御惯性盲区实施精准奇袭",
    historicalContext: "1940年英国海军以光辉号航母舰载剑鱼双翼机在夜间空袭意大利塔兰托军港，使用改装浅水鱼雷击沉击伤意军多艘主力战列舰，彻底扭转地中海海权平衡。",
    applicableLessons: [
      "深入分析对手战役预设惯性盲区（如水浅防鱼雷、夜暗防御松懈），采取定制化战法打破防御预期",
      "以极小规模战术力量撬动战略级态势逆转"
    ],
    unapplicableLessons: [
      "现代重点防区具备全天候合成孔径雷达、被动红外监视网与水下主动声呐网，传统夜暗伪装效果大打折扣",
      "必须升级为水下微小型无人潜航器与低截获隐身飞行器协同，方能达成现代防区穿透"
    ],
    confidence: "中",
    knowledgeRef: "经典海战全景/塔兰托空袭.md#L18"
  }
];

/**
 * 规范化单条战例卡
 */
export function normalizeTacticalCase(raw = {}, index = 1) {
  const id = String(raw.id || `case-${index}`);
  const caseName = String(raw.caseName || raw.name || `历史战例 ${index}`).trim();
  const category = String(raw.category || "战术战法借鉴").trim();
  const similarityPoint = String(raw.similarityPoint || raw.similarity || "作战环境与对抗机理相似").trim();
  const historicalContext = String(raw.historicalContext || raw.context || "").trim();

  const applicableLessons = Array.isArray(raw.applicableLessons)
    ? raw.applicableLessons.map((item) => String(item).trim()).filter(Boolean)
    : (typeof raw.applicableLessons === "string" ? raw.applicableLessons.split(/[;\n]/).map((s) => s.trim()).filter(Boolean) : []);

  const unapplicableLessons = Array.isArray(raw.unapplicableLessons)
    ? raw.unapplicableLessons.map((item) => String(item).trim()).filter(Boolean)
    : (typeof raw.unapplicableLessons === "string" ? raw.unapplicableLessons.split(/[;\n]/).map((s) => s.trim()).filter(Boolean) : []);

  const confidence = ["高", "中", "低"].includes(raw.confidence) ? raw.confidence : "高";
  const knowledgeRef = String(raw.knowledgeRef || "").trim();

  return {
    id,
    caseName,
    category,
    similarityPoint,
    historicalContext,
    applicableLessons: applicableLessons.length ? applicableLessons : ["可借鉴其快速闭环机动机制"],
    unapplicableLessons: unapplicableLessons.length ? unapplicableLessons : ["需结合现代网络电磁协同进行改进"],
    confidence,
    knowledgeRef
  };
}

/**
 * 检索或推荐历史战例
 */
export function searchTacticalCases(query = "", { customCases = [], knowledgeDocs = [] } = {}) {
  const allCases = [
    ...PRESET_TACTICAL_CASES.map(normalizeTacticalCase),
    ...customCases.map(normalizeTacticalCase)
  ];

  const q = String(query || "").trim().toLowerCase();
  if (!q) {
    return allCases;
  }

  const tokens = q.split(/\s+/).filter(Boolean);

  return allCases
    .map((c) => {
      let score = 0;
      const haystack = `${c.caseName} ${c.category} ${c.similarityPoint} ${c.historicalContext} ${c.applicableLessons.join(" ")} ${c.unapplicableLessons.join(" ")}`.toLowerCase();
      for (const token of tokens) {
        if (haystack.includes(token)) {
          score += 5;
          if (c.caseName.toLowerCase().includes(token)) score += 10;
          if (c.category.toLowerCase().includes(token)) score += 8;
        }
      }
      return { ...c, matchScore: score };
    })
    .filter((c) => c.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * 将战例卡格式化为论证链支撑证据条目
 */
export function formatCaseAsEvidence(caseItem) {
  const c = normalizeTacticalCase(caseItem);
  const appSnippet = c.applicableLessons.slice(0, 2).map((l, i) => `${i + 1}.${l}`).join(" ");
  const unappSnippet = c.unapplicableLessons.slice(0, 1).map((l) => `[注意局限: ${l}]`).join(" ");

  return {
    chunkId: `case-${c.id}`,
    title: `战例借鉴: ${c.caseName}`,
    filePath: c.knowledgeRef || `战例库/${c.caseName}.md`,
    score: 0.95,
    snippet: `【借鉴点】${appSnippet}；【不适用局限】${unappSnippet}`
  };
}

/**
 * 引用战例至论证链支撑证据
 */
export function applyCaseToArgumentChain(state, caseItem) {
  if (!state) return false;
  if (!state.ov5) state.ov5 = { activities: [], edges: [] };
  if (!state.ov5.argumentChain) {
    state.ov5.argumentChain = {
      claim: state.brief?.approach || "基于跨域协同打破平衡",
      reasoning: "构建闭环杀伤链路",
      evidenceRefs: [],
      assumptions: []
    };
  }

  const evidence = formatCaseAsEvidence(caseItem);
  const existingRefs = Array.isArray(state.ov5.argumentChain.evidenceRefs)
    ? state.ov5.argumentChain.evidenceRefs
    : [];

  const foundIndex = existingRefs.findIndex(
    (ref) => ref.chunkId === evidence.chunkId || ref.title === evidence.title
  );

  if (foundIndex >= 0) {
    existingRefs[foundIndex] = evidence;
  } else {
    existingRefs.push(evidence);
  }

  state.ov5.argumentChain.evidenceRefs = existingRefs;
  state.ov5.argumentChain.updatedAt = new Date().toISOString();

  // 同时记入 state.tacticalCases 列表以供报告与展示复用
  if (!Array.isArray(state.tacticalCases)) {
    state.tacticalCases = [];
  }
  const caseId = caseItem.id;
  const inCaseList = state.tacticalCases.findIndex((tc) => tc.id === caseId);
  if (inCaseList >= 0) {
    state.tacticalCases[inCaseList] = normalizeTacticalCase(caseItem);
  } else {
    state.tacticalCases.push(normalizeTacticalCase(caseItem));
  }

  return true;
}

/**
 * 本地规则生成战例对比（离线/降级模式）
 */
export function generateLocalCaseComparison(query = "", baseCase = {}) {
  const c = normalizeTacticalCase(baseCase);
  return {
    caseName: c.caseName,
    similarityPoint: `针对「${query || "当前作战概念"}」，该战例在攻防对抗时序和非对称突破思路上具备高度相似性。`,
    applicableLessons: [
      ...c.applicableLessons,
      `在当前作战环境中，可借鉴其多轴佯动与错峰打击战术，牵制防御方雷达制导通道。`
    ],
    unapplicableLessons: [
      ...c.unapplicableLessons,
      `当前电磁空间与天基侦察密度大幅提升，必须补充分布式无人中继与跳频保密通信，防止被敌先知先决。`
    ],
    confidence: "高"
  };
}
