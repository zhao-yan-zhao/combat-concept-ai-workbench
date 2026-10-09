import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderAiPromptPanel } from "../design-studio/src/aiPromptView.js";
import { createAiPromptController } from "../design-studio/src/aiPromptController.js";

// 1. Verify view layout template
const sampleCatalog = {
  items: [
    { id: "test.prompt", name: "测试提示词", group: "测试", content: "默认内容", customized: false, variables: ["var1"] }
  ],
  configurationWrite: { enabled: true }
};

// Case A: Initial render with no draft
const initialHtml = renderAiPromptPanel({
  open: true,
  catalog: sampleCatalog,
  selectedId: "test.prompt",
  saving: false,
  drafts: {}
});

assert.ok(initialHtml.includes('class="ai-prompt-scrollable"'), "Must contain scrollable body");
assert.ok(initialHtml.includes('class="editor-actions ai-prompt-actions"'), "Must contain fixed footer actions bar");
assert.ok(initialHtml.includes('class="primary-btn ai-prompt-save-btn" disabled'), "Save button must be disabled when no modifications exist");
assert.ok(initialHtml.includes('data-action="reset-ai-prompt" disabled'), "Reset button must be disabled when neither customized nor hasDraft");
assert.ok(!initialHtml.includes('ai-prompt-draft-hint'), "Must not show draft hint when no modifications exist");

// Case B: Render with draft modification
const draftHtml = renderAiPromptPanel({
  open: true,
  catalog: sampleCatalog,
  selectedId: "test.prompt",
  saving: false,
  drafts: { "test.prompt": "修改后的新内容" }
});

assert.match(draftHtml, /class="primary-btn ai-prompt-save-btn"\s+title="保存修改后的提示词"/, "Save button must be enabled when draft exists");
assert.ok(!draftHtml.includes('class="primary-btn ai-prompt-save-btn" disabled'), "Save button must not have disabled attribute when draft exists");
assert.match(draftHtml, /data-action="reset-ai-prompt"\s+title="恢复为系统默认提示词"/, "Reset button must be enabled when draft exists");
assert.ok(!draftHtml.includes('data-action="reset-ai-prompt" disabled'), "Reset button must not have disabled attribute when draft exists");
assert.ok(draftHtml.includes('class="ai-prompt-draft-hint"'), "Must display draft hint when draft exists");

// 2. Verify controller contracts and event handlers
const controllerSource = await readFile(new URL("../design-studio/src/aiPromptController.js", import.meta.url), "utf8");
assert.ok(controllerSource.includes("state.aiPromptSelectedId === promptId"), "Must keep selectedId fast bail-out check");
assert.ok(controllerSource.includes("ai-prompt-item.is-active"), "Must keep active class scroll contract");
assert.ok(controllerSource.includes("saveBtn.disabled = !writable || !isDirty"), "Controller must dynamically toggle save button disabled state on input");
assert.ok(controllerSource.includes("event.key.toLowerCase() === \"s\""), "Controller must handle Ctrl+S keyboard shortcut");
assert.ok(controllerSource.includes("window.confirm"), "Reset action must prompt user for confirmation");

// 3. Verify CSS rules
const css = await readFile(new URL("../design-studio/styles.css", import.meta.url), "utf8");
assert.ok(css.includes(".ai-prompt-editor { display: flex; flex-direction: column; min-height: 0; height: 100%; overflow: hidden;"), "Editor must be flex column with overflow hidden");
assert.ok(css.includes(".ai-prompt-scrollable { flex: 1 1 auto; min-height: 0; overflow-y: auto;"), "Scrollable container must have overflow-y auto and flex 1");
assert.ok(css.includes(".ai-prompt-actions {"), "Must define .ai-prompt-actions styling");
assert.ok(!css.includes(".ai-prompt-editor form { display: grid; gap: 13px; height: 100%; }"), "Broken height:100% grid layout on form must be gone");

console.log("All AI prompt UI and controller regression checks passed successfully!");
