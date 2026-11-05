import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderOv5Workbench } from "../design-studio/src/ov5MechanismView.js";
import { renderWorkflowGate } from "../design-studio/src/app/workflowGate.js";
import { renderOv1c, renderOv7 } from "../design-studio/src/mappingProductView.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("=== 1. 验证 CSS 中的现代过渡动画与统一 AI 生成进度条 ===");
const cssContent = fs.readFileSync(path.join(projectRoot, "design-studio/styles.css"), "utf8");
assert(cssContent.includes("::view-transition-old(root)"), "必须定义 ::view-transition-old(root)");
assert(cssContent.includes("::view-transition-new(root)"), "必须定义 ::view-transition-new(root)");
assert(cssContent.includes("workbench-view-fade"), "必须定义降级动画 workbench-view-fade");
assert(cssContent.includes(".workflow-gate-shell.is-advancing"), "必须定义胶囊推进执行动效 .is-advancing");
assert(cssContent.includes("brief-progress-shimmer"), "必须复用统一的 brief-progress-shimmer 流光扫描动效");
assert(cssContent.includes("rule-pregenerate-pulse"), "必须复用统一的 rule-pregenerate-pulse 呼吸微光动效");
console.log("✓ CSS 统一过渡动效规则验证通过");

console.log("=== 2. 验证 main.js 现代化 View Transitions 集成 ===");
const mainContent = fs.readFileSync(path.join(projectRoot, "design-studio/src/main.js"), "utf8");
assert(mainContent.includes("document.startViewTransition"), "renderViewRoot 必须优先使用 document.startViewTransition");
assert(mainContent.includes("state.workflowCompleting = true;"), "推进流转时必须设置 workflowCompleting 触发胶囊动效");
console.log("✓ main.js View Transitions 与胶囊推进动效集成验证通过");

console.log("=== 3. 验证 OV-5 彻底移除旧过渡卡片，完全由全屏统一过渡弹窗接管 ===");
const mockGeneratingState = {
  activeView: "ov5",
  ov5Generating: true,
  ov5: { activities: [], edges: [] },
  brief: { objective: "测试" }
};
const generatingHtml = renderOv5Workbench(mockGeneratingState);
assert(!generatingHtml.includes("ov5-generating-box"), "OV-5 页面内必须彻底移除旧的过渡卡片/动画横条");
assert(!generatingHtml.includes("renderOv5GeneratingBanner"), "OV-5 不得存在旧的过渡横条渲染");
assert(generatingHtml.includes("ov5-view-stage"), "OV-5 必须保持视角工作台正常渲染，不破坏性掏空");
console.log("✓ OV-5 彻底移除旧过渡卡片、纯净保留工作台验证通过");

console.log("=== 4. 验证 OV-1c / OV-7 预生成过渡动画一致性 ===");
const mockMappingState = {
  activeView: "ov1c",
  ov1cPregenerating: true,
  ov7Pregenerating: true,
  ov1c: { mappings: [] },
  ov7: { mappings: [] },
  ov5: { activities: [] }
};
const ov1cHtml = renderOv1c(mockMappingState);
assert(ov1cHtml.includes("brief-generate-progress"), "OV-1c 预生成必须复用统一的 brief-generate-progress");
assert(ov1cHtml.includes("rule-pregenerate-spinner"), "OV-1c 必须复用统一的 rule-pregenerate-spinner");

const ov7Html = renderOv7(mockMappingState);
assert(ov7Html.includes("brief-generate-progress"), "OV-7 预生成必须复用统一的 brief-generate-progress");
assert(ov7Html.includes("rule-pregenerate-spinner"), "OV-7 必须复用统一的 rule-pregenerate-spinner");
console.log("✓ OV-1c 与 OV-7 预生成过渡动画一致性验证通过");

console.log("=== 5. 验证 workflowGate 胶囊推进动效状态 ===");
const mockAdvancingState = {
  activeView: "ov3",
  workflowCompleting: true,
  projectDirectory: { projects: [{ id: "default", workflow: { completedThrough: 2 } }] },
  activeProjectId: "default"
};
const gateHtml = renderWorkflowGate(mockAdvancingState);
assert(gateHtml.includes("is-advancing"), "推进中胶囊外壳必须带有 is-advancing 类");
assert(gateHtml.includes("AI 生成推进中"), "推进中胶囊文本必须呈现动态推进状态");
console.log("✓ workflowGate 胶囊推进动效标记验证通过");

console.log("\n>>> 全部统一过渡动画验证通过！");
