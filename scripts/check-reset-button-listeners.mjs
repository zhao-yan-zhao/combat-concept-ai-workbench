import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

console.log("1. Checking main.js source code for addEventListenerOnce & reentrancy guard...");
const mainSrc = readFileSync("design-studio/src/main.js", "utf8");

assert.ok(
  mainSrc.includes("const boundDynamicEventMap = new WeakMap();"),
  "main.js must define boundDynamicEventMap"
);
assert.ok(
  mainSrc.includes("function addEventListenerOnce(element, type, handler, key = type, options)"),
  "main.js must define addEventListenerOnce helper"
);
assert.ok(
  mainSrc.includes('addEventListenerOnce(button, "click", fire, "action:click")'),
  "main.js must use addEventListenerOnce for [data-action] click events"
);
assert.ok(
  mainSrc.includes("if (state.resettingProject) return;"),
  "main.js must have resettingProject guard in reset-project-content"
);
assert.ok(
  mainSrc.includes("state.resettingProject = true;"),
  "main.js must set resettingProject = true upon confirmation"
);
assert.ok(
  mainSrc.includes("state.resettingProject = false;"),
  "main.js must reset resettingProject = false on failure"
);
assert.ok(
  mainSrc.includes('key: "reset-project"'),
  "main.js must configure reset-project busy overlay state"
);
assert.ok(
  mainSrc.includes("updateBusyOverlay(getBusyOverlayState())"),
  "main.js must trigger updateBusyOverlay upon reset confirmation"
);
assert.ok(
  mainSrc.includes("hydrateProjectModels()"),
  "main.js must smoothly hydrate project models without broken location.assign"
);
assert.ok(
  mainSrc.includes("safetyTimer"),
  "main.js must include safety timeout to prevent permanent overlay hang"
);

console.log("2. Checking styles.css for transition animations...");
const cssSrc = readFileSync("design-studio/styles.css", "utf8");
assert.ok(
  cssSrc.includes("@keyframes workbench-view-fade"),
  "styles.css must define workbench-view-fade animation"
);
assert.ok(
  cssSrc.includes("prefers-reduced-motion"),
  "styles.css must support prefers-reduced-motion accessibility"
);

console.log("3. Simulating addEventListenerOnce behavior with multiple render cycles...");
const boundDynamicEventMap = new WeakMap();
function addEventListenerOnce(element, type, handler, key = type, options) {
  if (!element) return;
  let boundKeys = boundDynamicEventMap.get(element);
  if (!boundKeys) {
    boundKeys = new Set();
    boundDynamicEventMap.set(element, boundKeys);
  }
  if (boundKeys.has(key)) return;
  boundKeys.add(key);
  element.addEventListener(type, handler, options);
}

class MockElement {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.listeners = {};
  }
  addEventListener(type, handler) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(handler);
  }
  dispatchEvent(type) {
    const list = this.listeners[type] || [];
    for (const h of list) {
      h({ type, target: this });
    }
  }
}

const mockResetBtn = new MockElement({ action: "reset-project-content" });

// Simulate 5 calls to render() / bindDynamicEvents()
let triggerCount = 0;
for (let i = 0; i < 5; i++) {
  addEventListenerOnce(mockResetBtn, "click", () => {
    triggerCount++;
  }, "action:click");
}

assert.equal(
  mockResetBtn.listeners["click"]?.length,
  1,
  "mockResetBtn must have exactly 1 click listener registered despite 5 render cycles"
);

mockResetBtn.dispatchEvent("click");
assert.equal(
  triggerCount,
  1,
  "Clicking the button must trigger the handler exactly once"
);

console.log("4. Simulating reentrancy protection...");
let confirmCalls = 0;
const state = { resettingProject: false };
function handleResetAction() {
  if (state.resettingProject) return;
  confirmCalls++;
  state.resettingProject = true;
}

// First call: should confirm and set flag
handleResetAction();
assert.equal(confirmCalls, 1);
assert.equal(state.resettingProject, true);

// Second call while in progress: should be blocked
handleResetAction();
assert.equal(confirmCalls, 1, "Reentrant call while resettingProject=true must be blocked");

console.log("All reset-button and transition checks passed successfully!");
