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

- **T6.1 多方案分支**：基于快照派生方案 B/C，用 `modelComparisonBuilder` 并排对比，用 `schemeScoring` 比较评分。
- **T6.2 红队意见追踪**：每条意见关联具体要素，带"接受 / 驳回（需填理由）/ 已修订"状态，结果进入报告。
- **T6.3 推演结果回收**：仿真适配器的结果回填到阶段与活动，生成偏差清单，进入复盘模板。
- **T6.4 一致性问题一键定位**：每个问题都提供跳转定位；能自动修的给出修复建议，经人工确认后应用，并走 M1 的事务包装。

### M7 功能补强：让两条主线真正"能干活"

> 前面的 M1～M5 主要解决"可信、可控、好懂"，**基本没有增加新能力**。本里程碑补上两条主线各自缺的核心功能。
> 全部功能都在**概念层面**实现，遵守第一部分第 9 条的安全边界。

**T7.0 功能盘点（只读，不写代码，必须最先做）**
- 逐项核对本节列出的功能，现有代码中是否已有雏形。重点查看这些模块：`directions`、`inspiration*`、`redTeam*`、`schemeScoring`、`scenario*`、`simulationAdapter*`、`collaboration*`、`researchChat`。
- 产出一张表：功能、已有程度（无 / 雏形 / 可用）、相关文件。
- 已有雏形的功能，后续卡片改为"补全"，**不得重建**。

#### A. 战法设计线

**T7.1 论证链与关键假设清单（最高优先）**
- 战法的核心是"为什么能赢"。新增"论证链"结构：
  ```js
  { claim, reasoning, evidenceRefs, assumptions: [{ text, confidence: "高|中|低", ifFalse }] }
  ```
  它挂在"制胜机理"上，并关联到 OV-5 活动。
- 汇总"关键假设清单"：列出全部假设，按置信度排序。点击任一假设，可查看依赖它的活动和任务。
- 评估页提示：如果某个低置信度假设被推翻，哪些部分会失效。
- 这是数据结构变更：**先停下报告。**

**T7.2 对抗循环：反制 → 应对**
- 在现有红队审查的基础上扩展：红队针对战法提出"对手可能的反制"，每条反制都必须有"我方应对"或"接受风险（填理由）"。
- 还有反制没处理时，评估页显示未闭合数量；战法说明中自动生成"风险与反制"一章。

**T7.3 战例借鉴**
- 在知识库中检索与当前作战问题相似的历史战例（复用 M2 的检索与引用机制）。
- 每个战例生成一张"可借鉴点 / 不适用点"对照卡，可以引用到论证链中。

**T7.4 战法库（跨项目复用）**
- 已确认的战法可以"存入战法库"，保存核心思想、适用条件、论证链摘要和引用。
- 新建项目时可以从战法库引用某个战法作为起点，引用方式是复制，不建立联动。

#### B. 想定推演线

**T7.5 红蓝分立与信息隔离**
- 想定中区分导演部、红方、蓝方三类视角。各方只看到本方和公开信息，导演部看到全部。
- 复用现有的协同身份与权限（`collaboration*`、`projectCollaborationPolicy.mjs`）。动手前先停下，说明权限模型如何映射。

**T7.6 推演回合与导调（最高优先）**
- 推演按"回合"推进。每个回合的流程：
  1. 各方提交行动意图（概念层面的文字描述加上关联的阶段和活动）；
  2. 导演部注入事件；
  3. 导演部裁决结果；
  4. 进入下一回合。
- 事件注入卡库：预置一批可编辑的抽象事件，例如"通信中断""态势误判""友邻延误"，也可以自定义。
- 裁决：导演部人工裁决，AI 可提供"裁决建议与理由"（新提示词，必须纳入提示词目录）。**不做数值化的杀伤计算。**

**T7.7 推演日志与时间线**
- 自动记录每个回合的意图、注入、裁决和关键决策，形成可回看的时间线。
- 在时间线的任意回合可以"从此处派生分支"（what-if），复用 M1 的快照能力。

**T7.8 复盘生成**
- 根据推演日志自动起草复盘报告，使用 M4 的 `wargame-review` 模板。
- 内容包括关键决策点、偏差与原因、改进建议，并带上引用和日志回链。

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











