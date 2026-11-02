# 工作台 HTTP 接口指南

更新时间：2026-10-30。接口根路径为 `/api`，项目 ID 使用 URL 编码。所有 JSON 写入都应设置 `Content-Type: application/json`。规划段资源已纳入正式契约；除试用问题修复与规划链路扩展外，不无故改动既有资源形状。

## 通用约定

- 写入项目资源时传入 `expectedRevision`。服务端项目修订不一致返回 `409`；客户端应保留本地草稿，显式刷新或加载服务端版本，不自动覆盖。
- 默认存储模式为 Node.js 原生 SQLite 数据库持久化（`data/projects.sqlite` 与 `data/collaboration-identities.sqlite`）；仅在显式设置 `$env:PROJECT_STORAGE_MODE="file"` 时降级为 JSON 文件模式。
- 当部署启用 `COLLABORATION_PROJECT_WRITE_AUTH=true` 时，项目写入和审计读取要求有效本地协同会话；缺少会话通常返回 `403`。
- 响应仅返回公开状态、资源修订、审计归属和受限模型数据；不得假定其中含密码、会话或密钥。

## 健康、配置与 AI

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/health` | 读取公共运行状态、存储模式（默认 `projectRepository.mode=sqlite`）、检索模式与系统能力标记。`durable=true` 表示数据库持久化。 |
| POST | `/api/generate` | 生成结构化研究草稿；支持流式传输（SSE）与非流式调用；服务未配置真实模型时返回本地确定性降级结果。 |
| POST | `/api/red-team` | 对当前抽象模型执行研究级对抗质询与单点脆弱性分析。 |
| GET | `/api/ai-config` | 读取公共 AI 服务配置状态（端点、模型、协议类型等，不含密钥）。 |
| PUT | `/api/ai-config` | 仅在显式启用写入且负责人已登录时可用修改端点/模型；默认 `403`。 |
| GET | `/api/ai-prompts` | 读取全量 21 个 AI 提示词元数据（稳定 ID、名称、用途说明、动态变量、默认模板与当前覆盖状态）。 |
| PUT | `/api/ai-prompts` | 负责人更新提示词自定义模板（保存至 `data/ai-prompts.json`，即时对后续生成生效）。 |
| GET | `/api/theme-config` | 读取界面主题变量配置。 |
| PUT | `/api/theme-config` | 负责人写入主题变量配置。 |
| GET | `/api/cmo-database-config` | 读取 CMO DB3 路径配置与连接状态。 |
| PUT | `/api/cmo-database-config` | 负责人写入 `enabled` + `databasePath`（相对项目根或绝对路径）。 |
| POST | `/api/cmo-database-config/probe` | 探测候选路径是否为可读 CMO DB3 数据库文件。 |
| GET | `/api/cmo-catalog/status` | 公开 CMO 装备目录连接状态与平台总数。 |
| GET | `/api/cmo-catalog/mission-types` | CMO 对齐的任务类型受控枚举清单。 |
| GET | `/api/cmo-catalog/countries?q=` | 国家枚举模糊检索。 |
| GET | `/api/cmo-catalog/search?q=&domain=&country=&limit=` | 平台检索（aircraft/ship/submarine/ground/facility/satellite）。 |
| GET | `/api/cmo-catalog/platforms/{domain}/{cmoId}` | 单平台详情（研究级名称/类别/国家）。 |

> [!NOTE]
> AI 配置写入只接受端点/模型等参数，严禁承载密钥。API 密钥仅通过服务端安全进程环境变量（如 `OPENAI_API_KEY`）注入。CMO 库只读打开，不写回外部仿真数据库；平台引用仅作类型与职责参考，不输出真实武器用法或微观物理仿真参数。

## 项目资源

以下资源均支持 `GET` 与 `PUT`，写入体包含 `model`、`source`、`expectedRevision`；概念简报额外使用 `brief`、`direction`、可选 `inspiration`：

| 资源名称 | 资源键 / 路径 | 说明 |
|---|---|---|
| 概念简报 | `/api/projects/{id}/brief` | 研究意图、目标、边界、假设、效果、风险与知识证据引用。 |
| 阶段与行动 | `/api/projects/{id}/phase-action-concept` | 作战概念规划步骤 2；包含阶段链、时窗、蓝红主次行动与转换条件。 |
| 作战任务 | `/api/projects/{id}/ov1b` (任务整理) | 任务组整理，关联已有任务 ID，支持任务分组与排序；不创建独立孤立任务。 |
| 作战兵力 | `/api/projects/{id}/force-mission-plan` | 双层兵力编组：`forces`（概念兵力职责单元）与 `combatForces`（作战兵力，挂接 CMO 平台与任务）。 |
| 总体作战概念图 | `/api/projects/{id}/concept-graphic-plan` | 总体概念图规划；可自动种子化 OV-1。 |
| 作战概念图 | `/api/projects/{id}/concept-map` | 空间化相对布局表达，对接外部绘制工具（默认 8765 端口）。 |
| OV-1 | `/api/projects/{id}/ov1` | 高层作战概念总体视图（语义骨架与主体闭环）。 |
| OV-1c | `/api/projects/{id}/ov1c` | 任务与作战活动映射矩阵（Task to Activity Reference Mapping）。 |
| OV-2 | `/api/projects/{id}/ov2` | 作战资源流与信息交互图。 |
| OV-3 | `/api/projects/{id}/ov3` | 作战资源流交换矩阵。 |
| OV-4 | `/api/projects/{id}/ov4` | 组织关系与责任层级图（战区部队/作战部队/指挥机构分类与隶属/协同分类）。 |
| OV-5a | `/api/projects/{id}/ov5a` | 作战活动层次分解清单（引用父子分解，不建多份副本）。 |
| OV-5b / 活动机理 | `/api/projects/{id}/ov5` | 四维因果活动机理：杀伤网因果流、跨域协同同步矩阵、人机决策自主阶梯、体系抗毁对抗推演。 |
| OV-6a | `/api/projects/{id}/ov6a` | 逐条作战规则库与活动绑定（activityBindings）。 |
| OV-6b | `/api/projects/{id}/ov6b` | 多状态机模型（按任务/对象独立状态机，包含状态与事件迁移）。 |
| OV-6c | `/api/projects/{id}/ov6c` | 事件时序图（支持分阵营时序与逐阶段交互时序）。 |
| OV-7 | `/api/projects/{id}/ov7` | 状态机/迁移与作战活动映射矩阵（State/Transition to Activity Mapping）。 |
| Architecture | `/api/projects/{id}/architecture` | DoDAF 统一架构模型总库。 |
| OODA | `/api/projects/{id}/ooda` | OODA 决策循环模型，含时延预算、单点故障（SPOF）诊断与因果闭环。 |
| 自动想定 | `/api/projects/{id}/scenario` | 抽象百分比网格想定与部署编组。 |
| 设计验证 | `/api/projects/{id}/validation` | 静态规则校验、谱系有效性与红方质询记录。 |
| 知识 Vault | `/api/projects/{id}/knowledge` | Obsidian 知识库分片、文档图与向量索引。 |
| 研究对话 | `/api/projects/{id}/research-chats` | 项目作用域内各步骤通用研究对话会话历史持久化。 |

### 架构交换与知识检索

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/projects/{id}/architecture/export?format=json\|xml` | 导出符合 DoDAF 2.02 DM2 规范的架构交换包。 |
| POST | `/api/projects/{id}/architecture/import` | 导入 DoDAF 架构包；支持 `replace-products` 或 `merge-entities` 合并策略。 |
| GET | `/api/projects/{id}/knowledge/search` | 知识检索：支持 `mode=keyword\|vector\|hybrid`。默认排除敏感片段；`includeSensitive=true` 仅限服务器验证的负责人本地审阅。 |

## 归档、快照与审计

| 方法 | 路径 | 说明 |
|---|---|---|
| GET / POST | `/api/projects/{id}/reports` | 读取/创建成果报告归档。创建时包含冻结负载及 SHA-256 完整性清单。 |
| DELETE | `/api/projects/{id}/reports/{reportId}` | 负责人删除指定的报告归档项。 |
| GET / POST | `/api/projects/{id}/model-snapshots` | 读取/创建只读模型快照（包含版本对比与八项指标敏感性分析）。 |
| DELETE | `/api/projects/{id}/model-snapshots/{snapshotId}` | 负责人删除指定的模型快照。 |
| GET | `/api/projects/{id}/audit?limit={n}` | 读取受限公共审计日志流。 |

## 协同与敏感引用

| 方法 | 路径 | 权限/说明 |
|---|---|---|
| GET | `/api/projects/{id}/collaboration` | 获取当前协同审阅列表、修订差异与公开状态。 |
| POST | `/api/projects/{id}/collaboration/reviews` | 研究员/审阅员/负责人创建审阅单。证据仅接受公开 Vault 片段 ID。 |
| POST | `/api/projects/{id}/collaboration/reviews/{reviewId}/decision` | 负责人提交决议（通过/驳回/修改）；过期资源的审阅会被拒绝。 |
| GET / POST | `/api/projects/{id}/knowledge/sensitivity-approvals` | 读取/创建敏感片段报告引用审批。创建仅限负责人。 |
| DELETE | `/api/projects/{id}/knowledge/sensitivity-approvals/{approvalId}` | 负责人撤销敏感引用审批。 |
| POST | `/api/collaboration/auth/login` | 本地协同账号密码登录，下发 HttpOnly 会话 Cookie。 |
| POST | `/api/collaboration/auth/logout` | 退出本地协同会话。 |
| GET | `/api/collaboration/auth/session` | 获取当前活跃会话身份与角色列表。 |

## 文档导出

`POST /api/report-docx`、`POST /api/report-pdf`、`POST /api/report-pptx` 生成 Office/PDF 成果文档。当运行环境缺少交互式桌面渲染会话时，端点可能返回 `503`（提供浏览器原生导出作为降级替代），这不属于数据损坏或契约错误。

## 错误代码语义

- `400 Bad Request`：请求体格式错误、缺少必填字段或不符合模型 Schema。
- `403 Forbidden`：当前操作需要更高权限（如 lead 负责人角色）或未登录。
- `404 Not Found`：请求的项目、资源或归档项不存在。
- `409 Conflict`：乐观锁修订冲突（传入的 `expectedRevision` 与当前服务端版本不符），需刷新重试。
- `429 Too Many Requests`：登录重试频率触发本地节流保护。
- `503 Service Unavailable`：外部自动化依赖（如 Office 导出进程）暂时不可用。
