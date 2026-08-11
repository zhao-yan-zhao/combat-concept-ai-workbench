# 规则 / 状态 / 事件产品模型（冻结）

更新时间：2026-08-11  
状态：产品语义与数据形状冻结；实现与现有 `ov6a/b/c` normalizer 尚有差距（见 §5）

界面不强调 OV 品牌；资源键与标准输出仍用 `ov6a` / `ov6b` / `ov6c`。

---

## 1. 在主流程中的位置

更精确的阶段行动链：

```text
1) 建立规则库（ov6a 规则本体）
   + 状态/事件基础词表（可挂在基线页或 ov6b/c 词表区）
2) 生成阶段与行动（phaseActionConcept）
3) 校验阶段：将规则逐条绑定到受约束活动（activityBindings）
4) 为关键任务/对象生成多个状态机（ov6b.stateMachines[]）
5) 为跨对象协同生成时序图（ov6c.sequences[]）
6) 用 6a/6b/6c 反向检查阶段行动并回改源头
```

与 `RESEARCH_WORKFLOW_18.md` 对齐：

| 设计意图 | 页面/资源 | 说明 |
|----------|-----------|------|
| 规则库先独立 | `ov6a`（可先于或并行于阶段） | 不要求创建时绑定活动 |
| 状态/事件词表 | 02 基线（规划）或 6b/6c 词表 | 非完整状态机/时序图 |
| 阶段与行动 | `phase-action` | 主写 |
| 阶段校验·绑定 | 仍在 `ov6a` 上补 `activityBindings` | 绑定是校验结果 |
| 多状态机 | `ov6b` | 一任务/对象一机 |
| 时序图 | `ov6c` | 生命线 + 消息 + 可选片段 |
| 反查 | 结构核对台 + 阶段页提示 | 无规则关键活动、无出口任务、无来源消息 → 回 03 |

**强门禁不变**：大步「阶段行动」仍只要求阶段与行动已确认；6a/6b/6c 为弱校验步。

---

## 2. OV-6a — 逐条作战规则

### 2.1 语义

- 规则**本体先独立建立**，创建时**不要求**绑定活动。
- 在「阶段行动校验」时再建立规则 ↔ 活动绑定。
- `activityBindings` 是**校验结果**，不是规则创建前置条件。
- 未绑定活动 → 状态 **「待校验」**，**不是**规则无效。

### 2.2 数据形状（目标）

```json
{
  "id": "rule-001",
  "name": "规则名称",
  "description": "规则描述",
  "scope": "作用范围",
  "activityBindings": [
    {
      "activityRef": "activity-007",
      "bindingStatus": "verified",
      "constraintNote": "该活动受此规则约束"
    }
  ]
}
```

产品级：

```json
{
  "product": "OV-6a",
  "version": 2,
  "rules": [ "/* rule objects */" ],
  "diagnostics": []
}
```

字段约定：

| 字段 | 说明 |
|------|------|
| `id` | 稳定规则 id |
| `name` | 规则名称 |
| `description` | 规则描述（可映射现有 `text`） |
| `scope` | 作用范围（阶段/域/全局等，研究级） |
| `activityBindings[]` | 可选；空 = 待校验 |
| `activityBindings[].activityRef` | 指向阶段行动中的活动/行动 id（或后续 ov5 活动 id） |
| `activityBindings[].bindingStatus` | `pending` \| `verified` \| `rejected` \| `stale` |
| `activityBindings[].constraintNote` | 绑定说明 |

诊断（建议）：

- 无规则：提示建立规则库  
- 有规则无绑定：`待校验`（info/review，不阻断）  
- 绑定指向缺失活动：`stale`  
- 关键活动无任何规则约束：反查问题（回阶段行动）

### 2.3 与现状差异

| 现状 | 目标 |
|------|------|
| `subject` / `type` / `text` / 可选 `activityId` | `name` / `description` / `scope` / `activityBindings[]` |
| 种子偏 ov5 前置/约束 | 可先空库手建或从简报/阶段草稿生成规则本体 |
| 无「待校验」语义 | 未绑定 = 待校验 |

兼容：读旧数据时 `text→description`，`subject→name`，单 `activityId` → 一条 `activityBindings`。

---

## 3. OV-6b — 多状态机（任务/对象）

### 3.1 语义

- **一个产品含多个状态机**，每台对应一个任务、对象或编组。
- **禁止**把全项目硬捏成一条状态链。
- 跨主体协同通过 **事件（6c）或关联**，不合并状态机。
- 每台至少：`initial` + 一个及以上 `normal` + `final`。
- 转换可引用 `ruleRefs`（6a）、`eventRefs`（6c）。

### 3.2 数据形状（目标）

```json
{
  "id": "state-machine-001",
  "subjectRef": "task-or-object-001",
  "subjectType": "task",
  "name": "对象/任务状态转移",
  "states": [
    { "id": "start", "name": "开始状态", "kind": "initial" },
    { "id": "state-01", "name": "中间状态", "kind": "normal" },
    { "id": "end", "name": "结束状态", "kind": "final" }
  ],
  "transitions": [
    {
      "id": "transition-001",
      "fromStateRef": "start",
      "toStateRef": "state-01",
      "condition": "转换条件",
      "ruleRefs": ["rule-001"],
      "eventRefs": ["event-001"]
    }
  ]
}
```

产品级：

```json
{
  "product": "OV-6b",
  "version": 2,
  "stateMachines": [ "/* machines */" ],
  "diagnostics": []
}
```

`subjectType`：`task` \| `object` \| `force` \| `phase` \| `other`（研究级枚举，可扩展）。

诊断：

- 缺 initial / final / normal  
- 死端状态（非 final 无出边）  
- 转换引用不存在的 rule/event  
- 关键任务无状态机 → 反查阶段/兵力

### 3.3 与现状差异

| 现状 | 目标 |
|------|------|
| 扁平 `states[]` + `transitions[]`（全项目一台） | `stateMachines[]`，机内 states/transitions |
| 种子自 OODA | 主种子：阶段任务/关键对象；OODA 仅可选提示 |
| 无 ruleRefs/eventRefs | 转换可挂规则与事件 |

兼容：旧扁平结构 → 合成一台 `state-machine-legacy`。

---

## 4. OV-6c — 作战事件时序图

### 4.1 语义

- 表现：参与方 = **生命线**；交互 = 时间向下的 **消息**；可选 **激活条**。
- 支持严格 `sequence`、条件、消息类型、回链活动/规则/状态转换、可选 fragments（分支/循环/并行/异常）。

### 4.2 数据形状（目标）

```json
{
  "id": "sequence-001",
  "name": "关键事件序列",
  "participants": [
    { "id": "participant-01", "name": "参与方 A", "ref": "object-001" },
    { "id": "participant-02", "name": "参与方 B", "ref": "object-002" }
  ],
  "messages": [
    {
      "id": "event-001",
      "sequence": 1,
      "fromRef": "participant-01",
      "toRef": "participant-02",
      "name": "事件/消息名称",
      "type": "message",
      "condition": "触发条件",
      "relatedActivityRefs": ["activity-007"],
      "ruleRefs": ["rule-001"],
      "stateTransitionRefs": ["transition-001"]
    }
  ],
  "fragments": []
}
```

产品级：

```json
{
  "product": "OV-6c",
  "version": 2,
  "sequences": [ "/* sequence diagrams */" ],
  "diagnostics": []
}
```

消息 `type`：`message` \| `response` \| `status` \| `exception` \| `timeout`。

`fragments[]`（可选，二期可先空）：

```json
{
  "id": "frag-001",
  "kind": "alt|loop|par|break|opt",
  "label": "说明",
  "messageRefs": ["event-001", "event-002"]
}
```

诊断：

- sequence 不唯一/不连续  
- from/to 不在 participants  
- 消息无来源活动且标记为关键 → 反查  
- 引用失效的 rule/transition

### 4.3 与现状差异

| 现状 | 目标 |
|------|------|
| 扁平 `events[]` 时间线表 | `sequences[]` 时序图（生命线+消息） |
| 种子 OODA/想定 | 主种子：阶段协同 + 兵力/对象；想定可后置 |
| 无 participants/type/fragments | 完整时序语义 |
| UI 为表格 | 目标 UI：时序图（表可作辅编辑） |

兼容：旧 `events[]` → 单序列 `sequence-legacy`，参与方从 source 推断或「未命名」。

---

## 5. 反向检查（阶段行动）

结构核对台 / 阶段页应能提出（低～中优先级，不替代强门禁）：

| 问题 | 含义 | 回改处 |
|------|------|--------|
| 关键活动无规则约束 | 阶段主行动无任何 `activityBindings` 指向它 | 6a 绑定或 03 修订 |
| 任务无状态出口 | 对应状态机缺 final 或无可达 final | 6b |
| 消息无来源 | 时序消息无 `relatedActivityRefs` 或 ref 失效 | 6c 或 03 |
| 绑定 stale | 活动已删/改名 | 6a 重绑 |
| 转换缺条件 | 6b transition.condition 空 | 6b |

---

## 6. 实现分期建议

| 期 | 内容 |
|----|------|
| **A 模型** | `shared/dodaf/products.js` v2 normalizer + 旧数据兼容；schema 验收脚本 |
| **B 规则库 UI** | ov6a：列表建规则；绑定区在校验态；待校验标签 |
| **C 多状态机** | ov6b：按 subject 分卡；最少三态校验 |
| **D 时序图** | ov6c：生命线+消息只读图 + 消息表编辑；fragments 二期 |
| **E 反查** | structure-review 增加 6a/6b/6c ↔ phase 诊断 |
| **F 流程页** | 02 基线词表页（可选）；种子改为阶段优先 |

---

## 7. 实现进度

| 期 | 状态 |
|----|------|
| 设计冻结 | 已完成 |
| **A 模型兼容层** | **已完成** |
| **B 规则绑定编辑** | **已完成**（勾选活动 + bindingStatus） |
| **C 多状态机分机编辑** | **已完成**（新建任务/对象/兵力机） |
| **D 时序图画布** | **已完成**（生命线 + 消息层；表为辅） |
| **E 结构核对反查** | **已完成**（无规则关键活动 / 无出口 / 无来源消息） |
| F 02 基线页 | 未做 |

兼容要点：

- 6a：`subject/text/activityId` → `name/description/activityBindings`；未绑定 = `reviewStatus: pending-validation` / 待校验  
- 6b：扁平 `states/transitions` → 单机 `state-machine-legacy`；同时保留扁平字段供旧 UI  
- 6c：扁平 `events` → `sequence-legacy`；同时保留 `events[]`  
