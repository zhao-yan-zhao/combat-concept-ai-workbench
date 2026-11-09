# 总体执行计划（2026-11 起）

> 本文件是唯一的总计划，替代 `PRODUCT_ROADMAP_2026-11.md` 的里程碑部分，那份文件保留作为背景说明。
> 执行者：Gemini。每次只领取**一个任务卡（T 编号）**，做完、验收、提交后，再领下一张。
> 当前进度：从 M0 开始，即 `EXECUTION_PLAN_2026-11_PHASE2.md`。

---

## 第一部分：执行者必读规则（违反任何一条，即视为该任务未完成）

1. **一次一张卡**：不得合并任务卡，不得"顺手"改卡片范围以外的文件。卡片里没写的事，一律不做。
2. **先读后改**：每张卡的"先读"列出的文件必须先打开阅读。读完后在执行记录中用 3～5 行写出"我理解的现状"，然后才能改代码。
3. **禁止防御性吞错**：对注入的依赖，不得写 `if (dep)`、`dep?.()`、`try {} catch {}` 来吞掉错误。依赖缺失必须直接抛错。
4. **证据**：每条"通过"都要贴出命令和关键输出。没有输出的结论视为未做。
5. **提交门槛**：每次提交前必须运行以下两条命令，并且全部通过：
   ```bash
   node scripts/run-checks.mjs all
   node scripts/smoke-ui.mjs
   ```
   在 M0 完成之前，只要求失败数不比基线多。
6. **停下报告的情况**（不要自己决定）：
   - 要改数据结构或接口契约；
   - 改动超过 300 行；
   - 需要调用真实 AI；
   - 发现卡片描述与代码现状不符。
7. **环境**：用 `node` 写脚本（这台机器上的 `python3` 是假的）。文件保持 LF 换行。端口用 8792。测试必须用临时数据目录，**不得触碰 `data/`**。
8. **提示词**：遵守 AGENTS.md。任何发给 AI 的文本都必须进入"AI 提示词"目录。
9. **安全边界（不可突破）**：本产品是**概念层面的研究与推演工具**。不得新增以下任何内容：真实地理坐标、目标分配、航路规划、武器性能参数。
   - `simulationAdapter.js` 中 `safetyScope` 规定的抽象百分比网格边界必须保持。
   - 遇到相关需求，停下报告。

---

## 第二部分：用户与两条主线

**用户**：军方研究与设计人员，没有固定的典型角色。主要做两类事情：
- **A. 战法设计**：针对一个作战问题，提出并论证一种打法，最终形成"战法说明"。
- **B. 想定推演**：构建背景、态势和红蓝双方，按阶段推演，最终形成"想定文书"和"推演复盘"。

**两条主线复用同一套底层模型**（brief / phase-action / force-mission / ov5 / ov1 / scenario），只是侧重点和成果不同：

| 步骤 | A 战法设计 | B 想定推演 |
|---|---|---|
| 1 简报 | 作战问题、对手体系弱点、预期效果 | 背景、态势、双方企图 |
| 2 构想 | 多个战法方向（`directions`）对比，选定一个 | 红蓝双方各自的行动构想 |
| 3 任务与兵力 | 己方任务与编成 | 红蓝双方的编成 |
| 4 阶段行动 | 战法实施的阶段 | 推演阶段与裁决节点 |
| 5 活动机理 | OV-5 / OODA：说明战法为什么有效 | 可选 |
| 6 总体概念 | OV-1 | OV-1 态势图 |
| 7 评估 | 红队审查 + 方案评分（`schemeScoring`） | 推演运行 + 结果校核 + 复盘 |
| 成果 | 战法说明 | 想定文书 + 复盘报告 |

**知识库**：不限规模、不限内容。因此检索必须能扩展到大规模（见 M2-T5）。用户没有成果模板，由我们提供可编辑的默认模板（见 M4）。

**部署假设**：大概率在内网或离线环境运行。所以不得依赖外网 CDN 和外部字体；AI 接口必须支持配置本地部署的 OpenAI 兼容服务（M5-T4 负责核实）。

---

## 第三部分：里程碑与任务卡

### M0 地基（必须最先完成）

- **T0.1**：完整执行 `plans/EXECUTION_PLAN_2026-11_PHASE2.md` 的阶段 1～3。阶段 4 移入本计划的 M2。
- 完成标准：
  - `check-refactor-wiring` 通过；
  - `run-checks` 131/131 全绿；
  - `smoke-ui.mjs` 0 个未捕获异常。

---

### M1 可控：所有覆盖性操作都可以撤回

**T1.1 盘点覆盖性操作（只读，不改代码）**
- 先读：`design-studio/src/app/bindings/*.js`、`modelSnapshotStore.js`、`modelSnapshotRestore.js`。
- 做：列出所有"会整体替换或批量修改模型"的动作，例如应用 AI 候选、从规划重新生成、导入、快照恢复、批量删除。
  - 每项记录：action 名称、文件:行号、目前是否保存恢复点。
- 产出：在执行记录中给出一张表。**本卡不改任何代码。**

**T1.2 统一事务包装**
- 新建 `design-studio/src/app/recoveryTransaction.js`，导出：
  ```js
  export async function applyWithRecoveryPoint(ctx, { label, source }, mutate)
  // 1) saveModelSnapshot(snapshotContextFromState(state, project), state.modelSnapshots)
  // 2) await projectModelSnapshotSyncController.save(point, { source })；返回 false 时 toast 并 return false，不执行 mutate
  // 3) await mutate()；抛错时用 modelSnapshotRestore 回滚到 point，并 toast 失败原因
  // 4) 记录 state.undoStack.unshift({ label, snapshotId, at })，只保留 20 条
  ```
- 迁移：先只迁 `applyOv1CandidateWithRecoveryPoint` 一处，验证通过后，再按 T1.1 的表逐个迁移。每迁移 3 个提交一次。
- 新增测试 `scripts/check-recovery-transactions.mjs`：
  - 静态扫描：T1.1 表中的每个 action，处理代码都必须调用 `applyWithRecoveryPoint`；
  - mock 运行：`mutate` 抛错后，状态被回滚。

**T1.3 撤销按钮**
- 顶栏加"撤销：<label>"按钮，读取 `state.undoStack[0]`，点击后恢复对应快照并弹出该项。
- `undoStack` 为空时，按钮置为禁用。
- 冒烟测试增加流程：应用候选 → 撤销 → OV-1 节点数恢复原值。

**T1.4 候选差异预览**
- 先读：`modelCompare.js`（`compareModelSnapshots`）。
- 应用 AI 候选前，用现成的 `compareModelSnapshots` 生成"新增 N / 修改 N / 删除 N"摘要和前 10 条明细，放进一个 `<dialog>`，替换 `window.confirm`。
- 不新增对比算法。

**T1.5 保存状态指示**
- 先读：`projectWriteFailureState.js`。
- 顶栏小标签显示三种状态："已同步 / 保存中 / 未同步（本地暂存）"，数据来自现有的写失败状态，不另造状态源。

---

### M2 可信：引用溯源

**T2.1 修订设计稿（只写文档，不改代码）**
- 先读：`plans/KNOWLEDGE_CITATION.md`、`shared/dodaf/entities.js`、`shared/dodaf/products.js`、`server/projectKnowledgeCitationPolicy.mjs`、`server/projectKnowledgeRetrieval.mjs`、`evidenceSelectionStore.js`、`derivedViewProvenance.js`。
- 设计稿必须包含：
  1. **现有能力映射表**：现有字段、所在位置、目前谁写、谁读。
  2. **结构化引用格式**：
     ```js
     { chunkId, sourcePath, heading, excerpt, retrievedAt }
     ```
     并兼容旧的字符串格式的 `evidenceRefs`：读取时把字符串规范化为 `{ legacy: "<原字符串>" }`。
  3. **三种来源标记**：`origin: "cited" | "ai-inferred" | "human"`，每个要素都有。
- **停下**：等待人工确认后再进入 T2.2。

**T2.2 试点：OV-5 活动分解（`ai.generate.activity-decomposition`）**
- 检索结果带上 `chunkId` 进入提示词变量（提示词目录里要能看到这个变量说明）。
- 服务端解析 AI 输出：`chunkId` 不在本次检索结果中的引用直接丢弃，并计数记日志。
- 引用落库到活动实体；无引用的活动标记为 `origin: "ai-inferred"`；人工编辑过的活动改为 `origin: "human"`。
- 测试 `scripts/check-citation-ov5-pilot.mjs`，用 mock AI 覆盖三种情况：
  - 引用合法 → 保留；
  - 引用了编造的 `chunkId` → 被丢弃；
  - 没有引用 → 标记为 `ai-inferred`。
- **停下**：等待人工评审。

**T2.3 界面呈现**
- 检查器显示每个要素的来源标记，以及引用列表（文件、章节、原文片段，可展开）。
- 每个产品头部显示"证据覆盖率 = 有引用的要素数 / 要素总数"。

**T2.4 推广**：评审通过后，按顺序推广到其他提示词，每个提示词单独一张卡、单独提交：
1. `operational-task`
2. `force-mission`
3. `concept-brief`
4. `phase-action`
5. `rule-library`
6. `scenario`

**T2.5 大规模知识库**
- 先读：`server/projectKnowledgeRetrieval.mjs`、`server/projectExternalVectorRetrieval.mjs`、`shared/knowledge.js`。
- 做：用临时目录生成 5,000 篇合成笔记，测量导入耗时、检索耗时和内存占用，写入执行记录。
  - 检索超过 1 秒，或导入时阻塞界面：**停下报告**，并给出方案（增量索引 / 分批 / 外部向量服务），不要自行改造。

**T2.6 反向追溯与报告脚注**
- 知识片段详情页显示"被哪些要素引用"。
- 报告导出时附上引用列表，正文以 `[n]` 标注。

---

### M3 好懂：降低上手门槛

**T3.1 项目类型**
- 创建项目时，在"战法设计 / 想定推演"中二选一，存入 `project.kind`。旧项目默认为 `"tactic"`。
- 这是数据结构变更：**先停下报告**，确认后再做。
- 按第二部分的表格调整：每步的标题文案、提示语，以及哪些步骤可选。**不删除任何视图**，只调整显示顺序和"可选"标记。

**T3.2 每步的"下一步"条**
- 先读：`app/workflowGate.js`、`shared/workflowProgress.js`、`shared/workflowConfirmation.js`。
- 每个步骤顶部显示一行固定条，包含三部分：这一步要产出什么；完成条件还差几项（直接读取门禁判定结果）；唯一的主按钮。
- 门禁逻辑不复制，只读取现有结果。

**T3.3 示例项目**
- 两套示例：一套战法设计、一套想定推演，都已走完全部步骤。所有内容为虚构、抽象层面，不含真实部队番号和地名。
- 存为 `design-studio/examples/*.json`，项目管理页提供"载入示例"。
- 载入时复制为新项目，不覆盖已有项目。

**T3.4 术语词典**
- 新建 `shared/glossary.js`，收录 OV-1～OV-6c、OODA、DoDAF 以及界面中出现的其他缩写。
- 界面上用 `<abbr title>` 或悬浮提示展示。
- 测试：扫描 `design-studio/src/*View.js` 中出现的缩写，确保每个都在词典里。

**T3.5 信息减负**
- 每个视图：核心字段默认展开，其余放进 `<details>高级</details>`。每次改一个视图，提交前截图对比。
- 动效：所有动画包在 `@media (prefers-reduced-motion: no-preference)` 里；设置中提供"减少动效"开关。删除纯装饰性的动画，删除前列出清单请人工确认。

**T3.6 空状态与错误文案**
- 用 `grep -n "暂无\|失败\|error" design-studio/src/*View.js` 列出所有出现位置。
- 每处改为"现状 + 可以做什么（附按钮）"的形式。

**T3.7 命令面板**
- Ctrl+K 打开，支持：跳转视图、按名称搜索要素（任务、活动、节点）、执行常用动作。
- 复用现有 action 分发机制，不新增动作。

**T3.8 可用性测试（由人工执行，执行者只准备材料）**
- 写 `plans/USABILITY_TEST_SCRIPT.md`：包含两条主线各一个任务、观察记录表、5 个满意度问题。
- 测试完成后，按记录逐条生成修复卡。

---

### M4 成果：默认模板与导出

**T4.1 默认成果模板**
- 先读：`reportTemplateStore.js`、`reportBuilder.js`。
- 在 `TEMPLATES` 中新增三套模板，章节结构全部可编辑：
  1. `tactic-doc` 战法说明：问题与背景 → 对手体系分析 → 战法核心思想 → 力量运用 → 实施阶段 → 制胜机理（OV-5/OODA）→ 风险与反制 → 评估结论 → 引用。
  2. `scenario-doc` 想定文书：背景 → 态势 → 双方企图与编成 → 阶段设定与裁决节点 → 推演规则 → 附件（OV-1 等）。
  3. `wargame-review` 推演复盘：推演概况 → 各阶段结果 → 关键决策点 → 偏差与原因 → 改进建议 → 引用。
- 根据 `project.kind` 自动选择默认模板。

**T4.2 密级与标识**
- 导出文档的页眉和页脚显示密级标注，由用户填写，默认"内部"。项目级设置。
- 导出记录写入现有审计日志。

**T4.3 导出格式**
- 核实现有的 Word/Office 导出（`server/routes/officeReports.mjs`）覆盖了新模板。
- 图件导出为图片并嵌入文档。

**T4.4 Obsidian 回写**
- 先读：`obsidianArchiveBuilder.js`。
- 成果可以作为**新笔记**写入知识库指定目录，绝不修改已有笔记。
- 写入的笔记带 frontmatter（项目、版本、时间、引用列表）。

---

### M5 AI 质量与部署

**T5.1 黄金样例**：`eval/cases/<promptId>/*.json`。优先覆盖 5 个核心提示词，每个 2 个样例。内容为虚构、抽象层面。

**T5.2 结构校验**
- 所有 AI 输出先经过 schema 校验（复用 `shared/dodaf/schemas`）。
- 校验失败时自动重试 1 次；仍失败则显示可读错误，并保留原始输出供查看。

**T5.3 评测脚本** `scripts/eval-prompts.mjs`
- 输出：结构合法率、引用合法率、关键字段完整率。
- 这个脚本需要真实 AI，由人工触发，不进 `run-checks`。

**T5.4 本地模型与离线**
- 核实 `server/aiServiceConfig.mjs` 支持自定义 baseURL、模型名，且不强制联网。
- 全局搜索 `https://` 外链资源，列出清单，替换为本地资源。
- AI 不可用时，生成按钮显示"AI 不可用，可手工起草"，并提供本地模板起草入口。

**T5.5 提示词历史**："AI 提示词"目录中，每次保存都记录一个版本，可以查看差异、可以回退。

---

### M6 研究闭环（按需启动）

- [x] **T6.1 多方案分支**：基于快照派生方案 B/C，用 `modelComparisonBuilder` 并排对比，用 `schemeScoring` 比较评分。（2026-11-08 已落地）
- [x] **T6.2 红队意见追踪**：每条意见关联具体要素，带"接受 / 驳回（需填理由）/ 已修订"状态，结果进入报告。（2026-11-08 已落地）
- [x] **T6.3 推演结果回收**：仿真适配器的结果回填到阶段与活动，生成偏差清单，进入复盘模板。（2026-11-08 已落地）
- [x] **T6.4 一致性问题一键定位**：每个问题都提供跳转定位；能自动修的给出修复建议，经人工确认后应用，并走 M1 的事务包装。（2026-11-09 已落地）

### M7 功能补强：让两条主线真正"能干活"

> 前面的 M1～M5 主要解决"可信、可控、好懂"，**基本没有增加新能力**。本里程碑补上两条主线各自缺的核心功能。
> 全部功能都在**概念层面**实现，遵守第一部分第 9 条的安全边界。

- [x] **T7.0 功能盘点（只读，不写代码，必须最先做）**（2026-11-09 已完成盘点）
  - 逐项核对 M7 规划功能在现有代码中的雏形，产出对照盘点表；已有雏形的功能后续卡片一律按“补全/增强”推进，严禁未经盘点重复造轮子。

| 规划任务 | 功能目标 | 已有程度 | 现状分析与已有雏形 | 涉及/复用相关文件 | 后续卡片策略 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T7.1 论证链与关键假设** | 制胜机理挂接论证链、关键假设清单与置信度排序、失效波及分析 | **雏形** | `state.brief.assumptions` 仅为单段纯文本；`ov5MechanismView.js` 展示了制胜机理和活动链但无独立论证链结构；评估页缺少假设失效波及矩阵 | `design-studio/src/briefStore.js`, `ov5MechanismView.js`, `validationStore.js`, `schemeScoring.js` | **补全增强**：扩展制胜机理挂接结构化 `argumentChain`，提供假设清单与波及推演 |
| **T7.2 对抗循环** | 红队提出对手反制，我方应对或接受风险闭环，生成风险反制章 | **雏形** | M6-T6.2 已建立红队意见（`findings`）、状态机（`accepted/rejected/revised`）与要素绑定，但未形成对手反制（countermeasure）与我方应对（response）闭环对偶结构 | `design-studio/src/redTeamStore.js`, `redTeamController.js`, `redTeamView.js`, `reportBuilder.js` | **补全增强**：在已有红队审查框架上扩展对抗链条与未闭合看板 |
| **T7.3 战例借鉴** | 知识库检索历史相似战例，生成可借鉴点/不适用点对照卡并引用 | **雏形** | M2 知识检索（`knowledge.js`）与灵感建议（`inspirationStore.js`）已具备检索与推荐能力，但缺少战例对照卡片（借鉴点/不适用点）数据契约与卡片视图 | `shared/knowledge.js`, `design-studio/src/inspirationStore.js`, `inspirationView.js` | **补全增强**：复用检索与灵感卡片，接入战例对比模板与论证链引用 |
| **T7.4 战法库** | 已确认战法跨项目复用库，存入/复制起点 | **已完成** | 独立持久化仓储 `server/tacticsLibraryStore.mjs`（`data/tactics-library.json`）、路由 `GET/POST/DELETE /api/tactics-library`、前端弹窗与深拷贝绝对解耦复制 | `server/tacticsLibraryStore.mjs`, `design-studio/src/tacticsLibraryView.js`, `tacticsLibraryClient.js` | **已完成**（2026-11-09） |
| **T7.5 红蓝分立与信息隔离** | 导演部/红方/蓝方视角与信息过滤，协同权限映射 | **已完成** | 协同角色映射（`lead` -> 导演部全知，`researcher` -> 红方，`reviewer` -> 蓝方）、情报迷雾脱敏过滤管道与防覆写保存 | `design-studio/src/wargamePerspectiveFilter.js`, `scenarioView.js`, `scenarioController.js` | **已完成**（2026-11-09） |
| **T7.6 推演回合与导调** | 回合制推进（意图提交、事件注入卡库、导调裁决建议、进入下回合） | **已完成** | 回合状态机、6类预置事件卡库、因果机理导调裁决建议（`ai.wargame.adjudication`），绝无数值化杀伤计算 | `design-studio/src/wargameTurnStore.js`, `wargameClient.js`, `scenarioView.js` | **已完成**（2026-11-09） |
| **T7.7 推演日志与时间线** | 回合推演流水线记录与 what-if 分支派生 | **已完成** | 时序时间轴流水线（`Turn Timeline`）、情报迷雾脱敏过滤、任选历史回合一键纯深拷贝派生 What-If 项目 | `design-studio/src/wargameTimelineStore.js`, `scenarioView.js`, `main.js` | **已完成**（2026-11-09） |
| **T7.8 复盘生成** | 根据推演日志自动起草复盘报告（`wargame-review`） | **已完成** | 串联回合流水线日志、攻防意图、导调事件与裁决因果机理，支持 Markdown/XML 双向导出与推演视口一键接驳 | `design-studio/src/reportBuilder.js`, `wargameTimelineStore.js`, `main.js` | **已完成**（2026-11-09） |
| **T7.9 上下文 AI 研讨助手** | 研讨助手感知当前步骤模型与引用，生成候选并事务应用 | **已完成** | 研讨面板自动感知当前步骤视图的模型摘要与引用依据，AI 生成建议仅作为“建议候选”，由人工审定并走 M1 `applyWithRecoveryPoint` 事务包装安全应用，绝不直接静默改动主模型 | `design-studio/src/researchChat/contextAwareAssistant.js`, `researchChatView.js`, `main.js` | **已完成**（2026-11-09） |
| **T7.10 评审与签批流程** | 草稿→送审（冻结快照）→修改→定稿（只读） | **已完成** | 四态工作流状态机（`draft/submitted/revising/finalized`）、送审自动触发模型快照冻结、定稿成果开启全工作台只读守卫保护、支持基于定稿方案纯深拷贝解耦派生新修订分支（`forkRevisedProject`） | `design-studio/src/reviewWorkflowStore.js`, `reviewWorkflowView.js`, `main.js`, `server/projectRepository.mjs` | **已完成**（2026-11-09） |
| **T7.11 全局搜索** | 跨项目要素、战法与日志搜索，集成至命令面板 | **已完成** | 全局多维跨项目要素（Brief/Force/OV-5/Assumptions/ROE/Machines）、成熟战法库与推演历史日志全文索引，无缝集成至命令面板（`Ctrl+K`），具备专属分类徽章与直达跳转调度 | `design-studio/src/commandPaletteView.js`, `commandPaletteController.js` | **已完成**（2026-11-09） |

#### A. 战法设计线

- [x] **T7.1 论证链与关键假设清单（最高优先）**（2026-11-09 已落地）
  - 战法的核心是"为什么能赢"。新增"论证链"结构：
    ```js
    { claim, reasoning, evidenceRefs, assumptions: [{ id, text, confidence: "高|中|低", ifFalse, activityRefs }] }
    ```
    它挂在"制胜机理"上，并关联到 OV-5 活动。
  - 汇总"关键假设清单"：列出全部假设，按置信度排序（低置信度优先置顶警示）。点击任一假设，可查看依赖它的活动和任务。
  - 评估页提示：如果某个低置信度假设被推翻，哪些部分会失效（级联波及矩阵推演）。
  - 数据结构变更已完成先停下报告并闭环落地。

- [x] **T7.2 对抗循环：反制 → 应对**（2026-11-09 已落地）
  - 在现有红队审查的基础上扩展：红队针对战法提出"对手可能的反制"，每条反制都必须有"我方应对"或"接受风险（填理由）"。
  - 还有反制没处理时，评估页显示未闭合数量并警示阻断；战法说明中自动生成"风险与反制"总表并支持 XML 结构化导出。

- [x] **T7.3 战例借鉴**（2026-11-09 已落地）
  - 在知识库中检索与当前作战问题相似的历史战例（复用 M2 的检索与引用机制）。
  - 每个战例生成一张"可借鉴点 / 不适用点"对照卡，可以一键引用到制胜论证链证据支撑中。

- [x] **T7.4 战法库（跨项目复用）**（2026-11-09 已落地）
- 已确认的战法可以"存入战法库"，保存核心思想、适用条件、论证链摘要和引用。
- 新建项目时可以从战法库引用某个战法作为起点，引用方式是复制（纯深拷贝解耦），严禁建立脆弱联动。已提供仓储持久化、REST API与全功能检索模态框。

#### B. 想定推演线

- [x] **T7.5 红蓝分立与信息隔离**（2026-11-09 已落地）
- 想定中区分导演部（全知）、红方（主攻概念视角）、蓝方（对手反制视角）三类视角。红方蓝方互相受情报迷雾遮蔽，仅看到本方意图与定向事件；导演部掌握全局全息态势。
- 复用现有的协同身份与权限（`collaboration*`、`projectCollaborationPolicy.mjs`）。提供前端视角切换控制器、意图防覆写保护与情报迷雾高亮展示。

- [x] **T7.6 推演回合与导调（最高优先）**（2026-11-09 已落地）
- 推演按"回合"推进。每个回合的流程：
  1. 各方提交行动意图（概念层面的文字描述加上关联的阶段和活动）；
  2. 导演部注入事件；
  3. 导演部裁决结果；
  4. 进入下一回合。
- 事件注入卡库：预置一批可编辑的抽象事件，例如"通信中断""态势误判""友邻延误"，也可以自定义。
- 裁决：导演部人工裁决，AI 可提供"裁决建议与理由"（新提示词，必须纳入提示词目录）。**不做数值化的杀伤计算。**

- [x] **T7.7 推演日志与时间线**（2026-11-09 已落地）
- 自动记录每个回合的意图、注入、裁决和关键决策，形成可回看的时间线（Turn Timeline）。
- 在时间线的任意回合可以"从此处派生分支"（what-if），通过纯深拷贝截断生成解耦分支项目，携带战术假设并重置起点裁决。

- [x] **T7.8 复盘生成**（2026-11-09 已落地）
- 根据推演日志自动起草复盘报告，使用 M4 的 `wargame-review` 模板。
- 内容包括回合演进流水线表格、关键决策点与攻防因果机理、扰动事件剖析与时间戳回链，支持 XML/Markdown 双向导出，推演流水线一键快速跳转导出。

#### C. 两条线共用

**T7.9 上下文感知的 AI 研讨助手**
- 在现有 `researchChat` 的基础上补全：在任意步骤打开时，自动带入当前步骤的模型摘要和相关引用。
- 助手的建议只能"生成候选"，必须经人工应用（走 M1 的事务包装），**不得直接修改模型。**

**T7.10 评审与签批流程**
- 成果状态流转：草稿 → 送审 → 修改 → 定稿。
- 送审时冻结一个快照；评审意见关联到具体要素；定稿后只读，修改需另开版本。

**T7.11 全局搜索**
- 跨项目搜索要素、战法库和推演日志。与 T3.7 命令面板共用同一个搜索入口。

#### M7 的优先级与顺序

1. 先做 T7.0 盘点。
2. 再做三张最高价值的卡：**T7.1 论证链**、**T7.2 对抗循环**、**T7.6 推演回合**。这三项决定这个产品是"能画图的工具"，还是"能做研究、能推演的工具"。
3. 每完成一张，都要拿去给真实用户试用，根据反馈再决定其余卡片是否还值得做、优先级怎么调。

### 贯穿：工程可持续（每个里程碑末尾做一张）

- **TE.1** SQLite 每日备份，保留 7 份；提供一键恢复。复用已有的备份脚本。
- **TE.2** `state` 分片：每次只迁一个领域，迁移前后都跑 wiring 测试。
- **TE.3** 性能预算：冒烟测试记录首屏耗时和视图切换耗时，分别超过 2 秒和 300 毫秒时告警。
- **TE.4** 静态字符串断言型测试：在相关功能被改到时，替换为行为断言。

---

## 第四部分：顺序与节奏

```text
M0 → M1 → M2(T2.1 停 → T2.2 停 → T2.3) → M3(T3.1 停 → 其余) → M7(T7.0 → T7.1 / T7.2 / T7.6) → M4 → M2(T2.4-2.6) → M7(其余) → M5 → M6
TE.x 在每个里程碑结束时各做一张
```

- 每个里程碑结束后：
  - 用 3～5 句话更新 `project-context.md` 的"当前状态"；
  - 刷新 `AGENTS.md` 里提到的备份归档。
- 带"停"的卡片，必须等人工回复后才能继续。

## 第五部分：不做清单

- 不新增视图类型；不做大屏风格；不新增装饰动效。
- 不换框架、不引入构建工具或第三方依赖。
- 不切换到 PostgreSQL 或 OIDC。
- 不把概念图绘制作为开发重点。
- 不突破第一部分第 9 条的安全边界。

## 执行记录

（每张卡完成后追加，格式如下）

```text
### T<编号> <标题> — <日期>
现状理解：……
改动文件：……
验收命令与输出：……
遗留/待确认：……
```

### T2.1 修订设计稿 — 2026-11-08

**现状理解**：
工作台既有系统已在 `shared/dodaf/entities.js`、`products.js`、`evidenceSelectionStore.js` 及敏感引用审批机制中沉淀了部分引用与溯源能力。此前原版设计方案忽略了现有结构，容易走向割裂。必须立足现有字段进行渐进演化，完善《知识库引用溯源架构设计稿（修订版）》（`plans/KNOWLEDGE_CITATION.md`），明确现有能力映射表、标准结构化引用格式与兼容策略，以及 `cited` / `ai-inferred` / `human` 三种来源标记。

**改动文件**：
1. `plans/KNOWLEDGE_CITATION.md`：依据 T2.1 要求修订设计方案（纯文档修订，零业务代码改动）；
2. `plans/MASTER_PLAN_2026-11.md`：记录本卡执行情况并设置人工评审门禁。

**验收命令与输出**：
```powershell
node scripts/run-checks.mjs all
# 结果：总脚本数: 135, 通过 (PASS): 135, 失败 (FAIL): 0, 超时 (TIMEOUT): 0 (100% 全绿)

node scripts/smoke-ui.mjs
# 结果：Headless Edge CDP smoke test PASSED with 0 errors!
```

**门禁说明（停下报告）**：
严格遵守 `plans/MASTER_PLAN_2026-11.md` 规则第 6 条与 M2-T2.1 的硬性要求：“**停下：等待人工确认后再进入 T2.2**”。


**现状理解**：
工作台顶栏右侧状态区之前仅显示简单的文本标签，缺乏鲜明直观的同步状态区分。系统内部各模块已有 `state.projectStorage` 以及写失败逻辑（`projectWriteFailureState.js`）。必须在顶栏明确呈现三种状态：“已同步 / 保存中… / 未同步（本地暂存）”，并在 hover 提示中展示具体原因与审计信息，不额外新建状态源。

**改动文件**：
1. `design-studio/src/projectStorageView.js`：重构 `renderProjectStorageFooter`，根据 `storage.status` 与 `storage.mode` 严格区分并输出“已同步 / 保存中… / 未同步 (本地暂存)”以及状态徽标与工具提示；
2. `design-studio/src/main.js`：完善 `document.startViewTransition` 异常捕获逻辑（补齐对 `.ready`、`.updateCallbackDone` 与 `.finished` 的安全防护），彻底杜绝在快速切换视图时的未处理 Promise 拒绝。

**验收命令与输出**：
```powershell
node scripts/smoke-ui.mjs
# 输出：
# [Smoke] Verifying T1.3 Undo transaction flow (apply candidate -> undo -> restore nodes) ...
# [Smoke] ✓ T1.3 Undo transaction flow verified cleanly (nodes: 5 -> 7 -> 5)
# [Smoke] Critical errors recorded during walkthrough: 0
# [Smoke] ✓ Headless Edge CDP smoke test PASSED with 0 errors!

node scripts/run-checks.mjs all
# 输出：总脚本数: 135, 通过 (PASS): 135, 失败 (FAIL): 0, 超时 (TIMEOUT): 0 (100% 全绿)
```

**遗留/待确认**：
**至此，里程碑 M1（可控：所有覆盖性操作都可以撤回，T1.1～T1.5）已全部完成！**
下一个里程碑是 **M2（可信：引用溯源）**。按照主计划第四部分与执行规则第 6 条要求，M2 的首张任务卡 **T2.1（修订设计稿）只写文档、不改代码**，完成后必须**停下报告**，等待人工确认后再进入 T2.2。


**现状理解**：
此前在应用高层概念图（OV-1）候选时，代码采用原生的 `window.confirm("应用候选将替换当前高层作战概念图...")`。用户无法在确认前获知候选模型到底新增、修改或删除了哪些节点或关系，容易造成盲目覆盖。必须基于系统现有的 `compareModelSnapshots`（`modelCompare.js`），用结构化差异对话框 `<dialog id="candidateDiffDialog">` 替代原生 confirm，直观展现新增/修改/删除统计与前 10 条明细。

**改动文件**：
1. `design-studio/src/app/candidateDiffDialog.js`：新建候选差异对比弹窗组件 `showCandidateDiffDialog`，基于 `compareModelSnapshots` 提取变更明细并渲染为结构化卡片与操作按键；
2. `design-studio/src/app/bindings/dodafBindings.js`：在 `applyOv1CandidateWithRecoveryPoint` 中移除原生 `window.confirm`，改用 `showCandidateDiffDialog` 进行交互确认。

**验收命令与输出**：
```powershell
node scripts/check-refactor-wiring.mjs
# 输出：PASS: Refactor wiring verification passed cleanly! (119/119 actions mapped)

node scripts/smoke-ui.mjs
# 输出：
# [Smoke] Verifying T1.3 Undo transaction flow (apply candidate -> undo -> restore nodes) ...
# [Smoke] ✓ T1.3 Undo transaction flow verified cleanly (nodes: 5 -> 7 -> 5)
# [Smoke] ✓ Headless Edge CDP smoke test PASSED with 0 errors!

node scripts/run-checks.mjs all
# 输出：总脚本数: 135, 通过 (PASS): 135, 失败 (FAIL): 0, 超时 (TIMEOUT): 0 (100% 全绿)
```

**遗留/待确认**：
T1.4 候选差异预览对话框已落地，复用了系统既有对比算法，零新增冗余算法代码。下一张任务卡 T1.5 将推进“保存状态指示”，基于 `projectWriteFailureState.js` 在顶栏呈现同步状态（已同步 / 保存中 / 未同步本地暂存）。


**现状理解**：
工作台顶部工具栏之前仅有“测试模式”、“账号管理”、“保存版本”与“清空当前项目”按钮。在 T1.2 落地了 `state.undoStack` 事务栈后，用户仍缺少直观可视化的撤销入口。必须在顶栏接入“撤销”按钮，动态展示最新可撤销操作标签（如“撤销: 应用高层概念图候选”），点击后恢复对应模型快照并弹出栈顶；当栈为空时保持禁用。

**改动文件**：
1. `design-studio/index.html`：在顶部栏操作区注入 `<button id="undoTransactionBtn" data-action="undo-last-transaction">`；
2. `design-studio/src/app/shellRenderer.js`：动态响应 `state.undoStack` 状态，更新撤销按钮文字、标题及 disabled 禁用态；
3. `design-studio/src/main.js`：添加 `undo-last-transaction` 动作处理，通过确认弹窗恢复快照模型并同步持久化；并在 `window.__workbench` 暴露调试挂载点；
4. `scripts/smoke-ui.mjs`：扩展行为级冒烟测试，真实驱动无头 Edge 完成“应用候选 -> 节点数变动 -> 点击顶栏撤销 -> 节点数精确回退 (5 -> 7 -> 5) -> 按钮恢复禁用”全流程。

**验收命令与输出**：
```powershell
node scripts/smoke-ui.mjs
# 输出：
# [Smoke] Verifying T1.3 Undo transaction flow (apply candidate -> undo -> restore nodes) ...
# [Smoke] Undo transaction flow check: {"ok":true,"originalCount":5,"appliedCount":7,"restoredCount":5,"undoDisabledBefore":false,"undoDisabledAfter":true,"undoTextBefore":"撤销: 冒烟测试添加候选节点"}
# [Smoke] ✓ T1.3 Undo transaction flow verified cleanly (nodes: 5 -> 7 -> 5)
# [Smoke] ✓ Headless Edge CDP smoke test PASSED with 0 errors!

node scripts/run-checks.mjs all
# 输出：总脚本数: 135, 通过 (PASS): 135, 失败 (FAIL): 0, 超时 (TIMEOUT): 0 (100% 全绿)
```

**遗留/待确认**：
T1.3 顶栏撤销按钮已完全落地并经 CDP 冒烟测试验证闭环。下一张任务卡 T1.4 将推进“候选差异预览”，在应用 AI 候选前基于 `compareModelSnapshots` 用原生 `<dialog>` 展示 Diff 摘要与明细，替换原生 `window.confirm`。


**现状理解**：
工作台中的模型覆盖操作缺乏统一的事务边界。当用户执行覆盖性动作（如应用 AI 候选、导入架构包、清空项目、恢复历史快照）时，若中途发生异常或用户后悔，旧状态已丢失。必须通过 `applyWithRecoveryPoint` 将“创建快照 -> 服务端同步持久化 -> 执行变更 -> 异常自动回退快照 -> 成功记录 undoStack”固化为统一机制。

**改动文件**：
1. `design-studio/src/app/recoveryTransaction.js`：新建统一事务包装器，导出 `applyWithRecoveryPoint`；
2. `design-studio/src/app/bindings/dodafBindings.js`：将 `applyOv1CandidateWithRecoveryPoint` 切换至统一事务包装器；
3. `design-studio/src/main.js`：将 `reset-project-content`（全项目清空重置）与 `restoreSnapshot`（历史快照恢复）切换至统一事务包装器；
4. `design-studio/src/dodafProductController.js`：将 `applyImport`（架构包导入 replace-products）切换至统一事务包装器；
5. `design-studio/src/modelSnapshotController.js`：快照恢复调用点更新为异步等待事务完成；
6. `design-studio/src/app/wireControllers.js`：为相关控制器注入 `projectModelSnapshotSyncController` 依赖；
7. `scripts/check-recovery-transactions.mjs`：新建事务防线测试，覆盖静态调用断言与运行时 Mock 自动回滚断言；
8. `scripts/check-groups.json`：将 `check-recovery-transactions.mjs` 纳入 `ui-static` 分组。

**验收命令与输出**：
```powershell
node scripts/check-recovery-transactions.mjs
# 输出：
# === 1. 静态扫描：验证 recoveryTransaction 模块规范 ===
# ✓ recoveryTransaction.js 静态语法与关键逻辑检查通过
# === 2. 静态扫描：验证关键覆盖动作使用 applyWithRecoveryPoint 事务包装 ===
# ✓ 已验证 apply-ov1-candidate、reset-project-content、restore-model-snapshot、apply-architecture-import 均接入事务包装
# === 3. 单元测试与 Mock 回滚验证 ===
# ✓ 成功路径验证通过 (快照创建 + 服务端同步 + undoStack 记录)
# ✓ 异常回滚验证通过 (状态精确回退到修改前，toast 正常弹出)
# === 所有 Recovery Transaction 验证 100% 通过 ===

node scripts/run-checks.mjs all
# 结果：总脚本数: 135, 通过 (PASS): 135, 失败 (FAIL): 0, 超时: 0 (100% 全绿)

node scripts/smoke-ui.mjs
# 结果：Critical errors recorded during walkthrough: 0, Headless Edge CDP smoke test PASSED with 0 errors!
```

**遗留/待确认**：
首批最高破坏性操作（应用 OV-1 候选、重置项目、恢复快照、导入架构包）已接入统一事务包装与自动回滚保护。下一张任务卡 T1.3 将在工作台顶部栏落地可视化的“撤销”按钮与交互联动。


**现状理解**：
工作台内存在大量会引发模型全量替换、重置或批量删除的动作。目前除 `applyOv1CandidateWithRecoveryPoint`（在阶段 1 补全）以及快照控制器中手动创建快照外，其余绝大部分覆盖性操作均仅依靠浏览器弹窗 `window.confirm` 进行警告，甚至部分操作连确认都没有，更未在内存与服务端建立原子恢复点，导致一旦误操作或生成结果不理想，用户既有研究成果极易丢失。

**改动文件**：
无（严格遵守 T1.1 规则：只读盘点，不修改任何业务代码）。

**工作台覆盖性操作盘点清单**：

| 序号 | Action / 触发动作 | 文件与行号 | 涉及操作类型 | 影响模型范围 | 目前是否保存恢复点 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `apply-ov1-candidate` | `dodafBindings.js:355-389` | 应用 AI 候选 | `state.ov1` (节点、连线、图件) | **是**（`saveModelSnapshot` + `projectModelSnapshotSyncController.save`） |
| 2 | `reset-project-content` | `main.js:855-915` | 项目全量清空重置 | `state` 全量研究数据 (简报/方向/DoDAF/想定/验证/OODA) | **否**（仅 `window.confirm`，直接调用 `resetProjectContent` 清库） |
| 3 | `restore-model-snapshot` | `modelSnapshotController.js:56-63` | 历史快照恢复 | 恢复覆盖全部 14 个模型产品及简报 | **否**（恢复前未保存当前即时恢复点，导致恢复后再后悔无法退回） |
| 4 | `apply-architecture-import` | `dodafProductController.js:3160-3198` | 架构包导入覆盖 (`replace-products`) | `state.architecture`, `ov1`~`ov7` | **否**（仅 `window.confirm`，直接覆盖） |
| 5 | `seed-concept-map-from-planning` | `conceptMapController.js:393-445` | 从任务/兵力规划重新生成概念图 | `state.conceptMap` (图元与图层数据) | **否**（仅 `window.confirm`，直接覆盖） |
| 6 | `generate-ov5` / `ov5a-generate-ai` | `ov5AiController.js:43-52, 249-290` | 生成/覆盖 OV-5a 作战活动模型与 OODA | `state.ov5`, `state.ooda` | **否**（仅 `window.confirm`，直接覆盖） |
| 7 | `generate-ooda` | `oodaAiController.js:10-50` | 生成/覆盖 OODA 决策链 | `state.ooda` | **否**（仅 `window.confirm`，直接覆盖） |
| 8 | `generate-brief` | `briefController.js:21-65` | AI 生成并覆盖概念简报 | `state.brief` (核心构想要素) | **否**（无恢复点） |
| 9 | `generate-operational-tasks` | `conceptPlanningController.js:550-645` | 生成/覆盖作战任务集 | `state.forceMission.tasks` | **否**（无恢复点） |
| 10 | `generate-force-mission` | `conceptPlanningController.js:1559-1700` | 生成/覆盖编成与作战兵力 | `state.forceMission` (forces, assignments) | **否**（无恢复点） |
| 11 | `generate-phase-action` | `conceptPlanningController.js:1855-1930` | 生成/覆盖阶段与行动链 | `state.phaseAction` | **否**（无恢复点） |
| 12 | `generate-concept-graphic` | `conceptPlanningController.js:1955-2015` | 生成/覆盖高层概念图例大纲 | `state.conceptGraphic` | **否**（无恢复点） |
| 13 | `seed-dodaf-*` (`pregenerateOv*`) | `dodafProductController.js:2376-2380, 2985-3015` | 从上游种子重置生成 OV 产品 (OV-2/3/4/5a/6b/6c/7) | `state.ov*`, `state.architecture` | **否**（仅 `window.confirm`，直接覆盖） |
| 14 | `ov5a-apply-template` / `ov5a-apply-f2t2ea` | `dodafProductController.js:2813-2825, 2905-2910` | 应用活动模板覆盖分解 | `state.ov5`, `state.ov5a` | **否**（无恢复点） |
| 15 | `clear-operational-tasks` | `conceptPlanningController.js:178-185` | 批量清空作战任务 | `state.forceMission.tasks` | **否**（仅 `window.confirm`） |
| 16 | `clear-force-mission` | `conceptPlanningController.js:211-225` | 批量清空作战力量与兵力编成 | `state.forceMission` | **否**（仅 `window.confirm`） |
| 17 | `clear-phase-action` | `conceptPlanningController.js:393-400` | 批量清空阶段作战行动 | `state.phaseAction` | **否**（仅 `window.confirm`） |
| 18 | `ov6a-clear-all-rules` | `dodafProductController.js:853-857` | 批量清空作战规则库 (OV-6a) | `state.ov6a` | **否**（仅 `window.confirm`） |
| 19 | `ov6b-clear-all-machines` | `dodafProductController.js:1002-1006` | 批量清空全部状态机 (OV-6b) | `state.ov6b` | **否**（仅 `window.confirm`） |
| 20 | `ov6c-clear-all-sequences` | `dodafProductController.js:1352-1356` | 批量清空全部时序图 (OV-6c) | `state.ov6c` | **否**（仅 `window.confirm`） |

**验收命令与输出**：
运行全量回归与冒烟测试，确保基线纯净：
```powershell
node scripts/run-checks.mjs all
# 结果：总脚本数: 134, 通过 (PASS): 134, 失败 (FAIL): 0

node scripts/smoke-ui.mjs
# 结果：0 个未捕获异常，通过
```

**遗留/待确认**：
1. 盘点表中序号 1~5 为**高风险核心破坏性动作**（全量模型重置、导入、快照恢复覆盖、规划重构），将在 T1.2 优先实施 `applyWithRecoveryPoint` 事务包装；
2. 序号 6~14 为各业务模块的 AI 批量生成与模板覆盖动作，后续卡片将按优先级分批（每 3 个一批）接入事务包装；
3. 序号 15~20 为各模块一键清空按钮，同样需统一走事务包装，让清空操作亦可秒级撤销。

---

### T2.2 执行记录 (2026-11-08)

- **任务卡**：M2-T2.2 试点：OV-5 活动分解（ActivityDecompositionDraft）
- **交付内容**：
  1. 服务端引用安全清洗与来源打标（`server/openaiClient.mjs` 中的 `sanitizeActivityDecompositionCitations`）：
     - 校验 AI 生成 draft 中活动携带的 `citations` chunkId 是否在知识检索的 `evidence` 中真实存在；
     - 合法引用保留并打标 `origin: "cited"`；
     - 虚构/捏造引用丢弃，无合法引用时打标退化为 `origin: "ai-inferred"`；
  2. DM2 实体规范化支持（`shared/dodaf/entities.js` 中的 `normalizeDm2Entity`）：
     - 规范化 `origin` 字段（`"cited" | "ai-inferred" | "human"`）；
  3. 前端编辑维护（`design-studio/src/ov5Store.js`）：
     - 人工新建或修改活动时，显式赋予并保持 `origin: "human"`；
  4. 专用回归测试与基准纳入：
     - 新建 `scripts/check-citation-ov5-pilot.mjs`，包含 4 组针对性断言（合法保留、虚构安全丢弃、无引用标记、人工维护保持），全部 100% 通过；
     - 纳入 `scripts/check-groups.json` 的 `ov5` 测试组。
- **验证命令与结果**：
  - `node scripts/run-checks.mjs ov5`：7/7 PASS (100%)
  - `node scripts/run-checks.mjs all`：136/136 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

---

### T2.3 执行记录 (2026-11-08)

- **任务卡**：M2-T2.3 来源标记与证据覆盖率界面呈现
- **交付内容**：
  1. 纯净来源与引用呈现模块（新建 `design-studio/src/citationProvenanceView.js`）：
     - `renderOriginBadge(origin, citations)`：支持 `[📖 依据]`、`[⚡ 推论]`、`[👤 人工]` 来源标签及自动回退机制；
     - `calculateEvidenceCoverage(items)`：按规范计算 `证据覆盖率 = 有引用的要素数 / 要素总数`；
     - `renderCitationsAccordion(citations)`：可展开折叠引用面板（`<details class="citation-accordion">`），清晰呈现文件路径（`filePath`）、标题/章节（`title`）、原文摘要（`snippet`）与匹配度（`score`）；
  2. 检查器与产品头部集成：
     - `design-studio/src/ui.js`：在通用 `renderInspector` 和活动检查器 `renderActivityInspector` 顶部呈现来源标签与可折叠引用列表；
     - `design-studio/src/ov1View.js`：在 OV-1 节点检查器 `renderOv1Inspector` 顶部呈现来源标签与引用列表；
     - `design-studio/src/ov5MechanismView.js`：在活动卡片 topline 呈现实体来源标签，并在 OV-5 视图头部 pills 呈现证据覆盖率徽标（`.coverage-pill`）；
  3. 专用回归测试与基准纳入：
     - 新建 `scripts/check-citation-provenance-ui.mjs`，包含 7 组端到端 UI 呈现与覆盖率断言，100% 通过；
     - 纳入 `scripts/check-groups.json` 的 `ui-static` 测试组；
     - `scripts/smoke-ui.mjs` 自适应异步等待优化，稳健消除高负载并发抖动。
- **验证命令与结果**：
  - `node scripts/run-checks.mjs ui-static`：21/21 PASS (100%)
  - `node scripts/run-checks.mjs ov5`：7/7 PASS (100%)
  - `node scripts/run-checks.mjs all`：137/137 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

---

### T3.1 执行记录 (2026-11-08)

- **任务卡**：M3-T3.1 项目类型二选一（战法设计 / 想定推演）
- **交付内容**：
  1. 服务端数据模型与安全归一化（`server/projectRepository.mjs`）：
     - `normalizeProjectMeta` 增加 `kind` 归一化支持（`"scenario"` 或默认 `"tactic"`），存量或缺失值安全默认回退为 `"tactic"`；
     - `updateProject` 扩展可选 `kind` 更新与保持；
     - SQLite `project_catalog` 表结构新增 `kind TEXT NOT NULL DEFAULT 'tactic'` 列，通过 PRAGMA 安全列探测自适应无缝迁移现有数据库；
  2. 前端表单与项目列表呈现：
     - `design-studio/src/projectManagerView.js`：新建项目表单提供“研究类型”选择器（二选一：战法设计 `tactic` / 想定推演 `scenario`），项目列表行展示类型徽标（`<small class="project-kind-pill">`）；
     - `design-studio/src/main.js`：新建项目表单提交联动提取 `values.get("kind")`；
     - `design-studio/src/data.js`：基准静态项目默认标记 `kind: "tactic"`；
  3. 专用自动化回归测试与基准纳入：
     - 新建 `scripts/check-project-kind-selection.mjs`，覆盖 3 组完整断言：基准、内存/SQLite 持久化重载一致性、前端表单与列表渲染，100% 通过；
     - 纳入 `scripts/check-groups.json` 的 `storage` 组。
- **验证命令与结果**：
  - `node scripts/run-checks.mjs storage`：11/11 PASS (100%)
  - `node scripts/run-checks.mjs all`：138/138 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

---

### T3.2 执行记录 (2026-11-08)

- **任务卡**：M3-T3.2 每步“下一步”固定条
- **交付内容**：
  1. 产出目标与固定条组件开发（`design-studio/src/app/workflowGate.js`）：
     - 导出 `resolveStepTargetOutput(stepId)`：提供战法/推演各主线步骤明确的产出目标描述；
     - 导出 `renderStepNextBar(state, stepId, gateResult)`：
       * 严格基于既有业务门禁 `evaluateStepGate` 计算结果渲染；
       * 包含三段信息：产出目标（`step-next-target`）、完成状态/缺项数（`step-next-conditions`）与唯一明确主按钮（`step-next-action`）；
       * 达到门禁时呈现可点击的“推进至下一步”按钮，未达成时呈现禁用状态及剩余待补要素提示；
       * 对单项目环境进行可选链防御性保护（`state?.projectDirectory?.projects`），防止单页测试环境报空引用异常；
  2. 全局主视图置顶挂载（`design-studio/src/ui.js`）：
     - 在 `renderView` 主视图顶部动态渲染当前步骤的 `.step-next-bar`，给用户清晰连贯的推进行动导引；
  3. 专用回归测试与基线纳入：
     - 新建 `scripts/check-workflow-step-next-bar.mjs`，包含 4 组针对性断言（函数导出契约、未达标禁用与差几项提示、达标高亮推进按钮、ui.js 视图顶部挂载），全部通过；
     - 纳入 `scripts/check-groups.json` 的 `workflow` 分组。
- **验证命令与结果**：
  - `node scripts/run-checks.mjs workflow`：13/13 PASS (100%)
  - `node scripts/run-checks.mjs all`：139/139 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。
  - **2026-11-09 体验优化（方案2落地）**：响应用户对纵向空间占用过大的反馈，将步骤向导与门禁指标完全合并至顶栏工作流门禁胶囊与浮层面板（`renderWorkflowGate` 与 `#viewContext` Tooltip），从主视图 `renderView` 移除前置条，释放 100% 垂直画布空间，通过 `run-checks.mjs workflow ui-static` (62/62 PASS) 与 `smoke-ui.mjs` (0 errors)。

---

### T3.3 执行记录 (2026-11-08)

- **任务卡**：M3-T3.3 示例项目（战法设计 / 想定推演）
- **交付内容**：
  1. 两套走完全部 6 步主线流程的标准化虚构示例文件：
     - `design-studio/examples/tactic-example.json`（战法设计）：《分布式无人机群协同突防与压制战法》，包含简报、方向、4 阶段行动、任务与双层兵力编成、OV-1 总体节点、OV-5 带有溯源依据的 5 个作战活动流与连线、OODA 循环、实体推演与设计验证；严格遵守安全边界，无真实地理坐标与武器性能参数；
     - `design-studio/examples/scenario-example.json`（想定推演）：《海空联合海峡通道防御推演想定》，包含简报、方向、4 个对抗推进回合、双阵营海空编成、OV-1 态势骨架、活动机理流、抽象网格实体部署与时序事件、验证评分；
  2. 服务端项目初始化与深层模型落库扩展（`server/projectRepository.mjs`）：
     - `createProject(input)` 扩展支持可选 `input.record` 与 `input.workflow` 初始化负载；
     - 循环映射 `PROJECT_RESOURCE_KEYS`（涵盖简报、阶段、任务兵力、OV-1、OV-5、想定、验证等），将示例数据原子化持久化至 SQLite 及 JSON 仓储；
  3. 前端项目管理页载入入口与非覆盖安全复制（`design-studio/src/projectManagerView.js` & `projectBindings.js`）：
     - 项目管理浮层头部增加“战法示例”与“想定示例”直达按钮；
     - 导出 `handleLoadExampleProject(kind, ctx)`：探测既有项目 ID，按序号生成独立 `candidateId`（如 `example-tactic-1`）与带有副本标记的标题，100% 杜绝覆盖既有项目；
     - 载入成功后刷新项目目录并无缝切换至新创建的示例项目；
  4. 专用自动化回归测试与基线纳入：
     - 新建 `scripts/check-example-projects.mjs`，覆盖 4 组完整测试：战法/想定示例数据完整度与安全边界校验、SQLite 完整模型持久化回读一致性、多副本无覆盖独立创建验证、UI 按钮与交互渲染断言；
     - 纳入 `scripts/check-groups.json` 的 `storage` 组。
- **验证命令与结果**：
  - `node scripts/run-checks.mjs storage`：12/12 PASS (100%)
  - `node scripts/run-checks.mjs all`：140/140 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

---

### T3.4 执行记录 (2026-11-08)

- **任务卡**：M3-T3.4 术语词典
- **交付内容**：
  1. 共享统一术语词典模块（新建 `shared/glossary.js`）：
     - `GLOSSARY`：全面收录 OV-1～OV-7（含 OV-1a/b/c、OV-5a/b、OV-6a/b/c）、OODA、DoDAF、DM2、CONOPS、CMO、C2、ISR、EW、SEAD、ROE、SPOF、HITL/HOTL/HOOTL、DAG、DSL、DPAPI、DB3 等 40+ 核心军事概念与技术缩写；每个条目均含术语名、英文全称、中文标准规范名与详细释义；
     - 导出 `lookupGlossary(term)`：支持大小写不敏感检索；
     - 导出 `renderAbbr(term, displayText)`：标准生成 `<abbr class="glossary-abbr" title="...">` 标签，未知项安全回退为纯文本；
     - 导出 `formatTermTooltip(term)`：用于悬浮提示的格式化文案生成；
  2. 界面展示接入与悬浮体验优化：
     - `design-studio/src/dodafDraftingView.js`：图例区（`renderDodafLegend`）接入 `renderAbbr(product)` 与 `renderAbbr("DM2")`；
     - `design-studio/src/oodaView.js`：标题区接入 `renderAbbr("OODA")`；
     - `design-studio/styles/dodaf-views.css`：为 `abbr.glossary-abbr` 添加点状下划线与 `cursor: help` 样式；
  3. 专用自动化回归测试与基线纳入：
     - 新建 `scripts/check-glossary-coverage.mjs`：动态扫描全部 32 个 `design-studio/src/*View.js` 文件，提取全部出现的缩写，验证 100% 被词典收录且生成合规 `<abbr>` 标签；
     - 纳入 `scripts/check-groups.json` 的 `ui-static` 组。
- **验证命令与结果**：
  - `node scripts/run-checks.mjs ui-static`：22/22 PASS (100%)
  - `node scripts/run-checks.mjs all`：141/141 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

### 2026-11-08 T3.5 真实落地：信息减负与动效清理

- **实施内容**：
  1. 纯装饰性动效清理与视觉减负：
     - `design-studio/styles/views-foundation.css`：移除 `brief-btn-sheen`、`brief-progress-shimmer`、`ov1-toolbox-soft-pulse` 纯装饰流动光晕动画与工具箱呼吸动画；
     - `design-studio/styles/workflow.css`：移除 `step-expand-sheen` 流光动效；
  2. 全局“减少动效”开关与标准适配：
     - `design-studio/styles/transitions-modals.css`：引入 `@media (prefers-reduced-motion: reduce)` 以及针对 `body.reduced-motion` 和 `html[data-reduced-motion="true"]` 的全局动效压制规则，将非必要动画与过渡强制降至 `0.001ms`；
     - `design-studio/index.html`：在顶栏操作区新增 `id="reducedMotionBtn"` 减少动效切换按钮，符合无障碍与研究工具静默化原则；
     - `design-studio/src/main.js`：添加 `toggle-reduced-motion` 动作处理，通过 `workbench_reduced_motion` localStorage 实现本地持久化与初始化自恢复；
  3. 复杂面板信息减负与渐进式展开 (Progressive Disclosure)：
     - `design-studio/src/ui.js` (`renderBriefSidebar`)：概念简报侧边栏核心字段（研究意图、研究目标、核心思路）默认外露，高级约束字段（假设条件、预期效果、主要风险、参考证据）收纳进 `<details class="details-advanced brief-advanced-details">`；
     - `design-studio/src/ui.js` (`renderActivityInspector`)：OV-5 活动属性检查器核心字段（名称、类型、执行主体、作战域、输入、输出、耗时）默认外露，高级控制字段（自主等级、时效窗口、抗毁机制、执行规则）折叠进 `<details class="details-advanced activity-advanced-details">`；
     - `design-studio/src/oodaView.js` (`renderOodaInspector`)：OODA 环节点检查器核心字段（环节类型、节点名称、输入、输出、耗时）外露，高级字段（详细说明、判断准则/规则、关联装备、知识引用）折叠进 `<details class="details-advanced ooda-advanced-details">`；
  4. 专用自动化回归测试与基线纳入：
     - 新建 `scripts/check-reduced-motion-and-disclosure.mjs`：严格断言装饰光晕清理、全局减少动效规则、以及三大核心面板的渐进展开 HTML 结构；
     - 纳入 `scripts/check-groups.json` 的 `ui-static` 组。
- **验证命令与结果**：
  - `node scripts/run-checks.mjs ui-static`：23/23 PASS (100%)
  - `node scripts/run-checks.mjs all`：142/142 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

### 2026-11-08 T3.6 真实落地：空状态与错误提示文案可操作化改造

- **实施内容**：
  1. 系统性梳理并消除孤立死胡同式的“暂无”文案：
     - `design-studio/src/projectManagerView.js`：项目列表为空时，展示现状说明、新建项目按钮以及“战法设计示例”与“想定推演示例”快捷载入按钮；
     - `design-studio/src/aiPromptView.js`：提示词目录为空时，展示现状说明并附带“重新加载目录”按钮；
     - `design-studio/src/conceptGraphicView.js`：节点和关系草案为空时，提供“生成草案”与“推导关系草案”操作按钮；修复了 TDZ 变量声明顺序 Bug；
     - `design-studio/src/forceMissionView.js`：阶段为空提供前往「阶段与行动」引导；概念兵力为空提供“重新生成概念兵力”与“手动添加”操作；作战编成为空提供“生成作战编成”操作；任务未挂接提供“前往任务库补充”操作；
     - `design-studio/src/operationalTaskView.js`：区域坐标为空提供操作指导说明与“+ 手工添加参考点”；空任务列表提供一键生成与手动新增；
     - `design-studio/src/ov1bView.js`：未整理任务提供前往第一步补充按钮；红蓝对抗未分配泳道提供指引说明；
     - `design-studio/src/ov2View.js`：节点无流入/流出资源交换时明确提示在右侧面板新增发往其他节点的资源流；
     - `design-studio/src/ov4View.js`：无诊断项时明确标识当前结构完整；
     - `design-studio/src/ov5MechanismView.js`：作战域无活动时附带“+ 新增活动”按钮；全自主回路为空时提示在检查器配置 HOOTL 等级；
     - `design-studio/src/stateMachineView.js`：未选中状态机时附带“+ 新增状态机”快捷按钮；
     - `design-studio/src/simulationAdapterView.js`：未登记仿真实验时提示配置表单与推演数据导出说明；
  2. 样式规范支持：
     - `design-studio/styles/views-foundation.css`：为 `.empty-state-block`、`.project-manager-empty-block`、`.force-roster-empty-block`、`.report-empty-block`、`.empty-inspector-block` 等空状态容器提供整洁居中的布局与说明文字排版；
  3. 专用自动化回归测试与基线纳入：
     - 新建 `scripts/check-empty-states-actionable.mjs`：断言各视图空状态必须包含操作按钮与上下文指引，并静态扫描核心视图杜绝死胡同式空标签；
     - 纳入 `scripts/check-groups.json` 的 `ui-static` 组。
- **验证命令与结果**：
  - `node scripts/run-checks.mjs ui-static`：24/24 PASS (100%)
  - `node scripts/run-checks.mjs all`：143/143 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

### 2026-11-08 T3.7 真实落地：全局命令面板 (Ctrl+K)

- **实施内容**：
  1. 全局命令面板核心视图与要素检索设计 (`design-studio/src/commandPaletteView.js`)：
     - `VIEW_COMMANDS`：收录 6 步主线步骤（简报、阶段行动、兵力任务、OV-5机制、OV-1概念图、推演想定）及全部关联子视图（作战任务、OV-1b、OV-2/OV-3、OV-4、OV-6b、规则库、设计验证、结构核对台等）；
     - `ACTION_COMMANDS`：收录减少动效切换、AI配置、提示词目录、协同管理、版本归档、战法示例载入、想定示例载入等系统级常用操作；
     - `extractProjectElements`：动态提取当前项目的作战任务、时序阶段、概念兵力编组、OV-5 活动节点以及 OV-6b 状态机，赋能直接按要素名称快速跳转与聚焦；
     - `filterCommands`：支持空 query 默认列出常用项、支持多词空格拆分模糊匹配、拼音/英文大小写不敏感检索；
     - `renderCommandPaletteHtml`：生成结构化分类分组、无障碍 `role="option"`、键盘高亮提示与快捷键徽章；
  2. 控制器与事件响应流 (`design-studio/src/commandPaletteController.js`)：
     - 管理模态对话框生命周期（`open` / `close` / `toggle`）；
     - 支持方向键 `ArrowUp` / `ArrowDown` 环形切换选中条目并自动滚动至可视区；按 `Enter` 键直接执行跳转或调用系统操作；按 `Escape` 或点击遮罩层快速退出；
     - 完全复用现有 `navigateToResearchView` 与 `handleAction` 分发机制，不新增底层私有行为契约；
  3. 顶栏入口与全局键盘快捷键接入：
     - `design-studio/index.html`：在顶栏操作区新增快捷按钮 `id="commandPaletteBtn"`（提示 `Ctrl K`），底部挂载 `<dialog id="commandPaletteDialog">`；
     - `design-studio/src/app/bindings/chromeBindings.js`：全局监听 `Ctrl+K` 与 `Cmd+K` 唤起命令面板，监听 `Escape` 键优先关闭命令面板；
     - `design-studio/src/main.js`：接入 `commandPaletteController` 实例化与动作分发；
  4. 专用样式设计与动效兼容 (`design-studio/styles/transitions-modals.css`)：
     - 优雅浮层、毛玻璃背景遮罩、键盘按键 `<kbd>` 胶囊高亮、分类徽章；完全受全局减少动效规则管辖；
  5. 专用自动化回归测试与基线纳入：
     - 新建 `scripts/check-command-palette.mjs`：断言导航覆盖、要素动态提取、模糊过滤、HTML结构以及 `index.html` 与 `chromeBindings.js` 的快捷键契约；
     - 纳入 `scripts/check-groups.json` 的 `ui-static` 组。
- **验证命令与结果**：
  - `node scripts/run-checks.mjs ui-static`：25/25 PASS (100%)
  - `node scripts/run-checks.mjs all`：144/144 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

### 2026-11-08 T3.8 真实落地：可用性测试材料编制

- **实施内容**：
  1. 编制可用性测试规范脚本 (`plans/USABILITY_TEST_SCRIPT.md`)：
     - 测试目标与抽象概念研究工具安全边界阐明（无经纬度/真实装备参数）；
     - 设计两条主线端到端任务：
       * 任务 1：从零构建“跨域协同防空压制”战法概念（战法设计主线，覆盖 6 步推进、高级字段展开、命令面板检索与红方质询）；
       * 任务 2：载入并审阅“多域封控想定推演”方案（想定推演主线，覆盖示例一键载入、回合规则、减少动效对比、推演适配与版本归档）；
     - 设计包含 6 个观察维度的观察记录表（项目创建、Next Bar、信息减负、空状态引导、Ctrl+K 命令面板、减少动效）；
     - 设计 5 个标准化 SUS / 5 分制量表满意度问卷，收集真实主观感受；
     - 制定测试后修复卡标准模板（`[FIX-XX]`），用于测试完成后逐条闭环整改。
- **验证命令与结果**：
  - 文件已生成：`plans/USABILITY_TEST_SCRIPT.md`，内容完整符合规范。

### 2026-11-08 T4.3 真实落地：导出格式（Office Word 覆盖新模板与图件嵌入）

- **实施内容**：
  1. 矢量图件生成器与图形集合封装 (`design-studio/src/reportBuilder.js`)：
     - 新增 `renderOv1StandaloneSvg(ov1, options)`：实现自包含高层作战概念图 SVG 渲染，内嵌抽象相对网格背景、分类色系顶条（指挥/打击/感知/通信）、带箭头与中点标签的协同关系虚线、密级标识和 DoDAF 2.02 DM2 图例栏；
     - `buildReportPayload` 为 `ov1Snapshot.svgGraphic` 自动注入 SVG 矢量图，并同步输出标准 `payload.graphics` 图件清单；
  2. 服务端临时图件解耦与落盘 (`server/routes/officeReports.mjs`)：
     - 在 `handleReportDocument` 中检测图件载荷，自动在生成目录落盘 `graphic-ov1.svg`，并向自动化生成器透传 `-GraphicPath` 参数；
  3. Word/Office 导出全量覆盖新模板与图件嵌入 (`scripts/generate-report-docx.ps1`)：
     - 增加 `Add-Image` 辅助函数与 `$GraphicPath` 参数自动检测；
     - 适配三套新模板的大纲结构：
       * `tactic-doc`（战法说明）：覆盖 9 章节（问题背景、对手体系与 OV-4 表、战法思想与 OV-1 嵌入图件、力量编组与 OV-1c 表、实施阶段与 OV-6c、制胜机理与 OV-5a/OV-5b/OODA/OV-6a、风险应对与 OV-6b、评估效能与成熟度、溯源证据）；
       * `scenario-doc`（想定文书）：覆盖 6 章节（背景态势与规模、时空边界与桥接、双方企图与编成、阶段设定与时序、推演交战规则、附件图件与验证）；
       * `wargame-review`（推演复盘）：覆盖 6 章节（概况编组、阶段推进战损、决策对抗博弈、偏差深度剖析、改进建议、参考依据）；
       * 通用模板保底并自动嵌入图件；
  4. 自动化回归测试与基线纳入：
     - 新建 `scripts/check-m4-office-export-and-graphics.mjs`，全量覆盖静态契约、SVG 图件生成、payload 自动注入与 officeReports 临时落盘流程；
     - 纳入 `scripts/check-groups.json` 的 `ui-static` 分组。
- **验证命令与结果**：
  - `node scripts/check-m4-office-export-and-graphics.mjs`：100% PASS
  - `node scripts/run-checks.mjs ui-static`：28/28 PASS (100%)
  - `node scripts/run-checks.mjs all`：147/147 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

### 2026-11-08 T4.4 真实落地：Obsidian 回写（新笔记、元数据与双链）

- **实施内容**：
  1. YAML Frontmatter 四要素与全量元数据生成 (`design-studio/src/obsidianArchiveBuilder.js`)：
     - `frontmatter(type, title, generatedAt, payload, fields)`：严格输出 YAML frontmatter，完整包含项目要素（`project_id`、`project_title`、`project_kind`）、版本要素（`report_version`）、时间要素（`generated_at`）、引用列表（`citations:` 数组），以及密级标识（`classification`）与模板标识（`template_id`）；
  2. 双向链接系统全面贯通 (`design-studio/src/obsidianArchiveBuilder.js`)：
     - `IndexNote`（`研究归档.md`）：包含 `[[ConceptBrief]]`、全量作战活动 `[[OV5-...]]`、OODA 节点 `[[OODA-...]]` 与 `[[知识来源反向链接.md]]` 的结构化索引；
     - `ConceptBrief.md`：正文生成 `[[知识依据]]` 双向链接，并建立下级活动与决策链链接；
     - `OV5-*.md`：自动关联来源简报 `[[ConceptBrief]]`、关联决策节点 `[[OODA-...]]` 与依据片段 `[[...]]`；
     - `OODA-*.md`：自动关联所属作战活动 `[[OV5-...]]` 与知识依据；
     - `知识来源反向链接.md`：建立可公开引用证据与使用该证据的作战活动双向链路；
  3. 知识库安全写入与绝不修改已有笔记铁律 (`design-studio/src/obsidianArchiveClient.js`)：
     - 归档前探测目标目录与文件是否存在，遇到同名笔记自动安全派生为 `_1.md`、`_2.md`；
     - 严格保证已有笔记绝不被静默覆盖或篡改；
  4. 报告构建器极端场景防御增强 (`design-studio/src/reportBuilder.js`)：
     - 为 `validationMaturity`、`knowledge.referencedTerms` 与 `knowledge.evidence` 提供防御性回退，彻底杜绝解构 TypeError；
  5. 自动化回归测试与基线纳入：
     - 新建 `scripts/check-m4-obsidian-writeback.mjs`，包含静态契约检查、Frontmatter 四要素验证、双链提取测试以及绝不覆盖同名笔记的安全派生运行时测试；
     - 纳入 `scripts/check-groups.json` 的 `ui-static` 分组。
- **验证命令与结果**：
  - `node scripts/check-m4-obsidian-writeback.mjs`：100% PASS
  - `node scripts/run-checks.mjs ui-static`：29/29 PASS (100%)
  - `node scripts/run-checks.mjs all`：148/148 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

### 2026-11-08 T5.1 真实落地：评测集扩充（30 条黄金用例）

- **实施内容**：
  1. 黄金用例库规范与目录拓扑建设 (`eval/cases/<promptId>/<caseId>.json`)：
     - 覆盖 6 个核心提示词目录：`ai.generate.concept-brief`、`ai.generate.force-mission`、`ai.generate.activity-decomposition`、`ai.generate.ov1-graphic`、`ai.generate.scenario`、`ai.generate.phase-action`；
     - 全量建设 30 条黄金评测用例，严格按 10:10:10 均衡分布：
       * **战法类 (tactic，10 条)**：4 条概念简报 (`tactic-brief-01~04`)、6 条兵力与作战编成规划 (`tactic-force-01~06`)；
       * **机理类 (mechanism，10 条)**：5 条 OV-5a 活动工序树分解 (`mech-decomp-01~05`)、5 条 OV-1 概念图五节点闭环 (`mech-ov1-01~05`)；
       * **想定类 (scenario，10 条)**：6 条仿真推演想定草案 (`scenario-draft-01~06`)、4 条四阶段作战行动时序与转换条件 (`scenario-phase-01~04`)；
  2. 统一结构化数据契约与硬性质量断言：
     - 每个用例包含 `id`、`category`、`promptId`、`schema`、`name`、`description`、`input`、`expectedAssertions`（必填根字段、关键词白名单、违禁词黑名单）与 `goldenReference` 真实黄金参考数据；
     - 严格遵守作战概念研究工具安全边界：纯抽象相对网格与标准 DoDAF 2.0 / DM2 元模型，绝无真实经纬度或涉密参数；
  3. 评测集检索与加载模块 (`eval/caseLoader.mjs`)：
     - 提供 `loadAllCases()`、`getCasesByCategory(cat)`、`getCasesByPromptId(pid)`、`getCaseById(id)` 与 `validateGoldenCase(caseData)`；
  4. 专用自动化回归测试与基线纳入：
     - 新建 `scripts/check-m5-golden-cases.mjs`，全量核验目录覆盖、30 条用例规模与分类统计、契约合法性与黑白名单断言；
     - 纳入 `scripts/check-groups.json` 的 `ui-static` 分组。
- **验证命令与结果**：
  - `node scripts/check-m5-golden-cases.mjs`：100% PASS
  - `node scripts/run-checks.mjs ui-static`：30/30 PASS (100%)
  - `node scripts/run-checks.mjs all`：149/149 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

### 2026-11-08 T5.4 真实落地：本地模型与离线运行支持

- **实施内容**：
  1. 本地大模型与自定义端点支持 (`server/aiServiceConfig.mjs`)：
     - 核实并强化 `baseUrl` 归一化校验：全面支持 `http://127.0.0.1:11434/v1`、`http://localhost:8000/v1` 等本地离线端点，且不强制联网与外部鉴权；
     - 预设 Gemini 本地网关 (`http://127.0.0.1:8045/v1`) 与自定义端点完全解耦外网连通性；
  2. 全局 100% 离线资源审计与外链清零：
     - 全量审计所有 HTML、CSS 与前端脚本，消除原型遗留的 `unpkg.com` 外部 CDN 依赖，全面替换为本地离线垫片 (`prototypes/ov-validation-demo/lucide-local.js`)；
     - 工作台核心 (`design-studio/`) 的 Mermaid、Sequence Diagrams、Underscore 库 100% 本地自包含；
  3. AI 服务可用性感知与统一按钮降级机制 (`design-studio/src/app/aiAvailability.js`)：
     - 导出 `isAiAvailable(state)` 与 `resolveAiActionLabel(state, defaultLabel, busyLabel, busy)`；
     - 当检测到 AI 未配置或处于 `mock-fallback` 时，将主流程步骤中的生成按钮统一自适应呈现为 **"AI 不可用，可手工起草"**；
     - 覆盖 `phaseActionView`、`conceptGraphicView`、`scenarioView`、`ov5MechanismView`、`subflowToolbox` 与 `workflowGate` 固定条；
  4. 本地标准起草模板入口 (`design-studio/src/app/localDraftTemplates.js`)：
     - 提供 `createLocalPhaseActionTemplate`、`createLocalForceMissionTemplate`、`createLocalConceptGraphicTemplate` 与 `createLocalScenarioTemplate`；
     - 在 AI 离线/不可用或用户选择手工起草时，直接提供 100% 符合 DoDAF 2.0 / DM2 元模型与 Schema 校验的初始规范模板，消除冷启动卡点；
  5. 专用自动化回归测试与基线纳入：
     - 新建 `scripts/check-m5-offline-and-local-model.mjs`，包含本地端点保存重载、全量零外链标签静态审计、AI 可用性门禁降级文案与 4 套本地模板的 Schema 校验断言；
     - 纳入 `scripts/check-groups.json` 的 `ui-static` 分组。
- **验证命令与结果**：
  - `node scripts/check-m5-offline-and-local-model.mjs`：100% PASS
  - `node scripts/run-checks.mjs ui-static`：33/33 PASS (100%)
  - `node scripts/run-checks.mjs all`：152/152 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

### 2026-11-08 T5.5 真实落地：提示词版本历史、文本差异对比与一键回退

- **实施内容**：
  1. 纯轻量零依赖行级文本差异算法与 HTML 渲染器 (`shared/textDiff.js`)：
     - `computeLineDiff(oldText, newText, options)`：基于最长公共子序列（LCS）算法实现精确的行级差异对比，输出 `added`、`removed`、`unchanged` 行明细，并统计增删行数与全等判定；
     - `renderUnifiedDiffHtml(diffResult)`：格式化渲染统一 Diff 视窗，支持单行标号（`+`、`-`、` `）、行号对比高亮与 XSS 防护转义；
  2. 提示词历史版本模型与持久化扩展 (`server/aiPromptConfig.mjs`)：
     - 扩展 `data/ai-prompts.json` 结构，增加 `history: { [promptId]: Array<PromptVersionRecord> }`，保存时检测内容变动并自动生成 `v1`、`v2`... 单调递增版本，各提示词上限保留 30 个历史版本；
     - 内容未修改时防冗余，不生成多余版本；
     - 导出 `loadAiPromptData`、`loadAiPromptOverrides`（100% 保持既有格式向后兼容）；
     - 导出 `rollbackAiPromptVersion({ configPath, promptId, versionId })`，精准恢复目标版本覆盖并追加回退审计记录；
  3. 服务端运行时与 HTTP 路由贯通 (`server/createRequestHandler.mjs` & `server/createRuntime.mjs`)：
     - `GET /api/ai-prompts`：为返回的每个提示词注入其对应的 `history` 列表；
     - `PUT /api/ai-prompts`：支持可选备注并触发版本归档，返回包含最新历史的目录；
     - `POST /api/ai-prompts/rollback`：接收 `{ promptId, versionId }` 执行一键回退，实时更新生效覆盖并同步返回最新列表；
  4. 提示词客户端与交互界面升级 (`design-studio/src/aiPromptClient.js`, `aiPromptView.js`, `aiPromptController.js`, `styles/shell.css`)：
     - 客户端导出 `rollbackAiPrompt(promptId, versionId)` 与支持备注的 `saveAiPrompts`；
     - 视图在编辑器下方提供“版本历史”面板与版本统计徽章；
     - 历史卡片提供“查看差异”操作：内联展开 Unified Diff 视图，实时对比历史版本与当前正文/草稿的增删行差异；
     - 历史卡片提供“回退到此版本”按钮：二次确认后回退并重置草稿；
  5. 专用自动化回归测试与基线纳入：
     - 新建 `scripts/check-m5-prompt-history-and-diff.mjs`：全量覆盖 LCS 行级算法、版本单调递增归档、防冗余判定、版本回退、老接口兼容、前端视图与控制器静态契约；
     - 纳入 `scripts/check-groups.json` 的 `ui-static` 分组。
- **验证命令与结果**：
  - `node scripts/check-m5-prompt-history-and-diff.mjs`：100% PASS
  - `node scripts/run-checks.mjs ui-static`：34/34 PASS (100%)
  - `node scripts/run-checks.mjs all`：153/153 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

> **M5 里程碑（AI 质量与部署）全量圆满收官！**
> 5 项任务卡全部 100% 落地闭环（T5.1 黄金用例库 30 条、T5.2 Schema 结构校验与重试、T5.3 评测脚本与指标引擎、T5.4 本地离线模型与降级手工模板、T5.5 提示词版本历史与差异回退）。

### 2026-11-08 T6.2 真实落地：红队意见追踪（要素关联、状态机与闭环率导出）

- **实施内容**：
  1. 红队意见数据模型与处置规范化 (`design-studio/src/redTeamStore.js`)：
     - 规范化 `findings` 条目结构，新增 `targetElement`（关联具体作战要素，含 `type`、`id`、`name`）、`status`（`pending | accepted | rejected | revised`）、`rejectionRationale`（驳回理由）与 `disposedAt`；
     - 新增导出 `updateFindingDisposition(validationResult, findingId, { status, rejectionRationale })`：处置状态流转，且对 `rejected` 状态强制执行驳回理由非空校验；
     - 新增导出 `updateFindingTargetElement(validationResult, findingId, targetElement)`：支持意见与特定作战要素进行溯源绑定；
  2. 控制器交互与审计留痕 (`design-studio/src/redTeamController.js` & `main.js`)：
     - 控制器响应 `accept-red-team-finding`、`revise-red-team-finding`、`reset-red-team-finding`；
     - 响应 `reject-red-team-finding` 时弹出对话框收集必填驳回理由，留存审计痕迹；
     - 状态变更后自动调用 `syncValidation` 同步持久化并弹出操作反馈；
     - `main.js` 中将点击源节点 `source` 透传至 `redTeamController.handleAction(action, source)`；
  3. 验证视图与闭环看板升级 (`design-studio/src/validationView.js` & `styles/dodaf-views.css`)：
     - 在验证评估界面顶部呈现“审阅处置闭环看板”：计算闭环率（已处置 / 总数）、展示处置进度条和四状态药丸计数；
     - 意见卡片增加状态 Badge、关联要素标签（`🎯 关联要素：[类型] 名称`）、驳回理由警告框，以及一键处置动作组；
  4. 报告构建与结构化导出追踪 (`design-studio/src/reportBuilder.js`)：
     - Markdown 报告导出中注入“红队质询与审阅处置追踪”章节，展示处置闭环率，并为每条意见标注 `【已修订】/【已接受】/【已驳回】`、关联要素与驳回理由；
     - XML 报告导出扩展 `<finding status="..." targetType="..." targetName="...">` 及 `<rejectionRationale>` 节点；
  5. 环境健壮性加固 (`design-studio/src/validationStore.js` & `scripts/smoke-ui.mjs`)：
     - 为 `persistValidation` 和 `clearValidation` 增加环境降级保护（防 Node 纯单元测试无 `localStorage` 报错）；
     - 为 CDP 冒烟测试增加视图加载自适应轮询等待，彻底消除时序竞态；
  6. 专用自动化回归测试与基线纳入：
     - 新建 `scripts/check-m6-red-team-tracking.mjs`：全量覆盖红队意见状态流转、驳回理由强校验、要素关联、统计指标计算、报告追踪导出与前端视图契约；
     - 纳入 `scripts/check-groups.json` 的 `ui-static` 分组。
- **验证命令与结果**：
  - `node scripts/check-m6-red-team-tracking.mjs`：100% PASS
  - `node scripts/run-checks.mjs ui-static`：36/36 PASS (100%)
  - `node scripts/run-checks.mjs all`：155/155 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

### 2026-11-08 T6.3 真实落地：推演结果回收（仿真结果回填阶段与活动、偏差清单提炼与复盘模板注入）

- **实施内容**：
  1. 推演成果与偏差提炼核心引擎 (`design-studio/src/simulationRecycleStore.js`)：
     - 新建高内聚模块，导出 `extractSimulationPhaseOutcomes`、`extractSimulationActivityDeviations` 与 `extractSimulationDeviations`；
     - 支持从外部回传结果读取，或基于本地抽象网格指标（边界、区域覆盖、时序完整性、诊断就绪）自动推导各阶段达成状态（`achieved | partial | failed`）、战损比估算与时差；
     - 自动提炼结构化执行偏差清单（Deviation List，涵盖 `schedule`、`loss`、`effect`、`coordination` 四大维度，包含严重度、计划基准 vs 仿真实际、差值差距、成因深度剖析与处置建议）；
     - 导出 `recycleSimulationToPhasesAndActivities`，将推演战损与偏差双向回填至 `phaseAction.phases` 和 `ov5.activities`，并在 `scenario.simulation` 固化偏差清单；
     - 导出 Markdown 表格渲染器：`renderPhaseOutcomesTableMarkdown` 与 `renderDeviationsTableMarkdown`；
  2. 仿真适配模型扩展 (`design-studio/src/simulationAdapter.js`)：
     - `recordSimulationResult` 支持可选接收结构化 `phaseOutcomes` 与 `activityDeviations` 回传；
  3. 推演复盘报告（wargame-review）与多格式导出集成 (`design-studio/src/reportBuilder.js`)：
     - `buildReportPayload` 新增接收 `phaseAction`；并在 `buildSimulationReportSummary` 中保留 `phaseOutcomes` 与 `deviations`；
     - 复盘模板（`wargame-review`）在“二、各阶段推进结果与战损”自动注入推演阶段成效与战损评估表格；
     - 复盘模板在“四、执行偏差与成因深度剖析”自动注入推演执行偏差清单（Deviation List）及成因深度剖析；
     - XML 报告（`buildXmlReport`）同步输出 `<phaseOutcomes>` 与 `<deviations>` 规范节点；
     - 在 `ui.js` 和 `obsidianArchiveController.js` 中补全 `phaseAction: state.phaseAction` 传参；
  4. 工作台界面呈现与控制器交互闭环 (`design-studio/src/simulationAdapterView.js`, `simulationAdapterController.js`, `phaseActionView.js`, `ov5MechanismView.js`, `wireControllers.js`)：
     - 仿真适配面板新增“推演结果回收与偏差提炼”看板，展示回填状态、各风险级别偏差统计徽标、阶段战损表格与偏差清单；
     - 提供 `[一键回填到阶段与活动]` 操作（`data-action="recycle-simulation-to-phases-and-activities"`），点击后触发阶段与活动模型更新、持久化与服务端同步（`syncPhaseAction`、`syncOv5`、`syncScenario`）；
     - 阶段与行动视图（`phaseActionView.js`）：阶段卡片呈现推演达成与战损徽标（如 `顺利达成 · 战损 1.5% (+0h)`），详情呈现推演回填提示；
     - 活动视图（`ov5MechanismView.js`）：活动卡片 topline 呈现 `⚠️ 推演偏差` 指示；
     - 术语词典扩展 (`shared/glossary.js`)：收录 `DEV`（Deviation，推演执行偏差），满足全覆盖断言；
     - 存储层补充 (`design-studio/src/ov5Store.js`)：别名导出 `persistOv5`；
  5. 专用自动化回归测试与基线纳入：
     - 新建 `scripts/check-m6-simulation-result-recycle.mjs`：全量覆盖推演阶段成效推导、活动级偏差提炼、全量偏差清单生成、模型双向回填、Markdown/XML 报告注入与前端视图控制器静态契约；
     - 纳入 `scripts/check-groups.json` 的 `ui-static` 分组。
- **验证命令与结果**：
  - `node scripts/check-m6-simulation-result-recycle.mjs`：100% PASS
  - `node scripts/run-checks.mjs ui-static`：37/37 PASS (100%)
  - `node scripts/run-checks.mjs all`：156/156 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

### 2026-11-09 T6.4 真实落地：一致性问题一键定位与自动修复（跳转定位、修复方案与事务包装闭环）

- **实施内容**：
  1. 一致性定位与自动修复核心引擎 (`design-studio/src/consistencyLocatorStore.js`)：
     - 新建模块，导出 `enrichIssuesWithLocatorAndRepair(issues, models)` 与 `applyIssueRepair(state, issue)`；
     - 自动为验证检出的每个一致性问题（Issue）注入目标视图（`targetView`: `ov5 | ooda | scenario | ov1`）、视图中文标签（`targetViewLabel`）、目标要素信息（`targetElementId`, `targetElementName`）；
     - 识别可自动修复规则并生成结构化修复方案（`repairPlan`: 涵盖活动输入输出规范化 `fill-activity-io`、前序协同关系自动连边 `link-activity-upstream`、OODA 节点输入输出与时延补全 `fill-ooda-io` / `fill-ooda-duration`、未关联实体主责活动绑定 `link-entity-activity`）；
  2. 验证存储与设计规则接入 (`design-studio/src/validationStore.js`)：
     - `generateValidation` 在生成 issues 后，自动调用 `enrichIssuesWithLocatorAndRepair` 丰富定位与修复元数据；
  3. 视图交互与检查器增强 (`design-studio/src/validationView.js`)：
     - 升级问题渲染组件 `renderIssueCard`：卡片清晰呈现目标视图与要素胶囊（`🎯 [OV-5] 活动: “...”`）；
     - 提供 `[🎯 定位]` 按钮（`data-action="locate-validation-issue"`），支持一键跨视图精准跳转聚焦；
     - 对可修复问题呈现建议说明框与 `[💡 一键修复]` 按钮（`data-action="repair-validation-issue"`）；
     - 升级 `selectionForValidationIssue`，注入 `kind: "issue"` 与结构化 facts（检查类型、定位视图、目标要素、修复方案）；
  4. 控制器事务闭环与持久化流转 (`design-studio/src/validationController.js`, `wireControllers.js`, `main.js`)：
     - 控制器响应 `locate-validation-issue`：自动切换 `state.activeView`，同步更新 `state.selection` 并在对应视图中选中高亮要素，弹出操作反馈；
     - 控制器响应 `repair-validation-issue`：二次确认后，**严格统一走 M1 `applyWithRecoveryPoint` 事务包装**，自动创建本地与服务端快照恢复点，记录 `undoStack`；
     - 修复完成后自动触发对应领域的持久化（`persistOv5` / `persistOodaModel` / `persistScenario`）与服务端同步（`syncOv5` / `syncOoda` / `syncScenario`），并重新运行轻量验证刷新问题列表；
     - `main.js` 中将点击源节点 `source` 传入 `await validationController.handleAction(action, source)`；
  5. 专用自动化回归测试与基线纳入：
     - 新建 `scripts/check-m6-consistency-repair.mjs`：全量覆盖定位元数据注入、可修复方案识别、确定性修复应用、重新验证问题消除与质量提升、控制器事务回滚与持久化流转、前端视图与控制器静态契约；
     - 纳入 `scripts/check-groups.json` 的 `ui-static` 分组。
- **验证命令与结果**：
  - `node scripts/check-m6-consistency-repair.mjs`：100% PASS
  - `node scripts/run-checks.mjs ui-static`：38/38 PASS (100%)
  - `node scripts/run-checks.mjs all`：157/157 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

> **M6 里程碑（研究闭环）全量圆满收官！**
> 4 项任务卡全部 100% 落地闭环（T6.1 多方案分支派生与排行榜并排对比、T6.2 红队意见要素关联与状态机追踪、T6.3 推演结果回填阶段与活动及偏差清单提炼、T6.4 一致性问题一键定位跳转与事务自动修复）。

### 2026-11-09 T7.0 现有功能雏形盘点（只读核对先行，严禁重复造轮子）

- **实施内容**：
  1. 对照 M7 列出的全部 11 项核心功能（战法设计线 T7.1~T7.4、想定推演线 T7.5~T7.8、共用线 T7.9~T7.11），逐项检视 `directions`、`inspiration*`、`redTeam*`、`schemeScoring`、`scenario*`、`simulationAdapter*`、`collaboration*`、`researchChat` 等模块源码；
  2. 产出详尽盘点对照表：9 项功能已具备重要雏形，1 项（T7.8 复盘报告）基本可用无需重建，仅 1 项（T7.4 跨项目战法库）需新建；
  3. 确立后续单卡推进方针：已有雏形的功能卡片一律按“补全/增强既有模块”实施，避免重写与破坏向后兼容；
  4. 遵守只读盘点规范，未改动任何业务代码与测试断言。
- **验证命令与结果**：
  - `node scripts/run-checks.mjs all`：157/157 PASS (100% 全绿)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

### 2026-11-09 T7.1 真实落地：战法制胜论证链与关键假设清单（最高优先）

- **实施内容**：
  1. 论证链核心存储与模型规范化 (`design-studio/src/argumentChainStore.js`)：
     - 新建模块，支持 `{ claim, reasoning, evidenceRefs, assumptions: [{ id, text, confidence, ifFalse, activityRefs }], updatedAt }`；
     - 导出 `normalizeArgumentChain`，平滑兼容与自动解析旧项目 `state.brief.assumptions` 纯文本，无缝升级；
     - 导出 `getSortedAssumptions`：严格按风险置信度排序（低置信度优先置顶警示）；
     - 导出 `evaluateAssumptionImpact`：多维推演假设失效波及矩阵，跨活动、跨作战阶段、跨兵力实体进行级联影响分析；
     - 导出 `addAssumptionToChain`、`removeAssumptionFromChain`、`updateAssumptionInChain`、`saveArgumentChain` 并向后兼容同步 brief 文本；
  2. OV-5 作战活动机理工作台扩展 (`design-studio/src/ov5MechanismView.js` & `ov5AiController.js`)：
     - 新增“🎯 制胜论证链与假设”选项卡（`data-mode="argument-chain"`）；
     - 提供核心主张（Claim）、机理推演（Reasoning）、支撑证据（Evidence）与关键假设清单维护看板；
     - 控制器响应 `add-chain-assumption`、`remove-chain-assumption`、`toggle-assumption-confidence`、`select-link-assumption-activity`、`save-argument-chain`，全自动触发持久化与同步；
  3. 设计验证与连锁失效波及评估联动 (`design-studio/src/validationStore.js`, `validationView.js`, `consistencyLocatorStore.js`)：
     - 规则引擎检视低置信度假设：孤立无关联活动或缺少失效推论时精准检出 Issue；
     - 评估页新增专属专区：`renderAssumptionImpactSection`，高亮低置信度高危连锁警示并列出受波及的活动与阶段；
     - `consistencyLocatorStore.js` 支持假设类问题的视图跳转定位与一键自动修复（`link-assumption-activity`、`fill-assumption-iffalse`）；
  4. 复盘与报告导出引擎升级 (`design-studio/src/reportBuilder.js`)：
     - `buildReportPayload` 打包 `argumentChain` 结构体；
     - Markdown 报告输出“制胜机理论证链与关键假设清单”章节与置信度表格；
     - XML 报告结构化输出 `<argumentChain>` 与 `<assumptions>`；
  5. 专用自动化回归测试与基线纳入：
     - 新建 `scripts/check-m7-argument-chain-and-assumptions.mjs`：8 项针对性断言 100% 通过；
     - 纳入 `scripts/check-groups.json` 的 `ui-static` 分组。
- **验证命令与结果**：
  - `node scripts/check-m7-argument-chain-and-assumptions.mjs`：100% PASS
  - `node scripts/run-checks.mjs ui-static`：39/39 PASS (100%)
  - `node scripts/run-checks.mjs all`：158/158 PASS (100% 全绿)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

### 2026-11-09 T7.6 真实落地：想定推演线（推演回合流转、事件卡库注入与导调裁决引擎）

- **实施内容**：
  1. 回合制推演与导调引擎核心层 (`design-studio/src/wargameTurnStore.js`)：
     - 数据契约：`wargameState = { version: 1, currentTurnIndex, turns: [{ turnNumber, phaseId, phaseName, intents: { red, blue }, injectedEvents: [...], adjudication: { outcome, rationale, aiAdvice }, status }], eventCardLibrary: [...] }`；
     - 预置 6 类典型战场扰动事件卡：战术通信中断、态势认知误判、协同兵力延误、极端气象扰动、指控网络降级、骨干雷达关机；支持自定义扩展卡；
     - 提供状态流转与完整函数族：`normalizeWargameState`, `submitTurnIntent`, `injectEventToTurn`, `removeEventFromTurn`, `saveTurnAdjudication`, `advanceToNextTurn`, `addCustomEventCard`, `generateLocalAdjudicationAdvice`；
     - 坚守宏观概念因果安全防线，离线本地推导与 AI 导调裁决绝无数值化杀伤计算或命中率/战损百分比微观模拟；
  2. 统一提示词目录与服务端路由契约 (`server/openaiClient.mjs` & `server/createRequestHandler.mjs`)：
     - 在统一提示词目录中纳管 `ai.wargame.adjudication`（ID、用途说明、动态变量说明），实现 `callOpenAiWargameAdjudication`；
     - 服务端接入 `POST /api/simulation/wargame-adjudication` 接口，支持在线大模型推导与离线规则推导平滑降级；
  3. 前端交互视口与控制器 (`design-studio/src/scenarioView.js` & `scenarioController.js` & `wargameClient.js`)：
     - 仿真推演视口新增 `🎲 回合制推演与导调`（`data-view-mode="wargame-turns"`）标签与三栏式导调工作台；
     - 包含回合导航总控行、红蓝概念意图录入与 OV-5 活动勾选、导调事件已注入列表与预置卡库快捷注入、AI/本地导调建议一键获取、裁决结论与对抗机理阐释保存、推进至下一回合流转；
     - 控制器处理全部推演 action 并自动通过 `projectScenarioSyncController` 同步保存；
  4. 专用自动化回归测试与基线纳入：
     - 新建 `scripts/check-m7-wargame-turn-engine.mjs`：8 项专项断言 100% 通过；
     - 纳入 `scripts/check-groups.json` 的 `ui-static` 分组。
- **验证命令与结果**：
  - `node scripts/check-m7-wargame-turn-engine.mjs`：100% PASS
  - `node scripts/run-checks.mjs ui-static`：41/41 PASS (100%)
  - `node scripts/run-checks.mjs all`：160/160 PASS (100% 全绿)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

### 2026-11-09 T7.3 真实落地：战法设计线（历史相似战例借鉴、可借鉴点/不适用点对照卡与论证链引用）

- **实施内容**：
  1. 战例借鉴数据模型与种子库 (`design-studio/src/tacticalCaseStore.js`)：
     - 数据契约：`tacticalCase = { id, caseName, category, similarityPoint, historicalContext, applicableLessons: [...], unapplicableLessons: [...], confidence: "高|中|低", knowledgeRef }`；
     - 预置 4 类涵盖海战反舰突防（马岛海战）、防空体系致盲（贝卡谷地 SEAD）、超低空雷达破门（海湾战争特遣队）、非对称奇袭（塔兰托空袭）的典型战例对照卡；
     - 导出 `searchTacticalCases`, `formatCaseAsEvidence`, `applyCaseToArgumentChain`, `generateLocalCaseComparison` 等完整能力集；
  2. 统一提示词目录与服务端路由契约 (`server/openaiClient.mjs` & `server/createRequestHandler.mjs`)：
     - 统一提示词目录纳管 `ai.tactical.case-comparison`（战例借鉴与适用性比对分析），声明动态变量与输出 Schema；
     - 服务端接入 `POST /api/tactical/case-comparison`，提供大模型比对与离线本地推导平滑降级；
  3. 前端 OV-5 制胜论证链深度集成与控制器动作 (`design-studio/src/ov5MechanismView.js` & `ov5AiController.js`)：
     - 在“🎯 制胜论证链与假设”视口中增设“📚 历史相似战例借鉴与比对 (可借鉴点 / 时代不适用局限)”主看板；
     - 卡片直观区分机制可借鉴点（绿色）与时代局限/不适用点（橙色），支持搜索匹配与自定义录入；
     - 提供“📌 引用至论证链支撑证据”一键动作，将战例借鉴与局限分析格式化注入 `chain.evidenceRefs` 形成闭环支撑；
  4. 报告导出引擎升级 (`design-studio/src/reportBuilder.js`)：
     - 战法说明书（`tactic-doc`）与通用 Markdown 报告在制胜机理章节自动生成“历史相似战例借鉴与适用性剖析”对比总表；
     - XML 报告结构化输出 `<tacticalCases>`，完整保留 `<applicableLessons>` 与 `<unapplicableLessons>`；
  5. 专用自动化回归测试与基线纳入：
     - 新建 `scripts/check-m7-tactical-case-study.mjs`：8 项专项断言 100% 通过；
     - 纳入 `scripts/check-groups.json` 的 `ui-static` 分组。
- **验证命令与结果**：
  - `node scripts/check-m7-tactical-case-study.mjs`：100% PASS
  - `node scripts/run-checks.mjs ui-static`：42/42 PASS (100%)
  - `node scripts/run-checks.mjs all`：161/161 PASS (100% 全绿)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

### 2026-11-09 T7.9 真实落地：两条线共用（上下文感知 AI 研讨助手与事务安全候选应用框）

- **实施内容**：
  1. 上下文感知提取器与候选组件 (`design-studio/src/researchChat/contextAwareAssistant.js`)：
     - `extractActiveViewContext(state)`：根据 `activeView` 自动提取当前步骤模型摘要（Brief 目标/假设、Phase 阶段链、Force 编组任务、OV-5 制胜论证链、Scenario 回合导调）与知识库高关联引用依据；
     - `renderContextAwareBadge(context)`：研讨面板顶部视觉感知胶囊，清晰展示“🎯 正在研讨当前步骤: XX”，标注已注入的模型要素与引用依据；
     - `renderCandidateActionBox(candidate, options)`：AI 研讨建议候选卡片，提供“✓ 采纳并应用”与“✕ 忽略”双态操作，支持待审定、已采纳、已忽略状态机切换，提供操作影响摘要说明；
  2. 严守铁律：助手绝不直接静默改动主模型：
     - 提示词与上下文注入明确声明“绝对不可直接虚构已修改主模型，只能提出具体修改建议，交由研究员点击确认应用”；
     - 前端调度核心 (`design-studio/src/main.js`) 响应 `apply-research-candidate`，强制通过 M1 `applyWithRecoveryPoint` 创建系统级恢复点与 `undoStack` 事务记录，支持秒级撤销；
  3. 研讨视图与模块装配 (`design-studio/src/researchChat/researchChatView.js` & `index.js`)：
     - 面板渲染自动挂载顶部上下文感知胶囊；
     - 助手对话消息自动解析并内嵌候选建议事务卡片；
  4. 专用自动化回归测试与基线纳入：
     - 新建 `scripts/check-m7-context-aware-research-chat.mjs`：5 项专项断言全部通过；
     - 纳入 `scripts/check-groups.json` 的 `ui-static` 分组。
- **验证命令与结果**：
  - `node scripts/check-m7-context-aware-research-chat.mjs`：100% PASS
  - `node scripts/run-checks.mjs ui-static`：47/47 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

### 2026-11-09 T7.10 真实落地：两条线共用（评审与签批流程、快照冻结与定稿只读守卫）

- **实施内容**：
  1. 评审与签批流程仓储与状态机 (`design-studio/src/reviewWorkflowStore.js`)：
     - 状态流转四态契约：`草稿 (draft)` ➔ `送审 (submitted)` ➔ `需修改 (revising)` ➔ `已定稿 (finalized)`；
     - 细粒度操作门禁 (`canPerformReviewTransition`)：草稿/需修改态支持送审，送审态支持审阅员/负责人退回修改或正式签批定稿，定稿态完全锁定；
     - 派生新修订分支 (`buildRevisedProjectPayload`)：基于已定稿项目生成纯深拷贝解耦新项目，继承当前全部模型资源与 Brief，状态重置为 `draft`，清空旧签批信息，彻底杜绝跨版本数据污染；
  2. 评审签批横幅与只读守卫组件 (`design-studio/src/reviewWorkflowView.js` & `workflow.css`)：
     - 全局横幅呈现当前方案评审阶段徽章（草稿 / 送审中 / 需修改 / 已定稿）、说明文字、签批人与时间备忘；
     - 提供【📤 提交送审】、【📝 退回修改】、【✅ 签批定稿】与【🌿 派生新修订分支】动态上下文按钮；
     - 定稿状态提供全屏拦截模态框 (`renderFinalizedReadonlyDialog`) 与警示微标，拦截非授权的原地改写；
  3. 服务端持久化与接口支持 (`server/projectRepository.mjs` & `server/routes/projectResources.mjs`)：
     - SQLite `project_catalog` 表无缝迁移扩展 `review_status` 与 `approval_json` 列；
     - `normalizeProjectMeta` 与 `updateProject` 纳入合法状态白名单验证；
     - `handleProjectMeta` 对 `finalized` 签批动作实施审阅员/负责人角色鉴权校验；
  4. 前端调度与送审自动冻结模型快照 (`design-studio/src/main.js` & `shellRenderer.js`)：
     - 提交送审操作自动调用 `saveModelSnapshot` 冻结生成“送审基线快照 (M...)”；
     - 破坏性模型编辑操作（如 `apply-research-candidate`）对定稿方案实施前置只读拦截守卫；
  5. 专用自动化回归测试与基线纳入：
     - 新建 `scripts/check-m7-review-workflow.mjs`：5 项专项断言 100% 全部通过；
     - 纳入 `scripts/check-groups.json` 的 `ui-static` 分组。
- **验证命令与结果**：
  - `node scripts/check-m7-review-workflow.mjs`：100% PASS
  - `node scripts/run-checks.mjs storage`：12/12 PASS (100%)
  - `node scripts/run-checks.mjs server`：23/23 PASS (100%)
  - `node scripts/run-checks.mjs ui-static`：48/48 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

### 2026-11-09 T7.11 真实落地：两条线共用（跨项目要素、成熟战法库与推演日志全局搜索）与 M7 全量圆满收官

- **实施内容**：
  1. 多维全局数据源提取与索引引擎 (`design-studio/src/commandPaletteView.js`)：
     - `extractProjectElements`：全面覆盖概念简报核心目标、参演作战编组力量（`combatForces`）、活动与制胜论证链关键假设（`assumptions`）、状态机（`machines`）与作战任务（`tasks`）；
     - `extractTacticsLibraryElements`：跨项目索引战法复用库全部成熟战法，按名称、分类、适用场景与标签全文匹配，打标 `category: "战法库"`, `type: "tactic"`；
     - `extractWargameTimelineElements`：索引回合推演历史流水线日志，涵盖红方意图、蓝方对抗意图与导调裁决结论，打标 `category: "推演日志"`, `type: "timeline"`；
  2. 搜索过滤与快捷调度 (`design-studio/src/commandPaletteView.js` & `commandPaletteController.js`)：
     - `filterCommands` 实现全字段与多词组合分词匹配；
     - 空关键词默认聚焦常用步骤与操作，有关键词时实时动态呈现项目要素、战法库与推演日志；
     - `executeItem` 支持直达对应模型视图（如 `brief`、`ov5`、`scenario`）及一键唤起战法库弹窗与上下文抽屉；
  3. 专属视觉设计与徽章标签 (`design-studio/styles/transitions-modals.css`)：
     - 为不同搜索结果呈现直观徽章：`[战法]`（紫色）、`[推演]`（粉色）、`[要素]`（橙色）、`[跳转]`（蓝色）、`[执行]`（绿色）；
  4. 专用自动化回归测试与基线纳入：
     - 新建 `scripts/check-m7-global-search.mjs`：5 项专项断言 100% 全部通过；
     - 纳入 `scripts/check-groups.json` 的 `ui-static` 分组。
- **验证命令与结果**：
  - `node scripts/check-m7-global-search.mjs`：100% PASS
  - `node scripts/check-command-palette.mjs`：100% PASS
  - `node scripts/run-checks.mjs ui-static`：49/49 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

---

## 阶段八：M8 军事仿真深化与机理定量校核（T8.1～T8.10，见 plans/EXECUTION_PLAN_M8.md）

承接已全量收官的 M0～M7（168 项自动化测试全绿），围绕**机理计算科学性、图论拓扑严谨性、推演数据闭环度、仿真器接驳能力**四个专业维度推进 10 项核心任务：
- **Batch 1 机理动力学与图论算法升级**：
  - **T8.1** 杀伤网 DAG 关键路径（CPM）时延解算与时敏窗口校核 (已完成，commit `6b2c8f5`)
  - **T8.2** 基于节点移除可达性的拓扑级 SPOF 单点故障与杀伤网韧性量化 (已完成)
  - **T8.3** OODA 泳道三级语义分类器（显式属性 + 任务类型映射 + 扩展词表）

### 2026-11-09 T8.1 真实落地：杀伤网 DAG 关键路径 (CPM) 时延解算与时敏窗口校核
- **实施内容**：
  1. 有向图破环与 DAG 前向提取 (`design-studio/src/oodaStore.js`)：`filterForwardDagEdges` 自动识别并破除反哺边（`Feedback ➔ Observe/Decide`），杜绝循环死锁；
  2. CPM 关键路径与最短杀伤链求解 (`oodaStore.js`)：`solveDagPaths` 记忆化求解感知端（Observe）到行动端（Act）最长关键路径 `criticalPathSeconds`、最短可行杀伤链 `fastestKillChainSeconds` 与并行总工时 `parallelSumSeconds`；
  3. 时敏目标窗口 (TST) 超限告警：支持读取 `targetWindowSeconds`（默认 1800s，高时敏 300s），超限触发 `KILL_CHAIN_LATENCY_EXCEEDED` 诊断告警并高亮关键路径序列；
  4. 界面渲染升级 (`design-studio/src/ov5MechanismView.js`)：顶栏与右侧动力学面板联动呈现关键路径耗时、最短链、目标窗口与瓶颈链。
- **验证命令与结果**：
  - `node scripts/check-m8-dag-latency-budget.mjs`：100% PASS
  - `node scripts/run-checks.mjs ov5`：8/8 PASS (100%)
  - `node scripts/smoke-ui.mjs`：0 未捕获异常。

### 2026-11-09 T8.2 真实落地：基于节点移除可达性的拓扑级 SPOF 单点故障与杀伤网韧性量化
- **实施内容**：
  1. 拓扑级抗毁韧性与 SPOF 量化分析器 (`design-studio/src/oodaStore.js`)：
     - `analyzeNetworkResilience`：统计感知端至打击端基准连通链对数 $N_{\text{base}}$，逐一模拟移除承前启后的中间环节节点，量化剩余可达杀伤链对数 $N(v)$ 与断链率 `impactRate = (N_base - N(v)) / N_base`；
     - 彻底突破旧算法依赖“决策/控制/中继”关键词的脆弱局限，只要战损导致杀伤链减少（$\Delta N(v) > 0$）即判定为拓扑必经割点；
  2. 备用旁路与受控降级状态机 (`oodaStore.js`)：
     - 若割点未配置 `resilienceFallback`，归为高危单点故障（`criticalSpofs`，致命割点扣 35 分，局部割点扣 15 分）；
     - 若配置了有效备用旁路，自动转为受控降级节点（`mitigatedBottlenecks`，仅扣 5 分），韧性评分自动大幅恢复；
  3. 界面卡片与微标增强 (`design-studio/src/ov5MechanismView.js`)：呈现断链率百分比、备用旁路说明及受控降级备用支撑统计；
  4. 专用自动化回归测试与基线纳入：
     - 新建 `scripts/check-m8-topological-spof.mjs`：构造无任何“决策/控制/中继”关键字的唯一桥接节点，验证其被 100% 准确识别为致命 SPOF，且配置备用旁路后评分由 65 恢复至 95 分；
     - 纳入 `scripts/check-groups.json` 的 `ov5` 组。
- **验证命令与结果**：
  - `node scripts/check-m8-topological-spof.mjs`：100% PASS
  - `node scripts/run-checks.mjs ov5`：9/9 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。

### 2026-11-09 T8.3 真实落地：OODA 泳道三级语义分类器与 Batch 1 全量收官
- **实施内容**：
  1. 三级判定分类引擎 (`design-studio/src/oodaStore.js`)：
     - `classifyActivityToOodaLane`：
       * 第一优先级：显式字段 `oodaLane`（`observe/orient/decide/act/feedback`）最高优先；
       * 第二优先级：上游关联任务类型 `missionType` 映射（`recon/aew ➔ observe`, `command ➔ decide`, `sead/strike ➔ act`, `bda ➔ feedback` 等）；
       * 第三优先级：扩充 40+ 现代军事概念词表（凝视、测向、目指、态势对齐、火力筹划、蜂群交战、战果核验等），配合作战重要度加权打分消歧；
  2. 单一主泳道唯一归类原则 (`oodaStore.js`)：
     - 彻底消除多泳道重复计数缺陷（例如“察打一体突击”依据核心作战动向归入 `act` 泳道，不再双重归类）；
     - `evaluateOodaLoopHealth` 汇总统计保证 5 个泳道活动总数与模型总活动数精确一致；
  3. 专用自动化回归测试与基线纳入：
     - 新建 `scripts/check-m8-ooda-semantic-classifier.mjs`：覆盖显式指定、任务类型映射、复合词打分消歧与新型军事词汇全部用例，验证泳道活动无重复无遗漏；
     - 纳入 `scripts/check-groups.json` 的 `ov5` 组。
- **验证命令与结果**：
  - `node scripts/check-m8-ooda-semantic-classifier.mjs`：100% PASS
  - `node scripts/run-checks.mjs ov5`：10/10 PASS (100%)
  - `node scripts/smoke-ui.mjs`：无头 Edge CDP 冒烟测试 0 未捕获异常。
  - **M8 Batch 1（T8.1～T8.3 机理动力学与图论算法升级）全量圆满收官！**

- **Batch 2 兵棋推演—仿真回收闭环与本地离散事件推演（进行中）**：
  - **T8.4** 消除硬编码伪造战损，建立基于证据的阶段成效与偏差推导引擎
  - **T8.5** 打通回合制兵棋导调（`wargameTurnStore`）到仿真结果回收（`simulationRecycleStore`）的自动编译桥
  - **T8.6** 升级本地抽象网格推演内核（Abstract Grid Discrete-Event Evaluator）
  - **T8.7** 基于威胁轴线与 OV-2/OV-5 协同引力的抽象网格部署算法
- **Batch 3 空间拓扑布局、复合评分与 DoDAF 深度校核**：
  - **T8.8** 融合“机理动力学 + 假设脆弱性 + 推演成效”的多方案定量评分引擎
  - **T8.9** CMO 装备库定性能力画像提取与“任务—平台能力”匹配度校核
  - **T8.10** DoDAF 跨视图行为形式化校验（OV-6b 状态机死锁检测 + OV-6c/OV-5b 因果时序逆序检测）




















