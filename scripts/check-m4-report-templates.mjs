import {
  listReportTemplates,
  getReportTemplate,
  resolveDefaultTemplateId,
  loadReportTemplate,
  TACTIC_SECTIONS,
  SCENARIO_SECTIONS,
  WARGAME_REVIEW_SECTIONS
} from "../design-studio/src/reportTemplateStore.js";
import { buildReportPayload, buildExportArtifactFromPayload } from "../design-studio/src/reportBuilder.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// 1. 验证模板列表覆盖与章节结构定义
const templates = listReportTemplates();
assert(templates.some((t) => t.id === "tactic-doc"), "模板列表必须收录战法说明模板 (tactic-doc)");
assert(templates.some((t) => t.id === "scenario-doc"), "模板列表必须收录想定文书模板 (scenario-doc)");
assert(templates.some((t) => t.id === "wargame-review"), "模板列表必须收录推演复盘模板 (wargame-review)");

assert(TACTIC_SECTIONS.length === 9, "战法说明模板必须定义 9 个标准章节");
assert(SCENARIO_SECTIONS.length === 6, "想定文书模板必须定义 6 个标准章节");
assert(WARGAME_REVIEW_SECTIONS.length === 6, "推演复盘模板必须定义 6 个标准章节");

// 2. 验证基于 projectKind 自动解析默认模板
assert(resolveDefaultTemplateId("tactic") === "tactic-doc", "战法设计项目默认模板必须解析为 tactic-doc");
assert(resolveDefaultTemplateId("scenario") === "scenario-doc", "想定推演项目默认模板必须解析为 scenario-doc");

// 3. 构造测试数据载荷
const baseContext = {
  project: {
    title: "跨域联合防空压制",
    direction: "无人低空突防与分布式协同电子压制",
    brief: {
      objective: "瘫痪对手前沿远程预警雷达网",
      approach: "利用诱饵无人机诱骗雷达开机，长航时电子战无人机实施压制",
      assumptions: "气象条件良好，对手防空雷达具备跳频反干扰能力",
      expectedEffects: "雷达开机率压制在 10% 以下",
      risk: "对手机动雷达备用阵地快速补盲"
    },
    citations: []
  },
  direction: "无人低空突防与分布式协同电子压制",
  ov1: { nodes: [{ id: "n1", label: "无人机编队" }], edges: [] },
  ov5: {
    activities: [
      { id: "act-1", title: "突防电磁压制", type: "strike", input: "目标频点", output: "压制信号", duration: "10m", refs: ["ref-1"] }
    ],
    edges: []
  },
  ooda: {
    sourceActivityIds: ["act-1"],
    lanes: [
      { id: "lane-act", title: "行动执行", subtitle: "Act", nodes: [{ id: "o-1", title: "释放干扰", input: "指令", output: "压制", duration: "2m", rule: "自动执行" }] }
    ]
  },
  scenario: {
    background: "演习海空域对抗想定",
    entities: []
  },
  validationResult: {
    generatedAt: new Date().toISOString(),
    scores: [{ score: 88 }],
    issues: [],
    redTeam: "对手可能采用无源探测定位干扰源"
  },
  knowledge: { docs: [], summary: { name: "Vault", fileCount: 0, chunkCount: 0 } },
  deployment: {}
};

// 4. 验证 tactic-doc 战法说明模板导出 Markdown / RTF 章节完整性
const tacticPayload = buildReportPayload({
  ...baseContext,
  reportTemplate: "tactic-doc"
});
const tacticMd = buildExportArtifactFromPayload("markdown", tacticPayload).content;
assert(tacticMd.includes("## 一、问题与背景"), "战法说明必须包含 一、问题与背景");
assert(tacticMd.includes("## 二、对手体系分析"), "战法说明必须包含 二、对手体系分析");
assert(tacticMd.includes("## 三、战法核心思想"), "战法说明必须包含 三、战法核心思想");
assert(tacticMd.includes("## 四、力量运用与编组"), "战法说明必须包含 四、力量运用与编组");
assert(tacticMd.includes("## 五、实施阶段与时序"), "战法说明必须包含 五、实施阶段与时序");
assert(tacticMd.includes("## 六、制胜机理与因果协同 (OV-5/OODA)"), "战法说明必须包含 六、制胜机理与因果协同");
assert(tacticMd.includes("## 七、风险评估与反制应对"), "战法说明必须包含 七、风险评估与反制应对");
assert(tacticMd.includes("## 八、评估结论与效能指标"), "战法说明必须包含 八、评估结论与效能指标");
assert(tacticMd.includes("## 九、溯源证据与引用附录"), "战法说明必须包含 九、溯源证据与引用附录");

// 5. 验证 scenario-doc 想定文书模板导出章节完整性
const scenarioPayload = buildReportPayload({
  ...baseContext,
  reportTemplate: "scenario-doc"
});
const scenarioMd = buildExportArtifactFromPayload("markdown", scenarioPayload).content;
assert(scenarioMd.includes("## 一、想定背景与初始态势"), "想定文书必须包含 一、想定背景与初始态势");
assert(scenarioMd.includes("## 二、作战环境与时空边界"), "想定文书必须包含 二、作战环境与时空边界");
assert(scenarioMd.includes("## 三、双方企图与作战编成"), "想定文书必须包含 三、双方企图与作战编成");
assert(scenarioMd.includes("## 四、阶段设定与裁决节点"), "想定文书必须包含 四、阶段设定与裁决节点");
assert(scenarioMd.includes("## 五、推演与交战规则 (ROE/OV-6a)"), "想定文书必须包含 五、推演与交战规则");
assert(scenarioMd.includes("## 六、附件与态势图件 (OV-1/OV-2)"), "想定文书必须包含 六、附件与态势图件");

// 6. 验证 wargame-review 推演复盘模板导出章节完整性
const reviewPayload = buildReportPayload({
  ...baseContext,
  reportTemplate: "wargame-review"
});
const reviewMd = buildExportArtifactFromPayload("markdown", reviewPayload).content;
assert(reviewMd.includes("## 一、推演概况与参演编组"), "推演复盘必须包含 一、推演概况与参演编组");
assert(reviewMd.includes("## 二、各阶段推进结果与战损"), "推演复盘必须包含 二、各阶段推进结果与战损");
assert(reviewMd.includes("## 三、关键决策点与对抗博弈"), "推演复盘必须包含 三、关键决策点与对抗博弈");
assert(reviewMd.includes("## 四、执行偏差与成因深度剖析"), "推演复盘必须包含 四、执行偏差与成因深度剖析");
assert(reviewMd.includes("## 五、体系机理与战法改进建议"), "推演复盘必须包含 五、体系机理与战法改进建议");
assert(reviewMd.includes("## 六、参考依据与数据来源"), "推演复盘必须包含 六、参考依据与数据来源");

// 7. 验证 RTF 格式对新模板标题的渲染
const tacticRtf = buildExportArtifactFromPayload("rtf", tacticPayload).content;
assert(tacticRtf.includes("tactic-doc") && tacticRtf.includes("\\b\\fs28"), "Word RTF 导出必须包含二级标题样式与模板标识");

console.log("✓ check-m4-report-templates: 三套成果模板定义、基于项目类型默认推导及章节结构导出验证通过！");
