import { createLocalOv5Draft } from "../design-studio/src/ov5DraftStore.js";
import { linkOv5ActivitiesToOv1, countUnmappedOv5Activities, suggestOv1SourcesForActivity } from "../design-studio/src/ov5Ov1Linker.js";
import { applyMappingQuality, inspectMappingQuality, suggestParentsByType } from "../design-studio/src/ov5MappingQuality.js";
import { applyStructureReviewFilter, buildStructureReview } from "../design-studio/src/structureReviewBuilder.js";
import { renderStructureReview } from "../design-studio/src/structureReviewView.js";
import { buildStructureReviewExport } from "../design-studio/src/structureReviewExport.js";
import { views, workflowTracks } from "../design-studio/src/data.js";
import { renderTree, selectionFor, renderInspector } from "../design-studio/src/ui.js";
import { generateValidation, isValidationStale, markValidationStale } from "../design-studio/src/validationStore.js";
import { renderValidation } from "../design-studio/src/validationView.js";
import { createOv5SourceSignature, deriveOodaFromOv5, isOodaStale } from "../design-studio/src/oodaStore.js";
import { renderOoda } from "../design-studio/src/oodaView.js";
import { buildOv3Model } from "../design-studio/src/ov3Builder.js";
import { generateScenario, isScenarioStale, markScenarioStale, getScenarioFreshness } from "../design-studio/src/scenarioStore.js";
import { renderScenario } from "../design-studio/src/scenarioView.js";
import { buildCollaborationReviewDraft } from "../design-studio/src/structureReviewExport.js";
import { renderDeploymentIntegration } from "../design-studio/src/deploymentView.js";
import { renderCollaboration } from "../design-studio/src/collaborationView.js";

globalThis.localStorage = {
  store: new Map(),
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; },
  setItem(key, value) { this.store.set(key, String(value)); },
  removeItem(key) { this.store.delete(key); }
};

const ov1 = {
  nodes: [
    { id: "sense", label: "监视侦察装备", kind: "equipment", category: "装备平台", responsibility: "感知", input: "任务区", output: "态势", constraints: "证据边界", expectedEffects: "可见性" },
    { id: "decide", label: "联合指挥控制中心", kind: "command", category: "指挥节点", responsibility: "决策", input: "态势", output: "指令", constraints: "授权", expectedEffects: "协同" },
    { id: "control", label: "关键行动单元", kind: "action", category: "关键动作", responsibility: "行动", input: "指令", output: "反馈", constraints: "边界", expectedEffects: "控制" },
    { id: "opponent", label: "外部对象", kind: "external", category: "外部对象", responsibility: "影响", input: "环境", output: "压力", constraints: "未知", expectedEffects: "扰动" },
    { id: "assess", label: "任务效果与终态", kind: "effect", category: "预期效果", responsibility: "评估", input: "反馈", output: "结论", constraints: "指标", expectedEffects: "闭环" }
  ],
  edges: [
    { id: "e1", sourceId: "sense", targetId: "decide", type: "信息流" },
    { id: "e2", sourceId: "decide", targetId: "control", type: "控制流" },
    { id: "e3", sourceId: "control", targetId: "assess", type: "反馈" },
    { id: "e4", sourceId: "assess", targetId: "sense", type: "反馈" }
  ]
};

const unlinked = createLocalOv5Draft({
  brief: { objective: "建立联合封控", approach: "多源感知", expectedEffects: "形成闭环", risk: "信息欺骗" },
  direction: "稳控塑势",
  ov1: null
});
assert(countUnmappedOv5Activities(unlinked, ov1) === unlinked.activities.length, "Draft without OV-1 should leave activities unmapped against a later OV-1");

const linkedDraft = createLocalOv5Draft({
  brief: { objective: "建立联合封控", approach: "多源感知", expectedEffects: "形成闭环", risk: "信息欺骗" },
  direction: "稳控塑势",
  ov1
});
assert(countUnmappedOv5Activities(linkedDraft, ov1) === 0, "Local OV-5 draft should auto-link activities to OV-1 nodes");
assert(linkedDraft.activities.find((item) => item.id === "ov5-sense")?.sourceOv1NodeIds?.includes("sense"), "Sense activity should prefer equipment/sense OV-1 node");
assert(linkedDraft.activities.find((item) => item.id === "ov5-assess")?.sourceOv1NodeIds?.includes("assess"), "Assess activity should prefer effect OV-1 node");

const remapped = linkOv5ActivitiesToOv1({
  activities: [
    { id: "a1", type: "感知", title: "侦察", sourceOv1NodeIds: [] },
    { id: "a2", type: "决策", title: "协同决策", sourceOv1NodeIds: ["missing"] }
  ],
  edges: []
}, ov1);
assert(remapped.activities[0].sourceOv1NodeIds.length > 0, "Linker should fill empty sourceOv1NodeIds");
assert(!remapped.activities[1].sourceOv1NodeIds.includes("missing"), "Linker should drop stale OV-1 ids");
assert(remapped.activities[1].sourceOv1NodeIds.includes("decide"), "Decision activity should rematch command node");

const review = buildStructureReview({
  ov1: { nodes: [{ id: "sense", label: "监视" }], edges: [] },
  ov5: {
    activities: [
      { id: "a1", title: "侦察", type: "感知", input: "", output: "线索", sourceOv1NodeIds: [] },
      { id: "a2", title: "决策", type: "决策", input: "数据包", output: "指令", sourceOv1NodeIds: ["sense"] }
    ],
    edges: [{ id: "e1", sourceId: "a1", targetId: "a2", type: "信息流" }]
  },
  ooda: { lanes: [] },
  scenario: { entities: [], timeline: [] }
});
assert(review.summary.total > 0, "Structure review should surface issues for incomplete models");
assert(review.issues.some((item) => item.code === "activity-unmapped"), "Unmapped activities should appear in structure review");
assert(review.issues.some((item) => item.action === "attach-ov1-sources"), "Review should offer attach-ov1-sources action when unmapped");
assert(review.issues.some((item) => item.group === "validation" && item.action === "run-validation"), "Missing validation should appear as a pending validation group item");

const oodaEmpty = { lanes: [
  { id: "observe", title: "Observe", subtitle: "观察", nodes: [] },
  { id: "orient", title: "Orient", subtitle: "判断", nodes: [] },
  { id: "decide", title: "Decide", subtitle: "决策", nodes: [] },
  { id: "act", title: "Act", subtitle: "行动", nodes: [] }
] };
const validation = generateValidation(linkedDraft, oodaEmpty, null, ov1);
const merged = buildStructureReview({
  ov1,
  ov5: linkedDraft,
  ooda: oodaEmpty,
  scenario: null,
  validationResult: validation
});
assert(merged.summary.validationRan, "Merged review should mark validation as run");
assert(merged.groups.some((group) => group.id === "validation" && group.issues.length), "Validation issues should form their own group");
assert(merged.issues.some((item) => item.group === "validation" && item.sourceView === "validate"), "Validation issues should retain validate provenance");

const suggested = suggestOv1SourcesForActivity({ id: "ov5-decide", type: "决策", title: "协同方案判定" }, ov1);
assert(suggested.includes("decide"), "Activity source suggestion should prefer command/decide nodes");

const activitySelection = selectionFor("activity", linkedDraft.activities[0].id, { ov5: linkedDraft, ov1 });
assert(activitySelection.facts.some((fact) => fact[0] === "OV-1 来源" && String(fact[1]).includes("监视")), "Activity selection should show OV-1 source labels");

const page = renderStructureReview({
  ov1,
  ov5: linkedDraft,
  ooda: oodaEmpty,
  scenario: { entities: [], timeline: [] },
  validationResult: validation,
  structureReviewFilter: { severity: "all", group: "all" },
  ov5Storage: {}
});
assert(page.includes("结构核对台") && page.includes('data-action="attach-ov1-sources"'), "Structure review view did not render core controls");
assert(page.includes('data-action="run-validation"') && page.includes("设计验证"), "Structure review should expose validation merge controls");
assert(page.includes('data-action="apply-mapping-quality"'), "Structure review should expose mapping-quality action");
assert(page.includes("data-structure-jump"), "Structure review should expose jump targets");
assert(page.includes("data-structure-filter-severity") && page.includes("data-structure-filter-group"), "Structure review filters missing");
assert(page.includes('data-derived-provenance="structure-review"') && page.includes("可写源模型"), "Structure review should show DoDAF/workbench provenance strip");

const staleValidation = markValidationStale(validation, "测试：模型已变更");
assert(isValidationStale(staleValidation, linkedDraft, oodaEmpty, null, ov1), "markValidationStale should mark result stale");
const staleReview = buildStructureReview({
  ov1,
  ov5: linkedDraft,
  ooda: oodaEmpty,
  scenario: null,
  validationResult: staleValidation
});
assert(staleReview.summary.validationStale, "Structure review should detect stale validation");
assert(staleReview.issues.some((item) => item.code === "validation-stale"), "Stale validation should add a re-run issue");
assert(staleReview.issues.some((item) => item.group === "validation" && item.stale && String(item.title).includes("[过期]")), "Stale validation issues should be labeled");

const stalePage = renderStructureReview({
  ov1,
  ov5: linkedDraft,
  ooda: oodaEmpty,
  scenario: null,
  validationResult: staleValidation,
  structureReviewFilter: { severity: "all", group: "validation" },
  ov5Storage: {}
});
assert(stalePage.includes("设计验证已过期") && stalePage.includes("重新运行验证"), "Stale validation banner missing from structure review");

const validationPage = renderValidation({
  validationResult: staleValidation,
  validationStorage: {},
  redTeamHealth: null,
  redTeamRunning: false
});
assert(validationPage.includes("验证结果已过期") && validationPage.includes("validation-stale-banner"), "Validation view should show stale banner");

const filteredAlert = applyStructureReviewFilter(staleReview, { severity: "alert", group: "all" });
assert(filteredAlert.filteredIssues.every((item) => item.severity === "alert"), "Alert filter should keep only alert issues");
const filteredGroup = applyStructureReviewFilter(staleReview, { severity: "all", group: "mapping" });
assert(filteredGroup.filteredIssues.every((item) => item.group === "mapping"), "Group filter should keep only mapping issues");
assert(filteredGroup.filteredGroups.every((group) => group.id === "mapping"), "Filtered groups should match group filter");

const emptyFilterPage = renderStructureReview({
  ov1,
  ov5: linkedDraft,
  ooda: oodaEmpty,
  scenario: null,
  validationResult: validation,
  structureReviewFilter: { severity: "alert", group: "sequence" },
  ov5Storage: {}
});
assert(emptyFilterPage.includes("没有匹配") || emptyFilterPage.includes("当前显示 0"), "Empty filter state should be communicated");

const inspectorHtml = renderInspector(activitySelection, { ov5: linkedDraft, ov1, activeView: "ov5" });
assert(inspectorHtml.includes('name="sourceOv1NodeIds"') && inspectorHtml.includes("ov1-source-picker"), "Activity inspector should render multi-select OV-1 source picker");
assert(inspectorHtml.includes('data-ov1-source-suggest') && inspectorHtml.includes('data-ov1-source-clear'), "Activity inspector should offer suggest/clear source actions");

assert(views.some((view) => view.id === "structure-review"), "structure-review view missing from navigation data");
assert(!workflowTracks.some((track) => track.viewIds.includes("structure-review")), "Structure review must remain an associated cross-model view, not a mainline step");
const tree = renderTree("structure-review", { version: 2, completedThrough: 6, mode: "free" });
assert(!tree.includes("结构核对台") && tree.includes('data-track="simulation"') && tree.includes("step-circle"), "Step rail should keep seven mainline products while structure review is open");

const ooda = deriveOodaFromOv5(linkedDraft);
assert(ooda.sourceOv5Signature === createOv5SourceSignature(linkedDraft), "Derived OODA should stamp OV-5 source signature");
assert(!isOodaStale(ooda, linkedDraft), "Freshly derived OODA should not be stale");
const changedOv5 = {
  ...linkedDraft,
  activities: linkedDraft.activities.map((activity, index) => index === 0 ? { ...activity, title: `${activity.title}-改` } : activity)
};
assert(isOodaStale(ooda, changedOv5), "OODA should become stale after OV-5 activity edits");
const oodaPage = renderOoda({ ooda, ov5: changedOv5, oodaDuration: 12, oodaGenerating: false, oodaStorage: {}, selection: null });
assert((oodaPage.includes("研究循环相对活动模型已过期") || oodaPage.includes("相对活动模型已过期")) && oodaPage.includes("立即重新派生"), "OODA view should show stale banner after activity model change");
const oodaStaleReview = buildStructureReview({
  ov1,
  ov5: changedOv5,
  ooda,
  scenario: null,
  validationResult: null
});
assert(oodaStaleReview.summary.oodaStale && oodaStaleReview.issues.some((item) => item.code === "ooda-stale"), "Structure review should surface OODA stale issue");

const exportBundle = buildStructureReviewExport({
  ov1,
  ov5: linkedDraft,
  ooda,
  scenario: null,
  validationResult: validation,
  structureReviewFilter: { severity: "all", group: "validation" },
  projectTitle: "测试项目"
});
assert(exportBundle.markdown.content.includes("# 结构审阅清单") && exportBundle.markdown.content.includes("测试项目"), "Markdown checklist export incomplete");
assert(exportBundle.markdown.content.includes("设计验证") || exportBundle.payload.groups.some((group) => group.id === "validation"), "Export should respect validation filter group");
assert(exportBundle.json.content.includes("structure-review-checklist"), "JSON checklist export incomplete");
assert(exportBundle.payload.filter.group === "validation", "Export payload should retain active filter");
const exportPage = renderStructureReview({
  ov1,
  ov5: linkedDraft,
  ooda,
  scenario: null,
  validationResult: validation,
  structureReviewFilter: { severity: "all", group: "all" },
  ov5Storage: {}
});
assert(exportPage.includes('data-action="export-structure-review-markdown"') && exportPage.includes('data-action="export-structure-review-json"'), "Structure review export actions missing");
assert(exportPage.includes('data-action="attach-structure-review-collaboration"'), "Structure review should offer attach-to-collaboration action");
assert(exportBundle.collaborationDraft?.summary && exportBundle.collaborationDraft.summary.length <= 1200, "Collaboration draft summary missing or too long");
assert(exportBundle.collaborationDraft.resource && exportBundle.collaborationDraft.disposition, "Collaboration draft should pick resource and disposition");
const collabDraft = buildCollaborationReviewDraft(exportBundle.payload);
assert(collabDraft.kind === "structure-review-collaboration-draft" && collabDraft.clientId.startsWith("review-structure-"), "Collaboration draft identity invalid");

// --- Scenario stale vs OV-5/OODA ---
const scenarioFresh = generateScenario(linkedDraft, ooda);
assert(!isScenarioStale(scenarioFresh, linkedDraft, ooda), "Fresh scenario should not be stale");
assert(scenarioFresh.sourceOv5Signature === createOv5SourceSignature(linkedDraft), "Scenario should stamp OV-5 signature");
const scenarioStaleByMark = markScenarioStale(scenarioFresh, "测试过期");
assert(isScenarioStale(scenarioStaleByMark, linkedDraft, ooda) && getScenarioFreshness(scenarioStaleByMark, linkedDraft, ooda).stale, "markScenarioStale should force stale");
const scenarioSig = generateScenario(linkedDraft, ooda);
const scenarioStaleByUpstream = { ...scenarioSig, stale: false, staleReason: "", sourceOv5Signature: "outdated" };
assert(isScenarioStale(scenarioStaleByUpstream, linkedDraft, ooda), "Scenario should detect OV-5 signature drift");
const scenarioPage = renderScenario({
  scenario: scenarioStaleByUpstream,
  ov5: linkedDraft,
  ooda,
  scenarioStorage: {},
  deployment: { settings: { targetUrl: "http://127.0.0.1:8765/tool" }, status: "idle", open: false },
  simulationAdapter: { settings: {}, status: "idle" }
});
assert((scenarioPage.includes("想定相对") && scenarioPage.includes("已过期")) && scenarioPage.includes("立即重新生成"), "Scenario view should show stale banner");
assert(scenarioPage.includes("部署推送已暂停") && scenarioPage.includes('data-action="open-deployment" disabled') && scenarioPage.includes('data-action="push-deployment" disabled'), "Stale scenario should disable deployment open/push");
const deploymentHtml = renderDeploymentIntegration({
  scenario: scenarioStaleByUpstream,
  ov5: linkedDraft,
  ooda,
  deployment: { settings: { targetUrl: "http://127.0.0.1:8765/tool" }, status: "idle", open: true }
});
assert(deploymentHtml.includes("想定已过期，已禁用推送") || deploymentHtml.includes("部署推送已暂停"), "Deployment integration should surface stale lock");
const scenarioReview = buildStructureReview({
  ov1,
  ov5: linkedDraft,
  ooda,
  scenario: scenarioStaleByUpstream,
  validationResult: null
});
assert(scenarioReview.summary.scenarioStale && scenarioReview.issues.some((item) => item.code === "scenario-stale" && item.action === "generate-scenario"), "Structure review should surface scenario stale with regenerate action");

const draftCollab = renderCollaboration({
  collaboration: {
    status: "ready",
    revision: 3,
    openCount: 0,
    reviews: [],
    session: { authenticated: false, setupRequired: false },
    reviewDraft: exportBundle.collaborationDraft,
    storage: {},
    auditEntries: []
  },
  projectRevision: 3,
  knowledge: { docs: [] },
  projectStorage: {}, ov1Storage: {}, ov5Storage: {}, oodaStorage: {}, scenarioStorage: {}, validationStorage: {}, knowledgeStorage: {}, reportStorage: {}
});
assert(draftCollab.includes('data-collaboration-draft="pending"') && draftCollab.includes("待提交：结构审阅清单草稿"), "Unauthenticated collaboration should show pending draft banner");
assert(draftCollab.includes('data-action="clear-collaboration-review-draft"'), "Collaboration draft should offer clear action");
const authedDraft = renderCollaboration({
  collaboration: {
    status: "ready",
    revision: 3,
    openCount: 0,
    reviews: [],
    session: { authenticated: true, actor: { id: "r1", label: "研究员", roles: ["researcher"] } },
    reviewDraft: exportBundle.collaborationDraft,
    storage: {},
    auditEntries: []
  },
  projectRevision: 3,
  knowledge: { docs: [] },
  projectStorage: {}, ov1Storage: {}, ov5Storage: { resourceRevision: 1 }, oodaStorage: {}, scenarioStorage: {}, validationStorage: {}, knowledgeStorage: {}, reportStorage: {}
});
assert(authedDraft.includes('data-collaboration-draft="form"') && authedDraft.includes("确认提交清单审阅"), "Authenticated collaboration form should highlight loaded draft");

// --- P1 mapping quality: blank I/O fill, shallow parents, soft OV-3 match ---
const blankModel = {
  activities: [
    { id: "s", type: "感知", title: "感知", input: "待定义", output: "待定义", sourceOv1NodeIds: ["sense"], parentId: "" },
    { id: "d", type: "决策", title: "决策", input: "", output: "", sourceOv1NodeIds: ["decide"], parentId: "" },
    { id: "a", type: "行动", title: "行动", input: "待定义", output: "行动反馈", sourceOv1NodeIds: ["control"], parentId: "" }
  ],
  edges: [
    { id: "e1", sourceId: "s", targetId: "d", type: "信息流", payload: "" },
    { id: "e2", sourceId: "d", targetId: "a", type: "控制流", payload: "" }
  ]
};
const qualityBefore = inspectMappingQuality(blankModel, ov1);
assert(qualityBefore.blankIoCount >= 2 && qualityBefore.canApply && qualityBefore.flatHierarchy, "Mapping quality inspect should flag blank I/O and flat hierarchy");
assert(suggestParentsByType(blankModel.activities).length === 2, "Parent suggestions should use shallow tree under earliest type");
const qualityApplied = applyMappingQuality(blankModel, ov1);
assert(qualityApplied.summary.changed, "applyMappingQuality should change blank model");
assert(qualityApplied.model.activities.find((item) => item.id === "s")?.output && !/待定义/.test(qualityApplied.model.activities.find((item) => item.id === "s").output), "Sense output should fill from OV-1 node");
assert(qualityApplied.model.activities.filter((item) => item.parentId).length >= 1, "Shallow parents should be applied when flat");
const authored = applyMappingQuality({
  activities: [{ id: "x", type: "感知", title: "感知", input: "已有输入", output: "已有输出", sourceOv1NodeIds: ["sense"], parentId: "keep" }],
  edges: []
}, ov1);
assert(authored.model.activities[0].input === "已有输入" && authored.model.activities[0].parentId === "keep", "applyMappingQuality must not overwrite authored fields");
const softMatch = buildOv3Model({
  ov5: {
    activities: [
      { id: "p", title: "Produce", input: "in", output: "态势线索 数据包" },
      { id: "c", title: "Consume", input: "态势线索", output: "out" }
    ],
    edges: [{ id: "soft", sourceId: "p", targetId: "c", type: "信息流" }]
  }
});
assert(softMatch.exchanges[0]?.compatibility === "ready", "OV-3 should soft-match shared contract tokens");
const qualityReview = buildStructureReview({ ov1, ov5: blankModel, ooda: oodaEmpty, scenario: null, validationResult: null });
assert(qualityReview.summary.mappingQualityCanApply && qualityReview.issues.some((item) => item.action === "apply-mapping-quality"), "Structure review should offer apply-mapping-quality issues");
assert(qualityReview.issues.some((item) => item.code === "activity-blank-io" || item.code === "activity-flat-hierarchy"), "Structure review should surface mapping-quality codes");

console.log("Structure review workbench acceptance passed: linker, validation/ooda/scenario stale, filters, export, collaboration attach, mapping quality.");
function assert(condition, message) { if (!condition) throw new Error(message); }
