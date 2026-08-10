export const sampleScenario = `任务背景：围绕某海空方向联合封控行动，红方需要在有限时间内建立态势感知、夺取关键通道控制权，并压制蓝方远程干预能力。

敌情判断：蓝方依托航母编队、远程预警、电子干扰和水下平台保持外线机动，可能采用诱骗、分布式突防和火力压制方式破坏红方封控。

我方力量：侦察卫星、预警机、电子战飞机、无人侦察平台、远程火力单元、水面舰艇和岸基防空力量。

约束条件：行动窗口 48 小时，强调体系协同、火力精确、风险可控，避免单一节点失效导致全局被动。

研究问题：如何利用 AI 辅助生成作战概念、比较多种方案，并形成可视化概念图与汇报材料。`;

export const workflows = [
  {
    id: "scenario",
    type: "作战问题理解",
    title: "作战想定解析工作流",
    tab: "想定解析",
    desc: "提取任务、敌情、我情、约束",
    goal: "把原始想定整理为后续工作流可复用的结构化任务上下文。",
    input: "任务背景、敌我态势、力量编成、行动窗口、约束条件",
    output: "结构化要素、主要矛盾、未知条件和补充材料清单",
    steps: ["材料录入", "要素抽取", "矛盾识别", "不确定性整理", "结构化输出"]
  },
  {
    id: "knowledge",
    type: "知识辅助研究",
    title: "知识库辅助研究工作流",
    tab: "知识库研究",
    desc: "接入 OBS/Obsidian 笔记",
    goal: "把本地研究笔记、条令案例和资料摘录转化为可引用依据。",
    input: "Markdown/Obsidian 笔记、标签、双链、关键词",
    output: "命中依据、引用摘录、资料覆盖情况和知识缺口",
    steps: ["导入库", "索引标签", "语义检索", "依据摘录", "引用汇总"]
  },
  {
    id: "concept",
    type: "概念生成",
    title: "作战概念生成工作流",
    tab: "概念生成",
    desc: "形成目的、构想、阶段与协同",
    goal: "基于想定要素和知识依据形成可讨论、可修订的作战概念初稿。",
    input: "结构化想定、知识依据、研究问题、专家修订意见",
    output: "基本构想、行动阶段、力量协同、预期效果",
    steps: ["任务理解", "知识增强", "构想生成", "协同设计", "效果描述"]
  },
  {
    id: "variants",
    type: "多方案设计",
    title: "多方案设计工作流",
    tab: "多方案",
    desc: "稳妥型、快速型、体系破击型",
    goal: "围绕同一研究项目展开多套行动构想并进行横向比较。",
    input: "概念初稿、约束条件、可用资源、风险偏好",
    output: "方案分型、行动路径、资源需求、优劣比较",
    steps: ["方案分型", "行动路径", "资源需求", "优劣比较", "推荐方案"]
  },
  {
    id: "wargame",
    type: "推演评估",
    title: "多角色推演评估工作流",
    tab: "推演评估",
    desc: "红方、蓝方、裁判、保障质询",
    goal: "从多角色视角检验方案薄弱点，形成可执行的修正建议。",
    input: "候选方案、对手能力、评估指标、保障条件",
    output: "反制推演、风险清单、修正建议、评估结论",
    steps: ["角色分配", "蓝方反制", "风险识别", "修正建议", "评估结论"]
  },
  {
    id: "output",
    type: "成果表达",
    title: "图文成果生成工作流",
    tab: "成果生成",
    desc: "概念图、表格、文稿和 PPT",
    goal: "把成熟研究结论整理为可导出、可汇报、可归档的成果包。",
    input: "定稿方案、图层要素、评估结论、引用材料",
    output: "Markdown 文稿、结构化 JSON、概念图和汇报材料草案",
    steps: ["结构定稿", "图层设计", "任务分解", "文稿生成", "导出归档"]
  }
];

export const workflowStatusMeta = {
  "not-started": {
    label: "未开始",
    tone: "muted",
    desc: "尚未正式运行，等待输入材料或人工触发。"
  },
  running: {
    label: "运行中",
    tone: "blue",
    desc: "正在基于当前项目上下文生成结果。"
  },
  generated: {
    label: "已生成",
    tone: "green",
    desc: "已产生阶段性输出，建议进入人工修订。"
  },
  "needs-review": {
    label: "待修订",
    tone: "gold",
    desc: "已有输出，但仍需专家核验和补充。"
  },
  approved: {
    label: "已确认",
    tone: "green",
    desc: "阶段结果已确认，可支撑后续工作流。"
  }
};

export const runStatusMeta = {
  draft: "草稿",
  success: "成功",
  failed: "失败"
};

export const promptTemplates = [
  {
    id: "scenario-structure",
    name: "作战想定结构化解析模板",
    workflowId: "scenario",
    variables: ["scenario", "knowledge", "outputFormat"],
    systemPrompt: "你是作战研究助理，负责把原始想定整理成结构化任务理解，不扩展未经证实的条件。",
    userPrompt: "请基于以下想定字段生成结构化解析。\n\n{{scenario}}\n\n可参考知识依据：\n{{knowledge}}\n\n输出要求：{{outputFormat}}",
    outputSchema: "WorkflowBrief"
  },
  {
    id: "knowledge-research",
    name: "知识库辅助研究模板",
    workflowId: "knowledge",
    variables: ["scenario", "knowledge", "outputFormat"],
    systemPrompt: "你是知识库研究助手，负责从知识片段中归纳可用于作战概念生成的依据。",
    userPrompt: "研究问题来自想定：\n{{scenario}}\n\n当前命中知识：\n{{knowledge}}\n\n请输出检索结论、可用知识类型和后续接入方式。输出要求：{{outputFormat}}",
    outputSchema: "WorkflowBrief"
  },
  {
    id: "concept-basic",
    name: "作战概念生成模板",
    workflowId: "concept",
    variables: ["scenario", "knowledge", "style", "outputFormat"],
    systemPrompt: "你是作战概念研究专家，负责生成结构完整、依据可追溯、便于修订的作战概念方案。",
    userPrompt: "请按“{{style}}”风格生成作战概念。\n\n想定字段：\n{{scenario}}\n\n知识依据：\n{{knowledge}}\n\n输出要求：{{outputFormat}}",
    outputSchema: "ConceptPlan"
  },
  {
    id: "variants-three",
    name: "多方案设计模板",
    workflowId: "variants",
    variables: ["scenario", "knowledge", "outputFormat"],
    systemPrompt: "你是方案设计助手，负责围绕同一任务生成不少于三种结构一致、便于比较的方案。",
    userPrompt: "请针对以下想定生成三种不同作战方案，并保持字段结构一致。\n\n想定字段：\n{{scenario}}\n\n知识依据：\n{{knowledge}}\n\n输出要求：{{outputFormat}}",
    outputSchema: "PlanVariant[]"
  },
  {
    id: "wargame-brief",
    name: "推演评估摘要模板",
    workflowId: "wargame",
    variables: ["scenario", "knowledge", "outputFormat"],
    systemPrompt: "你是推演评估助手，只输出高层评估摘要和修正建议，不展开分计划 04 的细节逻辑。",
    userPrompt: "请基于想定和知识依据生成红方、蓝方、裁判三类视角摘要。\n\n{{scenario}}\n\n{{knowledge}}\n\n输出要求：{{outputFormat}}",
    outputSchema: "WorkflowBrief"
  },
  {
    id: "output-brief",
    name: "成果表达生成模板",
    workflowId: "output",
    variables: ["scenario", "knowledge", "outputFormat"],
    systemPrompt: "你是成果表达助手，负责把概念方案转成图文成果结构，不直接绘制概念图。",
    userPrompt: "请基于以下上下文生成概念图结构、文稿结构和导出计划。\n\n{{scenario}}\n\n{{knowledge}}\n\n输出要求：{{outputFormat}}",
    outputSchema: "WorkflowBrief"
  }
];

export const defaultKnowledge = [
  {
    name: "体系破击.md",
    title: "体系破击",
    text: "体系破击强调发现敌方作战体系中的关键节点，通过侦察、干扰、火力和机动组合，削弱其感知、指挥和打击闭环。",
    tags: ["体系作战", "关键节点", "火力协同"],
    links: ["侦察打击链", "电子压制"]
  },
  {
    name: "联合封控案例.md",
    title: "联合封控案例",
    text: "联合封控需要将海上控制、空中遮断、远程火力、电子压制与信息支援合成为持续行动，避免单一力量独立运用。",
    tags: ["联合封控", "海空方向", "持续行动"],
    links: ["火力窗口", "态势感知"]
  },
  {
    name: "多方案评估框架.md",
    title: "多方案评估框架",
    text: "方案评估可围绕任务达成度、风险暴露、资源消耗、时间敏感性、对手反制和保障可持续性六类指标展开。",
    tags: ["方案评估", "风险", "指标"],
    links: ["推演评估"]
  }
];
