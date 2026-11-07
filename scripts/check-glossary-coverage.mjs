import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GLOSSARY, lookupGlossary, renderAbbr, formatTermTooltip } from "../shared/glossary.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// 1. 验证核心基础术语存在性与结构完整性
const coreTerms = [
  "DoDAF", "OODA", "CONOPS", "DM2", "CMO", "C2", "ISR", "EW", "SEAD",
  "OV-1", "OV-1a", "OV-1b", "OV-1c", "OV-2", "OV-3", "OV-4",
  "OV-5", "OV-5a", "OV-5b", "OV-6a", "OV-6b", "OV-6c", "OV-7"
];

for (const term of coreTerms) {
  const entry = GLOSSARY[term];
  assert(entry, `术语词典缺少核心条目: ${term}`);
  assert(entry.term === term, `术语名称不匹配: ${term}`);
  assert(entry.full && typeof entry.full === "string", `术语缺少英文全称: ${term}`);
  assert(entry.name && typeof entry.name === "string", `术语缺少中文规范名: ${term}`);
  assert(entry.desc && typeof entry.desc === "string", `术语缺少解释说明: ${term}`);
}

// 2. 扫描 design-studio/src/*View.js 中出现的所有缩写，确保 100% 词典覆盖
const viewsDir = join(process.cwd(), "design-studio/src");
const viewFiles = readdirSync(viewsDir).filter((file) => file.endsWith("View.js"));
assert(viewFiles.length >= 25, `未能正确扫描到足够的视图文件，当前仅检测到 ${viewFiles.length} 个`);

const abbreviationPattern = /\b([A-Z]{2,}(-[0-9][a-z]?)?|OV-[0-9][a-z]?|DoDAF)\b/g;
const scannedTerms = new Set();
const missingTerms = new Set();

for (const file of viewFiles) {
  const content = readFileSync(join(viewsDir, file), "utf8");
  const matches = content.match(abbreviationPattern) || [];
  for (const match of matches) {
    scannedTerms.add(match);
    if (!lookupGlossary(match)) {
      missingTerms.add(match);
    }
  }
}

assert(scannedTerms.size > 0, "视图文件中未提取到任何缩写词");
assert(
  missingTerms.size === 0,
  `以下视图中出现的缩写未在 shared/glossary.js 词典中收录: ${Array.from(missingTerms).sort().join(", ")}`
);

// 3. 验证 renderAbbr 与悬浮提示生成
const ov1Abbr = renderAbbr("OV-1");
assert(ov1Abbr.includes("<abbr class=\"glossary-abbr\""), "renderAbbr 未正确生成 abbr 标签");
assert(ov1Abbr.includes("title=\"高级作战概念总体图 (High-Level Operational Concept Graphic)"), "renderAbbr title 未包含中文与英文全称");
assert(ov1Abbr.includes(">OV-1</abbr>"), "renderAbbr 标签内容不正确");

const unknownAbbr = renderAbbr("NONEXISTENT_XYZ", "Fallback text");
assert(unknownAbbr === "Fallback text", "未收录词应安全回退为纯文本");

const tooltip = formatTermTooltip("OODA");
assert(tooltip.includes("OODA 决策循环 (Observe, Orient, Decide, Act)"), "formatTermTooltip 格式不符合规范");

console.log(`✓ check-glossary-coverage: 成功扫描 ${viewFiles.length} 个视图文件，提取 ${scannedTerms.size} 个缩写，全部在术语词典中 100% 覆盖并支持 <abbr> 渲染！`);
