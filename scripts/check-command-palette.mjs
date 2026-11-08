import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  VIEW_COMMANDS,
  ACTION_COMMANDS,
  extractProjectElements,
  filterCommands,
  renderCommandPaletteHtml
} from "../design-studio/src/commandPaletteView.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// 1. 验证基础导航与动作集合覆盖完整性
assert(VIEW_COMMANDS.length >= 10, "视图导航命令集合至少覆盖 10 个以上常用视图与步骤");
const stepIds = ["brief", "phase-action", "force-mission", "ov5", "ov1", "scenario"];
for (const step of stepIds) {
  assert(VIEW_COMMANDS.some((c) => c.view === step), `主线步骤 ${step} 必须包含在视图命令清单中`);
}
assert(ACTION_COMMANDS.some((c) => c.action === "toggle-reduced-motion"), "常用动作必须包含减少动效切换");
assert(ACTION_COMMANDS.some((c) => c.action === "save-report-version"), "常用动作必须包含版本保存");

// 2. 验证动态要素提取 (extractProjectElements)
const mockState = {
  operationalTask: {
    tasks: [{ id: "task-anti-radar", name: "防空雷达压制", side: "friendly", missionType: "SEAD" }]
  },
  phaseAction: {
    phases: [{ id: "phase-infiltrate", name: "低空突防阶段", timeWindow: "T+00~T+30" }]
  },
  forceMission: {
    conceptForces: [{ id: "force-uav-swarm", name: "诱饵无人机蜂群", side: "friendly", role: "decoy" }]
  },
  ov5: {
    activities: [{ id: "act-distribute-strike", name: "分布式协同压制", domain: "air", autonomyLevel: "HOTL" }]
  },
  ov6b: {
    machines: [{ id: "sm-uav-flight", name: "无人机突防状态机", subjectType: "task" }]
  }
};

const elements = extractProjectElements(mockState);
assert(elements.some((e) => e.title.includes("防空雷达压制") && e.view === "operational-task"), "任务要素必须被正确提取");
assert(elements.some((e) => e.title.includes("低空突防阶段") && e.view === "phase-action"), "阶段要素必须被正确提取");
assert(elements.some((e) => e.title.includes("诱饵无人机蜂群") && e.view === "force-mission"), "兵力要素必须被正确提取");
assert(elements.some((e) => e.title.includes("分布式协同压制") && e.view === "ov5"), "活动要素必须被正确提取");
assert(elements.some((e) => e.title.includes("无人机突防状态机") && e.view === "ov6b"), "状态机要素必须被正确提取");

// 3. 验证多词检索与过滤算法 (filterCommands)
const emptyResults = filterCommands("", mockState);
assert(emptyResults.length > 0, "空检索词应默认列出导航与常用动作");

const radarResults = filterCommands("雷达 任务", mockState);
assert(radarResults.length > 0 && radarResults.some((r) => r.id === "elem-task-task-anti-radar"), "应能通过多词模糊匹配精准定位任务要素");

const motionResults = filterCommands("动效", mockState);
assert(motionResults.some((r) => r.action === "toggle-reduced-motion"), "应能搜索到系统级操作");

// 4. 验证 HTML 渲染结构
const html = renderCommandPaletteHtml({
  query: "雷达",
  selectedIndex: 0,
  state: mockState
});
assert(html.includes('id="commandPaletteInput"'), "渲染结果必须包含搜索输入框");
assert(html.includes('role="option"'), "渲染条目必须具有无障碍 role=option 属性");
assert(html.includes("is-active"), "渲染结果必须包含当前高亮选中的条目");
assert(html.includes("data-command-index=\"0\""), "必须包含选中条目的索引属性");

// 5. 验证静态 HTML 与快捷键绑定
const indexHtml = readFileSync(join(process.cwd(), "design-studio/index.html"), "utf8");
assert(indexHtml.includes('id="commandPaletteBtn"'), "index.html 顶栏必须包含命令面板入口按钮");
assert(indexHtml.includes('id="commandPaletteDialog"'), "index.html 必须包含 commandPaletteDialog 对话框节点");

const chromeBindingsJs = readFileSync(join(process.cwd(), "design-studio/src/app/bindings/chromeBindings.js"), "utf8");
assert(chromeBindingsJs.includes('event.key === "k" || event.key === "K"'), "必须在全局键盘事件中绑定 Ctrl+K / Cmd+K 快捷键");

console.log("✓ check-command-palette: 命令面板 (Ctrl+K) 视图搜索、要素提取与快捷导航验证通过！");
