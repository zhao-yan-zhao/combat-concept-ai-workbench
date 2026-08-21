import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildTaskDecompositionFingerprint, mergeTaskDecompositionDraft } from "../design-studio/src/dodafProductController.js";
import { normalizeDodafOv1b } from "../shared/dodaf/products.js";
import { generateMockOutput } from "../shared/generator.js";
import { renderOv1b } from "../design-studio/src/ov1bView.js";

const tasks = [
  { id: "task-blue-1", name: "蓝方态势获取", side: "friendly", missionType: "侦察" },
  { id: "task-blue-2", name: "蓝方目标识别", side: "friendly", missionType: "侦察" },
  { id: "task-red-1", name: "红方干扰", side: "hostile", missionType: "干扰" }
];

const draft = generateMockOutput({ workflow: { id: "task-organization", outputSchema: "TaskOrganizationDraft" }, analysis: { tasks }, evidence: [] }).result;
assert(draft.taskGroups.length >= 2, "Fallback must organize supplied tasks into groups");
assert.deepEqual(new Set(draft.taskGroups.flatMap((group) => group.taskRefs)), new Set(tasks.map((task) => task.id)), "Fallback may reference supplied task IDs only");
assert(!JSON.stringify(draft).includes("parentTaskRef") && !JSON.stringify(draft).includes("childTaskRef"), "Task organization must not emit parent-child semantics");

const fingerprint = buildTaskDecompositionFingerprint(tasks);
assert.equal(buildTaskDecompositionFingerprint([...tasks].reverse()), fingerprint, "Task fingerprint must be order independent");
const normalized = normalizeDodafOv1b({ taskGroups: draft.taskGroups, derivedFrom: { mode: "ai", sources: ["forceMissionPlan.tasks"], note: fingerprint } });
assert.equal(normalized.derivedFrom.note, fingerprint);

const merged = mergeTaskDecompositionDraft([
  { id: "task-organization-ai-old", name: "旧草案", taskRefs: ["task-blue-1"], status: "pending_review" },
  { id: "task-organization-ai-confirmed", name: "已确认", taskRefs: ["task-red-1"], status: "confirmed" },
  { id: "manual-group", name: "人工组", taskRefs: ["task-blue-2"], status: "pending_review" }
], [
  { id: "task-organization-ai-new", name: "新草案", taskRefs: ["task-blue-1"], status: "pending_review" },
  { id: "task-organization-ai-duplicate", name: "重复", taskRefs: ["task-red-1"], status: "pending_review" }
]);
assert(!merged.some((item) => item.id === "task-organization-ai-old"));
assert(merged.some((item) => item.id === "task-organization-ai-confirmed"));
assert(merged.some((item) => item.id === "manual-group"));
assert(!merged.some((item) => item.id === "task-organization-ai-duplicate"));

const html = renderOv1b({ forceMission: { tasks }, ov1b: normalized, ov1bStorage: {} });
assert(html.includes('class="sm-top ov1b-top"') && html.includes('class="sm-toolbar"'), "OV1b must use the compact state-machine header");
assert(html.includes("任务组织画布") && html.includes("现有任务"));
assert(!html.includes("ov1b-review-dock") && html.includes("data-action=\"ov1b-move-task\""), "Review must not open a separate right dock");
assert(html.includes("ov1b-canvas-viewport") && html.includes("ov1b-group-node") && html.includes("ov1b-canvas-task-node"), "OV1b must render a pannable visual organization canvas");
assert(html.includes('data-ov1b-zoom="out"') && html.includes('data-ov1b-zoom="in"') && html.includes('data-ov1b-zoom="fit"'), "Canvas must expose zoom controls");
assert(!html.includes("母任务") && !html.includes("子任务") && !html.includes("ov1b-parent-node"));

const [main, controller, server, toolbox] = await Promise.all([
  readFile(new URL("../design-studio/src/main.js", import.meta.url), "utf8"),
  readFile(new URL("../design-studio/src/dodafProductController.js", import.meta.url), "utf8"),
  readFile(new URL("../server/openaiClient.mjs", import.meta.url), "utf8"),
  readFile(new URL("../design-studio/src/subflowToolbox.js", import.meta.url), "utf8")
]);
assert(main.includes("正在整理任务") && controller.includes('outputSchema: "TaskOrganizationDraft"'));
assert(server.includes('TaskOrganizationDraft: "task-organization"') && server.includes("不得新增、拆分、改写或复制任务"));
assert(toolbox.includes("任务分解工具箱") && toolbox.includes("AI 生成任务分解") && toolbox.includes("新增任务组"));
assert(main.includes('action === "generate-task-decomposition"') && main.includes('pregenerateOv1bFromTasks({ silent: false, force: true })'), "Task decomposition must be generated from the toolbox action");

console.log("Task AI chain acceptance passed: semantic grouping, reusable generation, zoomable canvas, and toolbox review.");
