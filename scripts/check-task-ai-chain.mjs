import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { applyRuleChangeSet } from "../design-studio/src/ruleLibraryChatController.js";
import { ensureTaskSequenceCoverage } from "../design-studio/src/dodafProductController.js";
import { normalizeDodafOv6a, normalizeDodafOv6c } from "../shared/dodaf/products.js";
import { generateMockOutput } from "../shared/generator.js";
import { renderOv1b } from "../design-studio/src/ov1bView.js";

const tasks = [
  { id: "task-blue-parent", name: "蓝方态势获取", side: "friendly", objective: "形成态势", expectedEffect: "态势可用" },
  { id: "task-blue-child", name: "蓝方目标识别", side: "friendly", objective: "识别目标", expectedEffect: "目标确认" },
  { id: "task-red", name: "红方干扰", side: "hostile", objective: "实施干扰", expectedEffect: "感知受限" }
];

const decomposition = generateMockOutput({ workflow: { id: "task-decomposition", outputSchema: "TaskDecompositionDraft" }, analysis: { tasks }, evidence: [] }).result;
assert.equal(decomposition.decompositions.length, 1, "Fallback decomposition must stay inside one simulation side");
assert.equal(decomposition.decompositions[0].parentTaskRef, "task-blue-parent");
assert.equal(decomposition.decompositions[0].childTaskRef, "task-blue-child");

const rules = applyRuleChangeSet(normalizeDodafOv6a({ rules: [], ruleChangeSet: {
  source: "operational-task", changes: [{ id: "change-task", action: "add", ruleId: "", status: "pending", rule: { id: "rule-task", name: "任务效果确认", type: "业务规则", scope: "任务", description: "效果须可复核", phaseRefs: [], taskRefs: ["task-blue-parent"] } }]
} }));
assert.equal(rules.rules[0].taskBindings[0].taskRef, "task-blue-parent", "Accepted task rule must persist a typed task binding");
assert.equal(rules.rules[0].phaseBindings.length, 0, "Task rule must not leak into phase bindings");

const existingPhase = { id: "phase-sequence", name: "阶段时序", diagramType: "phase", participants: [], messages: [], fragments: [] };
const taskSequences = ensureTaskSequenceCoverage(normalizeDodafOv6c({ sequences: [existingPhase] }), { tasks, stateMachines: [] });
assert.equal(taskSequences.sequences.filter((item) => item.diagramType === "task").length, 3, "Task chain must generate one task sequence per task");
assert(taskSequences.sequences.some((item) => item.id === "phase-sequence"), "Task sequence generation must preserve phase sequences");

const ov1bHtml = renderOv1b({ forceMission: { tasks }, ov1b: { decompositions: [{ id: "d1", parentTaskRef: "task-blue-parent", childTaskRef: "task-blue-child", status: "pending_review" }] }, ov1bSide: "friendly", ov1bStorage: {} });
assert.equal((ov1bHtml.match(/class="ov1b-task-item/g) || []).length, 1, "Left list must contain parent tasks only");
assert(ov1bHtml.includes("ov1b-parent-node") && ov1bHtml.includes("ov1b-child-node"), "Canvas must render one parent above vertical child nodes");
assert(!ov1bHtml.includes("红方干扰</span><small>"), "Friendly canvas and parent list must not render hostile task nodes");

const [main, controller, server, canvasController, styles] = await Promise.all([
  readFile(new URL("../design-studio/src/main.js", import.meta.url), "utf8"),
  readFile(new URL("../design-studio/src/dodafProductController.js", import.meta.url), "utf8"),
  readFile(new URL("../server/openaiClient.mjs", import.meta.url), "utf8"),
  readFile(new URL("../design-studio/src/ov1bCanvasController.js", import.meta.url), "utf8"),
  readFile(new URL("../design-studio/styles.css", import.meta.url), "utf8")
]);
assert(main.includes('entrySource === "operational-task" ? "task" : "phase"'), "Navigation must select task versus phase generation context");
assert(controller.includes('item.subjectType === contextType') && controller.includes('item.diagramType === diagramType'), "Shared OV6 stores must skip only the current context type");
assert(server.includes('ai.generate.${ids[schema] || "generic"}') && server.includes('TaskDecompositionDraft: "task-decomposition"'), "Task decomposition prompt must be registered with a stable editable ID");
assert(main.includes("ov1bCanvasController.bind(document)"), "Task decomposition canvas pan controller must bind after render");
assert(canvasController.includes("setPointerCapture") && canvasController.includes("scrollLeft") && canvasController.includes("scrollTop"), "Task decomposition canvas must support pointer-drag panning");
assert(styles.includes(".ov1b-children::before") && styles.includes("left:43px; right:43px"), "Child bus must anchor to the first and last child centers");

console.log("Task AI chain acceptance passed: task-only decomposition, typed rules, context-isolated state/sequence generation.");
