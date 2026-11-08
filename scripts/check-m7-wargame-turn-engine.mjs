import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  PRESET_EVENT_CARDS,
  normalizeWargameState,
  submitTurnIntent,
  injectEventToTurn,
  removeEventFromTurn,
  saveTurnAdjudication,
  advanceToNextTurn,
  addCustomEventCard,
  generateLocalAdjudicationAdvice
} from "../design-studio/src/wargameTurnStore.js";
import { renderScenario, renderWargameTurnsView } from "../design-studio/src/scenarioView.js";
import { createOpenAiClient } from "../server/openaiClient.mjs";

console.log("--- 运行 M7-T7.6 想定推演线：推演回合与导调引擎专项测试 ---");

const mockPhases = [
  { id: "phase-1", name: "远程机动与早期感知阶段" },
  { id: "phase-2", name: "分布式突击与电磁压制阶段" },
  { id: "phase-3", name: "体系收拢与效能巩固阶段" }
];

const mockActivities = [
  { id: "act-1", name: "前哨无源探测与航迹接力" },
  { id: "act-2", name: "高敏锐多源信息融合" },
  { id: "act-3", name: "协同干扰压制与火力分发" }
];

// 1. 规范化与初始回合创建
{
  const w = normalizeWargameState(null, { phases: mockPhases });
  assert.equal(w.version, 1);
  assert.equal(w.turns.length, 1);
  assert.equal(w.currentTurnIndex, 1);
  assert.equal(w.eventCardLibrary.length >= 6, true, "默认应包含不少于6张预置事件卡");

  const t1 = w.turns[0];
  assert.equal(t1.turnNumber, 1);
  assert.equal(t1.phaseId, "phase-1");
  assert.equal(t1.phaseName, "远程机动与早期感知阶段");
  assert.equal(t1.status, "intents-planning");
  console.log("✔ 检查项 1: 推演状态规范化与初始回合自动创建正确");
}

// 2. 红蓝双方作战意图录入与阶段活动关联
{
  let w = normalizeWargameState(null, { phases: mockPhases });
  w = submitTurnIntent(w, 1, "red", {
    text: "红方以多批次无人机前出实施电磁假目标欺骗，主力编队保持雷达静默",
    activityRefs: ["act-1"]
  });
  assert.equal(w.turns[0].intents.red.text.includes("电磁假目标"), true);
  assert.deepEqual(w.turns[0].intents.red.activityRefs, ["act-1"]);
  assert.equal(w.turns[0].status, "event-injection", "录入意图后状态应流转至事件注入");

  w = submitTurnIntent(w, 1, "blue", {
    text: "蓝方启动前沿分布式浮标网，依靠被动声学与红外融合感知构建反潜防空屏障",
    activityRefs: ["act-1", "act-2"]
  });
  assert.equal(w.turns[0].intents.blue.text.includes("分布式浮标网"), true);
  assert.deepEqual(w.turns[0].intents.blue.activityRefs, ["act-1", "act-2"]);

  console.log("✔ 检查项 2: 红蓝意图与阶段活动关联正确");
}

// 3. 突发事件注入与撤回
{
  let w = normalizeWargameState(null, { phases: mockPhases });
  w = submitTurnIntent(w, 1, "red", { text: "红方佯动" });
  
  // 注入预置卡
  const commCard = PRESET_EVENT_CARDS.find((c) => c.id === "card-comm-loss");
  assert.ok(commCard, "应存在通信中断预置卡");
  w = injectEventToTurn(w, 1, commCard, "both");

  assert.equal(w.turns[0].injectedEvents.length, 1);
  assert.equal(w.turns[0].injectedEvents[0].title, "战术通信中断");
  assert.equal(w.turns[0].status, "adjudicating", "注入事件后状态应流转至导调裁决中");

  // 自定义事件卡并注入
  w = addCustomEventCard(w, {
    title: "无人浮标电池耗尽",
    category: "装备状态",
    detail: "前哨浮标阵列因连续高负载作业提前耗尽能源",
    suggestedImpact: "水下声学监视网产生 20 海里盲区"
  });
  const customCard = w.eventCardLibrary.find((c) => c.title === "无人浮标电池耗尽");
  assert.ok(customCard);
  w = injectEventToTurn(w, 1, customCard, "blue");
  assert.equal(w.turns[0].injectedEvents.length, 2);

  // 撤回一个事件
  const injId = w.turns[0].injectedEvents[0].id;
  w = removeEventFromTurn(w, 1, injId);
  assert.equal(w.turns[0].injectedEvents.length, 1);
  assert.equal(w.turns[0].injectedEvents[0].title, "无人浮标电池耗尽");

  console.log("✔ 检查项 3: 预置与自定义扰动事件注入与撤回正确");
}

// 4. 离线/本地导调裁决建议生成（绝无数值化杀伤计算）
{
  const testTurn = {
    turnNumber: 1,
    intents: {
      red: { text: "红方实施超低空反舰突击" },
      blue: { text: "蓝方组织多层预警拦截" }
    },
    injectedEvents: [
      { title: "指控网络降级", detail: "算力阻塞导致秒级刷新降为分钟级" }
    ]
  };

  const advice = generateLocalAdjudicationAdvice(testTurn);
  assert.ok(advice.outcome, "应包含裁决结论");
  assert.ok(advice.rationale, "应包含因果逻辑阐释");
  assert.ok(advice.aiAdvice, "应包含导调建议");

  // 安全防线验证：严禁出现命中率、战损百分比等微观数值模拟
  assert.equal(/\b\d+%\b|\b命中率\b|\b击落\d+架\b|\b击沉\b/.test(advice.outcome), false, "裁决结论绝无数值化杀伤计算");
  assert.equal(/\b\d+%\b|\b命中率\b|\b击落\d+架\b|\b击沉\b/.test(advice.rationale), false, "裁决因果推导绝无数值化杀伤计算");

  console.log("✔ 检查项 4: 宏观因果导调裁决建议生成正确（坚守绝无数值杀伤防线）");
}

// 5. 导调裁决保存与回合闭环
{
  let w = normalizeWargameState(null, { phases: mockPhases });
  
  // 空结论拦截
  assert.throws(() => {
    saveTurnAdjudication(w, 1, { outcome: "  ", rationale: "理由" });
  }, /裁决结论不得为空/);

  // 正确保存
  w = saveTurnAdjudication(w, 1, {
    outcome: "蓝方依托无源红外与前推浮标保持早期预警，红方突防窗口被有效压制",
    rationale: "攻防博弈表明，雷达关机并未削弱蓝方整体感知，多源融合有效弥补了单一传感器受扰问题",
    aiAdvice: "建议保持当前战术态势"
  });

  assert.equal(w.turns[0].status, "completed");
  assert.equal(w.turns[0].adjudication.outcome.includes("蓝方依托无源红外"), true);
  console.log("✔ 检查项 5: 导调裁决校验与保存闭环正确");
}

// 6. 回合推进与多阶段流转
{
  let w = normalizeWargameState(null, { phases: mockPhases });
  // 未完成裁决前推进应拦截
  assert.throws(() => {
    advanceToNextTurn(w, { phases: mockPhases });
  }, /尚未完成裁决/);

  // 完成裁决后推进
  w = saveTurnAdjudication(w, 1, { outcome: "战况胶着", rationale: "因果机理" });
  w = advanceToNextTurn(w, { phases: mockPhases });

  assert.equal(w.turns.length, 2);
  assert.equal(w.currentTurnIndex, 2);
  assert.equal(w.turns[1].turnNumber, 2);
  assert.equal(w.turns[1].phaseId, "phase-2");
  assert.equal(w.turns[1].phaseName, "分布式突击与电磁压制阶段");
  assert.equal(w.turns[1].status, "intents-planning");
  console.log("✔ 检查项 6: 回合推进与跨作战阶段时序演进正确");
}

// 7. 服务端提示词统一目录纳管与接口契约
{
  const client = createOpenAiClient({
    getAiServiceConfig: () => ({ baseUrl: "http://example.test/v1", model: "test" }),
    getAiApiKey: () => "test-key"
  });
  const defs = client.listPromptDefinitions();
  const wargamePrompt = defs.find((d) => d.id === "ai.wargame.adjudication");
  assert.ok(wargamePrompt, "统一提示词目录必须纳管 ai.wargame.adjudication");
  assert.equal(typeof wargamePrompt.description, "string");
  assert.ok(Array.isArray(wargamePrompt.variables), "必须声明动态变量说明");
  assert.equal(typeof client.callOpenAiWargameAdjudication, "function", "必须导出 callOpenAiWargameAdjudication");

  const serverCode = fs.readFileSync(path.resolve("server/createRequestHandler.mjs"), "utf-8");
  assert.ok(serverCode.includes("/api/simulation/wargame-adjudication"), "服务端必须接入导调裁决路由");

  console.log("✔ 检查项 7: 统一提示词目录纳管与服务端路由契约正确");
}

// 8. 前端视图渲染模式与核心推演元素存在性
{
  const state = {
    activeView: "scenario",
    scenarioViewMode: "wargame-turns",
    phaseAction: { phases: mockPhases },
    ov5: { activities: mockActivities },
    scenario: {
      version: 1,
      entities: [],
      timeline: [],
      wargame: normalizeWargameState(null, { phases: mockPhases })
    }
  };

  const html = renderScenario(state);
  assert.ok(html.includes("data-view-mode=\"wargame-turns\""), "必须包含回合推演视图切换选项卡");
  assert.ok(html.includes("wargame-turns-container"), "必须包含回合推演主容器");
  assert.ok(html.includes("wargameRedIntent"), "必须包含红方意图输入框");
  assert.ok(html.includes("wargameBlueIntent"), "必须包含蓝方意图输入框");
  assert.ok(html.includes("wargame-card-library-grid"), "必须包含预置事件卡库");
  assert.ok(html.includes("request-wargame-adjudication-advice"), "必须包含导调建议按钮");
  assert.ok(html.includes("wargameOutcome"), "必须包含裁决结论输入框");
  assert.ok(html.includes("wargameRationale"), "必须包含对抗机理推导文本框");
  assert.ok(html.includes("advance-wargame-turn"), "必须包含推进下一回合按钮");

  console.log("✔ 检查项 8: 前端推演视口渲染与核心表单组件存在性验证通过");
}

console.log("🎉 M7-T7.6 想定推演线：推演回合与导调引擎所有测试 100% 通过！");
