/**
 * 战法与作战概念研究工作台统一术语词典 (Glossary)
 * 收录 DoDAF 架构视图、决策循环、系统组件与常用缩写规范。
 */

export const GLOSSARY = Object.freeze({
  "DoDAF": {
    term: "DoDAF",
    full: "Department of Defense Architecture Framework",
    name: "美国国防部体系结构框架",
    desc: "指导复杂军事体系与作战概念结构化建模的标准顶层架构框架。"
  },
  "OV": {
    term: "OV",
    full: "Operational View",
    name: "作战视图",
    desc: "DoDAF 架构中描述任务、活动、力量与信息交换的作战视角视图总称。"
  },
  "OV-1": {
    term: "OV-1",
    full: "High-Level Operational Concept Graphic",
    name: "高级作战概念总体图",
    desc: "描述作战概念的最高层全局示意图，呈现主体力量、空间态势与核心协同行动。"
  },
  "OV-1a": {
    term: "OV-1a",
    full: "High-Level Operational Concept Graphic (Overview)",
    name: "高级作战概念总体图",
    desc: "展现作战概念宏观图景的高层态势图。"
  },
  "OV-1b": {
    term: "OV-1b",
    full: "Operational Task Decomposition",
    name: "作战任务分解图",
    desc: "将作战总体任务分解为层级化、时序化的具体作战任务清单与协同编组。"
  },
  "OV-1c": {
    term: "OV-1c",
    full: "Task to Operational Activity Mapping",
    name: "任务与作战活动映射矩阵",
    desc: "建立作战任务清单（OV-1b）与作战活动（OV-5）之间的追踪支撑关系。"
  },
  "OV-2": {
    term: "OV-2",
    full: "Operational Node Connectivity Description",
    name: "作战节点连接图",
    desc: "描述作战节点（平台/部队/指挥机构）之间的连接拓扑与交换通道。"
  },
  "OV-3": {
    term: "OV-3",
    full: "Operational Information Exchange Matrix",
    name: "作战信息交换矩阵",
    desc: "明确节点间传递的数据格式、时延要求与输入输出契约。"
  },
  "OV-4": {
    term: "OV-4",
    full: "Organizational Relationships Chart",
    name: "组织关系与指挥责任图",
    desc: "展示作战力量编组的隶属关系、指挥控制层级与协同职责。"
  },
  "OV-5": {
    term: "OV-5",
    full: "Operational Activity Model",
    name: "作战活动模型",
    desc: "说明作战活动网络、输入输出依赖因果链与制胜机理。"
  },
  "OV-5a": {
    term: "OV-5a",
    full: "Operational Activity Decomposition Tree",
    name: "作战活动层级分解树",
    desc: "对作战活动进行结构化父子层次展开与功能分解。"
  },
  "OV-5b": {
    term: "OV-5b",
    full: "Operational Activity Flow / Mechanism",
    name: "作战活动流与机理图",
    desc: "刻画活动之间的数据流、控制流与因果联动闭环。"
  },
  "OV-6a": {
    term: "OV-6a",
    full: "Operational Rules Model",
    name: "作战规则库",
    desc: "规定作战行动的约束前提、执行规则、进入退出条件与行动准则。"
  },
  "OV-6b": {
    term: "OV-6b",
    full: "State Transition Description",
    name: "状态机转换图",
    desc: "描述作战对象/任务随事件触发的状态变迁与条件守卫。"
  },
  "OV-6c": {
    term: "OV-6c",
    full: "Event-Trace Description",
    name: "事件时序图",
    desc: "按时间顺序描述跨节点或跨实体的交互信息时序追踪。"
  },
  "OV-7": {
    term: "OV-7",
    full: "Logical Data Model",
    name: "逻辑数据模型 / 状态活动映射",
    desc: "定义作战数据要素及其与状态、活动的语义映射。"
  },
  "OODA": {
    term: "OODA",
    full: "Observe, Orient, Decide, Act",
    name: "OODA 决策循环",
    desc: "由博伊德提出的“观察-判断-决策-行动”动态决策对抗循环模型。"
  },
  "CONOPS": {
    term: "CONOPS",
    full: "Concept of Operations",
    name: "作战概念 / 作战构想",
    desc: "对预定作战行动目的、打法机理与运用方式的综合构想论述。"
  },
  "C2": {
    term: "C2",
    full: "Command and Control",
    name: "指挥与控制",
    desc: "对作战力量组织、指挥、控制与协同保障的过程与系统。"
  },
  "ISR": {
    term: "ISR",
    full: "Intelligence, Surveillance, and Reconnaissance",
    name: "情报、监视与侦察",
    desc: "为决策和打击提供多源态势感知的综合侦察体系。"
  },
  "EW": {
    term: "EW",
    full: "Electronic Warfare",
    name: "电子战",
    desc: "利用电磁能和定向能控制电磁频谱或攻击敌方的军事行动。"
  },
  "SEAD": {
    term: "SEAD",
    full: "Suppression of Enemy Air Defenses",
    name: "防空压制",
    desc: "通过电子压制或火力打击瓦解敌方地面或海上防空体系的战法行动。"
  },
  "ROE": {
    term: "ROE",
    full: "Rules of Engagement",
    name: "交战规则",
    desc: "指导部队何时、何地以及在何种情况下可以发起或升级攻击的准则。"
  },
  "SPOF": {
    term: "SPOF",
    full: "Single Point of Failure",
    name: "单点故障",
    desc: "体系中若发生故障将导致整个系统或闭环瘫痪的单一关键环节。"
  },
  "DM2": {
    term: "DM2",
    full: "DoDAF Meta-Model",
    name: "DoDAF 元模型",
    desc: "DoDAF 2.02 的核心本体数据规范，统一定义实体、关系与测量。"
  },
  "CMO": {
    term: "CMO",
    full: "Command: Modern Operations",
    name: "专业现代军事行动仿真数据库",
    desc: "用于装备平台属性对齐与职责参考的专业军事数据库标准。"
  },
  "HITL": {
    term: "HITL",
    full: "Human-in-the-Loop",
    name: "人在回路",
    desc: "人在关键决策节点拥有最终确认与控制权的自主等级。"
  },
  "HOTL": {
    term: "HOTL",
    full: "Human-on-the-Loop",
    name: "人在回路之上（监督）",
    desc: "系统自主运行，人在异常或关键时刻介入监督与否决的自主等级。"
  },
  "HOOTL": {
    term: "HOOTL",
    full: "Human-out-of-the-Loop",
    name: "人在回路之外（全自主）",
    desc: "无人工干预的完全自主执行模式。"
  },
  "AI": {
    term: "AI",
    full: "Artificial Intelligence",
    name: "人工智能",
    desc: "用于研究草稿生成、活动机理推论与一致性核验的智能引擎。"
  },
  "API": {
    term: "API",
    full: "Application Programming Interface",
    name: "应用程序编程接口",
    desc: "前后端及外部模块间的数据交互规范契约。"
  },
  "JSON": {
    term: "JSON",
    full: "JavaScript Object Notation",
    name: "JavaScript 对象表示法",
    desc: "轻量级、跨语言的标准结构化数据交换格式。"
  },
  "XML": {
    term: "XML",
    full: "Extensible Markup Language",
    name: "可扩展标记语言",
    desc: "符合 DM2 交换规范的标准架构交换格式之一。"
  },
  "HTML": {
    term: "HTML",
    full: "HyperText Markup Language",
    name: "超文本标记语言",
    desc: "工作台界面标准标记语言。"
  },
  "URL": {
    term: "URL",
    full: "Uniform Resource Locator",
    name: "统一资源定位符",
    desc: "网络或本地资源的标准化寻址地址。"
  },
  "CRUD": {
    term: "CRUD",
    full: "Create, Read, Update, Delete",
    name: "增删改查",
    desc: "基础数据持久化生命周期操作。"
  },
  "CSS": {
    term: "CSS",
    full: "Cascading Style Sheets",
    name: "层叠样式表",
    desc: "控制工作台界面排版与视觉风格的样式表语言。"
  },
  "DAG": {
    term: "DAG",
    full: "Directed Acyclic Graph",
    name: "有向无环图",
    desc: "活动机理流与阶段时序依赖拓扑的数学数据结构。"
  },
  "DOM": {
    term: "DOM",
    full: "Document Object Model",
    name: "文档对象模型",
    desc: "浏览器中网页文档的层级对象树。"
  },
  "DOMAINS": {
    term: "DOMAINS",
    full: "Operational Domains",
    name: "作战域",
    desc: "陆、海、空、天、电、网等多维作战领域分类。"
  },
  "DPAPI": {
    term: "DPAPI",
    full: "Data Protection API",
    name: "数据保护应用编程接口",
    desc: "操作系统提供的本地密钥与敏感机密保护机制。"
  },
  "DSL": {
    term: "DSL",
    full: "Domain Specific Language",
    name: "领域特定语言",
    desc: "专为作战规则或推演逻辑设计的结构化表达语法。"
  },
  "FAB": {
    term: "FAB",
    full: "Floating Action Button",
    name: "浮动操作按钮",
    desc: "用于快捷触发核心交互的悬浮按钮。"
  },
  "ID": {
    term: "ID",
    full: "Identifier",
    name: "唯一标识符",
    desc: "项目、实体、任务与活动的唯一编码。"
  },
  "KPI": {
    term: "KPI",
    full: "Key Performance Indicator",
    name: "关键绩效指标",
    desc: "用于定量衡量战法成效与推演胜率的关键评估度量。"
  },
  "SVG": {
    term: "SVG",
    full: "Scalable Vector Graphics",
    name: "可缩放矢量图形",
    desc: "用于绘制清晰概念图与流程图的矢量图标准。"
  },
  "UML": {
    term: "UML",
    full: "Unified Modeling Language",
    name: "统一建模语言",
    desc: "用于时序图与状态机规范表达的行业通用建模标准。"
  },
  "CN": {
    term: "CN",
    full: "China / Country Code",
    name: "国家代码（中国）",
    desc: "CMO 装备库中的国家与归属代码。"
  },
  "DB3": {
    term: "DB3",
    full: "Database Version 3",
    name: "CMO 数据库第三代格式",
    desc: "Command: Modern Operations 采用的 SQLite 装备数据库格式。"
  },
  "SSE": {
    term: "SSE",
    full: "Server-Sent Events",
    name: "服务器推送事件",
    desc: "服务端向浏览器单向推送流式文本生成的通信机制。"
  },
  "CDP": {
    term: "CDP",
    full: "Chrome DevTools Protocol",
    name: "Chrome 开发者工具协议",
    desc: "用于自动化冒烟测试与浏览器无头交互检查的调试协议。"
  }
});

/**
 * 查询术语定义（支持大小写不敏感匹配）。
 */
export function lookupGlossary(term) {
  if (!term || typeof term !== "string") return null;
  const direct = GLOSSARY[term];
  if (direct) return direct;
  const upper = term.toUpperCase();
  if (GLOSSARY[upper]) return GLOSSARY[upper];
  const foundKey = Object.keys(GLOSSARY).find((k) => k.toUpperCase() === upper);
  return foundKey ? GLOSSARY[foundKey] : null;
}

/**
 * 格式化术语悬浮解释文本。
 */
export function formatTermTooltip(term) {
  const def = lookupGlossary(term);
  if (!def) return term;
  return `${def.name} (${def.full})：${def.desc}`;
}

/**
 * 渲染为标准 HTML `<abbr>` 标签。
 */
export function renderAbbr(term, displayText = term) {
  const def = lookupGlossary(term);
  if (!def) return escapeHtml(displayText);
  const title = `${def.name} (${def.full}): ${def.desc}`;
  return `<abbr class="glossary-abbr" title="${escapeHtml(title)}">${escapeHtml(displayText)}</abbr>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
