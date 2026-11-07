// @ts-check
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear()
};

import { applyWithRecoveryPoint } from "../design-studio/src/app/recoveryTransaction.js";

console.log("=== 1. 静态扫描：验证 recoveryTransaction 模块规范 ===");
const recoveryTxSource = fs.readFileSync(path.resolve("design-studio/src/app/recoveryTransaction.js"), "utf8");
assert(recoveryTxSource.includes("export async function applyWithRecoveryPoint"), "必须导出 applyWithRecoveryPoint 函数");
assert(recoveryTxSource.includes("saveModelSnapshot"), "必须在事务中调用 saveModelSnapshot");
assert(recoveryTxSource.includes("restoreModelSnapshot"), "必须在抛错时回滚调用 restoreModelSnapshot");
assert(recoveryTxSource.includes("state.undoStack"), "必须维护 state.undoStack");
console.log("✓ recoveryTransaction.js 静态语法与关键逻辑检查通过");

console.log("=== 2. 静态扫描：验证关键覆盖动作使用 applyWithRecoveryPoint 事务包装 ===");
const dodafBindingsSource = fs.readFileSync(path.resolve("design-studio/src/app/bindings/dodafBindings.js"), "utf8");
assert(dodafBindingsSource.includes("applyWithRecoveryPoint(ctx"), "applyOv1CandidateWithRecoveryPoint 必须调用统一事务包装器 applyWithRecoveryPoint");

const mainSource = fs.readFileSync(path.resolve("design-studio/src/main.js"), "utf8");
assert(mainSource.includes("applyWithRecoveryPoint(resetCtx"), "reset-project-content 必须调用统一事务包装器 applyWithRecoveryPoint");
assert(mainSource.includes("applyWithRecoveryPoint(restoreCtx"), "restoreSnapshot 必须调用统一事务包装器 applyWithRecoveryPoint");

const dodafControllerSource = fs.readFileSync(path.resolve("design-studio/src/dodafProductController.js"), "utf8");
assert(dodafControllerSource.includes("applyWithRecoveryPoint(importCtx"), "applyImport 必须调用统一事务包装器 applyWithRecoveryPoint");

console.log("✓ 已验证 apply-ov1-candidate、reset-project-content、restore-model-snapshot、apply-architecture-import 均接入事务包装");

console.log("=== 3. 单元测试与 Mock 回滚验证 ===");
let renderCount = 0;
let toastMessage = "";
let saveCount = 0;

const mockState = {
  activeProjectId: "test-proj",
  direction: "方向A",
  brief: { objective: "原始简报目标", approach: "方法A", assumptions: "假设A", expectedEffects: "效果A", risk: "风险A" },
  ov1: { nodes: [{ id: "node-1", text: "原节点" }] },
  modelSnapshots: [],
  undoStack: []
};

const mockCtx = {
  state: mockState,
  render: () => { renderCount++; },
  showToast: (msg) => { toastMessage = msg; },
  projectModelSnapshotSyncController: {
    save: async (point, meta) => {
      saveCount++;
      return true;
    }
  }
};

// Case 3.1: 成功执行并推入 undoStack
const success = await applyWithRecoveryPoint(mockCtx, { label: "测试修改", source: "test-mutate" }, async () => {
  mockState.brief.objective = "新简报目标";
});

assert.equal(success, true, "正常 mutate 必须返回 true");
assert.equal(mockState.brief.objective, "新简报目标", "状态已被正常修改");
assert.equal(mockState.undoStack.length, 1, "成功后 undoStack 应推入 1 条记录");
assert.equal(mockState.undoStack[0].label, "测试修改");
assert.equal(saveCount, 1, "快照必须同步一次到服务端");
console.log("✓ 成功路径验证通过 (快照创建 + 服务端同步 + undoStack 记录)");

// Case 3.2: mutate 异常自动回滚
const failResult = await applyWithRecoveryPoint(mockCtx, { label: "破坏性操作", source: "test-fail" }, async () => {
  mockState.brief.objective = "被破坏的简报";
  throw new Error("模拟外部生成/保存网络崩溃");
});

assert.equal(failResult, false, "失败路径必须返回 false");
assert.equal(mockState.brief.objective, "新简报目标", "抛出异常时必须自动回滚至 mutate 前的状态！");
assert(toastMessage.includes("已自动回滚"), "必须通过 showToast 告知用户回滚已生效");
assert.equal(mockState.undoStack.length, 1, "失败时不得将该操作计入 undoStack");
console.log("✓ 异常回滚验证通过 (状态精确回退到修改前，toast 正常弹出)");

console.log("\n=== 所有 Recovery Transaction 验证 100% 通过 ===");
