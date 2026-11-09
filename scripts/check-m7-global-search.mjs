import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  extractProjectElements,
  extractTacticsLibraryElements,
  extractWargameTimelineElements,
  filterCommands,
  renderCommandPaletteHtml
} from "../design-studio/src/commandPaletteView.js";

console.log("--- 运行 M7-T7.11 全局搜索专项测试 ---");

// 模拟完整 workbench state
const mockState = {
  brief: {
    objective: "达成对敌纵深防空火控雷达阵地的低空突防压制",
    approach: "以无人机前哨诱导雷达开机，配合多轴向防区外超低空突防"
  },
  phaseAction: {
    phases: [
      { id: "p1", name: "远程隐蔽接敌", timeWindow: "T+00~T+30" },
      { id: "p2", name: "多轴电磁佯动", timeWindow: "T+30~T+45" }
    ]
  },
  forceMission: {
    conceptForces: [{ id: "f1", name: "前哨无人机大队", side: "friendly", role: "侦察诱骗" }],
    combatForces: [{ id: "cf1", name: "战术巡航突击编队", category: "打击兵力", serviceBranch: "空军" }],
    tasks: [{ id: "t1", name: "诱导雷达开机", side: "friendly", missionType: "SEAD" }]
  },
  ov5: {
    activities: [
      { id: "act-1", title: "发射前哨诱饵", domain: "空中", autonomyLevel: "高度自主" },
      { id: "act-2", title: "反三角定位雷达辐射源", domain: "电磁", autonomyLevel: "HITL" }
    ],
    argumentChain: {
      assumptions: [
        { id: "as-1", text: "敌相控阵雷达在多批假目标饱和诱骗下跟踪通道溢出", confidence: "高" }
      ]
    }
  },
  ov6b: {
    machines: [{ id: "m1", name: "突防突击状态机", subjectType: "巡航编队" }]
  },
  tacticsLibraryList: [
    {
      id: "tactic-001",
      name: "分布式集群多轴饱和突防战法",
      category: "突防压制",
      tags: ["无人机", "饱和突击", "雷达压制"],
      summary: "利用低成本无人机群构建假目标前哨，逼迫敌雷达开机耗尽通道。",
      applicableScenario: "强电磁对抗防御严密区域"
    },
    {
      id: "tactic-002",
      name: "无源感知低空静默穿透反导战法",
      category: "隐蔽突击",
      tags: ["静默", "超低空", "无源定位"],
      summary: "保持全无线电静默，依靠分布式无源传感网进行雷达走廊撕裂。",
      applicableScenario: "具备区域防空雷达网的沿海反导作战"
    }
  ],
  scenario: {
    wargame: {
      turns: [
        {
          turnNumber: 1,
          phaseName: "远程隐蔽接敌",
          intents: {
            red: { text: "红方保持全频段无线电静默，沿谷地超低空巡航" },
            blue: { text: "蓝方启动前哨远程预警雷达间歇性扫视" }
          },
          adjudication: {
            outcome: "蓝方雷达受地形杂波遮蔽未发现红方编队，红方维持隐蔽"
          }
        }
      ]
    }
  }
};

// 1. 项目模型要素提取契约断言
{
  const elements = extractProjectElements(mockState);
  assert.ok(elements.length >= 6, "应提取出简报、任务、阶段、兵力、活动、假设等要素");

  // 验证简报目标要素
  const briefElem = elements.find((e) => e.id === "elem-brief-objective");
  assert.ok(briefElem, "必须提取简报目标要素");
  assert.ok(briefElem.title.includes("火控雷达阵地"));
  assert.equal(briefElem.view, "brief");

  // 验证作战编组要素
  const combatForceElem = elements.find((e) => e.id === "elem-combat-force-cf1");
  assert.ok(combatForceElem, "必须提取作战编组力量");
  assert.ok(combatForceElem.title.includes("战术巡航突击编队"));
  assert.equal(combatForceElem.view, "force-mission");

  // 验证论证链假设要素
  const assumptionElem = elements.find((e) => e.id === "elem-assumption-as-1");
  assert.ok(assumptionElem, "必须提取论证链关键假设要素");
  assert.ok(assumptionElem.title.includes("相控阵雷达"));
  assert.ok(assumptionElem.subtitle.includes("置信度: 高"));
  assert.equal(assumptionElem.view, "ov5");

  console.log("✔ 检查项 1: 项目各视点模型要素提取完整且字段规范");
}

// 2. 战法库条目提取断言
{
  const tactics = extractTacticsLibraryElements(mockState);
  assert.equal(tactics.length, 2, "应提取战法库中全部 2 套战法");
  assert.equal(tactics[0].category, "战法库");
  assert.equal(tactics[0].type, "tactic");
  assert.ok(tactics[0].title.includes("分布式集群多轴饱和突防战法"));
  assert.ok(tactics[0].keywords.includes("无人机"));
  console.log("✔ 检查项 2: 跨项目成熟战法库条目提取契约正确");
}

// 3. 推演历史日志条目提取断言
{
  const timelineEntries = extractWargameTimelineElements(mockState);
  assert.equal(timelineEntries.length, 3, "第 1 回合应提取红方意图、蓝方意图与导调裁决 3 条日志");

  const redTurn = timelineEntries.find((e) => e.id === "turn-1-red");
  assert.ok(redTurn, "必须提取红方意图日志");
  assert.ok(redTurn.title.includes("无线电静默"));
  assert.equal(redTurn.category, "推演日志");
  assert.equal(redTurn.type, "timeline");
  assert.equal(redTurn.view, "scenario");

  const adjTurn = timelineEntries.find((e) => e.id === "turn-1-adjudication");
  assert.ok(adjTurn, "必须提取导调裁决日志");
  assert.ok(adjTurn.title.includes("蓝方雷达受地形杂波遮蔽"));
  console.log("✔ 检查项 3: 推演历史日志攻防意图与导调裁决提取契约正确");
}

// 4. 综合全局搜索与关键词过滤断言 (filterCommands)
{
  // 检索“饱和”：应匹配到战法库中的饱和突防战法，以及论证链中假设通道饱和要素
  const saturatedMatches = filterCommands("饱和", mockState);
  assert.ok(saturatedMatches.some((m) => m.category === "战法库" && m.title.includes("分布式集群多轴饱和突防战法")));
  assert.ok(saturatedMatches.some((m) => m.category === "项目要素" && m.title.includes("通道溢出")));

  // 检索“雷达”：应跨类别匹配简报、活动、战法与推演日志
  const radarMatches = filterCommands("雷达", mockState);
  assert.ok(radarMatches.some((m) => m.category === "项目要素" && m.view === "brief"));
  assert.ok(radarMatches.some((m) => m.category === "项目要素" && m.view === "ov5"));
  assert.ok(radarMatches.some((m) => m.category === "战法库"));
  assert.ok(radarMatches.some((m) => m.category === "推演日志"));

  // 检索“静默”：应匹配到静默战法与第 1 回合红方意图日志
  const silentMatches = filterCommands("静默", mockState);
  assert.ok(silentMatches.some((m) => m.category === "战法库" && m.title.includes("无源感知低空静默穿透反导战法")));
  assert.ok(silentMatches.some((m) => m.category === "推演日志" && m.title.includes("全频段无线电静默")));

  // 空关键词：仅展示视图与常用动作
  const defaultMatches = filterCommands("", mockState);
  assert.ok(defaultMatches.length > 0);
  assert.ok(defaultMatches.every((m) => m.category === "步骤与视图" || m.category === "常用操作"));

  console.log("✔ 检查项 4: 全局多维跨项目要素、战法与日志搜索检索过滤准确");
}

// 5. 命令面板渲染与专属徽章断言
{
  const html = renderCommandPaletteHtml({ query: "饱和", selectedIndex: 0, state: mockState });
  assert.ok(html.includes("command-palette-shell"));
  assert.ok(html.includes("战法库"), "结果应按分类分组展示");
  assert.ok(html.includes('<span class="command-badge tactic">战法</span>'), "战法条目应展示专用战法徽章");
  assert.ok(html.includes('<span class="command-badge elem">要素</span>'), "要素条目应展示要素徽章");

  const timelineHtml = renderCommandPaletteHtml({ query: "静默", selectedIndex: 0, state: mockState });
  assert.ok(timelineHtml.includes("推演日志"), "应包含推演日志分组");
  assert.ok(timelineHtml.includes('<span class="command-badge timeline">推演</span>'), "推演条目应展示专用推演徽章");

  const ctrlSource = fs.readFileSync(path.join(process.cwd(), "design-studio/src/commandPaletteController.js"), "utf8");
  assert.ok(ctrlSource.includes('type === "tactic"'), "控制器必须处理 tactic 类型的执行调度");
  assert.ok(ctrlSource.includes('type === "timeline"'), "控制器必须处理 timeline 类型的执行调度");

  console.log("✔ 检查项 5: 命令面板 HTML 渲染、分类分组、状态徽章与控制器调度契约完整");
}

console.log("--- M7-T7.11 全局搜索专项测试全部 PASS ---");
