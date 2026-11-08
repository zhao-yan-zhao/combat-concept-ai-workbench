import { buildExportArtifactFromPayload } from "./reportBuilder.js";

const MAX_NODE_NOTES = 80;

export function buildObsidianArchive(payload) {
  const generatedAt = payload?.generatedAt || new Date().toISOString();
  const report = buildExportArtifactFromPayload("markdown", payload);
  const title = clean(payload?.project?.title, 120) || "作战概念研究";
  const stamp = generatedAt.replace(/[-:.TZ]/g, "").slice(0, 14) || "archive";
  const folderName = `${safeFileName(title)}-${stamp}`;
  const indexName = "研究归档.md";
  const briefName = "ConceptBrief.md";
  const activityFiles = (payload?.ov5?.activities || []).slice(0, MAX_NODE_NOTES).map((activity, index) => ({
    activity,
    fileName: `OV5-${safeFileName(activity?.id || `activity-${index + 1}`)}.md`
  }));
  const oodaFiles = flattenOoda(payload?.ooda).slice(0, MAX_NODE_NOTES).map(({ lane, node }, index) => ({
    lane,
    node,
    fileName: `OODA-${safeFileName(node?.id || `node-${index + 1}`)}.md`
  }));
  const activityById = new Map(activityFiles.map((item) => [String(item.activity?.id || ""), item]));
  const oodaByActivity = new Map();
  oodaFiles.forEach((item) => {
    const id = String(item.node?.sourceActivityId || "");
    if (!id) return;
    const nodes = oodaByActivity.get(id) || [];
    nodes.push(item);
    oodaByActivity.set(id, nodes);
  });

  const files = [
    { fileName: indexName, content: buildIndexNote({ title, generatedAt, payload, report, briefName, activityFiles, oodaFiles }) },
    { fileName: briefName, content: buildBriefNote({ title, generatedAt, payload, indexName, activityFiles, oodaFiles }) },
    ...activityFiles.map((item) => ({ fileName: item.fileName, content: buildActivityNote({ item, title, generatedAt, payload, indexName, briefName, oodaByActivity }) })),
    ...oodaFiles.map((item) => ({ fileName: item.fileName, content: buildOodaNote({ item, title, generatedAt, payload, indexName, briefName, activityById }) })),
    { fileName: "知识来源反向链接.md", content: buildKnowledgeBacklinkNote({ title, generatedAt, payload, indexName, activityFiles }) }
  ];

  return {
    filename: indexName,
    content: files[0].content,
    folderName,
    files,
    generatedAt
  };
}

function buildIndexNote({ title, generatedAt, payload, report, briefName, activityFiles, oodaFiles }) {
  const citations = extractPayloadCitations(payload);
  return [
    frontmatter("作战概念研究归档", title, generatedAt, payload, {
      direction: payload?.project?.direction || "未选择",
      citations
    }),
    `# ${title}`,
    "",
    "## 密级与元数据",
    `- 密级标识：${payload?.classification || payload?.project?.classification || "内部"}`,
    `- 报告版本：${payload?.reportVersion?.label || "未归档草稿"}`,
    `- 采用模板：${payload?.reportTemplate?.label || payload?.reportTemplate?.id || "通用"}`,
    `- 归档时间：${generatedAt}`,
    "",
    "## 设计节点索引",
    `- ${link(briefName)}`,
    `- 作战活动：${activityFiles.map((item) => link(item.fileName)).join("、") || "未生成"}`,
    `- OODA 节点：${oodaFiles.map((item) => link(item.fileName)).join("、") || "未生成"}`,
    `- ${link("知识来源反向链接.md")}`,
    "",
    "## 成果正文",
    report.content
  ].join("\n");
}

function buildBriefNote({ title, generatedAt, payload, indexName, activityFiles, oodaFiles }) {
  const brief = payload?.project?.brief || {};
  const citations = Array.isArray(brief.evidenceRefs) ? brief.evidenceRefs : [];
  return [
    frontmatter("ConceptBrief", title, generatedAt, payload, { citations }),
    `# ${title} / ConceptBrief`,
    "",
    `返回：${link(indexName)}`,
    "",
    "## 目标",
    clean(brief.objective, 1600) || "未填写",
    "",
    "## 方法",
    clean(brief.approach, 1600) || "未填写",
    "",
    "## 假设",
    clean(brief.assumptions, 1600) || "未填写",
    "",
    "## 预期效果",
    clean(brief.expectedEffects, 1600) || "未填写",
    "",
    "## 知识依据与双链",
    ...(citations.length
      ? citations.map((reference) => `- ${linkEvidence(reference)}`)
      : ["- 未关联知识库依据"]),
    "",
    "## 风险",
    clean(brief.risk, 1600) || "未填写",
    "",
    "## 派生节点",
    `- 作战活动：${activityFiles.map((item) => link(item.fileName)).join("、") || "未生成"}`,
    `- OODA 决策链：${oodaFiles.map((item) => link(item.fileName)).join("、") || "未生成"}`
  ].join("\n");
}

function buildActivityNote({ item, title, generatedAt, payload, indexName, briefName, oodaByActivity }) {
  const activity = item.activity || {};
  const ooda = oodaByActivity.get(String(activity.id || "")) || [];
  const citations = [
    ...(activity.refs || []),
    ...(activity.citations || []).map((c) => c.sourcePath || c.chunkId || c.heading).filter(Boolean)
  ];
  return [
    frontmatter("作战活动", title, generatedAt, payload, {
      design_node_id: activity.id || "",
      activity_type: activity.type || "未分类",
      citations
    }),
    `# ${clean(activity.title, 240) || "未命名活动"}`,
    "",
    `返回：${link(indexName)} · 来源：${link(briefName)}`,
    "",
    `- 类型：${clean(activity.type, 120) || "未分类"}`,
    `- 输入：${clean(activity.input, 800) || "未定义"}`,
    `- 输出：${clean(activity.output, 800) || "未定义"}`,
    `- 时长：${clean(activity.duration, 160) || "待估算"}`,
    "",
    "## 说明",
    clean(activity.description, 2400) || "未填写",
    "",
    "## 引用依据双链",
    citations.length
      ? citations.map((cite) => `- ${linkEvidence(cite)}`).join("\n")
      : "- 无直接引用",
    "",
    "## 关联 OODA 节点",
    ooda.length ? ooda.map((node) => `- ${link(node.fileName)}`).join("\n") : "- 未关联"
  ].join("\n");
}

function buildOodaNote({ item, title, generatedAt, payload, indexName, briefName, activityById }) {
  const node = item.node || {};
  const activity = activityById.get(String(node.sourceActivityId || ""));
  const citations = Array.isArray(node.knowledgeRefs) ? node.knowledgeRefs : [];
  return [
    frontmatter("OODA 节点", title, generatedAt, payload, {
      design_node_id: node.id || "",
      lane: item.lane?.id || "",
      citations
    }),
    `# ${clean(node.title, 240) || "未命名 OODA 节点"}`,
    "",
    `返回：${link(indexName)} · 概念：${link(briefName)}${activity ? ` · 来源活动：${link(activity.fileName)}` : ""}`,
    "",
    `- 阶段：${clean(item.lane?.title, 120) || "未分类"}`,
    `- 输入：${clean(node.input, 800) || "未定义"}`,
    `- 输出：${clean(node.output, 800) || "未定义"}`,
    `- 时长：${clean(node.duration, 160) || "待估算"}`,
    `- 裁决规则：${clean(node.rule, 400) || "未指定"}`,
    "",
    "## 说明",
    clean(node.description, 2400) || "未填写",
    "",
    "## 关联依据",
    citations.length ? citations.map((c) => `- ${linkEvidence(c)}`).join("\n") : "- 无直接依据"
  ].join("\n");
}

function buildKnowledgeBacklinkNote({ title, generatedAt, payload, indexName, activityFiles }) {
  const activityRefs = new Set(activityFiles.flatMap((item) => item.activity?.refs || []).map((value) => String(value)));
  const entries = payload?.knowledge?.evidence?.entries || [];
  const citations = extractPayloadCitations(payload);
  return [
    frontmatter("知识来源反向链接", title, generatedAt, payload, { citations }),
    "# 知识来源反向链接",
    "",
    `返回：${link(indexName)}`,
    "",
    "此索引仅列出已进入报告的可引用证据；敏感 Vault 片段不会写入归档或链接。",
    "",
    "## 可引用证据与双向链路",
    ...(entries.length ? entries.map((entry) => {
      const label = clean(entry.fileTitle || entry.title || entry.id, 240) || "未命名证据";
      const linkedActivities = activityFiles.filter((item) => (item.activity?.refs || []).some((ref) => activityRefs.has(String(ref)) && String(ref) === String(entry.id))).map((item) => link(item.fileName));
      return `- ${linkEvidence(label)}${linkedActivities.length ? ` -> ${linkedActivities.join("、")}` : ""}`;
    }) : ["- 未引用可公开证据"])
  ].join("\n");
}

function flattenOoda(ooda) {
  return (ooda?.lanes || []).flatMap((lane) => (lane?.nodes || []).map((node) => ({ lane, node })));
}

/**
 * Standard Frontmatter generator adhering to T4.4:
 * Must contain project (id/title/kind), version, time, citations, classification, template_id
 */
export function frontmatter(type, title, generatedAt, payload = null, fields = {}) {
  const projectId = payload?.project?.id || "default";
  const projectTitle = clean(payload?.project?.title, 120) || "作战概念研究";
  const projectKind = payload?.project?.kind || "tactic";
  const version = payload?.reportVersion?.label || "未归档草稿";
  const classification = payload?.classification || payload?.project?.classification || "内部";
  const templateId = payload?.reportTemplate?.id || "tactic-doc";

  const citations = fields.citations || (payload ? extractPayloadCitations(payload) : []);
  const otherFields = { ...fields };
  delete otherFields.citations;

  const lines = [
    "---",
    `title: ${yaml(title)}`,
    `type: ${type}`,
    `project_id: ${yaml(projectId)}`,
    `project_title: ${yaml(projectTitle)}`,
    `project_kind: ${yaml(projectKind)}`,
    `report_version: ${yaml(version)}`,
    `classification: ${yaml(classification)}`,
    `template_id: ${yaml(templateId)}`,
    `generated_at: ${yaml(generatedAt)}`
  ];

  for (const [key, value] of Object.entries(otherFields)) {
    if (value !== undefined && value !== null && value !== "") {
      lines.push(`${key}: ${yaml(value)}`);
    }
  }

  if (Array.isArray(citations) && citations.length) {
    lines.push("citations:");
    for (const cite of citations) {
      lines.push(`  - ${yaml(cite)}`);
    }
  }

  lines.push("tags:");
  lines.push("  - 作战概念");
  lines.push("  - 研究归档");
  if (projectKind) lines.push(`  - ${projectKind}`);
  lines.push("---");
  lines.push("");
  return lines.join("\n");
}

export function extractPayloadCitations(payload) {
  const result = [];
  if (Array.isArray(payload?.project?.brief?.evidenceRefs)) {
    result.push(...payload.project.brief.evidenceRefs);
  }
  if (Array.isArray(payload?.project?.citations)) {
    for (const c of payload.project.citations) {
      if (typeof c === "string") result.push(c);
      else if (c?.title || c?.ref || c?.chunkId) result.push(c.title || c.ref || c.chunkId);
    }
  }
  if (Array.isArray(payload?.ov5?.activities)) {
    for (const a of payload.ov5.activities) {
      if (Array.isArray(a.refs)) result.push(...a.refs);
      if (Array.isArray(a.citations)) {
        for (const c of a.citations) {
          if (c?.sourcePath || c?.chunkId || c?.heading) {
            result.push(`${c.sourcePath || ""}${c.heading ? `#${c.heading}` : ""}`);
          }
        }
      }
    }
  }
  if (Array.isArray(payload?.knowledge?.evidence?.entries)) {
    for (const e of payload.knowledge.evidence.entries) {
      if (e?.fileTitle || e?.title || e?.id) {
        result.push(e.fileTitle || e.title || e.id);
      }
    }
  }
  return [...new Set(result.map((s) => String(s || "").trim()).filter(Boolean))];
}

export function link(fileName) {
  return `[[${String(fileName || "").replace(/\.md$/i, "")}]]`;
}

export function linkEvidence(evidence) {
  const cleanStr = String(evidence || "").trim().replace(/\.md$/i, "");
  if (!cleanStr) return "";
  return `[[${cleanStr}]]`;
}

function safeFileName(value) {
  return clean(value, 100).replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 90) || "未命名";
}

function clean(value, maximum) {
  return String(value || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function yaml(value) {
  return JSON.stringify(String(value || ""));
}
