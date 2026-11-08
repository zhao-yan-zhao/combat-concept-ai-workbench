import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  WARGAME_PERSPECTIVES,
  resolveUserPerspective,
  filterTurnByPerspective,
  renderPerspectiveSwitcher
} from "../design-studio/src/wargamePerspectiveFilter.js";
import { renderWargameTurnsView } from "../design-studio/src/scenarioView.js";

console.log("--- 运行 M7-T7.5 想定推演线：红蓝分立与信息隔离专项测试 ---");

// 1. 协同角色到推演视角解析契约
{
  const leadSession = { actor: { id: "user-1", label: "导调组长", roles: ["lead", "reviewer"] } };
  const leadPerm = resolveUserPerspective(leadSession);
  assert.equal(leadPerm.defaultPerspective, "director");
  assert.equal(leadPerm.canSwitch, true, "负责人/导调员应具备全局视角切换权限");

  const researcherSession = { actor: { id: "user-2", label: "进攻战法设计员", roles: ["researcher"] } };
  const researcherPerm = resolveUserPerspective(researcherSession);
  assert.equal(researcherPerm.defaultPerspective, "red");
  assert.equal(researcherPerm.canSwitch, false, "普通研究员默认锁定红方视角");

  const reviewerSession = { actor: { id: "user-3", label: "外部红队审阅员", roles: ["reviewer"] } };
  const reviewerPerm = resolveUserPerspective(reviewerSession);
  assert.equal(reviewerPerm.defaultPerspective, "blue");
  assert.equal(reviewerPerm.canSwitch, false, "审阅员默认锁定蓝方视角");

  const localSession = {};
  const localPerm = resolveUserPerspective(localSession);
  assert.equal(localPerm.defaultPerspective, "director");
  assert.equal(localPerm.canSwitch, true, "离线单机模式默认全知且支持自由切换体验");
  console.log("✔ 检查项 1: 协同身份角色到推演视角映射与切换权限正确");
}

// 模拟完整的一回合推演数据
const mockTurn = {
  turnNumber: 1,
  phaseId: "p1",
  phaseName: "防空走廊破门阶段",
  status: "adjudicating",
  intents: {
    red: {
      text: "红方以诱饵无人机实施主轴佯动，吸引对手主力相控阵雷达开机辐射",
      activityRefs: ["act-1"]
    },
    blue: {
      text: "蓝方预警雷达实施间歇跳频开机，预伏防空连在反辐射威胁下保持无线电静默",
      activityRefs: ["act-2"]
    }
  },
  injectedEvents: [
    { id: "e-1", title: "公共强电磁干扰", category: "环境", targetSide: "both", detail: "全域噪声抬升" },
    { id: "e-2", title: "红方中继机失联", category: "通信", targetSide: "red", detail: "红方跳频链路中断" },
    { id: "e-3", title: "蓝方雷达被诱骗开机", category: "雷达", targetSide: "blue", detail: "蓝方火控雷达锁定假目标" }
  ],
  adjudication: {
    outcome: "红方诱饵成功诱导蓝方开机，但自身中继受损，形成僵持局势",
    rationale: "攻防两端扰动对冲，未发生决定性单向击穿"
  }
};

// 2. 红方视角信息隔离与情报迷雾
{
  const redView = filterTurnByPerspective(mockTurn, "red");
  assert.equal(redView.activePerspective, "red");
  assert.equal(redView.fogOfWar, true);
  assert.equal(redView.canEditRed, true);
  assert.equal(redView.canEditBlue, false);
  assert.equal(redView.canInjectEvents, false);
  assert.equal(redView.canAdjudicate, false);

  // 红方真意图保持
  assert.equal(redView.intents.red.text, mockTurn.intents.red.text);
  assert.equal(redView.intents.red.masked, false);

  // 蓝方意图情报迷雾遮蔽
  assert.equal(redView.intents.blue.masked, true);
  assert.ok(redView.intents.blue.text.includes("蓝方情报迷雾"));
  assert.equal(redView.intents.blue.text.includes("反辐射威胁"), false, "红方视角必须杜绝获知蓝方真实机密意图");

  // 扰动事件定向受体过滤：红方视角能看 e-1 (both) 和 e-2 (red)，不能看 e-3 (blue)
  assert.equal(redView.injectedEvents.length, 2);
  assert.ok(redView.injectedEvents.some((e) => e.id === "e-1"));
  assert.ok(redView.injectedEvents.some((e) => e.id === "e-2"));
  assert.equal(redView.injectedEvents.some((e) => e.id === "e-3"), false, "蓝方独有事件红方不可见");
  console.log("✔ 检查项 2: 红方视角下蓝方真实意图与蓝方定向事件隔离过滤正确");
}

// 3. 蓝方视角信息隔离与情报迷雾
{
  const blueView = filterTurnByPerspective(mockTurn, "blue");
  assert.equal(blueView.activePerspective, "blue");
  assert.equal(blueView.fogOfWar, true);
  assert.equal(blueView.canEditRed, false);
  assert.equal(blueView.canEditBlue, true);
  assert.equal(blueView.canInjectEvents, false);
  assert.equal(blueView.canAdjudicate, false);

  // 蓝方真意图保持
  assert.equal(blueView.intents.blue.text, mockTurn.intents.blue.text);
  assert.equal(blueView.intents.blue.masked, false);

  // 红方意图情报迷雾遮蔽
  assert.equal(blueView.intents.red.masked, true);
  assert.ok(blueView.intents.red.text.includes("红方情报迷雾"));
  assert.equal(blueView.intents.red.text.includes("主轴佯动"), false, "蓝方视角必须杜绝获知红方主攻佯动意图");

  // 扰动事件定向受体过滤：蓝方视角能看 e-1 (both) 和 e-3 (blue)，不能看 e-2 (red)
  assert.equal(blueView.injectedEvents.length, 2);
  assert.ok(blueView.injectedEvents.some((e) => e.id === "e-1"));
  assert.ok(blueView.injectedEvents.some((e) => e.id === "e-3"));
  assert.equal(blueView.injectedEvents.some((e) => e.id === "e-2"), false, "红方独有事件蓝方不可见");
  console.log("✔ 检查项 3: 蓝方视角下红方主攻意图与红方定向事件隔离过滤正确");
}

// 4. 导演部视角全知契约
{
  const directorView = filterTurnByPerspective(mockTurn, "director");
  assert.equal(directorView.activePerspective, "director");
  assert.equal(directorView.fogOfWar, false);
  assert.equal(directorView.canEditRed, true);
  assert.equal(directorView.canEditBlue, true);
  assert.equal(directorView.canInjectEvents, true);
  assert.equal(directorView.canAdjudicate, true);

  // 双方真意图全透视
  assert.equal(directorView.intents.red.text, mockTurn.intents.red.text);
  assert.equal(directorView.intents.blue.text, mockTurn.intents.blue.text);
  assert.equal(directorView.injectedEvents.length, 3, "导演部可见全部事件");
  console.log("✔ 检查项 4: 导演部视角全透视、全知意图与全权限契约正确");
}

// 5. 视角切换控制器组件 HTML 渲染
{
  const leadSwitcherHtml = renderPerspectiveSwitcher({
    activePerspective: "director",
    session: { actor: { roles: ["lead"] } }
  });
  assert.ok(leadSwitcherHtml.includes("推演视角"));
  assert.ok(leadSwitcherHtml.includes("导演部 (全知视角)"));
  assert.ok(leadSwitcherHtml.includes("红方视角 (进攻概念)"));
  assert.ok(leadSwitcherHtml.includes("蓝方视角 (对手反制)"));
  assert.equal(leadSwitcherHtml.includes("disabled"), false, "负责人拥有切换权限，不应被禁用");

  const researcherSwitcherHtml = renderPerspectiveSwitcher({
    activePerspective: "red",
    session: { actor: { roles: ["researcher"] } }
  });
  assert.ok(researcherSwitcherHtml.includes("disabled"), "非负责人尝试切其他视角应被禁用");
  assert.ok(researcherSwitcherHtml.includes("蓝方意图已加情报迷雾"));
  console.log("✔ 检查项 5: 视角切换器组件 HTML 渲染与权限指示正确");
}

// 6. 想定推演视口在红方视角下的集成渲染
{
  const testState = {
    scenario: {
      wargame: {
        turns: [mockTurn],
        eventCardLibrary: []
      }
    },
    phaseAction: { phases: [] },
    ov5: { activities: [] },
    wargamePerspective: "red",
    collaboration: {
      session: { actor: { roles: ["researcher"] } }
    }
  };

  const turnsHtml = renderWargameTurnsView(testState);
  assert.ok(turnsHtml.includes("蓝方情报迷雾"), "红方视角下蓝方意图框必须呈现情报迷雾");
  assert.ok(turnsHtml.includes("readonly"), "红方视角下蓝方文本框必须设置为只读");
  assert.ok(turnsHtml.includes("💾 保存红方意图"), "保存按钮应自适应为保存红方意图");
  assert.ok(turnsHtml.includes("导调事件由导演部注入"), "应提示事件注入由导演部主导");
  console.log("✔ 检查项 6: 想定工作台红方视口情报迷雾与权限门禁渲染契约正确");
}

// 7. 静态集成断言
{
  const scenarioControllerSource = fs.readFileSync(path.join(process.cwd(), "design-studio/src/scenarioController.js"), "utf8");
  assert.ok(scenarioControllerSource.includes('action === "switch-wargame-perspective"'), "scenarioController 必须处理 switch-wargame-perspective");
  assert.ok(scenarioControllerSource.includes("activePerspective === \"red\""), "保存意图时必须防止情报迷雾文本覆写对手真意图");

  const cssSource = fs.readFileSync(path.join(process.cwd(), "design-studio/styles/step-concept-simulation.css"), "utf8");
  assert.ok(cssSource.includes(".wargame-intent-box.is-masked"), "样式中必须包含情报迷雾高亮类定义");
  console.log("✔ 检查项 7: 前端控制器与样式表静态集成完整");
}

console.log("--- M7-T7.5 红蓝分立与信息隔离专项测试全部 PASS ---");
