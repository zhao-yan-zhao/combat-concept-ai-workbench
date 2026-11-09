# M8 军事仿真深化与机理定量校核执行方案（EXECUTION_PLAN_M8）

> **文档定位**：本方案承接已全量收官的 `MASTER_PLAN_2026-11.md`（M0～M7，168 项测试全绿基线），从军事仿真工程（M&S）、体系作战概念开发与实验（CD&E）及 DoDAF 2.02 形式化校核的专业视角，对现有代码库进行源码级深度体检，提炼出 **10 个核心技术短板**，并转化为可直接按卡执行的 **M8 里程碑（T8.1～T8.10）落地任务卡**。

## 一、 源码级深度体检：10 大核心不足点清单

通过对 `design-studio/src/`、`shared/` 与 `server/` 下核心模块的逐行走查，当前版本虽已跑通“七步主线 + 双线推演”全流程，但在**机理计算科学性、图论拓扑严谨性、推演数据闭环度、仿真器接驳能力**四个方面存在以下源码级短板：

| 编号 | 模块与源码定位 | 现状源码实现缺陷剖析 | 军事仿真专业视角下的后果 | 对应落地任务卡 |
| :--- | :--- | :--- | :--- | :--- |
| **G01** | **杀伤网时延预算测算**<br>`design-studio/src/oodaStore.js`<br>`calculateLatencyBudget` (L145–183) | 直接用 `activities.forEach` 将所有活动耗时**简单线性累加**（未解析 `edges` 的串并联有向图拓扑），且将超时阈值硬编码为 `totalSeconds > 7200`（2 小时）或 `OODA_WINDOW_MINUTES = 30` | 多路并行侦察与冗余备份支路耗时被错误叠加；无法针对时敏目标（TST，如机动发射车暴露窗口 5～15 分钟）校验“杀伤链关键路径耗时 ≤ 目标暴露时间窗” | **T8.1** |
| **G02** | **单点故障（SPOF）与抗毁推演**<br>`design-studio/src/oodaStore.js`<br>`findSinglePointsOfFailure` (L185–201) | 仅判断 `inDegree >= 1 && outDegree >= 1` 且 `type/title` 含“决策/控制/中继”三个词；未做图论割点（Articulation Point）分析，也未计算节点失效后 `Observe -> Act` 杀伤链是否真正断链 | 若某核心传感器融合中心或通信枢纽名称未含上述三词，即使它是全网唯一桥梁也不会被判定为 SPOF；点击节点战损时无法量化全网剩余杀伤链连通率 | **T8.2** |
| **G03** | **OODA 五泳道归类引擎**<br>`design-studio/src/oodaStore.js`<br>`evaluateOodaLoopHealth` (L32–48) | 纯粹依赖硬编码中文关键词数组 `matchKeywords` 归类五泳道；不含关键词的新型概念活动会被漏判，而含复合词（如“察打一体协同”）的活动会被同时归入多个泳道造成统计失真 | 用户采用新型军事概念术语（如“跨域态势对齐”、“分布式火力筹划”）时，系统误报 `NO_OBSERVE` / `NO_DECIDE`，OODA 健康度评分失真 | **T8.3** |
| **G04** | **仿真结果回收与战损推导**<br>`design-studio/src/simulationRecycleStore.js`<br>`extractSimulationPhaseOutcomes` (L52–74) | 当缺少外部明细时，使用硬编码线性公式 `lossRate = (1.5 + index * 1.2).toFixed(1)%` 随阶段序号凭空生成战损率 | 在严肃的战法与想定评审中，无推导依据的伪造战损百分比会降低复盘报告（`wargame-review`）的可信度 | **T8.4** |
| **G05** | **回合制兵棋导调与仿真回收割裂**<br>`design-studio/src/wargameTurnStore.js`<br>`design-studio/src/simulationRecycleStore.js` | M7 的回合制红蓝对抗导调（`wargameState.turns` 的意图、突发事件卡注入、导演部裁决）与 M6 的 `simulationRecycleStore`（仅读 `scenario.simulation.runs[0]`）完全独立，互不连通 | 研究人员完成多回合红蓝博弈与导调裁决后，无法将暴露出的阶段受阻、通信中断等裁决结果一键转化为 `phaseOutcomes` 和 `activityDeviations` 回填上游模型 | **T8.5** |
| **G06** | **本地抽象网格仿真内核**<br>`design-studio/src/simulationAdapter.js`<br>`runLocalAbstractSimulation` (L112–147) | 所谓“本地抽象网格评估”仅检查坐标是否在 `0–100` 内、点是否在圆内、事件是否有 `sourceNodeId`；实质是**静态格式校验**，没有任何时间步进与角色空间交互测算 | 本地仿真跑出的 4 项指标均为格式合规率，无法反映“前沿感知区是否覆盖对手区域”、“指控中继链是否跨距断链”、“各阶段行动密度是否过载”等战术问题 | **T8.6** |
| **G07** | **空间部署规划器算法**<br>`design-studio/src/scenarioDeploymentPlanner.js`<br>`planScenarioDeployment` (L1–60) | `ROLE_LAYOUTS` 采用固定坐标偏移（如 `sensor: [-28, 6]`），超出 5 个实体仅按 `(index % 3) * 6` 机械平移；无视红蓝对峙轴线与 OV-2/OV-5 实体间协同拓扑关系 | 存在高频信息交互的协同单元可能被排布在网格两端，且多编组兵力展开缺乏“后方保障—指控—打击—前沿感知—交战区”的战术梯次纵深 | **T8.7** |
| **G08** | **多方案定量对比评分器**<br>`design-studio/src/schemeScoring.js`<br>`calculateAutomaticScores` (L88–125) | `readiness = Math.min(100, 55 + activities.length * 7)` 偏向“节点数量/填表工作量打分”；未纳入关键路径时延裕度、SPOF 抗毁率、低置信度假设风险与推演实测指标 | 一个“画了 10 个冗余节点但存在单点断链和低置信度假设”的劣质方案，得分反而高于“精炼闭环、抗毁性强”的优质战法方案 | **T8.8** |
| **G09** | **CMO 装备库语义应用深度**<br>`server/cmoDatabase.mjs`<br>`getPlatform` / `searchPlatforms` (L155–220) | 仅读取平台名称、国别、大类与服役年份；未提取定性能力族画像标签（如是否具备防空预警、电子对抗、反潜、卫通中继能力），也未校验平台服役年代与任务类型的匹配性 | 在 `force-mission` 中把纯运输舰或无电子战能力的平台挂载到“电磁压制/防空反导”作战兵力下时，系统无法给出装备—任务失配告警 | **T8.9** |
| **G10** | **DoDAF 跨视图动态行为一致性**<br>`shared/dodaf/consistency.js`<br>`design-studio/src/validationStore.js` | `consistency.js` 仅检查实体 ID 类型冲突、名称分歧和断头边；对 `OV-6b` 状态机死锁（无出边非终态）、孤立状态以及 `OV-6c` 时序事件与 `OV-5b` 活动依赖的因果逆序缺乏校验 | 状态机存在死循环或时序图中“打击发射”早于“目标确认”等逻辑悖论时，结构校核仍显示高分通过 | **T8.10** |

## 二、 研发红线与架构约束（对齐 `AGENTS.md` 与 `MASTER_PLAN_2026-11.md`）

在执行本方案所有任务卡时，必须严格遵守项目既有铁律：

1. **安全合规边界（不可突破）**：严格保持 `simulationAdapter.js` 中 `safetyScope` 定义的 `abstract-percent-grid`（0–100 抽象百分比研究网格）边界，**绝不在工作台核心库内新增真实地理经纬度、具体目标分配、真实航路规划或具体武器毁伤参数**。与重型实装仿真器（CMO / AFSIM）的地理与物理映射通过外部解耦适配器契约完成。
2. **零外部依赖原则**：严禁修改 `package.json` 引入任何第三方 npm 包；所有图论算法（DAG 关键路径、Tarjan 割点、拓扑力导向布局、状态机可达性）均使用原生 ES Module 纯函数实现，确保前后端（Node.js v22+ 与浏览器）同构复用。
3. **可逆事务与状态保护**：任何自动修复、从推演回填或部署更新动作，必须走 `applyWithRecoveryPoint` 事务包装，支持一键撤销（Undo）。
4. **双向回归验证**：每张任务卡完成后必须新增对应的 `scripts/check-m8-*.mjs` 验收脚本，并运行 `node scripts/run-checks.mjs all` 与 `node scripts/smoke-ui.mjs` 确保零退化。

## 三、 M8 分阶段落地任务卡（T8.1 ～ T8.10）

### 第一阶段：机理动力学与图论算法升级（T8.1 ～ T8.3）

#### T8.1 杀伤网 DAG 关键路径（CPM）时延解算与时敏窗口校核

- **先读文件**：`design-studio/src/oodaStore.js`、`design-studio/src/ov5MechanismView.js`、`design-studio/src/validationStore.js`。
- **问题现状**：`calculateLatencyBudget` 将所有活动耗时算术相加，未区分并行侦察支路与主干杀伤链，且超时阈值固定为 7200 秒。
- **落地方案**：
  1. 在 `design-studio/src/oodaStore.js` 中新增有向无环图（DAG）关键路径求解器（自动破除反馈边 `feedbackEdges` 的环路以避免无限递归），分别计算：
     - `criticalPathSeconds`：从任意感知源头（`Observe`）到行动末端（`Act`）的**最长关键路径耗时（决定体系全要素协同闭合上界）**及关键路径节点序列 `criticalPathIds`；
     - `fastestKillChainSeconds`：从 `Observe -> Orient -> Decide -> Act` 的**最短可行杀伤链耗时（决定时敏目标应急响应下界）**；
     - `parallelSumSeconds`：保留原全量累加耗时作为资源总工时参考。
  2. 支持从 `ov5Model.targetWindowSeconds`（默认 1800 秒，支持在 OV-5b 顶栏或简报中按“高时敏 300s / 常规 1800s / 战役 7200s”配置）读取目标暴露窗口，当 `criticalPathSeconds > targetWindowSeconds` 时触发 `KILL_CHAIN_LATENCY_EXCEEDED` 告警并高亮关键路径瓶颈节点。
- **核心代码设计（`design-studio/src/oodaStore.js`）**：
  ```javascript
  export function calculateLatencyBudget(activities = [], edges = [], options = {}) {
    const budgetSeconds = Number(options.targetWindowSeconds) > 0 ? Number(options.targetWindowSeconds) : 1800;
    const durationMap = new Map(activities.map((a) => [a.id, parseActivitySeconds(a.duration || a.timingWindow)]));
    // 过滤掉反哺边（Act/Feedback -> Observe/Orient/Decide），构建前向 DAG
    const forwardEdges = filterForwardDagEdges(activities, edges);
    const { criticalPathSeconds, criticalPathIds, fastestKillChainSeconds } = solveDagPaths(activities, forwardEdges, durationMap);
    const totalSumSeconds = [...durationMap.values()].reduce((acc, v) => acc + v, 0);

    return {
      totalSeconds: criticalPathSeconds,
      parallelSumSeconds: totalSumSeconds,
      fastestKillChainSeconds,
      criticalPathIds,
      budgetSeconds,
      formattedTotal: formatDurationSeconds(criticalPathSeconds),
      formattedFastest: formatDurationSeconds(fastestKillChainSeconds),
      exceedsBudget: criticalPathSeconds > budgetSeconds
    };
  }
  ```
- **验收脚本**：新增 `scripts/check-m8-dag-latency-budget.mjs`，构造包含 2 条并行侦察支路（各 120s）汇入 1 个决策节点（60s）再触发打击（60s）加 1 条反馈边（60s）的测试图，断言关键路径耗时为 `120 + 60 + 60 = 240s`（而非全量累加的 `420s`）。

#### T8.2 基于节点移除可达性的拓扑级 SPOF 单点故障与杀伤网韧性量化

- **先读文件**：`design-studio/src/oodaStore.js`、`design-studio/src/ov5MechanismView.js`。
- **问题现状**：`findSinglePointsOfFailure` 仅靠字符串匹配“决策/控制/中继”，无法识别任意位置上的真实拓扑割点，也未评估备用旁路（`resilienceFallback`）激活后的时延劣化。
- **落地方案**：
  1. 在 `oodaStore.js` 中实现 **`analyzeNetworkResilience(activities, edges, categorized)`** 函数：
     - 定义**基准连通性**：统计初始状态下从 `categorized.observe` 到 `categorized.act` 存在有效有向路径的 `(observeNode, actNode)` 杀伤链总对数 $N_{\text{base}}$。
     - 逐一模拟移除中间节点 $v$：计算移除 $v$ 后的剩余有效杀伤链对数 $N(v)$。
     - 若 $N(v) < N_{\text{base}}$（即移除该节点会导致至少一条杀伤链中断，或全网 $N(v) = 0$ 彻底瘫痪），则无论其标题是否包含特定字眼，均判定为**拓扑必经瓶颈节点（Topological Bottleneck）**。
     - 若该瓶颈节点未配置 `resilienceFallback`，列为**高危单点故障（Critical SPOF）**；若已配置 `resilienceFallback`，列为**受控降级节点（Mitigated Bottleneck）**，并在抗毁推演视图（`resilience`）中自动展示“故障前连通率 vs 故障后连通率 vs 旁路激活恢复率”。
- **验收脚本**：新增 `scripts/check-m8-topological-spof.mjs`，验证不带“决策/控制/中继”字样的唯一桥接节点能被准确识别为 SPOF，且配置 `resilienceFallback` 后韧性评分自动提升。

#### T8.3 OODA 泳道三级语义分类器（显式属性 + 任务类型映射 + 扩展词表）

- **先读文件**：`design-studio/src/oodaStore.js`、`shared/cmoMissionTypes.js`。
- **问题现状**：纯关键词匹配易漏判新型作战概念术语或将单个活动重复归入多个泳道。
- **落地方案**：
  1. 为 OV-5 活动支持可选显式字段 `oodaLane`（枚举值：`observe | orient | decide | act | feedback`）。
  2. 在 `evaluateOodaLoopHealth` 中采用三级判定：
     - **第一优先级**：若 `activity.oodaLane` 合法，直接归入对应泳道；
     - **第二优先级**：若活动关联了上游任务或兵力 `missionType`（如 `ae_recon` 归入 `observe`，`command_control` 归入 `decide`，`strike_surface` / `sead` 归入 `act`），按任务类型映射；
     - **第三优先级**：扩展军事术语词表（增补“凝视、截获、测向、目指、筹划、分配、交战、评估、修正、归航”等 40+ 常用词）并按权重确定主泳道，彻底消除多泳道重复计数与漏判。
- **验收脚本**：新增 `scripts/check-m8-ooda-semantic-classifier.mjs`。

### 第二阶段：兵棋推演—仿真回收闭环与本地离散事件推演（T8.4 ～ T8.6）

#### T8.4 消除硬编码伪造战损，建立基于证据的阶段成效与偏差推导引擎

- **先读文件**：`design-studio/src/simulationRecycleStore.js`。
- **问题现状**：`extractSimulationPhaseOutcomes` 第 55 行使用 `lossRate = `${(1.5 + index * 1.2).toFixed(1)}%`` 凭空生成战损数字。
- **落地方案**：
  1. 删除 `1.5 + index * 1.2` 硬编码算式。
  2. 当外部仿真未传入定量 `lossRate` 时，优先读取当轮兵棋推演裁决状态与本地抽象推演的风险诊断指标，将字段规范化为**“态势风险/受阻度评估”**（如 `低风险（链路闭环）`、`中度受阻（协同延误）`、`高危降级（存在未闭合 SPOF）`），仅当外部定量仿真器显式传入 `lossRate` 时才渲染百分比数值，并在复盘报告中自动标注数据来源（`[定量仿真回传]` vs `[定性推演/机理推导]`）。
- **验收脚本**：更新 `scripts/check-m6-simulation-result-recycle.mjs` 并新增 `scripts/check-m8-honest-recycle-derivation.mjs`。

#### T8.5 打通回合制兵棋导调（`wargameTurnStore`）到仿真结果回收（`simulationRecycleStore`）的自动编译桥

- **先读文件**：`design-studio/src/wargameTurnStore.js`、`design-studio/src/simulationRecycleStore.js`、`design-studio/src/validationView.js`。
- **问题现状**：研究人员在 M7 兵棋推演视口完成的回合对抗（注入事件卡、导演部裁决结果 `adjudication.outcome` 与受损活动引用）无法回流到 M6 的结果回收与上游模型回填流程。
- **落地方案**：
  1. 在 `design-studio/src/simulationRecycleStore.js` 中新增 **`compileWargameTurnsToSimulationResult(wargameState, phaseAction, ov5)`**：
     - 按 `turn.phaseId` 聚合各回合裁决结果（`advantage-red / advantage-blue / stalemate / degraded`）与注入的突发事件卡（`injectedEvents`），自动生成结构化 `phaseOutcomes[]`；
     - 遍历各回合关联的 `activityRefs` 与事件卡影响类别（如通信中断 → `coordination` 偏差；气象扰动/兵力延误 → `schedule` 偏差；雷达关机/网络降级 → `effect` 偏差），自动生成带精确 `activityId` 的 `activityDeviations[]`。
  2. 在一体化推演舱增加 **“将兵棋推演裁决同步至结果回收”** 按钮（走 `applyWithRecoveryPoint` 事务包装），实现“红蓝回合导调 → 偏差清单生成 → 一键回填 `phaseAction` 与 `ov5`”的全链路贯通。
- **验收脚本**：新增 `scripts/check-m8-wargame-recycle-bridge.mjs`。

#### T8.6 升级本地抽象网格推演内核（Abstract Grid Discrete-Event Evaluator）

- **先读文件**：`design-studio/src/simulationAdapter.js`、`design-studio/src/scenarioDeploymentPlanner.js`。
- **问题现状**：`runLocalAbstractSimulation` 只做静态边界检查，缺乏战术交互评估。
- **落地方案**：
  1. 严守 `abstract-percent-grid`（0–100 网格）安全红线，在 `runLocalAbstractSimulation` 中引入**四项战术机理级确定性评估指标**（在保留原有 4 项基础指标兼容性的同时，扩展 `metrics` 至 8 项并生成 `phaseOutcomes` 与 `activityDeviations`）：
     - `sensor-opponent-coverage`（**对手区域感知覆盖率**）：检验角色为 `sensor` 的实体抽象感知半径是否覆盖角色为 `opponent` 的实体或交战窗口区（`window`）；
     - `c2-relay-continuity`（**感知—指控—行动链路空间连通率**）：检验具有共同 `sourceActivityId` 或前后置 `sourceOodaIds` 的 `sensor -> command -> action` 实体在抽象网格上的间距是否满足抽象中继阈值（$\le 45\%$ 网格跨度）；
     - `timeline-causal-order`（**事件序列因果顺畅度**）：检验 `scenario.timeline` 中的事件时间戳顺序是否与对应节点在 `OV-5 / OODA` 中的前后置拓扑一致；
     - `force-density-balance`（**网格部署疏散度**）：评估同阵营高价值单元是否过度聚拢（间距 $< 11\%$ 易遭饱和打击）。
- **验收脚本**：新增 `scripts/check-m8-abstract-grid-des.mjs`。

### 第三阶段：空间拓扑布局、复合评分与 DoDAF 深度校核（T8.7 ～ T8.10）

#### T8.7 基于威胁轴线与 OV-2/OV-5 协同引力的抽象网格部署算法

- **先读文件**：`design-studio/src/scenarioDeploymentPlanner.js`。
- **问题现状**：`proposePosition` 使用固定偏移量，多实体时按取模网格机械排布，未体现战术梯次与协同亲和度。
- **落地方案**：
  1. 在 `scenarioDeploymentPlanner.js` 中引入**威胁轴线向量（Threat Axis Vector）**：以蓝方基准中心指向 `opponent`（或 `window` 区域中心）为单位轴向向量 $\vec{u}$ 及法向展开向量 $\vec{v}$。
  2. 沿轴向按战术梯次投影排布：`support`（后方 $-30\%$）→ `command`（指控中枢 $-15\%$）→ `action`（火力突击 $+5\%$）→ `sensor`（前沿感知 $+20\%$）→ `opponent`（对手参照 $+35\%$）。
  3. 对共享同一个 `sourceActivityId` 或存在 `sourceOodaIds` 关联的协同实体施加法向收敛引力，再经 `enforceSeparation` 保证最小抽象安全间距（`MIN_SEPARATION = 11`），使自动生成的部署图天然呈现“正面展开、纵深梯次、协同就近”的专业战术队形。
- **验收脚本**：新增 `scripts/check-m8-tactical-deployment-layout.mjs`。

#### T8.8 融合“机理动力学 + 假设脆弱性 + 推演成效”的多方案定量评分引擎

- **先读文件**：`design-studio/src/schemeScoring.js`。
- **问题现状**：`calculateAutomaticScores` 过度依赖 `activities.length` 等数量指标，无法区分“高风险臃肿方案”与“高韧性精炼方案”。
- **落地方案**：
  1. 升级 `schemeScoring.js` 中的自动评分函数，保持 8 个评分维度不变，但替换底层证据算子：
     - **时间窗口适配度（`timeWindow`）**：结合 T8.1 的 `latencyBudget.criticalPathSeconds / budgetSeconds` 比值计算裕度得分；
     - **风险可控性（`riskControl`）**：除扣除验证问题数外，读取 `ov5.argumentChain.assumptions` 中未配置失效预案的低置信度假设数量（每项扣 12 分）；
     - **对手反制韧性（`resilience`）**：融合 T8.2 拓扑 SPOF 旁路覆盖率与 M7 红方反制闭环率（`countermeasureClosure.rate`）；
     - **任务适配度与可实施性（`missionFit` / `feasibility`）**：若 `scenario.simulation.runs` 存在已完成运行，按 40% 权重融合仿真回传指标均值。
- **验收脚本**：新增 `scripts/check-m8-composite-scheme-scoring.mjs`。

#### T8.9 CMO 装备库定性能力画像提取与“任务—平台能力”匹配度校核

- **先读文件**：`server/cmoDatabase.mjs`、`shared/forcePlatformRecommend.js`、`design-studio/src/validationStore.js`。
- **问题现状**：挂载 CMO 平台后未校验平台类型/角色是否匹配所属作战兵力的 `missionType`。
- **落地方案**：
  1. 在 `shared/cmoMissionTypes.js` 与 `server/cmoDatabase.mjs` 中建立**只读定性能力族映射表（Capability Family Mapping，不涉及敏感具体数值参数）**：根据平台 `domain`、`category` 与 `comments/name` 特征词提取定性能力标签（如 `["air-superiority", "strike", "aew", "ew", "asw", "surface-combat", "c2-relay", "isr", "logistics"]`）。
  2. 在 `validationStore.js` 中新增校核规则：当 `forceMission.combatForces` 的 `missionType`（如电子对抗、防空预警、反潜巡逻）与其挂载的 `platforms[]` 能力族标签完全不交集时，生成 `medium` 级诊断问题 `“作战兵力任务与挂载平台能力族失配”`，并支持一键跳转到 Step 04 兵力卡片修正。
- **验收脚本**：新增 `scripts/check-m8-cmo-capability-alignment.mjs`。

#### T8.10 DoDAF 跨视图行为形式化校验（OV-6b 状态机死锁检测 + OV-6c/OV-5b 因果时序逆序检测）

- **先读文件**：`shared/dodaf/consistency.js`、`design-studio/src/validationStore.js`、`design-studio/src/ov6cBuilder.js`。
- **问题现状**：缺少对状态机死锁和时序图因果逆序的形式化静态检查。
- **落地方案**：
  1. **OV-6b 状态机死锁与孤立态检测**：在 `validationStore.js` 的 `inspectDerivedOperationalViews` 中，解析 `ov6b` 状态节点与转换边（`transitions`），检测：
     - **不可达状态（Unreachable State）**：除初始状态外入度为 0 的状态；
     - **死锁黑洞状态（Deadlock State）**：非终止态（名称不含“结束/完成/归航/待机/终止”）但出度为 0 的状态。
  2. **OV-6c 事件时序与 OV-5b 依赖边因果偏序校验（Causal Order Check）**：若活动 $A \to B$ 在 OV-5b 中存在前向依赖边（且非反馈边），但在 `OV-6c`（或 `scenario.timeline`）中绑定到 $B$ 的最早事件序号/时间戳早于绑定到 $A$ 的最早事件，则报出 `“时序因果逆序（Causal Inversion）：下游活动 [B] 早于上游前提活动 [A] 触发”`，支持一键修复事件顺序。
- **验收脚本**：新增 `scripts/check-m8-dodaf-behavioral-consistency.mjs`。

## 四、 推荐执行顺序与验收里程碑

建议沿用项目成熟的“每次领一张卡、改完跑全量检查再提交”节奏，分三个批次推进：

| 批次 | 包含任务卡 | 核心改动文件 | 预期收益 | 阶段验收命令 |
| :--- | :--- | :--- | :--- | :--- |
| **Batch 1：机理与图论内核** | `T8.1`、`T8.2`、`T8.3` | `design-studio/src/oodaStore.js`<br>`design-studio/src/ov5MechanismView.js` | 杀伤网时延从粗放累加升级为 DAG 关键路径（CPM），SPOF 识别升级为真拓扑割点分析，OODA 分类准确率大幅提升 | `node scripts/run-checks.mjs ov5`<br>`node scripts/run-checks.mjs all` |
| **Batch 2：推演闭环与网格仿真** | `T8.4`、`T8.5`、`T8.6`、`T8.7` | `design-studio/src/simulationRecycleStore.js`<br>`design-studio/src/simulationAdapter.js`<br>`design-studio/src/scenarioDeploymentPlanner.js` | 消除伪造战损公式，打通 M7 兵棋导调到 M6 结果回填闭环，本地抽象网格具备战术级离散评估与梯次队形排布 | `node scripts/run-checks.mjs m6`<br>`node scripts/run-checks.mjs m7`<br>`node scripts/run-checks.mjs all` |
| **Batch 3：评估与架构形式化校核** | `T8.8`、`T8.9`、`T8.10` | `design-studio/src/schemeScoring.js`<br>`server/cmoDatabase.mjs`<br>`design-studio/src/validationStore.js` | 多方案对比真正由机理韧性与推演数据驱动，CMO 平台挂载具备能力失配预警，OV-6b/6c 具备死锁与因果逆序校核 | `node scripts/run-checks.mjs dodaf`<br>`node scripts/run-checks.mjs all`<br>`node scripts/smoke-ui.mjs` |
