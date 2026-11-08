import fs from "node:fs";
import path from "node:path";

const DEFAULT_CASES_ROOT = path.resolve("eval/cases");

/**
 * 校验单条黄金用例结构完整性与安全合规
 */
export function validateGoldenCase(caseData) {
  if (!caseData || typeof caseData !== "object") {
    throw new Error("用例必须是非空 JSON 对象");
  }

  const requiredAttrs = ["id", "category", "promptId", "schema", "name", "description", "input", "expectedAssertions", "goldenReference"];
  for (const attr of requiredAttrs) {
    if (!caseData[attr]) {
      throw new Error(`用例 [${caseData.id || "未知"}] 缺少必要字段: ${attr}`);
    }
  }

  const validCategories = ["tactic", "mechanism", "scenario"];
  if (!validCategories.includes(caseData.category)) {
    throw new Error(`用例 [${caseData.id}] 的 category 必须是 ${validCategories.join("/")} 之一，当前为: ${caseData.category}`);
  }

  // 校验 input 结构
  if (!caseData.input.workflow?.outputSchema) {
    throw new Error(`用例 [${caseData.id}] input.workflow.outputSchema 不能为空`);
  }

  // 校验 expectedAssertions
  const assertions = caseData.expectedAssertions;
  if (!Array.isArray(assertions.requiredFields) || assertions.requiredFields.length === 0) {
    throw new Error(`用例 [${caseData.id}] expectedAssertions.requiredFields 必须是非空数组`);
  }

  // 校验 goldenReference 结构
  const golden = caseData.goldenReference;
  if (!golden || typeof golden !== "object") {
    throw new Error(`用例 [${caseData.id}] goldenReference 必须是非空对象`);
  }

  for (const field of assertions.requiredFields) {
    if (golden[field] === undefined || golden[field] === null || golden[field] === "") {
      throw new Error(`用例 [${caseData.id}] 的 goldenReference 缺少 requiredFields 所要求的字段: ${field}`);
    }
  }

  // 校验抽象概念安全边界：严禁在输入和黄金参考中出现真实经纬度（如 "东经", "北纬" 等）
  const contentToCheck = JSON.stringify({ input: caseData.input, golden: caseData.goldenReference, desc: caseData.description });
  if (/东经|北纬|真实经纬度/.test(contentToCheck)) {
    throw new Error(`用例 [${caseData.id}] 违反作战概念研究工具安全边界：输入或黄金输出包含真实地理经纬度标识！`);
  }

  return true;
}

/**
 * 加载全部黄金评测用例
 */
export function loadAllCases(casesRoot = DEFAULT_CASES_ROOT) {
  if (!fs.existsSync(casesRoot)) {
    return [];
  }

  const results = [];
  const promptDirs = fs.readdirSync(casesRoot, { withFileTypes: true });

  for (const pDir of promptDirs) {
    if (!pDir.isDirectory()) continue;
    const dirPath = path.join(casesRoot, pDir.name);
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const fullPath = path.join(dirPath, file);
      try {
        const content = fs.readFileSync(fullPath, "utf8");
        const parsed = JSON.parse(content);
        validateGoldenCase(parsed);
        results.push({ ...parsed, filePath: fullPath });
      } catch (err) {
        throw new Error(`解析黄金用例文件失败 [${fullPath}]: ${err.message}`);
      }
    }
  }

  return results;
}

/**
 * 根据类别筛选用例 ("tactic" | "mechanism" | "scenario")
 */
export function getCasesByCategory(category, casesRoot = DEFAULT_CASES_ROOT) {
  const all = loadAllCases(casesRoot);
  return all.filter((c) => c.category === category);
}

/**
 * 根据 Prompt ID 筛选用例
 */
export function getCasesByPromptId(promptId, casesRoot = DEFAULT_CASES_ROOT) {
  const all = loadAllCases(casesRoot);
  return all.filter((c) => c.promptId === promptId);
}

/**
 * 根据用例 ID 获取单条用例
 */
export function getCaseById(id, casesRoot = DEFAULT_CASES_ROOT) {
  const all = loadAllCases(casesRoot);
  return all.find((c) => c.id === id) || null;
}
