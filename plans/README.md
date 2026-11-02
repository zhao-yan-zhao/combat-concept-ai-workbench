# 规划文档说明

更新时间：2026-10-30。当前实现状态以根目录 `../project-context.md` 为唯一绝对交接基准。

## 当前领域业务参考

| 文档 | 状态 | 说明 |
|---|---|---|
| `WORKFLOW_MAINLINE_MODEL_TOPOLOGY.md` | 已落地（核心基线） | 七步主线（简报、阶段行动、作战任务、作战兵力、总体图、概念图、仿真演示）、关联模型拓扑与失效传播机制。 |
| `FORCE_MISSION_CMO.md` | 已落地 | 兵力与任务双层编组（概念兵力/作战兵力）、CMO DB3 装备库与平台推荐。 |
| `AI_RESEARCH_CHAT.md` | 已落地 | AI 研究对话通用壳、流式补丁、多轮会话管理与各步骤适配规范。 |
| `OV6_PRODUCT_MODEL.md` | 已落地 | 规则库 (OV-6a)、状态机 (OV-6b)、时序图 (OV-6c) 动态模型与多阵营/逐阶段时序。 |

## 远期演进与历史基线参考

| 文档 | 类型 | 说明 |
|---|---|---|
| `PROJECT_STORAGE_MIGRATION.md` | 远期方案 | PostgreSQL/PostGIS 远期迁移准备与原生 SQLite 迁移命令参考；当前默认存储为原生 SQLite (`data/projects.sqlite`)。 |
| `OIDC_DEPLOYMENT.md` | 远期方案 | 企业级 OIDC 部署边界与身份验证规范；当前浏览器令牌流未启用，默认使用本地协同身份 (`data/collaboration-identities.sqlite`)。 |
| `RESEARCH_WORKFLOW_18.md` | 历史归档 | 早期 18 步线性流与门禁记录，仅作需求追溯，不作为当前导航与开发目标。 |

## 查阅原则

- 进行开发与排查时，必须优先以根目录 `AGENTS.md`、`project-context.md`、`INTERFACE_GUIDE.md`、`README.md` 与实际代码为准。
- 业务领域涉及具体七步主线、模型拓扑、CMO 目录或研究对话时，查阅对应的领域业务参考文档。
- 历史归档与远期参考文档仅用于回溯设计动机或生产部署准备，严禁作为现状依据。
