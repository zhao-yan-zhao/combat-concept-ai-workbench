/**
 * wargameClient.js
 * 前端推演导调与裁决建议客户端
 */
import { generateLocalAdjudicationAdvice } from "./wargameTurnStore.js";

export async function requestWargameAdjudication(input) {
  try {
    const response = await fetch("/api/simulation/wargame-adjudication", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error(`导调服务返回 ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    // 离线或服务异常时优雅降级为本地规则推导
    const fallback = generateLocalAdjudicationAdvice(input?.turn);
    return {
      ...fallback,
      mode: "local-fallback",
      error: error.message
    };
  }
}
