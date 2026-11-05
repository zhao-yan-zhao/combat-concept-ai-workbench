# 执行计划（第二轮）：修回归 · 清测试债 · 行为级冒烟 · 引用溯源落地（2026-11）

> 交给执行代理使用。上一轮计划见 `plans/EXECUTION_PLAN_2026-11_CONSOLIDATION.md`，那份文件里的约束（第 0 节）在本轮继续有效。
> 本轮同样**按阶段顺序执行**，每个阶段独立提交，验收通过后再进入下一阶段。

## 0. 上一轮复核结论（必读）

上一轮结构性目标都达成了：`main.js` 从 4,538 行降到 1,988 行，`styles.css` 拆成 12 个模块，`project-context.md` 压到 74 行，`run-checks.mjs` 可用。131 个检查脚本中通过 121 个，与基线持平。浏览器冒烟测试显示：登录、建项目、遍历 14 个视图，均无新增运行时异常。

但人工复核发现，**3 处行为回归没有被任何测试捕获**，另有 1 处执行记录与事实不符：

| # | 问题 | 位置 | 影响 |
|---|---|---|---|
| R1 | `dodafProductController.confirmOv1()` 和 `.seedOv1FromPlanning()` **根本不存在**。原来 `main.js` 里的内联实现（`createLocalOv1Draft` + 同步 + `completeWorkflowStage`）被替换成了对这两个不存在方法的调用 | `design-studio/src/app/bindings/dodafBindings.js:658-665` | 点击"确认总体图""基于兵力规划生成总体图"会抛 `TypeError`，OV-1 无法确认，工作流卡住 |
| R2 | `workflow-gate-quick-confirm-ov1` 动作丢失了处理分支（原来与 `confirm-ov1` 共用一个分支） | 同上；按钮定义在 `app/workflowGate.js:291` | 门禁胶囊上的"一键确认总体图"点了没有任何反应 |
| R3 | `applyOv1CandidateWithRecoveryPoint` 依赖的 `saveModelSnapshot`、`snapshotContextFromState` 在 `getDodafCtx()` 中没有传入。新代码又加了 `if (saveModelSnapshot && ...)` 防御判断，结果**恢复快照被静默跳过** | `dodafBindings.js:352-395` | 应用 AI 候选会直接覆盖 OV-1，不留恢复点，但提示语仍显示"恢复点已保存"。**这是数据安全问题** |
| R4 | 右侧"知识与上下文"弹窗（`#contextPanelDialog`）的打开、渲染、关闭逻辑在拆分时整段丢失 | 原 `main.js` 中 `renderInspectorPanel` 的后半段；现在的 `app/inspectorBindings.js:61` 只保留了前半段 | 菜单"打开知识与上下文"点击无效。这是 AGENTS.md 定义的核心能力入口 |
| R5 | `jumpFromStructureReview` 在"抽离"时被改写了：提示文案不同了；选中对象从 `selectionFor`（含 issue 映射）改成了 `select()`；还新增了 OV-3 分支 | `dodafBindings.js:224` | 违反"行为零变化"，需逐项确认是否保留 |
| D1 | 执行记录写的是"12 个模块拼接后与原 `styles.css` 逐字节 100% 一致"，**实际不一致**：换行符被改成 CRLF，约 25 处空行丢失，1 处注释被并到了上一行。目前不影响渲染，但记录失实 | `design-studio/styles/*.css` | 审计可信度 |

**根因**：测试多为静态字符串断言，覆盖不到"函数是否存在、依赖是否注入、事件是否真的接上"；`if (dep)` 式的防御判断又把缺失的依赖变成了静默失败。

**本轮新增硬约束：**

1. **禁止**对注入的依赖写 `if (dep)`、`dep?.()` 这类防御判断。依赖缺失必须直接抛错。
2. 执行记录里的每条"通过/一致"结论，都必须附上实际命令和关键输出（可截取片段）。没有证据的结论视为未完成。
3. 不再继续拆分 `main.js`，也不扩大 `stateActions` 的使用范围。等阶段 1、2 的防线建好之后，再另行立项。

## 阶段 1：修复重构回归（最高优先级）

1. **R1/R2**：以 `git show 25750d1:design-studio/src/main.js` 中 `seed-ov1-from-planning`、`confirm-ov1 || workflow-gate-quick-confirm-ov1`、`confirm-and-advance-to-concept-map` 三个分支为准，**原样迁回** `dodafBindings.js`，依赖从 ctx 注入。不要在 controller 上新增方法来"凑名字"。
2. **R3**：在 `main.js` 的 `getDodafCtx()` 中补齐 `saveModelSnapshot`、`snapshotContextFromState`、`projectModelSnapshotSyncController`、`projectOv1SyncController`，并删除 `applyOv1CandidateWithRecoveryPoint` 中的全部防御判断，恢复成与原实现一致。
3. **R4**：把原 `renderInspectorPanel` 后半段（`#contextPanelDialog` 的 cancel 绑定、`contextPanelOpen` 时渲染并 `showModal()`、否则 `close()`）迁回 `app/inspectorBindings.js`。
4. **R5**：恢复为原实现。如果认为新行为更好，单独列在执行记录中由人工决定，本阶段不合入。
5. **D1**：把 `styles/*.css` 恢复为与 `47704b3:design-studio/styles.css` 逐字节拼接一致（换行符保持原样，即 LF）。用下面的命令证明一致，并把输出贴进执行记录：
   ```bash
   git show 47704b3:design-studio/styles.css > /tmp/orig.css
   cat $(grep -oE "styles/[a-z0-9-]+\.css" design-studio/styles.css | sed 's#^#design-studio/#') | cmp - /tmp/orig.css && echo IDENTICAL
   ```
6. **新增防线测试** `scripts/check-refactor-wiring.mjs`（归入 `ui-static` 分组）：
   - **动作覆盖**：从 `git show 25750d1:design-studio/src/main.js` 提取全部 `action === "xxx"`（共 119 个），断言每个动作在新代码中都有处理分支（`action === "xxx"` 或 `case "xxx"`）。也可以把这份清单固化成 JSON 文件，不依赖 git。
   - **ctx 完整性**：扫描 `app/**/*.js` 中所有 `const { ... } = ctx`，断言每个名字在 `main.js` 对应的 `get*Ctx()` 中都有提供。
   - **controller 方法存在性**：扫描 `xxxController.method(` 调用，断言目标模块中确有该方法。
   - 写完后先在当前（未修复）代码上运行，**必须能报出 R1～R3**，以此证明测试有效；修复后再运行，应全部通过。
- 验收：`check-refactor-wiring` 通过；`run-checks.mjs all` 不差于基线（121/131）；阶段 3 的冒烟测试中，"确认总体图"和"打开知识与上下文"两个操作无异常。

### 阶段 1 操作细节（已核对到 HEAD `ba971bc`）

先导出原始实现做对照：`git show 25750d1:design-studio/src/main.js > /tmp/old-main.js`（下文行号均指这份文件）。

**`design-studio/src/app/bindings/dodafBindings.js`**

1. 顶部补导入（不要经 ctx 传，避免再出现漏传）：
   ```js
   import { project } from "../../data.js";
   import { saveModelSnapshot, snapshotContextFromState } from "../../modelSnapshotStore.js";
   import { selectionFor } from "../../ui.js";
   ```
2. **R1/R2**：把 `handleDodafAction` 中调用 `dodafProductController.seedOv1FromPlanning()` 和 `.confirmOv1()` 的两个分支，替换为 old-main.js 第 2064～2103 行的两个分支。第二个分支的条件必须是 `action === "confirm-ov1" || action === "workflow-gate-quick-confirm-ov1"`。
   - 迁移时把原来的 `return;` 改成 `return true;`。注意"尚无节点"那个提前返回也要改。
   - 在 `handleDodafAction` 顶部的 ctx 解构中加上 `invalidateValidation`。
3. **R3**：`applyOv1CandidateWithRecoveryPoint` 整体替换为 old-main.js 第 2406～2430 行的实现：
   - 动态 import 的路径改为 `"../../ov1ConceptMapController.js"`。
   - ctx 只解构 `state, render, showToast, projectModelSnapshotSyncController, projectOv1SyncController, invalidateDerivedArtifacts`。
   - 删除所有 `if (saveModelSnapshot && ...)`、`if (projectModelSnapshotSyncController)`、`if (projectOv1SyncController)`、`typeof window.confirm` 防御判断。
4. **R5**：`jumpFromStructureReview` 整体替换为 old-main.js 第 2219～2256 行的实现：
   - ctx 解构改为 `state, render, showToast, getViewMeta, getModels`。
   - `selectionFor` 用上面新增的 import。
   - 新增的 OV-3 分支（`ov3SelectedExchangeId`）先删掉，在执行记录里单独提出，由人工决定是否保留。

**`design-studio/src/main.js` 中的 `getDodafCtx()`**（约第 195 行）补三项：`projectModelSnapshotSyncController`、`invalidateValidation`、`getModels`。这三个在 main.js 里都已存在，不需要新增导入。

**R4：`design-studio/src/app/inspectorBindings.js` 中的 `renderInspectorPanel`**
- 在函数末尾追加 old-main.js 第 704～737 行，也就是从 `// Optional floating knowledge panel` 到函数结束的整段。
- 依赖 `$`、`state`、`getModels`、`getViewMeta`、`renderInspector`，当前文件都已有。
- `#contextPanelDialog` 的 `close-context-panel` 动作分支目前还在（old-main.js 第 1440 行附近），请确认它在新代码中仍有处理；如果没有，一并迁回。

**修完后自查（贴输出）：**
```bash
grep -n "seedOv1FromPlanning\|confirmOv1()\|saveModelSnapshot &&" design-studio/src/app/bindings/dodafBindings.js   # 应无输出
grep -n "workflow-gate-quick-confirm-ov1" design-studio/src/app/bindings/*.js                                      # 应有 1 处
grep -n "contextPanelDialog" design-studio/src/app/inspectorBindings.js                                            # 应有输出
```

**环境提示**：这台机器上的 `python3` 是 Windows 应用商店的占位程序，运行会以 49 退出，而且不报错、不执行。脚本化改文件请用 `node`。另外 `core.autocrlf=true`，提交前用 `git diff --stat` 确认没有整文件的换行符变更。

## 阶段 2：清理测试债（10 个历史失败用例）

逐个判定，每个都要在执行记录中写清楚结论：**过时断言 → 更新断言**、**真缺陷 → 修代码**、**功能已退役 → 移入 `archive/scripts/`**。

| 脚本 | 已知失败信息 | 初步判断（需执行代理确认） |
|---|---|---|
| `check-ai-prompt-management` | `25 !== 23` | 提交 25750d1 新增了 2 个提示词，但未更新断言；确认新增的 2 个提示词都在"AI 提示词"目录里可编辑后，把期望值改为 25 |
| `check-workflow-test-mode` | 期望"七步主线" | 主线已改为六步（提交 d2909ea），属于过时断言 |
| `check-workflow-restructuring-batch3` | 期望 OV-5a 左侧是树面板 | OV-5 左栏已改为编辑器，属于过时断言 |
| `check-contextual-model-flow` | 关联编号规则 | 需核对当前编号规则是否为有意变更 |
| `check-operational-task-step` | strictEqual 不等 | 需排查 |
| `check-dodaf-consistency-snapshot-import` | 恢复快照时 OV1b 任务引用丢失 | **可能是真缺陷（快照恢复丢数据）**，优先排查 |
| `check-dodaf-drafting-legend` | 缺少 OV-4 图例 | 需排查 |
| `check-ov1-strengthening` | 缺少 OV-1 → OV-5 的下一步 CTA | 可能因主线重排而过时 |
| `check-ov2-operational-exchange` | OV-2 XML 输出不完整 | **可能是真缺陷（导出不完整）** |
| `check-concept-map-integration` | 概念图确认后未满足阶段 5 | 可能因主线重排而过时 |

- 验收：`node scripts/run-checks.mjs all` 达到 **131/131 全绿**（或者移入归档的脚本在记录中逐一说明理由）。从这一刻起，"全绿"就是每次提交的门槛。

## 阶段 3：行为级冒烟测试（补齐真实浏览器验证）

- 底稿：`scripts/smoke-ui-cdp.draft.mjs`。它不依赖任何第三方库，通过 Chrome DevTools 协议驱动无头 Edge，已验证可用。
- 整理为正式脚本 `scripts/smoke-ui.mjs`，要求：
  1. 自己用临时目录启动一个隔离服务（全部 `*_PATH`、`*_DB_PATH` 环境变量都指向临时目录，AI 地址指向不可达端口，`CONCEPT_MAP_TOOL_ENABLED=false`），跑完后自动关闭服务。**不得触碰 `data/` 下的真实数据。**
  2. 流程：初始化账号 → 登录 → 创建项目 → 开启工作流测试模式 → 遍历全部 `data-view` → 执行"确认总体图""打开/关闭知识与上下文""OV-5 选中活动 → 编辑 → 保存"。
  3. 断言：全程**没有未捕获异常**；每个视图的 `#viewRoot` 非空；OV-5 保存后重新加载页面，数据仍然存在。
  4. Edge 路径通过 `EDGE_PATH` 环境变量覆盖；找不到浏览器时输出 `SKIP` 并以 0 退出，不要报失败。
- 同时修复冒烟测试已经暴露的两个历史问题：
  - **View Transition 异常未捕获**：快速切换视图时会抛出 `AbortError: Transition was skipped` / `TimeoutError`。需要给所有 `document.startViewTransition()` 返回对象的 `.finished`、`.ready`、`.updateCallbackDone` 加上 `.catch(() => {})`。
  - **项目 ID 输入框的 `pattern` 属性无效**：`[a-z0-9][a-z0-9_-]{1,63}` 在浏览器的 `v` 标志正则下非法（连字符需要转义），导致前端校验整个失效。应改为 `[a-z0-9][a-z0-9_\-]{1,63}`。
- 验收：`node scripts/smoke-ui.mjs` 输出"0 个未捕获异常"并以 0 退出；把它加入 `check-groups.json` 的新分组 `smoke`。

## 阶段 4：引用溯源 —— 先修订设计，再打通一条链

`plans/KNOWLEDGE_CITATION.md` 的方向是对的，但**忽略了已有的机制**，按原稿实施会造出第二套平行的引用体系。动手前先修订设计稿：

1. **盘点现有机制**，在设计稿中补一节"现有能力映射"：
   - 实体上已有的 `evidenceRefs`（`shared/dodaf/entities.js`、`products.js`）、`sourceRefs`、`provenance`；
   - `server/projectKnowledgeCitationPolicy.mjs`（敏感引用策略）、`design-studio/src/evidenceSelectionStore.js`、`derivedViewProvenance.js`；
   - `check-sensitive-citation-*`、`check-scenario-knowledge-provenance` 已覆盖的范围。
2. **在现有字段上演进**：优先把 `evidenceRefs: string[]` 升级为可兼容的结构化引用（同时接受旧的字符串格式），**不要**另起一个 `citations` 字段。如果确实必须新增字段，要写清楚与旧字段的迁移和兼容关系。
3. **只打通一条链做试点**：提示词 `ai.generate.activity-decomposition`（OV-5 活动分解）。
   - 检索命中的片段带稳定的 `chunkId` 进入提示词；
   - 要求模型在输出中按 `chunkId` 引用；
   - 服务端校验引用的 `chunkId` 确实存在于本次的检索结果中，**丢弃编造的引用**；
   - 引用落库到活动实体；
   - 在检查器中展示来源文件、章节和原文片段；
   - 报告导出时附上引用。
4. 提示词的修改必须通过"AI 提示词"目录可见、可编辑（遵守 AGENTS.md）。
5. 测试**全部使用 mock 的 AI 返回**，至少覆盖三种情况：引用合法、引用了不存在的 chunkId（应被丢弃）、没有引用（应正常降级）。
- 验收：设计稿修订版经人工确认后再写代码；试点链路端到端可用；新增的检查脚本和 `smoke` 分组都通过；`run-checks.mjs all` 保持全绿。
- **试点验收通过并经人工评审之前，不要推广到其余 5 个提示词。**

## 交付要求

- 同上一轮：每个阶段单独提交；在本文件"执行记录"一节追加记录，**并附上命令和关键输出**。
- 遇到以下情况必须停下来报告：需要改变数据结构或接口契约；判断某个失败测试属于"真缺陷"但修复范围超过约 300 行；阶段 4 设计稿修订完成（等待人工确认）。

## 执行记录

（每阶段完成后追加）
