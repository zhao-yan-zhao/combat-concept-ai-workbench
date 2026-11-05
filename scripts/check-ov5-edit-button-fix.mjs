import assert from "node:assert";
import fs from "node:fs";
import { renderOv5Workbench } from "../design-studio/src/ov5MechanismView.js";
import { createOv5AiController } from "../design-studio/src/ov5AiController.js";

console.log("=== 1. 验证 ov5MechanismView 中的编辑按钮属性契约 ===");
const mockModel = {
  activities: [
    { id: "act-1", title: "态势获取与确认", type: "态势感知", domain: "空中", autonomy: "HITL", input: "原始数据", output: "态势线索" },
    { id: "act-2", title: "对象判别与分发", type: "判决融合", domain: "空中", autonomy: "HOTL", input: "态势线索", output: "目标指派" }
  ],
  edges: [
    { id: "e1", sourceId: "act-1", targetId: "act-2", type: "信息流" }
  ]
};
const mockState = {
  ov5: mockModel,
  selection: { id: "act-1", kind: "activity" },
  activeView: "ov5",
  ov5LeftMode: "editor"
};

const html = renderOv5Workbench(mockState);
assert(html.includes('class="card-inline-edit-btn"'), "Should contain inline edit button");
assert(html.includes('data-stop-click-propagation="true"'), "Inline buttons must stop click propagation");
assert(html.includes('data-activity-id="act-1"'), "Inline buttons must carry data-activity-id");
console.log("✓ ov5MechanismView 按钮防冒泡与属性契约验证通过");

console.log("=== 2. 验证 ov5AiController.handleAction('edit-activity') 响应与反馈 ===");
let notified = null;
let rendered = false;
const controller = createOv5AiController({
  getState: () => mockState,
  render: () => { rendered = true; },
  notify: (msg) => { notified = msg; },
  invalidateDerivedArtifacts: () => {},
  syncOv5: async () => {},
  syncOoda: async () => {}
});

const mockSource = {
  dataset: {
    activityId: "act-2"
  }
};

const handled = controller.handleAction("edit-activity", mockSource);
assert(handled === true, "Action must be handled");
assert(mockState.selection.id === "act-2", "Selection should update to act-2");
assert(mockState.ov5LeftMode === "editor", "Left mode should be editor");
assert(rendered === true, "Render should be triggered");
assert(notified && notified.includes("对象判别与分发"), "Toast notification should give immediate feedback");
console.log("✓ ov5AiController edit-activity 即时反馈与状态流转验证通过");

console.log("=== 3. 验证 main.js 与 ov5Bindings.js 中 addEventListenerOnce 与事件防穿透契约 ===");
const mainContent = fs.readFileSync("design-studio/src/main.js", "utf-8");
const ov5BindingsContent = fs.readFileSync("design-studio/src/app/bindings/ov5Bindings.js", "utf-8");
const combinedContent = mainContent + "\n" + ov5BindingsContent;
assert(
  combinedContent.includes('addEventListenerOnce(button, "click"') && combinedContent.includes('"activity:click"'),
  "ov5Bindings / main.js must bind [data-activity] with addEventListenerOnce to prevent listener leaks"
);
assert(
  combinedContent.includes('event.target.closest("[data-action]")'),
  "ov5Bindings / main.js must ignore outer card activity selection when clicking inner data-action controls"
);
assert(
  combinedContent.includes('button.dataset.stopClickPropagation === "true"'),
  "main.js must stop click propagation when stopClickPropagation attribute is present"
);
console.log("✓ main.js / ov5Bindings.js 事件幂等性与冒泡隔离契约静态验证通过");

console.log("\n>>> 本次‘编辑按钮无反应与连击卡顿’修复全部验证通过！<<<");
