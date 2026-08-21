import { createDeploymentData } from "./scenarioStore.js";
import { resolveTargetOrigin } from "./deploymentBridgeStore.js";
import { ov1Nodes } from "./data.js";
import { toInspirationReportSnapshot } from "./inspirationStore.js";
import { buildTraceability } from "./traceabilityBuilder.js";
import { buildKnowledgeGraph } from "./knowledgeGraphBuilder.js";
import { buildSimulationDiagnostics } from "./simulationAdapter.js";
import { buildOv2Model } from "./ov2Builder.js";
import { buildOv3Model } from "./ov3Builder.js";
import { buildOv4Model } from "./ov4Builder.js";
import { buildOv6cModel } from "./ov6cBuilder.js";
import { buildOv5aModel, buildOv6aModel, buildOv6bModel } from "./dodafOperationalBuilders.js";
import { filterKnowledgeForReportCitation } from "../../server/projectKnowledgeCitationPolicy.mjs";
import { getReportTemplate } from "./reportTemplateStore.js";
import { buildOv1cModel, buildOv7Model } from "./mappingProductStore.js";

export function buildExportArtifact(type, context) {
  return buildExportArtifactFromPayload(type, buildReportPayload(context));
}

export function buildExportArtifactFromPayload(type, payload) {
  const versionSuffix = payload.reportVersion?.label ? `-${payload.reportVersion.label.toLowerCase()}` : "";
  const templateSuffix = payload.reportTemplate?.id ? `-${String(payload.reportTemplate.id).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "")}` : "";
  if (type === "markdown") {
    return {
      content: buildMarkdownReport(payload),
      filename: `combat-concept-research-report${versionSuffix}${templateSuffix}.md`,
      mime: "text/markdown;charset=utf-8",
      label: "Markdown 报告"
    };
  }
  if (type === "rtf") {
    return {
      content: buildRtfReport(payload),
      filename: `combat-concept-research-report${versionSuffix}${templateSuffix}.rtf`,
      mime: "application/rtf;charset=utf-8",
      label: "Word 兼容报告"
    };
  }
  if (type === "xml") {
    return {
      content: buildXmlReport(payload),
      filename: `combat-concept-research-report${versionSuffix}${templateSuffix}.xml`,
      mime: "application/xml;charset=utf-8",
      label: "XML 报告"
    };
  }
  if (type === "map") {
    return {
      content: JSON.stringify({ version: 1, artifact: "deployment_input", deploymentData: payload.scenario?.deploymentData || null }, null, 2),
      filename: `combat-concept-deployment-input${versionSuffix}.json`,
      mime: "application/json;charset=utf-8",
      label: "部署图输入"
    };
  }
  if (type === "geojson") {
    return {
      content: JSON.stringify(payload.scenario?.deploymentData?.geojson || { type: "FeatureCollection", properties: { coordinateReference: "abstract-percent-grid" }, features: [] }, null, 2),
      filename: `combat-concept-scenario${versionSuffix}.geojson`,
      mime: "application/geo+json;charset=utf-8",
      label: "GeoJSON 想定空间数据"
    };
  }
  return {
    content: JSON.stringify({ version: 1, artifact: "research_package", ...payload }, null, 2),
    filename: `combat-concept-research-package${versionSuffix}.json`,
    mime: "application/json;charset=utf-8",
    label: "JSON 数据包"
  };
}

export function buildReportPayload({ project, brief, inspiration, direction, forceMission = null, ov1, ov5, ooda, scenario, validationResult, knowledge, deployment, modelSnapshots = [], modelComparison = null, projectRepository = null, collaboration = null, knowledgeCitationApprovals = [], reportTemplate = null, ov1c: persistedOv1c = null, ov2: persistedOv2 = null, ov3: persistedOv3 = null, ov4: persistedOv4 = null, ov5a: persistedOv5a = null, ov6a: persistedOv6a = null, ov6b: persistedOv6b = null, ov6c: persistedOv6c = null, ov7: persistedOv7 = null }) {
  const activityRefs = unique(ov5.activities.flatMap((activity) => activity.refs || []));
  const deploymentData = scenario ? createDeploymentData(scenario) : null;
  const knowledgeSummary = buildKnowledgeSummary(knowledge, activityRefs, knowledgeCitationApprovals);
  const reportBrief = filterBriefEvidenceRefs(brief || project.brief, knowledge, knowledgeCitationApprovals);
  const ov1Snapshot = buildOv1Snapshot(ov1);
  const traceability = buildTraceability({ ov1: ov1Snapshot, ov5, ooda, scenario });
  // Prefer persisted DoDAF products when present; otherwise seed from builders.
  const ov2 = persistedOv2 || buildOv2Model({ forceMission, ov1: ov1Snapshot, ov5, ooda, scenario });
  const ov3 = persistedOv3 || buildOv3Model({ ov2, scenario });
  const ov4 = persistedOv4 || buildOv4Model({ forceMission, ov1: ov1Snapshot, ov5, ooda, scenario });
  const ov5a = persistedOv5a || buildOv5aModel({ ov5 });
  const ov6a = persistedOv6a || buildOv6aModel({ ov5 });
  const ov6b = persistedOv6b || buildOv6bModel({ ooda });
  const ov6c = persistedOv6c || buildOv6cModel({ ooda, scenario });
  const ov1c = buildOv1cModel({ forceMission, ov5, ov1c: persistedOv1c || { mappings: [] } });
  const ov7 = buildOv7Model({ ov5, ov6b, ov7: persistedOv7 || { mappings: [] } });
  return {
    generatedAt: new Date().toISOString(),
    reportTemplate: getReportTemplate(reportTemplate),
    standard: "DoDAF-2.02-DM2",
    project: { title: project.title, direction, brief: reportBrief, citations: project.citations },
    inspiration: toInspirationReportSnapshot(inspiration),
    ov1: ov1Snapshot,
    ov1c,
    ov2,
    ov3,
    ov4,
    ov5a,
    ov6a,
    ov6b,
    ov6c,
    ov7,
    ov5: {
      provenance: ov5.provenance || null,
      activities: ov5.activities.map((activity) => ({
        id: activity.id,
        title: activity.title,
        type: activity.type,
        input: activity.input,
        output: activity.output,
        duration: activity.duration,
        parentId: activity.parentId || "",
        resources: activity.resources || "",
        preconditions: activity.preconditions || "",
        constraints: activity.constraints || "",
        description: activity.text,
        refs: activity.refs || []
      })),
      edges: ov5.edges
    },
    ooda: {
      provenance: ooda.provenance || null,
      sourceActivityIds: ooda.sourceActivityIds,
      durationMinutes: getOodaDuration(ooda),
      lanes: ooda.lanes.map((lane) => ({
        id: lane.id,
        title: lane.title,
        subtitle: lane.subtitle,
        nodes: lane.nodes.map((node) => ({
          id: node.id,
          title: node.title,
          input: node.input,
          output: node.output,
          duration: node.duration,
          rule: node.rule,
          description: node.text,
          sourceActivityId: node.sourceActivityId,
          equipmentRefs: node.equipmentRefs || [],
          knowledgeRefs: node.knowledgeRefs || []
        }))
      }))
    },
    scenario: scenario ? {
      id: scenario.id,
      generatedAt: scenario.generatedAt,
      updatedAt: scenario.updatedAt || scenario.generatedAt,
      deploymentPlan: scenario.deploymentPlan || null,
      deploymentData,
      simulation: buildSimulationReportSummary(scenario)
    } : null,
    deploymentBridge: buildDeploymentBridgeSummary(deployment, scenario),
    traceability,
    validation: validationResult ? {
      generatedAt: validationResult.generatedAt,
      scores: validationResult.scores,
      issues: validationResult.issues,
      traceabilityDiagnostics: validationResult.traceabilityDiagnostics || null,
      oodaDiagnostics: validationResult.oodaDiagnostics || null,
      flowDiagnostics: validationResult.flowDiagnostics || null,
      derivedOperationalDiagnostics: validationResult.derivedOperationalDiagnostics || null,
      redTeam: validationResult.redTeam,
      redTeamReview: validationResult.redTeamReview || null
    } : null,
    knowledge: knowledgeSummary,
    validationMaturity: buildValidationMaturity({ ov5, ooda, scenario, validationResult, knowledge: knowledgeSummary, traceability }),
    collaboration: buildCollaborationSummary(collaboration, knowledge),
    projectAudit: buildProjectAuditSummary(collaboration?.auditEntries),
    modelGovernance: buildModelGovernance(modelSnapshots, modelComparison),
    projectRepository: buildProjectRepositorySummary(projectRepository)
  };
}

export function buildMarkdownReport(payload) {
  const template = getReportTemplate(payload.reportTemplate);
  const lines = [
    `Report template: ${inline(template.label)} (${inline(template.id)})`,
    `Template purpose: ${inline(template.description)}`,
    "",
    `# ${inline(payload.project.title)} ${inline(template.documentTitle)}`,
    "",
    `报告版本：${inline(payload.reportVersion?.label || "未归档草稿")}`,
    payload.reportVersion?.savedAt ? `归档时间：${inline(payload.reportVersion.savedAt)}` : "",
    `生成时间：${payload.generatedAt}`,
    "",
    "## 概念简报",
    `- 概念方向：${inline(payload.project.direction)}`,
    `- 作战目标：${inline(payload.project.brief.objective)}`,
    `- 核心思路：${inline(payload.project.brief.approach)}`,
    `- 关键假设：${inline(payload.project.brief.assumptions)}`,
    `- 预期效果：${inline(payload.project.brief.expectedEffects)}`,
    `- 知识依据：${inline((payload.project.brief.evidenceRefs || []).join("、") || "未关联")}`,
    `- 主要风险：${inline(payload.project.brief.risk)}`,
    "",
    "## 灵感孵化轨迹",
    ...renderInspirationSection(payload.inspiration),
    "",
    "## OV-1 总体概念（高层作战概念图）",
    `- 生成来源：${generationLabel(payload.ov1?.provenance)}`,
    ...renderOv1Section(payload.ov1),
    "",
    "## OV-2 作战资源流描述（OV-2 作战节点交换）",
    ...renderOv2Section(payload.ov2),
    "",
    "## OV-3 作战资源流矩阵（OV-3 资源交换）",
    ...renderOv3Section(payload.ov3),
    "",
    "## OV-4 作战组织关系图",
    ...renderOv4Section(payload.ov4),
    "",
    "## OV-5a 作战活动分解",
    ...renderActivityDecompositions(payload.ov5a, payload.ov5.activities),
    "",
    "## OV-6a 作战规则模型",
    ...renderDerivedRules(payload.ov6a),
    "",
    "## OV-6b 作战状态转换",
    ...renderDerivedTransitions(payload.ov6b),
    "",
    "## OV-6c 事件序列",
    ...renderOv6cSection(payload.ov6c),
    "",
    "## OV-1c 任务与作战活动映射",
    ...renderMappingSection(payload.ov1c, "task"),
    "",
    "## OV-7 状态与活动映射",
    ...renderMappingSection(payload.ov7, "state"),
    "",
    "## 跨视图追溯",
    ...renderTraceabilitySection(payload.traceability),
    "",
    "## OV-5b 作战活动模型",
    `- 生成来源：${generationLabel(payload.ov5.provenance)}`,
    ...evidenceSelectionLines(payload.ov5.provenance?.evidenceSelection),
    "| 活动 | 类型 | 输入 | 输出 | 耗时 | 知识依据 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...payload.ov5.activities.map((activity) => `| ${cell(activity.title)} | ${cell(activity.type)} | ${cell(activity.input)} | ${cell(activity.output)} | ${cell(activity.duration)} | ${cell(activity.refs.join("、"))} |`),
    "",
    `活动关联：${payload.ov5.edges.map((edge) => `${edge.sourceId} -> ${edge.targetId}（${edge.type}）`).join("；") || "未定义"}`,
    "",
    "## 研究辅助循环",
    `- 生成来源：${generationLabel(payload.ooda.provenance)}`,
    ...evidenceSelectionLines(payload.ooda.provenance?.evidenceSelection),
    `- 周期估算：${payload.ooda.durationMinutes || "待估算"} 分钟`,
    ...payload.ooda.lanes.flatMap((lane) => [
      `### ${inline(lane.subtitle)}（${inline(lane.title)}）`,
      ...(lane.nodes.length ? lane.nodes.map((node) => `- ${inline(node.title)}：输入 ${inline(node.input)}；输出 ${inline(node.output)}；耗时 ${inline(node.duration)}；规则 ${inline(node.rule)}；关联装备 ${inline((node.equipmentRefs || []).join("、") || "未关联")}；知识依据 ${inline((node.knowledgeRefs || []).join("、") || "未关联")}`) : ["- 未定义节点"])
    ]),
    "",
    "## 自动想定",
    ...renderScenarioSection(payload.scenario),
    "",
    "## 部署图桥接",
    ...renderDeploymentBridgeSection(payload.deploymentBridge),
    "",
    "## 设计验证",
    ...renderValidationSection(payload.validation),
    ...renderTraceabilityDiagnosticsSection(payload.validation?.traceabilityDiagnostics),
    ...renderOodaDiagnosticsSection(payload.validation?.oodaDiagnostics),
    ...renderFlowDiagnosticsSection(payload.validation?.flowDiagnostics),
    "",
    "### 验证成熟度",
    `- 当前结论：${inline(payload.validationMaturity.label)}（${payload.validationMaturity.readyCount}/${payload.validationMaturity.totalCount} 项已满足）`,
    ...payload.validationMaturity.checks.map((check) => `- [${inline(check.statusLabel)}] ${inline(check.label)}：${inline(check.detail)}`),
    "",
    "## 协同审阅",
    ...renderCollaborationSection(payload.collaboration),
    "",
    "## 项目审计摘要",
    ...renderProjectAuditSection(payload.projectAudit),
    "",
    "## 项目模型版本",
    ...renderProjectRepositorySection(payload.projectRepository),
    "",
    "## 知识依据",
    ...renderKnowledgeSection(payload.knowledge),
    "",
    "## 版本治理",
    ...renderModelGovernanceSection(payload.modelGovernance),
    "",
    "## 概念引用",
    ...payload.project.citations.map((citation) => `- ${inline(citation.title)}：${inline(citation.text)}（${inline(citation.ref)}）`)
  ];
  return lines.join("\n");
}

export function buildRtfReport(payload) {
  const lines = buildMarkdownReport(payload).split("\n");
  return [
    "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}\\paperw11906\\paperh16838\\margl1440\\margr1440\\margt1440\\margb1440\\fs22",
    ...lines.map(renderRtfLine),
    "}"
  ].join("\n");
}

function renderRtfLine(line) {
  if (line.startsWith("# ")) return `\\pard\\qc\\b\\fs32 ${rtf(line.slice(2))}\\b0\\fs22\\par`;
  if (line.startsWith("## ")) return `\\pard\\sb240\\sa120\\b\\fs28 ${rtf(line.slice(3))}\\b0\\fs22\\par`;
  if (line.startsWith("### ")) return `\\pard\\sb160\\sa80\\b\\fs24 ${rtf(line.slice(4))}\\b0\\fs22\\par`;
  return `\\pard\\sa80 ${rtf(line)}\\par`;
}

export function buildXmlReport(payload) {
  const template = getReportTemplate(payload.reportTemplate);
  const project = payload.project || {};
  const ov1 = payload.ov1 || {};
  const ov2 = payload.ov2 || {};
  const ov3 = payload.ov3 || {};
  const ov4 = payload.ov4 || {};
  const ov6c = payload.ov6c || {};
  const ov1c = payload.ov1c || {};
  const ov7 = payload.ov7 || {};
  const ov5 = payload.ov5 || {};
  const ooda = payload.ooda || {};
  const scenario = payload.scenario;
  const bridge = payload.deploymentBridge || {};
  const validation = payload.validation;
  const knowledge = payload.knowledge;
  const maturity = payload.validationMaturity || {};
  const collaboration = payload.collaboration || null;
  const projectAudit = payload.projectAudit || null;
  const governance = payload.modelGovernance || {};
  const repository = payload.projectRepository || {};
  const traceability = payload.traceability || {};
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<combatConceptResearchReport schemaVersion="1" generatedAt="${xml(payload.generatedAt)}" reportVersion="${xml(payload.reportVersion?.label || "draft")}" reportTemplateId="${xml(template.id)}">`,
    `  <reportTemplate id="${xml(template.id)}"><label>${xml(template.label)}</label><documentTitle>${xml(template.documentTitle)}</documentTitle><description>${xml(template.description)}</description></reportTemplate>`,
    "  <project>",
    xmlElement("title", project.title, 2),
    xmlElement("direction", project.direction, 2),
    xmlElement("objective", project.brief?.objective, 2),
    xmlElement("approach", project.brief?.approach, 2),
    xmlElement("assumptions", project.brief?.assumptions, 2),
    xmlElement("expectedEffects", project.brief?.expectedEffects, 2),
    `  <briefEvidenceRefs>${(project.brief?.evidenceRefs || []).map((reference) => `<reference>${xml(reference)}</reference>`).join("")}</briefEvidenceRefs>`,
    xmlElement("risk", project.brief?.risk, 2),
    "  </project>",
    ...renderXmlProjectRepository(repository),
    ...renderXmlInspiration(payload.inspiration),
    `  <overallConcept title="${xml(ov1.title || "OV-1 总体概念")}" generationSource="${xml(ov1.provenance?.mode || "manual")}">`,
    ...(ov1.nodes || []).flatMap((node) => [
      `    <node id="${xml(node.id)}">`,
      xmlElement("label", node.label, 3),
      xmlElement("description", node.description, 3),
      `      <position x="${xml(node.x)}" y="${xml(node.y)}"/>`,
      "    </node>"
    ]),
    ...(ov1.edges || []).map((edge) => `    <edge id="${xml(edge.id)}" sourceId="${xml(edge.sourceId)}" targetId="${xml(edge.targetId)}" type="${xml(edge.type)}"/>`),
    "  </overallConcept>",
    ...renderXmlOv2(ov2),
    ...renderXmlOv3(ov3),
    ...renderXmlOv4(ov4),
    ...renderXmlOv6c(ov6c),
    ...renderXmlMappings("ov1c", ov1c),
    ...renderXmlMappings("ov7", ov7),
    ...renderXmlTraceability(traceability),
    `  <ov5 generationSource="${xml(payload.ov5?.provenance?.mode || "manual")}"${evidenceSelectionAttributes(payload.ov5?.provenance?.evidenceSelection)}>`,
    ...(ov5.activities || []).flatMap((activity) => [
      `    <activity id="${xml(activity.id)}" type="${xml(activity.type)}" parentId="${xml(activity.parentId)}">`,
      xmlElement("title", activity.title, 3),
      xmlElement("input", activity.input, 3),
      xmlElement("output", activity.output, 3),
      xmlElement("duration", activity.duration, 3),
      xmlElement("resources", activity.resources, 3),
      xmlElement("preconditions", activity.preconditions, 3),
      xmlElement("constraints", activity.constraints, 3),
      xmlElement("description", activity.description, 3),
      "      <references>",
      ...(activity.refs || []).map((ref) => xmlElement("reference", ref, 4)),
      "      </references>",
      "    </activity>"
    ]),
    ...(ov5.edges || []).flatMap((edge) => [
      `    <edge sourceId="${xml(edge.sourceId)}" targetId="${xml(edge.targetId)}" type="${xml(edge.type)}">`,
      xmlElement("payload", edge.payload, 3),
      xmlElement("condition", edge.condition, 3),
      "    </edge>"
    ]),
    "  </ov5>",
    `  <ooda durationMinutes="${xml(ooda.durationMinutes)}" generationSource="${xml(ooda.provenance?.mode || "derived")}"${evidenceSelectionAttributes(ooda.provenance?.evidenceSelection)}>`,
    ...(ooda.lanes || []).flatMap((lane) => [
      `    <lane id="${xml(lane.id)}" title="${xml(lane.title)}" subtitle="${xml(lane.subtitle)}">`,
      ...(lane.nodes || []).flatMap((node) => [
        `      <node id="${xml(node.id)}" sourceActivityId="${xml(node.sourceActivityId)}">`,
        xmlElement("title", node.title, 4),
        xmlElement("input", node.input, 4),
        xmlElement("output", node.output, 4),
        xmlElement("duration", node.duration, 4),
        xmlElement("rule", node.rule, 4),
        xmlElement("description", node.description, 4),
        "        <equipmentReferences>",
        ...(node.equipmentRefs || []).map((reference) => xmlElement("reference", reference, 5)),
        "        </equipmentReferences>",
        "        <knowledgeReferences>",
        ...(node.knowledgeRefs || []).map((reference) => xmlElement("reference", reference, 5)),
        "        </knowledgeReferences>",
        "      </node>"
      ]),
      "    </lane>"
    ]),
    "  </ooda>",
    ...renderXmlScenario(scenario),
    `  <deploymentBridge status="${xml(bridge.status)}" targetUrl="${xml(bridge.targetUrl)}" targetOrigin="${xml(bridge.targetOrigin)}" embedded="${bridge.embedded ? "true" : "false"}" synchronized="${bridge.synchronized ? "true" : "false"}">`,
    xmlElement("scenarioId", bridge.scenarioId, 2),
    xmlElement("entityCount", bridge.entityCount, 2),
    ...(bridge.lastAccepted ? [`    <acceptedReturn bridgeOrigin="${xml(bridge.lastAccepted.bridgeOrigin)}" exchangeId="${xml(bridge.lastAccepted.exchangeId)}" changeId="${xml(bridge.lastAccepted.changeId)}" receivedAt="${xml(bridge.lastAccepted.receivedAt)}"/>`] : []),
    "  </deploymentBridge>",
    ...renderXmlValidation(validation),
    ...renderXmlCollaboration(collaboration),
    ...renderXmlProjectAudit(projectAudit),
    ...renderXmlKnowledge(knowledge),
    `  <validationMaturity label="${xml(maturity.label)}" readyCount="${xml(maturity.readyCount)}" totalCount="${xml(maturity.totalCount)}">`,
    ...(maturity.checks || []).map((check) => `    <check id="${xml(check.id)}" state="${xml(check.state)}" statusLabel="${xml(check.statusLabel)}"><label>${xml(check.label)}</label><detail>${xml(check.detail)}</detail></check>`),
    "  </validationMaturity>",
    ...renderXmlModelGovernance(governance),
    "  <citations>",
    ...(project.citations || []).map((citation) => `    <citation ref="${xml(citation.ref)}"><title>${xml(citation.title)}</title><text>${xml(citation.text)}</text></citation>`),
    "  </citations>",
    "</combatConceptResearchReport>"
  ];
  return lines.join("\n");
}

function renderOv1Section(ov1) {
  const nodes = ov1?.nodes || [];
  if (!nodes.length) return ["- 尚未保存 OV-1 总体概念节点。"];
  const labels = new Map(nodes.map((node) => [node.id, node.label]));
  const edges = ov1?.edges || [];
  return [
    ...nodes.map((node) => `- ${inline(node.label)}：${inline(node.description)}${node.category ? `（类别：${inline(node.category)}）` : ""}${node.evidenceRefs?.length ? `；依据：${node.evidenceRefs.map(inline).join("、")}` : ""}`),
    "",
    `关系：${edges.length ? edges.map((edge) => `${inline(labels.get(edge.sourceId) || edge.sourceId)} -> ${inline(labels.get(edge.targetId) || edge.targetId)}（${inline(edge.type)}）`).join("；") : "未定义"}`
  ];
}

function renderOv2Section(ov2) {
  if (!ov2?.nodes?.length) return ["- 尚未从 OV-1/OV-5 推导作战节点交换。"];
  return [
    `- 来源：OV-1 ${ov2.source?.ov1NodeCount || 0} 个节点，OV-5 ${ov2.source?.ov5ActivityCount || 0} 个活动 / ${ov2.source?.ov5EdgeCount || 0} 条关系。`,
    `- 推导结果：${ov2.nodes.length} 个作战节点，${ov2.exchanges?.length || 0} 条跨节点交换。`,
    "",
    "### 作战节点",
    ...ov2.nodes.map((node) => `- ${inline(node.label)}：OV-5 ${node.activityCount}，OODA ${node.oodaCount}，想定 ${node.entityCount}`),
    "",
    "### 节点交换",
    ...(ov2.exchanges?.length ? ov2.exchanges.map((exchange) => `- ${inline(exchange.sourceNodeLabel)} -> ${inline(exchange.targetNodeLabel)}：${inline(exchange.label)}（${inline(exchange.sourceActivityTitle)} -> ${inline(exchange.targetActivityTitle)}）`) : ["- 尚未定义跨节点交换。"]),
    "",
    "### 推导诊断",
    ...(ov2.diagnostics || []).map((item) => `- [${inline(item.statusLabel)}] ${inline(item.label)}：${inline(item.detail)}`)
  ];
}

function renderXmlOv2(ov2) {
  if (!ov2?.nodes?.length) return ["  <ov2 status=\"not-derived\"/>"];
  return [
    `  <ov2 kind="${xml(ov2.kind)}" version="${xml(ov2.version)}" generatedAt="${xml(ov2.generatedAt)}" nodeCount="${xml(ov2.nodes.length)}" exchangeCount="${xml(ov2.exchanges?.length || 0)}">`,
    `    <source ov1NodeCount="${xml(ov2.source?.ov1NodeCount)}" ov5ActivityCount="${xml(ov2.source?.ov5ActivityCount)}" ov5EdgeCount="${xml(ov2.source?.ov5EdgeCount)}" oodaNodeCount="${xml(ov2.source?.oodaNodeCount)}" scenarioEntityCount="${xml(ov2.source?.scenarioEntityCount)}"/>`,
    "    <operationalNodes>",
    ...ov2.nodes.map((node) => `      <node id="${xml(node.id)}" sourceOv1NodeId="${xml(node.sourceOv1NodeId)}" activityCount="${xml(node.activityCount)}" oodaCount="${xml(node.oodaCount)}" entityCount="${xml(node.entityCount)}"><label>${xml(node.label)}</label><detail>${xml(node.detail)}</detail></node>`),
    "    </operationalNodes>",
    "    <exchanges>",
    ...(ov2.exchanges || []).map((exchange) => `      <exchange id="${xml(exchange.id)}" sourceNodeId="${xml(exchange.sourceNodeId)}" targetNodeId="${xml(exchange.targetNodeId)}" flowType="${xml(exchange.flowType)}" sourceActivityId="${xml(exchange.sourceActivityId)}" targetActivityId="${xml(exchange.targetActivityId)}"><label>${xml(exchange.label)}</label><sourceActivity>${xml(exchange.sourceActivityTitle)}</sourceActivity><targetActivity>${xml(exchange.targetActivityTitle)}</targetActivity></exchange>`),
    "    </exchanges>",
    "    <diagnostics>",
    ...(ov2.diagnostics || []).map((item) => `      <check id="${xml(item.id)}" state="${xml(item.state)}" statusLabel="${xml(item.statusLabel)}"><label>${xml(item.label)}</label><detail>${xml(item.detail)}</detail></check>`),
    "    </diagnostics>",
    "  </ov2>"
  ];
}

function renderOv3Section(ov3) {
  if (!ov3?.exchanges?.length) return ["- 尚未从 OV-5 推导资源交换。"];
  return [
    `- 来源：OV-5 ${ov3.source?.ov5ActivityCount || 0} 个活动 / ${ov3.source?.ov5EdgeCount || 0} 条关系，关联想定实体 ${ov3.source?.scenarioEntityCount || 0} 个。`,
    `- 推导结果：${ov3.exchanges.length} 条交换；定义缺失 ${ov3.unresolved?.missingContractCount || 0} 条，需人工映射 ${ov3.unresolved?.mismatchCount || 0} 条。`,
    "",
    "### 交换清单",
    ...ov3.exchanges.map((exchange) => `- ${inline(exchange.sourceActivityTitle)} -> ${inline(exchange.targetActivityTitle)} [${inline(exchange.exchangeType)}]：${inline(exchange.output || "未定义输出")} -> ${inline(exchange.input || "未定义目标输入")}（${ov3CompatibilityLabel(exchange.compatibility)}）`),
    "",
    "### 推导诊断",
    ...(ov3.diagnostics || []).map((item) => `- [${inline(item.statusLabel)}] ${inline(item.label)}：${inline(item.detail)}`)
  ];
}

function renderXmlOv3(ov3) {
  if (!ov3?.exchanges?.length) return ["  <ov3 status=\"not-derived\"/>"];
  return [
    `  <ov3 kind="${xml(ov3.kind)}" version="${xml(ov3.version)}" generatedAt="${xml(ov3.generatedAt)}" exchangeCount="${xml(ov3.exchanges.length)}">`,
    `    <source ov5ActivityCount="${xml(ov3.source?.ov5ActivityCount)}" ov5EdgeCount="${xml(ov3.source?.ov5EdgeCount)}" scenarioEntityCount="${xml(ov3.source?.scenarioEntityCount)}"/>`,
    "    <exchanges>",
    ...ov3.exchanges.map((exchange) => `      <exchange id="${xml(exchange.id)}" sourceActivityId="${xml(exchange.sourceActivityId)}" targetActivityId="${xml(exchange.targetActivityId)}" exchangeType="${xml(exchange.exchangeType)}" edgeType="${xml(exchange.edgeType)}" compatibility="${xml(exchange.compatibility)}" scenarioEntityCount="${xml(exchange.scenarioEntityCount)}"><sourceActivity>${xml(exchange.sourceActivityTitle)}</sourceActivity><output>${xml(exchange.output)}</output><targetActivity>${xml(exchange.targetActivityTitle)}</targetActivity><input>${xml(exchange.input)}</input></exchange>`),
    "    </exchanges>",
    "    <diagnostics>",
    ...(ov3.diagnostics || []).map((item) => `      <check id="${xml(item.id)}" state="${xml(item.state)}" statusLabel="${xml(item.statusLabel)}"><label>${xml(item.label)}</label><detail>${xml(item.detail)}</detail></check>`),
    "    </diagnostics>",
    "  </ov3>"
  ];
}

function renderOv4Section(ov4) {
  if (!ov4?.roles?.length) return ["- 尚未从 OV-1/OV-5 推导抽象责任关系。"];
  return [`- 来源：OV-1 ${ov4.source?.ov1NodeCount || 0} 个节点，OV-5 ${ov4.source?.ov5ActivityCount || 0} 个活动 / ${ov4.source?.ov5EdgeCount || 0} 条关系。`, `- 推导结果：${ov4.roles.length} 个抽象责任角色，${ov4.relations?.length || 0} 条跨角色关系。`, "", "### 责任角色", ...ov4.roles.map((role) => `- ${inline(role.label)}：${inline(role.organizationCategory || "其他")} / ${inline(role.echelonCategory || "未明确")}；活动 ${role.activityCount}，OODA ${role.oodaCount}，想定 ${role.entityCount}（${inline(role.state)}）`), "", "### 关系", ...(ov4.relations?.length ? ov4.relations.map((relation) => `- ${inline(relation.sourceRoleLabel)} -> ${inline(relation.targetRoleLabel)}：${inline(relation.relationshipCategory || "其他")}（原始类型：${inline(relation.relationshipType)}；${inline(relation.sourceActivityTitle)} -> ${inline(relation.targetActivityTitle)}）`) : ["- 尚未定义跨角色关系。"]), "", "### 推导诊断", ...(ov4.diagnostics || []).map((item) => `- [${inline(item.statusLabel)}] ${inline(item.label)}：${inline(item.detail)}`)];
}

function renderXmlOv4(ov4) {
  if (!ov4?.roles?.length) return ["  <ov4 status=\"not-derived\"/>"];
  return [`  <ov4 kind="${xml(ov4.kind)}" version="${xml(ov4.version)}" generatedAt="${xml(ov4.generatedAt)}" roleCount="${xml(ov4.roles.length)}" relationCount="${xml(ov4.relations?.length || 0)}">`, `    <source ov1NodeCount="${xml(ov4.source?.ov1NodeCount)}" ov5ActivityCount="${xml(ov4.source?.ov5ActivityCount)}" ov5EdgeCount="${xml(ov4.source?.ov5EdgeCount)}" oodaNodeCount="${xml(ov4.source?.oodaNodeCount)}" scenarioEntityCount="${xml(ov4.source?.scenarioEntityCount)}"/>`, "    <roles>", ...ov4.roles.map((role) => `      <role id="${xml(role.id)}" organizationCategory="${xml(role.organizationCategory)}" echelonCategory="${xml(role.echelonCategory)}" activityCount="${xml(role.activityCount)}" oodaCount="${xml(role.oodaCount)}" entityCount="${xml(role.entityCount)}" state="${xml(role.state)}"><label>${xml(role.label)}</label><phases>${(role.phases || []).map((item) => `<phase>${xml(item)}</phase>`).join("")}</phases></role>`), "    </roles>", "    <relations>", ...(ov4.relations || []).map((relation) => `      <relation id="${xml(relation.id)}" sourceRoleId="${xml(relation.sourceRoleId)}" targetRoleId="${xml(relation.targetRoleId)}" relationshipCategory="${xml(relation.relationshipCategory)}" relationshipType="${xml(relation.relationshipType)}" sourceActivityId="${xml(relation.sourceActivityId)}" targetActivityId="${xml(relation.targetActivityId)}"/>`), "    </relations>", "    <diagnostics>", ...(ov4.diagnostics || []).map((item) => `      <check id="${xml(item.id)}" state="${xml(item.state)}"><label>${xml(item.label)}</label><detail>${xml(item.detail)}</detail></check>`), "    </diagnostics>", "  </ov4>"];
}

function renderOv6cSection(ov6c) {
  if (!ov6c?.events?.length) return ["- 尚未从 OODA 与想定时间线推导事件序列。"];
  return [
    `- 来源：OODA ${ov6c.source?.oodaNodeCount || 0} 个节点，想定时间线 ${ov6c.source?.timelineEventCount || 0} 个事件，关联实体 ${ov6c.source?.scenarioEntityCount || 0} 个。`,
    `- 推导结果：${ov6c.events.length} 个事件；未排程节点 ${ov6c.unresolved?.unscheduledNodeIds?.length || 0} 个，来源异常 ${ov6c.unresolved?.orphanTimelineIds?.length || 0} 个。`,
    "",
    "### 事件清单",
    ...ov6c.events.map((event) => `- ${inline(event.time)}：${inline(event.title)}（${inline(event.phase || "未映射")} / ${inline(event.sourceActivityId || "未映射活动")} / ${inline(event.state)}）`),
    "",
    "### 推导诊断",
    ...(ov6c.diagnostics || []).map((item) => `- [${inline(item.statusLabel)}] ${inline(item.label)}：${inline(item.detail)}`)
  ];
}

function renderActivityDecompositions(model, activities = []) {
  if (!model?.decompositions?.length) return ["- 尚无活动父子分解关系。"];
  const activityById = new Map((activities || []).map((activity) => [activity.id, activity]));
  return [
    "| 上级活动 | 下级活动 | 状态 |",
    "| --- | --- | --- |",
    ...model.decompositions.map((item) => `| ${cell(activityById.get(item.parentActivityRef)?.title || item.parentActivityRef)} | ${cell(activityById.get(item.childActivityRef)?.title || item.childActivityRef)} | ${cell(item.status || "pending_review")} |`)
  ];
}

function renderDerivedRules(model) {
  if (!model?.rules?.length) return ["- 尚无可派生规则。"];
  return model.rules.map((rule) => `- ${inline(rule.subject)} [${inline(rule.type)}]：${inline(rule.text)}`);
}

function renderDerivedTransitions(model) {
  if (!model?.transitions?.length) return ["- 尚无可派生状态转换。"];
  return model.transitions.map((item) => `- ${inline(item.sourceLabel)} -> ${inline(item.targetLabel)}：${inline(item.condition)}`);
}

function renderXmlOv6c(ov6c) {
  if (!ov6c?.events?.length) return ["  <ov6c status=\"not-derived\"/>"];
  return [
    `  <ov6c kind="${xml(ov6c.kind)}" version="${xml(ov6c.version)}" generatedAt="${xml(ov6c.generatedAt)}" eventCount="${xml(ov6c.events.length)}">`,
    `    <source oodaNodeCount="${xml(ov6c.source?.oodaNodeCount)}" timelineEventCount="${xml(ov6c.source?.timelineEventCount)}" scenarioEntityCount="${xml(ov6c.source?.scenarioEntityCount)}" deploymentReturnAccepted="${ov6c.source?.deploymentReturnAccepted ? "true" : "false"}"/>`,
    "    <events>",
    ...ov6c.events.map((event) => `      <event id="${xml(event.id)}" sequence="${xml(event.sequence)}" time="${xml(event.time)}" offsetMinutes="${xml(event.offsetMinutes ?? "")}" sourceNodeId="${xml(event.sourceNodeId)}" sourceActivityId="${xml(event.sourceActivityId)}" phase="${xml(event.phase)}" entityCount="${xml(event.entityCount)}" state="${xml(event.state)}"><title>${xml(event.title)}</title><description>${xml(event.description)}</description></event>`),
    "    </events>",
    "    <diagnostics>",
    ...(ov6c.diagnostics || []).map((item) => `      <check id="${xml(item.id)}" state="${xml(item.state)}" statusLabel="${xml(item.statusLabel)}"><label>${xml(item.label)}</label><detail>${xml(item.detail)}</detail></check>`),
    "    </diagnostics>",
    "  </ov6c>"
  ];
}

function renderMappingSection(model, kind) {
  const mappings = Array.isArray(model?.mappings) ? model.mappings : [];
  if (!mappings.length) return [kind === "task" ? "- 尚无任务与活动映射。" : "- 尚无状态/转换与活动映射。"];
  const sourceLabel = kind === "task" ? "任务" : "状态/转换";
  return [
    `- 产品状态：${inline(model.status || "pending_review")}；映射 ${mappings.length} 条。`,
    `| ${sourceLabel} | 活动引用 | 语义/覆盖 | 人工判定 | 状态 |`,
    "| --- | --- | --- | --- | --- |",
    ...mappings.map((item) => `| ${cell(kind === "task" ? item.taskRef : `${item.subjectType}:${item.sourceRef}`)} | ${cell((item.activityRefs || []).join("、") || "未映射")} | ${cell(kind === "task" ? item.coverageStatus : item.semantic)} | ${cell(item.judgment)} | ${cell(item.status)} |`),
    "",
    "### 覆盖诊断",
    ...(model.diagnostics || []).map((item) => `- [${inline(item.statusLabel)}] ${inline(item.label)}：${inline(item.detail)}`)
  ];
}

function renderXmlMappings(tag, model) {
  const mappings = Array.isArray(model?.mappings) ? model.mappings : [];
  if (!mappings.length) return [`  <${tag} status="not-mapped"/>`];
  return [
    `  <${tag} status="${xml(model.status)}" mappingCount="${xml(mappings.length)}">`,
    "    <mappings>",
    ...mappings.map((item) => `      <mapping id="${xml(item.id)}" taskRef="${xml(item.taskRef)}" subjectType="${xml(item.subjectType)}" sourceRef="${xml(item.sourceRef)}" semantic="${xml(item.semantic)}" coverageStatus="${xml(item.coverageStatus)}" judgment="${xml(item.judgment)}" status="${xml(item.status)}"><activityRefs>${(item.activityRefs || []).map((ref) => `<activityRef>${xml(ref)}</activityRef>`).join("")}</activityRefs><note>${xml(item.note)}</note></mapping>`),
    "    </mappings>",
    "    <diagnostics>",
    ...(model.diagnostics || []).map((item) => `      <check id="${xml(item.id)}" state="${xml(item.state)}"><label>${xml(item.label)}</label><detail>${xml(item.detail)}</detail></check>`),
    "    </diagnostics>",
    `  </${tag}>`
  ];
}

function ov3CompatibilityLabel(value) {
  return ({ ready: "直接匹配", review: "需映射", pending: "定义缺失" })[value] || "需复核";
}

function renderTraceabilitySection(traceability) {
  const summary = traceability?.summary || {};
  const rows = traceability?.activities || [];
  if (!rows.length) return ["- 尚未建立跨视图追溯关系。"];
  const orphaned = summary.orphanedOv1SourceIds || [];
  return [
    `- OV-1 覆盖：${summary.mappedActivityCount || 0}/${summary.activityCount || 0} 项 OV-5 活动；关联 OODA ${summary.oodaNodeCount || 0} 个节点、想定 ${summary.entityCount || 0} 个实体、事件 ${summary.timelineEventCount || 0} 条。`,
    ...rows.map((row) => {
      const sources = row.sourceOv1Nodes?.length ? row.sourceOv1Nodes.map((node) => node.label).join("、") : "待标注";
      return `- ${inline(row.title)}：OV-1 ${inline(sources)}；OODA ${row.linkedOodaNodes?.length || 0} 项，想定实体 ${row.linkedEntities?.length || 0} 个，事件 ${row.linkedTimeline?.length || 0} 条。`;
    }),
    ...(orphaned.length ? [`- 待修订的 OV-1 引用：${orphaned.map(inline).join("、")}`] : [])
  ];
}

function renderXmlTraceability(traceability) {
  const summary = traceability?.summary || {};
  const rows = traceability?.activities || [];
  return [
    `  <traceability mappedActivityCount="${xml(summary.mappedActivityCount || 0)}" activityCount="${xml(summary.activityCount || 0)}" oodaNodeCount="${xml(summary.oodaNodeCount || 0)}" entityCount="${xml(summary.entityCount || 0)}" timelineEventCount="${xml(summary.timelineEventCount || 0)}">`,
    ...rows.flatMap((row) => [
      `    <activity id="${xml(row.id)}" title="${xml(row.title)}">`,
      ...(row.sourceOv1Nodes || []).map((node) => `      <ov1Node id="${xml(node.id)}" label="${xml(node.label)}"/>`),
      ...(row.linkedOodaNodes || []).map((node) => `      <oodaNode id="${xml(node.id)}" label="${xml(node.label)}" lane="${xml(node.lane)}"/>`),
      ...(row.linkedEntities || []).map((entity) => `      <scenarioEntity id="${xml(entity.id)}" label="${xml(entity.label)}" role="${xml(entity.role)}"/>`),
      ...(row.linkedTimeline || []).map((event) => `      <timelineEvent id="${xml(event.id)}" label="${xml(event.label)}" time="${xml(event.time)}"/>`),
      "    </activity>"
    ]),
    ...(summary.orphanedOv1SourceIds || []).map((id) => `    <orphanedOv1Reference id="${xml(id)}"/>`),
    "  </traceability>"
  ];
}

function buildOv1Snapshot(ov1) {
  const nodes = Array.isArray(ov1?.nodes) && ov1.nodes.length
    ? ov1.nodes.map((node) => ({ id: node.id, label: node.label, description: node.description || node.detail || "", category: node.category || "", responsibility: node.responsibility || "", input: node.input || "", output: node.output || "", constraints: node.constraints || "", expectedEffects: node.expectedEffects || "", evidenceRefs: node.evidenceRefs || [], x: node.x || "", y: node.y || "" }))
    : ov1Nodes.map((node) => ({ id: node.id, label: node.label, description: node.detail, category: "", responsibility: "", input: "", output: "", constraints: "", expectedEffects: "", evidenceRefs: [], x: node.x || "", y: node.y || "" }));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(ov1?.edges)
    ? ov1.edges.filter((edge) => nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId)).map((edge) => ({ id: edge.id, sourceId: edge.sourceId, targetId: edge.targetId, type: edge.type }))
    : [];
  return { title: "OV-1 总体概念", provenance: ov1?.provenance || null, concept: ov1?.concept || {}, nodes, edges };
}

function renderInspirationSection(inspiration) {
  if (!inspiration?.summary) return ["- 尚未记录灵感孵化会话。"];
  return [
    `- 追问进度：${inspiration.completed ? "已完成" : `进行中（${inspiration.stage}/${inspiration.totalStages}）`}`,
    `- 会话摘要：${inline(inspiration.summary)}`,
    "",
    "### 会话轨迹",
    ...(inspiration.messages || []).map((message) => `- [${message.role === "user" ? "研究人员" : "孵化助手"}] ${inline(message.text)}`)
  ];
}

function renderXmlInspiration(inspiration) {
  if (!inspiration?.summary) return ["  <inspiration status=\"not-started\"/>"];
  return [
    `  <inspiration stage="${xml(inspiration.stage)}" totalStages="${xml(inspiration.totalStages)}" completed="${inspiration.completed ? "true" : "false"}">`,
    xmlElement("summary", inspiration.summary, 2),
    "    <messages>",
    ...(inspiration.messages || []).map((message) => `      <message role="${xml(message.role)}" createdAt="${xml(message.createdAt)}">${xml(message.text)}</message>`),
    "    </messages>",
    "  </inspiration>"
  ];
}

function renderXmlScenario(scenario) {
  if (!scenario) return ["  <scenario status=\"not-generated\"/>"];
  return [
    `  <scenario id="${xml(scenario.id)}" generatedAt="${xml(scenario.generatedAt)}" updatedAt="${xml(scenario.updatedAt)}">`,
    `    <spatialData format="geojson" coordinateReference="${xml(scenario.deploymentData?.geojson?.properties?.coordinateReference || "")}" featureCount="${xml(scenario.deploymentData?.geojson?.features?.length || 0)}" deploymentPlanMode="${xml(scenario.deploymentPlan?.mode || "")}" deploymentPlanState="${xml(scenario.deploymentPlan?.state || "")}"/>`,
    `    <deploymentData format="json">${xml(JSON.stringify(scenario.deploymentData || null))}</deploymentData>`,
    ...renderXmlSimulationSummary(scenario.simulation),
    "  </scenario>"
  ];
}

function renderXmlValidation(validation) {
  if (!validation) return ["  <validation status=\"not-run\"/>"];
  const review = validation.redTeamReview;
  return [
    `  <validation generatedAt="${xml(validation.generatedAt)}">`,
    "    <scores>",
    ...(validation.scores || []).map((score) => `      <score label="${xml(score.label)}" value="${xml(score.score)}"/>`),
    "    </scores>",
    "    <issues>",
    ...(validation.issues || []).map((issue) => `      <issue id="${xml(issue.id)}" level="${xml(issue.level)}"><title>${xml(issue.title)}</title><text>${xml(issue.text)}</text></issue>`),
    "    </issues>",
    ...renderXmlTraceabilityDiagnostics(validation.traceabilityDiagnostics),
    ...renderXmlOodaDiagnostics(validation.oodaDiagnostics),
    ...renderXmlFlowDiagnostics(validation.flowDiagnostics),
    xmlElement("redTeamDraft", validation.redTeam, 2),
    ...renderXmlRedTeamReview(review),
    "  </validation>"
  ];
}

function renderTraceabilityDiagnosticsSection(diagnostics) {
  if (!diagnostics?.checks?.length) return [];
  return [
    "",
    "### 追溯关系诊断",
    ...diagnostics.checks.map((check) => `- [${inline(check.statusLabel)}] ${inline(check.label)}：${inline(check.detail)}`)
  ];
}

function renderXmlTraceabilityDiagnostics(diagnostics) {
  if (!diagnostics?.checks?.length) return ["    <traceabilityDiagnostics status=\"not-run\"/>"];
  return [
    `    <traceabilityDiagnostics mappedActivityCount="${xml(diagnostics.mappedActivityCount)}" activityCount="${xml(diagnostics.activityCount)}" orphanedReferenceCount="${xml(diagnostics.orphanedReferenceCount)}" score="${xml(diagnostics.score)}">`,
    ...diagnostics.checks.map((check) => `      <check id="${xml(check.id)}" state="${xml(check.state)}" statusLabel="${xml(check.statusLabel)}"><label>${xml(check.label)}</label><detail>${xml(check.detail)}</detail></check>`),
    "    </traceabilityDiagnostics>"
  ];
}

function renderOodaDiagnosticsSection(diagnostics) {
  if (!diagnostics?.checks?.length) return [];
  return [
    "",
    "### OODA 静态诊断",
    ...diagnostics.checks.map((check) => `- [${inline(check.statusLabel)}] ${inline(check.label)}：${inline(check.detail)}`)
  ];
}

function renderXmlOodaDiagnostics(diagnostics) {
  if (!diagnostics?.checks?.length) return ["    <oodaDiagnostics status=\"not-run\"/>"];
  return [
    `    <oodaDiagnostics windowMinutes="${xml(diagnostics.windowMinutes)}" nodeCount="${xml(diagnostics.nodeCount)}" completenessScore="${xml(diagnostics.completenessScore)}" resilienceScore="${xml(diagnostics.resilienceScore)}">`,
    ...diagnostics.checks.map((check) => `      <check id="${xml(check.id)}" state="${xml(check.state)}" statusLabel="${xml(check.statusLabel)}"><label>${xml(check.label)}</label><detail>${xml(check.detail)}</detail></check>`),
    "    </oodaDiagnostics>"
  ];
}

function renderFlowDiagnosticsSection(diagnostics) {
  if (!diagnostics?.checks?.length) return [];
  return [
    "",
    "### OV-5 交换与资源诊断",
    ...diagnostics.checks.map((check) => `- [${inline(check.statusLabel)}] ${inline(check.label)}：${inline(check.detail)}`)
  ];
}

function renderXmlFlowDiagnostics(diagnostics) {
  if (!diagnostics?.checks?.length) return ["    <flowDiagnostics status=\"not-run\"/>"];
  return [
    `    <flowDiagnostics exchangeCount="${xml(diagnostics.exchangeCount)}" unresolvedCount="${xml(diagnostics.unresolvedCount)}" missingContractCount="${xml(diagnostics.missingContractCount)}" mismatchCount="${xml(diagnostics.mismatchCount)}" score="${xml(diagnostics.score)}">`,
    ...diagnostics.checks.map((check) => `      <check id="${xml(check.id)}" state="${xml(check.state)}" statusLabel="${xml(check.statusLabel)}"><label>${xml(check.label)}</label><detail>${xml(check.detail)}</detail></check>`),
    "    </flowDiagnostics>"
  ];
}

function renderXmlRedTeamReview(review) {
  if (!review) return ["    <redTeamReview status=\"not-generated\"/>"];
  return [
    `    <redTeamReview mode="${xml(review.mode)}" provider="${xml(review.provider)}" model="${xml(review.model)}" generatedAt="${xml(review.generatedAt)}"${evidenceSelectionAttributes(review.evidenceSelection)}>`,
    xmlElement("summary", review.summary, 3),
    ...(review.findings || []).map((finding) => `      <finding severity="${xml(finding.severity)}"><title>${xml(finding.title)}</title><analysis>${xml(finding.analysis)}</analysis><recommendation>${xml(finding.recommendation)}</recommendation><evidenceRefs>${(finding.evidenceRefs || []).map((ref) => `<reference>${xml(ref)}</reference>`).join("")}</evidenceRefs></finding>`),
    "    </redTeamReview>"
  ];
}

function renderXmlKnowledge(knowledge) {
  if (!knowledge) return ["  <knowledge status=\"not-connected\"/>"];
  const evidence = knowledge.evidence || {};
  return [
    `  <knowledge name="${xml(knowledge.name)}" fileCount="${xml(knowledge.fileCount)}" chunkCount="${xml(knowledge.chunkCount)}" sensitiveExcludedCount="${xml(knowledge.sensitiveExcludedCount || 0)}" sensitiveCitationApprovalCount="${xml(knowledge.sensitiveCitationApprovalCount || 0)}" sensitiveCitationPolicy="${xml(knowledge.sensitiveCitationPolicy || "default-exclude")}" importedAt="${xml(knowledge.importedAt)}">`,
    "    <sensitiveCitationApprovals>",
    ...(knowledge.approvedCitations || []).map((approval) => `      <approval id="${xml(approval.id)}" documentId="${xml(approval.documentId)}" approvedAt="${xml(approval.approvedAt)}" expiresAt="${xml(approval.expiresAt)}" approvedBy="${xml(approval.approvedBy?.label || approval.approvedBy?.id)}"/>`),
    "    </sensitiveCitationApprovals>",
    `    <knowledgeGraph nodeCount="${xml(knowledge.graph?.nodeCount || 0)}" edgeCount="${xml(knowledge.graph?.edgeCount || 0)}" linkEdgeCount="${xml(knowledge.graph?.linkEdgeCount || 0)}" tagEdgeCount="${xml(knowledge.graph?.tagEdgeCount || 0)}" isolatedCount="${xml(knowledge.graph?.isolatedCount || 0)}"/>`,
    "    <referencedTerms>",
    ...(knowledge.referencedTerms || []).map((term) => xmlElement("term", term, 3)),
    "    </referencedTerms>",
    "    <evidence>",
    ...(evidence.entries || []).map((entry) => `      <entry id="${xml(entry.id)}"><title>${xml(entry.title)}</title><tags>${(entry.tags || []).map((tag) => `<tag>${xml(tag)}</tag>`).join("")}</tags><summary>${xml(entry.summary)}</summary><matchedTerms>${(entry.matchedTerms || []).map((term) => `<term>${xml(term)}</term>`).join("")}</matchedTerms></entry>`),
    "    </evidence>",
    "    <unresolvedTerms>",
    ...(evidence.unresolvedTerms || []).map((term) => xmlElement("term", term, 3)),
    "    </unresolvedTerms>",
    "  </knowledge>"
  ];
}

function buildCollaborationSummary(collaboration, knowledge) {
  if (!collaboration || (collaboration.status && collaboration.status !== "ready")) return null;
  const policy = collaboration.policy || {};
  const permittedEvidenceRefs = new Set((knowledge?.docs || []).filter((document) => document?.id && !document.sensitivity?.marked).map((document) => String(document.id)));
  const reviews = (collaboration.reviews || []).slice(0, 20).map((review) => ({
    id: cleanReviewId(review.id),
    resource: cleanReviewValue(review.resource, 40),
    resourceRevision: Number(review.resourceRevision || 0),
    disposition: cleanReviewValue(review.disposition, 40),
    state: cleanReviewValue(review.state, 40) || "open",
    freshness: cleanReviewValue(review.freshness, 40) || "unknown",
    currentResourceRevision: Number(review.currentResourceRevision || 0),
    summary: formatReviewSummary(review.summary, review.reviewContext, review.evidenceRefs, permittedEvidenceRefs),
    evidenceRefs: safeReviewEvidenceRefs(review.evidenceRefs, permittedEvidenceRefs),
    actor: cleanReviewValue(review.actor?.label || review.actor?.id, 160),
    createdAt: cleanReviewValue(review.createdAt, 80),
    reviewContext: summarizeReviewContext(review.reviewContext),
    decision: review.decision ? {
      outcome: cleanReviewValue(review.decision.outcome, 40),
      summary: cleanReviewValue(review.decision.summary, 1200),
      actor: cleanReviewValue(review.decision.actor?.label || review.decision.actor?.id, 160),
      decidedAt: cleanReviewValue(review.decision.decidedAt, 80)
    } : null
  })).filter((review) => review.id);
  return {
    mode: cleanReviewValue(policy.mode, 80),
    authentication: cleanReviewValue(policy.authentication, 80),
    authorization: cleanReviewValue(policy.authorization, 120),
    revision: Number(collaboration.revision || 0),
    resourceRevision: Number(collaboration.resourceRevision || 0),
    openCount: Number(collaboration.openCount || 0),
    reviewCount: Number(collaboration.reviews?.length || 0),
    reviews
  };
}

function renderCollaborationSection(collaboration) {
  if (!collaboration) return ["- 尚未读取服务端协同审阅记录。"];
  return [
    `- 协同策略：${inline(collaboration.mode)} / 认证：${inline(collaboration.authentication)} / 授权：${inline(collaboration.authorization)}`,
    `- 协同修订：项目 r${collaboration.revision}，审阅资源 r${collaboration.resourceRevision}；${collaboration.reviewCount} 条审阅，${collaboration.openCount} 条待决议。`,
    ...(collaboration.reviews.length ? collaboration.reviews.map((review) => `- [${inline(review.state)} / ${inline(review.freshness)}] ${inline(review.resource)} r${review.resourceRevision}（当前 r${review.currentResourceRevision}）/ ${inline(review.disposition)} / ${inline(review.actor)}：${inline(review.summary)}${review.decision ? `；决议 ${inline(review.decision.outcome)} / ${inline(review.decision.actor)}：${inline(review.decision.summary)}` : ""}`) : ["- 尚未提交审阅事件。"])
  ];
}

function summarizeReviewContext(value) {
  if (!value || typeof value !== "object") return null;
  const lineage = value.lineage && typeof value.lineage === "object" ? Object.entries(value.lineage).reduce((result, [key, revision]) => ({ ...result, [cleanReviewValue(key, 80)]: Number(revision || 0) }), {}) : {};
  return { modelKind: cleanReviewValue(value.modelKind, 40), resourceRevision: Number(value.resourceRevision || 0), primaryCount: Number(value.primaryCount || 0), secondaryCount: Number(value.secondaryCount || 0), lineage };
}

function formatReviewSummary(summary, context, evidenceRefs = [], permittedEvidenceRefs = new Set()) {
  const text = cleanReviewValue(summary, 1000);
  const normalized = summarizeReviewContext(context);
  const contextLabel = normalized ? ` [context ${normalized.modelKind} ${normalized.primaryCount}/${normalized.secondaryCount}]` : "";
  const evidenceLabel = safeReviewEvidenceRefs(evidenceRefs, permittedEvidenceRefs).length ? ` [evidence ${safeReviewEvidenceRefs(evidenceRefs, permittedEvidenceRefs).join(",")}]` : "";
  return cleanReviewValue(`${text}${contextLabel}${evidenceLabel}`, 1200);
}

function safeReviewEvidenceRefs(value, permitted) {
  return (Array.isArray(value) ? value : []).map((item) => cleanReviewValue(item, 180)).filter((item) => permitted.has(item)).slice(0, 12);
}

function renderReviewContextLine(context) {
  if (!context) return "";
  const lineage = Object.entries(context.lineage || {}).filter(([, revision]) => Number(revision) > 0).map(([key, revision]) => `${inline(key)} r${Number(revision)}`).join(" / ");
  return `；上下文 ${inline(context.modelKind)} ${context.primaryCount}/${context.secondaryCount}${lineage ? ` / ${lineage}` : ""}`;
}

function renderXmlReviewContext(context) {
  if (!context) return "";
  const lineage = Object.entries(context.lineage || {}).filter(([key]) => key).map(([key, revision]) => ` ${xml(key)}="${xml(revision)}"`).join("");
  return `<reviewContext modelKind="${xml(context.modelKind)}" resourceRevision="${xml(context.resourceRevision)}" primaryCount="${xml(context.primaryCount)}" secondaryCount="${xml(context.secondaryCount)}"${lineage}/>`;
}

function renderXmlCollaboration(collaboration) {
  if (!collaboration) return ["  <collaboration status=\"not-loaded\"/>"];
  return [
    `  <collaboration mode="${xml(collaboration.mode)}" authentication="${xml(collaboration.authentication)}" authorization="${xml(collaboration.authorization)}" projectRevision="${xml(collaboration.revision)}" resourceRevision="${xml(collaboration.resourceRevision)}" reviewCount="${xml(collaboration.reviewCount)}" openCount="${xml(collaboration.openCount)}">`,
    ...(collaboration.reviews || []).map((review) => `    <review id="${xml(review.id)}" resource="${xml(review.resource)}" resourceRevision="${xml(review.resourceRevision)}" currentResourceRevision="${xml(review.currentResourceRevision)}" freshness="${xml(review.freshness)}" disposition="${xml(review.disposition)}" state="${xml(review.state)}" actor="${xml(review.actor)}" createdAt="${xml(review.createdAt)}"><summary>${xml(review.summary)}</summary>${review.evidenceRefs?.length ? `<evidenceRefs>${review.evidenceRefs.map((item) => `<ref id="${xml(item)}"/>`).join("")}</evidenceRefs>` : ""}${renderXmlReviewContext(review.reviewContext)}${review.decision ? `<decision outcome="${xml(review.decision.outcome)}" actor="${xml(review.decision.actor)}" decidedAt="${xml(review.decision.decidedAt)}"><summary>${xml(review.decision.summary)}</summary></decision>` : ""}</review>`),
    "  </collaboration>"
  ];
}

function buildProjectAuditSummary(entries) {
  const items = (Array.isArray(entries) ? entries : []).slice(0, 20).map((entry) => ({
    id: cleanReviewValue(entry?.id, 180),
    revision: Number(entry?.revision || 0),
    action: cleanReviewValue(entry?.action, 100),
    actor: cleanReviewValue(entry?.actor?.label || entry?.actor?.id || entry?.source, 160),
    occurredAt: cleanReviewValue(entry?.occurredAt, 80),
    summary: cleanReviewValue(entry?.summary, 1200)
  })).filter((entry) => entry.id && entry.action);
  return { count: items.length, entries: items };
}

function renderProjectAuditSection(audit) {
  if (!audit?.entries?.length) return ["- 尚未读取项目审计事件。"];
  return [
    `- 已纳入最近 ${audit.count} 条有界公共审计事件。`,
    ...audit.entries.map((entry) => `- [项目 r${entry.revision}] ${inline(entry.action)} / ${inline(entry.actor)} / ${inline(entry.occurredAt)}：${inline(entry.summary)}`)
  ];
}

function renderXmlProjectAudit(audit) {
  if (!audit?.entries?.length) return ["  <projectAudit status=\"not-loaded\"/>"];
  return [
    `  <projectAudit count="${xml(audit.count)}">`,
    ...audit.entries.map((entry) => `    <event id="${xml(entry.id)}" revision="${xml(entry.revision)}" action="${xml(entry.action)}" actor="${xml(entry.actor)}" occurredAt="${xml(entry.occurredAt)}"><summary>${xml(entry.summary)}</summary></event>`),
    "  </projectAudit>"
  ];
}

function cleanReviewId(value) {
  const id = String(value || "").trim();
  return /^review-[A-Za-z0-9_-]{1,170}$/.test(id) ? id : "";
}

function cleanReviewValue(value, maximum) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function renderXmlModelGovernance(governance) {
  const latest = governance.latestSnapshot;
  const comparison = governance.comparison;
  return [
    `  <modelGovernance snapshotCount="${xml(governance.snapshotCount || 0)}">`,
    latest ? `    <latestSnapshot id="${xml(latest.id)}" label="${xml(latest.label)}" direction="${xml(latest.direction)}" savedAt="${xml(latest.savedAt)}"/>` : "    <latestSnapshot status=\"not-saved\"/>",
    comparison ? [
      `    <comparison baselineId="${xml(comparison.baseline?.id)}" candidateId="${xml(comparison.candidate?.id)}">`,
      xmlElement("summary", comparison.summary, 3),
      "      <metrics>",
      ...(comparison.metrics || []).map((metric) => `        <metric label="${xml(metric.label)}" before="${xml(metric.before)}" after="${xml(metric.after)}" delta="${xml(metric.delta)}" unit="${xml(metric.unit)}"/>`),
      "      </metrics>",
      ...renderXmlQuantitativeComparison(comparison.quantitative),
      "    </comparison>"
    ] : ["    <comparison status=\"not-run\"/>"],
    "  </modelGovernance>"
  ].flat();
}

function renderXmlQuantitativeComparison(quantitative) {
  if (!quantitative) return ["      <quantitative status=\"not-run\"/>"];
  const baseline = quantitative.baseline || {};
  const candidate = quantitative.candidate || {};
  return [
    `      <quantitative method="${xml(quantitative.method)}" scale="${xml(quantitative.scale)}" winner="${xml(quantitative.winner)}" delta="${xml(quantitative.delta)}" baselineTotal="${xml(baseline.total)}" candidateTotal="${xml(candidate.total)}">`,
    xmlElement("recommendation", quantitative.recommendation, 4),
    ...renderXmlSensitivity(quantitative.sensitivity),
    "        <criteria>",
    ...(baseline.criteria || []).map((criterion) => {
      const compared = (candidate.criteria || []).find((item) => item.id === criterion.id) || {};
      return `          <criterion id="${xml(criterion.id)}" label="${xml(criterion.label)}" weight="${xml(criterion.weight)}" baselineScore="${xml(criterion.score)}" candidateScore="${xml(compared.score)}" baselineAutomaticScore="${xml(criterion.automaticScore)}" candidateAutomaticScore="${xml(compared.automaticScore)}" baselineManualScore="${xml(criterion.manualScore)}" candidateManualScore="${xml(compared.manualScore)}"><evidence>${(criterion.evidence || []).map((item) => `<item>${xml(item)}</item>`).join("")}</evidence>${criterion.manualRationale ? xmlElement("baselineManualRationale", criterion.manualRationale, 6) : ""}${compared.manualRationale ? xmlElement("candidateManualRationale", compared.manualRationale, 6) : ""}</criterion>`;
    }),
    "        </criteria>",
    "        <assumptions>",
    ...(quantitative.assumptions || []).map((item) => xmlElement("assumption", item, 5)),
    "        </assumptions>",
    "      </quantitative>"
  ];
}

function renderXmlSensitivity(sensitivity) {
  if (!sensitivity) return [];
  return [
    `        <weightSensitivity method="${xml(sensitivity.method)}" emphasisPoints="${xml(sensitivity.emphasisPoints)}" stable="${xml(sensitivity.stable)}" flipCount="${xml(sensitivity.flipCount)}">`,
    xmlElement("note", sensitivity.note, 5),
    ...(sensitivity.scenarios || []).map((scenario) => `          <scenario criterionId="${xml(scenario.criterionId)}" label="${xml(scenario.label)}" baselineTotal="${xml(scenario.baselineTotal)}" candidateTotal="${xml(scenario.candidateTotal)}" delta="${xml(scenario.delta)}" winner="${xml(scenario.winner)}"/>`),
    "        </weightSensitivity>"
  ];
}

function renderXmlProjectRepository(repository) {
  if (!repository?.resources?.length) return ["  <projectRepository status=\"local-only\"/>"];
  return [
    `  <projectRepository projectRevision="${xml(repository.projectRevision)}" synchronizedCount="${xml(repository.synchronizedCount)}" staleCount="${xml(repository.staleCount)}">`,
    ...repository.resources.map((resource) => `    <resource id="${xml(resource.id)}" label="${xml(resource.label)}" status="${xml(resource.status)}" mode="${xml(resource.mode)}" projectRevision="${xml(resource.revision)}" resourceRevision="${xml(resource.resourceRevision)}"${renderXmlResourceLineage(resource)} stale="${resource.stale ? "true" : "false"}" auditCount="${xml(resource.auditCount)}" updatedAt="${xml(resource.updatedAt)}">${xml(resource.detail)}</resource>`),
    "  </projectRepository>"
  ];
}

function renderScenarioSection(scenario) {
  if (!scenario) return ["- 尚未生成自动想定。"];
  const data = scenario.deploymentData;
  return [
    `- 想定编号：${inline(scenario.id)}`,
    `- 实体数量：${data.entities.length}`,
    `- 事件数量：${data.timeline.length}`,
    `- 空间建议：${scenario.deploymentPlan ? `${inline(scenario.deploymentPlan.mode)} / ${inline(scenario.deploymentPlan.state)} / 调整 ${scenario.deploymentPlan.adjustedEntityIds?.length || 0} 个实体` : "未生成"}`,
    `- 空间输出：GeoJSON / ${inline(data.geojson?.properties?.coordinateReference || "未生成")} / ${data.geojson?.features?.length || 0} 个要素`,
    ...renderSimulationSummarySection(scenario.simulation),
    "",
    "### 初始实体",
    ...data.entities.map((entity) => `- ${inline(entity.label)}（${inline(entity.role)}，${entity.position.join("%, ")}%，来源活动：${inline(entity.sourceActivityId || "模型默认")}，知识依据：${inline((entity.sourceKnowledgeRefs || []).join("、") || "未关联")}）`),
    "",
    "### 事件序列",
    ...data.timeline.map((event) => `- ${inline(event.time)} ${inline(event.title)}：${inline(event.description)}`)
  ];
}

function buildSimulationReportSummary(scenario) {
  const diagnostics = buildSimulationDiagnostics(scenario);
  const latest = diagnostics.latestRun;
  const rawResult = scenario?.simulation?.runs?.[0]?.result;
  return {
    state: diagnostics.state,
    runCount: diagnostics.runCount,
    latestRun: latest ? {
      id: latest.id,
      adapterName: latest.adapterName,
      adapterVersion: latest.adapterVersion,
      packageId: latest.packageId,
      submittedAt: latest.submittedAt,
      completedAt: latest.completedAt,
      status: latest.status,
      freshness: latest.freshness,
      result: rawResult ? {
        status: rawResult.status,
        summary: rawResult.summary,
        inputMatch: rawResult.inputMatch || "not-supplied",
        metrics: (rawResult.metrics || []).map((metric) => ({ label: metric.label, value: metric.value, unit: metric.unit }))
      } : null
    } : null
  };
}

function renderSimulationSummarySection(simulation) {
  if (!simulation?.latestRun) return ["- 仿真适配：尚未登记人工提交（仅支持抽象研究级 JSON 交接）。"];
  const run = simulation.latestRun;
  const result = run.result;
  return [
    `- 输入当前性：${inline(run.freshness || "unverified")}`,
    `- 仿真适配：${inline(simulation.state)} / 已登记 ${simulation.runCount} 次 / ${inline(run.adapterName)} ${inline(run.adapterVersion)}`,
    `- 最近输入包：${inline(run.packageId)} / ${inline(run.submittedAt)} / 抽象百分比网格`,
    ...(run.freshness ? [`        <inputFreshness>${xml(run.freshness)}</inputFreshness>`] : []),
    ...(result ? [
      `- 人工回传：${inline(result.status)} / ${inline(result.summary)}`,
      `- 回传输入指纹：${inline(result.inputMatch || "not-supplied")}`,
      ...(result.metrics || []).map((metric) => `- 研究指标：${inline(metric.label)} = ${inline(metric.value)} ${inline(metric.unit)}`)
    ] : ["- 人工回传：尚未登记"])
  ];
}

function renderXmlSimulationSummary(simulation) {
  if (!simulation?.latestRun) return [`    <simulation status="${xml(simulation?.state || "not-submitted")}" runCount="${xml(simulation?.runCount || 0)}" scope="abstract-research-only"/>`];
  const run = simulation.latestRun;
  const result = run.result;
  return [
    `    <simulation status="${xml(simulation.state)}" runCount="${xml(simulation.runCount)}" scope="abstract-research-only">`,
    `      <latestRun id="${xml(run.id)}" adapterName="${xml(run.adapterName)}" adapterVersion="${xml(run.adapterVersion)}" packageId="${xml(run.packageId)}" submittedAt="${xml(run.submittedAt)}" completedAt="${xml(run.completedAt)}" status="${xml(run.status)}">`,
    ...(result ? [
      `        <result status="${xml(result.status)}" inputMatch="${xml(result.inputMatch || "not-supplied")}">`,
      xmlElement("summary", result.summary, 5),
      ...(result.metrics || []).map((metric) => `          <metric label="${xml(metric.label)}" value="${xml(metric.value)}" unit="${xml(metric.unit)}"/>`),
      "        </result>"
    ] : ["        <result status=\"not-recorded\"/>"]),
    "      </latestRun>",
    "    </simulation>"
  ];
}

function renderDeploymentBridgeSection(bridge) {
  const accepted = bridge?.lastAccepted
    ? [`- 已接受回传：来源 ${inline(bridge.lastAccepted.bridgeOrigin || "未记录")}；批次 ${inline(bridge.lastAccepted.exchangeId)}；变更 ${inline(bridge.lastAccepted.changeId)}；接收于 ${inline(bridge.lastAccepted.receivedAt || "未记录")}。`]
    : [];
  if (!bridge?.targetUrl) return ["- 尚未配置部署图工具地址。"];
  return [
    `- 当前状态：${inline(bridge.status)}`,
    `- 目标地址：${inline(bridge.targetUrl)}`,
    `- 目标源：${inline(bridge.targetOrigin || "无法解析")}`,
    `- 嵌入视图：${bridge.embedded ? "已打开" : "未打开"}`,
    `- 同步想定：${inline(bridge.scenarioId || "尚未生成")}（${bridge.entityCount} 个实体，${bridge.synchronized ? "已同步" : "待推送"}）`
    , ...accepted
  ];
}

function renderValidationSection(validation) {
  if (!validation) return ["- 尚未运行设计验证。"];
  return [
    "### 规则评分",
    ...validation.scores.map((score) => `- ${inline(score.label)}：${score.score}`),
    "",
    "### 待处理问题",
    ...(validation.issues.length ? validation.issues.map((issue) => `- [${inline(issue.level)}] ${inline(issue.title)}：${inline(issue.text)}`) : ["- 未发现阻断性规则问题。"]),
    "",
    "### 红方审阅",
    ...renderRedTeamReviewSection(validation)
  ];
}

function renderRedTeamReviewSection(validation) {
  const review = validation.redTeamReview;
  if (!review) return [validation.redTeam || "- 尚未生成红方质询。"];
  const provider = review.mode === "ai"
    ? `AI 审阅${review.model ? `（${inline(review.model)}）` : ""}`
    : "本地规则审阅";
  return [
    `- 审阅类型：${provider}`,
    `- 生成时间：${inline(review.generatedAt)}`,
    ...evidenceSelectionLines(review.evidenceSelection),
    `- 审阅摘要：${inline(review.summary)}`,
    ...(review.findings.length ? review.findings.flatMap((finding) => [
      `#### [${inline(finding.severity)}] ${inline(finding.title)}`,
      `- 分析：${inline(finding.analysis)}`,
      `- 建议：${inline(finding.recommendation)}`,
      `- 证据：${finding.evidenceRefs.length ? finding.evidenceRefs.map(inline).join("、") : "未引用"}`
    ]) : ["- 未返回具体质询项。"])
  ];
}

function renderKnowledgeSection(knowledge) {
  if (!knowledge) return ["- 尚未连接 Obs 知识库。"];
  return [
    `- 知识库：${inline(knowledge.name)}`,
    `- 已导入：${knowledge.fileCount} 篇笔记，${knowledge.chunkCount} 个片段`,
    `- 敏感控制：报告引用排除 ${knowledge.sensitiveExcludedCount || 0} 个敏感片段；按片段显式授权 ${knowledge.sensitiveCitationApprovalCount || 0} 个`,
    ...(knowledge.approvedCitations?.length ? [`- 已授权敏感引用：${knowledge.approvedCitations.map((approval) => `${inline(approval.documentId)}（${inline(approval.approvedBy?.label || approval.approvedBy?.id)}，${inline(approval.approvedAt)}${approval.expiresAt ? `，至 ${inline(approval.expiresAt)}` : ""}）`).join("；")}`] : []),
    `- 知识关系图：${knowledge.graph?.nodeCount || 0} 个节点，${knowledge.graph?.edgeCount || 0} 条关系（双链 ${knowledge.graph?.linkEdgeCount || 0}，共享标签 ${knowledge.graph?.tagEdgeCount || 0}）`,
    `- 模型引用：${knowledge.referencedTerms.length ? knowledge.referencedTerms.map(inline).join("、") : "未标注"}`,
    `- 已匹配证据：${knowledge.evidence.entries.length ? knowledge.evidence.entries.map((item) => `${inline(item.title)}（${item.matchedTerms.map(inline).join("、")}）`).join("；") : "未匹配到 Vault 片段"}`,
    ...(knowledge.evidence.unresolvedTerms.length ? [`- 待补充证据：${knowledge.evidence.unresolvedTerms.map(inline).join("、")}`] : [])
  ];
}

function buildDeploymentBridgeSummary(deployment, scenario) {
  const targetUrl = String(deployment?.settings?.targetUrl || "").trim();
  const status = String(deployment?.status || (targetUrl ? "待推送" : "未配置"));
  return {
    targetUrl,
    targetOrigin: targetUrl ? resolveTargetOrigin(targetUrl) : "",
    status,
    embedded: Boolean(deployment?.open),
    scenarioId: scenario?.id || "",
    entityCount: scenario?.entities?.length || 0,
    lastAccepted: scenario?.deploymentReview ? {
      bridgeOrigin: String(scenario.deploymentReview.bridgeOrigin || ""),
      exchangeId: String(scenario.deploymentReview.exchangeId || ""),
      changeId: String(scenario.deploymentReview.changeId || ""),
      receivedAt: String(scenario.deploymentReview.receivedAt || "")
    } : null,
    synchronized: ["已推送", "已回传调整"].includes(status)
  };
}

function buildModelGovernance(snapshots, comparison) {
  const current = Array.isArray(snapshots) ? snapshots : [];
  const latest = current[0];
  return {
    snapshotCount: current.length,
    latestSnapshot: latest ? snapshotIdentity(latest) : null,
    comparison: comparison ? {
      baseline: snapshotIdentity(comparison.baseline),
      candidate: snapshotIdentity(comparison.candidate),
      summary: comparison.summary,
      metrics: comparison.metrics || [],
      changes: comparison.changes || [],
      quantitative: comparison.quantitative || null
    } : null
  };
}

function buildProjectRepositorySummary(repository) {
  if (!repository || typeof repository !== "object") return null;
  const resources = [
    ["brief", "概念简报", repository.brief],
    ["ov1", "OV-1 总体概念", repository.ov1],
    ["ov1c", "OV-1c 任务活动映射", repository.ov1c],
    ["ov5", "OV-5", repository.ov5],
    ["ov7", "OV-7 状态活动映射", repository.ov7],
    ["ooda", "OODA", repository.ooda],
    ["scenario", "自动想定", repository.scenario],
    ["validation", "设计验证", repository.validation],
    ["knowledge", "Obsidian 知识索引", repository.knowledge],
    ["reportArchives", "成果报告归档", repository.reportArchives],
    ["modelSnapshots", "模型快照", repository.modelSnapshots]
  ].filter(([id, , storage]) => !["ov1c", "ov7"].includes(id) || storage).map(([id, label, storage]) => ({
    id,
    label,
    status: String(storage?.status || "local"),
    mode: String(storage?.mode || "local"),
    detail: String(storage?.detail || storage?.label || "本地草稿"),
    revision: Number(storage?.revision || 0),
    resourceRevision: Number(storage?.resourceRevision || 0),
    auditCount: Number(storage?.auditCount || 0),
    updatedAt: String(storage?.updatedAt || ""),
    stale: Boolean(storage?.stale || storage?.status === "stale"),
    briefRevision: storage?.briefRevision,
    forceMissionPlanRevision: storage?.forceMissionPlanRevision,
    ov1Revision: storage?.ov1Revision,
    ov1bRevision: storage?.ov1bRevision,
    ov5Revision: storage?.ov5Revision,
    ov6bRevision: storage?.ov6bRevision,
    ov6cRevision: storage?.ov6cRevision,
    oodaRevision: storage?.oodaRevision,
    scenarioRevision: storage?.scenarioRevision,
    validationRevision: storage?.validationRevision
  }));
  return {
    projectRevision: Number(repository.projectRevision || 0),
    synchronizedCount: resources.filter((resource) => resource.mode === "server" && resource.status === "ready").length,
    staleCount: resources.filter((resource) => resource.stale).length,
    resources
  };
}

function renderProjectRepositorySection(repository) {
  if (!repository?.resources?.length) return ["- 当前报告未连接项目仓储；模型由浏览器本地草稿提供。"];
  return [
    `- 项目修订：r${repository.projectRevision}；已同步 ${repository.synchronizedCount}/${repository.resources.length} 个资源；待复核 ${repository.staleCount} 个资源。`,
    ...repository.resources.map((resource) => {
      const lineage = [
        resource.briefRevision !== undefined && `简报 r${resource.briefRevision}`,
        resource.forceMissionPlanRevision !== undefined && `任务/兵力 r${resource.forceMissionPlanRevision}`,
        resource.ov1Revision !== undefined && `OV-1 r${resource.ov1Revision}`,
        resource.ov1bRevision !== undefined && `OV-1b r${resource.ov1bRevision}`,
        resource.ov5Revision !== undefined && `OV-5 r${resource.ov5Revision}`,
        resource.ov6bRevision !== undefined && `OV-6b r${resource.ov6bRevision}`,
        resource.ov6cRevision !== undefined && `OV-6c r${resource.ov6cRevision}`,
        resource.oodaRevision !== undefined && `OODA r${resource.oodaRevision}`,
        resource.scenarioRevision !== undefined && `想定 r${resource.scenarioRevision}`,
        resource.validationRevision !== undefined && `验证 r${resource.validationRevision}`
      ].filter(Boolean).join(" / ");
      const revision = resource.id === "brief"
        ? `项目 r${resource.revision}，简报 r${resource.resourceRevision}`
        : `项目 r${resource.revision}，资源 r${resource.resourceRevision}`;
      return `- ${inline(resource.label)}：${inline(resource.mode)} / ${inline(resource.status)}，${revision}${lineage ? `，来源 ${lineage}` : ""}。${inline(resource.detail)}`;
    })
  ];
}

function renderXmlResourceLineage(resource) {
  return ["briefRevision", "forceMissionPlanRevision", "ov1Revision", "ov1bRevision", "ov5Revision", "ov6bRevision", "ov6cRevision", "oodaRevision", "scenarioRevision", "validationRevision"]
    .filter((key) => resource[key] !== undefined)
    .map((key) => ` ${key}="${xml(resource[key])}"`)
    .join("");
}

function snapshotIdentity(snapshot) {
  if (!snapshot) return null;
  return { id: snapshot.id, label: snapshot.label, direction: snapshot.direction, savedAt: snapshot.savedAt };
}

function renderModelGovernanceSection(governance) {
  if (!governance?.snapshotCount) return ["- 尚未保存模型快照；当前报告为工作草稿。"];
  const latest = governance.latestSnapshot || {};
  const lines = [
    `- 本地模型快照：${governance.snapshotCount} 份`,
    `- 最近快照：${inline(latest.label)}，方向 ${inline(latest.direction)}，保存于 ${inline(latest.savedAt)}`
  ];
  if (!governance.comparison) return lines.concat("- 尚未选择两份快照进行差异审阅。");
  const comparison = governance.comparison;
  lines.push(`- 当前对比：${inline(comparison.baseline?.label)} -> ${inline(comparison.candidate?.label)}`);
  lines.push(`- 对比结论：${inline(comparison.summary)}`);
  lines.push(...(comparison.metrics || []).filter((metric) => metric.delta !== 0).map((metric) => `- ${inline(metric.label)}：${metric.before}${inline(metric.unit)} -> ${metric.after}${inline(metric.unit)}（${inline(metric.deltaLabel)}）`));
  if (comparison.quantitative) {
    const quantitative = comparison.quantitative;
    lines.push(`- 量化总分：${inline(quantitative.baseline?.label)} ${quantitative.baseline?.total ?? 0} -> ${inline(quantitative.candidate?.label)} ${quantitative.candidate?.total ?? 0}（差值 ${quantitative.delta ?? 0}）`);
    lines.push(`- 量化建议：${inline(quantitative.recommendation)}`);
    lines.push(...(quantitative.baseline?.criteria || []).map((criterion) => {
      const candidate = (quantitative.candidate?.criteria || []).find((item) => item.id === criterion.id) || {};
      const rationales = [criterion.manualRationale && `基准复核理由 ${inline(criterion.manualRationale)}`, candidate.manualRationale && `对比复核理由 ${inline(candidate.manualRationale)}`].filter(Boolean).join("；");
      return `- ${inline(criterion.label)}：权重 ${criterion.weight}%；${criterion.score} -> ${candidate.score ?? 0}；依据 ${criterion.evidence.map(inline).join("、")}${rationales ? `；${rationales}` : ""}`;
    }));
  }
  return lines;
}

function buildKnowledgeSummary(knowledge, activityRefs, knowledgeCitationApprovals) {
  if (!knowledge?.summary) return null;
  const allowed = filterKnowledgeForReportCitation(knowledge.docs, knowledgeCitationApprovals);
  return {
    name: knowledge.summary.name,
    fileCount: knowledge.summary.fileCount,
    chunkCount: knowledge.summary.chunkCount,
    importedAt: knowledge.summary.importedAt,
    referencedTerms: activityRefs,
    evidence: summarizeEvidence(allowed.docs, activityRefs),
    graph: buildKnowledgeGraph(allowed.docs).summary,
    sensitiveExcludedCount: allowed.sensitiveExcludedCount,
    sensitiveCitationApprovalCount: allowed.sensitiveCitationApprovalCount,
    approvedCitations: allowed.approvedCitations,
    sensitiveCitationPolicy: allowed.policy
  };
}

function filterBriefEvidenceRefs(brief, knowledge, knowledgeCitationApprovals) {
  const original = Array.isArray(brief?.evidenceRefs) ? brief.evidenceRefs : [];
  const allowed = filterKnowledgeForReportCitation(knowledge?.docs, knowledgeCitationApprovals);
  const knownRefs = new Set(allowed.docs.flatMap((doc) => [doc?.id, doc?.title, doc?.fileTitle, doc?.filePath]).map((item) => String(item || "").trim()).filter(Boolean));
  return {
    ...(brief || {}),
    evidenceRefs: original.map((item) => String(item || "").trim()).filter((item) => knownRefs.has(item))
  };
}

function summarizeEvidence(docs, referencedTerms) {
  const bestBySource = new Map();
  (docs || []).forEach((doc) => {
    const title = String(doc.title || doc.fileTitle || doc.name || "未命名知识");
    const sourceKey = String(doc.filePath || doc.fileTitle || title);
    const searchable = [title, doc.fileTitle, doc.tags?.join(" "), doc.links?.join(" "), doc.summary, doc.text].join(" ");
    const matchedTerms = referencedTerms.filter((term) => searchable.includes(term));
    if (!matchedTerms.length) return;
    const candidate = {
      id: String(doc.id || sourceKey),
      title,
      tags: unique(doc.tags || []),
      summary: String(doc.summary || doc.text || "").slice(0, 180),
      matchedTerms
    };
    const current = bestBySource.get(sourceKey);
    if (!current || candidate.matchedTerms.length > current.matchedTerms.length) bestBySource.set(sourceKey, candidate);
  });
  const entries = [...bestBySource.values()]
    .sort((left, right) => right.matchedTerms.length - left.matchedTerms.length)
    .slice(0, 5);
  const matchedTerms = unique(entries.flatMap((item) => item.matchedTerms));
  return { entries, unresolvedTerms: referencedTerms.filter((term) => !matchedTerms.includes(term)) };
}

function buildValidationMaturity({ ov5, ooda, scenario, validationResult, knowledge, traceability }) {
  const oodaNodeCount = ooda.lanes.flatMap((lane) => lane.nodes).length;
  const scoreValues = (validationResult?.scores || []).map((score) => Number(score.score)).filter(Number.isFinite);
  const averageScore = scoreValues.length ? Math.round(scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length) : 0;
  const highIssues = (validationResult?.issues || []).filter((issue) => issue.level === "high");
  const review = validationResult?.redTeamReview;
  const traceSummary = traceability?.summary || {};
  const missingInputs = [
    !ov5.activities.length && "作战活动",
    !oodaNodeCount && "OODA 节点",
    !scenario && "自动想定"
  ].filter(Boolean);
  const checks = [
    createMaturityCheck(
      "model-inputs",
      "验证对象已具备",
      missingInputs.length ? "review" : "ready",
      missingInputs.length ? `待补充：${missingInputs.join("、")}` : `OV-5 ${ov5.activities.length} 项活动、OODA ${oodaNodeCount} 个节点、想定已生成`
    ),
    createMaturityCheck(
      "validation-run",
      "规则验证已运行",
      validationResult ? "ready" : "pending",
      validationResult ? `生成于 ${validationResult.generatedAt}` : "尚未生成验证快照"
    ),
    createMaturityCheck(
      "score-baseline",
      "规则评分达到基线",
      !validationResult ? "pending" : averageScore >= 75 ? "ready" : "review",
      validationResult ? `平均分 ${averageScore}，基线为 75` : "需先运行设计验证"
    ),
    createMaturityCheck(
      "high-issues",
      "高优先级问题已清点",
      !validationResult ? "pending" : highIssues.length ? "attention" : "ready",
      !validationResult ? "需先运行设计验证" : highIssues.length ? `${highIssues.length} 项高优先级问题待修订` : "未发现高优先级问题"
    ),
    createMaturityCheck(
      "red-team",
      "红方质询已覆盖",
      !validationResult ? "pending" : review?.mode === "ai" ? "ready" : "review",
      !validationResult ? "需先运行设计验证" : review?.mode === "ai" ? `已使用 ${review.provider} 完成 AI 质询` : "当前为规则草案，待 AI 红方复核"
    ),
    createMaturityCheck(
      "evidence",
      "知识证据可追溯",
      !knowledge ? "pending" : knowledge.evidence.entries.length ? "ready" : "review",
      !knowledge ? "尚未连接 Vault" : knowledge.evidence.entries.length ? `已匹配 ${knowledge.evidence.entries.length} 条引用证据` : "活动引用尚未匹配到 Vault 片段"
    ),
    createMaturityCheck(
      "cross-view-traceability",
      "跨视图追溯已闭合",
      !traceSummary.activityCount ? "pending" : traceSummary.orphanedOv1SourceIds?.length ? "attention" : traceSummary.mappedActivityCount === traceSummary.activityCount ? "ready" : "review",
      !traceSummary.activityCount ? "尚无 OV-5 活动" : traceSummary.orphanedOv1SourceIds?.length ? `${traceSummary.orphanedOv1SourceIds.length} 条 OV-1 来源引用已失效` : traceSummary.mappedActivityCount === traceSummary.activityCount ? `${traceSummary.mappedActivityCount} 项活动均可追溯到 OV-1` : `${traceSummary.mappedActivityCount}/${traceSummary.activityCount} 项活动已关联 OV-1`
    )
  ];
  const readyCount = checks.filter((check) => check.state === "ready").length;
  return {
    label: readyCount === checks.length ? "可归档" : readyCount >= 4 ? "可评审，需补充" : "待完善",
    readyCount,
    totalCount: checks.length,
    checks
  };
}

function createMaturityCheck(id, label, state, detail) {
  const statusLabels = { ready: "已满足", review: "需复核", attention: "待修订", pending: "未完成" };
  return { id, label, state, statusLabel: statusLabels[state], detail };
}

function getOodaDuration(model) {
  return model.lanes.flatMap((lane) => lane.nodes)
    .reduce((sum, node) => sum + parseMinutes(node.duration), 0);
}

function parseMinutes(value) {
  const match = String(value || "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function generationLabel(provenance) {
  if (provenance?.mode === "ai") return "AI 草案，待人工复核";
  if (provenance?.mode === "local") return "本地规则草案，待人工复核";
  if (provenance?.mode === "derived") return "由上游模型派生";
  return "人工维护或既有模型";
}

function evidenceSelectionLines(selection) {
  if (!selection) return [];
  const source = selection.source === "server" ? "服务端项目知识库" : "本地 Vault";
  const fallback = selection.fallback ? "，服务端回退" : "";
  const revision = selection.source === "server" ? `，项目 r${Number(selection.projectRevision || 0)} / 索引 r${Number(selection.resourceRevision || 0)}` : "";
  return [`- 证据选择：${source} / ${inline(selection.indexMode || "keyword")} / ${Number(selection.count || 0)} 条${revision}${fallback}`];
}

function evidenceSelectionAttributes(selection) {
  if (!selection) return "";
  return ` evidenceSource="${xml(selection.source)}" evidenceIndex="${xml(selection.indexMode)}" evidenceCount="${xml(selection.count)}" evidenceFallback="${selection.fallback ? "true" : "false"}" evidenceProjectRevision="${xml(selection.projectRevision)}" evidenceResourceRevision="${xml(selection.resourceRevision)}"`;
}

function cell(value) {
  return inline(value).replace(/\|/g, "\\|");
}

function xmlElement(name, value, depth) {
  return `${"  ".repeat(depth)}<${name}>${xml(value)}</${name}>`;
}

function xml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function inline(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function rtf(value) {
  let result = "";
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === 92 || code === 123 || code === 125) {
      result += `\\${text[index]}`;
    } else if (code <= 127) {
      result += text[index];
    } else {
      result += `\\u${code > 32767 ? code - 65536 : code}?`;
    }
  }
  return result;
}

function unique(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}
