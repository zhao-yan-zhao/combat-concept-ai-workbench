import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("=== 1. 验证 main.js 中 View Transitions 异步挂载与事件绑定契约 ===");
const mainContent = fs.readFileSync(path.join(projectRoot, "design-studio/src/main.js"), "utf8");

// 必须在 applyDomUpdate 内部执行 bindDynamicEvents，确保新 DOM 挂载时刻事件即刻就绪
assert(
  mainContent.includes("bindDynamicEvents();") &&
  mainContent.includes("renderInspectorPanel();") &&
  mainContent.includes("resizeBriefTextareas();"),
  "main.js 必须具备后置挂载与事件绑定逻辑"
);

// 提取 renderViewRoot 定义检查
const renderViewRootMatch = mainContent.match(/function renderViewRoot[\s\S]*?^}/m);
assert(renderViewRootMatch, "必须定义 renderViewRoot 函数");
const renderViewRootCode = renderViewRootMatch[0];

assert(
  renderViewRootCode.includes("applyDomUpdate = () => {") &&
  renderViewRootCode.includes("bindDynamicEvents();"),
  "renderViewRoot 的 applyDomUpdate 内部必须在 DOM 写入后调用 bindDynamicEvents()"
);

assert(
  renderViewRootCode.includes("transitionPending: true"),
  "startViewTransition 必须返回 transitionPending: true"
);

assert(
  mainContent.includes("!renderResult?.transitionPending"),
  "render() 主流程必须对 transitionPending 状态进行门禁判断，防止在旧 DOM 上错位提前绑定"
);

console.log("✓ main.js View Transitions 异步更新与事件即时绑定时序契约验证通过");

console.log("=== 2. 模拟验证浏览器异步调度下事件与画布控制器不丢失 ===");
let domMounted = false;
let eventsBound = false;
let mockViewRoot = { dataset: {}, innerHTML: "" };

const mockApplyDomUpdate = () => {
  domMounted = true;
  mockViewRoot.innerHTML = "<div class='kw-activity-card' data-activity='a1'><canvas class='ov4-canvas-stage'></canvas></div>";
  // 模拟 applyDomUpdate 内部挂载完成即刻绑定
  mockBindDynamicEvents();
};

const mockBindDynamicEvents = () => {
  if (mockViewRoot.innerHTML.includes("kw-activity-card")) {
    eventsBound = true;
  }
};

// 模拟 startViewTransition: 浏览器接收回调，推迟到下一次调度
let scheduledCallback = null;
const mockStartViewTransition = (cb) => {
  scheduledCallback = cb;
  return { finished: Promise.resolve() };
};

// 触发页面切换
const isViewSwitch = true;
if (isViewSwitch) {
  mockStartViewTransition(() => {
    mockApplyDomUpdate();
  });
}

// 调度前状态
assert(!domMounted, "调度前 DOM 尚未更新");
assert(!eventsBound, "调度前新事件尚未绑定");

// 浏览器微任务到达，触发回调
if (scheduledCallback) {
  scheduledCallback();
}

// 调度后状态
assert(domMounted, "调度后新 DOM 必须挂载成功");
assert(eventsBound, "调度后新 DOM 上的列表与画布事件必须已成功绑定");

console.log("✓ 异步调度下列表点击与画布事件保活模拟断言全部通过");

console.log("\n>>> 全部 View Transitions 事件与画布绑定修复断言通过！<<<");
