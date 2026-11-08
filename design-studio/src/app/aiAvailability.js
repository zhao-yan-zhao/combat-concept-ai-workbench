/**
 * AI 服务可用性判断与界面展示助手
 * 满足 T5.4：
 * 1. AI 不可用时，生成按钮显示 "AI 不可用，可手工起草"
 * 2. 提供本地标准模板起草入口
 */

/**
 * 判断当前系统的 AI 服务是否就绪可用
 * @param {object} state
 * @returns {boolean}
 */
export function isAiAvailable(state) {
  if (!state) return true;
  if (state.aiAvailable === false) return false;
  const config = state.aiConfig?.config;
  if (config) {
    if (config.configured === false) return false;
    if (config.mode === "mock-fallback") return false;
  }
  return true;
}

/**
 * 解析生成按钮文案，AI 不可用时自动替换为 "AI 不可用，可手工起草"
 * @param {object} state
 * @param {string} defaultLabel AI 可用时的默认文案
 * @param {string} [busyLabel] 正在生成中的文案
 * @param {boolean} [busy=false] 当前是否正在生成中
 * @returns {string}
 */
export function resolveAiActionLabel(state, defaultLabel, busyLabel = "正在生成…", busy = false) {
  if (busy) return busyLabel;
  if (!isAiAvailable(state)) {
    return "AI 不可用，可手工起草";
  }
  return defaultLabel;
}
