// @ts-check
/**
 * scripts/check-refactor-wiring.mjs
 * 
 * 防线测试：
 * 1. 验证 119 个已知用户动作（原 old-main.js 中的 action === "..."）在当前 bindings 中均有承接；
 * 2. 验证 bindings 解构的 ctx 属性均由 main.js 的 get*Ctx() 完整提供（无悬空属性）；
 * 3. 验证 bindings 中的 *Controller.*() 调用方法均为真实导出方法，杜绝捏造不存在的方法（防范 seedOv1FromPlanning 再现）。
 */
import fs from 'node:fs';
import path from 'node:path';

let errors = [];

// 1. 119 Actions Coverage
const EXPECTED_ACTIONS = [
  "add-activity",
  "advance-related-workflow",
  "advance-to-concept-map",
  "advance-workflow",
  "advance-workflow-step",
  "advance-workflow-step-ai",
  "advance-workflow-step-direct",
  "advance-workflow-step-regenerate",
  "advance-workflow-step-skip",
  "apply-mapping-quality",
  "apply-ov1-candidate",
  "attach-ov1-sources",
  "attach-structure-review-collaboration",
  "clear-collaboration-review-draft",
  "clear-ov2-node-filter",
  "close-context-panel",
  "close-custom-direction",
  "close-force-mission-chat",
  "close-ov1-dialog",
  "close-ov1-panel",
  "close-ov1b-dock",
  "close-phase-action-chat",
  "close-provenance-popover",
  "close-rule-library-chat",
  "close-sequence-chat",
  "close-state-machine-chat",
  "complete-workflow-stage",
  "confirm-and-advance-to-concept-map",
  "confirm-ov1",
  "confirm-scenario-validation",
  "continue-to-ov5",
  "discard-ov1-candidate",
  "export-scenario-geojson",
  "export-structure-review-json",
  "export-structure-review-markdown",
  "force-dismiss-busy-overlay",
  "generate-ov5-from-ov1",
  "generate-task-decomposition",
  "go-ov2",
  "go-to-related-model",
  "minimize-busy-overlay",
  "open-account-management",
  "open-ai-config",
  "open-ai-prompts",
  "open-collaboration",
  "open-context-panel",
  "open-custom-direction",
  "open-force-mission-chat",
  "open-ov1-concept",
  "open-ov1-relations",
  "open-phase-action-chat",
  "open-rule-library-chat",
  "open-sequence-chat",
  "open-state-machine-chat",
  "open-structure-review",
  "open-subflow-ai",
  "ov2-add-exchange",
  "ov2-close-editor",
  "ov2-delete-exchange",
  "ov2-filter-flow",
  "ov2-reverse-exchange",
  "ov2-select-node",
  "ov2-set-view-mode",
  "ov2-toggle-help",
  "ov2-toggle-sidebar",
  "ov3-clear-filter",
  "ov3-close-drawer",
  "ov3-filter-compat",
  "ov3-filter-flow",
  "ov3-filter-group",
  "ov3-jump-to-ov2",
  "ov3-scroll-matrix",
  "ov3-set-scope",
  "ov3-set-view-mode",
  "ov3-toggle-help",
  "ov6a-analyze-force-rules",
  "ov6a-analyze-task-force-rules",
  "ov6b-generate-force-machines",
  "ov6b-generate-task-force-machines",
  "ov6b-generate-task-machines",
  "ov6c-generate-force-sequences",
  "ov6c-generate-phase-sequences",
  "ov6c-generate-task-force-sequences",
  "ov6c-generate-task-sequences",
  "reset-project-content",
  "retry-project-entry",
  "return-force-mission",
  "save-and-advance-ov2",
  "save-and-advance-ov3",
  "save-and-advance-ov4",
  "save-report-version",
  "seed-ov1-from-planning",
  "select-phase-action-focus",
  "switch-ov1-view-mode",
  "switch-scenario-view-mode",
  "toggle-force-mission-chat",
  "toggle-ov1-panel",
  "toggle-ov1-sidebar",
  "toggle-ov1-tools",
  "toggle-ov1b-add",
  "toggle-ov1b-edit",
  "toggle-phase-action-chat",
  "toggle-project-create",
  "toggle-project-manager",
  "toggle-rule-library-chat",
  "toggle-sequence-chat",
  "toggle-state-machine-chat",
  "toggle-subflow-toolbox",
  "toggle-workflow-gate",
  "toggle-workflow-test-mode",
  "view-ov6a",
  "view-ov6b",
  "view-ov6c",
  "workflow-gate-quick-apply-all-rules",
  "workflow-gate-quick-confirm-concept-map",
  "workflow-gate-quick-confirm-force-mission",
  "workflow-gate-quick-confirm-operational-tasks",
  "workflow-gate-quick-confirm-ov1",
  "workflow-gate-quick-confirm-phase-action"
];

const bindingDir = 'design-studio/src/app/bindings';
const bindingFiles = fs.readdirSync(bindingDir).map(f => path.join(bindingDir, f));
const currentActionMatches = new Set();
for (const f of [...bindingFiles, 'design-studio/src/main.js']) {
  const content = fs.readFileSync(f, 'utf8');
  for (const m of content.matchAll(/action === ["']([^"']+)["']/g)) {
    currentActionMatches.add(m[1]);
  }
}

for (const act of EXPECTED_ACTIONS) {
  if (!currentActionMatches.has(act)) {
    errors.push(`Missing action branch: "${act}" is not handled in any binding`);
  }
}

// 2. Controller Methods Existence
const controllerFiles = fs.readdirSync('design-studio/src/app')
  .filter(f => f.endsWith('Controller.js'))
  .map(f => path.join('design-studio/src/app', f));

const controllerMethods = {};
for (const f of controllerFiles) {
  const name = path.basename(f, '.js');
  const content = fs.readFileSync(f, 'utf8');
  const methods = new Set();
  
  for (const m of content.matchAll(/export\s+function\s+([A-Za-z0-9_]+)/g)) {
    methods.add(m[1]);
  }
  for (const m of content.matchAll(/export\s+const\s+([A-Za-z0-9_]+)/g)) {
    methods.add(m[1]);
  }
  for (const m of content.matchAll(/([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{/g)) {
    methods.add(m[1]);
  }
  for (const m of content.matchAll(/([A-Za-z0-9_]+)\s*:\s*(?:async\s*)?\(/g)) {
    methods.add(m[1]);
  }
  for (const m of content.matchAll(/([A-Za-z0-9_]+)\s*:\s*(?:async\s*)?function/g)) {
    methods.add(m[1]);
  }
  controllerMethods[name] = methods;
}

for (const f of bindingFiles) {
  const content = fs.readFileSync(f, 'utf8');
  for (const m of content.matchAll(/([A-Za-z0-9_]+Controller)\.([A-Za-z0-9_]+)\s*\(/g)) {
    const ctrlName = m[1];
    const methName = m[2];
    const known = controllerMethods[ctrlName];
    if (known && !known.has(methName)) {
      errors.push(`Invalid controller method call: ${ctrlName}.${methName}() in ${f} does not exist in ${ctrlName}.js`);
    }
  }
}

// 3. Ctx Completeness Check
const mainJs = fs.readFileSync('design-studio/src/main.js', 'utf8');
function extractCtxKeys(funcName) {
  const idx = mainJs.indexOf(`function ${funcName}()`);
  if (idx === -1) return new Set();
  const sub = mainJs.slice(idx);
  const retIdx = sub.indexOf('return {');
  if (retIdx === -1) return new Set();
  const endIdx = sub.indexOf('};', retIdx);
  const block = sub.slice(retIdx + 8, endIdx);
  const keys = new Set();
  for (const line of block.split('\n')) {
    const trimmed = line.trim().replace(/,$/, '');
    if (!trimmed || trimmed.startsWith('//')) continue;
    const key = trimmed.split(/[:\s]/)[0];
    if (key) keys.add(key);
  }
  return keys;
}

const dodafCtxKeys = extractCtxKeys('getDodafCtx');
const reportCtxKeys = extractCtxKeys('getReportCtx');

function checkDestructuredKeys(filePath, ctxKeys, label) {
  const content = fs.readFileSync(filePath, 'utf8');
  const destructureRegex = /const\s*\{([^}]+)\}\s*=\s*ctx;/g;
  let match;
  while ((match = destructureRegex.exec(content)) !== null) {
    const props = match[1].split(',').map(p => {
      const parts = p.trim().split(':');
      return parts[0].trim();
    }).filter(Boolean);
    for (const prop of props) {
      if (!ctxKeys.has(prop)) {
        errors.push(`Missing ctx property: "${prop}" destructured in ${filePath} is missing from ${label} in main.js`);
      }
    }
  }
}

checkDestructuredKeys('design-studio/src/app/bindings/dodafBindings.js', dodafCtxKeys, 'getDodafCtx');
checkDestructuredKeys('design-studio/src/app/bindings/reportBindings.js', reportCtxKeys, 'getReportCtx');

if (errors.length > 0) {
  console.error(`Refactor wiring checks failed with ${errors.length} error(s):`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
} else {
  console.log(`PASS: Refactor wiring verification passed cleanly!`);
  console.log(`  - ${EXPECTED_ACTIONS.length}/${EXPECTED_ACTIONS.length} actions mapped`);
  console.log(`  - Controller methods verified`);
  console.log(`  - Ctx properties completeness verified`);
}
