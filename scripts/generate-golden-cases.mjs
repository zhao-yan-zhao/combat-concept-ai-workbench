import fs from "node:fs";
import path from "node:path";

const root = path.resolve("eval/cases");

const cases = [
  // ==========================================
  // 一、战法类 (Tactic) 10 条
  // ==========================================
  // 1.1 ai.generate.concept-brief (4 条)
  {
    id: "tactic-brief-01",
    category: "tactic",
    promptId: "ai.generate.concept-brief",
    schema: "ConceptBrief",
    name: "多域协同防空压制概念简报",
    description: "在抽象相对网格环境下，验证面对多通道雷达网时的多域电磁与反辐射协同压制概念",
    input: {
      workflow: { title: "概念简报", outputSchema: "ConceptBrief" },
      analysis: {
        researchIntent: "研究分布式空天电磁协同与饱和反辐射突防战法",
        currentBrief: {}
      },
      evidence: [
        { id: "ev-01", title: "分布式电磁压制机理.md", summary: "多节点同步辐射可显著降低单脉冲雷达跟踪稳定性" }
      ]
    },
    expectedAssertions: {
      requiredFields: ["objective", "approach", "assumptions", "expectedEffects", "risk"],
      minLengths: { objective: 20, approach: 30, expectedEffects: 20 },
      keywords: ["协同", "压制", "饱和", "电磁"],
      negativeKeywords: ["经纬度", "由于缺乏前置上下文", "研究框架已就绪"]
    },
    goldenReference: {
      objective: "评估在强对抗电磁环境下，运用多域分布式节点协同对敌预警雷达网实施压制与穿透打击的可行性与效能边界。",
      approach: "采用空天信息中继引导、低空无人分布式干扰机动态协同诱骗、中高空多批次反辐射武器饱和突击的体系破击模式。",
      assumptions: "通信卫星链路与前沿传感器中继保持基础联通；敌方预警探测具备多基站雷达互联与跳频抗干扰能力。",
      expectedEffects: "压制期间敌雷达网开机跟踪概率下降60%以上，突防打击武器穿透成功率提升至85%以上。",
      risk: "前沿节点暴露后可能遭受点对点精确定位打击；密集协同控制指令时延超差可能导致压制窗口错位。"
    }
  },
  {
    id: "tactic-brief-02",
    category: "tactic",
    promptId: "ai.generate.concept-brief",
    schema: "ConceptBrief",
    name: "分布式水下静默预警阻击简报",
    description: "验证基于无人潜航器与海底监听阵列的静默警戒与快速封堵战法概念",
    input: {
      workflow: { title: "概念简报", outputSchema: "ConceptBrief" },
      analysis: {
        researchIntent: "探索无人潜航器水下静默监视与要道反潜阻击机理",
        currentBrief: {}
      },
      evidence: [
        { id: "ev-02", title: "水下声学协同探测.md", summary: "分布式多节点声呐融合提升微弱信号信噪比" }
      ]
    },
    expectedAssertions: {
      requiredFields: ["objective", "approach", "assumptions", "expectedEffects", "risk"],
      minLengths: { objective: 20, approach: 30, expectedEffects: 20 },
      keywords: ["静默", "预警", "潜航", "阻击"],
      negativeKeywords: ["经纬度", "由于缺乏前置上下文"]
    },
    goldenReference: {
      objective: "论证水下要道关键海峡在被动静默声学监视与无人巡逻阻击体系下的多层封锁与早期预警能力。",
      approach: "布设水下固定水听阵列、移动无人潜航器（UUV）网格巡逻、水面无人艇定点通信中继的多层立体感知与即时阻击战法。",
      assumptions: "海洋水文跃层参数处于正常季节波动区间；敌潜航目标具备低噪声消音隐身外壳。",
      expectedEffects: "对过境高价值目标的首次探测距离外推30海里以上，实现水下通道全时域静默预警与精准阻击。",
      risk: "水声信道在剧烈温盐变化下衰减加剧；通信浮标暴露可能导致中继链路中断。"
    }
  },
  {
    id: "tactic-brief-03",
    category: "tactic",
    promptId: "ai.generate.concept-brief",
    schema: "ConceptBrief",
    name: "低空智能集群跨域突防战法简报",
    description: "验证异构小型无人集群利用地形与网电掩护低空穿透防空网战法",
    input: {
      workflow: { title: "概念简报", outputSchema: "ConceptBrief" },
      analysis: {
        researchIntent: "研究低空多批次异构集群突防与分布式自组织协同机理",
        currentBrief: {}
      },
      evidence: [
        { id: "ev-03", title: "自组织蜂群通信机制.md", summary: "去中心化动态拓扑支持节点受损自主替补" }
      ]
    },
    expectedAssertions: {
      requiredFields: ["objective", "approach", "assumptions", "expectedEffects", "risk"],
      minLengths: { objective: 20, approach: 30, expectedEffects: 20 },
      keywords: ["集群", "低空", "突防", "自组织"],
      negativeKeywords: ["经纬度", "由于缺乏前置上下文"]
    },
    goldenReference: {
      objective: "评估异构无人蜂群在近地表低空超低空突防过程中，突破中近程野战防空火力网的成功率与对抗消耗比。",
      approach: "先导侦察集群穿透探测、诱骗集群消耗拦截弹药、电子干扰机动态压制通信频段、末端攻击机群自主分配瞄准点进行定点破击。",
      assumptions: "蜂群内置自组织跳频通信网络具备抗局域电磁压制能力；近地面雷达存在探测盲区与多径杂波干扰。",
      expectedEffects: "耗尽守方60%以上近防弹药储备，确保核心高价值制导武器穿透防区边界。",
      risk: "定向能武器对轻小型无人集群形成面杀伤；复杂微气象导致低空编队散开失控。"
    }
  },
  {
    id: "tactic-brief-04",
    category: "tactic",
    promptId: "ai.generate.concept-brief",
    schema: "ConceptBrief",
    name: "敏捷电磁频谱压制与诱骗战法简报",
    description: "验证分布式动态频谱管控与虚假辐射源阵列诱骗战法",
    input: {
      workflow: { title: "概念简报", outputSchema: "ConceptBrief" },
      analysis: {
        researchIntent: "研究认知电子战与分布式假目标电磁欺骗战法",
        currentBrief: {}
      },
      evidence: [
        { id: "ev-04", title: "认知电子战频谱对抗.md", summary: "自适应脉冲复制技术能够生成逼真雷达虚假航迹" }
      ]
    },
    expectedAssertions: {
      requiredFields: ["objective", "approach", "assumptions", "expectedEffects", "risk"],
      minLengths: { objective: 20, approach: 30, expectedEffects: 20 },
      keywords: ["频谱", "压制", "诱骗", "认知"],
      negativeKeywords: ["经纬度", "由于缺乏前置上下文"]
    },
    goldenReference: {
      objective: "检验认知电磁战系统对对手复合制导雷达的实时频谱感知、快速调制反制与多点协同虚假航迹诱骗效果。",
      approach: "运用认知射频传感器实时截获分析雷达波形，协同地面及空中无人诱饵实施频谱压制并同步辐射相干干扰信号，制造大量虚假编队航迹。",
      assumptions: "对手雷达信号处理机采用常规单脉冲测角与动目标显示技术，未部署完全独立的红外光电复合复核传感器。",
      expectedEffects: "敌方雷达指控系统误判率超过70%，将主力拦截资源空耗在虚假航迹方向。",
      risk: "自适应抗干扰算法可能快速识别并剔除无多普勒频移特征的静态假目标。"
    }
  },

  // 1.2 ai.generate.force-mission (6 条)
  {
    id: "tactic-force-01",
    category: "tactic",
    promptId: "ai.generate.force-mission",
    schema: "ForceMissionPlan",
    name: "防空压制双层编组与协同任务编成",
    description: "构建概念层传感器/打击单元与作战层具体平台的防空压制联合编组",
    input: {
      workflow: { title: "兵力任务", outputSchema: "ForceMissionPlan" },
      analysis: {
        operationalTasks: [
          { id: "task-sead-1", name: "雷达信号侦测与定位", side: "friendly", phaseId: "phase-1", missionType: "recon", objective: "精确定位雷达阵地", expectedEffect: "坐标误差小于相对网格1%" },
          { id: "task-sead-2", name: "反辐射火力饱和突击", side: "friendly", phaseId: "phase-1", missionType: "sead", objective: "摧毁制导雷达天线", expectedEffect: "压制开机率" }
        ],
        phaseAction: { phases: [{ id: "phase-1", name: "突防压制阶段" }] }
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["summary", "forces", "combatForces", "relations"],
      minCounts: { forces: 4, combatForces: 4, relations: 2 },
      keywords: ["friendly", "recon", "sead", "command"],
      negativeKeywords: ["经纬度", "由于缺乏前置上下文"]
    },
    goldenReference: {
      summary: "构建以高空电子侦察中继为感知核心、中远距反辐射战术机编组为执行主力的防空压制兵力编成。",
      forces: [
        { id: "cf-sense-radar", name: "多源雷达辐射定位单元", side: "friendly", role: "sense", group: "侦察突防群", missionType: "recon", task: "在相对网格前沿持续截获雷达信号并完成多点测向交会定位", taskRefs: ["task-sead-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 1001, name: "电子侦察机", country: "通用", category: "侦察机", quantity: 2 }], notes: "概念能力单元" },
        { id: "cf-cmd-sead", name: "战术压制指挥协调单元", side: "friendly", role: "command", group: "指挥控制群", missionType: "command", task: "融合雷达辐射源态势，生成反辐射突击发射任务解算", taskRefs: ["task-sead-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 1002, name: "预警指挥机", country: "通用", category: "预警机", quantity: 1 }], notes: "指挥协同中枢" },
        { id: "cf-strike-sead", name: "反辐射协同打击单元", side: "friendly", role: "air", group: "火力打击群", missionType: "sead", task: "接收目标定位参数，发射高速反辐射武器破坏雷达射频前端", taskRefs: ["task-sead-2"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 1003, name: "反辐射战机", country: "通用", category: "战斗机", quantity: 4 }], notes: "防空压制主力" },
        { id: "cf-supp-tanker", name: "突防战术加油支援单元", side: "friendly", role: "support", group: "战术保障群", missionType: "support", task: "在战术安全边界建立空中受油航线，保障压制编队远距作战航程", taskRefs: ["task-sead-2"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 1004, name: "空中加油机", country: "通用", category: "保障机", quantity: 2 }], notes: "航程保障支持" }
      ],
      combatForces: [
        { id: "cbf-recon-plane", name: "电子战支援侦察机编组", side: "friendly", role: "sense", conceptForceId: "cf-sense-radar", group: "空中梯队", missionType: "recon", task: "战术空域巡逻并分发雷达脉冲参数", taskRefs: ["task-sead-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 2001, name: "电子侦察机A型", country: "通用", category: "侦察机", quantity: 2 }], notes: "仿真作战编成执行包" },
        { id: "cbf-cmd-node", name: "空中预警指控前沿分队", side: "friendly", role: "command", conceptForceId: "cf-cmd-sead", group: "空中梯队", missionType: "command", task: "承担突防压制实时任务分派与指令授权", taskRefs: ["task-sead-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 2002, name: "战术预警机B型", country: "通用", category: "预警机", quantity: 1 }], notes: "仿真指控单元" },
        { id: "cbf-strike-fighter", name: "防空压制歼击轰炸机编组", side: "friendly", role: "air", conceptForceId: "cf-strike-sead", group: "火力突击梯队", missionType: "sead", task: "挂载超音速反辐射武器进入发射阵位实施齐射", taskRefs: ["task-sead-2"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 2003, name: "战术歼轰机C型", country: "通用", category: "战斗轰炸机", quantity: 4 }], notes: "仿真打击单元" },
        { id: "cbf-tanker-flight", name: "伴随加油支援分队", side: "friendly", role: "support", conceptForceId: "cf-supp-tanker", group: "保障梯队", missionType: "support", task: "定点待命并执行软管加油对接", taskRefs: ["task-sead-2"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 2004, name: "战术加油机D型", country: "通用", category: "加油机", quantity: 2 }], notes: "仿真保障单元" }
      ],
      relations: [
        { fromForceId: "cf-sense-radar", toForceId: "cf-cmd-sead", type: "information", note: "目标雷达参数与定位数据上报" },
        { fromForceId: "cf-cmd-sead", toForceId: "cf-strike-sead", type: "command", note: "引导射击解算分发及协同指挥授权" }
      ],
      openQuestions: ["强电磁干扰下测向交会定位时延是否满足快速闭环要求"],
      reviewChecklist: ["核对概念兵力与作战编成任务承接一致性"]
    }
  },
  {
    id: "tactic-force-02",
    category: "tactic",
    promptId: "ai.generate.force-mission",
    schema: "ForceMissionPlan",
    name: "远海分布式打击作战编成与警戒护航",
    description: "构建水面舰艇突击编组与防空反潜护航保障双层兵力编成",
    input: {
      workflow: { title: "兵力任务", outputSchema: "ForceMissionPlan" },
      analysis: {
        operationalTasks: [
          { id: "task-asuw-1", name: "远海机动水面截击", side: "friendly", phaseId: "phase-2", missionType: "patrol_asuw", objective: "截击敌水面编队", expectedEffect: "迫退主力舰艇" }
        ],
        phaseAction: { phases: [{ id: "phase-2", name: "远海交战阶段" }] }
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["summary", "forces", "combatForces", "relations"],
      minCounts: { forces: 4, combatForces: 4, relations: 2 },
      keywords: ["friendly", "patrol_asuw"],
      negativeKeywords: ["经纬度", "由于缺乏前置上下文"]
    },
    goldenReference: {
      summary: "部署分布式水面作战群，包含防空护航、超视距反舰攻击与空中早期预警要素。",
      forces: [
        { id: "cf-surface-recon", name: "远海警戒感知单元", side: "friendly", role: "sense", group: "远海警戒群", missionType: "recon", task: "搜寻目标水面编队方位与航向", taskRefs: ["task-asuw-1"], phaseIds: ["phase-2"], platforms: [{ domain: "aircraft", cmoId: 1101, name: "海上巡逻机", country: "通用", category: "巡逻机", quantity: 2 }], notes: "态势侦察" },
        { id: "cf-surface-command", name: "编队指挥控制单元", side: "friendly", role: "command", group: "旗舰指挥群", missionType: "command", task: "下达反舰打击任务并协调防空防御", taskRefs: ["task-asuw-1"], phaseIds: ["phase-2"], platforms: [{ domain: "ship", cmoId: 1102, name: "指挥驱逐舰", country: "通用", category: "驱逐舰", quantity: 1 }], notes: "海上指控中枢" },
        { id: "cf-surface-strike", name: "远程反舰突击作战单元", side: "friendly", role: "surface", group: "机动打击群", missionType: "patrol_asuw", task: "在超视距海域实施分散部署与齐射突击", taskRefs: ["task-asuw-1"], phaseIds: ["phase-2"], platforms: [{ domain: "ship", cmoId: 1103, name: "导弹驱逐舰", country: "通用", category: "驱逐舰", quantity: 2 }], notes: "水面突击" },
        { id: "cf-surface-escort", name: "防空反潜护航保障单元", side: "friendly", role: "support", group: "伴随屏护群", missionType: "support", task: "为水面突击单元提供中近程防空反潜屏护", taskRefs: ["task-asuw-1"], phaseIds: ["phase-2"], platforms: [{ domain: "ship", cmoId: 1104, name: "护卫舰", country: "通用", category: "护卫舰", quantity: 2 }], notes: "伴随屏护" }
      ],
      combatForces: [
        { id: "cbf-recon-plane", name: "海上远程巡逻分队", side: "friendly", role: "sense", conceptForceId: "cf-surface-recon", group: "空中梯队", missionType: "recon", task: "执行雷达对海搜索巡逻", taskRefs: ["task-asuw-1"], phaseIds: ["phase-2"], platforms: [{ domain: "aircraft", cmoId: 2101, name: "海巡机A型", country: "通用", category: "巡逻机", quantity: 2 }], notes: "巡逻执行包" },
        { id: "cbf-cmd-flagship", name: "海上指挥旗舰作战编组", side: "friendly", role: "command", conceptForceId: "cf-surface-command", group: "水面编组", missionType: "command", task: "统筹全海区战术协同指令分发", taskRefs: ["task-asuw-1"], phaseIds: ["phase-2"], platforms: [{ domain: "ship", cmoId: 2102, name: "指挥舰B型", country: "通用", category: "驱逐舰", quantity: 1 }], notes: "指控执行包" },
        { id: "cbf-destroyer-group", name: "驱逐舰综合作战编队", side: "friendly", role: "surface", conceptForceId: "cf-surface-strike", group: "水面编队", missionType: "patrol_asuw", task: "承担多通道超音速反舰突击及区域防空警戒", taskRefs: ["task-asuw-1"], phaseIds: ["phase-2"], platforms: [{ domain: "ship", cmoId: 2103, name: "驱逐舰C型", country: "通用", category: "驱逐舰", quantity: 2 }], notes: "突击执行包" },
        { id: "cbf-frigate-screen", name: "防空护卫舰屏护分队", side: "friendly", role: "support", conceptForceId: "cf-surface-escort", group: "水面编组", missionType: "support", task: "在编队外围建立防空与反鱼雷屏障", taskRefs: ["task-asuw-1"], phaseIds: ["phase-2"], platforms: [{ domain: "ship", cmoId: 2104, name: "护卫舰D型", country: "通用", category: "护卫舰", quantity: 2 }], notes: "护航执行包" }
      ],
      relations: [
        { fromForceId: "cf-surface-recon", toForceId: "cf-surface-command", type: "information", note: "海空态势上报" },
        { fromForceId: "cf-surface-command", toForceId: "cf-surface-strike", type: "command", note: "下达反舰打击任务与射击窗口" }
      ],
      openQuestions: ["水面编队在雷达静默状态下依赖外源态势的引导精度"],
      reviewChecklist: ["确认水面单元防空与对海打击火力通道配比"]
    }
  },
  {
    id: "tactic-force-03",
    category: "tactic",
    promptId: "ai.generate.force-mission",
    schema: "ForceMissionPlan",
    name: "前沿隐蔽感知与无人中继编组",
    description: "配置前沿静默潜伏无人机与平流层长航时中继平台",
    input: {
      workflow: { title: "兵力任务", outputSchema: "ForceMissionPlan" },
      analysis: {
        operationalTasks: [
          { id: "task-recon-1", name: "隐蔽前沿监视", side: "friendly", phaseId: "phase-1", missionType: "recon", objective: "保持目标区连续观察", expectedEffect: "无盲区监控" }
        ],
        phaseAction: { phases: [{ id: "phase-1", name: "侦察预警阶段" }] }
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["summary", "forces", "combatForces", "relations"],
      minCounts: { forces: 4, combatForces: 4, relations: 2 },
      keywords: ["recon", "friendly"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      summary: "配置前沿隐蔽潜伏无人机与长航时通信中继平台，保障态势感知不间断传输。",
      forces: [
        { id: "cf-covert-sense", name: "前沿静默光学雷达复合感知单元", side: "friendly", role: "sense", group: "先锋监视组", missionType: "recon", task: "保持雷达低截获静默接收，辅以红外长焦探测战场热源", taskRefs: ["task-recon-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 1201, name: "静默侦察无人机", country: "通用", category: "无人机", quantity: 2 }], notes: "静默侦察" },
        { id: "cf-relay-cmd", name: "战术空中信息中继指控单元", side: "friendly", role: "command", group: "中继控制群", missionType: "command", task: "汇集前沿无人机传感数据并转发至后方控制中枢", taskRefs: ["task-recon-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 1202, name: "空中通信中继机", country: "通用", category: "中继机", quantity: 1 }], notes: "数据转发指控" },
        { id: "cf-fast-strike", name: "前沿随伴快速处置单元", side: "friendly", role: "air", group: "先锋反应群", missionType: "strike", task: "对突发高价值时敏目标实施快速核实与精准遏制", taskRefs: ["task-recon-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 1203, name: "察打一体无人机", country: "通用", category: "无人机", quantity: 2 }], notes: "快速处置" },
        { id: "cf-comm-supp", name: "战术链路电磁维护保障单元", side: "friendly", role: "support", group: "通信保障群", missionType: "support", task: "对抗敌方窄带测向与瞄准式干扰，保障中继信道畅通", taskRefs: ["task-recon-1"], phaseIds: ["phase-1"], platforms: [{ domain: "ground", cmoId: 1204, name: "地面测控天线站", country: "通用", category: "地面站", quantity: 1 }], notes: "信道维护" }
      ],
      combatForces: [
        { id: "cbf-uav-recon", name: "长航时高空隐身无人机编队", side: "friendly", role: "sense", conceptForceId: "cf-covert-sense", group: "无人侦察机组", missionType: "recon", task: "执行预定航线长时徘徊监视与毫米波激光中继", taskRefs: ["task-recon-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 2201, name: "长航时侦察无人机A型", country: "通用", category: "无人机", quantity: 2 }], notes: "无人机侦察包" },
        { id: "cbf-relay-plane", name: "平流层通信中继机组", side: "friendly", role: "command", conceptForceId: "cf-relay-cmd", group: "空中中继组", missionType: "command", task: "保持高空稳定盘旋并建立定向高速微波链路", taskRefs: ["task-recon-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 2202, name: "平流层中继机B型", country: "通用", category: "中继机", quantity: 1 }], notes: "中继执行包" },
        { id: "cbf-strike-uav", name: "察打一体巡逻战备分队", side: "friendly", role: "air", conceptForceId: "cf-fast-strike", group: "战备值班组", missionType: "strike", task: "挂载小型精确制导武器待命响应", taskRefs: ["task-recon-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 2203, name: "察打无人机C型", country: "通用", category: "无人机", quantity: 2 }], notes: "打击执行包" },
        { id: "cbf-supp-station", name: "地面远程控制数据终端站", side: "friendly", role: "support", conceptForceId: "cf-comm-supp", group: "地面保障组", missionType: "support", task: "负责天线伺服跟踪与抗干扰基带解调", taskRefs: ["task-recon-1"], phaseIds: ["phase-1"], platforms: [{ domain: "ground", cmoId: 2204, name: "卫星数据地面站D型", country: "通用", category: "地面站", quantity: 1 }], notes: "保障执行包" }
      ],
      relations: [
        { fromForceId: "cf-covert-sense", toForceId: "cf-relay-cmd", type: "information", note: "静默侦察数据向中继平台高速回传" },
        { fromForceId: "cf-relay-cmd", toForceId: "cf-fast-strike", type: "command", note: "目标确认后下发时敏打击指派" }
      ],
      openQuestions: ["长航时无人机应对敌空中扫荡战斗机时的自卫规避方案"],
      reviewChecklist: ["检查传感器作用距离与驻留空域安全余量"]
    }
  },
  {
    id: "tactic-force-04",
    category: "tactic",
    promptId: "ai.generate.force-mission",
    schema: "ForceMissionPlan",
    name: "要地防空多层梯次截击编组",
    description: "构建远程防空、中程拦截与末端高炮结合的阵地防空体系",
    input: {
      workflow: { title: "兵力任务", outputSchema: "ForceMissionPlan" },
      analysis: {
        operationalTasks: [
          { id: "task-ad-1", name: "核心空域梯次防空抗击", side: "friendly", phaseId: "phase-1", missionType: "area_defense", objective: "拦截多批次来袭导弹", expectedEffect: "守卫重点保卫目标安全" }
        ],
        phaseAction: { phases: [{ id: "phase-1", name: "防空保卫阶段" }] }
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["summary", "forces", "combatForces", "relations"],
      minCounts: { forces: 4, combatForces: 4, relations: 2 },
      keywords: ["area_defense", "friendly"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      summary: "配置远程区域防空导弹连与中近程近防速射炮混编防御力量，实施纵深梯次拦截。",
      forces: [
        { id: "cf-early-radar", name: "防空远程预警雷达单元", side: "friendly", role: "sense", group: "空情感知群", missionType: "recon", task: "远程探测来袭空气动力目标与弹道威胁", taskRefs: ["task-ad-1"], phaseIds: ["phase-1"], platforms: [{ domain: "ground", cmoId: 1301, name: "远程对空情报雷达", country: "通用", category: "雷达站", quantity: 2 }], notes: "远距预警" },
        { id: "cf-layered-ad", name: "要地综合防空指挥拦截单元", side: "friendly", role: "command", group: "防空指控群", missionType: "area_defense", task: "整合各层级雷达空情，进行目标威胁定级并分配火力批次", taskRefs: ["task-ad-1"], phaseIds: ["phase-1"], platforms: [{ domain: "ground", cmoId: 1302, name: "防空自动化指控车", country: "通用", category: "指控车", quantity: 1 }], notes: "指控统筹" },
        { id: "cf-sam-strike", name: "中远程地空导弹火力单元", side: "friendly", role: "airDefense", group: "防空突击群", missionType: "area_defense", task: "对中高空突破目标实施拦截导弹齐射", taskRefs: ["task-ad-1"], phaseIds: ["phase-1"], platforms: [{ domain: "ground", cmoId: 1303, name: "中远程防空导弹发射车", country: "通用", category: "发射车", quantity: 4 }], notes: "中远程拦截" },
        { id: "cf-point-ciws", name: "要地末端近防速射高炮单元", side: "friendly", role: "support", group: "末端近防群", missionType: "support", task: "拦截漏网巡航导弹与精确制导弹药", taskRefs: ["task-ad-1"], phaseIds: ["phase-1"], platforms: [{ domain: "ground", cmoId: 1304, name: "近程速射防空高炮", country: "通用", category: "防空炮", quantity: 4 }], notes: "末端近防保底" }
      ],
      combatForces: [
        { id: "cbf-radar-station", name: "相控阵空情预警雷达连", side: "friendly", role: "sense", conceptForceId: "cf-early-radar", group: "地面空情群", missionType: "recon", task: "持续广播航迹坐标", taskRefs: ["task-ad-1"], phaseIds: ["phase-1"], platforms: [{ domain: "ground", cmoId: 2301, name: "预警雷达A型", country: "通用", category: "雷达站", quantity: 2 }], notes: "雷达执行包" },
        { id: "cbf-ad-cp", name: "要地防空自动化指挥所编组", side: "friendly", role: "command", conceptForceId: "cf-layered-ad", group: "指控中心", missionType: "area_defense", task: "下发火力通道分配指令", taskRefs: ["task-ad-1"], phaseIds: ["phase-1"], platforms: [{ domain: "ground", cmoId: 2302, name: "指控车B型", country: "通用", category: "指控车", quantity: 1 }], notes: "指控执行包" },
        { id: "cbf-sam-battery", name: "地空导弹综合营编组", side: "friendly", role: "airDefense", conceptForceId: "cf-sam-strike", group: "地面防空群", missionType: "area_defense", task: "操作远程相控阵雷达与垂直发射拦截弹构筑空域天网", taskRefs: ["task-ad-1"], phaseIds: ["phase-1"], platforms: [{ domain: "ground", cmoId: 2303, name: "地导发射车C型", country: "通用", category: "发射车", quantity: 4 }], notes: "导弹执行包" },
        { id: "cbf-ciws-flight", name: "末端近防连排编组", side: "friendly", role: "support", conceptForceId: "cf-point-ciws", group: "近防火力群", missionType: "support", task: "执行要害阵地近程拦截防护", taskRefs: ["task-ad-1"], phaseIds: ["phase-1"], platforms: [{ domain: "ground", cmoId: 2304, name: "近防炮D型", country: "通用", category: "近防炮", quantity: 4 }], notes: "近防执行包" }
      ],
      relations: [
        { fromForceId: "cf-early-radar", toForceId: "cf-layered-ad", type: "information", note: "空中威胁航迹实时报送" },
        { fromForceId: "cf-layered-ad", toForceId: "cf-sam-strike", type: "command", note: "目标分配与导弹拦截引导授权" }
      ],
      openQuestions: ["在敌密集投掷反辐射诱饵弹时的雷达开关机与诱偏协同配合"],
      reviewChecklist: ["核对防空通道数与预期来袭饱和峰值密度"]
    }
  },
  {
    id: "tactic-force-05",
    category: "tactic",
    promptId: "ai.generate.force-mission",
    schema: "ForceMissionPlan",
    name: "软硬杀伤一体化电磁压制编成",
    description: "构建机载防区外干扰机与反辐射巡飞弹协同打击编队",
    input: {
      workflow: { title: "兵力任务", outputSchema: "ForceMissionPlan" },
      analysis: {
        operationalTasks: [
          { id: "task-ecm-1", name: "全频段远距支援干扰", side: "friendly", phaseId: "phase-1", missionType: "ecm", objective: "压制敌预警通信", expectedEffect: "形成通信黑障" }
        ],
        phaseAction: { phases: [{ id: "phase-1", name: "电磁压制阶段" }] }
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["summary", "forces", "combatForces", "relations"],
      minCounts: { forces: 4, combatForces: 4, relations: 2 },
      keywords: ["ecm", "friendly"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      summary: "由防区外大型电子战干扰机与伴随无人干扰诱饵组成复合压制编队，实施全频段软硬复合杀伤。",
      forces: [
        { id: "cf-esm-sense", name: "电磁辐射频谱侦测单元", side: "friendly", role: "sense", group: "电磁感知群", missionType: "recon", task: "全面测绘敌战场电磁态势与主辐射波形", taskRefs: ["task-ecm-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 1401, name: "电子频谱侦察机", country: "通用", category: "侦察机", quantity: 2 }], notes: "频谱侦测" },
        { id: "cf-ew-command", name: "网电空间作战协同指挥单元", side: "friendly", role: "command", group: "网电指控群", missionType: "command", task: "规划干扰频点与辐射功率分配", taskRefs: ["task-ecm-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 1402, name: "空中电子战指控机", country: "通用", category: "指控机", quantity: 1 }], notes: "电磁指挥" },
        { id: "cf-ew-mesh", name: "综合作战电磁对抗单元", side: "friendly", role: "support", group: "网电支援群", missionType: "ecm", task: "对敌指控雷达链路施加噪声压制与瞄准式窄带干扰", taskRefs: ["task-ecm-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 1403, name: "大型防区外干扰机", country: "通用", category: "干扰机", quantity: 2 }], notes: "电磁干扰" },
        { id: "cf-hard-kill", name: "反辐射精确硬杀伤突击单元", side: "friendly", role: "air", group: "反辐射突击群", missionType: "strike", task: "发射反辐射巡飞弹对暴露雷达实施硬摧毁", taskRefs: ["task-ecm-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 1404, name: "巡飞弹发射战术机", country: "通用", category: "战斗机", quantity: 4 }], notes: "硬摧毁突击" }
      ],
      combatForces: [
        { id: "cbf-esm-plane", name: "高敏电子侦察分队", side: "friendly", role: "sense", conceptForceId: "cf-esm-sense", group: "电子侦察组", missionType: "recon", task: "采集辐射源频点数据", taskRefs: ["task-ecm-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 2401, name: "侦测机A型", country: "通用", category: "侦察机", quantity: 2 }], notes: "频谱执行包" },
        { id: "cbf-ew-control", name: "电子战任务规划机组", side: "friendly", role: "command", conceptForceId: "cf-ew-command", group: "网电控制组", missionType: "command", task: "动态生成电子对抗战策", taskRefs: ["task-ecm-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 2402, name: "电子指挥机B型", country: "通用", category: "指控机", quantity: 1 }], notes: "指控执行包" },
        { id: "cbf-standoff-jamming", name: "防区外高功率电子干扰机编组", side: "friendly", role: "support", conceptForceId: "cf-ew-mesh", group: "电子支援战术群", missionType: "ecm", task: "保持战术空域8字航线巡逻并向敌方向发射大功率定向辐射", taskRefs: ["task-ecm-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 2403, name: "高功率干扰机C型", country: "通用", category: "干扰机", quantity: 2 }], notes: "干扰执行包" },
        { id: "cbf-harm-flight", name: "反辐射巡飞打击编组", side: "friendly", role: "air", conceptForceId: "cf-hard-kill", group: "突击机群", missionType: "strike", task: "突防投掷反辐射精确武器", taskRefs: ["task-ecm-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 2404, name: "战术机D型", country: "通用", category: "战斗机", quantity: 4 }], notes: "打击执行包" }
      ],
      relations: [
        { fromForceId: "cf-esm-sense", toForceId: "cf-ew-command", type: "information", note: "雷达辐射源频谱特征上传" },
        { fromForceId: "cf-ew-command", toForceId: "cf-ew-mesh", type: "command", note: "压制频段与照射扇区指派" }
      ],
      openQuestions: ["大功率干扰对己方雷达侦察频率的自相干扰电磁兼容抑制"],
      reviewChecklist: ["电磁频谱分配与敌友频率隔离方案审查"]
    }
  },
  {
    id: "tactic-force-06",
    category: "tactic",
    promptId: "ai.generate.force-mission",
    schema: "ForceMissionPlan",
    name: "无人异构集群与母艇母机立体协同编组",
    description: "验证母舰平台投放水下微型潜航器与巡飞弹协同作战编队",
    input: {
      workflow: { title: "兵力任务", outputSchema: "ForceMissionPlan" },
      analysis: {
        operationalTasks: [
          { id: "task-swarm-1", name: "异构微小型集群饱和渗透", side: "friendly", phaseId: "phase-1", missionType: "strike", objective: "破击敌要害阵地", expectedEffect: "瘫痪关键指挥节点" }
        ],
        phaseAction: { phases: [{ id: "phase-1", name: "集群突防阶段" }] }
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["summary", "forces", "combatForces", "relations"],
      minCounts: { forces: 4, combatForces: 4, relations: 2 },
      keywords: ["strike", "friendly"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      summary: "母机承载并快速投放微型自组织巡飞弹蜂群，实现防区外安全发射与蜂群末端自主寻歼。",
      forces: [
        { id: "cf-swarm-scout", name: "蜂群微型先导侦察单元", side: "friendly", role: "sense", group: "集群先导群", missionType: "recon", task: "低空超低空渗透勘察敌防御漏洞与关键目标", taskRefs: ["task-swarm-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 1501, name: "微型侦察无人机", country: "通用", category: "无人机", quantity: 6 }], notes: "微型侦察" },
        { id: "cf-swarm-mother", name: "立体投送与指挥母机单元", side: "friendly", role: "command", group: "投送指挥群", missionType: "command", task: "在战术安全边界投送蜂群并协调组网协议", taskRefs: ["task-swarm-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 1502, name: "蜂群运载投送母机", country: "通用", category: "运输机", quantity: 1 }], notes: "母机指控" },
        { id: "cf-hetero-swarm", name: "分布式异构集群攻防作战单元", side: "friendly", role: "air", group: "集群作战群", missionType: "strike", task: "接收任务包后自主分散入役，形成动态包围圈攻击", taskRefs: ["task-swarm-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 1503, name: "微型自杀攻击巡飞弹", country: "通用", category: "巡飞弹", quantity: 24 }], notes: "集群突防" },
        { id: "cf-swarm-supp", name: "蜂群射频链路中继保障单元", side: "friendly", role: "support", group: "链路保障群", missionType: "support", task: "维持母机与去中心化蜂群节点之间的人在回路链路", taskRefs: ["task-swarm-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 1504, name: "战术中继无人机", country: "通用", category: "无人机", quantity: 2 }], notes: "链路保障" }
      ],
      combatForces: [
        { id: "cbf-scout-swarm", name: "先导微型蜂群探针分队", side: "friendly", role: "sense", conceptForceId: "cf-swarm-scout", group: "先导侦察机群", missionType: "recon", task: "探查防空雷达盲区", taskRefs: ["task-swarm-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 2501, name: "探针微型机A型", country: "通用", category: "无人机", quantity: 6 }], notes: "侦察执行包" },
        { id: "cbf-mothership-carrier", name: "蜂群运载投送母机编队", side: "friendly", role: "command", conceptForceId: "cf-swarm-mother", group: "空中投送机群", missionType: "command", task: "在战术安全边界完成高密度蜂群弹射展开并提供初始数据链", taskRefs: ["task-swarm-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 2502, name: "投送母机B型", country: "通用", category: "运输机", quantity: 1 }], notes: "母机执行包" },
        { id: "cbf-suicide-swarm", name: "微型饱和自杀攻击蜂群组", side: "friendly", role: "air", conceptForceId: "cf-hetero-swarm", group: "饱和突击机群", missionType: "strike", task: "向要害节点发起多角度同时命中攻击", taskRefs: ["task-swarm-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 2503, name: "巡飞弹C型", country: "通用", category: "巡飞弹", quantity: 24 }], notes: "突击执行包" },
        { id: "cbf-relay-drone", name: "空中战术网关伴随保障组", side: "friendly", role: "support", conceptForceId: "cf-swarm-supp", group: "伴随保障机群", missionType: "support", task: "在战区外围保障指令回传", taskRefs: ["task-swarm-1"], phaseIds: ["phase-1"], platforms: [{ domain: "aircraft", cmoId: 2504, name: "中继无人机D型", country: "通用", category: "无人机", quantity: 2 }], notes: "保障执行包" }
      ],
      relations: [
        { fromForceId: "cf-swarm-scout", toForceId: "cf-swarm-mother", type: "information", note: "前沿微型侦察目标动态上报" },
        { fromForceId: "cf-swarm-mother", toForceId: "cf-hetero-swarm", type: "command", note: "目标攻击包分发与集群协同授权" }
      ],
      openQuestions: ["蜂群投放瞬间的气动分离安全及快速建链时间"],
      reviewChecklist: ["审查蜂群自杀攻击决策伦理门禁（HITL模式保持）"]
    }
  },

  // ==========================================
  // 二、机理类 (Mechanism) 10 条
  // ==========================================
  // 2.1 ai.generate.activity-decomposition (5 条)
  {
    id: "mech-decomp-01",
    category: "mechanism",
    promptId: "ai.generate.activity-decomposition",
    schema: "ActivityDecompositionDraft",
    name: "预警探测与航迹多源融合活动分解",
    description: "对高层探测活动开展 DoDAF OV-5a 规范化工序分解",
    input: {
      workflow: { title: "活动分解", outputSchema: "ActivityDecompositionDraft" },
      analysis: {
        parentActivity: { id: "act-detect-root", title: "广域空天目标立体侦测与关联" },
        activities: [{ id: "act-detect-root", title: "广域空天目标立体侦测与关联" }]
      },
      evidence: [
        { id: "chunk-fusion-01", title: "多雷达航迹融合算法.md", summary: "点迹滤波、时间对齐与关联矩阵计算是融合的三大基础环节" }
      ]
    },
    expectedAssertions: {
      requiredFields: ["summary", "activities", "decompositions"],
      minCounts: { activities: 3, decompositions: 2 },
      keywords: ["滤波", "航迹", "融合", "关联"],
      negativeKeywords: ["经纬度", "由于缺乏前置上下文"]
    },
    goldenReference: {
      summary: "将探测总活动分解为雷达点迹截获、时间空间坐标对齐以及多源多假设航迹关联融合三道精细工序。",
      activities: [
        { id: "act-sub-capture", title: "多站射频原始点迹截获与预处理", type: "感知", domain: "综合", autonomy: "HOTL", performer: "分布式雷达网节点", timingWindow: "100ms", input: "反射射频回波信号", output: "标准目标点迹列表", parentId: "act-detect-root", text: "实时滤波提取目标方位、距离及信噪比参数", citations: [{ chunkId: "chunk-fusion-01", snippet: "点迹滤波、时间对齐与关联矩阵计算是融合的三大基础环节" }] },
        { id: "act-sub-align", title: "时空基准对齐与野值剔除", type: "识别", domain: "综合", autonomy: "HOOTL", performer: "数据融合前端处理器", timingWindow: "50ms", input: "标准目标点迹列表", output: "统一时空框架点迹数据", parentId: "act-detect-root", text: "消除各站点时钟误差与天线安装偏差并过滤杂波", citations: [{ chunkId: "chunk-fusion-01", snippet: "点迹滤波、时间对齐与关联矩阵计算是融合的三大基础环节" }] },
        { id: "act-sub-fusion", title: "多假设航迹关联与态势生成", type: "识别", domain: "综合", autonomy: "HOTL", performer: "中心态势服务器", timingWindow: "200ms", input: "统一时空框架点迹数据", output: "高置信度目标综合航迹", parentId: "act-detect-root", text: "利用卡尔曼滤波与关联矩阵确定唯一连续目标航迹", citations: [{ chunkId: "chunk-fusion-01", snippet: "点迹滤波、时间对齐与关联矩阵计算是融合的三大基础环节" }] }
      ],
      decompositions: [
        { parentActivityRef: "act-detect-root", childActivityRef: "act-sub-capture", rationale: "第一道物理截获工序" },
        { parentActivityRef: "act-detect-root", childActivityRef: "act-sub-align", rationale: "第二道时空对齐与数据洗净工序" },
        { parentActivityRef: "act-detect-root", childActivityRef: "act-sub-fusion", rationale: "第三道航迹生成工序" }
      ]
    }
  },
  {
    id: "mech-decomp-02",
    category: "mechanism",
    promptId: "ai.generate.activity-decomposition",
    schema: "ActivityDecompositionDraft",
    name: "协同交火与末端制导移交工序分解",
    description: "分解跨平台制导链从母机引导向末端主动雷达寻的移交的工序",
    input: {
      workflow: { title: "活动分解", outputSchema: "ActivityDecompositionDraft" },
      analysis: {
        parentActivity: { id: "act-fire-handoff", title: "中远距空空协同交战制导" }
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["summary", "activities", "decompositions"],
      minCounts: { activities: 2, decompositions: 1 },
      keywords: ["制导", "移交", "导引头"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      summary: "分解中继引导阶段、中末段制导权移交以及导引头开机截获三个因果活动步骤。",
      activities: [
        { id: "act-midcourse-guide", title: "双向数据链中段航迹修正", type: "控制", domain: "空中", autonomy: "HOOTL", performer: "中继预警机/发射机", timingWindow: "5s", input: "实时目标更新航迹", output: "导弹修正指令包", parentId: "act-fire-handoff", text: "持续向处于中段巡航的导弹发送目标预估截击点" },
        { id: "act-seeker-handoff", title: "末端主动导引头捕获与锁定确认", type: "行动", domain: "空中", autonomy: "HITL", performer: "截击弹导引头", timingWindow: "1s", input: "目标截击空域窗口", output: "自主锁定回传确认", parentId: "act-fire-handoff", text: "导弹导引头开机自扫描并锁定真实目标" }
      ],
      decompositions: [
        { parentActivityRef: "act-fire-handoff", childActivityRef: "act-midcourse-guide", rationale: "中段机理支撑" },
        { parentActivityRef: "act-fire-handoff", childActivityRef: "act-seeker-handoff", rationale: "末端接管闭环" }
      ]
    }
  },
  {
    id: "mech-decomp-03",
    category: "mechanism",
    promptId: "ai.generate.activity-decomposition",
    schema: "ActivityDecompositionDraft",
    name: "综合射频协同压制工序分解",
    description: "分解多机协同射频干扰的频段分配、时序同步与对消验证工序",
    input: {
      workflow: { title: "活动分解", outputSchema: "ActivityDecompositionDraft" },
      analysis: {
        parentActivity: { id: "act-rf-jamming", title: "多机分布式综合射频压制" }
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["summary", "activities", "decompositions"],
      minCounts: { activities: 2, decompositions: 1 },
      keywords: ["射频", "压制", "干扰"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      summary: "涵盖侦察截获分析、综合射频频谱资源协调分配及同步复合干扰发射三道工序。",
      activities: [
        { id: "act-spec-allocate", title: "协同干扰通道与时隙自适应规划", type: "决策", domain: "电磁", autonomy: "HOTL", performer: "电磁指控协调节点", timingWindow: "2s", input: "威胁雷达主频表", output: "编队干扰方案分配表", parentId: "act-rf-jamming", text: "动态划分各机压制子频带以防同频互扰" },
        { id: "act-sync-radiate", title: "多阵元相干时空同步压制辐射", type: "电子对抗", domain: "电磁", autonomy: "HOOTL", performer: "干扰吊舱阵列", timingWindow: "10s", input: "规划时序与脉冲波形", output: "高功率空间合成压制能量", parentId: "act-rf-jamming", text: "向目标雷达主瓣及主要旁瓣注入高占空比杂波" }
      ],
      decompositions: [
        { parentActivityRef: "act-rf-jamming", childActivityRef: "act-spec-allocate", rationale: "决策与资源分配前置" },
        { parentActivityRef: "act-rf-jamming", childActivityRef: "act-sync-radiate", rationale: "物理对抗执行闭环" }
      ]
    }
  },
  {
    id: "mech-decomp-04",
    category: "mechanism",
    promptId: "ai.generate.activity-decomposition",
    schema: "ActivityDecompositionDraft",
    name: "节点战损重构与自主替补活动分解",
    description: "分解杀伤网主节点失效后的拓扑自愈与备用通道激活工序",
    input: {
      workflow: { title: "活动分解", outputSchema: "ActivityDecompositionDraft" },
      analysis: {
        parentActivity: { id: "act-net-healing", title: "战时网络拓扑动态自愈与重构" }
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["summary", "activities", "decompositions"],
      minCounts: { activities: 2, decompositions: 1 },
      keywords: ["重构", "自愈", "拓扑"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      summary: "包含心跳丢失故障判定、备用候选节点权重选举及路由路由全网广播更新三个环节。",
      activities: [
        { id: "act-detect-loss", title: "核心指挥节点通信心跳超时判损", type: "评估", domain: "网络", autonomy: "HOOTL", performer: "分布式共识代理", timingWindow: "500ms", input: "节点连续失联时钟", output: "节点战损状态确认报文", parentId: "act-net-healing", text: "多邻近节点协同投票判定主节点是否失效" },
        { id: "act-elect-backup", title: "次级备用指挥席位自动激活接管", type: "控制", domain: "综合", autonomy: "HITL", performer: "备用指挥母机/预警机", timingWindow: "3s", input: "战损确认与当前态势快照", output: "新指挥拓扑路由指令", parentId: "act-net-healing", text: "副指挥席位无缝拉起战术数据库接管交火授权" }
      ],
      decompositions: [
        { parentActivityRef: "act-net-healing", childActivityRef: "act-detect-loss", rationale: "自愈触发判定" },
        { parentActivityRef: "act-net-healing", childActivityRef: "act-elect-backup", rationale: "职能转移与重构执行" }
      ]
    }
  },
  {
    id: "mech-decomp-05",
    category: "mechanism",
    promptId: "ai.generate.activity-decomposition",
    schema: "ActivityDecompositionDraft",
    name: "毁伤多维评估与再打击裁决活动分解",
    description: "分解打击后多源传感器效果采集、毁伤等级判定与补充打击决策",
    input: {
      workflow: { title: "活动分解", outputSchema: "ActivityDecompositionDraft" },
      analysis: {
        parentActivity: { id: "act-bda-root", title: "目标战果实时评估与再打击裁决" }
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["summary", "activities", "decompositions"],
      minCounts: { activities: 2, decompositions: 1 },
      keywords: ["评估", "毁伤", "再打击"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      summary: "分解为多光谱光电信号采集、物理功能残存度计算与火力再打击裁决决策工序。",
      activities: [
        { id: "act-collect-bda", title: "攻击点红外与合成孔径雷达复核成像", type: "感知", domain: "综合", autonomy: "HOTL", performer: "低轨侦察卫星与战术无人机", timingWindow: "30s", input: "目标打击坐标与时间窗口", output: "毁伤前后对比影像及辐射谱", parentId: "act-bda-root", text: "快速拍摄轰炸爆心结构破坏与次生火灾烟尘" },
        { id: "act-decision-restrike", title: "战果功能等级评估与再打击裁决", type: "决策", domain: "综合", autonomy: "HITL", performer: "联合火力指挥参谋席", timingWindow: "15s", input: "毁伤评估报告", output: "转火撤销或备用梯队再打击补射命令", parentId: "act-bda-root", text: "根据目标雷达射频是否归零做出是否追加实施再打击决策" }
      ],
      decompositions: [
        { parentActivityRef: "act-bda-root", childActivityRef: "act-collect-bda", rationale: "效果证据收集" },
        { parentActivityRef: "act-bda-root", childActivityRef: "act-decision-restrike", rationale: "因果决策回路" }
      ]
    }
  },

  // 2.2 ai.generate.ov1-graphic (5 条)
  {
    id: "mech-ov1-01",
    category: "mechanism",
    promptId: "ai.generate.ov1-graphic",
    schema: "OperationalConceptGraphic",
    name: "五节点分布式防空总体机理图",
    description: "生成严格满足 sense, decide, control, opponent, assess 五节点的概念图",
    input: {
      workflow: { title: "OV-1 总体图", outputSchema: "OperationalConceptGraphic" },
      analysis: {
        brief: { objective: "分布式抗击饱和打击", approach: "五节点环路闭环" }
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["concept", "nodes", "edges"],
      minCounts: { nodes: 5, edges: 4 },
      keywords: ["sense", "decide", "control", "opponent", "assess"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      concept: {
        mission: "防空火力闭环拦截",
        objective: "阻断敌饱和空袭",
        scope: "区域相对网格空域",
        phase: "防空交战阶段",
        expectedEffects: "破坏敌进攻时序",
        constraints: "弹药通道限制"
      },
      nodes: [
        { id: "sense", label: "天基与防空雷达网", detail: "连续监视与目标发现", category: "感知", kind: "equipment" },
        { id: "decide", label: "联合防空指挥控制中枢", detail: "威胁排队与火力分配", category: "指挥", kind: "command" },
        { id: "control", label: "防空导弹发射阵地", detail: "多联装导弹发射执行", category: "行动", kind: "action" },
        { id: "opponent", label: "敌多批次突防巡航导弹群", detail: "低空密集空袭集群", category: "外部", kind: "external" },
        { id: "assess", label: "雷达与光电战果核验", detail: "拦截脱靶量与毁伤评估", category: "效果", kind: "effect" }
      ],
      edges: [
        { id: "e1", sourceId: "opponent", targetId: "sense", type: "态势变化" },
        { id: "e2", sourceId: "sense", targetId: "decide", type: "信息流" },
        { id: "e3", sourceId: "decide", targetId: "control", type: "控制流" },
        { id: "e4", sourceId: "control", targetId: "assess", type: "态势变化" },
        { id: "e5", sourceId: "assess", targetId: "decide", type: "反馈" }
      ]
    }
  },
  {
    id: "mech-ov1-02",
    category: "mechanism",
    promptId: "ai.generate.ov1-graphic",
    schema: "OperationalConceptGraphic",
    name: "异构无人蜂群拒止突贯总体概念图",
    description: "构建异构小型无人蜂群破击关键节点的五节点总体概念图",
    input: {
      workflow: { title: "OV-1 总体图", outputSchema: "OperationalConceptGraphic" },
      analysis: {
        brief: { objective: "蜂群穿透防御", approach: "去中心化动态包围" }
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["concept", "nodes", "edges"],
      minCounts: { nodes: 5, edges: 4 },
      keywords: ["sense", "decide", "control", "opponent", "assess"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      concept: {
        mission: "蜂群渗透要害破击",
        objective: "消耗并突破防线",
        scope: "前沿阻隔网格区",
        phase: "突防交火阶段",
        expectedEffects: "压制敌防御哨位",
        constraints: "蜂群电池续航时间"
      },
      nodes: [
        { id: "sense", label: "先导微型光学侦察蜂群", detail: "低空渗透侦测", category: "感知", kind: "equipment" },
        { id: "decide", label: "机载蜂群任务规划主板", detail: "自主动态协同决策", category: "指挥", kind: "command" },
        { id: "control", label: "自杀式巡飞攻击无人机", detail: "末端俯冲碰撞引爆", category: "行动", kind: "action" },
        { id: "opponent", label: "敌野战防空高炮与雷达", detail: "近程火力拦截拦截网", category: "外部", kind: "external" },
        { id: "assess", label: "伴随侦察机毁伤核验", detail: "高价值雷达开机率监测", category: "效果", kind: "effect" }
      ],
      edges: [
        { id: "e1", sourceId: "opponent", targetId: "sense", type: "态势变化" },
        { id: "e2", sourceId: "sense", targetId: "decide", type: "信息流" },
        { id: "e3", sourceId: "decide", targetId: "control", type: "控制流" },
        { id: "e4", sourceId: "control", targetId: "assess", type: "态势变化" },
        { id: "e5", sourceId: "assess", targetId: "decide", type: "反馈" }
      ]
    }
  },
  {
    id: "mech-ov1-03",
    category: "mechanism",
    promptId: "ai.generate.ov1-graphic",
    schema: "OperationalConceptGraphic",
    name: "跨域立体反潜与通道阻击机理图",
    description: "呈现水下、水面与空中声学数据交联反潜闭环",
    input: {
      workflow: { title: "OV-1 总体图", outputSchema: "OperationalConceptGraphic" },
      analysis: {
        brief: { objective: "海峡水下封锁", approach: "空潜声纳协同反潜" }
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["concept", "nodes", "edges"],
      minCounts: { nodes: 5, edges: 4 },
      keywords: ["sense", "decide", "control", "opponent", "assess"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      concept: {
        mission: "海峡反潜屏障阻击",
        objective: "阻止敌潜艇渗入",
        scope: "咽喉水道相对坐标系",
        phase: "巡逻猎潜阶段",
        expectedEffects: "潜艇无害化或迫退",
        constraints: "声线跃层深度"
      },
      nodes: [
        { id: "sense", label: "水听阵列与空投声呐浮标", detail: "水声频谱采集定位", category: "感知", kind: "equipment" },
        { id: "decide", label: "反潜作战巡逻机指挥中心", detail: "声学目标特征比对判型", category: "指挥", kind: "command" },
        { id: "control", label: "反潜护卫舰火箭助飞鱼雷", detail: "远距快速入水攻击", category: "行动", kind: "action" },
        { id: "opponent", label: "敌核动力攻击潜艇", detail: "大潜深低速静音潜航", category: "外部", kind: "external" },
        { id: "assess", label: "磁异探测仪与浮标二次复核", detail: "目标回音消失与爆炸声确认", category: "效果", kind: "effect" }
      ],
      edges: [
        { id: "e1", sourceId: "opponent", targetId: "sense", type: "态势变化" },
        { id: "e2", sourceId: "sense", targetId: "decide", type: "信息流" },
        { id: "e3", sourceId: "decide", targetId: "control", type: "控制流" },
        { id: "e4", sourceId: "control", targetId: "assess", type: "态势变化" },
        { id: "e5", sourceId: "assess", targetId: "decide", type: "反馈" }
      ]
    }
  },
  {
    id: "mech-ov1-04",
    category: "mechanism",
    promptId: "ai.generate.ov1-graphic",
    schema: "OperationalConceptGraphic",
    name: "电磁压制与饱和反辐射攻防概念图",
    description: "描绘防区外电子战机、干扰诱饵与反辐射弹药协同回路",
    input: {
      workflow: { title: "OV-1 总体图", outputSchema: "OperationalConceptGraphic" },
      analysis: {
        brief: { objective: "致盲预警雷达", approach: "软硬结合精准破网" }
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["concept", "nodes", "edges"],
      minCounts: { nodes: 5, edges: 4 },
      keywords: ["sense", "decide", "control", "opponent", "assess"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      concept: {
        mission: "防空雷达网防区外破击",
        objective: "瘫痪预警指挥神经网",
        scope: "战术纵深相对网格",
        phase: "电磁破击阶段",
        expectedEffects: "雷达停止辐射",
        constraints: "电子支援飞机巡逻空域"
      },
      nodes: [
        { id: "sense", label: "高灵敏电子侦察吊舱", detail: "雷达波形脉冲精准测向", category: "感知", kind: "equipment" },
        { id: "decide", label: "电子战联合任务控制席位", detail: "干扰频段与反辐射弹药分配", category: "指挥", kind: "command" },
        { id: "control", label: "超音速反辐射突击导弹", detail: "顺波束追踪精准毁伤天线", category: "行动", kind: "action" },
        { id: "opponent", label: "敌相控阵远程预警雷达阵地", detail: "大功率跳频搜索跟踪", category: "外部", kind: "external" },
        { id: "assess", label: "信号强度骤降与停机监测", detail: "射频静默持续时间评估", category: "效果", kind: "effect" }
      ],
      edges: [
        { id: "e1", sourceId: "opponent", targetId: "sense", type: "态势变化" },
        { id: "e2", sourceId: "sense", targetId: "decide", type: "信息流" },
        { id: "e3", sourceId: "decide", targetId: "control", type: "控制流" },
        { id: "e4", sourceId: "control", targetId: "assess", type: "态势变化" },
        { id: "e5", sourceId: "assess", targetId: "decide", type: "反馈" }
      ]
    }
  },
  {
    id: "mech-ov1-05",
    category: "mechanism",
    promptId: "ai.generate.ov1-graphic",
    schema: "OperationalConceptGraphic",
    name: "岛基弹性防御与分散火力交联机理图",
    description: "展示分布式分散发射架与空中预警机数据直连的抗毁机理",
    input: {
      workflow: { title: "OV-1 总体图", outputSchema: "OperationalConceptGraphic" },
      analysis: {
        brief: { objective: "岛礁分散阵地抗毁存活", approach: "射频静默+远端数据链火控" }
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["concept", "nodes", "edges"],
      minCounts: { nodes: 5, edges: 4 },
      keywords: ["sense", "decide", "control", "opponent", "assess"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      concept: {
        mission: "岛基分布式抗毁拦截",
        objective: "保持节点分散与持续火力输出",
        scope: "岛链防御前哨相对网格",
        phase: "阵地固守阶段",
        expectedEffects: "提升阵地存活率",
        constraints: "岛礁纵深受限"
      },
      nodes: [
        { id: "sense", label: "长航时空中预警机雷达", detail: "空天视角下视海空态势", category: "感知", kind: "equipment" },
        { id: "decide", label: "后方防空联合指挥所", detail: "火控级高速指令分发", category: "指挥", kind: "command" },
        { id: "control", label: "岛基分散隐蔽垂直发射箱", detail: "冷发射无雷达暴露接战", category: "行动", kind: "action" },
        { id: "opponent", label: "敌远距隐身战机突击编队", detail: "超低空防区外投掷弹药", category: "外部", kind: "external" },
        { id: "assess", label: "远端光电吊舱红外爆破特征", detail: "目标坠海与二次燃烧判定", category: "效果", kind: "effect" }
      ],
      edges: [
        { id: "e1", sourceId: "opponent", targetId: "sense", type: "态势变化" },
        { id: "e2", sourceId: "sense", targetId: "decide", type: "信息流" },
        { id: "e3", sourceId: "decide", targetId: "control", type: "控制流" },
        { id: "e4", sourceId: "control", targetId: "assess", type: "态势变化" },
        { id: "e5", sourceId: "assess", targetId: "decide", type: "反馈" }
      ]
    }
  },

  // ==========================================
  // 三、想定类 (Scenario) 10 条
  // ==========================================
  // 3.1 ai.generate.scenario (6 条)
  {
    id: "scenario-draft-01",
    category: "scenario",
    promptId: "ai.generate.scenario",
    schema: "ScenarioDraft",
    name: "前沿海空走廊遭遇与对抗推演想定",
    description: "在抽象相对网格（0-100）上设定红蓝对抗遭遇战",
    input: {
      workflow: { title: "仿真想定", outputSchema: "ScenarioDraft" },
      analysis: {
        scenarioScope: "前沿走廊对峙推演",
        phaseAction: { phases: [{ name: "对峙与接触", timeWindow: "T+00:00-T+00:30" }] },
        forces: [{ id: "f-blue-1", name: "蓝方巡逻编队", side: "friendly" }, { id: "f-red-1", name: "红方侦察单元", side: "hostile" }]
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["title", "summary", "entities", "areas", "timeline", "narrative"],
      minCounts: { entities: 2, areas: 1, timeline: 2 },
      keywords: ["friendly", "hostile", "patrol"],
      negativeKeywords: ["东经", "北纬", "经纬度", "由于缺乏前置上下文"]
    },
    goldenReference: {
      title: "前沿海空走廊遭遇战术推演想定",
      summary: "在相对网格前沿巡逻走廊中，蓝方护航编队遭遇红方突发多机前出侦察，展开电磁静默对峙与驱离推演。",
      entities: [
        { id: "e-blue-patrol", label: "蓝方护航战术编组", role: "command", side: "friendly", position: [25, 40], platform: "区域防空驱逐舰", task: "维持预定走廊巡逻线" },
        { id: "e-red-recon", label: "红方高速前出侦察机", role: "sensor", side: "hostile", position: [75, 45], platform: "远距海上巡逻机", task: "试探蓝方雷达覆盖边界" }
      ],
      areas: [
        { id: "area-corridor", label: "战术巡逻走廊", type: "patrol", position: [50, 45], size: 120, geometryType: "corridor", points: [{ latitude: 0, longitude: 0, label: "网格走廊中轴" }] }
      ],
      timeline: [
        { time: "T+00:05", phase: "接触对峙", title: "红方侦察机越过巡逻外沿", description: "红方辐射源信号被蓝方被动测向截获", impact: "蓝方全舰转入一级战备" },
        { time: "T+00:20", phase: "接触对峙", title: "蓝方雷达开机照射警告", description: "火控雷达锁定红方侦察机实施电磁驱离", impact: "红方调头退出警戒走廊" }
      ],
      narrative: "本想定旨在检验双方在非交火状态下的规则反应灵敏度与电磁取证闭环时效。"
    }
  },
  {
    id: "scenario-draft-02",
    category: "scenario",
    promptId: "ai.generate.scenario",
    schema: "ScenarioDraft",
    name: "多方向立体封控与破障推演想定",
    description: "验证红方实施三向立体封锁时，蓝方突击群穿透破障的动态对抗过程",
    input: {
      workflow: { title: "仿真想定", outputSchema: "ScenarioDraft" },
      analysis: {
        scenarioScope: "立体封控突围推演",
        phaseAction: { phases: [{ name: "突破封控", timeWindow: "T+00:00-T+01:00" }] },
        forces: [{ id: "f-blue-break", name: "蓝方破障编队", side: "friendly" }]
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["title", "summary", "entities", "areas", "timeline", "narrative"],
      minCounts: { entities: 2, areas: 1, timeline: 2 },
      keywords: ["friendly", "hostile", "exclusion"],
      negativeKeywords: ["经纬度", "北纬", "东经"]
    },
    goldenReference: {
      title: "多方向立体封控破障推演想定",
      summary: "红方构建包含水下雷区、水面巡逻与空域截击的三层封控圈，蓝方实施联合破网突围行动。",
      entities: [
        { id: "ent-blue-spear", label: "蓝方先锋破障群", role: "action", side: "friendly", position: [15, 50], platform: "快速攻击护卫舰", task: "清除水雷并撕开突破口" },
        { id: "ent-red-blocker", label: "红方外层水面封锁舰", role: "opponent", side: "hostile", position: [60, 50], platform: "导弹巡洋舰", task: "封锁主航道并实施超视距火力阻截" }
      ],
      areas: [
        { id: "area-minefield", label: "雷障封控危险区", type: "exclusion", position: [40, 50], size: 100, geometryType: "circle", points: [{ latitude: 0, longitude: 0, label: "雷区中心" }] }
      ],
      timeline: [
        { time: "T+00:15", phase: "突破封控", title: "扫雷无人艇群展开作业", description: "蓝方在相对网格开辟出宽约5个单位的安全通道", impact: "降低主舰受损概率" },
        { time: "T+00:45", phase: "突破封控", title: "主突击群高速贯穿封锁线", description: "在烟幕与电磁干扰掩护下穿过狭窄水道", impact: "突破红方外层包围圈" }
      ],
      narrative: "评估高危封控区突破行动中，无人扫雷前导对保障主战舰艇突围速度与生存率的关键作用。"
    }
  },
  {
    id: "scenario-draft-03",
    category: "scenario",
    promptId: "ai.generate.scenario",
    schema: "ScenarioDraft",
    name: "强电磁干扰与通信拒止环境下的防空反导想定",
    description: "检验卫星通信被切断后，各战术节点基于预设规则自主防空的推演想定",
    input: {
      workflow: { title: "仿真想定", outputSchema: "ScenarioDraft" },
      analysis: {
        scenarioScope: "通信拒止自主防空",
        phaseAction: { phases: [{ name: "自主拦截", timeWindow: "T+00:00-T+00:20" }] },
        forces: [{ id: "f-blue-ad", name: "蓝方防空单元", side: "friendly" }]
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["title", "summary", "entities", "timeline", "narrative"],
      minCounts: { entities: 2, timeline: 2 },
      keywords: ["friendly", "hostile", "sensor"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      title: "通信拒止环境下自主防空反导推演想定",
      summary: "在红方全频段压制干扰导致指挥所指令中断时，蓝方前沿防空导弹发射架启用预置交战规则自主截击。",
      entities: [
        { id: "ent-blue-radar", label: "蓝方伴随对空雷达哨", role: "sensor", side: "friendly", position: [25, 30], platform: "机动相控阵低空雷达", task: "独立探测超低空目标" },
        { id: "ent-blue-auto-sam", label: "蓝方自主防空发射单元", role: "command", side: "friendly", position: [30, 30], platform: "野战防空发射车", task: "失联下自主激活防空火控" },
        { id: "ent-red-incoming", label: "红方低空反舰巡航导弹群", role: "opponent", side: "hostile", position: [80, 32], platform: "高亚音速巡航导弹", task: "掠海突防打击蓝方阵地" }
      ],
      areas: [
        { id: "area-jammed", label: "强电磁干扰重度覆盖区", type: "exclusion", position: [50, 30], size: 140, geometryType: "circle", points: [{ latitude: 0, longitude: 0, label: "干扰中心" }] }
      ],
      timeline: [
        { time: "T+00:02", phase: "自主拦截", title: "上级数据链通信中断", description: "车载通信机信噪比降至门限以下，进入独立交战模式", impact: "系统转为本地传感器决策" },
        { time: "T+00:12", phase: "自主拦截", title: "毫米波雷达自捕获并开火", description: "在15个网格单位距离连续发射两枚拦截弹", impact: "首批来袭弹药空中解体" }
      ],
      narrative: "推演检验去中心化自主交战规则在极端通信受阻时的保底防空截击效能。"
    }
  },
  {
    id: "scenario-draft-04",
    category: "scenario",
    promptId: "ai.generate.scenario",
    schema: "ScenarioDraft",
    name: "无人集群饱和攻击要地拦截想定",
    description: "验证基地防空面对多批次低成本无人自杀机集群时的弹药消耗与拦截率",
    input: {
      workflow: { title: "仿真想定", outputSchema: "ScenarioDraft" },
      analysis: {
        scenarioScope: "要地蜂群防御",
        phaseAction: { phases: [{ name: "饱和抗击", timeWindow: "T+00:00-T+00:15" }] },
        forces: []
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["title", "summary", "entities", "timeline", "narrative"],
      minCounts: { entities: 2, timeline: 2 },
      keywords: ["friendly", "hostile"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      title: "无人蜂群饱和空袭要地综合拦截想定",
      summary: "面对红方三批次共计百架规模小型无人机蜂群空袭，蓝方组合运用微波定向能、近防弹炮与网捕系统实施多层防御。",
      entities: [
        { id: "ent-blue-base-guard", label: "基地近程综合防空系统", role: "action", side: "friendly", position: [20, 70], platform: "高炮导弹微波综合防御车", task: "守卫跑道及指挥枢纽" },
        { id: "ent-red-swarm-wave", label: "红方自杀式无人蜂群编队", role: "opponent", side: "hostile", position: [65, 75], platform: "微型巡飞弹集群", task: "密集突防瘫痪雷达天线" }
      ],
      areas: [
        { id: "area-base-protect", label: "要地核心防空内圈", type: "patrol", position: [20, 70], size: 60, geometryType: "circle", points: [{ latitude: 0, longitude: 0, label: "基地中心" }] }
      ],
      timeline: [
        { time: "T+00:04", phase: "饱和抗击", title: "高功率微波连续照射", description: "定向能系统使首波蜂群航电短路坠落", impact: "消解30%进攻规模" },
        { time: "T+00:09", phase: "饱和抗击", title: "转管速射炮拦截漏网目标", description: "密集阵雷达自动装订引信实施幕帘射击", impact: "残余蜂群全数被摧毁" }
      ],
      narrative: "揭示定向能面杀伤手段与传统动能防空速射武器在抵御密集集群攻击时的互补优势。"
    }
  },
  {
    id: "scenario-draft-05",
    category: "scenario",
    promptId: "ai.generate.scenario",
    schema: "ScenarioDraft",
    name: "隐身突防与多基站协同探测推演想定",
    description: "验证双三基准雷达网络通过前向散射效应对隐身飞机的探测捕获",
    input: {
      workflow: { title: "仿真想定", outputSchema: "ScenarioDraft" },
      analysis: {
        scenarioScope: "反隐身网络推演",
        phaseAction: { phases: [{ name: "前向散射探测", timeWindow: "T+00:00-T+00:25" }] },
        forces: []
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["title", "summary", "entities", "timeline", "narrative"],
      minCounts: { entities: 2, timeline: 2 },
      keywords: ["friendly", "hostile", "sensor"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      title: "隐身突防与多基站雷达协同探测想定",
      summary: "红方隐身轰炸机利用雷达低反射截面企图静默穿透防线，蓝方收发分置双基地雷达网通过基线交叉捕获目标扰动。",
      entities: [
        { id: "ent-blue-bistatic-tx", label: "蓝方大功率连续波发射站", role: "sensor", side: "friendly", position: [10, 20], platform: "固定式地面发射阵地", task: "向空域投射连续高频探照波" },
        { id: "ent-blue-bistatic-rx", label: "蓝方多通道被动接收车", role: "sensor", side: "friendly", position: [30, 80], platform: "机动式静默接收天线", task: "检测双基地基线前向散射畸变" },
        { id: "ent-red-stealth-bomber", label: "红方隐身穿透突击机", role: "opponent", side: "hostile", position: [85, 50], platform: "先进低可探测隐身飞机", task: "沿雷达盲区航路实施突入" }
      ],
      areas: [
        { id: "area-bistatic-gate", label: "双基地探照栅栏", type: "patrol", position: [20, 50], size: 120, geometryType: "corridor", points: [{ latitude: 0, longitude: 0, label: "基线中点" }] }
      ],
      timeline: [
        { time: "T+00:08", phase: "前向散射探测", title: "隐身飞机穿越收发基线", description: "接收站记录到显著的前向散射电平突增", impact: "解算出目标穿越时点与速度" },
        { time: "T+00:18", phase: "前向散射探测", title: "引导长波雷达完成目标跟踪", description: "将粗航向数据注入宽波束警戒雷达建立连续航迹", impact: "打破隐身飞机静默突防优势" }
      ],
      narrative: "推演检验分布式收发分置雷达栅栏在反隐身概念中的立论可行性与工程边界。"
    }
  },
  {
    id: "scenario-draft-06",
    category: "scenario",
    promptId: "ai.generate.scenario",
    schema: "ScenarioDraft",
    name: "港口航道反水雷与护航防卫想定",
    description: "检验反水雷母船使用自主潜航器清障与舰艇出港护航全过程",
    input: {
      workflow: { title: "仿真想定", outputSchema: "ScenarioDraft" },
      analysis: {
        scenarioScope: "港口清障破阻",
        phaseAction: { phases: [{ name: "清障引航", timeWindow: "T+00:00-T+01:20" }] },
        forces: []
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["title", "summary", "entities", "timeline", "narrative"],
      minCounts: { entities: 2, timeline: 2 },
      keywords: ["friendly", "support"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      title: "要害港口出航航道反水雷护航想定",
      summary: "敌方在主要出海水道布设沉底智能声磁水雷，蓝方反水雷特战编组实施声学诱爆与无人灭雷，保障补给船队安全开拔。",
      entities: [
        { id: "ent-blue-mcm-ship", label: "蓝方多能反水雷支援母舰", role: "support", side: "friendly", position: [15, 15], platform: "远洋反水雷母舰", task: "下放无人潜航器与引航" },
        { id: "ent-blue-convoy", label: "蓝方战术物资护航运输群", role: "command", side: "friendly", position: [10, 10], platform: "综合补给集装箱船队", task: "跟随扫雷通道安全出港" }
      ],
      areas: [
        { id: "area-channel", label: "主要疏港深水航槽", type: "patrol", position: [25, 25], size: 80, geometryType: "corridor", points: [{ latitude: 0, longitude: 0, label: "航槽轴线" }] }
      ],
      timeline: [
        { time: "T+00:25", phase: "清障引航", title: "自主灭雷机器人就位切割", description: "对两枚可疑磁性引信沉底水雷实施就地炸毁", impact: "主航道障碍清空" },
        { time: "T+01:00", phase: "清障引航", title: "护航船队平稳通过危险水区", description: "在声呐浮标实时监控下船队进入深海大洋", impact: "战备物资按计划离港" }
      ],
      narrative: "展示无人灭雷系统在快速解除关键港口封锁时的低风险与高处置时效。"
    }
  },

  // 3.2 ai.generate.phase-action (4 条)
  {
    id: "scenario-phase-01",
    category: "scenario",
    promptId: "ai.generate.phase-action",
    schema: "PhaseActionConcept",
    name: "四阶段战役行动时序与转换条件",
    description: "经典隐蔽展开-电磁压制-穿透打击-撤出重整四阶段模型",
    input: {
      workflow: { title: "阶段行动", outputSchema: "PhaseActionConcept" },
      analysis: {
        brief: { objective: "多阶段联合突破", approach: "时序递进打击" }
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["summary", "phases", "transitions"],
      minCounts: { phases: 4, transitions: 3 },
      keywords: ["phase-1", "phase-2", "phase-3", "phase-4"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      summary: "将全过程划分为隐蔽机动、电磁压制、火力突击以及撤退重组四个时序严格衔接的作战阶段。",
      phases: [
        { id: "phase-1", name: "隐蔽机动展开", sequence: 1, timeWindow: "T+00:00至T+00:30", objective: "兵力悄然进抵发射阵位", blueActions: ["保持雷达无线电静默航行", "下放潜航侦察哨"], redActions: ["常规边境巡逻"], primaryActions: ["保持雷达无线电静默航行"], secondaryActions: ["常规边境巡逻"], entryConditions: ["上级交战预令下达"], exitConditions: ["各单元抵达待命阵位"], expectedEffects: ["零暴露完成部署"], forceIds: [] },
        { id: "phase-2", name: "电磁压制塑势", sequence: 2, timeWindow: "T+00:30至T+00:50", objective: "致盲敌预警探测网络", blueActions: ["发射大功率机载干扰", "布设雷达诱饵"], redActions: ["跳频抗干扰自卫"], primaryActions: ["发射大功率机载干扰"], secondaryActions: ["跳频抗干扰自卫"], entryConditions: ["阵位就绪信号确认"], exitConditions: ["敌雷达跟踪率降至门限以下"], expectedEffects: ["取得局部制电磁权"], forceIds: [] },
        { id: "phase-3", name: "联合火力突击", sequence: 3, timeWindow: "T+00:50至T+01:20", objective: "毁灭性打击要害枢纽", blueActions: ["多弹种协同齐射", "高超声速贯穿打击"], redActions: ["启动末端拦截系统"], primaryActions: ["多弹种协同齐射"], secondaryActions: ["启动末端拦截系统"], entryConditions: ["电磁走廊完全成型"], exitConditions: ["打击目标毁伤确认"], expectedEffects: ["敌指挥通信枢纽瘫痪"], forceIds: [] },
        { id: "phase-4", name: "战果评估与脱离", sequence: 4, timeWindow: "T+01:20至T+02:00", objective: "安全撤离并快速重整", blueActions: ["实施防空掩护航退", "卫星光学复核战果"], redActions: ["组织搜救与防区加固"], primaryActions: ["实施防空掩护航退"], secondaryActions: ["组织搜救与防区加固"], entryConditions: ["主突击弹药全部出膛"], exitConditions: ["脱离敌火力反击威胁圈"], expectedEffects: ["主力兵力零战损归建"], forceIds: [] }
      ],
      transitions: [
        { fromPhaseId: "phase-1", toPhaseId: "phase-2", condition: "全员阵位就绪率达100%", note: "T+00:30" },
        { fromPhaseId: "phase-2", toPhaseId: "phase-3", condition: "电磁压制窗口生效超过5分钟", note: "T+00:50" },
        { fromPhaseId: "phase-3", toPhaseId: "phase-4", condition: "末端弹头引爆信号回传", note: "T+01:20" }
      ],
      openQuestions: ["第二阶段电磁压制若遇对手新型反辐射对抗，是否允许延长压制时窗"],
      reviewChecklist: ["核对各阶段时间窗口总和与战役后勤保障持续力"]
    }
  },
  {
    id: "scenario-phase-02",
    category: "scenario",
    promptId: "ai.generate.phase-action",
    schema: "PhaseActionConcept",
    name: "早期预警-航迹确认-引导拦截-战果确认四阶段",
    description: "防空作战经典四阶段时序流",
    input: {
      workflow: { title: "阶段行动", outputSchema: "PhaseActionConcept" },
      analysis: {
        brief: { objective: "防空预警截击", approach: "四阶段闭环" }
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["summary", "phases", "transitions"],
      minCounts: { phases: 4, transitions: 3 },
      keywords: ["phase-1", "phase-2", "phase-3", "phase-4"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      summary: "从目标初显到战果判定的防空截击战术四阶段递进流转体系。",
      phases: [
        { id: "phase-1", name: "远程早期预警", sequence: 1, timeWindow: "T+00:00至T+00:05", objective: "捕获远距不明空中辐射", blueActions: ["超视距相控阵雷达搜索"], redActions: ["超低空突防接近"], primaryActions: ["超视距相控阵雷达搜索"], secondaryActions: ["超低空突防接近"], entryConditions: ["日常战备警戒"], exitConditions: ["确立异常目标航迹"], expectedEffects: ["获取初始航向矢量"], forceIds: [] },
        { id: "phase-2", name: "目标属性判别与建链", sequence: 2, timeWindow: "T+00:05至T+00:08", objective: "确认敌对属性并分配批号", blueActions: ["应答机二次质询", "红外光电比对"], redActions: ["释放电磁干扰涂层"], primaryActions: ["应答机二次质询"], secondaryActions: ["释放电磁干扰涂层"], entryConditions: ["目标进入雷达主波束"], exitConditions: ["判定为敌对攻击群"], expectedEffects: ["生成火控质量航迹"], forceIds: [] },
        { id: "phase-3", name: "引导发射与中继协同", sequence: 3, timeWindow: "T+00:08至T+00:15", objective: "发射拦截弹并实施空中制导", blueActions: ["垂直发射防空拦截弹", "指令修正"], redActions: ["大过载机动规避"], primaryActions: ["垂直发射防空拦截弹"], secondaryActions: ["大过载机动规避"], entryConditions: ["目标越过交战拦截线"], exitConditions: ["导引头进入自主捕获"], expectedEffects: ["进入截击杀伤区"], forceIds: [] },
        { id: "phase-4", name: "末端毁伤评估与解除", sequence: 4, timeWindow: "T+00:15至T+00:20", objective: "判定拦截结果并清空通道", blueActions: ["雷达回波消失检测", "通道释放"], redActions: ["被击落或脱离"], primaryActions: ["雷达回波消失检测"], secondaryActions: ["被击落或脱离"], entryConditions: ["弹目交汇时钟到达"], exitConditions: ["火控通道重新处于待命"], expectedEffects: ["保卫目标安全"], forceIds: [] }
      ],
      transitions: [
        { fromPhaseId: "phase-1", toPhaseId: "phase-2", condition: "目标回波连续3次稳定跟踪", note: "T+00:05" },
        { fromPhaseId: "phase-2", toPhaseId: "phase-3", condition: "交战规则授权吻合且在射程内", note: "T+00:08" },
        { fromPhaseId: "phase-3", toPhaseId: "phase-4", condition: "导弹引信引爆信号产生", note: "T+00:15" }
      ],
      openQuestions: ["多目标群进入时，第二阶段判型时延是否会导致第三阶段发射窗口被压缩"],
      reviewChecklist: ["检查各阶段交接条件是否具备严格可观察性"]
    }
  },
  {
    id: "scenario-phase-03",
    category: "scenario",
    promptId: "ai.generate.phase-action",
    schema: "PhaseActionConcept",
    name: "潜伏待机-诱敌深入-分割包围-合围打击四阶段",
    description: "机动伏击战役经典四阶段行动",
    input: {
      workflow: { title: "阶段行动", outputSchema: "PhaseActionConcept" },
      analysis: {
        brief: { objective: "诱敌伏击破网", approach: "口袋阵打法" }
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["summary", "phases", "transitions"],
      minCounts: { phases: 4, transitions: 3 },
      keywords: ["phase-1", "phase-2", "phase-3", "phase-4"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      summary: "从设伏伪装到决战聚歼的机动伏击四阶段作战时序构想。",
      phases: [
        { id: "phase-1", name: "阵位潜伏与伪装待机", sequence: 1, timeWindow: "T+00:00至T+01:00", objective: "设下袋形预设战场", blueActions: ["依托有利地形伪装待机", "保持无线电静默"], redActions: ["先遣侦察沿常规轴线推进"], primaryActions: ["依托有利地形伪装待机"], secondaryActions: ["先遣侦察沿常规轴线推进"], entryConditions: ["伏击阵位勘察完成"], exitConditions: ["各机动分队隐蔽就位"], expectedEffects: ["达成战役隐蔽突然性"], forceIds: [] },
        { id: "phase-2", name: "佯动牵制与诱敌深入", sequence: 2, timeWindow: "T+01:00至T+01:40", objective: "诱导敌主力进入预设袋形阵地", blueActions: ["诱饵梯队边打边撤", "释放虚假通信信号"], redActions: ["全速追击前突"], primaryActions: ["诱饵梯队边打边撤"], secondaryActions: ["全速追击前突"], entryConditions: ["敌先头部队出现"], exitConditions: ["敌主力完全越过袋口界线"], expectedEffects: ["敌阵型被拉长脱节"], forceIds: [] },
        { id: "phase-3", name: "两翼切断与分割包围", sequence: 3, timeWindow: "T+01:40至T+02:10", objective: "封闭退路并割裂敌指挥链", blueActions: ["两翼快速机动扎口", "布设电磁隔离墙"], redActions: ["仓促转向并呼叫支援"], primaryActions: ["两翼快速机动扎口"], secondaryActions: ["仓促转向并呼叫支援"], entryConditions: ["袋底接触信令触发"], exitConditions: ["后方退路彻底封闭"], expectedEffects: ["敌陷入腹背受敌困局"], forceIds: [] },
        { id: "phase-4", name: "多向聚歼与合围打击", sequence: 4, timeWindow: "T+02:10至T+03:00", objective: "集中优势火力歼灭被围之敌", blueActions: ["全域全火力集火压制", "精确穿刺指挥单元"], redActions: ["就地组织分散抵抗"], primaryActions: ["全域全火力集火压制"], secondaryActions: ["就地组织分散抵抗"], entryConditions: ["合围圈稳固建立"], exitConditions: ["敌有生力量溃散或投降"], expectedEffects: ["达成战役歼灭目标"], forceIds: [] }
      ],
      transitions: [
        { fromPhaseId: "phase-1", toPhaseId: "phase-2", condition: "观察哨报告敌主力出动", note: "T+01:00" },
        { fromPhaseId: "phase-2", toPhaseId: "phase-3", condition: "敌主力纵深过半达到预定标记", note: "T+01:40" },
        { fromPhaseId: "phase-3", toPhaseId: "phase-4", condition: "扎口部队完成正面阻击线部署", note: "T+02:10" }
      ],
      openQuestions: ["第二阶段佯退部队如果遭受过大压力，如何防止被敌真正冲垮"],
      reviewChecklist: ["审查各阶段转换节点两翼部队的机动时速与距离契合度"]
    }
  },
  {
    id: "scenario-phase-04",
    category: "scenario",
    promptId: "ai.generate.phase-action",
    schema: "PhaseActionConcept",
    name: "动态防御-抗饱和冲击-协同反击-阵位控制四阶段",
    description: "海空一体攻防反击四阶段战术构想",
    input: {
      workflow: { title: "阶段行动", outputSchema: "PhaseActionConcept" },
      analysis: {
        brief: { objective: "承受第一波冲击并实施反击", approach: "弹性抗损与转守为攻" }
      },
      evidence: []
    },
    expectedAssertions: {
      requiredFields: ["summary", "phases", "transitions"],
      minCounts: { phases: 4, transitions: 3 },
      keywords: ["phase-1", "phase-2", "phase-3", "phase-4"],
      negativeKeywords: ["经纬度"]
    },
    goldenReference: {
      summary: "展示以弹性抗损吸收敌第一波饱和突击后，立即发起协同火力反击的四阶段攻防构想。",
      phases: [
        { id: "phase-1", name: "警戒前出与动态抗击", sequence: 1, timeWindow: "T+00:00至T+00:20", objective: "削弱敌首波进攻锐气", blueActions: ["远距外层拦截", "主动电磁假目标欺骗"], redActions: ["首轮饱和导弹投送"], primaryActions: ["远距外层拦截"], secondaryActions: ["首轮饱和导弹投送"], entryConditions: ["警戒雷达告警生效"], exitConditions: ["首批来袭弹头大部分被拦截"], expectedEffects: ["消耗敌先锋弹药量"], forceIds: [] },
        { id: "phase-2", name: "抗饱和吸收与重构", sequence: 2, timeWindow: "T+00:20至T+00:40", objective: "承受局部战损并快速自愈", blueActions: ["受损通道快速旁路", "副指控节点平滑接管"], redActions: ["次波跟进穿透突击"], primaryActions: ["受损通道快速旁路"], secondaryActions: ["次波跟进穿透突击"], entryConditions: ["出现局部节点通信受损"], exitConditions: ["杀伤网拓扑自愈完成"], expectedEffects: ["核心指挥链路保持畅通"], forceIds: [] },
        { id: "phase-3", name: "协同反击火力齐射", sequence: 3, timeWindow: "T+00:40至T+01:10", objective: "捕捉敌发射阵位反击其核心", blueActions: ["多域传感器协同定位", "超视距高超声速反击"], redActions: ["转入阵地规避与防御"], primaryActions: ["多域传感器协同定位"], secondaryActions: ["转入阵地规避与防御"], entryConditions: ["敌首波发射机动暴露"], exitConditions: ["反击弹群全部进入终端制导"], expectedEffects: ["摧毁敌核心进攻兵力"], forceIds: [] },
        { id: "phase-4", name: "优势确立与阵位控制", sequence: 4, timeWindow: "T+01:10至T+01:40", objective: "牢固控制关键战术海空域", blueActions: ["前出战斗机巡逻制空", "封锁空海交战走廊"], redActions: ["残部向后方集结撤退"], primaryActions: ["前出战斗机巡逻制空"], secondaryActions: ["残部向后方集结撤退"], entryConditions: ["敌进攻波次彻底停止"], exitConditions: ["预定防区空域净空"], expectedEffects: ["彻底夺取战场主动权"], forceIds: [] }
      ],
      transitions: [
        { fromPhaseId: "phase-1", toPhaseId: "phase-2", condition: "敌首轮导弹突防进入近距近防阶段", note: "T+00:20" },
        { fromPhaseId: "phase-2", toPhaseId: "phase-3", condition: "反击火力通道重构完成并建立目标锁定", note: "T+00:40" },
        { fromPhaseId: "phase-3", toPhaseId: "phase-4", condition: "战果评估确认敌主力进攻能力受挫超过70%", note: "T+01:10" }
      ],
      openQuestions: ["第二阶段抗损吸收期间，若主备指挥节点同时受损是否有第三层备选预案"],
      reviewChecklist: ["确认反击火力发起时前沿探测网的时效刷新频率"]
    }
  }
];

// 执行生成并写入各目录
let count = 0;
for (const item of cases) {
  const dir = path.join(root, item.promptId);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${item.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(item, null, 2), "utf8");
  count++;
}

console.log(`Successfully generated ${count} golden test cases under eval/cases/!`);
