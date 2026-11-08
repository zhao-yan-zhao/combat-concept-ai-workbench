import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { computeLineDiff, renderUnifiedDiffHtml } from "../shared/textDiff.js";
import {
  loadAiPromptData,
  loadAiPromptOverrides,
  rollbackAiPromptVersion,
  saveAiPromptOverrides
} from "../server/aiPromptConfig.mjs";
import { renderAiPromptPanel } from "../design-studio/src/aiPromptView.js";

console.log("=== 1. shared/textDiff.js 行级差异算法测试 ===");

// 1.1 相同文本
{
  const res = computeLineDiff("line 1\nline 2", "line 1\nline 2");
  assert.equal(res.stats.isIdentical, true);
  assert.equal(res.stats.added, 0);
  assert.equal(res.stats.removed, 0);
  assert.equal(res.stats.unchanged, 2);
  const html = renderUnifiedDiffHtml(res);
  assert.match(html, /完全相同/);
}

// 1.2 新增、修改与删除行
{
  const oldText = "这是第一行\n这是将被删除的一行\n这是第三行";
  const newText = "这是第一行\n这是修改后新增的一行\n这是第三行\n这是末尾追加行";
  const res = computeLineDiff(oldText, newText);
  assert.equal(res.stats.isIdentical, false);
  assert.equal(res.stats.added, 2);
  assert.equal(res.stats.removed, 1);
  assert.equal(res.stats.unchanged, 2);

  const html = renderUnifiedDiffHtml(res);
  assert.match(html, /prompt-diff-container/);
  assert.match(html, /\+2 行新增/);
  assert.match(html, /-1 行删除/);
  assert.match(html, /这是修改后新增的一行/);
  assert.match(html, /这是将被删除的一行/);
  assert.match(html, /line-added/);
  assert.match(html, /line-removed/);
}

// 1.3 特殊字符 XSS 安全转义
{
  const res = computeLineDiff("<script>alert(1)</script>", "<b>safe</b>");
  const html = renderUnifiedDiffHtml(res);
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;b&gt;safe&lt;\/b&gt;/);
}
console.log("✓ textDiff 差异比对与 HTML 渲染断言全部通过");

console.log("=== 2. server/aiPromptConfig.mjs 版本历史与回退测试 ===");
const tempDir = await mkdtemp(join(tmpdir(), "m5-prompt-test-"));
const configPath = join(tempDir, "ai-prompts.json");

try {
  // 2.1 初始无文件加载
  const emptyData = await loadAiPromptData({ configPath });
  assert.deepEqual(emptyData.overrides, {});
  assert.deepEqual(emptyData.history, {});
  assert.deepEqual(await loadAiPromptOverrides({ configPath }), {});

  // 2.2 首次保存生成版本 v1
  const overrides1 = await saveAiPromptOverrides({
    configPath,
    value: { overrides: { "ai.generate.concept-brief": "简报初始提示词 v1" } },
    note: "创建初始版本"
  });
  assert.equal(overrides1["ai.generate.concept-brief"], "简报初始提示词 v1");
  const data1 = await loadAiPromptData({ configPath });
  assert.equal(data1.history["ai.generate.concept-brief"]?.length, 1);
  assert.equal(data1.history["ai.generate.concept-brief"][0].version, 1);
  assert.equal(data1.history["ai.generate.concept-brief"][0].content, "简报初始提示词 v1");
  assert.match(data1.history["ai.generate.concept-brief"][0].note, /创建初始版本/);

  // 2.3 内容无变化时不产生冗余版本
  await saveAiPromptOverrides({
    configPath,
    value: { overrides: { "ai.generate.concept-brief": "简报初始提示词 v1" } }
  });
  const dataNoChange = await loadAiPromptData({ configPath });
  assert.equal(dataNoChange.history["ai.generate.concept-brief"]?.length, 1, "内容未改变时不应增加历史版本");

  // 2.4 保存修订版本 v2
  await saveAiPromptOverrides({
    configPath,
    value: { overrides: { "ai.generate.concept-brief": "简报修订提示词 v2" } },
    note: "修改核心约束"
  });
  const data2 = await loadAiPromptData({ configPath });
  assert.equal(data2.history["ai.generate.concept-brief"]?.length, 2);
  assert.equal(data2.history["ai.generate.concept-brief"][0].version, 2);
  assert.equal(data2.history["ai.generate.concept-brief"][0].content, "简报修订提示词 v2");
  assert.equal(data2.history["ai.generate.concept-brief"][1].version, 1);

  // 2.5 保持老接口 loadAiPromptOverrides 的向后兼容性
  const legacyOverrides = await loadAiPromptOverrides({ configPath });
  assert.equal(legacyOverrides["ai.generate.concept-brief"], "简报修订提示词 v2");

  // 2.6 执行回退操作：从 v2 回退至 v1
  const v1Record = data2.history["ai.generate.concept-brief"][1];
  const rollbackResult = await rollbackAiPromptVersion({
    configPath,
    promptId: "ai.generate.concept-brief",
    versionId: v1Record.versionId
  });
  assert.equal(rollbackResult.overrides["ai.generate.concept-brief"], "简报初始提示词 v1");
  assert.equal(rollbackResult.history["ai.generate.concept-brief"]?.length, 3);
  assert.equal(rollbackResult.history["ai.generate.concept-brief"][0].version, 3);
  assert.equal(rollbackResult.history["ai.generate.concept-brief"][0].content, "简报初始提示词 v1");
  assert.match(rollbackResult.history["ai.generate.concept-brief"][0].note, /回退到版本 v1/);

  // 2.7 错误回退参数防御测试
  await assert.rejects(
    async () => rollbackAiPromptVersion({ configPath, promptId: "not-exist", versionId: "v999" }),
    /未找到提示词/
  );
  await assert.rejects(
    async () => rollbackAiPromptVersion({ configPath, promptId: "", versionId: "" }),
    /缺少 promptId 或 versionId 参数/
  );

  console.log("✓ aiPromptConfig 版本归档、防冗余与安全回退逻辑全部通过");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("=== 3. design-studio 前端视图与客户端集成测试 ===");
{
  const mockCatalog = {
    configurationWrite: { enabled: true },
    items: [
      {
        id: "ai.generate.concept-brief",
        name: "概念简报",
        group: "研究简报",
        description: "生成简报草案",
        customized: true,
        content: "当前最新提示词内容",
        variables: ["analysis", "evidence"],
        history: [
          {
            versionId: "v2_1731000002",
            version: 2,
            timestamp: "2026-11-08T18:00:00.000Z",
            content: "当前最新提示词内容",
            charCount: 10,
            note: "修订版本 v2"
          },
          {
            versionId: "v1_1731000001",
            version: 1,
            timestamp: "2026-11-08T17:00:00.000Z",
            content: "旧版历史提示词内容",
            charCount: 9,
            note: "初始版本 v1"
          }
        ]
      }
    ]
  };

  // 3.1 渲染包含历史版本列表的面板
  const normalHtml = renderAiPromptPanel({
    open: true,
    catalog: mockCatalog,
    selectedId: "ai.generate.concept-brief",
    saving: false,
    drafts: {}
  });

  assert.match(normalHtml, /ai-prompt-history-section/);
  assert.match(normalHtml, /共 2 个历史版本/);
  assert.match(normalHtml, /data-action="toggle-ai-prompt-diff"/);
  assert.match(normalHtml, /data-action="rollback-ai-prompt-version"/);
  assert.match(normalHtml, /data-version-id="v2_1731000002"/);
  assert.match(normalHtml, /data-version-id="v1_1731000001"/);
  assert.match(normalHtml, /回退到此版本/);
  assert.match(normalHtml, /查看差异/);

  // 3.2 展开差异预览
  const diffHtml = renderAiPromptPanel({
    open: true,
    catalog: mockCatalog,
    selectedId: "ai.generate.concept-brief",
    saving: false,
    drafts: {},
    viewingDiffVersionId: "v1_1731000001"
  });

  assert.match(diffHtml, /history-diff-viewer/);
  assert.match(diffHtml, /prompt-diff-container/);
  assert.match(diffHtml, /收起差异/);
  assert.match(diffHtml, /旧版历史提示词内容/);
  assert.match(diffHtml, /当前最新提示词内容/);

  // 3.3 无历史时的空状态处理
  const emptyCatalog = {
    configurationWrite: { enabled: true },
    items: [{ id: "ai.empty", name: "无历史提示词", customized: false, content: "默认" }]
  };
  const emptyHtml = renderAiPromptPanel({
    open: true,
    catalog: emptyCatalog,
    selectedId: "ai.empty"
  });
  assert.match(emptyHtml, /暂无历史版本/);
  assert.match(emptyHtml, /共 0 个历史版本/);

  console.log("✓ 前端视图版本历史、差异展开与空状态断言全部通过");
}

console.log("=== 4. 静态接口与控制器文件契约核验 ===");
{
  const [clientJs, controllerJs, requestHandlerMjs] = await Promise.all([
    readFile(new URL("../design-studio/src/aiPromptClient.js", import.meta.url), "utf8"),
    readFile(new URL("../design-studio/src/aiPromptController.js", import.meta.url), "utf8"),
    readFile(new URL("../server/createRequestHandler.mjs", import.meta.url), "utf8")
  ]);

  assert.match(clientJs, /export async function rollbackAiPrompt/);
  assert.match(clientJs, /\/api\/ai-prompts\/rollback/);

  assert.match(controllerJs, /action === "toggle-ai-prompt-diff"/);
  assert.match(controllerJs, /action === "rollback-ai-prompt-version"/);
  assert.match(controllerJs, /rollbackAiPrompt\(promptId, versionId\)/);

  assert.match(requestHandlerMjs, /url\.pathname === "\/api\/ai-prompts\/rollback"/);
  assert.match(requestHandlerMjs, /runtime\.rollbackAiPromptVersion/);

  console.log("✓ 前后端所有契约与接口静态断言全部通过");
}

console.log("\n==============================================");
console.log("All M5-T5.5 AI Prompt History & Diff Checks PASSED!");
console.log("==============================================");
