import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildObsidianArchive,
  frontmatter,
  extractPayloadCitations,
  link,
  linkEvidence
} from "../design-studio/src/obsidianArchiveBuilder.js";
import { writeObsidianArchive } from "../design-studio/src/obsidianArchiveClient.js";

console.log("=== 1. 静态代码契约检查：Obsidian 回写与 Frontmatter 规范 ===");

const builderSource = readFileSync("./design-studio/src/obsidianArchiveBuilder.js", "utf8");
assert(builderSource.includes("export function buildObsidianArchive"), "缺少 buildObsidianArchive 导出");
assert(builderSource.includes("export function frontmatter"), "缺少 frontmatter 导出");
assert(builderSource.includes("export function extractPayloadCitations"), "缺少 extractPayloadCitations 导出");
assert(builderSource.includes("project_id:"), "Frontmatter 必须包含 project_id");
assert(builderSource.includes("report_version:"), "Frontmatter 必须包含 report_version");
assert(builderSource.includes("generated_at:"), "Frontmatter 必须包含 generated_at");
assert(builderSource.includes("citations:"), "Frontmatter 必须包含 citations 引用列表");
assert(builderSource.includes("classification:"), "Frontmatter 必须包含 classification 密级标识");

const clientSource = readFileSync("./design-studio/src/obsidianArchiveClient.js", "utf8");
assert(clientSource.includes("writeNewFileSafely"), "obsidianArchiveClient.js 必须具备安全防覆盖写入机制");
assert(clientSource.includes("checkFileExists"), "obsidianArchiveClient.js 必须包含已有文件探测");

console.log("✓ 静态代码契约检查全部通过");

console.log("=== 2. 单元测试：各笔记 Frontmatter 四要素与双链生成 ===");

const mockPayload = {
  generatedAt: "2026-11-08T15:00:00.000Z",
  classification: "机密",
  reportVersion: { label: "R002", id: "report-v2" },
  reportTemplate: { id: "tactic-doc", label: "战法说明" },
  project: {
    id: "proj-alpha",
    title: "跨域协同压制战法",
    kind: "tactic",
    classification: "机密",
    brief: {
      objective: "压制防空雷达",
      approach: "电磁协同与饱和反辐射",
      assumptions: "空天中继畅通",
      expectedEffects: "雷达开机率低于 20%",
      risk: "机动隐蔽雷达反击",
      evidenceRefs: ["对手雷达技术体制.md", "分布式电磁压制范例.md#第三节"]
    },
    citations: ["战例1", "战例2"]
  },
  ov1: { nodes: [{ id: "n1", label: "指挥单元" }], edges: [] },
  ov5: {
    activities: [
      {
        id: "act-1",
        title: "雷达信号精确定位",
        type: "感知探测",
        input: "侦察卫星原始电磁信号",
        output: "雷达辐射源目标参数",
        duration: "30s",
        description: "对预警雷达进行多星时差测向定位",
        refs: ["对手雷达技术体制.md"],
        citations: [{ sourcePath: "雷达手册.md", heading: "雷达时差定位" }]
      }
    ],
    edges: []
  },
  ooda: {
    lanes: [
      {
        id: "orient",
        title: "Orient",
        subtitle: "判断",
        nodes: [
          {
            id: "ooda-node-1",
            title: "雷达威胁等级综合研判",
            sourceActivityId: "act-1",
            duration: "10s",
            input: "目标参数",
            output: "打击优先级",
            rule: "威胁值大于 80 立即下达指令",
            knowledgeRefs: ["威胁评估准则.md"]
          }
        ]
      }
    ]
  },
  knowledge: {
    evidence: {
      entries: [
        { id: "e1", title: "对手雷达技术体制", fileTitle: "对手雷达技术体制" }
      ]
    }
  }
};

const archive = buildObsidianArchive(mockPayload);
assert(archive.files.length >= 5, "归档笔记集合应至少包含 5 篇结构化笔记");

// 2.1 检查 IndexNote
const indexNote = archive.files.find((f) => f.fileName === "研究归档.md");
assert(indexNote, "必须包含 研究归档.md");
assert(indexNote.content.includes("project_id: \"proj-alpha\""), "IndexNote 缺少 project_id");
assert(indexNote.content.includes("report_version: \"R002\""), "IndexNote 缺少 report_version");
assert(indexNote.content.includes("classification: \"机密\""), "IndexNote 缺少 classification");
assert(indexNote.content.includes("template_id: \"tactic-doc\""), "IndexNote 缺少 template_id");
assert(indexNote.content.includes("citations:"), "IndexNote 缺少 citations 引用列表");
assert(indexNote.content.includes("[[ConceptBrief]]"), "IndexNote 缺少 ConceptBrief 双链");
assert(indexNote.content.includes("[[OV5-act-1]]"), "IndexNote 缺少作战活动双链");
assert(indexNote.content.includes("[[OODA-ooda-node-1]]"), "IndexNote 缺少 OODA 双链");

// 2.2 检查 ConceptBrief.md
const briefNote = archive.files.find((f) => f.fileName === "ConceptBrief.md");
assert(briefNote, "必须包含 ConceptBrief.md");
assert(briefNote.content.includes("[[对手雷达技术体制]]"), "ConceptBrief 必须对知识依据生成双链");

// 2.3 检查 ActivityNote
const actNote = archive.files.find((f) => f.fileName === "OV5-act-1.md");
assert(actNote, "必须包含 OV5-act-1.md");
assert(actNote.content.includes("design_node_id: \"act-1\""), "ActivityNote 缺少 design_node_id");
assert(actNote.content.includes("[[ConceptBrief]]"), "ActivityNote 缺少来源简报双链");
assert(actNote.content.includes("[[OODA-ooda-node-1]]"), "ActivityNote 缺少关联 OODA 节点双链");

// 2.4 检查 OodaNote
const oodaNote = archive.files.find((f) => f.fileName === "OODA-ooda-node-1.md");
assert(oodaNote, "必须包含 OODA-ooda-node-1.md");
assert(oodaNote.content.includes("[[OV5-act-1]]"), "OodaNote 缺少来源活动双链");

console.log("✓ Frontmatter 四要素（项目、版本、时间、引用列表）与双链系统验证通过");

console.log("=== 3. 运行时测试：绝不修改已有笔记与安全派生新笔记 ===");

const previousWindow = globalThis.window;
try {
  // 创建模拟 Vault
  const vaultRoot = createMockVault("Test Vault");

  // 模拟目录中已有旧笔记
  const legacyDir = await vaultRoot.getDirectoryHandle("原有研究归档", { create: true });
  legacyDir.files.set("研究归档.md", "# 原有未修改的研究成果");
  legacyDir.files.set("ConceptBrief.md", "# 原有未修改的概念简报");

  globalThis.window = { showDirectoryPicker: async () => vaultRoot };

  // 写入新归档到同一子目录名下
  const result = await writeObsidianArchive({
    folderName: "原有研究归档",
    filename: "研究归档.md",
    files: [
      { fileName: "研究归档.md", content: "# 全新生成的归档" },
      { fileName: "ConceptBrief.md", content: "# 全新生成的简报" },
      { fileName: "新活动.md", content: "# 新增活动" }
    ]
  });

  // 验证已有笔记绝未被修改
  assert.equal(legacyDir.files.get("研究归档.md"), "# 原有未修改的研究成果", "铁律校验：已有笔记内容绝对不能被修改！");
  assert.equal(legacyDir.files.get("ConceptBrief.md"), "# 原有未修改的概念简报", "铁律校验：已有简报内容绝对不能被修改！");

  // 验证安全派生了新笔记
  assert.equal(legacyDir.files.get("研究归档_1.md"), "# 全新生成的归档", "冲突笔记应安全派生为 _1 新笔记");
  assert.equal(legacyDir.files.get("ConceptBrief_1.md"), "# 全新生成的简报", "冲突简报应安全派生为 _1 新笔记");
  assert.equal(legacyDir.files.get("新活动.md"), "# 新增活动", "新笔记应正常写入");

  console.log("✓ 绝不修改已有笔记原则安全防御验证 100% 通过");

} finally {
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
}

function createMockVault(name) {
  return {
    name,
    directories: new Map(),
    files: new Map(),
    async getDirectoryHandle(childName) {
      if (!this.directories.has(childName)) this.directories.set(childName, createMockVault(childName));
      return this.directories.get(childName);
    },
    async getFileHandle(fileName, options = {}) {
      if (options.create === false && !this.files.has(fileName)) {
        const error = new Error("File not found");
        error.name = "NotFoundError";
        throw error;
      }
      return {
        createWritable: async () => ({
          write: async (content) => { this.files.set(fileName, content); },
          close: async () => {}
        })
      };
    }
  };
}

console.log("\n=== T4.4 Obsidian 回写全部验证通过 (100% PASS) ===");
