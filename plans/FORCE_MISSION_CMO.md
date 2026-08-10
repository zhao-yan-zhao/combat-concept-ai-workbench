# 兵力与任务 + CMO 装备库

更新时间：2026-07-27  
状态：已落地主干能力；下文含改善 backlog  
范围：规划步骤「兵力与任务」（概念兵力 + 作战兵力）、CMO DB3 只读目录、平台推荐与挂接

---

## 1. 目标

在「概念简报 → 阶段与行动」之后，把**谁参与、谁负责什么**拆成两层，并可选用 CMO（Command: Modern Operations）DB3 库做**研究级平台类型引用**（非真实编制、非武器用法、非仿真参数）。

```text
概念简报
  → 阶段与行动
  → 兵力与任务
       ├─ 概念兵力（职责语义）
       └─ 作战兵力（可执行编组 + CMO 任务类型 + 可选平台）
  → 模糊作战图 / 总体概念图 / OV …
```

---

## 2. 已实现能力

### 2.1 双层兵力模型

| 层级 | 字段 | 含义 |
|------|------|------|
| 概念兵力 | `forces[]` | **按阶段**的职责语义单元；`phaseIds` 挂接阶段；**不挂装备** |
| 作战兵力 | `combatForces[]` | 更具体编组；`conceptForceId` 挂接概念单元；用 CMO 平台细化 |
| 关系 | `relations[]` | 可连接概念或作战兵力 ID |
| 任务类型 | `missionType` | 主要在作战层使用，对齐 CMO 任务分类 |
| 平台 | `platforms[]` | **仅作战层** DB3 引用：`domain` / `cmoId` / `name` / … |

确认门禁：概念兵力与作战兵力均至少 1 条，且任务字段完整。

展示：顶部为阶段选择条（复用 `phaseActionFocusId`）；选中阶段后下方概念/作战兵力实时切换。跨阶段概念单元在其 `phaseIds` 内各阶段可见；作战兵力按挂接的概念单元过滤。

### 2.2 上游输入

- 页面不展示上游 1/2 核对卡片；仅在缺简报/阶段时出提示条  
- 生成要求：简报可用 + 至少 2 个阶段  
- AI / 本地生成完整传递 `phaseAction`（含 `blueActions` / `redActions` / 时窗）

### 2.3 CMO DB3

- 默认库：`data/DB3K_510.db3`（SQLite，只读）  
- 配置：`data/cmo-database-config.json`  
- 系统管理（负责人）：启用、路径、探测连接  
- API（见 `INTERFACE_GUIDE.md`）：
  - `GET/PUT /api/cmo-database-config`
  - `POST /api/cmo-database-config/probe`
  - `GET /api/cmo-catalog/status|mission-types|countries|search`
  - `GET /api/cmo-catalog/platforms/{domain}/{cmoId}`
- 健康检查：`GET /api/health` 含 `cmoDatabase`

解析要点：平台表 `DataAircraft` / `DataShip` / `DataSubmarine` / `DataGroundUnit` / `DataFacility` / `DataSatellite`；枚举表 `Enum*`；任务分类参考 `EnumLoadoutRole` 与 CMO 任务类，收敛为工作台受控 `missionType` 集合。

### 2.4 平台挂接与推荐

| 能力 | 说明 |
|------|------|
| 手工检索 | 兵力卡片内关键词 + 域 + 国家 |
| 批量挂接 | 检索结果勾选 / 全选 / 挂接全部 |
| 阶段推荐 | 由阶段行动 + 任务类型生成关键词，检索 DB3 |
| 直接挂接 | 推荐结果直接写入红蓝作战兵力卡片，不展示预览面板 |
| 自动挂接 | 兵力草案生成后，若目录已连接则自动为作战兵力挂接平台 |
| 选项 | 默认跳过已有平台的单元 |

关键词逻辑：`shared/forcePlatformRecommend.js`（中→英种子、域偏好）。

### 2.5 一致性与下游

- 兵力页不再展示「一致性检查」「装备目录」状态条（诊断逻辑仍可供结构校核等使用）  
- 结构校核：缺作战兵力、作战兵力缺平台  
- 模糊图编译：**优先作战兵力**落位；AI 上下文含 `combatForces` + 平台摘要  
- 下游确认语义：`forceMissionContextForDownstream`

### 2.6 主要代码位置

| 路径 | 职责 |
|------|------|
| `shared/conceptPlanning.js` | 模型规范化、确认门禁、诊断、compact |
| `shared/cmoMissionTypes.js` | CMO 对齐任务类型 |
| `shared/forcePlatformRecommend.js` | 推荐关键词与挑选 |
| `server/cmoDatabase.mjs` | DB3 只读服务 |
| `design-studio/src/forceMissionView.js` | 页面 |
| `design-studio/src/forceMissionStore.js` | 本地持久化与编辑 helpers |
| `design-studio/src/conceptPlanningController.js` | 生成 / 推荐 / 挂接 |
| `design-studio/src/admin.js` | CMO 配置入口 |
| `scripts/check-cmo-force-mission.mjs` | 验收 |

---

## 3. 使用要点

1. 启动（需加载含 CMO 路由的代码进程）：

```powershell
cd D:\项目\combat-concept-ai-workbench
$env:PORT = "8792"
node server.mjs
```

2. 负责人登录 → **系统管理** → 确认 CMO 数据库已连接。  
3. 完成简报、阶段与行动 → **兵力与任务** → 生成草案。  
4. 生成后自动（或点「为红蓝作战兵力挂接平台」）把平台直接写入红蓝作战卡片；也可在卡片内手工检索。  
5. 确认后进入模糊作战图（应更偏向作战兵力）。

**注意：** 端口上若仍是旧进程，会出现 `/api/cmo-catalog/*` 404；需重启服务后再用。

---

## 4. 改善 backlog

### 4.1 高价值（建议优先）

| 项 | 说明 | 状态 |
|----|------|------|
| 旧稿一键派生作战层 | 仅有 `forces` 的旧项目，从概念兵力派生 `combatForces` 草案 | 待做 |
| 下游 AI 提示强化 | 模糊图 / 总体图 prompt 明确优先作战兵力与平台类型 | 待做 |
| 国家/时代过滤预设 | 按简报预填国家；按服役年过滤过时平台 | 待做 |
| 推荐质量 | 避免同一平台重复挂多单元；任务类型收紧域；记录推荐理由 | 待做 |
| 确认门禁可配置 | 是否强制作战兵力必须有平台（当前仅软提示） | 待做 |

### 4.2 中价值（体验）

| 项 | 说明 | 状态 |
|----|------|------|
| 作战兵力手工增删改 | 不全靠 AI 重生成；增删行、改任务文本 | 待做 |
| 平台库浏览器 | 侧栏按域/国浏览，点选挂到兵力 | 待做 |
| 批量改任务类型 | 多选作战兵力统一改 `missionType` | 待做 |
| 导出表 | 报告 Markdown/Office 增加概念+作战+平台引用表 | 待做 |

### 4.3 低优先级 / 边界

| 项 | 说明 | 状态 |
|----|------|------|
| 仿真导出适配 | combatForces → CMO 想定骨架（易越界到仿真细节） | 不做（当前） |
| 中文平台名检索 | DB3 多为英文名；可维护中英别名表 | 待评估 |
| 大库检索索引 | 全表 LIKE 可加内存/FTS 索引 | 待评估 |

### 4.4 建议下一刀

1. **旧稿一键派生作战兵力**  
2. **确认前可选：作战兵力必须有平台**  
3. （可选）作战兵力手工增删  

---

## 5. 设计边界（冻结）

- 平台引用 = 装备**类型参考**，不是编制表、不是性能库、不是目标选择/武器用法。  
- DB3 **只读**，不写回 CMO 仿真库。  
- 概念层表职责；作战层表编组与任务类型；下游 OV 只消费**已确认**规划语义。  
- 推荐与检索失败不得阻断本地兵力草案生成。

---

## 6. 验证

```powershell
node scripts/check-cmo-force-mission.mjs
node scripts/check-concept-planning-workflow.mjs
# 结构校核相关：
node scripts/check-structure-review-workbench.mjs
```

活体检查：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8792/api/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8792/api/cmo-catalog/status
```

`cmo-catalog/status` 应见 `"open": true` 与平台计数。

---

## 7. 相关文档

- 流程总览：`plans/CONCEPT_PLANNING_WORKFLOW.md`  
- HTTP 契约：`INTERFACE_GUIDE.md`  
- 会话交接：`project-context.md`  
- 任务类型源：`shared/cmoMissionTypes.js`  
