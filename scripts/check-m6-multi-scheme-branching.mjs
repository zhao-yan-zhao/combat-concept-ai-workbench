import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  forkModelSnapshot,
  saveModelSnapshot
} from "../design-studio/src/modelSnapshotStore.js";
import {
  QUANTITATIVE_CRITERIA,
  createQuantitativeSettings,
  rankMultiSchemeSnapshots,
  scoreSchemeSnapshot
} from "../design-studio/src/schemeScoring.js";
import { compareModelSnapshots } from "../design-studio/src/modelCompare.js";
import { buildModelComparisonArtifact } from "../design-studio/src/modelComparisonBuilder.js";
import { renderModelSnapshotPanel } from "../design-studio/src/modelSnapshotView.js";

console.log("=== 1. forkModelSnapshot 派生方案分支逻辑测试 ===");
{
  const mockBase = {
    id: "snap-a",
    number: 1,
    label: "方案A: 基准多域协同",
    direction: "基准协同压制",
    savedAt: "2026-11-08T10:00:00.000Z",
    title: "战法设计",
    model: {
      ov1: { nodes: [{ id: "n1", label: "指挥机" }], edges: [] },
      ov5: { activities: [{ id: "act-1", title: "协同突防" }], edges: [] },
      ooda: { lanes: [] }
    }
  };

  const initialList = [mockBase];
  const { snapshot: forkedSchemeB, snapshots: nextList } = forkModelSnapshot(
    "snap-a",
    { label: "方案B: 高空分布式诱骗", direction: "高空诱骗突防" },
    initialList
  );

  assert.equal(nextList.length, 2, "快照列表应增加 1 项");
  assert.equal(forkedSchemeB.label, "方案B: 高空分布式诱骗");
  assert.equal(forkedSchemeB.direction, "高空诱骗突防");
  assert.equal(forkedSchemeB.forkedFrom, "snap-a");
  assert.equal(forkedSchemeB.forkedFromLabel, "方案A: 基准多域协同");
  assert.notEqual(forkedSchemeB.id, mockBase.id);

  // 验证深度克隆独立性
  forkedSchemeB.model.ov1.nodes.push({ id: "n2", label: "诱骗无人机" });
  assert.equal(mockBase.model.ov1.nodes.length, 1, "修改派生分支不应污染源快照模型");

  // 派生方案 C
  const { snapshot: forkedSchemeC, snapshots: finalList } = forkModelSnapshot(
    forkedSchemeB.id,
    { label: "方案C: 超低空静默穿透" },
    nextList
  );
  assert.equal(finalList.length, 3);
  assert.equal(forkedSchemeC.forkedFrom, forkedSchemeB.id);

  console.log("✓ 快照派生新分支 (forkModelSnapshot) 与溯源关联通过");
}

console.log("=== 2. rankMultiSchemeSnapshots 多方案综合评分与排行榜测试 ===");
{
  const makeSnapshot = (id, label, direction, score, resilient) => ({
    id,
    label,
    direction,
    savedAt: "2026-11-08T12:00:00.000Z",
    model: {
      brief: { objective: "压制" },
      ov1: { nodes: [{ id: "n1" }, { id: "n2" }], edges: [] },
      ov5: { activities: [{ id: "a1", title: "任务1", input: "i", output: "o" }], edges: [] },
      ooda: { lanes: [{ id: "l1", nodes: [{ id: "nd1" }] }] },
      validation: {
        scores: [
          { label: "活动连通性", score },
          { label: "信息闭环", score },
          { label: "跨视图追溯", score },
          { label: "OODA 时效", score },
          { label: "OODA 行为完整性", score },
          { label: "OODA 韧性", score: resilient ? 95 : 60 }
        ],
        issues: resilient ? [] : [{ level: "high" }]
      }
    }
  });

  const schemeA = makeSnapshot("snap-1", "方案A: 基准协同", "基准路线", 70, false);
  const schemeB = makeSnapshot("snap-2", "方案B: 高空诱骗", "诱骗突防", 88, true);
  const schemeC = makeSnapshot("snap-3", "方案C: 静默穿透", "低空静默", 80, true);

  const ranked = rankMultiSchemeSnapshots([schemeA, schemeB, schemeC]);
  assert.equal(ranked.rankings.length, 3);
  assert.equal(ranked.rankings[0].id, "snap-2", "评分最高的方案B应排在首位");
  assert.equal(ranked.rankings[0].rank, 1);
  assert.equal(ranked.rankings[0].isLeader, true);
  assert.equal(ranked.rankings[1].id, "snap-3");
  assert.equal(ranked.rankings[1].rank, 2);
  assert.equal(ranked.rankings[1].isLeader, false);
  assert.ok(ranked.rankings[1].gapToLeader < 0, "第二名相比榜首应为负差值");
  assert.equal(ranked.leader.id, "snap-2");

  // 人工评分复核机制核验
  const customSettings = createQuantitativeSettings({
    manualScores: {
      "snap-1": { missionFit: 99, resilience: 99 }
    },
    manualRationales: {
      "snap-1": { missionFit: "人工特批加分" }
    }
  });
  const rankedReviewed = rankMultiSchemeSnapshots([schemeA, schemeB, schemeC], customSettings);
  assert.equal(rankedReviewed.rankings.find((r) => r.id === "snap-1").manualReviewCount, 2);

  console.log("✓ 多方案定量综合评分排行榜 (rankMultiSchemeSnapshots) 验证通过");
}

console.log("=== 3. modelComparisonBuilder 多方案报告与差异导出测试 ===");
{
  const schemeA = {
    id: "s-a",
    label: "方案A",
    direction: "常规路线",
    savedAt: "2026-11-08T10:00:00.000Z",
    model: { ov1: { nodes: [], edges: [] }, ov5: { activities: [], edges: [] }, ooda: { lanes: [] } }
  };
  const schemeB = {
    id: "s-b",
    label: "方案B",
    direction: "智能协同",
    savedAt: "2026-11-08T11:00:00.000Z",
    model: { ov1: { nodes: [{ id: "n1" }], edges: [] }, ov5: { activities: [], edges: [] }, ooda: { lanes: [] } }
  };

  const comparison = compareModelSnapshots(schemeA, schemeB);
  comparison.multiScheme = rankMultiSchemeSnapshots([schemeA, schemeB]);

  const mdArtifact = buildModelComparisonArtifact("markdown", comparison);
  assert.match(mdArtifact.content, /## 多方案综合比较排行榜/);
  assert.match(mdArtifact.content, /方案A/);
  assert.match(mdArtifact.content, /方案B/);
  assert.match(mdArtifact.content, /定量总分/);

  const jsonArtifact = buildModelComparisonArtifact("json", comparison);
  assert.match(jsonArtifact.content, /multiScheme/);

  console.log("✓ 多方案对比 Markdown/JSON 导出格式契约通过");
}

console.log("=== 4. 前端视图与控制器契约测试 ===");
{
  const mockSnapshots = [
    {
      id: "m01",
      number: 1,
      label: "M001",
      direction: "基准方案",
      savedAt: "2026-11-08T10:00:00.000Z",
      model: { ov1: { nodes: [] }, ov5: { activities: [] }, ooda: { lanes: [] } }
    },
    {
      id: "m02",
      number: 2,
      label: "M002 (分支方案)",
      direction: "分支方案",
      forkedFromLabel: "M001",
      savedAt: "2026-11-08T11:00:00.000Z",
      model: { ov1: { nodes: [{ id: "n1" }] }, ov5: { activities: [] }, ooda: { lanes: [] } }
    }
  ];

  const html = renderModelSnapshotPanel({
    snapshots: mockSnapshots,
    comparison: null,
    settings: {}
  });

  assert.match(html, /data-model-snapshot-fork="m01"/);
  assert.match(html, /派生分支/);
  assert.match(html, /派生自 M001/);
  assert.match(html, /multi-scheme-leaderboard/);
  assert.match(html, /多方案综合评分看板 \(并排对比\)/);
  assert.match(html, /共 2 个方案/);
  assert.match(html, /优选推荐/);

  // 静态控制器源码扫描
  const controllerCode = await readFile(new URL("../design-studio/src/modelSnapshotController.js", import.meta.url), "utf8");
  assert.match(controllerCode, /data-model-snapshot-fork/);
  assert.match(controllerCode, /forkModelSnapshot/);
  assert.match(controllerCode, /rankMultiSchemeSnapshots/);

  console.log("✓ 前端视图与控制器多方案分支绑定断言全部通过");
}

console.log("\n==============================================");
console.log("All M6-T6.1 Multi-Scheme Branching Checks PASSED!");
console.log("==============================================");
