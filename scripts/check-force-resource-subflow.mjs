import assert from "node:assert/strict";
import { createOpenAiClient, resolveGenerationTemperature } from "../server/openaiClient.mjs";
import { generateMockOutput } from "../shared/generator.js";
import { buildOv2Model, buildOv2ForceFingerprint, applyResourceFlowDraft } from "../design-studio/src/ov2Builder.js";
import { buildOv3Model } from "../design-studio/src/ov3Builder.js";
import { buildResourceFlowAnalysis } from "../design-studio/src/dodafProductController.js";
import { renderForceResourceSubflowBar } from "../design-studio/src/forceResourceSubflowNav.js";

console.log("Starting check-force-resource-subflow...");

// 1. Verify AI Prompt catalog registration for OV-2
const openaiClient = createOpenAiClient({
  getAiServiceConfig: () => ({ model: "mock", baseUrl: "http://localhost" }),
  getAiApiKey: () => "mock",
  getAiPromptOverrides: () => ({})
});
const prompts = openaiClient.listPromptDefinitions();
const ov2Prompt = prompts.find((p) => p.id === "ai.generate.ov2");
assert(ov2Prompt, "ai.generate.ov2 must be registered in Prompt catalog");
assert.equal(ov2Prompt.name, "作战资源流");
assert.equal(resolveGenerationTemperature("ResourceFlowDraft"), 0.1, "ResourceFlowDraft temperature must be 0.1");
assert((ov2Prompt.content || ov2Prompt.defaultContent).includes("作战资源流要求"), "Template must contain resource flow rules");
assert(ov2Prompt.variables?.length >= 2, "Must declare dynamic variables");
console.log("✓ AI Prompt catalog definition verified");

// 2. Verify generator fallback for ResourceFlowDraft
const mockAnalysis = {
  forces: [
    { id: "force-blue-cmd", name: "联合指挥中心", role: "command", taskRefs: ["task-1"] },
    { id: "force-blue-ew", name: "电子战大队", role: "maneuver", taskRefs: ["task-2"] }
  ],
  combatForces: [],
  ov4Roles: [
    { id: "force-blue-cmd", label: "联合指挥中心" },
    { id: "force-blue-ew", label: "电子战大队" }
  ],
  ov4Relations: [
    { fromRoleId: "force-blue-cmd", toRoleId: "force-blue-ew", flowType: "控制流", relationshipType: "command" }
  ],
  operationalTasks: [
    { id: "task-1", name: "指挥控制任务" },
    { id: "task-2", name: "电磁压制任务" }
  ]
};
const mockOutput = generateMockOutput({
  workflow: { id: "ov2", outputSchema: "ResourceFlowDraft" },
  analysis: mockAnalysis,
  evidence: []
});
const mockResult = mockOutput.result;
assert(Array.isArray(mockResult.exchanges), "Mock result must have exchanges");
assert(mockResult.exchanges.length > 0, "Mock exchanges must not be empty");
assert(mockResult.exchanges[0].sourceNodeId, "Exchange must have sourceNodeId");
assert(mockResult.exchanges[0].targetNodeId, "Exchange must have targetNodeId");
assert(mockResult.exchanges[0].output, "Exchange must have output contract");
assert(mockResult.exchanges[0].input, "Exchange must have input contract");
console.log("✓ ResourceFlowDraft fallback generator verified");

// 3. Verify OV-2 builder taking OV-4 relations
const forceMission = {
  forces: [
    { id: "force-cmd", name: "指挥节点", role: "command", taskRefs: ["t-1"] },
    { id: "force-radar", name: "预警雷达站", role: "sense", taskRefs: ["t-2"] }
  ],
  combatForces: [],
  tasks: [
    { id: "t-1", name: "指控" },
    { id: "t-2", name: "预警" }
  ]
};
const ov4 = {
  roles: [
    { id: "force-cmd", label: "指挥节点", taskRefs: ["t-1"] },
    { id: "force-radar", label: "预警雷达站", taskRefs: ["t-2"] }
  ],
  relations: [
    {
      id: "rel-1",
      sourceRoleId: "force-radar",
      targetRoleId: "force-cmd",
      relationshipType: "information",
      relationshipCategory: "information",
      flowType: "信息流",
      note: "雷达空情向指挥节点上报"
    }
  ]
};

const ov2Model = buildOv2Model({ forceMission, ov4 });
assert.equal(ov2Model.nodes.length, 2, "OV-2 must have 2 nodes");
assert.equal(ov2Model.exchanges.length, 1, "OV-2 must derive 1 exchange from OV-4 relations");
assert.equal(ov2Model.exchanges[0].sourceNodeId, "force-radar");
assert.equal(ov2Model.exchanges[0].targetNodeId, "force-cmd");
assert.equal(ov2Model.exchanges[0].flowType, "信息流");
console.log("✓ OV-2 builder OV-4 relationship derivation verified");

// 4. Verify fingerprint stability
const fp1 = buildOv2ForceFingerprint(forceMission, ov4);
const fp2 = buildOv2ForceFingerprint(forceMission, ov4);
assert.equal(fp1, fp2, "Fingerprint must be deterministic");
assert(fp1.startsWith("ov2-force:"), "Fingerprint prefix must be ov2-force:");
console.log("✓ OV-2 force/ov4 fingerprint verified");

// 5. Verify applyResourceFlowDraft
const draft = {
  exchanges: [
    {
      sourceNodeId: "force-cmd",
      targetNodeId: "force-radar",
      flowType: "控制流",
      label: "开机管控指令",
      output: "指挥所输出：开机管控指令",
      input: "雷达站接收：开机管控指令"
    }
  ]
};
const appliedOv2 = applyResourceFlowDraft({ forceMission, ov4 }, draft, { source: "ai", fingerprint: fp1 });
assert.equal(appliedOv2.exchanges.length, 1, "Applied OV-2 must contain draft exchange");
assert.equal(appliedOv2.exchanges[0].flowType, "控制流");
console.log("✓ applyResourceFlowDraft verified");

// 6. Verify OV-3 controlled projection from OV-2
const ov3Model = buildOv3Model({ ov2: appliedOv2 });
assert.equal(ov3Model.exchanges.length, 1, "OV-3 must project 1 exchange from OV-2");
assert.equal(ov3Model.exchanges[0].compatibility, "ready", "Matching contracts must yield ready compatibility");
console.log("✓ OV-3 controlled projection verified");

// 7. Verify buildResourceFlowAnalysis helper
const state = { forceMission, ov4, brief: { researchIntent: "验证测试" } };
const analysis = buildResourceFlowAnalysis(state);
assert.equal(analysis.forces.length, 2);
assert.equal(analysis.ov4Roles.length, 2);
assert.equal(analysis.ov4Relations.length, 1);
assert.equal(analysis.flowTypes.length, 3);
console.log("✓ buildResourceFlowAnalysis payload structure verified");

// 8. Verify subflow pipeline bar rendering
const mainlineHtml = renderForceResourceSubflowBar(state, "force-mission");
assert(mainlineHtml.includes("subflow-pipeline-bar is-mainline"), "Mainline must render mainline bar");
assert(mainlineHtml.includes("组织关系 OV-4"), "Must mention OV-4");
assert(mainlineHtml.includes("资源流 OV-2"), "Must mention OV-2");
assert(mainlineHtml.includes("资源流矩阵 OV-3"), "Must mention OV-3");

const subflowOv2Html = renderForceResourceSubflowBar({ ...state, ov2: appliedOv2, ov3: ov3Model }, "ov2");
assert(subflowOv2Html.includes("in-subflow"), "Must render in-subflow bar");
assert(subflowOv2Html.includes("save-and-advance-ov3"), "Must have advance to OV-3 action");
assert(subflowOv2Html.includes("return-force-mission"), "Must have return to force-mission action");
console.log("✓ Subflow pipeline bar rendering verified");

console.log("All check-force-resource-subflow assertions passed successfully!");
