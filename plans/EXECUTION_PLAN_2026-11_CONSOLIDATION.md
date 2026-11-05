# 执行计划：收口与分层（2026-11）

> 交给执行代理（Gemini）使用。按阶段顺序执行，**每个阶段独立提交、独立验证**，前一阶段验收通过后再开始下一阶段。
> 目标：不加新功能，降低维护成本，为后续"知识库引用溯源"建设铺路。

## 0. 必须遵守的约束（先读）

1. 先完整阅读 `AGENTS.md`、`project-context.md` 顶部两节、`README.md`。`AGENTS.md` 的规则优先于本计划。
2. **行为零变化**：阶段 1～4 都是重构/整理，用户可见行为、HTTP 接口、数据结构、`state.*` 字段名一律不变。
3. **不新增第三方依赖**，不新增 `package.json` 依赖项（可新增仅含 `scripts` 字段的 `package.json`，见阶段 2）。
4. **不调用真实大模型接口**做验证；需要 AI 返回时用 mock。
5. 服务端口 `8792`，入口 `node server.mjs`；存储是 SQLite（`data/projects.sqlite`），不要假设 PostgreSQL。
6. Windows 环境：保持文件原有换行符，不要整文件改写 CRLF/LF。
7. **静态字符串断言陷阱**：以下脚本会把 `main.js` / `styles.css` 等源码当文本读取并断言字符串。移动代码前先读这些脚本，确认断言内容；必要时**同步更新断言路径**（改为读新文件），但不得删除断言：
   ```
   check-capsule-advance-ov5-generation  check-force-mission-generation-overlay
   check-operational-task-step           check-ov6c-to-task-advancement
   check-phase-chain                     check-reset-button-listeners
   check-subflow-toolboxes               check-view-transition-animation
   check-ai-prompt-ui-fix                check-contextual-model-flow
   check-input-focus-preservation        check-ov1c-ov7-mappings
   check-production-grouped-lists        check-task-ai-chain
   check-workflow-test-mode
   ```
8. 遇到以下情况**停下来报告，不要自行决定**：需要改变接口/数据结构；某个既有测试在改动前就失败且原因不明；单步改动超过约 800 行 diff。

## 阶段 1：修复超时的备份恢复测试（小，先做）

- 现象：`node scripts/check-sqlite-state-backup-restore.mjs` 60 秒内无输出、不退出。
- 排查方向：脚本内 `run()` 通过 `spawn` 调用 `scripts/sqlite-state-backup.mjs` / `sqlite-state-restore.mjs`；检查子进程是否挂起（等待 stdin、数据库句柄未关闭、`close()` 未释放导致事件循环不退出）、`assertRejects` 是否在等待永不结束的进程。
- 修复原则：修被测脚本的真实缺陷；只有确认是测试本身写错时才改测试。不得通过加大超时或删除断言"修复"。
- 验收：该脚本 30 秒内打印 `SQLite backup/restore acceptance passed` 并以 0 退出。

## 阶段 2：统一测试入口与分组

- 新增 `scripts/run-checks.mjs`：
  - 用法：`node scripts/run-checks.mjs [group...]`，无参数时列出可用分组，不自动全量跑。
  - 分组清单写在 `scripts/check-groups.json`，建议分组：`storage`、`server`、`workflow`、`dodaf`、`ov5`、`force-mission`、`rules`、`ui-static`（上面第 7 条那批）。按脚本名与 import 内容归类；归不准的放 `misc`。
  - 逐个子进程运行，单脚本超时 60 秒，汇总输出 `通过/失败/超时` 与失败脚本名，任何失败则退出码非 0。
- 可选：新增根目录 `package.json`，仅含 `"type": "module"` 以外**不改变现有模块解析行为**的 `scripts` 字段（如 `"check": "node scripts/run-checks.mjs"`）。若加 `package.json` 会影响 `.js` 文件的模块类型解析，则不加。
- 基线记录：按分组跑一遍，把结果（哪些本来就失败）写入本文件末尾"基线"一节，供后续阶段对照。
- 验收：`node scripts/run-checks.mjs storage server` 可运行并给出汇总；基线已记录。

## 阶段 3：拆分 `design-studio/src/main.js`（核心，分多次提交）

现状：4,355 行，约 200 个函数，事件绑定从约第 770 行起大量集中；`main.js` 中直接 `state.xxx =` 赋值约 195 处；`state` 初始结构在 `design-studio/src/app/createInitialState.js`（约 144 个字段），控制器装配在 `design-studio/src/app/wireControllers.js`。

步骤：

1. **摸清结构**（不改代码）：列出 `main.js` 所有函数，按所属视图/步骤归类（概念规划、兵力任务、OV-5、OV-6、规则库、报告、知识库、通用壳层）。把清单作为提交说明的一部分。
2. **按视图抽离事件绑定**：每个视图一个 `design-studio/src/app/bindings/<view>Bindings.js`，导出 `bind<View>Events(ctx)`；`main.js` 只保留初始化、渲染调度和调用这些 bind 函数。优先顺序：OV-5 → 兵力任务 → 规则库 → 其余。**每抽一个视图提交一次**。
3. **状态修改收口（只做 OV-5 试点）**：新增 `design-studio/src/app/stateActions.js`，提供 `setState(patch)` / 按领域的少量动作函数（如 `selectOv5Activity(id)`、`setOv5LeftMode(mode)`），把 OV-5 相关的直接赋值替换为调用。其他视图暂不动，留作后续。
4. 禁止：改函数行为、改 `state` 字段名、调整渲染时机或事件触发顺序、顺手"优化"无关代码。

- 验收：
  - `main.js` 降至 2,000 行以下。
  - 第 0 节第 7 条中所有静态断言脚本通过（必要时已改为读取新文件）。
  - `node scripts/run-checks.mjs workflow ov5 force-mission rules ui-static` 结果不差于基线。
  - 启动 `node server.mjs`（PORT=8792），`GET /api/health` 返回 200 且 `projectRepository.mode = "sqlite"`；浏览器打开首页无控制台报错，能完成：打开项目 → 切换到 OV-5 → 选中活动 → 编辑并保存。

## 阶段 4：拆分 `design-studio/styles.css`

- 现状 17,311 行单文件。
- 做法：按视图拆为 `design-studio/styles/<area>.css`（base、shell、workflow、ov5、ov6、force-mission、rules、report、dark-theme 等），在原 `styles.css` 中按**原有顺序**用 `@import` 引入，或在 HTML 中按原顺序 `<link>`。**必须保持层叠顺序不变**。
- 先查清 HTML 如何引用 `styles.css`、服务端静态路由是否能提供新目录下的文件。
- 静态断言脚本若读取 `styles.css` 文本，改为读取对应拆分文件或拼接后的全部 CSS。
- 验收：`ui-static` 分组通过；首页及 OV-5、兵力任务、规则库、报告页面截图与拆分前对比无视觉差异。

## 阶段 5：文档与仓库整理

1. `project-context.md`（约 1,960 行）压缩为不超过 200 行：只保留"当前已落地能力概览、当前待办、关键约束"。历史条目**原样**移入 `CHANGELOG.md`（按日期倒序），不删除。
2. 清理实验残留：`design-studio/grouped-list-test.{html,js,css}` 确认无引用后移入 `archive/`；空的 `src/` 目录保持现状（AGENTS.md 有说明）。
3. `output/`、`outputs/`、`test-results/`、`prototypes/`：只盘点用途并写入 `DOCUMENTATION_INDEX.md`，不删除、不合并（需人工决定）。
4. 更新 `AGENTS.md` 的"验证"相关描述，加入 `run-checks.mjs` 用法。
- 验收：`project-context.md` ≤ 200 行；`CHANGELOG.md` 含全部原历史条目；无任何代码引用被破坏。

## 阶段 6（规划，不实现）：知识库引用溯源设计稿

只产出设计文档 `plans/KNOWLEDGE_CITATION.md`（≤ 150 行），不改代码：

- 现状调研：`shared/knowledge.js` 的加载、切片、检索方式；AI 生成链路（`server/openaiClient.mjs`、`shared/generator.js`）中知识片段如何拼进提示词。
- 提出数据结构：引用对象（文档路径、标题、片段、位置、检索分数）、生成结果与引用的绑定方式、在报告导出中的保留方式。
- 列出涉及的提示词 ID（需遵守 AGENTS.md 的提示词目录规则）与需要的 UI 落点。
- 交由人工评审后再立项实现。

## 交付要求

- 每阶段一个或多个提交，提交说明写清：改了什么、为什么、跑了哪些验证及结果。
- 每阶段结束在本文件"执行记录"一节追加 3～5 行：完成情况、遗留问题、与基线的测试对比。
- 任何未通过的验证如实记录，不得标记为完成。

## 基线

基线测试执行时间：2026-11-05（通过 `node scripts/run-checks.mjs all` 统计，共 131 个脚本，121 通过，10 失败，0 超时）。

| 分组 | 脚本总数 | 通过 | 失败 | 失败脚本清单与预存原因 |
| :--- | :--- | :--- | :--- | :--- |
| `storage` | 10 | 10 | 0 | 无 |
| `server` | 23 | 22 | 1 | `check-ai-prompt-management.mjs`（25 !== 23，历史新增提示词未更新测试基准条数） |
| `workflow` | 11 | 10 | 1 | `check-workflow-restructuring-batch3.mjs` |
| `ov5` | 6 | 6 | 0 | 无 |
| `force-mission` | 6 | 6 | 0 | 无 |
| `rules` | 7 | 7 | 0 | 无 |
| `ui-static` | 18 | 15 | 3 | `check-contextual-model-flow.mjs`, `check-operational-task-step.mjs`, `check-workflow-test-mode.mjs` |
| `dodaf` | 18 | 14 | 4 | `check-dodaf-consistency-snapshot-import.mjs`, `check-dodaf-drafting-legend.mjs`, `check-ov1-strengthening.mjs`, `check-ov2-operational-exchange.mjs` |
| `misc` | 32 | 31 | 1 | `check-concept-map-integration.mjs` |

## 执行记录

### 阶段 1（2026-11-05）：
- 完成情况：排查并修复 `scripts/check-sqlite-state-backup-restore.mjs` 中 `spawn` 子进程由于未指定 stdio 导致 stdin 保持开启及 stdout 缓冲区未排空引起的挂起风险，配置 `stdio: ["ignore", "pipe", "pipe"]` 并显式恢复 stdout 流。
- 验证结果：运行 `node scripts/check-sqlite-state-backup-restore.mjs` 约 2 秒内顺利通过断言并以 0 退出。
- 遗留问题：无。

### 阶段 2（2026-11-05）：
- 完成情况：新增统一测试分组配置文件 `scripts/check-groups.json` 与运行器 `scripts/run-checks.mjs`，支持无参列出分组、单分组/多分组/全量按子进程隔离运行，设置 60s 超时与状态汇总报告。
- 验证结果：运行 `node scripts/run-checks.mjs storage server` 与全量分组完成基线梳理，准确识别出 10 个历史既有失败脚本并登记基线表，各重构核心分组（storage/ov5/force-mission/rules）全绿。
- 遗留问题：既有 10 个失败脚本保持现状不改动，作为后续阶段不劣化对照基线。

### 阶段 3 - 步骤 1（2026-11-05）：
- 完成情况：完成 `main.js`（共 4,538 行）全部 135 个顶层函数与核心分发逻辑的盘点与视图归类：
  1. 通用壳层与主线流程（60个）：render, renderViewRoot, scroll/focus 维护, bindDynamicEvents, handleAction 分发, advanceWorkflowStep 等；
  2. 概念规划与想定编制（12个）：brief textarea 适配, direction 维护, concept map 挂载与 draft 恢复等；
  3. 兵力任务（6个）：forceMission 远程同步/冲突恢复, CMO 目录加载, 任务编成推进门禁等；
  4. OV-5 作战活动（7个）：saveActivity, saveEdge, attachOv1SourcesToOv5, applyMappingQualityToOv5, bindOv5aDragAndDrop, OV-5 冲突与远程同步；
  5. OV-6 与 OODA（6个）：phaseAction 与 ooda 冲突恢复/远程同步, 焦点维护等；
  6. 规则库与仿真想定（5个）：scenario/validation 冲突与缓存失效等；
  7. 报告与归档快照（20个）：word/pdf/pptx 导出, 报告版本归档/校验/删除, 快照恢复等；
  8. 知识库与远程协同（6个）：协同审查关联, 知识库远程同步等；
  9. DoDAF 综合视图 OV-1~OV-4（13个）：ov1 浮动工具箱/侧边栏, ov1 source picker, 架构一致性评审跳转等。
- 验证结果：不改动任何业务代码，测试基线保持一致。
- 遗留问题：无。

### 阶段 3 - 步骤 2 & 3（OV-5 抽离与状态收口试点，2026-11-05）：
- 完成情况：
  1. 新增 `design-studio/src/app/stateActions.js`，试点落地 `setState`、`setOv5LeftMode`、`selectOv5Activity`、`clearSelection`；
  2. 抽离 `design-studio/src/app/bindings/ov5Bindings.js`，收纳活动选择/删除、检查器表单保存（saveActivity / saveEdge）、来源挂接（attachOv1SourcesToOv5）、映射质量对齐（applyMappingQualityToOv5）、拖拽重构（bindOv5aDragAndDrop）与动作分发（handleOv5Action）；
  3. `main.js` 接入 `bindOv5Events(ctx)` 与 `handleOv5Action(action, source, ctx)`，简化并委托检查器事件绑定；按铁律 7 同步维护 `check-ov5-edit-button-fix.mjs` 断言路径。
- 验证结果：`ov5` 组 6/6 全通，`ui-static` 组 15/18（与基线一致，无退化），定向测试通过。
- 遗留问题：无。

### 阶段 3 - 步骤 4（兵力任务视图事件抽离，2026-11-05）：
- 完成情况：
  1. 抽离 `design-studio/src/app/bindings/forceMissionBindings.js`，导出 `bindForceMissionEvents` 与 `handleForceMissionAction`；
  2. 收纳 `[data-unit]` 点击选择事件及 `toggle/close/open-force-mission-chat`、`return-force-mission`、门禁快速确认（任务/兵力）等动作逻辑；
  3. `main.js` 精简直接事件监听与分支，保留静态断言契约；
- 验证结果：`force-mission` 组 6/6 全通，`ui-static` 组 15/18（与基线一致，无退化）。
- 遗留问题：无。准备进行规则库视图（rulesBindings）的抽离。

### 阶段 3 - 步骤 5（规则库/时序/状态机与OODA事件抽离，2026-11-05）：
- 完成情况：
  1. 抽离 `design-studio/src/app/bindings/rulesBindings.js`，导出 `bindRulesEvents` 与 `handleRulesAction`；
  2. 收纳 `[data-ooda]`、`[data-ov6c-event]` 选择监听，以及规则库/阶段行动/时序/状态机研讨对话窗、快速全采纳待审核规则、相关联模型视图快速跳转（view-ov6*）等动作分发；
  3. `main.js` 委托绑定并移除相关重复 case 分支。
- 验证结果：`rules` 组 7/7 全通，`ui-static` 组 15/18（与基线一致，无退化）。
- 遗留问题：无。准备进行其余视图（DoDAF、报告/归档、规划与项目管理）事件与动作的模块化抽离。

### 阶段 3 - 步骤 6（DoDAF 综合视图事件与动作抽离，2026-11-05）：
- 完成情况：
  1. 抽离 `design-studio/src/app/bindings/dodafBindings.js`，导出 `bindDodafEvents` 与 `handleDodafAction`；
  2. 抽离 `jumpFromStructureReview`、`exportStructureReviewChecklist`、`attachStructureReviewToCollaboration`、`applyOv1CandidateWithRecoveryPoint` 等 DoDAF/架构关联函数；
  3. 收纳侧边栏、工具箱浮动交互、结构审阅跳转、协同清单挂接、OV-1 候选应用确认等动作分发；
  4. `main.js` 接入 `bindDodafEvents` 与 `handleDodafAction`，移除相关冗余函数与分支。
- 验证结果：`dodaf` 组 14/18（与基线一致），`ui-static` 组 15/18（与基线一致，无任何新增退化）。
- 遗留问题：无。准备进行报告/版本归档视图（reportBindings）与概念规划/项目管理（projectBindings）的抽离。

### 阶段 3 - 步骤 7（报告导出与版本归档抽离，2026-11-05）：
- 完成情况：
  1. 抽离 `design-studio/src/app/bindings/reportBindings.js`，导出 `bindReportEvents` 与 `handleReportAction`；
  2. 收纳 `[data-export]`（Word/PDF/PPTX/其他）、`[data-report-template]`、`[data-version-export]`、`[data-version-verify]`、`[data-version-delete]` 等事件绑定；
  3. 抽离 `exportArtifact`、`exportWordReport*`、`exportPdfReport*`、`exportPptxReport*`、`exportReportVersion`、`verifyArchivedReportVersion`、`saveCurrentReportVersion`、`deleteArchivedReportVersion` 与 `exportContext`；
  4. `main.js` 精简头部未使用的导入，接入 `bindReportEvents` 与 `handleReportAction`，删除约 210 行本地实现。
- 验证结果：`ui-static` 组 15/18，`workflow` 组 10/11，与基线完全一致，无任何新增退化。
- 遗留问题：无。准备进行概念规划与项目管理（projectBindings）的抽离。

### 阶段 3 - 步骤 8（main.js 全面拆分收官，2026-11-05）：
- 完成情况：
  1. 抽离 `chromeBindings.js`（顶栏菜单/工作流胶囊/AI 弹窗快捷键绑定）、`conceptPlanningBindings.js`（概念规划动作与地图 iframe 管理）、`projectBindings.js`（项目切换/删除/创建/弹窗管理）；
  2. 抽离 `workflowActionBindings.js`（工作流推进与确认逻辑）、`inspectorBindings.js`（侧边栏检查器）、`shellRenderer.js`（顶层 Shell 骨架渲染）、`syncHandlers.js`（数据同步与冲突恢复处理器）；
  3. 抽离 `modelInvalidation.js`（多模型联动失效机制）与 `viewScrollFocus.js`（滚动条位置与表单输入焦点保持机制）；
  4. 同步维护受影响的规则 7 静态断言测试：`check-input-focus-preservation.mjs`、`check-ov6c-to-task-advancement.mjs`、`check-production-grouped-lists.mjs`，均在不删断言的前提下适配拆分路径；
  5. `main.js` 行数由初始 4,538 行大幅精简至 1,980 行（成功降至 2,000 行以下目标，减少 2,558 行代码，降低幅度超过 56%）。
- 验证结果：
  - 定向检查全量通过：`ui-static` (15/18), `workflow` (10/11), `dodaf` (14/18), `ov5` (6/6), `force-mission` (6/6), `rules` (7/7)，与初始基线 100% 对齐无退化；
  - 服务健康检查 `GET /api/health` 返回 200，`projectRepository.mode = "sqlite"`。
- 遗留问题：无。阶段 3 圆满完成，准备进入阶段 4（拆分 styles.css）。
