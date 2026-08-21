# AI 研究对话：已通用能力与步骤适配

更新时间：2026-08-20。实现以代码为准。

工作台里「像 ChatGPT 那样发一句、收一条」的界面，已经抽成一套共用壳，而不是各步骤各自画气泡。新步骤不要再复制消息列表、输入框或打字状态。

## 结论

| 层级 | 位置 | 是否通用 |
|---|---|---|
| 消息模型 / pending / 截断 / 停止 | `design-studio/src/researchChat/researchChatStore.js` | 已通用 |
| 面板、气泡、输入框、停止钮、悬浮钮 | `design-studio/src/researchChat/researchChatView.js` | 已通用 |
| 发送 / 编辑 / 重试 / 停止 / 流式补丁 | `design-studio/src/researchChat/researchChatController.js` | 已通用 |
| 步骤 store 工厂 + `setSession` 归约 | `createResearchChatStepStore` / `createResearchChatSessionApplier` | 已通用 |
| 项目仓储同步 | `researchChatProjectSync.js` + `researchChats` 资源 | 步骤对话已通用；简报对话走简报 API |
| 侧栏开合、页脚确认钮、AI 写回业务模型 | 各步骤 View / ChatController | **不通用，应保持适配器** |

入口：`design-studio/src/researchChat/index.js`。

验收：`scripts/check-research-chat-shell.mjs`。

## 共用壳做什么

一次对话轮次的标准路径：

1. 用户在输入框发送（Enter 发送，Shift+Enter 换行）。
2. 乐观追加「研究人员」气泡 + 「分析中」助手气泡。
3. `runTurn` 调 AI（应把 `signal` 传给 `generateWithAiStream`，才能真正停止）。
4. 流式预览用 `patchResearchChatStream` 就地改 DOM，避免整页重绘。
5. 完成 / 失败 / 取消都会收掉 pending，线程不会卡在「分析中」。
6. 用户消息可编辑后重发；助手消息可重新生成。

会话字段：`version`、`messages[]`。单条消息含 `id`、`role`（`user`/`assistant`）、`topic`、`source`（`ai|local|error|cancelled`）、`text`、`pending`、`truncated`、`jobId`、`createdAt`。

默认上限：简报咨询 48 条；步骤修订 24 条；单条约 800 字。

## 已挂接的对话步骤

六处界面都渲染同一套 `renderResearchChatPanel`。差别只在文案、`scope`、`topic` 和 `runTurn` 写回什么模型。

| 步骤 | 界面位置 | scope | topic | Store / Controller / View | AI 写回 |
|---|---|---|---|---|---|
| 概念简报 · 研究对话 | 主栏全宽 | `brief` | `consultation` | `inspirationStore` + `inspirationAdviceController` + `inspirationView` | 自然语言答复；命中字段时补丁简报 |
| 阶段与行动 | 右侧核验栏 + 顶栏悬浮钮 | `phase-action` | `revision` | `phaseActionChat*` | 完整 `PhaseActionConcept` |
| 兵力与任务 | 同上（复用 `phase-chat-dock`） | `force-mission` | `revision` | `forceMissionChat*` | 完整 `ForceMissionPlan` |
| 规则库 | 右侧 `rule-chat-dock` | `rule-library` | `revision` | `ruleLibraryChat*` | 有草稿则写 OV-6a；纯咨询只回对话 |
| 时序校验 | 右侧 `seq-chat-dock` | `sequence` | `revision` | `sequenceChat*` + `ov6cView` | 有草稿则写 OV-6c |
| 状态机校验 | 右侧 `sm-chat-dock` | `state-machine` | `revision` | `stateMachineChat*` + `stateMachineView` | 有草稿则写 OV-6b |

两种用法：

- **咨询型（简报）**：讨论概念、假设、约束；回答短、可复核；不整页重写模型。上下文用「较早摘要 + 最近原文」。
- **修订型（其余五步）**：先有中间栏草案，再自然语言改模型。发送前常有门槛（未生成 / 生成中 / 已确认）。

规则库控制器额外带 `pregenerateFromBrief`、`proposeChanges`：这是进入步骤时的后台生成，不是对话气泡，不要塞进通用壳。

## 像 AI、但不是对话的模块

下面是按钮一次生成，不是消息线程。不要改成 Chat，除非产品明确要求多轮修订。

| 模块 | 触发 | 说明 |
|---|---|---|
| `briefController` | 生成/整理简报 | 表单产出，不是对话 |
| `aiDirectionController` | 生成概念方向 | 卡片提案 |
| `conceptPlanningController` | 作战聚焦等 | 规划步骤按钮 |
| `ov1AiController` | 生成高层概念图 | 有研究主体兵力时甚至不走自由生成 |
| `ov5AiController` | 生成活动模型 | 一次出稿 |
| `oodaAiController` | 生成研究循环 | 一次出稿 |
| `dodafProductController` | 任务整理、组织、OV-6 预生成 | 工作台按钮 / 流式生成 |
| `redTeamController` | 红方质询 | 验证结果上的一次审查 |

## 新步骤怎么接

不要复制气泡或 CSS。按这个顺序加适配器：

```text
1. createResearchChatStepStore({ storagePrefix, topic, defaultWelcome, buildWelcome })
2. createResearchChatSessionApplier({ key, projectId, store })
3. renderResearchChatPanel / 需要时 renderResearchChatFloatButton
4. createResearchChatController({ scope, getSession, setSession, runTurn, canSend })
5. 修订型：把 session 登记进 researchChatProjectSync 的 capture / apply
```

`runTurn` 是唯一必须写业务的地方。约定：

```js
createResearchChatController({
  scope: "your-step",
  topic: "revision",          // 咨询用 consultation
  getSession: (state) => state.yourChat,
  setSession: applySession,   // 用 SessionApplier，不要手写 begin/complete
  isGenerating: (state) => Boolean(state.yourChatGenerating),
  setGenerating: (state, value) => { state.yourChatGenerating = Boolean(value); },
  canSend: (state) => true,   // 或 { ok: false, reason: "…" }
  runTurn: async ({ question, state, signal, onDelta, onJob, resumeJobId }) => {
    // 调 generateWithAiStream，传入 signal / onJob / onDelta
    // 成功则写业务模型，返回 { advice, source: "ai", notifyMessage }
  }
});
```

`scope` 必须在页面内唯一，用来绑定 `data-research-chat-*`。

## 已经重复、尚未抽齐的部分

这些看起来一样，但还没有收进 `researchChat/`：

1. **右侧对话栏开合**  
   `phase-chat-dock` / `rule-chat-dock` / `seq-chat-dock` / `sm-chat-dock` 结构相近，CSS 各写一份。顶栏 `toggle-*-chat` / `close-*-chat` 在 `main.js` 里也是同类分支。

2. **步骤 store 薄封装**  
   `phaseActionChatStore` 等五个文件几乎只是 `createResearchChatStepStore` 的别名导出。可以保留（欢迎语不同），不要再复制 begin/complete 逻辑。

3. **简报仍用 `inspirationStore`**  
   View/Controller 已走通用壳，但会话仍带旧的 `stage` / follow-up 引导，并走简报 API 而不是 `researchChats`。分层压缩也只在简报咨询里用。不要为了整齐强行合并，除非要改简报工作流。

4. **样式类名混用**  
   气泡仍叫 `inspiration-message`，面板叫 `research-chat-panel`。改名会动大量 CSS，不是当前优先项。

后续若要再抽，优先做「可开合的对话侧栏」布局辅助，而不是再做一套消息组件。

## 不要做的事

- 不要新增隐藏提示词；对话用的 workflow 标题 / schema 必须能在「AI 提示词」目录里看到和改。
- 不要把一次生成按钮改成对话，除非该步需要多轮修订并写回同一份模型。
- 不要在步骤里重写 pending、停止、编辑、重试。
- 概念图绘制仍是成果输出，不作为对话主入口。
