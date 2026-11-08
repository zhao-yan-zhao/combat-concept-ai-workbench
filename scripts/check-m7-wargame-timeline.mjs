import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildWargameTimeline,
  buildWhatIfProjectPayload,
  renderWargameTimelineSection
} from "../design-studio/src/wargameTimelineStore.js";
import { renderWargameTurnsView } from "../design-studio/src/scenarioView.js";

console.log("--- 运行 M7-T7.7 想定推演线：推演日志流水线与 What-If 快照派生专项测试 ---");

// 模拟 3 个推演回合
const mockWargame = {
  turns: [
    {
      turnNumber: 1,
      phaseId: "p1",
      phaseName: "前沿侦察佯动阶段",
      status: "completed",
      intents: {
        red: { text: "红方以诱饵无人机多波次展开，逼迫蓝方相控阵雷达开机", activityRefs: [] },
        blue: { text: "蓝方保持雷达静默，启动被动红外预警网", activityRefs: [] }
      },
      injectedEvents: [
        { id: "e1", title: "突发雷暴气象", category: "环境", targetSide: "both" }
      ],
      adjudication: {
        outcome: "蓝方成功隐蔽，红方诱饵未达成目的",
        rationale: "恶劣气象削弱了无人机航程与探测性能",
        adjudicatedAt: "2026-11-09T01:00:00.000Z"
      }
    },
    {
      turnNumber: 2,
      phaseId: "p2",
      phaseName: "防空走廊突破阶段",
      status: "completed",
      intents: {
        red: { text: "红方反辐射巡航导弹实施多轴向超低空突防", activityRefs: [] },
        blue: { text: "蓝方机动防空单元实施跳频截击", activityRefs: [] }
      },
      injectedEvents: [
        { id: "e2", title: "战术通信中断", category: "网络", targetSide: "red" }
      ],
      adjudication: {
        outcome: "红方在通信中断下出现波次脱节，蓝方击落两批突防弹",
        rationale: "跳频战术链路压制导致红方协同指令无法准时到达",
        adjudicatedAt: "2026-11-09T02:00:00.000Z"
      }
    },
    {
      turnNumber: 3,
      phaseId: "p3",
      phaseName: "纵深打击与评估阶段",
      status: "intents-planning",
      intents: {
        red: { text: "组织第二波次有人机防区外齐射", activityRefs: [] },
        blue: { text: "转移阵地并组织备用雷达接替", activityRefs: [] }
      },
      injectedEvents: []
    }
  ]
};

// 1. 推演时序流水线数据提取契约
{
  const timeline = buildWargameTimeline(mockWargame, { activePerspective: "director" });
  assert.equal(timeline.length, 3, "流水线应包含全部3个回合节点");
  assert.equal(timeline[0].turnNumber, 1);
  assert.equal(timeline[0].isCompleted, true);
  assert.equal(timeline[0].events.length, 1);
  assert.equal(timeline[0].outcome, "蓝方成功隐蔽，红方诱饵未达成目的");

  // 视角情报迷雾测试：红方视角下蓝方意图应脱敏
  const redTimeline = buildWargameTimeline(mockWargame, { activePerspective: "red" });
  assert.equal(redTimeline[0].redMasked, false);
  assert.equal(redTimeline[0].blueMasked, true);
  assert.ok(redTimeline[0].blueIntentText.includes("蓝方情报迷雾"));
  assert.equal(redTimeline[0].blueIntentText.includes("被动红外预警网"), false, "红方视角必须杜绝获知蓝方机密意图");

  // 视角情报迷雾测试：蓝方视角下红方意图应脱敏
  const blueTimeline = buildWargameTimeline(mockWargame, { activePerspective: "blue" });
  assert.equal(blueTimeline[1].blueMasked, false);
  assert.equal(blueTimeline[1].redMasked, true);
  assert.ok(blueTimeline[1].redIntentText.includes("红方情报迷雾"));
  console.log("✔ 检查项 1: 推演时序流水线数据提取与情报迷雾自适应脱敏契约正确");
}

// 2. What-If 分支项目载荷构建与绝对解耦测试
{
  const mockState = {
    project: { id: "proj-orig-100", title: "分布式穿透防空作战概念" },
    brief: {
      objective: "突破某要地防空走廊",
      approach: "分布式诱饵与多轴反辐射突防",
      assumptions: "敌雷达具备先进抗反辐射性能"
    },
    ov5: { activities: [{ id: "act-1", name: "发射诱饵" }, { id: "act-2", name: "反辐射突击" }] },
    phaseAction: { phases: [{ id: "p1" }, { id: "p2" }, { id: "p3" }] },
    forceMission: { forces: [] },
    ooda: { loops: [] },
    scenario: { wargame: mockWargame }
  };

  // 从第 2 回合派生 What-If 分支
  const branchTitle = "What-If: 通信未中断情景探索";
  const assumption = "若红方在第二回合未遭受战术通信中断，协同指令畅通时态势如何？";
  const forkedProject = buildWhatIfProjectPayload(mockState, 2, { branchTitle, assumption });

  assert.ok(forkedProject.id);
  assert.equal(forkedProject.title, branchTitle);
  assert.ok(forkedProject.description.includes(assumption));
  assert.equal(forkedProject.kind, "tactic");

  // 验证推演数据截断至第 2 回合
  const forkedWargame = forkedProject.record.scenario.wargame;
  assert.equal(forkedWargame.turns.length, 2, "派生分支推演回合应严格截断至派生节点 (2 回合)");
  assert.equal(forkedWargame.currentTurnIndex, 2);

  // 验证第 2 回合裁决已清空重置，便于在分支项目中重新演练
  const branchTurn = forkedWargame.turns[1];
  assert.equal(branchTurn.turnNumber, 2);
  assert.equal(branchTurn.adjudication, null, "分支起点回合裁决应重置为空，以便重新导调推演");

  // 验证深拷贝绝对解耦：修改派生项目，原 state 绝不受任何污染
  forkedProject.record.brief.objective = "修改后的新分支目标";
  forkedWargame.turns[0].intents.red.text = "已被分支修改的意图";
  assert.equal(mockState.brief.objective, "突破某要地防空走廊", "修改分支项目绝对不可污染原项目 brief");
  assert.equal(
    mockState.scenario.wargame.turns[0].intents.red.text,
    "红方以诱饵无人机多波次展开，逼迫蓝方相控阵雷达开机",
    "修改分支推演回合绝对不可污染原项目回合记录"
  );
  assert.equal(mockState.scenario.wargame.turns.length, 3, "原项目回合数必须维持 3 回合不受截断影响");
  console.log("✔ 检查项 2: What-If 载荷构建、回合截断与纯深拷贝解耦验证通过");
}

// 3. 时序流水线前端看板 HTML 渲染
{
  const timeline = buildWargameTimeline(mockWargame, { activePerspective: "director" });
  const htmlWithoutWhatIf = renderWargameTimelineSection({
    timeline,
    currentTurnNumber: 2,
    whatIfSelectedTurn: null,
    activePerspective: "director"
  });

  assert.ok(htmlWithoutWhatIf.includes("推演时序流水线 (Turn Timeline)"));
  assert.ok(htmlWithoutWhatIf.includes("T1"));
  assert.ok(htmlWithoutWhatIf.includes("T2"));
  assert.ok(htmlWithoutWhatIf.includes("T3"));
  assert.ok(htmlWithoutWhatIf.includes('data-action="toggle-what-if-form"'));
  assert.equal(htmlWithoutWhatIf.includes("what-if-inline-panel"), false, "未选中时不得渲染派生面板");

  // 激活第 2 回合的 What-If 派生面板
  const htmlWithWhatIf = renderWargameTimelineSection({
    timeline,
    currentTurnNumber: 2,
    whatIfSelectedTurn: 2,
    activePerspective: "director"
  });

  assert.ok(htmlWithWhatIf.includes("what-if-inline-panel"), "选中节点应展开内联派生面板");
  assert.ok(htmlWithWhatIf.includes("whatIfBranchTitle"), "面板必须包含分支项目名称输入框");
  assert.ok(htmlWithWhatIf.includes("whatIfAssumption"), "面板必须包含战术假设输入框");
  assert.ok(htmlWithWhatIf.includes('data-action="execute-what-if-fork"'), "面板必须包含确认派生按钮");
  console.log("✔ 检查项 3: 时序流水线 HTML 节点轴与内联 What-If 派生面板渲染契约正确");
}

// 4. 想定推演视口静态集成
{
  const scenarioViewSource = fs.readFileSync(path.join(process.cwd(), "design-studio/src/scenarioView.js"), "utf8");
  assert.ok(scenarioViewSource.includes("renderWargameTimelineSection"), "scenarioView 必须挂载时序流水线组件");
  assert.ok(scenarioViewSource.includes("buildWargameTimeline"), "scenarioView 必须调用 buildWargameTimeline");

  const mainSource = fs.readFileSync(path.join(process.cwd(), "design-studio/src/main.js"), "utf8");
  assert.ok(mainSource.includes('action === "toggle-what-if-form"'), "main.js 必须处理 toggle-what-if-form");
  assert.ok(mainSource.includes('action === "execute-what-if-fork"'), "main.js 必须处理 execute-what-if-fork");
  console.log("✔ 检查项 4: 想定推演视口与主事件总线集成验证完整");
}

console.log("--- M7-T7.7 推演日志流水线与 What-If 快照派生专项测试全部 PASS ---");
