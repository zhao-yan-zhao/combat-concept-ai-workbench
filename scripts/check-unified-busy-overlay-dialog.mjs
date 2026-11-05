import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Testing Unified AI Generation Busy Overlay Dialog Contract...");

const mainContent = fs.readFileSync("design-studio/src/main.js", "utf8");

// 1. 验证 getBusyOverlayState 包含 OV-5 / OV-5a / OV-1c / OV-7
assert(mainContent.includes("state.ov5Generating"), "getBusyOverlayState must handle state.ov5Generating");
assert(mainContent.includes("key: \"ov5-generate\""), "Must define ov5-generate key");
assert(mainContent.includes("正在构建作战活动与机理"), "Must specify title for ov5 generation overlay");

assert(mainContent.includes("state.ov5aPregenerating"), "getBusyOverlayState must handle state.ov5aPregenerating");
assert(mainContent.includes("key: \"ov5a-pregenerate\""), "Must define ov5a-pregenerate key");
assert(mainContent.includes("正在生成作战活动分解构型"), "Must specify title for ov5a overlay");

assert(mainContent.includes("state.ov1cPregenerating"), "getBusyOverlayState must handle state.ov1cPregenerating");
assert(mainContent.includes("key: \"ov1c-pregenerate\""), "Must define ov1c-pregenerate key");
assert(mainContent.includes("正在对齐任务活动映射"), "Must specify title for ov1c overlay");

assert(mainContent.includes("state.ov7Pregenerating"), "getBusyOverlayState must handle state.ov7Pregenerating");
assert(mainContent.includes("key: \"ov7-pregenerate\""), "Must define ov7-pregenerate key");
assert(mainContent.includes("正在对齐状态转换与因果活动"), "Must specify title for ov7 overlay");

// 2. 验证 OV-5 视图在生成时保留视角渲染，且彻底移除旧的内联过渡卡片
const ov5ViewContent = fs.readFileSync("design-studio/src/ov5MechanismView.js", "utf8");
assert(ov5ViewContent.includes("${renderActivePerspective({"), "ov5-view-stage must preserve renderActivePerspective");
assert(!ov5ViewContent.includes("renderOv5GeneratingBanner"), "Must not include old inline generating banner");
assert(!ov5ViewContent.includes("ov5-generating-box"), "Must not include old inline box");

console.log("All unified busy overlay dialog tests passed successfully!");
