# 作战概念研究工作台

内网研究原型，用于将研究灵感逐步整理为可审查的概念简报、DoDAF 派生视图、抽象想定、设计验证和可归档成果。

当前试用地址：`http://127.0.0.1:8792/`。

## 当前状态

- 当前处于业务逐项试用暂停期；除基于试用发现的修复外，不扩展新功能。
- 当前主链：`AI 灵感 -> 概念简报 -> OV-1 -> OV-5 -> OODA -> 自动想定/部署 -> 设计验证/红方 -> 成果导出`。
- 已实现只读 OV-2、OV-3、OV-4、OV-6c 派生视图，以及版本、审计、快照、报告归档和本地协同审阅。
- 所有空间、部署和仿真数据仅为抽象研究级百分比网格表达；重型仿真平台未接入。
- 最近完整基线：以 `scripts/check-*.mjs` 验收脚本为准。
- 代码布局：`server.mjs` → `server/app.mjs`；领域与 HTTP 工具在 `server/`；共享库在 `shared/`；UI 在 `design-studio/`（壳层在 `design-studio/src/app/`）。

## 开始试用

在 PowerShell 中执行：

```powershell
cd D:\项目\combat-concept-ai-workbench
$env:PORT = "8792"
node server.mjs
```

启动后工作台会尝试独立拉起概念图绘制工具（默认 `http://127.0.0.1:8765/`，进程互不影响）。打开 `http://127.0.0.1:8792/`，并确认服务健康：

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
| [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) | 全部文档的状态、读者和使用顺序。 |
| [TRIAL_GUIDE.md](TRIAL_GUIDE.md) | 业务试用步骤、边界和反馈格式。 |
| [INTERFACE_GUIDE.md](INTERFACE_GUIDE.md) | 服务端 HTTP 接口、权限、冲突与错误处理。 |
| [SOFTWARE_DESIGN.md](SOFTWARE_DESIGN.md) | 目标架构与当前原型映射。 |
| [project-context.md](project-context.md) | 当前交接、暂停点、变更史与阻塞项。 |
| [plans/PROJECT_STORAGE_MIGRATION.md](plans/PROJECT_STORAGE_MIGRATION.md) | 文件/SQLite 到生产存储的迁移准备方案。 |
| [plans/OIDC_DEPLOYMENT.md](plans/OIDC_DEPLOYMENT.md) | OIDC 部署边界；当前未启用浏览器令牌流。 |

## 试用限制

- AI 真实生成依赖安全启动的服务进程环境；密钥不写入文件或文档。
- 浏览器自动化运行脚本缺失，当前使用静态 HTTP 检查和 Node 验收脚本。
- Office 自动化端点在缺少交互式桌面会话时可能返回 `503`。
- 默认本地试用不强制项目写入登录；部署可选择启用认证写入。

通用壳 design-studio/src/researchChat/
文件	职责
researchChatStore.js	消息模型、pending 打字泡、begin/complete、持久化
researchChatView.js	对话面板 + 右上悬浮钮 + 滚动
researchChatController.js	submit / 编辑 / 重试 / 乐观更新
index.js	统一导出与复用说明
已挂接步骤
步骤	适配方式
简报	inspirationView / inspirationAdviceController → 壳；业务仍在 inspiration + brief 更新
阶段与行动	phaseActionView / phaseActionChatController → 同一壳；runTurn 改 PhaseActionConcept

以后新步骤怎么复用
不用再改气泡/样式，只加适配器：

createResearchChatController({
  scope: "force-mission",
  getSession / setSession,
  isGenerating / setGenerating,
  runTurn: async ({ question, state }) => {
    // 调 AI + 改业务模型
    return { advice, source: "ai", notifyMessage: "…" };
  }
});
界面：

renderResearchChatPanel({ scope: "force-mission", session, generating, ... })
// 需要悬浮时：
renderResearchChatFloatButton({ scope: "force-mission", action: 