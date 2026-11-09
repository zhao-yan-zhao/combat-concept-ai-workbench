// @ts-check
import assert from "node:assert/strict";
import {
  classifyActivityToOodaLane,
  evaluateOodaLoopHealth
} from "../design-studio/src/oodaStore.js";

console.log("[T8.3 Test] Starting OODA 3-Tier Semantic Classifier Verification ...");

// 1. 测试第一优先级：显式字段 oodaLane 最高优先
const explicitAct = {
  id: "act-exp-1",
  type: "打击",
  title: "远程防区外火力突击", // 词面上完全是 act
  oodaLane: "orient" // 但显式指定为 orient
};
assert.equal(
  classifyActivityToOodaLane(explicitAct),
  "orient",
  "Explicit oodaLane must take highest priority over keyword matches"
);

// 2. 测试第二优先级：上游任务类型 (missionType) 映射
const missionMappedAct1 = {
  id: "act-mis-1",
  type: "特殊战术任务",
  title: "野鼬鼠纵深渗透", // 标题与类型无传统“打击/压制”关键词
  missionType: "sead"
};
assert.equal(
  classifyActivityToOodaLane(missionMappedAct1),
  "act",
  "missionType: sead should accurately map to act lane"
);

const missionMappedAct2 = {
  id: "act-mis-2",
  type: "航空前出",
  title: "前沿空域哨戒行动",
  missionType: "recon"
};
assert.equal(
  classifyActivityToOodaLane(missionMappedAct2),
  "observe",
  "missionType: recon should accurately map to observe lane"
);

const missionMappedAct3 = {
  id: "act-mis-3",
  type: "联合机动",
  title: "空中指挥所空域展开",
  missionType: "command"
};
assert.equal(
  classifyActivityToOodaLane(missionMappedAct3),
  "decide",
  "missionType: command should accurately map to decide lane"
);

// 3. 测试第三优先级：扩充现代军事概念词表 (增补40+常用词)
// 3.1 扩展 Observe 术语：“凝视”、“测向”、“目指”
const modernObserve1 = {
  id: "act-obs-mod-1",
  type: "空天协同",
  title: "分布式低轨卫星星座红外凝视"
};
assert.equal(
  classifyActivityToOodaLane(modernObserve1),
  "observe",
  "Modern term '红外凝视' should be categorized as observe"
);

const modernObserve2 = {
  id: "act-obs-mod-2",
  type: "电磁对抗",
  title: "分布式无源宽频电磁测向与定位"
};
assert.equal(
  classifyActivityToOodaLane(modernObserve2),
  "observe",
  "Modern term '电磁测向' should be categorized as observe"
);

// 3.2 扩展 Orient 术语：“态势对齐”、“威胁评估”、“航迹关联”
const modernOrient = {
  id: "act-ori-mod-1",
  type: "数据处理",
  title: "高动态跨域多源态势对齐与融合"
};
assert.equal(
  classifyActivityToOodaLane(modernOrient),
  "orient",
  "Modern term '态势对齐' should be categorized as orient"
);

// 3.3 扩展 Decide 术语：“火力筹划”、“协同规划”、“交战授权”
const modernDecide = {
  id: "act-dec-mod-1",
  type: "作战筹划",
  title: "异构蜂群协同火力筹划与动态分配"
};
assert.equal(
  classifyActivityToOodaLane(modernDecide),
  "decide",
  "Modern term '火力筹划' should be categorized as decide"
);

// 3.4 扩展 Feedback 术语：“战果核验”、“反哺重构”、“阵地转移”
const modernFeedback = {
  id: "act-fdb-mod-1",
  type: "任务后续",
  title: "高时敏打击毁伤战果核验与快速重构"
};
assert.equal(
  classifyActivityToOodaLane(modernFeedback),
  "feedback",
  "Modern term '战果核验与快速重构' should be categorized as feedback"
);

// 4. 测试复合词打分消歧与单一主泳道归类（杜绝多泳道重复计数）
// 例如：“察打一体突击编队交战” 既含“察”又含“打/突击/交战”，核心作战动作为 act
const compositeAct = {
  id: "act-comp-1",
  type: "多用途作战",
  title: "察打一体无人机前沿突击与穿透交战"
};
assert.equal(
  classifyActivityToOodaLane(compositeAct),
  "act",
  "Composite term '察打一体...突击交战' must disambiguate to act lane by operational weight"
);

// 5. 验证 evaluateOodaLoopHealth 中的全要素无重复计数与无遗漏闭环
const fullTestSuite = [
  explicitAct,
  missionMappedAct1,
  missionMappedAct2,
  missionMappedAct3,
  modernObserve1,
  modernObserve2,
  modernOrient,
  modernDecide,
  modernFeedback,
  compositeAct
];

const health = evaluateOodaLoopHealth({
  activities: fullTestSuite,
  edges: []
});

const totalInLanes =
  health.categorized.observe.length +
  health.categorized.orient.length +
  health.categorized.decide.length +
  health.categorized.act.length +
  health.categorized.feedback.length;

console.log("[T8.3 Test] Evaluated lanes breakdown:", {
  observe: health.stats.observeCount,
  orient: health.stats.orientCount,
  decide: health.stats.decideCount,
  act: health.stats.actCount,
  feedback: health.stats.feedbackCount,
  totalInLanes,
  expectedTotal: fullTestSuite.length
});

assert.equal(
  totalInLanes,
  fullTestSuite.length,
  "Total activities across all 5 lanes must exactly equal input activities (no duplicates, no omissions)"
);

console.log("[T8.3 Test] ✓ All T8.3 OODA Semantic Classifier checks PASSED successfully!");
