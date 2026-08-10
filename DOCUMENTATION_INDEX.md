# 文档索引与维护状态

更新时间：2026-07-16。开发处于业务逐项试用暂停期。

## 当前必须阅读

| 文档 | 读者 | 状态 |
|---|---|---|
| `README.md` | 所有人 | 当前入口与运行状态。 |
| `TRIAL_GUIDE.md` | 业务试用人员 | 当前试用流程和反馈要求。 |
| `INTERFACE_GUIDE.md` | 集成/运维/测试人员 | 当前 HTTP 契约和权限边界。 |
| `project-context.md` | 后续开发会话 | 唯一当前交接状态和变更基线。 |
| `SOFTWARE_DESIGN.md` | 产品/架构人员 | 目标设计与已实现映射。 |

## 部署与存储参考

| 文档 | 状态 | 说明 |
|---|---|---|
| `plans/PROJECT_STORAGE_MIGRATION.md` | 参考方案 | PostgreSQL/PostGIS 迁移准备；不是当前运行必需条件。 |
| `plans/OIDC_DEPLOYMENT.md` | 参考方案 | OIDC 验证器与部署边界；浏览器令牌流尚未启用。 |
| `plans/FORCE_MISSION_CMO.md` | 功能说明 + backlog | 兵力与任务（概念/作战）、CMO DB3、平台推荐与改善清单。 |

## 历史规划资料

以下文件记录早期拆分规划或静态 Demo 阶段，不能覆盖当前交接和接口文档：

- `plans/historical/FUNCTION_PLAN.md`
- `plans/historical/TECHNICAL_IMPLEMENTATION_PLAN.md`
- `plans/historical/PLAN-01-project-workbench.md`
- `plans/historical/PLAN-02-scenario-and-knowledge.md`
- `plans/historical/PLAN-03-ai-generation-and-templates.md`
- `plans/historical/PLAN-04-evaluation-and-export.md`
- `plans/historical/SESSION_PROMPTS.md`
- `plans/historical/SESSION_STATUS.md`

保留它们用于追溯需求来源；开始新开发或处理试用问题时，先以 `project-context.md`、`TRIAL_GUIDE.md`、`INTERFACE_GUIDE.md` 和当前代码为准。

## 文档维护规则

- 业务试用结论更新 `TRIAL_GUIDE.md` 或 `project-context.md`，不要重写历史计划。
- 改动 HTTP 路由、权限、修订或错误语义时同步更新 `INTERFACE_GUIDE.md`。
- 改动能力范围、设计边界或已实现映射时同步更新 `SOFTWARE_DESIGN.md`。
- 每个实质开发批次完成后更新 `project-context.md`，包含改动、验证、剩余任务和阻塞项。
- 旧静态 Demo 与历史验收产物位于 `archive/`；当前输出写入 `output/`，不将临时产物长期留在根目录。
