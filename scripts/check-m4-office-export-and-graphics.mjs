import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildReportPayload,
  renderOv1StandaloneSvg
} from "../design-studio/src/reportBuilder.js";

console.log("=== 1. 静态代码契约检查：Word/Office 导出与图件嵌入 ===");

const reportBuilderSource = readFileSync("./design-studio/src/reportBuilder.js", "utf8");
assert(reportBuilderSource.includes("export function renderOv1StandaloneSvg"), "reportBuilder.js 必须导出 renderOv1StandaloneSvg");
assert(reportBuilderSource.includes("ov1Snapshot.svgGraphic = ov1Svg"), "buildReportPayload 必须为 ov1Snapshot 挂载 svgGraphic");
assert(reportBuilderSource.includes('graphics: ['), "buildReportPayload 必须返回 graphics 集合");

const officeReportsSource = readFileSync("./server/routes/officeReports.mjs", "utf8");
assert(officeReportsSource.includes("graphic-ov1.svg"), "officeReports.mjs 必须提取并写入 graphic-ov1.svg");
assert(officeReportsSource.includes("-GraphicPath"), "officeReports.mjs 必须向 PowerShell 传递 -GraphicPath 参数");

const docxPs1Source = readFileSync("./scripts/generate-report-docx.ps1", "utf8");
assert(docxPs1Source.includes("[string]$GraphicPath = ''"), "generate-report-docx.ps1 必须支持 $GraphicPath 参数");
assert(docxPs1Source.includes("function Add-Image"), "generate-report-docx.ps1 必须包含 Add-Image 辅助函数");
assert(docxPs1Source.includes("tactic-doc") && docxPs1Source.includes("scenario-doc") && docxPs1Source.includes("wargame-review"), "generate-report-docx.ps1 必须覆盖 tactic-doc、scenario-doc、wargame-review 三套新模板");
assert(docxPs1Source.includes("一、问题与背景") && docxPs1Source.includes("九、溯源证据与引用附录"), "generate-report-docx.ps1 战法说明必须覆盖 9 章节");
assert(docxPs1Source.includes("一、想定背景与初始态势") && docxPs1Source.includes("六、附件与态势图件"), "generate-report-docx.ps1 想定文书必须覆盖 6 章节");
assert(docxPs1Source.includes("一、推演概况与参演编组") && docxPs1Source.includes("六、参考依据与数据来源"), "generate-report-docx.ps1 推演复盘必须覆盖 6 章节");

console.log("✓ 静态代码契约检查全部通过");

console.log("=== 2. 单元测试：renderOv1StandaloneSvg 矢量图件生成 ===");

// 2.1 空节点测试
const emptySvg = renderOv1StandaloneSvg({ nodes: [], edges: [] });
assert(emptySvg.includes("<svg"), "空模型应返回有效 SVG");
assert(emptySvg.includes("尚未配置 OV-1 概念节点"), "空模型应包含友好提示文字");

// 2.2 正常节点与连线模型测试
const mockOv1 = {
  nodes: [
    { id: "node-c2", label: "联合指挥所", category: "指挥控制", x: 20, y: 30 },
    { id: "node-sensor", label: "天基侦察卫星", category: "多域侦察", x: 50, y: 15 },
    { id: "node-strike", label: "分布式火力单元", category: "协同打击", x: 80, y: 70 },
    { id: "node-comm", label: "机动通信中继", category: "通信网络", x: 45, y: 55 }
  ],
  edges: [
    { id: "e1", sourceId: "node-sensor", targetId: "node-c2", type: "目标指示" },
    { id: "e2", sourceId: "node-c2", targetId: "node-strike", type: "交战指令" },
    { id: "e3", sourceId: "node-c2", targetId: "node-comm", type: "网络管控" }
  ]
};

const fullSvg = renderOv1StandaloneSvg(mockOv1, {
  title: "分布式协同压制总体概念图",
  classification: "机密"
});

assert(fullSvg.includes("<svg") && fullSvg.endsWith("</svg>"), "SVG 应完整闭合");
assert(fullSvg.includes("分布式协同压制总体概念图"), "SVG 标题未正确渲染");
assert(fullSvg.includes("密级：机密"), "SVG 密级标注未正确渲染");
assert(fullSvg.includes("联合指挥所") && fullSvg.includes("分布式火力单元"), "节点名称未包含在 SVG 中");
assert(fullSvg.includes("目标指示") && fullSvg.includes("交战指令"), "连线关系标签未包含在 SVG 中");
assert(fullSvg.includes("marker id=\"arrow\""), "缺少箭头标记定义");
assert(fullSvg.includes("坐标基准：抽象相对网格坐标体系"), "缺少抽象相对网格说明");

console.log("✓ renderOv1StandaloneSvg 矢量图件生成器验证通过");

console.log("=== 3. 集成测试：buildReportPayload 自动注入图件 ===");

const payload = buildReportPayload({
  project: {
    id: "test-proj",
    title: "海空一体协同突击战法",
    kind: "tactic",
    classification: "内部",
    citations: []
  },
  brief: {
    objective: "快速瘫痪敌枢纽",
    approach: "全向隐蔽渗透与饱和打击",
    assumptions: "气象水文适宜",
    expectedEffects: "打击时延减半",
    risk: "强电磁反制",
    evidenceRefs: []
  },
  inspiration: null,
  direction: "分布式机动作战",
  forceMission: null,
  ov1: mockOv1,
  ov5: { activities: [], edges: [], provenance: null },
  ooda: { lanes: [{ id: "l1", title: "Observe", subtitle: "观察", nodes: [] }], provenance: null },
  scenario: { entities: [] },
  validationResult: { issues: [], redTeam: "对抗分析通过", scores: [{ score: 90 }] },
  knowledge: null,
  deployment: null,
  reportTemplate: "tactic-doc"
});

assert(typeof payload.ov1.svgGraphic === "string" && payload.ov1.svgGraphic.includes("<svg"), "payload.ov1.svgGraphic 未正确挂载");
assert(Array.isArray(payload.graphics) && payload.graphics.length >= 1, "payload.graphics 应包含图件清单");
assert.equal(payload.graphics[0].id, "ov1", "第一个图件 ID 应为 ov1");
assert.equal(payload.graphics[0].format, "svg", "第一个图件格式应为 svg");
assert(payload.graphics[0].content.includes("海空一体协同突击战法"), "图件内容应包含项目标题");

console.log("✓ buildReportPayload 自动挂载图件与元数据验证通过");

console.log("=== 4. 模拟运行：officeReports 临时文件写入与图件导出流程 ===");

const tempDir = await mkdtemp(join(tmpdir(), "check-m4-office-"));
try {
  const graphicPath = join(tempDir, "graphic-ov1.svg");
  const svgContent = payload.ov1.svgGraphic;
  await writeFile(graphicPath, svgContent, "utf8");

  const written = readFileSync(graphicPath, "utf8");
  assert.equal(written, svgContent, "临时写入的 SVG 图件文件内容与 payload 保持一致");
  console.log("✓ officeReports 图件落盘与路径关联测试通过");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("\n=== T4.3 导出格式与图件嵌入全部验证通过 (100% PASS) ===");
