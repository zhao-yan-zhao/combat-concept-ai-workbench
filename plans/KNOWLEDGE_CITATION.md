# 知识库引用溯源架构设计方案 (KNOWLEDGE_CITATION.md)

> 本方案为**纯规划设计稿（阶段 6 交付物，零代码变动）**，针对国防作战概念研究工作台提供全链路“研读—检索—生成—挂接—审阅—导出”的知识引用溯源体系。

---

## 1. 现状调研与链路瓶颈

1. **切片与检索层（`shared/knowledge.js`）**：
   - 知识库导入 Markdown/TXT 文件，按二级/三级标题拆分为 `KnowledgeChunk`（含 `id`, `vaultId`, `filePath`, `title`, `parameterTables` 等）；
   - 检索引擎 `searchKnowledge(query, docs, limit)` 基于词频加权检索（标题 6x、标签 5x、双链 4x、表格 3x、正文 1x）。
2. **AI 生成链路（`server/openaiClient.mjs` & `shared/generator.js`）**：
   - 检索命中的切片作为 `payload.evidence` 拼装入提示词变量（`evidence`）；
   - **痛点**：目前为单向即用即弃，AI 生成的各实体（任务、兵力、活动、规则、想定）**未回填结构化引用锚点**；报告导出亦缺乏可核验的文献追溯章节。

---

## 2. 核心数据结构设计

### 2.1 引用凭证对象 (`KnowledgeCitationRef`)

```typescript
interface KnowledgeCitationRef {
  citationId: string;        // 引用唯一标识 (cite-uuid)
  chunkId: string;           // 知识切片 ID (vaultId-fileIndex-chunkIndex)
  vaultId: string;           // 知识库/Vault 标识
  filePath: string;          // 源文件相对路径 (e.g. "作战条令/防空反导协同规范.md")
  fileTitle: string;         // 文件标题
  chunkTitle: string;        // 章节标题 (e.g. "第3章 拦截火控分配原则")
  snippet: string;           // 支撑本条生成的原文佐证片段 (≤200字)
  score: number;             // 检索相关度分值 (0~100)
  adoptedAt: string;         // 采纳生成或人工关联时间戳 (ISO-8601)
  attributionType: "ai_generated" | "human_annotated"; // 来源类型
}
```

### 2.2 领域实体绑定方式（向后兼容）

所有领域模型在实体对象扩展可选字段 `citations?: KnowledgeCitationRef[]`，无引用时默认缺省或空数组，不破坏既有 SQLite 存储契约与断言：

- **活动模型 (OV-5a/OV-5b)**：`Activity.citations`（支撑该作战活动、前置触发条令或输入输出契约的文献）。
- **编成与兵力 (ForceMission)**：`ForceUnit.citations`（装备参数表、编制规格来源）。
- **规则与时序 (OV-6a/OV-6c)**：`CombatRule.citations`、`SequenceEvent.citations`（交战规则准则、时序动作规范）。
- **综合想定 (Scenario)**：`ScenarioEvent.citations`（战术战法指引、蓝军对抗逻辑）。

---

## 3. AI 提示词纳管与链路升级

遵循 `AGENTS.md`“提示词统一纳管”铁律，所有引用生成引导必须进入顶部菜单已纳管的标准提示词，严禁隐藏提示词：

| 提示词 ID | 所属生成阶段 | 动态变量扩充 | 结构化输出增补要求 |
|---|---|---|---|
| `ai.generate.concept-brief` | Step 00 概念规划 | `{{knowledge}}` | `brief.citations`: 核心意图与背景溯源 |
| `ai.generate.force-mission` | Step 03 作战兵力 | `{{knowledge}}` | `forces[].citations`: 兵力选型与指标溯源 |
| `ai.generate.activity-decomposition` | Step 04 活动机理 | `{{knowledge}}` | `activities[].citations`: 阶段与机理条令溯源 |
| `ai.generate.rule-library` | Step 04/OV-6a 规则库 | `{{knowledge}}` | `rules[].citations`: 交战规则条文出处 |
| `ai.generate.scenario` | Step 06 仿真想定 | `{{knowledge}}` | `events[].citations`: 战术推演动作溯源 |
| `ai.generate.research-chat` | 全流程 AI 研讨对话 | `{{knowledge}}` | `chatResponse.citations`: 研讨答复佐证 |

---

## 4. UI 交互落点与成果输出

1. **画布与列表引用气泡**：
   - 在 OV-5 活动卡片、兵力卡片、规则项右上角渲染 `[📖 2]` 科技风轻量徽标；
   - Hover 悬浮显示源文件路径与佐证切片摘要（Popover）；
2. **检查器抽屉（Inspector）新增引用溯源面板**：
   - 选中实体后，在右侧侧边栏展示“知识溯源”分区：展示自动引证条目，支持人工“添加引用/删除/校对原文档”；
3. **报告导出全格式留存（Word / PDF / Markdown）**：
   - 在各章正文末尾标注引用上标 `[1]`、`[2]`；
   - 报告文档文末新增自动生成的规范章节：`附录：作战概念知识引用与文献溯源索引表`（含文档路径、章节出处、引用频次与佐证摘录）。

---

## 5. 实施里程碑演进建议

- **阶段 A**：在 `shared/knowledge.js` 与生成器中落地 `KnowledgeCitationRef` 数据标准与 Mock 解析（零业务破坏）。
- **阶段 B**：在 `server/openaiClient.mjs` 中更新上述 6 个提示词的输出契约与解析注入。
- **阶段 C**：前端侧边栏 Inspector 挂接与报告导出（Word/PDF/PPTX）溯源附录渲染。
