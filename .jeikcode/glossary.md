# 领域专有名词词汇表 (Domain Glossary)

本文件定义“AI 作战概念研究工作台”核心业务术语与代码类型、接口、模块的映射关系。

---

## 1. 核心作战概念与工作流术语

| 中文术语 | 英文术语 / 代码符号 | 核心含义与代码对应 |
| :--- | :--- | :--- |
| **作战概念** | Combat Concept / Operational Concept | 针对特定军事安全威胁提出的作战构想与行动方案体系；工作台核心研究对象。 |
| **概念纲要 / 简报** | Concept Brief (`project_briefs`) | 包含六大核心要素：研究意图、作战目标、行动途径、关键假设、预期效果、风险与应对。 |
| **主线门禁** | Workflow Gate (`workflowGate.js`) | 18步研究工作流阶段演进控制，区分主写（write）、校验（check）、交付（deliver）。 |
| **研究对话** | Research Chat (`ai.generate.research-chat`) | 面向作战概念孵化与推演的结构化 AI 研究对话流。 |
| **灵感启发** | Inspiration Advice (`inspirationAdviceStore.js`) | 基于作战理论与历史案例的启发式建议与思考提示。 |
| **想定 / 仿真想定** | Scenario (`project_scenarios`) | 作战发生的时间、空间、地理环境、敌我态势及作战企图设置。 |
| **兵力方案 / 任务组织** | Force Mission / Task Organization (`cmoCatalogClient.js`) | 参战部队与装备编成、任务分配与部署规划。 |
| **红方审阅** | Red Team Review (`redTeamController.js`, `ai.red-team.review`) | 对抗性独立批判评估，质询逻辑完整性、假设脆弱性与资源约束。 |
| **协同审阅** | Collaboration Review (`projectCollaborations`) | 专家评审、多方协同批注与修改建议审查。 |
| **溯源追踪** | Traceability (`traceabilityBuilder.js`) | 追踪作战要求到各 DoDAF 视图、假设、风险及证据链的双向追溯。 |
| **成果报告** | Research Report (`projectReportIntegrity.js`) | 最终导出的作战概念体系研究报告（含完整视图与分析）。 |

---

## 2. DoDAF 体系架构视图 (DoDAF 2.0 Operational Views)

| 视图编号 | 中文名称 | 代码 Key / 模型名 | 说明 |
| :--- | :--- | :--- | :--- |
| **OV-1** | 高级作战概念描述图 | `ov1` / `OperationalConceptGraphic` | 总体作战态势、空间分层与主要协同关系的可视化呈现。 |
| **OV-2** | 作战节点连接描述 | `ov2` / `OperationalNodeConnectivity` | 作战实体（节点）之间作战连通需求与通信链路拓扑。 |
| **OV-3** | 作战信息流矩阵 | `ov3` / `OperationalInformationExchange` | 节点间信息交换的主体、内容、周期与格式矩阵。 |
| **OV-4** | 组织关系图 | `ov4` / `OrganizationRelationshipDraft` | 指挥控制隶属与协同支援组织架构图。 |
| **OV-5a** | 作战活动分解树 | `ov5a` / `ActivityDecomposition` | 作战任务与行动的层级结构树状分解。 |
| **OV-5b** | 作战活动流转图 | `ov5b` / `ActivityModel` | 作战行动的时序流转、输入输出与活动关联图。 |
| **OV-6a** | 作战规则模型 | `ov6a` / `RuleLibraryDraft` | 约束作战行动与决策的业务逻辑、交战规则与先决条件。 |
| **OV-6b** | 状态迁移转换图 | `ov6b` / `StateMachineDraft` | 作战单元或系统在不同作战阶段的状态机迁移逻辑。 |
| **OV-6c** | 事件时序跟踪图 | `ov6c` / `SequenceDraft` | 跨实体作战交互的事件时序跟踪与时间线流。 |

---

## 3. 作战仿真与数据库 (CMO / DB3K)

| 术语 | 代码符号 | 说明 |
| :--- | :--- | :--- |
| **CMO** | Command: Modern Operations | 专业现代海空作战推演仿真引擎。 |
| **DB3K** | Database 3000 (`DB3K_510.db3`) | CMO 现代装备数据库（涵盖1946年至今的海陆空天电武器平台与传感器）。 |
| **平台推荐** | Force Platform Recommend (`forcePlatformRecommend.js`) | 中文装备概念词到 DB3K 英文平台种子的智能关联映射。 |
| **OODA 环** | OODA Loop (`Observe-Orient-Decide-Act`) | 观察-判断-决策-行动作战循环链路模型。 |

---

## 4. 知识库与接入规范

| 术语 | 代码符号 | 说明 |
| :--- | :--- | :--- |
| **Obsidian 接入** | Obsidian Vault (`knowledge.js`) | 本地 Markdown 笔记库结构化解析与知识溯源接入。 |
| **参数提取** | Parameter Table | 从 Markdown 知识块中结构化解析提取的关键技术战术指标。 |
| **敏感度级别** | Knowledge Sensitivity (`projectKnowledgeSensitivity.mjs`) | 公开 (public)、内部 (internal)、受限 (restricted) 的引用防护策略。 |
| **双链溯源** | Wikilinks (`[[Page#Heading]]`) | 基于 Obsidian 语法格式的知识依据与证据链引用追踪。 |
