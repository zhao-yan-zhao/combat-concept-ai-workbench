# AGENTS.md

## 协作规则

- 本项目目标是建设“AI 作战概念研究工作台”，不是普通聊天工具。
- 优先围绕工作流设计功能：输入、知识检索、AI 生成、人工修订、评估、成果输出。
- 除非明确要求，概念图绘制只作为成果输出接口，不作为当前主要开发对象。
- OBS/Obsidian 知识库接入是核心能力，后续功能设计要保留引用溯源。
- 界面风格应保持简洁、克制、研究工具化，避免大屏化、炫技化和信息堆叠。
- 修改代码前先理解现有结构；当前可运行入口是 `node server.mjs`，不是独立静态 Demo。
- 代码按职责拆分到合适模块，避免把主要逻辑集中在单个文件中。
- 新增功能优先写清数据结构和工作流，再做界面表现。
- 文档保持短而可维护，避免重复长篇论述。
- 新增或修改实际发送给 AI 的提示词时，必须纳入顶部菜单“AI 提示词”的统一目录，分配稳定 ID、用途说明和动态变量说明，并确保编辑后的覆盖值进入真实 AI 请求；不得新增无法在该目录浏览和编辑的隐藏提示词。

## 排查与验证效能规则

- 交互与流程阻断优先排查前端门禁：按钮禁用或流程无法自动触发时，优先检查对应视图与控制器的业务门禁判断（disabled 条件、状态机流转），快速定位卡点；严禁脱离业务代码直接做底层 SQLite/存储结构盲目排查与数据考古。
- 代码调用链与影响面优先使用 codegraph：涉及跨视图/控制器流转、函数引用溯源或评估改动波及范围（Blast Radius）时，优先通过 MCP 工具 `codegraph`（`codegraph_explore`）单次拉取调用拓扑与关联符号，避免多轮盲目全文搜索与 Grep 循环。
- 验证遵循最小闭环，严禁全量盲跑：针对性运行与本次修改直接相关的测试脚本或新建轻量回归测试；严禁盲目批处理全量跑 `scripts/check-*.mjs`（易陷入历史演进用例干扰）。
- Mock 与本地断言优先：逻辑功能排查优先使用 Mock 或本地逻辑断言，非必须不频繁调用耗时漫长的真实大模型在线生成接口。
- 环境与既有断言注意：Windows 环境编辑注意换行符敏感度；调整公共入口调用时注意是否有既有测试脚本对源码进行静态字符串断言，避免破坏既有测试契约。

## 当前项目目录

```text
D:\项目\combat-concept-ai-workbench
```

## 代码布局（简）

- `server.mjs`：一行入口，加载 `server/app.mjs`
- `server/`：`createRuntime` + `createRequestHandler` + `routes/*` + 领域模块
- `shared/`：前后端共用库（`aiClient` / `knowledge` / `generator`）
- `design-studio/`：当前工作台 UI；壳层助手在 `design-studio/src/app/`（含 `wireControllers`）
- `src/`：已清空，勿再新增代码
- `scripts/`：验收与迁移脚本
- `archive/`：已退役代码、截图与一次性产物
- `references/`：仅说明；大体量开源参考在 `D:\项目\_references\combat-concept-ai-workbench-open-source`

## 服务与目录确认

- `http://127.0.0.1:8792/` 是当前配置真实 AI 的工作台根入口；`/design-studio/` 保留为兼容路径。`8791` 仅保留为旧的本地降级服务，不作为验收或开发目标。
- 端口号不代表代码版本。开始修改前必须确认当前目录为 `D:\项目\combat-concept-ai-workbench`，并以 `GET /api/health` 的服务状态确认验收目标。
- 当前 8792 源码备份归档位于 `D:\项目\_backups\combat-concept-ai-workbench-8792-20261011-force-resource-subflow.zip`。备份仅用于恢复，不在其中直接开发或启动服务；每次实质功能批次完成后更新此路径。

## 常用本地运行方式

```powershell
cd D:\项目\combat-concept-ai-workbench
$env:PORT = "8792"
node server.mjs
```

启动工作台时会尝试**独立进程**拉起外部概念图绘制工具（默认 `D:\项目\combat-map-web` → `http://127.0.0.1:8765/`）。两进程互不影响：绘制工具已在跑则跳过；工作台退出不停止绘制工具。可用 `CONCEPT_MAP_TOOL_ENABLED=false` 关闭自动启动，或用 `CONCEPT_MAP_TOOL_ROOT` / `CONCEPT_MAP_TOOL_PORT` 覆盖路径与端口。

默认持久化：

- 项目仓储：`data/projects.sqlite`（含 OV-1～OV-6c、architecture、OODA、想定、验证、知识、快照、报告、协同、审计）
- 协同身份：`data/collaboration-identities.sqlite`
- 若 SQLite 为空且存在 `data/projects.json`，启动时一次性导入数据库，之后以数据库为准
- 仅测试可设 `$env:PROJECT_STORAGE_MODE = "file"` 退回 JSON 文件

访问：

```text
http://127.0.0.1:8792/
```

健康检查（应见 `projectRepository.mode = "sqlite"`）：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8792/api/health
```

不要使用旧的 `8788` 纯静态页面方式作为验收入口。
