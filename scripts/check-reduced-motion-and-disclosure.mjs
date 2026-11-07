import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderActivityInspector, renderBriefSidebar } from "../design-studio/src/ui.js";
import { renderOodaInspector } from "../design-studio/src/oodaView.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// 检查 views-foundation 与 workflow 的冗余流动光效已移除
const foundationCss = readFileSync(join(process.cwd(), "design-studio/styles/views-foundation.css"), "utf8");
assert(!foundationCss.includes("@keyframes brief-btn-sheen"), "brief-btn-sheen 纯装饰流光动画应被移除");
assert(!foundationCss.includes("ov1-toolbox-soft-pulse"), "ov1-toolbox-soft-pulse 纯装饰呼吸动画应被移除");

const workflowCss = readFileSync(join(process.cwd(), "design-studio/styles/workflow.css"), "utf8");
assert(!workflowCss.includes("@keyframes step-expand-sheen"), "step-expand-sheen 纯装饰流光动画应被移除");

// 2. 验证全局减少动效规则及开关样式
const transitionsCss = readFileSync(join(process.cwd(), "design-studio/styles/transitions-modals.css"), "utf8");
assert(transitionsCss.includes("@media (prefers-reduced-motion: reduce)"), "缺少媒体查询 prefers-reduced-motion 支持");
assert(transitionsCss.includes("body.reduced-motion") && transitionsCss.includes("html[data-reduced-motion=\"true\"]"), "缺少类与属性级别的减少动效全局覆盖规则");
assert(transitionsCss.includes("details.details-advanced"), "缺少 details.details-advanced 渐进展开样式");
assert(transitionsCss.includes(".reduced-motion-toggle"), "缺少减少动效切换按钮样式");

// 3. 验证视图渐进展开 (Progressive Disclosure) 结构
// 3.1 概念简报侧边栏：核心意图/目标/思路外露，约束/假设/风险/证据折叠进 <details>
const mockBriefState = {
  brief: {
    objective: "验证目标",
    approach: "验证思路",
    assumptions: "验证假设",
    expectedEffects: "验证预期效果",
    risk: "验证风险",
    evidenceRefs: ["ref-1"]
  },
  direction: "验证方向"
};
const briefHtml = renderBriefSidebar(mockBriefState);
assert(briefHtml.includes('name="intent"'), "简报核心意图字段必须默认外露");
assert(briefHtml.includes('name="objective"'), "简报核心目标字段必须默认外露");
assert(briefHtml.includes('name="approach"'), "简报核心思路字段必须默认外露");
assert(briefHtml.includes('<details class="details-advanced brief-advanced-details">'), "简报高级字段必须包含在 <details> 折叠块中");
assert(briefHtml.includes('name="assumptions"'), "折叠块中必须保留假设字段输入");
assert(briefHtml.includes('name="risk"'), "折叠块中必须保留风险字段输入");

// 3.2 OV-5 活动检查器：核心名称/类型/主体/域外露，高级约束折叠进 <details>
const mockActivitySelection = {
  id: "act-test",
  title: "测试活动",
  facts: [["活动类型", "感知"], ["输入", "态势"], ["输出", "目标"], ["预计耗时", "5m"]]
};
const mockActivityContext = {
  ov5: { activities: [{ id: "act-test", title: "测试活动", type: "感知", performer: "无人机", domain: "空中" }] },
  ov1: { nodes: [] }
};
const activityHtml = renderActivityInspector(mockActivitySelection, mockActivityContext);
assert(activityHtml.includes('name="title"'), "活动名称核心字段必须外露");
assert(activityHtml.includes('name="performer"'), "活动执行主体核心字段必须外露");
assert(activityHtml.includes('<details class="details-advanced activity-advanced-details">'), "活动高级属性必须折叠在 <details> 中");
assert(activityHtml.includes('name="autonomy"'), "折叠块中必须保留自主等级设置");
assert(activityHtml.includes('name="resilienceFallback"'), "折叠块中必须保留抗毁降级设置");

// 3.3 OODA 检查器：核心名称/I/O外露，说明与规则折叠进 <details>
const mockOodaSelection = {
  id: "ooda-test",
  title: "测试决策节点",
  input: "雷达数据",
  output: "指令包",
  duration: "3m",
  text: "长文本说明",
  rule: "交战规则"
};
const oodaHtml = renderOodaInspector(mockOodaSelection);
assert(oodaHtml.includes('name="title"') && oodaHtml.includes('name="input"'), "OODA 核心字段必须外露");
assert(oodaHtml.includes('<details class="details-advanced ooda-advanced-details">'), "OODA 高级字段必须折叠在 <details> 中");
assert(oodaHtml.includes('name="rule"'), "折叠块中必须保留规则设置");

// 4. 验证顶栏按钮与 main.js 交互绑定
const indexHtml = readFileSync(join(process.cwd(), "design-studio/index.html"), "utf8");
assert(indexHtml.includes('id="reducedMotionBtn"'), "顶栏必须包含减少动效按钮");
assert(indexHtml.includes('data-action="toggle-reduced-motion"'), "按钮动作必须绑定 toggle-reduced-motion");

const mainJs = readFileSync(join(process.cwd(), "design-studio/src/main.js"), "utf8");
assert(mainJs.includes('action === "toggle-reduced-motion"'), "main.js 中必须处理 toggle-reduced-motion 动作");
assert(mainJs.includes('workbench_reduced_motion'), "必须持久化 reduced-motion 至 localStorage");

console.log("✓ check-reduced-motion-and-disclosure: 纯装饰动画移除、全局减少动效开关与视图高级字段渐进展开验证通过！");
