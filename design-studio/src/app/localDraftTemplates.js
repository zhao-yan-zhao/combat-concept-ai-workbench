/**
 * 本地标准模板起草入口 (T5.4)
 * 当 AI 服务不可用或研究人员选择手工起草时，为各步骤提供符合 DoDAF 规范的本地基准模板
 */

/**
 * 本地阶段与行动标准模板起草
 */
export function createLocalPhaseActionTemplate(brief = {}) {
  const objective = brief?.objective || "多域协同作战研究";
  return {
    summary: `基于研究目标「${objective}」构建的本地手工起草阶段与行动基准模板。`,
    phases: [
      {
        id: "phase-1",
        name: "前沿侦察与态势建立阶段",
        sequence: 1,
        timeWindow: "T+00:00 ~ T+00:30",
        objective: "完成战区前沿电磁与光学态势全面感知，查明敌防御节点部署",
        blueActions: ["运用多源侦察手段对预设空域实施连续监控", "建立战术数据链路并分发初始态势报文"],
        redActions: ["保持雷达静默或跳频反侦察", "组织前沿防空兵力警戒"],
        primaryActions: ["运用多源侦察手段对预设空域实施连续监控"],
        secondaryActions: ["建立战术数据链路并分发初始态势报文"],
        entryConditions: ["任务指令下达且前沿侦察力量进入阵位"],
        exitConditions: ["前沿目标定位完成且数据链通信建立"],
        expectedEffects: ["构建完整初始空情态势图"],
        forceIds: ["cf-local-sense"]
      },
      {
        id: "phase-2",
        name: "多域机动与电磁突防阶段",
        sequence: 2,
        timeWindow: "T+00:30 ~ T+01:15",
        objective: "对敌防空雷达网与通信链路实施强电磁压制，开辟安全突防走廊",
        blueActions: ["突防战术编队沿走廊向目标区实施多波次低空突进", "防区外电子战机实施大功率噪声与瞄准干扰"],
        redActions: ["启动多基站协同反辐射对抗", "实施干扰规避并指派截击机拦截"],
        primaryActions: ["防区外电子战机实施大功率噪声与瞄准干扰"],
        secondaryActions: ["突防战术编队沿走廊向目标区实施多波次低空突进"],
        entryConditions: ["阶段1态势建立完成"],
        exitConditions: ["突防走廊打通且压制效果显现"],
        expectedEffects: ["敌雷达网开机跟踪概率下降60%以上"],
        forceIds: ["cf-local-cmd", "cf-local-strike"]
      },
      {
        id: "phase-3",
        name: "协同突击与毁伤评估阶段",
        sequence: 3,
        timeWindow: "T+01:15 ~ T+02:00",
        objective: "实施多方向饱和火力突击，达成预定战术破击效果并评估战损",
        blueActions: ["发射精确制导武器对核心要害实施齐射打击", "侦察中继平台实施打击效果评估与二次补打引导"],
        redActions: ["组织近程末端防空火力全力拦截", "后方指挥所实施应急疏散转移"],
        primaryActions: ["发射精确制导武器对核心要害实施齐射打击"],
        secondaryActions: ["侦察中继平台实施打击效果评估与二次补打引导"],
        entryConditions: ["突防编队到达预设发射阵位"],
        exitConditions: ["完成打击并回收战果评估数据"],
        expectedEffects: ["敌核心防御节点瘫痪达成战术破击"],
        forceIds: ["cf-local-strike", "cf-local-supp"]
      }
    ],
    transitions: [
      { fromPhaseId: "phase-1", toPhaseId: "phase-2", condition: "前沿目标定位完成且突防走廊信道就绪", note: "阶段转换条件1" },
      { fromPhaseId: "phase-2", toPhaseId: "phase-3", condition: "敌雷达压制率超过阈值且突击编组进入发射阵位", note: "阶段转换条件2" }
    ],
    openQuestions: ["手工起草模板：请复核各阶段时间窗口配比与兵力协同衔接"],
    reviewChecklist: ["确认阶段名称与研究意图匹配", "确认红蓝双方行动具有闭环对抗性"],
    generation: {
      source: "manual-template",
      generatedAt: new Date().toISOString()
    }
  };
}

/**
 * 本地兵力与编成标准模板起草
 */
export function createLocalForceMissionTemplate(brief = {}) {
  const objective = brief?.objective || "作战兵力编成";
  return {
    summary: `针对「${objective}」构建的本地手工起草双层兵力编成基准模板。`,
    forces: [
      {
        id: "cf-local-sense",
        name: "空天多源感知单元",
        side: "friendly",
        role: "sense",
        group: "感知情报群",
        missionType: "recon",
        task: "持续截获敌辐射源信号与光电特征，形成高精度目标航迹",
        taskRefs: [],
        phaseIds: ["phase-1"],
        platforms: [{ domain: "aircraft", cmoId: 1001, name: "战术侦察机", country: "通用", category: "侦察机", quantity: 2 }],
        notes: "本地手工起草能力单元"
      },
      {
        id: "cf-local-cmd",
        name: "联合战术指控协调单元",
        side: "friendly",
        role: "command",
        group: "指挥控制群",
        missionType: "command",
        task: "汇聚空情态势，进行威胁评估与火力指派协同",
        taskRefs: [],
        phaseIds: ["phase-1", "phase-2"],
        platforms: [{ domain: "aircraft", cmoId: 1002, name: "预警指挥机", country: "通用", category: "预警机", quantity: 1 }],
        notes: "本地手工起草指挥中枢"
      },
      {
        id: "cf-local-strike",
        name: "多域远程突击打击单元",
        side: "friendly",
        role: "air",
        group: "突击火力群",
        missionType: "strike",
        task: "接收目标射击诸元，对敌重点防御要害实施多波次精确打击",
        taskRefs: [],
        phaseIds: ["phase-2", "phase-3"],
        platforms: [{ domain: "aircraft", cmoId: 1003, name: "多用途战机", country: "通用", category: "战斗轰炸机", quantity: 4 }],
        notes: "本地手工起草突击力量"
      },
      {
        id: "cf-local-supp",
        name: "综合通信与保障支援单元",
        side: "friendly",
        role: "support",
        group: "综合保障群",
        missionType: "support",
        task: "维持全域高速数据链路与战术燃油补给支持",
        taskRefs: [],
        phaseIds: ["phase-1", "phase-2", "phase-3"],
        platforms: [{ domain: "aircraft", cmoId: 1004, name: "空中加油机", country: "通用", category: "加油机", quantity: 2 }],
        notes: "本地手工起草保障力量"
      }
    ],
    combatForces: [
      {
        id: "cbf-local-sense-pack",
        name: "前沿侦察巡逻作战编队",
        side: "friendly",
        role: "sense",
        conceptForceId: "cf-local-sense",
        group: "空中梯队",
        missionType: "recon",
        task: "执行预设战区空域航线巡逻并实时分发空情数据",
        taskRefs: [],
        phaseIds: ["phase-1"],
        platforms: [{ domain: "aircraft", cmoId: 2001, name: "战术侦察机A型", country: "通用", category: "侦察机", quantity: 2 }],
        notes: "仿真作战编成执行包"
      },
      {
        id: "cbf-local-cmd-pack",
        name: "空中指挥所战术编组",
        side: "friendly",
        role: "command",
        conceptForceId: "cf-local-cmd",
        group: "空中梯队",
        missionType: "command",
        task: "在安全防区空域盘旋指控并下达战术打击批次",
        taskRefs: [],
        phaseIds: ["phase-1", "phase-2"],
        platforms: [{ domain: "aircraft", cmoId: 2002, name: "预警指挥机B型", country: "通用", category: "预警机", quantity: 1 }],
        notes: "仿真指控执行包"
      },
      {
        id: "cbf-local-strike-pack",
        name: "精确火力突击战机集群",
        side: "friendly",
        role: "air",
        conceptForceId: "cf-local-strike",
        group: "火力梯队",
        missionType: "strike",
        task: "挂载防区外远程对地对海武器实施饱和齐射",
        taskRefs: [],
        phaseIds: ["phase-2", "phase-3"],
        platforms: [{ domain: "aircraft", cmoId: 2003, name: "战术歼轰机C型", country: "通用", category: "战斗轰炸机", quantity: 4 }],
        notes: "仿真突击执行包"
      },
      {
        id: "cbf-local-supp-pack",
        name: "空中战术加油伴随分队",
        side: "friendly",
        role: "support",
        conceptForceId: "cf-local-supp",
        group: "保障梯队",
        missionType: "support",
        task: "定点待命并建立受油空域走廊",
        taskRefs: [],
        phaseIds: ["phase-1", "phase-2", "phase-3"],
        platforms: [{ domain: "aircraft", cmoId: 2004, name: "战术加油机D型", country: "通用", category: "加油机", quantity: 2 }],
        notes: "仿真保障执行包"
      }
    ],
    relations: [
      { fromForceId: "cf-local-sense", toForceId: "cf-local-cmd", type: "information", note: "态势信息实时上传" },
      { fromForceId: "cf-local-cmd", toForceId: "cf-local-strike", type: "command", note: "目标分配与射击授权" }
    ],
    openQuestions: ["手工起草模板：请根据实际兵力规模调整平台型号与数量配比"],
    reviewChecklist: ["核对概念兵力与仿真编成包关联", "确认平台类型与 CMO 兼容性"],
    generation: {
      source: "manual-template",
      generatedAt: new Date().toISOString()
    }
  };
}

/**
 * 本地 DoDAF OV-1 概念图五节点标准闭环模板
 */
export function createLocalConceptGraphicTemplate(brief = {}) {
  const mission = brief?.objective || "作战概念机理闭环";
  return {
    concept: {
      mission,
      objective: "通过感知、决策、控制、对抗与评估闭环完成概念机理推演",
      scope: "抽象网格战区范围",
      phase: "全作战阶段贯通",
      expectedEffects: "形成可观察、可量化的体系对抗闭环",
      constraints: "基于抽象相对网格与标准 DoDAF 元模型"
    },
    nodes: [
      { id: "sense", label: "广域空天感知网", detail: "多源侦察与态势汇聚", category: "感知", kind: "equipment" },
      { id: "decide", label: "联合指挥控制中枢", detail: "威胁定级与任务分发", category: "指挥", kind: "command" },
      { id: "control", label: "多域突击执行力量", detail: "战术机动与饱和破击", category: "行动", kind: "action" },
      { id: "opponent", label: "敌防御对抗节点", detail: "反辐射规避与防空截击", category: "外部", kind: "external" },
      { id: "assess", label: "战损与战果评估中继", detail: "二次引导与效能闭环", category: "评估", kind: "effect" }
    ],
    edges: [
      { id: "edge-1", sourceId: "sense", targetId: "decide", type: "信息流" },
      { id: "edge-2", sourceId: "decide", targetId: "control", type: "控制流" },
      { id: "edge-3", sourceId: "control", targetId: "opponent", type: "控制流" },
      { id: "edge-4", sourceId: "opponent", targetId: "assess", type: "态势变化" },
      { id: "edge-5", sourceId: "assess", targetId: "decide", type: "反馈" }
    ],
    narrative: "手工起草的标准 DoDAF OV-1 五节点机理图：由感知节点探测目标上报指挥中枢，指挥节点下发指令给突击力量，对敌方防御节点实施对抗破击，评估节点跟踪战损并反馈决策中枢形成闭环。",
    generation: {
      source: "manual-template",
      generatedAt: new Date().toISOString()
    }
  };
}

/**
 * 本地仿真推演想定标准模板起草
 */
export function createLocalScenarioTemplate(brief = {}) {
  const title = brief?.title || "战术推演想定";
  return {
    title: `${title}（本地手工起草草案）`,
    summary: "依据当前课题目标构建的本地三阶段推演想定基准模板。",
    entities: [
      { id: "blue-aew", label: "蓝方预警机", side: "friendly", role: "sense", platform: "预警机", task: "空域预警" },
      { id: "blue-fighter", label: "蓝方突击战机编组", side: "friendly", role: "air", platform: "多用途战机", task: "战术突击" },
      { id: "red-radar", label: "红方预警防空雷达站", side: "hostile", role: "opponent", platform: "对空雷达", task: "防空预警" },
      { id: "red-sam", label: "红方地空导弹阵地", side: "hostile", role: "opponent", platform: "地空导弹", task: "要地防空" }
    ],
    timeline: [
      { time: "T+00:00", title: "态势建立", description: "蓝方预警机在前沿空域展开巡逻，发现红方雷达脉冲信号" },
      { time: "T+00:20", title: "突防突击", description: "蓝方指挥所下达突防指令，突击机群进入反辐射武器发射阵位" },
      { time: "T+00:45", title: "效果达成", description: "蓝方实施齐射打击，红方雷达开机率显著下降，推演首阶段目标达成" }
    ],
    narrative: "本想定草案展示了从初始态势发现、指挥决策到战术齐射打击的完整过程。",
    generation: {
      source: "manual-template",
      generatedAt: new Date().toISOString()
    }
  };
}
