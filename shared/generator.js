import { promptTemplates } from "./data.js";
import { buildDefaultForceRelations, createPhaseActionConceptFromBrief } from "./conceptPlanning.js";
import { inferOv4RelationCategory } from "./dodaf/ov4Taxonomy.js";

const nextSteps = [
  "由专家修订关键假设。",
  "将修订内容反馈给当前工作流再次生成。",
  "把成熟方案移交图文成果工作流。"
];

export function generateOutput(workflow, analysis, evidence) {
  const template = getTemplateForWorkflow(workflow.id);
  return generateMockOutput({
    workflow,
    analysis,
    evidence,
    template
  });
}

export function generateMockOutput({ workflow, analysis, evidence, template = getTemplateForWorkflow(workflow.id) }) {
  const evidenceRefs = buildEvidenceRefs(evidence);
  const outputSchema = workflow.outputSchema || (workflow.id === "wargame" ? "WargameReview" : template.outputSchema);
  const result = createResultBySchema(outputSchema, workflow, analysis, evidenceRefs);
  const evaluation = createEvaluation(workflow, analysis, evidenceRefs, result, outputSchema);
  const mapInput = createMapInput(analysis, evaluation);

  return {
    id: `${workflow.id}-${Date.now()}`,
    workflowId: workflow.id,
    workflowTitle: workflow.title,
    templateId: template.id,
    templateName: template.name,
    outputSchema,
    prompt: fillPromptTemplate({ ...template, outputSchema }, {
      scenario: formatAnalysis(analysis),
      knowledge: formatEvidence(evidenceRefs),
      style: "稳控塑势",
      outputFormat: "结构化 JSON，可转换为 Markdown 和 HTML"
    }),
    result,
    evidenceRefs,
    evaluation,
    mapInput,
    nextSteps,
    markdown: toMarkdown({
      workflow,
      template,
      outputSchema,
      result,
      evidenceRefs,
      evaluation,
      mapInput
    })
  };
}

export function getTemplateForWorkflow(workflowId) {
  return promptTemplates.find((template) => template.workflowId === workflowId)
    ?? promptTemplates.find((template) => template.workflowId === "concept");
}

export function fillPromptTemplate(template, variables) {
  return {
    systemPrompt: fillTemplateText(template.systemPrompt, variables),
    userPrompt: fillTemplateText(template.userPrompt, variables),
    outputSchema: template.outputSchema
  };
}

export async function generateWithModel(input, template) {
  return generateMockOutput({
    workflow: input.workflow,
    analysis: input.analysis,
    evidence: input.evidence,
    template
  });
}

function createResultBySchema(schema, workflow, analysis, evidenceRefs) {
  if (schema === "CombatFocusOptions") {
    return createCombatFocusOptionsResult(analysis);
  }
  if (schema === "ForceMissionPlan") {
    return createForceMissionPlanResult(analysis);
  }
  if (schema === "OrganizationRelationshipDraft") {
    return createOrganizationRelationshipDraftResult(analysis);
  }
  if (schema === "OperationalTaskDraft") {
    return createOperationalTaskDraftResult(analysis);
  }
  if (schema === "TaskOrganizationDraft") {
    return createTaskOrganizationDraftResult(analysis);
  }
  if (schema === "PhaseActionConcept") {
    return createPhaseActionConceptResult(analysis);
  }
  if (schema === "RuleLibraryDraft") {
    return createRuleLibraryDraftResult(analysis);
  }
  if (schema === "RuleLibraryChangeSet") {
    return createRuleLibraryChangeSetResult(analysis);
  }
  if (schema === "StateMachineDraft") {
    return createStateMachineDraftResult(analysis);
  }
  if (schema === "SequenceDraft") {
    return createSequenceDraftResult(analysis);
  }
  if (schema === "ConceptGraphicPlan") {
    return createConceptGraphicPlanResult(analysis);
  }
  if (schema === "ConceptMapInitialPlan") {
    return createConceptMapInitialPlan(analysis);
  }
  if (schema === "ConceptPlan") {
    return createConceptPlan(analysis, evidenceRefs);
  }
  if (schema === "OperationalConceptGraphic") {
    return createOperationalConceptGraphic(analysis);
  }
  if (schema === "PlanVariant[]") {
    return createPlanVariants(analysis, evidenceRefs);
  }
  if (schema === "WargameReview") {
    return createWargameReview(analysis, evidenceRefs);
  }
  return createWorkflowBrief(workflow, analysis, evidenceRefs);
}

function createCombatFocusOptionsResult(analysis) {
  const objective = valueOf(analysis, "任务目标") || valueOf(analysis, "研究意图") || "作战概念研究";
  const approach = valueOf(analysis, "核心思路") || "体系协同";
  const effects = valueOf(analysis, "预期效果") || "形成有利态势";
  const risk = valueOf(analysis, "主要风险") || "对手反制";
  return {
    options: [
      {
        id: "focus-control",
        title: "联合封控塑势",
        text: `围绕“${objective}”，优先建立持续态势优势与通道控制，以${approach}压缩对手行动自由。`
      },
      {
        id: "focus-disrupt",
        title: "体系破击压制",
        text: `围绕“${objective}”，优先打击对手关键感知/指挥环节，创造转入主行动的窗口；关注风险：${risk}。`
      },
      {
        id: "focus-seize",
        title: "窗口突击巩固",
        text: `围绕“${objective}”，在有利窗口集中力量实施主方向突击，并尽快巩固阶段效果以达成：${effects}。`
      }
    ]
  };
}

function createOrganizationRelationshipDraftResult(analysis) {
  const forces = Array.isArray(analysis?.forces) ? analysis.forces : [];
  const combatForces = Array.isArray(analysis?.combatForces) ? analysis.combatForces : [];
  const skeleton = buildDefaultForceRelations(forces, combatForces);
  const chained = [];
  const units = [...forces, ...combatForces].filter((force) => force?.id);
  ["friendly", "hostile"].forEach((side) => {
    const group = units.filter((force) => force.side === side);
    group.slice(0, -1).forEach((force, index) => {
      chained.push({
        fromForceId: force.id,
        toForceId: group[index + 1].id,
        type: index === 0 ? "command" : "coordination",
        note: index === 0 ? "同侧指挥链路" : "同侧协同"
      });
    });
  });
  const blue = units.find((force) => force.side === "friendly");
  const red = units.find((force) => force.side === "hostile");
  if (blue && red) chained.push({ fromForceId: red.id, toForceId: blue.id, type: "coordination", note: "红蓝对抗作用轴" });
  const relations = (skeleton.length ? skeleton : chained).map((item) => ({
    fromForceId: item.fromForceId,
    toForceId: item.toForceId,
    type: item.type || "coordination",
    relationshipCategory: inferOv4RelationCategory(item.type),
    note: item.note || ""
  }));
  const roleIds = units.map((force) => String(force.id));
  return {
    summary: "已根据作战兵力生成组织指挥、保障与信息关系草案。",
    relations,
    diagrams: [{ name: "总体组织关系图", description: "覆盖当前兵力组织与协同关系。", roleIds }]
  };
}

function createForceMissionPlanResult(analysis) {
  const objective = valueOf(analysis, "任务目标") || valueOf(analysis, "研究意图") || "作战概念研究";
  const notes = valueOf(analysis, "reviewNotes") || valueOf(analysis, "复核批注");
  const phaseNames = Array.isArray(analysis?.phaseAction?.phases)
    ? analysis.phaseAction.phases.map((item) => item.name).filter(Boolean).slice(0, 3)
    : [];
  const phaseHint = phaseNames.length ? `覆盖阶段：${phaseNames.join("、")}` : "按简报与阶段需求分配职责";
  const samplePlatforms = Array.isArray(analysis?.cmoCatalog?.platforms) ? analysis.cmoCatalog.platforms : [];
  const operationalTasks = Array.isArray(analysis?.operationalTasks)
    ? analysis.operationalTasks
    : Array.isArray(analysis?.existingForceMission?.tasks)
      ? analysis.existingForceMission.tasks
      : [];
  const taskRefsFor = (force = {}) => {
    const sameSide = operationalTasks.filter((task) => !force.side || !task?.side || task.side === force.side);
    const sameMission = sameSide.filter((task) => task?.missionType && task.missionType === force.missionType);
    return (sameMission.length ? sameMission : sameSide)
      .slice(0, 4)
      .map((task) => String(task?.id || ""))
      .filter(Boolean);
  };
  const pickPlatform = (index) => {
    const hit = samplePlatforms[index];
    if (!hit?.name) return [];
    return [{
      domain: hit.domain || "aircraft",
      cmoId: Number(hit.cmoId) || 0,
      name: hit.name,
      country: hit.country || "",
      category: hit.category || "",
      quantity: 1
    }];
  };
  const phaseUnconfirmed = analysis?.phaseActionConfirmed === false;
  const layer = analysis?.forceLayer === "concept" || analysis?.forceLayer === "combat"
    ? analysis.forceLayer
    : "both";
  const existingForces = Array.isArray(analysis?.existingForceMission?.forces)
    ? analysis.existingForceMission.forces
    : [];
  const conceptForces = existingForces.length && layer === "combat"
    ? existingForces.map((force, index) => ({
      id: force.id || `force-${index + 1}`,
      name: force.name || `概念单元${index + 1}`,
      side: force.side || "friendly",
      role: force.role || "maneuver",
      group: force.group || "概念编组",
      missionType: force.missionType || "other",
      task: force.task || "研究级概念任务",
      taskRefs: Array.isArray(force.taskRefs) ? force.taskRefs : taskRefsFor(force),
      phaseIds: Array.isArray(force.phaseIds) ? force.phaseIds : [],
      platforms: [],
      notes: force.notes || ""
    }))
    : [
      { id: "sense", name: "概念感知单元", side: "friendly", role: "sense", group: "态势形成", missionType: "recon", task: `围绕“${objective}”形成研究级态势输入；${phaseHint}`, platforms: [], notes },
      { id: "command", name: "概念指挥协同单元", side: "friendly", role: "command", group: "指挥协同", missionType: "command", task: "组织概念级协同与授权边界", platforms: [], notes: "" },
      { id: "maneuver", name: "概念行动单元", side: "friendly", role: "maneuver", group: "概念行动", missionType: "strike", task: `支撑主方向行动方案比较；${phaseHint}`, platforms: [], notes: "" },
      { id: "support", name: "概念保障单元", side: "friendly", role: "support", group: "持续保障", missionType: "support", task: "支撑过程连续性与资源复核", platforms: [], notes: "" },
      { id: "external", name: "外部态势对象", side: "unknown", role: "external", group: "外部环境", missionType: "other", task: valueOf(analysis, "主要风险") || "表达外部约束与不确定性", platforms: [], notes: "" },
      { id: "red-strike", name: "红方主突单元", side: "hostile", role: "maneuver", group: "红方编组", missionType: "strike", task: "对蓝方关键节点形成压力", platforms: [], notes: "" },
      { id: "red-command", name: "红方协同节点", side: "hostile", role: "command", group: "红方编组", missionType: "command", task: "组织红方多轴协同", platforms: [], notes: "" },
      { id: "red-ew", name: "红方诱偏压制单元", side: "hostile", role: "sense", group: "红方编组", missionType: "sead", task: "实施诱偏与压制", platforms: [], notes: "" }
    ];
  conceptForces.forEach((force) => {
    if (!Array.isArray(force.taskRefs)) force.taskRefs = taskRefsFor(force);
  });
  const conceptId = (roles, side = "friendly", fallback = "") => {
    const hit = conceptForces.find((item) => item.side === side && roles.includes(item.role));
    return hit?.id || fallback;
  };
  const combatForces = [
    { id: "combat-sense", name: "预警侦察分队", side: "friendly", role: "sense", conceptForceId: conceptId(["sense"], "friendly", "sense"), group: "作战编组", missionType: "recon", task: `遂行侦察预警以支撑“${objective}”`, platforms: pickPlatform(0), notes: "" },
    { id: "combat-command", name: "指挥控制节点", side: "friendly", role: "command", conceptForceId: conceptId(["command"], "friendly", "command"), group: "作战编组", missionType: "command", task: "遂行指挥协同与授权控制", platforms: [], notes: "" },
    { id: "combat-strike", name: "主战突击分队", side: "friendly", role: "maneuver", conceptForceId: conceptId(["maneuver", "airDefense", "air"], "friendly", "maneuver"), group: "作战编组", missionType: "strike", task: `在主方向遂行打击与突击；${phaseHint}`, platforms: pickPlatform(1), notes: "" },
    { id: "combat-support", name: "综合保障分队", side: "friendly", role: "support", conceptForceId: conceptId(["support"], "friendly", "support"), group: "作战编组", missionType: "support", task: "保障主战力量持续行动", platforms: [], notes: "" },
    { id: "combat-red-strike", name: "红方突击分队", side: "hostile", role: "maneuver", conceptForceId: conceptId(["maneuver", "air"], "hostile", "red-strike"), group: "红方作战编组", missionType: "strike", task: "遂行主突防或突击轴行动", platforms: [], notes: "" },
    { id: "combat-red-command", name: "红方行动协同节点", side: "hostile", role: "command", conceptForceId: conceptId(["command"], "hostile", "red-command"), group: "红方作战编组", missionType: "command", task: "组织红方多轴协同与转换", platforms: [], notes: "" }
  ];
  combatForces.forEach((force) => {
    force.taskRefs = taskRefsFor(force);
  });
  return {
    forces: conceptForces,
    combatForces: layer === "concept" ? combatForces.slice(0, 4) : combatForces,
    relations: [
      { fromForceId: conceptId(["sense"], "friendly", "sense"), toForceId: conceptId(["command"], "friendly", "command"), type: "information", note: "态势上报" },
      { fromForceId: conceptId(["command"], "friendly", "command"), toForceId: conceptId(["maneuver", "airDefense"], "friendly", "maneuver"), type: "command", note: "行动授权" },
      { fromForceId: conceptId(["support"], "friendly", "support"), toForceId: conceptId(["maneuver", "airDefense"], "friendly", "maneuver"), type: "support", note: "持续保障" },
      { fromForceId: "combat-sense", toForceId: "combat-command", type: "information", note: "作战态势" },
      { fromForceId: "combat-command", toForceId: "combat-strike", type: "command", note: "作战指挥" },
      { fromForceId: "combat-support", toForceId: "combat-strike", type: "support", note: "作战保障" }
    ],
    openQuestions: [
      "概念职责是否完整？",
      "作战兵力是否覆盖主阶段行动？",
      "指挥与保障关系是否自洽？",
      phaseUnconfirmed ? "阶段与行动尚未确认，兵力任务是否需在阶段确认后重生成？" : "",
      notes || "批注是否需要纳入职责调整？"
    ].filter(Boolean),
    reviewChecklist: [
      "概念兵力是否覆盖感知/指挥/行动/保障",
      "作战兵力是否挂接到对应概念单元",
      "作战兵力 CMO 任务类型是否合理",
      "CMO 平台引用是否仅为类型参考（非真实编制）"
    ]
  };
}

function createTaskOrganizationDraftResult(analysis = {}) {
  const tasks = Array.isArray(analysis.tasks) ? analysis.tasks : [];
  const buckets = new Map();
  tasks.forEach((task) => { const key = `${task?.side === "hostile" ? "hostile" : "friendly"}|${task?.missionType || "综合"}`; if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(task); });
  const taskGroups = [...buckets].map(([key, items]) => { const [side, missionType] = key.split("|"); return { name: `${side === "hostile" ? "红方" : "蓝方"}${missionType === "综合" ? "" : missionType}任务`, dimension: "missionType", taskRefs: items.map((item) => item.id), rationale: "按阵营和任务类型整理现有任务。", coordination: "组内顺序沿用任务清单顺序。" }; });
  return { summary: "已将现有任务整理为待复核分组，未新增或拆分任务。", taskGroups };
}

function createOperationalTaskDraftResult(analysis) {
  const phases = Array.isArray(analysis?.phaseAction?.phases) ? analysis.phaseAction.phases : [];
  const tasks = [];
  for (const phase of phases) {
    for (const [side, actions] of [["friendly", phase.blueActions || phase.primaryActions || []], ["hostile", phase.redActions || phase.secondaryActions || []]]) {
      actions.slice(0, 8).forEach((action, index) => {
        const text = String(action || "").trim();
        if (!text) return;
        tasks.push({
          id: `${phase.id || "phase"}-${side === "friendly" ? "blue" : "red"}-${index + 1}`,
          name: "综合作战任务", side, phaseId: phase.id || "", missionType: "other",
          area: { name: "待人工明确", type: "other", geometryType: "polygon", coordinateSystem: "WGS84", points: [], radiusNm: 0, description: "", basis: "输入未提供可核验坐标", needsReview: true },
          objective: text, expectedEffect: (phase.expectedEffects || [])[0] || "", sourceAction: text, notes: "本地回退草案"
        });
      });
    }
  }
  return { tasks, openQuestions: tasks.some((task) => !task.area.points.length) ? ["任务区域坐标缺少可核验输入，请人工补充。"] : [] };
}

function createPhaseActionConceptResult(analysis) {
  // Shared topic-aware builder (same path as server/local fallback).
  const brief = {
    researchIntent: valueOf(analysis, "研究意图"),
    objective: valueOf(analysis, "任务目标") || "作战概念研究",
    approach: valueOf(analysis, "核心思路"),
    expectedEffects: valueOf(analysis, "预期效果") || "形成可复核的阶段作战效果",
    risk: valueOf(analysis, "主要风险")
  };
  const combatFocus = analysis?.combatFocus && typeof analysis.combatFocus === "object" ? analysis.combatFocus : null;
  const ruleLibrary = analysis?.ruleLibrary && typeof analysis.ruleLibrary === "object" ? analysis.ruleLibrary : null;
  const built = createPhaseActionConceptFromBrief(brief, null, {
    source: "local",
    forceMission: analysis?.forceMission || null,
    combatFocus,
    ruleLibrary
  });
  return {
    phases: built.phases,
    transitions: built.transitions,
    openQuestions: built.openQuestions,
    reviewChecklist: built.reviewChecklist
  };
}

function createRuleLibraryDraftResult(analysis) {
  const objective = shortResearchText(valueOf(analysis, "任务目标") || valueOf(analysis, "研究意图") || "作战概念研究", 48);
  const approach = shortResearchText(valueOf(analysis, "核心思路") || "体系协同", 40);
  const effects = shortResearchText(valueOf(analysis, "预期效果") || "形成可复核态势优势", 40);
  const risk = shortResearchText(valueOf(analysis, "主要风险") || "对手反制", 40);
  const assumptions = shortResearchText(valueOf(analysis, "关键假设") || "关键条件成立", 40);
  const request = String(analysis?.revisionRequest || "").trim();
  const revisionNotes = String(analysis?.["修订要求"] || "").trim();
  const existing = Array.isArray(analysis?.currentRules?.rules) ? analysis.currentRules.rules : [];
  // First-entry pregenerate must never go through the chat “add N rules” path.
  const isPregenerate = analysis?.pregenerateFromBrief === true
    || /首次按简报|完整规则库|预生成|简报确认后进入规则库/.test(`${request} ${revisionNotes}`);
  const isConsult = !isPregenerate
    && /咨询|是否|为什么|如何理解|解释/.test(request)
    && !/新增|添加|补充|删除|修改|起草|合并|拆分|写入/.test(request);
  // Chat-style add only: explicit 新增/添加/N条, not bare “起草完整库”.
  const isAdd = !isPregenerate
    && /新增|添加|补充|新建|写入/.test(request)
    && !/完整规则库|首次按简报/.test(request);

  if (existing.length && isConsult) {
    return {
      summary: `当前规则库共 ${existing.length} 条。建议优先核对：名称是否作战语义明确、描述是否可观察、范围是否过宽。本轮仅咨询，未改表单。`,
      rules: []
    };
  }

  // Add/supplement: return only new short rules so the client can merge-append.
  if (isAdd) {
    const countMatch = request.match(/(\d+)\s*条/) || request.match(/([一二两三四五六七八九十])\s*条/);
    const cnMap = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
    let count = 3;
    if (countMatch) {
      count = cnMap[countMatch[1]] || Math.max(1, Math.min(12, Number(countMatch[1]) || 3));
    }
    const theme = extractLocalRuleTheme(request) || "作战任务";
    const templates = [
      { name: `${theme}目标对齐`, type: "业务规则", scope: theme, description: `${theme}行动须回扣目标“${objective}”，并具备可观察完成判据。` },
      { name: `${theme}进入门槛`, type: "前置条件", scope: theme, description: `进入${theme}前须满足授权、态势与资源就绪等门槛；未满足不得转入执行。` },
      { name: `${theme}时窗受控`, type: "转换条件", scope: theme, description: `${theme}阶段转换须依据可观察条件与时窗，禁止无依据跳过复核。` },
      { name: `${theme}风险阈值`, type: "约束", scope: theme, description: `${theme}触及风险“${risk}”阈值时须降级、切换路径或请求授权。` },
      { name: `${theme}效果复核`, type: "业务规则", scope: theme, description: `${theme}退出前复核效果是否朝向“${effects}”，并记录研究判断。` }
    ];
    const rules = [];
    for (let i = 0; i < count; i += 1) {
      const t = templates[i % templates.length];
      rules.push({
        id: `rule-local-add-${i + 1}`,
        name: t.name.slice(0, 24),
        type: t.type,
        scope: t.scope.slice(0, 24),
        description: t.description
      });
    }
    return {
      summary: `已按“${request.slice(0, 40)}”起草 ${rules.length} 条新增规则草案（本地），请在表单复核。`,
      rules
    };
  }

  if (existing.length && request && !isPregenerate) {
    return {
      summary: `已按“${request.slice(0, 40)}”在本地草案中保留并整理现有规则；请在表单中继续精修描述。`,
      rules: existing.map((rule, index) => ({
        id: rule.id || `rule-${index + 1}`,
        name: rule.name || `规则 ${index + 1}`,
        type: rule.type || "约束",
        scope: rule.scope || "研究级",
        description: rule.description || "待补充"
      }))
    };
  }

  // Default / pregenerate: short, operational rule names — never use process phrases as titles.
  return {
    summary: `已根据简报目标“${objective}”起草规则本体草案（本地兜底），请在表单复核后保存。`,
    rules: [
      {
        id: "rule-link",
        name: "关键链路可用",
        type: "约束",
        scope: "全局",
        description: `围绕“${objective}”，主/备态势与指挥链路至少一路可用，作为阶段进入与转换的基础条件。`
      },
      {
        id: "rule-window",
        name: "行动时窗受控",
        type: "转换条件",
        scope: "全局",
        description: "阶段时窗须可观察、可复核；转换不得无依据等长切分或跳过门槛。"
      },
      {
        id: "rule-auth",
        name: "交战授权边界",
        type: "前置条件",
        scope: "全局",
        description: "关键行动须满足授权边界与风险阈值；未获授权不得进入火力释放类阶段。"
      },
      {
        id: "rule-effect",
        name: "效果可复核",
        type: "业务规则",
        scope: "全局",
        description: `以“${approach}”推进时，阶段退出须对应可观察效果（如覆盖、通道控制），并回扣“${effects}”。`
      },
      {
        id: "rule-assumption",
        name: "关键假设持续成立",
        type: "约束",
        scope: "全局",
        description: `持续核验关键假设“${assumptions}”；假设失效时暂停进入下一阶段并回改规则或阶段设计。`
      },
      {
        id: "rule-risk",
        name: "主要风险阈值",
        type: "业务规则",
        scope: "全局",
        description: `关注主要风险“${risk}”：达阈值时须降级目标、切换备选路径或请求授权，不得无记录硬推。`
      }
    ]
  };
}

function createRuleLibraryChangeSetResult(analysis = {}) {
  const source = ["phase-action", "operational-task", "force-mission"].includes(analysis.source) ? analysis.source : "phase-action";
  const existing = Array.isArray(analysis?.currentRules?.rules) ? analysis.currentRules.rules : [];
  const changes = [];
  if (source === "phase-action") {
    (analysis.phaseAction || []).forEach((phase, index) => {
      const name = String(phase?.name || `阶段 ${index + 1}`);
      const scope = `阶段：${name}`;
      if (phase?.entryConditions?.length) changes.push({ id: `phase-entry-${index + 1}`, action: "add", ruleId: "", rule: { id: `rule-phase-entry-${index + 1}`, name: `${name}进入门槛`, type: "前置条件", scope, description: `进入该阶段前，应依据已确认的进入条件完成可观察、可复核的就绪判断。` }, rationale: "依据该阶段的进入条件。" });
      if (phase?.exitConditions?.length || phase?.expectedEffects?.length) changes.push({ id: `phase-exit-${index + 1}`, action: "add", ruleId: "", rule: { id: `rule-phase-exit-${index + 1}`, name: `${name}转换判据`, type: "转换条件", scope, description: `阶段转换应以已确认的退出条件或预期效果为判据，并保留复核依据。` }, rationale: "依据该阶段的退出条件和预期效果。" });
    });
  } else if (source === "operational-task") {
    (analysis.tasks || []).forEach((task, index) => {
      const name = String(task?.name || `任务 ${index + 1}`);
      changes.push({ id: `task-rule-${index + 1}`, action: "add", ruleId: "", rule: { id: `rule-task-${index + 1}`, name: `${name}执行规则`, type: "业务规则", scope: `任务：${name}`, description: "任务执行与结束应依据已确认的任务目标和预期效果形成可观察、可复核判据。", phaseRefs: [], taskRefs: [task.id] }, rationale: "依据任务目标、类型与预期效果。" });
    });
  } else {
    (analysis.forces || []).forEach((force, index) => {
      const name = String(force?.name || `概念兵力 ${index + 1}`);
      if (!force?.task) return;
      changes.push({ id: `force-duty-${index + 1}`, action: "add", ruleId: "", rule: { id: `rule-force-duty-${index + 1}`, name: `${name}职责边界`, type: "业务规则", scope: `兵力：${name}`, description: `该兵力承担的任务应与职责边界一致；任务调整或交接时应明确责任主体与可复核依据。` }, rationale: "依据该兵力的任务与角色。" });
    });
    (analysis.relations || []).forEach((relation, index) => {
      if (!relation?.fromForceId || !relation?.toForceId) return;
      changes.push({ id: `force-link-${index + 1}`, action: "add", ruleId: "", rule: { id: `rule-force-link-${index + 1}`, name: "协同交接可追溯", type: "业务规则", scope: "兵力协同", description: "存在协同、支援、指挥或信息关系时，应明确交接条件、责任边界和确认记录。" }, rationale: "依据已确认的兵力关系。" });
    });
  }
  const names = new Set(existing.map((rule) => `${rule.name}|${rule.scope}`));
  const unique = changes.filter((change) => !names.has(`${change.rule.name}|${change.rule.scope}`)).slice(0, 24);
  return { summary: source === "phase-action" ? "已依据已确认阶段与行动提出待审核规则建议。" : "已依据已确认兵力、任务与协同关系提出待审核规则建议。", changes: unique };
}

function createStateMachineDraftResult(analysis) {
  const subjects = Array.isArray(analysis?.stateMachineSubjects) && analysis.stateMachineSubjects.length
    ? analysis.stateMachineSubjects
    : (Array.isArray(analysis?.phaseAction?.phases) ? analysis.phaseAction.phases.map((phase) => ({ ...phase, subjectType: "phase" })) : []);
  const rules = Array.isArray(analysis?.rules) ? analysis.rules.filter((rule) => rule?.id) : [];
  return {
    summary: "已为阶段行动生成阶段机，并为独立任务和持续运行对象生成分机草案。",
    stateMachines: subjects.map((subject, index) => {
      const subjectRef = String(subject?.id || `subject-${index + 1}`);
      const prefix = `state-machine-${subjectRef}`;
      const window = String(subject?.timeWindow || "").trim();
      const redPressure = (Array.isArray(subject?.redActions) ? subject.redActions : []).filter(Boolean)[0] || "";
      const actions = [...new Set([subject?.taskName, ...(subject?.blueActions || []), subject?.context].map((item) => String(item || "").trim()).filter(Boolean))];
      const primaryAction = actions[0] || subject?.name || "任务";
      const secondaryAction = actions.find((item) => item !== primaryAction) || "协同条件";
      const expectedEffect = String(subject?.expectedEffects?.[0] || "预期效果").trim();
      const states = [
        { id: `${prefix}-start`, name: "开始", kind: "initial", decisionExpression: "" },
        { id: `${prefix}-ready`, name: `${primaryAction.slice(0, 36)}准备就绪`, kind: "normal", decisionExpression: "" },
        { id: `${prefix}-execute`, name: `${secondaryAction.slice(0, 36)}执行中`, kind: "normal", decisionExpression: "" },
        { id: `${prefix}-verify`, name: `${expectedEffect.slice(0, 36)}待确认`, kind: "normal", decisionExpression: "" },
        { id: `${prefix}-end`, name: "结束", kind: "final", decisionExpression: "" }
      ];
      return {
        id: `${prefix}-machine`,
        subjectRef,
        subjectType: subject?.subjectType || (/::action-\d+$/.test(subjectRef) ? "phase" : "task"),
        name: `${subject?.name || `建模对象 ${index + 1}`}状态机`,
        states,
        transitions: states.slice(0, -1).map((state, stateIndex) => ({
          id: `${prefix}-t${stateIndex + 1}`,
          fromStateRef: state.id,
          toStateRef: states[stateIndex + 1].id,
          condition: [
            subject?.entryConditions?.[0] || (window ? `进入时窗 ${window}` : `${primaryAction}启动条件满足`),
            `${primaryAction}准备完成且执行条件具备`,
            subject?.expectedEffects?.[0] || (redPressure ? `在${redPressure}压力下完成行动` : `${secondaryAction}完成`),
            subject?.exitConditions?.[0] || `${expectedEffect}经观察确认`
          ][stateIndex],
          branchResult: "",
          ruleRefs: rules.slice(0, stateIndex === 0 ? 1 : 2).map((rule) => rule.id)
        }))
      };
    })
  };
}

function createSequenceDraftResult(analysis) {
  const phases = Array.isArray(analysis?.phases) ? analysis.phases : Array.isArray(analysis?.phaseAction?.phases) ? analysis.phaseAction.phases : [];
  const forces = Array.isArray(analysis?.forces) ? analysis.forces : [];
  const participants = (forces.length
    ? forces.slice(0, 6).map((force, index) => ({
      id: String(force?.id || `force-${index + 1}`),
      name: String(force?.name || force?.id || `参与方 ${index + 1}`),
      ref: String(force?.id || ""),
      refType: force?.id ? "force" : ""
    }))
    : phases.slice(0, 4).map((phase, index) => ({
      id: String(phase?.id || `phase-${index + 1}`),
      name: String(phase?.name || `阶段 ${index + 1}`),
      ref: String(phase?.id || ""),
      refType: phase?.id ? "phase" : ""
    })));
  if (participants.length < 2) {
    participants.push(
      { id: "participant-blue", name: "蓝方指挥", ref: "", refType: "" },
      { id: "participant-force", name: "行动单元", ref: "", refType: "" }
    );
  }
  const messages = (phases.length ? phases : [{ name: "协同", blueActions: ["态势上报"], id: "phase-1" }]).slice(0, 8).map((phase, index) => {
    const from = participants[index % participants.length];
    const to = participants[(index + 1) % participants.length];
    const action = (phase.blueActions || phase.primaryActions || [])[0] || phase.objective || phase.name || `消息 ${index + 1}`;
    return {
      id: `event-local-${index + 1}`,
      sequence: index + 1,
      fromRef: from.id,
      toRef: to.id,
      name: String(action).slice(0, 80),
      type: "message",
      condition: String((phase.entryConditions || phase.exitConditions || [])[0] || "").slice(0, 120),
      relatedActivityRefs: phase.id ? [String(phase.id)] : []
    };
  });
  return {
    summary: "已按阶段/兵力生成协同时序草案；请在画布复核消息方向与活动回链。",
    sequences: [{
      id: "sequence-local-1",
      name: phases[0]?.name ? `${phases[0].name}协同时序` : "阶段协同时序",
      participants,
      messages,
      fragments: []
    }]
  };
}

function shortResearchText(value, max = 48) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Theme for local add-rules: drop process words, never keep “首次按简报…” fragments. */
function extractLocalRuleTheme(request = "") {
  const cleaned = String(request || "")
    .replace(/首次|按简报|完整|规则库|预生成|本轮|要求|修订|对话|表单|研究|请|把|将|并|与|和|的|了|等/g, " ")
    .replace(/新增|添加|补充|起草|生成|写入|规则|主要|针对|关于|条|候选|草案/g, " ")
    .replace(/[一二两三四五六七八九十\d]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length < 2) return "";
  if (/简报|完整|库规则|预生成/.test(cleaned)) return "";
  return cleaned.slice(0, 12);
}

function createConceptGraphicPlanResult(analysis) {
  const objective = valueOf(analysis, "任务目标") || "作战概念研究";
  const approach = valueOf(analysis, "核心思路") || "研究级总体构想";
  const effects = valueOf(analysis, "预期效果") || "形成可复核总体效果";
  const forceNames = Array.isArray(analysis?.forceMission?.forces)
    ? analysis.forceMission.forces
    : [];
  const sense = forceNames.find((item) => item.role === "sense") || forceNames[0] || { id: "sense", name: "概念感知单元", task: "形成态势" };
  const command = forceNames.find((item) => item.role === "command") || forceNames[1] || { id: "command", name: "概念指挥单元", task: "组织协同" };
  const action = forceNames.find((item) => item.role === "maneuver") || forceNames[2] || { id: "maneuver", name: "概念行动单元", task: "实施主方向" };
  return {
    narrative: `围绕“${objective}”，以${approach}组织感知、指挥、关键行动与效果评估。`,
    nodes: [
      { id: "sense", label: sense.name || "概念感知单元", role: "sense", fromForceIds: [sense.id].filter(Boolean), fromPhaseIds: [], note: sense.task || "形成态势" },
      { id: "decide", label: command.name || "概念指挥单元", role: "command", fromForceIds: [command.id].filter(Boolean), fromPhaseIds: [], note: command.task || "组织协同" },
      { id: "control", label: action.name || "概念行动单元", role: "action", fromForceIds: [action.id].filter(Boolean), fromPhaseIds: [], note: action.task || "实施主方向" },
      { id: "opponent", label: "外部态势对象", role: "external", fromForceIds: [], fromPhaseIds: [], note: valueOf(analysis, "主要风险") || "外部约束" },
      { id: "assess", label: "任务效果与终态", role: "effect", fromForceIds: [], fromPhaseIds: [], note: effects }
    ],
    edges: [
      { from: "sense", to: "decide", type: "信息流", note: "态势上报" },
      { from: "decide", to: "control", type: "控制流", note: "行动授权" },
      { from: "opponent", to: "decide", type: "态势变化", note: "外部影响" },
      { from: "control", to: "assess", type: "反馈", note: "效果回流" },
      { from: "assess", to: "sense", type: "反馈", note: "下一轮感知" }
    ],
    effects: [effects],
    activityCandidates: Array.isArray(analysis?.phaseAction?.phases)
      ? analysis.phaseAction.phases.flatMap((phase) => (phase.primaryActions || []).map((item) => `${phase.name}：${item}`)).slice(0, 8)
      : ["态势形成", "协同决策", "主方向行动", "效果评估"],
    oodaHints: ["观察：多源态势汇聚", "判断：窗口与风险复核", "决策：协同授权", "行动：主方向实施与反馈"],
    openQuestions: ["总体节点是否完整？", "是否足以进入正式 OV-1？"],
    reviewChecklist: ["总体构想是否完整", "与前序规划是否一致", "是否可直接形成 OV-1"],
    consistencyReport: ["兵力来源已汇总", "阶段来源已汇总", "模糊图参考已纳入"]
  };
}

function createConceptMapInitialPlan(analysis) {
  const objective = valueOf(analysis, "概念目标") || valueOf(analysis, "任务目标") || "作战概念研究";
  const forceMission = analysis?.forceMission && typeof analysis.forceMission === "object" ? analysis.forceMission : null;
  const phaseAction = analysis?.phaseAction && typeof analysis.phaseAction === "object" ? analysis.phaseAction : null;
  const forces = Array.isArray(forceMission?.forces) && forceMission.forces.length
    ? forceMission.forces.slice(0, 36).map((force, index) => ({
      id: force.id || `force-${index + 1}`,
      name: force.name || `概念单元${index + 1}`,
      side: force.side || "friendly",
      role: force.role || "maneuver",
      group: force.group || "概念编组",
      task: force.task || "研究级概念任务",
      phaseIds: Array.isArray(force.phaseIds) && force.phaseIds.length ? force.phaseIds.slice(0, 4) : ["deployment"],
      // Preserve abstract slots from force-mission; map will re-validate.
      slot: force.slot || ["northwest", "center", "east", "south", "west", "northeast"][index % 6]
    }))
    : [
      { id: "sense", name: "概念感知单元", side: "friendly", role: "sense", group: "态势形成", task: "形成研究级态势输入", phaseIds: ["recon"], slot: "northwest" },
      { id: "command", name: "概念指挥协同单元", side: "friendly", role: "command", group: "指挥协同", task: "组织概念级协同", phaseIds: ["deployment", "assault"], slot: "center" },
      { id: "maneuver", name: "概念行动单元", side: "friendly", role: "maneuver", group: "概念行动", task: "支撑行动方案比较", phaseIds: ["assault"], slot: "east" },
      { id: "support", name: "概念保障单元", side: "friendly", role: "support", group: "持续保障", task: "支撑过程连续性复核", phaseIds: ["support"], slot: "south" }
    ];
  const phases = Array.isArray(phaseAction?.phases) && phaseAction.phases.length
    ? [
      { phaseId: "recon", objective: phaseAction.phases[0]?.objective || "形成研究级态势输入与待核验条件。" },
      { phaseId: "deployment", objective: phaseAction.phases[1]?.objective || "组织概念兵力编组与协同关系。" },
      { phaseId: "assault", objective: phaseAction.phases[2]?.objective || "比较概念行动关系及其预期作用。" },
      { phaseId: "support", objective: phaseAction.phases[3]?.objective || phaseAction.phases.at(-1)?.objective || "复核保障约束、持续性和修订条件。" }
    ]
    : [
      { phaseId: "recon", objective: "形成研究级态势输入与待核验条件。" },
      { phaseId: "deployment", objective: "组织概念兵力编组与协同关系。" },
      { phaseId: "assault", objective: "比较概念行动关系及其预期作用。" },
      { phaseId: "support", objective: "复核保障约束、持续性和修订条件。" }
    ];
  const relations = Array.isArray(forceMission?.relations) && forceMission.relations.length
    ? forceMission.relations.slice(0, 18).map((item) => ({
      fromForceId: item.fromForceId,
      toForceId: item.toForceId,
      type: item.type === "command" || item.type === "support" ? "coordination" : (item.type || "coordination"),
      phaseId: "deployment"
    })).filter((item) => item.fromForceId && item.toForceId)
    : [
      { fromForceId: "sense", toForceId: "command", type: "information", phaseId: "recon" },
      { fromForceId: "command", toForceId: "maneuver", type: "coordination", phaseId: "assault" },
      { fromForceId: "support", toForceId: "maneuver", type: "coordination", phaseId: "support" }
    ];
  return {
    title: `${objective}作战概念图`.slice(0, 80),
    summary: "研究级概念兵力部署与阶段关系，供人工在独立工具中修订。",
    phases,
    forces,
    areas: [{ id: "assessment-area", name: "概念评估区域", phaseId: "recon", slot: "north", note: "研究级态势关注范围" }],
    relations,
    questions: ["人工复核概念兵力、阶段关系和抽象布局。"]
  };
}

function createOperationalConceptGraphic(analysis) {
  const objective = valueOf(analysis, "任务目标");
  // Product projections for OV-1; client/server apply paths wrap with DoDAF 2.02/DM2 envelope.
  return {
    schema: "dodaf-2.02-dm2-ov",
    schemaVersion: 1,
    product: "OV-1",
    concept: { mission: objective, objective, scope: valueOf(analysis, "主要风险"), phase: "总体概念评估", expectedEffects: valueOf(analysis, "预期效果"), constraints: valueOf(analysis, "主要风险") },
    nodes: [
      { id: "sense", label: "预警与态势感知平台", detail: "汇聚研究级态势信息，支撑预警与判断。", category: "装备/平台", kind: "equipment", dm2Type: "System" },
      { id: "decide", label: "联合指挥控制节点", detail: "形成协同判断与授权边界。", category: "指挥节点", kind: "command", dm2Type: "Organization" },
      { id: "control", label: "分层防护协同行动", detail: "组织高层防护与保障协同。", category: "关键动作", kind: "action", dm2Type: "Activity" },
      { id: "opponent", label: "外部威胁与环境约束", detail: "记录外部影响、假设和待验证条件。", category: "外部对象", kind: "external", dm2Type: "Performer" },
      { id: "assess", label: "持续防护与韧性效果", detail: "评估概念效果并反馈下一轮修订。", category: "预期效果", kind: "effect", dm2Type: "Measure" }
    ],
    edges: [
      { id: "ov1-edge-sense-decide", sourceId: "sense", targetId: "decide", type: "信息流" },
      { id: "ov1-edge-decide-control", sourceId: "decide", targetId: "control", type: "控制流" },
      { id: "ov1-edge-opponent-decide", sourceId: "opponent", targetId: "decide", type: "态势变化" },
      { id: "ov1-edge-control-assess", sourceId: "control", targetId: "assess", type: "反馈" },
      { id: "ov1-edge-assess-sense", sourceId: "assess", targetId: "sense", type: "反馈" }
    ],
    entities: [
      { id: "sense", dm2Type: "System", name: "预警与态势感知平台", description: "汇聚研究级态势信息，支撑预警与判断。" },
      { id: "decide", dm2Type: "Organization", name: "联合指挥控制节点", description: "形成协同判断与授权边界。" },
      { id: "control", dm2Type: "Activity", name: "分层防护协同行动", description: "组织高层防护与保障协同。" },
      { id: "opponent", dm2Type: "Performer", name: "外部威胁与环境约束", description: "记录外部影响、假设和待验证条件。" },
      { id: "assess", dm2Type: "Measure", name: "持续防护与韧性效果", description: "评估概念效果并反馈下一轮修订。" }
    ],
    relations: [
      { id: "ov1-edge-sense-decide", dm2Type: "relationship", sourceId: "sense", targetId: "decide", name: "信息流" },
      { id: "ov1-edge-decide-control", dm2Type: "relationship", sourceId: "decide", targetId: "control", name: "控制流" },
      { id: "ov1-edge-opponent-decide", dm2Type: "relationship", sourceId: "opponent", targetId: "decide", name: "态势变化" },
      { id: "ov1-edge-control-assess", dm2Type: "relationship", sourceId: "control", targetId: "assess", name: "反馈" },
      { id: "ov1-edge-assess-sense", dm2Type: "relationship", sourceId: "assess", targetId: "sense", name: "反馈" }
    ],
    provenance: { mode: "local", generatedAt: new Date().toISOString() }
  };
}

function createConceptPlan(analysis, evidenceRefs) {
  return {
    id: "concept-001",
    name: "联合封控作战概念方案",
    style: "稳控塑势",
    coreIdea: `围绕“${valueOf(analysis, "主要矛盾")}”，构建感知先行、体系压制、分阶段控势、效果闭环评估的作战概念。`,
    objective: valueOf(analysis, "任务目标"),
    phases: [
      "态势建模与目标识别：汇聚多源侦察信息，形成关键节点清单。",
      "电子压制与火力塑势：压缩对手感知链和指挥链，为后续控制创造窗口。",
      "封控与机动控制：围绕关键通道组织持续封控，保持行动安全边界。",
      "效果评估与方案修正：跟踪毁伤、干扰和对手反应，及时调整行动节奏。"
    ],
    forceCoordination: [
      `红方力量：${valueOf(analysis, "我方力量")}`,
      "侦察力量持续发现和校核目标。",
      "电子战力量压缩对手感知、通信和协同效率。",
      "远程火力单元打击关键感知与指挥节点。"
    ],
    commandControl: [
      "建立跨域态势共享机制，保持侦察、指挥、火力和评估链路闭合。",
      "设置备用通信链路和任务中止条件，降低单点失效影响。"
    ],
    supportNeeds: [
      "补充关键节点坐标、火力清单、保障条件和行动窗口判据。",
      `行动窗口：${valueOf(analysis, "行动窗口")}`
    ],
    risks: [
      `关键约束：${valueOf(analysis, "关键约束")}`,
      "敌方电子干扰和假目标可能降低目标识别可信度。",
      "单一关键节点失效可能影响封控节奏。"
    ],
    expectedEffects: [
      "削弱蓝方远程干预效率。",
      "提升红方对关键通道的持续控制能力。",
      "形成可评估、可修订、可导出的概念方案。"
    ],
    assumptions: [
      valueOf(analysis, "假设条件"),
      "红方能够保持基础态势感知连续。",
      "知识库依据可覆盖体系破击、联合封控和方案评估三个方面。"
    ],
    evidenceRefs
  };
}

function createPlanVariants(analysis, evidenceRefs) {
  const objective = valueOf(analysis, "任务目标");
  return [
    {
      id: "variant-001",
      name: "稳控塑势方案",
      type: "steady-control",
      summary: `以态势感知和通道控制为主线，稳步降低对手干预效率，服务于“${objective}”。`,
      phases: ["建立多源态势图并识别关键节点。", "组织电子压制和区域封控，稳定行动边界。", "按效果评估结果滚动调整火力与机动。"],
      strengths: ["风险暴露较低", "便于持续保障", "适合不确定性较高条件"],
      weaknesses: ["见效速度偏慢", "对持续侦察依赖较强"],
      resourceNeeds: ["持续侦察力量", "电子压制资源", "封控与保障单元"],
      riskNotes: ["对手若快速分散机动，可能拉长封控周期。"],
      evidenceRefs
    },
    {
      id: "variant-002",
      name: "快速破击方案",
      type: "rapid-strike",
      summary: "集中侦察、电子压制和远程火力，优先打击对手关键感知与指挥节点。",
      phases: ["快速确认高价值节点和火力窗口。", "同步实施电子压制与远程精确打击。", "转入效果评估和残余节点补击。"],
      strengths: ["行动节奏快", "可迅速削弱对手闭环", "适合情报稳定窗口"],
      weaknesses: ["对情报准确性要求高", "保障与协同压力较大"],
      resourceNeeds: ["高频侦察校核", "远程火力单元", "跨域指挥协同"],
      riskNotes: ["目标误判或窗口变化会放大行动风险。"],
      evidenceRefs
    },
    {
      id: "variant-003",
      name: "诱导牵制方案",
      type: "deception-fix",
      summary: "通过多方向佯动和信息诱导牵制对手主力，为主攻方向创造行动窗口。",
      phases: ["构设佯动方向和信息诱导目标。", "牵制对手感知、指挥和机动力量。", "在主攻方向实施封控和关键节点压制。"],
      strengths: ["可制造局部主动", "有利于降低主攻方向压力", "便于配合后续破击"],
      weaknesses: ["对信息设计和节奏控制要求高", "效果较难快速量化"],
      resourceNeeds: ["信息诱导资源", "机动牵制力量", "态势评估小组"],
      riskNotes: ["诱导意图暴露后，可能引发对手反向利用。"],
      evidenceRefs
    }
  ];
}

function createWargameReview(analysis, evidenceRefs) {
  const risks = createRiskItems(analysis, evidenceRefs);
  const revisions = createRevisionItems(risks);

  return {
    id: "review-001",
    conceptPlanId: "concept-001",
    name: "多角色推演评估复盘",
    roles: [
      {
        role: "红方指挥员",
        questions: [
          "侦察、指挥、火力和效果评估链路能否在行动窗口内连续闭合？",
          "关键节点被干扰或失效时，备用通道和替代打击目标是否明确？"
        ],
        counterActions: [
          "将多源侦察校核前置到第一阶段，并设置备用通信链路。",
          "按关键节点重要度建立替代目标清单和行动中止条件。"
        ],
        findings: ["红方方案具备体系压制思路，但需要把保障冗余写入阶段任务。"]
      },
      {
        role: "蓝方指挥员",
        questions: [
          "红方主要依赖哪些可被压制、诱骗或拖慢的感知节点？",
          "蓝方是否能够利用分布式机动和假目标削弱红方打击效率？"
        ],
        counterActions: [
          "组织电子干扰、假目标释放和远程火力威慑，扰乱红方闭环节奏。",
          "在关键通道外侧保持机动，诱导红方消耗侦察和火力资源。"
        ],
        findings: ["蓝方反制重点集中在电磁干扰、目标欺骗和外线机动。"]
      },
      {
        role: "裁判组",
        questions: [
          "任务目标是否可量化，预期效果是否能被观测和复核？",
          "当前风险是否已有概率、影响、缓解措施和责任角色？"
        ],
        counterActions: [
          "要求每个阶段补充效果判据、退出条件和复盘记录。",
          "将风险清单纳入导出成果包，便于专家逐项审查。"
        ],
        findings: ["裁判认为方案可进入下一轮修订，但需要补齐量化判据。"]
      },
      {
        role: "保障协调员",
        questions: [
          "弹药、通信、维修和战损补充能否支撑连续行动？",
          "若行动窗口压缩，保障优先级如何调整？"
        ],
        counterActions: [
          "建立保障资源优先级和关键消耗预警线。",
          "为侦察、通信和火力链路分别设置最低保障阈值。"
        ],
        findings: ["保障链路是方案持续性的主要约束，需要在导出包中单列。"]
      },
      {
        role: "风险控制员",
        questions: [
          "哪些风险会直接破坏任务达成，哪些风险只影响行动效率？",
          "缓解措施是否能在执行前完成部署和检查？"
        ],
        counterActions: [
          "按概率和影响建立风险优先级，先处理高影响项。",
          "把风险触发条件写入阶段复盘和人工确认节点。"
        ],
        findings: ["风险项已具备闭环雏形，仍需接入真实数据校核等级。"]
      }
    ],
    risks,
    revisions,
    conclusion: "建议以稳控塑势方案为基准，吸收快速破击的关键节点压制动作，并在下一轮生成前补充备用通信、目标校核、保障阈值和中止条件。"
  };
}

function createWorkflowBrief(workflow, analysis, evidenceRefs) {
  const sectionsByWorkflow = {
    scenario: [
      ["任务理解", valueOf(analysis, "任务目标")],
      ["敌我态势", `敌方重点表现为：${valueOf(analysis, "敌方能力")} 我方可依托：${valueOf(analysis, "我方力量")}`],
      ["主要约束", valueOf(analysis, "关键约束")],
      ["假设与待确认", `${valueOf(analysis, "假设条件")}；${valueOf(analysis, "待确认问题")}`]
    ],
    knowledge: [
      ["检索结论", `当前命中的主要知识依据为：${formatEvidenceTitles(evidenceRefs)}。`],
      ["可用知识", "将条令、案例、装备能力和研究笔记拆成“原则、条件、行动、风险、指标”五类知识片段。"],
      ["来源追溯", "每条依据保留来源文件或标题，并显示标题、标签、双链、正文等命中原因。"]
    ],
    wargame: [
      ["红方视角", "重点保持侦察、指挥、火力和评估链路连续，避免关键节点暴露后被反制。"],
      ["蓝方视角", "可能采取电子干扰、假目标、分布式机动和远程火力压制，削弱红方闭环效率。"],
      ["裁判视角", "重点检查任务目标是否可量化、行动窗口是否现实、保障链路是否能够支撑持续行动。"],
      ["修正建议", "增加备用通信链路、替代打击节点、假目标识别流程和行动中止条件。"]
    ],
    output: [
      ["概念图结构", "底图呈现任务区域；图层包括敌我部署、侦察链路、电子压制区、火力路径、阶段边界和效果评估节点。"],
      ["文稿结构", "建议形成“任务背景、问题判断、基本构想、行动阶段、力量协同、风险控制、预期效果”七段式成果。"],
      ["导出计划", "导出 Markdown 文稿、结构化 JSON、知识依据引用和 mapInput 占位结构。"]
    ]
  };

  return {
    id: `${workflow.id}-brief-001`,
    name: workflow.title,
    sections: (sectionsByWorkflow[workflow.id] || []).map(([title, text]) => ({ title, text })),
    evidenceRefs
  };
}

function createEvaluation(workflow, analysis, evidenceRefs, result, outputSchema) {
  const evidenceIds = evidenceRefs.map((item) => item.id);
  const review = outputSchema === "WargameReview" ? result : createWargameReview(analysis, evidenceRefs);
  const metrics = [
    ["mission-fit", "任务贴合", workflow.id === "scenario" ? 84 : 82, "结构化字段可支撑当前工作流输入，并能回扣任务目标与行动窗口。"],
    ["knowledge-support", "知识支撑", evidenceRefs.length ? 82 : 58, evidenceRefs.length ? "已接入可追溯知识依据。" : "仍需导入更多知识依据。"],
    ["risk-identification", "风险识别", workflow.id === "wargame" ? 86 : 76, "风险清单已包含描述、概率、影响、缓解措施和责任角色。"],
    ["export-readiness", "成果完整", workflow.id === "output" ? 88 : 80, "输出具备 Markdown、JSON、评估结构和 mapInput 导出所需字段。"]
  ];
  const score = Math.round(metrics.reduce((sum, [, , value]) => sum + value, 0) / metrics.length);
  return {
    id: `eval-${workflow.id}`,
    conceptPlanId: "concept-001",
    score,
    riskLevel: score >= 78 ? "较成熟" : score >= 70 ? "可迭代" : "需补充",
    metrics: metrics.map(([id, name, metricScore, rationale]) => ({
      id,
      name,
      score: metricScore,
      rationale,
      evidenceRefs: evidenceIds
    })),
    wargameReview: review,
    risks: review.risks,
    revisions: review.revisions,
    conclusion: review.conclusion,
    evidenceRefs: evidenceIds
  };
}

function createRiskItems(analysis, evidenceRefs) {
  const evidenceIds = evidenceRefs.slice(0, 2).map((item) => item.id);
  return [
    {
      id: "risk-001",
      title: "态势感知链路受扰",
      description: `蓝方可能依托${valueOf(analysis, "敌方能力")}实施电子干扰、假目标和分布式机动，降低红方目标识别可信度。`,
      probability: "medium",
      impact: "high",
      mitigation: "设置多源侦察交叉校核、假目标识别流程和备用感知节点。",
      ownerRole: "红方指挥员",
      evidenceRefs: evidenceIds
    },
    {
      id: "risk-002",
      title: "关键节点单点失效",
      description: "指挥、通信或火力关键节点若被压制，可能导致侦察打击评估闭环中断。",
      probability: "medium",
      impact: "high",
      mitigation: "建立备用通信链路、替代目标清单和行动中止条件。",
      ownerRole: "保障协调员",
      evidenceRefs: evidenceIds
    },
    {
      id: "risk-003",
      title: "保障持续性不足",
      description: `在${valueOf(analysis, "行动窗口")}内持续组织封控和压制，可能造成弹药、维修、通信与战损补充压力。`,
      probability: "medium",
      impact: "medium",
      mitigation: "按阶段设置保障阈值、消耗预警和优先级调整规则。",
      ownerRole: "保障协调员",
      evidenceRefs: evidenceIds
    }
  ];
}

function createRevisionItems(risks) {
  return [
    {
      id: "revision-001",
      title: "补充备用通信与目标校核链路",
      description: "在第一阶段加入多源校核、备用通信和链路状态检查，降低感知受扰和单点失效影响。",
      priority: "high",
      ownerRole: "红方指挥员",
      relatedRiskIds: ["risk-001", "risk-002"]
    },
    {
      id: "revision-002",
      title: "建立保障阈值和消耗预警",
      description: "为弹药、维修、通信和战损补充设置最低阈值，作为阶段转换和行动中止条件。",
      priority: "medium",
      ownerRole: "保障协调员",
      relatedRiskIds: ["risk-003"]
    },
    {
      id: "revision-003",
      title: "按风险优先级调整方案节奏",
      description: `优先处置 ${risks.filter((risk) => risk.impact === "high").length} 个高影响风险，低影响项纳入滚动复盘。`,
      priority: "medium",
      ownerRole: "风险控制员",
      relatedRiskIds: risks.map((risk) => risk.id)
    }
  ];
}

function createMapInput(analysis, evaluation) {
  return {
    title: "作战概念图输入占位",
    phases: ["态势建模", "电子压制", "封控控制", "效果评估"].map((name, index) => ({
      id: `phase-${String(index + 1).padStart(3, "0")}`,
      sequence: index + 1,
      name,
      summary: index === 3 ? "跟踪效果并依据风险清单修正方案。" : "待概念图模块进一步细化。"
    })),
    forces: [
      { id: "force-red-001", side: "red", name: "红方联合力量", elements: splitList(valueOf(analysis, "我方力量")) },
      { id: "force-blue-001", side: "blue", name: "蓝方远程干预力量", elements: splitList(valueOf(analysis, "敌方能力")) }
    ],
    actions: [
      { id: "action-001", phaseId: "phase-001", side: "red", type: "reconnaissance", description: "侦察发现与态势建模。" },
      { id: "action-002", phaseId: "phase-002", side: "red", type: "electronic-suppression", description: "电子压制与关键节点干扰。" },
      { id: "action-003", phaseId: "phase-003", side: "red", type: "control", description: "火力塑势与通道控制。" },
      { id: "action-004", phaseId: "phase-004", side: "blue", type: "counter-action", description: "蓝方干扰、假目标和机动反制。" }
    ],
    areas: [
      {
        id: "area-001",
        name: valueOf(analysis, "战场环境"),
        type: "operation-area",
        notes: ["边界、坐标、关键通道和目标点位待后续概念图模块补充。"]
      }
    ],
    notes: [
      valueOf(analysis, "关键约束"),
      `当前评估等级：${evaluation.riskLevel}，综合评分：${evaluation.score}。`
    ]
  };
}

function buildEvidenceRefs(evidence) {
  return evidence.map((item, index) => ({
    id: `K${index + 1}`,
    source: item.filePath || item.name || item.title,
    title: item.title,
    summary: (item.summary || item.text || item.content || "").slice(0, 140),
    tags: item.tags ?? [],
    links: item.links ?? [],
    score: item.score ?? 0,
    matchReasons: item.matchReasons ?? []
  }));
}

function toMarkdown(output) {
  return [
    `# ${output.workflow.title}`,
    "",
    `> 模板：${output.template.name}（${output.outputSchema}）`,
    "",
    renderResultMarkdown(output.result, output.outputSchema),
    "",
    renderEvaluationMarkdown(output.evaluation),
    "",
    "## 知识依据",
    renderEvidenceMarkdown(output.evidenceRefs),
    "",
    "## mapInput",
    `- 标题：${output.mapInput.title}`,
    `- 阶段：${output.mapInput.phases.map((phase) => phase.name || phase).join("、")}`,
    "",
    "## 下一步",
    nextSteps.map((step) => `- ${step}`).join("\n")
  ].join("\n");
}

function renderResultMarkdown(result, schema) {
  if (schema === "TaskOrganizationDraft") {
    return ["## 任务整理草案", result.summary || "", "### 任务组", ...(result.taskGroups || []).map((item) => `- ${item.name}：${(item.taskRefs || []).join("、")}；${item.rationale || ""}`)].join("\n");
  }
  if (schema === "OperationalTaskDraft") {
    return [
      "## 作战任务草案",
      ...(result.tasks || []).map((task) => `- **${task.name}**（${task.missionType} · ${task.area?.name || "区域待定"}）：${task.objective}`),
      "### 开放问题",
      ...(result.openQuestions || []).map((item) => `- ${item}`)
    ].join("\n");
  }
  if (schema === "ForceMissionPlan") {
    return [
      "## 兵力与任务设计草案",
      "### 概念兵力",
      ...(result.forces || []).map((force) => `- ${force.name}（${force.role}）：${force.task}`),
      "### 关系",
      ...(result.relations || []).map((item) => `- ${item.fromForceId} -[${item.type}]-> ${item.toForceId}`),
      "### 开放问题",
      ...(result.openQuestions || []).map((item) => `- ${item}`)
    ].join("\n");
  }
  if (schema === "ConceptGraphicPlan") {
    return [
      "## 总体作战概念图草案",
      result.narrative || "",
      "### 节点",
      ...(result.nodes || []).map((node) => `- ${node.label}（${node.role}）：${node.note || ""}`),
      "### 关系",
      ...(result.edges || []).map((edge) => `- ${edge.from} -[${edge.type}]-> ${edge.to}`),
      "### 开放问题",
      ...(result.openQuestions || []).map((item) => `- ${item}`)
    ].join("\n");
  }
  if (schema === "CombatFocusOptions") {
    return [
      "## 作战聚焦候选",
      ...(result.options || []).map((item) => `- **${item.title}**：${item.text}`)
    ].join("\n");
  }
  if (schema === "RuleLibraryDraft") {
    return [
      "## 规则库草案",
      result.summary || "",
      "### 规则",
      ...((result.rules || []).length
        ? result.rules.map((rule) => `- **${rule.name}**（${rule.type || "约束"} · ${rule.scope || "研究级"}）：${rule.description || ""}`)
        : ["- （本轮未改规则表单）"])
    ].join("\n");
  }
  if (schema === "RuleLibraryChangeSet") {
    return [
      "## 规则变更建议",
      result.summary || "",
      "### 待审核变更",
      ...((result.changes || []).length
        ? result.changes.map((change) => `- **${change.action}** ${change.rule?.name || change.ruleId || "规则"}：${change.rationale || change.rule?.description || ""}`)
        : ["- （当前无充分依据提出变更）"])
    ].join("\n");
  }
  if (schema === "StateMachineDraft") {
    return [
      "## 状态机草案",
      result.summary || "",
      ...(result.stateMachines || []).map((machine) => [
        `### ${machine.name || machine.subjectRef || "状态机"}`,
        `- 状态：${(machine.states || []).map((state) => state.name).filter(Boolean).join(" → ")}`,
        `- 转换：${(machine.transitions || []).map((transition) => transition.condition).filter(Boolean).join("；")}`
      ].join("\n"))
    ].join("\n\n");
  }
  if (schema === "SequenceDraft") {
    return [
      "## 时序图草案",
      result.summary || "",
      ...(result.sequences || []).map((sequence) => [
        `### ${sequence.name || sequence.id || "事件序列"}`,
        `- 类型：${sequence.diagramType || "general"}`,
        `- 参与方：${(sequence.participants || []).map((item) => item.name || item.id).filter(Boolean).join("、") || "待补充"}`,
        `- 消息：${(sequence.messages || []).map((item) => item.name).filter(Boolean).join("；") || "待补充"}`
      ].join("\n"))
    ].join("\n\n");
  }
  if (schema === "PhaseActionConcept") {
    return [
      "## 阶段与行动构想草案（CONOPS）",
      ...(result.phases || []).map((phase, index) => {
        const seq = phase.sequence || index + 1;
        const window = phase.timeWindow ? `（${phase.timeWindow}）` : "";
        const blue = (phase.blueActions || phase.primaryActions || []).join("；");
        const red = (phase.redActions || phase.secondaryActions || []).join("；");
        return [
          `### 阶段${seq}${window}：${phase.name}`,
          `蓝方行动：${blue || "—"}`,
          `红方行动：${red || "—"}`,
          `阶段目标：${phase.objective || "—"}`
        ].join("\n");
      }),
      "### 转换",
      ...(result.transitions || []).map((item) => `- ${item.fromPhaseId} -> ${item.toPhaseId}（${item.condition}）`),
      "### 开放问题",
      ...(result.openQuestions || []).map((item) => `- ${item}`)
    ].join("\n\n");
  }
  if (schema === "ConceptMapInitialPlan") {
    return [
      `## ${result.title}`,
      result.summary,
      "### 概念阶段",
      ...(result.phases || []).map((phase) => `- ${phase.phaseId}：${phase.objective}`),
      "### 概念兵力",
      ...(result.forces || []).map((force) => `- ${force.name}（${force.group}）：${force.task}`),
      "### 待确认项",
      ...(result.questions || []).map((question) => `- ${question}`)
    ].join("\n");
  }
  if (schema === "OperationalConceptGraphic") {
    return [
      `## ${result.concept?.mission || "OV-1 高层作战概念图"}`,
      `### 任务目标\n${result.concept?.objective || "待明确"}`,
      `### 概念节点\n${(result.nodes || []).map((node) => `- **${node.label}**（${node.category}）：${node.detail}`).join("\n")}`,
      `### 高层关系\n${(result.edges || []).map((edge) => `- ${edge.sourceId} -[${edge.type}]-> ${edge.targetId}`).join("\n")}`
    ].join("\n\n");
  }

  if (schema === "ConceptPlan") {
    return [
      `## ${result.name}`,
      `**风格**：${result.style}`,
      "",
      `### 基本构想\n${result.coreIdea}`,
      "",
      `### 任务目的\n${result.objective}`,
      "",
      renderList("行动阶段", result.phases),
      renderList("力量协同", result.forceCoordination),
      renderList("指挥控制", result.commandControl),
      renderList("保障需求", result.supportNeeds),
      renderList("风险控制", result.risks),
      renderList("预期效果", result.expectedEffects),
      renderList("关键假设", result.assumptions)
    ].join("\n");
  }

  if (schema === "PlanVariant[]") {
    return result.map((variant) => [
      `## ${variant.name}`,
      `**类型**：${variant.type}`,
      "",
      variant.summary,
      "",
      renderList("行动阶段", variant.phases),
      renderList("优势", variant.strengths),
      renderList("不足", variant.weaknesses),
      renderList("资源需求", variant.resourceNeeds),
      renderList("风险提示", variant.riskNotes)
    ].join("\n")).join("\n\n");
  }

  if (schema === "WargameReview") {
    return [
      `## ${result.name}`,
      "",
      "### 多角色质询",
      result.roles.map((role) => [
        `#### ${role.role}`,
        renderList("质询问题", role.questions),
        renderList("反制/修正动作", role.counterActions),
        renderList("角色判断", role.findings)
      ].join("\n")).join("\n\n"),
      "",
      "### 风险清单",
      renderRiskItemsMarkdown(result.risks),
      "",
      "### 修正建议",
      result.revisions.map((revision) => `- **${revision.title}**（${revision.priority}）：${revision.description}；责任角色：${revision.ownerRole}`).join("\n"),
      "",
      `### 裁判结论\n${result.conclusion}`
    ].join("\n");
  }

  return [`## ${result.name}`, ...result.sections.map((section) => `### ${section.title}\n${section.text}`)].join("\n\n");
}

function renderEvaluationMarkdown(evaluation) {
  return [
    "## 方案评估摘要",
    `综合评分：${evaluation.score}（${evaluation.riskLevel}）`,
    "",
    "### 指标评分",
    ...evaluation.metrics.map((metric) => `- ${metric.name} ${metric.score}：${metric.rationale}（依据：${metric.evidenceRefs.join("、") || "待补充"}）`),
    "",
    "### 风险清单",
    renderRiskItemsMarkdown(evaluation.risks),
    "",
    "### 修正建议",
    evaluation.revisions.map((revision) => `- **${revision.title}**（${revision.priority}）：${revision.description}`).join("\n")
  ].join("\n");
}

function renderRiskItemsMarkdown(risks) {
  return risks.map((risk) => [
    `- **${risk.title}**`,
    `  - 描述：${risk.description}`,
    `  - 概率：${risk.probability}`,
    `  - 影响：${risk.impact}`,
    `  - 缓解措施：${risk.mitigation}`,
    `  - 责任角色：${risk.ownerRole}`
  ].join("\n")).join("\n");
}

function renderEvidenceMarkdown(evidenceRefs) {
  if (!evidenceRefs.length) {
    return "- 暂无匹配依据，建议导入 OBS/Obsidian 知识库。";
  }
  return evidenceRefs.map((item) => `- [${item.id}] ${item.title}（${item.source}）：${item.summary}`).join("\n");
}

function renderList(title, items) {
  return `### ${title}\n${items.map((item) => `- ${item}`).join("\n")}`;
}

function formatAnalysis(analysis) {
  return Object.entries(analysis).map(([key, value]) => `${key}：${value}`).join("\n");
}

function formatEvidence(evidenceRefs) {
  return evidenceRefs.map((item) => `${item.id} ${item.title}（${item.source}）：${item.summary}`).join("\n") || "待接入知识库依据";
}

function formatEvidenceTitles(evidenceRefs) {
  return evidenceRefs.map((item) => item.title).join("、") || "待接入知识库依据";
}

function fillTemplateText(text, variables) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => variables[key] ?? "");
}

function valueOf(analysis, key) {
  return analysis[key] || "待补充";
}

function splitList(value) {
  return String(value || "")
    .split(/[；;、，,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}
