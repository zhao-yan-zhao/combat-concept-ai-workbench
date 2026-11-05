/**
 * DoDAF 2.02 / DM2 Operational Activity Decomposition Templates & Auto-Organization Engine.
 * Provides doctrinally rigorous military templates and auto-organization for OV-5a.
 */

import { normalizeDodafOv5, normalizeDodafOv5a } from "../../shared/dodaf/products.js";
import { syncOv5ActivityPair } from "../../shared/dodaf/ov5ActivitySync.js";

export const DO_DAF_OV5A_TEMPLATES = [
  {
    id: "f2t2ea",
    name: "F2T2EA 经典杀伤链范式",
    badge: "杀伤网/闭环",
    domain: "跨域/多维",
    description: "发现(Find) → 定位(Fix) → 跟踪(Track) → 瞄准(Target) → 交战(Engage) → 评估(Assess) 标准闭环",
    steps: [
      { code: "find", title: "广域目标多源搜索与发现", type: "态势感知", domain: "太空", autonomy: "HOTL", timingWindow: "5m", input: "侦察卫星过顶与雷达搜索指令", output: "可疑目标线索与初始粗略坐标", text: "利用天基侦察与高空预警手段，在指定责任区进行全维扫描，获取初始疑似目标线索。" },
      { code: "fix", title: "高精度火控级空间三维定位", type: "态势感知", domain: "空中", autonomy: "HOTL", timingWindow: "3m", input: "可疑目标线索", output: "高精度火控级空间坐标与误差椭圆", text: "出动前沿无人侦察机与电子截获单元，对目标实施多角度测向交会，形成火控级高精度坐标。" },
      { code: "track", title: "连续航迹多源滤波与动态跟踪", type: "态势感知", domain: "空中", autonomy: "HOTL", timingWindow: "持续", input: "火控级坐标序列", output: "连续稳定滤波航迹与机动判据", text: "保持传感器连续照射或交接，滤除杂波干扰，建立连续稳定的目标机动航迹。" },
      { code: "target", title: "火力分配与拦截通道最优化判定", type: "协同决策", domain: "综合", autonomy: "HITL", timingWindow: "2m", input: "目标稳定航迹与可用武器库状态", output: "交战授权指令与火力通道分配表", text: "战区指挥中心依据交战规则(ROE)进行人机协同判定，优选打击平台与弹药类型，完成通道分配。" },
      { code: "engage", title: "防区外分布式协同精准突击", type: "精确突击", domain: "空中", autonomy: "HOOTL", timingWindow: "4m", input: "交战授权与目标装订诸元", output: "弹药投放、导引中继与交战遥测", text: "突击单元在受控防区外发射精确制导弹药，通过数据链中继制导实施协同饱和突防打击。" },
      { code: "assess", title: "多源毁伤效果裁决与反哺评估", type: "效果评估", domain: "综合", autonomy: "HITL", timingWindow: "3m", input: "交战遥测、光学雷达毁伤图谱", output: "毁伤判定等级与重打补火建议", text: "回收前沿毁伤图谱与遥测数据，评估目标瘫痪程度，向感知与指挥节点反哺决策建议。" }
    ]
  },
  {
    id: "ooda",
    name: "OODA 循环决策与行动范式",
    badge: "决策闭环",
    domain: "指挥控制",
    description: "态势观察(Observe) → 认知研判(Orient) → 协同决策(Decide) → 敏捷行动(Act)",
    steps: [
      { code: "observe", title: "全频谱战场全维态势感知", type: "态势感知", domain: "综合", autonomy: "HOTL", timingWindow: "持续", input: "电磁频谱、光学图像、声学与雷达原始数据", output: "多源异构综合态势线索", text: "汇聚全域传感器感知输入，提取可复核的战场态势特征线索。" },
      { code: "orient", title: "威胁等级研判与作战意图认知", type: "认知评估", domain: "综合", autonomy: "HOTL", timingWindow: "3m", input: "综合态势线索与敌情历史数据", output: "威胁排序序列与意图判断结论", text: "结合战场上下文与战术特征，识别敌方编队意图，对主要威胁实施梯次排队。" },
      { code: "decide", title: "跨域联合行动方案共识判定", type: "协同决策", domain: "综合", autonomy: "HITL", timingWindow: "2m", input: "威胁排序与友邻可用资源", output: "指挥授权与任务协调行动包", text: "指挥员结合 AI 推荐方案，进行人机协同决策，下达协同行动指令包。" },
      { code: "act", title: "敏捷分布式编队协同实施行动", type: "协同行动", domain: "各域", autonomy: "HOOTL", timingWindow: "6m", input: "任务协调行动包", output: "行动达成反馈与局部态势演化", text: "各任务单元按协同时间窗口执行机动、压制或打击行动，实时回传执行状态。" }
    ]
  },
  {
    id: "ew_suppress",
    name: "全维电磁压制与软硬突防范式",
    badge: "电子战/走廊",
    domain: "电磁/空中",
    description: "侦搜识别 → 样式优选 → 分布式压制 → 走廊开辟 → 反辐射硬毁伤",
    steps: [
      { code: "recon", title: "敌防空雷达网信号侦搜与指纹匹配", type: "电子对抗", domain: "电磁", autonomy: "HOTL", timingWindow: "2m", input: "战区无线电电磁频谱", output: "雷达辐射源脉冲描述字(PDW)与威胁编目", text: "全频段高速截获雷达信号，比对威胁辐射源特征库，锁定敌预警制导雷达阵位。" },
      { code: "jam_plan", title: "干扰样式自适应匹配与载荷分配", type: "电子对抗", domain: "电磁", autonomy: "HOTL", timingWindow: "1m", input: "辐射源威胁编目", output: "瞄准式/密集杂波干扰波形配置参数", text: "依据雷达抗干扰体制，计算最佳压制比与欺骗干扰波形，向分布式干扰机群派发任务。" },
      { code: "corridor", title: "多机分布式协同噪声压制与走廊开辟", type: "电子对抗", domain: "电磁", autonomy: "HOOTL", timingWindow: "6m", input: "干扰配置参数", output: "动态低可探测突防安全走廊", text: "电子战机群在突防翼侧形成连续定向压制屏障，制造雷达盲区，掩护突击波次。" },
      { code: "hard_kill", title: "防区外反辐射高速导弹精确硬摧毁", type: "精确突击", domain: "空中", autonomy: "HOOTL", timingWindow: "4m", input: "雷达阵位精确定向坐标与走廊", output: "目标雷达天线硬毁伤与发射阵地瘫痪", text: "突击单元在安全走廊内发射反辐射精确打击武器，对开机的制导雷达实施物理摧毁。" },
      { code: "eval", title: "压制有效率评估与自适应波束重构", type: "效果评估", domain: "综合", autonomy: "HITL", timingWindow: "2m", input: "后向频谱反弹与附带侦察信号", output: "压制覆盖度判定与二次补充干扰指令", text: "监视敌方雷达是否重启或转入备用频点，动态调整干扰波束指向与功率分配。" }
    ]
  },
  {
    id: "air_defense",
    name: "联合防空反导协同拦截范式",
    badge: "防空反导",
    domain: "陆基/海基/空基",
    description: "远程预警 → 航迹解算 → 通道分配 → 双层拦截 → 补火裁决",
    steps: [
      { code: "early_warn", title: "多域联合远程预警与弹道初始解算", type: "态势感知", domain: "太空", autonomy: "HOTL", timingWindow: "1m", input: "天基红外与超视距雷达回波", output: "弹道/高超导弹初始轨迹与着陆落区预测", text: "天基早期预警红外传感器与远程相控阵雷达探测出高超或弹道目标，解算第一落区。" },
      { code: "channel_alloc", title: "拦截阵地威胁排队与发射通道分配", type: "协同决策", domain: "综合", autonomy: "HITL", timingWindow: "1m", input: "来袭目标航向、速度与防空火力扇区", output: "内外层拦截发射阵位与时间窗口表", text: "指挥系统自动化计算交战几何条件，按拦截成功率优选海基/陆基发射单元并分配合适通道。" },
      { code: "guidance", title: "火控制导多跳数据链连续中继引导", type: "控制协调", domain: "空中", autonomy: "HOOTL", timingWindow: "持续", input: "雷达跟踪数据", output: "拦截弹中继修正制导指令", text: "空中指挥机或无人机作为通信中继节点，确保拦截弹在末端开机前获取连续精准修正指令。" },
      { code: "intercept", title: "多层防空导弹动能撞击饱和交战", type: "精确突击", domain: "陆基", autonomy: "HOOTL", timingWindow: "2m", input: "中继引导指令与末制导雷达开机", output: "空中碰撞动能毁伤遥测与爆炸回波", text: "末端拦截弹启动主动导引头，采用直接动能撞击(KKV)方式摧毁来袭高价值目标。" },
      { code: "re_engage", title: "拦截战果确认与二次补火决策裁决", type: "效果评估", domain: "综合", autonomy: "HITL", timingWindow: "30s", input: "弹目交会遥测与红外羽烟消失判据", output: "拦截成功确认或紧急二次发射授权", text: "若首轮拦截脱靶或毁伤不彻底，立即触发备用拦截通道实施二次补火拦截。" }
    ]
  },
  {
    id: "swarm_strike",
    name: "无人自主蜂群协同作战范式",
    badge: "蜂群自主",
    domain: "空中/网络",
    description: "自组网编队 → 广域分布式搜索 → 共识分配 → 饱和攻击 → 自主重组",
    steps: [
      { code: "network", title: "蜂群空基动态自组网与编队重构", type: "网络通信", domain: "网络", autonomy: "HOOTL", timingWindow: "持续", input: "蜂群投放开伞状态与平台健康度", output: "去中心化低截获概率动态拓扑网", text: "蜂群投放后迅速建立机间战术自组网，自适应选举主导协同节点，完成密集编队。" },
      { code: "search", title: "分布式航路协同广域侦搜与态势汇聚", type: "态势感知", domain: "空中", autonomy: "HOOTL", timingWindow: "5m", input: "网格化搜索扇区", output: "离散目标融合定位与类型识别", text: "蜂群分散展开对指定空域或地面实施梳状搜索，多机角度交叉测向完成目标编目。" },
      { code: "consensus", title: "去中心化共识算法协同目标与阵位分配", type: "协同决策", domain: "综合", autonomy: "HOOTL", timingWindow: "30s", input: "离散目标编目与蜂群剩余能量/弹药", output: "各机协同饱和攻击剖面与授时表", text: "无需地面指挥链路介入，蜂群通过机间分布式算法自主协商分配攻击目标与攻击角度。" },
      { code: "saturation", title: "多角度多批次协同饱和突防精准撞击", type: "精确突击", domain: "空中", autonomy: "HOOTL", timingWindow: "2m", input: "攻击剖面与协同引信设定", output: "多点同步引爆毁伤完成", text: "蜂群各机沿不同包络同时俯冲攻击，压垮敌近防拦截通道，完成核心部位精确打击。" },
      { code: "regroup", title: "战果机载自主评估与余弹编队集结", type: "效果评估", domain: "空中", autonomy: "HOOTL", timingWindow: "2m", input: "后继机载光电图像与冲击波感测", output: "战果评定简报与撤退/再寻航线", text: "巡飞观测机回传打击效果数据，剩余蜂群单元重新聚拢转入下一任务巡航。" }
    ]
  },
  {
    id: "sensor_fusion",
    name: "异构传感器态势融合范式",
    badge: "态势感知",
    domain: "网络/综合",
    description: "多基搜索 → 时空对准 → 特征提取 → 态势编目 → 共享分发",
    steps: [
      { code: "multisite", title: "陆海空天多基传感协同搜索覆盖", type: "态势感知", domain: "空中", autonomy: "HOTL", timingWindow: "持续", input: "协同探测调度指令", output: "异构原始回波与传感器点迹流", text: "统一调度相控阵雷达、光电吊舱与红外探测载荷，对重点扇区实施联合补盲探测。" },
      { code: "align", title: "多源异构传感器时空精准对准与关联", type: "态势感知", domain: "网络", autonomy: "HOTL", timingWindow: "1s", input: "异构点迹流与高精度时钟基准", output: "空间基准统一的高质量点迹序列", text: "消除各平台导航时钟漂移与安装偏角误差，实现点迹级时空归一化关联。" },
      { code: "fuse", title: "多传感器航迹融合与多维特征辨识", type: "认知评估", domain: "综合", autonomy: "HOTL", timingWindow: "2s", input: "高质量点迹序列与电磁辐射特征", output: "单一整合战术航迹(SITT)与属性识别", text: "结合多目标跟踪滤波与神经网络模型，提取目标 RCS、辐射特征与威胁属性编目。" },
      { code: "distribute", title: "战区公共作战态势图(COP)实时发布", type: "控制协调", domain: "网络", autonomy: "HOTL", timingWindow: "1s", input: "单一整合战术航迹与编目库", output: "全域订阅分发之联合战术态势图", text: "按安全级别与带宽条件，向防空、突击与指挥节点实时分发高可靠态势。" }
    ]
  }
];

export function getOv5aTemplates() {
  return DO_DAF_OV5A_TEMPLATES;
}

/**
 * Apply a template to decompose a specific parent activity.
 * Supports both:
 *   applyTemplateToActivity({ ov5, ov5a, parentActivityId, templateId })
 *   applyTemplateToActivity(parentActivity, templateId, currentOv5, currentOv5a)
 */
export function applyTemplateToActivity(arg1, arg2, arg3, arg4) {
  let parentActivity = arg1;
  let templateId = arg2;
  let currentOv5 = arg3;
  let currentOv5a = arg4;

  if (typeof arg1 === "object" && arg1 !== null && ("ov5" in arg1 || "parentActivityId" in arg1)) {
    templateId = arg1.templateId;
    currentOv5 = arg1.ov5;
    currentOv5a = arg1.ov5a;
    const pId = arg1.parentActivityId || (arg1.parentActivity && arg1.parentActivity.id);
    parentActivity = (currentOv5?.activities || []).find((a) => String(a.id) === String(pId)) || arg1.parentActivity || { id: pId, title: "作战活动" };
  }

  const template = DO_DAF_OV5A_TEMPLATES.find((t) => t.id === templateId) || DO_DAF_OV5A_TEMPLATES[0];
  const ov5 = normalizeDodafOv5(currentOv5);
  const ov5a = normalizeDodafOv5a(currentOv5a);

  const parentId = String(parentActivity.id);
  const parentTitle = parentActivity.title || "作战活动";
  const parentPerformer = parentActivity.performer || parentActivity.resources || "作战单元";
  const parentDomain = parentActivity.domain || "综合";

  const newActivities = template.steps.map((step, index) => {
    const actId = `act-${parentId.replace(/^ov5-|^act-/, "")}-${step.code}-${index + 1}`;
    return {
      id: actId,
      title: step.title,
      type: step.type,
      domain: step.domain === "综合" ? parentDomain : step.domain,
      autonomy: step.autonomy || "HOTL",
      performer: parentPerformer,
      timingWindow: step.timingWindow,
      input: step.input,
      output: step.output,
      parentId,
      text: `${step.text}（上级归属：「${parentTitle}」）`,
      refs: [],
      sourceOv1NodeIds: parentActivity.sourceOv1NodeIds || [],
      sourceTaskId: parentActivity.sourceTaskId || ""
    };
  });

  const existingMap = new Map(ov5.activities.map((a) => [String(a.id), a]));
  newActivities.forEach((act) => existingMap.set(act.id, act));
  const mergedOv5 = normalizeDodafOv5({
    ...ov5,
    activities: [...existingMap.values()]
  });

  const newDecompositions = newActivities.map((act) => ({
    parentActivityRef: parentId,
    childActivityRef: act.id,
    rationale: `依据「${template.name}」对「${parentTitle}」实施纵向活动分解`,
    status: "confirmed",
    confirmedAt: new Date().toISOString()
  }));

  const existingDecMap = new Map((ov5a.decompositions || []).map((d) => [`${d.parentActivityRef}:${d.childActivityRef}`, d]));
  newDecompositions.forEach((d) => existingDecMap.set(`${d.parentActivityRef}:${d.childActivityRef}`, d));

  const mergedOv5a = normalizeDodafOv5a({
    ...ov5a,
    decompositions: [...existingDecMap.values()]
  });

  const pair = syncOv5ActivityPair({ ov5: mergedOv5, ov5a: mergedOv5a, source: "ov5a" });
  return {
    nextOv5: pair.ov5,
    nextOv5a: pair.ov5a,
    addedActivities: newActivities,
    template
  };
}

/**
 * Apply a template globally as root-level operational activity structure.
 * Supports both:
 *   applyGlobalTemplate({ ov5, ov5a, templateId })
 *   applyGlobalTemplate(templateId, currentOv5, currentOv5a)
 */
export function applyGlobalTemplate(arg1, arg2, arg3) {
  let templateId = arg1;
  let currentOv5 = arg2;
  let currentOv5a = arg3;

  if (typeof arg1 === "object" && arg1 !== null) {
    templateId = arg1.templateId;
    currentOv5 = arg1.ov5;
    currentOv5a = arg1.ov5a;
  }

  const template = DO_DAF_OV5A_TEMPLATES.find((t) => t.id === templateId) || DO_DAF_OV5A_TEMPLATES[0];
  const rootId = `act-root-${template.id}`;
  const rootActivity = {
    id: rootId,
    title: `${template.name.replace(/范式$/, "")}总体协同`,
    type: "指挥协调",
    domain: "综合",
    autonomy: "HITL",
    performer: "联合指控中心",
    timingWindow: "全程",
    input: "联合作战意图与任务目标",
    output: "全维协同行动控制闭环",
    parentId: "",
    text: `依据「${template.name}」建立的总体作战协同根活动。`
  };

  const stepActivities = template.steps.map((step, index) => {
    const actId = `act-${template.id}-${step.code}-${index + 1}`;
    return {
      id: actId,
      title: step.title,
      type: step.type,
      domain: step.domain,
      autonomy: step.autonomy,
      performer: step.domain === "空中" ? "空中突击编队" : step.domain === "太空" ? "天基侦察星座" : step.domain === "电磁" ? "电子战机群" : "联合指挥单元",
      timingWindow: step.timingWindow,
      input: step.input,
      output: step.output,
      parentId: rootId,
      text: step.text
    };
  });

  const nextActivities = [rootActivity, ...stepActivities];
  const decompositions = stepActivities.map((act) => ({
    parentActivityRef: rootId,
    childActivityRef: act.id,
    rationale: `范式模板分解：${template.name}`,
    status: "confirmed",
    confirmedAt: new Date().toISOString()
  }));

  const ov5 = normalizeDodafOv5({ activities: nextActivities, edges: [] });
  const ov5a = normalizeDodafOv5a({ decompositions });
  const pair = syncOv5ActivityPair({ ov5, ov5a, source: "ov5a" });

  return {
    nextOv5: pair.ov5,
    nextOv5a: pair.ov5a,
    addedActivities: nextActivities,
    template
  };
}

/**
 * Deterministically generate local AI-fallback sub-activities for an individual activity.
 * Supports both:
 *   generateLocalDecomposition({ ov5, ov5a, targetActivityId, aiResponseSteps })
 *   generateLocalDecomposition(parentActivity)
 */
export function generateLocalDecomposition(arg1, arg2) {
  let parentActivity = arg1;
  let isWorkbenchCall = false;
  let currentOv5 = null;
  let currentOv5a = null;
  let aiSteps = null;

  if (typeof arg1 === "object" && arg1 !== null && ("ov5" in arg1 || "targetActivityId" in arg1)) {
    isWorkbenchCall = true;
    currentOv5 = arg1.ov5;
    currentOv5a = arg1.ov5a;
    aiSteps = arg1.aiResponseSteps;
    const tId = arg1.targetActivityId;
    parentActivity = (currentOv5?.activities || []).find((a) => String(a.id) === String(tId)) || { id: tId, title: "作战活动" };
  }

  const pId = String(parentActivity.id || "act-unknown");
  const pTitle = parentActivity.title || "作战活动";
  const pType = String(parentActivity.type || "");
  const pDomain = parentActivity.domain || "综合";
  const pPerformer = parentActivity.performer || parentActivity.resources || "指定责任部队";

  let generatedSteps = [];
  if (Array.isArray(aiSteps) && aiSteps.length > 0) {
    generatedSteps = aiSteps.map((step, idx) => ({
      id: step.id ? String(step.id) : `act-${pId.replace(/^ov5-|^act-/, "")}-sub-${idx + 1}`,
      title: step.title || `子活动 ${idx + 1}`,
      type: step.type || "作战活动",
      domain: step.domain || pDomain,
      autonomy: step.autonomy || "HOTL",
      performer: step.performer || pPerformer,
      timingWindow: step.timingWindow || "5m",
      input: step.input || "任务前置信号",
      output: step.output || "执行结果契约",
      parentId: pId,
      text: step.text || `归属于「${pTitle}」的纵向细化动作`
    }));
  } else {
    let subSpecs = [];
    if (pType.includes("感知") || pType.includes("侦察") || pTitle.includes("探测") || pTitle.includes("搜索")) {
      subSpecs = [
        { code: "search", title: `${pTitle}之分布式目标扫测`, type: "态势感知", domain: pDomain, autonomy: "HOTL", timing: "5m", in: "任务空域指令", out: "初始侦察点迹", text: "由前沿传感器对指定空域实施扇区扫描。" },
        { code: "identify", title: `${pTitle}之多源航迹时空对准辨识`, type: "态势感知", domain: "综合", autonomy: "HOTL", timing: "2m", in: "初始侦察点迹", out: "火控级确认目标航迹", text: "进行多机交会测向与杂波滤波，输出稳定目标识别包。" },
        { code: "track", title: `${pTitle}之连续火控跟踪闭环`, type: "态势感知", domain: pDomain, autonomy: "HOTL", timing: "持续", in: "火控航迹", out: "稳定照射数据", text: "保持传感器交接，锁定目标航迹。" }
      ];
    } else if (pType.includes("决策") || pType.includes("指挥") || pTitle.includes("判定") || pTitle.includes("控制")) {
      subSpecs = [
        { code: "assess", title: `${pTitle}之威胁态势动态分级排队`, type: "认知评估", domain: "综合", autonomy: "HITL", timing: "2m", in: "融合态势图", out: "威胁优先级序列表", text: "对当前进入拦截范围的目标进行威胁度评估。" },
        { code: "plan", title: `${pTitle}之多方案协同博弈推演`, type: "协同决策", domain: "综合", autonomy: "HITL", timing: "3m", in: "威胁序列表", out: "优选交战行动方案", text: "结合多约束条件评估火力分配效益。" },
        { code: "assign", title: `${pTitle}之交战协同授权与通道分配`, type: "协同决策", domain: "综合", autonomy: "HITL", timing: "2m", in: "优选行动方案", out: "通道分配与打击授权指令", text: "下达交战指令，明确各突击单元交战窗口与协同边界。" }
      ];
    } else if (pType.includes("行动") || pType.includes("突击") || pTitle.includes("打击") || pTitle.includes("交战")) {
      subSpecs = [
        { code: "maneuver", title: `${pTitle}之突防航路自适应规划`, type: "精确突击", domain: pDomain, autonomy: "HOOTL", timing: "3m", in: "目标坐标与威胁区分布", out: "低风险安全突防航线", text: "动态避开敌防空火力重叠区，建立突防走廊。" },
        { code: "deliver", title: `${pTitle}之协同防区外精确火力投放`, type: "精确突击", domain: pDomain, autonomy: "HOOTL", timing: "2m", in: "安全航线与目标诸元", out: "弹药投放完成与遥测回传", text: "多平台按既定授时窗口同时投放高精度制导武器。" },
        { code: "terminal", title: `${pTitle}之末端制导协同中继修正`, type: "精确突击", domain: pDomain, autonomy: "HOOTL", timing: "1m", in: "弹目相对角偏差", out: "直接动能毁伤碰撞", text: "通过数据链末段高频更新目标坐标，确保毁伤精度。" }
      ];
    } else {
      subSpecs = [
        { code: "prep", title: `${pTitle}之条件核验与前置准备`, type: "协调控制", domain: pDomain, autonomy: "HOTL", timing: "3m", in: "任务前置条件", out: "就绪信号", text: "核查通信链路与装备就绪状态。" },
        { code: "exec", title: `${pTitle}之核心任务分步协同执行`, type: "受约束行动", domain: pDomain, autonomy: "HOOTL", timing: "6m", in: "就绪信号与协同指令", out: "执行结果与状态回传", text: "执行核心战术活动，确保闭环达成。" },
        { code: "eval", title: `${pTitle}之效果裁决与状态闭环`, type: "效果评估", domain: "综合", autonomy: "HITL", timing: "2m", in: "执行结果", out: "阶段达成报告", text: "确认本活动完成度与后道交接。" }
      ];
    }

    generatedSteps = subSpecs.map((spec, i) => ({
      id: `act-${pId.replace(/^ov5-|^act-/, "")}-${spec.code}-${i + 1}`,
      title: spec.title,
      type: spec.type,
      domain: spec.domain,
      autonomy: spec.autonomy,
      performer: pPerformer,
      timingWindow: spec.timing,
      input: spec.in,
      output: spec.out,
      parentId: pId,
      text: spec.text,
      refs: [],
      sourceOv1NodeIds: parentActivity.sourceOv1NodeIds || [],
      sourceTaskId: parentActivity.sourceTaskId || ""
    }));
  }

  if (!isWorkbenchCall) {
    return generatedSteps;
  }

  const existingActivities = currentOv5?.activities || [];
  const existingMap = new Map(existingActivities.map((a) => [String(a.id), a]));
  generatedSteps.forEach((act) => existingMap.set(act.id, act));
  const mergedOv5 = normalizeDodafOv5({
    ...currentOv5,
    activities: [...existingMap.values()]
  });

  const newDecompositions = generatedSteps.map((act) => ({
    parentActivityRef: pId,
    childActivityRef: act.id,
    rationale: `纵向活动细化分解：归属于「${pTitle}」`,
    status: "confirmed",
    confirmedAt: new Date().toISOString()
  }));

  const existingDecMap = new Map(((currentOv5a?.decompositions) || []).map((d) => [`${d.parentActivityRef}:${d.childActivityRef}`, d]));
  newDecompositions.forEach((d) => existingDecMap.set(`${d.parentActivityRef}:${d.childActivityRef}`, d));

  const mergedOv5a = normalizeDodafOv5a({
    ...currentOv5a,
    decompositions: [...existingDecMap.values()]
  });

  const pair = syncOv5ActivityPair({ ov5: mergedOv5, ov5a: mergedOv5a, source: "ov5a" });
  return {
    nextOv5: pair.ov5,
    nextOv5a: pair.ov5a,
    addedActivities: generatedSteps
  };
}

/**
 * Auto-organize and repair OV-5a hierarchy:
 * 1. Cleans orphan parent references (where parent activity no longer exists).
 * 2. Cleans self-loops and circular dependencies.
 * 3. If hierarchy is completely flat (0 decompositions) and has 4+ activities,
 *    intelligently suggests an initial 2-tier tree based on functional roles.
 */
export function autoOrganizeOv5aHierarchy(arg1, arg2) {
  let currentOv5 = arg1;
  let currentOv5a = arg2;

  if (typeof arg1 === "object" && arg1 !== null && "ov5" in arg1) {
    currentOv5 = arg1.ov5;
    currentOv5a = arg1.ov5a;
  }

  const ov5 = normalizeDodafOv5(currentOv5 || { activities: [], edges: [] });
  const ov5a = normalizeDodafOv5a(currentOv5a || { decompositions: [] });
  const activities = ov5.activities || [];
  const activityIds = new Set(activities.map((a) => String(a.id)));

  let repairedCount = 0;
  // 1. Remove broken decompositions
  const cleanDecompositions = (ov5a.decompositions || []).filter((d) => {
    const valid = activityIds.has(d.parentActivityRef) && activityIds.has(d.childActivityRef) && d.parentActivityRef !== d.childActivityRef;
    if (!valid) repairedCount += 1;
    return valid;
  });

  // 2. If completely flat (no decompositions) and 4+ activities, create a logical 2-tier tree
  let autoStructured = false;
  if (cleanDecompositions.length === 0 && activities.length >= 4) {
    const rootAct = activities.find((a) => {
      const t = String(a.type || "");
      const title = String(a.title || "");
      return t.includes("指挥") || t.includes("协调") || title.includes("联合") || title.includes("总体");
    }) || activities[0];

    activities.forEach((act) => {
      if (act.id !== rootAct.id && !act.parentId) {
        cleanDecompositions.push({
          parentActivityRef: String(rootAct.id),
          childActivityRef: String(act.id),
          rationale: `自动层级规整：归属至「${rootAct.title}」协同管辖`,
          status: "pending_review",
          confirmedAt: new Date().toISOString()
        });
      }
    });
    autoStructured = true;
  }

  const nextOv5a = normalizeDodafOv5a({
    ...ov5a,
    decompositions: cleanDecompositions
  });

  const pair = syncOv5ActivityPair({ ov5, ov5a: nextOv5a, source: "ov5a" });
  return {
    nextOv5: pair.ov5,
    nextOv5a: pair.ov5a,
    repairedCount,
    autoStructured,
    totalDecompositions: cleanDecompositions.length
  };
}

/**
 * Evaluates Input/Output coverage and contract conservation for OV-5a decomposition.
 * Checks whether parent activity input/output are properly inherited and closed across child activities.
 */
export function evaluateOv5aDecompositionIoCoverage(activities = [], decompositions = []) {
  const actById = new Map((activities || []).map((a) => [String(a.id), a]));
  const childrenByParent = new Map();
  (decompositions || []).forEach((d) => {
    if (!childrenByParent.has(d.parentActivityRef)) childrenByParent.set(d.parentActivityRef, []);
    childrenByParent.get(d.parentActivityRef).push(d.childActivityRef);
  });

  const issues = [];
  const statusMap = new Map();

  let parentCount = 0;
  let cleanCount = 0;

  childrenByParent.forEach((childIds, parentId) => {
    const parentAct = actById.get(parentId);
    if (!parentAct) return;
    parentCount += 1;
    const children = childIds.map((id) => actById.get(id)).filter(Boolean);
    if (!children.length) return;

    let hasInputWarning = false;
    let hasOutputWarning = false;

    // Check parent input coverage
    if (parentAct.input && parentAct.input.trim()) {
      const anyChildHasInput = children.some((c) => c.input && c.input.trim());
      if (!anyChildHasInput) {
        hasInputWarning = true;
        issues.push({
          state: "warning",
          statusLabel: "输入未承接",
          label: `「${parentAct.title}」输入契约未被下级子活动承接`,
          detail: `父活动声明了输入「${parentAct.input}」，但其 ${children.length} 个子活动均未声明输入触发条件。`
        });
      }
    }

    // Check parent output coverage
    if (parentAct.output && parentAct.output.trim()) {
      const anyChildHasOutput = children.some((c) => c.output && c.output.trim());
      if (!anyChildHasOutput) {
        hasOutputWarning = true;
        issues.push({
          state: "warning",
          statusLabel: "产出未交付",
          label: `「${parentAct.title}」产出契约未被下级子活动交付`,
          detail: `父活动声明了交付物「${parentAct.output}」，但其 ${children.length} 个子活动均未声明产出物交付契约。`
        });
      }
    }

    if (hasInputWarning || hasOutputWarning) {
      statusMap.set(parentId, {
        status: "warning",
        message: hasInputWarning && hasOutputWarning ? "I/O 契约未闭环" : hasInputWarning ? "输入契约未承接" : "产出契约未交付"
      });
    } else {
      cleanCount += 1;
      statusMap.set(parentId, {
        status: "clean",
        message: "I/O 守恒闭环"
      });
    }
  });

  const ioHealthScore = parentCount === 0 ? 100 : Math.round((cleanCount / parentCount) * 100);

  return {
    issues,
    statusMap,
    stats: {
      parentCount,
      cleanCount,
      warningCount: parentCount - cleanCount,
      ioHealthScore
    }
  };
}

/**
 * Builds structured WBS text export in CSV or Markdown table format.
 */
export function exportOv5aWbsText(activities = [], decompositions = [], format = "csv") {
  const parentByChild = new Map((decompositions || []).map((d) => [d.childActivityRef, d.parentActivityRef]));
  const childrenByParent = new Map();

  (activities || []).forEach((act) => {
    const p = parentByChild.get(String(act.id)) || "__root__";
    if (!childrenByParent.has(p)) childrenByParent.set(p, []);
    childrenByParent.get(p).push(act);
  });

  const roots = childrenByParent.get("__root__") || [];

  const rows = [];
  function traverse(act, code) {
    rows.push({
      code,
      title: act.title || act.id,
      domain: act.domain || "综合",
      autonomy: act.autonomy || "HOTL",
      performer: act.performer || act.resources || "",
      timing: act.timingWindow || "",
      input: act.input || "",
      output: act.output || "",
      text: act.text || ""
    });
    const children = childrenByParent.get(String(act.id)) || [];
    children.forEach((child, idx) => {
      traverse(child, `${code}.${idx + 1}`);
    });
  }

  roots.forEach((root, idx) => {
    traverse(root, `${idx + 1}.0`);
  });

  if (format === "csv") {
    const headers = ["WBS编码", "作战活动名称", "作战域", "自主度分级", "执行主体/装备", "时效窗口", "输入数据/触发契约", "产出数据/交付契约", "活动战术机理说明"];
    const csvLines = [headers.join(",")];
    rows.forEach((r) => {
      const escapeCsv = (val) => `"${String(val || "").replace(/"/g, '""')}"`;
      csvLines.push([
        escapeCsv(r.code),
        escapeCsv(r.title),
        escapeCsv(r.domain),
        escapeCsv(r.autonomy),
        escapeCsv(r.performer),
        escapeCsv(r.timing),
        escapeCsv(r.input),
        escapeCsv(r.output),
        escapeCsv(r.text)
      ].join(","));
    });
    return "\uFEFF" + csvLines.join("\r\n");
  }

  const mdHeaders = "| WBS编码 | 作战活动名称 | 作战域 | 自主度 | 执行主体 | 时效 | 输入契约 | 产出交付 |";
  const mdDivider = "| :--- | :--- | :---: | :---: | :--- | :--- | :--- | :--- |";
  const mdLines = rows.map((r) => `| ${r.code} | **${r.title}** | ${r.domain} | ${r.autonomy} | ${r.performer || "-"} | ${r.timing || "-"} | ${r.input || "-"} | ${r.output || "-"} |`);
  return [mdHeaders, mdDivider, ...mdLines].join("\n");
}
