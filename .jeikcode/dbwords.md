# 数据库表与字段词汇 (DB Words / Schema)

本文件定义 SQLite 数据库持久化（`data/projects.sqlite`）的核心表名、关键字段设计与中英文对照。

---

## 1. 核心数据表对照表

| 表名 | 实体中文名 | 主键 / 复合键 | 用途说明 |
| :--- | :--- | :--- | :--- |
| **`project_catalog`** | 项目目录与元数据 | `project_id` | 存储项目的标题、描述、归档状态与当前工作流阶段状态。 |
| **`project_records`** | 项目版本与主记录 | `project_id` | 存储修订版本号、简报版本号、当前研究方向与 JSON 数据包。 |
| **`project_briefs`** | 概念简报（六要素） | `project_id` | 存储作战概念纲要的核心六大要素字段。 |
| **`project_conversation_messages`** | 对话消息流 | `(project_id, message_id)` | 存储 AI 研究对话流的消息明细与时间线。 |
| **`project_resources`** | 通用产品模型资源表 | `(project_id, resource_key)` | 存储所有 DoDAF 视图、概念图模型、想定等的最新 JSON 结构。 |
| **`project_history_collections`** | 历史版本集合 | `(project_id, collection_key)` | 集合维度的历史快照汇总记录。 |
| **`project_history_items`** | 历史版本项明细 | `(project_id, collection_key, item_id)` | 针对特定产品的单条修订历史。 |
| **`project_collaboration`** | 协同会话总览 | `project_id` | 协同评审配置、权限与会话状态。 |
| **`project_collaboration_reviews`** | 协同评审记录 | `(project_id, review_id)` | 专家评审条目、批注与修改建议。 |
| **`project_collaboration_decisions`** | 协同评审裁决 | `(project_id, review_id)` | 针对评审意见的采纳、拒绝与落地决策。 |
| **`project_audit_events`** | 操作审计事件日志 | `(project_id, event_id)` | 系统关键写操作的审计跟踪与回溯。 |
| **`project_repository_state`** | 兼容性全局状态快照 | `id (CHECK id = 1)` | 兼容旧版单一 JSON 文件架构的全库备份快照。 |

---

## 2. 关键表字段详解

### 2.1 `project_briefs`（概念简报六要素）
- **`project_id`** (TEXT, PK): 关联项目唯一标识
- **`research_intent`** (TEXT): 研究意图与作战背景
- **`objective`** (TEXT): 作战目标（核心使命与达成效果）
- **`approach`** (TEXT): 行动途径（作战构想与运用方式）
- **`assumptions`** (TEXT): 关键假设（条件前置与边界）
- **`expected_effects`** (TEXT): 预期作战效能与成果
- **`risk`** (TEXT): 关键风险与应对预案
- **`evidence_refs_json`** (TEXT): 知识库双链依据引用 JSON 数组

### 2.2 `project_catalog`（项目目录元数据）
- **`project_id`** (TEXT, PK): 项目 ID
- **`title`** (TEXT): 项目标题
- **`description`** (TEXT): 项目简述
- **`archived`** (INTEGER): 归档标志（0=正常，1=已归档）
- **`workflow_json`** (TEXT): 18步工作流当前进行状态与门禁数据
- **`created_at`** (TEXT): 创建 ISO 时间戳
- **`updated_at`** (TEXT): 更新 ISO 时间戳

### 2.3 `project_resources`（通用模型资源）
- **`project_id`** (TEXT): 项目 ID
- **`resource_key`** (TEXT): 资源模型标识。常见值：
  - `ov1`: 高级作战概念描述图
  - `ov2`: 作战节点连接关系
  - `ov3`: 信息交换矩阵
  - `ov4`: 组织关系图
  - `ov5a`: 作战活动分解
  - `ov5b`: 作战活动流程
  - `ov6a`: 规则模型
  - `ov6b`: 状态机模型
  - `ov6c`: 事件时序模型
  - `concept_map`: 绘制工具双向同步图谱
  - `scenario`: 仿真想定
  - `validation`: 验证分析报告
- **`resource_json`** (TEXT): 模型完整数据 JSON

---

## 3. 索引优化 (Indexes)
- **`idx_project_resources_key`** on `project_resources(project_id, resource_key)`：资源读取高效点查
- **`idx_project_audit_revision`** on `project_audit_events(project_id, revision DESC)`：版本回滚与审计降序检索
