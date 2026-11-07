# 知识库引用溯源架构设计稿（修订版） (KNOWLEDGE_CITATION.md)

> **修订状态**：对应主计划里程碑 **M2-T2.1 修订设计稿（只写文档，不改代码）**。  
> **核心原则**：不造第二套平行体系，立足现有机制（`evidenceRefs`, `citations`, `provenance`, 敏感引用审批），将引用格式与来源标记规范化、标准化，并保持 100% 向后兼容。

---

## 1. 现有引用与溯源能力映射表

| 能力层级 | 现有字段 / 所在模块 | 写入方 (Writers) | 读取方 (Readers) | 现状与演进方案 |
| :--- | :--- | :--- | :--- | :--- |
| **DoDAF 实体层** | `entity.citations`、`entity.evidenceRefs`、`entity.source`<br>(`shared/dodaf/entities.js`, `products.js`) | `normalizeDm2Entity`、`sanitizeActivityDecompositionCitations` | Inspector 侧边栏、WBS 树卡片、报告导出 | 已具备结构化解析，现扩展为全局通用的标准格式并向下兼容。 |
| **检索与凭据层** | `evidenceSelection`<br>(`evidenceSelectionStore.js`, `projectKnowledgeRetrieval.mjs`) | `selectEvidenceForAi`、检索服务 | `briefController`、`ov5AiController`、提示词注入上下文 | 将检索命中的知识切片赋予稳定 `chunkId`，并在请求 AI 时注入上下文变量。 |
| **敏感引用管控** | `sensitiveCitationApprovals`<br>(`server/projectKnowledgeCitationPolicy.mjs`) | 协同审计与审批动作 | 报告导出审计、引用公开性检查 | 维持现有涉密/敏感切片审批机制，未获批引用的涉密切片在导出时自动掩码。 |
| **衍生视图溯源** | `derivedViewProvenance`<br>(`derivedViewProvenance.js`) | 体系模型映射器、产品投影器 | OV-2、OV-3、核对台等产品顶部 Provenance Popover | 维持视点级溯源，实体级引用与视点级溯源互补互通。 |
| **报告导出与索引** | `reportBuilder.js`、`officeReports.mjs` | 报告构建器 | Word/Markdown/HTML 导出 | 读取实体 `citations` 生成正文脚注 `[n]` 与文末“参考文献与依据索引表”。 |

---

## 2. 标准结构化引用格式与向后兼容契约

### 2.1 标准引用数据契约 (`KnowledgeCitationRef`)

每个被要素关联的知识切片必须遵循以下规范化结构：

```typescript
interface KnowledgeCitationRef {
  /** 知识切片唯一全局 ID (对应检索出的切片稳定 ID) */
  chunkId: string;
  /** 知识库/仓库相对文件路径，例如 "条令/防空反导协同规范.md" */
  sourcePath: string;
  /** 章节标题 / H2 / H3，例如 "第3节 拦截火控分配原则" */
  heading: string;
  /** 原文佐证摘录 (精确摘录核心句子，建议不超过 200 字) */
  excerpt: string;
  /** 检索与采纳的时间戳 (ISO 8601) */
  retrievedAt: string;
  /** 检索分值 (相关度 0~100，可选) */
  score?: number;
  /** 历史兼容标识 (若是旧格式字符串升级而来，保留原文本) */
  legacy?: string;
}
```

### 2.2 向后兼容策略（零破坏存量数据）

系统现有模型和存量 SQLite 数据中包含旧式的纯字符串数组 `evidenceRefs: string[]`（例如 `["chunk-101", "条令第3节"]`）：
1. **读取规范化**：当读取到字符串项时，自动转换为：
   ```javascript
   {
     chunkId: str.startsWith("chunk-") ? str : "",
     sourcePath: "",
     heading: str,
     excerpt: "",
     retrievedAt: "",
     legacy: str
   }
   ```
2. **双向桥接**：在实体对象上同时保留 `citations: KnowledgeCitationRef[]` 与存量计算字段 `evidenceRefs: string[]`（自动映射为 `citations.map(c => c.chunkId || c.legacy)`），彻底消除对历史检查脚本的破坏。

---

## 3. 三种来源标记（Origin Attribute）

为了杜绝大模型“一本正经胡说八道”，让用户与审计员一眼看清要素从何而来，**所有要素（活动、任务、兵力、规则、想定事件）统一赋予 `origin` 来源标记**：

```typescript
type ElementOrigin = "cited" | "ai-inferred" | "human";
```

| 来源标记值 | 含义 | 判定条件 | 界面视觉表现 |
| :--- | :--- | :--- | :--- |
| **`"cited"`** | **有据可查** | 由 AI 生成或人工标注，且**成功绑定了至少 1 条真实存在的 `chunkId` 结构化引用**。 | 绿色徽标 `[📖 依据]`，可点击展开引用原文出处。 |
| **`"ai-inferred"`** | **模型推论** | 由 AI 生成，但**没有引用文献**，或其引用的 `chunkId` 经服务端校验属于编造/不存在并被剔除。 | 灰色/橙色轻量标签 `[⚡ 推论]`，提示未关联条令依据。 |
| **`"human"`** | **人工设定** | 用户在工作台界面手动新增或手动编辑修改过的要素。 | 蓝色标签 `[👤 人工]`，代表指挥员/研究员意志。 |

---

## 4. 链路防线：防幻觉校验与门禁（服务端）

在服务端处理 AI 生成返回时建立硬性过滤防线（已在 OV-5 试点打通）：
```text
  [知识库检索] ───► 得到合法切片集 ValidChunks: [C-1, C-2, C-3]
        │
        ▼ (携带 ValidChunks 注入提示词)
  [AI 模型生成] ───► 输出活动项与 citations: [C-1, Fake-Chunk-999]
        │
        ▼ (服务端防御性清洗)
  [防幻觉过滤器] ──► Fake-Chunk-999 不在 ValidChunks 中 ──► 坚决剔除并记录日志！
        │       ──► C-1 合法 ──► 保留并自动补齐源文件路径与章节名
        ▼
  [要素落库标记] ──► 有合法引用：origin = "cited"
                ──► 无合法引用：origin = "ai-inferred"
```

---

## 5. 界面呈现与成果导出规划（T2.3 实施指引）

1. **工作台检查器（Inspector Panel）**：
   - 选中任意活动或要素时，侧边栏展示【引用溯源】分区；
   - 展开展示文件路径、章节标题、原文片段（可一键定位）。
2. **产品顶部证据覆盖率指标**：
   - 顶部统计胶囊实时计算：  
     $$\text{证据覆盖率} = \frac{\text{标记为 cited 的要素总数}}{\text{要素总数}} \times 100\%$$
3. **成果导出（Office Word & Markdown）**：
   - 正文段落或表格中按引用顺序自动编排上标脚注 `[1]`, `[2]`；
   - 文末自动追加《参考文献与引用溯源清单》，列出源文档、章节与原文摘要。

---

> [!IMPORTANT]
> **T2.1 门禁检查点**：本设计稿纯为文档设计，未改动任何业务代码。当前状态：**已完成设计稿修订，停下等待人工确认**。
