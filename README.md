# 作战概念研究工作台

内网研究原型，用于将研究灵感逐步整理为可审查的概念简报、DoDAF 派生视图、抽象想定、设计验证和可归档成果。

当前试用地址：`http://127.0.0.1:8792/`。

## 当前状态

- **核心架构**：采用“七步主线 + 关联模型动态拓扑”：
  - **主线**：`01 概念简报 (brief) -> 02 阶段行动 (phase-action) -> 03 作战任务 (operational-task) -> 04 作战兵力 (force-mission) -> 05 总体图 (ov1) -> 06 概念图 (concept-map) -> 07 仿真演示 (scenario/validation)`。
  - **关联模型**：沿主线动态挂接 OV-1b（任务组整理）、OV-1c（任务-活动映射）、OV-2（作战资源流）、OV-3（资源流矩阵）、OV-4（组织层级与责任）、OV-5a（活动分解）、OV-5b（四维因果活动机理：杀伤网因果流、跨域协同同步矩阵、人机决策自主阶梯、体系抗毁推演）、OV-6a（规则库）、OV-6b（状态机）、OV-6c（分阵营与逐阶段时序图）、OV-7（状态-活动映射）。
- **AI 提示词资产管理**：全量 21 个生产提示词统一纳入顶部菜单“工具 → AI 提示词”，支持可视化浏览、自定义编辑、动态变量说明与一键恢复默认。
- **持久化引擎**：默认使用 Node.js 原生 SQLite 引擎：`data/projects.sqlite`（全量项目数据）与 `data/collaboration-identities.sqlite`（协同身份）。
- **装备库参考**：集成只读 CMO（Command: Modern Operations）DB3 数据库（`data/DB3K_510.db3`），支持平台检索与装备推荐。
- **代码布局**：`server.mjs` → `server/app.mjs`；领域与 HTTP 工具在 `server/`；共享库在 `shared/`；UI 在 `design-studio/`（壳层在 `design-studio/src/app/`）。

## 快速启动

本工作台提供了一键启动与环境自检脚本，支持 Windows 双击、PowerShell 参数化启动以及跨平台 Shell：

### 方式一：Windows 双击一键启动（推荐）
直接双击项目根目录下的 **`start.bat`**：
- 自动检测 Node.js 版本（建议 v22.5.0+ 或 v24+，以支持原生 SQLite 引擎）；
- 自动检查端口 8792 占用状态（若已在运行则直接打开浏览器，避免重复启动冲突）；
- 自动检查本地 SQLite 数据库、CMO 装备库与概念图工具路径；
- 服务就绪后**自动在默认浏览器中打开** `http://127.0.0.1:8792/`。

若需停止服务，可双击 **`stop.bat`** 安全释放 8792 端口。

### 方式二：PowerShell 终端启动
```powershell
# 1. 默认快速启动 (8792 端口，就绪后自动拉起浏览器)
.\start.ps1

# 2. 常用参数选项
.\start.ps1 -Port 8793 -NoBrowser     # 自定义端口且不自动打开浏览器
.\start.ps1 -CheckOnly                # 纯环境依赖检查模式
.\start.ps1 -StorageMode file         # 测试模式使用 JSON 文件存储

# 3. 停止服务
.\stop.ps1                            # 停止 8792 端口服务
.\stop.ps1 -All                       # 同时停止 8792 工作台与 8765 概念图工具
```

### 方式三：跨平台 Shell 启动 (Git Bash / Linux / macOS)
```bash
chmod +x start.sh
./start.sh                           # 默认启动并自动拉起浏览器
./start.sh 8793 --no-browser         # 自定义端口
./start.sh --check-only              # 仅执行环境检测
```

### 方式四：手动传统方式
在 PowerShell 中执行：

```powershell
cd D:\项目\combat-concept-ai-workbench
$env:PORT = "8792"
node server.mjs
```

启动后工作台会尝试独立拉起概念图绘制工具（默认 `http://127.0.0.1:8765/`，进程互不影响）。浏览器访问 `http://127.0.0.1:8792/`，并可随时确认服务健康：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8792/api/health
```

不要使用旧的 `8788` 静态页面方式。未通过批准的安全进程环境提供 AI 凭据时，工作台仍可试用本地功能，但 AI 会处于降级模式；不要把凭据写入命令、文件或配置。

接着：

1. 按 [TRIAL_GUIDE.md](TRIAL_GUIDE.md) 的顺序试用。
2. 需要了解 HTTP 契约、权限、版本冲突或归档时，阅读 [INTERFACE_GUIDE.md](INTERFACE_GUIDE.md)。
3. 需要继续开发前，先阅读 [project-context.md](project-context.md)。

不要在输入、导出、日志、问题记录或会话中放入 API 密钥、密码、Cookie 或敏感 Vault 正文。

## 文档入口

| 文档 | 用途 |
|---|---|
| [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) | 全量文档索引、三级权威梯队与使用指南。 |
| [AGENTS.md](AGENTS.md) | 研发铁律、改动防退化规范与提示词约束。 |
| [TRIAL_GUIDE.md](TRIAL_GUIDE.md) | 业务试用步骤、七步主线、OV-5 活动机理操作与反馈格式。 |
| [INTERFACE_GUIDE.md](INTERFACE_GUIDE.md) | 服务端 HTTP 接口、DoDAF 资源读写、提示词管理与权限边界。 |
| [SOFTWARE_DESIGN.md](SOFTWARE_DESIGN.md) | 完整架构设计与当前原型映射。 |
| [project-context.md](project-context.md) | 当前唯一交接状态、已落地功能与变更史。 |
| [plans/WORKFLOW_MAINLINE_MODEL_TOPOLOGY.md](plans/WORKFLOW_MAINLINE_MODEL_TOPOLOGY.md) | 七步主线与关联模型拓扑开发规范。 |
| [plans/FORCE_MISSION_CMO.md](plans/FORCE_MISSION_CMO.md) | 兵力任务双层编组与 CMO 装备库集成说明。 |
| [plans/AI_RESEARCH_CHAT.md](plans/AI_RESEARCH_CHAT.md) | AI 研究对话通用壳与流式适配规范。 |

## 试用限制

- AI 真实生成依赖安全启动的服务进程环境；密钥不写入文件或文档。
- 浏览器自动化运行脚本缺失，当前使用静态 HTTP 检查和 Node 验收脚本。
- Office 自动化端点在缺少交互式桌面会话时可能返回 `503`。
- 默认本地试用不强制项目写入登录；部署可选择启用认证写入。
 