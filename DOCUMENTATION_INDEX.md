# 文档索引与维护指南

更新时间：2026-10-30。当前实现状态以 `project-context.md` 为唯一绝对交接基准。

---

## 1. 第一级：绝对当前基线（最高权威，开发与排查必读）

| 文档 | 读者 | 核心职责 |
|---|---|---|
| [`AGENTS.md`](AGENTS.md) | 所有开发 AI 与工程师 | 开发铁律、改动防退化（改 A 严防坏 B）、端口配置（8792）、提示词管理规范与 codegraph 探索规范。 |
| [`project-context.md`](project-context.md) | 后续开发会话 | 唯一真实交接状态、已落地功能（含 2026-10-30 活动机理重构等）、变更史与当前基线。 |
| [`INTERFACE_GUIDE.md`](INTERFACE_GUIDE.md) | 前后端开发 / 集成测试 | 当前服务端全部 HTTP 路由契约、DoDAF 资源读写、提示词管理、权限边界与错误处理。 |
| [`README.md`](README.md) | 所有人 | 项目概述、推荐一键启动脚本（`start.bat` / `start.ps1` / `start.sh`）、服务健康检查。 |

---

## 2. 第二级：领域业务参考（研发与业务设计查阅）

| 文档 | 范畴 | 说明 |
|---|---|---|
| [`plans/WORKFLOW_MAINLINE_MODEL_TOPOLOGY.md`](plans/WORKFLOW_MAINLINE_MODEL_TOPOLOGY.md) | 流程架构 | 七步主线（简报、阶段行动、作战任务、作战兵力、总体图、概念图、仿真演示）、关联模型动态拓扑与谱系失效传播机制。 |
| [`plans/FORCE_MISSION_CMO.md`](plans/FORCE_MISSION_CMO.md) | 兵力与装备 | 概念兵力与作战兵力双层编组模型、只读 CMO DB3 装备库对齐、平台推荐与任务类型映射。 |
| [`plans/AI_RESEARCH_CHAT.md`](plans/AI_RESEARCH_CHAT.md) | AI 交互 | 通用 AI 研究对话壳、流式补丁、多轮会话管理、各步骤适配器及非对话生成边界。 |
| [`plans/OV6_PRODUCT_MODEL.md`](plans/OV6_PRODUCT_MODEL.md) | 动态模型 | 规则库 (OV-6a)、状态机 (OV-6b) 与时序图 (OV-6c) 数据形状与多阵营/逐阶段时序模型。 |
| [`SOFTWARE_DESIGN.md`](SOFTWARE_DESIGN.md) | 架构设计 | 目标系统完整架构设计、原生 SQLite 持久化与当前原型已实现能力映射。 |
| [`TRIAL_GUIDE.md`](TRIAL_GUIDE.md) | 业务试用 | 面向业务人员的完整试用步骤、七步主线与 OV-5 四维因果动态工作台操作要点。 |
| [`CHANGELOG.md`](CHANGELOG.md) | 版本日志 | 项目演进全量里程碑与核心功能变更追溯。 |

---

## 3. 第三级：远期演进与历史基线参考（仅作需求追溯，严禁作为现状依据）

| 文档 | 类型 | 说明 |
|---|---|---|
| [`plans/PROJECT_STORAGE_MIGRATION.md`](plans/PROJECT_STORAGE_MIGRATION.md) | 远期方案 | PostgreSQL/PostGIS 远期迁移方案与文件/SQLite 迁移脚本说明；当前默认运行环境为原生 SQLite。 |
| [`plans/OIDC_DEPLOYMENT.md`](plans/OIDC_DEPLOYMENT.md) | 远期方案 | 企业级 OIDC 接入与令牌流验证规范；当前浏览器令牌流未启用，使用本地协同账号体系。 |
| [`plans/RESEARCH_WORKFLOW_18.md`](plans/RESEARCH_WORKFLOW_18.md) | 历史归档 | 早期 18 步线性流程与强弱门禁记录，仅作早期设计需求追溯，不作为当前导航与开发目标。 |
| [`archive/README.md`](archive/README.md) | 归档说明 | 历史静态 Demo、早期控制器与一次性产物归档说明。 |

---

## 4. 模块与包级说明

| 路径 | 说明 |
|---|---|
| [`server/README.md`](server/README.md) | 服务端入口、运行时创建、路由分工及数据目录说明。 |
| [`shared/README.md`](shared/README.md) | 前后端共用领域库（AI 客户端、知识检索、DoDAF 产品标准）。 |
| [`shared/dodaf/README.md`](shared/dodaf/README.md) | DoDAF 2.02 / DM2 作战视图标准子集规范、资源键与 XML/JSON 交换契约。 |
| [`design-studio/src/app/README.md`](design-studio/src/app/README.md) | 工作台前端壳层模块（状态初始化、DOM 工具、流程门禁、控制器装配）。 |
| [`design-studio/vendor/NOTICE.md`](design-studio/vendor/NOTICE.md) | 第三方依赖开源许可证声明（Drawflow、Mermaid、js-sequence-diagrams 等）。 |
| [`output/README.md`](output/README.md) | 验收与试用当前输出产物说明。 |
| [`references/README.md`](references/README.md) | 大体量开源参考资料外置路径说明。 |
| [`.jeikcode/rules.md`](.jeikcode/rules.md) | 业务硬性约束、AI 提示词零隐藏原则与门禁规则。 |
| [`.jeikcode/glossary.md`](.jeikcode/glossary.md) | 领域专用术语与简称对照表。 |
| [`.jeikcode/dbwords.md`](.jeikcode/dbwords.md) | 数据库与持久化字段标准词汇表。 |

---

## 5. 文档维护铁律

1. **零隐藏提示词同步**：新增或修改任何实际发送给 AI 的提示词时，必须同步纳入 `server/aiPromptConfig.mjs`并在顶部菜单展示，禁止出现文档与代码不一致的隐藏提示词。
2. **HTTP 契约一致性**：新增或改动服务端路由、请求参数、状态码或资源类型时，必须同步更新 [`INTERFACE_GUIDE.md`](INTERFACE_GUIDE.md)。
3. **架构与模型同步**：七步主线、DoDAF 资源扩展或视图结构发生变化时，必须同步更新 [`SOFTWARE_DESIGN.md`](SOFTWARE_DESIGN.md) 和 [`plans/WORKFLOW_MAINLINE_MODEL_TOPOLOGY.md`](plans/WORKFLOW_MAINLINE_MODEL_TOPOLOGY.md)。
4. **交接基线沉淀**：每个实质功能批次完成后，必须在 [`project-context.md`](project-context.md) 顶部记录改动、验证结果与遗留项，并按需增补 [`CHANGELOG.md`](CHANGELOG.md)。
