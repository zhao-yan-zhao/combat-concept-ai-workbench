import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../design-studio/src/main.js", import.meta.url), "utf8");
const collaboration = await readFile(new URL("../design-studio/src/collaborationController.js", import.meta.url), "utf8");

assert.match(main, /const focusSnapshot = captureViewFocus\(viewRoot\)/);
assert.match(main, /restoreViewFocus\(viewRoot, focusSnapshot\)/);
assert.match(main, /const appFocusSnapshot = captureViewFocus\(document\)/);
assert.match(main, /restoreViewFocus\(document, appFocusSnapshot\)/);
assert.match(main, /active\.closest\("form\[id\]"\)/);
assert.match(main, /target\.focus\(\{ preventScroll: true \}\)/);
assert.match(main, /target\.setSelectionRange/);
assert.match(main, /document\.addEventListener\("compositionstart"/);
assert.match(main, /document\.addEventListener\("compositionend"/);
assert.match(main, /if \(textCompositionActive\)/);
assert.match(main, /requestAnimationFrame\(\(\) => render\(options\)\)/);
assert.match(main, /active\.closest\("#projectCreateForm"\)/);
assert.match(main, /#projectCreateForm input\[name=\\?"title\\?"\]/);
assert.match(collaboration, /focused !== document\.body && !activeForm\.contains\(focused\)/);

console.log("input focus preservation checks passed");
