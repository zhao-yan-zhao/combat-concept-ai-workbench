// @ts-check
import assert from "node:assert/strict";
import {
  QUANTITATIVE_CRITERIA,
  calculateAutomaticScores,
  calculateReadinessScore,
  evaluateAssumptionFragility,
  evaluateResilienceScore,
  evaluateSimulationPerformance,
  evaluateTimeWindowScore,
  rankMultiSchemeSnapshots,
  scoreSchemeSnapshot
} from "../design-studio/src/schemeScoring.js";

console.log("=== T8.8 综合多方案定量评分引擎验证 ===");

// 1. 验证 G08 消除虚高数量分：精炼闭环方案 vs 堆叠冗余劣质方案
console.log("[1/6] 检验消除虚假数量分：精炼四阶段闭环 vs 冗余空节点堆叠 ...");
{
  const redundantActivities = Array.from({ length: 10 }, (_, i) => ({
    id: `act-${i}`,
    title: `未连接活动${i}`,
    input: "待定义",
    output: "待定义"
  }));
  const redundantReadiness = calculateReadinessScore(redundantActivities, null);

  const cleanLoopActivities = [
    { id: "obs-1", title: "广域雷达警戒感知", domain: "air", input: "雷达回波", output: "空情批号", assignedForces: ["radar-unit"] },
    { id: "ori-1", title: "航迹关联与威胁评估", domain: "c2", input: "空情批号", output: "威胁排序", assignedForces: ["c2-station"] },
    { id: "dec-1", title: "协同打击协同决策", domain: "c2", input: "威胁排序", output: "打击指令", assignedForces: ["c2-station"] },
    { id: "act-1", title: "远程拦截武器发射", domain: "strike", input: "打击指令", output: "拦截毁伤报告", assignedForces: ["missile-brigade"] }
  ];
  const cleanReadiness = calculateReadinessScore(cleanLoopActivities, null);

  assert(
    cleanReadiness > redundantReadiness,
    `精炼四阶段闭环方案得分(${cleanReadiness})必须高于堆叠10个未闭环冗余节点方案(${redundantReadiness})`
  );
  assert(cleanReadiness >= 80, `四阶段全要素且具兵力承接方案就绪分必须 >= 80, 得到: ${cleanReadiness}`);
  console.log(`✓ 节点堆叠得分: ${redundantReadiness}, 精炼闭环得分: ${cleanReadiness} (成功扭转数量偏见)`);
}

// 2. 验证 T8.1 DAG CPM 关键路径时延与时敏预算对 timeWindow 的驱动
console.log("[2/6] 检验 DAG CPM 时延比率对时间窗口适配度的动态打分 ...");
{
  const fastModel = {
    ov5: {
      activities: [
        { id: "a1", title: "高速预警侦察", duration: "60s" },
        { id: "a2", title: "实时火力打击", duration: "120s" }
      ],
      edges: [{ sourceId: "a1", targetId: "a2" }],
      targetWindowSeconds: 1200
    }
  };
  const fastScore = evaluateTimeWindowScore(fastModel);
  assert(fastScore.score >= 90, `充裕时延方案(180s/1200s)得分为${fastScore.score}，必须 >= 90`);

  const timeoutModel = {
    ov5: {
      activities: [
        { id: "b1", title: "慢速搜索", duration: "1500s" },
        { id: "b2", title: "长时决策", duration: "900s" }
      ],
      edges: [{ sourceId: "b1", targetId: "b2" }],
      targetWindowSeconds: 1200
    }
  };
  const timeoutScore = evaluateTimeWindowScore(timeoutModel);
  assert(timeoutScore.score <= 35, `严重超时断链方案(2400s/1200s)得分为${timeoutScore.score}，必须 <= 35`);
  console.log(`✓ 充裕裕度时效分: ${fastScore.score}, 超时断链时效分: ${timeoutScore.score}`);
}

// 3. 验证 T8.2 拓扑抗毁性与 SPOF 割点惩罚对 resilience 的驱动
console.log("[3/6] 检验 SPOF 割点与网络韧性对对手反制韧性的量化打分 ...");
{
  const resilientModel = {
    ov5: {
      activities: [
        { id: "s1", title: "卫星感知" },
        { id: "s2", title: "无人机中继感知" },
        { id: "c1", title: "指挥所A" },
        { id: "c2", title: "指挥所B" },
        { id: "k1", title: "火力打击A" },
        { id: "k2", title: "火力打击B" }
      ],
      edges: [
        { sourceId: "s1", targetId: "c1" },
        { sourceId: "s1", targetId: "c2" },
        { sourceId: "s2", targetId: "c1" },
        { sourceId: "s2", targetId: "c2" },
        { sourceId: "c1", targetId: "k1" },
        { sourceId: "c1", targetId: "k2" },
        { sourceId: "c2", targetId: "k1" },
        { sourceId: "c2", targetId: "k2" }
      ]
    },
    validation: {
      redTeamReview: { status: "passed", passed: true, highRiskCount: 0 }
    }
  };
  const resilientScore = evaluateResilienceScore(resilientModel);

  const fragileModel = {
    ov5: {
      activities: [
        { id: "w1", title: "唯一侦察雷达" },
        { id: "w2", title: "唯一中继指控" },
        { id: "w3", title: "终端打击" }
      ],
      edges: [
        { sourceId: "w1", targetId: "w2" },
        { sourceId: "w2", targetId: "w3" }
      ]
    },
    validation: {
      redTeamReview: { status: "failed", passed: false, highRiskCount: 2 }
    }
  };
  const fragileScore = evaluateResilienceScore(fragileModel);

  assert(
    resilientScore.score > fragileScore.score,
    `双备份抗毁网络得分(${resilientScore.score})必须高于单链存在SPOF割点方案(${fragileScore.score})`
  );
  assert(
    resilientScore.score - fragileScore.score >= 15,
    `韧性分差距必须显著 (>= 15分), 实际差距: ${resilientScore.score - fragileScore.score}`
  );
  console.log(`✓ 双备份抗毁网络分: ${resilientScore.score}, 存在单点割点网络分: ${fragileScore.score}`);
}

// 4. 验证假设脆弱性对 riskControl 的科学扣分
console.log("[4/6] 检验未证实与高危假设对风险可控性扣分 ...");
{
  const soundModel = {
    brief: {
      assumptions: "关键通信链路可用；区域基础地理数据完整；装备参数已复核。"
    },
    ov5: {
      argumentChain: {
        assumptions: [
          { text: "雷达部署于高地具备通视", confidence: "high", evidenceRefs: ["obs/装备/雷达.md"] }
        ]
      }
    },
    validation: { issues: [] }
  };
  const soundRisk = calculateAutomaticScores(soundModel).riskControl.score;

  const fragileAssumptionModel = {
    brief: {
      assumptions: "关键通信链路可用；未经证实敌军无防空雷达；假设敌不采用电子压制；缺乏依据敌主力未出动。"
    },
    ov5: {
      argumentChain: {
        assumptions: [
          { text: "强假设卫星链路不受干扰", confidence: "low", unverified: true, evidenceRefs: [] }
        ]
      }
    },
    validation: { issues: [] }
  };
  const fragileEvaluation = evaluateAssumptionFragility(fragileAssumptionModel);
  assert(fragileEvaluation.fragileCount >= 3, `应检测出至少3项脆弱假设, 实际检测到: ${fragileEvaluation.fragileCount}`);

  const fragileRisk = calculateAutomaticScores(fragileAssumptionModel).riskControl.score;
  assert(
    soundRisk - fragileRisk >= 30,
    `稳健假设风险分(${soundRisk})应显著高于高危假设方案(${fragileRisk}), 扣分应 >= 30`
  );
  console.log(`✓ 稳健假设风险分: ${soundRisk}, 包含 ${fragileEvaluation.fragileCount} 项脆弱假设扣分后: ${fragileRisk}`);
}

// 5. 验证推演成效指标吸收与融合 (T8.6 DES 实测指标)
console.log("[5/6] 检验推演实测成效融入可行性与任务适配度 ...");
{
  const simulatedModel = {
    ov5: {
      activities: [
        { id: "a1", title: "侦察", domain: "air", input: "i", output: "o", assignedForces: ["u1"] },
        { id: "a2", title: "突击", domain: "strike", input: "i", output: "o", assignedForces: ["u2"] }
      ]
    },
    scenario: {
      simulation: {
        runs: [
          {
            id: "run-sim-1",
            status: "completed",
            metrics: [
              { id: "area-coverage", status: "compliant" },
              { id: "c2-connectivity", status: "compliant" },
              { id: "causal-smoothness", status: "compliant" },
              { id: "force-dispersion", status: "compliant" }
            ],
            result: {
              phaseOutcomes: [
                { stageName: "压制阶段", achievement: "achieved", riskLevel: "low" },
                { stageName: "打击阶段", achievement: "achieved", riskLevel: "low" }
              ]
            }
          }
        ]
      }
    },
    validation: { scores: [{ label: "活动连通性", score: 70 }] }
  };
  const simEval = evaluateSimulationPerformance(simulatedModel);
  assert(simEval && simEval.hasRun === true, "必须识别到已完成推演记录");
  assert.equal(simEval.score, 100, "各项全达标时推演得分应为 100");

  const autoScores = calculateAutomaticScores(simulatedModel);
  assert(autoScores.missionFit.evidence.some(e => e.includes("仿真实测成效")), "evidence 应体现仿真成效");
  console.log(`✓ 成功吸纳推演实测成效分: ${simEval.score}, 任务适配融合分: ${autoScores.missionFit.score}`);
}

// 6. 验证综合多方案排行榜 (rankMultiSchemeSnapshots) 真实优选决策
console.log("[6/6] 检验多方案综合加权排行与优选领导者确定 ...");
{
  // 方案 A: 虚假繁荣（节点多但脆弱、超时、假设不稳）
  const schemeA = {
    id: "scheme-inflated",
    label: "方案A: 冗余堆砌方案",
    direction: "粗放铺设",
    model: {
      ov5: {
        activities: Array.from({ length: 8 }, (_, i) => ({ id: `act-${i}`, title: `活动${i}`, duration: "600s" })),
        edges: [{ sourceId: "act-0", targetId: "act-1" }],
        targetWindowSeconds: 600
      },
      brief: { assumptions: "未经证实强假设；假设敌不反击" },
      validation: {
        issues: [{ level: "high", title: "存在断链" }],
        scores: [{ label: "跨视图追溯", score: 50 }]
      }
    }
  };

  // 方案 B: 精炼坚固（全要素闭环、时延裕度大、网络抗毁强、推演实测全优）
  const schemeB = {
    id: "scheme-robust",
    label: "方案B: 弹性快速闭环方案",
    direction: "精敏战法",
    model: {
      ov5: {
        activities: [
          { id: "o1", title: "分布式态势感知", domain: "air", input: "辐射源", output: "目标轨迹", duration: "90s", assignedForces: ["u1"] },
          { id: "r1", title: "边缘智能判决", domain: "c2", input: "目标轨迹", output: "优先级序列", duration: "45s", assignedForces: ["u2"] },
          { id: "d1", title: "协同突防决策", domain: "c2", input: "优先级序列", output: "协同火力表", duration: "60s", assignedForces: ["u2"] },
          { id: "a1", title: "网幕饱和压制", domain: "strike", input: "协同火力表", output: "毁伤评估回执", duration: "120s", assignedForces: ["u3"] }
        ],
        edges: [
          { sourceId: "o1", targetId: "r1" },
          { sourceId: "r1", targetId: "d1" },
          { sourceId: "d1", targetId: "a1" }
        ],
        targetWindowSeconds: 1200
      },
      brief: { assumptions: "通信链路正常；装备已复核。" },
      scenario: {
        simulation: {
          runs: [
            {
              id: "run-b-1",
              status: "completed",
              metrics: [{ id: "c2-connectivity", status: "compliant" }],
              result: { phaseOutcomes: [{ stageName: "压制", achievement: "achieved" }] }
            }
          ]
        }
      },
      validation: {
        issues: [],
        redTeamReview: { status: "passed", passed: true, highRiskCount: 0 },
        scores: [
          { label: "活动连通性", score: 92 },
          { label: "信息闭环", score: 95 },
          { label: "跨视图追溯", score: 90 }
        ]
      }
    }
  };

  const ranking = rankMultiSchemeSnapshots([schemeA, schemeB]);
  assert.equal(ranking.rankings.length, 2);
  assert.equal(ranking.leader?.id, "scheme-robust", "机理稳健的精敏方案 B 必须登顶优选榜首");
  assert(ranking.leader.total > ranking.rankings[1].total + 15, "领先优势应大于 15 分");
  console.log(`✓ 综合优选榜首: ${ranking.leader.label} (${ranking.leader.total}分), 次席: ${ranking.rankings[1].label} (${ranking.rankings[1].total}分)`);
}

console.log("\n========================================================");
console.log("All T8.8 Composite Scheme Scoring Checks PASSED cleanly!");
console.log("========================================================");
