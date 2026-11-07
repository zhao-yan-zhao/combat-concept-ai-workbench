import { project } from "../data.js";
import { saveModelSnapshot, snapshotContextFromState } from "../modelSnapshotStore.js";
import { restoreModelSnapshot } from "../modelSnapshotRestore.js";
import { saveOv1Model } from "../ov1Store.js";

/**
 * 统一事务包装器：在执行任何整体覆盖或批量修改模型前保存快照恢复点并同步服务端，
 * 若 mutate 抛出异常则自动回滚至该恢复点，成功时将恢复点推入 undoStack。
 *
 * @param {object} ctx 上下文环境
 * @param {{ label: string, source: string }} meta 事务元数据（显示标签及来源标记）
 * @param {Function} mutate 变更操作函数
 * @returns {Promise<boolean>}
 */
export async function applyWithRecoveryPoint(ctx, { label, source }, mutate) {
  const {
    state,
    render,
    showToast,
    projectModelSnapshotSyncController
  } = ctx;

  if (!state || typeof render !== "function" || typeof showToast !== "function" || !projectModelSnapshotSyncController) {
    throw new Error("[recoveryTransaction] 必须注入完整上下文依赖 (state, render, showToast, projectModelSnapshotSyncController)");
  }

  // 1) 保存本地模型快照并取得恢复点
  state.modelSnapshots = saveModelSnapshot(snapshotContextFromState(state, project), state.modelSnapshots);
  const recoveryPoint = state.modelSnapshots[0];
  render();

  // 2) 同步到服务端；失败时提示并终止执行 mutate
  const saved = await projectModelSnapshotSyncController.save(recoveryPoint, { source: source || "recovery-transaction" });
  if (!saved) {
    showToast(`恢复点未能同步到服务端，操作「${label}」已取消。`);
    return false;
  }

  // 3) 执行变更；抛错时用 restoreModelSnapshot 回滚到该 recoveryPoint
  try {
    const result = await mutate();
    if (result === false) {
      return false;
    }

    // 4) 记录 undoStack，最多保留 20 条
    if (!Array.isArray(state.undoStack)) {
      state.undoStack = [];
    }
    state.undoStack.unshift({
      label,
      snapshotId: recoveryPoint.id,
      at: new Date().toISOString()
    });
    if (state.undoStack.length > 20) {
      state.undoStack.length = 20;
    }

    render();
    return true;
  } catch (error) {
    console.error(`[recoveryTransaction] 「${label}」执行失败，正在回滚至恢复点:`, error);
    try {
      const restored = restoreModelSnapshot(recoveryPoint, { projectId: state.activeProjectId || "default" });
      state.direction = restored.direction || state.direction;
      state.brief = restored.brief;
      if (restored.inspiration) state.inspiration = restored.inspiration;
      state.ov1 = saveOv1Model(restored.ov1);
      state.ov5 = restored.ov5;
      state.ooda = restored.ooda;
      state.scenario = restored.scenario;
      state.validationResult = restored.validationResult;
      for (const key of ["ov1b", "ov1c", "ov2", "ov3", "ov4", "ov5a", "ov6a", "ov6b", "ov6c", "ov7", "architecture"]) {
        state[key] = restored[key] ?? null;
      }
    } catch (restoreErr) {
      console.error("[recoveryTransaction] 回滚模型快照失败，尝试直接使用快照模型数据进行回退:", restoreErr);
      if (recoveryPoint.model) {
        state.direction = recoveryPoint.direction || state.direction;
        if (recoveryPoint.model.brief) state.brief = JSON.parse(JSON.stringify(recoveryPoint.model.brief));
        if (recoveryPoint.model.ov1) state.ov1 = JSON.parse(JSON.stringify(recoveryPoint.model.ov1));
        if (recoveryPoint.model.ov5) state.ov5 = JSON.parse(JSON.stringify(recoveryPoint.model.ov5));
        if (recoveryPoint.model.ooda) state.ooda = JSON.parse(JSON.stringify(recoveryPoint.model.ooda));
        if (recoveryPoint.model.scenario) state.scenario = JSON.parse(JSON.stringify(recoveryPoint.model.scenario));
      }
    }
    showToast(`操作「${label}」执行失败：${error.message || "未知错误"}，已自动回滚`);
    render();
    return false;
  }
}
