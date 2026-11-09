// @ts-check
import assert from "node:assert/strict";
import {
  resolveStepTargetOutput,
  renderStepNextBar,
  renderWorkflowGate,
  resolveWorkflowGateContext
} from "../design-studio/src/app/workflowGate.js";
import { renderView } from "../design-studio/src/ui.js";

console.log("=== T3.2 每步下一步固定条验证 (check-workflow-step-next-bar) ===");

// 1. 测试各主线步骤产出目标描述
assert(resolveStepTargetOutput("brief").includes("作战概念研究简报六要素"));
assert(resolveStepTargetOutput("phase-action").includes("阶段划分"));
assert(resolveStepTargetOutput("force-mission").includes("兵力编组"));
assert(resolveStepTargetOutput("ov5").includes("因果网络"));
assert(resolveStepTargetOutput("ov1").includes("总体概念图"));
assert(resolveStepTargetOutput("scenario").includes("战法推演想定"));
console.log("✓ 1. resolveStepTargetOutput 产出目标规格映射通过");

// 2. 测试门禁未就绪时的下一步固定条三部分输出
const stateIncomplete = {
  activeProjectId: "test-proj",
  activeView: "brief",
  projectDirectory: {
    projects: [
      { id: "test-proj", workflow: { version: 2, completedThrough: -1, mode: "gated" } }
    ]
  },
  workflowCompleting: false,
  brief: {
    researchIntent: "",
    objective: "仅有目标，缺少其余五项",
    approach: "",
    assumptions: "",
    expectedEffects: "",
    risk: ""
  }
};

const barIncomplete = renderStepNextBar(stateIncomplete);
assert(barIncomplete.includes('data-step-next-bar'), "必须包含 data-step-next-bar 容器");
assert(barIncomplete.includes('step-next-bar-target'), "第1部分：必须包含产出目标容器");
assert(barIncomplete.includes('作战概念研究简报六要素'), "第1部分：必须呈现具体产出目标");

assert(barIncomplete.includes('step-next-bar-status'), "第2部分：必须包含完成条件状态容器");
assert(barIncomplete.includes('还差 5 项'), "第2部分：必须准确读取门禁还差5项");

assert(barIncomplete.includes('step-next-bar-action'), "第3部分：必须包含唯一主操作区");
assert(barIncomplete.includes('disabled'), "第3部分：未就绪时主按钮必须禁用");
console.log("✓ 2. 未就绪状态下固定条三部分要素验证通过");

// 3. 测试门禁就绪时的下一步固定条流转
const stateComplete = {
  activeProjectId: "test-proj",
  activeView: "brief",
  projectDirectory: {
    projects: [
      { id: "test-proj", workflow: { version: 2, completedThrough: -1, mode: "gated" } }
    ]
  },
  workflowCompleting: false,
  brief: {
    researchIntent: "完善意图",
    objective: "完善目标",
    approach: "完善路线",
    assumptions: "完善假设",
    expectedEffects: "完善效果",
    risk: "完善风险"
  }
};

const barComplete = renderStepNextBar(stateComplete);
assert(barComplete.includes("已就绪 (0项待补充)"), "就绪时必须标示0项待补充");
assert(!barComplete.includes('disabled'), "就绪时主按钮不得处于禁用状态");
assert(barComplete.includes('data-action="complete-workflow-stage"'), "主按钮必须绑定阶段确认动作");
console.log("✓ 3. 就绪状态下固定条三部分流转验证通过");

// 4. 测试方案2（合并至顶栏）：主视图释放纵向空间，顶栏门禁面板集成向导条与门禁指标
const renderedHtml = renderView("brief", stateComplete);
assert(!renderedHtml.includes('class="step-next-bar"'), "方案2：renderView 不得再前置插入侵占垂直高度的向导条");
assert(renderedHtml.includes('class="brief-conversation"'), "页面原本内容布局必须完整保留");

const gateHtml = renderWorkflowGate(stateComplete);
assert(gateHtml.includes('data-step-next-bar'), "顶栏工作流门禁面板必须包含 data-step-next-bar 区域");
assert(gateHtml.includes('作战概念研究简报六要素'), "顶栏门禁面板必须呈现当前步骤的明确产出目标");
assert(gateHtml.includes('已就绪 (0项待补充)'), "顶栏门禁面板必须呈现完成条件指标");
console.log("✓ 4. 方案2顶栏合并与主视图空间释放验证通过");

console.log("\n=== T3.2 所有断言 100% 全部通过 ===");
