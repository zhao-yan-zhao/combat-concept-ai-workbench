import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderProjectManager } from "../design-studio/src/projectManagerView.js";
import { renderConceptGraphic } from "../design-studio/src/conceptGraphicView.js";
import { renderOperationalTasks } from "../design-studio/src/operationalTaskView.js";
import { renderOv1b } from "../design-studio/src/ov1bView.js";
import { renderStateMachineWorkbench } from "../design-studio/src/stateMachineView.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// 1. 项目管理器空状态测试：包含现状说明与直接可点击的操作按钮
const projectEmptyHtml = renderProjectManager({ directory: { projects: [] }, open: true });
assert(projectEmptyHtml.includes("project-manager-empty"), "项目管理器空状态必须保留标识类名");
assert(projectEmptyHtml.includes("toggle-project-create"), "项目管理器空状态必须提供新建项目按钮");
assert(projectEmptyHtml.includes("load-example-project"), "项目管理器空状态必须提供载入示例项目按钮");

// 2. 概念图视图空状态测试：节点和关系空状态均附带可操作按钮
const conceptEmptyHtml = renderConceptGraphic({
  model: { nodes: [], edges: [], effects: [], activities: [], oodaHints: [], checklist: [] }
});
assert(conceptEmptyHtml.includes("generate-concept-graphic"), "概念图空状态必须提供生成草案按钮");
assert(conceptEmptyHtml.includes("empty-inspector-block"), "概念图空状态必须使用结构化空状态容器");

// 3. 作战任务工作台空状态测试：提供 AI 一键生成与手动新增
const taskEmptyHtml = renderOperationalTasks({
  operationalTask: { tasks: [] },
  phaseAction: { phases: [{ id: "p1", name: "阶段1" }] }
});
assert(taskEmptyHtml.includes("generate-operational-tasks"), "作战任务空状态必须提供 AI 一键生成作战任务按钮");
assert(taskEmptyHtml.includes("add-operational-task"), "作战任务空状态必须提供手动新增任务按钮");

// 4. OV-1b 业务流空状态测试：提供新增任务组与关联跳转
const ov1bEmptyHtml = renderOv1b({
  ov1b: { taskGroups: [] },
  tasks: []
});
assert(ov1bEmptyHtml.includes("ov1b-add-group"), "OV-1b 空状态必须提供新增任务组按钮");

// 5. 状态机工作台空状态测试：提供新增状态机引导
const smEmptyHtml = renderStateMachineWorkbench({
  ov6b: { machines: [] },
  tasks: []
});
assert(smEmptyHtml.includes("ov6b-add-machine"), "状态机未选中或空状态必须提供新增状态机按钮");

// 6. 静态源码扫描：验证关键视图不存在死胡同式的单纯文字“暂无”
const viewsToVerify = [
  "projectManagerView.js",
  "aiPromptView.js",
  "conceptGraphicView.js",
  "forceMissionView.js",
  "operationalTaskView.js",
  "ov1bView.js",
  "ov2View.js",
  "ov5MechanismView.js",
  "stateMachineView.js"
];

for (const file of viewsToVerify) {
  const content = readFileSync(join(process.cwd(), "design-studio/src", file), "utf8");
  // 检查是否存在单纯的 `<p ...>暂无[^\n<]*</p>` 而周围没有附带 action 按钮或指引
  const deadEndPMatches = content.match(/<p class="[^"]*empty[^"]*">暂无[^<]*<\/p>/g) || [];
  for (const match of deadEndPMatches) {
    // 允许有建议/说明性后缀的提示，不允许完全没有上下文的孤立文字
    assert(
      match.includes("可") || match.includes("请") || match.includes("依赖"),
      `文件 ${file} 中发现孤立未指引的空状态标签: ${match}`
    );
  }
}

console.log("✓ check-empty-states-actionable: 空状态与错误提示文案（现状 + 可操作指引）验证通过！");
