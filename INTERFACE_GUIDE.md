# 工作台 HTTP 接口指南

更新时间：2026-07-25。接口根路径为 `/api`，项目 ID 使用 URL 编码。所有 JSON 写入都应设置 `Content-Type: application/json`。规划段资源已纳入正式契约；除试用问题修复与规划链路扩展外，不无故改动既有资源形状。

## 通用约定

- 写入项目资源时传入 `expectedRevision`。服务端项目修订不一致返回 `409`；客户端应保留本地草稿，显式刷新或加载服务端版本，不自动覆盖。
- 当部署启用 `COLLABORATION_PROJECT_WRITE_AUTH=true` 时，项目写入和审计读取要求有效本地协同会话；缺少会话通常返回 `403`。
- 响应仅返回公开状态、资源修订、审计归属和受限模型数据；不得假定其中含密码、会话或密钥。

## 健康与 AI

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/health` | 读取公共运行状态、存储模式、检索模式和能力标记。默认 `projectRepository.mode=sqlite`（全部项目资源落库）；`durable=true` 表示数据库持久化。 |
| POST | `/api/generate` | 生成结构化研究草稿；当前配置不可用时可返回本地降级结果。 |
| POST | `/api/red-team` | 对当前抽象模型执行研究级红方质询。 |
| GET | `/api/ai-config` | 读取公共 AI 配置状态。 |
| PUT | `/api/ai-config` | 仅在显式启用写入且负责人已登录时可用；默认 `403`。 |
| GET | `/api/theme-config` | 读取主题变量。 |
| PUT | `/api/theme-config` | 负责人可写主题变量。 |
| GET | `/api/cmo-database-config` | 读取 CMO DB3 路径配置与连接状态。 |
| PUT | `/api/cmo-database-config` | 负责人写入 `enabled` + `databasePath`（相对项目根或绝对路径）。 |
| POST | `/api/cmo-database-config/probe` | 探测候选路径是否为可读 CMO DB3。 |
| GET | `/api/cmo-catalog/status` | 公开目录连接状态与平台计数。 |
| GET | `/api/cmo-catalog/mission-types` | CMO 对齐任务类型清单。 |
| GET | `/api/cmo-catalog/countries?q=` | 国家枚举检索。 |
| GET | `/api/cmo-catalog/search?q=&domain=&country=&limit=` | 平台检索（aircraft/ship/submarine/ground/facility/satellite）。 |
| GET | `/api/cmo-catalog/platforms/{domain}/{cmoId}` | 单平台详情（研究级名称/类别/国家）。 |

AI 配置写入只接受端点/模型等配置，不会也不应承载密钥。密钥仅来自服务进程环境。CMO 库只读打开，不写回仿真数据库；平台引用仅作类型参考，不输出武器用法或性能参数。

灵感面板的“咨询助手”复用 `POST /api/generate`，但客户端会以 `concept` 工作流和受限研究问答上下文调用。每次问答仅追加有界的 `consultation` 用户问题/助手建议；不自动修改概念简报、模型、想定或结论。AI 不可用时，客户端记录本地研究级复核建议。

## 项目资源

以下资源均支持 `GET` 与 `PUT`，写入体包含 `model`、`source`、`expectedRevision`；概念简报使用 `brief`、`direction`、可选 `inspiration`：

| 资源 | 路径 | 说明 |
|---|---|---|
| 概念简报 | `/api/projects/{id}/brief` | 研究准备；上游变更会使规划段资源过期 |
| 阶段与行动 | `/api/projects/{id}/phase-action-concept` | 作战概念规划步骤 1（简报后优先）；谱系依赖 brief |
| 兵力与任务 | `/api/projects/{id}/force-mission-plan` | 规划步骤 3（简报→阶段后）；谱系依赖 brief + phaseActionConcept；`status: empty\|draft\|confirmed`；含 `forces`（概念兵力）与 `combatForces`（作战兵力，可挂 `conceptForceId`）；任务 `missionType` + 可选 `platforms[]` |
| 作战概念图 | `/api/projects/{id}/concept-map` | 规划步骤 4（导航 04）；依赖外部绘制工具（默认 8765）；仅向下游暴露确认后的 OV 参考语义，不传原始坐标/编辑器私有载荷 |
| 总体作战概念图 | `/api/projects/{id}/concept-graphic-plan` | 规划步骤 5（导航 05）；确认后可编译/种子化 OV-1 |
| OV-1 | `/api/projects/{id}/ov1` | 正式总体概念；谱系可挂 conceptMap / conceptGraphicPlan |
| OV-2 | `/api/projects/{id}/ov2` | |
| OV-3 | `/api/projects/{id}/ov3` | |
| OV-4 | `/api/projects/{id}/ov4` | |
| OV-5a | `/api/projects/{id}/ov5a` | |
| OV-5b | `/api/projects/{id}/ov5` | |
| OV-6a | `/api/projects/{id}/ov6a` | |
| OV-6b | `/api/projects/{id}/ov6b` | |
| OV-6c | `/api/projects/{id}/ov6c` | |
| Architecture | `/api/projects/{id}/architecture` | |
| OODA | `/api/projects/{id}/ooda` | |
| 自动想定 | `/api/projects/{id}/scenario` | |
| 设计验证 | `/api/projects/{id}/validation` | |
| 知识 Vault | `/api/projects/{id}/knowledge` | |

### 作战概念规划资源要点

- 工作流大阶段「作战概念规划」对应 `workflowStage = 1`，资源：`forceMissionPlan`、`phaseActionConcept`、`conceptMap`、`conceptGraphicPlan`。
- 真实内容变更会撤销本阶段及后续确认；幂等保存不撤销。
- AI 生成主路径使用 `POST /api/generate`，`outputSchema` 可为：
  - `CombatFocusOptions`（作战聚焦 3 候选，阶段生成前先选）
  - `ForceMissionPlan`
  - `PhaseActionConcept`
  - `ConceptMapInitialPlan`（模糊图初图）
  - `ConceptGraphicPlan`（总体概念图）
  - `OperationalConceptGraphic`（OV-1）
- 下游 OV AI 上下文只消费已确认规划语义；模糊图原始 `document.items`、坐标、CMO 文件名不得作为 OV 输入。

DoDAF 2.02 / DM2 架构交换：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/projects/{id}/architecture/export?format=json\|xml` | 导出作战视图架构包 |
| POST | `/api/projects/{id}/architecture/import` | 导入架构包；体含 `package`/`body`、`format`、`mergeStrategy`（`replace-products` \| `merge-entities`）、`expectedRevision` |

产品模型统一包含 `schema: "dodaf-2.02-dm2-ov"`、`entities[]`、`relations[]` 及产品投影字段。共享契约见 `shared/dodaf/`。

知识检索：`GET /api/projects/{id}/knowledge/search?q={query}&limit={n}&mode=keyword|vector|hybrid`。默认排除敏感片段；`includeSensitive=true` 仅限服务器验证的负责人本地审阅，不应作为 AI、红方或普通导出路径。

## 归档、快照与审计

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST | `/api/projects/{id}/reports` | 读取/创建报告归档。POST 应包含冻结负载及其 SHA-256 清单。 |
| DELETE | `/api/projects/{id}/reports/{reportId}` | 删除归档项。 |
| GET/POST | `/api/projects/{id}/model-snapshots` | 读取/创建模型快照。 |
| DELETE | `/api/projects/{id}/model-snapshots/{snapshotId}` | 删除模型快照。 |
| GET | `/api/projects/{id}/audit?limit={n}` | 读取受限公共审计项。 |

归档清单用于检测负载不一致，不是数字签名、授权证明或防篡改存储。

## 协同与敏感引用

| 方法 | 路径 | 权限/说明 |
|---|---|---|
| GET | `/api/projects/{id}/collaboration` | 协同审阅、修订和公开状态。 |
| POST | `/api/projects/{id}/collaboration/reviews` | 研究员/审阅员/负责人创建审阅。证据仅接受当前公开 Vault 片段 ID。 |
| POST | `/api/projects/{id}/collaboration/reviews/{reviewId}/decision` | 仅负责人决议；接受旧资源审阅会被拒绝。 |
| GET/POST | `/api/projects/{id}/knowledge/sensitivity-approvals` | 读取/创建敏感片段报告引用审批。POST 仅负责人。 |
| DELETE | `/api/projects/{id}/knowledge/sensitivity-approvals/{approvalId}` | 仅负责人撤销审批。 |

协同身份接口：`/api/collaboration/auth/session`、`setup`、`login`、`logout`、`accounts`、`accounts/{username}`、`security-events`。本地密码会话使用 HttpOnly Cookie；调用方不应读取、记录或转发 Cookie。

## 文档生成

`POST /api/report-docx`、`/api/report-pdf`、`/api/report-pptx` 生成 Office/PDF 成果。后台运行环境没有交互式桌面会话时可能返回 `503`；这不是项目数据或模型错误。

## 试用时的错误处理

- `400`：结构或字段不符合受限模型契约。
- `403`：缺少会话、角色或部署期开关。
- `409`：项目/资源修订已变化，或审阅目标已过期。
- `429`：本地登录节流。
- `503`：Office 自动化运行条件不足。

真实字段边界以 `projectModelNormalizers.mjs`、`projectRepository.mjs`、`server.mjs` 和相应 `scripts/check-*.mjs` 为准。
